/**
 * Procedural unit conversion problem generators for the Unit Conversion deck.
 *
 * Five generator functions cover: length, weight/mass, temperature, area/volume,
 * and speed conversions. Each tier escalates from same-system integer conversions
 * (T1) through cross-system conversions (T2a/T2b) to chained multi-step
 * conversions (T3). All randomness is seeded via the rng parameter so the same
 * (skill, tier, seed) triple always produces the same problem.
 *
 * Design principle: Input values are chosen from pre-validated lookup tables so
 * the output is always an integer or clean 1-decimal value — no guessing whether
 * the answer will be ugly.
 *
 * Source files: src/services/math/unitConversionGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randPick, dedupeDistractors } from './mathUtils';

// ── Internal formatting helpers ───────────────────────────────────────────────

/**
 * Format a numeric result to at most 1 decimal place, stripping trailing ".0".
 * E.g. 25.4 → "25.4", 100.0 → "100", 60.5 → "60.5"
 */
function fmt(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

/**
 * Build numeric distractors around a correct decimal/integer answer.
 * Generates ±10%, ±25%, double, half, and ±1/±2 offsets.
 */
function buildNumericDistractors(correct: string, count: number): string[] {
  const n = Number(correct);
  const candidates: string[] = [];

  if (!Number.isFinite(n)) return [];

  // Off-by scale (common unit confusion mistakes)
  candidates.push(fmt(n * 10));
  candidates.push(fmt(n / 10));
  candidates.push(fmt(n * 2));
  candidates.push(fmt(n / 2));

  // Off-by nearby amounts
  candidates.push(fmt(n + 1));
  candidates.push(fmt(n - 1));
  candidates.push(fmt(n + 2));
  candidates.push(fmt(n - 2));
  candidates.push(fmt(n + 5));
  candidates.push(fmt(n + 0.5));
  candidates.push(fmt(n - 0.5));

  // Rounding in wrong direction
  if (n % 1 !== 0) {
    candidates.push(String(Math.floor(n)));
    candidates.push(String(Math.ceil(n)));
  }

  return dedupeDistractors(candidates, correct, count);
}

// ── Generator 1: Length Conversion ───────────────────────────────────────────

/**
 * Lookup table for same-system length conversion pairs.
 * All produce exact integer results.
 */
interface LengthPair {
  fromUnit: string;
  toUnit: string;
  values: number[];      // valid input values
  factor: number;        // toUnit = fromUnit × factor (or ÷ factor if inverse)
  direction: 'mul' | 'div';
  explanation: string;   // e.g. "1 m = 100 cm"
}

const LENGTH_T1_PAIRS: LengthPair[] = [
  { fromUnit: 'cm', toUnit: 'm', values: [100, 200, 300, 500, 1000, 150, 250, 750], factor: 100, direction: 'div', explanation: '1 m = 100 cm' },
  { fromUnit: 'm', toUnit: 'cm', values: [1, 2, 3, 5, 10, 15, 20, 50], factor: 100, direction: 'mul', explanation: '1 m = 100 cm' },
  { fromUnit: 'mm', toUnit: 'cm', values: [10, 20, 30, 50, 100, 150, 200], factor: 10, direction: 'div', explanation: '1 cm = 10 mm' },
  { fromUnit: 'cm', toUnit: 'mm', values: [1, 2, 3, 5, 10, 15, 20], factor: 10, direction: 'mul', explanation: '1 cm = 10 mm' },
  { fromUnit: 'km', toUnit: 'm', values: [1, 2, 3, 5, 10], factor: 1000, direction: 'mul', explanation: '1 km = 1000 m' },
  { fromUnit: 'm', toUnit: 'km', values: [1000, 2000, 3000, 5000, 10000], factor: 1000, direction: 'div', explanation: '1 km = 1000 m' },
  { fromUnit: 'inches', toUnit: 'feet', values: [12, 24, 36, 48, 60, 72, 84, 96], factor: 12, direction: 'div', explanation: '1 foot = 12 inches' },
  { fromUnit: 'feet', toUnit: 'inches', values: [1, 2, 3, 4, 5, 6, 7, 8, 10], factor: 12, direction: 'mul', explanation: '1 foot = 12 inches' },
];

// Cross-system pairs: values chosen so result is integer or 1-decimal
const LENGTH_T2A_PAIRS: LengthPair[] = [
  // 10 inches = 25.4 cm (1 decimal); 20 in = 50.8 cm
  { fromUnit: 'inches', toUnit: 'cm', values: [1, 2, 4, 5, 10, 20, 50, 100], factor: 2.54, direction: 'mul', explanation: '1 inch = 2.54 cm' },
  // Reverse: multiples of 2.54
  { fromUnit: 'cm', toUnit: 'inches', values: [2.54, 5.08, 7.62, 10.16, 12.7, 25.4, 50.8, 254], factor: 2.54, direction: 'div', explanation: '1 inch = 2.54 cm' },
  // Miles to km: pick miles from small set, round to 1 decimal
  { fromUnit: 'miles', toUnit: 'km', values: [1, 2, 5, 10], factor: 1.609, direction: 'mul', explanation: '1 mile ≈ 1.609 km' },
];

const LENGTH_T2B_PAIRS: LengthPair[] = [
  // km to miles: pick km values that give clean results
  { fromUnit: 'km', toUnit: 'miles', values: [1.609, 3.218, 8.045, 16.09], factor: 1.609, direction: 'div', explanation: '1 mile ≈ 1.609 km' },
  // feet to meters: 10 ft = 3.048 m → 3.0; 100 ft = 30.5 m
  { fromUnit: 'feet', toUnit: 'meters', values: [1, 2, 3, 5, 10, 20, 50, 100], factor: 0.3048, direction: 'mul', explanation: '1 foot ≈ 0.305 m' },
];

const LENGTH_T3_CHAINS: Array<{
  label: string;
  compute: (v: number) => number;
  explanation: (v: number, result: number) => string;
  values: number[];
  fromUnit: string;
  toUnit: string;
}> = [
  {
    label: 'chain: inches → cm → m',
    fromUnit: 'inches', toUnit: 'm',
    values: [100, 200, 500, 1000],
    compute: v => Math.round((v * 2.54 / 100) * 10) / 10,
    explanation: (v, r) => `${v} inches × 2.54 = ${fmt(v * 2.54)} cm ÷ 100 = ${fmt(r)} m`,
  },
  {
    label: 'chain: miles → km → m',
    fromUnit: 'miles', toUnit: 'm',
    values: [1, 2, 5],
    compute: v => Math.round(v * 1.609 * 1000),
    explanation: (v, r) => `${v} miles × 1.609 = ${fmt(v * 1.609)} km × 1000 = ${r} m`,
  },
];

/**
 * Converts between length units across four difficulty tiers.
 *
 * T1: Same-system (integer results): cm↔m, mm↔cm, km↔m, inches↔feet.
 * T2a: Cross-system with clean values: inches↔cm, miles→km.
 * T2b: Less clean cross-system: km→miles (reciprocal of 1.609), feet→meters.
 * T3: Chained multi-step: inches→cm→m, miles→km→m.
 */
export function generateLengthConversion(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const tier = params.steps ?? 1;

  if (tier >= 4) {
    // T3: chain conversion
    const chain = randPick(rng, LENGTH_T3_CHAINS);
    const value = randPick(rng, chain.values);
    const result = chain.compute(value);
    const correct = fmt(result);
    const question = `Convert ${value} ${chain.fromUnit} to ${chain.toUnit}. (Multi-step conversion)`;
    const explanation = chain.explanation(value, result);
    return {
      question,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation,
      inputMode: 'choice',
    };
  }

  if (tier >= 3) {
    const pair = randPick(rng, LENGTH_T2B_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${value} ${pair.fromUnit} × conversion factor (${pair.explanation}) = ${correct} ${pair.toUnit}`,
      inputMode: 'choice',
    };
  }

  if (tier >= 2) {
    const pair = randPick(rng, LENGTH_T2A_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${value} ${pair.fromUnit} → ${correct} ${pair.toUnit}. ${pair.explanation}.`,
      inputMode: 'choice',
    };
  }

  // T1: same-system integer conversions
  const pair = randPick(rng, LENGTH_T1_PAIRS);
  const value = randPick(rng, pair.values);
  const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
  const correct = fmt(result);
  return {
    question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
    correctAnswer: correct,
    acceptableAlternatives: [],
    distractors: buildNumericDistractors(correct, 4),
    explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
    inputMode: 'choice',
  };
}

// ── Generator 2: Weight/Mass Conversion ──────────────────────────────────────

/** Weight conversion pair with clean-output input values. */
interface WeightPair {
  fromUnit: string;
  toUnit: string;
  values: number[];
  factor: number;
  direction: 'mul' | 'div';
  explanation: string;
}

const WEIGHT_T1_PAIRS: WeightPair[] = [
  { fromUnit: 'g', toUnit: 'kg', values: [1000, 2000, 3000, 4000, 5000, 10000, 20000, 50000], factor: 1000, direction: 'div', explanation: '1 kg = 1000 g' },
  { fromUnit: 'kg', toUnit: 'g', values: [1, 2, 3, 5, 10, 15, 20, 50], factor: 1000, direction: 'mul', explanation: '1 kg = 1000 g' },
  // oz to lbs: multiples of 16
  { fromUnit: 'oz', toUnit: 'lbs', values: [16, 32, 48, 64, 80, 96, 112, 128], factor: 16, direction: 'div', explanation: '1 lb = 16 oz' },
  { fromUnit: 'lbs', toUnit: 'oz', values: [1, 2, 3, 4, 5, 6, 8, 10], factor: 16, direction: 'mul', explanation: '1 lb = 16 oz' },
  { fromUnit: 'mg', toUnit: 'g', values: [1000, 2000, 5000, 3000, 4000, 10000], factor: 1000, direction: 'div', explanation: '1 g = 1000 mg' },
  { fromUnit: 'g', toUnit: 'mg', values: [1, 2, 5, 10, 0.5, 0.25], factor: 1000, direction: 'mul', explanation: '1 g = 1000 mg' },
];

const WEIGHT_T2A_PAIRS: WeightPair[] = [
  // lbs to kg: 1 lb ≈ 0.4536 kg. Pick lbs from set giving clean 1-decimal.
  // 1 lb = 0.5, 2 lb = 0.9, 5 lb = 2.3, 10 lb = 4.5, 20 lb = 9.1, 50 lb = 22.7
  { fromUnit: 'lbs', toUnit: 'kg', values: [1, 2, 5, 10, 20, 50, 100], factor: 0.4536, direction: 'mul', explanation: '1 lb ≈ 0.454 kg' },
];

const WEIGHT_T2B_PAIRS: WeightPair[] = [
  // kg to lbs: 1 kg = 2.205 lbs
  { fromUnit: 'kg', toUnit: 'lbs', values: [1, 2, 5, 10, 20, 50, 100], factor: 2.205, direction: 'mul', explanation: '1 kg ≈ 2.205 lbs' },
  // metric tonnes to kg
  { fromUnit: 'tonnes', toUnit: 'kg', values: [1, 2, 5, 10], factor: 1000, direction: 'mul', explanation: '1 tonne = 1000 kg' },
];

const WEIGHT_T3_CHAINS: Array<{
  fromUnit: string;
  toUnit: string;
  values: number[];
  compute: (v: number) => number;
  explanation: (v: number, r: number) => string;
}> = [
  {
    fromUnit: 'lbs', toUnit: 'g',
    values: [1, 2, 5, 10],
    compute: v => Math.round(v * 0.4536 * 1000),
    explanation: (v, r) => `${v} lbs × 0.4536 = ${fmt(v * 0.4536)} kg × 1000 = ${r} g`,
  },
  {
    fromUnit: 'tonnes', toUnit: 'g',
    values: [1, 2, 5],
    compute: v => v * 1000 * 1000,
    explanation: (v, r) => `${v} tonnes × 1000 = ${v * 1000} kg × 1000 = ${r} g`,
  },
];

/**
 * Converts between weight/mass units across four difficulty tiers.
 *
 * T1: Same-system (integer results): g↔kg, mg↔g, oz↔lbs.
 * T2a: Cross-system lbs→kg.
 * T2b: Cross-system kg→lbs, tonnes→kg.
 * T3: Chained: lbs→kg→g, tonnes→kg→g.
 */
export function generateWeightConversion(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const tier = params.steps ?? 1;

  if (tier >= 4) {
    const chain = randPick(rng, WEIGHT_T3_CHAINS);
    const value = randPick(rng, chain.values);
    const result = chain.compute(value);
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${chain.fromUnit} to ${chain.toUnit}. (Multi-step conversion)`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: chain.explanation(value, result),
      inputMode: 'choice',
    };
  }

  if (tier >= 3) {
    const pair = randPick(rng, WEIGHT_T2B_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${value} ${pair.fromUnit} × conversion factor (${pair.explanation}) = ${correct} ${pair.toUnit}`,
      inputMode: 'choice',
    };
  }

  if (tier >= 2) {
    const pair = randPick(rng, WEIGHT_T2A_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${value} ${pair.fromUnit} → ${correct} ${pair.toUnit}. ${pair.explanation}.`,
      inputMode: 'choice',
    };
  }

  const pair = randPick(rng, WEIGHT_T1_PAIRS);
  const value = randPick(rng, pair.values);
  const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
  const correct = fmt(result);
  return {
    question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
    correctAnswer: correct,
    acceptableAlternatives: [],
    distractors: buildNumericDistractors(correct, 4),
    explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
    inputMode: 'choice',
  };
}

// ── Generator 3: Temperature Conversion ──────────────────────────────────────

/**
 * Pre-validated F↔C pairs: F values that produce exact integer C values.
 * Formula: C = (F - 32) × 5/9. F must satisfy (F - 32) divisible by 9/5,
 * i.e. (F - 32) must be a multiple of 9/5. The clean integers are multiples
 * of 9 shifted by 32: 32, 41, 50, 59, 68, 77, 86, 95, 104, 113, 122, ...
 * We store the pairs directly.
 */
const TEMP_F_TO_C: Array<[number, number]> = [
  [32, 0], [41, 5], [50, 10], [59, 15], [68, 20],
  [77, 25], [86, 30], [95, 35], [104, 40], [113, 45],
  [122, 50], [131, 55], [140, 60], [149, 65], [158, 70],
  [167, 75], [176, 80], [185, 85], [194, 90], [203, 95],
  [212, 100],
];

/**
 * Converts between temperature units across four difficulty tiers.
 *
 * T1: F→C using lookup table (exact integer results).
 * T2a: C→F using reverse lookup (exact integer results).
 * T2b: C→K (add 273 — always integer).
 * T3: F→K chain (F→C→K, two-step).
 */
export function generateTemperatureConversion(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const tier = params.steps ?? 1;

  if (tier >= 4) {
    // T3: F → K via F → C → K
    const [fVal, cVal] = randPick(rng, TEMP_F_TO_C);
    const kVal = cVal + 273;
    const correct = String(kVal);
    const distractors = buildNumericDistractors(correct, 4);
    // Inject common mistake: forgot -32 step (wrong intermediate)
    const wrongNoSubtract = String(Math.round(fVal * 5 / 9 + 273));
    if (wrongNoSubtract !== correct) {
      distractors[0] = wrongNoSubtract;
    }
    return {
      question: `Convert ${fVal}°F to Kelvin (K).`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: dedupeDistractors(distractors, correct, 4),
      explanation: `${fVal}°F → C: (${fVal} − 32) × 5/9 = ${cVal}°C. Then C → K: ${cVal} + 273 = ${kVal} K.`,
      inputMode: 'choice',
    };
  }

  if (tier >= 3) {
    // T2b: C → K
    const [_fVal, cVal] = randPick(rng, TEMP_F_TO_C);
    const kVal = cVal + 273;
    const correct = String(kVal);
    const distractors: string[] = [
      String(cVal + 272),   // off-by-one on constant
      String(cVal + 274),
      String(cVal - 273),   // subtracted instead of added
      String(kVal + 10),
    ];
    return {
      question: `Convert ${cVal}°C to Kelvin (K).`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: dedupeDistractors(distractors, correct, 4),
      explanation: `K = °C + 273. So ${cVal} + 273 = ${kVal} K.`,
      inputMode: 'choice',
    };
  }

  if (tier >= 2) {
    // T2a: C → F (reverse lookup)
    const [fVal, cVal] = randPick(rng, TEMP_F_TO_C);
    const correct = String(fVal);
    // Common mistakes: forgot +32, used 9/5 wrong
    const wrongForgot32 = String(Math.round(cVal * 9 / 5));
    const wrongInverse = String(Math.round((cVal - 32) * 5 / 9));
    const distractors: string[] = [
      wrongForgot32,
      wrongInverse,
      String(fVal + 5),
      String(fVal - 5),
    ];
    return {
      question: `Convert ${cVal}°C to Fahrenheit (°F).`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: dedupeDistractors(distractors, correct, 4),
      explanation: `°F = (°C × 9/5) + 32. So (${cVal} × 9/5) + 32 = ${Math.round(cVal * 9 / 5)} + 32 = ${fVal}°F.`,
      inputMode: 'choice',
    };
  }

  // T1: F → C
  const [fVal, cVal] = randPick(rng, TEMP_F_TO_C);
  const correct = String(cVal);
  // Common mistake distractors: forgot to subtract 32, used 9/5 not 5/9
  const wrongForgot32 = String(Math.round(fVal * 5 / 9));
  const wrongInverted = String(Math.round((fVal - 32) * 9 / 5));
  const distractors: string[] = [
    wrongForgot32,
    wrongInverted,
    String(cVal + 5),
    String(cVal - 5),
  ];
  return {
    question: `Convert ${fVal}°F to Celsius (°C).`,
    correctAnswer: correct,
    acceptableAlternatives: [],
    distractors: dedupeDistractors(distractors, correct, 4),
    explanation: `°C = (°F − 32) × 5/9. So (${fVal} − 32) × 5/9 = ${fVal - 32} × 5/9 = ${cVal}°C.`,
    inputMode: 'choice',
  };
}

// ── Generator 4: Area & Volume Conversion ────────────────────────────────────

interface AreaVolumePair {
  fromUnit: string;
  toUnit: string;
  values: number[];
  factor: number;
  direction: 'mul' | 'div';
  explanation: string;
  type: 'area' | 'volume';
}

const AREA_VOLUME_T1_PAIRS: AreaVolumePair[] = [
  // Area: same-system integer conversions
  { fromUnit: 'cm²', toUnit: 'm²', values: [10000, 20000, 50000, 100000], factor: 10000, direction: 'div', explanation: '1 m² = 10,000 cm²', type: 'area' },
  { fromUnit: 'm²', toUnit: 'cm²', values: [1, 2, 5, 10], factor: 10000, direction: 'mul', explanation: '1 m² = 10,000 cm²', type: 'area' },
  // Volume: mL ↔ L
  { fromUnit: 'mL', toUnit: 'L', values: [1000, 2000, 3000, 4000, 5000], factor: 1000, direction: 'div', explanation: '1 L = 1000 mL', type: 'volume' },
  { fromUnit: 'L', toUnit: 'mL', values: [1, 2, 3, 5, 10], factor: 1000, direction: 'mul', explanation: '1 L = 1000 mL', type: 'volume' },
  // in² ↔ ft²
  { fromUnit: 'in²', toUnit: 'ft²', values: [144, 288, 432, 576, 720], factor: 144, direction: 'div', explanation: '1 ft² = 144 in²', type: 'area' },
  { fromUnit: 'ft²', toUnit: 'in²', values: [1, 2, 3, 4, 5, 10], factor: 144, direction: 'mul', explanation: '1 ft² = 144 in²', type: 'area' },
];

const AREA_VOLUME_T2A_PAIRS: AreaVolumePair[] = [
  // cm³ ↔ m³ (always integer)
  { fromUnit: 'cm³', toUnit: 'm³', values: [1000000, 2000000, 500000], factor: 1000000, direction: 'div', explanation: '1 m³ = 1,000,000 cm³', type: 'volume' },
  { fromUnit: 'm³', toUnit: 'cm³', values: [1, 2, 5], factor: 1000000, direction: 'mul', explanation: '1 m³ = 1,000,000 cm³', type: 'volume' },
  // ft² to m²: 1 ft² = 0.0929 m². Pick values giving 1-decimal result
  // 10 ft² = 0.9 m², 100 ft² = 9.3 m², 1000 ft² = 92.9 m²
  { fromUnit: 'ft²', toUnit: 'm²', values: [10, 100, 1000], factor: 0.0929, direction: 'mul', explanation: '1 ft² ≈ 0.093 m²', type: 'area' },
];

const AREA_VOLUME_T2B_PAIRS: AreaVolumePair[] = [
  // gallons to liters: 1 gallon ≈ 3.785 L. Pick gallons for 1-decimal L.
  { fromUnit: 'gallons', toUnit: 'liters', values: [1, 2, 5, 10, 20], factor: 3.785, direction: 'mul', explanation: '1 gallon ≈ 3.785 L', type: 'volume' },
  // m² to ft²: 1 m² ≈ 10.764 ft²
  { fromUnit: 'm²', toUnit: 'ft²', values: [1, 2, 5, 10, 20], factor: 10.764, direction: 'mul', explanation: '1 m² ≈ 10.764 ft²', type: 'area' },
];

const AREA_VOLUME_T3_CHAINS: Array<{
  fromUnit: string;
  toUnit: string;
  values: number[];
  compute: (v: number) => number;
  explanation: (v: number, r: number) => string;
}> = [
  // gallons to mL via liters
  {
    fromUnit: 'gallons', toUnit: 'mL',
    values: [1, 2, 5],
    compute: v => Math.round(v * 3.785 * 1000),
    explanation: (v, r) => `${v} gal × 3.785 = ${fmt(v * 3.785)} L × 1000 = ${r} mL`,
  },
  // m² to cm²
  {
    fromUnit: 'm²', toUnit: 'cm²',
    values: [1, 2, 5, 10],
    compute: v => v * 10000,
    explanation: (v, r) => `${v} m² × 10,000 = ${r} cm²`,
  },
];

/**
 * Converts between area and volume units across four difficulty tiers.
 *
 * T1: Same-system integer conversions: cm²↔m², in²↔ft², mL↔L.
 * T2a: cm³↔m³, ft²→m².
 * T2b: gallons↔liters, m²↔ft².
 * T3: Chained: gallons→liters→mL, m²→cm².
 */
export function generateAreaVolumeConversion(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const tier = params.steps ?? 1;

  if (tier >= 4) {
    const chain = randPick(rng, AREA_VOLUME_T3_CHAINS);
    const value = randPick(rng, chain.values);
    const result = chain.compute(value);
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${chain.fromUnit} to ${chain.toUnit}. (Multi-step)`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: chain.explanation(value, result),
      inputMode: 'choice',
    };
  }

  if (tier >= 3) {
    const pair = randPick(rng, AREA_VOLUME_T2B_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
      inputMode: 'choice',
    };
  }

  if (tier >= 2) {
    const pair = randPick(rng, AREA_VOLUME_T2A_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
      inputMode: 'choice',
    };
  }

  const pair = randPick(rng, AREA_VOLUME_T1_PAIRS);
  const value = randPick(rng, pair.values);
  const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
  const correct = fmt(result);
  return {
    question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
    correctAnswer: correct,
    acceptableAlternatives: [],
    distractors: buildNumericDistractors(correct, 4),
    explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
    inputMode: 'choice',
  };
}

