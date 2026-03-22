/**
 * roomAtmosphere.ts
 *
 * Master atmosphere configuration for each floor theme.
 * Consumed by CombatAtmosphereSystem and future AR-216/217/219-221 systems.
 */

/** Visual theme tied to dungeon floor range. */
export type FloorTheme = 'dust' | 'embers' | 'ice' | 'arcane' | 'void'

/** Full atmosphere configuration for a floor theme. */
export interface AtmosphereConfig {
  theme: FloorTheme

  // ── Color grading ─────────────────────────────────────────
  /** Hex color applied via setTint() on enemy sprites. */
  spriteTint: number
  /** Hex color applied as a tint overlay on the background. */
  backgroundTint: number
  /** Camera color matrix settings for saturation/brightness grading. */
  cameraColorMatrix: { saturation: number; brightness: number; hueRotate?: number }

  // ── Ground shadow ─────────────────────────────────────────
  /** Opacity of the ground contact shadow. Range 0.0–1.0. */
  shadowAlpha: number
  /** Hex color of the ground contact shadow. */
  shadowTint: number

  // ── Ambient occlusion ─────────────────────────────────────
  /** Strength of the ambient occlusion darkening at sprite bases. Range 0.0–0.4. */
  aoStrength: number

  // ── Fog ───────────────────────────────────────────────────
  /** Base opacity of the foreground fog layer. Range 0.0–0.25. */
  fogAlpha: number
  /** Hex color of the fog overlay. */
  fogTint: number

  // ── Particles ─────────────────────────────────────────────
  /** Ambient particle configuration. */
  particles: {
    /** Visual type label for the particle system. */
    type: 'dust' | 'embers' | 'ice_crystals' | 'arcane_runes' | 'void_wisps' | 'none'
    /** Array of hex tint colors; one is picked randomly per particle. */
    tints: number[]
    /** Vertical gravity applied to particles (negative = float up). */
    gravityY: number
    /** [min, max] scale range for particles at spawn. */
    scaleRange: [number, number]
    /** Maximum simultaneous background-layer particles. */
    maxBack: number
    /** Maximum simultaneous foreground-layer particles. */
    maxFront: number
    /** Phaser blend mode for particles. */
    blendMode: 'ADD' | 'NORMAL'
    /** Particle lifespan in milliseconds. */
    lifespan: number
    /** Spawn frequency in milliseconds between particles. */
    frequency: number
  }

  // ── Light shafts ──────────────────────────────────────────
  /** Volumetric light shaft configuration. */
  lightShafts: {
    enabled: boolean
    count: number
    /** Hex tint of the light shafts. */
    tint: number
    /** Opacity of the light shafts. */
    alpha: number
    /** Angle in degrees from vertical. */
    angle: number
  }

  // ── Lighting (AR-219) ─────────────────────────────────────
  /** Dynamic point-light configuration for future AR-219 integration. */
  lighting: {
    /** Hex color of ambient scene light. */
    ambientColor: number
    /** Array of point lights placed in the scene. */
    lights: Array<{
      /** Horizontal position as fraction of scene width (0.0–1.0). */
      xPct: number
      /** Vertical position as fraction of scene height (0.0–1.0). */
      yPct: number
      /** Light radius in pixels. */
      radius: number
      /** Hex color of the light. */
      color: number
      /** Light intensity multiplier. */
      intensity: number
      /** Optional flicker strength (0.0–1.0). Omit for steady light. */
      flicker?: number
    }>
  }

  // ── Rim lighting (AR-220) ─────────────────────────────────
  /** Rim/edge lighting applied to sprites for future AR-220 integration. */
  rim: {
    /** Hex color of the rim light. */
    color: number
    /** Intensity of the rim effect (0.0–1.0). */
    intensity: number
    /** Normalised 2D light direction vector [x, y]. */
    lightDir: [number, number]
  }

