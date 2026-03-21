/**
 * Headless Batch Runner
 *
 * Runs thousands of headless combat simulations in a single process (no tsx
 * restart overhead) and outputs results to a timestamped folder.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --description "Post healing buff"
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --profile scholar --encounters 30
 */

import './browser-shim.js';
import { runSimulation, type SimOptions, type SimRunResult } from './simulator.js';
import * as fs from 'fs';
import * as path from 'path';

// ──────────────────────────────────────────────────────────────────────────────
// Per-mechanic win contribution stats
// ──────────────────────────────────────────────────────────────────────────────

interface MechanicStats {
  mechanic: string;
  totalPlays: number;
  chargedPlays: number;
  quickPlays: number;
  correctWhenCharged: number;
  wrongWhenCharged: number;
  totalDamage: number;
  avgDamagePerPlay: number;
  appearedInWins: number;     // how many winning runs included this mechanic
  appearedInLosses: number;   // how many losing runs included this mechanic
  winRateWhenPresent: number; // appearedInWins / (appearedInWins + appearedInLosses)
}

function aggregateMechanicStats(results: SimRunResult[]): MechanicStats[] {
  // Per-mechanic accumulators
  const acc: Record<string, {
    totalPlays: number;
    chargedPlays: number;
    quickPlays: number;
    correctWhenCharged: number;
    wrongWhenCharged: number;
    totalDamage: number;
    appearedInWins: number;
    appearedInLosses: number;
  }> = {};

  for (const run of results) {
    // Collect which mechanics appeared in this run
    const mechanicsInRun = new Set<string>();
    for (const enc of run.encounters) {
      for (const play of enc.cardPlays) {
        const m = play.mechanic;
        if (!acc[m]) {
          acc[m] = { totalPlays: 0, chargedPlays: 0, quickPlays: 0, correctWhenCharged: 0, wrongWhenCharged: 0, totalDamage: 0, appearedInWins: 0, appearedInLosses: 0 };
        }
        acc[m].totalPlays++;
        if (play.wasCharged) {
          acc[m].chargedPlays++;
          if (play.answeredCorrectly) acc[m].correctWhenCharged++;
          else acc[m].wrongWhenCharged++;
        } else {
          acc[m].quickPlays++;
        }
        acc[m].totalDamage += play.damageDealt;
        mechanicsInRun.add(m);
      }
    }

    // Attribute win/loss to each mechanic present
    for (const m of mechanicsInRun) {
      if (!acc[m]) continue; // already guaranteed above, but be safe
      if (run.survived) acc[m].appearedInWins++;
      else acc[m].appearedInLosses++;
    }
  }

  return Object.entries(acc).map(([mechanic, data]) => {
    const totalPresences = data.appearedInWins + data.appearedInLosses;
    return {
      mechanic,
      totalPlays: data.totalPlays,
      chargedPlays: data.chargedPlays,
      quickPlays: data.quickPlays,
      correctWhenCharged: data.correctWhenCharged,
      wrongWhenCharged: data.wrongWhenCharged,
      totalDamage: data.totalDamage,
      avgDamagePerPlay: data.totalPlays > 0 ? data.totalDamage / data.totalPlays : 0,
      appearedInWins: data.appearedInWins,
      appearedInLosses: data.appearedInLosses,
      winRateWhenPresent: totalPresences > 0 ? data.appearedInWins / totalPresences : 0,
    };
  }).sort((a, b) => b.winRateWhenPresent - a.winRateWhenPresent);
}

// ──────────────────────────────────────────────────────────────────────────────
// Bot profiles matching the browser bot
// ──────────────────────────────────────────────────────────────────────────────