// ── Generator 5: Speed Conversion ────────────────────────────────────────────

interface SpeedPair {
  fromUnit: string;
  toUnit: string;
  values: number[];
  factor: number;
  direction: 'mul' | 'div';
  explanation: string;
}

// m/s ↔ km/h: factor 3.6. m/s × 3.6 = km/h. Always clean if m/s is integer.
const SPEED_T1_PAIRS: SpeedPair[] = [
  { fromUnit: 'm/s', toUnit: 'km/h', values: [1, 2, 5, 10, 15, 20, 25, 30], factor: 3.6, direction: 'mul', explanation: '1 m/s = 3.6 km/h' },
  // km/h to m/s: multiples of 3.6 give clean integer m/s
  { fromUnit: 'km/h', toUnit: 'm/s', values: [3.6, 7.2, 18, 36, 54, 72, 90, 108], factor: 3.6, direction: 'div', explanation: '1 m/s = 3.6 km/h' },
];

const SPEED_T2A_PAIRS: SpeedPair[] = [
  // mph ↔ km/h: 1 mph = 1.609 km/h. Pick mph for 1-decimal km/h.
  { fromUnit: 'mph', toUnit: 'km/h', values: [10, 20, 30, 40, 50, 60, 70, 80, 100], factor: 1.609, direction: 'mul', explanation: '1 mph ≈ 1.609 km/h' },
];

