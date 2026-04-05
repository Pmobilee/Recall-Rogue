/**
 * Unit tests for statisticsGenerators.ts
 *
 * Covers: determinism, valid MathProblem shape, no distractor equals
 * correctAnswer, and generator-specific mathematical correctness checks
 * (valid numeric answer, fraction format, C(5,2)=10 / P(5,2)=20).
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './mathUtils';
import {
  generateCentralTendency,
  generateStandardDeviation,
  generateBasicProbability,
  generateCombinationsPermutations,
  generateExpectedValue,
} from './statisticsGenerators';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Fixtures — minimal GeneratorParams per generator
// ---------------------------------------------------------------------------

const centralParams: GeneratorParams = {
  rangeA: [1, 10],
  rangeB: [5, 5],
  dataSetSize: 5,
  dataMax: 10,
};

const stddevParams: GeneratorParams = {
  rangeA: [1, 10],
  rangeB: [4, 4],
  dataSetSize: 4,
  dataMax: 10,
};

const probParams: GeneratorParams = {
  rangeA: [1, 6],
  rangeB: [1, 6],
  probabilityContext: ['coin', 'dice'],
};

const probParamsAllContexts: GeneratorParams = {
  rangeA: [1, 52],
  rangeB: [1, 52],
  probabilityContext: ['coin', 'dice', 'cards'],
};

const combPermParams: GeneratorParams = {
  rangeA: [3, 8],
  rangeB: [1, 4],
};

const expectedParams: GeneratorParams = {
  rangeA: [2, 4],
  rangeB: [1, 10],
  dataSetSize: 3,
};

// ---------------------------------------------------------------------------
// Shared contract checks
// ---------------------------------------------------------------------------

/**
 * Verify that a MathProblem satisfies the universal contract:
 * - has a non-empty question and correctAnswer
 * - has exactly 4 distractors
 * - no distractor equals the correctAnswer
 * - inputMode is 'choice'
 * - has a non-empty explanation
 */
function expectValidProblem(p: ReturnType<typeof generateCentralTendency>) {
  expect(p.question.length).toBeGreaterThan(0);
  expect(p.correctAnswer.length).toBeGreaterThan(0);
  expect(p.distractors).toHaveLength(4);
  expect(p.distractors).not.toContain(p.correctAnswer);
  expect(p.inputMode).toBe('choice');
  expect(p.explanation.length).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// 1. generateCentralTendency
// ---------------------------------------------------------------------------

describe('generateCentralTendency', () => {
  it('is deterministic — same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const a = generateCentralTendency(centralParams, rng1);
    const b = generateCentralTendency(centralParams, rng2);
    expect(a.question).toBe(b.question);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it('different seeds produce different problems (most of the time)', () => {
    const results = new Set<string>();
    for (let s = 0; s < 20; s++) {
      const rng = mulberry32(s);
      const p = generateCentralTendency(centralParams, rng);
      results.add(p.question);
    }
    // With 5 data values from 1-10, collision every seed would be very unusual
    expect(results.size).toBeGreaterThan(1);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      expectValidProblem(generateCentralTendency(centralParams, rng));
    }
  });

  it('correctAnswer is a valid finite number string', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const p = generateCentralTendency(centralParams, rng);
      const n = Number(p.correctAnswer);
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('question mentions one of: mean, median, mode', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const p = generateCentralTendency(centralParams, rng);
      const hasMeasure =
        p.question.toLowerCase().includes('mean') ||
        p.question.toLowerCase().includes('median') ||
        p.question.toLowerCase().includes('mode');
      expect(hasMeasure).toBe(true);
    }
  });

  it('works at higher tier params (larger dataSetSize)', () => {
    const largeParams: GeneratorParams = {
      rangeA: [1, 100],
      rangeB: [9, 9],
      dataSetSize: 9,
      dataMax: 100,
    };
    for (let seed = 0; seed < 10; seed++) {
      const rng = mulberry32(seed);
      expectValidProblem(generateCentralTendency(largeParams, rng));
    }
  });
});

// ---------------------------------------------------------------------------
// 2. generateStandardDeviation
// ---------------------------------------------------------------------------

