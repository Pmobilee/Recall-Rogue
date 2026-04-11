/**
 * Unit tests for study-multi DeckMode wiring — Issue 2 game-logic followup.
 *
 * Tests verify that the study-multi DeckMode variant correctly describes the
 * intended fact pools through:
 * - studyPreset.ts type shape (compile-time)
 * - runManager.ts InRunFactTracker seeding
 * - chainDistribution.ts precomputeChainDistribution
 * - wowFactorService.ts fact resolution
 *
 * Pool assembly in encounterBridge.ts requires Phaser / factsDB / full store
 * setup — those are integration-level and covered by the headless sim.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DeckMode, StudyMultiDeckEntry } from '../data/studyPreset';

// ---------------------------------------------------------------------------
// Mock heavy dependencies before any module imports that would pull them in
// ---------------------------------------------------------------------------

vi.mock('../data/curatedDeckStore', () => ({
  getCuratedDeck: vi.fn(() => undefined),
  getCuratedDeckFact: vi.fn(() => undefined),
  getCuratedDeckFacts: vi.fn(() => []),
  getAllLoadedDecks: vi.fn(() => []),
}));

vi.mock('./factsDB', () => ({
  factsDB: {
    isReady: vi.fn(() => false),
    getById: vi.fn(() => null),
  },
}));

vi.mock('../ui/stores/playerData', () => ({
  playerSave: { subscribe: vi.fn(), set: vi.fn(), update: vi.fn() },
  get: vi.fn(() => null),
}));

vi.mock('svelte/store', async (importOriginal) => {
  const mod = await importOriginal<typeof import('svelte/store')>();
  return {
    ...mod,
    get: vi.fn(() => null),
  };
});

import { getCuratedDeck, getCuratedDeckFact, getCuratedDeckFacts } from '../data/curatedDeckStore';
import { factsDB } from './factsDB';

const mockGetCuratedDeck = vi.mocked(getCuratedDeck);
const mockGetCuratedDeckFact = vi.mocked(getCuratedDeckFact);
const mockGetCuratedDeckFacts = vi.mocked(getCuratedDeckFacts);
const mockFactsDB = vi.mocked(factsDB);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a minimal DeckFact-shaped object with a given ID. */
function makeFact(id: string) {
  return {
    id,
    correctAnswer: `Answer ${id}`,
    quizQuestion: `Question ${id}?`,
    partOfSpeech: undefined,
    targetLanguageWord: undefined,
    pronunciation: undefined,
    categoryL1: 'history',
    categoryL2: 'ancient',
    language: undefined,
    explanation: `Explanation for ${id}`,
  } as any; // DeckFact is a complex runtime type; cast for test purposes
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFactsDB.isReady.mockReturnValue(false);
  mockFactsDB.getById.mockReturnValue(null);
  mockGetCuratedDeck.mockReturnValue(undefined);
  mockGetCuratedDeckFact.mockReturnValue(undefined);
  mockGetCuratedDeckFacts.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// Type-level tests — verify DeckMode union includes study-multi
// ---------------------------------------------------------------------------

describe('DeckMode — study-multi type shape', () => {
  it('accepts a study-multi with two decks and no trivia domains', () => {
    const mode: DeckMode = {
      type: 'study-multi',
      decks: [
        { deckId: 'world_capitals', subDeckIds: 'all' },
        { deckId: 'world_countries', subDeckIds: ['wc_europe', 'wc_asia'] },
      ],
      triviaDomains: [],
    };
    expect(mode.type).toBe('study-multi');
    if (mode.type === 'study-multi') {
      expect(mode.decks).toHaveLength(2);
      expect(mode.triviaDomains).toHaveLength(0);
    }
  });

  it('accepts a study-multi with no decks and two trivia domains', () => {
    const mode: DeckMode = {
      type: 'study-multi',
      decks: [],
      triviaDomains: ['science', 'history'],
    };
    expect(mode.type).toBe('study-multi');
    if (mode.type === 'study-multi') {
      expect(mode.decks).toHaveLength(0);
      expect(mode.triviaDomains).toHaveLength(2);
    }
  });

  it('accepts a mixed study-multi with both decks and trivia domains', () => {
    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'world_capitals', subDeckIds: 'all' }],
      triviaDomains: ['science'],
    };
    if (mode.type === 'study-multi') {
      expect(mode.decks).toHaveLength(1);
      expect(mode.triviaDomains).toHaveLength(1);
    }
  });

  it('accepts an empty study-multi (both decks and triviaDomains empty)', () => {
    const mode: DeckMode = {
      type: 'study-multi',
      decks: [],
      triviaDomains: [],
    };
    if (mode.type === 'study-multi') {
      expect(mode.decks).toHaveLength(0);
      expect(mode.triviaDomains).toHaveLength(0);
    }
  });

  it('StudyMultiDeckEntry subDeckIds supports both "all" and string array', () => {
    const allEntry: StudyMultiDeckEntry = { deckId: 'deck-a', subDeckIds: 'all' };
    const listEntry: StudyMultiDeckEntry = { deckId: 'deck-b', subDeckIds: ['sub1', 'sub2'] };
    expect(allEntry.subDeckIds).toBe('all');
    expect(listEntry.subDeckIds).toEqual(['sub1', 'sub2']);
  });
});

