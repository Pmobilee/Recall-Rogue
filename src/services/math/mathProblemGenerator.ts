/**
 * Main dispatcher for procedural math problem generation.
 *
 * Each generator function corresponds to a `generatorId` on a SkillNode and
 * produces a self-contained MathProblem. All randomness is seeded so the same
 * (skill, tier, seed) triple always produces the same problem — enabling
 * deterministic replay and unit testing.
 *
 * Source files: src/services/math/mathProblemGenerator.ts
 * Related docs: docs/content/deck-system.md, docs/mechanics/quiz.md
 */

import type { CardTier } from '../../data/card-types';
import type { GeneratorParams, MathProblem, SkillNode } from '../../data/proceduralDeckTypes';
import { generateMathDistractors } from './mathDistractorGenerator';
import { mulberry32, randInt, randPick, gcd } from './mathUtils';
import {
  generateLinearEquation,
  generateQuadraticEquation,
  generateExpressionSimplify,
  generateInequality,
  generateLinearSystem,
} from './algebraGenerators';
import {
  generateArea,
  generatePerimeter,
  generateVolume,
  generateAngleRelationship,
  generatePythagorean,
} from './geometryGenerators';
import {
  generateCentralTendency,
  generateStandardDeviation,
  generateBasicProbability,
  generateCombinationsPermutations,
  generateExpectedValue,
} from './statisticsGenerators';
import {
  generateTrigStandardAngle,
  generateTrigInverse,
  generateTrigRightTriangle,
  generateTrigUnitCircle,
  generateTrigIdentity,
} from './trigGenerators';

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Generates a single MathProblem for the given skill node and FSRS card tier.
 *
 * The `seed` parameter makes generation deterministic: the same
 * (skill, tier, seed) triple always produces the same problem. Callers should
 * derive seeds from a combination of turn counter and fact ID hash so problems
 * vary naturally across encounters.
 *
 * @param skill - The SkillNode that describes the generator and tier params.
 * @param tier  - The FSRS card tier controlling difficulty envelope.
 * @param seed  - Integer seed for the seeded PRNG.
 * @returns A fully populated MathProblem ready for the quiz engine.
 * @throws Error if `skill.generatorId` is unrecognised.
 */
export function generateProblem(
  skill: SkillNode,
  tier: CardTier,
  seed: number,
): MathProblem {
  const params = skill.tierParams[tier];
  const rng = mulberry32(seed);

  switch (skill.generatorId) {
    case 'arithmetic':          return generateArithmetic(params, rng);
    case 'mixed_arithmetic':    return generateMixedArithmetic(params, rng);
    case 'percentage':          return generatePercentage(params, rng);
    case 'fraction_decimal':    return generateFractionDecimal(params, rng);
    case 'estimation':          return generateEstimation(params, rng);
    case 'order_of_operations': return generateOrderOfOperations(params, rng);
    case 'linear_equation':     return generateLinearEquation(params, rng);
    case 'quadratic_equation':  return generateQuadraticEquation(params, rng);
    case 'expression_simplify': return generateExpressionSimplify(params, rng);
    case 'inequality':          return generateInequality(params, rng);
    case 'linear_system':       return generateLinearSystem(params, rng);
    case 'area':                return generateArea(params, rng);
    case 'perimeter':           return generatePerimeter(params, rng);
    case 'volume':              return generateVolume(params, rng);
    case 'angle_relationship':  return generateAngleRelationship(params, rng);
    case 'pythagorean':         return generatePythagorean(params, rng);
    case 'central_tendency':        return generateCentralTendency(params, rng);
    case 'standard_deviation':      return generateStandardDeviation(params, rng);
    case 'basic_probability':       return generateBasicProbability(params, rng);
    case 'combinations_permutations': return generateCombinationsPermutations(params, rng);
    case 'expected_value':          return generateExpectedValue(params, rng);
    case 'trig_standard_angle': return generateTrigStandardAngle(params, rng);
    case 'trig_inverse':        return generateTrigInverse(params, rng);
    case 'trig_right_triangle': return generateTrigRightTriangle(params, rng);
    case 'trig_unit_circle':    return generateTrigUnitCircle(params, rng);
    case 'trig_identity':       return generateTrigIdentity(params, rng);
    default:
      throw new Error(`Unknown generatorId: "${skill.generatorId}"`);
  }
}

