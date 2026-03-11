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

// ─── Encounter Start ────────────────────────────────────────────────

/** Effects resolved at the beginning of each encounter. */
export interface EncounterStartEffects {
  /** Bonus block applied to player at encounter start (iron_buckler). */
  bonusBlock: number;
  /** HP healed at encounter start (herbal_pouch). */
  bonusHeal: number;
  /** Bonus action points granted at encounter start (quicksilver). */
  bonusAP: number;
  /** Whether the first card played this encounter costs 0 AP (double_vision). */
  freeFirstCard: boolean;
  /** Whether the player permanently sees 2 enemy intents (cartographers_lens). */
  permanentForesight: boolean;
}

/**
 * Resolve effects that fire at the start of every encounter.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Computed encounter-start bonuses.
 */
export function resolveEncounterStartEffects(relicIds: Set<string>): EncounterStartEffects {
  return {
    bonusBlock: relicIds.has('iron_buckler') ? 5 : 0,
    bonusHeal: relicIds.has('herbal_pouch') ? 3 : 0,
    bonusAP: relicIds.has('quicksilver') ? 1 : 0,
    freeFirstCard: relicIds.has('double_vision'),
    permanentForesight: relicIds.has('cartographers_lens'),
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
  /** Override for execute threshold if executioners_axe is held (0.4 instead of default 0.3). */
  executeThresholdOverride: number | null;
}

/** Context required to resolve attack modifiers. */
export interface AttackContext {
  /** Whether this is the first attack played this encounter (flame_brand). */
  isFirstAttack: boolean;
  /** Whether the card's mechanic has the 'strike' tag (barbed_edge). */
  isStrikeTagged: boolean;
  /** Current combo count this turn (war_drum). */
  comboCount: number;
  /** Player's current HP as a fraction of max HP, 0..1 (berserker_band). */
  playerHpPercent: number;
  /** Number of consecutive correct attacks this encounter (crescendo_blade). */
  consecutiveCorrectAttacks: number;
  /** The card's tier: 'learning' | 'recall_a' | 'recall_b' | 'mastered' (curiosity_gem). */
  cardTier: string;
  /** Number of consecutive correct answers this encounter (memory_palace via correct-answer tracking). */
  correctStreakThisEncounter: number;
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

  // barbed_edge — Strike-tagged mechanics +3 base damage
  if (relicIds.has('barbed_edge') && context.isStrikeTagged) {
    flatDamageBonus += 3;
  }

  // war_drum — +1 damage per combo level this turn
  if (relicIds.has('war_drum')) {
    flatDamageBonus += context.comboCount;
  }

  // memory_palace — 3 correct in a row: +3 damage to next attack
  if (relicIds.has('memory_palace') && context.correctStreakThisEncounter >= 3) {
    flatDamageBonus += 3;
  }

  // flame_brand — First attack each encounter +50% damage
  if (relicIds.has('flame_brand') && context.isFirstAttack) {
    percentDamageBonus += 0.5;
  }

  // berserker_band — Below 40% HP: attacks +50% damage
  if (relicIds.has('berserker_band') && context.playerHpPercent < 0.4) {
    percentDamageBonus += 0.5;
  }

  // glass_cannon — Attacks +40% damage (cursed: damage-taken side is in resolveDamageTakenEffects)
  if (relicIds.has('glass_cannon')) {
    percentDamageBonus += 0.4;
  }

  // crescendo_blade — Each consecutive correct attack: +10% damage (stacks)
  if (relicIds.has('crescendo_blade') && context.consecutiveCorrectAttacks > 0) {
    percentDamageBonus += 0.1 * context.consecutiveCorrectAttacks;
  }

  // curiosity_gem — Tier 1 (Learning) cards +20% effect
  if (relicIds.has('curiosity_gem') && context.cardTier === 'learning') {
    percentDamageBonus += 0.2;
  }

  // venom_fang — All attacks apply 1 poison for 2 turns
  const applyPoison = relicIds.has('venom_fang')
    ? { value: 1, turns: 2 }
    : null;

  // chain_lightning_rod — Multi-hit attacks get +2 extra hits
  const multiHitBonus = relicIds.has('chain_lightning_rod') ? 2 : 0;

  // executioners_axe — Execute threshold 40% instead of 30%
  const executeThresholdOverride = relicIds.has('executioners_axe') ? 0.4 : null;

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
}

/**
 * Resolve shield-phase modifiers contributed by held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Computed shield modifiers.
 */
export function resolveShieldModifiers(relicIds: Set<string>): ShieldModifiers {
  return {
    flatBlockBonus: relicIds.has('stone_wall') ? 2 : 0,
    reflectDamage: relicIds.has('thorned_vest') ? 3 : 0,
  };
}

// ─── Heal ───────────────────────────────────────────────────────────

/** Modifiers applied to heal effects. */
export interface HealModifiers {
  /** Percentage bonus to heal effectiveness (medic_kit: +15%). */
  percentBonus: number;
}

/**
 * Resolve heal modifiers contributed by held relics.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Computed heal modifiers.
 */
export function resolveHealModifiers(relicIds: Set<string>): HealModifiers {
  return {
    percentBonus: relicIds.has('medic_kit') ? 0.15 : 0,
  };
}

// ─── Damage Taken ───────────────────────────────────────────────────

/** Effects that modify incoming damage to the player. */
export interface DamageTakenEffects {
  /** Flat damage reduction from all sources, minimum 1 damage dealt (steel_skin). */
  flatReduction: number;
  /** Percentage increase to incoming damage (glass_cannon cursed effect: +15%). */
  percentIncrease: number;
  /** Whether all block is doubled this hit (iron_resolve, below 25% HP). */
  blockDoubled: boolean;
  /** Probability of dodging the attack entirely (phase_cloak: 20%). */
  dodgeChance: number;
  /** Reflect a percentage of blocked damage back at attacker (mirror_shield); null if not held. */
  reflectOnBlock: { percent: number } | null;
}

/** Context required to resolve damage-taken effects. */
export interface DamageTakenContext {
  /** Player's current HP as a fraction of max HP, 0..1 (iron_resolve). */
  playerHpPercent: number;
  /** Whether the player had any block before this hit. */
  hadBlock: boolean;
  /** Whether block fully absorbed the incoming damage (mirror_shield). */
  blockAbsorbedAll: boolean;
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
  return {
    flatReduction: relicIds.has('steel_skin') ? 1 : 0,
    percentIncrease: relicIds.has('glass_cannon') ? 0.15 : 0,
    blockDoubled: relicIds.has('iron_resolve') && context.playerHpPercent < 0.25,
    dodgeChance: relicIds.has('phase_cloak') ? 0.2 : 0,
    reflectOnBlock:
      relicIds.has('mirror_shield') && context.hadBlock && context.blockAbsorbedAll
        ? { percent: 0.5 }
        : null,
  };
}

// ─── Lethal ─────────────────────────────────────────────────────────

/** Effects that can save the player from a killing blow. */
export interface LethalSaveEffects {
  /** Whether last_breath triggers (once per encounter). */
  lastBreathSave: boolean;
  /** Whether phoenix_feather triggers (once per run). */
  phoenixSave: boolean;
  /** HP to restore as a fraction of max HP when phoenix triggers. */
  phoenixHealPercent: number;
}

/** Context required to resolve lethal-save effects. */
export interface LethalContext {
  /** Whether last_breath has already fired this encounter. */
  lastBreathUsedThisEncounter: boolean;
  /** Whether phoenix_feather has already fired this run. */
  phoenixUsedThisRun: boolean;
}

/**
 * Resolve whether any relic can save the player from a killing blow.
 * Priority: last_breath first (encounter-scoped), then phoenix_feather (run-scoped).
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

  // Phoenix only fires if last_breath didn't already save
  const phoenixSave =
    !lastBreathSave &&
    relicIds.has('phoenix_feather') &&
    !context.phoenixUsedThisRun;

  return {
    lastBreathSave,
    phoenixSave,
    phoenixHealPercent: phoenixSave ? 0.3 : 0,
  };
}

// ─── Turn End ───────────────────────────────────────────────────────

/** Effects resolved at the end of each player turn. */
export interface TurnEndEffects {
  /** Whether block carries to the next turn instead of resetting (fortress_wall). */
  blockCarries: boolean;
  /** HP healed from blood_pact (25% of damage dealt this turn). */
  healFromDamage: number;
  /** Bonus cards to draw next turn from afterimage (+1 if 3+ cards played). */
  bonusDrawNext: number;
  /** HP lost per turn from blood_price (cursed). */
  hpLoss: number;
}

/** Context required to resolve turn-end effects. */
export interface TurnEndContext {
  /** Total damage dealt by the player during this turn (blood_pact). */
  damageDealtThisTurn: number;
  /** Number of cards played this turn (afterimage). */
  cardsPlayedThisTurn: number;
}

/**
 * Resolve effects that fire at the end of the player's turn.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param context  - Turn summary data.
 * @returns Computed turn-end effects.
 */
export function resolveTurnEndEffects(
  relicIds: Set<string>,
  context: TurnEndContext,
): TurnEndEffects {
  return {
    blockCarries: relicIds.has('fortress_wall'),
    healFromDamage: relicIds.has('blood_pact')
      ? Math.floor(context.damageDealtThisTurn * 0.25)
      : 0,
    bonusDrawNext:
      relicIds.has('afterimage') && context.cardsPlayedThisTurn >= 3 ? 1 : 0,
    hpLoss: relicIds.has('blood_price') ? 2 : 0,
  };
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
  /** HP healed per correct answer (scholars_hat: +1). */
  healHp: number;
  /** Bonus damage to next attack from memory_palace (+3 after 3 correct in a row). */
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
    healHp: relicIds.has('scholars_hat') ? 1 : 0,
    memoryPalaceBonus:
      relicIds.has('memory_palace') && context.correctStreakThisEncounter >= 3
        ? 3
        : 0,
  };
}

