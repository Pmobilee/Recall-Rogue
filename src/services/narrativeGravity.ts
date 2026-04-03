/**
 * narrativeGravity.ts — Answer type classification and gravity scoring for the
 * Woven Narrative Architecture.
 *
 * Pure functions only — no imports from game code, no side effects.
 * Called at fact-echo time to determine whether and how an answer may appear
 * in dark RPG narrative prose.
 *
 * Design spec: docs/mechanics/narrative.md §Thread 2 "The Echo Chamber"
 */

import type { AnswerType, GravityLevel } from './narrativeTypes';

// ============================================================
// CONSTANTS
// ============================================================

/** Minimum echoText length to ever appear in prose (inclusive). Does NOT apply to foreign_word. */
const MIN_ECHO_LENGTH = 4;

/** Concept echoText minimum length for gravity above 'low'. */
const CONCEPT_MIN_GRAVITY_LENGTH = 8;

/** Year range considered historical (inclusive on both ends). */
const YEAR_MIN = 1000;
const YEAR_MAX = 2100;

/**
 * Boolean-like answers that are always low gravity.
 * Normalised to lowercase for comparison.
 */
const BOOLEAN_ANSWERS = new Set(['true', 'false', 'yes', 'no']);

/**
 * High-gravity domains for person-type answers.
 * Historical figures and mythological/philosophical persons read as
 * arcane presences in dark RPG prose.
 */
const HIGH_GRAVITY_PERSON_DOMAINS = new Set([
  'history',
  'history_ancient',
  'history_classical',
  'history_medieval',
  'history_modern',
  'mythology',
  'philosophy',
]);

/**
 * High-gravity domains for concept-type answers.
 * Abstract ideas feel weighty in scientific/philosophical framing.
 */
const HIGH_GRAVITY_CONCEPT_DOMAINS = new Set([
  'science',
  'science_biology',
  'science_physics',
  'science_computing',
  'science_chemistry',
  'philosophy',
  'psychology',
]);

/**
 * Question keywords indicating the answer is a place (geographic entity).
 * Used when the answer is a single capitalised word and place vs. person is ambiguous.
 */
const PLACE_QUESTION_KEYWORDS = [
  'where', 'city', 'capital', 'country', 'continent',
  'ocean', 'river', 'lake', 'mountain', 'island', 'nation',
  'located', 'region', 'province', 'state', 'territory',
];

/**
 * Question keywords indicating the answer is a person.
 * Used when the answer is a single capitalised word and person vs. place is ambiguous.
 */
const PERSON_QUESTION_KEYWORDS = [
  'who', 'invented', 'discovered', 'wrote', 'led', 'born',
  'painted', 'composed', 'founded', 'created', 'philosopher',
  'scientist', 'author', 'president', 'king', 'queen', 'emperor',
];

/**
 * Word-ending patterns that strongly indicate abstract concepts rather than
 * concrete objects or entities. Used for single all-lowercase words.
 *
 * Examples:
 * - democracy, aristocracy → -cracy
 * - photosynthesis → -sis
 * - capitalism, communism → -ism
 * - democracy → -cy
 * - gravity, relativity → -ity
 * - freedom, wisdom → -dom
 * - knowledge, courage → -age (less reliable, skipped)
 */
const CONCEPT_SUFFIXES = [
  'cracy', 'ism', 'ology', 'ysis', 'sis', 'tion', 'sion',
  'ity', 'acy', 'ness', 'ment', 'phy', 'dom', 'hood',
];

// ============================================================
// UNICODE DETECTION
// ============================================================

/**
 * Returns true if the string contains any characters outside the Latin script:
 * CJK (Chinese/Japanese/Korean), Cyrillic, Arabic, Hebrew, Devanagari,
 * Hangul, Katakana, Hiragana, or other non-Latin Unicode blocks.
 *
 * Used to identify vocab deck foreign-word answers that should always
 * be classified as 'foreign_word' regardless of other heuristics.
 *
 * NOTE: 5-digit Unicode codepoints (CJK Extension B, U+20000+) require the `u`
 * flag for `\u{…}` syntax. We cover the BMP CJK ranges instead, which include
 * virtually all everyday Chinese, Japanese, and Korean characters.
 */
