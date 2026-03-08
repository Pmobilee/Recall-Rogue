// === Turn Manager ===
// Core encounter loop for the card roguelite.
// Manages the draw → play → enemy → end turn cycle.
// NO Phaser, Svelte, or DOM imports.

import type { Card, CardRunState, CardType } from '../data/card-types';
import type { EnemyInstance } from '../data/enemies';
import type { StatusEffect } from '../data/statusEffects';
import type { PlayerCombatState } from './playerCombatState';
import type { CardEffectResult } from './cardEffectResolver';
import { drawHand, playCard as deckPlayCard } from './deckManager';
import { createPlayerCombatState, applyShield, takeDamage, healPlayer, tickPlayerStatusEffects, resetTurnState } from './playerCombatState';
import { resolveCardEffect, isCardBlocked } from './cardEffectResolver';
import { applyDamageToEnemy, executeEnemyIntent, rollNextIntent, tickEnemyStatusEffects } from './enemyManager';
import { applyStatusEffect } from '../data/statusEffects';
import { PLAYER_START_HP, COMBO_MULTIPLIERS } from '../data/balance';

/** The current phase of a turn in the encounter. */
export type TurnPhase = 'draw' | 'player_action' | 'enemy_turn' | 'turn_end' | 'encounter_end';

/** A single log entry for turn events. */
export interface TurnLogEntry {
  /** The type of event. */
  type: 'play' | 'skip' | 'fizzle' | 'blocked' | 'enemy_action' | 'status_tick' | 'draw' | 'victory' | 'defeat';
  /** Human-readable description of the event. */
  message: string;
  /** Optional numeric value associated with the event. */
  value?: number;
  /** Optional card ID associated with the event. */
  cardId?: string;
}

/** The result type for encounter conclusion. */
export type EncounterResult = 'victory' | 'defeat' | null;

/** Full state of a turn in progress. */
export interface TurnState {
  /** Current turn phase. */
  phase: TurnPhase;
  /** Turn number (1-indexed, increments each full turn cycle). */
  turnNumber: number;
  /** The player's combat state for this encounter. */
  playerState: PlayerCombatState;
  /** The enemy being fought. */
  enemy: EnemyInstance;
  /** The deck state. */
  deck: CardRunState;
  /** Current combo count (consecutive correct answers). */
  comboCount: number;
  /** Number of cards played this turn. */
  cardsPlayedThisTurn: number;
  /** Number of correct answers this turn. */
  cardsCorrectThisTurn: number;
  /** True if all played cards this turn were answered correctly. */
  isPerfectTurn: boolean;
  /** Percentage buff accumulated from buff cards for the next card. */
  buffNextCard: number;
  /** The card type of the last card played (for wild resolution). */
  lastCardType?: CardType;
  /** Encounter result (null while in progress). */
  result: EncounterResult;
  /** Log of events for the current turn. */
  turnLog: TurnLogEntry[];
}

/** Result of playing a card. */
export interface PlayCardResult {
  /** The resolved card effect. */
  effect: CardEffectResult;
  /** Updated combo count. */
  comboCount: number;
  /** Whether the enemy was defeated by this card. */
  enemyDefeated: boolean;
  /** Whether the card fizzled (wrong answer). */
  fizzled: boolean;
  /** Whether the card was blocked (domain immunity). */
  blocked: boolean;
  /** Whether this is a perfect turn (all cards correct so far). */
  isPerfectTurn: boolean;
  /** The updated turn state. */
  turnState: TurnState;
}

/** Result of the enemy's turn. */
export interface EnemyTurnResult {
  /** Damage dealt to the player. */
  damageDealt: number;
  /** Status effects applied to the player. */
  effectsApplied: StatusEffect[];
  /** Whether the player was defeated. */
  playerDefeated: boolean;
  /** The enemy's next telegraphed intent. */
  nextEnemyIntent: string;
  /** The updated turn state. */
  turnState: TurnState;
}

/**
 * Starts a new encounter by creating player state, drawing a hand, and
 * setting up the initial turn state.
 *
 * @param deck - The card run state (mutated: hand is drawn).
 * @param enemy - The enemy instance to fight.
 * @param playerMaxHP - Optional max HP override.
 * @returns The initial TurnState with phase='player_action'.
 */
export function startEncounter(
  deck: CardRunState,
  enemy: EnemyInstance,
  playerMaxHP?: number,
): TurnState {
  const playerState = createPlayerCombatState(playerMaxHP ?? PLAYER_START_HP);
  drawHand(deck);

  return {
    phase: 'player_action',
    turnNumber: 1,
    playerState,
    enemy,
    deck,
    comboCount: 0,
    cardsPlayedThisTurn: 0,
    cardsCorrectThisTurn: 0,
    isPerfectTurn: false,
    buffNextCard: 0,
    lastCardType: undefined,
    result: null,
    turnLog: [],
  };
}

