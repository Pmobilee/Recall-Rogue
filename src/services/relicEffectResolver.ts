/**
 * Centralized relic effect resolver.
 *
 * Pure functions that compute relic bonuses from a Set<string> of held relic IDs.
 * Each function accepts the relic set plus any situational context and returns a
 * plain object describing the computed effects. No side effects, no store imports.
 *
 * Relic categories handled:
 *   PERMANENT, ON_ENCOUNTER_START, ON_ATTACK, ON_MULTI_HIT, ON_BLOCK,
 *   ON_DAMAGE_TAKEN, ON_LETHAL, ON_TURN_END, ON_PERFECT_TURN,
 *   ON_CORRECT_ANSWER, ON_CARD_SKIP, ON_FLOOR_ADVANCE, ON_ENCOUNTER_END
 */

import { hasSynergy } from './relicSynergyResolver';
import {
  MAX_RELIC_SLOTS,
  SCHOLARS_GAMBIT_EXTRA_SLOT,
  RELIC_QUICKSILVER_QUILL_FAST_MS,
  RELIC_ADRENALINE_SHARD_FAST_MS,
  RELIC_CAPACITOR_MAX_STORED_AP,
  RELIC_AEGIS_STONE_MAX_CARRY,
} from '../data/balance';
import type { RunRelic } from '../data/relics/types';

// ─── Relic Slot Helpers ──────────────────────────────────────────────

/**
 * Returns the maximum number of relic slots for the current run.
 * Scholar's Gambit (cursed relic) grants one extra slot (5 → 6).
 *
 * @param runRelics - The player's currently equipped relics.
 * @returns Max relic slots (5 normally, 6 with Scholar's Gambit).
 */
export function getMaxRelicSlots(runRelics: RunRelic[]): number {
  const hasScholarsGambit = runRelics.some(r => r.definitionId === 'scholars_gambit');
  return MAX_RELIC_SLOTS + (hasScholarsGambit ? SCHOLARS_GAMBIT_EXTRA_SLOT : 0);
}

/**
 * Returns true when the player's relic slots are at or above capacity.
 *
 * @param runRelics - The player's currently equipped relics.
 * @returns True if no more relics can be added.
 */
export function isRelicSlotsFull(runRelics: RunRelic[]): boolean {
  return runRelics.length >= getMaxRelicSlots(runRelics);
}

// ─── Turn Start ─────────────────────────────────────────────────────

/** Effects resolved at the start of each player turn. */
export interface TurnStartEffects {
  /** Block granted at start of each turn (iron_shield v2: +2; iron_buckler v1: +5). */
  bonusBlock: number;
  /** Bonus AP released from Capacitor stored charge this turn. */
  capacitorReleasedAP: number;
  /** Bonus AP added to base AP each turn (blood_price v2: +1). */
  bonusAP: number;
}

/**
 * Resolve effects that fire at the start of every player turn.
 *
 * @param relicIds       - Set of relic IDs the player currently holds.
 * @param capacitorStored - AP stored by capacitor from last turn (0 if no capacitor).
 * @returns Computed turn-start bonuses.
 */
export function resolveTurnStartEffects(
  relicIds: Set<string>,
  capacitorStored: number = 0,
): TurnStartEffects {
  // iron_shield (v2, +2) replaces iron_buckler (v1, +5)
  const bonusBlock =
    relicIds.has('iron_shield') ? 2 :
    relicIds.has('iron_buckler') ? 5 : // v1 legacy fallback
    0;

  // capacitor releases stored AP at turn start
  const capacitorReleasedAP =
    relicIds.has('capacitor') ? Math.min(capacitorStored, RELIC_CAPACITOR_MAX_STORED_AP) : 0;

  // blood_price (v2) — grants +1 AP per turn in exchange for 2 HP/turn loss
  const bonusAP = relicIds.has('blood_price') ? 1 : 0;

  return { bonusBlock, capacitorReleasedAP, bonusAP };
}

// ─── Encounter Start ────────────────────────────────────────────────

/** Effects resolved at the beginning of each encounter. */
export interface EncounterStartEffects {
  /** Bonus block applied to player at encounter start. */
  bonusBlock: number;
  /** HP healed at encounter start (v1 herbal_pouch legacy — v2 moved to encounter end). */
  bonusHeal: number;
  /** Bonus action points granted at encounter start (quicksilver v1 legacy). */
  bonusAP: number;
  /** Whether the first card played this encounter costs 0 AP (double_vision v1 legacy). */
  freeFirstCard: boolean;
  /** Whether the player permanently sees 2 enemy intents (cartographers_lens v1 legacy). */
  permanentForesight: boolean;
  /**
   * Random buff from lucky_coin (v2).
   * One of: 'empower' | 'block_2' | 'ap_1' | 'draw_1' | null.
   * Caller applies the buff effect; null if lucky_coin not held.
   */
  luckyBuff: 'empower' | 'block_2' | 'ap_1' | 'draw_1' | null;
}

/** Buff pool for lucky_coin (v2). */
const LUCKY_BUFF_POOL: Array<'empower' | 'block_2' | 'ap_1' | 'draw_1'> = [
  'empower', 'block_2', 'ap_1', 'draw_1',
];

/**
 * Resolve effects that fire at the start of every encounter.
 *
 * @param relicIds       - Set of relic IDs the player currently holds.
 * @param playerHpPercent - Player HP fraction 0..1 (v1 herbal_pouch legacy).
 * @returns Computed encounter-start bonuses.
 */
export function resolveEncounterStartEffects(
  relicIds: Set<string>,
  playerHpPercent?: number,
): EncounterStartEffects {
  // v1 herbal_pouch legacy — v2 version fires at encounter END
  let bonusHeal = 0;
  let bonusBlock = 0;
  if (relicIds.has('herbal_pouch') && !relicIds.has('iron_shield')) {
    // Only apply v1 logic if iron_shield not present (proxy for v1 save)
    if ((playerHpPercent ?? 0) > 0.8) {
      bonusBlock = 3;
    } else {
      bonusHeal = 8;
    }
  }

  // lucky_coin (v2) — random buff each encounter start
  const luckyBuff: EncounterStartEffects['luckyBuff'] = relicIds.has('lucky_coin')
    ? LUCKY_BUFF_POOL[Math.floor(Math.random() * LUCKY_BUFF_POOL.length)]
    : null;

  return {
    bonusBlock,
    bonusHeal,
    bonusAP: relicIds.has('quicksilver') ? 1 : 0, // v1 legacy
    freeFirstCard: relicIds.has('double_vision'), // v1 legacy
    permanentForesight: relicIds.has('cartographers_lens'), // v1 legacy
    luckyBuff,
  };
}

