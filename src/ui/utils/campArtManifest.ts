import type { CampElement } from '../stores/campState'

/**
 * Per-element sprite file mapping: ARRAY INDEX = logical tier (0..maxTier),
 * VALUE = actual file number in /assets/camp/upgrades/{element}/tier-{n}.webp.
 *
 * Several element directories have numeric gaps due to art pipeline history
 * (pet/tier-3, campfire/tier-1, journal/tier-3 were never generated).
 * This mapping lets the UI pick the closest real file rather than requesting
 * a 404. The array length - 1 equals the logical max tier for that element.
 *
 * Exported so a lint script can validate it against files on disk.
 */
export const CAMP_UPGRADE_TIER_FILES: Record<CampElement, readonly number[]> = {
  tent:       [0, 1, 2, 3, 4, 5, 6],  // 7 entries → max tier 6
  character:  [0, 1, 2, 3, 4, 5, 6],  // 7 entries → max tier 6
  pet:        [0, 1, 2, 4, 5, 6],     // 6 entries → max tier 5 (tier-3.webp missing)
  campfire:   [0, 2, 3, 4, 5, 6],     // 6 entries → max tier 5 (tier-1.webp missing)
  library:    [0, 1, 2, 3, 4, 5],     // 6 entries → max tier 5 (tier-6.webp orphaned)
  questboard: [0, 1, 2, 3, 4, 5, 6],  // 7 entries → max tier 6
  shop:       [0, 1, 2, 3, 4, 5, 6],  // 7 entries → max tier 6
  journal:    [0, 1, 2, 4, 5, 6],     // 6 entries → max tier 5 (tier-3.webp missing; was max 6)
  doorway:    [0, 1, 2, 3, 4, 5, 6],  // 7 entries → max tier 6
}

/**
 * Returns the URL for a camp element sprite at the given upgrade tier.
 * Clamps tier to [0, maxLogicalTier] and resolves through the per-element
 * file mapping so we never request a webp that does not exist on disk.
 */
export function getCampUpgradeUrl(element: CampElement, tier: number): string {
  const files = CAMP_UPGRADE_TIER_FILES[element]
  const clamped = Math.max(0, Math.min(files.length - 1, tier))
  const fileNumber = files[clamped]
  return `/assets/camp/upgrades/${element}/tier-${fileNumber}.webp`
}

/** Returns the URL for the camp background (portrait). */
export function getCampBackgroundUrl(): string {
  return '/assets/camp/upgrades/background/base.webp'
}

/** Returns the URL for the wide (16:9) camp background used in landscape mode. */
export function getCampBackgroundWideUrl(): string {
  return '/assets/camp/sprites/background/camp-background-wide.jpg'
}

/** Returns the URL for the settings element (never upgrades). */
export function getCampSettingsUrl(): string {
  return '/assets/camp/upgrades/settings/tier-0.webp'
}
