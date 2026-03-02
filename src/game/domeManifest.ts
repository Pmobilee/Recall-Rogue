/** All dome sprite keys */
export const DOME_SPRITE_KEYS = [
  // tiles
  'dome_glass', 'dome_frame', 'stone_floor', 'metal_platform',
  'interior_wall', 'dirt_ground', 'dome_glass_curved',
  // objects
  'obj_gaia_terminal', 'obj_workbench', 'obj_bookshelf', 'obj_display_case',
  'obj_market_stall', 'obj_dive_hatch', 'obj_farm_plot', 'obj_knowledge_tree',
  'obj_streak_board', 'obj_locked_silhouette',
  // decorations
  'deco_ceiling_light', 'deco_plant_pot', 'deco_wall_monitor',
  // gaia
  'gaia_neutral', 'gaia_happy', 'gaia_thinking',
  'gaia_snarky', 'gaia_surprised', 'gaia_calm',
  // backgrounds
  'sky_stars', 'surface_ground',
] as const

export type DomeSpriteKey = typeof DOME_SPRITE_KEYS[number]

// Eagerly load both sprite sets
const loResGlob = import.meta.glob<{ default: string }>(
  '../assets/sprites/dome/*.png',
  { eager: true }
)

const hiResGlob = import.meta.glob<{ default: string }>(
  '../assets/sprites-hires/dome/*.png',
  { eager: true }
)

function buildSpriteMap(glob: Record<string, { default: string }>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [path, mod] of Object.entries(glob)) {
    // Extract key from path: "../assets/sprites/dome/dome_glass.png" → "dome_glass"
    const filename = path.split('/').pop()?.replace('.png', '')
    if (filename) {
      map[filename] = mod.default
    }
  }
  return map
}

const loResMap = buildSpriteMap(loResGlob)
const hiResMap = buildSpriteMap(hiResGlob)

/**
 * Get sprite URL map for the given resolution.
 * @param resolution - 'low' for 32px sprites, 'high' for 256px sprites
 * @returns A record mapping dome sprite keys to their URL strings
 */
export function getDomeSpriteUrls(resolution: 'low' | 'high'): Record<string, string> {
  return resolution === 'high' ? hiResMap : loResMap
}
