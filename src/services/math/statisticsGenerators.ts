/**
 * Procedural statistics and probability problem generators.
 *
 * Five generator functions covering central tendency (mean, median, mode),
 * standard deviation, basic probability (coins, dice, cards),
 * combinations and permutations, and expected value.
 *
 * All generators use the "construct backward" strategy where possible —
 * pick the answer first, then build the problem — to guarantee clean results.
 * Standard deviation uses forward computation with 1-decimal rounding.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem.
 *
 * Source files: src/services/math/statisticsGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, gcd, combinations, permutations, dedupeDistractors } from './mathUtils';
import { buildStatisticsDistractors } from './mathDistractorGenerator';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Shuffle an array in-place using Fisher-Yates with the provided PRNG.
 */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Format a number as a display string: integer if whole, one decimal otherwise.
 */
function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/**
 * Compute the simplified fraction string "num/den" using GCD reduction.
 */
function simplifyFraction(num: number, den: number): string {
  const g = gcd(Math.abs(num), Math.abs(den));
  return `${num / g}/${den / g}`;
}

// ── Generator 1: Central Tendency ────────────────────────────────────────────

/**
 * Generates a mean, median, or mode problem for a small integer data set.
 *
 * Uses "construct backward" for mean (pick target mean, build data set summing
 * to mean × count) and median (ensure middle element is clear). Mode uses a
 * single repeated value among otherwise unique values.
 *
 * @param params - Tier parameters: rangeA = value range, dataSetSize = count.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with question, correctAnswer, distractors, explanation.
 */
