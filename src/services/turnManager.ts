// === Turn Manager ===
// Core encounter loop for card combat.

import { get } from 'svelte/store';
import type { Card, CardRunState, CardType, PassiveEffect } from '../data/card-types';
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
import { applyDamageToEnemy, executeEnemyIntent, rollNextIntent, tickEnemyStatusEffects } from './enemyManager';
import { applyStatusEffect } from '../data/statusEffects';
import { hasSynergy, getMasteryAscensionBonus } from './relicSynergyResolver';
import {
  COMBO_MULTIPLIERS,
  COMBO_HEAL_THRESHOLD,
  COMBO_HEAL_AMOUNT,
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
} from '../data/balance';
import { MECHANICS_BY_TYPE } from '../data/mechanics';
import { difficultyMode } from './cardPreferences';
import {
  resolveDamageTakenEffects,
  resolveLethalEffects,
  resolvePerfectTurnBonus,
  resolveTurnEndEffects,
  resolveTurnStartEffects,
  resolveComboStartValue,
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
  turnNumber: number;
  playerState: PlayerCombatState;
  enemy: EnemyInstance;
  deck: CardRunState;
  comboCount: number;
  baseComboCount: number;
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
  ascensionComboResetsOnTurnEnd: boolean;
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
}

export interface PlayCardResult {
  effect: CardEffectResult;
  comboCount: number;
  enemyDefeated: boolean;
  fizzled: boolean;
  blocked: boolean;
  isPerfectTurn: boolean;
  turnState: TurnState;
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
): TurnState {
  const playerState = createPlayerCombatState(playerMaxHP ?? getBalanceValue('playerStartHP', PLAYER_START_HP));

  const initialState: TurnState = {
    phase: 'player_action',
    turnNumber: 1,
    playerState,
    enemy,
    deck,
    comboCount: 0,
    baseComboCount: 0,
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
    ascensionComboResetsOnTurnEnd: false,
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
  };

  const isFirstEncounter = deck.currentFloor === 1 && deck.currentEncounter <= 1;
  drawHand(deck, initialState.baseDrawCount, { firstDrawBias: isFirstEncounter });
  return initialState;
}

