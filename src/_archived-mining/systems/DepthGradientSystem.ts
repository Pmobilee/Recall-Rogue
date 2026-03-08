// src/game/systems/DepthGradientSystem.ts
// Phase 33.5 — Depth visual gradient system.
// Applies progressive darkening and hue shift as the player descends through 20 layers.

import type { Biome } from '../../data/biomes'

/**
 * Returns per-layer visual modifiers for the depth gradient.
 *
 * @param layer - 0-based layer index (0 = shallowest, 19 = deepest)
 * @param biome - Active biome
 * @returns Modifier object consumed by MineScene and BiomeGlowSystem
 */
export interface DepthModifiers {
  /** Multiply applied to background camera fill brightness (0.0–1.0) */
  backgroundBrightnessMul: number
  /** Additional alpha darkening overlay on top of the entire viewport (0.0–0.5) */
  viewportDarkAlpha: number
  /** Fog-hidden cell additional darkening beyond fogPalette.hidden */
  fogDarkenBonus: number
  /** Glow intensity multiplier — deeper = brighter glowing blocks for contrast */
  glowIntensityMul: number
}

const MAX_LAYER = 19

/**
 * Computes depth gradient modifiers for a given layer.
 * Shallow (0): minimal darkening. Extreme (16-19): heavy darkening + glow boost.
 */
export function computeDepthModifiers(layer: number, biome: Biome): DepthModifiers {
  const t = Math.min(layer, MAX_LAYER) / MAX_LAYER  // 0.0 = layer 0, 1.0 = layer 19

  // Baseline brightness: 1.0 → 0.55 over depth
  const backgroundBrightnessMul = 1.0 - t * 0.45

  // Viewport dark overlay: none at surface → 0.30 alpha at layer 19
  const viewportDarkAlpha = t * 0.30

  // Fog darkening bonus: 0 → 0.12
  const fogDarkenBonus = t * 0.12

  // Glow intensity: scale up for warm/extreme biomes at depth for readability
  const isHotBiome = biome.depthAesthetic.colorTemperature === 'warm'
  const glowIntensityMul = 1.0 + t * (isHotBiome ? 0.6 : 0.3)

  return { backgroundBrightnessMul, viewportDarkAlpha, fogDarkenBonus, glowIntensityMul }
}

/**
 * Applies depth-modified background color to a Phaser camera.
 * Darkens the ambient color by the brightness multiplier.
 *
 * @param camera - Phaser main camera
 * @param biome - Active biome
 * @param layer - 0-based layer index
 */
export function applyDepthBackground(
  camera: Phaser.Cameras.Scene2D.Camera,
  biome: Biome,
  layer: number,
): void {
  const { backgroundBrightnessMul } = computeDepthModifiers(layer, biome)
  const base = biome.ambientColor
  const r = Math.floor(((base >> 16) & 0xff) * backgroundBrightnessMul)
  const g = Math.floor(((base >> 8) & 0xff) * backgroundBrightnessMul)
  const b = Math.floor((base & 0xff) * backgroundBrightnessMul)
  camera.setBackgroundColor((r << 16) | (g << 8) | b)
}
