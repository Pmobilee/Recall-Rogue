/**
 * Geography Elo Rating Service for Map Pin Drop quiz mode.
 *
 * Tracks the player's geography rating using a continuous-accuracy Elo formula.
 * Unlike chess (binary correct/wrong), geography uses a 0.0–1.0 accuracy score
 * derived from pin drop distance (see geoScoringService.ts).
 *
 * Each location has a difficulty tier (1–5), mapped to an Elo rating.
 * Player and per-region ratings are persisted to PlayerSave.
 *
 * Elo formula:
 *   expectedScore = 1 / (1 + 10^((locationRating - playerRating) / 400))
 *   newRating = oldRating + K * (accuracy - expectedScore)
 *   where accuracy ∈ [0.0, 1.0] (continuous, not binary)
 *   K-factor = 24
 */

import { get } from 'svelte/store';
import { playerSave } from '../ui/stores/playerData';
import type { PlayerSave } from '../data/types';

/** Starting Elo for new geography players. */
export const GEO_ELO_START = 1200;

/** K-factor: how much each location affects rating. 24 = moderate learning rate. */
export const GEO_ELO_K_FACTOR = 24;

/** Minimum Elo floor. */
export const GEO_ELO_MIN = 400;

/** Maximum Elo ceiling. */
export const GEO_ELO_MAX = 2400;

/**
 * Map a location difficulty tier to an Elo rating.
 * tier 1 = 800 (easy: Paris, London, New York)
 * tier 2 = 1000
 * tier 3 = 1200 (medium: regional capitals)
 * tier 4 = 1400
 * tier 5 = 1600 (hard: Dushanbe, Nur-Sultan, Vientiane)
 */
export function tierToRating(tier: number): number {
  return 600 + tier * 200;
}

/**
 * Calculate the expected accuracy score for a player vs a location.
 * Returns a value between 0 and 1 (probability of a perfect placement).
 */
export function expectedScore(playerRating: number, locationRating: number): number {
  return 1 / (1 + Math.pow(10, (locationRating - playerRating) / 400));
}

/**
 * Calculate new Elo rating after a geography pin drop quiz.
 * Uses continuous accuracy (0.0–1.0) rather than binary correct/wrong.
 *
 * @param playerRating Current player geography Elo.
 * @param locationRating Elo rating of the location (from tierToRating).
 * @param accuracy Accuracy score 0.0–1.0 from geoScoringService.calculateGeoAccuracy.
 * @returns New rating (clamped) and the rating change.
 */
export function calculateGeoRating(
  playerRating: number,
  locationRating: number,
  accuracy: number,
): { newRating: number; ratingChange: number } {
  const expected = expectedScore(playerRating, locationRating);
  const change = Math.round(GEO_ELO_K_FACTOR * (accuracy - expected));
  const newRating = Math.max(GEO_ELO_MIN, Math.min(GEO_ELO_MAX, playerRating + change));
  return { newRating, ratingChange: newRating - playerRating };
}

/**
 * Get the player's current geography Elo from the save.
 * Returns GEO_ELO_START (1200) for new players.
 */
export function getGeoElo(): number {
  const save = get(playerSave);
  return save?.geoEloRating ?? GEO_ELO_START;
}

/**
 * Get the player's Elo for a specific geographic region.
 * Returns GEO_ELO_START if no region-specific rating exists.
 */
export function getGeoRegionRating(region: string): number {
  const save = get(playerSave);
  return save?.geoRegionRatings?.[region] ?? GEO_ELO_START;
}

/**
 * Update the player's geography Elo after a pin drop quiz.
 * Updates both the global rating and the per-region rating (if provided).
 * Persists to PlayerSave.
 *
 * @param locationRating Elo rating of the location (from tierToRating).
 * @param accuracy Accuracy score 0.0–1.0.
 * @param distanceKm Distance from correct location in km (stored in history).
 * @param region Optional region key for per-region rating tracking.
 * @returns Old rating, new rating, and rating change.
 */
export function updateGeoElo(
  locationRating: number,
  accuracy: number,
  distanceKm: number = 0,
  region?: string,
): { newRating: number; ratingChange: number; oldRating: number } {
  const oldRating = getGeoElo();
  const { newRating, ratingChange } = calculateGeoRating(oldRating, locationRating, accuracy);

  playerSave.update((save): PlayerSave | null => {
    if (!save) return save;

    // Compute per-region ratings update if a region is provided
    let updatedRegionRatings: Record<string, number> | undefined = save.geoRegionRatings;
    if (region) {
      const regionRatings = { ...(save.geoRegionRatings ?? {}) };
      const oldRegion = regionRatings[region] ?? GEO_ELO_START;
      const { newRating: newRegion } = calculateGeoRating(oldRegion, locationRating, accuracy);
      regionRatings[region] = newRegion;
      updatedRegionRatings = regionRatings;
    }

    return {
      ...save,
      geoEloRating: newRating,
      geoEloHistory: [
        ...(save.geoEloHistory ?? []).slice(-99),
        { rating: newRating, accuracy, distanceKm, timestamp: Date.now() },
      ],
      geoRegionRatings: updatedRegionRatings,
    };
  });

  return { newRating, ratingChange, oldRating };
}

/**
 * Get a display label for a geography Elo rating.
 */
export function getGeoEloLabel(rating: number): string {
  if (rating < 800) return 'Novice';
  if (rating < 1000) return 'Explorer';
  if (rating < 1200) return 'Navigator';
  if (rating < 1400) return 'Cartographer';
  if (rating < 1600) return 'Geographer';
  if (rating < 1800) return 'Atlas Master';
  return 'World Oracle';
}