  // ── Parallax (AR-221) ────────────────────────────────────
  /** Background parallax sway configuration for future AR-221 integration. */
  parallax: {
    /** Horizontal sway amplitude in pixels. */
    swayAmplitudeX: number
    /** Vertical sway amplitude in pixels. */
    swayAmplitudeY: number
    /** Duration of one sway cycle in milliseconds. */
    swayDuration: number
  }

  // ── Heat haze (AR-221) ────────────────────────────────────
  /** Heat-haze distortion shader config for future AR-221 integration. */
  haze: {
    enabled: boolean
    /** Distortion strength (e.g. 0.005). */
    strength: number
    /** Vertical start position as fraction of scene height (0.0–1.0). */
    yStart: number
  }

  // ── Micro-animation (AR-221) ──────────────────────────────
  /** Micro-animation oscillation config for future AR-221 integration. */
  microAnimation: {
    /** Base oscillation frequency for ambient sway (radians per ms). */
    oscillatorFreq: number
    /** Enemy-specific reaction type. */
    enemyReaction: 'none' | 'torch_flicker' | 'ice_shiver' | 'arcane_pulse' | 'void_phase'
    /** Scale of the enemy reaction effect (0.0–1.0). */
    reactionIntensity: number
  }
}

/** Master presets for all five floor themes. */
export const ATMOSPHERE_PRESETS: Record<FloorTheme, AtmosphereConfig> = {
  // ── Dust — floors 1-3 — warm amber, cave torch ─────────────────────────
  dust: {
    theme: 'dust',
    spriteTint: 0xFFF0E0,
    backgroundTint: 0xFFE8D0,
    cameraColorMatrix: { saturation: -0.1, brightness: 1.0 },
    shadowAlpha: 0.35,
    shadowTint: 0x1a0f05,
    aoStrength: 0.1,
    fogAlpha: 0.04,
    fogTint: 0xd4c4a0,
    particles: {
      type: 'dust',
      tints: [0xd4c4a0, 0xc8b888, 0xbca870, 0xe0d4b8],
      gravityY: 10,
      scaleRange: [1.0, 2.5],
      maxBack: 30,
      maxFront: 12,
      blendMode: 'NORMAL',
      lifespan: 6000,
      frequency: 200,
    },
    lightShafts: { enabled: true, count: 2, tint: 0xFFEECC, alpha: 0.3, angle: 10 },
    lighting: {
      ambientColor: 0x332211,
      lights: [
        { xPct: 0.2, yPct: 0.3, radius: 350, color: 0xff8833, intensity: 1.8, flicker: 0.15 },
        { xPct: 0.8, yPct: 0.5, radius: 250, color: 0xff9944, intensity: 1.2, flicker: 0.1 },
      ],
    },
    rim: { color: 0xff8833, intensity: 0.4, lightDir: [-0.7, -0.3] },
    parallax: { swayAmplitudeX: 3, swayAmplitudeY: 2, swayDuration: 5000 },
    haze: { enabled: false, strength: 0, yStart: 0 },
    microAnimation: { oscillatorFreq: 0.003, enemyReaction: 'torch_flicker', reactionIntensity: 0.3 },
  },

  // ── Embers — floors 4-6 — hot orange, lava ─────────────────────────────
  embers: {
    theme: 'embers',
    spriteTint: 0xFFE0CC,
    backgroundTint: 0xFFD8BB,
    cameraColorMatrix: { saturation: 0.1, brightness: 1.0 },
    shadowAlpha: 0.25,
    shadowTint: 0x220808,
    aoStrength: 0.18,
    fogAlpha: 0.06,
    fogTint: 0xff6600,
    particles: {
      type: 'embers',
      tints: [0xfacc22, 0xf89800, 0xf83600, 0x9f0404],
      gravityY: -40,
      scaleRange: [0.8, 2.0],
      maxBack: 25,
      maxFront: 35,
      blendMode: 'ADD',
      lifespan: 2500,
      frequency: 80,
    },
    lightShafts: { enabled: true, count: 1, tint: 0xFF8844, alpha: 0.25, angle: 0 },
    lighting: {
      ambientColor: 0x1a0500,
      lights: [
        { xPct: 0.5, yPct: 0.9, radius: 500, color: 0xff4400, intensity: 2.2, flicker: 0.25 },
        { xPct: 0.3, yPct: 0.4, radius: 200, color: 0xff8800, intensity: 1.5, flicker: 0.2 },
        { xPct: 0.7, yPct: 0.3, radius: 200, color: 0xff6600, intensity: 1.5, flicker: 0.2 },
      ],
    },
    rim: { color: 0xff4400, intensity: 0.6, lightDir: [0.0, 0.7] },
    parallax: { swayAmplitudeX: 2, swayAmplitudeY: 1, swayDuration: 4000 },
    haze: { enabled: true, strength: 0.005, yStart: 0.5 },
    microAnimation: { oscillatorFreq: 0.004, enemyReaction: 'torch_flicker', reactionIntensity: 0.5 },
  },

  // ── Ice — floors 7-9 — cool blue ────────────────────────────────────────
  ice: {
    theme: 'ice',
    spriteTint: 0xDDEEFF,
    backgroundTint: 0xCCE8FF,
    cameraColorMatrix: { saturation: -0.15, brightness: 1.05 },
    shadowAlpha: 0.2,
    shadowTint: 0x051525,
    aoStrength: 0.08,
    fogAlpha: 0.06,
    fogTint: 0x88ccff,
    particles: {
      type: 'ice_crystals',
      tints: [0x88ccff, 0xaaddff, 0x66bbee, 0xcceeFF],
      gravityY: 5,
      scaleRange: [0.8, 2.0],
      maxBack: 35,
      maxFront: 15,
      blendMode: 'ADD',
      lifespan: 5000,
      frequency: 180,
    },
    lightShafts: { enabled: true, count: 1, tint: 0xAADDFF, alpha: 0.25, angle: -5 },
    lighting: {
      ambientColor: 0x0a1525,
      lights: [
        { xPct: 0.5, yPct: 0.1, radius: 500, color: 0x4488cc, intensity: 1.5 },
        { xPct: 0.2, yPct: 0.6, radius: 200, color: 0x66aadd, intensity: 0.8 },
      ],
    },
    rim: { color: 0x4488cc, intensity: 0.5, lightDir: [0.0, -0.8] },
    parallax: { swayAmplitudeX: 2, swayAmplitudeY: 1, swayDuration: 6000 },
    haze: { enabled: false, strength: 0, yStart: 0 },
    microAnimation: { oscillatorFreq: 0.002, enemyReaction: 'ice_shiver', reactionIntensity: 0.4 },
  },

  // ── Arcane — floors 10-12 — pale purple ─────────────────────────────────
  arcane: {
    theme: 'arcane',
    spriteTint: 0xEEE0F5,
    backgroundTint: 0xEED8F5,
    cameraColorMatrix: { saturation: 0.05, brightness: 1.0 },
    shadowAlpha: 0.3,
    shadowTint: 0x110822,
    aoStrength: 0.1,
    fogAlpha: 0.05,
    fogTint: 0xcc88ff,
    particles: {
      type: 'arcane_runes',
      tints: [0xcc88ff, 0xaa66ee, 0xdd99ff, 0xee88cc],
      gravityY: -15,
      scaleRange: [1.0, 2.5],
      maxBack: 25,
      maxFront: 20,
      blendMode: 'ADD',
      lifespan: 4000,
      frequency: 150,
    },
    lightShafts: { enabled: true, count: 2, tint: 0xCC88FF, alpha: 0.2, angle: 0 },
    lighting: {
      ambientColor: 0x110822,
      lights: [
        { xPct: 0.5, yPct: 0.2, radius: 400, color: 0xcc88ff, intensity: 1.8 },
        { xPct: 0.15, yPct: 0.7, radius: 200, color: 0xaa66ee, intensity: 1.0 },
        { xPct: 0.85, yPct: 0.7, radius: 200, color: 0xdd99ff, intensity: 1.0 },
      ],
    },
    rim: { color: 0xcc88ff, intensity: 0.5, lightDir: [0.0, -0.6] },
    parallax: { swayAmplitudeX: 4, swayAmplitudeY: 2, swayDuration: 7000 },
    haze: { enabled: false, strength: 0, yStart: 0 },
    microAnimation: { oscillatorFreq: 0.0025, enemyReaction: 'arcane_pulse', reactionIntensity: 0.4 },
  },

  // ── Void — floors 13+ — dark purple, abyss ──────────────────────────────
  void: {
    theme: 'void',
    spriteTint: 0xE0D0EE,
    backgroundTint: 0xD8C0E8,
    cameraColorMatrix: { saturation: -0.25, brightness: 0.95 },
    shadowAlpha: 0.4,
    shadowTint: 0x0a0515,
    aoStrength: 0.12,
    fogAlpha: 0.1,
    fogTint: 0x6633aa,
    particles: {
      type: 'void_wisps',
      tints: [0x8844cc, 0x6633aa, 0xaa55dd, 0x442266],
      gravityY: -15,
      scaleRange: [1.0, 3.0],
      maxBack: 30,
      maxFront: 30,
      blendMode: 'ADD',
      lifespan: 3500,
      frequency: 120,
    },
    lightShafts: { enabled: true, count: 1, tint: 0x8855CC, alpha: 0.2, angle: 0 },
    lighting: {
      ambientColor: 0x050210,
      lights: [
        { xPct: 0.5, yPct: 0.5, radius: 300, color: 0x8844cc, intensity: 2.0 },
        { xPct: 0.3, yPct: 0.2, radius: 150, color: 0x6633aa, intensity: 1.2 },
        { xPct: 0.7, yPct: 0.8, radius: 150, color: 0xaa55dd, intensity: 1.2 },
      ],
    },
    rim: { color: 0x8844cc, intensity: 0.7, lightDir: [0.3, -0.5] },
    parallax: { swayAmplitudeX: 5, swayAmplitudeY: 3, swayDuration: 8000 },
    haze: { enabled: true, strength: 0.003, yStart: 0.3 },
    microAnimation: { oscillatorFreq: 0.002, enemyReaction: 'void_phase', reactionIntensity: 0.5 },
  },
}

