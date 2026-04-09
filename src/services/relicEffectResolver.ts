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
import { playCardAudio } from './cardAudioManager';
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
  /** Block granted at start of each turn (iron_shield v2: +5; iron_buckler v1: +5). */
  bonusBlock: number;
  /** Bonus AP released from Capacitor stored charge this turn. */
  capacitorReleasedAP: number;
  /** Bonus AP added to base AP each turn (blood_price v2: +1; paradox_engine legendary: +1). */
  bonusAP: number;
  /** Extra draw count from pocket_watch (fires on turns 1 and 5). */
  pocketWatchDrawBonus: number;
  /**
   * Deja Vu card spawn on turn 1 of encounter.
   * count: number of cards to add from discard (1 normally, 2 at level 15+).
   * apCostReduction: AP cost reduction for each spawned card this turn.
   * null if deja_vu not held or not turn 1 or already used this encounter.
   */
  dejaVuCardSpawn: { count: number; apCostReduction: number } | null;
  /** Bonus cards to draw from overclocked_mind (+2 draw per turn). */
  bonusCardDraw?: number;
  /**
   * Maximum AP reduction from berserkers_focus (-1 max AP per turn, min 1).
   * 0 if relic not held.
   */
  maxApReduction?: number;
  /**
   * AP modifier from domain_mastery_sigil based on Knowledge Aura state.
   * +1 in Flow State, -1 in Brain Fog, 0 in Neutral.
   * Applied in addition to bonusAP; caller enforces AP min/max caps.
   */
  auraApModifier?: number;
  /**
   * Poison stacks to apply to all enemies at turn start (herbal_pouch v3: 1 stack/turn).
   * 0 if herbal_pouch not held.
   */
  poisonToAllEnemies?: number;
}

/**
 * Context for resolveTurnStartEffects.
 */
export interface TurnStartContext {
  /** Current turn number within the encounter (1-indexed). */
  turnNumberThisEncounter: number;
  /** Player's character level (for deja_vu level-15+ scaling). */
  characterLevel: number;
  /** Whether Deja Vu has already been used this encounter. */
  dejaVuUsedThisEncounter: boolean;
  /**
   * Current Knowledge Aura state (domain_mastery_sigil v3: AP modifier).
   * 'brain_fog' | 'neutral' | 'flow_state'. Optional; ignored if domain_mastery_sigil not held.
   */
  auraState?: 'brain_fog' | 'neutral' | 'flow_state';
  /**
   * Number of shield cards played on the PREVIOUS turn (iron_shield v3: bonusBlock = 2 + this value).
   * Undefined on first turn of encounter (treated as 0).
   */
  shieldsPlayedLastTurn?: number;
}

/**
 * Resolve effects that fire at the start of every player turn.
 *
 * @param relicIds       - Set of relic IDs the player currently holds.
 * @param capacitorStored - AP stored by capacitor from last turn (0 if no capacitor).
 * @param context        - Optional situational context for conditional effects.
 * @returns Computed turn-start bonuses.
 */
export function resolveTurnStartEffects(
  relicIds: Set<string>,
  capacitorStored: number = 0,
  context?: TurnStartContext,
): TurnStartEffects {
  // iron_shield (v3, 2 + shieldsPlayedLastTurn) replaces iron_buckler (v1, +5)
  const shieldsLastTurn = context?.shieldsPlayedLastTurn ?? 0;
  const bonusBlock =
    relicIds.has('iron_shield') ? 2 + shieldsLastTurn :
    relicIds.has('iron_buckler') ? 5 : // v1 legacy fallback
    0;

  // capacitor releases stored AP at turn start
  const capacitorReleasedAP =
    relicIds.has('capacitor') ? Math.min(capacitorStored, RELIC_CAPACITOR_MAX_STORED_AP) : 0;

  // blood_price (v2) — grants +1 AP per turn in exchange for 2 HP/turn loss
  // paradox_engine (legendary) — unconditional +1 AP per turn
  let bonusAP = 0;
  if (relicIds.has('blood_price')) bonusAP += 1;
  if (relicIds.has('paradox_engine')) bonusAP += 1;

  // pocket_watch — +1 draw on turns 1 and 5 of each encounter
  let pocketWatchDrawBonus = 0;
  if (
    relicIds.has('pocket_watch') &&
    context &&
    (context.turnNumberThisEncounter === 1 || context.turnNumberThisEncounter === 5)
  ) {
    pocketWatchDrawBonus = 1;
  }

  // deja_vu — on turn 1 of encounter, spawn 1 card from discard (2 at level 15+)
  let dejaVuCardSpawn: TurnStartEffects['dejaVuCardSpawn'] = null;
  if (
    relicIds.has('deja_vu') &&
    context &&
    context.turnNumberThisEncounter === 1 &&
    !context.dejaVuUsedThisEncounter
  ) {
    const count = context.characterLevel >= 15 ? 2 : 1;
    dejaVuCardSpawn = { count, apCostReduction: 1 };
  }

  // overclocked_mind — draw 2 extra cards per turn (turn-end discard handled in resolveTurnEndEffects)
  let bonusCardDraw: number | undefined;
  if (relicIds.has('overclocked_mind')) {
    bonusCardDraw = 2;
  }

  // berserkers_focus — max AP reduced by 1 per turn (minimum 1 AP)
  let maxApReduction: number | undefined;
  if (relicIds.has('berserkers_focus')) {
    maxApReduction = 1;
  }

  // herbal_pouch (v3) — apply 1 Poison to all enemies at turn start
  const poisonToAllEnemies = relicIds.has('herbal_pouch') ? 1 : 0;

  // domain_mastery_sigil (v3) — +1 AP in Flow State, -1 AP in Brain Fog
  let auraApModifier: number | undefined;
  if (relicIds.has('domain_mastery_sigil') && context?.auraState) {
    if (context.auraState === 'flow_state') {
      auraApModifier = 1;
    } else if (context.auraState === 'brain_fog') {
      auraApModifier = -1;
    } else {
      auraApModifier = 0;
    }
  }

  // Audio: fire once if any turn-start relic produced a non-zero effect
  const relicFired = bonusBlock > 0 || capacitorReleasedAP > 0 || bonusAP > 0;
  if (relicFired) playCardAudio('relic-trigger');
  if (dejaVuCardSpawn) playCardAudio('relic-card-spawn');

  return { bonusBlock, capacitorReleasedAP, bonusAP, pocketWatchDrawBonus, dejaVuCardSpawn, bonusCardDraw, maxApReduction, auraApModifier, poisonToAllEnemies };
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
   * Random buff from lucky_coin (v2 legacy — v3 reworked to on_charge_wrong safety net).
   * Always null in v3. Field kept for backwards compatibility.
   * @deprecated lucky_coin v3 fires on wrong Charges, not encounter start.
   */
  luckyBuff: 'empower' | 'block_2' | 'ap_1' | 'draw_1' | null;
  /**
   * Percentage bonus to the FIRST attack this encounter (red_fang: +30%).
   * Caller applies this only to the first attack card played in the encounter.
   */
  firstAttackDamageBonus: number;
  /**
   * Temporary Strength bonus from gladiator_s_mark (+1 Strength for 3 turns).
   * null if relic not held; caller applies this as a timed buff.
   */
  tempStrengthBonus: { amount: number; durationTurns: number } | null;
  /**
   * Starting block from hollow_armor: +20 block at encounter start.
   * 0 if hollow_armor not held. Note: block gain is disabled after turn 0 (see resolveShieldModifiers).
   */
  startingBlock?: number;
}

