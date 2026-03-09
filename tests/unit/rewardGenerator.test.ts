import { describe, expect, it } from 'vitest'
import { generateCardRewardOptions } from '../../src/services/rewardGenerator'
import type { Card } from '../../src/data/card-types'

function card(partial: Partial<Card>): Card {
  return {
    id: partial.id ?? 'card_1',
    factId: partial.factId ?? 'fact_1',
    cardType: partial.cardType ?? 'attack',
    domain: partial.domain ?? 'science',
    tier: partial.tier ?? '1',
    baseEffectValue: partial.baseEffectValue ?? 8,
    effectMultiplier: partial.effectMultiplier ?? 1,
    isEcho: partial.isEcho,
  }
}

describe('rewardGenerator', () => {
  it('filters active deck, consumed, tier3, and echo cards', () => {
    const pool: Card[] = [
      card({ id: 'a', factId: 'a', tier: '1' }),
      card({ id: 'b', factId: 'b', tier: '3' }),
      card({ id: 'c', factId: 'c', tier: '2a', isEcho: true }),
      card({ id: 'd', factId: 'd', tier: '2b' }),
    ]

    const options = generateCardRewardOptions(
      pool,
      new Set(['a']),
      new Set(['d']),
      3,
    )

    expect(options).toHaveLength(0)
  })

  it('returns up to requested count from eligible cards', () => {
    const pool: Card[] = [
      card({ id: 'a', factId: 'a', tier: '1' }),
      card({ id: 'b', factId: 'b', tier: '2a' }),
      card({ id: 'c', factId: 'c', tier: '2b' }),
      card({ id: 'd', factId: 'd', tier: '3' }),
    ]

    const options = generateCardRewardOptions(pool, new Set(), new Set(), 3)
    expect(options).toHaveLength(3)
    expect(options.every((c) => c.tier !== '3')).toBe(true)
  })
})
