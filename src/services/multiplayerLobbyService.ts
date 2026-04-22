/**
 * Multiplayer lobby service for Recall Rogue.
 *
 * Orchestrates lobby creation, joining, settings, and game start.
 * Uses the transport layer (multiplayerTransport.ts) for communication —
 * works identically on Steam P2P and WebSocket.
 *
 * Lobby flow:
 *   1. Host creates lobby (createLobby)
 *   2. Other players join via code or invite (joinLobby)
 *   3. Host configures mode, deck, house rules (updateSettings)
 *   4. All players ready up (setReady)
 *   5. Host starts game (startGame) -> shared seed generated and distributed
 *
 * Two-tab local testing:
 *   Add `?mp` to the URL in both tabs to activate BroadcastChannel transport.
 *   No server or Steam required. See docs/mechanics/multiplayer.md.
 *
 * Backend abstraction (Phase 6):
 *   Discovery, create, and join-by-id are routed through the LobbyBackend
 *   interface with three implementations: steamBackend (Steamworks),
 *   webBackend (Fastify REST + WS), and broadcastBackend (localStorage fake
 *   directory for two-tab dev testing). pickBackend() selects at call time.
 */

import { getMultiplayerTransport, destroyMultiplayerTransport, createLocalTransportPair, LocalMultiplayerTransport, initPeerPresenceMonitor } from "./multiplayerTransport";
import type { ConnectOpts, MultiplayerMessageType } from "./multiplayerTransport";
import type {
  LobbyState, LobbyPlayer, MultiplayerMode, DeckSelectionMode,
  HouseRules, RaceProgress, RaceResults, LobbyContentSelection,
  LobbyVisibility, LobbyBrowserEntry, LobbyListFilter,
} from '../data/multiplayerTypes';
import { DEFAULT_HOUSE_RULES, MODE_MAX_PLAYERS, MODE_MIN_PLAYERS } from '../data/multiplayerTypes';
import { isDesktop, isTauriPresent } from './platformService';
import { sanitizeLobbyTitle } from './profanityService';
import { getLocalMultiplayerRating } from './multiplayerElo';
import { getLanServerUrls, isLanMode, clearLanServerUrl } from './lanConfigService';
import { rrLog } from './rrLog';
import {
  createSteamLobby,
  setLobbyData,
  getLobbyData,
  joinSteamLobby,
  requestSteamLobbyList,
  getSteamLobbyListResult,
  getLobbyMemberCount,
  leaveSteamLobby,
  getLastSteamInvokeError,
  requestSteamLobbyData,
  getLobbyMembers,
  getLocalSteamId,
  getLobbyOwner,
  primeP2PSessions,
  setRichPresence,
  clearRichPresence,
  getPendingPeerLeft,
} from './steamNetworkingService';
import type { SteamLobbyType } from './steamNetworkingService';

// ── Broadcast Mode Detection ──────────────────────────────────────────────────

/**
 * Check if we're in broadcast (two-tab) multiplayer dev mode.
 *
 * Returns true when the `?mp` URL param is present, activating BroadcastChannel
 * transport for two-tab local multiplayer testing.
 * Safe to call in non-browser environments (returns false).
 *
 * Exported so the UI layer can show a dev-mode indicator badge when running
 * with simulated latency/packet-loss conditions.
 */
export function isBroadcastMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('mp');
}

// ── Player ID Generation ──────────────────────────────────────────────────────

/**
 * Generate a unique player ID for this tab session.
 * Combines a timestamp (base-36) and 4 random chars to guarantee uniqueness
 * across tabs opened within the same millisecond.
 *
 * Used by CardApp.svelte to avoid the two tabs colliding on 'local_player'.
 */
