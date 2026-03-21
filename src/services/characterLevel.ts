// === Card Mechanic Unlock Schedule ===
// Maps character level -> mechanic IDs first unlocked at that level.
// Level 0 = all 31 existing mechanics (backward compatible) plus 5 new basics from AR-206 Phase 1.
// Each subsequent level adds a cohort of new mechanics.
// The mechanic IDs here are the canonical IDs used in MechanicDefinition.id — they MUST match exactly.

const MECHANIC_UNLOCK_SCHEDULE: Map<number, string[]> = new Map([
  [0, [
    // All 31 existing mechanics (backward compatible — unlockLevel: 0 in mechanics.ts)
    'strike', 'multi_hit', 'heavy_strike', 'piercing', 'reckless', 'execute', 'lifetap',
    'block', 'thorns', 'emergency', 'fortify', 'brace', 'overheal', 'parry',
    'empower', 'quicken', 'focus', 'double_strike',
    'weaken', 'expose', 'hex', 'slow',
    'cleanse', 'scout', 'recycle', 'foresight', 'transmute', 'immunity',
    'mirror', 'adapt', 'overclock',
    // 5 new basics from AR-206 Phase 1 (available from first run)
    'power_strike', 'iron_wave', 'reinforce', 'inscription_fury', 'inscription_iron',
  ]],
  [1,  ['bash', 'guard', 'sap', 'inscription_wisdom']],
  [2,  ['twin_strike', 'shrug_it_off', 'swap']],
  [3,  ['stagger', 'sift', 'riposte']],
  [4,  ['rupture', 'lacerate', 'scavenge', 'absorb', 'precision_strike']],
  [5,  ['kindle', 'ignite', 'corrode', 'overcharge', 'archive', 'reactive_shield']],
  [6,  ['gambit', 'curse_of_doubt', 'knowledge_ward', 'aegis_pulse', 'reflex', 'unstable_flux', 'chameleon', 'warcry']],
  [7,  ['burnout_shield', 'battle_trance', 'volatile_slash', 'corroding_touch', 'phase_shift', 'hemorrhage']],
  [8,  ['ironhide', 'war_drum', 'chain_lightning', 'dark_knowledge', 'mark_of_ignorance', 'sacrifice', 'recollect']],
  [9,  ['smite', 'entropy', 'bulwark', 'conversion', 'chain_anchor']],
  [10, ['feedback_loop', 'frenzy', 'aftershock', 'synapse', 'catalyst']],
  [11, ['recall', 'mastery_surge', 'tutor', 'mimic', 'siphon_strike']],
  [12, ['eruption']],
  [13, ['knowledge_bomb', 'siphon_knowledge']],
]);

/**
 * Returns all mechanic IDs available at the given character level.
 * Includes all mechanics unlocked at levels 0 through `level` (inclusive).
 *
 * @param level - The player's current character level (0-25).
 * @returns Set of mechanic IDs available for pool/reward/shop use.
 */
export function getUnlockedMechanics(level: number): Set<string> {
  const unlocked = new Set<string>();
  for (const [unlockLevel, ids] of MECHANIC_UNLOCK_SCHEDULE) {
    if (unlockLevel <= level) {
      for (const id of ids) unlocked.add(id);
    }
  }
  return unlocked;
}

/**
 * Returns the character level at which a specific mechanic first unlocks.
 * Returns 0 for all existing mechanics. Returns null if the mechanic ID is not in the schedule.
 *
 * @param mechanicId - The mechanic ID to look up.
 * @returns The unlock level (0-13), or null if not found.
 */
export function getMechanicUnlockLevel(mechanicId: string): number | null {
  for (const [level, ids] of MECHANIC_UNLOCK_SCHEDULE) {
    if (ids.includes(mechanicId)) return level;
  }
  return null;
}

