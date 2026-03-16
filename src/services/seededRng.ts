/**
 * Deterministic seeded RNG with forking support for reproducible runs.
 *
 * Each subsystem (deck, rewards, enemies, etc.) gets its own forked RNG stream
 * derived from the run seed + a label hash. This ensures adding a Math.random()
 * call in one subsystem doesn't shift the sequence of another.
 *
 * Uses mulberry32 — a fast, high-quality 32-bit PRNG.
 */

/** Simple djb2 string hash for fork label derivation. */
function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Core mulberry32 PRNG state. */
interface Mulberry32State {
  t: number
}

function mulberry32Next(state: Mulberry32State): number {
  state.t = (state.t + 0x6D2B79F5) >>> 0
  let n = Math.imul(state.t ^ (state.t >>> 15), 1 | state.t)
  n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296
}

export interface SeededRng {
  /** Returns a float in [0, 1), like Math.random(). */
  next(): number
  /** Returns an integer in [0, max). */
  nextInt(max: number): number
  /** Create a deterministic sub-stream for a named subsystem. */
  fork(label: string): SeededRng
  /** Get the internal state for serialization. */
  getState(): number
}

function createRngFromState(t: number): SeededRng {
  const state: Mulberry32State = { t: t >>> 0 }

  const rng: SeededRng = {
    next(): number {
      return mulberry32Next(state)
    },
    nextInt(max: number): number {
      return Math.floor(mulberry32Next(state) * max)
    },
    fork(label: string): SeededRng {
      // Derive a new seed by combining current seed with label hash
      const derived = (state.t ^ djb2(label)) >>> 0
      return createRngFromState(derived)
    },
    getState(): number {
      return state.t
    },
  }

  return rng
}

/** Create a new SeededRng from a numeric seed. */
export function createSeededRng(seed: number): SeededRng {
  return createRngFromState(seed >>> 0)
}

/** Fisher-Yates shuffle using a SeededRng. */
export function seededShuffled<T>(rng: SeededRng, items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Weighted random selection using a SeededRng. */
export function seededWeightedPick<T>(rng: SeededRng, items: T[], weights: number[]): T {
  let total = 0
  for (const w of weights) total += w
  let roll = rng.next() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ============================================================
// Run-scoped RNG singleton
// ============================================================

let activeRunRng: SeededRng | null = null
const forkCache = new Map<string, SeededRng>()

/** Initialize the run RNG. Call at run start. */
export function initRunRng(seed: number): void {
  activeRunRng = createSeededRng(seed)
  forkCache.clear()
}

/** Get a named fork of the active run RNG. Forks are cached per label. */
export function getRunRng(label: string): SeededRng {
  if (!activeRunRng) {
    throw new Error(`[seededRng] No active run RNG — call initRunRng() first (requested fork: "${label}")`)
  }
  let fork = forkCache.get(label)
  if (!fork) {
    fork = activeRunRng.fork(label)
    forkCache.set(label, fork)
  }
  return fork
}

/** Check if run RNG is active. */
export function isRunRngActive(): boolean {
  return activeRunRng !== null
}

/** Tear down the run RNG. Call at run end. */
export function destroyRunRng(): void {
  activeRunRng = null
  forkCache.clear()
}

/**
 * Get serializable state of all active forks for save/resume.
 * Returns a record of label → internal PRNG state number.
 */
export function serializeRunRngState(): { seed: number; forks: Record<string, number> } | null {
  if (!activeRunRng) return null
  const forks: Record<string, number> = {}
  for (const [label, rng] of forkCache) {
    forks[label] = rng.getState()
  }
  return { seed: activeRunRng.getState(), forks }
}

/**
 * Restore run RNG from saved state. Re-creates the root and all saved forks
 * at their exact PRNG positions.
 */
export function restoreRunRngState(saved: { seed: number; forks: Record<string, number> }): void {
  activeRunRng = createRngFromState(saved.seed)
  forkCache.clear()
  for (const [label, state] of Object.entries(saved.forks)) {
    forkCache.set(label, createRngFromState(state))
  }
}
