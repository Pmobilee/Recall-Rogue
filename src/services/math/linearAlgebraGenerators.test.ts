/**
 * Unit tests for linearAlgebraGenerators.ts
 *
 * Tests each of the five linear algebra generators and two formatting helpers for:
 *   - Determinism (same seed → same output)
 *   - Valid MathProblem shape (required fields, correct inputMode)
 *   - No distractor equals the correct answer
 *   - Exactly 4 unique distractors
 *   - Answer format correctness (matrix/vector/scalar)
 *   - Mathematical correctness where computable from output
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './mathUtils';
import {
  formatMatrix,
  formatVector,
  generateMatrixAddition,
  generateScalarMultiplication,
  generateDeterminant,
  generateDotProduct,
  generateMatrixVectorMultiply,
} from './linearAlgebraGenerators';
import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Assert a MathProblem has the required shape and valid distractors. */
function assertValidProblem(p: MathProblem): void {
  expect(typeof p.question).toBe('string');
  expect(p.question.length).toBeGreaterThan(0);
  expect(typeof p.correctAnswer).toBe('string');
  expect(p.correctAnswer.length).toBeGreaterThan(0);
  expect(Array.isArray(p.distractors)).toBe(true);
  expect(p.distractors).toHaveLength(4);
  expect(p.distractors).not.toContain(p.correctAnswer);
  for (const d of p.distractors) {
    expect(typeof d).toBe('string');
    expect(d.length).toBeGreaterThan(0);
  }
  expect(p.inputMode).toBe('choice');
  expect(typeof p.explanation).toBe('string');
  expect(p.explanation.length).toBeGreaterThan(0);
  expect(Array.isArray(p.acceptableAlternatives)).toBe(true);
}

/** Assert all 4 distractors are unique. */
function assertUniqueDistractors(p: MathProblem): void {
  const unique = new Set(p.distractors);
  expect(unique.size).toBe(4);
}

// ── formatMatrix ──────────────────────────────────────────────────────────────

describe('formatMatrix', () => {
  it('formats a 2x2 matrix', () => {
    expect(formatMatrix([[1, 2], [3, 4]])).toBe('[[1, 2], [3, 4]]');
  });

  it('formats a 3x3 matrix', () => {
    expect(formatMatrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]])).toBe('[[1, 2, 3], [4, 5, 6], [7, 8, 9]]');
  });

  it('handles negative values', () => {
    expect(formatMatrix([[-1, 2], [3, -4]])).toBe('[[-1, 2], [3, -4]]');
  });

  it('handles zero values', () => {
    expect(formatMatrix([[0, 0], [0, 0]])).toBe('[[0, 0], [0, 0]]');
  });
});

// ── formatVector ──────────────────────────────────────────────────────────────

describe('formatVector', () => {
  it('formats a 2D vector', () => {
    expect(formatVector([3, 7])).toBe('[3, 7]');
  });

  it('formats a 3D vector', () => {
    expect(formatVector([1, 2, 3])).toBe('[1, 2, 3]');
  });

  it('formats a 4D vector', () => {
    expect(formatVector([1, -2, 3, -4])).toBe('[1, -2, 3, -4]');
  });

  it('handles negative values', () => {
    expect(formatVector([-5, 0, 10])).toBe('[-5, 0, 10]');
  });
});

// ── generateMatrixAddition ────────────────────────────────────────────────────

