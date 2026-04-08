/**
 * Unit tests for the Chain Distribution Engine.
 * Covers TopicGroup extraction (all 3 waterfall paths), FSRS classification,
 * LPT bin-packing, edge cases (0/1/2 groups), determinism, and proportional
 * POS merge threshold for large multi-deck pools.
 */

import { describe, it, expect } from 'vitest';
import {
  extractTopicGroups,
  distributeTopicGroups,
  extractTopicGroupsMultiDeck,
  type TopicGroup,
} from './chainDistribution';
import type { CuratedDeck, DeckFact } from '../data/curatedDeckTypes';
import type { ReviewState } from '../data/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeFact(id: string, overrides: Partial<DeckFact> = {}): DeckFact {
  return {
    id,
    correctAnswer: id,
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'pool_main',
    difficulty: 3,
    funScore: 5,
    quizQuestion: `Q: ${id}`,
    explanation: '',
    visualDescription: '',
    sourceName: 'test',
    distractors: ['A', 'B', 'C', 'D'],
    ...overrides,
  };
}

function makeDeck(
  id: string,
  facts: DeckFact[],
  subDecks?: Array<{ id: string; name: string; factIds?: string[]; chainThemeId?: number }>,
): CuratedDeck & { subDecks?: Array<{ id: string; name: string; factIds?: string[]; chainThemeId?: number }> } {
  return {
    id,
    name: id,
    domain: 'history',
    description: '',
    minimumFacts: 1,
    targetFacts: facts.length,
    facts,
    answerTypePools: [],
    synonymGroups: [],
    questionTemplates: [],
    difficultyTiers: [],
    ...(subDecks ? { subDecks } : {}),
  };
}

function makeReviewState(factId: string, overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    factId,
    cardState: 'new',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: Date.now(),
    lastReviewAt: Date.now(),
    quality: 0,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    ...overrides,
  };
}

const RUN_CHAINS = [0, 2, 4]; // example 3 chain types
const SEED = 42;

// ---------------------------------------------------------------------------
// 1. Sub-deck extraction
// ---------------------------------------------------------------------------

describe('extractTopicGroups – sub-deck path', () => {
  it('creates one TopicGroup per sub-deck with correct factIds and label', () => {
    const facts = [
      makeFact('f1'), makeFact('f2'), makeFact('f3'),
      makeFact('f4'), makeFact('f5'), makeFact('f6'),
    ];
    const deck = makeDeck('d1', facts, [
      { id: 'sd1', name: 'Ancient Wonders', factIds: ['f1', 'f2'] },
      { id: 'sd2', name: 'Medieval Castles', factIds: ['f3', 'f4'] },
      { id: 'sd3', name: 'Modern Marvels',  factIds: ['f5', 'f6'] },
    ]);

    const groups = extractTopicGroups(deck, ['f1','f2','f3','f4','f5','f6'], []);

    expect(groups).toHaveLength(3);
    expect(groups.map(g => g.id)).toEqual(['sd1', 'sd2', 'sd3']);
    expect(groups.map(g => g.label)).toEqual(['Ancient Wonders', 'Medieval Castles', 'Modern Marvels']);
    expect(groups[0].factIds).toEqual(['f1', 'f2']);
    expect(groups[1].factIds).toEqual(['f3', 'f4']);
  });

  it('filters sub-deck factIds to only those in the run pool', () => {
    const facts = [makeFact('f1'), makeFact('f2'), makeFact('f3'), makeFact('f4')];
    const deck = makeDeck('d1', facts, [
      { id: 'sd1', name: 'Group A', factIds: ['f1', 'f2'] },
      { id: 'sd2', name: 'Group B', factIds: ['f3', 'f4'] },
    ]);

    // Only f1 and f3 are in the run pool
    const groups = extractTopicGroups(deck, ['f1', 'f3'], []);

    expect(groups).toHaveLength(2);
    expect(groups[0].factIds).toEqual(['f1']);
    expect(groups[1].factIds).toEqual(['f3']);
  });

  it('skips sub-decks that have no facts in the run pool', () => {
    const facts = [makeFact('f1'), makeFact('f2'), makeFact('f3')];
    const deck = makeDeck('d1', facts, [
      { id: 'sd1', name: 'Group A', factIds: ['f1', 'f2'] },
      { id: 'sd2', name: 'Group B', factIds: ['f3'] },
    ]);

    // Sub-deck 2's only fact is not in pool
    const groups = extractTopicGroups(deck, ['f1', 'f2'], []);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('sd1');
  });
});

// ---------------------------------------------------------------------------
// 1b. Sub-deck extraction — chainThemeId fallback (Fix: sub-decks without factIds)
// ---------------------------------------------------------------------------

