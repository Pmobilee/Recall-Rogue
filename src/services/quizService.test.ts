import { describe, expect, it } from 'vitest'
import type { Fact } from '../data/types'
import { BALANCE } from '../data/balance'
import { getQuizChoices } from './quizService'

describe('getQuizChoices', () => {
  it('does not produce a single-choice quiz for zero-valued numeric facts', () => {
    const fact = {
      id: 'food_cuisine-bell-pepper-zero-scoville',
      type: 'fact',
      quizQuestion: 'What is the Scoville heat rating of a bell pepper?',
      correctAnswer: '0',
      distractors: [],
    } as unknown as Fact

    const choices = getQuizChoices(fact)

    expect(choices).toContain('0')
    expect(choices).toHaveLength(BALANCE.QUIZ_DISTRACTORS_SHOWN + 1)
    expect(new Set(choices).size).toBe(choices.length)
  })
})
