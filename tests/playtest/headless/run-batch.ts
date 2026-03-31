/**
 * Headless Batch Runner
 *
 * Runs thousands of headless simulations in a single process (no tsx restart overhead)
 * and outputs results to a timestamped folder.
 *
 * Modes:
 *   --mode full   (default) Full run simulation: map, relics, shop, rest, mystery, gold economy
 *   --mode combat Legacy combat-only simulation (N encounters, fixed enemies)
 *
 * Profile flags:
 *   --profile NAME       Named profile (legacy OR archetype, see bot-profiles.ts)
 *   --archetype NAME     Alias for --profile with archetype profiles
 *   --skills JSON        Custom BotSkills JSON (e.g. '{"accuracy":0.7,"chargeSkill":1.0}')
 *   --sweep AXIS         Sweep one skill axis from 0→1 (e.g. --sweep chargeSkill)
 *   --sweep all          Sweep ALL 10 non-accuracy axes sequentially
 *   --isolation          Run isolation test (each axis at 1.0, rest at baseline)
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --description "Post healing buff"
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --profile scholar
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --mode combat --encounters 30
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100 --sweep chargeSkill
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100 --sweep all
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100 --isolation
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100 --archetype chain_god
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 100 --skills '{"accuracy":0.7,"chargeSkill":1.0}'
 */

import './browser-shim.js';
import { runSimulation, type SimOptions, type SimRunResult } from './simulator.js';
import { simulateFullRun, type FullRunOptions, type FullRunResult } from './full-run-simulator.js';
import type { BotSkills } from './bot-brain.js';
import {
  ALL_PROFILES,
  LEGACY_PROFILES,
  SKILL_AXES,
  type SkillAxis,
  generateSweepProfiles,
  generateIsolationProfiles,
  makeSkills,
  profileLabel,
} from './bot-profiles.js';
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
// Bot profiles matching the browser bot (legacy, kept for backward compat)
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
// Unified profile run descriptor
// ──────────────────────────────────────────────────────────────────────────────

interface ProfileRun {
  label: string;
  skills?: BotSkills;
  // Legacy fallback — only used when skills is undefined
  correctRate?: number;
  chargeRate?: number;
}

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
const profileFilter   = (getArg('--profile') ?? getArg('--archetype')) as string | null;
const maxEncounters   = parseInt(getArg('--encounters') ?? '30', 10);
const healRate        = parseFloat(getArg('--heal-rate') ?? '0.2');
const ascensionLevel  = parseInt(getArg('--ascension') ?? '0', 10);
const simMode         = (getArg('--mode') ?? 'full') as 'full' | 'combat';

// New flags
const sweepAxis       = getArg('--sweep');          // axis name or 'all'
const isIsolation     = args.includes('--isolation');
const customSkillsJson = getArg('--skills');

// ──────────────────────────────────────────────────────────────────────────────
// Determine which profiles to run
// ──────────────────────────────────────────────────────────────────────────────

const profilesToRun: ProfileRun[] = [];

