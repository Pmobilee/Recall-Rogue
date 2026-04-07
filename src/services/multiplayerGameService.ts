/**
 * Multiplayer game state synchronization service.
 *
 * Manages in-game state for all multiplayer modes:
 * - Race Mode: progress broadcasting + result comparison
 * - Same Cards: shared fork seeds on top of Race Mode
 * - Real-Time Duel: host-authoritative enemy + simultaneous turns
 * - Co-op: shared enemy + cooperative turn resolution
 *
 * All functions are pure TypeScript — no Phaser, no DOM, no Svelte imports.
 *
 * Turn flow (Duel / Co-op):
 *   1. Host sends mp:duel:turn_start with turnNumber
 *   2. Both players play cards, send mp:duel:cards_played
 *   3. Both quiz — each sends mp:duel:quiz_result
 *   4. Host collects both DuelTurnActions and calls hostResolveTurn()
 *   5. hostResolveTurn() combines damage, applies to enemy, rolls intent,
 *      broadcasts mp:duel:turn_resolve and mp:duel:enemy_state
 *   6. Enemy attacks — target chosen via round-robin, hp applied locally
 *   7. If enemy or player defeated, host sends mp:duel:end
 */

import { getMultiplayerTransport } from './multiplayerTransport';
import { getCurrentLobby } from './multiplayerLobbyService';
import { getRunRng, restoreRunRngState } from './seededRng';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { createEnemy, applyDamageToEnemy, rollNextIntent } from './enemyManager';
import type { MultiplayerMode, RaceProgress, RaceResults } from '../data/multiplayerTypes';

// ── Re-exported Types ─────────────────────────────────────────────────────────

/**
 * Duel turn action submitted by each player.
 * Collected by the host before resolving the turn.
 */
export interface DuelTurnAction {
  playerId: string;
  cardsPlayed: Array<{
    cardId: string;
    mechanicId?: string;
    wasCharged: boolean;
    chargeCorrect?: boolean;
    factId?: string;
    selectedAnswer?: string;
    timingMs?: number;
  }>;
  blockGained: number;
  /** Damage the player dealt to the shared enemy this turn. */
  damageDealt: number;
  chainLength: number;
}

/**
 * Authoritative turn resolution computed by the host.
 * Broadcast to both players so they can update local state identically.
 */
export interface DuelTurnResolution {
  turnNumber: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyBlock: number;
  /** Enemy's next declared intent (after resolving this turn). */
  enemyIntent: { type: string; value: number; targetPlayerId: string };
  /** Damage the host-side player dealt. */
  player1Damage: number;
  /** Damage the guest-side player dealt. */
  player2Damage: number;
  /** Remaining HP for host-side player after enemy attack. */
  player1Hp: number;
  /** Remaining HP for guest-side player after enemy attack. */
  player2Hp: number;
  /** Running totals of damage contributed per player across all turns. */
  totalDamageByPlayer: Record<string, number>;
  isOver: boolean;
  winnerId?: string;
  reason?: 'enemy_defeated' | 'player_defeated' | 'both_defeated' | 'timeout';
}

/**
 * Snapshot of the shared enemy, broadcast whenever the host mutates it.
 * Clients use this to update their local rendering/UI.
 */
export interface SharedEnemyState {
  templateId: string;
  currentHp: number;
  maxHp: number;
  block: number;
  nextIntent: { type: string; value: number; targetPlayerId: string };
  statusEffects: Array<{ type: string; value: number; turnsRemaining: number }>;
  phase: number;
}

// ── Race Mode ─────────────────────────────────────────────────────────────────

/** Interval handle for the 0.5 Hz progress broadcast loop. */
let _raceProgressInterval: ReturnType<typeof setInterval> | null = null;

/** Latest snapshot received from the opponent. */
let _opponentProgress: RaceProgress | null = null;

/** Latest local progress snapshot (updated by caller via updateLocalProgress). */
let _localProgress: RaceProgress | null = null;