// ── Generators ────────────────────────────────────────────────────────────────

/**
 * Single-operation arithmetic: `a OP b = ?`
 *
 * For division the answer is always a positive integer — `a` is constructed
 * as `b × quotient` so there is never a remainder.
 */
function generateArithmetic(params: GeneratorParams, rng: () => number): MathProblem {
  const ops = params.operations ?? ['+'];
  const op = randPick(rng, ops);

  let a: number;
  let b: number;
  let answer: number;

  if (op === '/') {
    // Generate b first, then derive a = b × quotient so division is exact.
    b = randInt(rng, Math.max(params.rangeB[0], 1), params.rangeB[1]);
    const quotient = randInt(rng, params.rangeA[0], params.rangeA[1]);
    a = b * quotient;
    answer = quotient;
  } else {
    a = randInt(rng, params.rangeA[0], params.rangeA[1]);
    b = randInt(rng, params.rangeB[0], params.rangeB[1]);
    switch (op) {
      case '+': answer = a + b; break;
      case '-': answer = a - b; break;
      case '*': answer = a * b; break;
      default:  answer = a + b;
    }
  }

  if (!params.allowNegatives && answer < 0) {
    // Swap operands so result is positive for subtraction
    [a, b] = [b, a];
    answer = Math.abs(answer);
  }

  answer = Math.floor(answer);

  const distractors = generateMathDistractors(answer, op, [a, b], 4);
  return {
    question: `${a} ${op} ${b} = ?`,
    correctAnswer: String(answer),
    acceptableAlternatives: [],
    distractors,
    explanation: `${a} ${op} ${b} = ${answer}`,
    inputMode: 'choice',
  };
}

/**
 * Multi-step left-to-right arithmetic: `a OP1 b OP2 c = ?`
 *
 * Evaluated strictly left-to-right (no order-of-operations) — PEMDAS is
 * handled by the dedicated `order_of_operations` generator.
 */
function generateMixedArithmetic(params: GeneratorParams, rng: () => number): MathProblem {
  const ops = params.operations ?? ['+', '-'];
  const steps = params.steps ?? 2;

  const operands: number[] = [randInt(rng, params.rangeA[0], params.rangeA[1])];
  const usedOps: string[] = [];

  for (let i = 0; i < steps; i++) {
    operands.push(randInt(rng, params.rangeB[0], params.rangeB[1]));
    usedOps.push(randPick(rng, ops));
  }

  // Evaluate left-to-right
  let running = operands[0];
  for (let i = 0; i < usedOps.length; i++) {
    const b = operands[i + 1];
    switch (usedOps[i]) {
      case '+': running += b; break;
      case '-': running -= b; break;
      case '*': running *= b; break;
      case '/': running = b !== 0 ? Math.floor(running / b) : running; break;
    }
  }
  const answer = Math.floor(running);

  const questionParts: string[] = [String(operands[0])];
  for (let i = 0; i < usedOps.length; i++) {
    questionParts.push(usedOps[i], String(operands[i + 1]));
  }
  const questionExpr = questionParts.join(' ');

  const distractors = generateMathDistractors(answer, usedOps[0], operands, 4);
  return {
    question: `${questionExpr} = ?`,
    correctAnswer: String(answer),
    acceptableAlternatives: [],
    distractors,
    explanation: `${questionExpr} = ${answer} (evaluated left-to-right)`,
    inputMode: 'choice',
  };
}

/**
 * Percentage: "What is X% of Y?"
 *
 * Operand selection ensures the result is a whole number by picking a
 * percentage that is a factor of the base (Y) times 100.  Falls back to
 * rounding when no clean factor is found within the range.
 */
