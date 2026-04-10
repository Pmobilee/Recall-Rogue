/**
 * Regression tests for definition_match template self-answer leak fix.
 *
 * Bug: The definition_match template uses questionFormat: '{explanation}'.
 * Wiktionary-sourced explanations follow the format "word — English meaning",
 * which means the correct answer appears verbatim in the rendered question stem.
 * At mastery=3+, the quiz displayed the explanation as the question and then asked
 * the player to pick the answer that was already written there — zero knowledge required.
 *
 * Fix: explanationLeaksAnswer() detects whether the explanation contains the
 * correct answer as a whole word (word-boundary, case-insensitive). The eligibility
 * filter in selectQuestionTemplate() skips any template whose questionFormat
 * contains {explanation} when the explanation leaks the answer.
 *
 * Affected decks (up to 23% hit rate at mastery=4):
 *   french_a1, french_a2, french_b1, french_b2,
 *   french_a1_grammar, french_a2_grammar, french_b1_grammar, french_b2_grammar,
 *   german_a1, german_a2, german_b1, german_b2,
 *   czech_a1, czech_a2, czech_b1, czech_b2,
 *   dutch_a1, dutch_a2, dutch_b1, dutch_b2 (vocabulary decks)
 *
 * Audit reference: docs/reports/quiz-audit-2026-04-10.md §Pattern 4 (BLOCKER).
 * Specific example: fr-cefr-2380 — explanation "pique-niquer — to picnic."
 * renders as question with correctAnswer "to picnic".
 */

import { describe, it, expect } from 'vitest';
import { selectQuestionTemplate, explanationLeaksAnswer } from './questionTemplateSelector';
import type { DeckFact, CuratedDeck, QuestionTemplate, AnswerTypePool } from '../data/curatedDeckTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFact(id: string, correctAnswer: string, explanation: string, overrides: Partial<DeckFact> = {}): DeckFact {
  return {
    id,
    correctAnswer,
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'english_meanings',
    difficulty: 3,
    funScore: 5,
    quizQuestion: `What does 'mot${id}' mean?`,
    explanation,
    visualDescription: '',
    sourceName: 'test',
    distractors: [],
    targetLanguageWord: `mot${id}`,
    language: 'fr',
    ...overrides,
  };
}

