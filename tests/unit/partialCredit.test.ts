/**
 * Unit tests for the partial credit pipeline.
 *
 * Verifies that the partialAccuracy field in AdvancedResolveOptions correctly
 * interpolates damage between charge-wrong (0.0) and charge-correct (1.0) values.
 *
 * Key invariant: when partialAccuracy is undefined, behaviour MUST be identical
 * to the existing binary CC/CW logic. All === undefined guards in the implementation
 * exist specifically to preserve backward compatibility.
 *
 * Using the 'strike' mechanic at mastery 0 for predictable numbers:
 *   quickPlayValue = 4, chargeWrongValue = 3, masteryBonus = 0
 *   CW  = max(0, 3 + 0) = 3
 *   CC  = round(4 * 1.50) = 6
 *   midpoint (0.5) = round(3 + (6-3)*0.5) = round(4.5) = 5
 */
import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(mechanicId: string, overrides?: Partial<Card>): Card {
  const mechanic = getMechanicDefinition(mechanicId);
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: (mechanic?.type ?? 'attack') as CardType,
    domain: 'test',
    tier: '1',
    baseEffectValue: mechanic?.baseValue ?? 8,
    effectMultiplier: 1.0,
    apCost: mechanic?.apCost ?? 1,
    mechanicId,
    mechanicName: mechanic?.name,
    secondaryValue: mechanic?.secondaryValue,
    ...overrides,
  };
}

function makePlayer(overrides?: Partial<PlayerCombatState>): PlayerCombatState {
  return {
    hp: 80,
    maxHP: 80,
    shield: 0,
    statusEffects: [],
    comboCount: 0,
    hintsRemaining: 1,
    cardsPlayedThisTurn: 0,
    ...overrides,
  };
}

function makeEnemy(overrides?: Partial<EnemyInstance>): EnemyInstance {
  const template: EnemyTemplate = {
    id: 'test-enemy',
    name: 'Test Enemy',
    category: 'common',
    baseHP: 100,
    intentPool: [{ type: 'attack', value: 10, weight: 1, telegraph: 'Strike' }],
    description: 'Test enemy',
  };
  return {
    template,
    currentHP: 100,
    maxHP: 100,
    nextIntent: { type: 'attack', value: 10, weight: 1, telegraph: 'Strike' },
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

/**
 * Resolve a card in a given play mode with an optional partialAccuracy value.
 * Chain multiplier = 1.0, speed bonus = 1.0 to isolate partial credit logic.
 */
function resolve(
  mechanicId: string,
  playMode: 'charge_correct' | 'charge_wrong',
  partialAccuracy?: number,
) {
  const card = makeCard(mechanicId);
  const player = makePlayer();
  const enemy = makeEnemy();
  return resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
    playMode,
    partialAccuracy,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('partial credit — backward compatibility (partialAccuracy undefined)', () => {
  it('CC without partialAccuracy returns normal CC damage (6)', () => {
    // Expected: round(4 * 1.50) = 6
    expect(resolve('strike', 'charge_correct', undefined).damageDealt).toBe(6);
  });

  it('CW without partialAccuracy returns normal CW damage (3)', () => {
    // Expected: max(0, 3 + 0) = 3
    expect(resolve('strike', 'charge_wrong', undefined).damageDealt).toBe(3);
  });
});

describe('partial credit — interpolation at boundary values', () => {
  it('partialAccuracy = 1.0 on CC produces full CC value (6)', () => {
    // At accuracy=1.0: round(CW + (CC - CW) * 1.0) = round(3 + 3*1.0) = round(6) = 6
    expect(resolve('strike', 'charge_correct', 1.0).damageDealt).toBe(6);
  });

  it('partialAccuracy = 0.0 on CC produces CW value (3)', () => {
    // At accuracy=0.0: round(CW + (CC - CW) * 0.0) = round(3 + 3*0.0) = round(3) = 3
    expect(resolve('strike', 'charge_correct', 0.0).damageDealt).toBe(3);
  });

  it('partialAccuracy = 1.0 on CW produces full CC value (6)', () => {
    // Works on CW path too — accuracy overrides the binary CW result
    expect(resolve('strike', 'charge_wrong', 1.0).damageDealt).toBe(6);
  });

  it('partialAccuracy = 0.0 on CW produces CW value (3)', () => {
    expect(resolve('strike', 'charge_wrong', 0.0).damageDealt).toBe(3);
  });
});

describe('partial credit — midpoint interpolation', () => {
  it('partialAccuracy = 0.5 produces midpoint between CW and CC', () => {
    // CW=3, CC=6: midpoint = round(3 + (6-3)*0.5) = round(4.5) = 5
    const result = resolve('strike', 'charge_correct', 0.5);
    expect(result.damageDealt).toBe(5);
  });

  it('partialAccuracy = 0.5 on CW path also produces midpoint', () => {
    const result = resolve('strike', 'charge_wrong', 0.5);
    expect(result.damageDealt).toBe(5);
  });
});

describe('partial credit — intermediate values', () => {
  it('partialAccuracy = 0.33 interpolates correctly', () => {
    // CW=3, CC=6: round(3 + 3*0.33) = round(3 + 0.99) = round(3.99) = 4
    const result = resolve('strike', 'charge_correct', 0.33);
    expect(result.damageDealt).toBe(4);
  });

  it('partialAccuracy = 0.67 interpolates correctly', () => {
    // CW=3, CC=6: round(3 + 3*0.67) = round(3 + 2.01) = round(5.01) = 5
    const result = resolve('strike', 'charge_correct', 0.67);
    expect(result.damageDealt).toBe(5);
  });
});

describe('partial credit — value is always in [CW, CC] range', () => {
  const accuracyValues = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const cwValue = 3;
  const ccValue = 6;

  for (const accuracy of accuracyValues) {
    it(`partialAccuracy = ${accuracy} produces value in [${cwValue}, ${ccValue}]`, () => {
      const result = resolve('strike', 'charge_correct', accuracy);
      expect(result.damageDealt).toBeGreaterThanOrEqual(cwValue);
      expect(result.damageDealt).toBeLessThanOrEqual(ccValue);
    });
  }
});
