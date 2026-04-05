/**
 * Procedural discrete mathematics problem generators.
 *
 * Five generator functions covering recurrence relations, graph theory basics,
 * number base conversion, summation formulas, and proof by induction concepts.
 *
 * All generators use a "construct forward" strategy where sensible — build the
 * problem from known values and compute the answer directly. All randomness is
 * seeded via a mulberry32 PRNG so the same (params, seed) pair always produces
 * the same problem.
 *
 * Source files: src/services/math/discreteMathGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, dedupeDistractors } from './mathUtils';

// ── Base conversion helpers ───────────────────────────────────────────────────

/**
 * Convert a non-negative decimal integer to its binary string representation.
 * Returns '0' for n = 0.
 */
function decToBin(n: number): string {
  if (n === 0) return '0';
  let result = '';
  let remaining = Math.abs(Math.floor(n));
  while (remaining > 0) {
    result = String(remaining % 2) + result;
    remaining = Math.floor(remaining / 2);
  }
  return result;
}

/**
 * Convert a non-negative decimal integer to its hexadecimal string (uppercase).
 * Returns '0' for n = 0.
 */
function decToHex(n: number): string {
  if (n === 0) return '0';
  const digits = '0123456789ABCDEF';
  let result = '';
  let remaining = Math.abs(Math.floor(n));
  while (remaining > 0) {
    result = digits[remaining % 16] + result;
    remaining = Math.floor(remaining / 16);
  }
  return result;
}

/**
 * Convert a binary string to a decimal integer.
 * Non-binary characters are ignored gracefully (treated as 0).
 */
function binToDec(s: string): number {
  let result = 0;
  for (const ch of s) {
    result = result * 2 + (ch === '1' ? 1 : 0);
  }
  return result;
}

/**
 * Convert a hexadecimal string (mixed case) to a decimal integer.
 */
function hexToDec(s: string): number {
  return parseInt(s, 16);
}

// ── Generator 1: Recurrence Relations ────────────────────────────────────────

/**
 * Generates a linear recurrence relation problem.
 *
 * The `steps` parameter selects the sub-type:
 *   1 = arithmetic: a_n = a_{n-1} + d (pick a_1, d, find a_n for n in [3,8])
 *   2 = Fibonacci-like: a_n = a_{n-1} + a_{n-2} (pick a_1, a_2, find a_n for n in [5,8])
 *   3 = geometric: a_n = c * a_{n-1} (pick a_1, c in [2,4], find a_n for n in [3,6])
 *   4 = linear with constant: a_n = c * a_{n-1} + d (pick small values for clean results)
 *
 * Distractors: a_{n-1}, a_{n+1}, off-by-one base case, wrong multiplier.
 *
 * @param params - rangeA = first term / coefficient range, rangeB = step/multiplier range.
 *                 steps = sub-type selector (1–4).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer.
 */
