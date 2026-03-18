/**
 * Playwright Bot — Balance Analysis Script
 *
 * Reads overnight playtest JSON data and generates a comprehensive balance report.
 *
 * Usage:
 *   npx tsx tests/playtest/playwright-bot/analyze.ts --input data/playtests/overnight-2026-03-19/combined.json
 *
 * If no --input flag, defaults to data/playtests/overnight-2026-03-19/combined.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BotRunStats } from './types.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const inputFlagIdx = args.indexOf('--input');
const inputPath =
  inputFlagIdx !== -1 && args[inputFlagIdx + 1]
    ? args[inputFlagIdx + 1]
    : 'data/playtests/overnight-2026-03-19/combined.json';

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Returns a percentage string like "65%" or "—" when total is 0. */
function pct(n: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((n / total) * 100)}%`;
}

/** Left-pads a string/number to n characters. */
function pad(s: string | number, n: number): string {
  const str = String(s);
  return str.length >= n ? str : ' '.repeat(n - str.length) + str;
}

/** Right-pads a string/number to n characters. */
function rpad(s: string | number, n: number): string {
  const str = String(s);
  return str.length >= n ? str : str + ' '.repeat(n - str.length);
}

/** Prints a formatted section divider with a title. */
function divider(title: string): string {
  const line = '='.repeat(72);
  return `\n${line}\n  ${title}\n${line}`;
}

/** Returns average of an array, or 0 if empty. */
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Returns average formatted to one decimal place. */
function avgStr(arr: number[], decimals = 1): string {
  if (arr.length === 0) return '—';
  return avg(arr).toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

if (!fs.existsSync(inputPath)) {
  console.error(`ERROR: Input file not found: ${inputPath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as {
  timestamp: string;
  totalRuns: number;
  runs: BotRunStats[];
};

const runs = raw.runs;
const totalRuns = runs.length;

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

const lines: string[] = [];

const push = (...strs: string[]) => lines.push(...strs);

// -----------------------------------------------------------------------
// 1. OVERVIEW
// -----------------------------------------------------------------------

push(divider('1. OVERVIEW'));

const victories = runs.filter((r) => r.result === 'victory').length;
const defeats = runs.filter((r) => r.result === 'defeat').length;
const errors = runs.filter((r) => r.result === 'error').length;
const timeouts = runs.filter((r) => r.result === 'timeout').length;
const successfulRuns = victories + defeats;
const successRate = pct(successfulRuns, totalRuns);
const totalDurationMs = runs.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);
const totalPlayTimeSec = (totalDurationMs / 1000).toFixed(0);
const totalPlayTimeMin = (totalDurationMs / 60000).toFixed(1);

push(
  ``,
  `  Total runs        : ${totalRuns}`,
  `  Success rate      : ${successRate}  (${successfulRuns} completed without error/timeout)`,
  `  Total play time   : ${totalPlayTimeSec}s  (${totalPlayTimeMin} min)`,
  `  Data timestamp    : ${raw.timestamp ?? 'unknown'}`,
  ``,
  `  Victories  : ${pad(victories, 5)}  (${pct(victories, totalRuns)})`,
  `  Defeats    : ${pad(defeats, 5)}  (${pct(defeats, totalRuns)})`,
  `  Errors     : ${pad(errors, 5)}  (${pct(errors, totalRuns)})`,
  `  Timeouts   : ${pad(timeouts, 5)}  (${pct(timeouts, totalRuns)})`,
);

// -----------------------------------------------------------------------
// 2. PROFILE COMPARISON TABLE
// -----------------------------------------------------------------------

push(divider('2. PROFILE COMPARISON'));

const profileIds = [...new Set(runs.map((r) => r.profile))].sort();

// Header
push(
  ``,
  `  ${rpad('Profile', 18)} ${pad('Win%', 5)} ${pad('Floor', 5)} ${pad('HP', 5)} ${pad('Cards', 5)} ${pad('Quiz%', 5)} ${pad('Chrg%', 5)} ${pad('Relics', 6)} ${pad('Gold', 5)} ${pad('Time', 7)} ${pad('Errs', 5)}`,
  `  ${'-'.repeat(79)}`,
);

