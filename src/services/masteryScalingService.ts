import type { ReviewState } from '../data/types';
import type { DeckMode } from '../data/studyPreset';
import {
  LOW_NOVELTY_REWARD_MULTIPLIER,
  LOW_NOVELTY_THRESHOLD,
  MASTERY_SCALING,
  POOL_SIZE_REWARD_MULTIPLIERS,
  TINY_POOL_REWARD_SUPPRESSION_THRESHOLD,
} from '../data/balance';
import { getCardTier } from './tierDerivation';
import { getPresetById } from './studyPresetService';

/**
 * Calculates the mastery percentage for a set of fact IDs.
 * Mastery is defined as the fraction of facts at tier 2b or tier 3.
 *
 * @param factIds - The fact IDs in the deck/pool.
 * @param reviewStates - All review states for the player.
 * @returns A number between 0 and 1 representing mastery percentage.
 */
export function calculateDeckMastery(
  factIds: string[],
  reviewStates: ReviewState[]
): number {
  if (factIds.length === 0) return 0;

  const stateMap = new Map<string, ReviewState>();
  for (const rs of reviewStates) {
    stateMap.set(rs.factId, rs);
  }

  let masteredCount = 0;
  for (const id of factIds) {
    const state = stateMap.get(id);
    const tier = getCardTier(state);
    if (tier === '2b' || tier === '3') {
      masteredCount++;
    }
  }

  return masteredCount / factIds.length;
}

/**
 * Determines which mastery scaling tier applies for a given mastery percentage.
 *
 * @param masteryPct - Mastery percentage (0-1).
 * @returns The scaling tier label.
 */
export function getMasteryScalingTier(
  masteryPct: number
): 'normal' | 'practiced' | 'expert' | 'mastered' {
  const thresholds = MASTERY_SCALING.thresholds;
  if (masteryPct >= thresholds[3]!) return 'mastered';
  if (masteryPct >= thresholds[2]!) return 'expert';
  if (masteryPct >= thresholds[1]!) return 'practiced';
  return 'normal';
}

/**
 * Returns the reward multiplier for a given mastery percentage.
 * Higher mastery yields lower rewards to discourage farming easy content.
 *
 * @param masteryPct - Mastery percentage (0-1).
 * @returns Reward multiplier (1.0 = full rewards, lower = reduced).
 */
export function getRewardMultiplier(masteryPct: number): number {
  const { thresholds, rewardMultipliers } = MASTERY_SCALING;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (masteryPct >= thresholds[i]!) {
      return rewardMultipliers[i]!;
    }
  }
  return 1.0;
}

/**
 * Returns the anti-farm reward multiplier based on selected pool size.
 */
export function getPoolSizeRewardMultiplier(poolFactCount: number): number {
  const safeCount = Math.max(0, Math.floor(poolFactCount));
  for (const tier of POOL_SIZE_REWARD_MULTIPLIERS) {
    if (safeCount >= tier.minFacts) {
      return tier.multiplier;
    }
  }
  return 1.0;
}

/**
 * Applies an extra modest reduction when novelty is very low.
 */
export function getNoveltyRewardMultiplier(novelFactPct: number): number {
  if (novelFactPct < LOW_NOVELTY_THRESHOLD) {
    return LOW_NOVELTY_REWARD_MULTIPLIER;
  }
  return 1.0;
}

/**
 * Extremely tiny pools are not eligible for rewards (anti-farm failsafe).
 */
export function shouldSuppressRewardsForTinyPool(poolFactCount: number): boolean {
  return Math.max(0, Math.floor(poolFactCount)) < TINY_POOL_REWARD_SUPPRESSION_THRESHOLD;
}

/**
 * Combined pool-size and novelty multiplier.
 */
export function getCombinedPoolRewardMultiplier(
  poolFactCount: number,
  novelFactPct: number,
): number {
  return getPoolSizeRewardMultiplier(poolFactCount) * getNoveltyRewardMultiplier(novelFactPct);
}

