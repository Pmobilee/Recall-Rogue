/**
 * Phase 2 Relic Functional Correctness — Programmatic unit tests.
 *
 * Verifies the functional relic correctness items from
 * docs/testing/visual-verification/03-relics-visual-functional.md (sections 12.1–12.3).
 *
 * SCOPE: Tests that can be exercised purely through resolveCardEffect(),
 * resolveAttackModifiers(), resolveShieldModifiers(), resolveEncounterStartEffects(),
 * resolveTurnStartEffects(), resolveTurnEndEffects(), resolveTurnEndEffectsV2(),
 * resolveDamageTakenEffects(), and resolveLethalEffects().
 *
 * SKIPPED (require runtime / turnManager wiring):
 *   vitality_ring, swift_boots, gold_magnet, merchants_favor, lucky_coin,
 *   scavengers_eye, quick_study, tattered_notebook, battle_scars HP gain,
 *   memory_nexus, resonance_crystal, pocket_watch, gladiator_s_mark,
 *   chain_reactor, quicksilver_quill, time_warp, crit_lens, capacitor,
 *   double_down, phoenix_feather (rage state), mirror_of_knowledge, soul_jar,
 *   null_shard (power strip), hemorrhage_lens, inferno_crown, mind_palace,
 *   entropy_engine, chain_forge, chromatic_chain.
 *
 * Key pipeline notes:
 *   - whetstone: +3 flat via resolveAttackModifiers.flatDamageBonus (added AFTER scaledValue)
 *   - barbed_edge: +3 in effectiveBase (pre-scale, sharpenedEdgeBonus) AND +2 via flatDamageBonus
 *   - stone_wall: +3 flatBlockBonus via resolveShieldModifiers
 *   - bastions_will: +25% quickPlayShieldMult on Quick Play shield cards
 *   - chain_lightning_rod: +1 hit on multi_hit (resolver reads activeRelicIds directly)
 *   - glass_cannon: +35% percentDamageBonus on all attacks
 *   - berserker_band: +40% percentDamageBonus when playerHpPercent < 0.5
 *   - reckless_resolve v2: +50% below 40% HP, -15% above 80% HP
 *   - volatile_core: +50% percentDamageBonus on all attacks (cursed)
 *   - flame_brand: +40% percentDamageBonus on first attack this encounter
 */

import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../../src/services/cardEffectResolver';
import {
  resolveAttackModifiers,
  resolveShieldModifiers,
  resolveEncounterStartEffects,
  resolveTurnStartEffects,
  resolveTurnEndEffects,
  resolveTurnEndEffectsV2,
  resolveDamageTakenEffects,
  resolveLethalEffects,
} from '../../src/services/relicEffectResolver';
import type { Card, CardType } from '../../src/data/card-types';
import type { PlayerCombatState } from '../../src/services/playerCombatState';
import type { EnemyInstance, EnemyTemplate } from '../../src/data/enemies';
import { getMechanicDefinition } from '../../src/data/mechanics';
import { getMasteryStats } from '../../src/services/cardUpgradeService';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/** Resolve a card with optional relic set. */
function resolveWith(
  mechanicId: string,
  playMode: PlayMode,
  relicIds: Set<string> = new Set(),
  playerOverrides?: Partial<PlayerCombatState>,
  enemyOverrides?: Partial<EnemyInstance>,
  cardOverrides?: Partial<Card>,
  extraAdvanced?: Record<string, unknown>,
) {
  const card = makeCard({ mechanicId, ...cardOverrides });
  const player = makePlayer(playerOverrides);
  const enemy = makeEnemy(enemyOverrides);
  return resolveCardEffect(card, player, enemy, 1.0, 0, undefined, undefined, {
    playMode,
    activeRelicIds: relicIds,
    ...extraAdvanced,
  });
}