// Charge rates calibrated to accuracy: charging costs +1 AP, breaks even at ~56% accuracy.
// Smart players charge more when accuracy is high, less when low.
const PROFILES = [
  { id: 'first_timer',     name: 'First Timer',     correctRate: 0.45, chargeRate: 0.10, strategy: 'basic' as const },
  { id: 'casual_learner',  name: 'Casual Learner',  correctRate: 0.65, chargeRate: 0.35, strategy: 'basic' as const },
  { id: 'regular',         name: 'Regular',         correctRate: 0.62, chargeRate: 0.30, strategy: 'intermediate' as const },
  { id: 'gamer',           name: 'Gamer',           correctRate: 0.55, chargeRate: 0.20, strategy: 'optimal' as const },
  { id: 'dedicated',       name: 'Dedicated',       correctRate: 0.70, chargeRate: 0.55, strategy: 'optimal' as const },
  { id: 'scholar',         name: 'Scholar',         correctRate: 0.82, chargeRate: 0.75, strategy: 'optimal' as const },
] as const;

type ProfileId = (typeof PROFILES)[number]['id'];

// ──────────────────────────────────────────────────────────────────────────────
// CLI arg parsing
// ──────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const runsPerProfile  = parseInt(getArg('--runs') ?? '100', 10);
const description     = getArg('--description') ?? 'Headless balance run';
const profileFilter   = getArg('--profile') as ProfileId | null;
const maxEncounters   = parseInt(getArg('--encounters') ?? '30', 10);
const healRate        = parseFloat(getArg('--heal-rate') ?? '0.2');
const ascensionLevel  = parseInt(getArg('--ascension') ?? '0', 10);

const profilesToRun = profileFilter
  ? PROFILES.filter(p => p.id === profileFilter)
  : [...PROFILES];