describe('extractTopicGroups – sub-deck chainThemeId path', () => {
  it('uses sub-deck names when sub-decks have chainThemeId but no factIds (e.g. ancient_greece)', () => {
    // Simulate ancient_greece: subDecks have chainThemeId but no factIds array.
    // Facts carry chainThemeId that matches sub-deck.
    const facts = [
      makeFact('city_1', { chainThemeId: 0 }),
      makeFact('city_2', { chainThemeId: 0 }),
      makeFact('war_1',  { chainThemeId: 1 }),
      makeFact('war_2',  { chainThemeId: 1 }),
      makeFact('gold_1', { chainThemeId: 2 }),
    ];
    const deck = makeDeck('ancient_greece', facts, [
      { id: 'city_states',       name: 'City-States: Athens vs Sparta', chainThemeId: 0 },
      { id: 'persian_wars',      name: 'Persian Wars',                  chainThemeId: 1 },
      { id: 'golden_age_athens', name: 'Golden Age of Athens',          chainThemeId: 2 },
    ]);

    const groups = extractTopicGroups(deck, ['city_1','city_2','war_1','war_2','gold_1'], []);

    expect(groups).toHaveLength(3);
    // Groups should use the real sub-deck names, not generic 'Group N' labels
    expect(groups.map(g => g.label)).toEqual([
      'City-States: Athens vs Sparta',
      'Persian Wars',
      'Golden Age of Athens',
    ]);
    expect(groups.map(g => g.id)).toEqual(['city_states', 'persian_wars', 'golden_age_athens']);
    expect(groups.find(g => g.id === 'city_states')!.factIds).toEqual(['city_1', 'city_2']);
    expect(groups.find(g => g.id === 'persian_wars')!.factIds).toEqual(['war_1', 'war_2']);
    expect(groups.find(g => g.id === 'golden_age_athens')!.factIds).toEqual(['gold_1']);
  });

  it('filters chainThemeId-matched facts to run pool subset', () => {
    const facts = [
      makeFact('f1', { chainThemeId: 0 }),
      makeFact('f2', { chainThemeId: 0 }),
      makeFact('f3', { chainThemeId: 1 }),
    ];
    const deck = makeDeck('d1', facts, [
      { id: 'sd1', name: 'Group Alpha', chainThemeId: 0 },
      { id: 'sd2', name: 'Group Beta',  chainThemeId: 1 },
    ]);

    // Only f1 and f3 in run pool (f2 excluded)
    const groups = extractTopicGroups(deck, ['f1', 'f3'], []);

    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.id === 'sd1')!.factIds).toEqual(['f1']);
    expect(groups.find(g => g.id === 'sd2')!.factIds).toEqual(['f3']);
  });

  it('skips chainThemeId sub-decks with no facts in run pool', () => {
    const facts = [
      makeFact('f1', { chainThemeId: 0 }),
      makeFact('f2', { chainThemeId: 1 }),
    ];
    const deck = makeDeck('d1', facts, [
      { id: 'sd1', name: 'Sub A', chainThemeId: 0 },
      { id: 'sd2', name: 'Sub B', chainThemeId: 1 },
    ]);

    // Sub B has no facts in pool
    const groups = extractTopicGroups(deck, ['f1'], []);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('sd1');
    expect(groups[0].label).toBe('Sub A');
  });

  it('does NOT fall through to generic Group N labels when chainThemeId sub-decks exist', () => {
    // This is the regression test: before the fix, sub-decks without factIds
    // produced 0 results from Priority 1, causing Priority 3 to generate
    // 'Group 1', 'Group 2' etc. instead of real sub-deck names.
    const facts = [
      makeFact('a', { chainThemeId: 0 }),
      makeFact('b', { chainThemeId: 1 }),
      makeFact('c', { chainThemeId: 2 }),
    ];
    const deck = makeDeck('d1', facts, [
      { id: 'sd_0', name: 'Real Name 0', chainThemeId: 0 },
      { id: 'sd_1', name: 'Real Name 1', chainThemeId: 1 },
      { id: 'sd_2', name: 'Real Name 2', chainThemeId: 2 },
    ]);

    const groups = extractTopicGroups(deck, ['a', 'b', 'c'], []);

    // Must NOT see generic labels
    for (const g of groups) {
      expect(g.label).not.toMatch(/^Group \d+$/);
    }
    // Must see real sub-deck names
    expect(groups.map(g => g.label)).toContain('Real Name 0');
    expect(groups.map(g => g.label)).toContain('Real Name 1');
    expect(groups.map(g => g.label)).toContain('Real Name 2');
  });
});

// ---------------------------------------------------------------------------
// 2. POS extraction
// ---------------------------------------------------------------------------