export function generateRecurrence(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const aMin = params.rangeA[0];
  const aMax = params.rangeA[1];
  const bMin = params.rangeB[0];
  const bMax = params.rangeB[1];
  const subType = params.steps ?? 1;

  let question: string;
  let correctAnswer: string;
  let explanation: string;
  let candidates: string[];

  if (subType === 1) {
    // Arithmetic recurrence: a_n = a_{n-1} + d
    const a1 = randInt(rng, aMin, aMax);
    const d = randInt(rng, bMin, bMax);
    const n = randInt(rng, 3, 8);

    // Build sequence iteratively
    const seq: number[] = [a1];
    for (let i = 1; i < n; i++) seq.push(seq[i - 1] + d);
    const an = seq[n - 1];

    correctAnswer = String(an);
    question = `Given a₁ = ${a1}, and aₙ = aₙ₋₁ + ${d}, find a${subscript(n)}.`;
    explanation = `This is arithmetic with first term ${a1} and common difference ${d}. ` +
      `a${subscript(n)} = ${a1} + (${n} - 1) × ${d} = ${an}.`;

    const prev = seq[n - 2] ?? a1;
    const next = an + d;
    candidates = [
      String(prev),
      String(next),
      String(an + 1),
      String(an - 1),
      String(a1 + (n - 2) * d),
      String(a1 + n * d),
    ];

  } else if (subType === 2) {
    // Fibonacci-like: a_n = a_{n-1} + a_{n-2}
    const a1 = randInt(rng, aMin, aMax);
    const a2 = randInt(rng, aMin, aMax);
    const n = randInt(rng, 5, 8);

    const seq: number[] = [a1, a2];
    for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
    const an = seq[n - 1];

    correctAnswer = String(an);
    question = `Given a₁ = ${a1}, a₂ = ${a2}, and aₙ = aₙ₋₁ + aₙ₋₂, find a${subscript(n)}.`;
    explanation = `Sequence: ${seq.slice(0, n).join(', ')}. So a${subscript(n)} = ${an}.`;

    const prev = seq[n - 2];
    const next = an + seq[n - 2];
    candidates = [
      String(prev),
      String(next),
      String(an + seq[n - 3]),
      String(seq[n - 2] + seq[n - 3]),
    ];

  } else if (subType === 3) {
    // Geometric: a_n = c * a_{n-1}
    const a1 = randInt(rng, aMin, aMax);
    const c = randInt(rng, Math.max(bMin, 2), Math.min(bMax, 4));
    const n = randInt(rng, 3, 6);

    const seq: number[] = [a1];
    for (let i = 1; i < n; i++) seq.push(seq[i - 1] * c);
    const an = seq[n - 1];

    correctAnswer = String(an);
    question = `Given a₁ = ${a1}, and aₙ = ${c} × aₙ₋₁, find a${subscript(n)}.`;
    explanation = `Geometric sequence with ratio ${c}. ` +
      `a${subscript(n)} = ${a1} × ${c}^${n - 1} = ${an}.`;

    const prev = seq[n - 2] ?? a1;
    const next = an * c;
    candidates = [
      String(prev),
      String(next),
      String(an + c),
      String(an - c),
      String(a1 * Math.pow(c, n - 2)),
      String(a1 * Math.pow(c, n)),
    ];

  } else {
    // Linear with constant: a_n = c * a_{n-1} + d
    // Pick small values to keep results manageable
    const a1 = randInt(rng, 1, Math.min(aMax, 5));
    const c = randInt(rng, 2, 3);
    const d = randInt(rng, 1, Math.min(bMax, 4));
    const n = randInt(rng, 3, 5);

    const seq: number[] = [a1];
    for (let i = 1; i < n; i++) seq.push(seq[i - 1] * c + d);
    const an = seq[n - 1];

    correctAnswer = String(an);
    question = `Given a₁ = ${a1}, and aₙ = ${c} × aₙ₋₁ + ${d}, find a${subscript(n)}.`;
    explanation = `Sequence: ${seq.slice(0, n).join(', ')}. So a${subscript(n)} = ${an}.`;

    const prev = seq[n - 2] ?? a1;
    const next = an * c + d;
    candidates = [
      String(prev),
      String(next),
      String(seq[n - 2] * c + d + 1),
      String(an + d),
      String(an - d),
    ];
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

// ── Generator 2: Graph Theory ─────────────────────────────────────────────────

/**
 * Generates a basic graph theory problem.
 *
 * The `steps` parameter selects the sub-type:
 *   1 = Handshaking lemma: sum of all vertex degrees = 2 × edges
 *   2 = Minimum edges for connected graph: n vertices → n-1 edges
 *   3 = Complete graph edges: K_n has n*(n-1)/2 edges
 *   4 = Regular graph edges: n vertices each degree d → n*d/2 edges (n*d even guaranteed)
 *
 * @param params - rangeA = vertex count range, rangeB = edge count / degree range.
 *                 steps = sub-type selector (1–4).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer.
 */
export function generateGraphTheory(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const nMin = params.rangeA[0];
  const nMax = params.rangeA[1];
  const eMin = params.rangeB[0];
  const eMax = params.rangeB[1];
  const subType = params.steps ?? 1;

  let question: string;
  let correctAnswer: string;
  let explanation: string;
  let candidates: string[];

  if (subType === 1) {
    // Handshaking lemma: sum of degrees = 2 * edges
    const n = randInt(rng, nMin, nMax);
    const e = randInt(rng, eMin, eMax);
    const answer = 2 * e;

    correctAnswer = String(answer);
    question = `A graph has ${n} vertices and ${e} edges. What is the sum of all vertex degrees?`;
    explanation = `By the Handshaking Lemma, the sum of all vertex degrees equals 2 × (number of edges) = 2 × ${e} = ${answer}.`;

    candidates = [
      String(e),
      String(n * e),
      String(n + e),
      String(answer + 2),
      String(answer - 2),
      String(n * 2),
    ];

  } else if (subType === 2) {
    // Minimum edges for connected graph: n-1 (spanning tree)
    const n = randInt(rng, nMin, nMax);
    const answer = n - 1;

    correctAnswer = String(answer);
    question = `What is the minimum number of edges needed to form a connected graph with ${n} vertices?`;
    explanation = `A connected graph requires at least a spanning tree, which has exactly n - 1 = ${n} - 1 = ${answer} edges.`;

    candidates = [
      String(n),
      String(n - 2),
      String(n + 1),
      String(Math.floor(n * (n - 1) / 2)),
      String(answer + 1),
    ];

  } else if (subType === 3) {
    // Complete graph K_n edges: n*(n-1)/2
    const n = randInt(rng, nMin, Math.min(nMax, 10));
    const answer = n * (n - 1) / 2;

    correctAnswer = String(answer);
    question = `A complete graph K${subscript(n)} has how many edges?`;
    explanation = `In K${subscript(n)}, every vertex connects to every other vertex. ` +
      `Edges = n(n-1)/2 = ${n} × ${n - 1} / 2 = ${answer}.`;

    candidates = [
      String(n * (n - 1)),
      String(n - 1),
      String(answer - 1),
      String(answer + 1),
      String(n * n),
      String(n * (n + 1) / 2),
    ];

  } else {
    // Regular graph: n vertices, each degree d → n*d/2 edges
    // Ensure n*d is even by picking even n or even d
    let n = randInt(rng, nMin, nMax);
    let d = randInt(rng, Math.max(eMin, 2), Math.min(eMax, 6));
    // Guarantee n*d is even
    if ((n * d) % 2 !== 0) {
      // Increment d by 1 (within range if possible)
      if (d + 1 <= Math.min(eMax, 6)) d++;
      else n++;
    }
    const answer = (n * d) / 2;

    correctAnswer = String(answer);
    question = `A graph has ${n} vertices, each with degree ${d}. How many edges does it have?`;
    explanation = `By the Handshaking Lemma: sum of degrees = n × d = ${n} × ${d} = ${n * d}. ` +
      `Edges = ${n * d} / 2 = ${answer}.`;

    candidates = [
      String(n * d),
      String(n + d),
      String(answer + 1),
      String(answer - 1),
      String(answer * 2),
      String(Math.max(1, answer - 2)),
    ];
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

// ── Generator 3: Base Conversion ──────────────────────────────────────────────

/**
 * Generates a number base conversion problem.
 *
 * The `steps` parameter selects the sub-type:
 *   1 = Decimal to binary (pick decimal in [1, 31])
 *   2 = Binary to decimal (pick binary string)
 *   3 = Decimal to hexadecimal (pick decimal in [1, 255])
 *   4 = Hexadecimal to decimal (pick hex value)
 *
 * @param params - rangeA = decimal/value range. steps = sub-type (1–4).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with a string answer (binary/hex/decimal).
 */
export function generateBaseConversion(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const valMin = Math.max(params.rangeA[0], 1);
  const valMax = params.rangeA[1];
  const subType = params.steps ?? 1;

  let question: string;
  let correctAnswer: string;
  let explanation: string;
  let candidates: string[];

  if (subType === 1) {
    // Decimal to binary
    const n = randInt(rng, valMin, Math.min(valMax, 31));
    const binStr = decToBin(n);

    correctAnswer = binStr;
    question = `Convert ${n} (decimal) to binary.`;
    explanation = `${n} in binary is ${binStr}. ` +
      `(${Array.from(binStr).map((b, i) => `${b}×2^${binStr.length - 1 - i}`).join(' + ')})`;

    // Distractors: flip a bit, shift by one, off-by-one value
    const nAlt1 = decToBin(n + 1);
    const nAlt2 = decToBin(n - 1 > 0 ? n - 1 : n + 2);
    const nAlt3 = decToBin(n + 2);
    const nAlt4 = binStr.length > 1
      ? binStr.slice(0, -1) + (binStr[binStr.length - 1] === '0' ? '1' : '0')
      : decToBin(n + 3);
    candidates = [nAlt1, nAlt2, nAlt3, nAlt4];

  } else if (subType === 2) {
    // Binary to decimal
    const n = randInt(rng, valMin, Math.min(valMax, 63));
    const binStr = decToBin(n);

    correctAnswer = String(n);
    question = `Convert ${binStr} (binary) to decimal.`;
    explanation = `${binStr} in decimal is ${n}. ` +
      `Compute: ${Array.from(binStr).map((b, i) => `${b}×2^${binStr.length - 1 - i}`).join(' + ')} = ${n}.`;

    candidates = [
      String(n + 1),
      String(n - 1 > 0 ? n - 1 : n + 2),
      String(n + 2),
      String(binToDec(binStr.slice(1)) || n + 4),
      String(n * 2),
    ];

  } else if (subType === 3) {
    // Decimal to hexadecimal
    const n = randInt(rng, valMin, Math.min(valMax, 255));
    const hexStr = decToHex(n);

    correctAnswer = hexStr;
    question = `Convert ${n} (decimal) to hexadecimal.`;
    explanation = `${n} in hexadecimal is ${hexStr}. ` +
      `(${n} = ${Math.floor(n / 16)} × 16 + ${n % 16})`;

    candidates = [
      decToHex(n + 1),
      decToHex(n - 1 > 0 ? n - 1 : n + 2),
      decToHex(n + 16),
      decToHex(Math.max(1, n - 16)),
      decToBin(n % 16),  // common confusion: just the last nibble in binary
    ];

  } else {
    // Hexadecimal to decimal
    const n = randInt(rng, valMin, Math.min(valMax, 255));
    const hexStr = decToHex(n);

    correctAnswer = String(n);
    question = `Convert ${hexStr} (hexadecimal) to decimal.`;
    explanation = `${hexStr} in decimal is ${n}. ` +
      `(${hexStr.split('').map((ch, i) => `${hexToDec(ch)}×16^${hexStr.length - 1 - i}`).join(' + ')} = ${n})`;

    candidates = [
      String(n + 1),
      String(n - 1 > 0 ? n - 1 : n + 2),
      String(n + 16),
      String(Math.max(1, n - 16)),
      String(n + hexToDec(hexStr[hexStr.length - 1] || '0')),
    ];
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

// ── Generator 4: Summation Formulas ──────────────────────────────────────────

/**
 * Generates a closed-form summation evaluation problem.
 *
 * The `steps` parameter selects the formula:
 *   1 = Σ(i=1 to n) i = n(n+1)/2
 *   2 = Σ(i=1 to n) i² = n(n+1)(2n+1)/6  (pick n divisible by 6 condition)
 *   3 = Σ(i=0 to n) 2^i = 2^(n+1) - 1    (geometric sum starting from i=0)
 *   4 = Σ(i=1 to n) (2i-1) = n²           (sum of first n odd numbers)
 *
 * @param params - rangeA = upper limit n range. steps = formula type (1–4).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer.
 */
export function generateSummation(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const nMin = params.rangeA[0];
  const nMax = params.rangeA[1];
  const subType = params.steps ?? 1;

  let question: string;
  let correctAnswer: string;
  let explanation: string;
  let candidates: string[];

  if (subType === 1) {
    // Σ(i=1 to n) i = n(n+1)/2
    const n = randInt(rng, nMin, nMax);
    const answer = n * (n + 1) / 2;

    correctAnswer = String(answer);
    question = `Evaluate: Σ(i=1 to ${n}) i`;
    explanation = `Sum of first ${n} positive integers = n(n+1)/2 = ${n} × ${n + 1} / 2 = ${answer}.`;

    candidates = [
      String(n * n),
      String(n * (n + 1)),
      String(answer + 1),
      String(answer - 1),
      String((n - 1) * n / 2),
      String((n + 1) * (n + 2) / 2),
    ];

  } else if (subType === 2) {
    // Σ(i=1 to n) i² = n(n+1)(2n+1)/6
    // Ensure answer is integer — it always is by formula, but pick n to be safe
    const n = randInt(rng, Math.max(nMin, 3), Math.min(nMax, 8));
    const answer = Math.floor(n * (n + 1) * (2 * n + 1) / 6);

    correctAnswer = String(answer);
    question = `Evaluate: Σ(i=1 to ${n}) i²`;
    explanation = `Sum of squares formula: n(n+1)(2n+1)/6 = ${n} × ${n + 1} × ${2 * n + 1} / 6 = ${answer}.`;

    const wrongA = n * (n + 1) / 2;  // forgot to square
    const wrongB = Math.floor((n * (n + 1) * (2 * n + 1)) / 3);  // divided by 3 instead of 6
    candidates = [
      String(Math.round(wrongA)),
      String(Math.round(wrongB)),
      String(answer + n),
      String(answer - n),
      String(n * n * n),
    ];

  } else if (subType === 3) {
    // Σ(i=0 to n) 2^i = 2^(n+1) - 1
    const n = randInt(rng, Math.max(nMin, 2), Math.min(nMax, 8));
    const answer = Math.pow(2, n + 1) - 1;

    correctAnswer = String(answer);
    question = `Evaluate: Σ(i=0 to ${n}) 2^i`;
    explanation = `Geometric series: Σ(i=0 to n) 2^i = 2^(n+1) - 1 = 2^${n + 1} - 1 = ${answer}.`;

    candidates = [
      String(Math.pow(2, n + 1)),      // forgot to subtract 1
      String(Math.pow(2, n) - 1),       // off by one in exponent
      String(Math.pow(2, n + 1) - 2),   // subtracted 2 instead of 1
      String(answer + 1),
      String(answer - 1),
      String(n * Math.pow(2, n)),
    ];

  } else {
    // Σ(i=1 to n) (2i-1) = n² (sum of first n odd numbers)
    const n = randInt(rng, nMin, nMax);
    const answer = n * n;

    correctAnswer = String(answer);
    question = `Evaluate: Σ(i=1 to ${n}) (2i - 1)`;
    explanation = `Sum of first ${n} odd numbers = n² = ${n}² = ${answer}. ` +
      `(The odd numbers are 1, 3, 5, ..., ${2 * n - 1})`;

    candidates = [
      String(n * (n + 1)),
      String(n * (n + 1) / 2),
      String(answer + n),
      String(answer - n),
      String(2 * n * (n - 1)),
      String((n + 1) * (n + 1)),
    ];
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

// ── Generator 5: Induction Base ───────────────────────────────────────────────

/**
 * Template pool entry for induction concept problems.
 */
interface InductionTemplate {
  statement: string;        // P(n) description
  baseEval: string;         // value of P(1)
  inductiveConclusion: string; // what must be shown in inductive step
  lhsKPlus1: string;        // LHS of P(k+1) after substituting P(k)
  strongHypothesis: string; // strong induction variant
  wrongBase: string;        // wrong base case answer distractor
  wrongLhs: string;         // wrong LHS distractor
}

const INDUCTION_TEMPLATES: InductionTemplate[] = [
  {
    statement: 'P(n): Σ(i=1 to n) i = n(n+1)/2',
    baseEval: '1',
    inductiveConclusion: 'P(k) → P(k+1)',
    lhsKPlus1: 'k(k+1)/2 + (k+1)',
    strongHypothesis: 'P(j) holds for all j ≤ k',
    wrongBase: '3',
    wrongLhs: 'k(k+1)/2 + k',
  },
  {
    statement: 'P(n): 2^n > n',
    baseEval: '2 > 1 (True)',
    inductiveConclusion: 'P(k) → P(k+1)',
    lhsKPlus1: '2 × 2^k',
    strongHypothesis: 'P(j) holds for all j ≤ k',
    wrongBase: '1 > 1 (False)',
    wrongLhs: '2^k + 1',
  },
  {
    statement: 'P(n): Σ(i=1 to n) i² = n(n+1)(2n+1)/6',
    baseEval: '1',
    inductiveConclusion: 'P(k) → P(k+1)',
    lhsKPlus1: 'k(k+1)(2k+1)/6 + (k+1)²',
    strongHypothesis: 'P(j) holds for all j ≤ k',
    wrongBase: '2',
    wrongLhs: 'k(k+1)(2k+1)/6 + k²',
  },
  {
    statement: 'P(n): n! ≥ 2^(n-1) for n ≥ 1',
    baseEval: '1 (1! = 1 ≥ 1)',
    inductiveConclusion: 'P(k) → P(k+1)',
    lhsKPlus1: '(k+1) × k!',
    strongHypothesis: 'P(j) holds for all j ≤ k',
    wrongBase: '0',
    wrongLhs: 'k! + 1',
  },
];

/**
 * Generates a proof by induction concept problem.
 *
 * Questions are drawn from a fixed template pool — this generator is
 * primarily conceptual rather than computational.
 *
 * The `steps` parameter selects the sub-type:
 *   1 = Evaluate P(1) (what is the base case value?)
 *   2 = Identify the inductive step goal (multiple-choice)
 *   3 = Find LHS of P(k+1) after assuming P(k)
 *   4 = Identify the strong induction hypothesis
 *
 * @param params - rangeA controls template selection index. steps = sub-type (1–4).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with a string answer.
 */
export function generateInductionBase(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const subType = params.steps ?? 1;

  // Pick a template using the PRNG
  const template = randPick(rng, INDUCTION_TEMPLATES);

  let question: string;
  let correctAnswer: string;
  let explanation: string;
  let candidates: string[];

  if (subType === 1) {
    // Base case evaluation: what is P(1)?
    correctAnswer = template.baseEval;
    question = `For the statement ${template.statement}, what is the value of P(1)?`;
    explanation = `Substitute n = 1 into the statement. P(1) evaluates to: ${template.baseEval}.`;

    candidates = [
      template.wrongBase,
      '0',
      '2',
      'Undefined',
      template.lhsKPlus1,
    ];

  } else if (subType === 2) {
    // Inductive step goal identification
    correctAnswer = template.inductiveConclusion;
    question = `In a proof by induction on ${template.statement}, what must the inductive step prove?`;
    explanation = `The inductive step assumes P(k) (the inductive hypothesis) and proves P(k+1). ` +
      `Formally: ${template.inductiveConclusion}.`;

    candidates = [
      'P(k) → P(k-1)',
      'P(k) → P(k+2)',
      'P(0) → P(k)',
      'P(k+1) → P(k)',
      template.strongHypothesis,
    ];

  } else if (subType === 3) {
    // LHS of P(k+1) after substituting P(k)
    correctAnswer = template.lhsKPlus1;
    question = `Assuming P(k): ${template.statement.replace('P(n)', 'P(k)').replace('n', 'k')}, ` +
      `what is the left-hand side of P(k+1)?`;
    explanation = `Substitute k+1 for n (or k for the last term) in P(k). ` +
      `The LHS of P(k+1) is: ${template.lhsKPlus1}.`;

    candidates = [
      template.wrongLhs,
      template.baseEval,
      template.inductiveConclusion,
      template.lhsKPlus1 + ' + 1',
    ];

  } else {
    // Strong induction hypothesis
    correctAnswer = template.strongHypothesis;
    question = `In a proof by strong induction on ${template.statement}, ` +
      `what does the strong induction hypothesis assume?`;
    explanation = `Strong induction assumes P holds for ALL previous values: ` +
      `${template.strongHypothesis}.`;

    candidates = [
      template.inductiveConclusion,
      'P(k) only',
      'P(k) and P(k-1)',
      template.lhsKPlus1,
      template.baseEval,
    ];
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

// ── Internal utility ──────────────────────────────────────────────────────────

/**
 * Returns a subscript-like suffix string for a number in question text.
 * Actual Unicode subscripts for common digits; falls back to plain suffix.
 */
function subscript(n: number): string {
  const sub: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  };
  return String(n).split('').map(ch => sub[ch] ?? ch).join('');
}
