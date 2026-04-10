/**
 * Regression tests for reading template self-answer fix.
 *
 * Bug: Reading templates (id matching /^reading(_|$)/) were applied to facts
 * where the target word is already in phonetic form — i.e. fact.reading equals
 * fact.targetLanguageWord. This produces self-answering questions:
 *   "What is the reading of 'スーパー'?" → correct answer: "スーパー"
 * The question literally contains its own answer.
 *
 * Confirmed cases in JLPT decks (2026-04-10 quiz audit, Pattern #5/#12):
 *   japanese_n5: レコード (targetLanguageWord === reading)
 *   japanese_n4: スーパー (targetLanguageWord === reading)
 *   japanese_n1: しかしながら, はらはら, アプローチ
 *
 * Fix: readingMatchesTargetWord(fact) detects phonetic-form facts.
 * The eligibility filter in selectQuestionTemplate() step 4 rejects any
 * reading template (id matching /^reading(_|$)/) when this returns true.
 *
 * Affected decks: japanese_n1, japanese_n4, japanese_n5 (any vocabulary deck
 * with katakana loanwords or hiragana-only entries where reading === targetLanguageWord)
 *
 * Audit reference: docs/reports/quiz-audit-2026-04-10.md §Pattern 5 & Pattern 12 (BLOCKER).
 * Fix commit: fix(quiz): reading templates ineligible when word already in phonetic form
 */

import { describe, it, expect } from 'vitest';
import { selectQuestionTemplate, readingMatchesTargetWord } from './questionTemplateSelector';
import type { DeckFact, CuratedDeck, QuestionTemplate, AnswerTypePool } from '../data/curatedDeckTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVocabFact(
  id: string,
  targetLanguageWord: string,
  reading: string | undefined,
  overrides: Partial<DeckFact> = {},
): DeckFact {
  return {
    id,
    correctAnswer: 'some English meaning',
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'readings',
    difficulty: 2,
    funScore: 5,
    quizQuestion: `What is the reading of '${targetLanguageWord}'?`,
    explanation: `${targetLanguageWord} — some explanation`,
    visualDescription: '',
    sourceName: 'test',
    distractors: [],
    targetLanguageWord,
    reading,
    language: 'ja',
    ...overrides,
  };
}

