/**
 * Card Frame V2 — layered rendering system.
 * Uses pre-generated hue-shifted border and banner layers.
 *
 * Layer order (bottom → top):
 *   1. Border  — colored by card type (attack/shield/buff/debuff/utility/wild)
 *   2. Base    — constant transparent-windowed frame sits on top
 *   3. Banner  — colored by chain type (0–5)
 *   4. Upgrade — green cross icon, float-animated, shown only on upgraded cards
 */

import type { CardType } from '../../data/card-types'

/** Canvas dimensions of the PSD source (used for percentage calculations). */
export const FRAME_WIDTH = 886
export const FRAME_HEIGHT = 1142

// Asset base paths — cache bust v2 to force reload after banner color updates
const V2_BASE = '/assets/cardframes/v2'
const V2_LOWRES = '/assets/cardframes/v2/lowres'
const CB = `?v=${Date.now()}`

// Border filename by card type
const BORDER_MAP: Record<CardType, string> = {
  attack: 'card-border-attack.webp',
  shield: 'card-border-shield.webp',
  buff: 'card-border-buff.webp',
  debuff: 'card-border-debuff.webp',
  utility: 'card-border-utility.webp',
  wild: 'card-border-wild.webp',
}

// Banner filename by chain type (0–5)
const BANNER_MAP: Record<number, string> = {
  0: 'card-banner-chain0.webp',
  1: 'card-banner-chain1.webp',
  2: 'card-banner-chain2.webp',
  3: 'card-banner-chain3.webp',
  4: 'card-banner-chain4.webp',
  5: 'card-banner-chain5.webp',
}

/** Get URL for the base frame layer (constant, sits over the border). */
export function getBaseFrameUrl(lowres = false): string {
  return `${lowres ? V2_LOWRES : V2_BASE}/card-frame-base.webp${CB}`
}

/** Get URL for the border layer, selected by card type. */
export function getBorderUrl(cardType: CardType, lowres = false): string {
  const file = BORDER_MAP[cardType] ?? BORDER_MAP.attack
  return `${lowres ? V2_LOWRES : V2_BASE}/${file}${CB}`
}

/** Get URL for the banner layer, selected by chain type (0–5). */
export function getBannerUrl(chainType: number, lowres = false): string {
  const file = BANNER_MAP[chainType] ?? BANNER_MAP[0]
  return `${lowres ? V2_LOWRES : V2_BASE}/${file}${CB}`
}

/** Get URL for the upgrade icon layer (shown only when card.isUpgraded). */
export function getUpgradeIconUrl(lowres = false): string {
  return `${lowres ? V2_LOWRES : V2_BASE}/card-upgrade-icon.webp${CB}`
}

/**
 * CSS filter to colorize the upgrade icon for each mastery level.
 * Base icon is green. Returns empty string for level 0 (no icon shown).
 */
export function getMasteryIconFilter(level: number): string {
  switch (level) {
    case 1: return '' // green (base color, no filter)
    case 2: return 'hue-rotate(100deg) saturate(1.2)' // blue
    case 3: return 'hue-rotate(200deg) saturate(1.3)' // purple
    case 4: return 'hue-rotate(-40deg) saturate(1.5) brightness(1.1)' // orange
    case 5: return 'hue-rotate(60deg) saturate(2) brightness(1.3)' // gold
    default: return ''
  }
}

/** Whether a mastery level should show the gold glow effect. */
export function hasMasteryGlow(level: number): boolean {
  return level >= 5
}

/**
 * Compute an `inline style` string that absolutely-positions a text overlay
 * using the guide coordinates from manifest.json as percentages of the canvas.
 *
 * @param x      Guide left edge in PSD pixels
 * @param y      Guide top edge in PSD pixels
 * @param w      Guide width in PSD pixels
 * @param h      Guide height in PSD pixels
 */
export function guideStyle(x: number, y: number, w: number, h: number): string {
  const left = ((x / FRAME_WIDTH) * 100).toFixed(3)
  const top = ((y / FRAME_HEIGHT) * 100).toFixed(3)
  const width = ((w / FRAME_WIDTH) * 100).toFixed(3)
  const height = ((h / FRAME_HEIGHT) * 100).toFixed(3)
  return `left:${left}%;top:${top}%;width:${width}%;height:${height}%;`
}

/**
 * Pre-computed guide positions as inline style strings derived from manifest.json.
 * All coordinates are percentages of the 886×1142 canvas.
 *
 * Manifest pixel values:
 *   apCost       { x:18,  y:10,  w:164, h:160 }  — shifted higher + taller for AP number visibility
 *   mechanicName { x:205, y:112, w:478, h:86  }  — lowered title to sit centered on ribbon
 *   artWindow    { x:194, y:186, w:498, h:412 }
 *   cardType     { x:352, y:615, w:182, h:54  }
 *   effectText   { x:134, y:672, w:640, h:366 }  — shifted down slightly for better spacing below art
 */
export const GUIDE_STYLES = {
  apCost: guideStyle(18, 10, 164, 160),
  mechanicName: guideStyle(205, 112, 478, 86),
  artWindow: guideStyle(194, 186, 498, 412),
  cardType: guideStyle(243, 608, 400, 70),
  /** Pill-shaped chain color indicator — matches the frame's small oval cutout exactly */
  cardTypePill: guideStyle(403, 628, 80, 28),
  effectText: guideStyle(134, 672, 640, 366),
} as const
