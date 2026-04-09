/**
 * Unit tests for Phase 2/3 mechanic overhaul — L5 archetype card tags.
 *
 * Tests all 13 new L5 tags wired in the card mechanics overhaul:
 *   strike_tempo3           — +4 damage when 3+ cards played this turn
 *   power_vuln2t            — Vulnerable lasts 2 turns (tag declared; resolver gate issue, see NOTE)
 *   iron_wave_block_double  — Double damage component when player has 10+ block
 *   riposte_block_dmg40     — 40% of current block as bonus damage
 *   twin_burn_chain         — Burn hits don't halve stacks (twinBurnChainActive signal flag)
 *   reckless_selfdmg_scale3 — +3 damage per cumulative self-damage taken this encounter
 *   block_consecutive3      — +3 block when player played shield last turn
 *   reinforce_perm1         — Stacking permanent block bonus (encounter-scoped)
 *   absorb_ap_on_block      — +1 AP gain on Charge Correct
 *   empower_weak2           — Declared in L5 data; TurnState-level effect (not resolver-level)
 *   weaken_shield30         — Passive: +30% block when enemy Weakened (startEncounter scan)
 *   expose_vuln75           — Passive: Vuln multiplier 1.75x (vulnMultiplierOverride)
 *
 * NOTE on power_vuln2t: The resolver gates vulnerable application on 'power_vuln1' tag, which is
 * not defined in any MASTERY_STAT_TABLES level. This is a known issue (see gotchas.md).
 * Tests verify the tag is correctly declared in data and document the resolver gate behavior.
 *
 * All tests use resolveCardEffect() directly with controlled advanced options.
 */

