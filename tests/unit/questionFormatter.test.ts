import { describe, expect, it, vi } from 'vitest'
import { getQuestionPresentation } from '../../src/services/questionFormatter'

describe('questionFormatter', () => {
  it('returns mastery trial override config', () => {
    const presentation = getQuestionPresentation('2b', true)
    expect(presentation.optionCount).toBe(5)
    expect(presentation.timerOverride).toBe(4)
    expect(presentation.disableSlowReader).toBe(true)
    expect(presentation.useCloseDistractors).toBe(true)
  })

  it('returns tier 1 default format', () => {
    const presentation = getQuestionPresentation('1', false)
    expect(presentation.optionCount).toBe(3)
    expect(presentation.useCloseDistractors).toBe(false)
  })

  it('supports reverse/fill blank chances for 2a/2b', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const tier2a = getQuestionPresentation('2a', false)
    const tier2b = getQuestionPresentation('2b', false)

    expect(tier2a.optionCount).toBe(4)
    expect(tier2a.useReverse).toBe(true)

    expect(tier2b.optionCount).toBe(5)
    expect(tier2b.useReverse).toBe(true)
    expect(tier2b.useFillBlank).toBe(true)

    spy.mockRestore()
  })
})
