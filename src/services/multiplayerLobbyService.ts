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

import { getMultiplayerTransport, destroyMultiplayerTransport, createLocalTransportPair, LocalMultiplayerTransport } from "./multiplayerTransport";
import type { ConnectOpts } from "./multiplayerTransport";
import type {
  LobbyState, LobbyPlayer, MultiplayerMode, DeckSelectionMode,
  HouseRules, RaceProgress, RaceResults, LobbyContentSelection,
  LobbyVisibility, LobbyBrowserEntry, LobbyListFilter,
} from '../data/multiplayerTypes';
import { DEFAULT_HOUSE_RULES, MODE_MAX_PLAYERS, MODE_MIN_PLAYERS } from '../data/multiplayerTypes';
import { hasSteam } from './platformService';
import {
  createSteamLobby,
  setLobbyData,
  getLobbyData,
  joinSteamLobby,
  requestSteamLobbyList,
  getLobbyMemberCount,
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
let _onLobbyUpdate: ((lobby: LobbyState) => void) | null = null;
let _onGameStart: ((seed: number, lobby: LobbyState) => void) | null = null;
let _onRaceProgress: ((progress: RaceProgress) => void) | null = null;
let _onRaceResults: ((results: RaceResults) => void) | null = null;

/**
 * Host-side password hash (SHA-256 hex of the plaintext).
 * Stored only in memory on the host — never serialised into LobbyState.
 * Forwarded to the backend on create/setPassword calls.
 * NOT a security boundary: this is a UX gate. See gotchas.md.
 */
let _passwordHash: string | null = null;

/**
 * setInterval handle for the broadcast-mode lobby directory heartbeat.
 * The host writes its LobbyBrowserEntry to localStorage every 5 s.
 * Cleared in leaveLobby() so the entry expires when the host disconnects.
 */
let _broadcastHeartbeat: ReturnType<typeof setInterval> | null = null;

/** Transport for the local bot player, if one is active. Dev-only. */
let _botTransport: LocalMultiplayerTransport | null = null;

/** Get the current lobby state (null if not in a lobby) */
export function getCurrentLobby(): LobbyState | null { return _currentLobby; }

/** Check if local player is the host */
export function isHost(): boolean {
  return _currentLobby?.hostId === _localPlayerId;
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
  opts?: { visibility?: LobbyVisibility; password?: string; maxPlayers?: number },
): Promise<LobbyState> {
  _localPlayerId = playerId;

  const visibility: LobbyVisibility = opts?.visibility ?? 'public';
  const maxPlayers = opts?.maxPlayers
    ? Math.max(MODE_MIN_PLAYERS[mode], Math.min(MODE_MAX_PLAYERS[mode], opts.maxPlayers))
    : MODE_MAX_PLAYERS[mode];

  _passwordHash = opts?.password ? await hashPassword(opts.password) : null;

  const backend = pickBackend();
  const result = await backend.createLobby({
    hostId: playerId,
    hostName: displayName,
    mode,
    visibility,
    passwordHash: _passwordHash ?? undefined,
    maxPlayers,
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
    }],
    maxPlayers,
    isRanked: false,
    lobbyCode: result.lobbyCode,
    status: 'waiting',
    visibility,
    hasPassword: visibility === 'password',
  };

  // Use BroadcastChannel transport when ?mp param is present (two-tab dev testing),
  // otherwise fall back to the default platform transport (Steam P2P or WebSocket).
  const broadcast = isBroadcastMode();
  const transport = getMultiplayerTransport(broadcast ? 'broadcast' : 'auto');
  const connectOpts: ConnectOpts | undefined = result.joinToken
    ? { lobbyId: result.lobbyId, joinToken: result.joinToken }
    : undefined;
  transport.connect(
    broadcast ? (result.lobbyCode ?? result.lobbyId) : result.lobbyId,
    playerId,
    connectOpts,
  );
  setupMessageHandlers();

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
  _localPlayerId = playerId;

  const passwordHash = password ? await hashPassword(password) : undefined;
  const backend = pickBackend();

  // Resolve the code to a backend lobbyId (null in broadcast mode — code IS the key)
  const resolvedId = await backend.resolveByCode(lobbyCode);

  _currentLobby = {
    lobbyId: resolvedId ?? '',
    hostId: '',
    mode: 'race',
    deckSelectionMode: 'host_picks',
    houseRules: { ...DEFAULT_HOUSE_RULES },
    players: [{ id: playerId, displayName, isHost: false, isReady: false }],
    maxPlayers: 4,
    isRanked: false,
    lobbyCode,
    status: 'waiting',
    visibility: 'public',
    hasPassword: false,
  };

  const broadcast = isBroadcastMode();
  const transport = getMultiplayerTransport(broadcast ? 'broadcast' : 'auto');

  let joinToken: string | undefined;
  if (resolvedId) {
    try {
      const result = await backend.joinLobbyById(resolvedId, playerId, displayName, passwordHash);
      joinToken = result.joinToken;
      _currentLobby.lobbyId = result.lobbyId;
      if (result.lobbyCode) _currentLobby.lobbyCode = result.lobbyCode;
    } catch (e) {
      console.warn('[multiplayerLobbyService] joinLobby backend join failed:', e);
    }
  }

  const connectOpts: ConnectOpts | undefined = joinToken
    ? { lobbyId: _currentLobby.lobbyId, joinToken }
    : undefined;
  transport.connect(
    broadcast ? lobbyCode : (_currentLobby.lobbyId || lobbyCode),
    playerId,
    connectOpts,
  );
  transport.send('mp:lobby:join', { playerId, displayName, lobbyCode });
  setupMessageHandlers();

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
  _localPlayerId = playerId;

  const passwordHash = password ? await hashPassword(password) : undefined;
  const backend = pickBackend();
  const result = await backend.joinLobbyById(lobbyId, playerId, displayName, passwordHash);

  _currentLobby = {
    lobbyId: result.lobbyId,
    hostId: '',
    mode: 'race',
    deckSelectionMode: 'host_picks',
    houseRules: { ...DEFAULT_HOUSE_RULES },
    players: [{ id: playerId, displayName, isHost: false, isReady: false }],
    maxPlayers: 4,
    isRanked: false,
    lobbyCode: result.lobbyCode,
    status: 'waiting',
    visibility: 'public',
    hasPassword: false,
  };

  const broadcast = isBroadcastMode();
  const transport = getMultiplayerTransport(broadcast ? 'broadcast' : 'auto');
  const connectOpts: ConnectOpts | undefined = result.joinToken
    ? { lobbyId: result.lobbyId, joinToken: result.joinToken }
    : undefined;
  transport.connect(
    broadcast ? (result.lobbyCode ?? result.lobbyId) : result.lobbyId,
    playerId,
    connectOpts,
  );
  transport.send('mp:lobby:join', { playerId, displayName });
  setupMessageHandlers();

  return _currentLobby;
}

