/**
 * Procedural algebra problem generators.
 *
 * Five generator functions covering linear equations, quadratic equations,
 * expression simplification, inequalities, and systems of equations.
 * All generators use the "construct backward" strategy — pick the answer first,
 * then build the problem — to guarantee clean integer solutions.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem.
 *
 * Source files: src/services/math/algebraGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, formatPolynomial, dedupeDistractors } from './mathUtils';
import { buildAlgebraDistractors, buildExpressionDistractors } from './mathDistractorGenerator';

// ── Coefficient formatting helpers ────────────────────────────────────────────

/**
 * Format a coefficient for use in an equation string.
 *
 * Returns '' for coefficient 1, '-' for -1, and the number otherwise.
 * Used so "1x" is displayed as "x" and "-1x" as "-x".
 */
function fmtCoeff(c: number): string {
  if (c === 1) return '';
  if (c === -1) return '-';
  return String(c);
}

/**
 * Format a term (coefficient × variable) that appears at the start of an expression.
 * Handles the special cases for ±1 coefficients.
 */
function fmtLeadTerm(coeff: number, varName: string): string {
  if (coeff === 1) return varName;
  if (coeff === -1) return `-${varName}`;
  return `${coeff}${varName}`;
}

/**
 * Format a constant term that follows another term, including its sign.
 * e.g. constant=3 → "+ 3", constant=-5 → "- 5", constant=0 → ""
 */
function fmtConstantTerm(c: number): string {
  if (c === 0) return '';
  if (c > 0) return ` + ${c}`;
  return ` - ${Math.abs(c)}`;
}

/**
 * Format a coefficient term that follows another term (not leading).
 * e.g. coeff=3, var='x' → "+ 3x", coeff=-1, var='x' → "- x"
 */
function fmtFollowTerm(coeff: number, varName: string): string {
  if (coeff === 0) return '';
  if (coeff === 1) return ` + ${varName}`;
  if (coeff === -1) return ` - ${varName}`;
  if (coeff > 0) return ` + ${coeff}${varName}`;
  return ` - ${Math.abs(coeff)}${varName}`;
}

// ── Generators ────────────────────────────────────────────────────────────────

/**
 * Linear equation: solve `ax + b = c` for x.
 *
 * Constructs backward: picks x (the answer), a, and b, then computes c.
 * Ensures a ≠ 0. When allowNegativeCoefficients is false, a is always positive.
 * maxCoefficient caps the magnitude of a independently of rangeA.
 *
 * @param params - GeneratorParams with rangeA (coefficient range), rangeB (answer range), maxCoefficient, allowNegativeCoefficients.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with question "Solve: ax + b = c", answer "x = {x}".
 */
