// === Player Combat State ===
// Manages the player's state during a single encounter.
// NO Phaser, Svelte, or DOM imports.

import type { StatusEffect } from '../data/statusEffects';
import { applyStatusEffect as applyEffect, tickStatusEffects, getStrengthModifier } from '../data/statusEffects';
import { PLAYER_START_HP, BLOCK_DECAY_RETAIN_RATE } from '../data/balance';

/** The player's combat state for a single encounter. */
export interface PlayerCombatState {
  /** Current hit points. */
  hp: number;
  /** Maximum hit points. */
  maxHP: number;
  /** Current shield (block) points. Absorbed before HP. Persists across turns (capped at 2× maxHP). */
  shield: number;
  /** Active status effects on the player. */
  statusEffects: StatusEffect[];
  /** Remaining hint uses for this encounter. */
  hintsRemaining: number;
  /** Number of cards played this turn. */
  cardsPlayedThisTurn: number;
}

/**
 * Creates a fresh player combat state for a new encounter.
 *
 * @param maxHP - The player's maximum HP (defaults to PLAYER_START_HP).
 * @returns A fully initialized PlayerCombatState.
 */
export function createPlayerCombatState(maxHP?: number): PlayerCombatState {
  const hp = maxHP ?? PLAYER_START_HP;
  return {
    hp,
    maxHP: hp,
    shield: 0,
    statusEffects: [],
    hintsRemaining: 1,
    cardsPlayedThisTurn: 0,
  };
}

/**
 * Adds shield (block) points to the player. Stacks with existing shield.
 *
 * @param state - The player combat state (mutated in place).
 * @param amount - The amount of shield to add.
 */
export function applyShield(state: PlayerCombatState, amount: number): void {
  state.shield += amount;
}

/**
 * Applies damage to the player. Shield absorbs first, then HP.
 *
 * @param state - The player combat state (mutated in place).
 * @param damage - The raw damage amount.
 * @returns Object with actual damage taken (after shield) and whether player is defeated.
 */
export function takeDamage(
  state: PlayerCombatState,
  damage: number
): { actualDamage: number; defeated: boolean } {
  let remaining = damage;

  // Shield absorbs first
  if (state.shield > 0) {
    const absorbed = Math.min(state.shield, remaining);
    state.shield -= absorbed;
    remaining -= absorbed;
  }

  // Immunity absorbs the next damage instance up to its stored value
  if (remaining > 0) {
    const immunityEffect = state.statusEffects.find(
      (e) => e.type === 'immunity' && e.turnsRemaining > 0,
    );
    if (immunityEffect) {
      const immunityAbsorbed = Math.min(immunityEffect.value, remaining);
      remaining -= immunityAbsorbed;
      // Consume immunity
      immunityEffect.turnsRemaining = 0;
      // Remove expired immunity
      const idx = state.statusEffects.indexOf(immunityEffect);
      if (idx !== -1) state.statusEffects.splice(idx, 1);
    }
  }

  // Remaining damage hits HP
  state.hp = Math.max(0, state.hp - remaining);

  return {
    actualDamage: remaining,
    defeated: state.hp <= 0,
  };
}

/**
 * Heals the player, capped at maxHP.
 *
 * @param state - The player combat state (mutated in place).
 * @param amount - The amount to heal.
 * @returns The actual amount healed (may be less if near max).
 */
export function healPlayer(state: PlayerCombatState, amount: number): number {
  const actual = Math.min(amount, state.maxHP - state.hp);
  state.hp += actual;
  return actual;
}

/**
 * Ticks the player's status effects at end of turn.
 *
 * Poison damage goes through takeDamage (shield absorbs).
 * Regen goes through healPlayer (capped at maxHP).
 *
 * @param state - The player combat state (mutated in place).
 * @returns Poison damage, regen heal, and whether the player was defeated.
 */
export function tickPlayerStatusEffects(state: PlayerCombatState): {
  poisonDamage: number;
  regenHeal: number;
  defeated: boolean;
} {
  const result = tickStatusEffects(state.statusEffects);

  let defeated = false;
  let poisonDamage = 0;
  let regenHeal = 0;

  if (result.poisonDamage > 0) {
    const dmgResult = takeDamage(state, result.poisonDamage);
    poisonDamage = result.poisonDamage;
    defeated = dmgResult.defeated;
  }

  if (result.regenHeal > 0) {
    regenHeal = healPlayer(state, result.regenHeal);
  }

  return { poisonDamage, regenHeal, defeated };
}

/**
 * Resets per-turn state: carries over shield (capped at 2× maxHP) and resets cards played.
 *
 * Block is now persistent — it carries into the next turn rather than resetting to 0.
 * A cap of BLOCK_CARRY_CAP_MULTIPLIER × maxHP prevents infinite stacking.
 * Note: the `persistentShield` relic flag (fortress_wall) is handled separately by turnManager
 * before calling this function and still overrides to full carry for that relic.
 *
 * @param state - The player combat state (mutated in place).
 */
export function resetTurnState(state: PlayerCombatState): void {
  // Block decays 25% each turn (retains 75%) — rewards consistent shield investment
  // Steady state: playing X block/turn converges to 4X max block
  state.shield = Math.floor(state.shield * BLOCK_DECAY_RETAIN_RATE);
  state.cardsPlayedThisTurn = 0;
}
