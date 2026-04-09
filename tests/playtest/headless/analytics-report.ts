/**
 * Analytics Report Generator
 * ===========================
 * Takes aggregated run results from --analytics mode and generates 6 report files:
 *   1. balance-report.md        — Win rates per profile × ascension
 *   2. card-analysis.md/.json   — Per-mechanic win correlation
 *   3. relic-analysis.md/.json  — Per-relic and relic-combo win correlation
 *   4. enemy-analysis.md/.json  — Enemy difficulty and floor progression
 *   5. archetype-analysis.md    — Build archetype comparison
 *   6. correlation-report.md    — Condition→win-rate correlation ranking
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
}

// ──────────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate all 6 analytics report files into the given output directory.
 * Creates the directory if it does not exist.
 */
export function generateAnalyticsReports(
  results: AnalyticsRun[],
  outputDir: string,
): void {
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n  Generating analytics reports (${results.length} runs) → ${outputDir}`);

  generateBalanceReport(results, outputDir);
  generateCardAnalysis(results, outputDir);
  generateRelicAnalysis(results, outputDir);
  generateEnemyAnalysis(results, outputDir);
  generateArchetypeAnalysis(results, outputDir);
  generateCorrelationReport(results, outputDir);

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
  console.log('    [1/6] balance-report.md');
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
  console.log('    [2/6] card-analysis.md + card-analysis.json');
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
  console.log('    [3/6] relic-analysis.md + relic-analysis.json');
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
  console.log('    [4/6] enemy-analysis.md + enemy-analysis.json');
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
    console.log('    [5/6] archetype-analysis.md (no archetype data)');
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
  console.log('    [5/6] archetype-analysis.md');
}

// ──────────────────────────────────────────────────────────────────────────────
// Report 6: correlation-report.md
// ──────────────────────────────────────────────────────────────────────────────

function generateCorrelationReport(results: AnalyticsRun[], outputDir: string): void {
  if (results.length === 0) {
    const lines = ['# Correlation Report', '', '*No data.*'];
    fs.writeFileSync(path.join(outputDir, 'correlation-report.md'), lines.join('\n') + '\n');
    console.log('    [6/6] correlation-report.md (no data)');
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
  console.log('    [6/6] correlation-report.md');
}
