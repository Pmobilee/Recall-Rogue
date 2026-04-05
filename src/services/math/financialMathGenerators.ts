/**
 * Procedural financial math problem generators.
 *
 * Five generator functions covering simple interest, compound interest,
 * straight-line depreciation, markup/discount, and sales tax calculations.
 *
 * All generators produce integer or clean decimal answers and use the
 * "construct backward" strategy where possible — pick the answer first,
 * then build the problem — to guarantee clean results.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem.
 *
 * Source files: src/services/math/financialMathGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, dedupeDistractors } from './mathUtils';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Format a number as a dollar string with no decimals if whole,
 * or 2 decimal places otherwise.
 */
function fmtDollars(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

/**
 * Round n to the nearest integer.
 */
function roundInt(n: number): number {
  return Math.round(n);
}

// ── Generator 1: Simple Interest ──────────────────────────────────────────────

/**
 * Generates a simple interest problem: I = P × r × t
 *
 * Uses forward construction — pick P (multiple of 100), r from a clean rate
 * pool, t from rangeB. Computes I = P * r * t. All results are integers
 * because P is a multiple of 100 and rates are selected to produce clean
 * multiples when multiplied.
 *
 * @param params - Tier parameters: rangeA = principal range (min/max as
 *                 multiples-of-100 bounds), rangeB = time range in years.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem asking for the interest earned.
 */
export function generateSimpleInterest(params: GeneratorParams, rng: () => number): MathProblem {
  const RATES = [0.05, 0.08, 0.10, 0.12, 0.15];

  // Pick principal as a multiple of 100 in [rangeA[0], rangeA[1]]
  const pMin = Math.max(100, Math.ceil(params.rangeA[0] / 100) * 100);
  const pMax = Math.floor(params.rangeA[1] / 100) * 100;
  const pSteps = Math.floor((pMax - pMin) / 100);
  const P = pMin + randInt(rng, 0, Math.max(pSteps, 0)) * 100;

  const r = randPick(rng, RATES);
  const t = randInt(rng, params.rangeB[0], params.rangeB[1]);

  const I = roundInt(P * r * t);
  const total = P + I;

  const rPct = Math.round(r * 100);
  const question = `You invest $${P} at ${rPct}% simple interest for ${t} year${t !== 1 ? 's' : ''}. How much interest do you earn?`;
  const correctAnswer = String(I);

  // Distractors: total (P+I confusion), double interest, interest for 1 year, P*r alone
  const singleYearI = roundInt(P * r);
  const candidates = [
    String(total),           // mistakenly added principal
    String(I * 2),           // doubled
    String(singleYearI),     // forgot t
    String(roundInt(P * r * t * 1.1)), // off-by-rate
    String(I + 10),
    String(Math.max(I - 10, 1)),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation: `I = P × r × t = $${P} × ${rPct}% × ${t} = $${P} × ${r} × ${t} = $${I}`,
    inputMode: 'choice',
  };
}

// ── Generator 2: Compound Interest ───────────────────────────────────────────

/**
 * Generates a compound interest problem: A = P(1 + r/n)^(nt)
 *
 * Tier 1: annual compounding (n=1), P ∈ {100, 200, 500, 1000}, r=10%, t=1-2.
 * Tier 2a: annual, r=10% or 20%, t=1-3.
 * Tier 2b: semi-annual (n=2), select P/r/t for clean results.
 * Tier 3: quarterly (n=4), round to nearest integer.
 *
 * Tier is inferred from rangeB[1]: 2→T1, 3→T2a, 4→T2b, else T3.
 *
 * @param params - rangeA = principal range, rangeB = time range.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem asking for the final amount after compounding.
 */
export function generateCompoundInterest(params: GeneratorParams, rng: () => number): MathProblem {
  const PRINCIPALS = [100, 200, 500, 1000];

  // Determine compounding frequency from rangeB[1]
  const tMax = params.rangeB[1];
  let n: number;
  let freqLabel: string;
  let r: number;

  if (tMax <= 2) {
    n = 1; freqLabel = 'annually'; r = 0.10;
  } else if (tMax <= 3) {
    n = 1; freqLabel = 'annually';
    r = randPick(rng, [0.10, 0.20]);
  } else if (tMax <= 4) {
    n = 2; freqLabel = 'semi-annually';
    r = randPick(rng, [0.10, 0.20]);
  } else {
    n = 4; freqLabel = 'quarterly';
    r = randPick(rng, [0.08, 0.12]);
  }

  const P = randPick(rng, PRINCIPALS.filter(p => p >= params.rangeA[0] && p <= params.rangeA[1]));
  const t = randInt(rng, params.rangeB[0], params.rangeB[1]);

  // A = P * (1 + r/n)^(n*t)
  const A = roundInt(P * Math.pow(1 + r / n, n * t));

  // Simple interest amount (incorrect — forgot compounding)
  const simpleA = roundInt(P * (1 + r * t));
  // Flat growth (only 1 year applied)
  const flatA = roundInt(P * (1 + r));
  // Wrong: using r instead of r/n inside the formula
  const wrongA = roundInt(P * Math.pow(1 + r, n * t));

  const rPct = Math.round(r * 100);
  const question = `You invest $${P} at ${rPct}% compounded ${freqLabel} for ${t} year${t !== 1 ? 's' : ''}. What is the final amount?`;
  const correctAnswer = String(A);

  const candidates = [
    String(simpleA),
    String(flatA),
    String(wrongA),
    String(A + 10),
    String(Math.max(A - 10, P + 1)),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  const formula = n === 1
    ? `A = ${P} × (1 + ${r})^${t}`
    : `A = ${P} × (1 + ${r}/${n})^(${n}×${t})`;

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation: `${formula} = $${A}`,
    inputMode: 'choice',
  };
}

// ── Generator 3: Straight-Line Depreciation ───────────────────────────────────

/**
 * Generates a straight-line depreciation problem: V = P - (P × rate × t)
 *
 * Picks P (multiple of 100 in rangeA), rate from {0.10, 0.15, 0.20, 0.25},
 * t from rangeB. Guards that V > 0 by clamping t < 1/rate.
 *
 * @param params - rangeA = initial asset value range, rangeB = years range.
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem asking for the asset value after t years.
 */
export function generateDepreciation(params: GeneratorParams, rng: () => number): MathProblem {
  const RATES = [0.10, 0.15, 0.20, 0.25];

  const pMin = Math.max(100, Math.ceil(params.rangeA[0] / 100) * 100);
  const pMax = Math.floor(params.rangeA[1] / 100) * 100;
  const pSteps = Math.floor((pMax - pMin) / 100);
  const P = pMin + randInt(rng, 0, Math.max(pSteps, 0)) * 100;

  const rate = randPick(rng, RATES);

  // Clamp t so V = P - P*rate*t > 0 → t < 1/rate
  const maxT = Math.min(params.rangeB[1], Math.floor(1 / rate) - 1);
  const tMin = params.rangeB[0];
  const t = randInt(rng, tMin, Math.max(tMin, maxT));

  const deprAmt = roundInt(P * rate * t);
  const V = P - deprAmt;

  const ratePct = Math.round(rate * 100);
  const question = `A $${P} asset depreciates at ${ratePct}% per year. What is its value after ${t} year${t !== 1 ? 's' : ''}?`;
  const correctAnswer = String(V);

  // Distractors
  const oneYearV = roundInt(P * (1 - rate));   // only 1 year applied
  const totalDepr = deprAmt;                   // depreciation amount instead of value
  const wrongV = roundInt(P * Math.pow(1 - rate, t)); // geometric (wrong model)

  const candidates = [
    String(totalDepr),     // confused depr amount with remaining value
    String(oneYearV),      // only 1 year applied
    String(wrongV),        // geometric model error
    String(V + roundInt(P * rate)), // off by one year
    String(Math.max(V - roundInt(P * rate), 1)),
  ];

  const distractors = dedupeDistractors(candidates, correctAnswer, 4);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation: `V = P - (P × rate × t) = $${P} - ($${P} × ${rate} × ${t}) = $${P} - $${deprAmt} = $${V}`,
    inputMode: 'choice',
  };
}

