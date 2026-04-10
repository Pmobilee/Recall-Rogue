/**
 * Regression tests for getEffectiveApCost (Phase 1) and mastery table monotonic invariants.
 *
 * Added in Phase 5 of the L0 Balance Overhaul (2026-04-10) to guard against:
 * - mechanic.apCost mismatches with MASTERY_STAT_TABLES L0 apCost override
 * - Non-monotonic qpValue growth (cards getting weaker as they level up)
 * - Non-monotonic AP cost increases (cards getting more expensive as they level up)
 */

import { describe, it, expect } from 'vitest';
import { MECHANIC_DEFINITIONS } from '../../src/data/mechanics';
import {
  MASTERY_STAT_TABLES,
  getEffectiveApCost,
  getMasteryStats,
} from '../../src/services/cardUpgradeService';
import type { Card } from '../../src/data/card-types';

// ---------------------------------------------------------------------------
// Minimal card factory for testing
// ---------------------------------------------------------------------------

/** Creates a minimal Card for testing — only fields used by getEffectiveApCost. */
function makeCard(mechanicId: string, masteryLevel: number, apCost: number): Card {
  return {
    id: `test-${mechanicId}-${masteryLevel}`,
    factId: 'fact-test',
    cardType: 'attack',
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: 1,
    effectMultiplier: 1,
    originalBaseEffectValue: 1,
    mechanicId,
    mechanicName: mechanicId,
    apCost,
    masteryLevel,
  } as Card;
}

// ---------------------------------------------------------------------------
// Suite 1: mechanic.apCost vs MASTERY_STAT_TABLES L0 apCost agreement
// ---------------------------------------------------------------------------

