/**
 * Geography distance scoring for Map Pin Drop quiz mode.
 *
 * Uses Haversine formula for great-circle distance, then maps distance
 * to a 0.0-1.0 accuracy score based on mastery-scaled thresholds.
 *
 * Mastery 0 is very forgiving (full credit within 500 km).
 * Mastery 5 is precise (full credit only within 40 km).
 */

/** Mastery-scaled scoring thresholds. */
export interface GeoScoringThresholds {
  fullCreditRadiusKm: number;
  partialFloorKm: number;
}

/**
 * Per-mastery scoring thresholds.
 * fullCreditRadiusKm: distance within which the player earns full credit (1.0).
 * partialFloorKm: distance beyond which the player earns zero credit (0.0).
 * Between the two: linear interpolation.
 */
const MASTERY_THRESHOLDS: GeoScoringThresholds[] = [
  { fullCreditRadiusKm: 500, partialFloorKm: 1500 }, // mastery 0
  { fullCreditRadiusKm: 350, partialFloorKm: 1000 }, // mastery 1
  { fullCreditRadiusKm: 250, partialFloorKm: 750 },  // mastery 2
  { fullCreditRadiusKm: 150, partialFloorKm: 500 },  // mastery 3
  { fullCreditRadiusKm: 80,  partialFloorKm: 300 },  // mastery 4
  { fullCreditRadiusKm: 40,  partialFloorKm: 150 },  // mastery 5
];

/**
 * Get scoring thresholds for a given mastery level.
 * Clamps out-of-range values to [0, 5].
 */
export function getGeoThresholds(masteryLevel: number): GeoScoringThresholds {
  return MASTERY_THRESHOLDS[Math.min(Math.max(0, masteryLevel), 5)];
}

/**
 * Calculate great-circle distance between two lat/lng points using the Haversine formula.
 * @param lat1 Latitude of point 1 in decimal degrees.
 * @param lng1 Longitude of point 1 in decimal degrees.
 * @param lat2 Latitude of point 2 in decimal degrees.
 * @param lng2 Longitude of point 2 in decimal degrees.
 * @returns Distance in kilometers.
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate accuracy score (0.0–1.0) from a pin drop distance and mastery level.
 *
 * Scoring rules:
 * - Within fullCreditRadius → 1.0 (perfect)
 * - Beyond partialFloor → 0.0 (no credit)
 * - Between the two → linear interpolation
 *
 * @param distanceKm Distance from correct location in kilometres.
 * @param masteryLevel Card mastery level (0–5).
 * @returns Accuracy score between 0.0 and 1.0 inclusive.
 */
export function calculateGeoAccuracy(distanceKm: number, masteryLevel: number): number {
  const t = getGeoThresholds(masteryLevel);
  if (distanceKm <= t.fullCreditRadiusKm) return 1.0;
  if (distanceKm >= t.partialFloorKm) return 0.0;
  return 1.0 - (distanceKm - t.fullCreditRadiusKm) / (t.partialFloorKm - t.fullCreditRadiusKm);
}
