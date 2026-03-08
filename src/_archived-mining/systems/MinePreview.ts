/**
 * Mine preview thumbnail generator.
 * Renders a downsampled block-type color map of the mine grid to an offscreen canvas.
 *
 * @file src/game/systems/MinePreview.ts
 */

import { BlockType, type MineCell } from '../../data/types'
import type { Biome } from '../../data/biomes'

/** Pixel dimensions of the thumbnail canvas. */
export const PREVIEW_WIDTH = 80
export const PREVIEW_HEIGHT = 60

/** Per-block-type color map for the preview (RGB hex strings). */
const BLOCK_PREVIEW_COLORS: Record<number, string> = {
  [BlockType.Empty]:          '#1a1a2e',
  [BlockType.Dirt]:           '#8b5e3c',
  [BlockType.SoftRock]:       '#6d6d6d',
  [BlockType.Stone]:          '#555577',
  [BlockType.HardRock]:       '#333355',
  [BlockType.Unbreakable]:    '#111111',
  [BlockType.MineralNode]:    '#44ff88',
  [BlockType.ArtifactNode]:   '#ffaa00',
  [BlockType.OxygenCache]:    '#00ccff',
  [BlockType.UpgradeCrate]:   '#ff6600',
  [BlockType.QuizGate]:       '#ff00ff',
  [BlockType.ExitLadder]:     '#ffffff',
  [BlockType.DescentShaft]:   '#aaaaff',
  [BlockType.RelicShrine]:    '#ffdd00',
  [BlockType.LavaBlock]:      '#ff2200',
  [BlockType.GasPocket]:      '#aaff00',
  [BlockType.UnstableGround]: '#886600',
  [BlockType.FossilNode]:     '#cc9966',
  [BlockType.DataDisc]:       '#00ffff',
}

/**
 * Renders a mine grid to an offscreen HTMLCanvasElement at PREVIEW_WIDTH × PREVIEW_HEIGHT.
 * Returns the canvas (callers can call .toDataURL() or draw it elsewhere).
 *
 * @param grid - The mine grid to render.
 * @param biome - The primary biome (used for background tint).
 */
export function renderMinePreview(grid: MineCell[][], biome: Biome): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_WIDTH
  canvas.height = PREVIEW_HEIGHT
  const ctx = canvas.getContext('2d')!

  // Fill background with biome ambient color
  ctx.fillStyle = '#' + biome.ambientColor.toString(16).padStart(6, '0')
  ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)

  if (grid.length === 0) return canvas

  const gridH = grid.length
  const gridW = grid[0].length
  const cellW = PREVIEW_WIDTH / gridW
  const cellH = PREVIEW_HEIGHT / gridH

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const cell = grid[y][x]
      const color = BLOCK_PREVIEW_COLORS[cell.type] ?? '#444444'
      ctx.fillStyle = color
      ctx.fillRect(
        Math.round(x * cellW),
        Math.round(y * cellH),
        Math.max(1, Math.round(cellW)),
        Math.max(1, Math.round(cellH)),
      )
    }
  }

  return canvas
}

/**
 * Returns a data URL string (PNG) of the mine preview for embedding in an <img> element.
 *
 * @param grid - The mine grid to render.
 * @param biome - The primary biome (used for background tint).
 */
export function minePreviewDataUrl(grid: MineCell[][], biome: Biome): string {
  return renderMinePreview(grid, biome).toDataURL('image/png')
}