/**
 * Plays a card from the player's hand.
 *
 * - If answeredCorrectly: resolves effect, applies results, increments combo.
 * - If wrong: fizzles, resets combo to 0.
 * - If blocked (domain immunity): no effect, no combo change.
 *
 * @param turnState - The current turn state (mutated in place).
 * @param cardId - The ID of the card to play.
 * @param answeredCorrectly - Whether the quiz question was answered correctly.
 * @param speedBonusEarned - Whether the speed bonus was earned (1.5x if true).
 * @returns The play card result.
 */
export function playCardAction(
  turnState: TurnState,
  cardId: string,
  answeredCorrectly: boolean,
  speedBonusEarned: boolean,
): PlayCardResult {
  const { deck, playerState, enemy } = turnState;

  // Find the card in hand before moving it
  const cardInHand = deck.hand.find(c => c.id === cardId);
  if (!cardInHand) {
    throw new Error(`Card ${cardId} not found in hand`);
  }

  // Make a copy of card data before deck manipulation moves it
  const card: Card = { ...cardInHand };

  // Move card from hand to discard via deckManager
  deckPlayCard(deck, cardId);

  const speedBonus = speedBonusEarned ? 1.5 : 1.0;

  // Check if blocked
  if (isCardBlocked(card, enemy)) {
    turnState.cardsPlayedThisTurn += 1;
    turnState.turnLog.push({
      type: 'blocked',
      message: `${card.cardType} card blocked by enemy immunity`,
      cardId,
    });

    const blockedEffect: CardEffectResult = {
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
    };

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

  // Check if fizzled (wrong answer)
  if (!answeredCorrectly) {
    turnState.comboCount = 0;
    turnState.cardsPlayedThisTurn += 1;
    turnState.turnLog.push({
      type: 'fizzle',
      message: `Card fizzled — wrong answer`,
      cardId,
    });

    const fizzledEffect: CardEffectResult = {
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
    };

    turnState.isPerfectTurn = false;

    return {
      effect: fizzledEffect,
      comboCount: 0,
      enemyDefeated: false,
      fizzled: true,
      blocked: false,
      isPerfectTurn: false,
      turnState,
    };
  }

  // Resolve the card effect
  const effect = resolveCardEffect(
    card,
    playerState,
    enemy,
    turnState.comboCount,
    speedBonus,
    turnState.buffNextCard,
    turnState.lastCardType,
  );

  // Apply results
  let enemyDefeated = false;

  if (effect.damageDealt > 0) {
    const dmgResult = applyDamageToEnemy(enemy, effect.damageDealt);
    enemyDefeated = dmgResult.defeated;
  }

  if (effect.shieldApplied > 0) {
    applyShield(playerState, effect.shieldApplied);
  }

  if (effect.healApplied > 0) {
    healPlayer(playerState, effect.healApplied);
  }

  for (const status of effect.statusesApplied) {
    applyStatusEffect(enemy.statusEffects, status);
  }

  if (effect.extraCardsDrawn > 0) {
    drawHand(deck, effect.extraCardsDrawn);
  }

  // Update turn state
  turnState.comboCount += 1;
  turnState.cardsPlayedThisTurn += 1;
  turnState.cardsCorrectThisTurn += 1;

  // Check perfect turn: all played cards were answered correctly
  turnState.isPerfectTurn = (turnState.cardsCorrectThisTurn === turnState.cardsPlayedThisTurn && turnState.cardsPlayedThisTurn > 0);

  // Track last card type for wild resolution
  turnState.lastCardType = effect.effectType;

  // Handle buff: store for next card, then reset
  if (card.cardType === 'buff') {
    turnState.buffNextCard = effect.finalValue;
  } else {
    // Consume buff on non-buff card
    turnState.buffNextCard = 0;
  }

  // Check for victory
  if (enemyDefeated) {
    turnState.result = 'victory';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({
      type: 'victory',
      message: 'Enemy defeated!',
    });
  } else {
    turnState.turnLog.push({
      type: 'play',
      message: `Played ${effect.effectType} card`,
      value: effect.finalValue,
      cardId,
    });
  }

  return {
    effect,
    comboCount: turnState.comboCount,
    enemyDefeated,
    fizzled: false,
    blocked: false,
    isPerfectTurn: turnState.isPerfectTurn,
    turnState,
  };
}

/**
 * Skips (discards) a card without penalty. No combo reset.
 *
 * @param turnState - The current turn state (mutated in place).
 * @param cardId - The ID of the card to skip.
 * @returns The updated turn state.
 */
export function skipCard(turnState: TurnState, cardId: string): TurnState {
  deckPlayCard(turnState.deck, cardId);
  turnState.turnLog.push({
    type: 'skip',
    message: 'Card skipped',
    cardId,
  });
  return turnState;
}

/**
 * Ends the player's turn and executes the full enemy turn sequence.
 *
 * Sequence:
 * 1. Execute enemy intent (damage/effects)
 * 2. Apply enemy status effects to player
 * 3. Tick player status effects
 * 4. Tick enemy status effects
 * 5. Reset turn state (shield, combo, cardsPlayed)
 * 6. Roll new enemy intent
 * 7. Advance turn number
 * 8. Draw new hand
 * 9. Clear turnLog
 * 10. Check for encounter end
 *
 * @param turnState - The current turn state (mutated in place).
 * @returns The enemy turn result.
 */
export function endPlayerTurn(turnState: TurnState): EnemyTurnResult {
  const { playerState, enemy, deck } = turnState;

  // 1. Execute enemy intent
  const intentResult = executeEnemyIntent(enemy);

  let damageDealt = 0;
  let playerDefeated = false;
  const effectsApplied: StatusEffect[] = [];

  if (intentResult.damage > 0) {
    const dmgResult = takeDamage(playerState, intentResult.damage);
    damageDealt = intentResult.damage;
    playerDefeated = dmgResult.defeated;
  }

  turnState.turnLog.push({
    type: 'enemy_action',
    message: `Enemy uses ${enemy.nextIntent.telegraph}`,
    value: intentResult.damage,
  });

  // 2. Apply enemy debuffs to player
  for (const effect of intentResult.playerEffects) {
    applyStatusEffect(playerState.statusEffects, effect);
    effectsApplied.push(effect);
  }

  // Check defeat after enemy attack
  if (playerDefeated) {
    turnState.result = 'defeat';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({
      type: 'defeat',
      message: 'Player defeated!',
    });

    // Roll next intent for display even on defeat
    rollNextIntent(enemy);

    return {
      damageDealt,
      effectsApplied,
      playerDefeated: true,
      nextEnemyIntent: enemy.nextIntent.telegraph,
      turnState,
    };
  }

  // 3. Tick player status effects
  const playerTick = tickPlayerStatusEffects(playerState);
  if (playerTick.defeated) {
    turnState.result = 'defeat';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({
      type: 'defeat',
      message: 'Player defeated by status effects!',
    });

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

  // 4. Tick enemy status effects
  const enemyTick = tickEnemyStatusEffects(enemy);
  if (enemy.currentHP <= 0) {
    turnState.result = 'victory';
    turnState.phase = 'encounter_end';
    turnState.turnLog.push({
      type: 'victory',
      message: 'Enemy defeated by status effects!',
    });

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

  // 5. Reset turn state
  resetTurnState(playerState);
  turnState.comboCount = 0;
  turnState.cardsPlayedThisTurn = 0;
  turnState.cardsCorrectThisTurn = 0;
  turnState.isPerfectTurn = false;

  // 6. Roll new enemy intent
  rollNextIntent(enemy);

  // 7. Advance turn number
  turnState.turnNumber += 1;

  // 8. Draw new hand
  drawHand(deck);

  // 9. Clear turnLog for next turn
  turnState.turnLog = [];

  // 10. Set phase for next turn
  turnState.phase = 'player_action';

  return {
    damageDealt,
    effectsApplied,
    playerDefeated: false,
    nextEnemyIntent: enemy.nextIntent.telegraph,
    turnState,
  };
}

/**
 * Checks whether the encounter has ended (victory or defeat).
 *
 * @param turnState - The current turn state.
 * @returns The encounter result, or null if still in progress.
 */
export function checkEncounterEnd(turnState: TurnState): EncounterResult {
  if (turnState.enemy.currentHP <= 0) return 'victory';
  if (turnState.playerState.hp <= 0) return 'defeat';
  return null;
}

/**
 * Checks whether the player's hand is empty.
 *
 * @param turnState - The current turn state.
 * @returns True if no cards remain in hand.
 */
export function isHandEmpty(turnState: TurnState): boolean {
  return turnState.deck.hand.length === 0;
}

/**
 * Gets the current hand size.
 *
 * @param turnState - The current turn state.
 * @returns The number of cards in the player's hand.
 */
export function getHandSize(turnState: TurnState): number {
  return turnState.deck.hand.length;
}

/**
 * Get the combo multiplier for a given combo count.
 * @param comboCount - Current consecutive correct answers (0-based)
 * @returns Multiplier value (1.0 to 2.0)
 */
export function getComboMultiplier(comboCount: number): number {
  const index = Math.min(comboCount, COMBO_MULTIPLIERS.length - 1);
  return COMBO_MULTIPLIERS[index];
}