function generatePercentage(params: GeneratorParams, rng: () => number): MathProblem {
  const base = randInt(rng, params.rangeB[0], params.rangeB[1]);

  // Try to find a percentage in rangeA that divides evenly into base
  let pct = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const pctMin = params.rangeA[0];
  const pctMax = params.rangeA[1];

  // Attempt up to 20 tries to find a clean divisor
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = pctMin + Math.floor(rng() * (pctMax - pctMin + 1));
    if ((base * candidate) % 100 === 0) { pct = candidate; break; }
  }

  const answer = Math.floor((base * pct) / 100);

  const distractors = generateMathDistractors(answer, '*', [pct, base], 4);
  return {
    question: `What is ${pct}% of ${base}?`,
    correctAnswer: String(answer),
    acceptableAlternatives: [],
    distractors,
    explanation: `${pct}% of ${base} = (${pct} ÷ 100) × ${base} = ${answer}`,
    inputMode: 'choice',
  };
}

/**
 * Fraction ↔ Decimal conversion.
 *
 * rangeA = numerator range, rangeB = denominator range.
 * Fractions are always reduced to simplest form. Direction (fraction→decimal
 * or decimal→fraction) alternates based on the seed.
 */
function generateFractionDecimal(params: GeneratorParams, rng: () => number): MathProblem {
  const numerator   = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const denominator = Math.max(randInt(rng, params.rangeB[0], params.rangeB[1]), 2);

  const g = gcd(numerator, denominator);
  const num = numerator / g;
  const den = denominator / g;

  const decimal = parseFloat((num / den).toFixed(4));
  const fractionStr = `${num}/${den}`;
  const decimalStr = parseFloat(decimal.toFixed(4)).toString();

  // Alternate direction: if rng() < 0.5 → fraction to decimal, else reverse
  const toDecimal = rng() < 0.5;

  if (toDecimal) {
    const distractors = generateMathDistractors(decimal, '/', [num, den], 4);
    return {
      question: `Convert ${fractionStr} to a decimal`,
      correctAnswer: decimalStr,
      acceptableAlternatives: [],
      distractors,
      explanation: `${fractionStr} = ${num} ÷ ${den} = ${decimalStr}`,
      inputMode: 'choice',
    };
  } else {
    // Decimal to fraction: correct answer is the fraction string
    const distractors = buildFractionDistractors(num, den, rng);
    return {
      question: `Convert ${decimalStr} to a fraction (in simplest form)`,
      correctAnswer: fractionStr,
      acceptableAlternatives: [],
      distractors,
      explanation: `${decimalStr} = ${fractionStr}`,
      inputMode: 'choice',
    };
  }
}

/**
 * Generate plausible wrong-fraction distractors (varied numerator/denominator).
 * Kept in this file as it is specific to the fraction_decimal generator.
 */
function buildFractionDistractors(num: number, den: number, rng: () => number): string[] {
  const seen = new Set<string>([`${num}/${den}`]);
  const result: string[] = [];

  const tryAdd = (n: number, d: number) => {
    if (d <= 0 || n <= 0) return;
    const g = gcd(n, d);
    const s = `${n / g}/${d / g}`;
    if (!seen.has(s)) { seen.add(s); result.push(s); }
  };

  // Vary numerator ± 1 with same denominator
  tryAdd(num + 1, den);
  tryAdd(num - 1 > 0 ? num - 1 : num + 2, den);
  // Vary denominator ± 1
  tryAdd(num, den + 1);
  tryAdd(num, den > 1 ? den - 1 : den + 2);
  // Unsimplified form (if simplifiable)
  if (num * 2 !== den && den * 2 !== num) tryAdd(num * 2, den * 2);

  // Fallback: random nearby fractions
  while (result.length < 4) {
    const n = num + randInt(rng, 1, 3);
    const d = den + randInt(rng, 1, 3);
    tryAdd(n, d);
    if (result.length >= 8) break; // safety valve
  }

  return result.slice(0, 4);
}

