/**
 * @file viralMetrics.ts
 * Computes K-factor, referral funnel conversion rates, and
 * share-to-install rate from raw analytics events.
 *
 * K-factor formula:
 *   K = (shares_per_active_user_30d) × (referral_install_rate)
 *
 * Where:
 *   shares_per_active_user_30d = COUNT(referral_link_shared events in last 30d)
 *                                / COUNT(distinct active players in last 30d)
 *   referral_install_rate      = COUNT(referral_converted events in last 30d)
 *                                / COUNT(referral_link_shared events in last 30d)
 */

export interface ViralMetricsReport {
  kFactor:              number
  sharesPerActiveUser:  number
  referralInstallRate:  number
  installToFirstDivePct: number  // % of referral installs that complete first dive
  shareCardGenerated30d: number
  referralLinksShared30d: number
  referralConverted30d:   number
  badgesShared30d:        number
  topTemplate:           string  // most-shared card template in last 30d
  computedAt:            Date
}

/** Minimal DB interface required by this analytics module. */
interface DbLike {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>
}

/** Row shape for count queries. */
interface CountRow {
  count: string
}

/** Row shape for count + template queries. */
interface TemplateCountRow {
  count: string
  template: string
}

/**
 * Compute viral metrics from analytics events in the last N days.
 * All queries run against the `analytics_events` table populated by
 * the existing analytics pipeline (Phase 19.7).
 *
 * @param db - Database connection.
 * @param windowDays - Number of days to look back (default: 30).
 * @returns A ViralMetricsReport snapshot.
 */
export async function computeViralMetrics(
  db: DbLike,
  windowDays = 30,
): Promise<ViralMetricsReport> {
  const since = new Date(Date.now() - windowDays * 86_400_000)

  const [shared, converted, activeUsers, cardGen, badgeShared] = await Promise.all([
    db.query<CountRow>(`
      SELECT COUNT(*) AS count FROM analytics_events
      WHERE name = 'referral_link_shared' AND created_at >= $1`, [since]),
    db.query<CountRow>(`
      SELECT COUNT(*) AS count FROM analytics_events
      WHERE name = 'referral_converted' AND created_at >= $1`, [since]),
    db.query<CountRow>(`
      SELECT COUNT(DISTINCT player_id) AS count FROM analytics_events
      WHERE created_at >= $1`, [since]),
    db.query<TemplateCountRow>(`
      SELECT COUNT(*) AS count, properties->>'template' AS template
      FROM analytics_events
      WHERE name = 'share_card_generated' AND created_at >= $1
      GROUP BY template ORDER BY count DESC LIMIT 1`, [since]),
    db.query<CountRow>(`
      SELECT COUNT(*) AS count FROM analytics_events
      WHERE name = 'badge_shared' AND created_at >= $1`, [since]),
  ])

  const sharesN    = parseInt(shared.rows[0]?.count ?? '0', 10)
  const convertN   = parseInt(converted.rows[0]?.count ?? '0', 10)
  const activeN    = parseInt(activeUsers.rows[0]?.count ?? '1', 10)
  const cardGenN   = parseInt(cardGen.rows[0]?.count ?? '0', 10)
  const badgeShareN = parseInt(badgeShared.rows[0]?.count ?? '0', 10)

  const sharesPerUser  = activeN > 0 ? sharesN / activeN : 0
  const installRate    = sharesN > 0 ? convertN / sharesN : 0
  const kFactor        = sharesPerUser * installRate

  // First-dive completion: referral_converted / referral installs (approximated by shares)
  const installToFirstDive = sharesN > 0 ? convertN / sharesN : 0

  return {
    kFactor:               Math.round(kFactor * 1000) / 1000,
    sharesPerActiveUser:   Math.round(sharesPerUser * 1000) / 1000,
    referralInstallRate:   Math.round(installRate * 1000) / 1000,
    installToFirstDivePct: Math.round(installToFirstDive * 100 * 10) / 10,
    shareCardGenerated30d:  cardGenN,
    referralLinksShared30d: sharesN,
    referralConverted30d:   convertN,
    badgesShared30d:        badgeShareN,
    topTemplate:            cardGen.rows[0]?.template ?? 'none',
    computedAt:             new Date(),
  }
}
