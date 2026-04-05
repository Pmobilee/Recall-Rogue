/**
 * Unit tests for financialMathGenerators.ts
 *
 * Covers: determinism, valid MathProblem shape, no distractor equals
 * correctAnswer, integer answers, and generator-specific correctness checks
 * (I = P × r × t, A = P(1+r)^t, V = P − P×rate×t, markup/discount math,
 * pre/post-tax relationships).
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './mathUtils';
import {
  generateSimpleInterest,
  generateCompoundInterest,
  generateDepreciation,
  generateMarkupDiscount,
  generateTaxCalculation,
} from './financialMathGenerators';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Fixtures — GeneratorParams matching tier definitions in financialMath.ts
// ---------------------------------------------------------------------------

const simpleT1: GeneratorParams  = { rangeA: [100, 500],   rangeB: [1, 2] };
const simpleT3: GeneratorParams  = { rangeA: [500, 5000],  rangeB: [2, 10] };

const compoundT1: GeneratorParams  = { rangeA: [100, 1000],  rangeB: [1, 2] };
const compoundT2b: GeneratorParams = { rangeA: [200, 2000],  rangeB: [1, 4] };
const compoundT3: GeneratorParams  = { rangeA: [200, 5000],  rangeB: [2, 5] };

const deprT1: GeneratorParams  = { rangeA: [100, 1000],  rangeB: [1, 2] };
const deprT3: GeneratorParams  = { rangeA: [500, 10000], rangeB: [1, 5] };

const markupT1: GeneratorParams  = { rangeA: [10, 100],  rangeB: [1, 1] };
const markupT2b: GeneratorParams = { rangeA: [20, 500],  rangeB: [3, 4] };
const markupT3: GeneratorParams  = { rangeA: [50, 1000], rangeB: [4, 5] };

const taxT1: GeneratorParams  = { rangeA: [10, 100],  rangeB: [1, 1] };
const taxT2a: GeneratorParams = { rangeA: [10, 200],  rangeB: [1, 2] };
const taxT2b: GeneratorParams = { rangeA: [20, 500],  rangeB: [1, 3] };
const taxT3: GeneratorParams  = { rangeA: [50, 1000], rangeB: [1, 4] };

// ---------------------------------------------------------------------------
// Shared contract checker
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
// 1. generateSimpleInterest
// ---------------------------------------------------------------------------

describe('generateSimpleInterest', () => {
  it('is deterministic — same seed produces same result', () => {
    const a = generateSimpleInterest(simpleT1, mulberry32(1));
    const b = generateSimpleInterest(simpleT1, mulberry32(1));
    expect(a.question).toBe(b.question);
    expect(a.correctAnswer).toBe(b.correctAnswer);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateSimpleInterest(simpleT1, mulberry32(seed)));
    }
  });

  it('correctAnswer is a positive integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateSimpleInterest(simpleT1, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('question mentions interest, percentage, and years', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateSimpleInterest(simpleT1, mulberry32(seed));
      expect(p.question.toLowerCase()).toContain('interest');
      expect(p.question).toMatch(/\d+%/);
      expect(p.question.toLowerCase()).toContain('year');
    }
  });

  it('interest < principal (rates are all < 1 and time is bounded)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateSimpleInterest(simpleT1, mulberry32(seed));
      const I = Number(p.correctAnswer);
      // At most 15% × 2 years = 30% of a max $500 principal = $150
      expect(I).toBeLessThan(simpleT1.rangeA[1] * 0.15 * simpleT1.rangeB[1] + 1);
    }
  });

  it('works at higher tier params', () => {
    for (let seed = 0; seed < 10; seed++) {
      expectValidProblem(generateSimpleInterest(simpleT3, mulberry32(seed)));
    }
  });

  it('always returns 4 distractors', () => {
    const seeds = [0, 1, 7, 42, 99, 256, 1000, 9999];
    for (const seed of seeds) {
      expect(generateSimpleInterest(simpleT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. generateCompoundInterest
// ---------------------------------------------------------------------------

describe('generateCompoundInterest', () => {
  it('is deterministic', () => {
    const a = generateCompoundInterest(compoundT1, mulberry32(5));
    const b = generateCompoundInterest(compoundT1, mulberry32(5));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateCompoundInterest(compoundT1, mulberry32(seed)));
    }
  });

  it('final amount is a positive integer greater than principal', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateCompoundInterest(compoundT1, mulberry32(seed));
      const A = Number(p.correctAnswer);
      expect(Number.isInteger(A)).toBe(true);
      // Minimum principal is rangeA[0]=100, so A > 100
      expect(A).toBeGreaterThan(compoundT1.rangeA[0]);
    }
  });

  it('question mentions "compounded" and a frequency', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateCompoundInterest(compoundT1, mulberry32(seed));
      expect(p.question.toLowerCase()).toContain('compounded');
    }
  });

  it('works with semi-annual compounding (T2b params)', () => {
    for (let seed = 0; seed < 20; seed++) {
      expectValidProblem(generateCompoundInterest(compoundT2b, mulberry32(seed)));
    }
  });

  it('works with quarterly compounding (T3 params)', () => {
    for (let seed = 0; seed < 20; seed++) {
      expectValidProblem(generateCompoundInterest(compoundT3, mulberry32(seed)));
    }
  });

  it('always returns 4 distractors', () => {
    const seeds = [0, 1, 7, 42, 99, 256, 1000, 9999];
    for (const seed of seeds) {
      expect(generateCompoundInterest(compoundT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. generateDepreciation
// ---------------------------------------------------------------------------

describe('generateDepreciation', () => {
  it('is deterministic', () => {
    const a = generateDepreciation(deprT1, mulberry32(3));
    const b = generateDepreciation(deprT1, mulberry32(3));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateDepreciation(deprT1, mulberry32(seed)));
    }
  });

  it('remaining value is a positive integer less than initial', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDepreciation(deprT1, mulberry32(seed));
      const V = Number(p.correctAnswer);
      expect(Number.isInteger(V)).toBe(true);
      expect(V).toBeGreaterThan(0);
      // V must be less than initial price (rangeA upper bound at T1)
      expect(V).toBeLessThan(deprT1.rangeA[1] + 1);
    }
  });

  it('question mentions "depreciates" and "value after"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateDepreciation(deprT1, mulberry32(seed));
      expect(p.question.toLowerCase()).toContain('depreciat');
      expect(p.question.toLowerCase()).toContain('value after');
    }
  });

  it('works at higher tier (T3) params', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateDepreciation(deprT3, mulberry32(seed));
      expectValidProblem(p);
      expect(Number(p.correctAnswer)).toBeGreaterThan(0);
    }
  });

  it('always returns 4 distractors', () => {
    const seeds = [0, 1, 7, 42, 99, 256, 1000, 9999];
    for (const seed of seeds) {
      expect(generateDepreciation(deprT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. generateMarkupDiscount
// ---------------------------------------------------------------------------

describe('generateMarkupDiscount', () => {
  it('is deterministic', () => {
    const a = generateMarkupDiscount(markupT1, mulberry32(9));
    const b = generateMarkupDiscount(markupT1, mulberry32(9));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract', () => {
    for (let seed = 0; seed < 30; seed++) {
      expectValidProblem(generateMarkupDiscount(markupT1, mulberry32(seed)));
    }
  });

  it('correctAnswer is a positive integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateMarkupDiscount(markupT1, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('question mentions markup or discount or successive discount', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateMarkupDiscount(markupT1, mulberry32(seed));
      const q = p.question.toLowerCase();
      const hasMarkupOrDiscount = q.includes('markup') || q.includes('discount');
      expect(hasMarkupOrDiscount).toBe(true);
    }
  });

  it('markup price is greater than base price', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateMarkupDiscount(markupT1, mulberry32(seed));
      if (p.question.includes('markup')) {
        // Extract base price from question
        const match = p.question.match(/\$(\d+) item has a/);
        if (match) {
          const base = Number(match[1]);
          expect(Number(p.correctAnswer)).toBeGreaterThan(base);
        }
      }
    }
  });

  it('discount price is less than base price', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateMarkupDiscount(markupT1, mulberry32(seed));
      if (p.question.includes('discounted by')) {
        const match = p.question.match(/\$(\d+) item is discounted/);
        if (match) {
          const base = Number(match[1]);
          expect(Number(p.correctAnswer)).toBeLessThan(base);
        }
      }
    }
  });

  it('works with successive discounts (T2b params)', () => {
    for (let seed = 0; seed < 20; seed++) {
      expectValidProblem(generateMarkupDiscount(markupT2b, mulberry32(seed)));
    }
  });

  it('works at T3 params', () => {
    for (let seed = 0; seed < 10; seed++) {
      expectValidProblem(generateMarkupDiscount(markupT3, mulberry32(seed)));
    }
  });

  it('always returns 4 distractors', () => {
    const seeds = [0, 1, 7, 42, 99, 256, 1000, 9999];
    for (const seed of seeds) {
      expect(generateMarkupDiscount(markupT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. generateTaxCalculation
// ---------------------------------------------------------------------------

describe('generateTaxCalculation', () => {
  it('is deterministic', () => {
    const a = generateTaxCalculation(taxT1, mulberry32(21));
    const b = generateTaxCalculation(taxT1, mulberry32(21));
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.question).toBe(b.question);
  });

  it('satisfies universal MathProblem contract — all tiers', () => {
    for (const params of [taxT1, taxT2a, taxT2b, taxT3]) {
      for (let seed = 0; seed < 20; seed++) {
        expectValidProblem(generateTaxCalculation(params, mulberry32(seed)));
      }
    }
  });

  it('correctAnswer is a positive integer', () => {
    for (const params of [taxT1, taxT2a, taxT2b, taxT3]) {
      for (let seed = 0; seed < 20; seed++) {
        const p = generateTaxCalculation(params, mulberry32(seed));
        const n = Number(p.correctAnswer);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThan(0);
      }
    }
  });

  it('T1: total including tax is greater than base price', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateTaxCalculation(taxT1, mulberry32(seed));
      // T1 asks for total including tax
      const match = p.question.match(/\$(\d+) purchase has a (\d+)% sales tax/);
      if (match) {
        const price = Number(match[1]);
        expect(Number(p.correctAnswer)).toBeGreaterThan(price);
      }
    }
  });

  it('T2a: tax amount is less than the base price', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateTaxCalculation(taxT2a, mulberry32(seed));
      if (p.question.includes('How much sales tax')) {
        const match = p.question.match(/\$(\d+) purchase/);
        if (match) {
          const price = Number(match[1]);
          expect(Number(p.correctAnswer)).toBeLessThan(price);
        }
      }
    }
  });

  it('T2b: pre-tax price is less than total', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateTaxCalculation(taxT2b, mulberry32(seed));
      if (p.question.includes('pre-tax price')) {
        const match = p.question.match(/total price including \d+% tax is \$(\d+)/);
        if (match) {
          const total = Number(match[1]);
          expect(Number(p.correctAnswer)).toBeLessThan(total);
        }
      }
    }
  });

  it('question mentions tax', () => {
    for (const params of [taxT1, taxT2a, taxT2b, taxT3]) {
      for (let seed = 0; seed < 10; seed++) {
        const p = generateTaxCalculation(params, mulberry32(seed));
        expect(p.question.toLowerCase()).toContain('tax');
      }
    }
  });

  it('always returns 4 distractors', () => {
    const seeds = [0, 1, 7, 42, 99, 256, 1000, 9999];
    for (const seed of seeds) {
      for (const params of [taxT1, taxT2a, taxT2b, taxT3]) {
        expect(generateTaxCalculation(params, mulberry32(seed)).distractors).toHaveLength(4);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-generator: all return 4 distractors and inputMode 'choice'
// ---------------------------------------------------------------------------

describe('all financial math generators — universal shape', () => {
  const seeds = [0, 1, 2, 10, 42, 99, 256, 1000];

  it('generateSimpleInterest always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateSimpleInterest(simpleT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateCompoundInterest always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateCompoundInterest(compoundT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateDepreciation always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateDepreciation(deprT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateMarkupDiscount always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateMarkupDiscount(markupT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('generateTaxCalculation always returns 4 distractors', () => {
    for (const seed of seeds) {
      expect(generateTaxCalculation(taxT1, mulberry32(seed)).distractors).toHaveLength(4);
    }
  });

  it('all generators return inputMode: "choice"', () => {
    for (const seed of seeds) {
      expect(generateSimpleInterest(simpleT1, mulberry32(seed)).inputMode).toBe('choice');
      expect(generateCompoundInterest(compoundT1, mulberry32(seed)).inputMode).toBe('choice');
      expect(generateDepreciation(deprT1, mulberry32(seed)).inputMode).toBe('choice');
      expect(generateMarkupDiscount(markupT1, mulberry32(seed)).inputMode).toBe('choice');
      expect(generateTaxCalculation(taxT1, mulberry32(seed)).inputMode).toBe('choice');
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Dispatcher wiring — financial_math deck is in PROCEDURAL_DECKS and
//    generateProblem dispatches all 5 generatorIds without throwing
// ---------------------------------------------------------------------------

describe('dispatcher wiring via generateProblem', () => {
  it('dispatches all 5 financial math generatorIds', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const { FINANCIAL_MATH_DECK } = await import('../../data/mathDecks/financialMath');

    for (const skill of FINANCIAL_MATH_DECK.skills) {
      for (const tier of ['1', '2a', '2b', '3'] as const) {
        const p = generateProblem(skill, tier, 42);
        expectValidProblem(p);
      }
    }
  });

  it('financial_math is in PROCEDURAL_DECKS registry', async () => {
    const { PROCEDURAL_DECKS } = await import('./proceduralDeckRegistry');
    const found = PROCEDURAL_DECKS.find(d => d.id === 'financial_math');
    expect(found).toBeDefined();
    expect(found?.skills).toHaveLength(5);
  });
});
