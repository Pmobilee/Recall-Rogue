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
  | 'mainMenu'
  | 'base'
  | 'combat'
  | 'domainSelection'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
  | 'runEnd'
  | 'cardReward'
  | 'retreatOrDelve'
  | 'onboarding'
  | 'ageSelection'
  | 'settings'

export const currentScreen = singletonWritable<Screen>('currentScreen', 'mainMenu')
