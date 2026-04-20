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
import {
  applyEloResult,
  getLocalMultiplayerRating,
  persistLocalMultiplayerRating,
} from './multiplayerElo';
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
  enemyIntent: { type: string; value: number; targetPlayerId: string | 'all' };
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
  /**
   * ID of the winning player, or null when both players are defeated simultaneously
   * (reason === 'both_defeated'). Result consumers must treat null as "Tie".
   */
  winnerId: string | null;
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
  nextIntent: { type: string; value: number; targetPlayerId: string | 'all' };
  statusEffects: Array<{ type: string; value: number; turnsRemaining: number }>;
  phase: number;
}

// ── Race Mode ─────────────────────────────────────────────────────────────────

/** Interval handle for the 0.5 Hz progress broadcast loop. */
let _raceProgressInterval: ReturnType<typeof setInterval> | null = null;

/** Whether the broadcast loop is still logically active. */
let _raceProgressActive = false;

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
/** Timestamp when local player started the race. */
let _localStartMs = 0;

/**
 * Local player ID for the current race/duel session.
 * Set by initRaceMode() so _tryEmitRaceResults() knows which side "we" are.
 */
let _raceLocalPlayerId: string = '';

/**
 * Correct fact IDs collected during the race for FSRS batch update on finish.
 * Populated by recordRaceAnswer().
 */
let _raceCorrectFactIds: string[] = [];

/**
 * Wrong fact IDs collected during the race for FSRS batch update on finish.
 * Populated by recordRaceAnswer().
 */
let _raceWrongFactIds: string[] = [];

/**
 * Initialise race-mode accumulators.
 *
 * MUST be called before beginning a new race run (createLobby / joinLobby
 * start path, before the countdown ends). Clears _raceCorrectFactIds and
 * _raceWrongFactIds so back-to-back races do not leak fact answers from the
 * previous run into the next FSRS batch.
 *
 * Also stores the local player ID so _tryEmitRaceResults() can determine the
 * Elo outcome direction at race end.
 *
 * @param localPlayerId - The local player's ID for this race session.
 */
export function initRaceMode(localPlayerId: string): void {
  _raceLocalPlayerId = localPlayerId;
  _raceCorrectFactIds = [];
  _raceWrongFactIds = [];
  _opponentProgress = null;
  _localProgress = null;
  _localFinished = false;
  _localStartMs = 0;
}

/**
 * Start broadcasting race progress at 0.5 Hz (every 2 seconds).
 *
 * Returns an object with a `stop()` cleanup method and an `isActive` getter.
 * The returned `stop()` function (backward-compat: also callable directly as a fn)
 * flips `isActive` to false immediately — interval ticks that fire after cleanup
 * become no-ops instead of calling getProgress() on a destroyed object.
 *
 * @param getProgress - Called each interval to snapshot the current state.
 * @returns `{ stop, isActive }` — call stop() when the encounter ends.
 */
export function startRaceProgressBroadcast(
  getProgress: () => RaceProgress,
): { stop: () => void; isActive: () => boolean } & (() => void) {
  _localStartMs = Date.now();
  _localFinished = false;
  _raceCorrectFactIds = [];
  _raceWrongFactIds = [];

  stopRaceProgressBroadcast();
  _raceProgressActive = true;

  _raceProgressInterval = setInterval(() => {
    // Guard: if active flag was flipped before this tick fires, become a no-op.
    if (!_raceProgressActive) return;

    const progress = getProgress();
    _localProgress = progress;

    const transport = getMultiplayerTransport();
    transport.send('mp:race:progress', progress as unknown as Record<string, unknown>);

    // Detect local finish and potentially emit race results
    if (progress.isFinished && !_localFinished) {
      _localFinished = true;
      // Stamp finishedAt at the moment isFinished flips true
      const finishedProgress: RaceProgress = { ...progress, finishedAt: Date.now() };
      _localProgress = finishedProgress;
      transport.send('mp:race:finish', finishedProgress as unknown as Record<string, unknown>);
      _applyRaceFsrsBatch();
      _tryEmitRaceResults();
    }
  }, 2000);

  const stop = stopRaceProgressBroadcast;

  // Return a callable function (backward compat) that also exposes .stop / .isActive
  const result = Object.assign(stop, {
    stop,
    isActive: () => _raceProgressActive,
  });
  return result;
}

