/**
 * EL-002 + SL-001: Multiplayer run-end scoring and ELO wiring tests.
 *
 * EL-002: co-op mode must call applyCoopEloResult when lobby.isRanked is true.
 * SL-001: multiplayer_race, multiplayer_coop, and multiplayer_duel must call
 *         submitCompetitiveScore at run-end with the correct category and a
 *         non-zero score.
 *
 * Test strategy:
 *   - Source-level tests (like gameFlowController.termination.test.ts) verify
 *     the wiring invariants in gameFlowController.ts without needing to import
 *     the full Svelte/Phaser/store stack.
 *   - Unit tests for applyCoopEloResult verify the Elo computation in isolation.
 *   - Unit tests for CompetitiveCategory ensure the queue accepts MP categories.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { LobbyState } from '../data/multiplayerTypes';

const CONTROLLER_PATH = path.resolve(__dirname, 'gameFlowController.ts');
const QUEUE_PATH = path.resolve(__dirname, 'scoreSubmissionQueue.ts');
const MP_SERVICE_PATH = path.resolve(__dirname, 'multiplayerGameService.ts');

// ── Source-level wiring invariants ────────────────────────────────────────────

describe('SL-001: MP run-end season-leaderboard wiring — source-level invariants', () => {
  let controllerSource: string;
  let queueSource: string;

  beforeEach(() => {
    controllerSource = fs.readFileSync(CONTROLLER_PATH, 'utf-8');
    queueSource = fs.readFileSync(QUEUE_PATH, 'utf-8');
  });

  it('scoreSubmissionQueue.ts CompetitiveCategory includes multiplayer_race', () => {
    expect(queueSource).toContain("'multiplayer_race'");
  });

  it('scoreSubmissionQueue.ts CompetitiveCategory includes multiplayer_coop', () => {
    expect(queueSource).toContain("'multiplayer_coop'");
  });

  it('scoreSubmissionQueue.ts CompetitiveCategory includes multiplayer_duel', () => {
    expect(queueSource).toContain("'multiplayer_duel'");
  });

  it('gameFlowController.ts calls submitCompetitiveScore with multiplayer_race category', () => {
    expect(controllerSource).toContain("submitCompetitiveScore('multiplayer_race'");
  });

  it('gameFlowController.ts calls submitCompetitiveScore with multiplayer_coop category', () => {
    expect(controllerSource).toContain("submitCompetitiveScore('multiplayer_coop'");
  });

  it('gameFlowController.ts calls submitCompetitiveScore with multiplayer_duel category', () => {
    expect(controllerSource).toContain("submitCompetitiveScore('multiplayer_duel'");
  });

  it('submitCompetitiveScore signature accepts multiplayer categories', () => {
    // Confirm the type union was widened — all three MP categories present in the signature
    const sigMatch = controllerSource.match(/function submitCompetitiveScore\(\s*category:[^,)]+/);
    expect(sigMatch).not.toBeNull();
    const sig = sigMatch![0];
    expect(sig).toContain("'multiplayer_race'");
    expect(sig).toContain("'multiplayer_coop'");
    expect(sig).toContain("'multiplayer_duel'");
  });

  it('MP score submission blocks guard against abandon (no score submitted on abandon)', () => {
    // Each MP branch wraps the submitCompetitiveScore call in result !== 'abandon'.
    // We verify the guard text exists near each call site.
    const raceMatch = controllerSource.indexOf("submitCompetitiveScore('multiplayer_race'");
    const coopMatch = controllerSource.indexOf("submitCompetitiveScore('multiplayer_coop'");
    const duelMatch = controllerSource.indexOf("submitCompetitiveScore('multiplayer_duel'");

    expect(raceMatch).toBeGreaterThan(-1);
    expect(coopMatch).toBeGreaterThan(-1);
    expect(duelMatch).toBeGreaterThan(-1);

    // In the 200 chars before each call there should be a !== 'abandon' guard
    const before = (idx: number) => controllerSource.slice(Math.max(0, idx - 200), idx);
    expect(before(raceMatch)).toContain("!== 'abandon'");
    expect(before(coopMatch)).toContain("!== 'abandon'");
    expect(before(duelMatch)).toContain("!== 'abandon'");
  });
});

describe('EL-002: coop ELO wiring — source-level invariants', () => {
  let controllerSource: string;
  let mpServiceSource: string;

  beforeEach(() => {
    controllerSource = fs.readFileSync(CONTROLLER_PATH, 'utf-8');
    mpServiceSource = fs.readFileSync(MP_SERVICE_PATH, 'utf-8');
  });

  it('gameFlowController.ts imports applyCoopEloResult from multiplayerGameService', () => {
    expect(controllerSource).toContain('applyCoopEloResult');
    // Must appear in an import statement from multiplayerGameService
    const importLine = controllerSource
      .split('\n')
      .find(l => l.includes("from './multiplayerGameService'"));
    expect(importLine).toBeDefined();
    expect(importLine).toContain('applyCoopEloResult');
  });

  it('gameFlowController.ts calls applyCoopEloResult gated on lobby.isRanked', () => {
    const callIdx = controllerSource.indexOf('applyCoopEloResult(endData.result, coopLobby)');
    expect(callIdx).toBeGreaterThan(-1);
    // The guard for isRanked must appear before the call
    const before = controllerSource.slice(Math.max(0, callIdx - 300), callIdx);
    expect(before).toContain('isRanked');
  });

  it('multiplayerGameService.ts exports applyCoopEloResult', () => {
    expect(mpServiceSource).toContain('export function applyCoopEloResult(');
  });

  it('applyCoopEloResult uses applyEloResult and persistLocalMultiplayerRating', () => {
    // Find the function body
    const fnStart = mpServiceSource.indexOf('export function applyCoopEloResult(');
    expect(fnStart).toBeGreaterThan(-1);
    // Find the closing brace of the function (next top-level export after it)
    const fnEnd = mpServiceSource.indexOf('\nexport function ', fnStart + 1);
    const fnBody = mpServiceSource.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2000);
    expect(fnBody).toContain('applyEloResult(');
    expect(fnBody).toContain('persistLocalMultiplayerRating(');
  });
});

// ── Unit tests for applyCoopEloResult ─────────────────────────────────────────

// Mock dependencies before importing multiplayerGameService
const { mockApplyEloResult, mockGetLocalRating, mockPersistLocalRating } = vi.hoisted(() => ({
  mockApplyEloResult: vi.fn((local: number, _opp: number, _outcome: string) => ({
    newLocal: local + 16,
    newOpponent: 1484,
    localDelta: 16,
    opponentDelta: -16,
  })),
  mockGetLocalRating: vi.fn(() => 1500),
  mockPersistLocalRating: vi.fn(),
}));

vi.mock('./multiplayerElo', () => ({
  applyEloResult: mockApplyEloResult,
  getLocalMultiplayerRating: mockGetLocalRating,
  persistLocalMultiplayerRating: mockPersistLocalRating,
  DEFAULT_RATING: 1500,
}));

// multiplayerGameService has other imports we need to stub
vi.mock('./multiplayerTransport', () => ({
  getMultiplayerTransport: vi.fn(() => ({
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
  })),
}));

vi.mock('./multiplayerLobbyService', () => ({
  getCurrentLobby: vi.fn(() => null),
  getLocalMultiplayerPlayerId: vi.fn(() => 'local_player'),
  isHost: vi.fn(() => true),
}));

vi.mock('./seededRng', () => ({
  getRunRng: vi.fn(() => ({ getState: vi.fn(() => 42) })),
  restoreRunRngState: vi.fn(),
}));

vi.mock('../data/enemies', () => ({ ENEMY_TEMPLATES: [] }));
vi.mock('./enemyManager', () => ({
  createEnemy: vi.fn(),
  applyDamageToEnemy: vi.fn(() => ({ defeated: false })),
  rollNextIntent: vi.fn(),
}));

/** Build a minimal LobbyState fixture with all required fields set to safe defaults. */
function makeLobby(overrides: { players: LobbyState['players'] } & Partial<LobbyState>): LobbyState {
  return {
    lobbyId: 'test-lobby',
    hostId: 'host1',
    mode: 'coop',
    deckSelectionMode: 'host_picks',
    houseRules: {
      ascensionLevel: 0,
      turnTimerSecs: 45,
      quizDifficulty: 'adaptive',
      fairness: {
        freshFactsOnly: false,
        masteryEqualized: false,
        handicapPercent: 0,
        deckPracticeSecs: 0,
        chainNormalized: false,
      },
    },
    maxPlayers: 2,
    isRanked: true,
    seed: 0,
    status: 'in_game',
    visibility: 'friends_only',
    ...overrides,
  };
}

