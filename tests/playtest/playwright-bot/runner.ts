/**
 * Playwright Game Bot — CLI Runner
 *
 * Runs the live browser game bot against the dev server.
 *
 * PREREQUISITES:
 *   - Dev server running: `npm run dev` (port 5173)
 *   - playwright package: already in devDependencies as "@playwright/test" ^1.58.2
 *     Uses `playwright` (the underlying package, re-exported by @playwright/test).
 *
 * USAGE:
 *   npx tsx tests/playtest/playwright-bot/runner.ts --profile scholar --runs 5
 *   npx tsx tests/playtest/playwright-bot/runner.ts --profile first_timer --runs 3 --headed
 *   npx tsx tests/playtest/playwright-bot/runner.ts --all --runs 2
 *   npx tsx tests/playtest/playwright-bot/runner.ts --all --runs 10 --output results.json
 *
 * PROFILES:
 *   first_timer | casual_learner | regular | gamer | dedicated | scholar
 *
 * FLAGS:
 *   --profile <id>     Single profile to run (default: scholar)
 *   --all              Run all profiles
 *   --runs <n>         Runs per profile (default: 5)
 *   --headed           Open browser window (default: headless)
 *   --output <path>    Write JSON results to file
 */

// NOTE: Uses chromium from @playwright/test's bundled browsers.
// Run `npx playwright install chromium` if browsers are not yet installed.