export function generatePlayerId(): string {
  return `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Lobby State ──────────────────────────────────────────────────────────────

let _currentLobby: LobbyState | null = null;
let _localPlayerId: string = '';
// BUG22 fix: multi-subscriber set. Previously a single-slot `_onLobbyUpdate`
// callback was overwritten every time a new component registered (CardApp mounts
// → registers its currentLobby-reassignment callback → MultiplayerLobby mounts
// → registers a no-op → CardApp's callback is silently discarded). Result: the
// host could select a deck, the service mutated `_currentLobby.contentSelection`
// and called `notifyLobbyUpdate`, but the no-op fired instead of CardApp's
// reactive-reassignment, so the parent's `$state` never reassigned and the
// child's `lobby` prop stayed stale — UI read "No content selected" even though
// the service-layer state was correct. Same pattern likely masked other state
// drift (ready toggles, player list, house-rule changes). Fix: a Set; each
// subscriber independent; `notifyLobbyUpdate` iterates and calls all.
const _lobbyUpdateSubscribers = new Set<(lobby: LobbyState) => void>();
// BUG23: same failure mode as BUG22 — single-slot callbacks silently clobbered
// when multiple components register. `CardApp.svelte` registers the critical
// scene-transition onGameStart; `MultiplayerLobby.svelte` later registers a
// no-op placeholder that overwrites it. Result: host click "Start" → guest
// ACKs → host's _fireSubscribers(_gameStartSubscribers, ) fires the no-op → scene never transitions →
// _pendingStartAcks retry loop fires every 750ms forever.
// Fix: multi-subscriber Set (same pattern as _lobbyUpdateSubscribers).
const _gameStartSubscribers = new Set<(seed: number, lobby: LobbyState) => void>();
const _raceProgressSubscribers = new Set<(progress: RaceProgress) => void>();
const _raceResultsSubscribers = new Set<(results: RaceResults) => void>();

/**
 * L4: Callback fired when the local player receives an `mp:lobby:kick` message
 * from the host targeting their own player ID. Passes an error key so the UI
 * can display an appropriate message (e.g. "You were removed by the host.").
 *
 * Wiring: register before calling `joinLobby()`. Cleared in `leaveLobby()`.
 * UI is post-MVP — the primitive is shipped so future UI work can light it up.
 */
const _lobbyErrorSubscribers = new Set<(error: string) => void>();

/**
 * Host-side password hash (SHA-256 hex of the plaintext).
 * Stored only in memory on the host — never serialised into LobbyState.
 * Forwarded to the backend on create/setPassword calls.
 * NOT a security boundary: this is a UX gate. See gotchas.md.
 */
let _passwordHash: string | null = null;

/**
 * setInterval handle for the broadcast-mode lobby directory heartbeat.
 * The host writes its LobbyBrowserEntry to localStorage every BC_HEARTBEAT_MS.
 * Cleared in leaveLobby() so the entry expires when the host disconnects.
 */
let _broadcastHeartbeat: ReturnType<typeof setInterval> | null = null;

/** Transport for the local bot player, if one is active. Dev-only. */
let _botTransport: LocalMultiplayerTransport | null = null;

/**
 * Guards against double handler registration.
 * setupMessageHandlers() is called by createLobby(), joinLobby(), and
 * joinLobbyById(). If a code path calls it twice on the same transport,
 * every message handler fires twice, doubling side-effects (e.g. ready
 * toggles getting overwritten). Reset in leaveLobby().
 *
 * #067: We track the transport reference the guard was set against so a
 * different transport instance (e.g. addLocalBot's separate transport)
 * still gets handlers attached. Without this scoping, the bot transport
 * silently runs without any lobby handlers in a session that already
 * created the Steam transport.
 */
let _handlersAttached = false;
let _handlersAttachedTransport: unknown = null;

/**
 * BUG16: Cleanup functions returned by each transport.on() call inside
 * setupMessageHandlers. Stored so leaveLobby can remove them before the
 * next join re-attaches. Without this, each create→leave→join cycle
 * accumulates an extra copy of every handler on the singleton transport.
 */
let _activeHandlerCleanups: Array<() => void> = [];

// ── H10: Peer presence monitor teardown ─────────────────────────────────────────
/**
 * Cleanup returned by initPeerPresenceMonitor(). Stored so leaveLobby() can
 * stop the ping loop and unsubscribe transport listeners without the caller
 * needing to hold a reference.
 * #76: Wired in createLobby(), joinLobby(), joinLobbyById(); torn down in leaveLobby().
 */
let _peerMonitorTeardown: (() => void) | null = null;

/**
 * Host-side Steam peer-detection poll cancellation handle. Set in createLobby()
 * when Steam is the active backend (host has no remote peer until someone
 * joins). Cleared when the peer is found (transport connects) or when
 * leaveLobby() runs while still waiting.
 */
let _steamHostPeerPollCancel: (() => void) | null = null;

// ── L2: Lobby code collision registry ────────────────────────────────────────
/**
 * Recently-generated lobby codes — prevents accidental collisions during a session.
 * Module-level Set; cleared when the entry TTL window means codes can safely recycle.
 * In practice, with 32^6 = ~1B combinations at BC_ENTRY_TTL_MS = 15s, collisions
 * are astronomically rare. The Set is purely a last-resort safety net.
 */
const _recentLobbyCodes = new Set<string>();

// ── H13: Per-player ready version counter ────────────────────────────────────
/**
 * Incremented on each local setReady() call. Broadcast with mp:lobby:ready so the
 * settings-merge handler can detect stale incoming ready states and keep the
 * more-recent local value. Prevents late-arriving settings broadcasts from
 * overwriting a fresh toggle-off.
 */
let _localReadyVersion = 0;

// ── #037: Settings sequence number ───────────────────────────────────────────
/**
 * Monotonic sequence number stamped onto every mp:lobby:settings broadcast by the host.
 * Guests track the highest seq they have observed in _lastSettingsSeqSeen and reject
 * any incoming settings with seq <= that value. Defends against out-of-order delivery
 * on lossy Steam P2P clobbering newer state with older.
 *
 * Host increments _settingsSeq before each broadcast.
 * Guest reads incoming.seq; rejects (no merge, no notifyLobbyUpdate) if stale.
 * Reset to 0 in leaveLobby so a fresh lobby starts clean.
 */
let _settingsSeq = 0;
let _lastSettingsSeqSeen = 0;

// ── H5: Seed ACK state (host-only) ───────────────────────────────────────────
/**
 * Set of player IDs that have not yet ACKed the mp:lobby:start seed.
 * Null when no start is in progress. Cleared when all ACKs arrive or timeout fires.
 */
let _pendingStartAcks: Set<string> | null = null;
let _startAckRetryTimer: ReturnType<typeof setInterval> | null = null;
let _startAckTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
/** Captured start payload for retry broadcasts. */
let _lastStartPayload: Record<string, unknown> | null = null;
/**
 * True once the host's own onGameStart subscribers have been fired for the current
 * start attempt. Prevents double-fire when both the host self-loopback (BUG-8 fix)
 * and an ACK-all-arrived path exist.
 */
let _hostStartFired = false;

// ── H10: Reconnect grace timers ───────────────────────────────────────────────
/**
 * Map from player ID to their pending reconnect-expiry timer handle.
 * When a peer disconnects, we mark them 'reconnecting' and set a 60s grace timer.
 * On rejoin, the timer is cancelled. On expiry, they are removed from the lobby.
 */
const _reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Grace period before a disconnected player is removed (ms). */
const RECONNECT_GRACE_MS = 60_000;

/**
 * BUG17: Interval handle for the Steam peer-left poll.
 * While in a Steam lobby, polls steam_get_pending_peer_left every 1 s and
 * synthesises a local mp:lobby:leave event when a peer ungracefully exits.
 * Cleared in leaveLobby() via _activeHandlerCleanups.
 */
let _peerLeftPollInterval: ReturnType<typeof setInterval> | null = null;

/** Get the current lobby state (null if not in a lobby) */
export function getCurrentLobby(): LobbyState | null { return _currentLobby; }

/** Check if local player is the host */
export function isHost(): boolean {
  return _currentLobby?.hostId === _localPlayerId;
}

/**
 * Return the local player ID for the current session.
 * Empty string when not in a lobby.
 * Used by gameFlowController to pass the correct ID to initRaceMode (#79).
 */
export function getLocalMultiplayerPlayerId(): string {
  return _localPlayerId;
}

// ── Password Hashing ──────────────────────────────────────────────────────────

/**
 * Hash a plaintext password with SHA-256 via the Web Crypto API.
 * Returns the lower-case hex-encoded digest.
 *
 * Used client-side so the plaintext never leaves the browser. The hash is
 * sent to backends (Fastify stores it, Steam writes it to lobby metadata).
 * This is a UX gate, not a cryptographic auth boundary — Steam metadata is
 * readable by any Steam client. See gotchas.md.
 */
async function hashPassword(plaintext: string): Promise<string> {
  const enc = new TextEncoder().encode(plaintext);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Read a Steam lobby's authoritative metadata (mode, visibility, title,
 * hostName, lobbyCode, maxPlayers) for populating `_currentLobby` on the guest
 * side right after join. Replaces the hard-coded `mode: 'race'` placeholder
 * that used to persist until a `mp:lobby:settings` broadcast arrived — which
 * in practice rarely happened because P2P was broken.
 *
 * Returns null for any field that Steam hasn't cached yet; callers fall back
 * to their original placeholder for missing fields.
 */
async function readSteamLobbyMetadataForJoin(lobbyId: string): Promise<{
  mode: MultiplayerMode | null;
  visibility: LobbyVisibility | null;
  title: string | null;
  hostName: string | null;
  lobbyCode: string | null;
  maxPlayers: number | null;
}> {
  try {
    const [mode, visibility, title, hostName, lobbyCode, maxPlayersStr] = await Promise.all([
      getLobbyData(lobbyId, 'mode'),
      getLobbyData(lobbyId, 'visibility'),
      getLobbyData(lobbyId, 'title'),
      getLobbyData(lobbyId, 'host_name'),
      getLobbyData(lobbyId, 'lobby_code'),
      getLobbyData(lobbyId, 'max_players'),
    ]);
    const parsedMax = maxPlayersStr ? Number(maxPlayersStr) : NaN;
    return {
      mode: mode ? (mode as MultiplayerMode) : null,
      visibility: visibility ? (visibility as LobbyVisibility) : null,
      title: title || null,
      hostName: hostName || null,
      lobbyCode: lobbyCode || null,
      maxPlayers: Number.isFinite(parsedMax) ? parsedMax : null,
    };
  } catch (e) {
    console.warn('[multiplayerLobbyService] readSteamLobbyMetadataForJoin failed:', e);
    return { mode: null, visibility: null, title: null, hostName: null, lobbyCode: null, maxPlayers: null };
  }
}

/**
 * Resolve the remote peer's 64-bit Steam ID for the Steam P2P transport.
 *
 * For a guest who just joined a lobby: returns the lobby owner (host) via
 * `getLobbyOwner`, which reads Steam's local cache synchronously. This is
 * reliable immediately after join. If the local user IS the owner, falls back
 * to filtering the member list (host side). Returns `null` if no remote peer
 * is in the lobby yet (e.g., host just created it, no guests).
 *
 * Background: Steam P2P (SteamNetworkingMessages) addresses peers by their
 * individual SteamID, NOT by lobby ID. Passing the lobby ID to
 * `AcceptSessionWithUser` / `SendMessageToUser` returns ConnectFailed forever
 * because the lobby is a chat room, not an endpoint.
 */
async function resolveSteamPeerId(lobbyId: string): Promise<string | null> {
  try {
    const [localId, owner] = await Promise.all([
      getLocalSteamId(),
      getLobbyOwner(lobbyId),
    ]);
    rrLog('mp:peer', 'resolveSteamPeerId try', { lobbyId, localId, owner });
    if (!localId) return null;
    // Owner is reliable when the local user is the guest.
    if (owner && owner !== localId) return owner;
    // Local user IS the owner — fall back to member filter for the guest.
    const members = await getLobbyMembers(lobbyId);
    rrLog('mp:peer', 'resolveSteamPeerId member filter', { memberCount: members.length, members: members.map(m => m.steamId) });
    const peer = members.find(m => m.steamId !== localId);
    return peer?.steamId ?? null;
  } catch (e) {
    rrLog('mp:peer', 'resolveSteamPeerId failed', { e: String(e) });
    return null;
  }
}

/**
 * Retry `resolveSteamPeerId` until it returns a peer or the attempt budget is
 * exhausted. Handles Steam's lobby-member-list sync lag — immediately after a
 * guest joins a lobby, the local cache may not yet include the host for a few
 * hundred ms. Retrying every 500 ms up to 5× gives Steam time to populate the
 * list without forcing the caller to wait the full budget when the first try
 * already succeeds.
 */
async function resolveSteamPeerIdWithRetry(lobbyId: string, attempts = 10, intervalMs = 500): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const peer = await resolveSteamPeerId(lobbyId);
    if (peer) {
      rrLog('mp:peer', 'resolveSteamPeerIdWithRetry succeeded', { attempt: i + 1, peer });
      return peer;
    }
    if (i < attempts - 1) {
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
  rrLog('mp:peer', 'resolveSteamPeerIdWithRetry exhausted', { lobbyId, attempts });
  return null;
}

/**
 * Poll the lobby's member list every 2s looking for a remote peer to connect to.
 *
 * Used on the host side after `createLobby` since no peer exists at creation
 * time. When the first remote member appears, `onFound` fires once with their
 * Steam ID and the poll stops.
 *
 * Returns a cancellation function — call it from `leaveLobby` to stop polling
 * if the host leaves before anyone joins.
 */
function startSteamHostPeerPoll(
  lobbyId: string,
  onFound: (peerSteamId: string) => void,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tickCount = 0;
  const tick = async (): Promise<void> => {
    if (cancelled) return;
    tickCount++;
    const peer = await resolveSteamPeerId(lobbyId);
    if (cancelled) return;
    if (peer) {
      rrLog('mp:hostpoll', 'peer detected', { tick: tickCount, peer, lobbyId });
      onFound(peer);
      return; // one-shot
    }
    if (tickCount % 10 === 0) {
      rrLog('mp:hostpoll', 'still waiting', { tick: tickCount, lobbyId });
    }
    timer = setTimeout(() => void tick(), 300);
  };
  rrLog('mp:hostpoll', 'started', { lobbyId });
  timer = setTimeout(() => void tick(), 300);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    rrLog('mp:hostpoll', 'cancelled', { lobbyId, tickCount });
  };
}

// ── Lobby Lifecycle ──────────────────────────────────────────────────────────

/**
 * Create a new lobby as host.
 *
 * Now async — delegates to the active backend (Steam / Fastify / BroadcastChannel)
 * for ID generation and registration. Returns the initialised LobbyState.
 *
 * @param playerId     Host's player ID.
 * @param displayName  Host's display name.
 * @param mode         Game mode (race, duel, coop, trivia_night, same_cards).
 * @param opts         Optional overrides: visibility, password (hashed before forwarding),
 *                     maxPlayers (clamped to mode bounds).
 */
export async function createLobby(
  playerId: string,
  displayName: string,
  mode: MultiplayerMode,
  opts?: { visibility?: LobbyVisibility; password?: string; maxPlayers?: number; title?: string },
): Promise<LobbyState> {
  rrLog('mp:createLobby', 'entry', { playerId, displayName, mode, opts: { visibility: opts?.visibility, maxPlayers: opts?.maxPlayers, title: opts?.title } });
  // BUG-058 regression guard: 'local_player' is the legacy default that must NEVER
  // reach the lobby. The caller (CardApp) must resolve a real Steam ID or generated
  // player_xxx ID before calling createLobby.
  if (playerId === 'local_player' || !playerId) {
    throw new Error("[createLobby] Refusing to create lobby with placeholder playerId='local_player' — caller must resolve a real player ID first.");
  }
  _localPlayerId = playerId;

  // M16: Reset password hash before any mutation to prevent cross-session leaks.
  _passwordHash = null;

  const visibility: LobbyVisibility = opts?.visibility ?? 'public';
  const maxPlayers = opts?.maxPlayers
    ? Math.max(MODE_MIN_PLAYERS[mode], Math.min(MODE_MAX_PLAYERS[mode], opts.maxPlayers))
    : MODE_MAX_PLAYERS[mode];

  _passwordHash = opts?.password ? await hashPassword(opts.password) : null;

  // C1: Sanitize title at client time; backend also sanitizes server-side.
  const sanitizedTitle = opts?.title ? sanitizeLobbyTitle(opts.title) : undefined;

  const backend = pickBackend();
  const result = await backend.createLobby({
    hostId: playerId,
    hostName: displayName,
    mode,
    visibility,
    passwordHash: _passwordHash ?? undefined,
    maxPlayers,
    title: sanitizedTitle || undefined,
  });

  _currentLobby = {
    lobbyId: result.lobbyId,
    hostId: playerId,
    mode,
    deckSelectionMode: 'host_picks',
    houseRules: { ...DEFAULT_HOUSE_RULES },
    players: [{
      id: playerId,
      displayName,
      isHost: true,
      isReady: false,
      multiplayerRating: getLocalMultiplayerRating(),
    }],
    maxPlayers,
    isRanked: false,
    lobbyCode: result.lobbyCode,
    status: 'waiting',
    visibility,
    title: sanitizedTitle || undefined,
  };

  // Use BroadcastChannel transport when ?mp param is present (two-tab dev testing),
  // otherwise fall back to the default platform transport (Steam P2P or WebSocket).
  const broadcast = isBroadcastMode();
  const transport = getMultiplayerTransport(broadcast ? 'broadcast' : 'auto');
  const connectOpts: ConnectOpts | undefined = result.joinToken
    ? { lobbyId: result.lobbyId, joinToken: result.joinToken }
    : undefined;

  // Steam P2P addresses peers by individual SteamID — the host has no remote
  // peer at creation time, so defer transport.connect and start a poll that
  // waits for someone to join. Non-Steam transports (broadcast / web) address
  // by lobby ID / code and can connect immediately.
  const useSteamHostDefer = isTauriPresent() && !broadcast && !isLanMode();
  if (useSteamHostDefer) {
    console.log('[multiplayerLobbyService] host waiting for Steam peer to join lobby', result.lobbyId);
    _steamHostPeerPollCancel = startSteamHostPeerPoll(result.lobbyId, (peerSteamId) => {
      console.log('[multiplayerLobbyService] host connecting transport to peer', peerSteamId);
      transport.connect(peerSteamId, playerId, connectOpts);
      _steamHostPeerPollCancel = null;
    });
  } else {
    transport.connect(
      broadcast ? (result.lobbyCode ?? result.lobbyId) : result.lobbyId,
      playerId,
      connectOpts,
    );
  }
  // #76: Start peer presence monitor after transport is connected.
  _peerMonitorTeardown = initPeerPresenceMonitor(
    playerId,
    () => (_currentLobby?.players ?? []).filter(p => p.id !== playerId).map(p => p.id),
    transport,
  );
  setupMessageHandlers();

  // Prime P2P sessions with all lobby members. On host creation this is benign
  // (count=0, no peers yet). After a guest joins our lobby, the priming ensures
  // the host's session_request_callback fires for the guest without delay.
  if (isTauriPresent() && !isBroadcastMode() && !isLanMode() && result.lobbyId) {
    primeP2PSessions(result.lobbyId).then((count) => {
      rrLog('mp:lobby', 'primeP2PSessions (createLobby)', { lobbyId: result.lobbyId, count });
    }).catch((e) => {
      rrLog('mp:lobby', 'primeP2PSessions error (createLobby)', { e: String(e) });
    });
  }

  // #036: Start the periodic full-roster reconciliation heartbeat. Host only —
  // re-broadcasts the full settings snapshot every 5s so guest rosters can recover
  // from drift caused by lost messages or partial merges.
  startRosterReconciliation();

  // BUG12: Set Rich Presence so friends can click "Join Game" from the Steam friends list.
  // The 'connect' key value must begin with '+connect_lobby ' — Steam maps this to
  // the steam://joinlobby URL handler that triggers a join when a friend clicks the button.
  // Fire-and-forget — failure must not block the caller.
  if (isTauriPresent() && !isBroadcastMode() && !isLanMode() && result.lobbyId) {
    void setRichPresence('connect', `+connect_lobby ${result.lobbyId}`).catch((e) => {
      console.warn('[MP:LobbyService] setRichPresence failed (non-fatal):', e);
    });
  }

  return _currentLobby;
}

/**
 * Join an existing lobby by its 6-character invite code.
 * Returns a placeholder LobbyState that will be overwritten when the host
 * broadcasts the real lobby state via mp:lobby:settings.
 *
 * @param lobbyCode    6-character join code.
 * @param playerId     Joining player's ID.
 * @param displayName  Joining player's display name.
 * @param password     Optional plaintext password (hashed client-side before forwarding).
 */
export async function joinLobby(
  lobbyCode: string,
  playerId: string,
  displayName: string,
  password?: string,
): Promise<LobbyState> {
  rrLog('mp:joinCode', 'entry', { lobbyCode, playerId, displayName, hasPw: !!password });
  // BUG-058 regression guard: 'local_player' is the legacy default that must NEVER
  // reach the lobby — both peers would treat each other's senderId as self and drop
  // every message. The caller (CardApp) must resolve a real Steam ID or generated
  // player_xxx ID before calling joinLobby.
  if (playerId === 'local_player' || !playerId) {
    throw new Error("[joinLobby] Refusing to join with placeholder playerId='local_player' — caller must resolve a real player ID first.");
  }
  _localPlayerId = playerId;

  // M16: Reset password hash before any mutation to prevent cross-session leaks.
  _passwordHash = null;

  const passwordHash = password ? await hashPassword(password) : undefined;
  const backend = pickBackend();

  // Resolve the code to a backend lobbyId.
  // BroadcastChannel mode returns null intentionally — the code IS the channel key.
  // All other backends (Steam, web) return null for unknown/expired codes, which
  // must be treated as a hard error: proceeding with an empty lobbyId connects the
  // player to a ghost lobby (empty channel with no host).
  const resolvedId = await backend.resolveByCode(lobbyCode);

  if (resolvedId === null && !isBroadcastMode()) {
    throw new Error('Lobby not found. Check the code and try again.');
  }

  // A2: For non-broadcast paths, joinLobbyById must succeed before we set _currentLobby.
  // Previously _currentLobby was set before the join (ghost lobby bug): any backend failure
  // left the player in a placeholder race lobby with no real host. Now we let the error
  // propagate — CardApp.svelte's catch block sets multiplayerError for the user to see.
  const broadcast = isBroadcastMode();
  const transport = getMultiplayerTransport(broadcast ? 'broadcast' : 'auto');

  // For broadcast mode resolvedId is null — the lobbyCode IS the channel key.
  // For steam/web, resolvedId is the real backend lobby ID and the join must succeed.
  const joinTargetId = resolvedId ?? lobbyCode;
  const result = await backend.joinLobbyById(joinTargetId, playerId, displayName, passwordHash);

  // Read authoritative lobby metadata from Steam — avoids placeholder `race`
  // mode persisting until a P2P broadcast arrives (which may never succeed).
  const useSteamMeta = isTauriPresent() && !broadcast && !isLanMode() && !!result.lobbyId;
  const meta = useSteamMeta
    ? await readSteamLobbyMetadataForJoin(result.lobbyId)
    : { mode: null, visibility: null, title: null, hostName: null, lobbyCode: null, maxPlayers: null };

  // A2: _currentLobby is assigned AFTER backend join confirmed — never before.
  // #025 (identity model): we no longer prepopulate a 'steam:<id>' placeholder host
  // entry. The placeholder ID format never matched the host's real player_xxx ID
  // returned by mp:lobby:settings, breaking the peer-left poll matcher and the kick
  // signature check. We now leave hostId empty until first mp:lobby:settings arrives,
  // and rely on that broadcast (within ~150ms on Steam P2P) to bootstrap the roster.
  const hostPlaceholderPlayers: LobbyPlayer[] = [
    { id: playerId, displayName, isHost: false, isReady: false, multiplayerRating: getLocalMultiplayerRating() },
  ];
  _currentLobby = {
    lobbyId: result.lobbyId || resolvedId || '',
    hostId: '',
    mode: meta.mode ?? 'race',
    deckSelectionMode: 'host_picks',
    houseRules: { ...DEFAULT_HOUSE_RULES },
    players: hostPlaceholderPlayers,
    maxPlayers: meta.maxPlayers ?? 4,
    isRanked: false,
    lobbyCode: meta.lobbyCode ?? result.lobbyCode ?? lobbyCode,
    status: 'waiting',
    visibility: meta.visibility ?? 'public',
    title: meta.title ?? undefined,
  };

  const connectOpts: ConnectOpts | undefined = result.joinToken
    ? { lobbyId: _currentLobby.lobbyId, joinToken: result.joinToken }
    : undefined;

  // For Steam P2P, the transport needs the HOST's Steam ID — NOT the lobby ID.
  // Read the lobby's member list (which now includes us + the host) and filter
  // self out. On non-Steam transports, fall back to lobby ID / code as before.
  const useSteamPeer = isTauriPresent() && !broadcast && !isLanMode() && _currentLobby.lobbyId;
  const steamPeerId = useSteamPeer ? await resolveSteamPeerIdWithRetry(_currentLobby.lobbyId) : null;
  // Post-audit fix #4: when useSteamPeer is true AND resolve exhausts, FAIL the
  // join loudly rather than silently using lobbyId as the P2P peer target (that
  // produces a non-existent-peer ConnectFailed loop that's invisible to the
  // user). Non-Steam modes fall through to the old broadcast/lobby-ID path.
  if (useSteamPeer && !steamPeerId) {
    _currentLobby = null;
    throw new Error(
      'Could not resolve host Steam ID from the lobby. This usually means your Steam client lost connection to the lobby mid-join. Please try again.',
    );
  }
  const transportTarget = steamPeerId
    ?? (broadcast ? lobbyCode : (_currentLobby.lobbyId || lobbyCode));
  transport.connect(transportTarget, playerId, connectOpts);
  // Post-audit fix #2: include multiplayerRating so host's copy of the player
  // matches guest's real rating (default 1000 placeholder in the host handler
  // was overwriting guest's real rating on the subsequent broadcast round-trip).
  transport.send('mp:lobby:join', { playerId, displayName, lobbyCode, multiplayerRating: getLocalMultiplayerRating() });
  // #76: Start peer presence monitor after transport is connected.
  _peerMonitorTeardown = initPeerPresenceMonitor(
    playerId,
    () => (_currentLobby?.players ?? []).filter(p => p.id !== playerId).map(p => p.id),
    transport,
  );
  setupMessageHandlers();

  // Prime P2P sessions on guest join — ensures the host's session_request_callback
  // fires for us and we open an outbound session toward the host simultaneously.
  if (useSteamPeer && _currentLobby.lobbyId) {
    primeP2PSessions(_currentLobby.lobbyId).then((count) => {
      rrLog('mp:lobby', 'primeP2PSessions (joinLobby by code)', { lobbyId: _currentLobby!.lobbyId, count });
    }).catch((e) => {
      rrLog('mp:lobby', 'primeP2PSessions error (joinLobby by code)', { e: String(e) });
    });
  }

  return _currentLobby;
}

/**
 * Join an existing lobby directly by its backend lobby ID.
 * Used by the lobby browser screen — bypasses the code-resolution step.
 *
 * @param lobbyId      Backend-assigned lobby ID (from LobbyBrowserEntry.lobbyId).
 * @param playerId     Joining player's ID.
 * @param displayName  Joining player's display name.
 * @param password     Optional plaintext password (hashed client-side before forwarding).
 */
export async function joinLobbyById(
  lobbyId: string,
  playerId: string,
  displayName: string,
  password?: string,
): Promise<LobbyState> {
  rrLog('mp:joinById', 'entry', { lobbyId, playerId, displayName, hasPw: !!password });
  // BUG-058 regression guard — see joinLobby for rationale.
  if (playerId === 'local_player' || !playerId) {
    throw new Error("[joinLobbyById] Refusing to join with placeholder playerId='local_player' — caller must resolve a real player ID first.");
  }
  _localPlayerId = playerId;

  // M16: Reset password hash before any mutation to prevent cross-session leaks.
  _passwordHash = null;

  const passwordHash = password ? await hashPassword(password) : undefined;
  const backend = pickBackend();
  const result = await backend.joinLobbyById(lobbyId, playerId, displayName, passwordHash);

  const broadcast = isBroadcastMode();
  // Read authoritative lobby metadata from Steam before setting _currentLobby —
  // this ensures the guest shows the host's real mode/visibility/title, not
  // the old `race` placeholder that used to persist when P2P broadcasts failed.
  const useSteamPeer = isTauriPresent() && !broadcast && !isLanMode();
  const meta = useSteamPeer
    ? await readSteamLobbyMetadataForJoin(result.lobbyId)
    : { mode: null, visibility: null, title: null, hostName: null, lobbyCode: null, maxPlayers: null };

  // #025 (identity model): no more 'steam:<id>' placeholder host entry — see
  // joinLobby for rationale. hostId is empty until first mp:lobby:settings broadcast.
  const hostPlaceholderPlayersById: LobbyPlayer[] = [
    { id: playerId, displayName, isHost: false, isReady: false, multiplayerRating: getLocalMultiplayerRating() },
  ];
  _currentLobby = {
    lobbyId: result.lobbyId,
    hostId: '',
    mode: meta.mode ?? 'race',
    deckSelectionMode: 'host_picks',
    houseRules: { ...DEFAULT_HOUSE_RULES },
    players: hostPlaceholderPlayersById,
    maxPlayers: meta.maxPlayers ?? 4,
    isRanked: false,
    lobbyCode: meta.lobbyCode ?? result.lobbyCode,
    status: 'waiting',
    visibility: meta.visibility ?? 'public',
    title: meta.title ?? undefined,
  };

  const transport = getMultiplayerTransport(broadcast ? 'broadcast' : 'auto');
  const connectOpts: ConnectOpts | undefined = result.joinToken
    ? { lobbyId: result.lobbyId, joinToken: result.joinToken }
    : undefined;

  // Steam P2P needs the HOST's Steam ID as the peer — not the lobby ID.
  // getLobbyOwner is the reliable path: synchronous local-cache read.
  const steamPeerId = useSteamPeer ? await resolveSteamPeerIdWithRetry(result.lobbyId) : null;
  // Post-audit fix #4: same hard-fail as joinLobby — silent lobby-ID fallback
  // masks a real failure and produces a confusing ConnectFailed loop.
  if (useSteamPeer && !steamPeerId) {
    _currentLobby = null;
    throw new Error(
      'Could not resolve host Steam ID from the lobby. This usually means your Steam client lost connection to the lobby mid-join. Please try again.',
    );
  }
  const transportTarget = steamPeerId
    ?? (broadcast ? (result.lobbyCode ?? result.lobbyId) : result.lobbyId);
  transport.connect(transportTarget, playerId, connectOpts);
  // Post-audit fix #2: carry the guest's real multiplayerRating.
  transport.send('mp:lobby:join', { playerId, displayName, multiplayerRating: getLocalMultiplayerRating() });
  // #76: Start peer presence monitor after transport is connected.
  _peerMonitorTeardown = initPeerPresenceMonitor(
    playerId,
    () => (_currentLobby?.players ?? []).filter(p => p.id !== playerId).map(p => p.id),
    transport,
  );
  setupMessageHandlers();

  // Prime P2P sessions on guest join (by lobby ID) — symmetric with joinLobby.
  if (useSteamPeer && result.lobbyId) {
    primeP2PSessions(result.lobbyId).then((count) => {
      rrLog('mp:lobby', 'primeP2PSessions (joinLobbyById)', { lobbyId: result.lobbyId, count });
    }).catch((e) => {
      rrLog('mp:lobby', 'primeP2PSessions error (joinLobbyById)', { e: String(e) });
    });
  }

  return _currentLobby;
}

/** Leave the current lobby and clean up all related state. */
export function leaveLobby(): void {
  if (!_currentLobby) return;
  // Send leave message — wrapped in try/catch because the transport may already
  // be disconnected (server dropped the connection) and send() would throw,
  // preventing the cleanup below from running.
  try {
    const transport = getMultiplayerTransport();
    transport.send('mp:lobby:leave', { playerId: _localPlayerId });
  } catch (err) {
    console.warn('[MP:LobbyService] leaveLobby send failed (transport may be disconnected):', err);
  }
  try {
    destroyMultiplayerTransport();
  } catch (err) {
    console.warn('[MP:LobbyService] destroyMultiplayerTransport failed:', err);
  }

  // Always clean up local state regardless of transport errors
  if (_broadcastHeartbeat !== null) {
    clearInterval(_broadcastHeartbeat);
    _broadcastHeartbeat = null;
  }

  // B2: When the host leaves in broadcast mode, immediately delete our lobby's
  // directory entry from localStorage. Without this, the entry persists for up to
  // BC_ENTRY_TTL_MS (15s) after the host leaves — other tabs see a ghost lobby.
  // Only the host owns the entry (non-hosts never write to the directory), so we
  // only delete when we are the host.
  const leavingLobbyId = _currentLobby?.lobbyId;
  const leavingAsHost = _currentLobby?.hostId === _localPlayerId;
  if (leavingLobbyId && leavingAsHost && isBroadcastMode()) {
    try {
      const existing = readBroadcastDirectory().filter(e => e.lobbyId !== leavingLobbyId);
      writeBroadcastDirectory(existing);
    } catch {
      // Non-fatal — entry will expire via TTL
    }
  }

  // A4: When the host leaves a Steam lobby, clear key metadata fields so the entry
  // doesn't round-trip in other clients' next listPublicLobbies request.
  // Fire-and-forget — we don't await because leaveLobby is synchronous and the IPC
  // call completes in milliseconds even if the result is discarded.
  if (leavingLobbyId && leavingAsHost) {
    // Calling setLobbyData with empty values tells other Steam clients the slot is gone.
    // The lobby itself is left via steam_force_leave_active_lobby on app exit or via
    // leaveSteamLobby here. Both paths are best-effort.
    void leaveSteamLobby(leavingLobbyId).catch(() => {}); // explicit Steam API leave
    void setLobbyData(leavingLobbyId, 'lobby_code', '').catch(() => {});
    void setLobbyData(leavingLobbyId, 'mode', '').catch(() => {});
  }

  // B3: Explicitly call steam_force_leave_active_lobby so Steam matchmaking
  // removes us immediately — not just on app exit. This ensures mid-session
  // leaves are visible to other players browsing the lobby list.
  // Fire-and-forget (leaveLobby is synchronous); non-fatal if Steam is unavailable.
  if (isTauriPresent()) {
    import('./steamNetworkingService').then(({ invokeSteam }) => {
      void invokeSteam('steam_force_leave_active_lobby').catch((err: unknown) => {
        console.warn('[MP:LobbyService] steam_force_leave_active_lobby failed:', err);
      });
    }).catch(() => {});
  }

  // BUG12: Clear Rich Presence so the Steam friends list no longer shows a
  // "Join Game" button for this lobby. Fire-and-forget.
  if (isTauriPresent()) {
    void clearRichPresence().catch((e) => {
      console.warn('[MP:LobbyService] clearRichPresence failed (non-fatal):', e);
    });
  }

  // Clean up H5 seed-ACK timers
  _cancelStartAckHandshake();

  // Clean up H10 reconnect timers
  for (const timer of _reconnectTimers.values()) clearTimeout(timer);
  _reconnectTimers.clear();

  _currentLobby = null;
  _passwordHash = null;
  // #76: Stop peer presence monitor.
  if (_peerMonitorTeardown !== null) {
    _peerMonitorTeardown();
    _peerMonitorTeardown = null;
  }
  // Stop Steam host peer-detection poll if we leave before a peer connects.
  if (_steamHostPeerPollCancel !== null) {
    _steamHostPeerPollCancel();
    _steamHostPeerPollCancel = null;
  }

  // BUG16: Tear down all per-lobby transport listeners so the next join doesn't
  // accumulate duplicate handlers on the singleton transport instance.
  for (const fn of _activeHandlerCleanups) fn();
  _activeHandlerCleanups = [];
  _handlersAttached = false;
  _handlersAttachedTransport = null; // #067: clear per-transport guard
  _localReadyVersion = 0;
  _settingsSeq = 0;
  _lastSettingsSeqSeen = 0;
  _stopRosterReconciliation(); // #036
  // BUG23: do NOT clear subscriber sets here — they are registered by CardApp
  // on mount for the whole app lifetime and must survive leave/rejoin cycles.
}

// ── Lobby Settings (host only) ───────────────────────────────────────────────

/** Update lobby mode (host only) */
export function setMode(mode: MultiplayerMode): void {
  if (!_currentLobby || !isHost()) return;
  _currentLobby.mode = mode;
  _currentLobby.maxPlayers = MODE_MAX_PLAYERS[mode];
  broadcastSettings();
}

/** Update deck selection mode (host only) */
export function setDeckSelectionMode(mode: DeckSelectionMode): void {
  if (!_currentLobby || !isHost()) return;
  const prevMode = _currentLobby.deckSelectionMode;
  _currentLobby.deckSelectionMode = mode;
  // #066: Clear the abandoned variant so stale data from the prior mode never
  // carries into the start payload. Switching host_picks -> each_picks clears
  // the lobby-level contentSelection; switching the other way clears each
  // player's per-player contentSelection.
  if (prevMode !== mode) {
    if (mode === 'each_picks') {
      _currentLobby.contentSelection = undefined;
      _currentLobby.selectedDeckId = undefined;
    } else if (mode === 'host_picks') {
      for (const p of _currentLobby.players) {
        p.contentSelection = undefined;
        p.selectedDeckId = undefined;
      }
    }
    rrLog('mp:deck', 'setDeckSelectionMode cleared abandoned variant', { from: prevMode, to: mode });
  }
  broadcastSettings();
}

/** Set the selected deck (host picks or individual) */
export function selectDeck(deckId: string): void {
  if (!_currentLobby) return;
  if (_currentLobby.deckSelectionMode === 'host_picks' && isHost()) {
    _currentLobby.selectedDeckId = deckId;
    broadcastSettings();
  } else if (_currentLobby.deckSelectionMode === 'each_picks') {
    const player = _currentLobby.players.find(p => p.id === _localPlayerId);
    if (player) {
      player.selectedDeckId = deckId;
      broadcastSettings();
    }
  }
}

/** Set the content selection for the lobby (replaces selectDeck for rich content types) */
export function setContentSelection(selection: LobbyContentSelection): void {
  // Capture the full payload — an empty study-multi (no decks, no domains)
  // was rendering as the literal string "No content" in the UI, which the
  // player was reading as "deck selection doesn't work" when in fact the
  // selection was arriving empty. Logging the full shape here disambiguates.
  let payloadSummary: Record<string, unknown> = { type: selection.type };
  if (selection.type === 'study-multi') {
    payloadSummary = {
      type: 'study-multi',
      deckCount: selection.decks.length,
      domainCount: selection.triviaDomains.length,
    };
  } else if (selection.type === 'study') {
    payloadSummary = { type: 'study', deckId: selection.deckId, deckName: selection.deckName };
  } else if (selection.type === 'custom_deck') {
    payloadSummary = { type: 'custom_deck', customDeckId: selection.customDeckId, deckName: selection.deckName };
  }
  rrLog('mp:deck', 'setContentSelection called', {
    payload: payloadSummary,
    hasLobby: !!_currentLobby,
    deckSelectionMode: _currentLobby?.deckSelectionMode,
    hostId: _currentLobby?.hostId,
    localPlayerId: _localPlayerId,
    isHostResult: isHost(),
  });
  if (!_currentLobby) {
    rrLog('mp:deck', 'setContentSelection aborted — no lobby');
    return;
  }
  if (_currentLobby.deckSelectionMode === 'host_picks' && isHost()) {
    // Forensic: log pre-state before mutation so we can detect clobbering in debug.log
    rrLog('mp:deck', 'setContentSelection PRE-state (host_picks)', {
      prev: _currentLobby.contentSelection ?? null,
    });
    _currentLobby.contentSelection = selection;
    // Also set legacy selectedDeckId for backwards compat
    _currentLobby.selectedDeckId = selection.type === 'study' ? selection.deckId : selection.type === 'custom_deck' ? selection.customDeckId : undefined;
    // Forensic: log post-state after mutation and BEFORE broadcast — proves whether
    // a subsequent event clobbers the value (race condition detection).
    rrLog('mp:deck', 'setContentSelection POST-state (host_picks)', {
      current: _currentLobby.contentSelection,
    });
    rrLog('mp:deck', 'host_picks path — mutation applied, broadcasting');
    broadcastSettings();
  } else if (_currentLobby.deckSelectionMode === 'each_picks') {
    const player = _currentLobby.players.find(p => p.id === _localPlayerId);
    if (player) {
      player.contentSelection = selection;
      player.selectedDeckId = selection.type === 'study' ? selection.deckId : selection.type === 'custom_deck' ? selection.customDeckId : undefined;
      rrLog('mp:deck', 'each_picks path — player mutation applied, broadcasting');
      broadcastSettings();
    } else {
      rrLog('mp:deck', 'each_picks — no matching player found', { _localPlayerId });
    }
  } else {
    rrLog('mp:deck', 'setContentSelection no-op — not host_picks+host, not each_picks');
  }
}

/**
 * Derive whether a lobby is password-protected from its visibility field.
 * Replaces the removed denormalized `hasPassword` field on LobbyState.
 * Use this everywhere a boolean password check is needed.
 */
export function lobbyHasPassword(lobby: { visibility: string }): boolean {
  return lobby.visibility === 'password';
}

/** Update house rules (host only) */
export function setHouseRules(rules: Partial<HouseRules>): void {
  if (!_currentLobby || !isHost()) return;
  _currentLobby.houseRules = { ..._currentLobby.houseRules, ...rules };
  broadcastSettings();
}

/** Toggle ranked mode (host only) */
export function setRanked(ranked: boolean): void {
  if (!_currentLobby || !isHost()) return;
  _currentLobby.isRanked = ranked;
  broadcastSettings();
}

/**
 * Set lobby visibility (host only).
 * Updates lobby visibility (visibility is the single source of truth; hasPassword field removed).
 * Clearing to 'public' or 'friends_only' also clears the stored password hash.
 *
 * @param visibility  New visibility level.
 */
export function setVisibility(visibility: LobbyVisibility): void {
  if (!_currentLobby || !isHost()) return;
  _currentLobby.visibility = visibility;
  if (visibility !== 'password') _passwordHash = null;
  broadcastSettings();
}

/**
 * Set or clear the lobby password (host only).
 * Hashes the plaintext client-side via SHA-256. The hash is stored in
 * _passwordHash (module-level, never in LobbyState) and used by backend calls.
 * Passing null clears the password and resets visibility to 'public' if it was 'password'.
 *
 * @param password  Plaintext password, or null to remove.
 */
export async function setPassword(password: string | null): Promise<void> {
  if (!_currentLobby || !isHost()) return;
  if (password === null) {
    _passwordHash = null;
    if (_currentLobby.visibility === 'password') {
      _currentLobby.visibility = 'public';
    }
  } else {
    _passwordHash = await hashPassword(password);
    _currentLobby.visibility = 'password';
  }
  broadcastSettings();
}

/**
 * Set the max players cap for this lobby (host only).
 * Clamped to [MODE_MIN_PLAYERS[mode], MODE_MAX_PLAYERS[mode]].
 * Duel and coop are always 2 — the clamp makes this a no-op for those modes.
 *
 * @param n  Desired player cap.
 */
export function setMaxPlayers(n: number): void {
  if (!_currentLobby || !isHost()) return;
  const mode = _currentLobby.mode;
  _currentLobby.maxPlayers = Math.max(MODE_MIN_PLAYERS[mode], Math.min(MODE_MAX_PLAYERS[mode], n));
  broadcastSettings();
}

/**
 * List public lobbies from the active backend.
 * Delegates to steamBackend (Steam builds), webBackend (Fastify), or
 * broadcastBackend (two-tab dev mode, ?mp URL param).
 * friends_only lobbies are filtered out on web/broadcast (no friends graph).
 *
 * @param filter  Optional filter by mode and/or fullness.
 */
export async function listPublicLobbies(filter?: LobbyListFilter): Promise<LobbyBrowserEntry[]> {
  return pickBackend().listPublicLobbies(filter);
}

// ── Local Bot (dev-only) ────────────────────────────────────────────────────

/**
 * Add a local bot player to the current lobby for same-machine testing.
 * Creates a linked local transport pair so messages flow between host and bot.
 * The bot auto-readies after a short delay.
 * Dev-only — does not use networking.
 */
export function addLocalBot(botName: string = 'Bot Player'): void {
  if (!_currentLobby || !isHost()) return;

  // Create linked transport pair — host side drives the host transport, bot side
  // is stored module-level so it isn't garbage-collected.
  const [hostSide, botSide] = createLocalTransportPair();
  _botTransport = botSide;

  // The bot "connects" on its side — instantly connected (no networking)
  const botId = `bot_${Date.now().toString(36)}`;
  hostSide.connect('', _localPlayerId);
  botSide.connect('', botId);

  // Add bot to lobby directly (since we're the host and this is local)
  _currentLobby.players.push({
    id: botId,
    displayName: botName,
    isHost: false,
    isReady: false,
  });
  notifyLobbyUpdate();

  // Auto-ready the bot after a brief delay
  setTimeout(() => {
    if (!_currentLobby) return;
    const bot = _currentLobby.players.find(p => p.id === botId);
    if (bot) {
      bot.isReady = true;
      notifyLobbyUpdate();
    }
  }, 500);
}

/** Remove the local bot from the lobby (cleans up transport reference). */
export function removeLocalBot(): void {
  if (!_currentLobby) return;
  _currentLobby.players = _currentLobby.players.filter(p => !p.id.startsWith('bot_'));
  if (_botTransport) {
    _botTransport.disconnect();
    _botTransport = null;
  }
  notifyLobbyUpdate();
}

// ── L4: Host Moderation ───────────────────────────────────────────────────────

/**
 * Kick a player from the lobby (host only).
 *
 * Broadcasts `mp:lobby:kick` to all peers with the target's ID and an optional
 * reason. Removes the player from local lobby state immediately so the host's
 * view updates without waiting for the target to acknowledge.
 *
 * Security model:
 *  - Only the host may call this function — throws if the local player is not host.
 *  - Receivers verify `issuedBy === host_player_id` before acting (see message
 *    handler in `setupMessageHandlers()`).
 *  - The host can never kick themselves — throws if `targetPlayerId === _localPlayerId`.
 *
 * UI is post-MVP. See docs/mechanics/multiplayer.md "Host Moderation".
 *
 * @param targetPlayerId - Player ID (Steam ID / UUID) of the player to remove.
 * @param reason         - Optional human-readable reason (displayed to kicked player).
 * @throws Error if the local player is not the host, or if targeting self.
 */
export function kickPlayer(targetPlayerId: string, reason?: string): void {
  if (!_currentLobby) throw new Error('[kickPlayer] Not in a lobby.');
  if (!isHost()) throw new Error('[kickPlayer] Only the host can kick players.');
  if (targetPlayerId === _localPlayerId) throw new Error('[kickPlayer] Host cannot kick themselves.');

  const transport = getMultiplayerTransport();
  transport.send('mp:lobby:kick', {
    targetPlayerId,
    reason,
    issuedBy: _localPlayerId,
  });

  // Remove immediately from local state — don't wait for the peer to leave.
  _currentLobby.players = _currentLobby.players.filter(p => p.id !== targetPlayerId);
  // Cancel any pending reconnect grace timer for this player.
  const timer = _reconnectTimers.get(targetPlayerId);
  if (timer !== undefined) {
    clearTimeout(timer);
    _reconnectTimers.delete(targetPlayerId);
  }
  console.info(`[MP:LobbyService] Host kicked player ${targetPlayerId}${reason ? ` (reason: ${reason})` : ''}`);
  notifyLobbyUpdate();
}

// ── Ready & Start ────────────────────────────────────────────────────────────

/**
 * Toggle local player's ready state.
 * H13: Increments _localReadyVersion so that late-arriving settings broadcasts
 * can detect stale incoming ready states and preserve the local one.
 */
export function setReady(ready: boolean): void {
  if (!_currentLobby) return;
  const player = _currentLobby.players.find(p => p.id === _localPlayerId);
  console.log(`[MP:LobbyService] setReady(${ready}) for player=${_localPlayerId}, found=${!!player}`);
  if (player) {
    player.isReady = ready;
    _localReadyVersion++;
    const transport = getMultiplayerTransport();
    transport.send('mp:lobby:ready', {
      playerId: _localPlayerId,
      ready,
      readyVersion: _localReadyVersion,
    });
    notifyLobbyUpdate();
  }
}

/** Check if all players are ready (2+ players, all ready) */
export function allReady(): boolean {
  if (!_currentLobby) return false;
  return _currentLobby.players.length >= 2 &&
         _currentLobby.players.every(p => p.isReady);
}

/**
 * Derive a stable short hash from a contentSelection to detect divergence.
 * Used by the H-016 ACK-hash handshake.
 */
function _contentSelectionHash(selection: LobbyContentSelection | null | undefined): string {
  if (!selection) return '';
  // Stable key subset — covers the fields that must match for a deterministic run.
  try {
    return JSON.stringify(selection);
  } catch {
    return '';
  }
}

/**
 * Start the game (host only, requires allReady).
 *
 * Fix 2026-04-09: contentSelection is now included in the mp:lobby:start payload
 * so guest clients receive the same content selection the host configured.
 *
 * M22: Re-validates player count immediately before broadcasting start.
 * H5: Initiates a seed ACK handshake — waits up to 3s for all guests to ACK
 * before firing onGameStart. Falls back to firing without full ACK on timeout.
 * H-016: ACK now carries contentHash so the host can detect and re-broadcast
 * on a single mismatch before the run starts.
 */
export function startGame(): void {
  if (!_currentLobby || !isHost() || !allReady()) return;

  // M22 + #070: Re-check connected player count immediately before broadcast — a
  // player may have left between allReady() passing and this line executing, OR a
  // player may be marked 'reconnecting' (in roster but unreachable). Don't count
  // reconnecting players toward the start gate; otherwise the 3s ACK timeout fires
  // and host enters the run alone.
  const connectedCount = _currentLobby.players.filter(
    p => (p as LobbyPlayer & { connectionState?: 'connected' | 'reconnecting' }).connectionState !== 'reconnecting',
  ).length;
  if (connectedCount < 2) {
    throw new Error('Cannot start game — not enough connected players ready.');
  }

  const seed = Math.floor(Math.random() * 2147483647);
  _currentLobby.seed = seed;
  _currentLobby.status = 'starting';

  const payload: Record<string, unknown> = {
    seed,
    mode: _currentLobby.mode,
    deckId: _currentLobby.selectedDeckId,
    houseRules: _currentLobby.houseRules as unknown as Record<string, unknown>,
    // contentSelection is always sent so guests have the definitive value at game-start
    // time, even if mp:lobby:settings arrived late or was lost due to packet drop.
    contentSelection: _currentLobby.contentSelection as unknown as Record<string, unknown> | undefined,
  };

  // H5: Set up pending ACK tracking for all guests (everyone except the host).
  const guestIds = _currentLobby.players
    .filter(p => p.id !== _localPlayerId)
    .map(p => p.id);

  _pendingStartAcks = new Set(guestIds);
  _lastStartPayload = payload;
  _hostStartFired = false;
  // #036: Stop the roster-reconciliation heartbeat — once we transition to in_game,
  // mid-run sync uses different channels.
  _stopRosterReconciliation();

  const transport = getMultiplayerTransport();
  transport.send('mp:lobby:start', payload);

  if (guestIds.length === 0) {
    // No guests — fire immediately (solo testing / edge case).
    _cancelStartAckHandshake();
    if (!_hostStartFired) {
      _hostStartFired = true;
      _fireSubscribers(_gameStartSubscribers, seed, _currentLobby!);
    }
    return;
  }

  // BUG-8 fix: on Steam P2P the host does not receive its own send (no loopback).
  // Fire the host's onGameStart subscribers immediately after broadcast so the host
  // transitions to the game while guests ACK. The ACK-all-arrived path (see mp:lobby:start_ack
  // handler) is guarded by _hostStartFired to prevent a second fire.
  // BroadcastChannel and WebSocket backends echo the message back, so they use the
  // mp:lobby:start received-handler path instead — guard prevents double-fire there too.
  if (isTauriPresent() && !isBroadcastMode() && !isLanMode()) {
    // Steam P2P — host never receives its own send; fire immediately.
    _hostStartFired = true;
    _fireSubscribers(_gameStartSubscribers, seed, _currentLobby!);
  }

  // Retry broadcast every 750ms until all guests ACK or 3s timeout fires.
  _startAckRetryTimer = setInterval(() => {
    if (!_currentLobby || !_pendingStartAcks || _pendingStartAcks.size === 0) {
      _cancelStartAckHandshake();
      return;
    }
    console.log('[MP:LobbyService] Retrying mp:lobby:start for pending ACKs:', [..._pendingStartAcks]);
    getMultiplayerTransport().send('mp:lobby:start', _lastStartPayload!);
  }, 750);

  // BUG-3: Changed from "fire onGameStart anyway" to "abort and surface error".
  // Firing game start when guests haven't ACKed means they never received the seed,
  // so they each run an independent solo game instead of joining the shared session.
  // Better behavior: cancel the attempt, surface the error, return lobby to waiting
  // state so the host can retry. Ghost guests (failed to ACK) are evicted.
  _startAckTimeoutTimer = setTimeout(() => {
    if (!_currentLobby || _pendingStartAcks === null) return;
    if (_pendingStartAcks.size > 0) {
      console.error('[MP:LobbyService] mp:lobby:start ACK timeout — could not reach guests:', [..._pendingStartAcks]);
      // Evict guests that failed to ACK — they demonstrably cannot be reached.
      const failedIds = [..._pendingStartAcks];
      _currentLobby.players = _currentLobby.players.filter(p => !failedIds.includes(p.id));
    }
    // Cancel the handshake and reset lobby status so the UI is usable again.
    _cancelStartAckHandshake();
    _currentLobby.status = 'waiting';
    notifyLobbyUpdate();
    // Surface the failure to the host so they know what happened.
    _fireSubscribers(_lobbyErrorSubscribers, 'Could not reach all players. Returning to lobby.');
  }, 3000);
}

// ── Race Mode ────────────────────────────────────────────────────────────────

/** Send race progress update (called by game loop at ~0.5 Hz) */
export function sendRaceProgress(progress: RaceProgress): void {
  const transport = getMultiplayerTransport();
  transport.send('mp:race:progress', progress as unknown as Record<string, unknown>);
}

/** Send race finish (when run ends) */
export function sendRaceFinish(results: RaceProgress): void {
  const transport = getMultiplayerTransport();
  transport.send('mp:race:finish', results as unknown as Record<string, unknown>);
}

// ── Callbacks ────────────────────────────────────────────────────────────────

/** Register callback for lobby state updates.
 *  BUG22: multi-subscriber — each call adds a new subscriber. Cleanup removes
 *  that specific subscriber (and only that one). */
export function onLobbyUpdate(cb: (lobby: LobbyState) => void): () => void {
  _lobbyUpdateSubscribers.add(cb);
  return () => { _lobbyUpdateSubscribers.delete(cb); };
}

/**
 * Register callback for game start. BUG23: multi-subscriber.
 *
 * #034: Subscribers are NOT cleared on leaveLobby — they survive lobby cycles by
 * design (CardApp registers once on app mount). The CONSUMER is responsible for:
 *   1. Storing the returned cleanup function.
 *   2. Calling it in their teardown path ($effect cleanup, onDestroy, error
 *      boundary recovery, HMR dispose).
 * If the consumer re-mounts (HMR, error recovery, dev refresh) without calling
 * cleanup, OLD subscriber closures stay registered and stack on top of new ones,
 * producing double-fire onGameStart that re-triggers the scene transition mid-run.
 *
 * If you need true idempotency on re-registration of the same closure reference,
 * pass that closure to a memoised wrapper at the call site — Set's identity
 * semantics handle the dedup automatically. Do NOT rely on this service to
 * deduplicate functionally-equivalent but distinct closures: closures are
 * intentionally independent here (e.g. two CardApp panes during HMR).
 */
export function onGameStart(cb: (seed: number, lobby: LobbyState) => void): () => void {
  _gameStartSubscribers.add(cb);
  return () => { _gameStartSubscribers.delete(cb); };
}

/** Register callback for opponent race progress. BUG23: multi-subscriber. */
export function onRaceProgress(cb: (progress: RaceProgress) => void): () => void {
  _raceProgressSubscribers.add(cb);
  return () => { _raceProgressSubscribers.delete(cb); };
}

/** Register callback for race results. BUG23: multi-subscriber. */
export function onRaceResults(cb: (results: RaceResults) => void): () => void {
  _raceResultsSubscribers.add(cb);
  return () => { _raceResultsSubscribers.delete(cb); };
}

/**
 * Register callback for lobby errors experienced by the local player
 * (e.g. being kicked by the host). BUG23: multi-subscriber.
 */
export function onLobbyError(cb: (error: string) => void): () => void {
  _lobbyErrorSubscribers.add(cb);
  return () => { _lobbyErrorSubscribers.delete(cb); };
}

/** BUG23: helper to fire all subscribers with one try/catch per subscriber. */
function _fireSubscribers<Args extends unknown[]>(
  subscribers: Set<(...args: Args) => void>,
  ...args: Args
): void {
  for (const cb of subscribers) {
    try { cb(...args); } catch (e) { rrLog('mp:cb', 'subscriber threw', { e: String(e) }); }
  }
}

// ── C4: LAN mode clear hook ───────────────────────────────────────────────────

/**
 * Clear LAN mode state when the player navigates back to the Hub.
 * Exposed as a primitive — the UI wave wires it to the Hub navigation callback.
 * Calling this when LAN mode is inactive is a no-op (no harm).
 *
 * Wiring point: CardApp.svelte Hub entry path (owned by ui-agent).
 */
export function clearLanModeOnHubEntry(): void {
  if (isLanMode()) {
    console.info('[MP:LobbyService] Clearing LAN mode on Hub entry.');
    clearLanServerUrl();
  }
}

// ── M20: Solo-start hook ─────────────────────────────────────────────────────

/**
 * Leave the current multiplayer lobby before starting a solo run.
 * Called by the CardApp.svelte solo-start path to ensure clean state.
 *
 * Contract:
 *   - If in a lobby, calls leaveLobby() which sends mp:lobby:leave, destroys the
 *     transport, and clears all lobby state.
 *   - Safe to call when not in a lobby — no-op.
 *   - Always resolves (never rejects): transport send errors are caught inside leaveLobby().
 */
export async function leaveMultiplayerLobbyForSoloStart(): Promise<void> {
  if (getCurrentLobby() !== null) {
    leaveLobby();
  }
}

// ── Internal ─────────────────────────────────────────────────────────────────

/** Notify the UI of a lobby state change. Spreads a new object so Svelte
 *  detects the update (same-reference assignments are optimized away). */
function notifyLobbyUpdate(): void {
  if (!_currentLobby || _lobbyUpdateSubscribers.size === 0) return;
  rrLog('mp:lobby', 'notifyLobbyUpdate full', {
    lobbyId: _currentLobby.lobbyId,
    mode: _currentLobby.mode,
    playerCount: _currentLobby.players.length,
    hostId: _currentLobby.hostId,
    contentSelection: _currentLobby.contentSelection ?? null,
    subscriberCount: _lobbyUpdateSubscribers.size,
  });
  // Build ONE snapshot, deliver to every subscriber. Each subscriber may spread
  // again internally (e.g. CardApp does for Svelte proxy detection), but we give
  // them all the same ref — cheaper than N spreads and semantically identical.
  const snapshot = { ..._currentLobby, players: _currentLobby.players.map(p => ({ ...p })) };
  for (const cb of _lobbyUpdateSubscribers) {
    try { cb(snapshot); } catch (e) { rrLog('mp:lobby', 'subscriber threw', { e: String(e) }); }
  }
}

/**
 * Cancel all H5 seed-ACK handshake timers and clear pending state.
 * Safe to call multiple times.
 */
function _cancelStartAckHandshake(): void {
  if (_startAckRetryTimer !== null) {
    clearInterval(_startAckRetryTimer);
    _startAckRetryTimer = null;
  }
  if (_startAckTimeoutTimer !== null) {
    clearTimeout(_startAckTimeoutTimer);
    _startAckTimeoutTimer = null;
  }
  _pendingStartAcks = null;
  _lastStartPayload = null;
  // BUG-8: reset fired-flag so next start attempt is clean.
  _hostStartFired = false;
}

function setupMessageHandlers(): void {
  const transport = getMultiplayerTransport();
  // #067: Guard is per-transport-instance, not process-wide. Calling this twice
  // on the SAME transport is the bug we want to prevent (doubled handlers); calling
  // it again after the transport changes (e.g. destroyMultiplayerTransport rebuilt
  // the singleton, or a separate bot transport became active) MUST re-attach.
  if (_handlersAttached && _handlersAttachedTransport === transport) return;
  _handlersAttached = true;
  _handlersAttachedTransport = transport;

  // BUG16: Helper that registers a handler AND stores the cleanup function so
  // leaveLobby() can remove it before the next join re-attaches on the singleton.
  function reg(type: string, handler: (msg: import('./multiplayerTransport').MultiplayerMessage) => void): void {
    _activeHandlerCleanups.push(transport.on(type, handler));
  }

  reg('mp:lobby:player_joined', (msg) => {
    if (!_currentLobby) return;
    const { playerId, displayName } = msg.payload as { playerId: string; displayName: string };
    console.log(`[MP:LobbyService] mp:lobby:player_joined received: player=${playerId}, name=${displayName}, existing=${_currentLobby.players.length}`);
    if (!_currentLobby.players.find(p => p.id === playerId)) {
      _currentLobby.players.push({
        id: playerId, displayName, isHost: false, isReady: false
      });
    }
    notifyLobbyUpdate();
    if (isHost()) broadcastSettings(); // Sync new player
  });

  // BUG8: Steam P2P has no server — the host must handle mp:lobby:join directly.
  // In LAN / Fastify mode, the server intercepts mp:lobby:join and rebroadcasts it
  // as mp:lobby:player_joined. On Steam P2P there is no server, so the raw
  // mp:lobby:join arrives at the host and must be processed here.
  //
  // This handler coexists with mp:lobby:player_joined (which still fires on
  // LAN / Fastify paths). Both are safe to register — each path only uses one.
  reg('mp:lobby:join', (msg) => {
    // Only the host processes this — it's the server-side relay equivalent for Steam P2P.
    if (!_currentLobby || !isHost()) return;
    // Post-audit fix #2: read multiplayerRating from payload so the host's
    // player entry uses the guest's real rating instead of default 1000.
    const { playerId, displayName, multiplayerRating } = msg.payload as {
      playerId: string;
      displayName: string;
      multiplayerRating?: number;
    };
    rrLog('mp:recv', 'mp:lobby:join (as host)', { playerId, displayName, existingCount: _currentLobby.players.length });
    if (!_currentLobby.players.find(p => p.id === playerId)) {
      // BUG21 fix: strip only steam:<id> placeholder entries (BUG10 host stub, which
      // exists only in the GUEST's initial state, never the host's).
      _currentLobby.players = _currentLobby.players.filter(p => !p.id.startsWith('steam:'));
      _currentLobby.players.push({
        id: playerId,
        displayName,
        isHost: false,
        isReady: false,
        multiplayerRating: multiplayerRating ?? 1000,
      });
      rrLog('mp:recv', 'mp:lobby:join (as host) — added player', { playerId, totalCount: _currentLobby.players.length });
    } else {
      rrLog('mp:recv', 'mp:lobby:join (as host) — player already present', { playerId });
    }
    // Post-audit fix #3: broadcastSettings() already ends with notifyLobbyUpdate(),
    // so the explicit notify below was double-firing every subscriber per join.
    broadcastSettings();
  });

  reg('mp:lobby:leave', (msg) => {
    if (!_currentLobby) return;
    const { playerId } = msg.payload as { playerId: string };
    _currentLobby.players = _currentLobby.players.filter(p => p.id !== playerId);
    // Cancel any reconnect timer for this player (they explicitly left).
    const timer = _reconnectTimers.get(playerId);
    if (timer !== undefined) {
      clearTimeout(timer);
      _reconnectTimers.delete(playerId);
    }
    notifyLobbyUpdate();
  });

  reg('mp:lobby:ready', (msg) => {
    if (!_currentLobby) return;
    const { playerId, ready } = msg.payload as { playerId: string; ready: boolean };
    const player = _currentLobby.players.find(p => p.id === playerId);
    if (player) player.isReady = ready;
    notifyLobbyUpdate();
  });

  // H10: Handle peer disconnection — start reconnect grace timer.
  reg('mp:lobby:peer_left', (msg) => {
    if (!_currentLobby) return;
    const { playerId } = msg.payload as { playerId: string };
    const playerIdx = _currentLobby.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return;

    // Mark as reconnecting rather than removing immediately.
    (_currentLobby.players[playerIdx] as LobbyPlayer & { connectionState?: string }).connectionState = 'reconnecting';
    notifyLobbyUpdate();

    // Cancel any existing timer for this player before setting a new one.
    const existing = _reconnectTimers.get(playerId);
    if (existing !== undefined) clearTimeout(existing);

    const timer = setTimeout(() => {
      if (!_currentLobby) return;
      _reconnectTimers.delete(playerId);
      // Remove the player if still in reconnecting state after grace period.
      const p = _currentLobby.players.find(pl => pl.id === playerId) as (LobbyPlayer & { connectionState?: string }) | undefined;
      if (p && p.connectionState === 'reconnecting') {
        _currentLobby.players = _currentLobby.players.filter(pl => pl.id !== playerId);
        console.info(`[MP:LobbyService] Player ${playerId} removed after reconnect grace period expired.`);
        notifyLobbyUpdate();
      }
    }, RECONNECT_GRACE_MS);
    _reconnectTimers.set(playerId, timer);
  });

  // H10: Handle peer reconnection within grace window.
  reg('mp:lobby:peer_rejoined', (msg) => {
    if (!_currentLobby) return;
    const { playerId } = msg.payload as { playerId: string };
    const player = _currentLobby.players.find(p => p.id === playerId) as (LobbyPlayer & { connectionState?: string }) | undefined;
    if (player && player.connectionState === 'reconnecting') {
      player.connectionState = 'connected';
      const timer = _reconnectTimers.get(playerId);
      if (timer !== undefined) {
        clearTimeout(timer);
        _reconnectTimers.delete(playerId);
      }
      console.info(`[MP:LobbyService] Player ${playerId} reconnected within grace window.`);
      notifyLobbyUpdate();
    }
  });

  reg('mp:lobby:settings', (msg) => {
    rrLog('mp:recv', 'mp:lobby:settings', { hasLobby: !!_currentLobby, amHost: isHost(), payloadKeys: Object.keys(msg.payload ?? {}) });
    if (!_currentLobby || isHost()) return; // Host already has correct state
    const settings = msg.payload as Partial<LobbyState> & { seq?: number };

    // #037: Reject out-of-order settings broadcasts. Guards against lossy Steam P2P
    // delivering an older snapshot after a newer one and clobbering fresh state.
    // seq starts at 1 on the first broadcast; missing seq (legacy peer) is treated
    // as 0 and only accepted if we have not yet seen any seq.
    const incomingSeq = typeof settings.seq === 'number' ? settings.seq : 0;
    if (incomingSeq > 0 && incomingSeq <= _lastSettingsSeqSeen) {
      rrLog('mp:recv', 'mp:lobby:settings rejected (stale seq)', {
        incomingSeq, lastSeen: _lastSettingsSeqSeen,
      });
      return;
    }
    if (incomingSeq > 0) _lastSettingsSeqSeen = incomingSeq;

    // #026: Snapshot per-player connectionState + multiplayerRating BEFORE merge so
    // we can preserve them for non-local players. Object.assign of host's players
    // array overwrites these fields; the host doesn't track our local view of a
    // peer's reconnect state (that's a local-only signal driven by mp:lobby:peer_left).
    type PlayerLocalSnapshot = {
      isReady: boolean;
      connectionState?: 'connected' | 'reconnecting';
      multiplayerRating?: number;
    };
    const localStateMap = new Map<string, PlayerLocalSnapshot>(
      _currentLobby.players.map(p => [p.id, {
        isReady: p.isReady,
        connectionState: (p as LobbyPlayer & { connectionState?: 'connected' | 'reconnecting' }).connectionState,
        multiplayerRating: p.multiplayerRating,
      }]),
    );
    // H13: Snapshot local ready version so we can detect stale incoming states.
    const localReadyVersion = _localReadyVersion;

    // Preserve ALL players' ready states + connectionState + multiplayerRating in
    // the incoming array — settings broadcasts can arrive after ready/peer_left
    // messages due to network latency.
    if (settings.players) {
      for (const p of settings.players as LobbyPlayer[]) {
        const local = localStateMap.get(p.id);
        if (!local) continue;
        // Ready: union — if either side says ready, we're ready (deferred to H13 for local).
        p.isReady = p.isReady || local.isReady;
        // #026: connectionState is a LOCAL signal (peer_left poll, transport). Never
        // let a host-broadcast 'connected' clobber a local 'reconnecting'. This
        // preserves the 60s grace timer's authority.
        if (local.connectionState === 'reconnecting') {
          (p as LobbyPlayer & { connectionState?: 'connected' | 'reconnecting' }).connectionState = 'reconnecting';
        }
        // #026: multiplayerRating — if the host's snapshot has the placeholder 1000
        // and we have a real value cached, keep ours. Symmetric to the post-audit
        // fix #2 in mp:lobby:join.
        if ((p.multiplayerRating === undefined || p.multiplayerRating === 1000) && local.multiplayerRating !== undefined && local.multiplayerRating !== 1000) {
          p.multiplayerRating = local.multiplayerRating;
        }
      }
    }
    // BUG10: Snapshot own entry BEFORE Object.assign overwrites players array.
    // After the merge, re-insert self if our ID was dropped.
    const selfEntryBeforeMerge = _currentLobby.players.find(p => p.id === _localPlayerId);
    Object.assign(_currentLobby, settings);
    // BUG10: Re-insert self if the incoming players array doesn't include us.
    if (selfEntryBeforeMerge && !_currentLobby.players.find(p => p.id === _localPlayerId)) {
      _currentLobby.players.push(selfEntryBeforeMerge);
      rrLog('mp:recv', 'mp:lobby:settings — reinserted self after merge', { playerId: _localPlayerId });
    }
    // Re-apply the local player's ready state after Object.assign.
    // H13: If our local readyVersion is greater than what came in, keep our value.
    const localPlayer = _currentLobby.players.find(p => p.id === _localPlayerId);
    const localSelfState = localStateMap.get(_localPlayerId);
    if (localPlayer && localSelfState !== undefined) {
      const incomingReadyVersion = (settings.players as Array<LobbyPlayer & { readyVersion?: number }> | undefined)
        ?.find(p => p.id === _localPlayerId)?.readyVersion ?? 0;
      if (localReadyVersion > incomingReadyVersion) {
        localPlayer.isReady = localSelfState.isReady;
      }
    }
    notifyLobbyUpdate();
  });

  reg('mp:lobby:start', (msg) => {
    if (!_currentLobby) return;

    // FIX 023: Idempotency guard — host's 750ms retry storm must not re-fire
    // _gameStartSubscribers for a guest that already transitioned to in_game.
    // Re-send ACK so the host's pending set decrements and the retry stops, then bail.
    if (_currentLobby.status === 'in_game') {
      if (!isHost()) {
        const retryPayload = msg.payload as { seed: number; contentSelection?: LobbyContentSelection };
        getMultiplayerTransport().send(
          'mp:lobby:start_ack',
          {
            seed: retryPayload.seed,
            playerId: _localPlayerId,
            contentHash: _contentSelectionHash(retryPayload.contentSelection),
          },
        );
      }
      return;
    }
    // Set status to 'in_game' early — before any field merges or subscriber fires —
    // so any re-entrant mp:lobby:start (from the retry interval) hits the guard above.
    _currentLobby.status = 'in_game';

    // BUG-1: Widen the payload type to include all fields the host sends at startGame().
    // Previously only seed + contentSelection were extracted; mode/deckId/houseRules were
    // silently discarded, leaving the guest with stale values from mp:lobby:settings
    // (which can arrive late or be lost entirely on Steam P2P). Each field is guarded
    // so a host that omits it does not clobber valid local state.
    const payload = msg.payload as {
      seed: number;
      mode?: MultiplayerMode;
      deckId?: string;
      houseRules?: HouseRules;
      contentSelection?: LobbyContentSelection;
    };

    // Apply all lobby-critical fields before firing subscribers.
    // Order: mode → deckId → houseRules → contentSelection → seed.
    // status was set to 'in_game' early above for idempotency (FIX 023).
    // This ensures onGameStart always sees the definitive host-committed values.
    if (payload.mode !== undefined) {
      _currentLobby.mode = payload.mode;
    }
    if (payload.deckId !== undefined) {
      _currentLobby.selectedDeckId = payload.deckId;
    }
    if (payload.houseRules !== undefined) {
      _currentLobby.houseRules = payload.houseRules;
    }
    // Apply contentSelection BEFORE invoking _onGameStart so the callback
    // always sees the definitive value the host committed at game-start time.
    // This is the authoritative source — mp:lobby:settings may have been lost
    // or reordered relative to mp:lobby:start in high-latency/lossy conditions.
    if (payload.contentSelection !== undefined) {
      _currentLobby.contentSelection = payload.contentSelection;
    }
    _currentLobby.seed = payload.seed;

    rrLog('mp:recv', 'mp:lobby:start applied', {
      mode: _currentLobby.mode,
      deckId: _currentLobby.selectedDeckId ?? null,
      hasHouseRules: payload.houseRules !== undefined,
      hasContentSelection: payload.contentSelection !== undefined,
      seed: payload.seed,
    });

    // BUG-2: Abort with a loud error if mode is still undefined after applying all
    // payload fields. This means neither mp:lobby:settings nor the start payload
    // carried a mode — the guest would silently skip coop/duel/race wiring.
    if (_currentLobby.mode === undefined) {
      console.error(
        '[MP:LobbyService] mp:lobby:start applied but _currentLobby.mode is undefined — ' +
        'coop/duel/race wiring will skip. This indicates mp:lobby:settings was never received ' +
        'AND host omitted mode in start payload. Aborting start.',
      );
      return;
    }

    // H5: Guest sends ACK back to host so host knows seed was received.
    // BUG-4: 'mp:lobby:start_ack' is now in MultiplayerMessageType (multiplayerTransport.ts:106).
    // Cast and TODO removed.
    if (!isHost()) {
      // H-016: Include contentHash in ACK so host can detect selection mismatch.
      getMultiplayerTransport().send(
        'mp:lobby:start_ack',
        {
          seed: payload.seed,
          playerId: _localPlayerId,
          contentHash: _contentSelectionHash(payload.contentSelection),
        },
      );
    }

    // BUG-8: on Steam P2P, host already fired in startGame() — guard prevents double-fire.
    // On BroadcastChannel/WebSocket, host receives its own echo and fires here (normal path).
    if (!_hostStartFired) {
      _hostStartFired = true;
      _fireSubscribers(_gameStartSubscribers, payload.seed, _currentLobby);
    }
  });

  // H5 + H-016: Host handles guest ACKs.
  // If the ACK's contentHash doesn't match what the host sent, re-broadcast mp:lobby:start once.
  reg('mp:lobby:start_ack', (msg) => {
    if (!isHost() || !_pendingStartAcks) return;
    const { playerId, contentHash } = msg.payload as { playerId: string; contentHash?: string };

    // H-016: Verify the guest received the correct contentSelection.
    const expectedHash = _currentLobby
      ? _contentSelectionHash(_currentLobby.contentSelection)
      : '';
    if (contentHash !== undefined && contentHash !== expectedHash && _lastStartPayload) {
      console.warn(
        `[MP:LobbyService] mp:lobby:start_ack from ${playerId} has contentHash mismatch ` +
        `(expected: ${expectedHash.slice(0, 40)}, got: ${(contentHash ?? '').slice(0, 40)}) — re-broadcasting mp:lobby:start`,
      );
      getMultiplayerTransport().send('mp:lobby:start', _lastStartPayload);
      // Do NOT remove from pending set — wait for the corrected ACK on the retry.
      return;
    }

    _pendingStartAcks.delete(playerId);
    console.log(`[MP:LobbyService] mp:lobby:start_ack from ${playerId}, remaining:`, _pendingStartAcks.size);

    if (_pendingStartAcks.size === 0) {
      // All guests ACKed — cancel timers.
      // BUG-8: on Steam P2P, host already fired in startGame(); guard prevents double-fire.
      // On BroadcastChannel / WebSocket, host receives its own mp:lobby:start echo and
      // fires via the mp:lobby:start received-handler, so _hostStartFired is also set there.
      _cancelStartAckHandshake();
      if (_currentLobby && !_hostStartFired) {
        _hostStartFired = true;
        _fireSubscribers(_gameStartSubscribers, _currentLobby.seed!, _currentLobby);
      }
    }
  });

  // L4: Handle host kick — either remove the targeted peer from local state,
  // or (if we are the target) fire _onLobbyError and leave the lobby.
  reg('mp:lobby:kick', (msg) => {
    if (!_currentLobby) return;
    const { targetPlayerId, reason, issuedBy } = msg.payload as {
      targetPlayerId: string;
      reason?: string;
      issuedBy: string;
    };

    // Security: only honour kicks issued by the host.
    // Reject spoofed kicks from non-host peers.
    if (issuedBy !== _currentLobby.hostId) {
      console.warn(
        `[MP:LobbyService] Rejected spoofed kick for ${targetPlayerId} — issuedBy=${issuedBy} is not host=${_currentLobby.hostId}`,
      );
      return;
    }

    if (targetPlayerId === _localPlayerId) {
      // We are the kicked player — fire error callback then leave cleanly.
      console.info(`[MP:LobbyService] Kicked by host.${reason ? ` Reason: ${reason}` : ''}`);
      _fireSubscribers(_lobbyErrorSubscribers, 'kicked_by_host');
      leaveLobby();
      return;
    }

    // Remove the kicked player from our local lobby state.
    _currentLobby.players = _currentLobby.players.filter(p => p.id !== targetPlayerId);
    const timer = _reconnectTimers.get(targetPlayerId);
    if (timer !== undefined) {
      clearTimeout(timer);
      _reconnectTimers.delete(targetPlayerId);
    }
    notifyLobbyUpdate();
  });

  reg('mp:race:progress', (msg) => {
    _fireSubscribers(_raceProgressSubscribers, msg.payload as unknown as RaceProgress);
  });

  reg('mp:race:finish', (msg) => {
    _fireSubscribers(_raceProgressSubscribers, msg.payload as unknown as RaceProgress);
  });

  // BUG24 defensive drain: when setupMessageHandlers runs for a new lobby,
  // flush any stale pending_peer_left SteamID that was recorded for a prior
  // lobby (before the Rust-side filter in BUG24 was active, or for any race).
  // Belt-and-suspenders with the Rust-side lobby-match check.
  if (isTauriPresent()) {
    void getPendingPeerLeft().catch(() => null);
  }

  // BUG17: When on Steam, poll for ungraceful peer exits (app crash, network drop)
  // that never send mp:lobby:leave. The Rust LobbyChatUpdate callback writes the
  // departing peer's SteamID to pending_peer_left; we read and synthesise the event.
  if (isTauriPresent()) {
    if (_peerLeftPollInterval !== null) {
      clearInterval(_peerLeftPollInterval);
    }
    _peerLeftPollInterval = setInterval(async () => {
      if (!_currentLobby) return;
      const steamId = await getPendingPeerLeft().catch(() => null);
      if (!steamId) return;
      rrLog('mp:recv', 'pending_peer_left poll — peer left ungracefully', { steamId });
      // Post-audit fix #5: match only exact player id OR steam:<id> placeholder.
      // The earlier `endsWith(steamId)` clause was defensive but could theoretically
      // match the local player if their random ID ended with those digits — drop it.
      const player = _currentLobby.players.find(
        p => p.id === steamId || p.id === `steam:${steamId}`,
      );
      if (player) {
        rrLog('mp:recv', 'peer_left poll — removing player', { playerId: player.id, steamId });
        _currentLobby.players = _currentLobby.players.filter(p => p !== player);
        notifyLobbyUpdate();
      } else {
        rrLog('mp:recv', 'peer_left poll — no matching player for steamId', { steamId });
      }
    }, 1000);
    // Register cleanup so leaveLobby() stops the poll via _activeHandlerCleanups.
    _activeHandlerCleanups.push(() => {
      if (_peerLeftPollInterval !== null) {
        clearInterval(_peerLeftPollInterval);
        _peerLeftPollInterval = null;
      }
    });
  }
}

function broadcastSettings(): void {
  if (!_currentLobby) return;
  const transport = getMultiplayerTransport();
  // #037: stamp every host broadcast with a monotonically increasing seq so guests
  // can reject out-of-order deliveries.
  _settingsSeq++;
  rrLog('mp:broadcast', 'broadcastSettings', {
    seq: _settingsSeq,
    mode: _currentLobby.mode,
    deckSelectionMode: _currentLobby.deckSelectionMode,
    contentSelectionType: _currentLobby.contentSelection?.type,
    playerCount: _currentLobby.players.length,
  });
  transport.send('mp:lobby:settings', {
    seq: _settingsSeq,
    // Post-audit fix #1: include hostId so the guest's lobby state reflects the
    // real host player ID instead of the `steam:<hostSteamId>` placeholder from
    // join. Future host-migration and any code that compares lobby.hostId with
    // localPlayerId depends on this being the real ID.
    hostId: _currentLobby.hostId,
    mode: _currentLobby.mode,
    deckSelectionMode: _currentLobby.deckSelectionMode,
    selectedDeckId: _currentLobby.selectedDeckId,
    contentSelection: _currentLobby.contentSelection as unknown as Record<string, unknown> | undefined,
    houseRules: _currentLobby.houseRules as unknown as Record<string, unknown>,
    players: _currentLobby.players as unknown as Record<string, unknown>[],
    maxPlayers: _currentLobby.maxPlayers,
    isRanked: _currentLobby.isRanked,
    status: _currentLobby.status,
    visibility: _currentLobby.visibility,
    title: _currentLobby.title,
  });
  notifyLobbyUpdate();
}

// ── #036: Periodic full-roster reconciliation (host only) ─────────────────────
/**
 * Interval handle for the host's roster-reconciliation heartbeat. Every 5s the
 * host re-broadcasts the full settings snapshot (with a fresh seq) so any guest
 * whose state has drifted (lost messages, late join, partial merge) atomically
 * replaces its roster. Cheap insurance against accumulated identity drift.
 *
 * Wired in startRosterReconciliation; stopped in _stopRosterReconciliation
 * (called from leaveLobby) and when the game starts.
 */
let _rosterReconcileTimer: ReturnType<typeof setInterval> | null = null;
const ROSTER_RECONCILE_MS = 5_000;

function startRosterReconciliation(): void {
  if (_rosterReconcileTimer !== null) return;
  _rosterReconcileTimer = setInterval(() => {
    if (!_currentLobby || !isHost()) {
      _stopRosterReconciliation();
      return;
    }
    // Skip while in_game — the run uses a different sync channel.
    if (_currentLobby.status === 'in_game') return;
    rrLog('mp:reconcile', 'periodic roster snapshot', {
      seq: _settingsSeq + 1,
      playerCount: _currentLobby.players.length,
    });
    broadcastSettings();
  }, ROSTER_RECONCILE_MS);
}

function _stopRosterReconciliation(): void {
  if (_rosterReconcileTimer !== null) {
    clearInterval(_rosterReconcileTimer);
    _rosterReconcileTimer = null;
  }
}

function generateLobbyId(): string {
  return `lobby_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique 6-character lobby code.
 *
 * L2: Maintains a module-level Set of recently-generated codes and retries up to
 * 5 times on collision. On the 6th collision (astronomically unlikely), logs a
 * warning and returns the code anyway. The Set grows with active sessions and is
 * never explicitly cleared (entries are short-lived on the scale of a session).
 */
function generateLobbyCode(): string {
  // 6-character uppercase alphanumeric code, no I/O/0/1 to avoid visual confusion
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!_recentLobbyCodes.has(code)) {
      _recentLobbyCodes.add(code);
      return code;
    }
    if (attempt === MAX_RETRIES) {
      console.warn('[MP:LobbyService] generateLobbyCode: 6 consecutive collisions — returning duplicate code. Active codes:', _recentLobbyCodes.size);
      return code;
    }
  }
  // TypeScript narrowing fallback — unreachable.
  return 'AAAAAA';
}

