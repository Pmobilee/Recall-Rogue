/**
 * Biome palette system — formal color definitions for per-biome visual consistency.
 * Phase 9 (DD-V2-237, DD-V2-272)
 */

/** Core 3-color palette used for biome identification. */
export interface BiomePalette {
  /** Primary fill color — 40-50% of visual surface (0xRRGGBB) */
  dominant: number
  /** Secondary highlight or detail color */
  accent: number
  /** Brightest point — specular, glow edge */
  highlight: number
}

/** Returns a CSS hex string from a 0xRRGGBB color number. */
export function toHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0')
}

/** Returns the approximate hue (0-360) of a 0xRRGGBB color. */
export function hue(color: number): number {
  const r = ((color >> 16) & 0xFF) / 255
  const g = ((color >> 8) & 0xFF) / 255
  const b = (color & 0xFF) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return Math.round(h)
}

/** Returns true if two hues are within threshold degrees of each other on the hue wheel. */
export function huesClash(h1: number, h2: number, threshold = 30): boolean {
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff) < threshold
}
