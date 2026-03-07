/** All dome sprite keys */
export const DOME_SPRITE_KEYS = [
  // tiles
  'dome_glass', 'dome_frame', 'stone_floor', 'metal_platform',
  'interior_wall', 'dirt_ground', 'dome_glass_curved',
  'wood_planks', 'crystal_floor', 'stone_wall', 'crystal_wall',
  // Floor backgrounds (Decorator)
  'floor_bg_steel_grate', 'floor_bg_mossy_stone', 'floor_bg_crystal_tiles',
  'floor_bg_lava_rock', 'floor_bg_starfield',
  // Painting sprites (generated in Phase 34; placeholders during Phase 47)
  'painting_locked',
  'painting_first_light', 'painting_deep_dive', 'painting_tree',
  'painting_flame', 'painting_atlas', 'painting_crystal_garden',
  'painting_relic_hunter', 'painting_scholar', 'painting_century',
  'painting_golem', 'painting_wyrm_tame', 'painting_family',
  'painting_sentinel', 'painting_complete_atlas', 'painting_omniscient',
  'painting_perfect_year', 'painting_library', 'painting_home',
  'painting_seasons',
  // knowledge tree stages
  'obj_knowledge_tree_stage0', 'obj_knowledge_tree_stage1',
  'obj_knowledge_tree_stage2', 'obj_knowledge_tree_stage3',
  'obj_knowledge_tree_stage4', 'obj_knowledge_tree_stage5',
  // pet sprites
  'pet_trilobite_walk', 'pet_trilobite_idle',
  'pet_mammoth_walk', 'pet_mammoth_idle',
  // decorations
  'deco_ceiling_light', 'deco_plant_pot', 'deco_wall_monitor',
  // gaia
  'gaia_neutral', 'gaia_happy', 'gaia_thinking',
  'gaia_snarky', 'gaia_surprised', 'gaia_calm',
  // backgrounds
  'sky_stars', 'surface_ground',
] as const

export type DomeSpriteKey = typeof DOME_SPRITE_KEYS[number]

// Build URL maps pointing to public/ directory sprites
import { supportsWebP } from './spriteManifest'

const base = import.meta.env.BASE_URL ?? '/'

function buildSpriteMap(dir: string): Record<string, string> {
  const ext = supportsWebP() ? '.webp' : '.png'
  const map: Record<string, string> = {}
  for (const key of DOME_SPRITE_KEYS) {
    map[key] = `${base}assets/${dir}/dome/${key}${ext}`
  }
  return map
}

/** Lazy-initialized URL maps — deferred until first call so DOM is available for WebP detection. */
let loResMap: Record<string, string> | null = null
let hiResMap: Record<string, string> | null = null

/**
 * Get sprite URL map for the given resolution.
 * @param resolution - 'low' for 32px sprites, 'high' for 256px sprites
 * @returns A record mapping dome sprite keys to their URL strings
 */
export function getDomeSpriteUrls(resolution: 'low' | 'high'): Record<string, string> {
  if (!loResMap) loResMap = buildSpriteMap('sprites')
  if (!hiResMap) hiResMap = buildSpriteMap('sprites-hires')
  return resolution === 'high' ? hiResMap : loResMap
}
