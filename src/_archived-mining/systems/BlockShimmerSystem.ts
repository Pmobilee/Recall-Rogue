import Phaser from 'phaser'
import { BLOCK_SHIMMER_TIERS } from '../../data/balance'
import type { Rarity } from '../../data/types'

/**
 * Manages ambient shimmer overlays on high-rarity ArtifactNode tiles.
 *
 * Rendered as additive-blended Graphics rectangles drawn each frame
 * over the tile position. Alpha is driven by a sinusoidal pulse using
 * `Phaser.time.now`.
 *
 * Usage:
 *   const shimmer = new BlockShimmerSystem(scene, TILE_SIZE)
 *   // each frame in MineScene.update():
 *   shimmer.update(this.time.now)
 *   // when a new layer is generated:
 *   shimmer.registerNode(tileX, tileY, worldX, worldY, rarity)
 *   // when a tile is destroyed:
 *   shimmer.unregisterNode(tileX, tileY)
 */
export class BlockShimmerSystem {
  private scene: Phaser.Scene
  private tileSize: number
  private shimmerGfx!: Phaser.GameObjects.Graphics

  private nodes: Map<string, {
    worldX: number
    worldY: number
    rarity: Rarity
    phaseOffset: number   // Random phase offset (0-2π) so nodes don't pulse in sync
  }> = new Map()

  constructor(scene: Phaser.Scene, tileSize: number) {
    this.scene = scene
    this.tileSize = tileSize
  }

  /** Must be called during MineScene.create() after the main layer is rendered. */
  init(): void {
    this.shimmerGfx = this.scene.add.graphics()
    this.shimmerGfx.setDepth(201)  // One layer above BlockAnimSystem (depth 200)
    this.shimmerGfx.setBlendMode(Phaser.BlendModes.ADD)
  }

  /**
   * Register an ArtifactNode tile for shimmer rendering.
   * No-op if rarity has shimmerAlpha === 0.
   */
  registerNode(tileX: number, tileY: number, worldX: number, worldY: number, rarity: Rarity): void {
    const cfg = BLOCK_SHIMMER_TIERS[rarity]
    if (!cfg || cfg.shimmerAlpha === 0) return
    const key = `${tileX},${tileY}`
    this.nodes.set(key, { worldX, worldY, rarity, phaseOffset: Math.random() * Math.PI * 2 })
  }

  /** Remove a node (called when the tile is broken or the layer resets). */
  unregisterNode(tileX: number, tileY: number): void {
    this.nodes.delete(`${tileX},${tileY}`)
  }

  /** Clear all registered nodes (call on layer transition). */
  clear(): void {
    this.nodes.clear()
  }

  /**
   * Draw shimmer overlays for all registered nodes.
   * Call once per frame from MineScene.update().
   *
   * @param nowMs - Phaser time.now in milliseconds
   */
  update(nowMs: number): void {
    this.shimmerGfx.clear()
    for (const node of this.nodes.values()) {
      const cfg = BLOCK_SHIMMER_TIERS[node.rarity]
      if (!cfg || cfg.shimmerAlpha === 0 || cfg.shimmerPeriodMs === 0) continue

      const cycle = (nowMs % cfg.shimmerPeriodMs) / cfg.shimmerPeriodMs
      const alpha = cfg.shimmerAlpha * (0.5 + 0.5 * Math.sin(cycle * Math.PI * 2 + node.phaseOffset))

      const r = (cfg.shimmerColor >> 16) & 0xff
      const g = (cfg.shimmerColor >> 8) & 0xff
      const b = cfg.shimmerColor & 0xff

      // Core tile shimmer
      this.shimmerGfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), alpha)
      this.shimmerGfx.fillRect(node.worldX, node.worldY, this.tileSize, this.tileSize)

      // Bleed into adjacent tiles for epic+ rarities
      if (cfg.shimmerRadiusTiles > 0) {
        const bleedAlpha = alpha * 0.35
        this.shimmerGfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), bleedAlpha)
        for (let dx = -cfg.shimmerRadiusTiles; dx <= cfg.shimmerRadiusTiles; dx++) {
          for (let dy = -cfg.shimmerRadiusTiles; dy <= cfg.shimmerRadiusTiles; dy++) {
            if (dx === 0 && dy === 0) continue
            this.shimmerGfx.fillRect(
              node.worldX + dx * this.tileSize,
              node.worldY + dy * this.tileSize,
              this.tileSize,
              this.tileSize
            )
          }
        }
      }
    }
  }

  /** Destroy graphics object when scene shuts down. */
  destroy(): void {
    this.shimmerGfx?.destroy()
    this.nodes.clear()
  }
}