import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import { getMechanicDefinition } from '../../src/data/mechanics';
import { getMasteryStats } from '../../src/services/cardUpgradeService';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(mechanicId: string, masteryLevel = 5, overrides: Partial<Card> = {}): Card {
  const mechanic = getMechanicDefinition(mechanicId);
  return {
    id: 'test-card',
    factId: 'test-fact',
    cardType: (mechanic?.type ?? 'attack') as CardType,
    domain: 'general_knowledge',
    tier: '1',
    baseEffectValue: mechanic?.baseValue ?? 8,
    effectMultiplier: 1.0,
    apCost: mechanic?.apCost ?? 1,
    mechanicId,
    mechanicName: mechanic?.name,
    secondaryValue: mechanic?.secondaryValue,
    masteryLevel,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerCombatState> = {}): PlayerCombatState {
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

function makeEnemy(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
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
 * Resolve a card at a given mastery level with optional advanced options.
 * Defaults to Quick Play. Override playMode in advanced to test CC/CW.
 */
function resolve(
  mechanicId: string,
  masteryLevel = 5,
  advanced: Record<string, unknown> = {},
  playerOverrides: Partial<PlayerCombatState> = {},
  enemyOverrides: Partial<EnemyInstance> = {},
) {
  const card = makeCard(mechanicId, masteryLevel);
  const player = makePlayer(playerOverrides);
  const enemy = makeEnemy(enemyOverrides);
  return resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
    playMode: 'quick',
    ...advanced,
  });
}

// ── strike_tempo3 ─────────────────────────────────────────────────────────────

describe('strike_tempo3 tag (L5 strike)', () => {
  it('L5 strike has strike_tempo3 tag in MASTERY_STAT_TABLES', () => {
    const stats = getMasteryStats('strike', 5);
    expect(stats?.tags).toContain('strike_tempo3');
  });

  it('adds +4 damage when cardsPlayedThisTurn >= 3', () => {
    const withThree = resolve('strike', 5, { cardsPlayedThisTurn: 3 });
    const withTwo = resolve('strike', 5, { cardsPlayedThisTurn: 2 });
    expect((withThree.damageDealt ?? 0) - (withTwo.damageDealt ?? 0)).toBe(4);
  });

  it('does NOT add +4 when cardsPlayedThisTurn is 2', () => {
    const at2 = resolve('strike', 5, { cardsPlayedThisTurn: 2 });
    const at0 = resolve('strike', 5, { cardsPlayedThisTurn: 0 });
    expect(at2.damageDealt).toBe(at0.damageDealt);
  });

  it('bonus applies at exactly 3 cards played (threshold boundary)', () => {
    const at3 = resolve('strike', 5, { cardsPlayedThisTurn: 3 });
    const at2 = resolve('strike', 5, { cardsPlayedThisTurn: 2 });
    expect((at3.damageDealt ?? 0) - (at2.damageDealt ?? 0)).toBe(4);
  });

  it('bonus applies at 5+ cards played (above threshold)', () => {
    const at5 = resolve('strike', 5, { cardsPlayedThisTurn: 5 });
    const at2 = resolve('strike', 5, { cardsPlayedThisTurn: 2 });
    expect((at5.damageDealt ?? 0) - (at2.damageDealt ?? 0)).toBe(4);
  });

  it('L4 strike does NOT have strike_tempo3 tag', () => {
    const stats = getMasteryStats('strike', 4);
    expect(stats?.tags ?? []).not.toContain('strike_tempo3');
  });

  it('L4 does not gain +4 bonus even with 3 cards played', () => {
    const l4at3 = resolve('strike', 4, { cardsPlayedThisTurn: 3 });
    const l4at0 = resolve('strike', 4, { cardsPlayedThisTurn: 0 });
    expect(l4at3.damageDealt).toBe(l4at0.damageDealt);
  });
});

// ── power_vuln2t ─────────────────────────────────────────────────────────────
//
// NOTE: The resolver gates Vulnerable application on `power_vuln1` tag, which is not
// defined in any MASTERY_STAT_TABLES level. The tag power_vuln2t IS correctly defined
// in L5 data but is nested inside the power_vuln1 check. Tests verify data correctness
// and document the current resolver behavior (Vuln never fires without power_vuln1).
// This is a bug to fix in game-logic agent; see gotchas.md.

describe('power_vuln2t tag (L5 power_strike) — data verification', () => {
  it('L5 power_strike has power_vuln2t tag in MASTERY_STAT_TABLES', () => {
    const stats = getMasteryStats('power_strike', 5);
    expect(stats?.tags).toContain('power_vuln2t');
  });

  it('L5 power_strike also has power_vuln75 tag', () => {
    const stats = getMasteryStats('power_strike', 5);
    expect(stats?.tags).toContain('power_vuln75');
  });

  it('L4 power_strike does NOT have power_vuln2t tag', () => {
    const stats = getMasteryStats('power_strike', 4);
    expect(stats?.tags ?? []).not.toContain('power_vuln2t');
  });

  // BUG DOCUMENTATION: power_vuln1 is never defined in any MASTERY_STAT_TABLES level,
  // so the resolver's `if (hasTag('power_vuln1'))` gate means Vulnerable is NEVER applied.
  // This test documents current broken behavior and will fail once the resolver is fixed.
  it('L5 power_strike applies Vulnerable via power_vuln2t tag (bug fixed 2026-04-09)', () => {
    const card = makeCard('power_strike', 5);
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    const vulnStatus = result.statusesApplied.find(s => s.type === 'vulnerable');
    expect(vulnStatus).toBeDefined();
    expect(vulnStatus!.turnsRemaining).toBe(2); // power_vuln2t = 2 turns
  });
});

// ── iron_wave_block_double ────────────────────────────────────────────────────

describe('iron_wave_block_double tag (L5 iron_wave)', () => {
  it('L5 iron_wave has iron_wave_block_double tag', () => {
    const stats = getMasteryStats('iron_wave', 5);
    expect(stats?.tags).toContain('iron_wave_block_double');
  });

  it('damage is higher when player has 10 block vs 0 block', () => {
    const withBlock = resolve('iron_wave', 5, {}, { shield: 10 });
    const withoutBlock = resolve('iron_wave', 5, {}, { shield: 0 });
    expect((withBlock.damageDealt ?? 0)).toBeGreaterThan(withoutBlock.damageDealt ?? 0);
  });

  it('damage is doubled at exactly 10 block vs 9 block', () => {
    const at10 = resolve('iron_wave', 5, {}, { shield: 10 });
    const at9 = resolve('iron_wave', 5, {}, { shield: 9 });
    // At 9: no double. At 10: doubled. The L5 qpValue=5, so doubled = 10 vs not doubled = 5.
    const l5Stats = getMasteryStats('iron_wave', 5);
    const baseQP = l5Stats?.qpValue ?? 5;
    // Without block doubling (< 10): damage = baseQP
    // With block doubling (>= 10): damage = baseQP * 2
    expect(at9.damageDealt).toBe(baseQP);
    expect(at10.damageDealt).toBe(baseQP * 2);
  });

  it('does NOT double at 9 block (below threshold)', () => {
    const at9 = resolve('iron_wave', 5, {}, { shield: 9 });
    const at0 = resolve('iron_wave', 5, {}, { shield: 0 });
    expect(at9.damageDealt).toBe(at0.damageDealt);
  });

  it('L4 does NOT have iron_wave_block_double tag', () => {
    const stats = getMasteryStats('iron_wave', 4);
    expect(stats?.tags ?? []).not.toContain('iron_wave_block_double');
  });

  it('L4 does not double damage at 10+ block', () => {
    const l4at10 = resolve('iron_wave', 4, {}, { shield: 10 });
    const l4at0 = resolve('iron_wave', 4, {}, { shield: 0 });
    expect(l4at10.damageDealt).toBe(l4at0.damageDealt);
  });
});

// ── riposte_block_dmg40 ───────────────────────────────────────────────────────

describe('riposte_block_dmg40 tag (L5 riposte)', () => {
  it('L5 riposte has riposte_block_dmg40 tag', () => {
    const stats = getMasteryStats('riposte', 5);
    expect(stats?.tags).toContain('riposte_block_dmg40');
  });

  it('adds Math.floor(10 * 0.4) = 4 bonus damage with 10 block', () => {
    const withBlock = resolve('riposte', 5, {}, { shield: 10 });
    const withoutBlock = resolve('riposte', 5, {}, { shield: 0 });
    expect((withBlock.damageDealt ?? 0) - (withoutBlock.damageDealt ?? 0)).toBe(4);
  });

  it('adds Math.floor(20 * 0.4) = 8 bonus damage with 20 block', () => {
    const withBlock20 = resolve('riposte', 5, {}, { shield: 20 });
    const withoutBlock = resolve('riposte', 5, {}, { shield: 0 });
    expect((withBlock20.damageDealt ?? 0) - (withoutBlock.damageDealt ?? 0)).toBe(8);
  });

  it('adds 0 bonus damage with 1 block (floor(1 * 0.4) = 0)', () => {
    const with1 = resolve('riposte', 5, {}, { shield: 1 });
    const with0 = resolve('riposte', 5, {}, { shield: 0 });
    expect(with1.damageDealt).toBe(with0.damageDealt);
  });

  it('L4 does NOT have riposte_block_dmg40 tag', () => {
    const stats = getMasteryStats('riposte', 4);
    expect(stats?.tags ?? []).not.toContain('riposte_block_dmg40');
  });

  it('L4 does not get block bonus damage', () => {
    const l4with20 = resolve('riposte', 4, {}, { shield: 20 });
    const l4with0 = resolve('riposte', 4, {}, { shield: 0 });
    expect(l4with20.damageDealt).toBe(l4with0.damageDealt);
  });
});

// ── twin_burn_chain ───────────────────────────────────────────────────────────

describe('twin_burn_chain tag (L5 twin_strike)', () => {
  it('L5 twin_strike has twin_burn_chain tag', () => {
    const stats = getMasteryStats('twin_strike', 5);
    expect(stats?.tags).toContain('twin_burn_chain');
  });

  it('sets twinBurnChainActive flag on result at L5', () => {
    const result = resolve('twin_strike', 5);
    expect(result.twinBurnChainActive).toBe(true);
  });

  it('L4 does NOT have twin_burn_chain tag', () => {
    const stats = getMasteryStats('twin_strike', 4);
    expect(stats?.tags ?? []).not.toContain('twin_burn_chain');
  });

  it('L4 does NOT set twinBurnChainActive', () => {
    const result = resolve('twin_strike', 4);
    expect(result.twinBurnChainActive).toBeFalsy();
  });

  it('L5 still applies Burn stacks per hit (twin_burn2 still active)', () => {
    const result = resolve('twin_strike', 5);
    expect(result.applyBurnStacks).toBe(2);
  });
});

// ── reckless_selfdmg_scale3 ───────────────────────────────────────────────────

describe('reckless_selfdmg_scale3 tag (L5 reckless)', () => {
  it('L5 reckless has reckless_selfdmg_scale3 tag', () => {
    const stats = getMasteryStats('reckless', 5);
    expect(stats?.tags).toContain('reckless_selfdmg_scale3');
  });

  it('adds selfDamageTakenThisEncounter * 3 as bonus damage', () => {
    const with4SelfDmg = resolve('reckless', 5, { selfDamageTakenThisEncounter: 4 });
    const with0SelfDmg = resolve('reckless', 5, { selfDamageTakenThisEncounter: 0 });
    expect((with4SelfDmg.damageDealt ?? 0) - (with0SelfDmg.damageDealt ?? 0)).toBe(12);
  });

  it('adds 6 bonus damage with 2 self-damage taken', () => {
    const with2 = resolve('reckless', 5, { selfDamageTakenThisEncounter: 2 });
    const with0 = resolve('reckless', 5, { selfDamageTakenThisEncounter: 0 });
    expect((with2.damageDealt ?? 0) - (with0.damageDealt ?? 0)).toBe(6);
  });

  it('adds 0 bonus when no self-damage taken', () => {
    const noSelfDmg = resolve('reckless', 5, { selfDamageTakenThisEncounter: 0 });
    const defaultAdvanced = resolve('reckless', 5, {});
    expect(noSelfDmg.damageDealt).toBe(defaultAdvanced.damageDealt);
  });

  it('L4 does NOT have reckless_selfdmg_scale3 tag', () => {
    const stats = getMasteryStats('reckless', 4);
    expect(stats?.tags ?? []).not.toContain('reckless_selfdmg_scale3');
  });
});

// ── block_consecutive3 ────────────────────────────────────────────────────────

describe('block_consecutive3 tag (L5 block)', () => {
  it('L5 block has block_consecutive3 tag', () => {
    const stats = getMasteryStats('block', 5);
    expect(stats?.tags).toContain('block_consecutive3');
  });

  it('adds +3 shield when lastTurnPlayedShield is true', () => {
    const withShield = resolve('block', 5, { lastTurnPlayedShield: true });
    const withoutShield = resolve('block', 5, { lastTurnPlayedShield: false });
    expect((withShield.shieldApplied ?? 0) - (withoutShield.shieldApplied ?? 0)).toBe(3);
  });

  it('does NOT add +3 when lastTurnPlayedShield is false', () => {
    const withoutShield = resolve('block', 5, { lastTurnPlayedShield: false });
    const noAdvanced = resolve('block', 5, {});
    expect(withoutShield.shieldApplied).toBe(noAdvanced.shieldApplied);
  });

  it('L4 does NOT have block_consecutive3 tag', () => {
    const stats = getMasteryStats('block', 4);
    expect(stats?.tags ?? []).not.toContain('block_consecutive3');
  });

  it('L4 does not get +3 even when shield was played last turn', () => {
    const l4withShield = resolve('block', 4, { lastTurnPlayedShield: true });
    const l4noShield = resolve('block', 4, { lastTurnPlayedShield: false });
    expect(l4withShield.shieldApplied).toBe(l4noShield.shieldApplied);
  });
});

// ── reinforce_perm1 ───────────────────────────────────────────────────────────

describe('reinforce_perm1 tag (L5 reinforce)', () => {
  it('L5 reinforce has reinforce_perm1 tag', () => {
    const stats = getMasteryStats('reinforce', 5);
    expect(stats?.tags).toContain('reinforce_perm1');
  });

  it('adds reinforcePermanentBonus (3 stacks) to shield value', () => {
    const with3Bonus = resolve('reinforce', 5, { reinforcePermanentBonus: 3 });
    const with0Bonus = resolve('reinforce', 5, { reinforcePermanentBonus: 0 });
    expect((with3Bonus.shieldApplied ?? 0) - (with0Bonus.shieldApplied ?? 0)).toBe(3);
  });

  it('adds reinforcePermanentBonus (5 stacks) to shield value', () => {
    const with5Bonus = resolve('reinforce', 5, { reinforcePermanentBonus: 5 });
    const with0Bonus = resolve('reinforce', 5, { reinforcePermanentBonus: 0 });
    expect((with5Bonus.shieldApplied ?? 0) - (with0Bonus.shieldApplied ?? 0)).toBe(5);
  });

  it('signals reinforcePermanentBonusIncrement=true on result', () => {
    const result = resolve('reinforce', 5);
    expect(result.reinforcePermanentBonusIncrement).toBe(true);
  });

  it('L4 does NOT have reinforce_perm1 tag', () => {
    const stats = getMasteryStats('reinforce', 4);
    expect(stats?.tags ?? []).not.toContain('reinforce_perm1');
  });

  it('L4 does NOT set reinforcePermanentBonusIncrement', () => {
    const result = resolve('reinforce', 4);
    expect(result.reinforcePermanentBonusIncrement).toBeFalsy();
  });

  it('L4 does not apply bonus even with stacks passed', () => {
    const l4with5 = resolve('reinforce', 4, { reinforcePermanentBonus: 5 });
    const l4with0 = resolve('reinforce', 4, { reinforcePermanentBonus: 0 });
    expect(l4with5.shieldApplied).toBe(l4with0.shieldApplied);
  });
});

// ── absorb_ap_on_block ────────────────────────────────────────────────────────

describe('absorb_ap_on_block tag (L5 absorb)', () => {
  it('L5 absorb has absorb_ap_on_block tag', () => {
    const stats = getMasteryStats('absorb', 5);
    expect(stats?.tags).toContain('absorb_ap_on_block');
  });

  it('sets apOnBlockGain=1 on Charge Correct at L5', () => {
    const card = makeCard('absorb', 5);
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.apOnBlockGain).toBe(1);
  });

  it('does NOT grant AP on Quick Play', () => {
    const result = resolve('absorb', 5, { playMode: 'quick' });
    expect(result.apOnBlockGain).toBeFalsy();
  });

  it('does NOT grant AP on Charge Wrong', () => {
    const card = makeCard('absorb', 5);
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_wrong',
    });
    expect(result.apOnBlockGain).toBeFalsy();
  });

  it('L4 does NOT have absorb_ap_on_block tag', () => {
    const stats = getMasteryStats('absorb', 4);
    expect(stats?.tags ?? []).not.toContain('absorb_ap_on_block');
  });

  it('L4 does NOT grant AP on CC', () => {
    const card = makeCard('absorb', 4);
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
      playMode: 'charge_correct',
    });
    expect(result.apOnBlockGain).toBeFalsy();
  });
});