describe('EL-002: applyCoopEloResult unit tests', () => {
  beforeEach(() => {
    mockApplyEloResult.mockClear();
    mockGetLocalRating.mockClear();
    mockPersistLocalRating.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('victory → win outcome → persistLocalMultiplayerRating called once', async () => {
    const { applyCoopEloResult } = await import('./multiplayerGameService');

    applyCoopEloResult('victory', makeLobby({
      players: [
        { id: 'local_player', displayName: 'Local', isHost: true, isReady: true, multiplayerRating: 1500 },
        { id: 'remote_player', displayName: 'Remote', isHost: false, isReady: true, multiplayerRating: 1600 },
      ],
    }));

    expect(mockApplyEloResult).toHaveBeenCalledTimes(1);
    // Outcome from local side should be 'win' for a victory
    const [, , outcome] = mockApplyEloResult.mock.calls[0];
    expect(outcome).toBe('win');
    expect(mockPersistLocalRating).toHaveBeenCalledTimes(1);
  });

  it('defeat → loss outcome → persistLocalMultiplayerRating called once', async () => {
    const { applyCoopEloResult } = await import('./multiplayerGameService');

    applyCoopEloResult('defeat', makeLobby({
      players: [
        { id: 'p1', displayName: 'Player 1', isHost: true, isReady: true, multiplayerRating: 1500 },
        { id: 'p2', displayName: 'Player 2', isHost: false, isReady: true, multiplayerRating: 1400 },
      ],
    }));

    const [, , outcome] = mockApplyEloResult.mock.calls[0];
    expect(outcome).toBe('loss');
    expect(mockPersistLocalRating).toHaveBeenCalledTimes(1);
  });

  it('uses arithmetic mean of remote player ratings as opponent rating', async () => {
    const { applyCoopEloResult } = await import('./multiplayerGameService');
    // Local rating is 1500 (from mockGetLocalRating).
    // Remote players have 1400 and 1600 — mean = 1500.

    applyCoopEloResult('victory', makeLobby({
      maxPlayers: 3,
      players: [
        { id: 'local', displayName: 'Local', isHost: true, isReady: true, multiplayerRating: 1500 },
        { id: 'r1', displayName: 'R1', isHost: false, isReady: true, multiplayerRating: 1400 },
        { id: 'r2', displayName: 'R2', isHost: false, isReady: true, multiplayerRating: 1600 },
      ],
    }));

    // applyEloResult should receive opponent rating = mean(1400, 1600) = 1500
    const [localRating, opponentRating] = mockApplyEloResult.mock.calls[0];
    expect(localRating).toBe(1500); // local rating from mock
    // Mean of 1400 and 1600 = 1500.
    expect(opponentRating).toBe(1500);
  });

  it('retreat → loss outcome (all non-victory outcomes map to loss)', async () => {
    const { applyCoopEloResult } = await import('./multiplayerGameService');

    applyCoopEloResult('retreat', makeLobby({
      players: [
        { id: 'p1', displayName: 'P1', isHost: true, isReady: true },
        { id: 'p2', displayName: 'P2', isHost: false, isReady: true },
      ],
    }));

    const [, , outcome] = mockApplyEloResult.mock.calls[0];
    expect(outcome).toBe('loss');
  });

  it('falls back to 1500 per player when multiplayerRating is absent', async () => {
    const { applyCoopEloResult } = await import('./multiplayerGameService');

    applyCoopEloResult('victory', makeLobby({
      players: [
        { id: 'p1', displayName: 'P1', isHost: true, isReady: true }, // no multiplayerRating
        { id: 'p2', displayName: 'P2', isHost: false, isReady: true }, // no multiplayerRating
      ],
    }));

    // Both players have no rating → both default to 1500.
    // local rating from mock = 1500, remote (p2) falls back to 1500.
    const [, opponentRating] = mockApplyEloResult.mock.calls[0];
    expect(opponentRating).toBe(1500);
  });
});

// ── Unit tests for enqueueCompetitiveScoreSubmission MP categories ────────────

vi.mock('./apiClient', () => ({
  apiClient: {
    isLoggedIn: vi.fn(() => true),
    submitScore: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../utils/uuid', () => ({
  generateUUID: vi.fn(() => 'mock-uuid'),
}));

describe('SL-001: scoreSubmissionQueue accepts MP categories', () => {
  it('enqueueCompetitiveScoreSubmission accepts multiplayer_race category', async () => {
    const { enqueueCompetitiveScoreSubmission } = await import('./scoreSubmissionQueue');
    // Should not throw — CompetitiveCategory union includes 'multiplayer_race'
    expect(() =>
      enqueueCompetitiveScoreSubmission('multiplayer_race', 500, { floorReached: 5 }),
    ).not.toThrow();
  });

  it('enqueueCompetitiveScoreSubmission accepts multiplayer_coop category', async () => {
    const { enqueueCompetitiveScoreSubmission } = await import('./scoreSubmissionQueue');
    expect(() =>
      enqueueCompetitiveScoreSubmission('multiplayer_coop', 750, { floorReached: 7 }),
    ).not.toThrow();
  });

  it('enqueueCompetitiveScoreSubmission accepts multiplayer_duel category', async () => {
    const { enqueueCompetitiveScoreSubmission } = await import('./scoreSubmissionQueue');
    expect(() =>
      enqueueCompetitiveScoreSubmission('multiplayer_duel', 300, { floorReached: 3 }),
    ).not.toThrow();
  });
});
