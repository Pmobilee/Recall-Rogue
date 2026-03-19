/**
 * Playwright Game Bot — Overnight Collection Script
 *
 * Runs the Recall Rogue game bot INDEFINITELY, cycling through all 6 profiles
 * forever until manually stopped with Ctrl+C (SIGINT).
 *
 * PREREQUISITES:
 *   - Dev server running: `npm run dev` (port 5173)
 *
 * USAGE:
 *   npx tsx tests/playtest/playwright-bot/overnight.ts
 *
 * OUTPUT:
 *   data/playtests/overnight-2026-03-19/
 *     combined.json                  — all results + summary (saved every cycle)
 *     {profile}_cycle{N}_batch{M}.json  — per-batch incremental saves
 *     progress.log                   — timestamped log of all activity
 *
 * STOPPING:
 *   Ctrl+C  — graceful shutdown: finishes current run, saves combined.json
 *   Ctrl+C  (second time) — force quit
 */

import { chromium, type Browser } from '@playwright/test';
import { runBot } from './bot.js';
import { BOT_PROFILES } from './types.js';
import type { BotProfile, BotRunStats } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILES = ['first_timer', 'casual_learner', 'regular', 'gamer', 'dedicated', 'scholar'];
const BATCH_SIZE = 10;
const MAX_RETRIES = 2;
const OVERNIGHT_TIMESTAMP = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
const OUTPUT_DIR = `data/playtests/runs/${OVERNIGHT_TIMESTAMP}`;
const LOG_FILE = path.join(OUTPUT_DIR, 'progress.log');
const BROWSER_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let allResults: BotRunStats[] = [];
let shuttingDown = false;
let currentBrowser: Browser | null = null;
let cycleNumber = 0;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Returns current time as [HH:MM:SS]. */
function timestamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `[${hh}:${mm}:${ss}]`;
}

/** Logs to both console and progress.log with a timestamp prefix. */
function log(msg: string): void {
  const line = `${timestamp()} ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {
    // Non-fatal — log file write failure shouldn't stop collection
  }
}

/** Ensures the output directory exists. */
function ensureOutputDir(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/** Simple sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Profile string hash for seed offset. */
function profileHash(profileId: string): number {
  return profileId.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Saves a batch of results for one profile/cycle/batch to an incremental file.
 */
function saveBatchResults(
  profileId: string,
  batchNum: number,
  cycle: number,
  results: BotRunStats[],
): void {
  const filename = `${profileId}_cycle${cycle}_batch${batchNum}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  try {
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf8');
    log(`Saved: ${filename}`);
  } catch (err: unknown) {
    log(`WARN: Could not save ${filename}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Writes combined.json with all results so far, plus per-profile summary stats.
 */
function saveCombined(): void {
  const filepath = path.join(OUTPUT_DIR, 'combined.json');

  // Build per-profile summaries
  const profileSummaries: Record<string, {
    runs: number;
    victories: number;
    defeats: number;
    errors: number;
    avgFloor: number;
  }> = {};

  for (const profileId of PROFILES) {
    const pStats = allResults.filter((r) => r.profile === profileId);
    if (pStats.length === 0) continue;

    const victories = pStats.filter((r) => r.result === 'victory').length;
    const defeats = pStats.filter((r) => r.result === 'defeat').length;
    const errors = pStats.filter((r) => r.result === 'error' || r.result === 'timeout').length;
    const avgFloor = pStats.reduce((acc, r) => acc + r.finalFloor, 0) / pStats.length;

    profileSummaries[profileId] = {
      runs: pStats.length,
      victories,
      defeats,
      errors,
      avgFloor: Math.round(avgFloor * 10) / 10,
    };
  }

  const output = {
    timestamp: new Date().toISOString(),
    totalRuns: allResults.length,
    totalCycles: cycleNumber,
    profileSummaries,
    runs: allResults,
  };

  try {
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), 'utf8');
  } catch (err: unknown) {
    log(`WARN: Could not save combined.json: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Browser management
// ---------------------------------------------------------------------------

/** Launches chromium headless with WebGL args and sets currentBrowser. */
async function launchBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    headless: true,
    args: BROWSER_ARGS,
  });
  currentBrowser = browser;
  return browser;
}

// ---------------------------------------------------------------------------
// Dev server check
// ---------------------------------------------------------------------------

/**
 * Verifies the dev server is reachable. Retries up to 5 times with 30s gaps.
 * Throws if the server remains down.
 */
async function checkDevServer(): Promise<void> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch('http://localhost:5173', {
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok || resp.status < 500) return; // server is up
    } catch {
      // fall through
    }
    if (attempt < MAX_ATTEMPTS) {
      log(`WARN: Dev server not reachable (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in 30s...`);
      await sleep(30_000);
    }
  }
  throw new Error('Dev server at http://localhost:5173 is not reachable after 5 attempts. Run `npm run dev` first.');
}

