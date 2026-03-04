/**
 * @file reviewPromptService.ts
 * Manages when to surface the native in-app review prompt.
 *
 * Trigger rules (DD-V2-150):
 * - Player has completed at least 5 dives
 * - Player has mastered at least 10 facts
 * - Player has NOT been prompted in the last 90 days
 * - Prompt fires at most once per app install lifecycle
 * - Fires after a positive moment: streak milestone, fact mastery milestone,
 *   or dive personal best — never mid-session or after a death
 */

const REVIEW_PROMPT_KEY      = 'terra-review-prompt-last'
const REVIEW_PROMPT_COOLDOWN = 90 * 24 * 60 * 60 * 1000  // 90 days in ms
const MIN_DIVES_BEFORE_PROMPT = 5
const MIN_FACTS_BEFORE_PROMPT = 10

export interface ReviewEligibilityData {
  totalDives:     number
  masteredFacts:  number
  wasPositiveMoment: boolean  // set to true by caller on streak/mastery/PB events
}

/**
 * Check whether the review prompt should fire now.
 * Returns true if all conditions are met; false otherwise.
 *
 * @param data - Eligibility data for the current player.
 * @returns True when the prompt should be shown.
 */
export function shouldShowReviewPrompt(data: ReviewEligibilityData): boolean {
  if (!data.wasPositiveMoment) return false
  if (data.totalDives < MIN_DIVES_BEFORE_PROMPT) return false
  if (data.masteredFacts < MIN_FACTS_BEFORE_PROMPT) return false

  const lastPrompted = parseInt(
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem(REVIEW_PROMPT_KEY) ?? '0')
      : '0',
    10,
  )
  if (Date.now() - lastPrompted < REVIEW_PROMPT_COOLDOWN) return false

  return true
}

/**
 * Fire the native in-app review prompt via Capacitor StoreReview plugin.
 * Records the prompt timestamp to enforce cooldown.
 * Never throws — failures are silently absorbed.
 */
export async function fireReviewPrompt(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REVIEW_PROMPT_KEY, String(Date.now()))
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPlugin } = require('@capacitor/core') as typeof import('@capacitor/core')
    const StoreReview = registerPlugin<{ requestReview: () => Promise<void> }>('StoreReview')
    await StoreReview.requestReview()
  } catch { /* plugin not available on web or error — ignore */ }
}
