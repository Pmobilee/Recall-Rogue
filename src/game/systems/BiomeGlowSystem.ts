/**
 * Biome fog glow system — luminous blocks (Lava, Crystal, Essence) emit
 * colored radial glow into adjacent unexplored fog zones.
 * Phase 9.17 (DD-V2-271)
 */

import { BlockType, type MineCell } from '../../data/types'

/** Glow configuration for luminous block types. */
interface GlowConfig {
  color: number
  radius: number
  alpha: number
}

/** Block types that emit glow into fog, with their configs. */
const GLOW_SOURCES: Partial<Record<BlockType, GlowConfig>> = {
  [BlockType.LavaBlock]: { color: 0xFF6600, radius: 2, alpha: 0.45 },
  [BlockType.MineralNode]: { color: 0x44AAFF, radius: 3, alpha: 0.35 },
  [BlockType.DataDisc]: { color: 0x9944CC, radius: 2, alpha: 0.40 },
}

/** Maximum alpha for any glow pixel (OLED safety). */
const MAX_GLOW_ALPHA = 0.5

/**
 * Manages the fog glow overlay layer in MineScene.
 * Draws radial gradients from luminous blocks into adjacent fog tiles.
 */
export class BiomeGlowSystem {
  private graphics: Phaser.GameObjects.Graphics | null = null
  private scene: Phaser.Scene
  private tileSize: number
  private enabled = true

  constructor(scene: Phaser.Scene, tileSize: number) {
    this.scene = scene
    this.tileSize = tileSize
  }

  /** Creates the glow graphics layer. Must be called after scene is ready. */
  public init(): void {
    this.graphics = this.scene.add.graphics()
    this.graphics.setBlendMode(Phaser.BlendModes.ADD)
    this.graphics.setDepth(5) // Above fog, below revealed tiles
  }

  /** Toggles the glow system on/off (DevPanel toggle). */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.graphics) {
      this.graphics.setVisible(enabled)
    }
  }

  /**
   * Redraws glow based on the current grid state.
   * Only call when fog state changes (block revealed/hidden), not every frame.
   */
  public update(grid: MineCell[][]): void {
    if (!this.graphics || !this.enabled) return
    this.graphics.clear()

    const rows = grid.length
    const cols = grid[0]?.length ?? 0

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y][x]
        if (!cell.revealed) continue

        const glowConfig = GLOW_SOURCES[cell.type]
        if (!glowConfig) continue

        // Check if this cell is adjacent to fog
        const hasAdjacentFog = this.hasAdjacentUnrevealed(grid, x, y, rows, cols)
        if (!hasAdjacentFog) continue

        this.drawGlow(x, y, glowConfig)
      }
    }
  }

  /** Cleans up graphics on scene shutdown. */
  public destroy(): void {
    this.graphics?.destroy()
    this.graphics = null
  }

  private hasAdjacentUnrevealed(
    grid: MineCell[][],
    x: number,
    y: number,
    rows: number,
    cols: number,
  ): boolean {
    const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dx, dy] of neighbors) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        if (!grid[ny][nx].revealed) return true
      }
    }
    return false
  }

  private drawGlow(cellX: number, cellY: number, config: GlowConfig): void {
    if (!this.graphics) return
    const cx = cellX * this.tileSize + this.tileSize / 2
    const cy = cellY * this.tileSize + this.tileSize / 2
    const radiusPx = config.radius * this.tileSize

    // Draw concentric circles with decreasing alpha for gradient effect
    const steps = config.radius * 3
    for (let i = steps; i >= 0; i--) {
      const r = (i / steps) * radiusPx
      const alpha = Math.min(config.alpha * (1 - i / steps), MAX_GLOW_ALPHA)
      this.graphics.fillStyle(config.color, alpha)
      this.graphics.fillCircle(cx, cy, r)
    }
  }
}