// ── Generator 4: Markup & Discount ────────────────────────────────────────────

/**
 * Generates a markup or discount problem.
 *
 * Markup: final = cost × (1 + pct/100)
 * Discount: final = price × (1 - pct/100)
 * Tier 2b+: successive discounts — price × (1-d1) × (1-d2)
 *
 * rangeB[1] >= 4 signals successive-discount tier.
 *
 * @param params - rangeA = price/cost range, rangeB = rate range (use [1,3]
 *                 for basic, [3,5] for successive-discount tier).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem asking for the final price.
 */
export function generateMarkupDiscount(params: GeneratorParams, rng: () => number): MathProblem {
  const SINGLE_PCTS = [10, 15, 20, 25, 30, 40, 50];
  const SUCC_PCTS   = [10, 20, 25];

  // Multiple of 10 price in rangeA
  const priceMin = Math.max(10, Math.ceil(params.rangeA[0] / 10) * 10);
  const priceMax = Math.floor(params.rangeA[1] / 10) * 10;
  const priceSteps = Math.floor((priceMax - priceMin) / 10);
  const base = priceMin + randInt(rng, 0, Math.max(priceSteps, 0)) * 10;

  const isSuccessive = params.rangeB[1] >= 4;
  const isMarkup = rng() < 0.5;

  let question: string;
  let correctAnswer: string;
  let adjustmentAmt: number;
  let final: number;

  if (isSuccessive && !isMarkup) {
    // Successive discounts
    const d1 = randPick(rng, SUCC_PCTS);
    const d2 = randPick(rng, SUCC_PCTS);
    final = roundInt(base * (1 - d1 / 100) * (1 - d2 / 100));
    const combinedEffective = roundInt(base - final);
    question = `A $${base} item gets a ${d1}% discount, then another ${d2}% discount. What is the final price?`;
    correctAnswer = String(final);

    // Distractors: adding discounts (wrong), applying only first, simple (d1+d2)% off
    const simpleOff = roundInt(base * (1 - (d1 + d2) / 100));
    const firstOnly = roundInt(base * (1 - d1 / 100));
    const candidates = [
      String(simpleOff),
      String(firstOnly),
      String(combinedEffective),       // amount off vs final price
      String(final + roundInt(base * (d2 / 100))),
    ];
    const distractors = dedupeDistractors(candidates, correctAnswer, 4);

    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation: `After ${d1}%: $${firstOnly}. After another ${d2}%: $${firstOnly} × ${1 - d2 / 100} = $${final}`,
      inputMode: 'choice',
    };
  }

  const pct = randPick(rng, SINGLE_PCTS);
  adjustmentAmt = roundInt(base * pct / 100);

  if (isMarkup) {
    final = base + adjustmentAmt;
    question = `A $${base} item has a ${pct}% markup. What is the selling price?`;
    correctAnswer = String(final);

    const candidates = [
      String(adjustmentAmt),                   // markup amount only
      String(base - adjustmentAmt),            // subtracted instead of added
      String(roundInt(base * (1 + pct / 100 + 0.1))), // off rate
      String(final + 10),
    ];
    const distractors = dedupeDistractors(candidates, correctAnswer, 4);

    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation: `Markup = $${base} × ${pct}% = $${adjustmentAmt}. Selling price = $${base} + $${adjustmentAmt} = $${final}`,
      inputMode: 'choice',
    };
  } else {
    final = base - adjustmentAmt;
    question = `A $${base} item is discounted by ${pct}%. What is the sale price?`;
    correctAnswer = String(final);

    const candidates = [
      String(adjustmentAmt),                   // discount amount only
      String(base + adjustmentAmt),            // added instead of subtracted
      String(roundInt(base * (1 - pct / 100 - 0.05))), // off rate
      String(final - 5),
    ];
    const distractors = dedupeDistractors(candidates, correctAnswer, 4);

    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation: `Discount = $${base} × ${pct}% = $${adjustmentAmt}. Sale price = $${base} - $${adjustmentAmt} = $${final}`,
      inputMode: 'choice',
    };
  }
}

