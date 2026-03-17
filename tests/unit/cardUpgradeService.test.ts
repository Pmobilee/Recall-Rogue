import { describe, expect, it } from 'vitest'
import type { Card } from '../../src/data/card-types'
import {
  canUpgradeCard,
  upgradeCard,
  getUpgradePreview,
  getUpgradeCandidates,
} from '../../src/services/cardUpgradeService'

/**
 * Helper to create a minimal test card with sensible defaults.
 */
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-1',
    factId: 'fact-1',
    question: 'Test?',
    answers: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
    ],
    cardType: 'attack',
    mechanicId: 'strike',
    mechanicName: 'Strike',
    apCost: 1,
    baseEffectValue: 8,
    originalBaseEffectValue: 8,
    tier: '1',
    domain: 'general_knowledge',
    effectMultiplier: 1,
    ...overrides,
  }
}

describe('cardUpgradeService', () => {
  describe('canUpgradeCard', () => {
    it('returns true for non-upgraded cards with known mechanics', () => {
      const card = makeCard({ mechanicId: 'strike', isUpgraded: false })
      expect(canUpgradeCard(card)).toBe(true)
    })

    it('returns false for already upgraded cards', () => {
      const card = makeCard({ mechanicId: 'strike', isUpgraded: true })
      expect(canUpgradeCard(card)).toBe(false)
    })

    it('returns false for echo cards', () => {
      const card = makeCard({ mechanicId: 'strike', isEcho: true })
      expect(canUpgradeCard(card)).toBe(false)
    })

    it('returns false for cards with unknown mechanic', () => {
      const card = makeCard({ mechanicId: 'unknown_mechanic' })
      expect(canUpgradeCard(card)).toBe(false)
    })

    it('returns false for cards without a mechanic ID', () => {
      const card = makeCard({ mechanicId: undefined })
      expect(canUpgradeCard(card)).toBe(false)
    })

    it('returns true for various known mechanics', () => {
      const mechanics = ['strike', 'multi_hit', 'block', 'thorns', 'scout', 'cleanse']
      for (const mechId of mechanics) {
        const card = makeCard({ mechanicId: mechId, isUpgraded: false })
        expect(canUpgradeCard(card)).toBe(true)
      }
    })
  })

  describe('upgradeCard', () => {
    it('mutates card: adds isUpgraded and appends + to mechanicName', () => {
      const card = makeCard({ mechanicId: 'strike', mechanicName: 'Strike' })
      const result = upgradeCard(card)

      expect(result).toBe(card) // Same reference
      expect(card.isUpgraded).toBe(true)
      expect(card.mechanicName).toBe('Strike+')
    })

    it('increases baseEffectValue by correct delta for strike', () => {
      const card = makeCard({ mechanicId: 'strike', baseEffectValue: 8 })
      upgradeCard(card)

      expect(card.baseEffectValue).toBe(11) // 8 + 3
    })

    it('increases baseEffectValue by correct delta for block', () => {
      const card = makeCard({ mechanicId: 'block', baseEffectValue: 6 })
      upgradeCard(card)

      expect(card.baseEffectValue).toBe(9) // 6 + 3
    })

    it('reduces AP cost for scout upgrade', () => {
      const card = makeCard({ mechanicId: 'scout', apCost: 1, baseEffectValue: 1 })
      upgradeCard(card)

      expect(card.apCost).toBe(0) // 1 + (-1) = 0
      expect(card.baseEffectValue).toBe(2) // 1 + 1 (baseValueDelta: 1)
    })

    it('reduces AP cost for multi_hit', () => {
      const card = makeCard({ mechanicId: 'multi_hit', apCost: 2, baseEffectValue: 4, secondaryValue: 3 })
      upgradeCard(card)

      expect(card.apCost).toBe(1) // 2 + (-1) = 1
      expect(card.baseEffectValue).toBe(4) // unchanged (baseValueDelta: 0)
      expect(card.secondaryValue).toBe(3) // unchanged (no secondaryValueDelta)
    })

    it('updates secondaryValue and AP for thorns', () => {
      const card = makeCard({ mechanicId: 'thorns', apCost: 2, baseEffectValue: 6, secondaryValue: 2 })
      upgradeCard(card)

      expect(card.baseEffectValue).toBe(6) // unchanged (baseValueDelta: 0)
      expect(card.secondaryValue).toBe(3) // 2 + 1
      expect(card.apCost).toBe(1) // 2 + (-1) = 1
    })

    it('handles missing secondary value by deriving from mechanic definition', () => {
      const card = makeCard({ mechanicId: 'thorns', apCost: 2, baseEffectValue: 6 })
      delete card.secondaryValue
      upgradeCard(card)

      // Should derive secondaryValue from mechanic definition and add delta
      expect(card.secondaryValue).toBe(4) // (3 from mechanic def) + 1
      expect(card.apCost).toBe(1) // AP reduction applied
    })

    it('appends + even if mechanicName is missing', () => {
      const card = makeCard({ mechanicId: 'strike' })
      card.mechanicName = undefined
      upgradeCard(card)

      expect(card.mechanicName).toBe('+')
    })

    it('returns the same card reference', () => {
      const card = makeCard()
      const result = upgradeCard(card)
      expect(result).toBe(card)
    })

    it('handles unknown mechanic gracefully (no-op)', () => {
      const card = makeCard({ mechanicId: 'unknown' })
      const baseValue = card.baseEffectValue
      const result = upgradeCard(card)

      expect(result).toBe(card)
      expect(card.baseEffectValue).toBe(baseValue) // Unchanged
      expect(card.isUpgraded).toBeUndefined() // Not set
    })
  })

  describe('getUpgradePreview', () => {
    it('returns preview for strike upgrade', () => {
      const card = makeCard({ mechanicId: 'strike', baseEffectValue: 8, mechanicName: 'Strike' })
      const preview = getUpgradePreview(card)

      expect(preview).not.toBeNull()
      expect(preview!.upgradedName).toBe('Strike+')
      expect(preview!.currentBaseValue).toBe(8)
      expect(preview!.newBaseValue).toBe(11)
      expect(preview!.secondaryDelta).toBeUndefined()
    })

    it('returns preview with AP reduction for multi_hit', () => {
      const card = makeCard({
        mechanicId: 'multi_hit',
        apCost: 2,
        baseEffectValue: 4,
        mechanicName: 'Multi-Hit',
      })
      const preview = getUpgradePreview(card)

      expect(preview).not.toBeNull()
      expect(preview!.upgradedName).toBe('Multi-Hit+')
      expect(preview!.currentBaseValue).toBe(4)
      expect(preview!.newBaseValue).toBe(4)
      expect(preview!.currentApCost).toBe(2)
      expect(preview!.newApCost).toBe(1)
    })

    it('returns preview with addTag for quicken', () => {
      const card = makeCard({
        mechanicId: 'quicken',
        baseEffectValue: 1,
        mechanicName: 'Quicken',
      })
      const preview = getUpgradePreview(card)

      expect(preview).not.toBeNull()
      expect(preview!.addTag).toBe('draw')
    })

    it('returns null for unknown mechanic', () => {
      const card = makeCard({ mechanicId: 'unknown' })
      const preview = getUpgradePreview(card)

      expect(preview).toBeNull()
    })

    it('returns null if no mechanic ID', () => {
      const card = makeCard()
      card.mechanicId = undefined
      const preview = getUpgradePreview(card)

      expect(preview).toBeNull()
    })

    it('does not mutate the card', () => {
      const card = makeCard()
      const originalValue = card.baseEffectValue
      const originalUpgraded = card.isUpgraded

      getUpgradePreview(card)

      expect(card.baseEffectValue).toBe(originalValue)
      expect(card.isUpgraded).toBe(originalUpgraded)
    })
  })

  describe('getUpgradeCandidates', () => {
    it('returns up to N candidates', () => {
      const deck: Card[] = [
        makeCard({ id: '1', mechanicId: 'strike' }),
        makeCard({ id: '2', mechanicId: 'block' }),
        makeCard({ id: '3', mechanicId: 'restore' }),
      ]
      const candidates = getUpgradeCandidates(deck, 2)

      expect(candidates).toHaveLength(2)
    })

    it('excludes already-upgraded cards', () => {
      const deck: Card[] = [
        makeCard({ id: '1', mechanicId: 'strike', isUpgraded: true }),
        makeCard({ id: '2', mechanicId: 'block', isUpgraded: false }),
        makeCard({ id: '3', mechanicId: 'scout', isUpgraded: false }),
      ]
      const candidates = getUpgradeCandidates(deck, 10)

      expect(candidates).toHaveLength(2)
      expect(candidates.every(c => !c.isUpgraded)).toBe(true)
    })

    it('excludes echo cards', () => {
      const deck: Card[] = [
        makeCard({ id: '1', mechanicId: 'strike', isEcho: true }),
        makeCard({ id: '2', mechanicId: 'block', isEcho: false }),
      ]
      const candidates = getUpgradeCandidates(deck, 10)

      expect(candidates).toHaveLength(1)
      expect(candidates[0].id).toBe('2')
    })

    it('excludes cards without known mechanic', () => {
      const deck: Card[] = [
        makeCard({ id: '1', mechanicId: 'unknown' }),
        makeCard({ id: '2', mechanicId: 'strike' }),
      ]
      const candidates = getUpgradeCandidates(deck, 10)

      expect(candidates).toHaveLength(1)
      expect(candidates[0].id).toBe('2')
    })

    it('sorts by tier priority: 3 > 2b > 2a > 1', () => {
      const deck: Card[] = [
        makeCard({ id: '1', tier: '1', mechanicId: 'strike' }),
        makeCard({ id: '2', tier: '2a', mechanicId: 'strike' }),
        makeCard({ id: '3', tier: '2b', mechanicId: 'strike' }),
        makeCard({ id: '4', tier: '3', mechanicId: 'strike' }),
      ]
      const candidates = getUpgradeCandidates(deck, 10)

      expect(candidates.map(c => c.id)).toEqual(['4', '3', '2', '1'])
    })

    it('sorts by effectMultiplier within same tier', () => {
      const deck: Card[] = [
        makeCard({ id: '1', tier: '2a', mechanicId: 'strike', effectMultiplier: 1.0 }),
        makeCard({ id: '2', tier: '2a', mechanicId: 'strike', effectMultiplier: 2.0 }),
        makeCard({ id: '3', tier: '2a', mechanicId: 'strike', effectMultiplier: 1.5 }),
      ]
      const candidates = getUpgradeCandidates(deck, 10)

      expect(candidates.map(c => c.id)).toEqual(['2', '3', '1'])
    })

    it('returns empty array for empty deck', () => {
      const candidates = getUpgradeCandidates([], 10)
      expect(candidates).toHaveLength(0)
    })

    it('returns empty array if no eligible candidates', () => {
      const deck: Card[] = [
        makeCard({ id: '1', isUpgraded: true }),
        makeCard({ id: '2', isEcho: true }),
        makeCard({ id: '3', mechanicId: 'unknown' }),
      ]
      const candidates = getUpgradeCandidates(deck, 10)

      expect(candidates).toHaveLength(0)
    })

    it('returns N candidates even if more exist', () => {
      const deck: Card[] = Array.from({ length: 10 }, (_, i) =>
        makeCard({ id: String(i + 1), mechanicId: 'strike' }),
      )
      const candidates = getUpgradeCandidates(deck, 3)

      expect(candidates).toHaveLength(3)
    })
  })

  describe('AP cost upgrades', () => {
    it('applies apCostDelta correctly for heavy_strike', () => {
      const card = makeCard({ mechanicId: 'heavy_strike', apCost: 3, baseEffectValue: 20 })
      upgradeCard(card)

      expect(card.apCost).toBe(2) // 3 + (-1) = 2
      expect(card.baseEffectValue).toBe(20) // unchanged
      expect(card.isUpgraded).toBe(true)
    })

    it('does not reduce AP below 0', () => {
      const card = makeCard({ mechanicId: 'scout', apCost: 0, baseEffectValue: 1 })
      upgradeCard(card)

      expect(card.apCost).toBe(0) // already at 0, Math.max(0, ...) prevents negative
    })

    it('preview includes AP cost change for AP-reduction upgrades', () => {
      const card = makeCard({ mechanicId: 'heavy_strike', apCost: 3, baseEffectValue: 20, mechanicName: 'Heavy Strike' })
      const preview = getUpgradePreview(card)

      expect(preview).not.toBeNull()
      expect(preview!.currentApCost).toBe(3)
      expect(preview!.newApCost).toBe(2)
    })

    it('preview does not include AP change for value-only upgrades', () => {
      const card = makeCard({ mechanicId: 'strike', apCost: 1, baseEffectValue: 8, mechanicName: 'Strike' })
      const preview = getUpgradePreview(card)

      expect(preview).not.toBeNull()
      expect(preview!.currentApCost).toBeUndefined()
      expect(preview!.newApCost).toBeUndefined()
    })

    it('quicken upgrade adds draw tag but no AP change (already 0)', () => {
      const card = makeCard({ mechanicId: 'quicken', apCost: 0, baseEffectValue: 1, mechanicName: 'Quicken' })
      upgradeCard(card)

      expect(card.isUpgraded).toBe(true)
      expect(card.apCost).toBe(0) // stays at 0
    })

    it('both apCostDelta and value changes apply for thorns', () => {
      const card = makeCard({ mechanicId: 'thorns', apCost: 2, baseEffectValue: 6, secondaryValue: 2, mechanicName: 'Thorns' })
      const preview = getUpgradePreview(card)

      expect(preview!.currentApCost).toBe(2)
      expect(preview!.newApCost).toBe(1)
      expect(preview!.secondaryDelta).toBe(1)
      expect(preview!.currentBaseValue).toBe(6)
      expect(preview!.newBaseValue).toBe(6) // baseValueDelta: 0
    })
  })
})
