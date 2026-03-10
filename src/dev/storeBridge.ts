/** Read a Svelte store value from globalThis Symbol singletons. */
export function readStore<T>(key: string): T | undefined {
  const sym = Symbol.for(key)
  const store = (globalThis as Record<symbol, unknown>)[sym]
  if (!store || typeof store !== 'object') return undefined
  const s = store as { subscribe?: (cb: (v: unknown) => void) => () => void }
  if (typeof s.subscribe !== 'function') return undefined
  let value: T | undefined
  s.subscribe((next: unknown) => {
    value = next as T
  })()
  return value
}
