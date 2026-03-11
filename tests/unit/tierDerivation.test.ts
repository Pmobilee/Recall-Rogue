import { describe, expect, it } from 'vitest'
import { getCardTier, qualifiesForMasteryTrial } from '../../src/services/tierDerivation'

describe('tierDerivation', () => {
  it('returns tier 1 below thresholds', () => {
    expect(getCardTier({ stability: 1.9, consecutiveCorrect: 1, passedMasteryTrial: false })).toBe('1')
  })

  it('returns tier 2a at first threshold', () => {
    expect(getCardTier({ stability: 2, consecutiveCorrect: 2, passedMasteryTrial: false })).toBe('2a')
  })

  it('returns tier 2b at second threshold', () => {
    expect(getCardTier({ stability: 5, consecutiveCorrect: 3, passedMasteryTrial: false })).toBe('2b')
  })

  it('returns tier 3 only when mastery trial is passed', () => {
    expect(getCardTier({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: false })).toBe('2b')
    expect(getCardTier({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: true })).toBe('3')
  })

  it('flags mastery-trial eligibility only for qualifying 2b facts', () => {
    expect(qualifiesForMasteryTrial({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: false })).toBe(true)
    expect(qualifiesForMasteryTrial({ stability: 9.9, consecutiveCorrect: 4, passedMasteryTrial: false })).toBe(false)
    expect(qualifiesForMasteryTrial({ stability: 10, consecutiveCorrect: 4, passedMasteryTrial: true })).toBe(false)
  })
})