/** Callback invoked whenever a new opponent progress message arrives. */
let _onOpponentProgress: ((p: RaceProgress) => void) | null = null;

/** Callback invoked when both players have finished and results are ready. */
let _onRaceComplete: ((r: RaceResults) => void) | null = null;

/** Whether the local race completion has already been handled. */
let _localFinished = false;
/** Timestamp when local player finished, used to compute duration. */
let _localStartMs = 0;

/**
 * Start broadcasting race progress at 0.5 Hz (every 2 seconds).
 *
 * @param getProgress - Called each interval to snapshot the current state.
 * @returns Cleanup function — call it when the encounter ends.
 */
export function startRaceProgressBroadcast(getProgress: () => RaceProgress): () => void {
  _localStartMs = Date.now();
  _localFinished = false;

  stopRaceProgressBroadcast();

  _raceProgressInterval = setInterval(() => {
    const progress = getProgress();
    _localProgress = progress;

    const transport = getMultiplayerTransport();
    transport.send('mp:race:progress', progress as unknown as Record<string, unknown>);

    // Detect local finish and potentially emit race results
    if (progress.isFinished && !_localFinished) {
      _localFinished = true;
      transport.send('mp:race:finish', progress as unknown as Record<string, unknown>);
      _tryEmitRaceResults();
    }
  }, 2000);

  return stopRaceProgressBroadcast;
}

/** Stop the broadcast loop without destroying other state. */
export function stopRaceProgressBroadcast(): void {
  if (_raceProgressInterval !== null) {
    clearInterval(_raceProgressInterval);
    _raceProgressInterval = null;
  }
}

/**
 * Push a local progress snapshot immediately (e.g. on encounter-end).
 * Separate from the interval so callers can trigger an instant update.
 */
export function updateLocalProgress(progress: RaceProgress): void {
  _localProgress = progress;

  if (progress.isFinished && !_localFinished) {
    _localFinished = true;
    const transport = getMultiplayerTransport();
    transport.send('mp:race:finish', progress as unknown as Record<string, unknown>);
    _tryEmitRaceResults();
  }
}

/** Return the opponent's most recent progress snapshot, or null if none received yet. */
export function getOpponentProgress(): RaceProgress | null {
  return _opponentProgress;
}

/**
 * Register a callback that fires whenever the opponent's progress updates.
 * Returns an unsubscribe function.
 */
export function onOpponentProgressUpdate(cb: (p: RaceProgress) => void): () => void {
  _onOpponentProgress = cb;
  return () => { _onOpponentProgress = null; };
}

/**
 * Register a callback that fires once when both players have finished.
 * Returns an unsubscribe function.
 */
export function onRaceComplete(cb: (r: RaceResults) => void): () => void {
  _onRaceComplete = cb;
  return () => { _onRaceComplete = null; };
}

/**
 * Compute and emit RaceResults when both players have finished.
 *
 * Scoring formula (AR-86):
 *   score = (floors * 100) + (damage * 1) + (chainMultiplier * 50)
 *         + (correct * 10) - (wrong * 5) + (perfectEncounters * 200)
 *
 * The `score` field on RaceProgress already incorporates this formula
 * (computed by the caller's game loop). We use it directly.
 */