if (sweepAxis) {
  if (sweepAxis === 'all') {
    // Sweep all 10 non-accuracy axes sequentially
    for (const axis of SKILL_AXES) {
      const sweepProfiles = generateSweepProfiles(axis);
      profilesToRun.push(...sweepProfiles.map(sp => ({ label: sp.label, skills: sp.skills })));
    }
  } else {
    // Validate axis name
    if (!(SKILL_AXES as readonly string[]).includes(sweepAxis)) {
      console.error(`Unknown sweep axis "${sweepAxis}". Valid axes: ${SKILL_AXES.join(', ')}`);
      process.exit(1);
    }
    const sweepProfiles = generateSweepProfiles(sweepAxis as SkillAxis);
    profilesToRun.push(...sweepProfiles.map(sp => ({ label: sp.label, skills: sp.skills })));
  }
} else if (isIsolation) {
  const isoProfiles = generateIsolationProfiles();
  profilesToRun.push(...isoProfiles.map(ip => ({ label: ip.label, skills: ip.skills })));
} else if (customSkillsJson) {
  let parsed: Partial<BotSkills>;
  try {
    parsed = JSON.parse(customSkillsJson);
  } catch (e) {
    console.error(`Invalid JSON for --skills: ${customSkillsJson}`);
    process.exit(1);
  }
  const skills = makeSkills(parsed);
  profilesToRun.push({ label: profileLabel(skills), skills });
} else if (profileFilter) {
  // Look up in ALL_PROFILES first (includes both legacy and archetypes)
  const skills = ALL_PROFILES[profileFilter];
  if (skills) {
    profilesToRun.push({ label: profileFilter, skills });
  } else {
    // Check old PROFILES array for backward compat
    const legacy = PROFILES.find(p => p.id === profileFilter);
    if (legacy) {
      profilesToRun.push({ label: legacy.id, correctRate: legacy.correctRate, chargeRate: legacy.chargeRate });
    } else {
      console.error(`Unknown profile "${profileFilter}". Valid: ${Object.keys(ALL_PROFILES).join(', ')}`);
      process.exit(1);
    }
  }
} else {
  // Default: run all legacy profiles using BotSkills
  for (const [id, skills] of Object.entries(LEGACY_PROFILES)) {
    profilesToRun.push({ label: id, skills });
  }
}

