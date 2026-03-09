import type { PlayerStats } from './types'

// ============================================================
// KNOWLEDGE STORE TYPES
// ============================================================

/** The effect applied when a Knowledge Store item is active */
export type KnowledgeEffect =
  | { type: 'quiz_hint'; value: number }               // Eliminate N unlikely choices in field scans
  | { type: 'xp_multiplier'; value: number }           // Multiply learning speed
  | { type: 'dust_per_correct'; value: number }        // Bonus dust per nailed field scan
  | { type: 'review_extension'; days: number }         // Extend review intervals by N days
  | { type: 'category_boost'; category: string; value: number } // Boost specific category mastery speed
  | { type: 'category_lock' }                          // Lock mine to a single category

/** Requirement that must be met before an item becomes purchasable */
export interface KnowledgeUnlockRequirement {
  type: 'mastered_facts' | 'category_complete' | 'streak'
  value: number
  categoryId?: string
}

/** A purchasable item in the Knowledge Store */
export interface KnowledgeItem {
  id: string
  name: string
  description: string
  icon: string
  category: 'powerup' | 'cosmetic' | 'boost'
  cost: number        // Cost in knowledge points
  unlockRequirement?: KnowledgeUnlockRequirement
  effect?: KnowledgeEffect
  maxPurchases: number
}

// ============================================================
// KNOWLEDGE STORE CATALOGUE
// ============================================================

export const KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  // Powerups
  {
    id: 'quiz_hint_1',
    name: 'Study Notes',
    description: 'Eliminate 1 unlikely choice in field scans permanently',
    icon: '📝',
    category: 'powerup',
    cost: 50,
    effect: { type: 'quiz_hint', value: 1 },
    maxPurchases: 3,
  },
  {
    id: 'quick_learner',
    name: 'Quick Learner',
    description: 'Facts move to "familiar" 20% faster',
    icon: '⚡',
    category: 'powerup',
    cost: 100,
    effect: { type: 'xp_multiplier', value: 1.2 },
    maxPurchases: 1,
    unlockRequirement: { type: 'mastered_facts', value: 10 },
  },
  {
    id: 'dust_scholar',
    name: 'Dust Scholar',
    description: '+3 dust for every nailed field scan',
    icon: '💰',
    category: 'powerup',
    cost: 75,
    effect: { type: 'dust_per_correct', value: 3 },
    maxPurchases: 2,
  },
  {
    id: 'memory_palace',
    name: 'Memory Palace',
    description: 'Review intervals extended by 2 days',
    icon: '🏛️',
    category: 'powerup',
    cost: 150,
    effect: { type: 'review_extension', days: 2 },
    maxPurchases: 1,
    unlockRequirement: { type: 'mastered_facts', value: 25 },
  },

  // Category Boosts
  {
    id: 'boost_natsci',
    name: 'Science Focus',
    description: 'Natural Science facts master 25% faster',
    icon: '🔬',
    category: 'boost',
    cost: 60,
    effect: { type: 'category_boost', category: 'Natural Sciences', value: 1.25 },
    maxPurchases: 1,
  },
  {
    id: 'boost_history',
    name: 'History Focus',
    description: 'History facts master 25% faster',
    icon: '📜',
    category: 'boost',
    cost: 60,
    effect: { type: 'category_boost', category: 'History', value: 1.25 },
    maxPurchases: 1,
  },
  {
    id: 'boost_language',
    name: 'Language Focus',
    description: 'Language facts master 25% faster',
    icon: '🗣️',
    category: 'boost',
    cost: 60,
    effect: { type: 'category_boost', category: 'Language', value: 1.25 },
    maxPurchases: 1,
  },
  {
    id: 'boost_geo',
    name: 'Geography Focus',
    description: 'Geography facts master 25% faster',
    icon: '🌍',
    category: 'boost',
    cost: 60,
    effect: { type: 'category_boost', category: 'Geography', value: 1.25 },
    maxPurchases: 1,
  },

  // Cosmetics / Prestige
  {
    id: 'golden_tree',
    name: 'Golden Tree',
    description: 'Knowledge Tree gets a golden trunk',
    icon: '🌳',
    category: 'cosmetic',
    cost: 200,
    maxPurchases: 1,
    unlockRequirement: { type: 'mastered_facts', value: 50 },
  },
  {
    id: 'scholar_title',
    name: 'Scholar Title',
    description: 'Display "Scholar" title on your profile',
    icon: '🎓',
    category: 'cosmetic',
    cost: 100,
    maxPurchases: 1,
    unlockRequirement: { type: 'streak', value: 7 },
  },
  {
    id: 'category_lock',
    name: 'Focus Crystal',
    description: 'Lock your mine to a single subject. Perfect for dedicated study.',
    icon: '🔒',
    category: 'powerup',
    cost: 150,
    effect: { type: 'category_lock' },
    maxPurchases: 1,
    unlockRequirement: { type: 'mastered_facts', value: 5 },
  },
]

// ============================================================
// HELPERS
// ============================================================

/**
 * Returns a Knowledge Store item by its ID, or undefined if not found.
 *
 * @param id - The item ID to look up.
 */
export function getKnowledgeItemById(id: string): KnowledgeItem | undefined {
  return KNOWLEDGE_ITEMS.find(i => i.id === id)
}

/**
 * Calculates the total knowledge points a player has earned.
 * Knowledge Points are derived from stats and mastery — not stored incrementally.
 *
 * Formula:
 *  - 1 KP per fact learned
 *  - 2 additional KP per mastered fact (3 total per mastered fact)
 *  - 1 KP per 10 correct quiz answers
 *
 * @param stats - Player statistics containing totalFactsLearned and totalQuizCorrect.
 * @param masteredCount - Number of facts currently at "mastered" mastery level.
 */
export function calculateKnowledgePoints(
  stats: Pick<PlayerStats, 'totalFactsLearned' | 'totalQuizCorrect'>,
  masteredCount: number,
): number {
  return stats.totalFactsLearned + masteredCount * 2 + Math.floor(stats.totalQuizCorrect / 10)
}
