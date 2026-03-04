import { writable } from 'svelte/store'

export interface WelcomeBackData {
  daysSinceActive: number
  message: string
  rewards: { type: string; amount: number; description: string }[]
  seasonMissed?: { name: string; factsAvailable: number }
  treeGrowth: string
  streakMessage: string
}

/** Whether the welcome back overlay should be shown */
export const showWelcomeBack = writable<boolean>(false)

/** Welcome back data to display */
export const welcomeBackData = writable<WelcomeBackData | null>(null)

/**
 * Check if a welcome back flow should trigger.
 * DD-V2-157: Positives first, never shame.
 */
export function checkWelcomeBack(lastPlayedAt: string, factsLearned: number, bestStreak: number): WelcomeBackData | null {
  const lastPlayed = new Date(lastPlayedAt)
  const now = Date.now()
  const daysSince = Math.floor((now - lastPlayed.getTime()) / (1000 * 60 * 60 * 24))

  // Only trigger for 3+ day absences
  if (daysSince < 3) return null

  const rewards: WelcomeBackData['rewards'] = []

  // Oxygen refill — always
  rewards.push({ type: 'oxygen', amount: 3, description: 'Full oxygen tanks — ready to dive' })

  // Mineral bonus for longer absences
  if (daysSince >= 7) {
    rewards.push({ type: 'minerals', amount: Math.min(daysSince * 50, 5000), description: 'Minerals gathered while you were away' })
  }

  // Seasonal chest for 30+ day absences
  if (daysSince >= 30) {
    rewards.push({ type: 'seasonal_chest', amount: 1, description: 'A chest of seasonal artifacts' })
  }

  // DD-V2-158: Positive streak reframing
  const streakMessage = bestStreak > 0
    ? `Your best streak was ${bestStreak} days. Ready for a new adventure?`
    : 'Every journey starts with a single dive.'

  const treeGrowth = daysSince <= 7
    ? 'a few new buds'
    : daysSince <= 30
    ? 'several new branches'
    : 'an entire new layer of growth'

  const message = daysSince <= 7
    ? `Welcome back! GAIA kept the dome running. ${factsLearned} facts still growing on your tree.`
    : daysSince <= 30
    ? `It's been a while! The dome saved some minerals for you. Your tree stands strong with ${factsLearned} facts.`
    : `The dome never forgot you. ${factsLearned} facts, still growing. Some treasures were set aside for your return.`

  return {
    daysSinceActive: daysSince,
    message,
    rewards,
    treeGrowth,
    streakMessage
  }
}