export function hasNonLatinChars(s: string): boolean {
  // CJK Unified Ideographs (BMP primary block: U+4E00–U+9FFF)
  if (/[\u4E00-\u9FFF]/.test(s)) return true;
  // CJK Extension A (U+3400–U+4DBF)
  if (/[\u3400-\u4DBF]/.test(s)) return true;
  // Hiragana (U+3040–U+309F) and Katakana (U+30A0–U+30FF)
  if (/[\u3040-\u30FF]/.test(s)) return true;
  // Hangul syllables (U+AC00–U+D7AF) and Jamo (U+1100–U+11FF)
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(s)) return true;
  // Cyrillic (U+0400–U+04FF)
  if (/[\u0400-\u04FF]/.test(s)) return true;
  // Arabic (U+0600–U+06FF)
  if (/[\u0600-\u06FF]/.test(s)) return true;
  // Hebrew (U+0590–U+05FF)
  if (/[\u0590-\u05FF]/.test(s)) return true;
  // Devanagari — Hindi, Sanskrit (U+0900–U+097F)
  if (/[\u0900-\u097F]/.test(s)) return true;
  // Thai (U+0E00–U+0E7F)
  if (/[\u0E00-\u0E7F]/.test(s)) return true;
  // Greek (U+0370–U+03FF)
  if (/[\u0370-\u03FF]/.test(s)) return true;
  return false;
}

// ============================================================
// YEAR DETECTION
// ============================================================

/**
 * Returns true if the string represents a historical year in the range
 * 1000–2100, or a year with an era suffix (AD, BC, BCE, CE).
 *
 * Recognises patterns: "1945", "476 AD", "776 BCE", "44 BC", "100 CE".
 */
export function isHistoricalYear(s: string): boolean {
  const trimmed = s.trim();

  // Bare 4-digit year: 1000–2100
  if (/^\d{4}$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return n >= YEAR_MIN && n <= YEAR_MAX;
  }

  // Year with era suffix: digits followed by AD/BC/BCE/CE
  // Accepts any 1–4-digit number before the suffix — covers antiquity (e.g. 776 BCE)
  const eraMatch = /^(\d{1,4})\s*(AD|BC|BCE|CE)$/i.exec(trimmed);
  if (eraMatch) {
    const n = parseInt(eraMatch[1], 10);
    return n > 0 && n <= YEAR_MAX;
  }

  return false;
}

// ============================================================
// FOREIGN WORD EXTRACTION
// ============================================================

/**
 * Extracts the foreign word from a vocabulary quiz question.
 *
 * Recognises patterns such as:
 * - `What does "abandonar" mean?` → "abandonar"
 * - `What does "汚い" (きたない) mean?` → "汚い"
 * - `What does "食べる" (たべる) mean?` → "食べる"
 * - `What does "adiós" mean?` → "adiós"
 *
 * Returns null if the question does not match the expected pattern.
 */
export function extractForeignWord(quizQuestion: string): string | null {
  // Match: What does "WORD" mean?  (with optional furigana/reading in parens after)
  const match = /[Ww]hat does\s+"([^"]+)"\s*(?:\([^)]*\))?\s*mean\?/.exec(quizQuestion);
  if (match) {
    return match[1];
  }
  return null;
}

// ============================================================
// ECHO TEXT BUILDER
// ============================================================

/**
 * Determines the string to use in echo templates for a given fact.
 *
 * For vocabulary deck facts (identified by a non-undefined partOfSpeech):
 * - Attempts to extract the foreign word from quizQuestion
 * - Falls back to correctAnswer if extraction fails
 *
 * For knowledge deck facts:
 * - Returns correctAnswer directly
 *
 * The returned value is stored as FactEcho.echoText.
 */
