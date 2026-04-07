/**
 * typedAnswerChecker.ts
 *
 * Pure-function service for checking typed quiz answers with robust normalization.
 * Used by tier-3 (typing-mode) card quiz grading as a lenient alternative to
 * the exact-string `gradeAnswer` in quizService.ts.
 *
 * Key normalizations applied:
 *  - Trim + lowercase
 *  - Unicode NFD accent folding (café → cafe)
 *  - Strip trailing punctuation (yes. → yes)
 *  - Collapse multiple internal spaces
 *
 * Key structural decompositions:
 *  - Slash alternatives: "grey / gray" → ["grey", "gray"]
 *  - Comma synonyms: "lawyer, solicitor" → ["lawyer", "solicitor"]
 *  - Full unsplit string always kept as a candidate (handles "bacon, lettuce, and tomato")
 *  - Parenthetical suffix removal: "sandwich (bread roll)" → "sandwich"
 *  - Leading "to " infinitive handling for verb answers
 */

import { getSynonyms } from './synonymService'
import { levenshtein } from './ankiDistractorGenerator'

export interface TypedAnswerResult {
  correct: boolean
  closeMatch: boolean
  synonymMatch: boolean
}

/**
 * Normalizes an answer string for lenient comparison.
 * Applies: trim, lowercase, NFD accent-fold, strip trailing punctuation,
 * collapse internal whitespace.
 *
 * @param str - Raw answer string from player or deck data.
 * @returns Normalized string suitable for equality comparison.
 */
export function normalizeAnswer(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[.!?;:]+$/, '')         // strip trailing punctuation
    .replace(/\s+/g, ' ')             // collapse multiple spaces
    .trim()                           // re-trim after space collapse
}

/**
 * Generates all candidate normalized strings from a single answer string.
 *
 * Decompositions performed (in order):
 * 1. Split on " / " to get slash alternatives.
 * 2. For each slash segment, split on ", " to get comma synonyms.
 * 3. For every leaf segment, also generate:
 *    - Parenthetical-stripped variant (trailing "(…)" removed)
 *    - "to "-stripped variant (leading "to " removed for verb infinitives)
 * 4. The full, un-split original string is always included as a candidate
 *    (handles cases like "bacon, lettuce, and tomato" where commas are part of the answer).
 *
 * All candidates are normalized before being returned. Duplicates are removed.
 *
 * @param answer - A raw answer string from deck data (correctAnswer or alternative).
 * @returns Flat array of unique normalized candidate strings.
 */
export function extractCandidates(answer: string): string[] {
  const candidates = new Set<string>()

  // Always include the full string as a candidate (covers comma-joined compound answers)
  candidates.add(normalizeAnswer(answer))

  // Split on slash alternatives
  const slashSegments = answer.split(' / ')
  for (const slashSegment of slashSegments) {
    // Split each slash segment on comma synonyms
    const commaSegments = slashSegment.split(', ')
    for (const segment of commaSegments) {
      const base = normalizeAnswer(segment)
      if (base) candidates.add(base)

      // Parenthetical-stripped variant: "sandwich (bread roll)" → "sandwich"
      const withoutParens = normalizeAnswer(segment.replace(/\s*\([^)]*\)\s*$/, '').trim())
      if (withoutParens) candidates.add(withoutParens)

      // "to "-stripped variant: "to abandon" → "abandon"
      if (base.startsWith('to ')) {
        const withoutTo = base.slice(3).trim()
        if (withoutTo) candidates.add(withoutTo)
      }
    }

    // Also process the full slash segment (before comma split) for parenthetical/to stripping
    const slashBase = normalizeAnswer(slashSegment)
    if (slashBase) candidates.add(slashBase)

    const slashWithoutParens = normalizeAnswer(slashSegment.replace(/\s*\([^)]*\)\s*$/, '').trim())
    if (slashWithoutParens) candidates.add(slashWithoutParens)

    if (slashBase.startsWith('to ')) {
      const withoutTo = slashBase.slice(3).trim()
      if (withoutTo) candidates.add(withoutTo)
    }
  }

  return Array.from(candidates).filter((c) => c.length > 0)
}

