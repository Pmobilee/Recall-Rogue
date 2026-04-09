/**
 * Headless Batch Runner
 *
 * Runs thousands of headless simulations across worker threads and outputs
 * results to a timestamped folder.
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
 * Parallelism flags:
 *   --parallel           Enable parallel execution (default: ON)
 *   --no-parallel        Disable parallel execution (sequential fallback)
 *   --workers N          Number of worker threads (default: min(cpus-2, 12), min 1)
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 10000 --description "Post healing buff"
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000 --profile scholar
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --mode combat --encounters 30
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --sweep chargeSkill
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --sweep all
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --isolation
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --archetype chain_god
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200 --skills '{"accuracy":0.7,"chargeSkill":1.0}'
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 10000 --workers 8
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000 --no-parallel
 */

import './browser-shim.js';
import { runSimulation, type SimOptions, type SimRunResult } from './simulator.js';
import { simulateFullRun, type FullRunOptions, type FullRunResult } from './full-run-simulator.js';
import { PLAYER_START_HP } from '../../../src/data/balance.js';
import type { BotSkills } from './bot-brain.js';
import {
  ALL_PROFILES,
  BUILD_PROFILES,
  LEGACY_PROFILES,
  PROGRESSION_PROFILES,
  SKILL_AXES,
  type SkillAxis,
  generateSweepProfiles,
  generateIsolationProfiles,
  makeSkills,
  profileLabel,
} from './bot-profiles.js';
import { generateAnalyticsReports, type AnalyticsRun } from './analytics-report.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import type { WorkerTask, WorkerResult } from './sim-worker.js';
// ──────────────────────────────────────────────────────────────────────────────
// Worker bootstrap path — a plain .mjs file that registers tsx ESM hooks before
// importing the actual sim-worker.ts. This is necessary because tsx's IPC-based
// ESM loader is NOT automatically propagated to worker threads spawned from a
// different file. See tsx-worker-bootstrap.mjs for details.
// ──────────────────────────────────────────────────────────────────────────────

const WORKER_BOOTSTRAP = fileURLToPath(new URL('./tsx-worker-bootstrap.mjs', import.meta.url));
const WORKER_TS_URL = new URL('./sim-worker.ts', import.meta.url).href;


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
// HP Curve aggregation (Phase 2)
// ──────────────────────────────────────────────────────────────────────────────

interface HpCurvePoint {
  floor: number;
  avgHp: number;
  minHp: number;
  maxHp: number;
  deathCount: number;
  sampleCount: number;
}

function computeHpCurve(results: FullRunResult[], startHp: number): HpCurvePoint[] {
  const floorData: Record<number, { hpValues: number[]; deaths: number }> = {};

  for (const run of results) {
    let hp = startHp;
    for (const visit of run.nodeVisits) {
      hp = Math.max(0, hp + (visit.hpChange ?? 0));
      const f = visit.floor;
      if (!floorData[f]) floorData[f] = { hpValues: [], deaths: 0 };
      floorData[f].hpValues.push(hp);
      if (!run.survived && visit.result === 'defeat') {
        floorData[f].deaths++;
      }
    }
  }

  return Object.entries(floorData)
    .map(([floor, data]) => {
      const sum = data.hpValues.reduce((s, v) => s + v, 0);
      return {
        floor: parseInt(floor),
        avgHp: data.hpValues.length > 0 ? sum / data.hpValues.length : 0,
        minHp: data.hpValues.length > 0 ? Math.min(...data.hpValues) : 0,
        maxHp: data.hpValues.length > 0 ? Math.max(...data.hpValues) : 0,
        deathCount: data.deaths,
        sampleCount: data.hpValues.length,
      };
    })
    .sort((a, b) => a.floor - b.floor);
}

// ──────────────────────────────────────────────────────────────────────────────
// Profile-parallel shared pool (Phase 3)
// Builds all tasks upfront and dispatches to a shared worker pool
// ──────────────────────────────────────────────────────────────────────────────

interface PoolTask {
  profileLabel: string;
  chunkRuns: number;
  fullRunOpts: Omit<FullRunOptions, 'verbose'>;
  combatOpts: Omit<SimOptions, 'verbose'>;
}