const SPEED_T2B_PAIRS: SpeedPair[] = [
  // km/h to mph: 1 km/h ≈ 0.6214 mph
  { fromUnit: 'km/h', toUnit: 'mph', values: [10, 20, 30, 40, 50, 100], factor: 0.6214, direction: 'mul', explanation: '1 km/h ≈ 0.621 mph' },
  // m/s to mph: 1 m/s ≈ 2.237 mph
  { fromUnit: 'm/s', toUnit: 'mph', values: [1, 2, 5, 10, 20], factor: 2.237, direction: 'mul', explanation: '1 m/s ≈ 2.237 mph' },
];

const SPEED_T3_CHAINS: Array<{
  fromUnit: string;
  toUnit: string;
  values: number[];
  compute: (v: number) => number;
  explanation: (v: number, r: number) => string;
}> = [
  // m/s → mph via km/h
  {
    fromUnit: 'm/s', toUnit: 'mph',
    values: [1, 2, 5, 10],
    compute: v => Math.round(v * 3.6 * 0.6214 * 10) / 10,
    explanation: (v, r) => `${v} m/s × 3.6 = ${fmt(v * 3.6)} km/h × 0.6214 = ${r} mph`,
  },
  // knots to km/h: 1 knot = 1.852 km/h
  {
    fromUnit: 'knots', toUnit: 'km/h',
    values: [1, 2, 5, 10, 20],
    compute: v => Math.round(v * 1.852 * 10) / 10,
    explanation: (v, r) => `${v} knots × 1.852 = ${r} km/h`,
  },
];

