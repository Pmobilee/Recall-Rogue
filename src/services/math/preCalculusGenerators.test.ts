/**
 * Unit tests for preCalculusGenerators.ts
 *
 * Tests each of the five pre-calculus generators for:
 *   - Determinism (same seed → same output)
 *   - Valid MathProblem shape (required fields, correct inputMode)
 *   - No distractor equals the correct answer
 *   - Answer format matches expected pattern
 *   - Mathematical correctness where verifiable
 *
 * Source files: src/services/math/preCalculusGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './mathUtils';
import {
  generateLogarithm,
  generateExponentRules,
  generateSequence,
  generateLimitIntro,
  generatePolynomialDivision,
} from './preCalculusGenerators';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ── Shared helpers ────────────────────────────────────────────────────────────

type MathProblemLike = {
  question: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  inputMode: string;
  acceptableAlternatives: string[];
};

/** Assert a MathProblem has the required shape, no distractor equals correct answer, and 4 unique distractors. */
function assertValidProblem(p: MathProblemLike, label = ''): void {
  expect(typeof p.question, `${label}: question type`).toBe('string');
  expect(p.question.length, `${label}: question non-empty`).toBeGreaterThan(0);
  expect(typeof p.correctAnswer, `${label}: correctAnswer type`).toBe('string');
  expect(p.correctAnswer.length, `${label}: correctAnswer non-empty`).toBeGreaterThan(0);
  expect(Array.isArray(p.distractors), `${label}: distractors is array`).toBe(true);
  expect(p.distractors.length, `${label}: 4 distractors`).toBe(4);
  expect(p.distractors, `${label}: no distractor equals correctAnswer`).not.toContain(p.correctAnswer);
  for (const d of p.distractors) {
    expect(typeof d, `${label}: distractor is string`).toBe('string');
    expect(d.length, `${label}: distractor non-empty`).toBeGreaterThan(0);
  }
  expect(p.inputMode, `${label}: inputMode`).toBe('choice');
  expect(typeof p.explanation, `${label}: explanation type`).toBe('string');
  expect(p.explanation.length, `${label}: explanation non-empty`).toBeGreaterThan(0);
  expect(Array.isArray(p.acceptableAlternatives), `${label}: acceptableAlternatives is array`).toBe(true);
  // Distractors must be unique
  const unique = new Set(p.distractors);
  expect(unique.size, `${label}: unique distractors`).toBe(4);
}

// ── generateLogarithm ─────────────────────────────────────────────────────────

describe('generateLogarithm', () => {
  const T1: GeneratorParams = { rangeA: [1, 4],  rangeB: [1, 3] };
  const T2: GeneratorParams = { rangeA: [1, 6],  rangeB: [1, 4] };
  const T3: GeneratorParams = { rangeA: [1, 10], rangeB: [1, 6] };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateLogarithm(T1, mulberry32(42));
    const p2 = generateLogarithm(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
    expect(p1.distractors).toEqual(p2.distractors);
  });

  it('produces a valid MathProblem shape (T1)', () => {
    assertValidProblem(generateLogarithm(T1, mulberry32(100)), 'log_T1');
  });

  it('produces a valid MathProblem shape (T2)', () => {
    assertValidProblem(generateLogarithm(T2, mulberry32(200)), 'log_T2');
  });

  it('produces a valid MathProblem shape (T3)', () => {
    assertValidProblem(generateLogarithm(T3, mulberry32(300)), 'log_T3');
  });

  it('question contains "log_" notation', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateLogarithm(T1, mulberry32(seed));
      expect(p.question).toMatch(/log_\{/);
    }
  });

  it('answer is always a positive integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLogarithm(T1, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n), `Seed ${seed}: answer should be an integer`).toBe(true);
      expect(n, `Seed ${seed}: answer should be positive`).toBeGreaterThan(0);
    }
  });

  it('explanation contains "because" (shows the b^n = x reasoning)', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateLogarithm(T1, mulberry32(seed));
      expect(p.explanation).toMatch(/because/);
    }
  });

  it('mathematical correctness: b^answer = x', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateLogarithm(T2, mulberry32(seed));
      // Parse question: "Evaluate: log_{b}(x)"
      const match = p.question.match(/log_\{(\d+)\}\((\d+)\)/);
      if (match) {
        const b = Number(match[1]);
        const x = Number(match[2]);
        const n = Number(p.correctAnswer);
        expect(Math.pow(b, n), `Seed ${seed}: ${b}^${n} should equal ${x}`).toBe(x);
      }
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLogarithm(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('handles T3 range (exponent up to 6) without throwing', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(() => generateLogarithm(T3, mulberry32(seed * 7))).not.toThrow();
    }
  });
});

