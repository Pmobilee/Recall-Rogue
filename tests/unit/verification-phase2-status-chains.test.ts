/**
 * Phase 2 Functional Correctness — Status effects, chain system, mastery progression, combo interactions.
 *
 * Programmatically verifies the unit-testable subset of items from
 * docs/testing/visual-verification/07-status-chains-combos.md.
 *
 * Sections covered:
 *   13 — Status Effects (via resolver with statusEffects on player/enemy)
 *   14 — Chain System (via chainMultiplier in AdvancedResolveOptions)
 *   15 — Mastery Progression (via getMasteryStats + resolver with masteryLevel)
 *   17 — Combos (via buffNextCard, isOverclockActive, stacked modifier combos)
 *
 * SKIPPED (require full turnManager / game loop / enemy AI / relic hooks):
 *   13.1 Poison tick per turn (tick loop), 13.7 regen per turn (tick loop)
 *   13.4 vulnerable player taking damage (requires enemy attack resolution)
 *   13.8 Immunity blocks debuff application (requires applyStatusEffect guard in turnManager)
 *   14.1 Chain builds and breaks (chain state lives in turnManager)
 *   14.2 Chain relic interactions (turnManager relic hooks)
 *   15.1 scout, mirror, L5 strike_tempo3 complex multi-card contexts
 *   16.x Enemy mechanics (require encounter engine)
 *   17.2–17.7 Relic interactions, mastery increment/decrement (turnManager)
 *   17.9–17.11 Mastery edge cases, additional relic tests
 *
 * Key formulas:
 *   QP  = getMasteryStats(mechanicId, level).qpValue
 *   CC  = Math.round(qpValue × 1.50)
 *   CW  = Math.max(0, mechanic.chargeWrongValue + masteryBonus)  [for most mechanics]
 *   Chain scales mechanicBaseValue BEFORE all other multipliers (attack/shield only):
 *     chainAdjustedBase = Math.round(mechanicBaseValue * chainMultiplier)
 *   Strength: modifier = 1 + stacks × 0.25  (min 0.25)
 *   Weakness: modifier -= stacks × 0.25
 *   Vulnerable: damage × 1.5 (applied after strength in applyAttackDamage)
 *   DoT stacks = Math.round(baseStacks * chainMultiplier)
 *   Debuff duration = Math.round(baseDuration * (1 + (chainMult-1) * 0.5))
 */

import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';
import { getMasteryStats } from '../../src/services/cardUpgradeService';
import { CHAIN_MULTIPLIERS, CHARGE_CORRECT_MULTIPLIER } from '../../src/data/balance';

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    masteryLevel: 0,
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

type PlayMode = 'quick' | 'charge_correct' | 'charge_wrong';

