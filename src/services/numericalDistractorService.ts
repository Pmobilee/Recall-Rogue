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
const PLAIN_NUMBER_RE = /^(\d[\d,]*\.?\d*)$/

/**
 * Returns true when the answer contains a brace-marked numerical variable,
 * e.g. "{107} days", "At least {93}%", "{21,196} km".
 *
 * @param answer - The fact's correctAnswer string.
 */
export function isNumericalAnswer(answer: string): boolean {
  return BRACE_NUMBER_RE.test(answer) || PLAIN_NUMBER_RE.test(answer.trim())
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
// Answer domain detection
// ---------------------------------------------------------------------------

/** The semantic domain of a numerical answer, plus optional hard clamps. */
export interface AnswerDomain {
  kind: 'percentage' | 'year' | 'count' | 'measurement' | 'unknown'
  clamp: { min: number; max: number } | null
}

/**
 * Detects the semantic domain of a numerical answer by examining:
 * 1. The answer string itself (suffix hints: %, " years", " km", etc.)
 * 2. The surrounding question text (keyword hints: "percent", "year", "how many", etc.)
 *
 * Returns a domain descriptor with an optional hard clamp. The clamp is applied
 * to every generated variant as a safety net so distractors never exceed the
 * physically possible range for the domain.
 *
 * Three-layer defence:
 *   (a) answer-format hints  — most precise, always checked first
 *   (b) question-text hints  — catches bare-number answers like "{99.86}" where
 *                              the percentage is expressed only in the question
 *   (c) hard clamps          — post-generation safety net applied even when
 *                              layer (a)/(b) produce a clamp of their own
 *
 * @param answerStr    - The full correctAnswer string (may contain braces).
 * @param questionText - Optional rendered question stem or quizQuestion field.
 */
export function detectAnswerDomain(
  answerStr: string,
  questionText: string = '',
): AnswerDomain {
  const lowerAnswer = answerStr.toLowerCase()
  const lowerQuestion = questionText.toLowerCase()
  const combined = lowerAnswer + ' ' + lowerQuestion

  // --- 1. Percentage: answer contains "%" or question contains percentage keywords ---
  const hasPctSuffix = lowerAnswer.includes('%')
  const hasPctKeyword =
    /\bpercent(age)?\b/.test(lowerQuestion) ||
    lowerQuestion.includes('%') ||
    /\bfraction of\b/.test(lowerQuestion) ||
    /\bproportion of\b/.test(lowerQuestion) ||
    /\bshare of\b/.test(lowerQuestion)
  if (hasPctSuffix || hasPctKeyword) {
    return { kind: 'percentage', clamp: { min: 0, max: 100 } }
  }

  // --- 2. Year: answer is a 4-digit number or question uses year/century keywords ---
  const hasYearKeyword =
    /\b(in what year|which year|what year)\b/.test(lowerQuestion) ||
    /\bwhen (was|did|were|is)\b/.test(lowerQuestion) ||
    /\byear\b/.test(combined) ||
    /\bcentury\b/.test(combined) ||
    /\bdecade\b/.test(combined)
  // Answer-format year hint: exactly 4 digits, no decimals, no commas, value in plausible year range
  const numStr = (answerStr.match(BRACE_NUMBER_RE) ?? [])[1] ?? ''
  const numVal = parseNum(numStr)
  const isYearShaped = numStr.length === 4 && !numStr.includes(',') && numVal >= 1000 && numVal <= 2100
  if (hasYearKeyword || isYearShaped) {
    return { kind: 'year', clamp: { min: 1, max: 2100 } }
  }

  // --- 3. Count: question asks "how many" or uses counting keywords ---
  const hasCountKeyword =
    /\bhow many\b/.test(lowerQuestion) ||
    /\bnumber of\b/.test(lowerQuestion) ||
    /\bcount of\b/.test(lowerQuestion) ||
    /\btotal (of|number)\b/.test(lowerQuestion)
  if (hasCountKeyword) {
    // Non-negative integers only; no upper bound assumed
    return { kind: 'count', clamp: { min: 0, max: Infinity } }
  }

  // --- 4. Measurement: question or answer contains common unit keywords ---
  // Note: plural forms (kilometers, metres, etc.) are included via optional 's'.
  const hasMeasurementKeyword =
    /\b(kilometers?|kilometres?|km|meters?|metres?|miles?|light.?years?|parsecs?|astronomical units?)\b/.test(combined) ||
    /\b(kilograms?|grams?|kg|pounds?|tons?|tonnes?)\b/.test(combined) ||
    /\b(celsius|fahrenheit|kelvin|temperature)\b/.test(combined) ||
    /\b(watts?|joules?|newtons?|pascals?|volts?|amperes?)\b/.test(combined) ||
    /\b(seconds?|minutes?|hours?|days?|weeks?|months?)\b/.test(lowerAnswer) ||
    /\b(seconds?|minutes?|hours?|days?|weeks?|months?)\b/.test(lowerQuestion)
  if (hasMeasurementKeyword) {
    // Measurements must be positive; no upper bound assumed
    return { kind: 'measurement', clamp: { min: 0.001, max: Infinity } }
  }

  return { kind: 'unknown', clamp: null }
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
 * @param domain   - Detected answer domain (used for clamping).
 */
function generateVariations(
  base: number,
  origStr: string,
  rand: RandFn,
  count: number,
  domain: AnswerDomain,
): string[] {
  const places = decimalPlaces(origStr)
  const isDecimal = places > 0

  /**
   * Apply domain clamp to a candidate value. Returns null if the value would
   * equal the base after clamping (clamp collapsed it to the correct answer).
   */
  const applyClamp = (candidate: number): number | null => {
    if (!domain.clamp) return candidate
    const { min, max } = domain.clamp
    const clamped = Math.max(min, Math.min(max, candidate))
    // If clamped equals base (rounded to same precision), skip — not a useful distractor
    if (places > 0 && parseFloat(clamped.toFixed(places)) === base) return null
    if (places === 0 && Math.round(clamped) === Math.round(base)) return null
    return clamped
  }

  // --- Zero-valued facts: percentage spreads collapse to zero, so step upward.
  if (base === 0) {
    const pool = isDecimal
      ? [0.1, 0.2, 0.5, 1, 2, 5, 10, 25]
      : [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }

    const results: string[] = []
    for (const candidate of pool) {
      if (results.length >= count) break
      const clamped = applyClamp(candidate)
      if (clamped !== null && clamped !== base) {
        results.push(formatLike(clamped, origStr))
      }
    }
    return results
  }

  // --- Decimal numbers: match precision, ±20-50% ---
  if (isDecimal) {
    const results: string[] = []
    for (let i = 0; i < count * 4; i++) {
      const pct = 0.2 + rand() * 0.3
      const sign = i % 2 === 0 ? 1 : -1
      const raw = base + sign * base * pct
      if (raw <= 0) continue
      const clamped = applyClamp(raw)
      if (clamped === null) continue
      const formatted = clamped.toFixed(places)
      if (parseFloat(formatted) !== base) results.push(formatted)
    }
    return results
  }

  // --- Small counts (1–12): step by small integers ---
  if (base >= 1 && base <= 12) {
    const pool: number[] = []
    for (let delta = 1; delta <= Math.max(10, Math.ceil(base * 2)); delta++) {
      const up = base + delta
      const down = base - delta
      const cu = applyClamp(up)
      if (cu !== null && cu > 0) pool.push(cu)
      if (down > 0) {
        const cd = applyClamp(down)
        if (cd !== null && cd > 0) pool.push(cd)
      }
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
      const clamped = applyClamp(year)
      if (clamped !== null && clamped > 0 && clamped <= currentYear && clamped !== base) {
        results.push(String(Math.round(clamped)))
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
    const clamped = applyClamp(candidate)
    if (clamped !== null && clamped > 0 && clamped !== base) {
      results.push(formatLike(clamped, origStr))
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
 * - Are clamped to a sensible domain (percentage ≤ 100, year ≤ 2100, etc.)
 *
 * Domain detection uses three complementary layers:
 *   1. answer-format hints — "%" suffix, 4-digit year shape, unit words in answer
 *   2. question-text hints — "percent/percentage/how many/year/km" in questionText
 *   3. hard clamps         — post-generation safety net applied to every variant
 *
 * Returns an empty array when the answer contains no brace-marked number.
 *
 * @param fact         - Knowledge fact whose correctAnswer contains a braced number.
 * @param count        - Number of distractors to return (default: BALANCE.QUIZ_DISTRACTORS_SHOWN).
 * @param questionText - Optional rendered question stem used for domain detection.
 *                       Falls back to fact.quizQuestion if the fact has that field.
 * @returns Array of distractor strings (display-ready, no braces); may be shorter than count.
 */
export function getNumericalDistractors(
  fact: Fact,
  count: number = BALANCE.QUIZ_DISTRACTORS_SHOWN,
  questionText?: string,
): string[] {
  const answer = fact.correctAnswer
  const braceMatch = answer.match(BRACE_NUMBER_RE)
  const plainMatch = answer.trim().match(PLAIN_NUMBER_RE)
  const match = braceMatch ?? plainMatch
  if (!match) return []

  const numStr = match[1]
  const base = parseNum(numStr)

  // Resolve question text for domain detection.
  // Prefer explicitly passed questionText; fall back to fact.quizQuestion if present
  // (DeckFact has quizQuestion but the base Fact type may not — safe optional access).
  const resolvedQuestion =
    questionText ??
    ((fact as unknown as Record<string, unknown>)['quizQuestion'] as string | undefined) ??
    ''

  const domain = detectAnswerDomain(answer, resolvedQuestion)

  const rand = makePrng(seedFromId(fact.id))

  // Build template: "{107} days" → "{{PLACEHOLDER}} days"; "0" → "{{PLACEHOLDER}}"
  const template = braceMatch
    ? answer.replace(BRACE_NUMBER_RE, '{{PLACEHOLDER}}')
    : answer.trim().replace(PLAIN_NUMBER_RE, '{{PLACEHOLDER}}')

  // Generate candidate number strings with domain clamping applied
  const candidates = generateVariations(base, numStr, rand, count * 3, domain)

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
