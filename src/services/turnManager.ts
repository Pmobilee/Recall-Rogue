// === Turn Manager ===
// Core encounter loop for card combat.

import { get } from 'svelte/store';
import type { Card, CardRunState, CardType, PassiveEffect } from '../data/card-types';
import type { EnemyInstance } from '../data/enemies';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { CardEffectResult } from './cardEffectResolver';
import type { ActiveRelic } from '../data/passiveRelics';
import { drawHand, playCard as deckPlayCard } from './deckManager';
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
import { COMBO_MULTIPLIERS, PLAYER_START_HP, START_AP_PER_TURN, MAX_AP_PER_TURN } from '../data/balance';
import { MECHANICS_BY_TYPE } from '../data/mechanics';
import { difficultyMode } from './cardPreferences';

export type TurnPhase = 'draw' | 'player_action' | 'enemy_turn' | 'turn_end' | 'encounter_end';

export interface TurnLogEntry {
  type: 'play' | 'skip' | 'fizzle' | 'blocked' | 'enemy_action' | 'status_tick' | 'draw' | 'victory' | 'defeat';
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
  activeRelics: ActiveRelic[];
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
  overclockReady: boolean;
  slowEnemyIntent: boolean;
  foresightTurnsRemaining: number;
  persistentShield: number;
  triggeredRelicId: string | null;
  canaryEnemyDamageMultiplier: number;
  canaryQuestionBias: -1 | 0 | 1;
  result: EncounterResult;
  turnLog: TurnLogEntry[];
  /** Facts answered (correct or incorrect) during this encounter */
  encounterAnsweredFacts: string[];
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
  turnState: TurnState;
}

function buildActiveRelicIds(relics: ActiveRelic[]): Set<string> {
  return new Set(
    relics
      .filter((relic) => !relic.isDormant)
      .map((relic) => relic.definition.id),
  );
}

function getPassiveBonuses(passives: PassiveEffect[]): Partial<Record<CardType, number>> {
  const bonuses: Partial<Record<CardType, number>> = {};
  for (const passive of passives) {
    bonuses[passive.cardType] = (bonuses[passive.cardType] ?? 0) + passive.value;
  }
  return bonuses;
}

