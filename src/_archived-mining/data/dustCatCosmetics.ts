/**
 * dustCatCosmetics.ts
 * Wardrobe items for the Dust Cat permanent pet. (DD-V2-040)
 */

export type DustCatCosmeticSlot = 'hat' | 'accessory' | 'color'

export interface DustCatCosmetic {
  id: string
  slot: DustCatCosmeticSlot
  name: string
  description: string
  /** Sprite overlay key (hat/accessory) or CSS filter string (color). */
  spriteKey?: string
  colorFilter?: string   // CSS filter, e.g. 'hue-rotate(180deg)'
  /** How this cosmetic is unlocked. */
  unlockMethod: 'milestone' | 'duel_win' | 'season' | 'shop' | 'starter'
  /** Specific unlock condition description. */
  unlockDescription: string
  /** Mineral cost if unlockMethod is 'shop'. */
  shopCost?: Partial<Record<string, number>>
}

export const DUST_CAT_COSMETICS: DustCatCosmetic[] = [
  // Hats
  {
    id: 'hat_none', slot: 'hat', name: 'No Hat', description: 'Just the cat.',
    unlockMethod: 'starter', unlockDescription: 'Default',
  },
  {
    id: 'hat_miner_helmet', slot: 'hat', name: 'Miner Helmet',
    description: 'A tiny hard hat that matches yours.',
    spriteKey: 'cat_hat_miner_helmet',
    unlockMethod: 'milestone', unlockDescription: 'Complete 10 dives',
  },
  {
    id: 'hat_wizard', slot: 'hat', name: 'Wizard Hat',
    description: 'Points skyward with mysterious authority.',
    spriteKey: 'cat_hat_wizard',
    unlockMethod: 'milestone', unlockDescription: 'Master 50 facts',
  },
  {
    id: 'hat_crown', slot: 'hat', name: 'Crystal Crown',
    description: 'For the cat who rules the dome.',
    spriteKey: 'cat_hat_crown',
    unlockMethod: 'shop', unlockDescription: 'Purchase from shop',
    shopCost: { crystal: 5, geode: 1 },
  },
  {
    id: 'hat_expedition', slot: 'hat', name: 'Expedition Cap',
    description: 'For veteran explorers. And their cats.',
    spriteKey: 'cat_hat_expedition',
    unlockMethod: 'season', unlockDescription: 'Season 1 reward',
  },
  // Accessories
  {
    id: 'acc_none', slot: 'accessory', name: 'No Accessory', description: 'Clean look.',
    unlockMethod: 'starter', unlockDescription: 'Default',
  },
  {
    id: 'acc_bowtie', slot: 'accessory', name: 'Bowtie',
    description: 'Dapper. Irresistible.',
    spriteKey: 'cat_acc_bowtie',
    unlockMethod: 'shop', unlockDescription: 'Purchase from shop',
    shopCost: { shard: 30 },
  },
  {
    id: 'acc_bandana', slot: 'accessory', name: 'Dust Bandana',
    description: 'Protection from the grit below.',
    spriteKey: 'cat_acc_bandana',
    unlockMethod: 'milestone', unlockDescription: 'Mine 500 blocks total',
  },
  {
    id: 'acc_scarf', slot: 'accessory', name: 'Crystal Scarf',
    description: 'Hand-woven from crystalline threads.',
    spriteKey: 'cat_acc_scarf',
    unlockMethod: 'duel_win', unlockDescription: 'Win 5 knowledge duels',
  },
  {
    id: 'acc_badge', slot: 'accessory', name: 'Scholar Badge',
    description: 'Awarded for academic distinction.',
    spriteKey: 'cat_acc_badge',
    unlockMethod: 'milestone', unlockDescription: 'Master 100 facts',
  },
  // Colour variations
  {
    id: 'color_default', slot: 'color', name: 'Dust Grey',
    description: 'The natural colour of a deep-earth cat.',
    unlockMethod: 'starter', unlockDescription: 'Default',
  },
  {
    id: 'color_obsidian', slot: 'color', name: 'Obsidian Black',
    description: 'Deep black, like the void biome.',
    colorFilter: 'brightness(0.3) contrast(1.2)',
    unlockMethod: 'milestone', unlockDescription: 'Reach layer 20',
  },
  {
    id: 'color_crystal_blue', slot: 'color', name: 'Crystal Blue',
    description: 'Luminescent, like a geode at depth.',
    colorFilter: 'hue-rotate(200deg) saturate(1.8)',
    unlockMethod: 'shop', unlockDescription: 'Purchase from shop',
    shopCost: { crystal: 8 },
  },
  {
    id: 'color_lava_orange', slot: 'color', name: 'Lava Orange',
    description: 'Warm as the magma biome.',
    colorFilter: 'hue-rotate(25deg) saturate(2)',
    unlockMethod: 'season', unlockDescription: 'Season 2 reward',
  },
  {
    id: 'color_void_purple', slot: 'color', name: 'Void Purple',
    description: 'A rare aberration found in the anomaly biomes.',
    colorFilter: 'hue-rotate(270deg) saturate(1.5)',
    unlockMethod: 'duel_win', unlockDescription: 'Win 20 knowledge duels',
  },
]

/** Find a Dust Cat cosmetic by ID. */
export function getDustCatCosmetic(id: string): DustCatCosmetic | undefined {
  return DUST_CAT_COSMETICS.find(c => c.id === id)
}

/** Get all cosmetics for a given slot. */
export function getDustCatCosmeticsBySlot(slot: DustCatCosmeticSlot): DustCatCosmetic[] {
  return DUST_CAT_COSMETICS.filter(c => c.slot === slot)
}

/** Check if a player owns a cosmetic (by examining playerSave). */
export function playerOwnsDustCatCosmetic(
  cosmeticId: string,
  ownedCosmetics: string[],
): boolean {
  const item = getDustCatCosmetic(cosmeticId)
  if (!item) return false
  if (item.unlockMethod === 'starter') return true
  return ownedCosmetics.includes(cosmeticId)
}
