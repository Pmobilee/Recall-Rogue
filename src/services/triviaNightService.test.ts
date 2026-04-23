/**
 * Unit tests for triviaNightService.
 *
 * Covers:
 *   H3 — Empty pool guard (pool-exhausted path)
 *   H4 — Deduplication across rounds
 *   M12 — timingMs clamping in calculateTriviaPoints + late-answer rejection
 *   M13 — allIncorrect flag in round results
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  MultiplayerMessage,
  MultiplayerMessageType,
  MultiplayerTransport,
} from './multiplayerTransport';

// ── Mock transport ────────────────────────────────────────────────────────────

type MessageHandler = (msg: MultiplayerMessage) => void;

type MockTransport = MultiplayerTransport & {
  sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }>;
  simulateReceive(
    type: MultiplayerMessageType,
    payload: Record<string, unknown>,
    senderId?: string,
  ): void;
};

function createMockTransport(): MockTransport {
  const sent: Array<{ type: MultiplayerMessageType; payload: Record<string, unknown> }> = [];
  const listeners = new Map<string, MessageHandler[]>();

  return {
    sent,
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    setActiveLobby: vi.fn(),
    getState: vi.fn(() => 'connected' as const),
    isConnected: vi.fn(() => true),
    send(type: MultiplayerMessageType, payload: Record<string, unknown>) {
      sent.push({ type, payload });
    },
    on(type: string, callback: MessageHandler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(callback);
      return () => {
        const list = listeners.get(type);
        if (list) {
          const idx = list.indexOf(callback);
          if (idx >= 0) list.splice(idx, 1);
        }
      };
    },
    simulateReceive(
      type: MultiplayerMessageType,
      payload: Record<string, unknown>,
      senderId = 'remote',
    ) {
      const list = listeners.get(type);
      if (list) {
        const msg: MultiplayerMessage = { type, payload, timestamp: Date.now(), senderId };
        list.forEach(cb => cb(msg));
      }
    },
  };
}

// ── Module mocking ────────────────────────────────────────────────────────────
// _mockTransport is reassigned in beforeEach; the mock factory captures the
// variable by reference so each test gets a fresh instance.

let _mockTransport: MockTransport;

vi.mock('./multiplayerTransport', () => ({
  getMultiplayerTransport: () => _mockTransport,
}));

import {
  initTriviaGame,
  hostNextQuestion,
  hostResolveRound,
  destroyTriviaGame,
  getTriviaState,
  onTriviaPoolExhausted,
  onTriviaRoundResult,
  calculateTriviaPoints,
  CORRECT_POINTS,
  SPEED_BONUS_MAX,
  ANSWER_GRACE_MS,
  DEFAULT_TIME_LIMIT,
  initTriviaMessageHandlers,
} from './triviaNightService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TWO_PLAYERS = [
  { id: 'p1', displayName: 'Alice' },
  { id: 'p2', displayName: 'Bob' },
];

/** Call hostNextQuestion with a minimal stub question. */
function sendQuestion(factId: string, correctIndex = 0): void {
  hostNextQuestion(
    factId,
    `Question about ${factId}`,
    ['A', 'B', 'C', 'D'],
    correctIndex,
  );
}

