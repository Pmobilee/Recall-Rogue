import { writable, derived } from 'svelte/store'
import type { Writable, Readable } from 'svelte/store'

// =========================================================
// Singleton helpers — survive module re-evaluation from
// Rollup code-split chunks (gameState may be bundled into
// multiple chunks; globalThis ensures one store instance).
// =========================================================

/** Ensure writable store singletons survive module re-evaluation from code-split chunks. */
const singletonRegistry = globalThis as typeof globalThis & Record<symbol, unknown>

/** Ensure writable store singletons survive module re-evaluation from code-split chunks. */
function singletonWritable<T>(key: string, initial: T): Writable<T> {
  const sym = Symbol.for('terra:' + key)
  if (!(sym in singletonRegistry)) {
    singletonRegistry[sym] = writable<T>(initial)
  }
  return singletonRegistry[sym] as Writable<T>
}

/** Ensure derived store singletons survive module re-evaluation from code-split chunks. */
function singletonDerived<T, S>(key: string, deps: Readable<S>, fn: (value: S) => T): Readable<T> {
  const sym = Symbol.for('terra:' + key)
  if (!(sym in singletonRegistry)) {
    singletonRegistry[sym] = derived(deps, fn)
  }
  return singletonRegistry[sym] as Readable<T>
}

// =========================================================
// Screen routing
// =========================================================

/** All top-level UI screens used by routing state. */
export type Screen =
  | 'hub'
  | 'mainMenu'
  | 'base'
  | 'combat'
  | 'domainSelection'
  | 'library'
  | 'profile'
  | 'journal'
  | 'leaderboards'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
  | 'runEnd'
  | 'cardReward'
  | 'retreatOrDelve'
  | 'onboarding'
  | 'ageSelection'
  | 'settings'

const SCREEN_STORAGE_KEY = 'card:currentScreen'

const VALID_SCREENS: Screen[] = [
  'hub',
  'mainMenu',
  'base',
  'combat',
  'domainSelection',
  'library',
  'profile',
  'journal',
  'leaderboards',
  'roomSelection',
  'mysteryEvent',
  'restRoom',
  'runEnd',
  'cardReward',
  'retreatOrDelve',
  'onboarding',
  'ageSelection',
  'settings',
]

const PERSISTABLE_SCREENS = new Set<Screen>([
  'hub',
  'mainMenu',
  'base',
  'library',
  'settings',
  'profile',
  'journal',
  'leaderboards',
])

function normalizeHomeScreen(screen: Screen): Screen {
  if (screen === 'mainMenu' || screen === 'base') return 'hub'
  return screen
}

function isScreen(value: unknown): value is Screen {
  return typeof value === 'string' && VALID_SCREENS.includes(value as Screen)
}

function readInitialScreen(): Screen {
  if (typeof window === 'undefined') return 'hub'
  try {
    const raw = window.localStorage.getItem(SCREEN_STORAGE_KEY)
    if (!raw) return 'hub'
    const parsed = JSON.parse(raw) as unknown
    if (!isScreen(parsed)) return 'hub'
    if (!PERSISTABLE_SCREENS.has(parsed)) return 'hub'
    return normalizeHomeScreen(parsed)
  } catch {
    return 'hub'
  }
}

export const currentScreen = singletonWritable<Screen>('currentScreen', readInitialScreen())

if (typeof window !== 'undefined') {
  currentScreen.subscribe((screen) => {
    if (!PERSISTABLE_SCREENS.has(screen)) return
    try {
      const persisted = normalizeHomeScreen(screen)
      window.localStorage.setItem(SCREEN_STORAGE_KEY, JSON.stringify(persisted))
    } catch {
      // Ignore localStorage failures.
    }
  })
}
