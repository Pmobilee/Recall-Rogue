/**
 * Retention alert job (Phase 41.5).
 * Checks D7 retention for the most recent complete cohort (7 days ago).
 * Fires an alert if retention has dropped below threshold.
 *
 * Run with: setInterval(() => runRetentionAlertJob(), 60 * 60 * 1000)
 */

import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { analyticsEvents } from '../db/schema.js'
import { computeRetention } from '../routes/analytics.js'
import { sendEmail } from '../services/emailService.js'
import { config } from '../config.js'

const D7_TARGET = 0.20
const ALERT_THRESHOLD = 0.05  // alert if actual < target - 5pp

interface AlertState {
  lastAlertSentAt: number | null
  consecutiveBreaches: number
}

// In-memory state to avoid alert spam (one alert per breach per hour)
const alertState: AlertState = { lastAlertSentAt: null, consecutiveBreaches: 0 }

/**
 * Run the D7 retention alert job.
 * Checks retention for the cohort from 7 days ago and fires an alert
 * if retention is below the alert threshold.
 *
 * @returns Object with alerted flag and the computed d7Rate.
 */
export async function runRetentionAlertJob(): Promise<{ alerted: boolean; d7Rate: number | null }> {
  // Cohort = 7 days ago (earliest cohort with a complete D7 window)
  const cohortDate = new Date()
  cohortDate.setDate(cohortDate.getDate() - 7)

  const since = cohortDate.getTime() - 86_400_000  // one day before cohort for safety
  const events = await db
    .select({
      sessionId: analyticsEvents.sessionId,
      eventName: analyticsEvents.eventName,
      createdAt: analyticsEvents.createdAt,
    })
    .from(analyticsEvents)
    .where(sql`${analyticsEvents.createdAt} >= ${since}`)
    .all()

  const report = computeRetention(cohortDate, events)
  const d7Rate = report.d7.actual

  if (d7Rate === null) return { alerted: false, d7Rate: null }

  const isBreaching = d7Rate < D7_TARGET - ALERT_THRESHOLD

  if (isBreaching) {
    alertState.consecutiveBreaches++

    // Rate-limit: only send one alert per hour
    const now = Date.now()
    const cooldownMs = 60 * 60 * 1000
    if (alertState.lastAlertSentAt === null || now - alertState.lastAlertSentAt >= cooldownMs) {
      alertState.lastAlertSentAt = now
      await fireRetentionAlert(d7Rate, alertState.consecutiveBreaches)
      return { alerted: true, d7Rate }
    }
  } else {
    alertState.consecutiveBreaches = 0
  }

  return { alerted: false, d7Rate }
}

async function fireRetentionAlert(actual: number, breachCount: number): Promise<void> {
  const pctActual = (actual * 100).toFixed(1)
  const pctTarget = (D7_TARGET * 100).toFixed(1)
  const subject = `[Recall Rogue] D7 Retention Alert — ${pctActual}% (target: ${pctTarget}%)`
  const body = [
    `D7 retention has fallen below the alert threshold.`,
    ``,
    `Actual:  ${pctActual}%`,
    `Target:  ${pctTarget}%`,
    `Gap:     ${((D7_TARGET - actual) * 100).toFixed(1)}pp below target`,
    `Consecutive hourly breaches: ${breachCount}`,
    ``,
    `Check the dashboard: ${config.serverUrl ?? 'http://localhost:3001'}/api/admin/dashboard`,
  ].join('\n')

  console.error(`[RetentionAlert] ${subject}`)

  if (config.alertEmail) {
    try {
      await sendEmail({
        to: config.alertEmail,
        subject,
        template: 'win_back',
        variables: { body, subject },
      })
    } catch (err) {
      console.error('[RetentionAlert] Failed to send email alert:', err)
    }
  }
}
