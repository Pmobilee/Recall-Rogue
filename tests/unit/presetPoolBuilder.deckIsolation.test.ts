import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFacts: any[] = []

function setFacts(facts: any[]): void {
  mockFacts.length = 0
  mockFacts.push(...facts)
}

vi.mock('../../src/services/factsDB', () => ({
  factsDB: {
    getAll: () => mockFacts,
    getByCategory: (categories: string[]) => mockFacts.filter((fact) => categories.includes(fact.category[0])),
    getById: (id: string) => mockFacts.find((fact) => fact.id === id) ?? null,
    isReady: () => true,
  },
}))

vi.mock('../../src/services/cardFactory', () => ({
  createCard: (fact: any, reviewState: any) => ({
    id: `card-${fact.id}`,
    factId: fact.id,
    cardType: 'attack',
    tier: '1',
    reviewState,
  }),
  resetCardIdCounter: () => {},
}))

vi.mock('../../src/services/cardTypeAllocator', () => ({
  assignTypesToCards: (cards: any[]) => cards,
}))

vi.mock('../../src/services/randomUtils', () => ({
  shuffled: <T>(items: T[]) => items,
}))

vi.mock('../../src/services/funnessBoost', () => ({
  funScoreWeight: () => 1,
}))

import { buildPresetRunPool } from '../../src/services/presetPoolBuilder'

describe('presetPoolBuilder deck isolation', () => {
  beforeEach(() => {
    setFacts([
      {
        id: 'ja-vocab-n5-1',
        category: ['language_vocab'],
        language: 'ja',
        difficulty: 3,
        quizQuestion: 'What does this word mean?',
        correctAnswer: 'Answer',
        distractors: ['A', 'B', 'C'],
      },
      {
        id: 'ja-kanji-n1-1',
        category: ['language_kanji'],
        language: 'ja',
        difficulty: 3,
        quizQuestion: 'What does this kanji mean?',
        correctAnswer: 'Answer',
        distractors: ['A', 'B', 'C'],
      },
      {
        id: 'ja-grammar-n2-1',
        category: ['language_grammar'],
        language: 'ja',
        difficulty: 3,
        quizQuestion: 'What is the grammar pattern?',
        correctAnswer: 'Answer',
        distractors: ['A', 'B', 'C'],
      },
    ])
  })

  it('keeps review pool inside selected deck when outside-due merge is disabled', () => {
    const now = Date.now()
    const reviewStates: any[] = [
      { factId: 'ja-vocab-n5-1', nextReviewAt: now - 10_000 },
      { factId: 'ja-kanji-n1-1', nextReviewAt: now - 10_000 },
      { factId: 'ja-grammar-n2-1', nextReviewAt: now - 10_000 },
    ]

    const cards = buildPresetRunPool(
      { 'language:ja': ['n5:vocabulary'] },
      reviewStates,
      { poolSize: 3, includeOutsideDueReviews: false },
    )

    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((card) => card.factId === 'ja-vocab-n5-1')).toBe(true)
  })

  it('merges only due external reviews when outside-due merge is enabled', () => {
    const now = Date.now()
    const reviewStates: any[] = [
      { factId: 'ja-vocab-n5-1', nextReviewAt: now - 10_000 },
      { factId: 'ja-kanji-n1-1', nextReviewAt: now - 10_000 },
      { factId: 'ja-grammar-n2-1', nextReviewAt: now + 86_400_000 },
    ]

    const cards = buildPresetRunPool(
      { 'language:ja': ['n5:vocabulary'] },
      reviewStates,
      { poolSize: 3, includeOutsideDueReviews: true },
    )

    const factIds = cards.map((card) => card.factId)
    expect(factIds).toContain('ja-vocab-n5-1')
    expect(factIds).toContain('ja-kanji-n1-1')
    expect(factIds).not.toContain('ja-grammar-n2-1')
  })
})
