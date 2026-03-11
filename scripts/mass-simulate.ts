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
import type { PlayerProfile, PlaythroughSummary, DeepRunStats } from '../tests/playtest/core/types';
import { FULL_RELIC_CATALOGUE, STARTER_RELIC_IDS } from '../src/data/relics/index';
import { setBalanceOverrides, type BalanceOverrides } from '../src/data/balance';

// ─── Profile Presets ─────────────────────────────────────────────────────────

const PROFILES: Record<string, PlayerProfile> = {
  novice: {
    id: 'novice', name: 'Novice (30)', description: 'Brand new player, learning the basics',
    learningAbility: { baseAccuracy: 0.30, accuracyCurve: 'improving', accuracyPerFloorDelta: 0.02, minAccuracy: 0.20, maxAccuracy: 0.50 },
    readingSpeed: { category: 'slow', speedBonusProbability: 0.02 },
    strategicSkill: { level: 'random', prioritizeShieldsBeforeAttacks: false, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.2 },
    engagement: { skipProbability: 0.08, aggression: 'passive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  beginner: {
    id: 'beginner', name: 'Beginner (45)', description: 'Early player, still learning',
    learningAbility: { baseAccuracy: 0.45, accuracyCurve: 'improving', accuracyPerFloorDelta: 0.015, minAccuracy: 0.30, maxAccuracy: 0.60 },
    readingSpeed: { category: 'slow', speedBonusProbability: 0.05 },
    strategicSkill: { level: 'random', prioritizeShieldsBeforeAttacks: false, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.3 },
    engagement: { skipProbability: 0.05, aggression: 'passive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  casual: {
    id: 'casual', name: 'Casual (60)', description: 'Casual player, moderate knowledge',
    learningAbility: { baseAccuracy: 0.60, accuracyCurve: 'improving', accuracyPerFloorDelta: 0.01, minAccuracy: 0.45, maxAccuracy: 0.75 },
    readingSpeed: { category: 'normal', speedBonusProbability: 0.10 },
    strategicSkill: { level: 'basic', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.35 },
    engagement: { skipProbability: 0.05, aggression: 'balanced' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  average: {
    id: 'average', name: 'Average (70)', description: 'Typical player',
    learningAbility: { baseAccuracy: 0.70, accuracyCurve: 'improving', accuracyPerFloorDelta: 0.01, minAccuracy: 0.55, maxAccuracy: 0.85 },
    readingSpeed: { category: 'normal', speedBonusProbability: 0.15 },
    strategicSkill: { level: 'basic', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: false, saveHealsForLowHP: false, hpThresholdForHeal: 0.4 },
    engagement: { skipProbability: 0.05, aggression: 'balanced' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  skilled: {
    id: 'skilled', name: 'Skilled (80)', description: 'Good player with solid knowledge',
    learningAbility: { baseAccuracy: 0.80, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.70, maxAccuracy: 0.90 },
    readingSpeed: { category: 'fast', speedBonusProbability: 0.35 },
    strategicSkill: { level: 'intermediate', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: true, saveHealsForLowHP: true, hpThresholdForHeal: 0.35 },
    engagement: { skipProbability: 0.03, aggression: 'balanced' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  expert: {
    id: 'expert', name: 'Expert (90)', description: 'Highly skilled player',
    learningAbility: { baseAccuracy: 0.90, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.80, maxAccuracy: 0.95 },
    readingSpeed: { category: 'fast', speedBonusProbability: 0.60 },
    strategicSkill: { level: 'optimal', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: true, saveHealsForLowHP: true, hpThresholdForHeal: 0.35 },
    engagement: { skipProbability: 0.02, aggression: 'aggressive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
  master: {
    id: 'master', name: 'Master (95)', description: 'Elite speed-runner',
    learningAbility: { baseAccuracy: 0.95, accuracyCurve: 'flat', accuracyPerFloorDelta: 0.0, minAccuracy: 0.90, maxAccuracy: 0.99 },
    readingSpeed: { category: 'fast', speedBonusProbability: 0.90 },
    strategicSkill: { level: 'optimal', prioritizeShieldsBeforeAttacks: true, useBuffsBeforeDamage: true, saveHealsForLowHP: true, hpThresholdForHeal: 0.3 },
    engagement: { skipProbability: 0.0, aggression: 'aggressive' },
    sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
  },
};

// ─── Relic Lists (dynamic from catalogue) ───────────────────────────────────

/** Categories that don't affect combat simulation outcomes. */
const NON_COMBAT_CATEGORIES = new Set(['economy']);

/** Triggers that only affect meta-game / UI, not combat math. */
const NON_COMBAT_TRIGGERS = new Set<string>([]);

/** Specific relics excluded because the simulator can't model their effect
 *  (timer-based, echo system, domain tracking, UI-only). */
const SIMULATOR_EXCLUDED_RELICS = new Set([
  'time_dilation',       // timer-based (no timer in headless)
  'speed_reader',        // timer threshold (no timer in headless)
  'echo_lens',           // echo card system not modeled
  'domain_mastery',      // multi-domain tracking not modeled
  'polyglot_pendant',    // language detection not modeled
  'eidetic_memory',      // visual memory not modeled
  'brain_booster',       // UI hint system not modeled
  'cartographers_lens',  // foresight UI not modeled
]);

const ALL_RELICS = FULL_RELIC_CATALOGUE.map(r => r.id);

/** Combat-relevant relics: exclude economy-only, UI-only, and unmodelable relics. */
const COMBAT_RELICS = FULL_RELIC_CATALOGUE
  .filter(r =>
    !NON_COMBAT_CATEGORIES.has(r.category) &&
    !NON_COMBAT_TRIGGERS.has(r.trigger) &&
    !SIMULATOR_EXCLUDED_RELICS.has(r.id)
  )
  .map(r => r.id);

// ─── Config Types ────────────────────────────────────────────────────────────

interface SimConfig {
  label: string;
  profileId: string;
  relics: string[];
  ascensionLevel: number;
  group: string;
  difficultyMode?: 'relaxed' | 'normal';
  balanceOverrides?: BalanceOverrides;
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
  avgGoldEarned: number;
  avgGoldSpent: number;
  avgUpgrades: number;
  avgShopRelicsPurchased: number;
  avgActiveSynergies: number;
  avgFoodPurchased: number;
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
    totalGoldEarned: number;
    totalGoldSpent: number;
    totalUpgrades: number;
    totalShopRelics: number;
    totalActiveSynergies: number;
    totalFoodPurchased: number;
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
        totalGoldEarned: 0,
        totalGoldSpent: 0,
        totalUpgrades: 0,
        totalShopRelics: 0,
        totalActiveSynergies: 0,
        totalFoodPurchased: 0,
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

    // Economy and upgrade stats
    entry.totalGoldEarned += summary.goldEarned ?? 0;
    entry.totalGoldSpent += summary.goldSpent ?? 0;
    entry.totalUpgrades += summary.cardsUpgraded ?? 0;
    entry.totalShopRelics += summary.shopRelicsPurchased ?? 0;
    entry.totalActiveSynergies += (summary.activeSynergies?.length ?? 0);
    entry.totalFoodPurchased += summary.shopFoodPurchased ?? 0;
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
      avgGoldEarned: entry.totalGoldEarned / n,
      avgGoldSpent: entry.totalGoldSpent / n,
      avgUpgrades: entry.totalUpgrades / n,
      avgShopRelicsPurchased: entry.totalShopRelics / n,
      avgActiveSynergies: entry.totalActiveSynergies / n,
      avgFoodPurchased: entry.totalFoodPurchased / n,
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

// ─── Deep Analysis Types ────────────────────────────────────────────────────

interface PerFloorStat {
  floor: number;
  survivalToFloorN: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgHpRemaining: number;
  dropoffPct: number;
}

interface PerEnemyStat {
  enemyId: string;
  category: string;
  encounters: number;
  defeatRate: number;
  avgTurnsToKill: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
}

interface CardTypeEffectiveness {
  cardType: string;
  totalPlayed: number;
  accuracy: number;
  avgDamage: number;
  avgShield: number;
  avgHeal: number;
  fizzleRate: number;
}

interface FunFactorMetrics {
  closeCallRate: number;
  comebackRate: number;
  overkillRate: number;
  avgMinHpReached: number;
}

interface RelicCountScaling {
  relicCount: number;
  survivalRate: number;
  avgFloor: number;
  avgDPS: number;
}

interface DeepAnalysisOutput {
  perFloorStats: PerFloorStat[];
  perEnemyStats: PerEnemyStat[];
  cardTypeEffectiveness: CardTypeEffectiveness[];
  funFactorMetrics: FunFactorMetrics;
  relicCountScaling: RelicCountScaling[];
  economyStats: {
    avgGoldEarned: number;
    avgGoldSpent: number;
    avgGoldEfficiency: number;
  };
  upgradeStats: {
    avgUpgradesPerRun: number;
    upgradesByMechanic: Record<string, number>;
  };
  synergyStats: {
    avgSynergiesPerRun: number;
    synergyFrequency: Record<string, number>;
  };
}

// ─── Deep Accumulator ───────────────────────────────────────────────────────

class DeepAccumulator {
  private floorStats = new Map<number, { reached: number; survived: number; damageDealtSum: number; damageTakenSum: number; hpRemainingSum: number }>();
  private enemyStats = new Map<string, { encounters: number; defeats: number; turnsSum: number; damageDealtSum: number; damageTakenSum: number; category: string }>();
  private cardTypeStats = new Map<string, { played: number; correct: number; damageSum: number; shieldSum: number; healSum: number; fizzled: number }>();

  private totalRuns = 0;
  private totalWins = 0;
  private closeCallWins = 0;
  private comebackWins = 0;
  private overkillWins = 0;
  private minHpSum = 0;

  private relicCountStats = new Map<number, { runs: number; wins: number; floorSum: number; dpsSum: number }>();

  private totalGoldEarned = 0;
  private totalGoldSpent = 0;
  private totalUpgrades = 0;
  private upgradesByMechanic = new Map<string, number>();
  private totalSynergies = 0;
  private synergyFrequency = new Map<string, number>();
  private totalFoodPurchased = 0;

  /** Add a completed run's deep stats to the accumulator. */
  addRun(summary: PlaythroughSummary, relicCount: number): void {
    if (!summary.deepStats) return;
    const ds = summary.deepStats;

    this.totalRuns++;
    const won = summary.result === 'victory';
    if (won) this.totalWins++;

    // Floor stats
    for (const fr of ds.floorResults) {
      let fs = this.floorStats.get(fr.floor);
      if (!fs) { fs = { reached: 0, survived: 0, damageDealtSum: 0, damageTakenSum: 0, hpRemainingSum: 0 }; this.floorStats.set(fr.floor, fs); }
      fs.reached++;
      if (fr.survived) fs.survived++;
      fs.damageDealtSum += fr.totalDamageDealt;
      fs.damageTakenSum += fr.totalDamageTaken;
      fs.hpRemainingSum += fr.hpAtEnd;
    }

    // Enemy stats
    for (const ee of ds.enemyEncounters) {
      let es = this.enemyStats.get(ee.enemyId);
      if (!es) { es = { encounters: 0, defeats: 0, turnsSum: 0, damageDealtSum: 0, damageTakenSum: 0, category: ee.enemyCategory }; this.enemyStats.set(ee.enemyId, es); }
      es.encounters++;
      if (ee.defeated) es.defeats++;
      es.turnsSum += ee.turnsToResolve;
      es.damageDealtSum += ee.damageDealt;
      es.damageTakenSum += ee.damageTaken;
    }

    // Card type stats
    for (const [ct, stats] of Object.entries(ds.cardTypeStats)) {
      let cs = this.cardTypeStats.get(ct);
      if (!cs) { cs = { played: 0, correct: 0, damageSum: 0, shieldSum: 0, healSum: 0, fizzled: 0 }; this.cardTypeStats.set(ct, cs); }
      cs.played += stats.played;
      cs.correct += stats.correct;
      cs.damageSum += stats.totalDamage;
      cs.shieldSum += stats.totalShield;
      cs.healSum += stats.totalHeal;
      cs.fizzled += stats.fizzled;
    }

    // Fun factor
    if (ds.funFactor.closeCallWin) this.closeCallWins++;
    if (ds.funFactor.comebackWin) this.comebackWins++;
    if (ds.funFactor.overkillWin) this.overkillWins++;
    this.minHpSum += ds.funFactor.minHpReached;

    // Relic count buckets
    let rc = this.relicCountStats.get(relicCount);
    if (!rc) { rc = { runs: 0, wins: 0, floorSum: 0, dpsSum: 0 }; this.relicCountStats.set(relicCount, rc); }
    rc.runs++;
    if (won) rc.wins++;
    rc.floorSum += summary.finalFloor;
    const totalDmg = ds.floorResults.reduce((sum, fr) => sum + fr.totalDamageDealt, 0);
    const totalTurns = ds.floorResults.reduce((sum, fr) => sum + fr.totalTurns, 0);
    rc.dpsSum += totalTurns > 0 ? totalDmg / totalTurns : 0;

    // Economy stats
    this.totalGoldEarned += ds.goldEarned ?? 0;
    this.totalGoldSpent += ds.goldSpent ?? 0;

    // Upgrade stats
    this.totalUpgrades += (ds.upgradeHistory?.length ?? 0);
    for (const upgrade of (ds.upgradeHistory ?? [])) {
      this.upgradesByMechanic.set(upgrade.mechanicId, (this.upgradesByMechanic.get(upgrade.mechanicId) ?? 0) + 1);
    }

    // Synergy stats
    const synergies = ds.synergyTimeline?.at(-1)?.synergies ?? [];
    this.totalSynergies += synergies.length;
    for (const synergyId of synergies) {
      this.synergyFrequency.set(synergyId, (this.synergyFrequency.get(synergyId) ?? 0) + 1);
    }

    // Food stats
    this.totalFoodPurchased += summary.shopFoodPurchased ?? 0;
  }

  /** Compute deep analysis results. */
  getResults(): DeepAnalysisOutput {
    // Floor stats
    const perFloorStats: PerFloorStat[] = [];
    const floors = [...this.floorStats.keys()].sort((a, b) => a - b);
    let prevSurvival = 1.0;
    for (const f of floors) {
      const fs = this.floorStats.get(f)!;
      const survivalRate = fs.reached > 0 ? fs.survived / fs.reached : 0;
      const dropoff = prevSurvival > 0 ? ((prevSurvival - survivalRate) / prevSurvival) * 100 : 0;
      perFloorStats.push({
        floor: f,
        survivalToFloorN: round2(survivalRate * 100),
        avgDamageDealt: round2(fs.reached > 0 ? fs.damageDealtSum / fs.reached : 0),
        avgDamageTaken: round2(fs.reached > 0 ? fs.damageTakenSum / fs.reached : 0),
        avgHpRemaining: round2(fs.reached > 0 ? fs.hpRemainingSum / fs.reached : 0),
        dropoffPct: round2(dropoff),
      });
      prevSurvival = survivalRate;
    }

    // Enemy stats
    const perEnemyStats: PerEnemyStat[] = [];
    for (const [id, es] of this.enemyStats) {
      perEnemyStats.push({
        enemyId: id,
        category: es.category,
        encounters: es.encounters,
        defeatRate: round2(es.encounters > 0 ? (es.defeats / es.encounters) * 100 : 0),
        avgTurnsToKill: round2(es.encounters > 0 ? es.turnsSum / es.encounters : 0),
        avgDamageDealt: round2(es.encounters > 0 ? es.damageDealtSum / es.encounters : 0),
        avgDamageTaken: round2(es.encounters > 0 ? es.damageTakenSum / es.encounters : 0),
      });
    }
    perEnemyStats.sort((a, b) => a.defeatRate - b.defeatRate); // hardest enemies first

    // Card type stats
    const cardTypeEffectiveness: CardTypeEffectiveness[] = [];
    for (const [ct, cs] of this.cardTypeStats) {
      cardTypeEffectiveness.push({
        cardType: ct,
        totalPlayed: cs.played,
        accuracy: round2(cs.played > 0 ? (cs.correct / cs.played) * 100 : 0),
        avgDamage: round2(cs.played > 0 ? cs.damageSum / cs.played : 0),
        avgShield: round2(cs.played > 0 ? cs.shieldSum / cs.played : 0),
        avgHeal: round2(cs.played > 0 ? cs.healSum / cs.played : 0),
        fizzleRate: round2(cs.played > 0 ? (cs.fizzled / cs.played) * 100 : 0),
      });
    }
    cardTypeEffectiveness.sort((a, b) => b.totalPlayed - a.totalPlayed);

    // Fun factor
    const funFactorMetrics: FunFactorMetrics = {
      closeCallRate: round2(this.totalWins > 0 ? (this.closeCallWins / this.totalWins) * 100 : 0),
      comebackRate: round2(this.totalWins > 0 ? (this.comebackWins / this.totalWins) * 100 : 0),
      overkillRate: round2(this.totalWins > 0 ? (this.overkillWins / this.totalWins) * 100 : 0),
      avgMinHpReached: round2(this.totalRuns > 0 ? this.minHpSum / this.totalRuns : 0),
    };

    // Relic count scaling
    const relicCountScaling: RelicCountScaling[] = [];
    const relicCounts = [...this.relicCountStats.keys()].sort((a, b) => a - b);
    for (const rc of relicCounts) {
      const rcs = this.relicCountStats.get(rc)!;
      relicCountScaling.push({
        relicCount: rc,
        survivalRate: round2(rcs.runs > 0 ? (rcs.wins / rcs.runs) * 100 : 0),
        avgFloor: round2(rcs.runs > 0 ? rcs.floorSum / rcs.runs : 0),
        avgDPS: round2(rcs.runs > 0 ? rcs.dpsSum / rcs.runs : 0),
      });
    }

    const n = this.totalRuns || 1;

    const economyStats = {
      avgGoldEarned: round2(this.totalGoldEarned / n),
      avgGoldSpent: round2(this.totalGoldSpent / n),
      avgGoldEfficiency: round2(this.totalGoldEarned > 0 ? (this.totalGoldSpent / this.totalGoldEarned) * 100 : 0),
      avgFoodPurchased: round2(this.totalFoodPurchased / n),
    };

    const upgradeStats = {
      avgUpgradesPerRun: round2(this.totalUpgrades / n),
      upgradesByMechanic: Object.fromEntries(this.upgradesByMechanic),
    };

    const synergyStats = {
      avgSynergiesPerRun: round2(this.totalSynergies / n),
      synergyFrequency: Object.fromEntries(this.synergyFrequency),
    };

    return { perFloorStats, perEnemyStats, cardTypeEffectiveness, funFactorMetrics, relicCountScaling, economyStats, upgradeStats, synergyStats };
  }
}

// ─── Config Generators ───────────────────────────────────────────────────────

function generateSoloConfigs(ascensionLevels: number[]): SimConfig[] {
  const configs: SimConfig[] = [];

  const DIFFICULTY_MODES: Array<'relaxed' | 'normal'> = ['relaxed', 'normal'];

  // Control baselines: each profile × each difficulty mode × each ascension
  for (const profileId of Object.keys(PROFILES)) {
    for (const mode of DIFFICULTY_MODES) {
      for (const asc of ascensionLevels) {
        configs.push({
          label: `control-${profileId}-${mode}-asc${asc}`,
          profileId,
          relics: [],
          ascensionLevel: asc,
          group: 'control',
          difficultyMode: mode,
        });
      }
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
      profileId: 'master',
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

  const fairnessProfiles = ['novice', 'beginner', 'casual', 'average', 'skilled', 'expert', 'master'];
  const fairnessModes: Array<'relaxed' | 'normal'> = ['relaxed', 'normal'];
  const configs: SimConfig[] = [];

  for (const profileId of fairnessProfiles) {
    for (const mode of fairnessModes) {
      for (const asc of ascensionLevels) {
        // control
        configs.push({
          label: `fairness-${profileId}-${mode}-control-asc${asc}`,
          profileId,
          relics: [],
          ascensionLevel: asc,
          group: 'fairness',
          difficultyMode: mode,
        });
        // each loadout
        for (const loadout of loadouts) {
          configs.push({
            label: `fairness-${profileId}-${mode}-${loadout.name}-asc${asc}`,
            profileId,
            relics: loadout.relics,
            ascensionLevel: asc,
            group: 'fairness',
            difficultyMode: mode,
          });
        }
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

function generateDeepConfigs(ascensionLevels: number[]): SimConfig[] {
  const configs: SimConfig[] = [];

  const DEEP_MODES: Array<'relaxed' | 'normal'> = ['relaxed', 'normal'];
  const DEEP_PROFILES = Object.keys(PROFILES);

  for (const profileId of DEEP_PROFILES) {
    for (const mode of DEEP_MODES) {
      for (const asc of ascensionLevels) {
        // Control (no relics)
        configs.push({ label: `deep-control-${profileId}-${mode}-asc${asc}`, profileId, relics: [], ascensionLevel: asc, group: 'deep', difficultyMode: mode });

        // 1-relic tests (top 3 combat relics)
        for (const r of COMBAT_RELICS.slice(0, 3)) {
          configs.push({ label: `deep-1relic-${r}-${profileId}-${mode}-asc${asc}`, profileId, relics: [r], ascensionLevel: asc, group: 'deep', difficultyMode: mode });
        }

        // Starter relics (3)
        configs.push({ label: `deep-3relics-starter-${profileId}-${mode}-asc${asc}`, profileId, relics: ['whetstone', 'iron_buckler', 'herbal_pouch'], ascensionLevel: asc, group: 'deep', difficultyMode: mode });

        // Mid-game (5)
        configs.push({ label: `deep-5relics-mid-${profileId}-${mode}-asc${asc}`, profileId, relics: ['whetstone', 'iron_buckler', 'herbal_pouch', 'combo_ring', 'swift_boots'], ascensionLevel: asc, group: 'deep', difficultyMode: mode });

        // Full build (8)
        configs.push({ label: `deep-8relics-full-${profileId}-${mode}-asc${asc}`, profileId, relics: ['whetstone', 'iron_buckler', 'herbal_pouch', 'combo_ring', 'swift_boots', 'fortress_wall', 'blood_pact', 'afterimage'], ascensionLevel: asc, group: 'deep', difficultyMode: mode });
      }
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
  sweepMaxConfigs?: number;
  sweepStrategy?: 'grid' | 'lhs' | 'random';
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
      case '--sweep-max-configs':
        args.sweepMaxConfigs = parseInt(next, 10);
        i++;
        break;
      case '--sweep-strategy':
        args.sweepStrategy = next as any;
        i++;
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

  const validModes = ['solo', 'combos', 'builds', 'fairness', 'progression', 'sweep', 'custom', 'deep'];
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
  fairness     Test loadouts across all 7 profiles + 2 difficulty modes
  progression  Test progression stages (new player -> full collection)
  sweep        Parameter sweep: test balance configurations and rank them
  custom       Custom relics and profiles
  deep         Deep analytics: per-floor stats, enemy stats, card effectiveness, fun factor

Options:
  --seeds N              Seeds per config (default: 50)
  --ascension 0,5,10     Comma-separated ascension levels (default: 0)
  --floors N             Max floors per run (default: 24)
  --relics a,b,c         Relic list for custom mode
  --profiles a,b,c       Profile list for custom mode (default: average)
  --output path          Write JSON output to file
  --csv path             Write CSV output to file
  --quiet                Suppress progress output to stderr
  --sweep-max-configs N  Max parameter combinations to test (default: 500)
  --sweep-strategy S     Sampling: grid, lhs, random (default: lhs)
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
  deepAnalysis?: DeepAnalysisOutput;
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

    const dm = config.difficultyMode ?? 'normal';
    const controlKey = `control-${config.profileId}-${dm}-asc${config.ascensionLevel}`;
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

    const dm = config.difficultyMode ?? 'normal';
    const controlKey = `control-${config.profileId}-${dm}-asc${config.ascensionLevel}`;
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
    // Only flag as broken if the combo impact is substantial (>5.0) AND ratio is high
    // This prevents false positives from low-solo-impact relics producing high ratios
    if (synergyFactor > 2.0 && Math.abs(comboOverall) > 5.0) verdict = 'broken_synergy';
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
    const profileId = parts.slice(2, -1).join('-'); // handle multi-word profile names

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

function printDeepSummary(deep: DeepAnalysisOutput): void {
  process.stderr.write('\n');
  process.stderr.write('-'.repeat(70) + '\n');
  process.stderr.write('  DEEP ANALYSIS\n');
  process.stderr.write('-'.repeat(70) + '\n');

  // Floor difficulty curve
  if (deep.perFloorStats.length > 0) {
    process.stderr.write('\n  FLOOR DIFFICULTY CURVE:\n');
    const floorRows = deep.perFloorStats.map(f => ({
      floor: f.floor,
      survival: `${f.survivalToFloorN.toFixed(1)}%`,
      avgDmgDealt: round2(f.avgDamageDealt),
      avgDmgTaken: round2(f.avgDamageTaken),
      avgHpLeft: round2(f.avgHpRemaining),
      dropoff: `${f.dropoffPct.toFixed(1)}%`,
    }));
    process.stderr.write(formatTable(floorRows, ['floor', 'survival', 'avgDmgDealt', 'avgDmgTaken', 'avgHpLeft', 'dropoff']));
  }

  // Top 10 hardest enemies
  if (deep.perEnemyStats.length > 0) {
    process.stderr.write('\n  HARDEST ENEMIES (top 10):\n');
    const enemyRows = deep.perEnemyStats.slice(0, 10).map(e => ({
      enemy: e.enemyId,
      category: e.category,
      encounters: e.encounters,
      defeatRate: `${e.defeatRate.toFixed(1)}%`,
      avgTurns: round2(e.avgTurnsToKill),
      avgDmgDealt: round2(e.avgDamageDealt),
      avgDmgTaken: round2(e.avgDamageTaken),
    }));
    process.stderr.write(formatTable(enemyRows, ['enemy', 'category', 'encounters', 'defeatRate', 'avgTurns', 'avgDmgDealt', 'avgDmgTaken']));
  }

  // Card type effectiveness
  if (deep.cardTypeEffectiveness.length > 0) {
    process.stderr.write('\n  CARD TYPE EFFECTIVENESS:\n');
    const ctRows = deep.cardTypeEffectiveness.map(c => ({
      type: c.cardType,
      played: c.totalPlayed,
      accuracy: `${c.accuracy.toFixed(1)}%`,
      avgDmg: round2(c.avgDamage),
      avgShield: round2(c.avgShield),
      avgHeal: round2(c.avgHeal),
      fizzle: `${c.fizzleRate.toFixed(1)}%`,
    }));
    process.stderr.write(formatTable(ctRows, ['type', 'played', 'accuracy', 'avgDmg', 'avgShield', 'avgHeal', 'fizzle']));
  }

  // Fun factor metrics
  process.stderr.write('\n  FUN FACTOR METRICS:\n');
  process.stderr.write(`  Close-call win rate:  ${deep.funFactorMetrics.closeCallRate.toFixed(1)}%\n`);
  process.stderr.write(`  Comeback win rate:    ${deep.funFactorMetrics.comebackRate.toFixed(1)}%\n`);
  process.stderr.write(`  Overkill win rate:    ${deep.funFactorMetrics.overkillRate.toFixed(1)}%\n`);
  process.stderr.write(`  Avg min HP reached:   ${deep.funFactorMetrics.avgMinHpReached.toFixed(1)}\n`);

  // Relic count scaling
  if (deep.relicCountScaling.length > 0) {
    process.stderr.write('\n  RELIC COUNT SCALING:\n');
    const rcRows = deep.relicCountScaling.map(r => ({
      relics: r.relicCount,
      survival: `${r.survivalRate.toFixed(1)}%`,
      avgFloor: round2(r.avgFloor),
      avgDPS: round2(r.avgDPS),
    }));
    process.stderr.write(formatTable(rcRows, ['relics', 'survival', 'avgFloor', 'avgDPS']));
  }
}

// ─── Parameter Sweep Mode ────────────────────────────────────────────────────

/** Parameter range definition for sweep. */
interface SweepParamRange {
  key: keyof BalanceOverrides;
  values: any[];
}

/** Default sweep parameters — the most impactful balance levers. */
const DEFAULT_SWEEP_PARAMS: SweepParamRange[] = [
  { key: 'baseEffectAttack', values: [8, 9, 10, 11, 12] },
  { key: 'postEncounterHealPct', values: [0.04, 0.06, 0.08, 0.10, 0.12] },
  { key: 'fizzleEffectRatio', values: [0.10, 0.15, 0.20, 0.25, 0.30] },
  { key: 'floorDamageScalingPerFloor', values: [0.02, 0.03, 0.04, 0.05] },
  { key: 'comboMultipliers', values: [
    [1.0, 1.10, 1.25, 1.40, 1.75],
    [1.0, 1.10, 1.20, 1.30, 1.50],
    [1.0, 1.15, 1.30, 1.50, 2.00],
  ]},
  { key: 'playerStartHP', values: [80, 90, 100, 110] },
  { key: 'postEncounterHealCap', values: [
    { 1: 1.0, 2: 1.0, 3: 0.85, 4: 0.70 },
    { 1: 1.0, 2: 0.95, 3: 0.80, 4: 0.60 },
    { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0 },
  ]},
];

/** Generate Latin Hypercube samples for parameter sweep. */
function generateLHS(params: SweepParamRange[], n: number, rng: () => number): BalanceOverrides[] {
  const configs: BalanceOverrides[] = [];
  const indexArrays = params.map(p => {
    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      indices.push(i % p.values.length);
    }
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });

  for (let i = 0; i < n; i++) {
    const overrides: BalanceOverrides = {};
    for (let p = 0; p < params.length; p++) {
      const param = params[p];
      const valueIndex = indexArrays[p][i];
      (overrides as any)[param.key] = param.values[valueIndex];
    }
    configs.push(overrides);
  }
  return configs;
}

/** Generate grid (Cartesian product) of all parameter values. */
function generateGrid(params: SweepParamRange[]): BalanceOverrides[] {
  let configs: BalanceOverrides[] = [{}];
  for (const param of params) {
    const expanded: BalanceOverrides[] = [];
    for (const existing of configs) {
      for (const value of param.values) {
        expanded.push({ ...existing, [param.key]: value });
      }
    }
    configs = expanded;
  }
  return configs;
}

/** Generate random parameter combinations. */
function generateRandom(params: SweepParamRange[], n: number, rng: () => number): BalanceOverrides[] {
  const configs: BalanceOverrides[] = [];
  for (let i = 0; i < n; i++) {
    const overrides: BalanceOverrides = {};
    for (const param of params) {
      (overrides as any)[param.key] = param.values[Math.floor(rng() * param.values.length)];
    }
    configs.push(overrides);
  }
  return configs;
}

interface SweepTargets {
  survivalTargets: Record<string, [number, number]>;
  turnsPerEncounterTarget: [number, number];
}

const SWEEP_TARGETS: SweepTargets = {
  survivalTargets: {
    casual: [0.15, 0.30],
    average: [0.25, 0.40],
    skilled: [0.50, 0.70],
  },
  turnsPerEncounterTarget: [4.0, 6.0],
};

function rangeScore(actual: number, min: number, max: number): number {
  if (actual >= min && actual <= max) return 0;
  if (actual < min) return (min - actual) / Math.max(max - min, 0.01);
  return (actual - max) / Math.max(max - min, 0.01);
}

interface SweepResult {
  rank: number;
  overrides: BalanceOverrides;
  compositeScore: number;
  metricScores: {
    survivalFit: number;
    pacingFit: number;
    foodFit: number;
    goldEfficiencyFit: number;
  };
  profileMetrics: Record<string, {
    survivalRate: number;
    avgFinalFloor: number;
    avgTurnsPerEncounter: number;
    avgFoodPurchased: number;
    avgGoldEarned: number;
    avgGoldSpent: number;
  }>;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den > 0 ? Math.round((num / den) * 1000) / 1000 : 0;
}

function generateSweepConfigs(
  maxConfigs: number,
  strategy: 'grid' | 'lhs' | 'random',
  profiles: string[],
  ascensionLevels: number[],
  difficultyModes: Array<'relaxed' | 'normal'>,
): { configs: SimConfig[]; overrideSets: BalanceOverrides[] } {
  const rng = () => Math.random();
  const params = DEFAULT_SWEEP_PARAMS;

  let overrideSets: BalanceOverrides[];
  const totalGrid = params.reduce((acc, p) => acc * p.values.length, 1);

  if (strategy === 'grid' && totalGrid <= maxConfigs) {
    overrideSets = generateGrid(params);
  } else if (strategy === 'lhs') {
    overrideSets = generateLHS(params, Math.min(maxConfigs, totalGrid), rng);
  } else {
    overrideSets = generateRandom(params, maxConfigs, rng);
  }

  const configs: SimConfig[] = [];

  for (const profileId of profiles) {
    for (const asc of ascensionLevels) {
      for (const dm of difficultyModes) {
        configs.push({
          label: `sweep-control-${profileId}-${dm}-asc${asc}`,
          profileId,
          relics: [],
          ascensionLevel: asc,
          group: 'sweep-control',
          difficultyMode: dm,
        });
      }
    }
  }

  for (let i = 0; i < overrideSets.length; i++) {
    for (const profileId of profiles) {
      for (const asc of ascensionLevels) {
        for (const dm of difficultyModes) {
          configs.push({
            label: `sweep-${i}-${profileId}-${dm}-asc${asc}`,
            profileId,
            relics: [],
            ascensionLevel: asc,
            group: 'sweep',
            difficultyMode: dm,
            balanceOverrides: overrideSets[i],
          });
        }
      }
    }
  }

  return { configs, overrideSets };
}

function analyzeSweep(
  accumulator: RunAccumulator,
  overrideSets: BalanceOverrides[],
  profiles: string[],
  ascensionLevels: number[],
  difficultyModes: Array<'relaxed' | 'normal'>,
): { topConfigs: SweepResult[]; sensitivity: Record<string, number>; controlBaseline: Record<string, any> } {
  const results: SweepResult[] = [];

  for (let i = 0; i < overrideSets.length; i++) {
    const profileMetrics: Record<string, any> = {};
    for (const profileId of profiles) {
      for (const asc of ascensionLevels) {
        for (const dm of difficultyModes) {
          const label = `sweep-${i}-${profileId}-${dm}-asc${asc}`;
          const metrics = accumulator.getMetrics(label);
          if (metrics) {
            profileMetrics[`${profileId}-${dm}-asc${asc}`] = {
              survivalRate: metrics.survivalRate,
              avgFinalFloor: metrics.avgFinalFloor,
              avgTurnsPerEncounter: metrics.avgTurnsPerEncounter,
              avgFoodPurchased: metrics.avgFoodPurchased,
              avgGoldEarned: metrics.avgGoldEarned,
              avgGoldSpent: metrics.avgGoldSpent,
            };
          }
        }
      }
    }

    let survivalFit = 0;
    let survivalCount = 0;
    let pacingTotal = 0;
    let pacingCount = 0;
    let foodTotal = 0;
    let goldEffTotal = 0;
    let metricCount = 0;

    for (const [key, m] of Object.entries(profileMetrics)) {
      const profileId = key.split('-')[0];
      const target = SWEEP_TARGETS.survivalTargets[profileId];
      if (target) {
        survivalFit += rangeScore(m.survivalRate, target[0], target[1]);
        survivalCount++;
      }
      pacingTotal += rangeScore(m.avgTurnsPerEncounter, ...SWEEP_TARGETS.turnsPerEncounterTarget);
      pacingCount++;
      foodTotal += m.avgFoodPurchased;
      if (m.avgGoldEarned > 0) {
        goldEffTotal += m.avgGoldSpent / m.avgGoldEarned;
      }
      metricCount++;
    }

    const avgSurvivalFit = survivalCount > 0 ? survivalFit / survivalCount : 10;
    const avgPacingFit = pacingCount > 0 ? pacingTotal / pacingCount : 10;
    const avgFood = metricCount > 0 ? foodTotal / metricCount : 0;
    const avgGoldEff = metricCount > 0 ? goldEffTotal / metricCount : 0;
    const foodFit = rangeScore(avgFood, 1.0, 3.0);
    const goldFit = rangeScore(avgGoldEff, 0.55, 0.80);

    const compositeScore = avgSurvivalFit * 3.0 + avgPacingFit * 1.5 + foodFit * 1.0 + goldFit * 1.0;

    results.push({
      rank: 0,
      overrides: overrideSets[i],
      compositeScore: Math.round(compositeScore * 1000) / 1000,
      metricScores: {
        survivalFit: Math.round(avgSurvivalFit * 1000) / 1000,
        pacingFit: Math.round(avgPacingFit * 1000) / 1000,
        foodFit: Math.round(foodFit * 1000) / 1000,
        goldEfficiencyFit: Math.round(goldFit * 1000) / 1000,
      },
      profileMetrics,
    });
  }

  results.sort((a, b) => a.compositeScore - b.compositeScore);
  results.forEach((r, i) => r.rank = i + 1);

  const sensitivity: Record<string, number> = {};
  const scores = results.map(r => r.compositeScore);

  for (const param of DEFAULT_SWEEP_PARAMS) {
    const values = results.map(r => {
      const v = (r.overrides as any)[param.key];
      return typeof v === 'number' ? v : 0;
    });
    if (values.some(v => v !== 0)) {
      sensitivity[param.key] = pearsonCorrelation(values, scores);
    }
  }

  const controlBaseline: Record<string, any> = {};
  for (const profileId of profiles) {
    for (const asc of ascensionLevels) {
      for (const dm of difficultyModes) {
        const label = `sweep-control-${profileId}-${dm}-asc${asc}`;
        const metrics = accumulator.getMetrics(label);
        if (metrics) controlBaseline[label] = metrics;
      }
    }
  }

  return {
    topConfigs: results.slice(0, 20),
    sensitivity,
    controlBaseline,
  };
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
    case 'sweep': {
      const maxConfigs = args.sweepMaxConfigs ?? 500;
      const strategy = args.sweepStrategy ?? 'lhs';
      const sweepProfiles = ['casual', 'average', 'skilled'];
      const DIFFICULTY_MODES: Array<'relaxed' | 'normal'> = ['relaxed', 'normal'];
      const sweepResult = generateSweepConfigs(maxConfigs, strategy, sweepProfiles, ascensionLevels, DIFFICULTY_MODES);
      configs = sweepResult.configs;
      (globalThis as any).__sweepOverrideSets = sweepResult.overrideSets;
      (globalThis as any).__sweepProfiles = sweepProfiles;
      (globalThis as any).__sweepDifficultyModes = DIFFICULTY_MODES;
      break;
    }
    case 'custom':
      configs = generateCustomConfigs(args.relics, args.profiles, ascensionLevels);
      break;
    case 'deep':
      configs = generateDeepConfigs(ascensionLevels);
      break;
  }

  configs = deduplicateConfigs(configs);

  const totalSimulations = configs.length * seedCount;
  if (!quiet) {
    process.stderr.write(`\n  Mass Simulator: mode=${mode}, configs=${configs.length}, seeds=${seedCount}, total=${totalSimulations.toLocaleString()}\n`);
  }

  // Run loop
  const accumulator = new RunAccumulator();
  const deepAccumulator = mode === 'deep' ? new DeepAccumulator() : null;
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
      difficultyMode: config.difficultyMode ?? baseProfile.difficultyMode,
      sessionBehavior: { maxFloors: 24, cashOutFloor: 0 },
    };
    profile.id = `mass-${config.group}-${config.label}`;

    setBalanceOverrides(config.balanceOverrides ?? null);

    for (let s = 0; s < seedCount; s++) {
      const seed = baseSeed + s;
      const sim = new HeadlessCombatSimulator(profile, seed);
      const log = sim.simulateRun({ maxFloors: floors, summaryOnly: true, maxTotalTurns: 500, deepMode: mode === 'deep' });
      accumulator.addRun(config, log.summary);
      if (deepAccumulator && log.summary.deepStats) {
        deepAccumulator.addRun(log.summary, config.relics.length);
      }
      totalRuns++;

      if (!quiet && totalRuns % 500 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(totalRuns / elapsed);
        process.stderr.write(`\r  Progress: ${totalRuns.toLocaleString()} / ${totalSimulations.toLocaleString()} runs (${rate} runs/s)...`);
      }
    }

    setBalanceOverrides(null);
  }

  const elapsedMs = Date.now() - startTime;

  if (!quiet) {
    process.stderr.write(`\r  Completed: ${totalRuns.toLocaleString()} runs in ${(elapsedMs / 1000).toFixed(1)}s\n`);
  }

  // Run analysis
  const analysis = runAnalysis(accumulator, mode);

  // Sweep analysis
  let sweepAnalysisOutput: any = null;
  if (mode === 'sweep' && (globalThis as any).__sweepOverrideSets) {
    const overrideSets = (globalThis as any).__sweepOverrideSets as BalanceOverrides[];
    const sweepProfiles = (globalThis as any).__sweepProfiles as string[];
    const sweepDiffModes = (globalThis as any).__sweepDifficultyModes as Array<'relaxed' | 'normal'>;
    const sweepAnalysis = analyzeSweep(accumulator, overrideSets, sweepProfiles, ascensionLevels, sweepDiffModes);

    if (!quiet) {
      process.stderr.write('\n=== PARAMETER SWEEP RESULTS ===\n\n');
      process.stderr.write(`Configs tested: ${overrideSets.length}\n`);
      process.stderr.write(`Strategy: ${args.sweepStrategy ?? 'lhs'}\n\n`);

      process.stderr.write('SENSITIVITY (Pearson r with composite score):\n');
      const sortedSens = Object.entries(sweepAnalysis.sensitivity).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      for (const [key, r] of sortedSens) {
        process.stderr.write(`  ${key.padEnd(35)} r = ${r > 0 ? '+' : ''}${r.toFixed(3)}\n`);
      }

      process.stderr.write('\nTOP 10 CONFIGS:\n');
      process.stderr.write('Rank  Score   SurvFit  Pacing  Food    GoldEff\n');
      process.stderr.write('─'.repeat(60) + '\n');
      for (const cfg of sweepAnalysis.topConfigs.slice(0, 10)) {
        process.stderr.write(
          `${String(cfg.rank).padStart(4)}  ${cfg.compositeScore.toFixed(3).padStart(6)}  ` +
          `${cfg.metricScores.survivalFit.toFixed(2).padStart(7)}  ` +
          `${cfg.metricScores.pacingFit.toFixed(2).padStart(6)}  ` +
          `${cfg.metricScores.foodFit.toFixed(2).padStart(6)}  ` +
          `${cfg.metricScores.goldEfficiencyFit.toFixed(2).padStart(7)}\n`
        );
      }

      if (sweepAnalysis.topConfigs.length > 0) {
        process.stderr.write('\nRECOMMENDED VALUES (from #1 config):\n');
        for (const [k, v] of Object.entries(sweepAnalysis.topConfigs[0].overrides)) {
          process.stderr.write(`  ${k}: ${JSON.stringify(v)}\n`);
        }
      }
    }

    sweepAnalysisOutput = {
      totalConfigsTested: overrideSets.length,
      strategy: args.sweepStrategy ?? 'lhs',
      sweepParams: DEFAULT_SWEEP_PARAMS.map(p => p.key),
      recommendation: sweepAnalysis.topConfigs[0]?.overrides ?? {},
      topConfigs: sweepAnalysis.topConfigs,
      sensitivity: sweepAnalysis.sensitivity,
      controlBaseline: sweepAnalysis.controlBaseline,
    };
  }

  const meta: AnalysisOutput['meta'] = {
    generatedAt: new Date().toISOString(),
    totalRuns,
    seedsPerConfig: seedCount,
    floors,
    elapsedMs,
    mode,
  };

  const output: AnalysisOutput = { meta, ...analysis, ...(sweepAnalysisOutput ? { sweepAnalysis: sweepAnalysisOutput } : {}) };

  // Attach deep analysis if available
  if (deepAccumulator) {
    output.deepAnalysis = deepAccumulator.getResults();
  }

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
    if (output.deepAnalysis) {
      printDeepSummary(output.deepAnalysis);
    }
  }
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