/**
 * Run all profiles in parallel using a shared worker pool.
 * All profile×chunk tasks are dispatched across N persistent-ish workers.
 * Results are collected and merged per profile.
 */
async function runAllProfilesParallel(
  profiles: ProfileRun[],
  runsEach: number,
  workers: number,
): Promise<Map<string, FullRunResult[] | SimRunResult[]>> {
  // Build all tasks upfront
  const chunkSize = Math.max(1, Math.ceil(runsEach / workers));
  const allTasks: PoolTask[] = [];

  for (const profile of profiles) {
    const profileAscension = profile.ascensionOverride ?? ascensionLevel;
    const fullRunOpts: Omit<FullRunOptions, 'verbose'> = {
      ...(profile.skills
        ? { botSkills: profile.skills }
        : { correctRate: profile.correctRate!, chargeRate: profile.chargeRate! }),
      maxTurnsPerEncounter: 50,
      ascensionLevel: profileAscension,
      acts: 3,
      forceRelics: forceRelicArg ? [forceRelicArg] : undefined,
    };
    const combatOpts: Omit<SimOptions, 'verbose'> = {
      encounterCount: maxEncounters,
      ...(profile.skills
        ? { botSkills: profile.skills }
        : { correctRate: profile.correctRate!, chargeRate: profile.chargeRate! }),
      deckSize: 15,
      act: 1,
      nodeType: 'combat',
      maxTurnsPerEncounter: 50,
      healBetweenEncounters: healRate,
      ascensionLevel,
    };

    let remaining = runsEach;
    while (remaining > 0) {
      const runs = Math.min(chunkSize, remaining);
      allTasks.push({ profileLabel: profile.label, chunkRuns: runs, fullRunOpts, combatOpts });
      remaining -= runs;
    }
  }

  const resultMap = new Map<string, Array<FullRunResult | SimRunResult>>();
  for (const p of profiles) resultMap.set(p.label, []);

  // Dispatch tasks to pool of N workers, refilling as each completes
  let taskIndex = 0;
  let completed = 0;
  const total = allTasks.length;

  async function runTask(task: PoolTask): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(WORKER_BOOTSTRAP, {
        workerData: { workerFile: WORKER_TS_URL },
      });

      const workerTask: WorkerTask = {
        taskId: taskIndex++,
        mode: simMode,
        profileLabel: task.profileLabel,
        runs: task.chunkRuns,
        ...(simMode === 'full' ? { fullRunOptions: task.fullRunOpts } : { combatOptions: task.combatOpts }),
      };

      worker.on('message', (result: WorkerResult) => {
        completed++;
        const arr = resultMap.get(task.profileLabel)!;
        arr.push(...(result.results as Array<FullRunResult | SimRunResult>));
        process.stdout.write(`    [${String(completed).padStart(3)}/${total} tasks] ${task.profileLabel}: +${result.results.length} runs\n`);
        void worker.terminate();
        resolve();
      });
      worker.on('error', (err) => {
        void worker.terminate();
        reject(err);
      });

      worker.postMessage(workerTask);
    });
  }

  // Run at most `workers` concurrent tasks
  const queue = [...allTasks];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < workers && queue.length > 0) {
      const task = queue.shift()!;
      const p = runTask(task).finally(() => {
        running.splice(running.indexOf(p), 1);
      });
      running.push(p);
    }
    if (running.length > 0) await Promise.race(running);
  }

  return resultMap as Map<string, FullRunResult[] | SimRunResult[]>;
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
  /** Override global ascension level for this specific profile run (used in analytics mode). */
  ascensionOverride?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI arg parsing
// ──────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const runsPerProfile  = parseInt(getArg('--runs') ?? '10000', 10);
const description     = getArg('--description') ?? 'Headless balance run';
const profileFilter   = (getArg('--profile') ?? getArg('--archetype')) as string | null;
const maxEncounters   = parseInt(getArg('--encounters') ?? '30', 10);
const healRate        = parseFloat(getArg('--heal-rate') ?? '0.2');
const ascensionLevel  = parseInt(getArg('--ascension') ?? '0', 10);
const simMode         = (getArg('--mode') ?? 'full') as 'full' | 'combat';

// Parallelism flags
const useParallel     = !args.includes('--no-parallel');
const defaultWorkers  = Math.max(1, Math.min(os.cpus().length - 2, 12));
const workerCount     = Math.max(1, parseInt(getArg('--workers') ?? String(defaultWorkers), 10));

