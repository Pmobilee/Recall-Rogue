/**
 * Tests for curatedDistractorSelector — covering pool-based selection,
 * synthetic distractor members, pool size viability, and fallback behavior.
 */

import { describe, it, expect } from 'vitest';
import { selectDistractors, getDistractorCount } from './curatedDistractorSelector';
import type { DeckFact, AnswerTypePool, SynonymGroup } from '../data/curatedDeckTypes';
import { ConfusionMatrix } from './confusionMatrix';

// ---------------------------------------------------------------------------
// Minimal mock helpers
// ---------------------------------------------------------------------------

function makeFact(id: string, correctAnswer: string, overrides: Partial<DeckFact> = {}): DeckFact {
  return {
    id,
    correctAnswer,
    acceptableAlternatives: [],
    chainThemeId: 0,
    answerTypePoolId: 'pool_main',
    difficulty: 3,
    funScore: 5,
    quizQuestion: `Question about ${id}?`,
    explanation: '',
    visualDescription: '',
    sourceName: 'test',
    distractors: ['Fallback A', 'Fallback B', 'Fallback C', 'Fallback D'],
    ...overrides,
  };
}

function makePool(factIds: string[], syntheticDistractors?: string[]): AnswerTypePool {
  return {
    id: 'pool_main',
    label: 'Main Pool',
    answerFormat: 'name',
    minimumSize: 5,
    factIds,
    syntheticDistractors,
  };
}

const emptyConfusion = new ConfusionMatrix();
const noSynonymGroups: SynonymGroup[] = [];

// ---------------------------------------------------------------------------
// getDistractorCount
// ---------------------------------------------------------------------------

