// === Turn Manager ===
// Core encounter loop for card combat.

import { get } from 'svelte/store';
import type { Card, CardRunState, CardType, PassiveEffect } from '../data/card-types';
// discoverySystem.ts — isFirstChargeFree/markFirstChargeUsed removed (Pass 8: free first charge disabled).
// getFirstChargeWrongMultiplier retained in discoverySystem.ts for historical reference.
import { canMasteryUpgrade, canMasteryDowngrade, masteryUpgrade, masteryDowngrade, resetEncounterMasteryFlags, getMasteryBaseBonus, getMasteryStats, getEffectiveApCost } from './cardUpgradeService';
import { getSurgeChargeSurcharge, isSurgeTurn } from './surgeSystem';
import { resetChain, decayChain, extendOrResetChain, getChainState, getCurrentChainLength, initChainSystem, rotateActiveChainColor, getActiveChainColor, getChainMultiplier, switchActiveChainColor } from './chainSystem';
import { resetAura, adjustAura, getAuraState } from './knowledgeAuraSystem';
import { resetReviewQueue, addToReviewQueue, clearReviewQueueFact, isReviewQueueFact } from './reviewQueueSystem';
import { CHAIN_MOMENTUM_ENABLED, CHARGE_AP_SURCHARGE, RELIC_AEGIS_STONE_MAX_CARRY } from '../data/balance';
import { activeRunState } from './runStateStore';
import type { EnemyInstance } from '../data/enemies';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { CardEffectResult } from './cardEffectResolver';
import { discardHand, drawHand, playCard as deckPlayCard } from './deckManager';
import { computeCatchUpMastery } from './catchUpMasteryService';
import {
  createPlayerCombatState,
  applyShield,
  takeDamage,
  healPlayer,
  tickPlayerStatusEffects,
  resetTurnState,
} from './playerCombatState';
import { resolveCardEffect, isCardBlocked } from './cardEffectResolver';
import { playCardAudio } from './cardAudioManager';
import { applyDamageToEnemy, executeEnemyIntent, rollNextIntent, tickEnemyStatusEffects, dispatchEnemyTurnStart } from './enemyManager';
import { applyStatusEffect, triggerBurn, getBleedBonus } from '../data/statusEffects';
import type { EnemyReactContext } from '../data/enemies';
import { hasSynergy, getMasteryAscensionBonus } from './relicSynergyResolver';
import {
  PLAYER_START_HP,
  START_AP_PER_TURN,
  MAX_AP_PER_TURN,
  ENRAGE_SEGMENTS,
  ENRAGE_PHASE1_BONUS,
  ENRAGE_PHASE2_BONUS,
  ENRAGE_PHASE1_DURATION,
  ENRAGE_LOW_HP_THRESHOLD,
  ENRAGE_LOW_HP_BONUS,
  FIZZLE_EFFECT_RATIO,
  getBalanceValue,
  BLEED_BONUS_PER_STACK,
  BLEED_DECAY_PER_TURN,
  SURGE_DRAW_BONUS,
  SURGE_BONUS_AP,
  AP_PER_ACT,
  ENEMY_TURN_DAMAGE_CAP,
} from '../data/balance';
import { MECHANICS_BY_TYPE, getMechanicDefinition, type PlayMode } from '../data/mechanics';
import { difficultyMode } from './cardPreferences';
import {
  resolveDamageTakenEffects,
  resolveLethalEffects,
  resolvePerfectTurnBonus,
  resolveTurnEndEffects,
  resolveTurnStartEffects,
  resolveChargeCorrectEffects,
  resolveChainMultiplierBonus,
  resolvePrismaticShardApBonus,
  resolveDoubleDownBonus,
  resolveDrawBias,
  resolveEncounterStartEffects,
  resolveShieldModifiers,
  resolveChargeWrongEffects,
  resolveChainCompleteEffects,
  resolveHealModifiers,
  resolveHpLossEffects,
  resolveExhaustEffects,
  resolveChainBreakEffects,
} from './relicEffectResolver';
import { applyPostIntentDamageScaling } from './enemyDamageScaling';

// ─── AR-269: Akashic Record — fact spacing tracker ──────────────────────────
/**
 * Module-level map: factId → last encounter number it was charged in.
 * Persists across encounters within a run; reset at run start via resetFactLastSeenEncounter().
 * "Encounter number" = the value of turnState.encounterNumber when the card was charged.
 */
const _factLastSeenEncounterMap = new Map<string, number>();

/**
 * Reset the fact-last-seen map. Call at the start of every new run so spacing
 * doesn't carry over from a previous run in the same session.
 */
export function resetFactLastSeenEncounter(): void {
  _factLastSeenEncounterMap.clear();
  // Also reset run-scoped relic state so scar_tissue stacks don't bleed across runs
  _scarTissueStacks = 0;
  _slowAnyActionThisTurn = false;
}

// ─── Relic encounter-state counters ─────────────────────────────────────────
/**
 * Scar Tissue (v3): accumulates +1 per wrong Charge across the entire run.
 * Each stack adds +2 flat damage to attack cards via resolveAttackModifiers.
 * Reset at run start (not per-encounter).
 */
let _scarTissueStacks = 0;

/**
 * Lucky Coin (v3): wrong Charges accumulated this encounter.
 * Resets to 0 at encounter start and after arming.
 */
let _wrongChargesForLuckyCoin = 0;

/**
 * Lucky Coin (v3): armed flag — true when 3 wrong Charges have been accumulated
 * this encounter. Next correct Charge gets +50% damage multiplier, then resets.
 */
let _luckyCoinArmed = false;

/**
 * AR-tag-wiring: slow_any_action — when true, the current Slow can skip ANY enemy action type
 * (not just defend/buff). Set during playCardAction when effect.slowAnyAction is true.
 * Cleared in endPlayerTurn after the slow check fires.
 */
let _slowAnyActionThisTurn = false;

/** Maps a status effect type to its apply audio cue. No-ops for unmapped types. */
function playStatusAudio(statusType: string): void {
  const cueMap: Record<string, Parameters<typeof playCardAudio>[0]> = {
    poison: 'status-poison-apply',
    burn: 'status-burn-apply',
    bleed: 'status-bleed-apply',
    weakness: 'status-weakness-apply',
    vulnerable: 'status-vulnerability-apply',
    strength: 'status-strength-apply',
    regen: 'status-regen-apply',
    focus: 'status-focus-apply',
  };
  const cue = cueMap[statusType];
  if (cue) playCardAudio(cue);
}

/**
 * Calculate enrage bonus damage based on floor segment, turn number, and enemy HP.
 * @deprecated Enrage removed (Pass 3 balance, 2026-04-09) — fights should be balanced via
 * enemy stats, not invisible timers. Function kept for compatibility; always returns 0.
 */
export function getEnrageBonus(_turnNumber: number, _floor: number, _enemyHpPercent: number): number {
  return 0; // Enrage removed — fights balanced via enemy stats, not invisible timers
}

export type TurnPhase = 'draw' | 'player_action' | 'enemy_turn' | 'turn_end' | 'encounter_end';

/**
 * A single active Inscription registered during combat.
 * Inscriptions persist for the rest of combat from the turn they are played.
 */
export interface ActiveInscription {
  /** The mechanic ID that created this inscription (e.g. 'inscription_fury'). */
  mechanicId: string;
  /** The numeric effect value locked in at play time (QP/CC/CW resolved value). */
  effectValue: number;
  /** The play mode used when the inscription was played. Stored for Cursed QP 0.7x. */
  playMode: PlayMode;
}

export interface TurnLogEntry {
  type: 'play' | 'skip' | 'fizzle' | 'blocked' | 'enemy_action' | 'status_tick' | 'draw' | 'victory' | 'defeat' | 'heal';
  message: string;
  value?: number;
  cardId?: string;
}

export type EncounterResult = 'victory' | 'defeat' | null;

export interface TurnState {
  phase: TurnPhase;
  /**
   * Global turn counter for this run — persists across encounters.
   * Used by the Surge system (isSurgeTurn). Set from RunState.globalTurnCounter
   * at encounter start. Incremented on endPlayerTurn alongside encounterTurnNumber.
   */
  turnNumber: number;
  /**
   * Per-encounter turn counter — resets to 1 at the start of each fight.
   * Used by the enrage system (getEnrageBonus). Incremented on endPlayerTurn.
   */
  encounterTurnNumber: number;
  playerState: PlayerCombatState;
  enemy: EnemyInstance;
  deck: CardRunState;
  cardsPlayedThisTurn: number;
  cardsCorrectThisTurn: number;
  isPerfectTurn: boolean;
  buffNextCard: number;
  lastCardType?: CardType;
  activePassives: PassiveEffect[];
  activeRelicIds: Set<string>;
  apCurrent: number;
  apMax: number;
  bonusApNextTurn: number;
  baseDrawCount: number;
  bonusDrawNextTurn: number;
  pendingDrawCountOverride: number | null;
  damageDealtThisTurn: number;
  skippedCardsThisEncounter: number;
  firstAttackUsed: boolean;
  secondWindUsed: boolean;
  doubleStrikeReady: boolean;
  focusReady: boolean;
  /** Number of remaining cards that benefit from Focus AP reduction (0 = inactive). */
  focusCharges: number;
  overclockReady: boolean;
  slowEnemyIntent: boolean;
  foresightTurnsRemaining: number;
  persistentShield: number;
  triggeredRelicId: string | null;
  canaryEnemyDamageMultiplier: number;
  canaryQuestionBias: -1 | 0 | 1;
  ascensionLevel: number;
  ascensionEnemyDamageMultiplier: number;
  ascensionShieldCardMultiplier: number;
  ascensionWrongAnswerSelfDamage: number;
  ascensionBaseTimerPenaltySeconds: number;
  ascensionEncounterTimerPenaltySeconds: number;
  ascensionPreferCloseDistractors: boolean;
  ascensionTier1OptionCount: number;
  ascensionForceHardQuestionFormats: boolean;
  ascensionPreventFlee: boolean;
  result: EncounterResult;
  turnLog: TurnLogEntry[];
  /** Facts answered (correct or incorrect) during this encounter */
  encounterAnsweredFacts: string[];
  /** Facts that were actually shown as quiz questions during this encounter (for narrative). */
  encounterQuizzedFacts: string[];
  /** Consecutive correct answers this entire encounter (for Perfect Storm synergy). */
  consecutiveCorrectThisEncounter: number;
  /** Number of Tier 3 (mastered) cards in deck at encounter start (for Mastery Ascension). */
  tier3CardCount: number;
  /** Turns remaining for Phoenix Rage damage bonus (+50%). 0 = inactive. */
  phoenixRageTurnsRemaining: number;
  /** Turns remaining for glass cannon penalty removal. 0 = inactive. */
  glassPenaltyRemovedTurnsRemaining: number;
  /** thorns: whether thorns retaliation is active this turn */
  thornsActive: boolean;
  /** thorns: damage to reflect back to enemy when hit */
  thornsValue: number;
  /** mirror: the last successfully resolved card effect this turn */
  lastCardEffect: CardEffectResult | null;
  /** True when the current turn is a Surge turn (Charge costs +0 AP). Updated at turn start/end. */
  isSurge: boolean;
  /** Current Knowledge Chain multiplier (1.0 = no chain, up to 3.0 at 5-chain). */
  chainMultiplier: number;
  /** Current chain length (0 = no chain). Exposed for UI. */
  chainLength: number;
  /** Current chain type index (0-5), or null if no chain active. Exposed for UI. */
  chainType: number | null;
  /**
   * AR-310: Active chain color for the current turn — the chain type index that
   * extends the chain multiplier when played via Charge Correct.
   * Rotates each turn via rotateActiveChainColor(). null before initChainSystem
   * is called (trivia runs without runChainTypes configured).
   * Exposed for UI so CardHand.svelte can highlight matching cards.
   */
  activeChainColor: number | null;
  /** Whether double_down has already been consumed this encounter. */
  doubleDownUsedThisEncounter: boolean;
  /** Whether mirror_of_knowledge has already been used this encounter (once per encounter). */
  mirrorUsedThisEncounter: boolean;
  /**
   * Chain Momentum (AR-122): when non-null, the next Charge play of this chainType costs +0 AP
   * surcharge instead of +1. Set to the card's chainType after a correct Charge answer; consumed
   * on the next matching Charge play. Resets on wrong Charge, Quick Play, or turn end.
   * null means no momentum is active.
   */
  nextChargeFreeForChainType: number | null;
  /**
   * Phoenix Feather post-resurrection auto-Charge turns remaining.
   * When > 0, all Charge plays are automatically treated as correct (no quiz required).
   * Set to 1 when phoenix_feather resurrection fires; decremented at end of turn.
   */
  phoenixAutoChargeTurns: number;
  /**
   * AR-204: Active Inscriptions for this combat encounter.
   * Inscription cards are played once and persist — their effects are tracked here.
   * Pool = 1 per mechanicId (no stacking same-type inscriptions).
   */
  activeInscriptions: ActiveInscription[];
  /**
   * AR-206: Stagger — when true, the enemy's next action is skipped.
   * The turn counter still advances (enrage still ticks). Resets after firing.
   */
  staggeredEnemyNextTurn: boolean;
  /**
   * AR-206: Ignite buff — Burn stacks to add to the next attack card played.
   * Set by Ignite card; consumed on the first subsequent attack play. 0 = inactive.
   */
  ignitePendingBurn: number;
  /**
   * AR-206: Total Charge plays (correct + wrong) this encounter.
   * Used by Overcharge CC scaling: CC = base + (2 per charge played).
   */
  encounterChargesTotal: number;
  /**
   * AR-207: Battle Trance restriction — when true, no more card plays or Charges allowed this turn.
   * Set by Battle Trance QP/CW. Cleared at turn start (endPlayerTurn).
   */
  battleTranceRestriction: boolean;
  /**
   * AR-207: Warcry free Charge — when true, the next Charge surcharge (+1 AP) this turn is waived.
   * Set by Warcry CC. Cleared at turn end even if unused.
   */
  warcryFreeChargeActive: boolean;
  /**
   * AR-207: Chain Anchor active — when true, the next chain card that would start chain at 1
   * will start at 2 instead (or 3 at mastery L3+). Cleared when a chain card fires.
   */
  chainAnchorActive: boolean;
  /**
   * AR-207: Chain Anchor chain start override (2 or 3 depending on mastery level).
   * Used together with chainAnchorActive.
   */
  chainAnchorStartLength: number;
  /**
   * AR-207: Last mechanic ID played this turn (for Chameleon copy logic).
   * Null if no card has been played yet this turn.
   */
  lastPlayedMechanicId: string | null;
  /**
   * AR-207: Last chain type of the card played (for Chameleon chain inheritance).
   * Null if no chain card was played yet, or if the last card had no chain type.
   */
  lastPlayedChainType: number | null;
  /**
   * AR-211: Total correct Charge plays this run (persists across encounters).
   * Used by Volatile Manuscript (every 3rd Charge applies self-Burn) and Omniscience.
   * Must be carried through TurnState from RunState at encounter start.
   */
  totalChargesThisRun: number;
  /**
   * Deja Vu relic: true after the turn-1 card spawn fires this encounter.
   * Prevents the spawn from repeating on subsequent turns.
   */
  dejaVuUsedThisEncounter: boolean;
  /**
   * Player's current character level (from PlayerSave.characterLevel).
   * Used by Deja Vu level-15+ scaling: at level 15+ spawns 2 cards instead of 1.
   * Threaded in from encounterBridge at encounter start.
   */
  characterLevel: number;
  /**
   * bloodletter relic: armed flag — set to true when player takes self-damage with bloodletter held.
   * The next attack this turn gets +3 damage. Cleared at turn start.
   */
  bloodletterArmed: boolean;
  /**
   * quiz_master relic: number of correctly Charged cards this turn.
   * Used by resolveTurnEndEffects to grant +2 AP next turn if 3+ correct Charges.
   * Cleared at turn start.
   */
  chargeCorrectsThisTurn: number;
  /**
   * AR-262: Total correct Charge answers this encounter (does NOT reset on wrong answer).
   * Used together with encounterChargesTotal to compute the post-encounter accuracy grade.
   * encounterChargesTotal = attempted, chargesCorrectThisEncounter = correct.
   */
  chargesCorrectThisEncounter: number;
  /**
   * AR-269: Monotonically increasing encounter counter for this run.
   * Set from run.floor.currentEncounter at encounter start via encounterBridge.
   * Used by Akashic Record spacing mechanic: tracks which encounter each fact was last charged.
   */
  encounterNumber: number;
  /**
   * Scar Tissue relic: accumulated wrong-Charge count this run.
   * Used by damagePreviewService for flat damage bonus preview (+2 per stack).
   */
  scarTissueStacks: number;
  /**
   * AR-tag-wiring: Pending scry count — number of cards to look at from draw pile.
   * Set by scryCount result from scout_scry2 tag. UI reads this to show scry picker.
   * Cleared after the UI resolves the scry. 0 = no pending scry.
   */
  pendingScryCount: number;
  /**
   * AR-tag-wiring: Number of remaining free-play charges.
   * frenzyChargesGranted and freePlayCount (focus_next2free) both add to this pool.
   * Each card played for free decrements this counter (min 0). 0 = inactive.
   */
  freePlayCharges: number;
  /**
   * AR-tag-wiring: Damage dealt back to the attacker per enemy hit (parry_counter3 tag).
   * Set by resolveCardEffect counterDamage. Applied in endPlayerTurn when enemy attacks.
   * Resets to 0 each turn end.
   */
  counterDamagePerHit: number;
  /**
   * AR-tag-wiring: Timer extension % for the next Charge quiz (precision_timer_ext50 tag).
   * Read by the quiz system before showing the quiz. Cleared after each charge quiz.
   */
  timerExtensionPct: number;
  /**
   * AR-tag-wiring: Number of wrong-answer distractors to eliminate from the next quiz.
   * Read by the quiz system. Cleared after each charge quiz.
   */
  eliminateDistractors: number;
  /**
   * AR-tag-wiring: When true, thorns value carries across encounter end to the next encounter.
   * Set by thorns_persist / reactive_thorns_persist tags. Cleared when thorns resets at encounter start.
   */
  thornsPersistent: boolean;
  /**
   * AR-tag-wiring: Bonus block applied to cards retained by Archive mechanic.
   * Set by archive_block2_per tag result. Used by encounter resolve when applying archive retain.
   * Reset each turn end.
   */
  archiveBlockBonus: number;
  /**
   * AR-tag-wiring: Number of remaining Empower buff targets.
   * When > 1 (empower_2cards tag), buffNextCard persists until this many cards have consumed it.
   * 0 = inactive (default behavior: buff consumed after 1 card).
   */
  empowerRemainingCount: number;
  /**
   * AR-tag-wiring: Number of remaining Ignite attacks.
   * When > 1 (ignite_2attacks tag), the ignite buff persists for this many more attacks.
   * 1 = fire this attack and clear; 0 = inactive.
   */
  igniteRemainingAttacks: number;
  /**
   * AR-tag-wiring: Force enemy to use attack intent for the next N turns (guard_taunt1t tag).
   * 0 = inactive. Decremented at end of each turn. Enemy rolls attack intent when > 0.
   */
  forcedAttackTurnsRemaining: number;
  /**
   * Phase 2: Cumulative self-damage taken this encounter (reckless/gambit self-damage).
   * Used by reckless_selfdmg_scale3 tag to add bonus damage.
   */
  selfDamageTakenThisEncounter: number;
  /**
   * Phase 2: Number of shield cards played last turn.
   * Copied from shieldsPlayedThisTurn at end of turn. Used by block_consecutive3 tag.
   */
  shieldsPlayedLastTurn: number;
  /**
   * Phase 2: Number of shield cards played this turn (current turn counter).
   * Incremented when a shield card is played; copied to shieldsPlayedLastTurn at turn end.
   */
  shieldsPlayedThisTurn: number;
  /**
   * Phase 2: Convenience flag — true if player played at least one shield card last turn.
   * Derived from shieldsPlayedLastTurn > 0. Used by block_consecutive3 tag.
   */
  lastTurnPlayedShield: boolean;
  /**
   * Phase 2: Stacking block bonus from reinforce_perm1 tag.
   * Incremented by +1 each time a reinforce card with this tag is played.
   * Encounter-scoped (resets at encounter start).
   */
  reinforcePermanentBonus: number;
  /**
   * Phase 2: Locked card type (future use — Librarian elite Silence mechanic).
   * null = no restriction.
   */
  lockedCardType: string | null;
  /**
   * Phase 2: Override for the Vulnerable damage multiplier (expose_vuln75 passive).
   * When set, replaces the default 1.5x. Computed at encounter start from deck tags.
   * null = use default 1.5x.
   */
  vulnMultiplierOverride: number | null;
  /**
   * Phase 2: Bonus block percentage when enemy has Weakness (weaken_shield30 passive).
   * 0 = inactive. Computed at encounter start from deck tags.
   * When > 0 and enemy is Weakened, block = block * (1 + weakShieldBonusPercent/100).
   */
  weakShieldBonusPercent: number;
  /**
   * Phase 3 (empower_weak2 tag): number of Weakness stacks to apply to enemy when the next
   * buffed attack fires. Set when empower with empower_weak2 tag is played. Cleared on consumption.
   */
  empowerWeakPending: number;
  /**
   * Narrative: Working buffer — factIds of cards charged correctly in the current unbroken chain.
   * Cleared when the chain breaks (wrong answer or Quick Play) or when a completed sequence
   * (length >= 3) is flushed to completedChainSequences.
   * Using factIds here; answer strings are resolved at snapshot time in encounterBridge.
   */
  currentChainAnswerFactIds: string[];
  /**
   * Narrative: Completed chain sequences (each inner array has factIds for a chain that reached 3+).
   * Captured at chain break / wrong answer / encounter end; consumed by NarrativeEncounterSnapshot.
   */
  completedChainSequences: string[][];
}