function _tryEmitRaceResults(): void {
  if (!_localProgress?.isFinished || !_opponentProgress?.isFinished) return;
  if (!_onRaceComplete) return;

  const lobby = getCurrentLobby();
  const localScore = _localProgress.score;
  const opponentScore = _opponentProgress.score;

  const localId = _localProgress.playerId;
  const opponentId = _opponentProgress.playerId;

  // Find display names from lobby if available
  const localPlayer = lobby?.players.find(p => p.id === localId);
  const opponentPlayer = lobby?.players.find(p => p.id === opponentId);

  // Total facts derived from accuracy and encountersWon as a proxy
  // (real counts come from RaceProgress fields if provided)
  const localCorrect = _localProgress.encountersWon * 3; // rough proxy
  const localWrong = Math.round((1 - _localProgress.accuracy) / Math.max(_localProgress.accuracy, 0.01) * localCorrect);
  const opponentCorrect = _opponentProgress.encountersWon * 3;
  const opponentWrong = Math.round((1 - _opponentProgress.accuracy) / Math.max(_opponentProgress.accuracy, 0.01) * opponentCorrect);

  const durationMs = Date.now() - _localStartMs;

  const results: RaceResults = {
    players: [
      {
        playerId: localId,
        displayName: localPlayer?.displayName ?? localId,
        score: localScore,
        floorReached: _localProgress.floor,
        accuracy: _localProgress.accuracy,
        factsAnswered: localCorrect + localWrong,
        correctAnswers: localCorrect,
        duration: durationMs,
        result: _localProgress.result ?? 'defeat',
      },
      {
        playerId: opponentId,
        displayName: opponentPlayer?.displayName ?? opponentId,
        score: opponentScore,
        floorReached: _opponentProgress.floor,
        accuracy: _opponentProgress.accuracy,
        factsAnswered: opponentCorrect + opponentWrong,
        correctAnswers: opponentCorrect,
        duration: durationMs, // opponent duration not directly available
        result: _opponentProgress.result ?? 'defeat',
      },
    ],
    winnerId: localScore >= opponentScore ? localId : opponentId,
    seed: lobby?.seed ?? 0,
  };

  _onRaceComplete(results);
}

// ── Same Cards Mode ───────────────────────────────────────────────────────────

/**
 * Fork labels that must be shared between clients in Same Cards mode.
 * These subsystems produce card draws and fact assignments — sharing their
 * seeds ensures both players see identical hands and facts.
 */
export const SAME_CARDS_FORK_LABELS = [
  'deck',
  'hand',
  'factAssignment',
  'cardReward',
  'shopInventory',
] as const;

/**
 * Broadcast this client's fork seeds to the opponent.
 * Call this on game start when mode === 'same_cards' and isHost === true.
 *
 * @param seeds - Record mapping fork label → internal PRNG state number.
 */
export function broadcastForkSeeds(seeds: Record<string, number>): void {
  const transport = getMultiplayerTransport();
  transport.send('mp:sync', { type: 'fork_seeds', seeds });
}

/**
 * Apply fork seeds received from the host so this client's RNG matches.
 * Restores the named forks at the exact PRNG positions the host had.
 *
 * @param seeds - Record mapping fork label → internal PRNG state number.
 */
export function applyReceivedForkSeeds(seeds: Record<string, number>): void {
  // Reconstruct the forks at the positions the host sent —
  // root RNG state is irrelevant since we only override named forks
  const currentState = { seed: 0, forks: seeds };
  restoreRunRngState(currentState);
}

/**
 * Collect fork seeds for the Same Cards labels from the active run RNG.
 * Call this AFTER initRunRng() so the forks are already derived from the seed.
 *
 * @returns Record of label → PRNG state for broadcasting.
 */
export function collectForkSeeds(): Record<string, number> {
  const seeds: Record<string, number> = {};
  for (const label of SAME_CARDS_FORK_LABELS) {
    // getRunRng creates and caches the fork if not yet accessed
    seeds[label] = getRunRng(label).getState();
  }
  return seeds;
}

// ── Real-Time Duel ────────────────────────────────────────────────────────────

/** Internal duel session state, owned by the host for resolution logic. */
interface DuelSession {
  isHost: boolean;
  localPlayerId: string;
  opponentId: string;
  /** Monotonically increasing turn counter (matches DuelTurnResolution.turnNumber). */
  turnNumber: number;
  /** Shared enemy managed by host. Null on client until first mp:duel:enemy_state. */
  sharedEnemy: import('../data/enemies').EnemyInstance | null;
  /** This client's action for the current turn. */
  localAction: DuelTurnAction | null;
  /** Opponent's action for the current turn. */
  opponentAction: DuelTurnAction | null;
  /** Cumulative damage totals per player ID, carried across turns. */
  totalDamage: Record<string, number>;
  /** Timer handle for auto-resolve when a player's submission times out. */
  turnTimer: ReturnType<typeof setTimeout> | null;
  /**
   * Player ID who the enemy attacks this turn (alternates round-robin).
   * Host initialises to opponentId so local player is targeted on even turns.
   */
  targetPlayerId: string;
  /** Current HP values so host can track player defeats. */
  playerHp: Record<string, number>;
}