export function playCardAction(
  turnState: TurnState,
  cardId: string,
  answeredCorrectly: boolean,
  speedBonusEarned: boolean,
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
      comboCount: turnState.comboCount,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
    };
  }

  turnState.baseComboCount = resolveComboStartValue(turnState.activeRelicIds);
  if (turnState.comboCount < turnState.baseComboCount) turnState.comboCount = turnState.baseComboCount;

  const { deck, playerState, enemy } = turnState;
  const cardInHand = deck.hand.find((card) => card.id === cardId);
  if (!cardInHand) throw new Error(`Card ${cardId} not found in hand`);

  let apCost = Math.max(0, cardInHand.apCost ?? 1);
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
      comboCount: turnState.comboCount,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: turnState.isPerfectTurn,
      turnState,
    };
  }

  const card: Card = { ...cardInHand };
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
      comboCount: turnState.comboCount,
      enemyDefeated: false,
      fizzled: false,
      blocked: true,
      isPerfectTurn: false,
      turnState,
    };
  }

  if (!answeredCorrectly) {
    if (turnState.ascensionWrongAnswerSelfDamage > 0) {
      turnState.playerState.hp = Math.max(0, turnState.playerState.hp - turnState.ascensionWrongAnswerSelfDamage);
    }

    const mode = get(difficultyMode);
    if (mode === 'relaxed') {
      // AP is NOT refunded — wrong answers always cost AP regardless of mode
      const fizzledEffect = createNoEffect(card);
      turnState.comboCount = turnState.baseComboCount;
      turnState.consecutiveCorrectThisEncounter = 0;
      turnState.cardsPlayedThisTurn += 1;
      turnState.isPerfectTurn = false;
      turnState.turnLog.push({
        type: 'fizzle',
        message: 'Relaxed mode: card fizzled',
        cardId,
      });

      return {
        effect: fizzledEffect,
        comboCount: turnState.comboCount,
        enemyDefeated: false,
        fizzled: true,
        blocked: false,
        isPerfectTurn: false,
        turnState,
      };
    }


    turnState.comboCount = turnState.baseComboCount;
    turnState.consecutiveCorrectThisEncounter = 0;
    turnState.cardsPlayedThisTurn += 1;
    turnState.isPerfectTurn = false;

    // Partial fizzle: wrong answers still apply a fraction of the base effect
    const fizzleBase = Math.round(card.baseEffectValue * getBalanceValue('fizzleEffectRatio', FIZZLE_EFFECT_RATIO));
    const fizzledEffect: CardEffectResult = {
      ...createNoEffect(card),
      targetHit: true,
      rawValue: fizzleBase,
      finalValue: fizzleBase,
      damageDealt: (card.cardType === 'attack' || card.cardType === 'wild') ? fizzleBase : 0,
      shieldApplied: card.cardType === 'shield' ? fizzleBase : 0,
      healApplied: 0,
    };

    // Apply partial fizzle effects to game state
    if (fizzledEffect.damageDealt > 0) {
      const damageResult = applyDamageToEnemy(enemy, fizzledEffect.damageDealt);
      fizzledEffect.enemyDefeated = damageResult.defeated;
      turnState.damageDealtThisTurn += fizzledEffect.damageDealt;
    }
    if (fizzledEffect.shieldApplied > 0) applyShield(playerState, fizzledEffect.shieldApplied);
    if (fizzledEffect.healApplied > 0) healPlayer(playerState, fizzledEffect.healApplied);

    turnState.turnLog.push({
      type: 'fizzle',
      message: `Card fizzled — wrong answer (${Math.round(getBalanceValue('fizzleEffectRatio', FIZZLE_EFFECT_RATIO) * 100)}% effect applied)`,
      cardId,
    });

    return {
      effect: fizzledEffect,
      comboCount: turnState.comboCount,
      enemyDefeated: fizzledEffect.enemyDefeated,
      fizzled: true,
      blocked: false,
      isPerfectTurn: false,
      turnState,
    };
  }

  const speedBonus = speedBonusEarned ? 1.5 : 1.0;
  const useDoubleStrike = turnState.doubleStrikeReady && card.cardType === 'attack';
  const useFocus = turnState.focusReady;
  const useOverclock = turnState.overclockReady;

  const effect = resolveCardEffect(
    card,
    playerState,
    enemy,
    turnState.comboCount,
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

  if (effect.damageDealt > 0) {
    const damageResult = applyDamageToEnemy(enemy, effect.damageDealt);
    effect.enemyDefeated = damageResult.defeated;
    turnState.damageDealtThisTurn += effect.damageDealt;
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

  turnState.comboCount += 1;

  // Combo heal: at threshold+ consecutive correct, heal per correct answer
  if (turnState.comboCount >= COMBO_HEAL_THRESHOLD) {
    turnState.playerState.hp = Math.min(turnState.playerState.maxHP, turnState.playerState.hp + COMBO_HEAL_AMOUNT);
    turnState.turnLog.push({
      type: 'heal',
      message: 'Combo heal! +1 HP',
      value: COMBO_HEAL_AMOUNT,
    });
  }

  turnState.cardsPlayedThisTurn += 1;
  turnState.cardsCorrectThisTurn += 1;
  turnState.consecutiveCorrectThisEncounter += 1;
  turnState.isPerfectTurn = (
    turnState.cardsPlayedThisTurn > 0 &&
    turnState.cardsCorrectThisTurn === turnState.cardsPlayedThisTurn
  );
  turnState.lastCardType = effect.effectType;

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

  return {
    effect,
    comboCount: turnState.comboCount,
    enemyDefeated: effect.enemyDefeated,
    fizzled: false,
    blocked: false,
    isPerfectTurn: turnState.isPerfectTurn,
    turnState,
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
    const enrageBonus = getEnrageBonus(turnState.turnNumber, currentFloor, enemyHpPercent);
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
      phoenixUsedThisEncounter: false,
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

  const enemyTick = tickEnemyStatusEffects(enemy);
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

  // Combo persists across turns, resets on wrong answer or explorer fizzle.
  // Ascension 14+ (Combo Breaker): combo also resets on turn end.
  if (turnState.ascensionComboResetsOnTurnEnd) {
    turnState.comboCount = turnState.baseComboCount;
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

  if (turnState.foresightTurnsRemaining > 0) {
    turnState.foresightTurnsRemaining -= 1;
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
  drawHand(deck, drawCount + turnState.bonusDrawNextTurn);
  turnState.bonusDrawNextTurn = 0;

  turnState.phase = 'player_action';
  turnState.turnLog = [];

  // Turn-start relic effects (iron_buckler: +3 block per turn)
  const turnStartFx = resolveTurnStartEffects(turnState.activeRelicIds);
  if (turnStartFx.bonusBlock > 0) {
    applyShield(playerState, turnStartFx.bonusBlock);
    turnState.triggeredRelicId = 'iron_buckler';
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

export function getComboMultiplier(comboCount: number): number {
  const multipliers = getBalanceValue('comboMultipliers', COMBO_MULTIPLIERS);
  const index = Math.min(comboCount, multipliers.length - 1);
  return multipliers[index];
}