/** @deprecated lucky_coin v3 no longer uses a buff pool (moved to on_charge_wrong). */
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

  // lucky_coin (v3) — effect moved to resolveChargeWrongEffects (safety net after 3 wrong Charges).
  // Encounter start no longer triggers lucky_coin.
  const luckyBuff: EncounterStartEffects['luckyBuff'] = null;
  void LUCKY_BUFF_POOL; // suppress unused warning

  // red_fang — first attack each encounter +30% damage (informational; caller applies to first attack only)
  const firstAttackDamageBonus = relicIds.has('red_fang') ? 0.30 : 0;

  // gladiator_s_mark — +1 Strength for 3 turns at encounter start
  const tempStrengthBonus = relicIds.has('gladiator_s_mark')
    ? { amount: 1, durationTurns: 3 }
    : null;

  // hollow_armor — +20 starting block (block gain disabled after turn 0)
  const startingBlock = relicIds.has('hollow_armor') ? 20 : undefined;

  // Audio: fire if any encounter-start relic produced a non-zero effect
  const encounterRelicFired =
    bonusBlock > 0 ||
    bonusHeal > 0 ||
    relicIds.has('quicksilver') ||
    relicIds.has('double_vision') ||
    luckyBuff !== null ||
    firstAttackDamageBonus > 0 ||
    tempStrengthBonus !== null ||
    startingBlock !== undefined;
  if (encounterRelicFired) playCardAudio('relic-trigger');

  return {
    bonusBlock,
    bonusHeal,
    bonusAP: relicIds.has('quicksilver') ? 1 : 0, // v1 legacy
    freeFirstCard: relicIds.has('double_vision'), // v1 legacy
    permanentForesight: relicIds.has('cartographers_lens'), // v1 legacy
    luckyBuff,
    firstAttackDamageBonus,
    tempStrengthBonus,
    startingBlock,
  };
}

// ─── Card Play / Attack ─────────────────────────────────────────────

/** Modifiers applied when playing an attack card. */
export interface AttackModifiers {
  /** Flat damage added to the attack (whetstone, barbed_edge, war_drum, memory_palace). */
  flatDamageBonus: number;
  /**
   * Percentage damage bonus as a multiplier offset (e.g. 0.5 = +50%).
   * Sources: flame_brand, berserker_band, glass_cannon, crescendo_blade, domain_mastery.
   */
  percentDamageBonus: number;
  /** Poison application from venom_fang; null if relic not held. */
  applyPoison: { value: number; turns: number } | null;
  /** Extra hits added to multi-hit attacks (chain_lightning_rod). */
  multiHitBonus: number;
  /** Override for execute threshold if executioners_axe is held (0.5 instead of default 0.3). */
  executeThresholdOverride: number | null;
  /**
   * Permanent Strength gain (encounter-scoped) from brass_knuckles on every 3rd attack.
   * 1 if triggered, 0 otherwise. Caller applies this as a strength status effect with turnsRemaining=9999.
   */
  strengthGain: number;
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
  /** Number of attacks played this encounter (brass_knuckles: every 3rd attack +6). */
  attackCountThisEncounter?: number;
  /** Accumulated Fury stacks from bloodstone_pendant. Consumed after attack. */
  furyStacks?: number;
  /** Whether the enemy currently has any Burn stacks (inferno_crown). */
  enemyHasBurn?: boolean;
  /** Whether the enemy currently has any Poison stacks (inferno_crown). */
  enemyHasPoison?: boolean;
  /** Current Burn stacks on enemy (ember_core: 5+ Burn = +20% damage). */
  enemyBurnStacks?: number;
  /**
   * Whether battle_scars bonus is armed this turn
   * (player took a hit this turn and bonus not yet consumed).
   */
  battleScarsArmed?: boolean;
  /**
   * Whether this is the first card played this turn (ritual_blade: +100% on first, -25% on others).
   * undefined is treated as true (first card or unset).
   */
  isFirstCardThisTurn?: boolean;
  /**
   * Index of this card play within the current turn, 0-based (momentum_wheel: 4th+ card = +100%).
   */
  cardPlayIndex?: number;
  /**
   * Whether bloodletter armed bonus is available (player took self-damage this turn).
   * Set to true by resolveHpLossEffects when source === 'self'.
   */
  bloodletterArmed?: boolean;
  /**
   * Accumulated wrong Charges this run (scar_tissue v3: +2 flat damage per stack).
   * Caller passes runState.scarTissueStacks. 0 or undefined = no stacks.
   */
  scarTissueStacks?: number;
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

