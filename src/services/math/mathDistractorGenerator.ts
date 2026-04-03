/**
 * Algorithmic distractor generation for procedural math problems.
 *
 * Distractors are computed from the operands and correct answer using
 * operation-specific error models (carry errors, sign errors, wrong-op, etc.)
 * so they are plausible but always mathematically wrong.
 *
 * Source files: src/services/math/mathDistractorGenerator.ts
 * Related docs: docs/content/deck-system.md, docs/mechanics/quiz.md
 */

/** Swap two adjacent digits within an integer, returning all unique variants. */
function digitSwapVariants(n: number): number[] {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return [];
  const abs = Math.abs(n);
  const digits = String(abs).split('');
  const results = new Set<number>();
  for (let i = 0; i < digits.length - 1; i++) {
    const copy = [...digits];
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
    const v = Number(copy.join('')) * (n < 0 ? -1 : 1);
    if (v !== n) results.add(v);
  }
  return Array.from(results);
}

/**
 * Simulate column addition WITHOUT carrying (per-column sum mod 10).
 * Used to model the carry-error distractor for addition.
 */
function addWithoutCarry(a: number, b: number): number {
  const sa = String(Math.abs(Math.floor(a))).split('').reverse();
  const sb = String(Math.abs(Math.floor(b))).split('').reverse();
  const len = Math.max(sa.length, sb.length);
  const digits: string[] = [];
  for (let i = 0; i < len; i++) {
    const da = parseInt(sa[i] ?? '0', 10);
    const db = parseInt(sb[i] ?? '0', 10);
    digits.push(String((da + db) % 10));
  }
  return parseInt(digits.reverse().join(''), 10);
}

/**
 * Generates plausible-but-wrong numeric distractors for a math problem.
 *
 * Strategies selected depend on the operation:
 *  - Off-by-one / off-by-ten
 *  - Wrong operation (apply a different op to the same operands)
 *  - Digit swap (swap adjacent digits of the answer)
 *  - Carry error (for '+': sum without carrying)
 *  - Sign error (for '-': negate the answer)
 *  - Near magnitude (answer × 10 or / 10)
 *
 * @param correctAnswer - The correct numeric answer.
 * @param operation - One of '+', '-', '*', '/'.
 * @param operands - The operands used to produce the answer ([a, b] or more for multi-step).
 * @param count - Exact number of distractors to return.
 * @returns An array of exactly `count` unique wrong-answer strings.
 */
export function generateMathDistractors(
  correctAnswer: number,
  operation: string,
  operands: number[],
  count: number,
): string[] {
  const candidates = new Set<number>();
  const a = operands[0] ?? 0;
  const b = operands[1] ?? 0;

  const add = (v: number) => {
    if (!Number.isFinite(v) || v === correctAnswer || Math.abs(v) > 1e12) return;
    candidates.add(Math.round(v * 1000) / 1000); // round to 3dp to avoid float dust
  };

  // ── Off-by-one and off-by-ten ─────────────────────────────────────────────
  add(correctAnswer + 1);
  add(correctAnswer - 1);
  add(correctAnswer + 10);
  add(correctAnswer - 10);

  // ── Wrong operation ───────────────────────────────────────────────────────
  const ops = ['+', '-', '*', '/'];
  for (const op of ops) {
    if (op === operation) continue;
    let wrongResult: number;
    switch (op) {
      case '+': wrongResult = a + b; break;
      case '-': wrongResult = a - b; break;
      case '*': wrongResult = a * b; break;
      case '/': wrongResult = b !== 0 ? a / b : NaN; break;
      default:  continue;
    }
    if (Number.isFinite(wrongResult)) add(Math.floor(wrongResult));
  }

  // ── Digit swap ────────────────────────────────────────────────────────────
  for (const v of digitSwapVariants(Math.floor(correctAnswer))) {
    add(v);
  }

  // ── Carry error (addition only) ────────────────────────────────────────────
  if (operation === '+') {
    const noCarry = addWithoutCarry(a, b);
    add(noCarry);
  }

  // ── Sign error (subtraction only) ─────────────────────────────────────────
  if (operation === '-') {
    add(-correctAnswer);
    add(b - a); // reversed subtraction
  }

  // ── Near magnitude ─────────────────────────────────────────────────────────
  if (correctAnswer !== 0) {
    add(correctAnswer * 10);
    const tenth = correctAnswer / 10;
    if (Number.isInteger(tenth)) add(tenth);
  }

  // Convert to string array, excluding correct answer and duplicates
  const correctStr = formatAnswer(correctAnswer);
  let result: string[] = Array.from(candidates)
    .filter(v => v !== correctAnswer)
    .map(v => formatAnswer(v))
    .filter((s, i, arr) => arr.indexOf(s) === i && s !== correctStr);

  // ── Fallback: small random offsets around the answer ─────────────────────
  if (result.length < count) {
    let offset = 2;
    while (result.length < count + 10 && offset < 1000) {
      const hi = correctAnswer + offset;
      const lo = correctAnswer - offset;
      const hiStr = formatAnswer(hi);
      const loStr = formatAnswer(lo);
      if (hiStr !== correctStr && !result.includes(hiStr)) result.push(hiStr);
      if (result.length < count + 10 && loStr !== correctStr && !result.includes(loStr)) result.push(loStr);
      offset += offset < 10 ? 1 : offset < 100 ? 5 : 50;
    }
  }

  return result.slice(0, count);
}

/**
 * Format a number as a distractor string.
 * Integers are returned without decimal point.
 * Decimals are trimmed to at most 4 significant decimal places.
 */
function formatAnswer(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  // Trim float noise: at most 4 decimal places, trailing zeros removed
  return parseFloat(n.toFixed(4)).toString();
}
