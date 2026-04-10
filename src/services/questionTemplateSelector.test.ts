import { describe, it, expect } from 'vitest';
import {
  explanationLeaksAnswer,
  readingMatchesTargetWord,
  selectQuestionTemplate,
} from './questionTemplateSelector';
import type { DeckFact, CuratedDeck, QuestionTemplate } from '../data/curatedDeckTypes';

// ---------------------------------------------------------------------------
// Minimal factory helpers
// ---------------------------------------------------------------------------

function makeFact(overrides: Partial<DeckFact> = {}): DeckFact {
  return {
    id: 'fact-001',
    quizQuestion: 'Test question?',
    correctAnswer: 'answer',
    difficulty: 2,
    funScore: 5,
    explanation: 'A clear explanation.',
    answerTypePoolId: 'pool-main',
    ...overrides,
  } as DeckFact;
}

function makeTemplate(overrides: Partial<QuestionTemplate> = {}): QuestionTemplate {
  return {
    id: 'forward',
    answerPoolId: 'pool-main',
    questionFormat: '{quizQuestion}',
    availableFromMastery: 0,
    difficulty: 2,
    reverseCapable: false,
    ...overrides,
  } as QuestionTemplate;
}

function makeDeck(templates: QuestionTemplate[], factId = 'fact-001'): CuratedDeck {
  return {
    id: 'deck-test',
    name: 'Test Deck',
    questionTemplates: templates,
    answerTypePools: [
      {
        id: 'pool-main',
        factIds: [factId],
        syntheticDistractors: [],
      },
    ],
    facts: [],
    subDecks: [],
    chainThemes: [],
  } as unknown as CuratedDeck;
}

// ---------------------------------------------------------------------------
// explanationLeaksAnswer
// ---------------------------------------------------------------------------