describe('getDistractorCount', () => {
  it('returns 2 at mastery 0', () => {
    expect(getDistractorCount(0)).toBe(2);
  });

  it('returns 3 at mastery 1', () => {
    expect(getDistractorCount(1)).toBe(3);
  });

  it('returns 3 at mastery 2', () => {
    expect(getDistractorCount(2)).toBe(3);
  });

  it('returns 4 at mastery 3-5', () => {
    expect(getDistractorCount(3)).toBe(4);
    expect(getDistractorCount(5)).toBe(4);
  });

  it('reduces count by 1 for meditated theme (min 2)', () => {
    expect(getDistractorCount(0, 1, 1)).toBe(2); // already min — stays 2
    expect(getDistractorCount(1, 1, 1)).toBe(2); // 3 − 1 = 2
    expect(getDistractorCount(3, 1, 1)).toBe(3); // 4 − 1 = 3
  });

  it('does not reduce count when theme IDs do not match', () => {
    expect(getDistractorCount(3, 1, 2)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// selectDistractors — basic pool selection
// ---------------------------------------------------------------------------

describe('selectDistractors — pool selection', () => {
  const facts = [
    makeFact('f1', 'Alpha'),
    makeFact('f2', 'Beta'),
    makeFact('f3', 'Gamma'),
    makeFact('f4', 'Delta'),
    makeFact('f5', 'Epsilon'),
    makeFact('f6', 'Zeta'),
  ];
  const correctFact = facts[0];
  const pool = makePool(facts.map(f => f.id));

  it('returns the requested number of distractors', () => {
    const result = selectDistractors(correctFact, pool, facts, noSynonymGroups, emptyConfusion, null, 3, 1);
    expect(result.distractors.length).toBe(3);
  });

  it('never includes the correct answer as a distractor', () => {
    const result = selectDistractors(correctFact, pool, facts, noSynonymGroups, emptyConfusion, null, 3, 1);
    const answers = result.distractors.map(d => d.correctAnswer.toLowerCase());
    expect(answers).not.toContain('alpha');
  });

  it('returns unique distractor answers', () => {
    const result = selectDistractors(correctFact, pool, facts, noSynonymGroups, emptyConfusion, null, 4, 1);
    const answers = result.distractors.map(d => d.correctAnswer.toLowerCase());
    expect(new Set(answers).size).toBe(answers.length);
  });
});

// ---------------------------------------------------------------------------
// selectDistractors — fallback when pool is too small
// ---------------------------------------------------------------------------

describe('selectDistractors — small pool fallback', () => {
  it('falls back to pre-generated distractors when pool has < 5 unique answers', () => {
    // Only 3 facts in pool — below threshold
    const smallFacts = [
      makeFact('f1', 'Alpha'),
      makeFact('f2', 'Beta'),
      makeFact('f3', 'Gamma'),
    ];
    const correctFact = makeFact('correct', 'CorrectOne', {
      distractors: ['Wrong X', 'Wrong Y', 'Wrong Z'],
    });
    const pool = makePool([...smallFacts.map(f => f.id), correctFact.id]);
    const allFacts = [...smallFacts, correctFact];

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 2, 1);
    const answers = result.distractors.map(d => d.correctAnswer);
    // Should use fallback distractors, not pool members
    expect(answers.some(a => ['Wrong X', 'Wrong Y', 'Wrong Z'].includes(a))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// selectDistractors — synthetic distractor members
// ---------------------------------------------------------------------------

describe('selectDistractors — synthetic distractors', () => {
  it('uses synthetic members to pad a small pool above the viability threshold', () => {
    // 3 real facts + 2 synthetic = 5 total → should use pool path instead of fallback
    const realFacts = [
      makeFact('f1', 'Jupiter'),
      makeFact('f2', 'Saturn'),
      makeFact('f3', 'Uranus'),
    ];
    const correctFact = makeFact('correct', 'Neptune', {
      answerTypePoolId: 'pool_main',
      distractors: ['FallbackOnly1', 'FallbackOnly2', 'FallbackOnly3'],
    });
    const syntheticDistractors = ['Mercury', 'Venus'];
    const pool = makePool([...realFacts.map(f => f.id), correctFact.id], syntheticDistractors);
    const allFacts = [...realFacts, correctFact];

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 2, 1);

    // Should NOT have used the fallback path (FallbackOnly answers)
    const answers = result.distractors.map(d => d.correctAnswer);
    expect(answers.every(a => !a.startsWith('FallbackOnly'))).toBe(true);
  });

  it('synthetic candidates appear as distractors when real pool is exhausted', () => {
    // 2 real pool members + correct fact + 3 synthetics — enough for pool path
    const realFacts = [
      makeFact('f1', 'Alpha'),
      makeFact('f2', 'Beta'),
    ];
    const correctFact = makeFact('correct', 'Gamma', {
      answerTypePoolId: 'pool_main',
      distractors: ['FallbackOnly'],
    });
    const syntheticDistractors = ['Delta', 'Epsilon', 'Zeta'];
    const pool = makePool([...realFacts.map(f => f.id), correctFact.id], syntheticDistractors);
    const allFacts = [...realFacts, correctFact];

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 3, 1);

    // Should include at least one synthetic member since only 2 real pool members available
    const answers = result.distractors.map(d => d.correctAnswer);
    const hasSynthetic = answers.some(a => syntheticDistractors.includes(a));
    expect(hasSynthetic).toBe(true);
  });

  it('synthetic candidate matching the correct answer is excluded', () => {
    const realFacts = [
      makeFact('f1', 'Alpha'),
      makeFact('f2', 'Beta'),
      makeFact('f3', 'Gamma'),
    ];
    const correctFact = makeFact('correct', 'Neptune', {
      answerTypePoolId: 'pool_main',
    });
    // Include correctAnswer in synthetics — must be filtered out
    const syntheticDistractors = ['Neptune', 'Mercury', 'Venus'];
    const pool = makePool([...realFacts.map(f => f.id), correctFact.id], syntheticDistractors);
    const allFacts = [...realFacts, correctFact];

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 2, 1);

    const answers = result.distractors.map(d => d.correctAnswer.toLowerCase());
    expect(answers).not.toContain('neptune');
  });

  it('real pool members are preferred over synthetic members (higher base score)', () => {
    // 1 real pool member + correct + 5 synthetics — real member should always be selected first
    const realMemberFact = makeFact('real1', 'RealDistractor', { answerTypePoolId: 'pool_main' });
    const correctFact = makeFact('correct', 'CorrectAnswer', {
      answerTypePoolId: 'pool_main',
      distractors: [],
    });
    const syntheticDistractors = ['Synth1', 'Synth2', 'Synth3', 'Synth4', 'Synth5'];
    const pool = makePool([realMemberFact.id, correctFact.id], syntheticDistractors);
    const allFacts = [realMemberFact, correctFact];

    // Request 1 distractor — should come from the real pool member, not synthetics
    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 1, 1);

    expect(result.distractors[0].correctAnswer).toBe('RealDistractor');
  });

  it('synthetic members have id prefixed with _synthetic_', () => {
    const realFacts = [
      makeFact('f1', 'Alpha'),
      makeFact('f2', 'Beta'),
    ];
    const correctFact = makeFact('correct', 'Gamma');
    const syntheticDistractors = ['Delta', 'Epsilon', 'Zeta'];
    const pool = makePool([...realFacts.map(f => f.id), correctFact.id], syntheticDistractors);
    const allFacts = [...realFacts, correctFact];

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 3, 1);

    // Any synthetic that was selected should have _synthetic_ prefix on its id
    for (const d of result.distractors) {
      if (syntheticDistractors.includes(d.correctAnswer)) {
        expect(d.id).toBe(`_synthetic_${d.correctAnswer}`);
      }
    }
  });

  it('pool with no synthetic still falls back when < 5 real answers', () => {
    const smallFacts = [
      makeFact('f1', 'Alpha'),
      makeFact('f2', 'Beta'),
    ];
    const correctFact = makeFact('correct', 'Gamma', {
      distractors: ['FB1', 'FB2', 'FB3'],
    });
    const pool = makePool([...smallFacts.map(f => f.id), correctFact.id]); // no syntheticDistractors
    const allFacts = [...smallFacts, correctFact];

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 2, 1);

    // Without synthetics the pool is too small — should use fallback
    const answers = result.distractors.map(d => d.correctAnswer);
    expect(answers.some(a => ['FB1', 'FB2', 'FB3'].includes(a))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// selectDistractors — synonym exclusion
// ---------------------------------------------------------------------------

describe('selectDistractors — synonym exclusion', () => {
  it('excludes synonym group members from distractor pool', () => {
    const facts = [
      makeFact('f1', 'Alpha'),
      makeFact('f2', 'Beta'),
      makeFact('f3', 'Gamma'),
      makeFact('f4', 'Delta'),
      makeFact('f5', 'Epsilon'),
      makeFact('f6', 'Zeta'),
    ];
    const correctFact = { ...facts[0], synonymGroupId: 'grp1' };
    const synonymGroups: SynonymGroup[] = [
      { id: 'grp1', factIds: ['f1', 'f2'], reason: 'synonyms' },
    ];
    const pool = makePool(facts.map(f => f.id));

    const result = selectDistractors(correctFact, pool, facts, synonymGroups, emptyConfusion, null, 3, 1);

    // f2 (Beta) must not appear since it's in the synonym group
    const answers = result.distractors.map(d => d.correctAnswer.toLowerCase());
    expect(answers).not.toContain('beta');
  });
});