export function buildEchoText(
  correctAnswer: string,
  quizQuestion: string,
  partOfSpeech?: string,
): string {
  if (partOfSpeech !== undefined) {
    const foreign = extractForeignWord(quizQuestion);
    return foreign ?? correctAnswer;
  }
  return correctAnswer;
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Returns true if the lowercase question string contains at least one keyword
 * from the provided list.
 */
function questionContainsAny(questionLower: string, keywords: string[]): boolean {
  return keywords.some(kw => questionLower.includes(kw));
}

/**
 * Returns true if the lowercase word ends with any of the abstract concept suffixes.
 * Used to distinguish abstract concepts (democracy, photosynthesis) from
 * concrete objects (mitochondria, TCP/IP) when both are single all-lowercase words.
 */
function hasConceptSuffix(word: string): boolean {
  return CONCEPT_SUFFIXES.some(suffix => word.endsWith(suffix));
}

// ============================================================
// ANSWER TYPE CLASSIFICATION
// ============================================================

/**
 * Classifies a quiz answer into one of seven narrative AnswerTypes.
 *
 * Classification priority (highest to lowest):
 * 1. partOfSpeech present → foreign_word (vocab deck)
 * 2. Non-Latin characters present → foreign_word
 * 3. Historical year pattern → date
 * 4. Boolean-like string (True/False/Yes/No) → number (low gravity)
 * 5. Mostly digits (>50% of non-whitespace chars) → number
 * 6. Capitalised, 1-3 words, no digits → person or place
 *    - "The X" prefix → place
 *    - 2-3 words → person
 *    - 1 word: question keyword heuristic → person or place
 * 7. Multi-word lowercase → concept
 * 8. Single all-lowercase word: abstract suffix → concept, else → object
 * 9. Fallback → object
 *
 * @param answer       - The correctAnswer field from the fact.
 * @param quizQuestion - The original quiz question (context for person/place disambiguation).
 * @param partOfSpeech - Set if this is a vocabulary deck fact.
 * @param _domain      - Knowledge domain (reserved for future use).
 */
export function classifyAnswerType(
  answer: string,
  quizQuestion: string,
  partOfSpeech?: string,
  _domain?: string,
): AnswerType {
  // 1. Vocab deck: always foreign_word
  if (partOfSpeech !== undefined) {
    return 'foreign_word';
  }

  const trimmed = answer.trim();

  // 2. Non-Latin characters → foreign_word
  if (hasNonLatinChars(trimmed)) {
    return 'foreign_word';
  }

  // 3. Historical year pattern → date
  if (isHistoricalYear(trimmed)) {
    return 'date';
  }

  // 4. Boolean-like strings (treated as number for gravity purposes)
  if (BOOLEAN_ANSWERS.has(trimmed.toLowerCase())) {
    return 'number';
  }

  // 5. Mostly digits (>50% of non-whitespace chars are digits) → number
  const nonWs = trimmed.replace(/\s/g, '');
  if (nonWs.length > 0) {
    const digitCount = (nonWs.match(/\d/g) ?? []).length;
    if (digitCount / nonWs.length > 0.5) {
      return 'number';
    }
  }

  const words = trimmed.split(/\s+/);
  const hasDigits = /\d/.test(trimmed);
  const allCapitalised = words.every(w => /^[A-Z]/.test(w));

  // 6. Capitalised word(s), 1-3 words, no digits, no special chars → person or place
  // Names only contain letters, spaces, hyphens, and apostrophes — not slashes, underscores, etc.
  const isNameLike = !/[^a-zA-Z\s\-']/.test(trimmed);
  if (!hasDigits && words.length >= 1 && words.length <= 3 && allCapitalised && isNameLike) {
    const lower = trimmed.toLowerCase();
    const questionLower = quizQuestion.toLowerCase();

    // "The X" prefix is always a place (e.g. "The Colosseum", "The Nile")
    if (lower.startsWith('the ')) {
      return 'place';
    }

    // 2-3 capitalised words → person (name pattern: first name + last name)
    if (words.length >= 2) {
      return 'person';
    }

    // Single capitalised word: use question keywords to disambiguate
    if (questionContainsAny(questionLower, PLACE_QUESTION_KEYWORDS)) {
      return 'place';
    }
    if (questionContainsAny(questionLower, PERSON_QUESTION_KEYWORDS)) {
      return 'person';
    }

    // No clear signal: default to person (single proper nouns are more often
    // person names than place names in typical trivia/history questions)
    return 'person';
  }

  // 7. Multi-word lowercase → concept (e.g. "natural selection", "supply chain")
  if (words.length > 1 && trimmed === trimmed.toLowerCase()) {
    return 'concept';
  }

  // 8. Single all-lowercase word: use abstract suffix heuristic
  if (words.length === 1 && trimmed === trimmed.toLowerCase()) {
    // Abstract concepts have characteristic endings (-ism, -ity, -tion, -sis, etc.)
    if (hasConceptSuffix(trimmed)) {
      return 'concept';
    }
    // Concrete entity, technical term, biological/chemical noun
    return 'object';
  }

  // 9. Fallback: mixed-case single word, technical terms with special chars
  return 'object';
}

// ============================================================
// GRAVITY SCORING
// ============================================================

/**
 * Scores the narrative gravity of an answer, controlling which echo templates
 * may reference it in dark RPG prose.
 *
 * Gravity levels:
 * - high:   always safe for dramatic templates (places, foreign words, historical figures)
 * - medium: neutral templates only (scientists, objects, concepts, historical years)
 * - low:    answer-free fallbacks only — never named in prose (numbers, short answers)
 *
 * Length override: answers shorter than MIN_ECHO_LENGTH characters are always low,
 * EXCEPT for foreign_word — foreign scripts are atmospheric even when short
 * (e.g. "ki" in Japanese, single CJK characters).
 *
 * @param answerType     - From classifyAnswerType().
 * @param domain         - Knowledge domain of the source deck.
 * @param echoTextLength - Length of the echoText string (not necessarily correctAnswer).
 */
export function scoreGravity(
  answerType: AnswerType,
  domain: string,
  echoTextLength: number,
): GravityLevel {
  // Foreign words skip the length override — exotic scripts are atmospheric even when brief
  if (answerType === 'foreign_word') {
    return 'high';
  }

  // Length override (all other types): too short to carry dramatic weight
  if (echoTextLength < MIN_ECHO_LENGTH) {
    return 'low';
  }

  switch (answerType) {
    case 'place':
      // All places carry geographic weight in dark RPG prose
      return 'high';

    case 'person':
      // Historical figures and mythological/philosophical persons are dramatic
      if (HIGH_GRAVITY_PERSON_DOMAINS.has(domain)) {
        return 'high';
      }
      // Scientists, pioneers, computing figures — medium
      return 'medium';

    case 'concept': {
      // Very short concepts (< CONCEPT_MIN_GRAVITY_LENGTH) are too thin to echo meaningfully
      // e.g. "War", "Art", "Water" — context_echo handles these at medium gravity
      if (echoTextLength < CONCEPT_MIN_GRAVITY_LENGTH) {
        return 'low';
      }
      // Abstract ideas feel weighty in science/philosophy framing
      if (HIGH_GRAVITY_CONCEPT_DOMAINS.has(domain)) {
        return 'high';
      }
      return 'medium';
    }

    case 'date':
      // Historical years are medium — they contextualise but rarely stand alone dramatically
      return 'medium';

    case 'number':
      // Pure numbers (including boolean answers) are always low gravity
      return 'low';

    case 'object':
      // Concrete nouns, technical terms — medium by default
      return 'medium';

    default: {
      // Exhaustive narrowing guard
      const _exhaustive: never = answerType;
      return 'low';
    }
  }
}
