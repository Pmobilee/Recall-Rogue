/**
 * Unit tests for ankiDistractorGenerator.ts.
 *
 * Covers:
 *   - Pool grouping (short names, numbers, long text → separate buckets)
 *   - Distractor count (large pool → each fact gets ~8 distractors)
 *   - Self-exclusion (fact's own answer never appears in its distractors)
 *   - Acceptable-alternatives exclusion
 *   - Small pool fallback (borrows from neighbour buckets when pool < 4)
 *   - Quality filters: case-insensitive duplicate, substring, Levenshtein < 2
 *   - Cloze facts always stay in typing mode
 *   - Stats object accuracy
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import type { DeckFact } from '../data/curatedDeckTypes';
import {
  generateDistractorsForDeck,
  bucketKey,
  isValidDistractor,
  levenshtein,
} from './ankiDistractorGenerator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFact(
  id: string,
  correctAnswer: string,
  overrides: Partial<DeckFact> = {},
): DeckFact {
  return {
    id,
    correctAnswer,
    quizQuestion: `Question about ${correctAnswer}?`,
    explanation: '',
    distractors: [],
    difficulty: 3,
    funScore: 5,
    chainThemeId: 0,
    answerTypePoolId: 'anki_default',
    acceptableAlternatives: [],
    visualDescription: '',
    sourceName: 'Test',
    quizResponseMode: 'typing',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// bucketKey
// ---------------------------------------------------------------------------

describe('bucketKey', () => {
  it('groups short proper names together', () => {
    expect(bucketKey('Paris')).toBe('short_proper');
    expect(bucketKey('Marie Curie')).toBe('short_proper');
  });

  it('groups short numbers together', () => {
    expect(bucketKey('42')).toBe('short_number');
    expect(bucketKey('1,024')).toBe('short_number');
  });

  it('groups year-containing answers as date', () => {
    expect(bucketKey('1969')).toBe('short_date');
    expect(bucketKey('Battle of 1815')).toBe('short_date');
  });

  it('groups lowercase general short answers', () => {
    expect(bucketKey('mitosis')).toBe('short_general');
    expect(bucketKey('the sun')).toBe('short_general');
  });

  it('groups medium general text', () => {
    expect(bucketKey('a process where cells divide')).toBe('medium_general');
  });

  it('groups long general text', () => {
    const longAnswer = 'the process by which cells replicate their DNA and divide into two daughter cells';
    expect(bucketKey(longAnswer)).toBe('long_general');
  });
});

// ---------------------------------------------------------------------------
// levenshtein
// ---------------------------------------------------------------------------

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('paris', 'paris')).toBe(0);
  });

  it('returns 1 for single character difference', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('returns full length when one string is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('handles multichar edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isValidDistractor
// ---------------------------------------------------------------------------

describe('isValidDistractor', () => {
  it('rejects exact case-insensitive match', () => {
    const excluded = new Set(['paris']);
    expect(isValidDistractor('Paris', excluded)).toBe(false);
    expect(isValidDistractor('PARIS', excluded)).toBe(false);
  });

  it('rejects substring of correct answer', () => {
    const excluded = new Set(['new york city']);
    expect(isValidDistractor('New York', excluded)).toBe(false);
  });

  it('rejects when correct answer is substring of candidate', () => {
    const excluded = new Set(['york']);
    expect(isValidDistractor('New York', excluded)).toBe(false);
  });

  it('rejects Levenshtein distance < 2', () => {
    const excluded = new Set(['paris']);
    // "pari" is distance 1 from "paris"
    expect(isValidDistractor('Pari', excluded)).toBe(false);
  });

  it('accepts clearly different answers', () => {
    const excluded = new Set(['paris']);
    expect(isValidDistractor('London', excluded)).toBe(true);
    expect(isValidDistractor('Berlin', excluded)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pool grouping: short names, numbers, long text → separate buckets
// ---------------------------------------------------------------------------

describe('generateDistractorsForDeck — pool grouping', () => {
  it('assigns distractors only from same-type bucket when pool is large enough', () => {
    // 9 short proper names — each has 8 others so no borrowing from the number bucket.
    // 5 number facts added to confirm they stay in their own bucket.
    const nameFacts = [
      'Athens', 'Sparta', 'Corinth', 'Thebes', 'Delphi',
      'Olympia', 'Argos', 'Mycenae', 'Troy',
    ].map((n, i) => makeFact(`name_${i}`, n));
    const numberFacts = ['42', '100', '256', '512', '1024'].map((n, i) =>
      makeFact(`num_${i}`, n),
    );

    const { facts } = generateDistractorsForDeck([...nameFacts, ...numberFacts]);

    // Each name fact should have exactly 8 distractors drawn from the proper-name bucket.
    const nameFact = facts.find(f => f.id === 'name_0')!;
    expect(nameFact.distractors.length).toBe(8);
    // None of the distractors should be pure numbers.
    for (const d of nameFact.distractors) {
      expect(/^[\d,]+$/.test(d)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Distractor count: large pool → each fact gets up to 8 distractors
// ---------------------------------------------------------------------------

describe('generateDistractorsForDeck — distractor count', () => {
  it('gives up to 8 distractors when pool has 10+ members', () => {
    const facts = [
      'Athens', 'Sparta', 'Corinth', 'Thebes', 'Delphi',
      'Olympia', 'Argos', 'Mycenae', 'Troy', 'Ephesus',
    ].map((name, i) => makeFact(`fact_${i}`, name));

    const { facts: updated, stats } = generateDistractorsForDeck(facts);

    // With 10 facts in one bucket, every fact should get at least 8 distractors
    // (9 others available, 8 max requested).
    for (const fact of updated) {
      expect(fact.distractors.length).toBeGreaterThanOrEqual(8);
      expect(fact.distractors.length).toBeLessThanOrEqual(8);
    }

    expect(stats.factsWithDistractors).toBe(10);
    expect(stats.factsTypingOnly).toBe(0);
    expect(stats.avgDistractors).toBe(8);
  });

  it('sets quizResponseMode to choice for facts with enough distractors', () => {
    // Use clearly distinct multi-character words to pass the Levenshtein ≥ 2 filter.
    const facts = [
      'Athens', 'Sparta', 'Corinth', 'Thebes', 'Delphi',
      'Olympia', 'Argos', 'Mycenae', 'Troy', 'Ephesus',
    ].map((name, i) => makeFact(`choice_${i}`, name));
    const { facts: updated } = generateDistractorsForDeck(facts);
    for (const fact of updated) {
      expect(fact.quizResponseMode).toBe('choice');
    }
  });
});

// ---------------------------------------------------------------------------
// Self-exclusion
// ---------------------------------------------------------------------------

describe('generateDistractorsForDeck — self-exclusion', () => {
  it("never includes a fact's own answer in its distractors", () => {
    const facts = [
      'Athens', 'Sparta', 'Corinth', 'Thebes', 'Delphi',
      'Olympia', 'Argos', 'Mycenae', 'Troy', 'Ephesus',
    ].map((name, i) => makeFact(`f_${i}`, name));

    const { facts: updated } = generateDistractorsForDeck(facts);

    for (const fact of updated) {
      expect(fact.distractors.map(d => d.toLowerCase())).not.toContain(
        fact.correctAnswer.toLowerCase(),
      );
    }
  });

  it('excludes acceptableAlternatives from distractors', () => {
    // Make a fact whose alternative ("Athens") matches another fact's correct answer.
    const facts = [
      makeFact('f_0', 'Athenai', { acceptableAlternatives: ['Athens'] }),
      makeFact('f_1', 'Athens'),
      makeFact('f_2', 'Sparta'),
      makeFact('f_3', 'Corinth'),
      makeFact('f_4', 'Thebes'),
      makeFact('f_5', 'Delphi'),
    ];

    const { facts: updated } = generateDistractorsForDeck(facts);
    const fact0 = updated.find(f => f.id === 'f_0')!;
    // "Athens" (an alternative) must not appear as a distractor for f_0.
    expect(fact0.distractors.map(d => d.toLowerCase())).not.toContain('athens');
  });
});

// ---------------------------------------------------------------------------
// Small pool fallback
// ---------------------------------------------------------------------------

describe('generateDistractorsForDeck — small pool fallback', () => {
  it('borrows from neighbour buckets when primary pool has < 4 others', () => {
    // 2 short proper names (tiny bucket) + 6 short general words (neighbour bucket).
    const tinyPool = [makeFact('p_0', 'Zeus'), makeFact('p_1', 'Hera')];
    const neighbourPool = ['fire', 'water', 'earth', 'metal', 'wood', 'wind'].map((w, i) =>
      makeFact(`g_${i}`, w),
    );

    const { facts: updated } = generateDistractorsForDeck([...tinyPool, ...neighbourPool]);

    const zeus = updated.find(f => f.id === 'p_0')!;
    // Zeus can only get 1 from its own bucket (Hera) but should borrow from general
    // to reach ≥ 4.
    expect(zeus.distractors.length).toBeGreaterThanOrEqual(4);
  });

  it('stays in typing mode when total available answers < 4', () => {
    // Only 3 facts total — nobody can get 4 distractors.
    const facts = [
      makeFact('f_0', 'Alpha'),
      makeFact('f_1', 'Beta'),
      makeFact('f_2', 'Gamma'),
    ];

    const { facts: updated, stats } = generateDistractorsForDeck(facts);
    for (const fact of updated) {
      expect(fact.quizResponseMode).toBe('typing');
      expect(fact.distractors).toHaveLength(0);
    }
    expect(stats.factsTypingOnly).toBe(3);
    expect(stats.factsWithDistractors).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cloze facts always stay in typing mode
// ---------------------------------------------------------------------------

describe('generateDistractorsForDeck — cloze facts', () => {
  it('leaves cloze facts (ID ending in _cN) in typing mode', () => {
    // Mix of regular and cloze facts.
    const regular = [
      'Athens', 'Sparta', 'Corinth', 'Thebes', 'Delphi',
      'Olympia', 'Argos', 'Mycenae', 'Troy', 'Ephesus',
    ].map((n, i) => makeFact(`f_${i}`, n));

    const cloze = [
      makeFact('anki_abc123_c1', 'Paris'),
      makeFact('anki_abc123_c2', 'France'),
    ];

    const { facts: updated, stats } = generateDistractorsForDeck([...regular, ...cloze]);

    for (const fact of updated.filter(f => f.id.includes('_c'))) {
      expect(fact.quizResponseMode).toBe('typing');
    }
    // The 10 regular facts should have distractors; the 2 cloze should not.
    expect(stats.factsTypingOnly).toBe(2);
    expect(stats.factsWithDistractors).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Stats object
// ---------------------------------------------------------------------------

describe('generateDistractorsForDeck — stats', () => {
  it('reports correct avgDistractors', () => {
    // Use multi-character words that are clearly distinct (Levenshtein ≥ 2 from each other).
    const facts = [
      'Athens', 'Sparta', 'Corinth', 'Thebes', 'Delphi',
      'Olympia', 'Argos', 'Mycenae', 'Troy', 'Ephesus',
    ].map((name, i) => makeFact(`stat_${i}`, name));
    const { stats } = generateDistractorsForDeck(facts);
    expect(stats.avgDistractors).toBe(8);
    expect(stats.factsWithDistractors + stats.factsTypingOnly).toBe(facts.length);
  });
});
