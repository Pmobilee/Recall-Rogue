/**
 * cardUpgradeService.test.ts
 *
 * Regression tests for mastery-gated AP costs and MASTERY_STAT_TABLES correctness.
 * Focuses on mechanics where cost varies by mastery level.
 *
 * BATCH-ULTRA Cluster G: Foresight mastery-gated 0→1 AP fix verification.
 */

import { describe, it, expect } from 'vitest';
import { getMasteryStats, getEffectiveApCost } from './cardUpgradeService';
import type { Card } from '../data/card-types';

// ─── Minimal Card stub ───────────────────────────────────────────────────────

/** Creates a minimal Card stub for AP cost testing. */
function makeCard(mechanicId: string, masteryLevel: number, apCost = 0): Card {
  return {
    id: `test-${mechanicId}-m${masteryLevel}`,
    factId: 'test-fact',
    cardType: 'utility',
    mechanicId,
    mechanicName: mechanicId,
    chainType: 0,
    apCost,
    baseEffectValue: 0,
    effectMultiplier: 1,
    masteryLevel,
    tier: '1',
    isCursed: false,
    isLocked: false,
    isMasteryTrial: false,
    domain: 'history',
  } as unknown as Card;
}

// ─── Foresight mastery-gated cost (BATCH-ULTRA Cluster G fix) ────────────────

describe('Foresight AP cost — mastery-gated 0→1 (BATCH-ULTRA Cluster G)', () => {
  it('L0 Foresight costs 0 AP — free for onboarding', () => {
    const stats = getMasteryStats('foresight', 0);
    expect(stats?.apCost).toBe(0);
  });

  it('L0 getEffectiveApCost returns 0 even when card.apCost seed is 0', () => {
    const card = makeCard('foresight', 0, 0);
    expect(getEffectiveApCost(card)).toBe(0);
  });

  it('L1 stat table has apCost: 1', () => {
    const stats = getMasteryStats('foresight', 1);
    expect(stats?.apCost).toBe(1);
  });

  it('L1 getEffectiveApCost returns 1 — stat table overrides old card.apCost seed of 0', () => {
    const card = makeCard('foresight', 1, 0); // card.apCost=0 from old seed
    expect(getEffectiveApCost(card)).toBe(1);
  });

  it('L2 costs 1 AP', () => {
    expect(getMasteryStats('foresight', 2)?.apCost).toBe(1);
    expect(getEffectiveApCost(makeCard('foresight', 2, 0))).toBe(1);
  });

  it('L3 costs 1 AP (has foresight_intent tag)', () => {
    const stats = getMasteryStats('foresight', 3);
    expect(stats?.apCost).toBe(1);
    expect(stats?.tags).toContain('foresight_intent');
  });

  it('L4 costs 1 AP', () => {
    expect(getMasteryStats('foresight', 4)?.apCost).toBe(1);
  });

  it('L5 costs 1 AP (draw 3 + see next intent)', () => {
    const stats = getMasteryStats('foresight', 5);
    expect(stats?.apCost).toBe(1);
    expect(stats?.drawCount).toBe(3);
    expect(stats?.tags).toContain('foresight_intent');
  });

  it('draw counts are correct across mastery levels', () => {
    expect(getMasteryStats('foresight', 0)?.drawCount).toBe(1);
    expect(getMasteryStats('foresight', 1)?.drawCount).toBe(1);
    expect(getMasteryStats('foresight', 2)?.drawCount).toBe(2);
    expect(getMasteryStats('foresight', 3)?.drawCount).toBe(2);
    expect(getMasteryStats('foresight', 4)?.drawCount).toBe(2);
    expect(getMasteryStats('foresight', 5)?.drawCount).toBe(3);
  });

  it('L0 to L1 is the only cost boundary — confirms binary gate design', () => {
    // L0 = 0, all others = 1. No gradual increase.
    for (let level = 0; level <= 5; level++) {
      const cost = getMasteryStats('foresight', level)?.apCost ?? 0;
      const expected = level === 0 ? 0 : 1;
      expect(cost).toBe(expected);
    }
  });
});
