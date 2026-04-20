/**
 * Trivia Night service — pure quiz party mode for 2-8 players.
 *
 * Flow:
 * 1. Host starts game from lobby → generates question sequence from deck
 * 2. Each round: host broadcasts question + 4 options
 * 3. All players answer simultaneously within timer
 * 4. Host collects answers, scores (correct + speed bonus), broadcasts results
 * 5. After all rounds, show final leaderboard
 *
 * No combat, no cards, no FSRS. Just fun competitive trivia.
 */

import { getMultiplayerTransport } from './multiplayerTransport';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TriviaQuestion {
  roundNumber: number;
  factId: string;
  question: string;
  options: string[]; // 4 options, shuffled
  correctIndex: number;
  domain?: string;
  difficulty?: number;
  timeLimit: number; // seconds
}

export interface TriviaAnswer {
  playerId: string;
  roundNumber: number;
  selectedIndex: number; // -1 if timed out
  timingMs: number;
}

export interface TriviaRoundResult {
  roundNumber: number;
  question: string;
  correctIndex: number;
  correctAnswer: string;
  /** True when every player either timed out or answered incorrectly. */
  allIncorrect: boolean;
  playerAnswers: Array<{
    playerId: string;
    displayName: string;
    selectedIndex: number;
    correct: boolean;
    timingMs: number;
    pointsEarned: number;
  }>;
  standings: TriviaStanding[]; // cumulative after this round
}

export interface TriviaStanding {
  playerId: string;
  displayName: string;
  totalPoints: number;
  correctCount: number;
  totalAnswered: number;
  averageTimingMs: number;
  rank: number; // 1-indexed
}

