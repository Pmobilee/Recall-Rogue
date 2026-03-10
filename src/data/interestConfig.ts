import { CATEGORIES } from './categories'

/** Relative weight for one category (0 = no boost, 100 = full interest boost). */
export interface CategoryInterest {
  /** Top-level category name matching Fact.category[0] */
  category: string
  /** Explicit player-set weight boost. 0 = default, 1–100 = interest. */
  weight: number
  /** Per-subcategory weight overrides. Key = subcategory name (Fact.category[1]). */
  subcategoryWeights: Record<string, number>
}

/** Full interest configuration stored in PlayerSave. */
export interface InterestConfig {
  /** Whether the player has enabled behavioral learning (opt-in). */
  behavioralLearningEnabled: boolean
  /** Per-category interest settings. Always contains one entry per CATEGORIES value. */
  categories: CategoryInterest[]
  /** If set, only facts from this category path are served. null = no lock. */
  categoryLock: string[] | null
  /** Whether the category lock is currently active (player can toggle without clearing). */
  categoryLockActive: boolean
  /**
   * Inferred interest boosts from behavioral signals. Max per-category value = 0.3 (DD-V2-118).
   * Key = category name, value = 0.0–0.3 additive boost.
   */
  inferredBoosts: Record<string, number>
}

/** Maximum number of categories a player can mark as primary interests. */
export const MAX_INTEREST_CATEGORIES = 3

/**
 * Maximum weight value for behavioral inference boost, per DD-V2-118.
 * Explicit slider weights have no cap (they are the player's stated preference).
 * Behavioral signals can only contribute up to this amount above the explicit setting.
 */
export const MAX_INFERRED_BOOST = 0.3

/**
 * Creates a default InterestConfig with all categories at weight 0 (no interest set).
 */
export function createDefaultInterestConfig(): InterestConfig {
  return {
    behavioralLearningEnabled: false,
    categories: CATEGORIES.map(cat => ({
      category: cat,
      weight: 0,
      subcategoryWeights: {},
    })),
    categoryLock: null,
    categoryLockActive: false,
    inferredBoosts: {},
  }
}

/**
 * Returns the number of categories currently marked as primary interests
 * (weight > 0 set by the player).
 */
export function countActiveInterests(config: InterestConfig): number {
  return config.categories.filter(c => c.weight > 0).length
}

/**
 * Computes the effective spawn weight multiplier for a given category.
 * Combines the explicit player weight (normalized to 0.0–1.0) with
 * any inferred boost (capped at MAX_INFERRED_BOOST).
 *
 * Formula: baseMultiplier = 1.0 + (normalizedWeight * 1.0) + inferredBoost
 * A category with weight=0 and no inferred boost has multiplier = 1.0 (no change).
 * A category with weight=100 has multiplier = 2.0. Inferred can add up to 0.3 more.
 */
export function getCategoryMultiplier(config: InterestConfig, category: string): number {
  const entry = config.categories.find(c => c.category === category)
  const normalizedWeight = entry ? entry.weight / 100 : 0
  const inferred = Math.min(config.inferredBoosts[category] ?? 0, MAX_INFERRED_BOOST)
  return 1.0 + normalizedWeight + inferred
}

/**
 * Computes the effective multiplier for a specific subcategory.
 * Falls back to the parent category multiplier if no subcategory weight is set.
 */
export function getSubcategoryMultiplier(
  config: InterestConfig,
  category: string,
  subcategory: string,
): number {
  const entry = config.categories.find(c => c.category === category)
  if (!entry) return getCategoryMultiplier(config, category)

  const subWeight = entry.subcategoryWeights[subcategory]
  if (subWeight === undefined) return getCategoryMultiplier(config, category)

  const inferred = Math.min(config.inferredBoosts[category] ?? 0, MAX_INFERRED_BOOST)
  return 1.0 + (subWeight / 100) + inferred
}

/**
 * Given a list of facts and the player's interest config, returns weights for each fact
 * for use with weighted random selection.
 */
export function computeFactWeights(
  facts: Array<{ id: string; category: string[] }>,
  config: InterestConfig,
): number[] {
  // If category lock is active, only include facts in the locked category path.
  if (config.categoryLock && config.categoryLockActive) {
    const lockPath = config.categoryLock
    return facts.map(fact => {
      const matches = lockPath.every((segment, i) => fact.category[i] === segment)
      return matches ? 1.0 : 0.0
    })
  }

  return facts.map(fact => {
    const topCategory = fact.category[0] ?? ''
    const subCategory = fact.category[1] ?? ''

    if (subCategory) {
      return getSubcategoryMultiplier(config, topCategory, subCategory)
    }
    return getCategoryMultiplier(config, topCategory)
  })
}

/**
 * Performs a weighted random selection from an array of items using precomputed weights.
 */
export function weightedRandomSelect<T>(
  items: T[],
  weights: number[],
  rng: () => number,
): T | null {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total === 0) return null

  let remaining = rng() * total
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i]
    if (remaining <= 0) return items[i]
  }
  return items[items.length - 1]
}