// ── empower_weak2 ─────────────────────────────────────────────────────────────
// empower_weak2 operates at TurnState level (not resolver level).
// When empower is played and has this tag, turnManager sets empowerWeakPending=2.
// On the next buffed attack, turnManager applies 2 Weakness to the enemy.
// Tests here verify: tag is correctly declared in data, L5 empower resolver
// emits empowerTargetCount=2 (from empower_2cards which is colocated with empower_weak2).

describe('empower_weak2 tag (L5 empower) — data and resolver signals', () => {
  it('L5 empower has empower_weak2 tag', () => {
    const stats = getMasteryStats('empower', 5);
    expect(stats?.tags).toContain('empower_weak2');
  });

  it('L5 empower also has empower_2cards tag (colocated)', () => {
    const stats = getMasteryStats('empower', 5);
    expect(stats?.tags).toContain('empower_2cards');
  });

  it('L4 empower does NOT have empower_weak2 tag', () => {
    const stats = getMasteryStats('empower', 4);
    expect(stats?.tags ?? []).not.toContain('empower_weak2');
  });

  it('L5 empower resolver emits empowerTargetCount=2 (from empower_2cards)', () => {
    const result = resolve('empower', 5);
    expect(result.empowerTargetCount).toBe(2);
  });

  it('L4 empower does NOT emit empowerTargetCount=2', () => {
    const result = resolve('empower', 4);
    expect(result.empowerTargetCount).toBeUndefined();
  });
});