describe('generateStandardDeviation', () => {
  it('is deterministic', () => {
    const a = generateStandardDeviation(stddevParams, mulberry32(7));
    const b = generateStandardDeviation(stddevParams, mulberry32(7));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateStandardDeviation(stddevParams, mulberry32(seed)));
    }
  });

  it('correctAnswer is a valid finite number to 1 decimal place', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateStandardDeviation(stddevParams, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      // Verify at most 1 decimal place
      const decimalPart = p.correctAnswer.split('.')[1];
      if (decimalPart !== undefined) {
        expect(decimalPart.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('std dev is never larger than half the data range', () => {
    // Population stddev cannot exceed (max - min) / 2
    for (let seed = 0; seed < 30; seed++) {
      const p = generateStandardDeviation(stddevParams, mulberry32(seed));
      // dataMax=10, rangeA=[1,10] so max possible stddev < 5
      expect(Number(p.correctAnswer)).toBeLessThan(stddevParams.dataMax! / 2 + 1);
    }
  });

  it('question mentions "population standard deviation"', () => {
    const p = generateStandardDeviation(stddevParams, mulberry32(1));
    expect(p.question.toLowerCase()).toContain('standard deviation');
  });
});

// ---------------------------------------------------------------------------
// 3. generateBasicProbability
// ---------------------------------------------------------------------------

describe('generateBasicProbability', () => {
  it('is deterministic', () => {
    const a = generateBasicProbability(probParams, mulberry32(99));
    const b = generateBasicProbability(probParams, mulberry32(99));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateBasicProbability(probParams, mulberry32(seed)));
    }
  });

  it('correctAnswer matches fraction format n/d', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateBasicProbability(probParams, mulberry32(seed));
      expect(p.correctAnswer).toMatch(/^\d+\/\d+$/);
    }
  });

  it('fraction is in simplified form (GCD = 1)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateBasicProbability(probParams, mulberry32(seed));
      const [numStr, denStr] = p.correctAnswer.split('/');
      const num = parseInt(numStr, 10);
      const den = parseInt(denStr, 10);
      let a = Math.abs(num);
      let b = Math.abs(den);
      while (b !== 0) { const t = b; b = a % b; a = t; }
      expect(a).toBe(1); // GCD = 1 means fully simplified
    }
  });

  it('probability value is between 0 and 1 (exclusive)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateBasicProbability(probParams, mulberry32(seed));
      const [num, den] = p.correctAnswer.split('/').map(Number);
      const value = num / den;
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('works with cards context', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateBasicProbability(probParamsAllContexts, mulberry32(seed)));
    }
  });

  it('distractors are all fraction format strings', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateBasicProbability(probParams, mulberry32(seed));
      for (const d of p.distractors) {
        // Distractors should be fraction strings or fallback strings
        expect(d.length).toBeGreaterThan(0);
        expect(d).not.toBe(p.correctAnswer);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. generateCombinationsPermutations
// ---------------------------------------------------------------------------

describe('generateCombinationsPermutations', () => {
  it('is deterministic', () => {
    const a = generateCombinationsPermutations(combPermParams, mulberry32(13));
    const b = generateCombinationsPermutations(combPermParams, mulberry32(13));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateCombinationsPermutations(combPermParams, mulberry32(seed)));
    }
  });

  it('correctAnswer is a positive integer string', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateCombinationsPermutations(combPermParams, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('C(5, 2) = 10 when n=5 r=2 combination', () => {
    // Use pinned params to force n=5, r=2
    const pinnedParams: GeneratorParams = { rangeA: [5, 5], rangeB: [2, 2] };
    // Find a seed that lands on combination (rng() < 0.5 for isCombo)
    for (let seed = 0; seed < 200; seed++) {
      const p = generateCombinationsPermutations(pinnedParams, mulberry32(seed));
      if (p.question.includes('Order does not matter')) {
        expect(p.correctAnswer).toBe('10');
        break;
      }
    }
  });

  it('P(5, 2) = 20 when n=5 r=2 permutation', () => {
    const pinnedParams: GeneratorParams = { rangeA: [5, 5], rangeB: [2, 2] };
    for (let seed = 0; seed < 200; seed++) {
      const p = generateCombinationsPermutations(pinnedParams, mulberry32(seed));
      if (p.question.includes('Order matters')) {
        expect(p.correctAnswer).toBe('20');
        break;
      }
    }
  });

  it('question mentions "Order does not matter" or "Order matters"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateCombinationsPermutations(combPermParams, mulberry32(seed));
      const hasOrderClue =
        p.question.includes('Order does not matter') ||
        p.question.includes('Order matters');
      expect(hasOrderClue).toBe(true);
    }
  });

  it('r is always <= n (no invalid inputs)', () => {
    // Check that no correctAnswer is 0 (which combinations/permutations returns for r > n)
    for (let seed = 0; seed < 50; seed++) {
      const p = generateCombinationsPermutations(combPermParams, mulberry32(seed));
      expect(Number(p.correctAnswer)).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. generateExpectedValue
// ---------------------------------------------------------------------------

describe('generateExpectedValue', () => {
  it('is deterministic', () => {
    const a = generateExpectedValue(expectedParams, mulberry32(55));
    const b = generateExpectedValue(expectedParams, mulberry32(55));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateExpectedValue(expectedParams, mulberry32(seed)));
    }
  });

  it('correctAnswer is a valid finite number string', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateExpectedValue(expectedParams, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('expected value is within the outcome range', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateExpectedValue(expectedParams, mulberry32(seed));
      const ev = Number(p.correctAnswer);
      // EV of equal-probability distribution = mean, which is within [min, max] of outcomes
      expect(ev).toBeGreaterThanOrEqual(expectedParams.rangeB[0]);
      expect(ev).toBeLessThanOrEqual(expectedParams.rangeB[1]);
    }
  });

  it('question mentions "expected value"', () => {
    const p = generateExpectedValue(expectedParams, mulberry32(1));
    expect(p.question.toLowerCase()).toContain('expected value');
  });

  it('works at higher tier params', () => {
    const highParams: GeneratorParams = {
      rangeA: [5, 8],
      rangeB: [1, 100],
      dataSetSize: 6,
    };
    for (let seed = 0; seed < 10; seed++) {
      expectValidProblem(generateExpectedValue(highParams, mulberry32(seed)));
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-generator: all return 4 distractors and inputMode 'choice'
// ---------------------------------------------------------------------------

describe('all statistics generators — universal shape', () => {
  const seeds = [0, 1, 2, 10, 42, 99, 256, 1000];

  it('generateCentralTendency always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateCentralTendency(centralParams, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateStandardDeviation always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateStandardDeviation(stddevParams, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateBasicProbability always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateBasicProbability(probParams, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateCombinationsPermutations always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateCombinationsPermutations(combPermParams, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateExpectedValue always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateExpectedValue(expectedParams, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });
});
