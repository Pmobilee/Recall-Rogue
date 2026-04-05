/**
 * Procedural trig problem generators for the Trigonometry deck.
 *
 * Five generator functions cover: standard angle evaluation, inverse trig,
 * right-triangle solving, unit circle coordinates, and trig identity evaluation.
 * All randomness is seeded via the rng parameter so the same (skill, tier, seed)
 * triple always produces the same problem.
 *
 * Source files: src/services/math/trigGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import {
  randPick,
  TRIG_TABLE,
  STANDARD_ANGLES,
  PYTHAGOREAN_TRIPLES,
  dedupeDistractors,
} from './mathUtils';
import { buildTrigDistractors } from './mathDistractorGenerator';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Filter an angle list to only angles that appear in TRIG_TABLE.
 * Falls back to all STANDARD_ANGLES if the filtered list is empty.
 */
function validAngles(angles: number[] | undefined): number[] {
  if (!angles || angles.length === 0) return STANDARD_ANGLES;
  const filtered = angles.filter(a => a in TRIG_TABLE);
  return filtered.length > 0 ? filtered : STANDARD_ANGLES;
}

/**
 * Filter a trig function list to only valid function names.
 * Falls back to ['sin', 'cos'] if the filtered list is empty.
 */
function validFunctions(trigFunctions: string[] | undefined): string[] {
  const allowed = new Set(['sin', 'cos', 'tan']);
  if (!trigFunctions || trigFunctions.length === 0) return ['sin', 'cos'];
  const filtered = trigFunctions.filter(f => allowed.has(f));
  return filtered.length > 0 ? filtered : ['sin', 'cos'];
}

/**
 * Look up a trig value from TRIG_TABLE. Returns null if the angle is not in
 * the table or if the value is 'undefined' (tan at 90°/270°).
 */
function lookupTrig(angle: number, func: string): string | null {
  const entry = TRIG_TABLE[angle];
  if (!entry) return null;
  const val = entry[func as 'sin' | 'cos' | 'tan'];
  if (val === 'undefined') return null;
  return val;
}

/**
 * Build the superscript name for inverse trig in the explanation text.
 * e.g. 'sin' → 'sin⁻¹'
 */
function inverseName(func: string): string {
  return `${func}\u207B\u00B9`;
}

// ── Generator 1: Standard Angle Values ───────────────────────────────────────

/**
 * Evaluates sin, cos, or tan at a standard angle.
 *
 * Question: "What is sin(45°)?"
 * Answer: exact symbolic string from TRIG_TABLE, e.g. "sqrt(2)/2"
 * Distractors: buildTrigDistractors (wrong function, wrong sign, complement)
 */
export function generateTrigStandardAngle(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const angles = validAngles(params.angles);
  const funcs = validFunctions(params.trigFunctions);

  // Pick a valid (angle, func) pair — skip tan at 90/270
  let angle: number;
  let func: string;
  let answer: string | null = null;

  // Attempt up to 30 picks to avoid undefined tan values
  for (let attempt = 0; attempt < 30; attempt++) {
    angle = randPick(rng, angles);
    func  = randPick(rng, funcs);
    answer = lookupTrig(angle, func);
    if (answer !== null) break;
  }

  // Final safety: if we still have no answer, fall back to sin(0) = 0
  if (answer === null) {
    angle  = 0;
    func   = 'sin';
    answer = '0';
  }

  const distractors = buildTrigDistractors(answer, angle!, func!, rng);

  return {
    question: `What is ${func!}(${angle!}°)?`,
    correctAnswer: answer,
    acceptableAlternatives: [],
    distractors,
    explanation: `${func!}(${angle!}°) = ${answer}`,
    inputMode: 'choice',
  };
}

// ── Generator 2: Inverse Trig ─────────────────────────────────────────────────

/**
 * Given a trig ratio, find the angle.
 *
 * Question: "If sin(θ) = 1/2 and 0° ≤ θ ≤ 90°, what is θ?"
 * Answer: the angle as a string of the degree number, e.g. "30"
 * Distractors: other standard angles that do NOT share the same value for that function
 */
