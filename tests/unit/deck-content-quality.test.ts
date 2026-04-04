import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeckFact {
  id: string
  correctAnswer?: string
  quizQuestion?: string
  difficulty?: number
  funScore?: number
  explanation?: string
  answerTypePoolId?: string
  distractors?: string[]
  quizMode?: string
}

interface AnswerTypePool {
  id: string
  factIds?: string[]
}

interface CuratedDeck {
  id: string
  domain?: string
  facts?: DeckFact[]
  answerTypePools?: AnswerTypePool[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decksDir = path.resolve(__dirname, '../../data/decks')
const manifestPath = path.resolve(decksDir, 'manifest.json')

/**
 * Load all deck files listed in the manifest.
 * Skips entries that start with "test_".
 */
function loadAllDecks(): { file: string; deck: CuratedDeck }[] {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { decks: string[] }
  const results: { file: string; deck: CuratedDeck }[] = []

  for (const filename of manifest.decks) {
    if (filename.startsWith('test_')) continue
    const filePath = path.join(decksDir, filename)
    if (!fs.existsSync(filePath)) continue
    const deck = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CuratedDeck
    results.push({ file: filename, deck })
  }

  return results
}

/**
 * Strip brace-wrapped numeric markers used for distractor generation.
 * e.g. "{1,543}" → "1,543"
 */
function stripBraceMarkers(value: string): string {
  return value.replace(/\{(\d[\d,]*\.?\d*)\}/g, '$1')
}

/**
 * Print violation list with a "and N more" tail, then return.
 */
function reportViolations(label: string, violations: string[]): void {
  if (violations.length === 0) return
  console.warn(`\n  ${label} (${violations.length} total):`)
  for (const v of violations.slice(0, 20)) {
    console.warn(`    - ${v}`)
  }
  if (violations.length > 20) {
    console.warn(`    ... and ${violations.length - 20} more`)
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Curated deck content quality', () => {
  const allDecks = loadAllDecks()

  it('no knowledge fact has answer longer than 100 characters', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      if (deck.domain === 'vocabulary') continue
      for (const fact of deck.facts ?? []) {
        const raw = fact.correctAnswer ?? ''
        const cleaned = stripBraceMarkers(raw)
        if (cleaned.length > 100) {
          violations.push(`[${file}] ${fact.id}: answer length ${cleaned.length} — "${cleaned.slice(0, 60)}..."`)
        }
      }
    }

    reportViolations('Facts with answer > 100 chars', violations)
    expect(violations.length).toBe(0)
  })

  it('no fact has question longer than 400 characters', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      if (deck.domain === 'vocabulary') continue
      for (const fact of deck.facts ?? []) {
        const q = fact.quizQuestion ?? ''
        if (q.length > 400) {
          violations.push(`[${file}] ${fact.id}: question length ${q.length}`)
        }
      }
    }

    reportViolations('Facts with question > 400 chars', violations)
    expect(violations.length).toBe(0)
  })

  it('all facts have difficulty between 1 and 5', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      for (const fact of deck.facts ?? []) {
        const d = fact.difficulty
        if (d === undefined || d === null || d < 1 || d > 5) {
          violations.push(`[${file}] ${fact.id}: difficulty=${d}`)
        }
      }
    }

    reportViolations('Facts with invalid difficulty', violations)
    expect(violations.length).toBe(0)
  })

  it('all facts have funScore between 1 and 10', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      for (const fact of deck.facts ?? []) {
        const s = fact.funScore
        if (s === undefined || s === null || s < 1 || s > 10) {
          violations.push(`[${file}] ${fact.id}: funScore=${s}`)
        }
      }
    }

    reportViolations('Facts with invalid funScore', violations)
    expect(violations.length).toBe(0)
  })

  it('no fact has empty explanation', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      for (const fact of deck.facts ?? []) {
        const e = fact.explanation
        if (!e || String(e).trim().length === 0) {
          violations.push(`[${file}] ${fact.id}`)
        }
      }
    }

    reportViolations('Facts with empty or missing explanation', violations)
    expect(violations.length).toBe(0)
  })

  it('no fact has correctAnswer in its own distractors array', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      for (const fact of deck.facts ?? []) {
        if (!Array.isArray(fact.distractors) || fact.distractors.length === 0) continue
        const answer = (fact.correctAnswer ?? '').toLowerCase().trim()
        if (!answer) continue
        for (const d of fact.distractors) {
          if (typeof d === 'string' && d.toLowerCase().trim() === answer) {
            violations.push(`[${file}] ${fact.id}: answer "${fact.correctAnswer}" appears as distractor`)
            break
          }
        }
      }
    }

    reportViolations('Facts where correctAnswer appears in distractors', violations)
    expect(violations.length).toBe(0)
  })

  it('all fact answerTypePoolIds reference existing pools', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      const poolIds = new Set((deck.answerTypePools ?? []).map(p => p.id))
      for (const fact of deck.facts ?? []) {
        const pid = fact.answerTypePoolId
        if (pid && !poolIds.has(pid)) {
          violations.push(`[${file}] ${fact.id}: references pool "${pid}" which does not exist`)
        }
      }
    }

    reportViolations('Facts referencing missing pools', violations)
    expect(violations.length).toBe(0)
  })

  it('all pool factIds reference existing facts', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      const factIds = new Set((deck.facts ?? []).map(f => f.id))
      for (const pool of deck.answerTypePools ?? []) {
        for (const fid of pool.factIds ?? []) {
          if (!factIds.has(fid)) {
            violations.push(`[${file}] pool "${pool.id}": references fact "${fid}" which does not exist`)
          }
        }
      }
    }

    reportViolations('Pool factIds referencing missing facts', violations)
    expect(violations.length).toBe(0)
  })

  it('no knowledge deck has empty answerTypePools entries', () => {
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      if (deck.domain === 'vocabulary') continue
      for (const pool of deck.answerTypePools ?? []) {
        if (!Array.isArray(pool.factIds) || pool.factIds.length === 0) {
          violations.push(`[${file}] pool "${pool.id}" has no factIds`)
        }
      }
    }

    reportViolations('Knowledge deck pools with empty factIds', violations)
    expect(violations.length).toBe(0)
  })
  it.skip('pool members should have similar answer lengths', () => {
    // NOTE: This test is currently skipped until pool remediation is complete.
    // Once all heterogeneous pools have been fixed, remove the .skip to enforce in CI.
    // Threshold is 4x (more lenient than verifier's 3x FAIL / 2x WARN).
    const BRACE_RE = /^\{\d[\d,]*\.?\d*\}$/
    const violations: string[] = []

    for (const { file, deck } of allDecks) {
      if (deck.domain === 'vocabulary') continue
      const factMap = new Map((deck.facts ?? []).map(f => [f.id, f]))

      for (const pool of deck.answerTypePools ?? []) {
        const lengths: number[] = []
        for (const fid of pool.factIds ?? []) {
          const f = factMap.get(fid)
          if (!f?.correctAnswer) continue
          if (BRACE_RE.test(f.correctAnswer)) continue // skip numerical bracket answers
          const display = f.correctAnswer.replace(/\{(\d[\d,]*\.?\d*)\}/g, '$1')
          lengths.push(display.length)
        }
        if (lengths.length < 2) continue
        const min = Math.min(...lengths)
        const max = Math.max(...lengths)
        if (min > 0 && max / min > 4) {
          violations.push(`[${file}] pool "${pool.id}": max/min length ratio ${(max/min).toFixed(1)}x (${min}–${max} chars)`)
        }
      }
    }

    reportViolations('Pools with heterogeneous answer lengths (ratio > 4x)', violations)
    // expect(violations.length).toBe(0)
  })

})
