// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ALL_BIOMES } from '../../src/data/biomes'
import {
  BIOME_TILE_SPECS,
  HERO_BIOME_IDS,
  TIER_ATLAS_KEYS,
  biomeTileSpriteKey,
  transitionTileSpriteKey,
  getBiomeTier,
} from '../../src/data/biomeTileSpec'
import { BlockType } from '../../src/data/types'
import { COMPANION_CATALOGUE } from '../../src/data/companions'
import {
  RELIC_CATALOGUE,
  ARCHETYPE_SYNERGY_BONUSES,
  RELICS,
  SYNERGIES,
} from '../../src/data/relics'
// hubFloors, hubLayout, paintings archived — tests for those removed
import { HIGH_RES_KEYS, LOW_RES_KEYS } from '../../src/data/spriteKeys'
import { DOME_SPRITE_KEYS, getDomeSpriteUrls } from '../../src/game/domeManifest'

describe('biome definitions', () => {
  it('uses unique biome ids and labels', () => {
    const ids = ALL_BIOMES.map(b => b.id)
    const labels = ALL_BIOMES.map(b => b.label)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('has valid, bounded depth ranges and anomaly chance sanity', () => {
    for (const biome of ALL_BIOMES) {
      const [minLayer, maxLayer] = biome.layerRange
      expect(Number.isInteger(minLayer)).toBe(true)
      expect(Number.isInteger(maxLayer)).toBe(true)
      expect(minLayer).toBeGreaterThanOrEqual(1)
      expect(maxLayer).toBeLessThanOrEqual(20)
      expect(minLayer).toBeLessThanOrEqual(maxLayer)

      if (biome.tier === 'anomaly') {
        expect(biome.isAnomaly).toBe(true)
        expect(biome.anomalyChance).toBeDefined()
        expect(biome.anomalyChance!).toBeGreaterThan(0)
        expect(biome.anomalyChance!).toBeLessThanOrEqual(1)
      } else {
        expect(biome.isAnomaly).toBe(false)
      }
    }
  })
})

describe('block and tile mapping sanity', () => {
  it('keeps BlockType numeric values unique', () => {
    const numericValues = Object.values(BlockType).filter(v => typeof v === 'number') as number[]
    expect(new Set(numericValues).size).toBe(numericValues.length)
  })

  it('covers every biome in BIOME_TILE_SPECS and keeps key/biomeId aligned', () => {
    const biomeIds = ALL_BIOMES.map(b => b.id).sort()
    const tileSpecIds = Object.keys(BIOME_TILE_SPECS).sort()
    expect(tileSpecIds).toEqual(biomeIds)

    for (const [id, spec] of Object.entries(BIOME_TILE_SPECS)) {
      expect(spec.biomeId).toBe(id)
      expect(TIER_ATLAS_KEYS[getBiomeTier(spec.biomeId)]).toBeTruthy()
    }
  })

  it('builds deterministic, stable sprite keys for biome and transitions', () => {
    expect(biomeTileSpriteKey('limestone_caves', 'soil', 3)).toBe('limestone_caves_soil_03')
    expect(
      transitionTileSpriteKey('void_pocket', 'clay_basin', 'rock', 'ne'),
    ).toBe('transition_clay_basin_void_pocket_rock_ne')
  })

  it('keeps hero biome IDs unique and mapped to blob47 specs', () => {
    expect(new Set(HERO_BIOME_IDS).size).toBe(HERO_BIOME_IDS.length)
    for (const biomeId of HERO_BIOME_IDS) {
      expect(BIOME_TILE_SPECS[biomeId].autotileMode).toBe('blob47')
    }
  })
})

describe('companion definitions', () => {
  it('uses unique companion ids and names', () => {
    const ids = COMPANION_CATALOGUE.map(c => c.id)
    const names = COMPANION_CATALOGUE.map(c => c.name)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it('defines a valid 4-stage evolution path per companion', () => {
    for (const companion of COMPANION_CATALOGUE) {
      expect(companion.evolutionPath).toHaveLength(4)

      const stages = companion.evolutionPath.map(s => s.stage)
      expect(stages).toEqual([0, 1, 2, 3])
      expect(companion.evolutionPath[0].shardsRequired).toBe(0)
      expect(companion.evolutionPath[0].masteredFactsRequired).toBe(0)

      for (let i = 1; i < companion.evolutionPath.length; i++) {
        expect(companion.evolutionPath[i].shardsRequired).toBeGreaterThan(
          companion.evolutionPath[i - 1].shardsRequired,
        )
        expect(companion.evolutionPath[i].masteredFactsRequired).toBeGreaterThan(
          companion.evolutionPath[i - 1].masteredFactsRequired,
        )
      }

      const legendaryStage = companion.evolutionPath[3]
      expect(legendaryStage.dustCatHappinessRequired).toBeDefined()
      expect(legendaryStage.dustCatHappinessRequired!).toBeGreaterThanOrEqual(0)
      expect(legendaryStage.dustCatHappinessRequired!).toBeLessThanOrEqual(100)
    }
  })
})

describe('relic definitions and synergies', () => {
  it('uses unique relic ids and positive drop weights', () => {
    const ids = RELIC_CATALOGUE.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    RELIC_CATALOGUE.forEach(relic => {
      expect(relic.dropWeight).toBeGreaterThan(0)
      expect(relic.effects.length).toBeGreaterThan(0)
    })
  })

  it('defines one archetype synergy bonus per relic archetype', () => {
    const relicArchetypes = new Set(RELIC_CATALOGUE.map(r => r.archetype))
    const synergyArchetypes = ARCHETYPE_SYNERGY_BONUSES.map(s => s.archetype)

    expect(new Set(synergyArchetypes).size).toBe(synergyArchetypes.length)
    expect(new Set(synergyArchetypes)).toEqual(relicArchetypes)
  })

  it('references valid V1 relic IDs in legacy synergy requirements', () => {
    const relicIds = new Set(RELICS.map(r => r.id))
    for (const synergy of SYNERGIES) {
      for (const required of synergy.requiredRelics) {
        expect(relicIds.has(required)).toBe(true)
      }
    }
  })
})

// Hub floor definitions and painting/achievement tier tests archived
// (hubFloors.ts, hubLayout.ts, paintings.ts moved to _archived-mining)

describe('sprite key manifests', () => {
  it('keeps HIGH_RES_KEYS and LOW_RES_KEYS in sync', () => {
    const highKeys = Object.keys(HIGH_RES_KEYS).sort()
    const lowKeys = Object.keys(LOW_RES_KEYS).sort()
    expect(highKeys).toEqual(lowKeys)

    for (const key of highKeys) {
      expect(HIGH_RES_KEYS[key].endsWith('.png')).toBe(true)
      expect(LOW_RES_KEYS[key].endsWith('.png')).toBe(true)
    }
  })

  it('keeps dome sprite keys unique and URL maps complete for both resolutions', () => {
    const domeKeys = [...DOME_SPRITE_KEYS]
    expect(new Set(domeKeys).size).toBe(domeKeys.length)

    const lowUrls = getDomeSpriteUrls('low')
    const highUrls = getDomeSpriteUrls('high')
    expect(Object.keys(lowUrls).sort()).toEqual(domeKeys.slice().sort())
    expect(Object.keys(highUrls).sort()).toEqual(domeKeys.slice().sort())

    for (const key of domeKeys) {
      expect(lowUrls[key].endsWith(`/dome/${key}.png`)).toBe(true)
      expect(highUrls[key].endsWith(`/dome/${key}.png`)).toBe(true)
    }
  })
})