export function generateTrigInverse(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const angles = validAngles(params.angles);
  const funcs  = validFunctions(params.trigFunctions);

  // Determine the max angle from the range (guides the question wording)
  const maxAngle = params.rangeA ? params.rangeA[1] : 90;

  // Pick a (angle, func) pair with a defined value
  let angle: number;
  let func: string;
  let value: string | null = null;

  for (let attempt = 0; attempt < 30; attempt++) {
    angle = randPick(rng, angles);
    func  = randPick(rng, funcs);
    value = lookupTrig(angle, func);
    if (value !== null) break;
  }

  if (value === null) {
    angle = 30;
    func  = 'sin';
    value = '1/2';
  }

  const correctAngle = angle!;
  const correctStr   = String(correctAngle);

  // Distractors: other angles from the param pool that don't share this value for this function
  const wrongAngles = angles
    .filter(a => a !== correctAngle)
    .filter(a => {
      const v = lookupTrig(a, func!);
      return v !== null && v !== value;
    });

  // Shuffle wrong angles deterministically, take first 4
  const shuffled = [...wrongAngles].sort(() => rng() - 0.5);
  const distCandidates = shuffled.map(a => String(a));

  // If we don't have enough, add offset fallbacks (e.g. angle ± 15, ± 30)
  for (const delta of [15, -15, 30, -30, 45, -45, 60, -60]) {
    const candidate = String(correctAngle + delta);
    if (!distCandidates.includes(candidate) && candidate !== correctStr && Number(candidate) >= 0) {
      distCandidates.push(candidate);
    }
  }

  const distractors = dedupeDistractors(distCandidates, correctStr, 4);

  return {
    question: `If ${func!}(θ) = ${value} and 0° ≤ θ ≤ ${maxAngle}°, what is θ? (answer in degrees)`,
    correctAnswer: correctStr,
    acceptableAlternatives: [],
    distractors,
    explanation: `${inverseName(func!)}(${value}) = ${correctAngle}°`,
    inputMode: 'choice',
  };
}

// ── Generator 3: Right Triangle Solving ──────────────────────────────────────

/**
 * Given opposite and adjacent sides of a right triangle, find an angle.
 *
 * Question: "A right triangle has opposite side 3 and adjacent side 4. Find θ (°)."
 * Answer: integer degrees (e.g. "37")
 * Distractors: complement, angle ± 5, angle ± 10, the other acute angle
 */
export function generateTrigRightTriangle(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  // rangeA[0..1] controls the scale multiplier range
  const minScale = Math.max(params.rangeA[0], 1);
  const maxScale = Math.max(params.rangeA[1], minScale);

  // Pick a Pythagorean triple and a scale factor
  const triple = randPick(rng, PYTHAGOREAN_TRIPLES);
  const scaleOptions: number[] = [];
  for (let s = minScale; s <= maxScale; s++) scaleOptions.push(s);
  const scale = scaleOptions.length > 0 ? randPick(rng, scaleOptions) : 1;

  const [rawA, rawB] = triple; // a = shorter leg, b = longer leg
  const opposite  = rawA * scale;
  const adjacent  = rawB * scale;

  // Compute the angle θ = arctan(opposite / adjacent) in degrees
  const thetaRad = Math.atan2(opposite, adjacent);
  const theta    = Math.round(thetaRad * 180 / Math.PI);

  // The other acute angle = 90 - theta
  const otherAngle = 90 - theta;

  const correctStr = String(theta);
  const ratio      = `${opposite}/${adjacent}`;
  const ratioDecimal = (opposite / adjacent).toFixed(3);

  const distCandidates: string[] = [
    String(otherAngle),           // complement
    String(theta + 5),
    String(theta - 5),
    String(theta + 10),
    String(theta - 10),
    String(theta + 15),
    String(theta - 15),
  ].filter(s => {
    const n = Number(s);
    return n > 0 && n < 90 && s !== correctStr;
  });

  const distractors = dedupeDistractors(distCandidates, correctStr, 4);

  return {
    question: `A right triangle has opposite side ${opposite} and adjacent side ${adjacent}. Find the angle θ (to the nearest degree).`,
    correctAnswer: correctStr,
    acceptableAlternatives: [],
    distractors,
    explanation: `tan(θ) = ${ratio} ≈ ${ratioDecimal}, θ = arctan(${ratioDecimal}) ≈ ${theta}°`,
    inputMode: 'choice',
  };
}

// ── Generator 4: Unit Circle ──────────────────────────────────────────────────

/**
 * Find coordinates or a specific function value on the unit circle.
 *
 * Two question modes (randomly selected):
 *  - "coordinate": asks for the (cos θ, sin θ) point on the unit circle
 *  - "value": asks for a specific function value (like trig_standard_angle but
 *             framed in terms of the unit circle)
 *
 * Answer for coordinate: "(cos_value, sin_value)" e.g. "(sqrt(2)/2, sqrt(2)/2)"
 * Distractors for coordinate: swapped axes, wrong signs, adjacent angle coords
 */