/**
 * Returns the number of extra virtual difficulty floors for a given mastery percentage.
 * Makes highly-mastered content harder to keep it challenging.
 *
 * @param masteryPct - Mastery percentage (0-1).
 * @returns Number of additional difficulty floors to add.
 */
export function getDifficultyBoostFloors(masteryPct: number): number {
  const { thresholds, difficultyBoostFloors } = MASTERY_SCALING;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (masteryPct >= thresholds[i]!) {
      return difficultyBoostFloors[i]!;
    }
  }
  return 0;
}

/**
 * Determines leaderboard eligibility based on the deck mode.
 *
 * - General mode: eligible under 'general' leaderboard.
 * - Preset mode: eligible under 'domain:{domainId}' if the preset selects
 *   exactly one domain with all subcategories; otherwise ineligible (null).
 * - Language mode: eligible under 'language:{code}'.
 *
 * @param deckMode - The active deck mode.
 * @returns Leaderboard key string, or null if ineligible.
 */
export function getLeaderboardEligibility(deckMode: DeckMode): string | null {
  if (deckMode.type === 'general') {
    return 'general';
  }

  if (deckMode.type === 'language') {
    return `language:${deckMode.languageCode}`;
  }

  // Trivia/study/procedural/custom_deck/study-multi modes: not yet eligible for leaderboards.
  if (deckMode.type === 'trivia' || deckMode.type === 'study' || deckMode.type === 'procedural' || deckMode.type === 'custom_deck' || deckMode.type === 'study-multi') {
    return null;
  }

  // Preset mode: check if it's a single-domain, all-subcategories preset
  const preset = getPresetById(deckMode.presetId);
  if (!preset) return null;

  const domains = Object.keys(preset.domainSelections);
  if (domains.length !== 1) return null;

  const domainId = domains[0]!;
  const subcategories = preset.domainSelections[domainId]!;

  // Empty array means "all subcategories" — eligible for domain leaderboard
  if (subcategories.length === 0) {
    return `domain:${domainId}`;
  }

  return null;
}

/**
 * Determines if a run qualifies as a "practice run" where the player
 * already knew the material, disabling camp rewards.
 */
export function isPracticeRun(runState: {
  questionsAnswered?: number;
  questionsCorrect?: number;
  novelQuestionsAnswered?: number;
  novelQuestionsCorrect?: number;
  practiceRunDetected?: boolean;
}): boolean {
  // Already flagged from pre-run mastery check
  if (runState.practiceRunDetected) return true;

  const answered = runState.questionsAnswered ?? 0;
  const correct = runState.questionsCorrect ?? 0;
  const novelAnswered = runState.novelQuestionsAnswered ?? 0;
  const novelCorrect = runState.novelQuestionsCorrect ?? 0;

  // Need minimum 5 questions to evaluate
  if (answered < 5) return false;

  // Perfect run (zero wrong answers)
  if (correct === answered) return true;

  // Overall accuracy > 85%
  if (correct / answered > 0.85) return true;

  // Novel fact accuracy > 80% (with minimum 3 novel facts)
  if (novelAnswered >= 3 && novelCorrect / novelAnswered > 0.80) return true;

  return false;
}

/**
 * Calculates the percentage of facts in the pool that are at tier 1 (new/learning).
 * Used to warn players when their pool is too heavily mastered.
 *
 * @param factIds - The fact IDs in the deck/pool.
 * @param reviewStates - All review states for the player.
 * @returns A number between 0 and 1 representing the novel fact percentage.
 */
export function getNovelFactPercentage(
  factIds: string[],
  reviewStates: ReviewState[]
): number {
  if (factIds.length === 0) return 0;

  const stateMap = new Map<string, ReviewState>();
  for (const rs of reviewStates) {
    stateMap.set(rs.factId, rs);
  }

  let novelCount = 0;
  for (const id of factIds) {
    const state = stateMap.get(id);
    const tier = getCardTier(state);
    if (tier === '1') {
      novelCount++;
    }
  }

  return novelCount / factIds.length;
}