export function generateLinearEquation(params: GeneratorParams, rng: () => number): MathProblem {
  const maxCoeff = params.maxCoefficient ?? params.rangeA[1];
  const aMin = params.allowNegativeCoefficients ? -maxCoeff : 1;
  const aMax = maxCoeff;

  // Pick a nonzero coefficient
  let a = randInt(rng, aMin, aMax);
  if (a === 0) a = 1;

  // Pick answer x from rangeB, pick constant b from rangeA
  const x = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const b = randInt(rng, params.rangeA[0], params.rangeA[1]);

  // Derive c = a*x + b
  const c = a * x + b;

  // Format: "ax + b = c"
  const lhsA = fmtLeadTerm(a, 'x');
  const lhsB = fmtConstantTerm(b);
  const question = `Solve: ${lhsA}${lhsB} = ${c}`;
  const correctAnswer = `x = ${x}`;

  // Explanation: show the two rearrangement steps
  const step1rhs = c - b;
  const explanation = `${lhsA}${lhsB} = ${c} → ${fmtLeadTerm(a, 'x')} = ${step1rhs} → x = ${x}`;

  const distractors = buildAlgebraDistractors([x], rng);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/**
 * Quadratic equation: solve `ax² + bx + c = 0`.
 *
 * Constructs backward: picks roots r1 and r2 (and leading coefficient a),
 * then expands a(x − r1)(x − r2) to get the equation coefficients.
 * This guarantees integer roots and a well-formed equation.
 *
 * When r1 === r2: answer is "x = {r1}" (repeated root).
 * When r1 ≠ r2: answer is "x = {min}, x = {max}" (sorted ascending).
 *
 * @param params - GeneratorParams with rangeA ([1, max] for leading coeff), rangeB (roots range).
 * @param rng - Seeded PRNG.
 * @returns MathProblem with quadratic equation and root answer.
 */
export function generateQuadraticEquation(params: GeneratorParams, rng: () => number): MathProblem {
  // Leading coefficient a is always positive for canonical form
  const a = randInt(rng, Math.max(params.rangeA[0], 1), params.rangeA[1]);

  // Pick two roots from rangeB
  const r1 = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const r2 = randInt(rng, params.rangeB[0], params.rangeB[1]);

  // Expand: a(x - r1)(x - r2) = ax² - a(r1+r2)x + a*r1*r2
  const bCoeff = -a * (r1 + r2);
  const cCoeff = a * r1 * r2;

  // Format the equation display
  const aTermStr = a === 1 ? 'x^2' : `${a}x^2`;
  const bTermStr = fmtFollowTerm(bCoeff, 'x');
  const cTermStr = fmtConstantTerm(cCoeff);
  const question = `Solve: ${aTermStr}${bTermStr}${cTermStr} = 0`;

  // Answer: sorted roots
  let correctAnswer: string;
  if (r1 === r2) {
    correctAnswer = `x = ${r1}`;
  } else {
    const sorted = [r1, r2].sort((p, q) => p - q);
    correctAnswer = `x = ${sorted[0]}, x = ${sorted[1]}`;
  }

  // Explanation
  const factorStr = a === 1
    ? `(x - ${r1})(x - ${r2}) = 0`
    : `${a}(x - ${r1})(x - ${r2}) = 0`;
  const explanation = r1 === r2
    ? `Factor: ${factorStr} → x = ${r1} (repeated root)`
    : `Factor: ${factorStr} → x = ${r1} or x = ${r2}`;

  const distractors = buildAlgebraDistractors([r1, r2], rng);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/**
 * Simplify algebraic expressions by combining like terms.
 *
 * Builds from a target simplified form (target coefficients), then decomposes
 * into unsimplified terms by splitting coefficients into parts.
 * Supports distribution form (`equationForm: 'distribute'`) at steps 3+.
 *
 * The `steps` param (2, 3, or 4) controls expression complexity:
 * - 2: `{a1}x + {a2}x + {c}` — combine x terms
 * - 3 (no distribute): `{a1}x + {c1} + {a2}x + {c2}` — combine like terms
 * - 3 (distribute): `{a}({b}x + {c}) + {d}x` — distribute then combine
 * - 4 (distribute): `{a}({b}x + {c}) + {d}({e}x + {f})` — full distribution
 *
 * @param params - GeneratorParams with rangeA (coefficient range), rangeB (constant range), steps, equationForm.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with "Simplify: {expr}" question.
 */
export function generateExpressionSimplify(params: GeneratorParams, rng: () => number): MathProblem {
  const steps = params.steps ?? 2;
  const useDistribute = params.equationForm === 'distribute';

  // Pick target coefficients: [constant, x-coeff]
  const targetX = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const targetC = randInt(rng, params.rangeB[0], params.rangeB[1]);

  let question: string;
  let explanation: string;
  const coeffs: number[] = [targetC, targetX]; // [constant, x]

  if (steps === 2) {
    // Split x coefficient into two parts: a1 + a2 = targetX
    const a1 = randInt(rng, 1, Math.max(1, targetX - 1));
    const a2 = targetX - a1;
    const cStr = fmtConstantTerm(targetC);
    question = `Simplify: ${a1}x + ${a2}x${cStr}`;
    explanation = `${a1}x + ${a2}x${cStr} = ${a1 + a2}x${cStr} = ${formatPolynomial(coeffs)}`;

  } else if (steps === 3 && !useDistribute) {
    // Split x coefficient and constant each into two parts
    const a1 = randInt(rng, 1, Math.max(1, targetX - 1));
    const a2 = targetX - a1;
    const c1 = randInt(rng, 1, Math.max(1, targetC));
    const c2 = targetC - c1;
    const c1Str = c1 > 0 ? ` + ${c1}` : ` - ${Math.abs(c1)}`;
    const c2Str = c2 >= 0 ? ` + ${c2}` : ` - ${Math.abs(c2)}`;
    question = `Simplify: ${a1}x${c1Str} + ${a2}x${c2Str}`;
    explanation = `${a1}x + ${a2}x = ${targetX}x, ${c1} + ${c2} = ${targetC} → ${formatPolynomial(coeffs)}`;

  } else if (steps === 3 && useDistribute) {
    // a(bx + c) + dx — distribute a then combine with dx
    // Target: a*b + d = targetX, a*c = targetC
    // Pick a, then derive b and d
    const a = randInt(rng, 2, Math.max(2, params.rangeA[1]));
    // Ensure a divides targetC cleanly — pick c first then compute
    const innerC = randInt(rng, 1, Math.max(1, params.rangeB[1]));
    const distribConst = a * innerC; // a*c
    const distribX = randInt(rng, 1, Math.max(1, params.rangeA[1])); // b
    const d = targetX - a * distribX; // d = targetX - a*b
    const actualTargetC = distribConst;
    const finalCoeffs = [actualTargetC, targetX];

    const innerBStr = `${distribX}x`;
    const innerCStr = fmtConstantTerm(innerC);
    const dStr = fmtFollowTerm(d, 'x');
    question = `Simplify: ${a}(${innerBStr}${innerCStr})${dStr}`;
    explanation = `${a}(${distribX}x + ${innerC})${dStr} = ${a * distribX}x + ${actualTargetC}${dStr} = ${formatPolynomial(finalCoeffs)}`;
    coeffs[0] = actualTargetC;
    coeffs[1] = targetX;

  } else {
    // steps === 4 with distribution: a(bx + c) + d(ex + f)
    // Target: a*b + d*e = targetX, a*c + d*f = targetC
    const a = randInt(rng, 2, Math.max(2, params.rangeA[1]));
    const d = randInt(rng, 2, Math.max(2, params.rangeA[1]));
    const b = randInt(rng, 1, Math.max(1, params.rangeA[1]));
    const e = randInt(rng, 1, Math.max(1, params.rangeA[1]));
    const c = randInt(rng, 1, Math.max(1, params.rangeB[1]));
    const f = randInt(rng, 1, Math.max(1, params.rangeB[1]));

    // Compute actual target from chosen values
    const actualX = a * b + d * e;
    const actualC = a * c + d * f;
    const finalCoeffs = [actualC, actualX];

    const innerAStr = `${fmtLeadTerm(b, 'x')}${fmtConstantTerm(c)}`;
    const innerDStr = `${fmtLeadTerm(e, 'x')}${fmtConstantTerm(f)}`;
    question = `Simplify: ${a}(${innerAStr}) + ${d}(${innerDStr})`;
    explanation = `${a}(${innerAStr}) + ${d}(${innerDStr}) = ${a * b}x + ${a * c} + ${d * e}x + ${d * f} = ${formatPolynomial(finalCoeffs)}`;
    coeffs[0] = actualC;
    coeffs[1] = actualX;
  }

  const correctAnswer = formatPolynomial(coeffs);
  const distractors = buildExpressionDistractors(correctAnswer, coeffs, rng);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

/**
 * Linear inequality: solve `ax + b > c` (or <, >=, <=).
 *
 * Constructs backward like `generateLinearEquation`. When `a` is negative,
 * the inequality direction flips on division — this is modeled correctly.
 * A "forgot to flip" distractor is always included.
 *
 * @param params - GeneratorParams with rangeA (coefficient), rangeB (boundary/answer), maxCoefficient, allowNegativeCoefficients.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with inequality solution as "x > {n}" style answer.
 */
export function generateInequality(params: GeneratorParams, rng: () => number): MathProblem {
  const maxCoeff = params.maxCoefficient ?? params.rangeA[1];
  const aMin = params.allowNegativeCoefficients ? -maxCoeff : 1;
  const aMax = maxCoeff;

  // Pick a nonzero coefficient
  let a = randInt(rng, aMin, aMax);
  if (a === 0) a = 1;

  const boundary = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const b = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const c = a * boundary + b;

  // Pick inequality operator
  const operators = ['>', '<', '>=', '<='];
  const op = randPick(rng, operators);

  // Build question
  const lhsA = fmtLeadTerm(a, 'x');
  const lhsB = fmtConstantTerm(b);
  const question = `Solve: ${lhsA}${lhsB} ${op} ${c}`;

  // When dividing both sides by a negative number, the inequality flips
  const flipped = a < 0;
  const flippedOp = flipOperator(op);
  const finalOp = flipped ? flippedOp : op;
  const correctAnswer = `x ${finalOp} ${boundary}`;

  // "Forgot to flip" distractor: same boundary but wrong direction
  const forgotFlipAnswer = flipped ? `x ${op} ${boundary}` : `x ${flippedOp} ${boundary}`;

  const candidates: string[] = [
    forgotFlipAnswer,
    `x ${finalOp} ${boundary + 1}`,
    `x ${finalOp} ${boundary - 1}`,
    `x ${flipOperator(finalOp)} ${boundary}`,
    `x ${finalOp} ${boundary + 2}`,
    `x ${finalOp} ${boundary - 2}`,
  ];

  const explanation = flipped
    ? `${lhsA}${lhsB} ${op} ${c} → ${lhsA} ${op} ${c - b} → x ${flippedOp} ${boundary} (flip inequality: dividing by negative)`
    : `${lhsA}${lhsB} ${op} ${c} → ${lhsA} ${op} ${c - b} → x ${op} ${boundary}`;

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

/**
 * Flip an inequality operator to its reverse.
 * '>' → '<', '<' → '>', '>=' → '<=', '<=' → '>='
 */
function flipOperator(op: string): string {
  switch (op) {
    case '>':  return '<';
    case '<':  return '>';
    case '>=': return '<=';
    case '<=': return '>=';
    default:   return op;
  }
}

/**
 * System of two linear equations: solve for (x, y).
 *
 * Constructs backward: picks solution (x, y), then picks coefficients a1, b1, a2, b2
 * with a nonzero determinant (a1*b2 − a2*b1 ≠ 0), then computes c1, c2.
 *
 * Makes up to 20 attempts to find coefficients with nonzero determinant.
 * Falls back to identity coefficients if no valid pair is found.
 *
 * @param params - GeneratorParams with rangeA (coefficient range), rangeB (solution x,y range).
 * @param rng - Seeded PRNG.
 * @returns MathProblem with two-equation system, answer "x = {x}, y = {y}".
 */
export function generateLinearSystem(params: GeneratorParams, rng: () => number): MathProblem {
  // Pick solution
  const x = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const y = randInt(rng, params.rangeB[0], params.rangeB[1]);

  // Pick coefficients with nonzero determinant — retry up to 20 times
  let a1 = 1, b1 = 0, a2 = 0, b2 = 1;
  for (let attempt = 0; attempt < 20; attempt++) {
    const ca1 = randInt(rng, params.rangeA[0], params.rangeA[1]);
    const cb1 = randInt(rng, params.rangeA[0], params.rangeA[1]);
    const ca2 = randInt(rng, params.rangeA[0], params.rangeA[1]);
    const cb2 = randInt(rng, params.rangeA[0], params.rangeA[1]);
    if (ca1 * cb2 - ca2 * cb1 !== 0) {
      a1 = ca1; b1 = cb1; a2 = ca2; b2 = cb2;
      break;
    }
  }

  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;

  // Format equations
  const eq1 = `${fmtLeadTerm(a1, 'x')}${fmtFollowTerm(b1, 'y')} = ${c1}`;
  const eq2 = `${fmtLeadTerm(a2, 'x')}${fmtFollowTerm(b2, 'y')} = ${c2}`;
  const question = `Solve the system:\n${eq1}\n${eq2}`;

  const correctAnswer = `x = ${x}, y = ${y}`;

  // Distractors: swapped x/y, sign errors, off-by-one on each
  const candidates: string[] = [
    `x = ${y}, y = ${x}`,           // swapped
    `x = ${-x}, y = ${-y}`,          // both negated
    `x = ${x + 1}, y = ${y}`,        // off-by-one x
    `x = ${x}, y = ${y + 1}`,        // off-by-one y
    `x = ${x - 1}, y = ${y}`,        // off-by-one x negative
    `x = ${x}, y = ${y - 1}`,        // off-by-one y negative
    `x = ${x + 1}, y = ${y + 1}`,    // both off-by-one
    `x = ${-x}, y = ${y}`,           // sign error x
    `x = ${x}, y = ${-y}`,           // sign error y
  ];

  const explanation = `Substitute x = ${x}, y = ${y}: ${eq1} ✓ and ${eq2} ✓`;

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