/**
 * Converts between speed units across four difficulty tiers.
 *
 * T1: m/s ↔ km/h (factor 3.6, clean integer values).
 * T2a: mph → km/h.
 * T2b: km/h → mph, m/s → mph.
 * T3: m/s → mph (chain via km/h), knots → km/h.
 */
export function generateSpeedConversion(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const tier = params.steps ?? 1;

  if (tier >= 4) {
    const chain = randPick(rng, SPEED_T3_CHAINS);
    const value = randPick(rng, chain.values);
    const result = chain.compute(value);
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${chain.fromUnit} to ${chain.toUnit}. (Multi-step)`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: chain.explanation(value, result),
      inputMode: 'choice',
    };
  }

  if (tier >= 3) {
    const pair = randPick(rng, SPEED_T2B_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
      inputMode: 'choice',
    };
  }

  if (tier >= 2) {
    const pair = randPick(rng, SPEED_T2A_PAIRS);
    const value = randPick(rng, pair.values);
    const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
    const correct = fmt(result);
    return {
      question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
      correctAnswer: correct,
      acceptableAlternatives: [],
      distractors: buildNumericDistractors(correct, 4),
      explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
      inputMode: 'choice',
    };
  }

  const pair = randPick(rng, SPEED_T1_PAIRS);
  const value = randPick(rng, pair.values);
  const result = pair.direction === 'mul' ? value * pair.factor : value / pair.factor;
  const correct = fmt(result);
  return {
    question: `Convert ${value} ${pair.fromUnit} to ${pair.toUnit}.`,
    correctAnswer: correct,
    acceptableAlternatives: [],
    distractors: buildNumericDistractors(correct, 4),
    explanation: `${pair.explanation}. So ${value} ${pair.fromUnit} = ${correct} ${pair.toUnit}.`,
    inputMode: 'choice',
  };
}