// ─── Card Play / Attack ─────────────────────────────────────────────

/** Modifiers applied when playing an attack card. */
export interface AttackModifiers {
  /** Flat damage added to the attack (whetstone, barbed_edge, war_drum, memory_palace). */
  flatDamageBonus: number;
  /**
   * Percentage damage bonus as a multiplier offset (e.g. 0.5 = +50%).
   * Sources: flame_brand, berserker_band, glass_cannon, crescendo_blade, curiosity_gem, domain_mastery.
   */
  percentDamageBonus: number;
  /** Poison application from venom_fang; null if relic not held. */
  applyPoison: { value: number; turns: number } | null;
  /** Extra hits added to multi-hit attacks (chain_lightning_rod). */
  multiHitBonus: number;
  /** Override for execute threshold if executioners_axe is held (0.5 instead of default 0.3). */
  executeThresholdOverride: number | null;
}

/** Context required to resolve attack modifiers. */
export interface AttackContext {
  /** Whether this is the first attack played this encounter (flame_brand v1). */
  isFirstAttack: boolean;
  /** Whether the card's mechanic has the 'strike' tag (barbed_edge v1). */
  isStrikeTagged: boolean;
  /** Player's current HP as a fraction of max HP, 0..1 (reckless_resolve v2, berserker_band v1). */
  playerHpPercent: number;
  /** Number of consecutive correct attacks this encounter (crescendo_blade v1). */
  consecutiveCorrectAttacks: number;
  /** The card's tier: 'learning' | 'recall_a' | 'recall_b' | 'mastered'. */
  cardTier: string;
  /** Number of consecutive correct answers this encounter. */
  correctStreakThisEncounter: number;
  /** Enemy's current HP as a fraction of max HP, 0..1 (executioners_axe v1). */
  enemyHpPercent: number;
  /** Number of poison stacks on the enemy (festering_wound v2). */
  enemyPoisonStacks?: number;
  /**
   * The domain of the card being played (domain_mastery_sigil v2).
   * Used to check whether the card's domain has 4+ cards in the active deck.
   */
  cardDomain?: string;
  /**
   * Count of cards per domain in the active deck (draw + discard + hand, not exhaust).
   * Keyed by FactDomain string. Used by domain_mastery_sigil v2.
   */
  deckDomainCounts?: Record<string, number>;
}

/**
 * Resolve all attack-phase modifiers contributed by held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Situational context for the current attack.
 * @returns Computed attack modifiers.
 */
export function resolveAttackModifiers(
  relicIds: Set<string>,
  context: AttackContext,
): AttackModifiers {
  let flatDamageBonus = 0;
  let percentDamageBonus = 0;

  // whetstone — All attack cards +2 flat damage
  if (relicIds.has('whetstone')) {
    flatDamageBonus += 2;
  }

  // barbed_edge — Strike-tagged mechanics +2 base damage
  if (relicIds.has('barbed_edge') && context.isStrikeTagged) {
    flatDamageBonus += 2;
  }

  // memory_palace — 2 correct in a row: +4 damage to next attack
  if (relicIds.has('memory_palace') && context.correctStreakThisEncounter >= 2) {
    flatDamageBonus += 4;
  }

  // flame_brand — First attack each encounter +40% damage
  if (relicIds.has('flame_brand') && context.isFirstAttack) {
    percentDamageBonus += 0.4;
  }

  // berserker_band — Below 50% HP: attacks +40% damage
  if (relicIds.has('berserker_band') && context.playerHpPercent < 0.5) {
    percentDamageBonus += 0.4;
  }

  // glass_cannon — Attacks +35% damage (cursed: damage-taken side is in resolveDamageTakenEffects)
  if (relicIds.has('glass_cannon')) {
    percentDamageBonus += 0.35;
  }

  // crescendo_blade — Each consecutive correct attack: +10% damage (stacks)
  if (relicIds.has('crescendo_blade') && context.consecutiveCorrectAttacks > 0) {
    percentDamageBonus += 0.1 * context.consecutiveCorrectAttacks;
  }

  // Crescendo Executioner synergy: crescendo rate +10% → +15% per stack
  if (hasSynergy(relicIds, 'crescendo_executioner') && context.consecutiveCorrectAttacks > 0) {
    percentDamageBonus += 0.05 * context.consecutiveCorrectAttacks;
  }

  // curiosity_gem — Tier 1 (Learning) cards +15% effect
  if (relicIds.has('curiosity_gem') && context.cardTier === 'learning') {
    percentDamageBonus += 0.15;
  }

  // venom_fang — All attacks apply 2 poison for 3 turns
  const applyPoison = relicIds.has('venom_fang')
    ? { value: 2, turns: 3 }
    : null;

  // chain_lightning_rod — Multi-hit attacks get +2 extra hits
  const multiHitBonus = relicIds.has('chain_lightning_rod') ? 2 : 0;

  // executioners_axe — Execute threshold 50% instead of 30% (v1 legacy)
  const executeThresholdOverride = relicIds.has('executioners_axe') ? 0.5 : null;

  // executioners_axe — +5 flat damage when enemy below 30% HP (v1 legacy)
  if (relicIds.has('executioners_axe') && context.enemyHpPercent < 0.3) {
    flatDamageBonus += 5;
  }

  // Crescendo Executioner synergy: execute flat bonus doubled (+5 → +10) (v1 legacy)
  if (hasSynergy(relicIds, 'crescendo_executioner') && context.enemyHpPercent < 0.3) {
    flatDamageBonus += 5; // additional +5 on top of existing +5
  }

  // === V2 RELIC EFFECTS ===

  // reckless_resolve (v2) — Below 40% HP: +50%; Above 80% HP: -15%
  if (relicIds.has('reckless_resolve')) {
    if (context.playerHpPercent < 0.40) {
      percentDamageBonus += 0.50;
    } else if (context.playerHpPercent > 0.80) {
      percentDamageBonus -= 0.15;
    }
  }

  // volatile_core (v2) — All attacks +50% damage (cursed)
  if (relicIds.has('volatile_core')) {
    percentDamageBonus += 0.50;
  }

  // festering_wound (v2) — 3+ poison on enemy: +40% damage
  if (relicIds.has('festering_wound') && (context.enemyPoisonStacks ?? 0) >= 3) {
    percentDamageBonus += 0.40;
  }

  // domain_mastery_sigil (v2) — deck has 4+ cards of same domain: all same-domain cards +30% damage
  if (relicIds.has('domain_mastery_sigil') && context.cardDomain && context.deckDomainCounts) {
    const domainCount = context.deckDomainCounts[context.cardDomain] ?? 0;
    if (domainCount >= 4) {
      percentDamageBonus += 0.30;
    }
  }

  return {
    flatDamageBonus,
    percentDamageBonus,
    applyPoison,
    multiHitBonus,
    executeThresholdOverride,
  };
}

