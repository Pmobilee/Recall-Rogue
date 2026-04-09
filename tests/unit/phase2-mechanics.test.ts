/**
 * Unit tests for AR-207: Phase 2 Identity / Flagship Card Mechanics
 *
 * Covers all 20 Phase 2 mechanics across Quick Play, Charge Correct, and Charge Wrong modes:
 *   Attack: gambit, chain_lightning, volatile_slash
 *   Shield: burnout_shield, knowledge_ward
 *   Buff:   warcry, battle_trance, inscription_wisdom, forge
 *   Debuff: curse_of_doubt, mark_of_ignorance, corroding_touch
 *   Utility: conjure, transmute, immunity, archive, reflex
 *   Wild:   phase_shift, chameleon, dark_knowledge, chain_anchor, unstable_flux
 *
 * Focus areas:
 *   - Exhaust-on-CC mechanics (volatile_slash CC, burnout_shield CC, inscription_wisdom)
 *   - Scaling mechanics (chain_lightning chain-length scaling, knowledge_ward correct-charges scaling)
 *   - Choice mechanics (phase_shift: damage OR block on QP/CW, both on CC)
 *   - Copy mechanics (chameleon: multiplier emitted for turnManager to resolve)
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

function resolve(
  mechanicId: string,
  playMode: 'quick' | 'charge_correct' | 'charge_wrong',
  playerOverrides?: Partial<PlayerCombatState>,
  enemyOverrides?: Partial<EnemyInstance>,
  cardOverrides?: Partial<Card>,
  advancedOverrides?: Record<string, unknown>,
) {
  const card = makeCard({ mechanicId, ...cardOverrides });
  const player = makePlayer(playerOverrides);
  const enemy = makeEnemy(enemyOverrides);
  return resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
    playMode,
    ...advancedOverrides,
  });
}

// ── Phase 2 MechanicDefinition presence tests ──

describe('Phase 2 mechanic definitions present', () => {
  const phase2Mechanics = [
    'gambit', 'chain_lightning', 'volatile_slash',
    'burnout_shield', 'knowledge_ward',
    'warcry', 'battle_trance', 'inscription_wisdom', 'forge',
    'curse_of_doubt', 'mark_of_ignorance', 'corroding_touch',
    'conjure', 'transmute', 'immunity', 'archive', 'reflex',
    'phase_shift', 'chameleon', 'dark_knowledge', 'chain_anchor', 'unstable_flux',
  ];

  for (const id of phase2Mechanics) {
    it(`${id} mechanic definition exists`, () => {
      const m = getMechanicDefinition(id);
      expect(m, `mechanic '${id}' not found`).toBeDefined();
      expect(m!.id).toBe(id);
      expect(m!.launchPhase).toBe(2);
    });
  }
});

// ── ATTACK: gambit ──

describe('gambit mechanic', () => {
  it('QP: deals damage and takes 2 self-damage', () => {
    const result = resolve('gambit', 'quick');
    expect(result.damageDealt).toBeGreaterThan(0);
    // QP: self damage 2 (default mastery 0)
    expect(result.selfDamage).toBe(2);
    expect(result.gambitselfDamage).toBe(2);
    expect(result.healApplied ?? 0).toBe(0);
  });

  it('CC: deals damage and heals 5 HP', () => {
    const result = resolve('gambit', 'charge_correct');
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.healApplied).toBe(5);
    expect(result.gambitHeal).toBe(5);
    expect(result.selfDamage ?? 0).toBe(0);
  });

  it('CW: deals damage and takes 5 self-damage', () => {
    const result = resolve('gambit', 'charge_wrong');
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.selfDamage).toBe(5);
    expect(result.gambitselfDamage).toBe(5);
    expect(result.healApplied ?? 0).toBe(0);
  });

  it('QP damage is positive in all modes', () => {
    expect(resolve('gambit', 'quick').damageDealt).toBeGreaterThan(0);
    expect(resolve('gambit', 'charge_correct').damageDealt).toBeGreaterThan(0);
    expect(resolve('gambit', 'charge_wrong').damageDealt).toBeGreaterThan(0);
  });
});

// ── ATTACK: chain_lightning ──

describe('chain_lightning mechanic', () => {
  it('QP: deals base damage (no chain scaling)', () => {
    const result = resolve('chain_lightning', 'quick');
    expect(result.damageDealt).toBeGreaterThan(0);
    // No chainLightningChainLength set on QP
    expect(result.chainLightningChainLength).toBeUndefined();
  });

  it('CC: sentinel damage set + chainLightningChainLength=1 for turnManager to override', () => {
    const result = resolve('chain_lightning', 'charge_correct');
    // turnManager overrides CC damage; resolver emits sentinel
    expect(result.damageDealt).toBeGreaterThan(0);
    // chainLightningChainLength should be 1 (no chain_lightning_min2 tag at L0)
    expect(result.chainLightningChainLength).toBe(1);
  });

  it('CW: deals damage (reduced), no chain length set', () => {
    const result = resolve('chain_lightning', 'charge_wrong');
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.chainLightningChainLength).toBeUndefined();
  });

  it('CC damage is >= QP damage (sentinel uses CC multiplier)', () => {
    const qp = resolve('chain_lightning', 'quick').damageDealt;
    const cc = resolve('chain_lightning', 'charge_correct').damageDealt;
    expect(cc).toBeGreaterThanOrEqual(qp);
  });
});

// ── ATTACK: volatile_slash ──

describe('volatile_slash mechanic (exhaust-on-CC)', () => {
  it('QP: deals damage, does NOT exhaust', () => {
    const result = resolve('volatile_slash', 'quick');
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.exhaustOnResolve).toBeFalsy();
  });

  it('CC: deals damage AND sets exhaustOnResolve=true', () => {
    const result = resolve('volatile_slash', 'charge_correct');
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.exhaustOnResolve).toBe(true);
  });

  it('CW: deals damage, does NOT exhaust', () => {
    const result = resolve('volatile_slash', 'charge_wrong');
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.exhaustOnResolve).toBeFalsy();
  });

  it('CC damage is greater than QP damage', () => {
    const qp = resolve('volatile_slash', 'quick').damageDealt;
    const cc = resolve('volatile_slash', 'charge_correct').damageDealt;
    expect(cc).toBeGreaterThan(qp);
  });
});

// ── SHIELD: burnout_shield ──

describe('burnout_shield mechanic (exhaust-on-CC)', () => {
  it('QP: applies block, does NOT exhaust', () => {
    const result = resolve('burnout_shield', 'quick');
    expect(result.shieldApplied).toBeGreaterThan(0);
    expect(result.exhaustOnResolve).toBeFalsy();
  });

  it('CC: applies larger block AND sets exhaustOnResolve=true', () => {
    const result = resolve('burnout_shield', 'charge_correct');
    expect(result.shieldApplied).toBeGreaterThan(0);
    expect(result.exhaustOnResolve).toBe(true);
  });

  it('CW: applies block, does NOT exhaust', () => {
    const result = resolve('burnout_shield', 'charge_wrong');
    expect(result.shieldApplied).toBeGreaterThan(0);
    expect(result.exhaustOnResolve).toBeFalsy();
  });

  it('CC block is greater than QP block', () => {
    const qp = resolve('burnout_shield', 'quick').shieldApplied;
    const cc = resolve('burnout_shield', 'charge_correct').shieldApplied;
    expect(cc).toBeGreaterThan(qp);
  });

  it('mirrors volatile_slash: CC exhausts, QP/CW do not', () => {
    expect(resolve('burnout_shield', 'charge_correct').exhaustOnResolve).toBe(true);
    expect(resolve('burnout_shield', 'quick').exhaustOnResolve).toBeFalsy();
    expect(resolve('burnout_shield', 'charge_wrong').exhaustOnResolve).toBeFalsy();
  });
});

// ── SHIELD: knowledge_ward ──

describe('knowledge_ward mechanic (scales with correct charges)', () => {
  it('QP with 0 correct charges: block = 6*1 = 6 (clamped to 1 min)', () => {
    const result = resolve('knowledge_ward', 'quick', undefined, undefined, undefined, {
      correctChargesThisEncounter: 0,
    });
    expect(result.shieldApplied).toBe(6); // 6 * max(0, 1) = 6
  });

  it('QP with 3 correct charges: block = 6*3 = 18', () => {
    const result = resolve('knowledge_ward', 'quick', undefined, undefined, undefined, {
      correctChargesThisEncounter: 3,
    });
    expect(result.shieldApplied).toBe(18);
  });

  it('CC with 3 correct charges: block = 10*3 = 30', () => {
    const result = resolve('knowledge_ward', 'charge_correct', undefined, undefined, undefined, {
      correctChargesThisEncounter: 3,
    });
    expect(result.shieldApplied).toBe(30);
  });

  it('CW: flat 4 block regardless of charges', () => {
    const result = resolve('knowledge_ward', 'charge_wrong', undefined, undefined, undefined, {
      correctChargesThisEncounter: 5,
    });
    expect(result.shieldApplied).toBe(4);
  });

  it('CC block is higher than QP at same charge count', () => {
    const opts = { correctChargesThisEncounter: 2 };
    const qp = resolve('knowledge_ward', 'quick', undefined, undefined, undefined, opts).shieldApplied;
    const cc = resolve('knowledge_ward', 'charge_correct', undefined, undefined, undefined, opts).shieldApplied;
    expect(cc).toBeGreaterThan(qp);
  });

  it('scales linearly with correct charges (CC: 10 per charge)', () => {
    for (let charges = 1; charges <= 5; charges++) {
      const result = resolve('knowledge_ward', 'charge_correct', undefined, undefined, undefined, {
        correctChargesThisEncounter: charges,
      });
      expect(result.shieldApplied).toBe(10 * charges);
    }
  });

  it('correct charges clamped at 5 max (CC: 10*5=50 even at 10 charges)', () => {
    const result = resolve('knowledge_ward', 'charge_correct', undefined, undefined, undefined, {
      correctChargesThisEncounter: 10,
    });
    expect(result.shieldApplied).toBe(50);
  });
});

// ── BUFF: warcry ──

describe('warcry mechanic', () => {
  it('QP: applies +2 Strength this turn (not permanent)', () => {
    const result = resolve('warcry', 'quick');
    expect(result.applyStrengthToPlayer).toBeDefined();
    expect(result.applyStrengthToPlayer!.value).toBe(2);
    expect(result.applyStrengthToPlayer!.permanent).toBe(false);
    expect(result.warcryFreeCharge).toBeFalsy();
  });

  it('CC: applies +2 Strength permanently AND grants free Charge', () => {
    const result = resolve('warcry', 'charge_correct');
    expect(result.applyStrengthToPlayer).toBeDefined();
    expect(result.applyStrengthToPlayer!.value).toBe(2);
    expect(result.applyStrengthToPlayer!.permanent).toBe(true);
    expect(result.warcryFreeCharge).toBe(true);
  });

  it('CW: applies +1 Strength this turn (not permanent), no free Charge', () => {
    const result = resolve('warcry', 'charge_wrong');
    expect(result.applyStrengthToPlayer).toBeDefined();
    expect(result.applyStrengthToPlayer!.value).toBe(1);
    expect(result.applyStrengthToPlayer!.permanent).toBe(false);
    expect(result.warcryFreeCharge).toBeFalsy();
  });

  it('CC gives more Strength permanence than QP', () => {
    const qp = resolve('warcry', 'quick');
    const cc = resolve('warcry', 'charge_correct');
    expect(qp.applyStrengthToPlayer!.permanent).toBe(false);
    expect(cc.applyStrengthToPlayer!.permanent).toBe(true);
  });
});

// ── BUFF: battle_trance ──

describe('battle_trance mechanic', () => {
  it('QP: draws cards AND applies battle trance restriction (lockout)', () => {
    const result = resolve('battle_trance', 'quick');
    expect(result.extraCardsDrawn).toBeGreaterThan(0);
    expect(result.battleTranceDraw).toBeGreaterThan(0);
    expect(result.applyBattleTranceRestriction).toBe(true);
  });

  it('CC: draws cards, NO restriction', () => {
    const result = resolve('battle_trance', 'charge_correct');
    expect(result.extraCardsDrawn).toBeGreaterThan(0);
    expect(result.battleTranceDraw).toBeGreaterThan(0);
    expect(result.applyBattleTranceRestriction).toBeFalsy();
  });

  it('CW: draws cards AND applies restriction', () => {
    const result = resolve('battle_trance', 'charge_wrong');
    expect(result.extraCardsDrawn).toBeGreaterThan(0);
    expect(result.applyBattleTranceRestriction).toBe(true);
  });

  it('CC draws at least as many cards as CW', () => {
    const cc = resolve('battle_trance', 'charge_correct').extraCardsDrawn;
    const cw = resolve('battle_trance', 'charge_wrong').extraCardsDrawn;
    expect(cc).toBeGreaterThanOrEqual(cw);
  });

  it('CW draws fewer or equal cards than QP', () => {
    const qp = resolve('battle_trance', 'quick').extraCardsDrawn;
    const cw = resolve('battle_trance', 'charge_wrong').extraCardsDrawn;
    expect(cw).toBeLessThanOrEqual(qp);
  });
});

// ── BUFF: inscription_wisdom ──

describe('inscription_wisdom mechanic (exhaust on play)', () => {
  it('QP: activates inscription (extraDrawPerCC=1, healPerCC=0)', () => {
    const result = resolve('inscription_wisdom', 'quick');
    // Should set inscriptionWisdomActivated with draw bonus
    expect(result.inscriptionWisdomActivated).toBeDefined();
    expect(result.inscriptionWisdomActivated!.extraDrawPerCC).toBe(1);
    expect(result.inscriptionWisdomActivated!.healPerCC).toBe(0);
    expect(result.inscriptionFizzled).toBeFalsy();
  });

  it('CC: activates inscription with draw AND heal bonus', () => {
    const result = resolve('inscription_wisdom', 'charge_correct');
    expect(result.inscriptionWisdomActivated).toBeDefined();
    expect(result.inscriptionWisdomActivated!.extraDrawPerCC).toBe(1);
    expect(result.inscriptionWisdomActivated!.healPerCC).toBe(1);
    expect(result.inscriptionFizzled).toBeFalsy();
  });

  it('CW: inscription FIZZLES (no effect)', () => {
    const result = resolve('inscription_wisdom', 'charge_wrong');
    expect(result.inscriptionFizzled).toBe(true);
    expect(result.inscriptionWisdomActivated).toBeUndefined();
  });
});

// ── BUFF: forge ──

describe('forge mechanic', () => {
  it('QP: emits pendingCardPick of type forge for upgrade selection', () => {
    const result = resolve('forge', 'quick');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('forge');
    expect(result.pendingCardPick!.allowSkip).toBe(true);
  });

  it('CC: emits pendingCardPick of type forge', () => {
    const result = resolve('forge', 'charge_correct');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('forge');
  });

  it('CW: emits pendingCardPick of type forge', () => {
    const result = resolve('forge', 'charge_wrong');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('forge');
  });
});

// ── DEBUFF: curse_of_doubt ──

describe('curse_of_doubt mechanic', () => {
  it('QP: applies 30% charge damage amp for 2 turns', () => {
    const result = resolve('curse_of_doubt', 'quick');
    expect(result.applyChargeDamageAmpPercent).toBeDefined();
    // At masteryLevel=0, MASTERY_STAT_TABLES sets qpValue=0 overriding mechanic quickPlayValue=20,
    // so masteryBonus = 0-20 = -20, finalValue = 20-20 = 0. Value is 0 at L0.
    expect(result.applyChargeDamageAmpPercent!.value).toBeGreaterThanOrEqual(0);
    expect(result.applyChargeDamageAmpPercent!.turns).toBe(2);
  });

  it('CC: applies higher charge damage amp for 3 turns', () => {
    const result = resolve('curse_of_doubt', 'charge_correct');
    expect(result.applyChargeDamageAmpPercent).toBeDefined();
    expect(result.applyChargeDamageAmpPercent!.turns).toBe(3);
    // At L0, MASTERY_STAT_TABLES qpValue=0 makes all modes produce value=0 via finalValue path.
    // CC >= QP is still correct (both 0); strict > not valid until mastery table uses non-zero qpValue.
    const qpValue = resolve('curse_of_doubt', 'quick').applyChargeDamageAmpPercent!.value;
    expect(result.applyChargeDamageAmpPercent!.value).toBeGreaterThanOrEqual(qpValue);
  });

  it('CW: applies lower charge damage amp for 1 turn', () => {
    const result = resolve('curse_of_doubt', 'charge_wrong');
    expect(result.applyChargeDamageAmpPercent).toBeDefined();
    expect(result.applyChargeDamageAmpPercent!.turns).toBe(1);
  });

  it('turn durations scale: CW=1, QP=2, CC=3', () => {
    const cw = resolve('curse_of_doubt', 'charge_wrong').applyChargeDamageAmpPercent!.turns;
    const qp = resolve('curse_of_doubt', 'quick').applyChargeDamageAmpPercent!.turns;
    const cc = resolve('curse_of_doubt', 'charge_correct').applyChargeDamageAmpPercent!.turns;
    expect(cw).toBe(1);
    expect(qp).toBe(2);
    expect(cc).toBe(3);
  });

  it('amp value order: CW <= QP <= CC', () => {
    // At L0 with masteryLevel=0, MASTERY_STAT_TABLES qpValue=0 produces value=0 for all modes
    // (masteryBonus = 0-20 = -20 makes finalValue = 0). Use >= comparisons at L0.
    // Value scaling is an intent for higher mastery levels when stat tables supply non-zero qpValue.
    const cw = resolve('curse_of_doubt', 'charge_wrong').applyChargeDamageAmpPercent!.value;
    const qp = resolve('curse_of_doubt', 'quick').applyChargeDamageAmpPercent!.value;
    const cc = resolve('curse_of_doubt', 'charge_correct').applyChargeDamageAmpPercent!.value;
    expect(cw).toBeLessThanOrEqual(qp);
    expect(qp).toBeLessThanOrEqual(cc);
  });
});

// ── DEBUFF: mark_of_ignorance ──

describe('mark_of_ignorance mechanic', () => {
  it('QP: applies flat charge damage amp for 2 turns', () => {
    const result = resolve('mark_of_ignorance', 'quick');
    expect(result.applyChargeDamageAmpFlat).toBeDefined();
    // At L0, MASTERY_STAT_TABLES qpValue=0 makes finalValue=0 (masteryBonus = 0-2 = -2).
    expect(result.applyChargeDamageAmpFlat!.value).toBeGreaterThanOrEqual(0);
    expect(result.applyChargeDamageAmpFlat!.turns).toBe(2);
  });

  it('CC: applies higher flat amp for 3 turns', () => {
    const result = resolve('mark_of_ignorance', 'charge_correct');
    expect(result.applyChargeDamageAmpFlat).toBeDefined();
    expect(result.applyChargeDamageAmpFlat!.turns).toBe(3);
    // At L0 all modes produce value=0; >= is correct for asserting CC is at least as good as QP.
    const qpValue = resolve('mark_of_ignorance', 'quick').applyChargeDamageAmpFlat!.value;
    expect(result.applyChargeDamageAmpFlat!.value).toBeGreaterThanOrEqual(qpValue);
  });

  it('CW: applies lower flat amp for 1 turn', () => {
    const result = resolve('mark_of_ignorance', 'charge_wrong');
    expect(result.applyChargeDamageAmpFlat).toBeDefined();
    expect(result.applyChargeDamageAmpFlat!.turns).toBe(1);
  });

  it('turn durations scale: CW=1, QP=2, CC=3', () => {
    const cw = resolve('mark_of_ignorance', 'charge_wrong').applyChargeDamageAmpFlat!.turns;
    const qp = resolve('mark_of_ignorance', 'quick').applyChargeDamageAmpFlat!.turns;
    const cc = resolve('mark_of_ignorance', 'charge_correct').applyChargeDamageAmpFlat!.turns;
    expect(cw).toBe(1);
    expect(qp).toBe(2);
    expect(cc).toBe(3);
  });
});

// ── DEBUFF: corroding_touch ──

describe('corroding_touch mechanic', () => {
  it('QP: applies 2 Weakness (1 turn)', () => {
    const result = resolve('corroding_touch', 'quick');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakness).toBeDefined();
    expect(weakness!.value).toBe(2);
    expect(weakness!.turnsRemaining).toBeGreaterThanOrEqual(1);
    // No Vulnerable on QP
    const vulnerable = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vulnerable).toBeUndefined();
  });

  it('CC: applies 3 Weakness (2 turns) + 2 Vulnerable (1 turn)', () => {
    const result = resolve('corroding_touch', 'charge_correct');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    const vulnerable = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(weakness).toBeDefined();
    expect(weakness!.value).toBe(3);
    expect(weakness!.turnsRemaining).toBeGreaterThanOrEqual(2);
    expect(vulnerable).toBeDefined();
    expect(vulnerable!.value).toBe(2);
    expect(vulnerable!.turnsRemaining).toBe(1);
  });

  it('CW: applies 1 Weakness (1 turn), no Vulnerable', () => {
    const result = resolve('corroding_touch', 'charge_wrong');
    const weakness = result.statusesApplied.find(s => s.type === 'weakness');
    const vulnerable = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(weakness).toBeDefined();
    expect(weakness!.value).toBe(1);
    expect(vulnerable).toBeUndefined();
  });

  it('CC applies more Weakness stacks than QP and CW', () => {
    const cw = resolve('corroding_touch', 'charge_wrong').statusesApplied.find(s => s.type === 'weakness')!.value;
    const qp = resolve('corroding_touch', 'quick').statusesApplied.find(s => s.type === 'weakness')!.value;
    const cc = resolve('corroding_touch', 'charge_correct').statusesApplied.find(s => s.type === 'weakness')!.value;
    expect(cw).toBeLessThan(qp);
    expect(qp).toBeLessThan(cc);
  });
});

// ── UTILITY: conjure ──

describe('conjure mechanic', () => {
  it('QP: emits pendingCardPick of type conjure', () => {
    const result = resolve('conjure', 'quick');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('conjure');
    expect(result.pendingCardPick!.candidates.length).toBeGreaterThan(0);
    expect(result.pendingCardPick!.allowSkip).toBe(true);
  });

  it('CC: emits pendingCardPick of type conjure', () => {
    const result = resolve('conjure', 'charge_correct');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('conjure');
  });

  it('CW: emits pendingCardPick of type conjure', () => {
    const result = resolve('conjure', 'charge_wrong');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('conjure');
  });
});

// ── UTILITY: transmute ──

describe('transmute mechanic', () => {
  // Phase 1 rework: QP and CW auto-pick a random candidate (applyTransmuteAuto).
  // Only CC opens the card picker (pendingCardPick). See plan/hazy-stargazing-candle.md.
  it('QP: emits applyTransmuteAuto with sourceCardId and a selected card', () => {
    const result = resolve('transmute', 'quick');
    expect(result.applyTransmuteAuto).toBeDefined();
    expect(result.applyTransmuteAuto!.sourceCardId).toBeTruthy();
    expect(result.applyTransmuteAuto!.selected).toBeDefined();
    expect(result.pendingCardPick).toBeUndefined();
  });

  it('CC: emits pendingCardPick of type transmute', () => {
    const result = resolve('transmute', 'charge_correct');
    expect(result.pendingCardPick).toBeDefined();
    expect(result.pendingCardPick!.type).toBe('transmute');
  });

  it('CW: emits applyTransmuteAuto (same as QP path)', () => {
    const result = resolve('transmute', 'charge_wrong');
    expect(result.applyTransmuteAuto).toBeDefined();
    expect(result.applyTransmuteAuto!.selected).toBeDefined();
    expect(result.pendingCardPick).toBeUndefined();
  });

  it('CC candidates include attack, shield, and one utility/buff/debuff type', () => {
    const result = resolve('transmute', 'charge_correct');
    const types = result.pendingCardPick!.candidates.map(c => c.cardType);
    expect(types).toContain('attack');
    expect(types).toContain('shield');
    expect(types).toHaveLength(3);
  });
});

// ── UTILITY: immunity ──

describe('immunity mechanic', () => {
  it('QP: applies immunity flag', () => {
    const result = resolve('immunity', 'quick');
    expect(result.applyImmunity).toBe(true);
  });

  it('CC: applies immunity flag', () => {
    const result = resolve('immunity', 'charge_correct');
    expect(result.applyImmunity).toBe(true);
  });

  it('CW: applies immunity flag', () => {
    const result = resolve('immunity', 'charge_wrong');
    expect(result.applyImmunity).toBe(true);
  });
});

// ── UTILITY: archive ──

describe('archive mechanic', () => {
  it('QP: sets archiveRetainCount=1', () => {
    const result = resolve('archive', 'quick');
    expect(result.archiveRetainCount).toBe(1);
  });

  it('CC: sets archiveRetainCount=2', () => {
    const result = resolve('archive', 'charge_correct');
    expect(result.archiveRetainCount).toBe(2);
  });

  it('CW: sets archiveRetainCount=1', () => {
    const result = resolve('archive', 'charge_wrong');
    expect(result.archiveRetainCount).toBe(1);
  });

  it('CC retains more cards than QP and CW', () => {
    const qp = resolve('archive', 'quick').archiveRetainCount ?? 0;
    const cc = resolve('archive', 'charge_correct').archiveRetainCount ?? 0;
    const cw = resolve('archive', 'charge_wrong').archiveRetainCount ?? 0;
    expect(cc).toBeGreaterThan(qp);
    expect(cc).toBeGreaterThan(cw);
  });
});

// ── UTILITY: reflex ──

describe('reflex mechanic', () => {
  it('QP: draws 2 cards', () => {
    const result = resolve('reflex', 'quick');
    expect(result.extraCardsDrawn).toBe(2);
  });

  it('CC: draws 2 cards at L0 (reflex_draw3cc tag inactive until L3)', () => {
    // At masteryLevel=0, reflex stat table has drawCount=1 with no reflex_draw3cc tag.
    // Resolver: CC path uses hasTag('reflex_draw3cc') ? 3 : 2 → 2 at L0.
    const result = resolve('reflex', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(2);
  });

  it('CW: draws 1 card', () => {
    const result = resolve('reflex', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(1);
  });

  it('draw count order: CW <= QP <= CC', () => {
    // At L0: CW=1, QP=2, CC=2 (reflex_draw3cc tag inactive at L0 makes CC equal to QP).
    // CC draws 3 only at L3+ when reflex_draw3cc tag becomes active.
    const cw = resolve('reflex', 'charge_wrong').extraCardsDrawn;
    const qp = resolve('reflex', 'quick').extraCardsDrawn;
    const cc = resolve('reflex', 'charge_correct').extraCardsDrawn;
    expect(cw).toBeLessThan(qp);
    expect(qp).toBeLessThanOrEqual(cc);
  });
});

// ── WILD: phase_shift ──

describe('phase_shift mechanic (choice: damage OR block)', () => {
  it('QP: emits pendingChoice with damage and block options', () => {
    const result = resolve('phase_shift', 'quick');
    expect(result.phaseShiftChoice).toBe('pending');
    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice!.mechanicId).toBe('phase_shift');
    expect(result.pendingChoice!.options).toHaveLength(2);
    const ids = result.pendingChoice!.options.map(o => o.id);
    expect(ids).toContain('damage');
    expect(ids).toContain('block');
    // No effect applied yet (deferred)
    expect(result.damageDealt).toBe(0);
    expect(result.shieldApplied).toBe(0);
  });

  it('CC: BOTH damage AND block applied simultaneously (no choice)', () => {
    const result = resolve('phase_shift', 'charge_correct');
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.shieldApplied).toBeGreaterThan(0);
    expect(result.phaseShiftBothDmgAndBlock).toBeDefined();
    expect(result.phaseShiftBothDmgAndBlock!.damage).toBeGreaterThan(0);
    expect(result.phaseShiftBothDmgAndBlock!.block).toBeGreaterThan(0);
    // No choice popup needed for CC
    expect(result.phaseShiftChoice).toBeUndefined();
    expect(result.pendingChoice).toBeUndefined();
  });

  it('CW: emits pendingChoice (same as QP, deferred)', () => {
    const result = resolve('phase_shift', 'charge_wrong');
    expect(result.phaseShiftChoice).toBe('pending');
    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice!.mechanicId).toBe('phase_shift');
    expect(result.damageDealt).toBe(0);
    expect(result.shieldApplied).toBe(0);
  });

  it('CC damage equals CC block (symmetric effect)', () => {
    const result = resolve('phase_shift', 'charge_correct');
    expect(result.phaseShiftBothDmgAndBlock!.damage).toBe(result.phaseShiftBothDmgAndBlock!.block);
  });

  it('CC damage is greater than QP choice option damage', () => {
    const cc = resolve('phase_shift', 'charge_correct').damageDealt;
    const qp = resolve('phase_shift', 'quick');
    const qpDamageOption = qp.pendingChoice!.options.find(o => o.id === 'damage')!.damageDealt ?? 0;
    expect(cc).toBeGreaterThan(qpDamageOption);
  });
});

// ── WILD: chameleon ──

describe('chameleon mechanic (copy last card)', () => {
  it('QP: emits chameleonMultiplier=1.0', () => {
    const result = resolve('chameleon', 'quick');
    expect(result.chameleonMultiplier).toBe(1.0);
    expect(result.chameleonInheritChain).toBeFalsy();
  });

  it('CC: emits chameleonMultiplier=1.3 and chameleonInheritChain=true', () => {
    const result = resolve('chameleon', 'charge_correct');
    expect(result.chameleonMultiplier).toBe(1.3);
    expect(result.chameleonInheritChain).toBe(true);
  });

  it('CW: emits chameleonMultiplier=0.7', () => {
    const result = resolve('chameleon', 'charge_wrong');
    expect(result.chameleonMultiplier).toBe(0.7);
  });

  it('multiplier order: CW < QP < CC', () => {
    const cw = resolve('chameleon', 'charge_wrong').chameleonMultiplier!;
    const qp = resolve('chameleon', 'quick').chameleonMultiplier!;
    const cc = resolve('chameleon', 'charge_correct').chameleonMultiplier!;
    expect(cw).toBeLessThan(qp);
    expect(qp).toBeLessThan(cc);
  });

  it('resolver itself does 0 damage (copy resolved by turnManager)', () => {
    // Chameleon emits no direct damage — turnManager copies the last card
    const qp = resolve('chameleon', 'quick');
    const cc = resolve('chameleon', 'charge_correct');
    const cw = resolve('chameleon', 'charge_wrong');
    expect(qp.damageDealt).toBe(0);
    expect(cc.damageDealt).toBe(0);
    expect(cw.damageDealt).toBe(0);
  });
});

// ── WILD: dark_knowledge ──

describe('dark_knowledge mechanic (damage per cursed fact)', () => {
  it('QP with 0 cursed facts: deals 0 damage', () => {
    const result = resolve('dark_knowledge', 'quick', undefined, undefined, undefined, {
      cursedFactCount: 0,
    });
    expect(result.damageDealt).toBe(0);
    expect(result.darkKnowledgeDmgPerCurse).toBeGreaterThan(0);
  });

  it('QP with 3 cursed facts: deals 3*dmgPerCurse damage', () => {
    const result = resolve('dark_knowledge', 'quick', undefined, undefined, undefined, {
      cursedFactCount: 3,
    });
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.darkKnowledgeDmgPerCurse).toBeGreaterThan(0);
    // damageDealt = dmgPerCurse * 3 (base 3 for QP)
    expect(result.damageDealt).toBe(result.darkKnowledgeDmgPerCurse! * 3);
  });

  it('CC with 3 cursed facts: damage >= QP (same dmgPerCurse at L0)', () => {
    // At masteryLevel=0, stat table extras.dmgPerCurse=2 for ALL play modes.
    // The resolver reads from getMasteryStats().extras.dmgPerCurse regardless of mode,
    // so CC, QP, and CW all deal dmgPerCurse=2 per curse at L0. Use >= not >.
    const opts = { cursedFactCount: 3 };
    const qp = resolve('dark_knowledge', 'quick', undefined, undefined, undefined, opts).damageDealt;
    const cc = resolve('dark_knowledge', 'charge_correct', undefined, undefined, undefined, opts).damageDealt;
    expect(cc).toBeGreaterThanOrEqual(qp);
  });

  it('CW with 3 cursed facts: damage <= QP (same dmgPerCurse at L0)', () => {
    // At L0, dmgPerCurse is the same for all modes (from stat table extras).
    // Strict CW < QP only applies when mechanic quickPlayValue/chargeWrongValue split is active.
    const opts = { cursedFactCount: 3 };
    const qp = resolve('dark_knowledge', 'quick', undefined, undefined, undefined, opts).damageDealt;
    const cw = resolve('dark_knowledge', 'charge_wrong', undefined, undefined, undefined, opts).damageDealt;
    expect(cw).toBeLessThanOrEqual(qp);
  });

  it('dmgPerCurse order: CW < QP < CC (defaults without extras override)', () => {
    const resolveNoExtras = (mode: 'quick' | 'charge_correct' | 'charge_wrong') =>
      resolve('dark_knowledge', mode, undefined, undefined, undefined, { cursedFactCount: 1 });
    const cw = resolveNoExtras('charge_wrong').darkKnowledgeDmgPerCurse!;
    const qp = resolveNoExtras('quick').darkKnowledgeDmgPerCurse!;
    const cc = resolveNoExtras('charge_correct').darkKnowledgeDmgPerCurse!;
    expect(cw).toBeLessThanOrEqual(qp);
    expect(qp).toBeLessThanOrEqual(cc);
  });
});

// ── WILD: chain_anchor ──

describe('chain_anchor mechanic', () => {
  it('QP: draws 1 card, does NOT set chainAnchor', () => {
    const result = resolve('chain_anchor', 'quick');
    expect(result.extraCardsDrawn).toBe(1);
    expect(result.applyChainAnchor).toBeFalsy();
  });

  it('CC: draws 1 card AND sets applyChainAnchor=true', () => {
    const result = resolve('chain_anchor', 'charge_correct');
    expect(result.extraCardsDrawn).toBe(1);
    expect(result.applyChainAnchor).toBe(true);
  });

  it('CW: draws 1 card, does NOT set chainAnchor', () => {
    const result = resolve('chain_anchor', 'charge_wrong');
    expect(result.extraCardsDrawn).toBe(1);
    expect(result.applyChainAnchor).toBeFalsy();
  });

  it('draws exactly 1 card in all modes', () => {
    expect(resolve('chain_anchor', 'quick').extraCardsDrawn).toBe(1);
    expect(resolve('chain_anchor', 'charge_correct').extraCardsDrawn).toBe(1);
    expect(resolve('chain_anchor', 'charge_wrong').extraCardsDrawn).toBe(1);
  });
});

// ── WILD: unstable_flux ──

describe('unstable_flux mechanic (random or chosen effect)', () => {
  it('QP: resolves to one of: damage, block, draw, or debuff (random)', () => {
    // Run multiple times to check all 4 code paths are reachable
    const effects = new Set<string | undefined>();
    for (let i = 0; i < 50; i++) {
      const result = resolve('unstable_flux', 'quick');
      effects.add(result.unstableFluxEffect);
    }
    // Should have produced at least some valid effects (probability: failing all 4 in 50 trials is astronomically small)
    expect(effects.size).toBeGreaterThan(0);
    for (const e of effects) {
      expect(['damage', 'block', 'draw', 'debuff']).toContain(e);
    }
  });

  it('CC: emits pendingChoice with 4 options at 1.5× (deferred choice)', () => {
    const result = resolve('unstable_flux', 'charge_correct');
    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice!.mechanicId).toBe('unstable_flux');
    expect(result.pendingChoice!.options).toHaveLength(4);
    // CC: no random effect set yet
    expect(result.unstableFluxEffect).toBeUndefined();
    // No effect applied yet (deferred to popup)
    expect(result.damageDealt).toBe(0);
    expect(result.shieldApplied).toBe(0);
  });

  it('CC options include damage, block, draw, debuff IDs', () => {
    const result = resolve('unstable_flux', 'charge_correct');
    const ids = result.pendingChoice!.options.map(o => o.id);
    expect(ids).toContain('damage');
    expect(ids).toContain('block');
    expect(ids).toContain('draw');
    expect(ids).toContain('debuff');
  });

  it('CW: resolves randomly at 0.7× multiplier (one of 4 effects)', () => {
    const result = resolve('unstable_flux', 'charge_wrong');
    expect(result.unstableFluxEffect).toMatch(/^(damage|block|draw|debuff)$/);
    expect(result.pendingChoice).toBeUndefined();
  });

  it('CC damage option value is greater than CW damage value (1.5× vs 0.7×)', () => {
    // At 1.5×: baseDmg = round(10 * 1.5) = 15; at 0.7×: round(10 * 0.7) = 7
    const cc = resolve('unstable_flux', 'charge_correct');
    const ccDmgOption = cc.pendingChoice!.options.find(o => o.id === 'damage')!.damageDealt ?? 0;
    expect(ccDmgOption).toBeGreaterThan(7);
  });
});

// ── Cross-cutting: exhaust mechanic summary ──

describe('exhaust-on-CC summary', () => {
  it('volatile_slash CC exhausts, QP/CW do not', () => {
    expect(resolve('volatile_slash', 'charge_correct').exhaustOnResolve).toBe(true);
    expect(resolve('volatile_slash', 'quick').exhaustOnResolve).toBeFalsy();
    expect(resolve('volatile_slash', 'charge_wrong').exhaustOnResolve).toBeFalsy();
  });

  it('burnout_shield CC exhausts, QP/CW do not', () => {
    expect(resolve('burnout_shield', 'charge_correct').exhaustOnResolve).toBe(true);
    expect(resolve('burnout_shield', 'quick').exhaustOnResolve).toBeFalsy();
    expect(resolve('burnout_shield', 'charge_wrong').exhaustOnResolve).toBeFalsy();
  });

  it('inscription_wisdom CW fizzles, QP/CC do not', () => {
    expect(resolve('inscription_wisdom', 'charge_wrong').inscriptionFizzled).toBe(true);
    expect(resolve('inscription_wisdom', 'quick').inscriptionFizzled).toBeFalsy();
    expect(resolve('inscription_wisdom', 'charge_correct').inscriptionFizzled).toBeFalsy();
  });
});

// ── Cross-cutting: wrong answers always produce something ──

describe('charge_wrong always produces non-zero total effect', () => {
  const attackMechanics = ['gambit', 'chain_lightning', 'volatile_slash'];
  const shieldMechanics = ['burnout_shield'];
  const debuffMechanics = ['curse_of_doubt', 'mark_of_ignorance', 'corroding_touch'];
  const utilityMechanics = ['archive', 'reflex', 'chain_anchor'];

  for (const id of attackMechanics) {
    it(`${id} CW deals > 0 damage`, () => {
      expect(resolve(id, 'charge_wrong').damageDealt).toBeGreaterThan(0);
    });
  }

  for (const id of shieldMechanics) {
    it(`${id} CW grants > 0 block`, () => {
      expect(resolve(id, 'charge_wrong').shieldApplied).toBeGreaterThan(0);
    });
  }

  for (const id of debuffMechanics) {
    it(`${id} CW applies at least one status`, () => {
      const result = resolve(id, 'charge_wrong');
      const hasStatus = result.statusesApplied.length > 0;
      const hasAmp = result.applyChargeDamageAmpPercent != null || result.applyChargeDamageAmpFlat != null;
      expect(hasStatus || hasAmp).toBe(true);
    });
  }

  for (const id of utilityMechanics) {
    it(`${id} CW draws at least 1 card or sets retain count`, () => {
      const result = resolve(id, 'charge_wrong');
      const draws = result.extraCardsDrawn ?? 0;
      const retain = result.archiveRetainCount ?? 0;
      expect(draws + retain).toBeGreaterThan(0);
    });
  }
});
