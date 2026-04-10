/**
 * Regression tests for reverse-template pool contamination fix.
 *
 * Bug: when a vocab deck uses a reverse template ("How do you say X in [lang]?"),
 * selectDistractors was drawing distractors from fact.correctAnswer (English meanings)
 * instead of fact.targetLanguageWord (target-language strings). The correct answer
 * was the only target-language option — identifiable by script alone, zero knowledge required.
 *
 * Fix: selectDistractors now accepts distractorAnswerField: keyof DeckFact (default 'correctAnswer').
 * Passing 'targetLanguageWord' makes the selector use that field for distractor display and
 * deduplication. The returned DeckFact objects have correctAnswer overwritten to the resolved
 * display value so callers continue to use d.correctAnswer uniformly.
 *
 * Audit reference: docs/reports/quiz-audit-2026-04-10.md §Pattern 3 (BLOCKER, ~20 decks).
 * Specific example: korean_topik2 fact ko-nikl-4669 — 49/49 reverse rows contaminated.
 */

import { describe, it, expect } from 'vitest';
import { selectDistractors } from './curatedDistractorSelector';
import type { DeckFact, AnswerTypePool, SynonymGroup } from '../data/curatedDeckTypes';
import { ConfusionMatrix } from './confusionMatrix';

// ---------------------------------------------------------------------------
// In-memory Korean vocab deck fixture
// Mirrors korean_topik2 structure: correctAnswer = English meaning,
// targetLanguageWord = Korean word, two pools sharing the same factIds.
// ---------------------------------------------------------------------------

function makeKoreanFact(
  id: string,
  english: string,
  korean: string,
  overrides: Partial<DeckFact> = {},
): DeckFact {
  return {
    id,
    correctAnswer: english,                // English meaning (forward template answer)
    targetLanguageWord: korean,            // Korean word (reverse template answer)
    language: 'ko',
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'english_meanings',  // Fact's native pool (forward)
    difficulty: 3,
    funScore: 5,
    quizQuestion: `What does '${korean}' mean?`,
    explanation: `${korean} means ${english} in Korean.`,
    visualDescription: '',
    sourceName: 'test',
    distractors: ['fallback1', 'fallback2', 'fallback3'],
    ...overrides,
  };
}

// Six Korean vocab facts — mirrors the shape of real TOPIK/JLPT deck facts.
const KOREAN_FACTS: DeckFact[] = [
  makeKoreanFact('ko-t-001', 'even number',         '짝수'),
  makeKoreanFact('ko-t-002', 'schedule',             '일정'),
  makeKoreanFact('ko-t-003', 'headache medicine',    '두통약'),
  makeKoreanFact('ko-t-004', 'developed country',    '선진국'),
  makeKoreanFact('ko-t-005', 'quarrel',              '말다툼'),
  makeKoreanFact('ko-t-006', 'all one\'s life',      '평생'),
];

const ALL_FACT_IDS = KOREAN_FACTS.map(f => f.id);

/** Forward pool: distractors are English meanings (correctAnswer field). */
const ENGLISH_MEANINGS_POOL: AnswerTypePool = {
  id: 'english_meanings',
  label: 'English Meanings',
  answerFormat: 'word',
  minimumSize: 5,
  factIds: ALL_FACT_IDS,
};

/** Reverse pool: same factIds, but we want distractors from targetLanguageWord field. */
const TARGET_LANGUAGE_WORDS_POOL: AnswerTypePool = {
  id: 'target_language_words',
  label: 'Korean Words',
  answerFormat: 'word',
  minimumSize: 5,
  factIds: ALL_FACT_IDS,
};

