/**
 * Unit tests for trigGenerators.ts
 *
 * Covers: determinism, valid MathProblem shape, no distractor equals correctAnswer,
 * domain-specific correctness for all 5 generators.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTrigStandardAngle,
  generateTrigInverse,
  generateTrigRightTriangle,
  generateTrigUnitCircle,
  generateTrigIdentity,
} from './trigGenerators';
import { mulberry32 } from './mathUtils';
import { TRIG_TABLE } from './mathUtils';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Params for tier-1 standard angle generation. */
const T1_STANDARD: GeneratorParams = {
  rangeA: [0, 90],
  rangeB: [0, 90],
  angles: [0, 30, 45, 60, 90],
  trigFunctions: ['sin', 'cos'],
};

/** Params that include tan and full angle set. */
const T3_STANDARD: GeneratorParams = {
  rangeA: [0, 360],
  rangeB: [0, 360],
  angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360],
  trigFunctions: ['sin', 'cos', 'tan'],
};

const T1_INVERSE: GeneratorParams = {
  rangeA: [0, 90],
  rangeB: [0, 90],
  angles: [0, 30, 45, 60, 90],
  trigFunctions: ['sin', 'cos'],
};

const T3_INVERSE: GeneratorParams = {
  rangeA: [0, 360],
  rangeB: [0, 360],
  angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
  trigFunctions: ['sin', 'cos', 'tan'],
};

const T1_RIGHT_TRI: GeneratorParams = { rangeA: [1, 2], rangeB: [1, 2] };
const T3_RIGHT_TRI: GeneratorParams = { rangeA: [3, 8], rangeB: [3, 8] };

const T1_UNIT_CIRCLE: GeneratorParams = {
  rangeA: [0, 90],
  rangeB: [0, 90],
  angles: [0, 90, 180, 270, 360],
  trigFunctions: ['sin', 'cos'],
};

const T3_UNIT_CIRCLE: GeneratorParams = {
  rangeA: [0, 360],
  rangeB: [0, 360],
  angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360],
  trigFunctions: ['sin', 'cos', 'tan'],
};

const T1_IDENTITY: GeneratorParams = {
  rangeA: [0, 90],
  rangeB: [0, 90],
  angles: [30, 45, 60],
  steps: 1,
};

const T3_IDENTITY: GeneratorParams = {
  rangeA: [0, 360],
  rangeB: [0, 360],
  angles: [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330],
  steps: 2,
};

/** All valid exact trig value strings in the TRIG_TABLE. */
const ALL_TRIG_VALUES = new Set<string>(
  Object.values(TRIG_TABLE).flatMap(e => [e.sin, e.cos, e.tan]),
);

// ---------------------------------------------------------------------------
// Shared validity helper
// ---------------------------------------------------------------------------

function assertValidMathProblem(
  result: ReturnType<typeof generateTrigStandardAngle>,
  label: string,
) {
  expect(result.question, `${label}: question should be a non-empty string`).toBeTruthy();
  expect(result.correctAnswer, `${label}: correctAnswer should be non-empty`).toBeTruthy();
  expect(result.distractors, `${label}: distractors should be an array`).toBeInstanceOf(Array);
  expect(result.distractors.length, `${label}: should have exactly 4 distractors`).toBe(4);
  expect(result.explanation, `${label}: explanation should be non-empty`).toBeTruthy();
  expect(result.inputMode, `${label}: inputMode should be 'choice'`).toBe('choice');
  expect(result.acceptableAlternatives, `${label}: acceptableAlternatives should be an array`).toBeInstanceOf(Array);

  // No distractor should equal the correct answer
  for (const d of result.distractors) {
    expect(d, `${label}: distractor "${d}" must not equal correct answer "${result.correctAnswer}"`).not.toBe(result.correctAnswer);
  }

  // Distractors should be unique
  const unique = new Set(result.distractors);
  expect(unique.size, `${label}: distractors should be unique`).toBe(result.distractors.length);
}

