/**
 * SVG path data for chain type icons.
 * Each path is designed for a 24×24 viewBox.
 * Used with fill="currentColor" so color is set via CSS or inline style.
 */

/** SVG path data for each chain type index (0–5). */
export const CHAIN_ICON_PATHS: Record<number, string> = {
  // 0: Obsidian — Diamond (rotated square)
  0: 'M12 2L22 12L12 22L2 12Z',

  // 1: Crimson — Flame (simple fire shape)
  1: 'M12 2C12 2 8 7 8 10C8 10 6 8 7 6C5 8 4 11 4 14C4 18.4 7.6 22 12 22C16.4 22 20 18.4 20 14C20 10 16 6 12 2ZM12 19C10.3 19 9 17.7 9 16C9 14.7 10 13 12 11C14 13 15 14.7 15 16C15 17.7 13.7 19 12 19Z',

  // 2: Azure — Droplet (water drop / inverted teardrop)
  2: 'M12 2L5.5 12.5C4.5 14.2 4 15.6 4 17C4 20.3 7.1 23 12 23C16.9 23 20 20.3 20 17C20 15.6 19.5 14.2 18.5 12.5L12 2Z',

  // 3: Amber — Star (5-point)
  3: 'M12 2L14.4 9H22L15.8 13.5L18.2 20.5L12 16L5.8 20.5L8.2 13.5L2 9H9.6Z',

  // 4: Violet — Crescent (half-moon)
  4: 'M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C13.85 21 15.57 20.46 17 19.54C14.21 19.85 11.25 18.95 9.05 16.95C5.92 14.09 5.34 9.5 7.5 5.97C8.86 4.14 10.34 3.28 12 3Z',

  // 5: Jade — Leaf (simple leaf with stem)
  5: 'M17 8C8 10 5.9 16.17 3.82 21C5.8 21 9 20 11 17C11 17 7 19 7 15C10 11 15 10 17 8ZM21 3C21 3 13 4 12 12C12 14 14 16 16 15C14 15 13 13 13 12C13 9 16 5 21 3Z',
}

/**
 * Returns the SVG path string for a given chain type index.
 * Falls back to the Obsidian (diamond) path if the index is unrecognised.
 *
 * @param chainType - Chain type index (0–5).
 * @returns SVG path `d` attribute value.
 */
export function getChainIconPath(chainType: number): string {
  return CHAIN_ICON_PATHS[chainType] ?? CHAIN_ICON_PATHS[0]
}
