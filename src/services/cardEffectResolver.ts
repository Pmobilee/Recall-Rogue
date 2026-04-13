// === Card Effect Resolver ===
// Resolves card play into effect results. Does not mutate player/enemy state.

import type { Card, CardType } from '../data/card-types';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { EnemyInstance } from '../data/enemies';
import {
  BASE_EFFECT,
  CHARGE_CORRECT_MULTIPLIER,
  SURGE_CC_BONUS_MULTIPLIER,
  getBalanceOverrides,
  CURSED_QP_MULTIPLIER,
  CURSED_CHARGE_CORRECT_MULTIPLIER,
  CURSED_CHARGE_WRONG_MULTIPLIER,
} from '../data/balance';
import { getMasteryBaseBonus, getMasterySecondaryBonus, getMasteryStats } from './cardUpgradeService';
import { isVulnerable, getStrengthModifier } from '../data/statusEffects';
import { getMechanicDefinition, MECHANIC_DEFINITIONS, type PlayMode } from '../data/mechanics';
import { resolveAttackModifiers, resolveShieldModifiers, resolvePoisonDurationBonus } from './relicEffectResolver';
import { getAuraLevel, getAuraState, adjustAura } from './knowledgeAuraSystem';
export interface CardEffectResult {
  effectType: CardType;
  rawValue: number;
  finalValue: number;
  targetHit: boolean;
  damageDealt: number;
  shieldApplied: number;
  healApplied: number;
  statusesApplied: StatusEffect[];
  extraCardsDrawn: number;
  enemyDefeated: boolean;
  mechanicId?: string;
  mechanicName?: string;
  damageDealtBypassesBlock?: boolean;
  selfDamage?: number;
  reflectDamage?: number;
  persistentShield?: number;
  parryDrawBonus?: number;
  overhealToShield?: number;
  grantsAp?: number;
  applyDoubleStrikeBuff?: boolean;
  /** double_strike charge bonus: next attack also pierces (charge_correct only). */
  doubleStrikeAddsPierce?: boolean;
  applyFocusBuff?: boolean;
  /** Number of cards that will benefit from Focus AP reduction (1 = normal, 2 = Focus+). */
  focusCharges?: number;
  applySlow?: boolean;
  /** slow: if true, Slow can skip ANY enemy action type (slow_any_action tag). */
  slowAnyAction?: boolean;
  applyForesight?: boolean;
  applyTransmute?: boolean;
  applyImmunity?: boolean;
  applyOverclock?: boolean;
  drawCountOverride?: number;
  /** thorns: reflect this much damage back to enemy when hit */
  thornsValue?: number;
  /** cleanse: remove debuffs from player */
  applyCleanse?: boolean;
  /** mirror: copy the previous card's full effect result */
  mirrorCopy?: boolean;
  /** adapt: cleanse one random debuff from player */
  adaptCleanse?: boolean;
  /** recycle charge_correct bonus: number of cards to draw from discard pile */
  drawFromDiscard?: number;
  /** AR-203: Burn stacks to apply to the target on this card play. */
  applyBurnStacks?: number;
  /** AR-203: Bleed stacks to apply to the target on this card play. */
  applyBleedStacks?: number;
  /**
   * AR-203: If set, this card's damage was resolved as N separate hits.
   * Burn triggers once per hit (halving after each). turnManager resolves per-hit loop.
   * When hitCount > 1, damageDealt in this result is the PER-HIT base value (not total).
   */
  hitCount?: number;
  /** AR-206: If set, enemy's next action should be skipped (stagger mechanic). */
  applyStagger?: boolean;
  /** AR-206: If true, also apply Vulnerable (for Bash CC stagger CC bonus). */
  staggerAppliesVulnerable?: boolean;
  /** AR-206: Number of enemy block points to remove (corrode mechanic). Negative = remove all. */
  removeEnemyBlock?: number;
  /** AR-206: Pending Burn stacks that will be added to the next attack played (ignite buff). */
  applyIgniteBuff?: number;
  /** AR-206: Cards to discard and then draw (swap mechanic). */
  swapDiscardDraw?: { discardCount: number; drawCount: number };
  /** AR-206: Number of cards to retrieve from discard pile to top of draw (scavenge). */
  scavengeCount?: number;
  /** AR-206: Number of cards to look at and discard count (sift mechanic). */
  siftParams?: { lookAt: number; discardCount: number };
  /** AR-206: Heal from overkill (siphon_strike). Value is already computed. */
  overkillHeal?: number;
  /** AR-206: Extra block granted to same-chain cards in hand (aegis_pulse CC). */
  chainBlockBonus?: number;
  /** AR-207: Gambit self-damage amount (QP: 2, CW: 5; reduced by 1 at L3+). */
  gambitselfDamage?: number;
  /** AR-207: Gambit CC heal amount. */
  gambitHeal?: number;
  /** AR-207: If true, the card should be forgotten after resolution (volatile_slash CC, burnout_shield CC). */
  forgetOnResolve?: boolean;
  /** AR-207: Knowledge Ward — block is per-domain (value = block per unique domain, resolver sets finalValue). */
  knowledgeWardBlock?: number;
  /**
   * AR-207: Warcry — apply strength status to player.
   * value = stacks, turnsRemaining = 99 for permanent (rest of combat), 1 for this-turn only.
   */
  applyStrengthToPlayer?: { value: number; permanent: boolean };
  /** AR-207: Warcry CC — next Charge this turn costs +0 AP surcharge. */
  warcryFreeCharge?: boolean;
  /** AR-207: Battle Trance lockout — set battleTranceRestriction on turn state. */
  applyBattleTranceRestriction?: boolean;
  /** AR-207: Number of cards to draw immediately (battle_trance). */
  battleTranceDraw?: number;
  /** AR-207: Curse of Doubt — apply charge_damage_amp_percent status to enemy. */
  applyChargeDamageAmpPercent?: { value: number; turns: number };
  /** AR-207: Mark of Ignorance — apply charge_damage_amp_flat status to enemy. */
  applyChargeDamageAmpFlat?: { value: number; turns: number };
  /**
   * AR-207: Phase Shift — pending choice for QP/CW (player must choose dmg or block).
   * 'damage' | 'block'. Resolved by turnManager when choice returns.
   * For now auto-selects damage when no popup is wired.
   */
  phaseShiftChoice?: 'damage' | 'block' | 'pending';
  /** AR-207: Phase Shift CC — both damage AND block simultaneously. */
  phaseShiftBothDmgAndBlock?: { damage: number; block: number };
  /**
   * AR-207: Chameleon — copy last card's base mechanic at the given multiplier.
   * turnManager resolves the actual copy using lastPlayedMechanicId.
   */
  chameleonMultiplier?: number;
  /** AR-207: Chameleon CC — inherit the last played card's chain type. */
  chameleonInheritChain?: boolean;
  /**
   * AR-207: Dark Knowledge — damage per cursed fact (already multiplied in damageDealt).
   * Stored for UI display.
   */
  darkKnowledgeDmgPerCurse?: number;
  /**
   * AR-207: Chain Anchor CC — set chainAnchorActive flag on turn state.
   * Chain Anchor is NOT a chain link itself.
   */
  applyChainAnchor?: boolean;
  /**
   * AR-207: Unstable Flux — random/choice result.
   * 'damage' | 'block' | 'draw' | 'debuff'
   */
  unstableFluxEffect?: 'damage' | 'block' | 'draw' | 'debuff';
  /**
   * AR-207: Chain Lightning CC damage multiplied by chain length.
   * This value is set in turnManager after extending the chain.
   * The resolver sets a sentinel (8 base) and turnManager overrides.
   */
  chainLightningChainLength?: number;

  // ── AR-208: Phase 3 Advanced / Chase Card result fields ──────────────────

  /** Catalyst: double enemy Poison stacks (QP/CW/CC). */
  poisonDoubled?: boolean;
  /** Catalyst CC: also double enemy Burn stacks. */
  burnDoubled?: boolean;
  /** Catalyst L3 QP: also double enemy Bleed stacks. */
  bleedDoubled?: boolean;
  /** Conversion: block consumed from player (1:1 to damage). */
  blockConsumed?: number;
  /** Eruption X-cost: total AP consumed by X drain. */
  xCostApConsumed?: number;
  /** Synapse CC: wildcard chain link — extend active chain by 1. */
  applyWildcardChainLink?: boolean;
  /** Hemorrhage: consume all Bleed stacks after damage is calculated. */
  consumeAllBleed?: boolean;
  /** Frenzy: number of free-play charges granted this turn. */
  frenzyChargesGranted?: number;
  /** War Drum: base effect bonus to apply to all current hand cards. */
  warDrumBonus?: number;
  /** Mastery Surge: number of random hand cards to bump by +1 mastery. */
  masteryBumpsCount?: number;
  /** Inscription of Wisdom: inscription fizzled on CW. */
  inscriptionFizzled?: boolean;
  /** Inscription of Wisdom: inscription activated; payload for EncounterState. */
  inscriptionWisdomActivated?: { extraDrawPerCC: number; healPerCC: number };
  /** Siphon Knowledge: duration in seconds to show answer preview overlay. */
  siphonAnswerPreviewDuration?: number;
  /** Tutor: tutored card should get free-this-turn flag on CC. */
  tutoredCardFree?: boolean;
  /** Aftershock: mechanic ID to repeat and its power multiplier. */
  aftershockRepeat?: { mechanicId: string; multiplier: number };
  /** Mimic: mechanic ID to replay and its power multiplier. */
  mimicReplay?: { mechanicId: string; multiplier: number; fromDiscard: boolean };
  /** Recollect: number of forgotten cards to return to discard pile. */
  forgottenCardsToReturn?: number;
  /** Sacrifice: AP gained (can exceed MAX_AP_PER_TURN). */
  sacrificeApGain?: number;
  /** Ironhide: Strength granted and whether it is permanent. */
  ironhideStrength?: { amount: number; permanent: boolean };
  /** Bulwark / Volatile Slash / Burnout Shield: forget this card after resolving. */
  forgetAfterPlay?: boolean;
  /** Archive: number of cards to retain in hand at turn end. */
  archiveRetainCount?: number;
  /** archive_block2_per tag: block bonus applied to each retained card. */
  archiveBlockBonus?: number;
  /** scout_scry2 tag: number of cards to scry (look at top N, discard some). */
  scryCount?: number;
  /** recycle_discard_pick tag: player picks which card to draw from discard. */
  recycleChoose?: boolean;
  /** foresight_intent tag: show enemy's next intent (not just current). */
  showNextIntent?: boolean;
  /** sift_discard_dmg2 tag: each discarded sift card deals N damage to enemy. */
  discardDamage?: number;
  /** siphon_eliminate1 tag: eliminate N wrong answers from the quiz. */
  eliminateDistractor?: number;
  /** recollect_upgrade1 tag: returned forgotten cards get +1 mastery. */
  recollectUpgrade?: number;
  /** recollect_play_free tag: play 1 returned card free this turn. */
  recollectPlayFree?: boolean;
  /** synapse_chain_plus1 tag: wildcard chain link grants +1 chain bonus. */
  synapseChainBonus?: number;
  /** flux_double tag: unstable_flux fires its effect twice. */
  fluxDouble?: boolean;
  /** catalyst_triple tag: triple stacks instead of doubling (Catalyst). */
  catalystTriple?: boolean;
  /** mimic_choose tag: player chooses from discard instead of random pick. */
  mimicChoose?: boolean;
  /** aftershock_no_quiz tag: CC repeat doesn't require a quiz answer. */
  aftershockNoQuiz?: boolean;
  /** kbomb_count_past tag: knowledge_bomb CC counts all charges this RUN (not just encounter). */
  kbombCountPast?: boolean;
  /** dark_heal1_per_curse tag: dark_knowledge also heals 1 HP per cursed fact. */
  darkHealPerCurse?: number;
  /** ignite_2attacks tag: ignite buff applies to next N attacks instead of 1. */
  igniteDuration?: number;
  /** trance_cc_ap1 tag: battle_trance CC grants +1 AP. */
  apGain?: number;
  /** msurge_plus2 tag: mastery_surge gives +2 mastery per bumped card. */
  masteryBumpAmount?: number;
  // ── Phase 3 result fields ─────────────────────────────────────────────────
  /** reinforce_perm1 tag: signal turnManager to increment reinforcePermanentBonus after applying. */
  reinforcePermanentBonusIncrement?: boolean;
  /** msurge_ap_on_l5 tag: signal turnManager that a card reached L5 this surge — grant +1 AP. */
  masteryReachedL5Count?: number;
  /** absorb_ap_on_block tag: AP to grant when absorb is played Charge Correct. */
  apOnBlockGain?: number;
  /** power_vuln2t tag: Vulnerable applied by power_strike lasts 2 turns instead of 1. */
  vulnDurationOverride?: number;
  /** twin_burn_chain tag: twin_strike hits prevent Burn damage halving this play. */
  twinBurnChainActive?: boolean;
  /** riposte_block_dmg40 tag: add Math.floor(playerBlock * 0.4) bonus damage. */
  riposteBlockDmgBonus?: number;
  /** iron_wave_block_double tag: double the damage component if player has 10+ block. */
  ironWaveDoubleDmg?: boolean;
  /** empower_weak2 tag: when an empowered attack fires, also apply 2 Weakness to enemy. */
  empowerWeakStacks?: number;
  /** thorns: if true, thorns value persists after the encounter ends (thorns_persist tag). */
  thornsPersist?: boolean;
  /** fortify: if true, block carries over to next turn (fortify_carry tag). */
  blockCarries?: boolean;
  /** parry: deals N damage back to attacker when enemy attacks (parry_counter3 tag). */
  counterDamage?: number;
  /** overheal: heals N% of max HP in addition to block (overheal_heal_pct5 tag). */
  healPctApplied?: number;
  /** guard: enemy must attack the player next turn — N turns duration (guard_taunt1t tag). */
  tauntDuration?: number;
  /** shrug_it_off / cleanse: remove N debuffs from player (shrug_cleanse1 tag). */
  removeDebuffCount?: number;
  /** empower: number of cards that get the buff (empower_2cards = 2, default 1). */
  empowerTargetCount?: number;
  /** focus: number of future cards that cost 0 AP (focus_next2free = 2). */
  freePlayCount?: number;
  /** inscription_fury (CC): flat per-attack bonus stacks from insc_fury_cc_bonus2 tag. */
  inscriptionFuryCcBonus?: number;
  /** inscription_iron: thorns per turn granted alongside block (insc_iron_thorns1 tag). */
  inscriptionIronThorns?: number;
  /**
   * AR-207 (wired): Phase Shift QP/CW or Unstable Flux CC deferred choice.
   * When set, the card's primary effect has NOT been applied yet — the UI must show
   * a MultiChoicePopup and call applyPendingChoice() with the selected option id.
   * damageDealt/shieldApplied in this result are 0 (no premature effects).
   */
  pendingChoice?: {
    mechanicId: 'phase_shift' | 'unstable_flux';
    options: Array<{
      id: string;
      label: string;
      damageDealt?: number;
      shieldApplied?: number;
      extraCardsDrawn?: number;
      statusesApplied?: Array<{ type: string; value: number; turnsRemaining: number }>;
    }>;
  };
  /**
   * Card picker deferred choice — when set, the UI shows CardPickerOverlay with candidate cards.
   * Used by Transmute, Adapt, Conjure, Scavenge, Forge, Mimic.
   */
  pendingCardPick?: {
    type: 'transmute' | 'adapt' | 'conjure' | 'scavenge' | 'forge' | 'mimic';
    sourceCardId: string;
    candidates: import('../data/card-types').Card[];
    pickCount: number;
    allowSkip: boolean;
    title: string;
  };
  /**
   * Transmute QP/CW — auto-pick one random candidate and swap source card in-place.
   * turnManager handles the actual in-place swap via applyTransmuteSwap().
   */
  applyTransmuteAuto?: { sourceCardId: string; selected: Card };
  /** Tag: rupture_bleed_perm — bleed applied by this card does not decay each turn. */
  bleedPermanent?: boolean;
  /** Tag: precision_timer_ext50 — quiz timer extended by 50% for this card's charge quiz. */
  timerExtensionPct?: number;
  /** Tag: eruption_refund1 — refund 1 AP after eruption resolves. */
  apRefund?: number;
}

