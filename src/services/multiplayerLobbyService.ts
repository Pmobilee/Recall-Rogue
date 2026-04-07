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
 *   5. Host starts game (startGame) → shared seed generated and distributed
 *
 * Two-tab local testing:
 *   Add `?mp` to the URL in both tabs to activate BroadcastChannel transport.
 *   No server or Steam required. See docs/mechanics/multiplayer.md.
 */

import { getMultiplayerTransport, destroyMultiplayerTransport, createLocalTransportPair, LocalMultiplayerTransport } from "./multiplayerTransport";
import type {
  LobbyState, LobbyPlayer, MultiplayerMode, DeckSelectionMode,
  HouseRules, RaceProgress, RaceResults, LobbyContentSelection
} from '../data/multiplayerTypes';
import { DEFAULT_HOUSE_RULES, MODE_MAX_PLAYERS } from '../data/multiplayerTypes';

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

/** Transport for the local bot player, if one is active. Dev-only. */
let _botTransport: LocalMultiplayerTransport | null = null;

/** Get the current lobby state (null if not in a lobby) */
export function getCurrentLobby(): LobbyState | null { return _currentLobby; }

/** Check if local player is the host */
export function isHost(): boolean {
  return _currentLobby?.hostId === _localPlayerId;
}

// ── Lobby Lifecycle ──────────────────────────────────────────────────────────

/** Create a new lobby as host */
export function createLobby(playerId: string, displayName: string, mode: MultiplayerMode): LobbyState {
  _localPlayerId = playerId;
  const lobbyId = generateLobbyId();
  const lobbyCode = generateLobbyCode();

  _currentLobby = {
    lobbyId,
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
    maxPlayers: MODE_MAX_PLAYERS[mode],
    isRanked: false,
    lobbyCode,
    status: 'waiting',
  };

  // Use BroadcastChannel transport when ?mp param is present (two-tab dev testing),
  // otherwise fall back to the default platform transport (Steam P2P or WebSocket).
  // BroadcastChannel uses lobbyCode as the channel key (shared with joiner);
  // other transports use the full lobbyId.
  const broadcast = isBroadcastMode();
  const transport = getMultiplayerTransport(broadcast ? 'broadcast' : 'auto');
  transport.connect(broadcast ? lobbyCode : lobbyId, playerId);
  setupMessageHandlers();

  return _currentLobby;
}

/** Join an existing lobby by code */
export function joinLobby(lobbyCode: string, playerId: string, displayName: string): void {
  _localPlayerId = playerId;
  // Use BroadcastChannel transport when ?mp param is present (two-tab dev testing).
  // The joiner connects using the lobby CODE as the channel name so it matches
  // what the host used when it called connect(lobbyId, ...) — but for broadcast
  // mode the host also uses lobbyCode as the shared rendezvous key.
  const transport = getMultiplayerTransport(isBroadcastMode() ? 'broadcast' : 'auto');
  transport.connect(lobbyCode, playerId);
  transport.send('mp:lobby:join', { playerId, displayName, lobbyCode });
  setupMessageHandlers();
}

/** Leave the current lobby */
export function leaveLobby(): void {
  if (!_currentLobby) return;
  const transport = getMultiplayerTransport();
  transport.send('mp:lobby:leave', { playerId: _localPlayerId });
  destroyMultiplayerTransport();
  _currentLobby = null;
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
  _onLobbyUpdate?.(_currentLobby);

  // Auto-ready the bot after a brief delay
  setTimeout(() => {
    if (!_currentLobby) return;
    const bot = _currentLobby.players.find(p => p.id === botId);
    if (bot) {
      bot.isReady = true;
      _onLobbyUpdate?.(_currentLobby);
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
  _onLobbyUpdate?.(_currentLobby);
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
  }
}

/** Check if all players are ready (2+ players, all ready) */
export function allReady(): boolean {
  if (!_currentLobby) return false;
  return _currentLobby.players.length >= 2 &&
         _currentLobby.players.every(p => p.isReady);
}

/** Start the game (host only, requires allReady) */
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
    _onLobbyUpdate?.(_currentLobby);
    if (isHost()) broadcastSettings(); // Sync new player
  });

  transport.on('mp:lobby:leave', (msg) => {
    if (!_currentLobby) return;
    const { playerId } = msg.payload as { playerId: string };
    _currentLobby.players = _currentLobby.players.filter(p => p.id !== playerId);
    _onLobbyUpdate?.(_currentLobby);
  });

  transport.on('mp:lobby:ready', (msg) => {
    if (!_currentLobby) return;
    const { playerId, ready } = msg.payload as { playerId: string; ready: boolean };
    const player = _currentLobby.players.find(p => p.id === playerId);
    if (player) player.isReady = ready;
    _onLobbyUpdate?.(_currentLobby);
  });

  transport.on('mp:lobby:settings', (msg) => {
    if (!_currentLobby || isHost()) return; // Host already has correct state
    const settings = msg.payload as Partial<LobbyState>;
    Object.assign(_currentLobby, settings);
    _onLobbyUpdate?.(_currentLobby);
  });

  transport.on('mp:lobby:start', (msg) => {
    if (!_currentLobby) return;
    const { seed } = msg.payload as { seed: number };
    _currentLobby.seed = seed;
    _currentLobby.status = 'in_game';
    _onGameStart?.(seed, _currentLobby);
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
  });
  _onLobbyUpdate?.(_currentLobby);
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
