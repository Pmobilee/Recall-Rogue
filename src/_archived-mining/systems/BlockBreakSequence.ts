// src/game/systems/BlockBreakSequence.ts

import { BlockType } from '../../data/types'

/** Configuration for a single block-break sequence */
export interface BlockBreakConfig {
  /** Grid X position of the block */
  tileX: number
  /** Grid Y position of the block */
  tileY: number
  /** World X pixel center of the block */
  worldX: number
  /** World Y pixel center of the block */
  worldY: number
  /** Type of block being broken */
  blockType: BlockType
  /** Sprite key for the block's appearance */
  blockSpriteKey: string
  /** Tile size in pixels */
  tileSize: number
  /** Callback fired when the radial burst is complete (at end of freeze-frame) */
  onBurstComplete: () => void
  /** Callback fired when the shatter animation finishes (optional) */
  onShatterComplete?: () => void
}

/** A single reusable shatter piece from the pool */
interface ShatterPiece {
  sprite: Phaser.GameObjects.Image
  inUse: boolean
}

/** Per-block-type radial burst tint colors */
const BURST_TINTS: Partial<Record<BlockType, number>> = {
  [BlockType.Dirt]:        0x8c6342,
  [BlockType.SoftRock]:    0xbbaa99,
  [BlockType.Stone]:       0x888888,
  [BlockType.HardRock]:    0x555555,
  [BlockType.MineralNode]: 0x4ecca3,
  [BlockType.ArtifactNode]: 0xff99aa,
  [BlockType.LavaBlock]:   0xff4400,
  [BlockType.GasPocket]:   0x44ff88,
  [BlockType.OxygenCache]: 0x88ccff,
  [BlockType.QuizGate]:    0xffd700,
  [BlockType.UpgradeCrate]: 0xffaa00,
  [BlockType.FossilNode]:  0xddcc99,
  [BlockType.RelicShrine]: 0xcc88ff,
}

const DEFAULT_BURST_TINT = 0xffffff

/** Max concurrent break sequences */
const MAX_CONCURRENT_SEQUENCES = 4

/** Pool size for shatter pieces (4 pieces × MAX_CONCURRENT_SEQUENCES) */
const POOL_SIZE = 16

/** Duration of the freeze-frame in ms */
const FREEZE_DURATION_MS = 50

/** Duration of each shatter piece flight in ms */
const SHATTER_DURATION_MS = 200

/**
 * Orchestrates the block-break visual sequence:
 *  1. Freeze-frame (50ms via timeScale = 0 on the scene)
 *  2. Radial burst particles from the block center
 *  3. 4-quadrant shatter pieces that fly outward and fade (200ms)
 *
 * Uses a pool of 16 shatter sprites to avoid per-break allocations.
 * Caps at 4 concurrent sequences to limit visual noise.
 */
