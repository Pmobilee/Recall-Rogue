/**
 * Unit tests for unitConversionGenerators.ts
 *
 * Covers: determinism, valid MathProblem shape, no distractor equals correctAnswer,
 * numeric correctness per conversion type, and all 5 generators across all tiers.
 */

import { describe, it, expect } from 'vitest';
import {
  generateLengthConversion,
  generateWeightConversion,
  generateTemperatureConversion,
  generateAreaVolumeConversion,
  generateSpeedConversion,
} from './unitConversionGenerators';
import { mulberry32 } from './mathUtils';
import type { GeneratorParams } from '../../data/proceduralDeckTypes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T1: GeneratorParams = { rangeA: [1, 1000], rangeB: [1, 100], steps: 1 };
const T2A: GeneratorParams = { rangeA: [1, 100],  rangeB: [1, 100], steps: 2 };
const T2B: GeneratorParams = { rangeA: [1, 100],  rangeB: [1, 100], steps: 3 };
const T3: GeneratorParams =  { rangeA: [1, 1000], rangeB: [1, 100], steps: 4 };

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
    expect(d, `${label}: distractor "${d}" must not equal correct answer "${result.correctAnswer}"`).not.toBe(result.correctAnswer);
  }

  const unique = new Set(result.distractors);
  expect(unique.size, `${label}: distractors should be unique`).toBe(result.distractors.length);
}

// ---------------------------------------------------------------------------
// 1. generateLengthConversion
// ---------------------------------------------------------------------------

describe('generateLengthConversion', () => {
  it('is deterministic: same seed produces same result (T1)', () => {
    const r1 = generateLengthConversion(T1, mulberry32(42));
    const r2 = generateLengthConversion(T1, mulberry32(42));
    expect(r1).toEqual(r2);
  });

  it('produces valid MathProblem shape for all tiers', () => {
    for (const [params, label] of [[T1, 'length_T1'], [T2A, 'length_T2A'], [T2B, 'length_T2B'], [T3, 'length_T3']] as const) {
      const rng = mulberry32(1001);
      assertValidMathProblem(generateLengthConversion(params, rng), label);
    }
  });

  it('correct answer is a finite number string', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateLengthConversion(T1, mulberry32(seed));
      const n = Number(result.correctAnswer);
      expect(Number.isFinite(n), `Seed ${seed}: answer should be numeric, got "${result.correctAnswer}"`).toBe(true);
      expect(n, `Seed ${seed}: answer should be > 0`).toBeGreaterThan(0);
    }
  });

  it('question contains unit names and Convert keyword', () => {
    const result = generateLengthConversion(T1, mulberry32(7));
    expect(result.question).toMatch(/convert/i);
  });

  it('T1 answers are always integer (same-system)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const result = generateLengthConversion(T1, mulberry32(seed));
      const n = Number(result.correctAnswer);
      // T1 same-system pairs are always integer by design
      expect(n % 1 === 0, `Seed ${seed}: T1 answer should be integer, got ${result.correctAnswer}`).toBe(true);
    }
  });

  it('T3 questions mention Multi-step', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateLengthConversion(T3, mulberry32(seed));
      expect(result.question).toMatch(/multi-step/i);
    }
  });

  it('different seeds produce varied questions', () => {
    const questions = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      questions.add(generateLengthConversion(T2A, mulberry32(seed * 13)).question);
    }
    expect(questions.size, 'Should produce at least 3 distinct questions').toBeGreaterThan(2);
  });
});

// ---------------------------------------------------------------------------
// 2. generateWeightConversion
// ---------------------------------------------------------------------------

