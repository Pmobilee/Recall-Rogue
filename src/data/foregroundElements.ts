/**
 * Foreground parallax element configuration data.
 *
 * Defines per-biome element pools for the ForegroundParallaxSystem.
 * Elements are placed at anchor slots near screen edges (never in center)
 * to preserve enemy visibility and avoid obscuring card hand UI.
 *
 * Asset pipeline: real sprites go in src/assets/sprites/foreground/ as
 * fg_[name].png (64×128 or 128×128px, transparent PNG).
 * Until real assets exist, ForegroundParallaxSystem generates procedural
 * placeholder textures via Phaser Graphics.generateTexture().
 *
 * @see src/game/systems/ForegroundParallaxSystem.ts
 * @see docs/immersion/07-foreground-parallax.md
 */

import type { FloorTheme } from './roomAtmosphere'
import { getDeviceTier } from '../services/deviceTierService'

/** Canonical anchor positions — all within 120px of screen edges. */
export type AnchorSlot =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'

/**
 * Configuration for a single foreground overlay element.
 * Position is resolved at runtime from anchorSlot + viewport dimensions
 * so it stays edge-anchored across all screen sizes.
 */
export interface ForegroundElementConfig {
  /** Phaser texture key (procedural placeholder or real PNG asset). */
  key: string
  /** Canonical edge anchor — determines base (x, y) at runtime. */
  anchorSlot: AnchorSlot
  /** Base alpha (0–1). Breathing drift does NOT affect alpha. */
  alpha: number
  /** Scale relative to native texture size. */
  scale: number
  /** Phase offset for idle breathing (radians, 0–2π). Prevents lockstep oscillation. */
  idlePhaseOffset: number
  /** Flip sprite horizontally (useful for mirroring the same asset). */
  flipX?: boolean
}

/**
 * Per-biome element pools.
 * The system picks N elements without replacement each encounter,
 * where N depends on device tier (low=1, mid=2, flagship=3).
 *
 * Preferred 2-element pair: top-left + bottom-right (visual weight balance).
 */
export const FOREGROUND_ELEMENTS: Record<FloorTheme, ForegroundElementConfig[]> = {
  dust: [
    {
      key: 'fg_cobweb',
      anchorSlot: 'top-left',
      alpha: 0.35,
      scale: 1.0,
      idlePhaseOffset: 0,
    },
    {
      key: 'fg_chain_hang',
      anchorSlot: 'top-right',
      alpha: 0.45,
      scale: 1.0,
      idlePhaseOffset: 1.2,
    },
    {
      key: 'fg_rock_crack',
      anchorSlot: 'bottom-left',
      alpha: 0.40,
      scale: 1.0,
      idlePhaseOffset: 2.4,
    },
    {
      key: 'fg_moss_drip',
      anchorSlot: 'bottom-right',
      alpha: 0.30,
      scale: 1.0,
      idlePhaseOffset: 3.6,
      flipX: true,
    },
  ],
  embers: [
    {
      key: 'fg_ash_edge',
      anchorSlot: 'top-left',
      alpha: 0.40,
      scale: 1.0,
      idlePhaseOffset: 0.5,
    },
    {
      key: 'fg_cracked_stone',
      anchorSlot: 'top-right',
      alpha: 0.50,
      scale: 1.0,
      idlePhaseOffset: 1.8,
    },
    {
      key: 'fg_rock_crack',
      anchorSlot: 'bottom-right',
      alpha: 0.35,
      scale: 1.1,
      idlePhaseOffset: 3.0,
      flipX: true,
    },
  ],
  ice: [
    {
      key: 'fg_icicle_top',
      anchorSlot: 'top-center',
      alpha: 0.55,
      scale: 1.0,
      idlePhaseOffset: 0,
    },
    {
      key: 'fg_frost_edge',
      anchorSlot: 'top-left',
      alpha: 0.35,
      scale: 1.0,
      idlePhaseOffset: 1.5,
    },
    {
      key: 'fg_crystal_shard',
      anchorSlot: 'bottom-right',
      alpha: 0.45,
      scale: 1.0,
      idlePhaseOffset: 3.0,
    },
  ],
  arcane: [
    {
      key: 'fg_rune_edge',
      anchorSlot: 'top-right',
      alpha: 0.40,
      scale: 1.0,
      idlePhaseOffset: 0.3,
    },
    {
      key: 'fg_magic_residue',
      anchorSlot: 'bottom-left',
      alpha: 0.35,
      scale: 1.0,
      idlePhaseOffset: 1.6,
    },
    {
      key: 'fg_arcane_tendril',
      anchorSlot: 'top-left',
      alpha: 0.30,
      scale: 1.0,
      idlePhaseOffset: 2.9,
    },
  ],
  void: [
    {
      key: 'fg_void_tendril',
      anchorSlot: 'top-left',
      alpha: 0.50,
      scale: 1.1,
      idlePhaseOffset: 0,
    },
    {
      key: 'fg_reality_crack',
      anchorSlot: 'bottom-right',
      alpha: 0.45,
      scale: 1.0,
      idlePhaseOffset: 1.4,
    },
    {
      key: 'fg_dark_seep',
      anchorSlot: 'top-right',
      alpha: 0.40,
      scale: 1.0,
      idlePhaseOffset: 2.8,
      flipX: true,
    },
  ],
}