export interface TriviaGameState {
  totalRounds: number;
  currentRound: number;
  players: Array<{ id: string; displayName: string }>;
  standings: TriviaStanding[];
  currentQuestion: TriviaQuestion | null;
  phase: 'waiting' | 'question' | 'revealing' | 'finished';
  isHost: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_ROUNDS = 15;
export const MIN_ROUNDS = 5;
export const MAX_ROUNDS = 30;
export const DEFAULT_TIME_LIMIT = 15; // seconds per question
export const SPEED_BONUS_MAX = 500; // max points for fastest answer
export const CORRECT_POINTS = 1000; // base points for correct answer
export const REVEAL_DELAY_MS = 3000; // time to show answer before next question

/**
 * Margin beyond the declared time limit within which a submission is still
 * treated as valid (accounts for network lag). Submissions arriving after
 * this grace period are treated as late and scored as timed-out.
 */
export const ANSWER_GRACE_MS = 2000;

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Calculate points for an answer.
 * Correct answers earn CORRECT_POINTS plus a linear speed bonus that decays
 * from SPEED_BONUS_MAX (instant) to 0 (at time limit). Wrong or timed-out
 * answers earn nothing.
 */
export function calculateTriviaPoints(
  correct: boolean,
  timingMs: number,
  timeLimitMs: number,
): number {
  if (!correct) return 0;
  // M12 — clamp timing before computing speed bonus
  const clampedTiming = Math.max(1, Math.min(timingMs, timeLimitMs + ANSWER_GRACE_MS));
  const timeRatio = Math.max(0, 1 - clampedTiming / timeLimitMs);
  const speedBonus = Math.round(SPEED_BONUS_MAX * timeRatio);
  return CORRECT_POINTS + speedBonus;
}

// ── Internal State ────────────────────────────────────────────────────────────

let _gameState: TriviaGameState | null = null;

/** Answers received this round, keyed by playerId */
let _answers: Map<string, TriviaAnswer> = new Map();

/** Running point totals per player, keyed by playerId */
let _pointTotals: Map<string, number> = new Map();

/** Running correct counts per player, keyed by playerId */
let _correctCounts: Map<string, number> = new Map();

/** Running timing sum per player for average calculation, keyed by playerId */
let _timingSums: Map<string, number> = new Map();

/** Per-player answered-count for average timing denominator */
let _answeredCounts: Map<string, number> = new Map();

/** Auto-resolve timer handle */
let _roundTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * H4 — All fact IDs available for this game, set at init time by the host.
 * Non-host players leave this empty (they receive questions from the host).
 */
let _factPool: string[] | null = null;

/**
 * H4 — Fact IDs that have already been asked this game.
 * Cleared on each initTriviaGame call.
 */
let _usedFactIds: Set<string> = new Set();

// ── Callbacks ─────────────────────────────────────────────────────────────────

let _onQuestionReceived: ((q: TriviaQuestion) => void) | null = null;
let _onRoundResult: ((r: TriviaRoundResult) => void) | null = null;
let _onGameOver: ((standings: TriviaStanding[]) => void) | null = null;
let _onStateChange: ((state: TriviaGameState) => void) | null = null;

/** H3 — Callback invoked when the host's fact pool runs dry mid-game. */
let _onPoolExhausted: (() => void) | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recompute ranked standings from current totals.
 * Ties are broken by the playerId string (deterministic).
 */
function computeStandings(players: Array<{ id: string; displayName: string }>): TriviaStanding[] {
  const standings: TriviaStanding[] = players.map(p => {
    const totalPoints = _pointTotals.get(p.id) ?? 0;
    const correctCount = _correctCounts.get(p.id) ?? 0;
    const totalAnswered = _answeredCounts.get(p.id) ?? 0;
    const timingSum = _timingSums.get(p.id) ?? 0;
    const averageTimingMs = totalAnswered > 0 ? Math.round(timingSum / totalAnswered) : 0;
    return {
      playerId: p.id,
      displayName: p.displayName,
      totalPoints,
      correctCount,
      totalAnswered,
      averageTimingMs,
      rank: 0, // assigned below
    };
  });

  // Sort descending by points, then by playerId for tie-breaking
  standings.sort((a, b) =>
    b.totalPoints !== a.totalPoints
      ? b.totalPoints - a.totalPoints
      : a.playerId.localeCompare(b.playerId),
  );

  standings.forEach((s, i) => { s.rank = i + 1; });
  return standings;
}

/** Emit state change to any registered listener */
function emitState(): void {
  if (_gameState && _onStateChange) {
    _onStateChange({ ..._gameState });
  }
}

// ── Game Management ───────────────────────────────────────────────────────────

/**
 * Get the current trivia game state.
 * Returns null when no game is active.
 */
export function getTriviaState(): TriviaGameState | null {
  return _gameState;
}

/**
 * Initialize a trivia game.
 * Call this when the host starts the game from the lobby. Both host and
 * non-host players call this once the game starts so local state is ready
 * before the first question arrives.
 *
 * @param players - All players in the game (from lobby state)
 * @param totalRounds - Number of rounds (clamped to MIN_ROUNDS..MAX_ROUNDS)
 * @param isHost - Whether the local player is the host
 */
export function initTriviaGame(
  players: Array<{ id: string; displayName: string }>,
  totalRounds: number,
  isHost: boolean,
  factPool?: string[],
): void {
  const clampedRounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, totalRounds));

  _answers = new Map();
  _pointTotals = new Map(players.map(p => [p.id, 0]));
  _correctCounts = new Map(players.map(p => [p.id, 0]));
  _timingSums = new Map(players.map(p => [p.id, 0]));
  _answeredCounts = new Map(players.map(p => [p.id, 0]));

  // H4 — reset dedup state for the new game
  // null means "no pool provided" (guard disabled); [] means "explicitly empty" (guard active)
  _factPool = factPool !== undefined ? [...factPool] : null;
  _usedFactIds = new Set();

  _gameState = {
    totalRounds: clampedRounds,
    currentRound: 0,
    players: [...players],
    standings: players.map((p, i) => ({
      playerId: p.id,
      displayName: p.displayName,
      totalPoints: 0,
      correctCount: 0,
      totalAnswered: 0,
      averageTimingMs: 0,
      rank: i + 1,
    })),
    currentQuestion: null,
    phase: 'waiting',
    isHost,
  };

  emitState();
}

/**
 * Host: generate and broadcast the next question to all players.
 *
 * Sends mp:trivia:question via transport and starts the auto-resolve timer.
 * The host should call this after the REVEAL_DELAY_MS window closes for the
 * previous round (or at game start for round 1).
 *
 * @param factId - Source fact ID for provenance tracking
 * @param question - The question text
 * @param options - Exactly 4 answer strings (already shuffled by the caller)
 * @param correctIndex - Index into options that is the correct answer (0-3)
 * @param domain - Optional knowledge domain label
 * @param difficulty - Optional difficulty (1-5)
 */
