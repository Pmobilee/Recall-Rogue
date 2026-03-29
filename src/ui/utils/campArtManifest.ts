import type { CampElement } from '../stores/campState'

/** Returns the URL for a camp element sprite at the given upgrade tier. */
export function getCampUpgradeUrl(element: CampElement, tier: number): string {
  return `/assets/camp/upgrades/${element}/tier-${tier}.webp`
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
