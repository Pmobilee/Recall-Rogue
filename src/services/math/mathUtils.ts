/**
 * Shared utilities for procedural math generators.
 *
 * Exports the seeded PRNG helpers, combinatorics functions, lookup tables,
 * and formatting utilities used across all math generator and distractor files.
 *
 * Source files: src/services/math/mathUtils.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

// ── Seeded PRNG ──────────────────────────────────────────────────────────────

/**
 * Mulberry32 seeded PRNG — returns a function producing floats in [0, 1).
 * Each call to the returned function advances the internal state.
 * Seeded generation is deterministic: the same seed always produces the
 * same sequence, enabling reproducible test cases and replay.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Returns a random integer in [min, max] inclusive using the provided PRNG.
 */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Returns a random element from an array using the provided PRNG.
 * Array must be non-empty — caller is responsible for that guard.
 */
export function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Number theory helpers ─────────────────────────────────────────────────────

/**
 * Compute the GCD of two non-negative integers (Euclidean algorithm).
 * Returns 0 if both inputs are 0.
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// Factorial cache — populated lazily up to n=20 (beyond that exceeds safe integer).
const _factCache: number[] = [1]; // 0! = 1

/**
 * Factorial (n!). Returns 1 for n <= 0. Safe for n <= 20.
 * Values are cached after first computation.
 */
export function factorial(n: number): number {
  if (n <= 0) return 1;
  if (_factCache[n] !== undefined) return _factCache[n];
  for (let i = _factCache.length; i <= Math.min(n, 20); i++) {
    _factCache[i] = _factCache[i - 1] * i;
  }
  return _factCache[Math.min(n, 20)];
}

/**
 * Combinations: nCr = n! / (r! × (n−r)!)
 * Returns 0 for invalid inputs (r > n, negative values).
 */
export function combinations(n: number, r: number): number {
  if (r < 0 || r > n || n < 0) return 0;
  if (r === 0 || r === n) return 1;
  // Use the smaller of r and (n-r) to reduce computation
  const k = Math.min(r, n - r);
  return factorial(n) / (factorial(k) * factorial(n - k));
}

/**
 * Permutations: nPr = n! / (n−r)!
 * Returns 0 for invalid inputs (r > n, negative values).
 */
export function permutations(n: number, r: number): number {
  if (r < 0 || r > n || n < 0) return 0;
  return factorial(n) / factorial(n - r);
}

// ── Geometry constants ────────────────────────────────────────────────────────

/**
 * Common Pythagorean triples (a, b, c) where a² + b² = c².
 * Used by geometry generators to produce clean right-triangle problems.
 */
export const PYTHAGOREAN_TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
  [11, 60, 61],
  [6, 8, 10],
  [9, 12, 15],
  [12, 16, 20],
  [15, 20, 25],
  [10, 24, 26],
];

// ── Trig lookup table ─────────────────────────────────────────────────────────

/**
 * Exact trig value lookup: angle (degrees) → { sin, cos, tan } as string values.
 *
 * Strings use radical notation (e.g. 'sqrt(3)/2') rather than decimal
 * approximations so the quiz can display and compare exact symbolic answers.
 * 'undefined' is used for tan at 90° and 270° where the function diverges.
 */
export const TRIG_TABLE: Record<number, { sin: string; cos: string; tan: string }> = {
  0:   { sin: '0',           cos: '1',           tan: '0' },
  30:  { sin: '1/2',         cos: 'sqrt(3)/2',   tan: 'sqrt(3)/3' },
  45:  { sin: 'sqrt(2)/2',   cos: 'sqrt(2)/2',   tan: '1' },
  60:  { sin: 'sqrt(3)/2',   cos: '1/2',         tan: 'sqrt(3)' },
  90:  { sin: '1',           cos: '0',           tan: 'undefined' },
  120: { sin: 'sqrt(3)/2',   cos: '-1/2',        tan: '-sqrt(3)' },
  135: { sin: 'sqrt(2)/2',   cos: '-sqrt(2)/2',  tan: '-1' },
  150: { sin: '1/2',         cos: '-sqrt(3)/2',  tan: '-sqrt(3)/3' },
  180: { sin: '0',           cos: '-1',          tan: '0' },
  210: { sin: '-1/2',        cos: '-sqrt(3)/2',  tan: 'sqrt(3)/3' },
  225: { sin: '-sqrt(2)/2',  cos: '-sqrt(2)/2',  tan: '1' },
  240: { sin: '-sqrt(3)/2',  cos: '-1/2',        tan: 'sqrt(3)' },
  270: { sin: '-1',          cos: '0',           tan: 'undefined' },
  300: { sin: '-sqrt(3)/2',  cos: '1/2',         tan: '-sqrt(3)' },
  315: { sin: '-sqrt(2)/2',  cos: 'sqrt(2)/2',   tan: '-1' },
  330: { sin: '-1/2',        cos: 'sqrt(3)/2',   tan: '-sqrt(3)/3' },
  360: { sin: '0',           cos: '1',           tan: '0' },
};