export function generateTrigUnitCircle(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const angles = validAngles(params.angles);
  const funcs  = validFunctions(params.trigFunctions);

  // Pick an angle with defined sin and cos
  const angle = randPick(rng, angles);
  const entry = TRIG_TABLE[angle];

  // Decide mode: 0 = coordinate pair, 1 = function value
  const mode = rng() < 0.5 ? 'coordinate' : 'value';

  if (mode === 'coordinate') {
    const cosVal = entry.cos;
    const sinVal = entry.sin;
    const correctStr = `(${cosVal}, ${sinVal})`;

    // Distractors: swapped (sin, cos), wrong signs, adjacent angles
    const distCandidates: string[] = [];

    // Swap axes: (sin, cos)
    distCandidates.push(`(${sinVal}, ${cosVal})`);

    // Wrong sign on one or both components
    const negCos = cosVal.startsWith('-') ? cosVal.slice(1) : `-${cosVal}`;
    const negSin = sinVal.startsWith('-') ? sinVal.slice(1) : `-${sinVal}`;
    distCandidates.push(`(${negCos}, ${sinVal})`);
    distCandidates.push(`(${cosVal}, ${negSin})`);
    distCandidates.push(`(${negCos}, ${negSin})`);

    // Adjacent angle coordinate
    const adjacentAngles = [angle + 30, angle - 30, angle + 45, angle - 45]
      .filter(a => a in TRIG_TABLE && a !== angle);
    for (const adj of adjacentAngles.slice(0, 2)) {
      const adjEntry = TRIG_TABLE[adj];
      distCandidates.push(`(${adjEntry.cos}, ${adjEntry.sin})`);
    }

    const distractors = dedupeDistractors(distCandidates, correctStr, 4);

    return {
      question: `What is the point on the unit circle at ${angle}°? Give as (cos θ, sin θ).`,
      correctAnswer: correctStr,
      acceptableAlternatives: [],
      distractors,
      explanation: `At ${angle}° on the unit circle: cos(${angle}°) = ${cosVal}, sin(${angle}°) = ${sinVal}, so the point is (${cosVal}, ${sinVal}).`,
      inputMode: 'choice',
    };
  } else {
    // "value" mode — same as trig_standard_angle but framed as unit circle
    // Pick a function that has a defined value at this angle
    let func: string | null = null;
    let value: string | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = randPick(rng, funcs);
      const v = lookupTrig(angle, candidate);
      if (v !== null) {
        func  = candidate;
        value = v;
        break;
      }
    }

    if (func === null || value === null) {
      func  = 'sin';
      value = entry.sin;
    }

    const distractors = buildTrigDistractors(value, angle, func, rng);

    const unitCircleContext =
      func === 'sin'
        ? `On the unit circle, sin(θ) equals the y-coordinate.`
        : func === 'cos'
        ? `On the unit circle, cos(θ) equals the x-coordinate.`
        : `On the unit circle, tan(θ) = sin(θ)/cos(θ).`;

    return {
      question: `On the unit circle at ${angle}°, what is ${func}(${angle}°)?`,
      correctAnswer: value,
      acceptableAlternatives: [],
      distractors,
      explanation: `${unitCircleContext} ${func}(${angle}°) = ${value}`,
      inputMode: 'choice',
    };
  }
}

// ── Generator 5: Trig Identities ─────────────────────────────────────────────

/** Identity template descriptor. */
interface IdentityTemplate {
  /** Display label for the expression, using {a} for the angle. */
  label: (angle: number) => string;
  /**
   * Evaluate the expression at the given angle. Returns null if the result
   * cannot be computed at that angle (e.g. tan undefined at 90°).
   */
  evaluate: (angle: number) => string | null;
  /** Short explanation suffix shown after the identity name. */
  identityName: string;
}

/** Build a readable display for sin²(a) etc. */
function sin2(a: number): string { return `sin²(${a}°)`; }
function cos2(a: number): string { return `cos²(${a}°)`; }

/**
 * Simplify squared exact trig value strings.
 * e.g. "sqrt(3)/2" → "3/4", "1/2" → "1/4", "1" → "1", "0" → "0"
 */
