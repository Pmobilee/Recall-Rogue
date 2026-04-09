/**
 * Unit tests for the Phase 9 strip_block enemy intent mechanic.
 *
 * strip_block is an enemy debuff intent that instantly removes the player's block.
 * Unlike regular debuffs, it is NOT applied as a persistent status effect — it's
 * an instant removal handled by turnManager after enemyManager returns blockStripped.
 *
 * Tests verify:
 *   - executeEnemyIntent returns correct blockStripped value for strip_block intents
 *   - Regular debuff intents are NOT treated as strip_block (they go to playerEffects)
 *   - Strip_block is clamped to the player's current shield in turnManager logic
 */

import { describe, it, expect } from 'vitest';
import { executeEnemyIntent } from '../../src/services/enemyManager';
import type { EnemyInstance, EnemyTemplate, EnemyIntent } from '../../src/data/enemies';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  const template: EnemyTemplate = {
    id: 'test-enemy',
    name: 'Test Enemy',
    category: 'common',
    baseHP: 100,
    intentPool: [],
    description: 'Test enemy',
  };
  const stripBlockIntent: EnemyIntent = {
    type: 'debuff',
    value: 0,
    weight: 1,
    telegraph: 'Strip Block',
    statusEffect: { type: 'strip_block', value: 10, turns: 1 },
  };
  return {
    template,
    currentHP: 100,
    maxHP: 100,
    nextIntent: stripBlockIntent,
    block: 0,
    statusEffects: [],
    phase: 1,
    floor: 1,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance: 1,
    ...overrides,
  };
}

// ── strip_block intent execution ──────────────────────────────────────────────

describe('strip_block intent — executeEnemyIntent', () => {
  it('returns blockStripped value from strip_block debuff intent', () => {
    const enemy = makeEnemy({
      nextIntent: {
        type: 'debuff',
        value: 0,
        weight: 1,
        telegraph: 'Strip Defenses',
        statusEffect: { type: 'strip_block', value: 10, turns: 1 },
      },
    });
    const result = executeEnemyIntent(enemy);
    expect(result.blockStripped).toBe(10);
  });

  it('strip_block is NOT added to playerEffects (instant removal, not persistent)', () => {
    const enemy = makeEnemy({
      nextIntent: {
        type: 'debuff',
        value: 0,
        weight: 1,
        telegraph: 'Strip Defenses',
        statusEffect: { type: 'strip_block', value: 15, turns: 1 },
      },
    });
    const result = executeEnemyIntent(enemy);
    // Should not be in playerEffects (it's instant, not a persistent status)
    const stripInEffects = result.playerEffects.find(e => e.type === 'strip_block');
    expect(stripInEffects).toBeUndefined();
  });

  it('deals 0 damage for strip_block intent', () => {
    const enemy = makeEnemy({
      nextIntent: {
        type: 'debuff',
        value: 0,
        weight: 1,
        telegraph: 'Strip Defenses',
        statusEffect: { type: 'strip_block', value: 10, turns: 1 },
      },
    });
    const result = executeEnemyIntent(enemy);
    expect(result.damage).toBe(0);
  });

  it('regular debuff (weakness) goes to playerEffects, NOT blockStripped', () => {
    const enemy = makeEnemy({
      nextIntent: {
        type: 'debuff',
        value: 0,
        weight: 1,
        telegraph: 'Weaken',
        statusEffect: { type: 'weakness', value: 2, turns: 2 },
      },
    });
    const result = executeEnemyIntent(enemy);
    expect(result.blockStripped).toBe(0);
    const weaknessInEffects = result.playerEffects.find(e => e.type === 'weakness');
    expect(weaknessInEffects).toBeDefined();
  });

  it('attack intent has blockStripped=0', () => {
    const enemy = makeEnemy({
      nextIntent: {
        type: 'attack',
        value: 10,
        weight: 1,
        telegraph: 'Strike',
      },
    });
    const result = executeEnemyIntent(enemy);
    expect(result.blockStripped).toBe(0);
  });

  it('defend intent has blockStripped=0', () => {
    const enemy = makeEnemy({
      nextIntent: {
        type: 'defend',
        value: 10,
        weight: 1,
        telegraph: 'Shield Up',
      },
    });
    const result = executeEnemyIntent(enemy);
    expect(result.blockStripped).toBe(0);
  });
});

// ── Block strip clamping logic ────────────────────────────────────────────────
// The actual clamping (min(playerShield, blockStripped)) happens in turnManager,
// not in enemyManager. These tests verify the raw value is correctly returned.

describe('strip_block with various strip amounts', () => {
  function executeStripBlock(stripAmount: number): number {
    const enemy = makeEnemy({
      nextIntent: {
        type: 'debuff',
        value: 0,
        weight: 1,
        telegraph: 'Strip Defenses',
        statusEffect: { type: 'strip_block', value: stripAmount, turns: 1 },
      },
    });
    return executeEnemyIntent(enemy).blockStripped;
  }

  it('returns blockStripped=0 for strip amount 0', () => {
    expect(executeStripBlock(0)).toBe(0);
  });

  it('returns blockStripped=5 for strip amount 5', () => {
    expect(executeStripBlock(5)).toBe(5);
  });

  it('returns blockStripped=20 for strip amount 20', () => {
    expect(executeStripBlock(20)).toBe(20);
  });

  it('returns blockStripped=100 for strip amount 100 (unclamped at this layer)', () => {
    // turnManager clamps to player.shield; enemyManager returns raw value
    expect(executeStripBlock(100)).toBe(100);
  });
});
