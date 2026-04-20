/**
 * Tests for multiplayerElo.ts
 *
 * Verifies:
 * - computeEloDelta correctness
 * - applyEloResult symmetry (win for A = -loss for B)
 * - draw at equal ratings gives ~0 delta
 * - large upset gives large delta
 * - ratings floored at 0
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RATING,
  K_FACTOR,
  computeEloDelta,
  applyEloResult,
  expectedWinProbability,
} from './multiplayerElo';

// ── expectedWinProbability ────────────────────────────────────────────────────

describe('expectedWinProbability', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(expectedWinProbability(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it('returns > 0.5 when local is stronger', () => {
    expect(expectedWinProbability(1600, 1400)).toBeGreaterThan(0.5);
  });

  it('returns < 0.5 when local is weaker', () => {
    expect(expectedWinProbability(1400, 1600)).toBeLessThan(0.5);
  });

  it('is symmetric: E(a,b) + E(b,a) === 1', () => {
    const a = expectedWinProbability(1600, 1200);
    const b = expectedWinProbability(1200, 1600);
    expect(a + b).toBeCloseTo(1, 5);
  });
});

// ── computeEloDelta ───────────────────────────────────────────────────────────

describe('computeEloDelta', () => {
  it('returns positive delta on win for underdog', () => {
    const delta = computeEloDelta(1200, 1600, 'win');
    expect(delta).toBeGreaterThan(0);
  });

  it('returns negative delta on loss for favourite', () => {
    const delta = computeEloDelta(1600, 1200, 'loss');
    expect(delta).toBeLessThan(0);
  });

  it('returns near-zero delta on draw at equal ratings', () => {
    const delta = computeEloDelta(1500, 1500, 'tie');
    // K * (0.5 - 0.5) = 0
    expect(delta).toBe(0);
  });

  it('win vs equal opponent yields approximately K/2 gain', () => {
    // K * (1 - 0.5) = 16
    const delta = computeEloDelta(1500, 1500, 'win');
    expect(delta).toBe(Math.round(K_FACTOR * 0.5));
  });

  it('loss vs equal opponent yields approximately -K/2', () => {
    const delta = computeEloDelta(1500, 1500, 'loss');
    expect(delta).toBe(-Math.round(K_FACTOR * 0.5));
  });

  it('big upset (underdog wins) gives large positive delta', () => {
    // Very large rating difference: underdog should gain close to K
    const delta = computeEloDelta(800, 2000, 'win');
    // Expected score ≈ near 0, so delta ≈ K * (1 - ~0) ≈ K
    expect(delta).toBeGreaterThan(K_FACTOR * 0.9);
  });

  it('heavy favourite losing gives large negative delta', () => {
    const delta = computeEloDelta(2000, 800, 'loss');
    // Expected score ≈ near 1, so delta ≈ K * (0 - ~1) ≈ -K
    expect(delta).toBeLessThan(-K_FACTOR * 0.9);
  });
});

// ── applyEloResult ────────────────────────────────────────────────────────────

describe('applyEloResult', () => {
  it('win for local means loss for opponent — symmetric deltas at equal rating', () => {
    const result = applyEloResult(1500, 1500, 'win');
    expect(result.localDelta).toBeGreaterThan(0);
    expect(result.opponentDelta).toBeLessThan(0);
    // At equal ratings, |localDelta| === |opponentDelta|
    expect(result.localDelta).toBe(-result.opponentDelta);
  });

  it('loss for local means win for opponent — symmetric deltas at equal rating', () => {
    const result = applyEloResult(1500, 1500, 'loss');
    expect(result.localDelta).toBeLessThan(0);
    expect(result.opponentDelta).toBeGreaterThan(0);
    expect(result.localDelta).toBe(-result.opponentDelta);
  });

  it('tie at equal ratings produces delta = 0 for both', () => {
    const result = applyEloResult(1500, 1500, 'tie');
    expect(result.localDelta).toBe(0);
    expect(result.opponentDelta).toBe(0);
    expect(result.newLocal).toBe(1500);
    expect(result.newOpponent).toBe(1500);
  });

  it('newLocal = localRating + localDelta', () => {
    const result = applyEloResult(1400, 1600, 'win');
    expect(result.newLocal).toBe(Math.max(0, 1400 + result.localDelta));
  });

  it('newOpponent = opponentRating + opponentDelta', () => {
    const result = applyEloResult(1400, 1600, 'win');
    expect(result.newOpponent).toBe(Math.max(0, 1600 + result.opponentDelta));
  });

  it('ratings are floored at 0 — no negative ratings', () => {
    // Player at minimal rating losing should not go below 0
    const result = applyEloResult(1, 3000, 'loss');
    expect(result.newLocal).toBeGreaterThanOrEqual(0);
  });

  it('DEFAULT_RATING tied against DEFAULT_RATING: both stay at DEFAULT_RATING', () => {
    const result = applyEloResult(DEFAULT_RATING, DEFAULT_RATING, 'tie');
    expect(result.newLocal).toBe(DEFAULT_RATING);
    expect(result.newOpponent).toBe(DEFAULT_RATING);
  });

  it('win for A vs B is mirror of loss for B vs A — symmetric across perspectives', () => {
    const aWins = applyEloResult(1400, 1600, 'win');
    const bLoses = applyEloResult(1600, 1400, 'loss');
    // A winning: A gains some points, opponent loses same
    // B losing (same match from B's perspective): B loses points, opponent (A) gains same
    expect(aWins.localDelta).toBe(bLoses.opponentDelta);
    expect(aWins.opponentDelta).toBe(bLoses.localDelta);
  });

  it('ties at unequal ratings: weaker player has positive delta, stronger has negative', () => {
    const result = applyEloResult(1200, 1800, 'tie');
    // Underdog drew — better than expected → positive delta
    expect(result.localDelta).toBeGreaterThan(0);
    // Favourite drew — worse than expected → negative delta
    expect(result.opponentDelta).toBeLessThan(0);
  });
});