for (const profileId of profileIds) {
  const profileRuns = runs.filter((r) => r.profile === profileId);
  const pVictories = profileRuns.filter((r) => r.result === 'victory').length;
  const pErrors = profileRuns.filter((r) => r.result === 'error' || r.result === 'timeout').length;

  const winRate = pct(pVictories, profileRuns.length);
  const avgFloor = avgStr(profileRuns.map((r) => r.finalFloor));
  const avgHP = avgStr(profileRuns.map((r) => r.finalHP));
  const avgCards = avgStr(profileRuns.map((r) => r.totalCardsPlayed));
  const totalQuiz = profileRuns.reduce((s, r) => s + r.quizCorrect + r.quizWrong, 0);
  const totalCorrect = profileRuns.reduce((s, r) => s + r.quizCorrect, 0);
  const quizAcc = pct(totalCorrect, totalQuiz);
  const totalCards = profileRuns.reduce((s, r) => s + r.totalCardsPlayed, 0);
  const totalCharges = profileRuns.reduce((s, r) => s + r.totalCharges, 0);
  const chargeRate = pct(totalCharges, totalCards);
  const avgRelics = avgStr(profileRuns.map((r) => r.finalRelicCount));
  const avgGold = avgStr(profileRuns.map((r) => r.finalGold), 0);
  const avgDurSec = (avg(profileRuns.map((r) => r.durationMs)) / 1000).toFixed(1) + 's';
  const errRate = pct(pErrors, profileRuns.length);

  push(
    `  ${rpad(profileId, 18)} ${pad(winRate, 5)} ${pad(avgFloor, 5)} ${pad(avgHP, 5)} ${pad(avgCards, 5)} ${pad(quizAcc, 5)} ${pad(chargeRate, 5)} ${pad(avgRelics, 6)} ${pad(avgGold, 5)} ${pad(avgDurSec, 7)} ${pad(errRate, 5)}`,
  );
}

// -----------------------------------------------------------------------
// 3. RELIC TIER LIST
// -----------------------------------------------------------------------

push(divider('3. RELIC TIER LIST'));

// Aggregate relic data
const relicMap = new Map<
  string,
  { seenIn: Set<number>; triggerCounts: number[]; wins: number; total: number }
>();

runs.forEach((run, runIdx) => {
  const isWin = run.result === 'victory' ? 1 : 0;
  (run.relicDetails ?? []).forEach((relic) => {
    if (!relicMap.has(relic.definitionId)) {
      relicMap.set(relic.definitionId, { seenIn: new Set(), triggerCounts: [], wins: 0, total: 0 });
    }
    const entry = relicMap.get(relic.definitionId)!;
    if (!entry.seenIn.has(runIdx)) {
      entry.seenIn.add(runIdx);
      entry.wins += isWin;
      entry.total += 1;
    }
    entry.triggerCounts.push(relic.triggerCount);
  });
});

const overallWinRate = victories / Math.max(totalRuns, 1);

interface RelicStat {
  id: string;
  count: number;
  avgTriggers: number;
  winRate: number;
  delta: number;
}

const relicStats: RelicStat[] = [];
relicMap.forEach((entry, id) => {
  const relicWinRate = entry.wins / Math.max(entry.total, 1);
  relicStats.push({
    id,
    count: entry.total,
    avgTriggers: avg(entry.triggerCounts),
    winRate: relicWinRate,
    delta: relicWinRate - overallWinRate,
  });
});

relicStats.sort((a, b) => b.delta - a.delta);

const top10 = relicStats.slice(0, 10);
const bottom5 = relicStats.slice(-5).reverse();

push(
  ``,
  `  Top 10 Best Relics`,
  `  ${rpad('Rank', 5)} ${rpad('Relic ID', 28)} ${pad('Seen', 5)} ${pad('AvgTrig', 8)} ${pad('WinRate', 8)} ${pad('Δ vs Avg', 9)}`,
  `  ${'-'.repeat(67)}`,
);
top10.forEach((r, i) => {
  const deltaStr = (r.delta >= 0 ? '+' : '') + Math.round(r.delta * 100) + '%';
  push(
    `  ${pad(i + 1, 5)} ${rpad(r.id, 28)} ${pad(r.count, 5)} ${pad(r.avgTriggers.toFixed(1), 8)} ${pad(Math.round(r.winRate * 100) + '%', 8)} ${pad(deltaStr, 9)}`,
  );
});

push(
  ``,
  `  Bottom 5 Worst Relics`,
  `  ${rpad('Rank', 5)} ${rpad('Relic ID', 28)} ${pad('Seen', 5)} ${pad('AvgTrig', 8)} ${pad('WinRate', 8)} ${pad('Δ vs Avg', 9)}`,
  `  ${'-'.repeat(67)}`,
);
bottom5.forEach((r, i) => {
  const deltaStr = (r.delta >= 0 ? '+' : '') + Math.round(r.delta * 100) + '%';
  push(
    `  ${pad(relicStats.length - 4 + i, 5)} ${rpad(r.id, 28)} ${pad(r.count, 5)} ${pad(r.avgTriggers.toFixed(1), 8)} ${pad(Math.round(r.winRate * 100) + '%', 8)} ${pad(deltaStr, 9)}`,
  );
});

