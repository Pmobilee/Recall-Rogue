/**
 * Algorithmic distractor generation for procedural math problems.
 *
 * Distractors are computed from the operands and correct answer using
 * operation-specific error models (carry errors, sign errors, wrong-op, etc.)
 * so they are plausible but always mathematically wrong.
 *
 * Source files: src/services/math/mathDistractorGenerator.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import { TRIG_TABLE, formatPolynomial, dedupeDistractors } from './mathUtils';

/** Swap two adjacent digits within an integer, returning all unique variants. */
function digitSwapVariants(n: number): number[] {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return [];
  const abs = Math.abs(n);
  const digits = String(abs).split('');
  const results = new Set<number>();
  for (let i = 0; i < digits.length - 1; i++) {
    const copy = [...digits];
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
    const v = Number(copy.join('')) * (n < 0 ? -1 : 1);
    if (v !== n) results.add(v);
  }
  return Array.from(results);
}

/**
 * Simulate column addition WITHOUT carrying (per-column sum mod 10).
 * Used to model the carry-error distractor for addition.
 */
function addWithoutCarry(a: number, b: number): number {
  const sa = String(Math.abs(Math.floor(a))).split('').reverse();
  const sb = String(Math.abs(Math.floor(b))).split('').reverse();
  const len = Math.max(sa.length, sb.length);
  const digits: string[] = [];
  for (let i = 0; i < len; i++) {
    const da = parseInt(sa[i] ?? '0', 10);
    const db = parseInt(sb[i] ?? '0', 10);
    digits.push(String((da + db) % 10));
  }
  return parseInt(digits.reverse().join(''), 10);
}

/**
 * Generates plausible-but-wrong numeric distractors for a math problem.
 *
 * Strategies selected depend on the operation:
 *  - Off-by-one / off-by-ten
 *  - Wrong operation (apply a different op to the same operands)
 *  - Digit swap (swap adjacent digits of the answer)
 *  - Carry error (for '+': sum without carrying)
 *  - Sign error (for '-': negate the answer)
 *  - Near magnitude (answer × 10 or / 10)
 *
 * @param correctAnswer - The correct numeric answer.
 * @param operation - One of '+', '-', '*', '/'.
 * @param operands - The operands used to produce the answer ([a, b] or more for multi-step).
 * @param count - Exact number of distractors to return.
 * @returns An array of exactly `count` unique wrong-answer strings.
 */
export function generateMathDistractors(
  correctAnswer: number,
  operation: string,
  operands: number[],
  count: number,
): string[] {
  const candidates = new Set<number>();
  const a = operands[0] ?? 0;
  const b = operands[1] ?? 0;

  const add = (v: number) => {
    if (!Number.isFinite(v) || v === correctAnswer || Math.abs(v) > 1e12) return;
    candidates.add(Math.round(v * 1000) / 1000); // round to 3dp to avoid float dust
  };

  // ── Off-by-one and off-by-ten ─────────────────────────────────────────────
  add(correctAnswer + 1);
  add(correctAnswer - 1);
  add(correctAnswer + 10);
  add(correctAnswer - 10);

  // ── Wrong operation ───────────────────────────────────────────────────────
  const ops = ['+', '-', '*', '/'];
  for (const op of ops) {
    if (op === operation) continue;
    let wrongResult: number;
    switch (op) {
      case '+': wrongResult = a + b; break;
      case '-': wrongResult = a - b; break;
      case '*': wrongResult = a * b; break;
      case '/': wrongResult = b !== 0 ? a / b : NaN; break;
      default:  continue;
    }
    if (Number.isFinite(wrongResult)) add(Math.floor(wrongResult));
  }

  // ── Digit swap ────────────────────────────────────────────────────────────
  for (const v of digitSwapVariants(Math.floor(correctAnswer))) {
    add(v);
  }

  // ── Carry error (addition only) ────────────────────────────────────────────
  if (operation === '+') {
    const noCarry = addWithoutCarry(a, b);
    add(noCarry);
  }

  // ── Sign error (subtraction only) ─────────────────────────────────────────
  if (operation === '-') {
    add(-correctAnswer);
    add(b - a); // reversed subtraction
  }

  // ── Near magnitude ─────────────────────────────────────────────────────────
  if (correctAnswer !== 0) {
    add(correctAnswer * 10);
    const tenth = correctAnswer / 10;
    if (Number.isInteger(tenth)) add(tenth);
  }

  // Convert to string array, excluding correct answer and duplicates
  const correctStr = formatAnswerNumeric(correctAnswer);
  let result: string[] = Array.from(candidates)
    .filter(v => v !== correctAnswer)
    .map(v => formatAnswerNumeric(v))
    .filter((s, i, arr) => arr.indexOf(s) === i && s !== correctStr);

  // ── Fallback: small random offsets around the answer ─────────────────────
  if (result.length < count) {
    let offset = 2;
    while (result.length < count + 10 && offset < 1000) {
      const hi = correctAnswer + offset;
      const lo = correctAnswer - offset;
      const hiStr = formatAnswerNumeric(hi);
      const loStr = formatAnswerNumeric(lo);
      if (hiStr !== correctStr && !result.includes(hiStr)) result.push(hiStr);
      if (result.length < count + 10 && loStr !== correctStr && !result.includes(loStr)) result.push(loStr);
      offset += offset < 10 ? 1 : offset < 100 ? 5 : 50;
    }
  }

  return result.slice(0, count);
}