function squareExact(val: string): string | null {
  // Remove leading minus sign — squaring eliminates it
  const abs = val.startsWith('-') ? val.slice(1) : val;
  switch (abs) {
    case '0':        return '0';
    case '1':        return '1';
    case '1/2':      return '1/4';
    case 'sqrt(2)/2': return '1/2';
    case 'sqrt(3)/2': return '3/4';
    case 'sqrt(3)':  return '3';
    case 'sqrt(3)/3': return '1/3';
    default:         return null;
  }
}

/**
 * Evaluates expressions using trigonometric identities at known angles.
 *
 * Question: "Evaluate: sin²(30°) + cos²(30°)"
 * Answer: the computed value string, e.g. "1"
 * Distractors: common trig values, 0, 1, -1, individual function values
 */
export function generateTrigIdentity(
  params: GeneratorParams,
  rng: () => number,
): MathProblem {
  const angles = validAngles(params.angles);

  // Pick a template and angle combination that produces a valid result
  let template: IdentityTemplate | null = null;
  let angle = 0;
  let answer: string | null = null;

  // Resolve the squared identity templates to use the squareExact helper
  // by overriding evaluate for the two 1-sin²/1-cos² templates inline
  const templates: IdentityTemplate[] = [
    // Always-1 identity
    {
      label:        a => `${sin2(a)} + ${cos2(a)}`,
      evaluate:     _a => '1',
      identityName: 'sin²(θ) + cos²(θ) = 1',
    },
    // 1 - sin²(a) = cos²(a)
    {
      label:    a => `1 - ${sin2(a)}`,
      evaluate: a => {
        const cosVal = TRIG_TABLE[a]?.cos;
        if (!cosVal) return null;
        return squareExact(cosVal);
      },
      identityName: '1 - sin²(θ) = cos²(θ)',
    },
    // 1 - cos²(a) = sin²(a)
    {
      label:    a => `1 - ${cos2(a)}`,
      evaluate: a => {
        const sinVal = TRIG_TABLE[a]?.sin;
        if (!sinVal) return null;
        return squareExact(sinVal);
      },
      identityName: '1 - cos²(θ) = sin²(θ)',
    },
    // sin(a)/cos(a) = tan(a)
    {
      label:    a => `sin(${a}°) / cos(${a}°)`,
      evaluate: a => lookupTrig(a, 'tan'),
      identityName: 'sin(θ) / cos(θ) = tan(θ)',
    },
    // 2·sin(a)·cos(a) = sin(2a)
    {
      label:    a => `2·sin(${a}°)·cos(${a}°)`,
      evaluate: a => {
        const doubleAngle = (a * 2) % 360;
        return lookupTrig(doubleAngle, 'sin');
      },
      identityName: '2·sin(θ)·cos(θ) = sin(2θ)',
    },
    // sin²(a) + cos²(a) + tan(a) = 1 + tan(a)
    {
      label:    a => `${sin2(a)} + ${cos2(a)} + tan(${a}°)`,
      evaluate: a => {
        const tanVal = lookupTrig(a, 'tan');
        if (tanVal === null) return null;
        if (tanVal === '0') return '1';
        return `1 + ${tanVal}`;
      },
      identityName: 'sin²(θ) + cos²(θ) + tan(θ) = 1 + tan(θ)',
    },
  ];

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidateTemplate = randPick(rng, templates);
    const candidateAngle    = randPick(rng, angles);
    const result            = candidateTemplate.evaluate(candidateAngle);
    if (result !== null) {
      template = candidateTemplate;
      angle    = candidateAngle;
      answer   = result;
      break;
    }
  }

  // Hard fallback: Pythagorean identity at 30° always evaluates to 1
  if (answer === null || template === null) {
    template = templates[0];
    angle    = 30;
    answer   = '1';
  }

  // Distractors: common trig values + individual components at that angle
  const entry = TRIG_TABLE[angle];
  const distCandidates: string[] = ['0', '1', '-1', '1/2', '-1/2'];
  if (entry) {
    distCandidates.push(entry.sin, entry.cos);
    const tanVal = lookupTrig(angle, 'tan');
    if (tanVal !== null) distCandidates.push(tanVal);
  }
  // A few squared values for plausibility
  distCandidates.push('3/4', '1/4', '1/3', '2');

  const shuffled = distCandidates.sort(() => rng() - 0.5);
  const distractors = dedupeDistractors(shuffled, answer, 4);

  return {
    question: `Evaluate: ${template.label(angle)}`,
    correctAnswer: answer,
    acceptableAlternatives: [],
    distractors,
    explanation: `Using the identity ${template.identityName}, substituting θ = ${angle}°: ${template.label(angle)} = ${answer}`,
    inputMode: 'choice',
  };
}
