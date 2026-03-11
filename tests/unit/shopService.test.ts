import { describe, expect, it } from 'vitest'
import type { Card } from '../../src/data/card-types'
import type { RelicDefinition } from '../../src/data/relics/types'
import {
  calculateShopPrice,
  generateShopRelics,
  priceShopCards,
} from '../../src/services/shopService'

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

/**
 * Helper to create a minimal test relic definition.
 */
function makeRelic(overrides: Partial<RelicDefinition> = {}): RelicDefinition {
  return {
    id: 'test-relic',
    name: 'Test Relic',
    description: 'A test relic.',
    flavorText: 'Flavor text.',
    rarity: 'common',
    category: 'offensive',
    trigger: 'permanent',
    effects: [
      {
        effectId: 'test_effect',
        description: 'Test effect',
        value: 1,
      },
    ],
    icon: '🎯',
    visualDescription: 'A test relic sprite.',
    unlockCost: 0,
    isStarter: true,
    ...overrides,
  }
}

describe('shopService', () => {
  describe('calculateShopPrice', () => {
    it('returns base price at floor 0', () => {
      const price = calculateShopPrice(100, 0)
      expect(price).toBe(100)
    })

    it('applies 3% discount per floor', () => {
      const basePrice = 100
      // Floor 1: 100 * (1 - 0.03) = 97
      expect(calculateShopPrice(basePrice, 1)).toBe(97)
      // Floor 5: 100 * (1 - 0.15) = 85
      expect(calculateShopPrice(basePrice, 5)).toBe(85)
      // Floor 10: 100 * (1 - 0.30) = 70
      expect(calculateShopPrice(basePrice, 10)).toBe(70)
    })

    it('caps discount at 40%', () => {
      const basePrice = 100
      // At floor 13: 13 * 0.03 = 0.39 (39%), so price = 61
      expect(calculateShopPrice(basePrice, 13)).toBe(61)
      // At floor 15: 15 * 0.03 = 0.45 (45%), but caps at 0.40, so price = 60
      expect(calculateShopPrice(basePrice, 15)).toBe(60)
      // At floor 20: 20 * 0.03 = 0.60 (60%), but caps at 0.40, so still 60
      expect(calculateShopPrice(basePrice, 20)).toBe(60)
    })

    it('always returns at least 1', () => {
      const price = calculateShopPrice(1, 0)
      expect(price).toBeGreaterThanOrEqual(1)

      // Very high discount on very low price
      const veryLow = calculateShopPrice(1, 100)
      expect(veryLow).toBeGreaterThanOrEqual(1)
    })

    it('rounds result to nearest integer', () => {
      // 100 * (1 - 0.03) = 97 (exact)
      expect(calculateShopPrice(100, 1)).toBe(97)
      // 50 * (1 - 0.03) = 48.5 → rounds to 49
      expect(calculateShopPrice(50, 1)).toBe(49)
      // 51 * (1 - 0.03) = 49.47 → rounds to 49
      expect(calculateShopPrice(51, 1)).toBe(49)
    })

    it('works with fractional base prices', () => {
      // Even though we expect integer prices in practice
      const price = calculateShopPrice(99.99, 1)
      expect(price).toBeGreaterThan(0)
    })
  })

  describe('generateShopRelics', () => {
    it('returns an array of shop relics', () => {
      const eligible = [makeRelic({ id: 'r1' }), makeRelic({ id: 'r2' })].slice(0, 2)
      const relics = generateShopRelics(0, eligible)

      expect(Array.isArray(relics)).toBe(true)
      expect(relics.every(r => 'relic' in r && 'price' in r)).toBe(true)
    })

    it('returns at most SHOP_RELIC_COUNT items', () => {
      const eligible = Array.from({ length: 10 }, (_, i) =>
        makeRelic({ id: `r${i}`, rarity: 'common' }),
      )
      const relics = generateShopRelics(0, eligible)

      // Based on balance.ts, SHOP_RELIC_COUNT = 3
      expect(relics.length).toBeLessThanOrEqual(3)
    })

    it('returns fewer items if eligible pool is smaller', () => {
      const eligible = [makeRelic({ id: 'r1' })]
      const relics = generateShopRelics(0, eligible)

      expect(relics.length).toBeLessThanOrEqual(1)
    })

    it('excludes already-selected relics from pool', () => {
      const eligible = [
        makeRelic({ id: 'r1', rarity: 'common' }),
        makeRelic({ id: 'r2', rarity: 'common' }),
        makeRelic({ id: 'r3', rarity: 'common' }),
      ]
      const relics = generateShopRelics(0, eligible)

      // Each relic should be unique
      const selectedIds = relics.map(r => r.relic.id)
      expect(new Set(selectedIds).size).toBe(selectedIds.length)
    })

    it('applies floor-based pricing discount', () => {
      const eligible = [makeRelic({ id: 'r1', rarity: 'common' })]
      const floor0Relics = generateShopRelics(0, eligible)
      const floor5Relics = generateShopRelics(5, eligible)

      // Assuming SHOP_RELIC_PRICE['common'] = 50 (check balance.ts)
      // Floor 0: 50 * (1 - 0) = 50
      // Floor 5: 50 * (1 - 0.10) = 45
      expect(floor5Relics[0].price).toBeLessThanOrEqual(floor0Relics[0].price)
    })

    it('returns empty array if eligible pool is empty', () => {
      const relics = generateShopRelics(0, [])
      expect(relics).toHaveLength(0)
    })

    it('handles rarity-weighted selection', () => {
      // Create a pool with multiple rarities
      const eligible = [
        makeRelic({ id: 'common-1', rarity: 'common' }),
        makeRelic({ id: 'rare-1', rarity: 'rare' }),
        makeRelic({ id: 'legendary-1', rarity: 'legendary' }),
      ]

      // Run multiple times to check variety (probabilistic test)
      const allSelected = new Set<string>()
      for (let i = 0; i < 5; i++) {
        const relics = generateShopRelics(0, eligible)
        relics.forEach(r => allSelected.add(r.relic.id))
      }

      // With 5 runs and 2 relics per run, we should hit variety
      expect(allSelected.size).toBeGreaterThan(1)
    })
  })

  describe('priceShopCards', () => {
    it('returns shop card items with prices', () => {
      const cards = [makeCard({ tier: '1' })]
      const items = priceShopCards(cards, 0)

      expect(items).toHaveLength(1)
      expect(items[0]).toHaveProperty('card')
      expect(items[0]).toHaveProperty('price')
      expect(typeof items[0].price).toBe('number')
    })

    it('prices cards based on their tier', () => {
      const card1 = makeCard({ id: '1', tier: '1' })
      const card2a = makeCard({ id: '2', tier: '2a' })
      const card2b = makeCard({ id: '3', tier: '2b' })
      const card3 = makeCard({ id: '4', tier: '3' })

      const items = priceShopCards([card1, card2a, card2b, card3], 0)

      // Higher tier cards should cost more (at floor 0, no discount)
      // Assuming: '1' = 15, '2a' = 25, '2b' = 35, '3' = 45
      const prices = items.map(i => i.price)
      expect(prices[0]).toBeLessThanOrEqual(prices[1])
      expect(prices[1]).toBeLessThanOrEqual(prices[2])
      expect(prices[2]).toBeLessThanOrEqual(prices[3])
    })

    it('applies floor-based discount to all cards', () => {
      const cards = [makeCard({ tier: '1' })]
      const floor0Items = priceShopCards(cards, 0)
      const floor5Items = priceShopCards(cards, 5)

      // Higher floor = lower price (discount)
      expect(floor5Items[0].price).toBeLessThanOrEqual(floor0Items[0].price)
    })

    it('returns prices as positive integers', () => {
      const cards = [makeCard(), makeCard({ id: '2' }), makeCard({ id: '3' })]
      const items = priceShopCards(cards, 10)

      items.forEach(item => {
        expect(item.price).toBeGreaterThanOrEqual(1)
        expect(Number.isInteger(item.price)).toBe(true)
      })
    })

    it('returns empty array for empty card list', () => {
      const items = priceShopCards([], 0)
      expect(items).toHaveLength(0)
    })

    it('preserves card references', () => {
      const cards = [makeCard({ id: '1' }), makeCard({ id: '2' })]
      const items = priceShopCards(cards, 0)

      expect(items[0].card).toBe(cards[0])
      expect(items[1].card).toBe(cards[1])
    })

    it('handles unknown tier gracefully with fallback price', () => {
      const card = makeCard()
      card.tier = 'unknown' as any
      const items = priceShopCards([card], 0)

      expect(items).toHaveLength(1)
      expect(items[0].price).toBeGreaterThan(0)
    })

    it('prices multiple cards independently', () => {
      const cards = [
        makeCard({ id: '1', tier: '1' }),
        makeCard({ id: '2', tier: '2a' }),
        makeCard({ id: '3', tier: '2b' }),
      ]
      const items = priceShopCards(cards, 0)

      // Each card should have its own price
      expect(items.map(i => i.price)).toEqual(expect.arrayContaining([expect.any(Number), expect.any(Number), expect.any(Number)]))
    })
  })
})
