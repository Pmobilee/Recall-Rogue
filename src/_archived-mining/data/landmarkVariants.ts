/**
 * Biome-specific visual overrides for the four landmark layers.
 * Phase 9.6 — 25 biomes × 4 landmarks = 100 variants (with fallback).
 */

/** Biome-specific visual override for a landmark layer. */
export interface LandmarkVariant {
  /** e.g. 'gauntlet', 'treasure_vault', 'ancient_archive', 'completion_event' */
  landmarkId: string
  /** Biome identifier */
  biomeId: string
  /** 0xRRGGBB color tint applied to landmark tiles. 0xFFFFFF = no tint (identity). */
  colorTint: number
  /** Particle config keys from BIOME_PARTICLE_CONFIGS to activate inside the landmark */
  specialEffects: string[]
}

/** All landmark variant entries. */
export const LANDMARK_VARIANTS: LandmarkVariant[] = [
  // Gauntlet (L5) — all 25 biomes
  { landmarkId: 'gauntlet', biomeId: 'limestone_caves', colorTint: 0xd4c8a8, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'clay_basin', colorTint: 0xc4a882, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'iron_seam', colorTint: 0xcc8844, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'root_tangle', colorTint: 0x4a7c3f, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'peat_bog', colorTint: 0x3d2b1f, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'basalt_maze', colorTint: 0x555566, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'salt_flats', colorTint: 0xe8e8dd, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'coal_veins', colorTint: 0x333333, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'granite_canyon', colorTint: 0x888080, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'sulfur_springs', colorTint: 0xaaaa44, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'obsidian_rift', colorTint: 0x220044, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'magma_shelf', colorTint: 0xff4400, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'crystal_geode', colorTint: 0x88ddff, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'fossil_layer', colorTint: 0x887766, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'quartz_halls', colorTint: 0xeeeeff, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'primordial_mantle', colorTint: 0xff6600, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'iron_core_fringe', colorTint: 0xaa4400, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'pressure_dome', colorTint: 0x4488cc, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'deep_biolume', colorTint: 0x006688, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'tectonic_scar', colorTint: 0x880000, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'temporal_rift', colorTint: 0x8800ff, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'alien_intrusion', colorTint: 0x00ff88, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'bioluminescent', colorTint: 0x00ffcc, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'void_pocket', colorTint: 0x220033, specialEffects: [] },
  { landmarkId: 'gauntlet', biomeId: 'echo_chamber', colorTint: 0x666699, specialEffects: [] },

  // Treasure Vault (L10)
  { landmarkId: 'treasure_vault', biomeId: 'limestone_caves', colorTint: 0xddcc99, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'clay_basin', colorTint: 0xccaa77, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'iron_seam', colorTint: 0xcc8844, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'root_tangle', colorTint: 0x66aa55, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'peat_bog', colorTint: 0x554433, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'basalt_maze', colorTint: 0x444455, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'salt_flats', colorTint: 0xddddcc, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'coal_veins', colorTint: 0x444444, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'granite_canyon', colorTint: 0x999999, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'sulfur_springs', colorTint: 0xcccc44, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'obsidian_rift', colorTint: 0x330055, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'magma_shelf', colorTint: 0xee5500, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'crystal_geode', colorTint: 0xccffff, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'fossil_layer', colorTint: 0xaa9977, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'quartz_halls', colorTint: 0xffffff, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'primordial_mantle', colorTint: 0xff8800, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'iron_core_fringe', colorTint: 0xcc5500, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'pressure_dome', colorTint: 0x5599cc, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'deep_biolume', colorTint: 0x007799, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'tectonic_scar', colorTint: 0xaa2200, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'temporal_rift', colorTint: 0xaa44ff, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'alien_intrusion', colorTint: 0x44ffaa, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'bioluminescent', colorTint: 0x44ffee, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'void_pocket', colorTint: 0x330044, specialEffects: [] },
  { landmarkId: 'treasure_vault', biomeId: 'echo_chamber', colorTint: 0x7777aa, specialEffects: [] },

  // Ancient Archive (L15)
  { landmarkId: 'ancient_archive', biomeId: 'limestone_caves', colorTint: 0xccbb88, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'clay_basin', colorTint: 0xbb9966, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'iron_seam', colorTint: 0xbb7733, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'root_tangle', colorTint: 0x559944, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'peat_bog', colorTint: 0x443322, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'basalt_maze', colorTint: 0x333344, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'salt_flats', colorTint: 0xccccbb, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'coal_veins', colorTint: 0x333333, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'granite_canyon', colorTint: 0x888888, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'sulfur_springs', colorTint: 0xbbbb33, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'obsidian_rift', colorTint: 0x220044, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'magma_shelf', colorTint: 0xdd4400, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'crystal_geode', colorTint: 0xaaeeff, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'fossil_layer', colorTint: 0xaa8866, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'quartz_halls', colorTint: 0xeeeeff, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'primordial_mantle', colorTint: 0xee5500, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'iron_core_fringe', colorTint: 0xbb4400, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'pressure_dome', colorTint: 0x4488bb, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'deep_biolume', colorTint: 0x006677, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'tectonic_scar', colorTint: 0x990000, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'temporal_rift', colorTint: 0x9933ee, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'alien_intrusion', colorTint: 0x33ee88, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'bioluminescent', colorTint: 0x33eebb, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'void_pocket', colorTint: 0x220033, specialEffects: [] },
  { landmarkId: 'ancient_archive', biomeId: 'echo_chamber', colorTint: 0x555588, specialEffects: [] },

  // Completion Event (L20)
  { landmarkId: 'completion_event', biomeId: 'limestone_caves', colorTint: 0xeeddaa, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'clay_basin', colorTint: 0xddbb88, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'iron_seam', colorTint: 0xdd9955, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'root_tangle', colorTint: 0x77cc66, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'peat_bog', colorTint: 0x665544, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'basalt_maze', colorTint: 0x555566, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'salt_flats', colorTint: 0xeeeedd, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'coal_veins', colorTint: 0x555555, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'granite_canyon', colorTint: 0xaaaaaa, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'sulfur_springs', colorTint: 0xdddd55, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'obsidian_rift', colorTint: 0x440066, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'magma_shelf', colorTint: 0xff6600, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'crystal_geode', colorTint: 0xddffff, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'fossil_layer', colorTint: 0xccaa88, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'quartz_halls', colorTint: 0xffffff, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'primordial_mantle', colorTint: 0xff8800, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'iron_core_fringe', colorTint: 0xdd6600, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'pressure_dome', colorTint: 0x66aadd, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'deep_biolume', colorTint: 0x0088aa, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'tectonic_scar', colorTint: 0xbb2200, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'temporal_rift', colorTint: 0xbb55ff, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'alien_intrusion', colorTint: 0x55ffaa, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'bioluminescent', colorTint: 0x55ffdd, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'void_pocket', colorTint: 0x440055, specialEffects: [] },
  { landmarkId: 'completion_event', biomeId: 'echo_chamber', colorTint: 0x8888bb, specialEffects: [] },
]

/** Default no-op variant used as fallback when no specific variant exists. */
const DEFAULT_VARIANT: Omit<LandmarkVariant, 'landmarkId' | 'biomeId'> = {
  colorTint: 0xFFFFFF,
  specialEffects: [],
}

/**
 * Looks up the variant for a given landmark and biome.
 * Falls back to a default no-op variant if not found.
 */
export function getLandmarkVariant(
  landmarkId: string,
  biomeId: string,
): LandmarkVariant {
  return (
    LANDMARK_VARIANTS.find(
      v => v.landmarkId === landmarkId && v.biomeId === biomeId,
    ) ?? {
      landmarkId,
      biomeId,
      ...DEFAULT_VARIANT,
    }
  )
}
