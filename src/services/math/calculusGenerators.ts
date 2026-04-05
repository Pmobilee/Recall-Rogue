/**
 * Procedural calculus problem generators.
 *
 * Five generator functions covering derivative power rule, chain rule,
 * basic indefinite integrals, limit evaluation, and definite integrals.
 * All generators use the "construct backward" strategy — pick the answer first,
 * then build the problem — to guarantee clean integer answers.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem.
 *
 * Source files: src/services/math/calculusGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, formatPolynomial, dedupeDistractors } from './mathUtils';
import { buildExpressionDistractors } from './mathDistractorGenerator';

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a coefficient for a term displayed in a string expression.
 * Returns '' for 1, '-' for -1, and the number for all others.
 */
function fmtC(c: number): string {
  if (c === 1) return '';
  if (c === -1) return '-';
  return String(c);
}

/**
 * Format a leading term (coefficient × variable).
 */
function fmtLead(coeff: number, varPart: string): string {
  if (coeff === 1) return varPart;
  if (coeff === -1) return `-${varPart}`;
  return `${coeff}${varPart}`;
}

/**
 * Format a follow-on term (appended after previous terms), including sign.
 */
function fmtFollow(coeff: number, varPart: string): string {
  if (coeff === 0) return '';
  if (coeff === 1) return ` + ${varPart}`;
  if (coeff === -1) return ` - ${varPart}`;
  if (coeff > 0) return ` + ${coeff}${varPart}`;
  return ` - ${Math.abs(coeff)}${varPart}`;
}

/**
 * Format a constant follow-on term.
 */
function fmtConst(c: number): string {
  if (c === 0) return '';
  if (c > 0) return ` + ${c}`;
  return ` - ${Math.abs(c)}`;
}

// ── Generators ────────────────────────────────────────────────────────────────

/**
 * Derivative power rule: differentiate a polynomial.
 *
 * Constructs a polynomial with 1–3 terms (based on tier via params.steps),
 * applies d/dx(ax^n) = n*a*x^(n-1) to each term, and asks for the derivative.
 *
 * Uses formatPolynomial for consistent formatting of both problem and answer.
 * Distractors are generated via buildExpressionDistractors.
 *
 * @param params - rangeA: coefficient range, rangeB: exponent range, steps: number of terms.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with "Find d/dx[f(x)] where f(x) = {poly}" question.
 */
