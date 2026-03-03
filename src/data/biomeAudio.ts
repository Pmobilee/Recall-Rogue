/**
 * Per-biome audio configuration.
 * Phase 9.7 — drives the AudioManager crossfading system.
 */

/** Volume profile for a biome's audio. */
export interface VolumeProfile {
  /** Master volume for ambient loop (0.0-1.0) */
  ambientVolume: number
  /** Master volume for hazard SFX (0.0-1.0) */
  hazardVolume: number
  /** Duration in ms for crossfade between biome tracks */
  crossfadeDuration: number
}

/** Audio configuration for a single biome. */
export interface BiomeAudio {
  /** Biome identifier */
  biomeId: string
  /** Phaser audio key for the looping ambient track */
  ambientLoop: string
  /** Array of Phaser audio keys for hazard-specific SFX */
  hazardSfx: string[]
  /** Short sting played once when entering this biome */
  transitionSting: string
  /** Volume and crossfade settings */
  volumeProfile: VolumeProfile
}

/** Audio configs for all 25 biomes. Audio files are placeholders until real assets are produced. */
export const BIOME_AUDIO: Record<string, BiomeAudio> = {
  // Shallow
  limestone_caves: { biomeId: 'limestone_caves', ambientLoop: 'bgm_limestone_loop', hazardSfx: ['sfx_limestone_crumble'], transitionSting: 'sting_limestone', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  clay_basin: { biomeId: 'clay_basin', ambientLoop: 'bgm_clay_loop', hazardSfx: ['sfx_clay_crack'], transitionSting: 'sting_clay', volumeProfile: { ambientVolume: 0.3, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  iron_seam: { biomeId: 'iron_seam', ambientLoop: 'bgm_iron_loop', hazardSfx: ['sfx_iron_clang'], transitionSting: 'sting_iron', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.7, crossfadeDuration: 1200 } },
  root_tangle: { biomeId: 'root_tangle', ambientLoop: 'bgm_roots_loop', hazardSfx: ['sfx_roots_snap', 'sfx_roots_creak'], transitionSting: 'sting_roots', volumeProfile: { ambientVolume: 0.3, hazardVolume: 0.6, crossfadeDuration: 1800 } },
  peat_bog: { biomeId: 'peat_bog', ambientLoop: 'bgm_peat_loop', hazardSfx: ['sfx_peat_gurgle'], transitionSting: 'sting_peat', volumeProfile: { ambientVolume: 0.3, hazardVolume: 0.6, crossfadeDuration: 2000 } },
  // Mid
  basalt_maze: { biomeId: 'basalt_maze', ambientLoop: 'bgm_basalt_loop', hazardSfx: ['sfx_basalt_crack', 'sfx_basalt_lava'], transitionSting: 'sting_basalt', volumeProfile: { ambientVolume: 0.4, hazardVolume: 0.7, crossfadeDuration: 1000 } },
  salt_flats: { biomeId: 'salt_flats', ambientLoop: 'bgm_salt_loop', hazardSfx: ['sfx_salt_crunch'], transitionSting: 'sting_salt', volumeProfile: { ambientVolume: 0.3, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  coal_veins: { biomeId: 'coal_veins', ambientLoop: 'bgm_coal_loop', hazardSfx: ['sfx_coal_gas_hiss', 'sfx_coal_collapse'], transitionSting: 'sting_coal', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.75, crossfadeDuration: 1200 } },
  granite_canyon: { biomeId: 'granite_canyon', ambientLoop: 'bgm_granite_loop', hazardSfx: ['sfx_granite_echo'], transitionSting: 'sting_granite', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  sulfur_springs: { biomeId: 'sulfur_springs', ambientLoop: 'bgm_sulfur_loop', hazardSfx: ['sfx_sulfur_hiss', 'sfx_sulfur_bubble'], transitionSting: 'sting_sulfur', volumeProfile: { ambientVolume: 0.4, hazardVolume: 0.7, crossfadeDuration: 1000 } },
  // Deep
  obsidian_rift: { biomeId: 'obsidian_rift', ambientLoop: 'bgm_obsidian_loop', hazardSfx: ['sfx_obsidian_shatter', 'sfx_obsidian_lava'], transitionSting: 'sting_obsidian', volumeProfile: { ambientVolume: 0.4, hazardVolume: 0.75, crossfadeDuration: 800 } },
  magma_shelf: { biomeId: 'magma_shelf', ambientLoop: 'bgm_magma_loop', hazardSfx: ['sfx_magma_burst', 'sfx_magma_flow', 'sfx_magma_explosion'], transitionSting: 'sting_magma', volumeProfile: { ambientVolume: 0.5, hazardVolume: 0.8, crossfadeDuration: 800 } },
  crystal_geode: { biomeId: 'crystal_geode', ambientLoop: 'bgm_crystal_loop', hazardSfx: ['sfx_crystal_chime', 'sfx_crystal_shatter'], transitionSting: 'sting_crystal', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  fossil_layer: { biomeId: 'fossil_layer', ambientLoop: 'bgm_fossil_loop', hazardSfx: ['sfx_fossil_crumble'], transitionSting: 'sting_fossil', volumeProfile: { ambientVolume: 0.3, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  quartz_halls: { biomeId: 'quartz_halls', ambientLoop: 'bgm_quartz_loop', hazardSfx: ['sfx_quartz_ring', 'sfx_quartz_crack'], transitionSting: 'sting_quartz', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.65, crossfadeDuration: 1200 } },
  // Extreme
  primordial_mantle: { biomeId: 'primordial_mantle', ambientLoop: 'bgm_mantle_loop', hazardSfx: ['sfx_mantle_rumble', 'sfx_mantle_lava'], transitionSting: 'sting_mantle', volumeProfile: { ambientVolume: 0.5, hazardVolume: 0.8, crossfadeDuration: 800 } },
  iron_core_fringe: { biomeId: 'iron_core_fringe', ambientLoop: 'bgm_core_loop', hazardSfx: ['sfx_core_groan', 'sfx_core_crack'], transitionSting: 'sting_core', volumeProfile: { ambientVolume: 0.45, hazardVolume: 0.8, crossfadeDuration: 800 } },
  pressure_dome: { biomeId: 'pressure_dome', ambientLoop: 'bgm_pressure_loop', hazardSfx: ['sfx_pressure_hiss', 'sfx_pressure_crack'], transitionSting: 'sting_pressure', volumeProfile: { ambientVolume: 0.4, hazardVolume: 0.75, crossfadeDuration: 1000 } },
  deep_biolume: { biomeId: 'deep_biolume', ambientLoop: 'bgm_biolume_loop', hazardSfx: ['sfx_biolume_pulse'], transitionSting: 'sting_biolume', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  tectonic_scar: { biomeId: 'tectonic_scar', ambientLoop: 'bgm_tectonic_loop', hazardSfx: ['sfx_tectonic_quake', 'sfx_tectonic_crack', 'sfx_tectonic_lava'], transitionSting: 'sting_tectonic', volumeProfile: { ambientVolume: 0.5, hazardVolume: 0.85, crossfadeDuration: 600 } },
  // Anomaly
  temporal_rift: { biomeId: 'temporal_rift', ambientLoop: 'bgm_temporal_loop', hazardSfx: ['sfx_temporal_echo', 'sfx_temporal_warp'], transitionSting: 'sting_temporal', volumeProfile: { ambientVolume: 0.4, hazardVolume: 0.7, crossfadeDuration: 1000 } },
  alien_intrusion: { biomeId: 'alien_intrusion', ambientLoop: 'bgm_alien_loop', hazardSfx: ['sfx_alien_pulse', 'sfx_alien_hum'], transitionSting: 'sting_alien', volumeProfile: { ambientVolume: 0.4, hazardVolume: 0.7, crossfadeDuration: 1000 } },
  bioluminescent: { biomeId: 'bioluminescent', ambientLoop: 'bgm_bioluminescent_loop', hazardSfx: ['sfx_bioluminescent_pulse'], transitionSting: 'sting_bioluminescent', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.6, crossfadeDuration: 1500 } },
  void_pocket: { biomeId: 'void_pocket', ambientLoop: 'bgm_void_loop', hazardSfx: ['sfx_void_tear', 'sfx_void_collapse'], transitionSting: 'sting_void', volumeProfile: { ambientVolume: 0.3, hazardVolume: 0.75, crossfadeDuration: 1200 } },
  echo_chamber: { biomeId: 'echo_chamber', ambientLoop: 'bgm_echo_loop', hazardSfx: ['sfx_echo_reverberate'], transitionSting: 'sting_echo', volumeProfile: { ambientVolume: 0.35, hazardVolume: 0.65, crossfadeDuration: 1500 } },
}
