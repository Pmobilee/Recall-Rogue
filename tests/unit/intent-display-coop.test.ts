/**
 * Tests for computeIntentDisplayDamage with coop (canary) scaling context.
 *
 * Verifies that the intent display value matches what the real damage pipeline
 * would produce for the same turn state — so players' tactical decisions based
 * on the intent preview are always accurate.
 *
 * AR-263: This specifically covers the case where canaryEnemyDamageMultiplier < 1
 * (co-op scaling) caused the display to show 18 while only 11 damage was applied.
 *
 * Key balance constants used here (from src/data/balance.ts):
 *   GLOBAL_ENEMY_DAMAGE_MULTIPLIER = 1.5
 *   FLOOR_DAMAGE_SCALE_MID = 1.0 (applies to floors 1-6)
 *   ENEMY_TURN_DAMAGE_CAP[1] = 16  (segment 1, floors 1-6)
 */

import { describe, it, expect } from 'vitest';
import { computeIntentDisplayDamage } from '../../src/services/intentDisplay';
import { applyPostIntentDamageScaling } from '../../src/services/enemyDamageScaling';
import type { EnemyInstance } from '../../src/data/enemies';
import type { EnemyIntent } from '../../src/data/enemies';

// ── Minimal enemy fixture ────────────────────────────────────────────────────

/**
 * Build a minimal EnemyInstance suitable for intent display tests.
 * Floor 1, no strength buffs, difficultyVariance=1, no special flags.
 * GLOBAL multiplier (2.0) and segment cap (22 for floor 1-6) apply.
 */
