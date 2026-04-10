/**
 * Domain-detection tests for getNumericalDistractors / detectAnswerDomain.
 *
 * Verifies that generated distractors are clamped to physically plausible ranges
 * when the answer domain can be detected from question text or answer format.
 *
 * Bug this covers: solar_system_sun_mass_percentage had correctAnswer "{99.86}"
 * (bare number, no % suffix) and generated distractors like 138.52 — impossible
 * percentages. Players could eliminate them instantly.
 */

import { describe, it, expect } from 'vitest'
import {
  getNumericalDistractors,
  detectAnswerDomain,
  isNumericalAnswer,
  displayAnswer,
} from './numericalDistractorService'
import type { Fact } from '../data/types'

// ---------------------------------------------------------------------------
// Helper: build a minimal Fact for testing
// ---------------------------------------------------------------------------
function makeFact(id: string, correctAnswer: string, quizQuestion?: string): Fact {
  return { id, correctAnswer, quizQuestion } as unknown as Fact
}

// ---------------------------------------------------------------------------
// detectAnswerDomain unit tests
// ---------------------------------------------------------------------------

describe('detectAnswerDomain', () => {
  it('detects percentage from % in answer', () => {
    const d = detectAnswerDomain('At least {93}%', '')
    expect(d.kind).toBe('percentage')
    expect(d.clamp).toEqual({ min: 0, max: 100 })
  })

  it('detects percentage from "percent" in question', () => {
    const d = detectAnswerDomain('{99.86}', 'What percentage of the solar system mass is in the Sun?')
    expect(d.kind).toBe('percentage')
    expect(d.clamp).toEqual({ min: 0, max: 100 })
  })

  it('detects percentage from "percentage" keyword in question', () => {
    const d = detectAnswerDomain('{75}', 'What percentage of Earth is covered by water?')
    expect(d.kind).toBe('percentage')
    expect(d.clamp).toEqual({ min: 0, max: 100 })
  })

  it('detects year from 4-digit shape in answer', () => {
    const d = detectAnswerDomain('{1969}', '')
    expect(d.kind).toBe('year')
    expect(d.clamp).toEqual({ min: 1, max: 2100 })
  })

  it('detects year from "year" keyword in question', () => {
    const d = detectAnswerDomain('{1969}', 'In what year did Apollo 11 land on the Moon?')
    expect(d.kind).toBe('year')
    expect(d.clamp).toEqual({ min: 1, max: 2100 })
  })

  it('detects count from "how many" in question', () => {
    const d = detectAnswerDomain('{8}', 'How many planets are in the solar system?')
    expect(d.kind).toBe('count')
    expect(d.clamp).toEqual({ min: 0, max: Infinity })
  })

  it('detects count from "number of" in question', () => {
    const d = detectAnswerDomain('{206}', 'What is the number of bones in an adult human body?')
    expect(d.kind).toBe('count')
    expect(d.clamp).toEqual({ min: 0, max: Infinity })
  })

  it('detects measurement from unit in answer', () => {
    const d = detectAnswerDomain('{384400} km', '')
    expect(d.kind).toBe('measurement')
    expect(d.clamp?.min).toBe(0.001)
  })

  it('detects measurement from km keyword in question', () => {
    const d = detectAnswerDomain('{384400}', 'What is the average distance from Earth to the Moon in kilometers?')
    expect(d.kind).toBe('measurement')
    expect(d.clamp?.min).toBe(0.001)
  })

  it('returns unknown for ambiguous bare numbers with no hints', () => {
    const d = detectAnswerDomain('{42}', 'What is the answer?')
    expect(d.kind).toBe('unknown')
    expect(d.clamp).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getNumericalDistractors domain clamp integration tests
// ---------------------------------------------------------------------------

describe('getNumericalDistractors — percentage domain', () => {
  it('all distractors ≤ 100 for bare percentage answer with question hint', () => {
    const fact = makeFact(
      'solar_system_sun_mass_percentage',
      '{99.86}',
      'What percentage of the solar system total mass does the Sun contain (to 2 decimal places)?',
    )
    const distractors = getNumericalDistractors(fact, 5, fact.quizQuestion as string)
    expect(distractors.length).toBeGreaterThan(0)
    for (const d of distractors) {
      const num = parseFloat(d)
      expect(num).toBeLessThanOrEqual(100)
      expect(num).toBeGreaterThanOrEqual(0)
    }
  })

  it('all distractors ≤ 100 when answer has % suffix', () => {
    const fact = makeFact('pct_test', 'At least {93}%', 'What percentage is this?')
    const distractors = getNumericalDistractors(fact, 5)
    expect(distractors.length).toBeGreaterThan(0)
    for (const d of distractors) {
      // Extract number from "At least 87.32%" style string
      const match = d.match(/[\d.]+/)
      expect(match).not.toBeNull()
      const num = parseFloat(match![0])
      expect(num).toBeLessThanOrEqual(100)
      expect(num).toBeGreaterThanOrEqual(0)
    }
  })

  it('does not return correct answer as distractor', () => {
    const fact = makeFact(
      'solar_system_sun_mass_percentage',
      '{99.86}',
      'What percentage of the solar system total mass does the Sun contain?',
    )
    const distractors = getNumericalDistractors(fact, 5, fact.quizQuestion as string)
    expect(distractors).not.toContain('99.86')
  })
})

describe('getNumericalDistractors — year domain', () => {
  it('all distractors in [1000, 2100] for year answer', () => {
    const fact = makeFact(
      'apollo11_year',
      '{1969}',
      'In what year did Apollo 11 land on the Moon?',
    )
    const distractors = getNumericalDistractors(fact, 5, fact.quizQuestion as string)
    expect(distractors.length).toBeGreaterThan(0)
    for (const d of distractors) {
      const num = parseInt(d, 10)
      expect(num).toBeGreaterThanOrEqual(1000)
      expect(num).toBeLessThanOrEqual(2100)
    }
  })

  it('all distractors in [1, 2100] for year answer detected by shape alone', () => {
    const fact = makeFact('year_shape', '{1776}', 'Some historical question.')
    const distractors = getNumericalDistractors(fact, 5)
    expect(distractors.length).toBeGreaterThan(0)
    for (const d of distractors) {
      const num = parseInt(d, 10)
      expect(num).toBeGreaterThanOrEqual(1)
      expect(num).toBeLessThanOrEqual(2100)
    }
  })
})

describe('getNumericalDistractors — count domain', () => {
  it('all distractors are non-negative for "how many" question', () => {
    const fact = makeFact(
      'planets_count',
      '{8}',
      'How many planets are in the solar system?',
    )
    const distractors = getNumericalDistractors(fact, 5, fact.quizQuestion as string)
    expect(distractors.length).toBeGreaterThan(0)
    for (const d of distractors) {
      const num = parseInt(d, 10)
      expect(num).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('getNumericalDistractors — measurement domain', () => {
  it('all distractors positive for distance measurement', () => {
    const fact = makeFact(
      'moon_distance',
      '{384400} km',
      'What is the average distance from Earth to the Moon in kilometers?',
    )
    const distractors = getNumericalDistractors(fact, 5, fact.quizQuestion as string)
    expect(distractors.length).toBeGreaterThan(0)
    for (const d of distractors) {
      const match = d.match(/[\d,]+/)
      expect(match).not.toBeNull()
      const num = parseFloat(match![0].replace(/,/g, ''))
      expect(num).toBeGreaterThan(0)
    }
  })
})

describe('getNumericalDistractors — unknown domain', () => {
  it('still produces distractors for ambiguous bare number', () => {
    const fact = makeFact('misc_number', '{42}', 'What is the answer to life?')
    const distractors = getNumericalDistractors(fact, 3)
    // Behavior unchanged from previous implementation — just must produce something
    expect(distractors.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Unchanged API surface tests
// ---------------------------------------------------------------------------

describe('isNumericalAnswer', () => {
  it('detects brace-marked numbers', () => {
    expect(isNumericalAnswer('{107} days')).toBe(true)
    expect(isNumericalAnswer('At least {93}%')).toBe(true)
    expect(isNumericalAnswer('{21,196} km')).toBe(true)
    expect(isNumericalAnswer('{5.5}')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(isNumericalAnswer('Silk Road')).toBe(false)
    expect(isNumericalAnswer('Jupiter')).toBe(false)
    expect(isNumericalAnswer('')).toBe(false)
  })
})

describe('displayAnswer', () => {
  it('strips braces', () => {
    expect(displayAnswer('{107} days')).toBe('107 days')
    expect(displayAnswer('At least {93}%')).toBe('At least 93%')
    expect(displayAnswer('Silk Road')).toBe('Silk Road')
  })
})
