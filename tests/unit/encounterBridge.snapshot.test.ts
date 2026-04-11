import { describe, expect, it, beforeEach } from 'vitest'
import type { Card } from '../../src/data/card-types'
import { hydrateEncounterSnapshot, resetEncounterBridge, serializeEncounterSnapshot } from '../../src/services/encounterBridge'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    factId: 'fact-1',
    cardType: 'attack',
    domain: 'history',
    tier: '1',
    baseEffectValue: 8,
    effectMultiplier: 1,
    ...overrides,
  }
}

describe('encounterBridge snapshot serialization', () => {
  beforeEach(() => {
    resetEncounterBridge()
  })

  it('round-trips active deck and run pool snapshots', () => {
    const cardA = makeCard({ id: 'card-a', factId: 'fact-a' })
    const cardB = makeCard({ id: 'card-b', factId: 'fact-b', cardType: 'shield' })
    const snapshot = {
      activeDeck: {
        drawPile: [cardA],
        discardPile: [cardB],
        hand: [],
        forgetPile: [],
        comboCount: 0,
        currentFloor: 2,
        currentEncounter: 1,
        playerHP: 88,
        playerMaxHP: 100,
        playerShield: 3,
        hintsRemaining: 1,
        currency: 5,
        factPool: ['fact-a', 'fact-b'],
        factCooldown: [{ factId: 'fact-a', encountersRemaining: 1 }],
      },
      activeRunPool: [cardA, cardB],
    } as const

    hydrateEncounterSnapshot(snapshot)
    const serialized = serializeEncounterSnapshot()

    expect(serialized.activeDeck?.drawPile).toHaveLength(1)
    expect(serialized.activeDeck?.discardPile).toHaveLength(1)
    expect(serialized.activeDeck?.factCooldown[0]).toEqual({ factId: 'fact-a', encountersRemaining: 1 })
    expect(serialized.activeRunPool).toHaveLength(2)
    expect(serialized.activeRunPool.map((card) => card.factId)).toEqual(['fact-a', 'fact-b'])
  })
})