const emptyConfusion = new ConfusionMatrix();
const noSynonymGroups: SynonymGroup[] = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectDistractors — reverse template (distractorAnswerField)', () => {
  it('forward mode: distractors are English meanings (default behavior unchanged)', () => {
    // Correct fact: ko-t-001 ("even number" / "짝수")
    const correctFact = KOREAN_FACTS[0];

    const result = selectDistractors(
      correctFact,
      ENGLISH_MEANINGS_POOL,
      KOREAN_FACTS,
      noSynonymGroups,
      emptyConfusion,
      null,
      3,
      2,
      // No distractorAnswerField → defaults to 'correctAnswer' (English)
    );

    expect(result.distractors).toHaveLength(3);

    // ALL distractors must be English words (non-Korean)
    for (const d of result.distractors) {
      // Korean strings contain Hangul Unicode range U+AC00–U+D7A3.
      // English meanings should NOT contain Hangul.
      expect(d.correctAnswer).not.toMatch(/[\uAC00-\uD7A3]/);
      // And should not be the correct answer
      expect(d.correctAnswer.toLowerCase()).not.toBe('even number');
    }
  });

  it('reverse mode: distractors are Korean words, NOT English meanings', () => {
    // Correct fact: ko-t-001 ("even number" / "짝수")
    // The reverse question is "How do you say 'even number' in Korean?"
    // Correct answer: 짝수
    // Distractors should be: 일정, 두통약, 선진국 (other Korean words) — NOT English
    const correctFact = KOREAN_FACTS[0];

    const result = selectDistractors(
      correctFact,
      TARGET_LANGUAGE_WORDS_POOL,
      KOREAN_FACTS,
      noSynonymGroups,
      emptyConfusion,
      null,
      3,
      2,
      'targetLanguageWord',  // The reverse template uses this field
    );

    expect(result.distractors).toHaveLength(3);

    const distractorAnswers = result.distractors.map(d => d.correctAnswer);

    // CORE ASSERTION: every distractor must be a Korean word (contain Hangul)
    for (const answer of distractorAnswers) {
      expect(answer).toMatch(/[\uAC00-\uD7A3]/);
    }

    // No distractor should be an English word
    const englishMeanings = ['schedule', 'headache medicine', 'developed country', 'quarrel', "all one's life"];
    for (const answer of distractorAnswers) {
      for (const english of englishMeanings) {
        expect(answer.toLowerCase()).not.toBe(english.toLowerCase());
      }
    }

    // The correct answer itself must not appear as a distractor
    expect(distractorAnswers).not.toContain('짝수');
  });

  it('reverse mode: correct fact excluded from its own distractors', () => {
    const correctFact = KOREAN_FACTS[0]; // 짝수

    const result = selectDistractors(
      correctFact,
      TARGET_LANGUAGE_WORDS_POOL,
      KOREAN_FACTS,
      noSynonymGroups,
      emptyConfusion,
      null,
      3,
      2,
      'targetLanguageWord',
    );

    const distractorAnswers = result.distractors.map(d => d.correctAnswer);
    // 짝수 must not appear in distractors
    expect(distractorAnswers).not.toContain('짝수');
  });

  it('reverse mode: all 5 remaining Korean words available as distractors', () => {
    // With 6 facts and distractorAnswerField=targetLanguageWord, we should get
    // 4 distractors (mastery=4) without hitting the fallback path.
    const correctFact = KOREAN_FACTS[0]; // 짝수

    const result = selectDistractors(
      correctFact,
      TARGET_LANGUAGE_WORDS_POOL,
      KOREAN_FACTS,
      noSynonymGroups,
      emptyConfusion,
      null,
      4,
      4,
      'targetLanguageWord',
    );

    expect(result.distractors).toHaveLength(4);

    // All returned distractors should be Korean
    for (const d of result.distractors) {
      expect(d.correctAnswer).toMatch(/[\uAC00-\uD7A3]/);
    }
  });

  it('returned DeckFact.correctAnswer equals the target language word (callers use correctAnswer)', () => {
    // The caller (nonCombatQuizSelector, CardCombatOverlay) uses d.correctAnswer for display.
    // When distractorAnswerField='targetLanguageWord', the returned correctAnswer must be
    // the Korean string, not the original English meaning stored in the source fact.
    const correctFact = KOREAN_FACTS[0]; // "even number" / 짝수

    const result = selectDistractors(
      correctFact,
      TARGET_LANGUAGE_WORDS_POOL,
      KOREAN_FACTS,
      noSynonymGroups,
      emptyConfusion,
      null,
      3,
      2,
      'targetLanguageWord',
    );

    for (const d of result.distractors) {
      // correctAnswer on the returned DeckFact should be the KOREAN word
      expect(d.correctAnswer).toMatch(/[\uAC00-\uD7A3]/);
      // Not an English word like "schedule", "headache medicine", etc.
      expect(d.correctAnswer.length).toBeGreaterThan(0);
    }

    // Verify the original fact objects were NOT mutated (we should have returned copies)
    for (const originalFact of KOREAN_FACTS) {
      // The original facts must still have their English correctAnswer intact
      expect(originalFact.correctAnswer).not.toMatch(/[\uAC00-\uD7A3]/);
    }
  });

  it('forward mode unchanged: no mutation of original facts', () => {
    const correctFact = KOREAN_FACTS[0];

    const result = selectDistractors(
      correctFact,
      ENGLISH_MEANINGS_POOL,
      KOREAN_FACTS,
      noSynonymGroups,
      emptyConfusion,
      null,
      3,
      2,
      // default 'correctAnswer'
    );

    // Verify result still has English answers
    for (const d of result.distractors) {
      expect(d.correctAnswer).not.toMatch(/[\uAC00-\uD7A3]/);
    }

    // Original facts unmutated
    for (const originalFact of KOREAN_FACTS) {
      expect(originalFact.correctAnswer).not.toMatch(/[\uAC00-\uD7A3]/);
    }
  });
});