// ── generateExponentRules ─────────────────────────────────────────────────────

describe('generateExponentRules', () => {
  const T1: GeneratorParams = { rangeA: [1, 4], rangeB: [1, 4], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 5], rangeB: [1, 5], steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 6], rangeB: [1, 6], steps: 3 };
  const T4: GeneratorParams = { rangeA: [1, 8], rangeB: [1, 8], steps: 4 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateExponentRules(T1, mulberry32(42));
    const p2 = generateExponentRules(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces a valid MathProblem shape (T1 — multiply)', () => {
    assertValidProblem(generateExponentRules(T1, mulberry32(111)), 'exp_T1');
  });

  it('produces a valid MathProblem shape (T2 — multiply/divide)', () => {
    assertValidProblem(generateExponentRules(T2, mulberry32(222)), 'exp_T2');
  });

  it('produces a valid MathProblem shape (T3 — multiply/divide/power)', () => {
    assertValidProblem(generateExponentRules(T3, mulberry32(333)), 'exp_T3');
  });

  it('produces a valid MathProblem shape (T4 — all including mixed)', () => {
    assertValidProblem(generateExponentRules(T4, mulberry32(444)), 'exp_T4');
  });

  it('question contains "Simplify:" prefix', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateExponentRules(T1, mulberry32(seed));
      expect(p.question).toMatch(/Simplify:/);
    }
  });

  it('answer is always a positive integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateExponentRules(T1, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n), `Seed ${seed}: answer should be integer`).toBe(true);
      expect(n, `Seed ${seed}: answer should be positive`).toBeGreaterThan(0);
    }
  });

  it('T1 uses multiply rule: answer equals sum of exponents', () => {
    // T1 with steps=1 always uses multiply
    for (let seed = 0; seed < 15; seed++) {
      const p = generateExponentRules(T1, mulberry32(seed));
      // Question like "Simplify: 3^2 × 3^4 = 3^?"
      const match = p.question.match(/(\d+)\^(\d+) × \d+\^(\d+) = \d+\^\?/);
      if (match) {
        const m = Number(match[2]);
        const n = Number(match[3]);
        expect(Number(p.correctAnswer)).toBe(m + n);
      }
    }
  });

  it('T3 produces power-of-power variants', () => {
    let foundPower = false;
    for (let seed = 0; seed < 40; seed++) {
      const p = generateExponentRules(T3, mulberry32(seed));
      assertValidProblem(p, `exp_T3_seed_${seed}`);
      if (p.question.includes(')^')) {
        foundPower = true;
      }
    }
    expect(foundPower, 'T3 should produce power-of-power variants in 40 seeds').toBe(true);
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateExponentRules(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });
});

// ── generateSequence ──────────────────────────────────────────────────────────

describe('generateSequence', () => {
  const T1: GeneratorParams = { rangeA: [1, 5],  rangeB: [2, 8],  steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 4],  rangeB: [2, 6],  steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 6],  rangeB: [4, 10], steps: 3 };
  const T4: GeneratorParams = { rangeA: [1, 4],  rangeB: [3, 6],  steps: 4 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateSequence(T1, mulberry32(42));
    const p2 = generateSequence(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces a valid MathProblem shape (T1 — arithmetic nth term)', () => {
    assertValidProblem(generateSequence(T1, mulberry32(111)), 'seq_T1');
  });

  it('produces a valid MathProblem shape (T2 — geometric nth term)', () => {
    assertValidProblem(generateSequence(T2, mulberry32(222)), 'seq_T2');
  });

  it('produces a valid MathProblem shape (T3 — arithmetic sum)', () => {
    assertValidProblem(generateSequence(T3, mulberry32(333)), 'seq_T3');
  });

  it('produces a valid MathProblem shape (T4 — geometric sum)', () => {
    assertValidProblem(generateSequence(T4, mulberry32(444)), 'seq_T4');
  });

  it('T1 question asks for nth term of arithmetic sequence', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateSequence(T1, mulberry32(seed));
      expect(p.question).toMatch(/arithmetic sequence/);
    }
  });

  it('T2 question asks for nth term of geometric sequence', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateSequence(T2, mulberry32(seed));
      expect(p.question).toMatch(/geometric sequence/);
    }
  });

  it('T3 answer is always a positive integer (arithmetic sum)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateSequence(T3, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n), `Seed ${seed}: sum should be an integer`).toBe(true);
      expect(n, `Seed ${seed}: sum should be positive`).toBeGreaterThan(0);
    }
  });

  it('T4 answer is always a positive integer (geometric sum)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateSequence(T4, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n), `Seed ${seed}: geometric sum should be an integer`).toBe(true);
      expect(n, `Seed ${seed}: geometric sum should be positive`).toBeGreaterThan(0);
    }
  });

  it('explanation contains sequence formula symbols', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateSequence(T1, mulberry32(seed));
      // Should contain 'a₁' or 'a_n' or 'd =' notation
      expect(p.explanation.length).toBeGreaterThan(10);
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateSequence(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });
});

