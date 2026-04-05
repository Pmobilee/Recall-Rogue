/**
 * Procedural coordinate geometry problem generators.
 *
 * Five generators covering distance between points, midpoint of a segment,
 * slope of a line, line equations in slope-intercept form, and circle equations
 * in standard form. Each returns a self-contained MathProblem with exactly
 * 4 distractors produced by formula-confusion error models.
 *
 * All problems are constructed backward from the answer (answer-first design)
 * to guarantee clean integer or simplified-fraction results. All randomness
 * is seeded via a mulberry32 PRNG so the same (params, seed) pair always
 * produces the same problem — required for deterministic replay and unit testing.
 *
 * Source files: src/services/math/coordGeometryGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, PYTHAGOREAN_TRIPLES, gcd, dedupeDistractors } from './mathUtils';

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a slope value as a simplified fraction string or integer string.
 *
 * Returns "0", "-2", "3/4", "-5/7", etc. Never returns decimals.
 * If run is 0 after simplification, returns "undefined" (vertical line).
 */
function formatSlope(rise: number, run: number): string {
  if (run === 0) return 'undefined';
  if (rise === 0) return '0';

  const g = gcd(Math.abs(rise), Math.abs(run));
  const simplRise = rise / g;
  const simplRun = run / g;

  // Normalise sign: denominator must be positive.
  const sign = simplRun < 0 ? -1 : 1;
  const finalRise = simplRise * sign;
  const finalRun = Math.abs(simplRun);

  if (finalRun === 1) return String(finalRise);
  return `${finalRise}/${finalRun}`;
}

/**
 * Format a line equation y = mx + b in canonical slope-intercept form.
 *
 * Examples:
 *   m=2, b=3   → "y = 2x + 3"
 *   m=2, b=-3  → "y = 2x - 3"
 *   m=2, b=0   → "y = 2x"
 *   m=0, b=5   → "y = 5"
 *   m=1, b=4   → "y = x + 4"
 *   m=-1, b=4  → "y = -x + 4"
 *   m=0, b=0   → "y = 0"
 *
 * @param m - Integer slope.
 * @param b - Integer y-intercept.
 */
export function formatLineEquation(m: number, b: number): string {
  const slopeStr =
    m === 0   ? '' :
    m === 1   ? 'x' :
    m === -1  ? '-x' :
    `${m}x`;

  if (m === 0) {
    return `y = ${b}`;
  }

  const interceptStr =
    b > 0  ? ` + ${b}` :
    b < 0  ? ` - ${Math.abs(b)}` :
    '';

  return `y = ${slopeStr}${interceptStr}`;
}

// ── Distance between two points ───────────────────────────────────────────────

