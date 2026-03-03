/**
 * Per-biome ambient particle configurations.
 * Phase 9.5 — drives the BiomeParticleManager.
 */

/** Configuration for a single ambient particle emitter. */
export interface ParticleConfig {
  /** Texture key of a preloaded particle sprite */
  texture: string
  /** Tint color (0xRRGGBB) */
  tint: number
  /** Alpha range */
  alpha: { min: number; max: number }
  /** Scale range */
  scale: { min: number; max: number }
  /** Speed range in px/s */
  speed: { min: number; max: number }
  /** Lifespan in ms */
  lifespan: { min: number; max: number }
  /** Particles emitted per second */
  frequency: number
  /** Blend mode: 0=NORMAL, 1=ADD */
  blendMode: number
  /** Direction of travel in degrees */
  angle?: { min: number; max: number }
  /** Gravity modifier (negative = rise) */
  gravityY?: number
}

/** Particle configurations per biome. 1-3 emitters per biome. */
export const BIOME_PARTICLE_CONFIGS: Record<string, ParticleConfig[]> = {
  // Shallow
  limestone_caves: [
    { texture: 'particle_dot', tint: 0xd4c8a8, alpha: { min: 0.1, max: 0.3 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 2, max: 8 }, lifespan: { min: 3000, max: 6000 }, frequency: 2, blendMode: 1, gravityY: -5 },
  ],
  clay_basin: [
    { texture: 'particle_dot', tint: 0xc4a882, alpha: { min: 0.1, max: 0.25 }, scale: { min: 0.2, max: 0.5 }, speed: { min: 1, max: 5 }, lifespan: { min: 4000, max: 7000 }, frequency: 1.5, blendMode: 0, gravityY: 3 },
  ],
  iron_seam: [
    { texture: 'particle_dot', tint: 0xcc8844, alpha: { min: 0.15, max: 0.35 }, scale: { min: 0.2, max: 0.4 }, speed: { min: 3, max: 8 }, lifespan: { min: 2000, max: 4000 }, frequency: 2, blendMode: 1, gravityY: -3 },
  ],
  root_tangle: [
    { texture: 'particle_dot', tint: 0x88cc66, alpha: { min: 0.1, max: 0.3 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 2, max: 6 }, lifespan: { min: 3000, max: 5000 }, frequency: 2.5, blendMode: 1, gravityY: -8 },
    { texture: 'particle_dot', tint: 0x336622, alpha: { min: 0.15, max: 0.3 }, scale: { min: 0.4, max: 0.7 }, speed: { min: 1, max: 4 }, lifespan: { min: 5000, max: 8000 }, frequency: 1, blendMode: 0, gravityY: 5 },
  ],
  peat_bog: [
    { texture: 'particle_dot', tint: 0x554433, alpha: { min: 0.1, max: 0.2 }, scale: { min: 0.3, max: 0.5 }, speed: { min: 1, max: 4 }, lifespan: { min: 4000, max: 7000 }, frequency: 1.5, blendMode: 0, gravityY: -3 },
  ],
  // Mid
  basalt_maze: [
    { texture: 'particle_dot', tint: 0x666688, alpha: { min: 0.1, max: 0.2 }, scale: { min: 0.2, max: 0.4 }, speed: { min: 2, max: 6 }, lifespan: { min: 3000, max: 5000 }, frequency: 1.5, blendMode: 0, gravityY: 3 },
  ],
  salt_flats: [
    { texture: 'particle_dot', tint: 0xeeeedd, alpha: { min: 0.2, max: 0.4 }, scale: { min: 0.2, max: 0.5 }, speed: { min: 4, max: 10 }, lifespan: { min: 1500, max: 3000 }, frequency: 3, blendMode: 1 },
  ],
  coal_veins: [
    { texture: 'particle_dot', tint: 0x333333, alpha: { min: 0.1, max: 0.2 }, scale: { min: 0.3, max: 0.5 }, speed: { min: 1, max: 4 }, lifespan: { min: 4000, max: 7000 }, frequency: 1, blendMode: 0, gravityY: 3 },
  ],
  granite_canyon: [
    { texture: 'particle_dot', tint: 0xaaa099, alpha: { min: 0.1, max: 0.2 }, scale: { min: 0.2, max: 0.4 }, speed: { min: 2, max: 5 }, lifespan: { min: 3000, max: 5000 }, frequency: 1, blendMode: 0, gravityY: 2 },
  ],
  sulfur_springs: [
    { texture: 'particle_dot', tint: 0xcccc00, alpha: { min: 0.15, max: 0.3 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 3, max: 8 }, lifespan: { min: 2000, max: 4000 }, frequency: 3, blendMode: 1, gravityY: -10 },
    { texture: 'particle_dot', tint: 0xaaaa44, alpha: { min: 0.1, max: 0.2 }, scale: { min: 0.2, max: 0.4 }, speed: { min: 1, max: 4 }, lifespan: { min: 3000, max: 5000 }, frequency: 1.5, blendMode: 0, gravityY: -5 },
  ],
  // Deep
  obsidian_rift: [
    { texture: 'particle_dot', tint: 0x440088, alpha: { min: 0.1, max: 0.25 }, scale: { min: 0.2, max: 0.4 }, speed: { min: 2, max: 6 }, lifespan: { min: 3000, max: 5000 }, frequency: 2, blendMode: 1, gravityY: -3 },
  ],
  magma_shelf: [
    { texture: 'particle_dot', tint: 0xff4400, alpha: { min: 0.3, max: 0.6 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 5, max: 15 }, lifespan: { min: 1500, max: 3000 }, frequency: 4, blendMode: 1, gravityY: -15 },
    { texture: 'particle_dot', tint: 0x444444, alpha: { min: 0.15, max: 0.3 }, scale: { min: 0.4, max: 0.7 }, speed: { min: 1, max: 4 }, lifespan: { min: 4000, max: 7000 }, frequency: 1.5, blendMode: 0, gravityY: 3 },
  ],
  crystal_geode: [
    { texture: 'particle_dot', tint: 0x44aaff, alpha: { min: 0.2, max: 0.5 }, scale: { min: 0.2, max: 0.5 }, speed: { min: 3, max: 8 }, lifespan: { min: 2000, max: 4000 }, frequency: 3, blendMode: 1 },
    { texture: 'particle_dot', tint: 0xccffff, alpha: { min: 0.3, max: 0.6 }, scale: { min: 0.1, max: 0.3 }, speed: { min: 5, max: 12 }, lifespan: { min: 500, max: 1500 }, frequency: 2, blendMode: 1 },
  ],
  fossil_layer: [
    { texture: 'particle_dot', tint: 0xccaa66, alpha: { min: 0.1, max: 0.25 }, scale: { min: 0.3, max: 0.5 }, speed: { min: 1, max: 4 }, lifespan: { min: 4000, max: 7000 }, frequency: 1.5, blendMode: 1 },
  ],
  quartz_halls: [
    { texture: 'particle_dot', tint: 0xffffff, alpha: { min: 0.2, max: 0.5 }, scale: { min: 0.1, max: 0.3 }, speed: { min: 4, max: 10 }, lifespan: { min: 1000, max: 2500 }, frequency: 3, blendMode: 1 },
  ],
  // Extreme
  primordial_mantle: [
    { texture: 'particle_dot', tint: 0xff6600, alpha: { min: 0.3, max: 0.6 }, scale: { min: 0.3, max: 0.7 }, speed: { min: 5, max: 15 }, lifespan: { min: 1500, max: 3000 }, frequency: 4, blendMode: 1, gravityY: -15 },
    { texture: 'particle_dot', tint: 0xffcc00, alpha: { min: 0.4, max: 0.7 }, scale: { min: 0.1, max: 0.3 }, speed: { min: 8, max: 20 }, lifespan: { min: 500, max: 1500 }, frequency: 2, blendMode: 1 },
  ],
  iron_core_fringe: [
    { texture: 'particle_dot', tint: 0xcc6622, alpha: { min: 0.2, max: 0.4 }, scale: { min: 0.3, max: 0.5 }, speed: { min: 3, max: 8 }, lifespan: { min: 2000, max: 4000 }, frequency: 2.5, blendMode: 1, gravityY: -8 },
  ],
  pressure_dome: [
    { texture: 'particle_dot', tint: 0x4488cc, alpha: { min: 0.15, max: 0.35 }, scale: { min: 0.2, max: 0.4 }, speed: { min: 2, max: 6 }, lifespan: { min: 3000, max: 5000 }, frequency: 2, blendMode: 1 },
  ],
  deep_biolume: [
    { texture: 'particle_dot', tint: 0x00ffcc, alpha: { min: 0.2, max: 0.5 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 2, max: 6 }, lifespan: { min: 3000, max: 6000 }, frequency: 3, blendMode: 1, gravityY: -5 },
    { texture: 'particle_dot', tint: 0x0088ff, alpha: { min: 0.15, max: 0.35 }, scale: { min: 0.1, max: 0.3 }, speed: { min: 3, max: 8 }, lifespan: { min: 1500, max: 3000 }, frequency: 2, blendMode: 1 },
  ],
  tectonic_scar: [
    { texture: 'particle_dot', tint: 0xcc0000, alpha: { min: 0.2, max: 0.4 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 4, max: 10 }, lifespan: { min: 2000, max: 4000 }, frequency: 3, blendMode: 1, gravityY: -10 },
    { texture: 'particle_dot', tint: 0x666666, alpha: { min: 0.1, max: 0.2 }, scale: { min: 0.4, max: 0.7 }, speed: { min: 1, max: 4 }, lifespan: { min: 4000, max: 7000 }, frequency: 1, blendMode: 0, gravityY: 3 },
  ],
  // Anomaly
  temporal_rift: [
    { texture: 'particle_dot', tint: 0xcc99ff, alpha: { min: 0.2, max: 0.5 }, scale: { min: 0.2, max: 0.5 }, speed: { min: 3, max: 8 }, lifespan: { min: 1500, max: 3000 }, frequency: 3, blendMode: 1 },
    { texture: 'particle_dot', tint: 0xffcc44, alpha: { min: 0.3, max: 0.5 }, scale: { min: 0.1, max: 0.2 }, speed: { min: 5, max: 12 }, lifespan: { min: 500, max: 1500 }, frequency: 2, blendMode: 1 },
  ],
  alien_intrusion: [
    { texture: 'particle_dot', tint: 0x00ff88, alpha: { min: 0.2, max: 0.5 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 3, max: 8 }, lifespan: { min: 2000, max: 4000 }, frequency: 3, blendMode: 1 },
  ],
  bioluminescent: [
    { texture: 'particle_dot', tint: 0x00ffcc, alpha: { min: 0.3, max: 0.6 }, scale: { min: 0.3, max: 0.7 }, speed: { min: 2, max: 6 }, lifespan: { min: 3000, max: 6000 }, frequency: 4, blendMode: 1, gravityY: -5 },
    { texture: 'particle_dot', tint: 0x44ffaa, alpha: { min: 0.2, max: 0.4 }, scale: { min: 0.1, max: 0.3 }, speed: { min: 4, max: 10 }, lifespan: { min: 1000, max: 2500 }, frequency: 2, blendMode: 1 },
  ],
  void_pocket: [
    { texture: 'particle_dot', tint: 0x440088, alpha: { min: 0.1, max: 0.3 }, scale: { min: 0.3, max: 0.6 }, speed: { min: 2, max: 5 }, lifespan: { min: 4000, max: 7000 }, frequency: 1.5, blendMode: 1 },
  ],
  echo_chamber: [
    { texture: 'particle_dot', tint: 0x8888cc, alpha: { min: 0.1, max: 0.3 }, scale: { min: 0.2, max: 0.4 }, speed: { min: 2, max: 6 }, lifespan: { min: 3000, max: 5000 }, frequency: 2, blendMode: 1 },
  ],
}