let _duelState: DuelSession | null = null;

/** Callbacks registered by game scene consumers. */
let _onTurnResolved: ((r: DuelTurnResolution) => void) | null = null;
let _onEnemyStateUpdate: ((e: SharedEnemyState) => void) | null = null;
let _onDuelEnd: ((resolution: DuelTurnResolution) => void) | null = null;

/**
 * Initialize duel state at game start.
 * Must be called before hostCreateSharedEnemy or submitDuelTurnAction.
 *
 * @param isHost - Whether this client is the authoritative host.
 * @param localPlayerId - Local player's ID.
 * @param opponentId - Opponent's player ID.
 */
export function initDuel(isHost: boolean, localPlayerId: string, opponentId: string): void {
  _duelState = {
    isHost,
    localPlayerId,
    opponentId,
    turnNumber: 0,
    sharedEnemy: null,
    localAction: null,
    opponentAction: null,
    totalDamage: { [localPlayerId]: 0, [opponentId]: 0 },
    turnTimer: null,
    targetPlayerId: opponentId, // enemy targets opponent first
    playerHp: {},
  };
}

/**
 * Host: create the shared enemy from a template and broadcast its initial state.
 *
 * HP is scaled for 2-player co-op by applying a 1.5× multiplier so the fight
 * remains challenging with combined DPS.
 *
 * @param templateId - The enemy template ID to look up in ENEMY_TEMPLATES.
 * @param floor - Current floor number for HP scaling.
 * @param playerCount - Number of players (scales HP accordingly).
 */
export function hostCreateSharedEnemy(templateId: string, floor: number, playerCount: number): void {
  if (!_duelState?.isHost) return;

  const template = ENEMY_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    console.error(`[multiplayerGameService] hostCreateSharedEnemy: unknown template "${templateId}"`);
    return;
  }

  // Co-op HP scaling: each additional player adds 50% base HP
  const hpMultiplier = 1 + (playerCount - 1) * 0.5;
  _duelState.sharedEnemy = createEnemy(template, floor, { hpMultiplier });

  _broadcastEnemyState();
}

/**
 * Submit the local player's turn action.
 * If host and both actions are now ready, resolves the turn automatically.
 *
 * @param action - The local player's aggregated turn results.
 */
export function submitDuelTurnAction(action: DuelTurnAction): void {
  if (!_duelState) return;

  _duelState.localAction = action;

  const transport = getMultiplayerTransport();
  transport.send('mp:duel:cards_played', action as unknown as Record<string, unknown>);

  // Host resolves as soon as both sides have submitted
  if (_duelState.isHost && _duelState.opponentAction) {
    hostResolveTurn();
  }
}

/**
 * Host-only: resolve the current turn once both players have submitted.
 *
 * Combines damage from both players, applies to enemy (block first → HP),
 * rolls the next enemy intent with round-robin targeting, updates player HP
 * from enemy attack, checks win/lose conditions, and broadcasts the resolution.
 *
 * @returns The DuelTurnResolution, or null if preconditions not met.
 */