  // whetstone — All attack cards +3 flat damage
  if (relicIds.has('whetstone')) {
    flatDamageBonus += 3;
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

  // domain_mastery_sigil (v3) — effect moved to resolveTurnStartEffects (Aura-based AP modifier).
  // The old domain_concentration_bonus (+30% for 4+ same-domain) has been removed.

  // scar_tissue (v3) — +2 flat damage per accumulated wrong Charge this run
  if (relicIds.has('scar_tissue') && (context.scarTissueStacks ?? 0) > 0) {
    flatDamageBonus += (context.scarTissueStacks ?? 0) * 2;
  }

  // === EXPANSION RELICS ===

  // battle_scars — next attack +3 after taking a hit (once/turn, consumed here by caller)
  if (relicIds.has('battle_scars') && context.battleScarsArmed) {
    flatDamageBonus += 3;
  }

  // brass_knuckles — every 3rd attack grants +1 permanent Strength (encounter-scoped)
  const attackCount = context.attackCountThisEncounter ?? 0;
  const strengthGain =
    relicIds.has('brass_knuckles') && attackCount > 0 && attackCount % 3 === 0 ? 1 : 0;

  // null_shard — all attacks +25% damage (chain mult override handled in resolveChainModifiers)
  if (relicIds.has('null_shard')) {
    percentDamageBonus += 0.25;
  }

  // berserker_s_oath — all attacks +40% damage
  if (relicIds.has('berserker_s_oath')) {
    percentDamageBonus += 0.40;
  }

  // inferno_crown — enemy has both Burn AND Poison: +30% all damage
  if (relicIds.has('inferno_crown') && context.enemyHasBurn && context.enemyHasPoison) {
    percentDamageBonus += 0.30;
  }

  // ember_core — enemy has 5+ Burn stacks: +20% damage
  if (relicIds.has('ember_core') && (context.enemyBurnStacks ?? 0) >= 5) {
    percentDamageBonus += 0.20;
  }

  // bloodstone_pendant — each Fury stack = +1 damage (consumed after attack by caller)
  if (relicIds.has('bloodstone_pendant') && (context.furyStacks ?? 0) > 0) {
    flatDamageBonus += context.furyStacks ?? 0;
  }

  // dragon_s_heart — passive +2 all attacks
  if (relicIds.has('dragon_s_heart')) {
    flatDamageBonus += 2;
  }

  // ritual_blade — first card this turn: +100% damage; subsequent cards: -25%
  if (relicIds.has('ritual_blade')) {
    if (context.isFirstCardThisTurn !== false) {  // first card or unset
      percentDamageBonus += 100;
    } else {
      percentDamageBonus -= 25;
    }
    playCardAudio('relic-trigger');
  }

  // momentum_wheel — 4th+ card played this turn: +100% damage
  if (relicIds.has('momentum_wheel') && (context.cardPlayIndex ?? 0) >= 4) {
    percentDamageBonus += 100;
    playCardAudio('relic-trigger');
  }

  // bloodletter — armed bonus: +3 flat damage after taking self-damage
  if (relicIds.has('bloodletter') && context.bloodletterArmed) {
    flatDamageBonus += 3;
    playCardAudio('relic-trigger');
  }

  // Audio: fire if any relic actually boosted this attack
  if (flatDamageBonus > 0 || percentDamageBonus > 0) playCardAudio('relic-trigger');

  return {
    flatDamageBonus,
    percentDamageBonus,
    applyPoison,
    multiHitBonus,
    executeThresholdOverride,
    strengthGain,
  };
}

// ─── Shield / Block ─────────────────────────────────────────────────

/** Modifiers applied when playing a shield/block card. */
export interface ShieldModifiers {
  /** Flat block added to all shield cards (stone_wall). Whetstone applies -1 penalty. */
  flatBlockBonus: number;
  /** Damage dealt back to attacker when blocking (thorned_vest). */
  reflectDamage: number;
  /**
   * Percentage block bonus for Quick Play shield cards (bastions_will: +25%).
   * 0 if relic not held. Applied as a multiplier: shieldApplied *= 1 + quickPlayShieldBonus / 100.
   */
  quickPlayShieldBonus: number;
  /**
   * Extra flat block from worn_shield: +3 on every 2nd shield card.
   * Caller must pass shieldCardPlayCount; 0 if not every-other-card.
   * @deprecated Replaced by percentBlockBonus + grantsThorns in v2 worn_shield rework.
   */
  wornShieldBonus: number;
  /**
   * Percentage block penalty from worn_shield v2 (-20%).
   * Negative value. Applied as percentBlockBonus on all block cards.
   */
  percentBlockBonus: number;
  /**
   * Thorns stacks granted when playing a block card (worn_shield v2: 1 thorn stack).
   * 0 if worn_shield not held.
   */
  grantsThorns?: number;
  /**
   * Whether block gain is disabled this turn (hollow_armor: disabled on turns > 0).
   * When true, caller skips applying block from this shield card.
   */
  blockGainDisabled?: boolean;
}

/** Context for resolveShieldModifiers. */
export interface ShieldModifiersContext {
  /** Number of shield cards played this encounter (worn_shield: every 2nd gets +3 block). */
  shieldCardPlayCountThisEncounter: number;
  /** Current turn number within the encounter (hollow_armor: disabled after turn 0). */
  encounterTurnNumber?: number;
}

/**
 * Resolve shield-phase modifiers contributed by held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Optional context for situational shield effects.
 * @returns Computed shield modifiers.
 */
export function resolveShieldModifiers(
  relicIds: Set<string>,
  context?: ShieldModifiersContext,
): ShieldModifiers {
  // worn_shield v2 — -20% block penalty + 1 Thorns stack per shield play (replaces v1 every-2nd bonus)
  let percentBlockBonus = 0;
  let grantsThorns: number | undefined;
  const shieldCount = context?.shieldCardPlayCountThisEncounter ?? 0;
  // Keep v1 wornShieldBonus for legacy callers; v2 uses percentBlockBonus + grantsThorns instead
  const wornShieldBonus = 0; // v1 behaviour removed — worn_shield reworked in v2
  if (relicIds.has('worn_shield')) {
    percentBlockBonus -= 20;
    grantsThorns = 1;
    playCardAudio('relic-trigger');
  }

  // whetstone — penalty: -1 flat block on shield cards
  let flatBlockBonus = relicIds.has('stone_wall') ? 3 : 0;
  if (relicIds.has('whetstone')) {
    flatBlockBonus -= 1;
  }

  const reflectDamage = relicIds.has('thorned_vest') ? 2 : 0;
  const quickPlayShieldBonus = relicIds.has('bastions_will') ? 25 : 0;

  // hollow_armor — block is disabled on turns after turn 0
  let blockGainDisabled: boolean | undefined;
  if (relicIds.has('hollow_armor') && context?.encounterTurnNumber !== undefined && context.encounterTurnNumber > 0) {
    blockGainDisabled = true;
  }

  // Audio: fire if any relic actually boosted this shield play
  if (flatBlockBonus > 0 || quickPlayShieldBonus > 0) {
    playCardAudio('relic-trigger');
  }

  return {
    flatBlockBonus,
    reflectDamage,
    // bastions_will — +25% block on Quick Play shield cards
    quickPlayShieldBonus,
    wornShieldBonus,
    percentBlockBonus,
    grantsThorns,
    blockGainDisabled,
  };
}

// ─── Heal ───────────────────────────────────────────────────────────

/** Modifiers applied to heal effects. */
export interface HealModifiers {
  /** Percentage bonus to heal effectiveness (medic_kit: +20%). */
  percentBonus: number;
  /** Flat block granted when any heal occurs (medic_kit: +3). */
  blockOnHeal: number;
  /**
   * Percentage reduction to healing received (pain_conduit: 50% less healing).
   * Applied as a penalty: effectiveHeal = heal * (1 - healingReductionPercent / 100).
   * 0 if pain_conduit not held.
   */
  healingReductionPercent?: number;
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
    healingReductionPercent: relicIds.has('pain_conduit') ? 50 : undefined,
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
  /**
   * Whether battle_scars should arm this turn (player takes a hit → next attack +3).
   * Caller sets battleScarsArmed = true if this returns true and not already used this turn.
   */
  battleScarsTriggered: boolean;
  /**
   * Fury stacks gained from bloodstone_pendant (1 per hit taken).
   * Caller accumulates into run/combat state furyStacks.
   */
  furyStacksGained: number;
  /**
   * Flat increase to incoming damage (thick_skin v2 rework: +2 damage taken).
   * Added AFTER flatReduction. 0 if thick_skin not held.
   */
  flatDamageIncrease?: number;
}

/** Context required to resolve damage-taken effects. */
export interface DamageTakenContext {
  /** Player's current HP as a fraction of max HP, 0..1. */
  playerHpPercent: number;
  /** Whether the player had any block before this hit. */
  hadBlock: boolean;
  /** Whether block absorbed any of the incoming damage (mirror_shield v1). */
  blockAbsorbedAll: boolean;
  /** Player's current block amount (thorn_crown v2: needs 10+ block). */
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

  // thorn_crown (v2) — reflect 5 damage when attacked at 10+ block
  const thornCrownReflect =
    relicIds.has('thorn_crown') && (context.currentBlock ?? 0) >= 10 ? 5 : 0;

  // steel_skin: v2 value is -3; v1 was -2
  const flatReduction = relicIds.has('steel_skin') ? 3 : 0;

  // battle_scars — taking a hit arms next-attack +3 (once/turn; caller manages the flag)
  const battleScarsTriggered = relicIds.has('battle_scars');

  // bloodstone_pendant — 1 Fury stack per hit taken
  const furyStacksGained = relicIds.has('bloodstone_pendant') ? 1 : 0;

  // thick_skin v2 rework — tradeoff: take +2 more damage (debuff reduction moved to resolveDebuffAppliedModifiers)
  const flatDamageIncrease = relicIds.has('thick_skin') ? 2 : undefined;

  // Audio: fire if any on-hit relic produced an active effect
  if (thornReflect > 0 || thornCrownReflect > 0 || furyStacksGained > 0 || battleScarsTriggered) {
    playCardAudio('relic-trigger');
  }

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
    battleScarsTriggered,
    furyStacksGained,
    flatDamageIncrease,
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

