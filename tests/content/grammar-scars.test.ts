import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// HIGH-5 Regression Tests: Grammar scar pattern detection
// 2026-04-10 — 68 grammar scars found across 8 decks (second occurrence after
// the 2026-04-09 entry in gotchas.md). Patterns like "a the reactant molecule",
// "cerebral the concept", "logic-the concept approach" result from naive
// word-substitution that replaces category nouns with placeholders without
// rewriting the surrounding grammar.
//
// These tests verify that:
//  1. Known-broken strings are reliably detected by the grammar-scar checker
//  2. Known-good strings (legitimate English) do NOT trigger false positives
//  3. All production decks in data/decks/ have zero grammar scars
//
// Pattern catalog: scripts/content-pipeline/grammar-scar-patterns.json
// Checker: scripts/verify-all-decks.mjs Check #25
// ---------------------------------------------------------------------------

const DECKS_DIR = path.resolve(__dirname, '../../data/decks')
const CATALOG_PATH = path.resolve(__dirname, '../../scripts/content-pipeline/grammar-scar-patterns.json')

// ---------------------------------------------------------------------------
// Load the grammar scar catalog
// ---------------------------------------------------------------------------
interface ScarPattern {
  id: string
  pattern: string
  description: string
}

function loadPatterns(): ScarPattern[] {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
  return (catalog.patterns || []) as ScarPattern[]
}

// ---------------------------------------------------------------------------
// Helper: check a string against all patterns
// ---------------------------------------------------------------------------
function findScars(text: string, patterns: ScarPattern[]): ScarPattern[] {
  return patterns.filter(p => text.includes(p.pattern))
}

// ---------------------------------------------------------------------------
// Unit tests: known-bad patterns (must trigger)
// ---------------------------------------------------------------------------
describe('Grammar scar detection — known-bad patterns (must FAIL)', () => {
  const patterns = loadPatterns()

  const badCases: [string, string][] = [
    // [broken question text, expected pattern id]
    ['What forms when a the reactant molecule binds the active site?', 'a_the_double_article'],
    ['bound to a the substrate in the active site', 'a_the_double_article'],
    ['also called the the concept threshold — is known by what abbreviation?', 'the_the_double_article'],
    ['How is the the weighted mean atomic mass of an element calculated', 'the_the_double_article'],
    ['reflecting its logic-the concept approach where you declare facts', 'hyphenated_the_concept'],
    ['the 1963 7-bit character encoding the concept that assigns numeric codes', 'encoding_the_concept_that'],
    ['The anatomical this connects the two chambers of the heart', 'anatomical_this'],
    ['When did the Soviet this collapse into 15 independent states?', 'soviet_this_placeholder'],
    ['This method was developed in a who first described it', 'in_a_who'],
    ['Which element is found in the this compound?', 'the_this_pronoun'],
    ['What 1987 UN this introduced the concept of sustainable development?', 'un_this_introduced'],
  ]

  for (const [text, expectedPatternId] of badCases) {
    it(`detects "${expectedPatternId}" in: "${text.slice(0, 60)}..."`, () => {
      const scars = findScars(text, patterns)
      expect(scars.length).toBeGreaterThan(0)
      const matched = scars.some(s => s.id === expectedPatternId)
      expect(matched).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Unit tests: known-good patterns (must NOT trigger)
// ---------------------------------------------------------------------------
describe('Grammar scar detection — known-good patterns (must PASS)', () => {
  const patterns = loadPatterns()

  const goodCases: string[] = [
    // Legitimate "the concept of" usage
    'Which psychologist proposed the concept of g factor?',
    'Which psychologist popularized the concept of emotional intelligence?',
    'What Enlightenment philosopher introduced the concept of the general will?',
    'In Neoplatonism, what is the process called whereby lower levels of reality flow from higher?',
    // Legitimate "the concept that" usage
    'What concept holds that plants convert sunlight to energy?',
    // Normal English with "the" appearing naturally
    'How does the measured magnitude of oscillation affect the period?',
    'What process describes the movement of alleles between populations?',
    // Answers with "the" in proper context
    'What temporary complex forms when a substrate molecule binds the active site of an enzyme?',
    'Which cerebral hemisphere is dominant for language processing?',
    'What type of thinking involves generating many possible solutions?',
  ]

  for (const text of goodCases) {
    it(`no false positive for: "${text.slice(0, 60)}..."`, () => {
      const scars = findScars(text, patterns)
      expect(scars.length).toBe(0)
    })
  }
})

// ---------------------------------------------------------------------------
// Integration test: all production decks must have zero grammar scars
// ---------------------------------------------------------------------------
describe('Production decks — zero grammar scars', () => {
  const patterns = loadPatterns()

  if (patterns.length === 0) {
    it('SKIPPED — grammar-scar-patterns.json has no patterns', () => {
      // This is a configuration error but we don't want to fail the test suite
      console.warn('[grammar-scars.test] Warning: no patterns loaded from catalog')
    })
    return
  }

  const deckFiles = fs.readdirSync(DECKS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))

  for (const deckFile of deckFiles) {
    it(`${deckFile} has no grammar scars`, () => {
      const deckPath = path.join(DECKS_DIR, deckFile)
      const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'))
      const facts = (deck.facts || []) as Array<{ id: string; quizQuestion?: string }>

      const violations: string[] = []
      for (const fact of facts) {
        const q = fact.quizQuestion || ''
        if (!q) continue
        const scars = findScars(q, patterns)
        for (const scar of scars) {
          violations.push(
            `fact "${fact.id}": pattern "${scar.id}" (${scar.pattern}) in question: "${q.slice(0, 80)}"`
          )
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Grammar scars found in ${deckFile}:\n` +
          violations.map(v => `  - ${v}`).join('\n') +
          '\n\nRun: node scripts/verify-all-decks.mjs --verbose for details.\n' +
          'Fix: rewrite the question stem naturally instead of using placeholder substitution.'
        )
      }
    })
  }
})
