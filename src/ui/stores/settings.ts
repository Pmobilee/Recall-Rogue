import { singletonWritable } from './singletonStore'

/** Pending localStorage writes, batched and flushed via microtask. */
const pendingWrites = new Map<string, string>()
let flushScheduled = false

function schedulePersist(key: string, value: string): void {
  pendingWrites.set(key, value)
  if (!flushScheduled) {
    flushScheduled = true
    queueMicrotask(flushPendingWrites)
  }
}

function flushPendingWrites(): void {
  flushScheduled = false
  for (const [key, value] of pendingWrites) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Storage full or unavailable — silently skip
    }
  }
  pendingWrites.clear()
}

/** Sprite resolution setting: 'low' for 32px, 'high' for 256px. */
export type SpriteResolution = 'low' | 'high'

const STORAGE_KEY = 'recall-rogue-sprite-resolution'

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
export type GaiaMood = 'snarky' | 'enthusiastic' | 'calm' | 'omniscient'

const VALID_MOODS: GaiaMood[] = ['snarky', 'enthusiastic', 'calm', 'omniscient']

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
    schedulePersist('gaia-mood', v)
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
    schedulePersist('gaia-chattiness', String(v))
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
    schedulePersist('show-explanations', String(v))
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
    schedulePersist('setting_musicVolume', String(v))
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
    schedulePersist('setting_sfxVolume', String(v))
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
    schedulePersist('setting_musicEnabled', String(v))
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
    schedulePersist('setting_sfxEnabled', String(v))
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
    schedulePersist('setting_highContrastQuiz', String(v))
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
    schedulePersist('setting_reducedMotion', String(v))
  }
})

// =========================================================
// Screen Shake Intensity (Phase 30 — Mining Juice)
// =========================================================

function readScreenShakeIntensity(): number {
  if (typeof window === 'undefined') return 1.0
  const raw = window.localStorage.getItem('setting_screenShakeIntensity')
  const parsed = raw !== null ? parseFloat(raw) : NaN
  return isNaN(parsed) ? 1.0 : Math.max(0, Math.min(1, parsed))
}

/**
 * Reactive store for screen shake intensity (0.0–1.0).
 * 0.0 = no shake, 1.0 = full shake. Persisted to localStorage.
 * Respects the ScreenShakeSystem's intensity multiplier.
 */
export const screenShakeIntensity = singletonWritable<number>('screenShakeIntensity', readScreenShakeIntensity())
screenShakeIntensity.subscribe(v => {
  if (typeof window !== 'undefined') {
    schedulePersist('setting_screenShakeIntensity', String(v))
  }
})

// =========================================================
// Analytics Consent (Phase 38 — ATT / iOS)
// =========================================================

function readAnalyticsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem('setting_analyticsEnabled')
  // Default true (opt-out model for non-iOS); ATTConsentPrompt overrides on iOS
  return stored !== 'false'
}

/**
 * Reactive store for analytics consent.
 * Set to false when the ATT prompt is denied on iOS.
 * AnalyticsService checks this before queuing events.
 */
export const analyticsEnabled = singletonWritable<boolean>('analyticsEnabled', readAnalyticsEnabled())
analyticsEnabled.subscribe(v => {
  if (typeof window !== 'undefined') {
    schedulePersist('setting_analyticsEnabled', String(v))
  }
})

// =========================================================
// Device Tier Override (Phase 28 — Performance)
// =========================================================

import { getDeviceTier, setDeviceTierOverride, type DeviceTier } from '../../services/deviceTierService'

/**
 * Reactive Svelte store for the manual device tier override.
 * Null means "auto-detect". Persisted to localStorage via deviceTierService.
 * Changes apply after the game is restarted.
 */
export const deviceTierOverride = singletonWritable<DeviceTier | null>('deviceTierOverride', null)
deviceTierOverride.subscribe((t) => {
  if (typeof window !== 'undefined') {
    setDeviceTierOverride(t)
  }
})

// Re-export for convenience in Settings.svelte
export { getDeviceTier, type DeviceTier }

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

export { flushPendingWrites as flushSettings }
