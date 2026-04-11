/**
 * Unit tests for curatedDeckSchema.ts — Zod validation at the curated.db decode boundary.
 *
 * The most important test is the "fifa regression": numeric distractors must be caught
 * and rejected so they never reach the quiz engine as string[].
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DeckFactSchema,
  AnswerTypePoolSchema,
  SynonymGroupSchema,
  parseDeckFact,
  parseAnswerTypePool,
  parseSynonymGroup,
} from './curatedDeckSchema';

// ---------------------------------------------------------------------------
// Helpers — minimal valid objects
// ---------------------------------------------------------------------------

/** Returns a minimal valid DeckFact-shaped object for testing. */
function validFact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fact-001',
    correctAnswer: 'Brazil',
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'pool-countries',
    difficulty: 2,
    funScore: 7,
    quizQuestion: 'What country won the most FIFA World Cups?',
    explanation: 'Brazil has won 5 World Cups.',
    visualDescription: 'World Cup trophy with green and yellow background',
    sourceName: 'FIFA',
    distractors: ['Germany', 'Italy', 'France', 'Argentina'],
    ...overrides,
  };
}

/** Returns a minimal valid AnswerTypePool-shaped object for testing. */
function validPool(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pool-countries',
    label: 'Countries',
    answerFormat: 'name',
    factIds: ['fact-001', 'fact-002'],
    minimumSize: 5,
    ...overrides,
  };
}

