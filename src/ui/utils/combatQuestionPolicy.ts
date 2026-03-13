/**
 * Non-curated (legacy) facts should not synthesize fill-blank prompts at runtime.
 */
export function getQuestionVariantCount(hasCuratedVariants: boolean, curatedVariantCount: number): number {
  if (!hasCuratedVariants) return 1
  return Math.max(1, curatedVariantCount)
}

/**
 * For non-curated facts we keep the authored quiz question verbatim.
 */
export function getNonCuratedQuestion(quizQuestion: string): string {
  return quizQuestion
}