// ── weaken_shield30 ───────────────────────────────────────────────────────────
// weaken_shield30 is a PASSIVE activated at encounter start via turnManager scanning
// all deck cards. When any deck card has this tag, turnState.weakShieldBonusPercent=30.
// At card resolve time (turnManager.playCardAction), shield cards get 30% more block
// if the enemy is Weakened. This is NOT tested via resolveCardEffect.
// Tests verify the tag is correctly declared in L5 weaken data.

describe('weaken_shield30 tag (L5 weaken) — data verification', () => {
  it('L5 weaken has weaken_shield30 tag', () => {
    const stats = getMasteryStats('weaken', 5);
    expect(stats?.tags).toContain('weaken_shield30');
  });

  it('L4 weaken does NOT have weaken_shield30 tag', () => {
    const stats = getMasteryStats('weaken', 4);
    expect(stats?.tags ?? []).not.toContain('weaken_shield30');
  });

  it('L5 weaken still applies Weakness stacks to enemy', () => {
    const result = resolve('weaken', 5);
    const weakStatus = result.statusesApplied.find(s => s.type === 'weakness');
    expect(weakStatus).toBeDefined();
    expect((weakStatus?.value ?? 0)).toBeGreaterThan(0);
  });
});

// ── expose_vuln75 ─────────────────────────────────────────────────────────────
// expose_vuln75 is a PASSIVE activated at encounter start. When any deck card has
// this tag, turnState.vulnMultiplierOverride=1.75. This is passed to resolveCardEffect
// via advanced.vulnMultiplierOverride whenever an attack resolves against a Vulnerable enemy.
// The resolver uses this value instead of the default 1.5x Vulnerable multiplier.