function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'test_enemy',
    template: {
      id: 'test_enemy',
      displayName: 'Test Enemy',
      baseHP: 30,
      intents: [{ type: 'attack', value: 18 }],
    } as EnemyInstance['template'],
    currentHP: 30,
    maxHP: 30,
    block: 0,
    floor: 1,
    phase: 1,
    statusEffects: [],
    nextIntent: { type: 'attack', value: 18 },
    difficultyVariance: 1,
    enrageBonusDamage: 0,
    isCharging: false,
    chargedDamage: 0,
    playerChargedThisTurn: false,
    _stunNextTurn: false,
    _nextAttackDoubled: false,
    _silencedCardType: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeIntentDisplayDamage — coop scaling', () => {
  // Floor 1: floorScaling = 1.0, strengthMod = 1, GLOBAL = 1.5, cap = 16
  // 18 * 1 * 1.0 * 1.5 = 27 → capped to 16
  it('base case: floor 1 with GLOBAL multiplier and segment cap → 16', () => {
    const enemy = makeEnemy();
    const intent: EnemyIntent = { type: 'attack', value: 18 };
    const result = computeIntentDisplayDamage(intent, enemy);
    // 18 * 1 * 1.0 * 2.0 = 36, segment-1 cap = 16
    expect(result).toBe(16);
  });

  it('canary multiplier 0.6: display should be round(base * 0.6)', () => {
    const enemy = makeEnemy();
    const intent: EnemyIntent = { type: 'attack', value: 18 };

    const scalingCtx = {
      canaryEnemyDamageMultiplier: 0.6,
      ascensionEnemyDamageMultiplier: 1,
      difficultyMode: 'normal' as const,
    };

    const baseDisplay = computeIntentDisplayDamage(intent, enemy);
    const scaledDisplay = computeIntentDisplayDamage(intent, enemy, scalingCtx);

    // The scaled display should be approximately 0.6× the base display.
    const expected = Math.round(baseDisplay * 0.6);
    expect(scaledDisplay).toBe(expected);
  });

  it('canary multiplier 0.6 with base 16 → round(16 * 0.6) = 10', () => {
    const enemy = makeEnemy();
    const intent: EnemyIntent = { type: 'attack', value: 18 };

    const scalingCtx = {
      canaryEnemyDamageMultiplier: 0.6,
      ascensionEnemyDamageMultiplier: 1,
      difficultyMode: 'normal' as const,
    };

    const display = computeIntentDisplayDamage(intent, enemy, scalingCtx);
    // base=16 (18*2.0=36, capped to 16), 16 * 0.6 = 9.6 → rounds to 10
    expect(display).toBe(10);
  });

  it('small intent bypassing cap: canary 0.6, value 5 → round(8 * 0.6) = 5', () => {
    const enemy = makeEnemy();
    // 5 * 1 * 1.0 * 1.5 = 7.5 → round 8 (below cap=16), then * 0.6 = 4.8 → round 5
    const intent: EnemyIntent = { type: 'attack', value: 5, bypassDamageCap: false };

    const display = computeIntentDisplayDamage(intent, enemy, {
      canaryEnemyDamageMultiplier: 0.6,
      ascensionEnemyDamageMultiplier: 1,
      difficultyMode: 'normal',
    });
    expect(display).toBe(5);
  });

  it('applyPostIntentDamageScaling: relaxed mode reduces by 0.7×', () => {
    const result = applyPostIntentDamageScaling(20, {
      difficultyMode: 'relaxed',
      canaryEnemyDamageMultiplier: 1,
      ascensionEnemyDamageMultiplier: 1,
    });
    expect(result).toBe(14); // round(20 * 0.7) = 14
  });

  it('applyPostIntentDamageScaling: ascension multiplier 1.5 applied', () => {
    const result = applyPostIntentDamageScaling(10, {
      difficultyMode: 'normal',
      canaryEnemyDamageMultiplier: 1,
      ascensionEnemyDamageMultiplier: 1.5,
    });
    expect(result).toBe(15); // round(10 * 1.5) = 15
  });

  it('applyPostIntentDamageScaling: both canary and ascension stack multiplicatively', () => {
    const result = applyPostIntentDamageScaling(20, {
      difficultyMode: 'normal',
      canaryEnemyDamageMultiplier: 0.6,
      ascensionEnemyDamageMultiplier: 1.5,
    });
    // 20 * 0.6 * 1.5 = 18
    expect(result).toBe(18);
  });

  it('display without scalingCtx matches display with default (1×) multipliers', () => {
    const enemy = makeEnemy();
    const intent: EnemyIntent = { type: 'attack', value: 18 };

    const noCtx = computeIntentDisplayDamage(intent, enemy);
    const defaultCtx = computeIntentDisplayDamage(intent, enemy, {
      canaryEnemyDamageMultiplier: 1,
      ascensionEnemyDamageMultiplier: 1,
      difficultyMode: 'normal',
    });

    expect(noCtx).toBe(defaultCtx);
  });

  it('difficultyVariance 1.2 with small value (no cap): round(10*1*1.0*2.0=20, *1.2) = 24, capped to 16', () => {
    const enemy = makeEnemy({ difficultyVariance: 1.2 });
    // 10 * 1 * 1.0 * 2.0 = 20, then 20 * 1.2 = 24, capped to 16
    const intent: EnemyIntent = { type: 'attack', value: 10 };

    const display = computeIntentDisplayDamage(intent, enemy, {
      canaryEnemyDamageMultiplier: 1,
      ascensionEnemyDamageMultiplier: 1,
      difficultyMode: 'normal',
    });
    expect(display).toBe(16); // 24 capped to segment-1 cap of 16
  });

  it('difficultyVariance 0.8 with small value: round(5*1*1.0*1.5=8, *0.8) = 6 (below cap)', () => {
    const enemy = makeEnemy({ difficultyVariance: 0.8 });
    // 5 * 1 * 1.0 * 1.5 = 7.5 → round 8, then 8 * 0.8 = 6.4 → round 6 (below cap=16)
    const intent: EnemyIntent = { type: 'attack', value: 5 };

    const display = computeIntentDisplayDamage(intent, enemy, {
      canaryEnemyDamageMultiplier: 1,
      ascensionEnemyDamageMultiplier: 1,
      difficultyMode: 'normal',
    });
    expect(display).toBe(6);
  });

  it('non-attack intents (defend) return 0', () => {
    const enemy = makeEnemy();
    const intent: EnemyIntent = { type: 'defend', value: 10 };

    const display = computeIntentDisplayDamage(intent, enemy, {
      canaryEnemyDamageMultiplier: 0.6,
      ascensionEnemyDamageMultiplier: 1,
      difficultyMode: 'normal',
    });

    expect(display).toBe(0);
  });

  it('non-attack intents (buff) return 0', () => {
    const enemy = makeEnemy();
    const intent: EnemyIntent = { type: 'buff', value: 5 };

    const display = computeIntentDisplayDamage(intent, enemy);
    expect(display).toBe(0);
  });
});