import { chromium } from '@playwright/test';
import { runBot } from './bot.js';
import { BOT_PROFILES } from './types.js';
import type { BotRunStats } from './types.js';

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  profiles: string[];
  runsPerProfile: number;
  headless: boolean;
  outputPath: string | null;
} {
  const args = process.argv.slice(2);

  const get = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const has = (flag: string): boolean => args.includes(flag);

  const profileId = get('--profile') ?? 'scholar';
  const runAll = has('--all');
  const profiles = runAll ? Object.keys(BOT_PROFILES) : [profileId];
  const runsPerProfile = parseInt(get('--runs') ?? '5', 10);
  const headless = !has('--headed');
  const outputPath = get('--output');

  return { profiles, runsPerProfile, headless, outputPath };
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

const ICONS: Record<BotRunStats['result'], string> = {
  victory: '✓',
  defeat: '✗',
  error: '!',
  timeout: 'T',
};

function summarizeProfile(id: string, pStats: BotRunStats[]): void {
  const wins = pStats.filter((s) => s.result === 'victory').length;
  const errors = pStats.filter((s) => s.result === 'error' || s.result === 'timeout').length;
  const avgFloor = pStats.reduce((acc, s) => acc + s.finalFloor, 0) / pStats.length;
  const avgDuration = pStats.reduce((acc, s) => acc + s.durationMs, 0) / pStats.length;
  const winPct = Math.round((wins / pStats.length) * 100);

  console.log(
    `  Summary: ${wins}/${pStats.length} wins (${winPct}%) ` +
    `| Avg floor: ${avgFloor.toFixed(1)} ` +
    `| Avg time: ${(avgDuration / 1000).toFixed(1)}s ` +
    `| Errors: ${errors}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { profiles, runsPerProfile, headless, outputPath } = parseArgs();

  console.log(`\n${'='.repeat(62)}`);
  console.log(`  RECALL ROGUE — LIVE GAME BOT`);
  console.log(`${'='.repeat(62)}`);
  console.log(`  Profiles  : ${profiles.join(', ')}`);
  console.log(`  Runs each : ${runsPerProfile}`);
  console.log(`  Headless  : ${headless}`);
  console.log(`  Total runs: ${profiles.length * runsPerProfile}`);
  console.log(`${'='.repeat(62)}\n`);

  // Verify dev server is reachable before launching browsers
  try {
    const resp = await fetch('http://localhost:5173', { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch {
    console.error('ERROR: Dev server not reachable at http://localhost:5173');
    console.error('       Run `npm run dev` first, then retry.');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless,
    args: [
      '--use-gl=angle',           // Enable WebGL in headless mode
      '--use-angle=swiftshader',  // Software WebGL renderer
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const allStats: BotRunStats[] = [];

  try {
    for (const profileId of profiles) {
      const profile = BOT_PROFILES[profileId];
      if (!profile) {
        console.error(`Unknown profile: "${profileId}". Available: ${Object.keys(BOT_PROFILES).join(', ')}`);
        continue;
      }

      console.log(`\n--- ${profile.name} [${profile.id}] (accuracy: ${Math.round(profile.quizAccuracy * 100)}%, strategy: ${profile.strategy}) ---`);
      const profileStats: BotRunStats[] = [];

      for (let run = 0; run < runsPerProfile; run++) {
        // Give each run a unique seed derived from profile + run index
        const seed = (run + 1) * 7919 + profileId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

        const context = await browser.newContext({
          viewport: { width: 390, height: 844 }, // iPhone 14 — matches target device
        });
        const page = await context.newPage();

        // Suppress noisy console output from the game during bot runs
        page.on('console', () => { /* suppress */ });

        let botStats: BotRunStats;
        try {
          botStats = await runBot(page, profile, seed);
        } catch (err: unknown) {
          botStats = {
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
            relicsEarned: 0,
            goldEarned: 0,
            goldSpent: 0,
            durationMs: 0,
            errors: [err instanceof Error ? err.message : String(err)],
          };
        }

        await context.close();
        profileStats.push(botStats);
        allStats.push(botStats);

        const icon = ICONS[botStats.result];
        const errSuffix = botStats.errors.length > 0 ? ` | ERR: ${botStats.errors[0].slice(0, 80)}` : '';
        const hpStr = botStats.finalMaxHP > 0 ? `${botStats.finalHP}/${botStats.finalMaxHP}` : 'N/A';
        console.log(
          `  [${icon}] Run ${String(run + 1).padStart(2)}: ${botStats.result.padEnd(7)} ` +
          `| Floor ${String(botStats.finalFloor).padStart(2)} ` +
          `| HP ${hpStr.padStart(7)} ` +
          `| Cards ${String(botStats.totalCardsPlayed).padStart(3)} ` +
          `| Quiz ${botStats.quizCorrect}/${botStats.quizCorrect + botStats.quizWrong} ` +
          `| ${(botStats.durationMs / 1000).toFixed(1)}s` +
          errSuffix
        );
      }

      summarizeProfile(profileId, profileStats);
    }
  } finally {
    await browser.close();
  }

  // Grand summary table
  console.log(`\n${'='.repeat(62)}`);
  console.log(`  GRAND SUMMARY`);
  console.log(`${'='.repeat(62)}`);
  console.log(`  ${'Profile'.padEnd(18)} ${'Win%'.padStart(5)} ${'Floor'.padStart(6)} ${'Cards'.padStart(6)} ${'Quiz%'.padStart(6)} ${'Errs'.padStart(5)}`);
  console.log(`  ${'-'.repeat(50)}`);

  for (const profileId of profiles) {
    const pStats = allStats.filter((s) => s.profile === profileId);
    if (pStats.length === 0) continue;

    const wins = pStats.filter((s) => s.result === 'victory').length;
    const errors = pStats.filter((s) => s.result === 'error' || s.result === 'timeout').length;
    const avgFloor = pStats.reduce((acc, s) => acc + s.finalFloor, 0) / pStats.length;
    const avgCards = pStats.reduce((acc, s) => acc + s.totalCardsPlayed, 0) / pStats.length;
    const totalQuiz = pStats.reduce((acc, s) => acc + s.quizCorrect + s.quizWrong, 0);
    const totalCorrect = pStats.reduce((acc, s) => acc + s.quizCorrect, 0);
    const quizPct = totalQuiz > 0 ? Math.round((totalCorrect / totalQuiz) * 100) : 0;
    const winPct = Math.round((wins / pStats.length) * 100);

    console.log(
      `  ${profileId.padEnd(18)} ${`${winPct}%`.padStart(5)} ${avgFloor.toFixed(1).padStart(6)} ` +
      `${avgCards.toFixed(0).padStart(6)} ${`${quizPct}%`.padStart(6)} ${String(errors).padStart(5)}`
    );
  }
  console.log(`${'='.repeat(62)}\n`);

  // Write results to file if requested
  if (outputPath) {
    const fs = await import('fs');
    const output = {
      timestamp: new Date().toISOString(),
      profiles: profiles.map((id) => BOT_PROFILES[id]?.name ?? id),
      runsPerProfile,
      runs: allStats,
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Results written to: ${outputPath}\n`);
  }
}

main().catch((err) => {
  console.error('Bot runner failed:', err);
  process.exit(1);
});