export function hostResolveTurn(): DuelTurnResolution | null {
  if (!_duelState?.isHost) return null;
  if (!_duelState.localAction || !_duelState.opponentAction) return null;
  if (!_duelState.sharedEnemy) return null;

  const { localPlayerId, opponentId, sharedEnemy } = _duelState;
  const p1Action = _duelState.localAction;
  const p2Action = _duelState.opponentAction;

  // Accumulate total damage
  _duelState.totalDamage[p1Action.playerId] = (_duelState.totalDamage[p1Action.playerId] ?? 0) + p1Action.damageDealt;
  _duelState.totalDamage[p2Action.playerId] = (_duelState.totalDamage[p2Action.playerId] ?? 0) + p2Action.damageDealt;

  const combinedDamage = p1Action.damageDealt + p2Action.damageDealt;
  const { defeated } = applyDamageToEnemy(sharedEnemy, combinedDamage);

  _duelState.turnNumber++;

  let isOver = false;
  let winnerId: string | undefined;
  let reason: DuelTurnResolution['reason'];

  if (defeated) {
    isOver = true;
    // Winner is the player who dealt more total damage
    const p1Total = _duelState.totalDamage[localPlayerId] ?? 0;
    const p2Total = _duelState.totalDamage[opponentId] ?? 0;
    winnerId = p1Total >= p2Total ? localPlayerId : opponentId;
    reason = 'enemy_defeated';
  }

  // Roll next intent with round-robin targeting
  const nextTarget = _duelState.targetPlayerId;
  rollNextIntent(sharedEnemy);
  // Alternate target for the next turn
  _duelState.targetPlayerId = (nextTarget === localPlayerId) ? opponentId : localPlayerId;

  // Apply enemy attack to the target player's HP
  let p1Hp = _duelState.playerHp[localPlayerId] ?? 80; // default starting HP
  let p2Hp = _duelState.playerHp[opponentId] ?? 80;

  if (!isOver && sharedEnemy.nextIntent.type === 'attack') {
    const attackValue = sharedEnemy.nextIntent.value;
    if (nextTarget === localPlayerId) {
      p1Hp = Math.max(0, p1Hp - attackValue);
    } else {
      p2Hp = Math.max(0, p2Hp - attackValue);
    }
    _duelState.playerHp[localPlayerId] = p1Hp;
    _duelState.playerHp[opponentId] = p2Hp;

    const p1Dead = p1Hp <= 0;
    const p2Dead = p2Hp <= 0;
    if (p1Dead || p2Dead) {
      isOver = true;
      if (p1Dead && p2Dead) {
        reason = 'both_defeated';
        // In this edge case, higher total damage wins
        const p1Total = _duelState.totalDamage[localPlayerId] ?? 0;
        const p2Total = _duelState.totalDamage[opponentId] ?? 0;
        winnerId = p1Total >= p2Total ? localPlayerId : opponentId;
      } else if (p1Dead) {
        reason = 'player_defeated';
        winnerId = opponentId;
      } else {
        reason = 'player_defeated';
        winnerId = localPlayerId;
      }
    }
  }

  const resolution: DuelTurnResolution = {
    turnNumber: _duelState.turnNumber,
    enemyHp: sharedEnemy.currentHP,
    enemyMaxHp: sharedEnemy.maxHP,
    enemyBlock: sharedEnemy.block,
    enemyIntent: {
      type: sharedEnemy.nextIntent.type,
      value: sharedEnemy.nextIntent.value,
      targetPlayerId: nextTarget,
    },
    player1Damage: p1Action.damageDealt,
    player2Damage: p2Action.damageDealt,
    player1Hp: p1Hp,
    player2Hp: p2Hp,
    totalDamageByPlayer: { ..._duelState.totalDamage },
    isOver,
    winnerId,
    reason,
  };

  // Reset turn actions for next turn
  _duelState.localAction = null;
  _duelState.opponentAction = null;

  // Broadcast to opponent
  const transport = getMultiplayerTransport();
  transport.send('mp:duel:turn_resolve', resolution as unknown as Record<string, unknown>);
  _broadcastEnemyState();

  if (isOver) {
    transport.send('mp:duel:end', resolution as unknown as Record<string, unknown>);
    _onDuelEnd?.(resolution);
  }

  _onTurnResolved?.(resolution);
  return resolution;
}

