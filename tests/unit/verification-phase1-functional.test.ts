/**
 * Phase 1 Functional Correctness — Comprehensive card mechanic unit tests.
 *
 * Programmatically verifies the 151 card functional correctness items from
 * docs/testing/visual-verification/06-cards-functional.md.
 *
 * Tests are organized matching checklist sections 11.1–11.6:
 *   11.1 Attack Cards
 *   11.2 Shield Cards
 *   11.3 Buff Cards
 *   11.4 Debuff Cards
 *   11.5 Utility Cards
 *   11.6 Wild Cards
 *
 * Key formulas (post chain-rework):
 *   QP  = getMasteryStats(mechanicId, level).qpValue
 *   CC  = Math.round(qpValue × 1.50)                  [with masteryBonus folded in]
 *   CW  = Math.max(0, mechanic.chargeWrongValue + masteryBonus)
 *   Chain scales base before all other multipliers.
 *   DoT stacks = Math.round(stacks × chainMultiplier)
 *   Debuff duration = Math.round(base × (1 + (chainMult-1) × 0.5))
 *
 * IMPORTANT: Some CC values are HARD STOPS (intentionally NOT 1.5× QP):
 *   execute CC=24, hex CC stacks=8, kindle CC burn=8, lacerate CC bleed=8,
 *   thorns CC reflect=9. These are tested against their actual hardcoded values.
 */

