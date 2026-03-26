// === Accuracy Grade System (AR-262) ===
// Post-encounter quiz accuracy affects card reward quality.
// Bonuses only above 80%. No penalties for struggling.
// Pure upside design: B/C grades get standard rewards, A/S get bonus options.

export type AccuracyGrade = 'C' | 'B' | 'A' | 'S';

export interface GradeResult {
  /** Letter grade based on charge accuracy. */
  grade: AccuracyGrade;
  /** Accuracy as a 0-100 percentage (rounded to integer). */
  accuracy: number;
  /** Number of bonus card options to add to the standard 3. 0 or 1. */
  bonusCardOptions: number;
  /** When true, at least one reward card is guaranteed to be uncommon tier or better. */
  guaranteeUncommon: boolean;
}

/** Accuracy thresholds for each grade (inclusive lower bound). */
const GRADE_THRESHOLDS = {
  S: 90,  // +1 card option AND guaranteed uncommon+
  A: 80,  // +1 card option
  B: 60,  // Normal rewards
  // C: anything below 60%
} as const;

/**
 * Calculate the post-encounter accuracy grade from charge attempt statistics.
 *
 * Grade bonuses:
 * - S (90%+): +1 card option (4 total) AND guaranteed uncommon+ card
 * - A (80-89%): +1 card option (4 total)
 * - B (60-79%): Standard rewards
 * - C (<60%):  Standard rewards
 *
 * Edge cases:
 * - 0 charges attempted (Quick Play only encounter) → grade C, no bonuses
 * - chargesCorrect > chargesAttempted is clamped (defensive)
 *
 * @param chargesAttempted - Total Charge plays this encounter (correct + wrong)
 * @param chargesCorrect   - Correct Charge answers this encounter
 * @returns GradeResult with letter grade, accuracy, and reward bonuses
 */
export function calculateAccuracyGrade(
  chargesAttempted: number,
  chargesCorrect: number,
): GradeResult {
  // Edge case: no charges attempted (QP-only or trivially short encounter)
  if (chargesAttempted <= 0) {
    return { grade: 'C', accuracy: 0, bonusCardOptions: 0, guaranteeUncommon: false };
  }

  // Clamp in case of out-of-range inputs
  const safeCorrect = Math.min(Math.max(0, chargesCorrect), chargesAttempted);
  const accuracy = Math.round((safeCorrect / chargesAttempted) * 100);

  if (accuracy >= GRADE_THRESHOLDS.S) {
    return { grade: 'S', accuracy, bonusCardOptions: 1, guaranteeUncommon: true };
  }
  if (accuracy >= GRADE_THRESHOLDS.A) {
    return { grade: 'A', accuracy, bonusCardOptions: 1, guaranteeUncommon: false };
  }
  if (accuracy >= GRADE_THRESHOLDS.B) {
    return { grade: 'B', accuracy, bonusCardOptions: 0, guaranteeUncommon: false };
  }
  return { grade: 'C', accuracy, bonusCardOptions: 0, guaranteeUncommon: false };
}