/**
 * Format a number as a distractor string.
 * Integers are returned without decimal point.
 * Decimals are trimmed to at most 4 significant decimal places.
 */
function formatAnswerNumeric(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  // Trim float noise: at most 4 decimal places, trailing zeros removed
  return parseFloat(n.toFixed(4)).toString();
}

// ── Domain-specific distractor builders ──────────────────────────────────────

/**
 * Algebra distractors for equation solutions.
 *
 * Strategies: sign flip, off-by-one, swapped variables (for systems).
 * Format: "x = 3" for single root, "x = 2, x = -5" for quadratic (sorted),
 * or "x = 3, y = -1" for two-variable systems.
 *
 * @param roots - Correct root values, e.g. [3] or [2, -5].
 * @param rng - Seeded PRNG for tiebreaking when multiple strategies tie.
 * @returns Exactly 4 unique distractor strings, none equal to the correct answer.
 */
export function buildAlgebraDistractors(roots: number[], rng: () => number): string[] {
  // Format helper for a single set of root values
  const formatRoots = (vals: number[]): string => {
    if (vals.length === 1) return `x = ${vals[0]}`;
    // Two roots: format as sorted pair
    const sorted = [...vals].sort((a, b) => a - b);
    return sorted.map((v, i) => (i === 0 ? `x = ${v}` : `x = ${v}`)).join(', ');
  };

  const correctStr = formatRoots(roots);
  const candidates: string[] = [];

  if (roots.length === 1) {
    const r = roots[0];
    // Sign flip
    candidates.push(`x = ${-r}`);
    // Off-by-one variants
    candidates.push(`x = ${r + 1}`);
    candidates.push(`x = ${r - 1}`);
    // Off-by-two
    candidates.push(`x = ${r + 2}`);
    candidates.push(`x = ${r - 2}`);
    // Double
    candidates.push(`x = ${r * 2}`);
  } else if (roots.length === 2) {
    const [r1, r2] = roots;
    // Sign flip both
    candidates.push(formatRoots([-r1, -r2]));
    // Swap (same values — appears to be x and y confusion for systems)
    candidates.push(`x = ${r2}, x = ${r1}`);
    // Off-by-one on each root independently
    candidates.push(formatRoots([r1 + 1, r2]));
    candidates.push(formatRoots([r1, r2 + 1]));
    candidates.push(formatRoots([r1 - 1, r2]));
    candidates.push(formatRoots([r1, r2 - 1]));
    // Sign flip one
    candidates.push(formatRoots([-r1, r2]));
    candidates.push(formatRoots([r1, -r2]));
    // Both off-by-one
    candidates.push(formatRoots([r1 + 1, r2 + 1]));
  }

  // Fallback with RNG-offset values if we still need more
  if (candidates.length < 4) {
    const base = roots[0];
    for (let delta = 3; delta <= 20 && candidates.length < 8; delta++) {
      candidates.push(`x = ${base + delta}`);
      candidates.push(`x = ${base - delta}`);
    }
  }

  return dedupeDistractors(candidates, correctStr, 4);
}