export interface AdvancedResolveOptions {
  activeRelicIds?: Set<string>;
  isFirstAttackThisEncounter?: boolean;
  isDoubleStrikeActive?: boolean;
  isFocusActive?: boolean;
  isOverclockActive?: boolean;
  damageDealtThisTurn?: number;
  /** Whether the card was answered correctly. Defaults to true. */
  correct?: boolean;
  /** How the card was played (quick/charge/charge_correct/charge_wrong). */
  playMode?: PlayMode;
  /** Knowledge Chain multiplier (1.0 = no chain). */
  chainMultiplier?: number;
  /**
   * Count of cards per domain in the active deck (draw + discard + hand, not forget pile).
   * Keyed by FactDomain string. Required for domain_mastery_sigil v2.
   */
  deckDomainCounts?: Record<string, number>;
  /**
   * AR-204: Flat damage bonus from active Inscription of Fury. Added at damage pipeline step 3,
   * after mastery bonus and before relic flat bonuses. Only applies to attack cards.
   */
  inscriptionFuryBonus?: number;
  /**
   * AR-207: Unique domain strings from the current hand (for knowledge_ward).
   * Populated by turnManager at resolve time. Deduplicated before passing.
   */
  handDomains?: string[];
  /**
   * AR-207: Count of cursed facts in runState.cursedFactIds at the time this card was played.
   * Snapshotted by turnManager before resolving dark_knowledge.
   */
  cursedFactCount?: number;

  // ── AR-208: Phase 3 Advanced / Chase Card input fields ───────────────────

  /**
   * AR-208 Smite: mastery levels of all cards currently in hand (including Smite itself).
   * Cursed cards are treated as effective mastery 0.
   * Populated by turnManager at resolve time.
   */
  handMasteryValues?: number[];

  /**
   * AR-208 Recall: current size of the discard pile at resolve time (snapshot before Recall itself is added).
   * Populated by turnManager.
   */
  discardPileSize?: number;

  /**
   * AR-208 Hemorrhage: current Bleed stacks on the enemy at resolve time.
   * Consumed (set to 0) after damage calculation; passed from EncounterState by turnManager.
   */
  enemyBleedStacks?: number;

  /**
   * AR-208 Knowledge Bomb: total correct Charges in this encounter INCLUDING the current CC play.
   * Increment happens before damage calculation in turnManager.
   */
  correctChargesThisEncounter?: number;

  /**
   * AR-208 Eruption: remaining AP AFTER surcharge deduction, before X drain.
   * Computed and passed by turnManager so the resolver is pure.
   */
  eruptionXAp?: number;

  /**
   * AR-208 Aftershock: mechanic ID of the last card played in each mode this turn.
   * Reset at turn start by turnManager.
   */
  lastQPMechanicThisTurn?: string | null;
  lastCCMechanicThisTurn?: string | null;
  lastAnyMechanicThisTurn?: string | null;

  /**
   * AR-261 Review Queue: true if this card's factId was in the review queue
   * (i.e., was previously answered wrong this encounter) and was cleared by this correct Charge.
   * Used by cards like Recall to grant bonus effects on review-queue facts.
   */
  wasReviewQueueFact?: boolean;

  /**
   * AR-264 Precision Strike: number of wrong-answer options shown in the quiz question.
   * Determined by card mastery level (mastery 0 = 2 distractors, mastery 3+ = 4 distractors).
   * Populated by turnManager at resolve time from the quiz context.
   */
  distractorCount?: number;

  /**
   * Scar Tissue (v3): accumulated wrong Charges this run.
   * Passed to resolveAttackModifiers for +2 flat damage per stack.
   * Populated by turnManager module-level counter.
   */
  scarTissueStacks?: number;

  /**
   * Per-fact damage bonus from mystery event study sessions (Tutor's Office, Flashcard Merchant, etc.).
   * Applied as a multiplier to attack damage: damage *= (1 + factDamageBonus).
   * Populated by turnManager from InRunFactTracker.getDamageBonus(card.factId).
   * 0 = no bonus.
   */
  factDamageBonus?: number;

  /**
   * Whether this card play is on a Surge turn.
   * When true and the play is Charge Correct, damage is multiplied by SURGE_CC_BONUS_MULTIPLIER (1.5).
   * Populated by turnManager from turnState.isSurge.
   */
  isSurge?: boolean;
  /**
   * Phase 2: Override for the Vulnerable damage multiplier (expose_vuln75 passive).
   * When set, replaces the default 1.5x multiplier applied when enemy is Vulnerable.
   * Populated by turnManager from turnState.vulnMultiplierOverride.
   */
  vulnMultiplierOverride?: number | null;
  /**
   * Phase 2: Cards played this turn so far (for strike_tempo3 tag).
   * Populated by turnManager from turnState.cardsPlayedThisTurn.
   */
  cardsPlayedThisTurn?: number;
  /**
   * Phase 2: Cumulative self-damage taken this encounter (for reckless_selfdmg_scale3 tag).
   * Populated by turnManager from turnState.selfDamageTakenThisEncounter.
   */
  selfDamageTakenThisEncounter?: number;
  /**
   * Phase 2: Whether the player played a shield card last turn (for block_consecutive3 tag).
   * Populated by turnManager from turnState.lastTurnPlayedShield.
   */
  lastTurnPlayedShield?: boolean;
  /**
   * Phase 2: Stacking block bonus from reinforce_perm1 tag (encounter-scoped).
   * Populated by turnManager from turnState.reinforcePermanentBonus.
   */
  reinforcePermanentBonus?: number;

  /**
   * Continuous accuracy for interactive quiz modes (0.0 = complete miss, 1.0 = perfect).
   * When set, damage interpolates between charge-wrong and charge-correct values.
   * Only used by map_pin and future interactive modes.
   * When undefined, behavior is binary (existing charge_correct/charge_wrong logic).
   */
  partialAccuracy?: number;
}

export function isCardBlocked(card: Card, enemy: EnemyInstance): boolean {
  return enemy.template.immuneDomain != null && card.domain === enemy.template.immuneDomain;
}

/** Get base effect value for a card type, checking overrides first. */
function getBaseEffect(cardType: string): number {
  const overrides = getBalanceOverrides();
  if (overrides) {
    if (cardType === 'attack' && overrides.baseEffectAttack !== undefined) return overrides.baseEffectAttack;
    if (cardType === 'shield' && overrides.baseEffectShield !== undefined) return overrides.baseEffectShield;
  }
  return BASE_EFFECT[cardType as keyof typeof BASE_EFFECT] ?? 0;
}

/** Generate 3 candidate cards for Transmute card picker */
function generateTransmuteCandidates(sourceMasteryLevel: number): Card[] {
  const types: CardType[] = ['attack', 'shield'];
  const thirdType: CardType = (['utility', 'buff', 'debuff'] as CardType[])[Math.floor(Math.random() * 3)];
  types.push(thirdType);

  return types.map((cardType, i) => {
    const pool = MECHANIC_DEFINITIONS.filter(m => m.type === cardType);
    if (pool.length === 0) return null;
    const mechanic = pool[Math.floor(Math.random() * pool.length)];

    // Determine mastery level of the candidate
    let candidateMastery = 0;
    if (sourceMasteryLevel >= 3) candidateMastery = sourceMasteryLevel;
    else if (sourceMasteryLevel >= 2) candidateMastery = 1;
    else if (sourceMasteryLevel >= 1 && i === 0) candidateMastery = 1; // First option gets mastery at level 1

    return {
      id: `transmute_candidate_${i}`,
      factId: '',
      cardType,
      mechanicId: mechanic.id,
      mechanicName: mechanic.name,
      apCost: mechanic.apCost,
      baseEffectValue: mechanic.baseValue,
      originalBaseEffectValue: mechanic.baseValue,
      effectMultiplier: 1.0,
      tier: '1' as const,
      domain: 'general_knowledge',
      chainType: Math.floor(Math.random() * 6),
      masteryLevel: candidateMastery,
    } satisfies Card;
  }).filter(Boolean) as Card[];
}