// ─── Shield / Block ─────────────────────────────────────────────────

/** Modifiers applied when playing a shield/block card. */
export interface ShieldModifiers {
  /** Flat block added to all shield cards (stone_wall). */
  flatBlockBonus: number;
  /** Damage dealt back to attacker when blocking (thorned_vest). */
  reflectDamage: number;
  /**
   * Percentage block bonus for Quick Play shield cards (bastions_will: +25%).
   * 0 if relic not held. Applied as a multiplier: shieldApplied *= 1 + quickPlayShieldBonus / 100.
   */
  quickPlayShieldBonus: number;
}

/**
 * Resolve shield-phase modifiers contributed by held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Computed shield modifiers.
 */
export function resolveShieldModifiers(relicIds: Set<string>): ShieldModifiers {
  return {
    flatBlockBonus: relicIds.has('stone_wall') ? 3 : 0,
    reflectDamage: relicIds.has('thorned_vest') ? 2 : 0,
    // bastions_will — +25% block on Quick Play shield cards
    quickPlayShieldBonus: relicIds.has('bastions_will') ? 25 : 0,
  };
}

// ─── Heal ───────────────────────────────────────────────────────────

/** Modifiers applied to heal effects. */
export interface HealModifiers {
  /** Percentage bonus to heal effectiveness (medic_kit: +20%). */
  percentBonus: number;
  /** Flat block granted when any heal occurs (medic_kit: +3). */
  blockOnHeal: number;
}

/**
 * Resolve heal modifiers contributed by held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Computed heal modifiers.
 */
export function resolveHealModifiers(relicIds: Set<string>): HealModifiers {
  return {
    percentBonus: relicIds.has('medic_kit') ? 0.20 : 0,
    blockOnHeal: relicIds.has('medic_kit') ? 3 : 0,
  };
}

// ─── Damage Taken ───────────────────────────────────────────────────

/** Effects that modify incoming damage to the player. */
export interface DamageTakenEffects {
  /** Flat damage reduction from all sources, minimum 1 damage dealt (steel_skin v2: -3; v1: -2). */
  flatReduction: number;
  /** Percentage increase to incoming damage (glass_cannon v1 cursed effect: +15%). */
  percentIncrease: number;
  /** Whether all block is boosted by +50% this hit (iron_resolve v1, below 40% HP). */
  blockDoubled: boolean;
  /** Probability of dodging the attack entirely (phase_cloak v1: 20%). */
  dodgeChance: number;
  /** Reflect a percentage of blocked damage back at attacker when any block absorbs damage (mirror_shield v1); null if not held. */
  reflectOnBlock: { percent: number } | null;
  /** Thorned vest reflect: 2 normally, 4 if player had no block (thorned_vest v1). */
  thornReflect: number;
  /** Percentage attack bonus when below HP threshold (iron_resolve v1: +25%). */
  lowHpAttackBonus: number;
  /**
   * Thorn Crown reflect (v2): deals 5 damage when attacked while holding 15+ block.
   * 0 if not applicable.
   */
  thornCrownReflect: number;
}

/** Context required to resolve damage-taken effects. */
export interface DamageTakenContext {
  /** Player's current HP as a fraction of max HP, 0..1. */
  playerHpPercent: number;
  /** Whether the player had any block before this hit. */
  hadBlock: boolean;
  /** Whether block absorbed any of the incoming damage (mirror_shield v1). */
  blockAbsorbedAll: boolean;
  /** Player's current block amount (thorn_crown v2: needs 15+ block). */
  currentBlock?: number;
}

/**
 * Resolve effects that modify how the player takes damage.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Situational context for the incoming damage.
 * @returns Computed damage-taken modifiers.
 */
export function resolveDamageTakenEffects(
  relicIds: Set<string>,
  context: DamageTakenContext,
): DamageTakenEffects {
  let thornReflect = 0;
  if (relicIds.has('thorned_vest')) {
    thornReflect = context.hadBlock ? 2 : 4; // v1 legacy
  }

  // thorn_crown (v2) — reflect 5 damage when attacked at 15+ block
  const thornCrownReflect =
    relicIds.has('thorn_crown') && (context.currentBlock ?? 0) >= 15 ? 5 : 0;

  // steel_skin: v2 value is -3; v1 was -2
  const flatReduction = relicIds.has('steel_skin') ? 3 : 0;

  return {
    flatReduction,
    percentIncrease: relicIds.has('glass_cannon') ? 0.10 : 0, // v1 legacy
    blockDoubled: relicIds.has('iron_resolve') && context.playerHpPercent < 0.50, // v1 legacy
    dodgeChance: relicIds.has('phase_cloak') ? 0.2 : 0, // v1 legacy
    reflectOnBlock:
      relicIds.has('mirror_shield') && context.hadBlock && context.blockAbsorbedAll
        ? { percent: 0.2 }
        : null, // v1 legacy
    thornReflect,
    lowHpAttackBonus: relicIds.has('iron_resolve') && context.playerHpPercent < 0.50 ? 0.25 : 0, // v1 legacy
    thornCrownReflect,
  };
}

// ─── Lethal ─────────────────────────────────────────────────────────

/** Effects that can save the player from a killing blow. */
export interface LethalSaveEffects {
  /** Whether last_breath triggers (once per encounter). */
  lastBreathSave: boolean;
  /** Block granted when last_breath triggers. */
  lastBreathBlock: number;
  /** Damage bonus granted when last_breath triggers. */
  lastBreathDamageBonus: number;
  /** Whether phoenix_feather triggers (once per encounter). */
  phoenixSave: boolean;
  /** HP to restore as a fraction of max HP when phoenix triggers. */
  phoenixHealPercent: number;
  /** Block granted when phoenix triggers. */
  phoenixBlock: number;
  /** Empower duration in turns when phoenix triggers. */
  phoenixEmpowerTurns: number;
  /** Whether Phoenix Rage synergy is active (grants +50% dmg and removes glass penalty). */
  phoenixRageActive: boolean;
}

