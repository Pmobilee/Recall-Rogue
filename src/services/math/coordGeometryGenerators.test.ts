/**
 * Unit tests for coordGeometryGenerators.ts
 *
 * Covers: determinism, valid MathProblem shape, mathematical correctness,
 * distractor integrity (no distractor equals correct answer), and answer
 * format correctness for all five coordinate geometry generators.
 */

import { describe, it, expect } from 'vitest';
import {
  generateDistance,
  generateMidpoint,
  generateSlope,
  generateLineEquation,
  generateCircleEquation,
  formatLineEquation,
} from './coordGeometryGenerators';
import { mulberry32 } from './mathUtils';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  return mulberry32(seed);
}

function assertValidProblem(p: { question: string; correctAnswer: string; acceptableAlternatives: string[]; distractors: string[]; explanation: string; inputMode: string }): void {
  expect(typeof p.question).toBe('string');
  expect(p.question.length).toBeGreaterThan(0);
  expect(typeof p.correctAnswer).toBe('string');
  expect(p.correctAnswer.length).toBeGreaterThan(0);
  expect(Array.isArray(p.acceptableAlternatives)).toBe(true);
  expect(Array.isArray(p.distractors)).toBe(true);
  expect(p.distractors).toHaveLength(4);
  expect(typeof p.explanation).toBe('string');
  expect(p.inputMode).toBe('choice');
}