/**
 * Register a callback that fires when a duel turn is resolved.
 * Called on both host and client (host immediately, client after receiving mp:duel:turn_resolve).
 *
 * @returns Unsubscribe function.
 */
export function onTurnResolved(cb: (resolution: DuelTurnResolution) => void): () => void {
  _onTurnResolved = cb;
  return () => { _onTurnResolved = null; };
}

/**
 * Register a callback that fires whenever the shared enemy's state is updated.
 *
 * @returns Unsubscribe function.
 */
export function onEnemyStateUpdate(cb: (enemy: SharedEnemyState) => void): () => void {
  _onEnemyStateUpdate = cb;
  return () => { _onEnemyStateUpdate = null; };
}

/**
 * Register a callback that fires when the duel ends (any reason).
 *
 * @returns Unsubscribe function.
 */
export function onDuelEnd(cb: (resolution: DuelTurnResolution) => void): () => void {
  _onDuelEnd = cb;
  return () => { _onDuelEnd = null; };
}

/**
 * Tear down duel state. Call when leaving the combat scene.
 * Cancels any pending turn timer.
 */
export function destroyDuel(): void {
  if (_duelState && _duelState.turnTimer !== null) {
    clearTimeout(_duelState.turnTimer!);
  }
  _duelState = null;
  _onTurnResolved = null;
  _onEnemyStateUpdate = null;
  _onDuelEnd = null;
}

// ── Message Routing ───────────────────────────────────────────────────────────

/**
 * Wire up transport message handlers for the active game mode.
 * Returns a cleanup function — call it when the encounter ends.
 *
 * @param mode - The multiplayer mode governing which handlers to install.
 */
export function initGameMessageHandlers(mode: MultiplayerMode): () => void {
  const transport = getMultiplayerTransport();
  const cleanups: (() => void)[] = [];

  // ── Race Mode handlers ────────────────────────────────────────────────────

  cleanups.push(transport.on('mp:race:progress', (msg) => {
    _opponentProgress = msg.payload as unknown as RaceProgress;
    _onOpponentProgress?.(_opponentProgress);
  }));

  cleanups.push(transport.on('mp:race:finish', (msg) => {
    _opponentProgress = msg.payload as unknown as RaceProgress;
    _onOpponentProgress?.(_opponentProgress);
    _tryEmitRaceResults();
  }));

  // ── Same Cards seed exchange ───────────────────────────────────────────────

  if (mode === 'same_cards') {
    cleanups.push(transport.on('mp:sync', (msg) => {
      const payload = msg.payload as { type?: string; seeds?: Record<string, number> };
      if (payload.type === 'fork_seeds' && payload.seeds) {
        applyReceivedForkSeeds(payload.seeds);
      }
    }));
  }

  // ── Duel / Co-op handlers ─────────────────────────────────────────────────

  if (mode === 'duel' || mode === 'coop') {
    // Host sends turn_start to signal that both players should draw and play
    cleanups.push(transport.on('mp:duel:turn_start', (msg) => {
      const payload = msg.payload as { turnNumber: number };
      if (_duelState) {
        _duelState.turnNumber = payload.turnNumber - 1; // host sets canonical number
        _duelState.localAction = null;
        _duelState.opponentAction = null;
      }
    }));

    // Opponent submitted their cards_played — host stores and may resolve
    cleanups.push(transport.on('mp:duel:cards_played', (msg) => {
      if (!_duelState) return;
      const action = msg.payload as unknown as DuelTurnAction;
      _duelState.opponentAction = action;

      // Host resolves once both sides have submitted
      if (_duelState.isHost && _duelState.localAction) {
        hostResolveTurn();
      }
    }));

    // quiz_result enriches the action; actual resolution waits for cards_played
    cleanups.push(transport.on('mp:duel:quiz_result', (_msg) => {
      // Quiz results are folded into DuelTurnAction by the submitting client.
      // This event is informational for UI overlays only.
    }));

    // Client receives the host's authoritative resolution
    cleanups.push(transport.on('mp:duel:turn_resolve', (msg) => {
      if (_duelState?.isHost) return; // host already handled this in hostResolveTurn()
      const resolution = msg.payload as unknown as DuelTurnResolution;
      _onTurnResolved?.(resolution);
    }));

    // Updated shared enemy state from host
    cleanups.push(transport.on('mp:duel:enemy_state', (msg) => {
      const enemyState = msg.payload as unknown as SharedEnemyState;
      _onEnemyStateUpdate?.(enemyState);
    }));

    // Duel ended
    cleanups.push(transport.on('mp:duel:end', (msg) => {
      const resolution = msg.payload as unknown as DuelTurnResolution;
      if (!_duelState?.isHost) {
        // Client receives final resolution from host
        _onDuelEnd?.(resolution);
      }
    }));
  }

  return () => cleanups.forEach(fn => fn());
}