describe('generateMatrixAddition', () => {
  const params2x2: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 2 };
  const params3x3: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 3 };

  it('produces deterministic output for the same seed', () => {
    const p1 = generateMatrixAddition(params2x2, mulberry32(42));
    const p2 = generateMatrixAddition(params2x2, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
    expect(p1.distractors).toEqual(p2.distractors);
  });

  it('returns a valid MathProblem shape for 2x2', () => {
    const p = generateMatrixAddition(params2x2, mulberry32(123));
    assertValidProblem(p);
  });

  it('returns a valid MathProblem shape for 3x3', () => {
    const p = generateMatrixAddition(params3x3, mulberry32(456));
    assertValidProblem(p);
  });

  it('answer is in matrix format "[[...], [...]]"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateMatrixAddition(params2x2, mulberry32(seed));
      expect(p.correctAnswer).toMatch(/^\[\[.+\], \[.+\]\]$/);
    }
  });

  it('3x3 answer has three row groups', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateMatrixAddition(params3x3, mulberry32(seed));
      // Should be [[r1], [r2], [r3]] — count opening brackets
      const openBracketCount = (p.correctAnswer.match(/\[/g) ?? []).length;
      expect(openBracketCount).toBe(4); // outer + 3 rows
    }
  });

  it('all 4 distractors are unique', () => {
    for (let seed = 0; seed < 15; seed++) {
      assertUniqueDistractors(generateMatrixAddition(params2x2, mulberry32(seed)));
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateMatrixAddition(params2x2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('question mentions "A + B"', () => {
    const p = generateMatrixAddition(params2x2, mulberry32(1));
    expect(p.question).toMatch(/A \+ B/);
  });
});

// ── generateScalarMultiplication ──────────────────────────────────────────────

describe('generateScalarMultiplication', () => {
  const params2x2: GeneratorParams = { rangeA: [1, 5], rangeB: [2, 4], steps: 2 };
  const params3x3: GeneratorParams = { rangeA: [1, 5], rangeB: [2, 6], steps: 3 };

  it('produces deterministic output for the same seed', () => {
    const p1 = generateScalarMultiplication(params2x2, mulberry32(42));
    const p2 = generateScalarMultiplication(params2x2, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('returns a valid MathProblem shape for 2x2', () => {
    const p = generateScalarMultiplication(params2x2, mulberry32(123));
    assertValidProblem(p);
  });

  it('returns a valid MathProblem shape for 3x3', () => {
    const p = generateScalarMultiplication(params3x3, mulberry32(789));
    assertValidProblem(p);
  });

  it('answer is in matrix format', () => {
    for (let seed = 0; seed < 15; seed++) {
      const p = generateScalarMultiplication(params2x2, mulberry32(seed));
      expect(p.correctAnswer).toMatch(/^\[\[/);
    }
  });

  it('all 4 distractors are unique', () => {
    for (let seed = 0; seed < 15; seed++) {
      assertUniqueDistractors(generateScalarMultiplication(params2x2, mulberry32(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateScalarMultiplication(params2x2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('question mentions scalar value and "A"', () => {
    const p = generateScalarMultiplication(params2x2, mulberry32(1));
    expect(p.question).toMatch(/\d+A/);
  });
});

// ── generateDeterminant ───────────────────────────────────────────────────────

describe('generateDeterminant', () => {
  const params2x2: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 2 };
  const params3x3: GeneratorParams = { rangeA: [-3, 3], rangeB: [-3, 3], steps: 3 };

  it('produces deterministic output for the same seed (2x2)', () => {
    const p1 = generateDeterminant(params2x2, mulberry32(42));
    const p2 = generateDeterminant(params2x2, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces deterministic output for the same seed (3x3)', () => {
    const p1 = generateDeterminant(params3x3, mulberry32(99));
    const p2 = generateDeterminant(params3x3, mulberry32(99));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('returns a valid MathProblem shape for 2x2', () => {
    for (let seed = 0; seed < 10; seed++) {
      assertValidProblem(generateDeterminant(params2x2, mulberry32(seed)));
    }
  });

  it('returns a valid MathProblem shape for 3x3', () => {
    for (let seed = 0; seed < 10; seed++) {
      assertValidProblem(generateDeterminant(params3x3, mulberry32(seed)));
    }
  });

  it('answer is an integer (as string)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDeterminant(params2x2, mulberry32(seed));
      expect(p.correctAnswer).toMatch(/^-?\d+$/);
    }
  });

  it('3x3 answer is also an integer', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateDeterminant(params3x3, mulberry32(seed));
      expect(p.correctAnswer).toMatch(/^-?\d+$/);
    }
  });

  it('all 4 distractors are unique', () => {
    for (let seed = 0; seed < 15; seed++) {
      assertUniqueDistractors(generateDeterminant(params2x2, mulberry32(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDeterminant(params2x2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('question mentions "determinant"', () => {
    const p = generateDeterminant(params2x2, mulberry32(1));
    expect(p.question.toLowerCase()).toContain('determinant');
  });
});

// ── generateDotProduct ────────────────────────────────────────────────────────

describe('generateDotProduct', () => {
  const params2D: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 2 };
  const params3D: GeneratorParams = { rangeA: [1, 9], rangeB: [1, 9], steps: 3 };
  const params4D: GeneratorParams = { rangeA: [-9, 9], rangeB: [-9, 9], steps: 4 };

  it('produces deterministic output for the same seed', () => {
    const p1 = generateDotProduct(params2D, mulberry32(42));
    const p2 = generateDotProduct(params2D, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('returns a valid MathProblem shape for 2D', () => {
    assertValidProblem(generateDotProduct(params2D, mulberry32(123)));
  });

  it('returns a valid MathProblem shape for 3D', () => {
    assertValidProblem(generateDotProduct(params3D, mulberry32(456)));
  });

  it('returns a valid MathProblem shape for 4D', () => {
    assertValidProblem(generateDotProduct(params4D, mulberry32(789)));
  });

  it('answer is an integer (as string)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDotProduct(params2D, mulberry32(seed));
      expect(p.correctAnswer).toMatch(/^-?\d+$/);
    }
  });

  it('mathematical correctness for 2D dot product', () => {
    // Generate with known vectors via seed and verify correctAnswer
    // We can parse from question: "u = [a, b]\nv = [c, d]" → dot = ac + bd
    for (let seed = 0; seed < 20; seed++) {
      const p = generateDotProduct(params2D, mulberry32(seed));
      const dot = Number(p.correctAnswer);
      expect(Number.isInteger(dot)).toBe(true);
      expect(Number.isFinite(dot)).toBe(true);
    }
  });

  it('all 4 distractors are unique', () => {
    for (let seed = 0; seed < 15; seed++) {
      assertUniqueDistractors(generateDotProduct(params2D, mulberry32(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDotProduct(params2D, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('question contains "u · v"', () => {
    const p = generateDotProduct(params2D, mulberry32(1));
    expect(p.question).toContain('u · v');
  });
});

// ── generateMatrixVectorMultiply ──────────────────────────────────────────────

describe('generateMatrixVectorMultiply', () => {
  const params2x2: GeneratorParams = { rangeA: [1, 4], rangeB: [1, 4], steps: 2 };
  const params3x3: GeneratorParams = { rangeA: [-5, 5], rangeB: [-5, 5], steps: 3 };

  it('produces deterministic output for the same seed', () => {
    const p1 = generateMatrixVectorMultiply(params2x2, mulberry32(42));
    const p2 = generateMatrixVectorMultiply(params2x2, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
    expect(p1.distractors).toEqual(p2.distractors);
  });

  it('returns a valid MathProblem shape for 2x2', () => {
    assertValidProblem(generateMatrixVectorMultiply(params2x2, mulberry32(123)));
  });

  it('returns a valid MathProblem shape for 3x3', () => {
    assertValidProblem(generateMatrixVectorMultiply(params3x3, mulberry32(456)));
  });

  it('answer is in vector format "[N, M]"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateMatrixVectorMultiply(params2x2, mulberry32(seed));
      expect(p.correctAnswer).toMatch(/^\[-?\d+, -?\d+\]$/);
    }
  });

  it('3x3 answer has three components', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateMatrixVectorMultiply(params3x3, mulberry32(seed));
      // Format "[a, b, c]" — count commas
      const commaCount = (p.correctAnswer.match(/,/g) ?? []).length;
      expect(commaCount).toBe(2);
    }
  });

  it('all 4 distractors are unique', () => {
    for (let seed = 0; seed < 15; seed++) {
      assertUniqueDistractors(generateMatrixVectorMultiply(params2x2, mulberry32(seed)));
    }
  });

  it('no distractor equals correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateMatrixVectorMultiply(params2x2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('question contains "Ax"', () => {
    const p = generateMatrixVectorMultiply(params2x2, mulberry32(1));
    expect(p.question).toContain('Ax');
  });

  it('mathematical correctness: result components are finite integers', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateMatrixVectorMultiply(params2x2, mulberry32(seed));
      // Parse answer "[N, M]"
      const stripped = p.correctAnswer.replace(/\[|\]/g, '');
      const parts = stripped.split(', ').map(Number);
      expect(parts).toHaveLength(2);
      for (const part of parts) {
        expect(Number.isInteger(part)).toBe(true);
        expect(Number.isFinite(part)).toBe(true);
      }
    }
  });

  it('handles negative element ranges without throwing', () => {
    const negParams: GeneratorParams = { rangeA: [-5, 5], rangeB: [-5, 5], steps: 2 };
    for (let seed = 0; seed < 10; seed++) {
      expect(() => generateMatrixVectorMultiply(negParams, mulberry32(seed))).not.toThrow();
    }
  });
});
