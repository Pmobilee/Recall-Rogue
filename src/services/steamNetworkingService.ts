/**
 * Steam Networking service for Recall Rogue multiplayer.
 *
 * Wraps Steamworks Networking Sockets and P2P messaging behind platform guards.
 * On non-Steam platforms (mobile, web), all functions are no-ops that return
 * sensible defaults — the game falls back to WebSocket-based multiplayer.
 *
 * The Rust backend (src-tauri/src/steam.rs) implements the actual Steamworks
 * Networking calls. This module communicates with it via Tauri IPC (`invoke`).
 *
 * Tauri command → function mapping:
 *   steam_create_lobby        → createSteamLobby
 *   steam_join_lobby          → joinSteamLobby
 *   steam_leave_lobby         → leaveSteamLobby
 *   steam_get_lobby_members   → getLobbyMembers
 *   steam_request_lobby_list  → requestSteamLobbyList
 *   steam_get_lobby_list_result  → getSteamLobbyListResult
 *   steam_get_lobby_member_count → getLobbyMemberCount
 *   steam_set_lobby_data      → setLobbyData
 *   steam_get_lobby_data      → getLobbyData
 *   steam_send_p2p_message    → sendP2PMessage
 *   steam_read_p2p_messages   → readP2PMessages
 *   steam_accept_p2p_session  → acceptP2PSession
 *   steam_run_callbacks       → runSteamCallbacks
 *   steam_get_pending_lobby_id      → (internal, used by pollPendingResult in createSteamLobby)
 *   steam_get_pending_join_lobby_id → (internal, used by pollJoinResult in joinSteamLobby)
 *   steam_get_pending_join_error    → (internal, used by pollJoinResult — A3 error surfacing)
 *
 * Tauri v2 IPC arg naming convention:
 *   JS callers MUST pass camelCase keys (e.g. `lobbyId`, `lobbyType`, `maxMembers`, `steamId`).
 *   Tauri v2 automatically translates camelCase → snake_case before dispatching to Rust.
 *   Passing snake_case JS keys causes Tauri to reject the call with "missing required key
 *   'lobbyType'" — the command throws, `tauriInvoke` catches it and returns null, and the
 *   caller sees an instant null (looks like "Steam unavailable") with no stack trace.
 *   See docs/gotchas.md 2026-04-20 "Tauri v2 IPC snake_case args silently break Steam commands".
 *
 * Typed IPC contract (M23, 2026-04-20):
 *   `invokeSteam<K>(cmd, args)` is the public typed wrapper. It constrains both the
 *   command name and argument shape at compile time via `SteamCommandArgs`. TypeScript
 *   will catch camelCase-vs-snake_case mismatches or incorrect arg shapes before runtime.
 *   See docs/mechanics/multiplayer.md "Typed IPC contract" for the full rationale.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Visibility level for a Steam lobby. */
export type SteamLobbyType = 'public' | 'private' | 'friends_only' | 'invisible';

/** A single member currently in a Steam lobby. */
export interface SteamLobbyMember {
  steamId: string;
  displayName: string;
}

/** A P2P message received from a remote Steam user. */
export interface SteamP2PMessage {
  senderId: string;
  data: string;
}

/** D1: Overlay + launch-source diagnostic status returned by steam_overlay_status. */
export interface SteamOverlayStatus {
  /** True when ISteamUtils::BIsOverlayEnabled() reports the overlay is on. */
  overlayEnabled: boolean | null;
  /**
   * True when SteamAppId=4547570 or SteamGameId=4547570 is set in the process env —
   * the Steam client injects this only when the game is launched via the Steam library.
   * Launching the exe directly will NOT set these vars, and the overlay cannot hook.
   */
  launchedViaSteam: boolean;
  /** True when the Steamworks client initialized on startup (Steam client was running). */
  steamInitialized: boolean;
}

// ── M23: Typed IPC contract ───────────────────────────────────────────────────

/**
 * Compile-time mapping from Tauri command name → expected argument shape.
 *
 * All keys are camelCase — Tauri v2 translates to snake_case automatically.
 * Commands that take no args use `Record<string, never>` (an empty-object type
 * that rejects any key at compile time).
 *
 * NOTE: This interface is the single source of truth for IPC arg shapes.
 * When a new Rust command is added:
 *  1. Add an entry here.
 *  2. Call it via `invokeSteam()` rather than the raw `tauriInvoke()`.
 *  3. Add a return-type entry to `SteamCommandReturn` below.
 */