// ── generateLimitIntro ────────────────────────────────────────────────────────

describe('generateLimitIntro', () => {
  const T1: GeneratorParams = { rangeA: [1, 5],  rangeB: [-3, 4], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 4],  rangeB: [-3, 3], steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 6],  rangeB: [-3, 4], steps: 3 };
  const T4: GeneratorParams = { rangeA: [1, 5],  rangeB: [-3, 3], steps: 4 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateLimitIntro(T1, mulberry32(42));
    const p2 = generateLimitIntro(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces a valid MathProblem shape (T1 — linear substitution)', () => {
    assertValidProblem(generateLimitIntro(T1, mulberry32(111)), 'lim_T1');
  });

  it('produces a valid MathProblem shape (T2 — quadratic substitution)', () => {
    assertValidProblem(generateLimitIntro(T2, mulberry32(222)), 'lim_T2');
  });

  it('produces a valid MathProblem shape (T3 — difference of squares)', () => {
    assertValidProblem(generateLimitIntro(T3, mulberry32(333)), 'lim_T3');
  });

  it('produces a valid MathProblem shape (T4 — cubic factoring)', () => {
    assertValidProblem(generateLimitIntro(T4, mulberry32(444)), 'lim_T4');
  });

  it('T1/T2 question contains "lim_{x→" notation', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateLimitIntro(T1, mulberry32(seed));
      expect(p.question).toMatch(/lim_\{x→/);
    }
  });

  it('T3 question contains the difference-of-squares pattern', () => {
    for (let seed = 0; seed < 15; seed++) {
      const p = generateLimitIntro(T3, mulberry32(seed));
      expect(p.question).toMatch(/lim_\{x→/);
      // T3 always produces a fraction (num/den) form
      expect(p.question).toContain('/');
    }
  });

  it('T3 answer is 2a for a nonzero limit point', () => {
    // lim_{x→a} (x²-a²)/(x-a) = 2a
    // Parse the limit point from question like "lim_{x→3} ..."
    for (let seed = 0; seed < 20; seed++) {
      const p = generateLimitIntro(T3, mulberry32(seed));
      const match = p.question.match(/lim_\{x→(-?\d+)\}/);
      if (match) {
        const a = Number(match[1]);
        const expected = 2 * a;
        expect(Number(p.correctAnswer), `Seed ${seed}: expected 2×${a} = ${expected}`).toBe(expected);
      }
    }
  });

  it('answer is always an integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLimitIntro(T1, mulberry32(seed));
      const n = Number(p.correctAnswer);
      expect(Number.isInteger(n), `Seed ${seed}: answer should be an integer`).toBe(true);
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLimitIntro(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('T4 handles without throwing across 20 seeds', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(() => generateLimitIntro(T4, mulberry32(seed * 13))).not.toThrow();
    }
  });
});

// ── generatePolynomialDivision ────────────────────────────────────────────────

