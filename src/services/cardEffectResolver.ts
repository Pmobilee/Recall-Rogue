// === Card Effect Resolver ===
// Resolves card play into effect results. Does not mutate player/enemy state.

import type { Card, CardType } from '../data/card-types';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { EnemyInstance } from '../data/enemies';
import {
  BASE_EFFECT,
  LEGACY_TIER_MULTIPLIER,
  TIER_MULTIPLIER,
  CHARGE_CORRECT_MULTIPLIER,
  SURGE_CC_BONUS_MULTIPLIER,
  getBalanceOverrides,
  CURSED_QP_MULTIPLIER,
  CURSED_CHARGE_CORRECT_MULTIPLIER,
  CURSED_CHARGE_WRONG_MULTIPLIER,
} from '../data/balance';
import { getMasteryBaseBonus, getMasterySecondaryBonus } from './cardUpgradeService';
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
  /** AR-207: If true, the card should be exhausted after resolution (volatile_slash CC, burnout_shield CC). */
  exhaustOnResolve?: boolean;
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
  /** Recollect: number of exhausted cards to return to discard pile. */
  exhaustedCardsToReturn?: number;
  /** Sacrifice: AP gained (can exceed MAX_AP_PER_TURN). */
  sacrificeApGain?: number;
  /** Ironhide: Strength granted and whether it is permanent. */
  ironhideStrength?: { amount: number; permanent: boolean };
  /** Bulwark / Volatile Slash / Burnout Shield: exhaust this card after resolving. */
  exhaustAfterPlay?: boolean;
  /** Archive: number of cards to retain in hand at turn end. */
  archiveRetainCount?: number;
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
   * Count of cards per domain in the active deck (draw + discard + hand, not exhaust).
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
}

export function isCardBlocked(card: Card, enemy: EnemyInstance): boolean {
  return enemy.template.immuneDomain != null && card.domain === enemy.template.immuneDomain;
}

