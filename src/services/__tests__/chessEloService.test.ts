/**
 * Unit tests for chessEloService.ts
 *
 * Tests: expectedScore, calculateNewRating, rating clamping, getEloLabel, filterPuzzlesByElo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  expectedScore,
  calculateNewRating,
  getEloLabel,
  filterPuzzlesByElo,
  CHESS_ELO_MIN,
  CHESS_ELO_MAX,
  CHESS_ELO_START,
  CHESS_ELO_K_FACTOR,
} from '../chessEloService';

// Mock the Svelte store dependency so the service can be tested in isolation
vi.mock('../../ui/stores/playerData', () => ({
  playerSave: {
    subscribe: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('svelte/store', () => ({
  get: vi.fn(() => null),
}));

describe('expectedScore', () => {
  it('returns ~0.5 when player and puzzle are equal rating', () => {
    const score = expectedScore(1000, 1000);
    expect(score).toBeCloseTo(0.5, 2);
  });

  it('returns close to 1.0 when player is much higher than puzzle', () => {
    // Player 1800, puzzle 600 — player has 1200 Elo advantage
    const score = expectedScore(1800, 600);
    expect(score).toBeGreaterThan(0.99);
  });

  it('returns close to 0.0 when player is much lower than puzzle', () => {
    // Player 600, puzzle 1800 — player is 1200 below puzzle
    const score = expectedScore(600, 1800);
    expect(score).toBeLessThan(0.01);
  });

  it('returns > 0.5 when player is above puzzle', () => {
    const score = expectedScore(1200, 1000);
    expect(score).toBeGreaterThan(0.5);
  });

  it('returns < 0.5 when player is below puzzle', () => {
    const score = expectedScore(1000, 1200);
    expect(score).toBeLessThan(0.5);
  });
});

describe('calculateNewRating', () => {
  it('gives a big gain for correct answer on a hard puzzle', () => {
    // Player 1000, puzzle 1600 — very hard for this player
    const { ratingChange } = calculateNewRating(1000, 1600, true);
    expect(ratingChange).toBeGreaterThan(20); // big reward for beating a hard puzzle
  });

  it('gives a small gain for correct answer on an easy puzzle', () => {
    // Player 1600, puzzle 1200 — easier puzzle for this player
    // Expected ~0.91, change = round(32 * (1 - 0.91)) = round(2.9) = 3
    const { ratingChange } = calculateNewRating(1600, 1200, true);
    expect(ratingChange).toBeGreaterThan(0);
    expect(ratingChange).toBeLessThan(10); // small gain for easy puzzle
  });

  it('gives a big loss for wrong answer on an easy puzzle', () => {
    // Player 1600, puzzle 800 — expected to solve this
    const { ratingChange } = calculateNewRating(1600, 800, false);
    expect(ratingChange).toBeLessThan(-20); // big penalty for failing an easy puzzle
  });

  it('gives a small loss for wrong answer on a hard puzzle', () => {
    // Player 1000, puzzle 1600 — not expected to solve
    const { ratingChange } = calculateNewRating(1000, 1600, false);
    expect(ratingChange).toBeLessThan(0);
    expect(ratingChange).toBeGreaterThan(-5); // barely any penalty for failing a hard puzzle
  });

  it('returns correct newRating = oldRating + change', () => {
    const playerRating = 1000;
    const { newRating, ratingChange } = calculateNewRating(playerRating, 1000, true);
    expect(newRating).toBe(playerRating + ratingChange);
  });

  it('clamps rating at CHESS_ELO_MAX (3200)', () => {
    // Player at max, solves an easy puzzle — should stay at max
    const { newRating } = calculateNewRating(CHESS_ELO_MAX, 400, true);
    expect(newRating).toBe(CHESS_ELO_MAX);
  });

  it('clamps rating at CHESS_ELO_MIN (400)', () => {
    // Player at min, fails a puzzle — should stay at min
    const { newRating } = calculateNewRating(CHESS_ELO_MIN, 400, false);
    expect(newRating).toBe(CHESS_ELO_MIN);
  });

  it('does not allow rating to go above CHESS_ELO_MAX even after a win', () => {
    const { newRating } = calculateNewRating(3195, 400, true);
    expect(newRating).toBeLessThanOrEqual(CHESS_ELO_MAX);
  });

  it('does not allow rating to go below CHESS_ELO_MIN even after a loss', () => {
    const { newRating } = calculateNewRating(405, 3200, false);
    expect(newRating).toBeGreaterThanOrEqual(CHESS_ELO_MIN);
  });

  it('ratingChange reflects the actual clamped change (not unclamped)', () => {
    // Player just above min, fails easy puzzle — should be clamped
    const playerRating = CHESS_ELO_MIN + 1;
    const { newRating, ratingChange } = calculateNewRating(playerRating, 400, false);
    // ratingChange should be newRating - oldRating
    expect(ratingChange).toBe(newRating - playerRating);
  });

  it('uses K-factor of 32', () => {
    // Equal rating game: expected = 0.5
    // Win: change = round(32 * (1 - 0.5)) = round(16) = 16
    const { ratingChange } = calculateNewRating(1000, 1000, true);
    expect(ratingChange).toBe(Math.round(CHESS_ELO_K_FACTOR * 0.5));
  });
});

describe('getEloLabel', () => {
  it('returns "Novice" for rating < 800', () => {
    expect(getEloLabel(600)).toBe('Novice');
    expect(getEloLabel(799)).toBe('Novice');
  });

  it('returns "Beginner" for rating 800-999', () => {
    expect(getEloLabel(800)).toBe('Beginner');
    expect(getEloLabel(999)).toBe('Beginner');
  });

  it('returns "Intermediate" for rating 1000-1199', () => {
    expect(getEloLabel(CHESS_ELO_START)).toBe('Intermediate');
    expect(getEloLabel(1199)).toBe('Intermediate');
  });

  it('returns "Advanced" for rating 1200-1399', () => {
    expect(getEloLabel(1200)).toBe('Advanced');
    expect(getEloLabel(1399)).toBe('Advanced');
  });

  it('returns "Expert" for rating 1400-1599', () => {
    expect(getEloLabel(1400)).toBe('Expert');
    expect(getEloLabel(1599)).toBe('Expert');
  });

  it('returns "Master" for rating 1600-1799', () => {
    expect(getEloLabel(1600)).toBe('Master');
    expect(getEloLabel(1799)).toBe('Master');
  });

  it('returns "Grandmaster" for rating 1800-1999', () => {
    expect(getEloLabel(1800)).toBe('Grandmaster');
    expect(getEloLabel(1999)).toBe('Grandmaster');
  });

  it('returns "Super GM" for rating >= 2000', () => {
    expect(getEloLabel(2000)).toBe('Super GM');
    expect(getEloLabel(2500)).toBe('Super GM');
    expect(getEloLabel(3000)).toBe('Super GM');
  });
});

describe('filterPuzzlesByElo', () => {
  const puzzles = [
    { id: 'p1', lichessRating: 600 },
    { id: 'p2', lichessRating: 900 },
    { id: 'p3', lichessRating: 1000 },
    { id: 'p4', lichessRating: 1050 },
    { id: 'p5', lichessRating: 1500 },
    { id: 'p6', lichessRating: 2000 },
    { id: 'p7', lichessRating: undefined }, // no rating — should be excluded
  ];

  it('sorts puzzles by proximity to player rating', () => {
    const result = filterPuzzlesByElo(puzzles, 1000);
    // Closest to 1000 first
    expect(result[0].id).toBe('p3'); // exact match: distance 0
    expect(result[1].id).toBe('p4'); // distance 50
    expect(result[2].id).toBe('p2'); // distance 100
  });

  it('excludes puzzles without a lichessRating', () => {
    const result = filterPuzzlesByElo(puzzles, 1000);
    const hasUndefined = result.some((p) => p.lichessRating == null);
    expect(hasUndefined).toBe(false);
  });

  it('limits results to targetCount', () => {
    const result = filterPuzzlesByElo(puzzles, 1000, 3);
    expect(result.length).toBe(3);
  });

  it('returns all eligible puzzles when count < targetCount', () => {
    const result = filterPuzzlesByElo(puzzles, 1000, 20);
    // 6 puzzles have a lichessRating (p7 excluded)
    expect(result.length).toBe(6);
  });

  it('returns empty array when no puzzles have ratings', () => {
    const noRatings = [{ id: 'x', lichessRating: undefined }];
    const result = filterPuzzlesByElo(noRatings, 1000);
    expect(result.length).toBe(0);
  });

  it('does not mutate the original array', () => {
    const original = [...puzzles];
    filterPuzzlesByElo(puzzles, 1000);
    expect(puzzles).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// Rating convergence simulation
// ---------------------------------------------------------------------------

describe('calculateNewRating — convergence simulation', () => {
  it('rating climbs from 1000 after 20 correct answers against equal-rated puzzles', () => {
    // Start at 1000, win 20 puzzles all rated 1000.
    // Each win at equal rating gives +16 points (K=32, expected=0.5, change=round(32*0.5)=16).
    // After 20 wins: theoretical ~1320 (but expected score rises as rating climbs, slowing gains).
    // We just verify the rating is in a reasonable upward range.
    let rating = 1000;
    for (let i = 0; i < 20; i++) {
      const { newRating } = calculateNewRating(rating, 1000, true);
      rating = newRating;
    }
    expect(rating).toBeGreaterThan(1100);
    expect(rating).toBeLessThan(1400);
  });

  it('rating drops from 1000 after 20 wrong answers against equal-rated puzzles', () => {
    // Symmetrically, losing 20 times against equal-rated puzzles should drop the rating.
    let rating = 1000;
    for (let i = 0; i < 20; i++) {
      const { newRating } = calculateNewRating(rating, 1000, false);
      rating = newRating;
    }
    expect(rating).toBeLessThan(900);
    expect(rating).toBeGreaterThanOrEqual(CHESS_ELO_MIN);
  });

  it('rating stays clamped at CHESS_ELO_MIN when losing repeatedly from floor', () => {
    // Player starts at floor (400) and loses 10 puzzles — should never go below 400.
    let rating = CHESS_ELO_MIN;
    for (let i = 0; i < 10; i++) {
      const { newRating } = calculateNewRating(rating, 1000, false);
      rating = newRating;
    }
    expect(rating).toBe(CHESS_ELO_MIN);
  });

  it('rating stays clamped at CHESS_ELO_MAX when winning repeatedly at ceiling', () => {
    // Player starts at ceiling (3200) and wins 10 easy puzzles — should never go above 3200.
    let rating = CHESS_ELO_MAX;
    for (let i = 0; i < 10; i++) {
      const { newRating } = calculateNewRating(rating, 400, true);
      rating = newRating;
    }
    expect(rating).toBe(CHESS_ELO_MAX);
  });
});

// ---------------------------------------------------------------------------
// Rating floor boundary behavior
// ---------------------------------------------------------------------------

describe('calculateNewRating — floor boundary', () => {
  it('calculateNewRating(400, 2000, false) stays at 400 (floor clamp)', () => {
    // Player at floor (400), fails a very hard puzzle (2000).
    // Without clamping: unclamped change = round(32 * (0 - expectedScore(400,2000)))
    // expectedScore(400, 2000) ≈ 0 → change ≈ 0 → newRating ≈ 400. Even so, must not go below floor.
    const { newRating } = calculateNewRating(400, 2000, false);
    expect(newRating).toBe(CHESS_ELO_MIN);
  });

  it('calculateNewRating(400, 400, true) rises above 400 (floor allows positive gains)', () => {
    // Player at floor (400), solves an equal-rated puzzle (400).
    // Win at equal rating: change = round(32 * 0.5) = 16 → newRating = 416.
    const { newRating } = calculateNewRating(400, 400, true);
    expect(newRating).toBeGreaterThan(CHESS_ELO_MIN);
  });

  it('calculateNewRating(400, 400, false) stays at floor (400)', () => {
    // Player at floor (400), fails an equal-rated puzzle (400).
    // Loss at equal rating: change = round(32 * (0 - 0.5)) = -16 → unclamped 384 → clamped to 400.
    const { newRating } = calculateNewRating(400, 400, false);
    expect(newRating).toBe(CHESS_ELO_MIN);
  });

  it('ratingChange is 0 when already at floor and would go lower', () => {
    // The clamped ratingChange must reflect actual delta, not the theoretical unclamped delta.
    const { ratingChange } = calculateNewRating(400, 400, false);
    expect(ratingChange).toBe(0);
  });

  // Note: history truncation at 100 entries is tested only via integration (updateChessElo
  // persists to PlayerSave, which requires the Svelte store — not unit-testable in isolation).
});
