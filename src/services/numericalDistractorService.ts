import type { Fact } from '../data/types'
import { BALANCE } from '../data/balance'

// ---------------------------------------------------------------------------
// Simple seeded PRNG (mulberry32) — deterministic per fact.id within a session
// ---------------------------------------------------------------------------

/**
 * Creates a seeded pseudo-random number generator (mulberry32).
 * Returns a function that yields floats in [0, 1).
 */
function makePrng(seed: number): () => number {
  let s = seed >>> 0
  return (): number => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Converts a fact ID string to a numeric seed.
 * Uses a simple djb2-style hash.
 */
function seedFromId(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) ^ id.charCodeAt(i)
  }
  return h >>> 0
}

// ---------------------------------------------------------------------------
// Brace-pattern detection
// ---------------------------------------------------------------------------

/**
 * Matches a brace-marked number in an answer, e.g. "{107}", "{21,196}", "{5.5}".
 * Only digits, commas, and a single decimal point are allowed inside the braces.
 */
const BRACE_NUMBER_RE = /\{(\d[\d,]*\.?\d*)\}/

/**
 * Returns true when the answer contains a brace-marked numerical variable,
 * e.g. "{107} days", "At least {93}%", "{21,196} km".
 *
 * @param answer - The fact's correctAnswer string.
 */
export function isNumericalAnswer(answer: string): boolean {
  return BRACE_NUMBER_RE.test(answer)
}

/**
 * Strips the brace markers from an answer string for display.
 *
 * @example
 *   displayAnswer("{107} days")    // "107 days"
 *   displayAnswer("At least {93}%") // "At least 93%"
 *   displayAnswer("Silk Road")     // "Silk Road"  (unchanged)
 *
 * @param answer - The fact's correctAnswer string (may or may not contain braces).
 */
export function displayAnswer(answer: string): string {
  return answer.replace(/\{(\d[\d,]*\.?\d*)\}/, '$1')
}

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

/** Strips thousands-separator commas and parses to float: "21,196" → 21196 */
function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

/** Returns true if the original number string contained a thousands comma. */
function hadCommas(s: string): boolean {
  return s.includes(',')
}