// ---------------------------------------------------------------------------
// 1. generateTrigStandardAngle
// ---------------------------------------------------------------------------

describe('generateTrigStandardAngle', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const r1 = generateTrigStandardAngle(T1_STANDARD, rng1);
    const r2 = generateTrigStandardAngle(T1_STANDARD, rng2);
    expect(r1).toEqual(r2);
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(1001);
    const result = generateTrigStandardAngle(T1_STANDARD, rng);
    assertValidMathProblem(result, 'standard_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(9999);
    const result = generateTrigStandardAngle(T3_STANDARD, rng);
    assertValidMathProblem(result, 'standard_t3');
  });

  it('answer matches a known TRIG_TABLE value', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigStandardAngle(T1_STANDARD, rng);
      expect(
        ALL_TRIG_VALUES.has(result.correctAnswer),
        `Seed ${seed}: correctAnswer "${result.correctAnswer}" must be in TRIG_TABLE`,
      ).toBe(true);
    }
  });

  it('question contains the function name and degree symbol', () => {
    const rng = mulberry32(7);
    const result = generateTrigStandardAngle(T1_STANDARD, rng);
    expect(result.question).toMatch(/sin|cos|tan/);
    expect(result.question).toMatch(/°/);
  });

  it('never returns "undefined" as the correct answer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigStandardAngle(T3_STANDARD, rng);
      expect(result.correctAnswer).not.toBe('undefined');
    }
  });

  it('different seeds produce different questions', () => {
    const results = new Set<string>();
    for (let seed = 0; seed < 15; seed++) {
      const rng = mulberry32(seed * 1337);
      results.add(generateTrigStandardAngle(T3_STANDARD, rng).question);
    }
    // With 15 seeds over all 17 angles × 3 functions we should get at least 5 distinct questions
    expect(results.size).toBeGreaterThan(4);
  });
});

// ---------------------------------------------------------------------------
// 2. generateTrigInverse
// ---------------------------------------------------------------------------

describe('generateTrigInverse', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateTrigInverse(T1_INVERSE, rng1)).toEqual(generateTrigInverse(T1_INVERSE, rng2));
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(2002);
    assertValidMathProblem(generateTrigInverse(T1_INVERSE, rng), 'inverse_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(8888);
    assertValidMathProblem(generateTrigInverse(T3_INVERSE, rng), 'inverse_t3');
  });

  it('correct answer is a valid standard angle (numeric string)', () => {
    const validAngles = new Set(
      Object.keys(TRIG_TABLE).map(String),
    );
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigInverse(T1_INVERSE, rng);
      expect(
        validAngles.has(result.correctAnswer),
        `Seed ${seed}: answer "${result.correctAnswer}" must be a valid TRIG_TABLE angle`,
      ).toBe(true);
    }
  });

  it('question references inverse trig notation', () => {
    const rng = mulberry32(5);
    const result = generateTrigInverse(T1_INVERSE, rng);
    expect(result.question).toMatch(/sin|cos|tan/);
    expect(result.question).toMatch(/θ/);
  });

  it('explanation uses superscript inverse notation', () => {
    const rng = mulberry32(13);
    const result = generateTrigInverse(T1_INVERSE, rng);
    // Explanation contains the inverse function name character sequence
    expect(result.explanation).toMatch(/⁻¹/);
  });
});

// ---------------------------------------------------------------------------
// 3. generateTrigRightTriangle
// ---------------------------------------------------------------------------

