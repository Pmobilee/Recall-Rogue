import { writable, get } from 'svelte/store'
import type { GameManager } from './GameManager'

/** Reactive store holding the lazily-loaded GameManager singleton. Null until boot completes. */
export const gameManagerStore = writable<GameManager | null>(null)

/** Synchronous getter for event handlers — returns null before boot. */
export function getGM(): GameManager | null {
  return get(gameManagerStore)
}