/** Context required to resolve lethal-save effects. */
export interface LethalContext {
  /** Whether last_breath has already fired this encounter. */
  lastBreathUsedThisEncounter: boolean;
  /**
   * V2: Whether phoenix_feather has already fired this RUN (once/run).
   * V1 legacy: treated as per-encounter — pass false each encounter.
   */
  phoenixUsedThisRun: boolean;
  /** @deprecated Use phoenixUsedThisRun instead. V1 legacy field. */
  phoenixUsedThisEncounter?: boolean;
  /** Whether the current encounter is a boss encounter. */
  isBossEncounter: boolean;
}

/**
 * Resolve whether any relic can save the player from a killing blow.
 * Priority: last_breath first (encounter-scoped), then phoenix_feather (encounter-scoped).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Usage history for once-per-scope relics.
 * @returns Which lethal-save effects are available.
 */
export function resolveLethalEffects(
  relicIds: Set<string>,
  context: LethalContext,
): LethalSaveEffects {
  const lastBreathSave =
    relicIds.has('last_breath') && !context.lastBreathUsedThisEncounter;

  // Phoenix: v2 is once/run (phoenixUsedThisRun); v1 legacy falls back to phoenixUsedThisEncounter
  const phoenixAlreadyUsed = context.phoenixUsedThisRun ?? context.phoenixUsedThisEncounter ?? false;

  // Phoenix only fires if last_breath didn't already save
  const phoenixSave =
    !lastBreathSave &&
    relicIds.has('phoenix_feather') &&
    !phoenixAlreadyUsed;

  const phoenixRageActive = phoenixSave && hasSynergy(relicIds, 'phoenix_rage');

  return {
    lastBreathSave,
    lastBreathBlock: lastBreathSave ? 8 : 0,
    // v2: last_breath drops the +5 damage bonus
    lastBreathDamageBonus: 0,
    phoenixSave,
    // v2: resurrect at 15% HP (v1 was 30%); v2 grants autocharge turns instead of block+empower
    phoenixHealPercent: phoenixSave ? 0.15 : 0,
    phoenixBlock: 0, // v2: no block on phoenix (autocharge turns replace this)
    phoenixEmpowerTurns: 0, // v2: replaced by phoenix_autocharge_turns effect
    phoenixRageActive,
  };
}

// ─── Turn End ───────────────────────────────────────────────────────

/** Effects resolved at the end of each player turn. */
export interface TurnEndEffects {
  /** Whether block carries to the next turn instead of resetting (fortress_wall v1 / aegis_stone v2). */
  blockCarries: boolean;
  /** Maximum block that can carry between turns (aegis_stone v2: 15, fortress_wall v1: 20). */
  blockCarryMax: number;
  /** HP healed from blood_pact (25% of damage dealt this turn) — v1 legacy. */
  healFromDamage: number;
  /** Bonus cards to draw next turn from afterimage (v1 legacy) or resonance_crystal (v2). */
  bonusDrawNext: number;
  /** HP lost per turn from blood_price (v2: 2 HP/turn). */
  hpLoss: number;
  /** Bonus AP to grant next turn — v1 legacy placeholder. */
  bonusApFromAfterimage: number;
}

/** Context required to resolve turn-end effects. */
export interface TurnEndContext {
  /** Total damage dealt by the player during this turn (blood_pact v1). */
  damageDealtThisTurn: number;
  /** Number of cards played this turn (afterimage v1). */
  cardsPlayedThisTurn: number;
  /** Whether this was a perfect turn (all answers correct). */
  isPerfectTurn: boolean;
}

/**
 * Resolve effects that fire at the end of the player's turn.
 * Handles both v1 legacy relics and v2 relics that use this hook.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Turn summary data.
 * @returns Computed turn-end effects.
 */
export function resolveTurnEndEffects(
  relicIds: Set<string>,
  context: TurnEndContext,
): TurnEndEffects {
  const afterimageTriggers = relicIds.has('afterimage') && context.isPerfectTurn; // v1 legacy

  // v2: aegis_stone replaces fortress_wall with carry cap of 15
  const blockCarries = relicIds.has('aegis_stone') || relicIds.has('fortress_wall');
  const blockCarryMax = relicIds.has('aegis_stone')
    ? RELIC_AEGIS_STONE_MAX_CARRY
    : relicIds.has('fortress_wall')
      ? 20
      : Infinity;

  // blood_price v2: -2 HP/turn (v1 was -3)
  const hpLoss = relicIds.has('blood_price')
    ? (hasSynergy(relicIds, 'perpetual_motion') ? 1 : 2)
    : 0;

  return {
    blockCarries,
    blockCarryMax,
    healFromDamage: relicIds.has('blood_pact') // v1 legacy
      ? Math.floor(context.damageDealtThisTurn * (hasSynergy(relicIds, 'perpetual_motion') ? 0.50 : 0.25))
      : 0,
    bonusDrawNext: afterimageTriggers ? 1 : 0,
    hpLoss,
    bonusApFromAfterimage: 0,
  };
}

// ─── V2 Turn End Effects (Extended) ─────────────────────────────────

/** V2 extended turn-end effects for capacitor, overflow_gem, and regeneration_orb. */
export interface TurnEndEffectsV2 {
  /**
   * AP to store in capacitor for next turn (0 if capacitor not held).
   * Capped at RELIC_CAPACITOR_MAX_STORED_AP.
   */
  storedAP: number;
  /**
   * Overflow Gem bonus as percentage (75 = +75% to last card).
   * 0 if overflow_gem not held or AP threshold not met.
   */
  overflowGemBonus: number;
  /**
   * HP to heal from regeneration_orb.
   * 3 if regen_orb held and 2+ shield cards played; 0 otherwise.
   */
  shieldPlayHeal: number;
}

/** Context for V2 extended turn-end effects. */
export interface TurnEndContextV2 {
  /** AP used this turn (overflow_gem: needs 4+). */
  apUsed: number;
  /** AP remaining unspent at end of turn (capacitor storage). */
  apRemaining: number;
  /** Number of shield-type cards played this turn (regeneration_orb). */
  shieldCardsPlayed: number;
  /** ID of the last card played this turn (overflow_gem — for caller reference). */
  lastCardPlayedId: string | null;
}

/**
 * Resolve v2-specific turn-end effects (Capacitor, Overflow Gem, Regeneration Orb).
 * Call AFTER resolveTurnEndEffects to layer these on top.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - V2 turn-end context.
 * @returns V2 turn-end effect results.
 */