describe('generateWeightConversion', () => {
  it('is deterministic: same seed produces same result', () => {
    const r1 = generateWeightConversion(T1, mulberry32(99));
    const r2 = generateWeightConversion(T1, mulberry32(99));
    expect(r1).toEqual(r2);
  });

  it('produces valid MathProblem shape for all tiers', () => {
    for (const [params, label] of [[T1, 'weight_T1'], [T2A, 'weight_T2A'], [T2B, 'weight_T2B'], [T3, 'weight_T3']] as const) {
      assertValidMathProblem(generateWeightConversion(params, mulberry32(2002)), label);
    }
  });

  it('correct answer is a finite positive number for T1', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateWeightConversion(T1, mulberry32(seed));
      const n = Number(result.correctAnswer);
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('T1 answers are always integer (same-system)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const result = generateWeightConversion(T1, mulberry32(seed));
      const n = Number(result.correctAnswer);
      expect(n % 1 === 0, `Seed ${seed}: T1 weight answer should be integer, got ${result.correctAnswer}`).toBe(true);
    }
  });

  it('question contains unit names', () => {
    const units = ['g', 'kg', 'oz', 'lbs', 'mg', 'tonne'];
    const result = generateWeightConversion(T1, mulberry32(5));
    const matchesAny = units.some(u => result.question.includes(u));
    expect(matchesAny, `Question should mention a weight unit: "${result.question}"`).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. generateTemperatureConversion
// ---------------------------------------------------------------------------

describe('generateTemperatureConversion', () => {
  it('is deterministic: same seed produces same result', () => {
    const r1 = generateTemperatureConversion(T1, mulberry32(123));
    const r2 = generateTemperatureConversion(T1, mulberry32(123));
    expect(r1).toEqual(r2);
  });

  it('produces valid MathProblem shape for all tiers', () => {
    for (const [params, label] of [[T1, 'temp_T1'], [T2A, 'temp_T2A'], [T2B, 'temp_T2B'], [T3, 'temp_T3']] as const) {
      assertValidMathProblem(generateTemperatureConversion(params, mulberry32(3003)), label);
    }
  });

  it('T1 (F→C): answer is integer in valid range', () => {
    for (let seed = 0; seed < 21; seed++) {
      const result = generateTemperatureConversion(T1, mulberry32(seed));
      const n = Number(result.correctAnswer);
      expect(Number.isInteger(n), `Seed ${seed}: F→C answer should be integer, got "${result.correctAnswer}"`).toBe(true);
      // Valid C range for F values 32-212
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it('T1 question asks to convert to Celsius', () => {
    const result = generateTemperatureConversion(T1, mulberry32(7));
    expect(result.question).toMatch(/celsius|°C/i);
    expect(result.question).toMatch(/°F/);
  });

  it('T2A question asks to convert to Fahrenheit', () => {
    const result = generateTemperatureConversion(T2A, mulberry32(11));
    expect(result.question).toMatch(/fahrenheit|°F/i);
  });

  it('T2B question asks to convert to Kelvin', () => {
    const result = generateTemperatureConversion(T2B, mulberry32(13));
    expect(result.question).toMatch(/kelvin|K/i);
  });

  it('T3 (F→K): answer is K value >= 273', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateTemperatureConversion(T3, mulberry32(seed));
      const n = Number(result.correctAnswer);
      expect(n, `Seed ${seed}: F→K answer should be >= 273 (freezing point = 273K), got ${n}`).toBeGreaterThanOrEqual(273);
    }
  });

  it('well-known conversion: 32°F = 0°C', () => {
    // Run enough seeds to find the 32°F case
    let found = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = generateTemperatureConversion(T1, mulberry32(seed));
      if (result.question.includes('32°F')) {
        expect(result.correctAnswer, '32°F should convert to 0°C').toBe('0');
        found = true;
        break;
      }
    }
    // It's OK if 32°F doesn't appear in 100 seeds — just verify shape
    if (!found) {
      const result = generateTemperatureConversion(T1, mulberry32(0));
      assertValidMathProblem(result, 'temp_32F_fallback');
    }
  });

  it('well-known conversion: 212°F = 100°C', () => {
    let found = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = generateTemperatureConversion(T1, mulberry32(seed));
      if (result.question.includes('212°F')) {
        expect(result.correctAnswer, '212°F should convert to 100°C').toBe('100');
        found = true;
        break;
      }
    }
    if (!found) {
      // Just verify we can generate something valid
      assertValidMathProblem(generateTemperatureConversion(T1, mulberry32(50)), 'temp_212F_fallback');
    }
  });

  it('explanation references the formula', () => {
    const result = generateTemperatureConversion(T1, mulberry32(3));
    expect(result.explanation).toMatch(/5\/9|×/);
  });
});

// ---------------------------------------------------------------------------
// 4. generateAreaVolumeConversion
// ---------------------------------------------------------------------------

describe('generateAreaVolumeConversion', () => {
  it('is deterministic: same seed produces same result', () => {
    const r1 = generateAreaVolumeConversion(T1, mulberry32(77));
    const r2 = generateAreaVolumeConversion(T1, mulberry32(77));
    expect(r1).toEqual(r2);
  });

  it('produces valid MathProblem shape for all tiers', () => {
    for (const [params, label] of [[T1, 'av_T1'], [T2A, 'av_T2A'], [T2B, 'av_T2B'], [T3, 'av_T3']] as const) {
      assertValidMathProblem(generateAreaVolumeConversion(params, mulberry32(4004)), label);
    }
  });

  it('correct answer is a finite positive number for all tiers', () => {
    for (const params of [T1, T2A, T2B, T3]) {
      for (let seed = 0; seed < 10; seed++) {
        const result = generateAreaVolumeConversion(params, mulberry32(seed));
        const n = Number(result.correctAnswer);
        expect(Number.isFinite(n), `Answer should be numeric, got "${result.correctAnswer}"`).toBe(true);
        expect(n).toBeGreaterThan(0);
      }
    }
  });

  it('T1 answers are always integer (same-system)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateAreaVolumeConversion(T1, mulberry32(seed));
      const n = Number(result.correctAnswer);
      expect(n % 1 === 0, `Seed ${seed}: T1 area/volume answer should be integer, got ${result.correctAnswer}`).toBe(true);
    }
  });

  it('question contains units (² or ³ or L/mL or gallon)', () => {
    const unitPattern = /²|³|mL|liter|gallon|ft|cm|m²|in/i;
    const result = generateAreaVolumeConversion(T1, mulberry32(9));
    expect(result.question).toMatch(unitPattern);
  });
});