/**
 * How many foreground elements to show, based on device tier.
 * Low-end devices get 1 (static, no breathing); mid/flagship get more.
 */
export const FOREGROUND_ELEMENT_COUNT: Record<ReturnType<typeof getDeviceTier>, number> = {
  'low-end': 1,
  'mid': 2,
  'flagship': 3,
}

/**
 * Select the foreground elements to use for a given biome encounter.
 *
 * Picks N elements without replacement from the biome pool, where N is
 * determined by device tier. For N=2, prefers top-left + bottom-right
 * (balanced visual weight). Falls back to random if that pairing is
 * unavailable in the pool.
 *
 * @param theme - The biome theme (floor theme string)
 * @returns Subset of element configs to instantiate this encounter
 */
export function selectForegroundElements(theme: FloorTheme): ForegroundElementConfig[] {
  const pool = FOREGROUND_ELEMENTS[theme] ?? FOREGROUND_ELEMENTS['dust']
  const count = FOREGROUND_ELEMENT_COUNT[getDeviceTier()]

  if (count >= pool.length) return [...pool]

  // For count=2, prefer the balanced top-left + bottom-right pair
  if (count === 2) {
    const topLeft = pool.find(e => e.anchorSlot === 'top-left')
    const bottomRight = pool.find(e => e.anchorSlot === 'bottom-right')
    if (topLeft && bottomRight) return [topLeft, bottomRight]
  }

  // Fall back: shuffle and take count
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Resolve anchor slot to pixel (x, y) base position.
 *
 * All anchors are within the outer 120px band of the viewport,
 * ensuring no foreground element can ever obscure the enemy sprite
 * or card hand UI (both are in the center-to-bottom regions).
 *
 * @param slot - Anchor slot identifier
 * @param w - Viewport width in pixels
 * @param h - Viewport height in pixels
 * @returns Base { x, y } position for the element's origin
 */
export function resolveAnchorPosition(
  slot: AnchorSlot,
  w: number,
  h: number,
): { x: number; y: number } {
  // Edge inset — how far from the screen corner the sprite origin sits.
  // Negative inset means the sprite origin is off-screen; texture extends inward.
  const INSET_X = 60
  const INSET_Y = 60

  switch (slot) {
    case 'top-left':     return { x: INSET_X,         y: INSET_Y }
    case 'top-right':    return { x: w - INSET_X,     y: INSET_Y }
    case 'bottom-left':  return { x: INSET_X,         y: h - INSET_Y }
    case 'bottom-right': return { x: w - INSET_X,     y: h - INSET_Y }
    case 'top-center':   return { x: w / 2,           y: INSET_Y }
  }
}
