/**
 * Weekly bundle auto-release scheduler.
 * Runs the release script every Monday at 06:00 UTC by polling a
 * setInterval that checks if the current day/hour matches the schedule.
 * Designed for low-dependency environments (no node-cron needed).
 */
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// After tsc compilation, scripts are at dist/scripts/release-bundle.js
const SCRIPT = path.resolve(__dirname, "../scripts/release-bundle.js");

/** Track last release week to avoid double-releasing. */
let lastReleasedWeek = "";

/**
 * Start the bundle scheduler. Checks every 10 minutes whether
 * a weekly release should be triggered (Monday at 06:00 UTC).
 */
export function startBundleScheduler(): void {
  const check = () => {
    const now = new Date();
    // Monday = 1, 06:00 UTC
    if (now.getUTCDay() !== 1 || now.getUTCHours() !== 6) return;

    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((now.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    );
    const currentWeek = `${now.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;

    if (currentWeek === lastReleasedWeek) return;
    lastReleasedWeek = currentWeek;

    console.log(
      `[bundleScheduler] Triggering weekly bundle release for ${currentWeek}`
    );
    try {
      execSync(`node ${SCRIPT} --week ${currentWeek}`, { stdio: "inherit" });
    } catch (err) {
      console.error("[bundleScheduler] Bundle release failed:", err);
    }
  };

  // Run immediately in case server just started on a Monday morning
  check();
  setInterval(check, 10 * 60 * 1000); // every 10 minutes
  console.log("[bundleScheduler] Weekly bundle scheduler started.");
}