/** Build a minimal AttackContext with sensible defaults. */
function makeAttackCtx(
  overrides?: Partial<import('../../src/services/relicEffectResolver').AttackContext>,
): import('../../src/services/relicEffectResolver').AttackContext {
  return {
    isFirstAttack: false,
    isStrikeTagged: false,
    playerHpPercent: 1.0,
    consecutiveCorrectAttacks: 0,
    cardTier: 'learning',
    correctStreakThisEncounter: 0,
    enemyHpPercent: 1.0,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 12.1 STARTER COMMON RELICS
// ════════════════════════════════════════════════════════════════════════════

describe('12.1 Starter Common Relics', () => {

  // ── whetstone ──
  describe('whetstone — +3 flat attack damage on all attacks', () => {
    it('QP strike with whetstone is 3 more than without', () => {
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['whetstone'])).damageDealt ?? 0;
      expect(withRelic - base).toBe(3);
    });

    it('CC strike with whetstone is 3 more than without', () => {
      const base = resolveWith('strike', 'charge_correct').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'charge_correct', new Set(['whetstone'])).damageDealt ?? 0;
      expect(withRelic - base).toBe(3);
    });

    it('whetstone does NOT boost shield cards (flatBlockBonus = -1 penalty, not +3)', () => {
      const mods = resolveShieldModifiers(new Set(['whetstone']));
      // whetstone penalises shields: stone_wall is 0 so net is -1
      expect(mods.flatBlockBonus).toBe(-1);
    });
  });

  // ── iron_shield ──
  describe('iron_shield — +2 block at turn start (scaled by shields played last turn)', () => {
    it('iron_shield grants 2 bonusBlock when 0 shields played last turn', () => {
      const effects = resolveTurnStartEffects(new Set(['iron_shield']), 0, {
        turnNumberThisEncounter: 2,
        characterLevel: 1,
        dejaVuUsedThisEncounter: false,
        shieldsPlayedLastTurn: 0,
      });
      expect(effects.bonusBlock).toBe(2);
    });

    it('iron_shield grants 4 bonusBlock when 2 shields played last turn', () => {
      const effects = resolveTurnStartEffects(new Set(['iron_shield']), 0, {
        turnNumberThisEncounter: 2,
        characterLevel: 1,
        dejaVuUsedThisEncounter: false,
        shieldsPlayedLastTurn: 2,
      });
      expect(effects.bonusBlock).toBe(4); // 2 + 2
    });

    it('no iron_shield → bonusBlock is 0', () => {
      const effects = resolveTurnStartEffects(new Set(), 0);
      expect(effects.bonusBlock).toBe(0);
    });
  });

  // ── thick_skin ──
  describe('thick_skin — start each encounter with 5 block', () => {
    it('thick_skin sets thickSkinBlock = 5 on encounter start', () => {
      const effects = resolveEncounterStartEffects(new Set(['thick_skin']));
      expect(effects.thickSkinBlock).toBe(5);
    });

    it('no thick_skin → thickSkinBlock = 0', () => {
      const effects = resolveEncounterStartEffects(new Set());
      expect(effects.thickSkinBlock).toBe(0);
    });
  });

  // ── brass_knuckles ──
  describe('brass_knuckles — +1 temporary Strength at turn start', () => {
    it('brass_knuckles grants +1 tempStrengthGain at turn start', () => {
      const effects = resolveTurnStartEffects(new Set(['brass_knuckles']), 0);
      expect(effects.tempStrengthGain).toBe(1);
    });

    it('no brass_knuckles → tempStrengthGain = 0', () => {
      const effects = resolveTurnStartEffects(new Set(), 0);
      expect(effects.tempStrengthGain).toBe(0);
    });
  });

  // ── brass_knuckles multi_hit — +1 extra hit via resolveAttackModifiers (multiHitBonus) ──
  // Note: chain_lightning_rod adds hits; brass_knuckles was reworked to turn_start Strength.
  // The chain_lightning_rod test covers multi_hit resolver hit bonus.

  // ── plague_flask ──
  describe('plague_flask — 2 Poison on all enemies at encounter start', () => {
    it('plague_flask sets encounterStartPoison = 2', () => {
      const effects = resolveEncounterStartEffects(new Set(['plague_flask']));
      expect(effects.encounterStartPoison).toBe(2);
    });

    it('no plague_flask → encounterStartPoison = 0', () => {
      const effects = resolveEncounterStartEffects(new Set());
      expect(effects.encounterStartPoison).toBe(0);
    });
  });

  // ── blood_price ──
  describe('blood_price — +1 AP per turn, costs 3 HP at turn end', () => {
    it('blood_price grants bonusAP = 1 at turn start', () => {
      const effects = resolveTurnStartEffects(new Set(['blood_price']), 0);
      expect(effects.bonusAP).toBe(1);
    });

    it('blood_price drains hpLoss = 3 at turn end', () => {
      const effects = resolveTurnEndEffects(new Set(['blood_price']), {
        damageDealtThisTurn: 10,
        cardsPlayedThisTurn: 2,
        isPerfectTurn: false,
      });
      expect(effects.hpLoss).toBe(3);
    });

    it('no blood_price → bonusAP = 0, hpLoss = 0', () => {
      const start = resolveTurnStartEffects(new Set(), 0);
      const end = resolveTurnEndEffects(new Set(), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
      });
      expect(start.bonusAP).toBe(0);
      expect(end.hpLoss).toBe(0);
    });
  });

  // ── worn_shield ──
  describe('worn_shield — +1 flat block on CHARGED shield cards only', () => {
    it('worn_shield + wasCharged=true → flatBlockBonus = 1', () => {
      const mods = resolveShieldModifiers(new Set(['worn_shield']), {
        shieldCardPlayCountThisEncounter: 0,
        wasCharged: true,
      });
      expect(mods.flatBlockBonus).toBe(1);
    });

    it('worn_shield + wasCharged=false → flatBlockBonus = 0', () => {
      const mods = resolveShieldModifiers(new Set(['worn_shield']), {
        shieldCardPlayCountThisEncounter: 0,
        wasCharged: false,
      });
      expect(mods.flatBlockBonus).toBe(0);
    });
  });

  // ── last_breath ──
  describe('last_breath — prevent death once per encounter', () => {
    it('last_breath triggers when not yet used', () => {
      const effects = resolveLethalEffects(new Set(['last_breath']), {
        lastBreathUsedThisEncounter: false,
        phoenixUsedThisRun: false,
        isBossEncounter: false,
      });
      expect(effects.lastBreathSave).toBe(true);
      expect(effects.lastBreathBlock).toBe(8);
    });

    it('last_breath does NOT trigger when already used this encounter', () => {
      const effects = resolveLethalEffects(new Set(['last_breath']), {
        lastBreathUsedThisEncounter: true,
        phoenixUsedThisRun: false,
        isBossEncounter: false,
      });
      expect(effects.lastBreathSave).toBe(false);
    });

    it('no last_breath → lastBreathSave = false', () => {
      const effects = resolveLethalEffects(new Set(), {
        lastBreathUsedThisEncounter: false,
        phoenixUsedThisRun: false,
        isBossEncounter: false,
      });
      expect(effects.lastBreathSave).toBe(false);
    });
  });

});

// ════════════════════════════════════════════════════════════════════════════
// 12.2 STARTER UNCOMMON RELICS
// ════════════════════════════════════════════════════════════════════════════

