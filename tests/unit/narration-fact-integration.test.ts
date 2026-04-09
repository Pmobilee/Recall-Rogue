/**
 * narration-fact-integration.test.ts
 *
 * Tests the narration-fact integration fix that was applied in:
 * - src/services/encounterBridge.ts (resolveNarrativeFact helper + NarrativeFactInfo)
 * - src/services/gameFlowController.ts (replaced getById loop with resolveNarrativeFact)
 *
 * Root cause fixed: curated-deck facts were silently dropped because factsDB.getById
 * returns null for study/custom_deck facts. The fix uses a unified resolver that falls
 * back to curatedDeckStore when factsDB doesn't have the fact.
 *
 * Design spec: docs/mechanics/narrative.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DeckFact } from '../../src/data/curatedDeckTypes';

// ─── Mock factsDB (module-level, before imports) ───────────────────────────────
// Must be declared at top-level for Vitest hoisting.
const mockTrivaFacts: Map<string, any> = new Map();

vi.mock('../../src/services/factsDB', () => ({
  factsDB: {
    getById: (id: string) => mockTrivaFacts.get(id) ?? null,
    getAll: () => [...mockTrivaFacts.values()],
    isReady: () => true,
  },
}));

// ─── Mock curatedDeckStore ─────────────────────────────────────────────────────
const mockCuratedFacts: Map<string, DeckFact> = new Map();

vi.mock('../../src/data/curatedDeckStore', () => ({
  getCuratedDeckFact: (deckId: string, factId: string) => mockCuratedFacts.get(`${deckId}:${factId}`),
  getCuratedDeck: () => undefined,
  getCuratedDeckFacts: () => [],
  getAllLoadedDecks: () => [],
  loadCuratedDeck: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock narrative data loader (avoids file I/O in tests) ────────────────────
vi.mock('../../src/services/narrativeLoader', () => ({
  isNarrativeDataReady: () => false,
  loadAllArchetypes: () => [],
  loadAllLenses: () => [],
  loadEchoTemplates: () => [],
  loadInhabitant: () => null,
  loadSeekerLines: () => [],
  loadRelicCallbacks: () => [],
  loadAmbientLines: () => [],
}));

// Import AFTER mocks are in place
import {
  resolveNarrativeFact,
  type NarrativeFactInfo,
} from '../../src/services/encounterBridge';
import {
  initNarrative,
  recordEncounterResults,
  getNarrativeState,
  resetNarrative,
} from '../../src/services/narrativeEngine';
import type { RunState } from '../../src/services/runManager';

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeMinimalRunState(overrides: Partial<RunState> = {}): RunState {
  // Minimal RunState — only fields needed by resolveNarrativeFact and initNarrative
  return {
    isActive: true,
    primaryDomain: 'general_trivia' as any,
    secondaryDomain: 'general_trivia' as any,
    selectedArchetype: 'balanced',
    starterDeckSize: 10,
    startingAp: 3,
    primaryDomainRunNumber: 1,
    earlyBoostActive: false,
    floor: { currentFloor: 1, actMap: { nodes: {}, currentNodeId: '' } } as any,
    playerHp: 80,
    playerMaxHp: 80,
    currency: 0,
    cardsEarned: 0,
    factsAnswered: 0,
    factsCorrect: 0,
    correctAnswers: 0,
    bestCombo: 0,
    newFactsLearned: 0,
    factsMastered: 0,
    encountersWon: 0,
    encountersTotal: 0,
    elitesDefeated: 0,
    miniBossesDefeated: 0,
    bossesDefeated: 0,
    defeatedEnemyIds: [],
    currentEncounterWrongAnswers: 0,
    bounties: [],
    canary: { version: 1, integrityHash: '' } as any,
    startedAt: Date.now(),
    firstChargeFreeFactIds: new Set(),
    attemptedFactIds: new Set(),
    cursedFactIds: new Set(),
    consumedRewardFactIds: new Set(),
    factsAnsweredCorrectly: new Set(),
    factsAnsweredIncorrectly: new Set(),
    runAccuracyBonusApplied: false,
    endlessEnemyDamageMultiplier: 1,
    ascensionLevel: 0,
    ascensionModifiers: {} as any,
    retreatRewardLocked: false,
    runRelics: [],
    offeredRelicIds: new Set(),
    firstMiniBossRelicAwarded: false,
    relicPityCounter: 0,
    phoenixFeatherUsed: false,
    domainAccuracy: {},
    cardsUpgraded: 0,
    cardsRemovedAtShop: 0,
    haggleAttempts: 0,
    haggleSuccesses: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
    novelQuestionsAnswered: 0,
    novelQuestionsCorrect: 0,
    runSeed: 12345,
    globalTurnCounter: 1,
    soulJarCharges: 0,
    factVariantLevel: {},
    poolRewardScale: 1,
    totalDamageDealt: 0,
    perfectEncountersCount: 0,
    firstTimeFactIds: new Set(),
    tierAdvancedFactIds: new Set(),
    masteredThisRunFactIds: new Set(),
    runDeckId: undefined,
    runDeckLabel: undefined,
    includeOutsideDueReviews: false,
    ...overrides,
  } as RunState;
}

function makeTriviaFact(overrides: Record<string, any> = {}): any {
  return {
    id: 'trivia-fact-1',
    type: 'fact',
    statement: 'Test fact statement',
    explanation: 'Test explanation',
    quizQuestion: 'What is the capital of France?',
    correctAnswer: 'Paris',
    distractors: ['London', 'Berlin', 'Madrid'],
    category: ['history', 'geography'],
    categoryL1: 'geography',
    categoryL2: 'europe',
    language: 'en',
    pronunciation: undefined,
    rarity: 'common',
    difficulty: 3,
    funScore: 5,
    ageRating: 'all',
    ...overrides,
  };
}

function makeDeckFact(overrides: Partial<DeckFact> = {}): DeckFact {
  return {
    id: 'jp-n5-001',
    correctAnswer: 'cat',
    quizQuestion: 'What does "猫" (neko) mean?',
    distractors: ['dog', 'bird', 'fish'],
    statement: '猫 means cat in Japanese.',
    explanation: 'A very common Japanese noun for domestic cats.',
    difficulty: 2,
    funScore: 7,
    partOfSpeech: 'noun',
    targetLanguageWord: '猫',
    pronunciation: 'neko',
    categoryL1: 'language',
    categoryL2: 'vocabulary',
    language: 'ja',
    ...overrides,
  } as DeckFact;
}

// ─── Reset state between tests ─────────────────────────────────────────────────
beforeEach(() => {
  mockTrivaFacts.clear();
  mockCuratedFacts.clear();
  resetNarrative();
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. resolveNarrativeFact — trivia path
// ════════════════════════════════════════════════════════════════════════════════

describe('resolveNarrativeFact — trivia path', () => {
  it('returns full metadata when fact exists in factsDB', () => {
    const triviaFact = makeTriviaFact({
      id: 'trivia-geo-001',
      correctAnswer: 'Paris',
      quizQuestion: 'What is the capital of France?',
      categoryL1: 'geography',
      categoryL2: 'europe',
      language: 'en',
      pronunciation: undefined,
    });
    mockTrivaFacts.set('trivia-geo-001', triviaFact);

    const run = makeMinimalRunState({ deckMode: { type: 'general' } });
    const result = resolveNarrativeFact('trivia-geo-001', run);

    expect(result).not.toBeNull();
    expect(result!.factId).toBe('trivia-geo-001');
    expect(result!.answer).toBe('Paris');
    expect(result!.quizQuestion).toBe('What is the capital of France?');
    expect(result!.categoryL1).toBe('geography');
    expect(result!.categoryL2).toBe('europe');
    expect(result!.language).toBe('en');
    // Base Fact doesn't have partOfSpeech/targetLanguageWord — must be undefined
    expect(result!.partOfSpeech).toBeUndefined();
    expect(result!.targetLanguageWord).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. resolveNarrativeFact — curated study path
// ════════════════════════════════════════════════════════════════════════════════

describe('resolveNarrativeFact — curated study path', () => {
  it('falls back to curatedDeckStore when factsDB returns null', () => {
    // factsDB has nothing — mockTrivaFacts is empty
    const deckFact = makeDeckFact({
      id: 'jp-n5-001',
      correctAnswer: 'cat',
      targetLanguageWord: '猫',
      partOfSpeech: 'noun',
      pronunciation: 'neko',
      language: 'ja',
      categoryL1: 'language',
      categoryL2: 'vocabulary',
    });
    mockCuratedFacts.set('jp_n5:jp-n5-001', deckFact);

    const run = makeMinimalRunState({
      deckMode: { type: 'study', deckId: 'jp_n5' },
    });
    const result = resolveNarrativeFact('jp-n5-001', run);

    expect(result).not.toBeNull();
    expect(result!.factId).toBe('jp-n5-001');
    expect(result!.answer).toBe('cat');
    expect(result!.partOfSpeech).toBe('noun');
    expect(result!.targetLanguageWord).toBe('猫');
    expect(result!.pronunciation).toBe('neko');
    expect(result!.language).toBe('ja');
    expect(result!.categoryL1).toBe('language');
    expect(result!.categoryL2).toBe('vocabulary');
  });

  it('trivia path takes precedence over curated path when both have the fact', () => {
    const triviaFact = makeTriviaFact({ id: 'shared-id', correctAnswer: 'trivia-answer' });
    mockTrivaFacts.set('shared-id', triviaFact);

    const deckFact = makeDeckFact({ id: 'shared-id', correctAnswer: 'curated-answer' });
    mockCuratedFacts.set('jp_n5:shared-id', deckFact);

    const run = makeMinimalRunState({
      deckMode: { type: 'study', deckId: 'jp_n5' },
    });
    const result = resolveNarrativeFact('shared-id', run);

    // factsDB takes priority
    expect(result!.answer).toBe('trivia-answer');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. resolveNarrativeFact — custom_deck path
// ════════════════════════════════════════════════════════════════════════════════

describe('resolveNarrativeFact — custom_deck path', () => {
  it('iterates custom_deck items to find the fact', () => {
    const deckFact = makeDeckFact({
      id: 'fifa-001',
      correctAnswer: 'Cristiano Ronaldo',
      partOfSpeech: undefined,
      targetLanguageWord: undefined,
      categoryL1: 'sports',
      categoryL2: 'football',
      language: undefined,
    });
    mockCuratedFacts.set('fifa_legends:fifa-001', deckFact);

    const run = makeMinimalRunState({
      deckMode: {
        type: 'custom_deck',
        items: [
          { deckId: 'jp_n5' },      // not in this deck
          { deckId: 'fifa_legends' }, // found here
        ],
      },
    });
    const result = resolveNarrativeFact('fifa-001', run);

    expect(result).not.toBeNull();
    expect(result!.factId).toBe('fifa-001');
    expect(result!.answer).toBe('Cristiano Ronaldo');
    expect(result!.categoryL1).toBe('sports');
    // No partOfSpeech on sports facts
    expect(result!.partOfSpeech).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4. resolveNarrativeFact — not found
// ════════════════════════════════════════════════════════════════════════════════

describe('resolveNarrativeFact — not found', () => {
  it('returns null when neither factsDB nor curatedDeckStore has the fact', () => {
    const run = makeMinimalRunState({
      deckMode: { type: 'study', deckId: 'jp_n5' },
    });
    const result = resolveNarrativeFact('nonexistent-fact-id', run);
    expect(result).toBeNull();
  });

  it('returns null when deckMode is undefined', () => {
    const run = makeMinimalRunState({ deckMode: undefined });
    // factsDB also has nothing
    const result = resolveNarrativeFact('some-fact-id', run);
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 5. End-to-end: recordEncounterResults with vocabulary metadata populates
//    memorableFacts with non-empty echoText containing the foreign word
// ════════════════════════════════════════════════════════════════════════════════

describe('recordEncounterResults — vocabulary fact end-to-end', () => {
  it('populates memorableFacts with echoText referencing the foreign word', () => {
    const run = makeMinimalRunState({
      primaryDomain: 'language' as any,
      deckMode: { type: 'study', deckId: 'jp_n5' },
    });

    // Initialize narrative engine (uses mocked loader — selects fallback archetype)
    initNarrative(run);

    // Call recordEncounterResults with a vocabulary fact that has full metadata
    recordEncounterResults({
      correctAnswers: [
        {
          factId: 'jp-n5-001',
          answer: 'cat',
          quizQuestion: 'What does "猫" (neko) mean?',
          partOfSpeech: 'noun',
          targetLanguageWord: '猫',
          pronunciation: 'neko',
          categoryL1: 'language',
          categoryL2: 'vocabulary',
          language: 'ja',
        },
      ],
      wrongAnswers: [],
      chainCompletions: [],
      enemyId: 'test_enemy',
      isBoss: false,
      isElite: false,
      domain: 'language',
    });

    const state = getNarrativeState();
    expect(state).not.toBeNull();
    expect(state!.memorableFacts).toHaveLength(1);

    const echo = state!.memorableFacts[0];
    expect(echo.factId).toBe('jp-n5-001');
    expect(echo.answer).toBe('cat');
    expect(echo.wasCorrect).toBe(true);

    // The VocabForeignAdapter should produce echoText containing the foreign word
    // extracted from the quiz question (猫 from 'What does "猫" (neko) mean?')
    // or fall back to targetLanguageWord '猫'. Either way, 猫 must appear.
    expect(echo.echoText).toBeTruthy();
    expect(echo.echoText.length).toBeGreaterThan(0);
    // The adapter should extract the foreign word from the question pattern
    expect(echo.echoText).toBe('猫');
  });

  it('populates memorableFacts for trivia facts with categoryL1 + categoryL2', () => {
    const run = makeMinimalRunState({ deckMode: { type: 'general' } });

    initNarrative(run);

    recordEncounterResults({
      correctAnswers: [
        {
          factId: 'hist-001',
          answer: 'Napoleon Bonaparte',
          quizQuestion: 'Who led the French invasion of Russia in 1812?',
          categoryL1: 'history',
          categoryL2: 'napoleon',
        },
      ],
      wrongAnswers: [],
      chainCompletions: [],
      isBoss: false,
      isElite: false,
      domain: 'history',
    });

    const state = getNarrativeState();
    expect(state!.memorableFacts).toHaveLength(1);
    const echo = state!.memorableFacts[0];
    // History adapter should return the answer (starts with capital letter, >= 4 chars)
    expect(echo.echoText).toBe('Napoleon Bonaparte');
    expect(echo.answerType).toBe('person');
  });

  it('chainCompletions populate lastChainCompletion in state', () => {
    const run = makeMinimalRunState({ deckMode: { type: 'general' } });
    initNarrative(run);

    recordEncounterResults({
      correctAnswers: [],
      wrongAnswers: [],
      chainCompletions: [
        ['Paris', 'London', 'Berlin'],
        ['Napoleon', 'Wellington', 'Nelson'],
      ],
      isBoss: false,
      isElite: false,
      domain: 'history',
    });

    const state = getNarrativeState();
    // lastChainCompletion = most recent chain (last in array)
    expect(state!.lastChainCompletion).toEqual(['Napoleon', 'Wellington', 'Nelson']);
  });
});
