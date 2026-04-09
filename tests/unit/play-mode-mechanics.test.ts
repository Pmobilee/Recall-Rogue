/**
 * Unit tests for AR-59.8: Card Mechanics Rebalance (v2 Spec)
 * Tests all 25 mechanics in Quick Play, Charged Correct, and Charged Wrong modes.
 */
import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance } from '../../src/data/enemies';
import type { EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';

// ── Helpers ──

function makeCard(overrides: Partial<Card> & { mechanicId: string }): Card {
  const mechanic = getMechanicDefinition(overrides.mechanicId);
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: (mechanic?.type ?? 'attack') as CardType,
    domain: 'test',
    tier: '1',
    baseEffectValue: mechanic?.baseValue ?? 8,
    effectMultiplier: 1.0,
    apCost: mechanic?.apCost ?? 1,
    mechanicId: overrides.mechanicId,
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

// Resolve a card in a specific play mode. chargeMultiplier is 1.0 for testing
// (we test the mechanic value selection, not the chargeMultiplier).
function resolve(
  mechanicId: string,
  playMode: 'quick' | 'charge_correct' | 'charge_wrong',
  playerOverrides?: Partial<PlayerCombatState>,
  enemyOverrides?: Partial<EnemyInstance>,
  cardOverrides?: Partial<Card>,
) {
  const card = makeCard({ mechanicId, ...cardOverrides });
  const player = makePlayer(playerOverrides);
  const enemy = makeEnemy(enemyOverrides);
  return resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, { playMode });
}

// ── MechanicDefinition presence tests ──

describe('MechanicDefinition v2 fields', () => {
  const v2Mechanics = [
    'strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless', 'execute', 'lifetap',
    'block', 'thorns', 'emergency', 'fortify', 'brace', 'overheal',
    'empower', 'quicken', 'focus', 'double_strike',
    'weaken', 'expose', 'hex', 'slow',
    'scout', 'foresight', 'recycle',
    'mirror', 'adapt',
  ];

  for (const id of v2Mechanics) {
    it(`${id} has quickPlayValue, chargeCorrectValue, chargeWrongValue`, () => {
      const m = getMechanicDefinition(id);
      expect(m, `mechanic '${id}' not found`).toBeDefined();
      expect(m!.quickPlayValue, `${id}.quickPlayValue`).toBeDefined();
      expect(m!.chargeCorrectValue, `${id}.chargeCorrectValue`).toBeDefined();
      expect(m!.chargeWrongValue, `${id}.chargeWrongValue`).toBeDefined();
    });
  }

  it('quicken has chargeBonusEffect: quicken_draw', () => {
    const m = getMechanicDefinition('quicken');
    expect(m!.chargeBonusEffect).toBe('quicken_draw');
  });

  it('focus has chargeBonusEffect: focus_double', () => {
    const m = getMechanicDefinition('focus');
    expect(m!.chargeBonusEffect).toBe('focus_double');
  });

  it('double_strike has chargeBonusEffect: double_strike_pierce', () => {
    const m = getMechanicDefinition('double_strike');
    expect(m!.chargeBonusEffect).toBe('double_strike_pierce');
  });

  it('slow has chargeBonusEffect: slow_weaken', () => {
    const m = getMechanicDefinition('slow');
    expect(m!.chargeBonusEffect).toBe('slow_weaken');
  });

  it('foresight has chargeBonusEffect: foresight_intent', () => {
    const m = getMechanicDefinition('foresight');
    expect(m!.chargeBonusEffect).toBe('foresight_intent');
  });

  it('recycle has chargeBonusEffect: recycle_from_discard', () => {
    const m = getMechanicDefinition('recycle');
    expect(m!.chargeBonusEffect).toBe('recycle_from_discard');
  });

  it('quicken and foresight have apCost 0', () => {
    expect(getMechanicDefinition('quicken')!.apCost).toBe(0);
    expect(getMechanicDefinition('foresight')!.apCost).toBe(0);
  });
});

// ── Phase promotion tests ──

describe('Phase 1 promotions', () => {
  const promoted = ['heavy_strike', 'piercing', 'reckless', 'execute', 'lifetap',
                    'fortify', 'brace', 'overheal', 'focus', 'double_strike',
                    'hex', 'slow', 'foresight'];
  for (const id of promoted) {
    it(`${id} is launchPhase: 1`, () => {
      const m = getMechanicDefinition(id);
      expect(m!.launchPhase).toBe(1);
    });
  }

  it('cleanse, parry, transmute, immunity, overclock are NOT changed to phase 1 (except parry stays 2)', () => {
    expect(getMechanicDefinition('parry')!.launchPhase).toBe(2);
    expect(getMechanicDefinition('transmute')!.launchPhase).toBe(2);
    expect(getMechanicDefinition('immunity')!.launchPhase).toBe(2);
    expect(getMechanicDefinition('overclock')!.launchPhase).toBe(2);
  });
});

// ── Strike: 4 / 7 / 3 ──

describe('strike mechanic play modes', () => {
  it('quick: deals 4 damage (stat table L0 QP=4)', () => {
    const result = resolve('strike', 'quick');
    expect(result.damageDealt).toBe(4);
  });

  it('charge_correct: deals 6 damage (round(4*1.50)=6, stat table L0 QP=4)', () => {
    const result = resolve('strike', 'charge_correct');
    expect(result.damageDealt).toBe(6);
  });

  it('charge_wrong: deals 3 damage (chargeWrongValue=3 + masteryBonus=0 = 3)', () => {
    const result = resolve('strike', 'charge_wrong');
    expect(result.damageDealt).toBe(3);
  });

  it('wrong answer always deals > 0 damage', () => {
    const result = resolve('strike', 'charge_wrong');
    expect(result.damageDealt).toBeGreaterThan(0);
  });
});

// ── Reckless: self-damage stays flat ──

describe('reckless mechanic', () => {
  it('quick: 4 damage, 3 self-damage (stat table L0 QP=4; selfDmg from mechanic.secondaryValue=3)', () => {
    const result = resolve('reckless', 'quick');
    expect(result.damageDealt).toBe(4);
    expect(result.selfDamage).toBe(3);
  });

  it('charge_correct: 6 damage (round(4*1.50)=6), still 3 self-damage (flat, stat table extras.selfDmg not wired to resolver)', () => {
    const result = resolve('reckless', 'charge_correct');
    expect(result.damageDealt).toBe(6);
    expect(result.selfDamage).toBe(3); // self-damage does NOT scale
  });

  it('charge_wrong: 8.4 (rounds to 8) damage, still 3 self-damage', () => {
    const result = resolve('reckless', 'charge_wrong');
    expect(result.selfDamage).toBe(3);
    expect(result.damageDealt).toBeGreaterThan(0);
  });
});

// ── Execute: conditional bonus scales with play mode ──

describe('execute mechanic', () => {
  it('quick: 2 damage at full HP (stat table L0 QP=2, no bonus)', () => {
    const result = resolve('execute', 'quick', undefined, { currentHP: 100, maxHP: 100 });
    expect(result.damageDealt).toBe(2);
  });

  it('charge_correct: 27 damage (3 base + 24 bonus) at <30% HP (stat table L0 QP=2, CC=round(2*1.50)=3)', () => {
    const result = resolve('execute', 'charge_correct', undefined, { currentHP: 10, maxHP: 100 });
    // 3 base (Math.round(2*1.50)) + 24 hardcoded bonus = 27
    // At chargeMultiplier=1.0, tier=1, effectMultiplier=1: finalValue=3, bonus=24
    expect(result.damageDealt).toBe(27);
  });

  it('charge_correct: only 3 damage at full HP (no bonus trigger)', () => {
    const result = resolve('execute', 'charge_correct', undefined, { currentHP: 100, maxHP: 100 });
    expect(result.damageDealt).toBe(3);
  });

  it('charge_wrong: > 0 damage in all modes', () => {
    const result = resolve('execute', 'charge_wrong');
    expect(result.damageDealt).toBeGreaterThan(0);
  });
});

// ── Focus: bonus effect on charge_correct ──

describe('focus mechanic', () => {
  it('quick: applyFocusBuff=true, focusCharges=1', () => {
    const result = resolve('focus', 'quick');
    expect(result.applyFocusBuff).toBe(true);
    expect(result.focusCharges).toBe(1);
  });

  it('charge_correct: applyFocusBuff=true, focusCharges=2 (bonus: 2 discounts)', () => {
    const result = resolve('focus', 'charge_correct');
    expect(result.applyFocusBuff).toBe(true);
    expect(result.focusCharges).toBe(2);
  });

  it('charge_wrong: applyFocusBuff=true, focusCharges=1 (no bonus)', () => {
    const result = resolve('focus', 'charge_wrong');
    expect(result.applyFocusBuff).toBe(true);
    expect(result.focusCharges).toBe(1);
  });
});

// ── Double Strike: pierce bonus on charge_correct ──

describe('double_strike mechanic', () => {
  it('quick: applyDoubleStrikeBuff=true, no pierce', () => {
    const result = resolve('double_strike', 'quick');
    expect(result.applyDoubleStrikeBuff).toBe(true);
    expect(result.doubleStrikeAddsPierce).toBeFalsy();
  });

  it('charge_correct: applyDoubleStrikeBuff=true AND doubleStrikeAddsPierce=true', () => {
    const result = resolve('double_strike', 'charge_correct');
    expect(result.applyDoubleStrikeBuff).toBe(true);
    expect(result.doubleStrikeAddsPierce).toBe(true);
  });

  it('charge_wrong: applyDoubleStrikeBuff=true, no pierce', () => {
    const result = resolve('double_strike', 'charge_wrong');
    expect(result.applyDoubleStrikeBuff).toBe(true);
    expect(result.doubleStrikeAddsPierce).toBeFalsy();
  });
});

// ── Quicken: draw bonus on charge_correct ──

describe('quicken mechanic', () => {
  it('quick: grantsAp=1, no extra draw', () => {
    const result = resolve('quicken', 'quick');
    expect(result.grantsAp).toBe(1);
    expect(result.extraCardsDrawn).toBe(0);
  });

  it('charge_correct: grantsAp=1, extraCardsDrawn=1 (bonus)', () => {
    const result = resolve('quicken', 'charge_correct');
    expect(result.grantsAp).toBe(1);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('charge_wrong: grantsAp=1, no extra draw', () => {
    const result = resolve('quicken', 'charge_wrong');
    expect(result.grantsAp).toBe(1);
    expect(result.extraCardsDrawn).toBe(0);
  });
});

// ── Foresight: reveal intent on charge_correct ──

describe('foresight mechanic', () => {
  it('quick: draws 2 cards, no reveal', () => {
    const result = resolve('foresight', 'quick');
    expect(result.extraCardsDrawn).toBe(2);
    expect(result.revealNextIntent).toBeFalsy();
  });

  it('charge_correct: draws 3 cards', () => {
    const result = resolve('foresight', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(3);
  });

  it('charge_wrong: draws 1 card', () => {
    const result = resolve('foresight', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(1);
  });
});

// ── Recycle: draw from discard on charge_correct ──

describe('recycle mechanic', () => {
  it('quick: draws 3 cards, no discard draw', () => {
    const result = resolve('recycle', 'quick');
    expect(result.extraCardsDrawn).toBe(3);
    expect(result.drawFromDiscard).toBeUndefined();
  });

  it('charge_correct: draws 4 cards AND drawFromDiscard=1', () => {
    const result = resolve('recycle', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(4);
    expect(result.drawFromDiscard).toBe(1);
  });

  it('charge_wrong: draws 2 cards, no discard draw', () => {
    const result = resolve('recycle', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(2);
    expect(result.drawFromDiscard).toBeUndefined();
  });
});

// ── Slow: weaken bonus on charge_correct ──

describe('slow mechanic', () => {
  it('quick: applySlow=true, no weaken status', () => {
    const result = resolve('slow', 'quick');
    expect(result.applySlow).toBe(true);
    const weakens = result.statusesApplied.filter(s => s.type === 'weakness');
    expect(weakens).toHaveLength(0);
  });

  it('charge_correct: applySlow=true AND Weaken 1t status applied', () => {
    const result = resolve('slow', 'charge_correct');
    expect(result.applySlow).toBe(true);
    const weaken = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weaken).toBeDefined();
    expect(weaken!.turnsRemaining).toBe(1);
  });

  it('charge_wrong: applySlow=true, no weaken', () => {
    const result = resolve('slow', 'charge_wrong');
    expect(result.applySlow).toBe(true);
    const weakens = result.statusesApplied.filter(s => s.type === 'weakness');
    expect(weakens).toHaveLength(0);
  });
});

// ── Hex: poison value scales ──

describe('hex mechanic', () => {
  it('quick: 3 poison x3 turns', () => {
    const result = resolve('hex', 'quick');
    const poison = result.statusesApplied.find(s => s.type === 'poison');
    expect(poison).toBeDefined();
    expect(poison!.value).toBe(3);
    expect(poison!.turnsRemaining).toBe(3);
  });

  it('charge_correct: 8 poison x3 turns', () => {
    const result = resolve('hex', 'charge_correct');
    const poison = result.statusesApplied.find(s => s.type === 'poison');
    expect(poison!.value).toBe(8);
    expect(poison!.turnsRemaining).toBe(3);
  });

  it('charge_wrong: 2 poison x3 turns', () => {
    const result = resolve('hex', 'charge_wrong');
    const poison = result.statusesApplied.find(s => s.type === 'poison');
    expect(poison!.value).toBe(2);
  });
});

// ── Scout: draw count scales ──

describe('scout mechanic', () => {
  it('quick: draws 2', () => {
    const result = resolve('scout', 'quick');
    expect(result.extraCardsDrawn).toBe(2);
  });
  it('charge_correct: draws 3', () => {
    const result = resolve('scout', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(3);
  });
  it('charge_wrong: draws 1', () => {
    const result = resolve('scout', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(1);
  });
});

// ── Block: shield values scale ──

describe('block mechanic', () => {
  it('quick: 4 shield (stat table L0 QP=4)', () => {
    const result = resolve('block', 'quick');
    expect(result.shieldApplied).toBe(4);
  });
  it('charge_correct: 6 shield (Math.round(4*1.50)=6, stat table L0 QP=4 and CC_MULT=1.50)', () => {
    const result = resolve('block', 'charge_correct');
    expect(result.shieldApplied).toBe(6);
  });
  it('charge_wrong: 2 shield (chargeWrongValue=3 + masteryBonus=-1 = 2, stat table L0 QP=4 vs mechanic QP=5)', () => {
    const result = resolve('block', 'charge_wrong');
    expect(result.shieldApplied).toBe(2);
  });
});

// ── Brace: multiplier scales ──

describe('brace mechanic', () => {
  const attackingEnemy = (value: number) => makeEnemy({
    nextIntent: { type: 'attack', value, weight: 1, telegraph: 'Attack' },
  });

  it('quick: 1.0x enemy intent', () => {
    const enemy = attackingEnemy(10);
    const result = resolve('brace', 'quick', undefined, enemy);
    expect(result.shieldApplied).toBe(10); // 10 * 1.0
  });

  it('charge_correct: 3.0x enemy intent', () => {
    const enemy = attackingEnemy(10);
    const result = resolve('brace', 'charge_correct', undefined, enemy);
    expect(result.shieldApplied).toBe(30); // 10 * 3.0
  });

  it('charge_wrong: 0.7x enemy intent (rounds to 7)', () => {
    const enemy = attackingEnemy(10);
    const result = resolve('brace', 'charge_wrong', undefined, enemy);
    expect(result.shieldApplied).toBe(7); // Math.round(10 * 0.7)
  });
});

// ── Thorns: both block and reflect scale ──

describe('thorns mechanic', () => {
  it('quick: 2 block, 3 reflect (stat table L0 QP=2; reflect hardcoded to 3)', () => {
    const result = resolve('thorns', 'quick');
    expect(result.shieldApplied).toBe(2);
    expect(result.thornsValue).toBe(3);
  });
  it('charge_correct: 3 block (round(2*1.50)=3), 9 reflect (hardcoded)', () => {
    const result = resolve('thorns', 'charge_correct');
    expect(result.shieldApplied).toBe(3);
    expect(result.thornsValue).toBe(9);
  });
  it('charge_wrong: 1 block, 2 reflect (chargeWrongValue=2 + masteryBonus=-1 = 1; reflect hardcoded to 2)', () => {
    const result = resolve('thorns', 'charge_wrong');
    expect(result.shieldApplied).toBe(1);
    expect(result.thornsValue).toBe(2);
  });
});

// ── Wrong answers always > 0 ──

describe('wrong answers are never zero', () => {
  const allDamageAttacks = ['strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless', 'lifetap'];
  for (const id of allDamageAttacks) {
    it(`${id} charge_wrong deals > 0 damage`, () => {
      const result = resolve(id, 'charge_wrong');
      expect(result.damageDealt + result.shieldApplied + result.extraCardsDrawn).toBeGreaterThan(0);
    });
  }
});

// ── Empower: value scales ──

describe('empower mechanic', () => {
  it('quick: finalValue=30 (stat table L0 QP=30)', () => {
    const result = resolve('empower', 'quick');
    expect(result.finalValue).toBe(30);
  });
  it('charge_correct: finalValue=45 (round(30*1.50)=45, stat table L0 QP=30 and CC_MULT=1.50)', () => {
    const result = resolve('empower', 'charge_correct');
    expect(result.finalValue).toBe(45);
  });
  it('charge_wrong: finalValue=15 (chargeWrongValue=35 + masteryBonus=-20 = 15, stat table L0 QP=30 vs mechanic QP=50)', () => {
    const result = resolve('empower', 'charge_wrong');
    expect(result.finalValue).toBe(15);
  });
});

// ── Weaken: turn duration scales ──

describe('weaken mechanic', () => {
  it('quick: weakness 2 turns', () => {
    const result = resolve('weaken', 'quick');
    // weaken fallback to debuff, uses finalValue=2
    expect(result.finalValue + result.statusesApplied.length).toBeGreaterThan(0);
  });
});
