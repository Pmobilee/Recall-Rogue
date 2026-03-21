// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  BALANCE,
  SM2_SECOND_INTERVAL_DAYS,
  SM2_MASTERY_INTERVAL_GENERAL,
  SM2_MASTERY_INTERVAL_VOCAB,
  getAdaptiveNewCardLimit,
} from '../../src/data/balance'

describe('BALANCE constants — regression guard', () => {
  it('SM-2 ease constants have not changed', () => {
    expect(BALANCE.SM2_INITIAL_EASE).toMatchSnapshot()
    expect(BALANCE.SM2_MIN_EASE).toMatchSnapshot()
  })

  it('SM2_SECOND_INTERVAL_DAYS is 3 (tuned from SM-2 default of 6)', () => {
    expect(SM2_SECOND_INTERVAL_DAYS).toBe(3)
  })

  it('SM2_MASTERY_INTERVAL_GENERAL is 60 days', () => {
    expect(SM2_MASTERY_INTERVAL_GENERAL).toBe(60)
  })

  it('SM2_MASTERY_INTERVAL_VOCAB is 40 days', () => {
    expect(SM2_MASTERY_INTERVAL_VOCAB).toBe(40)
  })
})

describe('getAdaptiveNewCardLimit', () => {
  it('returns 5 when backlog is low (≤ 5)', () => {
    expect(getAdaptiveNewCardLimit(0)).toBe(5)
    expect(getAdaptiveNewCardLimit(5)).toBe(5)
  })

  it('returns 3 (base) for moderate backlog', () => {
    expect(getAdaptiveNewCardLimit(6)).toBe(3)
    expect(getAdaptiveNewCardLimit(14)).toBe(3)
  })

  it('returns 2 when backlog is high (≥ 15)', () => {
    expect(getAdaptiveNewCardLimit(15)).toBe(2)
    expect(getAdaptiveNewCardLimit(50)).toBe(2)
  })
})