function assertNoDistractorEqualsAnswer(p: { correctAnswer: string; distractors: string[] }): void {
  for (const d of p.distractors) {
    expect(d).not.toBe(p.correctAnswer);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DISTANCE_T1: GeneratorParams = { rangeA: [1, 1], rangeB: [-5, 5] };
const DISTANCE_T3: GeneratorParams = { rangeA: [2, 4], rangeB: [-12, 12] };

const MIDPOINT_PARAMS: GeneratorParams = { rangeA: [1, 8], rangeB: [1, 8] };

const SLOPE_PARAMS: GeneratorParams = { rangeA: [1, 8], rangeB: [1, 8] };

const LINE_EQ_T1: GeneratorParams = { rangeA: [1, 5], rangeB: [-5, 5], operations: ['tier1'] };
const LINE_EQ_ALL: GeneratorParams = { rangeA: [1, 8], rangeB: [-10, 10], operations: ['tier1', 'tier2a', 'tier2b'] };

const CIRCLE_T1: GeneratorParams = { rangeA: [-6, 6], rangeB: [2, 10], operations: ['tier1'] };
const CIRCLE_ALL: GeneratorParams = { rangeA: [-8, 8], rangeB: [2, 13], operations: ['tier1', 'tier2a', 'tier2b'] };

// ── 1. generateDistance ───────────────────────────────────────────────────────

describe('generateDistance — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateDistance(DISTANCE_T1, makeRng(42));
    const p2 = generateDistance(DISTANCE_T1, makeRng(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
    expect(p1.distractors).toEqual(p2.distractors);
  });

  it('different seeds produce different problems', () => {
    const p1 = generateDistance(DISTANCE_T1, makeRng(1));
    const p2 = generateDistance(DISTANCE_T1, makeRng(999));
    expect(p1.question).not.toBe(p2.question);
  });
});

describe('generateDistance — correctness', () => {
  it('returns valid MathProblem', () => {
    for (let seed = 0; seed < 30; seed++) {
      assertValidProblem(generateDistance(DISTANCE_T3, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      assertNoDistractorEqualsAnswer(generateDistance(DISTANCE_T3, makeRng(seed)));
    }
  });

  it('answer is always a positive integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDistance(DISTANCE_T3, makeRng(seed));
      const n = parseInt(p.correctAnswer, 10);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('distance formula: answer² = (x2-x1)² + (y2-y1)²', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDistance(DISTANCE_T1, makeRng(seed));
      // Extract the two points from the question.
      const match = p.question.match(/\((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/);
      if (!match) continue;
      const [, x1s, y1s, x2s, y2s] = match;
      const x1 = parseInt(x1s, 10);
      const y1 = parseInt(y1s, 10);
      const x2 = parseInt(x2s, 10);
      const y2 = parseInt(y2s, 10);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const d = parseInt(p.correctAnswer, 10);
      expect(d * d).toBe(dx * dx + dy * dy);
    }
  });
});

// ── 2. generateMidpoint ───────────────────────────────────────────────────────

describe('generateMidpoint — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateMidpoint(MIDPOINT_PARAMS, makeRng(7));
    const p2 = generateMidpoint(MIDPOINT_PARAMS, makeRng(7));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generateMidpoint — correctness', () => {
  it('returns valid MathProblem', () => {
    for (let seed = 0; seed < 30; seed++) {
      assertValidProblem(generateMidpoint(MIDPOINT_PARAMS, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      assertNoDistractorEqualsAnswer(generateMidpoint(MIDPOINT_PARAMS, makeRng(seed)));
    }
  });

  it('answer is in "(mx, my)" format with integers', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateMidpoint(MIDPOINT_PARAMS, makeRng(seed));
      expect(p.correctAnswer).toMatch(/^\(-?\d+, -?\d+\)$/);
    }
  });

  it('midpoint formula: answer = average of endpoints', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateMidpoint(MIDPOINT_PARAMS, makeRng(seed));
      // Extract endpoints from question.
      const match = p.question.match(/\((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/);
      if (!match) continue;
      const x1 = parseInt(match[1], 10);
      const y1 = parseInt(match[2], 10);
      const x2 = parseInt(match[3], 10);
      const y2 = parseInt(match[4], 10);
      const expectedMx = (x1 + x2) / 2;
      const expectedMy = (y1 + y2) / 2;
      // Extract answer.
      const ansMatch = p.correctAnswer.match(/^\((-?\d+), (-?\d+)\)$/);
      if (!ansMatch) continue;
      const mx = parseInt(ansMatch[1], 10);
      const my = parseInt(ansMatch[2], 10);
      expect(mx).toBe(expectedMx);
      expect(my).toBe(expectedMy);
    }
  });

  it('answer coords are always integers (even+even = even, divide by 2 = integer)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateMidpoint(MIDPOINT_PARAMS, makeRng(seed));
      const m = p.correctAnswer.match(/^\((-?\d+), (-?\d+)\)$/);
      expect(m).not.toBeNull();
      if (!m) continue;
      expect(Number.isInteger(parseInt(m[1], 10))).toBe(true);
      expect(Number.isInteger(parseInt(m[2], 10))).toBe(true);
    }
  });
});

// ── 3. generateSlope ──────────────────────────────────────────────────────────

describe('generateSlope — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateSlope(SLOPE_PARAMS, makeRng(13));
    const p2 = generateSlope(SLOPE_PARAMS, makeRng(13));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generateSlope — correctness', () => {
  it('returns valid MathProblem', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generateSlope(SLOPE_PARAMS, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertNoDistractorEqualsAnswer(generateSlope(SLOPE_PARAMS, makeRng(seed)));
    }
  });

  it('answer is integer, fraction, "0", or "undefined"', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateSlope(SLOPE_PARAMS, makeRng(seed));
      // Valid forms: integer, fraction like "3/4" or "-2/5", "0", "undefined"
      expect(p.correctAnswer).toMatch(/^-?\d+(\/\d+)?$|^0$|^undefined$/);
    }
  });

  it('horizontal line through same y has slope "0"', () => {
    // When rise=0, slope should be "0".
    // We can verify by checking seeds that produce horizontal-looking questions.
    let foundZero = false;
    for (let seed = 0; seed < 200; seed++) {
      const p = generateSlope(SLOPE_PARAMS, makeRng(seed));
      if (p.correctAnswer === '0') {
        foundZero = true;
        break;
      }
    }
    expect(foundZero).toBe(true);
  });

  it('vertical line has slope "undefined"', () => {
    let foundUndefined = false;
    for (let seed = 0; seed < 200; seed++) {
      const p = generateSlope(SLOPE_PARAMS, makeRng(seed));
      if (p.correctAnswer === 'undefined') {
        foundUndefined = true;
        break;
      }
    }
    expect(foundUndefined).toBe(true);
  });
});

// ── 4. generateLineEquation ───────────────────────────────────────────────────

describe('generateLineEquation — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateLineEquation(LINE_EQ_T1, makeRng(55));
    const p2 = generateLineEquation(LINE_EQ_T1, makeRng(55));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generateLineEquation — correctness', () => {
  it('returns valid MathProblem for tier1', () => {
    for (let seed = 0; seed < 30; seed++) {
      assertValidProblem(generateLineEquation(LINE_EQ_T1, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      assertNoDistractorEqualsAnswer(generateLineEquation(LINE_EQ_ALL, makeRng(seed)));
    }
  });

  it('answer starts with "y ="', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLineEquation(LINE_EQ_T1, makeRng(seed));
      expect(p.correctAnswer).toMatch(/^y = /);
    }
  });

  it('returns valid MathProblem for all tiers', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generateLineEquation(LINE_EQ_ALL, makeRng(seed)));
    }
  });
});