// === Relic Unlock Schedule ===
// Maps character level -> relic IDs first available at that level.
// This mirrors the mechanic unlock pattern and gives a single query point for
// "what relics can a level-N player see in rewards / shop?".
// The underlying filtering is also applied directly via `r.unlockLevel` on each
// RelicDefinition in relicAcquisitionService — this map provides the same data
// for unit-testing and any future pool-builder queries.
//
// Level 0  — 5 expansion Commons (starter pool grows from 24 to 29)
// Level 1  — pocket_watch, chain_link_charm
// Level 2  — worn_shield, bleedstone, gladiator_s_mark
// Level 3  — ember_core, gambler_s_token
// Level 4  — thoughtform, scar_tissue, living_grimoire
// Level 5  — surge_capacitor, obsidian_dice
// Level 6  — red_fang, chronometer
// Level 7  — soul_jar, null_shard, hemorrhage_lens
// Level 8  — archive_codex, chain_forge
// Level 9  — berserker_s_oath, deja_vu, entropy_engine
// Level 10 — inferno_crown, mind_palace
// Level 11 — bloodstone_pendant, chromatic_chain
// Level 12 — volatile_manuscript, dragon_s_heart
// Level 20 — omniscience
// Level 21 — paradox_engine
// Level 22 — akashic_record
// Level 23 — singularity

const RELIC_UNLOCK_SCHEDULE: Map<number, string[]> = new Map([
  [0,  ['quick_study', 'thick_skin', 'tattered_notebook', 'battle_scars', 'brass_knuckles']],
  [1,  ['pocket_watch', 'chain_link_charm']],
  [2,  ['worn_shield', 'bleedstone', 'gladiator_s_mark']],
  [3,  ['ember_core', 'gambler_s_token']],
  [4,  ['thoughtform', 'scar_tissue', 'living_grimoire']],
  [5,  ['surge_capacitor', 'obsidian_dice']],
  [6,  ['red_fang', 'chronometer']],
  [7,  ['soul_jar', 'null_shard', 'hemorrhage_lens']],
  [8,  ['archive_codex', 'chain_forge']],
  [9,  ['berserker_s_oath', 'deja_vu', 'entropy_engine']],
  [10, ['inferno_crown', 'mind_palace']],
  [11, ['bloodstone_pendant', 'chromatic_chain']],
  [12, ['volatile_manuscript', 'dragon_s_heart']],
  [20, ['omniscience']],
  [21, ['paradox_engine']],
  [22, ['akashic_record']],
  [23, ['singularity']],
]);

/**
 * Returns all expansion relic IDs available at the given character level via
 * the expansion unlock schedule (pool relics, not level-reward relics).
 * Includes all relics unlocked at levels 0 through `level` (inclusive).
 *
 * Note: the 24 original starter relics (isStarter: true, no unlockLevel) are
 * always available and are NOT included in this set — they bypass level gating.
 * This function only covers the 36 expansion relics gated by level.
 *
 * @param level - The player's current character level (0-25).
 * @returns Set of expansion relic IDs eligible for pool/reward/shop use.
 */
export function getUnlockedRelics(level: number): Set<string> {
  const unlocked = new Set<string>();
  for (const [unlockLevel, ids] of RELIC_UNLOCK_SCHEDULE) {
    if (unlockLevel <= level) {
      for (const id of ids) unlocked.add(id);
    }
  }
  return unlocked;
}

/**
 * Returns the expansion unlock level for a given relic ID.
 * Returns null if the relic is not in the expansion unlock schedule
 * (i.e., it is a starter relic or a level-reward relic).
 *
 * @param relicId - The relic ID to look up.
 * @returns The unlock level (0-23), or null if not in the schedule.
 */
export function getRelicUnlockScheduleLevel(relicId: string): number | null {
  for (const [level, ids] of RELIC_UNLOCK_SCHEDULE) {
    if (ids.includes(relicId)) return level;
  }
  return null;
}

// === Character Leveling System ===
// XP-based progression with 25 levels. Relics unlock at specific levels.
// NO Phaser, Svelte, or DOM imports.

/** Max character level. */
export const MAX_LEVEL = 25;

/** XP curve constants. */
const XP_BASE = 80;
const XP_MULTIPLIER = 1.14;

/** XP required to advance from `level` to `level + 1`. Level 1 costs 80 XP. */
export function xpRequiredForLevel(level: number): number {
  if (level < 1 || level > MAX_LEVEL) return Infinity;
  return Math.round(XP_BASE * Math.pow(XP_MULTIPLIER, level - 1));
}

/** Cumulative XP needed to REACH a given level (from level 0). */
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpRequiredForLevel(i);
  return total;
}

// Pre-compute the cumulative thresholds for fast lookup
const LEVEL_THRESHOLDS: number[] = [];
for (let i = 0; i <= MAX_LEVEL; i++) LEVEL_THRESHOLDS.push(cumulativeXpForLevel(i));

