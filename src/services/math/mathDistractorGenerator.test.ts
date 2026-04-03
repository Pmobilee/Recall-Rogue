/**
 * Unit tests for mathDistractorGenerator.ts
 *
 * Covers: count, uniqueness, validity, operation-specific strategies,
 * negative answers, zero answers, and small-answer fallback.
 *
 * Strategy-verification tests (carry error, sign error) request a larger
 * count than the typical 4 so that all generated candidates are visible
 * before the final slice. This is correct — the function guarantees exactly
 * `count` items, not that any specific item appears in a count=4 slice when
 * earlier off-by-one candidates already fill the quota.
 */

import { describe, it, expect } from 'vitest';
import { generateMathDistractors } from './mathDistractorGenerator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidNumberString(s: string): boolean {
  if (s === '' || s === 'NaN' || s === 'Infinity' || s === '-Infinity') return false;
  return Number.isFinite(Number(s));
}

// ---------------------------------------------------------------------------
// 1. Count
// ---------------------------------------------------------------------------

describe('generateMathDistractors — count', () => {
  it('returns exactly the requested count (4)', () => {
    const result = generateMathDistractors(936, '+', [347, 589], 4);
    expect(result).toHaveLength(4);
  });

  it('returns exactly the requested count (3)', () => {
    const result = generateMathDistractors(50, '*', [5, 10], 3);
    expect(result).toHaveLength(3);
  });

  it('returns exactly the requested count (1)', () => {
    const result = generateMathDistractors(100, '+', [40, 60], 1);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Correctness exclusion
// ---------------------------------------------------------------------------

describe('generateMathDistractors — excludes correct answer', () => {
  it('none of the distractors equal the correct answer string', () => {
    const correct = 936;
    const result = generateMathDistractors(correct, '+', [347, 589], 4);
    expect(result).not.toContain(String(correct));
  });

  it('excludes correct answer for subtraction', () => {
    const correct = 25;
    const result = generateMathDistractors(correct, '-', [50, 25], 4);
    expect(result).not.toContain(String(correct));
  });

  it('excludes correct answer for multiplication', () => {
    const correct = 42;
    const result = generateMathDistractors(correct, '*', [6, 7], 4);
    expect(result).not.toContain(String(correct));
  });
});

// ---------------------------------------------------------------------------
// 3. Uniqueness
// ---------------------------------------------------------------------------

describe('generateMathDistractors — no duplicates', () => {
  it('produces no duplicate strings in output', () => {
    const result = generateMathDistractors(936, '+', [347, 589], 4);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('produces no duplicates for division', () => {
    const result = generateMathDistractors(12, '/', [60, 5], 4);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Validity (not NaN, not empty)
// ---------------------------------------------------------------------------

describe('generateMathDistractors — all valid number strings', () => {
  it('all distractors parse as finite numbers for addition', () => {
    const result = generateMathDistractors(936, '+', [347, 589], 4);
    for (const s of result) {
      expect(isValidNumberString(s)).toBe(true);
    }
  });

  it('all distractors parse as finite numbers for multiplication', () => {
    const result = generateMathDistractors(56, '*', [7, 8], 4);
    for (const s of result) {
      expect(isValidNumberString(s)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Carry-error strategy for addition
//
// We request count=15 so the carry-error candidate is not sliced away by
// the earlier off-by-one/off-by-ten candidates that would fill count=4.
// ---------------------------------------------------------------------------

describe('generateMathDistractors — carry error for addition', () => {
  it('includes the no-carry result for 347+589 in the candidate pool', () => {
    // 347 + 589 without carrying per-column (mod 10):
    //   col0: (7+9)%10=6, col1: (4+8)%10=2, col2: 3+5=8 → 826
    // Request 15 candidates to see past the initial off-by-one/ten/wrong-op slots.
    const result = generateMathDistractors(936, '+', [347, 589], 15);
    expect(result).toContain('826');
  });

  it('carry-error distractor is plausible (different from correct answer)', () => {
    // 99 + 11 = 110; without carry:
    //   col0: (9+1)%10=0, col1: (9+1)%10=0, col2: 1 → 100
    // 100 ≠ 110 (correct), so it is a valid distractor.
    // Request 15 so it is not sliced out.
    const result = generateMathDistractors(110, '+', [99, 11], 15);
    expect(result).toContain('100');
  });
});

// ---------------------------------------------------------------------------
// 6. Sign error and reversed subtraction for subtraction
//
// Same rationale as carry-error: request count=15 to expose all candidates.
// ---------------------------------------------------------------------------

describe('generateMathDistractors — sign/reverse for subtraction', () => {
  it('includes negative of correct answer (sign error) in the candidate pool', () => {
    // 50 - 30 = 20; sign error → -20
    // Request 15 to see past off-by-one/ten/wrong-op candidates.
    const result = generateMathDistractors(20, '-', [50, 30], 15);
    expect(result).toContain('-20');
  });

  it('includes reversed subtraction (b - a) in the candidate pool', () => {
    // 70 - 20 = 50; reversed → 20 - 70 = -50
    const result = generateMathDistractors(50, '-', [70, 20], 15);
    expect(result).toContain('-50');
  });
});

// ---------------------------------------------------------------------------
// 7. Negative correct answer
// ---------------------------------------------------------------------------

describe('generateMathDistractors — negative correct answer', () => {
  it('returns exactly the requested count for negative answer', () => {
    const result = generateMathDistractors(-15, '-', [5, 20], 4);
    expect(result).toHaveLength(4);
  });

  it('does not include the correct negative answer', () => {
    const result = generateMathDistractors(-15, '-', [5, 20], 4);
    expect(result).not.toContain('-15');
  });

  it('all distractors are valid number strings for negative answer', () => {
    const result = generateMathDistractors(-15, '-', [5, 20], 4);
    for (const s of result) {
      expect(isValidNumberString(s)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Zero as correct answer
// ---------------------------------------------------------------------------

describe('generateMathDistractors — zero as correct answer', () => {
  it('returns exactly the requested count when answer is 0', () => {
    const result = generateMathDistractors(0, '-', [5, 5], 4);
    expect(result).toHaveLength(4);
  });

  it('does not include 0 in distractors', () => {
    const result = generateMathDistractors(0, '-', [5, 5], 4);
    expect(result).not.toContain('0');
  });

  it('all distractors are valid for zero correct answer', () => {
    const result = generateMathDistractors(0, '-', [5, 5], 4);
    for (const s of result) {
      expect(isValidNumberString(s)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Small correct answer — fallback offsets
// ---------------------------------------------------------------------------

describe('generateMathDistractors — small correct answer fallback', () => {
  it('returns exactly 4 distractors when correct answer is 1', () => {
    // With answer=1, many strategies collapse (off-by-ten=−9 and +11,
    // digit-swap is no-op for single digit). Fallback offsets kick in.
    const result = generateMathDistractors(1, '+', [0, 1], 4);
    expect(result).toHaveLength(4);
  });

  it('no duplicates for small answer=1', () => {
    const result = generateMathDistractors(1, '+', [0, 1], 4);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('does not include 1 when answer=1', () => {
    const result = generateMathDistractors(1, '+', [0, 1], 4);
    expect(result).not.toContain('1');
  });

  it('returns 4 distractors for answer=2', () => {
    const result = generateMathDistractors(2, '+', [1, 1], 4);
    expect(result).toHaveLength(4);
  });
});