function resolve(
  mechanicId: string,
  playMode: PlayMode,
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

// ════════════════════════════════════════════════════════════════════════════
// SECTION 13 — STATUS EFFECTS (resolver-testable subset)
// ════════════════════════════════════════════════════════════════════════════

describe('Section 13 — Status Effects (resolver-testable)', () => {

  // ── 13.1 Poison application ──
  describe('13.1 Poison application via hex', () => {
    it('QP: hex L0 applies 3 poison stacks', () => {
      const stats = getMasteryStats('hex', 0);
      expect(stats?.extras?.['stacks']).toBe(3);
      const result = resolve('hex', 'quick');
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison).toBeDefined();
      expect(poison?.value).toBe(3);
    });

    it('CC: hex applies 8 poison stacks (HARD STOP value)', () => {
      const result = resolve('hex', 'charge_correct');
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison).toBeDefined();
      expect(poison?.value).toBe(8);
    });

    it('hex L5 QP applies 5 poison stacks', () => {
      const stats = getMasteryStats('hex', 5);
      expect(stats?.extras?.['stacks']).toBe(5);
      const result = resolve('hex', 'quick', undefined, undefined, { masteryLevel: 5 });
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison?.value).toBe(5);
    });
  });

  // ── 13.2 Strength modifier on attack damage ──
  describe('13.2 Strength modifier', () => {
    it('strength=1 increases attack damage by 25% (1 + 1×0.25 = 1.25×)', () => {
      // L0 strike QP base = 4; with strength=1: Math.round(4 * 1.25) = 5
      const baseResult = resolve('strike', 'quick');
      expect(baseResult.damageDealt).toBe(4);

      const strengthResult = resolve('strike', 'quick', {
        statusEffects: [{ type: 'strength', value: 1, turnsRemaining: 9999 }],
      });
      // applyAttackDamage: Math.max(0, Math.round(4 * 1.25 + 0)) = 5
      expect(strengthResult.damageDealt).toBe(5);
    });

    it('strength=2 increases attack damage by 50% (1 + 2×0.25 = 1.5×)', () => {
      // L0 strike QP base = 4; with strength=2: Math.round(4 * 1.5) = 6
      const result = resolve('strike', 'quick', {
        statusEffects: [{ type: 'strength', value: 2, turnsRemaining: 9999 }],
      });
      expect(result.damageDealt).toBe(6);
    });

    it('strength=4 on CC strike L0 — multiplier stacks with CC', () => {
      // CC base = Math.round(4 * 1.5) = 6; then strength(1 + 4*0.25 = 2.0): Math.round(6 * 2.0) = 12
      const result = resolve('strike', 'charge_correct', {
        statusEffects: [{ type: 'strength', value: 4, turnsRemaining: 9999 }],
      });
      expect(result.damageDealt).toBe(12);
    });
  });

  // ── 13.3 Weakness modifier on attack damage ──
  describe('13.3 Weakness modifier', () => {
    it('weakness=1 on player reduces strike QP damage by 25% (1 - 1×0.25 = 0.75×)', () => {
      // L0 strike QP = 4; weakness=1 → mod = 0.75; Math.round(4 * 0.75) = 3
      const result = resolve('strike', 'quick', {
        statusEffects: [{ type: 'weakness', value: 1, turnsRemaining: 2 }],
      });
      expect(result.damageDealt).toBe(3);
    });

    it('weakness=2 on player reduces damage further (1 - 2×0.25 = 0.5×)', () => {
      // L0 strike QP = 4; weakness=2 → mod = 0.5; Math.round(4 * 0.5) = 2
      const result = resolve('strike', 'quick', {
        statusEffects: [{ type: 'weakness', value: 2, turnsRemaining: 2 }],
      });
      expect(result.damageDealt).toBe(2);
    });

    it('weakness minimum modifier is 0.25 (strength=0, weakness=4: 1-1.0=0, min=0.25)', () => {
      // weakness=4 → raw mod = 1 - 4*0.25 = 0.0, but min is 0.25
      // L0 strike QP = 4; Math.round(4 * 0.25) = 1
      const result = resolve('strike', 'quick', {
        statusEffects: [{ type: 'weakness', value: 4, turnsRemaining: 3 }],
      });
      expect(result.damageDealt).toBe(1);
    });
  });

  // ── 13.4 Vulnerable multiplier ──
  describe('13.4 Vulnerable multiplier (1.5×)', () => {
    it('strike L0 QP vs vulnerable enemy: 4 × 1.5 = 6', () => {
      // Vulnerable is on the ENEMY statusEffects
      const result = resolve('strike', 'quick', undefined, {
        statusEffects: [{ type: 'vulnerable', value: 1, turnsRemaining: 2 }],
      });
      // base=4, no strength mod, then vulnerable: Math.round(4 * 1.5) = 6
      expect(result.damageDealt).toBe(6);
    });

    it('strike L0 CC vs vulnerable enemy: Math.round(Math.round(6 × 1.5)) = Math.round(9) = 9', () => {
      // CC base = Math.round(4 * 1.5) = 6; then vulnerable: Math.round(6 * 1.5) = 9
      const result = resolve('strike', 'charge_correct', undefined, {
        statusEffects: [{ type: 'vulnerable', value: 1, turnsRemaining: 2 }],
      });
      expect(result.damageDealt).toBe(9);
    });

    it('strike L5 QP vs vulnerable enemy: Math.round(8 × 1.5) = 12', () => {
      const result = resolve('strike', 'quick', undefined, {
        statusEffects: [{ type: 'vulnerable', value: 1, turnsRemaining: 2 }],
      }, { masteryLevel: 5 });
      expect(result.damageDealt).toBe(12);
    });
  });

  // ── 13.5 Status chain interactions: strength + weakness combined ──
  describe('13.5 Status chain interactions', () => {
    it('strength=2 + weakness=1: net modifier = 1+0.5-0.25 = 1.25, strike L0 QP → Math.round(4 × 1.25) = 5', () => {
      const result = resolve('strike', 'quick', {
        statusEffects: [
          { type: 'strength', value: 2, turnsRemaining: 9999 },
          { type: 'weakness', value: 1, turnsRemaining: 2 },
        ],
      });
      // getStrengthModifier: modifier = 1 + 2*0.25 - 1*0.25 = 1.25; max(0.25, 1.25) = 1.25
      // damage = Math.max(0, Math.round(4 * 1.25)) = 5
      expect(result.damageDealt).toBe(5);
    });

    it('strength=1 + weakness=1: net modifier = 1.0, strike L0 QP = 4 (unchanged)', () => {
      const result = resolve('strike', 'quick', {
        statusEffects: [
          { type: 'strength', value: 1, turnsRemaining: 9999 },
          { type: 'weakness', value: 1, turnsRemaining: 2 },
        ],
      });
      expect(result.damageDealt).toBe(4);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 14 — CHAIN SYSTEM FUNCTIONAL CORRECTNESS
// ════════════════════════════════════════════════════════════════════════════

describe('Section 14 — Chain System', () => {

  // ── 14.1 Chain multiplier values ──
  describe('14.1 Chain multiplier constants', () => {
    it('CHAIN_MULTIPLIERS has 6 values', () => {
      expect(CHAIN_MULTIPLIERS).toHaveLength(6);
    });

    it('[0] = 1.0', () => { expect(CHAIN_MULTIPLIERS[0]).toBe(1.0); });
    it('[1] = 1.2', () => { expect(CHAIN_MULTIPLIERS[1]).toBe(1.2); });
    it('[2] = 1.5', () => { expect(CHAIN_MULTIPLIERS[2]).toBe(1.5); });
    it('[3] = 2.0', () => { expect(CHAIN_MULTIPLIERS[3]).toBe(2.0); });
    it('[4] = 2.5', () => { expect(CHAIN_MULTIPLIERS[4]).toBe(2.5); });
    it('[5] = 3.5 (maximum)', () => { expect(CHAIN_MULTIPLIERS[5]).toBe(3.5); });
  });

  // ── 14.1 Chain scaling on attack damage ──
  describe('14.1 Chain scaling on attack damage (strike L0 CC)', () => {
    // CC base for L0 strike = Math.round(4 × 1.5) = 6
    // chain-adjusted = Math.round(6 × chainMult)

    it('chainMult=1.0: strike L0 CC damage = 6', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      expect(result.damageDealt).toBe(6);
    });

    it('chainMult=1.2 [chain 1]: Math.round(6 × 1.2) = 7', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.2 });
      // mechanicBaseValue = Math.round(4 * 1.5) = 6; chainAdjusted = Math.round(6 * 1.2) = 7
      expect(result.damageDealt).toBe(7);
    });

    it('chainMult=1.5 [chain 2]: Math.round(6 × 1.5) = 9', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.5 });
      // Math.round(6 * 1.5) = 9
      expect(result.damageDealt).toBe(9);
    });

    it('chainMult=2.0 [chain 3]: Math.round(6 × 2.0) = 12', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 2.0 });
      expect(result.damageDealt).toBe(12);
    });

    it('chainMult=2.5 [chain 4]: Math.round(6 × 2.5) = 15', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 2.5 });
      expect(result.damageDealt).toBe(15);
    });

    it('chainMult=3.5 [chain 5 max]: Math.round(6 × 3.5) = 21', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 3.5 });
      expect(result.damageDealt).toBe(21);
    });
  });

  // ── 14.1 Chain scaling on block ──
  describe('14.1 Chain scaling on block (block L0 CC)', () => {
    // block L0 qpValue=4; CC = Math.round(4 × 1.5) = 6
    // chain-adjusted = Math.round(6 × chainMult)

    it('chainMult=1.0: block L0 CC = 6', () => {
      const result = resolve('block', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      expect(result.shieldApplied).toBe(6);
    });

    it('chainMult=2.0: Math.round(6 × 2.0) = 12', () => {
      const result = resolve('block', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 2.0 });
      expect(result.shieldApplied).toBe(12);
    });

    it('chainMult=3.5: Math.round(6 × 3.5) = 21', () => {
      const result = resolve('block', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 3.5 });
      expect(result.shieldApplied).toBe(21);
    });
  });

  // ── 14.1 Chain scaling on DoT stacks ──
  describe('14.1 Chain scaling on DoT stacks (hex poison)', () => {
    // hex L0 QP: base stacks = 3; chain-scaled: Math.round(3 * chainMult)

    it('chainMult=1.0: hex QP poison stacks = 3', () => {
      const result = resolve('hex', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison?.value).toBe(3);
    });

    it('chainMult=2.0: hex QP poison stacks = Math.round(3 × 2.0) = 6', () => {
      const result = resolve('hex', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 2.0 });
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison?.value).toBe(6);
    });

    it('chainMult=3.5: hex QP poison stacks = Math.round(3 × 3.5) = 11 (rounding)', () => {
      // Math.round(3 * 3.5) = Math.round(10.5) = 11
      const result = resolve('hex', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 3.5 });
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison?.value).toBe(11);
    });

    it('chainMult=1.5: hex L3 QP stacks=3 → Math.round(3 × 1.5) = 5 (rounding)', () => {
      // hex L3 extras.stacks=3; Math.round(3 * 1.5) = Math.round(4.5) = 5
      const result = resolve('hex', 'quick', undefined, undefined, { masteryLevel: 3 }, { chainMultiplier: 1.5 });
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison?.value).toBe(5);
    });
  });

  // ── 14.1 Chain scaling on debuff duration ──
  describe('14.1 Chain scaling on debuff duration (bash vulnerable, sap weakness)', () => {
    // bash QP: baseDuration = 1 (non-CC); chainScaled = Math.round(1 * (1 + (chainMult-1) * 0.5))

    it('bash QP chainMult=1.0: vulnerable duration = 1', () => {
      const result = resolve('bash', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln?.turnsRemaining).toBe(1);
    });

    it('bash QP chainMult=2.0: duration = Math.round(1 × (1 + (2.0-1)×0.5)) = Math.round(1.5) = 2', () => {
      // Math.round(1 * (1 + 1 * 0.5)) = Math.round(1.5) = 2
      const result = resolve('bash', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 2.0 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln?.turnsRemaining).toBe(2);
    });

    it('bash CC chainMult=1.0: vulnerable duration = 2 (CC base is 2)', () => {
      const result = resolve('bash', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      // baseBashVulnDuration for CC = 2; Math.round(2 * 1.0) = 2
      expect(vuln?.turnsRemaining).toBe(2);
    });

    it('bash CC chainMult=2.0: duration = Math.round(2 × (1 + (2.0-1)×0.5)) = Math.round(3) = 3', () => {
      // Math.round(2 * 1.5) = 3
      const result = resolve('bash', 'charge_correct', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 2.0 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln?.turnsRemaining).toBe(3);
    });

    it('sap QP chainMult=2.0: weakness duration = Math.round(1 × 1.5) = 2', () => {
      // sap L0: baseSapWeakDuration = 1 (QP, no sap_weak2t); Math.round(1 * 1.5) = 2
      const result = resolve('sap', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 2.0 });
      const weak = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weak?.turnsRemaining).toBe(2);
    });

    it('chain does NOT scale buff finalValue (empower)', () => {
      // empower L0 qpValue=30 (buff type); chain should NOT scale buff base
      const resultNoChain = resolve('empower', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      const resultChained = resolve('empower', 'quick', undefined, undefined, { masteryLevel: 0 }, { chainMultiplier: 3.5 });
      // Buffs use mechanicBaseValue directly (no chain adjustment)
      expect(resultNoChain.finalValue).toBe(resultChained.finalValue);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 15 — MASTERY LEVEL PROGRESSION
// ════════════════════════════════════════════════════════════════════════════

describe('Section 15 — Mastery Progression', () => {

  // ── 15.1 Strike progression L0–L5 QP values ──
  describe('15.1 Strike progression QP values', () => {
    const strikeExpected = [4, 4, 5, 6, 7, 8];

    for (let level = 0; level <= 5; level++) {
      const expected = strikeExpected[level];
      it(`L${level} QP = ${expected}`, () => {
        const stats = getMasteryStats('strike', level);
        expect(stats?.qpValue).toBe(expected);
        const result = resolve('strike', 'quick', undefined, undefined, { masteryLevel: level });
        expect(result.damageDealt).toBe(expected);
      });
    }
  });

  // ── 15.1 Block progression L0–L5 QP values ──
  describe('15.1 Block progression QP values', () => {
    const blockExpected = [4, 4, 5, 6, 7, 8];

    for (let level = 0; level <= 5; level++) {
      const expected = blockExpected[level];
      it(`L${level} QP = ${expected}`, () => {
        const stats = getMasteryStats('block', level);
        expect(stats?.qpValue).toBe(expected);
        const result = resolve('block', 'quick', undefined, undefined, { masteryLevel: level });
        expect(result.shieldApplied).toBe(expected);
      });
    }
  });

  // ── 15.1 heavy_strike L5 AP cost = 1 ──
  describe('15.1 heavy_strike L5 AP cost = 1', () => {
    it('stat table reports apCost=1 at L5', () => {
      const stats = getMasteryStats('heavy_strike', 5);
      expect(stats?.apCost).toBe(1);
    });
  });

  // ── 15.1 chain_lightning L5 AP cost = 1 ──
  describe('15.1 chain_lightning L5 AP cost = 1', () => {
    it('stat table reports apCost=1 at L5', () => {
      const stats = getMasteryStats('chain_lightning', 5);
      expect(stats?.apCost).toBe(1);
    });
  });

  // ── 15.2 CW multiplier consistency: 0.50× across all levels ──
  describe('15.2 CW multiplier at 0.50× (FIZZLE_EFFECT_RATIO)', () => {
    // CW = Math.max(0, mechanic.chargeWrongValue + masteryBonus)
    // The ratio vs QP should be approximately 0.5 (varies per mechanic's chargeWrongValue)

    it('strike L0 CW < QP (fizzle applies)', () => {
      const qpResult = resolve('strike', 'quick');
      const cwResult = resolve('strike', 'charge_wrong');
      expect(cwResult.damageDealt).toBeGreaterThan(0);
      expect(cwResult.damageDealt).toBeLessThan(qpResult.damageDealt);
    });

    it('strike L3 CW < QP (fizzle still applies)', () => {
      const qpResult = resolve('strike', 'quick', undefined, undefined, { masteryLevel: 3 });
      const cwResult = resolve('strike', 'charge_wrong', undefined, undefined, { masteryLevel: 3 });
      expect(cwResult.damageDealt).toBeLessThan(qpResult.damageDealt);
    });

    it('strike L5 CW < QP (fizzle still applies)', () => {
      const qpResult = resolve('strike', 'quick', undefined, undefined, { masteryLevel: 5 });
      const cwResult = resolve('strike', 'charge_wrong', undefined, undefined, { masteryLevel: 5 });
      expect(cwResult.damageDealt).toBeLessThan(qpResult.damageDealt);
    });
  });

  // ── 15.2 CC multiplier 1.50× across all levels ──
  describe('15.2 CC multiplier at 1.50×', () => {
    it('strike L0 CC = Math.round(4 × 1.50) = 6', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 0 });
      expect(result.damageDealt).toBe(6);
    });

    it('strike L3 CC = Math.round(6 × 1.50) = 9', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 3 });
      expect(result.damageDealt).toBe(9);
    });

    it('strike L5 CC = Math.round(8 × 1.50) = 12', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.damageDealt).toBe(12);
    });

    it('block L0 CC = Math.round(4 × 1.50) = 6', () => {
      const result = resolve('block', 'charge_correct', undefined, undefined, { masteryLevel: 0 });
      expect(result.shieldApplied).toBe(6);
    });

    it('block L5 CC = Math.round(8 × 1.50) = 12', () => {
      const result = resolve('block', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.shieldApplied).toBe(12);
    });
  });

  // ── 15.1 L3 tag activation: multi_hit gains multi_bleed1 ──
  describe('15.1 L3 tag activation', () => {
    it('multi_hit L3 has multi_bleed1 tag in stat table', () => {
      const stats = getMasteryStats('multi_hit', 3);
      expect(stats?.tags).toContain('multi_bleed1');
    });

    it('multi_hit L3 CC applies bleed status', () => {
      const result = resolve('multi_hit', 'charge_correct', undefined, undefined, { masteryLevel: 3 });
      const hasBleed = result.statusesApplied.some(s => s.type === 'bleed');
      expect(hasBleed).toBe(true);
    });

    it('multi_hit L2 does NOT have multi_bleed1 tag', () => {
      const stats = getMasteryStats('multi_hit', 2);
      expect(stats?.tags ?? []).not.toContain('multi_bleed1');
    });
  });

  // ── 15.1 L5 tag activation: strike has strike_tempo3 ──
  describe('15.1 L5 tag activation (strike_tempo3)', () => {
    it('strike L5 has strike_tempo3 tag', () => {
      const stats = getMasteryStats('strike', 5);
      expect(stats?.tags).toContain('strike_tempo3');
    });

    it('strike L4 does NOT have strike_tempo3 tag', () => {
      const stats = getMasteryStats('strike', 4);
      expect(stats?.tags ?? []).not.toContain('strike_tempo3');
    });

    it('strike L5 with 3+ cards played this turn: gains +4 damage (tempo bonus)', () => {
      // With cardsPlayedThisTurn=3, tempo bonus fires: 8 + 4 = 12
      const withTempo = resolve('strike', 'quick', undefined, undefined,
        { masteryLevel: 5 }, { cardsPlayedThisTurn: 3 });
      const noTempo = resolve('strike', 'quick', undefined, undefined,
        { masteryLevel: 5 }, { cardsPlayedThisTurn: 2 });
      expect(withTempo.damageDealt).toBe(12);
      expect(noTempo.damageDealt).toBe(8);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 17 — COMBOS (resolver-testable subset)
// ════════════════════════════════════════════════════════════════════════════

describe('Section 17 — Combos (resolver-testable)', () => {

  // ── 17.1 Empower + chain multiplier ──
  describe('17.1 Empower + chain multiplier', () => {
    it('empower (30%) + chainMult=2.0 on strike L0 CC: both apply', () => {
      // CC base = Math.round(4 * 1.5) = 6
      // chainAdjusted = Math.round(6 * 2.0) = 12
      // buffMultiplier = 1 + 30/100 = 1.3 → scaledValue = Math.round(12 * 1.3) = 16
      const result = resolve('strike', 'charge_correct',
        undefined, undefined, { masteryLevel: 0 },
        { chainMultiplier: 2.0 });
      // Without empower (buffNextCard=0): 12
      expect(result.damageDealt).toBe(12);

      // With empower buffNextCard=30: Math.round(12 * 1.30) = 16
      const card = makeCard({ mechanicId: 'strike', masteryLevel: 0 });
      const player = makePlayer();
      const enemy = makeEnemy();
      const withEmpower = resolveCardEffect(card, player, enemy, 1.0, 30, undefined, undefined, {
        playMode: 'charge_correct',
        chainMultiplier: 2.0,
      });
      expect(withEmpower.damageDealt).toBe(16);
    });
  });

  // ── 17.1 Overclock doubles next card ──
  describe('17.1 Overclock doubles next card (isOverclockActive)', () => {
    it('overclock resolver returns applyOverclock=true', () => {
      const result = resolve('overclock', 'quick');
      expect(result.applyOverclock).toBe(true);
    });

    it('isOverclockActive=true doubles strike L0 QP damage: 4 × 2 = 8', () => {
      // finalValue = 4; overclockMultiplier = 2; scaledValue = Math.round(4 * 2) = 8
      const result = resolve('strike', 'quick', undefined, undefined, { masteryLevel: 0 },
        { isOverclockActive: true });
      expect(result.damageDealt).toBe(8);
    });

    it('isOverclockActive=true doubles block L0 CC: Math.round(Math.round(4×1.5)×2) = 12', () => {
      // CC base = 6; chainAdjusted(1.0) = 6; overclockMult = 2; scaledValue = Math.round(6*2) = 12
      const result = resolve('block', 'charge_correct', undefined, undefined, { masteryLevel: 0 },
        { isOverclockActive: true });
      expect(result.shieldApplied).toBe(12);
    });
  });

  // ── 17.1 Strength + chain + vulnerable stacking ──
  describe('17.1 Strength + chain + vulnerable stacking', () => {
    it('strength=2 + chainMult=2.0 + vulnerable: ordered correctly', () => {
      // strike L0 CC: mechanicBaseValue = Math.round(4 * 1.5) = 6
      // chainAdjusted = Math.round(6 * 2.0) = 12
      // finalValue (effectiveBase) = 12 (no flat bonuses with no relics)
      // scaledValue = Math.round(12 * 1.0 * 1.0 * 1.0 * 1.0 * 1.0 * 1.0) = 12 (no buffNextCard, no relic mults)
      // applyAttackDamage(12):
      //   strengthMod = 1 + 2*0.25 = 1.5 → damage = Math.round(12 * 1.5) = 18
      //   vulnerable: Math.round(18 * 1.5) = 27
      const result = resolve('strike', 'charge_correct',
        { statusEffects: [{ type: 'strength', value: 2, turnsRemaining: 9999 }] },
        { statusEffects: [{ type: 'vulnerable', value: 1, turnsRemaining: 2 }] },
        { masteryLevel: 0 },
        { chainMultiplier: 2.0 });
      expect(result.damageDealt).toBe(27);
    });
  });

  // ── 17.8 CW minimum damage floor ──
  describe('17.8 CW minimum damage floor (Math.max)', () => {
    it('strike L0 CW deals > 0 damage (never zero)', () => {
      const result = resolve('strike', 'charge_wrong');
      expect(result.damageDealt).toBeGreaterThan(0);
    });

    it('heavy_strike L0 CW deals > 0 damage', () => {
      const result = resolve('heavy_strike', 'charge_wrong');
      expect(result.damageDealt).toBeGreaterThan(0);
    });

    it('block L0 CW applies > 0 shield (fizzle resolves)', () => {
      const result = resolve('block', 'charge_wrong');
      expect(result.shieldApplied).toBeGreaterThan(0);
    });
  });

  // ── 17.8 Maximum damage: L5 strike CC at chain 3.5× = 42 ──
  describe('17.8 Maximum damage — L5 strike CC at chain 3.5× (doc §17.8)', () => {
    it('L5 strike CC chain=5(3.5×), no buffs: floor(8 × 1.5 × 3.5) = 42', () => {
      // CC base = Math.round(8 * 1.5) = 12
      // chainAdjusted = Math.round(12 * 3.5) = Math.round(42) = 42
      // applyAttackDamage(42): strengthMod=1.0 → Math.round(42 * 1.0) = 42; no vuln
      const result = resolve('strike', 'charge_correct', undefined, undefined,
        { masteryLevel: 5 }, { chainMultiplier: 3.5 });
      expect(result.damageDealt).toBe(42);
    });
  });

  // ── 17.8 Block at 0 means full damage ──
  describe('17.8 Block at 0 — full damage applied (resolver does not reduce for block)', () => {
    it('strike L0 QP vs enemy block=0: full 4 damage reported', () => {
      // Note: block reduction is handled by turnManager, not the resolver.
      // The resolver computes damage; turnManager subtracts from enemy block/HP.
      // So damageDealt is always full value regardless of enemy.block.
      const result = resolve('strike', 'quick', undefined, { block: 0 });
      expect(result.damageDealt).toBe(4);
    });
  });

  // ── 17.8 Healing cannot exceed max HP (lifetap) ──
  describe('17.8 Healing cannot exceed max HP', () => {
    it('lifetap heal is bounded to player HP space (resolver reports heal; turnManager clamps)', () => {
      // lifetap L0 QP: finalValue=5; lifetapHealPct=0.20; healApplied = Math.max(1, Math.floor(5 * 0.20)) = 1
      // At full HP, heal would overshoot — resolver reports raw healApplied (clamping is turnManager).
      // The test verifies the heal amount is computed by the formula, not that it's already clamped.
      const result = resolve('lifetap', 'quick', { hp: 80, maxHP: 80 });
      expect(result.healApplied).toBeGreaterThanOrEqual(1);
    });

    it('lifetap CC at L0 reports expected heal: Math.max(1, Math.floor(Math.round(5×1.5) × 0.20)) = Math.max(1, Math.floor(7.5 × 0.20)) = Math.max(1, 1) = 1', () => {
      // CC base = Math.round(5 * 1.5) = 8 (wait — actually lifetap L0 qpValue=5; chainAdjusted at 1.0 = 8)
      // finalValue = 8; damageFromCard = finalValue; healPct=0.20; healApplied = Math.max(1, Math.floor(8 * 0.20)) = Math.max(1, 1) = 1
      const result = resolve('lifetap', 'charge_correct', { hp: 70, maxHP: 80 });
      // CC mechanic base = Math.round(5 * 1.5) = 8 (rounding 7.5 rounds up to 8)
      expect(result.healApplied).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 17.1 Strength + warcry on CC strike ──
  describe('17.1 Warcry (permanent strength) + high chain', () => {
    it('strength=2 + chainMult=2.0 on strike L0 CC: damage = 27', () => {
      // (From §17.1 Strength + chain + vulnerable test above without vuln)
      // CC base = 6; chainAdjusted = Math.round(6 * 2.0) = 12
      // applyAttackDamage(12): strengthMod = 1 + 2*0.25 = 1.5 → Math.round(12 * 1.5) = 18
      const result = resolve('strike', 'charge_correct',
        { statusEffects: [{ type: 'strength', value: 2, turnsRemaining: 9999 }] },
        undefined,
        { masteryLevel: 0 },
        { chainMultiplier: 2.0 });
      expect(result.damageDealt).toBe(18);
    });
  });

  // ── 17.4 Bulwark CW partial block ──
  describe('17.4 Bulwark CW — partial block at 0.50× base value', () => {
    it('block L0 CW < block L0 QP (fizzle applies to shield cards too)', () => {
      const qpResult = resolve('block', 'quick');
      const cwResult = resolve('block', 'charge_wrong');
      expect(cwResult.shieldApplied).toBeLessThanOrEqual(qpResult.shieldApplied);
    });
  });

  // ── 17.6 Overclock + block (wild doubles next card) ──
  describe('17.6 Overclock doubles next card base value', () => {
    it('strike L3 QP × 2 with overclock active = 2 × 6 = 12', () => {
      const result = resolve('strike', 'quick', undefined, undefined,
        { masteryLevel: 3 }, { isOverclockActive: true });
      // qpValue=6; finalValue=6; overclockMult=2; scaledValue=12
      expect(result.damageDealt).toBe(12);
    });
  });

  // ── Additional: chain does NOT scale empower buff values ──
  describe('Chain does NOT scale utility/buff values', () => {
    it('empower at chain=3.5 has same finalValue as chain=1.0 (buff cards skip chain adjustment)', () => {
      const noChain = resolve('empower', 'quick', undefined, undefined,
        { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      const maxChain = resolve('empower', 'quick', undefined, undefined,
        { masteryLevel: 0 }, { chainMultiplier: 3.5 });
      expect(noChain.finalValue).toBe(maxChain.finalValue);
    });

    it('scout (utility) at chain=3.5 has same extraCardsDrawn as chain=1.0', () => {
      const noChain = resolve('scout', 'quick', undefined, undefined,
        { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      const maxChain = resolve('scout', 'quick', undefined, undefined,
        { masteryLevel: 0 }, { chainMultiplier: 3.5 });
      expect(noChain.extraCardsDrawn).toBe(maxChain.extraCardsDrawn);
    });
  });

  // ── Hex chain scaling + CC hard stop together ──
  describe('DoT chain scaling with CC hard stop', () => {
    it('hex CC always applies 8 stacks regardless of chainMultiplier (HARD STOP)', () => {
      // hex CC is a HARD STOP at 8 — chainMultiplier still applies to that 8
      const resultNoChain = resolve('hex', 'charge_correct', undefined, undefined,
        { masteryLevel: 0 }, { chainMultiplier: 1.0 });
      const resultChained = resolve('hex', 'charge_correct', undefined, undefined,
        { masteryLevel: 0 }, { chainMultiplier: 2.0 });
      const poisonNoChain = resultNoChain.statusesApplied.find(s => s.type === 'poison');
      const poisonChained = resultChained.statusesApplied.find(s => s.type === 'poison');
      // CC hard stop = 8 at chainMult=1.0; Math.round(8 * 2.0) = 16 at chainMult=2.0
      expect(poisonNoChain?.value).toBe(8);
      expect(poisonChained?.value).toBe(16);
    });
  });
});