/** Minimal template list: reading + a forward fallback. */
const TEMPLATES_BOTH: QuestionTemplate[] = [
  {
    id: 'forward',
    answerPoolId: 'readings',
    questionFormat: "What does '{targetLanguageWord}' mean?",
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
  {
    id: 'reading',
    answerPoolId: 'readings',
    questionFormat: "What is the reading of '{targetLanguageWord}'?",
    availableFromMastery: 0,
    difficulty: 2,
    reverseCapable: false,
  },
];

/**
 * Template list with ONLY the reading template (no forward fallback).
 * Used to deterministically verify ineligibility: if the reading template
 * is blocked, the selector must fall through to id '_fallback'.
 */
const TEMPLATES_ONLY_READING: QuestionTemplate[] = [
  {
    id: 'reading',
    answerPoolId: 'readings',
    questionFormat: "What is the reading of '{targetLanguageWord}'?",
    availableFromMastery: 0,
    difficulty: 2,
    reverseCapable: false,
  },
];

/**
 * Template list with ONLY reading_hiragana — tests that the /^reading(_|$)/
 * pattern catches variant template IDs as well.
 */
const TEMPLATES_ONLY_READING_HIRAGANA: QuestionTemplate[] = [
  {
    id: 'reading_hiragana',
    answerPoolId: 'readings',
    questionFormat: "What is the hiragana reading of '{targetLanguageWord}'?",
    availableFromMastery: 0,
    difficulty: 2,
    reverseCapable: false,
  },
];

/** Build a minimal CuratedDeck containing the given facts. */
function makeDeck(facts: DeckFact[], templates: QuestionTemplate[] = TEMPLATES_BOTH): CuratedDeck {
  const pool: AnswerTypePool = {
    id: 'readings',
    label: 'Readings',
    answerFormat: 'word',
    factIds: facts.map(f => f.id),
    syntheticDistractors: [],
    minimumSize: 5,
  };

  return {
    id: 'test_deck',
    name: 'Test Deck',
    domain: 'vocabulary',
    description: 'Test',
    minimumFacts: 1,
    targetFacts: facts.length,
    facts,
    answerTypePools: [pool],
    synonymGroups: [],
    questionTemplates: templates,
    difficultyTiers: [],
  };
}

// ---------------------------------------------------------------------------
// Test facts
// ---------------------------------------------------------------------------

// Fact A: targetLanguageWord === reading (katakana loanword) → reading template BLOCKED
// Mirrors: japanese_n5 レコード, japanese_n4 スーパー
const FACT_A = makeVocabFact('fact-A', 'スーパー', 'スーパー');

// Fact B: targetLanguageWord !== reading (kanji word) → reading template ELIGIBLE
// Mirrors: japanese_n5 記録 (reading: きろく)
const FACT_B = makeVocabFact('fact-B', '記録', 'きろく');

// Fact C: reading is undefined → reading template ELIGIBLE (no info to block on)
// Facts with no reading field should never be blocked by this rule.
const FACT_C = makeVocabFact('fact-C', '記録', undefined);

// Fact D: whitespace difference between reading and targetLanguageWord → still blocked
// Tests that normalize() strips surrounding whitespace before comparing.
const FACT_D = makeVocabFact('fact-D', 'スーパー', ' スーパー ');

// Fact E: hiragana-only word where targetLanguageWord === reading
// Mirrors: japanese_n1 しかしながら, はらはら
const FACT_E = makeVocabFact('fact-E', 'しかしながら', 'しかしながら');

// ---------------------------------------------------------------------------
// Unit tests for readingMatchesTargetWord()
// ---------------------------------------------------------------------------

describe('readingMatchesTargetWord()', () => {
  it('returns true when reading === targetLanguageWord (katakana loanword)', () => {
    expect(readingMatchesTargetWord(FACT_A)).toBe(true);
  });

  it('returns false when reading differs from targetLanguageWord (kanji word)', () => {
    expect(readingMatchesTargetWord(FACT_B)).toBe(false);
  });

  it('returns false when reading is undefined', () => {
    expect(readingMatchesTargetWord(FACT_C)).toBe(false);
  });

  it('returns true when whitespace differs but content is equal after normalize()', () => {
    expect(readingMatchesTargetWord(FACT_D)).toBe(true);
  });

  it('returns true for hiragana-only word where reading equals targetLanguageWord', () => {
    expect(readingMatchesTargetWord(FACT_E)).toBe(true);
  });

  it('returns false when targetLanguageWord is undefined', () => {
    const factNoTarget = makeVocabFact('no-target', 'スーパー', 'スーパー', { targetLanguageWord: undefined });
    expect(readingMatchesTargetWord(factNoTarget)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration tests for selectQuestionTemplate()
//
// Eligibility tests use single-template decks for deterministic verification:
//   - If the reading template is BLOCKED → selector returns id '_fallback'
//   - If the reading template is ELIGIBLE → selector returns id 'reading'
// Multi-template tests verify the fallback picks 'forward', not 'reading'.
// ---------------------------------------------------------------------------

describe('selectQuestionTemplate() — reading template ineligibility', () => {
  const SEED = 42;
  const MASTERY = 2;

  it('FACT A (スーパー = スーパー): reading template BLOCKED — falls back to _fallback when only option', () => {
    const deck = makeDeck([FACT_A, FACT_B], TEMPLATES_ONLY_READING);
    const result = selectQuestionTemplate(FACT_A, deck, MASTERY, [], SEED);
    expect(result.template.id).toBe('_fallback');
    // Falls back to the fact's own quizQuestion (not the reading template format)
    expect(result.renderedQuestion).toBe(FACT_A.quizQuestion);
  });

  it('FACT A (スーパー = スーパー): reading template BLOCKED — picks forward when available', () => {
    const deck = makeDeck([FACT_A, FACT_B], TEMPLATES_BOTH);
    const result = selectQuestionTemplate(FACT_A, deck, MASTERY, [], SEED);
    expect(result.template.id).not.toBe('reading');
    expect(result.template.id).toBe('forward');
  });

  it('FACT B (記録, reading: きろく): reading template ELIGIBLE — selected when only option', () => {
    const deck = makeDeck([FACT_A, FACT_B], TEMPLATES_ONLY_READING);
    const result = selectQuestionTemplate(FACT_B, deck, MASTERY, [], SEED);
    // reading template is eligible — it must be chosen (only option)
    expect(result.template.id).toBe('reading');
  });

  it('FACT C (記録, reading: undefined): reading template ELIGIBLE — not blocked by missing field', () => {
    const deck = makeDeck([FACT_A, FACT_B, FACT_C], TEMPLATES_ONLY_READING);
    const result = selectQuestionTemplate(FACT_C, deck, MASTERY, [], SEED);
    // No reading field → readingMatchesTargetWord() returns false → not blocked
    // But renderTemplate will fall back to quizQuestion since {reading} resolves to ''
    expect(result.template.id).toBe('reading');
  });

  it('FACT D (whitespace variant): reading template BLOCKED (normalize strips whitespace)', () => {
    const deck = makeDeck([FACT_A, FACT_B, FACT_D], TEMPLATES_ONLY_READING);
    const result = selectQuestionTemplate(FACT_D, deck, MASTERY, [], SEED);
    expect(result.template.id).toBe('_fallback');
  });

  it('FACT E (しかしながら hiragana): reading template BLOCKED — hiragana-only phonetic form', () => {
    const deck = makeDeck([FACT_A, FACT_E], TEMPLATES_ONLY_READING);
    const result = selectQuestionTemplate(FACT_E, deck, MASTERY, [], SEED);
    expect(result.template.id).toBe('_fallback');
  });

  it('reading_hiragana variant template is also blocked for phonetic-form facts', () => {
    // Tests that the /^reading(_|$)/ pattern covers reading_hiragana
    const deck = makeDeck([FACT_A, FACT_B], TEMPLATES_ONLY_READING_HIRAGANA);
    const result = selectQuestionTemplate(FACT_A, deck, MASTERY, [], SEED);
    expect(result.template.id).toBe('_fallback');
  });

  it('reading_hiragana is ELIGIBLE for kanji facts (reading differs from targetLanguageWord)', () => {
    const deck = makeDeck([FACT_A, FACT_B], TEMPLATES_ONLY_READING_HIRAGANA);
    const result = selectQuestionTemplate(FACT_B, deck, MASTERY, [], SEED);
    expect(result.template.id).toBe('reading_hiragana');
  });

  it('correct answer is unchanged when falling back (phonetic-form fact, _fallback)', () => {
    const deck = makeDeck([FACT_A], TEMPLATES_ONLY_READING);
    const result = selectQuestionTemplate(FACT_A, deck, MASTERY, [], SEED);
    // _fallback always uses fact.correctAnswer, never fact.reading
    expect(result.correctAnswer).toBe(FACT_A.correctAnswer);
    expect(result.distractorAnswerField).toBe('correctAnswer');
  });
});