function randomCardTypeDifferentFrom(type: CardType): CardType {
  const all: CardType[] = ['attack', 'shield', 'heal', 'utility', 'buff', 'debuff', 'regen', 'wild'];
  const candidates = all.filter((candidate) => candidate !== type);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function transmuteRandomHandCard(turnState: TurnState): void {
  const { hand } = turnState.deck;
  if (hand.length === 0) return;
  const targetIndex = Math.floor(Math.random() * hand.length);
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

function applyExplorerPartialEffect(turnState: TurnState, card: Card): CardEffectResult {
  const value = Math.max(0, Math.round(card.baseEffectValue * card.effectMultiplier * 0.5));
  const effect: CardEffectResult = {
    effectType: card.cardType,
    rawValue: value,
    finalValue: value,
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

  if (card.cardType === 'attack' || card.cardType === 'wild') {
    if (value > 0) {
      const damageResult = applyDamageToEnemy(turnState.enemy, value);
      effect.damageDealt = value;
      effect.enemyDefeated = damageResult.defeated;
    }
  } else if (card.cardType === 'shield') {
    applyShield(turnState.playerState, value);
    effect.shieldApplied = value;
  } else if (card.cardType === 'heal' || card.cardType === 'regen') {
    healPlayer(turnState.playerState, value);
    effect.healApplied = value;
  }

  return effect;
}

export function startEncounter(
  deck: CardRunState,
  enemy: EnemyInstance,
  playerMaxHP?: number,
): TurnState {
  const playerState = createPlayerCombatState(playerMaxHP ?? PLAYER_START_HP);

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
    activeRelics: [],
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
    overclockReady: false,
    slowEnemyIntent: false,
    foresightTurnsRemaining: 0,
    persistentShield: 0,
    triggeredRelicId: null,
    canaryEnemyDamageMultiplier: 1,
    canaryQuestionBias: 0,
    result: null,
    turnLog: [],
    encounterAnsweredFacts: [],
  };

  drawHand(deck, initialState.baseDrawCount);
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

  turnState.activeRelicIds = buildActiveRelicIds(turnState.activeRelics);
  turnState.baseComboCount = turnState.activeRelicIds.has('combo_master') ? 1 : 0;
  if (turnState.comboCount < turnState.baseComboCount) turnState.comboCount = turnState.baseComboCount;

  const { deck, playerState, enemy } = turnState;
  const cardInHand = deck.hand.find((card) => card.id === cardId);
  if (!cardInHand) throw new Error(`Card ${cardId} not found in hand`);

  const apCost = Math.max(1, cardInHand.apCost ?? 1);
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
    const mode = get(difficultyMode);
    if (mode === 'explorer') {
      turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + apCost);
      const partialEffect = applyExplorerPartialEffect(turnState, card);
      turnState.comboCount = turnState.baseComboCount;
      turnState.cardsPlayedThisTurn += 1;
      turnState.isPerfectTurn = false;
      turnState.turnLog.push({
        type: 'play',
        message: 'Explorer mode: partial effect on wrong answer',
        cardId,
        value: partialEffect.finalValue,
      });

      if (partialEffect.enemyDefeated) {
        turnState.result = 'victory';
        turnState.phase = 'encounter_end';
        turnState.turnLog.push({ type: 'victory', message: 'Enemy defeated!' });
      }

      return {
        effect: partialEffect,
        comboCount: turnState.comboCount,
        enemyDefeated: partialEffect.enemyDefeated,
        fizzled: false,
        blocked: false,
        isPerfectTurn: false,
        turnState,
      };
    }

    if (mode === 'scholar') {
      turnState.playerState.hp = Math.max(0, turnState.playerState.hp - 3);
    }

    turnState.comboCount = turnState.baseComboCount;
    turnState.cardsPlayedThisTurn += 1;
    turnState.isPerfectTurn = false;
    turnState.turnLog.push({
      type: 'fizzle',
      message: 'Card fizzled — wrong answer',
      cardId,
    });

    const fizzledEffect: CardEffectResult = {
      ...createNoEffect(card),
      targetHit: true,
    };

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
  if (useFocus) turnState.focusReady = false;
  if (useOverclock) {
    turnState.overclockReady = false;
    turnState.pendingDrawCountOverride = 4;
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

  if (effect.healApplied > 0) healPlayer(playerState, effect.healApplied);

  if ((effect.overhealToShield ?? 0) > 0) {
    if (card.mechanicId === 'overheal' || turnState.activeRelicIds.has('overgrowth')) {
      applyShield(playerState, effect.overhealToShield ?? 0);
    }
  }

  for (const status of effect.statusesApplied) {
    applyStatusEffect(enemy.statusEffects, status);
  }

  if (effect.applyImmunity) {
    applyStatusEffect(playerState.statusEffects, {
      type: 'immunity',
      value: 1,
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
  if (effect.applyFocusBuff) turnState.focusReady = true;
  if (effect.applyOverclock) turnState.overclockReady = true;
  if (effect.applySlow) turnState.slowEnemyIntent = true;
  if (effect.applyForesight) turnState.foresightTurnsRemaining = 2;
  if (effect.applyTransmute) transmuteRandomHandCard(turnState);

  if ((effect.grantsAp ?? 0) > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + (effect.grantsAp ?? 0));
  }

  if (card.cardType === 'buff' && !effect.applyDoubleStrikeBuff && !effect.applyFocusBuff && !effect.applyOverclock) {
    turnState.buffNextCard = effect.finalValue;
  } else {
    turnState.buffNextCard = 0;
  }

  if (effect.enemyDefeated && turnState.activeRelicIds.has('bloodlust')) {
    healPlayer(playerState, 5);
    turnState.triggeredRelicId = 'bloodlust';
  }

  turnState.comboCount += 1;
  turnState.cardsPlayedThisTurn += 1;
  turnState.cardsCorrectThisTurn += 1;
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
      turnState,
    };
  }

  turnState.activeRelicIds = buildActiveRelicIds(turnState.activeRelics);
  const { playerState, enemy, deck } = turnState;

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

  let damageDealt = 0;
  let playerDefeated = false;
  const effectsApplied: StatusEffect[] = [];

  if (intentResult.damage > 0) {
    let incomingDamage = intentResult.damage;
    if (turnState.turnNumber >= 15) {
      const enrageBonus = (turnState.turnNumber - 14) * 3;
      incomingDamage += enrageBonus;
    }
    const mode = get(difficultyMode);
    if (mode === 'explorer') {
      incomingDamage = Math.round(incomingDamage * 0.7);
    } else if (mode === 'scholar') {
      incomingDamage = Math.round(incomingDamage * 1.2);
    }

    incomingDamage = Math.max(0, Math.round(incomingDamage * (turnState.canaryEnemyDamageMultiplier ?? 1)));

    if (turnState.activeRelicIds.has('glass_cannon')) {
      incomingDamage = Math.round(incomingDamage * 1.10);
      turnState.triggeredRelicId = 'glass_cannon';
    }

    const shieldBefore = playerState.shield;
    const damageResult = takeDamage(playerState, incomingDamage);
    damageDealt = incomingDamage;
    playerDefeated = damageResult.defeated;

    if (shieldBefore > 0 && turnState.activeRelicIds.has('retaliation')) {
      applyDamageToEnemy(enemy, 2);
      turnState.triggeredRelicId = 'retaliation';
    }
  }

  turnState.turnLog.push({
    type: 'enemy_action',
    message: intentSkipped ? 'Enemy action disrupted by Slow' : `Enemy uses ${enemy.nextIntent.telegraph}`,
    value: intentResult.damage,
  });

  for (const effect of intentResult.playerEffects) {
    applyStatusEffect(playerState.statusEffects, effect);
    effectsApplied.push(effect);
  }

  if (playerDefeated && turnState.activeRelicIds.has('second_wind') && !turnState.secondWindUsed) {
    playerState.hp = 1;
    playerDefeated = false;
    turnState.secondWindUsed = true;
    turnState.triggeredRelicId = 'second_wind';
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
    if (passive.cardType === 'heal' || passive.cardType === 'regen') {
      healPlayer(playerState, passive.value);
    }
  }

  if (turnState.activeRelicIds.has('momentum') && turnState.isPerfectTurn && turnState.cardsPlayedThisTurn >= 3) {
    turnState.bonusApNextTurn += 1;
    turnState.triggeredRelicId = 'momentum';
  }

  const carryShield = turnState.activeRelicIds.has('fortress')
    ? playerState.shield
    : turnState.persistentShield;
  if (turnState.activeRelicIds.has('fortress')) turnState.triggeredRelicId = 'fortress';

  resetTurnState(playerState);
  playerState.shield = Math.max(0, carryShield);
  turnState.persistentShield = 0;

  turnState.comboCount = turnState.baseComboCount;
  turnState.cardsPlayedThisTurn = 0;
  turnState.cardsCorrectThisTurn = 0;
  turnState.isPerfectTurn = false;
  turnState.buffNextCard = 0;
  turnState.lastCardType = undefined;
  turnState.damageDealtThisTurn = 0;
  turnState.firstAttackUsed = false;
  turnState.apCurrent = Math.min(turnState.apMax, START_AP_PER_TURN + turnState.bonusApNextTurn);
  turnState.bonusApNextTurn = 0;

  if (turnState.foresightTurnsRemaining > 0) {
    turnState.foresightTurnsRemaining -= 1;
  }

  rollNextIntent(enemy);
  turnState.turnNumber += 1;

  const drawCount = turnState.pendingDrawCountOverride ?? turnState.baseDrawCount;
  turnState.pendingDrawCountOverride = null;
  drawHand(deck, drawCount + turnState.bonusDrawNextTurn);
  turnState.bonusDrawNextTurn = 0;

  turnState.phase = 'player_action';
  turnState.turnLog = [];

  return {
    damageDealt,
    effectsApplied,
    playerDefeated: false,
    nextEnemyIntent: enemy.nextIntent.telegraph,
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
  const index = Math.min(comboCount, COMBO_MULTIPLIERS.length - 1);
  return COMBO_MULTIPLIERS[index];
}