/**
 * Returns the floor theme for a given dungeon floor number.
 * @param floor Dungeon floor (1-based)
 */
export function getFloorTheme(floor: number): FloorTheme {
  if (floor <= 3) return 'dust'
  if (floor <= 6) return 'embers'
  if (floor <= 9) return 'ice'
  if (floor <= 12) return 'arcane'
  return 'void'
}

/**
 * Returns the atmosphere config for a given floor.
 * @param floor Dungeon floor (1-based)
 */
export function getAtmosphereConfig(floor: number): AtmosphereConfig {
  return ATMOSPHERE_PRESETS[getFloorTheme(floor)]
}

/**
 * Returns a boss-amplified atmosphere config for a given floor.
 * Intensifies fog, particles, lighting, and rim compared to the base preset.
 * @param floor Dungeon floor (1-based)
 */
export function getBossAtmosphereConfig(floor: number): AtmosphereConfig {
  const base = { ...ATMOSPHERE_PRESETS[getFloorTheme(floor)] }
  base.fogAlpha = Math.min(base.fogAlpha * 1.5, 0.25)
  base.particles = {
    ...base.particles,
    maxBack: Math.round(base.particles.maxBack * 1.3),
    maxFront: Math.round(base.particles.maxFront * 1.3),
  }
  base.lighting = {
    ...base.lighting,
    lights: base.lighting.lights.map(l => ({ ...l, intensity: l.intensity * 1.2 })),
  }
  base.rim = { ...base.rim, intensity: Math.min(base.rim.intensity * 1.3, 1.0) }
  return base
}