/** Returns the number of decimal places in a numeric string. */
function decimalPlaces(s: string): number {
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

/**
 * Formats a number to match the style of the original numeric string:
 * - Same number of decimal places
 * - Comma grouping for integers ≥ 1000 if the original had commas
 *
 * @param n       - The number to format.
 * @param origStr - The original number string to infer formatting from.
 */
function formatLike(n: number, origStr: string): string {
  const places = decimalPlaces(origStr)
  if (places > 0) {
    return n.toFixed(places)
  }
  const rounded = Math.round(n)
  if (hadCommas(origStr) || rounded >= 10000) {
    return rounded.toLocaleString('en-US')
  }
  return String(rounded)
}

// ---------------------------------------------------------------------------
// Variation strategy
// ---------------------------------------------------------------------------

type RandFn = () => number

/**
 * Generates candidate varied numbers for a given base value.
 * Strategy scales with magnitude and special-cases years and small counts.
 *
 * @param base     - The parsed base number.
 * @param origStr  - The original number string (used for format detection).
 * @param rand     - Seeded PRNG function.
 * @param count    - Number of candidates to attempt to generate.
 */
function generateVariations(base: number, origStr: string, rand: RandFn, count: number): string[] {
  const places = decimalPlaces(origStr)
  const isDecimal = places > 0

  // --- Decimal numbers: match precision, ±20-50% ---
  if (isDecimal) {
    const results: string[] = []
    for (let i = 0; i < count * 4; i++) {
      const pct = 0.2 + rand() * 0.3
      const sign = i % 2 === 0 ? 1 : -1
      const candidate = base + sign * base * pct
      if (candidate <= 0) continue
      const formatted = candidate.toFixed(places)
      if (parseFloat(formatted) !== base) results.push(formatted)
    }
    return results
  }

  // --- Small counts (1–12): step by small integers ---
  if (base >= 1 && base <= 12) {
    const pool: number[] = []
    for (let delta = 1; delta <= Math.max(10, Math.ceil(base * 2)); delta++) {
      pool.push(base + delta)
      if (base - delta > 0) pool.push(base - delta)
    }
    // Shuffle deterministically
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, count).map(v => String(v))
  }

  // --- Years (1000–2026): ±5-50 years depending on era ---
  const currentYear = 2026
  if (base >= 1000 && base <= currentYear && origStr.length === 4 && !origStr.includes(',')) {
    const age = currentYear - base
    const maxDelta = age < 100 ? 30 : 60
    const minDelta = age < 100 ? 5 : 10
    const results: string[] = []
    for (let i = 0; i < count * 4; i++) {
      const delta = Math.round(minDelta + rand() * (maxDelta - minDelta))
      const sign = i % 2 === 0 ? 1 : -1
      const year = base + sign * delta
      if (year > 0 && year <= currentYear && year !== base) {
        results.push(String(Math.round(year)))
      }
    }
    return results
  }

  // --- Larger numbers: percentage-based spread with magnitude-scaled rounding ---
  let minPct: number, maxPct: number, roundTo: number
  if (base <= 100) {
    minPct = 0.1; maxPct = 0.4; roundTo = 1
  } else if (base <= 999) {
    minPct = 0.15; maxPct = 0.5; roundTo = 10
  } else if (base <= 9999) {
    minPct = 0.15; maxPct = 0.5; roundTo = 100
  } else {
    minPct = 0.15; maxPct = 0.5; roundTo = 1000
  }

  const results: string[] = []
  for (let i = 0; i < count * 4; i++) {
    const pct = minPct + rand() * (maxPct - minPct)
    const sign = i % 2 === 0 ? 1 : -1
    const raw = base + sign * base * pct
    const candidate = Math.round(raw / roundTo) * roundTo
    if (candidate > 0 && candidate !== base) {
      results.push(formatLike(candidate, origStr))
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates plausible wrong numerical answers for a knowledge fact whose
 * correctAnswer uses brace-marked number syntax, e.g. "{107} days".
 *
 * The distractors:
 * - Substitute the varied number back into the same template as the correct answer
 * - Preserve the formatting (commas, decimal places) of the original number
 * - Never equal the correct answer (after stripping braces)
 * - Are seeded from fact.id so the same fact always yields the same distractors
 *
 * Returns an empty array when the answer contains no brace-marked number.
 *
 * @param fact  - Knowledge fact whose correctAnswer contains a braced number.
 * @param count - Number of distractors to return (default: BALANCE.QUIZ_DISTRACTORS_SHOWN).
 * @returns Array of distractor strings (display-ready, no braces); may be shorter than count.
 */
export function getNumericalDistractors(
  fact: Fact,
  count: number = BALANCE.QUIZ_DISTRACTORS_SHOWN,
): string[] {
  const answer = fact.correctAnswer
  const match = answer.match(BRACE_NUMBER_RE)
  if (!match) return []

  const numStr = match[1]
  const base = parseNum(numStr)
  if (base === 0) return []

  const rand = makePrng(seedFromId(fact.id))

  // Build template: "{107} days" → "{{PLACEHOLDER}} days"
  const template = answer.replace(BRACE_NUMBER_RE, '{{PLACEHOLDER}}')

  // Generate candidate number strings
  const candidates = generateVariations(base, numStr, rand, count * 3)

  // Deduplicate, filter out correct answer, substitute into template
  const correctDisplay = displayAnswer(answer)
  const seen = new Set<string>([correctDisplay])
  const results: string[] = []

  for (const c of candidates) {
    if (results.length >= count) break
    const distractor = template.replace('{{PLACEHOLDER}}', c)
    if (!seen.has(distractor)) {
      seen.add(distractor)
      results.push(distractor)
    }
  }

  return results
}
