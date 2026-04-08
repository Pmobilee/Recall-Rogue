/**
 * Unit tests for Phase 1 Buff and Debuff card mechanics.
 * Covers: empower, quicken, focus, double_strike, ignite, inscription_fury, inscription_iron (buffs)
 *         weaken, expose, hex, slow, sap, lacerate, stagger, corrode (debuffs)
 *
 * All values come from mechanic definitions in src/data/mechanics.ts
 * and resolver cases in src/services/cardEffectResolver.ts.
 *
 * IMPORTANT: Values depend on getMasteryStats() at L0, NOT mechanic.quickPlayValue.
 * The MASTERY_STAT_TABLES in cardUpgradeService.ts override mechanic.quickPlayValue.
 * masteryBonus = stats.qpValue(L0) - mechanic.quickPlayValue (can be negative!)
 * CW damage = Math.max(0, mechanic.chargeWrongValue + masteryBonus)
 *
 * Observed gotchas:
 * - empower: mechanic QP=50 but stat table L0 qpValue=30 → resolver uses 30
 * - ignite: stat table qpValue=0 for all levels (burn stacks in extras) → applyIgniteBuff=0 at L0
 * - sap CW: chargeWrongValue=1 + masteryBonus(L0)=-1 = 0, so CW deals 0 damage at L0
 * - inscription_iron CW: same pattern — CW finalValue=0 at L0
 */
