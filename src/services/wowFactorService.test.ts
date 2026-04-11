/**
 * Unit tests for wowFactorService — resolveWowFactorText.
 *
 * Issue 8: Wow factor showed the wrong fact's text because the mutable
 * card.__studyFactId could be stale at call time. The service now accepts
 * the authoritative factId from committedQuizData.factId.
 *
 * Key regression: CARD's factId is FACT-A, committed quiz was FACT-B.
 * Expected: service returns FACT-B's text, not FACT-A's.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock factsDB before importing the service.
vi.mock('./factsDB', () => ({
  factsDB: {
    isReady: vi.fn(() => false),
    getById: vi.fn(() => null),
  },
}));

// Mock curatedDeckStore before importing the service.
vi.mock('../data/curatedDeckStore', () => ({
  getCuratedDeckFact: vi.fn(() => undefined),
}));

import { resolveWowFactorText } from './wowFactorService';
import { factsDB } from './factsDB';
import { getCuratedDeckFact } from '../data/curatedDeckStore';

const mockFactsDB = vi.mocked(factsDB);
const mockGetCuratedDeckFact = vi.mocked(getCuratedDeckFact);

beforeEach(() => {
  vi.clearAllMocks();
  mockFactsDB.isReady.mockReturnValue(false);
  mockFactsDB.getById.mockReturnValue(null);
  mockGetCuratedDeckFact.mockReturnValue(undefined);
});

// ── Tier guard ────────────────────────────────────────────────────────────────

describe('resolveWowFactorText — tier guard', () => {
  it('returns null for non-tier-1 cards', () => {
    const result = resolveWowFactorText('fact-a', '2', null);
    expect(result).toBeNull();
  });

  it('returns null when answeredFactId is null', () => {
    const result = resolveWowFactorText(null, '1', null);
    expect(result).toBeNull();
  });

  it('returns null when answeredFactId is empty string', () => {
    const result = resolveWowFactorText('', '1', null);
    expect(result).toBeNull();
  });
});

// ── Trivia / general mode ─────────────────────────────────────────────────────

describe('resolveWowFactorText — trivia mode (no deckMode)', () => {
  it('returns null when factsDB is not ready', () => {
    mockFactsDB.isReady.mockReturnValue(false);
    const result = resolveWowFactorText('fact-a', '1', null);
    expect(result).toBeNull();
  });

  it('returns wowFactor from factsDB when ready', () => {
    mockFactsDB.isReady.mockReturnValue(true);
    mockFactsDB.getById.mockReturnValue({
      id: 'fact-a',
      wowFactor: 'Amazing trivia text',
    } as any);

    const result = resolveWowFactorText('fact-a', '1', { deckMode: { type: 'general' } });
    expect(result).toBe('Amazing trivia text');
  });

  it('returns null when fact has no wowFactor', () => {
    mockFactsDB.isReady.mockReturnValue(true);
    mockFactsDB.getById.mockReturnValue({
      id: 'fact-a',
      wowFactor: undefined,
    } as any);

    const result = resolveWowFactorText('fact-a', '1', { deckMode: { type: 'general' } });
    expect(result).toBeNull();
  });
});

// ── Study mode ────────────────────────────────────────────────────────────────

describe('resolveWowFactorText — study mode', () => {
  const studyRunContext = {
    deckMode: { type: 'study' as const, deckId: 'genji-deck' },
  };

  it('returns explanation from curated deck fact when wowFactor is absent', () => {
    mockGetCuratedDeckFact.mockReturnValue({
      id: 'fact-b',
      explanation: 'The Tale of Genji was written in 11th century Japan.',
      correctAnswer: 'Murasaki Shikibu',
      distractors: [],
      quizQuestion: 'Who wrote the Tale of Genji?',
    } as any);

    const result = resolveWowFactorText('fact-b', '1', studyRunContext);
    expect(result).toBe('The Tale of Genji was written in 11th century Japan.');
    expect(mockGetCuratedDeckFact).toHaveBeenCalledWith('genji-deck', 'fact-b');
  });

  it('returns wowFactor over explanation when both are present', () => {
    mockGetCuratedDeckFact.mockReturnValue({
      id: 'fact-b',
      wowFactor: 'Wow: oldest novel still widely read today!',
      explanation: 'The Tale of Genji was written in 11th century Japan.',
      correctAnswer: 'Murasaki Shikibu',
      distractors: [],
      quizQuestion: 'Who wrote the Tale of Genji?',
    } as any);

    const result = resolveWowFactorText('fact-b', '1', studyRunContext);
    expect(result).toBe('Wow: oldest novel still widely read today!');
  });

  it('returns null when curated deck fact is not found', () => {
    mockGetCuratedDeckFact.mockReturnValue(undefined);
    const result = resolveWowFactorText('fact-b', '1', studyRunContext);
    expect(result).toBeNull();
  });

  // ── Issue 8 regression test ────────────────────────────────────────────────
  it('[Issue 8] uses the committed factId (FACT-B), not the card factId (FACT-A)', () => {
    // Simulate: card.factId = 'fact-a' (static assignment)
    // committedQuizData.factId = 'fact-b' (actually quizzed fact)
    // The caller should pass committedQuizData.factId, not card.factId.
    // This test verifies the service returns FACT-B's text when FACT-B is passed.

    const FACT_A_ID = 'world-capitals-001'; // card's static factId (wrong deck)
    const FACT_B_ID = 'genji-tale-042';     // fact actually shown in quiz

    mockGetCuratedDeckFact.mockImplementation((deckId, factId) => {
      if (deckId === 'genji-deck' && factId === FACT_B_ID) {
        return {
          id: FACT_B_ID,
          explanation: 'Lady Murasaki wrote the Genji Monogatari circa 1010 CE.',
          correctAnswer: 'Murasaki Shikibu',
          distractors: [],
          quizQuestion: 'Who authored the Tale of Genji?',
        } as any;
      }
      if (deckId === 'genji-deck' && factId === FACT_A_ID) {
        return {
          id: FACT_A_ID,
          explanation: 'This is a world capitals fact — WRONG if shown for Genji quiz.',
          correctAnswer: 'Tokyo',
          distractors: [],
          quizQuestion: 'What is the capital of Japan?',
        } as any;
      }
      return undefined;
    });

    // Service called with FACT-B (the committed quizzed fact) — should return FACT-B text
    const correctResult = resolveWowFactorText(FACT_B_ID, '1', studyRunContext);
    expect(correctResult).toBe('Lady Murasaki wrote the Genji Monogatari circa 1010 CE.');

    // Calling with FACT-A (the stale card.factId) would have returned wrong text
    const wrongResult = resolveWowFactorText(FACT_A_ID, '1', studyRunContext);
    expect(wrongResult).toBe('This is a world capitals fact — WRONG if shown for Genji quiz.');

    // The regression: old code used card.__studyFactId which could be FACT_A_ID
    // New code passes committedQuizData.factId which is always FACT_B_ID
    expect(correctResult).not.toBe(wrongResult);
  });
});

// ── Custom deck mode ──────────────────────────────────────────────────────────

describe('resolveWowFactorText — custom_deck mode', () => {
  const customDeckContext = {
    deckMode: {
      type: 'custom_deck' as const,
      items: [
        { deckId: 'deck-a' },
        { deckId: 'deck-b' },
      ],
    },
    factSourceDeckMap: { 'fact-x': 'deck-b' },
  };

  it('uses factSourceDeckMap to find the source deck efficiently', () => {
    mockGetCuratedDeckFact.mockImplementation((deckId, factId) => {
      if (deckId === 'deck-b' && factId === 'fact-x') {
        return {
          id: 'fact-x',
          explanation: 'From deck-b.',
          correctAnswer: 'X',
          distractors: [],
          quizQuestion: 'Q?',
        } as any;
      }
      return undefined;
    });

    const result = resolveWowFactorText('fact-x', '1', customDeckContext);
    expect(result).toBe('From deck-b.');
    // Should resolve via factSourceDeckMap directly to deck-b, not iterate deck-a first
    expect(mockGetCuratedDeckFact).toHaveBeenCalledWith('deck-b', 'fact-x');
  });

  it('falls back to iterating deck items when factSourceDeckMap has no entry', () => {
    const contextNoMap = {
      deckMode: {
        type: 'custom_deck' as const,
        items: [{ deckId: 'deck-a' }, { deckId: 'deck-b' }],
      },
    };

    mockGetCuratedDeckFact.mockImplementation((deckId, factId) => {
      if (deckId === 'deck-b' && factId === 'fact-y') {
        return {
          id: 'fact-y',
          explanation: 'Found in deck-b via fallback.',
          correctAnswer: 'Y',
          distractors: [],
          quizQuestion: 'Q?',
        } as any;
      }
      return undefined;
    });

    const result = resolveWowFactorText('fact-y', '1', contextNoMap);
    expect(result).toBe('Found in deck-b via fallback.');
  });

  it('returns null when fact is not found in any deck', () => {
    mockGetCuratedDeckFact.mockReturnValue(undefined);
    const result = resolveWowFactorText('missing-fact', '1', customDeckContext);
    expect(result).toBeNull();
  });
});
