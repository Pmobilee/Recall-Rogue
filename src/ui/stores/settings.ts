import { writable } from 'svelte/store'

/** Sprite resolution setting: 'low' for 32px, 'high' for 256px. */
export type SpriteResolution = 'low' | 'high'

const STORAGE_KEY = 'terra-miner-sprite-resolution'

/**
 * Reads the sprite resolution setting from localStorage.
 * Returns 'low' if not set or invalid.
 * This is a plain function (non-reactive) for use in Phaser BootScene before Svelte hydrates.
 */
export function getSpriteResolution(): SpriteResolution {
  if (typeof window === 'undefined') {
    return 'low'
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'high' || stored === 'low') {
    return stored
  }

  return 'low'
}

/**
 * Sets the sprite resolution setting in localStorage and reloads the page.
 * Phaser textures can only be loaded at boot, so a reload is required.
 */
export function setSpriteResolution(res: SpriteResolution): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, res)
    window.location.reload()
  }
}

/**
 * Reactive Svelte store for sprite resolution, initialized from localStorage.
 */
export const spriteResolution = writable<SpriteResolution>(getSpriteResolution())

// =========================================================
// GAIA Personality Settings
// =========================================================

/** GAIA companion personality mode. */
export type GaiaMood = 'snarky' | 'enthusiastic' | 'calm'

const VALID_MOODS: GaiaMood[] = ['snarky', 'enthusiastic', 'calm']

function readGaiaMood(): GaiaMood {
  if (typeof window === 'undefined') return 'enthusiastic'
  const stored = window.localStorage.getItem('gaia-mood') as GaiaMood
  return VALID_MOODS.includes(stored) ? stored : 'enthusiastic'
}

/**
 * Reactive Svelte store for GAIA's current mood/personality.
 * Persisted to localStorage automatically.
 */
export const gaiaMood = writable<GaiaMood>(readGaiaMood())
gaiaMood.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('gaia-mood', v)
  }
})

function readGaiaChattiness(): number {
  if (typeof window === 'undefined') return 5
  const raw = window.localStorage.getItem('gaia-chattiness')
  const parsed = raw !== null ? parseInt(raw, 10) : NaN
  return isNaN(parsed) ? 5 : Math.max(0, Math.min(10, parsed))
}

/**
 * Reactive Svelte store for GAIA chattiness level (0–10).
 * 0 = silent, 10 = always speaks. Persisted to localStorage automatically.
 */
export const gaiaChattiness = writable<number>(readGaiaChattiness())
gaiaChattiness.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('gaia-chattiness', String(v))
  }
})