export function resolveTurnEndEffectsV2(
  relicIds: Set<string>,
  context: TurnEndContextV2,
): TurnEndEffectsV2 {
  // capacitor — store unused AP (capped at 3)
  const storedAP = relicIds.has('capacitor')
    ? Math.min(context.apRemaining, RELIC_CAPACITOR_MAX_STORED_AP)
    : 0;

  // overflow_gem — if 4+ AP spent, last card gets +75% effect
  const overflowGemBonus =
    relicIds.has('overflow_gem') && context.apUsed >= 4 ? 75 : 0;

  // regeneration_orb — heal 3 HP if 2+ shield cards played this turn
  const shieldPlayHeal =
    relicIds.has('regeneration_orb') && context.shieldCardsPlayed >= 2 ? 3 : 0;

  return { storedAP, overflowGemBonus, shieldPlayHeal };
}

// ─── Perfect Turn ───────────────────────────────────────────────────

/**
 * Resolve bonus AP from a perfect turn (all answers correct).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus AP to grant next turn (momentum_gem: +1).
 */
export function resolvePerfectTurnBonus(relicIds: Set<string>): number {
  return relicIds.has('momentum_gem') ? 1 : 0;
}

// ─── Correct Answer ─────────────────────────────────────────────────

/** Effects resolved when the player answers a quiz question correctly. */
export interface CorrectAnswerEffects {
  /** HP healed per correct answer (scholars_hat: +3). */
  healHp: number;
  /** Bonus damage to next attack from scholars_hat (+2 on correct). */
  bonusDamage: number;
  /** Bonus damage to next attack from memory_palace (+4 after 2 correct in a row). */
  memoryPalaceBonus: number;
}

/** Context required to resolve correct-answer effects. */
export interface CorrectAnswerContext {
  /** Number of consecutive correct answers in this encounter. */
  correctStreakThisEncounter: number;
}

/**
 * Resolve effects that fire on a correct quiz answer.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Current correct-answer streak data.
 * @returns Computed correct-answer effects.
 */
export function resolveCorrectAnswerEffects(
  relicIds: Set<string>,
  context: CorrectAnswerContext,
): CorrectAnswerEffects {
  return {
    healHp: relicIds.has('scholars_hat') ? (hasSynergy(relicIds, 'knowledge_engine') ? 5 : 3) : 0,
    bonusDamage: relicIds.has('scholars_hat') ? 2 : 0,
    memoryPalaceBonus:
      relicIds.has('memory_palace') && context.correctStreakThisEncounter >= 2
        ? 4
        : 0,
  };
}

/** Effects resolved when the player answers a quiz question incorrectly. */
export interface WrongAnswerEffects {
  /** HP healed per wrong answer (scholars_hat: +1). */
  healHp: number;
  /**
   * Self-damage dealt when answering a Charged card wrong (scholars_gambit: 3 damage, bypasses block).
   * 0 if Scholar's Gambit not held or the card was not Charged.
   */
  scholarGambitSelfDamage: number;
}

/** Context required to resolve wrong-answer effects. */
export interface WrongAnswerContext {
  /** Whether the card that was answered was a Charged card type (scholars_gambit). */
  wasChargedCard?: boolean;
}

/**
 * Resolve effects that fire on a wrong quiz answer.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Optional context for situational effects (e.g. charged card type).
 * @returns Computed wrong-answer effects.
 */
export function resolveWrongAnswerEffects(
  relicIds: Set<string>,
  context?: WrongAnswerContext,
): WrongAnswerEffects {
  // Scholar's Gambit: wrong Charged answers deal 3 self-damage (bypasses block)
  const scholarGambitSelfDamage =
    relicIds.has('scholars_gambit') && (context?.wasChargedCard ?? false) ? 3 : 0;
  return {
    healHp: relicIds.has('scholars_hat') ? 1 : 0,
    scholarGambitSelfDamage,
  };
}

// ─── Domain Mastery ─────────────────────────────────────────────────

/**
 * Check whether the domain_mastery_sigil relic is active for a given card.
 *
 * Returns +0.30 (+30%) if the player holds domain_mastery_sigil AND the card's
 * domain has 4 or more cards in the active deck (draw + discard + hand).
 * Returns 0 otherwise.
 *
 * The primary application path is via resolveAttackModifiers (AttackContext.cardDomain
 * + AttackContext.deckDomainCounts). This helper is retained for callers that need
 * a standalone check outside of the attack modifier pipeline.
 *
 * @param relicIds        - Set of relic IDs the player currently holds.
 * @param cardDomain      - The domain of the card being played.
 * @param deckDomainCounts - Count of cards per domain in the active deck.
 * @returns Percentage bonus multiplier (0.30 = +30%, 0 = no bonus).
 */
export function resolveDomainMasteryBonus(
  relicIds: Set<string>,
  cardDomain: string,
  deckDomainCounts: Record<string, number>,
): number {
  if (!relicIds.has('domain_mastery_sigil')) return 0;
  return (deckDomainCounts[cardDomain] ?? 0) >= 4 ? 0.30 : 0;
}

// ─── Card Skip ──────────────────────────────────────────────────────

/**
 * Resolve bonus currency from skipping a card.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus currency per skipped card (scavengers_pouch: +2).
 */
export function resolveCardSkipCurrency(relicIds: Set<string>): number {
  return relicIds.has('scavengers_pouch') ? 2 : 0;
}

// ─── Floor Advance ──────────────────────────────────────────────────

/** Effects resolved when advancing to the next floor. */
export interface FloorAdvanceEffects {
  /** HP to heal on floor advance (renewal_spring: 15% max HP). */
  healHp: number;
  /** Block to grant on floor advance (renewal_spring: 5 block if above 80% HP). */
  bonusBlock: number;
}

/**
 * Resolve effects when advancing to the next floor.
 *
 * @param relicIds      - Set of relic IDs the player currently holds.
 * @param maxHP         - Player's maximum HP (renewal_spring heals 15%).
 * @param currentHpPercent - Player's current HP as a fraction of max HP, 0..1.
 * @returns Floor advance effects.
 */
export function resolveFloorAdvanceHeal(
  relicIds: Set<string>,
  maxHP: number,
  currentHpPercent?: number,
): FloorAdvanceEffects {
  if (!relicIds.has('renewal_spring')) {
    return { healHp: 0, bonusBlock: 0 };
  }
  const healHp = Math.floor(maxHP * 0.15);
  const bonusBlock = (currentHpPercent ?? 0) > 0.8 ? 5 : 0;
  return { healHp, bonusBlock };
}

// ─── Encounter End ──────────────────────────────────────────────────

/**
 * Resolve flat bonus currency gained at the end of each encounter.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus currency per encounter (lucky_coin: +2).
 */
