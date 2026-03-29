import { derived, writable } from 'svelte/store'
import type { Readable, Writable } from 'svelte/store'

const singletonRegistry = globalThis as typeof globalThis & Record<symbol, unknown>

function singletonSymbol(key: string): symbol {
  return Symbol.for(`rr:${key}`)
}

/** Creates or returns a globally shared writable store singleton. */
export function singletonWritable<T>(key: string, initial: T): Writable<T> {
  const sym = singletonSymbol(key)
  if (!(sym in singletonRegistry)) {
    singletonRegistry[sym] = writable<T>(initial)
  }
  return singletonRegistry[sym] as Writable<T>
}

/** Creates or returns a globally shared derived store singleton. */
export function singletonDerived<T, S>(
  key: string,
  deps: Readable<S>,
  fn: (value: S) => T,
): Readable<T> {
  const sym = singletonSymbol(key)
  if (!(sym in singletonRegistry)) {
    singletonRegistry[sym] = derived(deps, fn)
  }
  return singletonRegistry[sym] as Readable<T>
}
