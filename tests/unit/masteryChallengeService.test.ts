import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { factsDB } from '../../src/services/factsDB'
import { rollMasteryChallenge } from '../../src/services/masteryChallengeService'

describe('masteryChallengeService', () => {
  const tier3State = {
    factId: 'fact-1',
    interval: 31,
    stability: 31,
    repetitions: 8,
    consecutiveCorrect: 8,
    passedMasteryTrial: true,
    masteredAt: Date.now() - 86_400_000,
  } as const

  const fact = {
    id: 'fact-1',
    type: 'fact',
    statement: 'Saturn has visible rings.',
    explanation: 'Its icy ring system is observable from Earth with telescopes.',
    quizQuestion: 'Which planet has the most prominent ring system?',
    correctAnswer: 'Saturn',
    distractors: ['Jupiter', 'Mars', 'Venus', 'Mercury', 'Neptune'],
    variants: [
      {
        question: 'Which planet is famous for visible rings?',
        type: 'reverse',
        correctAnswer: 'Saturn',
        distractors: ['Earth', 'Uranus', 'Mars', 'Jupiter', 'Pluto'],
      },
    ],
  } as const

  beforeEach(() => {
    vi.spyOn(factsDB, 'isReady').mockReturnValue(true)
    vi.spyOn(factsDB, 'getById').mockReturnValue(fact as never)
    vi.spyOn(factsDB, 'getAll').mockReturnValue([fact as never])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when room roll misses the rarity gate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const result = rollMasteryChallenge([tier3State as never])
    expect(result).toBeNull()
  })

  it('builds a 3-second mastery challenge with 5 distractors', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = rollMasteryChallenge([tier3State as never])
    expect(result).not.toBeNull()
    expect(result?.timerSeconds).toBe(3)
    expect(result?.answers.length).toBe(6)
    expect(result?.answers).toContain('Saturn')
  })
})