export function resolveEncounterEndCurrency(relicIds: Set<string>): number {
  return relicIds.has('lucky_coin') ? 2 : 0;
}

// ─── Draw Count ─────────────────────────────────────────────────────

/**
 * Resolve the base number of cards drawn per turn.
 * Default is 5; modified by swift_boots (+1) and blood_price (+2).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Number of cards to draw at the start of each turn.
 */
export function resolveBaseDrawCount(relicIds: Set<string>): number {
  let count = 5;
  if (relicIds.has('swift_boots')) count = 6;
  if (relicIds.has('blood_price')) count += 2;
  return count;
}

// ─── Speed Bonus ────────────────────────────────────────────────────

/**
 * Resolve the speed bonus multiplier granted for fast answers.
 * Default is 1.5x (+50%); sharp_eye upgrades it to 1.75x (+75%);
 * speed_demon synergy (2 of speed_reader/sharp_eye/speed_charm) upgrades to 2.25x.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Speed bonus multiplier.
 */
export function resolveSpeedBonusMultiplier(relicIds: Set<string>): number {
  if (hasSynergy(relicIds, 'speed_demon')) return 2.25;
  return relicIds.has('sharp_eye') ? 1.75 : 1.5;
}

// ─── Speed Bonus Threshold ──────────────────────────────────────────

/**
 * Resolve the timer percentage at which the speed bonus activates.
 * Default is 25% of timer remaining; individual relics change it; speed_demon synergy sets to 40%.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Speed bonus threshold as a fraction (0.40 for synergy, 0.20-0.35 for individual).
 */
export function resolveSpeedBonusThreshold(relicIds: Set<string>): number {
  if (hasSynergy(relicIds, 'speed_demon')) return 0.40;
  if (relicIds.has('speed_reader')) return 0.20;
  if (relicIds.has('sharp_eye')) return 0.35;
  if (relicIds.has('speed_charm')) return 0.35;
  return 0.25;
}

// ─── Timer ──────────────────────────────────────────────────────────

/**
 * Resolve bonus seconds added to the quiz timer.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus seconds (time_dilation: +3).
 */
export function resolveTimerBonus(relicIds: Set<string>): number {
  return relicIds.has('time_dilation') ? 3 : 0;
}

// ─── Max HP Bonus (Run Start) ───────────────────────────────────────

/**
 * Resolve bonus max HP applied at run start.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus max HP (vitality_ring: +20).
 */
export function resolveMaxHpBonus(relicIds: Set<string>): number {
  return relicIds.has('vitality_ring') ? 20 : 0;
}

// ─── Card Reward Options ────────────────────────────────────────────

/**
 * Resolve the number of card options shown at post-encounter rewards.
 * Default is 3; prospectors_pick upgrades to 4.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Number of card reward options to display.
 */
export function resolveCardRewardOptionCount(relicIds: Set<string>): number {
  return relicIds.has('prospectors_pick') ? 4 : 3;
}

// ─── Currency Bonus ─────────────────────────────────────────────────

/**
 * Resolve the percentage bonus to currency earned from encounters.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Currency bonus as a fraction (gold_magnet: 0.25 = +25%).
 */
export function resolveCurrencyBonus(relicIds: Set<string>): number {
  return relicIds.has('gold_magnet') ? 0.25 : 0;
}

// ─── Run-End Currency Conversion ────────────────────────────────────

/**
 * Resolve the fraction of leftover currency converted to mastery coins at run end.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Conversion fraction (miser_ring: 0.10 = 10%).
 */
export function resolveRunEndCurrencyConversion(relicIds: Set<string>): number {
  return relicIds.has('miser_ring') ? 0.1 : 0;
}

// ─── Encounter End ──────────────────────────────────────────────────

/** Effects resolved at the end of each combat encounter. */
export interface EncounterEndEffects {
  /** HP healed post-combat (herbal_pouch v2: always 8 HP). */
  healHp: number;
}

/**
 * Resolve effects that fire at the end of a combat encounter (after victory).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Encounter-end effects.
 */
export function resolveEncounterEndEffects(relicIds: Set<string>): EncounterEndEffects {
  // herbal_pouch v2: always heal 8 HP post-combat (v1 healed on encounter start with condition)
  const healHp = relicIds.has('herbal_pouch') ? 8 : 0;
  return { healHp };
}

// ─── V2 Charge Correct Effects ──────────────────────────────────────

/** Effects from relics that fire when a Charged quiz is answered correctly. */
export interface ChargeCorrectEffects {
  /** Extra damage multiplier from fast answers (quicksilver_quill: ×1.5). 1.0 = no bonus. */
  extraMultiplier: number;
  /** AP refunded from fast correct charge (adrenaline_shard: 1 AP, once/turn). */
  apRefund: number;
  /**
   * Bonus cards to draw next turn (memory_nexus: 2 cards on 3rd cumulative charge in encounter).
   * 0 if threshold not yet reached.
   */
  drawBonus: number;
  /**
   * Whether a critical hit was rolled (crit_lens: 25% chance).
   * If true, caller should double final damage after all other multipliers.
   */
  isCrit: boolean;
  /**
   * Extra block percentage for a shield card Charge (bastions_will: +75%).
   * 0 if not a shield card or relic not held.
   */
  shieldBonus: number;
  /**
   * Scholar's Crown bonus for tier 1/2/3 facts.
   * 0 = no bonus, 10 = +10% (tier 1), 40 = +40% (tier 2+), 75 = +75% (tier 3 auto-Charged).
   */
  scholarsCrownBonus: number;
  /**
   * Mirror of Knowledge replay flag: true if relic is held, not yet used this encounter,
   * and player may activate it. Caller decides whether to consume the use.
   */
  mirrorAvailable: boolean;
}

/** Context required for resolveChargeCorrectEffects. */
export interface ChargeCorrectContext {
  /** Time taken to answer in milliseconds. */
  answerTimeMs: number;
  /** SM-2 tier of the fact: 1 = learning, 2 = recall, 3 = mastered. */
  cardTier: number;
  /** Whether the charged card is a shield type (bastions_will). */
  cardType: 'attack' | 'shield' | 'utility';
  /** Whether this is the first Charged correct answer this turn. */
  isFirstChargeThisTurn: boolean;
  /** Cumulative count of correctly Charged cards in this encounter (memory_nexus). */
  chargeCountThisEncounter: number;
  /** Whether mirror_of_knowledge has already been used this encounter. */
  mirrorUsedThisEncounter: boolean;
  /** Whether the adrenaline_shard has already refunded AP this turn. */
  adrenalineShard_usedThisTurn: boolean;
}