describe('mechanic.apCost matches MASTERY_STAT_TABLES L0 apCost', () => {
  it('every mechanic with both values agrees at L0', () => {
    const mismatches: string[] = [];
    for (const mechanic of MECHANIC_DEFINITIONS) {
      const table = MASTERY_STAT_TABLES[mechanic.id];
      if (!table) continue;
      const l0 = table.levels[0];
      if (l0.apCost == null) continue;
      if (l0.apCost !== mechanic.apCost) {
        mismatches.push(
          `${mechanic.id}: mechanic.apCost=${mechanic.apCost} vs table L0.apCost=${l0.apCost}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: getEffectiveApCost respects mastery table AP overrides
// ---------------------------------------------------------------------------

describe('getEffectiveApCost applies mastery AP reductions', () => {
  const mechanicsWithApReductions = [
    'heavy_strike',
    'lifetap',
    'smite',
    'chain_lightning',
    'hemorrhage',
    'fortify',
    'guard',
    'bulwark',
    'overheal',
  ];

  for (const mechanicId of mechanicsWithApReductions) {
    it(`${mechanicId}: effective apCost matches mastery table at each level`, () => {
      const mechanic = MECHANIC_DEFINITIONS.find(m => m.id === mechanicId);
      if (!mechanic) throw new Error(`mechanic ${mechanicId} not found in MECHANIC_DEFINITIONS`);

      const table = MASTERY_STAT_TABLES[mechanicId];
      if (!table) throw new Error(`no mastery table for ${mechanicId}`);

      const maxLevel = table.maxLevel ?? 5;
      for (let level = 0; level <= maxLevel; level++) {
        const card = makeCard(mechanicId, level, mechanic.apCost);
        const levelData = table.levels[Math.min(level, table.levels.length - 1)];
        const expected = levelData.apCost ?? mechanic.apCost;
        const actual = getEffectiveApCost(card);
        expect(actual, `${mechanicId} L${level}: expected apCost=${expected}`).toBe(expected);
      }
    });
  }

  it('apCost is monotonically non-increasing with mastery level', () => {
    const violations: string[] = [];

    for (const [id, table] of Object.entries(MASTERY_STAT_TABLES)) {
      const mechanic = MECHANIC_DEFINITIONS.find(m => m.id === id);
      if (!mechanic) continue; // table entry for a mechanic not in MECHANIC_DEFINITIONS — skip

      let prevCost = mechanic.apCost;
      for (let level = 0; level < table.levels.length; level++) {
        const cost = table.levels[level].apCost ?? mechanic.apCost;
        if (cost > prevCost) {
          violations.push(
            `${id} L${level}: apCost=${cost} > L${level - 1}: ${prevCost} (AP cost INCREASED at higher mastery)`,
          );
        }
        prevCost = cost;
      }
    }
    expect(violations).toEqual([]);
  });

  it('qpValue is monotonically non-decreasing with mastery level', () => {
    const violations: string[] = [];

    for (const [id, table] of Object.entries(MASTERY_STAT_TABLES)) {
      let prevQp = -Infinity;
      for (let level = 0; level < table.levels.length; level++) {
        const qp = table.levels[level].qpValue;
        if (qp < prevQp) {
          violations.push(
            `${id} L${level}: qpValue=${qp} < L${level - 1}: ${prevQp} (qpValue DECREASED at higher mastery)`,
          );
        }
        prevQp = qp;
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Spot-checks on specific changed cards (L0 Balance Overhaul)
// ---------------------------------------------------------------------------

describe('L0 balance overhaul spot-checks', () => {
  it('multi_hit L0 qpValue is 2 (was 1)', () => {
    const stats = getMasteryStats('multi_hit', 0);
    expect(stats?.qpValue).toBe(2);
    expect(stats?.hitCount).toBe(2);
  });

  it('multi_hit L1 qpValue is 2 (bumped to stay monotonic)', () => {
    const stats = getMasteryStats('multi_hit', 1);
    expect(stats?.qpValue).toBe(2);
    expect(stats?.hitCount).toBe(3); // L1 gains 3rd hit
  });

  it('lifetap L0 qpValue is 5 (was 3)', () => {
    const stats = getMasteryStats('lifetap', 0);
    expect(stats?.qpValue).toBe(5);
  });

  it('lifetap L1 qpValue is 5 (bumped; L2 also 5 — plateau is valid)', () => {
    const stats = getMasteryStats('lifetap', 1);
    expect(stats?.qpValue).toBe(5);
  });

  it('bash L0 qpValue is 4 (was 3), apCost is 2', () => {
    const stats = getMasteryStats('bash', 0);
    expect(stats?.qpValue).toBe(4);
    expect(stats?.apCost).toBe(2);
  });

  it('chain_lightning L0 qpValue is 4 (was 3), apCost is 2', () => {
    const stats = getMasteryStats('chain_lightning', 0);
    expect(stats?.qpValue).toBe(4);
    expect(stats?.apCost).toBe(2);
  });

  it('smite L0 qpValue is 7 (was 6), apCost is 2', () => {
    const stats = getMasteryStats('smite', 0);
    expect(stats?.qpValue).toBe(7);
    expect(stats?.apCost).toBe(2);
  });

  it('smite L5 qpValue is 12, apCost is 1 (cap preserved)', () => {
    const stats = getMasteryStats('smite', 5);
    expect(stats?.qpValue).toBe(12);
    expect(stats?.apCost).toBe(1);
  });

  it('hemorrhage L0 qpValue is 4 (was 2)', () => {
    const stats = getMasteryStats('hemorrhage', 0);
    expect(stats?.qpValue).toBe(4);
    expect(stats?.extras?.bleedMult).toBe(3);
  });

  it('fortify L0 qpValue is 5 (was 4), apCost is 2', () => {
    const stats = getMasteryStats('fortify', 0);
    expect(stats?.qpValue).toBe(5);
    expect(stats?.apCost).toBe(2);
  });

  it('overheal L0 qpValue is 6 (was 5), apCost is 2', () => {
    const stats = getMasteryStats('overheal', 0);
    expect(stats?.qpValue).toBe(6);
    expect(stats?.apCost).toBe(2);
  });

  it('overheal L4 has apCost 1 (was missing — bug: AP reverted to 2)', () => {
    const stats = getMasteryStats('overheal', 4);
    expect(stats?.apCost).toBe(1); // AP reduction must persist at L4
  });

  it('ironhide L0 qpValue is 6 (was 5)', () => {
    const stats = getMasteryStats('ironhide', 0);
    expect(stats?.qpValue).toBe(6);
    expect(stats?.apCost).toBe(2);
  });

  it('ironhide L3 qpValue is 7 (was 5 — non-monotonic bug fixed)', () => {
    const stats = getMasteryStats('ironhide', 3);
    expect(stats?.qpValue).toBe(7);
  });

  it('bulwark L0 qpValue is 9, apCost is 2 (was 3 in mechanics.ts — now synced)', () => {
    const stats = getMasteryStats('bulwark', 0);
    expect(stats?.qpValue).toBe(9);
    expect(stats?.apCost).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: New mastery tables (Phase 4)
// ---------------------------------------------------------------------------

describe('Phase 4 new mastery tables', () => {
  it('burnout_shield has a mastery table with 6 levels', () => {
    const table = MASTERY_STAT_TABLES['burnout_shield'];
    expect(table).toBeDefined();
    expect(table?.levels.length).toBe(6);
  });

  it('burnout_shield L0 qpValue is 5', () => {
    const stats = getMasteryStats('burnout_shield', 0);
    expect(stats?.qpValue).toBe(5);
  });

  it('burnout_shield L5 has burnout_no_exhaust tag', () => {
    const stats = getMasteryStats('burnout_shield', 5);
    expect(stats?.qpValue).toBe(13);
    expect(stats?.tags).toContain('burnout_no_exhaust');
  });

  it('knowledge_ward has a mastery table with 6 levels', () => {
    const table = MASTERY_STAT_TABLES['knowledge_ward'];
    expect(table).toBeDefined();
    expect(table?.levels.length).toBe(6);
  });

  it('knowledge_ward L0 qpValue is 6', () => {
    const stats = getMasteryStats('knowledge_ward', 0);
    expect(stats?.qpValue).toBe(6);
  });

  it('knowledge_ward L3 has knowledge_ward_cleanse tag', () => {
    const stats = getMasteryStats('knowledge_ward', 3);
    expect(stats?.qpValue).toBe(9);
    expect(stats?.tags).toContain('knowledge_ward_cleanse');
  });

  it('knowledge_ward L5 qpValue is 12', () => {
    const stats = getMasteryStats('knowledge_ward', 5);
    expect(stats?.qpValue).toBe(12);
  });
});