// New flags
const sweepAxis       = getArg('--sweep');          // axis name or 'all'
const isIsolation     = args.includes('--isolation');
const customSkillsJson = getArg('--skills');
const forceRelicArg   = getArg('--force-relic');
const isAnalyticsMode = args.includes('--analytics');

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
  // Default: run all progression profiles (learning curve model)
  for (const [id, skills] of Object.entries(PROGRESSION_PROFILES)) {
    profilesToRun.push({ label: id, skills });
  }
}

// ── Analytics mode: override profilesToRun with full profile suite ──
if (isAnalyticsMode) {
  // Clear any profiles that were built above — analytics mode defines its own set
  profilesToRun.length = 0;

  // All 6 PROGRESSION_PROFILES at ascension 0
  for (const [id, skills] of Object.entries(PROGRESSION_PROFILES)) {
    profilesToRun.push({ label: id, skills, ascensionOverride: 0 });
  }

  // All 8 BUILD_PROFILES at ascension 0
  for (const [id, bp] of Object.entries(BUILD_PROFILES)) {
    profilesToRun.push({ label: id, skills: bp.skills, ascensionOverride: 0 });
  }

  // experienced + master at ascension 0, 5, 10, 15, 20
  for (const [id, skills] of [['experienced', PROGRESSION_PROFILES['experienced']], ['master', PROGRESSION_PROFILES['master']]] as [string, BotSkills][]) {
    for (const asc of [0, 5, 10, 15, 20]) {
      const label = asc === 0 ? id : `${id}@asc${asc}`;
      profilesToRun.push({ label, skills, ascensionOverride: asc });
    }
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

const runMode = sweepAxis ? `SWEEP (${sweepAxis})` : isIsolation ? 'ISOLATION' : customSkillsJson ? 'CUSTOM SKILLS' : profileFilter ? `PROFILE: ${profileFilter}` : 'ALL PROGRESSION PROFILES';

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
console.log(`  Parallel   : ${useParallel ? `YES (${workerCount} workers)` : 'NO (sequential)'}`);
console.log(`  Description: ${description}`);
console.log(`  Output     : ${outputDir}`);
console.log(`${'='.repeat(60)}\n`);

// ──────────────────────────────────────────────────────────────────────────────
// Parallel worker execution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Run a single profile's simulations in parallel across N workers.
 * Splits runsPerProfile into chunks (one per worker), collects results, merges.
 */
async function runProfileParallel(
  profile: ProfileRun,
  runs: number,
  workers: number,
): Promise<FullRunResult[] | SimRunResult[]> {
  // Split run count into per-worker chunks
  const chunkSize = Math.floor(runs / workers);
  const remainder = runs % workers;
  const chunks: number[] = Array.from({ length: workers }, (_, i) =>
    i < remainder ? chunkSize + 1 : chunkSize,
  ).filter(n => n > 0);



  // Build shared options for this profile
  const profileAscensionSingle = profile.ascensionOverride ?? ascensionLevel;
  const fullRunOpts: Omit<FullRunOptions, 'verbose'> = {
    ...(profile.skills
      ? { botSkills: profile.skills }
      : { correctRate: profile.correctRate!, chargeRate: profile.chargeRate! }),
    maxTurnsPerEncounter: 50,
    ascensionLevel: profileAscensionSingle,
    acts: 3,
    forceRelics: forceRelicArg ? [forceRelicArg] : undefined,
  };

  const combatOpts: Omit<SimOptions, 'verbose'> = {
    encounterCount: maxEncounters,
    ...(profile.skills
      ? { botSkills: profile.skills }
      : { correctRate: profile.correctRate!, chargeRate: profile.chargeRate! }),
    deckSize: 15,
    act: 1,
    nodeType: 'combat',
    maxTurnsPerEncounter: 50,
    healBetweenEncounters: healRate,
    ascensionLevel,
  };

  // Launch all chunks concurrently
  const workerPromises = chunks.map((chunkRuns, idx) => {
    return new Promise<WorkerResult>((resolve, reject) => {
      const worker = new Worker(WORKER_BOOTSTRAP, {
        // workerData passes the .ts worker file URL to the bootstrap script.
        // The bootstrap registers tsx ESM hooks, then imports sim-worker.ts.
        workerData: { workerFile: WORKER_TS_URL },
      });

      const task: WorkerTask = {
        taskId: idx,
        mode: simMode,
        profileLabel: profile.label,
        runs: chunkRuns,
        ...(simMode === 'full' ? { fullRunOptions: fullRunOpts } : { combatOptions: combatOpts }),
      };

      worker.on('message', (result: WorkerResult) => {
        resolve(result);
        void worker.terminate();
      });

      worker.on('error', (err) => {
        reject(err);
        void worker.terminate();
      });

      worker.postMessage(task);
    });
  });

  // Collect results as workers complete and print progress
  let completed = 0;
  const allResults: Array<FullRunResult | SimRunResult> = [];

  await Promise.all(
    workerPromises.map(p =>
      p.then(result => {
        completed++;
        allResults.push(...(result.results as Array<FullRunResult | SimRunResult>));
        console.log(`    [${String(completed).padStart(2)}/${chunks.length} workers] ${profile.label}: ${result.results.length} runs done`);
      }),
    ),
  );

  return allResults as FullRunResult[] | SimRunResult[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Run simulations
// ──────────────────────────────────────────────────────────────────────────────

const startTime = Date.now();
const allResults: Array<SimRunResult & { profile: string }> = [];
const allFullResults: Array<FullRunResult & { profile: string }> = [];
const profileMechanicStats: Record<string, MechanicStats[]> = {};
const profileHpCurves: Record<string, HpCurvePoint[]> = {};

// Phase 3: If running multiple profiles with parallel enabled, use shared pool
// for cross-profile parallelism (dispatches all profile×chunk tasks concurrently)
const isMultiProfile = profilesToRun.length > 1 && !sweepAxis && !isIsolation;
let poolResults: Map<string, FullRunResult[] | SimRunResult[]> | null = null;
if (isMultiProfile && useParallel && workerCount > 1 && simMode === 'full') {
  console.log(`  Running all profiles in shared pool (${workerCount} workers)...`);
  poolResults = await runAllProfilesParallel(profilesToRun, runsPerProfile, workerCount);
}

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
    let results: FullRunResult[];

    if (poolResults) {
      // Use results from shared pool (cross-profile parallel dispatch)
      results = (poolResults.get(profile.label) ?? []) as FullRunResult[];
    } else if (useParallel && workerCount > 1) {
      results = (await runProfileParallel(profile, runsPerProfile, workerCount)) as FullRunResult[];
    } else {
      results = [];
      for (let i = 0; i < runsPerProfile; i++) {
        const r = simulateFullRun({
          ...(profile.skills
            ? { botSkills: profile.skills }
            : { correctRate: profile.correctRate!, chargeRate: profile.chargeRate! }),
          maxTurnsPerEncounter: 50,
          verbose:              false,
          ascensionLevel:       profile.ascensionOverride ?? ascensionLevel,
          acts:                 3,
          forceRelics:          forceRelicArg ? [forceRelicArg] : undefined,
        } satisfies FullRunOptions);
        results.push(r);
      }
    }

    for (const r of results) {
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
    // New Phase 1/2 aggregates
    const avgMastery  = results.reduce((s, r) => s + r.avgMasteryLevel, 0) / results.length;
    const totalCharged = results.reduce((s, r) => s + r.totalChargedPlays, 0);
    const totalPlays  = results.reduce((s, r) => s + r.totalCardsPlayed, 0);
    const chargeRate_ = totalPlays > 0 ? totalCharged / totalPlays : 0;
    const totalCorrCharged = results.reduce((s, r) => s + r.chargeSuccessRate * r.totalChargedPlays, 0);
    const chargeAcc   = totalCharged > 0 ? totalCorrCharged / totalCharged : 0;
    const nearMissCount = results.filter(r => r.isNearMiss).length;
    const comebackCount = results.filter(r => r.isComeback).length;

    // Phase 2: HP curve
    const hpCurve = computeHpCurve(results, PLAYER_START_HP);
    profileHpCurves[profile.label] = hpCurve;

    console.log(
      `  ${profile.label.padEnd(20)} ` +
      `${results.length} runs | ` +
      `Win: ${Math.round(survived / results.length * 100)}% | ` +
      `Charge: ${Math.round(chargeRate_ * 100)}% (${Math.round(chargeAcc * 100)}% acc) | ` +
      `Mastery: ${avgMastery.toFixed(1)} avg | ` +
      `Near-miss: ${Math.round(nearMissCount / results.length * 100)}% | ` +
      `Comeback: ${Math.round(comebackCount / results.length * 100)}% | ` +
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
    console.log(`    Avg rooms/run: ${(totalRooms / results.length).toFixed(1)} — ${roomSummary} | Avg acts: ${avgActs.toFixed(2)} | Avg enc: ${avgEncWon.toFixed(1)} | Gold: ${avgGoldEarned.toFixed(0)} | HP(surv): ${avgHP.toFixed(0)}`);

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
      JSON.stringify({ results, hpCurve }, null, 2),
    );

  } else {
    // ── Legacy Combat-Only Mode ───────────────────────────────────────────────
    let results: SimRunResult[];

    if (useParallel && workerCount > 1) {
      results = (await runProfileParallel(profile, runsPerProfile, workerCount)) as SimRunResult[];
    } else {
      results = [];
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
      }
    }

    for (const r of results) {
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
};
// ── Analytics mode: generate detailed analytics reports BEFORE combined.json ─
// (combined.json can exceed V8 string limit at high run counts with encounter details)

if (isAnalyticsMode && simMode === 'full' && allFullResults.length > 0) {
  const analyticsRuns: AnalyticsRun[] = allFullResults.map(r => {
    // Determine ascension for this run from profilesToRun
    const profileDef = profilesToRun.find(p => p.label === r.profile);
    const runAscension = profileDef?.ascensionOverride ?? ascensionLevel;

    // Map encounters: the other agent adds these fields to FullRunResult.
    // Cast through unknown to handle the extended fields gracefully.
    const fullResult = r as unknown as Record<string, unknown>;

    const encounters: AnalyticsRun['encounters'] = Array.isArray(fullResult['encounters'])
      ? (fullResult['encounters'] as Array<Record<string, unknown>>).map(enc => ({
          enemyId:      String(enc['enemyId'] ?? enc['enemyName'] ?? 'unknown'),
          enemyName:    String(enc['enemyName'] ?? 'unknown'),
          enemyCategory: String(enc['enemyCategory'] ?? 'unknown'),
          floor:        Number(enc['floor'] ?? 0),
          result:       String(enc['result'] ?? 'unknown'),
          turns:        Number(enc['turns'] ?? enc['turnsUsed'] ?? 0),
          damageDealt:  Number(enc['damageDealt'] ?? enc['damageDealtTotal'] ?? 0),
          damageTaken:  Number(enc['damageTaken'] ?? enc['damageTakenTotal'] ?? 0),
          playerHpAfter: Number(enc['playerHpAfter'] ?? enc['playerHpEnd'] ?? 0),
          cardPlays:    Array.isArray(enc['cardPlays'])
            ? (enc['cardPlays'] as Array<Record<string, unknown>>).map(p => ({
                mechanic:          String(p['mechanic'] ?? ''),
                wasCharged:        Boolean(p['wasCharged']),
                answeredCorrectly: Boolean(p['answeredCorrectly']),
                damageDealt:       Number(p['damageDealt'] ?? 0),
              }))
            : [],
        }))
      : [];

    const finalDeckMechanics = (fullResult['finalDeckMechanics'] as Record<string, number> | undefined) ?? {};
    const finalDeckTypeDistribution = (fullResult['finalDeckTypeDistribution'] as Record<string, number> | undefined) ?? {};
    const masteryAtEnd = (fullResult['masteryAtEnd'] as Record<string, number> | undefined) ?? {};

    return {
      profile:     r.profile,
      ascension:   runAscension,
      survived:    r.survived,
      actsCompleted: r.actsCompleted,
      finalHP:     r.finalHP,
      maxHp:       80, // PLAYER_MAX_HP approximation (real value is in balance.ts)
      totalTurns:  r.totalTurns,
      totalDamageDealt: r.totalDamageDealt,
      totalDamageTaken: r.totalDamageTaken,
      totalCardsPlayed: r.totalCardsPlayed,
      totalCorrect: r.totalCorrect,
      totalWrong:   r.totalWrong,
      accuracy:     r.accuracy,
      totalChargedPlays: r.totalChargedPlays,
      totalQuickPlays:   r.totalQuickPlays,
      avgMasteryLevel:   r.avgMasteryLevel,
      relicsAcquired:    r.relicsAcquired,
      encounters,
      finalDeckMechanics,
      finalDeckTypeDistribution,
      masteryAtEnd,
      deathFloor: r.deathFloor || undefined,
    };
  });

  const analyticsOutputDir = path.join(outputDir, 'analytics');
  generateAnalyticsReports(analyticsRuns, analyticsOutputDir);
}

// Write combined.json — strip encounter details to avoid V8 string limit at high run counts
try {
  const strippedResults = simMode === 'full'
    ? allFullResults.map(r => {
        const { encounters, deckEvolution, ...rest } = r as Record<string, unknown>;
        void encounters; void deckEvolution;
        return rest;
      })
    : allResults;
  const combined = {
    timestamp,
    description: runDescription,
    totalRuns:   simMode === 'full' ? allFullResults.length : allResults.length,
    runsPerProfile: runsPerProfile,
    durationSeconds: totalElapsed,
    profiles:    profilesToRun.map(p => p.label),
    config:      { maxEncounters, healRate, ascensionLevel, simMode, sweepAxis, isIsolation, parallel: useParallel, workers: workerCount },
    mechanicStats: simMode === 'combat' ? profileMechanicStats : {},
    results:     strippedResults,
    ...(sweepResults.length > 0 ? { sweepResults } : {}),
  };
  fs.writeFileSync(path.join(outputDir, 'combined.json'), JSON.stringify(combined, null, 2));
} catch (err) {
  console.warn(`  [WARN] combined.json too large to write (${allFullResults.length} runs). Analytics reports still generated.`);
}

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
  `**Parallel:** ${useParallel ? `Yes (${workerCount} workers)` : 'No (sequential)'}`,
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
  const runCount = allFullResults.length;

  readmeLines.push(
    '',
    '## Results by Profile',
    '',
    '| Profile | Runs | Win% | Charge% | Charge Acc | Avg Mastery | Near-Miss% | Comeback% | Avg Acts | Avg HP (surv) |',
    '|---------|------|------|---------|------------|-------------|------------|-----------|----------|---------------|',
  );

  for (const profile of profilesToRun) {
    const pResults = allFullResults.filter(r => r.profile === profile.label);
    if (pResults.length === 0) continue;
    const survived = pResults.filter(r => r.survived).length;
    const survPct  = Math.round(survived / pResults.length * 100);
    const avgActs  = (pResults.reduce((s, r) => s + r.actsCompleted, 0) / pResults.length).toFixed(2);
    const avgHP    = (pResults.filter(r => r.survived).reduce((s, r) => s + r.finalHP, 0) / Math.max(survived, 1)).toFixed(0);
    const pTotalCharged = pResults.reduce((s, r) => s + r.totalChargedPlays, 0);
    const pTotalPlays = pResults.reduce((s, r) => s + r.totalCardsPlayed, 0);
    const pChargeRate = pTotalPlays > 0 ? Math.round(pTotalCharged / pTotalPlays * 100) : 0;
    const pCorrCharged = pResults.reduce((s, r) => s + r.chargeSuccessRate * r.totalChargedPlays, 0);
    const pChargeAcc = pTotalCharged > 0 ? Math.round(pCorrCharged / pTotalCharged * 100) : 0;
    const pAvgMastery = (pResults.reduce((s, r) => s + r.avgMasteryLevel, 0) / pResults.length).toFixed(2);
    const pNearMiss = Math.round(pResults.filter(r => r.isNearMiss).length / pResults.length * 100);
    const pComeback = Math.round(pResults.filter(r => r.isComeback).length / pResults.length * 100);
    readmeLines.push(`| ${profile.label} | ${pResults.length} | ${survPct}% | ${pChargeRate}% | ${pChargeAcc}% | ${pAvgMastery} | ${pNearMiss}% | ${pComeback}% | ${avgActs} | ${avgHP} |`);
  }

  // Mastery Distribution
  readmeLines.push('', '## Mastery Distribution (avg deck at run end)', '', '| Profile | L0 | L1 | L2 | L3 | L4 | L5 | Avg Level |', '|---------|----|----|----|----|----|----|-----------|');
  for (const profile of profilesToRun) {
    const pResults = allFullResults.filter(r => r.profile === profile.label);
    if (pResults.length === 0) continue;
    const dist = [0,0,0,0,0,0];
    for (const r of pResults) { for (let i=0;i<6;i++) dist[i] += r.masteryDistribution[i] ?? 0; }
    const total = dist.reduce((s,v)=>s+v,0) || 1;
    const pct = dist.map(v=>`${(v/total*100).toFixed(0)}%`).join(' | ');
    const avgMastery = (pResults.reduce((s,r)=>s+r.avgMasteryLevel,0)/pResults.length).toFixed(2);
    readmeLines.push(`| ${profile.label} | ${pct} | ${avgMastery} |`);
  }

  // Charge Analysis
  readmeLines.push('', '## Charge Analysis', '', '| Profile | Charge Rate | Charge Acc | Dmg from Charges | Dmg from Quick | Charge DMG% |', '|---------|-------------|------------|-----------------|----------------|-------------|');
  for (const profile of profilesToRun) {
    const pResults = allFullResults.filter(r => r.profile === profile.label);
    if (pResults.length === 0) continue;
    const n = pResults.length;
    const pTotalCharged = pResults.reduce((s,r)=>s+r.totalChargedPlays,0);
    const pTotalPlays = pResults.reduce((s,r)=>s+r.totalCardsPlayed,0);
    const pCorrCharged = pResults.reduce((s,r)=>s+r.chargeSuccessRate*r.totalChargedPlays,0);
    const chargeRate_ = pTotalPlays > 0 ? (pTotalCharged/pTotalPlays*100).toFixed(0) : '0';
    const chargeAcc_ = pTotalCharged > 0 ? (pCorrCharged/pTotalCharged*100).toFixed(0) : '0';
    const avgDmgCharge = (pResults.reduce((s,r)=>s+r.damageFromCharges,0)/n).toFixed(0);
    const avgDmgQuick = (pResults.reduce((s,r)=>s+r.damageFromQuickPlays,0)/n).toFixed(0);
    const totalDmg = pResults.reduce((s,r)=>s+r.damageFromCharges+r.damageFromQuickPlays,0);
    const chargeDmgPct = totalDmg > 0 ? (pResults.reduce((s,r)=>s+r.damageFromCharges,0)/totalDmg*100).toFixed(0) : '0';
    readmeLines.push(`| ${profile.label} | ${chargeRate_}% | ${chargeAcc_}% | ${avgDmgCharge} | ${avgDmgQuick} | ${chargeDmgPct}% |`);
  }

  // Near-Miss and Tension Metrics
  readmeLines.push('', '## Tension Metrics', '', '| Profile | Near-Miss% | Comeback% | Avg Min HP | Avg Turns/Enc |', '|---------|------------|-----------|------------|---------------|');
  for (const profile of profilesToRun) {
    const pResults = allFullResults.filter(r => r.profile === profile.label);
    if (pResults.length === 0) continue;
    const nearMissPct = (pResults.filter(r=>r.isNearMiss).length/pResults.length*100).toFixed(0);
    const comebackPct = (pResults.filter(r=>r.isComeback).length/pResults.length*100).toFixed(0);
    const avgMinHp = (pResults.reduce((s,r)=>s+r.minHpSeen,0)/pResults.length).toFixed(0);
    const avgTurnsPerEnc = (pResults.reduce((s,r)=>s+r.avgTurnsPerEncounter,0)/pResults.length).toFixed(1);
    readmeLines.push(`| ${profile.label} | ${nearMissPct}% | ${comebackPct}% | ${avgMinHp} | ${avgTurnsPerEnc} |`);
  }

  // HP Curve section (first profile or all profiles summary)
  if (profilesToRun.length > 0 && Object.keys(profileHpCurves).length > 0) {
    readmeLines.push('', '## HP Curve by Floor', '');
    for (const profile of profilesToRun) {
      const curve = profileHpCurves[profile.label];
      if (!curve || curve.length === 0) continue;
      readmeLines.push(`### ${profile.label}`, '', '| Floor | Avg HP | Min HP | Max HP | Death% |', '|-------|--------|--------|--------|--------|');
      for (const pt of curve) {
        const totalSamples = pt.sampleCount || 1;
        const deathPct = (pt.deathCount / totalSamples * 100).toFixed(0);
        readmeLines.push(`| ${pt.floor} | ${pt.avgHp.toFixed(0)} | ${pt.minHp} | ${pt.maxHp} | ${deathPct}% |`);
      }
      readmeLines.push('');
    }
  }

  // Room distribution
  readmeLines.push('## Room Type Distribution (avg per run)', '', '| Room Type | Avg Visits | % of Total |', '|-----------|-----------|-----------|');
  const roomTotals: Record<string, number> = {};
  for (const r of allFullResults) {
    for (const [type, count] of Object.entries(r.roomsVisited)) {
      roomTotals[type] = (roomTotals[type] ?? 0) + count;
    }
  }
  const totalRoomsAll = Object.values(roomTotals).reduce((s, n) => s + n, 0);
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
// Phase 4: Cross-Run Delta — compare to previous run before updating symlink
// ──────────────────────────────────────────────────────────────────────────────

const runsBase  = path.resolve('data/playtests/runs');
const latestPath = path.join(runsBase, 'latest');

if (simMode === 'full' && profilesToRun.length > 0) {
  try {
    const prevCombinedPath = path.join(runsBase, 'latest', 'combined.json');
    if (fs.existsSync(prevCombinedPath)) {
      const prevCombined = JSON.parse(fs.readFileSync(prevCombinedPath, 'utf-8'));
      // Only compare if same mode
      if (prevCombined.mode === 'full' && Array.isArray(prevCombined.results)) {
        const prevResults: Array<FullRunResult & { profile: string }> = prevCombined.results;

        const deltaLines: string[] = [
          `# Delta vs Previous Run`,
          '',
          `**Previous:** ${prevCombined.timestamp ?? 'unknown'}`,
          `**Current:**  ${new Date().toISOString()}`,
          '',
          '| Profile | Old Win% | New Win% | Delta | Charge% | Mastery | Near-Miss% |',
          '|---------|----------|----------|-------|---------|---------|------------|',
        ];

        let hasDelta = false;
        for (const profile of profilesToRun) {
          const prevProf = prevResults.filter(r => r.profile === profile.label);
          const curProf  = allFullResults.filter(r => r.profile === profile.label);
          if (prevProf.length === 0 || curProf.length === 0) {
            if (curProf.length > 0) deltaLines.push(`| ${profile.label} | — | ${Math.round(curProf.filter(r=>r.survived).length/curProf.length*100)}% | NEW | — | — | — |`);
            continue;
          }
          const oldWin = prevProf.filter(r=>r.survived).length / prevProf.length;
          const newWin = curProf.filter(r=>r.survived).length / curProf.length;
          const delta  = newWin - oldWin;
          const deltaStr = `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;
          const curCharged = curProf.reduce((s,r)=>s+r.totalChargedPlays,0);
          const curTotal = curProf.reduce((s,r)=>s+r.totalCardsPlayed,0);
          const chargeRatePct = curTotal > 0 ? Math.round(curCharged/curTotal*100) : 0;
          const avgMastery = (curProf.reduce((s,r)=>s+r.avgMasteryLevel,0)/curProf.length).toFixed(2);
          const nearMissPct = Math.round(curProf.filter(r=>r.isNearMiss).length/curProf.length*100);
          deltaLines.push(`| ${profile.label} | ${(oldWin*100).toFixed(1)}% | ${(newWin*100).toFixed(1)}% | ${deltaStr} | ${chargeRatePct}% | ${avgMastery} | ${nearMissPct}% |`);
          hasDelta = true;
        }

        if (hasDelta) {
          const deltaPath = path.join(outputDir, 'delta.md');
          fs.writeFileSync(deltaPath, deltaLines.join('\n') + '\n');
          console.log('\n  Delta vs previous run:');
          console.log(deltaLines.slice(6).join('\n'));
        }
      }
    }
  } catch {
    // Non-fatal — delta comparison is best-effort
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Update latest symlink
// ──────────────────────────────────────────────────────────────────────────────

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