describe('expose_vuln75 tag (L5 expose) — data and resolver', () => {
  it('L5 expose has expose_vuln75 tag', () => {
    const stats = getMasteryStats('expose', 5);
    expect(stats?.tags).toContain('expose_vuln75');
  });

  it('L4 expose does NOT have expose_vuln75 tag', () => {
    const stats = getMasteryStats('expose', 4);
    expect(stats?.tags ?? []).not.toContain('expose_vuln75');
  });

  it('vulnMultiplierOverride=1.75 deals more damage vs Vulnerable enemy than 1.5x', () => {
    const vulnerableEnemy = makeEnemy({
      statusEffects: [{ type: 'vulnerable', value: 1, turnsRemaining: 2 }],
    });
    const card = makeCard('strike', 0);
    const player = makePlayer();

    const with175 = resolveCardEffect(card, player, vulnerableEnemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      vulnMultiplierOverride: 1.75,
    });
    const with150 = resolveCardEffect(card, player, vulnerableEnemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      vulnMultiplierOverride: 1.5,
    });
    expect((with175.damageDealt ?? 0)).toBeGreaterThan(with150.damageDealt ?? 0);
  });

  it('default Vulnerable multiplier (no override) equals 1.5x behavior', () => {
    const vulnerableEnemy = makeEnemy({
      statusEffects: [{ type: 'vulnerable', value: 1, turnsRemaining: 2 }],
    });
    const card = makeCard('strike', 0);
    const player = makePlayer();

    const withDefault = resolveCardEffect(card, player, vulnerableEnemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
    });
    const with150 = resolveCardEffect(card, player, vulnerableEnemy, 1.0, 0, undefined, undefined, {
      playMode: 'quick',
      vulnMultiplierOverride: 1.5,
    });
    expect(withDefault.damageDealt).toBe(with150.damageDealt);
  });
});
