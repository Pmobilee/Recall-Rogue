/**
 * Unit tests for catchUpMasteryService.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeCatchUpMastery } from './catchUpMasteryService';
import type { Card } from '../data/card-types';

function makeDeckCard(masteryLevel?: number): Card {
  return {
    id: 'deck_card',
    factId: 'fact_deck',
    cardType: 'attack',
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    masteryLevel,
  };
}

function makeNewCard(mechanicId?: string): Card {
  return {
    id: 'new_card',
    factId: 'fact_new',
    cardType: 'attack',
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1.0,
    mechanicId,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computeCatchUpMastery — empty deck', () => {
  it('returns 0 when deck is empty', () => {
    expect(computeCatchUpMastery(makeNewCard('strike'), [])).toBe(0);
  });
});

describe('computeCatchUpMastery — avg mastery < 1', () => {
  it('returns 0 when all deck cards are at L0', () => {
    const deck = [makeDeckCard(0), makeDeckCard(0), makeDeckCard(0)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(0);
  });

  it('returns 0 when masteryLevel is undefined', () => {
    const deck = [makeDeckCard(undefined), makeDeckCard(undefined)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(0);
  });

  it('returns 0 when avg is 0.5', () => {
    const deck = [makeDeckCard(0), makeDeckCard(1)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(0);
  });
});

describe('computeCatchUpMastery — avg M1 boundary', () => {
  it('min roll (rng=0.0 → roll=0.5): floor(0.5 × 1.0) = 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const deck = [makeDeckCard(1)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(0);
  });

  it('max roll (rng=1.0 → roll=1.5): floor(1.5 × 1.0) = 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    const deck = [makeDeckCard(1)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(1);
  });
});

describe('computeCatchUpMastery — avg M3', () => {
  it('min roll: floor(0.5 × 3) = 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const deck = [makeDeckCard(3), makeDeckCard(3), makeDeckCard(3)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(1);
  });

  it('max roll: floor(1.5 × 3) = 4', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    const deck = [makeDeckCard(3), makeDeckCard(3), makeDeckCard(3)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(4);
  });
});

describe('computeCatchUpMastery — respects mechanic maxLevel', () => {
  it('quicken (maxLevel=3): caps at 3 when rawLevel would be 4', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    const deck = [makeDeckCard(3), makeDeckCard(3), makeDeckCard(3)];
    expect(computeCatchUpMastery(makeNewCard('quicken'), deck)).toBe(3);
  });

  it('quicken: result within limit is not capped', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const deck = [makeDeckCard(3), makeDeckCard(3), makeDeckCard(3)];
    expect(computeCatchUpMastery(makeNewCard('quicken'), deck)).toBe(1);
  });
});

describe('computeCatchUpMastery — never exceeds MASTERY_MAX_LEVEL (5)', () => {
  it('caps at 5 when rawLevel would be 6', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    const deck = [makeDeckCard(4), makeDeckCard(4), makeDeckCard(4)];
    expect(computeCatchUpMastery(makeNewCard('strike'), deck)).toBe(5);
  });

  it('card with no mechanicId falls back to MASTERY_MAX_LEVEL', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    const deck = [makeDeckCard(5), makeDeckCard(5), makeDeckCard(5)];
    expect(computeCatchUpMastery(makeNewCard(undefined), deck)).toBe(5);
  });

  it('unknown mechanicId falls back to MASTERY_MAX_LEVEL', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    const deck = [makeDeckCard(5), makeDeckCard(5)];
    expect(computeCatchUpMastery(makeNewCard('unknown_future_mechanic'), deck)).toBe(5);
  });
});

describe('computeCatchUpMastery — range property', () => {
  it('result is always in [0, quicken maxLevel=3] across many rolls', () => {
    const deck = [makeDeckCard(3), makeDeckCard(4), makeDeckCard(3)];
    for (let i = 0; i < 100; i++) {
      const result = computeCatchUpMastery(makeNewCard('quicken'), deck);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(3);
    }
  });
});