describe('extractTopicGroups – POS path', () => {
  it('groups facts by partOfSpeech when no subDecks present', () => {
    const facts = [
      makeFact('n1', { partOfSpeech: 'noun' }),
      makeFact('n2', { partOfSpeech: 'noun' }),
      makeFact('n3', { partOfSpeech: 'noun' }),
      makeFact('n4', { partOfSpeech: 'noun' }),
      makeFact('n5', { partOfSpeech: 'noun' }),
      makeFact('v1', { partOfSpeech: 'verb' }),
      makeFact('v2', { partOfSpeech: 'verb' }),
      makeFact('v3', { partOfSpeech: 'verb' }),
      makeFact('v4', { partOfSpeech: 'verb' }),
      makeFact('v5', { partOfSpeech: 'verb' }),
    ];
    const deck = makeDeck('d1', facts);
    const allIds = facts.map(f => f.id);

    const groups = extractTopicGroups(deck, allIds, []);

    expect(groups.length).toBeGreaterThanOrEqual(2);
    const nouns = groups.find(g => g.id === 'pos_noun');
    const verbs = groups.find(g => g.id === 'pos_verb');
    expect(nouns).toBeDefined();
    expect(verbs).toBeDefined();
    expect(nouns!.factIds).toHaveLength(5);
    expect(nouns!.label).toBe('Nouns');
    expect(verbs!.label).toBe('Verbs');
  });

  it('merges POS groups with fewer than 5 facts into Other', () => {
    const facts = [
      makeFact('n1', { partOfSpeech: 'noun' }),
      makeFact('n2', { partOfSpeech: 'noun' }),
      makeFact('n3', { partOfSpeech: 'noun' }),
      makeFact('n4', { partOfSpeech: 'noun' }),
      makeFact('n5', { partOfSpeech: 'noun' }),
      makeFact('p1', { partOfSpeech: 'particle' }),  // < 5
      makeFact('p2', { partOfSpeech: 'particle' }),  // < 5
    ];
    const deck = makeDeck('d1', facts);
    const allIds = facts.map(f => f.id);

    const groups = extractTopicGroups(deck, allIds, []);

    const nouns = groups.find(g => g.id === 'pos_noun');
    const particles = groups.find(g => g.id === 'pos_particle');
    const other = groups.find(g => g.id === 'pos_other');
    expect(nouns).toBeDefined();
    expect(particles).toBeUndefined(); // merged into Other
    expect(other).toBeDefined();
    expect(other!.factIds).toHaveLength(2);
    expect(other!.label).toBe('Other');
  });

  it('uses proportional MIN_POS_GROUP for large pools (3% threshold)', () => {
    // With 400 facts, threshold = max(5, floor(400 * 0.03)) = max(5, 12) = 12.
    // A group with 10 facts should be merged into Other even though 10 > 5.
    // Build: 380 nouns, 10 particles. Pool size = 390 (nouns + particles).
    // Threshold = max(5, floor(390 * 0.03)) = max(5, 11) = 11.
    // Particles (10) < 11 → merged into Other.
    const nounFacts = Array.from({ length: 380 }, (_, i) => makeFact(`n${i}`, { partOfSpeech: 'noun' }));
    const particleFacts = Array.from({ length: 10 }, (_, i) => makeFact(`p${i}`, { partOfSpeech: 'particle' }));
    const facts = [...nounFacts, ...particleFacts];
    const deck = makeDeck('large_pool', facts);
    const allIds = facts.map(f => f.id);

    const groups = extractTopicGroups(deck, allIds, []);

    // particles group should be merged into Other because 10 < floor(390 * 0.03) = 11
    const particles = groups.find(g => g.id === 'pos_particle');
    const other = groups.find(g => g.id === 'pos_other');
    expect(particles).toBeUndefined(); // merged into Other for large pool
    expect(other).toBeDefined();
    // All 390 facts must still be accounted for
    const total = groups.reduce((s, g) => s + g.factIds.length, 0);
    expect(total).toBe(390);
  });

  it('still uses minimum threshold of 5 for small pools where 3% < 5', () => {
    // With 10 facts, threshold = max(5, floor(10 * 0.03)) = max(5, 0) = 5.
    // A group with exactly 5 facts should NOT be merged.
    const nounFacts = Array.from({ length: 5 }, (_, i) => makeFact(`n${i}`, { partOfSpeech: 'noun' }));
    const verbFacts = Array.from({ length: 5 }, (_, i) => makeFact(`v${i}`, { partOfSpeech: 'verb' }));
    const facts = [...nounFacts, ...verbFacts];
    const deck = makeDeck('small_pool', facts);
    const allIds = facts.map(f => f.id);

    const groups = extractTopicGroups(deck, allIds, []);

    const nouns = groups.find(g => g.id === 'pos_noun');
    const verbs = groups.find(g => g.id === 'pos_verb');
    expect(nouns).toBeDefined(); // 5 >= threshold of 5, not merged
    expect(verbs).toBeDefined(); // 5 >= threshold of 5, not merged
  });
});

// ---------------------------------------------------------------------------
// 3. ChainThemeId fallback
// ---------------------------------------------------------------------------

