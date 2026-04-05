/**
 * Procedural geometry problem generators.
 *
 * Five generators covering area, perimeter, volume, angle relationships, and the
 * Pythagorean theorem. Each returns a self-contained MathProblem with exactly
 * 4 distractors produced by formula-confusion error models.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem — required for deterministic replay
 * and unit testing.
 *
 * Source files: src/services/math/geometryGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, randPick, PYTHAGOREAN_TRIPLES, dedupeDistractors } from './mathUtils';
import { buildGeometryDistractors } from './mathDistractorGenerator';

// ── Area ──────────────────────────────────────────────────────────────────────

/**
 * Generate an area problem for 2D shapes.
 *
 * Shapes controlled by `params.shapes`. For circle/trapezoid the answer is
 * expressed in terms of pi (e.g. "12*pi") or as a plain integer respectively.
 * Triangle and trapezoid generation ensures the numerator is even so the area
 * is always a whole number.
 *
 * @param params - Generator params; `shapes` selects available shape types.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateArea(params: GeneratorParams, rng: () => number): MathProblem {
  const shape = randPick(rng, params.shapes ?? ['rectangle']);
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  let question: string;
  let correctAnswer: string;
  let dims: number[];
  let explanation: string;

  switch (shape) {
    case 'square': {
      const s = randInt(rng, minA, maxA);
      const area = s * s;
      correctAnswer = String(area);
      dims = [s];
      question = `Find the area of a square with side length ${s}.`;
      explanation = `Area = s² = ${s}² = ${area}`;
      break;
    }
    case 'triangle': {
      // Ensure base*height is even so area = base*height/2 is an integer.
      let base = randInt(rng, minA, maxA);
      let height = randInt(rng, minB, maxB);
      if ((base * height) % 2 !== 0) base += 1; // bump base by 1 to make product even
      const area = (base * height) / 2;
      correctAnswer = String(area);
      dims = [base, height];
      question = `Find the area of a triangle with base ${base} and height ${height}.`;
      explanation = `Area = ½ × base × height = ½ × ${base} × ${height} = ${area}`;
      break;
    }
    case 'circle': {
      const r = randInt(rng, minA, maxA);
      const coeff = r * r;
      correctAnswer = `${coeff}*pi`;
      dims = [r];
      question = `Find the area of a circle with radius ${r}. (Express in terms of pi)`;
      explanation = `Area = π × r² = π × ${r}² = ${coeff}π`;
      break;
    }
    case 'trapezoid': {
      const a = randInt(rng, minA, maxA);
      const b = randInt(rng, minA, maxA);
      let h = randInt(rng, minB, maxB);
      // Ensure (a+b)*h is even so area is an integer.
      if (((a + b) * h) % 2 !== 0) h += 1;
      const area = ((a + b) * h) / 2;
      correctAnswer = String(area);
      dims = [a, b, h];
      question = `Find the area of a trapezoid with parallel sides ${a} and ${b} and height ${h}.`;
      explanation = `Area = ½ × (a + b) × h = ½ × (${a} + ${b}) × ${h} = ${area}`;
      break;
    }
    default: {
      // rectangle (default)
      const l = randInt(rng, minA, maxA);
      const w = randInt(rng, minB, maxB);
      const area = l * w;
      correctAnswer = String(area);
      dims = [l, w];
      question = `Find the area of a rectangle with length ${l} and width ${w}.`;
      explanation = `Area = length × width = ${l} × ${w} = ${area}`;
    }
  }

  const distractors = buildGeometryDistractors(correctAnswer, shape, dims, 'area', rng);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Perimeter ─────────────────────────────────────────────────────────────────

/**
 * Generate a perimeter or circumference problem.
 *
 * For triangles, a Pythagorean triple is scaled by a random multiplier so that
 * all three side lengths remain integers. For circles the circumference is
 * expressed in terms of pi.
 *
 * @param params - Generator params; `shapes` selects available shape types.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generatePerimeter(params: GeneratorParams, rng: () => number): MathProblem {
  const shape = randPick(rng, params.shapes ?? ['rectangle']);
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  let question: string;
  let correctAnswer: string;
  let dims: number[];
  let explanation: string;

  switch (shape) {
    case 'square': {
      const s = randInt(rng, minA, maxA);
      const perimeter = 4 * s;
      correctAnswer = String(perimeter);
      dims = [s];
      question = `Find the perimeter of a square with side length ${s}.`;
      explanation = `Perimeter = 4 × s = 4 × ${s} = ${perimeter}`;
      break;
    }
    case 'triangle': {
      // Use a Pythagorean triple scaled by a multiplier so all sides are integers.
      const triple = randPick(rng, PYTHAGOREAN_TRIPLES);
      const k = randInt(rng, Math.max(minA, 1), Math.max(maxA, 1));
      const [ta, tb, tc] = [triple[0] * k, triple[1] * k, triple[2] * k];
      const perimeter = ta + tb + tc;
      correctAnswer = String(perimeter);
      dims = [ta, tb, tc];
      question = `Find the perimeter of a triangle with sides ${ta}, ${tb}, and ${tc}.`;
      explanation = `Perimeter = ${ta} + ${tb} + ${tc} = ${perimeter}`;
      break;
    }
    case 'circle': {
      // Circumference = 2πr — express as "{2r}*pi"
      const r = randInt(rng, minA, maxA);
      const coeff = 2 * r;
      correctAnswer = `${coeff}*pi`;
      dims = [r];
      question = `Find the circumference of a circle with radius ${r}. (Express in terms of pi)`;
      explanation = `Circumference = 2π × r = 2π × ${r} = ${coeff}π`;
      break;
    }
    default: {
      // rectangle
      const l = randInt(rng, minA, maxA);
      const w = randInt(rng, minB, maxB);
      const perimeter = 2 * (l + w);
      correctAnswer = String(perimeter);
      dims = [l, w];
      question = `Find the perimeter of a rectangle with length ${l} and width ${w}.`;
      explanation = `Perimeter = 2 × (length + width) = 2 × (${l} + ${w}) = ${perimeter}`;
    }
  }

  const distractors = buildGeometryDistractors(correctAnswer, shape, dims, 'perimeter', rng);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Volume ────────────────────────────────────────────────────────────────────

/**
 * Generate a volume problem for 3D shapes.
 *
 * For pi-based volumes (cylinder, sphere, cone) the answer is expressed as
 * "{N}*pi" or "{N}*pi/3" depending on whether the numeric portion divides
 * cleanly by 3. This matches the format expected by `buildGeometryDistractors`.
 *
 * @param params - Generator params; `shapes` selects available 3D shape types.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateVolume(params: GeneratorParams, rng: () => number): MathProblem {
  const shape = randPick(rng, params.shapes ?? ['cube']);
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  let question: string;
  let correctAnswer: string;
  let dims: number[];
  let explanation: string;

  switch (shape) {
    case 'rectangular_prism': {
      const l = randInt(rng, minA, maxA);
      const w = randInt(rng, minB, maxB);
      const h = randInt(rng, minB, maxB);
      const vol = l * w * h;
      correctAnswer = String(vol);
      dims = [l, w, h];
      question = `Find the volume of a rectangular prism with dimensions ${l} × ${w} × ${h}.`;
      explanation = `Volume = l × w × h = ${l} × ${w} × ${h} = ${vol}`;
      break;
    }
    case 'cylinder': {
      // Volume = π × r² × h → "{r²*h}*pi"
      const r = randInt(rng, minA, maxA);
      const h = randInt(rng, minB, maxB);
      const coeff = r * r * h;
      correctAnswer = `${coeff}*pi`;
      dims = [r, h];
      question = `Find the volume of a cylinder with radius ${r} and height ${h}. (Express in terms of pi)`;
      explanation = `Volume = π × r² × h = π × ${r}² × ${h} = ${coeff}π`;
      break;
    }
    case 'sphere': {
      // Volume = (4/3) × π × r³ → express as "{n}*pi" or "{n}*pi/3"
      const r = randInt(rng, minA, maxA);
      const numerator = 4 * r * r * r;
      let answerStr: string;
      let explStr: string;
      if (numerator % 3 === 0) {
        const coeff = numerator / 3;
        answerStr = `${coeff}*pi`;
        explStr = `Volume = (4/3) × π × r³ = (4/3) × π × ${r}³ = ${coeff}π`;
      } else {
        answerStr = `${numerator}*pi/3`;
        explStr = `Volume = (4/3) × π × r³ = (4/3) × π × ${r}³ = (${numerator}/3)π`;
      }
      correctAnswer = answerStr;
      dims = [r];
      question = `Find the volume of a sphere with radius ${r}. (Express in terms of pi)`;
      explanation = explStr;
      break;
    }
    case 'cone': {
      // Volume = (1/3) × π × r² × h → same fraction approach as sphere
      const r = randInt(rng, minA, maxA);
      const h = randInt(rng, minB, maxB);
      const numerator = r * r * h;
      let answerStr: string;
      let explStr: string;
      if (numerator % 3 === 0) {
        const coeff = numerator / 3;
        answerStr = `${coeff}*pi`;
        explStr = `Volume = (1/3) × π × r² × h = (1/3) × π × ${r}² × ${h} = ${coeff}π`;
      } else {
        answerStr = `${numerator}*pi/3`;
        explStr = `Volume = (1/3) × π × r² × h = (1/3) × π × ${r}² × ${h} = (${numerator}/3)π`;
      }
      correctAnswer = answerStr;
      dims = [r, h];
      question = `Find the volume of a cone with radius ${r} and height ${h}. (Express in terms of pi)`;
      explanation = explStr;
      break;
    }
    default: {
      // cube
      const s = randInt(rng, minA, maxA);
      const vol = s * s * s;
      correctAnswer = String(vol);
      dims = [s];
      question = `Find the volume of a cube with side length ${s}.`;
      explanation = `Volume = s³ = ${s}³ = ${vol}`;
    }
  }

  const distractors = buildGeometryDistractors(correctAnswer, shape, dims, 'volume', rng);

  return {
    question,
    correctAnswer,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Angle Relationships ────────────────────────────────────────────────────────

/**
 * Generate a missing-angle problem using complementary, supplementary, triangle,
 * or vertical angle relationships.
 *
 * Answers are always positive integers (degrees). Distractors use confusion
 * errors like subtracting from the wrong total (90 vs 180) or off-by-5 offsets.
 *
 * @param params - Generator params; `operations` selects available relationship types.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateAngleRelationship(params: GeneratorParams, rng: () => number): MathProblem {
  const relationship = randPick(rng, params.operations ?? ['complementary']);
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  let question: string;
  let correctAnswer: number;
  let explanation: string;

  switch (relationship) {
    case 'supplementary': {
      const A = randInt(rng, Math.max(minA, 10), Math.min(maxA, 170));
      correctAnswer = 180 - A;
      question = `Two angles are supplementary. One angle is ${A}°. Find the other angle.`;
      explanation = `Supplementary angles sum to 180°: 180° − ${A}° = ${correctAnswer}°`;
      break;
    }
    case 'triangle': {
      // Pick two angles that sum to less than 180, each > 0.
      const A = randInt(rng, Math.max(minA, 20), Math.min(maxA, 120));
      const maxB2 = Math.min(maxB, 179 - A);
      const B = randInt(rng, Math.max(minB, 10), Math.max(maxB2, Math.min(minB, 179 - A)));
      correctAnswer = 180 - A - B;
      question = `A triangle has angles of ${A}° and ${B}°. Find the third angle.`;
      explanation = `Triangle angles sum to 180°: 180° − ${A}° − ${B}° = ${correctAnswer}°`;
      break;
    }
    case 'vertical': {
      const A = randInt(rng, Math.max(minA, 10), Math.min(maxA, 170));
      correctAnswer = A; // vertically opposite angles are equal
      const adjacent = 180 - A;
      question = `Two lines intersect forming an angle of ${A}°. Find the vertically opposite angle.`;
      explanation = `Vertically opposite angles are equal: ${correctAnswer}°. (Adjacent angle = 180° − ${A}° = ${adjacent}°)`;
      break;
    }
    default: {
      // complementary
      const A = randInt(rng, Math.max(minA, 10), Math.min(maxA, 80));
      correctAnswer = 90 - A;
      question = `Two angles are complementary. One angle is ${A}°. Find the other angle.`;
      explanation = `Complementary angles sum to 90°: 90° − ${A}° = ${correctAnswer}°`;
    }
  }

  // Build angle-specific distractors via confusion errors.
  const answerStr = String(correctAnswer);
  const candidates: string[] = [];

  // Complement/supplement confusion — subtract from the wrong total.
  if (relationship === 'complementary') {
    // Student might subtract from 180 instead of 90.
    const wrongTotal = 180 - (90 - correctAnswer);
    candidates.push(String(wrongTotal));
  } else if (relationship === 'supplementary') {
    // Student might subtract from 90 instead of 180.
    const wrongTotal = 90 - (180 - correctAnswer);
    if (wrongTotal > 0) candidates.push(String(wrongTotal));
  }

  // Off-by-5 and off-by-10 variants.
  if (correctAnswer + 5 !== correctAnswer) candidates.push(String(correctAnswer + 5));
  if (correctAnswer - 5 > 0) candidates.push(String(correctAnswer - 5));
  if (correctAnswer + 10 !== correctAnswer) candidates.push(String(correctAnswer + 10));
  if (correctAnswer - 10 > 0) candidates.push(String(correctAnswer - 10));

  // 180 - answer and 90 - answer as confusion targets.
  const from180 = 180 - correctAnswer;
  const from90 = 90 - correctAnswer;
  if (from180 > 0 && String(from180) !== answerStr) candidates.push(String(from180));
  if (from90 > 0 && String(from90) !== answerStr) candidates.push(String(from90));

  // Off-by-one.
  candidates.push(String(correctAnswer + 1));
  if (correctAnswer - 1 > 0) candidates.push(String(correctAnswer - 1));

  const distractors = dedupeDistractors(candidates, answerStr, 4);

  return {
    question,
    correctAnswer: answerStr,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}

// ── Pythagorean Theorem ────────────────────────────────────────────────────────

/**
 * Generate a Pythagorean theorem problem with an integer answer.
 *
 * A Pythagorean triple is selected from the lookup table and scaled by a
 * random multiplier drawn from `params.rangeA`. One side (hypotenuse or leg)
 * is hidden and the student must find it.
 *
 * @param params - Generator params; `rangeA` controls the scale multiplier range.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generatePythagorean(params: GeneratorParams, rng: () => number): MathProblem {
  const triple = randPick(rng, PYTHAGOREAN_TRIPLES);
  const k = randInt(rng, params.rangeA[0], params.rangeA[1]);
  const [a, b, c] = [triple[0] * k, triple[1] * k, triple[2] * k];

  // Randomly decide which side to hide: 0 = hypotenuse, 1 = leg a, 2 = leg b.
  const hide = Math.floor(rng() * 3);

  let question: string;
  let correctAnswer: number;
  let explanation: string;

  if (hide === 0) {
    // Hide hypotenuse c.
    correctAnswer = c;
    question = `A right triangle has legs ${a} and ${b}. Find the hypotenuse.`;
    explanation = `a² + b² = c² → ${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c} → c = ${c}`;
  } else if (hide === 1) {
    // Hide leg a; show leg b and hypotenuse c.
    correctAnswer = a;
    question = `A right triangle has a leg of ${b} and hypotenuse ${c}. Find the other leg.`;
    explanation = `a² + b² = c² → a² = ${c}² − ${b}² = ${c * c} − ${b * b} = ${a * a} → a = ${a}`;
  } else {
    // Hide leg b; show leg a and hypotenuse c.
    correctAnswer = b;
    question = `A right triangle has a leg of ${a} and hypotenuse ${c}. Find the other leg.`;
    explanation = `a² + b² = c² → b² = ${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b} → b = ${b}`;
  }

  // Build Pythagorean-specific distractors.
  const answerStr = String(correctAnswer);
  const candidates: string[] = [];

  // Common errors: a+b, |a−b|, a*b, answer±1, answer±5.
  candidates.push(String(a + b));
  const diff = Math.abs(a - b);
  if (diff > 0) candidates.push(String(diff));
  candidates.push(String(a * b));
  candidates.push(String(correctAnswer + 1));
  if (correctAnswer - 1 > 0) candidates.push(String(correctAnswer - 1));
  candidates.push(String(correctAnswer + 5));
  if (correctAnswer - 5 > 0) candidates.push(String(correctAnswer - 5));
  // Unscaled triple value as a distractor when k > 1.
  if (k > 1) {
    const unscaled = correctAnswer / k;
    if (Number.isInteger(unscaled) && unscaled !== correctAnswer) {
      candidates.push(String(unscaled));
    }
  }

  const distractors = dedupeDistractors(candidates, answerStr, 4);

  return {
    question,
    correctAnswer: answerStr,
    acceptableAlternatives: [],
    distractors,
    explanation,
    inputMode: 'choice',
  };
}