/** Stop the broadcast loop without destroying other state. */
export function stopRaceProgressBroadcast(): void {
  _raceProgressActive = false;
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
    // Stamp finishedAt at the moment isFinished flips true
    const finishedProgress: RaceProgress = { ...progress, finishedAt: Date.now() };
    _localProgress = finishedProgress;
    const transport = getMultiplayerTransport();
    transport.send('mp:race:finish', finishedProgress as unknown as Record<string, unknown>);
    _applyRaceFsrsBatch();
    _tryEmitRaceResults();
  }
}

/**
 * Record a quiz answer during a race run.
 * Call this on each quiz answer so that FSRS can be batch-updated on race finish.
 *
 * @param factId  - The fact ID that was answered.
 * @param correct - Whether the answer was correct.
 */
export function recordRaceAnswer(factId: string, correct: boolean): void {
  if (correct) {
    _raceCorrectFactIds.push(factId);
    // Remove from wrong list if previously wrong (last answer wins)
    _raceWrongFactIds = _raceWrongFactIds.filter(id => id !== factId);
  } else {
    _raceWrongFactIds.push(factId);
    // Remove from correct list if previously correct
    _raceCorrectFactIds = _raceCorrectFactIds.filter(id => id !== factId);
  }
}

/**
 * Apply a one-shot FSRS batch update when the race finishes.
 *
 * Calls the playerData store's updateReviewState (via dynamic import to avoid circular
 * deps since gameFlowController already imports from playerData). This mirrors how the
 * single-player run applies FSRS updates at answer-time — but we batch them here
 * because race answers happen concurrently with broadcast and we want a single
 * write at race-end.
 *
 * TODO(H6-fsrs-wire): If the dynamic import path changes, update the import below.
 * Current path: src/ui/stores/playerData.ts — exports `updateReviewState(factId, correct)`.
 */