// ── LobbyBackend Interface ────────────────────────────────────────────────────

/** Options for the backend's createLobby operation. */
interface CreateLobbyBackendOpts {
  hostId: string;
  hostName: string;
  mode: MultiplayerMode;
  visibility: LobbyVisibility;
  /** SHA-256 hex hash of the host's chosen password. Absent when visibility !== 'password'. */
  passwordHash?: string;
  maxPlayers: number;
  /**
   * Optional host-supplied lobby title (already sanitized via sanitizeLobbyTitle).
   * Backends store it for the browser; absent when no title was entered.
   */
  title?: string;
}

/** Result from a backend's createLobby call. */
interface CreateLobbyBackendResult {
  lobbyId: string;
  lobbyCode: string;
  /** Short-lived join token for WS upgrade authentication (web backend only). */
  joinToken?: string;
}

/** Result from a backend's joinLobbyById call. */
interface JoinLobbyResult {
  lobbyId: string;
  lobbyCode?: string;
  /** Short-lived join token for WS upgrade authentication (web backend only). */
  joinToken?: string;
}

/**
 * Abstraction over the three lobby discovery backends.
 * All three produce the same LobbyState / LobbyBrowserEntry shapes.
 * Only the create / join-by-id / list plumbing differs per platform.
 */
interface LobbyBackend {
  /**
   * Create a new lobby. Returns backend-assigned IDs + optional WS join token.
   */
  createLobby(opts: CreateLobbyBackendOpts): Promise<CreateLobbyBackendResult>;

