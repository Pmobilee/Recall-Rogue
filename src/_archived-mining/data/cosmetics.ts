import type { MineralTier } from './types'

/** A purchasable visual customization for the miner character. */
export interface Cosmetic {
  id: string
  name: string
  description: string
  icon: string // emoji
  category: 'helmet' | 'suit' | 'trail' | 'aura'
  cost: Partial<Record<MineralTier, number>>
  unlockRequirement?: { type: 'dives' | 'facts' | 'depth'; value: number }
  /** CSS color for the miner tint in MineScene (hex, e.g. 0xff0000) */
  minerTint: number
}

/** All available cosmetics in the shop. */
export const COSMETICS: Cosmetic[] = [
  // Helmets
  {
    id: 'helmet_gold',
    name: 'Golden Helmet',
    description: 'A gleaming golden headpiece',
    icon: '\u{1F451}',
    category: 'helmet',
    cost: { crystal: 5, geode: 2 },
    minerTint: 0xffd700,
  },
  {
    id: 'helmet_crystal',
    name: 'Crystal Visor',
    description: 'See the mine through crystal clarity',
    icon: '\u{1F48E}',
    category: 'helmet',
    cost: { crystal: 10 },
    unlockRequirement: { type: 'dives', value: 10 },
    minerTint: 0x00ccff,
  },
  // Suits
  {
    id: 'suit_lava',
    name: 'Magma Suit',
    description: 'Forged in volcanic depths',
    icon: '\u{1F525}',
    category: 'suit',
    cost: { shard: 50, crystal: 3 },
    unlockRequirement: { type: 'depth', value: 30 },
    minerTint: 0xff4400,
  },
  {
    id: 'suit_ice',
    name: 'Cryo Suit',
    description: 'Cold as the crystalline depths',
    icon: '\u2744\uFE0F',
    category: 'suit',
    cost: { crystal: 8, geode: 1 },
    minerTint: 0x88ccff,
  },
  {
    id: 'suit_shadow',
    name: 'Shadow Suit',
    description: 'Blend into the darkness',
    icon: '\u{1F311}',
    category: 'suit',
    cost: { geode: 3 },
    unlockRequirement: { type: 'dives', value: 20 },
    minerTint: 0x333366,
  },
  // Trails
  {
    id: 'trail_sparkle',
    name: 'Sparkle Trail',
    description: 'Leave a trail of sparkles',
    icon: '\u2728',
    category: 'trail',
    cost: { shard: 30, crystal: 2 },
    minerTint: 0xffff00,
  },
  {
    id: 'trail_ghost',
    name: 'Ghost Trail',
    description: 'An ethereal afterimage',
    icon: '\u{1F47B}',
    category: 'trail',
    cost: { crystal: 5 },
    unlockRequirement: { type: 'facts', value: 50 },
    minerTint: 0xccffcc,
  },
  // Auras
  {
    id: 'aura_knowledge',
    name: 'Knowledge Aura',
    description: 'The glow of a learned mind',
    icon: '\u{1F9E0}',
    category: 'aura',
    cost: { essence: 1 },
    unlockRequirement: { type: 'facts', value: 100 },
    minerTint: 0xff88ff,
  },
]

/**
 * Returns a cosmetic by its ID, or undefined if not found.
 *
 * @param id - The cosmetic ID to look up.
 */
export function getCosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find(c => c.id === id)
}

/**
 * Returns all cosmetics belonging to the given category.
 *
 * @param category - The category to filter by.
 */
export function getCosmeticsByCategory(category: Cosmetic['category']): Cosmetic[] {
  return COSMETICS.filter(c => c.category === category)
}