// ---------------------------------------------------------------------------
// Single-run helper
// ---------------------------------------------------------------------------

/**
 * Runs one game in its own browser context and returns stats.
 * Always resolves — errors are encoded in the returned BotRunStats.
 */
async function runOne(browser: Browser, profile: BotProfile, seed: number): Promise<BotRunStats> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('console', () => { /* suppress console noise */ });

  let stats: BotRunStats;
  try {
    stats = await runBot(page, profile, seed);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    stats = {
      profile: profile.id,
      seed,
      result: 'error',
      finalFloor: 0,
      finalHP: 0,
      finalMaxHP: 0,
      totalTurns: 0,
      totalCardsPlayed: 0,
      totalCharges: 0,
      totalQuickPlays: 0,
      quizCorrect: 0,
      quizWrong: 0,
      durationMs: 0,
      errors: [errMsg],
      goldEarned: 0,
      goldSpent: 0,
      finalGold: 0,
      relicsEarned: [],
      finalRelicCount: 0,
      roomsVisited: [],
      totalRoomsVisited: 0,
      segmentsCompleted: 0,
      encountersWon: 0,
      encountersLost: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      avgTurnsPerEncounter: 0,
      finalDeckSize: 0,
      cardsAdded: 0,
      cardsRemoved: 0,
      maxChainLength: 0,
      maxCombo: 0,
      deathFloor: 0,
      deathEnemy: '',
      deathHP: 0,
      screenLog: [],
      encounters: [],
      cardTypeStats: {},
      totalChains: 0,
      avgChainLength: 0,
      domainAccuracy: {},
      cardsUpgraded: 0,
      cardsRemovedAtShop: 0,
      haggleAttempts: 0,
      haggleSuccesses: 0,
      relicDetails: [],
      questionsAnswered: 0,
      questionsCorrect: 0,
      novelQuestionsAnswered: 0,
      novelQuestionsCorrect: 0,
      bountiesCompleted: [],
    };
  }

  try {
    await context.close();
  } catch {
    // Ignore context-close errors
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

/**
 * Runs BATCH_SIZE sequential games for one profile.
 * Each run gets a unique seed derived from cycle/batch/profile.
 *
 * @param browser - Active browser instance
 * @param profileId - Profile key from PROFILES array
 * @param profileIndex - Index of profile in PROFILES for seed calculation
 * @param batchNum - 1-based batch number within this cycle
 * @returns Array of BotRunStats for this batch
 */
async function runBatch(
  browser: Browser,
  profileId: string,
  profileIndex: number,
  batchNum: number,
): Promise<BotRunStats[]> {
  const profile = BOT_PROFILES[profileId];
  const results: BotRunStats[] = [];
  const batchStart = Date.now();

  for (let runIndex = 0; runIndex < BATCH_SIZE; runIndex++) {
    if (shuttingDown) break;

    // Unique seed: each cycle/profile/batch/run gets a distinct value
    const seed =
      cycleNumber * 100000 +
      profileIndex * 10000 +
      (batchNum - 1) * BATCH_SIZE +
      runIndex;

    const stats = await runOne(browser, profile, seed);
    results.push(stats);
  }

  const batchMs = Date.now() - batchStart;
  const successes = results.filter((r) => r.result === 'victory' || r.result === 'defeat').length;
  const errors = results.filter((r) => r.result === 'error' || r.result === 'timeout').length;
  const avgMs = results.length > 0 ? batchMs / results.length : 0;
  log(
    `Batch done: ${successes}/${results.length} success | ${errors} errors | ${(avgMs / 1000).toFixed(1)}s avg`,
  );

  return results;
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

/**
 * Re-runs failed seeds (result === 'error' | 'timeout') up to MAX_RETRIES times.
 * Returns the updated results array with successful retries replacing failures.
 */
async function retryFailed(
  browser: Browser,
  profileId: string,
  batchResults: BotRunStats[],
): Promise<BotRunStats[]> {
  const profile = BOT_PROFILES[profileId];
  const updated = [...batchResults];
  const failedIndices = updated
    .map((r, i) => (r.result === 'error' || r.result === 'timeout' ? i : -1))
    .filter((i) => i >= 0);

  if (failedIndices.length === 0) return updated;

  let recovered = 0;
  for (const idx of failedIndices) {
    const original = updated[idx];
    let result = original;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Use a modified seed to avoid repeating the exact same crash
      const retrySeed = original.seed + attempt * 999983;
      const retried = await runOne(browser, profile, retrySeed);
      if (retried.result === 'victory' || retried.result === 'defeat') {
        result = retried;
        recovered++;
        break;
      }
    }

    updated[idx] = result;
  }

  log(`Retries: ${recovered}/${failedIndices.length} recovered`);
  return updated;
}

// ---------------------------------------------------------------------------
// Cycle runner
// ---------------------------------------------------------------------------

/**
 * Runs one complete cycle: 1 batch of 10 runs for each of the 6 profiles.
 * Saves incrementally after each batch. Retries failed seeds. Saves combined.
 */
async function runOneCycle(browser: Browser): Promise<void> {
  cycleNumber++;
  log(`=== Cycle ${cycleNumber} ===`);

  const cycleStart = Date.now();
  let cycleTotal = 0;
  let cycleSuccess = 0;
  const allFailed: BotRunStats[] = [];

  for (let profileIndex = 0; profileIndex < PROFILES.length; profileIndex++) {
    if (shuttingDown) break;

    const profileId = PROFILES[profileIndex];
    // Batch number 1 per profile per cycle (one batch of 10)
    const batchNum = 1;

    log(`--- ${profileId} (batch ${batchNum}) ---`);

    let batchResults = await runBatch(browser, profileId, profileIndex, batchNum);

    // Save raw batch results immediately
    saveBatchResults(profileId, batchNum, cycleNumber, batchResults);

    // Collect failed for cycle-level retry summary
    const failed = batchResults.filter((r) => r.result === 'error' || r.result === 'timeout');
    if (failed.length > 0) {
      allFailed.push(...failed);
    }

    // Add to global results
    for (const r of batchResults) {
      allResults.push(r);
      cycleTotal++;
      if (r.result === 'victory' || r.result === 'defeat') cycleSuccess++;
    }
  }

  // Retry all failed seeds from this cycle
  const cycleMs = Date.now() - cycleStart;
  const failCount = allFailed.length;
  const successPct = cycleTotal > 0 ? Math.round((cycleSuccess / cycleTotal) * 100) : 0;
  log(
    `Cycle ${cycleNumber} complete: ${cycleSuccess}/${cycleTotal} success (${successPct}%)` +
      (failCount > 0 ? ` | Retrying ${failCount} failed seeds...` : ''),
  );

  if (failCount > 0 && !shuttingDown) {
    // Retry the failed results using a dummy "batch" approach per profile
    for (const profileId of PROFILES) {
      if (shuttingDown) break;
      const profileFailed = allFailed.filter((r) => r.profile === profileId);
      if (profileFailed.length === 0) continue;

      const profile = BOT_PROFILES[profileId];
      const retried = await retryFailed(browser, profileId, profileFailed);

      // Update allResults: replace failed entries with retry results
      for (let i = 0; i < retried.length; i++) {
        const retryResult = retried[i];
        const originalSeed = profileFailed[i].seed;
        const globalIdx = allResults.findIndex(
          (r) => r.profile === profileId && r.seed === originalSeed,
        );
        if (globalIdx >= 0) {
          if (retryResult.result === 'victory' || retryResult.result === 'defeat') {
            allResults[globalIdx] = retryResult;
            cycleSuccess++;
          }
        } else {
          // Not found by original seed (retry used different seed) — append
          allResults.push(retryResult);
        }
      }

      // Also append any net-new retry successes that weren't in allResults
      const profile_name = profile.name; // referenced only for clarity
      void profile_name;
    }
  }

  saveCombined();
  log(`Saved combined.json (${allResults.length} runs total)`);
  const totalMs = Date.now() - cycleStart;
  log(`Cycle ${cycleNumber} wall time: ${(totalMs / 1000).toFixed(0)}s`);
}

// ---------------------------------------------------------------------------
// SIGINT handler
// ---------------------------------------------------------------------------

process.on('SIGINT', () => {
  if (shuttingDown) {
    log('Force quit');
    process.exit(1);
  }
  shuttingDown = true;
  log('\nGraceful shutdown requested — finishing current run...');
  log('Press Ctrl+C again to force quit');
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  ensureOutputDir();

  // Update latest symlink
  const runsBase = path.resolve('data/playtests/runs');
  const latestPath = path.join(runsBase, 'latest');
  try {
    if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
    fs.symlinkSync(OVERNIGHT_TIMESTAMP, latestPath);
  } catch {
    /* non-fatal */
  }

  log('Starting overnight collection — cycling indefinitely through 6 profiles');
  log(`Output: ${OUTPUT_DIR}`);
  log('Press Ctrl+C to stop gracefully');

  while (!shuttingDown) {
    try {
      await checkDevServer();
      const browser = await launchBrowser();
      try {
        await runOneCycle(browser);
      } finally {
        try {
          await browser.close();
        } catch {
          // Ignore browser-close errors
        }
        currentBrowser = null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`ERROR: Cycle crashed: ${msg}`);
      log('Saving progress and relaunching in 10s...');
      saveCombined();
      if (currentBrowser) {
        try {
          await currentBrowser.close();
        } catch {
          // Ignore
        }
        currentBrowser = null;
      }
      if (!shuttingDown) {
        await sleep(10_000);
      }
    }
  }

  log('Saving final results...');
  saveCombined();
  log(`DONE — ${allResults.length} total runs saved`);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
