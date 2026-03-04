/**
 * Player segmentation for mastery-free monitoring (DD-V2-152).
 * Internal analytics only — never visible to players.
 */

export interface PlayerSegmentReport {
  masteryFreeCount: number
  subscriberCount: number
  inactiveCount: number
  totalD30Active: number
  masteryFreePercent: number
  threshold: number
  status: 'ok' | 'review' | 'tighten'
}

/**
 * Compute player segments for mastery-free monitoring.
 * In production, this runs against the analytics database.
 *
 * Definitions:
 * - Mastery-free: D30 active, never purchased IAP/subscription, last dive with tank bank > 0
 * - Subscriber: active Terra Pass or Patron subscription at D30
 * - Inactive: not active in last 30 days
 */
export function computePlayerSegments(_cohortDate: Date): PlayerSegmentReport {
  // Stub implementation — production uses PostgreSQL queries
  // See Phase 21 doc for full SQL query
  const masteryFreeCount = 0
  const subscriberCount = 0
  const inactiveCount = 0
  const totalD30Active = masteryFreeCount + subscriberCount

  const masteryFreePercent = totalD30Active > 0
    ? (masteryFreeCount / totalD30Active) * 100
    : 0

  let status: 'ok' | 'review' | 'tighten'
  if (masteryFreePercent > 40) {
    status = 'tighten'
  } else if (masteryFreePercent >= 30) {
    status = 'review'
  } else {
    status = 'ok'
  }

  return {
    masteryFreeCount,
    subscriberCount,
    inactiveCount,
    totalD30Active,
    masteryFreePercent,
    threshold: 30,
    status,
  }
}
