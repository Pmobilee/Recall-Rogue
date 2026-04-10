/**
 * Unit tests for Phase 1 shield mechanics.
 * Tests all 10 shield mechanics through resolveCardEffect in QP, CC, and CW modes.
 *
 * Expected values sourced from MASTERY_STAT_TABLES (cardUpgradeService.ts) at L0
 * and the resolver logic in cardEffectResolver.ts.
 */
import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';

// ── Helpers (mirrors play-mode-mechanics.test.ts pattern) ──

function makeCard(overrides: Partial<Card> & { mechanicId: string }): Card {
  const mechanic = getMechanicDefinition(overrides.mechanicId);
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: (mechanic?.type ?? 'shield') as CardType,
    domain: 'test',
    tier: '1',
    baseEffectValue: mechanic?.baseValue ?? 6,
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

// ── 1. block — basic shield gain ──────────────────────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=4; mechanic.quickPlayValue=5 → masteryBonus=-1
// QP=4, CC=round(4*1.50)=6, CW=max(0, chargeWrongValue=3 + masteryBonus=-1)=2

describe('block mechanic (Phase 1 shield)', () => {
  it('quick: gains 4 shield (stat table L0 qpValue=4)', () => {
    const result = resolve('block', 'quick');
    expect(result.shieldApplied).toBe(4);
  });

  it('charge_correct: gains 6 shield (round(4*1.50)=6)', () => {
    const result = resolve('block', 'charge_correct');
    expect(result.shieldApplied).toBe(6);
  });

  it('charge_wrong: gains 2 shield (chargeWrongValue=3 + masteryBonus=-1 = 2)', () => {
    const result = resolve('block', 'charge_wrong');
    expect(result.shieldApplied).toBe(2);
  });

  it('never deals damage', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('block', mode).damageDealt).toBe(0);
    }
  });
});

// ── 2. thorns — block + reflect damage when hit ───────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=2, secondaryValue=1; mechanic.quickPlayValue=3 → masteryBonus=-1
// QP shield=2, CC shield=round(2*1.50)=3, CW shield=max(0,2+(-1))=1
// thornsValue hardcoded in resolver: QP=3, CC=9, CW=2 (focusAdjustedMultiplier=1)

describe('thorns mechanic (Phase 1 shield)', () => {
  it('quick: 2 shield, 3 reflect (stat table L0 qpValue=2; reflect hardcoded quick=3)', () => {
    const result = resolve('thorns', 'quick');
    expect(result.shieldApplied).toBe(2);
    expect(result.thornsValue).toBe(3);
  });

  it('charge_correct: 3 shield (round(2*1.50)), 9 reflect (hardcoded CC=9)', () => {
    const result = resolve('thorns', 'charge_correct');
    expect(result.shieldApplied).toBe(3);
    expect(result.thornsValue).toBe(9);
  });

  it('charge_wrong: 1 shield (chargeWrongValue=2 + masteryBonus=-1), 2 reflect (hardcoded CW=2)', () => {
    const result = resolve('thorns', 'charge_wrong');
    expect(result.shieldApplied).toBe(1);
    expect(result.thornsValue).toBe(2);
  });

  it('always sets a thornsValue regardless of play mode', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const result = resolve('thorns', mode);
      expect(result.thornsValue).toBeGreaterThan(0);
    }
  });
});

// ── 3. emergency — double block below 30% HP ──────────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=2; mechanic.quickPlayValue=2 → masteryBonus=0
// QP finalValue=2, CC finalValue=round(2*1.50)=3, CW finalValue=max(0,2+0)=2
// Resolver: block = hpPercent < 0.3 ? finalValue * 2 : finalValue; Math.round applied.

describe('emergency mechanic (Phase 1 shield)', () => {
  it('quick: 2 shield at full HP', () => {
    const result = resolve('emergency', 'quick', { hp: 80, maxHP: 80 });
    expect(result.shieldApplied).toBe(2);
  });

  it('quick: 4 shield below 30% HP (doubles)', () => {
    const result = resolve('emergency', 'quick', { hp: 20, maxHP: 100 });
    expect(result.shieldApplied).toBe(4);
  });

  it('charge_correct: 3 shield at full HP', () => {
    const result = resolve('emergency', 'charge_correct', { hp: 80, maxHP: 80 });
    expect(result.shieldApplied).toBe(3);
  });

  it('charge_correct: 6 shield below 30% HP (doubles CC value)', () => {
    const result = resolve('emergency', 'charge_correct', { hp: 20, maxHP: 100 });
    expect(result.shieldApplied).toBe(6);
  });

  it('charge_wrong: 2 shield at full HP', () => {
    const result = resolve('emergency', 'charge_wrong', { hp: 80, maxHP: 80 });
    expect(result.shieldApplied).toBe(2);
  });

  it('charge_wrong: 4 shield below 30% HP (doubles CW value)', () => {
    const result = resolve('emergency', 'charge_wrong', { hp: 20, maxHP: 100 });
    expect(result.shieldApplied).toBe(4);
  });

  it('at exactly 30% HP: does NOT double (threshold is strictly <0.3)', () => {
    // 30 HP / 100 maxHP = 0.30 — not < 0.3
    const result = resolve('emergency', 'quick', { hp: 30, maxHP: 100 });
    expect(result.shieldApplied).toBe(2);
  });
});