  /**
   * Resolve a 6-char invite code to the backend lobby ID.
   * Returns null if the code is unknown, expired, or not applicable (broadcast mode).
   */
  resolveByCode(code: string): Promise<string | null>;

  /**
   * Join a lobby by its backend ID.
   * @param passwordHash  SHA-256 hex hash of the player's password, if any.
   */
  joinLobbyById(
    lobbyId: string,
    playerId: string,
    displayName: string,
    passwordHash?: string,
  ): Promise<JoinLobbyResult>;

  /**
   * List public and password-visible lobbies.
   * friends_only lobbies are excluded on web/broadcast (no friends graph).
   */
  listPublicLobbies(filter?: LobbyListFilter): Promise<LobbyBrowserEntry[]>;
}

// ── pickBackend ───────────────────────────────────────────────────────────────

/**
 * Select the active LobbyBackend at call time.
 *
 * Priority:
 *  1. Steam (isTauriPresent() — Tauri desktop build with Steamworks)
 *  2. BroadcastChannel (?mp URL param — two-tab dev mode, localStorage directory)
 *  3. Web/Fastify (default — mobile, web browser, no Steam)
 */
function pickBackend(): LobbyBackend {
  // `?mp` URL param is an explicit dev opt-in and beats auto-detected Steam.
  // This lets devs running a Steam build two-tab test the broadcast path without
  // uninstalling Steam or fighting the factory's auto-selection.
  if (isBroadcastMode()) return broadcastBackend;
  // FIX 019: In a packaged Steam build (isTauriPresent), honour LAN-mode localStorage only
  // when the ?lan=1 query flag is present — the user cannot easily append URL params in a
  // packaged build, so the presence of rr-lan-server without ?lan=1 is almost certainly a
  // leftover dev artifact. The flag is the explicit dev opt-in for Steam-build LAN testing.
  if (isLanMode()) {
    const lanFlagPresent = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lan');
    if (!isTauriPresent() || lanFlagPresent) {
      return webBackend;
    }
    console.warn('[pickBackend] rr-lan-server localStorage detected in Steam build; ignored. Add ?lan=1 to opt in.');
  }
  // Live call-time check — avoids the module-load IIFE snapshot in platformService being stale
  // when Tauri's global injection lands after the bundle evaluates (ordering issue in packaged builds).
  // We still log isDesktop so we can see in DevTools whether the static snapshot was stale.
  // Use the memoized isTauriPresent() from platformService rather than an inline
  // duplicate — single scan per session, correct at call time.
  const tauriPresent = isTauriPresent();
  console.log('[pickBackend]', {
    hasTauriInternals: typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__,
    hasTauriGlobal: typeof window !== 'undefined' && !!(window as any).__TAURI__,
    isDesktopStatic: isDesktop,
    tauriPresentLive: tauriPresent,
  });
  if (tauriPresent) return steamBackend;
  return webBackend;
}

