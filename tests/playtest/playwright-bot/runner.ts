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

function fmtQuizPct(s: BotRunStats): string {
  const total = s.quizCorrect + s.quizWrong;
  if (total === 0) return 'N/A';
  return `${Math.round((s.quizCorrect / total) * 100)}%`;
}

function fmtCards(s: BotRunStats): string {
  return `${s.totalCardsPlayed} (${s.totalCharges}C/${s.totalQuickPlays}Q)`;
}

function printRunLine(run: number, s: BotRunStats): void {
  const icon = ICONS[s.result];
  const hpStr = s.finalMaxHP > 0 ? `${s.finalHP}/${s.finalMaxHP}` : 'N/A';
  const relics = s.finalRelicCount > 0 ? s.finalRelicCount : s.relicsEarned.length;
  const gold = s.finalGold > 0 ? s.finalGold : (s.goldEarned - s.goldSpent);
  const time = `${(s.durationMs / 1000).toFixed(1)}s`;
  const errSuffix = s.errors.length > 0 ? ` | ERR: ${s.errors[0].slice(0, 70)}` : '';

  let deathInfo = '';
  if (s.result === 'defeat' && s.deathEnemy) {
    deathInfo = ` | Died to ${s.deathEnemy}`;
  }

  console.log(
    `  [${icon}] Seed ${String(s.seed).padStart(6)}: ${s.result.padEnd(7)}` +
    ` | Floor ${String(s.finalFloor).padStart(2)}` +
    ` | HP ${hpStr.padStart(7)}` +
    ` | ${fmtCards(s).padEnd(14)}` +
    ` | Quiz ${fmtQuizPct(s).padStart(4)}` +
    ` | ${relics} relics` +
    ` | ${gold} gold` +
    ` | ${time}` +
    deathInfo +
    errSuffix
  );
}