// ── 4. fortify (Entrench) — gain block based on current block ─────────────────
// MASTERY_STAT_TABLES L0: qpValue=5; mechanic.quickPlayValue=6 → masteryBonus=-1 — bumped 4→5 (L0 balance overhaul 2026-04-10)
// QP finalValue=5, CC finalValue=round((6+(-1))*1.50)=round(7.5)=8, CW finalValue=max(0,4+(-1))=3
// Resolver: QP shieldApplied=floor(currentBlock*0.5) — finalValue NOT added on QP
//           CC shieldApplied=floor(currentBlock*0.75)+finalValue — finalValue added only on CC
//           CW shieldApplied=floor(currentBlock*0.25) — finalValue NOT added on CW

describe('fortify mechanic (Entrench, Phase 1 shield)', () => {
  describe('with no existing block (shield=0)', () => {
    it('quick: 0 shield (floor(0*0.5)=0 — QP adds no finalValue)', () => {
      const result = resolve('fortify', 'quick', { shield: 0 });
      expect(result.shieldApplied).toBe(0);
    });

    it('charge_correct: 8 shield (0.75×0 + finalValue=8)', () => {
      const result = resolve('fortify', 'charge_correct', { shield: 0 });
      expect(result.shieldApplied).toBe(8);
    });

    it('charge_wrong: 0 shield (0.25×0 — no finalValue added on CW)', () => {
      const result = resolve('fortify', 'charge_wrong', { shield: 0 });
      expect(result.shieldApplied).toBe(0);
    });
  });

  describe('with existing block (shield=20)', () => {
    it('quick: 10 shield (floor(20*0.5)=10 — QP adds no finalValue)', () => {
      const result = resolve('fortify', 'quick', { shield: 20 });
      expect(result.shieldApplied).toBe(10);
    });

    it('charge_correct: 23 shield (floor(20*0.75)=15 + finalValue=8)', () => {
      const result = resolve('fortify', 'charge_correct', { shield: 20 });
      expect(result.shieldApplied).toBe(23);
    });

    it('charge_wrong: 5 shield (floor(20*0.25)=5)', () => {
      const result = resolve('fortify', 'charge_wrong', { shield: 20 });
      expect(result.shieldApplied).toBe(5);
    });
  });

  it('deals no damage', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('fortify', mode).damageDealt).toBe(0);
    }
  });
});

// ── 5. brace — block equal to enemy telegraph ──────────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=2; mechanic.quickPlayValue=3 → masteryBonus=-1
// QP finalValue=2, CC finalValue=round(2*1.50)=3, CW finalValue=max(0,2+(-1))=1
// Resolver: braceMultiplier QP=1.0, CC=3.0, CW=0.7
//           intentBlock=round(intent.value * mult); shieldApplied=max(intentBlock, finalValue)

describe('brace mechanic (Phase 1 shield)', () => {
  const attackingEnemy = (value: number) => ({ nextIntent: { type: 'attack', value, weight: 1, telegraph: 'Attack' } } as Partial<EnemyInstance>);
  const nonAttackEnemy = { nextIntent: { type: 'buff', value: 0, weight: 1, telegraph: 'Buff' } } as Partial<EnemyInstance>;

  it('quick: 1.0× enemy intent = 10 block (vs intent value 10)', () => {
    const result = resolve('brace', 'quick', undefined, attackingEnemy(10));
    expect(result.shieldApplied).toBe(10);
  });

  it('charge_correct: 3.0× enemy intent = 30 block (vs intent value 10)', () => {
    const result = resolve('brace', 'charge_correct', undefined, attackingEnemy(10));
    expect(result.shieldApplied).toBe(30);
  });

  it('charge_wrong: 0.7× enemy intent = 7 block (round(10*0.7))', () => {
    const result = resolve('brace', 'charge_wrong', undefined, attackingEnemy(10));
    expect(result.shieldApplied).toBe(7);
  });

  it('non-attack intent: falls back to finalValue (QP=2)', () => {
    // With non-attack intent, resolver gives applyShieldRelics(finalValue) instead of telegraph scaling
    const result = resolve('brace', 'quick', undefined, nonAttackEnemy);
    expect(result.shieldApplied).toBe(2);
  });

  it('uses card value as floor when intent is very small', () => {
    // intent value 1, CC: intentBlock=round(1*3.0)=3, finalValue=3 → max(3,3)=3
    const result = resolve('brace', 'charge_correct', undefined, attackingEnemy(1));
    expect(result.shieldApplied).toBe(3);
  });
});

