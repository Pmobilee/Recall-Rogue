// === Encounter Rewards ===
// Generates rewards after an encounter is completed.
// NO Phaser, Svelte, or DOM imports.

import type { Card } from '../data/card-types';
import type { Fact } from '../data/types';
import type { EnemyCategory } from '../data/enemies';
import { createCard } from './cardFactory';
import { shuffled } from './randomUtils';

/** The reward options presented after an encounter. */
export interface EncounterRewardOptions {
  /** Card choices for the player to pick from. */
  cardChoices: Card[];
  /** Currency (dust) reward amount. */
  currencyReward: number;
  /** Bonus currency from combo performance. */
  comboBonus: number;
}

/**
 * Generates card reward choices from available facts.
 *
 * Creates cards at tier 1 (reward cards are always new/learning tier).
 * Randomly selects `count` facts from the available pool.
 *
 * @param floor - Current floor number (currently unused, reserved for future tier scaling).
 * @param availableFacts - Pool of facts to create cards from.
 * @param count - Number of card choices to generate (default 3).
 * @returns Array of Card reward options.
 */
export function generateCardRewards(
  floor: number,
  availableFacts: Fact[],
  count: number = 3,
): Card[] {
  if (availableFacts.length === 0) return [];

  // Shuffle and pick up to `count` facts
  const selected = shuffled(availableFacts).slice(0, Math.min(count, availableFacts.length));

  // Create tier 1 cards (no reviewState = tier 1)
  return selected.map(fact => createCard(fact, undefined));
}

/**
 * Generates a currency reward based on floor and enemy difficulty.
 *
 * Base rewards: common=10, elite=25, boss=50.
 * Scaled by: base * (1 + (floor - 1) * 0.15).
 *
 * @param floor - Current floor number.
 * @param enemyCategory - The defeated enemy's category.
 * @returns The currency reward amount (rounded).
 */
export function generateCurrencyReward(floor: number, enemyCategory: EnemyCategory): number {
  const baseRewards: Record<EnemyCategory, number> = {
    common: 10,
    elite: 25,
    mini_boss: 30,
    boss: 50,
  };

  const base = baseRewards[enemyCategory] ?? 10;
  return Math.round(base * (1 + (floor - 1) * 0.15));
}

/**
 * Generates a combo bonus from the maximum combo achieved during the encounter.
 *
 * Bonus = maxCombo * 2.
 *
 * @param maxComboAchieved - The highest combo count reached in the encounter.
 * @returns The combo bonus currency amount.
 */
export function generateComboBonus(maxComboAchieved: number): number {
  return maxComboAchieved * 2;
}

/**
 * Builds the complete reward package for a completed encounter.
 *
 * @param floor - Current floor number.
 * @param enemyCategory - The defeated enemy's category.
 * @param availableFacts - Pool of facts for card reward generation.
 * @param maxComboAchieved - The highest combo achieved during the encounter.
 * @returns The full encounter reward options.
 */
export function buildEncounterRewards(
  floor: number,
  enemyCategory: EnemyCategory,
  availableFacts: Fact[],
  maxComboAchieved: number,
): EncounterRewardOptions {
  return {
    cardChoices: generateCardRewards(floor, availableFacts),
    currencyReward: generateCurrencyReward(floor, enemyCategory),
    comboBonus: generateComboBonus(maxComboAchieved),
  };
}
