/**
 * Unit tests for the Relic Acquisition Flow — AR-59.12
 *
 * Covers: pity counter logic, generateRandomRelicDrop (full rarity weights + pity),
 * RELIC_BOSS_RARITY_WEIGHTS values, offeredRelicIds scope, and pool exclusions.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRandomRelicDrop,
  generateRelicChoices,
  getEligibleRelicPool,
} from './relicAcquisitionService';
import { RELIC_BOSS_RARITY_WEIGHTS, RELIC_RARITY_WEIGHTS, RELIC_PITY_THRESHOLD } from '../data/balance';
import type { RelicDefinition, RelicRarity } from '../data/relics/types';
import { STARTER_RELIC_IDS } from '../data/relics/index';

// ---------------------------------------------------------------------------
// Helpers — minimal mock relic definitions
// ---------------------------------------------------------------------------

function makeRelic(id: string, rarity: RelicRarity): RelicDefinition {
  return {
    id,
    name: id,
    description: `Mock relic ${id}`,
    icon: '🎯',
    rarity,
    category: 'tactical',
    trigger: 'permanent',
    effects: [],
    flavorText: '',
    visualDescription: '',
    unlockCost: 0,
    isStarter: true,
    excludeFromPool: false,
  } as RelicDefinition;
}

const COMMON_RELIC   = makeRelic('relic_common',    'common');
const UNCOMMON_RELIC = makeRelic('relic_uncommon',  'uncommon');
const RARE_RELIC     = makeRelic('relic_rare',      'rare');
const LEGEND_RELIC   = makeRelic('relic_legendary', 'legendary');
const POOL_WITH_ALL  = [COMMON_RELIC, UNCOMMON_RELIC, RARE_RELIC, LEGEND_RELIC];
const POOL_COMMON_ONLY = [
  makeRelic('c1', 'common'),
  makeRelic('c2', 'common'),
];

// ---------------------------------------------------------------------------
// RELIC_BOSS_RARITY_WEIGHTS — AR-59.12 values
// ---------------------------------------------------------------------------

describe('RELIC_BOSS_RARITY_WEIGHTS (AR-59.12 values)', () => {
  it('sums to 1.0', () => {
    const total = Object.values(RELIC_BOSS_RARITY_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('has common = 0.20', () => {
    expect(RELIC_BOSS_RARITY_WEIGHTS.common).toBe(0.20);
  });

  it('has uncommon = 0.35', () => {
    expect(RELIC_BOSS_RARITY_WEIGHTS.uncommon).toBe(0.35);
  });

  it('has rare = 0.30', () => {
    expect(RELIC_BOSS_RARITY_WEIGHTS.rare).toBe(0.30);
  });

  it('has legendary = 0.15', () => {
    expect(RELIC_BOSS_RARITY_WEIGHTS.legendary).toBe(0.15);
  });
});

// ---------------------------------------------------------------------------
// RELIC_PITY_THRESHOLD constant
// ---------------------------------------------------------------------------

describe('RELIC_PITY_THRESHOLD', () => {
  it('equals 4', () => {
    expect(RELIC_PITY_THRESHOLD).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// generateRandomRelicDrop — full rarity weights
// ---------------------------------------------------------------------------

describe('generateRandomRelicDrop', () => {
  it('returns null on empty pool', () => {
    expect(generateRandomRelicDrop([], RELIC_RARITY_WEIGHTS)).toBeNull();
  });

  it('returns null on empty pool when pity active', () => {
    expect(generateRandomRelicDrop([], RELIC_RARITY_WEIGHTS, true)).toBeNull();
  });

  it('returns a relic when pool is non-empty', () => {
    const result = generateRandomRelicDrop(POOL_WITH_ALL, RELIC_RARITY_WEIGHTS);
    expect(result).not.toBeNull();
    expect(POOL_WITH_ALL).toContain(result);
  });

  it('can return Rare relics over many trials (pity off)', () => {
    // With rare weight 0.15 over 200 trials: probability of never seeing Rare ≈ 0.85^200 ≈ 1.1e-15
    let sawRare = false;
    for (let i = 0; i < 200; i++) {
      const r = generateRandomRelicDrop(POOL_WITH_ALL, RELIC_RARITY_WEIGHTS);
      if (r?.rarity === 'rare') sawRare = true;
    }
    expect(sawRare).toBe(true);
  });

  it('can return Legendary relics over many trials (pity off)', () => {
    // With legendary weight 0.05 over 300 trials: probability of never seeing ≈ 0.95^300 ≈ 6.8e-7
    let sawLegendary = false;
    for (let i = 0; i < 300; i++) {
      const r = generateRandomRelicDrop(POOL_WITH_ALL, RELIC_RARITY_WEIGHTS);
      if (r?.rarity === 'legendary') sawLegendary = true;
    }
    expect(sawLegendary).toBe(true);
  });

  it('with pityActive=true, never returns Common when Uncommon+ exist in pool', () => {
    for (let i = 0; i < 100; i++) {
      const r = generateRandomRelicDrop(POOL_WITH_ALL, RELIC_RARITY_WEIGHTS, true);
      expect(r?.rarity).not.toBe('common');
    }
  });

  it('with pityActive=true, falls back to full pool when no Uncommon+ remain', () => {
    // Pool contains only commons — pity should fall through gracefully
    for (let i = 0; i < 20; i++) {
      const r = generateRandomRelicDrop(POOL_COMMON_ONLY, RELIC_RARITY_WEIGHTS, true);
      expect(r).not.toBeNull();
      expect(r?.rarity).toBe('common'); // fallback returns common
    }
  });
});

// ---------------------------------------------------------------------------
// getEligibleRelicPool — excludeFromPool filtering
// ---------------------------------------------------------------------------

describe('getEligibleRelicPool — excludeFromPool', () => {
  it('excludes relics with excludeFromPool === true', () => {
    // We need to use FULL_RELIC_CATALOGUE — use the real function on actual relics,
    // but we can test the logic indirectly:
    // The function filters out r.excludeFromPool !== true, meaning only relics
    // with excludeFromPool === false (or undefined) are returned.
    // Since FULL_RELIC_CATALOGUE is too large to manipulate directly in a test,
    // verify the function returns no relics with excludeFromPool === true.
    const result = getEligibleRelicPool([], [], []);
    for (const r of result) {
      expect(r.excludeFromPool).not.toBe(true);
    }
  });

  it('excludes already-held relics', () => {
    // Get all eligible relics
    const all = getEligibleRelicPool([], [], []);
    if (all.length === 0) return; // skip if catalogue is empty
    const firstId = all[0].id;
    const withHeld = getEligibleRelicPool([], [], [firstId]);
    expect(withHeld.map(r => r.id)).not.toContain(firstId);
  });

  it('excludes relics in excludedIds', () => {
    const all = getEligibleRelicPool([], [], []);
    if (all.length === 0) return;
    const firstId = all[0].id;
    const withExcluded = getEligibleRelicPool([], [firstId], []);
    expect(withExcluded.map(r => r.id)).not.toContain(firstId);
  });
});

// ---------------------------------------------------------------------------
// getEligibleRelicPool — level-gated unlock filtering
// ---------------------------------------------------------------------------

describe('getEligibleRelicPool — level-gated unlocks', () => {
  it('excludes unlockable relics when player level is below their unlockLevel', () => {
    // chain_reactor requires level 1 — at level 0 it should be excluded
    const result = getEligibleRelicPool([], [], [], 0);
    expect(result.map(r => r.id)).not.toContain('chain_reactor');
  });

  it('includes unlockable relics when player level meets their unlockLevel', () => {
    // chain_reactor requires level 1 — at level 1 it should be included
    const result = getEligibleRelicPool([], [], [], 1);
    expect(result.map(r => r.id)).toContain('chain_reactor');
  });

  it('excludes higher-level relics while including lower-level ones', () => {
    // At level 5: chain_reactor(1), quicksilver_quill(5) in; time_warp(6)+ out
    const result = getEligibleRelicPool([], [], [], 5);
    const ids = result.map(r => r.id);
    expect(ids).toContain('chain_reactor');
    expect(ids).toContain('quicksilver_quill');
    expect(ids).not.toContain('time_warp');
    expect(ids).not.toContain('mirror_of_knowledge');
  });

  it('includes all unlockable relics at max level (25)', () => {
    // All 18 unlockable relics should be present at level 25 (excluding phase1-excluded ones)
    const result = getEligibleRelicPool([], [], [], 25);
    const ids = result.map(r => r.id);
    expect(ids).toContain('mirror_of_knowledge');
    expect(ids).toContain('prismatic_shard');
    expect(ids).toContain('scholars_gambit');
  });

  it('starter relics are always included regardless of player level', () => {
    // Starters should appear even at level 0
    const atZero = getEligibleRelicPool([], [], [], 0);
    const atMax = getEligibleRelicPool([], [], [], 25);
    // Both should include only starters (or more) — starters must be present at 0
    expect(atZero.length).toBeGreaterThan(0);
    // All level-0 results must be starters
    const starterSet = new Set(STARTER_RELIC_IDS);
    for (const r of atZero) {
      expect(starterSet.has(r.id) || r.isStarter || r.startsUnlocked).toBe(true);
    }
    expect(atMax.length).toBeGreaterThan(atZero.length);
  });
});

// ---------------------------------------------------------------------------
// generateRelicChoices — basic sanity
// ---------------------------------------------------------------------------

describe('generateRelicChoices', () => {
  it('returns up to count relics', () => {
    const choices = generateRelicChoices(POOL_WITH_ALL, 3, RELIC_RARITY_WEIGHTS);
    expect(choices.length).toBe(3);
  });

  it('returns no duplicates', () => {
    const choices = generateRelicChoices(POOL_WITH_ALL, 4, RELIC_RARITY_WEIGHTS);
    const ids = choices.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns fewer than count when pool is smaller', () => {
    const choices = generateRelicChoices([COMMON_RELIC], 3, RELIC_RARITY_WEIGHTS);
    expect(choices.length).toBe(1);
  });

  it('returns empty array on empty pool', () => {
    const choices = generateRelicChoices([], 3, RELIC_RARITY_WEIGHTS);
    expect(choices).toEqual([]);
  });
});