export class BlockBreakSequence {
  private scene: Phaser.Scene
  private shatterPool: ShatterPiece[] = []
  private activeSequences = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this._buildPool()
  }

  // ----------------------------------------------------------
  // LIFECYCLE
  // ----------------------------------------------------------

  /**
   * Builds the reusable shatter piece pool.
   * Creates POOL_SIZE invisible image sprites.
   */
  private _buildPool(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      // Use a basic 1×1 white pixel texture as fallback
      const texKey = this.scene.textures.exists('particle_sq_4')
        ? 'particle_sq_4'
        : '__DEFAULT'
      const sprite = this.scene.add.image(0, 0, texKey)
      sprite.setVisible(false)
      sprite.setDepth(201)
      this.shatterPool.push({ sprite, inUse: false })
    }
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  /**
   * Plays the full block-break sequence for a single block.
   * Silently ignores the request if the concurrent sequence cap is reached.
   *
   * @param config - Full configuration for the break sequence
   */
  play(config: BlockBreakConfig): void {
    if (this.activeSequences >= MAX_CONCURRENT_SEQUENCES) {
      // Cap reached — just fire the callback immediately to keep logic consistent
      config.onBurstComplete()
      config.onShatterComplete?.()
      return
    }

    this.activeSequences++

    const { worldX, worldY, tileSize, blockType, blockSpriteKey, onBurstComplete, onShatterComplete } = config
    const burstTint = BURST_TINTS[blockType] ?? DEFAULT_BURST_TINT

    // Step 1: Freeze-frame — pause scene time
    this._freezeFrame(FREEZE_DURATION_MS, () => {
      // Step 2: Radial burst particles
      this._emitBurst(worldX, worldY, burstTint)

      // Step 3: Launch shatter pieces
      this._launchShatterPieces(worldX, worldY, tileSize, blockSpriteKey, burstTint, () => {
        this.activeSequences--
        onShatterComplete?.()
      })

      // Fire burst callback immediately after freeze ends
      onBurstComplete()
    })
  }

  /**
   * Destroys all pooled sprites. Call on scene shutdown.
   */
  destroy(): void {
    for (const piece of this.shatterPool) {
      piece.sprite.destroy()
    }
    this.shatterPool = []
    this.activeSequences = 0
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /**
   * Pauses scene time for `durationMs` using timeScale, then restores it.
   * Uses scene.game.events for the real-time timeout so the timer fires
   * even when timeScale = 0.
   *
   * @param durationMs - Duration of the freeze in milliseconds
   * @param onComplete - Callback fired when freeze ends
   */
  private _freezeFrame(durationMs: number, onComplete: () => void): void {
    this.scene.time.timeScale = 0

    // Use the game's step event for a real-wall-clock delay
    const startTime = performance.now()
    const checkFn = (): void => {
      if (performance.now() - startTime >= durationMs) {
        this.scene.game.events.off('step', checkFn)
        this.scene.time.timeScale = 1
        onComplete()
      }
    }
    this.scene.game.events.on('step', checkFn)
  }

  /**
   * Emits a quick radial burst of tiny particles from the block center.
   *
   * @param x    - World X center
   * @param y    - World Y center
   * @param tint - Color tint for the particles
   */
  private _emitBurst(x: number, y: number, tint: number): void {
    const texKey = this.scene.textures.exists('particle_sq_4')
      ? 'particle_sq_4'
      : '__DEFAULT'

    const emitter = this.scene.add.particles(x, y, texKey, {
      color: [tint],
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 180,
      quantity: 8,
      frequency: -1,
      gravityY: 60,
      emitting: false,
    })
    emitter.setDepth(202)
    emitter.explode(8)
    this.scene.time.delayedCall(300, () => emitter.destroy())
  }

  /**
   * Acquires 4 shatter pieces from the pool (one per quadrant) and animates
   * them flying outward from the block center, fading over SHATTER_DURATION_MS.
   *
   * @param cx           - World X center of the block
   * @param cy           - World Y center of the block
   * @param tileSize     - Tile size in pixels (used to scale shatter pieces)
   * @param spriteKey    - Texture key for the shatter pieces
   * @param tint         - Color tint for the shatter pieces
   * @param onComplete   - Callback fired when all pieces finish animating
   */
  private _launchShatterPieces(
    cx: number,
    cy: number,
    tileSize: number,
    spriteKey: string,
    tint: number,
    onComplete: () => void
  ): void {
    const pieces = this._acquirePieces(4)
    if (pieces.length === 0) {
      onComplete()
      return
    }

    const texKey = this.scene.textures.exists(spriteKey) ? spriteKey : 'particle_sq_4'
    const half = tileSize * 0.5
    let completedCount = 0

    // Quadrant offsets: top-left, top-right, bottom-left, bottom-right
    const quadrants = [
      { dx: -1, dy: -1 },
      { dx:  1, dy: -1 },
      { dx: -1, dy:  1 },
      { dx:  1, dy:  1 },
    ]

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]
      const { dx, dy } = quadrants[i % quadrants.length]
      const piece_sprite = piece.sprite

      piece_sprite.setTexture(texKey)
      piece_sprite.setTint(tint)
      piece_sprite.setAlpha(0.85)
      piece_sprite.setAngle(0)
      piece_sprite.setDisplaySize(half, half)
      piece_sprite.setPosition(cx, cy)
      piece_sprite.setVisible(true)
      piece.inUse = true

      const targetX = cx + dx * (tileSize * 0.8 + Math.random() * tileSize * 0.3)
      const targetY = cy + dy * (tileSize * 0.8 + Math.random() * tileSize * 0.3)
      const targetAngle = (Math.random() - 0.5) * 180

      this.scene.tweens.add({
        targets: piece_sprite,
        x: targetX,
        y: targetY,
        angle: targetAngle,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: SHATTER_DURATION_MS,
        ease: 'Quad.Out',
        onComplete: () => {
          piece_sprite.setVisible(false)
          piece.inUse = false
          completedCount++
          if (completedCount >= pieces.length) {
            onComplete()
          }
        },
      })
    }
  }

  /**
   * Acquires up to `count` free shatter pieces from the pool.
   *
   * @param count - Number of pieces to acquire
   * @returns Array of available pool entries (may be shorter than requested)
   */
  private _acquirePieces(count: number): ShatterPiece[] {
    const result: ShatterPiece[] = []
    for (const piece of this.shatterPool) {
      if (!piece.inUse && result.length < count) {
        result.push(piece)
      }
    }
    return result
  }
}