/**
 * Algebra expression distractors for simplification problems.
 *
 * Strategies: wrong coefficient sums (±1, ±2), sign errors on terms,
 * and dropped terms (coefficient set to 0).
 *
 * @param correctExpr - Canonical simplified expression string.
 * @param coeffs - Correct coefficient array [constant, x-coeff, x²-coeff, ...].
 * @param rng - Seeded PRNG (used for choosing which coefficient to vary when strategies tie).
 * @returns Exactly 4 unique distractor strings.
 */
export function buildExpressionDistractors(
  correctExpr: string,
  coeffs: number[],
  rng: () => number,
): string[] {
  const candidates: string[] = [];

  // Strategy: vary each coefficient by ±1 and ±2
  for (let idx = 0; idx < coeffs.length; idx++) {
    for (const delta of [-2, -1, 1, 2]) {
      const variant = [...coeffs];
      variant[idx] = coeffs[idx] + delta;
      const expr = formatPolynomial(variant);
      if (expr !== correctExpr) candidates.push(expr);
    }
  }

  // Strategy: flip sign on each individual term
  for (let idx = 0; idx < coeffs.length; idx++) {
    if (coeffs[idx] !== 0) {
      const variant = [...coeffs];
      variant[idx] = -coeffs[idx];
      const expr = formatPolynomial(variant);
      if (expr !== correctExpr) candidates.push(expr);
    }
  }

  // Strategy: drop a non-zero term (set to 0) — models "forgot to combine" error
  for (let idx = 0; idx < coeffs.length; idx++) {
    if (coeffs[idx] !== 0) {
      const variant = [...coeffs];
      variant[idx] = 0;
      const expr = formatPolynomial(variant);
      if (expr !== correctExpr) candidates.push(expr);
    }
  }

  // Use rng to shuffle so different seeds prioritise different distractor types
  const shuffled = candidates.sort(() => rng() - 0.5);

  return dedupeDistractors(shuffled, correctExpr, 4);
}

/**
 * Geometry distractors using formula confusion.
 *
 * Strategies:
 *  - Pi-based: extract numeric coefficient N, offer 2N*pi, N/2*pi, N (forgot pi), (N+dim)*pi.
 *  - Integer: formula confusion (e.g. area vs perimeter), dimension off-by-one.
 *
 * @param answer - Correct answer string (may contain "*pi", e.g. "12*pi").
 * @param shape - Shape type (e.g. 'rectangle', 'circle', 'triangle').
 * @param dimensions - Numeric dimensions used in the formula (e.g. [length, width]).
 * @param formulaType - 'area' | 'perimeter' | 'volume'.
 * @param rng - Seeded PRNG for ordering.
 * @returns Exactly 4 unique distractor strings.
 */