/** Minimal template list: definition_match + a forward fallback. */
const TEMPLATES_BOTH: QuestionTemplate[] = [
  {
    id: 'forward',
    answerPoolId: 'english_meanings',
    questionFormat: "What does '{targetLanguageWord}' mean?",
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
  {
    id: 'definition_match',
    answerPoolId: 'english_meanings',
    questionFormat: '{explanation}',
    availableFromMastery: 3,
    difficulty: 4,
    reverseCapable: false,
  },
];

/**
 * Template list with ONLY definition_match (no forward fallback).
 * Used to deterministically verify eligibility: if the template is eligible,
 * selectQuestionTemplate MUST choose it (only option). If ineligible,
 * the selector falls through to the _fallback id.
 */
const TEMPLATES_ONLY_DEFINITION: QuestionTemplate[] = [
  {
    id: 'definition_match',
    answerPoolId: 'english_meanings',
    questionFormat: '{explanation}',
    availableFromMastery: 3,
    difficulty: 4,
    reverseCapable: false,
  },
];

/** Build a minimal CuratedDeck containing the given facts using the given templates. */
function makeDeck(facts: DeckFact[], templates: QuestionTemplate[] = TEMPLATES_BOTH): CuratedDeck {
  const pool: AnswerTypePool = {
    id: 'english_meanings',
    label: 'English meanings',
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

// Fact A: explanation CONTAINS the correct answer — definition_match must be SKIPPED
const FACT_A = makeFact('A', 'school', 'school — a place for learning', { id: 'fact-A' });

// Fact B: explanation does NOT contain the correct answer — definition_match is ELIGIBLE
const FACT_B = makeFact('B', 'school', 'a building used for education', { id: 'fact-B' });

// Fact C: "schools" appears but not "school" standalone — word boundary means eligible
const FACT_C = makeFact('C', 'school', 'The word schools refers to educational institutions.', { id: 'fact-C' });
// Note: \bschool\b does NOT match "schools" because 's' follows — correct, this should be eligible

// Fact D: explanation contains the answer but in different case
const FACT_D = makeFact('D', 'Maison', 'maison — a French word meaning house.', { id: 'fact-D' });
// "maison" vs "Maison" — case-insensitive match means INELIGIBLE

// Fact E: empty explanation — should not crash, passes leak filter (no leak if empty)
const FACT_E = makeFact('E', 'river', '', { id: 'fact-E' });

// Fact F: multi-word answer present in explanation
const FACT_F = makeFact('F', 'to picnic', 'pique-niquer — to picnic.', { id: 'fact-F' });

// Fact G: multi-word answer NOT present in explanation
const FACT_G = makeFact('G', 'to picnic', 'going outdoors to enjoy a meal in nature', { id: 'fact-G' });

// ---------------------------------------------------------------------------
// Unit tests for explanationLeaksAnswer()
// ---------------------------------------------------------------------------

describe('explanationLeaksAnswer()', () => {
  it('returns true when explanation contains the answer verbatim', () => {
    expect(explanationLeaksAnswer(FACT_A)).toBe(true);
  });

  it('returns false when explanation does not contain the answer', () => {
    expect(explanationLeaksAnswer(FACT_B)).toBe(false);
  });

  it('returns false when the answer appears only as part of a larger word (word-boundary)', () => {
    // "schools" ≠ "school" — word-boundary check prevents false positive
    expect(explanationLeaksAnswer(FACT_C)).toBe(false);
  });

  it('returns true on case mismatch (case-insensitive matching)', () => {
    // "maison" in explanation matches "Maison" correctAnswer (case-insensitive)
    expect(explanationLeaksAnswer(FACT_D)).toBe(true);
  });

  it('returns false when explanation is empty', () => {
    expect(explanationLeaksAnswer(FACT_E)).toBe(false);
  });

  it('returns true for multi-word answer with trailing punctuation in explanation', () => {
    // "to picnic." — the trailing period is part of explanation prose, not the answer
    expect(explanationLeaksAnswer(FACT_F)).toBe(true);
  });

  it('returns false for multi-word answer not present in explanation', () => {
    expect(explanationLeaksAnswer(FACT_G)).toBe(false);
  });

  it('returns true for explanation with the answer and extra parenthetical context', () => {
    // Mirrors: "progresser — to progress (to show a progression)."
    const factParenthetical = makeFact('par', 'to progress', 'progresser — to progress (to show a progression).', { id: 'fact-par' });
    expect(explanationLeaksAnswer(factParenthetical)).toBe(true);
  });

  it('returns false when answer is empty string (guard against empty correctAnswer)', () => {
    const factEmpty = makeFact('empty', '', 'some explanation text', { id: 'fact-empty' });
    expect(explanationLeaksAnswer(factEmpty)).toBe(false);
  });

  it('returns true when answer is a single common word appearing in explanation', () => {
    // Mirrors "abbey" in "abbaye — abbey."
    const factAbbey = makeFact('abbey', 'abbey', 'abbaye — abbey.', { id: 'fact-abbey' });
    expect(explanationLeaksAnswer(factAbbey)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests for selectQuestionTemplate()
//
// Eligibility tests use TEMPLATES_ONLY_DEFINITION (single-template deck) for
// deterministic verification: if definition_match is eligible it MUST be
// chosen; if ineligible the selector falls to id '_fallback'.
// Ineligibility tests use TEMPLATES_BOTH and assert definition_match is NOT
// chosen (forward is the only remaining option).
// ---------------------------------------------------------------------------

describe('selectQuestionTemplate() — definition_match ineligibility', () => {
  const HIGH_MASTERY = 4; // definition_match is available at mastery=3+
  const LOW_MASTERY = 1;  // only 'forward' is available at mastery<3
  const SEED = 42;

  it('FACT A (explanation leaks): selects forward template, NOT definition_match', () => {
    const deck = makeDeck([FACT_A, FACT_B, FACT_C], TEMPLATES_BOTH);
    const result = selectQuestionTemplate(FACT_A, deck, HIGH_MASTERY, [], SEED);
    // definition_match is ineligible because FACT_A's explanation contains "school"
    expect(result.template.id).not.toBe('definition_match');
    expect(result.template.id).toBe('forward');
    // Rendered question must use forward format, not the leaking explanation
    expect(result.renderedQuestion).not.toContain('school — a place for learning');
  });

  it('FACT B (explanation safe): definition_match is ELIGIBLE — must be chosen when it is the only template', () => {
    // Use a deck with ONLY definition_match (no forward) → if eligible it MUST be selected.
    // This avoids probabilistic flakiness while still proving eligibility end-to-end.
    const deck = makeDeck([FACT_A, FACT_B, FACT_C], TEMPLATES_ONLY_DEFINITION);
    const result = selectQuestionTemplate(FACT_B, deck, HIGH_MASTERY, [], SEED);
    // FACT_B explanation is safe → template should be chosen
    expect(result.template.id).toBe('definition_match');
    // Rendered question IS the explanation
    expect(result.renderedQuestion).toBe(FACT_B.explanation);
    // Correct answer unchanged
    expect(result.correctAnswer).toBe('school');
  });

  it('FACT A (leaky) with only definition_match template falls back to _fallback', () => {
    // When the only template leaks the answer, selector must fall back gracefully.
    const deck = makeDeck([FACT_A, FACT_B, FACT_C], TEMPLATES_ONLY_DEFINITION);
    const result = selectQuestionTemplate(FACT_A, deck, HIGH_MASTERY, [], SEED);
    // definition_match is ineligible, no other templates → _fallback
    expect(result.template.id).toBe('_fallback');
    // Falls back to the fact's own quizQuestion
    expect(result.renderedQuestion).toBe(FACT_A.quizQuestion);
  });

  it('FACT A at low mastery: only forward is available (mastery filter still applies)', () => {
    const deck = makeDeck([FACT_A, FACT_B], TEMPLATES_BOTH);
    const result = selectQuestionTemplate(FACT_A, deck, LOW_MASTERY, [], SEED);
    // At mastery=1, definition_match (availableFromMastery=3) is filtered by Step 1
    expect(result.template.id).toBe('forward');
  });

  it('FACT E (empty explanation): does not crash, definition_match is eligible but renders as quizQuestion', () => {
    // Empty explanation passes the leak filter (no leak if empty).
    // renderTemplate then detects empty replacement and falls back to quizQuestion internally.
    const deck = makeDeck([FACT_E, FACT_B], TEMPLATES_ONLY_DEFINITION);
    expect(() => selectQuestionTemplate(FACT_E, deck, HIGH_MASTERY, [], SEED)).not.toThrow();
    const result = selectQuestionTemplate(FACT_E, deck, HIGH_MASTERY, [], SEED);
    // Template is selected (eligible) but rendered as quizQuestion due to empty explanation
    expect(result.template.id).toBe('definition_match');
    expect(result.renderedQuestion).toBe(FACT_E.quizQuestion);
    expect(result.correctAnswer).toBe('river');
  });

  it('FACT F (multi-word answer "to picnic" in explanation): ineligible, falls back to _fallback', () => {
    const deck = makeDeck([FACT_F, FACT_G], TEMPLATES_ONLY_DEFINITION);
    const result = selectQuestionTemplate(FACT_F, deck, HIGH_MASTERY, [], SEED);
    expect(result.template.id).toBe('_fallback');
    // Falls back to the fact's own quizQuestion
    expect(result.renderedQuestion).toBe(FACT_F.quizQuestion);
  });

  it('FACT G (multi-word answer "to picnic", safe explanation): definition_match ELIGIBLE', () => {
    // FACT_G explanation does not contain "to picnic" → template eligible
    const deck = makeDeck([FACT_F, FACT_G], TEMPLATES_ONLY_DEFINITION);
    const result = selectQuestionTemplate(FACT_G, deck, HIGH_MASTERY, [], SEED);
    expect(result.template.id).toBe('definition_match');
    expect(result.renderedQuestion).toBe(FACT_G.explanation);
  });

  it('FACT D (case mismatch "Maison"): explanation leaks → definition_match ineligible', () => {
    // "maison" in explanation matches correctAnswer "Maison" case-insensitively
    const deck = makeDeck([FACT_D, FACT_B], TEMPLATES_BOTH);
    const result = selectQuestionTemplate(FACT_D, deck, HIGH_MASTERY, [], SEED);
    expect(result.template.id).not.toBe('definition_match');
    expect(result.template.id).toBe('forward');
  });

  it('FACT C (word boundary): "schools" does not match "school" — definition_match ELIGIBLE', () => {
    // "schools" in explanation does NOT match correctAnswer "school" at \b boundary
    const deck = makeDeck([FACT_A, FACT_B, FACT_C], TEMPLATES_ONLY_DEFINITION);
    const result = selectQuestionTemplate(FACT_C, deck, HIGH_MASTERY, [], SEED);
    expect(result.template.id).toBe('definition_match');
    expect(result.renderedQuestion).toBe(FACT_C.explanation);
  });
});
