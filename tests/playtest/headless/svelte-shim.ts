/**
 * Minimal Svelte store shim for Node.js headless simulation.
 * Provides writable(), readable(), derived(), get() with the same API surface
 * as svelte/store but without Svelte's runtime.
 */

export interface Writable<T> {
  set(value: T): void;
  update(updater: (value: T) => T): void;
  subscribe(run: (value: T) => void): () => void;
}

export interface Readable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export function writable<T>(initial: T, _start?: unknown): Writable<T> {
  let value = initial;
  const subs: Array<(v: T) => void> = [];
  return {
    set(v: T) { value = v; for (const s of subs) s(v); },
    update(fn: (v: T) => T) { value = fn(value); for (const s of subs) s(value); },
    subscribe(fn: (v: T) => void) {
      fn(value);
      subs.push(fn);
      return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
    },
  };
}

export function readable<T>(initial: T, _start?: unknown): Readable<T> {
  return writable(initial);
}

export function derived<T>(stores: unknown, fn: (...args: unknown[]) => T, _initial?: T): Readable<T> {
  // Simple implementation: just call fn once with initial values
  if (typeof fn === 'function') {
    try {
      if (Array.isArray(stores)) {
        const values = (stores as Array<{ subscribe: (fn: (v: unknown) => void) => unknown }>).map((s) => get(s));
        return writable(fn(...values));
      }
      return writable(fn(get(stores as { subscribe: (fn: (v: unknown) => void) => unknown })));
    } catch {
      return writable(undefined as T);
    }
  }
  return writable(undefined as T);
}

export function get<T>(store: { subscribe: (fn: (v: T) => void) => unknown }): T {
  let value: T = undefined as T;
  store.subscribe((v: T) => { value = v; });
  return value;
}
