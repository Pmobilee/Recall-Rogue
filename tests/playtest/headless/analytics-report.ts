/**
 * Analytics Report Generator
 * ===========================
 * Takes aggregated run results from --analytics mode and generates 9 report files:
 *   1. balance-report.md        — Win rates per profile × ascension
 *   2. card-analysis.md/.json   — Per-mechanic win correlation
 *   3. relic-analysis.md/.json  — Per-relic and relic-combo win correlation
 *   4. enemy-analysis.md/.json  — Enemy difficulty and floor progression
 *   5. archetype-analysis.md    — Build archetype comparison
 *   6. correlation-report.md    — Condition→win-rate correlation ranking
 *   7. relic-performance.md     — Survivorship-free relic scoring (post-acquisition metrics)
 *   8. card-performance.md      — Per-card efficiency metrics (dmg/AP, block/play, floor delta)
 *   9. archetype-performance.md — Multi-dimensional archetype scoring (hp efficiency, diversity)
 *
 * Self-contained: accepts a plain data object, no imports from game code.
 * The AnalyticsRun interface mirrors the extended FullRunResult fields added
 * by the companion agent (encounters, finalDeckMechanics, finalDeckTypeDistribution,
 * masteryAtEnd) alongside the pre-existing fields.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ──────────────────────────────────────────────────────────────────────────────
// Data types (local mirror of FullRunResult extended fields)
// ──────────────────────────────────────────────────────────────────────────────

export interface AnalyticsCardPlay {
  mechanic: string;
  wasCharged: boolean;
  answeredCorrectly: boolean;
  damageDealt: number;
  // Extended fields (optional — populated by data model expansion agent)
  blockGained?: number;
  apCost?: number;
  effectValue?: number;
  chainLength?: number;
}

export interface AnalyticsEncounter {
  enemyId: string;
  enemyName: string;
  enemyCategory: string;
  floor: number;
  result: string;
  turns: number;
  damageDealt: number;
  damageTaken: number;
  playerHpAfter: number;
  cardPlays: AnalyticsCardPlay[];
  // Extended fields (optional — populated by data model expansion agent)
  relicsHeld?: string[];
  playerHpBefore?: number;
  apAvailable?: number;
  apSpent?: number;
  chargeRate?: number;
  chargeAccuracy?: number;
}

/** Relic acquisition event attached to a run's timeline. */
export interface RelicAcquisition {
  relicId: string;
  acquiredAtFloor: number;
  acquiredAtAct?: number;
  acquiredAtEncounter?: number;
}

/**
 * Lightweight mechanic descriptor for card-coverage.md.
 * Passed from run-batch.ts (which can import MECHANIC_DEFINITIONS) into the
 * analytics engine (which stays self-contained — no game imports).
 */
export interface MechanicRegistryEntry {
  id: string;
  name: string;
  launchPhase: 1 | 2;
  unlockLevel: number;
  maxPerPool: number;
}