export function generateDerivativePowerRule(params: GeneratorParams, rng: () => number): MathProblem {
  const numTerms = params.steps ?? 2;
  const maxExp = params.rangeB[1];
  const minExp = Math.max(params.rangeB[0], 1); // exponents must be >= 1 for nontrivial derivative

  // Build coefficients array indexed by power.
  // We choose exponents and coefficients, then differentiate.
  const inputCoeffs: number[] = [];
  const derivCoeffs: number[] = [];

  // Reserve enough space: max exponent + 1
  const maxPower = maxExp;
  for (let i = 0; i <= maxPower; i++) {
    inputCoeffs.push(0);
    derivCoeffs.push(0);
  }

  // Pick numTerms distinct powers
  const usedPowers = new Set<number>();
  // Always include at least one x^n term with n >= 2 for interesting derivatives
  let attempts = 0;
  while (usedPowers.size < numTerms && attempts < 100) {
    attempts++;
    const power = randInt(rng, minExp, maxExp);
    if (!usedPowers.has(power)) {
      usedPowers.add(power);
    }
  }

  // If we didn't get enough unique powers, fill with sequential fallback
  for (let p = minExp; usedPowers.size < numTerms && p <= maxPower; p++) {
    usedPowers.add(p);
  }

  // Assign nonzero coefficients to chosen powers
  const powers = Array.from(usedPowers).sort((a, b) => b - a); // descending
  for (const power of powers) {
    let coeff = randInt(rng, params.rangeA[0], params.rangeA[1]);
    if (coeff === 0) coeff = 1;
    inputCoeffs[power] = coeff;
    // d/dx(coeff * x^power) = power * coeff * x^(power-1)
    if (power - 1 >= 0) {
      derivCoeffs[power - 1] += power * coeff;
    }
  }

  // Optionally add a constant term (not differentiated, disappears)
  let constantTerm = 0;
  if (numTerms >= 2 && rng() < 0.5) {
    constantTerm = randInt(rng, 1, Math.max(1, params.rangeA[1]));
    inputCoeffs[0] = constantTerm;
    // derivCoeffs[0] remains unchanged (constant term → 0, handled by formatPolynomial)
    // NOTE: if derivCoeffs[0] was already set (from x^1 term), this is fine — just the constant itself disappears
    // To model correctly: the constant in inputCoeffs goes away in the derivative
    // derivCoeffs[0] already holds the derivative of any x^1 terms if present
  }

  const fStr = formatPolynomial(inputCoeffs);
  const derivStr = formatPolynomial(derivCoeffs);

  const question = `Find d/dx[f(x)] where f(x) = ${fStr}`;
  const correctAnswer = derivStr;

  // Build explanation showing each term differentiated
  const termExplanations: string[] = [];
  for (const power of powers) {
    const coeff = inputCoeffs[power];
    if (coeff === 0) continue;
    if (power === 1) {
      termExplanations.push(`d/dx(${fmtLead(coeff, 'x')}) = ${coeff}`);
    } else {
      termExplanations.push(`d/dx(${fmtLead(coeff, `x^${power}`)}) = ${power * coeff}x^${power - 1}`);
    }
  }
  if (constantTerm !== 0) {
    termExplanations.push(`d/dx(${constantTerm}) = 0`);
  }
  const explanation = `Power rule: ${termExplanations.join(', ')} → ${derivStr}`;

  const distractors = buildExpressionDistractors(correctAnswer, derivCoeffs, rng);

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
 * Chain rule: differentiate f(g(x)) where f(u) = u^n and g(x) = ax + b.
 *
 * Constructs (ax + b)^n → derivative is n*a*(ax+b)^(n-1).
 * For tier 3 (steps === 2), also includes a sqrt variant: sqrt(ax + b) → a/(2*sqrt(ax+b)).
 *
 * Answer is formatted as a symbolic string.
 *
 * @param params - rangeA: [a_min, a_max] inner coefficient range, rangeB: [n_min, n_max] power range, steps: 1=polynomial, 2=+sqrt.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with chain rule question.
 */
export function generateDerivativeChainRule(params: GeneratorParams, rng: () => number): MathProblem {
  const allowSqrt = (params.steps ?? 1) >= 2;

  // Decide whether to use sqrt variant (only at higher tiers where allowSqrt=true)
  const useSqrt = allowSqrt && rng() < 0.4;

  if (useSqrt) {
    return generateChainRuleSqrt(params, rng);
  }

  // Standard: (ax + b)^n
  const n = randInt(rng, Math.max(params.rangeB[0], 2), params.rangeB[1]);
  const a = randInt(rng, 1, params.rangeA[1]); // always positive inner coefficient
  const b = randInt(rng, params.rangeA[0], params.rangeA[1]);

  // inner: ax + b
  const innerStr = buildLinearStr(a, b);
  // f(x) = (ax+b)^n
  const fStr = `(${innerStr})^${n}`;
  // f'(x) = n*a*(ax+b)^(n-1)
  const outerCoeff = n * a;
  const newPower = n - 1;

  let correctAnswer: string;
  let explanation: string;

  if (newPower === 0) {
    // (ax+b)^0 = 1, so answer is just n*a
    correctAnswer = String(outerCoeff);
    explanation = `Chain rule: ${n}·${a}·(${innerStr})^${newPower} = ${outerCoeff}·1 = ${outerCoeff}`;
  } else if (newPower === 1) {
    correctAnswer = `${outerCoeff}(${innerStr})`;
    explanation = `Chain rule: d/dx[(${innerStr})^${n}] = ${n}·(${innerStr})^${newPower}·${a} = ${outerCoeff}(${innerStr})`;
  } else {
    correctAnswer = `${outerCoeff}(${innerStr})^${newPower}`;
    explanation = `Chain rule: d/dx[(${innerStr})^${n}] = ${n}·(${innerStr})^${newPower}·${a} = ${outerCoeff}(${innerStr})^${newPower}`;
  }

  const question = `Find d/dx[${fStr}]`;

  // Distractors: common chain rule errors
  const candidates: string[] = [];
  // Forgot to multiply by inner derivative (a)
  const forgotA = newPower === 0 ? String(n) : (newPower === 1 ? `${n}(${innerStr})` : `${n}(${innerStr})^${newPower}`);
  candidates.push(forgotA);
  // Used n instead of n-1 as the new power
  const wrongPower = n;
  const wrongPowerStr = wrongPower === 1 ? `${outerCoeff}(${innerStr})` : `${outerCoeff}(${innerStr})^${wrongPower}`;
  candidates.push(wrongPowerStr);
  // Used n*n instead of n*a
  const wrongCoeff = n * n;
  const wrongCoeffStr = newPower <= 1 ? `${wrongCoeff}(${innerStr})` : `${wrongCoeff}(${innerStr})^${newPower}`;
  candidates.push(wrongCoeffStr);
  // Forgot outer coefficient entirely: just the form with n=1 coefficient
  const noCoeff = newPower === 0 ? '1' : (newPower === 1 ? `(${innerStr})` : `(${innerStr})^${newPower}`);
  candidates.push(noCoeff);
  // Off by one on the coefficient
  if (outerCoeff > 1) candidates.push(
    newPower <= 1 ? `${outerCoeff - 1}(${innerStr})` : `${outerCoeff - 1}(${innerStr})^${newPower}`,
  );
  candidates.push(
    newPower <= 1 ? `${outerCoeff + 1}(${innerStr})` : `${outerCoeff + 1}(${innerStr})^${newPower}`,
  );

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
 * Chain rule sqrt variant: differentiate sqrt(ax + b).
 * d/dx[sqrt(ax+b)] = a / (2*sqrt(ax+b))
 * Answer format: "a/(2*sqrt(ax+b))"
 */
function generateChainRuleSqrt(params: GeneratorParams, rng: () => number): MathProblem {
  const a = randInt(rng, 1, params.rangeA[1]); // positive coefficient inside sqrt
  const b = randInt(rng, 1, params.rangeA[1]); // positive constant to ensure domain is valid

  const innerStr = buildLinearStr(a, b);
  const fStr = `sqrt(${innerStr})`;

  // d/dx[sqrt(ax+b)] = a / (2*sqrt(ax+b))
  let correctAnswer: string;
  let explanation: string;

  if (a === 1) {
    correctAnswer = `1/(2*sqrt(${innerStr}))`;
    explanation = `Chain rule: d/dx[sqrt(${innerStr})] = 1/(2·sqrt(${innerStr}))·1 = 1/(2*sqrt(${innerStr}))`;
  } else {
    correctAnswer = `${a}/(2*sqrt(${innerStr}))`;
    explanation = `Chain rule: d/dx[sqrt(${innerStr})] = 1/(2·sqrt(${innerStr}))·${a} = ${a}/(2*sqrt(${innerStr}))`;
  }

  const question = `Find d/dx[${fStr}]`;

  const candidates: string[] = [
    // Forgot inner derivative
    `1/(2*sqrt(${innerStr}))`,
    // Used just sqrt in numerator, not denominator
    `${a}*sqrt(${innerStr})/2`,
    // Wrong form: numerator only
    String(a),
    // Correct numerator, forgot the 2
    `${a}/sqrt(${innerStr})`,
    // Wrong sign
    `-${a}/(2*sqrt(${innerStr}))`,
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

/**
 * Build a linear string "ax + b" with proper sign handling.
 * Used by chain rule and definite integral generators.
 */
function buildLinearStr(a: number, b: number): string {
  const bStr = b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`;
  if (a === 1) return `x${bStr}`;
  if (a === -1) return `-x${bStr}`;
  return `${a}x${bStr}`;
}

/**
 * Basic indefinite integral: integrate a polynomial using the reverse power rule.
 *
 * Constructs backward: chooses the antiderivative polynomial first, then
 * differentiates to produce the integrand. This ensures the integrand always
 * has clean integer antiderivative coefficients.
 *
 * Answer is formatted as the antiderivative polynomial + " + C".
 *
 * @param params - rangeA: antiderivative coefficient range, rangeB: power range, steps: number of terms.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with "∫ {integrand} dx = ?" question.
 */
export function generateBasicIntegral(params: GeneratorParams, rng: () => number): MathProblem {
  const numTerms = params.steps ?? 2;
  const maxExp = params.rangeB[1];
  const minExp = Math.max(params.rangeB[0], 1); // integrand powers >= 1 for non-trivial problems

  // Build the antiderivative first (construct-backward)
  // antiCoeffs[power] = coefficient in antiderivative
  const antiCoeffs: number[] = new Array(maxExp + 2).fill(0);
  // integrandCoeffs[power] = coefficient in integrand (= derivative of anti)
  const integrandCoeffs: number[] = new Array(maxExp + 2).fill(0);

  // Pick powers for the antiderivative — these must produce clean denominators when integrated
  // Strategy: pick antiderivative power p+1 such that integrand coefficient n*a is clean
  // We ensure integer integrand coefficients by choosing a as a multiple that divides cleanly
  const usedPowers = new Set<number>();
  let attempts = 0;
  while (usedPowers.size < numTerms && attempts < 100) {
    attempts++;
    // antiderivative power ranges from minExp+1 to maxExp+1
    const antiPower = randInt(rng, minExp + 1, Math.min(maxExp + 1, 6));
    if (!usedPowers.has(antiPower)) {
      usedPowers.add(antiPower);
    }
  }

  // Fill sequential if needed
  for (let p = minExp + 1; usedPowers.size < numTerms && p <= maxExp + 1; p++) {
    usedPowers.add(p);
  }

  const antiPowers = Array.from(usedPowers).sort((a, b) => b - a);

  for (const antiPower of antiPowers) {
    // Integrand power = antiPower - 1 (since d/dx x^n = n*x^(n-1))
    const integrandPower = antiPower - 1;
    // Choose antiderivative coefficient — must be nonzero
    let antiCoeff = randInt(rng, params.rangeA[0], params.rangeA[1]);
    if (antiCoeff === 0) antiCoeff = 1;
    antiCoeffs[antiPower] = antiCoeff;
    // Integrand coefficient = antiPower * antiCoeff (from reverse power rule: integral of n*c*x^(n-1) = c*x^n)
    // We store the integrand as antiPower * antiCoeff at power integrandPower
    integrandCoeffs[integrandPower] += antiPower * antiCoeff;
  }

  const antiStr = formatPolynomial(antiCoeffs);
  const integrandStr = formatPolynomial(integrandCoeffs);
  const correctAnswer = `${antiStr} + C`;

  const question = `∫ ${integrandStr} dx = ?`;

  // Explanation: show each integral term
  const termExpls: string[] = [];
  for (const antiPower of antiPowers) {
    const antiCoeff = antiCoeffs[antiPower];
    const integrandPower = antiPower - 1;
    const integrandCoeff = antiPower * antiCoeff;
    if (integrandPower === 0) {
      // Integral of constant
      termExpls.push(`∫${integrandCoeff} dx = ${integrandCoeff}x`);
    } else if (integrandPower === 1) {
      termExpls.push(`∫${fmtLead(integrandCoeff, 'x')} dx = ${antiCoeff}x^${antiPower}`);
    } else {
      termExpls.push(`∫${fmtLead(integrandCoeff, `x^${integrandPower}`)} dx = ${antiCoeff}x^${antiPower}`);
    }
  }
  const explanation = `Reverse power rule: ${termExpls.join('; ')} → ${correctAnswer}`;

  // Distractors: coefficient errors and forgetting +C
  const candidates: string[] = [];
  // Forgot the + C
  candidates.push(antiStr);
  // Wrong exponents (off by one on powers in antiderivative)
  const offByOneAntiCoeffs = [...antiCoeffs];
  for (let i = offByOneAntiCoeffs.length - 1; i >= 1; i--) {
    if (offByOneAntiCoeffs[i] !== 0) {
      const shifted: number[] = new Array(antiCoeffs.length + 1).fill(0);
      for (let j = 0; j < antiCoeffs.length; j++) {
        shifted[j + 1] += antiCoeffs[j];
      }
      candidates.push(`${formatPolynomial(shifted)} + C`);
      break;
    }
  }
  // Wrong coefficients (forgot to divide by power — just copied integrand coefficients)
  candidates.push(`${integrandStr} + C`);
  // Off by one on leading coefficient
  const variantCoeffs = [...antiCoeffs];
  for (let i = variantCoeffs.length - 1; i >= 0; i--) {
    if (variantCoeffs[i] !== 0) {
      variantCoeffs[i] = variantCoeffs[i] + 1;
      candidates.push(`${formatPolynomial(variantCoeffs)} + C`);
      variantCoeffs[i] = antiCoeffs[i] - 1;
      if (variantCoeffs[i] !== 0) {
        candidates.push(`${formatPolynomial(variantCoeffs)} + C`);
      }
      break;
    }
  }
  // Correct antiderivative but C typo as a constant
  candidates.push(`${antiStr} + 1`);
  candidates.push(`${antiStr} - C`);

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
 * Limit evaluation — three subtypes by tier:
 *
 * - steps=1 (T1): direct substitution, limit = polynomial evaluated at a point.
 * - steps=2 (T2a/T2b): polynomial that factors as (x-a)(x+b)/(x-a), allowing
 *   the indeterminate form to cancel. Also includes direct substitution where
 *   result is not obviously substitutable.
 * - steps=3 (T3): special limits pool — known limits from a fixed table.
 *
 * @param params - rangeA: coefficient range, rangeB: limit point range, steps: complexity.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with "lim_{x→a} f(x)" question.
 */
export function generateLimitEvaluation(params: GeneratorParams, rng: () => number): MathProblem {
  const steps = params.steps ?? 1;

  if (steps >= 3) {
    return generateSpecialLimit(rng);
  }

  if (steps >= 2) {
    // Factored cancel with ~50% probability; otherwise direct substitution
    if (rng() < 0.5) {
      return generateFactoredLimit(params, rng);
    }
  }

  // Direct substitution: lim_{x→c} f(x) where f is a polynomial
  return generateDirectSubstitutionLimit(params, rng);
}

/** Direct substitution limit: evaluate polynomial at x = c. */
function generateDirectSubstitutionLimit(params: GeneratorParams, rng: () => number): MathProblem {
  // Pick the limit point and coefficients
  const c = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const a = randInt(rng, 1, params.rangeA[1]);
  const b = randInt(rng, params.rangeA[0], params.rangeA[1]);

  // f(x) = ax + b (tier 1) or ax^2 + bx + c_const (higher steps)
  const cConst = randInt(rng, params.rangeA[0], params.rangeA[1]);

  let fStr: string;
  let answer: number;

  if (rng() < 0.5) {
    // Linear: ax + b
    fStr = `${buildLinearStr(a, b)}`;
    answer = a * c + b;
  } else {
    // Quadratic: ax^2 + bx + cConst
    const coeffs = [cConst, b, a];
    fStr = formatPolynomial(coeffs);
    answer = a * c * c + b * c + cConst;
  }

  const question = `lim_{x→${c}} (${fStr})`;
  const correctAnswer = String(answer);
  const explanation = `Direct substitution: plug in x = ${c} → ${question.replace('lim_{x→' + c + '} ', '')} = ${answer}`;

  const candidates: string[] = [
    String(answer + 1),
    String(answer - 1),
    String(answer + 2),
    String(answer - 2),
    String(answer * 2),
    String(answer + c),
    String(answer - c),
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

/**
 * Factored limit: lim_{x→r} (x-r)(x-s) / (x-r) = (r-s).
 * Constructs backward: picks r and s, forms the indeterminate expression,
 * cancels the (x-r) factor to get the limit = r - s.
 */
function generateFactoredLimit(params: GeneratorParams, rng: () => number): MathProblem {
  const r = randInt(rng, params.rangeB[0], params.rangeB[1]); // limit point (also the zero)
  let s = randInt(rng, params.rangeB[0], params.rangeB[1]);
  if (s === r) s = r + 1; // ensure s ≠ r so the limit is well-defined after factoring

  // Numerator: (x - r)(x - s) = x^2 - (r+s)x + r*s
  const numCoeffs = [r * s, -(r + s), 1]; // [constant, x-coeff, x^2-coeff]
  const numeratorStr = formatPolynomial(numCoeffs);
  const denominatorStr = buildLinearStr(1, -r); // x - r

  // After cancellation: lim_{x→r} (x - s) = r - s
  const answer = r - s;

  const question = `lim_{x→${r}} [(${numeratorStr}) / (${denominatorStr})]`;
  const correctAnswer = String(answer);
  const explanation = `Factor numerator: (x - ${r})(x - ${s}) / (x - ${r}) → cancel (x - ${r}) → lim_{x→${r}} (x - ${s}) = ${r} - ${s} = ${answer}`;

  const candidates: string[] = [
    String(answer + 1),
    String(answer - 1),
    String(r + s),   // sum instead of difference — common error
    String(-answer), // sign error
    String(r),       // forgot the factoring step, returned limit point
    String(s),       // similar confusion
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

/** Pool of known special limits for tier 3. */
const SPECIAL_LIMITS: Array<{
  question: string;
  answer: string;
  explanation: string;
  distractorCandidates: string[];
}> = [
  {
    question: 'lim_{x→0} (sin(x) / x)',
    answer: '1',
    explanation: 'Fundamental trig limit: lim_{x→0} sin(x)/x = 1',
    distractorCandidates: ['0', 'undefined', '∞', '1/2'],
  },
  {
    question: 'lim_{x→0} ((1 - cos(x)) / x)',
    answer: '0',
    explanation: 'Fundamental trig limit: lim_{x→0} (1-cos(x))/x = 0',
    distractorCandidates: ['1', '-1', 'undefined', '1/2'],
  },
  {
    question: 'lim_{x→∞} (1/x)',
    answer: '0',
    explanation: 'As x grows unboundedly large, 1/x → 0',
    distractorCandidates: ['1', '∞', '-1', 'undefined'],
  },
  {
    question: 'lim_{x→0⁺} (1/x)',
    answer: '∞',
    explanation: 'As x approaches 0 from the right, 1/x grows without bound → ∞',
    distractorCandidates: ['0', '-∞', '1', 'undefined'],
  },
  {
    question: 'lim_{x→∞} (1 + 1/x)^x',
    answer: 'e',
    explanation: 'Definition of e: lim_{x→∞} (1 + 1/x)^x = e ≈ 2.718...',
    distractorCandidates: ['1', '∞', '2', '3'],
  },
  {
    question: 'lim_{x→0} (e^x - 1) / x',
    answer: '1',
    explanation: 'Fundamental exponential limit: lim_{x→0} (e^x - 1)/x = 1',
    distractorCandidates: ['0', 'e', 'undefined', '1/2'],
  },
  {
    question: 'lim_{x→∞} (x^2 + 1) / (2x^2 - 3)',
    answer: '1/2',
    explanation: 'Leading terms dominate: x^2/2x^2 = 1/2 as x → ∞',
    distractorCandidates: ['2', '1', '0', '∞'],
  },
  {
    question: 'lim_{x→∞} (3x^3 - x) / x^3',
    answer: '3',
    explanation: 'Divide by x^3: (3 - 1/x^2) → 3 as x → ∞',
    distractorCandidates: ['-1', '0', '1', '∞'],
  },
];

/** Pick a random special limit from the pool. */
function generateSpecialLimit(rng: () => number): MathProblem {
  const entry = randPick(rng, SPECIAL_LIMITS);

  const distractors = dedupeDistractors(entry.distractorCandidates, entry.answer, 4);

  return {
    question: entry.question,
    correctAnswer: entry.answer,
    acceptableAlternatives: [],
    distractors,
    explanation: entry.explanation,
    inputMode: 'choice',
  };
}

/**
 * Definite integral: evaluate ∫_a^b f(x) dx using the fundamental theorem.
 *
 * Constructs backward: chooses the antiderivative, then picks bounds [lo, hi]
 * such that F(hi) - F(lo) is an integer. Uses divisibility constraints to
 * guarantee clean integer answers.
 *
 * @param params - rangeA: antiderivative coefficient range, rangeB: bounds range, steps: 1=linear, 2=quadratic, 3=cubic.
 * @param rng - Seeded PRNG.
 * @returns MathProblem with "∫_{a}^{b} f(x) dx" question and integer answer.
 */
export function generateDefiniteIntegral(params: GeneratorParams, rng: () => number): MathProblem {
  const complexity = params.steps ?? 1; // 1=linear integrand, 2=quadratic, 3=cubic

  // Choose the antiderivative polynomial degree = complexity + 1
  // For a linear integrand (x^1), antiderivative is x^2/2 — we construct to avoid fractions

  // Strategy: use antiderivative coefficients that are multiples of their powers
  // so that integrand coefficients are clean integers.
  // e.g., antiderivative a*x^2/2 means integrand is a*x (integer if a is even)
  // Instead: pick integrand, compute antiderivative, choose bounds to get integer result.

  // Pick the integrand polynomial (this is what's inside the integral)
  const integrandCoeffs: number[] = new Array(complexity + 1).fill(0);
  for (let power = 1; power <= complexity; power++) {
    let coeff = randInt(rng, 1, params.rangeA[1]);
    // Multiply by (power + 1) to ensure antiderivative coefficient divides cleanly
    // antiCoeff = coeff / (power+1), but we want an integer antiCoeff
    // Instead pick antiCoeff directly, then integrandCoeff = (power+1) * antiCoeff
    integrandCoeffs[power] = coeff * (power + 1); // ensures clean division later
  }

  // Antiderivative: antiCoeffs[p+1] = integrandCoeffs[p] / (p+1)
  const antiCoeffs: number[] = new Array(complexity + 2).fill(0);
  for (let power = 1; power <= complexity; power++) {
    antiCoeffs[power + 1] = integrandCoeffs[power] / (power + 1);
  }

  // Pick bounds — small positive integers to keep the result manageable
  const boundMax = Math.max(2, Math.min(params.rangeB[1], 5));
  let lo = randInt(rng, 0, boundMax - 1);
  let hi = randInt(rng, lo + 1, boundMax);
  if (hi === lo) hi = lo + 1;

  // Evaluate F(hi) - F(lo)
  function evalPoly(coeffs: number[], x: number): number {
    let result = 0;
    for (let power = 0; power < coeffs.length; power++) {
      result += coeffs[power] * Math.pow(x, power);
    }
    return result;
  }

  const answer = evalPoly(antiCoeffs, hi) - evalPoly(antiCoeffs, lo);

  // Format: always an integer because of our construction
  const answerInt = Math.round(answer);
  const correctAnswer = String(answerInt);

  const integrandStr = formatPolynomial(integrandCoeffs);
  const antiStr = formatPolynomial(antiCoeffs);

  const question = `∫_{${lo}}^{${hi}} (${integrandStr}) dx`;
  const explanation = `Antiderivative: F(x) = ${antiStr}. Evaluate: F(${hi}) - F(${lo}) = ${evalPoly(antiCoeffs, hi)} - ${evalPoly(antiCoeffs, lo)} = ${answerInt}`;

  // Distractors: common errors
  const candidates: string[] = [
    String(answerInt + 1),
    String(answerInt - 1),
    // Swapped bounds (F(lo) - F(hi))
    String(-answerInt),
    String(answerInt + 2),
    String(answerInt - 2),
    // Evaluated at only one bound
    String(Math.round(evalPoly(antiCoeffs, hi))),
    String(Math.round(evalPoly(antiCoeffs, lo))),
    String(answerInt * 2),
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