/**
 * Resolve all effects that fire when a Charged quiz is answered correctly.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Context for the Charged correct answer.
 * @returns Computed charge-correct effects.
 */
export function resolveChargeCorrectEffects(
  relicIds: Set<string>,
  context: ChargeCorrectContext,
): ChargeCorrectEffects {
  let extraMultiplier = 1.0;
  let apRefund = 0;
  let drawBonus = 0;
  let shieldBonus = 0;
  let scholarsCrownBonus = 0;

  // quicksilver_quill — fast charge (<2s) gets ×1.5 additional multiplier
  if (relicIds.has('quicksilver_quill') && context.answerTimeMs < RELIC_QUICKSILVER_QUILL_FAST_MS) {
    extraMultiplier *= 1.5;
  }

  // adrenaline_shard — fast correct Charge (<3s) refunds 1 AP, once/turn
  if (
    relicIds.has('adrenaline_shard') &&
    context.answerTimeMs < RELIC_ADRENALINE_SHARD_FAST_MS &&
    !context.adrenalineShard_usedThisTurn
  ) {
    apRefund = 1;
  }

  // memory_nexus — 3rd cumulative Charged correct in encounter draws 2 extra next turn
  if (
    relicIds.has('memory_nexus') &&
    context.chargeCountThisEncounter >= 3 &&
    (context.chargeCountThisEncounter - 1) < 3 // only triggers exactly on the 3rd
  ) {
    drawBonus = 2;
  }

  // crit_lens — 25% crit chance doubles final damage
  const isCrit = relicIds.has('crit_lens') && Math.random() < 0.25;

  // bastions_will — +75% block for Charged shield cards
  if (relicIds.has('bastions_will') && context.cardType === 'shield') {
    shieldBonus = 75;
  }

  // scholars_crown — tier bonus
  if (relicIds.has('scholars_crown')) {
    if (context.cardTier >= 3) {
      scholarsCrownBonus = 75;
    } else if (context.cardTier >= 2) {
      scholarsCrownBonus = 40;
    } else if (context.cardTier >= 1) {
      scholarsCrownBonus = 10;
    }
  }

  // mirror_of_knowledge — available if not yet used this encounter
  const mirrorAvailable = relicIds.has('mirror_of_knowledge') && !context.mirrorUsedThisEncounter;

  return {
    extraMultiplier,
    apRefund,
    drawBonus,
    isCrit,
    shieldBonus,
    scholarsCrownBonus,
    mirrorAvailable,
  };
}

// ─── V2 Charge Wrong Effects ────────────────────────────────────────

/** Effects from relics that fire when a Charged quiz is answered incorrectly. */
export interface ChargeWrongEffects {
  /** Self-damage dealt (bypasses block). Sum of volatile_core (3) + scholars_gambit (3). */
  selfDamage: number;
  /** Enemy damage dealt (volatile_core: 3). */
  enemyDamage: number;
  /**
   * Whether insight_prism stored this fact for auto-success on next appearance.
   * If true, caller adds factId to insightPrismAutosucceedIds run state.
   */
  revealAndAutopass: boolean;
}

/** Context for resolveChargeWrongEffects. */
export interface ChargeWrongContext {
  /** ID of the fact that was answered incorrectly (insight_prism). */
  factId: string;
}

/**
 * Resolve all effects that fire when a Charged quiz is answered incorrectly.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Context for the wrong Charged answer.
 * @returns Computed charge-wrong effects.
 */
export function resolveChargeWrongEffects(
  relicIds: Set<string>,
  context: ChargeWrongContext,
): ChargeWrongEffects {
  let selfDamage = 0;
  let enemyDamage = 0;

  // volatile_core — wrong Charge deals 3 to self AND 3 to enemy
  if (relicIds.has('volatile_core')) {
    selfDamage += 3;
    enemyDamage += 3;
  }

  // scholars_gambit — wrong Charge deals 3 self-damage (bypasses block)
  if (relicIds.has('scholars_gambit')) {
    selfDamage += 3;
  }

  // insight_prism — reveal answer and auto-succeed next appearance
  const revealAndAutopass = relicIds.has('insight_prism');

  void context; // factId used by caller to update run state

  return { selfDamage, enemyDamage, revealAndAutopass };
}

// ─── V2 Chain Complete Effects ──────────────────────────────────────

/** Effects from relics that fire when a Knowledge Chain completes. */
export interface ChainCompleteEffects {
  /**
   * Splash damage per chain link (chain_reactor: 6 per link when chainLength >= 2).
   * Total splash = splashPerLink × chainLength. 0 if below minimum.
   */
  splashPerLink: number;
  /** Total splash damage (convenience: splashPerLink × chainLength). */
  totalSplashDamage: number;
  /** Bonus cards to draw at end of turn (resonance_crystal: chainLength - 2, when chainLength >= 3). */
  drawBonus: number;
}

/** Context for resolveChainCompleteEffects. */
export interface ChainCompleteContext {
  /** Number of links in the completed chain. */
  chainLength: number;
  /** ID of the first card in the chain. */
  firstCardId: string;
}

/**
 * Resolve effects that fire when a Knowledge Chain completes.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Chain completion context.
 * @returns Computed chain-complete effects.
 */
export function resolveChainCompleteEffects(
  relicIds: Set<string>,
  context: ChainCompleteContext,
): ChainCompleteEffects {
  const { chainLength } = context;

  // chain_reactor — 6 splash damage per link, minimum chain of 2
  const splashPerLink =
    relicIds.has('chain_reactor') && chainLength >= 2 ? 6 : 0;
  const totalSplashDamage = splashPerLink * chainLength;

  // resonance_crystal — +1 draw per chain link beyond 2 (chainLength - 2 draws)
  const drawBonus =
    relicIds.has('resonance_crystal') && chainLength > 2 ? chainLength - 2 : 0;

  return { splashPerLink, totalSplashDamage, drawBonus };
}

// ─── Prismatic Shard — Chain Multiplier Bonus ───────────────────────

/**
 * Returns the flat bonus to add to the chain multiplier when prismatic_shard is held.
 *
 * Usage: `const finalChainMultiplier = baseChainMultiplier + resolveChainMultiplierBonus(relicIds)`
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns 0.5 if prismatic_shard is held, 0 otherwise.
 */
export function resolveChainMultiplierBonus(relicIds: Set<string>): number {
  return relicIds.has('prismatic_shard') ? 0.5 : 0;
}