describe('generateTrigRightTriangle', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateTrigRightTriangle(T1_RIGHT_TRI, rng1)).toEqual(
      generateTrigRightTriangle(T1_RIGHT_TRI, rng2),
    );
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(3003);
    assertValidMathProblem(generateTrigRightTriangle(T1_RIGHT_TRI, rng), 'right_tri_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(7777);
    assertValidMathProblem(generateTrigRightTriangle(T3_RIGHT_TRI, rng), 'right_tri_t3');
  });

  it('correct answer is an integer degree in range 1–89', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigRightTriangle(T1_RIGHT_TRI, rng);
      const angle = Number(result.correctAnswer);
      expect(Number.isInteger(angle), `Seed ${seed}: angle should be integer`).toBe(true);
      expect(angle, `Seed ${seed}: angle should be > 0`).toBeGreaterThan(0);
      expect(angle, `Seed ${seed}: angle should be < 90`).toBeLessThan(90);
    }
  });

  it('question mentions opposite, adjacent, and θ', () => {
    const rng = mulberry32(11);
    const result = generateTrigRightTriangle(T1_RIGHT_TRI, rng);
    expect(result.question).toMatch(/opposite/i);
    expect(result.question).toMatch(/adjacent/i);
    expect(result.question).toMatch(/θ/);
  });

  it('explanation contains arctan and the ratio', () => {
    const rng = mulberry32(17);
    const result = generateTrigRightTriangle(T3_RIGHT_TRI, rng);
    expect(result.explanation).toMatch(/arctan/);
    expect(result.explanation).toMatch(/\//); // ratio separator
  });
});

// ---------------------------------------------------------------------------
// 4. generateTrigUnitCircle
// ---------------------------------------------------------------------------

describe('generateTrigUnitCircle', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateTrigUnitCircle(T1_UNIT_CIRCLE, rng1)).toEqual(
      generateTrigUnitCircle(T1_UNIT_CIRCLE, rng2),
    );
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(4004);
    assertValidMathProblem(generateTrigUnitCircle(T1_UNIT_CIRCLE, rng), 'unit_circle_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(6666);
    assertValidMathProblem(generateTrigUnitCircle(T3_UNIT_CIRCLE, rng), 'unit_circle_t3');
  });

  it('coordinate mode answer has parenthesised (cos, sin) format', () => {
    // Force coordinate mode by using a seed that produces rng() < 0.5 for mode decision
    let foundCoordinate = false;
    for (let seed = 0; seed < 40; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigUnitCircle(T1_UNIT_CIRCLE, rng);
      if (result.correctAnswer.startsWith('(')) {
        expect(result.correctAnswer).toMatch(/^\([^,]+,\s*[^)]+\)$/);
        foundCoordinate = true;
        break;
      }
    }
    expect(foundCoordinate, 'Should find at least one coordinate-mode question in 40 seeds').toBe(true);
  });

  it('value mode answer is a valid TRIG_TABLE value', () => {
    let foundValue = false;
    for (let seed = 0; seed < 40; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigUnitCircle(T1_UNIT_CIRCLE, rng);
      if (!result.correctAnswer.startsWith('(')) {
        expect(
          ALL_TRIG_VALUES.has(result.correctAnswer),
          `Value mode answer "${result.correctAnswer}" must be in TRIG_TABLE`,
        ).toBe(true);
        foundValue = true;
        break;
      }
    }
    expect(foundValue, 'Should find at least one value-mode question in 40 seeds').toBe(true);
  });

  it('question mentions unit circle and degree angle', () => {
    const rng = mulberry32(22);
    const result = generateTrigUnitCircle(T1_UNIT_CIRCLE, rng);
    // Either "unit circle" (coordinate mode) or just degree (value mode)
    expect(result.question).toMatch(/°/);
  });
});

// ---------------------------------------------------------------------------
// 5. generateTrigIdentity
// ---------------------------------------------------------------------------

