/**
 * Procedural pre-calculus problem generators.
 *
 * Five generator functions covering logarithm evaluation, exponent rules,
 * sequences (arithmetic/geometric), limit introduction (substitution and
 * algebraic simplification), and polynomial long division.
 *
 * All generators use the "construct backward" strategy — pick the answer first,
 * then build the problem — to guarantee clean integer answers.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem.
 *
 * Source files: src/services/math/preCalculusGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, formatPolynomial, dedupeDistractors } from './mathUtils';

// ── Logarithm ─────────────────────────────────────────────────────────────────

/**
 * Evaluate a logarithm: log_b(x) = n.
 *
 * Constructs backward: picks base b from {2, 3, 5, 10}, picks exponent n
 * from rangeB, then computes x = b^n. The player must find n.
 *
 * Question: "Evaluate: log_{b}(x)"
 * Answer: string representation of n.
 *
 * @param params - rangeB: exponent range [min, max] (n will be picked from here)
 * @param rng - Seeded PRNG.
 * @returns MathProblem with integer answer n.
 */
export function generateLogarithm(params: GeneratorParams, rng: () => number): MathProblem {
  const bases = [2, 3, 5, 10];
  const b = randPick(rng, bases);
  const n = randInt(rng, Math.max(params.rangeB[0], 1), Math.min(params.rangeB[1], 6));
  const x = Math.pow(b, n);

  const question = `Evaluate: log_{${b}}(${x})`;
  const correctAnswer = String(n);

  const explanation = `log_{${b}}(${x}) = ${n} because ${b}^${n} = ${x}`;

  // Distractors: common mistakes — off by 1/2, using base or argument directly
  const candidates: string[] = [
    String(n + 1),
    String(n - 1),
    String(n + 2),
    String(n - 2),
    String(b),       // confused base with answer
    String(x),       // confused argument with answer
    String(n * 2),
    String(Math.max(1, n - 3)),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Exponent Rules ────────────────────────────────────────────────────────────

/**
 * Apply exponent rules to simplify an expression.
 *
 * Operations (controlled by params.operations or defaulting by steps):
 *   - 'multiply': b^m × b^n = b^(m+n) — answer is m+n
 *   - 'divide':   b^m / b^n = b^(m-n) — answer is m-n (may be negative)
 *   - 'power':    (b^m)^n   = b^(m*n) — answer is m*n
 *   - 'mixed':    b^m × b^n / b^p = b^(m+n-p) — answer is m+n-p
 *
 * Steps maps to operation variety:
 *   steps=1: multiply only
 *   steps=2: multiply or divide
 *   steps=3: multiply, divide, or power
 *   steps=4: all including mixed
 *
 * Answer is the resulting exponent as a string.
 *
 * @param params - rangeA: exponent range for individual exponents, steps: operation complexity.
 * @param rng - Seeded PRNG.
 * @returns MathProblem asking for the simplified exponent.
 */
export function generateExponentRules(params: GeneratorParams, rng: () => number): MathProblem {
  const steps = params.steps ?? 1;

  // Choose the operation pool based on steps
  let opPool: string[];
  if (steps <= 1) {
    opPool = ['multiply'];
  } else if (steps <= 2) {
    opPool = ['multiply', 'divide'];
  } else if (steps <= 3) {
    opPool = ['multiply', 'divide', 'power'];
  } else {
    opPool = ['multiply', 'divide', 'power', 'mixed'];
  }

  // If operations param is explicitly set, use it instead
  const operation = params.operations
    ? randPick(rng, params.operations)
    : randPick(rng, opPool);

  // Pick a small positive base — not the interesting part, just needs to be clear
  const bases = [2, 3, 4, 5];
  const b = randPick(rng, bases);

  const expMin = Math.max(params.rangeA[0], 1);
  const expMax = Math.min(params.rangeA[1], 8);

  let question: string;
  let correctExponent: number;
  let explanation: string;

  if (operation === 'multiply') {
    const m = randInt(rng, expMin, expMax);
    const n = randInt(rng, expMin, expMax);
    correctExponent = m + n;
    question = `Simplify: ${b}^${m} × ${b}^${n} = ${b}^?`;
    explanation = `Product rule: b^m × b^n = b^(m+n) → ${b}^${m} × ${b}^${n} = ${b}^(${m}+${n}) = ${b}^${correctExponent}`;
  } else if (operation === 'divide') {
    // Construct backward: pick m > n so exponent m-n >= 1
    const n = randInt(rng, expMin, Math.max(expMin, expMax - 1));
    const extra = randInt(rng, 1, Math.min(3, expMax - n));
    const m = n + extra;
    correctExponent = m - n;
    question = `Simplify: ${b}^${m} / ${b}^${n} = ${b}^?`;
    explanation = `Quotient rule: b^m / b^n = b^(m-n) → ${b}^${m} / ${b}^${n} = ${b}^(${m}-${n}) = ${b}^${correctExponent}`;
  } else if (operation === 'power') {
    const m = randInt(rng, expMin, Math.min(expMax, 4));
    const n = randInt(rng, 2, Math.min(4, expMax));
    correctExponent = m * n;
    question = `Simplify: (${b}^${m})^${n} = ${b}^?`;
    explanation = `Power rule: (b^m)^n = b^(m×n) → (${b}^${m})^${n} = ${b}^(${m}×${n}) = ${b}^${correctExponent}`;
  } else {
    // mixed: b^m × b^n / b^p
    const m = randInt(rng, expMin, expMax);
    const n = randInt(rng, expMin, expMax);
    // Pick p so that m+n-p >= 1
    const mnSum = m + n;
    const p = randInt(rng, 1, Math.max(1, Math.min(mnSum - 1, expMax)));
    correctExponent = mnSum - p;
    question = `Simplify: ${b}^${m} × ${b}^${n} / ${b}^${p} = ${b}^?`;
    explanation = `Combine rules: b^m × b^n / b^p = b^(m+n-p) → ${b}^(${m}+${n}-${p}) = ${b}^${correctExponent}`;
  }

  const correctAnswer = String(correctExponent);

  // Distractors: plausible exponent errors
  const candidates: string[] = [
    String(correctExponent + 1),
    String(correctExponent - 1),
    String(correctExponent + 2),
    String(correctExponent - 2),
    String(correctExponent * 2),
    String(Math.max(1, correctExponent - 3)),
    String(correctExponent + 3),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Sequences ─────────────────────────────────────────────────────────────────

/**
 * Sequence problems — arithmetic and geometric.
 *
 * Steps control the sub-type:
 *   steps=1: arithmetic nth term → a1 + (n-1)*d
 *   steps=2: geometric nth term → a1 * r^(n-1)
 *   steps=3: arithmetic series sum → (n/2)*(2*a1 + (n-1)*d)
 *   steps=4: geometric series sum → a1*(r^n - 1)/(r - 1)
 *
 * All answers are integers. Construct backward where needed (arithmetic sum
 * picks a1, d, n such that sum is an integer; geometric picks small r).
 *
 * @param params - rangeA: first term / common difference range, rangeB: [n_min, n_max], steps: sub-type.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with integer answer.
 */
export function generateSequence(params: GeneratorParams, rng: () => number): MathProblem {
  const steps = params.steps ?? 1;

  if (steps <= 1) {
    return generateArithmeticNthTerm(params, rng);
  } else if (steps <= 2) {
    return generateGeometricNthTerm(params, rng);
  } else if (steps <= 3) {
    return generateArithmeticSum(params, rng);
  } else {
    return generateGeometricSum(params, rng);
  }
}

/** Arithmetic nth term: find a_n = a1 + (n-1)*d */
function generateArithmeticNthTerm(params: GeneratorParams, rng: () => number): MathProblem {
  const a1 = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const d = randInt(rng, 1, Math.max(1, params.rangeA[1]));
  const n = randInt(rng, Math.max(params.rangeB[0], 2), params.rangeB[1]);

  const answer = a1 + (n - 1) * d;
  const correctAnswer = String(answer);

  // Show the first few terms
  const term2 = a1 + d;
  const term3 = a1 + 2 * d;
  const question = `Find the ${n}th term of the arithmetic sequence: ${a1}, ${term2}, ${term3}, ...`;
  const explanation = `a_n = a₁ + (n-1)d = ${a1} + (${n}-1)×${d} = ${a1} + ${(n - 1) * d} = ${answer}`;

  const candidates: string[] = [
    String(answer + d),
    String(answer - d),
    String(answer + 1),
    String(answer - 1),
    String(a1 + n * d),     // off-by-one: used n instead of n-1
    String(answer + 2),
    String(answer - 2),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/** Geometric nth term: find a_n = a1 * r^(n-1) */
function generateGeometricNthTerm(params: GeneratorParams, rng: () => number): MathProblem {
  // Small r to keep answers manageable
  const a1 = randInt(rng, 1, Math.min(params.rangeA[1], 4));
  const r = randInt(rng, 2, 3); // r = 2 or 3 to keep numbers clean
  const n = randInt(rng, 2, Math.min(params.rangeB[1], 6));

  const answer = a1 * Math.pow(r, n - 1);
  const correctAnswer = String(answer);

  const term2 = a1 * r;
  const term3 = a1 * r * r;
  const question = `Find the ${n}th term of the geometric sequence: ${a1}, ${term2}, ${term3}, ...`;
  const explanation = `a_n = a₁ × r^(n-1) = ${a1} × ${r}^(${n}-1) = ${a1} × ${r}^${n - 1} = ${answer}`;

  const candidates: string[] = [
    String(a1 * Math.pow(r, n)),    // off-by-one: used r^n instead of r^(n-1)
    String(a1 * Math.pow(r, n - 2) || 1), // off-by-one other direction
    String(answer + a1),
    String(answer - a1),
    String(a1 + (n - 1) * r),      // used arithmetic formula instead
    String(answer * r),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/** Arithmetic series sum: S_n = (n/2)*(2*a1 + (n-1)*d) */
function generateArithmeticSum(params: GeneratorParams, rng: () => number): MathProblem {
  // Pick even n so n/2 is integer, ensuring clean integer sum
  const nBase = randInt(rng, 1, Math.floor(params.rangeB[1] / 2));
  const n = nBase * 2; // always even
  const a1 = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const d = randInt(rng, 1, Math.max(1, params.rangeA[1]));

  const sum = (n / 2) * (2 * a1 + (n - 1) * d);
  const correctAnswer = String(sum);

  const term2 = a1 + d;
  const term3 = a1 + 2 * d;
  const question = `Find the sum of the first ${n} terms of: ${a1}, ${term2}, ${term3}, ...`;
  const explanation = `S_n = (n/2)(2a₁ + (n-1)d) = (${n}/2)(2×${a1} + (${n}-1)×${d}) = ${n / 2} × ${2 * a1 + (n - 1) * d} = ${sum}`;

  const candidates: string[] = [
    String(sum + d * n),
    String(sum - d),
    String(n * a1),            // forgot the progression
    String(sum + a1),
    String(sum - a1),
    String(sum * 2),
    String(Math.max(0, sum - d * n)),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/** Geometric series sum: S_n = a1*(r^n - 1)/(r-1) */
function generateGeometricSum(params: GeneratorParams, rng: () => number): MathProblem {
  // Keep small so answers fit cleanly: a1=1, r=2, n up to 6
  const a1 = 1;
  const r = 2;
  const n = randInt(rng, Math.max(params.rangeB[0], 3), Math.min(params.rangeB[1], 6));

  const sum = a1 * (Math.pow(r, n) - 1) / (r - 1);
  const correctAnswer = String(sum);

  const term2 = a1 * r;
  const term3 = a1 * r * r;
  const question = `Find the sum of the first ${n} terms of: ${a1}, ${term2}, ${term3}, ...`;
  const explanation = `S_n = a₁(r^n - 1)/(r-1) = ${a1}(${r}^${n} - 1)/(${r}-1) = (${Math.pow(r, n)} - 1)/1 = ${sum}`;

  const candidates: string[] = [
    String(sum + 1),
    String(sum - 1),
    String(Math.pow(r, n)),       // forgot a1 and the -1
    String(Math.pow(r, n) - 1),   // forgot the a1/(r-1) part
    String(sum * 2),
    String(sum + r),
    String(n * r),                // simple linear mistake
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Limit Introduction ────────────────────────────────────────────────────────

/**
 * Introductory limit evaluation — four sub-types by steps:
 *
 *   steps=1: linear substitution — lim_{x→a} (mx + b) = ma + b
 *   steps=2: quadratic substitution — lim_{x→a} (ax² + bx + c)
 *   steps=3: difference-of-squares — lim_{x→a} (x²-a²)/(x-a) = 2a
 *   steps=4: cubic factoring or conjugate — lim_{x→a} (x³-a³)/(x-a) = 3a²
 *
 * All answers are integers (using construct-backward where needed).
 *
 * @param params - rangeA: coefficient range, rangeB: limit point range, steps: complexity.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with integer answer.
 */
export function generateLimitIntro(params: GeneratorParams, rng: () => number): MathProblem {
  const steps = params.steps ?? 1;

  if (steps <= 1) {
    return generateLimitLinear(params, rng);
  } else if (steps <= 2) {
    return generateLimitQuadratic(params, rng);
  } else if (steps <= 3) {
    return generateLimitDifferenceSquares(params, rng);
  } else {
    return generateLimitCubicFactor(params, rng);
  }
}

/** Linear substitution limit */
function generateLimitLinear(params: GeneratorParams, rng: () => number): MathProblem {
  const a = randInt(rng, params.rangeB[0], params.rangeB[1]); // limit point
  const m = randInt(rng, 1, params.rangeA[1]);
  const b = randInt(rng, params.rangeA[0], params.rangeA[1]);

  const answer = m * a + b;
  const correctAnswer = String(answer);

  const bStr = b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`;
  const fStr = m === 1 ? `x${bStr}` : `${m}x${bStr}`;
  const question = `lim_{x→${a}} (${fStr})`;
  const explanation = `Direct substitution: plug in x = ${a} → ${m}(${a})${bStr} = ${answer}`;

  const candidates: string[] = [
    String(answer + 1),
    String(answer - 1),
    String(answer + m),
    String(answer - m),
    String(m * a),       // forgot the constant
    String(answer + 2),
    String(answer - 2),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/** Quadratic substitution limit */
function generateLimitQuadratic(params: GeneratorParams, rng: () => number): MathProblem {
  const a = randInt(rng, Math.max(params.rangeB[0], -3), Math.min(params.rangeB[1], 3));
  const coefA = randInt(rng, 1, Math.min(params.rangeA[1], 3));
  const coefB = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const coefC = randInt(rng, params.rangeA[0], params.rangeA[1]);

  const answer = coefA * a * a + coefB * a + coefC;
  const correctAnswer = String(answer);

  const polyCoeffs = [coefC, coefB, coefA];
  const fStr = formatPolynomial(polyCoeffs);
  const question = `lim_{x→${a}} (${fStr})`;
  const explanation = `Direct substitution: plug in x = ${a} → ${coefA}(${a})² + ${coefB}(${a}) + ${coefC} = ${coefA * a * a} + ${coefB * a} + ${coefC} = ${answer}`;

  const candidates: string[] = [
    String(answer + 1),
    String(answer - 1),
    String(answer + 2),
    String(answer - 2),
    String(coefA * a * a + coefC), // forgot middle term
    String(coefA * a + coefB * a + coefC), // linear mistake: used a instead of a²
    String(answer + coefA),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/** Difference-of-squares limit: lim_{x→a} (x²-a²)/(x-a) = x+a → 2a */
function generateLimitDifferenceSquares(params: GeneratorParams, rng: () => number): MathProblem {
  // a must be nonzero so the limit point isn't 0 (trivial)
  let a = randInt(rng, params.rangeB[0], params.rangeB[1]);
  if (a === 0) a = 1;
  const aSquared = a * a;

  const answer = 2 * a; // lim_{x→a} (x+a) = 2a
  const correctAnswer = String(answer);

  // Numerator: x² - a²
  const numStr = aSquared === 1 ? 'x^2 - 1' : `x^2 - ${aSquared}`;
  // Denominator: x - a
  const denStr = a === 1 ? 'x - 1' : a > 0 ? `x - ${a}` : `x + ${Math.abs(a)}`;

  const question = `lim_{x→${a}} [(${numStr}) / (${denStr})]`;
  const explanation = `Factor: (x²-${aSquared})/(x-${a}) = (x-${a})(x+${a})/(x-${a}) → cancel (x-${a}) → lim_{x→${a}} (x+${a}) = ${a}+${a} = ${answer}`;

  const candidates: string[] = [
    String(answer + 1),
    String(answer - 1),
    String(a),            // forgot to add both — returned just a
    String(0),            // thought it was indeterminate (0/0)
    String(answer * 2),
    String(aSquared),     // used a² instead
    String(answer - 2),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/** Cubic factoring limit: lim_{x→a} (x³-a³)/(x-a) = 3a² */
function generateLimitCubicFactor(params: GeneratorParams, rng: () => number): MathProblem {
  // Keep a small so a³ is manageable
  let a = randInt(rng, 1, Math.min(Math.abs(params.rangeB[1]), 3));
  if (rng() < 0.4) a = -a; // allow negative sometimes
  const aCubed = a * a * a;
  const aSquared = a * a;

  const answer = 3 * aSquared; // lim_{x→a} (x²+ax+a²) = 3a²
  const correctAnswer = String(answer);

  const numStr = aCubed >= 0 ? `x^3 - ${aCubed}` : `x^3 + ${Math.abs(aCubed)}`;
  const denStr = a > 0 ? `x - ${a}` : `x + ${Math.abs(a)}`;

  const question = `lim_{x→${a}} [(${numStr}) / (${denStr})]`;
  const explanation = `Factor: x³-${aCubed} = (x-${a})(x²+${a}x+${aSquared}). Cancel (x-${a}) → lim_{x→${a}} (x²+${a}x+${aSquared}) = ${aSquared}+${aSquared}+${aSquared} = ${answer}`;

  const candidates: string[] = [
    String(answer + 1),
    String(answer - 1),
    String(aSquared),         // forgot the factor of 3
    String(2 * aSquared),     // off by one factor
    String(answer + aSquared),
    String(0),                // thought indeterminate
    String(answer - aSquared),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Polynomial Division ───────────────────────────────────────────────────────

/**
 * Polynomial long division / synthetic division.
 *
 * Constructs backward: pick quotient Q(x) and root r, compute
 * P(x) = Q(x) × (x - r) + R where R is the remainder.
 *
 *   steps=1: linear quotient (Q = ax + b), no remainder
 *   steps=2: linear quotient, with remainder
 *   steps=3: quadratic quotient (Q = ax² + bx + c), no remainder
 *   steps=4: quadratic quotient, with remainder
 *
 * Question asks for the quotient Q(x). Answer uses formatPolynomial.
 *
 * @param params - rangeA: coefficient range, rangeB: root range, steps: quotient complexity.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with polynomial quotient answer.
 */
export function generatePolynomialDivision(params: GeneratorParams, rng: () => number): MathProblem {
  const steps = params.steps ?? 1;
  const hasRemainder = steps === 2 || steps === 4;
  const isQuadratic = steps >= 3;

  // Pick root r
  let r = randInt(rng, params.rangeB[0], params.rangeB[1]);
  if (r === 0) r = 1; // avoid trivial root = 0

  let quotientCoeffs: number[];
  if (isQuadratic) {
    // Q(x) = ax² + bx + c
    let a = randInt(rng, 1, params.rangeA[1]);
    if (a === 0) a = 1;
    const b = randInt(rng, params.rangeA[0], params.rangeA[1]);
    const c = randInt(rng, params.rangeA[0], params.rangeA[1]);
    quotientCoeffs = [c, b, a]; // indexed by power: [constant, x, x²]
  } else {
    // Q(x) = ax + b
    let a = randInt(rng, 1, params.rangeA[1]);
    if (a === 0) a = 1;
    const b = randInt(rng, params.rangeA[0], params.rangeA[1]);
    quotientCoeffs = [b, a]; // [constant, x]
  }

  // Remainder R
  const remainder = hasRemainder ? randInt(rng, 1, Math.max(1, params.rangeA[1])) : 0;

  // Compute P(x) = Q(x) * (x - r) + R
  // Multiply Q(x) by (x - r): convolve coefficients with [−r, 1]
  const divisorCoeffs = [-r, 1]; // represents (x - r)
  const productLen = quotientCoeffs.length + 1;
  const productCoeffs: number[] = new Array(productLen).fill(0);
  for (let qi = 0; qi < quotientCoeffs.length; qi++) {
    for (let di = 0; di < divisorCoeffs.length; di++) {
      productCoeffs[qi + di] += quotientCoeffs[qi] * divisorCoeffs[di];
    }
  }
  // Add remainder to constant term
  productCoeffs[0] += remainder;

  const dividend = formatPolynomial(productCoeffs);
  const divisor = r > 0 ? `x - ${r}` : `x + ${Math.abs(r)}`;
  const quotientStr = formatPolynomial(quotientCoeffs);

  let question: string;
  let correctAnswer: string;
  let explanation: string;

  if (hasRemainder) {
    question = `Divide: (${dividend}) ÷ (${divisor}). Find the quotient.`;
    correctAnswer = quotientStr;
    explanation = `(${dividend}) = (${divisor})(${quotientStr}) + ${remainder}. Quotient is ${quotientStr}.`;
  } else {
    question = `Divide: (${dividend}) ÷ (${divisor})`;
    correctAnswer = quotientStr;
    explanation = `(${dividend}) = (${divisor})(${quotientStr}). Answer: ${quotientStr}.`;
  }

  // Build distractor quotients: vary individual coefficients
  const candidates: string[] = [];

  // Off-by-one on leading coefficient
  const altLeading = [...quotientCoeffs];
  altLeading[altLeading.length - 1] = altLeading[altLeading.length - 1] + 1;
  candidates.push(formatPolynomial(altLeading));

  const altLeading2 = [...quotientCoeffs];
  altLeading2[altLeading2.length - 1] = Math.max(1, altLeading2[altLeading2.length - 1] - 1);
  candidates.push(formatPolynomial(altLeading2));

  // Off-by-one on constant term
  const altConst = [...quotientCoeffs];
  altConst[0] = altConst[0] + 1;
  candidates.push(formatPolynomial(altConst));

  const altConst2 = [...quotientCoeffs];
  altConst2[0] = altConst2[0] - 1;
  candidates.push(formatPolynomial(altConst2));

  // Sign flip on constant term
  const altSign = [...quotientCoeffs];
  altSign[0] = -altSign[0];
  candidates.push(formatPolynomial(altSign));

  // If quadratic, also vary the middle coefficient
  if (isQuadratic && quotientCoeffs.length >= 3) {
    const altMid = [...quotientCoeffs];
    altMid[1] = altMid[1] + 1;
    candidates.push(formatPolynomial(altMid));
  }

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}