/**
 * Returns the AP bonus granted by prismatic_shard on a 5+ chain completion.
 *
 * @param relicIds   - Set of relic IDs the player currently holds.
 * @param chainLength - The current chain length after extending.
 * @returns 1 if prismatic_shard is held AND chainLength >= 5, else 0.
 */
export function resolvePrismaticShardApBonus(relicIds: Set<string>, chainLength: number): number {
  return relicIds.has('prismatic_shard') && chainLength >= 5 ? 1 : 0;
}

// ─── Tag Magnet — Draw Bias ──────────────────────────────────────────

/** Result of resolveDrawBias for tag_magnet. */
export interface DrawBiasEffect {
  /** The chainType index to bias toward, or null if no bias should be applied. */
  biasChainType: number | null;
  /** The probability (0–1) of swapping a drawn card toward biasChainType. */
  biasChance: number;
}

/**
 * Resolves draw bias effects for tag_magnet.
 *
 * When tag_magnet is held, each drawn card has a 30% chance of being swapped
 * with a same-chainType card from the draw pile (if one exists).
 * Call after a card is played to get the bias parameters for the next draw.
 *
 * TODO: Wire this into drawHand() in deckManager.ts — pass biasChainType and biasChance
 * as draw options so the draw loop can apply the swap logic.
 *
 * @param relicIds          - Set of relic IDs the player currently holds.
 * @param lastPlayedChainType - The chainType of the last card played (undefined = no bias).
 * @returns Draw bias parameters for the next hand draw.
 */
export function resolveDrawBias(
  relicIds: Set<string>,
  lastPlayedChainType?: number,
): DrawBiasEffect {
  if (!relicIds.has('tag_magnet') || lastPlayedChainType === undefined) {
    return { biasChainType: null, biasChance: 0 };
  }
  return { biasChainType: lastPlayedChainType, biasChance: 0.30 };
}

// ─── Plague Flask — Poison Tick Bonus ───────────────────────────────

/**
 * Returns the bonus flat damage added to each poison tick when plague_flask is held.
 *
 * Usage: `const tickDamage = poisonStackValue + resolvePoisonTickBonus(relicIds)`
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns 2 if plague_flask is held, 0 otherwise.
 */
export function resolvePoisonTickBonus(relicIds: Set<string>): number {
  return relicIds.has('plague_flask') ? 2 : 0;
}

/**
 * Returns the extra turns added to poison duration on application when plague_flask is held.
 *
 * Usage: `const turns = baseTurns + resolvePoisonDurationBonus(relicIds)`
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns 1 if plague_flask is held, 0 otherwise.
 */
export function resolvePoisonDurationBonus(relicIds: Set<string>): number {
  return relicIds.has('plague_flask') ? 1 : 0;
}

// ─── Double Down — High-Stakes Charge Multiplier ────────────────────

/** Result of resolveDoubleDownBonus. */
export interface DoubleDownEffect {
  /** Whether the double_down bonus is active for this charge. */
  active: boolean;
  /**
   * Damage multiplier to apply after all other charge modifiers.
   * Correct answer → 5.0×. Wrong answer → 0.3×. Inactive → 1.0×.
   */
  damageMultiplier: number;
}

/**
 * Resolves the double_down relic bonus for a Charge attempt (correct OR wrong).
 *
 * Once per encounter, double_down raises the stakes on a Charge:
 *   - Correct answer: 5.0× damage (high reward)
 *   - Wrong answer:   0.3× damage (heavy penalty)
 *
 * The caller must set doubleDownUsedThisEncounter = true after consuming this bonus
 * regardless of whether the answer was correct or wrong.
 *
 * @param relicIds            - Set of relic IDs the player currently holds.
 * @param usedThisEncounter   - Whether double_down was already consumed this encounter.
 * @param correct             - Whether the player answered correctly.
 * @returns Active flag and damage multiplier.
 */
export function resolveDoubleDownBonus(
  relicIds: Set<string>,
  usedThisEncounter: boolean,
  correct: boolean,
): DoubleDownEffect {
  if (!relicIds.has('double_down') || usedThisEncounter) {
    return { active: false, damageMultiplier: 1 };
  }
  return { active: true, damageMultiplier: correct ? 5.0 : 0.3 };
}

// ─── V2 Surge Start Effects ─────────────────────────────────────────

/** Effects from relics that fire at the start of a Knowledge Surge turn. */
export interface SurgeStartEffects {
  /**
   * Timer multiplier for quiz during surge (time_warp: 0.5 = half duration).
   * 1.0 = no change.
   */
  timerMultiplier: number;
  /**
   * Override for the Charge multiplier during surge (time_warp: 5.0×).
   * null = no override (use normal Charge multiplier).
   */
  chargeMultiplierOverride: number | null;
  /**
   * Bonus AP granted at start of surge turn (time_warp: +1).
   * 0 = no bonus.
   */
  bonusAP: number;
}

/**
 * Resolve effects that fire at the start of a Knowledge Surge turn.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Surge-start effects.
 */
export function resolveSurgeStartEffects(relicIds: Set<string>): SurgeStartEffects {
  if (relicIds.has('time_warp')) {
    return { timerMultiplier: 0.5, chargeMultiplierOverride: 5.0, bonusAP: 1 };
  }
  return { timerMultiplier: 1.0, chargeMultiplierOverride: null, bonusAP: 0 };
}

// ─── V2 Currency Bonus (Updated) ────────────────────────────────────

/**
 * Resolve the percentage bonus to currency earned from encounters.
 * V2: gold_magnet gives +30% (v1 was +25%).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Currency bonus as a fraction (gold_magnet v2: 0.30 = +30%).
 */
export function resolveCurrencyBonusV2(relicIds: Set<string>): number {
  return relicIds.has('gold_magnet') ? 0.30 : 0;
}

// ─── V2 Card Reward Options (Updated) ───────────────────────────────

/**
 * Resolve the number of card options shown at post-encounter rewards.
 * V2: scavengers_eye gives 4 choices (replaces prospectors_pick).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Number of card reward options to display.
 */
export function resolveCardRewardOptionCountV2(relicIds: Set<string>): number {
  // scavengers_eye (v2) or prospectors_pick (v1 legacy) both give +1 option
  if (relicIds.has('scavengers_eye') || relicIds.has('prospectors_pick')) return 4;
  return 3;
}

// ─── V2 Max HP Bonus (Updated) ──────────────────────────────────────

/**
 * Resolve bonus max HP applied at run start.
 * V2: vitality_ring gives +20 HP (v1 was +15).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus max HP.
 */
export function resolveMaxHpBonusV2(relicIds: Set<string>): number {
  return relicIds.has('vitality_ring') ? 20 : 0;
}