if (profilesToRun.length === 0) {
  console.error('No profiles to run. Check your flags.');
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

const runMode = sweepAxis ? `SWEEP (${sweepAxis})` : isIsolation ? 'ISOLATION' : customSkillsJson ? 'CUSTOM SKILLS' : profileFilter ? `PROFILE: ${profileFilter}` : 'ALL LEGACY PROFILES';

console.log(`\n${'='.repeat(60)}`);
console.log(`  HEADLESS SIMULATOR — BATCH RUN`);
console.log(`${'='.repeat(60)}`);
console.log(`  Mode       : ${simMode === 'full' ? 'FULL RUN (map + economy + rooms)' : 'COMBAT ONLY (legacy)'}`);
console.log(`  Profiles   : ${runMode} (${profilesToRun.length} profile${profilesToRun.length !== 1 ? 's' : ''})`);
console.log(`  Runs each  : ${runsPerProfile}`);
console.log(`  Total runs : ${profilesToRun.length * runsPerProfile}`);
if (simMode === 'combat') console.log(`  Max floors : ${maxEncounters}`);
if (simMode === 'combat') console.log(`  Heal rate  : ${(healRate * 100).toFixed(0)}%`);
console.log(`  Ascension  : ${ascensionLevel}`);
console.log(`  Description: ${description}`);
console.log(`  Output     : ${outputDir}`);
console.log(`${'='.repeat(60)}\n`);

// ──────────────────────────────────────────────────────────────────────────────
// Run simulations
// ──────────────────────────────────────────────────────────────────────────────

const startTime = Date.now();
const allResults: Array<SimRunResult & { profile: string }> = [];
const allFullResults: Array<FullRunResult & { profile: string }> = [];
const profileMechanicStats: Record<string, MechanicStats[]> = {};

// For sweep summary: track results per axis level
interface SweepPoint {
  label: string;
  level: number;
  winRate: number;
  avgDmgPerTurn: number;
  avgFloors: number;
  avgHP: number;
}
const sweepResults: SweepPoint[] = [];

for (const profile of profilesToRun) {
  const profileStart = Date.now();
  const elapsed = () => ((Date.now() - profileStart) / 1000).toFixed(1);

  if (simMode === 'full') {
    // ── Full Run Mode ──────────────────────────────────────────────────────────
    const results: FullRunResult[] = [];

    for (let i = 0; i < runsPerProfile; i++) {
      const r = simulateFullRun({
        ...(profile.skills
          ? { botSkills: profile.skills }
          : { correctRate: profile.correctRate!, chargeRate: profile.chargeRate! }),
        maxTurnsPerEncounter: 50,
        verbose:              false,
        ascensionLevel:       ascensionLevel,
        acts:                 3,
      } satisfies FullRunOptions);
      results.push(r);
      allFullResults.push({ ...r, profile: profile.label });
    }

    const survived    = results.filter(r => r.survived).length;
    const avgActs     = results.reduce((s, r) => s + r.actsCompleted, 0) / results.length;
    const avgHP       = results.filter(r => r.survived).reduce((s, r) => s + r.finalHP, 0) / Math.max(survived, 1);
    const avgGoldEarned = results.reduce((s, r) => s + r.goldEarned, 0) / results.length;
    const avgDeckSize = results.reduce((s, r) => s + r.finalDeckSize, 0) / results.length;
    const avgRelics   = results.reduce((s, r) => s + r.relicsAcquired.length, 0) / results.length;
    const avgEncWon   = results.reduce((s, r) => s + r.encountersWon, 0) / results.length;
    const avgDmgPerTurn = results.reduce((s, r) => s + (r.totalTurns > 0 ? r.totalDamageDealt / r.totalTurns : 0), 0) / results.length;

    console.log(
      `  ${profile.label.padEnd(24)} ` +
      `${runsPerProfile} runs | ` +
      `Survived: ${String(survived).padStart(4)}/${runsPerProfile} (${Math.round(survived / runsPerProfile * 100)}%) | ` +
      `Avg acts: ${avgActs.toFixed(2)} | ` +
      `Avg enc won: ${avgEncWon.toFixed(1)} | ` +
      `Avg deck: ${avgDeckSize.toFixed(1)} | ` +
      `Avg relics: ${avgRelics.toFixed(1)} | ` +
      `Avg gold: ${avgGoldEarned.toFixed(0)} | ` +
      `Avg HP (surv): ${avgHP.toFixed(0)} | ` +
      `${elapsed()}s`,
    );

    // Room distribution summary
    const roomTotals: Record<string, number> = {};
    for (const r of results) {
      for (const [type, count] of Object.entries(r.roomsVisited)) {
        roomTotals[type] = (roomTotals[type] ?? 0) + count;
      }
    }
    const totalRooms = Object.values(roomTotals).reduce((s, n) => s + n, 0);
    const roomSummary = Object.entries(roomTotals)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `${type}=${(n / results.length).toFixed(1)}`)
      .join(' ');
    console.log(`    Avg rooms/run: ${(totalRooms / results.length).toFixed(1)} — ${roomSummary}`);

    // Collect sweep point if running sweep
    if (sweepAxis && sweepAxis !== 'all') {
      const levelMatch = profile.label.match(/=([\d.]+)$/);
      const level = levelMatch ? parseFloat(levelMatch[1]) : 0;
      sweepResults.push({
        label: profile.label,
        level,
        winRate: survived / results.length,
        avgDmgPerTurn,
        avgFloors: avgActs,
        avgHP: results.filter(r => r.survived).reduce((s, r) => s + r.finalHP, 0) / Math.max(survived, 1),
      });
    }

    // Save per-profile JSON
    const safeLabel = profile.label.replace(/[^a-zA-Z0-9_.-]/g, '_');
    fs.writeFileSync(
      path.join(outputDir, `${safeLabel}.json`),
      JSON.stringify({ results }, null, 2),
    );

  } else {
    // ── Legacy Combat-Only Mode ───────────────────────────────────────────────
    const results: SimRunResult[] = [];

    for (let i = 0; i < runsPerProfile; i++) {
      const r = runSimulation({
        encounterCount:        maxEncounters,
        ...(profile.skills
          ? { botSkills: profile.skills }
          : { correctRate: profile.correctRate!, chargeRate: profile.chargeRate! }),
        deckSize:              15,
        act:                   1,
        nodeType:              'combat',
        maxTurnsPerEncounter:  50,
        verbose:               false,
        healBetweenEncounters: healRate,
        ascensionLevel:        ascensionLevel,
      } satisfies SimOptions);
      results.push(r);
      allResults.push({ ...r, profile: profile.label });
    }

    const survived  = results.filter(r => r.survived).length;
    const avgFloor  = results.reduce((s, r) => s + r.floorsReached,     0) / results.length;
    const avgCards  = results.reduce((s, r) => s + r.totalCardsPlayed,  0) / results.length;
    const avgHP     = results.filter(r => r.survived).reduce((s, r) => s + r.finalHP, 0) / Math.max(survived, 1);
    const avgDmgPerTurn = results.reduce((s, r) => s + (r.totalCardsPlayed > 0 ? r.totalDamageDealt / r.totalCardsPlayed : 0), 0) / results.length;

    console.log(
      `  ${profile.label.padEnd(24)} ` +
      `${runsPerProfile} runs | ` +
      `Survived: ${String(survived).padStart(4)}/${runsPerProfile} (${Math.round(survived / runsPerProfile * 100)}%) | ` +
      `Avg floor: ${avgFloor.toFixed(1).padStart(5)} | ` +
      `Avg cards: ${avgCards.toFixed(0).padStart(4)} | ` +
      `Avg HP (survivors): ${avgHP.toFixed(0).padStart(4)} | ` +
      `${elapsed()}s`,
    );

    // Collect sweep point if running sweep
    if (sweepAxis && sweepAxis !== 'all') {
      const levelMatch = profile.label.match(/=([\d.]+)$/);
      const level = levelMatch ? parseFloat(levelMatch[1]) : 0;
      sweepResults.push({
        label: profile.label,
        level,
        winRate: survived / results.length,
        avgDmgPerTurn,
        avgFloors: avgFloor,
        avgHP,
      });
    }

    // Compute and print per-mechanic stats
    const mechStats = aggregateMechanicStats(results);
    profileMechanicStats[profile.label] = mechStats;

    console.log(`    Top mechanics by win contribution (${profile.label}):`);
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
    const safeLabel = profile.label.replace(/[^a-zA-Z0-9_.-]/g, '_');
    fs.writeFileSync(
      path.join(outputDir, `${safeLabel}.json`),
      JSON.stringify({ results, mechanicStats: mechStats }, null, 2),
    );
  }
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// ──────────────────────────────────────────────────────────────────────────────
// Sweep summary (printed after all profiles finish)
// ──────────────────────────────────────────────────────────────────────────────

if (sweepAxis && sweepAxis !== 'all' && sweepResults.length > 0) {
  printSweepSummary(sweepAxis, sweepResults);
}

// ──────────────────────────────────────────────────────────────────────────────
// Save combined JSON
// ──────────────────────────────────────────────────────────────────────────────

const combined = {
  timestamp:       new Date().toISOString(),
  description,
  mode:            simMode,
  totalRuns:       simMode === 'full' ? allFullResults.length : allResults.length,
  runsPerProfile,
  durationSeconds: parseFloat(totalElapsed),
  profiles:        profilesToRun.map(p => p.label),
  config:          { maxEncounters, healRate, ascensionLevel, simMode, sweepAxis, isIsolation },
  mechanicStats:   simMode === 'combat' ? profileMechanicStats : {},
  results:         simMode === 'full' ? allFullResults : allResults,
  ...(sweepResults.length > 0 ? { sweepResults } : {}),
};
fs.writeFileSync(path.join(outputDir, 'combined.json'), JSON.stringify(combined, null, 2));

// ──────────────────────────────────────────────────────────────────────────────
// Generate README.md
// ──────────────────────────────────────────────────────────────────────────────

const totalRunCount = simMode === 'full' ? allFullResults.length : allResults.length;

const readmeLines: string[] = [
  `# Headless Playtest: ${timestamp}`,
  '',
  `**Type:** Headless ${simMode === 'full' ? 'Full Run' : 'Combat'} Simulation (no browser)`,
  `**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
  `**Duration:** ${totalElapsed}s`,
  `**Description:** ${description}`,
  `**Total runs:** ${totalRunCount}`,
  `**Ascension level:** ${ascensionLevel}`,
  `**Run mode:** ${runMode}`,
  ...(simMode === 'combat' ? [
    `**Max encounters per run:** ${maxEncounters}`,
    `**Heal between encounters:** ${(healRate * 100).toFixed(0)}%`,
  ] : []),
];

// Sweep summary in README
if (sweepAxis && sweepAxis !== 'all' && sweepResults.length > 0) {
  readmeLines.push(
    '',
    `## Sweep: ${sweepAxis}`,
    '',
    '| Level | Win Rate | Avg Dmg/Turn | Avg Acts/Floors | Avg HP (surv) |',
    '|-------|----------|--------------|-----------------|---------------|',
  );
  for (const sp of sweepResults) {
    readmeLines.push(
      `| ${sp.level.toFixed(1)} | ${(sp.winRate * 100).toFixed(1)}% | ${sp.avgDmgPerTurn.toFixed(1)} | ${sp.avgFloors.toFixed(2)} | ${sp.avgHP.toFixed(0)} |`,
    );
  }

  // Breakpoint analysis
  let maxDelta = 0, maxDeltaFrom = 0;
  for (let i = 1; i < sweepResults.length; i++) {
    const delta = sweepResults[i].winRate - sweepResults[i - 1].winRate;
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaFrom = sweepResults[i - 1].level;
    }
  }
  if (maxDelta > 0) {
    readmeLines.push(``, `**Biggest breakpoint:** ${maxDeltaFrom.toFixed(1)}→${(maxDeltaFrom + 0.1).toFixed(1)} = +${(maxDelta * 100).toFixed(1)}% win rate`);
  }
}