/**
 * Destroy all multiplayer game state.
 * Call when leaving multiplayer entirely (returning to hub, connection lost, etc.).
 */
export function destroyMultiplayerGame(): void {
  stopRaceProgressBroadcast();
  _opponentProgress = null;
  _localProgress = null;
  _localFinished = false;
  _localStartMs = 0;
  _onOpponentProgress = null;
  _onRaceComplete = null;

  destroyDuel();
}

// ── Private Helpers ───────────────────────────────────────────────────────────

/**
 * Serialise and broadcast the shared enemy's current state to the opponent.
 * Host-only. Called after any mutation of _duelState.sharedEnemy.
 */
function _broadcastEnemyState(): void {
  if (!_duelState?.isHost || !_duelState.sharedEnemy) return;

  const enemy = _duelState.sharedEnemy;
  const snapshot: SharedEnemyState = {
    templateId: enemy.template.id,
    currentHp: enemy.currentHP,
    maxHp: enemy.maxHP,
    block: enemy.block,
    nextIntent: {
      type: enemy.nextIntent.type,
      value: enemy.nextIntent.value,
      targetPlayerId: _duelState.targetPlayerId,
    },
    statusEffects: enemy.statusEffects.map(se => ({
      type: se.type as string,
      value: se.value,
      turnsRemaining: se.turnsRemaining,
    })),
    phase: enemy.phase,
  };

  const transport = getMultiplayerTransport();
  transport.send('mp:duel:enemy_state', snapshot as unknown as Record<string, unknown>);

  // Also notify local listeners immediately
  _onEnemyStateUpdate?.(snapshot);
}

// ── Duel Host Utilities ───────────────────────────────────────────────────────

/**
 * Host: signal the start of a new turn to both players.
 * Increments the canonical turn counter and sends mp:duel:turn_start.
 * Call after the previous turn's resolution has been broadcast.
 */
export function hostStartNextTurn(): void {
  if (!_duelState?.isHost) return;
  _duelState.turnNumber++;
  _duelState.localAction = null;
  _duelState.opponentAction = null;

  const transport = getMultiplayerTransport();
  transport.send('mp:duel:turn_start', { turnNumber: _duelState.turnNumber });
}

/**
 * Set the known HP for a player so the host can track defeat conditions.
 * Call whenever player HP changes locally (damage taken, healing).
 *
 * @param playerId - The player whose HP to record.
 * @param hp - Current HP value.
 */
export function setPlayerHpForHost(playerId: string, hp: number): void {
  if (!_duelState) return;
  _duelState.playerHp[playerId] = hp;
}

/**
 * Send this player's quiz result so the opponent's UI can react in real-time.
 * Does not affect turn resolution — that uses submitDuelTurnAction.
 *
 * @param factId - The fact ID that was quizzed.
 * @param correct - Whether the answer was correct.
 * @param timingMs - Time taken to answer in milliseconds.
 */
export function sendDuelQuizResult(factId: string, correct: boolean, timingMs: number): void {
  const transport = getMultiplayerTransport();
  transport.send('mp:duel:quiz_result', { factId, correct, timingMs });
}
