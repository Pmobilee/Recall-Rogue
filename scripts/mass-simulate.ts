#!/usr/bin/env npx tsx
// === Mass Combat Simulator ===
// Runs thousands of headless combat simulations to analyze relic impact,
// synergies, build performance, skill fairness, and progression curves.
// Zero LLM cost — pure deterministic simulation.
//
// Usage:
//   npx tsx scripts/mass-simulate.ts --mode solo --seeds 100
//   npx tsx scripts/mass-simulate.ts --mode sweep --seeds 50
//   npx tsx scripts/mass-simulate.ts --mode custom --relics whetstone,flame_brand --profiles average,expert --seeds 200

import { writeFileSync } from 'node:fs';
import { HeadlessCombatSimulator } from '../tests/playtest/core/headless-combat';
import type { PlayerProfile, PlaythroughSummary } from '../tests/playtest/core/types';

// ─── Profile Presets ─────────────────────────────────────────────────────────

const PROFILES: Record<string, PlayerProfile> = {
  beginner: {
    id: 'beginner', name: 'Beginner', description: 'New player',
    learningAbility: { baseAccuracy: 0.5, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.5, maxAccuracy: 0.5 },
    readingSpeed: { category: 'slow', speedBonusProbability: 0.05 },
    strategicSkill: { level: 'random', prioritizeShieldsBeforeAttacks: false, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.3 },
    engagement: { skipProbability: 0.05, aggression: 'passive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  average: {
    id: 'average', name: 'Average', description: 'Typical player',
    learningAbility: { baseAccuracy: 0.7, accuracyCurve: 'improving', accuracyPerFloorDelta: 0.01, minAccuracy: 0.6, maxAccuracy: 0.8 },
    readingSpeed: { category: 'normal', speedBonusProbability: 0.15 },
    strategicSkill: { level: 'basic', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.4 },
    engagement: { skipProbability: 0.05, aggression: 'balanced' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  expert: {
    id: 'expert', name: 'Expert', description: 'Highly skilled player',
    learningAbility: { baseAccuracy: 0.9, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.85, maxAccuracy: 0.95 },
    readingSpeed: { category: 'fast', speedBonusProbability: 0.6 },
    strategicSkill: { level: 'optimal', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: true, saveHealsForLowHP: true, hpThresholdForHeal: 0.35 },
    engagement: { skipProbability: 0.02, aggression: 'aggressive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  struggling: {
    id: 'struggling', name: 'Struggling', description: 'Low accuracy declining player',
    learningAbility: { baseAccuracy: 0.4, accuracyCurve: 'declining', accuracyPerFloorDelta: -0.02, minAccuracy: 0.2, maxAccuracy: 0.5 },
    readingSpeed: { category: 'slow', speedBonusProbability: 0.02 },
    strategicSkill: { level: 'random', prioritizeShieldsBeforeAttacks: false, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.2 },
    engagement: { skipProbability: 0.1, aggression: 'passive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  'speed-runner': {
    id: 'speed-runner', name: 'Speed Runner', description: 'Elite speed player',
    learningAbility: { baseAccuracy: 0.9, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.85, maxAccuracy: 0.95 },
    readingSpeed: { category: 'fast', speedBonusProbability: 0.9 },
    strategicSkill: { level: 'optimal', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: true, saveHealsForLowHP: true, hpThresholdForHeal: 0.3 },
    engagement: { skipProbability: 0.0, aggression: 'aggressive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
};

// ─── Relic Lists ─────────────────────────────────────────────────────────────

const STARTER_RELICS = [
  'whetstone', 'flame_brand', 'barbed_edge', 'war_drum', 'sharp_eye',
  'iron_buckler', 'steel_skin', 'thorned_vest', 'stone_wall',
  'herbal_pouch', 'vitality_ring', 'medic_kit', 'last_breath',
  'swift_boots', 'combo_ring', 'momentum_gem', 'speed_charm', 'cartographers_lens',
  'scholars_hat', 'memory_palace', 'curiosity_gem', 'brain_booster',
  'gold_magnet', 'lucky_coin', 'scavengers_pouch',
];

const UNLOCKABLE_RELICS = [
  'berserker_band', 'chain_lightning_rod', 'venom_fang', 'crescendo_blade', 'executioners_axe',
  'fortress_wall', 'mirror_shield', 'iron_resolve', 'phase_cloak',
  'blood_pact', 'phoenix_feather', 'renewal_spring',
  'quicksilver', 'time_dilation', 'afterimage',
  'echo_lens', 'double_vision', 'polyglot_pendant', 'eidetic_memory', 'speed_reader',
  'domain_mastery',
  'prospectors_pick', 'miser_ring', 'glass_cannon', 'blood_price',
];

const ALL_RELICS = [...STARTER_RELICS, ...UNLOCKABLE_RELICS];

/** Combat-relevant relics (exclude UI-only and economy-only relics). */
const COMBAT_RELICS = ALL_RELICS.filter(r => ![
  'cartographers_lens', 'brain_booster', 'gold_magnet', 'lucky_coin',
  'scavengers_pouch', 'prospectors_pick', 'miser_ring', 'time_dilation',
  'speed_reader', 'polyglot_pendant', 'eidetic_memory', 'domain_mastery',
].includes(r));

// ─── Config Types ────────────────────────────────────────────────────────────

interface SimConfig {
  label: string;
  profileId: string;
  relics: string[];
  ascensionLevel: number;
  group: string;
}

// ─── Aggregated Metrics ──────────────────────────────────────────────────────

interface AggregatedMetrics {
  runs: number;
  survivalRate: number;
  avgFinalFloor: number;
  avgAccuracy: number;
  avgMaxCombo: number;
  avgDPS: number;
  avgDamageTakenPerEnc: number;
  avgTurnsPerEncounter: number;
}

// ─── Accumulator ─────────────────────────────────────────────────────────────

class RunAccumulator {
  private data: Map<string, {
    config: SimConfig;
    count: number;
    victories: number;
    totalFinalFloor: number;
    totalAccuracy: number;
    totalMaxCombo: number;
    totalDPS: number;
    totalDamageTakenPerEnc: number;
    totalTurnsPerEnc: number;
  }> = new Map();

  /** Add a completed run's summary to the accumulator (streaming — no storage). */
  addRun(config: SimConfig, summary: PlaythroughSummary): void {
    const key = config.label;
    let entry = this.data.get(key);
    if (!entry) {
      entry = {
        config,
        count: 0,
        victories: 0,
        totalFinalFloor: 0,
        totalAccuracy: 0,
        totalMaxCombo: 0,
        totalDPS: 0,
        totalDamageTakenPerEnc: 0,
        totalTurnsPerEnc: 0,
      };
      this.data.set(key, entry);
    }

    entry.count++;
    if (summary.result === 'victory') entry.victories++;
    entry.totalFinalFloor += summary.finalFloor;
    entry.totalAccuracy += summary.overallAccuracy;
    entry.totalMaxCombo += summary.maxCombo;

    // Compute per-run encounter aggregates
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    let totalTurns = 0;
    let totalEncs = 0;
    for (const enc of summary.encounterResults) {
      totalDamageDealt += enc.damageDealt;
      totalDamageTaken += enc.damageTaken;
      totalTurns += enc.turnsToResolve;
      totalEncs++;
    }
    entry.totalDPS += totalTurns > 0 ? totalDamageDealt / totalTurns : 0;
    entry.totalDamageTakenPerEnc += totalEncs > 0 ? totalDamageTaken / totalEncs : 0;
    entry.totalTurnsPerEnc += totalEncs > 0 ? totalTurns / totalEncs : 0;
  }

  /** Get all config labels. */
  getLabels(): string[] {
    return [...this.data.keys()];
  }

  /** Get the config for a given label. */
  getConfig(label: string): SimConfig | undefined {
    return this.data.get(label)?.config;
  }

  /** Compute aggregated metrics for a given label. */
  getMetrics(label: string): AggregatedMetrics | null {
    const entry = this.data.get(label);
    if (!entry || entry.count === 0) return null;

    const n = entry.count;
    return {
      runs: n,
      survivalRate: entry.victories / n,
      avgFinalFloor: entry.totalFinalFloor / n,
      avgAccuracy: entry.totalAccuracy / n,
      avgMaxCombo: entry.totalMaxCombo / n,
      avgDPS: entry.totalDPS / n,
      avgDamageTakenPerEnc: entry.totalDamageTakenPerEnc / n,
      avgTurnsPerEncounter: entry.totalTurnsPerEnc / n,
    };
  }

  /** Get all groups. */
  getGroups(): Map<string, SimConfig[]> {
    const groups = new Map<string, SimConfig[]>();
    for (const [, entry] of this.data) {
      const g = entry.config.group;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(entry.config);
    }
    return groups;
  }
}

// ─── Config Generators ───────────────────────────────────────────────────────

function generateSoloConfigs(ascensionLevels: number[]): SimConfig[] {
  const configs: SimConfig[] = [];

  // Control baselines: each profile with no relics
  for (const profileId of Object.keys(PROFILES)) {
    for (const asc of ascensionLevels) {
      configs.push({
        label: `control-${profileId}-asc${asc}`,
        profileId,
        relics: [],
        ascensionLevel: asc,
        group: 'control',
      });
    }
  }

  // Solo relic tests: each combat relic with average profile
  for (const relic of COMBAT_RELICS) {
    for (const asc of ascensionLevels) {
      configs.push({
        label: `solo-${relic}-asc${asc}`,
        profileId: 'average',
        relics: [relic],
        ascensionLevel: asc,
        group: 'solo',
      });
    }
  }

  return configs;
}

function generateComboConfigs(ascensionLevels: number[]): SimConfig[] {
  const configs: SimConfig[] = [];

  // Solo controls for comparison
  for (const relic of COMBAT_RELICS) {
    for (const asc of ascensionLevels) {
      configs.push({
        label: `solo-${relic}-asc${asc}`,
        profileId: 'average',
        relics: [relic],
        ascensionLevel: asc,
        group: 'solo',
      });
    }
  }

  // Control baseline
  for (const asc of ascensionLevels) {
    configs.push({
      label: `control-average-asc${asc}`,
      profileId: 'average',
      relics: [],
      ascensionLevel: asc,
      group: 'control',
    });
  }

  // All C(N,2) pairs
  for (let i = 0; i < COMBAT_RELICS.length; i++) {
    for (let j = i + 1; j < COMBAT_RELICS.length; j++) {
      for (const asc of ascensionLevels) {
        configs.push({
          label: `combo-${COMBAT_RELICS[i]}+${COMBAT_RELICS[j]}-asc${asc}`,
          profileId: 'average',
          relics: [COMBAT_RELICS[i], COMBAT_RELICS[j]],
          ascensionLevel: asc,
          group: 'combo',
        });
      }
    }
  }

  return configs;
}

function generateBuildConfigs(ascensionLevels: number[]): SimConfig[] {
  const builds: { name: string; profileId: string; relics: string[] }[] = [
    {
      name: 'Full Aggro',
      profileId: 'expert',
      relics: ['whetstone', 'flame_brand', 'barbed_edge', 'war_drum', 'glass_cannon', 'berserker_band', 'chain_lightning_rod', 'crescendo_blade'],
    },
    {
      name: 'Iron Fortress',
      profileId: 'expert',
      relics: ['iron_buckler', 'steel_skin', 'stone_wall', 'thorned_vest', 'fortress_wall', 'mirror_shield', 'iron_resolve', 'phase_cloak'],
    },
    {
      name: 'Sustain God',
      profileId: 'expert',
      relics: ['herbal_pouch', 'vitality_ring', 'medic_kit', 'last_breath', 'blood_pact', 'phoenix_feather', 'renewal_spring', 'scholars_hat'],
    },
    {
      name: 'Speed Demon',
      profileId: 'speed-runner',
      relics: ['swift_boots', 'combo_ring', 'momentum_gem', 'afterimage', 'quicksilver', 'double_vision', 'sharp_eye', 'speed_charm'],
    },
    {
      name: 'Cursed Gambler',
      profileId: 'expert',
      relics: ['glass_cannon', 'blood_price', 'berserker_band', 'phase_cloak', 'blood_pact', 'last_breath'],
    },
    {
      name: 'Balanced Best',
      profileId: 'expert',
      relics: ['whetstone', 'iron_buckler', 'herbal_pouch', 'swift_boots', 'scholars_hat', 'combo_ring', 'vitality_ring', 'last_breath'],
    },
  ];

  const configs: SimConfig[] = [];

  // No-relic controls for matching profiles
  const profilesSeen = new Set<string>();
  for (const build of builds) {
    profilesSeen.add(build.profileId);
  }
  for (const profileId of profilesSeen) {
    for (const asc of ascensionLevels) {
      configs.push({
        label: `control-${profileId}-asc${asc}`,
        profileId,
        relics: [],
        ascensionLevel: asc,
        group: 'control',
      });
    }
  }

  for (const build of builds) {
    for (const asc of ascensionLevels) {
      const slug = build.name.toLowerCase().replace(/\s+/g, '_');
      configs.push({
        label: `build-${slug}-asc${asc}`,
        profileId: build.profileId,
        relics: build.relics,
        ascensionLevel: asc,
        group: 'build',
      });
    }
  }

  return configs;
}

function generateFairnessConfigs(ascensionLevels: number[]): SimConfig[] {
  const loadouts: { name: string; relics: string[] }[] = [
    { name: 'Offense', relics: ['whetstone', 'flame_brand', 'war_drum'] },
    { name: 'Defense', relics: ['iron_buckler', 'steel_skin', 'stone_wall', 'fortress_wall'] },
    { name: 'Knowledge', relics: ['scholars_hat', 'memory_palace', 'combo_ring', 'momentum_gem'] },
    { name: 'Cursed', relics: ['glass_cannon', 'blood_price'] },
  ];

  const fairnessProfiles = ['beginner', 'average', 'expert', 'struggling'];
  const configs: SimConfig[] = [];

  for (const profileId of fairnessProfiles) {
    for (const asc of ascensionLevels) {
      configs.push({
        label: `control-${profileId}-asc${asc}`,
        profileId,
        relics: [],
        ascensionLevel: asc,
        group: 'control',
      });
    }
  }

  for (const loadout of loadouts) {
    const slug = loadout.name.toLowerCase();
    for (const profileId of fairnessProfiles) {
      for (const asc of ascensionLevels) {
        configs.push({
          label: `fairness-${slug}-${profileId}-asc${asc}`,
          profileId,
          relics: loadout.relics,
          ascensionLevel: asc,
          group: 'fairness',
        });
      }
    }
  }

  return configs;
}

function generateProgressionConfigs(ascensionLevels: number[]): SimConfig[] {
  const stages: { name: string; relics: string[] }[] = [
    { name: 'New Player', relics: ['whetstone', 'iron_buckler', 'herbal_pouch'] },
    { name: 'Mid Unlock', relics: ['whetstone', 'iron_buckler', 'swift_boots', 'fortress_wall', 'blood_pact', 'afterimage'] },
    { name: 'Full Collection Top 8', relics: ['whetstone', 'flame_brand', 'war_drum', 'combo_ring', 'blood_pact', 'phase_cloak', 'curiosity_gem', 'momentum_gem'] },
  ];

  const configs: SimConfig[] = [];

  for (const asc of ascensionLevels) {
    configs.push({
      label: `control-average-asc${asc}`,
      profileId: 'average',
      relics: [],
      ascensionLevel: asc,
      group: 'control',
    });
  }

  for (const stage of stages) {
    const slug = stage.name.toLowerCase().replace(/\s+/g, '_');
    for (const asc of ascensionLevels) {
      configs.push({
        label: `progression-${slug}-asc${asc}`,
        profileId: 'average',
        relics: stage.relics,
        ascensionLevel: asc,
        group: 'progression',
      });
    }
  }

  return configs;
}

function generateCustomConfigs(
  relicList: string[],
  profileIds: string[],
  ascensionLevels: number[],
): SimConfig[] {
  const configs: SimConfig[] = [];

  for (const profileId of profileIds) {
    for (const asc of ascensionLevels) {
      // Control
      configs.push({
        label: `control-${profileId}-asc${asc}`,
        profileId,
        relics: [],
        ascensionLevel: asc,
        group: 'control',
      });
      // Custom loadout
      configs.push({
        label: `custom-${profileId}-asc${asc}`,
        profileId,
        relics: relicList,
        ascensionLevel: asc,
        group: 'custom',
      });
    }
  }

  return configs;
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function deduplicateConfigs(configs: SimConfig[]): SimConfig[] {
  const seen = new Map<string, SimConfig>();
  for (const c of configs) {
    if (!seen.has(c.label)) {
      seen.set(c.label, c);
    }
  }
  return [...seen.values()];
}

// ─── CLI Arg Parsing ─────────────────────────────────────────────────────────

interface CliArgs {
  mode: string;
  seeds: number;
  ascension: number[];
  floors: number;
  relics: string[];
  profiles: string[];
  output: string | null;
  csv: string | null;
  quiet: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    mode: '',
    seeds: 50,
    ascension: [0],
    floors: 24,
    relics: [],
    profiles: ['average'],
    output: null,
    csv: null,
    quiet: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--mode':
        args.mode = next ?? '';
        i++;
        break;
      case '--seeds':
        args.seeds = parseInt(next ?? '50', 10);
        i++;
        break;
      case '--ascension':
        args.ascension = (next ?? '0').split(',').map(s => parseInt(s.trim(), 10));
        i++;
        break;
      case '--floors':
        args.floors = parseInt(next ?? '24', 10);
        i++;
        break;
      case '--relics':
        args.relics = (next ?? '').split(',').map(s => s.trim()).filter(Boolean);
        i++;
        break;
      case '--profiles':
        args.profiles = (next ?? 'average').split(',').map(s => s.trim()).filter(Boolean);
        i++;
        break;
      case '--output':
        args.output = next ?? null;
        i++;
        break;
      case '--csv':
        args.csv = next ?? null;
        i++;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          process.stderr.write(`Unknown option: ${arg}\n`);
          process.exit(1);
        }
    }
  }

  if (!args.mode) {
    process.stderr.write('Error: --mode is required\n');
    printUsage();
    process.exit(1);
  }

  const validModes = ['solo', 'combos', 'builds', 'fairness', 'progression', 'sweep', 'custom'];
  if (!validModes.includes(args.mode)) {
    process.stderr.write(`Error: invalid mode "${args.mode}". Valid modes: ${validModes.join(', ')}\n`);
    process.exit(1);
  }

  return args;
}

function printUsage(): void {
  process.stderr.write(`
Mass Combat Simulator — Recall Rogue

Usage: npx tsx scripts/mass-simulate.ts --mode <mode> [options]

Modes:
  solo         Test each combat relic individually vs no-relic control
  combos       Test all C(N,2) relic pairs for synergy analysis
  builds       Test 6 predefined archetype builds
  fairness     Test loadouts across beginner/average/expert/struggling
  progression  Test progression stages (new player -> full collection)
  sweep        Run all modes combined
  custom       Custom relics and profiles

Options:
  --seeds N              Seeds per config (default: 50)
  --ascension 0,5,10     Comma-separated ascension levels (default: 0)
  --floors N             Max floors per run (default: 24)
  --relics a,b,c         Relic list for custom mode
  --profiles a,b,c       Profile list for custom mode (default: average)
  --output path          Write JSON output to file
  --csv path             Write CSV output to file
  --quiet                Suppress progress output to stderr
  --help, -h             Show this help message

Examples:
  npx tsx scripts/mass-simulate.ts --mode solo --seeds 100
  npx tsx scripts/mass-simulate.ts --mode combos --seeds 50
  npx tsx scripts/mass-simulate.ts --mode sweep --seeds 50
  npx tsx scripts/mass-simulate.ts --mode custom --relics whetstone,flame_brand --profiles average,expert --seeds 200
`);
}

// ─── Impact Calculation ──────────────────────────────────────────────────────

function impactPct(withRelic: number, control: number): number {
  if (control === 0) return withRelic > 0 ? Math.min(9999.9, withRelic * 100) : 0;
  return ((withRelic - control) / Math.abs(control)) * 100;
}

function assignTier(overallScore: number): string {
  if (overallScore > 50) return 'S';
  if (overallScore > 25) return 'A';
  if (overallScore > 10) return 'B';
  if (overallScore > 0) return 'C';
  if (overallScore > -10) return 'D';
  return 'F';
}

// ─── Comparative Analysis ────────────────────────────────────────────────────

interface SoloRelicResult {
  relicId: string;
  profile: string;
  ascension: number;
  metrics: AggregatedMetrics;
  impact: { survival: number; dps: number; defense: number; overall: number };
  tier: string;
}

interface ComboResult {
  relics: string[];
  profile: string;
  ascension: number;
  metrics: AggregatedMetrics;
  synergyFactor: number;
  verdict: string;
}

interface BuildResult {
  build: string;
  profile: string;
  ascension: number;
  relics: string[];
  metrics: AggregatedMetrics;
}

interface FairnessResult {
  loadout: string;
  profiles: Record<string, AggregatedMetrics>;
  fairnessRatio: number;
  flag: string | null;
}

interface ProgressionResult {
  stage: string;
  ascension: number;
  relics: string[];
  metrics: AggregatedMetrics;
}

interface AnalysisOutput {
  meta: {
    generatedAt: string;
    totalRuns: number;
    seedsPerConfig: number;
    floors: number;
    elapsedMs: number;
    mode: string;
  };
  controlBaselines: Record<string, AggregatedMetrics>;
  soloRelicImpact: SoloRelicResult[];
  comboAnalysis: ComboResult[];
  buildPerformance: BuildResult[];
  skillFairness: FairnessResult[];
  progressionCurve: ProgressionResult[];
  flags: {
    overpowered: string[];
    underpowered: string[];
    brokenSynergies: string[];
    immortality: string[];
  };
}

function runAnalysis(accumulator: RunAccumulator, mode: string): Omit<AnalysisOutput, 'meta'> {
  // Collect control baselines
  const controlBaselines: Record<string, AggregatedMetrics> = {};
  for (const label of accumulator.getLabels()) {
    const config = accumulator.getConfig(label);
    if (config && config.group === 'control') {
      const metrics = accumulator.getMetrics(label);
      if (metrics) {
        controlBaselines[label] = metrics;
      }
    }
  }

  // Solo relic impact
  const soloRelicImpact: SoloRelicResult[] = [];
  for (const label of accumulator.getLabels()) {
    const config = accumulator.getConfig(label);
    if (!config || config.group !== 'solo') continue;
    const metrics = accumulator.getMetrics(label);
    if (!metrics) continue;

    const controlKey = `control-${config.profileId}-asc${config.ascensionLevel}`;
    const control = controlBaselines[controlKey];
    if (!control) continue;

    const survImpact = impactPct(metrics.survivalRate, control.survivalRate);
    const dpsImpact = impactPct(metrics.avgDPS, control.avgDPS);
    // Defense impact: lower damage taken is better, so invert
    const defImpact = impactPct(control.avgDamageTakenPerEnc, metrics.avgDamageTakenPerEnc);
    const overall = survImpact * 0.4 + dpsImpact * 0.3 + defImpact * 0.3;

    const relicId = config.relics[0] ?? 'unknown';
    soloRelicImpact.push({
      relicId,
      profile: config.profileId,
      ascension: config.ascensionLevel,
      metrics,
      impact: { survival: round2(survImpact), dps: round2(dpsImpact), defense: round2(defImpact), overall: round2(overall) },
      tier: assignTier(overall),
    });
  }

  // Sort by overall impact descending
  soloRelicImpact.sort((a, b) => b.impact.overall - a.impact.overall);

  // Combo analysis
  const comboAnalysis: ComboResult[] = [];
  for (const label of accumulator.getLabels()) {
    const config = accumulator.getConfig(label);
    if (!config || config.group !== 'combo') continue;
    const metrics = accumulator.getMetrics(label);
    if (!metrics) continue;

    const controlKey = `control-${config.profileId}-asc${config.ascensionLevel}`;
    const control = controlBaselines[controlKey];
    if (!control) continue;

    // Find solo results for each relic
    const soloKeys = config.relics.map(r => `solo-${r}-asc${config.ascensionLevel}`);
    const soloMetrics = soloKeys.map(k => accumulator.getMetrics(k));

    // Compute solo overall scores for synergy comparison
    let soloOverallSum = 0;
    let soloCount = 0;
    for (const sm of soloMetrics) {
      if (!sm) continue;
      const survI = impactPct(sm.survivalRate, control.survivalRate);
      const dpsI = impactPct(sm.avgDPS, control.avgDPS);
      const defI = impactPct(control.avgDamageTakenPerEnc, sm.avgDamageTakenPerEnc);
      soloOverallSum += survI * 0.4 + dpsI * 0.3 + defI * 0.3;
      soloCount++;
    }

    const comboSurvI = impactPct(metrics.survivalRate, control.survivalRate);
    const comboDpsI = impactPct(metrics.avgDPS, control.avgDPS);
    const comboDefI = impactPct(control.avgDamageTakenPerEnc, metrics.avgDamageTakenPerEnc);
    const comboOverall = comboSurvI * 0.4 + comboDpsI * 0.3 + comboDefI * 0.3;

    const synergyFactor = soloOverallSum !== 0 && soloCount === config.relics.length
      ? comboOverall / soloOverallSum
      : 1.0;

    let verdict: string;
    if (synergyFactor > 2.0) verdict = 'broken_synergy';
    else if (synergyFactor > 1.5) verdict = 'strong_synergy';
    else if (synergyFactor > 0.8) verdict = 'additive';
    else verdict = 'anti_synergy';

    comboAnalysis.push({
      relics: config.relics,
      profile: config.profileId,
      ascension: config.ascensionLevel,
      metrics,
      synergyFactor: round2(synergyFactor),
      verdict,
    });
  }

  // Sort combos by synergy factor descending
  comboAnalysis.sort((a, b) => b.synergyFactor - a.synergyFactor);

  // Build performance
  const buildPerformance: BuildResult[] = [];
  for (const label of accumulator.getLabels()) {
    const config = accumulator.getConfig(label);
    if (!config || config.group !== 'build') continue;
    const metrics = accumulator.getMetrics(label);
    if (!metrics) continue;

    buildPerformance.push({
      build: config.label,
      profile: config.profileId,
      ascension: config.ascensionLevel,
      relics: config.relics,
      metrics,
    });
  }

  // Skill fairness
  const skillFairness: FairnessResult[] = [];
  const fairnessLoadouts = new Map<string, Map<string, AggregatedMetrics>>();
  for (const label of accumulator.getLabels()) {
    const config = accumulator.getConfig(label);
    if (!config || config.group !== 'fairness') continue;
    const metrics = accumulator.getMetrics(label);
    if (!metrics) continue;

    // Extract loadout name from label: fairness-<loadout>-<profile>-asc<N>
    const parts = label.split('-');
    // fairness-<loadout>-<profile>-asc<N>
    const loadoutName = parts[1];
    const profileId = parts.slice(2, -1).join('-'); // handle multi-word profiles like speed-runner

    if (!fairnessLoadouts.has(loadoutName)) {
      fairnessLoadouts.set(loadoutName, new Map());
    }
    fairnessLoadouts.get(loadoutName)!.set(profileId, metrics);
  }

  for (const [loadout, profileMetrics] of fairnessLoadouts) {
    const profiles: Record<string, AggregatedMetrics> = {};
    for (const [pid, m] of profileMetrics) {
      profiles[pid] = m;
    }

    // Fairness ratio: expert benefit / beginner benefit
    const expertM = profiles['expert'];
    const beginnerM = profiles['beginner'];
    let fairnessRatio = 1.0;
    let flag: string | null = null;

    if (expertM && beginnerM) {
      // Compare survival rates as the main benefit metric
      const expertBenefit = expertM.survivalRate;
      const beginnerBenefit = beginnerM.survivalRate;
      fairnessRatio = beginnerBenefit > 0 ? expertBenefit / beginnerBenefit : 9999;
      if (fairnessRatio > 3.0) flag = 'expert_favored';
      else if (fairnessRatio < 0.33) flag = 'beginner_favored';
    }

    skillFairness.push({
      loadout,
      profiles,
      fairnessRatio: round2(fairnessRatio),
      flag,
    });
  }

  // Progression curve
  const progressionCurve: ProgressionResult[] = [];
  for (const label of accumulator.getLabels()) {
    const config = accumulator.getConfig(label);
    if (!config || config.group !== 'progression') continue;
    const metrics = accumulator.getMetrics(label);
    if (!metrics) continue;

    progressionCurve.push({
      stage: config.label,
      ascension: config.ascensionLevel,
      relics: config.relics,
      metrics,
    });
  }

  // Flags
  const overpowered: string[] = [];
  const underpowered: string[] = [];
  const brokenSynergies: string[] = [];
  const immortality: string[] = [];

  for (const solo of soloRelicImpact) {
    if (solo.tier === 'S') overpowered.push(solo.relicId);
    if (solo.tier === 'F') underpowered.push(solo.relicId);
    if (solo.metrics.survivalRate >= 0.99) immortality.push(solo.relicId);
  }

  for (const combo of comboAnalysis) {
    if (combo.verdict === 'broken_synergy') {
      brokenSynergies.push(combo.relics.join('+'));
    }
    if (combo.metrics.survivalRate >= 0.99) {
      immortality.push(combo.relics.join('+'));
    }
  }

  return {
    controlBaselines,
    soloRelicImpact,
    comboAnalysis,
    buildPerformance,
    skillFairness,
    progressionCurve,
    flags: {
      overpowered: [...new Set(overpowered)],
      underpowered: [...new Set(underpowered)],
      brokenSynergies: [...new Set(brokenSynergies)],
      immortality: [...new Set(immortality)],
    },
  };
}

// ─── Output Formatters ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function formatTable(rows: Record<string, string | number>[], columns: string[]): string {
  if (rows.length === 0) return '  (no data)\n';

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
    for (const row of rows) {
      const val = String(row[col] ?? '');
      widths[col] = Math.max(widths[col], val.length);
    }
  }

  // Header
  let out = '  ' + columns.map(c => c.padEnd(widths[c])).join('  ') + '\n';
  out += '  ' + columns.map(c => '-'.repeat(widths[c])).join('  ') + '\n';

  // Rows
  for (const row of rows) {
    out += '  ' + columns.map(c => String(row[c] ?? '').padEnd(widths[c])).join('  ') + '\n';
  }

  return out;
}

function writeCsv(
  accumulator: RunAccumulator,
  filePath: string,
): void {
  const headers = [
    'label', 'group', 'profile', 'ascension', 'relics',
    'survivalRate', 'avgFinalFloor', 'avgDPS', 'avgDamageTakenPerEnc',
    'avgAccuracy', 'avgMaxCombo', 'avgTurnsPerEnc',
  ];

  const lines: string[] = [headers.join(',')];

  for (const label of accumulator.getLabels()) {
    const config = accumulator.getConfig(label);
    const metrics = accumulator.getMetrics(label);
    if (!config || !metrics) continue;

    const row = [
      `"${config.label}"`,
      `"${config.group}"`,
      `"${config.profileId}"`,
      String(config.ascensionLevel),
      `"${config.relics.join(';')}"`,
      round4(metrics.survivalRate),
      round2(metrics.avgFinalFloor),
      round2(metrics.avgDPS),
      round2(metrics.avgDamageTakenPerEnc),
      round4(metrics.avgAccuracy),
      round2(metrics.avgMaxCombo),
      round2(metrics.avgTurnsPerEncounter),
    ];

    lines.push(row.join(','));
  }

  writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

function printSummaryTable(
  analysis: Omit<AnalysisOutput, 'meta'>,
  meta: AnalysisOutput['meta'],
): void {
  process.stderr.write('\n');
  process.stderr.write('='.repeat(70) + '\n');
  process.stderr.write('  MASS COMBAT SIMULATION RESULTS\n');
  process.stderr.write('='.repeat(70) + '\n');
  process.stderr.write(`  Mode:          ${meta.mode}\n`);
  process.stderr.write(`  Seeds/config:  ${meta.seedsPerConfig}\n`);
  process.stderr.write(`  Max floors:    ${meta.floors}\n`);
  process.stderr.write(`  Total runs:    ${meta.totalRuns.toLocaleString()}\n`);
  process.stderr.write(`  Elapsed:       ${(meta.elapsedMs / 1000).toFixed(1)}s\n`);
  process.stderr.write(`  Throughput:    ${Math.round(meta.totalRuns / (meta.elapsedMs / 1000))} runs/s\n`);
  process.stderr.write('-'.repeat(70) + '\n');

  // Control baselines
  if (Object.keys(analysis.controlBaselines).length > 0) {
    process.stderr.write('\n  CONTROL BASELINES:\n');
    const rows = Object.entries(analysis.controlBaselines).map(([label, m]) => ({
      label,
      survival: `${(m.survivalRate * 100).toFixed(1)}%`,
      avgFloor: round2(m.avgFinalFloor),
      dps: round2(m.avgDPS),
      dmgTaken: round2(m.avgDamageTakenPerEnc),
      accuracy: `${(m.avgAccuracy * 100).toFixed(1)}%`,
      combo: round2(m.avgMaxCombo),
    }));
    process.stderr.write(formatTable(rows, ['label', 'survival', 'avgFloor', 'dps', 'dmgTaken', 'accuracy', 'combo']));
  }

  // Solo relic impact (top 15 + bottom 5)
  if (analysis.soloRelicImpact.length > 0) {
    process.stderr.write('\n  SOLO RELIC IMPACT (top 15):\n');
    const topRows = analysis.soloRelicImpact.slice(0, 15).map(s => ({
      relic: s.relicId,
      tier: s.tier,
      survival: `${(s.metrics.survivalRate * 100).toFixed(1)}%`,
      survImpact: `${s.impact.survival > 0 ? '+' : ''}${s.impact.survival.toFixed(1)}%`,
      dpsImpact: `${s.impact.dps > 0 ? '+' : ''}${s.impact.dps.toFixed(1)}%`,
      defImpact: `${s.impact.defense > 0 ? '+' : ''}${s.impact.defense.toFixed(1)}%`,
      overall: `${s.impact.overall > 0 ? '+' : ''}${s.impact.overall.toFixed(1)}`,
    }));
    process.stderr.write(formatTable(topRows, ['relic', 'tier', 'survival', 'survImpact', 'dpsImpact', 'defImpact', 'overall']));

    if (analysis.soloRelicImpact.length > 15) {
      process.stderr.write('\n  SOLO RELIC IMPACT (bottom 5):\n');
      const bottomRows = analysis.soloRelicImpact.slice(-5).map(s => ({
        relic: s.relicId,
        tier: s.tier,
        survival: `${(s.metrics.survivalRate * 100).toFixed(1)}%`,
        overall: `${s.impact.overall > 0 ? '+' : ''}${s.impact.overall.toFixed(1)}`,
      }));
      process.stderr.write(formatTable(bottomRows, ['relic', 'tier', 'survival', 'overall']));
    }
  }

  // Combo synergies (top 10)
  if (analysis.comboAnalysis.length > 0) {
    process.stderr.write('\n  COMBO SYNERGIES (top 10):\n');
    const comboRows = analysis.comboAnalysis.slice(0, 10).map(c => ({
      relics: c.relics.join(' + '),
      synergy: round2(c.synergyFactor),
      verdict: c.verdict,
      survival: `${(c.metrics.survivalRate * 100).toFixed(1)}%`,
      dps: round2(c.metrics.avgDPS),
    }));
    process.stderr.write(formatTable(comboRows, ['relics', 'synergy', 'verdict', 'survival', 'dps']));
  }

  // Build performance
  if (analysis.buildPerformance.length > 0) {
    process.stderr.write('\n  BUILD PERFORMANCE:\n');
    const buildRows = analysis.buildPerformance.map(b => ({
      build: b.build,
      profile: b.profile,
      survival: `${(b.metrics.survivalRate * 100).toFixed(1)}%`,
      avgFloor: round2(b.metrics.avgFinalFloor),
      dps: round2(b.metrics.avgDPS),
      dmgTaken: round2(b.metrics.avgDamageTakenPerEnc),
    }));
    process.stderr.write(formatTable(buildRows, ['build', 'profile', 'survival', 'avgFloor', 'dps', 'dmgTaken']));
  }

  // Fairness
  if (analysis.skillFairness.length > 0) {
    process.stderr.write('\n  SKILL FAIRNESS:\n');
    const fairRows = analysis.skillFairness.map(f => ({
      loadout: f.loadout,
      ratio: round2(f.fairnessRatio),
      flag: f.flag ?? 'ok',
      profiles: Object.entries(f.profiles)
        .map(([p, m]) => `${p}:${(m.survivalRate * 100).toFixed(0)}%`)
        .join(' '),
    }));
    process.stderr.write(formatTable(fairRows, ['loadout', 'ratio', 'flag', 'profiles']));
  }

  // Progression
  if (analysis.progressionCurve.length > 0) {
    process.stderr.write('\n  PROGRESSION CURVE:\n');
    const progRows = analysis.progressionCurve.map(p => ({
      stage: p.stage,
      relicCount: p.relics.length,
      survival: `${(p.metrics.survivalRate * 100).toFixed(1)}%`,
      avgFloor: round2(p.metrics.avgFinalFloor),
      dps: round2(p.metrics.avgDPS),
    }));
    process.stderr.write(formatTable(progRows, ['stage', 'relicCount', 'survival', 'avgFloor', 'dps']));
  }

  // Flags
  const hasFlags = analysis.flags.overpowered.length > 0 ||
    analysis.flags.underpowered.length > 0 ||
    analysis.flags.brokenSynergies.length > 0 ||
    analysis.flags.immortality.length > 0;

  if (hasFlags) {
    process.stderr.write('\n  FLAGS:\n');
    if (analysis.flags.overpowered.length > 0) {
      process.stderr.write(`  Overpowered (S-tier):   ${analysis.flags.overpowered.join(', ')}\n`);
    }
    if (analysis.flags.underpowered.length > 0) {
      process.stderr.write(`  Underpowered (F-tier):  ${analysis.flags.underpowered.join(', ')}\n`);
    }
    if (analysis.flags.brokenSynergies.length > 0) {
      process.stderr.write(`  Broken synergies:       ${analysis.flags.brokenSynergies.join(', ')}\n`);
    }
    if (analysis.flags.immortality.length > 0) {
      process.stderr.write(`  Near-immortal (99%+):   ${analysis.flags.immortality.join(', ')}\n`);
    }
  }

  process.stderr.write('\n' + '='.repeat(70) + '\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const { mode, seeds: seedCount, ascension: ascensionLevels, floors, quiet } = args;

  // Validate profiles for custom mode
  if (mode === 'custom') {
    for (const pid of args.profiles) {
      if (!PROFILES[pid]) {
        process.stderr.write(`Warning: unknown profile "${pid}", skipping.\n`);
      }
    }
    args.profiles = args.profiles.filter(p => PROFILES[p]);
    if (args.profiles.length === 0) {
      process.stderr.write('Error: no valid profiles specified.\n');
      process.exit(1);
    }
  }

  // Generate configs based on mode
  let configs: SimConfig[] = [];
  switch (mode) {
    case 'solo':
      configs = generateSoloConfigs(ascensionLevels);
      break;
    case 'combos':
      configs = generateComboConfigs(ascensionLevels);
      break;
    case 'builds':
      configs = generateBuildConfigs(ascensionLevels);
      break;
    case 'fairness':
      configs = generateFairnessConfigs(ascensionLevels);
      break;
    case 'progression':
      configs = generateProgressionConfigs(ascensionLevels);
      break;
    case 'sweep':
      configs = [
        ...generateSoloConfigs(ascensionLevels),
        ...generateComboConfigs(ascensionLevels),
        ...generateBuildConfigs(ascensionLevels),
        ...generateFairnessConfigs(ascensionLevels),
        ...generateProgressionConfigs(ascensionLevels),
      ];
      break;
    case 'custom':
      configs = generateCustomConfigs(args.relics, args.profiles, ascensionLevels);
      break;
  }

  configs = deduplicateConfigs(configs);

  const totalSimulations = configs.length * seedCount;
  if (!quiet) {
    process.stderr.write(`\n  Mass Simulator: mode=${mode}, configs=${configs.length}, seeds=${seedCount}, total=${totalSimulations.toLocaleString()}\n`);
  }

  // Run loop
  const accumulator = new RunAccumulator();
  const baseSeed = 1000;
  let totalRuns = 0;
  const startTime = Date.now();

  for (const config of configs) {
    const baseProfile = PROFILES[config.profileId];
    if (!baseProfile) {
      if (!quiet) {
        process.stderr.write(`  Warning: unknown profile "${config.profileId}", skipping config "${config.label}"\n`);
      }
      continue;
    }

    const profile: PlayerProfile = {
      ...baseProfile,
      initialRelics: config.relics,
      ascensionLevel: config.ascensionLevel,
      sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
    };
    profile.id = `mass-${config.group}-${config.label}`;

    for (let s = 0; s < seedCount; s++) {
      const seed = baseSeed + s;
      const sim = new HeadlessCombatSimulator(profile, seed);
      const log = sim.simulateRun({ maxFloors: floors, summaryOnly: true, maxTotalTurns: 500 });
      accumulator.addRun(config, log.summary);
      totalRuns++;

      if (!quiet && totalRuns % 500 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalRuns / elapsed);
        process.stderr.write(`\r  Progress: ${totalRuns.toLocaleString()} / ${totalSimulations.toLocaleString()} runs (${rate} runs/s)...`);
      }
    }
  }

  const elapsedMs = Date.now() - startTime;

  if (!quiet) {
    process.stderr.write(`\r  Completed: ${totalRuns.toLocaleString()} runs in ${(elapsedMs / 1000).toFixed(1)}s\n`);
  }

  // Run analysis
  const analysis = runAnalysis(accumulator, mode);
  const meta: AnalysisOutput['meta'] = {
    generatedAt: new Date().toISOString(),
    totalRuns,
    seedsPerConfig: seedCount,
    floors,
    elapsedMs,
    mode,
  };

  const output: AnalysisOutput = { meta, ...analysis };

  // Output JSON
  const jsonStr = JSON.stringify(output, null, 2);

  if (args.output) {
    writeFileSync(args.output, jsonStr, 'utf-8');
    if (!quiet) {
      process.stderr.write(`  JSON written to: ${args.output}\n`);
    }
  } else {
    process.stdout.write(jsonStr + '\n');
  }

  // Output CSV
  if (args.csv) {
    writeCsv(accumulator, args.csv);
    if (!quiet) {
      process.stderr.write(`  CSV written to: ${args.csv}\n`);
    }
  }

  // Print summary table to stderr
  if (!quiet) {
    printSummaryTable(analysis, meta);
  }
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