// ─── Domain Mastery ─────────────────────────────────────────────────

/**
 * Resolve the domain_mastery bonus: 5 consecutive same-domain correct answers
 * grants +100% to the next card.
 *
 * @param relicIds              - Set of relic IDs the player currently holds.
 * @param sameDomainCorrectStreak - Consecutive correct answers in the same domain.
 * @returns Percentage bonus multiplier (1.0 = +100%, 0 = no bonus).
 */
export function resolveDomainMasteryBonus(
  relicIds: Set<string>,
  sameDomainCorrectStreak: number,
): number {
  return relicIds.has('domain_mastery') && sameDomainCorrectStreak >= 5 ? 1.0 : 0;
}

// ─── Card Skip ──────────────────────────────────────────────────────

/**
 * Resolve bonus currency from skipping a card.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus currency per skipped card (scavengers_pouch: +1).
 */
export function resolveCardSkipCurrency(relicIds: Set<string>): number {
  return relicIds.has('scavengers_pouch') ? 1 : 0;
}

// ─── Floor Advance ──────────────────────────────────────────────────

/**
 * Resolve HP healed when advancing to the next floor.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @param maxHP    - Player's maximum HP (renewal_spring heals 10%).
 * @returns HP to heal on floor advance.
 */
export function resolveFloorAdvanceHeal(
  relicIds: Set<string>,
  maxHP: number,
): number {
  return relicIds.has('renewal_spring') ? Math.floor(maxHP * 0.1) : 0;
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

// ─── Combo Start ────────────────────────────────────────────────────

/**
 * Resolve the starting combo multiplier index.
 * Default combo starts at index 0 (1.0x); combo_ring starts at index 1 (1.15x).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Starting combo index (0 or 1).
 */
export function resolveComboStartValue(relicIds: Set<string>): number {
  return relicIds.has('combo_ring') ? 1 : 0;
}

// ─── Speed Bonus ────────────────────────────────────────────────────

/**
 * Resolve the speed bonus multiplier granted for fast answers.
 * Default is 1.5x (+50%); sharp_eye upgrades it to 1.75x (+75%).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Speed bonus multiplier.
 */
export function resolveSpeedBonusMultiplier(relicIds: Set<string>): number {
  return relicIds.has('sharp_eye') ? 1.75 : 1.5;
}

// ─── Speed Bonus Threshold ──────────────────────────────────────────

/**
 * Resolve the timer percentage at which the speed bonus activates.
 * Default is 25% of timer remaining; speed_charm changes to 30%; speed_reader to 15%.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Speed bonus threshold as a fraction (0.25, 0.30, or 0.15).
 */
export function resolveSpeedBonusThreshold(relicIds: Set<string>): number {
  if (relicIds.has('speed_reader')) return 0.15;
  if (relicIds.has('speed_charm')) return 0.30;
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

// ─── Echo ───────────────────────────────────────────────────────────

/**
 * Determine whether echo cards should play at full power (1.0x) instead of the
 * default reduced multiplier (0.7x).
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns True if echo_lens is held and echoes should deal full damage.
 */
export function shouldEchoPlayFullPower(relicIds: Set<string>): boolean {
  return relicIds.has('echo_lens');
}

// ─── Max HP Bonus (Run Start) ───────────────────────────────────────

/**
 * Resolve bonus max HP applied at run start.
 *
 * @param relicIds - Set of relic IDs the player currently holds.
 * @returns Bonus max HP (vitality_ring: +8).
 */
export function resolveMaxHpBonus(relicIds: Set<string>): number {
  return relicIds.has('vitality_ring') ? 8 : 0;
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