  // Audio: most dramatic relic cue — only when a death is actually prevented
  if (lastBreathSave || phoenixSave) playCardAudio('relic-death-prevent');

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
  /**
   * Entropy Engine proc: deal 5 damage + gain 5 block when 3+ distinct card types played.
   * null if not triggered; { damage: 5, block: 5 } if triggered.
   */
  entropyEngineProc: { damage: number; block: number } | null;
  /**
   * Number of cards to force-discard at end of turn (overclocked_mind: discard 2).
   * 0 if not applicable.
   */
  forceDiscard?: number;
  /**
   * Thorn stacks to grant (thorn_mantle: 4 thorns when player has 10+ block at turn end).
   * 0 if not triggered.
   */
  grantThorns?: number;
  /**
   * Bonus AP to grant at start of NEXT turn (quiz_master: +2 AP if 3+ charges correct this turn).
   * 0 if not triggered.
   */
  bonusApNextTurn?: number;
}

/** Context required to resolve turn-end effects. */
export interface TurnEndContext {
  /** Total damage dealt by the player during this turn (blood_pact v1). */
  damageDealtThisTurn: number;
  /** Number of cards played this turn (afterimage v1). */
  cardsPlayedThisTurn: number;
  /** Whether this was a perfect turn (all answers correct). */
  isPerfectTurn: boolean;
  /** Number of distinct card types (attack/shield/utility) played this turn (entropy_engine). */
  distinctCardTypesPlayedThisTurn?: number;
  /** Player's current block at turn end (thorn_mantle: 10+ triggers 4 thorns). */
  currentBlock?: number;
  /** Number of correctly charged cards this turn (quiz_master: 3+ triggers +2 AP next turn). */
  chargeCorrectsThisTurn?: number;
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

  // entropy_engine — 3+ distinct card types this turn: 5 damage + 5 block
  const distinctTypes = context.distinctCardTypesPlayedThisTurn ?? 0;
  const entropyEngineProc =
    relicIds.has('entropy_engine') && distinctTypes >= 3
      ? { damage: 5, block: 5 }
      : null;

  // overclocked_mind — force discard 2 cards at end of turn (draw bonus handled in resolveTurnStartEffects)
  let forceDiscard: number | undefined;
  if (relicIds.has('overclocked_mind')) {
    forceDiscard = 2;
  }

  // thorn_mantle — grant 4 Thorns when player has 10+ block at turn end
  let grantThorns: number | undefined;
  if (relicIds.has('thorn_mantle') && (context.currentBlock ?? 0) >= 10) {
    grantThorns = 4;
    playCardAudio('relic-trigger');
  }

  // quiz_master — 3+ correct charges this turn: +2 AP next turn
  let bonusApNextTurn: number | undefined;
  if (relicIds.has('quiz_master') && (context.chargeCorrectsThisTurn ?? 0) >= 3) {
    bonusApNextTurn = 2;
    playCardAudio('relic-trigger');
  }

