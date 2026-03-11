import { describe, expect, it } from 'vitest'
import {
  detectActiveSynergies,
  hasSynergy,
  getMasteryAscensionBonus,
} from '../../src/services/relicSynergyResolver'

describe('relicSynergyResolver', () => {
  describe('detectActiveSynergies', () => {
    it('returns empty array for empty relic set', () => {
      const synergies = detectActiveSynergies(new Set())
      expect(synergies).toHaveLength(0)
    })

    it('returns empty array if no synergies are met', () => {
      const relicIds = new Set(['some_random_relic', 'another_random_relic'])
      const synergies = detectActiveSynergies(relicIds)
      expect(synergies).toHaveLength(0)
    })

    it('detects glass_berserker (glass_cannon + berserker_band)', () => {
      const relicIds = new Set(['glass_cannon', 'berserker_band'])
      const synergies = detectActiveSynergies(relicIds)

      expect(synergies).toHaveLength(1)
      expect(synergies[0].id).toBe('glass_berserker')
      expect(synergies[0].name).toBe('Glass Berserker')
      expect(synergies[0].tier).toBe(1)
      expect(synergies[0].matchedRelicIds).toContain('glass_cannon')
      expect(synergies[0].matchedRelicIds).toContain('berserker_band')
    })

    it('detects perpetual_motion (blood_price + blood_pact + quicksilver)', () => {
      const relicIds = new Set(['blood_price', 'blood_pact', 'quicksilver'])
      const synergies = detectActiveSynergies(relicIds)

      const perpetual = synergies.find(s => s.id === 'perpetual_motion')
      expect(perpetual).toBeDefined()
      expect(perpetual!.tier).toBe(2)
      expect(perpetual!.matchedRelicIds).toContain('blood_price')
      expect(perpetual!.matchedRelicIds).toContain('blood_pact')
      expect(perpetual!.matchedRelicIds).toContain('quicksilver')
    })

    it('detects speed_demon with 2 of 3 speed relics (requireAnyN: 2)', () => {
      // speed_reader + sharp_eye (2 of 3 required)
      const relicIds = new Set(['speed_reader', 'sharp_eye'])
      const synergies = detectActiveSynergies(relicIds)

      const speedDemon = synergies.find(s => s.id === 'speed_demon')
      expect(speedDemon).toBeDefined()
      expect(speedDemon!.matchedRelicIds).toHaveLength(2)
    })

    it('detects speed_demon with all 3 speed relics', () => {
      // speed_reader + sharp_eye + speed_charm (all 3)
      const relicIds = new Set(['speed_reader', 'sharp_eye', 'speed_charm'])
      const synergies = detectActiveSynergies(relicIds)

      const speedDemon = synergies.find(s => s.id === 'speed_demon')
      expect(speedDemon).toBeDefined()
      expect(speedDemon!.matchedRelicIds).toHaveLength(3)
    })

    it('does NOT detect speed_demon with only 1 of 3 speed relics', () => {
      const relicIds = new Set(['speed_reader'])
      const synergies = detectActiveSynergies(relicIds)

      const speedDemon = synergies.find(s => s.id === 'speed_demon')
      expect(speedDemon).toBeUndefined()
    })

    it('detects untouchable (all 3 shield relics)', () => {
      const relicIds = new Set(['fortress_wall', 'mirror_shield', 'stone_wall'])
      const synergies = detectActiveSynergies(relicIds)

      const untouchable = synergies.find(s => s.id === 'untouchable')
      expect(untouchable).toBeDefined()
      expect(untouchable!.tier).toBe(1)
    })

    it('does NOT detect untouchable if only 2 of 3 shield relics are held', () => {
      const relicIds = new Set(['fortress_wall', 'mirror_shield'])
      const synergies = detectActiveSynergies(relicIds)

      const untouchable = synergies.find(s => s.id === 'untouchable')
      expect(untouchable).toBeUndefined()
    })

    it('allows multiple synergies to activate simultaneously', () => {
      const relicIds = new Set([
        'glass_cannon',
        'berserker_band',
        'blood_price',
        'blood_pact',
        'quicksilver',
      ])
      const synergies = detectActiveSynergies(relicIds)

      const synergyIds = synergies.map(s => s.id)
      expect(synergyIds).toContain('glass_berserker')
      expect(synergyIds).toContain('perpetual_motion')
      expect(synergies.length).toBeGreaterThan(1)
    })

    it('excludes mastery_ascension from relic-based detection', () => {
      // mastery_ascension is card-count based, not relic-based
      const relicIds = new Set(['any_relic_1', 'any_relic_2'])
      const synergies = detectActiveSynergies(relicIds)

      const masteryAscension = synergies.find(s => s.id === 'mastery_ascension')
      expect(masteryAscension).toBeUndefined()
    })

    it('returns synergies with correct tier classification', () => {
      const relicIds = new Set([
        'glass_cannon',
        'berserker_band', // Tier 1
        'crescendo_blade',
        'executioners_axe', // Tier 2
      ])
      const synergies = detectActiveSynergies(relicIds)

      const tier1 = synergies.find(s => s.tier === 1)
      const tier2 = synergies.find(s => s.tier === 2)
      expect(tier1).toBeDefined()
      expect(tier2).toBeDefined()
    })

    it('detects phoenix_rage (Tier 3 synergy)', () => {
      const relicIds = new Set(['phoenix_feather', 'glass_cannon', 'berserker_band'])
      const synergies = detectActiveSynergies(relicIds)

      const phoenixRage = synergies.find(s => s.id === 'phoenix_rage')
      expect(phoenixRage).toBeDefined()
      expect(phoenixRage!.tier).toBe(3)
    })

    it('detects knowledge_engine (Tier 2 synergy)', () => {
      const relicIds = new Set(['eidetic_memory', 'domain_mastery', 'scholars_hat'])
      const synergies = detectActiveSynergies(relicIds)

      const knowledgeEngine = synergies.find(s => s.id === 'knowledge_engine')
      expect(knowledgeEngine).toBeDefined()
      expect(knowledgeEngine!.tier).toBe(2)
    })
  })

  describe('hasSynergy', () => {
    it('returns true if synergy is active', () => {
      const relicIds = new Set(['glass_cannon', 'berserker_band'])
      const result = hasSynergy(relicIds, 'glass_berserker')
      expect(result).toBe(true)
    })

    it('returns false if synergy is not active', () => {
      const relicIds = new Set(['glass_cannon'])
      const result = hasSynergy(relicIds, 'glass_berserker')
      expect(result).toBe(false)
    })

    it('returns false for nonexistent synergy ID', () => {
      const relicIds = new Set(['glass_cannon', 'berserker_band'])
      const result = hasSynergy(relicIds, 'nonexistent_synergy')
      expect(result).toBe(false)
    })

    it('returns false if synergy has no relic requirements (mastery_ascension)', () => {
      const relicIds = new Set(['any_relic'])
      const result = hasSynergy(relicIds, 'mastery_ascension')
      expect(result).toBe(false)
    })

    it('correctly checks requireAnyN synergies', () => {
      // speed_demon requires 2 of 3 speed relics
      const twoRelics = new Set(['speed_reader', 'sharp_eye'])
      expect(hasSynergy(twoRelics, 'speed_demon')).toBe(true)

      const oneRelic = new Set(['speed_reader'])
      expect(hasSynergy(oneRelic, 'speed_demon')).toBe(false)

      const threeRelics = new Set(['speed_reader', 'sharp_eye', 'speed_charm'])
      expect(hasSynergy(threeRelics, 'speed_demon')).toBe(true)
    })

    it('correctly checks exact-match synergies', () => {
      // glass_berserker requires both relics
      const bothRelics = new Set(['glass_cannon', 'berserker_band'])
      expect(hasSynergy(bothRelics, 'glass_berserker')).toBe(true)

      const oneRelic = new Set(['glass_cannon'])
      expect(hasSynergy(oneRelic, 'glass_berserker')).toBe(false)
    })

    it('works for Tier 3 synergies', () => {
      const relicIds = new Set(['phoenix_feather', 'glass_cannon', 'berserker_band'])
      const result = hasSynergy(relicIds, 'phoenix_rage')
      expect(result).toBe(true)
    })

    it('returns false for empty relic set', () => {
      const result = hasSynergy(new Set(), 'glass_berserker')
      expect(result).toBe(false)
    })
  })

  describe('getMasteryAscensionBonus', () => {
    it('returns 0 if fewer than 5 T3 cards', () => {
      expect(getMasteryAscensionBonus(0)).toBe(0)
      expect(getMasteryAscensionBonus(1)).toBe(0)
      expect(getMasteryAscensionBonus(4)).toBe(0)
    })

    it('returns card count at exactly 5 T3 cards', () => {
      expect(getMasteryAscensionBonus(5)).toBe(5)
    })

    it('returns card count at 6 T3 cards', () => {
      expect(getMasteryAscensionBonus(6)).toBe(6)
    })

    it('returns card count at 7 T3 cards', () => {
      expect(getMasteryAscensionBonus(7)).toBe(7)
    })

    it('caps bonus at 8 (max)', () => {
      expect(getMasteryAscensionBonus(8)).toBe(8)
      expect(getMasteryAscensionBonus(9)).toBe(8)
      expect(getMasteryAscensionBonus(10)).toBe(8)
      expect(getMasteryAscensionBonus(100)).toBe(8)
    })

    it('returns 0 for negative card count', () => {
      expect(getMasteryAscensionBonus(-1)).toBe(0)
    })

    it('bonuses follow the pattern: 0 for <5, count for 5-8, capped at 8', () => {
      for (let i = 0; i < 5; i++) {
        expect(getMasteryAscensionBonus(i)).toBe(0)
      }

      for (let i = 5; i <= 8; i++) {
        expect(getMasteryAscensionBonus(i)).toBe(i)
      }

      for (let i = 9; i <= 20; i++) {
        expect(getMasteryAscensionBonus(i)).toBe(8)
      }
    })
  })
})
