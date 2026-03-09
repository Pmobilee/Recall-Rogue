import type { MineralTier } from './types'

/** The three rare in-game premium material types. Never purchasable with real money. */
export type PremiumMaterial = 'star_dust' | 'void_crystal' | 'ancient_essence'

/** A crafting recipe available in the Premium Materializer. */
export interface PremiumRecipe {
  id: string
  name: string
  icon: string
  description: string
  category: 'cosmetic' | 'convenience' | 'pet_variant'
  /** Cost expressed in premium materials and/or regular minerals. */
  cost: Partial<Record<PremiumMaterial, number>> & Partial<Record<MineralTier, number>>
  /** Maximum times this recipe can be crafted (1 for unique items, 99 for consumables). */
  maxCrafts: number
  /** Human-readable prerequisite condition shown in the UI. */
  unlockCondition?: string
}

/** Metadata about each premium material: drop source, rarity label, and per-event drop chance. */
export const PREMIUM_MATERIALS: {
  id: PremiumMaterial
  name: string
  icon: string
  rarity: string
  dropChance: number
}[] = [
  {
    id: 'star_dust',
    name: 'Star Dust',
    icon: '\u2728',
    rarity: 'uncommon',
    dropChance: 0.03, // 3% per artifact collected
  },
  {
    id: 'void_crystal',
    name: 'Void Crystal',
    icon: '\u{1F48E}',
    rarity: 'rare',
    dropChance: 0.01, // 1% from geode+ mineral nodes
  },
  {
    id: 'ancient_essence',
    name: 'Ancient Essence',
    icon: '\u{1F300}',
    rarity: 'epic',
    dropChance: 0.005, // 0.5% from fossil fragments
  },
]

/** All premium crafting recipes. */
export const PREMIUM_RECIPES: PremiumRecipe[] = [
  // ---- Exclusive Cosmetics (4) ----
  {
    id: 'nebula_suit',
    name: 'Nebula Suit',
    icon: '\u{1F30C}',
    description: 'A suit woven from starlight',
    category: 'cosmetic',
    cost: { star_dust: 10, crystal: 5 },
    maxCrafts: 1,
  },
  {
    id: 'void_helmet',
    name: 'Void Helmet',
    icon: '\u{1F573}\uFE0F',
    description: 'Peer into the abyss',
    category: 'cosmetic',
    cost: { void_crystal: 5, geode: 2 },
    maxCrafts: 1,
  },
  {
    id: 'phoenix_trail',
    name: 'Phoenix Trail',
    icon: '\u{1F525}',
    description: 'Leave a trail of embers',
    category: 'cosmetic',
    cost: { star_dust: 15, void_crystal: 3 },
    maxCrafts: 1,
  },
  {
    id: 'aurora_aura',
    name: 'Aurora Aura',
    icon: '\u{1F308}',
    description: 'Shimmer with northern lights',
    category: 'cosmetic',
    cost: { star_dust: 20, void_crystal: 5, ancient_essence: 1 },
    maxCrafts: 1,
  },

  // ---- Convenience Items (3) — single-use per dive, never pay-to-win ----
  {
    id: 'auto_collector',
    name: 'Auto-Collector',
    icon: '\u{1F916}',
    description: 'Auto-collect minerals in 2-tile radius (1 dive)',
    category: 'convenience',
    cost: { star_dust: 5 },
    maxCrafts: 99,
  },
  {
    id: 'deep_scanner',
    name: 'Deep Scanner Map',
    icon: '\u{1F5FA}\uFE0F',
    description: 'Reveals all special blocks on the map (1 dive)',
    category: 'convenience',
    cost: { void_crystal: 2 },
    maxCrafts: 99,
  },
  {
    id: 'time_capsule',
    name: 'Time Capsule',
    icon: '\u23F3',
    description: 'Save progress mid-dive, resume later',
    category: 'convenience',
    cost: { ancient_essence: 1 },
    maxCrafts: 99,
  },

  // ---- Special Pet Variants (3) — cosmetic upgrades to revived fossils ----
  {
    id: 'golden_trilobite',
    name: 'Golden Trilobite',
    icon: '\u{1F31F}',
    description: 'A shimmering variant with 2x production',
    category: 'pet_variant',
    cost: { star_dust: 25, ancient_essence: 2 },
    maxCrafts: 1,
    unlockCondition: 'Revive Trilobite first',
  },
  {
    id: 'crystal_mammoth',
    name: 'Crystal Mammoth',
    icon: '\u{1F4A0}',
    description: 'An ice-blue mammoth with +20 max O2',
    category: 'pet_variant',
    cost: { void_crystal: 10, ancient_essence: 3 },
    maxCrafts: 1,
    unlockCondition: 'Revive Mammoth first',
  },
  {
    id: 'ancient_trex',
    name: 'Ancient T-Rex',
    icon: '\u{1F451}',
    description: 'The true king — 20% instant break chance',
    category: 'pet_variant',
    cost: { star_dust: 30, void_crystal: 15, ancient_essence: 5 },
    maxCrafts: 1,
    unlockCondition: 'Revive T-Rex first',
  },
]

/**
 * Look up a premium recipe by its ID.
 *
 * @param id - The recipe ID to look up.
 * @returns The matching recipe, or undefined if not found.
 */
export function getPremiumRecipeById(id: string): PremiumRecipe | undefined {
  return PREMIUM_RECIPES.find(r => r.id === id)
}

/**
 * Get all premium recipes in a given category.
 *
 * @param category - The category to filter by.
 * @returns All recipes matching the given category.
 */
export function getPremiumRecipesByCategory(category: PremiumRecipe['category']): PremiumRecipe[] {
  return PREMIUM_RECIPES.filter(r => r.category === category)
}

/**
 * Get the metadata record for a premium material by its ID.
 *
 * @param id - The premium material ID.
 * @returns The matching material metadata, or undefined if not found.
 */
export function getPremiumMaterialById(id: PremiumMaterial): (typeof PREMIUM_MATERIALS)[number] | undefined {
  return PREMIUM_MATERIALS.find(m => m.id === id)
}