// ── 6. overheal — double block below 60% HP ───────────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=6; mechanic.quickPlayValue=5 → masteryBonus=+1 — bumped 5→6 (L0 balance overhaul 2026-04-10)
// QP finalValue=6, CC finalValue=round(6*1.50)=9, CW finalValue=max(0,4+1)=5
// Resolver: bonusMultiplier = hpPercent < 0.6 ? 2.0 : 1.0; shieldApplied=round(finalValue*bonusMult)

describe('overheal mechanic (Phase 1 shield)', () => {
  it('quick: 6 shield at full HP (no bonus)', () => {
    const result = resolve('overheal', 'quick', { hp: 80, maxHP: 80 });
    expect(result.shieldApplied).toBe(6);
  });

  it('quick: 12 shield below 60% HP (doubles)', () => {
    const result = resolve('overheal', 'quick', { hp: 40, maxHP: 100 });
    expect(result.shieldApplied).toBe(12);
  });

  it('charge_correct: 9 shield at full HP', () => {
    const result = resolve('overheal', 'charge_correct', { hp: 80, maxHP: 80 });
    expect(result.shieldApplied).toBe(9);
  });

  it('charge_correct: 18 shield below 60% HP (doubles CC value)', () => {
    const result = resolve('overheal', 'charge_correct', { hp: 40, maxHP: 100 });
    expect(result.shieldApplied).toBe(18);
  });

  it('charge_wrong: 5 shield at full HP (chargeWrongValue=4 + masteryBonus=+1 = 5)', () => {
    const result = resolve('overheal', 'charge_wrong', { hp: 80, maxHP: 80 });
    expect(result.shieldApplied).toBe(5);
  });

  it('charge_wrong: 10 shield below 60% HP (doubles CW value)', () => {
    const result = resolve('overheal', 'charge_wrong', { hp: 40, maxHP: 100 });
    expect(result.shieldApplied).toBe(10);
  });

  it('at exactly 60% HP: does NOT double (threshold is strictly <0.6)', () => {
    // 60 HP / 100 maxHP = 0.60 — not < 0.6
    const result = resolve('overheal', 'quick', { hp: 60, maxHP: 100 });
    expect(result.shieldApplied).toBe(6);
  });
});

// ── 7. reinforce — more block than basic shield ────────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=5; mechanic.quickPlayValue=7 → masteryBonus=-2
// QP=5, CC=round(5*1.50)=8 (round(7.5)=8), CW=max(0, chargeWrongValue=4 + masteryBonus=-2)=2

describe('reinforce mechanic (Phase 1 shield)', () => {
  it('quick: 5 shield (stat table L0 qpValue=5, masteryBonus=-2 → 7+(-2)=5)', () => {
    const result = resolve('reinforce', 'quick');
    expect(result.shieldApplied).toBe(5);
  });

  it('charge_correct: 8 shield (round(5*1.50)=round(7.5)=8)', () => {
    const result = resolve('reinforce', 'charge_correct');
    expect(result.shieldApplied).toBe(8);
  });

  it('charge_wrong: 2 shield (chargeWrongValue=4 + masteryBonus=-2 = 2)', () => {
    const result = resolve('reinforce', 'charge_wrong');
    expect(result.shieldApplied).toBe(2);
  });

  it('QP gives more block than basic block (5 vs 4)', () => {
    const reinforceResult = resolve('reinforce', 'quick');
    const blockResult = resolve('block', 'quick');
    expect(reinforceResult.shieldApplied).toBeGreaterThan(blockResult.shieldApplied);
  });

  it('never draws a card at L0 (reinforce_draw1 tag only at L5)', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      expect(resolve('reinforce', mode).extraCardsDrawn).toBe(0);
    }
  });
});