export function buildGeometryDistractors(
  answer: string,
  shape: string,
  dimensions: number[],
  formulaType: string,
  rng: () => number,
): string[] {
  const candidates: string[] = [];
  const hasPi = answer.includes('*pi') || answer.includes('pi');

  if (hasPi) {
    // Extract the numeric coefficient from strings like "12*pi" or "pi"
    const piMatch = answer.match(/^(-?[\d.]+)\*pi$/);
    const N = piMatch ? parseFloat(piMatch[1]) : 1;

    // Wrong coefficient variants
    candidates.push(`${N * 2}*pi`);
    if (N / 2 > 0) candidates.push(`${N / 2}*pi`);
    // Forgot to multiply by pi — just the numeric coefficient
    candidates.push(String(N));
    // Added a dimension instead of multiplied
    if (dimensions.length > 0) {
      candidates.push(`${N + dimensions[0]}*pi`);
    }
    // Common confusion: using diameter when radius expected (×2 or ÷2)
    candidates.push(`${N * 4}*pi`);
    candidates.push(`${N / 4}*pi`);
    // Wrong formula: added pi instead of multiplied
    candidates.push(`${N} + pi`);
  } else {
    const correctNum = parseFloat(answer);
    const isInt = Number.isInteger(correctNum);

    if (Number.isFinite(correctNum)) {
      // Off-by-one on each dimension
      for (const dim of dimensions) {
        const offDim = correctNum + dim;
        const offStr = isInt ? String(Math.floor(offDim)) : offDim.toFixed(2);
        candidates.push(offStr);

        const halved = correctNum / 2;
        const halvedStr = isInt && Number.isInteger(halved) ? String(halved) : halved.toFixed(2);
        candidates.push(halvedStr);

        const doubled = correctNum * 2;
        const doubledStr = isInt && Number.isInteger(doubled) ? String(doubled) : doubled.toFixed(2);
        candidates.push(doubledStr);
      }

      // Formula confusion: area vs perimeter (sum dimensions vs product)
      if (formulaType === 'area' && dimensions.length >= 2) {
        // Offer perimeter-style: 2*(d1+d2)
        candidates.push(String(2 * (dimensions[0] + dimensions[1])));
      } else if (formulaType === 'perimeter' && dimensions.length >= 2) {
        // Offer area-style: d1*d2
        candidates.push(String(dimensions[0] * dimensions[1]));
      }

      // Off-by-one on numeric answer
      candidates.push(String(Math.floor(correctNum) + 1));
      candidates.push(String(Math.floor(correctNum) - 1));
    }
  }

  // Shuffle using rng for variety across seeds
  const shuffled = candidates.sort(() => rng() - 0.5);

  return dedupeDistractors(shuffled, answer, 4);
}

/** All common exact trig values used as distractor pool. */
const COMMON_TRIG_VALUES = [
  '0', '1', '-1',
  '1/2', '-1/2',
  'sqrt(2)/2', '-sqrt(2)/2',
  'sqrt(3)/2', '-sqrt(3)/2',
  'sqrt(3)', '-sqrt(3)',
  'sqrt(3)/3', '-sqrt(3)/3',
  'undefined',
];

/**
 * Trig distractors from the standard value lookup table.
 *
 * Strategies:
 *  - Wrong function: sin/cos/tan values at the same angle
 *  - Wrong quadrant sign: flip sign of correct value
 *  - Complement angle: value at (90 - angle)
 *  - Common value pool: other frequently confused exact values
 *
 * @param correctValue - The correct trig value string (e.g. 'sqrt(3)/2').
 * @param angle - The angle in degrees (must be a key in TRIG_TABLE).
 * @param func - 'sin' | 'cos' | 'tan'.
 * @param rng - Seeded PRNG for ordering the common-value pool.
 * @returns Exactly 4 unique distractor strings.
 */