export interface SteamCommandArgs {
  steam_create_lobby: { lobbyType: SteamLobbyType; maxMembers: number };
  steam_join_lobby: { lobbyId: string };
  steam_leave_lobby: { lobbyId: string };
  steam_set_lobby_data: { lobbyId: string; key: string; value: string };
  steam_get_lobby_data: { lobbyId: string; key: string };
  steam_get_lobby_members: { lobbyId: string };
  steam_send_p2p_message: { steamId: string; data: string; channel?: number };
  steam_accept_p2p_session: { steamId: string };
  steam_request_lobby_list: Record<string, never>;
  steam_get_lobby_member_count: { lobbyId: string };
  steam_force_leave_active_lobby: Record<string, never>;
  steam_check_lobby_membership: { lobbyId: string; steamId: string };
  /** C2: Get the local user's Steam persona name. Synchronous (no callback needed). */
  steam_get_persona_name: Record<string, never>;
  /** Get the local user's 64-bit Steam ID as a decimal string. Used to find the remote peer in lobby_members. */
  steam_get_local_steam_id: Record<string, never>;
  /** Get the 64-bit Steam ID of a lobby's owner (host). Synchronous against Steam's local cache — reliable for P2P peer resolution on guest side. */
  steam_get_lobby_owner: { lobbyId: string };
  /** Internal polling commands — no args, accessed via pollPendingResult / pollJoinResult. */
  steam_get_pending_lobby_id: Record<string, never>;
  steam_get_pending_join_lobby_id: Record<string, never>;
  /** A3: One-shot error slot for join failures — parallel-polled by pollJoinResult. */
  steam_get_pending_join_error: Record<string, never>;
  steam_get_lobby_list_result: Record<string, never>;
  steam_read_p2p_messages: { channel: number };
  steam_run_callbacks: Record<string, never>;
  /** D1: Overlay + launch-source diagnostic (no args). */
  steam_overlay_status: Record<string, never>;
  /** Lobby metadata warm-up — call before GetLobbyData on lobbies discovered via RequestLobbyList. */
  steam_request_lobby_data: { lobbyId: string };
  /** Prime P2P sessions with all other lobby members by sending a zero-byte message.
   * Proactively triggers their session_request_callback so ConnectFailed is avoided.
   * Returns the count of peers primed. */
  steam_prime_p2p_sessions: { lobbyId: string };
  /** Get the SteamNetworkingMessages connection state for a specific peer.
   * Returns a diagnostic string: "state=Connected rtt=42 end_reason=None" */
  steam_get_p2p_connection_state: { steamId: string };
  /** LAN TCP probe — test TCP reachability of a host:port. */
  lan_tcp_probe: { host: string; port: number; timeoutMs?: number };
  /** BUG5: Read the most recent session failure reason for a peer (keyed by 64-bit decimal SteamID).
   * Returns the formatted failure string (e.g. "state=ProblemDetectedLocally end_reason=...") or null if none recorded. */
  steam_get_session_error: { steamId: string };
  /** BUG12: Set a Steam Rich Presence key. Host calls with key='connect', value='+connect_lobby <lobbyId>'. */
  steam_set_rich_presence: { key: string; value: string };
  /** BUG12: Clear all Steam Rich Presence keys (call on leaveLobby). */
  steam_clear_rich_presence: Record<string, never>;
}

/**
 * Compile-time mapping from Tauri command name → expected return type.
 *
 * `unknown` is used when the return is not consumed or when the result
 * varies per call (e.g. polling commands that return a pending value or null).
 */