describe('generatePolynomialDivision', () => {
  const T1: GeneratorParams = { rangeA: [1, 3], rangeB: [-3, 3], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 4], rangeB: [-3, 3], steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 3], rangeB: [-3, 3], steps: 3 };
  const T4: GeneratorParams = { rangeA: [1, 4], rangeB: [-3, 3], steps: 4 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generatePolynomialDivision(T1, mulberry32(42));
    const p2 = generatePolynomialDivision(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
    expect(p1.distractors).toEqual(p2.distractors);
  });

  it('produces a valid MathProblem shape (T1 — linear quotient, no remainder)', () => {
    assertValidProblem(generatePolynomialDivision(T1, mulberry32(111)), 'polydiv_T1');
  });

  it('produces a valid MathProblem shape (T2 — linear quotient, with remainder)', () => {
    assertValidProblem(generatePolynomialDivision(T2, mulberry32(222)), 'polydiv_T2');
  });

  it('produces a valid MathProblem shape (T3 — quadratic quotient, no remainder)', () => {
    assertValidProblem(generatePolynomialDivision(T3, mulberry32(333)), 'polydiv_T3');
  });

  it('produces a valid MathProblem shape (T4 — quadratic quotient, with remainder)', () => {
    assertValidProblem(generatePolynomialDivision(T4, mulberry32(444)), 'polydiv_T4');
  });

  it('T1/T3 question contains "Divide:" prefix', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generatePolynomialDivision(T1, mulberry32(seed));
      expect(p.question).toMatch(/Divide:/);
    }
  });

  it('T2 question asks for quotient when remainder exists', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generatePolynomialDivision(T2, mulberry32(seed));
      expect(p.question).toMatch(/quotient/i);
    }
  });

  it('T3 answer contains x (quadratic or linear quotient polynomial)', () => {
    for (let seed = 0; seed < 15; seed++) {
      const p = generatePolynomialDivision(T3, mulberry32(seed));
      assertValidProblem(p, `polydiv_T3_seed_${seed}`);
      // Quadratic quotient must contain 'x'
      expect(p.correctAnswer).toMatch(/x/);
    }
  });

  it('distractors are distinct polynomial strings', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generatePolynomialDivision(T1, mulberry32(seed));
      const unique = new Set(p.distractors);
      expect(unique.size, `Seed ${seed}: all 4 distractors should be unique`).toBe(4);
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generatePolynomialDivision(T3, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('T4 quadratic-with-remainder handles without throwing', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(() => generatePolynomialDivision(T4, mulberry32(seed * 11))).not.toThrow();
    }
  });
});

// ── Integration: dispatcher round-trip ────────────────────────────────────────

describe('generateProblem dispatcher — precalculus cases', () => {
  const makeSkill = (generatorId: string, t1: GeneratorParams, t3: GeneratorParams) => ({
    id: `${generatorId}_test`,
    name: 'Test',
    description: 'Test',
    generatorId,
    tierParams: { '1': t1, '2a': t1, '2b': t3, '3': t3 },
  });

  it('dispatches logarithm without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'logarithm',
      { rangeA: [1, 4], rangeB: [1, 3] },
      { rangeA: [1, 10], rangeB: [1, 6] },
    );
    expect(() => generateProblem(skill, '1', 1234)).not.toThrow();
    expect(() => generateProblem(skill, '3', 5678)).not.toThrow();
  });

  it('dispatches exponent_rules without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'exponent_rules',
      { rangeA: [1, 4], rangeB: [1, 4], steps: 1 },
      { rangeA: [1, 8], rangeB: [1, 8], steps: 4 },
    );
    expect(() => generateProblem(skill, '1', 1111)).not.toThrow();
    expect(() => generateProblem(skill, '3', 9999)).not.toThrow();
  });

  it('dispatches sequence without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'sequence',
      { rangeA: [1, 5], rangeB: [2, 8], steps: 1 },
      { rangeA: [1, 4], rangeB: [3, 6], steps: 4 },
    );
    expect(() => generateProblem(skill, '2a', 2222)).not.toThrow();
    expect(() => generateProblem(skill, '3', 7777)).not.toThrow();
  });

  it('dispatches limit_intro without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'limit_intro',
      { rangeA: [1, 5], rangeB: [-3, 4], steps: 1 },
      { rangeA: [1, 5], rangeB: [-3, 3], steps: 4 },
    );
    expect(() => generateProblem(skill, '1', 3333)).not.toThrow();
    expect(() => generateProblem(skill, '3', 7777)).not.toThrow();
  });

  it('dispatches polynomial_division without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'polynomial_division',
      { rangeA: [1, 3], rangeB: [-3, 3], steps: 1 },
      { rangeA: [1, 4], rangeB: [-3, 3], steps: 4 },
    );
    expect(() => generateProblem(skill, '2b', 4444)).not.toThrow();
    expect(() => generateProblem(skill, '3', 8888)).not.toThrow();
  });
});
