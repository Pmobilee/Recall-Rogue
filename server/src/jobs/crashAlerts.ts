/**
 * Crash alert job — post-launch iOS monitoring (Phase 38).
 * Runs every 5 minutes (configured in the job scheduler).
 * If the iOS crash rate in the last hour exceeds 2%, sends an alert to
 * the team via the configured notification channel (Slack/email).
 *
 * Crash rate = (unique crash reports / active sessions) in last 60 minutes.
 * Only iOS platform is monitored here; Android uses a separate alert threshold.
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

/**
 * Send an alert to the team when the crash rate exceeds threshold.
 * In production this should integrate with Slack webhooks, PagerDuty, or email.
 *
 * @param message - The alert message to send.
 */
async function sendAlert(message: string): Promise<void> {
  // Log to server stdout as a fallback (always works regardless of integration).
  console.error(`[CrashAlert] ${new Date().toISOString()} — ${message}`)

  // TODO(codex): [integration] wire crash alerts to Slack/email/PagerDuty channel — needs human decision
  // Example Slack webhook:
  // const webhookUrl = process.env.SLACK_CRASH_WEBHOOK
  // if (webhookUrl) {
  //   await fetch(webhookUrl, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ text: `[ALERT] ${message}` }),
  //   })
  // }
}

/**
 * Check the iOS crash rate for the last hour and alert if it exceeds 2%.
 *
 * @param sqliteDb - The raw better-sqlite3 database instance.
 */
export async function checkCrashRate(sqliteDb: BetterSqliteDatabase): Promise<void> {
  const oneHourAgo = Date.now() - 3600000

  const crashResult = sqliteDb.prepare<[number], { count: number }>(
    `SELECT COUNT(*) as count FROM error_reports WHERE ts > ? AND platform = 'ios'`
  ).get(oneHourAgo)

  const sessionResult = sqliteDb.prepare<[number], { count: number }>(
    `SELECT COUNT(DISTINCT session_id) as count FROM analytics_events
     WHERE ts > ? AND platform = 'ios'`
  ).get(oneHourAgo)

  const crashCount = Number(crashResult?.count ?? 0)
  const sessionCount = Math.max(Number(sessionResult?.count ?? 0), 1)
  const rate = crashCount / sessionCount

  if (rate > 0.02) {
    await sendAlert(
      `iOS crash rate elevated: ${(rate * 100).toFixed(1)}% in the last hour ` +
      `(${crashCount} crashes / ${sessionCount} sessions)`
    )
  }
}

/**
 * Day-7 post-launch review helper.
 * Logs a summary of first-week metrics to stdout for the team review protocol.
 *
 * @param sqliteDb - The raw better-sqlite3 database instance.
 */
export async function logDay7Metrics(sqliteDb: BetterSqliteDatabase): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 86_400_000
  const oneDayWindow = sevenDaysAgo + 86_400_000

  const installResult = sqliteDb.prepare<[number], { count: number }>(
    `SELECT COUNT(DISTINCT user_id) as count FROM analytics_events
     WHERE name = 'app_open' AND ts < ? AND platform = 'ios'`
  ).get(oneDayWindow)

  const retainedResult = sqliteDb.prepare<[number], { count: number }>(
    `SELECT COUNT(DISTINCT user_id) as count FROM analytics_events
     WHERE name = 'app_open' AND ts > ? AND platform = 'ios'`
  ).get(sevenDaysAgo)

  const d1Installs = Number(installResult?.count ?? 0)
  const d7Active = Number(retainedResult?.count ?? 0)
  const d7Retention = d1Installs > 0
    ? ((d7Active / d1Installs) * 100).toFixed(1)
    : 'N/A'

  console.log(
    `[Day7Review] D1 installs: ${d1Installs}, D7 active: ${d7Active}, ` +
    `D7 retention: ${d7Retention}%`
  )
}
