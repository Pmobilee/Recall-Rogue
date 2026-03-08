// TODO: card-roguelite — removed mining dependency (stub)

/** Deterministic PRNG from a numeric seed (mulberry32). */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0
  return (): number => {
    t += 0x6d2b79f5
    let n = Math.imul(t ^ (t >>> 15), t | 1)
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

export interface DifficultyProfile {
  hardnessMultiplier: number
  hardRockWeightMultiplier: number
  hazardMultiplier: number
  oxygenCacheMultiplier: number
  anomalyRateMultiplier: number
  mineralMultiplier: number
}

/** Builds a neutral difficulty profile — stubbed after mining archival. */
export function buildDifficultyProfile(_engagementData?: any, _archetypeData?: any): DifficultyProfile {
  return {
    hardnessMultiplier: 1,
    hardRockWeightMultiplier: 1,
    hazardMultiplier: 1,
    oxygenCacheMultiplier: 1,
    anomalyRateMultiplier: 1,
    mineralMultiplier: 1,
  }
}