export interface SteamCommandReturn {
  steam_create_lobby: string;
  steam_join_lobby: unknown;
  steam_leave_lobby: void;
  steam_set_lobby_data: void;
  steam_get_lobby_data: string;
  steam_get_lobby_members: SteamLobbyMember[];
  /** true on successful send, false on steamworks-level failure (ConnectFailed, etc.). */
  steam_send_p2p_message: boolean;
  /** true if the accept zero-byte was sent, false if Steam is unavailable or send failed. */
  steam_accept_p2p_session: boolean;
  steam_request_lobby_list: string;
  steam_get_lobby_member_count: number;
  steam_force_leave_active_lobby: void;
  steam_check_lobby_membership: boolean;
  /** C2: Returns the Steam persona name string, or null if Steam unavailable. */
  steam_get_persona_name: string | null;
  /** Local user's 64-bit Steam ID as decimal string, or null if Steam unavailable. */
  steam_get_local_steam_id: string | null;
  /** Lobby owner's 64-bit Steam ID as decimal string, or null if the lobby is unknown locally. */
  steam_get_lobby_owner: string | null;
  steam_get_pending_lobby_id: string | null;
  steam_get_pending_join_lobby_id: string | null;
  /** A3: string when a join error is pending; null when no error (or error already consumed). */
  steam_get_pending_join_error: string | null;
  steam_get_lobby_list_result: string[] | null;
  steam_read_p2p_messages: SteamP2PMessage[];
  steam_run_callbacks: void;
  /** D1: Returns the overlay diagnostic struct, or null when Tauri unavailable. */
  steam_overlay_status: SteamOverlayStatus;
  /** true when the request was submitted; false when data already cached or Steam unavailable. */
  steam_request_lobby_data: boolean;
  /** Number of peers primed (lobby members excluding self). */
  steam_prime_p2p_sessions: number;
  /** Single-line diagnostic string: "state=Connected rtt=42 end_reason=None" */
  steam_get_p2p_connection_state: string;
  /** "ok" on success, or a human-readable failure reason. */
  lan_tcp_probe: string;
  /** BUG5: The most recent session-failure diagnostic for a peer, or null if none recorded. */
  steam_get_session_error: string | null;
  /** BUG12: void on success, or throws on Steam unavailable. */
  steam_set_rich_presence: void;
  /** BUG12: void on success, or throws on Steam unavailable. */
  steam_clear_rich_presence: void;
}

/**
 * Typed wrapper for Tauri IPC calls to Steam commands.
 *
 * Constrains both the command name (`K extends keyof SteamCommandArgs`) and
 * the argument shape (`SteamCommandArgs[K]`) at compile time. TypeScript will
 * catch mismatched arg keys or wrong types before the code runs.
 *
 * For `Record<string, never>` commands (no args), omit the `args` parameter
 * or pass `{}` — both are safe because `Record<string, never>` accepts `{}`.
 *
 * Internally delegates to `tauriInvoke` — platform guard and error logging
 * are handled there.
 *
 * @example
 * // Typed — TypeScript errors if args don't match SteamCommandArgs['steam_create_lobby']
 * const id = await invokeSteam('steam_create_lobby', { lobbyType: 'public', maxMembers: 4 });
 *
 * @example
 * // No-args command — omit args entirely
 * await invokeSteam('steam_request_lobby_list');
 */