function getTierMultiplier(tier: Card['tier']): number {
  if (typeof tier === 'string') return TIER_MULTIPLIER[tier] ?? 1.0;
  return LEGACY_TIER_MULTIPLIER[tier as 1 | 2 | 3] ?? 1.0;
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

  // Tier multiplier — used for no-mechanic (legacy) cards and execute bonus.
  const tierMultiplier = getTierMultiplier(card.tier);
  // Card's effectMultiplier (tier-derived, set at card creation time).
  const focusAdjustedMultiplier = card.effectMultiplier;

  // Per-mechanic play-mode values: use mechanic's quickPlayValue / chargeCorrectValue / chargeWrongValue
  // if available; otherwise fall back to card.baseEffectValue with tier scaling (legacy path).
  const isChargeCorrect = playMode === 'charge' || playMode === 'charge_correct';
  const isChargeWrong = playMode === 'charge_wrong';

  // Apply mastery bonus (AR-113) before charge multiplier so CC also scales the mastery bonus.
  const masteryBonus = getMasteryBaseBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);

  let mechanicBaseValue: number;
  if (mechanic) {
    if (isChargeCorrect) {
      // Mastery added inside multiplier so CC scales both base and mastery equally.
      mechanicBaseValue = Math.round((mechanic.quickPlayValue + masteryBonus) * CHARGE_CORRECT_MULTIPLIER);
    } else if (isChargeWrong) {
      mechanicBaseValue = mechanic.chargeWrongValue + masteryBonus;
    } else {
      // quick / quick_play
      mechanicBaseValue = mechanic.quickPlayValue + masteryBonus;
    }
  } else {
    // No mechanic definition (wild fallback, unknown mechanic).
    // Apply tier multiplier to preserve pre-v2 behavior for these cards.
    mechanicBaseValue = baseEffectValue * tierMultiplier + masteryBonus;
  }

  const masterySecondaryBonus = getMasterySecondaryBonus(card.mechanicId ?? '', card.masteryLevel ?? 0);
  // Apply mastery secondary bonus to a copy of the card so switch cases can read it uniformly
  if (masterySecondaryBonus > 0 && mechanic) {
    const currentSecondary = card.secondaryValue ?? mechanic.secondaryValue ?? 0;
    card = { ...card, secondaryValue: currentSecondary + masterySecondaryBonus };
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
  const effectiveBase = mechanicBaseValue + sharpenedEdgeBonus + furyBonus;

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
    ? resolveShieldModifiers(activeRelicIds)
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
  const scaledValue = Math.round(rawValue * chainMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier * factDamageBonusMult * surgeMultiplier);
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
    if (isVulnerable(enemy.statusEffects)) damage = Math.round(damage * 1.5);
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
      const hits = (card.secondaryValue ?? mechanic?.secondaryValue ?? 3) + (activeRelicIds.has('chain_lightning_rod') ? 1 : 0);
      // AR-203: Set hitCount so turnManager resolves Burn per-hit instead of combined.
      // damageDealt is set to the per-hit base value; turnManager accumulates the total.
      if (hits > 1) {
        applyAttackDamage(finalValue); // per-hit base (Vulnerable already applied)
        result.hitCount = hits;
        return result;
      }
      applyAttackDamage(finalValue * hits);
      return result;
    }
    case 'piercing': {
      result.damageDealtBypassesBlock = true;
      applyAttackDamage(finalValue);
      return result;
    }
    case 'reckless': {
      result.selfDamage = card.secondaryValue ?? mechanic?.secondaryValue ?? 3;
      applyAttackDamage(finalValue);
      return result;
    }
    case 'execute': {
      const threshold = mechanic?.secondaryThreshold ?? 0.3;
      // execute bonus scales with the same per-mechanic charge value (chargeCorrectValue = 8 bonus at base)
      const bonusBaseValue = isChargeCorrect ? 24 : (isChargeWrong ? 4 : 8);
      const scaledBonus = Math.round(bonusBaseValue * focusAdjustedMultiplier * chainMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier);
      const executeBonus = enemy.currentHP / enemy.maxHP < threshold ? scaledBonus : 0;
      applyAttackDamage(finalValue + executeBonus);
      return result;
    }
    case 'fortify': {
      // Entrench: gain block based on current block amount
      const currentBlock = playerState.shield ?? 0;
      if (isChargeCorrect) {
        // CC: gain 75% of current block + card value (strong reward for correct answer)
        result.shieldApplied = Math.floor(currentBlock * 0.75) + applyShieldRelics(finalValue);
      } else if (isChargeWrong) {
        // CW: gain 25% of current block (minimal)
        result.shieldApplied = Math.floor(currentBlock * 0.25);
      } else {
        // QP: gain 50% of current block
        result.shieldApplied = Math.floor(currentBlock * 0.5);
      }
      return result;
    }
    case 'parry': {
      result.shieldApplied = applyShieldRelics(finalValue);
      const enemyIsAttacking = enemy.nextIntent.type === 'attack' || enemy.nextIntent.type === 'multi_attack';
      if (enemyIsAttacking) result.parryDrawBonus = 1;
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
      result.shieldApplied = applyShieldRelics(Math.max(intentBlock, finalValue));
      return result;
    }
    case 'overheal': {
      const healthPercentage = playerState.hp / playerState.maxHP;
      const bonusMultiplier = healthPercentage < 0.5 ? 2.0 : 1.0;
      result.shieldApplied = applyShieldRelics(Math.round(finalValue * bonusMultiplier));
      return result;
    }
    case 'lifetap': {
      const damageFromCard = finalValue + (passiveBonuses?.attack ?? 0);
      result.healApplied = Math.max(1, Math.floor(damageFromCard * 0.20));
      applyAttackDamage(damageFromCard);
      return result;
    }
    case 'quicken': {
      result.grantsAp = 1;
      // charge_correct bonus: also draw 1 card
      result.extraCardsDrawn = isChargeCorrect ? 1 : 0;
      result.finalValue = 1;
      return result;
    }
    case 'focus': {
      result.applyFocusBuff = true;
      // charge_correct bonus: grant 2 focus charges (two cards get AP reduction)
      const focusCharges = isChargeCorrect ? 2 : 1;
      result.focusCharges = focusCharges;
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
      // charge_correct bonus: also apply Weaken for 1 turn
      if (isChargeCorrect) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    case 'hex': {
      // hex poison value scales with play mode
      const poisonValue = isChargeCorrect ? 8 : (isChargeWrong ? 2 : 3);
      // plague_flask — poison lasts 1 extra turn
      const poisonTurns = 3 + resolvePoisonDurationBonus(activeRelicIds);
      result.statusesApplied.push({ type: 'poison', value: poisonValue, turnsRemaining: poisonTurns });
      return result;
    }
    case 'foresight': {
      // draw count scales with play mode
      const drawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = drawCount;
      return result;
    }
    case 'transmute': {
      const candidates = generateTransmuteCandidates(card.masteryLevel ?? 0);
      result.pendingCardPick = {
        type: 'transmute',
        sourceCardId: card.id,
        candidates,
        pickCount: (card.masteryLevel ?? 0) >= 3 ? 2 : 1,
        allowSkip: true,
        title: 'Transform Card',
      };
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
      // Both block and reflect scale with play mode
      result.shieldApplied = applyShieldRelics(finalValue);
      // thornsValue scales proportionally: quick=3, charge_correct=9, charge_wrong=2
      const thornsBaseReflect = isChargeCorrect ? 9 : (isChargeWrong ? 2 : 3);
      result.thornsValue = Math.round(thornsBaseReflect * focusAdjustedMultiplier);
      return result;
    }
    case 'cleanse': {
      result.applyCleanse = true;
      result.extraCardsDrawn = 1;
      return result;
    }
    case 'empower': {
      // empower finalValue is used directly as buffNextCard in turnManager
      result.finalValue = finalValue;
      return result;
    }
    case 'scout': {
      // draw count scales with play mode
      const scoutDrawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);
      result.extraCardsDrawn = scoutDrawCount;
      return result;
    }
    case 'recycle': {
      // draw count scales with play mode; charge_correct also draws from discard
      const recycleDrawCount = isChargeCorrect ? 4 : (isChargeWrong ? 2 : 3);
      result.extraCardsDrawn = recycleDrawCount;
      if (isChargeCorrect) result.drawFromDiscard = 1;
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
      // Actual copy happens in turnManager after checking lastCardEffect.
      return result;
    }
    case 'adapt': {
      const masteryLvl = card.masteryLevel ?? 0;
      const masteryBonus = getMasteryBaseBonus('adapt', masteryLvl);
      const baseDmg = (mechanic?.quickPlayValue ?? 4) + masteryBonus;
      const baseBlock = (mechanic?.quickPlayValue ?? 4) + masteryBonus;

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
      return result;
    }
    // AR-203: Ignite — sets a buff so the NEXT attack card played adds Burn stacks.
    case 'ignite': {
      // finalValue encodes the Burn stacks to apply on the next attack.
      // QP = 4, CC = 8, CW = 2 (from mechanic definition + mastery bonus).
      result.applyIgniteBuff = finalValue;
      return result;
    }
    // AR-203/AR-206: Lacerate — applies Bleed stacks AND deals damage.
    case 'lacerate': {
      // QP: 4 dmg + 4 Bleed; CC: 12 dmg + 8 Bleed; CW: 3 dmg + 2 Bleed
      const lacerateBleed = isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 4));
      applyAttackDamage(finalValue);
      result.applyBleedStacks = lacerateBleed;
      return result;
    }

    // ── AR-206: New card resolver cases ────────────────────────────────────────

    // Filler: Twin Strike — 2 hits, each triggers Burn/Bleed separately
    case 'twin_strike': {
      const hits = 2;
      applyAttackDamage(finalValue); // per-hit damage (Vulnerable already applied)
      result.hitCount = hits;
      return result;
    }
    // Filler: Iron Wave — hybrid damage + block
    case 'iron_wave': {
      applyAttackDamage(finalValue);
      const ironWaveBlock = isChargeCorrect
        ? Math.round((mechanic?.quickPlayValue ?? 5) * CHARGE_CORRECT_MULTIPLIER + getMasterySecondaryBonus(mechanicId, card.masteryLevel ?? 0))
        : (isChargeWrong ? Math.round((card.secondaryValue ?? mechanic?.secondaryValue ?? 5) * 0.7) : applyShieldRelics(card.secondaryValue ?? mechanic?.secondaryValue ?? 5));
      result.shieldApplied = applyShieldRelics(ironWaveBlock);
      return result;
    }
    // Filler: Shrug It Off — block + draw on QP/CC (no draw on CW)
    case 'shrug_it_off': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (!isChargeWrong) {
        // L3+ draws 2 instead of 1 (addTagAtLevel: [3, 'draw2'])
        const draws = (card.masteryLevel ?? 0) >= 3 ? 2 : 1;
        result.extraCardsDrawn = draws;
      }
      return result;
    }
    // Filler: Bash — damage + apply Vulnerable
    case 'bash': {
      applyAttackDamage(finalValue);
      const bashVulnDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Vuln duration (addTagAtLevel: [3, 'vuln_ext'])
      const masteryVulnBonus = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.statusesApplied.push({
        type: 'vulnerable',
        value: 1,
        turnsRemaining: bashVulnDuration + masteryVulnBonus,
      });
      return result;
    }
    // Filler: Sap — small damage + apply Weakness
    case 'sap': {
      applyAttackDamage(finalValue);
      const sapWeakDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Weakness duration
      const masteryWeakBonus = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.statusesApplied.push({
        type: 'weakness',
        value: 1,
        turnsRemaining: sapWeakDuration + masteryWeakBonus,
      });
      return result;
    }
    // Bleed: Rupture — damage + Bleed stacks
    case 'rupture': {
      applyAttackDamage(finalValue);
      const ruptureBleed = isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 3));
      result.applyBleedStacks = ruptureBleed;
      return result;
    }
    // Burn: Kindle — damage + Burn, and the hit itself triggers the Burn immediately
    case 'kindle': {
      applyAttackDamage(finalValue);
      const kindleBurn = isChargeCorrect ? 8 : (isChargeWrong ? 2 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 4));
      result.applyBurnStacks = kindleBurn;
      // hitCount = 1 so turnManager triggers Burn once on this hit
      result.hitCount = 1;
      return result;
    }
    // New: Overcharge — QP/CW fixed damage; CC scales with encounter charge count
    case 'overcharge': {
      // The turnManager will read encounterChargeCount to compute CC bonus.
      // We set a flag via mechanicId being 'overcharge' — turnManager handles scaling.
      applyAttackDamage(finalValue);
      return result;
    }
    // New: Riposte — hybrid damage + block
    case 'riposte': {
      applyAttackDamage(finalValue);
      const riposteBlock = isChargeCorrect
        ? Math.round(12 * focusAdjustedMultiplier * chainMultiplier * speedBonus * buffMultiplier * overclockMultiplier)
        : (isChargeWrong ? applyShieldRelics(Math.round((card.secondaryValue ?? mechanic?.secondaryValue ?? 4) * 0.75))
          : applyShieldRelics(card.secondaryValue ?? mechanic?.secondaryValue ?? 4));
      result.shieldApplied = applyShieldRelics(riposteBlock);
      return result;
    }
    // New: Absorb — block, CC also draws a card
    case 'absorb': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        // L3+ draws 2 instead of 1
        const draws = (card.masteryLevel ?? 0) >= 3 ? 2 : 1;
        result.extraCardsDrawn = draws;
      }
      return result;
    }
    // New: Reactive Shield — block + Thorns for turns
    case 'reactive_shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      const rsThornValue = isChargeCorrect ? 5 : (isChargeWrong ? 1 : (card.secondaryValue ?? mechanic?.secondaryValue ?? 2));
      const rsThornDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Thorns base
      const masteryThornsBonus = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.thornsValue = rsThornValue + masteryThornsBonus;
      return result;
    }
    // New: Sift — scry (look at top N, discard some)
    case 'sift': {
      const siftLookAt = isChargeCorrect ? 5 : (isChargeWrong ? 2 : (card.baseEffectValue ?? 3));
      const siftDiscard = isChargeCorrect ? 2 : 1;
      result.siftParams = { lookAt: siftLookAt, discardCount: siftDiscard };
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
        mechanicBaseValue = 8 * (distractorCount + 1);
        applyAttackDamage(mechanicBaseValue);
      } else {
        applyAttackDamage(finalValue); // QP: 8, CW: 4 (from mechanic definition)
      }
      return result;
    }
    // New: Stagger — skip enemy next action
    case 'stagger': {
      result.applyStagger = true;
      if (isChargeCorrect) {
        result.statusesApplied.push({ type: 'vulnerable', value: 1, turnsRemaining: 1 });
      }
      // L3+ bonus on QP: also apply Weakness
      if (!isChargeCorrect && !isChargeWrong && (card.masteryLevel ?? 0) >= 3) {
        result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: 1 });
      }
      return result;
    }
    // New: Corrode — remove enemy block + apply Weakness
    case 'corrode': {
      // QP: remove 5 block + 1t Weakness; CC: remove ALL block + 2t Weakness; CW: remove 3 + 1t
      const corrodeRemove = isChargeCorrect ? -1 : (isChargeWrong ? 3 : finalValue); // -1 = remove all
      const corrodeWeakDuration = isChargeCorrect ? 2 : 1;
      // L3+ bonus: +1 Weakness duration
      const masteryWeakBonusC = (card.masteryLevel ?? 0) >= 3 ? 1 : 0;
      result.removeEnemyBlock = corrodeRemove;
      result.statusesApplied.push({ type: 'weakness', value: 1, turnsRemaining: corrodeWeakDuration + masteryWeakBonusC });
      return result;
    }
    // New: Swap — discard 1, draw 1 (QP/CW) or draw 2 (CC)
    case 'swap': {
      const swapDrawCount = isChargeCorrect ? 2 : 1;
      // L3+ CC: draws 3
      const masterySwapBonus = (isChargeCorrect && (card.masteryLevel ?? 0) >= 3) ? 1 : 0;
      result.swapDiscardDraw = { discardCount: 1, drawCount: swapDrawCount + masterySwapBonus };
      return result;
    }
    // New: Siphon Strike — damage + overkill heal (min 2, max 10)
    case 'siphon_strike': {
      applyAttackDamage(finalValue);
      if (!isChargeWrong) {
        // Overkill heal computed here; turnManager adjusts based on actual HP remaining.
        // We store the min heal; turnManager computes overkill and clamps.
        const minHeal = (card.masteryLevel ?? 0) >= 3 ? 3 : 2;
        result.overkillHeal = minHeal; // sentinel: turnManager computes actual overkill
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
      // resolveInscription() in turnManager handles registration + exhaust.
      // finalValue encodes the per-attack bonus (QP=2, CC=4, CW=1 + mastery).
      result.finalValue = finalValue;
      return result;
    }
    // New: Inscription of Iron — persistent block per turn for rest of combat
    case 'inscription_iron': {
      // resolveInscription() in turnManager handles registration + exhaust.
      // finalValue encodes the per-turn block bonus (QP=3, CC=6, CW=1 + mastery).
      result.finalValue = finalValue;
      return result;
    }

    // ── AR-207: Phase 2 Identity / Flagship Cards ───────────────────────────

    // Gambit — HP swing attack
    case 'gambit': {
      applyAttackDamage(finalValue);
      const masteryL3 = (card.masteryLevel ?? 0) >= 3;
      if (isChargeCorrect) {
        result.gambitHeal = 5;
        result.healApplied = 5;
      } else if (isChargeWrong) {
        const selfDmg = masteryL3 ? 4 : 5;
        result.gambitselfDamage = selfDmg;
        result.selfDamage = selfDmg;
      } else {
        // QP
        const selfDmg = masteryL3 ? 1 : 2;
        result.gambitselfDamage = selfDmg;
        result.selfDamage = selfDmg;
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
        result.chainLightningChainLength = 1; // sentinel; turnManager sets real value
      } else {
        applyAttackDamage(finalValue);
      }
      return result;
    }

    // Volatile Slash — exhaust on CC
    case 'volatile_slash': {
      applyAttackDamage(finalValue);
      if (isChargeCorrect) {
        result.exhaustOnResolve = true;
      }
      return result;
    }

    // Burnout Shield — exhaust on CC
    case 'burnout_shield': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        result.exhaustOnResolve = true;
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
      return result;
    }

    // Warcry — Strength buff + optional free Charge
    case 'warcry': {
      const masteryL3Warcry = (card.masteryLevel ?? 0) >= 3;
      if (isChargeCorrect) {
        // +2 Str permanent + free Charge flag
        result.applyStrengthToPlayer = { value: 2, permanent: true };
        result.warcryFreeCharge = true;
      } else if (isChargeWrong) {
        // +1 Str this turn only
        result.applyStrengthToPlayer = { value: 1, permanent: false };
      } else {
        // QP: +2 Str this turn; L3+: also +1 Str permanent
        result.applyStrengthToPlayer = { value: 2, permanent: false };
        if (masteryL3Warcry) {
          // Handled in turnManager: check for warcry_perm_str tag at L3+
          result.warcryFreeCharge = false; // no free charge on QP
        }
      }
      result.finalValue = isChargeCorrect ? 2 : (isChargeWrong ? 1 : 2);
      return result;
    }

    // Battle Trance — draw + optional lockout
    case 'battle_trance': {
      const masteryL3BT = (card.masteryLevel ?? 0) >= 3;
      if (isChargeCorrect) {
        // Draw 3, no restriction
        result.battleTranceDraw = 3;
        result.extraCardsDrawn = 3;
      } else if (isChargeWrong) {
        // Draw 2, locked out
        result.battleTranceDraw = 2;
        result.extraCardsDrawn = 2;
        result.applyBattleTranceRestriction = true;
      } else {
        // QP: draw 3 (or 4 at L3+), locked out
        const drawCount = masteryL3BT ? 4 : 3;
        result.battleTranceDraw = drawCount;
        result.extraCardsDrawn = drawCount;
        result.applyBattleTranceRestriction = true;
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
          turnsRemaining: 2 + Math.round(masteryBonusDuration),
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
          turnsRemaining: 1 + Math.round(masteryBonusDuration),
        });
      } else {
        // QP: 2 Weakness (1t + mastery duration)
        result.statusesApplied.push({
          type: 'weakness',
          value: 2,
          turnsRemaining: 1 + Math.round(masteryBonusDuration),
        });
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
      const dmgPerCurse = isChargeCorrect ? 5 : (isChargeWrong ? 1 : 3);
      // Apply mastery bonus (+1 per level to dmg per curse base)
      const masteryDmgBonus = getMasteryBaseBonus(mechanicId, card.masteryLevel ?? 0);
      const effectiveDmgPerCurse = dmgPerCurse + masteryDmgBonus;
      const totalDamage = effectiveDmgPerCurse * cursedCount;
      if (totalDamage > 0) {
        applyAttackDamage(totalDamage);
      }
      result.darkKnowledgeDmgPerCurse = effectiveDmgPerCurse;
      return result;
    }

    // Chain Anchor — draw + optional chain anchor flag
    case 'chain_anchor': {
      // Draws 1 in all modes. CC also sets chainAnchorActive.
      // Chain Anchor is NOT a chain link itself.
      result.extraCardsDrawn = 1;
      if (isChargeCorrect) {
        result.applyChainAnchor = true;
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
        // QP/CW: random selection
        // At L3+ QP, player chooses 1 of 2 pre-selected options (simulated as random for now).
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
      }
      return result;
    }

    // ── AR-208: Phase 3 Advanced / Chase Cards ────────────────────────────

    // AR-264: Smite — CC scales inversely with fog; CW extra fog penalty
    case 'smite': {
      if (isChargeCorrect) {
        // CC: damage scales inversely with fog. At fog 0 (flow): 70. At fog 5 (neutral): 40. At fog 10 (max fog): 10.
        const fogLevel = getAuraLevel();
        mechanicBaseValue = 10 + (6 * (10 - fogLevel));
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
        // Complete fizzle — 0 damage + fog crashes by 3 (total +5 with standard +2)
        result.damageDealt = 0;
        result.rawValue = 0;
        result.finalValue = 0;
        adjustAura(3);  // Fog crash — increases fog massively
        return result;
      }
      if (isChargeCorrect) {
        // CC: 40 damage base. Flow State bonus: +16 if Aura >= 7 (flow_state threshold).
        mechanicBaseValue = 40;
        if (getAuraState() === 'flow_state') {
          mechanicBaseValue += 16; // Total: 56 in Flow State
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
          result.healApplied = 6;
        } else {
          // Normal CC: override to 20 damage
          mechanicBaseValue = 20;
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
      const bleedStacks = advanced.enemyBleedStacks ?? 0;
      const hemoBase = (mechanic?.baseValue ?? 4) + getMasteryBaseBonus(mechanicId, card.masteryLevel ?? 0);
      const bleedMult = isChargeCorrect ? 6 : (isChargeWrong ? 2 : 4);
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
      // perLevelDelta = +1 per-AP damage per level
      const qpPerAp = 8 + masteryLevelEruption;
      const ccPerAp = 12 + masteryLevelEruption;
      const cwPerAp = 5 + masteryLevelEruption;
      const perAp = isChargeCorrect ? ccPerAp : (isChargeWrong ? cwPerAp : qpPerAp);
      const eruptionDmg = perAp * xAp;
      if (eruptionDmg > 0) applyAttackDamage(eruptionDmg);
      result.xCostApConsumed = xAp;
      return result;
    }

    // Bulwark — mega block; CC exhausts the card
    case 'bulwark': {
      const bulwarkBlock = applyShieldRelics(finalValue);
      result.shieldApplied = bulwarkBlock;
      if (isChargeCorrect) {
        result.exhaustAfterPlay = true;
      }
      return result;
    }

    // Shield Bash — deal damage equal to current block WITHOUT consuming it
    // Block stays up as defense. CC multiplier applies via finalValue scaling.
    case 'conversion': {
      const playerBlock = playerState.shield ?? 0;
      if (playerBlock > 0) {
        const cursedMult = card.isCursed ? 0.7 : 1.0;
        const modePct = isChargeWrong ? 0.5 : (isChargeCorrect ? 1.5 : 1.0);
        const damage = Math.floor(playerBlock * modePct * cursedMult);
        applyAttackDamage(damage);
      }
      // blockConsumed stays 0 — block is NOT consumed
      return result;
    }

    // Ironhide — block + Strength (temp on QP, permanent on CC)
    case 'ironhide': {
      result.shieldApplied = applyShieldRelics(finalValue);
      if (isChargeCorrect) {
        result.ironhideStrength = { amount: 1, permanent: true };
      } else if (isChargeWrong) {
        // CW: block only (finalValue=4 at base + mastery), no Strength
        result.ironhideStrength = undefined;
      } else {
        // QP: temp Strength this turn
        result.ironhideStrength = { amount: 1, permanent: false };
        // L3: QP also gives permanent Str
        if ((card.masteryLevel ?? 0) >= 3) {
          result.ironhideStrength = { amount: 1, permanent: true };
        }
      }
      return result;
    }

    // Frenzy — grant N free-play charges
    case 'frenzy': {
      // finalValue encodes the count (2/3/1 QP/CC/CW + mastery tag at L3)
      const masteryL3Frenzy = (card.masteryLevel ?? 0) >= 3;
      let frenzyCount: number;
      if (isChargeCorrect) {
        frenzyCount = 3;
      } else if (isChargeWrong) {
        frenzyCount = 1;
      } else {
        // QP: 2 normally; L3: 3 (via frenzy_qp3 tag)
        frenzyCount = masteryL3Frenzy ? 3 : 2;
      }
      result.frenzyChargesGranted = frenzyCount;
      return result;
    }

    // Mastery Surge — instant mastery bump to 1 or 2 random hand cards (CW = fizzle)
    case 'mastery_surge': {
      if (isChargeWrong) {
        // Intentional fizzle — 1 AP spent, nothing changes
        result.masteryBumpsCount = 0;
        return result;
      }
      const masteryL3Surge = (card.masteryLevel ?? 0) >= 3;
      let bumpCount: number;
      if (isChargeCorrect) {
        bumpCount = 2;
      } else {
        // QP: 1; L3: 2 (via mastery_surge_qp2 tag)
        bumpCount = masteryL3Surge ? 2 : 1;
      }
      // NOTE: cursed-card wasted-on-cursed ruling: bump is applied but has no visible effect.
      // Random card selection (excluding self) is performed by turnManager using masteryBumpsCount.
      result.masteryBumpsCount = bumpCount;
      return result;
    }

    // War Drum — universal hand buff this turn
    case 'war_drum': {
      // finalValue encodes the per-card bonus (+2/+4/+1 QP/CC/CW + mastery via perLevelDelta=1)
      result.warDrumBonus = finalValue;
      return result;
    }

    // Entropy — dual DoT: Burn + Poison
    case 'entropy': {
      const masteryLevelEntropy = card.masteryLevel ?? 0;
      // perLevelDelta = +1 Burn per level (QP base 3, so at L3 = 6)
      // finalValue already has mastery bonus applied (encodes Burn stacks)
      const burnStacks = finalValue; // includes mastery delta
      let poisonStacks: number;
      let poisonDuration: number;
      if (isChargeCorrect) {
        poisonStacks = 4;
        poisonDuration = 3;
      } else if (isChargeWrong) {
        poisonStacks = 1;
        poisonDuration = 1;
      } else {
        poisonStacks = 2;
        poisonDuration = 2;
        // L3: QP also gets +1 Poison (entropy_poison_qp tag)
        if (masteryLevelEntropy >= 3) poisonStacks += 1;
      }
      result.applyBurnStacks = burnStacks;
      result.statusesApplied.push({ type: 'poison', value: poisonStacks, turnsRemaining: poisonDuration });
      return result;
    }

    // Archive — mark cards to be retained past turn end
    case 'archive': {
      const masteryL3Archive = (card.masteryLevel ?? 0) >= 3;
      let retainCount: number;
      if (isChargeCorrect) {
        retainCount = 2;
      } else if (isChargeWrong) {
        retainCount = 1;
      } else {
        // QP: 1 normally; L3: 2 (via archive_retain2_qp tag)
        retainCount = masteryL3Archive ? 2 : 1;
      }
      result.archiveRetainCount = retainCount;
      return result;
    }

    // Reflex — draw cards; passive (discard-from-hand → block) handled in turnManager
    case 'reflex': {
      const masteryL3Reflex = (card.masteryLevel ?? 0) >= 3;
      let reflexDraw: number;
      if (isChargeCorrect) {
        reflexDraw = 3;
      } else if (isChargeWrong) {
        reflexDraw = 1;
      } else {
        // QP: 2; L3: 3 (via reflex_enhanced tag)
        reflexDraw = masteryL3Reflex ? 3 : 2;
      }
      result.extraCardsDrawn = reflexDraw;
      // Passive block on discard is handled entirely in turnManager.discardFromHand().
      return result;
    }

    // Recollect — return exhausted card(s) to discard pile
    case 'recollect': {
      const masteryL3Recollect = (card.masteryLevel ?? 0) >= 3;
      let recollectCount: number;
      if (isChargeCorrect) {
        recollectCount = 2;
      } else if (isChargeWrong) {
        recollectCount = 1;
      } else {
        // QP: 1; L3: 2 (via recollect_qp2 tag)
        recollectCount = masteryL3Recollect ? 2 : 1;
      }
      // Inscriptions (isRemovedFromGame) cannot be Recollected — enforced by turnManager UI filter.
      result.exhaustedCardsToReturn = recollectCount;
      return result;
    }

    // Synapse — draw + wildcard chain link on CC
    case 'synapse': {
      const masteryL3Synapse = (card.masteryLevel ?? 0) >= 3;
      let synapseDraw: number;
      if (isChargeCorrect) {
        synapseDraw = 2;
        result.applyWildcardChainLink = true; // extends active chain by 1
      } else if (isChargeWrong) {
        synapseDraw = 1;
      } else {
        // QP: 2; L3: 3 (via synapse_draw3_qp tag)
        synapseDraw = masteryL3Synapse ? 3 : 2;
      }
      result.extraCardsDrawn = synapseDraw;
      return result;
    }

    // Siphon Knowledge — draw + brief answer preview overlay (FLAGSHIP)
    case 'siphon_knowledge': {
      const masteryL3Siphon = (card.masteryLevel ?? 0) >= 3;
      let siphonDraw: number;
      let previewSeconds: number;
      if (isChargeCorrect) {
        siphonDraw = 3;
        previewSeconds = 5;
      } else if (isChargeWrong) {
        siphonDraw = 1;
        previewSeconds = 2;
      } else {
        // QP: 2 (3 at L3 via siphon_qp3_time4s tag); 3s preview (4s at L3)
        siphonDraw = masteryL3Siphon ? 3 : 2;
        previewSeconds = masteryL3Siphon ? 4 : 3;
      }
      result.extraCardsDrawn = siphonDraw;
      result.siphonAnswerPreviewDuration = previewSeconds;
      return result;
    }

    // Tutor — search draw pile for any card and add to hand; CC: card costs 0 AP this turn
    case 'tutor': {
      const masteryL3Tutor = (card.masteryLevel ?? 0) >= 3;
      // Tutored card gets free-this-turn on CC; also on QP at L3 (tutor_free_qp tag)
      const tutorFree = isChargeCorrect || (masteryL3Tutor && !isChargeWrong);
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

    // Catalyst — double Poison (and on CC: also Burn; on L3 QP: also Bleed)
    case 'catalyst': {
      result.poisonDoubled = true;
      if (isChargeCorrect) {
        result.burnDoubled = true;
      }
      // L3 QP: also double Bleed (catalyst_bleed_qp tag)
      if (!isChargeCorrect && !isChargeWrong && (card.masteryLevel ?? 0) >= 3) {
        result.bleedDoubled = true;
      }
      // turnManager reads these flags and mutates enemy statusEffects accordingly.
      return result;
    }

    // Mimic — copy a card from the discard pile to hand (player picks)
    case 'mimic': {
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
      // No-op if no valid target (AP still spent per spec)
      return result;
    }

    // Knowledge Bomb — flat QP/CW; CC scales with total correct Charges this encounter
    case 'knowledge_bomb': {
      if (isChargeCorrect) {
        const masteryLevelKB = card.masteryLevel ?? 0;
        // perLevelDelta = +1 per-correct dmg per level; base 4/correct at L0
        const perCorrect = 4 + masteryLevelKB;
        // correctChargesThisEncounter is already incremented to include this CC play
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
        // Card is removed from game (not just exhaust) — signaled by exhaustOnResolve.
        // turnManager sets isRemovedFromGame on seeing inscriptionFizzled=true for inscriptions.
        result.exhaustOnResolve = true;
        return result;
      }
      // Cursed + QP: 0.7× of "draw 1 extra" rounds to 0 → treat as fizzle
      if (card.isCursed && !isChargeCorrect) {
        result.inscriptionFizzled = true;
        result.exhaustOnResolve = true;
        return result;
      }
      const masteryL3Wisdom = (card.masteryLevel ?? 0) >= 3;
      const extraDraw = 1;
      const healPerCC = isChargeCorrect
        ? (masteryL3Wisdom ? 2 : 1) // CC: heal 1 (or 2 at L3 via inscription_wisdom_heal2 tag)
        : 0;                        // QP: no heal
      result.inscriptionWisdomActivated = { extraDrawPerCC: extraDraw, healPerCC };
      // Inscription exhausts on play and is removed from game (not recyclable via Recollect).
      result.exhaustOnResolve = true;
      return result;
    }

    // Debuff: Expose — apply Vulnerable stacks (no damage)
    case 'expose': {
      // finalValue encodes stack count; minimum 1 so QP always applies at least 1 stack.
      const exposeStacks = Math.max(1, Math.round(finalValue));
      const exposeDuration = isChargeCorrect ? 2 : 1;
      result.statusesApplied.push({
        type: 'vulnerable',
        value: exposeStacks,
        turnsRemaining: exposeDuration,
      });
      return result;
    }
    // Debuff: Weaken — apply Weakness stacks (no damage)
    case 'weaken': {
      // finalValue encodes stack count; minimum 1 so QP always applies at least 1 stack.
      const weakenStacks = Math.max(1, Math.round(finalValue));
      const weakenDuration = isChargeCorrect ? 2 : 1;
      result.statusesApplied.push({
        type: 'weakness',
        value: weakenStacks,
        turnsRemaining: weakenDuration,
      });
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
