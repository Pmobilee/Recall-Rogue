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
 */

import { getMultiplayerTransport, destroyMultiplayerTransport } from './multiplayerTransport';
import type {
  LobbyState, LobbyPlayer, MultiplayerMode, DeckSelectionMode,
  HouseRules, RaceProgress, RaceResults
} from '../data/multiplayerTypes';
import { DEFAULT_HOUSE_RULES, MODE_MAX_PLAYERS } from '../data/multiplayerTypes';

// ── Lobby State ──────────────────────────────────────────────────────────────

let _currentLobby: LobbyState | null = null;
let _localPlayerId: string = '';
let _onLobbyUpdate: ((lobby: LobbyState) => void) | null = null;
let _onGameStart: ((seed: number, lobby: LobbyState) => void) | null = null;
let _onRaceProgress: ((progress: RaceProgress) => void) | null = null;
let _onRaceResults: ((results: RaceResults) => void) | null = null;

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

  // Connect transport and listen for messages
  const transport = getMultiplayerTransport();
  transport.connect(lobbyId, playerId);
  setupMessageHandlers();

  return _currentLobby;
}

/** Join an existing lobby by code */
export function joinLobby(lobbyCode: string, playerId: string, displayName: string): void {
  _localPlayerId = playerId;
  // Send join request through transport
  const transport = getMultiplayerTransport();
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