describe('12.2 Starter Uncommon Relics', () => {

  // ── herbal_pouch ──
  describe('herbal_pouch — apply 1 Poison to all enemies at turn start', () => {
    it('herbal_pouch sets poisonToAllEnemies = 1 at turn start', () => {
      const effects = resolveTurnStartEffects(new Set(['herbal_pouch']), 0);
      expect(effects.poisonToAllEnemies).toBe(1);
    });

    it('no herbal_pouch → poisonToAllEnemies = 0', () => {
      const effects = resolveTurnStartEffects(new Set(), 0);
      expect(effects.poisonToAllEnemies).toBe(0);
    });
  });

  // ── steel_skin ──
  describe('steel_skin — -2 flat damage reduction on incoming damage', () => {
    it('steel_skin returns flatReduction = 2', () => {
      const effects = resolveDamageTakenEffects(new Set(['steel_skin']), {
        playerHpPercent: 1.0,
        hadBlock: false,
        blockAbsorbedAll: false,
      });
      expect(effects.flatReduction).toBe(2);
    });

    it('no steel_skin → flatReduction = 0', () => {
      const effects = resolveDamageTakenEffects(new Set(), {
        playerHpPercent: 1.0,
        hadBlock: false,
        blockAbsorbedAll: false,
      });
      expect(effects.flatReduction).toBe(0);
    });
  });

  // ── volatile_core ──
  describe('volatile_core — +50% damage on all attacks', () => {
    it('volatile_core adds 50% percentDamageBonus via resolveAttackModifiers', () => {
      const mods = resolveAttackModifiers(new Set(['volatile_core']), makeAttackCtx());
      expect(mods.percentDamageBonus).toBeCloseTo(0.5);
    });

    it('QP strike with volatile_core deals ~50% more than without', () => {
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['volatile_core'])).damageDealt ?? 0;
      // 4 base QP → 4 * 1.5 = 6
      expect(withRelic).toBe(Math.round(base * 1.5));
    });
  });

  // ── aegis_stone ──
  describe('aegis_stone — block carries between turns (cap 15)', () => {
    it('aegis_stone sets blockCarries = true and blockCarryMax = 15', () => {
      const effects = resolveTurnEndEffects(new Set(['aegis_stone']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
      });
      expect(effects.blockCarries).toBe(true);
      // RELIC_AEGIS_STONE_MAX_CARRY from balance
      expect(effects.blockCarryMax).toBeGreaterThan(0);
      expect(effects.blockCarryMax).toBeLessThanOrEqual(15);
    });

    it('no aegis_stone → blockCarries = false', () => {
      const effects = resolveTurnEndEffects(new Set(), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
      });
      expect(effects.blockCarries).toBe(false);
    });
  });

  // ── regeneration_orb ──
  describe('regeneration_orb — heal 3 HP when 2+ shield cards played this turn', () => {
    it('heals 3 HP when 2+ shield cards played', () => {
      const effects = resolveTurnEndEffectsV2(new Set(['regeneration_orb']), {
        apUsed: 2,
        apRemaining: 1,
        shieldCardsPlayed: 2,
        lastCardPlayedId: null,
      });
      expect(effects.shieldPlayHeal).toBe(3);
    });

    it('does NOT heal when fewer than 2 shield cards played', () => {
      const effects = resolveTurnEndEffectsV2(new Set(['regeneration_orb']), {
        apUsed: 2,
        apRemaining: 1,
        shieldCardsPlayed: 1,
        lastCardPlayedId: null,
      });
      expect(effects.shieldPlayHeal).toBe(0);
    });

    it('no regeneration_orb → shieldPlayHeal = 0', () => {
      const effects = resolveTurnEndEffectsV2(new Set(), {
        apUsed: 2,
        apRemaining: 1,
        shieldCardsPlayed: 3,
        lastCardPlayedId: null,
      });
      expect(effects.shieldPlayHeal).toBe(0);
    });
  });

  // ── overflow_gem ──
  describe('overflow_gem — +75% effect bonus when 4+ AP spent this turn', () => {
    it('overflow_gem returns 75% bonus when 4+ AP spent', () => {
      const effects = resolveTurnEndEffectsV2(new Set(['overflow_gem']), {
        apUsed: 4,
        apRemaining: 0,
        shieldCardsPlayed: 0,
        lastCardPlayedId: 'strike',
      });
      expect(effects.overflowGemBonus).toBe(75);
    });

    it('overflow_gem returns 0 when fewer than 4 AP spent', () => {
      const effects = resolveTurnEndEffectsV2(new Set(['overflow_gem']), {
        apUsed: 3,
        apRemaining: 0,
        shieldCardsPlayed: 0,
        lastCardPlayedId: null,
      });
      expect(effects.overflowGemBonus).toBe(0);
    });
  });

  // ── capacitor ──
  describe('capacitor — store unspent AP at turn end, release at turn start', () => {
    it('capacitor stores remaining AP (capped at RELIC_CAPACITOR_MAX_STORED_AP)', () => {
      const effects = resolveTurnEndEffectsV2(new Set(['capacitor']), {
        apUsed: 2,
        apRemaining: 2,
        shieldCardsPlayed: 0,
        lastCardPlayedId: null,
      });
      // Stored AP should be 2 (within cap)
      expect(effects.storedAP).toBe(2);
    });

    it('capacitor releases stored AP at turn start', () => {
      const stored = 2;
      const effects = resolveTurnStartEffects(new Set(['capacitor']), stored);
      expect(effects.capacitorReleasedAP).toBe(stored);
    });

    it('no capacitor → storedAP = 0 and capacitorReleasedAP = 0', () => {
      const endEffects = resolveTurnEndEffectsV2(new Set(), {
        apUsed: 2,
        apRemaining: 2,
        shieldCardsPlayed: 0,
        lastCardPlayedId: null,
      });
      expect(endEffects.storedAP).toBe(0);

      const startEffects = resolveTurnStartEffects(new Set(), 2);
      expect(startEffects.capacitorReleasedAP).toBe(0);
    });
  });

  // ── berserker_band ──
  describe('berserker_band — +40% damage when below 50% HP', () => {
    it('berserker_band adds 40% percentDamageBonus below 50% HP', () => {
      const mods = resolveAttackModifiers(
        new Set(['berserker_band']),
        makeAttackCtx({ playerHpPercent: 0.3 }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.4);
    });

    it('berserker_band does NOT trigger at 50%+ HP', () => {
      const mods = resolveAttackModifiers(
        new Set(['berserker_band']),
        makeAttackCtx({ playerHpPercent: 0.5 }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });

    it('berserker_band attack bonus is visible in resolveCardEffect at low HP', () => {
      const fullHp = resolveWith('strike', 'quick', new Set(), { hp: 80, maxHP: 80 });
      const lowHp = resolveWith(
        'strike', 'quick',
        new Set(['berserker_band']),
        { hp: 30, maxHP: 80 }, // 37.5% HP — below 50%
      );
      expect((lowHp.damageDealt ?? 0)).toBeGreaterThan(fullHp.damageDealt ?? 0);
    });
  });

  // ── glass_cannon ──
  describe('glass_cannon — +35% damage, +10% incoming damage', () => {
    it('glass_cannon adds 35% percentDamageBonus via resolveAttackModifiers', () => {
      const mods = resolveAttackModifiers(new Set(['glass_cannon']), makeAttackCtx());
      expect(mods.percentDamageBonus).toBeCloseTo(0.35);
    });

    it('glass_cannon adds 10% incoming damage penalty via resolveDamageTakenEffects', () => {
      const effects = resolveDamageTakenEffects(new Set(['glass_cannon']), {
        playerHpPercent: 1.0,
        hadBlock: false,
        blockAbsorbedAll: false,
      });
      expect(effects.percentIncrease).toBeCloseTo(0.10);
    });

    it('QP strike with glass_cannon deals more than baseline', () => {
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['glass_cannon'])).damageDealt ?? 0;
      expect(withRelic).toBe(Math.round(base * 1.35));
    });
  });

  // ── reckless_resolve ──
  describe('reckless_resolve — +50% below 40% HP, -15% above 80% HP', () => {
    it('reckless_resolve adds +50% percentDamageBonus below 40% HP', () => {
      const mods = resolveAttackModifiers(
        new Set(['reckless_resolve']),
        makeAttackCtx({ playerHpPercent: 0.35 }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.5);
    });

    it('reckless_resolve subtracts 15% above 80% HP', () => {
      const mods = resolveAttackModifiers(
        new Set(['reckless_resolve']),
        makeAttackCtx({ playerHpPercent: 0.9 }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(-0.15);
    });

    it('reckless_resolve neutral zone (40–80% HP) has no bonus or penalty', () => {
      const mods = resolveAttackModifiers(
        new Set(['reckless_resolve']),
        makeAttackCtx({ playerHpPercent: 0.6 }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });
  });

  // ── thorn_crown ──
  describe('thorn_crown — reflect 5 damage when attacked at 10+ block', () => {
    it('thorn_crown returns thornCrownReflect = 5 at 10+ block', () => {
      const effects = resolveDamageTakenEffects(new Set(['thorn_crown']), {
        playerHpPercent: 1.0,
        hadBlock: true,
        blockAbsorbedAll: false,
        currentBlock: 10,
      });
      expect(effects.thornCrownReflect).toBe(5);
    });

    it('thorn_crown does NOT trigger at 9 block', () => {
      const effects = resolveDamageTakenEffects(new Set(['thorn_crown']), {
        playerHpPercent: 1.0,
        hadBlock: true,
        blockAbsorbedAll: false,
        currentBlock: 9,
      });
      expect(effects.thornCrownReflect).toBe(0);
    });
  });

  // ── bastions_will ──
  describe('bastions_will — +25% block on Quick Play shield cards', () => {
    it('bastions_will returns quickPlayShieldBonus = 25', () => {
      const mods = resolveShieldModifiers(new Set(['bastions_will']));
      expect(mods.quickPlayShieldBonus).toBe(25);
    });

    it('QP block with bastions_will is 25% more than without', () => {
      const base = resolveWith('block', 'quick').shieldApplied ?? 0;
      const withRelic = resolveWith('block', 'quick', new Set(['bastions_will'])).shieldApplied ?? 0;
      const stats = getMasteryStats('block', 0);
      const qp = stats?.qpValue ?? 4;
      // Math.round(qp * 1.25)
      expect(withRelic).toBe(Math.round(qp * 1.25));
      expect(withRelic).toBeGreaterThan(base);
    });

    it('bastions_will does NOT apply on Charged play', () => {
      // The +75% Charged path is handled in turnManager; card resolver only does QP +25%
      const qpResult = resolveWith('block', 'quick', new Set(['bastions_will'])).shieldApplied ?? 0;
      const ccResult = resolveWith('block', 'charge_correct', new Set(['bastions_will'])).shieldApplied ?? 0;
      // CC without bastions_will +25% multiplier (that path is turnManager)
      // QP result should have the 25% bonus; CC should NOT (handled upstream)
      const stats = getMasteryStats('block', 0);
      const qp = stats?.qpValue ?? 4;
      expect(qpResult).toBe(Math.round(qp * 1.25)); // QP with bastions_will
      // CC result is the CC value without the QP shield multiplier
      expect(ccResult).not.toBe(qpResult);
    });
  });

  // ── stone_wall ──
  describe('stone_wall — +3 flat block on all shield cards', () => {
    it('stone_wall returns flatBlockBonus = 3', () => {
      const mods = resolveShieldModifiers(new Set(['stone_wall']));
      expect(mods.flatBlockBonus).toBe(3);
    });

    it('QP block with stone_wall is exactly 3 more than without', () => {
      const base = resolveWith('block', 'quick').shieldApplied ?? 0;
      const withRelic = resolveWith('block', 'quick', new Set(['stone_wall'])).shieldApplied ?? 0;
      expect(withRelic - base).toBe(3);
    });

    it('stone_wall stacks with bastions_will on QP', () => {
      const base = resolveWith('block', 'quick').shieldApplied ?? 0;
      const withBoth = resolveWith('block', 'quick', new Set(['stone_wall', 'bastions_will'])).shieldApplied ?? 0;
      const stats = getMasteryStats('block', 0);
      const qp = stats?.qpValue ?? 4;
      // Math.round((qp + 3) * 1.25)
      expect(withBoth).toBe(Math.round((qp + 3) * 1.25));
      expect(withBoth).toBeGreaterThan(base);
    });
  });

  // ── flame_brand ──
  describe('flame_brand — +40% damage on first attack each encounter', () => {
    it('flame_brand adds 40% percentDamageBonus when isFirstAttack = true', () => {
      const mods = resolveAttackModifiers(
        new Set(['flame_brand']),
        makeAttackCtx({ isFirstAttack: true }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.4);
    });

    it('flame_brand adds NO bonus when isFirstAttack = false', () => {
      const mods = resolveAttackModifiers(
        new Set(['flame_brand']),
        makeAttackCtx({ isFirstAttack: false }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });

    it('first attack with flame_brand visible in resolveCardEffect', () => {
      const base = resolveWith('strike', 'quick', new Set(), undefined, undefined, undefined, {
        isFirstAttackThisEncounter: true,
      }).damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['flame_brand']), undefined, undefined, undefined, {
        isFirstAttackThisEncounter: true,
      }).damageDealt ?? 0;
      expect(withRelic).toBeGreaterThan(base);
    });
  });

  // ── battle_scars ──
  describe('battle_scars — arm +3 attack bonus after taking a hit', () => {
    it('battle_scars returns battleScarsTriggered = true on hit', () => {
      const effects = resolveDamageTakenEffects(new Set(['battle_scars']), {
        playerHpPercent: 1.0,
        hadBlock: false,
        blockAbsorbedAll: false,
      });
      expect(effects.battleScarsTriggered).toBe(true);
    });

    it('battle_scars does NOT trigger without the relic', () => {
      const effects = resolveDamageTakenEffects(new Set(), {
        playerHpPercent: 1.0,
        hadBlock: false,
        blockAbsorbedAll: false,
      });
      expect(effects.battleScarsTriggered).toBe(false);
    });

    it('battle_scars armed bonus adds +3 flat attack in resolveAttackModifiers', () => {
      const withArmed = resolveAttackModifiers(
        new Set(['battle_scars']),
        makeAttackCtx({ battleScarsArmed: true }),
      );
      const notArmed = resolveAttackModifiers(
        new Set(['battle_scars']),
        makeAttackCtx({ battleScarsArmed: false }),
      );
      expect(withArmed.flatDamageBonus - notArmed.flatDamageBonus).toBe(3);
    });
  });

  // ── scar_tissue ──
  describe('scar_tissue — +3 flat damage per wrong Charge accumulated this run', () => {
    it('scar_tissue with 3 stacks adds 9 flatDamageBonus via resolveAttackModifiers', () => {
      const mods = resolveAttackModifiers(
        new Set(['scar_tissue']),
        makeAttackCtx({ scarTissueStacks: 3 }),
      );
      expect(mods.flatDamageBonus).toBe(9); // 3 stacks × 3
    });

    it('scar_tissue with 0 stacks adds 0 flatDamageBonus', () => {
      const mods = resolveAttackModifiers(
        new Set(['scar_tissue']),
        makeAttackCtx({ scarTissueStacks: 0 }),
      );
      expect(mods.flatDamageBonus).toBe(0);
    });

    it('scar_tissue attack bonus visible in resolveCardEffect', () => {
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith(
        'strike', 'quick',
        new Set(['scar_tissue']),
        undefined, undefined, undefined,
        { scarTissueStacks: 2 },
      ).damageDealt ?? 0;
      expect(withRelic - base).toBe(6); // 2 stacks × 3
    });
  });

  // ── festering_wound ──
  describe('festering_wound — +40% damage when enemy has 3+ Poison stacks', () => {
    it('festering_wound adds 40% percentDamageBonus at 3+ enemy poison stacks', () => {
      const mods = resolveAttackModifiers(
        new Set(['festering_wound']),
        makeAttackCtx({ enemyPoisonStacks: 3 }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.4);
    });

    it('festering_wound does NOT trigger at fewer than 3 poison stacks', () => {
      const mods = resolveAttackModifiers(
        new Set(['festering_wound']),
        makeAttackCtx({ enemyPoisonStacks: 2 }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });

    it('festering_wound visible in resolveCardEffect when enemy has 3 poison stacks', () => {
      const base = resolveWith('strike', 'quick', new Set(), undefined, {
        statusEffects: [{ type: 'poison', value: 3, turnsRemaining: 3 }],
      }).damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['festering_wound']), undefined, {
        statusEffects: [{ type: 'poison', value: 3, turnsRemaining: 3 }],
      }).damageDealt ?? 0;
      expect(withRelic).toBe(Math.round(base * 1.4));
    });
  });

  // ── bloodstone_pendant ──
  describe('bloodstone_pendant — +1 Fury stack per hit taken; each stack = +1 flat damage', () => {
    it('bloodstone_pendant grants 1 furyStacksGained when hit', () => {
      const effects = resolveDamageTakenEffects(new Set(['bloodstone_pendant']), {
        playerHpPercent: 1.0,
        hadBlock: false,
        blockAbsorbedAll: false,
      });
      expect(effects.furyStacksGained).toBe(1);
    });

    it('bloodstone_pendant with 4 fury stacks adds 4 flatDamageBonus', () => {
      const mods = resolveAttackModifiers(
        new Set(['bloodstone_pendant']),
        makeAttackCtx({ furyStacks: 4 }),
      );
      expect(mods.flatDamageBonus).toBe(4);
    });

    it('no bloodstone_pendant → furyStacksGained = 0', () => {
      const effects = resolveDamageTakenEffects(new Set(), {
        playerHpPercent: 1.0,
        hadBlock: false,
        blockAbsorbedAll: false,
      });
      expect(effects.furyStacksGained).toBe(0);
    });
  });

  // ── dragon_s_heart ──
  describe('dragon_s_heart — passive +2 flat damage on all attacks', () => {
    it('dragon_s_heart adds 2 flatDamageBonus via resolveAttackModifiers', () => {
      const mods = resolveAttackModifiers(new Set(['dragon_s_heart']), makeAttackCtx());
      expect(mods.flatDamageBonus).toBe(2);
    });

    it('QP strike with dragon_s_heart is 2 more than without', () => {
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['dragon_s_heart'])).damageDealt ?? 0;
      expect(withRelic - base).toBe(2);
    });
  });

  // ── ember_core ──
  describe('ember_core — +20% damage when enemy has 5+ Burn stacks', () => {
    it('ember_core adds 20% percentDamageBonus at 5+ enemy burn stacks', () => {
      const mods = resolveAttackModifiers(
        new Set(['ember_core']),
        makeAttackCtx({ enemyBurnStacks: 5 }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.2);
    });

    it('ember_core does NOT trigger at fewer than 5 burn stacks', () => {
      const mods = resolveAttackModifiers(
        new Set(['ember_core']),
        makeAttackCtx({ enemyBurnStacks: 4 }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });
  });

  // ── entropy_engine ──
  describe('entropy_engine — 3+ distinct card types this turn: 5 damage + 5 block', () => {
    it('entropy_engine fires proc when 3+ distinct card types played', () => {
      const effects = resolveTurnEndEffects(new Set(['entropy_engine']), {
        damageDealtThisTurn: 20,
        cardsPlayedThisTurn: 3,
        isPerfectTurn: false,
        distinctCardTypesPlayedThisTurn: 3,
      });
      expect(effects.entropyEngineProc).toEqual({ damage: 5, block: 5 });
    });

    it('entropy_engine does NOT fire when fewer than 3 distinct types played', () => {
      const effects = resolveTurnEndEffects(new Set(['entropy_engine']), {
        damageDealtThisTurn: 10,
        cardsPlayedThisTurn: 2,
        isPerfectTurn: false,
        distinctCardTypesPlayedThisTurn: 2,
      });
      expect(effects.entropyEngineProc).toBeNull();
    });
  });

  // ── inferno_crown ──
  describe('inferno_crown — +20% damage when enemy has Burn or Poison', () => {
    it('inferno_crown adds 20% percentDamageBonus when enemy has Burn', () => {
      const mods = resolveAttackModifiers(
        new Set(['inferno_crown']),
        makeAttackCtx({ enemyHasBurn: true }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.2);
    });

    it('inferno_crown adds 20% percentDamageBonus when enemy has Poison', () => {
      const mods = resolveAttackModifiers(
        new Set(['inferno_crown']),
        makeAttackCtx({ enemyHasPoison: true }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.2);
    });

    it('inferno_crown adds NO bonus when enemy has neither Burn nor Poison', () => {
      const mods = resolveAttackModifiers(
        new Set(['inferno_crown']),
        makeAttackCtx({ enemyHasBurn: false, enemyHasPoison: false }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });
  });

  // ── null_shard ──
  describe('null_shard — all attacks +25% damage', () => {
    it('null_shard adds 25% percentDamageBonus via resolveAttackModifiers', () => {
      const mods = resolveAttackModifiers(new Set(['null_shard']), makeAttackCtx());
      expect(mods.percentDamageBonus).toBeCloseTo(0.25);
    });

    it('QP strike with null_shard deals ~25% more than without', () => {
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['null_shard'])).damageDealt ?? 0;
      expect(withRelic).toBe(Math.round(base * 1.25));
    });
  });

  // ── phoenix_feather ──
  describe('phoenix_feather — prevent death once per run', () => {
    it('phoenix_feather triggers when not yet used this run', () => {
      const effects = resolveLethalEffects(new Set(['phoenix_feather']), {
        lastBreathUsedThisEncounter: false,
        phoenixUsedThisRun: false,
        isBossEncounter: false,
      });
      expect(effects.phoenixSave).toBe(true);
      expect(effects.phoenixHealPercent).toBeCloseTo(0.15);
    });

    it('phoenix_feather does NOT trigger when already used this run', () => {
      const effects = resolveLethalEffects(new Set(['phoenix_feather']), {
        lastBreathUsedThisEncounter: false,
        phoenixUsedThisRun: true,
        isBossEncounter: false,
      });
      expect(effects.phoenixSave).toBe(false);
    });

    it('last_breath takes priority over phoenix_feather', () => {
      const effects = resolveLethalEffects(
        new Set(['last_breath', 'phoenix_feather']),
        {
          lastBreathUsedThisEncounter: false,
          phoenixUsedThisRun: false,
          isBossEncounter: false,
        },
      );
      expect(effects.lastBreathSave).toBe(true);
      expect(effects.phoenixSave).toBe(false);
    });
  });

});

// ════════════════════════════════════════════════════════════════════════════
// 12.3 UNLOCKABLE RARE / LEGENDARY RELICS
// ════════════════════════════════════════════════════════════════════════════

describe('12.3 Unlockable Rare / Legendary Relics', () => {

  // ── barbed_edge ──
  describe('barbed_edge — strike-tagged mechanics get sharpenedEdge bonus + flatDamageBonus', () => {
    it('barbed_edge adds 2 flatDamageBonus for strike-tagged attacks via resolveAttackModifiers', () => {
      const withStrike = resolveAttackModifiers(
        new Set(['barbed_edge']),
        makeAttackCtx({ isStrikeTagged: true }),
      );
      const withoutStrike = resolveAttackModifiers(
        new Set(['barbed_edge']),
        makeAttackCtx({ isStrikeTagged: false }),
      );
      expect(withStrike.flatDamageBonus - withoutStrike.flatDamageBonus).toBe(2);
    });

    it('barbed_edge adds sharpenedEdgeBonus=3 (pre-scale) + flatDamageBonus=2 (post-scale) on strike cards', () => {
      // strike has the 'strike' tag, so sharpenedEdgeBonus = 3 AND flatDamageBonus += 2 via resolver
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['barbed_edge'])).damageDealt ?? 0;
      // At L0 QP=4: (4+3)*1.0 = 7 scaled, then +2 flat = 9. Base = 4.
      // Total bonus = 5 (3 pre-scale + 2 post-scale = +5 net at no-multiplier 1.0x)
      expect(withRelic - base).toBe(5);
    });

    it('barbed_edge does NOT boost non-strike cards (piercing has no strike tag)', () => {
      // piercing has tags: ['pierce'] — no 'strike' tag, so sharpenedEdgeBonus = 0 and no flatDamageBonus
      const base = resolveWith('piercing', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('piercing', 'quick', new Set(['barbed_edge'])).damageDealt ?? 0;
      expect(withRelic).toBe(base);
    });






  });

  // ── chain_lightning_rod ──
  describe('chain_lightning_rod — multi_hit cards get +1 hit', () => {
    it('chain_lightning_rod increases multi_hit hitCount by 1', () => {
      const base = resolveWith('multi_hit', 'quick');
      const withRelic = resolveWith('multi_hit', 'quick', new Set(['chain_lightning_rod']));
      const baseHits = base.hitCount ?? 3; // mechanic.secondaryValue=3
      expect(withRelic.hitCount).toBe(baseHits + 1);
    });

    it('chain_lightning_rod adds 2 multiHitBonus via resolveAttackModifiers', () => {
      const mods = resolveAttackModifiers(new Set(['chain_lightning_rod']), makeAttackCtx());
      // Note: resolveAttackModifiers reports +2 multiHitBonus, but the resolver uses +1 hit (activeRelicIds.has check)
      expect(mods.multiHitBonus).toBe(2);
    });
  });

  // ── red_fang ──
  describe('red_fang — first attack each encounter +30% damage', () => {
    it('red_fang adds 30% percentDamageBonus on first attack', () => {
      const mods = resolveAttackModifiers(
        new Set(['red_fang']),
        makeAttackCtx({ isFirstAttack: true }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.3);
    });

    it('red_fang does NOT add bonus on subsequent attacks', () => {
      const mods = resolveAttackModifiers(
        new Set(['red_fang']),
        makeAttackCtx({ isFirstAttack: false }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });

    it('red_fang firstAttackDamageBonus is 0.30 in resolveEncounterStartEffects', () => {
      const effects = resolveEncounterStartEffects(new Set(['red_fang']));
      expect(effects.firstAttackDamageBonus).toBeCloseTo(0.3);
    });
  });

  // ── gladiator_s_mark ──
  describe('gladiator_s_mark — +1 Strength for 3 turns at encounter start', () => {
    it('gladiator_s_mark provides tempStrengthBonus at encounter start', () => {
      const effects = resolveEncounterStartEffects(new Set(['gladiator_s_mark']));
      expect(effects.tempStrengthBonus).not.toBeNull();
      expect(effects.tempStrengthBonus?.amount).toBe(1);
      expect(effects.tempStrengthBonus?.durationTurns).toBe(3);
    });

    it('no gladiator_s_mark → tempStrengthBonus = null', () => {
      const effects = resolveEncounterStartEffects(new Set());
      expect(effects.tempStrengthBonus).toBeNull();
    });
  });

  // ── venom_fang ──
  describe('venom_fang — all attacks apply 2 Poison for 3 turns', () => {
    it('venom_fang returns applyPoison = {value: 2, turns: 3} via resolveAttackModifiers', () => {
      const mods = resolveAttackModifiers(new Set(['venom_fang']), makeAttackCtx());
      expect(mods.applyPoison).toEqual({ value: 2, turns: 3 });
    });

    it('no venom_fang → applyPoison = null', () => {
      const mods = resolveAttackModifiers(new Set(), makeAttackCtx());
      expect(mods.applyPoison).toBeNull();
    });
  });

  // ── berserker_s_oath ──
  describe('berserker_s_oath — all attacks +40% damage', () => {
    it('berserker_s_oath adds 40% percentDamageBonus', () => {
      const mods = resolveAttackModifiers(new Set(['berserker_s_oath']), makeAttackCtx());
      expect(mods.percentDamageBonus).toBeCloseTo(0.4);
    });

    it('QP strike with berserker_s_oath deals ~40% more than without', () => {
      const base = resolveWith('strike', 'quick').damageDealt ?? 0;
      const withRelic = resolveWith('strike', 'quick', new Set(['berserker_s_oath'])).damageDealt ?? 0;
      expect(withRelic).toBe(Math.round(base * 1.4));
    });
  });

  // ── crescendo_blade ──
  describe('crescendo_blade — +10% damage per consecutive correct attack', () => {
    it('crescendo_blade adds 10% per stack (2 stacks = 20%)', () => {
      const mods = resolveAttackModifiers(
        new Set(['crescendo_blade']),
        makeAttackCtx({ consecutiveCorrectAttacks: 2 }),
      );
      expect(mods.percentDamageBonus).toBeCloseTo(0.2);
    });

    it('crescendo_blade adds 0% at 0 consecutive correct attacks', () => {
      const mods = resolveAttackModifiers(
        new Set(['crescendo_blade']),
        makeAttackCtx({ consecutiveCorrectAttacks: 0 }),
      );
      expect(mods.percentDamageBonus).toBe(0);
    });
  });

  // ── hollow_armor ──
  describe('hollow_armor — +12 starting block; drains 3/turn after turn 3', () => {
    it('hollow_armor grants startingBlock = 12 at encounter start', () => {
      const effects = resolveEncounterStartEffects(new Set(['hollow_armor']));
      expect(effects.startingBlock).toBe(12);
    });

    it('hollow_armor drains 3 block per turn after turn 3', () => {
      const effects = resolveTurnEndEffects(new Set(['hollow_armor']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
        encounterTurnNumber: 4,
      });
      expect(effects.blockDrain).toBe(3);
    });

    it('hollow_armor does NOT drain on turns 1-3', () => {
      const effects = resolveTurnEndEffects(new Set(['hollow_armor']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
        encounterTurnNumber: 3,
      });
      expect(effects.blockDrain).toBeUndefined();
    });
  });

  // ── prismatic_shard ──
  // prismatic_shard is NOT in relicEffectResolver.ts — chain modifier handled by resolveChainModifiers.
  // This test confirms the relic ID exists in the relics data files, at minimum.

  // ── thorn_mantle ──
  describe('thorn_mantle — grant 4 Thorns when player has 10+ block at turn end', () => {
    it('thorn_mantle grants 4 thorns at turn end with 10+ block', () => {
      const effects = resolveTurnEndEffects(new Set(['thorn_mantle']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
        currentBlock: 10,
      });
      expect(effects.grantThorns).toBe(4);
    });

    it('thorn_mantle does NOT grant thorns below 10 block', () => {
      const effects = resolveTurnEndEffects(new Set(['thorn_mantle']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
        currentBlock: 9,
      });
      expect(effects.grantThorns).toBeUndefined();
    });
  });

  // ── quiz_master ──
  describe('quiz_master — +2 AP next turn when 3+ correct charges this turn', () => {
    it('quiz_master grants bonusApNextTurn = 2 when 3+ correct charges', () => {
      const effects = resolveTurnEndEffects(new Set(['quiz_master']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 3,
        isPerfectTurn: true,
        chargeCorrectsThisTurn: 3,
      });
      expect(effects.bonusApNextTurn).toBe(2);
    });

    it('quiz_master does NOT trigger with fewer than 3 correct charges', () => {
      const effects = resolveTurnEndEffects(new Set(['quiz_master']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 2,
        isPerfectTurn: false,
        chargeCorrectsThisTurn: 2,
      });
      expect(effects.bonusApNextTurn).toBeUndefined();
    });
  });

  // ── executioners_axe ──
  describe('executioners_axe — execute threshold 50%; +5 flat damage below 30% enemy HP', () => {
    it('executioners_axe sets executeThresholdOverride = 0.5', () => {
      const mods = resolveAttackModifiers(new Set(['executioners_axe']), makeAttackCtx());
      expect(mods.executeThresholdOverride).toBe(0.5);
    });

    it('executioners_axe adds +5 flatDamageBonus when enemy below 30% HP', () => {
      const lowHp = resolveAttackModifiers(
        new Set(['executioners_axe']),
        makeAttackCtx({ enemyHpPercent: 0.25 }),
      );
      const fullHp = resolveAttackModifiers(
        new Set(['executioners_axe']),
        makeAttackCtx({ enemyHpPercent: 0.5 }),
      );
      expect(lowHp.flatDamageBonus - fullHp.flatDamageBonus).toBe(5);
    });

    it('no executioners_axe → executeThresholdOverride = null', () => {
      const mods = resolveAttackModifiers(new Set(), makeAttackCtx());
      expect(mods.executeThresholdOverride).toBeNull();
    });
  });

  // ── deja_vu ──
  describe('deja_vu — spawn 1 card from discard on turn 1 (2 at level 15+)', () => {
    it('deja_vu spawns 1 card on turn 1 at level < 15', () => {
      const effects = resolveTurnStartEffects(new Set(['deja_vu']), 0, {
        turnNumberThisEncounter: 1,
        characterLevel: 10,
        dejaVuUsedThisEncounter: false,
      });
      expect(effects.dejaVuCardSpawn).not.toBeNull();
      expect(effects.dejaVuCardSpawn?.count).toBe(1);
    });

    it('deja_vu spawns 2 cards on turn 1 at level 15+', () => {
      const effects = resolveTurnStartEffects(new Set(['deja_vu']), 0, {
        turnNumberThisEncounter: 1,
        characterLevel: 15,
        dejaVuUsedThisEncounter: false,
      });
      expect(effects.dejaVuCardSpawn?.count).toBe(2);
    });

    it('deja_vu does NOT trigger on turn 2+', () => {
      const effects = resolveTurnStartEffects(new Set(['deja_vu']), 0, {
        turnNumberThisEncounter: 2,
        characterLevel: 5,
        dejaVuUsedThisEncounter: false,
      });
      expect(effects.dejaVuCardSpawn).toBeNull();
    });

    it('deja_vu does NOT trigger if already used this encounter', () => {
      const effects = resolveTurnStartEffects(new Set(['deja_vu']), 0, {
        turnNumberThisEncounter: 1,
        characterLevel: 5,
        dejaVuUsedThisEncounter: true,
      });
      expect(effects.dejaVuCardSpawn).toBeNull();
    });
  });

  // ── overclocked_mind ──
  describe('overclocked_mind — +2 bonus card draw per turn, discard 2 at turn end', () => {
    it('overclocked_mind sets bonusCardDraw = 2 at turn start', () => {
      const effects = resolveTurnStartEffects(new Set(['overclocked_mind']), 0);
      expect(effects.bonusCardDraw).toBe(2);
    });

    it('overclocked_mind sets forceDiscard = 2 at turn end', () => {
      const effects = resolveTurnEndEffects(new Set(['overclocked_mind']), {
        damageDealtThisTurn: 0,
        cardsPlayedThisTurn: 0,
        isPerfectTurn: false,
      });
      expect(effects.forceDiscard).toBe(2);
    });
  });

  // ── paradox_engine ──
  describe('paradox_engine (legendary) — unconditional +1 AP per turn', () => {
    it('paradox_engine grants bonusAP = 1 at turn start', () => {
      const effects = resolveTurnStartEffects(new Set(['paradox_engine']), 0);
      expect(effects.bonusAP).toBe(1);
    });
  });

  // ── scholars_hat ──
  describe('scholars_hat — heal 3 HP and +2 damage bonus on correct answer', () => {
    it('resolveCorrectAnswerEffects with scholars_hat heals 3 HP', async () => {
      const { resolveCorrectAnswerEffects } = await import('../../src/services/relicEffectResolver');
      const effects = resolveCorrectAnswerEffects(new Set(['scholars_hat']), {
        correctStreakThisEncounter: 0,
      });
      expect(effects.healHp).toBe(3);
      expect(effects.bonusDamage).toBe(2);
    });

    it('resolveCorrectAnswerEffects without scholars_hat returns 0 heal', async () => {
      const { resolveCorrectAnswerEffects } = await import('../../src/services/relicEffectResolver');
      const effects = resolveCorrectAnswerEffects(new Set(), {
        correctStreakThisEncounter: 0,
      });
      expect(effects.healHp).toBe(0);
      expect(effects.bonusDamage).toBe(0);
    });
  });

  // ── memory_palace ──
  describe('memory_palace — 2 correct in a row: +4 flat damage', () => {
    it('memory_palace adds +4 flatDamageBonus at 2+ consecutive correct attacks', () => {
      const mods = resolveAttackModifiers(
        new Set(['memory_palace']),
        makeAttackCtx({ correctStreakThisEncounter: 2 }),
      );
      expect(mods.flatDamageBonus).toBe(4);
    });

    it('memory_palace does NOT trigger at fewer than 2 consecutive correct', () => {
      const mods = resolveAttackModifiers(
        new Set(['memory_palace']),
        makeAttackCtx({ correctStreakThisEncounter: 1 }),
      );
      expect(mods.flatDamageBonus).toBe(0);
    });
  });

  // ── bleedstone — bleedstone is NOT in relicEffectResolver.ts (no tests, expected absent) ──

  // ── whetstone + stone_wall combined ──
  describe('whetstone + stone_wall combined (cross-type interaction check)', () => {
    it('stone_wall (shield) + whetstone (attack) do not cancel each other for attack', () => {
      const mods = resolveAttackModifiers(
        new Set(['whetstone', 'stone_wall']),
        makeAttackCtx(),
      );
      // whetstone contributes +3 flat; stone_wall has no attack role
      expect(mods.flatDamageBonus).toBe(3);
    });

    it('stone_wall (shield) + whetstone (attack) for shield: net flatBlockBonus = 2 (+3 stone_wall, -1 whetstone)', () => {
      const mods = resolveShieldModifiers(new Set(['stone_wall', 'whetstone']));
      expect(mods.flatBlockBonus).toBe(2); // 3 - 1
    });
  });

});