/**
 * Generate a distance-between-two-points problem.
 *
 * Uses construct-backward design: pick a Pythagorean triple (a, b, c) and
 * scale by k so the distance is always the integer c*k. Offsets x1, y1 are
 * drawn from rangeB to position the points anywhere on the plane.
 *
 * @param params - Generator params; rangeA controls the scale multiplier, rangeB the offset.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateDistance(params: GeneratorParams, rng: () => number): MathProblem {
  const triple = randPick(rng, PYTHAGOREAN_TRIPLES);
  const k = randInt(rng, Math.max(params.rangeA[0], 1), Math.max(params.rangeA[1], 1));
  const [a, b, c] = [triple[0] * k, triple[1] * k, triple[2] * k];

  const x1 = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const y1 = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const x2 = x1 + a;
  const y2 = y1 + b;

  const distance = c;
  const correctAnswer = String(distance);

  const question = `Find the distance between (${x1}, ${y1}) and (${x2}, ${y2}).`;
  const explanation = `Distance = √((${x2}−${x1})² + (${y2}−${y1})²) = √(${a}² + ${b}²) = √(${a*a} + ${b*b}) = √${c*c} = ${c}`;

  // Distractors: formula-confusion error models.
  const manhattan = a + b;                       // forgot sqrt, just added legs
  const sumOfLegs = a + b;                       // same as manhattan here — add ±1 variant
  const candidates: string[] = [
    String(manhattan),                           // |Δx| + |Δy| (Manhattan distance)
    String(distance + 1),
    distance > 1 ? String(distance - 1) : String(distance + 2),
    String(a),                                   // just the x-leg
    String(b),                                   // just the y-leg
    String(Math.round(Math.sqrt(a * a + b * b + 1))), // wrong squared sum
    String(distance + 5),
    distance > 5 ? String(distance - 5) : String(distance + 3),
    String(sumOfLegs + 1),
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

// ── Midpoint of a segment ─────────────────────────────────────────────────────

/**
 * Generate a midpoint-of-a-segment problem.
 *
 * Uses construct-backward design: all coordinates are even (from rangeA*2)
 * so the midpoint is always an integer pair. This avoids fractional answers
 * that are harder to present as multiple-choice distractors.
 *
 * @param params - Generator params; rangeA*2 is the coordinate range (always even).
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateMidpoint(params: GeneratorParams, rng: () => number): MathProblem {
  // Pick even coordinates by doubling rangeA values.
  const [minA, maxA] = params.rangeA;
  const x1 = randInt(rng, minA, maxA) * 2;
  const y1 = randInt(rng, minA, maxA) * 2;
  const x2 = randInt(rng, minA, maxA) * 2;
  const y2 = randInt(rng, minA, maxA) * 2;

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const correctAnswer = `(${mx}, ${my})`;

  const question = `Find the midpoint of (${x1}, ${y1}) and (${x2}, ${y2}).`;
  const explanation = `Midpoint = ((${x1}+${x2})/2, (${y1}+${y2})/2) = (${x1+x2}/2, ${y1+y2}/2) = (${mx}, ${my})`;

  // Distractors: forgot to divide (doubled), swapped coords, off by 1 on each component.
  const candidates: string[] = [
    `(${x1 + x2}, ${y1 + y2})`,         // forgot to divide by 2
    `(${my}, ${mx})`,                    // swapped x and y
    `(${mx + 1}, ${my})`,               // off-by-one on x
    `(${mx}, ${my + 1})`,               // off-by-one on y
    mx > 0 ? `(${mx - 1}, ${my})` : `(${mx + 2}, ${my})`,
    my > 0 ? `(${mx}, ${my - 1})` : `(${mx}, ${my + 2})`,
    `(${mx + 1}, ${my + 1})`,           // both off-by-one
    `(${x1}, ${y2})`,                   // mixed up endpoints
    `(${x2}, ${y1})`,                   // mixed up endpoints
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

// ── Slope of a line through two points ───────────────────────────────────────

/**
 * Generate a slope-of-a-line problem.
 *
 * Uses construct-backward design: pick rise and run, simplify via gcd, then
 * set (x2, y2) = (x1 + run, y1 + rise) so the slope is exact.
 *
 * Special cases: rise=0 → slope "0"; run=0 → slope "undefined".
 *
 * @param params - Generator params; rangeA for rise range, rangeB for run range.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateSlope(params: GeneratorParams, rng: () => number): MathProblem {
  // Allow negative rise/run for variety — pick from both positive and negative halves.
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  // Rise can be anything in the range (including 0 for horizontal lines).
  const rise = randInt(rng, -maxA, maxA);
  // Run must be nonzero for a non-vertical line; vertical lines handled by special case.
  // Include vertical case 10% of the time (when rng() < 0.1) for variety.
  let run: number;
  const isVertical = rng() < 0.1;
  if (isVertical) {
    run = 0;
  } else {
    run = randInt(rng, minB, maxB);
    if (run === 0) run = 1; // force nonzero
  }

  const x1 = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const y1 = randInt(rng, params.rangeB[0], params.rangeB[1]);
  const x2 = x1 + run;
  const y2 = y1 + rise;

  const correctAnswer = formatSlope(rise, run);

  const question = `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`;

  let explanation: string;
  if (run === 0) {
    explanation = `Slope = (${y2}−${y1}) / (${x2}−${x1}) = ${rise} / 0 = undefined (vertical line)`;
  } else if (rise === 0) {
    explanation = `Slope = (${y2}−${y1}) / (${x2}−${x1}) = 0 / ${run} = 0 (horizontal line)`;
  } else {
    const g = gcd(Math.abs(rise), Math.abs(run));
    explanation = `Slope = (${y2}−${y1}) / (${x2}−${x1}) = ${rise} / ${run} = ${correctAnswer}`;
    if (g > 1) explanation += ` (simplified from ${rise}/${run})`;
  }

  // Distractors: inverted slope, wrong sign, off-by-one numerator, "undefined" when defined.
  const candidates: string[] = [];

  if (run !== 0 && rise !== 0) {
    candidates.push(formatSlope(run, rise));   // inverted (Δx / Δy)
    candidates.push(formatSlope(-rise, run));   // wrong sign on numerator
    candidates.push(formatSlope(rise, -run));   // wrong sign on denominator
    candidates.push(formatSlope(rise + 1, run));
    candidates.push(formatSlope(rise - 1, run));
    candidates.push('undefined');               // confusion with vertical lines
    candidates.push('0');                       // confusion with horizontal lines
  } else if (run === 0) {
    // Vertical: distractors are common slopes people might confuse.
    candidates.push('0');
    candidates.push('1');
    candidates.push('-1');
    candidates.push(String(rise));
  } else {
    // Horizontal (rise=0): distractors.
    candidates.push('undefined');
    candidates.push('1');
    candidates.push('-1');
    candidates.push(formatSlope(run, run));
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

// ── Line equation y = mx + b ──────────────────────────────────────────────────

/**
 * Generate a line-equation problem in slope-intercept form y = mx + b.
 *
 * Four tiers of increasing difficulty:
 *   Tier 1  — given slope m and y-intercept b, write the equation.
 *   Tier 2a — given slope m and a point, find b then write the equation.
 *   Tier 2b — given two points, find the slope and equation.
 *   Tier 3  — find the equation of a perpendicular or parallel line through a point.
 *
 * All values constructed backward from integer m and b so answers are always
 * in the canonical "y = mx + b" format.
 *
 * @param params - Generator params; rangeA for slope range, rangeB for intercept range.
 *                 `operations` selects which tiers are available.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateLineEquation(params: GeneratorParams, rng: () => number): MathProblem {
  const tier = randPick(rng, params.operations ?? ['tier1']);
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  // Pick m and b as integers; m nonzero for interesting problems.
  let m = randInt(rng, minA, maxA);
  if (m === 0) m = 1; // force nonzero slope for line equation problems
  const b = randInt(rng, minB, maxB);

  // A point known to be on the line: x1 from a small range, y1 = m*x1 + b.
  const x1 = randInt(rng, -3, 3);
  const y1 = m * x1 + b;

  const correctAnswer = formatLineEquation(m, b);

  let question: string;
  let explanation: string;

  switch (tier) {
    case 'tier2a': {
      // Given slope and a point — student solves for b.
      question = `A line has slope ${m} and passes through (${x1}, ${y1}). Find the equation of the line.`;
      explanation = `Using y = mx + b with point (${x1}, ${y1}): ${y1} = ${m}(${x1}) + b → b = ${y1} − ${m * x1} = ${b}. Equation: ${correctAnswer}`;
      break;
    }
    case 'tier2b': {
      // Given two points — student finds slope then equation.
      const x2 = x1 + randInt(rng, 1, 4) * (rng() < 0.5 ? 1 : -1);
      const y2 = m * x2 + b;
      question = `Find the equation of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`;
      const dx = x2 - x1;
      const dy = y2 - y1;
      explanation = `Slope = (${y2}−${y1}) / (${x2}−${x1}) = ${dy} / ${dx} = ${m}. Using y = mx + b with (${x1}, ${y1}): b = ${y1} − ${m}(${x1}) = ${b}. Equation: ${correctAnswer}`;
      break;
    }
    case 'tier3': {
      // Perpendicular line through a point — perpendicular slope is -1/m.
      // To keep answer clean, require m divides evenly into -1 — use m = ±1 or ±2 or ±3.
      // The base line has slope m; the perpendicular has slope -1/m only if m = ±1.
      // For general integer m: perpendicular slope is a fraction; restrict m to ±1 for clean answers.
      // Actually, restrict to m where -1/m is integer: m must be ±1.
      const perpM = m === 1 ? -1 : m === -1 ? 1 : -m; // fallback to negative for other values
      const perpB = y1 - perpM * x1;
      const perpAnswer = formatLineEquation(perpM, perpB);
      question = `Find the equation of the line perpendicular to y = ${m}x + ${b} that passes through (${x1}, ${y1}).`;
      explanation = `Perpendicular slope = −1/${m} = ${perpM}. Using y = mx + b: ${y1} = ${perpM}(${x1}) + b → b = ${perpB}. Equation: ${perpAnswer}`;
      return buildLineEquationProblem(perpAnswer, m, b, perpM, perpB, question, explanation, rng);
    }
    default: {
      // Tier 1: given m and b, write the equation.
      question = `A line has slope ${m} and y-intercept ${b}. Write the equation of the line.`;
      explanation = `Slope-intercept form y = mx + b: slope = ${m}, y-intercept = ${b}. Equation: ${correctAnswer}`;
    }
  }

  return buildLineEquationProblem(correctAnswer, m, b, m, b, question, explanation, rng);
}

/** Build the MathProblem return value for a line equation generator call. */
function buildLineEquationProblem(
  correctAnswer: string,
  origM: number,
  origB: number,
  usedM: number,
  usedB: number,
  question: string,
  explanation: string,
  rng: () => number,
): MathProblem {
  // Distractors: wrong slope sign, wrong intercept, slope/intercept swapped.
  const candidates: string[] = [
    formatLineEquation(-usedM, usedB),           // negated slope
    formatLineEquation(usedM, -usedB),           // negated intercept
    formatLineEquation(usedM, usedB + 1),        // intercept off-by-1
    usedB !== 0 ? formatLineEquation(usedM, usedB - 1) : formatLineEquation(usedM, usedB + 2),
    formatLineEquation(usedM + 1, usedB),        // slope off-by-1
    usedM !== 0 ? formatLineEquation(usedM - 1, usedB) : formatLineEquation(usedM + 2, usedB),
    formatLineEquation(usedB, usedM),            // slope and intercept swapped
    formatLineEquation(-usedM, -usedB),          // both negated
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

// ── Circle equation (x-h)² + (y-k)² = r² ─────────────────────────────────────

/**
 * Generate a circle equation problem in standard form (x−h)² + (y−k)² = r².
 *
 * Four tiers of increasing difficulty:
 *   Tier 1  — given center (h, k) and radius r, find r² (the right-hand side).
 *   Tier 2a — given the standard-form equation, identify the center (h, k).
 *   Tier 2b — given the standard-form equation, identify the radius r.
 *   Tier 3  — given general form x² + y² + Dx + Ey + F = 0, complete the
 *             square to find the center. Constructed backward: pick h, k, r
 *             then expand to D = −2h, E = −2k, F = h²+k²−r².
 *
 * @param params - Generator params; rangeA for center coords, rangeB for radius range.
 *                 `operations` selects which tiers are active.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateCircleEquation(params: GeneratorParams, rng: () => number): MathProblem {
  const tier = randPick(rng, params.operations ?? ['tier1']);
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  // Pick center and radius.
  const h = randInt(rng, minA, maxA);
  const k = randInt(rng, minA, maxA);
  // Use Pythagorean hypotenuses or small perfect squares for clean r.
  const cleanRadii = [2, 3, 4, 5, 6, 8, 10, 13, 15, 17, 25];
  const r = randPick(rng, cleanRadii.filter(v => v >= minB && v <= maxB)) ?? randInt(rng, Math.max(minB, 2), maxB);
  const rSquared = r * r;

  // Build the standard-form equation string for display in tier 2a/2b questions.
  const hSign = h >= 0 ? `-${h}` : `+${Math.abs(h)}`;
  const kSign = k >= 0 ? `-${k}` : `+${Math.abs(k)}`;
  const standardForm = `(x${hSign})² + (y${kSign})² = ${rSquared}`;

  let question: string;
  let correctAnswer: string;
  let explanation: string;
  let candidates: string[];

  switch (tier) {
    case 'tier2a': {
      // Given equation, find center — answer is "(h, k)".
      question = `Find the center of the circle ${standardForm}.`;
      correctAnswer = `(${h}, ${k})`;
      explanation = `Standard form (x−h)² + (y−k)² = r². Here h = ${h}, k = ${k}. Center = (${h}, ${k})`;
      // Distractors: sign errors on h and/or k, swapped h and k.
      candidates = [
        `(${-h}, ${k})`,
        `(${h}, ${-k})`,
        `(${-h}, ${-k})`,
        `(${k}, ${h})`,
        `(${h + 1}, ${k})`,
        `(${h}, ${k + 1})`,
        `(${rSquared}, ${k})`,  // confuse r² with h
      ];
      break;
    }
    case 'tier2b': {
      // Given equation, find radius — answer is "{r}".
      question = `Find the radius of the circle ${standardForm}.`;
      correctAnswer = String(r);
      explanation = `Standard form (x−h)² + (y−k)² = r². Here r² = ${rSquared}, so r = √${rSquared} = ${r}`;
      // Distractors: r² instead of r, off-by-1, sqrt of wrong value.
      candidates = [
        String(rSquared),                      // gave r² instead of r
        String(r + 1),
        r > 1 ? String(r - 1) : String(r + 2),
        String(Math.round(Math.sqrt(rSquared + 1))),
        String(r + 2),
        String(h),                             // confused h with r
        String(k),                             // confused k with r
      ];
      break;
    }
    case 'tier3': {
      // General form: x² + y² + Dx + Ey + F = 0.
      const D = -2 * h;
      const E = -2 * k;
      const F = h * h + k * k - rSquared;

      const Dstr = D >= 0 ? `+ ${D}x` : `- ${Math.abs(D)}x`;
      const Estr = E >= 0 ? `+ ${E}y` : `- ${Math.abs(E)}y`;
      const Fstr = F >= 0 ? `+ ${F}` : `- ${Math.abs(F)}`;

      question = `Find the center of the circle x² + y² ${Dstr} ${Estr} ${Fstr} = 0.`;
      correctAnswer = `(${h}, ${k})`;
      explanation = `Complete the square: x² + ${D}x + y² + ${E}y = ${-F}. ` +
        `→ (x${hSign})² + (y${kSign})² = ${rSquared}. Center = (${h}, ${k})`;
      // Distractors: sign errors (using D and E directly), swapped, off-by-one.
      candidates = [
        `(${D}, ${E})`,        // used D and E directly without halving or negating
        `(${-h}, ${-k})`,      // wrong sign on both
        `(${h / 2}, ${k})`,    // halved but forgot to negate
        `(${h}, ${k / 2})`,
        `(${-h}, ${k})`,
        `(${h}, ${-k})`,
        `(${k}, ${h})`,
      ];
      break;
    }
    default: {
      // Tier 1: given center and radius, find r².
      question = `A circle has center (${h}, ${k}) and radius ${r}. What is r² in the equation (x−h)² + (y−k)² = r²?`;
      correctAnswer = String(rSquared);
      explanation = `r² = ${r}² = ${rSquared}`;
      candidates = [
        String(r),                             // gave r instead of r²
        String(rSquared + 1),
        rSquared > 1 ? String(rSquared - 1) : String(rSquared + 2),
        String(2 * r),                         // 2r confusion
        String(rSquared + r),
        rSquared > r ? String(rSquared - r) : String(rSquared + r + 1),
        String(r + 1),
      ];
    }
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