if (profilesToRun.length === 0) {
  console.error(`Unknown profile "${profileFilter}". Valid profiles: ${PROFILES.map(p => p.id).join(', ')}`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Output directory setup
// ──────────────────────────────────────────────────────────────────────────────

const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
const outputDir  = path.resolve('data/playtests/runs', timestamp);
fs.mkdirSync(outputDir, { recursive: true });

// ──────────────────────────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`  HEADLESS COMBAT SIMULATOR — BATCH RUN`);
console.log(`${'='.repeat(60)}`);
console.log(`  Profiles   : ${profilesToRun.map(p => p.id).join(', ')}`);
console.log(`  Runs each  : ${runsPerProfile}`);
console.log(`  Total runs : ${profilesToRun.length * runsPerProfile}`);
console.log(`  Max floors : ${maxEncounters}`);
console.log(`  Heal rate  : ${(healRate * 100).toFixed(0)}%`);
console.log(`  Ascension  : ${ascensionLevel}`);
console.log(`  Description: ${description}`);
console.log(`  Output     : ${outputDir}`);
console.log(`${'='.repeat(60)}\n`);

// ──────────────────────────────────────────────────────────────────────────────
// Run simulations
// ──────────────────────────────────────────────────────────────────────────────

const startTime = Date.now();
const allResults: Array<SimRunResult & { profile: ProfileId }> = [];
const profileMechanicStats: Record<string, MechanicStats[]> = {};

for (const profile of profilesToRun) {
  const profileStart = Date.now();
  const results: SimRunResult[] = [];

  for (let i = 0; i < runsPerProfile; i++) {
    const r = runSimulation({
      encounterCount:        maxEncounters,
      correctRate:           profile.correctRate,
      chargeRate:            profile.chargeRate,
      deckSize:              15,
      act:                   1,
      nodeType:              'combat',
      maxTurnsPerEncounter:  50,
      verbose:               false,
      healBetweenEncounters: healRate,
      ascensionLevel:        ascensionLevel,
    } satisfies SimOptions);
    results.push(r);
    allResults.push({ ...r, profile: profile.id });
  }

  // Per-profile console summary
  const survived  = results.filter(r => r.survived).length;
  const avgFloor  = results.reduce((s, r) => s + r.floorsReached,     0) / results.length;
  const avgCards  = results.reduce((s, r) => s + r.totalCardsPlayed,  0) / results.length;
  const avgHP     = results.filter(r => r.survived).reduce((s, r) => s + r.finalHP, 0) / Math.max(survived, 1);
  const elapsed   = ((Date.now() - profileStart) / 1000).toFixed(1);

  console.log(
    `  ${profile.id.padEnd(16)} ` +
    `${runsPerProfile} runs | ` +
    `Survived: ${String(survived).padStart(4)}/${runsPerProfile} (${Math.round(survived / runsPerProfile * 100)}%) | ` +
    `Avg floor: ${avgFloor.toFixed(1).padStart(5)} | ` +
    `Avg cards: ${avgCards.toFixed(0).padStart(4)} | ` +
    `Avg HP (survivors): ${avgHP.toFixed(0).padStart(4)} | ` +
    `${elapsed}s`,
  );

  // Compute and print per-mechanic stats
  const mechStats = aggregateMechanicStats(results);
  profileMechanicStats[profile.id] = mechStats;

  console.log(`    Top mechanics by win contribution (${profile.name}):`);
  const top5 = mechStats.slice(0, 5);
  for (const ms of top5) {
    const winPct = Math.round(ms.winRateWhenPresent * 100);
    const avgDmg = ms.avgDamagePerPlay.toFixed(1);
    console.log(
      `      ${ms.mechanic.padEnd(10)} ` +
      `${String(winPct).padStart(3)}% win rate when present | ` +
      `${avgDmg.padStart(5)} avg dmg/play | ` +
      `${ms.totalPlays} plays (${ms.chargedPlays} charged, ${ms.quickPlays} quick)`,
    );
  }

  // Save per-profile JSON
  fs.writeFileSync(
    path.join(outputDir, `${profile.id}.json`),
    JSON.stringify({ results, mechanicStats: mechStats }, null, 2),
  );
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// ──────────────────────────────────────────────────────────────────────────────
// Save combined JSON
// ──────────────────────────────────────────────────────────────────────────────

const combined = {
  timestamp:       new Date().toISOString(),
  description,
  totalRuns:       allResults.length,
  runsPerProfile,
  durationSeconds: parseFloat(totalElapsed),
  profiles:        profilesToRun.map(p => p.id),
  config:          { maxEncounters, healRate, ascensionLevel },
  mechanicStats:   profileMechanicStats,
  results:         allResults,
};
fs.writeFileSync(path.join(outputDir, 'combined.json'), JSON.stringify(combined, null, 2));

// ──────────────────────────────────────────────────────────────────────────────
// Generate README.md
// ──────────────────────────────────────────────────────────────────────────────

const readmeLines: string[] = [
  `# Headless Playtest: ${timestamp}`,
  '',
  `**Type:** Headless Combat Simulation (no browser)`,
  `**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
  `**Duration:** ${totalElapsed}s`,
  `**Description:** ${description}`,
  `**Total runs:** ${allResults.length}`,
  `**Max encounters per run:** ${maxEncounters}`,
  `**Heal between encounters:** ${(healRate * 100).toFixed(0)}%`,
  `**Ascension level:** ${ascensionLevel}`,
  '',
  '## Results by Profile',
  '',
  '| Profile | Runs | Survived | Survive% | Avg Floor | Avg Cards | Avg Dmg Dealt | Avg Dmg Taken |',
  '|---------|------|----------|----------|-----------|-----------|---------------|---------------|',
];

for (const profile of profilesToRun) {
  const pResults  = allResults.filter(r => r.profile === profile.id);
  const survived  = pResults.filter(r => r.survived).length;
  const avgFloor  = (pResults.reduce((s, r) => s + r.floorsReached,     0) / pResults.length).toFixed(1);
  const avgCards  = (pResults.reduce((s, r) => s + r.totalCardsPlayed,  0) / pResults.length).toFixed(0);
  const avgDmg    = (pResults.reduce((s, r) => s + r.totalDamageDealt,  0) / pResults.length).toFixed(0);
  const avgTaken  = (pResults.reduce((s, r) => s + r.totalDamageTaken,  0) / pResults.length).toFixed(0);
  const survPct   = Math.round(survived / pResults.length * 100);
  readmeLines.push(`| ${profile.id} | ${pResults.length} | ${survived} | ${survPct}% | ${avgFloor} | ${avgCards} | ${avgDmg} | ${avgTaken} |`);
}

// Enemy difficulty section — note: EncounterSummary uses turnsUsed / damageDealtTotal / damageTakenTotal
type EnemyStats = { fights: number; wins: number; totalTurns: number; totalDmg: number; totalTaken: number };
const enemyStats: Record<string, EnemyStats> = {};

for (const r of allResults) {
  for (const e of r.encounters) {
    if (!enemyStats[e.enemyName]) {
      enemyStats[e.enemyName] = { fights: 0, wins: 0, totalTurns: 0, totalDmg: 0, totalTaken: 0 };
    }
    const s = enemyStats[e.enemyName];
    s.fights++;
    if (e.result === 'victory') s.wins++;
    s.totalTurns += e.turnsUsed;
    s.totalDmg   += e.damageDealtTotal;
    s.totalTaken += e.damageTakenTotal;
  }
}

readmeLines.push(
  '',
  '## Enemy Difficulty (sorted by avg damage taken)',
  '',
  '| Enemy | Fights | Win% | Avg Turns | Avg Dmg Dealt | Avg Dmg Taken |',
  '|-------|--------|------|-----------|---------------|---------------|',
);

const sortedEnemies = Object.entries(enemyStats)
  .sort((a, b) => (b[1].totalTaken / b[1].fights) - (a[1].totalTaken / a[1].fights));

for (const [name, data] of sortedEnemies.slice(0, 20)) {
  const wr      = Math.round(data.wins / data.fights * 100);
  const avgT    = (data.totalTurns / data.fights).toFixed(1);
  const avgDmg  = (data.totalDmg   / data.fights).toFixed(0);
  const avgTkn  = (data.totalTaken / data.fights).toFixed(0);
  readmeLines.push(`| ${name} | ${data.fights} | ${wr}% | ${avgT} | ${avgDmg} | ${avgTkn} |`);
}

// Death floor distribution
const deathFloors: Record<number, number> = {};
allResults.filter(r => !r.survived).forEach(r => {
  deathFloors[r.floorsReached] = (deathFloors[r.floorsReached] || 0) + 1;
});
const totalDeaths = allResults.filter(r => !r.survived).length;

readmeLines.push(
  '',
  '## Death Floor Distribution',
  '',
  '| Floor | Deaths | % of Deaths |',
  '|-------|--------|-------------|',
);

Object.entries(deathFloors)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .forEach(([floor, count]) => {
    const pct = totalDeaths > 0 ? Math.round(count / totalDeaths * 100) : 0;
    readmeLines.push(`| ${floor} | ${count} | ${pct}% |`);
  });

readmeLines.push('');

fs.writeFileSync(path.join(outputDir, 'README.md'), readmeLines.join('\n'));

// ──────────────────────────────────────────────────────────────────────────────
// Update latest symlink
// ──────────────────────────────────────────────────────────────────────────────

const runsBase  = path.resolve('data/playtests/runs');
const latestPath = path.join(runsBase, 'latest');
try {
  if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
  fs.symlinkSync(timestamp, latestPath);
} catch {
  // Non-fatal — some environments disallow symlinks
}

// ──────────────────────────────────────────────────────────────────────────────
// Footer
// ──────────────────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`  COMPLETE — ${allResults.length} runs in ${totalElapsed}s`);
console.log(`  Output: ${outputDir}`);
console.log(`${'='.repeat(60)}\n`);
