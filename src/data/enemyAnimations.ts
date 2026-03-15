// === Enemy Animation Archetypes ===
// Defines per-archetype animation configs for idle, attack, and hit tweens.
// NO Phaser, Svelte, or DOM imports — pure data.

/** Available animation archetype identifiers. */
export type AnimArchetype =
  | 'swooper'
  | 'slammer'
  | 'crawler'
  | 'caster'
  | 'floater'
  | 'lurcher'
  | 'striker'
  | 'trembler';

/** Idle animation parameters. */
export interface IdleAnimConfig {
  /** Vertical bob amplitude in pixels. */
  bobAmplitude: number;
  /** Bob cycle duration in ms. */
  bobDuration: number;
  /** Scale pulse magnitude (1.0 = no pulse). */
  breatheScale: number;
  /** Breathe cycle duration in ms. */
  breatheDuration: number;
  /** Wobble rotation in degrees. */
  wobbleAngle: number;
  /** Wobble cycle duration in ms. */
  wobbleDuration: number;
}

/** Attack animation parameters. */
export interface AttackAnimConfig {
  /** Horizontal lunge offset in pixels (negative = left). */
  lungeX: number;
  /** Vertical lunge offset in pixels (positive = down/toward player). */
  lungeY: number;
  /** Rotation during lunge in degrees. */
  rotation: number;
  /** Scale during lunge. */
  scale: number;
  /** Lunge phase duration in ms. */
  lungeDuration: number;
  /** Return phase duration in ms. */
  returnDuration: number;
  /** Phaser ease string for the return phase. */
  returnEase: string;
  /** Camera shake intensity multiplier (0 = no shake). */
  shakeIntensity: number;
}

/** Hit reaction animation parameters. */
export interface HitAnimConfig {
  /** Horizontal knockback offset in pixels. */
  knockbackX: number;
  /** Vertical knockback offset in pixels (negative = up/away). */
  knockbackY: number;
  /** Rotation during knockback in degrees. */
  rotation: number;
  /** Scale during knockback. */
  scale: number;
  /** Knockback phase duration in ms. */
  knockbackDuration: number;
  /** Return phase duration in ms. */
  returnDuration: number;
  /** Phaser ease string for the return phase. */
  returnEase: string;
}

/** A single step in a custom idle movement pattern. */
export interface IdlePatternStep {
  /** Type of movement for this step. */
  type: 'move' | 'pause' | 'flip' | 'squash' | 'pulse' | 'jitter' | 'drift'
  /** Duration of this step in ms. */
  duration: number
  /** Target X offset from base position (for move/drift). */
  dx?: number
  /** Target Y offset from base position (for move/drift). */
  dy?: number
  /** Target scaleX (for squash/pulse). */
  scaleX?: number
  /** Target scaleY (for squash/pulse). */
  scaleY?: number
  /** Phaser ease string (defaults to 'Sine.easeInOut'). */
  ease?: string
  /** Whether this step yoyos back to start (for squash/pulse). */
  yoyo?: boolean
  /** Jitter intensity in pixels (for jitter type). */
  intensity?: number
  /** Jitter interval in ms between random offsets (for jitter type). */
  interval?: number
  /** Target scaleX direction for flip (-1 = mirror horizontally). */
  flipX?: number
}

/** Full idle behavior: base layer + optional custom pattern. */
export interface IdleBehavior {
  /** Base idle parameters (bob/breathe/wobble). Always present for fallback. */
  base: IdleAnimConfig
  /** Optional custom movement pattern that loops continuously. */
  pattern?: IdlePatternStep[]
  /** If true, suppress the standard bob/breathe/wobble base layer. */
  suppressBase?: boolean
}

/** Full animation configuration for an enemy archetype. */
export interface AnimConfig {
  idle: IdleAnimConfig;
  /** Extended idle behavior with optional custom pattern. */
  idleBehavior?: IdleBehavior;
  attack: AttackAnimConfig;
  hit: HitAnimConfig;
}

