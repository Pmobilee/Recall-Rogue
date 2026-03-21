// === Turn Manager ===
// Core encounter loop for card combat.

import { get } from 'svelte/store';
import type { Card, CardRunState, CardType, PassiveEffect } from '../data/card-types';
import { isFirstChargeFree, markFirstChargeUsed, getFirstChargeWrongMultiplier } from './discoverySystem';
import { canMasteryUpgrade, canMasteryDowngrade, masteryUpgrade, masteryDowngrade, resetEncounterMasteryFlags } from './cardUpgradeService';
import { getSurgeChargeSurcharge, isSurgeTurn } from './surgeSystem';
import { resetChain, extendOrResetChain, getChainState } from './chainSystem';
import { CHAIN_MOMENTUM_ENABLED, FIRST_CHARGE_FREE_AP_SURCHARGE, RELIC_AEGIS_STONE_MAX_CARRY } from '../data/balance';
import { activeRunState } from './runStateStore';
import type { EnemyInstance } from '../data/enemies';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { CardEffectResult } from './cardEffectResolver';
import { discardHand, drawHand, playCard as deckPlayCard } from './deckManager';
import {
  createPlayerCombatState,
  applyShield,
  takeDamage,
  healPlayer,
  tickPlayerStatusEffects,
  resetTurnState,
} from './playerCombatState';
import { resolveCardEffect, isCardBlocked } from './cardEffectResolver';
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
} from '../data/balance';
import { MECHANICS_BY_TYPE, type PlayMode } from '../data/mechanics';
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
} from './relicEffectResolver';

/**
 * Calculate enrage bonus damage based on floor segment, turn number, and enemy HP.
 * Deeper floors have tighter turn budgets. Enemies below 30% HP deal extra damage.
 */
export function getEnrageBonus(turnNumber: number, floor: number, enemyHpPercent: number): number {
  const seg = ENRAGE_SEGMENTS.find(s => floor <= s.maxFloor) ?? ENRAGE_SEGMENTS[ENRAGE_SEGMENTS.length - 1];
  let bonus = 0;
  if (turnNumber >= seg.startTurn) {
    const enrageTurns = turnNumber - seg.startTurn + 1;
    if (enrageTurns <= ENRAGE_PHASE1_DURATION) {
      bonus = enrageTurns * ENRAGE_PHASE1_BONUS;
    } else {
      bonus = ENRAGE_PHASE1_DURATION * ENRAGE_PHASE1_BONUS
        + (enrageTurns - ENRAGE_PHASE1_DURATION) * ENRAGE_PHASE2_BONUS;
    }
  }
  if (enemyHpPercent < ENRAGE_LOW_HP_THRESHOLD) {
    bonus += ENRAGE_LOW_HP_BONUS;
  }
  return bonus;
}

export type TurnPhase = 'draw' | 'player_action' | 'enemy_turn' | 'turn_end' | 'encounter_end';

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
  /** Whether double_down has already been consumed this encounter. */
  doubleDownUsedThisEncounter: boolean;
  /** Whether mirror_of_knowledge has already been used this encounter (once per encounter). */
  mirrorUsedThisEncounter: boolean;
  /**
   * Chain Momentum (AR-122): when true, the next Charge play this turn costs +0 AP surcharge
   * instead of +1. Set after a correct Charge answer; consumed on the next Charge play.
   * Resets on wrong Charge, Quick Play, or turn end.
   */
  nextChargeFree: boolean;
  /**
   * Phoenix Feather post-resurrection auto-Charge turns remaining.
   * When > 0, all Charge plays are automatically treated as correct (no quiz required).
   * Set to 1 when phoenix_feather resurrection fires; decremented at end of turn.
   */
  phoenixAutoChargeTurns: number;
}