// ── broadcastBackend ──────────────────────────────────────────────────────────

/** localStorage key for the broadcast-mode fake lobby directory. */
const BC_DIRECTORY_KEY = 'rr-mp:directory';
/**
 * Stale-entry TTL: entries older than this are pruned on read.
 * M4: Reduced from 30_000 to 15_000 — aligns with ~3× heartbeat cadence
 * (BC_HEARTBEAT_MS = 5_000, TTL = 3× = 15_000) to halve ghost-lobby window.
 */
const BC_ENTRY_TTL_MS = 15_000;
/** How often the host refreshes its directory entry (ms). TTL = 3× this value. */
const BC_HEARTBEAT_MS = 5_000;

/** Read, prune stale entries, and return the current broadcast directory. */
function readBroadcastDirectory(): LobbyBrowserEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BC_DIRECTORY_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as LobbyBrowserEntry[];
    const now = Date.now();
    return entries.filter(e => now - e.createdAt < BC_ENTRY_TTL_MS);
  } catch {
    return [];
  }
}

/** Write the pruned entries back to the broadcast directory. */
function writeBroadcastDirectory(entries: LobbyBrowserEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(BC_DIRECTORY_KEY, JSON.stringify(entries));
}

/**
 * Upsert a LobbyBrowserEntry into the broadcast directory.
 * Removes any existing entry with the same lobbyId before inserting the new one
 * so the host doesn't accumulate duplicate rows.
 */