// ── Generator 5: Tax Calculation ──────────────────────────────────────────────

/**
 * Generates a sales tax problem.
 *
 * Tier 1: "What is the total price including tax?" — price × (1 + rate)
 * Tier 2a: "How much tax on a $X purchase?" — price × rate
 * Tier 2b: "The total with tax is $T. Tax rate is R%. What was pre-tax price?" — T/(1+rate)
 * Tier 3: Multi-item — two items with same tax rate, total with tax.
 *
 * Tier is inferred from rangeB[1]: 1→T1, 2→T2a, 3→T2b, else T3.
 *
 * @param params - rangeA = base price range (multiples of 10), rangeB = tax
 *                 rate range (inferred by rangeB[1] for tier selection).
 * @param rng    - Seeded PRNG.
 * @returns A MathProblem with an integer answer.
 */
export function generateTaxCalculation(params: GeneratorParams, rng: () => number): MathProblem {
  const TAX_RATES = [5, 6, 7, 8, 9, 10, 15, 20];

  const priceMin = Math.max(10, Math.ceil(params.rangeA[0] / 10) * 10);
  const priceMax = Math.floor(params.rangeA[1] / 10) * 10;
  const priceSteps = Math.floor((priceMax - priceMin) / 10);

  const tierSignal = params.rangeB[1];

  if (tierSignal <= 1) {
    // Tier 1: total including tax
    const price = priceMin + randInt(rng, 0, Math.max(priceSteps, 0)) * 10;
    const rate = randPick(rng, TAX_RATES);
    const taxAmt = roundInt(price * rate / 100);
    const total = price + taxAmt;

    const question = `A $${price} purchase has a ${rate}% sales tax. What is the total price including tax?`;
    const correctAnswer = String(total);

    const candidates = [
      String(taxAmt),              // tax amount only
      String(price),               // forgot tax
      String(total + 5),
      String(Math.max(total - 5, price + 1)),
    ];
    const distractors = dedupeDistractors(candidates, correctAnswer, 4);

    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation: `Tax = $${price} × ${rate}% = $${taxAmt}. Total = $${price} + $${taxAmt} = $${total}`,
      inputMode: 'choice',
    };

  } else if (tierSignal <= 2) {
    // Tier 2a: how much tax?
    const price = priceMin + randInt(rng, 0, Math.max(priceSteps, 0)) * 10;
    const rate = randPick(rng, TAX_RATES);
    const taxAmt = roundInt(price * rate / 100);
    const total = price + taxAmt;

    const question = `How much sales tax is charged on a $${price} purchase at a ${rate}% tax rate?`;
    const correctAnswer = String(taxAmt);

    const candidates = [
      String(total),               // total instead of tax
      String(taxAmt * 2),
      String(Math.max(taxAmt - 5, 1)),
      String(taxAmt + 10),
    ];
    const distractors = dedupeDistractors(candidates, correctAnswer, 4);

    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation: `Tax = $${price} × ${rate}% = $${price} × ${rate / 100} = $${taxAmt}`,
      inputMode: 'choice',
    };

  } else if (tierSignal <= 3) {
    // Tier 2b: reverse — find pre-tax price from total
    // Construct backward: pick pretax, rate, compute total
    const preTax = priceMin + randInt(rng, 0, Math.max(priceSteps, 0)) * 10;
    const rate = randPick(rng, [10, 20, 25]); // rates that divide cleanly
    const taxAmt = roundInt(preTax * rate / 100);
    const total = preTax + taxAmt;

    const question = `The total price including ${rate}% tax is $${total}. What was the pre-tax price?`;
    const correctAnswer = String(preTax);

    const candidates = [
      String(total),               // total itself
      String(taxAmt),              // tax amount only
      String(total - taxAmt * 2),  // over-subtracted
      String(preTax + 10),
    ];
    const distractors = dedupeDistractors(candidates, correctAnswer, 4);

    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation: `Pre-tax = Total ÷ (1 + rate) = $${total} ÷ ${1 + rate / 100} = $${preTax}`,
      inputMode: 'choice',
    };

  } else {
    // Tier 3: two items, same tax rate
    const price1 = priceMin + randInt(rng, 0, Math.max(Math.floor(priceSteps / 2), 0)) * 10;
    const price2 = priceMin + randInt(rng, 0, Math.max(Math.floor(priceSteps / 2), 0)) * 10;
    const rate = randPick(rng, TAX_RATES);
    const combined = price1 + price2;
    const taxAmt = roundInt(combined * rate / 100);
    const total = combined + taxAmt;

    const question = `You buy a $${price1} item and a $${price2} item. With ${rate}% sales tax, what is the total?`;
    const correctAnswer = String(total);

    const candidates = [
      String(combined),            // forgot tax
      String(taxAmt),              // tax only
      String(total + 10),
      String(Math.max(total - 10, combined + 1)),
    ];
    const distractors = dedupeDistractors(candidates, correctAnswer, 4);

    return {
      question,
      correctAnswer,
      acceptableAlternatives: [],
      distractors,
      explanation: `Subtotal = $${price1} + $${price2} = $${combined}. Tax = $${combined} × ${rate}% = $${taxAmt}. Total = $${combined} + $${taxAmt} = $${total}`,
      inputMode: 'choice',
    };
  }
}