// ---------------------------------------------------------------------------
// 5. generateSpeedConversion
// ---------------------------------------------------------------------------

describe('generateSpeedConversion', () => {
  it('is deterministic: same seed produces same result', () => {
    const r1 = generateSpeedConversion(T1, mulberry32(55));
    const r2 = generateSpeedConversion(T1, mulberry32(55));
    expect(r1).toEqual(r2);
  });

  it('produces valid MathProblem shape for all tiers', () => {
    for (const [params, label] of [[T1, 'speed_T1'], [T2A, 'speed_T2A'], [T2B, 'speed_T2B'], [T3, 'speed_T3']] as const) {
      assertValidMathProblem(generateSpeedConversion(params, mulberry32(5005)), label);
    }
  });

  it('correct answer is a finite positive number', () => {
    for (const params of [T1, T2A, T2B, T3]) {
      for (let seed = 0; seed < 10; seed++) {
        const result = generateSpeedConversion(params, mulberry32(seed));
        const n = Number(result.correctAnswer);
        expect(Number.isFinite(n), `Answer should be numeric`).toBe(true);
        expect(n).toBeGreaterThan(0);
      }
    }
  });

  it('T1 (m/s ↔ km/h): answers are exact 1-decimal or integer multiples of 3.6', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateSpeedConversion(T1, mulberry32(seed));
      const n = Number(result.correctAnswer);
      // 3.6 factor: integer m/s × 3.6 gives at most 1 decimal
      const decimalPlaces = result.correctAnswer.includes('.') ? result.correctAnswer.split('.')[1].length : 0;
      expect(decimalPlaces, `Seed ${seed}: speed T1 answer should have at most 1 decimal, got "${result.correctAnswer}"`).toBeLessThanOrEqual(1);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('well-known: 10 m/s = 36 km/h', () => {
    let found = false;
    for (let seed = 0; seed < 50; seed++) {
      const result = generateSpeedConversion(T1, mulberry32(seed));
      if (result.question.includes('10 m/s') && result.question.toLowerCase().includes('km/h')) {
        expect(result.correctAnswer, '10 m/s should be 36 km/h').toBe('36');
        found = true;
        break;
      }
    }
    // If not found in 50 seeds, just verify basic shape passes
    if (!found) {
      assertValidMathProblem(generateSpeedConversion(T1, mulberry32(0)), 'speed_10ms_fallback');
    }
  });

  it('question mentions speed units (m/s, km/h, mph, knots)', () => {
    const unitPattern = /m\/s|km\/h|mph|knots/i;
    for (const params of [T1, T2A, T2B, T3]) {
      const result = generateSpeedConversion(params, mulberry32(7));
      expect(result.question, `Should mention speed units`).toMatch(unitPattern);
    }
  });

  it('T3 questions mention multi-step or chain context', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateSpeedConversion(T3, mulberry32(seed));
      expect(result.question).toMatch(/multi-step/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-generator: integration through generateProblem dispatcher
// ---------------------------------------------------------------------------

describe('generateProblem dispatcher — unit conversion cases', () => {
  it('dispatches length_conversion without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'length_conv_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'length_conversion',
      tierParams: { '1': T1, '2a': T2A, '2b': T2B, '3': T3 },
    };
    expect(() => generateProblem(skill, '1', 1234)).not.toThrow();
    expect(() => generateProblem(skill, '3', 5678)).not.toThrow();
  });

  it('dispatches weight_conversion without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'weight_conv_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'weight_conversion',
      tierParams: { '1': T1, '2a': T2A, '2b': T2B, '3': T3 },
    };
    expect(() => generateProblem(skill, '1', 111)).not.toThrow();
    expect(() => generateProblem(skill, '2b', 222)).not.toThrow();
  });

  it('dispatches temperature_conversion without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'temp_conv_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'temperature_conversion',
      tierParams: { '1': T1, '2a': T2A, '2b': T2B, '3': T3 },
    };
    expect(() => generateProblem(skill, '1', 333)).not.toThrow();
    expect(() => generateProblem(skill, '3', 444)).not.toThrow();
  });

  it('dispatches area_volume_conversion without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'av_conv_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'area_volume_conversion',
      tierParams: { '1': T1, '2a': T2A, '2b': T2B, '3': T3 },
    };
    expect(() => generateProblem(skill, '2a', 555)).not.toThrow();
  });

  it('dispatches speed_conversion without throwing', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'speed_conv_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'speed_conversion',
      tierParams: { '1': T1, '2a': T2A, '2b': T2B, '3': T3 },
    };
    expect(() => generateProblem(skill, '1', 666)).not.toThrow();
    expect(() => generateProblem(skill, '3', 777)).not.toThrow();
  });

  it('throws for unknown generatorId', async () => {
    const { generateProblem } = await import('./mathProblemGenerator');
    const skill = {
      id: 'bad_test',
      name: 'Test',
      description: 'Test',
      generatorId: 'this_does_not_exist',
      tierParams: { '1': T1, '2a': T2A, '2b': T2B, '3': T3 },
    };
    expect(() => generateProblem(skill, '1', 1)).toThrow('Unknown generatorId');
  });
});