/** Send a round answer from a player via the transport answer listener. */
function simulateAnswer(
  playerId: string,
  roundNumber: number,
  selectedIndex: number,
  timingMs: number,
): void {
  _mockTransport.simulateReceive(
    'mp:trivia:answer',
    { roundNumber, selectedIndex, timingMs },
    playerId,
  );
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('triviaNightService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _mockTransport = createMockTransport();
    destroyTriviaGame();
  });

  afterEach(() => {
    destroyTriviaGame();
    vi.useRealTimers();
  });

  // ── H3 — Empty pool guard ─────────────────────────────────────────────────

  describe('H3 — empty pool guard', () => {
    it('emits pool-exhausted and transitions to finished when factPool is empty at init', () => {
      initTriviaGame(TWO_PLAYERS, 5, true, []); // empty pool
      initTriviaMessageHandlers();

      const exhaustedCb = vi.fn();
      onTriviaPoolExhausted(exhaustedCb);

      // Attempting to send the first question with an empty pool should fire
      // pool-exhausted instead of broadcasting a question
      sendQuestion('fact-1');

      // pool-exhausted callback fired
      expect(exhaustedCb).toHaveBeenCalledTimes(1);

      // game transitioned to finished
      expect(getTriviaState()?.phase).toBe('finished');

      // mp:trivia:end was broadcast (not mp:trivia:question)
      const endMsg = _mockTransport.sent.find(m => m.type === 'mp:trivia:end');
      expect(endMsg).toBeDefined();
      expect(endMsg?.payload.reason).toBe('empty_pool');

      // no question was broadcast
      const qMsg = _mockTransport.sent.find(m => m.type === 'mp:trivia:question');
      expect(qMsg).toBeUndefined();
    });

    it('emits pool-exhausted mid-game when all facts in the pool have been used', () => {
      // Pool with exactly 2 facts
      initTriviaGame(TWO_PLAYERS, 10, true, ['fact-a', 'fact-b']);
      initTriviaMessageHandlers();

      const exhaustedCb = vi.fn();
      onTriviaPoolExhausted(exhaustedCb);

      // Round 1 — ask fact-a
      sendQuestion('fact-a');
      expect(getTriviaState()?.phase).toBe('question');

      // Resolve round 1 via timer
      vi.advanceTimersByTime(DEFAULT_TIME_LIMIT * 1000 + 1000);
      expect(getTriviaState()?.phase).toBe('revealing');

      // Manually advance to waiting phase so host can send round 2
      getTriviaState()!.phase = 'waiting';

      // Round 2 — ask fact-b (last fact in pool)
      sendQuestion('fact-b');
      expect(getTriviaState()?.phase).toBe('question');

      // Resolve round 2 via timer
      vi.advanceTimersByTime(DEFAULT_TIME_LIMIT * 1000 + 1000);
      getTriviaState()!.phase = 'waiting';

      // Pool is now exhausted — trying a 3rd question must trigger the guard
      _mockTransport.sent.length = 0; // clear for clean assertion
      sendQuestion('fact-c');

      expect(exhaustedCb).toHaveBeenCalledTimes(1);
      expect(getTriviaState()?.phase).toBe('finished');

      const endMsg = _mockTransport.sent.find(m => m.type === 'mp:trivia:end');
      expect(endMsg?.payload.reason).toBe('empty_pool');
    });

    it('does NOT trigger pool-exhausted when no factPool was supplied at init', () => {
      // No pool argument — pool guard is disabled
      initTriviaGame(TWO_PLAYERS, 5, true);
      initTriviaMessageHandlers();

      const exhaustedCb = vi.fn();
      onTriviaPoolExhausted(exhaustedCb);

      sendQuestion('fact-1');

      expect(exhaustedCb).not.toHaveBeenCalled();
      expect(getTriviaState()?.phase).toBe('question');
    });
  });

  // ── H4 — Deduplication across rounds ──────────────────────────────────────

  describe('H4 — deduplication across rounds', () => {
    it('tracks used fact IDs and pool-exhausted fires only after all facts are used', () => {
      const pool = ['f1', 'f2', 'f3'];
      initTriviaGame(TWO_PLAYERS, 10, true, pool);
      initTriviaMessageHandlers();

      const exhaustedCb = vi.fn();
      onTriviaPoolExhausted(exhaustedCb);

      // Ask all 3 facts — each should succeed
      for (const factId of pool) {
        sendQuestion(factId);
        expect(getTriviaState()?.phase).toBe('question');
        // Advance past the timer to force resolve
        vi.advanceTimersByTime(DEFAULT_TIME_LIMIT * 1000 + 1000);
        expect(getTriviaState()?.phase).toBe('revealing');
        // Manually reset to waiting so next question can be sent
        getTriviaState()!.phase = 'waiting';
      }

      // Not yet exhausted — the 3 sends above are the only ones
      expect(exhaustedCb).not.toHaveBeenCalled();

      // 4th attempt triggers guard
      sendQuestion('f1');
      expect(exhaustedCb).toHaveBeenCalledTimes(1);
      expect(getTriviaState()?.phase).toBe('finished');
    });

    it('3-fact pool with 5-round config: no duplicates, terminates after 3 questions', () => {
      const pool = ['q1', 'q2', 'q3'];
      initTriviaGame(TWO_PLAYERS, 5, true, pool);
      initTriviaMessageHandlers();

      const exhaustedCb = vi.fn();
      onTriviaPoolExhausted(exhaustedCb);

      const askedFactIds: string[] = [];

      // Attempt 5 rounds cycling through the pool
      for (let i = 0; i < 5; i++) {
        const factId = pool[i % pool.length]; // q1, q2, q3, q1, q2

        if (getTriviaState()?.phase === 'finished') break;

        sendQuestion(factId);
        const state = getTriviaState()!;

        if (state.phase === 'question') {
          askedFactIds.push(factId);
          vi.advanceTimersByTime(DEFAULT_TIME_LIMIT * 1000 + 1000);
          if (getTriviaState()?.phase === 'revealing') {
            getTriviaState()!.phase = 'waiting';
          }
        }
      }

      // Exactly 3 unique facts were asked (the full pool)
      expect(askedFactIds).toHaveLength(3);
      // No duplicates
      expect(new Set(askedFactIds).size).toBe(3);
      expect(new Set(askedFactIds)).toEqual(new Set(pool));

      // Pool exhausted after the 3rd (not 5th) round
      expect(exhaustedCb).toHaveBeenCalledTimes(1);
      expect(getTriviaState()?.phase).toBe('finished');

      // Verify via transport: exactly 3 question messages were sent
      const questionMsgs = _mockTransport.sent.filter(m => m.type === 'mp:trivia:question');
      expect(questionMsgs).toHaveLength(3);
      const sentFactIds = questionMsgs.map(m => (m.payload.question as { factId: string }).factId);
      expect(new Set(sentFactIds).size).toBe(3);
    });
  });

  // ── M12 — timingMs clamping ───────────────────────────────────────────────

  describe('M12 — calculateTriviaPoints: timingMs clamping', () => {
    const TIME_LIMIT_MS = DEFAULT_TIME_LIMIT * 1000; // 15 000 ms

    it('returns CORRECT_POINTS + SPEED_BONUS_MAX for instant answers (0ms clamped to 1ms)', () => {
      const pts = calculateTriviaPoints(true, 0, TIME_LIMIT_MS);
      // At 1ms: timeRatio ~= 1 -> speedBonus = SPEED_BONUS_MAX
      expect(pts).toBeGreaterThanOrEqual(CORRECT_POINTS + SPEED_BONUS_MAX - 1);
      expect(pts).toBeLessThanOrEqual(CORRECT_POINTS + SPEED_BONUS_MAX);
    });

    it('returns CORRECT_POINTS + SPEED_BONUS_MAX for negative timingMs (clamped to 1ms)', () => {
      const pts = calculateTriviaPoints(true, -500, TIME_LIMIT_MS);
      expect(pts).toBeGreaterThanOrEqual(CORRECT_POINTS + SPEED_BONUS_MAX - 1);
      expect(pts).toBeLessThanOrEqual(CORRECT_POINTS + SPEED_BONUS_MAX);
    });

    it('returns CORRECT_POINTS (no speed bonus) when timingMs equals the time limit', () => {
      const pts = calculateTriviaPoints(true, TIME_LIMIT_MS, TIME_LIMIT_MS);
      expect(pts).toBe(CORRECT_POINTS);
    });

    it('clamps over-limit timingMs and still returns CORRECT_POINTS (no speed bonus)', () => {
      // Over limit -> clamped to timeLimitMs + ANSWER_GRACE_MS -> timeRatio <= 0
      const pts = calculateTriviaPoints(true, TIME_LIMIT_MS + 99999, TIME_LIMIT_MS);
      expect(pts).toBe(CORRECT_POINTS);
    });

    it('returns 0 for incorrect answers regardless of timing', () => {
      expect(calculateTriviaPoints(false, 0, TIME_LIMIT_MS)).toBe(0);
      expect(calculateTriviaPoints(false, -1000, TIME_LIMIT_MS)).toBe(0);
      expect(calculateTriviaPoints(false, TIME_LIMIT_MS + 5000, TIME_LIMIT_MS)).toBe(0);
    });

    it('host treats answer with timingMs > limit + ANSWER_GRACE_MS as a timeout', () => {
      initTriviaGame(TWO_PLAYERS, 5, true);
      initTriviaMessageHandlers();

      sendQuestion('f1', 0); // correctIndex = 0

      const timeLimitMs = DEFAULT_TIME_LIMIT * 1000;
      const overLimit = timeLimitMs + ANSWER_GRACE_MS + 1;

      // p1 answers with the correct index but submits past the grace window
      // Only p1 answers — no auto-resolve since p2 hasn't answered
      simulateAnswer('p1', 1, 0 /* correct index */, overLimit);

      // Manually resolve — p2 never answered (timeout)
      const result = hostResolveRound();
      expect(result).not.toBeNull();

      const p1Answer = result!.playerAnswers.find(a => a.playerId === 'p1');
      // over-limit answer was forced to selectedIndex = -1 -> correct = false
      expect(p1Answer?.correct).toBe(false);
      expect(p1Answer?.pointsEarned).toBe(0);
    });
  });

  // ── M13 — allIncorrect flag ───────────────────────────────────────────────

  describe('M13 — allIncorrect flag in round result', () => {
    it('sets allIncorrect: false when at least one player answers correctly', () => {
      initTriviaGame(TWO_PLAYERS, 5, true);
      initTriviaMessageHandlers();

      // Register callback — auto-resolve fires when both answer
      const resultCb = vi.fn();
      onTriviaRoundResult(resultCb);

      sendQuestion('f1', 0); // correctIndex = 0

      // p1 correct, p2 wrong -> auto-resolve fires after p2 answers
      simulateAnswer('p1', 1, 0, 3000);
      simulateAnswer('p2', 1, 1, 3000);

      expect(resultCb).toHaveBeenCalledTimes(1);
      expect(resultCb.mock.calls[0][0].allIncorrect).toBe(false);
    });

    it('sets allIncorrect: true when every player answers wrong', () => {
      initTriviaGame(TWO_PLAYERS, 5, true);
      initTriviaMessageHandlers();

      const resultCb = vi.fn();
      onTriviaRoundResult(resultCb);

      sendQuestion('f1', 0); // correctIndex = 0

      // both players pick wrong answers -> auto-resolve fires
      simulateAnswer('p1', 1, 2, 3000);
      simulateAnswer('p2', 1, 3, 3000);

      expect(resultCb).toHaveBeenCalledTimes(1);
      expect(resultCb.mock.calls[0][0].allIncorrect).toBe(true);
    });

    it('sets allIncorrect: true when all players time out (timer auto-resolve)', () => {
      initTriviaGame(TWO_PLAYERS, 5, true);
      initTriviaMessageHandlers();

      const resultCb = vi.fn();
      onTriviaRoundResult(resultCb);

      sendQuestion('f1', 0);

      // No answers submitted — timer fires after time limit + grace
      vi.advanceTimersByTime(DEFAULT_TIME_LIMIT * 1000 + 1000);

      expect(resultCb).toHaveBeenCalledTimes(1);
      expect(resultCb.mock.calls[0][0].allIncorrect).toBe(true);
    });

    it('allIncorrect is included in the transport broadcast payload', () => {
      initTriviaGame(TWO_PLAYERS, 5, true);
      initTriviaMessageHandlers();

      sendQuestion('f1', 0);

      // Both wrong -> auto-resolve fires
      simulateAnswer('p1', 1, 1, 2000);
      simulateAnswer('p2', 1, 2, 2000);

      const scoresMsg = _mockTransport.sent.find(m => m.type === 'mp:trivia:scores');
      expect(scoresMsg).toBeDefined();
      const broadcastResult = scoresMsg!.payload.result as { allIncorrect: boolean };
      expect(broadcastResult.allIncorrect).toBe(true);
    });

    it('onTriviaRoundResult callback receives allIncorrect flag', () => {
      initTriviaGame(TWO_PLAYERS, 5, true);
      initTriviaMessageHandlers();

      const resultCb = vi.fn();
      onTriviaRoundResult(resultCb);

      sendQuestion('f1', 0);

      simulateAnswer('p1', 1, 3, 1500);
      simulateAnswer('p2', 1, 3, 2000);

      expect(resultCb).toHaveBeenCalledTimes(1);
      expect(resultCb.mock.calls[0][0].allIncorrect).toBe(true);
    });
  });
});