export function hostNextQuestion(
  factId: string,
  question: string,
  options: string[],
  correctIndex: number,
  domain?: string,
  difficulty?: number,
): void {
  if (!_gameState) {
    console.warn('[triviaNightService] hostNextQuestion called before initTriviaGame');
    return;
  }
  if (!_gameState.isHost) {
    console.warn('[triviaNightService] hostNextQuestion called by non-host');
    return;
  }

  const nextRound = _gameState.currentRound + 1;
  if (nextRound > _gameState.totalRounds) {
    console.warn('[triviaNightService] hostNextQuestion called beyond totalRounds');
    return;
  }

  // H3 + H4 — Pool-exhausted guard.
  // If a factPool was provided at init time and every fact in it has already
  // been used (or the pool was empty to begin with), we cannot ask another
  // unique question. Transition to finished and notify listeners.
  if (_factPool !== null && _usedFactIds.size >= _factPool.length) {
    console.warn('[triviaNightService] fact pool exhausted — ending game early');
    _triggerPoolExhausted();
    return;
  }

  // Clear answers from previous round
  _answers.clear();

  const q: TriviaQuestion = {
    roundNumber: nextRound,
    factId,
    question,
    options,
    correctIndex,
    domain,
    difficulty,
    timeLimit: DEFAULT_TIME_LIMIT,
  };

  // H4 — mark this fact as used
  _usedFactIds.add(factId);

  _gameState.currentRound = nextRound;
  _gameState.currentQuestion = q;
  _gameState.phase = 'question';
  emitState();

  // Broadcast to all players (host receives this via the same transport echo)
  const transport = getMultiplayerTransport();
  transport.send('mp:trivia:question', {
    question: q as unknown as Record<string, unknown>,
  });

  // Auto-resolve when the timer expires (all-answered early resolution is
  // handled in the mp:trivia:answer handler below)
  if (_roundTimer) clearTimeout(_roundTimer);
  _roundTimer = setTimeout(() => {
    hostResolveRound();
  }, DEFAULT_TIME_LIMIT * 1000 + 500); // 500 ms grace period for network lag
}

/**
 * Internal: transition game to 'finished' because the pool ran dry.
 * Broadcasts the end event so all clients know the game is over.
 */
function _triggerPoolExhausted(): void {
  if (!_gameState) return;

  const finalStandings = computeStandings(_gameState.players);
  _gameState.standings = finalStandings;
  _gameState.phase = 'finished';
  emitState();

  // Broadcast game-over with exhausted reason so clients can show appropriate UI
  const transport = getMultiplayerTransport();
  transport.send('mp:trivia:end', {
    standings: finalStandings as unknown as Record<string, unknown>[],
    reason: 'empty_pool',
  });

  if (_onGameOver) _onGameOver(finalStandings);
  if (_onPoolExhausted) _onPoolExhausted();
}

/**
 * Submit the local player's answer for the current round.
 *
 * Safe to call from any player (host or non-host). Uses -1 for selectedIndex
 * if the player timed out without selecting. After sending, the host collects
 * answers via mp:trivia:answer and auto-resolves when all players have answered.
 *
 * @param selectedIndex - Chosen option index (0-3), or -1 for timeout
 * @param timingMs - Milliseconds elapsed since the question was displayed
 */
export function submitAnswer(selectedIndex: number, timingMs: number): void {
  if (!_gameState) {
    console.warn('[triviaNightService] submitAnswer called before initTriviaGame');
    return;
  }
  if (_gameState.phase !== 'question') {
    console.warn('[triviaNightService] submitAnswer called outside question phase');
    return;
  }
  if (!_gameState.currentQuestion) return;

  const transport = getMultiplayerTransport();
  transport.send('mp:trivia:answer', {
    roundNumber: _gameState.currentQuestion.roundNumber,
    selectedIndex,
    timingMs,
  });
}

/**
 * Host: resolve the current round — score all collected answers, update
 * standings, broadcast results, and transition to 'revealing' phase.
 *
 * Called automatically when the round timer fires, or when all players have
 * submitted (whichever comes first). Safe to call more than once per round
 * (idempotent after first call).
 *
 * @returns The round result, or null if the game state is invalid
 */