// -----------------------------------------------------------------------
// 4. ENEMY DIFFICULTY RANKING
// -----------------------------------------------------------------------

push(divider('4. ENEMY DIFFICULTY RANKING'));

interface EnemyStat {
  name: string;
  encounters: number;
  wins: number;
  turnsArr: number[];
  dmgDealtArr: number[];
  dmgTakenArr: number[];
  hpLostArr: number[];
}

const enemyMap = new Map<string, EnemyStat>();

runs.forEach((run) => {
  (run.encounters ?? []).forEach((enc) => {
    const name = enc.enemyName || 'Unknown';
    if (!enemyMap.has(name)) {
      enemyMap.set(name, {
        name,
        encounters: 0,
        wins: 0,
        turnsArr: [],
        dmgDealtArr: [],
        dmgTakenArr: [],
        hpLostArr: [],
      });
    }
    const e = enemyMap.get(name)!;
    e.encounters++;
    if (enc.result === 'won') e.wins++;
    e.turnsArr.push(enc.turns);
    e.dmgDealtArr.push(enc.damageDealt);
    e.dmgTakenArr.push(enc.damageTaken);
    e.hpLostArr.push(enc.playerHpStart - enc.playerHpEnd);
  });
});

const enemyStats = [...enemyMap.values()].sort(
  (a, b) => a.wins / Math.max(a.encounters, 1) - b.wins / Math.max(b.encounters, 1),
);

push(
  ``,
  `  ${rpad('Enemy Name', 22)} ${pad('Seen', 5)} ${pad('WinRate', 8)} ${pad('AvgTurns', 9)} ${pad('AvgDmgDealt', 12)} ${pad('AvgDmgTaken', 12)} ${pad('AvgHPLost', 10)}`,
  `  ${'-'.repeat(82)}`,
);

enemyStats.forEach((e) => {
  const winRate = pct(e.wins, e.encounters);
  const avgTurns = avg(e.turnsArr).toFixed(1);
  const avgDmgDealt = avg(e.dmgDealtArr).toFixed(1);
  const avgDmgTaken = avg(e.dmgTakenArr).toFixed(1);
  const avgHPLost = avg(e.hpLostArr).toFixed(1);
  push(
    `  ${rpad(e.name.slice(0, 22), 22)} ${pad(e.encounters, 5)} ${pad(winRate, 8)} ${pad(avgTurns, 9)} ${pad(avgDmgDealt, 12)} ${pad(avgDmgTaken, 12)} ${pad(avgHPLost, 10)}`,
  );
});

// -----------------------------------------------------------------------
// 5. PER-FLOOR DEATH RATE
// -----------------------------------------------------------------------

push(divider('5. PER-FLOOR DEATH RATE'));

// Count runs that reached each floor and died there
const maxFloor = 8;
const floorReached: number[] = Array(maxFloor + 1).fill(0);
const floorDeaths: number[] = Array(maxFloor + 1).fill(0);

runs.forEach((run) => {
  // A run "reached" floor N if finalFloor >= N
  for (let f = 0; f <= Math.min(run.finalFloor, maxFloor); f++) {
    floorReached[f]++;
  }
  if (run.result === 'defeat' && run.deathFloor >= 0 && run.deathFloor <= maxFloor) {
    floorDeaths[run.deathFloor]++;
  }
});

push(
  ``,
  `  ${pad('Floor', 6)} ${pad('Reached', 8)} ${pad('Died', 6)} ${pad('Rate', 7)}`,
  `  ${'-'.repeat(32)}`,
);

for (let f = 0; f <= maxFloor; f++) {
  if (floorReached[f] === 0) continue;
  const deathRate = pct(floorDeaths[f], floorReached[f]);
  push(
    `  ${pad(f, 6)} ${pad(floorReached[f], 8)} ${pad(floorDeaths[f], 6)} ${pad(deathRate, 7)}`,
  );
}

// -----------------------------------------------------------------------
// 6. CARD TYPE EFFECTIVENESS
// -----------------------------------------------------------------------

push(divider('6. CARD TYPE EFFECTIVENESS'));

const cardTypeAgg = new Map<string, { played: number; charged: number; quickPlayed: number }>();