/** Leave the current lobby and clean up all related state. */
export function leaveLobby(): void {
  if (!_currentLobby) return;
  const transport = getMultiplayerTransport();
  transport.send('mp:lobby:leave', { playerId: _localPlayerId });
  destroyMultiplayerTransport();

  // Clear the broadcast heartbeat so the directory entry expires naturally (30 s TTL)
  if (_broadcastHeartbeat !== null) {
    clearInterval(_broadcastHeartbeat);
    _broadcastHeartbeat = null;
  }

  _currentLobby = null;
  _passwordHash = null;
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
  _currentLobby.deckSelectionMode = mode;
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
  if (!_currentLobby) return;
  if (_currentLobby.deckSelectionMode === 'host_picks' && isHost()) {
    _currentLobby.contentSelection = selection;
    // Also set legacy selectedDeckId for backwards compat
    _currentLobby.selectedDeckId = selection.type === 'study' ? selection.deckId : selection.type === 'custom_deck' ? selection.customDeckId : undefined;
    broadcastSettings();
  } else if (_currentLobby.deckSelectionMode === 'each_picks') {
    const player = _currentLobby.players.find(p => p.id === _localPlayerId);
    if (player) {
      player.contentSelection = selection;
      player.selectedDeckId = selection.type === 'study' ? selection.deckId : selection.type === 'custom_deck' ? selection.customDeckId : undefined;
      broadcastSettings();
    }
  }
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
 * Co-updates `visibility` and `hasPassword` atomically, then broadcasts settings.
 * Clearing to 'public' or 'friends_only' also clears the stored password hash.
 *
 * @param visibility  New visibility level.
 */
export function setVisibility(visibility: LobbyVisibility): void {
  if (!_currentLobby || !isHost()) return;
  _currentLobby.visibility = visibility;
  _currentLobby.hasPassword = visibility === 'password';
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
      _currentLobby.hasPassword = false;
    }
  } else {
    _passwordHash = await hashPassword(password);
    _currentLobby.visibility = 'password';
    _currentLobby.hasPassword = true;
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

// ── Ready & Start ────────────────────────────────────────────────────────────

/** Toggle local player's ready state */
export function setReady(ready: boolean): void {
  if (!_currentLobby) return;
  const player = _currentLobby.players.find(p => p.id === _localPlayerId);
  if (player) {
    player.isReady = ready;
    const transport = getMultiplayerTransport();
    transport.send('mp:lobby:ready', { playerId: _localPlayerId, ready });
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
 * Start the game (host only, requires allReady).
 *
 * Fix 2026-04-09: contentSelection is now included in the mp:lobby:start payload
 * so guest clients receive the same content selection the host configured.
 * Previously only mp:lobby:settings carried contentSelection — guests who received
 * the start message before a late-arriving settings broadcast would silently fall
 * back to general mode, causing host/guest pool divergence.
 */
export function startGame(): void {
  if (!_currentLobby || !isHost() || !allReady()) return;
  const seed = Math.floor(Math.random() * 2147483647);
  _currentLobby.seed = seed;
  _currentLobby.status = 'starting';
  const transport = getMultiplayerTransport();
  transport.send('mp:lobby:start', {
    seed,
    mode: _currentLobby.mode,
    deckId: _currentLobby.selectedDeckId,
    houseRules: _currentLobby.houseRules as unknown as Record<string, unknown>,
    // contentSelection is always sent so guests have the definitive value at game-start
    // time, even if mp:lobby:settings arrived late or was lost due to packet drop.
    contentSelection: _currentLobby.contentSelection as unknown as Record<string, unknown> | undefined,
  });
  _onGameStart?.(seed, _currentLobby);
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

/** Register callback for lobby state updates */
export function onLobbyUpdate(cb: (lobby: LobbyState) => void): () => void {
  _onLobbyUpdate = cb;
  return () => { _onLobbyUpdate = null; };
}

/** Register callback for game start */
export function onGameStart(cb: (seed: number, lobby: LobbyState) => void): () => void {
  _onGameStart = cb;
  return () => { _onGameStart = null; };
}

/** Register callback for opponent race progress */
export function onRaceProgress(cb: (progress: RaceProgress) => void): () => void {
  _onRaceProgress = cb;
  return () => { _onRaceProgress = null; };
}

/** Register callback for race results */
export function onRaceResults(cb: (results: RaceResults) => void): () => void {
  _onRaceResults = cb;
  return () => { _onRaceResults = null; };
}

// ── Internal ─────────────────────────────────────────────────────────────────

/** Notify the UI of a lobby state change. Spreads a new object so Svelte
 *  detects the update (same-reference assignments are optimized away). */
function notifyLobbyUpdate(): void {
  if (_currentLobby && _onLobbyUpdate) {
    _onLobbyUpdate({ ..._currentLobby, players: _currentLobby.players.map(p => ({ ...p })) });
  }
}

function setupMessageHandlers(): void {
  const transport = getMultiplayerTransport();

  transport.on('mp:lobby:join', (msg) => {
    if (!_currentLobby) return;
    const { playerId, displayName } = msg.payload as { playerId: string; displayName: string };
    if (!_currentLobby.players.find(p => p.id === playerId)) {
      _currentLobby.players.push({
        id: playerId, displayName, isHost: false, isReady: false
      });
    }
    notifyLobbyUpdate();
    if (isHost()) broadcastSettings(); // Sync new player
  });

  transport.on('mp:lobby:leave', (msg) => {
    if (!_currentLobby) return;
    const { playerId } = msg.payload as { playerId: string };
    _currentLobby.players = _currentLobby.players.filter(p => p.id !== playerId);
    notifyLobbyUpdate();
  });

  transport.on('mp:lobby:ready', (msg) => {
    if (!_currentLobby) return;
    const { playerId, ready } = msg.payload as { playerId: string; ready: boolean };
    const player = _currentLobby.players.find(p => p.id === playerId);
    if (player) player.isReady = ready;
    notifyLobbyUpdate();
  });

  transport.on('mp:lobby:settings', (msg) => {
    if (!_currentLobby || isHost()) return; // Host already has correct state
    const settings = msg.payload as Partial<LobbyState>;
    // Preserve local player ready states — settings broadcasts can arrive
    // after ready messages due to network latency, which would overwrite them.
    if (settings.players && _currentLobby.players) {
      const readyMap = new Map(_currentLobby.players.map(p => [p.id, p.isReady]));
      for (const p of settings.players as LobbyPlayer[]) {
        const localReady = readyMap.get(p.id);
        if (localReady !== undefined) p.isReady = p.isReady || localReady;
      }
    }
    Object.assign(_currentLobby, settings);
    notifyLobbyUpdate();
  });

  transport.on('mp:lobby:start', (msg) => {
    if (!_currentLobby) return;
    const payload = msg.payload as {
      seed: number;
      contentSelection?: LobbyContentSelection;
    };
    // Apply contentSelection BEFORE invoking _onGameStart so the callback
    // always sees the definitive value the host committed at game-start time.
    // This is the authoritative source — mp:lobby:settings may have been lost
    // or reordered relative to mp:lobby:start in high-latency/lossy conditions.
    if (payload.contentSelection !== undefined) {
      _currentLobby.contentSelection = payload.contentSelection;
    }
    _currentLobby.seed = payload.seed;
    _currentLobby.status = 'in_game';
    _onGameStart?.(payload.seed, _currentLobby);
  });

  transport.on('mp:race:progress', (msg) => {
    _onRaceProgress?.(msg.payload as unknown as RaceProgress);
  });

  transport.on('mp:race:finish', (msg) => {
    _onRaceProgress?.(msg.payload as unknown as RaceProgress);
  });
}

function broadcastSettings(): void {
  if (!_currentLobby) return;
  const transport = getMultiplayerTransport();
  transport.send('mp:lobby:settings', {
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
    hasPassword: _currentLobby.hasPassword,
  });
  notifyLobbyUpdate();
}

function generateLobbyId(): string {
  return `lobby_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateLobbyCode(): string {
  // 6-character uppercase alphanumeric code, no I/O/0/1 to avoid visual confusion
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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
 *  1. Steam (hasSteam — Tauri desktop build with Steamworks)
 *  2. BroadcastChannel (?mp URL param — two-tab dev mode, localStorage directory)
 *  3. Web/Fastify (default — mobile, web browser, no Steam)
 */
function pickBackend(): LobbyBackend {
  // `?mp` URL param is an explicit dev opt-in and beats auto-detected Steam.
  // This lets devs running a Steam build two-tab test the broadcast path without
  // uninstalling Steam or fighting the factory's auto-selection.
  if (isBroadcastMode()) return broadcastBackend;
  if (hasSteam) return steamBackend;
  return webBackend;
}

// ── broadcastBackend ──────────────────────────────────────────────────────────

/** localStorage key for the broadcast-mode fake lobby directory. */
const BC_DIRECTORY_KEY = 'rr-mp:directory';
/** Stale-entry TTL: entries older than this are pruned on read. */
const BC_ENTRY_TTL_MS = 30_000;
/** How often the host refreshes its directory entry (ms). */
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
    };

    upsertBroadcastEntry(entry);

    // Start (or restart) the heartbeat — rewrites the entry every 5 s with the
    // current player count so the browser reflects join activity.
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
      throw new Error(`[webBackend] joinLobbyById ${res.status}: ${err.error ?? res.statusText}`);
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
      throw new Error('[steamBackend] createSteamLobby returned null — Steam may be unavailable');
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

    return { lobbyId, lobbyCode };
  },

  async resolveByCode(code: string): Promise<string | null> {
    // Steam has no server-side code->id resolver. For Steam builds the lobby browser
    // provides lobbyId directly. Warn and return null; callers fall back to the
    // code-as-channel-key path (not applicable on Steam, but graceful).
    console.warn(
      `[steamBackend] resolveByCode('${code}') not wired — use joinLobbyById with the lobbyId from the browser screen`,
    );
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

    const ok = await joinSteamLobby(lobbyId);
    if (!ok) throw new Error(`[steamBackend] joinSteamLobby failed for ${lobbyId}`);

    const lobbyCode = (await getLobbyData(lobbyId, 'lobby_code')) ?? '';
    return { lobbyId, lobbyCode };
  },

  async listPublicLobbies(_filter?: LobbyListFilter): Promise<LobbyBrowserEntry[]> {
    // V1 STUB — waiting for Phase 1 Rust binding to expose lobby IDs from callback.
    console.warn('[steamBackend] listPublicLobbies not yet wired — awaiting Phase 1 Rust binding completion');
    // These imports are referenced here to signal intent; wired in the follow-up.
    void requestSteamLobbyList;
    void getLobbyMemberCount;
    return [];
  },
};
