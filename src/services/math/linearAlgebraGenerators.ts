/**
 * Procedural linear algebra problem generators.
 *
 * Five generators covering matrix addition, scalar multiplication, determinants,
 * dot products, and matrix-vector multiplication. Each returns a self-contained
 * MathProblem with exactly 4 distractors produced by plausible error models.
 *
 * All randomness is seeded via a mulberry32 PRNG so the same (params, seed)
 * pair always produces the same problem — required for deterministic replay
 * and unit testing.
 *
 * The `steps` field in GeneratorParams controls dimension:
 *   steps=2 → 2×2 matrices / 2D vectors
 *   steps=3 → 3×3 matrices / 3D vectors
 *   steps=4 → 4D vectors (dot product only)
 *
 * Source files: src/services/math/linearAlgebraGenerators.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { GeneratorParams, MathProblem } from '../../data/proceduralDeckTypes';
import { randInt, dedupeDistractors } from './mathUtils';

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a 2D matrix (array of rows) into the canonical display string.
 *
 * Example: [[1, 2], [3, 4]] → "[[1, 2], [3, 4]]"
 *
 * @param rows - Array of row arrays, each containing integer values.
 * @returns A compact string representation of the matrix.
 */
export function formatMatrix(rows: number[][]): string {
  const rowStrs = rows.map(row => `[${row.join(', ')}]`);
  return `[${rowStrs.join(', ')}]`;
}

/**
 * Format a vector (1D number array) into the canonical display string.
 *
 * Example: [1, 2, 3] → "[1, 2, 3]"
 *
 * @param v - Array of integer values.
 * @returns A compact string representation of the vector.
 */
export function formatVector(v: number[]): string {
  return `[${v.join(', ')}]`;
}

// ── Matrix Addition ───────────────────────────────────────────────────────────

