import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '../../src/data/card-types'
import { addFactsToCooldown, createDeck, drawHand, shuffleFactsAtEncounterEnd, tickFactCooldowns } from '../../src/services/deckManager'
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

  it('does NOT reassign fact ids during drawHand when STABLE_ENCOUNTER_FACTS_ENABLED is true (AR-223)', () => {
    // AR-223: With stable encounter facts, drawHand preserves existing factIds on cards.
    // Facts are only reassigned via shuffleFactsAtEncounterEnd() between encounters.
    const deck = createDeck([
      makeCard('card-1', 'legacy-a'),
      makeCard('card-2', 'legacy-b'),
      makeCard('card-3', 'legacy-c'),
    ])

    deck.factPool = ['fact-1', 'fact-2', 'fact-3']

    const drawn = drawHand(deck, 3)
    expect(drawn).toHaveLength(3)
    // Cards retain their original factIds — no reassignment during draw.
    // Order is non-deterministic (deck is shuffled on create), so check as a set.
    const drawnFactIds = drawn.map((c) => c.factId).sort()
    expect(drawnFactIds).toEqual(['legacy-a', 'legacy-b', 'legacy-c'].sort())
    // None should have been reassigned to pool facts.
    expect(drawn.every((c) => !['fact-1', 'fact-2', 'fact-3'].includes(c.factId))).toBe(true)
  })

  it('shuffleFactsAtEncounterEnd assigns facts from the pool to all card slots (AR-223)', () => {
    const deck = createDeck([
      makeCard('card-1', 'legacy-a'),
      makeCard('card-2', 'legacy-b'),
      makeCard('card-3', 'legacy-c'),
    ])

    deck.factPool = ['fact-1', 'fact-2', 'fact-3']

    // Move cards to various piles to test all-pile coverage.
    // drawHand in stable mode keeps factIds as-is, so manually set draw pile.
    // Simulate: card-1 in drawPile (already there after createDeck), move card-2 to discard.
    const card2 = deck.drawPile.find((c) => c.id === 'card-2')!
    deck.drawPile.splice(deck.drawPile.indexOf(card2), 1)
    deck.discardPile.push(card2)

    shuffleFactsAtEncounterEnd(deck, new Set())

    const allCards = [...deck.drawPile, ...deck.discardPile, ...deck.hand]
    expect(allCards).toHaveLength(3)
    expect(allCards.every((card) => deck.factPool.includes(card.factId))).toBe(true)
    expect(allCards.some((card) => card.factId.startsWith('legacy-'))).toBe(false)
  })

  it('shuffleFactsAtEncounterEnd re-derives isCursed from cursedFactIds (AR-223 sub-step 3)', () => {
    const deck = createDeck([
      makeCard('card-1', 'fact-a'),
      makeCard('card-2', 'fact-b'),
    ])
    deck.factPool = ['fact-a', 'fact-b']

    const cursedFactIds = new Set(['fact-a'])
    shuffleFactsAtEncounterEnd(deck, cursedFactIds)

    const allCards = [...deck.drawPile, ...deck.discardPile, ...deck.hand]
    for (const card of allCards) {
      expect(card.isCursed).toBe(cursedFactIds.has(card.factId))
    }
  })

  it('shuffleFactsAtEncounterEnd respects encounter cooldown facts when enough alternatives exist (AR-223)', () => {
    // AR-223: Cooldown-awareness moved from drawHand to shuffleFactsAtEncounterEnd.
    const deck = createDeck([
      makeCard('card-1', 'placeholder-1'),
      makeCard('card-2', 'placeholder-2'),
    ])

    deck.factPool = ['fact-a', 'fact-b', 'fact-c', 'fact-d']
    deck.factCooldown = [
      { factId: 'fact-a', encountersRemaining: 3 },
      { factId: 'fact-b', encountersRemaining: 2 },
    ]

    shuffleFactsAtEncounterEnd(deck, new Set())
    const allCards = [...deck.drawPile, ...deck.discardPile, ...deck.hand]
    expect(allCards).toHaveLength(2)
    expect(allCards.every((card) => card.factId === 'fact-c' || card.factId === 'fact-d')).toBe(true)
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

  it('shuffleFactsAtEncounterEnd avoids duplicate base facts across card slots when alternatives exist (AR-223)', () => {
    // AR-223: Duplicate-avoidance logic moved from drawHand to shuffleFactsAtEncounterEnd.
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

    shuffleFactsAtEncounterEnd(deck, new Set())
    const allCards = [...deck.drawPile, ...deck.discardPile, ...deck.hand]
    expect(allCards).toHaveLength(3)

    const factIds = allCards.map((card) => card.factId)
    const baseKeys = factIds.map((factId) => {
      const fact = factsDB.getById(factId) as any
      return `${fact?.statement ?? ''}|${fact?.correctAnswer ?? ''}`
    })

    expect(new Set(baseKeys).size).toBe(3)
  })
})
