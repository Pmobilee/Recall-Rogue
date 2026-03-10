/**
 * Ad service stub (DD-V2-146).
 * Recall Rogue is completely ad-free at launch.
 * This stub exists for future opt-in rewarded ads, feature-flagged OFF.
 */

/** Feature flag — MUST be false at launch */
const FEATURE_REWARDED_ADS = false

/**
 * Show an opt-in rewarded ad.
 * Currently disabled — always returns { rewarded: false }.
 * If ever enabled, ads will be: opt-in only, rewarded only, never during gameplay/quizzes.
 */
export async function showRewardedAd(): Promise<{ rewarded: boolean }> {
  if (!FEATURE_REWARDED_ADS) return { rewarded: false }
  // RevenueCat or AdMob integration would go here when enabled
  return { rewarded: false }
}

/** Check if rewarded ads are available */
export function isRewardedAdAvailable(): boolean {
  return FEATURE_REWARDED_ADS
}
