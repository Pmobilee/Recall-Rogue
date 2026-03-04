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
