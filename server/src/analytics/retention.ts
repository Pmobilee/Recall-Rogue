/**
 * Retention metrics computation (DD-V2-155).
 * D1/D7/D30 retention tracking with targets.
 * D7 is the primary success metric.
 */

export interface RetentionMetric {
  target: number
  actual: number | null
  status: 'above' | 'at' | 'below' | 'insufficient_data'
  isPrimaryMetric?: boolean
}

export interface RetentionReport {
  d1: RetentionMetric
  d7: RetentionMetric
  d30: RetentionMetric
  cohortDate: string
  sampleSize: number
}

/**
 * Compute retention report for a given cohort date.
 * In production, queries analytics_events table with cohort-based retention SQL.
 */
export function computeRetention(cohortDate: Date): RetentionReport {
  // Stub implementation — production uses PostgreSQL queries
  // See Phase 21 doc for full SQL query
  return {
    d1: {
      target: 0.45,
      actual: null,
      status: 'insufficient_data',
    },
    d7: {
      target: 0.20,
      actual: null,
      status: 'insufficient_data',
      isPrimaryMetric: true,
    },
    d30: {
      target: 0.10,
      actual: null,
      status: 'insufficient_data',
    },
    cohortDate: cohortDate.toISOString().split('T')[0],
    sampleSize: 0,
  }
}

/** Get status based on actual vs target */
export function getRetentionStatus(actual: number | null, target: number): RetentionMetric['status'] {
  if (actual === null) return 'insufficient_data'
  if (actual >= target * 1.05) return 'above'
  if (actual >= target * 0.95) return 'at'
  return 'below'
}
