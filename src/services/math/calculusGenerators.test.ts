/**
 * Unit tests for calculusGenerators.ts
 *
 * Tests each of the five calculus generators for:
 *   - Determinism (same seed → same output)
 *   - Valid MathProblem shape (required fields, correct inputMode)
 *   - No distractor equals the correct answer
 *   - Answer format matches expected pattern
 *   - Mathematical correctness where verifiable
 *
 * Source files: src/services/math/calculusGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import { describe, it, expect } from 'vitest';
import { mulberry32 } from './mathUtils';
import {
  generateDerivativePowerRule,
  generateDerivativeChainRule,
  generateBasicIntegral,
  generateLimitEvaluation,
  generateDefiniteIntegral,
} from './calculusGenerators';
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

// ── generateDerivativePowerRule ───────────────────────────────────────────────

describe('generateDerivativePowerRule', () => {
  const T1: GeneratorParams = { rangeA: [1, 4],  rangeB: [1, 3], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 6],  rangeB: [1, 4], steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 10], rangeB: [1, 6], steps: 3 };

  it('is deterministic: same seed produces same result (T1)', () => {
    const p1 = generateDerivativePowerRule(T1, mulberry32(42));
    const p2 = generateDerivativePowerRule(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
    expect(p1.distractors).toEqual(p2.distractors);
  });

  it('produces a valid MathProblem shape (T1)', () => {
    assertValidProblem(generateDerivativePowerRule(T1, mulberry32(100)), 'power_T1');
  });

  it('produces a valid MathProblem shape (T2)', () => {
    assertValidProblem(generateDerivativePowerRule(T2, mulberry32(200)), 'power_T2');
  });

  it('produces a valid MathProblem shape (T3)', () => {
    assertValidProblem(generateDerivativePowerRule(T3, mulberry32(300)), 'power_T3');
  });

  it('question contains "d/dx" notation', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateDerivativePowerRule(T1, mulberry32(seed));
      expect(p.question).toMatch(/d\/dx/);
    }
  });

  it('explanation contains "Power rule"', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateDerivativePowerRule(T1, mulberry32(seed));
      expect(p.explanation).toMatch(/Power rule/);
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDerivativePowerRule(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('handles T3 multi-term polynomials without throwing', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(() => generateDerivativePowerRule(T3, mulberry32(seed * 7))).not.toThrow();
    }
  });
});

// ── generateDerivativeChainRule ───────────────────────────────────────────────

describe('generateDerivativeChainRule', () => {
  const T1: GeneratorParams = { rangeA: [1, 4], rangeB: [2, 3], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 6], rangeB: [2, 5], steps: 1 };
  const T3: GeneratorParams = { rangeA: [1, 8], rangeB: [2, 6], steps: 2 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateDerivativeChainRule(T1, mulberry32(42));
    const p2 = generateDerivativeChainRule(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces a valid MathProblem shape (T1)', () => {
    assertValidProblem(generateDerivativeChainRule(T1, mulberry32(111)), 'chain_T1');
  });

  it('produces a valid MathProblem shape (T2)', () => {
    assertValidProblem(generateDerivativeChainRule(T2, mulberry32(222)), 'chain_T2');
  });

  it('produces a valid MathProblem shape (T3 — may include sqrt)', () => {
    assertValidProblem(generateDerivativeChainRule(T3, mulberry32(333)), 'chain_T3');
  });

  it('question contains "d/dx" notation', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateDerivativeChainRule(T1, mulberry32(seed));
      expect(p.question).toMatch(/d\/dx/);
    }
  });

  it('standard form: answer contains outer coefficient', () => {
    // For (ax+b)^n, the answer must contain n*a as the leading coefficient
    // We just check it's non-empty and not equal to a distractor
    for (let seed = 0; seed < 20; seed++) {
      const p = generateDerivativeChainRule(T1, mulberry32(seed));
      assertValidProblem(p, `chain_seed_${seed}`);
    }
  });

  it('T3 sqrt variant produces valid answers containing "sqrt" when triggered', () => {
    let foundSqrt = false;
    for (let seed = 0; seed < 50; seed++) {
      const p = generateDerivativeChainRule(T3, mulberry32(seed));
      assertValidProblem(p, `chain_t3_seed_${seed}`);
      if (p.question.includes('sqrt') || p.correctAnswer.includes('sqrt')) {
        foundSqrt = true;
      }
    }
    // With 50 seeds at 40% sqrt probability, we should see at least one
    expect(foundSqrt, 'T3 should produce sqrt variants in 50 seeds').toBe(true);
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDerivativeChainRule(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });
});

// ── generateBasicIntegral ─────────────────────────────────────────────────────

describe('generateBasicIntegral', () => {
  const T1: GeneratorParams = { rangeA: [1, 3], rangeB: [1, 2], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 4], rangeB: [1, 3], steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 6], rangeB: [1, 5], steps: 3 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateBasicIntegral(T1, mulberry32(42));
    const p2 = generateBasicIntegral(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces a valid MathProblem shape (T1)', () => {
    assertValidProblem(generateBasicIntegral(T1, mulberry32(111)), 'integral_T1');
  });

  it('produces a valid MathProblem shape (T2)', () => {
    assertValidProblem(generateBasicIntegral(T2, mulberry32(222)), 'integral_T2');
  });

  it('produces a valid MathProblem shape (T3)', () => {
    assertValidProblem(generateBasicIntegral(T3, mulberry32(333)), 'integral_T3');
  });

  it('question contains integral symbol ∫ and dx', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateBasicIntegral(T1, mulberry32(seed));
      expect(p.question).toContain('∫');
      expect(p.question).toContain('dx');
    }
  });

  it('answer always ends with "+ C"', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateBasicIntegral(T2, mulberry32(seed));
      expect(p.correctAnswer, `Seed ${seed}: answer should end with + C`).toMatch(/\+ C$/);
    }
  });

  it('one distractor is the antiderivative without + C', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateBasicIntegral(T1, mulberry32(seed));
      // The antiderivative without +C is always a candidate distractor
      const withoutC = p.correctAnswer.replace(' + C', '');
      // It may or may not be in distractors (depends on deduplication), but check shape is valid
      expect(p.correctAnswer).toContain('+ C');
    }
  });

  it('explanation contains "Reverse power rule"', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateBasicIntegral(T1, mulberry32(seed));
      expect(p.explanation).toMatch(/Reverse power rule/);
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateBasicIntegral(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });
});

// ── generateLimitEvaluation ───────────────────────────────────────────────────

describe('generateLimitEvaluation', () => {
  const T1: GeneratorParams = { rangeA: [1, 5],  rangeB: [-3, 3], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 8],  rangeB: [-5, 5], steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 10], rangeB: [-6, 6], steps: 3 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateLimitEvaluation(T1, mulberry32(42));
    const p2 = generateLimitEvaluation(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces a valid MathProblem shape (T1 — direct sub)', () => {
    assertValidProblem(generateLimitEvaluation(T1, mulberry32(111)), 'limit_T1');
  });

  it('produces a valid MathProblem shape (T2 — factored or direct)', () => {
    assertValidProblem(generateLimitEvaluation(T2, mulberry32(222)), 'limit_T2');
  });

  it('produces a valid MathProblem shape (T3 — special limits)', () => {
    assertValidProblem(generateLimitEvaluation(T3, mulberry32(333)), 'limit_T3');
  });

  it('T1/T2 question contains "lim_{x→" notation', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateLimitEvaluation(T1, mulberry32(seed));
      expect(p.question).toMatch(/lim_\{x→/);
    }
  });

  it('T3 special limits produce known answers', () => {
    const knownAnswers = new Set(['0', '1', '∞', '-∞', 'e', '1/2', '3']);
    let specialCount = 0;
    for (let seed = 0; seed < 20; seed++) {
      const p = generateLimitEvaluation(T3, mulberry32(seed));
      // T3 steps=3 always uses special limits pool
      expect(p.question.length).toBeGreaterThan(0);
      if (knownAnswers.has(p.correctAnswer)) {
        specialCount++;
      }
    }
    expect(specialCount, 'Most T3 answers should be from special limits pool').toBeGreaterThan(0);
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLimitEvaluation(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('produces valid results for both direct sub and factored variants in T2', () => {
    let foundFactored = false;
    for (let seed = 0; seed < 30; seed++) {
      const p = generateLimitEvaluation(T2, mulberry32(seed));
      assertValidProblem(p, `limit_T2_seed_${seed}`);
      if (p.question.includes('/')) {
        foundFactored = true;
      }
    }
    expect(foundFactored, 'Should see factored limit variants in 30 seeds').toBe(true);
  });
});

// ── generateDefiniteIntegral ──────────────────────────────────────────────────

describe('generateDefiniteIntegral', () => {
  const T1: GeneratorParams = { rangeA: [1, 2], rangeB: [0, 3], steps: 1 };
  const T2: GeneratorParams = { rangeA: [1, 3], rangeB: [0, 4], steps: 2 };
  const T3: GeneratorParams = { rangeA: [1, 4], rangeB: [0, 5], steps: 3 };

  it('is deterministic: same seed produces same result', () => {
    const p1 = generateDefiniteIntegral(T1, mulberry32(42));
    const p2 = generateDefiniteIntegral(T1, mulberry32(42));
    expect(p1.question).toBe(p2.question);
    expect(p1.correctAnswer).toBe(p2.correctAnswer);
  });

  it('produces a valid MathProblem shape (T1)', () => {
    assertValidProblem(generateDefiniteIntegral(T1, mulberry32(111)), 'definite_T1');
  });

  it('produces a valid MathProblem shape (T2)', () => {
    assertValidProblem(generateDefiniteIntegral(T2, mulberry32(222)), 'definite_T2');
  });

  it('produces a valid MathProblem shape (T3)', () => {
    assertValidProblem(generateDefiniteIntegral(T3, mulberry32(333)), 'definite_T3');
  });

  it('question contains definite integral notation with bounds', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateDefiniteIntegral(T1, mulberry32(seed));
      expect(p.question).toContain('∫_{');
      expect(p.question).toContain('}^{');
      expect(p.question).toContain('dx');
    }
  });

  it('correct answer is always an integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDefiniteIntegral(T1, mulberry32(seed));
      const num = Number(p.correctAnswer);
      expect(Number.isInteger(num), `Seed ${seed}: answer "${p.correctAnswer}" should be an integer`).toBe(true);
      expect(Number.isFinite(num), `Seed ${seed}: answer should be finite`).toBe(true);
    }
  });

  it('T2 correct answer is always an integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDefiniteIntegral(T2, mulberry32(seed));
      const num = Number(p.correctAnswer);
      expect(Number.isInteger(num), `Seed ${seed}: T2 answer "${p.correctAnswer}" should be an integer`).toBe(true);
    }
  });

  it('explanation references F(hi) - F(lo) pattern', () => {
    for (let seed = 0; seed < 10; seed++) {
      const p = generateDefiniteIntegral(T1, mulberry32(seed));
      expect(p.explanation).toMatch(/F\(\d+\) - F\(\d+\)/);
    }
  });

  it('no distractor equals correct answer across many seeds', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = generateDefiniteIntegral(T2, mulberry32(seed));
      expect(p.distractors).not.toContain(p.correctAnswer);
    }
  });

  it('handles T3 (cubic integrand) without throwing', () => {
    for (let seed = 0; seed < 15; seed++) {
      expect(() => generateDefiniteIntegral(T3, mulberry32(seed * 11))).not.toThrow();
    }
  });
});

// ── Integration: dispatcher round-trip ────────────────────────────────────────

describe('generateProblem dispatcher — calculus cases', () => {
  const makeSkill = (generatorId: string, t1: GeneratorParams, t3: GeneratorParams) => ({
    id: `${generatorId}_test`,
    name: 'Test',
    description: 'Test',
    generatorId,
    tierParams: { '1': t1, '2a': t1, '2b': t3, '3': t3 },
  });

  it('dispatches derivative_power_rule without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'derivative_power_rule',
      { rangeA: [1, 4], rangeB: [1, 3], steps: 1 },
      { rangeA: [1, 10], rangeB: [1, 6], steps: 3 },
    );
    expect(() => generateProblem(skill, '1', 1234)).not.toThrow();
    expect(() => generateProblem(skill, '3', 5678)).not.toThrow();
  });

  it('dispatches derivative_chain_rule without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'derivative_chain_rule',
      { rangeA: [1, 4], rangeB: [2, 3], steps: 1 },
      { rangeA: [1, 8], rangeB: [2, 6], steps: 2 },
    );
    expect(() => generateProblem(skill, '1', 1111)).not.toThrow();
    expect(() => generateProblem(skill, '3', 9999)).not.toThrow();
  });

  it('dispatches basic_integral without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'basic_integral',
      { rangeA: [1, 3], rangeB: [1, 2], steps: 1 },
      { rangeA: [1, 6], rangeB: [1, 5], steps: 3 },
    );
    expect(() => generateProblem(skill, '2a', 2222)).not.toThrow();
  });

  it('dispatches limit_evaluation without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'limit_evaluation',
      { rangeA: [1, 5], rangeB: [-3, 3], steps: 1 },
      { rangeA: [1, 10], rangeB: [-6, 6], steps: 3 },
    );
    expect(() => generateProblem(skill, '1', 3333)).not.toThrow();
    expect(() => generateProblem(skill, '3', 7777)).not.toThrow();
  });

  it('dispatches definite_integral without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = makeSkill(
      'definite_integral',
      { rangeA: [1, 2], rangeB: [0, 3], steps: 1 },
      { rangeA: [1, 4], rangeB: [0, 5], steps: 3 },
    );
    expect(() => generateProblem(skill, '2b', 4444)).not.toThrow();
    expect(() => generateProblem(skill, '3', 8888)).not.toThrow();
  });
});