runs.forEach((run) => {
  const stats = run.cardTypeStats ?? {};
  for (const [type, data] of Object.entries(stats)) {
    if (!cardTypeAgg.has(type)) {
      cardTypeAgg.set(type, { played: 0, charged: 0, quickPlayed: 0 });
    }
    const agg = cardTypeAgg.get(type)!;
    agg.played += data.played;
    agg.charged += data.charged;
    agg.quickPlayed += data.quickPlayed;
  }
});

const cardTypesSorted = [...cardTypeAgg.entries()].sort((a, b) => b[1].played - a[1].played);

push(
  ``,
  `  ${rpad('Type', 14)} ${pad('Played', 7)} ${pad('Charged', 8)} ${pad('Quick', 6)} ${pad('ChargeRate', 11)}`,
  `  ${'-'.repeat(51)}`,
);

cardTypesSorted.forEach(([type, data]) => {
  const chargeRate = pct(data.charged, data.played);
  push(
    `  ${rpad(type, 14)} ${pad(data.played, 7)} ${pad(data.charged, 8)} ${pad(data.quickPlayed, 6)} ${pad(chargeRate, 11)}`,
  );
});

// -----------------------------------------------------------------------
// 7. CHAIN ANALYSIS
// -----------------------------------------------------------------------

push(divider('7. CHAIN ANALYSIS'));

push(``, `  Avg Max Chain per Profile`);
push(
  `  ${rpad('Profile', 18)} ${pad('AvgMaxChain', 12)}`,
  `  ${'-'.repeat(34)}`,
);

for (const profileId of profileIds) {
  const profileRuns = runs.filter((r) => r.profile === profileId);
  const avgMax = avgStr(profileRuns.map((r) => r.maxChainLength));
  push(`  ${rpad(profileId, 18)} ${pad(avgMax, 12)}`);
}