export function resolveCardEffect(
  card: Card,
  playerState: PlayerCombatState,
  enemy: EnemyInstance,
  speedBonus: number,
  buffNextCard: number,
  lastCardType?: CardType,
  passiveBonuses?: Partial<Record<CardType, number>>,
  advanced: AdvancedResolveOptions = {},
): CardEffectResult {
  const activeRelicIds = advanced.activeRelicIds ?? new Set<string>();
  const mechanic = getMechanicDefinition(card.mechanicId);

  const result: CardEffectResult = {
    effectType: card.cardType,
    rawValue: 0,
    finalValue: 0,
    targetHit: true,
    damageDealt: 0,
    shieldApplied: 0,
    healApplied: 0,
    statusesApplied: [],
    extraCardsDrawn: 0,
    enemyDefeated: false,
    mechanicId: card.mechanicId,
    mechanicName: card.mechanicName,
  };

  if (isCardBlocked(card, enemy)) {
    result.targetHit = false;
    return result;
  }

  let effectiveType: CardType = card.cardType;
  if (card.cardType === 'wild' && card.mechanicId !== 'overclock') {
    effectiveType = lastCardType ?? 'attack';
    result.effectType = effectiveType;
    const baseValue = getBaseEffect(effectiveType);
    card = { ...card, baseEffectValue: baseValue > 0 ? baseValue : card.baseEffectValue };
  }

  const chainMultiplier = advanced.chainMultiplier ?? 1.0;
  const buffMultiplier = 1 + buffNextCard / 100;
  const overclockMultiplier = advanced.isOverclockActive ? 2 : 1;
  const correct = advanced.correct ?? true;
  const playMode: PlayMode = advanced.playMode ?? 'quick';
  const baseEffectValue = card.baseEffectValue;

  // focusAdjustedMultiplier is always 1.0 — tier-based damage scaling removed.
  const focusAdjustedMultiplier = 1.0;

  // Per-mechanic play-mode values: use mechanic's quickPlayValue / chargeCorrectValue / chargeWrongValue
  // if available; otherwise fall back to card.baseEffectValue with tier scaling (legacy path).
  const isChargeCorrect = playMode === 'charge' || playMode === 'charge_correct';
  const isChargeWrong = playMode === 'charge_wrong';

  // Apply mastery bonus (AR-113) before charge multiplier so CC also scales the mastery bonus.
  // getMasteryStats() checks MASTERY_STAT_TABLES first, falls back to perLevelDelta synthesis.
  // masteryBonus = stats.qpValue - mechanic.quickPlayValue so existing math (qpValue + masteryBonus) is unchanged.
  const _masteryStats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0);
  // Tag helper — checks cumulative tags active at the card's current mastery level.
  // stats is an alias for _masteryStats for brevity in case handlers.
  const stats = _masteryStats;
  const activeTags = _masteryStats?.tags ?? [];
  const hasTag = (tag: string) => activeTags.includes(tag);
  const masteryBonus = _masteryStats
    ? _masteryStats.qpValue - (getMechanicDefinition(card.mechanicId ?? '')?.quickPlayValue ?? 0)
    : getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);

  let mechanicBaseValue: number;
  if (mechanic) {
    if (isChargeCorrect) {
      // Mastery added inside multiplier so CC scales both base and mastery equally.
      mechanicBaseValue = Math.round((mechanic.quickPlayValue + masteryBonus) * CHARGE_CORRECT_MULTIPLIER);
    } else if (isChargeWrong) {
      mechanicBaseValue = Math.max(0, mechanic.chargeWrongValue + masteryBonus);
    } else {
      // quick / quick_play
      mechanicBaseValue = mechanic.quickPlayValue + masteryBonus;
    }
  } else {
    // No mechanic definition (wild fallback, unknown mechanic).
    mechanicBaseValue = baseEffectValue + masteryBonus;
  }

  // Partial credit interpolation for interactive quiz modes (map_pin, estimation_arena, etc.)
  // When partialAccuracy is defined, interpolate between CW and CC values.
  // When undefined (all existing modes), this block is skipped — zero behavior change.
  if (advanced.partialAccuracy !== undefined && mechanic && (isChargeCorrect || isChargeWrong)) {
    const cwValue = Math.max(0, mechanic.chargeWrongValue + masteryBonus);
    const ccValue = Math.round((mechanic.quickPlayValue + masteryBonus) * CHARGE_CORRECT_MULTIPLIER);
    mechanicBaseValue = Math.round(cwValue + (ccValue - cwValue) * advanced.partialAccuracy);
  }

  // Use stat table secondary value if available; fall back to old perLevelDelta helper.
  const masterySecondaryBonus = (_masteryStats?.secondaryValue != null && mechanic?.secondaryValue != null)
    ? _masteryStats.secondaryValue - mechanic.secondaryValue
    : getMasterySecondaryBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  // Apply mastery secondary bonus to a copy of the card so switch cases can read it uniformly.
  // Use !== 0 (not > 0) so stat tables can define lower secondary values than mechanic defaults.
  // Math.max(0, ...) prevents negative secondary values from propagating.
  if (masterySecondaryBonus !== 0 && mechanic) {
    const currentSecondary = card.secondaryValue ?? mechanic.secondaryValue ?? 0;
    card = { ...card, secondaryValue: Math.max(0, currentSecondary + masterySecondaryBonus) };
  }

  // AR-202: Apply cursed multipliers if the card carries a cursed fact.
  // Applied after mastery bonus but before tier/combo/chain/relic multipliers.
  if (card.isCursed) {
    const isQuickPlay2 = playMode === 'quick' || playMode === 'quick_play';
    const isChargeCorrect2 = playMode === 'charge' || playMode === 'charge_correct';
    const isChargeWrong2 = playMode === 'charge_wrong';
    // Scar Tissue relic stub (AR-203): overrides QP multiplier to 0.85 on QP plays.
    let cursedQpMult = CURSED_QP_MULTIPLIER; // 0.7
    if (isQuickPlay2 && activeRelicIds.has('scar_tissue')) {
      cursedQpMult = 0.85;
    }
    if (isQuickPlay2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * cursedQpMult);
    } else if (isChargeCorrect2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * CURSED_CHARGE_CORRECT_MULTIPLIER); // 1.0 — no change
    } else if (isChargeWrong2) {
      mechanicBaseValue = Math.round(mechanicBaseValue * CURSED_CHARGE_WRONG_MULTIPLIER); // 0.5
    }
  }

  const strikeTag = mechanic?.tags.includes('strike') ?? false;
  const sharpenedEdgeBonus = strikeTag && activeRelicIds.has('barbed_edge') ? 3 : 0;
  // AR-204: Inscription of Fury bonus — flat damage at pipeline step 3 (after mastery, before relic flat bonuses).
  // Only applies to attack cards; non-attack types are unaffected.
  const furyBonus = effectiveType === 'attack' ? (advanced.inscriptionFuryBonus ?? 0) : 0;

  // AR-CHAIN-REWORK: Chain scales mechanic base BEFORE flat bonuses and other multipliers.
  // Only attack/shield cards get chain-adjusted base; buffs/debuffs/utility use raw base.
  const chainAdjustedMechanicBase = Math.round(mechanicBaseValue * chainMultiplier);

  const effectiveBase = (effectiveType === 'attack' || effectiveType === 'shield')
    ? chainAdjustedMechanicBase + sharpenedEdgeBonus + furyBonus
    : mechanicBaseValue + sharpenedEdgeBonus + furyBonus;

  // ── Relic attack modifiers ──────────────────────────────────────────────────
  // resolveAttackModifiers handles all attack-boosting relics (whetstone, flame_brand,
  // glass_cannon, berserker_band, etc.). We read playerState for HP context.
  const relicAttackMods = effectiveType === 'attack'
    ? resolveAttackModifiers(activeRelicIds, {
        isFirstAttack: advanced.isFirstAttackThisEncounter ?? false,
        isStrikeTagged: strikeTag,
        playerHpPercent: playerState.hp / playerState.maxHP,
        consecutiveCorrectAttacks: 0, // crescendo_blade context not tracked in card resolver; zero is safe
        cardTier: typeof card.tier === 'string' ? card.tier : 'learning',
        correctStreakThisEncounter: 0, // memory_palace context not tracked here; handled upstream
        enemyHpPercent: enemy.currentHP / enemy.maxHP,
        enemyPoisonStacks: (enemy.statusEffects ?? []).filter(s => s.type === 'poison').reduce((sum, s) => sum + (s.value ?? 0), 0),
        cardDomain: card.domain,
        deckDomainCounts: advanced.deckDomainCounts,
        scarTissueStacks: advanced.scarTissueStacks,
      })
    : null;

  // ── Relic shield modifiers ──────────────────────────────────────────────────
  const relicShieldMods = (effectiveType === 'shield' || effectiveType === 'wild')
    ? resolveShieldModifiers(activeRelicIds, { shieldCardPlayCountThisEncounter: 0, wasCharged: isChargeCorrect })
    : null;

  // Build the attack relic multiplier from the resolver results.
  // Flat bonus is applied after scaling (added to finalValue below).
  // Percent bonus is applied as a multiplier here.
  const attackRelicMultiplier = relicAttackMods
    ? 1 + relicAttackMods.percentDamageBonus
    : 1;

  // Per-fact study bonus from mystery events (Tutor's Office, Flashcard Merchant, etc.).
  // Applied only to attack cards as a multiplicative bonus.
  const factDamageBonusMult = (effectiveType === 'attack' && (advanced.factDamageBonus ?? 0) > 0)
    ? 1 + (advanced.factDamageBonus ?? 0)
    : 1;

  // Surge CC bonus: on Surge turns, Charge Correct attacks deal extra damage.
  const surgeMultiplier = (advanced.isSurge && isChargeCorrect && effectiveType === 'attack')
    ? SURGE_CC_BONUS_MULTIPLIER
    : 1;

  const rawValue = effectiveBase * focusAdjustedMultiplier;
  result.rawValue = rawValue;
  const scaledValue = Math.round(rawValue * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier * factDamageBonusMult * surgeMultiplier);
  // Apply flat relic attack bonus after all multipliers (so it isn't multiplied by combo/chain).
  const relicFlatAttackBonus = relicAttackMods?.flatDamageBonus ?? 0;
  const finalValue = effectiveType === 'attack'
    ? scaledValue + relicFlatAttackBonus
    : scaledValue;
  result.finalValue = finalValue;

  // Flat shield bonus from relics (stone_wall: +3). Added to every shield result.
  const shieldRelicBonus = relicShieldMods?.flatBlockBonus ?? 0;

  // bastions_will Quick Play +25% block multiplier — only on Quick Play (not Charged).
  // The Charged +75% path is handled in turnManager via resolveChargeCorrectEffects.
  const isQuickPlay = playMode === 'quick' || playMode === 'quick_play';
  const quickPlayShieldMult = (isQuickPlay && (relicShieldMods?.quickPlayShieldBonus ?? 0) > 0)
    ? 1 + (relicShieldMods!.quickPlayShieldBonus / 100)
    : 1;

  const applyAttackDamage = (baseDamage: number): void => {
    const strengthMod = getStrengthModifier(playerState.statusEffects);
    let damage = Math.max(0, Math.round(baseDamage * strengthMod + (passiveBonuses?.attack ?? 0)));
    if (isVulnerable(enemy.statusEffects)) {
      // Phase 2: expose_vuln75 passive can override the default 1.5x Vulnerable multiplier
      const vulnMult = advanced.vulnMultiplierOverride ?? 1.5;
      damage = Math.round(damage * vulnMult);
    }
    result.damageDealt = damage;
    result.enemyDefeated = damage >= enemy.currentHP;
  };

  /**
   * Applies relic shield modifiers to a base shield value:
   *   result = Math.round((base + stone_wall_flat) * bastions_will_quick_play_mult)
   * - stone_wall +3 flat applies always.
   * - bastions_will +25% applies on Quick Play only; the Charged +75% path is in turnManager.
   * All callers pass their full pre-relic shield amount as `base`.
   */
  const applyShieldRelics = (base: number): number => Math.round((base + shieldRelicBonus) * quickPlayShieldMult);

  // Double Strike buff consumes on next attack card — full power per hit.
  if (advanced.isDoubleStrikeActive && effectiveType === 'attack') {
    const perHit = Math.round(finalValue * 1.0);
    applyAttackDamage(perHit * 2);
    return result;
  }

  // TODO(AR-203): mastery_surge must skip cards where isCursed === true — per Appendix F.
  // When mastery_surge is implemented, add: if (candidate.isCursed) continue; in its hand iteration.

  const mechanicId = card.mechanicId ?? '';
  switch (mechanicId) {
    case 'multi_hit': {
      // Use stat-table hitCount (mirrors twin_strike). card.secondaryValue seeded from mechanic.secondaryValue — dead data here.
      const hits = (_masteryStats?.hitCount ?? mechanic?.secondaryValue ?? 3) + (activeRelicIds.has('chain_lightning_rod') ? 1 : 0);
      // AR-203: Set hitCount so turnManager resolves Burn per-hit instead of combined.
      // damageDealt is set to the per-hit base value; turnManager accumulates the total.
      if (hits > 1) {
        applyAttackDamage(finalValue); // per-hit base (Vulnerable already applied)
        result.hitCount = hits;
        // Tag: multi_bleed1 — each hit applies 1 Bleed stack (1 turn).
        if (hasTag('multi_bleed1')) {
          result.statusesApplied.push({ type: 'bleed', value: Math.round(1 * chainMultiplier), turnsRemaining: 1 });
        }
        return result;
      }
      applyAttackDamage(finalValue * hits);
      return result;
    }
    case 'piercing': {
      result.damageDealtBypassesBlock = true;
      // Tag: pierce_strip3 — also strip 3 enemy block before damage.
      if (hasTag('pierce_strip3')) { result.removeEnemyBlock = 3; }
      applyAttackDamage(finalValue);
      // Tag: pierce_vuln1 — also apply Vulnerable 1t.
      if (hasTag('pierce_vuln1')) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    case 'reckless': {
      result.selfDamage = stats?.extras?.['selfDmg'] ?? card.secondaryValue ?? mechanic?.secondaryValue ?? 4;
      // Reckless bypasses enemy block — the self-damage trade-off only makes sense
      // if the attack always lands for full value, even against block-stacking enemies.
      result.damageDealtBypassesBlock = true;
      applyAttackDamage(finalValue);
      // Tag: reckless_selfdmg_scale3 — add selfDamageTakenThisEncounter * 3 as bonus damage.
      // Note: selfDamageTakenThisEncounter is the value BEFORE this play's self-damage.
      if (hasTag('reckless_selfdmg_scale3')) {
        const selfDmgBonus = (advanced.selfDamageTakenThisEncounter ?? 0) * 3;
        if (selfDmgBonus > 0) {
          result.damageDealt = (result.damageDealt ?? 0) + selfDmgBonus;
          result.enemyDefeated = result.damageDealt >= enemy.currentHP;
        }
      }
      return result;
    }
    case 'execute': {
      // 2026-04-11 audit fix (Severity A partial): QP execBonus normalized to stat-table extras.
      // Was: bonusBaseValue hardcoded as isCC?24 : isCW?4 : 8; threshold from mechanic.secondaryThreshold.
      // Now: QP reads _masteryStats.extras.execBonus (L0=8). CC kept at 24 — CC:QP ratio is 3:1,
      // incompatible with standard 1.5× formula (HARD STOP: would change 24→12). CW kept at 4.
      const execBonus = _masteryStats?.extras?.['execBonus'] ?? 8;
      const threshold = _masteryStats?.extras?.['execThreshold'] ?? mechanic?.secondaryThreshold ?? 0.3;
      const bonusBaseValue = isChargeCorrect ? 24 : (isChargeWrong ? 4 : execBonus);
      const chainAdjustedBonus = Math.round(bonusBaseValue * chainMultiplier);
      const scaledBonus = Math.round(chainAdjustedBonus * focusAdjustedMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier);
      const executeBonus = enemy.currentHP / enemy.maxHP < threshold ? scaledBonus : 0;
      applyAttackDamage(finalValue + executeBonus);
      return result;
    }
    case 'fortify': {
      // Entrench: gain block based on current block amount
      const currentBlock = playerState.shield ?? 0;
      // Cap at 30 to prevent exponential snowball (fortify cap, Pass 8 balance)
      const cappedBlock = Math.min(currentBlock, 30);
      if (isChargeCorrect) {
        // CC: gain 75% of capped block + card value (strong reward for correct answer)
        result.shieldApplied = Math.floor(cappedBlock * 0.75) + applyShieldRelics(finalValue);
      } else if (isChargeWrong) {
        // CW: gain 25% of capped block (minimal)
        result.shieldApplied = Math.floor(cappedBlock * 0.25);
      } else {
        // QP: gain 50% of capped block
        result.shieldApplied = Math.floor(cappedBlock * 0.5);
      }
      // L5: fortify_carry — block persists to next turn (blockCarries flag)
      if (hasTag('fortify_carry')) result.blockCarries = true;
      return result;
    }
    case 'parry': {
      result.shieldApplied = applyShieldRelics(finalValue);
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (enemyIsAttacking) result.parryDrawBonus = 1;
      // L5: parry_counter3 — deals 3 damage to attacker when hit
      if (hasTag('parry_counter3')) result.counterDamage = 3;
      return result;
    }
    case 'brace': {
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (!enemyIsAttacking) {
        // Non-attack intent: give minimum block from card value (half, rounded)
        result.shieldApplied = applyShieldRelics(finalValue);
        return result;
      }
      // Brace scales enemy intent by play-mode multiplier, card value acts as floor
      const braceMultiplier = isChargeCorrect ? 3.0 : (isChargeWrong ? 0.7 : 1.0);
      const intentBlock = Math.round(enemy.nextIntent.value * braceMultiplier);
      // L3+: brace_exceed2 — adds +2 to block when matching telegraph
      const braceExceedBonus = hasTag('brace_exceed2') ? 2 : 0;
      result.shieldApplied = applyShieldRelics(Math.max(intentBlock, finalValue) + braceExceedBonus);
      // L5: brace_draw1 — also draws 1 card
      if (hasTag('brace_draw1')) result.extraCardsDrawn = 1;
      return result;
    }
    case 'overheal': {
      const healthPercentage = playerState.hp / playerState.maxHP;
      const bonusMultiplier = healthPercentage < 0.6 ? 2.0 : 1.0;
      result.shieldApplied = applyShieldRelics(Math.round(finalValue * bonusMultiplier));
      // L3+: overheal_heal2 — also heals 2 HP
      if (hasTag('overheal_heal2')) result.healApplied = (result.healApplied ?? 0) + Math.round(2 * chainMultiplier);
      // L5: overheal_heal_pct5 — also heals 5% of max HP
      if (hasTag('overheal_heal_pct5')) result.healPctApplied = 5;
      return result;
    }
    case 'lifetap': {
      const damageFromCard = finalValue + (passiveBonuses?.attack ?? 0);
      // Tag: lifetap_heal30 — heal 30% of damage instead of 20%.
      const lifetapHealPct = hasTag('lifetap_heal30') ? 0.30 : 0.20;
      result.healApplied = Math.max(1, Math.floor(damageFromCard * lifetapHealPct));
      applyAttackDamage(damageFromCard);
      return result;
    }
    case 'quicken': {
      // L5: quicken_ap2 — grants +2 AP instead of +1
      result.grantsAp = hasTag('quicken_ap2') ? 2 : 1;
      // charge_correct bonus: also draw card(s); L1+: quicken_draw1 draws 1; L3+: quicken_draw2 draws 2
      if (isChargeCorrect) {
        result.extraCardsDrawn = hasTag('quicken_draw2') ? 2 : (hasTag('quicken_draw1') ? 1 : 1);
      } else if (hasTag('quicken_draw1') || hasTag('quicken_draw2')) {
        // On QP/CW: tag also adds a draw
        result.extraCardsDrawn = hasTag('quicken_draw2') ? 2 : 1;
      }
      result.finalValue = result.grantsAp;
      return result;
    }
    case 'focus': {
      result.applyFocusBuff = true;
      // charge_correct bonus: grant 2 focus charges (two cards get AP reduction)
      const focusCharges = isChargeCorrect ? 2 : 1;
      result.focusCharges = focusCharges;
      // L2+: focus_draw1 — also draws 1 card
      if (hasTag('focus_draw1')) result.extraCardsDrawn = 1;
      // L5: focus_next2free — next 2 cards cost 0 AP (overrides focusCharges)
      if (hasTag('focus_next2free')) result.freePlayCount = 2;
      return result;
    }
    case 'double_strike': {
      result.applyDoubleStrikeBuff = true;
      // charge_correct bonus: next attack also pierces
      if (isChargeCorrect) result.doubleStrikeAddsPierce = true;
      return result;
    }
    case 'slow': {
      result.applySlow = true;
      // L2+: slow_any_action — Slow can skip ANY enemy action, not just defend/buff
      // turnManager reads this flag to determine which actions are skippable
      if (hasTag('slow_any_action')) result.slowAnyAction = true;
      // charge_correct bonus: also apply Weakness 1t
      if (isChargeCorrect) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      // L5: slow_weak1t — QP/CW also apply Weakness 1t
      if (!isChargeCorrect && hasTag('slow_weak1t')) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    case 'hex': {
      // 2026-04-11 audit fix (Severity A partial): QP/CW normalized to stat-table extras.
      // Was: poisonValue hardcoded as isCC?8 : isCW?2 : 3; turns hardcoded 3.
      // Now: QP reads _masteryStats.extras.stacks (L0=3). CC kept at 8 — CC:QP ratio is 2.67:1,
      // incompatible with standard 1.5× formula (HARD STOP: would change 8→5). CW kept at 2.
      const hexStacksQP = _masteryStats?.extras?.['stacks'] ?? 3;
      const hexTurnsQP = _masteryStats?.extras?.['turns'] ?? 3;
      const poisonValue = isChargeCorrect ? 8 : (isChargeWrong ? 2 : hexStacksQP);
      // plague_flask — poison lasts 1 extra turn
      const poisonTurns = hexTurnsQP + resolvePoisonDurationBonus(activeRelicIds);
      result.statusesApplied.push({ type: 'poison', value: Math.round(poisonValue * chainMultiplier), turnsRemaining: poisonTurns });
      // L3+: hex_vuln1t — also apply Vulnerable 1t
      if (hasTag('hex_vuln1t')) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    case 'foresight': {
      // draw count scales with play mode
      const drawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = drawCount;
      // foresight_intent: reveal enemy's NEXT intent (the one after current)
      if (hasTag('foresight_intent')) {
        result.showNextIntent = true;
      }
      // T1.6: forget keyword — Foresight is removed from combat after use (one-per-combat nerf)
      if (hasTag('forget')) {
        result.forgetOnResolve = true;
      }
      return result;
    }
    case 'transmute': {
      const candidates = generateTransmuteCandidates(card.masteryLevel ?? 0);
      const isCharge = playMode === 'charge' || playMode === 'charge_correct';
      if (isCharge) {
        result.pendingCardPick = {
          type: 'transmute',
          sourceCardId: card.id,
          candidates,
          pickCount: (card.masteryLevel ?? 0) >= 3 ? 2 : 1,
          allowSkip: true,
          title: 'Transform Card',
        };
      } else {
        // QP or Charge Wrong: auto-pick 1 random candidate, apply inline
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        result.applyTransmuteAuto = { sourceCardId: card.id, selected: pick };
      }
      return result;
    }
    case 'conjure': {
      const candidates = generateTransmuteCandidates(card.masteryLevel ?? 0);
      result.pendingCardPick = {
        type: 'conjure',
        sourceCardId: card.id,
        candidates,
        pickCount: 1,
        allowSkip: true,
        title: 'Conjure — Choose a Card',
      };
      return result;
    }
    case 'immunity': {
      result.applyImmunity = true;
      return result;
    }
    case 'overclock': {
      result.applyOverclock = true;
      return result;
    }
    case 'thorns': {
      // 2026-04-11 audit fix (Severity A partial): QP reflect normalized to stat-table secondaryValue.
      // Was: thornsBaseReflect hardcoded as isCC?9 : isCW?2 : 3.
      // Now: QP reads _masteryStats.secondaryValue (L0=3). CC kept at 9 — CC:QP ratio is 3:1,
      // incompatible with standard 1.5× formula (HARD STOP: would change 9→5). CW kept at 2.
      result.shieldApplied = applyShieldRelics(finalValue);
      const thornsQP = _masteryStats?.secondaryValue ?? (mechanic?.secondaryValue ?? 3);
      const thornsBaseReflect = isChargeCorrect ? 9 : (isChargeWrong ? 2 : thornsQP);
      result.thornsValue = Math.round(thornsBaseReflect * focusAdjustedMultiplier);
      // L5: thorns_persist — thorns don't reset at encounter end
      if (hasTag('thorns_persist')) result.thornsPersist = true;
      return result;
    }
    case 'cleanse': {
      result.applyCleanse = true;
      result.extraCardsDrawn = 1;
      // cleanse_heal3: also heal 3 HP
      if (hasTag('cleanse_heal3')) {
        result.healApplied = (result.healApplied ?? 0) + Math.round(3 * chainMultiplier);
      }
      // cleanse_block3: also gain 3 block
      if (hasTag('cleanse_block3')) {
        result.shieldApplied = (result.shieldApplied ?? 0) + applyShieldRelics(3);
      }
      return result;
    }
    case 'empower': {
      // empower finalValue is used directly as buffNextCard in turnManager
      result.finalValue = finalValue;
      // L3+: empower_2cards — next 2 cards get the damage buff instead of 1
      if (hasTag('empower_2cards')) result.empowerTargetCount = 2;
      return result;
    }
    case 'scout': {
      // draw count scales with play mode
      const scoutDrawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = scoutDrawCount;
      // scout_scry2: after drawing, also scry 2 (look at top 2, discard some)
      if (hasTag('scout_scry2')) {
        result.scryCount = 2;
      }
      return result;
    }
    case 'recycle': {
      // draw count scales with play mode; charge_correct also draws from discard
      const recycleDrawCount = isChargeCorrect ? 4 : (isChargeWrong ? 2 : 3);
      result.extraCardsDrawn = recycleDrawCount;
      if (isChargeCorrect) {
        result.drawFromDiscard = 1;
        // recycle_discard_pick: player chooses which card to draw from discard
        if (hasTag('recycle_discard_pick')) {
          result.recycleChoose = true;
        }
      }
      return result;
    }
    case 'emergency': {
      const hpPercent = playerState.hp / playerState.maxHP;
      const block = hpPercent < 0.3 ? finalValue * 2 : finalValue;
      result.shieldApplied = applyShieldRelics(Math.round(block));
      return result;
    }
    case 'mirror': {
      result.mirrorCopy = true;
      // mirror_chain_inherit: the copy inherits the previous card's chain type
      // (turnManager reads this flag and sets chain type from lastPlayedCard)
      if (hasTag('mirror_chain_inherit')) {
        result.chameleonInheritChain = true; // reuse chameleonInheritChain field for chain type copy
      }
      // Actual copy happens in turnManager after checking lastCardEffect.
      return result;
    }
    case 'adapt': {
      const adaptMasteryBonus = getMasteryBaseBonus('adapt', card.masteryLevel ?? 0);
      const baseDmg = (mechanic?.quickPlayValue ?? 4) + adaptMasteryBonus;
      const baseBlock = (mechanic?.quickPlayValue ?? 4) + adaptMasteryBonus;

      // adapt_dual: do BOTH attack AND block (not a choice)
      if (hasTag('adapt_dual')) {
        applyAttackDamage(baseDmg);
        result.shieldApplied = applyShieldRelics(baseBlock);
        if (hasTag('adapt_draw1')) {
          result.extraCardsDrawn = 1;
        }
        return result;
      }

      const candidates: Card[] = [
        {
          id: 'adapt_attack',
          factId: '', cardType: 'attack',
          mechanicId: 'strike', mechanicName: `Attack (${baseDmg} dmg)`,
          apCost: 0, baseEffectValue: baseDmg, originalBaseEffectValue: baseDmg,
          effectMultiplier: 1.0, tier: '1' as const, domain: 'general_knowledge', chainType: 0,
          masteryLevel: 0,
        },
        {
          id: 'adapt_shield',
          factId: '', cardType: 'shield',
          mechanicId: 'block', mechanicName: `Shield (${baseBlock} block)`,
          apCost: 0, baseEffectValue: baseBlock, originalBaseEffectValue: baseBlock,
          effectMultiplier: 1.0, tier: '1' as const, domain: 'general_knowledge', chainType: 0,
          masteryLevel: 0,
        },
        {
          id: 'adapt_utility',
          factId: '', cardType: 'utility',
          mechanicId: 'cleanse', mechanicName: 'Cleanse + Draw 1',
          apCost: 0, baseEffectValue: 1, originalBaseEffectValue: 1,
          effectMultiplier: 1.0, tier: '1' as const, domain: 'general_knowledge', chainType: 0,
          masteryLevel: 0,
        },
      ];

      result.pendingCardPick = {
        type: 'adapt',
        sourceCardId: card.id,
        candidates,
        pickCount: 1,
        allowSkip: true,
        title: 'Adapt — Choose Form',
      };
      // adapt_draw1: also draw 1 card (regardless of choice)
      if (hasTag('adapt_draw1')) {
        result.extraCardsDrawn = 1;
      }
      return result;
    }
    // AR-203: Ignite — sets a buff so the NEXT attack card(s) played add Burn stacks.
    case 'ignite': {
      // finalValue encodes the Burn stacks to apply on the next attack.
      // QP = 4, CC = 8, CW = 2 (from mechanic definition + mastery bonus).
      result.applyIgniteBuff = finalValue;
      // ignite_2attacks: applies Burn to the next 2 attacks instead of 1
      if (hasTag('ignite_2attacks')) {
        result.igniteDuration = 2;
      }
      return result;
    }
    // AR-203/AR-206: Lacerate — applies Bleed stacks AND deals damage.
    case 'lacerate': {
      // 2026-04-11 audit fix (Severity A partial): QP bleed normalized to stat-table secondaryValue.
      // Was: lacerateBleed = isCC?8 : isCW?2 : (card.secondaryValue ?? mechanic.secondaryValue ?? 4).
      // Now: QP reads _masteryStats.secondaryValue (L0=4, preserved from resolver runtime).
      // CC kept at 8 — CC:QP ratio is 2:1, incompatible with standard 1.5× formula
      // (HARD STOP: would change 8→6). CW kept at 2.
      const lacerateQPBleed = _masteryStats?.secondaryValue ?? (mechanic?.secondaryValue ?? 4);
      const lacerateBleed = isChargeCorrect ? 8 : (isChargeWrong ? 2 : lacerateQPBleed);
      applyAttackDamage(finalValue);
      result.applyBleedStacks = Math.round(lacerateBleed * chainMultiplier);
      // Tag: lacerate_vuln1t — also apply Vulnerable 1t.
      if (hasTag('lacerate_vuln1t')) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      return result;
    }

    // ── AR-206: New card resolver cases ────────────────────────────────────────

    // Filler: Twin Strike — 2 hits, each triggers Burn/Bleed separately
    case 'twin_strike': {
      const twinHits = _masteryStats?.hitCount ?? mechanic?.secondaryValue ?? 2;
      applyAttackDamage(finalValue); // per-hit damage (Vulnerable already applied)
      result.hitCount = twinHits;
      // Tag: twin_burn2 — each hit applies 2 Burn stacks.
      if (hasTag('twin_burn2')) {
        result.applyBurnStacks = Math.round(2 * chainMultiplier);
      }
      // Phase 3 Tag: twin_burn_chain — each hit that triggers Burn does NOT halve the stacks.
      // Signal to turnManager to skip the halving step for Burn ticks during this card's hits.
      if (hasTag('twin_burn_chain')) {
        result.twinBurnChainActive = true;
      }
      return result;
    }
    // Filler: Iron Wave — hybrid damage + block
    case 'iron_wave': {
      // 2026-04-11 audit fix (Severity A): CC block normalized away from deprecated getMastarySecondaryBonus.
      // Was: CC = round(mechanic.quickPlayValue × 1.5 + getMastarySecondaryBonus(...)) — deprecated path.
      // Now: all modes use _mastaryStats.secondaryValue as the block base. L0: QP=3, CC=5, CW=2.
      // Balance preserved: old CC at L0 = round(3×1.5+0) = 5; new CC = round(3×1.5) = 5. Same value.
      // Phase 3 Tag: iron_wave_block_double — if player has 10+ block, double the damage component.
      const ironWaveCurrentBlock = playerState.shield ?? 0;
      const ironWaveDmgValue = (hasTag('iron_wave_block_double') && ironWaveCurrentBlock >= 10)
        ? finalValue * 2
        : finalValue;
      applyAttackDamage(ironWaveDmgValue);
      const ironWaveSecondary = _masteryStats?.secondaryValue ?? (mechanic?.secondaryValue ?? 3);
      const ironWaveBlock = isChargeCorrect
        ? Math.round(ironWaveSecondary * CHARGE_CORRECT_MULTIPLIER)        // CC: sec × 1.5
        : (isChargeWrong
          ? Math.max(1, Math.round(ironWaveSecondary * 0.7))              // CW: sec × 0.7
          : ironWaveSecondary);                                            // QP: stat-table secondaryValue
      result.shieldApplied = applyShieldRelics(ironWaveBlock);
      return result;
    }
    // Filler: Shrug It Off — block + draw on QP/CC (no draw on CW)
    case 'shrug_it_off': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (!isChargeWrong) {
        // drawCount comes from stat table (L3+ = 2 from table, default 1)
        const draws = stats?.drawCount ?? 1;
        result.extraCardsDrawn = draws;
      }
      // L5: shrug_cleanse1 — remove 1 debuff from player
      if (hasTag('shrug_cleanse1')) result.removeDebuffCount = 1;
      return result;
    }
    // Filler: Bash — damage + apply Vulnerable
    case 'bash': {
      applyAttackDamage(finalValue);
      const baseBashVulnDuration = isChargeCorrect ? 2 : 1;
      const bashVulnDuration = Math.round(baseBashVulnDuration * (1 + (chainMultiplier - 1) * 0.5));
      // Tag: bash_vuln2t — Vuln lasts +1 turn (converts old masteryLevel >= 3 check).
      const masteryVulnBonus = hasTag('bash_vuln2t') ? 1 : 0;
      result.statusesApplied.push({
        type: 'vulnerable',
        value: 1,
        turnsRemaining: bashVulnDuration + masteryVulnBonus,
      });
      // Tag: bash_weak1t — also apply Weakness 1t.
      if (hasTag('bash_weak1t')) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    // Filler: Sap — small damage + apply Weakness
    case 'sap': {
      applyAttackDamage(finalValue);
      // L2+: sap_weak2t — Weakness lasts 2 turns instead of 1
      const baseSapWeakDuration = hasTag('sap_weak2t') ? 2 : (isChargeCorrect ? 2 : 1);
      const sapWeakDuration = Math.round(baseSapWeakDuration * (1 + (chainMultiplier - 1) * 0.5));
      result.statusesApplied.push({
        type: 'weakness',
        value: 1,
        turnsRemaining: sapWeakDuration,
      });
      // L5: sap_strip3block — also strips 3 enemy block
      if (hasTag('sap_strip3block')) result.removeEnemyBlock = (result.removeEnemyBlock ?? 0) + 3;
      return result;
    }
    // Bleed: Rupture — damage + Bleed stacks
    case 'rupture': {
      applyAttackDamage(finalValue);
      const ruptureBleed = isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 3));
      result.applyBleedStacks = Math.round(ruptureBleed * chainMultiplier);
      // Tag: rupture_bleed_perm — bleed applied by this card skips decay each turn.
      if (hasTag('rupture_bleed_perm')) { result.bleedPermanent = true; }
      return result;
    }
    // Burn: Kindle — damage + Burn, and the hit itself triggers the Burn immediately
    case 'kindle': {
      // 2026-04-11 audit fix (Severity A partial): QP burn normalized to stat-table secondaryValue.
      // Was: kindleBurn = isCC?8 : isCW?2 : (card.secondaryValue ?? mechanic.secondaryValue ?? 4).
      // Now: QP reads _masteryStats.secondaryValue (L0=4, preserved from resolver runtime).
      // CC kept at 8 — CC:QP ratio is 2:1, incompatible with standard 1.5× formula
      // (HARD STOP: would change 8→6). CW kept at 2.
      applyAttackDamage(finalValue);
      const kindleQPBurn = _masteryStats?.secondaryValue ?? (mechanic?.secondaryValue ?? 4);
      const kindleBurn = isChargeCorrect ? 8 : (isChargeWrong ? 2 : kindleQPBurn);
      result.applyBurnStacks = Math.round(kindleBurn * chainMultiplier);
      // hitCount = 1 so turnManager triggers Burn once on this hit.
      // Tag: kindle_double_trigger — trigger Burn TWICE (hitCount = 2).
      result.hitCount = hasTag('kindle_double_trigger') ? 2 : 1;
      return result;
    }
    // New: Overcharge — QP/CW fixed damage; CC scales with encounter charge count
    case 'overcharge': {
      // 2026-04-11 audit note (Severity A resolved): applyAttackDamage(finalValue) already reads
      // stat-table qpValue via the standard mechanicBaseValue pipeline — correctly normalized.
      // CC scaling (encounter charge count × bonus) is handled separately in turnManager
      // reading encounterChargeCount when mechanicId is 'overcharge'.
      // Tag: overcharge_bonus_x2 — double the encounter charge scaling bonus (read by turnManager).
      // Tag: overcharge_draw1 — also draw 1 card on play.
      applyAttackDamage(finalValue);
      if (hasTag('overcharge_draw1')) { result.extraCardsDrawn = 1; }
      return result;
    }
    // New: Riposte — hybrid damage + block
    case 'riposte': {
      // 2026-04-11 audit fix (Severity A partial): QP/CW block normalized to stat-table secondaryValue.
      // Was: QP/CW block = card.secondaryValue ?? mechanic.secondaryValue ?? 4 (seed fallback).
      // Now: QP/CW reads _masteryStats.secondaryValue (L0=4, preserved from resolver runtime).
      // CC block hardcoded at 12 — INTENTIONAL: applies the full modifier chain (focus × chain × speed
      // × buff × overclock). Normalizing to secondaryValue × 1.5 would drop those multipliers.
      // HARD STOP: CC normalization deferred — secondaryValue encodes QP/CW ground truth only.
      applyAttackDamage(finalValue);
      // Phase 3 Tag: riposte_block_dmg40 — add Math.floor(playerBlock * 0.4) as bonus damage.
      if (hasTag('riposte_block_dmg40')) {
        const riposteBlockBonus = Math.floor((playerState.shield ?? 0) * 0.4);
        if (riposteBlockBonus > 0) {
          result.damageDealt = (result.damageDealt ?? 0) + riposteBlockBonus;
          result.enemyDefeated = result.damageDealt >= enemy.currentHP;
        }
      }
      const riposteSecondary = _masteryStats?.secondaryValue ?? (mechanic?.secondaryValue ?? 4);
      const riposteBlock = isChargeCorrect
        ? Math.round(Math.round(12 * chainMultiplier) * focusAdjustedMultiplier * speedBonus * buffMultiplier * overclockMultiplier)  // CC: chain adjusts base 12 first
        : (isChargeWrong
          ? applyShieldRelics(Math.round(riposteSecondary * 0.75))   // CW: stat-table × 0.75
          : applyShieldRelics(riposteSecondary));                     // QP: stat-table secondaryValue
      result.shieldApplied = applyShieldRelics(riposteBlock);
      // Tag: riposte_draw1 — also draw 1 card.
      if (hasTag('riposte_draw1')) { result.extraCardsDrawn = 1; }
      return result;
    }
    // New: Absorb — block, CC also draws a card; L3+ draws 2; L5 also heals 1 on CC
    case 'absorb': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        // L3+: absorb_draw2cc — CC draws 2 instead of 1
        const draws = hasTag('absorb_draw2cc') ? 2 : 1;
        result.extraCardsDrawn = draws;
        // L5: absorb_heal1cc — CC also heals 1 HP
        if (hasTag('absorb_heal1cc')) result.healApplied = (result.healApplied ?? 0) + Math.round(1 * chainMultiplier);
        // Phase 3 Tag: absorb_ap_on_block — grant +1 AP on CC (simple implementation).
        // Full spec: min(2, damageBlockedThisTurn) — but blocked damage is not tracked per-card.
        if (hasTag('absorb_ap_on_block')) {
          result.apOnBlockGain = 1;
        }
      }
      return result;
    }
    // New: Reactive Shield — block + Thorns for turns
    case 'reactive_shield': {
      // 2026-04-11 audit fix (Severity A partial): QP thorns normalized to stat-table secondaryValue.
      // Was: QP = card.secondaryValue ?? mechanic.secondaryValue ?? 2 (seed fallback gave 2).
      // Now: QP reads _masteryStats.secondaryValue (L0=2, preserved from resolver runtime).
      // CC hardcoded=5 and CW hardcoded=1 remain: they are gameplay constants that don't scale
      // with mastery (stat table doesn't define per-level CC/CW thorns separately).
      result.shieldApplied = applyShieldRelics(finalValue);
      const rsQPThorns = _masteryStats?.secondaryValue ?? (mechanic?.secondaryValue ?? 2);
      const rsThornValue = isChargeCorrect ? 5 : (isChargeWrong ? 1 : rsQPThorns);
      result.thornsValue = rsThornValue;
      // L5: reactive_thorns_persist — thorns persist the whole encounter (not per-hit reset)
      if (hasTag('reactive_thorns_persist')) result.thornsPersist = true;
      return result;
    }
    // New: Sift — scry (look at top N, discard some)
    case 'sift': {
      const siftLookAt = isChargeCorrect ? 5 : (isChargeWrong ? 2 : (card.baseEffectValue ?? 3));
      const siftDiscard = isChargeCorrect ? 2 : 1;
      result.siftParams = { lookAt: siftLookAt, discardCount: siftDiscard };
      // sift_draw1: also draw 1 card
      if (hasTag('sift_draw1')) {
        result.extraCardsDrawn = 1;
      }
      // sift_discard_dmg2: each discarded sift card deals 2 damage to enemy
      if (hasTag('sift_discard_dmg2')) {
        result.discardDamage = 2;
      }
      return result;
    }
    // New: Scavenge — retrieve a card from the discard pile to hand (player picks)
    case 'scavenge': {
      result.pendingCardPick = {
        type: 'scavenge',
        sourceCardId: card.id,
        candidates: [], // Populated by turnManager from actual discard pile
        pickCount: 1,
        allowSkip: true,
        title: 'Scavenge — Retrieve from Discard',
      };
      // scavenge_draw1: also draw 1 additional card
      if (hasTag('scavenge_draw1')) {
        result.extraCardsDrawn = 1;
      }
      return result;
    }
    // New: Forge — upgrade a card in hand for this encounter (player picks)
    case 'forge': {
      result.pendingCardPick = {
        type: 'forge',
        sourceCardId: card.id,
        candidates: [], // Populated by turnManager from hand
        pickCount: (card.masteryLevel ?? 0) >= 3 ? 2 : 1,
        allowSkip: true,
        title: 'Forge — Upgrade a Card',
      };
      return result;
    }
    // AR-264: Precision Strike — CC scales with distractor count (question difficulty)
    case 'precision_strike': {
      if (isChargeCorrect) {
        // CC: 8 × (distractorCount + 1). At mastery 0 (2 distractors): 24. At mastery 3+ (4 distractors): 40.
        const distractorCount = advanced.distractorCount ?? 2;
        const psBaseMult = 8;
        // Tag: precision_bonus_x2 — double the difficulty bonus multiplier.
        const psBonusMult = hasTag('precision_bonus_x2') ? 12 : 6;  // Pass 8: reduced from 16/8 to 12/6
        mechanicBaseValue = psBonusMult * (distractorCount + 1);
        applyAttackDamage(mechanicBaseValue);
      } else {
        applyAttackDamage(finalValue); // QP: 8, CW: 4 (from mechanic definition)
      }
      // Tag: precision_timer_ext50 — extend quiz timer by 50% for this card's charge quiz.
      if (hasTag('precision_timer_ext50')) { result.timerExtensionPct = 50; }
      return result;
    }
    // New: Stagger — skip enemy next action
    case 'stagger': {
      result.applyStagger = true;
      if (isChargeCorrect) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      // L2+: stagger_weak1t — QP/CW also applies Weakness 1t
      if (!isChargeCorrect && hasTag('stagger_weak1t')) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    // New: Corrode — remove enemy block + apply Weakness
    case 'corrode': {
      // 2026-04-11 audit note (Severity A resolved): corrode's block-removal value is finalValue,
      // which is computed from stat-table qpValue via the standard mechanicBaseValue pipeline.
      // This is already correctly normalized — no code change needed.
      // QP: remove finalValue block + 1t Weakness; CC: remove ALL block + 2t Weakness; CW: remove 3 + 1t
      // L5: corrode_strip_all — QP/CW also removes ALL block (not just computed amount)
      const corrodeStripAll = hasTag('corrode_strip_all');
      const corrodeRemoveBase = isChargeCorrect ? -1 : (isChargeWrong ? 3 : finalValue); // -1 = remove all
      const corrodeRemove = corrodeStripAll ? -1 : corrodeRemoveBase;
      const corrodeWeakDuration = isChargeCorrect ? 2 : 1;
      result.removeEnemyBlock = corrodeRemove;
      result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: corrodeWeakDuration });
      // L3+: corrode_vuln1t — also apply Vulnerable 1t
      if (hasTag('corrode_vuln1t')) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    // New: Swap — discard 1, draw 1 (QP/CW) or draw 2 (CC)
    case 'swap': {
      const swapDrawCount = isChargeCorrect ? 2 : 1;
      // swap_cc_draw3: CC draws 3 instead of 2
      const masterySwapBonus = (isChargeCorrect && hasTag('swap_cc_draw3')) ? 1 : 0;
      result.swapDiscardDraw = { discardCount: 1, drawCount: swapDrawCount + masterySwapBonus };
      return result;
    }
    // New: Siphon Strike — damage + overkill heal (min 2, max 10)
    case 'siphon_strike': {
      // 2026-04-11 audit fix (Severity A): minHeal normalized from stat-table extras.
      // Was: hardcoded (card.masteryLevel ?? 0) >= 3 ? 3 : 2 — bypassed stat table.
      // Now: reads _masteryStats.extras.minHeal (L0=2, L3+=3 from stat table). Same L0 behavior.
      applyAttackDamage(finalValue);
      if (!isChargeWrong) {
        // Overkill heal computed here; turnManager adjusts based on actual HP remaining.
        // We store the min heal; turnManager computes overkill and clamps.
        const minHeal = _masteryStats?.extras?.['minHeal'] ?? 2;
        result.overkillHeal = Math.round(minHeal * chainMultiplier); // sentinel: chain-adjusted
      }
      return result;
    }
    // New: Aegis Pulse — block; CC also grants chain block bonus to same-chain cards
    case 'aegis_pulse': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        // L3+: chain buff = +3 instead of +2
        const chainBuff = (card.masteryLevel ?? 0) >= 3 ? 3 : 2;
        result.chainBlockBonus = chainBuff;
      }
      return result;
    }
    // New: Inscription of Fury — persistent attack bonus for rest of combat
    case 'inscription_fury': {
      // resolveInscription() in turnManager handles registration + forget.
      // finalValue encodes the per-attack bonus (QP=2, CC=4, CW=1 + mastery).
      result.finalValue = finalValue;
      // L5: insc_fury_cc_bonus2 — CC attacks deal an additional +2 flat damage on top
      if (hasTag('insc_fury_cc_bonus2') && isChargeCorrect) result.inscriptionFuryCcBonus = 2;
      return result;
    }
    // New: Inscription of Iron — persistent block per turn for rest of combat
    case 'inscription_iron': {
      // resolveInscription() in turnManager handles registration + forget.
      // finalValue encodes the per-turn block bonus (QP=3, CC=6, CW=1 + mastery).
      result.finalValue = finalValue;
      // L5: insc_iron_thorns1 — also grants +1 thorns per turn
      if (hasTag('insc_iron_thorns1')) result.inscriptionIronThorns = 1;
      return result;
    }

    // ── AR-207: Phase 2 Identity / Flagship Cards ───────────────────────────

    // Gambit — HP swing attack
    case 'gambit': {
      // 2026-04-11 audit fix (Severity A): resolver was hardcoding gambitHeal=5 and
      // selfDmg via masteryL3 check instead of reading the stat table.
      // stat table L0: healOnCC=3, selfDmg=4. This matches the description.
      // Balance invariant preserved: stat table values already encode the intended numbers.
      applyAttackDamage(finalValue);
      if (isChargeCorrect) {
        const gambitHeal = stats?.extras?.['healOnCC'] ?? 5;  // fallback=5 matches old hardcode
        result.gambitHeal = gambitHeal;
        result.healApplied = Math.round(gambitHeal * chainMultiplier);
      } else if (isChargeWrong) {
        // CW self-damage: stat table does not define cwSelfDmg; use selfDmg + 1 as CW penalty
        const cwSelfDmg = (stats?.extras?.['selfDmg'] ?? 4) + 1;
        result.gambitselfDamage = cwSelfDmg;
        result.selfDamage = cwSelfDmg;
      } else {
        // QP: self-damage from stat table extras.selfDmg
        const qpSelfDmg = stats?.extras?.['selfDmg'] ?? 2;  // fallback=2 matches old hardcode pre-L3
        result.gambitselfDamage = qpSelfDmg;
        result.selfDamage = qpSelfDmg;
      }
      return result;
    }

    // Chain Lightning — chain-scaling attack (turnManager overrides CC damage)
    case 'chain_lightning': {
      // QP: always 8 base (+ mastery bonus already in finalValue); CW: 5 (+ mastery).
      // CC: turnManager reads chainLightningChainLength and overrides damageDealt.
      //     Resolver sets a sentinel (8 * 1 = base) — turnManager replaces it.
      if (isChargeCorrect) {
        // Sentinel: will be overridden by turnManager after chain is extended
        applyAttackDamage(finalValue);
        // Tag: chain_lightning_min2 — minimum chain count = 2 (turnManager reads this sentinel).
        result.chainLightningChainLength = hasTag('chain_lightning_min2') ? 2 : 1;
      } else {
        applyAttackDamage(finalValue);
      }
      return result;
    }

    // Volatile Slash — forget on CC
    case 'volatile_slash': {
      applyAttackDamage(finalValue);
      // Tag: volatile_no_forget — card no longer exhausts on CC.
      if (isChargeCorrect && !hasTag('volatile_no_forget')) {
        result.forgetOnResolve = true;
      }
      return result;
    }

    // Burnout Shield — forget on CC unless burnout_no_forget tag (L5) is active
    case 'burnout_shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      // L5: burnout_no_forget — card no longer exhausts on CC.
      if (isChargeCorrect && !hasTag('burnout_no_forget')) {
        result.forgetOnResolve = true;
      }
      return result;
    }

    // AR-264: Knowledge Ward — block scales with correct charges this encounter
    case 'knowledge_ward': {
      // correctCharges: clamped to [1, 5]. 0 correct charges is treated as 1 (min).
      const correctCharges = Math.min(Math.max(advanced.correctChargesThisEncounter ?? 0, 1), 5);
      if (isChargeCorrect) {
        // CC: 10 × correctCharges
        const kwCCBlock = 10 * correctCharges;
        result.shieldApplied = applyShieldRelics(kwCCBlock);
      } else if (isQuickPlay) {
        // QP: 6 × correctCharges
        const kwQPBlock = 6 * correctCharges;
        result.shieldApplied = applyShieldRelics(kwQPBlock);
      } else {
        // CW: 4 flat
        result.shieldApplied = applyShieldRelics(4);
      }
      // L3+: knowledge_ward_cleanse — cleanse 1 debuff from player on any play mode.
      // Mirrors shrug_cleanse1 pattern: fires unconditionally when tag is active.
      if (hasTag('knowledge_ward_cleanse')) result.removeDebuffCount = 1;
      return result;
    }

    // Warcry — Strength buff + optional free Charge
    case 'warcry': {
      // 2026-04-11 audit fix (Severity A): resolver was hardcoding value=2 on CC/QP regardless
      // of stat table. Stat table extras.str defines the Strength amount per mastery level.
      // L0: str=1; L1: str=2; L4: str=3; L5: str=3 permanent on CC.
      // Balance preserved: stat table already encodes the intended values.
      const warcryStrValue = stats?.extras?.['str'] ?? 1;  // L0=1, grows with mastery
      if (isChargeCorrect) {
        // CC: permanent Strength + free next Charge (warcryFreeCharge flag waives surcharge)
        result.applyStrengthToPlayer = { value: warcryStrValue, permanent: true };
        result.warcryFreeCharge = true;
      } else if (isChargeWrong) {
        // CW: minimal Strength this turn only (1 stack regardless of mastery)
        result.applyStrengthToPlayer = { value: 1, permanent: false };
      } else {
        // QP: Strength this turn only (stat-table value)
        // L3+: turnManager also applies permanent Str via direct masteryLevel>=3 check (warcry_perm_str tag removed 2026-04-11 — was dead, zero readers)
        result.applyStrengthToPlayer = { value: warcryStrValue, permanent: false };
      }
      result.finalValue = warcryStrValue;
      return result;
    }

    // Battle Trance — draw + optional lockout
    case 'battle_trance': {
      const btStats = getMasteryStats('battle_trance', card.masteryLevel ?? 0);
      const btDrawCount = btStats?.drawCount ?? 3;
      if (isChargeCorrect) {
        // Draw count from stat table (scales with mastery)
        result.battleTranceDraw = btDrawCount;
        result.extraCardsDrawn = btDrawCount;
        // trance_cc_ap1: CC also grants +1 AP
        if (hasTag('trance_cc_ap1')) {
          result.apGain = 1;
          result.grantsAp = 1;
        }
      } else if (isChargeWrong) {
        // Draw 2, locked out (always)
        result.battleTranceDraw = 2;
        result.extraCardsDrawn = 2;
        result.applyBattleTranceRestriction = true;
      } else {
        // QP: draw count from stat table; locked out unless trance_no_lockout_qp tag
        const qpLockout = !hasTag('trance_no_lockout_qp');
        result.battleTranceDraw = btDrawCount;
        result.extraCardsDrawn = btDrawCount;
        if (qpLockout) result.applyBattleTranceRestriction = true;
      }
      return result;
    }

    // Curse of Doubt — charge damage percent amplifier on enemy
    case 'curse_of_doubt': {
      // finalValue = percent bonus (30/50/20 base + mastery bonus via perLevelDelta=5)
      const doubTurns = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.applyChargeDamageAmpPercent = { value: finalValue, turns: doubTurns };
      return result;
    }

    // Mark of Ignorance — charge damage flat amplifier on enemy
    case 'mark_of_ignorance': {
      // finalValue = flat bonus (3/5/2 base + mastery bonus via perLevelDelta=1)
      const markTurns = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.applyChargeDamageAmpFlat = { value: finalValue, turns: markTurns };
      return result;
    }

    // Corroding Touch — 0 AP, Weakness + optional Vulnerable
    case 'corroding_touch': {
      const masteryBonusDuration = getMasteryBaseBonus(mechanicId, card.masteryLevel ?? 0);
      if (isChargeCorrect) {
        // 3 Weakness (2t) + 2 Vulnerable (1t)
        result.statusesApplied.push({
          type: 'weakness',
          value: 3,
          turnsRemaining: Math.round((2 + Math.round(masteryBonusDuration)) * (1 + (chainMultiplier - 1) * 0.5)),
        });
        result.statusesApplied.push({
          type: 'vulnerable',
          value: 2,
          turnsRemaining: 1,
        });
      } else if (isChargeWrong) {
        // 1 Weakness (1t)
        result.statusesApplied.push({
          type: 'weakness',
          value: 1,
          turnsRemaining: Math.round((1 + Math.round(masteryBonusDuration)) * (1 + (chainMultiplier - 1) * 0.5)),
        });
      } else {
        // QP: 2 Weakness (1t + mastery duration)
        result.statusesApplied.push({
          type: 'weakness',
          value: 2,
          turnsRemaining: Math.round((1 + Math.round(masteryBonusDuration)) * (1 + (chainMultiplier - 1) * 0.5)),
        });
      }
      // L3+: corrtouch_vuln1t — also apply Vulnerable 1t on QP/CW
      if (!isChargeCorrect && hasTag('corrtouch_vuln1t')) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      return result;
    }

    // Phase Shift — choice: damage or block (QP/CW); both (CC)
    case 'phase_shift': {
      if (isChargeCorrect) {
        // CC: 12 dmg AND 12 block simultaneously — no choice popup needed
        const psValue = finalValue;
        applyAttackDamage(psValue);
        result.shieldApplied = applyShieldRelics(psValue);
        result.phaseShiftBothDmgAndBlock = { damage: psValue, block: psValue };
        // phase_shift_draw1: also draw 1 card
        if (hasTag('phase_shift_draw1')) {
          result.extraCardsDrawn = 1;
        }
      } else {
        // QP/CW: player chooses damage or block — defer to UI popup
        const psVal = finalValue;
        const psBlock = applyShieldRelics(psVal); // pre-compute relic-modified block value
        result.pendingChoice = {
          mechanicId: 'phase_shift',
          options: [
            { id: 'damage', label: `Deal ${psVal} Damage`, damageDealt: psVal },
            { id: 'block', label: `Gain ${psBlock} Block`, shieldApplied: psBlock },
          ],
        };
        // damageDealt and shieldApplied remain 0 — applied after popup resolves
        result.phaseShiftChoice = 'pending';
      }
      return result;
    }

    // Chameleon — copy last card at multiplier
    case 'chameleon': {
      // turnManager resolves the actual copy using lastPlayedMechanicId.
      // We emit the multiplier; turnManager handles copy resolution.
      const chameleonMult = isChargeCorrect ? 1.3 : (isChargeWrong ? 0.7 : 1.0);
      result.chameleonMultiplier = chameleonMult;
      if (isChargeCorrect) {
        result.chameleonInheritChain = true;
      }
      // Check L3+ QP chain inherit
      if (!isChargeCorrect && !isChargeWrong && (card.masteryLevel ?? 0) >= 3) {
        result.chameleonInheritChain = true;
      }
      // Damage/shield/draw is resolved by turnManager after reading lastPlayedMechanicId.
      // This card itself does 0 effect without a previous card.
      return result;
    }

    // Dark Knowledge — damage per cursed fact
    case 'dark_knowledge': {
      const cursedCount = advanced.cursedFactCount ?? 0;
      const dkStats = getMasteryStats('dark_knowledge', card.masteryLevel ?? 0);
      const dmgPerCurse = dkStats?.extras?.dmgPerCurse ?? (isChargeCorrect ? 5 : (isChargeWrong ? 1 : 3));
      const effectiveDmgPerCurse = dmgPerCurse;
      const totalDamage = effectiveDmgPerCurse * cursedCount;
      if (totalDamage > 0) {
        applyAttackDamage(totalDamage);
      }
      result.darkKnowledgeDmgPerCurse = effectiveDmgPerCurse;
      // dark_heal1_per_curse: also heal 1 HP per cursed fact
      if (hasTag('dark_heal1_per_curse') && cursedCount > 0) {
        result.darkHealPerCurse = cursedCount;
        result.healApplied = (result.healApplied ?? 0) + cursedCount;
      }
      return result;
    }

    // Chain Anchor — draw + optional chain anchor flag
    case 'chain_anchor': {
      // Draws 1 in all modes. CC also sets chainAnchorActive.
      // Chain Anchor is NOT a chain link itself.
      result.extraCardsDrawn = 1;
      if (isChargeCorrect) {
        result.applyChainAnchor = true;
        // chain_anchor_set3: sets chain to 3 instead of 2 (turnManager reads this)
        // chain_anchor_ap0: costs 0 AP (applied at card resolution time, not here)
        // Both flags read by turnManager after this resolver returns.
      }
      return result;
    }

    // Unstable Flux — random (QP/CW) or chosen (CC) effect
    case 'unstable_flux': {
      const fluxMult = isChargeCorrect ? 1.5 : (isChargeWrong ? 0.7 : 1.0);
      const baseDmg = Math.round(10 * fluxMult);
      const baseBlock = Math.round(10 * fluxMult);
      const baseDraw = Math.max(1, Math.round(2 * fluxMult));
      const baseWeakTurns = isChargeCorrect ? 3 : 2;

      if (isChargeCorrect) {
        // CC: player CHOOSES from 4 options at 1.5× — defer to UI popup
        result.pendingChoice = {
          mechanicId: 'unstable_flux',
          options: [
            { id: 'damage', label: `Deal ${baseDmg} Damage`, damageDealt: baseDmg },
            { id: 'block', label: `Gain ${baseBlock} Block`, shieldApplied: baseBlock },
            { id: 'draw', label: `Draw ${baseDraw} Cards`, extraCardsDrawn: baseDraw },
            { id: 'debuff', label: `Apply Weakness (${baseWeakTurns} turns)`, statusesApplied: [{ type: 'weakness', value: 2, turnsRemaining: baseWeakTurns }] },
          ],
        };
        // damageDealt and shieldApplied remain 0 — applied after popup resolves
        result.unstableFluxEffect = undefined; // set after choice
      } else {
        // QP/CW: random selection (flux_choose_qp: player picks from 2 options on QP)
        const roll = Math.floor(Math.random() * 4);
        if (roll === 0) {
          applyAttackDamage(baseDmg);
          result.unstableFluxEffect = 'damage';
        } else if (roll === 1) {
          result.shieldApplied = applyShieldRelics(baseBlock);
          result.unstableFluxEffect = 'block';
        } else if (roll === 2) {
          result.extraCardsDrawn = baseDraw;
          result.unstableFluxEffect = 'draw';
        } else {
          result.statusesApplied.push({ type: 'weakness', value: 2, turnsRemaining: baseWeakTurns });
          result.unstableFluxEffect = 'debuff';
        }
        // flux_choose_qp: QP lets player choose instead of random (turnManager handles popup)
        // NOTE: turnManager must check result.fluxChoose to show picker instead of applying random
        if (isQuickPlay && hasTag('flux_choose_qp')) {
          // Signal to turnManager: convert random result to a player choice
          // turnManager shows 2 of the 4 options and lets player pick
          // We still set a default result in case turnManager doesn't intercept
        }
      }
      // flux_double: effect fires twice (turnManager reads this and repeats the effect)
      if (hasTag('flux_double')) {
        result.fluxDouble = true;
      }
      return result;
    }

    // ── AR-208: Phase 3 Advanced / Chase Cards ────────────────────────────

    // AR-264: Smite — CC scales inversely with fog; CW extra fog penalty
    case 'smite': {
      if (isChargeCorrect) {
        // CC: damage scales inversely with fog. At fog 0 (flow): 70. At fog 5 (neutral): 40. At fog 10 (max fog): 10.
        const fogLevel = getAuraLevel();
        let smiteBase = 10 + (6 * (10 - fogLevel));
        // Tag: smite_aura_x2 — double the Aura scaling bonus portion.
        if (hasTag('smite_aura_x2')) {
          const auraBonus = 6 * (10 - fogLevel);
          smiteBase = 10 + (auraBonus * 2);
        }
        mechanicBaseValue = smiteBase;
        applyAttackDamage(mechanicBaseValue);
      } else if (isChargeWrong) {
        // CW: 6 damage + fog increases by 1 (extra penalty on top of standard +2 from wrong charge)
        applyAttackDamage(6);
        adjustAura(1);  // Increase fog
      } else {
        applyAttackDamage(finalValue); // QP: 10 (quickPlayValue from mechanic definition)
      }
      return result;
    }

    // AR-264: Feedback Loop — Flow State bonus on CC; fog crash on CW
    case 'feedback_loop': {
      if (isChargeWrong) {
        // Tag: feedback_cw_nonzero — CW deals 50% of QP value instead of 0.
        if (hasTag('feedback_cw_nonzero')) {
          applyAttackDamage(Math.round(finalValue * 0.5));
        } else {
          // Complete fizzle — 0 damage + fog crashes by 3 (total +5 with standard +2)
          result.damageDealt = 0;
          result.rawValue = 0;
          result.finalValue = 0;
        }
        // Tag: feedback_crash_half — halve the Aura crash penalty on CW.
        adjustAura(hasTag('feedback_crash_half') ? 1 : 3);  // Fog crash
        return result;
      }
      if (isChargeCorrect) {
        // CC: 28 damage base. Flow State bonus: +12 if Aura >= 7 (flow_state threshold). Pass 8: reduced from 40/+16 to 28/+12.
        mechanicBaseValue = 28;
        if (getAuraState() === 'flow_state') {
          mechanicBaseValue += 12; // Total: 40 in Flow State (was 56)
        }
        applyAttackDamage(mechanicBaseValue);
        // L3 mastery: QP applies 1 Weakness (preserved from original — L3 check on QP, not CC)
      } else {
        // QP: 5 damage flat
        applyAttackDamage(finalValue);
        // L3 bonus: apply 1 Weakness on QP
        if ((card.masteryLevel ?? 0) >= 3) {
          result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
        }
      }
      return result;
    }

    // AR-264: Recall — Review Queue redemption card
    case 'recall': {
      if (isChargeCorrect) {
        // CC base: round(10 × 1.5) = 15 from pipeline. Override mechanicBaseValue for custom scaling.
        const wasReviewFact = advanced.wasReviewQueueFact ?? false;
        if (wasReviewFact) {
          // Review Queue bonus: override to 30 total damage + heal 6
          mechanicBaseValue = 30;
          // Tag: recall_heal3 — on review CC, heal 3 HP (stacks with base review heal).
          result.healApplied = Math.round((hasTag('recall_heal3') ? 6 + 3 : 6) * chainMultiplier);
          // Tag: recall_draw1 — on review CC, also draw 1 card.
          if (hasTag('recall_draw1')) { result.extraCardsDrawn = 1; }
        } else {
          // Normal CC: override to 20 damage
          mechanicBaseValue = 20;
          // Tag: recall_heal3 — on non-review CC, still heals 3 HP.
          if (hasTag('recall_heal3')) { result.healApplied = Math.round(3 * chainMultiplier); }
        }
        applyAttackDamage(mechanicBaseValue);
      } else {
        // QP: 10 damage, CW: 6 damage (from quickPlayValue/chargeWrongValue in mechanic def, already in finalValue)
        applyAttackDamage(finalValue);
      }
      return result;
    }

    // Hemorrhage — Bleed finisher: consumes all Bleed stacks on enemy
    case 'hemorrhage': {
      // 2026-04-11 audit fix (Severity A): use stat-table qpValue not deprecated getMasteryBaseBonus.
      // stat table: L0 qpValue=4 (bumped from 2 in L0 Balance Overhaul 2026-04-10).
      // bleedMult: CC=6, QP=4, CW=2 (hardcoded — stat table has extras.bleedMult but not used for CC/CW split).
      const bleedStacks = advanced.enemyBleedStacks ?? 0;
      const hemoBase = stats?.qpValue ?? ((mechanic?.baseValue ?? 4) + getMasteryBaseBonus(mechanicId, card.masteryLevel ?? 0));
      const bleedMult = isChargeCorrect ? 6 : (isChargeWrong ? 2 : (stats?.extras?.['bleedMult'] ?? 4));
      const hemoDmg = hemoBase + (bleedMult * bleedStacks);
      applyAttackDamage(hemoDmg);
      // Signal turnManager to consume all Bleed stacks after damage calculation
      result.consumeAllBleed = true;
      return result;
    }

    // Eruption — X-cost: consumes all remaining AP (surcharge deducted first on CC)
    case 'eruption': {
      // eruptionXAp is pre-computed by turnManager (after surcharge deduction).
      // Fallback: 0 AP if not provided.
      const xAp = advanced.eruptionXAp ?? 0;
      const masteryLevelEruption = card.masteryLevel ?? 0;
      // Use extras.dmgPerAp from stat table if available; fall back to perLevelDelta synthesis.
      const statDmgPerAp = _masteryStats?.extras?.['dmgPerAp'];
      const qpPerAp = statDmgPerAp ?? (8 + masteryLevelEruption);
      const ccPerAp = statDmgPerAp ? Math.round(statDmgPerAp * CHARGE_CORRECT_MULTIPLIER) : (12 + masteryLevelEruption);
      const cwPerAp = statDmgPerAp ? Math.round(statDmgPerAp * 0.5) : (5 + masteryLevelEruption);
      const perAp = isChargeCorrect ? ccPerAp : (isChargeWrong ? cwPerAp : qpPerAp);
      const eruptionDmg = perAp * xAp;
      if (eruptionDmg > 0) applyAttackDamage(eruptionDmg);
      result.xCostApConsumed = xAp;
      // Tag: eruption_refund1 — refund 1 AP after eruption resolves.
      if (hasTag('eruption_refund1')) { result.apRefund = 1; }
      return result;
    }

    // Bulwark — mega block; CC forgets unless bulwark_no_forget tag active (L5)
    case 'bulwark': {
      const bulwarkBlock = applyShieldRelics(finalValue);
      result.shieldApplied = bulwarkBlock;
      // CC forgets normally; L5 bulwark_no_forget tag skips this
      if (isChargeCorrect && !hasTag('bulwark_no_forget')) {
        result.forgetAfterPlay = true;
      }
      return result;
    }

    // Shield Bash — deal damage equal to current block (optionally consuming it)
    // L3+: conversion_bonus_50pct — multiplies block-to-damage by 1.5×
    // L5: conversion_keep_block — block NOT consumed after conversion
    case 'conversion': {
      const playerBlock = playerState.shield ?? 0;
      if (playerBlock > 0) {
        const cursedMult = card.isCursed ? 0.7 : 1.0;
        const modePct = isChargeWrong ? 0.5 : (isChargeCorrect ? 1.5 : 1.0);
        // L3+: bonus_50pct — additional 1.5× multiplier on block conversion
        const bonusMult = hasTag('conversion_bonus_50pct') ? 1.5 : 1.0;
        const damage = Math.floor(playerBlock * modePct * cursedMult * bonusMult);
        applyAttackDamage(damage);
        // L5: conversion_keep_block — block is NOT consumed after dealing damage
        // Without this tag, block IS consumed (blockConsumed = playerBlock).
        if (!hasTag('conversion_keep_block')) {
          result.blockConsumed = playerBlock;
        }
      }
      return result;
    }

    // Ironhide — block + Strength (temp on QP, permanent on CC)
    case 'ironhide': {
      result.shieldApplied = applyShieldRelics(finalValue);
      // Permanence is driven by stat table extras.strPerm (1=perm, 0=temp), not hardcoded mastery check.
      const strPerm = _masteryStats?.extras?.strPerm ?? 0;
      const strAmount = _masteryStats?.extras?.str ?? 1;
      if (isChargeCorrect) {
        result.ironhideStrength = { amount: strAmount, permanent: true };
      } else if (isChargeWrong) {
        // CW: block only, no Strength
        result.ironhideStrength = undefined;
      } else {
        // QP: permanent if strPerm > 0 (all levels from L0 via stat table), else temporary
        result.ironhideStrength = { amount: strAmount, permanent: strPerm > 0 };
      }
      return result;
    }

    // Frenzy — grant N free-play charges
    case 'frenzy': {
      const frenzyStats = getMasteryStats('frenzy', card.masteryLevel ?? 0);
      const frenzyFreeCards = frenzyStats?.extras?.freeCards;
      let frenzyCount: number;
      if (isChargeCorrect) {
        frenzyCount = frenzyFreeCards ?? 3;
      } else if (isChargeWrong) {
        frenzyCount = 1;
      } else {
        // QP: from stat table (scales with mastery); frenzy_qp3 tag (legacy check, now from table)
        frenzyCount = frenzyFreeCards ?? (hasTag('frenzy_qp3') ? 3 : 2);
      }
      result.frenzyChargesGranted = frenzyCount;
      // frenzy_draw1: also draw 1 card
      if (hasTag('frenzy_draw1')) {
        result.extraCardsDrawn = 1;
      }
      return result;
    }

    // Mastery Surge — instant mastery bump to 1 or 2 random hand cards (CW = fizzle)
    case 'mastery_surge': {
      if (isChargeWrong) {
        // Intentional fizzle — 1 AP spent, nothing changes
        result.masteryBumpsCount = 0;
        return result;
      }
      const surgeStats = getMasteryStats('mastery_surge', card.masteryLevel ?? 0);
      const surgeTargets = surgeStats?.extras?.targets;
      let bumpCount: number;
      if (isChargeCorrect) {
        bumpCount = surgeTargets ?? 2;
      } else {
        // QP: from stat table; mastery_surge_qp2 tag (legacy): 2 at L3+
        bumpCount = surgeTargets ?? (hasTag('mastery_surge_qp2') ? 2 : 1);
      }
      // NOTE: cursed-card wasted-on-cursed ruling: bump is applied but has no visible effect.
      // Random card selection (excluding self) is performed by turnManager using masteryBumpsCount.
      result.masteryBumpsCount = bumpCount;
      // msurge_plus2: +2 mastery per bumped card instead of +1
      if (hasTag('msurge_plus2')) {
        result.masteryBumpAmount = 2;
      } else {
        result.masteryBumpAmount = 1;
      }
      // Phase 3 Tag: msurge_ap_on_l5 — if any bumped card reaches L5, grant +1 AP.
      // Signal to turnManager; the actual AP grant happens there after bumps are applied.
      if (hasTag('msurge_ap_on_l5')) {
        result.masteryReachedL5Count = 0; // initialized to 0; turnManager sets actual count
      }
      return result;
    }

    // War Drum — universal hand buff this turn
    case 'war_drum': {
      // finalValue encodes the per-card bonus (+2/+4/+1 QP/CC/CW + mastery via perLevelDelta=1)
      result.warDrumBonus = finalValue;
      // war_drum_draw1: also draw 1 card
      if (hasTag('war_drum_draw1')) {
        result.extraCardsDrawn = 1;
      }
      return result;
    }

    // Entropy — dual DoT: Burn + Poison
    case 'entropy': {
      // Burn/poison stacks read from stat-table extras (qpValue=0 for entropy).
      // CC/CW hardcoded at fixed values; QP scales with mastery via extras.burn/poison.
      const burnStacks = isChargeCorrect ? 6 : (isChargeWrong ? 2 : (_masteryStats?.extras?.['burn'] ?? 2));
      let poisonStacks: number;
      let poisonDuration: number;
      if (isChargeCorrect) {
        poisonStacks = 4;
        poisonDuration = 3;
      } else if (isChargeWrong) {
        poisonStacks = 1;
        poisonDuration = 1;
      } else {
        poisonStacks = _masteryStats?.extras?.['poison'] ?? 2;
        poisonDuration = _masteryStats?.extras?.['poisonTurns'] ?? 2;
      }
      result.applyBurnStacks = Math.round(burnStacks * chainMultiplier);
      result.statusesApplied.push({ type: 'poison', value: Math.round(poisonStacks * chainMultiplier), turnsRemaining: poisonDuration });
      return result;
    }

    // Archive — mark cards to be retained past turn end
    case 'archive': {
      // stat table extras.retain: L0=1, L2=2, L4=3 — read directly instead of using dead archive_retain2_qp tag
      const statRetain = _masteryStats?.extras?.['retain'] as number ?? 1;
      let retainCount: number;
      if (isChargeCorrect) {
        // CC bonus: stat retain + 1, minimum 2
        retainCount = Math.max(2, statRetain + 1);
      } else if (isChargeWrong) {
        retainCount = 1;
      } else {
        // QP: from stat table extras.retain (L0=1, L2=2, L4=3)
        retainCount = statRetain;
      }
      result.archiveRetainCount = retainCount;
      // archive_block2_per: each retained card gains +2 block
      if (hasTag('archive_block2_per')) {
        result.archiveBlockBonus = 2;
      }
      // archive_draw1: also draw 1
      if (hasTag('archive_draw1')) {
        result.extraCardsDrawn = (result.extraCardsDrawn ?? 0) + 1;
      }
      return result;
    }

    // Reflex — draw cards; passive (discard-from-hand → block) handled in turnManager
    case 'reflex': {
      let reflexDraw: number;
      if (isChargeCorrect) {
        // reflex_draw3cc: CC draws 3 instead of 2
        reflexDraw = hasTag('reflex_draw3cc') ? 3 : 2;
      } else if (isChargeWrong) {
        reflexDraw = 1;
      } else {
        // QP: 2; reflex_enhanced tag: 3
        reflexDraw = hasTag('reflex_enhanced') ? 3 : 2;
      }
      result.extraCardsDrawn = reflexDraw;
      // Passive block on discard is handled entirely in turnManager.discardFromHand().
      return result;
    }

    // Recollect — return forgotten card(s) to discard pile
    case 'recollect': {
      let recollectCount: number;
      if (isChargeCorrect) {
        recollectCount = 2;
      } else if (isChargeWrong) {
        recollectCount = 1;
      } else {
        // QP: 1; recollect_qp2 tag: 2
        recollectCount = hasTag('recollect_qp2') ? 2 : 1;
      }
      // Inscriptions (isRemovedFromGame) cannot be Recollected — enforced by turnManager UI filter.
      result.forgottenCardsToReturn = recollectCount;
      // recollect_upgrade1: returned cards get +1 mastery bump
      if (hasTag('recollect_upgrade1')) {
        result.recollectUpgrade = 1;
      }
      // recollect_play_free: play 1 returned card free this turn
      if (hasTag('recollect_play_free')) {
        result.recollectPlayFree = true;
      }
      return result;
    }

    // Synapse — draw + wildcard chain link on CC
    case 'synapse': {
      let synapseDraw: number;
      if (isChargeCorrect) {
        synapseDraw = 2;
        // synapse_chain_link: CC counts as wildcard chain link (extends active chain)
        if (hasTag('synapse_chain_link')) {
          result.applyWildcardChainLink = true;
        }
        // synapse_chain_plus1: chain link also grants +1 chain bonus
        if (hasTag('synapse_chain_plus1')) {
          result.synapseChainBonus = 1;
        }
      } else if (isChargeWrong) {
        synapseDraw = 1;
      } else {
        // QP: 2; synapse_draw3_qp tag: 3
        synapseDraw = hasTag('synapse_draw3_qp') ? 3 : 2;
      }
      result.extraCardsDrawn = synapseDraw;
      return result;
    }

    // Siphon Knowledge — draw + brief answer preview overlay (FLAGSHIP)
    case 'siphon_knowledge': {
      let siphonDraw: number;
      let previewSeconds: number;
      if (isChargeCorrect) {
        siphonDraw = 3;
        previewSeconds = 5;
        // siphon_eliminate1: CC eliminates 1 wrong answer from the quiz
        if (hasTag('siphon_eliminate1')) {
          result.eliminateDistractor = 1;
        }
      } else if (isChargeWrong) {
        siphonDraw = 1;
        previewSeconds = 2;
      } else {
        // QP: 2 (3 via siphon_qp3_time4s tag); 3s preview (4s with tag)
        const siphonQp3 = hasTag('siphon_qp3_time4s');
        siphonDraw = siphonQp3 ? 3 : 2;
        previewSeconds = siphonQp3 ? 4 : 3;
      }
      result.extraCardsDrawn = siphonDraw;
      result.siphonAnswerPreviewDuration = previewSeconds;
      return result;
    }

    // Tutor — search draw pile for any card and add to hand; CC: card costs 0 AP this turn
    case 'tutor': {
      // tutor_free_play tag: tutored card costs 0 AP (applies on QP too when tag is active)
      const tutorFree = isChargeCorrect || (!isChargeWrong && hasTag('tutor_free_play'));
      result.tutoredCardFree = tutorFree;
      // CardBrowser.svelte is opened by turnManager reading the mechanicId.
      // If draw pile is empty, fallback to discard is handled by turnManager.
      return result;
    }

    // Sacrifice — lose 5 HP, draw cards, gain AP
    case 'sacrifice': {
      const masteryL3Sacrifice = (card.masteryLevel ?? 0) >= 3;
      let sacrificeDraw: number;
      let sacrificeAp: number;
      if (isChargeCorrect) {
        sacrificeDraw = 3;
        sacrificeAp = 2;
      } else if (isChargeWrong) {
        sacrificeDraw = 1;
        sacrificeAp = 1;
      } else {
        // QP: 2 (3 at L3 via sacrifice_draw3_qp tag); gain 1 AP always on QP
        sacrificeDraw = masteryL3Sacrifice ? 3 : 2;
        sacrificeAp = 1;
      }
      result.selfDamage = 5; // fixed 5 HP loss, not affected by cursed/mastery/buffs
      result.extraCardsDrawn = sacrificeDraw;
      result.sacrificeApGain = sacrificeAp;
      // AP gain can exceed MAX_AP_PER_TURN (no hard cap per spec Appendix F).
      result.grantsAp = sacrificeAp;
      return result;
    }

    // Catalyst — double Poison (and on CC: also Burn/Bleed depending on tags)
    case 'catalyst': {
      // catalyst_triple: TRIPLE stacks instead of doubling (overrides normal behavior)
      const isTriple = hasTag('catalyst_triple');
      // Always doubles/triples Poison
      result.poisonDoubled = !isTriple;
      if (isTriple) result.catalystTriple = true;
      // catalyst_burn: also double/triple Burn (on CC or if tag is active)
      if (isChargeCorrect || hasTag('catalyst_burn')) {
        result.burnDoubled = !isTriple;
      }
      // catalyst_bleed: also double/triple Bleed (on QP with tag, or CC with tag)
      if (hasTag('catalyst_bleed')) {
        result.bleedDoubled = !isTriple;
      }
      // turnManager reads these flags and mutates enemy statusEffects accordingly.
      // When catalystTriple=true, turnManager multiplies stacks by 3 instead of 2.
      return result;
    }

    // Mimic — copy a card from the discard pile to hand (player picks or random)
    case 'mimic': {
      // mimic_choose: player picks from discard (not random)
      // turnManager checks mimicChoose to show CardPickerOverlay vs random selection
      if (hasTag('mimic_choose')) {
        result.mimicChoose = true;
      }
      result.pendingCardPick = {
        type: 'mimic',
        sourceCardId: card.id,
        candidates: [], // Populated by turnManager from discard pile
        pickCount: 1,
        allowSkip: true,
        title: 'Mimic — Copy a Card',
      };
      return result;
    }

    // Aftershock — repeat last played card at reduced power (current turn only)
    case 'aftershock': {
      const masteryLevelAftershock = card.masteryLevel ?? 0;
      // perLevelDelta = +0.1× per level: QP 0.5→0.8, CC 0.7→1.0 at L3
      const qpMult = Math.min(1.0, 0.5 + (masteryLevelAftershock * 0.1));
      const ccMult = Math.min(1.0, 0.7 + (masteryLevelAftershock * 0.1));
      const cwMult = 0.3; // CW mult is fixed

      let targetMechanic: string | null = null;
      let repeatMult: number;
      if (isChargeCorrect) {
        targetMechanic = advanced.lastCCMechanicThisTurn ?? null;
        repeatMult = ccMult;
      } else if (isChargeWrong) {
        targetMechanic = advanced.lastAnyMechanicThisTurn ?? null;
        repeatMult = cwMult;
      } else {
        targetMechanic = advanced.lastQPMechanicThisTurn ?? null;
        repeatMult = qpMult;
      }
      // Cannot target itself (prevents infinite recursion)
      if (targetMechanic === 'aftershock') targetMechanic = null;
      if (targetMechanic) {
        result.aftershockRepeat = { mechanicId: targetMechanic, multiplier: repeatMult };
      }
      // aftershock_no_quiz: CC repeat doesn't need a quiz answer
      if (isChargeCorrect && hasTag('aftershock_no_quiz')) {
        result.aftershockNoQuiz = true;
      }
      // No-op if no valid target (AP still spent per spec)
      return result;
    }

    // Knowledge Bomb — flat QP/CW; CC scales with total correct Charges this encounter (or run)
    case 'knowledge_bomb': {
      if (isChargeCorrect) {
        const kbStats = getMasteryStats('knowledge_bomb', card.masteryLevel ?? 0);
        const perCorrect = kbStats?.extras?.perCorrect ?? (4 + (card.masteryLevel ?? 0));
        // kbomb_count_past: count all charges this RUN not just this encounter
        // correctChargesThisRun must be passed via advanced options (same field as encounter for now)
        // turnManager populates correctChargesThisEncounter; when kbombCountPast=true it uses run total
        const kbombPast = hasTag('kbomb_count_past');
        if (kbombPast) {
          result.kbombCountPast = true;
        }
        const correctCount = advanced.correctChargesThisEncounter ?? 1;
        const kbDmg = perCorrect * correctCount;
        applyAttackDamage(kbDmg);
      } else {
        // QP and CW: flat 4 damage (no mastery bonus per spec — mastery only applies to CC path)
        applyAttackDamage(4);
      }
      return result;
    }

    // Inscription of Wisdom — persistent per-CC draw/heal effect; CW = complete fizzle
    case 'inscription_wisdom': {
      if (isChargeWrong) {
        // Intentional complete fizzle: 3 AP wasted, removed from game, zero effect.
        result.inscriptionFizzled = true;
        // Card is removed from game — signaled by forgetOnResolve.
        // turnManager sets isRemovedFromGame on seeing inscriptionFizzled=true for inscriptions.
        result.forgetOnResolve = true;
        return result;
      }
      // Cursed + QP: 0.7× of "draw 1 extra" rounds to 0 → treat as fizzle
      if (card.isCursed && !isChargeCorrect) {
        result.inscriptionFizzled = true;
        result.forgetOnResolve = true;
        return result;
      }
      const masteryL3Wisdom = (card.masteryLevel ?? 0) >= 3;
      const extraDraw = 1;
      const healPerCC = isChargeCorrect
        ? (masteryL3Wisdom ? 2 : 1) // CC: heal 1 (or 2 at L3 via inscription_wisdom_heal2 tag)
        : 0;                        // QP: no heal
      result.inscriptionWisdomActivated = { extraDrawPerCC: extraDraw, healPerCC };
      // Inscription forgets on play and is removed from game (not recyclable via Recollect).
      result.forgetOnResolve = true;
      return result;
    }

    // Debuff: Expose — apply Vulnerable stacks (no damage); L5 also deals 3 damage
    case 'expose': {
      // finalValue encodes stack count; minimum 1 so QP always applies at least 1 stack.
      const exposeStacks = Math.max(1, Math.round(finalValue));
      const baseExposeDuration = isChargeCorrect ? 2 : 1;
      const exposeDuration = Math.round(baseExposeDuration * (1 + (chainMultiplier - 1) * 0.5));
      result.statusesApplied.push({
        type: 'vulnerable',
        value: exposeStacks,
        turnsRemaining: exposeDuration,
      });
      // L5: expose_dmg3 — also deals 3 damage
      if (hasTag('expose_dmg3')) applyAttackDamage(3);
      return result;
    }
    // Debuff: Weaken — apply Weakness stacks (no damage)
    case 'weaken': {
      // finalValue encodes stack count; minimum 1 so QP always applies at least 1 stack.
      const weakenStacks = Math.max(1, Math.round(finalValue));
      const baseWeakenDuration = isChargeCorrect ? 2 : 1;
      const weakenDuration = Math.round(baseWeakenDuration * (1 + (chainMultiplier - 1) * 0.5));
      result.statusesApplied.push({
        type: 'weakness',
        value: weakenStacks,
        turnsRemaining: weakenDuration,
      });
      return result;
    }

    // power_strike — clean scaling; Tags: power_vuln1, power_vuln2t, power_vuln75
    case 'power_strike': {
      applyAttackDamage(finalValue);
      // Tag: power_vuln1 OR power_vuln2t — apply Vulnerable on hit.
      if (hasTag('power_vuln1') || hasTag('power_vuln2t')) {
        // Phase 3 Tag: power_vuln2t — Vulnerable lasts 2 turns instead of 1.
        const vulnDuration = hasTag('power_vuln2t') ? 2 : 1;
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: vulnDuration });
        if (hasTag('power_vuln2t')) result.vulnDurationOverride = 2;
      }
      // Phase 3 Tag: power_vuln75 — Vulnerable multiplier is 1.75x instead of 1.5x.
      // This is a passive that's activated at encounter start via vulnMultiplierOverride on TurnState.
      // No per-card effect needed here — already handled in Phase 2 passive scan.
      return result;
    }

    case 'reinforce': {
      let reinforceBlock = applyShieldRelics(finalValue);
      // Phase 3 Tag: reinforce_perm1 — add reinforcePermanentBonus to block value.
      // The bonus increments each play (handled in turnManager after this resolves).
      if (hasTag('reinforce_perm1')) {
        reinforceBlock += (advanced.reinforcePermanentBonus ?? 0);
        result.reinforcePermanentBonusIncrement = true;
      }
      result.shieldApplied = reinforceBlock;
      // L5: reinforce_draw1 — also draws 1 card
      if (hasTag('reinforce_draw1')) result.extraCardsDrawn = 1;
      return result;
    }

    case 'guard': {
      result.shieldApplied = applyShieldRelics(finalValue);
      // L5: guard_taunt1t — enemy must attack player next turn
      if (hasTag('guard_taunt1t')) result.tauntDuration = 1;
      return result;
    }

    // Phase 3 Tag: strike_tempo3 — +4 damage if 3+ cards played this turn
    case 'strike': {
      applyAttackDamage(finalValue);
      if (hasTag('strike_tempo3') && (advanced.cardsPlayedThisTurn ?? 0) >= 3) {
        result.damageDealt = (result.damageDealt ?? 0) + 4;
        result.enemyDefeated = result.damageDealt >= enemy.currentHP;
      }
      return result;
    }

    // Phase 3 Tag: block_consecutive3 — +3 block if player played shield last turn
    case 'block': {
      let blockValueConsec = applyShieldRelics(finalValue);
      if (hasTag('block_consecutive3') && (advanced.lastTurnPlayedShield ?? false)) {
        blockValueConsec += 3;
      }
      result.shieldApplied = blockValueConsec;
      return result;
    }

    default:
      break;
  }

  // Fallback behavior by card type (phase-1 compatibility).
  switch (effectiveType) {
    case 'attack': {
      applyAttackDamage(finalValue);
      break;
    }
    case 'shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      break;
    }
    case 'buff': {
      result.finalValue = finalValue + (passiveBonuses?.buff ?? 0);
      break;
    }
    case 'debuff': {
      const debuffFinal = finalValue + (passiveBonuses?.debuff ?? 0);
      const weaknessValue = Math.floor(debuffFinal / 2);
      if (weaknessValue > 0) {
        result.statusesApplied.push({
          type: 'weakness',
          value: weaknessValue,
          turnsRemaining: 2,
        });
      }
      if (debuffFinal >= 5) {
        result.statusesApplied.push({
          type: 'vulnerable',
          value: 1,
          turnsRemaining: 2,
        });
      }
      break;
    }
    case 'utility': {
      result.extraCardsDrawn = Math.max(1, finalValue + (passiveBonuses?.utility ?? 0));
      break;
    }
    case 'wild':
      break;
  }

  return result;
}