/** Get current level from total accumulated XP (0 = no levels yet, 1-25 = leveled). */
export function getLevelFromXP(totalXP: number): number {
  for (let L = MAX_LEVEL; L >= 1; L--) {
    if (totalXP >= LEVEL_THRESHOLDS[L]) return L;
  }
  return 0;
}

/** Get detailed level progress info. */
export function getLevelProgress(totalXP: number): {
  level: number;
  xpIntoCurrentLevel: number;
  xpForNextLevel: number;
  progress: number; // 0-1
  isMaxLevel: boolean;
} {
  const level = getLevelFromXP(totalXP);
  if (level >= MAX_LEVEL) {
    return { level, xpIntoCurrentLevel: 0, xpForNextLevel: 0, progress: 1, isMaxLevel: true };
  }
  const currentThreshold = LEVEL_THRESHOLDS[level];
  const nextCost = xpRequiredForLevel(level + 1);
  const xpInto = totalXP - currentThreshold;
  return {
    level,
    xpIntoCurrentLevel: xpInto,
    xpForNextLevel: nextCost,
    progress: Math.min(1, xpInto / nextCost),
    isMaxLevel: false,
  };
}

// === Run XP Calculation ===

/** Stats collected during a run, used to compute XP. */
export interface RunXPStats {
  floorsCleared: number;
  combatsWon: number;
  elitesDefeated: number;
  miniBossesDefeated: number;
  bossesDefeated: number;
  questionsCorrect: number;
  questionsTotal: number;
  speedBonuses: number;       // answers in top 25% of timer
  maxStreak: number;          // longest correct streak
  newFactsEncountered: number;
  completedRun: boolean;      // cleared final boss / full clear
  retreated: boolean;         // retreated voluntarily
  ascensionLevel: number;
}

/** XP reward breakdown. */
export interface RunXPBreakdown {
  correctAnswers: number;
  speedBonuses: number;
  streakBonuses: number;
  floorsCleared: number;
  combatsWon: number;
  elitesDefeated: number;
  miniBossesDefeated: number;
  bossesDefeated: number;
  newFacts: number;
  completionBonus: number;
  subtotal: number;
  ascensionMultiplier: number;
  dailyBonus: number;
  total: number;
}

/**
 * Calculate XP earned from a run.
 * @param stats - Run statistics
 * @param isDailyFirstRun - Whether this is the player's first run today (+30% bonus)
 */
export function calculateRunXP(stats: RunXPStats, isDailyFirstRun: boolean): RunXPBreakdown {
  const correctAnswers = stats.questionsCorrect * 3;
  const speedBonuses = stats.speedBonuses * 1;
  // Streak bonus: +2 per correct answer beyond the 2nd in max streak (so streak of 5 = +6)
  const streakBonuses = Math.max(0, stats.maxStreak - 2) * 2;
  const floorsCleared = stats.floorsCleared * 8;
  const combatsWon = stats.combatsWon * 5;
  const elitesDefeated = stats.elitesDefeated * 15;
  const miniBossesDefeated = stats.miniBossesDefeated * 10;
  const bossesDefeated = stats.bossesDefeated * 15;
  const newFacts = stats.newFactsEncountered * 2;

  let completionBonus = 0;
  if (stats.completedRun) completionBonus = 25;
  else if (stats.retreated) completionBonus = 10;

  const subtotal = correctAnswers + speedBonuses + streakBonuses + floorsCleared +
    combatsWon + elitesDefeated + miniBossesDefeated + bossesDefeated + newFacts + completionBonus;

  // Ascension multiplier: x(1 + ascension * 0.1)
  const ascensionMult = 1 + stats.ascensionLevel * 0.1;
  const afterAscension = Math.round(subtotal * ascensionMult);

  // Daily first-run bonus: +30%
  const dailyMult = isDailyFirstRun ? 0.3 : 0;
  const dailyBonus = Math.round(afterAscension * dailyMult);

  const total = afterAscension + dailyBonus;

  return {
    correctAnswers,
    speedBonuses,
    streakBonuses,
    floorsCleared,
    combatsWon,
    elitesDefeated,
    miniBossesDefeated,
    bossesDefeated,
    newFacts,
    completionBonus,
    subtotal,
    ascensionMultiplier: ascensionMult,
    dailyBonus,
    total,
  };
}