  return {
    blockCarries,
    blockCarryMax,
    healFromDamage: relicIds.has('blood_pact') // v1 legacy
      ? Math.floor(context.damageDealtThisTurn * (hasSynergy(relicIds, 'perpetual_motion') ? 0.50 : 0.25))
      : 0,
    bonusDrawNext: afterimageTriggers ? 1 : 0,
    hpLoss,
    bonusApFromAfterimage: 0,
    entropyEngineProc,
    forceDiscard,
    grantThorns,
    bonusApNextTurn,
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
  /**
   * quick_study: show 1 random fact answer for 3 seconds (if 3+ charges correct).
   * 0 = don't show, 3 = show for 3 seconds.
   */
  showFactHintForSeconds: number;
  /**
   * living_grimoire: heal 3 HP if 3+ charges correct this encounter.
   * Additive with herbal_pouch heal.
   */
  livingGrimoireHeal: number;
  /**
   * archive_codex: flat damage bonus for next encounter based on deck mastery.
   * +1 per 10 total mastery levels across deck.
   */
  archiveCodexDamageBonus: number;
}

/** Context for resolveEncounterEndEffects. */
export interface EncounterEndContext {
  /** Total correct Charges this encounter (quick_study, living_grimoire threshold: 3). */
  chargesCorrectThisEncounter: number;
  /** Sum of mastery levels across all cards in deck (archive_codex). */
  totalDeckMasteryLevels?: number;
}

/**
 * Resolve effects that fire at the end of a combat encounter (after victory).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Optional context for conditional encounter-end effects.
 * @returns Encounter-end effects.
 */
export function resolveEncounterEndEffects(
  relicIds: Set<string>,
  context?: EncounterEndContext,
): EncounterEndEffects {
  // herbal_pouch v3: heal 3 HP post-combat (v1: encounter-start conditional heal; v2: 8 HP; v3: 3 HP)
  const healHp = relicIds.has('herbal_pouch') ? 3 : 0;

  const chargesCorrect = context?.chargesCorrectThisEncounter ?? 0;

  // quick_study — if 3+ correct Charges this encounter, show 1 random fact answer for 3s
  const showFactHintForSeconds =
    relicIds.has('quick_study') && chargesCorrect >= 3 ? 3 : 0;

  // living_grimoire — heal 3 HP if 3+ correct Charges this encounter
  const livingGrimoireHeal =
    relicIds.has('living_grimoire') && chargesCorrect >= 3 ? 3 : 0;

  // archive_codex — +1 flat damage per 10 total mastery levels across deck
  const totalMastery = context?.totalDeckMasteryLevels ?? 0;
  const archiveCodexDamageBonus =
    relicIds.has('archive_codex') ? Math.floor(totalMastery / 10) : 0;

  return { healHp, showFactHintForSeconds, livingGrimoireHeal, archiveCodexDamageBonus };
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
   * Scholar's Crown bonus (v3: review queue based).
   * 40 = +40% for Review Queue facts; 10 = +10% for other correct Charges. 0 if relic not held.
   */
  scholarsCrownBonus: number;
  /**
   * Mirror of Knowledge replay flag: true if relic is held, not yet used this encounter,
   * and player may activate it. Caller decides whether to consume the use.
   */
  mirrorAvailable: boolean;
  /** Gold bonus: +10 per Charge from knowledge_tax. (tattered_notebook v3 reworked to on_exhaust) */
  goldBonus: number;
  /**
   * Percentage bonus to charge-correct effect (glass_lens: +50%).
   * Applied as: effectiveChargeValue *= 1 + chargeCorrectBonusPercent / 100.
   * 0 if glass_lens not held.
   */
  chargeCorrectBonusPercent?: number;
  /**
   * Percentage reduction applied to the card's charge-correct damage/effect (knowledge_tax: -10%).
   * Applied before goldBonus payout. 0 if knowledge_tax not held.
   */
  chargeCorrectPenaltyPercent?: number;
  /**
   * Soul Jar charge gained: 1 when every 5th cumulative correct Charge is reached.
   * Caller accumulates into runState.soulJarCharges.
   */
  soulJarChargeGained: number;
  /**
   * Omniscience auto-succeed flag: true when 3+ correct Charges have happened this turn.
   * The 4th Charge attempt this turn auto-succeeds (no quiz, full multiplier).
   */
  autoSucceedNextCharge: boolean;
  /**
   * Akashic Record Tier 3 multiplier override.
   * @deprecated v3 — akashic_record reworked to akashicChargeBonus. Always 0.
   */
  akashicTier3MultiplierOverride: number;
  /**
   * Akashic Record hint: factId of previously-wrong answer to subtly highlight in quiz UI.
   * @deprecated v3 — akashic_record reworked. Always null.
   */
  akashicRecordHintFactId: string | null;
  /**
   * Akashic Record v3 bonus: +50% damage when fact not seen in 3+ encounters.
   * 50 if the spacing condition is met, 0 otherwise.
   */
  akashicChargeBonus: number;
  /**
   * Akashic Record v3 draw bonus: draw 1 extra card next turn when spacing condition fires.
   * 1 if the spacing condition is met, 0 otherwise.
   */
  akashicBonusDraw: number;
  /**
   * Lucky Coin v3: armed flag — +50% damage bonus on next correct Charge.
   * true when lucky_coin held AND 3 wrong Charges have been accumulated this encounter.
   * Caller consumes this flag after applying the bonus (resets wrongChargesThisEncounter).
   */
  luckyCoinArmed: boolean;
  /**
   * Volatile Manuscript self-Burn: stacks of Burn to apply to player.
   * 4 stacks every 3rd total Charge this run. 0 otherwise.
   */
  selfBurnApply: number;
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
  /** Cumulative count of correctly Charged cards in this encounter (memory_nexus, soul_jar). */
  chargeCountThisEncounter: number;
  /** Whether this is the first correct Charge this encounter (tattered_notebook). */
  isFirstChargeCorrectThisEncounter: boolean;
  /**
   * Number of correct Charges already done this turn BEFORE this one (omniscience: 3 = 4th auto-succeeds).
   * Caller increments after resolving.
   */
  correctChargesThisTurn: number;
  /** Total correct Charges this run (volatile_manuscript: every 3rd applies 4 self-Burn). */
  totalChargesThisRun: number;
  /** Whether mirror_of_knowledge has already been used this encounter. */
  mirrorUsedThisEncounter: boolean;
  /** Whether the adrenaline_shard has already refunded AP this turn. */
  adrenalineShard_usedThisTurn: boolean;
  /**
   * Whether this fact is currently in the Review Queue (scholars_crown v3).
   * True = +40% bonus; false/undefined = +10% base bonus.
   */
  wasReviewQueueFact?: boolean;
  /**
   * Cumulative wrong Charges accumulated this encounter (lucky_coin v3).
   * lucky_coin arms when this reaches 3 and luckyCoinArmed is not yet set.
   */
  wrongChargesThisEncounter?: number;
  /**
   * Whether lucky_coin safety net is currently armed (lucky_coin v3).
   * When true, the next correct Charge gets +50% damage.
   * Caller must reset this flag after consuming.
   */
  luckyCoinArmed?: boolean;
  /**
   * Accumulated wrong Charges this run (scar_tissue v3 stack counter).
   * Used to compute flat damage bonus: scar_tissue_stacks × 2.
   */
  scarTissueStacks?: number;
  /**
   * AR-269: Akashic Record spacing — number of encounters since this fact was last charged.
   * 0 = never seen before (grants bonus); positive = encounters elapsed since last charge.
   * factEncounterGap >= 3 OR factEncounterGap === 0 triggers the Akashic bonus.
   */
  factEncounterGap?: number;
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

  // memory_nexus (v3) — draw 2 on every 3rd correct Charge in encounter (repeating)
  if (
    relicIds.has('memory_nexus') &&
    context.chargeCountThisEncounter > 0 &&
    context.chargeCountThisEncounter % 3 === 0
  ) {
    drawBonus = 2;
  }

  // crit_lens — 25% crit chance doubles final damage
  const isCrit = relicIds.has('crit_lens') && Math.random() < 0.25;

  // bastions_will — +75% block for Charged shield cards
  if (relicIds.has('bastions_will') && context.cardType === 'shield') {
    shieldBonus = 75;
  }

  // scholars_crown (v3) — +40% on Review Queue facts, +10% on all other correct Charges
  if (relicIds.has('scholars_crown')) {
    scholarsCrownBonus = context.wasReviewQueueFact ? 40 : 10;
  }

  // mirror_of_knowledge — available if not yet used this encounter
  const mirrorAvailable = relicIds.has('mirror_of_knowledge') && !context.mirrorUsedThisEncounter;

  // tattered_notebook (v3) — reworked to on_exhaust (tempStrengthGain in resolveExhaustEffects)
  // goldBonus only from knowledge_tax now
  const goldBonus = 0;

  // soul_jar — 1 charge per 5th cumulative correct Charge in encounter
  const soulJarChargeGained =
    relicIds.has('soul_jar') &&
    context.chargeCountThisEncounter > 0 &&
    context.chargeCountThisEncounter % 5 === 0
      ? 1
      : 0;

  // omniscience — 3 correct Charges this turn → 4th auto-succeeds
  const autoSucceedNextCharge =
    relicIds.has('omniscience') && context.correctChargesThisTurn >= 3;

  // akashic_record (v3) — +50% damage + draw 1 when fact not seen in 3+ encounters.
  // factEncounterGap === 0 means the fact has never been charged before (new fact = bonus).
  // factEncounterGap >= 3 means 3 or more encounters have elapsed since last charge (bonus).
  // factEncounterGap = 1 or 2 means recently seen (no bonus). undefined defaults to bonus (safe).
  const akashicGap = context.factEncounterGap;
  const akashicSpacingMet = akashicGap === undefined || akashicGap === 0 || akashicGap >= 3;
  const akashicChargeBonus = (relicIds.has('akashic_record') && akashicSpacingMet) ? 50 : 0;
  const akashicBonusDraw = (relicIds.has('akashic_record') && akashicSpacingMet) ? 1 : 0;

  // akashic_record legacy fields — kept for interface compatibility; deprecated in v3
  const akashicTier3MultiplierOverride = 0;
  const akashicRecordHintFactId: string | null = null;

  // scar_tissue (v3) — flat damage bonus from accumulated wrong Charges (stacks × 2)
  // Applied as flatDamageBonus in resolveAttackModifiers; surfaced here for charge-correct context
  // (already wired below via return; caller also uses scarTissueStacks directly in damage pipeline)
  const scarTissueFlatBonus = relicIds.has('scar_tissue')
    ? (context.scarTissueStacks ?? 0) * 2
    : 0;
  // Note: flatDamageBonus is part of AttackModifiers, not ChargeCorrectEffects.
  // The scarTissueFlatBonus is returned here as chargeCorrectBonusPercent is not the right slot.
  // The caller (turnManager) must read scarTissueStacks from run state and pass it to resolveAttackModifiers.
  void scarTissueFlatBonus; // surfaced via context; direct wiring in turnManager

  // lucky_coin (v3) — +50% damage on next correct Charge after 3 wrong Charges this encounter
  const luckyCoinArmed = !!(relicIds.has('lucky_coin') && context.luckyCoinArmed);

  // volatile_manuscript — +0.5× to all Charge multipliers; every 3rd total Charge applies 4 self-Burn
  if (relicIds.has('volatile_manuscript')) {
    extraMultiplier *= 1.5; // +0.5× multiplier (multiplicative, applied before obsidian_dice)
  }

  // obsidian_dice — 60%: +50% multiplier; 40%: -25% multiplier
  if (relicIds.has('obsidian_dice')) {
    if (Math.random() < 0.60) {
      extraMultiplier *= 1.5;
    } else {
      extraMultiplier *= 0.75;
    }
  }

  // volatile_manuscript self-Burn: every 3rd total Charge this run applies 4 Burn to player
  const selfBurnApply =
    relicIds.has('volatile_manuscript') &&
    context.totalChargesThisRun > 0 &&
    context.totalChargesThisRun % 3 === 0
      ? 4
      : 0;

  // glass_lens — +50% to charge-correct effect
  let chargeCorrectBonusPercent: number | undefined;
  if (relicIds.has('glass_lens')) {
    chargeCorrectBonusPercent = (chargeCorrectBonusPercent ?? 0) + 50;
    playCardAudio('relic-trigger');
  }

  // knowledge_tax — -10% charge-correct effect, +10 gold per Charge
  let chargeCorrectPenaltyPercent: number | undefined;
  if (relicIds.has('knowledge_tax')) {
    chargeCorrectPenaltyPercent = 10;
    // goldBonus is already declared — add 10 for knowledge_tax
    // (we need to rebuild goldBonus as let to allow mutation)
  }
  const finalGoldBonus = goldBonus + (relicIds.has('knowledge_tax') ? 10 : 0);

  // lucky_coin v3 — apply +50% damage boost when armed
  if (luckyCoinArmed) {
    extraMultiplier *= 1.5;
  }

  // akashic_record v3 — +50% damage on all correct Charges
  if (akashicChargeBonus > 0) {
    extraMultiplier *= (1 + akashicChargeBonus / 100);
  }

  return {
    extraMultiplier,
    apRefund,
    drawBonus,
    isCrit,
    shieldBonus,
    scholarsCrownBonus,
    mirrorAvailable,
    goldBonus: finalGoldBonus,
    soulJarChargeGained,
    autoSucceedNextCharge,
    akashicTier3MultiplierOverride,
    akashicRecordHintFactId,
    akashicChargeBonus,
    akashicBonusDraw,
    selfBurnApply,
    chargeCorrectBonusPercent,
    chargeCorrectPenaltyPercent,
    luckyCoinArmed,
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
  /** Gold bonus on wrong Charge (gambler_s_token: +3). */
  goldBonus: number;
  /**
   * Paradox Engine: multiplier override for the wrong Charge resolution.
   * 0.30 = resolve at 0.3× instead of normal wrong-Charge mult.
   * 0 if paradox_engine not held.
   */
  multiplierOverride: number;
  /**
   * Paradox Engine: piercing damage dealt to enemy (ignores block).
   * 5 if paradox_engine held. 0 otherwise.
   */
  piercingDamage: number;
  /**
   * Whether the card should resolve at charge-correct power instead of wrong penalty.
   * mnemonic_scar: true if the fact was previously answered correctly (saves from penalty).
   */
  resolveAtCcPower?: boolean;
  /**
   * Scar Tissue v3: caller should increment scarTissueStacks in run state by 1.
   * true if scar_tissue held.
   */
  scarTissueStackIncrement: boolean;
  /**
   * Lucky Coin v3: the updated wrong-Charge counter for this encounter after this wrong answer.
   * Caller stores this in encounter state. When it reaches 3, set luckyCoinArmed = true
   * in the next ChargeCorrectContext to trigger the +50% bonus.
   * -1 if lucky_coin not held (sentinel: caller ignores).
   */
  luckyCoinWrongCount: number;
}

/** Context for resolveChargeWrongEffects. */
export interface ChargeWrongContext {
  /** ID of the fact that was answered incorrectly (insight_prism). */
  factId: string;
  /**
   * Whether the player previously answered this fact correctly (mnemonic_scar).
   * If true, mnemonic_scar resolves at charge-correct power instead of dealing self-damage.
   */
  factPreviouslyCorrect?: boolean;
  /**
   * Current wrong-Charge count this encounter BEFORE this wrong answer (lucky_coin v3).
   * Resolver increments and returns the new count via luckyCoinWrongCount.
   */
  wrongChargesThisEncounter?: number;
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

  // gambler_s_token — wrong Charge grants +3 gold
  const goldBonus = relicIds.has('gambler_s_token') ? 3 : 0;

  // paradox_engine — wrong Charge resolves at 0.3× AND deals 5 piercing damage
  const multiplierOverride = relicIds.has('paradox_engine') ? 0.30 : 0;
  const piercingDamage = relicIds.has('paradox_engine') ? 5 : 0;

  // glass_lens — +3 self-damage on wrong Charge
  if (relicIds.has('glass_lens')) {
    selfDamage = (selfDamage ?? 0) + 3;
  }

  // mnemonic_scar — if fact was previously correct, resolve at CC power; otherwise +5 self-damage
  let resolveAtCcPower: boolean | undefined;
  if (relicIds.has('mnemonic_scar')) {
    if (context.factPreviouslyCorrect) {
      resolveAtCcPower = true;
    } else {
      selfDamage = (selfDamage ?? 0) + 5;
    }
    playCardAudio('relic-trigger');
  }

  // scar_tissue (v3) — wrong Charge adds +2 flat damage to all future correct Charges this run.
  // Caller increments scarTissueStacks in run state and passes it via ChargeCorrectContext.scarTissueStacks.
  const scarTissueStackIncrement = relicIds.has('scar_tissue');

  // lucky_coin (v3) — track wrong Charges per encounter; arm +50% on next correct Charge at 3.
  // Returns the incremented wrong-Charge counter for this encounter.
  let luckyCoinWrongCount = -1; // -1 = not held (sentinel)
  if (relicIds.has('lucky_coin')) {
    luckyCoinWrongCount = (context.wrongChargesThisEncounter ?? 0) + 1;
    playCardAudio('relic-trigger');
  }

  void context; // factId used by caller to update run state

  return { selfDamage, enemyDamage, revealAndAutopass, goldBonus, multiplierOverride, piercingDamage, resolveAtCcPower, scarTissueStackIncrement, luckyCoinWrongCount };
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
  /** Gold bonus from chain_link_charm (+5 per chain link). */
  goldBonus: number;
  /**
   * Whether chain_forge is available to prevent a chain break this encounter.
   * True if chain_forge held and not yet used this encounter.
   * Caller: when next chain-breaking event occurs AND chainForgeAvailable, prevent the break.
   */
  chainForgeAvailable: boolean;
  /**
   * Whether chromatic_chain primed next chain to start at 2.
   * True if chain 3+ completed AND relic held AND not used this encounter.
   * Caller sets runState.chromaticChainPrimed = true.
   */
  chromaticChainPrimed: boolean;
  /**
   * Singularity bonus damage for 5-chains: equals total chain damage dealt.
   * 0 if chain < 5 or relic not held.
   */
  singularityBonusDamage: number;
  /**
   * HP healed when a chain of 3+ completes (chain_addict: +5 HP per qualifying chain).
   * 0 if chain_addict not held or chainLength < 3.
   */
  healAmount?: number;
}

/** Context for resolveChainCompleteEffects. */
export interface ChainCompleteContext {
  /** Number of links in the completed chain. */
  chainLength: number;
  /** ID of the first card in the chain. */
  firstCardId: string;
  /** Whether chain_forge has already been used this encounter. */
  chainForgeUsedThisEncounter?: boolean;
  /** Whether chromatic_chain has already been used this encounter. */
  chromaticChainUsedThisEncounter?: boolean;
  /**
   * Total damage dealt by all cards in this chain (singularity: bonus = this value).
   * Required for singularity; 0 if not tracked.
   */
  totalChainDamage?: number;
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

  // chain_link_charm — +5 gold per chain link in completed chain
  const goldBonus = relicIds.has('chain_link_charm') ? chainLength * 5 : 0;

  // chain_forge — available to prevent next chain break (once/encounter)
  const chainForgeAvailable =
    relicIds.has('chain_forge') && !(context.chainForgeUsedThisEncounter ?? false);

  // chromatic_chain — 3+ chain primes next chain to start at 2 (once/encounter)
  const chromaticChainPrimed =
    relicIds.has('chromatic_chain') &&
    chainLength >= 3 &&
    !(context.chromaticChainUsedThisEncounter ?? false);

  // singularity — 5-chain bonus damage = total chain damage dealt (doubles 5-chain output)
  const singularityBonusDamage =
    relicIds.has('singularity') && chainLength >= 5
      ? (context.totalChainDamage ?? 0)
      : 0;

  // chain_addict — heal 5 HP when a chain of 3+ completes
  let healAmount: number | undefined;
  if (relicIds.has('chain_addict') && chainLength >= 3) {
    healAmount = (healAmount ?? 0) + 5;
    playCardAudio('relic-trigger');
  }

  return {
    splashPerLink,
    totalSplashDamage,
    drawBonus,
    goldBonus,
    chainForgeAvailable,
    chromaticChainPrimed,
    singularityBonusDamage,
    healAmount,
  };
}

// ─── Prismatic Shard — Chain Multiplier Bonus ───────────────────────

/**
 * Returns the flat bonus to add to the chain multiplier when prismatic_shard is held.
 * Also handles null_shard chain multiplier override (locks at 1.0× — overrides all other bonuses).
 *
 * Usage:
 *   if (resolveChainMultiplierIsOverridden(relicIds)) { mult = 1.0; }
 *   else { mult = baseChainMultiplier + resolveChainMultiplierBonus(relicIds); }
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns 0.5 if prismatic_shard is held (and null_shard NOT held), 0 otherwise.
 */
export function resolveChainMultiplierBonus(relicIds: Set<string>): number {
  if (relicIds.has('null_shard')) return 0; // null_shard overrides all chain mult bonuses
  return relicIds.has('prismatic_shard') ? 0.5 : 0;
}

/**
 * Returns true if null_shard is held, which locks the chain multiplier to exactly 1.0×.
 * Caller should use 1.0× instead of computing a chain multiplier when this returns true.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns true if null_shard is held.
 */
export function resolveChainMultiplierIsOverridden(relicIds: Set<string>): boolean {
  return relicIds.has('null_shard');
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

/** Extended surge-start effects including expansion relics. */
export interface SurgeStartEffectsV2 extends SurgeStartEffects {
  /** Bonus draw count from surge_capacitor (+2 on surge turns). */
  bonusDrawCount: number;
}

/**
 * Resolve effects that fire at the start of a Knowledge Surge turn.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Surge-start effects.
 */
export function resolveSurgeStartEffects(relicIds: Set<string>): SurgeStartEffectsV2 {
  let bonusAP = 0;
  let bonusDrawCount = 0;

  if (relicIds.has('time_warp')) {
    bonusAP += 1;
    return { timerMultiplier: 0.5, chargeMultiplierOverride: 5.0, bonusAP, bonusDrawCount };
  }

  // surge_capacitor — +1 AP and draw 2 extra on Surge turns
  if (relicIds.has('surge_capacitor')) {
    bonusAP += 1;
    bonusDrawCount += 2;
  }

  return { timerMultiplier: 1.0, chargeMultiplierOverride: null, bonusAP, bonusDrawCount };
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
  // prospectors_pick (v1 legacy) gives +1 option
  // scavengers_eye (v3) reworked to on_exhaust draw — no longer affects card reward count
  if (relicIds.has('prospectors_pick')) return 4;
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

// ─── Expansion: Run Start Effects ───────────────────────────────────

/** Effects applied at the very start of a run. */
export interface RunStartEffects {
  /** Max HP penalty from berserker_s_oath (-30). */
  maxHpPenalty: number;
}

/**
 * Resolve effects that fire at the start of a run (on_run_start relics).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Run-start effects.
 */
export function resolveRunStartEffects(relicIds: Set<string>): RunStartEffects {
  // berserker_s_oath — -30 max HP at run start (attack bonus handled in resolveAttackModifiers)
  const maxHpPenalty = relicIds.has('berserker_s_oath') ? 30 : 0;
  return { maxHpPenalty };
}

// ─── Expansion: Bleed Modifiers ─────────────────────────────────────

/** Modifiers applied when Bleed is applied to an enemy. */
export interface BleedModifiers {
  /** Extra Bleed stacks from bleedstone (+2). */
  extraBleedStacks: number;
  /** Whether Bleed decays 1 slower than normal (bleedstone). */
  slowerDecay: boolean;
}

/**
 * Resolve Bleed application modifiers from held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bleed application modifiers.
 */
export function resolveBleedModifiers(relicIds: Set<string>): BleedModifiers {
  return {
    extraBleedStacks: relicIds.has('bleedstone') ? 2 : 0,
    slowerDecay: relicIds.has('bleedstone'),
  };
}

// ─── Expansion: Burn Modifiers ──────────────────────────────────────

/** Modifiers applied when Burn is applied to an enemy. */
export interface BurnModifiers {
  /** Extra Burn stacks from ember_core (+2). */
  extraBurnStacks: number;
}

/**
 * Resolve Burn application modifiers from held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Burn application modifiers.
 */
export function resolveBurnModifiers(relicIds: Set<string>): BurnModifiers {
  return {
    extraBurnStacks: relicIds.has('ember_core') ? 2 : 0,
  };
}

// ─── Expansion: Debuff Applied Modifiers ────────────────────────────

/** Modifiers applied when a debuff is applied to the player. */
export interface DebuffAppliedModifiers {
  /**
   * Whether the debuff should be reflected to the enemy instead of applied to the player (thick_skin v3).
   * When true, caller applies the debuff to the enemy, not the player.
   */
  reflectToEnemy: boolean;
}

/** Context for resolveDebuffAppliedModifiers. */
export interface DebuffAppliedContext {
  /** Whether this is the first debuff applied to the player this encounter. */
  isFirstDebuffThisEncounter: boolean;
}

/**
 * Resolve modifiers applied when a debuff is inflicted on the player.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Context for the debuff application.
 * @returns Debuff application modifiers.
 */
export function resolveDebuffAppliedModifiers(
  relicIds: Set<string>,
  context: DebuffAppliedContext,
): DebuffAppliedModifiers {
  // thick_skin v3 rework: debuffs are reflected to the enemy instead of reducing duration.
  // v2: +2 damage taken (still in resolveDamageTakenEffects).
  // v1 legacy (duration -1 on first debuff) is superseded by this reflect mechanic.
  const reflectToEnemy = relicIds.has('thick_skin');
  return { reflectToEnemy };
}

// ─── Expansion: Perfect Turn Effects ────────────────────────────────

/** Effects resolved when the player has a perfect turn (all cards Charged correctly). */
export interface PerfectTurnEffects {
  /** Bonus AP next turn from momentum_gem. */
  bonusAP: number;
  /** Permanent Strength gain from thoughtform (+1 per perfect turn). */
  permanentStrengthGain: number;
}

/**
 * Resolve effects that fire on a perfect turn.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Perfect-turn effects.
 */
export function resolvePerfectTurnEffects(relicIds: Set<string>): PerfectTurnEffects {
  return {
    bonusAP: relicIds.has('momentum_gem') ? 1 : 0,
    permanentStrengthGain: relicIds.has('thoughtform') ? 1 : 0,
  };
}

// ─── Expansion: Multi-Hit Effects ───────────────────────────────────

/** Effects resolved on each hit of a multi-hit attack. */
export interface MultiHitEffects {
  /**
   * Bleed stacks applied per subsequent hit (hemorrhage_lens: 1 per hit, NOT on first hit).
   * Caller applies this to hits 2, 3, etc. — not hit 1.
   */
  bleedPerSubsequentHit: number;
}

/**
 * Resolve effects that fire on multi-hit attacks.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Multi-hit effects.
 */
export function resolveMultiHitEffects(relicIds: Set<string>): MultiHitEffects {
  // hemorrhage_lens — 1 Bleed per subsequent hit (not the first hit)
  return {
    bleedPerSubsequentHit: relicIds.has('hemorrhage_lens') ? 1 : 0,
  };
}

// ─── Expansion: Elite Kill Effects ──────────────────────────────────

/** Effects resolved when the player kills an elite enemy. */
export interface EliteKillEffects {
  /** Max HP gained from dragon_s_heart (+5 on elite kill). */
  maxHpGain: number;
  /** Fraction of new max HP to heal (dragon_s_heart: 0.30 = 30%). */
  healPercent: number;
}

/**
 * Resolve effects that fire when an elite enemy is killed.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Elite-kill effects.
 */
export function resolveEliteKillEffects(relicIds: Set<string>): EliteKillEffects {
  if (relicIds.has('dragon_s_heart')) {
    return { maxHpGain: 5, healPercent: 0.30 };
  }
  return { maxHpGain: 0, healPercent: 0 };
}

// ─── Expansion: Boss Kill Effects ───────────────────────────────────

/** Effects resolved when the player kills a boss enemy. */
export interface BossKillEffects {
  /** Max HP gained from dragon_s_heart (+15 on boss kill). */
  maxHpGain: number;
  /** Whether to fully heal the player (dragon_s_heart). */
  fullHeal: boolean;
  /** Whether to grant a random Legendary relic (dragon_s_heart). */
  grantRandomLegendaryRelic: boolean;
}

/**
 * Resolve effects that fire when a boss enemy is killed.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Boss-kill effects.
 */
export function resolveBossKillEffects(relicIds: Set<string>): BossKillEffects {
  if (relicIds.has('dragon_s_heart')) {
    return { maxHpGain: 15, fullHeal: true, grantRandomLegendaryRelic: true };
  }
  return { maxHpGain: 0, fullHeal: false, grantRandomLegendaryRelic: false };
}

// ─── Expansion: Soul Jar ─────────────────────────────────────────────

/**
 * Returns whether the GUARANTEED button state should be shown for the Charge button.
 * When soulJarCharges > 0, the button shows "GUARANTEED" instead of "CHARGE".
 *
 * @param relicIds      - Set of relic IDs the player currently holds.
 * @param soulJarCharges - Current number of Soul Jar charges in run state.
 * @returns True if the GUARANTEED button should be displayed.
 */
export function resolveChargeButtonState(
  relicIds: Set<string>,
  soulJarCharges: number,
): { showGuaranteed: boolean } {
  return { showGuaranteed: relicIds.has('soul_jar') && soulJarCharges > 0 };
}

// ─── Expansion: Mind Palace ──────────────────────────────────────────

/** Bonus to all effects from Mind Palace streak thresholds. */
export interface MindPalaceEffects {
  /**
   * Flat bonus added to all attack, block, and heal effects.
   * 0 below 10 streak, 3 at 10+, 6 at 20+, 10 at 30+.
   */
  bonusToAllEffects: number;
}

/**
 * Resolve Mind Palace bonus based on current streak.
 *
 * @param relicIds         - Set of relic IDs the player currently holds.
 * @param mindPalaceStreak - Current correct-Charge streak for this run.
 * @returns Mind Palace flat bonus to all effects.
 */
export function resolveMindPalaceEffects(
  relicIds: Set<string>,
  mindPalaceStreak: number,
): MindPalaceEffects {
  if (!relicIds.has('mind_palace')) return { bonusToAllEffects: 0 };
  let bonusToAllEffects = 0;
  if (mindPalaceStreak >= 30) bonusToAllEffects = 10;
  else if (mindPalaceStreak >= 20) bonusToAllEffects = 6;
  else if (mindPalaceStreak >= 10) bonusToAllEffects = 3;
  return { bonusToAllEffects };
}

// ─── Expansion: Chronometer Timer Modifier ───────────────────────────

/**
 * Returns the bonus milliseconds added to quiz timers from chronometer.
 * Also returns the Charge multiplier penalty (subtracted from all Charge multipliers).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns { extraTimerMs, chargeMultiplierPenalty }
 */
export function resolveChronometerModifiers(
  relicIds: Set<string>,
): { extraTimerMs: number; chargeMultiplierPenalty: number } {
  if (!relicIds.has('chronometer')) return { extraTimerMs: 0, chargeMultiplierPenalty: 0 };
  return { extraTimerMs: 3000, chargeMultiplierPenalty: 0.15 };
}

// ─── HP Loss Effects ──────────────────────────────────────────────────

/** Context for resolveHpLossEffects. */
export interface HpLossContext {
  /** Amount of HP lost. */
  hpLost: number;
  /** Source of the HP loss. */
  source: 'enemy' | 'self' | 'relic';
}

/** Effects that trigger when the player loses HP. */
export interface HpLossEffects {
  /**
   * Damage reflected back to the enemy equal to HP lost (pain_conduit).
   * 0 if pain_conduit not held or hpLost is 0.
   */
  reflectDamage: number;
  /**
   * Bonus damage to the next attack (bloodletter: +3 after self-damage).
   * Caller sets bloodletterArmed = true in combat state when this > 0.
   */
  nextAttackBonus: number;
}

/**
 * Resolves effects that trigger when the player loses HP.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - HP loss context (amount and source).
 * @returns Computed HP-loss effects.
 */
export function resolveHpLossEffects(
  relicIds: Set<string>,
  context: HpLossContext,
): HpLossEffects {
  let reflectDamage = 0;
  let nextAttackBonus = 0;

  // pain_conduit — reflect HP loss as damage to enemy
  if (relicIds.has('pain_conduit') && context.hpLost > 0) {
    reflectDamage += context.hpLost;
    playCardAudio('relic-trigger');
  }

  // bloodletter — +3 next attack after self-damage
  if (relicIds.has('bloodletter') && context.source === 'self' && context.hpLost > 0) {
    nextAttackBonus += 3;
    playCardAudio('relic-trigger');
  }

  return { reflectDamage, nextAttackBonus };
}

// ─── Exhaust Effects ──────────────────────────────────────────────────

/** Effects that trigger when a card is exhausted. */
export interface ExhaustEffects {
  /**
   * Bonus cards to draw when a card is exhausted (exhaustion_engine: +2 draw; scavengers_eye v3: +1 draw).
   * 0 if neither relic held.
   */
  bonusCardDraw: number;
  /**
   * Temporary Strength gain this turn from tattered_notebook v3 (+1 Strength when a card is exhausted).
   * Caller applies as a Strength status effect for 1 turn. 0 if relic not held.
   */
  tempStrengthGain: number;
}

/**
 * Resolves effects that trigger when a card is exhausted.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Computed exhaust effects.
 */
export function resolveExhaustEffects(
  relicIds: Set<string>,
): ExhaustEffects {
  let bonusCardDraw = 0;
  let tempStrengthGain = 0;

  // exhaustion_engine — draw 2 when a card is exhausted
  if (relicIds.has('exhaustion_engine')) {
    bonusCardDraw += 2;
    playCardAudio('relic-trigger');
  }

  // scavengers_eye (v3) — draw 1 from draw pile when a card is exhausted
  if (relicIds.has('scavengers_eye')) {
    bonusCardDraw += 1;
    playCardAudio('relic-trigger');
  }

  // tattered_notebook (v3) — gain +1 temporary Strength this turn when a card is exhausted
  if (relicIds.has('tattered_notebook')) {
    tempStrengthGain += 1;
    playCardAudio('relic-trigger');
  }

  return { bonusCardDraw, tempStrengthGain };
}

// ─── Chain Break Effects ─────────────────────────────────────────────

/** Context for resolveChainBreakEffects. */
export interface ChainBreakContext {
  /** Length of the chain that was broken. */
  previousChainLength: number;
}

/** Effects that trigger when a knowledge chain is broken. */
export interface ChainBreakEffects {
  /**
   * Whether any relic triggered on chain break.
   * Reserved for future relics — currently always false.
   */
  triggered: boolean;
}

/**
 * Resolves effects that trigger when a knowledge chain is broken.
 * Hook is ready for future relics; currently no relics use on_chain_break.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param _context - Chain break context (reserved for future use).
 * @returns Computed chain-break effects.
 */
export function resolveChainBreakEffects(
  relicIds: Set<string>,
  _context: ChainBreakContext,
): ChainBreakEffects {
  // No relics currently use on_chain_break — hook is ready for future use
  void relicIds;
  return { triggered: false };
}