export interface PlayCardResult {
  effect: CardEffectResult;
  enemyDefeated: boolean;
  fizzled: boolean;
  blocked: boolean;
  isPerfectTurn: boolean;
  turnState: TurnState;
  /** Whether the free first Charge was used on this play. */
  usedFreeCharge: boolean;
  /** Whether this card play triggered a mastery level change. */
  masteryChange: 'upgrade' | 'downgrade' | null;
  /** The card ID that was mastery-changed (for animation targeting). */
  masteryChangedCardId: string | null;
  /** AR-202: True when a correct Charge cured a cursed fact on this play. */
  curedCursedFact?: boolean;
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
    doubleDownUsedThisEncounter: false,
    mirrorUsedThisEncounter: false,
    nextChargeFree: false,
    phoenixAutoChargeTurns: 0,
  };

  // Reset chain at encounter start (clean slate)
  resetChain();

  // Reset mastery encounter flags for all cards in all piles
  const allCards = [...deck.drawPile, ...deck.discardPile, ...deck.hand, ...deck.exhaustPile];
  resetEncounterMasteryFlags(allCards);

  const isFirstEncounter = deck.currentFloor === 1 && deck.currentEncounter <= 1;
  drawHand(deck, initialState.baseDrawCount, { firstDrawBias: isFirstEncounter });
  return initialState;
}