export function hostResolveRound(): TriviaRoundResult | null {
  if (!_gameState) return null;
  if (!_gameState.isHost) return null;
  if (_gameState.phase !== 'question') return null; // already resolved
  if (!_gameState.currentQuestion) return null;

  // Cancel auto-resolve timer if this was triggered early (all answered)
  if (_roundTimer) {
    clearTimeout(_roundTimer);
    _roundTimer = null;
  }

  const q = _gameState.currentQuestion;
  const timeLimitMs = q.timeLimit * 1000;

  // Score each player — players who didn't answer get a timeout entry
  const playerAnswers = _gameState.players.map(p => {
    const ans = _answers.get(p.id) ?? {
      playerId: p.id,
      roundNumber: q.roundNumber,
      selectedIndex: -1,
      timingMs: timeLimitMs,
    };

    const correct = ans.selectedIndex === q.correctIndex;
    const pointsEarned = calculateTriviaPoints(correct, ans.timingMs, timeLimitMs);

    // Update running totals
    const prev = _pointTotals.get(p.id) ?? 0;
    _pointTotals.set(p.id, prev + pointsEarned);

    if (correct) {
      _correctCounts.set(p.id, (_correctCounts.get(p.id) ?? 0) + 1);
    }

    // Include timing in average only if the player actually answered
    if (ans.selectedIndex >= 0) {
      _timingSums.set(p.id, (_timingSums.get(p.id) ?? 0) + ans.timingMs);
      _answeredCounts.set(p.id, (_answeredCounts.get(p.id) ?? 0) + 1);
    }

    return {
      playerId: p.id,
      displayName: p.displayName,
      selectedIndex: ans.selectedIndex,
      correct,
      timingMs: ans.timingMs,
      pointsEarned,
    };
  });

  // M13 — flag rounds where nobody got it right
  const allIncorrect = playerAnswers.every(a => !a.correct);

  const standings = computeStandings(_gameState.players);

  const result: TriviaRoundResult = {
    roundNumber: q.roundNumber,
    question: q.question,
    correctIndex: q.correctIndex,
    correctAnswer: q.options[q.correctIndex] ?? '',
    allIncorrect,
    playerAnswers,
    standings,
  };

  // Update local state
  _gameState.standings = standings;
  _gameState.phase = 'revealing';
  emitState();

  // Broadcast scores to all players
  const transport = getMultiplayerTransport();
  transport.send('mp:trivia:scores', {
    result: result as unknown as Record<string, unknown>,
  });

  // Notify local host's callback
  if (_onRoundResult) _onRoundResult(result);

  return result;
}

/**
 * Host: end the game and broadcast final standings.
 * Transitions state to 'finished' and fires onTriviaGameOver callbacks.
 * Called after the last round's REVEAL_DELAY_MS window closes.
 */
export function hostEndGame(): void {
  if (!_gameState) return;
  if (!_gameState.isHost) {
    console.warn('[triviaNightService] hostEndGame called by non-host');
    return;
  }

  const finalStandings = computeStandings(_gameState.players);
  _gameState.standings = finalStandings;
  _gameState.phase = 'finished';
  emitState();

  const transport = getMultiplayerTransport();
  transport.send('mp:trivia:end', {
    standings: finalStandings as unknown as Record<string, unknown>[],
  });

  if (_onGameOver) _onGameOver(finalStandings);
}

/**
 * Tear down game state and clear all timers.
 * Call when leaving the Trivia Night screen entirely.
 */
export function destroyTriviaGame(): void {
  if (_roundTimer) {
    clearTimeout(_roundTimer);
    _roundTimer = null;
  }
  _gameState = null;
  _answers.clear();
  _pointTotals.clear();
  _correctCounts.clear();
  _timingSums.clear();
  _answeredCounts.clear();
  _factPool = null;
  _usedFactIds = new Set();
  _onQuestionReceived = null;
  _onRoundResult = null;
  _onGameOver = null;
  _onStateChange = null;
  _onPoolExhausted = null;
}

// ── Callbacks ─────────────────────────────────────────────────────────────────

/**
 * Register a callback invoked when a new question is received (non-host).
 * Returns an unsubscribe function.
 */
export function onTriviaQuestion(cb: (q: TriviaQuestion) => void): () => void {
  _onQuestionReceived = cb;
  return () => { if (_onQuestionReceived === cb) _onQuestionReceived = null; };
}

/**
 * Register a callback invoked when a round's results arrive.
 * Returns an unsubscribe function.
 */
export function onTriviaRoundResult(cb: (r: TriviaRoundResult) => void): () => void {
  _onRoundResult = cb;
  return () => { if (_onRoundResult === cb) _onRoundResult = null; };
}

/**
 * Register a callback invoked when the game ends with final standings.
 * Returns an unsubscribe function.
 */
export function onTriviaGameOver(cb: (standings: TriviaStanding[]) => void): () => void {
  _onGameOver = cb;
  return () => { if (_onGameOver === cb) _onGameOver = null; };
}

/**
 * Register a callback invoked on every state mutation.
 * Returns an unsubscribe function.
 */
export function onTriviaStateChange(cb: (state: TriviaGameState) => void): () => void {
  _onStateChange = cb;
  return () => { if (_onStateChange === cb) _onStateChange = null; };
}

