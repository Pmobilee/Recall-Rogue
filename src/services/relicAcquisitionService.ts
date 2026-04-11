import type { RelicDefinition, RelicRarity } from '../data/relics/types';
import { getRunRng, isRunRngActive } from './seededRng';
import { FULL_RELIC_CATALOGUE, STARTER_RELIC_IDS } from '../data/relics/index';
import {
  RELIC_RARITY_WEIGHTS,
  RELIC_BOSS_RARITY_WEIGHTS,
  RELIC_DROP_CHANCE_REGULAR,
  RELIC_BOSS_CHOICES,
} from '../data/balance';

/**
 * Returns the pool of relics eligible for acquisition during a run.
 *
 * Eligibility rules:
 * - Starter relics (isStarter: true or startsUnlocked: true): always eligible regardless of level.
 * - Unlockable relics: eligible only when `playerLevel >= relic.unlockLevel`.
 *   Relics with no `unlockLevel` set are excluded from the pool (not yet configured).
 * - Additionally excluded: relics in `excludedIds`, relics in `heldIds`,
 *   and relics with `excludeFromPool: true`.
 *
 * @param unlockedIds - Legacy parameter kept for compatibility; no longer used for filtering.
 * @param excludedIds - Relic IDs permanently excluded from this run's pool.
 * @param heldIds - Relic IDs the player already holds (prevents duplicates).
 * @param playerLevel - The player's current character level (defaults to 0).
 */
export function getEligibleRelicPool(
  unlockedIds: string[],
  excludedIds: string[],
  heldIds: string[],
  playerLevel: number = 0,
): RelicDefinition[] {
  const starterSet = new Set(STARTER_RELIC_IDS);
  const excludedSet = new Set(excludedIds);
  const heldSet = new Set(heldIds);

  return FULL_RELIC_CATALOGUE.filter((r) => {
    // Always exclude held and explicitly-excluded relics
    if (excludedSet.has(r.id) || heldSet.has(r.id)) return false;
    // Always exclude relics requiring unbuilt mechanics (Phase 1)
    if (r.excludeFromPool === true) return false;

    // Starter relics are always available
    if (starterSet.has(r.id) || r.isStarter === true || r.startsUnlocked === true) return true;

    // Unlockable relics: player must have reached the required level
    if (r.unlockLevel !== undefined) return playerLevel >= r.unlockLevel;

    // Unlockable relics with no unlockLevel configured are not yet available
    return false;
  });
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
    // Roll for rarity using seeded RNG when active (co-op determinism — both peers
    // must see the same relic reward options at the same time).
    const _relicRng = isRunRngActive() ? getRunRng('relicRewards') : null;
    const roll = (_relicRng ? _relicRng.next() : Math.random()) * totalWeight;
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
    const _pickRng = isRunRngActive() ? getRunRng('relicRewards') : null;
    const pick = candidates[Math.floor((_pickRng ? _pickRng.next() : Math.random()) * candidates.length)];
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
 * Picks a single random relic from the pool using the provided rarity weights.
 * If pityActive is true, forces the selection to Uncommon or higher rarity.
 * Falls back to the full pool if no Uncommon+ relics are available (prevents deadlock).
 * Returns null if the pool is empty.
 */
export function generateRandomRelicDrop(
  pool: RelicDefinition[],
  rarityWeights: Record<RelicRarity, number> = RELIC_RARITY_WEIGHTS,
  pityActive: boolean = false,
): RelicDefinition | null {
  if (pool.length === 0) return null;

  let eligible = pool;
  if (pityActive) {
    const uncommonPlus = pool.filter((r) => r.rarity !== 'common');
    if (uncommonPlus.length > 0) {
      eligible = uncommonPlus;
    }
    // If no Uncommon+ available, fall through to full pool
  }

  return generateRelicChoices(eligible, 1, rarityWeights)[0] ?? null;
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