function summarizeProfile(id: string, pStats: BotRunStats[]): void {
  const profile = BOT_PROFILES[id];
  const acc = profile ? `${Math.round(profile.quizAccuracy * 100)}% acc` : '';
  const charge = profile ? `${Math.round(profile.chargeRate * 100)}% charge` : '';

  const wins = pStats.filter((s) => s.result === 'victory').length;
  const errors = pStats.filter((s) => s.result === 'error' || s.result === 'timeout').length;
  const avgFloor = pStats.reduce((acc, s) => acc + s.finalFloor, 0) / pStats.length;
  const avgDuration = pStats.reduce((acc, s) => acc + s.durationMs, 0) / pStats.length;
  const winPct = Math.round((wins / pStats.length) * 100);
  const totalQuiz = pStats.reduce((acc, s) => acc + s.quizCorrect + s.quizWrong, 0);
  const totalCorrect = pStats.reduce((acc, s) => acc + s.quizCorrect, 0);
  const quizPct = totalQuiz > 0 ? Math.round((totalCorrect / totalQuiz) * 100) : 0;
  const avgRelics = pStats.reduce((acc, s) => acc + (s.finalRelicCount || s.relicsEarned.length), 0) / pStats.length;
  const avgGold = pStats.reduce((acc, s) => acc + s.finalGold, 0) / pStats.length;
  const avgCards = pStats.reduce((acc, s) => acc + s.totalCardsPlayed, 0) / pStats.length;

  console.log(
    `  Summary [${acc}, ${charge}]: ${wins}/${pStats.length} wins (${winPct}%)` +
    ` | Avg floor: ${avgFloor.toFixed(1)}` +
    ` | Quiz: ${quizPct}%` +
    ` | Cards: ${avgCards.toFixed(0)}` +
    ` | Relics: ${avgRelics.toFixed(1)}` +
    ` | Gold: ${avgGold.toFixed(0)}` +
    ` | Time: ${(avgDuration / 1000).toFixed(1)}s` +
    ` | Errors: ${errors}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { profiles, runsPerProfile, headless, outputPath } = parseArgs();

  console.log(`\n${'='.repeat(72)}`);
  console.log(`  RECALL ROGUE — LIVE GAME BOT`);
  console.log(`${'='.repeat(72)}`);
  console.log(`  Profiles  : ${profiles.join(', ')}`);
  console.log(`  Runs each : ${runsPerProfile}`);
  console.log(`  Headless  : ${headless}`);
  console.log(`  Total runs: ${profiles.length * runsPerProfile}`);
  console.log(`${'='.repeat(72)}\n`);

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

      console.log(`\n--- ${profile.name} [${profile.id}] (${Math.round(profile.quizAccuracy * 100)}% acc, ${Math.round(profile.chargeRate * 100)}% charge) ---`);
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
            durationMs: 0,
            errors: [err instanceof Error ? err.message : String(err)],
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
          };
        }

        await context.close();
        profileStats.push(botStats);
        allStats.push(botStats);

        printRunLine(run + 1, botStats);
      }

      summarizeProfile(profileId, profileStats);
    }
  } finally {
    await browser.close();
  }

  // Grand summary table
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  GRAND SUMMARY`);
  console.log(`${'='.repeat(72)}`);
  console.log(
    `  ${'Profile'.padEnd(18)} ${'Win%'.padStart(5)} ${'Floor'.padStart(6)} ${'HP'.padStart(6)} ` +
    `${'Cards'.padStart(6)} ${'Quiz%'.padStart(6)} ${'Chrg%'.padStart(6)} ${'Relics'.padStart(7)} ${'Gold'.padStart(5)} ${'Errs'.padStart(5)} ${'Time'.padStart(6)}`
  );
  console.log(`  ${'-'.repeat(70)}`);

  for (const profileId of profiles) {
    const pStats = allStats.filter((s) => s.profile === profileId);
    if (pStats.length === 0) continue;

    const wins = pStats.filter((s) => s.result === 'victory').length;
    const errors = pStats.filter((s) => s.result === 'error' || s.result === 'timeout').length;
    const avgFloor = pStats.reduce((acc, s) => acc + s.finalFloor, 0) / pStats.length;
    const avgHp = pStats.reduce((acc, s) => acc + s.finalHP, 0) / pStats.length;
    const avgCards = pStats.reduce((acc, s) => acc + s.totalCardsPlayed, 0) / pStats.length;
    const totalQuiz = pStats.reduce((acc, s) => acc + s.quizCorrect + s.quizWrong, 0);
    const totalCorrect = pStats.reduce((acc, s) => acc + s.quizCorrect, 0);
    const quizPct = totalQuiz > 0 ? Math.round((totalCorrect / totalQuiz) * 100) : 0;
    const totalCards = pStats.reduce((acc, s) => acc + s.totalCardsPlayed, 0);
    const totalCharges = pStats.reduce((acc, s) => acc + s.totalCharges, 0);
    const chargePct = totalCards > 0 ? Math.round((totalCharges / totalCards) * 100) : 0;
    const avgRelics = pStats.reduce((acc, s) => acc + (s.finalRelicCount || s.relicsEarned.length), 0) / pStats.length;
    const avgGold = pStats.reduce((acc, s) => acc + s.finalGold, 0) / pStats.length;
    const avgDuration = pStats.reduce((acc, s) => acc + s.durationMs, 0) / pStats.length;
    const winPct = Math.round((wins / pStats.length) * 100);

    console.log(
      `  ${profileId.padEnd(18)} ${`${winPct}%`.padStart(5)} ${avgFloor.toFixed(1).padStart(6)} ` +
      `${avgHp.toFixed(0).padStart(6)} ${avgCards.toFixed(0).padStart(6)} ${`${quizPct}%`.padStart(6)} ` +
      `${`${chargePct}%`.padStart(6)} ${avgRelics.toFixed(1).padStart(7)} ${avgGold.toFixed(0).padStart(5)} ` +
      `${String(errors).padStart(5)} ${`${(avgDuration / 1000).toFixed(1)}s`.padStart(6)}`
    );
  }
  console.log(`${'='.repeat(72)}\n`);

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