/** Default animation config — matches the original hardcoded values in EnemySpriteSystem. */
export const DEFAULT_ANIM_CONFIG: AnimConfig = {
  idle: {
    bobAmplitude: 5,
    bobDuration: 1250,
    breatheScale: 1.02,
    breatheDuration: 1500,
    wobbleAngle: 1,
    wobbleDuration: 2000,
  },
  idleBehavior: {
    base: { bobAmplitude: 5, bobDuration: 1250, breatheScale: 1.02, breatheDuration: 1500, wobbleAngle: 1, wobbleDuration: 2000 },
  },
  attack: {
    lungeX: 0,
    lungeY: 22,
    rotation: 10,
    scale: 1.1,
    lungeDuration: 180,
    returnDuration: 250,
    returnEase: 'Back.easeOut',
    shakeIntensity: 0.0034,
  },
  hit: {
    knockbackX: 0,
    knockbackY: -15,
    rotation: -12,
    scale: 1.06,
    knockbackDuration: 95,
    returnDuration: 350,
    returnEase: 'Elastic.easeOut',
  },
};

/**
 * Per-archetype animation configs.
 * Each config is a full AnimConfig — archetype-specific values with defaults for the rest.
 */
const ARCHETYPE_CONFIGS: Record<AnimArchetype, AnimConfig> = {
  swooper: {
    idle: {
      bobAmplitude: 8,
      bobDuration: 900,
      breatheScale: 1.01,
      breatheDuration: 1200,
      wobbleAngle: 2.5,
      wobbleDuration: 1400,
    },
    idleBehavior: {
      base: { bobAmplitude: 8, bobDuration: 900, breatheScale: 1.01, breatheDuration: 1200, wobbleAngle: 2.5, wobbleDuration: 1400 },
      pattern: [
        { type: 'drift', dx: -15, dy: -8, duration: 2000, ease: 'Sine.easeInOut' },
        { type: 'drift', dx: 15, dy: 8, duration: 2000, ease: 'Sine.easeInOut' },
      ],
    },
    attack: {
      lungeX: -15,
      lungeY: 30,
      rotation: -20,
      scale: 1.08,
      lungeDuration: 150,
      returnDuration: 220,
      returnEase: 'Back.easeOut',
      shakeIntensity: 0.003,
    },
    hit: {
      knockbackX: 10,
      knockbackY: -20,
      rotation: 15,
      scale: 1.04,
      knockbackDuration: 80,
      returnDuration: 300,
      returnEase: 'Elastic.easeOut',
    },
  },

  slammer: {
    idle: {
      bobAmplitude: 2,
      bobDuration: 1800,
      breatheScale: 1.03,
      breatheDuration: 2000,
      wobbleAngle: 0.5,
      wobbleDuration: 2500,
    },
    idleBehavior: {
      base: { bobAmplitude: 2, bobDuration: 1800, breatheScale: 1.03, breatheDuration: 2000, wobbleAngle: 0.5, wobbleDuration: 2500 },
      pattern: [
        { type: 'pause', duration: 5000 },
        { type: 'squash', scaleX: 1.15, scaleY: 0.85, duration: 120, yoyo: true },
        { type: 'pause', duration: 150 },
        { type: 'squash', scaleX: 0.95, scaleY: 1.05, duration: 100, yoyo: true },
      ],
    },
    attack: {
      lungeX: 0,
      lungeY: 35,
      rotation: 3,
      scale: 1.15,
      lungeDuration: 220,
      returnDuration: 300,
      returnEase: 'Bounce.easeOut',
      shakeIntensity: 0.006,
    },
    hit: {
      knockbackX: 0,
      knockbackY: -8,
      rotation: -5,
      scale: 1.02,
      knockbackDuration: 120,
      returnDuration: 400,
      returnEase: 'Back.easeOut',
    },
  },

  crawler: {
    idle: {
      bobAmplitude: 3,
      bobDuration: 1100,
      breatheScale: 1.01,
      breatheDuration: 1300,
      wobbleAngle: 0.8,
      wobbleDuration: 1600,
    },
    idleBehavior: {
      base: { bobAmplitude: 3, bobDuration: 1100, breatheScale: 1.01, breatheDuration: 1300, wobbleAngle: 0.8, wobbleDuration: 1600 },
      suppressBase: true,
      pattern: [
        { type: 'move', dx: -20, dy: 0, duration: 3000, ease: 'Linear' },
        { type: 'pause', duration: 4000 },
        { type: 'flip', flipX: -1, duration: 200 },
        { type: 'move', dx: 20, dy: 0, duration: 3000, ease: 'Linear' },
        { type: 'pause', duration: 4000 },
        { type: 'flip', flipX: 1, duration: 200 },
      ],
    },
    attack: {
      lungeX: 25,
      lungeY: 15,
      rotation: 5,
      scale: 1.06,
      lungeDuration: 160,
      returnDuration: 230,
      returnEase: 'Back.easeOut',
      shakeIntensity: 0.003,
    },
    hit: {
      knockbackX: -12,
      knockbackY: -10,
      rotation: -8,
      scale: 1.05,
      knockbackDuration: 90,
      returnDuration: 320,
      returnEase: 'Elastic.easeOut',
    },
  },

  caster: {
    idle: {
      bobAmplitude: 7,
      bobDuration: 1600,
      breatheScale: 1.04,
      breatheDuration: 1800,
      wobbleAngle: 0,
      wobbleDuration: 2000,
    },
    idleBehavior: {
      base: { bobAmplitude: 7, bobDuration: 1600, breatheScale: 1.04, breatheDuration: 1800, wobbleAngle: 0, wobbleDuration: 2000 },
      pattern: [
        { type: 'pause', duration: 3000 },
        { type: 'pulse', scaleX: 1.12, scaleY: 1.12, duration: 200, yoyo: true },
      ],
    },
    attack: {
      lungeX: 0,
      lungeY: 5,
      rotation: 0,
      scale: 1.2,
      lungeDuration: 200,
      returnDuration: 280,
      returnEase: 'Sine.easeOut',
      shakeIntensity: 0.002,
    },
    hit: {
      knockbackX: 0,
      knockbackY: -18,
      rotation: -6,
      scale: 1.08,
      knockbackDuration: 85,
      returnDuration: 380,
      returnEase: 'Elastic.easeOut',
    },
  },

  floater: {
    idle: {
      bobAmplitude: 10,
      bobDuration: 2000,
      breatheScale: 1.02,
      breatheDuration: 2200,
      wobbleAngle: 1.5,
      wobbleDuration: 2800,
    },
    idleBehavior: {
      base: { bobAmplitude: 10, bobDuration: 2000, breatheScale: 1.02, breatheDuration: 2200, wobbleAngle: 1.5, wobbleDuration: 2800 },
      pattern: [
        { type: 'drift', dx: -8, dy: 0, duration: 3000, ease: 'Sine.easeInOut' },
        { type: 'drift', dx: 8, dy: 0, duration: 3000, ease: 'Sine.easeInOut' },
      ],
    },
    attack: {
      lungeX: 0,
      lungeY: 15,
      rotation: 0,
      scale: 1.1,
      lungeDuration: 250,
      returnDuration: 300,
      returnEase: 'Sine.easeInOut',
      shakeIntensity: 0.002,
    },
    hit: {
      knockbackX: 0,
      knockbackY: -22,
      rotation: -4,
      scale: 1.03,
      knockbackDuration: 100,
      returnDuration: 400,
      returnEase: 'Sine.easeOut',
    },
  },

  lurcher: {
    idle: {
      bobAmplitude: 4,
      bobDuration: 1400,
      breatheScale: 1.02,
      breatheDuration: 1600,
      wobbleAngle: 3,
      wobbleDuration: 1800,
    },
    idleBehavior: {
      base: { bobAmplitude: 4, bobDuration: 1400, breatheScale: 1.02, breatheDuration: 1600, wobbleAngle: 3, wobbleDuration: 1800 },
      suppressBase: true,
      pattern: [
        { type: 'pause', duration: 4000 },
        { type: 'move', dx: 12, dy: 0, duration: 150, ease: 'Power3' },
        { type: 'pause', duration: 200 },
        { type: 'move', dx: -12, dy: 0, duration: 600, ease: 'Sine.easeOut' },
      ],
    },
    attack: {
      lungeX: 5,
      lungeY: 20,
      rotation: 15,
      scale: 1.08,
      lungeDuration: 200,
      returnDuration: 280,
      returnEase: 'Back.easeOut',
      shakeIntensity: 0.003,
    },
    hit: {
      knockbackX: -5,
      knockbackY: -12,
      rotation: -15,
      scale: 1.06,
      knockbackDuration: 100,
      returnDuration: 360,
      returnEase: 'Elastic.easeOut',
    },
  },

  striker: {
    idle: {
      bobAmplitude: 3,
      bobDuration: 1000,
      breatheScale: 1.015,
      breatheDuration: 800,
      wobbleAngle: 0.5,
      wobbleDuration: 1200,
    },
    idleBehavior: {
      base: { bobAmplitude: 3, bobDuration: 1000, breatheScale: 1.015, breatheDuration: 800, wobbleAngle: 0.5, wobbleDuration: 1200 },
      pattern: [
        { type: 'jitter', intensity: 2, interval: 120, duration: 400 },
        { type: 'pause', duration: 800 },
        { type: 'jitter', intensity: 3, interval: 80, duration: 300 },
        { type: 'pause', duration: 1200 },
      ],
    },
    attack: {
      lungeX: -10,
      lungeY: 25,
      rotation: 8,
      scale: 1.06,
      lungeDuration: 120,
      returnDuration: 200,
      returnEase: 'Back.easeOut',
      shakeIntensity: 0.004,
    },
    hit: {
      knockbackX: 8,
      knockbackY: -14,
      rotation: -10,
      scale: 1.04,
      knockbackDuration: 80,
      returnDuration: 280,
      returnEase: 'Elastic.easeOut',
    },
  },

  trembler: {
    idle: {
      bobAmplitude: 1,
      bobDuration: 2200,
      breatheScale: 1.01,
      breatheDuration: 2400,
      wobbleAngle: 0.3,
      wobbleDuration: 3000,
    },
    idleBehavior: {
      base: { bobAmplitude: 1, bobDuration: 2200, breatheScale: 1.01, breatheDuration: 2400, wobbleAngle: 0.3, wobbleDuration: 3000 },
      pattern: [
        { type: 'pause', duration: 6000 },
        { type: 'jitter', intensity: 4, interval: 40, duration: 500 },
        { type: 'pause', duration: 500 },
      ],
    },
    attack: {
      lungeX: 0,
      lungeY: 3,
      rotation: 0,
      scale: 1.02,
      lungeDuration: 60,
      returnDuration: 60,
      returnEase: 'Linear',
      shakeIntensity: 0.005,
    },
    hit: {
      knockbackX: 0,
      knockbackY: -6,
      rotation: -3,
      scale: 1.01,
      knockbackDuration: 110,
      returnDuration: 400,
      returnEase: 'Back.easeOut',
    },
  },
};

/**
 * Resolves the animation config for a given archetype.
 * Returns the default config if no archetype is specified.
 *
 * @param archetype - Optional animation archetype identifier.
 * @returns The resolved AnimConfig.
 */
export function getAnimConfig(archetype?: AnimArchetype): AnimConfig {
  if (!archetype) return DEFAULT_ANIM_CONFIG;
  return ARCHETYPE_CONFIGS[archetype] ?? DEFAULT_ANIM_CONFIG;
}