function upsertBroadcastEntry(entry: LobbyBrowserEntry): void {
  const entries = readBroadcastDirectory().filter(e => e.lobbyId !== entry.lobbyId);
  entries.push(entry);
  writeBroadcastDirectory(entries);
}

/**
 * BroadcastChannel backend — two-tab dev mode with a fake localStorage directory.
 *
 * createLobby: writes a LobbyBrowserEntry to localStorage, starts a 5-s heartbeat
 *   to keep the entry fresh. The heartbeat interval is stored in _broadcastHeartbeat
 *   so leaveLobby() can clear it.
 *
 * resolveByCode: returns null (broadcast mode uses lobbyCode as the channel key
 *   directly, so callers fall back to the code-as-key path).
 *
 * joinLobbyById: looks up the entry in the directory to retrieve metadata.
 *
 * listPublicLobbies: reads + prunes the directory, applies mode/fullness filters.
 */
const broadcastBackend: LobbyBackend = {
  async createLobby(opts): Promise<CreateLobbyBackendResult> {
    const lobbyId = generateLobbyId();
    const lobbyCode = generateLobbyCode();

    const entry: LobbyBrowserEntry = {
      lobbyId,
      hostName: opts.hostName,
      mode: opts.mode,
      currentPlayers: 1,
      maxPlayers: opts.maxPlayers,
      visibility: opts.visibility,
      createdAt: Date.now(),
      source: 'broadcast',
      title: opts.title || undefined,
    };

    upsertBroadcastEntry(entry);

    // Start (or restart) the heartbeat — rewrites the entry every BC_HEARTBEAT_MS with
    // the current player count so the browser reflects join activity.
    if (_broadcastHeartbeat !== null) clearInterval(_broadcastHeartbeat);
    _broadcastHeartbeat = setInterval(() => {
      upsertBroadcastEntry({
        ...entry,
        currentPlayers: _currentLobby?.players.length ?? 1,
      });
    }, BC_HEARTBEAT_MS);

    return { lobbyId, lobbyCode };
  },

  async resolveByCode(_code: string): Promise<string | null> {
    // Broadcast mode does not map codes to IDs server-side. The lobbyCode IS the
    // BroadcastChannel rendezvous key — callers use it directly as the channel name.
    // Returning null signals to joinLobby() to use the code itself for the transport.
    return null;
  },

  async joinLobbyById(lobbyId, _playerId, _displayName, _passwordHash): Promise<JoinLobbyResult> {
    const entries = readBroadcastDirectory();
    const entry = entries.find(e => e.lobbyId === lobbyId);
    return { lobbyId, lobbyCode: entry?.lobbyId };
  },

  async listPublicLobbies(filter?: LobbyListFilter): Promise<LobbyBrowserEntry[]> {
    let entries = readBroadcastDirectory();
    entries = entries.filter(e => e.visibility !== 'friends_only');
    if (filter?.mode) entries = entries.filter(e => e.mode === filter.mode);
    if (filter?.fullness === 'open') entries = entries.filter(e => e.currentPlayers < e.maxPlayers);
    return entries;
  },
};