/** Returns a minimal valid SynonymGroup-shaped object for testing. */
function validSynonymGroup(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'syn-001',
    factIds: ['fact-001', 'fact-002'],
    reason: 'Same country, different spellings',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DeckFactSchema tests
// ---------------------------------------------------------------------------

describe('DeckFactSchema', () => {
  it('accepts a valid DeckFact', () => {
    const result = DeckFactSchema.safeParse(validFact());
    expect(result.success).toBe(true);
  });

  it('rejects numeric distractors (fifa regression)', () => {
    // This is THE regression test: numeric array from JSON.parse(row['distractors'])
    // must be caught, not silently typed as string[].
    const result = DeckFactSchema.safeParse(validFact({ distractors: [7, 8, 9] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths.some(p => p.startsWith('distractors'))).toBe(true);
    }
  });

  it('rejects a fact missing a required field (quizQuestion)', () => {
    const raw = validFact();
    delete raw['quizQuestion'];
    const result = DeckFactSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it('rejects a fact with an invalid quizMode enum value', () => {
    const result = DeckFactSchema.safeParse(validFact({ quizMode: 'video_question' }));
    expect(result.success).toBe(false);
  });

  it('rejects a fact with an invalid quizResponseMode enum value', () => {
    const result = DeckFactSchema.safeParse(validFact({ quizResponseMode: 'drag_drop' }));
    expect(result.success).toBe(false);
  });

  it('accepts a fact with valid optional fields', () => {
    const result = DeckFactSchema.safeParse(validFact({
      quizMode: 'chess_tactic',
      quizResponseMode: 'chess_move',
      fenPosition: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
      solutionMoves: ['e2e4', 'e7e5'],
      lichessRating: 1500,
      examTags: ['USMLE_Step1'],
      sentenceFurigana: [{ t: '東京', r: 'とうきょう', g: 'Tokyo' }],
      mapCoordinates: [35.6762, 139.6503],
    }));
    expect(result.success).toBe(true);
  });

  it('accepts a fact with unknown extra fields (passthrough)', () => {
    // Forward-compat: new fields in DB should not break existing validation.
    const result = DeckFactSchema.safeParse(validFact({ _futureField: 'something' }));
    expect(result.success).toBe(true);
  });

  it('rejects numeric examTags', () => {
    const result = DeckFactSchema.safeParse(validFact({ examTags: [1, 2, 3] }));
    expect(result.success).toBe(false);
  });

  it('rejects numeric solutionMoves', () => {
    const result = DeckFactSchema.safeParse(validFact({ solutionMoves: [1, 2] }));
    expect(result.success).toBe(false);
  });

  it('rejects numeric acceptableAlternatives', () => {
    const result = DeckFactSchema.safeParse(validFact({ acceptableAlternatives: [42] }));
    expect(result.success).toBe(false);
  });

  it('accepts a fact where acceptableAlternatives defaults to [] when absent', () => {
    const raw = validFact();
    delete raw['acceptableAlternatives'];
    const result = DeckFactSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['acceptableAlternatives']).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// AnswerTypePoolSchema tests
// ---------------------------------------------------------------------------

describe('AnswerTypePoolSchema', () => {
  it('accepts a valid AnswerTypePool', () => {
    const result = AnswerTypePoolSchema.safeParse(validPool());
    expect(result.success).toBe(true);
  });

  it('rejects numeric syntheticDistractors', () => {
    const result = AnswerTypePoolSchema.safeParse(validPool({ syntheticDistractors: [1, 2, 3] }));
    expect(result.success).toBe(false);
  });

  it('rejects numeric factIds', () => {
    const result = AnswerTypePoolSchema.safeParse(validPool({ factIds: [1, 2, 3] }));
    expect(result.success).toBe(false);
  });

  it('accepts a pool with string syntheticDistractors', () => {
    const result = AnswerTypePoolSchema.safeParse(validPool({
      syntheticDistractors: ['England', 'Spain', 'Portugal'],
    }));
    expect(result.success).toBe(true);
  });

  it('rejects a pool missing required id', () => {
    const raw = validPool();
    delete raw['id'];
    const result = AnswerTypePoolSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SynonymGroupSchema tests
// ---------------------------------------------------------------------------

describe('SynonymGroupSchema', () => {
  it('accepts a valid SynonymGroup', () => {
    const result = SynonymGroupSchema.safeParse(validSynonymGroup());
    expect(result.success).toBe(true);
  });

  it('rejects numeric factIds', () => {
    const result = SynonymGroupSchema.safeParse(validSynonymGroup({ factIds: [1, 2] }));
    expect(result.success).toBe(false);
  });

  it('rejects a group missing required reason', () => {
    const raw = validSynonymGroup();
    delete raw['reason'];
    const result = SynonymGroupSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Parse helper tests (parseDeckFact, parseAnswerTypePool, parseSynonymGroup)
// ---------------------------------------------------------------------------

describe('parseDeckFact', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns a DeckFact on valid input', () => {
    const result = parseDeckFact(validFact(), 'deck-001', 'fact-001');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('fact-001');
  });

  it('returns null and logs a warning when distractors are numeric (fifa regression)', () => {
    const result = parseDeckFact(validFact({ distractors: [7, 8, 9] }), 'deck-001', 'fact-001');
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('fact "fact-001" in deck "deck-001"'),
    );
  });

  it('returns null on completely invalid input (null)', () => {
    const result = parseDeckFact(null, 'deck-001', 'bad-fact');
    expect(result).toBeNull();
  });

  it('includes deck and fact context in warning message', () => {
    parseDeckFact(validFact({ distractors: [1, 2, 3] }), 'world_countries', 'country-042');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('"country-042"'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('"world_countries"'),
    );
  });
});

describe('parseAnswerTypePool', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns an AnswerTypePool on valid input', () => {
    const result = parseAnswerTypePool(validPool(), 'deck-001', 'pool-001');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('pool-countries');
  });

  it('returns null on invalid input and logs a warning', () => {
    const result = parseAnswerTypePool(validPool({ syntheticDistractors: [1, 2, 3] }), 'deck-001', 'pool-001');
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('parseSynonymGroup', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns a SynonymGroup on valid input', () => {
    const result = parseSynonymGroup(validSynonymGroup(), 'deck-001', 'syn-001');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('syn-001');
  });

  it('returns null on invalid input and logs a warning', () => {
    const result = parseSynonymGroup(validSynonymGroup({ factIds: [1, 2] }), 'deck-001', 'syn-001');
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});
