import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '../../src/data/card-types'
import { addFactsToCooldown, createDeck, drawHand, tickFactCooldowns } from '../../src/services/deckManager'
import { factsDB } from '../../src/services/factsDB'

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
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

    // Cooldowns are randomized between 3 and 5
    for (const entry of deck.factCooldown) {
      expect(entry.encountersRemaining).toBeGreaterThanOrEqual(3)
      expect(entry.encountersRemaining).toBeLessThanOrEqual(5)
    }

    // After 5 ticks (max cooldown), all entries must be expired
    tickFactCooldowns(deck)
    tickFactCooldowns(deck)
    tickFactCooldowns(deck)
    tickFactCooldowns(deck)
    tickFactCooldowns(deck)
    expect(deck.factCooldown).toHaveLength(0)
  })

  it('avoids duplicate base facts in the same hand when alternatives exist', () => {
    const deck = createDeck([
      makeCard('card-1', 'legacy-1'),
      makeCard('card-2', 'legacy-2'),
      makeCard('card-3', 'legacy-3'),
    ])

    deck.factPool = ['fact-a', 'fact-b', 'fact-c', 'fact-d']

    vi.spyOn(factsDB, 'getById').mockImplementation((factId: string) => {
      if (factId === 'fact-a') {
        return {
          id: factId,
          statement: 'Alpha fact',
          quizQuestion: 'What is alpha?',
          correctAnswer: 'Alpha',
        } as any
      }
      if (factId === 'fact-b') {
        return {
          id: factId,
          statement: 'Alpha fact',
          quizQuestion: 'Tell me about alpha',
          correctAnswer: 'Alpha',
        } as any
      }
      if (factId === 'fact-c') {
        return {
          id: factId,
          statement: 'Beta fact',
          quizQuestion: 'What is beta?',
          correctAnswer: 'Beta',
        } as any
      }
      if (factId === 'fact-d') {
        return {
          id: factId,
          statement: 'Gamma fact',
          quizQuestion: 'What is gamma?',
          correctAnswer: 'Gamma',
        } as any
      }
      return null
    })

    const drawn = drawHand(deck, 3)
    expect(drawn).toHaveLength(3)

    const factIds = drawn.map((card) => card.factId)
    const baseKeys = factIds.map((factId) => {
      const fact = factsDB.getById(factId) as any
      return `${fact?.statement ?? ''}|${fact?.correctAnswer ?? ''}`
    })

    expect(new Set(baseKeys).size).toBe(3)
  })
})