export function playCardAction(
  turnState: TurnState,
  cardId: string,
  answeredCorrectly: boolean,
  speedBonusEarned: boolean,
  playMode: PlayMode = 'charge',
): PlayCardResult {
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
      usedFreeCharge: false,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  const { deck, playerState, enemy } = turnState;
  const cardInHand = deck.hand.find((card) => card.id === cardId);
  if (!cardInHand) throw new Error(`Card ${cardId} not found in hand`);

  // Phoenix Feather post-resurrection: auto-Charge free for this turn.
  // Override answeredCorrectly and playMode so the card resolves as a correct Charge.
  if (turnState.phoenixAutoChargeTurns > 0 && playMode === 'charge') {
    answeredCorrectly = true;
  }

  let apCost = Math.max(0, cardInHand.apCost ?? 1);

  // Charge AP surcharge: +1 AP for Charge plays.
  // Waived during Surge turns (every 3rd turn), for Free First Charge, or by Chain Momentum.
  let usedFreeCharge = false;
  if (playMode === 'charge') {
    const runStateForCharge = get(activeRunState);
    const isSurge = getSurgeChargeSurcharge(turnState.turnNumber) === 0;
    if (isSurge) {
      // Surge turns: no surcharge (already 0)
      // Chain Momentum flag still applies (consumed below) but has no additional AP effect
      if (CHAIN_MOMENTUM_ENABLED && turnState.nextChargeFree) {
        turnState.nextChargeFree = false; // consume the flag even on Surge
      }
    } else if (CHAIN_MOMENTUM_ENABLED && turnState.nextChargeFree) {
      // Chain Momentum: previous correct Charge waived this surcharge
      turnState.nextChargeFree = false; // consume the flag
      // surcharge is 0 — no apCost increase
    } else if (cardInHand.factId && runStateForCharge && isFirstChargeFree(cardInHand.factId, runStateForCharge.firstChargeFreeFactIds)) {
      // Free first Charge: AP surcharge is 0
      apCost += FIRST_CHARGE_FREE_AP_SURCHARGE;
      usedFreeCharge = true;
    } else {
      // Normal Charge: +1 AP surcharge
      apCost += 1;
    }
  } else if (playMode === 'quick') {
    // Quick Play: momentum lost
    if (CHAIN_MOMENTUM_ENABLED) {
      turnState.nextChargeFree = false;
    }
  }

  // Focus: reduce this card's AP cost by 1 (minimum 0); consume one focus charge
  if (turnState.focusReady && turnState.focusCharges > 0 && apCost > 0) {
    apCost = Math.max(0, apCost - 1);
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
      usedFreeCharge: false,
      masteryChange: null,
      masteryChangedCardId: null,
    };
  }

  const card: Card = { ...cardInHand };
  // AR-202: Capture mastery level BEFORE any downgrade so curse condition uses pre-play value.
  const preMasteryLevel = cardInHand.masteryLevel ?? 0;
  deckPlayCard(deck, cardId);
  turnState.apCurrent = Math.max(0, turnState.apCurrent - apCost);

  // Track answered fact for encounter cooldown
  if (cardInHand.factId) {
    turnState.encounterAnsweredFacts.push(cardInHand.factId);
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
      usedFreeCharge: false,
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

    // Wrong Charge: break the chain and lose momentum
    if (playMode === 'charge') {
      extendOrResetChain(null); // null chainType resets chain
      const chainState = getChainState();
      turnState.chainMultiplier = 1.0;
      turnState.chainLength = chainState.length;
      turnState.chainType = chainState.chainType;
      // Chain Momentum: wrong Charge answer loses momentum
      if (CHAIN_MOMENTUM_ENABLED) {
        turnState.nextChargeFree = false;
      }
    }

    const mode = get(difficultyMode);
    if (mode === 'relaxed') {
      // AP is NOT refunded — wrong answers always cost AP regardless of mode
      const fizzledEffect = createNoEffect(card);
      turnState.consecutiveCorrectThisEncounter = 0;
      turnState.cardsPlayedThisTurn += 1;
      turnState.isPerfectTurn = false;

      // Mastery downgrade: wrong charge answer downgrades the played card
      let masteryChangeRelaxed: 'upgrade' | 'downgrade' | null = null;
      let masteryChangedCardIdRelaxed: string | null = null;
      if (playMode !== 'quick') {
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
        enemy.template.onPlayerChargeWrong(ctx);
        const mirrorDmg = (ctx as any)._mirrorDamage as number | undefined;
        if (mirrorDmg && mirrorDmg > 0) {
          turnState.playerState.hp = Math.max(0, turnState.playerState.hp - mirrorDmg);
        }
      }

      // Free First Charge: mark as used after resolution (win or lose)
      if (usedFreeCharge && card.factId) {
        const runState = get(activeRunState);
        if (runState) {
          markFirstChargeUsed(card.factId, runState.firstChargeFreeFactIds);
          activeRunState.set(runState);
        }
      }

      // AR-202: Curse logic — relaxed mode wrong Charge on mastery 0 card.
      // Free First Charge wrongs are EXEMPT. Mastery 1+ wrongs only downgrade.
      if (playMode === 'charge' && !usedFreeCharge && preMasteryLevel === 0 && card.factId) {
        const runState = get(activeRunState);
        if (runState) {
          runState.cursedFactIds.add(card.factId);
          activeRunState.set(runState);
        }
      }

      turnState.turnLog.push({
        type: 'fizzle',
        message: 'Relaxed mode: card fizzled',
        cardId,
      });

      return {
        effect: fizzledEffect,
        enemyDefeated: false,
        fizzled: true,
        blocked: false,
        isPerfectTurn: false,
        turnState,
        usedFreeCharge,
        masteryChange: masteryChangeRelaxed,
        masteryChangedCardId: masteryChangedCardIdRelaxed,
      };
    }


    turnState.consecutiveCorrectThisEncounter = 0;
    turnState.cardsPlayedThisTurn += 1;
    turnState.isPerfectTurn = false;

    // Mastery downgrade: wrong charge answer downgrades the played card
    let masteryChangeWrong: 'upgrade' | 'downgrade' | null = null;
    let masteryChangedCardIdWrong: string | null = null;
    if (playMode !== 'quick') {
      const discardedCard = turnState.deck.discardPile.find(c => c.id === cardId);
      if (discardedCard && canMasteryDowngrade(discardedCard)) {
        masteryDowngrade(discardedCard);
        masteryChangeWrong = 'downgrade';
        masteryChangedCardIdWrong = cardId;
      }
    }

    // Partial fizzle: wrong answers still apply a fraction of the base effect.
    // Exception: Free First Charge on wrong answer uses 0.0× (FIRST_CHARGE_FREE_WRONG_MULTIPLIER),
    // card fizzles entirely — the cost of guessing wrong on an unknown fact.
    const wrongMultiplier = (usedFreeCharge && playMode === 'charge')
      ? getFirstChargeWrongMultiplier()  // 0.0× — total fizzle
      : getBalanceValue('fizzleEffectRatio', FIZZLE_EFFECT_RATIO);  // 0.25× normally
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
      enemy.template.onPlayerChargeWrong(ctx);
      const mirrorDmg = (ctx as any)._mirrorDamage as number | undefined;
      if (mirrorDmg && mirrorDmg > 0) {
        turnState.playerState.hp = Math.max(0, turnState.playerState.hp - mirrorDmg);
      }
    }

    // Free First Charge: mark as used after resolution (win or lose)
    if (usedFreeCharge && card.factId) {
      const runState = get(activeRunState);
      if (runState) {
        markFirstChargeUsed(card.factId, runState.firstChargeFreeFactIds);
        activeRunState.set(runState);
      }
    }

    // AR-202: Curse logic — normal mode wrong Charge on mastery 0 card.
    // Free First Charge wrongs are EXEMPT. Mastery 1+ wrongs only downgrade (curse on next wrong at 0).
    if (playMode === 'charge' && !usedFreeCharge && preMasteryLevel === 0 && card.factId) {
      const runState = get(activeRunState);
      if (runState) {
        runState.cursedFactIds.add(card.factId);
        activeRunState.set(runState);
      }
    }

    const wrongPct = Math.round(wrongMultiplier * 100);
    turnState.turnLog.push({
      type: 'fizzle',
      message: usedFreeCharge
        ? `Free Charge: wrong answer (${wrongPct}% effect — no penalty for trying)`
        : `Card fizzled — wrong answer (${wrongPct}% effect applied)`,
      cardId,
    });

    return {
      effect: fizzledEffect,
      enemyDefeated: fizzledEffect.enemyDefeated,
      fizzled: true,
      blocked: false,
      isPerfectTurn: false,
      turnState,
      usedFreeCharge,
      masteryChange: masteryChangeWrong,
      masteryChangedCardId: masteryChangedCardIdWrong,
    };
  }

  // Update Knowledge Chain state for this card play.
  // Charge (correct): extend/reset chain based on chainType, get multiplier.
  // Quick Play: break the chain (no chain bonus from Quick Play).
  let currentChainMultiplier = 1.0;
  if (playMode === 'charge') {
    currentChainMultiplier = extendOrResetChain(card.chainType);
    // prismatic_shard — all chain multipliers +0.5x
    currentChainMultiplier += resolveChainMultiplierBonus(turnState.activeRelicIds);
  } else {
    // Quick Play breaks the chain
    extendOrResetChain(null);
  }
  const chainState = getChainState();
  turnState.chainMultiplier = currentChainMultiplier;
  turnState.chainLength = chainState.length;
  turnState.chainType = chainState.chainType;

  // prismatic_shard — +1 AP on 5-chain completion
  const prismaticApBonus = resolvePrismaticShardApBonus(turnState.activeRelicIds, chainState.length);
  if (prismaticApBonus > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + prismaticApBonus);
  }

  const speedBonus = speedBonusEarned ? 1.5 : 1.0;
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
    },
  );

  if (card.cardType === 'attack') turnState.firstAttackUsed = true;
  if (useDoubleStrike && card.cardType === 'attack') turnState.doubleStrikeReady = false;
  if (useFocus) {
    turnState.focusCharges = Math.max(0, turnState.focusCharges - 1);
    if (turnState.focusCharges === 0) turnState.focusReady = false;
  }
  if (useOverclock) {
    turnState.overclockReady = false;
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
    const chargeFx = resolveChargeCorrectEffects(turnState.activeRelicIds, {
      answerTimeMs: 9999, // timing not available here; speed relics handled upstream
      cardTier: cardTierNum,
      cardType: cardTypeForRelic,
      isFirstChargeThisTurn: turnState.cardsCorrectThisTurn === 0,
      chargeCountThisEncounter: turnState.consecutiveCorrectThisEncounter + 1,
      mirrorUsedThisEncounter: turnState.mirrorUsedThisEncounter,
      adrenalineShard_usedThisTurn: false, // adrenaline_shard handled upstream
    });

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
  if (effect.damageDealt > 0 && playMode === 'quick' && enemy.template.quickPlayDamageMultiplier !== undefined) {
    effect.damageDealt = Math.max(1, Math.round(effect.damageDealt * enemy.template.quickPlayDamageMultiplier));
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
      for (let i = 0; i < hitCount; i++) {
        let hitDamage = perHitBase;
        const burnResult = triggerBurn(enemy.statusEffects);
        if (burnResult.bonusDamage > 0) {
          hitDamage += burnResult.bonusDamage;
          turnState.turnLog.push({
            type: 'status_tick',
            message: `Burn (hit ${i + 1}): +${burnResult.bonusDamage} damage (${burnResult.stacksAfter} stacks remaining)`,
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
  }

  if (effect.shieldApplied > 0) applyShield(playerState, effect.shieldApplied);
  if (effect.shieldApplied > 0 && turnState.ascensionShieldCardMultiplier !== 1) {
    const adjustedShield = Math.max(0, Math.round(effect.shieldApplied * turnState.ascensionShieldCardMultiplier));
    const delta = adjustedShield - effect.shieldApplied;
    if (delta !== 0) {
      applyShield(playerState, delta);
      effect.shieldApplied = adjustedShield;
      effect.finalValue = adjustedShield;
    }
  }

  if (effect.healApplied > 0) healPlayer(playerState, effect.healApplied);

  if ((effect.overhealToShield ?? 0) > 0) {
    if (card.mechanicId === 'overheal') {
      applyShield(playerState, effect.overhealToShield ?? 0);
    }
  }

  for (const status of effect.statusesApplied) {
    applyStatusEffect(enemy.statusEffects, status);
  }

  // AR-203: Apply Burn stacks to enemy from card effects (e.g. ignite mechanic).
  // turnsRemaining: 99 = sentinel (Burn expires by halving to 0, not by turn countdown).
  if ((effect.applyBurnStacks ?? 0) > 0) {
    applyStatusEffect(enemy.statusEffects, {
      type: 'burn',
      value: effect.applyBurnStacks!,
      turnsRemaining: 99,
    });
  }
  // AR-203: Apply Bleed stacks to enemy from card effects (e.g. lacerate mechanic).
  // turnsRemaining: 99 = sentinel (Bleed expires by decay at end of enemy turn, not countdown).
  if ((effect.applyBleedStacks ?? 0) > 0) {
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
    turnState.focusReady = true;
    turnState.focusCharges = effect.focusCharges ?? 1;
  }
  if (effect.applyOverclock) turnState.overclockReady = true;
  if (effect.applySlow) turnState.slowEnemyIntent = true;
  if (effect.applyForesight) turnState.foresightTurnsRemaining = 2;
  if (effect.applyTransmute) transmuteWeakestHandCard(turnState);

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

  if ((effect.grantsAp ?? 0) > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + (effect.grantsAp ?? 0));
  }

  if (card.cardType === 'buff' && !effect.applyDoubleStrikeBuff && !effect.applyFocusBuff && !effect.applyOverclock) {
    turnState.buffNextCard = effect.finalValue;
  } else {
    turnState.buffNextCard = 0;
  }

  // Store last resolved effect for mirror
  turnState.lastCardEffect = { ...effect };

  turnState.cardsPlayedThisTurn += 1;
  if (playMode !== 'quick') {
    turnState.cardsCorrectThisTurn += 1;
    turnState.consecutiveCorrectThisEncounter += 1;
    // Chain Momentum (AR-122): correct Charge earns a free surcharge on the NEXT Charge this turn
    if (playMode === 'charge' && CHAIN_MOMENTUM_ENABLED) {
      turnState.nextChargeFree = true;
    }
  }
  turnState.isPerfectTurn = (
    turnState.cardsCorrectThisTurn > 0 &&
    turnState.cardsCorrectThisTurn === turnState.cardsPlayedThisTurn
  );
  turnState.lastCardType = effect.effectType;

  // AR-202: Cure cursed fact on correct Charge.
  // If the card's fact is in cursedFactIds, remove it (cure). Mark on result for UI animation.
  let curedCursedFact = false;
  if (playMode === 'charge' && card.factId) {
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

  // Free First Charge: mark as used after successful Charge resolution.
  // Tier 3 auto-Charge does NOT consume the free Charge (player didn't consciously Charge it).
  if (usedFreeCharge && card.factId && card.tier !== '3') {
    const runState = get(activeRunState);
    if (runState) {
      markFirstChargeUsed(card.factId, runState.firstChargeFreeFactIds);
      activeRunState.set(runState);
    }
  }

  return {
    effect,
    enemyDefeated: effect.enemyDefeated,
    fizzled: false,
    blocked: false,
    isPerfectTurn: turnState.isPerfectTurn,
    turnState,
    usedFreeCharge,
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

  // Step 5d (AR-59.13): Reset playerChargedThisTurn for the next player turn
  enemy.playerChargedThisTurn = false;

  // Step 4 (AR-59.13): Dispatch onEnemyTurnStart for enrage logic (Timer Wyrm)
  dispatchEnemyTurnStart(enemy, turnState.turnNumber);

  // Block decays each turn — enemy must re-defend to maintain it (STS-style)
  enemy.block = 0;

  let intentResult = { damage: 0, playerEffects: [] as StatusEffect[], enemyHealed: 0 };
  let intentSkipped = false;
  if (
    turnState.slowEnemyIntent &&
    (enemy.nextIntent.type === 'defend' || enemy.nextIntent.type === 'buff')
  ) {
    intentSkipped = true;
    turnState.slowEnemyIntent = false;
  } else {
    intentResult = executeEnemyIntent(enemy);
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
    const mode = get(difficultyMode);
    if (mode === 'relaxed') {
      incomingDamage = Math.round(incomingDamage * 0.7);
    }

    incomingDamage = Math.max(
      0,
      Math.round(
        incomingDamage *
        (turnState.ascensionEnemyDamageMultiplier ?? 1) *
        (turnState.canaryEnemyDamageMultiplier ?? 1),
      ),
    );

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
  }

  // Reset thorns retaliation after the attack phase
  turnState.thornsActive = false;
  turnState.thornsValue = 0;

  turnState.turnLog.push({
    type: 'enemy_action',
    message: intentSkipped ? 'Enemy action disrupted by Slow' : `Enemy uses ${enemy.nextIntent.telegraph}`,
    value: intentResult.damage,
  });

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
    turnState.turnLog.push({
      type: 'status_tick',
      message: `Poison dealt ${playerTick.poisonDamage} damage`,
      value: playerTick.poisonDamage,
    });
  }

  if (playerTick.regenHeal > 0) {
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
    turnState.turnLog.push({
      type: 'status_tick',
      message: `Enemy took ${enemyTick.poisonDamage} poison damage`,
      value: enemyTick.poisonDamage,
    });
  }

  // AR-203: Bleed decays by BLEED_DECAY_PER_TURN at end of each enemy turn.
  // Happens AFTER the Poison tick so Bleed does not amplify Poison damage.
  // Bleed only triggers on card-play damage (effect.damageDealt path), not passive damage.
  const bleedEffect = enemy.statusEffects.find(e => e.type === 'bleed');
  if (bleedEffect) {
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
  });
  const carryShield = turnEndFx.blockCarries
    ? playerState.shield
    : turnState.persistentShield;
  if (turnEndFx.blockCarries) turnState.triggeredRelicId = 'fortress_wall';

  if (turnEndFx.bonusApFromAfterimage > 0) {
    turnState.bonusApNextTurn += turnEndFx.bonusApFromAfterimage;
    turnState.triggeredRelicId = 'afterimage';
  }

  resetTurnState(playerState);
  playerState.shield = Math.max(0, carryShield);
  turnState.persistentShield = 0;

  // aegis_stone: if carrying 15+ block into next turn, grant Thorns 2 for the next enemy attack
  if (turnEndFx.blockCarries && turnState.activeRelicIds.has('aegis_stone') && playerState.shield >= RELIC_AEGIS_STONE_MAX_CARRY) {
    turnState.thornsActive = true;
    turnState.thornsValue = 2;
  }

  turnState.cardsPlayedThisTurn = 0;
  turnState.cardsCorrectThisTurn = 0;
  turnState.isPerfectTurn = false;
  turnState.buffNextCard = 0;
  turnState.lastCardType = undefined;
  turnState.lastCardEffect = null;
  turnState.damageDealtThisTurn = 0;
  turnState.firstAttackUsed = false;
  turnState.apCurrent = Math.min(turnState.apMax, START_AP_PER_TURN + turnState.bonusApNextTurn);
  turnState.bonusApNextTurn = 0;

  // Capture chainType BEFORE reset — used by tag_magnet to bias the next draw
  const chainTypeBeforeReset = turnState.chainType;

  // Reset Knowledge Chain at start of each new player turn
  resetChain();
  turnState.chainMultiplier = 1.0;
  turnState.chainLength = 0;
  turnState.chainType = null;

  // Chain Momentum: reset on turn end
  turnState.nextChargeFree = false;

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
  turnState.turnNumber += 1;
  turnState.encounterTurnNumber += 1;
  turnState.isSurge = isSurgeTurn(turnState.turnNumber);

  const discardedAtTurnEnd = discardHand(deck);
  if (discardedAtTurnEnd.length > 0) {
    turnState.turnLog.push({
      type: 'draw',
      message: `Discarded ${discardedAtTurnEnd.length} unplayed card${discardedAtTurnEnd.length === 1 ? '' : 's'}`,
      value: discardedAtTurnEnd.length,
    });
  }

  const drawCount = turnState.pendingDrawCountOverride ?? turnState.baseDrawCount;
  turnState.pendingDrawCountOverride = null;

  // tag_magnet relic: bias draw toward last turn's chain type
  const drawBias = resolveDrawBias(turnState.activeRelicIds, chainTypeBeforeReset ?? undefined);
  const tagMagnetBias = drawBias.biasChainType !== null
    ? { chainType: drawBias.biasChainType, chance: drawBias.biasChance }
    : undefined;
  drawHand(deck, drawCount + turnState.bonusDrawNextTurn, { tagMagnetBias });
  turnState.bonusDrawNextTurn = 0;

  turnState.phase = 'player_action';
  turnState.turnLog = [];

  // Turn-start relic effects (iron_buckler: +3 block per turn; blood_price: +1 AP)
  const turnStartFx = resolveTurnStartEffects(turnState.activeRelicIds);
  if (turnStartFx.bonusBlock > 0) {
    applyShield(playerState, turnStartFx.bonusBlock);
    turnState.triggeredRelicId = 'iron_buckler';
  }
  if (turnStartFx.bonusAP > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + turnStartFx.bonusAP);
    turnState.triggeredRelicId = 'blood_price';
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