if (simMode === 'full') {
  // ── Full Run README ─────────────────────────────────────────────────────────
  readmeLines.push(
    '',
    '## Results by Profile',
    '',
    '| Profile | Runs | Survived | Survive% | Avg Acts | Avg Enc Won | Avg Deck | Avg Relics | Avg Gold Earned | Avg HP (surv) |',
    '|---------|------|----------|----------|----------|-------------|----------|------------|-----------------|---------------|',
  );

  for (const profile of profilesToRun) {
    const pResults = allFullResults.filter(r => r.profile === profile.label);
    if (pResults.length === 0) continue;
    const survived = pResults.filter(r => r.survived).length;
    const survPct  = Math.round(survived / pResults.length * 100);
    const avgActs  = (pResults.reduce((s, r) => s + r.actsCompleted, 0) / pResults.length).toFixed(2);
    const avgEnc   = (pResults.reduce((s, r) => s + r.encountersWon, 0) / pResults.length).toFixed(1);
    const avgDeck  = (pResults.reduce((s, r) => s + r.finalDeckSize, 0) / pResults.length).toFixed(1);
    const avgRelic = (pResults.reduce((s, r) => s + r.relicsAcquired.length, 0) / pResults.length).toFixed(1);
    const avgGold  = (pResults.reduce((s, r) => s + r.goldEarned, 0) / pResults.length).toFixed(0);
    const avgHP    = (pResults.filter(r => r.survived).reduce((s, r) => s + r.finalHP, 0) / Math.max(survived, 1)).toFixed(0);
    readmeLines.push(`| ${profile.label} | ${pResults.length} | ${survived} | ${survPct}% | ${avgActs} | ${avgEnc} | ${avgDeck} | ${avgRelic} | ${avgGold} | ${avgHP} |`);
  }

  // Room distribution
  readmeLines.push('', '## Room Type Distribution (avg per run)', '', '| Room Type | Avg Visits | % of Total |', '|-----------|-----------|-----------|');
  const roomTotals: Record<string, number> = {};
  for (const r of allFullResults) {
    for (const [type, count] of Object.entries(r.roomsVisited)) {
      roomTotals[type] = (roomTotals[type] ?? 0) + count;
    }
  }
  const totalRoomsAll = Object.values(roomTotals).reduce((s, n) => s + n, 0);
  const runCount = allFullResults.length;
  Object.entries(roomTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, n]) => {
      const avgPerRun = (n / runCount).toFixed(1);
      const pct = totalRoomsAll > 0 ? Math.round(n / totalRoomsAll * 100) : 0;
      readmeLines.push(`| ${type} | ${avgPerRun} | ${pct}% |`);
    });

  // Act completion distribution
  readmeLines.push('', '## Act Completion Distribution', '', '| Acts Completed | Runs | % |', '|---|---|---|');
  const actDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const r of allFullResults) actDist[r.actsCompleted] = (actDist[r.actsCompleted] ?? 0) + 1;
  for (const [acts, count] of Object.entries(actDist).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    readmeLines.push(`| ${acts} | ${count} | ${Math.round(count / runCount * 100)}% |`);
  }

  // Relic acquisition frequency
  const relicCounts: Record<string, number> = {};
  for (const r of allFullResults) {
    for (const id of r.relicsAcquired) {
      relicCounts[id] = (relicCounts[id] ?? 0) + 1;
    }
  }
  const topRelics = Object.entries(relicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  if (topRelics.length > 0) {
    readmeLines.push('', '## Most Acquired Relics (top 15)', '', '| Relic ID | Times Acquired | Avg per Run |', '|----------|---------------|-------------|');
    for (const [id, count] of topRelics) {
      readmeLines.push(`| ${id} | ${count} | ${(count / runCount).toFixed(2)} |`);
    }
  }

} else {
  // ── Legacy Combat-Only README ───────────────────────────────────────────────
  readmeLines.push(
    '',
    '## Results by Profile',
    '',
    '| Profile | Runs | Survived | Survive% | Avg Floor | Avg Cards | Avg Dmg Dealt | Avg Dmg Taken |',
    '|---------|------|----------|----------|-----------|-----------|---------------|---------------|',
  );

  for (const profile of profilesToRun) {
    const pResults  = allResults.filter(r => r.profile === profile.label);
    if (pResults.length === 0) continue;
    const survived  = pResults.filter(r => r.survived).length;
    const avgFloor  = (pResults.reduce((s, r) => s + r.floorsReached,     0) / pResults.length).toFixed(1);
    const avgCards  = (pResults.reduce((s, r) => s + r.totalCardsPlayed,  0) / pResults.length).toFixed(0);
    const avgDmg    = (pResults.reduce((s, r) => s + r.totalDamageDealt,  0) / pResults.length).toFixed(0);
    const avgTaken  = (pResults.reduce((s, r) => s + r.totalDamageTaken,  0) / pResults.length).toFixed(0);
    const survPct   = Math.round(survived / pResults.length * 100);
    readmeLines.push(`| ${profile.label} | ${pResults.length} | ${survived} | ${survPct}% | ${avgFloor} | ${avgCards} | ${avgDmg} | ${avgTaken} |`);
  }

  // Enemy difficulty section
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
}

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

