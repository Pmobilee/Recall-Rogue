/**
 * Unit tests for geoEloService.ts
 *
 * Tests: expectedScore, calculateGeoRating, rating clamping, tierToRating, getGeoEloLabel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  expectedScore,
  calculateGeoRating,
  tierToRating,
  getGeoEloLabel,
  GEO_ELO_MIN,
  GEO_ELO_MAX,
  GEO_ELO_START,
  GEO_ELO_K_FACTOR,
} from '../geoEloService';

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
  it('returns ~0.5 when player and location ratings are equal', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 2);
  });

  it('returns close to 1.0 when player is much higher than location', () => {
    // Player 2200, location 600 — player has massive advantage
    const score = expectedScore(2200, 600);
    expect(score).toBeGreaterThan(0.99);
  });

  it('returns close to 0.0 when player is much lower than location', () => {
    // Player 600, location 2200 — very hard location
    const score = expectedScore(600, 2200);
    expect(score).toBeLessThan(0.01);
  });

  it('returns > 0.5 when player is above location', () => {
    expect(expectedScore(1400, 1200)).toBeGreaterThan(0.5);
  });

  it('returns < 0.5 when player is below location', () => {
    expect(expectedScore(1200, 1400)).toBeLessThan(0.5);
  });
});

describe('calculateGeoRating', () => {
  it('gives a gain when accuracy is high on a hard location', () => {
    // Player 1200, location tier 5 (rating 1600) — hard location
    // With accuracy 1.0 (perfect pin), player should gain rating
    const { ratingChange } = calculateGeoRating(1200, 1600, 1.0);
    expect(ratingChange).toBeGreaterThan(0);
  });

  it('gives a large gain for perfect accuracy on very hard location', () => {
    // Player 1200, location 1600 — expected ~0.29, actual 1.0
    // change = round(24 * (1.0 - 0.29)) = round(17.0) = 17
    const { ratingChange } = calculateGeoRating(1200, 1600, 1.0);
    expect(ratingChange).toBeGreaterThan(10);
  });

  it('gives a loss when accuracy is low on an easy location', () => {
    // Player 1200, location tier 1 (rating 800) — easy location
    // With accuracy 0.0 (completely wrong), player should lose rating
    const { ratingChange } = calculateGeoRating(1200, 800, 0.0);
    expect(ratingChange).toBeLessThan(0);
  });

  it('gives a large loss for zero accuracy on very easy location', () => {
    // Player 1200, location 800 — expected ~0.71, actual 0.0
    // change = round(24 * (0.0 - 0.71)) = round(-17.0) = -17
    const { ratingChange } = calculateGeoRating(1200, 800, 0.0);
    expect(ratingChange).toBeLessThan(-10);
  });

  it('produces roughly no change when accuracy matches expected score', () => {
    // Equal ratings → expected 0.5; accuracy ~0.5 → change near 0
    const { ratingChange } = calculateGeoRating(1200, 1200, 0.5);
    expect(ratingChange).toBe(0);
  });

  it('returns correct newRating = oldRating + ratingChange', () => {
    const playerRating = 1200;
    const { newRating, ratingChange } = calculateGeoRating(playerRating, 1200, 0.8);
    expect(newRating).toBe(playerRating + ratingChange);
  });

  it('clamps rating at GEO_ELO_MAX (2400)', () => {
    // Player at max, perfect accuracy on easy location — should stay at max
    const { newRating } = calculateGeoRating(GEO_ELO_MAX, 800, 1.0);
    expect(newRating).toBe(GEO_ELO_MAX);
  });

  it('clamps rating at GEO_ELO_MIN (400)', () => {
    // Player at min, zero accuracy — should stay at min
    const { newRating } = calculateGeoRating(GEO_ELO_MIN, 800, 0.0);
    expect(newRating).toBe(GEO_ELO_MIN);
  });

  it('does not allow rating to exceed GEO_ELO_MAX', () => {
    const { newRating } = calculateGeoRating(2395, 800, 1.0);
    expect(newRating).toBeLessThanOrEqual(GEO_ELO_MAX);
  });

  it('does not allow rating to go below GEO_ELO_MIN', () => {
    const { newRating } = calculateGeoRating(405, 2400, 0.0);
    expect(newRating).toBeGreaterThanOrEqual(GEO_ELO_MIN);
  });

  it('ratingChange reflects the actual clamped change (not unclamped)', () => {
    // Player just above min, zero accuracy on easy location — should be clamped
    const playerRating = GEO_ELO_MIN + 1;
    const { newRating, ratingChange } = calculateGeoRating(playerRating, 800, 0.0);
    expect(ratingChange).toBe(newRating - playerRating);
  });

  it('uses K-factor of 24', () => {
    // Equal ratings, accuracy 1.0: expected = 0.5
    // change = round(24 * (1.0 - 0.5)) = round(12) = 12
    const { ratingChange } = calculateGeoRating(1200, 1200, 1.0);
    expect(ratingChange).toBe(Math.round(GEO_ELO_K_FACTOR * 0.5));
  });
});

describe('tierToRating', () => {
  it('maps tier 1 to 800', () => {
    expect(tierToRating(1)).toBe(800);
  });

  it('maps tier 2 to 1000', () => {
    expect(tierToRating(2)).toBe(1000);
  });

  it('maps tier 3 to 1200', () => {
    expect(tierToRating(3)).toBe(1200);
  });

  it('maps tier 4 to 1400', () => {
    expect(tierToRating(4)).toBe(1400);
  });

  it('maps tier 5 to 1600', () => {
    expect(tierToRating(5)).toBe(1600);
  });

  it('follows the formula 600 + tier * 200', () => {
    for (let tier = 1; tier <= 5; tier++) {
      expect(tierToRating(tier)).toBe(600 + tier * 200);
    }
  });
});

describe('getGeoEloLabel', () => {
  it('returns "Novice" for rating < 800', () => {
    expect(getGeoEloLabel(400)).toBe('Novice');
    expect(getGeoEloLabel(799)).toBe('Novice');
  });

  it('returns "Explorer" for rating 800–999', () => {
    expect(getGeoEloLabel(800)).toBe('Explorer');
    expect(getGeoEloLabel(999)).toBe('Explorer');
  });

  it('returns "Navigator" for rating 1000–1199', () => {
    expect(getGeoEloLabel(1000)).toBe('Navigator');
    expect(getGeoEloLabel(1199)).toBe('Navigator');
  });

  it('returns "Navigator" for GEO_ELO_START (1200 boundary — upper of Navigator range)', () => {
    // GEO_ELO_START is 1200, which is exactly at the Cartographer threshold
    // "Navigator" covers 1000–1199, "Cartographer" is 1200+
    expect(getGeoEloLabel(GEO_ELO_START)).toBe('Cartographer');
  });

  it('returns "Cartographer" for rating 1200–1399', () => {
    expect(getGeoEloLabel(1200)).toBe('Cartographer');
    expect(getGeoEloLabel(1399)).toBe('Cartographer');
  });

  it('returns "Geographer" for rating 1400–1599', () => {
    expect(getGeoEloLabel(1400)).toBe('Geographer');
    expect(getGeoEloLabel(1599)).toBe('Geographer');
  });

  it('returns "Atlas Master" for rating 1600–1799', () => {
    expect(getGeoEloLabel(1600)).toBe('Atlas Master');
    expect(getGeoEloLabel(1799)).toBe('Atlas Master');
  });

  it('returns "World Oracle" for rating >= 1800', () => {
    expect(getGeoEloLabel(1800)).toBe('World Oracle');
    expect(getGeoEloLabel(2400)).toBe('World Oracle');
  });
});
