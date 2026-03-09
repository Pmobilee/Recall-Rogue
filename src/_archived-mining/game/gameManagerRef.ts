import { writable, get } from 'svelte/store'
import type { Writable } from 'svelte/store'
import type { GameManager } from './GameManager'

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

/** Reactive store holding the lazily-loaded GameManager singleton. Null until boot completes. */
export const gameManagerStore = singletonWritable<GameManager | null>('gameManagerStore', null)

/** Synchronous getter for event handlers — returns null before boot. */
export function getGM(): GameManager | null {
  return get(gameManagerStore)
}
