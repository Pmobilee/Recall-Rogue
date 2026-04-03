/**
 * Pet Animation Configuration
 *
 * Defines spritesheet animation parameters per species and behavior state.
 * Consumed by AnimatedPet.svelte to drive frame-based sprite animation.
 *
 * Asset layout: /assets/camp/pets/{species}/{behavior}.png
 * Each asset is a horizontal spritesheet strip (frameCount × frameWidth pixels wide).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported pet species. Extend as new art ships. */
export type PetSpecies = 'cat' | 'owl' | 'fox' | 'dragon_whelp'

/** Behavior states the pet state machine can enter. */
export type PetBehavior = 'idle' | 'walk' | 'sit' | 'lick' | 'sleep' | 'react'

/** Spritesheet animation config for a single behavior. */
export interface PetAnimationConfig {
  /** Number of frames in the spritesheet strip. */
  frameCount: number
  /** Milliseconds per frame. */
  frameDuration: number
  /** Whether the animation loops from the last frame back to frame 0. */
  loop: boolean
  /** Width of each individual frame in pixels (before scaling). */
  frameWidth: number
  /** Height of each individual frame in pixels (before scaling). */
  frameHeight: number
}

/** Full species configuration including display size and all behavior animations. */
export interface PetSpeciesConfig {
  species: PetSpecies
  /** Rendered width on the hub screen in pixels (before layout-scale). */
  displayWidth: number
  /** Rendered height on the hub screen in pixels (before layout-scale). */
  displayHeight: number
  /** Animation config for each behavior state. */
  animations: Record<PetBehavior, PetAnimationConfig>
  /**
   * Asset path prefix for this species' spritesheet files.
   * Convention: /assets/camp/pets/{species}/
   * Individual files are named {behavior}.png under this path.
   */
  assetPath: string
}

// ---------------------------------------------------------------------------
// Cat configuration
// ---------------------------------------------------------------------------

const CAT_CONFIG: PetSpeciesConfig = {
  species: 'cat',
  displayWidth: 96,
  displayHeight: 96,
  assetPath: '/assets/camp/pets/cat/',
  animations: {
    // Relaxed standing look-around — bread-and-butter idle
    idle: {
      frameCount: 6,
      frameDuration: 5000,
      loop: true,
      frameWidth: 64,
      frameHeight: 64,
    },
    // Walking patrol between waypoints
    walk: {
      frameCount: 8,
      frameDuration: 180,
      loop: true,
      frameWidth: 64,
      frameHeight: 64,
    },
    // Sitting upright, tail flick
    sit: {
      frameCount: 4,
      frameDuration: 5000,
      loop: true,
      frameWidth: 64,
      frameHeight: 64,
    },
    // Self-grooming
    lick: {
      frameCount: 6,
      frameDuration: 5000,
      loop: true,
      frameWidth: 64,
      frameHeight: 64,
    },
    // Curled up asleep — plays tuck-in sequence once, then holds on final sleeping frame.
    // loop: false so the tuck-in action doesn't repeat; the behavior state machine holds
    // the sleep state for 15–30s, keeping the last frame visible throughout the nap.
    sleep: {
      frameCount: 4,
      frameDuration: 5000,
      loop: false,
      frameWidth: 64,
      frameHeight: 64,
    },
    // Startled/poked reaction — plays once then returns to previous behavior
    react: {
      frameCount: 4,
      frameDuration: 500,
      loop: false,
      frameWidth: 64,
      frameHeight: 64,
    },
  },
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * All pet species configs keyed by PetSpecies.
 * Only 'cat' is defined now — add owl/fox/dragon_whelp as art ships.
 */
export const PET_CONFIGS: Partial<Record<PetSpecies, PetSpeciesConfig>> = {
  cat: CAT_CONFIG,
}

/**
 * Retrieve config for a species, falling back to cat if the species has no art yet.
 *
 * @param species - The pet species to look up
 * @returns The species config, or cat config as fallback
 */
export function getPetConfig(species: PetSpecies): PetSpeciesConfig {
  return PET_CONFIGS[species] ?? CAT_CONFIG
}
