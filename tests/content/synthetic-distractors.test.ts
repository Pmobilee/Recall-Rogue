import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// CRITICAL-1 Regression Tests: {N} template token leak prevention
// 2026-04-10 — 89 synthetic distractors in 7 decks were formatted as {N}
// bracket-notation tokens (e.g. '{7}', '{1990}', '{2} bya') instead of
// plain values. These leaked into the quiz UI and displayed literally.
// These tests enforce that no such values can ship in a syntheticDistractors
// array of any curated deck.
//
// Invariants tested:
//  1. No syntheticDistractor contains a raw '{' or '}' character
//     (unless it is the special fill-in-blank token '{___}', which should
//      never appear in distractors anyway — only in quizQuestion stems)
//  2. The above invariant holds across ALL decks in data/decks/
//  3. Known-bad format strings are reliably detected as malformed
//  4. Known-good format strings pass without false positives
// ---------------------------------------------------------------------------

const DECKS_DIR = path.resolve(__dirname, '../../data/decks')

// ---------------------------------------------------------------------------
// Helper: check whether a distractor string contains raw braces (bad)
// ---------------------------------------------------------------------------
function hasBraceLeak(distractor: string): boolean {
  if (typeof distractor !== 'string') return false
  // {___} is the fill-in-blank token; it should never appear in a distractor
  // but if it does it still counts as a brace leak
  return /[{}]/.test(distractor)
}

// ---------------------------------------------------------------------------
// Unit tests: known-bad patterns
// ---------------------------------------------------------------------------
describe('hasBraceLeak — known-bad patterns', () => {
  const badCases = [
    '{7}',
    '{1990}',
    '{150000}',
    '{2} bya',
    '{2.5} bya',
    '{1958}',
    '{3}',
    '{12}',
    '{5}',
    '{15}',
    '{___}',           // fill-in-blank token — not a valid distractor
    'prefix {value}',  // brace in middle
    '{leading',        // unclosed brace
    'trailing}',       // unopened brace
  ]

  for (const bad of badCases) {
    it(`detects bad distractor: ${JSON.stringify(bad)}`, () => {
      expect(hasBraceLeak(bad)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Unit tests: known-good patterns (no false positives)
// ---------------------------------------------------------------------------
describe('hasBraceLeak — known-good patterns', () => {
  const goodCases = [
    '7',
    '1990',
    '150000',
    '2 bya',
    '1958',
    'Voyager',
    'Pioneer',
    'Soyuz',
    'Johann Heinrich von Thünen',
    'terracing',
    'renal cortex',
    '1797',
    '1809',
    '3 billion years ago',
    'trap cultivation',
    '',              // empty string — not a brace leak (bad for other reasons)
  ]

  for (const good of goodCases) {
    it(`allows good distractor: ${JSON.stringify(good)}`, () => {
      expect(hasBraceLeak(good)).toBe(false)
    })
  }
})

// ---------------------------------------------------------------------------
// Integration test: scan ALL deck files for brace leaks in syntheticDistractors
// ---------------------------------------------------------------------------
describe('CRITICAL-1 regression: no {N} braces in any syntheticDistractors', () => {
  interface AnswerTypePool {
    id: string
    factIds?: string[]
    syntheticDistractors?: unknown[]
    homogeneityExempt?: boolean
  }

  interface Deck {
    id?: string
    answerTypePools?: AnswerTypePool[]
  }

  it('scans all data/decks/*.json and finds zero brace-leaked synthetic distractors', () => {
    const deckFiles = fs.readdirSync(DECKS_DIR).filter((f) => f.endsWith('.json'))
    expect(deckFiles.length).toBeGreaterThan(0)

    const leaks: Array<{ file: string; pool: string; distractor: string }> = []

    for (const file of deckFiles) {
      const raw = fs.readFileSync(path.join(DECKS_DIR, file), 'utf-8')
      const deck: Deck = JSON.parse(raw)

      for (const pool of deck.answerTypePools ?? []) {
        for (const synth of pool.syntheticDistractors ?? []) {
          if (typeof synth === 'string' && hasBraceLeak(synth)) {
            leaks.push({ file, pool: pool.id, distractor: synth })
          }
        }
      }
    }

    if (leaks.length > 0) {
      const report = leaks
        .map((l) => `  ${l.file} / pool "${l.pool}": ${JSON.stringify(l.distractor)}`)
        .join('\n')
      throw new Error(
        `CRITICAL-1: Found ${leaks.length} brace-leaked synthetic distractor(s) — strip them and fix the generator:\n${report}`
      )
    }

    expect(leaks).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Regression: the 7 decks that were previously affected must be clean
// ---------------------------------------------------------------------------
describe('CRITICAL-1 regression: previously affected decks are clean', () => {
  const affectedDecks = [
    { file: 'ancient_rome.json', pool: 'bracket_numbers' },
    { file: 'ap_biology.json', pool: 'geological_timescale' },
    { file: 'ap_psychology.json', pool: 'bracket_numbers' },
    { file: 'medieval_world.json', pool: 'bracket_numbers' },
    { file: 'movies_cinema.json', pool: 'bracket_counts' },
    { file: 'nasa_missions.json', pool: 'launch_years' },
    { file: 'us_presidents.json', pool: 'inauguration_years' },
  ]

  for (const { file, pool: poolId } of affectedDecks) {
    it(`${file} / pool "${poolId}" has zero brace-leaked synthetics`, () => {
      const raw = fs.readFileSync(path.join(DECKS_DIR, file), 'utf-8')
      const deck = JSON.parse(raw)
      const pool = (deck.answerTypePools ?? []).find((p: { id: string }) => p.id === poolId)
      expect(pool).toBeDefined()

      const leaked = (pool?.syntheticDistractors ?? []).filter(
        (d: unknown) => typeof d === 'string' && hasBraceLeak(d)
      )
      expect(leaked).toHaveLength(0)
    })
  }
})
