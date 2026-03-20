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

// ---------------------------------------------------------------------------
// Deprecated: legacy sprite system — still used by HubScreen.svelte
// ---------------------------------------------------------------------------

/** @deprecated Use getCampUpgradeUrl instead. */
export type CampSpriteId =
  | 'dungeon-gate' | 'bookshelf' | 'signpost' | 'anvil'
  | 'campfire' | 'tent' | 'character' | 'cat'
  | 'journal' | 'quest-board' | 'treasure-chest' | 'scroll'

/** @deprecated Use getCampUpgradeUrl instead. Returns the URL for a camp scene sprite by its ID. */
export function getCampSpriteUrl(id: CampSpriteId): string {
  return `/assets/camp/sprites/${id}/${id}-base.png`
}

/** @deprecated No-op. The tier-based system requires no async initialisation. */
export function initCampArtManifest(): Promise<void> {
  return Promise.resolve()
}
