/**
 * Floor background definitions for the Decorator machine.
 * Each background is a tileable texture that replaces the default floor surface.
 */

export interface FloorBackground {
  id: string
  name: string
  description: string
  /** Sprite key used in dome manifest */
  spriteKey: string
  /** Cost in dust. 0 = free/starter */
  dustCost: number
  /** Optional: premium currency cost */
  premiumCost: number | null
}

export const FLOOR_BACKGROUNDS: FloorBackground[] = [
  {
    id: 'floor_bg_steel_grate',
    name: 'Steel Grate',
    description: 'Standard industrial steel flooring with diamond plate texture.',
    spriteKey: 'floor_bg_steel_grate',
    dustCost: 0,
    premiumCost: null,
  },
  {
    id: 'floor_bg_mossy_stone',
    name: 'Mossy Stone',
    description: 'Ancient stone tiles overgrown with bioluminescent moss.',
    spriteKey: 'floor_bg_mossy_stone',
    dustCost: 500,
    premiumCost: null,
  },
  {
    id: 'floor_bg_crystal_tiles',
    name: 'Crystal Tiles',
    description: 'Translucent crystal flooring that glows with inner light.',
    spriteKey: 'floor_bg_crystal_tiles',
    dustCost: 1000,
    premiumCost: null,
  },
  {
    id: 'floor_bg_lava_rock',
    name: 'Volcanic Rock',
    description: 'Dark basalt with glowing lava veins running through cracks.',
    spriteKey: 'floor_bg_lava_rock',
    dustCost: 2000,
    premiumCost: null,
  },
  {
    id: 'floor_bg_starfield',
    name: 'Starfield Glass',
    description: 'Transparent floor panels revealing the cosmos beneath your feet.',
    spriteKey: 'floor_bg_starfield',
    dustCost: 5000,
    premiumCost: null,
  },
]

/** Get a floor background by ID */
export function getFloorBackground(id: string): FloorBackground | undefined {
  return FLOOR_BACKGROUNDS.find(bg => bg.id === id)
}
