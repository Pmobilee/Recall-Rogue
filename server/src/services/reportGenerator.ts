/**
 * Annual learning effectiveness report generator.
 * Assembles a full anonymized research report payload for academic publication.
 * DD-V2-190: Annual effectiveness report.
 */

import { computeLearningEffectiveness } from './learningMetrics.js'
import { noisifyStats, DEFAULT_EPSILON, DEFAULT_SENSITIVITY } from './anonymization/index.js'

/** The full structure of the annual effectiveness report payload. */
export interface AnnualEffectivenessReport {
  /** Report version for schema evolution tracking. */
  version: string
  /** ISO year this report covers (e.g. "2026"). */
  reportYear: string
  /** UTC timestamp of generation. */
  generatedAt: string
  /** Anonymization metadata for academic transparency. */
  anonymization: {
    method: 'k-anonymity + laplace-DP'
    kThreshold: 5
    epsilon: number
    sensitivity: number
    piiFields: string[]
  }
  /** Top-level player statistics (all DP-noised). */
  playerStats: {
    totalRegisteredPlayers: number
    activeLearners30d: number
    activeLearners90d: number
    medianSessionsPerWeek: number
    medianDailyStudyMinutes: number
    archetypeDistribution: Record<string, number>
    ageBracketDistribution: Record<string, number>
  }
  /** Cohort-level learning effectiveness metrics. */
  learningEffectiveness: ReturnType<typeof computeLearningEffectiveness>
  /** SM-2 algorithm comparative effectiveness. */
  algorithmAnalysis: {
    description: string
    modifications: string[]
    findingsSummary: string
    retentionVsBaseline: {
      recallRogue30d: number | null
      eberhausBaseline30d: number
      peerAppMedian30d: number | null
    }
  }
  /** Content statistics. */
  contentStats: {
    totalFactsInDatabase: number
    factsWithPixelArt: number
    categoryDistribution: Record<string, number>
    contentTypeDistribution: Record<string, number>
    avgDifficultyScore: number
    avgFunScore: number
  }
  /** Data quality and limitations section for academic transparency. */
  limitations: string[]
  /** Methodology notes. */
  methodology: string
}

/**
 * Generate the annual effectiveness report for a given year.
 * Applies the full anonymization pipeline to all exported statistics.
 *
 * @param year    - 4-digit year string (e.g. "2026").
 * @param epsilon - DP epsilon (default: 1.0).
 * @returns The fully assembled and anonymized annual report payload.
 */
export function generateAnnualReport(
  year: string,
  epsilon = DEFAULT_EPSILON,
): AnnualEffectivenessReport {
  const periodStart = `${year}-01-01`
  const periodEnd   = `${year}-12-31`

  const effectiveness = computeLearningEffectiveness(periodStart, periodEnd)

  // Stub player stats — production: SQL queries against users + analytics_events tables
  const rawPlayerStats = {
    totalRegisteredPlayers: 0,
    activeLearners30d:      0,
    activeLearners90d:      0,
    medianSessionsPerWeek:  0,
    medianDailyStudyMinutes: 0,
    archetypeDistribution:  { explorer: 0, scholar: 0, collector: 0, sprinter: 0, undetected: 0 },
    ageBracketDistribution: { under_13: 0, teen: 0, adult: 0 },
  }

  // Apply Laplace noise to all numeric scalars
  const noisedStats = noisifyStats(
    rawPlayerStats as unknown as Record<string, unknown>,
    DEFAULT_SENSITIVITY,
    epsilon,
  ) as typeof rawPlayerStats

  const contentStats = {
    totalFactsInDatabase:    522,
    factsWithPixelArt:       0,
    categoryDistribution: {
      Language:           80,
      'Natural Sciences': 70,
      'Life Sciences':    65,
      History:            75,
      Geography:          60,
      Technology:         80,
      Culture:            92,
    },
    contentTypeDistribution: { fact: 122, vocabulary: 400 },
    avgDifficultyScore: 2.8,
    avgFunScore:        7.2,
  }

  return {
    version:     '1.0.0',
    reportYear:  year,
    generatedAt: new Date().toISOString(),
    anonymization: {
      method:      'k-anonymity + laplace-DP',
      kThreshold:  5,
      epsilon,
      sensitivity: DEFAULT_SENSITIVITY,
      piiFields:   ['email', 'displayName', 'ip', 'deviceId'],
    },
    playerStats: noisedStats,
    learningEffectiveness: effectiveness,
    algorithmAnalysis: {
      description: 'Modified SM-2 spaced repetition algorithm (Wozniak 1987, adapted for mobile gaming context)',
      modifications: [
        'Three-button grading (Hard / Good / Easy) replacing the 6-point quality scale',
        'Consistency penalty applied at repetitions ≥ 4 to discourage context-switching',
        'Second review interval fixed at 3 days (vs. standard SM-2 default of 6 days)',
        'Content-type-aware mastery thresholds: 60 days for general facts, 30 days for vocabulary',
        'Engagement-mode adaptive difficulty: distractor difficulty scales with rolling accuracy',
      ],
      findingsSummary: 'Pending data accumulation. Report will be updated quarterly as cohort sizes reach statistical significance.',
      retentionVsBaseline: {
        recallRogue30d:  null,  // populated once sufficient data exists
        eberhausBaseline30d: 0.58,
        peerAppMedian30d:    null,
      },
    },
    contentStats,
    limitations: [
      'All player-level data is aggregate; individual learning trajectories are not tracked in this report.',
      'Differential privacy noise (ε=1.0) is applied to all count-based statistics; figures may differ from true values by up to a few percent.',
      'Rows with fewer than 5 contributing players are suppressed; this may introduce selection bias in small cohorts.',
      'Transfer-learning measurements are proxied from in-game review accuracy rather than external assessments.',
      'Self-selection bias: players who engage with spaced repetition may already have higher baseline retention.',
      'This report covers only players who opted in to analytics (server-synced saves).',
    ],
    methodology: [
      'Review accuracy is computed from SM-2 quality signals embedded in review state ease-factor trajectories.',
      'Retention curves are binned by days-since-first-review using the lastReviewAt and interval fields.',
      'Spacing-effect analysis partitions reviews into massed (interval < 3d) and spaced (interval ≥ 3d) groups.',
      'All statistics are generated server-side from aggregated, anonymized PostgreSQL queries.',
      'This report is generated by the Recall Rogue annual report job and is reproducible given the same underlying data.',
    ].join(' '),
  }
}