/**
 * Generate a matrix addition problem: A + B = ?
 *
 * Dimension is controlled by `params.steps` (2 → 2×2, 3 → 3×3).
 * Elements are drawn from `params.rangeA`. The correct answer is shown in the
 * same "[[a, b], [c, d]]" string format used throughout this module.
 *
 * Distractors use common student errors:
 * - Wrong sign on one element (subtraction instead of addition)
 * - Off-by-one on one element
 * - Multiplied instead of added (A[i][j] * B[i][j])
 * - Swapped operand ordering (B + A, which for matrices is the same — so
 *   instead we use a scalar confuse: A[i][j] + B[i][j] + 1 everywhere)
 *
 * @param params - Generator params; `steps` sets matrix dimension (2 or 3).
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateMatrixAddition(params: GeneratorParams, rng: () => number): MathProblem {
  const dim = Math.max(2, Math.min(3, params.steps ?? 2));
  const [minA, maxA] = params.rangeA;

  // Generate matrix A and B with elements in rangeA.
  const matA: number[][] = Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => randInt(rng, minA, maxA)),
  );
  const matB: number[][] = Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => randInt(rng, minA, maxA)),
  );

  // Compute correct answer: element-wise sum.
  const matC: number[][] = matA.map((row, i) => row.map((v, j) => v + matB[i][j]));

  const correctAnswer = formatMatrix(matC);
  const aStr = formatMatrix(matA);
  const bStr = formatMatrix(matB);

  const question = `Add the matrices:\nA = ${aStr}\nB = ${bStr}\nFind A + B.`;
  const explanation = `Add element-by-element: each entry (i,j) = A[i][j] + B[i][j]. Result: ${correctAnswer}`;

  // Build distractor candidates.
  const candidates: string[] = [];

  // Distractor 1: subtract instead of add (A - B).
  const matSub: number[][] = matA.map((row, i) => row.map((v, j) => v - matB[i][j]));
  candidates.push(formatMatrix(matSub));

  // Distractor 2: multiply element-wise (A ∘ B, Hadamard product — common confusion).
  const matMul: number[][] = matA.map((row, i) => row.map((v, j) => v * matB[i][j]));
  candidates.push(formatMatrix(matMul));

  // Distractor 3: off-by-one on every element.
  const matOff1: number[][] = matC.map(row => row.map(v => v + 1));
  candidates.push(formatMatrix(matOff1));

  // Distractor 4: off-by-one (minus) on every element.
  const matOffMinus: number[][] = matC.map(row => row.map(v => v - 1));
  candidates.push(formatMatrix(matOffMinus));

  // Distractor 5: add only the first row correctly, swap A and B for the rest.
  const matSwap: number[][] = matA.map((row, i) => row.map((v, j) => (i === 0 ? v + matB[i][j] : matB[i][j] + v + 1)));
  candidates.push(formatMatrix(matSwap));

  // Distractor 6: add 2 to every element (off-by-2).
  const matOff2: number[][] = matC.map(row => row.map(v => v + 2));
  candidates.push(formatMatrix(matOff2));

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

// ── Scalar Multiplication ─────────────────────────────────────────────────────

/**
 * Generate a scalar multiplication problem: k * A = ?
 *
 * Dimension is controlled by `params.steps` (2 → 2×2, 3 → 3×3).
 * The scalar k is drawn from `params.rangeB` (kept small: 2–6 typical).
 *
 * Distractors use common errors:
 * - Add instead of multiply (A[i][j] + k)
 * - Multiply only the first row (partial application error)
 * - Wrong scalar (k±1)
 * - Square instead of multiply (A[i][j]²)
 *
 * @param params - Generator params; `steps` sets matrix dimension (2 or 3); `rangeB` sets scalar range.
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateScalarMultiplication(params: GeneratorParams, rng: () => number): MathProblem {
  const dim = Math.max(2, Math.min(3, params.steps ?? 2));
  const [minA, maxA] = params.rangeA;
  const [minB, maxB] = params.rangeB;

  const k = randInt(rng, Math.max(minB, 2), Math.max(maxB, 3));

  const matA: number[][] = Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => randInt(rng, minA, maxA)),
  );

  // Correct: k * A[i][j] for all i, j.
  const matResult: number[][] = matA.map(row => row.map(v => k * v));

  const correctAnswer = formatMatrix(matResult);
  const aStr = formatMatrix(matA);

  const question = `Multiply matrix A by scalar ${k}:\nA = ${aStr}\nFind ${k}A.`;
  const explanation = `Multiply each element by ${k}. Result: ${correctAnswer}`;

  const candidates: string[] = [];

  // Distractor 1: add k instead of multiply (A[i][j] + k).
  const matAdd: number[][] = matA.map(row => row.map(v => v + k));
  candidates.push(formatMatrix(matAdd));

  // Distractor 2: multiply only the diagonal (common off-by-structure error).
  const matDiag: number[][] = matA.map((row, i) => row.map((v, j) => (i === j ? k * v : v)));
  candidates.push(formatMatrix(matDiag));

  // Distractor 3: use scalar k+1.
  const matKPlus: number[][] = matA.map(row => row.map(v => (k + 1) * v));
  candidates.push(formatMatrix(matKPlus));

  // Distractor 4: use scalar k-1 (if k > 1).
  if (k > 1) {
    const matKMinus: number[][] = matA.map(row => row.map(v => (k - 1) * v));
    candidates.push(formatMatrix(matKMinus));
  }

  // Distractor 5: square each element instead (A[i][j]²).
  const matSq: number[][] = matA.map(row => row.map(v => v * v));
  candidates.push(formatMatrix(matSq));

  // Distractor 6: multiply only the first row.
  const matFirstRow: number[][] = matA.map((row, i) => row.map(v => (i === 0 ? k * v : v)));
  candidates.push(formatMatrix(matFirstRow));

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

// ── Determinant ───────────────────────────────────────────────────────────────

/**
 * Generate a matrix determinant problem.
 *
 * For 2×2 (steps=2): det = ad - bc. Constructed backward — pick det, a, b, c,
 * solve for d = (det + b*c) / a to guarantee integer results.
 *
 * For 3×3 (steps=3): use Sarrus rule with small elements (-3 to 3) to keep the
 * determinant manageable. Forward computation (elements chosen first, det computed).
 *
 * @param params - Generator params; `steps` selects 2×2 vs 3×3 (2 or 3).
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateDeterminant(params: GeneratorParams, rng: () => number): MathProblem {
  const dim = Math.max(2, Math.min(3, params.steps ?? 2));

  if (dim === 2) {
    return _generateDeterminant2x2(params, rng);
  } else {
    return _generateDeterminant3x3(rng);
  }
}

function _generateDeterminant2x2(params: GeneratorParams, rng: () => number): MathProblem {
  const [minA, maxA] = params.rangeA;

  // Construct backward: pick det, a, b, c → solve d.
  // Pick det in a small range for tractability.
  const det = randInt(rng, -10, 10);
  // a must be non-zero (it divides into the d formula).
  let a = randInt(rng, minA, maxA);
  if (a === 0) a = 1;
  const b = randInt(rng, minA, maxA);
  const c = randInt(rng, minA, maxA);
  // d = (det + b*c) / a — only valid if divisible.
  let d: number;
  // Try a few seeds to find a clean integer d; fall back to det=0 case.
  const numerator = det + b * c;
  if (numerator % a === 0) {
    d = numerator / a;
  } else {
    // Adjust det to make it work: det = a*d - b*c for some d in range.
    const dTarget = randInt(rng, minA, maxA);
    d = dTarget;
    // Recompute det for this d.
    const detActual = a * d - b * c;
    const correctAnswer = String(detActual);
    const mat = [[a, b], [c, d]];
    const question = `Find the determinant of:\n${formatMatrix(mat)}`;
    const explanation = `det = ad - bc = (${a})(${d}) - (${b})(${c}) = ${a * d} - ${b * c} = ${detActual}`;
    return _buildDetResult(question, correctAnswer, explanation, detActual, rng);
  }

  const detVal = det;
  const mat = [[a, b], [c, d]];
  const correctAnswer = String(detVal);
  const question = `Find the determinant of:\n${formatMatrix(mat)}`;
  const explanation = `det = ad - bc = (${a})(${d}) - (${b})(${c}) = ${a * d} - ${b * c} = ${detVal}`;
  return _buildDetResult(question, correctAnswer, explanation, detVal, rng);
}

function _generateDeterminant3x3(rng: () => number): MathProblem {
  // Use small elements (-3 to 3) for manageable numbers.
  const mat: number[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => randInt(rng, -3, 3)),
  );
  const [a, b, c] = mat[0];
  const [d, e, f] = mat[1];
  const [g, h, i] = mat[2];

  // Sarrus rule: det = a(ei-fh) - b(di-fg) + c(dh-eg)
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  const correctAnswer = String(det);
  const question = `Find the determinant of:\n${formatMatrix(mat)}`;
  const explanation =
    `Using cofactor expansion along row 1:\n` +
    `det = ${a}(${e}×${i} - ${f}×${h}) - ${b}(${d}×${i} - ${f}×${g}) + ${c}(${d}×${h} - ${e}×${g}) = ${det}`;

  return _buildDetResult(question, correctAnswer, explanation, det, rng);
}

/** Build the MathProblem with distractor candidates for a determinant result. */
function _buildDetResult(
  question: string,
  correctAnswer: string,
  explanation: string,
  detVal: number,
  rng: () => number,
): MathProblem {
  const candidates: string[] = [];

  // Off-by-one errors.
  candidates.push(String(detVal + 1));
  candidates.push(String(detVal - 1));
  // Sign error (student forgot the minus in ad-bc or sign of cofactor).
  candidates.push(String(-detVal));
  // Double the value (forgot the subtraction entirely — just added).
  candidates.push(String(detVal * 2));
  // Common error: ad + bc instead of ad - bc.
  candidates.push(String(detVal + 2 * (detVal > 0 ? randInt(rng, 1, 5) : -randInt(rng, 1, 5))));
  // Off by 2.
  candidates.push(String(detVal + 2));
  candidates.push(String(detVal - 2));

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

// ── Dot Product ───────────────────────────────────────────────────────────────

/**
 * Generate a vector dot product problem: u · v = ?
 *
 * Dimension is controlled by `params.steps` (2=2D, 3=3D, 4=4D).
 * Elements are drawn from `params.rangeA`.
 *
 * Distractors use common errors:
 * - Cross-product confusion (2D: u[0]*v[1] - u[1]*v[0])
 * - Sum of components instead of sum of products
 * - Off-by-one on the result
 * - Component-wise product sum but with wrong sign on one term
 *
 * @param params - Generator params; `steps` sets vector dimension (2, 3, or 4).
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateDotProduct(params: GeneratorParams, rng: () => number): MathProblem {
  const dim = Math.max(2, Math.min(4, params.steps ?? 2));
  const [minA, maxA] = params.rangeA;

  const u: number[] = Array.from({ length: dim }, () => randInt(rng, minA, maxA));
  const v: number[] = Array.from({ length: dim }, () => randInt(rng, minA, maxA));

  // Correct: sum of u[i]*v[i].
  const dot = u.reduce((acc, ui, i) => acc + ui * v[i], 0);

  const correctAnswer = String(dot);
  const uStr = formatVector(u);
  const vStr = formatVector(v);

  const productTerms = u.map((ui, i) => `(${ui})(${v[i]})`).join(' + ');
  const productVals = u.map((ui, i) => ui * v[i]).join(' + ');

  const question = `Find the dot product:\nu = ${uStr}\nv = ${vStr}\nCompute u · v.`;
  const explanation = `u · v = ${productTerms} = ${productVals} = ${dot}`;

  const candidates: string[] = [];

  // Distractor 1: sum of components (u[0]+u[1]+... confused with dot product).
  const sumU = u.reduce((a, b) => a + b, 0);
  const sumV = v.reduce((a, b) => a + b, 0);
  candidates.push(String(sumU + sumV));

  // Distractor 2: 2D cross product magnitude (only meaningful for 2D, but common confusion).
  if (dim === 2) {
    const cross2d = u[0] * v[1] - u[1] * v[0];
    candidates.push(String(cross2d));
  } else {
    // For higher dims: product of magnitudes (‖u‖²-ish confusion).
    const sumSqU = u.reduce((a, b) => a + b * b, 0);
    candidates.push(String(sumSqU));
  }

  // Distractor 3: off-by-one on the result.
  candidates.push(String(dot + 1));
  candidates.push(String(dot - 1));

  // Distractor 4: sign error on first component.
  const dotSignFlip = u.reduce((acc, ui, i) => acc + (i === 0 ? -ui : ui) * v[i], 0);
  candidates.push(String(dotSignFlip));

  // Distractor 5: product of sums instead of sum of products ((Σu)*(Σv)).
  candidates.push(String(sumU * sumV));

  // Distractor 6: off-by-two.
  candidates.push(String(dot + 2));
  candidates.push(String(dot - 2));

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

// ── Matrix-Vector Multiply ────────────────────────────────────────────────────

/**
 * Generate a matrix-vector multiplication problem: A * x = ?
 *
 * Dimension is controlled by `params.steps` (2 → 2×2 matrix with 2-vector, 3 → 3×3).
 * Elements are drawn from `params.rangeA`.
 *
 * The answer is expressed as a vector string e.g. "[5, 7]".
 *
 * Distractors use common errors:
 * - Transpose confusion (multiply rows instead of columns)
 * - Add instead of multiply in dot product step
 * - Off-by-one on one component
 * - Wrong row used (mix up row 1 and row 2)
 *
 * @param params - Generator params; `steps` sets matrix dimension (2 or 3).
 * @param rng    - Seeded PRNG (mulberry32 instance).
 * @returns A fully-populated MathProblem ready for the quiz engine.
 */
export function generateMatrixVectorMultiply(params: GeneratorParams, rng: () => number): MathProblem {
  const dim = Math.max(2, Math.min(3, params.steps ?? 2));
  const [minA, maxA] = params.rangeA;

  const matA: number[][] = Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => randInt(rng, minA, maxA)),
  );
  const vecX: number[] = Array.from({ length: dim }, () => randInt(rng, minA, maxA));

  // Correct: result[i] = sum of A[i][j] * x[j] for each row i.
  const result: number[] = matA.map(row => row.reduce((acc, aij, j) => acc + aij * vecX[j], 0));

  const correctAnswer = formatVector(result);
  const aStr = formatMatrix(matA);
  const xStr = formatVector(vecX);

  const rowExpls = matA
    .map((row, i) => {
      const terms = row.map((aij, j) => `(${aij})(${vecX[j]})`).join(' + ');
      return `  Row ${i + 1}: ${terms} = ${result[i]}`;
    })
    .join('\n');

  const question = `Multiply matrix A by vector x:\nA = ${aStr}\nx = ${xStr}\nFind Ax.`;
  const explanation = `Multiply each row of A by x:\n${rowExpls}\nResult: ${correctAnswer}`;

  const candidates: string[] = [];

  // Distractor 1: transpose confusion — use columns as rows (A^T * x).
  const transposedResult: number[] = Array.from({ length: dim }, (_, j) =>
    matA.reduce((acc, row, i) => acc + row[j] * vecX[i], 0),
  );
  candidates.push(formatVector(transposedResult));

  // Distractor 2: add corresponding elements instead of dot product.
  const addResult: number[] = matA.map((row, i) => row.reduce((acc, aij, j) => acc + aij + vecX[j], 0));
  candidates.push(formatVector(addResult));

  // Distractor 3: off-by-one on the first component.
  const offBy1First: number[] = [...result];
  offBy1First[0] = offBy1First[0] + 1;
  candidates.push(formatVector(offBy1First));

  // Distractor 4: off-by-one on the second component.
  const offBy1Second: number[] = [...result];
  offBy1Second[1] = offBy1Second[1] + 1;
  candidates.push(formatVector(offBy1Second));

  // Distractor 5: swap rows 0 and 1 (wrong row used).
  if (dim >= 2) {
    const swappedResult: number[] = [...result];
    [swappedResult[0], swappedResult[1]] = [swappedResult[1], swappedResult[0]];
    candidates.push(formatVector(swappedResult));
  }

  // Distractor 6: multiply element-wise (Hadamard confusion — but with a flat vector).
  const hadamardFlat: number[] = matA.map((row, i) => row[i] * vecX[i]);
  candidates.push(formatVector(hadamardFlat));

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