/** All standard angles defined in TRIG_TABLE, as numbers. */
export const STANDARD_ANGLES: number[] = Object.keys(TRIG_TABLE).map(Number);

// ── Polynomial formatting ─────────────────────────────────────────────────────

/**
 * Format a polynomial expression in canonical descending-power form.
 *
 * `coeffs` is an array indexed by power: coeffs[0] = constant term,
 * coeffs[1] = coefficient of x, coeffs[2] = coefficient of x², etc.
 *
 * Examples:
 *   [−5, 3, 2]  → "2x^2 + 3x - 5"
 *   [7, 1]      → "x + 7"
 *   [0, 0, 1]   → "x^2"
 *   []           → "0"
 */
export function formatPolynomial(coeffs: number[]): string {
  if (coeffs.length === 0) return '0';

  const terms: string[] = [];

  for (let power = coeffs.length - 1; power >= 0; power--) {
    const coeff = coeffs[power];
    if (coeff === 0) continue;

    let term: string;
    if (power === 0) {
      term = String(Math.abs(coeff));
    } else if (power === 1) {
      term = Math.abs(coeff) === 1 ? 'x' : `${Math.abs(coeff)}x`;
    } else {
      term = Math.abs(coeff) === 1 ? `x^${power}` : `${Math.abs(coeff)}x^${power}`;
    }

    if (terms.length === 0) {
      // Leading term — include sign if negative
      terms.push(coeff < 0 ? `-${term}` : term);
    } else {
      // Subsequent terms — always show sign
      terms.push(coeff < 0 ? `- ${term}` : `+ ${term}`);
    }
  }

  return terms.length === 0 ? '0' : terms.join(' ');
}

// ── Distractor utilities ──────────────────────────────────────────────────────

/**
 * Deduplicate and filter a distractor candidate array.
 *
 * Removes duplicates, removes `correctAnswer`, and trims to exactly `count`
 * items. If the input has fewer than `count` unique valid candidates after
 * filtering, numeric offset fallback values (±2, ±3, …) are appended for
 * numeric answers. Non-numeric answers fall back to simple suffix variants.
 *
 * @param distractors - Raw candidate strings (may contain duplicates or correct answer).
 * @param correctAnswer - The string to exclude from the output.
 * @param count - Exact number of distractors to return.
 */
export function dedupeDistractors(
  distractors: string[],
  correctAnswer: string,
  count: number,
): string[] {
  const seen = new Set<string>([correctAnswer]);
  const result: string[] = [];

  for (const d of distractors) {
    if (!seen.has(d) && d.trim() !== '') {
      seen.add(d);
      result.push(d);
    }
    if (result.length >= count) break;
  }

  // Fallback for numeric answers — offset-based padding
  if (result.length < count) {
    const num = Number(correctAnswer);
    if (Number.isFinite(num)) {
      let offset = 2;
      while (result.length < count && offset < 10000) {
        for (const delta of [offset, -offset]) {
          const candidate = String(Math.round((num + delta) * 1000) / 1000);
          if (!seen.has(candidate)) {
            seen.add(candidate);
            result.push(candidate);
          }
          if (result.length >= count) break;
        }
        offset++;
      }
    } else {
      // Non-numeric fallback — append index suffixes
      let idx = 1;
      while (result.length < count) {
        const candidate = `${correctAnswer}_alt${idx}`;
        if (!seen.has(candidate)) {
          seen.add(candidate);
          result.push(candidate);
        }
        idx++;
        if (idx > 100) break; // safety valve
      }
    }
  }

  return result.slice(0, count);
}