// === Level Rewards ===

export interface LevelReward {
  relicIds: string[];
  dustBonus: number;
  title?: string;
  cosmetic?: string;
}

/**
 * Rewards granted when reaching each level.
 * Maps the 18 unlockable relics from src/data/relics/unlockable.ts across levels 1-24.
 */
const LEVEL_REWARDS: Record<number, LevelReward> = {
  1:  { relicIds: ['chain_reactor'], dustBonus: 0 },
  2:  { relicIds: [], dustBonus: 200 },
  3:  { relicIds: [], dustBonus: 300 },
  4:  { relicIds: [], dustBonus: 300 },
  5:  { relicIds: ['quicksilver_quill'], dustBonus: 0, title: 'Novice' },
  6:  { relicIds: ['time_warp'], dustBonus: 0 },
  7:  { relicIds: [], dustBonus: 400 },
  8:  { relicIds: ['crit_lens'], dustBonus: 0 },
  9:  { relicIds: [], dustBonus: 500 },
  10: { relicIds: ['thorn_crown'], dustBonus: 0, cosmetic: 'cardback-bronze' },
  11: { relicIds: ['bastions_will'], dustBonus: 0 },
  12: { relicIds: [], dustBonus: 600 },
  13: { relicIds: ['festering_wound'], dustBonus: 0 },
  14: { relicIds: ['capacitor'], dustBonus: 0 },
  15: { relicIds: ['double_down'], dustBonus: 0, title: 'Adept' },
  16: { relicIds: ['scholars_crown'], dustBonus: 0 },
  17: { relicIds: [], dustBonus: 800 },
  18: { relicIds: ['domain_mastery_sigil', 'phoenix_feather'], dustBonus: 0 },
  19: { relicIds: [], dustBonus: 1000 },
  20: { relicIds: ['scholars_gambit', 'prismatic_shard'], dustBonus: 0, title: 'Master' },
  21: { relicIds: [], dustBonus: 0, cosmetic: 'cardframe-gold' },
  22: { relicIds: ['mirror_of_knowledge'], dustBonus: 0 },
  23: { relicIds: [], dustBonus: 0, title: 'Sage' },
  24: { relicIds: ['toxic_bloom'], dustBonus: 0 },
  25: { relicIds: [], dustBonus: 0, title: 'Grand Scholar', cosmetic: 'legendary-frame' },
};

/** Get the reward for a specific level. */
export function getLevelReward(level: number): LevelReward | null {
  return LEVEL_REWARDS[level] ?? null;
}

/** Get all relic IDs unlocked up to and including the given level. */
export function getUnlockedRelicIds(level: number): string[] {
  const ids: string[] = [];
  for (let L = 1; L <= Math.min(level, MAX_LEVEL); L++) {
    const reward = LEVEL_REWARDS[L];
    if (reward) ids.push(...reward.relicIds);
  }
  return ids;
}

/** Get the level at which a specific relic unlocks. Returns null if not a level-gated relic. */
export function getRelicUnlockLevel(relicId: string): number | null {
  for (let L = 1; L <= MAX_LEVEL; L++) {
    const reward = LEVEL_REWARDS[L];
    if (reward?.relicIds.includes(relicId)) return L;
  }
  return null;
}

/**
 * Process XP gain and determine level-up results.
 * Pure function — does not mutate any state.
 */
export function processXPGain(
  currentTotalXP: number,
  xpEarned: number,
): {
  newTotalXP: number;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
  rewards: LevelReward[];
  totalDustAwarded: number;
  relicsUnlocked: string[];
} {
  const oldLevel = getLevelFromXP(currentTotalXP);
  const newTotalXP = currentTotalXP + xpEarned;
  const newLevel = getLevelFromXP(newTotalXP);
  const levelsGained = newLevel - oldLevel;

  const rewards: LevelReward[] = [];
  let totalDustAwarded = 0;
  const relicsUnlocked: string[] = [];

  for (let L = oldLevel + 1; L <= newLevel; L++) {
    const reward = LEVEL_REWARDS[L];
    if (reward) {
      rewards.push(reward);
      totalDustAwarded += reward.dustBonus;
      relicsUnlocked.push(...reward.relicIds);
    }
  }

  return { newTotalXP, oldLevel, newLevel, levelsGained, rewards, totalDustAwarded, relicsUnlocked };
}
