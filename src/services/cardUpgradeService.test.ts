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
    expect(getMasteryStats('foresight', 1)?.drawCount).toBe(2); // balance update 16d875b3b: L1 draw raised 1→2
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

// ─────────────────────────────────────────────────────────────────────────────
// Bug 1 — baseEffectValue mismatch in getCombatState()
//
// playtestAPI.getCombatState() was returning hand[i].baseEffectValue = the
// static Card.baseEffectValue set at creation time, while the resolver uses
// getMasteryStats(id, level).qpValue which grows with mastery. Strike at L3
// should report 6, not the L0 static value of 4.
//
// The fix computes effectiveQpValue = getMasteryStats(id, level).qpValue at
// read time. These tests verify the stat table returns the correct values
// that the fix would produce for Strike (the canonical example in the report).
// ─────────────────────────────────────────────────────────────────────────────

describe('Bug 1 — getMasteryStats qpValue diverges from card.baseEffectValue at mastery > 0', () => {
  it('Strike L0: getMasteryStats qpValue matches the base quickPlayValue (4)', () => {
    const stats = getMasteryStats('strike', 0);
    // L0 qpValue should equal the mechanic's base quickPlayValue.
    expect(stats?.qpValue).toBe(4);
  });

  it('Strike L3: getMasteryStats qpValue is 6 (baseEffectValue stays 4 — mismatch pre-fix)', () => {
    const stats = getMasteryStats('strike', 3);
    // This divergence is exactly the bug: a pre-fix getCombatState() would return 4
    // while the resolver would compute 6.
    expect(stats?.qpValue).toBe(6);
  });

  it('Strike L5: getMasteryStats qpValue is 8', () => {
    const stats = getMasteryStats('strike', 5);
    expect(stats?.qpValue).toBe(8);
  });

  it('getMasteryStats returns non-null for known mechanics', () => {
    expect(getMasteryStats('strike', 0)).not.toBeNull();
    expect(getMasteryStats('strike', 5)).not.toBeNull();
  });

  it('getMasteryStats returns null for unknown mechanic id (should fall back to card.baseEffectValue)', () => {
    const stats = getMasteryStats('__not_a_real_mechanic__', 3);
    // If the mechanic definition is also missing, getMasteryStats returns null.
    // The fix in playtestAPI falls back to c.baseEffectValue in this case.
    expect(stats).toBeNull();
  });
});