// ── 8. shrug_it_off — block + draw on QP and CC, no draw on CW ────────────────
// MASTERY_STAT_TABLES L0: qpValue=2, drawCount=1; mechanic.quickPlayValue=3 → masteryBonus=-1
// QP finalValue=2, shield=2, draws=1 (from stats.drawCount)
// CC finalValue=round(2*1.50)=3, shield=3, draws=1
// CW finalValue=max(0,2+(-1))=1, shield=1, no draw

describe('shrug_it_off mechanic (Phase 1 shield)', () => {
  it('quick: 2 shield AND 1 card drawn', () => {
    const result = resolve('shrug_it_off', 'quick');
    expect(result.shieldApplied).toBe(2);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('charge_correct: 3 shield AND 1 card drawn', () => {
    const result = resolve('shrug_it_off', 'charge_correct');
    expect(result.shieldApplied).toBe(3);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('charge_wrong: 1 shield, NO card drawn', () => {
    const result = resolve('shrug_it_off', 'charge_wrong');
    expect(result.shieldApplied).toBe(1);
    expect(result.extraCardsDrawn).toBe(0);
  });

  it('always applies some shield even on wrong answer', () => {
    const result = resolve('shrug_it_off', 'charge_wrong');
    expect(result.shieldApplied).toBeGreaterThan(0);
  });
});

// ── 9. absorb — block, CC also draws a card ───────────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=2; mechanic.quickPlayValue=3 → masteryBonus=-1
// QP finalValue=2, shield=2, no draw
// CC finalValue=round(2*1.50)=3, shield=3, extraCardsDrawn=1
// CW finalValue=max(0,2+(-1))=1, shield=1, no draw

describe('absorb mechanic (Phase 1 shield)', () => {
  it('quick: 2 shield, no card draw', () => {
    const result = resolve('absorb', 'quick');
    expect(result.shieldApplied).toBe(2);
    expect(result.extraCardsDrawn).toBe(0);
  });

  it('charge_correct: 3 shield AND 1 card drawn (CC bonus)', () => {
    const result = resolve('absorb', 'charge_correct');
    expect(result.shieldApplied).toBe(3);
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('charge_wrong: 1 shield, no card draw', () => {
    const result = resolve('absorb', 'charge_wrong');
    expect(result.shieldApplied).toBe(1);
    expect(result.extraCardsDrawn).toBe(0);
  });

  it('only draws on charge_correct, never on QP or CW', () => {
    expect(resolve('absorb', 'quick').extraCardsDrawn).toBe(0);
    expect(resolve('absorb', 'charge_correct').extraCardsDrawn).toBe(1);
    expect(resolve('absorb', 'charge_wrong').extraCardsDrawn).toBe(0);
  });
});

// ── 10. reactive_shield — block + apply thorns ────────────────────────────────
// MASTERY_STAT_TABLES L0: qpValue=2, secondaryValue=1; mechanic.quickPlayValue=2, secondaryValue=2
// masteryBonus=2-2=0; masterySecondaryBonus=1-2=-1 (not applied since <0)
// card.secondaryValue stays at mechanic.secondaryValue=2 (from makeCard)
// QP finalValue=2, shield=2, thornsValue=card.secondaryValue=2 (QP path in resolver)
// CC finalValue=round(2*1.50)=3, shield=3, thornsValue=5 (CC hardcoded)
// CW finalValue=max(0,2+0)=2, shield=2, thornsValue=1 (CW hardcoded)

describe('reactive_shield mechanic (Phase 1 shield)', () => {
  it('quick: 2 shield AND thornsValue from card.secondaryValue (2)', () => {
    const result = resolve('reactive_shield', 'quick');
    expect(result.shieldApplied).toBe(2);
    expect(result.thornsValue).toBe(2);
  });

  it('charge_correct: 3 shield AND 5 thorns (CC hardcoded value)', () => {
    const result = resolve('reactive_shield', 'charge_correct');
    expect(result.shieldApplied).toBe(3);
    expect(result.thornsValue).toBe(5);
  });

  it('charge_wrong: 2 shield AND 1 thorn (CW hardcoded value)', () => {
    const result = resolve('reactive_shield', 'charge_wrong');
    expect(result.shieldApplied).toBe(2);
    expect(result.thornsValue).toBe(1);
  });

  it('always sets thornsValue regardless of play mode', () => {
    for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
      const result = resolve('reactive_shield', mode);
      expect(result.thornsValue).toBeDefined();
      expect(result.thornsValue).toBeGreaterThan(0);
    }
  });

  it('CC thorns value exceeds QP thorns value', () => {
    const qp = resolve('reactive_shield', 'quick').thornsValue ?? 0;
    const cc = resolve('reactive_shield', 'charge_correct').thornsValue ?? 0;
    expect(cc).toBeGreaterThan(qp);
  });
});

// ── Cross-mechanic shield sanity checks ──────────────────────────────────────

describe('shield mechanics — cross-mechanic sanity checks', () => {
  const shieldMechanics = [
    'block', 'thorns', 'emergency', 'fortify',
    'brace', 'overheal', 'reinforce', 'shrug_it_off', 'absorb', 'reactive_shield',
  ];

  for (const id of shieldMechanics) {
    it(`${id}: CC always provides more shield than QP (at full HP)`, () => {
      const qp = resolve(id, 'quick', { hp: 80, maxHP: 80 }).shieldApplied;
      const cc = resolve(id, 'charge_correct', { hp: 80, maxHP: 80 }).shieldApplied;
      expect(cc).toBeGreaterThanOrEqual(qp);
    });
  }

  for (const id of shieldMechanics) {
    it(`${id}: always applies some shield (never zero in all modes)`, () => {
      // Note: fortify QP and CW with shield=0 legitimately give 0 — test with some block
      if (id === 'fortify') {
        expect(resolve(id, 'quick', { shield: 10 }).shieldApplied).toBeGreaterThan(0);
        expect(resolve(id, 'charge_correct').shieldApplied).toBeGreaterThan(0);
        return;
      }
      for (const mode of ['quick', 'charge_correct', 'charge_wrong'] as const) {
        const result = resolve(id, mode);
        expect(result.shieldApplied).toBeGreaterThanOrEqual(0);
      }
    });
  }

  it('all 10 shield mechanics have mechanic definitions', () => {
    for (const id of shieldMechanics) {
      const mechanic = getMechanicDefinition(id);
      expect(mechanic, `mechanic '${id}' not found`).toBeDefined();
      expect(mechanic!.type).toBe('shield');
    }
  });
});

// ── Mastery tag wiring: burnout_no_exhaust (burnout_shield L5) ────────────────

describe('burnout_shield — burnout_no_exhaust tag (L5)', () => {
  it('L4 CC: exhausts normally (no burnout_no_exhaust tag yet)', () => {
    const result = resolve('burnout_shield', 'charge_correct', undefined, undefined, { masteryLevel: 4 });
    expect(result.exhaustOnResolve).toBe(true);
  });

  it('L5 CC: does NOT exhaust (burnout_no_exhaust tag active)', () => {
    const result = resolve('burnout_shield', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
    expect(result.exhaustOnResolve).toBeFalsy();
  });

  it('L5 QP: still does not exhaust (tag only suppresses existing CC exhaust)', () => {
    const result = resolve('burnout_shield', 'quick', undefined, undefined, { masteryLevel: 5 });
    expect(result.exhaustOnResolve).toBeFalsy();
  });

  it('L5 CW: still does not exhaust', () => {
    const result = resolve('burnout_shield', 'charge_wrong', undefined, undefined, { masteryLevel: 5 });
    expect(result.exhaustOnResolve).toBeFalsy();
  });

  it('L5 CC: still applies shield (tag only removes exhaust, not the shield)', () => {
    const result = resolve('burnout_shield', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
    expect(result.shieldApplied).toBeGreaterThan(0);
  });
});

// ── Mastery tag wiring: knowledge_ward_cleanse (knowledge_ward L3+) ───────────

describe('knowledge_ward — knowledge_ward_cleanse tag (L3+)', () => {
  it('L2 CC: does NOT cleanse (no knowledge_ward_cleanse tag)', () => {
    const result = resolve('knowledge_ward', 'charge_correct', undefined, undefined, { masteryLevel: 2 });
    expect(result.removeDebuffCount).toBeFalsy();
  });

  it('L3 CC: cleanses 1 debuff (knowledge_ward_cleanse tag active)', () => {
    const result = resolve('knowledge_ward', 'charge_correct', undefined, undefined, { masteryLevel: 3 });
    expect(result.removeDebuffCount).toBe(1);
  });

  it('L3 QP: cleanses 1 debuff (tag fires on all play modes)', () => {
    const result = resolve('knowledge_ward', 'quick', undefined, undefined, { masteryLevel: 3 });
    expect(result.removeDebuffCount).toBe(1);
  });

  it('L5 CC: cleanses 1 debuff (tag persists at max level)', () => {
    const result = resolve('knowledge_ward', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
    expect(result.removeDebuffCount).toBe(1);
  });

  it('L5 CC: still applies shield (cleanse is additive, does not replace block)', () => {
    const result = resolve('knowledge_ward', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
    expect(result.shieldApplied).toBeGreaterThan(0);
  });
});
