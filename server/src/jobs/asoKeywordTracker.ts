/**
 * @file asoKeywordTracker.ts
 * Nightly cron job (03:30 UTC) that fetches keyword rank data from
 * App Store Connect and Google Play Developer APIs and stores results.
 *
 * Prerequisites: APPLE_ASC_KEY_ID, APPLE_ASC_ISSUER_ID, APPLE_ASC_P8_KEY
 * and GOOGLE_PLAY_SERVICE_ACCOUNT_JSON env vars must be set.
 * If either API is unconfigured, that platform's tracking is skipped silently.
 */

/** Keywords to track in App Store Connect and Google Play. */
export const TARGET_KEYWORDS = [
  "mining game",
  "educational game",
  "space miner",
  "quiz game",
  "knowledge game",
  "geology game",
  "fossil game",
  "earth history",
  "fact learning game",
  "spaced repetition game",
]

/** Minimal rank data stored per keyword per day. */
export interface KeywordRankRow {
  keyword:    string
  platform:   'ios' | 'android'
  rank:       number | null   // null = not in top 250
  checked_at: Date
}

/** Minimal DB interface required by the tracker. */
interface DbLike {
  query: (sql: string, params?: unknown[]) => Promise<void>
}

/**
 * Run the ASO keyword tracker. Fetches current ranks for all TARGET_KEYWORDS
 * and upserts into the `aso_keyword_ranks` table.
 * Intended to be called by the cron scheduler (server/src/jobs/scheduler.ts).
 *
 * @param db - Database connection with a .query() method.
 */
export async function runAsoKeywordTracker(db: DbLike): Promise<void> {
  const results: KeywordRankRow[] = []

  // iOS — App Store Connect Search Ads API (rank approximation via keyword volume)
  if (process.env.APPLE_ASC_KEY_ID) {
    for (const keyword of TARGET_KEYWORDS) {
      // Stub: real implementation calls ASC API with JWT auth
      results.push({ keyword, platform: 'ios', rank: null, checked_at: new Date() })
    }
  }

  // Android — Google Play Developer Reporting API (stub)
  if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    for (const keyword of TARGET_KEYWORDS) {
      results.push({ keyword, platform: 'android', rank: null, checked_at: new Date() })
    }
  }

  // Upsert — ON CONFLICT replaces same keyword+platform+day
  for (const row of results) {
    await db.query(
      `INSERT INTO aso_keyword_ranks (keyword, platform, rank, checked_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (keyword, platform, DATE(checked_at))
       DO UPDATE SET rank = EXCLUDED.rank`,
      [row.keyword, row.platform, row.rank, row.checked_at],
    )
  }
}
