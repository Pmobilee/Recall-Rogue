import { describe, expect, it } from 'vitest'
import {
  buildCoverageReport,
  detectDuplicateQuestions,
  normalizeFactInput,
  validateFactRecord,
} from '../../scripts/contentPipelineUtils.mjs'

describe('contentPipelineUtils', () => {
  it('rejects facts without sourceName', () => {
    const fact = normalizeFactInput({
      statement: 'Neptune has the strongest winds in the Solar System.',
      explanation: 'Its atmosphere reaches high supersonic velocity.',
      quizQuestion: 'Which planet has the strongest recorded winds?',
      correctAnswer: 'Neptune',
      distractors: ['Mars', 'Jupiter'],
      category: ['Natural Sciences'],
    }, { domain: 'science', verify: false })

    const result = validateFactRecord(fact)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('missing_source_name')
  })

  it('flags fuzzy duplicates above threshold', () => {
    const existing = [{
      quizQuestion: 'Which planet has the strongest recorded winds?',
      statement: 'Neptune has the strongest winds in the Solar System.',
    }]
    const candidates = [{
      quizQuestion: 'Which planet has the strongest winds ever recorded?',
      statement: 'Neptune has extreme atmospheric winds.',
    }]

    const duplicates = detectDuplicateQuestions(candidates, existing, 0.85)
    expect(duplicates.length).toBe(1)
    expect(duplicates[0]?.reason).toBe('fuzzy_duplicate')
  })

  it('builds coverage counts with verification split', () => {
    const report = buildCoverageReport([
      {
        id: 'fact-1',
        type: 'fact',
        category: ['Natural Sciences'],
        categoryL1: 'Natural Sciences',
        difficulty: 2,
        ageRating: 'teen',
        sourceName: 'NASA',
        distractors: ['Mercury', 'Venus'],
        correctAnswer: 'Earth',
        verifiedAt: null,
      },
      {
        id: 'fact-2',
        type: 'vocabulary',
        category: ['Language'],
        categoryL1: 'Language',
        difficulty: 1,
        ageRating: 'kid',
        sourceName: 'Wikipedia',
        distractors: ['small', 'tiny'],
        correctAnswer: 'big',
        verifiedAt: '2026-03-09T00:00:00.000Z',
      },
    ])

    expect(report.totalFacts).toBe(2)
    expect(report.byVerification.verified).toBe(1)
    expect(report.byVerification.unverified).toBe(1)
    expect(report.byType.fact).toBe(1)
    expect(report.byType.vocabulary).toBe(1)
  })

  it('normalizes generated shapes (object distractors, string category, string variants)', () => {
    const fact = normalizeFactInput({
      id: 'gen-1',
      statement: 'The Eiffel Tower is in Paris.',
      explanation: 'Landmark in France.',
      quizQuestion: 'Where is the Eiffel Tower?',
      correctAnswer: 'Paris',
      distractors: [
        { text: 'London', difficultyTier: 'easy' },
        { text: 'Rome', difficultyTier: 'easy' },
      ],
      category: 'geography',
      variants: [
        'Which city has the Eiffel Tower?',
        'The Eiffel Tower is located in which city?',
      ],
      sourceName: 'Wikipedia',
      ageRating: 'kid',
      type: 'fact',
    }, { domain: 'geography', verify: false })

    expect(fact.category).toEqual(['geography'])
    expect(fact.distractors).toEqual(['London', 'Rome'])
    expect(Array.isArray(fact.variants)).toBe(true)
    expect(fact.variants?.length).toBe(2)
    expect(fact.variants?.[0]?.type).toBe('forward')
    const result = validateFactRecord(fact)
    expect(result.valid).toBe(true)
  })
})