/**
 * Estimation: approximate the square root of a number to the nearest whole number.
 *
 * rangeA drives the input number range. tolerance is honoured by
 * acceptableAlternatives (±1 of correct).
 */
function generateEstimation(params: GeneratorParams, rng: () => number): MathProblem {
  const n = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const sqrtExact = Math.sqrt(n);
  const answer = Math.round(sqrtExact);
  const tolerance = params.tolerance ?? 1;

  // Build acceptableAlternatives within tolerance
  const alternatives: string[] = [];
  for (let delta = 1; delta <= tolerance; delta++) {
    if (answer + delta !== answer) alternatives.push(String(answer + delta));
    if (answer - delta >= 0 && answer - delta !== answer) alternatives.push(String(answer - delta));
  }

  const distractors = generateMathDistractors(answer, '+', [n, 0], 4);
  return {
    question: `Estimate √${n} (to nearest whole number)`,
    correctAnswer: String(answer),
    acceptableAlternatives: alternatives,
    distractors,
    explanation: `√${n} ≈ ${sqrtExact.toFixed(2)}, nearest whole number is ${answer}`,
    inputMode: 'choice',
  };
}

/**
 * Order-of-operations (PEMDAS): expressions requiring correct precedence.
 *
 * Tier 1/2a: two-operation expression `a + b × c` or `a × b + c`
 * Tier 2b/3: expression with parentheses `(a + b) × c` or `a × (b + c)`
 *
 * The "trap" answer (applying left-to-right without PEMDAS) is always
 * included as one of the distractors.
 */
function generateOrderOfOperations(params: GeneratorParams, rng: () => number): MathProblem {
  const a = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const b = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const c = randInt(rng, params.rangeB[0], params.rangeB[1]);

  // Decide whether to use parentheses (higher-tier variation controlled by caller seed)
  const useParens = rng() < 0.5;

  let question: string;
  let answer: number;
  let trapAnswer: number; // left-to-right wrong answer

  if (useParens) {
    // (a + b) × c  — parens override default precedence
    question = `(${a} + ${b}) × ${c} = ?`;
    answer = (a + b) * c;
    trapAnswer = a + b * c; // what PEMDAS would give without parens
  } else {
    // a + b × c  — multiplication precedes addition
    question = `${a} + ${b} × ${c} = ?`;
    answer = a + b * c;      // PEMDAS correct
    trapAnswer = (a + b) * c; // left-to-right wrong
  }

  answer = Math.floor(answer);
  trapAnswer = Math.floor(trapAnswer);

  // Build distractors, ensuring the trap answer is included
  let distractors = generateMathDistractors(answer, '+', [a, b, c], 4);
  const trapStr = String(trapAnswer);
  if (!distractors.includes(trapStr) && trapStr !== String(answer)) {
    // Replace last distractor with the trap answer so it's always present
    distractors[distractors.length - 1] = trapStr;
  }
  // Deduplicate after potential injection
  distractors = [...new Set(distractors)].filter(d => d !== String(answer));
  // Ensure we still have 4 — pad with offsets if trap caused a collision
  if (distractors.length < 4) {
    const extra = generateMathDistractors(answer, '*', [a, b, c], 4 - distractors.length + 2);
    for (const d of extra) {
      if (!distractors.includes(d) && d !== String(answer)) distractors.push(d);
      if (distractors.length >= 4) break;
    }
  }
  distractors = distractors.slice(0, 4);

  return {
    question,
    correctAnswer: String(answer),
    acceptableAlternatives: [],
    distractors,
    explanation: useParens
      ? `(${a} + ${b}) × ${c} — parentheses are evaluated first: ${a + b} × ${c} = ${answer}`
      : `${a} + ${b} × ${c} — multiplication before addition: ${a} + ${b * c} = ${answer}`,
    inputMode: 'choice',
  };
}
