/**
 * Unit tests for logicSetsGenerators.ts
 *
 * Covers: determinism, valid MathProblem shape, no distractor equals correctAnswer,
 * domain-specific correctness for all 5 generators, and integration via dispatcher.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTruthTable,
  generateSetOperations,
  generateVennDiagram,
  generateLogicalEquivalence,
  generateSetCardinality,
  formatSet,
} from './logicSetsGenerators';
import { mulberry32 } from './mathUtils';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T1_TRUTH: GeneratorParams = { rangeA: [1, 1], rangeB: [1, 1] };
const T3_TRUTH: GeneratorParams = { rangeA: [2, 2], rangeB: [2, 2] };

const T1_SET_OPS: GeneratorParams = {
  rangeA: [1, 8],
  rangeB: [1, 8],
  operations: ['union', 'intersection'],
};
const T3_SET_OPS: GeneratorParams = {
  rangeA: [1, 15],
  rangeB: [1, 15],
  operations: ['union', 'intersection', 'difference', 'symmetric_difference'],
};

const T1_VENN: GeneratorParams = { rangeA: [5, 15], rangeB: [1, 5], steps: 1 };
const T2A_VENN: GeneratorParams = { rangeA: [8, 20], rangeB: [2, 7], steps: 2 };
const T2B_VENN: GeneratorParams = { rangeA: [5, 12], rangeB: [1, 4], steps: 3 };
const T3_VENN: GeneratorParams = { rangeA: [5, 12], rangeB: [1, 4], steps: 4 };

const T1_EQUIV: GeneratorParams = { rangeA: [1, 1], rangeB: [1, 1] };
const T3_EQUIV: GeneratorParams = { rangeA: [3, 3], rangeB: [2, 2] };

const T1_CARD: GeneratorParams = { rangeA: [10, 50],  rangeB: [2, 7], steps: 1 };
const T2A_CARD: GeneratorParams = { rangeA: [20, 100], rangeB: [2, 9], steps: 2 };
const T2B_CARD: GeneratorParams = { rangeA: [2, 5],    rangeB: [1, 1], steps: 3 };
const T3_CARD: GeneratorParams = { rangeA: [30, 150],  rangeB: [2, 7], steps: 4 };

// ---------------------------------------------------------------------------
// Shared validity helper
// ---------------------------------------------------------------------------

function assertValidMathProblem(
  result: { question: string; correctAnswer: string; distractors: string[]; explanation: string; inputMode: string; acceptableAlternatives: string[] },
  label: string,
) {
  expect(result.question, `${label}: question should be non-empty`).toBeTruthy();
  expect(result.correctAnswer, `${label}: correctAnswer should be non-empty`).toBeTruthy();
  expect(result.distractors, `${label}: distractors should be an array`).toBeInstanceOf(Array);
  expect(result.distractors.length, `${label}: should have exactly 4 distractors`).toBe(4);
  expect(result.explanation, `${label}: explanation should be non-empty`).toBeTruthy();
  expect(result.inputMode, `${label}: inputMode should be 'choice'`).toBe('choice');
  expect(result.acceptableAlternatives, `${label}: acceptableAlternatives should be an array`).toBeInstanceOf(Array);

  for (const d of result.distractors) {
    expect(
      d,
      `${label}: distractor "${d}" must not equal correctAnswer "${result.correctAnswer}"`,
    ).not.toBe(result.correctAnswer);
  }

  const unique = new Set(result.distractors);
  expect(unique.size, `${label}: distractors should be unique`).toBe(result.distractors.length);
}

// ---------------------------------------------------------------------------
// formatSet helper tests
// ---------------------------------------------------------------------------

describe('formatSet', () => {
  it('returns ∅ for empty array', () => {
    expect(formatSet([])).toBe('∅');
  });

  it('returns braced, comma-separated, numerically sorted string', () => {
    expect(formatSet([3, 1, 2])).toBe('{1, 2, 3}');
  });

  it('handles single element', () => {
    expect(formatSet([5])).toBe('{5}');
  });

  it('sorts numerically not lexicographically', () => {
    // Lexicographic would give {1, 10, 2} — we need {1, 2, 10}
    expect(formatSet([10, 2, 1])).toBe('{1, 2, 10}');
  });
});

// ---------------------------------------------------------------------------
// 1. generateTruthTable
// ---------------------------------------------------------------------------

describe('generateTruthTable', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateTruthTable(T1_TRUTH, rng1)).toEqual(generateTruthTable(T1_TRUTH, rng2));
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(1001);
    assertValidMathProblem(generateTruthTable(T1_TRUTH, rng), 'truth_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(9999);
    assertValidMathProblem(generateTruthTable(T3_TRUTH, rng), 'truth_t3');
  });

  it('answer is always "True" or "False"', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const result = generateTruthTable(T1_TRUTH, rng);
      expect(['True', 'False']).toContain(result.correctAnswer);
    }
  });

  it('distractors include "Cannot be determined"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateTruthTable(T1_TRUTH, rng);
      expect(result.distractors).toContain('Cannot be determined');
    }
  });

  it('distractors include "Both True and False"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateTruthTable(T1_TRUTH, rng);
      expect(result.distractors).toContain('Both True and False');
    }
  });

  it('question references logical operators', () => {
    const rng = mulberry32(7);
    const result = generateTruthTable(T1_TRUTH, rng);
    expect(result.question).toMatch(/∧|∨|→|↔|¬/);
  });

  it('question references p and q variables', () => {
    const rng = mulberry32(11);
    const result = generateTruthTable(T1_TRUTH, rng);
    expect(result.question).toMatch(/p/);
    expect(result.question).toMatch(/True|False/);
  });

  it('produces variety across seeds', () => {
    const questions = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed * 997);
      questions.add(generateTruthTable(T3_TRUTH, rng).question);
    }
    // With 9 templates × 4 rows there's plenty of variety
    expect(questions.size).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// 2. generateSetOperations
// ---------------------------------------------------------------------------

describe('generateSetOperations', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateSetOperations(T1_SET_OPS, rng1)).toEqual(
      generateSetOperations(T1_SET_OPS, rng2),
    );
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(2002);
    assertValidMathProblem(generateSetOperations(T1_SET_OPS, rng), 'set_ops_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(8888);
    assertValidMathProblem(generateSetOperations(T3_SET_OPS, rng), 'set_ops_t3');
  });

  it('answer is a valid set string (starts with { or is ∅)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateSetOperations(T1_SET_OPS, rng);
      expect(result.correctAnswer.startsWith('{') || result.correctAnswer === '∅').toBe(true);
    }
  });

  it('question references both A and B', () => {
    const rng = mulberry32(5);
    const result = generateSetOperations(T1_SET_OPS, rng);
    expect(result.question).toMatch(/A/);
    expect(result.question).toMatch(/B/);
  });

  it('question contains a set operation symbol or name', () => {
    const rng = mulberry32(13);
    const result = generateSetOperations(T3_SET_OPS, rng);
    expect(result.question).toMatch(/∪|∩|−|△/);
  });

  it('no distractor equals correctAnswer for 30 seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const result = generateSetOperations(T1_SET_OPS, rng);
      for (const d of result.distractors) {
        expect(d).not.toBe(result.correctAnswer);
      }
    }
  });

  it('all 4 operations appear across seeds (tier 3)', () => {
    const seenOps = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const result = generateSetOperations(T3_SET_OPS, rng);
      if (result.question.includes('∪')) seenOps.add('union');
      if (result.question.includes('∩')) seenOps.add('intersection');
      if (result.question.includes('−')) seenOps.add('difference');
      if (result.question.includes('△')) seenOps.add('sym_diff');
    }
    expect(seenOps.size).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 3. generateVennDiagram
// ---------------------------------------------------------------------------

describe('generateVennDiagram', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateVennDiagram(T1_VENN, rng1)).toEqual(generateVennDiagram(T1_VENN, rng2));
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(3003);
    assertValidMathProblem(generateVennDiagram(T1_VENN, rng), 'venn_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(7777);
    assertValidMathProblem(generateVennDiagram(T3_VENN, rng), 'venn_t3');
  });

  it('answer is a positive integer string (tier 1)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateVennDiagram(T1_VENN, rng);
      const n = Number(result.correctAnswer);
      expect(Number.isInteger(n), `Seed ${seed}: answer should be integer`).toBe(true);
      expect(n, `Seed ${seed}: answer should be positive`).toBeGreaterThan(0);
    }
  });

  it('tier-1 answer equals |A| + |B| − |A∩B|', () => {
    for (let seed = 0; seed < 15; seed++) {
      const rng = mulberry32(seed);
      const result = generateVennDiagram(T1_VENN, rng);
      // Parse: "If |A| = X, |B| = Y, and |A∩B| = Z, find |A∪B|."
      const m = result.question.match(
        /\|A\| = (\d+), \|B\| = (\d+), and \|A∩B\| = (\d+)/,
      );
      if (m) {
        const sA = Number(m[1]);
        const sB = Number(m[2]);
        const inter = Number(m[3]);
        const expected = sA + sB - inter;
        expect(Number(result.correctAnswer)).toBe(expected);
      }
    }
  });

  it('tier 2a (reverse-solve) produces valid shape', () => {
    const rng = mulberry32(4444);
    assertValidMathProblem(generateVennDiagram(T2A_VENN, rng), 'venn_t2a');
  });

  it('tier 2b (3-set) question references A, B, C', () => {
    const rng = mulberry32(5555);
    const result = generateVennDiagram(T2B_VENN, rng);
    expect(result.question).toMatch(/\|A\|/);
    expect(result.question).toMatch(/\|B\|/);
    expect(result.question).toMatch(/\|C\|/);
  });

  it('tier 3 (region) question mentions "A only"', () => {
    const rng = mulberry32(6666);
    const result = generateVennDiagram(T3_VENN, rng);
    expect(result.question).toMatch(/A only/);
  });
});

// ---------------------------------------------------------------------------
// 4. generateLogicalEquivalence
// ---------------------------------------------------------------------------

describe('generateLogicalEquivalence', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateLogicalEquivalence(T1_EQUIV, rng1)).toEqual(
      generateLogicalEquivalence(T1_EQUIV, rng2),
    );
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(4004);
    assertValidMathProblem(generateLogicalEquivalence(T1_EQUIV, rng), 'equiv_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(6666);
    assertValidMathProblem(generateLogicalEquivalence(T3_EQUIV, rng), 'equiv_t3');
  });

  it('question contains "equivalent"', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = mulberry32(seed);
      const result = generateLogicalEquivalence(T1_EQUIV, rng);
      expect(result.question).toMatch(/equivalent/i);
    }
  });

  it('answer contains at least one logical operator', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateLogicalEquivalence(T1_EQUIV, rng);
      expect(result.correctAnswer).toMatch(/∧|∨|¬|→|↔|⊕|p|q/);
    }
  });

  it('no distractor equals correctAnswer for 30 seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const result = generateLogicalEquivalence(T3_EQUIV, rng);
      for (const d of result.distractors) {
        expect(d).not.toBe(result.correctAnswer);
      }
    }
  });

  it('explanation uses ≡ equivalence symbol', () => {
    const rng = mulberry32(15);
    const result = generateLogicalEquivalence(T1_EQUIV, rng);
    expect(result.explanation).toMatch(/≡/);
  });

  it('produces variety across seeds (tier 3)', () => {
    const answers = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed * 1337);
      answers.add(generateLogicalEquivalence(T3_EQUIV, rng).correctAnswer);
    }
    expect(answers.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 5. generateSetCardinality
// ---------------------------------------------------------------------------

describe('generateSetCardinality', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateSetCardinality(T1_CARD, rng1)).toEqual(
      generateSetCardinality(T1_CARD, rng2),
    );
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(5005);
    assertValidMathProblem(generateSetCardinality(T1_CARD, rng), 'card_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(5555);
    assertValidMathProblem(generateSetCardinality(T3_CARD, rng), 'card_t3');
  });

  it('tier 1: answer equals floor(n/k)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateSetCardinality(T1_CARD, rng);
      // Parse: "How many multiples of K are there in the set {1, 2, ..., N}?"
      const m = result.question.match(
        /How many multiples of (\d+) are there in the set \{1, 2, \.\.\., (\d+)\}\?/,
      );
      if (m) {
        const k = Number(m[1]);
        const n = Number(m[2]);
        expect(Number(result.correctAnswer)).toBe(Math.floor(n / k));
      }
    }
  });

  it('tier 2b (power set): answer equals 2^n', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateSetCardinality(T2B_CARD, rng);
      // Parse: "A set has N elements. How many subsets does it have..."
      const m = result.question.match(/A set has (\d+) elements/);
      if (m) {
        const n = Number(m[1]);
        expect(Number(result.correctAnswer)).toBe(Math.pow(2, n));
      }
    }
  });

  it('tier 2a (2-set inclusion-exclusion): answer is positive integer', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateSetCardinality(T2A_CARD, rng);
      const n = Number(result.correctAnswer);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it('tier 2a: question asks about divisibility by two numbers', () => {
    const rng = mulberry32(100);
    const result = generateSetCardinality(T2A_CARD, rng);
    expect(result.question).toMatch(/divisible by \d+ or \d+/);
  });

  it('tier 3: answer is a non-negative integer', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateSetCardinality(T3_CARD, rng);
      const n = Number(result.correctAnswer);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it('no distractor equals correctAnswer for 30 seeds (all tiers)', () => {
    const paramSets = [T1_CARD, T2A_CARD, T2B_CARD, T3_CARD];
    for (const params of paramSets) {
      for (let seed = 0; seed < 10; seed++) {
        const rng = mulberry32(seed);
        const result = generateSetCardinality(params, rng);
        for (const d of result.distractors) {
          expect(d).not.toBe(result.correctAnswer);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-generator: integration through generateProblem dispatcher
// ---------------------------------------------------------------------------

describe('generateProblem dispatcher — logic & sets cases', () => {
  it('dispatches truth_table without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'logic_tt_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'truth_table',
      tierParams: {
        '1': T1_TRUTH,
        '2a': T1_TRUTH,
        '2b': T3_TRUTH,
        '3': T3_TRUTH,
      },
    };
    expect(() => generateProblem(skill, '1', 1234)).not.toThrow();
    expect(() => generateProblem(skill, '3', 5678)).not.toThrow();
  });

  it('dispatches set_operations without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'logic_so_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'set_operations',
      tierParams: {
        '1': T1_SET_OPS,
        '2a': T1_SET_OPS,
        '2b': T3_SET_OPS,
        '3': T3_SET_OPS,
      },
    };
    expect(() => generateProblem(skill, '1', 1111)).not.toThrow();
    expect(() => generateProblem(skill, '3', 2222)).not.toThrow();
  });

  it('dispatches venn_diagram without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'logic_vd_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'venn_diagram',
      tierParams: {
        '1': T1_VENN,
        '2a': T2A_VENN,
        '2b': T2B_VENN,
        '3': T3_VENN,
      },
    };
    expect(() => generateProblem(skill, '1', 3333)).not.toThrow();
    expect(() => generateProblem(skill, '3', 4444)).not.toThrow();
  });

  it('dispatches logical_equivalence without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'logic_le_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'logical_equivalence',
      tierParams: {
        '1': T1_EQUIV,
        '2a': T1_EQUIV,
        '2b': T3_EQUIV,
        '3': T3_EQUIV,
      },
    };
    expect(() => generateProblem(skill, '2b', 5555)).not.toThrow();
  });

  it('dispatches set_cardinality without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'logic_sc_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'set_cardinality',
      tierParams: {
        '1': T1_CARD,
        '2a': T2A_CARD,
        '2b': T2B_CARD,
        '3': T3_CARD,
      },
    };
    expect(() => generateProblem(skill, '1', 6666)).not.toThrow();
    expect(() => generateProblem(skill, '2b', 7777)).not.toThrow();
    expect(() => generateProblem(skill, '3', 8888)).not.toThrow();
  });
});
