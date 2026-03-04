/** Win-back tier based on churn duration */
export type WinBackTier = 'gentle_nudge' | 'gaia_letter' | 'seasonal_chest' | 'deep_win_back'

export interface WinBackAction {
  tier: WinBackTier
  daysSinceActive: number
  action: string
  channel: 'push' | 'email' | 'in_app'
}

/**
 * DD-V2-160: Win-back tiers based on days since last activity.
 * Never shame. Always lead with positives.
 */
const WIN_BACK_TIERS: WinBackAction[] = [
  { tier: 'gentle_nudge', daysSinceActive: 3, action: 'Single push notification from GAIA', channel: 'push' },
  { tier: 'gentle_nudge', daysSinceActive: 7, action: 'Push stops (DD-V2-159: auto-stop at 7 days)', channel: 'push' },
  { tier: 'gaia_letter', daysSinceActive: 14, action: 'GAIA Letter email with tree growth summary', channel: 'email' },
  { tier: 'seasonal_chest', daysSinceActive: 30, action: 'Seasonal Chest waiting in dome on return', channel: 'in_app' },
  { tier: 'deep_win_back', daysSinceActive: 60, action: 'Final GAIA email with exclusive return cosmetic', channel: 'email' }
]

/**
 * Determine the appropriate win-back action for a player
 */
export function getWinBackAction(daysSinceActive: number): WinBackAction | null {
  // Find the most recent tier that applies
  const applicable = WIN_BACK_TIERS.filter(t => daysSinceActive >= t.daysSinceActive)
  if (applicable.length === 0) return null
  return applicable[applicable.length - 1]
}

/**
 * Calculate what a returning player should receive (DD-V2-157: positives first)
 */
export function calculateWelcomeBackRewards(daysSinceActive: number, factsLearned: number, _currentStreak: number): {
  message: string
  rewards: { type: string; amount: number; description: string }[]
} {
  const rewards: { type: string; amount: number; description: string }[] = []

  // Always show tree growth (passive growth simulation: ~0.1 leaves/day)
  // treeGrowthEstimate = Math.floor(daysSinceActive * 0.1) — used in welcome message copy

  // Mineral gift scales with absence
  if (daysSinceActive >= 7) {
    rewards.push({ type: 'minerals', amount: Math.min(daysSinceActive * 50, 5000), description: 'Minerals collected while you were away' })
  }

  // Seasonal chest if missed an event
  if (daysSinceActive >= 30) {
    rewards.push({ type: 'seasonal_chest', amount: 1, description: 'A chest of seasonal artifacts, saved for your return' })
  }

  // Oxygen refill
  rewards.push({ type: 'oxygen_refill', amount: 3, description: 'Full oxygen tanks — ready to dive' })

  // DD-V2-157: Message is always positive, never shaming
  const message = daysSinceActive <= 7
    ? `Welcome back! GAIA kept the dome running. ${factsLearned} facts still growing on your tree.`
    : daysSinceActive <= 30
    ? `It's been a while! The dome saved some minerals for you. Your tree still stands strong with ${factsLearned} facts.`
    : `The dome never forgot you. ${factsLearned} facts, still growing. Some seasonal treasures were set aside for your return.`

  return { message, rewards }
}

/**
 * DD-V2-158: Positive streak reframing — celebrate, never weaponize
 */
export function getStreakMessage(currentStreak: number, bestStreak: number): string {
  if (currentStreak === 0) {
    return bestStreak > 0
      ? `Your best streak was ${bestStreak} days. Start a new one today?`
      : 'Every journey starts with one dive. Ready?'
  }
  if (currentStreak >= bestStreak) {
    return `New personal best: ${currentStreak} days! The tree is glowing.`
  }
  return `${currentStreak} days and counting. The tree remembers each one.`
}