async function _applyRaceFsrsBatch(): Promise<void> {
  const correctIds = [..._raceCorrectFactIds];
  const wrongIds = [..._raceWrongFactIds];

  if (correctIds.length === 0 && wrongIds.length === 0) return;

  try {
    // Dynamic import to avoid circular dependency (multiplayerGameService ← gameFlowController ← playerData)
    const { updateReviewState } = await import('../ui/stores/playerData');
    for (const factId of correctIds) {
      updateReviewState(factId, true);
    }
    for (const factId of wrongIds) {
      updateReviewState(factId, false);
    }
  } catch (err) {
    // Non-fatal: FSRS batch update failed. Log but don't crash the race results flow.
    console.warn(
      `[multiplayerGameService] FSRS batch update failed — race results unaffected.` +
      ` correct=${correctIds.length} wrong=${wrongIds.length}`,
      err,
    );
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
 * Input stats for mode-specific score computation.
 * All fields are optional so callers can pass only what's available for their mode.
 */
export interface ModeScoreStats {
  floors?: number;
  damage?: number;
  chainMultiplier?: number;
  correctCount?: number;
  wrongCount?: number;
  perfectEncounters?: number;
  /** Trivia Night only — sum of per-question speed bonuses. */
  speedBonusTotal?: number;
  /** Duel only — whether the player survived. */
  survived?: boolean;
  /** Duel only — total damage dealt across all turns. */
  damageDealt?: number;
  /** Duel only — total damage taken across all turns. */
  damageTaken?: number;
}

/**
 * Compute the score for a given mode and stats.
 *
 * - race / same_cards: floors*100 + damage + chain*50 + correct*10 - wrong*5 + perfectEncounters*200
 * - trivia_night: correctCount*100 + speedBonusTotal - wrongCount*25
 * - duel: (survived ? 1000 : 0) + damageDealt - damageTaken + correctCount*50
 * - coop: uses same formula as race (floor progression is the primary axis)
 *
 * @param mode  - The multiplayer mode.
 * @param stats - Stats to feed into the formula.
 * @returns     Numeric score (may be negative if penalties dominate).
 */
export function calculateScoreForMode(mode: MultiplayerMode, stats: ModeScoreStats): number {
  const correct = stats.correctCount ?? 0;
  const wrong = stats.wrongCount ?? 0;

  switch (mode) {
    case 'race':
    case 'same_cards':
    case 'coop': {
      const floors = stats.floors ?? 0;
      const damage = stats.damage ?? 0;
      const chain = stats.chainMultiplier ?? 0;
      const perfect = stats.perfectEncounters ?? 0;
      return (
        floors * 100 +
        damage +
        chain * 50 +
        correct * 10 -
        wrong * 5 +
        perfect * 200
      );
    }
    case 'trivia_night': {
      const speedBonus = stats.speedBonusTotal ?? 0;
      return correct * 100 + speedBonus - wrong * 25;
    }
    case 'duel': {
      const survivedBonus = stats.survived ? 1000 : 0;
      const damageDealt = stats.damageDealt ?? 0;
      const damageTaken = stats.damageTaken ?? 0;
      return survivedBonus + damageDealt - damageTaken + correct * 50;
    }
    default: {
      // Exhaustive check — TypeScript will catch unhandled modes at compile time.
      const _exhaustive: never = mode;
      console.warn(`[multiplayerGameService] calculateScoreForMode: unhandled mode "${_exhaustive as string}"`);
      return 0;
    }
  }
}

/**
 * Determine the winner of a race given two progress snapshots.
 *
 * Tie-breaker hierarchy (deterministic on both clients):
 *   1. Higher score
 *   2. Higher floor reached
 *   3. Higher accuracy (0-1)
 *   4. Lower duration (finishedAt - startMs); both clients use the remote finishedAt timestamp
 *   5. Lexicographic playerId (last resort — guarantees identical result on both sides)
 *
 * Returns null only when both players have identical values on every axis —
 * an astronomically unlikely but theoretically possible scenario.
 *
 * @param a        - Progress snapshot for player A.
 * @param b        - Progress snapshot for player B.
 * @param startMs  - Epoch ms when the race started (used to compute duration when finishedAt present).
 * @returns The winning playerId, or null for a true tie.
 */
export function determineRaceWinner(
  a: RaceProgress,
  b: RaceProgress,
  startMs: number,
): string | null {
  // 1. Score
  if (a.score !== b.score) return a.score > b.score ? a.playerId : b.playerId;

  // 2. Floor
  if (a.floor !== b.floor) return a.floor > b.floor ? a.playerId : b.playerId;

  // 3. Accuracy
  if (a.accuracy !== b.accuracy) return a.accuracy > b.accuracy ? a.playerId : b.playerId;

  // 4. Duration — lower is better. Use finishedAt if available; fall back to now.
  const durationA = (a.finishedAt ?? Date.now()) - startMs;
  const durationB = (b.finishedAt ?? Date.now()) - startMs;
  if (durationA !== durationB) return durationA < durationB ? a.playerId : b.playerId;

  // 5. Lexicographic playerId
  if (a.playerId !== b.playerId) return a.playerId < b.playerId ? a.playerId : b.playerId;

  // True tie (all axes identical)
  return null;
}

/**
 * Compute and emit RaceResults when both players have finished.
 *
 * Uses determineRaceWinner() for a deterministic tie-breaker hierarchy.
 * Uses actual correctCount/wrongCount from RaceProgress when available;
 * falls back to the encountersWon * 3 proxy for old peers that don't send counts.
 *
 * #73: When the lobby is ranked, applies an Elo delta using local and opponent ratings.
 * #80: Opponent rating is read from LobbyPlayer.multiplayerRating (broadcast on join) rather
 * than the previous 1500 default. Falls back to 1500 when the field is absent (old peers).
 */
function _tryEmitRaceResults(): void {
  if (!_localProgress?.isFinished || !_opponentProgress?.isFinished) return;
  if (!_onRaceComplete) return;

  const lobby = getCurrentLobby();
  const localId = _localProgress.playerId;
  const opponentId = _opponentProgress.playerId;

  // Find display names from lobby if available
  const localPlayer = lobby?.players.find(p => p.id === localId);
  const opponentPlayer = lobby?.players.find(p => p.id === opponentId);

  // Use real correct/wrong counts when available; proxy for backward-compat with old peers.
  let localCorrect: number;
  let localWrong: number;
  if (_localProgress.correctCount !== undefined && _localProgress.wrongCount !== undefined) {
    localCorrect = _localProgress.correctCount;
    localWrong = _localProgress.wrongCount;
  } else {
    // Proxy: estimating from accuracy and encountersWon (old peers only)
    localCorrect = _localProgress.encountersWon * 3;
    localWrong = Math.round(
      (1 - _localProgress.accuracy) / Math.max(_localProgress.accuracy, 0.01) * localCorrect,
    );
  }

  let opponentCorrect: number;
  let opponentWrong: number;
  if (_opponentProgress.correctCount !== undefined && _opponentProgress.wrongCount !== undefined) {
    opponentCorrect = _opponentProgress.correctCount;
    opponentWrong = _opponentProgress.wrongCount;
  } else {
    opponentCorrect = _opponentProgress.encountersWon * 3;
    opponentWrong = Math.round(
      (1 - _opponentProgress.accuracy) / Math.max(_opponentProgress.accuracy, 0.01) * opponentCorrect,
    );
  }

  // Use opponent's finishedAt timestamp for their duration (not local clock)
  const localDurationMs = (_localProgress.finishedAt ?? Date.now()) - _localStartMs;
  const opponentDurationMs = _opponentProgress.finishedAt !== undefined
    ? _opponentProgress.finishedAt - _localStartMs
    : localDurationMs; // last resort: use same value (old peer without finishedAt)

  const winnerId = determineRaceWinner(_localProgress, _opponentProgress, _localStartMs);

  const results: RaceResults = {
    players: [
      {
        playerId: localId,
        displayName: localPlayer?.displayName ?? localId,
        score: _localProgress.score,
        floorReached: _localProgress.floor,
        accuracy: _localProgress.accuracy,
        factsAnswered: localCorrect + localWrong,
        correctAnswers: localCorrect,
        duration: localDurationMs,
        result: _localProgress.result ?? 'defeat',
      },
      {
        playerId: opponentId,
        displayName: opponentPlayer?.displayName ?? opponentId,
        score: _opponentProgress.score,
        floorReached: _opponentProgress.floor,
        accuracy: _opponentProgress.accuracy,
        factsAnswered: opponentCorrect + opponentWrong,
        correctAnswers: opponentCorrect,
        duration: opponentDurationMs,
        result: _opponentProgress.result ?? 'defeat',
      },
    ],
    winnerId,
    seed: lobby?.seed ?? 0,
  };

  // #73: Apply Elo for ranked races.
  // _raceLocalPlayerId is set by initRaceMode(); fall back to localId from progress if not set.
  const eloLocalId = _raceLocalPlayerId || localId;
  if (lobby?.isRanked && eloLocalId) {
    const localRating = getLocalMultiplayerRating();
    // #80: Read opponent's real Elo from lobby state instead of defaulting to 1500.
    const oppRating = lobby.players.find(p => p.id === opponentId)?.multiplayerRating ?? 1500;
    const outcome = winnerId === eloLocalId ? 'win' : (winnerId === null ? 'tie' : 'loss');
    const { newLocal } = applyEloResult(localRating, oppRating, outcome);
    persistLocalMultiplayerRating(newLocal);
  }

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
 * Idempotent: applying the same seeds twice is a no-op from a game-state
 * perspective because restoreRunRngState overwrites to the exact same positions.
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

/**
 * Handle a late guest joining mid-game: re-broadcast fork seeds to that player.
 *
 * If the transport has no direct-to-one primitive, broadcasts to all — clients
 * that already have seeds treat the re-broadcast as idempotent (applying the same
 * fork positions is a no-op from the game-state perspective).
 *
 * @param _playerId - The late-joining player's ID (reserved for future direct-send).
 */
export function onPlayerJoinMidGame(_playerId: string): void {
  // Re-broadcast current seeds to everyone; guests who already applied them
  // will call applyReceivedForkSeeds with identical values — idempotent.
  const seeds = collectForkSeeds();
  broadcastForkSeeds(seeds);
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
    playerHp: {},
  };
}

/**
 * Host: create the shared enemy from a template and broadcast its initial state.
 *
 * HP is scaled via the canonical `getCoopHpMultiplier()` in `enemyManager.ts` (called
 * internally by `createEnemy` when `playerCount` is provided). Sublinear scaling
 * accounts for accuracy-dependent combined DPS — two 70% accuracy players deal ~1.4×
 * effective DPS, not 2×. See `getCoopHpMultiplier` for exact per-player values.
 *
 * @param templateId - The enemy template ID to look up in ENEMY_TEMPLATES.
 * @param floor - Current floor number for HP scaling.
 * @param playerCount - Number of players (passed to createEnemy for HP scaling via getCoopHpMultiplier).
 */
export function hostCreateSharedEnemy(templateId: string, floor: number, playerCount: number): void {
  if (!_duelState?.isHost) return;

  const template = ENEMY_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    console.error(`[multiplayerGameService] hostCreateSharedEnemy: unknown template "${templateId}"`);
    return;
  }

  // Delegate HP scaling to createEnemy's playerCount option, which calls the canonical
  // getCoopHpMultiplier() — 1.6× for 2P, 2.0× for 3P, 2.3× for 4P (capped).
  _duelState.sharedEnemy = createEnemy(template, floor, { playerCount });

  _broadcastEnemyState();
}

/**
 * Submit the local player's turn action.
 * If host and both actions are now ready, resolves the turn automatically.
 *
 * Values are clamped to prevent negative damage/block from bad network payloads:
 * - damageDealt: clamped to [0, ∞)
 * - blockGained: clamped to [0, ∞)
 *
 * @param action - The local player's aggregated turn results.
 */
export function submitDuelTurnAction(action: DuelTurnAction): void {
  if (!_duelState) return;

  // Clamp action values to prevent negative inputs corrupting host state (M10)
  const sanitized: DuelTurnAction = {
    ...action,
    damageDealt: Math.max(0, action.damageDealt),
    blockGained: Math.max(0, action.blockGained),
  };
  if (action.damageDealt < 0) {
    console.warn(
      `[multiplayerGameService] submitDuelTurnAction: negative damageDealt ${action.damageDealt} clamped to 0`,
    );
  }
  if (action.blockGained < 0) {
    console.warn(
      `[multiplayerGameService] submitDuelTurnAction: negative blockGained ${action.blockGained} clamped to 0`,
    );
  }

  _duelState.localAction = sanitized;

  const transport = getMultiplayerTransport();
  transport.send('mp:duel:cards_played', sanitized as unknown as Record<string, unknown>);

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
 * Both-defeated scenario: winnerId is set to null, reason is 'both_defeated'.
 * Result consumers must handle null winner as a "Tie".
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
  let winnerId: string | null = null;
  let reason: DuelTurnResolution['reason'];

  if (defeated) {
    isOver = true;
    // Winner is the player who dealt more total damage
    const p1Total = _duelState.totalDamage[localPlayerId] ?? 0;
    const p2Total = _duelState.totalDamage[opponentId] ?? 0;
    winnerId = p1Total >= p2Total ? localPlayerId : opponentId;
    reason = 'enemy_defeated';
  }

  // Roll next intent. In co-op, enemy attacks ALL players simultaneously.
  rollNextIntent(sharedEnemy);

  // Apply enemy attack to ALL players at full damage (1.0× — no per-player scaling).
  // The "scaling" comes from hitting two targets, matching the increased co-op enemy HP.
  let p1Hp = _duelState.playerHp[localPlayerId] ?? 80; // default starting HP
  let p2Hp = _duelState.playerHp[opponentId] ?? 80;

  if (!isOver && sharedEnemy.nextIntent.type === 'attack') {
    const attackValue = sharedEnemy.nextIntent.value;
    // Full damage to every player — no round-robin targeting.
    p1Hp = Math.max(0, p1Hp - attackValue);
    p2Hp = Math.max(0, p2Hp - attackValue);
    _duelState.playerHp[localPlayerId] = p1Hp;
    _duelState.playerHp[opponentId] = p2Hp;

    const p1Dead = p1Hp <= 0;
    const p2Dead = p2Hp <= 0;
    if (p1Dead || p2Dead) {
      isOver = true;
      if (p1Dead && p2Dead) {
        // Both fall simultaneously — winnerId is null (tie).
        // Higher total damage is NOT used as a tiebreaker here because
        // simultaneous defeat is semantically a draw — not a victory for anyone.
        reason = 'both_defeated';
        winnerId = null;
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
      // 'all' signals that every player is targeted — used by UI for attack indicators.
      targetPlayerId: 'all',
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

    // #73: Apply Elo for ranked duels at game end (host-side only, to avoid double-update).
    const lobby = getCurrentLobby();
    if (lobby?.isRanked) {
      const eloLocalId = _duelState.localPlayerId;
      const opponentId = _duelState.opponentId;
      const localRating = getLocalMultiplayerRating();
      // #80: Read opponent's real Elo from lobby state instead of defaulting to 1500.
      const oppRating = lobby.players.find(p => p.id === opponentId)?.multiplayerRating ?? 1500;
      const outcome = winnerId === eloLocalId ? 'win' : (winnerId === null ? 'tie' : 'loss');
      const { newLocal } = applyEloResult(localRating, oppRating, outcome);
      persistLocalMultiplayerRating(newLocal);
    }
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

    // Opponent submitted their cards_played — host stores, clamps, and may resolve
    cleanups.push(transport.on('mp:duel:cards_played', (msg) => {
      if (!_duelState) return;
      const raw = msg.payload as unknown as DuelTurnAction;

      // Clamp incoming opponent action to prevent negative values from
      // bad network payloads corrupting the host's accumulated damage totals (M10)
      const action: DuelTurnAction = {
        ...raw,
        damageDealt: Math.max(0, raw.damageDealt),
        blockGained: Math.max(0, raw.blockGained),
      };
      if (raw.damageDealt < 0) {
        console.warn(
          `[multiplayerGameService] mp:duel:cards_played: negative damageDealt ${raw.damageDealt} from "${raw.playerId}" clamped to 0`,
        );
      }
      if (raw.blockGained < 0) {
        console.warn(
          `[multiplayerGameService] mp:duel:cards_played: negative blockGained ${raw.blockGained} from "${raw.playerId}" clamped to 0`,
        );
      }

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

    // Duel ended — client side applies Elo for ranked games
    cleanups.push(transport.on('mp:duel:end', (msg) => {
      const resolution = msg.payload as unknown as DuelTurnResolution;
      if (!_duelState?.isHost) {
        // Client receives final resolution from host
        _onDuelEnd?.(resolution);

        // #73: Non-host applies Elo for ranked duels using the received winnerId.
        const lobby = getCurrentLobby();
        if (lobby?.isRanked && _duelState) {
          const eloLocalId = _duelState.localPlayerId;
          const opponentId = _duelState.opponentId;
          const localRating = getLocalMultiplayerRating();
          // #80: Read opponent's real Elo from lobby state instead of defaulting to 1500.
          const oppRating = lobby.players.find(p => p.id === opponentId)?.multiplayerRating ?? 1500;
          const outcome = resolution.winnerId === eloLocalId ? 'win'
            : (resolution.winnerId === null ? 'tie' : 'loss');
          const { newLocal } = applyEloResult(localRating, oppRating, outcome);
          persistLocalMultiplayerRating(newLocal);
        }
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
  _raceCorrectFactIds = [];
  _raceWrongFactIds = [];
  _raceLocalPlayerId = '';
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
      // Enemy always targets all players in co-op — signal this to UI layer.
      targetPlayerId: 'all',
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
