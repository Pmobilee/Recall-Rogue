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

/** Full animation configuration for an enemy archetype. */
export interface AnimConfig {
  idle: IdleAnimConfig;
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