describe('explanationLeaksAnswer', () => {
  it('returns false when explanation does not contain the answer', () => {
    const fact = makeFact({ correctAnswer: 'abbey', explanation: 'A large religious building.' });
    expect(explanationLeaksAnswer(fact)).toBe(false);
  });

  it('returns true when explanation contains the answer as a whole word', () => {
    const fact = makeFact({
      correctAnswer: 'abbey',
      explanation: 'abbey — a religious building.',
    });
    expect(explanationLeaksAnswer(fact)).toBe(true);
  });

  it('returns false when explanation is empty', () => {
    const fact = makeFact({ correctAnswer: 'abbey', explanation: '' });
    expect(explanationLeaksAnswer(fact)).toBe(false);
  });

  it('returns false for partial word matches (abbey inside abbeyroad)', () => {
    const fact = makeFact({
      correctAnswer: 'abbey',
      explanation: 'abbeyroad is a famous album.',
    });
    // word-boundary: "abbey" inside "abbeyroad" should NOT match
    expect(explanationLeaksAnswer(fact)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readingMatchesTargetWord
// ---------------------------------------------------------------------------

describe('readingMatchesTargetWord', () => {
  it('returns true for katakana loanword where reading === targetLanguageWord', () => {
    const fact = makeFact({ targetLanguageWord: 'スーパー', reading: 'スーパー' });
    expect(readingMatchesTargetWord(fact)).toBe(true);
  });

  it('returns false for kanji where reading differs from targetLanguageWord', () => {
    const fact = makeFact({ targetLanguageWord: '記録', reading: 'きろく' });
    expect(readingMatchesTargetWord(fact)).toBe(false);
  });

  it('returns false when reading is absent', () => {
    const fact = makeFact({ targetLanguageWord: '記録' });
    expect(readingMatchesTargetWord(fact)).toBe(false);
  });

  it('returns false when targetLanguageWord is absent', () => {
    const fact = makeFact({ reading: 'きろく' });
    expect(readingMatchesTargetWord(fact)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// selectQuestionTemplate — distractorAnswerField for kanji templates
// ---------------------------------------------------------------------------

describe('selectQuestionTemplate — kanji template distractor fields', () => {
  const kanjiFactBase: Partial<DeckFact> = {
    id: 'fact-kanji-001',
    targetLanguageWord: '山',
    reading: 'さん',
    correctAnswer: 'mountain',
    quizQuestion: 'What is the on-reading of 山?',
    answerTypePoolId: 'pool-main',
    difficulty: 2,
    funScore: 5,
    explanation: 'Mountain; hill.',
  };

  it('returns distractorAnswerField=reading for kanji_onyomi template', () => {
    const fact = makeFact(kanjiFactBase);
    const template = makeTemplate({
      id: 'kanji_onyomi',
      questionFormat: 'What is the on-reading of {targetLanguageWord}?',
      reverseCapable: false,
    });
    const deck = makeDeck([template], fact.id);

    const result = selectQuestionTemplate(fact, deck, 0, [], 42);
    expect(result.distractorAnswerField).toBe('reading');
  });

  it('returns distractorAnswerField=reading for kanji_kunyomi template', () => {
    const fact = makeFact({
      ...kanjiFactBase,
      quizQuestion: 'What is the kun-reading of 山?',
    });
    const template = makeTemplate({
      id: 'kanji_kunyomi',
      questionFormat: 'What is the kun-reading of {targetLanguageWord}?',
      reverseCapable: false,
    });
    const deck = makeDeck([template], fact.id);

    const result = selectQuestionTemplate(fact, deck, 0, [], 42);
    expect(result.distractorAnswerField).toBe('reading');
  });
});

// ---------------------------------------------------------------------------
// selectQuestionTemplate — reverse template (regression guard)
// ---------------------------------------------------------------------------

describe('selectQuestionTemplate — reverse template distractor field', () => {
  it('returns distractorAnswerField=targetLanguageWord for reverse template', () => {
    const fact = makeFact({
      id: 'fact-vocab-001',
      targetLanguageWord: '山',
      reading: 'やま',
      correctAnswer: 'mountain',
      quizQuestion: 'What does 山 mean?',
      answerTypePoolId: 'pool-main',
      difficulty: 2,
      funScore: 5,
      explanation: 'Mountain.',
    });
    const template = makeTemplate({
      id: 'reverse',
      questionFormat: 'How do you say "{correctAnswer}" in Japanese?',
      reverseCapable: true,
    });
    const deck = makeDeck([template], fact.id);

    const result = selectQuestionTemplate(fact, deck, 0, [], 42);
    expect(result.distractorAnswerField).toBe('targetLanguageWord');
  });
});

// ---------------------------------------------------------------------------
// selectQuestionTemplate — reading/reading_pinyin templates (regression guard)
// ---------------------------------------------------------------------------

describe('selectQuestionTemplate — reading template distractor fields', () => {
  const kanjiFact = makeFact({
    id: 'fact-reading-001',
    targetLanguageWord: '記録',
    reading: 'きろく',
    correctAnswer: 'record; log',
    quizQuestion: 'What is the reading of 記録?',
    answerTypePoolId: 'pool-main',
    difficulty: 3,
    funScore: 5,
    explanation: 'A record or log.',
  });

  it('returns distractorAnswerField=reading for reading template', () => {
    const template = makeTemplate({
      id: 'reading',
      questionFormat: 'What is the reading of {targetLanguageWord}?',
    });
    const deck = makeDeck([template], kanjiFact.id);
    const result = selectQuestionTemplate(kanjiFact, deck, 0, [], 42);
    expect(result.distractorAnswerField).toBe('reading');
  });

  it('returns distractorAnswerField=reading for reading_pinyin template', () => {
    const template = makeTemplate({
      id: 'reading_pinyin',
      questionFormat: 'What is the pinyin of {targetLanguageWord}?',
    });
    const deck = makeDeck([template], kanjiFact.id);
    const result = selectQuestionTemplate(kanjiFact, deck, 0, [], 42);
    expect(result.distractorAnswerField).toBe('reading');
  });
});
