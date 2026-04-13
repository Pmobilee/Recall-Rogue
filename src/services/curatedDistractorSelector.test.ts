/**
 * Tests for curatedDistractorSelector — covering pool-based selection,
 * synthetic distractor members, pool size viability, and fallback behavior.
 */

import { describe, it, expect, vi } from 'vitest';
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
    // 2 real pool members + correct + 3 synthetics — enough for pool path
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

  it('does not crash when syntheticDistractors contains non-string values (malformed deck data)', () => {
    // Regression guard: fifa_world_cup.json had numeric syntheticDistractors that crashed
    // selectDistractors at synAnswer.toLowerCase() with "not a function".
    const realFacts = [
      makeFact('f1', 'Brazil'),
      makeFact('f2', 'Germany'),
      makeFact('f3', 'Italy'),
      makeFact('f4', 'France'),
    ];
    const correctFact = makeFact('correct', 'Argentina', {
      answerTypePoolId: 'pool_main',
      distractors: ['FallbackA', 'FallbackB'],
    });
    // Intentionally inject numeric values to simulate malformed deck JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const syntheticDistractors: any[] = [4, 'Spain', null, 'England'];
    const pool = makePool([...realFacts.map(f => f.id), correctFact.id], syntheticDistractors);
    const allFacts = [...realFacts, correctFact];

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let result: ReturnType<typeof selectDistractors> | undefined;
    expect(() => {
      result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 2, 1);
    }).not.toThrow();

    // Non-string entries should have been skipped, valid strings should still work
    expect(result).toBeDefined();
    expect(result!.distractors.length).toBeGreaterThan(0);

    // Exactly two non-string entries (4 and null) should have produced warn calls
    const warnCalls = warnSpy.mock.calls.filter(c =>
      String(c[0]).includes('[selectDistractors]'),
    );
    expect(warnCalls.length).toBe(2);

    warnSpy.mockRestore();
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

// ---------------------------------------------------------------------------
// selectDistractors — unit matching
// ---------------------------------------------------------------------------

describe('selectDistractors — unit matching', () => {
  /**
   * Build a mixed measurement pool containing heights (metres), weights (tonnes),
   * and counts (years). This simulates the world_wonders measurement_number pool.
   */
  function makeMixedMeasurementPool() {
    const heightFacts = [
      makeFact('h1', '8 metres'),
      makeFact('h2', '12 metres'),
      makeFact('h3', '21 metres'),
      makeFact('h4', '30 metres'),
      makeFact('h5', '137 metres'),
    ];
    const weightFacts = [
      makeFact('w1', '100 tonnes'),
      makeFact('w2', '820 tonnes'),
      makeFact('w3', '5,000 tonnes'),
      makeFact('w4', '52,800 tonnes'),
      makeFact('w5', '6,000,000 tonnes'),
    ];
    const yearFacts = [
      makeFact('y1', '50 years'),
      makeFact('y2', '120 years'),
      makeFact('y3', '500 years'),
    ];
    const allFacts = [...heightFacts, ...weightFacts, ...yearFacts];
    const pool = makePool(allFacts.map(f => f.id));
    return { heightFacts, weightFacts, yearFacts, allFacts, pool };
  }

  it('prefers same-unit distractors over different-unit distractors', () => {
    const { heightFacts, weightFacts, allFacts, pool } = makeMixedMeasurementPool();
    // Correct fact is a height measurement
    const correctFact = makeFact('moai', '10 metres', { answerTypePoolId: 'pool_main', distractors: [] });
    const allWithCorrect = [...allFacts, correctFact];
    const poolWithCorrect: AnswerTypePool = {
      ...pool,
      factIds: [...pool.factIds, correctFact.id],
    };

    const result = selectDistractors(correctFact, poolWithCorrect, allWithCorrect, noSynonymGroups, emptyConfusion, null, 3, 1);

    const answers = result.distractors.map(d => d.correctAnswer);
    const weightAnswers = weightFacts.map(f => f.correctAnswer);
    const hasWeightDistractor = answers.some(a => weightAnswers.includes(a));

    // All 3 distractors should be heights, not weights
    expect(hasWeightDistractor).toBe(false);
    // Each selected distractor should end in "metres"
    for (const answer of answers) {
      expect(answer).toMatch(/metres$/);
    }
  });

  it('does not penalise non-measurement answers (no unit extracted)', () => {
    // When the correct answer has no unit, unit matching is a no-op
    const nameFacts = [
      makeFact('n1', 'Great Wall of China'),
      makeFact('n2', 'Colosseum'),
      makeFact('n3', 'Eiffel Tower'),
      makeFact('n4', 'Machu Picchu'),
      makeFact('n5', 'Taj Mahal'),
      makeFact('n6', 'Angkor Wat'),
    ];
    const correctFact = nameFacts[0];
    const pool = makePool(nameFacts.map(f => f.id));

    // Should still return the right count without error
    const result = selectDistractors(correctFact, pool, nameFacts, noSynonymGroups, emptyConfusion, null, 3, 1);
    expect(result.distractors.length).toBe(3);
  });

  it('same-unit distractors outrank different-unit distractors even without confusion data', () => {
    // Pool has 3 metres facts and 5 tonnes facts.
    // Correct answer is in metres — all 3 returned distractors must be metres.
    const metresFacts = [
      makeFact('m1', '5 metres'),
      makeFact('m2', '15 metres'),
      makeFact('m3', '25 metres'),
    ];
    const tonnesFacts = [
      makeFact('t1', '100 tonnes'),
      makeFact('t2', '200 tonnes'),
      makeFact('t3', '300 tonnes'),
      makeFact('t4', '400 tonnes'),
      makeFact('t5', '500 tonnes'),
    ];
    const correctFact = makeFact('target', '10 metres', { answerTypePoolId: 'pool_main', distractors: [] });
    const allFacts = [...metresFacts, ...tonnesFacts, correctFact];
    const pool = makePool(allFacts.map(f => f.id));

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 3, 1);
    const answers = result.distractors.map(d => d.correctAnswer);

    // Must return exactly the 3 metres facts as distractors
    for (const answer of answers) {
      expect(answer).toMatch(/metres$/);
    }
    expect(answers).not.toContain(expect.stringMatching(/tonnes$/));
  });

  it('falls back gracefully to mixed units when not enough same-unit candidates exist', () => {
    // Only 1 other metres fact available — must fill remaining slots from other units
    const metresFact = makeFact('m1', '5 metres');
    const tonnesFacts = [
      makeFact('t1', '100 tonnes'),
      makeFact('t2', '200 tonnes'),
      makeFact('t3', '300 tonnes'),
      makeFact('t4', '400 tonnes'),
    ];
    const correctFact = makeFact('target', '10 metres', { answerTypePoolId: 'pool_main', distractors: [] });
    const allFacts = [metresFact, ...tonnesFacts, correctFact];
    const pool = makePool(allFacts.map(f => f.id));

    const result = selectDistractors(correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 3, 1);
    const answers = result.distractors.map(d => d.correctAnswer);

    // Should still return 3 distractors total (no crash, no underfill)
    expect(answers.length).toBe(3);
    // The metres fact should be included (highest score)
    expect(answers).toContain('5 metres');
  });
});

