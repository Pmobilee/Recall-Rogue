export interface DailyDeal {
  id: string
  name: string
  description: string
  icon: string
  category: 'mineral_pack' | 'oxygen_boost' | 'recipe_discount' | 'cosmetic_discount' | 'mystery_box'
  cost: { greyMatter: number }
  reward: DealReward
  /** Which market slot this deal occupies (1 = Consumable, 2 = Special, 3 = Featured). */
  slot: 1 | 2 | 3
  /** Discount percentage applied to this deal (0 = no discount). */
  discountPercent: number
  /** For slot 3: which day in the 7-day rotation (1-7). Day 7 = pity (rare+ guaranteed). */
  featuredDay?: number
}

export type DealReward =
  | { type: 'minerals'; amount: number }
  | { type: 'oxygen_tanks'; amount: number }
  | { type: 'recipe_discount'; recipeId: string; discountPercent: number }
  | { type: 'random_minerals'; minDust: number; maxDust: number }
  | { type: 'cosmetic_unlock'; cosmeticId: string }

// === Slot 1: Consumable pool (20% discount) ===
const CONSUMABLE_POOL: Omit<DailyDeal, 'slot' | 'discountPercent' | 'featuredDay'>[] = [
  {
    id: 'oxygen_surplus',
    name: 'Oxygen Surplus',
    description: '+1 oxygen tank',
    icon: '🫧',
    category: 'oxygen_boost',
    cost: { greyMatter: 300 },
    reward: { type: 'oxygen_tanks', amount: 1 },
  },
  {
    id: 'bomb_discount',
    name: 'Bomb Kit Sale',
    description: 'Bomb kit at 50% off',
    icon: '💣',
    category: 'recipe_discount',
    cost: { greyMatter: 200 },
    reward: { type: 'recipe_discount', recipeId: 'bomb_kit', discountPercent: 50 },
  },
  {
    id: 'tank_deal',
    name: 'Tank Upgrade Sale',
    description: 'Reinforced tank at 40% off',
    icon: '🫧',
    category: 'recipe_discount',
    cost: { greyMatter: 150 },
    reward: { type: 'recipe_discount', recipeId: 'reinforced_tank', discountPercent: 40 },
  },
]

// === Slot 2: Special/Cosmetic pool (no discount) ===
const SPECIAL_POOL: Omit<DailyDeal, 'slot' | 'discountPercent' | 'featuredDay'>[] = [
  {
    id: 'mystery_minerals',
    name: 'Mystery Cache',
    description: 'Random mineral windfall',
    icon: '❓',
    category: 'mystery_box',
    cost: { greyMatter: 100 },
    reward: { type: 'random_minerals', minDust: 50, maxDust: 250 },
  },
]

// === Slot 3: Featured pool (7-day rotation; day 7 = rare+ pity) ===
const FEATURED_UNCOMMON: Omit<DailyDeal, 'slot' | 'discountPercent' | 'featuredDay'>[] = [
  {
    id: 'feat_o2_double',
    name: 'Double Refill',
    description: '+2 oxygen tanks',
    icon: '🫧',
    category: 'oxygen_boost',
    cost: { greyMatter: 600 },
    reward: { type: 'oxygen_tanks', amount: 2 },
  },
]

const FEATURED_RARE: Omit<DailyDeal, 'slot' | 'discountPercent' | 'featuredDay'>[] = [
  {
    id: 'feat_mystery_rare',
    name: 'Golden Cache',
    description: 'Premium mineral haul',
    icon: '✨',
    category: 'mystery_box',
    cost: { greyMatter: 300 },
    reward: { type: 'random_minerals', minDust: 200, maxDust: 500 },
  },
]

/**
 * Simple seeded PRNG for deterministic daily picks.
 * Returns a function that produces values in [0, 1).
 */
function seededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Compute which day in the 7-day cycle today falls on (1-7).
 * Uses UTC date so all players see the same deals.
 */
function getFeaturedDay(): number {
  const now = new Date()
  const epoch = Date.UTC(2026, 0, 1) // reference: 2026-01-01 UTC
  const daysSinceEpoch = Math.floor((now.getTime() - epoch) / (1000 * 60 * 60 * 24))
  return (daysSinceEpoch % 7) + 1
}

/**
 * Generate today's 3 deals using the date as seed.
 * - Slot 1 (Consumable): 20% discount, rotates through consumable pool
 * - Slot 2 (Special): standard price, rotates through special pool
 * - Slot 3 (Featured): 7-day cycle. Days 1-6: uncommon items. Day 7: rare+ guaranteed.
 */
export function getTodaysDeals(): DailyDeal[] {
  const today = new Date()
  const seed =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const rng = seededRng(seed)

  // Slot 1: Consumable (20% off)
  const consumableIdx = Math.floor(rng() * CONSUMABLE_POOL.length)
  const slot1: DailyDeal = {
    ...CONSUMABLE_POOL[consumableIdx],
    slot: 1,
    discountPercent: 20,
  }

  // Slot 2: Special (0% discount)
  const specialIdx = Math.floor(rng() * SPECIAL_POOL.length)
  const slot2: DailyDeal = {
    ...SPECIAL_POOL[specialIdx],
    slot: 2,
    discountPercent: 0,
  }

  // Slot 3: Featured (7-day rotation)
  const day = getFeaturedDay()
  let featuredBase: Omit<DailyDeal, 'slot' | 'discountPercent' | 'featuredDay'>
  if (day === 7) {
    // Pity day: rare+ guaranteed
    const rareIdx = Math.floor(rng() * FEATURED_RARE.length)
    featuredBase = FEATURED_RARE[rareIdx]
  } else {
    const uncommonIdx = Math.floor(rng() * FEATURED_UNCOMMON.length)
    featuredBase = FEATURED_UNCOMMON[uncommonIdx]
  }
  const slot3: DailyDeal = {
    ...featuredBase,
    slot: 3,
    discountPercent: 0,
    featuredDay: day,
  }

  return [slot1, slot2, slot3]
}

/** Get hours and minutes remaining until deals reset (midnight local). */
export function getTimeUntilReset(): { hours: number; minutes: number } {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const diff = tomorrow.getTime() - now.getTime()
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  }
}

/** Returns the current day in the 7-day featured rotation (1-7). */
export function getCurrentFeaturedDay(): number {
  return getFeaturedDay()
}