// Distribution
const chainBuckets: number[] = [0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5+
runs.forEach((r) => {
  const bucket = Math.min(r.maxChainLength ?? 0, 5);
  chainBuckets[bucket]++;
});

push(``, `  Max Chain Length Distribution (all runs)`);
push(
  `  ${rpad('Chain Length', 14)} ${pad('Runs', 6)} ${pad('Share', 7)}`,
  `  ${'-'.repeat(30)}`,
);
chainBuckets.forEach((count, i) => {
  const label = i === 5 ? '5+' : String(i);
  push(`  ${rpad(label, 14)} ${pad(count, 6)} ${pad(pct(count, totalRuns), 7)}`);
});

// Victories vs defeats
const victoryChains = runs.filter((r) => r.result === 'victory').map((r) => r.maxChainLength ?? 0);
const defeatChains = runs.filter((r) => r.result === 'defeat').map((r) => r.maxChainLength ?? 0);

push(
  ``,
  `  Avg max chain — Victories : ${avgStr(victoryChains)}`,
  `  Avg max chain — Defeats   : ${avgStr(defeatChains)}`,
);

// -----------------------------------------------------------------------
// 8. ECONOMY ANALYSIS
// -----------------------------------------------------------------------

push(divider('8. ECONOMY ANALYSIS'));

push(
  ``,
  `  ${rpad('Profile', 18)} ${pad('AvgEarned', 10)} ${pad('AvgSpent', 9)} ${pad('AvgFinal', 9)} ${pad('ShopRate', 9)} ${pad('CardsAdded', 11)} ${pad('CardsRmvd', 10)}`,
  `  ${'-'.repeat(81)}`,
);

for (const profileId of profileIds) {
  const profileRuns = runs.filter((r) => r.profile === profileId);

  const avgEarned = avgStr(profileRuns.map((r) => r.goldEarned), 0);
  const avgSpent = avgStr(profileRuns.map((r) => r.goldSpent), 0);
  const avgFinal = avgStr(profileRuns.map((r) => r.finalGold), 0);

  // Shop visit rate: rooms of type 'shop' or 'merchant'
  const shopVisits = profileRuns.filter((r) =>
    (r.roomsVisited ?? []).some((rv) => rv.type === 'shop' || rv.type === 'merchant'),
  ).length;
  const shopRate = pct(shopVisits, profileRuns.length);

  const avgAdded = avgStr(profileRuns.map((r) => r.cardsAdded));
  const avgRemoved = avgStr(profileRuns.map((r) => r.cardsRemoved));

  push(
    `  ${rpad(profileId, 18)} ${pad(avgEarned, 10)} ${pad(avgSpent, 9)} ${pad(avgFinal, 9)} ${pad(shopRate, 9)} ${pad(avgAdded, 11)} ${pad(avgRemoved, 10)}`,
  );
}

// -----------------------------------------------------------------------
// 9. DOMAIN ACCURACY
// -----------------------------------------------------------------------

push(divider('9. DOMAIN ACCURACY'));

const domainAgg = new Map<string, { answered: number; correct: number }>();

runs.forEach((run) => {
  const da = run.domainAccuracy ?? {};
  for (const [domain, data] of Object.entries(da)) {
    if (!domainAgg.has(domain)) domainAgg.set(domain, { answered: 0, correct: 0 });
    const agg = domainAgg.get(domain)!;
    agg.answered += data.answered;
    agg.correct += data.correct;
  }
});

const domainsSorted = [...domainAgg.entries()].sort((a, b) => b[1].answered - a[1].answered);

push(
  ``,
  `  ${rpad('Domain', 20)} ${pad('Answered', 9)} ${pad('Correct', 8)} ${pad('Accuracy', 9)}`,
  `  ${'-'.repeat(50)}`,
);

domainsSorted.forEach(([domain, data]) => {
  const acc = pct(data.correct, data.answered);
  push(
    `  ${rpad(domain.slice(0, 20), 20)} ${pad(data.answered, 9)} ${pad(data.correct, 8)} ${pad(acc, 9)}`,
  );
});

// -----------------------------------------------------------------------
// 10. BALANCE RECOMMENDATIONS
// -----------------------------------------------------------------------

push(divider('10. AUTO-GENERATED BALANCE RECOMMENDATIONS'));

const recommendations: string[] = [];

// Profile win rate checks
for (const profileId of profileIds) {
  const profileRuns = runs.filter((r) => r.profile === profileId);
  const pVictories = profileRuns.filter((r) => r.result === 'victory').length;
  const winRateNum = pVictories / Math.max(profileRuns.length, 1);
  if (winRateNum > 0.9) {
    recommendations.push(
      `  [BALANCE] Consider increasing difficulty for "${profileId}" players (${Math.round(winRateNum * 100)}% win rate)`,
    );
  } else if (winRateNum < 0.3) {
    recommendations.push(
      `  [BALANCE] Consider decreasing difficulty for "${profileId}" players (only ${Math.round(winRateNum * 100)}% win rate)`,
    );
  }
}

// Enemy difficulty checks
enemyStats.forEach((e) => {
  if (e.encounters < 5) return; // ignore low sample size
  const wr = e.wins / Math.max(e.encounters, 1);
  if (wr < 0.4) {
    recommendations.push(
      `  [ENEMY]   "${e.name}" may be too difficult (only ${Math.round(wr * 100)}% win rate, n=${e.encounters})`,
    );
  } else if (wr > 0.95) {
    recommendations.push(
      `  [ENEMY]   "${e.name}" may be too easy (${Math.round(wr * 100)}% win rate, n=${e.encounters})`,
    );
  }
});

// Relic imbalance
relicStats.forEach((r) => {
  if (r.count < 5) return;
  if (r.delta > 0.3) {
    recommendations.push(
      `  [RELIC]   "${r.id}" is very strong (+${Math.round(r.delta * 100)}% win rate vs avg)`,
    );
  }
});

// Error rate
const overallErrorRate = (errors + timeouts) / Math.max(totalRuns, 1);
if (overallErrorRate > 0.2) {
  recommendations.push(
    `  [BOT]     High error rate (${Math.round(overallErrorRate * 100)}%) — bot reliability needs improvement`,
  );
}

// Floor death traps
for (let f = 0; f <= maxFloor; f++) {
  if (floorReached[f] === 0) continue;
  const deathRate = floorDeaths[f] / floorReached[f];
  if (deathRate > 0.25) {
    recommendations.push(
      `  [FLOOR]   Floor ${f} is a death trap (${Math.round(deathRate * 100)}% death rate, ${floorDeaths[f]}/${floorReached[f]} runs)`,
    );
  }
}

if (recommendations.length === 0) {
  push(``, `  No critical balance issues detected. All metrics within acceptable ranges.`);
} else {
  push(``, ...recommendations);
}

// -----------------------------------------------------------------------
// Finalize
// -----------------------------------------------------------------------

const report = lines.join('\n');

// Print to stdout
console.log(report);

// Save to file
const inputDir = path.dirname(inputPath);
const reportPath = path.join(inputDir, 'balance-report.txt');
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`\nReport saved to: ${reportPath}`);
