/**
 * Tests for selectNonCombatStudyQuestion — specifically the excludeFactIds dedup
 * parameter added to fix the study-session duplicate-question bug.
 *
 * Bug: generateStudyQuestions() in gameFlowController called selectNonCombatStudyQuestion
 * 3 times without tracking which fact IDs had already been selected. The curatedFactSelector
 * only excludes `lastFactId` (a single ID), so iteration 1 and iteration 3 could return
 * the same fact (A was last for iter 2, not for iter 3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectNonCombatStudyQuestion } from './nonCombatQuizSelector';
import { InRunFactTracker } from './inRunFactTracker';
import type { DeckFact, CuratedDeck, AnswerTypePool } from '../data/curatedDeckTypes';
import { ConfusionMatrix } from './confusionMatrix';

// ---------------------------------------------------------------------------
// Minimal mock helpers
// ---------------------------------------------------------------------------

function makeDeckFact(id: string, correctAnswer: string): DeckFact {
  return {
    id,
    correctAnswer,
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'pool_main',
    difficulty: 2,
    funScore: 5,
    quizQuestion: `Question about ${id}?`,
    explanation: `Explanation for ${id}`,
    visualDescription: '',
    sourceName: 'test',
    distractors: ['Wrong A', 'Wrong B', 'Wrong C'],
  };
}

const MOCK_FACTS: DeckFact[] = [
  makeDeckFact('fact_1', 'Answer 1'),
  makeDeckFact('fact_2', 'Answer 2'),
  makeDeckFact('fact_3', 'Answer 3'),
  makeDeckFact('fact_4', 'Answer 4'),
  makeDeckFact('fact_5', 'Answer 5'),
];

const MOCK_POOL: AnswerTypePool = {
  id: 'pool_main',
  label: 'Main',
  answerFormat: 'name',
  minimumSize: 5,
  factIds: MOCK_FACTS.map(f => f.id),
};

const MOCK_DECK: CuratedDeck = {
  id: 'test_deck',
  name: 'Test Deck',
  domain: 'general_knowledge',
  description: 'Test',
  minimumFacts: 5,
  targetFacts: 5,
  facts: MOCK_FACTS,
  answerTypePools: [MOCK_POOL],
  synonymGroups: [],
  questionTemplates: [],
  difficultyTiers: [],
};

const EMPTY_CONFUSION_MATRIX = new ConfusionMatrix();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../data/curatedDeckStore', () => ({
  getCuratedDeck: vi.fn(() => MOCK_DECK),
  getCuratedDeckFacts: vi.fn(() => [...MOCK_FACTS]),
}));

// Mock selectFactForCharge to return facts deterministically by index based on pool order.
// This simulates the real selector's behavior of returning facts from the (possibly filtered) pool.
vi.mock('./curatedFactSelector', () => ({
  selectFactForCharge: vi.fn((factPool: DeckFact[]) => ({
    fact: factPool[0],
    selectionReason: 'unseen',
  })),
}));

// Mock template selector — returns a minimal result using the fact's own data.
vi.mock('./questionTemplateSelector', () => ({
  selectQuestionTemplate: vi.fn((fact: DeckFact) => ({
    renderedQuestion: fact.quizQuestion,
    correctAnswer: fact.correctAnswer,
    answerPoolId: 'pool_main',
    templateId: 'default',
  })),
}));

// Mock distractor selector — return 3 placeholder distractors.
vi.mock('./curatedDistractorSelector', () => ({
  getDistractorCount: vi.fn(() => 3),
  selectDistractors: vi.fn(() => ({ distractors: [] })),
}));

// Mock numerical distractor service.
vi.mock('./numericalDistractorService', () => ({
  isNumericalAnswer: vi.fn(() => false),
  getNumericalDistractors: vi.fn(() => []),
  displayAnswer: vi.fn((s: string) => s),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectNonCombatStudyQuestion — excludeFactIds dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-import fresh modules between tests isn't needed because mocks stay consistent.
  });

  it('returns a question without excludeFactIds (baseline)', () => {
    const tracker = new InRunFactTracker();
    const result = selectNonCombatStudyQuestion(
      'rest',
      'test_deck',
      undefined,
      EMPTY_CONFUSION_MATRIX,
      tracker,
      1,
      12345,
    );
    expect(result).not.toBeNull();
    expect(result!.factId).toBe('fact_1');
  });

  it('excludes fact_1 when excludeFactIds = {fact_1}, returns a different fact', async () => {
    // Because selectFactForCharge returns factPool[0], passing excludeFactIds = {fact_1}
    // should filter fact_1 out so the pool passed in starts with fact_2.
    const { getCuratedDeckFacts } = await import('../data/curatedDeckStore');
    const { selectFactForCharge } = await import('./curatedFactSelector');

    // getCuratedDeckFacts always returns all 5 facts; selectNonCombatStudyQuestion
    // should filter it before calling selectFactForCharge.
    vi.mocked(getCuratedDeckFacts).mockReturnValue([...MOCK_FACTS]);
    vi.mocked(selectFactForCharge).mockImplementation((pool) => ({
      fact: pool[0],
      selectionReason: 'unseen',
    }));

    const tracker = new InRunFactTracker();
    const excludeFactIds = new Set(['fact_1']);

    const result = selectNonCombatStudyQuestion(
      'rest',
      'test_deck',
      undefined,
      EMPTY_CONFUSION_MATRIX,
      tracker,
      1,
      12345,
      undefined,
      undefined,
      excludeFactIds,
    );

    expect(result).not.toBeNull();
    // fact_1 was excluded, so pool[0] passed to selectFactForCharge should be fact_2
    expect(result!.factId).toBe('fact_2');
  });

  it('simulates a 3-question batch: all returned factIds are unique', async () => {
    const { getCuratedDeckFacts } = await import('../data/curatedDeckStore');
    const { selectFactForCharge } = await import('./curatedFactSelector');

    vi.mocked(getCuratedDeckFacts).mockReturnValue([...MOCK_FACTS]);
    // Real-world selectFactForCharge returns pool[0] — this mirrors that
    vi.mocked(selectFactForCharge).mockImplementation((pool) => ({
      fact: pool[0],
      selectionReason: 'unseen',
    }));

    const tracker = new InRunFactTracker();
    const excludeFactIds = new Set<string>();
    const questions = [];

    for (let i = 0; i < 3; i++) {
      const q = selectNonCombatStudyQuestion(
        'rest',
        'test_deck',
        undefined,
        EMPTY_CONFUSION_MATRIX,
        tracker,
        1,
        12345 + i * 1000,
        undefined,
        undefined,
        excludeFactIds,
      );
      expect(q).not.toBeNull();
      if (q) {
        // Simulate what generateStudyQuestions does
        excludeFactIds.add(q.factId);
        questions.push(q);
      }
    }

    expect(questions).toHaveLength(3);
    const factIds = questions.map(q => q.factId);
    // All 3 factIds should be distinct
    expect(new Set(factIds).size).toBe(3);
    expect(factIds).toEqual(['fact_1', 'fact_2', 'fact_3']);
  });

  it('falls back to full pool when excludeFactIds exhausts all available facts', async () => {
    const { getCuratedDeckFacts } = await import('../data/curatedDeckStore');
    const { selectFactForCharge } = await import('./curatedFactSelector');

    // Simulate a tiny deck with only 1 fact
    const singleFact = [makeDeckFact('only_fact', 'Only Answer')];
    vi.mocked(getCuratedDeckFacts).mockReturnValue(singleFact);
    vi.mocked(selectFactForCharge).mockImplementation((pool) => ({
      fact: pool[0],
      selectionReason: 'unseen',
    }));

    const tracker = new InRunFactTracker();
    // Exclude the only fact
    const excludeFactIds = new Set(['only_fact']);

    // Should NOT return null — falls back to full pool when filtered pool is empty
    const result = selectNonCombatStudyQuestion(
      'rest',
      'test_deck',
      undefined,
      EMPTY_CONFUSION_MATRIX,
      tracker,
      1,
      12345,
      undefined,
      undefined,
      excludeFactIds,
    );

    expect(result).not.toBeNull();
    expect(result!.factId).toBe('only_fact'); // falls back to full (single-fact) pool
  });
});