export function generateCentralTendency(params: GeneratorParams, rng: () => number): MathProblem {
  const count = params.dataSetSize ?? (params.rangeB?.[1] ?? 5);
  const valMin = params.rangeA[0];
  const valMax = params.rangeA[1];
  const dataMax = params.dataMax ?? valMax;

  // Cycle among the three measures based on rng
  const measureRoll = rng();
  const measure: 'mean' | 'median' | 'mode' =
    measureRoll < 0.33 ? 'mean' : measureRoll < 0.67 ? 'median' : 'mode';

  let values: number[];
  let answer: number;

  if (measure === 'mean') {
    // Construct backward: pick target mean, then build count-1 values and solve for last
    const target = randInt(rng, valMin, Math.min(valMax, dataMax));
    const others: number[] = [];
    for (let i = 0; i < count - 1; i++) {
      others.push(randInt(rng, valMin, Math.min(valMax, dataMax)));
    }
    const sumOthers = others.reduce((s, v) => s + v, 0);
    const last = target * count - sumOthers;
    // Clamp last to a reasonable value; if it falls out of range, recompute
    const clampedLast = Math.max(Math.min(last, dataMax * 2), -dataMax);
    values = shuffle([...others, clampedLast], rng);
    answer = target;

  } else if (measure === 'median') {
    // Generate a sorted array; median is the middle element (odd count) or average of two middles (even).
    // For simplicity always use odd count to get a clean integer median.
    const n = count % 2 === 0 ? count + 1 : count;
    const sorted: number[] = [];
    for (let i = 0; i < n; i++) {
      sorted.push(randInt(rng, valMin, Math.min(valMax, dataMax)));
    }
    sorted.sort((a, b) => a - b);
    answer = sorted[Math.floor(n / 2)];
    values = shuffle([...sorted], rng);

  } else {
    // Mode: pick a mode value, repeat it 2-3 times, fill rest with unique values
    const modeValue = randInt(rng, valMin, Math.min(valMax, dataMax));
    const repeatCount = randInt(rng, 2, Math.min(3, count - 1));
    const rest: number[] = [];
    const used = new Set<number>([modeValue]);
    while (rest.length < count - repeatCount) {
      const v = randInt(rng, valMin, Math.min(valMax, dataMax));
      if (!used.has(v)) {
        used.add(v);
        rest.push(v);
      }
      // Safety: if range is too narrow, allow duplicates
      if (rest.length + repeatCount >= count || used.size > valMax - valMin) break;
    }
    values = shuffle([...Array(repeatCount).fill(modeValue), ...rest], rng);
    answer = modeValue;
  }

  const valStr = values.join(', ');

  // Compute all three measures for alternates (used by distractor builder)
  const sortedVals = [...values].sort((a, b) => a - b);
  const meanVal = values.reduce((s, v) => s + v, 0) / values.length;
  const medianVal =
    sortedVals.length % 2 === 1
      ? sortedVals[Math.floor(sortedVals.length / 2)]
      : (sortedVals[sortedVals.length / 2 - 1] + sortedVals[sortedVals.length / 2]) / 2;

  // Find mode (most frequent value)
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  const maxFreq = Math.max(...freq.values());
  const modeVals = [...freq.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v);
  const modeVal = modeVals[0] ?? values[0];

  const alternates: Record<string, string> = {
    mean: fmtNum(meanVal),
    median: fmtNum(medianVal),
    mode: fmtNum(modeVal),
  };

  const correctAnswer = fmtNum(answer);
  const distractors = buildStatisticsDistractors(correctAnswer, measure, alternates, rng);

  let question: string;
  let explanation: string;

  if (measure === 'mean') {
    const sum = values.reduce((s, v) => s + v, 0);
    question = `Find the mean of: ${valStr}`;
    explanation = `Sum = ${sum}, Count = ${values.length}, Mean = ${sum} ÷ ${values.length} = ${correctAnswer}`;
  } else if (measure === 'median') {
    const sorted2 = [...values].sort((a, b) => a - b);
    question = `Find the median of: ${valStr}`;
    explanation = `Sorted: ${sorted2.join(', ')} → middle value = ${correctAnswer}`;
  } else {
    question = `Find the mode of: ${valStr}`;
    explanation = `The value that appears most often is ${correctAnswer}`;
  }

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 2: Standard Deviation ──────────────────────────────────────────

/**
 * Generates a population standard deviation problem.
 *
 * Computes std dev forward (generate values, compute σ = sqrt(Σ(xᵢ-μ)²/n)),
 * rounds to 1 decimal place. Distractors include variance (forgot sqrt),
 * mean, and numeric offsets.
 *
 * @param params - Tier parameters: dataSetSize = n, dataMax = upper bound.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with std dev answer to 1 decimal place.
 */
export function generateStandardDeviation(params: GeneratorParams, rng: () => number): MathProblem {
  const count = params.dataSetSize ?? 4;
  const dataMax = params.dataMax ?? params.rangeA[1];

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(randInt(rng, params.rangeA[0], dataMax));
  }

  const mean = values.reduce((s, v) => s + v, 0) / count;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / count;
  const stddev = Math.sqrt(variance);

  const valStr = values.join(', ');
  const correctAnswer = fmtNum(parseFloat(stddev.toFixed(1)));

  // Alternates: variance (forgot sqrt), mean
  const varianceStr = fmtNum(parseFloat(variance.toFixed(1)));
  const meanStr = fmtNum(parseFloat(mean.toFixed(1)));

  const alternates: Record<string, string> = {
    variance: varianceStr,
    mean: meanStr,
  };

  const distractors = buildStatisticsDistractors(correctAnswer, 'stddev', alternates, rng);

  const deviations = values.map(v => `(${v}-${fmtNum(mean)})²=${fmtNum((v - mean) ** 2)}`).join(', ');
  const explanation =
    `Mean = ${meanStr}, Deviations²: ${deviations}, ` +
    `Variance = ${varianceStr}, σ = √${varianceStr} ≈ ${correctAnswer}`;

  return {
    question: `Find the population standard deviation of: ${valStr}`,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 3: Basic Probability ───────────────────────────────────────────

/**
 * Generates a single-event probability problem using coins, dice, or cards.
 *
 * Answers are always simplified fractions ("1/2", "1/6", etc.).
 * Distractors include the complement fraction, unsimplified form, and
 * wrong numerator/denominator variants.
 *
 * @param params - Tier parameters: probabilityContext selects scenario pool.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with a fraction answer.
 */
export function generateBasicProbability(params: GeneratorParams, rng: () => number): MathProblem {
  const contexts = params.probabilityContext ?? ['coin', 'dice'];
  const context = randPick(rng, contexts);

  let question: string;
  let favorable: number;
  let total: number;
  let explanation: string;

  if (context === 'coin') {
    const scenario = randInt(rng, 1, 2);
    if (scenario === 1) {
      question = 'What is the probability of getting heads on a fair coin flip?';
      favorable = 1;
      total = 2;
      explanation = '1 head out of 2 possible outcomes';
    } else {
      question = 'What is the probability of getting heads twice in a row?';
      favorable = 1;
      total = 4;
      explanation = '1 favorable outcome (HH) out of 4 possible: HH, HT, TH, TT';
    }

  } else if (context === 'dice') {
    const scenario = randInt(rng, 1, 4);
    if (scenario === 1) {
      const face = randInt(rng, 1, 6);
      question = `What is the probability of rolling a ${face} on a fair six-sided die?`;
      favorable = 1;
      total = 6;
      explanation = `1 favorable face out of 6`;
    } else if (scenario === 2) {
      question = 'What is the probability of rolling an even number on a fair six-sided die?';
      favorable = 3;
      total = 6;
      explanation = '3 even numbers (2, 4, 6) out of 6 possible outcomes';
    } else if (scenario === 3) {
      question = 'What is the probability of rolling a number greater than 4 on a fair six-sided die?';
      favorable = 2;
      total = 6;
      explanation = '2 favorable outcomes (5 and 6) out of 6';
    } else {
      question = 'What is the probability of rolling a 1 or a 6 on a fair six-sided die?';
      favorable = 2;
      total = 6;
      explanation = '2 favorable outcomes (1 or 6) out of 6';
    }

  } else {
    // cards
    const scenario = randInt(rng, 1, 4);
    if (scenario === 1) {
      question = 'What is the probability of drawing a heart from a standard 52-card deck?';
      favorable = 13;
      total = 52;
      explanation = '13 hearts out of 52 cards';
    } else if (scenario === 2) {
      question = 'What is the probability of drawing a king from a standard 52-card deck?';
      favorable = 4;
      total = 52;
      explanation = '4 kings out of 52 cards';
    } else if (scenario === 3) {
      question = 'What is the probability of drawing a red card from a standard 52-card deck?';
      favorable = 26;
      total = 52;
      explanation = '26 red cards (hearts + diamonds) out of 52';
    } else {
      question = 'What is the probability of drawing an ace from a standard 52-card deck?';
      favorable = 4;
      total = 52;
      explanation = '4 aces out of 52 cards';
    }
  }

  const correctAnswer = simplifyFraction(favorable, total);
  const g = gcd(favorable, total);
  const sNum = favorable / g;
  const sDen = total / g;

  // Complement fraction: (total - favorable) / total, simplified
  const compNum = total - favorable;
  const complementStr = simplifyFraction(compNum, total);

  // Wrong numerator / wrong denominator distractors
  const wrongNum1 = simplifyFraction(sNum + 1, sDen);
  const wrongDen1 = simplifyFraction(sNum, sDen + 1);
  const wrongNum2 = simplifyFraction(Math.max(1, sNum - 1), sDen);

  const candidates = [complementStr, wrongNum1, wrongDen1, wrongNum2];
  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  explanation = `${explanation} = ${favorable}/${total} = ${correctAnswer}`;

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 4: Combinations & Permutations ──────────────────────────────────

/**
 * Generates a combinations or permutations problem.
 *
 * Randomly selects C(n,r) or P(n,r). Distractors always include the other
 * type (C when P is asked and vice versa), plus C/P(n, r±1) variants.
 *
 * @param params - Tier parameters: rangeA = n range, rangeB = r range.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer.
 */
export function generateCombinationsPermutations(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const nMin = params.rangeA[0];
  const nMax = params.rangeA[1];
  const rMin = params.rangeB[0];
  const rMax = params.rangeB[1];

  const n = randInt(rng, nMin, nMax);
  // r must be <= n
  const r = randInt(rng, rMin, Math.min(rMax, n));

  const isCombo = rng() < 0.5;

  const cResult = combinations(n, r);
  const pResult = permutations(n, r);

  // Variants for distractors
  const cAlt1 = r + 1 <= n ? combinations(n, r + 1) : combinations(n, r - 1);
  const pAlt1 = r + 1 <= n ? permutations(n, r + 1) : permutations(n, r - 1);

  let question: string;
  let answer: number;
  let explanation: string;
  let alternates: Record<string, string>;

  if (isCombo) {
    question = `How many ways can you choose ${r} items from ${n}? (Order does not matter)`;
    answer = cResult;
    explanation =
      `C(${n}, ${r}) = ${n}! / (${r}! × ${n - r}!) = ${cResult}`;
    alternates = {
      permutation: String(pResult),
      cAlt: String(cAlt1),
      pAlt: String(pAlt1),
    };
  } else {
    question = `How many ways can you arrange ${r} items from ${n}? (Order matters)`;
    answer = pResult;
    explanation =
      `P(${n}, ${r}) = ${n}! / ${n - r}! = ${pResult}`;
    alternates = {
      combination: String(cResult),
      cAlt: String(cAlt1),
      pAlt: String(pAlt1),
    };
  }

  const correctAnswer = String(answer);
  const measure = isCombo ? 'combination' : 'permutation';
  const distractors = buildStatisticsDistractors(correctAnswer, measure, alternates, rng);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Generator 5: Expected Value ───────────────────────────────────────────────

/**
 * Generates an expected value problem.
 *
 * Tier 1: equal probability — effectively just the mean of outcome values.
 * Tier 2+: weighted probabilities using fractions with a common denominator.
 * Constructs forward and rounds the answer to 1 decimal place.
 *
 * @param params - Tier parameters: dataSetSize = outcome count, rangeB = value range.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with the expected value answer.
 */
export function generateExpectedValue(params: GeneratorParams, rng: () => number): MathProblem {
  const outcomeCount = params.dataSetSize ?? 3;
  const valMin = params.rangeB[0];
  const valMax = params.rangeB[1];

  // Generate distinct outcome values
  const outcomeSet = new Set<number>();
  while (outcomeSet.size < outcomeCount) {
    outcomeSet.add(randInt(rng, valMin, valMax));
    // Safety: if range is too narrow, break early
    if (outcomeSet.size >= valMax - valMin + 1) break;
  }
  const outcomes = [...outcomeSet];

  // Decide probability style: use equal probabilities for simplicity
  // (produces clean results and is appropriate for all tiers)
  const denominator = outcomes.length;
  const probNumerators = outcomes.map(() => 1); // equal weights

  // Compute expected value: Σ(value × probability)
  let ev = 0;
  for (let i = 0; i < outcomes.length; i++) {
    ev += outcomes[i] * (probNumerators[i] / denominator);
  }
  ev = parseFloat(ev.toFixed(1));

  const correctAnswer = fmtNum(ev);

  // Build question text
  const outcomeDescs = outcomes
    .map((v, i) => `$${v} with probability ${simplifyFraction(probNumerators[i], denominator)}`)
    .join(', ');
  const question = `A game pays ${outcomeDescs}. What is the expected value?`;

  // Alternates: simple sum (forgot to weight), max, min
  const simpleSum = outcomes.reduce((s, v) => s + v, 0);
  const simpleSumStr = fmtNum(simpleSum);
  const maxVal = String(Math.max(...outcomes));
  const minVal = String(Math.min(...outcomes));
  const simpleMean = fmtNum(simpleSum / outcomes.length);

  const alternates: Record<string, string> = {
    sum: simpleSumStr,
    mean: simpleMean,
    max: maxVal,
    min: minVal,
  };

  const distractors = buildStatisticsDistractors(correctAnswer, 'expected_value', alternates, rng);

  const terms = outcomes
    .map((v, i) => `${v}×${simplifyFraction(probNumerators[i], denominator)}`)
    .join(' + ');
  const explanation = `E = ${terms} = ${correctAnswer}`;

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}