describe('generateTrigIdentity', () => {
  it('is deterministic: same seed produces same result', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    expect(generateTrigIdentity(T1_IDENTITY, rng1)).toEqual(generateTrigIdentity(T1_IDENTITY, rng2));
  });

  it('produces valid MathProblem shape (tier 1)', () => {
    const rng = mulberry32(5005);
    assertValidMathProblem(generateTrigIdentity(T1_IDENTITY, rng), 'identity_t1');
  });

  it('produces valid MathProblem shape (tier 3)', () => {
    const rng = mulberry32(5555);
    assertValidMathProblem(generateTrigIdentity(T3_IDENTITY, rng), 'identity_t3');
  });

  it('Pythagorean identity always yields "1" for sin²+cos² template', () => {
    // Run 20 seeds on tier-1 angles [30,45,60] — most hits should be the Pythagorean identity
    let pythagoreanCount = 0;
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigIdentity(T1_IDENTITY, rng);
      if (result.question.includes('sin²') && result.question.includes('cos²') && !result.question.includes('tan')) {
        expect(result.correctAnswer, 'sin²+cos² must equal 1').toBe('1');
        pythagoreanCount++;
      }
    }
    // The Pythagorean identity is one of 6 templates — with 20 seeds it should appear at least once
    expect(pythagoreanCount, 'Pythagorean identity should appear at least once in 20 seeds').toBeGreaterThanOrEqual(1);
  });

  it('question contains "Evaluate:" prefix', () => {
    const rng = mulberry32(33);
    const result = generateTrigIdentity(T1_IDENTITY, rng);
    expect(result.question).toMatch(/^Evaluate:/);
  });

  it('explanation references the identity used', () => {
    const rng = mulberry32(44);
    const result = generateTrigIdentity(T3_IDENTITY, rng);
    // Explanation should contain "identity" and the angle
    expect(result.explanation).toMatch(/identity/i);
    expect(result.explanation).toMatch(/θ = \d+°/);
  });

  it('answer is non-empty and appears as a reasonable value', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = mulberry32(seed);
      const result = generateTrigIdentity(T3_IDENTITY, rng);
      expect(result.correctAnswer).toBeTruthy();
      expect(result.correctAnswer.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-generator: integration through generateProblem dispatcher
// ---------------------------------------------------------------------------

describe('generateProblem dispatcher — trig cases', () => {
  it('dispatches trig_standard_angle without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'trig_std_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'trig_standard_angle',
      tierParams: {
        '1': T1_STANDARD,
        '2a': T1_STANDARD,
        '2b': T3_STANDARD,
        '3': T3_STANDARD,
      },
    };
    expect(() => generateProblem(skill, '1', 1234)).not.toThrow();
    expect(() => generateProblem(skill, '3', 5678)).not.toThrow();
  });

  it('dispatches trig_inverse without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'trig_inv_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'trig_inverse',
      tierParams: {
        '1': T1_INVERSE,
        '2a': T1_INVERSE,
        '2b': T3_INVERSE,
        '3': T3_INVERSE,
      },
    };
    expect(() => generateProblem(skill, '1', 1111)).not.toThrow();
  });

  it('dispatches trig_right_triangle without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'trig_rt_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'trig_right_triangle',
      tierParams: {
        '1': T1_RIGHT_TRI,
        '2a': T1_RIGHT_TRI,
        '2b': T3_RIGHT_TRI,
        '3': T3_RIGHT_TRI,
      },
    };
    expect(() => generateProblem(skill, '2b', 2222)).not.toThrow();
  });

  it('dispatches trig_unit_circle without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'trig_uc_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'trig_unit_circle',
      tierParams: {
        '1': T1_UNIT_CIRCLE,
        '2a': T1_UNIT_CIRCLE,
        '2b': T3_UNIT_CIRCLE,
        '3': T3_UNIT_CIRCLE,
      },
    };
    expect(() => generateProblem(skill, '1', 3333)).not.toThrow();
  });

  it('dispatches trig_identity without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'trig_id_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'trig_identity',
      tierParams: {
        '1': T1_IDENTITY,
        '2a': T1_IDENTITY,
        '2b': T3_IDENTITY,
        '3': T3_IDENTITY,
      },
    };
    expect(() => generateProblem(skill, '3', 4444)).not.toThrow();
  });
});
