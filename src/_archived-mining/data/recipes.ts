import type { MineralTier } from './types'

/** Effect applied to the player when a permanent upgrade recipe is crafted */
export interface RecipeEffect {
  type:
    | 'max_oxygen_bonus'
    | 'starting_bombs'
    | 'extra_inventory'
    | 'quiz_hint'
    | 'mineral_luck'
    | 'hazard_resist'
  value: number
}

/** A crafting recipe available in the Materializer */
export interface Recipe {
  id: string
  name: string
  description: string
  icon: string // emoji
  category: 'permanent' | 'consumable' | 'cosmetic'
  cost: Partial<Record<MineralTier, number>>
  /** For permanent upgrades: effect applied to player */
  effect?: RecipeEffect
  /** Max times this recipe can be crafted (0 = unlimited for consumables) */
  maxCrafts: number
  /** Minimum dives completed to unlock this recipe */
  unlockAfterDives: number
}

export const RECIPES: Recipe[] = [
  // Permanent upgrades
  {
    id: 'reinforced_tank',
    name: 'Reinforced Tank',
    description: '+10 max oxygen per dive',
    icon: '🫧',
    category: 'permanent',
    cost: { dust: 200, shard: 5 },
    effect: { type: 'max_oxygen_bonus', value: 10 },
    maxCrafts: 5,
    unlockAfterDives: 0,
  },
  {
    id: 'bomb_kit',
    name: 'Bomb Starter Kit',
    description: 'Start each dive with 1 bomb',
    icon: '💣',
    category: 'permanent',
    cost: { dust: 300, shard: 10, crystal: 1 },
    effect: { type: 'starting_bombs', value: 1 },
    maxCrafts: 2,
    unlockAfterDives: 3,
  },
  {
    id: 'expanded_pack',
    name: 'Expanded Backpack',
    description: '+2 inventory slots permanently',
    icon: '🎒',
    category: 'permanent',
    cost: { shard: 20, crystal: 3 },
    effect: { type: 'extra_inventory', value: 2 },
    maxCrafts: 3,
    unlockAfterDives: 2,
  },
  {
    id: 'quiz_lens',
    name: 'Scan Lens',
    description: 'Eliminate 1 unlikely choice during field scans',
    icon: '🔍',
    category: 'permanent',
    cost: { dust: 500, crystal: 5, geode: 1 },
    effect: { type: 'quiz_hint', value: 1 },
    maxCrafts: 1,
    unlockAfterDives: 5,
  },
  {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    description: '+10% mineral drop amounts',
    icon: '🍀',
    category: 'permanent',
    cost: { shard: 30, crystal: 5 },
    effect: { type: 'mineral_luck', value: 0.1 },
    maxCrafts: 3,
    unlockAfterDives: 4,
  },
  {
    id: 'heat_shield',
    name: 'Heat Shield',
    description: 'Reduce all hazard O2 costs by 3',
    icon: '🛡️',
    category: 'permanent',
    cost: { crystal: 8, geode: 2 },
    effect: { type: 'hazard_resist', value: 3 },
    maxCrafts: 2,
    unlockAfterDives: 5,
  },
  // Consumables (single-use, bought for next dive)
  {
    id: 'emergency_beacon',
    name: 'Emergency Beacon',
    description: 'Surface without losing any items (1 use)',
    icon: '🆘',
    category: 'consumable',
    cost: { dust: 150, shard: 3 },
    effect: undefined,
    maxCrafts: 0, // unlimited
    unlockAfterDives: 3,
  },
  {
    id: 'scout_drone',
    name: 'Scout Drone',
    description: 'Reveal all special blocks on current layer',
    icon: '🤖',
    category: 'consumable',
    cost: { shard: 15, crystal: 2 },
    effect: undefined,
    maxCrafts: 0,
    unlockAfterDives: 4,
  },
  {
    id: 'mineral_detector',
    name: 'Mineral Detector',
    description: '+50% mineral nodes for next dive',
    icon: '📡',
    category: 'consumable',
    cost: { dust: 100, shard: 5 },
    effect: undefined,
    maxCrafts: 0,
    unlockAfterDives: 2,
  },
  {
    id: 'oxygen_reserve',
    name: 'Oxygen Reserve',
    description: '+30 starting O2 for next dive',
    icon: '💨',
    category: 'consumable',
    cost: { dust: 80 },
    effect: undefined,
    maxCrafts: 0,
    unlockAfterDives: 0,
  },
  {
    id: 'rescue_beacon',
    name: 'Rescue Beacon',
    description: 'Emergency extraction — surface with all loot intact (1 per dive)',
    icon: '🔆',
    category: 'consumable',
    cost: { crystal: 200, geode: 2 },
    effect: undefined,
    maxCrafts: 0,
    unlockAfterDives: 5,
  },
]

/** Look up a recipe by its ID. Returns undefined if not found. */
export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find(r => r.id === id)
}

/** Get all recipes in a given category. */
export function getRecipesByCategory(category: Recipe['category']): Recipe[] {
  return RECIPES.filter(r => r.category === category)
}
