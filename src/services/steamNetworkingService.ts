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
 *   steam_create_lobby      → createSteamLobby
 *   steam_join_lobby        → joinSteamLobby
 *   steam_leave_lobby       → leaveSteamLobby
 *   steam_get_lobby_members → getLobbyMembers
 *   steam_set_lobby_data    → setLobbyData
 *   steam_get_lobby_data    → getLobbyData
 *   steam_send_p2p_message  → sendP2PMessage
 *   steam_read_p2p_messages → readP2PMessages
 *   steam_accept_p2p_session → acceptP2PSession
 *   steam_run_callbacks     → runSteamCallbacks
 */

import { hasSteam } from './platformService';

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

// ── Internal Tauri IPC helper ─────────────────────────────────────────────────

/**
 * Thin wrapper around Tauri `invoke` that:
 *  - Dynamically imports `@tauri-apps/api/core` (safe in non-Tauri builds)
 *  - Returns `null` and logs a warning on any failure
 *  - Short-circuits if `hasSteam` is false (non-desktop platforms)
 */
async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!hasSteam) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[SteamNetworking] invoke '${cmd}' failed:`, e);
    return null;
  }
}

// ── Lobby Management ──────────────────────────────────────────────────────────

/**
 * Create a Steam lobby with the given visibility and member cap.
 * Returns the lobby ID string on success, or null if unavailable.
 *
 * On non-Steam platforms returns null — caller should fall back to
 * WebSocket-based room creation.
 */
export async function createSteamLobby(
  lobbyType: SteamLobbyType,
  maxMembers: number,
): Promise<string | null> {
  if (!hasSteam) return null;
  return tauriInvoke<string>('steam_create_lobby', {
    lobby_type: lobbyType,
    max_members: maxMembers,
  });
}

/**
 * Join an existing Steam lobby by its lobby ID.
 * Returns true on success, false if the join failed or on non-Steam platforms.
 */
export async function joinSteamLobby(lobbyId: string): Promise<boolean> {
  if (!hasSteam) return false;
  return (await tauriInvoke<boolean>('steam_join_lobby', { lobby_id: lobbyId })) ?? false;
}

/**
 * Leave a Steam lobby the player is currently in.
 * No-op on non-Steam platforms.
 */
export async function leaveSteamLobby(lobbyId: string): Promise<void> {
  if (!hasSteam) return;
  await tauriInvoke('steam_leave_lobby', { lobby_id: lobbyId });
}

/**
 * Get the list of Steam users currently in a lobby.
 * Returns an empty array on non-Steam platforms or on failure.
 */
export async function getLobbyMembers(lobbyId: string): Promise<SteamLobbyMember[]> {
  if (!hasSteam) return [];
  return (await tauriInvoke<SteamLobbyMember[]>('steam_get_lobby_members', {
    lobby_id: lobbyId,
  })) ?? [];
}

// ── Lobby Metadata ────────────────────────────────────────────────────────────

/**
 * Set a key/value metadata pair on a Steam lobby.
 * Used to broadcast game mode, selected deck, and house rules to members.
 * No-op on non-Steam platforms.
 */
export async function setLobbyData(lobbyId: string, key: string, value: string): Promise<void> {
  if (!hasSteam) return;
  await tauriInvoke('steam_set_lobby_data', { lobby_id: lobbyId, key, value });
}

/**
 * Read a metadata value from a Steam lobby by key.
 * Returns null on non-Steam platforms or if the key is absent.
 */
export async function getLobbyData(lobbyId: string, key: string): Promise<string | null> {
  if (!hasSteam) return null;
  return tauriInvoke<string>('steam_get_lobby_data', { lobby_id: lobbyId, key });
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
): Promise<void> {
  if (!hasSteam) return;
  await tauriInvoke('steam_send_p2p_message', { steam_id: steamId, data, channel });
}

/**
 * Read all pending P2P messages waiting on a channel.
 * Returns an empty array on non-Steam platforms or when no messages are pending.
 *
 * @param channel - P2P channel index to read from (default 0)
 */
export async function readP2PMessages(channel: number = 0): Promise<SteamP2PMessage[]> {
  if (!hasSteam) return [];
  return (await tauriInvoke<SteamP2PMessage[]>('steam_read_p2p_messages', { channel })) ?? [];
}

/**
 * Accept an incoming P2P session request from a remote user.
 * Must be called before the first `readP2PMessages` can receive from that user.
 * No-op on non-Steam platforms.
 *
 * @param steamId - The initiating user's Steam ID (64-bit as string)
 */
export async function acceptP2PSession(steamId: string): Promise<void> {
  if (!hasSteam) return;
  await tauriInvoke('steam_accept_p2p_session', { steam_id: steamId });
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
  if (!hasSteam) return;
  await tauriInvoke('steam_run_callbacks');
}

// ── Poll Loop ─────────────────────────────────────────────────────────────────

/**
 * Start a background polling loop that:
 *  1. Pumps Steam callbacks via `runSteamCallbacks()`
 *  2. Reads all pending P2P messages via `readP2PMessages(channel)`
 *  3. Invokes `onMessage` for each received message
 *
 * The loop runs at ~60 Hz by default (16 ms interval) for low-latency
 * co-op play. Silently no-ops if `!hasSteam`.
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
  if (!hasSteam) {
    // Return a no-op cleanup on non-Steam platforms
    return () => {};
  }

  const id = setInterval(async () => {
    await runSteamCallbacks();
    const messages = await readP2PMessages(channel);
    for (const msg of messages) {
      onMessage(msg);
    }
  }, intervalMs);

  return () => clearInterval(id);
}