export interface PlayCardResult {
  effect: CardEffectResult;
  enemyDefeated: boolean;
  fizzled: boolean;
  blocked: boolean;
  isPerfectTurn: boolean;
  turnState: TurnState;
  /** Whether this card play triggered a mastery level change. */
  masteryChange: 'upgrade' | 'downgrade' | null;
  /** The card ID that was mastery-changed (for animation targeting). */
  masteryChangedCardId: string | null;
  /** AR-202: True when a correct Charge cured a cursed fact on this play. */
  curedCursedFact?: boolean;
  /**
   * When set, the card effect is pending a player UI choice (phase_shift QP/CW or unstable_flux CC).
   * No damage/shield has been applied yet. The UI must show a MultiChoicePopup and call
   * applyPendingChoice() with the selected option id to complete the effect.
   */
  pendingChoice?: {
    cardId: string;
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
   * Bubbled up from CardEffectResult.pendingCardPick.
   */
  pendingCardPick?: {
    type: string;
    sourceCardId: string;
    candidates: import('../data/card-types').Card[];
    pickCount: number;
    allowSkip: boolean;
    title: string;
  };
}

export interface EnemyTurnResult {
  damageDealt: number;
  effectsApplied: StatusEffect[];
  playerDefeated: boolean;
  nextEnemyIntent: string;
  executedIntentType: 'attack' | 'multi_attack' | 'defend' | 'buff' | 'debuff' | 'heal' | 'charge' | 'none';
  blockAbsorbedAll: boolean;
  turnState: TurnState;
}

function getPassiveBonuses(passives: PassiveEffect[]): Partial<Record<CardType, number>> {
  const bonuses: Partial<Record<CardType, number>> = {};
  for (const passive of passives) {
    bonuses[passive.cardType] = (bonuses[passive.cardType] ?? 0) + passive.value;
  }
  return bonuses;
}

function randomCardTypeDifferentFrom(type: CardType): CardType {
  const all: CardType[] = ['attack', 'shield', 'utility', 'buff', 'debuff', 'wild'];
  const candidates = all.filter((candidate) => candidate !== type);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function transmuteWeakestHandCard(turnState: TurnState): void {
  const { hand } = turnState.deck;
  if (hand.length === 0) return;

  // Find the weakest card (lowest baseEffectValue) — always improve the worst card
  let weakestIndex = 0;
  let weakestValue = Infinity;
  for (let i = 0; i < hand.length; i++) {
    const val = hand[i].baseEffectValue ?? 0;
    if (val < weakestValue) {
      weakestValue = val;
      weakestIndex = i;
    }
  }

  const targetIndex = weakestIndex;
  const target = hand[targetIndex];
  const newType = randomCardTypeDifferentFrom(target.cardType);
  const mechanicPool = MECHANICS_BY_TYPE[newType];
  const mechanic = mechanicPool[Math.floor(Math.random() * mechanicPool.length)];

  hand[targetIndex] = {
    ...target,
    cardType: newType,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    apCost: mechanic.apCost,
    baseEffectValue: mechanic.baseValue,
    originalBaseEffectValue: mechanic.baseValue,
  };
}

function createNoEffect(card: Card): CardEffectResult {
  return {
    effectType: card.cardType,
    rawValue: 0,
    finalValue: 0,
    targetHit: false,
    damageDealt: 0,
    shieldApplied: 0,
    healApplied: 0,
    statusesApplied: [],
    extraCardsDrawn: 0,
    enemyDefeated: false,
    mechanicId: card.mechanicId,
    mechanicName: card.mechanicName,
  };
}


/**
 * AR-204: Register an Inscription card effect in the active combat state.
 * Enforces Pool=1: if an inscription with the same mechanicId is already active,
 * the call is a no-op (card is still exhausted by the caller).
 * Does NOT exhaust the card — encounterBridge calls exhaustCard() separately.
 */
export function resolveInscription(turnState: TurnState, card: Card, playMode: PlayMode): void {
  const mechanicId = card.mechanicId ?? '';
  if (!mechanicId) return;
  // Pool=1: no stacking same-type inscriptions
  const alreadyActive = turnState.activeInscriptions.some(i => i.mechanicId === mechanicId);
  if (alreadyActive) return;
  turnState.activeInscriptions.push({
    mechanicId,
    effectValue: card.baseEffectValue,
    playMode,
  });
}

/**
 * AR-204: Return the active inscription for the given mechanicId, or undefined if not active.
 */
export function getActiveInscription(turnState: TurnState, mechanicId: string): ActiveInscription | undefined {
  return turnState.activeInscriptions.find(i => i.mechanicId === mechanicId);
}

export function startEncounter(
  deck: CardRunState,
  enemy: EnemyInstance,
  playerMaxHP?: number,
  globalTurnCounter: number = 1,
): TurnState {
  const playerState = createPlayerCombatState(playerMaxHP ?? getBalanceValue('playerStartHP', PLAYER_START_HP));

  const initialState: TurnState = {
    phase: 'player_action',
    turnNumber: globalTurnCounter,
    encounterTurnNumber: 1,
    playerState,
    enemy,
    deck,
    cardsPlayedThisTurn: 0,
    cardsCorrectThisTurn: 0,
    isPerfectTurn: false,
    buffNextCard: 0,
    lastCardType: undefined,
    activePassives: [],
    activeRelicIds: new Set<string>(),
    apCurrent: START_AP_PER_TURN,
    apMax: MAX_AP_PER_TURN,
    bonusApNextTurn: 0,
    baseDrawCount: 5,
    bonusDrawNextTurn: 0,
    pendingDrawCountOverride: null,
    damageDealtThisTurn: 0,
    skippedCardsThisEncounter: 0,
    firstAttackUsed: false,
    secondWindUsed: false,
    doubleStrikeReady: false,
    focusReady: false,
    focusCharges: 0,
    overclockReady: false,
    slowEnemyIntent: false,
    foresightTurnsRemaining: 0,
    persistentShield: 0,
    triggeredRelicId: null,
    canaryEnemyDamageMultiplier: 1,
    canaryQuestionBias: 0,
    ascensionLevel: 0,
    ascensionEnemyDamageMultiplier: 1,
    ascensionShieldCardMultiplier: 1,
    ascensionWrongAnswerSelfDamage: 0,
    ascensionBaseTimerPenaltySeconds: 0,
    ascensionEncounterTimerPenaltySeconds: 0,
    ascensionPreferCloseDistractors: false,
    ascensionTier1OptionCount: 3,
    ascensionForceHardQuestionFormats: false,
    ascensionPreventFlee: false,
    result: null,
    turnLog: [],
    encounterAnsweredFacts: [],
    encounterQuizzedFacts: [],
    consecutiveCorrectThisEncounter: 0,
    tier3CardCount: 0,
    phoenixRageTurnsRemaining: 0,
    glassPenaltyRemovedTurnsRemaining: 0,
    thornsActive: false,
    thornsValue: 0,
    lastCardEffect: null,
    isSurge: isSurgeTurn(globalTurnCounter),
    chainMultiplier: 1.0,
    chainLength: 0,
    chainType: null,
    activeChainColor: null,
    doubleDownUsedThisEncounter: false,
    mirrorUsedThisEncounter: false,
    nextChargeFreeForChainType: null,
    phoenixAutoChargeTurns: 0,
    activeInscriptions: [],
    staggeredEnemyNextTurn: false,
    ignitePendingBurn: 0,
    encounterChargesTotal: 0,
    chargesCorrectThisEncounter: 0,
    battleTranceRestriction: false,
    warcryFreeChargeActive: false,
    chainAnchorActive: false,
    chainAnchorStartLength: 2,
    lastPlayedMechanicId: null,
    lastPlayedChainType: null,
    totalChargesThisRun: 0,
    dejaVuUsedThisEncounter: false,
    characterLevel: 0,
    bloodletterArmed: false,
    chargeCorrectsThisTurn: 0,
    encounterNumber: 0,
    scarTissueStacks: _scarTissueStacks,
    pendingScryCount: 0,
    // AR-tag-wiring: new result flag fields (all start inactive)
    freePlayCharges: 0,
    counterDamagePerHit: 0,
    timerExtensionPct: 0,
    eliminateDistractors: 0,
    thornsPersistent: false,
    archiveBlockBonus: 0,
    empowerRemainingCount: 0,
    igniteRemainingAttacks: 0,
    forcedAttackTurnsRemaining: 0,
    // Phase 2: New encounter-state tracking fields
    selfDamageTakenThisEncounter: 0,
    empowerWeakPending: 0,
    shieldsPlayedLastTurn: 0,
    shieldsPlayedThisTurn: 0,
    lastTurnPlayedShield: false,
    reinforcePermanentBonus: 0,
    lockedCardType: null,
    vulnMultiplierOverride: null,
    weakShieldBonusPercent: 0,
    // Narrative chain tracking — reset each encounter
    currentChainAnswerFactIds: [],
    completedChainSequences: [],
  };

  // Reset chain at encounter start (clean slate)
  resetChain();
  // AR-310: Set the active chain color for the first turn of this encounter.
  // initChainSystem() is called from encounterBridge before startEncounter.
  const firstTurnColor = rotateActiveChainColor(globalTurnCounter);
  initialState.activeChainColor = firstTurnColor;
  // AR-261: Reset Knowledge Aura and Review Queue at encounter start
  resetAura();
  resetReviewQueue();
  // Reset Lucky Coin per-encounter counters (scar_tissue stacks persist across encounters)
  _wrongChargesForLuckyCoin = 0;
  _luckyCoinArmed = false;

  // Ensure hand is empty before drawing — move any leftover cards to discard
  // (can happen if previous encounter ended without a full turn cycle)
  if (deck.hand.length > 0) {
    deck.discardPile.push(...deck.hand);
    deck.hand = [];
  }

  // Reset mastery encounter flags for all cards in all piles
  const allCards = [...deck.drawPile, ...deck.discardPile, ...deck.hand, ...deck.exhaustPile];
  resetEncounterMasteryFlags(allCards);

  // Phase 2: Compute passive encounter-start effects from deck tags.
  // Scan all deck cards for expose_vuln75 and weaken_shield30 tags — these are passive
  // effects that apply for the entire encounter once any card in the deck has the tag.
  const hasDeckTag = (tag: string): boolean =>
    allCards.some(c => (getMasteryStats(c.mechanicId ?? '', c.masteryLevel ?? 0)?.tags ?? []).includes(tag));
  if (hasDeckTag('expose_vuln75')) {
    initialState.vulnMultiplierOverride = 1.75;
  }
  if (hasDeckTag('weaken_shield30')) {
    initialState.weakShieldBonusPercent = 30;
  }

  const isFirstEncounter = deck.currentFloor === 1 && deck.currentEncounter <= 1;
  drawHand(deck, initialState.baseDrawCount, { firstDrawBias: isFirstEncounter });

  // Guarantee at least 2 shield cards in opening hand (starting-hand bias).
  // If fewer than 2 shields are drawn, swap non-shield cards with shield cards from the draw pile.
  const handShields = initialState.deck.hand.filter(c => c.cardType === 'shield');
  if (handShields.length < 2) {
    const drawPileShields = initialState.deck.drawPile.filter(c => c.cardType === 'shield');
    const needed = 2 - handShields.length;
    for (let i = 0; i < Math.min(needed, drawPileShields.length); i++) {
      // Find a non-shield card in hand to swap out
      const swapIdx = initialState.deck.hand.findIndex(c => c.cardType !== 'shield');
      if (swapIdx === -1) break;
      const shieldCard = drawPileShields[i];
      const shieldInDrawIdx = initialState.deck.drawPile.indexOf(shieldCard);
      if (shieldInDrawIdx === -1) continue;
      // Swap: hand card → draw pile, draw pile shield → hand
      const removed = initialState.deck.hand[swapIdx];
      initialState.deck.hand[swapIdx] = shieldCard;
      initialState.deck.drawPile[shieldInDrawIdx] = removed;
    }
  }

  return initialState;
}

export function playCardAction(
  turnState: TurnState,
  cardId: string,
  answeredCorrectly: boolean,
  speedBonusEarned: boolean,
  playMode: PlayMode = 'charge',
  distractorCount?: number,
  wasQuizzed?: boolean,
): PlayCardResult {
  // AR-207: Battle Trance restriction — block all card plays and Charges after QP/CW
  if (turnState.battleTranceRestriction) {
    const fallbackCardBT = turnState.deck.hand.find((card) => card.id === cardId);
    const effectBT = fallbackCardBT ? createNoEffect(fallbackCardBT) : {
      effectType: 'attack' as CardType,
      rawValue: 0, finalValue: 0, targetHit: false, damageDealt: 0,
      shieldApplied: 0, healApplied: 0, statusesApplied: [], extraCardsDrawn: 0,
      enemyDefeated: false, mechanicId: undefined, mechanicName: undefined,
    };
    return {
      effect: effectBT,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  if (turnState.phase !== 'player_action' || turnState.result !== null) {
    const fallbackCard = turnState.deck.hand.find((card) => card.id === cardId);
    const effect = fallbackCard ? createNoEffect(fallbackCard) : {
      effectType: 'attack' as CardType,
      rawValue: 0,
      finalValue: 0,
      targetHit: false,
      damageDealt: 0,
      shieldApplied: 0,
      healApplied: 0,
      statusesApplied: [],
      extraCardsDrawn: 0,
      enemyDefeated: false,
      mechanicId: undefined,
      mechanicName: undefined,
    };
    return {
      effect,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  const { deck, playerState, enemy } = turnState;
  const cardInHand = deck.hand.find((card) => card.id === cardId);
  if (!cardInHand) throw new Error(`Card ${cardId} not found in hand`);

  // AR-268: Trick Question lock — block Quick Play on locked cards
  if (cardInHand.isLocked && playMode === 'quick') {
    const lockedBlockEffect: CardEffectResult = createNoEffect(cardInHand);
    turnState.turnLog.push({
      type: 'blocked',
      message: 'Card is locked — must Charge to unlock',
      cardId,
    });
    return {
      effect: lockedBlockEffect,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  // Phase 8: Librarian Silence — block all plays of the locked card type
  if (turnState.lockedCardType && cardInHand.cardType === turnState.lockedCardType) {
    const silencedEffect: CardEffectResult = createNoEffect(cardInHand);
    turnState.turnLog.push({
      type: 'blocked',
      message: `${cardInHand.cardType} cards are Silenced this turn`,
      cardId,
    });
    return {
      effect: silencedEffect,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  // Phoenix Feather post-resurrection: auto-Charge free for this turn.
  // Override answeredCorrectly and playMode so the card resolves as a correct Charge.
  if (turnState.phoenixAutoChargeTurns > 0 && playMode === 'charge') {
    answeredCorrectly = true;
  }

  let apCost = getEffectiveApCost(cardInHand);

  // Charge AP surcharge: charging costs base AP + CHARGE_AP_SURCHARGE (1) on normal turns.
  // Priority order (7.6): Surge → Warcry → Chain Momentum → On-Colour → surcharge.
  // Free First Charge was removed in Pass 8 — chain color matching is the intended free-charge mechanism.
  if (playMode === 'charge') {
    // Surge turns no longer waive surcharge — they grant +1 AP at turn-start (SURGE_BONUS_AP).
    // Normal waiver priority applies on all turns including surge.
    if (turnState.warcryFreeChargeActive) {
      // AR-207: Warcry CC — waive surcharge, consume the flag
      turnState.warcryFreeChargeActive = false; // consume the flag
    } else if (CHAIN_MOMENTUM_ENABLED && turnState.nextChargeFreeForChainType !== null && cardInHand.chainType === turnState.nextChargeFreeForChainType) {
      // Chain Momentum: waive surcharge for matching chain type, consume the flag
      turnState.nextChargeFreeForChainType = null; // consume the flag
    } else if (cardInHand.chainType != null && cardInHand.chainType === getActiveChainColor()) {
      // On-Colour charge: waive surcharge — charging into the active chain is free.
      // Rewards focused chain-building play.
    } else {
      // Normal Charge: apply CHARGE_AP_SURCHARGE (+1 AP over Quick Play)
      apCost += CHARGE_AP_SURCHARGE;
    }
  } else if (playMode === 'quick') {
    // Quick Play: momentum lost
    if (CHAIN_MOMENTUM_ENABLED) {
      turnState.nextChargeFreeForChainType = null;
    }
  }

  // Focus: reduce this card's AP cost by 1 (minimum 0); consume one focus charge
  if (turnState.focusReady && turnState.focusCharges > 0 && apCost > 0) {
    apCost = Math.max(0, apCost - 1);
  }
  // freePlayCharges: frenzy / focus_next2free grant N 0-AP card plays
  // Consume one charge and set cost to 0 (takes priority over Focus cost reduction).
  if ((turnState.freePlayCharges ?? 0) > 0) {
    apCost = 0;
    turnState.freePlayCharges -= 1;
  }
  if (turnState.apCurrent < apCost) {
    const blockedEffect: CardEffectResult = createNoEffect(cardInHand);
    turnState.turnLog.push({
      type: 'blocked',
      message: `Not enough AP (${apCost} required)`,
      cardId,
    });
    return {
      effect: blockedEffect,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  const card: Card = { ...cardInHand };
  // AR-202: Capture mastery level BEFORE any downgrade so curse condition uses pre-play value.
  const preMasteryLevel = cardInHand.masteryLevel ?? 0;

  // AR-223 Sub-step 2: New-fact protection — first attempt at a given fact ID is exempt from
  // mastery downgrade and curse. Mark the fact as attempted regardless of correct/wrong outcome.
  // This is per-fact-ID across the entire run (not per card-fact pairing).
  // Note: this is separate from firstChargeFreeFactIds (which tracks the free AP surcharge bonus).
  let isFirstAttempt = false;
  if (card.factId) {
    const runStateForAttempt = get(activeRunState);
    if (runStateForAttempt) {
      isFirstAttempt = !runStateForAttempt.attemptedFactIds.has(card.factId);
      runStateForAttempt.attemptedFactIds.add(card.factId);
      activeRunState.set(runStateForAttempt);
    }
  }

  deckPlayCard(deck, cardId);
  turnState.apCurrent = Math.max(0, turnState.apCurrent - apCost);
  if (apCost > 0) playCardAudio('ap-spend');

  // Track answered fact for encounter cooldown
  if (cardInHand.factId) {
    turnState.encounterAnsweredFacts.push(cardInHand.factId);
  }
  // Track facts actually shown as quiz questions (for narrative — excludes Quick Play, GUARANTEED, Phoenix auto-charge)
  if (cardInHand.factId && wasQuizzed) {
    turnState.encounterQuizzedFacts.push(cardInHand.factId);
  }

  if (isCardBlocked(card, enemy)) {
    turnState.cardsPlayedThisTurn += 1;
    turnState.isPerfectTurn = false;
    const blockedEffect: CardEffectResult = createNoEffect(card);
    turnState.turnLog.push({
      type: 'blocked',
      message: `${card.cardType} card blocked by enemy immunity`,
      cardId,
    });
    return {
      effect: blockedEffect,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: false,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  if (!answeredCorrectly) {
    if (turnState.ascensionWrongAnswerSelfDamage > 0) {
      turnState.playerState.hp = Math.max(0, turnState.playerState.hp - turnState.ascensionWrongAnswerSelfDamage);
    }

    // Step 5e (AR-59.13): Mark that a Charge was attempted this turn (even on wrong answer)
    if (playMode === 'charge') {
      enemy.playerChargedThisTurn = true;
    }

    // Wrong Charge: break or reduce the chain and lose momentum.
    // 7.8: Off-colour wrong charges halve chain length instead of fully resetting,
    // preserving partial momentum. On-colour wrong charges still fully reset.
    if (playMode === 'charge') {
      const prevChainLengthWrong = getCurrentChainLength();
      const isOffColourWrong = cardInHand.chainType !== getActiveChainColor();
      // Narrative: flush chain buffer before chain resets (off-colour halves, on-colour resets fully)
      if (turnState.currentChainAnswerFactIds.length >= 3) {
        turnState.completedChainSequences.push([...turnState.currentChainAnswerFactIds]);
      }
      turnState.currentChainAnswerFactIds = [];
      extendOrResetChain(null, undefined, isOffColourWrong); // null chainType = wrong answer
      if (prevChainLengthWrong > 0) playCardAudio('chain-break');
      if (prevChainLengthWrong > 0 && turnState.activeRelicIds.size > 0) {
        resolveChainBreakEffects(turnState.activeRelicIds, { previousChainLength: prevChainLengthWrong });
      }
      const chainState = getChainState();
      // After off-colour wrong: chainMultiplier reflects reduced (not zero) chain.
      turnState.chainMultiplier = isOffColourWrong && chainState.length > 0
        ? getChainMultiplier(chainState.length)
        : 1.0;
      turnState.chainLength = chainState.length;
      turnState.chainType = chainState.chainType;
      // Chain Momentum: wrong Charge answer loses momentum
      if (CHAIN_MOMENTUM_ENABLED) {
        turnState.nextChargeFreeForChainType = null;
      }
    }

    const mode = get(difficultyMode);
    if (mode === 'relaxed') {
      // AP is NOT refunded — wrong answers always cost AP regardless of mode
      const fizzledEffect = createNoEffect(card);
      turnState.consecutiveCorrectThisEncounter = 0;
      // AR-261: Wrong charge answer — increase fog, add fact to review queue
      adjustAura(1);
      if (card.factId) {
        addToReviewQueue(card.factId);
      }
      turnState.cardsPlayedThisTurn += 1;
      turnState.isPerfectTurn = false;

      // Mastery downgrade: wrong charge answer downgrades the played card.
      // AR-223: Skipped on first attempt at this fact (new-fact protection).
      let masteryChangeRelaxed: 'upgrade' | 'downgrade' | null = null;
      let masteryChangedCardIdRelaxed: string | null = null;
      if (playMode !== 'quick' && !isFirstAttempt) {
        const discardedCard = turnState.deck.discardPile.find(c => c.id === cardId);
        if (discardedCard && canMasteryDowngrade(discardedCard)) {
          masteryDowngrade(discardedCard);
          masteryChangeRelaxed = 'downgrade';
          masteryChangedCardIdRelaxed = cardId;
        }
      }

      // Step 5a (AR-59.13): onPlayerChargeWrong callback — relaxed mode, Charge plays only
      if (playMode === 'charge' && enemy.template.onPlayerChargeWrong) {
        const ctx: EnemyReactContext = {
          enemy,
          cardBaseDamage: card.baseEffectValue ?? 0,
          playMode: 'charge',
          chargeCorrect: false,
          playerBlock: turnState.playerState.shield,
          drainPlayerBlock: (amount: number) => {
            const clamped = Math.min(amount, turnState.playerState.shield);
            turnState.playerState.shield = Math.max(0, turnState.playerState.shield - clamped);
          },
        };
        // AR-268: pass the failed factId so Trick Question hook can set _lockedFactId
        (ctx as any)._failedFactId = card.factId;
        enemy.template.onPlayerChargeWrong(ctx);
        const mirrorDmg = (ctx as any)._mirrorDamage as number | undefined;
        if (mirrorDmg && mirrorDmg > 0) {
          turnState.playerState.hp = Math.max(0, turnState.playerState.hp - mirrorDmg);
        }
      }

      // AR-202: Curse logic — relaxed mode wrong Charge on mastery 0 card.
      // Mastery 1+ wrongs only downgrade.
      // AR-223: Also exempt on first attempt at this fact (new-fact protection).
      if (playMode === 'charge' && !isFirstAttempt && preMasteryLevel === 0 && card.factId) {
        const runState = get(activeRunState);
        if (runState) {
          runState.cursedFactIds.add(card.factId);
          activeRunState.set(runState);
        }
      }

      // AR-241: Per-fact variant progression — wrong Charge keeps or decrements variant level.
      if (playMode === 'charge' && card.factId) {
        const runState = get(activeRunState);
        if (runState) {
          const currentLevel = runState.factVariantLevel[card.factId] ?? 0;
          runState.factVariantLevel[card.factId] = Math.max(0, currentLevel - 1);
          activeRunState.set(runState);
          if (import.meta.env.DEV) {
            console.log(`[QuizVariant] fact=${card.factId} wrong (relaxed) → level ${currentLevel} → ${runState.factVariantLevel[card.factId]}`);
          }
        }
      }

      turnState.turnLog.push({
        type: 'fizzle',
        message: 'Relaxed mode: card fizzled',
        cardId,
      });

      playCardAudio('card-fizzle');

      return {
        effect: fizzledEffect,
        enemyDefeated: false,
        fizzled: true,
        blocked: false,
        isPerfectTurn: false,
        turnState,
          masteryChange: masteryChangeRelaxed,
        masteryChangedCardId: masteryChangedCardIdRelaxed,
      };
    }


    turnState.consecutiveCorrectThisEncounter = 0;
    // AR-261: Wrong charge answer — increase fog, add fact to review queue
    adjustAura(1);
    if (card.factId) {
      addToReviewQueue(card.factId);
    }
    turnState.cardsPlayedThisTurn += 1;
    turnState.isPerfectTurn = false;

    // Mastery downgrade: wrong charge answer downgrades the played card.
    // AR-223: Skipped on first attempt at this fact (new-fact protection).
    let masteryChangeWrong: 'upgrade' | 'downgrade' | null = null;
    let masteryChangedCardIdWrong: string | null = null;
    if (playMode !== 'quick' && !isFirstAttempt) {
      const discardedCard = turnState.deck.discardPile.find(c => c.id === cardId);
      if (discardedCard && canMasteryDowngrade(discardedCard)) {
        masteryDowngrade(discardedCard);
        masteryChangeWrong = 'downgrade';
        masteryChangedCardIdWrong = cardId;
      }
    }

    // Partial fizzle: wrong answers still apply FIZZLE_EFFECT_RATIO (0.50×) of the base effect.
    // Free First Charge special multiplier was removed in Pass 8 (always use standard fizzle ratio now).
    const wrongMultiplier = getBalanceValue('fizzleEffectRatio', FIZZLE_EFFECT_RATIO);
    const fizzleBase = Math.round(card.baseEffectValue * wrongMultiplier);
    const fizzledEffect: CardEffectResult = {
      ...createNoEffect(card),
      targetHit: true,
      rawValue: fizzleBase,
      finalValue: fizzleBase,
      damageDealt: (card.cardType === 'attack' || card.cardType === 'wild') ? fizzleBase : 0,
      shieldApplied: card.cardType === 'shield' ? fizzleBase : 0,
      healApplied: 0,
    };

    // double_down — wrong Charge penalty: override fizzle damage with 0.3× base (once per encounter)
    if (playMode === 'charge' && fizzledEffect.damageDealt > 0) {
      const ddPenalty = resolveDoubleDownBonus(turnState.activeRelicIds, turnState.doubleDownUsedThisEncounter, false);
      if (ddPenalty.active) {
        const ddBase = Math.round(card.baseEffectValue * ddPenalty.damageMultiplier);
        fizzledEffect.damageDealt = ddBase;
        fizzledEffect.rawValue = ddBase;
        fizzledEffect.finalValue = ddBase;
        turnState.doubleDownUsedThisEncounter = true;
      }
    }

    // Apply partial fizzle effects to game state
    if (fizzledEffect.damageDealt > 0) {
      const damageResult = applyDamageToEnemy(enemy, fizzledEffect.damageDealt);
      fizzledEffect.enemyDefeated = damageResult.defeated;
      turnState.damageDealtThisTurn += fizzledEffect.damageDealt;
    }
    if (fizzledEffect.shieldApplied > 0) applyShield(playerState, fizzledEffect.shieldApplied);
    if (fizzledEffect.healApplied > 0) healPlayer(playerState, fizzledEffect.healApplied);

    // resolveChargeWrongEffects: volatile_core, scholars_gambit, glass_lens, mnemonic_scar, etc.
    if (playMode === 'charge' && turnState.activeRelicIds.size > 0 && card.factId) {
      const runStateForCW = get(activeRunState);
      const factPreviouslyCorrect = runStateForCW?.factsAnsweredCorrectly?.has(card.factId) ?? false;
      const chargeWrongFx = resolveChargeWrongEffects(turnState.activeRelicIds, {
        factId: card.factId,
        factPreviouslyCorrect,
        wrongChargesThisEncounter: _wrongChargesForLuckyCoin,
      });
      if (chargeWrongFx.selfDamage > 0) {
        playerState.hp = Math.max(0, playerState.hp - chargeWrongFx.selfDamage);
        if (playerState.hp <= 0) {
          turnState.result = 'defeat';
          turnState.phase = 'encounter_end';
        }
      }
      if (chargeWrongFx.enemyDamage > 0) {
        const cwEnemyResult = applyDamageToEnemy(enemy, chargeWrongFx.enemyDamage);
        fizzledEffect.enemyDefeated = cwEnemyResult.defeated;
        turnState.damageDealtThisTurn += chargeWrongFx.enemyDamage;
        if (cwEnemyResult.defeated) {
          turnState.result = 'victory';
          turnState.phase = 'encounter_end';
        }
      }
      // scar_tissue (v3): increment run-level stack counter on every wrong Charge
      if (chargeWrongFx.scarTissueStackIncrement) {
        _scarTissueStacks++;
        turnState.scarTissueStacks = _scarTissueStacks;
      }
      // lucky_coin (v3): track wrong Charges this encounter; arm on reaching 2
      if (chargeWrongFx.luckyCoinWrongCount !== -1) {
        _wrongChargesForLuckyCoin = chargeWrongFx.luckyCoinWrongCount;
        if (_wrongChargesForLuckyCoin >= 2) {
          _luckyCoinArmed = true;
          _wrongChargesForLuckyCoin = 0;
        }
      }
      // mnemonic_scar v3: draw 1 card on any wrong Charge
      if (chargeWrongFx.drawBonus > 0) {
        drawHand(deck, chargeWrongFx.drawBonus);
      }
    }

    // Step 5a (AR-59.13): onPlayerChargeWrong callback — normal mode, Charge plays only
    if (playMode === 'charge' && enemy.template.onPlayerChargeWrong) {
      const ctx: EnemyReactContext = {
        enemy,
        cardBaseDamage: card.baseEffectValue ?? 0,
        playMode: 'charge',
        chargeCorrect: false,
        playerBlock: turnState.playerState.shield,
        drainPlayerBlock: (amount: number) => {
          const clamped = Math.min(amount, turnState.playerState.shield);
          turnState.playerState.shield = Math.max(0, turnState.playerState.shield - clamped);
        },
      };
      // AR-268: pass the failed factId so Trick Question hook can set _lockedFactId
      (ctx as any)._failedFactId = card.factId;
      enemy.template.onPlayerChargeWrong(ctx);
      const mirrorDmg = (ctx as any)._mirrorDamage as number | undefined;
      if (mirrorDmg && mirrorDmg > 0) {
        turnState.playerState.hp = Math.max(0, turnState.playerState.hp - mirrorDmg);
      }
    }

    // AR-202: Curse logic — normal mode wrong Charge on mastery 0 card.
    // Mastery 1+ wrongs only downgrade (curse on next wrong at 0).
    // AR-223: Also exempt on first attempt at this fact (new-fact protection).
    if (playMode === 'charge' && !isFirstAttempt && preMasteryLevel === 0 && card.factId) {
      const runState = get(activeRunState);
      if (runState) {
        runState.cursedFactIds.add(card.factId);
        activeRunState.set(runState);
      }
    }

    // AR-241: Per-fact variant progression — wrong Charge decrements variant level (min 0).
    if (playMode === 'charge' && card.factId) {
      const runState = get(activeRunState);
      if (runState) {
        const currentLevel = runState.factVariantLevel[card.factId] ?? 0;
        runState.factVariantLevel[card.factId] = Math.max(0, currentLevel - 1);
        activeRunState.set(runState);
        if (import.meta.env.DEV) {
          console.log(`[QuizVariant] fact=${card.factId} wrong → level ${currentLevel} → ${runState.factVariantLevel[card.factId]}`);
        }
      }
    }

    const wrongPct = Math.round(wrongMultiplier * 100);
    turnState.turnLog.push({
      type: 'fizzle',
      message: `Card fizzled — wrong answer (${wrongPct}% effect applied)`,
      cardId,
    });

    playCardAudio('card-fizzle');

    return {
      effect: fizzledEffect,
      enemyDefeated: fizzledEffect.enemyDefeated,
      fizzled: true,
      blocked: false,
      isPerfectTurn: false,
      turnState,
      masteryChange: masteryChangeWrong,
      masteryChangedCardId: masteryChangedCardIdWrong,
    };
  }

  // Update Knowledge Chain state for this card play.
  // Charge (correct): extend/reset chain based on chainType, get multiplier.
  // Quick Play: break the chain (no chain bonus from Quick Play).
  let currentChainMultiplier = 1.0;
  if (playMode === 'charge') {
    // Mid-turn active chain color switch (2026-04-09):
    // When the player correctly Charges an off-colour card, pivot the active chain color
    // to the card's color for the rest of this turn. Chain length is preserved — the correct
    // answer earned the pivot. The new color becomes the surcharge-free color immediately.
    // Quick Play and wrong Charge never trigger the switch (handled by their own branches).
    if (
      card.chainType != null &&
      getActiveChainColor() != null &&
      card.chainType !== getActiveChainColor()
    ) {
      switchActiveChainColor(card.chainType);
      turnState.activeChainColor = card.chainType; // mirror for Svelte UI reactivity
    }
    currentChainMultiplier = extendOrResetChain(card.chainType);
    // prismatic_shard — all chain multipliers +0.5x
    currentChainMultiplier += resolveChainMultiplierBonus(turnState.activeRelicIds);
    // Narrative: track factId for chain completion sequence
    if (card.factId) {
      turnState.currentChainAnswerFactIds.push(card.factId);
    }
  } else {
    // Quick Play breaks the chain
    const prevChainLengthQuick = getCurrentChainLength();
    // Narrative: flush chain buffer before Quick Play breaks the chain
    if (turnState.currentChainAnswerFactIds.length >= 3) {
      turnState.completedChainSequences.push([...turnState.currentChainAnswerFactIds]);
    }
    turnState.currentChainAnswerFactIds = [];
    extendOrResetChain(null);
    if (prevChainLengthQuick > 0) playCardAudio('chain-break');
    if (prevChainLengthQuick > 0 && turnState.activeRelicIds.size > 0) {
      resolveChainBreakEffects(turnState.activeRelicIds, { previousChainLength: prevChainLengthQuick });
    }
  }
  const chainState = getChainState();
  turnState.chainMultiplier = currentChainMultiplier;
  turnState.chainLength = chainState.length;
  turnState.chainType = chainState.chainType;
  // Chain link sound for correct Charge: play cue matching new chain length
  if (playMode === 'charge' && chainState.length > 0) {
    const chainCues = ['chain-link-1', 'chain-link-2', 'chain-link-3', 'chain-link-4', 'chain-link-5'] as const;
    const idx = Math.min(chainState.length, 5) - 1;
    playCardAudio(chainCues[idx]);
  }

  // AR-207: Chain Anchor — if chainAnchorActive and chain just started (length = 1),
  // retroactively set chain to the anchor's starting length (2 or 3).
  // Chain Anchor is NOT a chain link itself, so it only fires on the NEXT card that starts a chain.
  if (turnState.chainAnchorActive && playMode === 'charge' && chainState.length === 1 && card.mechanicId !== 'chain_anchor') {
    // Override chain length to the anchored start
    turnState.chainLength = turnState.chainAnchorStartLength;
    turnState.chainAnchorActive = false; // consume the anchor
    turnState.turnLog.push({
      type: 'play',
      message: `Chain Anchor: chain started at ${turnState.chainAnchorStartLength}`,
      value: turnState.chainAnchorStartLength,
    });
  }

  // prismatic_shard — +1 AP on 5-chain completion
  const prismaticApBonus = resolvePrismaticShardApBonus(turnState.activeRelicIds, chainState.length);
  if (prismaticApBonus > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + prismaticApBonus);
  }

  // Chain complete effects: fire on each Charge card that extends the chain to 2+
  // chain_addict: heal 5 HP on chains of 3+; resonance_crystal/chain_reactor: handled elsewhere
  if (playMode === 'charge' && chainState.length >= 2 && turnState.activeRelicIds.size > 0) {
    const chainCompleteFx = resolveChainCompleteEffects(turnState.activeRelicIds, {
      chainLength: chainState.length,
      firstCardId: card.id,
    });
    if ((chainCompleteFx.healAmount ?? 0) > 0) {
      const chainHealAmt = chainCompleteFx.healAmount!;
      playerState.hp = Math.min(playerState.maxHP, playerState.hp + chainHealAmt);
      turnState.turnLog.push({
        type: 'heal',
        message: `Chain Addict: healed ${chainHealAmt} HP (chain length ${chainState.length})`,
        value: chainHealAmt,
      });
    }
  }

  // AR-268: Trick Question lock — if this card is locked and was Charged correctly with the matching fact,
  // apply a 2x power bonus (unlocked knowledge) and clear the lock.
  // Note: `card` is a spread copy of `cardInHand`; clear lock on both so the discard pile entry is clean.
  let trickQuestionBonusMultiplier = 1.0;
  if (card.isLocked && playMode === 'charge' && answeredCorrectly && card.lockedFactId === card.factId) {
    trickQuestionBonusMultiplier = 2.0;
    // Clear on the copy (used by resolveCardEffect) and the original (will move to discard)
    card.isLocked = false;
    card.lockedFactId = undefined;
    cardInHand.isLocked = undefined;
    cardInHand.lockedFactId = undefined;
    // Also clear the enemy's lock so it doesn't re-apply next turn
    if (enemy._lockedFactId === card.factId) {
      enemy._lockedFactId = undefined;
      enemy._lockTurnsRemaining = 0;
    }
    turnState.turnLog.push({
      type: 'play',
      message: 'Trick Question lock broken — 2× power bonus applied!',
      cardId,
    });
  }

  const speedBonus = (speedBonusEarned ? 1.5 : 1.0) * trickQuestionBonusMultiplier;
  const useDoubleStrike = turnState.doubleStrikeReady && card.cardType === 'attack';
  const useFocus = turnState.focusReady;
  const useOverclock = turnState.overclockReady;
  const isChargeCorrect = playMode === 'charge' || playMode === 'charge_correct';

  // Compute deck domain counts for domain_mastery_sigil: count cards across draw + discard + hand.
  // Exhaust pile is excluded — those cards are permanently removed from the run.
  const deckDomainCounts: Record<string, number> = {};
  const deckCards = [
    ...turnState.deck.drawPile,
    ...turnState.deck.discardPile,
    ...turnState.deck.hand,
  ];
  for (const c of deckCards) {
    if (c.domain) {
      deckDomainCounts[c.domain] = (deckDomainCounts[c.domain] ?? 0) + 1;
    }
  }

  // AR-204: Inscription of Fury — pass flat bonus into AdvancedResolveOptions at damage pipeline step 3.
  const furyInscription = getActiveInscription(turnState, 'inscription_fury');
  const inscriptionFuryBonus = furyInscription?.effectValue ?? 0;

  // AR-207: knowledge_ward — collect unique domains from the current hand at resolve time.
  const handDomains = turnState.deck.hand.map(c => c.domain).filter(Boolean) as string[];

  // AR-207: dark_knowledge — snapshot cursed fact count from run state.
  const cursedFactCount = get(activeRunState)?.cursedFactIds?.size ?? 0;

  // AR-261: wasReviewQueueFact — peek at review queue before resolving (clearReviewQueueFact runs after).
  // Only meaningful on a correct Charge play; false on all other play modes.
  const wasReviewQueueFact = isChargeCorrect && card.factId
    ? isReviewQueueFact(card.factId)
    : false;

  // AR-264: distractorCount — number of wrong-answer options shown in the quiz.
  // If not passed by the caller, fall back to a mastery-based estimate.
  const resolvedDistractorCount = distractorCount ?? Math.min(2 + (card.masteryLevel ?? 0), 4);

  // AR-273: Per-fact damage bonus from mystery event study sessions.
  // Only applies to charge plays (not Quick Play — studying a fact helps you during combat Charges).
  const factDamageBonus = (isChargeCorrect && card.factId)
    ? (get(activeRunState)?.inRunFactTracker?.getDamageBonus(card.factId) ?? 0)
    : 0;

  // AR-262/208: correctChargesThisEncounter — pass the count INCLUDING this play (pre-incremented).
  // The actual mutation of turnState happens later; we pass the prospective value here so the
  // resolver has the correct context (see comment in cardEffectResolver knowledge_bomb case).
  const correctChargesForResolver = isChargeCorrect
    ? turnState.chargesCorrectThisEncounter + 1
    : turnState.chargesCorrectThisEncounter;

  // AR-208: Eruption X-cost — capture remaining AP before resolve so the resolver can compute damage.
  // apCurrent has already been reduced by the card's base AP cost (0 for eruption) at this point.
  // Eruption has apCost=0, so apCurrent here equals exactly the AP available to consume.
  const eruption_mechDef = card.mechanicId ? getMechanicDefinition(card.mechanicId) : null;
  const isXCostCard = eruption_mechDef?.tags?.includes('x_cost') ?? false;
  const eruptionXAp = isXCostCard ? turnState.apCurrent : undefined;

  const effect = resolveCardEffect(
    card,
    playerState,
    enemy,
    speedBonus,
    turnState.buffNextCard,
    turnState.lastCardType,
    getPassiveBonuses(turnState.activePassives),
    {
      activeRelicIds: turnState.activeRelicIds,
      isFirstAttackThisEncounter: !turnState.firstAttackUsed,
      isDoubleStrikeActive: useDoubleStrike,
      isFocusActive: useFocus,
      isOverclockActive: useOverclock,
      damageDealtThisTurn: turnState.damageDealtThisTurn,
      correct: answeredCorrectly,
      playMode,
      chainMultiplier: currentChainMultiplier,
      deckDomainCounts,
      inscriptionFuryBonus,
      handDomains,
      cursedFactCount,
      wasReviewQueueFact,
      distractorCount: resolvedDistractorCount,
      correctChargesThisEncounter: correctChargesForResolver,
      scarTissueStacks: _scarTissueStacks,
      factDamageBonus,
      isSurge: turnState.isSurge,
      vulnMultiplierOverride: turnState.vulnMultiplierOverride,
      cardsPlayedThisTurn: turnState.cardsPlayedThisTurn,
      selfDamageTakenThisEncounter: turnState.selfDamageTakenThisEncounter,
      lastTurnPlayedShield: turnState.lastTurnPlayedShield,
      reinforcePermanentBonus: turnState.reinforcePermanentBonus,
      eruptionXAp,
    },
  );

  // AR-208: X-cost AP drain — consume all remaining AP after eruption resolves.
  // apRefund (eruption_refund1 tag) is handled below and will partially restore AP if active.
  if ((effect.xCostApConsumed ?? 0) > 0) {
    turnState.apCurrent = 0;
  }

  if (card.cardType === 'attack') turnState.firstAttackUsed = true;
  if (useDoubleStrike && card.cardType === 'attack') turnState.doubleStrikeReady = false;
  if (useFocus) {
    turnState.focusCharges = Math.max(0, turnState.focusCharges - 1);
    if (turnState.focusCharges === 0) turnState.focusReady = false;
  }
  if (useOverclock) {
    turnState.overclockReady = false;
  }

  // Pending choice: Phase Shift QP/CW or Unstable Flux CC — player must pick effect via UI popup.
  // The card has been played (removed from hand, AP deducted) but the effect is not yet resolved.
  // Return early; the UI calls applyPendingChoice() after the popup resolves.
  if (effect.pendingChoice) {
    turnState.cardsPlayedThisTurn += 1;
    if (playMode === 'charge') {
      enemy.playerChargedThisTurn = true;
      turnState.encounterChargesTotal += 1;
    }
    // Track charge streak for relic purposes — still counts as a correct charge attempt
    if (isChargeCorrect) {
      turnState.consecutiveCorrectThisEncounter += 1;
      turnState.chargesCorrectThisEncounter += 1; // AR-262: accuracy grade counter
      turnState.cardsCorrectThisTurn += 1;
      turnState.totalChargesThisRun += 1;
      // AR-261: Correct charge answer — decrease fog, clear from review queue
      adjustAura(-1);
      if (card.factId) {
        clearReviewQueueFact(card.factId);
      }
    }
    return {
      effect,
      enemyDefeated: false,
      fizzled: false,
      blocked: false,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
      pendingChoice: {
        cardId,
        mechanicId: effect.pendingChoice.mechanicId,
        options: effect.pendingChoice.options,
      },
    };
  }

  // Pending card pick: Transmute, Adapt, Conjure, Scavenge, Forge, Mimic — player picks from candidates.
  // The card has been played (removed from hand, AP deducted) but the effect is not yet resolved.
  // Return early; the UI shows CardPickerOverlay and applies the effect after selection.
  if (effect.pendingCardPick) {
    // Populate candidates from game state for mechanics that need live deck data
    if (effect.pendingCardPick.type === 'scavenge') {
      const available = deck.discardPile.filter(c => c.id !== effect.pendingCardPick!.sourceCardId);
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      effect.pendingCardPick.candidates = shuffled.slice(0, 3);
    }
    if (effect.pendingCardPick.type === 'forge') {
      const available = deck.hand.filter(c => c.id !== effect.pendingCardPick!.sourceCardId);
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      effect.pendingCardPick.candidates = shuffled.slice(0, 3);
    }
    if (effect.pendingCardPick.type === 'mimic') {
      const available = deck.discardPile.filter(c => c.id !== effect.pendingCardPick!.sourceCardId);
      const masteryLvl = card.masteryLevel ?? 0;
      let selected: Card[];
      if (masteryLvl >= 2) {
        // Show best 3 (highest baseEffectValue)
        selected = [...available].sort((a, b) => (b.baseEffectValue ?? 0) - (a.baseEffectValue ?? 0)).slice(0, 3);
      } else {
        // Random 3
        selected = [...available].sort(() => Math.random() - 0.5).slice(0, 3);
      }
      effect.pendingCardPick.candidates = selected;
    }
    turnState.cardsPlayedThisTurn += 1;
    if (playMode === 'charge') {
      enemy.playerChargedThisTurn = true;
      turnState.encounterChargesTotal += 1;
    }
    if (isChargeCorrect) {
      turnState.consecutiveCorrectThisEncounter += 1;
      turnState.chargesCorrectThisEncounter += 1; // AR-262: accuracy grade counter
      turnState.cardsCorrectThisTurn += 1;
      turnState.totalChargesThisRun += 1;
      // AR-261: Correct charge answer — decrease fog, clear from review queue
      adjustAura(-1);
      if (card.factId) {
        clearReviewQueueFact(card.factId);
      }
    }
    return {
      effect,
      enemyDefeated: false,
      fizzled: false,
      blocked: false,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
      masteryChange: null,
      masteryChangedCardId: null,
      pendingCardPick: effect.pendingCardPick,
    };
  }

  // mirror: copy the previous card effect (fizzle if no previous card)
  if (effect.mirrorCopy) {
    if (turnState.lastCardEffect) {
      const prev = turnState.lastCardEffect;
      effect.damageDealt = prev.damageDealt;
      effect.shieldApplied = prev.shieldApplied;
      effect.healApplied = prev.healApplied;
      effect.extraCardsDrawn = prev.extraCardsDrawn;
      effect.finalValue = prev.finalValue;
      effect.effectType = prev.effectType;
      effect.statusesApplied = prev.statusesApplied.map(s => ({ ...s }));
    } else {
      // No previous card — fizzle
      effect.targetHit = false;
      effect.finalValue = 0;
    }
  }

  // Tier 3 synergy: Mastery Ascension — +1 flat damage per T3 card (min 5 T3 cards, max +8)
  if (effect.damageDealt > 0) {
    const masteryBonus = getMasteryAscensionBonus(turnState.tier3CardCount);
    if (masteryBonus > 0) {
      effect.damageDealt += masteryBonus;
      effect.finalValue += masteryBonus;
    }
  }

  // Tier 3 synergy: Phoenix Rage — +50% damage while active
  if (effect.damageDealt > 0 && turnState.phoenixRageTurnsRemaining > 0) {
    const phoenixRageBonus = Math.floor(effect.damageDealt * 0.5);
    effect.damageDealt += phoenixRageBonus;
    effect.finalValue += phoenixRageBonus;
  }

  // Tier 3 synergy: Perfect Storm — 10+ correct streak with all 3 knowledge relics → bonus damage
  if (effect.damageDealt > 0 && turnState.consecutiveCorrectThisEncounter >= 10 &&
      hasSynergy(turnState.activeRelicIds, 'perfect_storm')) {
    // +50% bonus damage at 10+ streak
    const stormBonus = Math.floor(effect.damageDealt * 0.5);
    effect.damageDealt += stormBonus;
    effect.finalValue += stormBonus;
  }

  // crit_lens + scholars_crown: fire resolveChargeCorrectEffects on charge-correct plays.
  // scholars_crown applies a tier-based % bonus to final damage/shield/heal values.
  // crit_lens doubles final damage (25% chance) after all other multipliers.
  if (isChargeCorrect) {
    const tierStr = card.tier ?? '1';
    const cardTierNum = tierStr === '3' ? 3 : (tierStr === '2a' || tierStr === '2b') ? 2 : 1;
    const cardTypeForRelic = card.cardType === 'shield' ? 'shield' : card.cardType === 'attack' ? 'attack' : 'utility';
    // AR-269: Compute Akashic Record encounter gap for this fact.
    // gap = 0 means never seen (new fact → bonus). gap >= 3 means spaced enough → bonus.
    const factLastSeen = _factLastSeenEncounterMap.get(card.factId);
    const factEncounterGap = factLastSeen === undefined
      ? 0  // never seen → treat as gap 0 (qualifies for Akashic bonus)
      : turnState.encounterNumber - factLastSeen;
    const _runStateForCC = get(activeRunState);
    const _factPrevCorrect = card.factId
      ? _runStateForCC?.factsAnsweredCorrectly?.has(card.factId) ?? false
      : false;
    const chargeFx = resolveChargeCorrectEffects(turnState.activeRelicIds, {
      answerTimeMs: 9999, // timing not available here; speed relics handled upstream
      cardTier: cardTierNum,
      cardType: cardTypeForRelic,
      isFirstChargeThisTurn: turnState.cardsCorrectThisTurn === 0,
      chargeCountThisEncounter: turnState.consecutiveCorrectThisEncounter + 1,
      isFirstChargeCorrectThisEncounter: turnState.consecutiveCorrectThisEncounter === 0,
      correctChargesThisTurn: turnState.cardsCorrectThisTurn,
      totalChargesThisRun: (turnState.totalChargesThisRun ?? 0) + 1,
      mirrorUsedThisEncounter: turnState.mirrorUsedThisEncounter,
      adrenalineShard_usedThisTurn: false, // adrenaline_shard handled upstream
      factEncounterGap,
      wasReviewQueueFact,
      luckyCoinArmed: _luckyCoinArmed,
      scarTissueStacks: _scarTissueStacks,
      factPreviouslyCorrect: _factPrevCorrect,
    });
    // lucky_coin (v3): consume the armed flag after it fires
    if (_luckyCoinArmed && chargeFx.luckyCoinArmed) {
      _luckyCoinArmed = false;
    }

    // AR-271: Apply extraMultiplier (lucky_coin +50%, obsidian_dice, akashic_record, etc.)
    // This multiplier is returned by resolveChargeCorrectEffects and applies to the primary effect.
    if ((chargeFx.extraMultiplier ?? 1.0) > 1.0) {
      const em = chargeFx.extraMultiplier;
      if (effect.damageDealt > 0) {
        effect.damageDealt = Math.round(effect.damageDealt * em);
        effect.finalValue = Math.round(effect.finalValue * em);
        effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
      } else if (effect.shieldApplied > 0) {
        effect.shieldApplied = Math.round(effect.shieldApplied * em);
        effect.finalValue = Math.round(effect.finalValue * em);
      } else if (effect.healApplied > 0) {
        effect.healApplied = Math.round(effect.healApplied * em);
        effect.finalValue = Math.round(effect.finalValue * em);
      }
    }

    // scholars_crown: apply tier-based % bonus to the primary effect value
    if (chargeFx.scholarsCrownBonus > 0) {
      const crownMult = 1 + chargeFx.scholarsCrownBonus / 100;
      if (effect.damageDealt > 0) {
        effect.damageDealt = Math.round(effect.damageDealt * crownMult);
        effect.finalValue = Math.round(effect.finalValue * crownMult);
        effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
      } else if (effect.shieldApplied > 0) {
        effect.shieldApplied = Math.round(effect.shieldApplied * crownMult);
        effect.finalValue = Math.round(effect.finalValue * crownMult);
      } else if (effect.healApplied > 0) {
        effect.healApplied = Math.round(effect.healApplied * crownMult);
        effect.finalValue = Math.round(effect.finalValue * crownMult);
      }
    }

    // crit_lens: 25% chance to double final damage on charge correct
    if (chargeFx.isCrit && effect.damageDealt > 0) {
      effect.damageDealt = Math.round(effect.damageDealt * 2);
      effect.finalValue = Math.round(effect.finalValue * 2);
      effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
    }

    // bastions_will — +75% block for Charged shield cards
    if (chargeFx.shieldBonus > 0 && effect.shieldApplied > 0) {
      const bastionsMult = 1 + chargeFx.shieldBonus / 100;
      effect.shieldApplied = Math.round(effect.shieldApplied * bastionsMult);
      if (effect.persistentShield != null && effect.persistentShield > 0) {
        effect.persistentShield = Math.round(effect.persistentShield * bastionsMult);
      }
      effect.finalValue = effect.shieldApplied;
    }

    // mirror_of_knowledge — once per encounter: after correct Charge, replay the card effect at 1.5×
    // The replay has no AP cost and requires no quiz answer.
    if (chargeFx.mirrorAvailable) {
      const MIRROR_MULT = 1.5;
      if (effect.damageDealt > 0) {
        const mirrorDamage = Math.round(effect.damageDealt * MIRROR_MULT);
        const mirrorResult = applyDamageToEnemy(enemy, mirrorDamage);
        effect.damageDealt += mirrorDamage;
        effect.finalValue = effect.damageDealt;
        effect.enemyDefeated = mirrorResult.defeated;
        turnState.damageDealtThisTurn += mirrorDamage;
      } else if (effect.shieldApplied > 0) {
        const mirrorShield = Math.round(effect.shieldApplied * MIRROR_MULT);
        applyShield(playerState, mirrorShield);
        effect.shieldApplied += mirrorShield;
        effect.finalValue = effect.shieldApplied;
      } else if (effect.healApplied > 0) {
        const mirrorHeal = Math.round(effect.healApplied * MIRROR_MULT);
        healPlayer(playerState, mirrorHeal);
        effect.healApplied += mirrorHeal;
        effect.finalValue = effect.healApplied;
      }
      turnState.mirrorUsedThisEncounter = true;
      turnState.turnLog.push({
        type: 'play',
        message: 'Mirror of Knowledge: replayed at 1.5×',
        value: effect.finalValue,
        cardId,
      });
    }

    // glass_lens — +50% to charge-correct effect value
    if ((chargeFx.chargeCorrectBonusPercent ?? 0) > 0) {
      const bonusMult = 1 + chargeFx.chargeCorrectBonusPercent! / 100;
      if (effect.damageDealt > 0) {
        effect.damageDealt = Math.round(effect.damageDealt * bonusMult);
        effect.finalValue = Math.round(effect.finalValue * bonusMult);
        effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
      } else if (effect.shieldApplied > 0) {
        effect.shieldApplied = Math.round(effect.shieldApplied * bonusMult);
        effect.finalValue = effect.shieldApplied;
      } else if (effect.healApplied > 0) {
        effect.healApplied = Math.round(effect.healApplied * bonusMult);
        effect.finalValue = effect.healApplied;
      }
    }

    // knowledge_tax — -10% charge-correct effect value + gold bonus per Charge
    if ((chargeFx.chargeCorrectPenaltyPercent ?? 0) > 0) {
      const penaltyMult = 1 - chargeFx.chargeCorrectPenaltyPercent! / 100;
      if (effect.damageDealt > 0) {
        effect.damageDealt = Math.max(1, Math.round(effect.damageDealt * penaltyMult));
        effect.finalValue = Math.max(1, Math.round(effect.finalValue * penaltyMult));
        effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
      } else if (effect.shieldApplied > 0) {
        effect.shieldApplied = Math.max(0, Math.round(effect.shieldApplied * penaltyMult));
        effect.finalValue = effect.shieldApplied;
      } else if (effect.healApplied > 0) {
        effect.healApplied = Math.max(0, Math.round(effect.healApplied * penaltyMult));
        effect.finalValue = effect.healApplied;
      }
    }
    // knowledge_tax gold bonus is handled in encounterBridge via goldBonus field

    // akashic_record — draw 1 extra card next turn when spacing condition fires
    if ((chargeFx.akashicBonusDraw ?? 0) > 0) {
      turnState.bonusDrawNextTurn += chargeFx.akashicBonusDraw!;
    }
  }

  // AR-269: Update fact-last-seen map for Akashic Record spacing.
  // Runs on ALL charge plays (correct + wrong) so the spacing is based on charge attempts.
  if (playMode === 'charge') {
    _factLastSeenEncounterMap.set(card.factId, turnState.encounterNumber);
  }

  // double_down — once per encounter: correct Charge → 5× damage, wrong Charge → 0.3× damage
  if (isChargeCorrect && effect.damageDealt > 0) {
    const ddBonus = resolveDoubleDownBonus(turnState.activeRelicIds, turnState.doubleDownUsedThisEncounter, true);
    if (ddBonus.active) {
      effect.damageDealt = Math.round(effect.damageDealt * ddBonus.damageMultiplier);
      effect.finalValue = Math.round(effect.finalValue * ddBonus.damageMultiplier);
      effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
      turnState.doubleDownUsedThisEncounter = true;
    }
  }

  // Step 7 (AR-59.13): Quick Play immunity — The Librarian absorbs Quick Play damage entirely.
  // Animation still plays (damage not suppressed at effect layer), but HP is not reduced.
  if (effect.damageDealt > 0 && playMode === 'quick' && enemy.template.quickPlayImmune) {
    effect.damageDealt = 0;
    effect.finalValue = 0;
    effect.enemyDefeated = false;
  }

  // AR-123: quickPlayDamageMultiplier — Quick Play deals a reduced fraction of normal damage.
  // E.g. 0.3 = 30% damage. Encourages Charging without fully neutering Quick Play.
  // AR-263: _quickPlayDamageMultiplierOverride on instance takes precedence (used by The Curriculum phase 2).
  if (effect.damageDealt > 0 && playMode === 'quick') {
    const qpMultiplierOverride = enemy._quickPlayDamageMultiplierOverride;
    const qpMultiplierTemplate = enemy.template.quickPlayDamageMultiplier;
    const qpMultiplier = qpMultiplierOverride !== undefined ? qpMultiplierOverride : qpMultiplierTemplate;
    if (qpMultiplier !== undefined) {
      effect.damageDealt = qpMultiplier === 0 ? 0 : Math.max(1, Math.round(effect.damageDealt * qpMultiplier));
      effect.finalValue = effect.damageDealt;
      effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
    }
  }

  // AR-263: Hardcover armor (The Textbook) — reduces Quick Play damage by hardcover amount (min 1).
  // Charged plays bypass hardcover entirely (studying cracks it, not reckless attacks).
  if (effect.damageDealt > 0 && playMode === 'quick' && (enemy._hardcover ?? 0) > 0 && !enemy._hardcoverBroken) {
    effect.damageDealt = Math.max(1, effect.damageDealt - (enemy._hardcover ?? 0));
    effect.finalValue = effect.damageDealt;
    effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
  }

  // AR-99 Phase 3: chargeResistant — Quick Play attacks deal 50% damage (half effectiveness).
  // Encourages players to Charge against armored/resistant enemies.
  if (effect.damageDealt > 0 && playMode === 'quick' && enemy.template.chargeResistant) {
    effect.damageDealt = Math.round(effect.damageDealt * 0.5);
    effect.finalValue = Math.round(effect.finalValue * 0.5);
    effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
  }

  // AR-99 Phase 3: chainVulnerable — Chain attacks (2+ chain multiplier) deal +50% damage.
  // Encourages players to build Knowledge Chains against soft/vulnerable enemies.
  if (effect.damageDealt > 0 && currentChainMultiplier > 1.0 && enemy.template.chainVulnerable) {
    const chainBonus = Math.round(effect.damageDealt * 0.5);
    effect.damageDealt += chainBonus;
    effect.finalValue += chainBonus;
    effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
  }

  // AR-203 Step 11-12: Burn and Bleed bonuses — card-play attacks only (not Thorns/reflect).
  // For multi-hit cards (hitCount > 1), resolve Burn per-hit in a loop.
  // For single-hit cards, apply once before block.
  if (effect.damageDealt > 0) {
    const hitCount = effect.hitCount ?? 1;
    if (hitCount > 1) {
      // Multi-hit: Burn halves after each hit; Bleed applies per hit.
      const perHitBase = effect.damageDealt; // resolver set this to per-hit value
      // Bleed stacks are constant for all hits (decay happens at end of enemy turn, not mid-card).
      const bleedBonusPerHit = getBleedBonus(enemy.statusEffects, BLEED_BONUS_PER_STACK);
      let totalDamage = 0;
      let totalBleedBonus = 0;
      // Phase 3: twin_burn_chain tag — Burn ticks don't halve when this flag is active
      const skipBurnHalving = effect.twinBurnChainActive === true;
      for (let i = 0; i < hitCount; i++) {
        let hitDamage = perHitBase;
        const burnResult = triggerBurn(enemy.statusEffects, skipBurnHalving);
        if (burnResult.bonusDamage > 0) {
          hitDamage += burnResult.bonusDamage;
          turnState.turnLog.push({
            type: 'status_tick',
            message: `Burn (hit ${i + 1}): +${burnResult.bonusDamage} damage (${burnResult.stacksAfter} stacks remaining)${skipBurnHalving ? ' [chain]' : ''}`,
            value: burnResult.bonusDamage,
          });
        }
        if (bleedBonusPerHit > 0) {
          hitDamage += bleedBonusPerHit;
          totalBleedBonus += bleedBonusPerHit;
        }
        totalDamage += hitDamage;
      }
      if (totalBleedBonus > 0) {
        turnState.turnLog.push({
          type: 'status_tick',
          message: `Bleed: +${totalBleedBonus} damage (${hitCount} hits × ${bleedBonusPerHit})`,
          value: totalBleedBonus,
        });
      }
      effect.damageDealt = totalDamage;
      effect.finalValue = totalDamage;
      effect.enemyDefeated = totalDamage >= enemy.currentHP;
    } else {
      // Single-hit: Burn triggers once, Bleed adds flat bonus.
      const burnResult = triggerBurn(enemy.statusEffects);
      if (burnResult.bonusDamage > 0) {
        effect.damageDealt += burnResult.bonusDamage;
        effect.finalValue += burnResult.bonusDamage;
        effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
        turnState.turnLog.push({
          type: 'status_tick',
          message: `Burn triggered: +${burnResult.bonusDamage} damage (${burnResult.stacksAfter} stacks remaining)`,
          value: burnResult.bonusDamage,
        });
      }
      const bleedBonus = getBleedBonus(enemy.statusEffects, BLEED_BONUS_PER_STACK);
      if (bleedBonus > 0) {
        effect.damageDealt += bleedBonus;
        effect.finalValue += bleedBonus;
        effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
        turnState.turnLog.push({
          type: 'status_tick',
          message: `Bleed: +${bleedBonus} damage`,
          value: bleedBonus,
        });
      }
    }
    const damageResult = applyDamageToEnemy(enemy, effect.damageDealt);
    effect.enemyDefeated = damageResult.defeated;
    turnState.damageDealtThisTurn += effect.damageDealt;
  }

  // Step 5e (AR-59.13): Mark Charge was used this turn on correct answer
  if (playMode === 'charge') {
    enemy.playerChargedThisTurn = true;
    // AR-206: Track total Charges played this encounter for Overcharge scaling
    turnState.encounterChargesTotal += 1;
  }

  // Step 5b (AR-59.13): onPlayerChargeCorrect callback — Charge play, correct answer only
  if (playMode === 'charge' && enemy.template.onPlayerChargeCorrect) {
    const ctx: EnemyReactContext = {
      enemy,
      cardBaseDamage: card.baseEffectValue ?? 0,
      playMode: 'charge',
      chargeCorrect: true,
      playerBlock: turnState.playerState.shield,
      drainPlayerBlock: (amount: number) => {
        const clamped = Math.min(amount, turnState.playerState.shield);
        turnState.playerState.shield = Math.max(0, turnState.playerState.shield - clamped);
      },
    };
    enemy.template.onPlayerChargeCorrect(ctx);
  }

  if (effect.selfDamage && effect.selfDamage > 0) {
    // Reckless self-damage ignores shield.
    playerState.hp = Math.max(0, playerState.hp - effect.selfDamage);
    // Phase 2: Track cumulative self-damage for reckless_selfdmg_scale3 tag
    turnState.selfDamageTakenThisEncounter += effect.selfDamage;
    // on_hp_loss: pain_conduit reflect + bloodletter arm (self-damage source)
    if (turnState.activeRelicIds.size > 0) {
      const selfHpLossFx = resolveHpLossEffects(turnState.activeRelicIds, {
        hpLost: effect.selfDamage,
        source: 'self',
      });
      if (selfHpLossFx.reflectDamage > 0) {
        const selfReflectResult = applyDamageToEnemy(enemy, selfHpLossFx.reflectDamage);
        effect.enemyDefeated = selfReflectResult.defeated;
        turnState.damageDealtThisTurn += selfHpLossFx.reflectDamage;
      }
      if (selfHpLossFx.nextAttackBonus > 0) {
        turnState.bloodletterArmed = true;
      }
    }
  }

  if (effect.shieldApplied > 0) {
    // hollow_armor: block gain is disabled after turn 0 (only starting block is allowed)
    const shieldMods = turnState.activeRelicIds.size > 0
      ? resolveShieldModifiers(turnState.activeRelicIds, {
          shieldCardPlayCountThisEncounter: 0,
          encounterTurnNumber: turnState.encounterTurnNumber,
          wasCharged: playMode === 'charge',
        })
      : null;
    // hollow_armor: halve block from shield cards (blockGainHalved)
    if (shieldMods?.blockGainHalved) {
      effect.shieldApplied = Math.floor(effect.shieldApplied * 0.5);
    }
    // Phase 2: weaken_shield30 passive — bonus block when enemy is Weakened
    if ((turnState.weakShieldBonusPercent ?? 0) > 0) {
      const enemyIsWeakened = enemy.statusEffects.some(e => e.type === 'weakness' && e.value > 0);
      if (enemyIsWeakened) {
        effect.shieldApplied = Math.round(effect.shieldApplied * (1 + turnState.weakShieldBonusPercent / 100));
      }
    }
    playCardAudio('shield-gain');
    applyShield(playerState, effect.shieldApplied);
  }
  if (effect.shieldApplied > 0 && turnState.ascensionShieldCardMultiplier !== 1) {
    const adjustedShield = Math.max(0, Math.round(effect.shieldApplied * turnState.ascensionShieldCardMultiplier));
    const delta = adjustedShield - effect.shieldApplied;
    if (delta !== 0) {
      applyShield(playerState, delta);
      effect.shieldApplied = adjustedShield;
      effect.finalValue = adjustedShield;
    }
  }

  if (effect.healApplied > 0) {
    playCardAudio('player-heal');
    healPlayer(playerState, effect.healApplied);
  }

  if ((effect.overhealToShield ?? 0) > 0) {
    if (card.mechanicId === 'overheal') {
      applyShield(playerState, effect.overhealToShield ?? 0);
    }
  }

  for (const status of effect.statusesApplied) {
    playStatusAudio(status.type);
    applyStatusEffect(enemy.statusEffects, status);
  }

  // AR-203: Apply Burn stacks to enemy from card effects (e.g. ignite mechanic).
  // turnsRemaining: 99 = sentinel (Burn expires by halving to 0, not by turn countdown).
  if ((effect.applyBurnStacks ?? 0) > 0) {
    playCardAudio('status-burn-apply');
    applyStatusEffect(enemy.statusEffects, {
      type: 'burn',
      value: effect.applyBurnStacks!,
      turnsRemaining: 99,
    });
  }
  // AR-203: Apply Bleed stacks to enemy from card effects (e.g. lacerate mechanic).
  // turnsRemaining: 99 = sentinel (Bleed expires by decay at end of enemy turn, not countdown).
  if ((effect.applyBleedStacks ?? 0) > 0) {
    playCardAudio('status-bleed-apply');
    applyStatusEffect(enemy.statusEffects, {
      type: 'bleed',
      value: effect.applyBleedStacks!,
      turnsRemaining: 99,
    });
  }

  if (effect.applyImmunity) {
    applyStatusEffect(playerState.statusEffects, {
      type: 'immunity',
      value: 8,
      turnsRemaining: 99,
    });
  }

  if (effect.extraCardsDrawn > 0) {
    drawHand(deck, effect.extraCardsDrawn);
  }

  if ((effect.parryDrawBonus ?? 0) > 0) {
    turnState.bonusDrawNextTurn += effect.parryDrawBonus ?? 0;
  }

  if (effect.applyDoubleStrikeBuff) turnState.doubleStrikeReady = true;
  if (effect.applyFocusBuff) {
    playCardAudio('status-focus-apply');
    turnState.focusReady = true;
    turnState.focusCharges = effect.focusCharges ?? 1;
  }
  if (effect.applyOverclock) turnState.overclockReady = true;
  if (effect.applySlow) turnState.slowEnemyIntent = true;
  if (effect.applyForesight) turnState.foresightTurnsRemaining = 2;
  // applyTransmute removed — Transmute now uses CardPickerOverlay (pendingCardPick flow)

  // Transmute QP / Charge Wrong: auto-swap source card in-place with the selected candidate
  if (effect.applyTransmuteAuto) {
    applyTransmuteSwap(turnState, effect.applyTransmuteAuto.sourceCardId, [effect.applyTransmuteAuto.selected]);
  }

  // cleanse: remove all debuff-type status effects from player
  if (effect.applyCleanse) {
    const debuffTypes = new Set(['poison', 'weakness', 'vulnerable', 'burn', 'bleed', 'freeze']);
    playerState.statusEffects = playerState.statusEffects.filter(s => !debuffTypes.has(s.type));
  }

  // adapt: remove one random debuff from player
  if (effect.adaptCleanse) {
    const debuffTypes = new Set(['poison', 'weakness', 'vulnerable', 'burn', 'bleed', 'freeze']);
    const debuffIndices = playerState.statusEffects
      .map((s, i) => (debuffTypes.has(s.type) ? i : -1))
      .filter(i => i !== -1);
    if (debuffIndices.length > 0) {
      const removeIdx = debuffIndices[Math.floor(Math.random() * debuffIndices.length)];
      playerState.statusEffects.splice(removeIdx, 1);
    }
  }

  // thorns: register retaliation for the upcoming enemy attack
  if ((effect.thornsValue ?? 0) > 0) {
    turnState.thornsActive = true;
    turnState.thornsValue = effect.thornsValue ?? 0;
  }

  // AR-206: Stagger — skip enemy's next action (turn counter still advances)
  if (effect.applyStagger) {
    turnState.staggeredEnemyNextTurn = true;
  }

  // AR-206: Ignite buff — store pending Burn to apply on next attack(s)
  // igniteDuration > 1 (ignite_2attacks tag): buff applies to next N attacks.
  if ((effect.applyIgniteBuff ?? 0) > 0) {
    turnState.ignitePendingBurn = effect.applyIgniteBuff!;
    turnState.igniteRemainingAttacks = effect.igniteDuration ?? 1;
  }

  // AR-206: Corrode — remove enemy block
  if (effect.removeEnemyBlock !== undefined) {
    if (effect.removeEnemyBlock < 0) {
      // Remove ALL enemy block
      enemy.block = 0;
    } else {
      enemy.block = Math.max(0, enemy.block - effect.removeEnemyBlock);
    }
    turnState.turnLog.push({
      type: 'play',
      message: `Corrode: removed enemy block`,
      value: effect.removeEnemyBlock,
    });
  }

  // AR-206: Swap — discard 1 card (auto-select lowest value), draw replacements
  if (effect.swapDiscardDraw) {
    const { discardCount, drawCount } = effect.swapDiscardDraw;
    // Auto-select lowest-value card(s) from hand to discard (excluding the card just played)
    const handCopy = [...deck.hand];
    for (let i = 0; i < discardCount && handCopy.length > 0; i++) {
      let lowestIdx = 0;
      let lowestVal = Infinity;
      for (let j = 0; j < handCopy.length; j++) {
        if ((handCopy[j].baseEffectValue ?? 0) < lowestVal) {
          lowestVal = handCopy[j].baseEffectValue ?? 0;
          lowestIdx = j;
        }
      }
      const discarded = handCopy.splice(lowestIdx, 1)[0];
      deck.discardPile.push(discarded);
      deck.hand = deck.hand.filter(c => c.id !== discarded.id);
    }
    drawHand(deck, drawCount);
  }

  // AR-206: Scavenge — retrieve card(s) from discard to top of draw pile
  if ((effect.scavengeCount ?? 0) > 0) {
    const count = effect.scavengeCount!;
    // Auto-select the highest-value card(s) from discard pile
    const discardSorted = [...deck.discardPile].sort((a, b) => (b.baseEffectValue ?? 0) - (a.baseEffectValue ?? 0));
    const toRetrieve = discardSorted.slice(0, count);
    for (const retrieved of toRetrieve) {
      deck.discardPile = deck.discardPile.filter(c => c.id !== retrieved.id);
      deck.drawPile.unshift(retrieved); // put on top
    }
  }

  // AR-206: Sift — scry (look at top N, auto-discard lowest-value ones)
  // Full CardBrowser UI integration is deferred; for now auto-select lowest-value cards.
  if (effect.siftParams) {
    const { lookAt, discardCount } = effect.siftParams;
    const topCards = deck.drawPile.slice(0, lookAt);
    const sorted = [...topCards].sort((a, b) => (a.baseEffectValue ?? 0) - (b.baseEffectValue ?? 0));
    const toDiscard = sorted.slice(0, discardCount);
    for (const c of toDiscard) {
      deck.drawPile = deck.drawPile.filter(d => d.id !== c.id);
      deck.discardPile.push(c);
    }
  }

  // AR-206: Siphon Strike — overkill heal (min 2 or 3 at L3+, max 10)
  if ((effect.overkillHeal ?? 0) > 0) {
    const minHeal = effect.overkillHeal!;
    const overkill = effect.enemyDefeated
      ? Math.max(0, effect.damageDealt - enemy.currentHP)
      : 0;
    const healAmount = Math.min(10, Math.max(minHeal, overkill));
    healPlayer(playerState, healAmount);
    turnState.turnLog.push({
      type: 'heal',
      message: `Siphon Strike heal: ${healAmount} HP`,
      value: healAmount,
    });
  }

  // AR-206: Overcharge — on Charge Correct, add bonus damage per encounter charges
  if (card.mechanicId === 'overcharge' && isChargeCorrect) {
    const bonusDamage = turnState.encounterChargesTotal * 2;
    if (bonusDamage > 0) {
      effect.damageDealt = Math.max(0, Math.round(
        (effect.damageDealt ?? 0) + bonusDamage
      ));
      effect.enemyDefeated = effect.damageDealt >= enemy.currentHP;
      if (effect.damageDealt > 0) {
        applyDamageToEnemy(enemy, bonusDamage);
        if (enemy.currentHP <= 0) {
          turnState.result = 'victory';
          turnState.phase = 'encounter_end';
        }
      }
    }
  }

  // ── AR-207 effect application ───────────────────────────────────────────────

  // Chain Lightning CC — override damage with 8 × (new chain length after extend)
  if (card.mechanicId === 'chain_lightning' && isChargeCorrect) {
    // Chain was already extended above via extendOrResetChain. chainLength is the new length.
    const clChainLen = Math.max(1, turnState.chainLength);
    const clBaseDmgPerLen = (effect.mechanicName !== undefined ? 1 : 1); // always 1 factor
    // base value from mechanic quick play + mastery bonus — recompute raw per-chain base
    const mechCL = getMechanicDefinition('chain_lightning');
    const _clStats = getMasteryStats('chain_lightning', card.masteryLevel ?? 0);
    const clBasePerLen = _clStats
      ? _clStats.qpValue
      : (mechCL?.quickPlayValue ?? 8) + getMasteryBaseBonus('chain_lightning', card.masteryLevel ?? 0);
    const clTotalDmg = Math.round(clBasePerLen * clChainLen * currentChainMultiplier * speedBonus * (1 + turnState.buffNextCard / 100));
    // Null Shard: if chain is disabled (chainLength floors at 1 and multiplier = 1.0)
    // The above calculation already handles it since clChainLen >= 1 and multiplier = 1.0
    if (clTotalDmg !== effect.damageDealt) {
      const prevDmg = effect.damageDealt;
      const delta = clTotalDmg - prevDmg;
      effect.damageDealt = clTotalDmg;
      effect.finalValue = clTotalDmg;
      effect.enemyDefeated = clTotalDmg >= enemy.currentHP;
      // Apply the delta to the enemy (applyDamageToEnemy was already called in the damage block below)
      // We set the override here — the damage block below will use effect.damageDealt.
      // But the damage block already ran! We need to re-apply.
      // Solution: apply the delta (additional damage or subtract over-counted)
      if (delta > 0) {
        const clResult = applyDamageToEnemy(enemy, delta);
        effect.enemyDefeated = clResult.defeated;
      } else if (delta < 0) {
        // Over-counted: restore HP
        enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + Math.abs(delta));
        effect.enemyDefeated = enemy.currentHP <= 0;
      }
      turnState.damageDealtThisTurn += delta;
    }
    effect.chainLightningChainLength = clChainLen;
  }

  // Volatile Slash / Burnout Shield — exhaust after resolve
  if (effect.exhaustOnResolve) {
    // Move card from discard pile to exhaust pile
    const discIdx = turnState.deck.discardPile.findIndex(c => c.id === cardId);
    if (discIdx !== -1) {
      const [exhaustedCard] = turnState.deck.discardPile.splice(discIdx, 1);
      turnState.deck.exhaustPile.push(exhaustedCard);
      turnState.turnLog.push({
        type: 'play',
        message: `${card.mechanicName ?? card.mechanicId}: exhausted after Charge`,
        cardId,
      });
      // on_exhaust: exhaustion_engine draws 2 extra cards; scavengers_eye draws 1; tattered_notebook grants temp Strength
      if (turnState.activeRelicIds.size > 0) {
        const exhaustFx = resolveExhaustEffects(turnState.activeRelicIds);
        if (exhaustFx.bonusCardDraw > 0) {
          drawHand(deck, exhaustFx.bonusCardDraw);
        }
        if (exhaustFx.tempStrengthGain > 0) {
          // tattered_notebook v3: +1 Strength this turn (1 turn duration)
          playCardAudio('relic-trigger');
          const existingStr = playerState.statusEffects.find(s => s.type === 'strength');
          if (existingStr) {
            existingStr.value += exhaustFx.tempStrengthGain;
          } else {
            playerState.statusEffects.push({
              type: 'strength',
              value: exhaustFx.tempStrengthGain,
              turnsRemaining: 1,
            });
          }
          turnState.triggeredRelicId = 'tattered_notebook';
        }
      }
    }
  }

  // Warcry — apply Strength to player
  if (effect.applyStrengthToPlayer) {
    playCardAudio('status-strength-apply');
    const { value, permanent } = effect.applyStrengthToPlayer;
    // Apply to playerState statusEffects
    const existingStr = playerState.statusEffects.find(s => s.type === 'strength');
    if (existingStr) {
      existingStr.value += value;
      if (permanent) {
        existingStr.turnsRemaining = 9999; // permanent = rest of combat
      }
    } else {
      playerState.statusEffects.push({
        type: 'strength',
        value,
        turnsRemaining: permanent ? 9999 : 1,
      });
    }
    // L3 QP bonus: also +1 permanent Str (via warcry_perm_str tag)
    if (!isChargeCorrect && playMode !== 'charge_wrong' && (card.masteryLevel ?? 0) >= 3) {
      const strEffect = playerState.statusEffects.find(s => s.type === 'strength');
      if (strEffect) {
        strEffect.value += 1;
        strEffect.turnsRemaining = 9999;
      } else {
        playerState.statusEffects.push({ type: 'strength', value: 1, turnsRemaining: 9999 });
      }
    }
  }

  // Warcry CC — set free Charge flag
  if (effect.warcryFreeCharge) {
    turnState.warcryFreeChargeActive = true;
  }

  // Battle Trance — set restriction flag (draw already handled via extraCardsDrawn)
  if (effect.applyBattleTranceRestriction) {
    turnState.battleTranceRestriction = true;
  }

  // Curse of Doubt — apply charge_damage_amp_percent status to enemy
  if (effect.applyChargeDamageAmpPercent) {
    const { value, turns } = effect.applyChargeDamageAmpPercent;
    const existing = enemy.statusEffects.find(s => s.type === 'charge_damage_amp_percent');
    if (existing) {
      existing.value = Math.max(existing.value, value);
      existing.turnsRemaining = Math.max(existing.turnsRemaining, turns);
    } else {
      enemy.statusEffects.push({ type: 'charge_damage_amp_percent', value, turnsRemaining: turns });
    }
  }

  // Mark of Ignorance — apply charge_damage_amp_flat status to enemy
  if (effect.applyChargeDamageAmpFlat) {
    const { value, turns } = effect.applyChargeDamageAmpFlat;
    const existing = enemy.statusEffects.find(s => s.type === 'charge_damage_amp_flat');
    if (existing) {
      existing.value = Math.max(existing.value, value);
      existing.turnsRemaining = Math.max(existing.turnsRemaining, turns);
    } else {
      enemy.statusEffects.push({ type: 'charge_damage_amp_flat', value, turnsRemaining: turns });
    }
  }

  // Phase Shift CC — shield already applied by resolver; damage applied in main block.
  // No additional turn-manager handling needed for phase_shift.

  // Chameleon — resolve copy of last played mechanic
  if (effect.chameleonMultiplier !== undefined) {
    const lastMechId = turnState.lastPlayedMechanicId;
    if (lastMechId) {
      const lastMechDef = getMechanicDefinition(lastMechId);
      if (lastMechDef) {
        const chameleonMult = effect.chameleonMultiplier;
        const baseQPValue = lastMechDef.quickPlayValue;
        const copiedDamage = Math.round(baseQPValue * chameleonMult * currentChainMultiplier * speedBonus);
        const copiedShield = Math.round(baseQPValue * chameleonMult);
        // Apply based on last card's type
        if (lastMechDef.type === 'attack') {
          const chamResult = applyDamageToEnemy(enemy, copiedDamage);
          effect.damageDealt = copiedDamage;
          effect.finalValue = copiedDamage;
          effect.enemyDefeated = chamResult.defeated;
          turnState.damageDealtThisTurn += copiedDamage;
        } else if (lastMechDef.type === 'shield') {
          applyShield(playerState, copiedShield);
          effect.shieldApplied = copiedShield;
          effect.finalValue = copiedShield;
        }
        // Chain inheritance: set chain type to match last played card's chain type
        if (effect.chameleonInheritChain && turnState.lastPlayedChainType !== null) {
          // Set encounter chain type to match; next same-type card will continue the chain.
          turnState.chainType = turnState.lastPlayedChainType;
        }
      }
      // If no last mechanic found (first card), resolve as 0 — no crash.
    }
  }

  // Chain Anchor CC — set chainAnchorActive flag
  if (effect.applyChainAnchor) {
    const anchorLen = (card.masteryLevel ?? 0) >= 3 ? 3 : 2;
    turnState.chainAnchorActive = true;
    turnState.chainAnchorStartLength = anchorLen;
  }

  // Track last played mechanic ID for Chameleon
  if (card.mechanicId) {
    turnState.lastPlayedMechanicId = card.mechanicId;
    turnState.lastPlayedChainType = card.chainType ?? null;
  }

  // AR-207: Apply Charge damage amplifiers to this card's damage if it was a Charge play.
  // Applies AFTER all multipliers (post-chain, post-speed, post-relic) but BEFORE block.
  // Since damageDealt has already been applied to enemy above, we apply the delta here.
  if (isChargeCorrect || playMode === 'charge_wrong') {
    const ampPercent = enemy.statusEffects.find(s => s.type === 'charge_damage_amp_percent');
    const ampFlat = enemy.statusEffects.find(s => s.type === 'charge_damage_amp_flat');
    let ampDelta = 0;
    if ((ampPercent?.turnsRemaining ?? 0) > 0 && effect.damageDealt > 0) {
      ampDelta += Math.round(effect.damageDealt * (ampPercent!.value / 100));
    }
    if ((ampFlat?.turnsRemaining ?? 0) > 0 && effect.damageDealt > 0) {
      ampDelta += ampFlat!.value;
    }
    if (ampDelta > 0) {
      const ampResult = applyDamageToEnemy(enemy, ampDelta);
      effect.damageDealt += ampDelta;
      effect.finalValue += ampDelta;
      effect.enemyDefeated = ampResult.defeated;
      turnState.damageDealtThisTurn += ampDelta;
    }
  }

  // AR-206: Ignite — apply pending Burn to the target on attack card plays
  // igniteRemainingAttacks > 1 means the buff applies to multiple attacks (ignite_2attacks tag).
  if ((turnState.ignitePendingBurn ?? 0) > 0 && effect.effectType === 'attack' && card.mechanicId !== 'ignite') {
    applyStatusEffect(enemy.statusEffects, {
      type: 'burn',
      value: turnState.ignitePendingBurn,
      turnsRemaining: 99,
    });
    if (turnState.igniteRemainingAttacks > 1) {
      // Multi-attack ignite: decrement counter, keep the buff active
      turnState.igniteRemainingAttacks -= 1;
    } else {
      // Single-attack ignite (default): consume the buff
      turnState.ignitePendingBurn = 0;
      turnState.igniteRemainingAttacks = 0;
    }
  }

  // AR-206: Aegis Pulse CC — grant chain block bonus to same-chain cards in hand
  // This sets a per-turn buff on matching cards; simplified as a turn-scoped flag for now.
  // TODO: wire to card display when chain type matching UI is available.

  if ((effect.grantsAp ?? 0) > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + (effect.grantsAp ?? 0));
  }

  // ── AR-tag-wiring: New CardEffectResult fields (added 2026-04-03) ──────────────────────────

  // apRefund: refund AP after card resolution (eruption_refund1 tag)
  if ((effect.apRefund ?? 0) > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + effect.apRefund!);
  }

  // apGain: grant additional AP this turn (trance_cc_ap1 tag on battle_trance CC)
  if ((effect.apGain ?? 0) > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + effect.apGain!);
  }

  // healPctApplied: heal player by N% of maxHP (overheal_heal_pct5 tag)
  if ((effect.healPctApplied ?? 0) > 0) {
    const pctHeal = Math.round(playerState.maxHP * effect.healPctApplied! / 100);
    if (pctHeal > 0) {
      playCardAudio('player-heal');
      healPlayer(playerState, pctHeal);
      turnState.turnLog.push({
        type: 'heal',
        message: `Overheal: healed ${pctHeal} HP (${effect.healPctApplied}% of maxHP)`,
        value: pctHeal,
      });
    }
  }

  // removeDebuffCount: remove N debuffs from player, shortest-duration first (shrug_cleanse1 tag)
  if ((effect.removeDebuffCount ?? 0) > 0) {
    const debuffTypes = new Set(['poison', 'weakness', 'vulnerable', 'burn', 'bleed', 'freeze']);
    const debuffs = playerState.statusEffects
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => debuffTypes.has(s.type))
      .sort((a, b) => a.s.turnsRemaining - b.s.turnsRemaining); // shortest first
    const toRemove = debuffs.slice(0, effect.removeDebuffCount!);
    const removeSet = new Set(toRemove.map(x => x.i));
    playerState.statusEffects = playerState.statusEffects.filter((_, i) => !removeSet.has(i));
    if (toRemove.length > 0) {
      turnState.turnLog.push({
        type: 'play',
        message: `Shrug It Off: removed ${toRemove.length} debuff(s)`,
        value: toRemove.length,
      });
    }
  }

  // bleedPermanent: mark the bleed just applied as permanent (rupture_bleed_perm tag)
  // The bleed was already applied via applyBleedStacks above. Find it and set turnsRemaining to 99999.
  if (effect.bleedPermanent) {
    const bleedStatus = enemy.statusEffects.find(s => s.type === 'bleed');
    if (bleedStatus) {
      bleedStatus.turnsRemaining = 99999; // sentinel: permanent bleed, never decays
    }
  }

  // thornsPersist: carry thorns value across this encounter's end (thorns_persist / reactive_thorns_persist tags)
  if (effect.thornsPersist) {
    turnState.thornsPersistent = true;
  }

  // counterDamage: deal N damage to enemy per hit when enemy attacks (parry_counter3 tag)
  if ((effect.counterDamage ?? 0) > 0) {
    turnState.counterDamagePerHit = effect.counterDamage!;
  }

  // tauntDuration: force enemy to use attack intent for N turns (guard_taunt1t tag)
  if ((effect.tauntDuration ?? 0) > 0) {
    turnState.forcedAttackTurnsRemaining = effect.tauntDuration!;
  }

  // archiveBlockBonus: bonus block applied to each retained card from Archive (archive_block2_per tag)
  if ((effect.archiveBlockBonus ?? 0) > 0) {
    turnState.archiveBlockBonus = effect.archiveBlockBonus!;
  }

  // empowerTargetCount: buff next N cards instead of 1 (empower_2cards tag)
  // When set, buffNextCard will be held for multiple card plays; empowerRemainingCount tracks how many.
  if ((effect.empowerTargetCount ?? 0) > 1) {
    turnState.empowerRemainingCount = effect.empowerTargetCount!;
  }

  // freePlayCount: grant N 0-AP free plays this turn (focus_next2free tag)
  if ((effect.freePlayCount ?? 0) > 0) {
    turnState.freePlayCharges = (turnState.freePlayCharges ?? 0) + effect.freePlayCount!;
  }

  // frenzyChargesGranted: grant N free-play charges (frenzy mechanic)
  if ((effect.frenzyChargesGranted ?? 0) > 0) {
    turnState.freePlayCharges = (turnState.freePlayCharges ?? 0) + effect.frenzyChargesGranted!;
  }

  // slowAnyAction: when set, Slow can skip ANY enemy action (slow_any_action tag)
  // This is stored on turnState so endPlayerTurn can check it when the enemy acts.
  if (effect.slowAnyAction) {
    // Flag is stored implicitly: slowEnemyIntent is already set via applySlow above.
    // We set a companion flag on the TurnState so endPlayerTurn widens the condition.
    // For now, we repurpose staggeredEnemyNextTurn so any action is skipped — but that's too broad.
    // Correct approach: store the flag and check in endPlayerTurn.
    // The flag is carried by slowEnemyIntent=true + the intent check in endPlayerTurn is
    // updated separately (see endPlayerTurn slow block).
    // Mark that the slow is the "any action" variant by setting a flag via a convention:
    // we encode this as a negative value sentinel on slowEnemyIntent type — but since it's boolean,
    // we use a separate module-level flag for this turn only.
    _slowAnyActionThisTurn = true;
  }

  // timerExtensionPct: extend quiz timer by N% for the next Charge (precision_timer_ext50 tag)
  if ((effect.timerExtensionPct ?? 0) > 0) {
    turnState.timerExtensionPct = effect.timerExtensionPct!;
  }

  // eliminateDistractor: remove N wrong answers from the next quiz (siphon_eliminate1 tag)
  if ((effect.eliminateDistractor ?? 0) > 0) {
    turnState.eliminateDistractors = (turnState.eliminateDistractors ?? 0) + effect.eliminateDistractor!;
  }

  // scryCount: look at top N cards of draw pile, let player discard some (scout_scry2 tag)
  // Set pendingScryCount so UI can show a scry picker. Auto-discard lowest-value card if no UI.
  if ((effect.scryCount ?? 0) > 0) {
    turnState.pendingScryCount = effect.scryCount!;
    // Fallback auto-resolve: discard the lowest-value card among the top scryCount cards.
    // This preserves game state even if the UI scry picker isn't shown.
    const topCards = deck.drawPile.slice(0, effect.scryCount!);
    if (topCards.length > 0) {
      const sortedByValue = [...topCards].sort((a, b) => (a.baseEffectValue ?? 0) - (b.baseEffectValue ?? 0));
      const worstCard = sortedByValue[0];
      const idx = deck.drawPile.indexOf(worstCard);
      if (idx !== -1) {
        deck.drawPile.splice(idx, 1);
        deck.discardPile.push(worstCard);
      }
      turnState.turnLog.push({
        type: 'play',
        message: `Scry ${effect.scryCount}: auto-discarded ${worstCard.mechanicName ?? worstCard.mechanicId ?? 'card'}`,
        value: effect.scryCount,
      });
    }
  }

  // recycleChoose: player picks which card from discard (recycle_discard_pick tag)
  // Flag is set on the result — CardCombatOverlay reads result.recycleChoose to show picker UI.
  // No TurnState mutation needed; the UI layer reads the PlayCardResult directly.

  // mimicChoose: player picks from discard instead of random (mimic_choose tag)
  // Same pattern — propagated through PlayCardResult for UI consumption.

  // aftershockNoQuiz: CC repeat doesn't require a quiz answer (aftershock_no_quiz tag)
  // Read from PlayCardResult in the aftershock resolution UI layer.

  // kbombCountPast: use run-wide charge count for knowledge_bomb CC (kbomb_count_past tag)
  // The resolver already reads correctChargesThisEncounter; for kbombCountPast the resolver
  // needs totalChargesThisRun. This flag on the result is informational — the actual behavior
  // is driven by the resolver reading kbombCountPast and using the appropriate count.

  // darkHealPerCurse: dark_knowledge heals 1 HP per cursed fact (dark_heal1_per_curse tag)
  if ((effect.darkHealPerCurse ?? 0) > 0 && cursedFactCount > 0) {
    const darkHeal = effect.darkHealPerCurse! * cursedFactCount;
    if (darkHeal > 0) {
      playCardAudio('player-heal');
      healPlayer(playerState, darkHeal);
      turnState.turnLog.push({
        type: 'heal',
        message: `Dark Knowledge: healed ${darkHeal} HP (${cursedFactCount} cursed facts × ${effect.darkHealPerCurse})`,
        value: darkHeal,
      });
    }
  }

  // recollectUpgrade: returned exhausted cards get +N mastery (recollect_upgrade1 tag)
  if ((effect.recollectUpgrade ?? 0) > 0 && (effect.exhaustedCardsToReturn ?? 0) > 0) {
    // exhaustedCardsToReturn was already processed by the recollect handler above.
    // Apply +1 mastery to the most recently returned cards (those just moved to discard from exhaust).
    // The recollect resolution that moves cards happens in the effect application for exhaustedCardsToReturn.
    // We mark the returned cards by bumping mastery on the LAST N cards added to discard (heuristic).
    const returnCount = effect.exhaustedCardsToReturn!;
    const upgradeDelta = effect.recollectUpgrade!;
    const recentlyReturned = turnState.deck.discardPile.slice(-returnCount);
    for (const rc of recentlyReturned) {
      const maxLv = 5;
      rc.masteryLevel = Math.min(maxLv, (rc.masteryLevel ?? 0) + upgradeDelta);
    }
  }

  // recollectPlayFree: one returned card can be played free this turn (recollect_play_free tag)
  if (effect.recollectPlayFree) {
    // Grant 1 free-play charge so the player can play a returned card at 0 AP
    turnState.freePlayCharges = (turnState.freePlayCharges ?? 0) + 1;
  }

  // synapseChainBonus: wildcard chain link gets +1 bonus chain length (synapse_chain_plus1 tag)
  // The applyWildcardChainLink flag is set by the synapse mechanic; chain bonus is applied here.
  if ((effect.synapseChainBonus ?? 0) > 0 && effect.applyWildcardChainLink) {
    // Extend the chain by 1 extra beyond the wildcard link already applied
    const synapseExtend = effect.synapseChainBonus!;
    for (let i = 0; i < synapseExtend; i++) {
      extendOrResetChain(card.chainType ?? null);
    }
    const synapseChain = getChainState();
    turnState.chainLength = synapseChain.length;
    turnState.chainMultiplier = getChainMultiplier(synapseChain.length);
    turnState.turnLog.push({
      type: 'play',
      message: `Synapse: chain extended by +${synapseExtend} (chain now ${synapseChain.length})`,
      value: synapseChain.length,
    });
  }

  // fluxDouble: unstable_flux fires its effect twice (flux_double tag)
  // The resolver sets fluxDouble=true; the actual double-fire is handled here by re-applying the effect.
  if (effect.fluxDouble && effect.unstableFluxEffect) {
    // Re-apply the same flux effect a second time
    const fluxEffect = effect.unstableFluxEffect;
    if (fluxEffect === 'damage' && effect.damageDealt > 0) {
      const fluxDmg = Math.round(effect.damageDealt * 0.5); // second hit at 50% to avoid doubling
      if (fluxDmg > 0) {
        const fluxResult = applyDamageToEnemy(enemy, fluxDmg);
        effect.damageDealt += fluxDmg;
        effect.enemyDefeated = fluxResult.defeated;
        turnState.damageDealtThisTurn += fluxDmg;
      }
    } else if (fluxEffect === 'block' && effect.shieldApplied > 0) {
      applyShield(playerState, effect.shieldApplied);
    } else if (fluxEffect === 'draw' && effect.extraCardsDrawn > 0) {
      drawHand(deck, effect.extraCardsDrawn);
    }
    turnState.turnLog.push({
      type: 'play',
      message: `Unstable Flux: effect fired twice (flux_double)`,
    });
  }

  // discardDamage: each card discarded during sift deals N damage (sift_discard_dmg2 tag)
  // The sift resolution above already discarded cards. Apply damage per discarded card.
  if ((effect.discardDamage ?? 0) > 0 && effect.siftParams) {
    const discardDmg = effect.discardDamage! * effect.siftParams.discardCount;
    if (discardDmg > 0) {
      const discardResult = applyDamageToEnemy(enemy, discardDmg);
      effect.damageDealt = (effect.damageDealt ?? 0) + discardDmg;
      effect.enemyDefeated = discardResult.defeated;
      turnState.damageDealtThisTurn += discardDmg;
      turnState.turnLog.push({
        type: 'play',
        message: `Sift: ${effect.siftParams.discardCount} discards × ${effect.discardDamage} = ${discardDmg} damage`,
        value: discardDmg,
      });
    }
  }

  // inscriptionFuryCcBonus: inscription_fury CC adds extra flat damage bonus stacks
  // (insc_fury_cc_bonus2 tag). Increase the inscription's effectValue for future attacks.
  if ((effect.inscriptionFuryCcBonus ?? 0) > 0) {
    const furyInsc = turnState.activeInscriptions.find(i => i.mechanicId === 'inscription_fury');
    if (furyInsc) {
      furyInsc.effectValue += effect.inscriptionFuryCcBonus!;
    }
  }

  // inscriptionIronThorns: inscription_iron CC also grants N thorns per turn (insc_iron_thorns1 tag)
  // Store bonus on the inscription so endPlayerTurn can grant thorns each turn.
  if ((effect.inscriptionIronThorns ?? 0) > 0) {
    const ironInsc = turnState.activeInscriptions.find(i => i.mechanicId === 'inscription_iron');
    if (ironInsc) {
      // Stash the thorns bonus in the inscription's effectValue offset (use extras field via convention)
      // Since ActiveInscription doesn't have an extras field, we store it on a parallel state field.
      // For now, grant the thorns immediately (each CC play from iron inscription grants thorns next turn).
      // The inscription already grants block; this bonus applies thorns in addition.
      turnState.thornsActive = true;
      turnState.thornsValue = (turnState.thornsValue ?? 0) + effect.inscriptionIronThorns!;
    }
  }

  // masteryBumpAmount: mastery_surge bumps cards by N mastery instead of 1 (msurge_plus2 tag)
  // masteryBumpsCount is already processed by the mastery bump handler below.
  // masteryBumpAmount controls how many levels each bump grants.
  // (The masteryBumpsCount processing is handled in the mastery surge section below.)

  // catalyst: double or triple enemy status stacks (poisonDoubled, burnDoubled, bleedDoubled, catalystTriple)
  if (effect.poisonDoubled || effect.catalystTriple) {
    const mult = effect.catalystTriple ? 3 : 2;
    const poisonStatus = enemy.statusEffects.find(s => s.type === 'poison');
    if (poisonStatus) {
      poisonStatus.value = Math.round(poisonStatus.value * mult);
      turnState.turnLog.push({
        type: 'play',
        message: `Catalyst: Poison stacks ×${mult} → ${poisonStatus.value}`,
        value: poisonStatus.value,
      });
    }
  }
  if (effect.burnDoubled || effect.catalystTriple) {
    const mult = effect.catalystTriple ? 3 : 2;
    const burnStatus = enemy.statusEffects.find(s => s.type === 'burn');
    if (burnStatus) {
      burnStatus.value = Math.round(burnStatus.value * mult);
      turnState.turnLog.push({
        type: 'play',
        message: `Catalyst: Burn stacks ×${mult} → ${burnStatus.value}`,
        value: burnStatus.value,
      });
    }
  }
  if (effect.bleedDoubled || (effect.catalystTriple && effect.bleedDoubled)) {
    const mult = effect.catalystTriple ? 3 : 2;
    const bleedStatus = enemy.statusEffects.find(s => s.type === 'bleed');
    if (bleedStatus && bleedStatus.turnsRemaining !== 99999) { // don't triple permanent bleed
      bleedStatus.value = Math.round(bleedStatus.value * mult);
      turnState.turnLog.push({
        type: 'play',
        message: `Catalyst: Bleed stacks ×${mult} → ${bleedStatus.value}`,
        value: bleedStatus.value,
      });
    }
  }

  // masteryBumpsCount: mastery_surge — bump N random hand cards by masteryBumpAmount (default 1)
  if ((effect.masteryBumpsCount ?? 0) > 0) {
    const bumpAmount = effect.masteryBumpAmount ?? 1;
    const bumpCount = effect.masteryBumpsCount!;
    // Select random cards from hand (excluding the surge card itself)
    const handCandidates = turnState.deck.hand.filter(c => c.id !== cardId);
    const shuffled = [...handCandidates].sort(() => Math.random() - 0.5);
    const toBump = shuffled.slice(0, bumpCount);
    for (const bc of toBump) {
      const maxLv = 5;
      bc.masteryLevel = Math.min(maxLv, (bc.masteryLevel ?? 0) + bumpAmount);
    }
    if (toBump.length > 0) {
      turnState.turnLog.push({
        type: 'play',
        message: `Mastery Surge: bumped ${toBump.length} card(s) by +${bumpAmount} mastery`,
        value: bumpAmount,
      });
    }
  }

  // blockCarries: fortify mechanic — block persists to next turn (fortify_carry tag)
  // This flag on the result means "do NOT decay this turn's block at turn end".
  // Store it for use in endPlayerTurn resetTurnState logic.
  if (effect.blockCarries) {
    turnState.persistentShield = Math.max(turnState.persistentShield, playerState.shield);
  }


  // ── Phase 3 tag-wiring section ────────────────────────────────────────────────────────────

  // reinforcePermanentBonusIncrement: reinforce_perm1 tag — increment stacking block bonus
  if (effect.reinforcePermanentBonusIncrement) {
    turnState.reinforcePermanentBonus = (turnState.reinforcePermanentBonus ?? 0) + 1;
    turnState.turnLog.push({
      type: 'play',
      message: `Reinforce permanent bonus: +1 (total: ${turnState.reinforcePermanentBonus})`,
      value: turnState.reinforcePermanentBonus,
    });
  }

  // apOnBlockGain: absorb_ap_on_block tag — grant +1 AP on Charge Correct
  if ((effect.apOnBlockGain ?? 0) > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + effect.apOnBlockGain!);
    turnState.turnLog.push({
      type: 'play',
      message: `Absorb CC: gained +${effect.apOnBlockGain} AP`,
      value: effect.apOnBlockGain,
    });
  }

  // masteryReachedL5Count: msurge_ap_on_l5 tag — +1 AP if any bumped card reached L5
  // This is processed AFTER masteryBumpsCount (which already ran above), so we check the bumped cards.
  if (effect.masteryReachedL5Count !== undefined && (effect.masteryBumpsCount ?? 0) > 0) {
    // Re-examine the hand to see if any card is now at L5 (may have just been bumped)
    // We approximate by checking if any card in hand that was bumped is at L5.
    // Since we don't track which cards were bumped, check all L5 cards in hand.
    // The check fires if masteryReachedL5Count sentinel is present (set by msurge_ap_on_l5 tag).
    const l5Cards = turnState.deck.hand.filter(c => (c.masteryLevel ?? 0) === 5).length;
    if (l5Cards > 0) {
      turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + 1);
      turnState.turnLog.push({
        type: 'play',
        message: 'Mastery Surge: card reached L5 — +1 AP',
        value: 1,
      });
    }
  }

  // empowerWeakStacks: empower_weak2 tag — store pending Weakness to apply with next buffed attack
  if ((effect.empowerWeakStacks ?? 0) > 0) {
    turnState.empowerWeakPending = effect.empowerWeakStacks!;
  }

  // empowerWeakPending: apply Weakness when a buffed attack fires and consumes buffNextCard
  // Check: card is attack type AND buff was active when it fired AND empowerWeakPending > 0
  if (
    card.cardType === 'attack' &&
    (turnState.empowerWeakPending ?? 0) > 0 &&
    turnState.buffNextCard > 0  // buff was consumed by this attack
  ) {
    applyStatusEffect(enemy.statusEffects, {
      type: 'weakness',
      value: turnState.empowerWeakPending,
      turnsRemaining: 2,
    });
    playStatusAudio('weakness');
    turnState.turnLog.push({
      type: 'play',
      message: `Empower Weak: applied ${turnState.empowerWeakPending} Weakness to enemy`,
      value: turnState.empowerWeakPending,
    });
    turnState.empowerWeakPending = 0;
  }

  // ── End of AR-tag-wiring section ──────────────────────────────────────────────────────────

  if (card.cardType === 'buff' && !effect.applyDoubleStrikeBuff && !effect.applyFocusBuff && !effect.applyOverclock && !(effect.applyIgniteBuff ?? 0)) {
    turnState.buffNextCard = effect.finalValue;
    // empowerTargetCount is handled above in the AR-tag-wiring section (sets empowerRemainingCount)
  } else if (!effect.applyIgniteBuff) {
    // Buff was consumed by this card play. Check empowerRemainingCount (empower_2cards tag):
    // if still > 0, the buff persists for another card; otherwise clear.
    if ((turnState.empowerRemainingCount ?? 0) > 0) {
      turnState.empowerRemainingCount -= 1;
      // Keep buffNextCard active for the remaining targets
    } else {
      turnState.buffNextCard = 0;
    }
  }

  // Store last resolved effect for mirror
  turnState.lastCardEffect = { ...effect };

  turnState.cardsPlayedThisTurn += 1;
  // Phase 2: Track shield card plays for block_consecutive3 tag
  if (card.cardType === 'shield') {
    turnState.shieldsPlayedThisTurn += 1;
  }
  if (playMode !== 'quick') {
    turnState.cardsCorrectThisTurn += 1;
    turnState.consecutiveCorrectThisEncounter += 1;
    turnState.chargesCorrectThisEncounter += 1; // AR-262: accuracy grade counter
    // AR-261: Correct charge answer — decrease fog, clear from review queue
    adjustAura(-1);
    if (card.factId) {
      clearReviewQueueFact(card.factId);
    }
    // Chain Momentum (AR-122): correct Charge earns a free surcharge on the NEXT Charge this turn,
    // but only for cards of the same chain type (color-specific momentum).
    if (playMode === 'charge' && CHAIN_MOMENTUM_ENABLED) {
      turnState.nextChargeFreeForChainType = card.chainType ?? null;
    }
    // quiz_master: track charge-correct count for +2 AP next turn trigger
    if (playMode === 'charge') {
      turnState.chargeCorrectsThisTurn = (turnState.chargeCorrectsThisTurn ?? 0) + 1;
    }
  }
  turnState.isPerfectTurn = (
    turnState.cardsCorrectThisTurn > 0 &&
    turnState.cardsCorrectThisTurn === turnState.cardsPlayedThisTurn
  );
  turnState.lastCardType = effect.effectType;

  // AR-202: Cure cursed fact on any successful play (quick or charge correct).
  // If the card's fact is in cursedFactIds, remove it (cure). Mark on result for UI animation.
  let curedCursedFact = false;
  if (card.factId && card.isCursed) {
    const runStateForCure = get(activeRunState);
    if (runStateForCure && runStateForCure.cursedFactIds.has(card.factId)) {
      runStateForCure.cursedFactIds.delete(card.factId);
      activeRunState.set(runStateForCure);
      curedCursedFact = true;
      // TODO(AR-212): apply CURSED_FSRS_CURE_BONUS (= 6.0) to FSRS scheduler on cure.
      // The cure grants double repetition credit to accelerate learning recovery.
    }
  }

  // Mastery upgrade: correct charge answer upgrades the played card
  let masteryChange: 'upgrade' | 'downgrade' | null = null;
  let masteryChangedCardId: string | null = null;
  if (playMode !== 'quick') {
    // Find the card in the discard pile (it was moved there by deckPlayCard)
    const discardedCard = turnState.deck.discardPile.find(c => c.id === cardId);
    if (discardedCard && canMasteryUpgrade(discardedCard)) {
      masteryUpgrade(discardedCard);
      masteryChange = 'upgrade';
      masteryChangedCardId = cardId;
    }
  }

  if (effect.enemyDefeated) {
    turnState.result = 'victory';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({ type: 'victory', message: 'Enemy defeated!' });
  } else {
    turnState.turnLog.push({
      type: 'play',
      message: `Played ${effect.mechanicName ?? effect.effectType}`,
      value: effect.finalValue,
      cardId,
    });
  }

  // AR-241: Per-fact variant progression — correct Charge advances the variant level.
  if (playMode === 'charge' && card.factId) {
    const runState = get(activeRunState);
    if (runState) {
      const currentLevel = runState.factVariantLevel[card.factId] ?? 0;
      const MAX_LEVEL = 3; // forward=0, reverse=1, synonym=2, definition=3
      runState.factVariantLevel[card.factId] = Math.min(currentLevel + 1, MAX_LEVEL);
      activeRunState.set(runState);
      if (import.meta.env.DEV) {
        console.log(`[QuizVariant] fact=${card.factId} correct → level ${currentLevel} → ${runState.factVariantLevel[card.factId]}`);
      }
    }
  }

  return {
    effect,
    enemyDefeated: effect.enemyDefeated,
    fizzled: false,
    blocked: false,
    isPerfectTurn: turnState.isPerfectTurn,
    turnState,
    masteryChange,
    masteryChangedCardId,
    curedCursedFact,
  };
}

export function skipCard(turnState: TurnState, cardId: string): TurnState {
  if (turnState.phase !== 'player_action' || turnState.result !== null) return turnState;
  deckPlayCard(turnState.deck, cardId);
  turnState.skippedCardsThisEncounter += 1;
  turnState.turnLog.push({
    type: 'skip',
    message: 'Card skipped',
    cardId,
  });
  return turnState;
}

export function endPlayerTurn(turnState: TurnState): EnemyTurnResult {
  if (turnState.phase !== 'player_action' || turnState.result !== null) {
    return {
      damageDealt: 0,
      effectsApplied: [],
      playerDefeated: turnState.playerState.hp <= 0,
      nextEnemyIntent: turnState.enemy.nextIntent.telegraph,
      executedIntentType: 'none',
      blockAbsorbedAll: false,
      turnState,
    };
  }

  const { playerState, enemy, deck } = turnState;

  // Step 5c (AR-59.13): onPlayerNoCharge — fires if player made NO Charge plays this turn
  if (enemy.template.onPlayerNoCharge && !enemy.playerChargedThisTurn) {
    const ctx: EnemyReactContext = {
      enemy,
      cardBaseDamage: 0,
      playMode: 'quick',
      chargeCorrect: false,
    };
    enemy.template.onPlayerNoCharge(ctx);
  }

  // AR-261: No charge played this turn — fog drifts up (+1)
  // Covers both "only Quick Play cards" and "ended turn without playing anything".
  if (!enemy.playerChargedThisTurn) {
    adjustAura(1);
  }

  // Step 5d (AR-59.13): Reset playerChargedThisTurn for the next player turn
  enemy.playerChargedThisTurn = false;

  // Step 4 (AR-59.13): Dispatch onEnemyTurnStart for enrage logic (Timer Wyrm), mastery erosion (Brain Fog)
  // Pass whether the player made any correct Charges this turn (read before reset) and the actual hand objects.
  const playerChargedCorrectThisTurn = turnState.cardsCorrectThisTurn > 0;
  dispatchEnemyTurnStart(enemy, turnState.turnNumber, playerChargedCorrectThisTurn, deck.hand);
  // Phase 8: Sync Librarian's _silencedCardType (set by onEnemyTurnStart) to turnState.lockedCardType.
  // This locks a card type for the upcoming player turn. Cleared at the start of the next player turn.
  if (enemy._silencedCardType != null) {
    turnState.lockedCardType = enemy._silencedCardType;
    enemy._silencedCardType = null; // consume so it's re-rolled each turn
  }

  // Block decays each turn — enemy must re-defend to maintain it (STS-style)
  enemy.block = 0;

  let intentResult = { damage: 0, playerEffects: [] as StatusEffect[], enemyHealed: 0, stunned: false, blockStripped: 0 };
  let intentSkipped = false;
  if (turnState.staggeredEnemyNextTurn) {
    // AR-206: Stagger — skip enemy action entirely. Turn counter advances, enrage still ticks.
    intentSkipped = true;
    turnState.staggeredEnemyNextTurn = false;
  } else if (
    turnState.slowEnemyIntent &&
    (_slowAnyActionThisTurn || enemy.nextIntent.type === 'defend' || enemy.nextIntent.type === 'buff')
  ) {
    // slow_any_action tag: skip ANY action; default: only skips defend/buff
    intentSkipped = true;
    turnState.slowEnemyIntent = false;
    _slowAnyActionThisTurn = false; // consume the any-action flag
  } else {
    intentResult = executeEnemyIntent(enemy);
    // AR-263: Pop Quiz stun — enemy skipped its action
    if (intentResult.stunned) {
      intentSkipped = true;
    }
  }
  const executedIntentType = intentSkipped ? 'none' as const : enemy.nextIntent.type;

  let damageDealt = 0;
  let blockAbsorbedAll = false;
  let playerDefeated = false;
  const effectsApplied: StatusEffect[] = [];

  if (intentResult.damage > 0) {
    let incomingDamage = intentResult.damage;
    const currentFloor = turnState.deck?.currentFloor ?? 1;
    const enemyHpPercent = enemy.maxHP > 0 ? enemy.currentHP / enemy.maxHP : 1;
    const enrageBonus = getEnrageBonus(turnState.encounterTurnNumber, currentFloor, enemyHpPercent);
    if (enrageBonus > 0) {
      incomingDamage += enrageBonus;
    }
    // Re-apply damage cap AFTER enrage so enrage cannot bypass it (bug fixed 2026-04-04).
    // Must use enemy.floor (not deck currentFloor) to match the segment used in executeEnemyIntent.
    // Replicates the getSegmentForFloor logic from enemyManager (unexported helper).
    if (!enemy.nextIntent.bypassDamageCap) {
      const enemyFloor = enemy.floor;
      const capSeg: 1 | 2 | 3 | 4 | 'endless' =
        enemyFloor <= 6 ? 1 :
        enemyFloor <= 12 ? 2 :
        enemyFloor <= 18 ? 3 :
        enemyFloor <= 24 ? 4 : 'endless';
      const capLookup = getBalanceValue('enemyTurnDamageCap', ENEMY_TURN_DAMAGE_CAP) as Record<1 | 2 | 3 | 4 | 'endless', number | null>;
      const cap = capLookup[capSeg];
      if (cap != null) {
        incomingDamage = Math.min(incomingDamage, cap);
      }
    }
    // Use the shared helper so the pipeline stays in sync with computeIntentDisplayDamage.
    incomingDamage = applyPostIntentDamageScaling(incomingDamage, {
      difficultyMode: get(difficultyMode),
      ascensionEnemyDamageMultiplier: turnState.ascensionEnemyDamageMultiplier,
      canaryEnemyDamageMultiplier: turnState.canaryEnemyDamageMultiplier,
    });

    const damageTakenFx = resolveDamageTakenEffects(turnState.activeRelicIds, {
      playerHpPercent: playerState.hp / playerState.maxHP,
      hadBlock: playerState.shield > 0,
      blockAbsorbedAll: false,
    });
    if (damageTakenFx.percentIncrease > 0 && turnState.glassPenaltyRemovedTurnsRemaining <= 0) {
      incomingDamage = Math.round(incomingDamage * (1 + damageTakenFx.percentIncrease));
      turnState.triggeredRelicId = 'glass_cannon';
    }

    // AR-203: Self-Burn — player's own Burn stacks trigger when hit by enemy attack.
    // Bonus = current stacks, then halves. Applied before block (consistent with enemy-targeting Burn).
    // Infrastructure for Volatile Manuscript relic (AR-211).
    const selfBurnResult = triggerBurn(playerState.statusEffects);
    if (selfBurnResult.bonusDamage > 0) {
      incomingDamage += selfBurnResult.bonusDamage;
      turnState.turnLog.push({
        type: 'status_tick',
        message: `Self-Burn triggered: +${selfBurnResult.bonusDamage} incoming damage`,
        value: selfBurnResult.bonusDamage,
      });
    }

    const shieldBefore = playerState.shield;
    const damageResult = takeDamage(playerState, incomingDamage);
    damageDealt = damageResult.actualDamage;
    playerDefeated = damageResult.defeated;
    blockAbsorbedAll = shieldBefore > 0 && damageResult.actualDamage === 0;

    // on_hp_loss: pain_conduit reflect + bloodletter arm
    if (damageResult.actualDamage > 0 && turnState.activeRelicIds.size > 0) {
      const hpLossFx = resolveHpLossEffects(turnState.activeRelicIds, {
        hpLost: damageResult.actualDamage,
        source: 'enemy',
      });
      if (hpLossFx.reflectDamage > 0) {
        const reflectResult = applyDamageToEnemy(enemy, hpLossFx.reflectDamage);
        if (reflectResult.defeated) {
          turnState.result = 'victory';
          turnState.phase = 'encounter_end';
        }
      }
      if (hpLossFx.nextAttackBonus > 0) {
        turnState.bloodletterArmed = true;
      }
    }

    if (damageTakenFx.thornReflect > 0) {
      applyDamageToEnemy(enemy, damageTakenFx.thornReflect);
      turnState.triggeredRelicId = 'thorned_vest';
    }

    // thorns card mechanic: reflect thornsValue damage back to enemy
    if (turnState.thornsActive && turnState.thornsValue > 0) {
      applyDamageToEnemy(enemy, turnState.thornsValue);
      if (enemy.currentHP <= 0) {
        turnState.result = 'victory';
        turnState.phase = 'encounter_end';
      }
    }

    // counterDamage: parry_counter3 tag — deal N damage to enemy per hit when they attack
    if ((turnState.counterDamagePerHit ?? 0) > 0) {
      const counterResult = applyDamageToEnemy(enemy, turnState.counterDamagePerHit);
      if (counterResult.defeated) {
        turnState.result = 'victory';
        turnState.phase = 'encounter_end';
      }
      turnState.turnLog.push({
        type: 'play',
        message: `Parry counter: dealt ${turnState.counterDamagePerHit} damage to attacker`,
        value: turnState.counterDamagePerHit,
      });
    }
  }

  // Thorns resets after each enemy attack phase — must be reapplied each turn
  turnState.thornsActive = false;
  // thornsPersistent: if set, carry thorns value to next encounter (thorns_persist tag)
  if (!turnState.thornsPersistent) {
    turnState.thornsValue = 0;
  }
  // counterDamage: parry_counter3 tag — reset after each enemy attack phase
  turnState.counterDamagePerHit = 0;

  turnState.turnLog.push({
    type: 'enemy_action',
    message: intentSkipped ? 'Enemy action disrupted by Slow' : `Enemy uses ${enemy.nextIntent.telegraph}`,
    value: intentResult.damage,
  });

  // Phase 9: strip_block — instant player block removal from enemy debuff intent
  if (intentResult.blockStripped > 0) {
    const stripped = Math.min(playerState.shield, intentResult.blockStripped);
    playerState.shield = Math.max(0, playerState.shield - stripped);
    if (stripped > 0) {
      turnState.turnLog.push({
        type: 'enemy_action',
        message: `Enemy strips ${stripped} block`,
        value: stripped,
      });
    }
  }

  for (const effect of intentResult.playerEffects) {
    applyStatusEffect(playerState.statusEffects, effect);
    effectsApplied.push(effect);
  }

  if (playerDefeated) {
    const lethalFx = resolveLethalEffects(turnState.activeRelicIds, {
      lastBreathUsedThisEncounter: turnState.secondWindUsed,
      phoenixUsedThisRun: false, // TODO: wire up run-level phoenix flag (AR-59.11)
      isBossEncounter: turnState.enemy?.template?.category === 'boss',
    });
    if (lethalFx.lastBreathSave) {
      playCardAudio('relic-death-prevent');
      playerState.hp = 1;
      playerDefeated = false;
      turnState.secondWindUsed = true;
      turnState.triggeredRelicId = 'last_breath';
      if (lethalFx.lastBreathBlock > 0) {
        applyShield(playerState, lethalFx.lastBreathBlock);
      }
      if (lethalFx.lastBreathDamageBonus > 0) {
        turnState.buffNextCard += lethalFx.lastBreathDamageBonus;
      }
    } else if (lethalFx.phoenixSave) {
      playCardAudio('relic-death-prevent');
      playerState.hp = Math.max(1, Math.round(playerState.maxHP * lethalFx.phoenixHealPercent));
      playerDefeated = false;
      turnState.triggeredRelicId = 'phoenix_feather';
      if (lethalFx.phoenixBlock > 0) {
        applyShield(playerState, lethalFx.phoenixBlock);
      }
      // Phoenix Feather: all cards auto-Charge free for 1 turn after resurrection
      turnState.phoenixAutoChargeTurns = 1;
      // Tier 3: Phoenix Rage — activate bonus damage + remove glass penalty
      if ((lethalFx as any).phoenixRageActive) {
        turnState.phoenixRageTurnsRemaining = 5;
        turnState.glassPenaltyRemovedTurnsRemaining = 3;
      }
    }
  }

  if (playerDefeated) {
    turnState.result = 'defeat';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({ type: 'defeat', message: 'Player defeated!' });
    rollNextIntent(enemy);
    return {
      damageDealt,
      effectsApplied,
      playerDefeated: true,
      nextEnemyIntent: enemy.nextIntent.telegraph,
      executedIntentType,
      blockAbsorbedAll,
      turnState,
    };
  }

  const playerTick = tickPlayerStatusEffects(playerState);
  if (playerTick.defeated) {
    turnState.result = 'defeat';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({ type: 'defeat', message: 'Player defeated by status effects!' });
    rollNextIntent(enemy);
    return {
      damageDealt,
      effectsApplied,
      playerDefeated: true,
      nextEnemyIntent: enemy.nextIntent.telegraph,
      executedIntentType,
      blockAbsorbedAll,
      turnState,
    };
  }

  if (playerTick.poisonDamage > 0) {
    playCardAudio('status-poison-tick');
    turnState.turnLog.push({
      type: 'status_tick',
      message: `Poison dealt ${playerTick.poisonDamage} damage`,
      value: playerTick.poisonDamage,
    });
  }

  if (playerTick.regenHeal > 0) {
    playCardAudio('status-regen-tick');
    turnState.turnLog.push({
      type: 'status_tick',
      message: `Regen healed ${playerTick.regenHeal} HP`,
      value: playerTick.regenHeal,
    });
  }

  const enemyTick = tickEnemyStatusEffects(enemy, turnState.activeRelicIds);
  if (enemy.currentHP <= 0) {
    turnState.result = 'victory';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({ type: 'victory', message: 'Enemy defeated by status effects!' });
    rollNextIntent(enemy);
    return {
      damageDealt,
      effectsApplied,
      playerDefeated: false,
      nextEnemyIntent: enemy.nextIntent.telegraph,
      executedIntentType,
      blockAbsorbedAll,
      turnState,
    };
  }

  if (enemyTick.poisonDamage > 0) {
    playCardAudio('status-poison-tick');
    turnState.turnLog.push({
      type: 'status_tick',
      message: `Enemy took ${enemyTick.poisonDamage} poison damage`,
      value: enemyTick.poisonDamage,
    });
  }

  // AR-203: Bleed decays by BLEED_DECAY_PER_TURN at end of each enemy turn.
  // Happens AFTER the Poison tick so Bleed does not amplify Poison damage.
  // Bleed only triggers on card-play damage (effect.damageDealt path), not passive damage.
  // bleedPermanent sentinel: turnsRemaining === 99999 means this bleed never decays (rupture_bleed_perm tag).
  const bleedEffect = enemy.statusEffects.find(e => e.type === 'bleed');
  if (bleedEffect && bleedEffect.turnsRemaining !== 99999) {
    bleedEffect.value = Math.max(0, bleedEffect.value - BLEED_DECAY_PER_TURN);
    if (bleedEffect.value <= 0) {
      const idx = enemy.statusEffects.indexOf(bleedEffect);
      if (idx !== -1) enemy.statusEffects.splice(idx, 1);
    }
  }

  for (const passive of turnState.activePassives) {
    if (passive.cardType === 'shield') {
      applyShield(playerState, passive.value);
    }
  }

  if (turnState.isPerfectTurn && turnState.cardsPlayedThisTurn >= 3) {
    playCardAudio('perfect-turn');
    const perfectApBonus = resolvePerfectTurnBonus(turnState.activeRelicIds);
    if (perfectApBonus > 0) {
      turnState.bonusApNextTurn += perfectApBonus;
      turnState.triggeredRelicId = 'momentum_gem';
    }
  }

  const turnEndFx = resolveTurnEndEffects(turnState.activeRelicIds, {
    damageDealtThisTurn: turnState.damageDealtThisTurn,
    cardsPlayedThisTurn: turnState.cardsPlayedThisTurn,
    isPerfectTurn: turnState.isPerfectTurn,
    currentBlock: playerState.shield,
    chargeCorrectsThisTurn: turnState.chargeCorrectsThisTurn ?? 0,
  });
  const carryShield = turnEndFx.blockCarries
    ? playerState.shield
    : turnState.persistentShield;

  if (turnEndFx.bonusApFromAfterimage > 0) {
    turnState.bonusApNextTurn += turnEndFx.bonusApFromAfterimage;
    turnState.triggeredRelicId = 'afterimage';
  }

  // overclocked_mind: discard 2 random cards from hand at turn end
  if ((turnEndFx.forceDiscard ?? 0) > 0) {
    for (let i = 0; i < turnEndFx.forceDiscard! && turnState.deck.hand.length > 0; i++) {
      const randomIdx = Math.floor(Math.random() * turnState.deck.hand.length);
      const discarded = turnState.deck.hand.splice(randomIdx, 1)[0];
      turnState.deck.discardPile.push(discarded);
    }
  }

  // thorn_mantle: grant 4 thorns when player has 10+ block at turn end
  if ((turnEndFx.grantThorns ?? 0) > 0) {
    turnState.thornsActive = true;
    turnState.thornsValue = (turnState.thornsValue ?? 0) + turnEndFx.grantThorns!;
  }

  // quiz_master: +2 AP next turn if 3+ correct Charges this turn
  if ((turnEndFx.bonusApNextTurn ?? 0) > 0) {
    turnState.bonusApNextTurn = (turnState.bonusApNextTurn ?? 0) + turnEndFx.bonusApNextTurn!;
  }

  // Compute act for act-aware block decay before calling resetTurnState
  const _decayFloor = turnState.deck?.currentFloor ?? 1;
  const _decayAct = _decayFloor <= 6 ? 1 : _decayFloor <= 12 ? 2 : 3;
  resetTurnState(playerState, _decayAct); // act-aware block decay applied
  // Entrench CC: persistent shield adds on TOP of decayed block
  if (turnState.persistentShield > 0) {
    playerState.shield += turnState.persistentShield;
  }
  // aegis_stone / fortress_wall: block carries fully (overrides decay)
  if (turnEndFx.blockCarries) {
    playerState.shield = Math.max(playerState.shield, carryShield);
    turnState.triggeredRelicId = 'fortress_wall';
  }
  turnState.persistentShield = 0;

  // aegis_stone: if carrying 15+ block into next turn, grant Thorns 2 for the next enemy attack
  if (turnEndFx.blockCarries && turnState.activeRelicIds.has('aegis_stone') && playerState.shield >= RELIC_AEGIS_STONE_MAX_CARRY) {
    turnState.thornsActive = true;
    turnState.thornsValue = (turnState.thornsValue ?? 0) + 2;
  }

  turnState.cardsPlayedThisTurn = 0;
  turnState.cardsCorrectThisTurn = 0;
  turnState.isPerfectTurn = false;
  // Phase 8: Librarian Silence — clear locked card type at start of new player turn
  turnState.lockedCardType = null;
  turnState.buffNextCard = 0;
  turnState.lastCardType = undefined;
  turnState.lastCardEffect = null;
  turnState.damageDealtThisTurn = 0;
  turnState.firstAttackUsed = false;
  // Act-aware AP: Act 1 = 3 AP, Act 2+ = 4 AP (floors 1-6=Act1, 7-12=Act2, 13+=Act3).
  const _currentFloor = turnState.deck?.currentFloor ?? 1;
  const _currentAct = _currentFloor <= 6 ? 1 : _currentFloor <= 12 ? 2 : 3;
  const _baseAp = AP_PER_ACT[_currentAct] ?? START_AP_PER_TURN;
  turnState.apCurrent = Math.min(turnState.apMax, _baseAp + turnState.bonusApNextTurn);
  turnState.bonusApNextTurn = 0;
  // Reset per-turn relic tracking fields
  turnState.bloodletterArmed = false;
  turnState.chargeCorrectsThisTurn = 0;
  // AR-tag-wiring: reset per-turn new fields
  turnState.empowerRemainingCount = 0;
  turnState.archiveBlockBonus = 0;
  turnState.timerExtensionPct = 0;
  turnState.eliminateDistractors = 0;
  turnState.freePlayCharges = 0; // frenzy / focus_next2free charges don't carry over turns

  // Phase 2/3: Copy shieldsPlayedThisTurn → shieldsPlayedLastTurn, then reset for next turn.
  turnState.shieldsPlayedLastTurn = turnState.shieldsPlayedThisTurn;
  turnState.lastTurnPlayedShield = turnState.shieldsPlayedThisTurn > 0;
  turnState.shieldsPlayedThisTurn = 0;
  // Phase 3: empower_weak2 — clear pending weak stacks at turn end if not consumed
  turnState.empowerWeakPending = 0;

  // Capture chainType BEFORE decay — used by tag_magnet to bias the next draw
  const chainTypeBeforeReset = turnState.chainType;

  // Decay (not fully reset) Knowledge Chain at end of each player turn.
  // Chain length drops by CHAIN_DECAY_PER_TURN; momentum carries partially into next turn.
  decayChain();
  const decayedChain = getChainState();
  turnState.chainMultiplier = decayedChain.length > 0 ? 1.0 : 1.0; // will be recalculated on next card play
  turnState.chainLength = decayedChain.length;
  turnState.chainType = decayedChain.chainType;

  // Chain Momentum: reset on turn end
  turnState.nextChargeFreeForChainType = null;

  // AR-207: Clear per-turn restriction/buff flags
  turnState.battleTranceRestriction = false;
  turnState.warcryFreeChargeActive = false;
  // Chain Anchor persists across turns until consumed — do NOT clear here.
  // lastPlayedMechanicId resets at turn start so Chameleon can't copy across turns.
  turnState.lastPlayedMechanicId = null;
  turnState.lastPlayedChainType = null;

  if (turnState.foresightTurnsRemaining > 0) {
    turnState.foresightTurnsRemaining -= 1;
  }

  // Phoenix Feather: decrement auto-Charge turns
  if (turnState.phoenixAutoChargeTurns > 0) {
    turnState.phoenixAutoChargeTurns -= 1;
  }

  // Tier 3: Decrement Phoenix Rage counters
  if (turnState.phoenixRageTurnsRemaining > 0) {
    turnState.phoenixRageTurnsRemaining -= 1;
  }
  if (turnState.glassPenaltyRemovedTurnsRemaining > 0) {
    turnState.glassPenaltyRemovedTurnsRemaining -= 1;
  }

  rollNextIntent(enemy);
  // forcedAttackTurnsRemaining: guard_taunt1t tag — force enemy to attack next turn
  if ((turnState.forcedAttackTurnsRemaining ?? 0) > 0) {
    // Find an attack intent from the pool and override the rolled intent
    const pool = (enemy.phase === 2 && enemy.template.phase2IntentPool)
      ? enemy.template.phase2IntentPool
      : enemy.template.intentPool;
    const attackIntent = pool.find(i => i.type === 'attack' || i.type === 'multi_attack');
    if (attackIntent) {
      enemy.nextIntent = attackIntent;
    }
    turnState.forcedAttackTurnsRemaining -= 1;
  }
  turnState.turnNumber += 1;
  turnState.encounterTurnNumber += 1;
  turnState.isSurge = isSurgeTurn(turnState.turnNumber);
  // AR-310: Rotate the active chain color for the upcoming turn.
  turnState.activeChainColor = rotateActiveChainColor(turnState.turnNumber);

  const discardedAtTurnEnd = discardHand(deck);
  if (discardedAtTurnEnd.length > 0) {
    turnState.turnLog.push({
      type: 'draw',
      message: `Discarded ${discardedAtTurnEnd.length} unplayed card${discardedAtTurnEnd.length === 1 ? '' : 's'}`,
      value: discardedAtTurnEnd.length,
    });
  }

  let drawCount = turnState.pendingDrawCountOverride ?? turnState.baseDrawCount;
  turnState.pendingDrawCountOverride = null;
  // Surge AP Bonus: +1 AP at the start of Surge turns (replaces old surcharge-waiver).
  // Gives players an extra resource to spend freely; they still pay full surcharge to charge.
  if (turnState.isSurge) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + SURGE_BONUS_AP);
  }
  // Surge Draw Bonus: draw one extra card at the start of Surge turns.
  if (turnState.isSurge) {
    drawCount += SURGE_DRAW_BONUS;
  }
  // AR-261: Flow State bonus — draw one extra card per turn when in flow_state
  if (getAuraState() === 'flow_state') {
    drawCount += 1;
  }

  // tag_magnet relic: bias draw toward last turn's chain type
  const drawBias = resolveDrawBias(turnState.activeRelicIds, chainTypeBeforeReset ?? undefined);
  const tagMagnetBias = drawBias.biasChainType !== null
    ? { chainType: drawBias.biasChainType, chance: drawBias.biasChance }
    : undefined;
  drawHand(deck, drawCount + turnState.bonusDrawNextTurn, { tagMagnetBias });
  turnState.bonusDrawNextTurn = 0;

  // AR-268: Trick Question lock — apply lock to a random hand card if _lockedFactId is set
  if (enemy._lockedFactId && (enemy._lockTurnsRemaining ?? 0) > 0) {
    const hand = deck.hand;
    if (hand.length > 0) {
      const randomIdx = Math.floor(Math.random() * hand.length);
      hand[randomIdx].isLocked = true;
      hand[randomIdx].lockedFactId = enemy._lockedFactId;
    }
    enemy._lockTurnsRemaining = (enemy._lockTurnsRemaining ?? 0) - 1;
    if ((enemy._lockTurnsRemaining ?? 0) <= 0) {
      enemy._lockedFactId = undefined;
    }
  }

  turnState.phase = 'player_action';
  turnState.turnLog = [];

  // Turn-start relic effects (iron_buckler: +3 block per turn; blood_price: +1 AP; deja_vu: spawn)
  const turnStartFx = resolveTurnStartEffects(
    turnState.activeRelicIds,
    0, // capacitor stored AP — maintained elsewhere
    {
      turnNumberThisEncounter: turnState.encounterTurnNumber,
      characterLevel: turnState.characterLevel,
      dejaVuUsedThisEncounter: turnState.dejaVuUsedThisEncounter,
      auraState: getAuraState(),
    },
  );
  if (turnStartFx.bonusBlock > 0) {
    applyShield(playerState, turnStartFx.bonusBlock);
    turnState.triggeredRelicId = 'iron_buckler';
  }
  if (turnStartFx.bonusAP > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + turnStartFx.bonusAP);
    turnState.triggeredRelicId = 'blood_price';
  }
  // domain_mastery_sigil (v3): apply aura-based AP modifier (+1 flow_state / -1 brain_fog)
  if (turnStartFx.auraApModifier !== undefined && turnStartFx.auraApModifier !== 0) {
    turnState.apCurrent = Math.max(1, Math.min(turnState.apMax, turnState.apCurrent + turnStartFx.auraApModifier));
    turnState.triggeredRelicId = 'domain_mastery_sigil';
  }

  // Deja Vu: spawn cards from discard into hand on turn 1 of encounter
  if (turnStartFx.dejaVuCardSpawn && !turnState.dejaVuUsedThisEncounter) {
    const { count, apCostReduction } = turnStartFx.dejaVuCardSpawn;
    const runForDeja = get(activeRunState);
    const correctFacts = runForDeja?.factsAnsweredCorrectly ?? new Set<string>();
    const { discardPile, hand } = turnState.deck;
    // Pick `count` random cards from discard; prefer cards whose fact was answered correctly
    const candidates = [...discardPile];
    // Shuffle to randomize selection
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    // Sort: facts answered correctly go first (preferred candidates)
    candidates.sort((a, b) => {
      const aKnown = a.factId ? correctFacts.has(a.factId) : false;
      const bKnown = b.factId ? correctFacts.has(b.factId) : false;
      return (bKnown ? 1 : 0) - (aKnown ? 1 : 0);
    });
    const spawned = candidates.slice(0, count);
    for (const card of spawned) {
      // Remove from discard
      const discardIdx = discardPile.findIndex(c => c.id === card.id);
      if (discardIdx !== -1) {
        discardPile.splice(discardIdx, 1);
      }
      // Apply AP cost reduction for this turn
      const spawnedCard = { ...card, apCost: Math.max(0, (card.apCost ?? 1) - apCostReduction) };
      hand.push(spawnedCard);
    }
    turnState.dejaVuUsedThisEncounter = true;
    turnState.turnLog.push({
      type: 'draw',
      message: `Deja Vu: spawned ${spawned.length} card${spawned.length === 1 ? '' : 's'} from discard`,
      value: spawned.length,
    });
  }

  // herbal_pouch (v3) — apply 1 Poison to all enemies at turn start
  if ((turnStartFx.poisonToAllEnemies ?? 0) > 0) {
    playCardAudio('relic-trigger');
    applyStatusEffect(enemy.statusEffects, {
      type: 'poison',
      value: turnStartFx.poisonToAllEnemies!,
      turnsRemaining: 99,
    });
    turnState.triggeredRelicId = 'herbal_pouch';
  }

  // AR-204: Inscription of Iron — apply block at start of each player turn, before draw.
  const ironInscription = getActiveInscription(turnState, 'inscription_iron');
  if (ironInscription) {
    applyShield(playerState, ironInscription.effectValue);
  }

  return {
    damageDealt,
    effectsApplied,
    playerDefeated: false,
    nextEnemyIntent: enemy.nextIntent.telegraph,
    executedIntentType,
    blockAbsorbedAll,
    turnState,
  };
}

export function checkEncounterEnd(turnState: TurnState): EncounterResult {
  if (turnState.enemy.currentHP <= 0) return 'victory';
  if (turnState.playerState.hp <= 0) return 'defeat';
  return null;
}

export function isHandEmpty(turnState: TurnState): boolean {
  return turnState.deck.hand.length === 0;
}

export function getHandSize(turnState: TurnState): number {
  return turnState.deck.hand.length;
}

/**
 * Returns true if ANY card in the current hand can be played (Quick Play or Charge).
 *
 * Accounts for:
 * - Current AP vs each card's base cost
 * - Focus AP discount (focusCharges > 0 reduces cost by 1)
 * - Warcry free Charge (warcryFreeChargeActive waives the +1 Charge surcharge)
 * - Chain Momentum (nextChargeFreeForChainType waives the +1 Charge surcharge for matching chain type)
 * - Battle Trance restriction (blocks ALL plays when active)
 *
 * Quick Play costs base AP only (no surcharge).
 * Charge costs base AP + CHARGE_AP_SURCHARGE (1) on normal turns; waived on Surge/Warcry/Momentum/active chain color match.
 */
export function isAnyCardPlayable(turnState: TurnState): boolean {
  if (turnState.phase !== 'player_action') return false;
  if (turnState.result !== null) return false;
  if (turnState.battleTranceRestriction) return false;

  const { deck, apCurrent, focusCharges } = turnState;
  const focusDiscount = focusCharges > 0 ? 1 : 0;

  // A card is playable if:
  //   - Quick Play: baseAp <= apCurrent (no surcharge ever applies)
  //   - Charge with surcharge waived: same as QP cost
  // Since QP is always available (no surcharge), checking baseAp <= apCurrent is sufficient
  // to determine if a card can be played in ANY mode. The surcharge only affects charge plays
  // but doesn't block play — QP remains available. This means no change is needed here for
  // the chain-color waiver: QP already ensures any baseAp-affordable card is playable.
  //
  // NOTE: isAnyCardPlayable updated (2026-04-08) to document chain-color match waiver in JSDoc.
  // The loop logic is unchanged because Quick Play (baseAp only, no surcharge) covers all cases
  // where baseAp <= apCurrent. Chain-color matching affects charge AP cost in playCardAction.
  for (const card of deck.hand) {
    const baseAp = Math.max(0, getEffectiveApCost(card) - focusDiscount);
    // Quick Play costs baseAp. Any card affordable via QP is playable.
    if (baseAp <= apCurrent) return true;
  }
  return false;
}

/**
 * Applies the player's choice from a pending phase_shift or unstable_flux popup to the turn state.
 * Called by the UI after the MultiChoicePopup resolves with the chosen option id.
 *
 * @param turnState - The active turn state (mutated in place).
 * @param choiceId - The selected option id ('damage', 'block', 'draw', or 'debuff').
 * @param options - The options array from the pending choice (contains pre-computed values).
 * @returns Object with applied effect info for UI feedback.
 */
export function applyPendingChoice(
  turnState: TurnState,
  choiceId: string,
  options: Array<{
    id: string;
    label: string;
    damageDealt?: number;
    shieldApplied?: number;
    extraCardsDrawn?: number;
    statusesApplied?: Array<{ type: string; value: number; turnsRemaining: number }>;
  }>,
): { damageDealt: number; shieldApplied: number; extraCardsDrawn: number; enemyDefeated: boolean } {
  const chosen = options.find(o => o.id === choiceId);
  if (!chosen) {
    return { damageDealt: 0, shieldApplied: 0, extraCardsDrawn: 0, enemyDefeated: false };
  }

  let damageDealt = 0;
  let shieldApplied = 0;
  let extraCardsDrawn = 0;
  let enemyDefeated = false;

  if ((chosen.damageDealt ?? 0) > 0) {
    const dmg = chosen.damageDealt!;
    const dmgResult = applyDamageToEnemy(turnState.enemy, dmg);
    damageDealt = dmg;
    enemyDefeated = dmgResult.defeated;
    turnState.damageDealtThisTurn += dmg;
  }

  if ((chosen.shieldApplied ?? 0) > 0) {
    applyShield(turnState.playerState, chosen.shieldApplied!);
    shieldApplied = chosen.shieldApplied!;
  }

  if ((chosen.extraCardsDrawn ?? 0) > 0) {
    extraCardsDrawn = chosen.extraCardsDrawn!;
    // Drawing is handled by encounterBridge (same as normal extraCardsDrawn flow)
  }

  if (chosen.statusesApplied) {
    for (const status of chosen.statusesApplied) {
      applyStatusEffect(turnState.enemy.statusEffects, status as import('../data/statusEffects').StatusEffect);
    }
  }

  return { damageDealt, shieldApplied, extraCardsDrawn, enemyDefeated };
}

/**
 * Shared in-place swap helper for Transmute (encounter-only scope).
 *
 * Searches all four piles for sourceCardId. When found, transforms it in-place:
 * - Overwrites mechanic fields (mechanicId, mechanicName, cardType, apCost, baseEffectValue,
 *   originalBaseEffectValue, chainType) with the first selected candidate.
 * - Sets isTransmuted=true and stashes full original card in originalCard for revert at encounter end.
 * - Keeps the card's id, factId, and position in its pile stable.
 * - Applies catch-up mastery to the new mechanic.
 * - At mastery 3+ with 2+ selections, extra selections are added as NEW transmuted cards in hand.
 *   These extras carry a stub originalCard (just id) so revertTransmutedCards removes them cleanly.
 *
 * If sourceCardId is not found in any pile, logs a warning and returns without mutating state.
 */
function applyTransmuteSwap(
  turnState: TurnState,
  sourceCardId: string,
  selectedCards: Card[],
): void {
  if (selectedCards.length === 0) return;

  const { hand, discardPile, drawPile, exhaustPile } = turnState.deck;

  // Search all piles — source card may be in hand (QP path), discard (post-play), draw, or exhaust
  let sourceCard: Card | undefined;
  let sourcePile: Card[] | undefined;
  let sourceIdx = -1;

  const piles: Card[][] = [hand, discardPile, drawPile, exhaustPile];
  for (const pile of piles) {
    const idx = pile.findIndex(c => c.id === sourceCardId);
    if (idx >= 0) {
      sourceCard = pile[idx];
      sourcePile = pile;
      sourceIdx = idx;
      break;
    }
  }

  if (!sourceCard || !sourcePile || sourceIdx < 0) {
    console.warn(`[turnManager] applyTransmuteSwap: source card ${sourceCardId} not found in any pile`);
    return;
  }

  // Capture full original state for revert
  const originalCardSnapshot: Card = { ...sourceCard };

  // Gather current deck for catch-up mastery calculation (before mutation)
  const allDeckCards = [...drawPile, ...hand, ...discardPile, ...exhaustPile];

  // Transform first selection in-place (preserving id + factId)
  const primary = selectedCards[0];
  const primaryMastery = computeCatchUpMastery(primary, allDeckCards);
  sourcePile[sourceIdx] = {
    ...sourceCard,
    // Mechanic fields overwritten
    mechanicId: primary.mechanicId,
    mechanicName: primary.mechanicName,
    cardType: primary.cardType,
    apCost: primary.apCost,
    baseEffectValue: primary.baseEffectValue,
    originalBaseEffectValue: primary.baseEffectValue,
    chainType: primary.chainType,
    masteryLevel: primaryMastery,
    isUpgraded: primaryMastery > 0,
    // Encounter-only: remember original for revert
    isTransmuted: true,
    originalCard: originalCardSnapshot,
  };

  // Extra selections (mastery 3+ CC 2-pick): add as new transmuted cards in hand
  for (let i = 1; i < selectedCards.length; i++) {
    const extra = selectedCards[i];
    const extraMastery = computeCatchUpMastery(extra, allDeckCards);
    // Stub originalCard marks this as a "remove on revert" extra (no real original to restore)
    const extraCard: Card = {
      ...extra,
      id: `transmute_extra_${Math.random().toString(36).slice(2, 10)}`,
      factId: originalCardSnapshot.factId,
      masteryLevel: extraMastery,
      isUpgraded: extraMastery > 0,
      isTransmuted: true,
      originalCard: { id: `transmute_extra_remove_${Math.random().toString(36).slice(2, 10)}` } as Card,
    };
    hand.push(extraCard);
  }
}

/**
 * Resolve a Transmute card pick (Charge Correct path) — encounter-only in-place swap.
 * Finds the source card in any pile, transforms it in-place with the selected candidate(s),
 * sets isTransmuted=true + originalCard for revert at encounter end.
 * Mastery 3+ with 2 selections: first replaces the source, second is added to hand.
 */
export function resolveTransmutePick(
  turnState: TurnState,
  sourceCardId: string,
  selectedCards: Card[],
): void {
  applyTransmuteSwap(turnState, sourceCardId, selectedCards);
}

/**
 * Revert temporary transformed cards (transmute, conjure, mimic) back to their original form.
 * Called at encounter end.
 *
 * Cards with isTransmuted=true AND originalCard set:
 * - If originalCard.id starts with "transmute_extra_remove_": this is an extra card added by
 *   mastery 3+ transmute. Remove it entirely (do not restore).
 * - Otherwise: restore the full original card once (deduplicated by originalCard.id).
 */
export function revertTransmutedCards(deck: CardRunState): void {
  const revert = (cards: Card[]): Card[] => {
    const result: Card[] = [];
    const reverted = new Set<string>();

    for (const card of cards) {
      if (card.isTransmuted && card.originalCard) {
        const origId = card.originalCard.id;
        // Extra transmuted cards (mastery 3+ second pick) are marked with a sentinel prefix.
        // They should be removed entirely at encounter end — no original to restore.
        if (origId.startsWith('transmute_extra_remove_')) {
          // Drop the card — intentionally excluded from result
          continue;
        }
        // Restore the original card once (multiple transmuted copies share one original)
        if (!reverted.has(origId)) {
          result.push({ ...card.originalCard });
          reverted.add(origId);
        }
      } else {
        result.push(card);
      }
    }
    return result;
  };

  deck.hand = revert(deck.hand);
  deck.drawPile = revert(deck.drawPile);
  deck.discardPile = revert(deck.discardPile);
}

