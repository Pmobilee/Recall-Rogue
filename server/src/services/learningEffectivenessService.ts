/** Learning effectiveness metrics for annual report */
export interface LearningEffectivenessReport {
  period: { start: string; end: string }
  totalPlayers: number
  activeLearners: number   // Players who completed >= 10 study sessions
  metrics: {
    averageRetentionRate: number         // % of facts retained at 30-day retest
    medianFactsMastered: number          // Median facts reaching "mastered" status
    averageDailyStudyMinutes: number     // Mean daily study session length
    completionRate: number               // % of players who mastered >= 50% of attempted facts
    sm2EffectivenessScore: number        // Average ease factor across all players (higher = better recall)
    streakCorrelation: number            // Correlation between streak length and retention rate
    categoryMasteryDistribution: Record<string, number>  // % mastery by category
  }
  cohorts: {
    name: string
    size: number
    retentionRate: number
    factsMastered: number
  }[]
}

/**
 * Calculate learning effectiveness metrics from player data.
 * DD-V2-179: Annual report with independent research partner.
 */
export function calculateEffectivenessMetrics(
  playerData: {
    reviewStates: { easeFactor: number; interval: number; repetitions: number }[]
    factsLearned: number
    studySessionMinutes: number[]
    streakDays: number
  }[]
): LearningEffectivenessReport['metrics'] {
  if (playerData.length === 0) {
    return {
      averageRetentionRate: 0,
      medianFactsMastered: 0,
      averageDailyStudyMinutes: 0,
      completionRate: 0,
      sm2EffectivenessScore: 2.5,
      streakCorrelation: 0,
      categoryMasteryDistribution: {}
    }
  }

  // Average retention rate: % of review states with interval >= 30 days
  const allStates = playerData.flatMap(p => p.reviewStates)
  const retainedStates = allStates.filter(s => s.interval >= 30)
  const averageRetentionRate = allStates.length > 0 ? retainedStates.length / allStates.length : 0

  // Median facts mastered
  const factCounts = playerData.map(p => p.factsLearned).sort((a, b) => a - b)
  const medianFactsMastered = factCounts[Math.floor(factCounts.length / 2)] ?? 0

  // Average daily study minutes
  const allMinutes = playerData.flatMap(p => p.studySessionMinutes)
  const averageDailyStudyMinutes = allMinutes.length > 0
    ? allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length
    : 0

  // Completion rate
  const completedPlayers = playerData.filter(p => {
    const mastered = p.reviewStates.filter(s => s.interval >= 60).length
    return mastered / Math.max(1, p.reviewStates.length) >= 0.5
  })
  const completionRate = completedPlayers.length / playerData.length

  // SM-2 effectiveness (average ease factor)
  const avgEase = allStates.length > 0
    ? allStates.reduce((a, s) => a + s.easeFactor, 0) / allStates.length
    : 2.5

  // Streak-retention correlation (simplified Pearson)
  const streaks = playerData.map(p => p.streakDays)
  const retentions = playerData.map(p => {
    const states = p.reviewStates
    const retained = states.filter(s => s.interval >= 30).length
    return states.length > 0 ? retained / states.length : 0
  })
  const streakCorrelation = calculateCorrelation(streaks, retentions)

  return {
    averageRetentionRate,
    medianFactsMastered,
    averageDailyStudyMinutes,
    completionRate,
    sm2EffectivenessScore: avgEase,
    streakCorrelation,
    categoryMasteryDistribution: {}  // Populated per-category in production
  }
}

/** Simplified Pearson correlation coefficient */
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i]!, 0)
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0)
  const sumY2 = y.reduce((a, yi) => a + yi * yi, 0)
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Generate anonymized data export for research partners.
 * DD-V2-179: No PII, only aggregate and anonymized metrics.
 */
export function exportAnonymizedData(
  playerData: { reviewStates: { interval: number; repetitions: number; easeFactor: number }[] }[]
): { anonymizedPlayers: { id: string; metrics: Record<string, number> }[] } {
  return {
    anonymizedPlayers: playerData.map((p, i) => ({
      id: `anon-${i.toString(36).padStart(6, '0')}`,
      metrics: {
        totalFacts: p.reviewStates.length,
        masteredFacts: p.reviewStates.filter(s => s.interval >= 60).length,
        averageEaseFactor: p.reviewStates.length > 0
          ? p.reviewStates.reduce((a, s) => a + s.easeFactor, 0) / p.reviewStates.length
          : 2.5,
        averageInterval: p.reviewStates.length > 0
          ? p.reviewStates.reduce((a, s) => a + s.interval, 0) / p.reviewStates.length
          : 0
      }
    }))
  }
}