export async function invokeSteam<K extends keyof SteamCommandArgs>(
  cmd: K,
  args?: SteamCommandArgs[K],
): Promise<SteamCommandReturn[K] | null> {
  return tauriInvoke<SteamCommandReturn[K]>(cmd, args as Record<string, unknown> | undefined);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns true if we are running inside a Tauri runtime.
 *
 * Uses a live check against window globals rather than a module-load-time
 * snapshot so that the result is always accurate at call time (e.g. when
 * called before Tauri has finished injecting its globals, or in test
 * environments that inject the globals lazily).
 *
 * Checks `__TAURI_INTERNALS__` first (always present in Tauri v2 because
 * `invoke` depends on it), then `__TAURI__` for Tauri v1 and Tauri v2 with
 * `withGlobalTauri: true`. Mirrors the pattern in `multiplayerLobbyService`
 * `pickBackend()`.
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

// ── Last-invoke-error diagnostic slot ────────────────────────────────────────

/**
 * Carries the most recent IPC failure from `tauriInvoke`.
 * Cleared at the start of every `tauriInvoke` call so it always reflects
 * the last attempt only. Null when no failure has occurred yet or the last
 * call succeeded.
 */
let lastInvokeError: { cmd: string; message: string } | null = null;

/**
 * Return the error detail from the most recent failed `tauriInvoke` call,
 * or null if the last call succeeded (or no call has been made yet).
 *
 * Callers (e.g. `steamBackend.createLobby`) use this to surface the real IPC
 * failure text in thrown errors instead of the generic "Steam may be unavailable"
 * message, making the multiplayer error banner actionable.
 */
export function getLastSteamInvokeError(): { cmd: string; message: string } | null {
  return lastInvokeError;
}

// ── Internal Tauri IPC helper ─────────────────────────────────────────────────

/**
 * Thin wrapper around Tauri `invoke` that:
 *  - Dynamically imports `@tauri-apps/api/core` (safe in non-Tauri builds)
 *  - Returns `null` and logs a warning on any failure
 *  - Short-circuits on non-Tauri platforms via a live runtime check
 *  - Stores the last failure in `lastInvokeError` for callers to surface
 *
 * The guard uses a live check (`isTauriRuntime()`) rather than the module-load-time
 * `hasSteam` snapshot. Without this, a Steam build where `__TAURI_INTERNALS__` was
 * injected after module evaluation would still short-circuit to null on every call
 * even though `pickBackend()` correctly routed to `steamBackend`.
 *
 * IMPORTANT — arg naming: always pass camelCase keys in `args`. Tauri v2 translates
 * camelCase → snake_case automatically before dispatching to Rust. Passing snake_case
 * keys causes a silent "missing required key" rejection.
 *
 * Prefer `invokeSteam()` over calling this function directly — it enforces the
 * typed contract at compile time.
 */
async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  // Reset diagnostic slot before each call so it only reflects this attempt.
  lastInvokeError = null;
  if (!isTauriRuntime()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (e) {
    const err = e as Error;
    const message = err?.message ?? String(e);
    lastInvokeError = { cmd, message };
    console.warn(`[SteamNetworking] invoke '${cmd}' threw:`, {
      name: err?.name ?? 'unknown',
      message,
    });
    return null;
  }
}

// ── Async-callback polling bridge ─────────────────────────────────────────────

/**
 * Poll a Tauri "pending result" command until it returns a non-null string,
 * pumping Steam callbacks each tick. Used to bridge Steamworks' async callback
 * model into a synchronous-looking Promise for createSteamLobby.
 *
 * Steamworks lobby operations (create) return immediately at the IPC boundary
 * but deliver their results via a callback that fires later when
 * `steam_run_callbacks` is pumped. This helper spins the pump loop until
 * the pending-result slot is populated, then returns it.
 *
 * Resolves with the pending value, or null on timeout.
 */
async function pollPendingResult(
  pendingCmd: string,
  timeoutMs: number = 5000,
  intervalMs: number = 100,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Pump the Steamworks callback queue so the lobby callback can fire.
    await tauriInvoke('steam_run_callbacks');
    const value = await tauriInvoke<string | null>(pendingCmd);
    if (value) return value;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * A3: Poll for the result of a Steam join lobby operation.
 *
 * Runs a parallel poll loop against both `steam_get_pending_join_lobby_id` (success slot)
 * and `steam_get_pending_join_error` (error slot). Whichever returns a non-null value first wins:
 *  - Error slot populated  → throws `Error(errorMessage)` so callers see the real Steam reason.
 *  - ID slot populated     → resolves with the lobby ID string.
 *  - Neither within timeout → resolves with null (same as pre-A3 timeout behaviour).
 *
 * Uses a 10s timeout instead of 5s — Steam join callbacks can be slow on cold lobbies
 * (host not yet registered, NAT traversal, etc.).
 *
 * @returns The joined lobby ID string on success, or null on timeout.
 * @throws  Error with the Steam error message when the join callback fires with an error.
 */
async function pollJoinResult(
  timeoutMs: number = 10000,
  intervalMs: number = 100,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await tauriInvoke('steam_run_callbacks');

    // Check both slots in the same tick — consume whichever fires first.
    const [idValue, errorValue] = await Promise.all([
      tauriInvoke<string | null>('steam_get_pending_join_lobby_id'),
      tauriInvoke<string | null>('steam_get_pending_join_error'),
    ]);

    if (errorValue) {
      // Error path: throw so joinSteamLobby propagates the real reason.
      throw new Error(errorValue);
    }
    if (idValue) return idValue;

    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

// ── Lobby Management ──────────────────────────────────────────────────────────

/**
 * Create a Steam lobby with the given visibility and member cap.
 *
 * Steamworks lobby creation is asynchronous — the Rust command returns immediately
 * and the real lobby ID arrives via a callback after `steam_run_callbacks` is pumped.
 * This function polls until the callback fires (up to 5 s), then returns the ID.
 *
 * Returns the lobby ID string on success, or null if unavailable or timed out.
 * On non-Steam platforms returns null — caller should fall back to WebSocket-based
 * room creation.
 */
export async function createSteamLobby(
  lobbyType: SteamLobbyType,
  maxMembers: number,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  // Kick off lobby creation — returns "" immediately; real ID delivered via callback.
  // Args are camelCase — Tauri v2 translates to snake_case for Rust automatically.
  const kickoff = await invokeSteam('steam_create_lobby', { lobbyType, maxMembers });
  if (kickoff === null) return null; // IPC call itself failed (Steamworks not running, etc.)
  // Poll until the LobbyCreated_t callback fires and stores the ID.
  return pollPendingResult('steam_get_pending_lobby_id');
}

/**
 * Join an existing Steam lobby by its lobby ID.
 *
 * Steamworks join is asynchronous — the Rust command returns immediately and the
 * LobbyEnter_t callback fires after `steam_run_callbacks` is pumped.
 *
 * A3: Uses `pollJoinResult` which polls both the success slot and the error slot
 * in parallel (10s timeout). When the callback fires with a failure, the real Steam
 * error reason is thrown so callers can surface it in the UI instead of showing a
 * generic "join failed" message.
 *
 * @throws Error with the Steam error message if the join callback reports a failure.
 * @returns The joined lobby ID string on success, or null on timeout (non-Steam or no response).
 */
export async function joinSteamLobby(lobbyId: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  // Kick off join — Rust returns Ok(()) which Tauri serialises to null.
  // `kickoff` is always null here whether the IPC failed OR succeeded — we
  // can't distinguish from the return alone. Use getLastSteamInvokeError()
  // to tell the two apart: a thrown invoke clears, then sets, the slot.
  const errorBefore = getLastSteamInvokeError();
  await invokeSteam('steam_join_lobby', { lobbyId });
  const errorAfter = getLastSteamInvokeError();
  if (errorAfter && errorAfter !== errorBefore) {
    console.warn('[steamNetworking] steam_join_lobby IPC failed:', errorAfter);
    return null;
  }
  // A3: Poll both success and error slots — throws on error, returns id on success.
  try {
    const result = await pollJoinResult();
    console.log('[steamNetworking] joinSteamLobby result', { lobbyId, result, error: null });
    return result;
  } catch (error) {
    console.log('[steamNetworking] joinSteamLobby result', { lobbyId, result: null, error: String(error) });
    throw error;
  }
}

/**
 * Leave a Steam lobby the player is currently in.
 * No-op on non-Steam platforms.
 */
export async function leaveSteamLobby(lobbyId: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeSteam('steam_leave_lobby', { lobbyId });
}

/**
 * Get the list of Steam users currently in a lobby.
 * Returns an empty array on non-Steam platforms or on failure.
 */
export async function getLobbyMembers(lobbyId: string): Promise<SteamLobbyMember[]> {
  if (!isTauriRuntime()) return [];
  return (await invokeSteam('steam_get_lobby_members', { lobbyId })) ?? [];
}

/**
 * Request a list of public Steam lobbies for this app (async via Steam callback).
 *
 * This is a fire-and-forget kick. The actual lobby IDs arrive later via the
 * Steamworks LobbyMatchList_t callback. Callers must pump `runSteamCallbacks` after
 * invoking this and then call `getSteamLobbyListResult` to retrieve the IDs once
 * the callback fires.
 *
 * Returns `false` on non-Steam platforms (browser/mobile) — caller should fall back
 * to the web or broadcast backend.
 */
export async function requestSteamLobbyList(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const result = await invokeSteam('steam_request_lobby_list');
  return result !== null;
}

/**
 * Poll the Matchmaking callback slot for the most recent request_lobby_list result.
 *
 * Returns the list of 64-bit lobby IDs (decimal strings) once the LobbyMatchList_t
 * callback fires, or null on timeout. Pumps `steam_run_callbacks` between polls so
 * the callback can fire.
 *
 * Distinguishes two non-error states:
 *  - null   = callback has not fired yet (timed out waiting)
 *  - []     = callback fired, no lobbies matched (valid result, not an error)
 *
 * @param timeoutMs  Maximum milliseconds to wait for the callback (default 3000)
 * @param intervalMs Polling interval in milliseconds (default 100)
 */
export async function getSteamLobbyListResult(
  timeoutMs: number = 3000,
  intervalMs: number = 100,
): Promise<string[] | null> {
  if (!isTauriRuntime()) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await invokeSteam('steam_run_callbacks');
    const value = await invokeSteam('steam_get_lobby_list_result');
    // value is non-null (including []) when the callback has fired.
    if (value !== null && value !== undefined) return value as string[];
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Get the current member count of a Steam lobby by ID (synchronous).
 *
 * Used by the lobby browser to show "2/4" without joining. Returns 0 on non-Steam
 * platforms or if the lobby is unknown.
 *
 * @param lobbyId - 64-bit Steam ID as a decimal string
 */
export async function getLobbyMemberCount(lobbyId: string): Promise<number> {
  if (!isTauriRuntime()) return 0;
  return (await invokeSteam('steam_get_lobby_member_count', { lobbyId })) ?? 0;
}

// ── Lobby Metadata ────────────────────────────────────────────────────────────

/**
 * Set a key/value metadata pair on a Steam lobby.
 * Used to broadcast game mode, selected deck, and house rules to members.
 * No-op on non-Steam platforms.
 */
export async function setLobbyData(lobbyId: string, key: string, value: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeSteam('steam_set_lobby_data', { lobbyId, key, value });
}

/**
 * Read a metadata value from a Steam lobby by key.
 * Returns null on non-Steam platforms or if the key is absent.
 */
export async function getLobbyData(lobbyId: string, key: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invokeSteam('steam_get_lobby_data', { lobbyId, key });
}

// ── C2: Local user identity ──────────────────────────────────────────────────

/**
 * Get the Steam persona name (display name) of the locally signed-in player.
 *
 * Returns the name Steam shows in the overlay and friends list — the same name
 * other players see in lobbies. Synchronous on the Rust side (no callback).
 *
 * Returns null on non-Tauri builds (web, mobile, CI) or when Steam is unavailable.
 * Callers should fall back to authStore.displayName when this returns null.
 *
 * @example
 *   const name = await getLocalPersonaName() ?? authStore.displayName ?? 'Player';
 */
export async function getLocalPersonaName(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const result = await invokeSteam('steam_get_persona_name');
  return result ?? null;
}

/**
 * Return the local user's 64-bit Steam ID as a decimal string, or null if Steam
 * is unavailable (non-Tauri runtime, Steam client not running, etc.).
 *
 * Used by the multiplayer lobby layer to filter the local player out of
 * `getLobbyMembers` results so the remaining entry is the remote peer's Steam
 * ID — required for Steam P2P messaging, which addresses users by SteamID
 * rather than lobby ID.
 */
export async function getLocalSteamId(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const result = await invokeSteam('steam_get_local_steam_id');
  return result ?? null;
}

/**
 * Return the Steam lobby owner's 64-bit SteamID as a decimal string, or `null`
 * when Steam is unavailable or the lobby isn't cached locally yet.
 *
 * Preferred over filtering `getLobbyMembers` for resolving the P2P peer on the
 * guest side — owner is a synchronous single-field read against Steam's local
 * cache, not dependent on the member-list sync timing.
 */
export async function getLobbyOwner(lobbyId: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const result = await invokeSteam('steam_get_lobby_owner', { lobbyId });
  return result ?? null;
}


// ── D1: Steam overlay diagnostic ─────────────────────────────────────────────

/**
 * Return the Steam overlay + launch-source diagnostic status.
 *
 * Use this in the dev diagnostic panel (?dev=true) to surface whether the overlay
 * is configured and whether the process was launched through the Steam client.
 *
 * Even when all fields look correct the overlay may not render on
 * WebView2/WKWebView — this is a known upstream limitation. The definitive
 * positive signal is the \ line
 * in stdout when the user presses Shift+Tab.
 *
 * Returns null on non-Tauri builds (web, mobile, CI) or on IPC failure.
 */
export async function getSteamOverlayStatus(): Promise<SteamOverlayStatus | null> {
  if (!isTauriRuntime()) return null;
  return (await invokeSteam('steam_overlay_status')) ?? null;
}
// ── Lobby Metadata Warm-up ────────────────────────────────────────────────────

/**
 * Request that Steam fetch fresh metadata for a lobby discovered via RequestLobbyList.
 *
 * Steam's GetLobbyData returns "" for lobbies whose metadata the local client hasn't
 * yet cached. For lobbies you are NOT a member of (i.e. lobbies returned by
 * RequestLobbyList), you must call RequestLobbyData first and wait for the
 * LobbyDataUpdate_t callback before GetLobbyData is guaranteed to return real values.
 *
 * The background callback pump in SteamState::new() processes LobbyDataUpdate_t
 * automatically — callers just need to wait ~50–200 ms after this call before reading
 * metadata with getLobbyData.
 *
 * Returns true when the request was submitted (metadata not yet cached).
 * Returns false when data is already cached locally (no request needed) or Steam is
 * unavailable. In both cases it is safe to proceed — the false/cached case means
 * GetLobbyData will already return real values.
 *
 * @param lobbyId - 64-bit Steam lobby ID as a decimal string
 */
export async function requestSteamLobbyData(lobbyId: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const result = await invokeSteam('steam_request_lobby_data', { lobbyId });
  return result === true;
}

// ── P2P Messaging ─────────────────────────────────────────────────────────────

/**
 * Send a P2P message to a specific Steam user.
 * Messages are sent on `channel` (default 0).
 * No-op on non-Steam platforms.
 *
 * @param steamId - Target user's Steam ID (64-bit as string)
 * @param data    - Serialized message payload (typically JSON)
 * @param channel - P2P channel index (default 0)
 */
export async function sendP2PMessage(
  steamId: string,
  data: string,
  channel: number = 0,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  // BUG1: Rust returns Result<bool, String>. Ok(true) = sent, Ok(false) = steamworks send failure.
  // The previous void return erased the bool so the _sendWithRetry loop could never detect resolved-false.
  return (await invokeSteam('steam_send_p2p_message', { steamId, data, channel })) ?? false;
}

/**
 * Read all pending P2P messages waiting on a channel.
 * Returns an empty array on non-Steam platforms or when no messages are pending.
 *
 * @param channel - P2P channel index to read from (default 0)
 */
export async function readP2PMessages(channel: number = 0): Promise<SteamP2PMessage[]> {
  if (!isTauriRuntime()) return [];
  return (await invokeSteam('steam_read_p2p_messages', { channel })) ?? [];
}

/**
 * Accept an incoming P2P session request from a remote user.
 * Must be called before the first `readP2PMessages` can receive from that user.
 * No-op on non-Steam platforms.
 *
 * @param steamId - The initiating user's Steam ID (64-bit as string)
 */
export async function acceptP2PSession(steamId: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  // BUG3: Rust returns Result<bool, String>. Propagate the bool so callers can log false without failing hard.
  return (await invokeSteam('steam_accept_p2p_session', { steamId })) ?? false;
}

// ── Callback Pump ─────────────────────────────────────────────────────────────

/**
 * Pump the Steam callback queue.
 * Must be called regularly to process incoming P2P session requests,
 * lobby join responses, and other async Steamworks callbacks.
 *
 * Typically invoked at ~60 Hz via `startMessagePollLoop`. No-op on
 * non-Steam platforms.
 */
export async function runSteamCallbacks(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeSteam('steam_run_callbacks');
}

// ── Poll Loop ─────────────────────────────────────────────────────────────────

/**
 * Start a background polling loop that:
 *  1. Pumps Steam callbacks via `runSteamCallbacks()`
 *  2. Reads all pending P2P messages via `readP2PMessages(channel)`
 *  3. Invokes `onMessage` for each received message
 *
 * The loop runs at ~60 Hz by default (16 ms interval) for low-latency
 * co-op play. Silently no-ops on non-Tauri platforms.
 *
 * Returns a cleanup function — call it to stop the loop (e.g., on scene
 * destroy or when the player leaves a lobby).
 *
 * @param onMessage   - Callback invoked with each received `SteamP2PMessage`
 * @param channel     - P2P channel to read from (default 0)
 * @param intervalMs  - Poll interval in milliseconds (default 16 ≈ 60 Hz)
 * @returns Cleanup function that clears the interval
 *
 * @example
 * const stop = startMessagePollLoop((msg) => {
 *   handleOpponentAction(JSON.parse(msg.data));
 * });
 * // Later, on scene destroy:
 * stop();
 */
export function startMessagePollLoop(
  onMessage: (msg: SteamP2PMessage) => void,
  channel: number = 0,
  intervalMs: number = 16,
): () => void {
  if (!isTauriRuntime()) {
    // Return a no-op cleanup on non-Tauri platforms
    return () => {};
  }

  // BUG7: Heartbeat counter — track messages received per 5s window.
  // Warns in the log when connected but receiving nothing (isolation detection).
  let heartbeatWindowCount = 0;
  let heartbeatWindowStart = Date.now();
  let connectedSince = Date.now();
  const HEARTBEAT_WINDOW_MS = 5000;

  const id = setInterval(async () => {
    await runSteamCallbacks();
    const messages = await readP2PMessages(channel);
    heartbeatWindowCount += messages.length;
    for (const msg of messages) {
      onMessage(msg);
    }
    // Emit heartbeat log every 5 seconds.
    const now = Date.now();
    if (now - heartbeatWindowStart >= HEARTBEAT_WINDOW_MS) {
      const sinceStart = Math.floor((now - connectedSince) / 1000);
      const windowCount = heartbeatWindowCount;
      heartbeatWindowCount = 0;
      heartbeatWindowStart = now;
      if (windowCount === 0 && sinceStart > 10) {
        console.warn(`[mp:rx:heartbeat] channel=${channel} messagesLastWindow=0 sinceStart=${sinceStart}s WARN: no messages received in 5s window`);
      } else {
        console.log(`[mp:rx:heartbeat] channel=${channel} messagesLastWindow=${windowCount} sinceStart=${sinceStart}s`);
      }
    }
  }, intervalMs);

  return () => clearInterval(id);
}

// ── P2P Session Priming ───────────────────────────────────────────────────────

/**
 * Prime P2P sessions with all other members of a lobby.
 *
 * Sends a zero-byte reliable message to every other lobby member, which:
 *   (a) Triggers their session_request_callback to auto-accept the session, AND
 *   (b) Implicitly accepts the reverse direction under Steam's session rules.
 *
 * Call this immediately after create_lobby or join_lobby success to eliminate the
 * ConnectFailed race where neither side has accepted the other's session yet.
 *
 * Returns the number of peers primed (0 on non-Tauri builds or when no peers exist).
 *
 * @param lobbyId - 64-bit Steam lobby ID as a decimal string
 */
export async function primeP2PSessions(lobbyId: string): Promise<number> {
  if (!isTauriRuntime()) return 0;
  const result = await invokeSteam('steam_prime_p2p_sessions', { lobbyId });
  return result ?? 0;
}

/**
 * Get the SteamNetworkingMessages connection state for a specific peer.
 *
 * Returns a single-line diagnostic string like:
 *   "state=Connected rtt=42 end_reason=None"
 *   "state=Connecting rtt=-1 end_reason=None"
 *   "state=ProblemDetectedLocally rtt=-1 end_reason=Some(...)"
 *
 * Used by the send retry path in SteamP2PTransport to include connection context
 * in failure log lines.
 *
 * Returns "state=None" on non-Tauri builds or when no session exists for this peer.
 *
 * @param steamId - 64-bit Steam ID of the peer as a decimal string
 */
export async function getP2PConnectionState(steamId: string): Promise<string> {
  if (!isTauriRuntime()) return 'state=None';
  const result = await invokeSteam('steam_get_p2p_connection_state', { steamId });
  return result ?? 'state=None';
}

/**
 * BUG5: Retrieve the most recent session failure diagnostic for a peer.
 *
 * When the session_failed_callback fires in Rust, it writes a formatted string
 * ("state=... end_reason=...") into last_session_errors keyed by peer SteamID.
 * This helper reads that slot so the TS retry path can include it in failure logs.
 *
 * Returns null when no failure has been recorded for this peer or Steam is unavailable.
 * The error slot is persistent (not one-shot) — multiple reads return the same value.
 *
 * @param steamId - 64-bit Steam ID of the peer as a decimal string
 */
export async function getSessionError(steamId: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return (await invokeSteam('steam_get_session_error', { steamId })) ?? null;
}

/**
 * Probe a remote TCP endpoint to test LAN reachability.
 *
 * Guests can call this before attempting a full LAN lobby join to verify that
 * the host's IP:port is reachable. Returns "ok" on success or a human-readable
 * failure reason ("refused", "timeout", "host_unreachable:...") on failure.
 *
 * @param host       - IPv4/IPv6 address or hostname
 * @param port       - TCP port number
 * @param timeoutMs  - Maximum milliseconds to wait (default 2000)
 */
export async function lanTcpProbe(host: string, port: number, timeoutMs = 2000): Promise<string> {
  if (!isTauriRuntime()) return 'state=None';
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('lan_tcp_probe', { host, port, timeoutMs }) ?? 'ok';
  } catch (e) {
    return String((e as Error)?.message ?? e);
  }
}

// ── Steam Rich Presence (BUG12) ───────────────────────────────────────────────

/**
 * Set a Steam Rich Presence key-value pair.
 *
 * Steam displays Rich Presence values in the friends list (e.g., the 'connect' key
 * activates the "Join Game" button for friends). Setting key='connect' to
 * '+connect_lobby <lobbyId>' enables friends to click Join Game in the Steam overlay.
 *
 * No-op on non-Tauri builds. Fire-and-forget — callers do not need to await.
 */
export async function setRichPresence(key: string, value: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeSteam('steam_set_rich_presence', { key, value });
}

/**
 * Clear all Steam Rich Presence keys.
 *
 * Call this when the host leaves a lobby so friends see the player as available
 * (no active game) rather than showing stale lobby information.
 *
 * No-op on non-Tauri builds. Fire-and-forget.
 */
export async function clearRichPresence(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeSteam('steam_clear_rich_presence');
}

