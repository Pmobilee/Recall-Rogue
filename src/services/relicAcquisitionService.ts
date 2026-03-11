import type { RelicDefinition, RelicRarity } from '../data/relics/types';
import { FULL_RELIC_CATALOGUE, STARTER_RELIC_IDS } from '../data/relics/index';
import {
  RELIC_RARITY_WEIGHTS,
  RELIC_BOSS_RARITY_WEIGHTS,
  RELIC_DROP_CHANCE_REGULAR,
  RELIC_BOSS_CHOICES,
} from '../data/balance';

/**
 * Returns the pool of relics eligible for acquisition during a run.
 * A relic is eligible if it is a starter or explicitly unlocked,
 * and is not in the excluded or currently-held sets.
 */
export function getEligibleRelicPool(
  unlockedIds: string[],
  excludedIds: string[],
  heldIds: string[],
): RelicDefinition[] {
  const starterSet = new Set(STARTER_RELIC_IDS);
  const unlockedSet = new Set(unlockedIds);
  const excludedSet = new Set(excludedIds);
  const heldSet = new Set(heldIds);

  return FULL_RELIC_CATALOGUE.filter(
    (r) =>
      (starterSet.has(r.id) || unlockedSet.has(r.id)) &&
      !excludedSet.has(r.id) &&
      !heldSet.has(r.id),
  );
}

/**
 * Selects `count` unique relics from the pool using weighted random rarity selection.
 * For each pick, a rarity is chosen via cumulative weights, then a random relic
 * of that rarity is drawn from the remaining pool. Falls back to any available
 * relic if none of the chosen rarity remain.
 * Returns fewer than `count` if the pool is too small.
 */
export function generateRelicChoices(
  pool: RelicDefinition[],
  count: number,
  rarityWeights: Record<RelicRarity, number>,
): RelicDefinition[] {
  const remaining = [...pool];
  const chosen: RelicDefinition[] = [];

  const rarities = Object.keys(rarityWeights) as RelicRarity[];
  const weights = rarities.map((r) => rarityWeights[r]);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Roll for rarity using cumulative weights
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    let chosenRarity: RelicRarity = rarities[0];
    for (let j = 0; j < rarities.length; j++) {
      cumulative += weights[j];
      if (roll < cumulative) {
        chosenRarity = rarities[j];
        break;
      }
    }

    // Filter remaining pool by chosen rarity
    let candidates = remaining.filter((r) => r.rarity === chosenRarity);

    // Fall back to any available relic if none of the chosen rarity exist
    if (candidates.length === 0) {
      candidates = remaining;
    }

    // Pick a random candidate
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    chosen.push(pick);

    // Remove from remaining pool to prevent duplicates
    const idx = remaining.indexOf(pick);
    if (idx !== -1) {
      remaining.splice(idx, 1);
    }
  }

  return chosen;
}

/**
 * Picks a single random common or uncommon relic from the pool.
 * Returns null if no eligible relics of those rarities exist.
 */
export function generateRandomRelicDrop(pool: RelicDefinition[]): RelicDefinition | null {
  const eligible = pool.filter((r) => r.rarity === 'common' || r.rarity === 'uncommon');
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Determines whether a random relic should drop after a regular encounter.
 * Uses `RELIC_DROP_CHANCE_REGULAR` (10% chance).
 */
export function shouldDropRandomRelic(): boolean {
  return Math.random() < RELIC_DROP_CHANCE_REGULAR;
}

/**
 * Generates relic choices for a boss encounter.
 * Uses boss-tier rarity weights for higher quality options.
 */
export function generateBossRelicChoices(pool: RelicDefinition[]): RelicDefinition[] {
  return generateRelicChoices(pool, RELIC_BOSS_CHOICES, RELIC_BOSS_RARITY_WEIGHTS);
}

/**
 * Generates relic choices for a mini-boss encounter.
 * Uses standard rarity weights.
 */
export function generateMiniBossRelicChoices(pool: RelicDefinition[]): RelicDefinition[] {
  return generateRelicChoices(pool, RELIC_BOSS_CHOICES, RELIC_RARITY_WEIGHTS);
}