// ---------------------------------------------------------------------------
// selectDistractors — chain theme matching (cross-category contamination fix)
// ---------------------------------------------------------------------------

describe('selectDistractors — chain theme matching', () => {
  it('prefers same-chainTheme distractors over cross-theme distractors in a broad pool', () => {
    // Simulate a world-religions deck where one pool contains facts from
    // both Hindu/Buddhist and Christianity sub-themes. The correct fact is
    // from theme 2 (Christianity). Distractors should come from theme 2, not theme 1.
    const correctFact = makeFact('christian_city', 'Vatican City', {
      chainThemeId: 2,
      answerTypePoolId: 'pool_cities',
    });

    // Same theme (Christianity) — should be preferred
    const christianCity2 = makeFact('christian_c2', 'Lourdes', {
      chainThemeId: 2,
      answerTypePoolId: 'pool_cities',
    });
    const christianCity3 = makeFact('christian_c3', 'Fatima', {
      chainThemeId: 2,
      answerTypePoolId: 'pool_cities',
    });
    const christianCity4 = makeFact('christian_c4', 'Knock', {
      chainThemeId: 2,
      answerTypePoolId: 'pool_cities',
    });

    // Different theme (Hindu/Buddhist) — should be deprioritised
    const hinduCity1 = makeFact('hindu_c1', 'Varanasi', {
      chainThemeId: 1,
      answerTypePoolId: 'pool_cities',
    });
    const hinduCity2 = makeFact('hindu_c2', 'Bodh Gaya', {
      chainThemeId: 1,
      answerTypePoolId: 'pool_cities',
    });
    const hinduCity3 = makeFact('hindu_c3', 'Lumbini', {
      chainThemeId: 1,
      answerTypePoolId: 'pool_cities',
    });

    const allFacts = [
      correctFact,
      christianCity2, christianCity3, christianCity4,
      hinduCity1, hinduCity2, hinduCity3,
    ];
    const pool: AnswerTypePool = {
      id: 'pool_cities',
      label: 'Sacred Cities',
      answerFormat: 'place',
      minimumSize: 5,
      factIds: allFacts.map(f => f.id),
    };

    const result = selectDistractors(
      correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 3, 1,
    );
    const answers = result.distractors.map(d => d.correctAnswer);

    // All 3 same-theme candidates should win over the 3 cross-theme candidates
    expect(answers).toContain('Lourdes');
    expect(answers).toContain('Fatima');
    expect(answers).toContain('Knock');
    expect(answers).not.toContain('Varanasi');
    expect(answers).not.toContain('Bodh Gaya');
    expect(answers).not.toContain('Lumbini');
  });

  it('does not penalise when chainThemeId is 0 (unthemed facts)', () => {
    // Facts with chainThemeId 0 should not be penalised — unthemed pools
    // are intentionally broad (e.g. vocabulary decks).
    const correctFact = makeFact('fact_a', 'Alpha', { chainThemeId: 0 });
    const factB = makeFact('fact_b', 'Beta', { chainThemeId: 0 });
    const factC = makeFact('fact_c', 'Gamma', { chainThemeId: 0 });
    const factD = makeFact('fact_d', 'Delta', { chainThemeId: 0 });
    const factE = makeFact('fact_e', 'Epsilon', { chainThemeId: 0 });

    const allFacts = [correctFact, factB, factC, factD, factE];
    const pool = makePool(allFacts.map(f => f.id));

    const result = selectDistractors(
      correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 3, 1,
    );

    // Should return 3 distractors regardless of chainThemeId
    expect(result.distractors.length).toBe(3);
  });

  it('falls back to cross-theme distractors when same-theme pool has too few members', () => {
    // When there are only 1 same-theme distractor but 3 needed, cross-theme
    // candidates should fill the gap (score penalty, not hard filter).
    const correctFact = makeFact('fact_x', 'Right Answer', { chainThemeId: 5 });
    const sameTheme = makeFact('same_theme', 'Same Theme Distractor', { chainThemeId: 5 });

    // Cross-theme distractors — should fill slots when same-theme pool is exhausted
    const crossA = makeFact('cross_a', 'Cross A', { chainThemeId: 9 });
    const crossB = makeFact('cross_b', 'Cross B', { chainThemeId: 9 });
    const crossC = makeFact('cross_c', 'Cross C', { chainThemeId: 9 });
    const crossD = makeFact('cross_d', 'Cross D', { chainThemeId: 9 });

    const allFacts = [correctFact, sameTheme, crossA, crossB, crossC, crossD];
    const pool = makePool(allFacts.map(f => f.id));

    const result = selectDistractors(
      correctFact, pool, allFacts, noSynonymGroups, emptyConfusion, null, 3, 1,
    );

    // Same-theme distractor should be included first
    const answers = result.distractors.map(d => d.correctAnswer);
    expect(answers).toContain('Same Theme Distractor');
    // Should still return 3 total — cross-theme fills the gap
    expect(answers.length).toBe(3);
  });
});