export function buildTrigDistractors(
  correctValue: string,
  angle: number,
  func: string,
  rng: () => number,
): string[] {
  const candidates: string[] = [];
  const tableEntry = TRIG_TABLE[angle];

  if (tableEntry) {
    // Wrong function at same angle
    if (func !== 'sin') candidates.push(tableEntry.sin);
    if (func !== 'cos') candidates.push(tableEntry.cos);
    if (func !== 'tan') candidates.push(tableEntry.tan);
  }

  // Complement angle confusion: sin(θ) = cos(90-θ) is a common student error
  const complement = 90 - angle;
  const complementEntry = TRIG_TABLE[complement];
  if (complementEntry) {
    if (func === 'sin') candidates.push(complementEntry.cos); // wrong: used sin of complement instead
    if (func === 'cos') candidates.push(complementEntry.sin);
    if (func === 'tan') candidates.push(complementEntry.tan);
  }

  // Sign flip of correct value — quadrant sign error
  if (correctValue.startsWith('-')) {
    candidates.push(correctValue.slice(1)); // remove leading minus
  } else if (correctValue !== '0' && correctValue !== 'undefined') {
    candidates.push(`-${correctValue}`);
  }

  // Supplement angle: sin(180-θ)=sin(θ), so cos/tan at supplementary angle is a distractor
  const supplement = 180 - angle;
  const supplementEntry = TRIG_TABLE[supplement];
  if (supplementEntry && supplement !== angle) {
    if (func === 'cos') candidates.push(supplementEntry.cos);
    if (func === 'tan') candidates.push(supplementEntry.tan);
  }

  // Fill from common values pool (shuffled by rng for variety)
  const shuffledPool = [...COMMON_TRIG_VALUES].sort(() => rng() - 0.5);
  candidates.push(...shuffledPool);

  return dedupeDistractors(candidates, correctValue, 4);
}

/**
 * Statistics distractors for central tendency and probability problems.
 *
 * Uses a pre-computed `alternates` dict to pull wrong-measure values, then
 * falls back to numeric offsets when the dict is exhausted.
 *
 * Strategies:
 *  - Wrong measure: pull from alternates (e.g. mean when median is correct)
 *  - Std dev vs variance: include variance when std dev is asked
 *  - Probability complement: include 1-p
 *  - C vs P confusion: include permutation when combination asked (and vice versa)
 *  - Numeric off-by-one as last resort
 *
 * @param answer - Correct answer string.
 * @param measure - What was asked: 'mean'|'median'|'mode'|'stddev'|'probability'|'combination'|'permutation'|'expected_value'.
 * @param alternates - Pre-computed wrong-measure values, e.g. {mean: '7', median: '6', mode: '5'}.
 * @param rng - Seeded PRNG for ordering.
 * @returns Exactly 4 unique distractor strings.
 */
export function buildStatisticsDistractors(
  answer: string,
  measure: string,
  alternates: Record<string, string>,
  rng: () => number,
): string[] {
  const candidates: string[] = [];

  // Wrong measure: pull all alternate values that aren't the correct answer
  for (const [key, val] of Object.entries(alternates)) {
    if (key !== measure && val !== answer && val !== '') {
      candidates.push(val);
    }
  }

  // Domain-specific confusion pairs
  const answerNum = parseFloat(answer);

  if (measure === 'stddev') {
    // Common error: report variance instead of std dev (forgot to take sqrt)
    if (Number.isFinite(answerNum)) {
      const variance = answerNum * answerNum;
      candidates.push(Number.isInteger(variance) ? String(variance) : variance.toFixed(4));
    }
    // Also: alternate mean/median if available
    if (alternates.mean) candidates.push(alternates.mean);
    if (alternates.median) candidates.push(alternates.median);
  }

  if (measure === 'probability') {
    // Complement: 1 - p
    if (Number.isFinite(answerNum)) {
      const complement = 1 - answerNum;
      if (complement >= 0 && complement <= 1) {
        candidates.push(complement.toFixed(4).replace(/\.?0+$/, '') || '0');
      }
    }
    // Percent form confusion
    if (Number.isFinite(answerNum) && answerNum <= 1) {
      candidates.push(String(Math.round(answerNum * 100))); // forgot to divide by 100
    }
  }

  if (measure === 'combination' && alternates.permutation) {
    // C vs P confusion: nCr vs nPr
    candidates.push(alternates.permutation);
  }

  if (measure === 'permutation' && alternates.combination) {
    candidates.push(alternates.combination);
  }

  if (measure === 'expected_value') {
    // Common error: summing outcomes without weighting by probability
    if (alternates.sum) candidates.push(alternates.sum);
    if (alternates.mean) candidates.push(alternates.mean);
  }

  // Shuffle for variety then pad with numeric fallback via dedupeDistractors
  const shuffled = candidates.sort(() => rng() - 0.5);

  return dedupeDistractors(shuffled, answer, 4);
}
