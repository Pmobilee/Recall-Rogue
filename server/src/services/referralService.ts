/**
 * @file referralService.ts
 * Server-side referral attribution and fraud prevention.
 * Phase 42.2 extension of the Phase 22 referral scaffold.
 */

/** A referral link click record. */
export interface AttributionClick {
  referralCode: string
  clickedAt: Date
  ipHash: string   // SHA-256 of IP — never store raw IPs
  userAgent: string
}

/** Service configuration injected from balance constants. */
export interface ReferralServiceConfig {
  attributionDays: number
  maxPerYear: number
}

/** Minimal DB interface used by this service. */
interface DbLike {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>
}

/**
 * Record a link click. Idempotent per (code, ipHash, day) — duplicate
 * clicks from the same IP on the same calendar day are ignored.
 *
 * @param db - Database connection with a .query() method.
 * @param click - The click attribution data.
 */
export async function recordLinkClick(
  db: DbLike,
  click: AttributionClick,
): Promise<void> {
  await db.query(
    `INSERT INTO referral_clicks (code, clicked_at, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code, ip_hash, DATE(clicked_at)) DO NOTHING`,
    [click.referralCode, click.clickedAt, click.ipHash, click.userAgent],
  )
}

/**
 * Attempt to attribute a new player registration to a referral code.
 * Returns the referrer's player ID if attribution succeeds, or null if the
 * code is invalid, expired, or the IP has already been attributed today.
 *
 * @param db - Database connection.
 * @param referralCode - The referral code to attribute.
 * @param newPlayerId - The newly registered player's ID.
 * @param ipHash - SHA-256 hash of the installer's IP address.
 * @param config - Attribution window and fraud prevention config.
 * @returns Referrer's player ID if attribution succeeded, null otherwise.
 */
export async function attributeInstall(
  db: DbLike,
  referralCode: string,
  newPlayerId: string,
  ipHash: string,
  config: ReferralServiceConfig,
): Promise<string | null> {
  // Look up the referrer
  const referrer = await db.query<{ player_id: string; created_at: Date }>(
    `SELECT player_id, created_at FROM referral_codes WHERE code = $1`,
    [referralCode],
  )
  if (!referrer.rows.length) return null

  const referrerId = referrer.rows[0].player_id
  if (referrerId === newPlayerId) return null  // cannot refer yourself

  // Check attribution window: click must exist within last N days
  const windowStart = new Date(Date.now() - config.attributionDays * 86_400_000)
  const click = await db.query(
    `SELECT 1 FROM referral_clicks
     WHERE code = $1 AND ip_hash = $2 AND clicked_at >= $3
     LIMIT 1`,
    [referralCode, ipHash, windowStart],
  )
  if (!click.rows.length) return null   // no click within window from this IP

  // IP dedup: same IP cannot qualify more than once per referrer per day
  const dupCheck = await db.query(
    `SELECT 1 FROM referral_installs
     WHERE referrer_id = $1 AND ip_hash = $2
       AND installed_at >= NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [referrerId, ipHash],
  )
  if (dupCheck.rows.length) return null

  // Insert install record
  await db.query(
    `INSERT INTO referral_installs
       (referrer_id, referred_player_id, ip_hash, installed_at)
     VALUES ($1, $2, $3, NOW())`,
    [referrerId, newPlayerId, ipHash],
  )

  return referrerId
}

/** Return shape for qualifyReferral. */
export interface QualifyResult {
  newCount: number
  newRewardThresholds: number[]
}

/**
 * Mark a referral as qualified (new player completed first dive).
 * Increments the referrer's qualified count and appends pending reward tiers.
 * Enforces the yearly cap.
 *
 * @param db - Database connection.
 * @param referrerId - Player ID of the referrer.
 * @param referredPlayerId - Player ID of the newly qualified player.
 * @param config - Attribution window and yearly cap configuration.
 * @returns The new qualified count and any newly crossed reward thresholds.
 */
export async function qualifyReferral(
  db: DbLike,
  referrerId: string,
  referredPlayerId: string,
  config: ReferralServiceConfig,
): Promise<QualifyResult> {
  void referredPlayerId // reserved for audit logging

  // Fetch current stats
  const stats = await db.query<{
    qualified_count: number
    yearly_count: number
    yearly_reset_date: string
  }>(
    `SELECT qualified_count, yearly_count, yearly_reset_date
     FROM player_referral_stats WHERE player_id = $1`,
    [referrerId],
  )

  let qualifiedCount = stats.rows[0]?.qualified_count ?? 0
  let yearlyCount    = stats.rows[0]?.yearly_count ?? 0
  const resetDate    = stats.rows[0]?.yearly_reset_date
    ? new Date(stats.rows[0].yearly_reset_date)
    : new Date(new Date().getFullYear() + 1, 0, 1)  // next Jan 1

  // Reset yearly counter if past reset date
  if (new Date() >= resetDate) {
    yearlyCount = 0
  }

  if (yearlyCount >= config.maxPerYear) return { newCount: qualifiedCount, newRewardThresholds: [] }

  qualifiedCount += 1
  yearlyCount    += 1

  // Determine newly crossed reward thresholds
  // Import balance constants using a dynamic require to avoid circular dep
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { REFERRAL_REWARD_TIERS } = require('../../src/data/balance') as {
    REFERRAL_REWARD_TIERS: Array<{ threshold: number }>
  }
  const prevCount = qualifiedCount - 1
  const newThresholds = REFERRAL_REWARD_TIERS
    .filter((t) => t.threshold > prevCount && t.threshold <= qualifiedCount)
    .map((t) => t.threshold)

  // Upsert stats
  await db.query(
    `INSERT INTO player_referral_stats
       (player_id, qualified_count, yearly_count, yearly_reset_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id) DO UPDATE
     SET qualified_count = $2, yearly_count = $3`,
    [referrerId, qualifiedCount, yearlyCount, resetDate],
  )

  return { newCount: qualifiedCount, newRewardThresholds: newThresholds }
}