/**
 * H3 — Register a callback invoked when the host's fact pool is exhausted.
 * Fires immediately before the game transitions to 'finished' with reason
 * 'empty_pool'. Returns an unsubscribe function.
 */
export function onTriviaPoolExhausted(cb: () => void): () => void {
  _onPoolExhausted = cb;
  return () => { if (_onPoolExhausted === cb) _onPoolExhausted = null; };
}

// ── Message Handlers ──────────────────────────────────────────────────────────

/**
 * Wire transport message handlers for the Trivia Night protocol.
 *
 * Call once when the Trivia Night screen mounts. Returns a cleanup function
 * that removes all listeners — call it on unmount.
 *
 * Message contract:
 *   mp:trivia:question  Host → all   — broadcasts TriviaQuestion payload
 *   mp:trivia:answer    Player → host — broadcasts a single TriviaAnswer
 *   mp:trivia:scores    Host → all   — broadcasts TriviaRoundResult payload
 *   mp:trivia:end       Host → all   — broadcasts final TriviaStanding[]
 */
export function initTriviaMessageHandlers(): () => void {
  const transport = getMultiplayerTransport();
  const cleanups: (() => void)[] = [];

  // Non-host receives the question from the host
  cleanups.push(transport.on('mp:trivia:question', (msg) => {
    if (!_gameState) return;
    if (_gameState.isHost) return; // host generated it locally, skip echo

    const q = msg.payload.question as TriviaQuestion | undefined;
    if (!q) {
      console.warn('[triviaNightService] mp:trivia:question missing question field');
      return;
    }

    _gameState.currentRound = q.roundNumber;
    _gameState.currentQuestion = q;
    _gameState.phase = 'question';
    emitState();

    if (_onQuestionReceived) _onQuestionReceived(q);
  }));

  // Host collects answers from all players
  cleanups.push(transport.on('mp:trivia:answer', (msg) => {
    if (!_gameState) return;
    if (!_gameState.isHost) return; // only host resolves

    const rawTimingMs = (msg.payload.timingMs as number) ?? 0;
    const timeLimitMs = ((_gameState.currentQuestion?.timeLimit ?? DEFAULT_TIME_LIMIT) * 1000);

    // M12 — reject answers that arrived too late to be valid
    const isLate = rawTimingMs > timeLimitMs + ANSWER_GRACE_MS;
    if (isLate) {
      console.warn(
        `[triviaNightService] late answer from ${msg.senderId} (${rawTimingMs}ms > limit ${timeLimitMs + ANSWER_GRACE_MS}ms) — treating as timeout`,
      );
    }

    const ans: TriviaAnswer = {
      playerId: msg.senderId,
      roundNumber: (msg.payload.roundNumber as number) ?? 0,
      selectedIndex: isLate ? -1 : ((msg.payload.selectedIndex as number) ?? -1),
      timingMs: rawTimingMs,
    };

    // Ignore late answers for previous rounds
    if (!_gameState.currentQuestion || ans.roundNumber !== _gameState.currentQuestion.roundNumber) {
      return;
    }

    _answers.set(ans.playerId, ans);

    // Auto-resolve early when all players have answered
    if (_answers.size >= _gameState.players.length && _gameState.phase === 'question') {
      hostResolveRound();
    }
  }));

  // All players receive round results from the host
  cleanups.push(transport.on('mp:trivia:scores', (msg) => {
    if (!_gameState) return;
    if (_gameState.isHost) return; // host already processed locally

    const result = msg.payload.result as TriviaRoundResult | undefined;
    if (!result) {
      console.warn('[triviaNightService] mp:trivia:scores missing result field');
      return;
    }

    // Apply standings from authoritative host
    _gameState.standings = result.standings;
    _gameState.phase = 'revealing';
    emitState();

    if (_onRoundResult) _onRoundResult(result);
  }));

  // All players receive final game-over standings from the host
  cleanups.push(transport.on('mp:trivia:end', (msg) => {
    if (!_gameState) return;
    if (_gameState.isHost) return; // host already processed locally

    const standings = msg.payload.standings as TriviaStanding[] | undefined;
    if (!standings) {
      console.warn('[triviaNightService] mp:trivia:end missing standings field');
      return;
    }

    _gameState.standings = standings;
    _gameState.phase = 'finished';
    emitState();

    if (_onGameOver) _onGameOver(standings);

    // H3 — notify non-host clients if the game ended due to pool exhaustion
    if (msg.payload.reason === 'empty_pool' && _onPoolExhausted) {
      _onPoolExhausted();
    }
  }));

  return () => cleanups.forEach(fn => fn());
}
