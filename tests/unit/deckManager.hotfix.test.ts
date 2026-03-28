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
})
