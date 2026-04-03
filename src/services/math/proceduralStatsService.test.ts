/**
 * Unit tests for proceduralStatsService.ts
 *
 * Covers: zero-state baseline, multi-skill aggregation, accuracy rounding,
 * tier distribution counting, and deckId filtering.
 *
 * getAllSkillStates and getSkillTier are mocked so these tests are pure
 * unit tests with no saveService dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlayerSkillState } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Mock skillStateManager — we control what getAllSkillStates returns per test
// ---------------------------------------------------------------------------

// Plain vi.fn() — Vitest 2.x dropped the tuple-style generic in favour of
// a function-type generic; plain vi.fn() avoids the signature mismatch.
const mockGetAllSkillStates = vi.fn();
const mockGetSkillTier = vi.fn();

vi.mock('./skillStateManager', () => ({
  getAllSkillStates: (deckId?: string) => mockGetAllSkillStates(deckId),
  getSkillTier: (state: PlayerSkillState) => mockGetSkillTier(state),
}));

// Import AFTER mocks are set up
import { getMathStats } from './proceduralStatsService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkillState(
  overrides: Partial<PlayerSkillState> & { skillId?: string; deckId?: string } = {},
): PlayerSkillState {
  return {
    skillId: overrides.skillId ?? 'skill_a',
    deckId: overrides.deckId ?? 'arithmetic',
    cardState: 'new',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 0,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    stability: 0,
    consecutiveCorrect: 0,
    passedMasteryTrial: false,
    retrievability: 0,
    difficulty: 5,
    totalAttempts: overrides.totalAttempts ?? 0,
    totalCorrect: overrides.totalCorrect ?? 0,
    averageResponseTimeMs: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Zero-state baseline
// ---------------------------------------------------------------------------

describe('getMathStats — no skill states', () => {
  it('returns zeros when getAllSkillStates returns empty array', () => {
    mockGetAllSkillStates.mockReturnValue([]);

    const stats = getMathStats();

    expect(stats.problemsSolved).toBe(0);
    expect(stats.correctCount).toBe(0);
    expect(stats.accuracyPercent).toBe(0);
    expect(stats.totalSkills).toBe(0);
  });

  it('tierDistribution all zeros when no skills exist', () => {
    mockGetAllSkillStates.mockReturnValue([]);

    const stats = getMathStats();

    expect(stats.tierDistribution).toEqual({ '1': 0, '2a': 0, '2b': 0, '3': 0 });
  });
});

// ---------------------------------------------------------------------------
// 2. Multi-skill aggregation
// ---------------------------------------------------------------------------

describe('getMathStats — aggregation across skills', () => {
  it('sums problemsSolved across multiple skill states', () => {
    const states = [
      makeSkillState({ totalAttempts: 10, totalCorrect: 8 }),
      makeSkillState({ skillId: 'skill_b', totalAttempts: 5, totalCorrect: 3 }),
      makeSkillState({ skillId: 'skill_c', totalAttempts: 20, totalCorrect: 15 }),
    ];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.problemsSolved).toBe(35);
  });

  it('sums correctCount across multiple skill states', () => {
    const states = [
      makeSkillState({ totalAttempts: 10, totalCorrect: 8 }),
      makeSkillState({ skillId: 'skill_b', totalAttempts: 5, totalCorrect: 3 }),
      makeSkillState({ skillId: 'skill_c', totalAttempts: 20, totalCorrect: 15 }),
    ];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.correctCount).toBe(26);
  });

  it('reports totalSkills equal to number of states returned', () => {
    const states = [
      makeSkillState({ skillId: 'a' }),
      makeSkillState({ skillId: 'b' }),
    ];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.totalSkills).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Accuracy calculation
// ---------------------------------------------------------------------------

describe('getMathStats — accuracyPercent', () => {
  it('calculates accuracy as percentage rounded to nearest integer', () => {
    // 26 correct out of 35 attempts → 74.28...% → rounds to 74
    const states = [
      makeSkillState({ totalAttempts: 10, totalCorrect: 8 }),
      makeSkillState({ skillId: 'b', totalAttempts: 5, totalCorrect: 3 }),
      makeSkillState({ skillId: 'c', totalAttempts: 20, totalCorrect: 15 }),
    ];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.accuracyPercent).toBe(74);
  });

  it('rounds 50% correctly (exact half)', () => {
    const states = [makeSkillState({ totalAttempts: 10, totalCorrect: 5 })];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.accuracyPercent).toBe(50);
  });

  it('returns 100 when all answers are correct', () => {
    const states = [makeSkillState({ totalAttempts: 8, totalCorrect: 8 })];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.accuracyPercent).toBe(100);
  });

  it('returns 0 accuracy when no problems have been attempted', () => {
    const states = [makeSkillState({ totalAttempts: 0, totalCorrect: 0 })];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.accuracyPercent).toBe(0);
  });

  it('rounds a fractional percentage (33.33...%) to 33', () => {
    const states = [makeSkillState({ totalAttempts: 3, totalCorrect: 1 })];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.accuracyPercent).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// 4. Tier distribution
// ---------------------------------------------------------------------------

describe('getMathStats — tierDistribution', () => {
  it('counts skills at each tier correctly', () => {
    const states = [
      makeSkillState({ skillId: 'a' }),
      makeSkillState({ skillId: 'b' }),
      makeSkillState({ skillId: 'c' }),
      makeSkillState({ skillId: 'd' }),
      makeSkillState({ skillId: 'e' }),
      makeSkillState({ skillId: 'f' }),
    ];
    mockGetAllSkillStates.mockReturnValue(states);

    // Return tiers in sequence: '1', '1', '2a', '2b', '2b', '3'
    mockGetSkillTier
      .mockReturnValueOnce('1')
      .mockReturnValueOnce('1')
      .mockReturnValueOnce('2a')
      .mockReturnValueOnce('2b')
      .mockReturnValueOnce('2b')
      .mockReturnValueOnce('3');

    const stats = getMathStats();

    expect(stats.tierDistribution).toEqual({ '1': 2, '2a': 1, '2b': 2, '3': 1 });
  });

  it('all skills at tier "1" when none have progressed', () => {
    const states = [
      makeSkillState({ skillId: 'a' }),
      makeSkillState({ skillId: 'b' }),
    ];
    mockGetAllSkillStates.mockReturnValue(states);
    mockGetSkillTier.mockReturnValue('1');

    const stats = getMathStats();

    expect(stats.tierDistribution['1']).toBe(2);
    expect(stats.tierDistribution['2a']).toBe(0);
    expect(stats.tierDistribution['2b']).toBe(0);
    expect(stats.tierDistribution['3']).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. deckId filtering
// ---------------------------------------------------------------------------

describe('getMathStats — deckId filtering', () => {
  it('passes deckId to getAllSkillStates when provided', () => {
    mockGetAllSkillStates.mockReturnValue([]);

    getMathStats('arithmetic');

    expect(mockGetAllSkillStates).toHaveBeenCalledWith('arithmetic');
  });

  it('passes undefined to getAllSkillStates when no deckId given', () => {
    mockGetAllSkillStates.mockReturnValue([]);

    getMathStats();

    expect(mockGetAllSkillStates).toHaveBeenCalledWith(undefined);
  });

  it('returns stats only for the filtered deck', () => {
    // Simulate getAllSkillStates already filtering — only deck-specific states returned
    const filteredStates = [
      makeSkillState({ deckId: 'arithmetic', totalAttempts: 7, totalCorrect: 6 }),
    ];
    mockGetAllSkillStates.mockReturnValue(filteredStates);
    mockGetSkillTier.mockReturnValue('2a');

    const stats = getMathStats('arithmetic');

    expect(stats.problemsSolved).toBe(7);
    expect(stats.correctCount).toBe(6);
    expect(stats.totalSkills).toBe(1);
    expect(stats.tierDistribution['2a']).toBe(1);
  });
});
