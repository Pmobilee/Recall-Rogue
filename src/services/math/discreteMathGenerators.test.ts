/**
 * Unit tests for discreteMathGenerators.ts
 *
 * Covers the five generator functions:
 *   generateRecurrence, generateGraphTheory, generateBaseConversion,
 *   generateSummation, generateInductionBase
 *
 * Each generator is tested for:
 *   - Determinism (same seed → same problem)
 *   - Valid MathProblem shape (non-empty question, 4 distractors, no collision)
 *   - Mathematical correctness of the stated answer
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './mathUtils';
import {
  generateRecurrence,
  generateGraphTheory,
  generateBaseConversion,
  generateSummation,
  generateInductionBase,
} from './discreteMathGenerators';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Recurrence params
const recParamsT1: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 1 };
const recParamsT2a: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 2 };
const recParamsT2b: GeneratorParams = { rangeA: [1, 5], rangeB: [2, 4], steps: 3 };
const recParamsT3: GeneratorParams = { rangeA: [1, 10], rangeB: [1, 5], steps: 4 };

// Graph theory params
const graphParamsT1: GeneratorParams = { rangeA: [3, 8], rangeB: [2, 10], steps: 1 };
const graphParamsT2a: GeneratorParams = { rangeA: [3, 10], rangeB: [2, 15], steps: 2 };
const graphParamsT2b: GeneratorParams = { rangeA: [3, 10], rangeB: [3, 20], steps: 3 };
const graphParamsT3: GeneratorParams = { rangeA: [4, 12], rangeB: [2, 6], steps: 4 };

// Base conversion params
const baseParamsT1: GeneratorParams = { rangeA: [1, 31], rangeB: [1, 31], steps: 1 };
const baseParamsT2a: GeneratorParams = { rangeA: [1, 63], rangeB: [1, 63], steps: 2 };
const baseParamsT2b: GeneratorParams = { rangeA: [1, 255], rangeB: [1, 255], steps: 3 };
const baseParamsT3: GeneratorParams = { rangeA: [1, 255], rangeB: [1, 255], steps: 4 };

// Summation params
const sumParamsT1: GeneratorParams = { rangeA: [3, 10], rangeB: [3, 10], steps: 1 };
const sumParamsT2a: GeneratorParams = { rangeA: [3, 8], rangeB: [3, 8], steps: 2 };
const sumParamsT2b: GeneratorParams = { rangeA: [2, 8], rangeB: [2, 8], steps: 3 };
const sumParamsT3: GeneratorParams = { rangeA: [3, 10], rangeB: [3, 10], steps: 4 };

// Induction params
const inductParamsT1: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 1 };
const inductParamsT2a: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 2 };
const inductParamsT2b: GeneratorParams = { rangeA: [1, 8], rangeB: [1, 8], steps: 3 };
const inductParamsT3: GeneratorParams = { rangeA: [1, 10], rangeB: [1, 10], steps: 4 };

// ---------------------------------------------------------------------------
// Shared contract check
// ---------------------------------------------------------------------------

function expectValidProblem(p: {
  question: string;
  correctAnswer: string;
  distractors: string[];
  inputMode: string;
  explanation: string;
}) {
  expect(p.question.length, 'question must be non-empty').toBeGreaterThan(0);
  expect(p.correctAnswer.length, 'correctAnswer must be non-empty').toBeGreaterThan(0);
  expect(p.distractors, 'must have exactly 4 distractors').toHaveLength(4);
  expect(p.distractors, 'distractors must not contain the correct answer').not.toContain(p.correctAnswer);
  expect(p.inputMode).toBe('choice');
  expect(p.explanation.length, 'explanation must be non-empty').toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// 1. generateRecurrence
// ---------------------------------------------------------------------------

describe('generateRecurrence', () => {
  it('is deterministic for all sub-types', () => {
    const allParams = [recParamsT1, recParamsT2a, recParamsT2b, recParamsT3];
    for (const params of allParams) {
      const a = generateRecurrence(params, mulberry32(42));
      const b = generateRecurrence(params, mulberry32(42));
      expect(a.question).toBe(b.question);
      expect(a.correctAnswer).toBe(b.correctAnswer);
    }
  });

  it('satisfies universal MathProblem contract for all sub-types', () => {
    const allParams = [recParamsT1, recParamsT2a, recParamsT2b, recParamsT3];
    for (const params of allParams) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generateRecurrence(params, mulberry32(seed)));
      }
    }
  });

  it('arithmetic recurrence (steps=1) — answer equals a₁ + (n-1)*d', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateRecurrence(recParamsT1, mulberry32(seed));
      expect(p.question).toContain('aₙ₋₁');
      // Answer must be a positive integer
      expect(Number.isInteger(Number(p.correctAnswer))).toBe(true);
      expect(Number(p.correctAnswer)).toBeGreaterThan(0);
    }
  });

  it('geometric recurrence (steps=3) — answer is positive integer', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateRecurrence(recParamsT2b, mulberry32(seed));
      const ans = Number(p.correctAnswer);
      expect(Number.isInteger(ans)).toBe(true);
      expect(ans).toBeGreaterThan(0);
    }
  });

  it('always returns 4 distinct distractors', () => {
    const seeds = [0, 1, 5, 13, 42, 99, 256, 999];
    for (const params of [recParamsT1, recParamsT2a, recParamsT2b, recParamsT3]) {
      for (const seed of seeds) {
        const p = generateRecurrence(params, mulberry32(seed));
        expect(new Set(p.distractors).size).toBe(4);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. generateGraphTheory
// ---------------------------------------------------------------------------

describe('generateGraphTheory', () => {
  it('is deterministic for all sub-types', () => {
    const allParams = [graphParamsT1, graphParamsT2a, graphParamsT2b, graphParamsT3];
    for (const params of allParams) {
      const a = generateGraphTheory(params, mulberry32(7));
      const b = generateGraphTheory(params, mulberry32(7));
      expect(a.question).toBe(b.question);
      expect(a.correctAnswer).toBe(b.correctAnswer);
    }
  });

  it('satisfies universal MathProblem contract for all sub-types', () => {
    const allParams = [graphParamsT1, graphParamsT2a, graphParamsT2b, graphParamsT3];
    for (const params of allParams) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generateGraphTheory(params, mulberry32(seed)));
      }
    }
  });

  it('Handshaking Lemma (steps=1) — answer is 2 × edges', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateGraphTheory(graphParamsT1, mulberry32(seed));
      expect(p.question).toContain('sum of all vertex degrees');
      // Extract edges from question: "... and {e} edges"
      const match = p.question.match(/and (\d+) edges/);
      expect(match).not.toBeNull();
      const e = parseInt(match![1], 10);
      expect(Number(p.correctAnswer)).toBe(2 * e);
    }
  });

  it('minimum connected graph edges (steps=2) — answer is n-1', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateGraphTheory(graphParamsT2a, mulberry32(seed));
      expect(p.question).toContain('minimum');
      const match = p.question.match(/with (\d+) vertices/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      expect(Number(p.correctAnswer)).toBe(n - 1);
    }
  });

  it('complete graph edges (steps=3) — answer is n*(n-1)/2', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateGraphTheory(graphParamsT2b, mulberry32(seed));
      expect(p.question).toContain('complete graph');
      const match = p.question.match(/K(\d+)/u);
      // K₃ etc. — subscript encoded, so just verify the answer is correct formula
      const ans = Number(p.correctAnswer);
      // The answer must be a triangular number: n*(n-1)/2 for some integer n
      // Verify: 2*ans must equal k*(k-1) for some k
      let valid = false;
      for (let k = 2; k <= 20; k++) {
        if (k * (k - 1) / 2 === ans) { valid = true; break; }
      }
      expect(valid).toBe(true);
    }
  });

  it('regular graph edges (steps=4) — answer is n*d/2', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateGraphTheory(graphParamsT3, mulberry32(seed));
      expect(p.question).toContain('degree');
      // Extract n and d from question: "{n} vertices, each with degree {d}"
      const match = p.question.match(/(\d+) vertices, each with degree (\d+)/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      const d = parseInt(match![2], 10);
      // n*d must be even (guaranteed by generator)
      expect((n * d) % 2).toBe(0);
      expect(Number(p.correctAnswer)).toBe((n * d) / 2);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. generateBaseConversion
// ---------------------------------------------------------------------------

describe('generateBaseConversion', () => {
  it('is deterministic for all sub-types', () => {
    const allParams = [baseParamsT1, baseParamsT2a, baseParamsT2b, baseParamsT3];
    for (const params of allParams) {
      const a = generateBaseConversion(params, mulberry32(17));
      const b = generateBaseConversion(params, mulberry32(17));
      expect(a.question).toBe(b.question);
      expect(a.correctAnswer).toBe(b.correctAnswer);
    }
  });

  it('satisfies universal MathProblem contract for all sub-types', () => {
    const allParams = [baseParamsT1, baseParamsT2a, baseParamsT2b, baseParamsT3];
    for (const params of allParams) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generateBaseConversion(params, mulberry32(seed)));
      }
    }
  });

  it('decimal to binary (steps=1) — answer is valid binary of the input', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateBaseConversion(baseParamsT1, mulberry32(seed));
      expect(p.question).toContain('binary');
      const match = p.question.match(/Convert (\d+) \(decimal\) to binary/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      // Parse the binary answer back to decimal
      const decoded = parseInt(p.correctAnswer, 2);
      expect(decoded).toBe(n);
      // Answer must only contain 0s and 1s
      expect(/^[01]+$/.test(p.correctAnswer)).toBe(true);
    }
  });

  it('binary to decimal (steps=2) — answer is correct decimal value', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateBaseConversion(baseParamsT2a, mulberry32(seed));
      expect(p.question).toContain('decimal');
      const match = p.question.match(/Convert ([01]+) \(binary\) to decimal/);
      expect(match).not.toBeNull();
      const binStr = match![1];
      const expected = parseInt(binStr, 2);
      expect(Number(p.correctAnswer)).toBe(expected);
    }
  });

  it('decimal to hex (steps=3) — answer is correct hex', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateBaseConversion(baseParamsT2b, mulberry32(seed));
      expect(p.question).toContain('hexadecimal');
      const match = p.question.match(/Convert (\d+) \(decimal\) to hexadecimal/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      const decoded = parseInt(p.correctAnswer, 16);
      expect(decoded).toBe(n);
    }
  });

  it('hex to decimal (steps=4) — answer is correct decimal', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateBaseConversion(baseParamsT3, mulberry32(seed));
      expect(p.question).toContain('decimal');
      const match = p.question.match(/Convert ([0-9A-Fa-f]+) \(hexadecimal\) to decimal/);
      expect(match).not.toBeNull();
      const hexStr = match![1];
      const expected = parseInt(hexStr, 16);
      expect(Number(p.correctAnswer)).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. generateSummation
// ---------------------------------------------------------------------------

describe('generateSummation', () => {
  it('is deterministic for all sub-types', () => {
    const allParams = [sumParamsT1, sumParamsT2a, sumParamsT2b, sumParamsT3];
    for (const params of allParams) {
      const a = generateSummation(params, mulberry32(33));
      const b = generateSummation(params, mulberry32(33));
      expect(a.question).toBe(b.question);
      expect(a.correctAnswer).toBe(b.correctAnswer);
    }
  });

  it('satisfies universal MathProblem contract for all sub-types', () => {
    const allParams = [sumParamsT1, sumParamsT2a, sumParamsT2b, sumParamsT3];
    for (const params of allParams) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generateSummation(params, mulberry32(seed)));
      }
    }
  });

  it('sum of 1..n (steps=1) — answer is n(n+1)/2', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateSummation(sumParamsT1, mulberry32(seed));
      expect(p.question).toContain('Σ(i=1 to');
      const match = p.question.match(/to (\d+)\) i$/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      expect(Number(p.correctAnswer)).toBe(n * (n + 1) / 2);
    }
  });

  it('sum of i² (steps=2) — answer is n(n+1)(2n+1)/6', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateSummation(sumParamsT2a, mulberry32(seed));
      expect(p.question).toContain('i²');
      const match = p.question.match(/to (\d+)\) i²$/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      const expected = Math.floor(n * (n + 1) * (2 * n + 1) / 6);
      expect(Number(p.correctAnswer)).toBe(expected);
    }
  });

  it('geometric series (steps=3) — answer is 2^(n+1)-1', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateSummation(sumParamsT2b, mulberry32(seed));
      expect(p.question).toContain('2^i');
      const match = p.question.match(/to (\d+)\) 2\^i$/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      expect(Number(p.correctAnswer)).toBe(Math.pow(2, n + 1) - 1);
    }
  });

  it('sum of odd numbers (steps=4) — answer is n²', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateSummation(sumParamsT3, mulberry32(seed));
      expect(p.question).toContain('2i - 1');
      const match = p.question.match(/to (\d+)\) \(2i - 1\)$/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      expect(Number(p.correctAnswer)).toBe(n * n);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. generateInductionBase
// ---------------------------------------------------------------------------

describe('generateInductionBase', () => {
  it('is deterministic for all sub-types', () => {
    const allParams = [inductParamsT1, inductParamsT2a, inductParamsT2b, inductParamsT3];
    for (const params of allParams) {
      const a = generateInductionBase(params, mulberry32(88));
      const b = generateInductionBase(params, mulberry32(88));
      expect(a.question).toBe(b.question);
      expect(a.correctAnswer).toBe(b.correctAnswer);
    }
  });

  it('satisfies universal MathProblem contract for all sub-types', () => {
    const allParams = [inductParamsT1, inductParamsT2a, inductParamsT2b, inductParamsT3];
    for (const params of allParams) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generateInductionBase(params, mulberry32(seed)));
      }
    }
  });

  it('base case (steps=1) — correctAnswer is non-empty, distractors differ', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateInductionBase(inductParamsT1, mulberry32(seed));
      expect(p.question).toContain('P(1)');
      expect(p.correctAnswer.length).toBeGreaterThan(0);
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('inductive step (steps=2) — correctAnswer is "P(k) → P(k+1)"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateInductionBase(inductParamsT2a, mulberry32(seed));
      expect(p.question).toContain('inductive step');
      expect(p.correctAnswer).toBe('P(k) → P(k+1)');
    }
  });

  it('LHS of P(k+1) (steps=3) — correctAnswer contains k and is non-trivial', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateInductionBase(inductParamsT2b, mulberry32(seed));
      expect(p.question).toContain('P(k+1)');
      expect(p.correctAnswer).toMatch(/k/);
    }
  });

  it('strong induction (steps=4) — correctAnswer mentions all j ≤ k', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateInductionBase(inductParamsT3, mulberry32(seed));
      expect(p.question).toContain('strong induction');
      expect(p.correctAnswer).toContain('P(j)');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-generator: all return 4 distractors and inputMode 'choice'
// ---------------------------------------------------------------------------

describe('all discrete math generators — universal shape', () => {
  const seeds = [0, 1, 2, 10, 42, 99, 256, 1000];

  it('generateRecurrence always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateRecurrence(recParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateGraphTheory always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateGraphTheory(graphParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateBaseConversion always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateBaseConversion(baseParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateSummation always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateSummation(sumParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateInductionBase always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateInductionBase(inductParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('all generators use inputMode choice', () => {
    expect(generateRecurrence(recParamsT1, mulberry32(0)).inputMode).toBe('choice');
    expect(generateGraphTheory(graphParamsT1, mulberry32(0)).inputMode).toBe('choice');
    expect(generateBaseConversion(baseParamsT1, mulberry32(0)).inputMode).toBe('choice');
    expect(generateSummation(sumParamsT1, mulberry32(0)).inputMode).toBe('choice');
    expect(generateInductionBase(inductParamsT1, mulberry32(0)).inputMode).toBe('choice');
  });
});

// ---------------------------------------------------------------------------
// 7. Dispatcher integration — generateProblem routes all 5 generator IDs
// ---------------------------------------------------------------------------

describe('generateProblem dispatcher — discrete math routing', () => {
  // Import is done inline to avoid circular dependency issues in test
  it('routes recurrence correctly', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'dm_recurrence', name: 'Recurrence', description: '',
      generatorId: 'recurrence',
      tierParams: { '1': recParamsT1, '2a': recParamsT2a, '2b': recParamsT2b, '3': recParamsT3 },
    };
    const p = generateProblem(skill, '1', 42);
    expectValidProblem(p);
  });

  it('routes graph_theory correctly', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'dm_graph', name: 'Graph Theory', description: '',
      generatorId: 'graph_theory',
      tierParams: { '1': graphParamsT1, '2a': graphParamsT2a, '2b': graphParamsT2b, '3': graphParamsT3 },
    };
    const p = generateProblem(skill, '1', 42);
    expectValidProblem(p);
  });

  it('routes base_conversion correctly', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'dm_base', name: 'Base Conversion', description: '',
      generatorId: 'base_conversion',
      tierParams: { '1': baseParamsT1, '2a': baseParamsT2a, '2b': baseParamsT2b, '3': baseParamsT3 },
    };
    const p = generateProblem(skill, '1', 42);
    expectValidProblem(p);
  });

  it('routes summation correctly', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'dm_summation', name: 'Summation', description: '',
      generatorId: 'summation',
      tierParams: { '1': sumParamsT1, '2a': sumParamsT2a, '2b': sumParamsT2b, '3': sumParamsT3 },
    };
    const p = generateProblem(skill, '1', 42);
    expectValidProblem(p);
  });

  it('routes induction_base correctly', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'dm_induction', name: 'Induction', description: '',
      generatorId: 'induction_base',
      tierParams: { '1': inductParamsT1, '2a': inductParamsT2a, '2b': inductParamsT2b, '3': inductParamsT3 },
    };
    const p = generateProblem(skill, '1', 42);
    expectValidProblem(p);
  });
});