describe('formatLineEquation', () => {
  it('formats y = 2x + 3 correctly', () => {
    expect(formatLineEquation(2, 3)).toBe('y = 2x + 3');
  });

  it('formats y = 2x - 3 correctly (negative b)', () => {
    expect(formatLineEquation(2, -3)).toBe('y = 2x - 3');
  });

  it('formats y = 2x with no intercept (b=0)', () => {
    expect(formatLineEquation(2, 0)).toBe('y = 2x');
  });

  it('formats y = 5 for horizontal line (m=0)', () => {
    expect(formatLineEquation(0, 5)).toBe('y = 5');
  });

  it('formats y = x for m=1', () => {
    expect(formatLineEquation(1, 0)).toBe('y = x');
  });

  it('formats y = -x + 4 for m=-1', () => {
    expect(formatLineEquation(-1, 4)).toBe('y = -x + 4');
  });

  it('formats y = 0 for m=0, b=0', () => {
    expect(formatLineEquation(0, 0)).toBe('y = 0');
  });
});

// ── 5. generateCircleEquation ─────────────────────────────────────────────────

describe('generateCircleEquation — determinism', () => {
  it('same seed produces identical output', () => {
    const p1 = generateCircleEquation(CIRCLE_T1, makeRng(77));
    const p2 = generateCircleEquation(CIRCLE_T1, makeRng(77));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });
});

describe('generateCircleEquation — correctness', () => {
  it('returns valid MathProblem for tier1', () => {
    for (let seed = 0; seed < 30; seed++) {
      assertValidProblem(generateCircleEquation(CIRCLE_T1, makeRng(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertNoDistractorEqualsAnswer(generateCircleEquation(CIRCLE_ALL, makeRng(seed)));
    }
  });

  it('returns valid MathProblem for all tiers', () => {
    for (let seed = 0; seed < 50; seed++) {
      assertValidProblem(generateCircleEquation(CIRCLE_ALL, makeRng(seed)));
    }
  });

  it('tier1 answer is a positive integer (r²)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateCircleEquation(CIRCLE_T1, makeRng(seed));
      const n = parseInt(p.correctAnswer, 10);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('tier2a (center) answer is in "(h, k)" format', () => {
    const t2aParams: GeneratorParams = { rangeA: [-6, 6], rangeB: [2, 10], operations: ['tier2a'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateCircleEquation(t2aParams, makeRng(seed));
      expect(p.correctAnswer).toMatch(/^\(-?\d+, -?\d+\)$/);
    }
  });

  it('tier2b (radius) answer is a positive integer', () => {
    const t2bParams: GeneratorParams = { rangeA: [-6, 6], rangeB: [2, 10], operations: ['tier2b'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateCircleEquation(t2bParams, makeRng(seed));
      const n = parseInt(p.correctAnswer, 10);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('tier3 (general form) answer is in "(h, k)" format', () => {
    const t3Params: GeneratorParams = { rangeA: [-5, 5], rangeB: [3, 10], operations: ['tier3'] };
    for (let seed = 0; seed < 20; seed++) {
      const p = generateCircleEquation(t3Params, makeRng(seed));
      expect(p.correctAnswer).toMatch(/^\(-?\d+, -?\d+\)$/);
    }
  });
});

// ── 6. Integration: dispatcher round-trip ────────────────────────────────────

describe('generateProblem dispatcher — coord geometry cases', () => {
  it('dispatches all five coord geometry generatorIds without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const cases: Array<{ generatorId: string; tierParams: Record<string, GeneratorParams> }> = [
      {
        generatorId: 'distance_formula',
        tierParams: { '1': DISTANCE_T1, '2a': DISTANCE_T1, '2b': DISTANCE_T1, '3': DISTANCE_T3 },
      },
      {
        generatorId: 'midpoint_formula',
        tierParams: { '1': MIDPOINT_PARAMS, '2a': MIDPOINT_PARAMS, '2b': MIDPOINT_PARAMS, '3': MIDPOINT_PARAMS },
      },
      {
        generatorId: 'slope_formula',
        tierParams: { '1': SLOPE_PARAMS, '2a': SLOPE_PARAMS, '2b': SLOPE_PARAMS, '3': SLOPE_PARAMS },
      },
      {
        generatorId: 'line_equation',
        tierParams: { '1': LINE_EQ_T1, '2a': LINE_EQ_ALL, '2b': LINE_EQ_ALL, '3': LINE_EQ_ALL },
      },
      {
        generatorId: 'circle_equation',
        tierParams: { '1': CIRCLE_T1, '2a': CIRCLE_ALL, '2b': CIRCLE_ALL, '3': CIRCLE_ALL },
      },
    ];

    for (const skill of cases) {
      for (const tier of ['1', '2a', '2b', '3'] as const) {
        expect(() => generateProblem(skill as never, tier, 42)).not.toThrow();
      }
    }
  });
});