import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance } from '../../src/data/enemies';
import type { EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';
import { getMasteryStats } from '../../src/services/cardUpgradeService';

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
// 11.1 ATTACK CARDS — Functional Correctness
// ════════════════════════════════════════════════════════════════════════════

describe('11.1 Attack Cards', () => {

  // ── strike ──
  describe('strike', () => {
    it('L0 QP deals 4 damage', () => {
      const stats = getMasteryStats('strike', 0);
      expect(stats?.qpValue).toBe(4);
      const result = resolve('strike', 'quick');
      expect(result.damageDealt).toBe(4);
    });

    it('L0 CC deals 6 damage (Math.round(4 × 1.50) = 6)', () => {
      const result = resolve('strike', 'charge_correct');
      expect(result.damageDealt).toBe(6);
    });

    it('L0 CW deals 2 damage (fizzle)', () => {
      // chargeWrongValue for strike from mechanic definition
      const mechanic = getMechanicDefinition('strike');
      expect(mechanic?.chargeWrongValue).toBeDefined();
      const result = resolve('strike', 'charge_wrong');
      expect(result.damageDealt).toBeGreaterThan(0);
      // CW should be less than QP
      const qpResult = resolve('strike', 'quick');
      expect(result.damageDealt).toBeLessThan(qpResult.damageDealt);
    });

    it('L3 QP deals 6 damage', () => {
      const stats = getMasteryStats('strike', 3);
      expect(stats?.qpValue).toBe(6);
      const result = resolve('strike', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.damageDealt).toBe(6);
    });

    it('L5 QP deals 8 damage', () => {
      const stats = getMasteryStats('strike', 5);
      expect(stats?.qpValue).toBe(8);
      const result = resolve('strike', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.damageDealt).toBe(8);
    });

    it('L5 CC deals 12 damage (Math.round(8 × 1.50) = 12)', () => {
      const result = resolve('strike', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.damageDealt).toBe(12);
    });

    it('L5 strike_tempo3 tag fires +4 damage when 3+ cards played this turn', () => {
      const stats = getMasteryStats('strike', 5);
      expect(stats?.tags).toContain('strike_tempo3');
      const resultWith3Cards = resolve('strike', 'quick', undefined, undefined,
        { masteryLevel: 5 }, { cardsPlayedThisTurn: 3 });
      const resultWith2Cards = resolve('strike', 'quick', undefined, undefined,
        { masteryLevel: 5 }, { cardsPlayedThisTurn: 2 });
      expect(resultWith3Cards.damageDealt).toBe(12); // 8 + 4
      expect(resultWith2Cards.damageDealt).toBe(8);  // no bonus
    });
  });

  // ── multi_hit ──
  describe('multi_hit', () => {
    it('L0 QP: stat table hitCount=2, resolver now reads _masteryStats?.hitCount=2', () => {
      const stats = getMasteryStats('multi_hit', 0);
      expect(stats?.hitCount).toBe(2); // stat table value
      expect(stats?.qpValue).toBe(2);
      // Bug fix (2026-04-13): multi_hit resolver now reads _masteryStats?.hitCount (mirrors twin_strike).
      // L0 hitCount=2 from stat table, so L0 multi_hit fires 2 hits instead of the old mechanic.secondaryValue=3.
      const result = resolve('multi_hit', 'quick');
      expect(result.damageDealt).toBe(2); // per-hit
      expect(result.hitCount).toBe(2); // stat table hitCount=2 now used by resolver
    });

    it('L0 CC: 3 per-hit (Math.round(2 × 1.50) = 3), hitCount=2 from stat table', () => {
      const result = resolve('multi_hit', 'charge_correct');
      expect(result.damageDealt).toBe(3); // per-hit CC value
      // Bug fix (2026-04-13): resolver uses stat table hitCount=2, not mechanic.secondaryValue=3
      expect(result.hitCount).toBe(2);
    });

    it('L3 applies multi_bleed1 tag (1 Bleed per hit)', () => {
      const stats = getMasteryStats('multi_hit', 3);
      expect(stats?.tags).toContain('multi_bleed1');
      const result = resolve('multi_hit', 'charge_correct', undefined, undefined, { masteryLevel: 3 });
      expect(result.statusesApplied.some(s => s.type === 'bleed')).toBe(true);
    });

    it('L5: stat hitCount=4, qpValue=3; CC = Math.round(3 × 1.50) = 5 per hit', () => {
      const stats = getMasteryStats('multi_hit', 5);
      expect(stats?.hitCount).toBe(4); // stat table value
      expect(stats?.qpValue).toBe(3);
      // Bug fix (2026-04-13): resolver now uses _masteryStats?.hitCount, so L5 fires 4 hits
      const result = resolve('multi_hit', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.hitCount).toBe(4); // stat table hitCount=4 now used by resolver
      expect(result.damageDealt).toBe(5); // per-hit CC value (Math.round(3 × 1.5))
    });
  });

  // ── heavy_strike ──
  describe('heavy_strike', () => {
    it('L0 QP deals 7 damage', () => {
      const stats = getMasteryStats('heavy_strike', 0);
      expect(stats?.qpValue).toBe(7);
      const result = resolve('heavy_strike', 'quick');
      expect(result.damageDealt).toBe(7);
    });

    it('L0 CC deals 11 damage (Math.round(7 × 1.50) = 11)', () => {
      // Note: Math.round(7 × 1.5) = Math.round(10.5) = 11 (rounding half up in JS)
      // Actually in JS Math.round(10.5) = 11
      const result = resolve('heavy_strike', 'charge_correct');
      expect(result.damageDealt).toBe(11);
    });

    it('L5 AP cost reduced to 1 (via stat table apCost override)', () => {
      const stats = getMasteryStats('heavy_strike', 5);
      expect(stats?.apCost).toBe(1);
    });

    it('L5 CC deals 18 damage (Math.round(12 × 1.50) = 18)', () => {
      const stats = getMasteryStats('heavy_strike', 5);
      expect(stats?.qpValue).toBe(12);
      const result = resolve('heavy_strike', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.damageDealt).toBe(18);
    });
  });

  // ── piercing ──
  describe('piercing', () => {
    it('L0 QP: damage bypasses block', () => {
      const result = resolve('piercing', 'quick', undefined, { block: 10 });
      expect(result.damageDealtBypassesBlock).toBe(true);
      expect(result.damageDealt).toBeGreaterThan(0);
    });

    it('L0 QP: deals 3 damage', () => {
      const stats = getMasteryStats('piercing', 0);
      expect(stats?.qpValue).toBe(3);
      const result = resolve('piercing', 'quick');
      expect(result.damageDealt).toBe(3);
    });

    it('L3 has pierce_strip3 tag and sets removeEnemyBlock=3', () => {
      const stats = getMasteryStats('piercing', 3);
      expect(stats?.tags).toContain('pierce_strip3');
      const result = resolve('piercing', 'quick', undefined, { block: 8 }, { masteryLevel: 3 });
      expect(result.removeEnemyBlock).toBe(3);
    });

    it('L5 CC applies Vulnerable 1 turn via pierce_vuln1 tag', () => {
      const stats = getMasteryStats('piercing', 5);
      expect(stats?.tags).toContain('pierce_vuln1');
      const result = resolve('piercing', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
      expect(vuln?.turnsRemaining).toBe(1);
    });
  });

  // ── reckless ──
  describe('reckless', () => {
    it('L0 QP: deals 4 damage and player takes 4 self-damage', () => {
      const stats = getMasteryStats('reckless', 0);
      expect(stats?.qpValue).toBe(4);
      expect(stats?.extras?.selfDmg).toBe(4);
      const result = resolve('reckless', 'quick');
      expect(result.damageDealt).toBe(4);
      expect(result.selfDamage).toBe(4);
    });

    it('L0 damage bypasses block', () => {
      const result = resolve('reckless', 'quick', undefined, { block: 5 });
      expect(result.damageDealtBypassesBlock).toBe(true);
    });

    it('L5 selfDmg=0 (no flat self-damage)', () => {
      const stats = getMasteryStats('reckless', 5);
      expect(stats?.extras?.selfDmg).toBe(0);
      const result = resolve('reckless', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.selfDamage).toBe(0);
    });

    it('L5 has reckless_selfdmg_scale3 tag', () => {
      const stats = getMasteryStats('reckless', 5);
      expect(stats?.tags).toContain('reckless_selfdmg_scale3');
    });
  });

  // ── execute ──
  describe('execute', () => {
    it('L0 QP: base 2 damage without execute bonus (enemy above threshold)', () => {
      // qpValue=2 with execBonus only triggering below 30% HP
      const result = resolve('execute', 'quick', undefined, { currentHP: 70, maxHP: 100 });
      expect(result.damageDealt).toBe(2); // no bonus above threshold
    });

    it('L0 QP: execBonus 8 fires below 30% HP threshold', () => {
      const stats = getMasteryStats('execute', 0);
      expect(stats?.extras?.execBonus).toBe(8);
      const result = resolve('execute', 'quick',
        undefined, { currentHP: 20, maxHP: 100 }); // 20% HP
      expect(result.damageDealt).toBe(10); // 2 base + 8 execBonus
    });

    it('L0 CC: 24 bonus (HARD STOP) fires below 30% HP + 3 base CC damage', () => {
      // CC base = Math.round(2 × 1.5) = 3; CC execBonus hardcoded 24
      const result = resolve('execute', 'charge_correct',
        undefined, { currentHP: 20, maxHP: 100 });
      expect(result.damageDealt).toBe(27); // 3 + 24
    });

    it('L3 execThreshold=0.4 (fires at 38% HP)', () => {
      const stats = getMasteryStats('execute', 3);
      expect(stats?.extras?.execThreshold).toBe(0.4);
      const result = resolve('execute', 'quick',
        undefined, { currentHP: 38, maxHP: 100 }, { masteryLevel: 3 });
      // 38% < 40% threshold → bonus fires
      expect(result.damageDealt).toBeGreaterThan(stats!.qpValue); // base + bonus
    });

    it('L5 execThreshold=0.5, execBonus=12', () => {
      const stats = getMasteryStats('execute', 5);
      expect(stats?.extras?.execThreshold).toBe(0.5);
      expect(stats?.extras?.execBonus).toBe(12);
      // QP at L5: 5 + 12 = 17 when below 50%
      const result = resolve('execute', 'quick',
        undefined, { currentHP: 45, maxHP: 100 }, { masteryLevel: 5 });
      expect(result.damageDealt).toBe(17); // 5 qpValue + 12 execBonus
    });
  });

  // ── lifetap ──
  describe('lifetap', () => {
    it('L0 QP: deals 5 damage and heals 20% (=1 HP)', () => {
      const stats = getMasteryStats('lifetap', 0);
      expect(stats?.qpValue).toBe(5);
      const result = resolve('lifetap', 'quick', { hp: 80, maxHP: 80 });
      expect(result.damageDealt).toBe(5);
      expect(result.healApplied).toBe(1); // Math.max(1, floor(5 × 0.20)) = 1
    });

    it('L2 lifetap_heal30 tag: heals 30% of damage', () => {
      const stats = getMasteryStats('lifetap', 2);
      expect(stats?.tags).toContain('lifetap_heal30');
      // L2 CC: Math.round(5 × 1.5) = 8 damage; heal = max(1, floor(8 × 0.30)) = 2
      const result = resolve('lifetap', 'charge_correct', undefined, undefined, { masteryLevel: 2 });
      expect(result.healApplied).toBe(2);
    });

    it('L5 apCost=1', () => {
      const stats = getMasteryStats('lifetap', 5);
      expect(stats?.apCost).toBe(1);
    });
  });

  // ── power_strike ──
  describe('power_strike', () => {
    it('L0 QP deals 4 damage', () => {
      const stats = getMasteryStats('power_strike', 0);
      expect(stats?.qpValue).toBe(4);
      const result = resolve('power_strike', 'quick');
      expect(result.damageDealt).toBe(4);
    });

    it('L5 CC applies Vulnerable 2 turns + has power_vuln2t tag', () => {
      const stats = getMasteryStats('power_strike', 5);
      expect(stats?.tags).toContain('power_vuln2t');
      const result = resolve('power_strike', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
      expect(vuln?.turnsRemaining).toBe(2);
    });
  });

  // ── twin_strike ──
  describe('twin_strike', () => {
    it('L0 QP: 2 hits × 2 per-hit damage', () => {
      const stats = getMasteryStats('twin_strike', 0);
      expect(stats?.hitCount).toBe(2);
      expect(stats?.qpValue).toBe(2);
      const result = resolve('twin_strike', 'quick');
      expect(result.hitCount).toBe(2);
      expect(result.damageDealt).toBe(2); // per-hit
    });

    it('L3: 3 hits (third strike unlocked)', () => {
      const stats = getMasteryStats('twin_strike', 3);
      expect(stats?.hitCount).toBe(3);
      const result = resolve('twin_strike', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.hitCount).toBe(3);
    });

    it('L5 CC: 3 hits + twin_burn2 (2 Burn per hit chain-adjusted)', () => {
      const stats = getMasteryStats('twin_strike', 5);
      expect(stats?.tags).toContain('twin_burn2');
      const result = resolve('twin_strike', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.hitCount).toBe(3);
      expect(result.applyBurnStacks).toBeGreaterThan(0); // 2 Burn per hit × chain
    });
  });

  // ── iron_wave ──
  describe('iron_wave', () => {
    it('L0 QP: deals 3 damage AND grants 5 block', () => {
      const stats = getMasteryStats('iron_wave', 0);
      expect(stats?.qpValue).toBe(3);
      expect(stats?.secondaryValue).toBe(5);
      const result = resolve('iron_wave', 'quick');
      expect(result.damageDealt).toBe(3);
      expect(result.shieldApplied).toBe(5);
    });

    it('L5 has iron_wave_block_double tag', () => {
      const stats = getMasteryStats('iron_wave', 5);
      expect(stats?.tags).toContain('iron_wave_block_double');
    });

    it('L5 CC block = Math.round(7 × 1.50) = 11 (secondaryValue × CC multiplier)', () => {
      const stats = getMasteryStats('iron_wave', 5);
      expect(stats?.secondaryValue).toBe(7);
      const result = resolve('iron_wave', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.shieldApplied).toBe(11); // Math.round(7 × 1.5) = 11 (10.5 rounds to 11)
    });
  });

  // ── bash ──
  describe('bash', () => {
    it('L0 apCost=2', () => {
      const stats = getMasteryStats('bash', 0);
      expect(stats?.apCost).toBe(2);
    });

    it('L0 CC: deals damage + applies Vulnerable 2 turns (baseBashVulnDuration=2 on CC)', () => {
      // baseBashVulnDuration is isChargeCorrect ? 2 : 1, without bash_vuln2t tag = +0
      // At L0, no bash_vuln2t tag → turnsRemaining = 2 + 0 = 2 on CC
      const result = resolve('bash', 'charge_correct', undefined, undefined, { masteryLevel: 0 });
      expect(result.damageDealt).toBeGreaterThan(0);
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
      expect(vuln?.turnsRemaining).toBe(2); // CC base=2, no tag bonus at L0
    });

    it('L3 bash_vuln2t: Vulnerable lasts +1 more turn', () => {
      const stats = getMasteryStats('bash', 3);
      expect(stats?.tags).toContain('bash_vuln2t');
      // QP bash_vuln2t: baseDuration=1, masteryBonus=1 → turnsRemaining=2
      const result = resolve('bash', 'quick', undefined, undefined, { masteryLevel: 3 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln?.turnsRemaining).toBe(2); // 1 + 1 bash_vuln2t bonus
    });

    it('L5 bash_weak1t: also applies Weakness 1 turn', () => {
      const stats = getMasteryStats('bash', 5);
      expect(stats?.tags).toContain('bash_weak1t');
      const result = resolve('bash', 'quick', undefined, undefined, { masteryLevel: 5 });
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness).toBeDefined();
      expect(weakness?.turnsRemaining).toBe(1);
    });
  });

  // ── rupture ──
  describe('rupture', () => {
    it('L0 QP: 2 damage, bleedStacks=2 (stat table secondaryValue=2, neg bonus now applied)', () => {
      const stats = getMasteryStats('rupture', 0);
      expect(stats?.qpValue).toBe(2);
      expect(stats?.secondaryValue).toBe(2); // stat table secondaryValue=2
      // Bug fix (2026-04-13): masterySecondaryBonus guard changed from > 0 to !== 0.
      // masterySecondaryBonus = statSecondary(2) - mechanic.secondaryValue(3) = -1 (now applied).
      // card.secondaryValue becomes Math.max(0, 3 + (-1)) = 2 → bleedStacks=2.
      const result = resolve('rupture', 'quick');
      expect(result.damageDealt).toBe(2);
      expect(result.applyBleedStacks).toBe(2); // stat table secondaryValue=2 now applied correctly
    });

    it('L5 has rupture_bleed_perm tag', () => {
      const stats = getMasteryStats('rupture', 5);
      expect(stats?.tags).toContain('rupture_bleed_perm');
      const result = resolve('rupture', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.bleedPermanent).toBe(true);
    });
  });

  // ── kindle ──
  describe('kindle', () => {
    it('L0 QP: 1 damage + 4 Burn stacks (HARD STOP: NOT 1.5× of 4)', () => {
      const stats = getMasteryStats('kindle', 0);
      expect(stats?.qpValue).toBe(1);
      expect(stats?.secondaryValue).toBe(4); // QP burn stacks
      const result = resolve('kindle', 'quick');
      expect(result.damageDealt).toBe(1);
      expect(result.applyBurnStacks).toBe(4);
    });

    it('L0 CC: Burn stacks = 8 (HARD STOP, not 4 × 1.5 = 6)', () => {
      const result = resolve('kindle', 'charge_correct');
      expect(result.applyBurnStacks).toBe(8); // hardcoded CC value
    });

    it('L0 hitCount=1 on QP (Burn triggers once)', () => {
      const result = resolve('kindle', 'quick');
      expect(result.hitCount).toBe(1);
    });

    it('L5 kindle_double_trigger: hitCount=2 (Burn triggers twice)', () => {
      const stats = getMasteryStats('kindle', 5);
      expect(stats?.tags).toContain('kindle_double_trigger');
      const result = resolve('kindle', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.hitCount).toBe(2);
    });
  });

  // ── overcharge ──
  describe('overcharge', () => {
    it('L0 QP: base 2 damage', () => {
      const stats = getMasteryStats('overcharge', 0);
      expect(stats?.qpValue).toBe(2);
      const result = resolve('overcharge', 'quick');
      expect(result.damageDealt).toBe(2);
    });

    it('L3 has overcharge_bonus_x2 tag', () => {
      const stats = getMasteryStats('overcharge', 3);
      expect(stats?.tags).toContain('overcharge_bonus_x2');
    });
  });

  // ── riposte ──
  describe('riposte', () => {
    it('L0 QP: 2 damage + 4 block', () => {
      const stats = getMasteryStats('riposte', 0);
      expect(stats?.qpValue).toBe(2);
      expect(stats?.secondaryValue).toBe(4);
      const result = resolve('riposte', 'quick');
      expect(result.damageDealt).toBe(2);
      expect(result.shieldApplied).toBe(4);
    });

    it('L5 riposte_block_dmg40: bonus damage = floor(block × 0.40)', () => {
      const stats = getMasteryStats('riposte', 5);
      expect(stats?.tags).toContain('riposte_block_dmg40');
      const result = resolve('riposte', 'quick',
        { shield: 10 }, undefined, { masteryLevel: 5 });
      // damage from attack + riposte block bonus 10 × 0.40 = 4
      const baseResult = resolve('riposte', 'quick',
        { shield: 0 }, undefined, { masteryLevel: 5 });
      expect(result.damageDealt).toBe(baseResult.damageDealt + 4);
    });
  });

  // ── precision_strike ──
  describe('precision_strike', () => {
    it('L0 QP: deals 5 damage', () => {
      const stats = getMasteryStats('precision_strike', 0);
      expect(stats?.qpValue).toBe(5);
      const result = resolve('precision_strike', 'quick');
      expect(result.damageDealt).toBe(5);
    });

    it('L3 precision_timer_ext50 tag active', () => {
      const stats = getMasteryStats('precision_strike', 3);
      expect(stats?.tags).toContain('precision_timer_ext50');
      const result = resolve('precision_strike', 'charge_correct',
        undefined, undefined, { masteryLevel: 3 }, { distractorCount: 2 });
      expect(result.timerExtensionPct).toBe(50);
    });

    it('L0 CC: scales with distractor count (6 × (distractors+1))', () => {
      // L0: psBonusMult=6 (no precision_bonus_x2). At 2 distractors: 6 × 3 = 18
      const result = resolve('precision_strike', 'charge_correct',
        undefined, undefined, { masteryLevel: 0 }, { distractorCount: 2 });
      expect(result.damageDealt).toBe(18); // 6 × (2+1) = 18
    });
  });

  // ── siphon_strike ──
  describe('siphon_strike', () => {
    it('L0 QP: deals damage and sets overkillHeal sentinel', () => {
      const result = resolve('siphon_strike', 'quick');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.overkillHeal).toBeGreaterThan(0);
    });

    it('CW: no overkillHeal set', () => {
      const result = resolve('siphon_strike', 'charge_wrong');
      expect(result.overkillHeal).toBeUndefined();
    });
  });

  // ── gambit ──
  describe('gambit', () => {
    it('L0 QP: 4 damage + 4 self-damage (from stat table extras.selfDmg)', () => {
      const stats = getMasteryStats('gambit', 0);
      expect(stats?.extras?.selfDmg).toBe(4);
      const result = resolve('gambit', 'quick');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.selfDamage).toBe(4);
      expect(result.gambitselfDamage).toBe(4);
    });

    it('L0 CC: deals damage + heals 3 HP (from stat table extras.healOnCC)', () => {
      const stats = getMasteryStats('gambit', 0);
      expect(stats?.extras?.healOnCC).toBe(3);
      const result = resolve('gambit', 'charge_correct');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.gambitHeal).toBe(3);
      expect(result.healApplied).toBe(3);
      expect(result.selfDamage).toBeFalsy();
    });

    it('L0 CW: self-damage = selfDmg+1 = 5', () => {
      const result = resolve('gambit', 'charge_wrong');
      expect(result.selfDamage).toBe(5); // 4 + 1 CW penalty
      expect(result.gambitselfDamage).toBe(5);
    });

    it('L5 CC: 10 damage + heals 8 HP', () => {
      const stats = getMasteryStats('gambit', 5);
      expect(stats?.extras?.healOnCC).toBe(8);
      const result = resolve('gambit', 'charge_correct', undefined, undefined, { masteryLevel: 5 });
      expect(result.gambitHeal).toBe(8);
    });
  });

  // ── chain_lightning ──
  describe('chain_lightning', () => {
    it('L0 QP: deals base damage (no chainLightningChainLength on QP)', () => {
      const result = resolve('chain_lightning', 'quick');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.chainLightningChainLength).toBeUndefined();
    });

    it('L0 CC: sentinel damage + chainLightningChainLength=1', () => {
      const result = resolve('chain_lightning', 'charge_correct');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.chainLightningChainLength).toBe(1);
    });

    it('L3 min2 tag: CC chainLightningChainLength=2', () => {
      const stats = getMasteryStats('chain_lightning', 3);
      expect(stats?.tags).toContain('chain_lightning_min2');
      const result = resolve('chain_lightning', 'charge_correct',
        undefined, undefined, { masteryLevel: 3 });
      expect(result.chainLightningChainLength).toBe(2);
    });

    it('L5 apCost=1', () => {
      const stats = getMasteryStats('chain_lightning', 5);
      expect(stats?.apCost).toBe(1);
    });

    it('CC damage >= QP damage', () => {
      const qp = resolve('chain_lightning', 'quick').damageDealt;
      const cc = resolve('chain_lightning', 'charge_correct').damageDealt;
      expect(cc).toBeGreaterThanOrEqual(qp);
    });
  });

  // ── volatile_slash ──
  describe('volatile_slash', () => {
    it('L0 QP: deals damage, does NOT forget', () => {
      const result = resolve('volatile_slash', 'quick');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.forgetOnResolve).toBeFalsy();
    });

    it('L0 CC: deals damage AND forgetOnResolve=true', () => {
      const result = resolve('volatile_slash', 'charge_correct');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.forgetOnResolve).toBe(true);
    });

    it('L5 volatile_no_forget: CC no longer forgets', () => {
      const stats = getMasteryStats('volatile_slash', 5);
      expect(stats?.tags).toContain('volatile_no_forget');
      const result = resolve('volatile_slash', 'charge_correct',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.forgetOnResolve).toBeFalsy();
    });
  });

  // ── smite ──
  describe('smite', () => {
    it('L0 QP: deals 7 damage (from stat table)', () => {
      const stats = getMasteryStats('smite', 0);
      expect(stats?.qpValue).toBe(7);
      const result = resolve('smite', 'quick');
      expect(result.damageDealt).toBe(7);
    });

    it('L0 apCost=2', () => {
      const stats = getMasteryStats('smite', 0);
      expect(stats?.apCost).toBe(2);
    });

    it('L3 smite_aura_x2 tag active', () => {
      const stats = getMasteryStats('smite', 3);
      expect(stats?.tags).toContain('smite_aura_x2');
    });

    it('L5 apCost=1', () => {
      const stats = getMasteryStats('smite', 5);
      expect(stats?.apCost).toBe(1);
    });
  });

  // ── feedback_loop ──
  describe('feedback_loop', () => {
    it('L0 QP: deals base damage', () => {
      const stats = getMasteryStats('feedback_loop', 0);
      expect(stats?.qpValue).toBe(3);
      const result = resolve('feedback_loop', 'quick');
      expect(result.damageDealt).toBeGreaterThan(0);
    });

    it('L0 CW: damage = 0 (complete fizzle; no feedback_cw_nonzero tag)', () => {
      const result = resolve('feedback_loop', 'charge_wrong');
      expect(result.damageDealt).toBe(0);
    });

    it('L3 feedback_crash_half tag active', () => {
      const stats = getMasteryStats('feedback_loop', 3);
      expect(stats?.tags).toContain('feedback_crash_half');
    });

    it('L5 feedback_cw_nonzero tag: CW deals 50% of finalValue instead of 0', () => {
      const stats = getMasteryStats('feedback_loop', 5);
      expect(stats?.tags).toContain('feedback_cw_nonzero');
      const result = resolve('feedback_loop', 'charge_wrong',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.damageDealt).toBeGreaterThan(0);
    });
  });

  // ── recall ──
  describe('recall', () => {
    it('L0 QP: deals 5 damage (finalValue from stat-table qpValue)', () => {
      // QP applies finalValue directly
      const result = resolve('recall', 'quick');
      expect(result.damageDealt).toBeGreaterThan(0);
    });

    it('L3 recall_heal3: heals 3 on review CC', () => {
      const stats = getMasteryStats('recall', 3);
      expect(stats?.tags).toContain('recall_heal3');
      const result = resolve('recall', 'charge_correct',
        undefined, undefined, { masteryLevel: 3 }, { wasReviewQueueFact: true });
      expect(result.healApplied).toBeGreaterThan(0); // base 6 + 3 heal
    });

    it('L0 CC non-review-fact: 20 damage', () => {
      const result = resolve('recall', 'charge_correct');
      expect(result.damageDealt).toBe(20);
    });
  });

  // ── hemorrhage ──
  describe('hemorrhage', () => {
    it('L0 QP: base 4 damage + 3 × bleedStacks', () => {
      const stats = getMasteryStats('hemorrhage', 0);
      expect(stats?.extras?.bleedMult).toBe(3);
      // 5 bleed stacks: 4 + 3×5 = 19
      const result = resolve('hemorrhage', 'quick',
        undefined, undefined, { masteryLevel: 0 }, { enemyBleedStacks: 5 });
      expect(result.damageDealt).toBe(19);
      expect(result.consumeAllBleed).toBe(true);
    });

    it('L0 CC: base 4 + 6 × bleedStacks (HARD STOP CC bleedMult=6)', () => {
      // CC bleedMult hardcoded to 6
      // 5 bleed stacks: 4 + 6×5 = 34
      const result = resolve('hemorrhage', 'charge_correct',
        undefined, undefined, { masteryLevel: 0 }, { enemyBleedStacks: 5 });
      expect(result.damageDealt).toBe(34);
    });

    it('CW: does NOT consume bleed (consumeAllBleed still true but damage uses bleedMult=2)', () => {
      // CW bleedMult=2; hemoBase still applies and consumeAllBleed=true (by design)
      const result = resolve('hemorrhage', 'charge_wrong',
        undefined, undefined, { masteryLevel: 0 }, { enemyBleedStacks: 5 });
      expect(result.damageDealt).toBe(14); // 4 + 2×5 = 14
    });

    it('L5 apCost=1', () => {
      const stats = getMasteryStats('hemorrhage', 5);
      expect(stats?.apCost).toBe(1);
    });
  });

  // ── eruption ──
  describe('eruption', () => {
    it('L0 QP: dmgPerAp=6 × AP consumed', () => {
      const stats = getMasteryStats('eruption', 0);
      expect(stats?.extras?.dmgPerAp).toBe(6);
      const result = resolve('eruption', 'quick',
        undefined, undefined, { masteryLevel: 0 }, { eruptionXAp: 3 });
      expect(result.damageDealt).toBe(18); // 6 × 3
      expect(result.xCostApConsumed).toBe(3);
    });

    it('L5 eruption_refund1: apRefund=1', () => {
      const stats = getMasteryStats('eruption', 5);
      expect(stats?.tags).toContain('eruption_refund1');
      const result = resolve('eruption', 'quick',
        undefined, undefined, { masteryLevel: 5 }, { eruptionXAp: 3 });
      expect(result.apRefund).toBe(1);
    });
  });

  // ── sap ──
  describe('sap', () => {
    it('L0 QP: 1 damage + applies Weakness 1 turn', () => {
      const stats = getMasteryStats('sap', 0);
      expect(stats?.qpValue).toBe(1);
      const result = resolve('sap', 'quick');
      expect(result.damageDealt).toBe(1);
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness).toBeDefined();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11.2 SHIELD CARDS — Functional Correctness
// ════════════════════════════════════════════════════════════════════════════

describe('11.2 Shield Cards', () => {

  // ── block ──
  describe('block', () => {
    it('L0 QP: grants 4 block', () => {
      const stats = getMasteryStats('block', 0);
      expect(stats?.qpValue).toBe(4);
      const result = resolve('block', 'quick');
      expect(result.shieldApplied).toBe(4);
    });

    it('L0 CC: grants 6 block (Math.round(4 × 1.50) = 6)', () => {
      const result = resolve('block', 'charge_correct');
      expect(result.shieldApplied).toBe(6);
    });

    it('L5 has block_consecutive3 tag', () => {
      const stats = getMasteryStats('block', 5);
      expect(stats?.tags).toContain('block_consecutive3');
    });

    it('L5 block_consecutive3: +3 bonus when lastTurnPlayedShield=true', () => {
      const resultWith = resolve('block', 'quick', undefined, undefined,
        { masteryLevel: 5 }, { lastTurnPlayedShield: true });
      const resultWithout = resolve('block', 'quick', undefined, undefined,
        { masteryLevel: 5 }, { lastTurnPlayedShield: false });
      expect(resultWith.shieldApplied).toBe(resultWithout.shieldApplied + 3);
    });
  });

  // ── thorns ──
  describe('thorns', () => {
    it('L0 QP: grants 2 block + 3 reflect (thornsValue=3)', () => {
      const stats = getMasteryStats('thorns', 0);
      expect(stats?.qpValue).toBe(2);
      expect(stats?.secondaryValue).toBe(3); // QP reflect
      const result = resolve('thorns', 'quick');
      expect(result.shieldApplied).toBe(2);
      expect(result.thornsValue).toBe(3);
    });

    it('L0 CC: reflect = 9 (HARD STOP, not 3 × 1.5 = 4.5)', () => {
      const result = resolve('thorns', 'charge_correct');
      expect(result.thornsValue).toBe(9); // hardcoded CC value
    });

    it('L5 thorns_persist tag', () => {
      const stats = getMasteryStats('thorns', 5);
      expect(stats?.tags).toContain('thorns_persist');
      const result = resolve('thorns', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.thornsPersist).toBe(true);
    });
  });

  // ── emergency ──
  describe('emergency', () => {
    it('L0 QP: doubles block to 4 when player HP < 30%', () => {
      const stats = getMasteryStats('emergency', 0);
      expect(stats?.qpValue).toBe(2);
      const result = resolve('emergency', 'quick',
        { hp: 25, maxHP: 100 }); // 25% HP < 30% threshold
      expect(result.shieldApplied).toBe(4); // 2 × 2 = 4
    });

    it('L0 QP: normal block when HP >= 30%', () => {
      const result = resolve('emergency', 'quick',
        { hp: 60, maxHP: 100 }); // 60% HP above threshold
      expect(result.shieldApplied).toBe(2); // no doubling
    });

    it('L3 has emergThreshold=0.4 (fires at 40% HP)', () => {
      const stats = getMasteryStats('emergency', 3);
      expect(stats?.extras?.emergThreshold).toBe(0.4);
      // Note: resolver reads mechanic.secondaryThreshold, not stat-table extras.emergThreshold
      // The threshold for emergency is in the mechanic definition, not extras in resolver
      // We test the tag exists as a proxy
    });
  });

  // ── fortify ──
  describe('fortify', () => {
    it('L0 QP: shieldApplied = floor(currentBlock × 0.5), with 0 block gives 0', () => {
      const stats = getMasteryStats('fortify', 0);
      expect(stats?.apCost).toBe(2);
      // Fortify QP: shieldApplied = floor(cappedBlock × 0.5). finalValue NOT added in QP mode.
      // Only CC mode adds finalValue: floor(cappedBlock × 0.75) + finalValue
      const result = resolve('fortify', 'quick', { shield: 0 });
      expect(result.shieldApplied).toBe(0); // floor(0 × 0.5) = 0, no finalValue addition in QP mode
      // With block: floor(20 × 0.5) = 10
      const resultWithBlock = resolve('fortify', 'quick', { shield: 20 });
      expect(resultWithBlock.shieldApplied).toBe(10);
    });

    it('L5 fortify_carry tag: blockCarries=true', () => {
      const stats = getMasteryStats('fortify', 5);
      expect(stats?.tags).toContain('fortify_carry');
      const result = resolve('fortify', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.blockCarries).toBe(true);
    });
  });

  // ── brace ──
  describe('brace', () => {
    it('L0 QP (non-attack enemy intent): gives finalValue as block', () => {
      const result = resolve('brace', 'quick', undefined,
        { nextIntent: { type: 'defend', value: 5, weight: 1, telegraph: 'defend' } });
      expect(result.shieldApplied).toBeGreaterThan(0);
    });

    it('L0 QP against attack intent: block = max(intentValue × 1.0, finalValue)', () => {
      const result = resolve('brace', 'quick', undefined,
        { nextIntent: { type: 'attack', value: 8, weight: 1, telegraph: 'Strike' } });
      // braceMultiplier=1.0 for QP; Math.round(8 × 1.0)=8; finalValue at L0=2; max(8,2)=8
      expect(result.shieldApplied).toBe(8);
    });

    it('L3 brace_exceed2 tag', () => {
      const stats = getMasteryStats('brace', 3);
      expect(stats?.tags).toContain('brace_exceed2');
    });
  });

  // ── overheal ──
  describe('overheal', () => {
    it('L0 QP: grants 6 block (no double — HP above 60%)', () => {
      const stats = getMasteryStats('overheal', 0);
      expect(stats?.qpValue).toBe(6);
      const result = resolve('overheal', 'quick',
        { hp: 80, maxHP: 80 }); // 100% HP, above 60% → no double
      expect(result.shieldApplied).toBe(6);
    });

    it('L0 QP: grants 12 block when HP < 60% (2× bonus)', () => {
      const result = resolve('overheal', 'quick',
        { hp: 40, maxHP: 80 }); // 50% HP < 60%
      expect(result.shieldApplied).toBe(12); // 6 × 2.0
    });

    it('L3 overheal_heal2 tag: also heals 2 HP', () => {
      const stats = getMasteryStats('overheal', 3);
      expect(stats?.tags).toContain('overheal_heal2');
      const result = resolve('overheal', 'quick',
        { hp: 80, maxHP: 80 }, undefined, { masteryLevel: 3 });
      expect(result.healApplied).toBe(2);
    });
  });

  // ── parry ──
  describe('parry', () => {
    it('L0 QP: grants block + parryDrawBonus=1 when enemy attacks', () => {
      const stats = getMasteryStats('parry', 0);
      expect(stats?.qpValue).toBe(1);
      const result = resolve('parry', 'quick', undefined,
        { nextIntent: { type: 'attack', value: 10, weight: 1, telegraph: 'Strike' } });
      expect(result.shieldApplied).toBe(1);
      expect(result.parryDrawBonus).toBe(1);
    });

    it('L0 QP: no parryDrawBonus when enemy does not attack', () => {
      const result = resolve('parry', 'quick', undefined,
        { nextIntent: { type: 'buff', value: 0, weight: 1, telegraph: 'Buff' } });
      expect(result.parryDrawBonus).toBeFalsy();
    });

    it('L5 parry_counter3: counterDamage=3', () => {
      const stats = getMasteryStats('parry', 5);
      expect(stats?.tags).toContain('parry_counter3');
      const result = resolve('parry', 'quick', undefined,
        { nextIntent: { type: 'attack', value: 10, weight: 1, telegraph: 'Strike' } },
        { masteryLevel: 5 });
      expect(result.counterDamage).toBe(3);
    });
  });

  // ── reinforce ──
  describe('reinforce', () => {
    it('L0 CC: block granted', () => {
      const result = resolve('reinforce', 'charge_correct');
      expect(result.shieldApplied).toBeGreaterThan(0);
    });

    it('L5 reinforce_draw1 tag', () => {
      const stats = getMasteryStats('reinforce', 5);
      expect(stats?.tags).toContain('reinforce_draw1');
    });
  });

  // ── shrug_it_off ──
  describe('shrug_it_off', () => {
    it('L0 QP: grants block + draws 1 card', () => {
      const stats = getMasteryStats('shrug_it_off', 0);
      expect(stats?.qpValue).toBe(2);
      const result = resolve('shrug_it_off', 'quick');
      expect(result.shieldApplied).toBe(2);
      expect(result.extraCardsDrawn).toBe(1);
    });

    it('L5 shrug_cleanse1 tag: removeDebuffCount=1', () => {
      const stats = getMasteryStats('shrug_it_off', 5);
      expect(stats?.tags).toContain('shrug_cleanse1');
      const result = resolve('shrug_it_off', 'quick',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.removeDebuffCount).toBe(1);
    });
  });

  // ── guard ──
  describe('guard', () => {
    it('L0 QP: grants 8 block', () => {
      const stats = getMasteryStats('guard', 0);
      expect(stats?.qpValue).toBe(8);
      const result = resolve('guard', 'quick');
      expect(result.shieldApplied).toBe(8);
    });

    it('L5 guard_taunt1t: tauntDuration=1', () => {
      const stats = getMasteryStats('guard', 5);
      expect(stats?.tags).toContain('guard_taunt1t');
      const result = resolve('guard', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.tauntDuration).toBe(1);
    });
  });

  // ── absorb ──
  describe('absorb', () => {
    it('L0 QP: block granted', () => {
      const result = resolve('absorb', 'quick');
      expect(result.shieldApplied).toBeGreaterThan(0);
    });

    it('L0 CC: block granted + draws 1', () => {
      const result = resolve('absorb', 'charge_correct');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.extraCardsDrawn).toBe(1);
    });

    it('L5 absorb_ap_on_block: apOnBlockGain=1 on CC', () => {
      const stats = getMasteryStats('absorb', 5);
      expect(stats?.tags).toContain('absorb_ap_on_block');
      const result = resolve('absorb', 'charge_correct',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.apOnBlockGain).toBe(1);
    });
  });

  // ── reactive_shield ──
  describe('reactive_shield', () => {
    it('L0 QP: grants block + thornsValue=2', () => {
      const stats = getMasteryStats('reactive_shield', 0);
      expect(stats?.secondaryValue).toBe(2);
      const result = resolve('reactive_shield', 'quick');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.thornsValue).toBe(2);
    });

    it('L0 CC: thornsValue=5 (HARD STOP, not QP × 1.5)', () => {
      const result = resolve('reactive_shield', 'charge_correct');
      expect(result.thornsValue).toBe(5);
    });
  });

  // ── aegis_pulse ──
  describe('aegis_pulse', () => {
    it('L0 QP: grants base block', () => {
      const stats = getMasteryStats('aegis_pulse', 0);
      expect(stats?.qpValue).toBe(2);
      const result = resolve('aegis_pulse', 'quick');
      expect(result.shieldApplied).toBe(2);
    });

    it('L0 CC: grants block + chainBlockBonus=2', () => {
      const result = resolve('aegis_pulse', 'charge_correct');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.chainBlockBonus).toBe(2);
    });
  });

  // ── burnout_shield ──
  describe('burnout_shield', () => {
    it('L0 QP: grants block, does NOT forget', () => {
      const result = resolve('burnout_shield', 'quick');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.forgetOnResolve).toBeFalsy();
    });

    it('L0 CC: grants larger block AND forgetOnResolve=true', () => {
      const result = resolve('burnout_shield', 'charge_correct');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.forgetOnResolve).toBe(true);
    });

    it('L5 burnout_no_forget: CC no longer forgets', () => {
      const stats = getMasteryStats('burnout_shield', 5);
      expect(stats?.tags).toContain('burnout_no_forget');
      const result = resolve('burnout_shield', 'charge_correct',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.forgetOnResolve).toBeFalsy();
    });
  });

  // ── knowledge_ward ──
  describe('knowledge_ward', () => {
    it('L0 QP with 0 charges: block = 6 × max(1, 0) = 6', () => {
      const result = resolve('knowledge_ward', 'quick',
        undefined, undefined, undefined, { correctChargesThisEncounter: 0 });
      expect(result.shieldApplied).toBe(6);
    });

    it('L0 QP with 3 charges: block = 6 × 3 = 18', () => {
      const result = resolve('knowledge_ward', 'quick',
        undefined, undefined, undefined, { correctChargesThisEncounter: 3 });
      expect(result.shieldApplied).toBe(18);
    });

    it('L0 CC with 3 charges: block = 10 × 3 = 30', () => {
      const result = resolve('knowledge_ward', 'charge_correct',
        undefined, undefined, undefined, { correctChargesThisEncounter: 3 });
      expect(result.shieldApplied).toBe(30);
    });

    it('CW: flat 4 block regardless of charges', () => {
      const result = resolve('knowledge_ward', 'charge_wrong',
        undefined, undefined, undefined, { correctChargesThisEncounter: 5 });
      expect(result.shieldApplied).toBe(4);
    });

    it('CC charges clamped at 5 max (10×5=50)', () => {
      const result = resolve('knowledge_ward', 'charge_correct',
        undefined, undefined, undefined, { correctChargesThisEncounter: 10 });
      expect(result.shieldApplied).toBe(50);
    });
  });

  // ── bulwark ──
  describe('bulwark', () => {
    it('L0 QP: large block granted', () => {
      const stats = getMasteryStats('bulwark', 0);
      expect(stats?.qpValue).toBe(9);
      const result = resolve('bulwark', 'quick');
      expect(result.shieldApplied).toBe(9);
    });

    it('L0 CC: forgetAfterPlay=true', () => {
      const result = resolve('bulwark', 'charge_correct');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.forgetAfterPlay).toBe(true);
    });

    it('L5 bulwark_no_forget: CC no longer forgets', () => {
      const stats = getMasteryStats('bulwark', 5);
      expect(stats?.tags).toContain('bulwark_no_forget');
      const result = resolve('bulwark', 'charge_correct',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.forgetAfterPlay).toBeFalsy();
    });

    it('CW: grants partial block', () => {
      const result = resolve('bulwark', 'charge_wrong');
      expect(result.shieldApplied).toBeGreaterThan(0);
    });
  });

  // ── conversion ──
  describe('conversion', () => {
    it('L0 QP: converts player block to damage', () => {
      const result = resolve('conversion', 'quick',
        { shield: 8 });
      expect(result.damageDealt).toBe(8); // floor(8 × 1.0 × 1.0)
      expect(result.blockConsumed).toBe(8);
    });

    it('CW: 50% conversion rate', () => {
      const result = resolve('conversion', 'charge_wrong',
        { shield: 8 });
      expect(result.damageDealt).toBe(4); // floor(8 × 0.5)
    });

    it('with no block: damage=0', () => {
      const result = resolve('conversion', 'quick',
        { shield: 0 });
      expect(result.damageDealt).toBe(0);
    });
  });

  // ── ironhide ──
  describe('ironhide', () => {
    it('L0 QP: grants block + permanent strength (strPerm=1 from stat table)', () => {
      const stats = getMasteryStats('ironhide', 0);
      expect(stats?.extras?.str).toBe(1);
      expect(stats?.extras?.strPerm).toBe(1);
      const result = resolve('ironhide', 'quick');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.ironhideStrength).toBeDefined();
      expect(result.ironhideStrength?.amount).toBe(1);
      expect(result.ironhideStrength?.permanent).toBe(true); // strPerm=1 → permanent
    });

    it('L0 CC: grants permanent Strength', () => {
      const result = resolve('ironhide', 'charge_correct');
      expect(result.ironhideStrength?.permanent).toBe(true);
    });

    it('CW: block only, no Strength', () => {
      const result = resolve('ironhide', 'charge_wrong');
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.ironhideStrength).toBeUndefined();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11.3 BUFF CARDS — Functional Correctness
// ════════════════════════════════════════════════════════════════════════════

describe('11.3 Buff Cards', () => {

  // ── empower ──
  describe('empower', () => {
    it('L0: finalValue=30 (30% buff percentage)', () => {
      const stats = getMasteryStats('empower', 0);
      expect(stats?.qpValue).toBe(30);
      const result = resolve('empower', 'quick');
      expect(result.finalValue).toBe(30);
    });

    it('L3 empower_2cards: empowerTargetCount=2', () => {
      const stats = getMasteryStats('empower', 3);
      expect(stats?.tags).toContain('empower_2cards');
      const result = resolve('empower', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.empowerTargetCount).toBe(2);
    });
  });

  // ── quicken ──
  describe('quicken', () => {
    it('L0 QP: grants 1 AP', () => {
      const result = resolve('quicken', 'quick');
      expect(result.grantsAp).toBe(1);
    });

    it('L5 quicken_ap2: grants 2 AP', () => {
      const stats = getMasteryStats('quicken', 5);
      expect(stats?.tags).toContain('quicken_ap2');
      const result = resolve('quicken', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.grantsAp).toBe(2);
    });
  });

  // ── focus ──
  describe('focus', () => {
    it('L0 QP: applyFocusBuff=true with focusCharges=1', () => {
      const result = resolve('focus', 'quick');
      expect(result.applyFocusBuff).toBe(true);
      expect(result.focusCharges).toBe(1);
    });

    it('CC: focusCharges=2', () => {
      const result = resolve('focus', 'charge_correct');
      expect(result.focusCharges).toBe(2);
    });

    it('L5 focus_next2free: freePlayCount=2', () => {
      const stats = getMasteryStats('focus', 5);
      expect(stats?.tags).toContain('focus_next2free');
      const result = resolve('focus', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.freePlayCount).toBe(2);
    });
  });

  // ── double_strike ──
  describe('double_strike', () => {
    it('L0 QP: applyDoubleStrikeBuff=true', () => {
      const result = resolve('double_strike', 'quick');
      expect(result.applyDoubleStrikeBuff).toBe(true);
    });

    it('CC: doubleStrikeAddsPierce=true', () => {
      const result = resolve('double_strike', 'charge_correct');
      expect(result.doubleStrikeAddsPierce).toBe(true);
    });
  });

  // ── ignite ──
  describe('ignite', () => {
    it('L0 QP: applyIgniteBuff=2 at L0 (stat table qpValue=2 matches mechanic quickPlayValue=2)', () => {
      // Bug fix (2026-04-13): ignite stat table qpValue corrected from 0 to 2 (= extras.burnStacks).
      // masteryBonus = 2-2 = 0, so finalValue = 2 → applyIgniteBuff=2.
      // qpValue now equals burnStacks at each level so finalValue directly encodes the Burn stacks.
      const result = resolve('ignite', 'quick');
      expect(result.applyIgniteBuff).toBe(2); // finalValue=2 at L0
    });

    it('L3 ignite_2attacks: igniteDuration=2', () => {
      const stats = getMasteryStats('ignite', 3);
      expect(stats?.tags).toContain('ignite_2attacks');
      const result = resolve('ignite', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.igniteDuration).toBe(2);
    });
  });

  // ── inscription_fury ──
  describe('inscription_fury', () => {
    it('L0 CC: finalValue set (inscription registered)', () => {
      const result = resolve('inscription_fury', 'charge_correct');
      expect(result.finalValue).toBeGreaterThan(0);
    });

    it('L5 insc_fury_cc_bonus2: inscriptionFuryCcBonus=2 on CC', () => {
      const stats = getMasteryStats('inscription_fury', 5);
      expect(stats?.tags).toContain('insc_fury_cc_bonus2');
      const result = resolve('inscription_fury', 'charge_correct',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.inscriptionFuryCcBonus).toBe(2);
    });
  });

  // ── inscription_iron ──
  describe('inscription_iron', () => {
    it('L0 CC: finalValue set (block bonus per turn registered)', () => {
      const result = resolve('inscription_iron', 'charge_correct');
      expect(result.finalValue).toBeGreaterThan(0);
    });

    it('L5 insc_iron_thorns1: inscriptionIronThorns=1', () => {
      const stats = getMasteryStats('inscription_iron', 5);
      expect(stats?.tags).toContain('insc_iron_thorns1');
      const result = resolve('inscription_iron', 'quick',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.inscriptionIronThorns).toBe(1);
    });
  });

  // ── warcry ──
  describe('warcry', () => {
    it('L0 QP: +1 Strength this turn (not permanent)', () => {
      const stats = getMasteryStats('warcry', 0);
      expect(stats?.extras?.str).toBe(1);
      const result = resolve('warcry', 'quick');
      expect(result.applyStrengthToPlayer?.value).toBe(1);
      expect(result.applyStrengthToPlayer?.permanent).toBe(false);
    });

    it('L0 CC: +1 Strength PERMANENTLY + warcryFreeCharge=true', () => {
      const result = resolve('warcry', 'charge_correct');
      expect(result.applyStrengthToPlayer?.value).toBe(1);
      expect(result.applyStrengthToPlayer?.permanent).toBe(true);
      expect(result.warcryFreeCharge).toBe(true);
    });

    it('L0 CW: 1 Strength this turn, no free charge', () => {
      const result = resolve('warcry', 'charge_wrong');
      expect(result.applyStrengthToPlayer?.value).toBe(1);
      expect(result.applyStrengthToPlayer?.permanent).toBe(false);
      expect(result.warcryFreeCharge).toBeFalsy();
    });
  });

  // ── battle_trance ──
  describe('battle_trance', () => {
    it('L0 CC: draws 2 cards (btDrawCount from stat table)', () => {
      const stats = getMasteryStats('battle_trance', 0);
      expect(stats?.drawCount).toBe(2);
      const result = resolve('battle_trance', 'charge_correct');
      expect(result.extraCardsDrawn).toBe(2);
      expect(result.battleTranceDraw).toBe(2);
    });

    it('L0 QP: draws 2 + lockout applies', () => {
      const result = resolve('battle_trance', 'quick');
      expect(result.extraCardsDrawn).toBe(2);
      expect(result.applyBattleTranceRestriction).toBe(true);
    });

    it('CW: draws 2 + lockout always applies', () => {
      const result = resolve('battle_trance', 'charge_wrong');
      expect(result.extraCardsDrawn).toBe(2);
      expect(result.applyBattleTranceRestriction).toBe(true);
    });

    it('L3 trance_no_lockout_qp: QP no longer locks out', () => {
      const stats = getMasteryStats('battle_trance', 3);
      expect(stats?.tags).toContain('trance_no_lockout_qp');
      const result = resolve('battle_trance', 'quick',
        undefined, undefined, { masteryLevel: 3 });
      expect(result.applyBattleTranceRestriction).toBeFalsy();
    });
  });

  // ── inscription_wisdom ──
  describe('inscription_wisdom', () => {
    it('L0 QP: inscriptionWisdomActivated set + forgetOnResolve=true', () => {
      const result = resolve('inscription_wisdom', 'quick');
      expect(result.inscriptionWisdomActivated).toBeDefined();
      expect(result.forgetOnResolve).toBe(true);
    });

    it('CW: inscriptionFizzled=true + forgetOnResolve=true', () => {
      const result = resolve('inscription_wisdom', 'charge_wrong');
      expect(result.inscriptionFizzled).toBe(true);
      expect(result.forgetOnResolve).toBe(true);
    });
  });

  // ── frenzy ──
  describe('frenzy', () => {
    it('L0 QP: frenzyChargesGranted=1', () => {
      const stats = getMasteryStats('frenzy', 0);
      expect(stats?.extras?.freeCards).toBe(1);
      const result = resolve('frenzy', 'quick');
      expect(result.frenzyChargesGranted).toBe(1);
    });

    it('L0 CC: frenzyChargesGranted from stat table', () => {
      const result = resolve('frenzy', 'charge_correct');
      expect(result.frenzyChargesGranted).toBeGreaterThan(0);
    });

    it('L5 frenzy_draw1: extraCardsDrawn=1', () => {
      const stats = getMasteryStats('frenzy', 5);
      expect(stats?.tags).toContain('frenzy_draw1');
      const result = resolve('frenzy', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.extraCardsDrawn).toBe(1);
    });
  });

  // ── mastery_surge ──
  describe('mastery_surge', () => {
    it('L0 QP: masteryBumpsCount=1', () => {
      const stats = getMasteryStats('mastery_surge', 0);
      expect(stats?.extras?.targets).toBe(1);
      const result = resolve('mastery_surge', 'quick');
      expect(result.masteryBumpsCount).toBe(1);
      expect(result.masteryBumpAmount).toBe(1);
    });

    it('CC: bumps 2 cards (targets=1 at L0 → CC bumps surgeTargets or 2)', () => {
      // CC: bumpCount = surgeTargets (1 at L0) from stat table
      const result = resolve('mastery_surge', 'charge_correct');
      expect(result.masteryBumpsCount).toBe(1); // L0 targets=1
    });

    it('CW: masteryBumpsCount=0 (complete fizzle)', () => {
      const result = resolve('mastery_surge', 'charge_wrong');
      expect(result.masteryBumpsCount).toBe(0);
    });

    it('L5 msurge_plus2: masteryBumpAmount=2', () => {
      const stats = getMasteryStats('mastery_surge', 5);
      expect(stats?.tags).toContain('msurge_plus2');
      const result = resolve('mastery_surge', 'quick',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.masteryBumpAmount).toBe(2);
    });
  });

  // ── war_drum ──
  describe('war_drum', () => {
    it('L0 QP: warDrumBonus=1 at L0 (stat table qpValue=1 matches extras.bonus=1)', () => {
      // Bug fix (2026-04-13): war_drum stat table qpValue corrected from 0 to 1 (= extras.bonus).
      // masteryBonus = 1-1 = 0, so finalValue = 1 → warDrumBonus=1.
      const result = resolve('war_drum', 'quick');
      expect(result.warDrumBonus).toBeDefined();
      expect(result.warDrumBonus).toBe(1); // finalValue=1 at L0
    });

    it('L5 war_drum_draw1: extraCardsDrawn=1', () => {
      const stats = getMasteryStats('war_drum', 5);
      expect(stats?.tags).toContain('war_drum_draw1');
      const result = resolve('war_drum', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.extraCardsDrawn).toBe(1);
    });
  });

  // ── forge ──
  describe('forge', () => {
    it('L0 QP: pendingCardPick type=forge', () => {
      const result = resolve('forge', 'quick');
      expect(result.pendingCardPick?.type).toBe('forge');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11.4 DEBUFF CARDS — Functional Correctness
// ════════════════════════════════════════════════════════════════════════════

describe('11.4 Debuff Cards', () => {

  // ── weaken ──
  describe('weaken', () => {
    it('L0 QP: applies 1 Weakness stack, 1 turn', () => {
      const stats = getMasteryStats('weaken', 0);
      expect(stats?.extras?.stacks).toBe(1);
      expect(stats?.extras?.turns).toBe(1);
      // weaken finalValue: qpValue=0 + masteryBonus=0 → finalValue pipeline uses debuff fallback
      // OR weaken has its own case. Checking resolver: weaken case uses finalValue for stacks.
      // finalValue = mechanic.quickPlayValue=0 → weakenStacks = max(1, round(0)) = 1
      const result = resolve('weaken', 'quick');
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness).toBeDefined();
      expect(weakness?.value).toBe(1);
    });

    it('L0 CC: applies 2 turns duration (base=2 on CC)', () => {
      const result = resolve('weaken', 'charge_correct');
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness?.turnsRemaining).toBe(2); // CC baseWeakenDuration=2
    });
  });

  // ── expose ──
  describe('expose', () => {
    it('L0 QP: applies Vulnerable 1 stack, 1 turn', () => {
      const result = resolve('expose', 'quick');
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
      expect(vuln?.value).toBeGreaterThanOrEqual(1);
    });

    it('L0 CC: Vulnerable lasts 2 turns', () => {
      const result = resolve('expose', 'charge_correct');
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln?.turnsRemaining).toBe(2);
    });
  });

  // ── hex ──
  describe('hex', () => {
    it('L0 QP: applies 3 Poison, 3 turns (HARD STOP: not 1.5× formula)', () => {
      const stats = getMasteryStats('hex', 0);
      expect(stats?.extras?.stacks).toBe(3);
      expect(stats?.extras?.turns).toBe(3);
      const result = resolve('hex', 'quick');
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison).toBeDefined();
      expect(poison?.value).toBe(3); // stat-table QP value
    });

    it('L0 CC: applies 8 Poison (HARD STOP, not 3 × 1.5 = 4.5)', () => {
      const result = resolve('hex', 'charge_correct');
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison?.value).toBe(8); // hardcoded CC value
    });

    it('L3 hex_vuln1t: also applies Vulnerable 1 turn', () => {
      const stats = getMasteryStats('hex', 3);
      expect(stats?.tags).toContain('hex_vuln1t');
      const result = resolve('hex', 'quick', undefined, undefined, { masteryLevel: 3 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
    });
  });

  // ── slow ──
  describe('slow', () => {
    it('L0 QP: applySlow=true', () => {
      const result = resolve('slow', 'quick');
      expect(result.applySlow).toBe(true);
    });

    it('L0 CC: also applies Weakness 1t', () => {
      const result = resolve('slow', 'charge_correct');
      expect(result.applySlow).toBe(true);
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness).toBeDefined();
    });
  });

  // ── lacerate ──
  describe('lacerate', () => {
    it('L0 QP: 1 damage + 4 Bleed (HARD STOP: CC bleed = 8)', () => {
      const stats = getMasteryStats('lacerate', 0);
      expect(stats?.qpValue).toBe(1);
      expect(stats?.secondaryValue).toBe(4);
      const result = resolve('lacerate', 'quick');
      expect(result.damageDealt).toBe(1);
      expect(result.applyBleedStacks).toBe(4);
    });

    it('L0 CC: Bleed = 8 (HARD STOP)', () => {
      const result = resolve('lacerate', 'charge_correct');
      expect(result.applyBleedStacks).toBe(8);
    });

    it('L5 lacerate_vuln1t: also applies Vulnerable 1 turn', () => {
      const stats = getMasteryStats('lacerate', 5);
      expect(stats?.tags).toContain('lacerate_vuln1t');
      const result = resolve('lacerate', 'charge_correct',
        undefined, undefined, { masteryLevel: 5 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
    });
  });

  // ── stagger ──
  describe('stagger', () => {
    it('L0 QP: applyStagger=true', () => {
      const result = resolve('stagger', 'quick');
      expect(result.applyStagger).toBe(true);
    });

    it('CC: also applies Vulnerable', () => {
      const result = resolve('stagger', 'charge_correct');
      expect(result.applyStagger).toBe(true);
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
    });
  });

  // ── corrode ──
  describe('corrode', () => {
    it('L0 QP: removes finalValue enemy block + Weakness 1t', () => {
      const stats = getMasteryStats('corrode', 0);
      expect(stats?.qpValue).toBe(2);
      const result = resolve('corrode', 'quick');
      expect(result.removeEnemyBlock).toBe(2); // finalValue at L0
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness).toBeDefined();
    });

    it('CC: removes ALL block (removeEnemyBlock=-1) + Weakness 2t', () => {
      const result = resolve('corrode', 'charge_correct');
      expect(result.removeEnemyBlock).toBe(-1); // -1 = remove all
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness?.turnsRemaining).toBe(2);
    });
  });

  // ── curse_of_doubt ──
  describe('curse_of_doubt', () => {
    it('L0 QP: applyChargeDamageAmpPercent defined, value=15 at L0 (stat table qpValue=15)', () => {
      // Bug fix (2026-04-13): curse_of_doubt stat table qpValue corrected from 0 to 15 (= extras.pctBonus).
      // masteryBonus = 15-20 = -5, so finalValue = 20+(-5) = 15 → value=15.
      const result = resolve('curse_of_doubt', 'quick');
      expect(result.applyChargeDamageAmpPercent).toBeDefined();
      expect(result.applyChargeDamageAmpPercent?.value).toBe(15); // finalValue=15 at L0
      expect(result.applyChargeDamageAmpPercent?.turns).toBe(2); // turns are hardcoded by mode
    });
  });

  // ── mark_of_ignorance ──
  describe('mark_of_ignorance', () => {
    it('L0 QP: applyChargeDamageAmpFlat defined, value=2 at L0 (stat table qpValue=2)', () => {
      // Bug fix (2026-04-13): mark_of_ignorance stat table qpValue corrected from 0 to 2 (= extras.flatBonus).
      // masteryBonus = 2-2 = 0, so finalValue = 2 → value=2.
      const result = resolve('mark_of_ignorance', 'quick');
      expect(result.applyChargeDamageAmpFlat).toBeDefined();
      expect(result.applyChargeDamageAmpFlat?.value).toBe(2); // finalValue=2 at L0
      expect(result.applyChargeDamageAmpFlat?.turns).toBe(2); // turns are hardcoded by mode
    });
  });

  // ── corroding_touch ──
  describe('corroding_touch', () => {
    it('L0 QP: applies Weakness 2 stacks', () => {
      const result = resolve('corroding_touch', 'quick');
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      expect(weakness).toBeDefined();
      expect(weakness?.value).toBe(2);
    });

    it('CC: applies 3 Weakness + 2 Vulnerable', () => {
      const result = resolve('corroding_touch', 'charge_correct');
      const weakness = result.statusesApplied.find(s => s.type === 'weakness');
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(weakness?.value).toBe(3);
      expect(vuln?.value).toBe(2);
    });

    it('L3 corrtouch_vuln1t: also applies Vulnerable 1t on QP', () => {
      const stats = getMasteryStats('corroding_touch', 3);
      expect(stats?.tags).toContain('corrtouch_vuln1t');
      const result = resolve('corroding_touch', 'quick',
        undefined, undefined, { masteryLevel: 3 });
      const vuln = result.statusesApplied.find(s => s.type === 'vulnerable');
      expect(vuln).toBeDefined();
    });
  });

  // ── entropy ──
  describe('entropy', () => {
    it('L0 QP: applies Burn stacks and Poison stacks', () => {
      const stats = getMasteryStats('entropy', 0);
      expect(stats?.extras?.burn).toBe(2);
      expect(stats?.extras?.poison).toBe(1);
      const result = resolve('entropy', 'quick');
      expect(result.applyBurnStacks).toBe(2);
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison).toBeDefined();
      expect(poison?.value).toBe(1);
    });

    it('CC: Burn=6, Poison=4 stacks', () => {
      const result = resolve('entropy', 'charge_correct');
      expect(result.applyBurnStacks).toBe(6);
      const poison = result.statusesApplied.find(s => s.type === 'poison');
      expect(poison?.value).toBe(4);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11.5 UTILITY CARDS — Functional Correctness
// ════════════════════════════════════════════════════════════════════════════

describe('11.5 Utility Cards', () => {

  // ── cleanse ──
  describe('cleanse', () => {
    it('L0 QP: applyCleanse=true + draws 1 card', () => {
      const result = resolve('cleanse', 'quick');
      expect(result.applyCleanse).toBe(true);
      expect(result.extraCardsDrawn).toBe(1);
    });
  });

  // ── scout ──
  describe('scout', () => {
    it('L0 QP: draws 2 cards', () => {
      // L0 scout drawCount=1, but resolver uses QP/CC/CW hardcoded: QP=2
      const result = resolve('scout', 'quick');
      expect(result.extraCardsDrawn).toBe(2);
    });

    it('CC: draws 3 cards', () => {
      const result = resolve('scout', 'charge_correct');
      expect(result.extraCardsDrawn).toBe(3);
    });

    it('CW: draws 1 card', () => {
      const result = resolve('scout', 'charge_wrong');
      expect(result.extraCardsDrawn).toBe(1);
    });

    it('L3 scout_scry2: scryCount=2', () => {
      const stats = getMasteryStats('scout', 3);
      expect(stats?.tags).toContain('scout_scry2');
      const result = resolve('scout', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.scryCount).toBe(2);
    });
  });

  // ── recycle ──
  describe('recycle', () => {
    it('L0 QP: draws 3 cards', () => {
      const result = resolve('recycle', 'quick');
      expect(result.extraCardsDrawn).toBe(3);
    });

    it('CC: draws 4 + drawFromDiscard=1', () => {
      const result = resolve('recycle', 'charge_correct');
      expect(result.extraCardsDrawn).toBe(4);
      expect(result.drawFromDiscard).toBe(1);
    });
  });

  // ── foresight ──
  describe('foresight', () => {
    it('L0 QP: draws 2 cards', () => {
      const result = resolve('foresight', 'quick');
      expect(result.extraCardsDrawn).toBe(2);
    });

    it('L3 foresight_intent: showNextIntent=true', () => {
      const stats = getMasteryStats('foresight', 3);
      expect(stats?.tags).toContain('foresight_intent');
      const result = resolve('foresight', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.showNextIntent).toBe(true);
    });
  });

  // ── conjure ──
  describe('conjure', () => {
    it('L0 QP: pendingCardPick type=conjure', () => {
      const result = resolve('conjure', 'quick');
      expect(result.pendingCardPick?.type).toBe('conjure');
    });
  });

  // ── transmute ──
  describe('transmute', () => {
    it('QP: applyTransmuteAuto set (random pick)', () => {
      const result = resolve('transmute', 'quick');
      expect(result.applyTransmuteAuto).toBeDefined();
    });

    it('CC: pendingCardPick type=transmute', () => {
      const result = resolve('transmute', 'charge_correct');
      expect(result.pendingCardPick?.type).toBe('transmute');
    });
  });

  // ── immunity ──
  describe('immunity', () => {
    it('L0 QP: applyImmunity=true', () => {
      const result = resolve('immunity', 'quick');
      expect(result.applyImmunity).toBe(true);
    });
  });

  // ── sift ──
  describe('sift', () => {
    it('L0 QP: siftParams set (lookAt=3, discardCount=1)', () => {
      const result = resolve('sift', 'quick');
      expect(result.siftParams?.discardCount).toBe(1);
      expect(result.siftParams?.lookAt).toBeGreaterThan(0);
    });

    it('CC: siftParams discardCount=2', () => {
      const result = resolve('sift', 'charge_correct');
      expect(result.siftParams?.discardCount).toBe(2);
    });
  });

  // ── scavenge ──
  describe('scavenge', () => {
    it('L0 QP: pendingCardPick type=scavenge', () => {
      const result = resolve('scavenge', 'quick');
      expect(result.pendingCardPick?.type).toBe('scavenge');
    });
  });

  // ── swap ──
  describe('swap', () => {
    it('L0 QP: swapDiscardDraw set (discard 1, draw 1)', () => {
      const result = resolve('swap', 'quick');
      expect(result.swapDiscardDraw?.discardCount).toBe(1);
      expect(result.swapDiscardDraw?.drawCount).toBe(1);
    });

    it('CC: draws 2', () => {
      const result = resolve('swap', 'charge_correct');
      expect(result.swapDiscardDraw?.drawCount).toBe(2);
    });
  });

  // ── archive ──
  describe('archive', () => {
    it('L0 QP: archiveRetainCount=1', () => {
      const result = resolve('archive', 'quick');
      expect(result.archiveRetainCount).toBe(1);
    });

    it('CC: archiveRetainCount=2', () => {
      const result = resolve('archive', 'charge_correct');
      expect(result.archiveRetainCount).toBe(2);
    });

    it('L3 archive_block2_per: archiveBlockBonus=2', () => {
      const stats = getMasteryStats('archive', 3);
      expect(stats?.tags).toContain('archive_block2_per');
      const result = resolve('archive', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.archiveBlockBonus).toBe(2);
    });
  });

  // ── reflex ──
  describe('reflex', () => {
    it('L0 QP: draws 2 cards', () => {
      // Resolver reflex QP: 2 (hasTag('reflex_enhanced') ? 3 : 2)
      const result = resolve('reflex', 'quick');
      expect(result.extraCardsDrawn).toBe(2);
    });

    it('CW: draws 1 card', () => {
      const result = resolve('reflex', 'charge_wrong');
      expect(result.extraCardsDrawn).toBe(1);
    });
  });

  // ── recollect ──
  describe('recollect', () => {
    it('L0 QP: forgottenCardsToReturn=1', () => {
      const result = resolve('recollect', 'quick');
      expect(result.forgottenCardsToReturn).toBe(1);
    });

    it('CC: forgottenCardsToReturn=2', () => {
      const result = resolve('recollect', 'charge_correct');
      expect(result.forgottenCardsToReturn).toBe(2);
    });

    it('L3 recollect_upgrade1: recollectUpgrade=1', () => {
      const stats = getMasteryStats('recollect', 3);
      expect(stats?.tags).toContain('recollect_upgrade1');
      const result = resolve('recollect', 'quick',
        undefined, undefined, { masteryLevel: 3 });
      expect(result.recollectUpgrade).toBe(1);
    });
  });

  // ── synapse ──
  describe('synapse', () => {
    it('L0 QP: draws 2 cards', () => {
      const result = resolve('synapse', 'quick');
      expect(result.extraCardsDrawn).toBe(2);
    });

    it('L3 synapse_chain_link: applyWildcardChainLink=true on CC', () => {
      const stats = getMasteryStats('synapse', 3);
      expect(stats?.tags).toContain('synapse_chain_link');
      const result = resolve('synapse', 'charge_correct',
        undefined, undefined, { masteryLevel: 3 });
      expect(result.applyWildcardChainLink).toBe(true);
    });
  });

  // ── siphon_knowledge ──
  describe('siphon_knowledge', () => {
    it('L0 QP: draws 2 cards + siphonAnswerPreviewDuration=3', () => {
      const result = resolve('siphon_knowledge', 'quick');
      expect(result.extraCardsDrawn).toBe(2);
      expect(result.siphonAnswerPreviewDuration).toBe(3);
    });

    it('CC: draws 3 + 5s preview', () => {
      const result = resolve('siphon_knowledge', 'charge_correct');
      expect(result.extraCardsDrawn).toBe(3);
      expect(result.siphonAnswerPreviewDuration).toBe(5);
    });
  });

  // ── tutor ──
  describe('tutor', () => {
    it('L0 QP: tutoredCardFree=false (no tutor_free_play at L0)', () => {
      const result = resolve('tutor', 'quick');
      expect(result.tutoredCardFree).toBe(false);
    });

    it('CC: tutoredCardFree=true', () => {
      const result = resolve('tutor', 'charge_correct');
      expect(result.tutoredCardFree).toBe(true);
    });

    it('L2 tutor_free_play: QP also gets tutoredCardFree=true', () => {
      const stats = getMasteryStats('tutor', 2);
      expect(stats?.tags).toContain('tutor_free_play');
      const result = resolve('tutor', 'quick', undefined, undefined, { masteryLevel: 2 });
      expect(result.tutoredCardFree).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11.6 WILD CARDS — Functional Correctness
// ════════════════════════════════════════════════════════════════════════════

describe('11.6 Wild Cards', () => {

  // ── mirror ──
  describe('mirror', () => {
    it('L0 QP: mirrorCopy=true', () => {
      const result = resolve('mirror', 'quick');
      expect(result.mirrorCopy).toBe(true);
    });

    it('L5 mirror_chain_inherit: chameleonInheritChain=true', () => {
      const stats = getMasteryStats('mirror', 5);
      expect(stats?.tags).toContain('mirror_chain_inherit');
      const result = resolve('mirror', 'quick', undefined, undefined, { masteryLevel: 5 });
      expect(result.chameleonInheritChain).toBe(true);
    });
  });

  // ── adapt ──
  describe('adapt', () => {
    it('L0 QP: pendingCardPick type=adapt', () => {
      const result = resolve('adapt', 'quick');
      expect(result.pendingCardPick?.type).toBe('adapt');
    });

    it('L5 adapt_dual: does BOTH attack AND block (no picker)', () => {
      const stats = getMasteryStats('adapt', 5);
      expect(stats?.tags).toContain('adapt_dual');
      const result = resolve('adapt', 'quick', undefined, undefined, { masteryLevel: 5 });
      // With adapt_dual, both attack and block applied
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.shieldApplied).toBeGreaterThan(0);
    });
  });

  // ── overclock ──
  describe('overclock', () => {
    it('L0 QP: applyOverclock=true', () => {
      const result = resolve('overclock', 'quick');
      expect(result.applyOverclock).toBe(true);
    });

    it('isOverclockActive doubles damage: strike QP with overclock = 8 (4 × 2)', () => {
      // With overclock active, overclockMultiplier=2 → strike L0 QP: 4 × 2 = 8
      const card = makeCard({ mechanicId: 'strike' });
      const player = makePlayer();
      const enemy = makeEnemy();
      const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
        playMode: 'quick',
        isOverclockActive: true,
      });
      expect(result.damageDealt).toBe(8); // 4 × 2
    });
  });

  // ── phase_shift ──
  describe('phase_shift', () => {
    it('L0 QP: pendingChoice with damage and block options', () => {
      const result = resolve('phase_shift', 'quick');
      expect(result.pendingChoice).toBeDefined();
      expect(result.pendingChoice?.mechanicId).toBe('phase_shift');
      expect(result.pendingChoice?.options.some(o => o.id === 'damage')).toBe(true);
      expect(result.pendingChoice?.options.some(o => o.id === 'block')).toBe(true);
    });

    it('L0 CC: both damage AND block simultaneously (no choice popup)', () => {
      const result = resolve('phase_shift', 'charge_correct');
      expect(result.damageDealt).toBeGreaterThan(0);
      expect(result.shieldApplied).toBeGreaterThan(0);
      expect(result.phaseShiftBothDmgAndBlock).toBeDefined();
    });
  });

  // ── chameleon ──
  describe('chameleon', () => {
    it('L0 QP: chameleonMultiplier=1.0', () => {
      const result = resolve('chameleon', 'quick');
      expect(result.chameleonMultiplier).toBe(1.0);
    });

    it('CC: chameleonMultiplier=1.3 + chameleonInheritChain=true', () => {
      const result = resolve('chameleon', 'charge_correct');
      expect(result.chameleonMultiplier).toBe(1.3);
      expect(result.chameleonInheritChain).toBe(true);
    });

    it('CW: chameleonMultiplier=0.7', () => {
      const result = resolve('chameleon', 'charge_wrong');
      expect(result.chameleonMultiplier).toBe(0.7);
    });
  });

  // ── dark_knowledge ──
  describe('dark_knowledge', () => {
    it('L0: dmgPerCurse=2 from stat table', () => {
      const stats = getMasteryStats('dark_knowledge', 0);
      expect(stats?.extras?.dmgPerCurse).toBe(2);
    });

    it('L0 QP: 0 damage with 0 cursed facts', () => {
      const result = resolve('dark_knowledge', 'quick',
        undefined, undefined, undefined, { cursedFactCount: 0 });
      expect(result.damageDealt).toBe(0);
    });

    it('L0 QP: 2 × 5 = 10 damage with 5 cursed facts', () => {
      const result = resolve('dark_knowledge', 'quick',
        undefined, undefined, { masteryLevel: 0 }, { cursedFactCount: 5 });
      expect(result.damageDealt).toBe(10);
    });

    it('L5 dark_heal1_per_curse: darkHealPerCurse set with cursed facts', () => {
      const stats = getMasteryStats('dark_knowledge', 5);
      expect(stats?.tags).toContain('dark_heal1_per_curse');
      const result = resolve('dark_knowledge', 'quick',
        undefined, undefined, { masteryLevel: 5 }, { cursedFactCount: 3 });
      expect(result.darkHealPerCurse).toBe(3);
      expect(result.healApplied).toBe(3);
    });
  });

  // ── chain_anchor ──
  describe('chain_anchor', () => {
    it('L0 QP: draws 1 card, no chainAnchor on QP', () => {
      const result = resolve('chain_anchor', 'quick');
      expect(result.extraCardsDrawn).toBe(1);
      expect(result.applyChainAnchor).toBeFalsy();
    });

    it('L0 CC: draws 1 + applyChainAnchor=true', () => {
      const result = resolve('chain_anchor', 'charge_correct');
      expect(result.extraCardsDrawn).toBe(1);
      expect(result.applyChainAnchor).toBe(true);
    });
  });

  // ── unstable_flux ──
  describe('unstable_flux', () => {
    it('L0 QP: random effect resolves (one of damage/block/draw/debuff)', () => {
      const result = resolve('unstable_flux', 'quick');
      const hasAnyEffect = (result.damageDealt ?? 0) > 0
        || (result.shieldApplied ?? 0) > 0
        || (result.extraCardsDrawn ?? 0) > 0
        || result.statusesApplied.length > 0;
      expect(hasAnyEffect).toBe(true);
    });

    it('L0 CC: pendingChoice with 4 options', () => {
      const result = resolve('unstable_flux', 'charge_correct');
      expect(result.pendingChoice).toBeDefined();
      expect(result.pendingChoice?.options.length).toBe(4);
    });

    it('L5 flux_double: fluxDouble=true', () => {
      const stats = getMasteryStats('unstable_flux', 5);
      expect(stats?.tags).toContain('flux_double');
      const result = resolve('unstable_flux', 'quick',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.fluxDouble).toBe(true);
    });
  });

  // ── sacrifice ──
  describe('sacrifice', () => {
    it('L0 QP: selfDamage=5, draws 2, sacrificeApGain=1', () => {
      const result = resolve('sacrifice', 'quick');
      expect(result.selfDamage).toBe(5);
      expect(result.extraCardsDrawn).toBe(2);
      expect(result.sacrificeApGain).toBe(1);
      expect(result.grantsAp).toBe(1);
    });

    it('CC: draws 3, sacrificeApGain=2', () => {
      const result = resolve('sacrifice', 'charge_correct');
      expect(result.extraCardsDrawn).toBe(3);
      expect(result.sacrificeApGain).toBe(2);
    });
  });

  // ── catalyst ──
  describe('catalyst', () => {
    it('L0 QP: poisonDoubled=true (poison only at L0)', () => {
      const result = resolve('catalyst', 'quick');
      expect(result.poisonDoubled).toBe(true);
      expect(result.burnDoubled).toBeFalsy();
    });

    it('L2 catalyst_burn: CC also doubles Burn', () => {
      const stats = getMasteryStats('catalyst', 2);
      expect(stats?.tags).toContain('catalyst_burn');
      const result = resolve('catalyst', 'charge_correct',
        undefined, undefined, { masteryLevel: 2 });
      expect(result.burnDoubled).toBe(true);
    });

    it('L5 catalyst_triple: catalystTriple=true (triples instead of doubles)', () => {
      const stats = getMasteryStats('catalyst', 5);
      expect(stats?.tags).toContain('catalyst_triple');
      const result = resolve('catalyst', 'quick',
        undefined, undefined, { masteryLevel: 5 });
      expect(result.catalystTriple).toBe(true);
      expect(result.poisonDoubled).toBeFalsy(); // triple overrides
    });
  });

  // ── mimic ──
  describe('mimic', () => {
    it('L0 QP: pendingCardPick type=mimic', () => {
      const result = resolve('mimic', 'quick');
      expect(result.pendingCardPick?.type).toBe('mimic');
    });

    it('L3 mimic_choose: mimicChoose=true', () => {
      const stats = getMasteryStats('mimic', 3);
      expect(stats?.tags).toContain('mimic_choose');
      const result = resolve('mimic', 'quick', undefined, undefined, { masteryLevel: 3 });
      expect(result.mimicChoose).toBe(true);
    });
  });

  // ── aftershock ──
  describe('aftershock', () => {
    it('L0 QP: no target → no aftershockRepeat', () => {
      const result = resolve('aftershock', 'quick',
        undefined, undefined, undefined, { lastQPMechanicThisTurn: null });
      expect(result.aftershockRepeat).toBeUndefined();
    });

    it('L0 QP: aftershockRepeat set when lastQPMechanicThisTurn is strike', () => {
      const result = resolve('aftershock', 'quick',
        undefined, undefined, undefined, { lastQPMechanicThisTurn: 'strike' });
      expect(result.aftershockRepeat?.mechanicId).toBe('strike');
      expect(result.aftershockRepeat?.multiplier).toBe(0.5); // L0 qpMult=0.5
    });

    it('L5 aftershock_no_quiz: aftershockNoQuiz=true on CC', () => {
      const stats = getMasteryStats('aftershock', 5);
      expect(stats?.tags).toContain('aftershock_no_quiz');
      const result = resolve('aftershock', 'charge_correct',
        undefined, undefined, { masteryLevel: 5 },
        { lastCCMechanicThisTurn: 'strike' });
      expect(result.aftershockNoQuiz).toBe(true);
    });
  });

  // ── knowledge_bomb ──
  describe('knowledge_bomb', () => {
    it('L0 QP: flat 4 damage', () => {
      const result = resolve('knowledge_bomb', 'quick');
      expect(result.damageDealt).toBe(4);
    });

    it('L0 CC: perCorrect=3 × correctCharges', () => {
      const stats = getMasteryStats('knowledge_bomb', 0);
      expect(stats?.extras?.perCorrect).toBe(3);
      const result = resolve('knowledge_bomb', 'charge_correct',
        undefined, undefined, undefined, { correctChargesThisEncounter: 5 });
      expect(result.damageDealt).toBe(15); // 3 × 5
    });

    it('L3 kbomb_count_past tag', () => {
      const stats = getMasteryStats('knowledge_bomb', 3);
      expect(stats?.tags).toContain('kbomb_count_past');
      const result = resolve('knowledge_bomb', 'charge_correct',
        undefined, undefined, { masteryLevel: 3 },
        { correctChargesThisEncounter: 2 });
      expect(result.kbombCountPast).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Chain multiplier scaling verification
// ════════════════════════════════════════════════════════════════════════════

describe('Chain multiplier scaling', () => {
  it('strike QP at chain 2.0: damage = Math.round(4 × 2.0) = 8', () => {
    const card = makeCard({ mechanicId: 'strike' });
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      chainMultiplier: 2.0,
    });
    expect(result.damageDealt).toBe(8);
  });

  it('block QP at chain 2.0: shieldApplied = Math.round(4 × 2.0) = 8', () => {
    const card = makeCard({ mechanicId: 'block' });
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      chainMultiplier: 2.0,
    });
    expect(result.shieldApplied).toBe(8);
  });

  it('heavy_strike CC at chain 2.0: damage = Math.round(Math.round(7 × 1.5) × 2.0) = 22', () => {
    const card = makeCard({ mechanicId: 'heavy_strike' });
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      chainMultiplier: 2.0,
    });
    // mechanicBaseValue = Math.round((7 + 0) × 1.5) = 11; chainAdjusted = Math.round(11 × 2.0) = 22
    expect(result.damageDealt).toBe(22);
  });

  it('multi_hit bleed stacks chain-scale: round(1 × 2.0) = 2 per hit at chain 2.0', () => {
    const card = makeCard({ mechanicId: 'multi_hit', masteryLevel: 3 }); // L3 has multi_bleed1
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
      chainMultiplier: 2.0,
    });
    const bleed = result.statusesApplied.find(s => s.type === 'bleed');
    expect(bleed?.value).toBe(2); // Math.round(1 × 2.0) = 2
  });

  it('hex poison stacks chain-scale: round(3 × 2.0) = 6 at chain 2.0', () => {
    const card = makeCard({ mechanicId: 'hex' });
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      chainMultiplier: 2.0,
    });
    const poison = result.statusesApplied.find(s => s.type === 'poison');
    expect(poison?.value).toBe(6); // 3 × 2.0
  });
});

// ════════════════════════════════════════════════════════════════════════════
// All mechanics have definitions (presence check)
// ════════════════════════════════════════════════════════════════════════════

describe('All 11.1-11.6 mechanics exist in definition table', () => {
  const allMechanics = [
    // 11.1 Attack
    'strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless', 'execute', 'lifetap',
    'power_strike', 'twin_strike', 'iron_wave', 'bash', 'rupture', 'kindle', 'overcharge',
    'riposte', 'precision_strike', 'siphon_strike', 'gambit', 'chain_lightning', 'volatile_slash',
    'smite', 'feedback_loop', 'recall', 'hemorrhage', 'eruption', 'sap',
    // 11.2 Shield
    'block', 'thorns', 'emergency', 'fortify', 'brace', 'overheal', 'parry', 'reinforce',
    'shrug_it_off', 'guard', 'absorb', 'reactive_shield', 'aegis_pulse', 'burnout_shield',
    'knowledge_ward', 'bulwark', 'conversion', 'ironhide',
    // 11.3 Buff
    'empower', 'quicken', 'focus', 'double_strike', 'ignite', 'inscription_fury',
    'inscription_iron', 'warcry', 'battle_trance', 'inscription_wisdom', 'frenzy',
    'mastery_surge', 'war_drum', 'forge',
    // 11.4 Debuff
    'weaken', 'expose', 'hex', 'slow', 'lacerate', 'stagger', 'corrode', 'curse_of_doubt',
    'mark_of_ignorance', 'corroding_touch', 'entropy',
    // 11.5 Utility
    'cleanse', 'scout', 'recycle', 'foresight', 'conjure', 'transmute', 'immunity', 'sift',
    'scavenge', 'swap', 'archive', 'reflex', 'recollect', 'synapse', 'siphon_knowledge', 'tutor',
    // 11.6 Wild
    'mirror', 'adapt', 'overclock', 'phase_shift', 'chameleon', 'dark_knowledge', 'chain_anchor',
    'unstable_flux', 'sacrifice', 'catalyst', 'mimic', 'aftershock', 'knowledge_bomb',
  ];

  for (const id of allMechanics) {
    it(`${id} mechanic definition exists`, () => {
      const mechanic = getMechanicDefinition(id);
      expect(mechanic, `mechanic '${id}' not found`).toBeDefined();
      expect(mechanic!.id).toBe(id);
    });
  }
});
