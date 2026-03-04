import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'

/** Ensure writable store singletons survive module re-evaluation from code-split chunks. */
function singletonWritable<T>(key: string, initial: T): Writable<T> {
  const sym = Symbol.for('terra:' + key)
  if (!(globalThis as any)[sym]) {
    (globalThis as any)[sym] = writable<T>(initial)
  }
  return (globalThis as any)[sym] as Writable<T>
}

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
export const spriteResolution = singletonWritable<SpriteResolution>('spriteResolution', getSpriteResolution())

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
export const gaiaMood = singletonWritable<GaiaMood>('gaiaMood', readGaiaMood())
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
export const gaiaChattiness = singletonWritable<number>('gaiaChattiness', readGaiaChattiness())
gaiaChattiness.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('gaia-chattiness', String(v))
  }
})

// =========================================================
// Quiz Explanation Setting (Phase 15.6)
// =========================================================

function readShowExplanations(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem('show-explanations')
  return stored !== 'false'
}

/**
 * Reactive Svelte store controlling whether GAIA shows explanations after quiz failures.
 * Defaults to true. Persisted to localStorage automatically.
 */
export const showExplanations = singletonWritable<boolean>('showExplanations', readShowExplanations())
showExplanations.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('show-explanations', String(v))
  }
})

// =========================================================
// Audio Settings (Phase 17.2)
// =========================================================

function readMusicVolume(): number {
  if (typeof window === 'undefined') return 0.6
  const raw = window.localStorage.getItem('setting_musicVolume')
  const parsed = raw !== null ? parseFloat(raw) : NaN
  return isNaN(parsed) ? 0.6 : Math.max(0, Math.min(1, parsed))
}

/** Reactive store for music volume (0-1). Persisted to localStorage. */
export const musicVolume = singletonWritable<number>('musicVolume', readMusicVolume())
musicVolume.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('setting_musicVolume', String(v))
  }
})

function readSfxVolume(): number {
  if (typeof window === 'undefined') return 0.8
  const raw = window.localStorage.getItem('setting_sfxVolume')
  const parsed = raw !== null ? parseFloat(raw) : NaN
  return isNaN(parsed) ? 0.8 : Math.max(0, Math.min(1, parsed))
}

/** Reactive store for SFX volume (0-1). Persisted to localStorage. */
export const sfxVolume = singletonWritable<number>('sfxVolume', readSfxVolume())
sfxVolume.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('setting_sfxVolume', String(v))
  }
})

function readMusicEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem('setting_musicEnabled')
  return stored !== 'false'
}

/** Reactive store for music enabled toggle. */
export const musicEnabled = singletonWritable<boolean>('musicEnabled', readMusicEnabled())
musicEnabled.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('setting_musicEnabled', String(v))
  }
})

function readSfxEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem('setting_sfxEnabled')
  return stored !== 'false'
}

/** Reactive store for SFX enabled toggle. */
export const sfxEnabled = singletonWritable<boolean>('sfxEnabled', readSfxEnabled())
sfxEnabled.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('setting_sfxEnabled', String(v))
  }
})

// =========================================================
// Accessibility Settings (Phase 20.5)
// =========================================================

function readHighContrastQuiz(): boolean {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem('setting_highContrastQuiz')
  return stored === 'true'
}

/** High-contrast quiz mode for accessibility (DD-V2-178) */
export const highContrastQuiz = singletonWritable<boolean>('highContrastQuiz', readHighContrastQuiz())
highContrastQuiz.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('setting_highContrastQuiz', String(v))
  }
})

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem('setting_reducedMotion')
  return stored === 'true'
}

/** Reduced motion mode — disables animations (DD-V2-178) */
export const reducedMotion = singletonWritable<boolean>('reducedMotion', readReducedMotion())
reducedMotion.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('setting_reducedMotion', String(v))
  }
})

// =========================================================
// Interest Configuration (Phase 12)
// =========================================================

import type { InterestConfig } from '../../data/interestConfig'
import { createDefaultInterestConfig } from '../../data/interestConfig'
import { playerSave, persistPlayer } from './playerData'

/**
 * Reactive Svelte store for the player's interest configuration.
 * Derives its initial value from playerSave and persists changes back through it.
 */
export const interestConfig = singletonWritable<InterestConfig>('interestConfig', createDefaultInterestConfig())

// Sync interestConfig from playerSave whenever playerSave changes.
playerSave.subscribe(ps => {
  if (ps?.interestConfig) {
    interestConfig.set(ps.interestConfig)
  }
})

/**
 * Saves an updated InterestConfig to the player save and persists.
 */
export function saveInterestConfig(config: InterestConfig): void {
  playerSave.update(current => {
    if (!current) return current
    return { ...current, interestConfig: config, lastPlayedAt: Date.now() }
  })
  persistPlayer()
  interestConfig.set(config)
}
