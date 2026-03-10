import { describe, expect, it } from 'vitest'
import type { Card } from '../../src/data/card-types'
import { addFactsToCooldown, createDeck, drawHand, tickFactCooldowns } from '../../src/services/deckManager'

function makeCard(id: string, factId: string): Card {
  return {
    id,
    factId,
    cardType: 'attack',
    domain: 'natural_sciences',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1,
  }
}

describe('deckManager hotfix behavior', () => {
  it('reassigns fact ids from factPool when drawing hand cards', () => {
    const deck = createDeck([
      makeCard('card-1', 'legacy-a'),
      makeCard('card-2', 'legacy-b'),
      makeCard('card-3', 'legacy-c'),
    ])

    deck.factPool = ['fact-1', 'fact-2', 'fact-3']

    const drawn = drawHand(deck, 3)
    expect(drawn).toHaveLength(3)
    expect(drawn.every((card) => deck.factPool.includes(card.factId))).toBe(true)
    expect(drawn.some((card) => card.factId.startsWith('legacy-'))).toBe(false)
  })

  it('respects encounter cooldown facts when enough alternatives exist', () => {
    const deck = createDeck([
      makeCard('card-1', 'placeholder-1'),
      makeCard('card-2', 'placeholder-2'),
    ])

    deck.factPool = ['fact-a', 'fact-b', 'fact-c', 'fact-d']
    deck.factCooldown = [
      { factId: 'fact-a', encountersRemaining: 3 },
      { factId: 'fact-b', encountersRemaining: 2 },
    ]

    const drawn = drawHand(deck, 2)
    expect(drawn).toHaveLength(2)
    expect(drawn.every((card) => card.factId === 'fact-c' || card.factId === 'fact-d')).toBe(true)
  })

  it('deduplicates cooldown additions and expires cooldown entries by encounter tick', () => {
    const deck = createDeck([makeCard('card-1', 'fact-a')])

    addFactsToCooldown(deck, ['fact-a', 'fact-a', 'fact-b'])
    expect(deck.factCooldown).toHaveLength(2)

    // Cooldowns are randomized between 1 and 3
    for (const entry of deck.factCooldown) {
      expect(entry.encountersRemaining).toBeGreaterThanOrEqual(1)
      expect(entry.encountersRemaining).toBeLessThanOrEqual(3)
    }

    // After 3 ticks (max cooldown), all entries must be expired
    tickFactCooldowns(deck)
    tickFactCooldowns(deck)
    tickFactCooldowns(deck)
    expect(deck.factCooldown).toHaveLength(0)
  })
})
