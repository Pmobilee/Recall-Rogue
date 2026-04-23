/**
 * EL-002: Multiplayer run-end ELO wiring tests.
 *
 * EL-002: co-op mode must call applyCoopEloResult when lobby.isRanked is true.
 *
 * SL-001 was reverted 2026-04-23 — season leaderboard is a UI stub with no
 * real backend (server/src/routes/seasonInfo.ts returns hardcoded mock data,
 * and /api/leaderboards/:category only accepts 10 fixed non-MP categories).
 * Wiring client submissions to a feature that doesn't exist is premature.
 *
 * Test strategy:
 *   - Source-level tests verify the EL-002 wiring invariants in
 *     gameFlowController.ts without needing the full Svelte/Phaser stack.
 *   - Unit tests for applyCoopEloResult verify the Elo computation in isolation.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { LobbyState } from '../data/multiplayerTypes';

const CONTROLLER_PATH = path.resolve(__dirname, 'gameFlowController.ts');
const MP_SERVICE_PATH = path.resolve(__dirname, 'multiplayerGameService.ts');

describe('EL-002: coop ELO wiring — source-level invariants', () => {
  let controllerSource: string;
  let mpServiceSource: string;

  beforeEach(() => {
    controllerSource = fs.readFileSync(CONTROLLER_PATH, 'utf-8');
    mpServiceSource = fs.readFileSync(MP_SERVICE_PATH, 'utf-8');
  });

  it('gameFlowController.ts imports applyCoopEloResult from multiplayerGameService', () => {
    expect(controllerSource).toContain('applyCoopEloResult');
    const importLine = controllerSource
      .split('\n')
      .find(l => l.includes("from './multiplayerGameService'"));
    expect(importLine).toBeDefined();
    expect(importLine).toContain('applyCoopEloResult');
  });

  it('gameFlowController.ts calls applyCoopEloResult gated on lobby.isRanked', () => {
    const callIdx = controllerSource.indexOf('applyCoopEloResult(endData.result, coopLobby)');
    expect(callIdx).toBeGreaterThan(-1);
    const before = controllerSource.slice(Math.max(0, callIdx - 300), callIdx);
    expect(before).toContain('isRanked');
  });

  it('multiplayerGameService.ts exports applyCoopEloResult', () => {
    expect(mpServiceSource).toContain('export function applyCoopEloResult(');
  });

  it('applyCoopEloResult uses applyEloResult and persistLocalMultiplayerRating', () => {
    const fnStart = mpServiceSource.indexOf('export function applyCoopEloResult(');
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = mpServiceSource.indexOf('\nexport function ', fnStart + 1);
    const fnBody = mpServiceSource.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2000);
    expect(fnBody).toContain('applyEloResult(');
    expect(fnBody).toContain('persistLocalMultiplayerRating(');
  });
});

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

    applyCoopEloResult('victory', makeLobby({
      maxPlayers: 3,
      players: [
        { id: 'local', displayName: 'Local', isHost: true, isReady: true, multiplayerRating: 1500 },
        { id: 'r1', displayName: 'R1', isHost: false, isReady: true, multiplayerRating: 1400 },
        { id: 'r2', displayName: 'R2', isHost: false, isReady: true, multiplayerRating: 1600 },
      ],
    }));

    const [localRating, opponentRating] = mockApplyEloResult.mock.calls[0];
    expect(localRating).toBe(1500);
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
        { id: 'p1', displayName: 'P1', isHost: true, isReady: true },
        { id: 'p2', displayName: 'P2', isHost: false, isReady: true },
      ],
    }));

    const [, opponentRating] = mockApplyEloResult.mock.calls[0];
    expect(opponentRating).toBe(1500);
  });
});