/**
 * Checks whether a player's typed answer matches a correct answer or any acceptable
 * alternative, using lenient normalization, synonym lookup, and typo tolerance.
 *
 * Matching phases:
 * 1. Direct candidate match (normalization, slash/comma decomposition, parentheticals, "to " prefix).
 * 2. Synonym matching via WordNet synonyms (single-word typed answers only).
 * 3. Close match detection — Levenshtein distance ≤ 2 and ≤ 30% of candidate length.
 *
 * @param typed - The raw string the player typed.
 * @param correctAnswer - The canonical correct answer from the deck fact.
 * @param acceptableAlternatives - Additional acceptable answer strings (e.g. transliteration variants).
 * @param _language - BCP-47 language code (e.g. "ja", "zh"). Reserved for future locale rules.
 * @returns TypedAnswerResult with correct, closeMatch, and synonymMatch flags.
 */
export function checkTypedAnswer(
  typed: string,
  correctAnswer: string,
  acceptableAlternatives: string[],
  _language: string,
): TypedAnswerResult {
  const normalizedTyped = normalizeAnswer(typed)

  // Reject empty input
  if (normalizedTyped.length === 0) return { correct: false, closeMatch: false, synonymMatch: false }

  // Build the full set of answer sources to check against
  const answerSources = [correctAnswer, ...acceptableAlternatives]

  // Phase 1: Direct candidate matching
  for (const source of answerSources) {
    const candidates = extractCandidates(source)

    // Direct candidate match
    if (candidates.includes(normalizedTyped)) return { correct: true, closeMatch: false, synonymMatch: false }

    // If player typed "to X" but no candidate matched yet, try without "to " prefix
    // (covers: player typed "to eat", correct answer is "eat" — candidate "eat" doesn't
    // match "to eat", so we also try stripping the typed "to ")
    if (normalizedTyped.startsWith('to ')) {
      const typedWithoutTo = normalizedTyped.slice(3).trim()
      if (typedWithoutTo && candidates.includes(typedWithoutTo)) return { correct: true, closeMatch: false, synonymMatch: false }
    }

    // If player typed without "to " prefix, also try matching typed + "to " added
    // This is already handled by candidate extraction (candidates include "to "-stripped
    // versions), but the reverse (player omits "to ", answer has no "to " form) is covered
    // by that same path. This branch handles: player typed bare verb, candidates only have
    // "to X" form and the "to "-stripped candidate wasn't added because the candidate
    // doesn't start with "to ". In practice this means we should also add a "to {typed}"
    // candidate check.
    const typedWithTo = 'to ' + normalizedTyped
    if (candidates.includes(typedWithTo)) return { correct: true, closeMatch: false, synonymMatch: false }
  }

  // Phase 2: Synonym matching (single-word answers only)
  if (!normalizedTyped.includes(' ')) {
    const allCandidates = answerSources.flatMap(s => extractCandidates(s))
    const singleWordCandidates = allCandidates.filter(c => !c.includes(' '))

    for (const candidate of singleWordCandidates) {
      // Forward: typed is a synonym of the candidate
      const candidateSyns = getSynonyms(candidate).map(s => s.toLowerCase())
      if (candidateSyns.includes(normalizedTyped)) {
        return { correct: true, closeMatch: false, synonymMatch: true }
      }
      // Reverse: candidate is a synonym of typed
      const typedSyns = getSynonyms(normalizedTyped).map(s => s.toLowerCase())
      if (typedSyns.includes(candidate)) {
        return { correct: true, closeMatch: false, synonymMatch: true }
      }
    }
  }

  // Phase 3: Close match detection (typo tolerance)
  const allCandidates = answerSources.flatMap(s => extractCandidates(s))
  for (const candidate of allCandidates) {
    const dist = levenshtein(normalizedTyped, candidate)
    if (dist > 0 && dist <= 2 && dist <= Math.ceil(candidate.length * 0.3)) {
      return { correct: false, closeMatch: true, synonymMatch: false }
    }
  }

  return { correct: false, closeMatch: false, synonymMatch: false }
}