// ── webBackend ────────────────────────────────────────────────────────────────

/** Fastify MP REST API base URL (VITE_MP_API_URL env var, fallback localhost). */
function getWebApiBaseUrl(): string {
  const lanUrls = getLanServerUrls();
  if (lanUrls) return lanUrls.apiUrl;
  return (typeof import.meta !== 'undefined' && (import.meta.env as Record<string, string>)?.VITE_MP_API_URL) ||
    'http://localhost:3000';
}

/**
 * Web backend — wraps the Fastify MP REST endpoints.
 * Endpoints (mounted under /mp by server/src/index.ts):
 *   POST /mp/lobbies              — create
 *   GET  /mp/lobbies              — list public lobbies
 *   GET  /mp/lobbies/code/:code   — resolve code -> lobby info
 *   POST /mp/lobbies/:id/join     — join, receive joinToken for WS upgrade
 */
const webBackend: LobbyBackend = {
  async createLobby(opts): Promise<CreateLobbyBackendResult> {
    const base = getWebApiBaseUrl();
    const res = await fetch(`${base}/mp/lobbies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostId: opts.hostId,
        hostName: opts.hostName,
        mode: opts.mode,
        visibility: opts.visibility,
        passwordHash: opts.passwordHash,
        maxPlayers: opts.maxPlayers,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(`[webBackend] createLobby ${res.status}: ${err.error ?? res.statusText}`);
    }
    const data = await res.json() as { lobbyId: string; lobbyCode: string; joinToken?: string };
    return { lobbyId: data.lobbyId, lobbyCode: data.lobbyCode, joinToken: data.joinToken };
  },

  async resolveByCode(code: string): Promise<string | null> {
    const base = getWebApiBaseUrl();
    const res = await fetch(`${base}/mp/lobbies/code/${encodeURIComponent(code)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[webBackend] resolveByCode ${res.status}`);
      return null;
    }
    const data = await res.json() as { lobbyId?: string };
    return data.lobbyId ?? null;
  },

  async joinLobbyById(lobbyId, playerId, displayName, passwordHash): Promise<JoinLobbyResult> {
    const base = getWebApiBaseUrl();
    const res = await fetch(`${base}/mp/lobbies/${encodeURIComponent(lobbyId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, displayName, password: passwordHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      const userMsg = res.status === 404 ? 'Lobby not found or has ended.' : (err.error ?? res.statusText);
      throw new Error(`[webBackend] joinLobbyById ${res.status}: ${userMsg}`);
    }
    const data = await res.json() as { lobbyId: string; lobbyCode?: string; joinToken?: string };
    return { lobbyId: data.lobbyId, lobbyCode: data.lobbyCode, joinToken: data.joinToken };
  },

  async listPublicLobbies(filter?: LobbyListFilter): Promise<LobbyBrowserEntry[]> {
    const base = getWebApiBaseUrl();
    const params = new URLSearchParams();
    if (filter?.mode) params.set('mode', filter.mode);
    if (filter?.fullness) params.set('fullness', filter.fullness);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${base}/mp/lobbies${qs}`);
    if (!res.ok) {
      console.warn(`[webBackend] listPublicLobbies ${res.status}`);
      return [];
    }
    const data = await res.json() as { lobbies?: LobbyBrowserEntry[] };
    return (data.lobbies ?? []).map(e => ({ ...e, source: 'web' as const }));
  },
};

// ── steamBackend ──────────────────────────────────────────────────────────────

/** Map LobbyVisibility to SteamLobbyType for createSteamLobby. */
function visibilityToSteamType(v: LobbyVisibility): SteamLobbyType {
  if (v === 'friends_only') return 'friends_only';
  // 'password' lobbies are public on Steam — the password check happens via metadata.
  return 'public';
}

/**
 * Steam backend — uses Steamworks Matchmaking + P2P.
 *
 * createLobby: calls createSteamLobby, writes metadata via setLobbyData.
 * joinLobbyById: client-side password check via getLobbyData, then joinSteamLobby.
 * listPublicLobbies: V1 STUB — full wiring awaits Phase 1 Rust binding completion.
 *   Once steam_request_lobby_list returns lobby IDs from the Rust callback, this
 *   will call getLobbyData on each to build LobbyBrowserEntry[].
 *
 * Security note: Steam lobby metadata (including password_hash) is readable by any
 * Steam client. The password is a UX gate, not a cryptographic auth boundary.
 * See gotchas.md entry added 2026-04-11.
 */
const steamBackend: LobbyBackend = {
  async createLobby(opts): Promise<CreateLobbyBackendResult> {
    const steamType = visibilityToSteamType(opts.visibility);
    const lobbyId = await createSteamLobby(steamType, opts.maxPlayers);
    if (!lobbyId) {
      const ipcErr = getLastSteamInvokeError();
      const detail = ipcErr ? ` (IPC: ${ipcErr.message})` : ' — Steam may be unavailable';
      throw new Error(`[steamBackend] createSteamLobby returned null${detail}`);
    }

    // Write metadata for the lobby browser
    await setLobbyData(lobbyId, 'host_name', opts.hostName);
    await setLobbyData(lobbyId, 'mode', opts.mode);
    await setLobbyData(lobbyId, 'visibility', opts.visibility);
    await setLobbyData(lobbyId, 'max_players', String(opts.maxPlayers));
    await setLobbyData(lobbyId, 'created_at', String(Date.now()));
    if (opts.passwordHash) {
      await setLobbyData(lobbyId, 'password_hash', opts.passwordHash);
    }

    // Generate a client-side invite code so the code-based join path still works
    const lobbyCode = generateLobbyCode();
    await setLobbyData(lobbyId, 'lobby_code', lobbyCode);

    // C1: Store optional title in Steam metadata so other clients can read it in the browser.
    if (opts.title) {
      await setLobbyData(lobbyId, 'title', opts.title);
    }

    return { lobbyId, lobbyCode };
  },

  async resolveByCode(code: string): Promise<string | null> {
    // Scan all visible Steam lobbies for one whose lobby_code metadata matches.
    // This mirrors the web backend's GET /mp/lobbies/code/:code but does it client-side
    // by requesting the lobby list and checking metadata on each returned lobby.
    const requested = await requestSteamLobbyList();
    if (!requested) return null;
    const ids = await getSteamLobbyListResult(3000);
    if (!ids) return null;
    // Kick off metadata requests for all lobbies in parallel.
    // Steam's GetLobbyData returns "" until LobbyDataUpdate_t fires for a cold lobby
    // discovered via RequestLobbyList (not yet in the local cache).
    await Promise.all(ids.map(lid => requestSteamLobbyData(lid).catch(() => false)));
    // Brief wait for the background callback pump to process LobbyDataUpdate_t.
    // 200 ms is empirically enough on warm Steam backends; worst case GetLobbyData still
    // returns "" and this call returns null (guest retries or tries manual code entry).
    await new Promise(r => setTimeout(r, 200));
    for (const lobbyId of ids) {
      const storedCode = await getLobbyData(lobbyId, 'lobby_code');
      if (storedCode === code) return lobbyId;
    }
    return null;
  },

  async joinLobbyById(lobbyId, _playerId, _displayName, passwordHash): Promise<JoinLobbyResult> {
    // Client-side password check: compare submitted hash against stored metadata
    if (passwordHash) {
      const storedHash = await getLobbyData(lobbyId, 'password_hash');
      if (storedHash && storedHash !== passwordHash) {
        throw new Error('[steamBackend] Wrong password');
      }
    }

    // A3: joinSteamLobby now returns the joined lobby ID (string) on success, null on timeout,
    // and throws with the real Steam error reason on callback failure (e.g. "lobby full").
    // Let any thrown error propagate — the call stack in CardApp.svelte catches and displays it.
    const joinedId = await joinSteamLobby(lobbyId);
    if (!joinedId) throw new Error(`[steamBackend] joinSteamLobby timed out for ${lobbyId} — Steam may be slow or the lobby no longer exists`);

    const lobbyCode = (await getLobbyData(joinedId, 'lobby_code')) ?? '';
    return { lobbyId: joinedId, lobbyCode };
  },

  async listPublicLobbies(filter?: LobbyListFilter): Promise<LobbyBrowserEntry[]> {
    const requested = await requestSteamLobbyList();
    if (!requested) return [];
    const ids = await getSteamLobbyListResult(3000);
    if (ids === null) {
      console.warn('[steamBackend] listPublicLobbies: lobby list callback did not fire within 3s');
      return [];
    }
    // Kick off metadata requests for all lobbies in parallel before reading any.
    // Steam's GetLobbyData returns "" until LobbyDataUpdate_t fires for cold lobbies
    // discovered via RequestLobbyList. Without this warm-up, browsers may see entries
    // with blank mode/visibility/lobby_code and skip them via the guard below.
    await Promise.all(ids.map(lid => requestSteamLobbyData(lid).catch(() => false)));
    // Brief wait for the background callback pump to process LobbyDataUpdate_t.
    // 200 ms is enough on warm Steam backends; the existing guard
    //  handles any remaining misses.
    await new Promise(r => setTimeout(r, 200));
    const entries: LobbyBrowserEntry[] = [];
    for (const lobbyId of ids) {
      const [mode, visibility, lobbyCode, hostName, maxPlayersStr, createdAtStr, currentPlayers, title] = await Promise.all([
        getLobbyData(lobbyId, 'mode'),
        getLobbyData(lobbyId, 'visibility'),
        getLobbyData(lobbyId, 'lobby_code'),
        getLobbyData(lobbyId, 'host_name'),
        getLobbyData(lobbyId, 'max_players'),
        getLobbyData(lobbyId, 'created_at'),
        getLobbyMemberCount(lobbyId),
        getLobbyData(lobbyId, 'title'),
      ]);
      // Skip lobbies lacking required metadata — they may be stale or from a different game layout.
      if (!mode || !visibility || !lobbyCode) continue;
      // friends_only lobbies excluded from browser: Steam handles that filter natively.
      if (visibility === 'friends_only') continue;
      // A4: Skip lobbies with no members — the host has disconnected, nothing to join.
      if (currentPlayers === 0) continue;
      // A4: Skip lobbies older than 2 hours with fewer than 2 players — likely stale.
      const createdAtNum = Number(createdAtStr ?? 0);
      if (createdAtNum > 0 && Date.now() - createdAtNum > 7_200_000 && currentPlayers < 2) continue;
      const maxPlayers = Number(maxPlayersStr ?? '4');
      // Apply filter if provided.
      if (filter?.mode && mode !== filter.mode) continue;
      if (filter?.fullness === 'open' && currentPlayers >= maxPlayers) continue;
      entries.push({
        lobbyId,
        hostName: hostName ?? 'Unknown',
        mode: mode as MultiplayerMode,
        visibility: visibility as LobbyVisibility,
        currentPlayers,
        maxPlayers,
        createdAt: Number(createdAtStr ?? Date.now()),
        source: 'steam',
        title: title || undefined,
      });
    }
    return entries;
  },
};
