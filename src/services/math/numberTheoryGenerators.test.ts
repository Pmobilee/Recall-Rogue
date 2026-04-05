/**
 * Unit tests for numberTheoryGenerators.ts
 *
 * Covers: helper functions (isPrime, nextPrime, nthPrime, countPrimesInRange,
 * primeFactorize, formatFactorization, countDivisors), plus the five generator
 * functions (generatePrimeFactorization, generateLcmGcd,
 * generateModularArithmetic, generateDivisibility, generatePrimeIdentification).
 *
 * Each generator is tested for:
 *   - Determinism (same seed → same problem)
 *   - Valid MathProblem shape (question, correctAnswer, 4 distractors, no collision)
 *   - Mathematical correctness of the stated answer
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './mathUtils';
import {
  isPrime,
  nextPrime,
  nthPrime,
  countPrimesInRange,
  primeFactorize,
  formatFactorization,
  countDivisors,
  generatePrimeFactorization,
  generateLcmGcd,
  generateModularArithmetic,
  generateDivisibility,
  generatePrimeIdentification,
} from './numberTheoryGenerators';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const factorizationParamsT1: GeneratorParams = { rangeA: [2, 7], rangeB: [2, 4], steps: 2 };
const factorizationParamsT3: GeneratorParams = { rangeA: [2, 17], rangeB: [2, 8], steps: 4 };

const lcmGcdParamsGcdOnly: GeneratorParams = { rangeA: [1, 5], rangeB: [2, 6], steps: 1 };
const lcmGcdParamsBoth: GeneratorParams = { rangeA: [2, 10], rangeB: [2, 8], steps: 2 };

const modParamsBasic: GeneratorParams = { rangeA: [5, 30], rangeB: [2, 9], steps: 1 };
const modParamsAdd: GeneratorParams = { rangeA: [5, 50], rangeB: [2, 12], steps: 2 };
const modParamsMul: GeneratorParams = { rangeA: [5, 50], rangeB: [2, 15], steps: 3 };
const modParamsExp: GeneratorParams = { rangeA: [2, 10], rangeB: [5, 15], steps: 4 };

const divisibilityParamsT1: GeneratorParams = { rangeA: [2, 7], rangeB: [2, 4], steps: 2 };
const divisibilityParamsT3: GeneratorParams = { rangeA: [2, 17], rangeB: [2, 10], steps: 4 };

const primeIdParamsT1: GeneratorParams = { rangeA: [2, 30], rangeB: [2, 30], steps: 1 };
const primeIdParamsT2a: GeneratorParams = { rangeA: [2, 50], rangeB: [2, 50], steps: 2 };
const primeIdParamsT2b: GeneratorParams = { rangeA: [2, 50], rangeB: [2, 50], steps: 3 };
const primeIdParamsT3: GeneratorParams = { rangeA: [1, 20], rangeB: [2, 73], steps: 4 };

// ---------------------------------------------------------------------------
// Shared contract check
// ---------------------------------------------------------------------------

function expectValidProblem(p: { question: string; correctAnswer: string; distractors: string[]; inputMode: string; explanation: string }) {
  expect(p.question.length).toBeGreaterThan(0);
  expect(p.correctAnswer.length).toBeGreaterThan(0);
  expect(p.distractors).toHaveLength(4);
  expect(p.distractors).not.toContain(p.correctAnswer);
  expect(p.inputMode).toBe('choice');
  expect(p.explanation.length).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// 1. Helper: isPrime
// ---------------------------------------------------------------------------

describe('isPrime', () => {
  it('returns false for n < 2', () => {
    expect(isPrime(0)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(-5)).toBe(false);
  });

  it('returns true for known primes', () => {
    for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 97]) {
      expect(isPrime(p)).toBe(true);
    }
  });

  it('returns false for known composites', () => {
    for (const n of [4, 6, 8, 9, 10, 12, 15, 20, 25, 49, 100]) {
      expect(isPrime(n)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Helper: nextPrime
// ---------------------------------------------------------------------------

describe('nextPrime', () => {
  it('nextPrime(1) = 2', () => expect(nextPrime(1)).toBe(2));
  it('nextPrime(2) = 3', () => expect(nextPrime(2)).toBe(3));
  it('nextPrime(10) = 11', () => expect(nextPrime(10)).toBe(11));
  it('nextPrime(12) = 13', () => expect(nextPrime(12)).toBe(13));
  it('nextPrime(13) = 17', () => expect(nextPrime(13)).toBe(17));
});

// ---------------------------------------------------------------------------
// 3. Helper: nthPrime
// ---------------------------------------------------------------------------

describe('nthPrime', () => {
  it('nthPrime(1) = 2', () => expect(nthPrime(1)).toBe(2));
  it('nthPrime(2) = 3', () => expect(nthPrime(2)).toBe(3));
  it('nthPrime(3) = 5', () => expect(nthPrime(3)).toBe(5));
  it('nthPrime(10) = 29', () => expect(nthPrime(10)).toBe(29));
  it('nthPrime(25) = 97', () => expect(nthPrime(25)).toBe(97));
});

// ---------------------------------------------------------------------------
// 4. Helper: countPrimesInRange
// ---------------------------------------------------------------------------

describe('countPrimesInRange', () => {
  it('counts primes in [2, 10] = 4 (2,3,5,7)', () => expect(countPrimesInRange(2, 10)).toBe(4));
  it('counts primes in [1, 1] = 0', () => expect(countPrimesInRange(1, 1)).toBe(0));
  it('counts primes in [10, 20] = 4 (11,13,17,19)', () => expect(countPrimesInRange(10, 20)).toBe(4));
  it('counts primes in [2, 2] = 1', () => expect(countPrimesInRange(2, 2)).toBe(1));
});

// ---------------------------------------------------------------------------
// 5. Helper: primeFactorize + formatFactorization
// ---------------------------------------------------------------------------

describe('primeFactorize', () => {
  it('12 = {2:2, 3:1}', () => {
    const f = primeFactorize(12);
    expect(f.get(2)).toBe(2);
    expect(f.get(3)).toBe(1);
    expect(f.size).toBe(2);
  });

  it('30 = {2:1, 3:1, 5:1}', () => {
    const f = primeFactorize(30);
    expect(f.get(2)).toBe(1);
    expect(f.get(3)).toBe(1);
    expect(f.get(5)).toBe(1);
  });

  it('8 = {2:3}', () => {
    const f = primeFactorize(8);
    expect(f.get(2)).toBe(3);
    expect(f.size).toBe(1);
  });

  it('1 returns empty map', () => {
    expect(primeFactorize(1).size).toBe(0);
  });
});

describe('formatFactorization', () => {
  it('formats {2:3, 3:1} as "2^3 × 3"', () => {
    const f = new Map([[2, 3], [3, 1]]);
    expect(formatFactorization(f)).toBe('2^3 × 3');
  });

  it('formats {2:1, 5:2} as "2 × 5^2"', () => {
    const f = new Map([[2, 1], [5, 2]]);
    expect(formatFactorization(f)).toBe('2 × 5^2');
  });
});

// ---------------------------------------------------------------------------
// 6. Helper: countDivisors
// ---------------------------------------------------------------------------

describe('countDivisors', () => {
  it('countDivisors(1) = 1', () => expect(countDivisors(1)).toBe(1));
  it('countDivisors(12) = 6', () => expect(countDivisors(12)).toBe(6)); // 1,2,3,4,6,12
  it('countDivisors(7) = 2', () => expect(countDivisors(7)).toBe(2));   // prime
  it('countDivisors(36) = 9', () => expect(countDivisors(36)).toBe(9)); // 1,2,3,4,6,9,12,18,36
  it('countDivisors(30) = 8', () => expect(countDivisors(30)).toBe(8)); // 1,2,3,5,6,10,15,30
});

// ---------------------------------------------------------------------------
// 7. generatePrimeFactorization
// ---------------------------------------------------------------------------

describe('generatePrimeFactorization', () => {
  it('is deterministic', () => {
    const a = generatePrimeFactorization(factorizationParamsT1, mulberry32(42));
    const b = generatePrimeFactorization(factorizationParamsT1, mulberry32(42));
    expect(a.question).toBe(b.question);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it('satisfies universal MathProblem contract (T1)', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generatePrimeFactorization(factorizationParamsT1, mulberry32(seed)));
    }
  });

  it('satisfies universal MathProblem contract (T3)', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generatePrimeFactorization(factorizationParamsT3, mulberry32(seed)));
    }
  });

  it('answer multiplies back to the number in the question', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generatePrimeFactorization(factorizationParamsT1, mulberry32(seed));
      // Extract n from question "Write the prime factorization of N"
      const match = p.question.match(/of (\d+)$/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      // Verify answer factorization multiplies to n
      let product = 1;
      const parts = p.correctAnswer.split(' × ');
      for (const part of parts) {
        if (part.includes('^')) {
          const [base, exp] = part.split('^').map(Number);
          product *= Math.pow(base, exp);
        } else {
          product *= Number(part);
        }
      }
      expect(product).toBe(n);
    }
  });

  it('answer only uses prime bases', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generatePrimeFactorization(factorizationParamsT1, mulberry32(seed));
      const parts = p.correctAnswer.split(' × ');
      for (const part of parts) {
        const base = Number(part.split('^')[0]);
        expect(isPrime(base)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 8. generateLcmGcd
// ---------------------------------------------------------------------------

describe('generateLcmGcd', () => {
  it('is deterministic', () => {
    const a = generateLcmGcd(lcmGcdParamsGcdOnly, mulberry32(7));
    const b = generateLcmGcd(lcmGcdParamsGcdOnly, mulberry32(7));
    expect(a.question).toBe(b.question);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it('satisfies universal MathProblem contract (GCD only, T1)', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateLcmGcd(lcmGcdParamsGcdOnly, mulberry32(seed)));
    }
  });

  it('satisfies universal MathProblem contract (GCD or LCM, T2a)', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateLcmGcd(lcmGcdParamsBoth, mulberry32(seed)));
    }
  });

  it('GCD-only mode always produces a GCD question', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateLcmGcd(lcmGcdParamsGcdOnly, mulberry32(seed));
      expect(p.question).toContain('GCD');
    }
  });

  it('GCD answer is correct (divides both numbers)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLcmGcd(lcmGcdParamsGcdOnly, mulberry32(seed));
      expect(p.question).toContain('GCD');
      const match = p.question.match(/GCD\((\d+), (\d+)\)/);
      expect(match).not.toBeNull();
      const [, aStr, bStr] = match!;
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      const result = parseInt(p.correctAnswer, 10);
      // Result must divide both a and b
      expect(a % result).toBe(0);
      expect(b % result).toBe(0);
      // Result must be a positive integer
      expect(result).toBeGreaterThan(0);
    }
  });

  it('LCM answer is correct (multiple of both numbers)', () => {
    // Run many seeds — some will produce LCM questions
    let lcmCount = 0;
    for (let seed = 0; seed < 100; seed++) {
      const p = generateLcmGcd(lcmGcdParamsBoth, mulberry32(seed));
      if (!p.question.includes('LCM')) continue;
      lcmCount++;
      const match = p.question.match(/LCM\((\d+), (\d+)\)/);
      expect(match).not.toBeNull();
      const [, aStr, bStr] = match!;
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      const result = parseInt(p.correctAnswer, 10);
      // LCM must be a multiple of both a and b
      expect(result % a).toBe(0);
      expect(result % b).toBe(0);
      // LCM must be >= max(a, b)
      expect(result).toBeGreaterThanOrEqual(Math.max(a, b));
    }
    // Should have generated at least some LCM questions
    expect(lcmCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 9. generateModularArithmetic
// ---------------------------------------------------------------------------

describe('generateModularArithmetic', () => {
  it('is deterministic', () => {
    const a = generateModularArithmetic(modParamsBasic, mulberry32(99));
    const b = generateModularArithmetic(modParamsBasic, mulberry32(99));
    expect(a.question).toBe(b.question);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it('satisfies universal MathProblem contract for all sub-types', () => {
    const allParams = [modParamsBasic, modParamsAdd, modParamsMul, modParamsExp];
    for (const params of allParams) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generateModularArithmetic(params, mulberry32(seed)));
      }
    }
  });

  it('answer is always in [0, m-1]', () => {
    const allParams = [modParamsBasic, modParamsAdd, modParamsMul, modParamsExp];
    for (const params of allParams) {
      const mMax = params.rangeB[1];
      for (let seed = 0; seed < 20; seed++) {
        const p = generateModularArithmetic(params, mulberry32(seed));
        const ans = Number(p.correctAnswer);
        expect(ans).toBeGreaterThanOrEqual(0);
        expect(ans).toBeLessThan(mMax + 1); // answer < m, and m <= mMax
      }
    }
  });

  it('basic mod (steps=1) answer is correct: a mod m', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateModularArithmetic(modParamsBasic, mulberry32(seed));
      // question format: "N mod M = ?"
      const match = p.question.match(/^(\d+) mod (\d+) = \?$/);
      expect(match).not.toBeNull();
      const a = parseInt(match![1], 10);
      const m = parseInt(match![2], 10);
      const expected = ((a % m) + m) % m;
      expect(Number(p.correctAnswer)).toBe(expected);
    }
  });

  it('modular addition (steps=2) answer is correct', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateModularArithmetic(modParamsAdd, mulberry32(seed));
      // question format: "(A + B) mod M = ?"
      const match = p.question.match(/^\((\d+) \+ (\d+)\) mod (\d+) = \?$/);
      expect(match).not.toBeNull();
      const a = parseInt(match![1], 10);
      const b = parseInt(match![2], 10);
      const m = parseInt(match![3], 10);
      const expected = (a + b) % m;
      expect(Number(p.correctAnswer)).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. generateDivisibility
// ---------------------------------------------------------------------------

describe('generateDivisibility', () => {
  it('is deterministic', () => {
    const a = generateDivisibility(divisibilityParamsT1, mulberry32(13));
    const b = generateDivisibility(divisibilityParamsT1, mulberry32(13));
    expect(a.question).toBe(b.question);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it('satisfies universal MathProblem contract (T1)', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateDivisibility(divisibilityParamsT1, mulberry32(seed)));
    }
  });

  it('satisfies universal MathProblem contract (T3)', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateDivisibility(divisibilityParamsT3, mulberry32(seed)));
    }
  });

  it('divisor count is correct', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDivisibility(divisibilityParamsT1, mulberry32(seed));
      const match = p.question.match(/does (\d+) have\?$/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      const expected = countDivisors(n);
      expect(Number(p.correctAnswer)).toBe(expected);
    }
  });

  it('divisor count is always >= 2 (no primes expected from construction)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDivisibility(divisibilityParamsT1, mulberry32(seed));
      // Constructed n should have at least 4 divisors (2 primes multiplied)
      expect(Number(p.correctAnswer)).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. generatePrimeIdentification
// ---------------------------------------------------------------------------

describe('generatePrimeIdentification', () => {
  it('is deterministic for all sub-types', () => {
    const allParams = [primeIdParamsT1, primeIdParamsT2a, primeIdParamsT2b, primeIdParamsT3];
    for (const params of allParams) {
      const a = generatePrimeIdentification(params, mulberry32(55));
      const b = generatePrimeIdentification(params, mulberry32(55));
      expect(a.question).toBe(b.question);
      expect(a.correctAnswer).toBe(b.correctAnswer);
    }
  });

  it('satisfies universal MathProblem contract for all sub-types', () => {
    const allParams = [primeIdParamsT1, primeIdParamsT2a, primeIdParamsT2b, primeIdParamsT3];
    for (const params of allParams) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generatePrimeIdentification(params, mulberry32(seed)));
      }
    }
  });

  it('sub-type 1: correct answer is always prime', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generatePrimeIdentification(primeIdParamsT1, mulberry32(seed));
      expect(p.question).toContain('prime');
      expect(isPrime(Number(p.correctAnswer))).toBe(true);
    }
  });

  it('sub-type 2: correct answer is the next prime after N', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generatePrimeIdentification(primeIdParamsT2a, mulberry32(seed));
      expect(p.question).toContain('next prime');
      const match = p.question.match(/after (\d+)\?$/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      expect(Number(p.correctAnswer)).toBe(nextPrime(n));
    }
  });

  it('sub-type 3: correct answer is count of primes in range', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generatePrimeIdentification(primeIdParamsT2b, mulberry32(seed));
      expect(p.question).toContain('prime numbers');
      const match = p.question.match(/\[(\d+), (\d+)\]/);
      expect(match).not.toBeNull();
      const lo = parseInt(match![1], 10);
      const hi = parseInt(match![2], 10);
      const expected = countPrimesInRange(Math.max(lo, 2), hi);
      expect(Number(p.correctAnswer)).toBe(expected);
    }
  });

  it('sub-type 4: correct answer is the Nth prime', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generatePrimeIdentification(primeIdParamsT3, mulberry32(seed));
      expect(p.question).toContain('prime number');
      const match = p.question.match(/^What is the (\d+)/);
      expect(match).not.toBeNull();
      const n = parseInt(match![1], 10);
      expect(Number(p.correctAnswer)).toBe(nthPrime(n));
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Cross-generator: all return 4 distractors and inputMode 'choice'
// ---------------------------------------------------------------------------

describe('all number theory generators — universal shape', () => {
  const seeds = [0, 1, 2, 10, 42, 99, 256, 1000];

  it('generatePrimeFactorization always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generatePrimeFactorization(factorizationParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateLcmGcd always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateLcmGcd(lcmGcdParamsBoth, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateModularArithmetic always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateModularArithmetic(modParamsBasic, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateDivisibility always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateDivisibility(divisibilityParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generatePrimeIdentification always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generatePrimeIdentification(primeIdParamsT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });
});
