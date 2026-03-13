import { describe, expect, it } from 'vitest'
import { getNonCuratedQuestion, getQuestionVariantCount } from '../../src/ui/utils/combatQuestionPolicy'

describe('combat question policy', () => {
  it('uses exactly one variant for non-curated facts', () => {
    expect(getQuestionVariantCount(false, 3)).toBe(1)
  })

  it('preserves curated variant counts', () => {
    expect(getQuestionVariantCount(true, 4)).toBe(4)
  })

  it('keeps non-curated authored question text', () => {
    const question = 'What does the Newtonian gravitational constant describe?'
    expect(getNonCuratedQuestion(question)).toBe(question)
  })
})

