/**
 * Unit tests for workshopService — serialization, deserialization, and platform detection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  serializeDeckForWorkshop,
  deserializeWorkshopDeck,
  isWorkshopAvailable,
  type WorkshopDeckPackage,
} from './workshopService';
import type { PersonalDeck } from '../data/curatedDeckTypes';
import type { ReviewState } from '../data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePersonalDeck(overrides: Partial<PersonalDeck> = {}): PersonalDeck {
  return {
    id: 'test_deck_001',
    name: 'Test Deck',
    description: 'A test deck',
    domain: 'personal',
    facts: [
      {
        id: 'anki_abc123',
        quizQuestion: 'What is the capital of France?',
        correctAnswer: 'Paris',
        explanation: 'Paris is the capital of France.',
        distractors: ['London', 'Berlin', 'Madrid'],
        difficulty: 2,
        funScore: 7,
        acceptableAlternatives: [],
        chainThemeId: 0,
        answerTypePoolId: 'anki_default',
        visualDescription: '',
        sourceName: 'Test',
      },
      {
        id: 'anki_def456',
        quizQuestion: 'What is 2 + 2?',
        correctAnswer: '4',
        explanation: 'Basic arithmetic.',
        distractors: ['3', '5', '6'],
        difficulty: 1,
        funScore: 5,
        acceptableAlternatives: [],
        chainThemeId: 1,
        answerTypePoolId: 'anki_default',
        visualDescription: '',
        sourceName: 'Test',
      },
    ],
    answerTypePools: [
      {
        id: 'anki_default',
        label: 'All',
        answerFormat: 'term',
        factIds: ['anki_abc123', 'anki_def456'],
        minimumSize: 5,
      },
    ],
    synonymGroups: [],
    questionTemplates: [],
    difficultyTiers: [],
    minimumFacts: 1,
    targetFacts: 2,
    source: 'anki_import',
    importedAt: 1712000000000,
    ankiDeckName: 'My Anki Deck',
    cardCount: 2,
    ...overrides,
  };
}

function makeReviewState(factId: string, overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    factId,
    cardState: 'review',
    easeFactor: 2.5,
    interval: 10,
    repetitions: 3,
    nextReviewAt: 1715000000000,
    lastReviewAt: 1714000000000,
    quality: 4,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    stability: 10,
    difficulty: 5,
    reps: 3,
    lapses: 0,
    state: 'review',
    due: 1715000000000,
    lastReview: 1714000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// serializeDeckForWorkshop
// ---------------------------------------------------------------------------

describe('serializeDeckForWorkshop', () => {
  it('produces a version:1 package with correct structure', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);

    expect(pkg.version).toBe(1);
    expect(pkg.metadata.sourceApp).toBe('recall-rogue');
    expect(pkg.deck.domain).toBe('personal');
    expect(pkg.deck.id).toBe('test_deck_001');
    expect(pkg.deck.name).toBe('Test Deck');
  });

  it('serializes all facts with required fields', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);

    expect(pkg.deck.facts).toHaveLength(2);
    const f = pkg.deck.facts[0];
    expect(f.id).toBe('anki_abc123');
    expect(f.quizQuestion).toBe('What is the capital of France?');
    expect(f.correctAnswer).toBe('Paris');
    expect(f.explanation).toBe('Paris is the capital of France.');
    expect(f.distractors).toEqual(['London', 'Berlin', 'Madrid']);
    expect(f.difficulty).toBe(2);
    expect(f.funScore).toBe(7);
  });

  it('sets factCount in metadata', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);

    expect(pkg.metadata.factCount).toBe(2);
    expect(pkg.metadata.ankiDeckName).toBe('My Anki Deck');
    expect(pkg.metadata.exportedAt).toBeGreaterThan(0);
  });

  it('omits reviewStates when includeScheduling is false', () => {
    const deck = makePersonalDeck();
    const states = [makeReviewState('anki_abc123')];
    const pkg = serializeDeckForWorkshop(deck, states, false);

    expect(pkg.reviewStates).toBeUndefined();
  });

  it('omits reviewStates when no states passed', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);

    expect(pkg.reviewStates).toBeUndefined();
  });

  it('includes reviewStates when includeScheduling is true', () => {
    const deck = makePersonalDeck();
    const states = [
      makeReviewState('anki_abc123'),
      makeReviewState('anki_def456', { cardState: 'new', reps: 0, state: 'new' }),
    ];
    const pkg = serializeDeckForWorkshop(deck, states, true);

    expect(pkg.reviewStates).toHaveLength(2);
    const rs = pkg.reviewStates![0];
    expect(rs.factId).toBe('anki_abc123');
    expect(rs.reps).toBe(3);
    expect(rs.lapses).toBe(0);
    expect(rs.interval).toBe(10);
    expect(rs.stability).toBe(10);
  });

  it('filters out review states for facts not in the deck', () => {
    const deck = makePersonalDeck();
    const states = [
      makeReviewState('anki_abc123'),
      makeReviewState('some_other_fact_not_in_deck'),
    ];
    const pkg = serializeDeckForWorkshop(deck, states, true);

    expect(pkg.reviewStates).toHaveLength(1);
    expect(pkg.reviewStates![0].factId).toBe('anki_abc123');
  });

  it('strips internal-only deck fields (does not include answerTypePools)', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);

    // Package only has id, name, description, domain, facts — no answerTypePools
    const keys = Object.keys(pkg.deck);
    expect(keys).toContain('id');
    expect(keys).toContain('name');
    expect(keys).toContain('facts');
    expect(keys).not.toContain('answerTypePools');
    expect(keys).not.toContain('synonymGroups');
  });
});

// ---------------------------------------------------------------------------
// deserializeWorkshopDeck
// ---------------------------------------------------------------------------

describe('deserializeWorkshopDeck', () => {
  it('assigns new deck ID and prefixes fact IDs with ws_', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);
    const { deck: imported } = deserializeWorkshopDeck(pkg, 'imported_deck_001');

    expect(imported.id).toBe('imported_deck_001');
    expect(imported.facts[0].id).toBe('ws_anki_abc123');
    expect(imported.facts[1].id).toBe('ws_anki_def456');
  });

  it('sets domain to personal and source to anki_import', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);
    const { deck: imported } = deserializeWorkshopDeck(pkg, 'imported_001');

    expect(imported.domain).toBe('personal');
    expect(imported.source).toBe('anki_import');
  });

  it('preserves fact content', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);
    const { deck: imported } = deserializeWorkshopDeck(pkg, 'imported_001');

    const f = imported.facts[0];
    expect(f.quizQuestion).toBe('What is the capital of France?');
    expect(f.correctAnswer).toBe('Paris');
    expect(f.distractors).toEqual(['London', 'Berlin', 'Madrid']);
    expect(f.difficulty).toBe(2);
    expect(f.funScore).toBe(7);
  });

  it('creates a workshop_default answer type pool with prefixed fact IDs', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);
    const { deck: imported } = deserializeWorkshopDeck(pkg, 'imported_001');

    expect(imported.answerTypePools).toHaveLength(1);
    const pool = imported.answerTypePools[0];
    expect(pool.id).toBe('workshop_default');
    expect(pool.factIds).toContain('ws_anki_abc123');
    expect(pool.factIds).toContain('ws_anki_def456');
  });

  it('returns empty reviewStates array when package has none', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck); // no scheduling
    const { reviewStates } = deserializeWorkshopDeck(pkg, 'imported_001');

    expect(reviewStates).toHaveLength(0);
  });

  it('deserializes review states with prefixed factIds', () => {
    const deck = makePersonalDeck();
    const states = [
      makeReviewState('anki_abc123'),
      makeReviewState('anki_def456', { cardState: 'new', reps: 0, state: 'new' }),
    ];
    const pkg = serializeDeckForWorkshop(deck, states, true);
    const { reviewStates } = deserializeWorkshopDeck(pkg, 'imported_001');

    expect(reviewStates).toHaveLength(2);
    expect(reviewStates[0].factId).toBe('ws_anki_abc123');
    expect(reviewStates[1].factId).toBe('ws_anki_def456');
  });

  it('maps review state fields correctly', () => {
    const deck = makePersonalDeck();
    const originalState = makeReviewState('anki_abc123', {
      cardState: 'review',
      interval: 14,
      repetitions: 5,
      lapseCount: 1, lapses: 1,
      stability: 14,
      difficulty: 3,
    });
    const pkg = serializeDeckForWorkshop(deck, [originalState], true);
    const { reviewStates } = deserializeWorkshopDeck(pkg, 'imported_001');

    const rs = reviewStates[0];
    expect(rs.interval).toBe(14);
    expect(rs.lapseCount).toBe(1);
    expect(rs.stability).toBe(14);
    expect(rs.difficulty).toBe(3);
    expect(rs.isLeech).toBe(false);
  });

  it('marks leech if lapses >= 8', () => {
    const deck = makePersonalDeck();
    const leechState = makeReviewState('anki_abc123', { lapseCount: 10, lapses: 10 });
    const pkg = serializeDeckForWorkshop(deck, [leechState], true);
    const { reviewStates } = deserializeWorkshopDeck(pkg, 'imported_001');

    expect(reviewStates[0].isLeech).toBe(true);
  });

  it('sets quizResponseMode to typing on all imported facts', () => {
    const deck = makePersonalDeck();
    const pkg = serializeDeckForWorkshop(deck);
    const { deck: imported } = deserializeWorkshopDeck(pkg, 'imported_001');

    for (const f of imported.facts) {
      expect(f.quizResponseMode).toBe('typing');
    }
  });

  it('round-trips deck name and description', () => {
    const deck = makePersonalDeck({ name: 'My Special Deck', description: 'Great facts' });
    const pkg = serializeDeckForWorkshop(deck);
    const { deck: imported } = deserializeWorkshopDeck(pkg, 'new_id');

    expect(imported.name).toBe('My Special Deck');
    expect(imported.description).toBe('Great facts');
  });

  it('preserves ankiDeckName in metadata', () => {
    const deck = makePersonalDeck({ ankiDeckName: 'Original Anki Deck' });
    const pkg = serializeDeckForWorkshop(deck);
    const { deck: imported } = deserializeWorkshopDeck(pkg, 'new_id');

    expect(imported.ankiDeckName).toBe('Original Anki Deck');
  });
});

// ---------------------------------------------------------------------------
// isWorkshopAvailable
// ---------------------------------------------------------------------------

describe('isWorkshopAvailable', () => {
  it('returns false when __TAURI__ is not present', () => {
    // jsdom environment has no __TAURI__ by default
    expect(isWorkshopAvailable()).toBe(false);
  });

  it('returns true when __TAURI__ is present on window', () => {
    // Temporarily inject __TAURI__ to simulate desktop environment
    const win = window as any;
    win.__TAURI__ = {};
    try {
      expect(isWorkshopAvailable()).toBe(true);
    } finally {
      delete win.__TAURI__;
    }
  });
});
