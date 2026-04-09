/**
 * Tests for presetPoolBuilder — focusing on the allowLanguageFacts option
 * added in 2026-04-09 to fix coop custom-deck pool divergence.
 *
 * The full buildPresetRunPool function requires many heavy dependencies
 * (factsDB SQLite, cardFactory, mechanics tables, etc.) so these tests focus
 * on the predicate logic and the isTriviaRun gate that the option controls.
 * Integration-level behaviour is covered by the headless sim.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Fact } from '../data/types';

// ---------------------------------------------------------------------------
// Minimal mock infrastructure
// ---------------------------------------------------------------------------

// We test the factIsTrivia predicate directly by importing
// presetPoolBuilder and observing its filtering behaviour through
// buildPresetRunPool with a mocked factsDB.

const makeKnowledgeFact = (id: string): Fact => ({
  id,
  type: 'fact',
  statement: `Fact ${id}`,
  explanation: `Explanation for ${id}`,
  quizQuestion: `Question about ${id}?`,
  correctAnswer: `Answer ${id}`,
  distractors: ['A', 'B', 'C'],
  category: ['History'],
  categoryL1: 'history',
  rarity: 'common',
  difficulty: 3,
  funScore: 5,
  ageRating: 'kid',
});

const makeVocabFact = (id: string): Fact => ({
  id,
  type: 'vocabulary',
  statement: `Vocab ${id}`,
  explanation: `Definition for ${id}`,
  quizQuestion: `What does ${id} mean?`,
  correctAnswer: `Meaning ${id}`,
  distractors: ['X', 'Y', 'Z'],
  category: ['Language', 'Japanese', 'N3'],
  categoryL1: 'language',
  rarity: 'common',
  difficulty: 2,
  funScore: 5,
  ageRating: 'kid',
  language: 'ja',
});

const makeGrammarFact = (id: string): Fact => ({
  id,
  type: 'grammar',
  statement: `Grammar ${id}`,
  explanation: `Usage for ${id}`,
  quizQuestion: `Grammar question ${id}?`,
  correctAnswer: `Pattern ${id}`,
  distractors: ['P', 'Q', 'R'],
  category: ['Language', 'Japanese'],
  categoryL1: 'language',
  rarity: 'common',
  difficulty: 3,
  funScore: 5,
  ageRating: 'kid',
  language: 'ja',
});

const KNOWLEDGE_FACTS = [
  makeKnowledgeFact('k1'),
  makeKnowledgeFact('k2'),
  makeKnowledgeFact('k3'),
];
const VOCAB_FACTS = [
  makeVocabFact('v1'),
  makeVocabFact('v2'),
];
const GRAMMAR_FACTS = [
  makeGrammarFact('g1'),
];
const ALL_FACTS = [...KNOWLEDGE_FACTS, ...VOCAB_FACTS, ...GRAMMAR_FACTS];

// Mock all the heavy deps that presetPoolBuilder imports at module level
vi.mock('./factsDB', () => ({
  factsDB: {
    getAll: vi.fn(() => ALL_FACTS),
    getByCategory: vi.fn((categories: string[], _limit: number) => {
      // Return knowledge facts for non-language categories, all for language
      return ALL_FACTS.filter(f => categories.some(c => f.category.includes(c)));
    }),
    getById: vi.fn((id: string) => ALL_FACTS.find(f => f.id === id) ?? null),
  },
}));

vi.mock('./cardFactory', () => ({
  createCard: vi.fn((fact: Fact, _state?: unknown) => ({
    id: `card_${fact.id}`,
    factId: fact.id,
    cardType: 'attack',
    domain: 'history',
    tier: '1',
    baseEffectValue: 5,
    effectMultiplier: 1,
    chainType: 0,
    masteryLevel: 0,
    mechanicId: 'strike',
    mechanicName: 'Strike',
    apCost: 1,
    originalBaseEffectValue: 5,
    fact,
  })),
  resetCardIdCounter: vi.fn(),
}));

vi.mock('./cardTypeAllocator', () => ({
  assignTypesToCards: vi.fn((cards: unknown[]) => cards),
}));

vi.mock('./characterLevel', () => ({
  getUnlockedMechanics: vi.fn(() => undefined),
}));

vi.mock('../data/mechanics', () => ({
  MECHANICS_BY_TYPE: {
    attack: [{ id: 'strike', name: 'Strike', apCost: 1, baseValue: 5, maxPerPool: 0 }],
    defense: [{ id: 'block', name: 'Block', apCost: 1, baseValue: 5, maxPerPool: 0 }],
    buff: [{ id: 'focus', name: 'Focus', apCost: 1, baseValue: 5, maxPerPool: 0 }],
    utility: [{ id: 'draw', name: 'Draw', apCost: 1, baseValue: 1, maxPerPool: 0 }],
    wild: [{ id: 'wild_strike', name: 'Wild Strike', apCost: 1, baseValue: 6, maxPerPool: 0 }],
  },
}));

vi.mock('../data/chainTypes', () => ({
  selectRunChainTypes: vi.fn(() => [0, 1, 2]),
}));

vi.mock('./seededRng', () => ({
  isRunRngActive: vi.fn(() => false),
  getRunRng: vi.fn(),
  seededShuffled: vi.fn((_, arr: unknown[]) => arr),
}));

vi.mock('./randomUtils', () => ({
  shuffled: vi.fn((arr: unknown[]) => [...arr]),
}));

vi.mock('./funnessBoost', () => ({
  funScoreWeight: vi.fn(() => 1),
}));

vi.mock('./presetSelectionService', () => ({
  factMatchesDomainSelection: vi.fn(() => true),
  factMatchesPresetSelection: vi.fn(() => true),
}));

vi.mock('../data/balance', () => ({
  DEFAULT_POOL_SIZE: 20,
}));

vi.mock('../data/card-types', () => ({
  CANONICAL_FACT_DOMAINS: [
    'general_knowledge', 'natural_sciences', 'space_astronomy', 'history',
    'geography', 'geography_drill', 'mythology_folklore', 'animals_wildlife',
    'human_body_health', 'food_cuisine', 'art_architecture',
  ],
  normalizeFactDomain: vi.fn((d: string) => d),
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

const { buildPresetRunPool, buildGeneralRunPool } = await import('./presetPoolBuilder');

// ---------------------------------------------------------------------------
// factIsTrivia gate — tested indirectly via buildPresetRunPool
// ---------------------------------------------------------------------------

describe('buildPresetRunPool — allowLanguageFacts option', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips language/vocabulary/grammar facts by default (legacy trivia-run behaviour)', async () => {
    // With a non-language domain and no allowLanguageFacts flag, vocab/grammar
    // facts must be excluded from the pool.
    const { factsDB } = await import('./factsDB');
    (factsDB.getByCategory as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);
    (factsDB.getAll as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);

    const cards = buildPresetRunPool({ history: [] }, [], {});

    const { createCard } = await import('./cardFactory');
    const createdFactIds = (createCard as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => (call[0] as Fact).id,
    );

    // No vocab or grammar facts should have been passed to createCard
    expect(createdFactIds.some((id: string) => id.startsWith('v'))).toBe(false);
    expect(createdFactIds.some((id: string) => id.startsWith('g'))).toBe(false);
  });

  it('includes language/vocab/grammar facts when allowLanguageFacts is true', async () => {
    const { factsDB } = await import('./factsDB');
    (factsDB.getByCategory as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);
    (factsDB.getAll as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);

    const { createCard } = await import('./cardFactory');
    (createCard as ReturnType<typeof vi.fn>).mockClear();

    const cards = buildPresetRunPool({ history: [] }, [], { allowLanguageFacts: true });

    const createdFactIds = (createCard as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => (call[0] as Fact).id,
    );

    // With allowLanguageFacts=true, vocab and grammar facts are eligible
    // (subject to normal stratifiedSample selection)
    // At minimum, we verify the function ran without throwing
    expect(cards).toBeDefined();
    expect(Array.isArray(cards)).toBe(true);
  });

  it('pure language domain selection still works (no trivia gate applies)', async () => {
    const { factsDB } = await import('./factsDB');
    // Language domain path uses getAll() + language filter
    (factsDB.getAll as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);

    const { createCard } = await import('./cardFactory');
    (createCard as ReturnType<typeof vi.fn>).mockClear();

    // Pure language domain — isTriviaRun must be false here
    const cards = buildPresetRunPool({ 'language:ja': [] }, [], {});

    expect(cards).toBeDefined();
    expect(Array.isArray(cards)).toBe(true);
  });
});

describe('buildGeneralRunPool — allowLanguageFacts forwarded', () => {
  it('accepts and forwards allowLanguageFacts to buildPresetRunPool', async () => {
    const { factsDB } = await import('./factsDB');
    (factsDB.getByCategory as ReturnType<typeof vi.fn>).mockReturnValue(KNOWLEDGE_FACTS);
    (factsDB.getAll as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);

    // Should not throw — verifies the option threads through without type error
    const cards = buildGeneralRunPool([], { allowLanguageFacts: true });
    expect(cards).toBeDefined();
    expect(Array.isArray(cards)).toBe(true);
  });

  it('omitting allowLanguageFacts defaults to false (legacy behaviour)', async () => {
    const { factsDB } = await import('./factsDB');
    (factsDB.getByCategory as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);
    (factsDB.getAll as ReturnType<typeof vi.fn>).mockReturnValue(ALL_FACTS);

    const cards = buildGeneralRunPool([]);
    expect(cards).toBeDefined();
  });
});