describe('extractTopicGroups – chainThemeId fallback', () => {
  it('falls back to chainThemeId groups when no subDecks or partOfSpeech', () => {
    const facts = [
      makeFact('f1', { chainThemeId: 0 }),
      makeFact('f2', { chainThemeId: 0 }),
      makeFact('f3', { chainThemeId: 1 }),
      makeFact('f4', { chainThemeId: 2 }),
    ];
    const deck = makeDeck('d1', facts);
    const allIds = facts.map(f => f.id);

    const groups = extractTopicGroups(deck, allIds, []);

    expect(groups.length).toBe(3); // 3 distinct chainThemeIds
    const theme0 = groups.find(g => g.id === 'theme_0');
    expect(theme0).toBeDefined();
    expect(theme0!.factIds).toHaveLength(2);
    // Labels are prefixed with deck name
    expect(groups.map(g => g.label)).toContain('d1 Group 1');
  });
});

// ---------------------------------------------------------------------------
// 4. FSRS summary counts
// ---------------------------------------------------------------------------

describe('extractTopicGroups – FSRS summary', () => {
  it('counts new/learning/review/mastered correctly from review states', () => {
    const facts = [
      makeFact('f1'), makeFact('f2'), makeFact('f3'), makeFact('f4'), makeFact('f5'),
    ];
    const deck = makeDeck('d1', facts, [
      { id: 'sd1', name: 'Test Sub', factIds: ['f1','f2','f3','f4','f5'] },
    ]);

    const reviewStates: ReviewState[] = [
      // f1: no state → new (handled by absence)
      makeReviewState('f2', { cardState: 'learning' }),
      makeReviewState('f3', { cardState: 'review' }),
      makeReviewState('f4', { cardState: 'review', stability: 31 }), // mastered (stability > 30)
      makeReviewState('f5', { cardState: 'review', masteredAt: Date.now() }), // mastered
    ];

    const groups = extractTopicGroups(deck, ['f1','f2','f3','f4','f5'], reviewStates);

    expect(groups).toHaveLength(1);
    const fsrs = groups[0].fsrs;
    expect(fsrs.new).toBe(1);      // f1 has no review state
    expect(fsrs.learning).toBe(1); // f2
    expect(fsrs.review).toBe(1);   // f3
    expect(fsrs.mastered).toBe(2); // f4, f5
  });

  it('treats facts with no review state as new', () => {
    const facts = [makeFact('x1'), makeFact('x2')];
    const deck = makeDeck('d1', facts, [
      { id: 's1', name: 'All New', factIds: ['x1', 'x2'] },
    ]);

    const groups = extractTopicGroups(deck, ['x1', 'x2'], []);

    expect(groups[0].fsrs.new).toBe(2);
    expect(groups[0].fsrs.learning).toBe(0);
    expect(groups[0].fsrs.review).toBe(0);
    expect(groups[0].fsrs.mastered).toBe(0);
  });

  it('treats relearning state as learning', () => {
    const facts = [makeFact('r1')];
    const deck = makeDeck('d1', facts, [{ id: 's1', name: 'S', factIds: ['r1'] }]);
    const reviewStates = [makeReviewState('r1', { cardState: 'relearning' })];

    const groups = extractTopicGroups(deck, ['r1'], reviewStates);
    expect(groups[0].fsrs.learning).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Distribution balance
// ---------------------------------------------------------------------------

describe('distributeTopicGroups – balance', () => {
  it('distributes 6 groups within 20% of mean load across 3 chains', () => {
    // Create 6 groups with varying FSRS loads
    const groups: TopicGroup[] = [
      { id: 'g1', label: 'G1', deckId: 'd1', factIds: ['f1','f2','f3','f4','f5'],
        fsrs: { new: 10, learning: 0, review: 0, mastered: 0 } },   // load 30
      { id: 'g2', label: 'G2', deckId: 'd1', factIds: ['f6','f7'],
        fsrs: { new: 0, learning: 5, review: 0, mastered: 0 } },     // load 10
      { id: 'g3', label: 'G3', deckId: 'd1', factIds: ['f8','f9'],
        fsrs: { new: 5, learning: 5, review: 0, mastered: 0 } },     // load 25
      { id: 'g4', label: 'G4', deckId: 'd1', factIds: ['f10'],
        fsrs: { new: 0, learning: 0, review: 8, mastered: 0 } },     // load 8
      { id: 'g5', label: 'G5', deckId: 'd1', factIds: ['f11','f12'],
        fsrs: { new: 0, learning: 3, review: 3, mastered: 0 } },     // load 9
      { id: 'g6', label: 'G6', deckId: 'd1', factIds: ['f13','f14'],
        fsrs: { new: 4, learning: 0, review: 0, mastered: 4 } },     // load 14
    ];

    const dist = distributeTopicGroups(groups, RUN_CHAINS, SEED);

    // Compute actual bin loads
    function binLoad(bin: TopicGroup[]): number {
      return bin.reduce((s, g) => s + g.fsrs.new * 3 + g.fsrs.learning * 2 + g.fsrs.review + g.fsrs.mastered * 0.5, 0);
    }
    const loads = dist.assignments.map(binLoad);
    const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
    for (const l of loads) {
      // Each bin should be within 40% of mean (LPT gives good but not perfect balance)
      expect(Math.abs(l - mean) / mean).toBeLessThan(0.4);
    }
  });

  it('every factId appears exactly once in factToChain', () => {
    const groups: TopicGroup[] = [
      { id: 'g1', label: 'G1', deckId: 'd1', factIds: ['a','b','c'],
        fsrs: { new: 3, learning: 0, review: 0, mastered: 0 } },
      { id: 'g2', label: 'G2', deckId: 'd1', factIds: ['d','e'],
        fsrs: { new: 2, learning: 0, review: 0, mastered: 0 } },
      { id: 'g3', label: 'G3', deckId: 'd1', factIds: ['f'],
        fsrs: { new: 1, learning: 0, review: 0, mastered: 0 } },
    ];

    const dist = distributeTopicGroups(groups, RUN_CHAINS, SEED);

    expect(dist.factToChain.size).toBe(6);
    for (const fid of ['a','b','c','d','e','f']) {
      expect(dist.factToChain.has(fid)).toBe(true);
      expect(RUN_CHAINS).toContain(dist.factToChain.get(fid));
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Edge case: 1 group → must split into 3
// ---------------------------------------------------------------------------

describe('distributeTopicGroups – edge case: 1 group', () => {
  it('splits a single group into 3 chains without throwing', () => {
    const groups: TopicGroup[] = [
      {
        id: 'only',
        label: 'Only Group',
        deckId: 'd1',
        factIds: ['f1','f2','f3','f4','f5','f6','f7','f8','f9'],
        fsrs: { new: 9, learning: 0, review: 0, mastered: 0 },
      },
    ];

    const dist = distributeTopicGroups(groups, RUN_CHAINS, SEED);

    // All 3 chains should have at least some assignments
    const nonEmpty = dist.assignments.filter(a => a.length > 0);
    expect(nonEmpty.length).toBe(3);
    // All factIds should be covered
    expect(dist.factToChain.size).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// 7. Edge case: 2 groups → must split largest to make 3
// ---------------------------------------------------------------------------

describe('distributeTopicGroups – edge case: 2 groups', () => {
  it('ensures all 3 chains are populated when only 2 groups provided', () => {
    const groups: TopicGroup[] = [
      {
        id: 'g1',
        label: 'Big Group',
        deckId: 'd1',
        factIds: ['a','b','c','d','e','f'],
        fsrs: { new: 6, learning: 0, review: 0, mastered: 0 },
      },
      {
        id: 'g2',
        label: 'Small Group',
        deckId: 'd1',
        factIds: ['x','y'],
        fsrs: { new: 2, learning: 0, review: 0, mastered: 0 },
      },
    ];

    const dist = distributeTopicGroups(groups, RUN_CHAINS, SEED);

    const nonEmpty = dist.assignments.filter(a => a.length > 0);
    expect(nonEmpty.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 8. Edge case: empty factIds
// ---------------------------------------------------------------------------

describe('distributeTopicGroups – edge case: empty factIds', () => {
  it('returns empty assignments without throwing when groups array is empty', () => {
    const dist = distributeTopicGroups([], RUN_CHAINS, SEED);

    expect(dist.assignments[0]).toHaveLength(0);
    expect(dist.assignments[1]).toHaveLength(0);
    expect(dist.assignments[2]).toHaveLength(0);
    expect(dist.factToChain.size).toBe(0);
    expect(dist.runChainTypes).toEqual(RUN_CHAINS);
  });

  it('handles extractTopicGroups gracefully with empty factIds array', () => {
    const facts = [makeFact('f1'), makeFact('f2')];
    const deck = makeDeck('d1', facts, [
      { id: 's1', name: 'Sub', factIds: ['f1', 'f2'] },
    ]);

    const groups = extractTopicGroups(deck, [], []);
    // All sub-decks filtered to empty → all skipped
    expect(groups).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Determinism: same seed → same distribution
// ---------------------------------------------------------------------------

describe('distributeTopicGroups – determinism', () => {
  const groups: TopicGroup[] = [
    { id: 'g1', label: 'G1', deckId: 'd1', factIds: ['a','b','c'],
      fsrs: { new: 3, learning: 1, review: 0, mastered: 0 } },
    { id: 'g2', label: 'G2', deckId: 'd1', factIds: ['d','e','f'],
      fsrs: { new: 2, learning: 0, review: 2, mastered: 0 } },
    { id: 'g3', label: 'G3', deckId: 'd1', factIds: ['g','h','i'],
      fsrs: { new: 0, learning: 0, review: 1, mastered: 3 } },
    { id: 'g4', label: 'G4', deckId: 'd1', factIds: ['j','k'],
      fsrs: { new: 1, learning: 1, review: 0, mastered: 0 } },
    { id: 'g5', label: 'G5', deckId: 'd1', factIds: ['l'],
      fsrs: { new: 0, learning: 0, review: 0, mastered: 1 } },
    { id: 'g6', label: 'G6', deckId: 'd1', factIds: ['m','n','o','p'],
      fsrs: { new: 4, learning: 0, review: 0, mastered: 0 } },
  ];

  it('produces identical assignments for the same seed', () => {
    const d1 = distributeTopicGroups(groups, RUN_CHAINS, 12345);
    const d2 = distributeTopicGroups(groups, RUN_CHAINS, 12345);

    for (let i = 0; i < 3; i++) {
      expect(d1.assignments[i].map(g => g.id)).toEqual(d2.assignments[i].map(g => g.id));
    }
    // factToChain maps should be identical
    for (const [fid, chainIdx] of d1.factToChain) {
      expect(d2.factToChain.get(fid)).toBe(chainIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Different seeds → different distribution (probabilistic check)
// ---------------------------------------------------------------------------

describe('distributeTopicGroups – seed variety', () => {
  it('produces different assignments for different seeds (for most inputs)', () => {
    // Build groups with 6 equal-load groups (all ties) so seed shuffling matters
    const equalGroups: TopicGroup[] = Array.from({ length: 6 }, (_, i) => ({
      id: `g${i}`,
      label: `G${i}`,
      deckId: 'd1',
      factIds: [`f${i}`],
      fsrs: { new: 1, learning: 0, review: 0, mastered: 0 }, // identical load = pure shuffle
    }));

    const seeds = [1, 999, 123456, 0xDEADBEEF, 7];
    const results = seeds.map(s =>
      distributeTopicGroups(equalGroups, RUN_CHAINS, s).assignments
        .map(bin => bin.map(g => g.id).join(','))
        .join('|'),
    );
    // At least some seeds should produce different results
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 11. Multi-deck extraction
// ---------------------------------------------------------------------------

describe('extractTopicGroupsMultiDeck', () => {
  it('pools groups from all decks', () => {
    const facts1 = [makeFact('d1f1'), makeFact('d1f2')];
    const facts2 = [makeFact('d2f1'), makeFact('d2f2')];
    const deck1 = makeDeck('deck1', facts1, [
      { id: 'sd_a', name: 'Deck1 Sub', factIds: ['d1f1', 'd1f2'] },
    ]);
    const deck2 = makeDeck('deck2', facts2, [
      { id: 'sd_b', name: 'Deck2 Sub', factIds: ['d2f1', 'd2f2'] },
    ]);

    const groups = extractTopicGroupsMultiDeck(
      [deck1, deck2],
      ['d1f1', 'd1f2', 'd2f1', 'd2f2'],
      [],
    );

    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.deckId)).toContain('deck1');
    expect(groups.map(g => g.deckId)).toContain('deck2');
  });

  it('combines all facts from multiple decks for language aggregates', () => {
    // Simulate all:chinese merging hsk1 (3 facts) + hsk2 (3 facts) + hsk3 (3 facts)
    const hsk1 = makeDeck('chinese_hsk1', [
      makeFact('zh1_1', { partOfSpeech: 'noun' }),
      makeFact('zh1_2', { partOfSpeech: 'noun' }),
      makeFact('zh1_3', { partOfSpeech: 'verb' }),
    ]);
    const hsk2 = makeDeck('chinese_hsk2', [
      makeFact('zh2_1', { partOfSpeech: 'noun' }),
      makeFact('zh2_2', { partOfSpeech: 'verb' }),
      makeFact('zh2_3', { partOfSpeech: 'verb' }),
    ]);
    const hsk3 = makeDeck('chinese_hsk3', [
      makeFact('zh3_1', { partOfSpeech: 'adjective' }),
      makeFact('zh3_2', { partOfSpeech: 'adjective' }),
      makeFact('zh3_3', { partOfSpeech: 'adjective' }),
    ]);

    const allFactIds = [...hsk1.facts, ...hsk2.facts, ...hsk3.facts].map(f => f.id);
    const groups = extractTopicGroupsMultiDeck([hsk1, hsk2, hsk3], allFactIds, []);

    // All 9 facts should appear in groups
    const totalInGroups = groups.reduce((s, g) => s + g.factIds.length, 0);
    expect(totalInGroups).toBe(9);

    // Groups come from all three decks
    const deckIds = new Set(groups.map(g => g.deckId));
    expect(deckIds.has('chinese_hsk1')).toBe(true);
    expect(deckIds.has('chinese_hsk2')).toBe(true);
    expect(deckIds.has('chinese_hsk3')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. No facts silently dropped (invariant tests)
// ---------------------------------------------------------------------------

describe('no facts silently dropped', () => {
  it('POS grouping includes facts without partOfSpeech field', () => {
    // Create a deck where 50% of facts have POS and 50% don't.
    // This replicates Chinese/Spanish decks that mix POS-tagged and untagged facts.
    const facts = [
      // Facts WITH partOfSpeech
      makeFact('f1', { partOfSpeech: 'noun' }),
      makeFact('f2', { partOfSpeech: 'noun' }),
      makeFact('f3', { partOfSpeech: 'noun' }),
      makeFact('f4', { partOfSpeech: 'noun' }),
      makeFact('f5', { partOfSpeech: 'noun' }),
      makeFact('f6', { partOfSpeech: 'verb' }),
      makeFact('f7', { partOfSpeech: 'verb' }),
      makeFact('f8', { partOfSpeech: 'verb' }),
      makeFact('f9', { partOfSpeech: 'verb' }),
      makeFact('f10', { partOfSpeech: 'verb' }),
      // Facts WITHOUT partOfSpeech
      makeFact('f11'),
      makeFact('f12'),
      makeFact('f13'),
      makeFact('f14'),
      makeFact('f15'),
      makeFact('f16'),
      makeFact('f17'),
      makeFact('f18'),
    ];
    const allIds = facts.map(f => f.id);
    const deck = makeDeck('mixed_pos', facts);
    const groups = extractTopicGroups(deck, allIds, []);

    // ALL 18 facts must appear in groups — no silent drops
    const totalInGroups = groups.reduce((s, g) => s + g.factIds.length, 0);
    expect(totalInGroups).toBe(18);

    // Every factId must appear exactly once
    const allGroupedIds = groups.flatMap(g => g.factIds);
    expect(new Set(allGroupedIds).size).toBe(18);
    for (const id of allIds) {
      expect(allGroupedIds).toContain(id);
    }
  });

  it('POS grouping with small named groups still captures ungrouped facts', () => {
    // 4 nouns (< MIN_POS_GROUP=5 so merged into Other), plus facts without POS.
    // Ungrouped facts should land in the Other bucket.
    const facts = [
      makeFact('n1', { partOfSpeech: 'noun' }),
      makeFact('n2', { partOfSpeech: 'noun' }),
      makeFact('n3', { partOfSpeech: 'noun' }),
      makeFact('n4', { partOfSpeech: 'noun' }),
      makeFact('v1', { partOfSpeech: 'verb' }),
      makeFact('v2', { partOfSpeech: 'verb' }),
      makeFact('v3', { partOfSpeech: 'verb' }),
      makeFact('v4', { partOfSpeech: 'verb' }),
      makeFact('v5', { partOfSpeech: 'verb' }),
      // No partOfSpeech
      makeFact('x1'),
      makeFact('x2'),
    ];
    const allIds = facts.map(f => f.id);
    const deck = makeDeck('mixed_pos_small', facts);
    const groups = extractTopicGroups(deck, allIds, []);

    const totalInGroups = groups.reduce((s, g) => s + g.factIds.length, 0);
    expect(totalInGroups).toBe(11);

    const allGroupedIds = groups.flatMap(g => g.factIds);
    expect(new Set(allGroupedIds).size).toBe(11);
  });

  it('distributeTopicGroups output contains all input facts', () => {
    const groups: TopicGroup[] = [
      { id: 'g1', label: 'A', deckId: 'd', factIds: ['f1', 'f2', 'f3'],
        fsrs: { new: 3, learning: 0, review: 0, mastered: 0 } },
      { id: 'g2', label: 'B', deckId: 'd', factIds: ['f4', 'f5'],
        fsrs: { new: 2, learning: 0, review: 0, mastered: 0 } },
    ];
    const dist = distributeTopicGroups(groups, [0, 2, 4], 42);
    expect(dist.factToChain.size).toBe(5);
    for (const fid of ['f1', 'f2', 'f3', 'f4', 'f5']) {
      expect(dist.factToChain.has(fid)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Fallback group labels — deck name prefix
// ---------------------------------------------------------------------------

describe('extractTopicGroups – fallback group label prefix', () => {
  it('prefixes fallback group labels with deck name', () => {
    // A deck with no subDecks and no partOfSpeech falls back to chainThemeId grouping.
    // Each group label should be "DeckName Group N", not bare "Group N".
    const facts = [
      makeFact('f1', { chainThemeId: 0 }),
      makeFact('f2', { chainThemeId: 0 }),
      makeFact('f3', { chainThemeId: 1 }),
    ];
    const deck = makeDeck('Japanese N5', facts); // makeDeck sets name = id

    const groups = extractTopicGroups(deck, ['f1', 'f2', 'f3'], []);

    expect(groups).toHaveLength(2);
    // Labels must be prefixed with deck name
    for (const g of groups) {
      expect(g.label).toMatch(/^Japanese N5 Group \d+$/);
    }
    // Should not use bare "Group N"
    for (const g of groups) {
      expect(g.label).not.toMatch(/^Group \d+$/);
    }
  });

  it('uses the numeric suffix 1, 2, 3... per distinct chainThemeId bucket', () => {
    const facts = [
      makeFact('a', { chainThemeId: 5 }),
      makeFact('b', { chainThemeId: 10 }),
      makeFact('c', { chainThemeId: 20 }),
    ];
    const deck = makeDeck('My Deck', facts); // makeDeck sets name = id

    const groups = extractTopicGroups(deck, ['a', 'b', 'c'], []);

    expect(groups).toHaveLength(3);
    const labels = groups.map(g => g.label).sort();
    expect(labels).toEqual(['My Deck Group 1', 'My Deck Group 2', 'My Deck Group 3']);
  });
});

// ---------------------------------------------------------------------------
// 8. Multi-deck collision disambiguation
// ---------------------------------------------------------------------------

describe('extractTopicGroupsMultiDeck – collision disambiguation', () => {
  it('disambiguates colliding subDeck names from different decks with deck prefix', () => {
    // Two decks both have a sub-deck named "Vocabulary".
    // After multi-deck extraction, both groups share the label "Vocabulary".
    // The disambiguation pass should prefix them with their source deck name.
    const deck1Facts = [makeFact('d1f1'), makeFact('d1f2'), makeFact('d1f3')];
    const deck2Facts = [makeFact('d2f1'), makeFact('d2f2'), makeFact('d2f3')];

    const deck1 = makeDeck('deck_alpha', deck1Facts, [
      { id: 'vocab_a', name: 'Vocabulary', factIds: ['d1f1', 'd1f2', 'd1f3'] },
    ]);

    const deck2 = makeDeck('deck_beta', deck2Facts, [
      { id: 'vocab_b', name: 'Vocabulary', factIds: ['d2f1', 'd2f2', 'd2f3'] },
    ]);

    const allFactIds = [...deck1Facts, ...deck2Facts].map(f => f.id);
    const groups = extractTopicGroupsMultiDeck([deck1, deck2], allFactIds, []);

    // Both source groups had "Vocabulary" — they should now be prefixed
    const labels = groups.map(g => g.label);
    expect(labels).not.toContain('Vocabulary'); // bare label should be gone
    expect(labels).toContain('deck_alpha: Vocabulary');
    expect(labels).toContain('deck_beta: Vocabulary');
  });

  it('does NOT prefix labels that are unique across decks', () => {
    // Deck 1 has "Nouns", deck 2 has "Grammar". No collision — no prefix.
    const deck1Facts = [
      makeFact('n1', { partOfSpeech: 'noun' }),
      makeFact('n2', { partOfSpeech: 'noun' }),
      makeFact('n3', { partOfSpeech: 'noun' }),
      makeFact('n4', { partOfSpeech: 'noun' }),
      makeFact('n5', { partOfSpeech: 'noun' }),
    ];
    const deck2Facts = [
      makeFact('g1', { partOfSpeech: 'grammar' }),
      makeFact('g2', { partOfSpeech: 'grammar' }),
      makeFact('g3', { partOfSpeech: 'grammar' }),
      makeFact('g4', { partOfSpeech: 'grammar' }),
      makeFact('g5', { partOfSpeech: 'grammar' }),
    ];

    const deck1 = makeDeck('deck_a', deck1Facts); // name = 'deck_a'
    const deck2 = makeDeck('deck_b', deck2Facts); // name = 'deck_b'

    const allFactIds = [...deck1Facts, ...deck2Facts].map(f => f.id);
    const groups = extractTopicGroupsMultiDeck([deck1, deck2], allFactIds, []);

    // "Nouns" and "Grammars" are unique — no prefix needed
    const labels = groups.map(g => g.label);
    expect(labels).toContain('Nouns');
    expect(labels).toContain('Grammars');
    // Should NOT be prefixed
    expect(labels).not.toContain('deck_a: Nouns');
    expect(labels).not.toContain('deck_b: Grammars');
  });

  it('single-source deck with subDecks — labels preserved unchanged', () => {
    // When only one deck is passed, no collisions can occur — labels stay as-is.
    const facts = [
      makeFact('f1'), makeFact('f2'), makeFact('f3'), makeFact('f4'),
    ];
    const deck = makeDeck('solo', facts, [
      { id: 'sd1', name: 'Chapter One', factIds: ['f1', 'f2'] },
      { id: 'sd2', name: 'Chapter Two', factIds: ['f3', 'f4'] },
    ]);  // name = 'solo'

    const allFactIds = facts.map(f => f.id);
    const groups = extractTopicGroupsMultiDeck([deck], allFactIds, []);

    const labels = groups.map(g => g.label);
    expect(labels).toContain('Chapter One');
    expect(labels).toContain('Chapter Two');
    // Should NOT be prefixed when there's no collision
    expect(labels).not.toContain('solo: Chapter One');
    expect(labels).not.toContain('solo: Chapter Two');
  });
});