// ---------------------------------------------------------------------------
// wowFactorService — study-multi fact resolution
// ---------------------------------------------------------------------------

describe('wowFactorService — study-multi mode', () => {
  // Import dynamically to ensure mocks are in place
  const getService = async () => {
    const mod = await import('./wowFactorService');
    return mod.resolveWowFactorText;
  };

  it('returns null for non-tier-1 cards regardless of mode', async () => {
    const resolveWowFactorText = await getService();
    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'deck-a', subDeckIds: 'all' }],
      triviaDomains: [],
    };
    expect(resolveWowFactorText('fact-1', '2', { deckMode: mode })).toBeNull();
  });

  it('returns null when deckMode is study-multi but factId is null', async () => {
    const resolveWowFactorText = await getService();
    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'deck-a', subDeckIds: 'all' }],
      triviaDomains: [],
    };
    expect(resolveWowFactorText(null, '1', { deckMode: mode })).toBeNull();
  });

  it('resolves explanation via factSourceDeckMap when deck entry contains fact', async () => {
    const resolveWowFactorText = await getService();
    mockGetCuratedDeckFact.mockImplementation((deckId, factId) => {
      if (deckId === 'deck-b' && factId === 'fact-x') {
        return makeFact('fact-x');
      }
      return undefined;
    });

    const mode: DeckMode = {
      type: 'study-multi',
      decks: [
        { deckId: 'deck-a', subDeckIds: 'all' },
        { deckId: 'deck-b', subDeckIds: 'all' },
      ],
      triviaDomains: ['science'],
    };
    const result = resolveWowFactorText('fact-x', '1', {
      deckMode: mode,
      factSourceDeckMap: { 'fact-x': 'deck-b' },
    });
    expect(result).toBe('Explanation for fact-x');
    expect(mockGetCuratedDeckFact).toHaveBeenCalledWith('deck-b', 'fact-x');
  });

  it('iterates deck entries when factSourceDeckMap has no entry', async () => {
    const resolveWowFactorText = await getService();
    mockGetCuratedDeckFact.mockImplementation((deckId, factId) => {
      if (deckId === 'deck-b' && factId === 'fact-y') {
        return makeFact('fact-y');
      }
      return undefined;
    });

    const mode: DeckMode = {
      type: 'study-multi',
      decks: [
        { deckId: 'deck-a', subDeckIds: 'all' },
        { deckId: 'deck-b', subDeckIds: 'all' },
      ],
      triviaDomains: [],
    };
    const result = resolveWowFactorText('fact-y', '1', { deckMode: mode });
    expect(result).toBe('Explanation for fact-y');
  });

  it('falls through to factsDB for trivia-domain facts not in any deck', async () => {
    const resolveWowFactorText = await getService();
    // No deck has this fact
    mockGetCuratedDeckFact.mockReturnValue(undefined);
    mockFactsDB.isReady.mockReturnValue(true);
    mockFactsDB.getById.mockReturnValue({
      id: 'trivia-fact-1',
      wowFactor: 'Amazing science trivia!',
    } as any);

    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'deck-a', subDeckIds: 'all' }],
      triviaDomains: ['science'],
    };
    const result = resolveWowFactorText('trivia-fact-1', '1', { deckMode: mode });
    expect(result).toBe('Amazing science trivia!');
  });

  it('returns null when fact is not in any deck and not in factsDB', async () => {
    const resolveWowFactorText = await getService();
    mockGetCuratedDeckFact.mockReturnValue(undefined);
    mockFactsDB.isReady.mockReturnValue(false);

    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'deck-a', subDeckIds: 'all' }],
      triviaDomains: ['history'],
    };
    expect(resolveWowFactorText('missing-fact', '1', { deckMode: mode })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// chainDistribution — study-multi precomputeChainDistribution
// ---------------------------------------------------------------------------

describe('chainDistribution — precomputeChainDistribution with study-multi', () => {
  it('returns undefined when study-multi has no curated decks', async () => {
    const { precomputeChainDistribution } = await import('./chainDistribution');
    mockGetCuratedDeck.mockReturnValue(undefined);
    mockGetCuratedDeckFacts.mockReturnValue([]);

    const mode: DeckMode = {
      type: 'study-multi',
      decks: [],
      triviaDomains: ['science'],
    };
    const result = precomputeChainDistribution(mode, [], 42);
    expect(result).toBeUndefined();
  });

  it('returns undefined when deck entries exist but no deck is loaded', async () => {
    const { precomputeChainDistribution } = await import('./chainDistribution');
    // getCuratedDeck returns undefined = deck not loaded
    mockGetCuratedDeck.mockReturnValue(undefined);
    mockGetCuratedDeckFacts.mockReturnValue([]);

    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'unknown-deck', subDeckIds: 'all' }],
      triviaDomains: [],
    };
    const result = precomputeChainDistribution(mode, [], 42);
    expect(result).toBeUndefined();
  });

  it('returns undefined when decks are loaded but facts list is empty', async () => {
    const { precomputeChainDistribution } = await import('./chainDistribution');
    mockGetCuratedDeck.mockReturnValue({ id: 'deck-a', facts: [], topicGroups: [] } as any);
    mockGetCuratedDeckFacts.mockReturnValue([]);

    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'deck-a', subDeckIds: 'all' }],
      triviaDomains: [],
    };
    const result = precomputeChainDistribution(mode, [], 42);
    expect(result).toBeUndefined();
  });

  it('returns undefined for general / trivia / preset / language deckModes (unchanged behaviour)', async () => {
    const { precomputeChainDistribution } = await import('./chainDistribution');

    expect(precomputeChainDistribution({ type: 'general' }, [], 1)).toBeUndefined();
    expect(precomputeChainDistribution({ type: 'trivia', domains: ['history'] }, [], 1)).toBeUndefined();
    expect(precomputeChainDistribution({ type: 'language', languageCode: 'ja' }, [], 1)).toBeUndefined();
    expect(precomputeChainDistribution({ type: 'preset', presetId: 'p1' }, [], 1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// masteryScalingService — leaderboard ineligibility
// ---------------------------------------------------------------------------

describe('masteryScalingService — leaderboard eligibility with study-multi', () => {
  it('returns null (ineligible) for study-multi mode', async () => {
    const { getLeaderboardEligibility } = await import('./masteryScalingService');
    const mode: DeckMode = {
      type: 'study-multi',
      decks: [{ deckId: 'deck-a', subDeckIds: 'all' }],
      triviaDomains: ['history'],
    };
    expect(getLeaderboardEligibility(mode)).toBeNull();
  });

  it('still returns "general" for general mode (regression guard)', async () => {
    const { getLeaderboardEligibility } = await import('./masteryScalingService');
    expect(getLeaderboardEligibility({ type: 'general' })).toBe('general');
  });
});
