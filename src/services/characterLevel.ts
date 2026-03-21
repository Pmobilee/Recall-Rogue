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