import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance } from '../../src/data/enemies';
import type { EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';

// ── Helpers ─────────────────────────────────────────────────────────────────

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

/** Resolve a card in a specific play mode at mastery 0 (no bonus). */
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

// ── MechanicDefinition presence ──────────────────────────────────────────────

describe('MechanicDefinition presence — buff and debuff mechanics', () => {
  const mechanics = [
    'empower', 'quicken', 'focus', 'double_strike', 'ignite',
    'inscription_fury', 'inscription_iron',
    'weaken', 'expose', 'hex', 'slow', 'sap', 'lacerate', 'stagger', 'corrode',
  ];

  for (const id of mechanics) {
    it(`${id} has required fields`, () => {
      const m = getMechanicDefinition(id);
      expect(m, `mechanic '${id}' not found`).toBeDefined();
      expect(m!.quickPlayValue, `${id}.quickPlayValue`).toBeDefined();
      expect(m!.chargeWrongValue, `${id}.chargeWrongValue`).toBeDefined();
      expect(m!.launchPhase, `${id}.launchPhase`).toBe(1);
    });
  }
});

// ── Empower (buff) ────────────────────────────────────────────────────────────
// Mechanic: empower — next card deals % more damage (via buffNextCard% in turnManager)
// Stat table L0: qpValue=30 (NOT mechanic.quickPlayValue=50 — stat table overrides!)
// QP finalValue=30; CC=round(30*1.75)=53; CW=Math.max(0, 35+(-20))=15

describe('empower mechanic', () => {
  it('quick: finalValue=30 (stat table L0 qpValue=30, not mechanic quickPlayValue=50)', () => {
    const result = resolve('empower', 'quick');
    expect(result.finalValue).toBe(30);
  });

  it('charge_correct: finalValue=53 (round(30*1.75)=53)', () => {
    const result = resolve('empower', 'charge_correct');
    expect(result.finalValue).toBe(53);
  });

  it('charge_wrong: finalValue=15 (chargeWrongValue=35 + masteryBonus(L0)=-20)', () => {
    const result = resolve('empower', 'charge_wrong');
    expect(result.finalValue).toBe(15);
  });

  it('CC finalValue > QP finalValue > CW finalValue', () => {
    const cc = resolve('empower', 'charge_correct').finalValue;
    const qp = resolve('empower', 'quick').finalValue;
    const cw = resolve('empower', 'charge_wrong').finalValue;
    expect(cc).toBeGreaterThan(qp);
    expect(qp).toBeGreaterThan(cw);
  });

  it('no damage is dealt (empower is a buff, not an attack)', () => {
    const result = resolve('empower', 'quick');
    expect(result.damageDealt).toBe(0);
  });

  it('no shield applied (empower is not a defensive card)', () => {
    const result = resolve('empower', 'quick');
    expect(result.shieldApplied).toBe(0);
  });
});

// ── Quicken (buff) ────────────────────────────────────────────────────────────
// Mechanic: quicken — gain +1 AP this turn; CC bonus: also draw 1 card
// Stat table L0: qpValue=1 (matches mechanic.quickPlayValue=1)

describe('quicken mechanic', () => {
  it('quick: grantsAp=1, no extra draw', () => {
    const result = resolve('quicken', 'quick');
    expect(result.grantsAp).toBe(1);
    expect(result.extraCardsDrawn).toBe(0);
  });

  it('charge_correct: grantsAp=1 AND extraCardsDrawn=1 (quicken_draw bonus)', () => {
    const result = resolve('quicken', 'charge_correct');
    expect(result.grantsAp).toBe(1);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('charge_wrong: grantsAp=1, no extra draw', () => {
    const result = resolve('quicken', 'charge_wrong');
    expect(result.grantsAp).toBe(1);
    expect(result.extraCardsDrawn).toBe(0);
  });

  it('quicken has apCost 0 (free to play)', () => {
    const m = getMechanicDefinition('quicken');
    expect(m!.apCost).toBe(0);
  });

  it('no damage dealt and no shield (pure AP grant)', () => {
    const result = resolve('quicken', 'quick');
    expect(result.damageDealt).toBe(0);
    expect(result.shieldApplied).toBe(0);
  });

  it('has chargeBonusEffect: quicken_draw', () => {
    const m = getMechanicDefinition('quicken');
    expect(m!.chargeBonusEffect).toBe('quicken_draw');
  });
});

// ── Focus (buff) ──────────────────────────────────────────────────────────────
// Mechanic: focus — next card costs 1 less AP; CC: double effect (2 focus charges)
// Values: applyFocusBuff=true; QP focusCharges=1; CC focusCharges=2

describe('focus mechanic', () => {
  it('quick: applyFocusBuff=true, focusCharges=1', () => {
    const result = resolve('focus', 'quick');
    expect(result.applyFocusBuff).toBe(true);
    expect(result.focusCharges).toBe(1);
  });

  it('charge_correct: applyFocusBuff=true, focusCharges=2 (double effect)', () => {
    const result = resolve('focus', 'charge_correct');
    expect(result.applyFocusBuff).toBe(true);
    expect(result.focusCharges).toBe(2);
  });

  it('charge_wrong: applyFocusBuff=true, focusCharges=1 (no bonus)', () => {
    const result = resolve('focus', 'charge_wrong');
    expect(result.applyFocusBuff).toBe(true);
    expect(result.focusCharges).toBe(1);
  });

  it('has chargeBonusEffect: focus_double', () => {
    const m = getMechanicDefinition('focus');
    expect(m!.chargeBonusEffect).toBe('focus_double');
  });

  it('no damage dealt (focus is a buff, not an attack)', () => {
    const result = resolve('focus', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Double Strike (buff) ──────────────────────────────────────────────────────
// Mechanic: double_strike — next attack hits twice at full power
// CC bonus: also pierces (doubleStrikeAddsPierce)

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

  it('has chargeBonusEffect: double_strike_pierce', () => {
    const m = getMechanicDefinition('double_strike');
    expect(m!.chargeBonusEffect).toBe('double_strike_pierce');
  });

  it('no damage dealt directly (double_strike is a buff that activates on next attack)', () => {
    const result = resolve('double_strike', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Ignite (buff) ─────────────────────────────────────────────────────────────
// Mechanic: ignite — next attack applies Burn stacks
// Stat table: qpValue=0 for ALL levels (burn stacks live in extras.burnStacks, not qpValue)
// At L0: applyIgniteBuff = finalValue = 0 (the extras.burnStacks=2 is not wired to applyIgniteBuff)
//
// NOTE: This is a known behavior where the resolver comment ("QP=4, CC=8, CW=2") is stale.
// The actual resolver reads finalValue (which is 0 at L0 from stat table qpValue=0).
// Higher mastery levels that also set qpValue=0 produce the same result.
// The extras.burnStacks mechanism is NOT wired to result.applyIgniteBuff in the resolver.

describe('ignite mechanic', () => {
  it('has ignite definition with burn tag', () => {
    const m = getMechanicDefinition('ignite');
    expect(m).toBeDefined();
    expect(m!.tags).toContain('burn');
    expect(m!.tags).toContain('buff');
  });

  it('resolver returns applyIgniteBuff field set (even if 0 at L0)', () => {
    const result = resolve('ignite', 'quick');
    // At L0, stat table qpValue=0 → finalValue=0 → applyIgniteBuff=0
    // The burn stacks are in extras.burnStacks=2 which is not wired to resolver output
    expect(result.applyIgniteBuff).toBeDefined();
    expect(result.applyIgniteBuff).toBe(0);
  });

  it('CC also resolves to applyIgniteBuff=0 at L0 (stat table qpValue=0)', () => {
    const result = resolve('ignite', 'charge_correct');
    // round(0 * 1.75) = 0
    expect(result.applyIgniteBuff).toBe(0);
  });

  it('no damage dealt directly (ignite is a buff card)', () => {
    const result = resolve('ignite', 'quick');
    expect(result.damageDealt).toBe(0);
  });

  it('no shield applied (ignite is not a defensive card)', () => {
    const result = resolve('ignite', 'quick');
    expect(result.shieldApplied).toBe(0);
  });

  it('apCost is 1 (standard cost)', () => {
    const m = getMechanicDefinition('ignite');
    expect(m!.apCost).toBe(1);
  });
});

// ── Inscription of Fury (buff/inscription) ────────────────────────────────────
// Mechanic: inscription_fury — all attacks deal +N flat damage rest of combat; exhausts
// Stat table L0: qpValue=1 (mechanic quickPlayValue=1, so masteryBonus=0)
// QP finalValue=1; CC=round(1*1.75)=2 (rounds to 2); CW=chargeWrongValue=1+masteryBonus=0... wait
// mechanic.chargeWrongValue=1 for inscription_fury, masteryBonus=1-1=0, so CW=1

describe('inscription_fury mechanic', () => {
  it('quick: finalValue=1 (stat table L0 qpValue=1)', () => {
    const result = resolve('inscription_fury', 'quick');
    expect(result.finalValue).toBe(1);
  });

  it('charge_correct: finalValue > QP value (CC scales bonus)', () => {
    const qpResult = resolve('inscription_fury', 'quick');
    const ccResult = resolve('inscription_fury', 'charge_correct');
    expect(ccResult.finalValue).toBeGreaterThan(qpResult.finalValue);
  });

  it('charge_wrong: finalValue=1 (chargeWrongValue=1, masteryBonus at L0 is 0)', () => {
    const result = resolve('inscription_fury', 'charge_wrong');
    // mechanic.chargeWrongValue=1, masteryBonus=qpValue(1)-quickPlayValue(1)=0 → CW=1
    expect(result.finalValue).toBe(1);
  });

  it('has inscription tag (exhausts after use)', () => {
    const m = getMechanicDefinition('inscription_fury');
    expect(m!.tags).toContain('inscription');
  });

  it('maxPerPool is 1 (unique inscription)', () => {
    const m = getMechanicDefinition('inscription_fury');
    expect(m!.maxPerPool).toBe(1);
  });

  it('no damage dealt directly (inscription registers a persistent bonus)', () => {
    const result = resolve('inscription_fury', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Inscription of Iron (buff/inscription) ────────────────────────────────────
// Mechanic: inscription_iron — gain block at start of each turn rest of combat
// Stat table L0: qpValue=1 (mechanic quickPlayValue=2 → masteryBonus=-1)
// QP finalValue=1; CC=round(1*1.75)=2; CW=Math.max(0, chargeWrongValue=1 + masteryBonus=-1)=0

describe('inscription_iron mechanic', () => {
  it('quick: finalValue=1 (stat table L0 qpValue=1)', () => {
    const result = resolve('inscription_iron', 'quick');
    expect(result.finalValue).toBe(1);
  });

  it('charge_correct: finalValue >= 1 (CC scales block per turn)', () => {
    const result = resolve('inscription_iron', 'charge_correct');
    expect(result.finalValue).toBeGreaterThanOrEqual(1);
  });

  it('charge_correct: finalValue > QP value', () => {
    const qpResult = resolve('inscription_iron', 'quick');
    const ccResult = resolve('inscription_iron', 'charge_correct');
    expect(ccResult.finalValue).toBeGreaterThan(qpResult.finalValue);
  });

  it('charge_wrong: finalValue=0 at L0 (chargeWrongValue=1 + masteryBonus=-1 = 0, max with 0)', () => {
    const result = resolve('inscription_iron', 'charge_wrong');
    // chargeWrongValue=1, masteryBonus=qpValue(1)-quickPlayValue(2)=-1 → CW=max(0,0)=0
    expect(result.finalValue).toBe(0);
  });

  it('has inscription tag (exhausts after use)', () => {
    const m = getMechanicDefinition('inscription_iron');
    expect(m!.tags).toContain('inscription');
  });

  it('maxPerPool is 1 (unique inscription)', () => {
    const m = getMechanicDefinition('inscription_iron');
    expect(m!.maxPerPool).toBe(1);
  });

  it('no damage dealt directly (inscription registers a persistent block bonus)', () => {
    const result = resolve('inscription_iron', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Weaken (debuff) ───────────────────────────────────────────────────────────
// Mechanic: weaken — apply weakness stacks to enemy
// QP: weakness 1 stack, 1 turn; CC: weakness N stacks, 2 turns; CW: weakness 1 stack, 1 turn

describe('weaken mechanic', () => {
  it('quick: applies weakness status with >= 1 stack', () => {
    const result = resolve('weaken', 'quick');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.value).toBeGreaterThanOrEqual(1);
  });

  it('quick: weakness lasts 1 turn', () => {
    const result = resolve('weaken', 'quick');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness!.turnsRemaining).toBe(1);
  });

  it('charge_correct: weakness lasts 2 turns (extended on CC)', () => {
    const result = resolve('weaken', 'charge_correct');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.turnsRemaining).toBe(2);
  });

  it('charge_correct: weakness value >= QP value (CC scales stacks)', () => {
    const qpResult = resolve('weaken', 'quick');
    const ccResult = resolve('weaken', 'charge_correct');
    const qpWeakness = qpResult.statusesApplied.find(s => s.type === 'weakness')!;
    const ccWeakness = ccResult.statusesApplied.find(s => s.type === 'weakness')!;
    expect(ccWeakness.value).toBeGreaterThanOrEqual(qpWeakness.value);
  });

  it('charge_wrong: applies weakness with >= 1 stack', () => {
    const result = resolve('weaken', 'charge_wrong');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.value).toBeGreaterThanOrEqual(1);
  });

  it('no damage dealt (weaken is a pure debuff)', () => {
    const result = resolve('weaken', 'quick');
    expect(result.damageDealt).toBe(0);
  });

  it('no shield applied', () => {
    const result = resolve('weaken', 'quick');
    expect(result.shieldApplied).toBe(0);
  });
});

// ── Expose (debuff) ───────────────────────────────────────────────────────────
// Mechanic: expose — apply vulnerable stacks to enemy
// QP: vulnerable 1 stack, 1 turn; CC: vulnerable N stacks, 2 turns; CW: vulnerable 1 stack, 1 turn

describe('expose mechanic', () => {
  it('quick: applies vulnerable status with >= 1 stack', () => {
    const result = resolve('expose', 'quick');
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.value).toBeGreaterThanOrEqual(1);
  });

  it('quick: vulnerable lasts 1 turn', () => {
    const result = resolve('expose', 'quick');
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln!.turnsRemaining).toBe(1);
  });

  it('charge_correct: vulnerable lasts 2 turns (extended on CC)', () => {
    const result = resolve('expose', 'charge_correct');
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.turnsRemaining).toBe(2);
  });

  it('charge_wrong: applies vulnerable with >= 1 stack', () => {
    const result = resolve('expose', 'charge_wrong');
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.value).toBeGreaterThanOrEqual(1);
  });

  it('no damage dealt (expose is a pure debuff)', () => {
    const result = resolve('expose', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Hex (debuff) ──────────────────────────────────────────────────────────────
// Mechanic: hex — apply poison 3 for 3 turns
// QP: poison value=3, turns=3; CC: poison value=8, turns=3; CW: poison value=2, turns=3

describe('hex mechanic', () => {
  it('quick: applies poison 3 for 3 turns', () => {
    const result = resolve('hex', 'quick');
    const poison = result.statusesApplied.find(s => s.type === 'poison');
    expect(poison).toBeDefined();
    expect(poison!.value).toBe(3);
    expect(poison!.turnsRemaining).toBe(3);
  });

  it('charge_correct: applies poison 8 for 3 turns', () => {
    const result = resolve('hex', 'charge_correct');
    const poison = result.statusesApplied.find(s => s.type === 'poison');
    expect(poison).toBeDefined();
    expect(poison!.value).toBe(8);
    expect(poison!.turnsRemaining).toBe(3);
  });

  it('charge_wrong: applies poison 2 for 3 turns', () => {
    const result = resolve('hex', 'charge_wrong');
    const poison = result.statusesApplied.find(s => s.type === 'poison');
    expect(poison).toBeDefined();
    expect(poison!.value).toBe(2);
    expect(poison!.turnsRemaining).toBe(3);
  });

  it('CC poison value > QP poison value > CW poison value', () => {
    const ccPoison = resolve('hex', 'charge_correct').statusesApplied.find(s => s.type === 'poison')!;
    const qpPoison = resolve('hex', 'quick').statusesApplied.find(s => s.type === 'poison')!;
    const cwPoison = resolve('hex', 'charge_wrong').statusesApplied.find(s => s.type === 'poison')!;
    expect(ccPoison.value).toBeGreaterThan(qpPoison.value);
    expect(qpPoison.value).toBeGreaterThan(cwPoison.value);
  });

  it('poison duration is always 3 turns across all modes (hardcoded in resolver)', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const result = resolve('hex', mode);
      const poison = result.statusesApplied.find(s => s.type === 'poison')!;
      expect(poison.turnsRemaining).toBe(3);
    }
  });

  it('no damage dealt (hex is a pure debuff)', () => {
    const result = resolve('hex', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Slow (debuff) ─────────────────────────────────────────────────────────────
// Mechanic: slow — skip enemy's next defend or buff; CC bonus: also apply Weakness 1t

describe('slow mechanic', () => {
  it('quick: applySlow=true', () => {
    const result = resolve('slow', 'quick');
    expect(result.applySlow).toBe(true);
  });

  it('quick: no weakness status applied', () => {
    const result = resolve('slow', 'quick');
    const weaknesses = result.statusesApplied.filter(s => s.type === 'weakness');
    expect(weaknesses).toHaveLength(0);
  });

  it('charge_correct: applySlow=true', () => {
    const result = resolve('slow', 'charge_correct');
    expect(result.applySlow).toBe(true);
  });

  it('charge_correct: also applies Weakness 1t (slow_weaken bonus)', () => {
    const result = resolve('slow', 'charge_correct');
    const weaken = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weaken).toBeDefined();
    expect(weaken!.turnsRemaining).toBe(1);
  });

  it('charge_wrong: applySlow=true, no weakness (no bonus on CW)', () => {
    const result = resolve('slow', 'charge_wrong');
    expect(result.applySlow).toBe(true);
    const weaknesses = result.statusesApplied.filter(s => s.type === 'weakness');
    expect(weaknesses).toHaveLength(0);
  });

  it('has chargeBonusEffect: slow_weaken', () => {
    const m = getMechanicDefinition('slow');
    expect(m!.chargeBonusEffect).toBe('slow_weaken');
  });

  it('no damage dealt (slow is a pure debuff)', () => {
    const result = resolve('slow', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Sap (debuff) ──────────────────────────────────────────────────────────────
// Mechanic: sap — deal damage AND apply Weakness 1 stack
// Stat table L0: qpValue=1 (mechanic quickPlayValue=2 → masteryBonus=-1)
// QP: finalValue=1, damage=1; CC: finalValue=round(1*1.75)=2; CW: max(0, 1+(-1))=0 — no damage at L0!

describe('sap mechanic', () => {
  it('quick: deals damage > 0 (L0 qpValue=1)', () => {
    const result = resolve('sap', 'quick');
    expect(result.damageDealt).toBeGreaterThan(0);
  });

  it('quick: applies weakness with 1 turn duration', () => {
    const result = resolve('sap', 'quick');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.turnsRemaining).toBe(1);
  });

  it('charge_correct: deals more damage than QP', () => {
    const qpResult = resolve('sap', 'quick');
    const ccResult = resolve('sap', 'charge_correct');
    expect(ccResult.damageDealt).toBeGreaterThan(qpResult.damageDealt);
  });

  it('charge_correct: weakness lasts 2 turns', () => {
    const result = resolve('sap', 'charge_correct');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.turnsRemaining).toBe(2);
  });

  it('charge_wrong: deals 0 damage at L0 (chargeWrongValue=1 + masteryBonus=-1 = 0)', () => {
    // At L0: stat table qpValue=1, mechanic.quickPlayValue=2 → masteryBonus=-1
    // CW = Math.max(0, chargeWrongValue(1) + (-1)) = 0
    const result = resolve('sap', 'charge_wrong');
    expect(result.damageDealt).toBe(0);
  });

  it('charge_wrong: still applies weakness (weakness always applied regardless of damage)', () => {
    const result = resolve('sap', 'charge_wrong');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
  });

  it('always applies exactly one weakness status across all modes', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const result = resolve('sap', mode);
      const weaknesses = result.statusesApplied.filter(s => s.type === 'weakness');
      expect(weaknesses).toHaveLength(1);
    }
  });

  it('weakness value is always >= 1', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const result = resolve('sap', mode);
      const weakness = result.statusesApplied.find(s => s.type === 'weakness')!;
      expect(weakness.value).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Lacerate (debuff) ─────────────────────────────────────────────────────────
// Mechanic: lacerate — deal damage AND apply Bleed stacks
// Stat table L0: qpValue=2 (matches mechanic quickPlayValue=2, masteryBonus=0)
// QP: damage=2, bleed=4; CC: damage=round(2*1.75)=4, bleed=8; CW: damage=max(0,2+0)=2, bleed=2

describe('lacerate mechanic', () => {
  it('quick: deals damage > 0', () => {
    const result = resolve('lacerate', 'quick');
    expect(result.damageDealt).toBeGreaterThan(0);
  });

  it('quick: applies bleed stacks (applyBleedStacks >= 1)', () => {
    const result = resolve('lacerate', 'quick');
    expect(result.applyBleedStacks).toBeGreaterThanOrEqual(1);
  });

  it('charge_correct: deals more damage than QP', () => {
    const qpResult = resolve('lacerate', 'quick');
    const ccResult = resolve('lacerate', 'charge_correct');
    expect(ccResult.damageDealt).toBeGreaterThan(qpResult.damageDealt);
  });

  it('charge_correct: applies more bleed than QP', () => {
    const qpResult = resolve('lacerate', 'quick');
    const ccResult = resolve('lacerate', 'charge_correct');
    expect(ccResult.applyBleedStacks).toBeGreaterThan(qpResult.applyBleedStacks!);
  });

  it('charge_correct: applyBleedStacks=8 (hardcoded in resolver)', () => {
    const result = resolve('lacerate', 'charge_correct');
    expect(result.applyBleedStacks).toBe(8);
  });

  it('charge_wrong: deals damage > 0', () => {
    const result = resolve('lacerate', 'charge_wrong');
    expect(result.damageDealt).toBeGreaterThan(0);
  });

  it('charge_wrong: applyBleedStacks=2 (hardcoded in resolver)', () => {
    const result = resolve('lacerate', 'charge_wrong');
    expect(result.applyBleedStacks).toBe(2);
  });

  it('bleed stacks: CC > QP > CW', () => {
    const cc = resolve('lacerate', 'charge_correct').applyBleedStacks!;
    const qp = resolve('lacerate', 'quick').applyBleedStacks!;
    const cw = resolve('lacerate', 'charge_wrong').applyBleedStacks!;
    expect(cc).toBeGreaterThan(qp);
    expect(qp).toBeGreaterThan(cw);
  });
});

// ── Stagger (debuff) ──────────────────────────────────────────────────────────
// Mechanic: stagger — skip enemy's next action (turn counter still advances)
// CC bonus: also applies Vulnerable 1t

describe('stagger mechanic', () => {
  it('quick: applyStagger=true', () => {
    const result = resolve('stagger', 'quick');
    expect(result.applyStagger).toBe(true);
  });

  it('quick: no vulnerable status (no CC bonus)', () => {
    const result = resolve('stagger', 'quick');
    const vulns = result.statusesApplied.filter(s => s.type === 'vulnerable');
    expect(vulns).toHaveLength(0);
  });

  it('charge_correct: applyStagger=true', () => {
    const result = resolve('stagger', 'charge_correct');
    expect(result.applyStagger).toBe(true);
  });

  it('charge_correct: also applies Vulnerable 1t', () => {
    const result = resolve('stagger', 'charge_correct');
    const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vuln).toBeDefined();
    expect(vuln!.turnsRemaining).toBe(1);
  });

  it('charge_wrong: applyStagger=true, no vulnerable (no CC bonus)', () => {
    const result = resolve('stagger', 'charge_wrong');
    expect(result.applyStagger).toBe(true);
    const vulns = result.statusesApplied.filter(s => s.type === 'vulnerable');
    expect(vulns).toHaveLength(0);
  });

  it('no damage dealt (stagger is a control debuff)', () => {
    const result = resolve('stagger', 'quick');
    expect(result.damageDealt).toBe(0);
  });

  it('no shield applied', () => {
    const result = resolve('stagger', 'quick');
    expect(result.shieldApplied).toBe(0);
  });
});

// ── Corrode (debuff) ──────────────────────────────────────────────────────────
// Mechanic: corrode — remove enemy block AND apply Weakness
// QP: remove finalValue block + weakness 1t
// CC: remove ALL block (-1 sentinel) + weakness 2t
// CW: remove 3 block + weakness 1t

describe('corrode mechanic', () => {
  it('quick: sets removeEnemyBlock to a positive value', () => {
    const result = resolve('corrode', 'quick');
    expect(result.removeEnemyBlock).toBeDefined();
    // QP removes finalValue block (computed from stat table L0 qpValue=3)
    expect(result.removeEnemyBlock).toBeGreaterThan(0);
  });

  it('quick: applies weakness with 1 turn duration', () => {
    const result = resolve('corrode', 'quick');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.turnsRemaining).toBe(1);
  });

  it('charge_correct: removeEnemyBlock=-1 (remove ALL block)', () => {
    const result = resolve('corrode', 'charge_correct');
    expect(result.removeEnemyBlock).toBe(-1);
  });

  it('charge_correct: weakness lasts 2 turns', () => {
    const result = resolve('corrode', 'charge_correct');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.turnsRemaining).toBe(2);
  });

  it('charge_wrong: removeEnemyBlock=3 (hardcoded in resolver)', () => {
    const result = resolve('corrode', 'charge_wrong');
    expect(result.removeEnemyBlock).toBe(3);
  });

  it('charge_wrong: applies weakness with 1 turn duration', () => {
    const result = resolve('corrode', 'charge_wrong');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.turnsRemaining).toBe(1);
  });

  it('always applies exactly one weakness status across all modes', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const result = resolve('corrode', mode);
      const weaknesses = result.statusesApplied.filter(s => s.type === 'weakness');
      expect(weaknesses).toHaveLength(1);
    }
  });

  it('no direct damage dealt (corrode removes block and applies weakness, not attack damage)', () => {
    const result = resolve('corrode', 'quick');
    expect(result.damageDealt).toBe(0);
  });
});

// ── Cross-mechanic edge cases and tag verification ────────────────────────────

describe('buff/debuff cross-mechanic invariants', () => {
  it('weaken has weakness tag in mechanic definition', () => {
    const m = getMechanicDefinition('weaken');
    expect(m!.tags).toContain('weakness');
  });

  it('expose has vulnerable tag in mechanic definition', () => {
    const m = getMechanicDefinition('expose');
    expect(m!.tags).toContain('vulnerable');
  });

  it('hex has poison tag in mechanic definition', () => {
    const m = getMechanicDefinition('hex');
    expect(m!.tags).toContain('poison');
  });

  it('sap has weakness tag in mechanic definition', () => {
    const m = getMechanicDefinition('sap');
    expect(m!.tags).toContain('weakness');
  });

  it('lacerate has bleed tag in mechanic definition', () => {
    const m = getMechanicDefinition('lacerate');
    expect(m!.tags).toContain('bleed');
  });

  it('stagger has stagger tag in mechanic definition', () => {
    const m = getMechanicDefinition('stagger');
    expect(m!.tags).toContain('stagger');
  });

  it('corrode has weakness tag in mechanic definition', () => {
    const m = getMechanicDefinition('corrode');
    expect(m!.tags).toContain('weakness');
  });

  it('ignite has buff and burn tags in mechanic definition', () => {
    const m = getMechanicDefinition('ignite');
    expect(m!.tags).toContain('buff');
    expect(m!.tags).toContain('burn');
  });

  it('empower has buff tag in mechanic definition', () => {
    const m = getMechanicDefinition('empower');
    expect(m!.tags).toContain('buff');
  });

  it('empower finalValue increases from QP to CC', () => {
    const qpFV = resolve('empower', 'quick').finalValue;
    const ccFV = resolve('empower', 'charge_correct').finalValue;
    expect(ccFV).toBeGreaterThan(qpFV);
  });

  it('slow, weaken, expose all apply their primary effect on charge_wrong', () => {
    const slowResult = resolve('slow', 'charge_wrong');
    expect(slowResult.applySlow).toBe(true);

    const weakenResult = resolve('weaken', 'charge_wrong');
    expect(weakenResult.statusesApplied.some(s => s.type === 'weakness')).toBe(true);

    const exposeResult = resolve('expose', 'charge_wrong');
    expect(exposeResult.statusesApplied.some(s => s.type === 'vulnerable')).toBe(true);
  });

  it('sap and lacerate apply both damage and status in same resolution', () => {
    const sap = resolve('sap', 'quick');
    expect(sap.damageDealt).toBeGreaterThan(0);
    expect(sap.statusesApplied.some(s => s.type === 'weakness')).toBe(true);

    const lacerate = resolve('lacerate', 'quick');
    expect(lacerate.damageDealt).toBeGreaterThan(0);
    expect(lacerate.applyBleedStacks).toBeGreaterThan(0);
  });

  it('corrode CC removes all block (sentinel -1), not just a fixed amount', () => {
    const cc = resolve('corrode', 'charge_correct');
    const qp = resolve('corrode', 'quick');
    // CC uses -1 sentinel (remove all) while QP uses a positive fixed amount
    expect(cc.removeEnemyBlock).toBe(-1);
    expect(qp.removeEnemyBlock).toBeGreaterThan(0);
  });

  it('stagger CC adds vulnerable on top of skip action (bonus punishment)', () => {
    const cc = resolve('stagger', 'charge_correct');
    expect(cc.applyStagger).toBe(true);
    expect(cc.statusesApplied.some(s => s.type === 'vulnerable')).toBe(true);
  });
});
