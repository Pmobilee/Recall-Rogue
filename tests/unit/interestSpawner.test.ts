// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  pickBiomeWithInterestBias,
  generateInterestBiasedBiomeSequence,
} from '../../src/services/interestSpawner'
import { createDefaultInterestConfig } from '../../src/data/interestConfig'
import { ALL_BIOMES } from '../../src/data/biomes'
import { seededRandom } from '../../src/game/systems/MineGenerator'

describe('pickBiomeWithInterestBias', () => {
  it('returns a valid biome from ALL_BIOMES', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(42)
    const biome = pickBiomeWithInterestBias(config, rng)
    const ids = ALL_BIOMES.map(b => b.id)
    expect(ids).toContain(biome.id)
  })

  it('with zero-weight config, returns a biome without throwing', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(99)
    expect(() => pickBiomeWithInterestBias(config, rng)).not.toThrow()
  })

  it('returns different biomes for different rng states', () => {
    const config = createDefaultInterestConfig()
    // Run many times and verify we get some variation
    const seen = new Set<string>()
    for (let seed = 0; seed < 50; seed++) {
      const biome = pickBiomeWithInterestBias(config, seededRandom(seed))
      seen.add(biome.id)
    }
    // With 50 different seeds, we should see at least 2 different biomes
    expect(seen.size).toBeGreaterThan(1)
  })

  it('biome affinity boost does not throw when category interests are set', () => {
    const config = createDefaultInterestConfig()
    // Set Natural Sciences interest to 100
    const nsCat = config.categories.find(c => c.category === 'Natural Sciences')
    if (nsCat) nsCat.weight = 100

    // Run 200 trials without throwing
    expect(() => {
      for (let seed = 0; seed < 200; seed++) {
        const rng = seededRandom(seed)
        pickBiomeWithInterestBias(config, rng)
      }
    }).not.toThrow()
  })

  it('is deterministic — same seed and config always returns same biome', () => {
    const config = createDefaultInterestConfig()
    const rng1 = seededRandom(12345)
    const rng2 = seededRandom(12345)
    const biome1 = pickBiomeWithInterestBias(config, rng1)
    const biome2 = pickBiomeWithInterestBias(config, rng2)
    expect(biome1.id).toBe(biome2.id)
  })
})

describe('generateInterestBiasedBiomeSequence', () => {
  it('returns an array of length equal to layerCount', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(1)
    const seq = generateInterestBiasedBiomeSequence(rng, 20, config)
    expect(seq).toHaveLength(20)
  })

  it('every element is a valid biome', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(7)
    const seq = generateInterestBiasedBiomeSequence(rng, 20, config)
    const ids = new Set(ALL_BIOMES.map(b => b.id))
    seq.forEach(b => expect(ids.has(b.id)).toBe(true))
  })

  it('first element is always ALL_BIOMES[0] (surface/default biome)', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(3)
    const seq = generateInterestBiasedBiomeSequence(rng, 10, config)
    expect(seq[0].id).toBe(ALL_BIOMES[0].id)
  })

  it('returns array of length 1 for layerCount 1', () => {
    const config = createDefaultInterestConfig()
    const rng = seededRandom(1)
    const seq = generateInterestBiasedBiomeSequence(rng, 1, config)
    expect(seq).toHaveLength(1)
  })
})
