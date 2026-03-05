/** UGC review stages */
export type ReviewStage = 'auto_filter' | 'community_vote' | 'admin_review' | 'approved' | 'rejected'

export interface ReviewResult {
  passed: boolean
  stage: ReviewStage
  reason?: string
}

/** Auto-filter checks for UGC submissions */
export function autoFilterSubmission(factText: string, correctAnswer: string, distractors: string[]): ReviewResult {
  // Check minimum lengths
  if (factText.length < 20) {
    return { passed: false, stage: 'auto_filter', reason: 'Fact text too short (minimum 20 characters)' }
  }
  if (correctAnswer.length < 2) {
    return { passed: false, stage: 'auto_filter', reason: 'Answer too short' }
  }
  if (distractors.length < 3) {
    return { passed: false, stage: 'auto_filter', reason: 'At least 3 distractors required' }
  }

  // Check for duplicate distractors
  const uniqueDistractors = new Set(distractors.map(d => d.toLowerCase().trim()))
  if (uniqueDistractors.size < distractors.length) {
    return { passed: false, stage: 'auto_filter', reason: 'Duplicate distractors found' }
  }

  // Check answer isn't in distractors
  if (distractors.some(d => d.toLowerCase().trim() === correctAnswer.toLowerCase().trim())) {
    return { passed: false, stage: 'auto_filter', reason: 'Correct answer appears in distractors' }
  }

  // Check for obvious profanity (basic filter)
  const profanityPatterns = /\b(fuck|shit|damn|ass|bitch|crap)\b/i
  if (profanityPatterns.test(factText) || profanityPatterns.test(correctAnswer) || distractors.some(d => profanityPatterns.test(d))) {
    return { passed: false, stage: 'auto_filter', reason: 'Content contains inappropriate language' }
  }

  return { passed: true, stage: 'auto_filter' }
}

/** Categories of automated flags that can be raised on a submission */
export type FlagReason =
  | 'profanity'
  | 'potential_misinformation'
  | 'url_unreachable'
  | 'answer_in_question'
  | 'too_similar_to_existing'
  | 'suspicious_submission_rate'

export interface AutoFlag {
  reason: FlagReason
  severity: 'block' | 'warn'
  detail: string
}

/**
 * Run enhanced automated checks on a submission.
 * Returns an array of flags; an empty array means no issues detected.
 * 'block' severity flags prevent the submission from entering community_vote.
 * 'warn' flags allow it through but add a moderator note.
 *
 * @param factText      - The fact text to check.
 * @param correctAnswer - The correct answer to check.
 * @param distractors   - The distractor answers to check.
 * @param sourceUrl     - The source URL to validate.
 * @param playerId      - The submitting player's ID (for rate checks).
 * @returns Array of AutoFlag objects describing any issues found.
 */
export function runAutoFlags(
  factText: string,
  correctAnswer: string,
  distractors: string[],
  sourceUrl: string,
  _playerId: string
): AutoFlag[] {
  const flags: AutoFlag[] = []

  // 1. Answer embedded verbatim in question (gives away the answer)
  if (factText.toLowerCase().includes(correctAnswer.toLowerCase()) &&
      correctAnswer.length > 4) {
    flags.push({
      reason: 'answer_in_question',
      severity: 'warn',
      detail: `Correct answer "${correctAnswer}" appears verbatim in the fact text`
    })
  }

  // 2. URL scheme check (must be http/https)
  try {
    const url = new URL(sourceUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      flags.push({
        reason: 'url_unreachable',
        severity: 'block',
        detail: `Source URL uses unsupported protocol: ${url.protocol}`
      })
    }
  } catch {
    flags.push({
      reason: 'url_unreachable',
      severity: 'block',
      detail: 'Source URL is not a valid URL'
    })
  }

  // 3. All-distractor similarity check (distractors too close to correct answer)
  const normalizedAnswer = correctAnswer.toLowerCase().trim()
  const suspiciouslyClose = distractors.filter(d => {
    const nd = d.toLowerCase().trim()
    // Levenshtein distance <= 2 for short answers is suspicious
    if (normalizedAnswer.length <= 6) return nd === normalizedAnswer
    return nd.startsWith(normalizedAnswer.slice(0, 4)) && nd !== normalizedAnswer
  })
  if (suspiciouslyClose.length >= 2) {
    flags.push({
      reason: 'too_similar_to_existing',
      severity: 'warn',
      detail: `${suspiciouslyClose.length} distractors are suspiciously similar to the correct answer`
    })
  }

  return flags
}

/** Calculate community vote result */
export function evaluateCommunityVotes(upvotes: number, downvotes: number, minVotes: number = 5): ReviewResult {
  const totalVotes = upvotes + downvotes
  if (totalVotes < minVotes) {
    return { passed: false, stage: 'community_vote', reason: `Needs ${minVotes - totalVotes} more votes` }
  }
  const approvalRatio = upvotes / totalVotes
  if (approvalRatio >= 0.7) {
    return { passed: true, stage: 'community_vote' }
  }
  return { passed: false, stage: 'community_vote', reason: `Approval ratio ${(approvalRatio * 100).toFixed(0)}% below 70% threshold` }
}
