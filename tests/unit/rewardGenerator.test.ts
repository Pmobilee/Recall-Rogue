import { describe, expect, it } from 'vitest'
import {
  generateCardRewardOptions,
  generateCardRewardOptionsByType,
  rerollRewardCardInType,
} from '../../src/services/rewardGenerator'
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
  }
}

describe('rewardGenerator', () => {
  it('filters active deck, consumed, and tier3 cards', () => {
    const pool: Card[] = [
      card({ id: 'a', factId: 'a', tier: '1' }),
      card({ id: 'b', factId: 'b', tier: '3' }),
      card({ id: 'c', factId: 'c', tier: '2a' }),
      card({ id: 'd', factId: 'd', tier: '2b' }),
    ]

    const options = generateCardRewardOptions(
      pool,
      new Set(['a', 'c']),
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

  it('builds type-based options with unique card types', () => {
    const pool: Card[] = [
      card({ id: 'a', factId: 'a', cardType: 'attack' }),
      card({ id: 'b', factId: 'b', cardType: 'shield' }),
      card({ id: 'c', factId: 'c', cardType: 'utility' }),
      card({ id: 'd', factId: 'd', cardType: 'buff' }),
      card({ id: 'e', factId: 'e', cardType: 'debuff' }),
    ]

    const options = generateCardRewardOptionsByType(pool, new Set(), new Set(), 'balanced')
    expect(options.length).toBeGreaterThan(0)
    expect(new Set(options.map((option) => option.cardType)).size).toBe(options.length)
  })

  it('rerolls fact inside selected type', () => {
    const pool: Card[] = [
      card({ id: 'a', factId: 'a', cardType: 'attack' }),
      card({ id: 'b', factId: 'b', cardType: 'attack' }),
      card({ id: 'c', factId: 'c', cardType: 'shield' }),
      card({ id: 'd', factId: 'd', cardType: 'utility' }),
    ]

    const current = [
      pool[0],
      pool[2],
      pool[3],
    ]

    const rerolled = rerollRewardCardInType(pool, new Set(), new Set(), current, 'attack')
    expect(rerolled.find((option) => option.cardType === 'attack')?.factId).toBe('b')
  })
})
