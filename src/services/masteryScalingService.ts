import type { ReviewState } from '../data/types';
import type { DeckMode } from '../data/studyPreset';
import { MASTERY_SCALING } from '../data/balance';
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