const finalRunCount = profilesToRun.length * runsPerProfile;
console.log(`\n${'='.repeat(60)}`);
console.log(`  COMPLETE — ${finalRunCount} runs in ${totalElapsed}s`);
console.log(`  Output: ${outputDir}`);
console.log(`${'='.repeat(60)}\n`);

// ──────────────────────────────────────────────────────────────────────────────
// printSweepSummary — prints a formatted table + breakpoint analysis
// ──────────────────────────────────────────────────────────────────────────────

function printSweepSummary(
  axis: string,
  results: SweepPoint[],
): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${axis} Sweep (accuracy=0.65, baseline=0.5)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Level  | WinRate | AvgDmg/Turn | AvgActs/Floors | AvgHP`);
  console.log(`-------|---------|-------------|----------------|------`);
  for (const r of results) {
    console.log(
      `${r.level.toFixed(1).padStart(5)}  | ` +
      `${(r.winRate * 100).toFixed(1).padStart(5)}%  | ` +
      `${r.avgDmgPerTurn.toFixed(1).padStart(11)} | ` +
      `${r.avgFloors.toFixed(2).padStart(14)} | ` +
      `${r.avgHP.toFixed(0).padStart(5)}`,
    );
  }

  // Find biggest breakpoint
  let maxDelta = 0, maxDeltaFrom = 0;
  for (let i = 1; i < results.length; i++) {
    const delta = results[i].winRate - results[i - 1].winRate;
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaFrom = results[i - 1].level;
    }
  }
  if (maxDelta > 0) {
    console.log(`\nBreakpoint: ${maxDeltaFrom.toFixed(1)}→${(maxDeltaFrom + 0.1).toFixed(1)} = +${(maxDelta * 100).toFixed(1)}% win rate`);
  }
  console.log(`${'='.repeat(60)}\n`);
}