export interface AnalyticsRun {
  profile: string;
  ascension: number;
  survived: boolean;
  actsCompleted: number;
  finalHP: number;
  maxHp: number;
  totalTurns: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalCardsPlayed: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  totalChargedPlays: number;
  totalQuickPlays: number;
  avgMasteryLevel: number;
  relicsAcquired: string[];
  encounters: AnalyticsEncounter[];
  finalDeckMechanics: Record<string, number>;
  finalDeckTypeDistribution: Record<string, number>;
  masteryAtEnd: Record<string, number>;
  deathFloor?: number;
  // Extended field (optional — populated by data model expansion agent)
  relicTimeline?: RelicAcquisition[];
  // Coverage analytics — mechanics that appeared in reward slots this run
  mechanicsOffered?: string[];
  mechanicsTaken?: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate all 10 analytics report files into the given output directory.
 * Creates the directory if it does not exist.
 * Reports 1-6 are the original survivorship-biased reports (preserved unchanged).
 * Reports 7-9 are survivorship-free multi-dimensional reports.
 * Report 10 is card-coverage.md — per-mechanic offered/taken/played histogram.
 *
 * @param mechanicRegistry - Optional full mechanic list (from MECHANIC_DEFINITIONS).
 *   When provided, card-coverage.md shows all 98 mechanics including ZERO-plays ones.
 *   When omitted, only mechanics observed in the run data are shown.
 */
export function generateAnalyticsReports(
  results: AnalyticsRun[],
  outputDir: string,
  mechanicRegistry?: MechanicRegistryEntry[],
): void {
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n  Generating analytics reports (${results.length} runs) → ${outputDir}`);

  generateBalanceReport(results, outputDir);
  generateCardAnalysis(results, outputDir);
  generateRelicAnalysis(results, outputDir);
  generateEnemyAnalysis(results, outputDir);
  generateArchetypeAnalysis(results, outputDir);
  generateCorrelationReport(results, outputDir);
  generateRelicPerformanceReport(results, outputDir);
  generateCardPerformanceReport(results, outputDir);
  generateArchetypePerformanceReport(results, outputDir);
  generateCardCoverageReport(results, outputDir, mechanicRegistry);

  console.log('  Analytics reports complete.');
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function pct(n: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round(n / total * 100)}%`;
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function padR(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function padL(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function warn(rate: number): string {
  if (rate < 0.10 || rate > 0.90) return ' ⚠️';
  return '';
}

/** Median of a numeric array. Returns 0 for empty arrays. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Shannon entropy of a frequency distribution (in bits).
 * Used for deck diversity scoring.
 */
function shannonEntropy(distribution: Record<string, number>): number {
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let entropy = 0;
  for (const count of Object.values(distribution)) {
    if (count <= 0) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 1: balance-report.md
// ──────────────────────────────────────────────────────────────────────────────

function generateBalanceReport(results: AnalyticsRun[], outputDir: string): void {
  // Collect all unique profiles and ascension levels
  const profileSet = new Set<string>();
  const ascSet = new Set<number>();
  for (const r of results) {
    profileSet.add(r.profile);
    ascSet.add(r.ascension);
  }

  const profiles = Array.from(profileSet).sort();
  const ascLevels = Array.from(ascSet).sort((a, b) => a - b);

  // Build win-rate table: profile → ascension → wins/total
  const grid: Record<string, Record<number, { wins: number; total: number }>> = {};
  for (const p of profiles) {
    grid[p] = {};
    for (const a of ascLevels) {
      grid[p][a] = { wins: 0, total: 0 };
    }
  }
  for (const r of results) {
    grid[r.profile][r.ascension].total++;
    if (r.survived) grid[r.profile][r.ascension].wins++;
  }

  // Build per-profile aggregates
  interface ProfileAgg {
    profile: string;
    totalRuns: number;
    wins: number;
    avgTurnsPerEnc: number;
    avgFloor: number;
    avgHpAtDeath: number;
    deathCount: number;
  }

  const profileAggs: ProfileAgg[] = profiles.map(p => {
    const pRuns = results.filter(r => r.profile === p);
    const wins = pRuns.filter(r => r.survived).length;
    const totalEncs = pRuns.reduce((s, r) => s + r.encounters.length, 0);
    const avgTurnsPerEnc = totalEncs > 0
      ? pRuns.reduce((s, r) => s + r.totalTurns, 0) / totalEncs
      : 0;
    const avgFloor = pRuns.reduce((s, r) => s + r.actsCompleted, 0) / Math.max(pRuns.length, 1);
    const deadRuns = pRuns.filter(r => !r.survived);
    const avgHpAtDeath = deadRuns.length > 0
      ? deadRuns.reduce((s, r) => s + r.finalHP, 0) / deadRuns.length
      : 0;
    return {
      profile: p,
      totalRuns: pRuns.length,
      wins,
      avgTurnsPerEnc,
      avgFloor,
      avgHpAtDeath,
      deathCount: deadRuns.length,
    };
  });

  const lines: string[] = [
    '# Balance Report',
    '',
    `*${results.length} total runs across ${profiles.length} profiles and ${ascLevels.length} ascension levels*`,
    '',
    '## Win Rate by Profile × Ascension',
    '',
  ];

  // Table header
  const col0 = 24;
  const colN = 12;
  const header = '| ' + padR('Profile', col0) + ' | ' + ascLevels.map(a => padL(`Asc ${a}`, colN)).join(' | ') + ' |';
  const sep = '|' + '-'.repeat(col0 + 2) + '|' + ascLevels.map(() => '-'.repeat(colN + 2)).join('|') + '|';
  lines.push(header, sep);

  for (const p of profiles) {
    const cells = ascLevels.map(a => {
      const cell = grid[p][a];
      if (cell.total === 0) return padL('—', colN);
      const rate = cell.wins / cell.total;
      const display = `${pct(cell.wins, cell.total)}${warn(rate)}`;
      return padL(display, colN);
    });
    lines.push('| ' + padR(p, col0) + ' | ' + cells.join(' | ') + ' |');
  }

  lines.push(
    '',
    '> ⚠️  = win rate below 10% or above 90% — balance outlier.',
    '',
    '## Per-Profile Summary',
    '',
    '| Profile | Runs | Win% | Avg Turns/Enc | Avg Acts | Avg HP at Death |',
    '|---------|------|------|---------------|----------|-----------------|',
  );

  for (const agg of profileAggs) {
    lines.push(
      `| ${agg.profile} | ${agg.totalRuns} | ${pct(agg.wins, agg.totalRuns)} | ${fmt(agg.avgTurnsPerEnc)} | ${fmt(agg.avgFloor)} | ${agg.deathCount > 0 ? fmt(agg.avgHpAtDeath, 0) : '—'} |`,
    );
  }

  fs.writeFileSync(path.join(outputDir, 'balance-report.md'), lines.join('\n') + '\n');
  console.log('    [1/9] balance-report.md');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 2: card-analysis.md + card-analysis.json
// ──────────────────────────────────────────────────────────────────────────────

function generateCardAnalysis(results: AnalyticsRun[], outputDir: string): void {
  const overallWinRate = results.length > 0 ? results.filter(r => r.survived).length / results.length : 0;

  // Per-mechanic play accumulator
  interface MechanicAcc {
    totalPlays: number;
    chargedPlays: number;
    correctPlays: number;
    totalDamage: number;
    winsWithMechanic: number;
    runsWithMechanic: number;
  }

  const acc: Record<string, MechanicAcc> = {};

  // From card plays
  for (const run of results) {
    const mechanicsSeenInRun = new Set<string>();
    for (const enc of run.encounters) {
      for (const play of enc.cardPlays) {
        const m = play.mechanic;
        if (!acc[m]) {
          acc[m] = { totalPlays: 0, chargedPlays: 0, correctPlays: 0, totalDamage: 0, winsWithMechanic: 0, runsWithMechanic: 0 };
        }
        acc[m].totalPlays++;
        if (play.wasCharged) acc[m].chargedPlays++;
        if (play.answeredCorrectly) acc[m].correctPlays++;
        acc[m].totalDamage += play.damageDealt;
        mechanicsSeenInRun.add(m);
      }
    }

    // Win/loss attribution per mechanic in this run
    for (const m of mechanicsSeenInRun) {
      if (acc[m]) {
        acc[m].runsWithMechanic++;
        if (run.survived) acc[m].winsWithMechanic++;
      }
    }

    // Also count from finalDeckMechanics for runs that ended without much combat
    for (const [m, count] of Object.entries(run.finalDeckMechanics)) {
      if (count > 0 && !mechanicsSeenInRun.has(m)) {
        if (!acc[m]) {
          acc[m] = { totalPlays: 0, chargedPlays: 0, correctPlays: 0, totalDamage: 0, winsWithMechanic: 0, runsWithMechanic: 0 };
        }
        acc[m].runsWithMechanic++;
        if (run.survived) acc[m].winsWithMechanic++;
      }
    }
  }

  interface MechanicStat {
    mechanic: string;
    playCount: number;
    chargeRate: number;
    correctRate: number;
    avgDamage: number;
    winRateWhenInDeck: number;
    overallWinRate: number;
    delta: number;
    runsWithMechanic: number;
  }

  const stats: MechanicStat[] = Object.entries(acc).map(([mechanic, data]) => {
    const winRateWhenInDeck = data.runsWithMechanic > 0 ? data.winsWithMechanic / data.runsWithMechanic : 0;
    return {
      mechanic,
      playCount: data.totalPlays,
      chargeRate: data.chargedPlays > 0 ? data.chargedPlays / data.totalPlays : 0,
      correctRate: data.chargedPlays > 0 ? data.correctPlays / data.chargedPlays : 0,
      avgDamage: data.totalPlays > 0 ? data.totalDamage / data.totalPlays : 0,
      winRateWhenInDeck,
      overallWinRate,
      delta: winRateWhenInDeck - overallWinRate,
      runsWithMechanic: data.runsWithMechanic,
    };
  }).sort((a, b) => b.delta - a.delta);

  // Card type distribution in winning vs losing runs
  const winRuns = results.filter(r => r.survived);
  const lossRuns = results.filter(r => !r.survived);

  function avgTypeDistribution(runs: AnalyticsRun[]): Record<string, number> {
    if (runs.length === 0) return {};
    const totals: Record<string, number> = {};
    for (const run of runs) {
      const deckSize = Object.values(run.finalDeckMechanics).reduce((s, v) => s + v, 0) || 1;
      for (const [type, count] of Object.entries(run.finalDeckTypeDistribution)) {
        totals[type] = (totals[type] ?? 0) + count / deckSize;
      }
    }
    const result: Record<string, number> = {};
    for (const [type, total] of Object.entries(totals)) {
      result[type] = total / runs.length;
    }
    return result;
  }

  const winTypeDist = avgTypeDistribution(winRuns);
  const lossTypeDist = avgTypeDistribution(lossRuns);
  const allTypes = Array.from(new Set([...Object.keys(winTypeDist), ...Object.keys(lossTypeDist)])).sort();

  // Markdown
  const lines: string[] = [
    '# Card Analysis',
    '',
    `*${results.length} total runs | Overall win rate: ${pct(results.filter(r => r.survived).length, results.length)}*`,
    '',
    '## Mechanics Correlated with Winning (sorted by delta)',
    '',
    '| Mechanic | Plays | Charge% | Correct% | Avg Dmg | Win% w/ Mech | Overall Win% | Delta | Runs |',
    '|----------|-------|---------|----------|---------|--------------|--------------|-------|------|',
  ];

  for (const s of stats) {
    lines.push(
      `| ${s.mechanic} | ${s.playCount} | ${pct(s.chargeRate * 100, 100).replace('%', '')}% | ${pct(s.correctRate * 100, 100).replace('%', '')}% | ${fmt(s.avgDamage, 1)} | ${pct(s.winRateWhenInDeck * 100, 100).replace('%', '')}% | ${pct(overallWinRate * 100, 100).replace('%', '')}% | ${s.delta >= 0 ? '+' : ''}${(s.delta * 100).toFixed(1)}% | ${s.runsWithMechanic} |`,
    );
  }

  lines.push(
    '',
    '## Deck Type Distribution: Winners vs Losers',
    '',
    '| Card Type | Winners Avg% | Losers Avg% | Delta |',
    '|-----------|-------------|-------------|-------|',
  );

  for (const type of allTypes) {
    const wPct = (winTypeDist[type] ?? 0) * 100;
    const lPct = (lossTypeDist[type] ?? 0) * 100;
    const delta = wPct - lPct;
    lines.push(`| ${type} | ${fmt(wPct, 1)}% | ${fmt(lPct, 1)}% | ${delta >= 0 ? '+' : ''}${fmt(delta, 1)}% |`);
  }

  fs.writeFileSync(path.join(outputDir, 'card-analysis.md'), lines.join('\n') + '\n');
  fs.writeFileSync(
    path.join(outputDir, 'card-analysis.json'),
    JSON.stringify({ overallWinRate, mechanicStats: stats, deckTypeDistribution: { winners: winTypeDist, losers: lossTypeDist } }, null, 2),
  );
  console.log('    [2/9] card-analysis.md + card-analysis.json');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 3: relic-analysis.md + relic-analysis.json
// ──────────────────────────────────────────────────────────────────────────────

function generateRelicAnalysis(results: AnalyticsRun[], outputDir: string): void {
  const overallWinRate = results.length > 0 ? results.filter(r => r.survived).length / results.length : 0;

  // Per-relic accumulator
  const relicWins: Record<string, number> = {};
  const relicRuns: Record<string, number> = {};

  for (const run of results) {
    const relicSet = new Set(run.relicsAcquired);
    for (const relic of relicSet) {
      relicRuns[relic] = (relicRuns[relic] ?? 0) + 1;
      if (run.survived) relicWins[relic] = (relicWins[relic] ?? 0) + 1;
    }
  }

  interface RelicStat {
    relicId: string;
    runsHeld: number;
    winRateHeld: number;
    winRateNotHeld: number;
    delta: number;
  }

  const relicStats: RelicStat[] = Object.entries(relicRuns).map(([relicId, runsHeld]) => {
    const wins = relicWins[relicId] ?? 0;
    const winRateHeld = runsHeld > 0 ? wins / runsHeld : 0;
    const runsWithout = results.length - runsHeld;
    const winsWithout = results.filter(r => r.survived && !r.relicsAcquired.includes(relicId)).length;
    const winRateNotHeld = runsWithout > 0 ? winsWithout / runsWithout : overallWinRate;
    return {
      relicId,
      runsHeld,
      winRateHeld,
      winRateNotHeld,
      delta: winRateHeld - winRateNotHeld,
    };
  }).sort((a, b) => b.delta - a.delta);

  // Relic combos: all pairs co-occurring in 5+ runs
  const pairMap: Record<string, { wins: number; total: number }> = {};
  for (const run of results) {
    const relics = Array.from(new Set(run.relicsAcquired)).sort();
    for (let i = 0; i < relics.length; i++) {
      for (let j = i + 1; j < relics.length; j++) {
        const key = `${relics[i]}+${relics[j]}`;
        if (!pairMap[key]) pairMap[key] = { wins: 0, total: 0 };
        pairMap[key].total++;
        if (run.survived) pairMap[key].wins++;
      }
    }
  }

  interface PairStat {
    pair: string;
    total: number;
    winRate: number;
  }

  const topCombos: PairStat[] = Object.entries(pairMap)
    .filter(([, v]) => v.total >= 5)
    .map(([pair, v]) => ({ pair, total: v.total, winRate: v.wins / v.total }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 20);

  const lines: string[] = [
    '# Relic Analysis',
    '',
    `*${results.length} total runs | Overall win rate: ${pct(results.filter(r => r.survived).length, results.length)}*`,
    '',
    '## Per-Relic Win Rate (sorted by delta)',
    '',
    '| Relic ID | Runs Held | Win% Held | Win% Not Held | Delta |',
    '|----------|-----------|-----------|---------------|-------|',
  ];

  for (const s of relicStats) {
    lines.push(
      `| ${s.relicId} | ${s.runsHeld} | ${(s.winRateHeld * 100).toFixed(1)}% | ${(s.winRateNotHeld * 100).toFixed(1)}% | ${s.delta >= 0 ? '+' : ''}${(s.delta * 100).toFixed(1)}% |`,
    );
  }

  if (topCombos.length > 0) {
    lines.push(
      '',
      '## Top Relic Combos (co-occurring in 5+ runs, sorted by win rate)',
      '',
      '| Relic Pair | Runs | Win% |',
      '|------------|------|------|',
    );
    for (const c of topCombos) {
      lines.push(`| ${c.pair} | ${c.total} | ${(c.winRate * 100).toFixed(1)}% |`);
    }
  }

  fs.writeFileSync(path.join(outputDir, 'relic-analysis.md'), lines.join('\n') + '\n');
  fs.writeFileSync(
    path.join(outputDir, 'relic-analysis.json'),
    JSON.stringify({ overallWinRate, relicStats, topCombos }, null, 2),
  );
  console.log('    [3/9] relic-analysis.md + relic-analysis.json');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 4: enemy-analysis.md + enemy-analysis.json
// ──────────────────────────────────────────────────────────────────────────────

function generateEnemyAnalysis(results: AnalyticsRun[], outputDir: string): void {
  // Per-enemy accumulator
  interface EnemyAcc {
    enemyId: string;
    enemyName: string;
    encounters: number;
    victories: number;
    totalTurns: number;
    totalDmgTaken: number;
    totalDmgDealt: number;
    totalPlayerHpAfter: number;
  }

  const enemyAcc: Record<string, EnemyAcc> = {};

  // Per-floor accumulator
  interface FloorAcc {
    totalDmgTaken: number;
    defeats: number;
    encounters: number;
  }

  const floorAcc: Record<number, FloorAcc> = {};

  for (const run of results) {
    for (const enc of run.encounters) {
      const key = enc.enemyId;
      if (!enemyAcc[key]) {
        enemyAcc[key] = {
          enemyId: enc.enemyId,
          enemyName: enc.enemyName,
          encounters: 0,
          victories: 0,
          totalTurns: 0,
          totalDmgTaken: 0,
          totalDmgDealt: 0,
          totalPlayerHpAfter: 0,
        };
      }
      enemyAcc[key].encounters++;
      if (enc.result === 'victory') enemyAcc[key].victories++;
      enemyAcc[key].totalTurns += enc.turns;
      enemyAcc[key].totalDmgTaken += enc.damageTaken;
      enemyAcc[key].totalDmgDealt += enc.damageDealt;
      enemyAcc[key].totalPlayerHpAfter += enc.playerHpAfter;

      const f = enc.floor;
      if (!floorAcc[f]) floorAcc[f] = { totalDmgTaken: 0, defeats: 0, encounters: 0 };
      floorAcc[f].encounters++;
      floorAcc[f].totalDmgTaken += enc.damageTaken;
      if (enc.result === 'defeat') floorAcc[f].defeats++;
    }
  }

  interface EnemyStat {
    enemyId: string;
    enemyName: string;
    encounters: number;
    winRate: number;
    avgTurns: number;
    avgDmgTaken: number;
    avgDmgDealt: number;
    avgPlayerHpAfter: number;
  }

  const enemyStats: EnemyStat[] = Object.values(enemyAcc).map(a => ({
    enemyId: a.enemyId,
    enemyName: a.enemyName,
    encounters: a.encounters,
    winRate: a.encounters > 0 ? a.victories / a.encounters : 0,
    avgTurns: a.encounters > 0 ? a.totalTurns / a.encounters : 0,
    avgDmgTaken: a.encounters > 0 ? a.totalDmgTaken / a.encounters : 0,
    avgDmgDealt: a.encounters > 0 ? a.totalDmgDealt / a.encounters : 0,
    avgPlayerHpAfter: a.encounters > 0 ? a.totalPlayerHpAfter / a.encounters : 0,
  }));

  const byDmgTaken = [...enemyStats].sort((a, b) => b.avgDmgTaken - a.avgDmgTaken);
  const byWinRate = [...enemyStats].sort((a, b) => a.winRate - b.winRate);

  const floorStats = Object.entries(floorAcc)
    .map(([floor, a]) => ({
      floor: parseInt(floor),
      avgDmgTaken: a.encounters > 0 ? a.totalDmgTaken / a.encounters : 0,
      deathRate: a.encounters > 0 ? a.defeats / a.encounters : 0,
      encounters: a.encounters,
    }))
    .sort((a, b) => a.floor - b.floor);

  const lines: string[] = [
    '# Enemy Analysis',
    '',
    `*${results.length} runs | ${Object.keys(enemyAcc).length} unique enemies*`,
    '',
    '## Deadliest Enemies (top 10 by avg damage taken)',
    '',
    '| Enemy | Fights | Win% | Avg Turns | Avg Dmg Taken | Avg Dmg Dealt | Avg HP After |',
    '|-------|--------|------|-----------|---------------|---------------|--------------|',
  ];

  for (const s of byDmgTaken.slice(0, 10)) {
    lines.push(
      `| ${s.enemyName} | ${s.encounters} | ${(s.winRate * 100).toFixed(1)}% | ${fmt(s.avgTurns)} | ${fmt(s.avgDmgTaken, 0)} | ${fmt(s.avgDmgDealt, 0)} | ${fmt(s.avgPlayerHpAfter, 0)} |`,
    );
  }

  lines.push(
    '',
    '## Most Failed Encounters (top 10 by loss rate)',
    '',
    '| Enemy | Fights | Win% | Avg Dmg Taken |',
    '|-------|--------|------|---------------|',
  );

  for (const s of byWinRate.slice(0, 10)) {
    lines.push(
      `| ${s.enemyName} | ${s.encounters} | ${(s.winRate * 100).toFixed(1)}% | ${fmt(s.avgDmgTaken, 0)} |`,
    );
  }

  if (floorStats.length > 0) {
    lines.push(
      '',
      '## Floor Difficulty (avg damage taken and death rate per floor)',
      '',
      '| Floor | Encounters | Avg Dmg Taken | Death Rate |',
      '|-------|-----------|---------------|------------|',
    );
    for (const fs of floorStats) {
      lines.push(
        `| ${fs.floor} | ${fs.encounters} | ${fmt(fs.avgDmgTaken, 0)} | ${(fs.deathRate * 100).toFixed(1)}% |`,
      );
    }
  }

  fs.writeFileSync(path.join(outputDir, 'enemy-analysis.md'), lines.join('\n') + '\n');
  fs.writeFileSync(
    path.join(outputDir, 'enemy-analysis.json'),
    JSON.stringify({ enemyStats: byDmgTaken, floorStats }, null, 2),
  );
  console.log('    [4/9] enemy-analysis.md + enemy-analysis.json');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 5: archetype-analysis.md
// ──────────────────────────────────────────────────────────────────────────────

function generateArchetypeAnalysis(results: AnalyticsRun[], outputDir: string): void {
  // Filter to build_ prefix profiles (analytics mode tags them as build_{name})
  const archetypeResults = results.filter(r => r.profile.startsWith('build_'));

  if (archetypeResults.length === 0) {
    // Also try exact archetype profile names if no build_ prefix was used
    const knownArchetypes = new Set([
      'turtle', 'chain_god', 'speedrunner', 'mastery_farmer',
      'quick_player', 'glass_cannon', 'balanced_pro', 'complete_noob',
    ]);
    archetypeResults.push(...results.filter(r => knownArchetypes.has(r.profile)));
  }

  if (archetypeResults.length === 0) {
    const lines = [
      '# Archetype Analysis',
      '',
      '*No build/archetype profiles found in results. Run with --analytics to include build profiles.*',
    ];
    fs.writeFileSync(path.join(outputDir, 'archetype-analysis.md'), lines.join('\n') + '\n');
    console.log('    [5/9] archetype-analysis.md (no archetype data)');
    return;
  }

  const archetypeSet = Array.from(new Set(archetypeResults.map(r => r.profile))).sort();

  interface ArchetypeStat {
    profile: string;
    runs: number;
    winRate: number;
    avgMastery: number;
    avgDeckSize: number;
    deckTypePcts: Record<string, number>;
    viable: boolean;
  }

  const archetypeStats: ArchetypeStat[] = archetypeSet.map(profile => {
    const pRuns = archetypeResults.filter(r => r.profile === profile);
    const wins = pRuns.filter(r => r.survived).length;
    const winRate = pRuns.length > 0 ? wins / pRuns.length : 0;
    const avgMastery = pRuns.reduce((s, r) => s + r.avgMasteryLevel, 0) / Math.max(pRuns.length, 1);
    const avgDeckSize = pRuns.reduce((s, r) => {
      const deckSize = Object.values(r.finalDeckMechanics).reduce((a, b) => a + b, 0);
      return s + deckSize;
    }, 0) / Math.max(pRuns.length, 1);

    // Avg deck type distribution
    const typeTotals: Record<string, number> = {};
    for (const run of pRuns) {
      const deckSize = Object.values(run.finalDeckMechanics).reduce((a, b) => a + b, 0) || 1;
      for (const [type, count] of Object.entries(run.finalDeckTypeDistribution)) {
        typeTotals[type] = (typeTotals[type] ?? 0) + count / deckSize;
      }
    }
    const deckTypePcts: Record<string, number> = {};
    for (const [type, total] of Object.entries(typeTotals)) {
      deckTypePcts[type] = total / Math.max(pRuns.length, 1);
    }

    return {
      profile,
      runs: pRuns.length,
      winRate,
      avgMastery,
      avgDeckSize,
      deckTypePcts,
      viable: winRate >= 0.25,
    };
  });

  const allTypes = Array.from(new Set(archetypeStats.flatMap(s => Object.keys(s.deckTypePcts)))).sort();

  const lines: string[] = [
    '# Archetype Analysis',
    '',
    `*${archetypeResults.length} runs across ${archetypeSet.length} archetypes*`,
    '',
    '> "Viable" = win rate ≥ 25%',
    '',
    '## Archetype Win Rates',
    '',
    '| Profile | Runs | Win% | Viable | Avg Mastery | Avg Deck Size |',
    '|---------|------|------|--------|-------------|---------------|',
  ];

  for (const s of archetypeStats.sort((a, b) => b.winRate - a.winRate)) {
    lines.push(
      `| ${s.profile} | ${s.runs} | ${(s.winRate * 100).toFixed(1)}% | ${s.viable ? 'YES' : 'NO'} | ${fmt(s.avgMastery)} | ${fmt(s.avgDeckSize)} |`,
    );
  }

  if (allTypes.length > 0) {
    lines.push(
      '',
      '## Deck Type Composition by Archetype',
      '',
      `| Profile | ${allTypes.map(t => t.padEnd(8)).join(' | ')} |`,
      `|---------|${allTypes.map(() => '---------|').join('')}`,
    );
    for (const s of archetypeStats.sort((a, b) => b.winRate - a.winRate)) {
      const typeCells = allTypes.map(type => {
        const v = s.deckTypePcts[type] ?? 0;
        return `${(v * 100).toFixed(0)}%`.padEnd(8);
      });
      lines.push(`| ${s.profile} | ${typeCells.join(' | ')} |`);
    }
  }

  fs.writeFileSync(path.join(outputDir, 'archetype-analysis.md'), lines.join('\n') + '\n');
  console.log('    [5/9] archetype-analysis.md');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 6: correlation-report.md
// ──────────────────────────────────────────────────────────────────────────────

function generateCorrelationReport(results: AnalyticsRun[], outputDir: string): void {
  if (results.length === 0) {
    const lines = ['# Correlation Report', '', '*No data.*'];
    fs.writeFileSync(path.join(outputDir, 'correlation-report.md'), lines.join('\n') + '\n');
    console.log('    [6/9] correlation-report.md (no data)');
    return;
  }

  const overallWinRate = results.filter(r => r.survived).length / results.length;

  // Define conditions to evaluate
  interface ConditionDef {
    label: string;
    test: (run: AnalyticsRun) => boolean;
  }

  const conditions: ConditionDef[] = [
    {
      label: 'Shield-heavy (>30% shield)',
      test: r => {
        const deckSize = Object.values(r.finalDeckMechanics).reduce((a, b) => a + b, 0) || 1;
        return (r.finalDeckTypeDistribution['shield'] ?? 0) / deckSize > 0.30;
      },
    },
    {
      label: 'Attack-heavy (>50% attack)',
      test: r => {
        const deckSize = Object.values(r.finalDeckMechanics).reduce((a, b) => a + b, 0) || 1;
        return (r.finalDeckTypeDistribution['attack'] ?? 0) / deckSize > 0.50;
      },
    },
    {
      label: 'High mastery (avg ≥ 3)',
      test: r => r.avgMasteryLevel >= 3,
    },
    {
      label: 'High charge rate (>60%)',
      test: r => r.totalCardsPlayed > 0 && r.totalChargedPlays / r.totalCardsPlayed > 0.60,
    },
    {
      label: 'Utility-heavy (>20% utility)',
      test: r => {
        const deckSize = Object.values(r.finalDeckMechanics).reduce((a, b) => a + b, 0) || 1;
        return (r.finalDeckTypeDistribution['utility'] ?? 0) / deckSize > 0.20;
      },
    },
    {
      label: 'Buff-heavy (>20% buff)',
      test: r => {
        const deckSize = Object.values(r.finalDeckMechanics).reduce((a, b) => a + b, 0) || 1;
        return (r.finalDeckTypeDistribution['buff'] ?? 0) / deckSize > 0.20;
      },
    },
    {
      label: 'High accuracy (>75%)',
      test: r => r.accuracy > 0.75,
    },
    {
      label: 'Low accuracy (<50%)',
      test: r => r.accuracy < 0.50,
    },
    {
      label: 'Survived to act 3',
      test: r => r.actsCompleted >= 3,
    },
    {
      label: 'Large relic collection (≥4)',
      test: r => r.relicsAcquired.length >= 4,
    },
  ];

  // Also add per-relic conditions
  const allRelics = Array.from(new Set(results.flatMap(r => r.relicsAcquired)));
  for (const relic of allRelics) {
    conditions.push({
      label: `Has relic: ${relic}`,
      test: r => r.relicsAcquired.includes(relic),
    });
  }

  // Also add per-mechanic (count ≥ 2) conditions
  const allMechanics = Array.from(new Set(results.flatMap(r => Object.keys(r.finalDeckMechanics))));
  for (const mechanic of allMechanics) {
    conditions.push({
      label: `Has mechanic: ${mechanic} (≥2 copies)`,
      test: r => (r.finalDeckMechanics[mechanic] ?? 0) >= 2,
    });
  }

  interface CorrelationStat {
    label: string;
    winRateWhenTrue: number;
    winRateWhenFalse: number;
    sampleSizeTrue: number;
    sampleSizeFalse: number;
    delta: number;
  }

  const correlations: CorrelationStat[] = [];

  for (const cond of conditions) {
    const trueRuns = results.filter(cond.test);
    const falseRuns = results.filter(r => !cond.test(r));
    if (trueRuns.length < 5) continue; // not enough data

    const winRateWhenTrue = trueRuns.filter(r => r.survived).length / trueRuns.length;
    const winRateWhenFalse = falseRuns.length > 0
      ? falseRuns.filter(r => r.survived).length / falseRuns.length
      : overallWinRate;
    const delta = winRateWhenTrue - winRateWhenFalse;

    correlations.push({
      label: cond.label,
      winRateWhenTrue,
      winRateWhenFalse,
      sampleSizeTrue: trueRuns.length,
      sampleSizeFalse: falseRuns.length,
      delta,
    });
  }

  correlations.sort((a, b) => b.delta - a.delta);

  const top10Positive = correlations.slice(0, 10);
  const top10Negative = correlations.filter(c => c.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10);

  const lines: string[] = [
    '# Correlation Report',
    '',
    `*${results.length} total runs | Overall win rate: ${(overallWinRate * 100).toFixed(1)}% | ${correlations.length} conditions evaluated*`,
    '',
    '## Top 10 Positive Correlates (conditions most associated with winning)',
    '',
    '| Condition | Win% When True | Win% When False | Delta | Sample (T/F) |',
    '|-----------|----------------|-----------------|-------|--------------|',
  ];

  for (const c of top10Positive) {
    lines.push(
      `| ${c.label} | ${(c.winRateWhenTrue * 100).toFixed(1)}% | ${(c.winRateWhenFalse * 100).toFixed(1)}% | +${(c.delta * 100).toFixed(1)}% | ${c.sampleSizeTrue}/${c.sampleSizeFalse} |`,
    );
  }

  lines.push(
    '',
    '## Top 10 Negative Correlates (conditions most associated with losing)',
    '',
    '| Condition | Win% When True | Win% When False | Delta | Sample (T/F) |',
    '|-----------|----------------|-----------------|-------|--------------|',
  );

  for (const c of top10Negative) {
    lines.push(
      `| ${c.label} | ${(c.winRateWhenTrue * 100).toFixed(1)}% | ${(c.winRateWhenFalse * 100).toFixed(1)}% | ${(c.delta * 100).toFixed(1)}% | ${c.sampleSizeTrue}/${c.sampleSizeFalse} |`,
    );
  }

  fs.writeFileSync(path.join(outputDir, 'correlation-report.md'), lines.join('\n') + '\n');
  console.log('    [6/9] correlation-report.md');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 7: relic-performance.md  (survivorship-free relic scoring)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Survivorship-free relic performance report.
 *
 * Unlike the binary win/lose relic-analysis, this report measures what happens
 * AFTER a relic is acquired — so both early-run and late-run relics are scored
 * on equal footing. Relies on the optional `relicTimeline` and `relicsHeld`
 * fields; falls back gracefully when they are absent.
 *
 * Key metrics:
 *   avgFloorsAfterAcq    — floors survived after picking up the relic (outcome-agnostic)
 *   avgEncWonAfterAcq    — encounters won after acquisition
 *   avgDmgPerEncWith     — mean damage dealt in encounters where this relic was held
 *   avgHpLostPerEncWith  — mean HP lost in encounters where this relic was held
 *   avgDmgPerAP          — damage / AP spent in those encounters (requires apSpent)
 *   acqFloorMedian       — typical acquisition floor
 *   shortTermSurvival    — fraction of runs surviving ≥3 floors after acquisition
 *   observationalWinRate — traditional win rate kept for reference
 *   powerScore           — composite score combining the above metrics
 */
export function generateRelicPerformanceReport(results: AnalyticsRun[], outputDir: string): void {
  if (results.length === 0) {
    const lines = ['# Relic Performance (Survivorship-Free)', '', '*No data.*'];
    fs.writeFileSync(path.join(outputDir, 'relic-performance.md'), lines.join('\n') + '\n');
    console.log('    [7/9] relic-performance.md (no data)');
    return;
  }

  // Max floors in a run: survived runs end at floor 18, dead runs use deathFloor
  const MAX_FLOORS = 18;

  // Resolved acquisition floor for a relic in a run.
  // Uses relicTimeline if present, else assumes floor 1 (conservative fallback).
  function getAcqFloor(run: AnalyticsRun, relicId: string): number {
    const entry = run.relicTimeline?.find(rt => rt.relicId === relicId);
    return entry?.acquiredAtFloor ?? 1;
  }

  // Effective "final floor" of a run (18 if survived, else deathFloor ?? actsCompleted * 4)
  function runFinalFloor(run: AnalyticsRun): number {
    if (run.survived) return MAX_FLOORS;
    return run.deathFloor ?? (run.actsCompleted * 4);
  }

  // Collect per-relic accumulators keyed by relicId
  interface RelicPerfAcc {
    floorsAfterAcq: number[];
    encWonAfterAcq: number[];
    acqFloors: number[];
    // For encounters where relic was held (uses relicsHeld if available, else all encs post-acq)
    dmgPerEnc: number[];
    hpLostPerEnc: number[];
    totalDmg: number;
    totalAP: number;  // needs enc.apSpent
    shortTermSurvives: number;  // survived 3+ floors after acq
    totalRuns: number;
    wins: number;
  }

  const acc: Record<string, RelicPerfAcc> = {};

  for (const run of results) {
    // Build a set of unique relics in this run
    const relicsInRun = Array.from(new Set(run.relicsAcquired));

    for (const relicId of relicsInRun) {
      if (!acc[relicId]) {
        acc[relicId] = {
          floorsAfterAcq: [],
          encWonAfterAcq: [],
          acqFloors: [],
          dmgPerEnc: [],
          hpLostPerEnc: [],
          totalDmg: 0,
          totalAP: 0,
          shortTermSurvives: 0,
          totalRuns: 0,
          wins: 0,
        };
      }

      const a = acc[relicId];
      const acqFloor = getAcqFloor(run, relicId);
      const finalFloor = runFinalFloor(run);
      const floorsAfter = Math.max(0, finalFloor - acqFloor);

      a.acqFloors.push(acqFloor);
      a.floorsAfterAcq.push(floorsAfter);
      a.totalRuns++;
      if (run.survived) a.wins++;
      if (floorsAfter >= 3) a.shortTermSurvives++;

      // Count encounters won and aggregate combat metrics after acquisition
      let encWon = 0;
      for (const enc of run.encounters) {
        // Is this encounter "after" the relic was acquired?
        const encIsPostAcq = enc.floor >= acqFloor;
        // If relicsHeld is available, check it directly; otherwise fall back to floor check
        const relicHeldDuringEnc = enc.relicsHeld != null
          ? enc.relicsHeld.includes(relicId)
          : encIsPostAcq;

        if (relicHeldDuringEnc) {
          if (enc.result === 'victory') encWon++;
          a.dmgPerEnc.push(enc.damageDealt);
          a.hpLostPerEnc.push(enc.damageTaken);
          a.totalDmg += enc.damageDealt;
          a.totalAP += enc.apSpent ?? 0;
        }
      }
      a.encWonAfterAcq.push(encWon);
    }
  }

  // Build stats rows — only for relics appearing in 10+ runs
  interface RelicPerfStat {
    relicId: string;
    runs: number;
    avgFloorsAfterAcq: number;
    avgEncWonAfterAcq: number;
    avgDmgPerEncWith: number;
    avgHpLostPerEncWith: number;
    avgDmgPerAP: number;
    acqFloorMedian: number;
    shortTermSurvival: number;
    observationalWinRate: number;
    powerScore: number;
  }

  const stats: RelicPerfStat[] = [];

  for (const [relicId, a] of Object.entries(acc)) {
    if (a.totalRuns < 10) continue;

    const avgFloorsAfterAcq = a.floorsAfterAcq.reduce((s, v) => s + v, 0) / a.floorsAfterAcq.length;
    const avgEncWonAfterAcq = a.encWonAfterAcq.reduce((s, v) => s + v, 0) / a.encWonAfterAcq.length;
    const avgDmgPerEncWith = a.dmgPerEnc.length > 0
      ? a.dmgPerEnc.reduce((s, v) => s + v, 0) / a.dmgPerEnc.length
      : 0;
    const avgHpLostPerEncWith = a.hpLostPerEnc.length > 0
      ? a.hpLostPerEnc.reduce((s, v) => s + v, 0) / a.hpLostPerEnc.length
      : 0;
    const avgDmgPerAP = a.totalAP > 0 ? a.totalDmg / a.totalAP : 0;
    const acqFloorMedian = median(a.acqFloors);
    const shortTermSurvival = a.shortTermSurvives / a.totalRuns;
    const observationalWinRate = a.wins / a.totalRuns;

    stats.push({
      relicId,
      runs: a.totalRuns,
      avgFloorsAfterAcq,
      avgEncWonAfterAcq,
      avgDmgPerEncWith,
      avgHpLostPerEncWith,
      avgDmgPerAP,
      acqFloorMedian,
      shortTermSurvival,
      observationalWinRate,
      powerScore: 0, // computed after normalization below
    });
  }

  if (stats.length === 0) {
    const lines = [
      '# Relic Performance (Survivorship-Free)',
      '',
      '*Not enough data — need 10+ runs per relic. Run with --analytics and more runs.*',
    ];
    fs.writeFileSync(path.join(outputDir, 'relic-performance.md'), lines.join('\n') + '\n');
    console.log('    [7/9] relic-performance.md (insufficient data)');
    return;
  }

  // Compute power scores: normalize each axis to [0, 1] across all relics, then combine.
  const maxFloors = Math.max(...stats.map(s => s.avgFloorsAfterAcq), 1);
  const maxDmgPerAP = Math.max(...stats.map(s => s.avgDmgPerAP), 1);

  for (const s of stats) {
    s.powerScore =
      (s.avgFloorsAfterAcq / maxFloors) * 0.4
      + s.shortTermSurvival * 0.3
      + (s.avgDmgPerAP / maxDmgPerAP) * 0.3;
  }

  // Sort by avgFloorsAfterAcq descending (primary axis)
  stats.sort((a, b) => b.avgFloorsAfterAcq - a.avgFloorsAfterAcq);

  const lines: string[] = [
    '# Relic Performance (Survivorship-Free)',
    '',
    `*${results.length} total runs | ${stats.length} relics with ≥10 appearances*`,
    '',
    '> **Survivorship-free design:** metrics are computed from the moment of relic acquisition',
    '> forward, so a relic acquired on floor 15 is scored the same way as one acquired on floor 1.',
    '> Use `avgFloorsAfterAcq` and `powerScore` as primary ranking signals.',
    '> `observationalWinRate` is kept for comparison with the legacy relic-analysis report.',
    '',
    '## Relic Performance Table (sorted by avgFloorsAfterAcq)',
    '',
    '| Relic ID | Runs | AcqFloor (med) | Floors After Acq | Enc Won After | Dmg/Enc | HP Lost/Enc | Dmg/AP | 3-Floor Surv% | Win% (obs) | Power Score |',
    '|----------|------|----------------|------------------|---------------|---------|-------------|--------|---------------|------------|-------------|',
  ];

  for (const s of stats) {
    lines.push(
      `| ${s.relicId} | ${s.runs} | ${fmt(s.acqFloorMedian, 1)} | ${fmt(s.avgFloorsAfterAcq, 1)} | ${fmt(s.avgEncWonAfterAcq, 1)} | ${fmt(s.avgDmgPerEncWith, 0)} | ${fmt(s.avgHpLostPerEncWith, 0)} | ${fmt(s.avgDmgPerAP, 2)} | ${(s.shortTermSurvival * 100).toFixed(1)}% | ${(s.observationalWinRate * 100).toFixed(1)}% | ${fmt(s.powerScore, 3)} |`,
    );
  }

  // Power score ranking (separate view sorted by powerScore)
  const byPower = [...stats].sort((a, b) => b.powerScore - a.powerScore);

  lines.push(
    '',
    '## Relic Power Score Ranking',
    '',
    '> `powerScore = (avgFloorsAfterAcq / maxFloors) × 0.4 + shortTermSurvival × 0.3 + (avgDmgPerAP / maxDmgPerAP) × 0.3`',
    '',
    '| Rank | Relic ID | Power Score | Floors After Acq | 3-Floor Surv% | Dmg/AP |',
    '|------|----------|-------------|------------------|---------------|--------|',
  );

  for (let i = 0; i < byPower.length; i++) {
    const s = byPower[i];
    lines.push(
      `| ${i + 1} | ${s.relicId} | ${fmt(s.powerScore, 3)} | ${fmt(s.avgFloorsAfterAcq, 1)} | ${(s.shortTermSurvival * 100).toFixed(1)}% | ${fmt(s.avgDmgPerAP, 2)} |`,
    );
  }

  fs.writeFileSync(path.join(outputDir, 'relic-performance.md'), lines.join('\n') + '\n');
  console.log('    [7/9] relic-performance.md');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 8: card-performance.md  (survivorship-free per-card efficiency)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Per-card efficiency metrics that go beyond binary win/lose.
 *
 * Key improvements over card-analysis.md:
 *   - avgDmgPerAP: damage efficiency normalised by AP cost (uses optional apCost field)
 *   - avgBlockPerPlay: quantifies defensive value for shield cards
 *   - floorDelta: avgFloorsWithCard − avgFloorsWithout — the survivorship-free signal
 *   - playFrequency: how often the card is played relative to encounters (demand signal)
 *
 * Cards are filtered to those played 5+ times across all runs (threshold lowered from 50).
 * Rows with 5-49 plays are marked `[low-sample]` in the Mechanic column to flag low confidence.
 * Sorted by avgDmgPerAP for attack cards, avgBlockPerPlay for shield cards.
 */
export function generateCardPerformanceReport(results: AnalyticsRun[], outputDir: string): void {
  if (results.length === 0) {
    const lines = ['# Card Performance (Efficiency Metrics)', '', '*No data.*'];
    fs.writeFileSync(path.join(outputDir, 'card-performance.md'), lines.join('\n') + '\n');
    console.log('    [8/9] card-performance.md (no data)');
    return;
  }

  // Accumulator per mechanic
  interface CardPerfAcc {
    totalPlays: number;
    totalDmg: number;
    totalAP: number;  // from play.apCost
    totalBlock: number; // from play.blockGained
    chargedPlays: number;
    correctCharges: number;
    runsWithCard: Set<number>; // run indices
    runsWithoutCard: Set<number>;
  }

  const acc: Record<string, CardPerfAcc> = {};

  // Index runs for floor-delta calculation
  for (let runIdx = 0; runIdx < results.length; runIdx++) {
    const run = results[runIdx];
    const mechanicsInRun = new Set<string>();

    for (const enc of run.encounters) {
      for (const play of enc.cardPlays) {
        const m = play.mechanic;
        if (!acc[m]) {
          acc[m] = {
            totalPlays: 0,
            totalDmg: 0,
            totalAP: 0,
            totalBlock: 0,
            chargedPlays: 0,
            correctCharges: 0,
            runsWithCard: new Set(),
            runsWithoutCard: new Set(),
          };
        }
        acc[m].totalPlays++;
        acc[m].totalDmg += play.damageDealt;
        acc[m].totalAP += play.apCost ?? 1; // default 1 AP if not recorded
        acc[m].totalBlock += play.blockGained ?? 0;
        if (play.wasCharged) acc[m].chargedPlays++;
        if (play.wasCharged && play.answeredCorrectly) acc[m].correctCharges++;
        mechanicsInRun.add(m);
      }
    }

    // Also check finalDeckMechanics for cards held but not played
    for (const m of Object.keys(run.finalDeckMechanics)) {
      mechanicsInRun.add(m);
    }

    // Tag which runs have / don't have each mechanic
    const allMechanics = new Set(Object.keys(acc));
    for (const m of allMechanics) {
      if (mechanicsInRun.has(m)) {
        acc[m].runsWithCard.add(runIdx);
      } else {
        acc[m].runsWithoutCard.add(runIdx);
      }
    }
  }

  // Effective "final floor" for floor-delta calculation
  const MAX_FLOORS = 18;
  function runFinalFloor(run: AnalyticsRun): number {
    if (run.survived) return MAX_FLOORS;
    return run.deathFloor ?? (run.actsCompleted * 4);
  }

  interface CardPerfStat {
    mechanic: string;
    totalPlays: number;
    avgDmgPerPlay: number;
    avgDmgPerAP: number;
    avgBlockPerPlay: number;
    chargeRate: number;
    chargeAccuracy: number;
    playFrequency: number; // plays / (runs with card * avg enc count)
    avgFloorsWithCard: number;
    avgFloorsWithout: number;
    floorDelta: number;
  }

  // Compute total encounters per run for playFrequency denominator
  const avgEncPerRun = results.reduce((s, r) => s + r.encounters.length, 0) / Math.max(results.length, 1);

  const stats: CardPerfStat[] = [];

  for (const [mechanic, a] of Object.entries(acc)) {
    if (a.totalPlays < 5) continue; // include mechanics with >=5 plays (low-sample marked)

    const runsWith = Array.from(a.runsWithCard).map(i => results[i]);
    const runsWithout = Array.from(a.runsWithoutCard).map(i => results[i]);

    const avgFloorsWithCard = runsWith.length > 0
      ? runsWith.reduce((s, r) => s + runFinalFloor(r), 0) / runsWith.length
      : 0;
    const avgFloorsWithout = runsWithout.length > 0
      ? runsWithout.reduce((s, r) => s + runFinalFloor(r), 0) / runsWithout.length
      : avgFloorsWithCard;

    const playFrequency = runsWith.length > 0 && avgEncPerRun > 0
      ? a.totalPlays / (runsWith.length * avgEncPerRun)
      : 0;

    stats.push({
      mechanic,
      totalPlays: a.totalPlays,
      avgDmgPerPlay: a.totalPlays > 0 ? a.totalDmg / a.totalPlays : 0,
      avgDmgPerAP: a.totalAP > 0 ? a.totalDmg / a.totalAP : 0,
      avgBlockPerPlay: a.totalPlays > 0 ? a.totalBlock / a.totalPlays : 0,
      chargeRate: a.totalPlays > 0 ? a.chargedPlays / a.totalPlays : 0,
      chargeAccuracy: a.chargedPlays > 0 ? a.correctCharges / a.chargedPlays : 0,
      playFrequency,
      avgFloorsWithCard,
      avgFloorsWithout,
      floorDelta: avgFloorsWithCard - avgFloorsWithout,
    });
  }

  if (stats.length === 0) {
    const lines = [
      '# Card Performance (Efficiency Metrics)',
      '',
      '*Not enough data — need 5+ plays per mechanic. Run with more --runs.*',
    ];
    fs.writeFileSync(path.join(outputDir, 'card-performance.md'), lines.join('\n') + '\n');
    console.log('    [8/9] card-performance.md (insufficient data)');
    return;
  }

  // Split into attack (non-zero avg damage) and shield (non-zero avg block) groups
  const attackStats = stats.filter(s => s.avgDmgPerPlay > 0).sort((a, b) => b.avgDmgPerAP - a.avgDmgPerAP);
  const shieldStats = stats.filter(s => s.avgBlockPerPlay > 0).sort((a, b) => b.avgBlockPerPlay - a.avgBlockPerPlay);
  // Utility/other: neither significant damage nor block
  const otherStats = stats
    .filter(s => s.avgDmgPerPlay === 0 && s.avgBlockPerPlay === 0)
    .sort((a, b) => b.floorDelta - a.floorDelta);

  /** Append [low-sample] marker when play count is 5-49 (below old 50-play threshold). */
  function mechanicLabel(s: CardPerfStat): string {
    return s.totalPlays < 50 ? `${s.mechanic} [low-sample]` : s.mechanic;
  }

  const lines: string[] = [
    '# Card Performance (Efficiency Metrics)',
    '',
    `*${results.length} total runs | ${stats.length} mechanics with ≥5 plays ([low-sample] = 5-49)*`,
    '',
    '> **Survivorship-free signal:** `floorDelta` = avgFloorsWithCard − avgFloorsWithout.',
    '> Positive floorDelta means runs containing this card progress farther on average.',
    '> `avgDmgPerAP` normalises damage by AP cost — accounts for cheap vs expensive cards.',
    '',
  ];

  if (attackStats.length > 0) {
    lines.push(
      '## Attack Cards (sorted by avgDmgPerAP)',
      '',
      '| Mechanic | Plays | Dmg/Play | Dmg/AP | Charge% | Accuracy% | Play Freq | Floors w/ | Floors w/o | Delta |',
      '|----------|-------|----------|--------|---------|-----------|-----------|-----------|------------|-------|',
    );
    for (const s of attackStats) {
      lines.push(
        `| ${mechanicLabel(s)} | ${s.totalPlays} | ${fmt(s.avgDmgPerPlay, 1)} | ${fmt(s.avgDmgPerAP, 2)} | ${(s.chargeRate * 100).toFixed(0)}% | ${(s.chargeAccuracy * 100).toFixed(0)}% | ${fmt(s.playFrequency, 2)} | ${fmt(s.avgFloorsWithCard, 1)} | ${fmt(s.avgFloorsWithout, 1)} | ${s.floorDelta >= 0 ? '+' : ''}${fmt(s.floorDelta, 1)} |`,
      );
    }
    lines.push('');
  }

  if (shieldStats.length > 0) {
    lines.push(
      '## Shield / Block Cards (sorted by avgBlockPerPlay)',
      '',
      '| Mechanic | Plays | Block/Play | Dmg/AP | Charge% | Accuracy% | Play Freq | Floors w/ | Floors w/o | Delta |',
      '|----------|-------|------------|--------|---------|-----------|-----------|-----------|------------|-------|',
    );
    for (const s of shieldStats) {
      lines.push(
        `| ${mechanicLabel(s)} | ${s.totalPlays} | ${fmt(s.avgBlockPerPlay, 1)} | ${fmt(s.avgDmgPerAP, 2)} | ${(s.chargeRate * 100).toFixed(0)}% | ${(s.chargeAccuracy * 100).toFixed(0)}% | ${fmt(s.playFrequency, 2)} | ${fmt(s.avgFloorsWithCard, 1)} | ${fmt(s.avgFloorsWithout, 1)} | ${s.floorDelta >= 0 ? '+' : ''}${fmt(s.floorDelta, 1)} |`,
      );
    }
    lines.push('');
  }

  if (otherStats.length > 0) {
    lines.push(
      '## Utility / Other Cards (sorted by floorDelta)',
      '',
      '| Mechanic | Plays | Charge% | Accuracy% | Play Freq | Floors w/ | Floors w/o | Delta |',
      '|----------|-------|---------|-----------|-----------|-----------|------------|-------|',
    );
    for (const s of otherStats) {
      lines.push(
        `| ${mechanicLabel(s)} | ${s.totalPlays} | ${(s.chargeRate * 100).toFixed(0)}% | ${(s.chargeAccuracy * 100).toFixed(0)}% | ${fmt(s.playFrequency, 2)} | ${fmt(s.avgFloorsWithCard, 1)} | ${fmt(s.avgFloorsWithout, 1)} | ${s.floorDelta >= 0 ? '+' : ''}${fmt(s.floorDelta, 1)} |`,
      );
    }
    lines.push('');
  }

  fs.writeFileSync(path.join(outputDir, 'card-performance.md'), lines.join('\n') + '\n');
  console.log('    [8/9] card-performance.md');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 9: archetype-performance.md  (multi-dimensional archetype scoring)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Multi-dimensional archetype performance report.
 *
 * Extends the binary win-rate archetype-analysis.md with:
 *   avgFloorsReached   — mean floors reached (18 if won; survivorship-free)
 *   avgEncountersWon   — mean encounters won per run
 *   avgGoldEarned      — not yet collected in AnalyticsRun; placeholder logged
 *   hpEfficiency       — totalDamageDealt / totalDamageTaken (combat efficiency ratio)
 *   deckDiversity      — Shannon entropy of finalDeckTypeDistribution (bits)
 *
 * Groups results by profile name. Includes all profiles (not just build_ prefix)
 * so progression profiles appear alongside archetype profiles.
 */
export function generateArchetypePerformanceReport(results: AnalyticsRun[], outputDir: string): void {
  if (results.length === 0) {
    const lines = ['# Archetype Performance (Multi-Dimensional)', '', '*No data.*'];
    fs.writeFileSync(path.join(outputDir, 'archetype-performance.md'), lines.join('\n') + '\n');
    console.log('    [9/9] archetype-performance.md (no data)');
    return;
  }

  const MAX_FLOORS = 18;

  function runFinalFloor(run: AnalyticsRun): number {
    if (run.survived) return MAX_FLOORS;
    return run.deathFloor ?? (run.actsCompleted * 4);
  }

  const profiles = Array.from(new Set(results.map(r => r.profile))).sort();

  interface ArchetypePerfStat {
    profile: string;
    runs: number;
    winRate: number;
    avgFloorsReached: number;
    avgEncountersWon: number;
    hpEfficiency: number;
    deckDiversity: number;
  }

  const stats: ArchetypePerfStat[] = profiles.map(profile => {
    const pRuns = results.filter(r => r.profile === profile);
    const wins = pRuns.filter(r => r.survived).length;
    const winRate = pRuns.length > 0 ? wins / pRuns.length : 0;

    const avgFloorsReached = pRuns.reduce((s, r) => s + runFinalFloor(r), 0) / Math.max(pRuns.length, 1);

    const avgEncountersWon = pRuns.reduce((s, r) => {
      const won = r.encounters.filter(e => e.result === 'victory').length;
      return s + won;
    }, 0) / Math.max(pRuns.length, 1);

    // hpEfficiency: aggregate across all runs in this profile
    const totalDmgDealt = pRuns.reduce((s, r) => s + r.totalDamageDealt, 0);
    const totalDmgTaken = pRuns.reduce((s, r) => s + r.totalDamageTaken, 0);
    const hpEfficiency = totalDmgTaken > 0 ? totalDmgDealt / totalDmgTaken : 0;

    // deckDiversity: average Shannon entropy across runs
    const avgDiversity = pRuns.reduce((s, r) => s + shannonEntropy(r.finalDeckTypeDistribution), 0)
      / Math.max(pRuns.length, 1);

    return {
      profile,
      runs: pRuns.length,
      winRate,
      avgFloorsReached,
      avgEncountersWon,
      hpEfficiency,
      deckDiversity: avgDiversity,
    };
  });

  // Sort by avgFloorsReached descending (survivorship-free primary axis)
  stats.sort((a, b) => b.avgFloorsReached - a.avgFloorsReached);

  const lines: string[] = [
    '# Archetype Performance (Multi-Dimensional)',
    '',
    `*${results.length} total runs across ${profiles.length} profiles*`,
    '',
    '> **Primary sort:** avgFloorsReached (survivorship-free — 18 for wins, deathFloor for losses).',
    '> **hpEfficiency:** totalDamageDealt / totalDamageTaken — values >1 mean more damage dealt than taken.',
    '> **deckDiversity:** Shannon entropy of deck type distribution (bits) — higher = more varied deck.',
    '',
    '## Archetype Performance Table',
    '',
    '| Profile | Runs | Win% | Avg Floors | Avg Enc Won | HP Efficiency | Deck Diversity (bits) |',
    '|---------|------|------|------------|-------------|---------------|-----------------------|',
  ];

  for (const s of stats) {
    lines.push(
      `| ${s.profile} | ${s.runs} | ${(s.winRate * 100).toFixed(1)}% | ${fmt(s.avgFloorsReached, 1)} | ${fmt(s.avgEncountersWon, 1)} | ${fmt(s.hpEfficiency, 2)} | ${fmt(s.deckDiversity, 2)} |`,
    );
  }

  // Highlight top and bottom performers on each axis
  const topEfficiency = [...stats].sort((a, b) => b.hpEfficiency - a.hpEfficiency);
  const topDiversity = [...stats].sort((a, b) => b.deckDiversity - a.deckDiversity);

  if (stats.length >= 3) {
    lines.push(
      '',
      '## Notable Archetypes',
      '',
      `**Most HP-Efficient:** ${topEfficiency[0].profile} (${fmt(topEfficiency[0].hpEfficiency, 2)}× ratio)`,
      `**Most Diverse Deck:** ${topDiversity[0].profile} (${fmt(topDiversity[0].deckDiversity, 2)} bits)`,
      `**Most Floors Reached:** ${stats[0].profile} (${fmt(stats[0].avgFloorsReached, 1)} avg)`,
      `**Highest Win Rate:** ${[...stats].sort((a, b) => b.winRate - a.winRate)[0].profile} (${([...stats].sort((a, b) => b.winRate - a.winRate)[0].winRate * 100).toFixed(1)}%)`,
    );
  }

  fs.writeFileSync(path.join(outputDir, 'archetype-performance.md'), lines.join('\n') + '\n');
  console.log('    [9/9] archetype-performance.md');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 10: card-coverage.md  (per-mechanic offered/taken/played histogram)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Per-mechanic coverage histogram showing which mechanics are underrepresented.
 *
 * Three bucket classification:
 *   OK   — >=50 timesPlayed across the batch (mechanic is well-exercised)
 *   LOW  — 5-49 timesPlayed (mechanic appears but rarely)
 *   ZERO — 0 timesPlayed (mechanic never appears in any run)
 *
 * Table is sorted by timesPlayed ascending so problem mechanics are at the top.
 *
 * runsOffered / runsTaken come from per-run coverage tracking in full-run-simulator.ts.
 * When mechanicRegistry is provided, ALL 98 mechanics appear including ZERO-plays ones.
 * When omitted, only mechanics observed in run data are shown.
 */
export function generateCardCoverageReport(
  results: AnalyticsRun[],
  outputDir: string,
  mechanicRegistry?: MechanicRegistryEntry[],
): void {
  const profileList = Array.from(new Set(results.map(r => r.profile))).sort();
  const batchLabel = results.length > 0
    ? `${results.length} runs (${profileList.join(', ')})`
    : 'no data';

  if (results.length === 0) {
    const lines = [
      '# Card Coverage — (no data)',
      '',
      '*No run data provided.*',
    ];
    fs.writeFileSync(path.join(outputDir, 'card-coverage.md'), lines.join('\n') + '\n');
    console.log('    [10/10] card-coverage.md (no data)');
    return;
  }

  // ── Accumulate counters ────────────────────────────────────────────────────

  interface CoverageAcc {
    runsOffered: number;   // number of runs where this mechanic appeared in a reward slot
    runsTaken: number;     // number of runs where the bot picked this mechanic
    timesPlayed: number;   // total card plays across all runs
  }

  const acc: Record<string, CoverageAcc> = {};

  /** Ensure a mechanic has an entry in acc. */
  function ensureMechanic(id: string): CoverageAcc {
    if (!acc[id]) acc[id] = { runsOffered: 0, runsTaken: 0, timesPlayed: 0 };
    return acc[id];
  }

  // Seed acc from registry so ZERO-bucket mechanics appear in the table
  if (mechanicRegistry) {
    for (const m of mechanicRegistry) ensureMechanic(m.id);
  }

  for (const run of results) {
    // Count runsOffered and runsTaken (per-run sets — no double-counting within a run)
    if (run.mechanicsOffered) {
      for (const mechId of run.mechanicsOffered) {
        ensureMechanic(mechId).runsOffered++;
      }
    }
    if (run.mechanicsTaken) {
      for (const mechId of run.mechanicsTaken) {
        ensureMechanic(mechId).runsTaken++;
      }
    }
    // timesPlayed: count card plays across all encounters in this run
    for (const enc of run.encounters) {
      for (const play of enc.cardPlays) {
        if (play.mechanic) ensureMechanic(play.mechanic).timesPlayed++;
      }
    }
  }

  // ── Build per-mechanic stats table ────────────────────────────────────────

  interface CoverageStat {
    id: string;
    name: string;
    phase: number;
    unlockLevel: number;
    maxPerPool: number;
    runsOffered: number;
    runsTaken: number;
    timesPlayed: number;
    status: 'OK' | 'LOW' | 'ZERO';
  }

  // Build lookup for registry metadata
  const registryById: Record<string, MechanicRegistryEntry> = {};
  if (mechanicRegistry) {
    for (const m of mechanicRegistry) registryById[m.id] = m;
  }

  const stats: CoverageStat[] = Object.entries(acc).map(([id, a]) => {
    const reg = registryById[id];
    let status: 'OK' | 'LOW' | 'ZERO';
    if (a.timesPlayed >= 50) status = 'OK';
    else if (a.timesPlayed >= 5) status = 'LOW';
    else status = 'ZERO';

    return {
      id,
      name: reg?.name ?? id,
      phase: reg?.launchPhase ?? 1,
      unlockLevel: reg?.unlockLevel ?? 0,
      maxPerPool: reg?.maxPerPool ?? 0,
      runsOffered: a.runsOffered,
      runsTaken: a.runsTaken,
      timesPlayed: a.timesPlayed,
      status,
    };
  });

  // Sort by timesPlayed ascending — problem mechanics at top
  stats.sort((a, b) => a.timesPlayed - b.timesPlayed || a.id.localeCompare(b.id));

  // ── Summary counts ─────────────────────────────────────────────────────────
  const okCount = stats.filter(s => s.status === 'OK').length;
  const lowCount = stats.filter(s => s.status === 'LOW').length;
  const zeroCount = stats.filter(s => s.status === 'ZERO').length;
  const total = stats.length;

  const isoDate = new Date().toISOString().slice(0, 10);

  const lines: string[] = [
    `# Card Coverage — ${batchLabel}`,
    '',
    `Generated: ${isoDate}`,
    `Runs: ${results.length}`,
    '',
    '## Summary',
    '',
    `- Total mechanics in registry: ${total}`,
    `- **OK** (>=50 plays): ${okCount} / ${total}`,
    `- **LOW** (5-49 plays): ${lowCount} / ${total}`,
    `- **ZERO** (0 plays): ${zeroCount} / ${total}`,
    '',
    '## Per-mechanic table',
    '',
    '| ID | Name | Phase | Unlock | maxPerPool | runsOffered | runsTaken | timesPlayed | Status |',
    '|---|---|---|---|---|---|---|---|---|',
  ];

  for (const s of stats) {
    lines.push(
      `| ${s.id} | ${s.name} | ${s.phase} | ${s.unlockLevel} | ${s.maxPerPool} | ${s.runsOffered} | ${s.runsTaken} | ${s.timesPlayed} | ${s.status} |`,
    );
  }

  // ── ZERO bucket detail ────────────────────────────────────────────────────
  const zeroStats = stats.filter(s => s.status === 'ZERO');
  if (zeroStats.length > 0) {
    lines.push(
      '',
      '## ZERO bucket',
      '',
      '*Mechanics with 0 plays across all runs. These are completely invisible to balance data.*',
      '',
    );
    for (const s of zeroStats) {
      // Guess why it is zero
      const reasons: string[] = [];
      if (s.phase === 2) reasons.push('Phase 2 unlock gate (ENABLE_PHASE2_MECHANICS=false?)');
      if (s.unlockLevel > 0) reasons.push(`unlockLevel=${s.unlockLevel} — may not reach reward tier`);
      if (s.maxPerPool === 1) reasons.push('maxPerPool=1 — rare pool slot, low roll probability');
      if (s.runsOffered === 0) reasons.push('never rolled in reward pool');
      const why = reasons.length > 0 ? reasons.join('; ') : 'unknown — investigate reward pool logic';
      lines.push(`- **${s.id}** (${s.name}): ${why}`);
    }
  }

  fs.writeFileSync(path.join(outputDir, 'card-coverage.md'), lines.join('\n') + '\n');
  console.log(`    [10/10] card-coverage.md (${okCount} OK, ${lowCount} LOW, ${zeroCount} ZERO)`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Force-Sweep Coverage Appendix (Report 11)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Per-mechanic result from the --force-sweep batch.
 * Mirrors run-batch.ts ForceSweepMechanicResult (duplicated to avoid circular import).
 */
export interface ForceSweepMechanicResult {
  mechanicId: string;
  mechanicName: string;
  runsAttempted: number;
  runsWhereTargetPicked: number;
  totalPlaysOfTarget: number;
  pass: boolean;
}

/**
 * Appends a `## Forced Sweep Coverage` section to the existing card-coverage.md.
 * If card-coverage.md does not exist, it creates a standalone file.
 *
 * PASS threshold: totalPlaysOfTarget >= 50.
 * Works for wild-type mechanics (adapt, mirror) because the force-sweep injects
 * the mechanic directly into slot 1, bypassing pickRandomMechanic()'s type pool.
 *
 * @param results - Per-mechanic sweep results from run-batch.ts --force-sweep
 * @param outputDir - Directory where card-coverage.md lives
 */
export function generateForcedSweepCoverage(
  results: ForceSweepMechanicResult[],
  outputDir: string,
): void {
  if (results.length === 0) return;

  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);
  const isoDate = new Date().toISOString().slice(0, 10);

  const lines: string[] = [
    '',
    '## Forced Sweep Coverage',
    '',
    `*Generated: ${isoDate} | Threshold: ≥50 plays per mechanic | ${passed.length}/${results.length} PASS*`,
    '',
    '| Mechanic ID | Name | Runs Attempted | Runs Picked | Total Plays | Status |',
    '|---|---|---|---|---|---|',
  ];

  // Sort: failures first, then by mechanicId
  const sorted = [...results].sort((a, b) => {
    if (a.pass !== b.pass) return a.pass ? 1 : -1;
    return a.mechanicId.localeCompare(b.mechanicId);
  });

  for (const r of sorted) {
    const pickRate = r.runsAttempted > 0
      ? `${r.runsWhereTargetPicked}/${r.runsAttempted} (${Math.round(r.runsWhereTargetPicked / r.runsAttempted * 100)}%)`
      : '0/0';
    lines.push(
      `| ${r.mechanicId} | ${r.mechanicName} | ${r.runsAttempted} | ${pickRate} | ${r.totalPlaysOfTarget} | ${r.pass ? 'PASS' : '**FAIL**'} |`,
    );
  }

  if (failed.length > 0) {
    lines.push(
      '',
      `### Failed mechanics (${failed.length})`,
      '',
      '*These mechanics did not reach 50 plays despite forced slot 1 injection. Investigate their combat playability or AP cost.*',
      '',
    );
    for (const r of failed) {
      lines.push(`- **${r.mechanicId}** (${r.mechanicName}): ${r.totalPlaysOfTarget} plays in ${r.runsAttempted} runs — ${r.runsWhereTargetPicked} runs where it was picked`);
    }
  } else {
    lines.push('', '*All mechanics passed. Sweep complete — every mechanic has sufficient play data.*');
  }

  const coveragePath = path.join(outputDir, 'card-coverage.md');
  if (fs.existsSync(coveragePath)) {
    // Append to existing card-coverage.md
    fs.appendFileSync(coveragePath, lines.join('\n') + '\n');
  } else {
    // Standalone: write a minimal file
    const header = [
      '# Card Coverage — Forced Sweep Only',
      '',
      '*Normal batch not run. Forced sweep results only.*',
    ];
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(coveragePath, [...header, ...lines].join('\n') + '\n');
  }

  console.log(`    [11/11] card-coverage.md ← Forced Sweep Coverage appended (${passed.length} PASS, ${failed.length} FAIL)`);
}
