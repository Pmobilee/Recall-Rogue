/**
 * Analytics Dashboard CLI — Recall Rogue
 *
 * Queries the SQLite analytics_events table and prints retention metrics
 * to stdout. Useful for quick local analysis without a BI tool.
 *
 * Usage:
 *   cd /root/terra-miner
 *   npx tsx scripts/analytics-dashboard.ts
 */

import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = resolve(__dirname, "../server/data/recall-rogue.db");

// ── Types ──────────────────────────────────────────────────────────────────────

interface CountRow {
  count: number;
}

interface EventNameRow {
  event_name: string;
  count: number;
}

interface DayRow {
  day: string;
  sessions: number;
}

interface RetentionRow {
  cohort_day: string;
  retained_d1: number;
  retained_d7: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Format a Unix epoch timestamp (ms) as a YYYY-MM-DD string in UTC.
 */
function toDateString(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * Print a section header with a divider line.
 */
function printHeader(title: string): void {
  const line = "─".repeat(title.length + 4);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${title}  │`);
  console.log(`└${line}┘`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main(): void {
  const db = new Database(DB_PATH, { readonly: true });

  // ── Total events ────────────────────────────────────────────────────────────
  printHeader("Total Analytics Events");
  const { count: totalEvents } = db
    .prepare("SELECT COUNT(*) AS count FROM analytics_events")
    .get() as CountRow;
  console.log(`  Total events stored: ${totalEvents.toLocaleString()}`);

  // ── Events by type ───────────────────────────────────────────────────────────
  printHeader("Events by Type");
  const eventsByType = db
    .prepare(
      `SELECT event_name, COUNT(*) AS count
       FROM analytics_events
       GROUP BY event_name
       ORDER BY count DESC`
    )
    .all() as EventNameRow[];

  if (eventsByType.length === 0) {
    console.log("  (no events recorded yet)");
  } else {
    const maxLen = Math.max(...eventsByType.map((r) => r.event_name.length));
    for (const row of eventsByType) {
      const name = row.event_name.padEnd(maxLen);
      console.log(`  ${name}  ${row.count.toLocaleString()}`);
    }
  }

  // ── Unique sessions ──────────────────────────────────────────────────────────
  printHeader("Unique Sessions");
  const { count: uniqueSessions } = db
    .prepare(
      "SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events"
    )
    .get() as CountRow;
  console.log(`  Unique session IDs: ${uniqueSessions.toLocaleString()}`);

  // ── app_open events per day (last 14 days) ───────────────────────────────────
  printHeader("Daily Active Sessions (last 14 days — app_open)");
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  const dailySessions = db
    .prepare(
      `SELECT
         DATE(created_at / 1000, 'unixepoch') AS day,
         COUNT(DISTINCT session_id) AS sessions
       FROM analytics_events
       WHERE event_name = 'app_open'
         AND created_at >= ?
       GROUP BY day
       ORDER BY day DESC`
    )
    .all(fourteenDaysAgo) as DayRow[];

  if (dailySessions.length === 0) {
    console.log("  (no app_open events in the last 14 days)");
  } else {
    for (const row of dailySessions) {
      console.log(`  ${row.day}   ${row.sessions.toLocaleString()} sessions`);
    }
  }

  // ── D1 / D7 Retention (cohort by first session day) ─────────────────────────
  printHeader("D1 / D7 Retention (cohort approximation)");

  // First session day per session_id
  const cohortRetention = db
    .prepare(
      `WITH first_seen AS (
         SELECT
           session_id,
           MIN(created_at) AS first_ts
         FROM analytics_events
         GROUP BY session_id
       ),
       cohorts AS (
         SELECT
           DATE(first_ts / 1000, 'unixepoch') AS cohort_day,
           session_id,
           first_ts
         FROM first_seen
       ),
       returned AS (
         SELECT
           c.cohort_day,
           c.session_id,
           MAX(CASE
             WHEN ae.created_at >= c.first_ts + 86400000
              AND ae.created_at <  c.first_ts + 172800000
             THEN 1 ELSE 0
           END) AS came_back_d1,
           MAX(CASE
             WHEN ae.created_at >= c.first_ts + 518400000
              AND ae.created_at <  c.first_ts + 691200000
             THEN 1 ELSE 0
           END) AS came_back_d7
         FROM cohorts c
         JOIN analytics_events ae ON ae.session_id = c.session_id
         GROUP BY c.cohort_day, c.session_id
       )
       SELECT
         cohort_day,
         SUM(came_back_d1) AS retained_d1,
         SUM(came_back_d7) AS retained_d7
       FROM returned
       GROUP BY cohort_day
       ORDER BY cohort_day DESC
       LIMIT 14`
    )
    .all() as RetentionRow[];

  if (cohortRetention.length === 0) {
    console.log("  (insufficient data — need at least 2 days of sessions)");
  } else {
    console.log("  Cohort Day    D1 Retained   D7 Retained");
    console.log("  ──────────    ───────────   ───────────");
    for (const row of cohortRetention) {
      const d1 = String(row.retained_d1).padStart(11);
      const d7 = String(row.retained_d7).padStart(11);
      console.log(`  ${row.cohort_day}   ${d1}   ${d7}`);
    }
  }

  // ── Quiz accuracy (last 7 days) ──────────────────────────────────────────────
  printHeader("Quiz Accuracy (last 7 days)");
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const quizRows = db
    .prepare(
      `SELECT properties
       FROM analytics_events
       WHERE event_name = 'quiz_answered'
         AND created_at >= ?`
    )
    .all(sevenDaysAgo) as Array<{ properties: string }>;

  let quizTotal = 0;
  let quizCorrect = 0;
  for (const row of quizRows) {
    try {
      const props = JSON.parse(row.properties) as { correct?: boolean };
      quizTotal++;
      if (props.correct) quizCorrect++;
    } catch {
      // Skip malformed rows
    }
  }

  if (quizTotal === 0) {
    console.log("  (no quiz_answered events in the last 7 days)");
  } else {
    const pct = ((quizCorrect / quizTotal) * 100).toFixed(1);
    console.log(`  Total answers: ${quizTotal.toLocaleString()}`);
    console.log(`  Correct:       ${quizCorrect.toLocaleString()} (${pct}%)`);
  }

  // ── Generated at ──────────────────────────────────────────────────────────────
  console.log(`\n  Report generated at: ${toDateString(now)}\n`);

  db.close();
}

main();
