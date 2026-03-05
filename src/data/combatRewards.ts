/**
 * Combat reward tables for Phase 36: Combat System.
 * Maps creature IDs to companion XP, boss IDs to relic drops,
 * and defines the The Deep-specific reward constants.
 */

/** Companion XP awarded for defeating each creature. */
export const CREATURE_COMPANION_XP: Record<string, number> = {
  creature_glow_sprite:        5,
  creature_stone_crab:         8,
  creature_dust_mite:          6,
  creature_lava_salamander:   12,
  creature_crystal_shard:     15,
  creature_shadow_eel:         10,
  creature_void_crawler:       20,
  creature_magma_golem:        25,
  creature_ancient_worm:       22,
  creature_echo_wraith:        30,
  creature_void_horror:        40,
  creature_deep_spectre:       35,
}

/** Boss relic drop IDs. Key = boss template ID. */
export const BOSS_RELIC_DROPS: Record<string, string> = {
  boss_crystal_golem:    'relic_crystal_heart',
  boss_lava_wyrm:        'relic_wyrm_scale',
  boss_deep_leviathan:   'relic_leviathan_fin',
  boss_void_sentinel:    'relic_void_eye',
}

/**
 * Mineral yield multiplier applied to ALL loot collected on the current layer
 * after a boss is defeated. Stacks additively with relic bonuses.
 */
export const BOSS_LAYER_LOOT_MULTIPLIER = 1.5

/** Creature kills required to unlock the 'Abyss Walker' title. */
export const TITLE_UNLOCK_CREATURE_KILLS = 50
