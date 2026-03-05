// src/game/systems/LootPopSystem.ts

import type { Rarity } from '../../data/types'

/** Full configuration for a single loot pop */
export interface LootPopConfig {
  /** Phaser texture key for the loot sprite */
  spriteKey: string
  /** World X of the source block center */
  worldX: number
  /** World Y of the source block center */
  worldY: number
  /** World X of the collection target (player position) */
  targetX: number
  /** World Y of the collection target (player position) */
  targetY: number
  /** Optional rarity for reveal effects */
  rarity?: Rarity
  /** Stagger delay in ms before this pop starts (used for multi-item drops) */
  staggerMs?: number
  /** Callback fired when the loot reaches the player (vacuum complete) */
  onComplete?: () => void
  /** Callback fired when the loot settles to its resting bounce position */
  onBounceSettled?: () => void
}

/**
 * Spawns loot items with full physics pop arc + bounce + magnetic vacuum animation.
 *
 * 5-phase tween chain per item:
 *  1. Rise   — Quad.Out upward arc (250ms)
 *  2. Fall   — Quad.In gravity fall to landing (150ms)
 *  3. Squash — instant horizontal squash on impact (40ms)
 *  4. Bounce — Sine.Out upward bounce (60ms)
 *  5. Settle — Quad.In settle back down (60ms)
 *  6. Vacuum — Quad.In magnetic pull toward player (350ms, shrinks to 0)
 *
 * Rarity-based reveal effects are played immediately on pop.
 * Multi-item drops are staggered by 50ms each via the staggerMs property.
 */
export class LootPopSystem {
  private scene: Phaser.Scene
  private activePops: Phaser.GameObjects.Image[] = []
  private pool: Phaser.GameObjects.Image[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Acquires a sprite from the object pool (or creates a new one if pool is empty).
   * Reduces GC pressure from rapid create/destroy cycles during fast mining.
   *
   * @param key - Texture key for the sprite
   * @param x   - World X position
   * @param y   - World Y position
   * @returns A ready-to-use Phaser Image game object
   */
  private acquire(key: string, x: number, y: number): Phaser.GameObjects.Image {
    const img = this.pool.pop()
    if (img) return img.setTexture(key).setPosition(x, y).setVisible(true).setActive(true)
    return this.scene.add.image(x, y, key)
  }

  /**
   * Returns a sprite to the object pool (or destroys it if pool is at capacity).
   * Pool is capped at 50 instances to prevent unbounded memory growth.
   *
   * @param img - The sprite to release back to the pool
   */
  private release(img: Phaser.GameObjects.Image): void {
    img.setVisible(false).setActive(false)
    if (this.pool.length < 50) this.pool.push(img)
    else img.destroy()
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  /**
   * Spawn a loot item with the full physics pop + bounce + vacuum animation.
   *
   * @param config - Full loot pop configuration
   */
  popLoot(config: LootPopConfig): void {
    const { staggerMs = 0 } = config

    if (staggerMs > 0) {
      this.scene.time.delayedCall(staggerMs, () => this._spawnSinglePop(config))
    } else {
      this._spawnSinglePop(config)
    }
  }

  /**
   * Spawn multiple loot items with automatic 50ms stagger between each.
   *
   * @param configs - Array of loot pop configurations to spawn
   */
  popMultiple(configs: LootPopConfig[]): void {
    configs.forEach((cfg, index) => {
      this.popLoot({ ...cfg, staggerMs: (cfg.staggerMs ?? 0) + index * 50 })
    })
  }

  /**
   * Play a descent shaft transition animation.
   * Camera zooms in and pans down, then fades to black.
   *
   * @param onComplete - Callback fired when the fade-out completes
   */
  playDescentAnimation(onComplete: () => void): void {
    const cam = this.scene.cameras.main
    this.scene.tweens.add({
      targets: cam,
      zoom: cam.zoom * 1.5,
      duration: 600,
      ease: 'Quad.In',
      onComplete: () => {
        cam.fadeOut(400, 0, 0, 0)
        cam.once('camerafadeoutcomplete', onComplete)
      },
    })
  }

  /**
   * Destroy all active pop sprites and clear the object pool. Call on scene shutdown.
   */
  destroy(): void {
    for (const s of this.activePops) s.destroy()
    this.activePops = []
    for (const s of this.pool) s.destroy()
    this.pool = []
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /**
   * Spawns and animates a single loot sprite through the full 6-phase chain.
   *
   * @param config - The loot pop configuration
   */
  private _spawnSinglePop(config: LootPopConfig): void {
    const { spriteKey, worldX, worldY, targetX, targetY, rarity, onComplete, onBounceSettled } = config

    // Use fallback texture if sprite doesn't exist
    const textureKey = this.scene.textures.exists(spriteKey) ? spriteKey : 'block_mineral_dust'
    if (!this.scene.textures.exists(textureKey)) {
      // No valid texture — skip visual, still fire callbacks
      onBounceSettled?.()
      onComplete?.()
      return
    }

    const sprite = this.acquire(textureKey, worldX, worldY)
    sprite.setDisplaySize(16, 16)
    sprite.setDepth(20)
    this.activePops.push(sprite)

    // Random horizontal scatter for the arc
    const arcX = worldX + (Math.random() - 0.5) * 28
    // Rise destination — upward from source
    const riseY = worldY - 28 - Math.random() * 14
    // Land destination — slightly below the rise peak (gravity effect)
    const landY = riseY + 10

    // Phase 1: Rise — Quad.Out upward arc (250ms)
    this.scene.tweens.add({
      targets: sprite,
      x: arcX,
      y: riseY,
      scaleX: 1.1,
      scaleY: 0.9,
      ease: 'Quad.Out',
      duration: 250,
      onComplete: () => {
        // Phase 2: Fall — Quad.In gravity fall (150ms)
        this.scene.tweens.add({
          targets: sprite,
          y: landY,
          scaleX: 1.0,
          scaleY: 1.0,
          ease: 'Quad.In',
          duration: 150,
          onComplete: () => {
            // Phase 3: Squash — horizontal squash on impact (40ms)
            this.scene.tweens.add({
              targets: sprite,
              scaleX: 1.4,
              scaleY: 0.6,
              ease: 'Quad.Out',
              duration: 40,
              onComplete: () => {
                // Phase 4: Bounce — Sine.Out upward bounce (60ms)
                this.scene.tweens.add({
                  targets: sprite,
                  y: landY - 6,
                  scaleX: 0.9,
                  scaleY: 1.1,
                  ease: 'Sine.Out',
                  duration: 60,
                  onComplete: () => {
                    // Phase 5: Settle — Quad.In back to rest (60ms)
                    this.scene.tweens.add({
                      targets: sprite,
                      y: landY,
                      scaleX: 1.0,
                      scaleY: 1.0,
                      ease: 'Quad.In',
                      duration: 60,
                      onComplete: () => {
                        onBounceSettled?.()

                        // Phase 6: Vacuum — Quad.In magnetic pull to player (350ms)
                        this.scene.tweens.add({
                          targets: sprite,
                          x: targetX,
                          y: targetY,
                          scale: 0,
                          ease: 'Quad.In',
                          duration: 350,
                          onComplete: () => {
                            this._removePop(sprite)
                            onComplete?.()
                          },
                        })
                      },
                    })
                  },
                })
              },
            })
          },
        })
      },
    })

    // Rarity-based overlay effects (played immediately on pop)
    this._playRarityEffect(rarity, worldX, worldY)
  }

  /**
   * Removes a loot sprite from the active pool and returns it to the object pool.
   *
   * @param sprite - The sprite to remove
   */
  private _removePop(sprite: Phaser.GameObjects.Image): void {
    const idx = this.activePops.indexOf(sprite)
    if (idx >= 0) this.activePops.splice(idx, 1)
    this.release(sprite)
  }

  /**
   * Play a rarity reveal effect at the given world position.
   *
   * @param rarity - Rarity tier (skips effect if undefined or 'common')
   * @param x      - World X position
   * @param y      - World Y position
   */
  private _playRarityEffect(rarity: Rarity | undefined, x: number, y: number): void {
    if (!rarity || rarity === 'common') return

    if (rarity === 'uncommon') {
      this._emitSparkleRing(x, y, 0xaaffaa, 8)
    } else if (rarity === 'rare') {
      this._emitSparkleRing(x, y, 0x4488ff, 14)
      this._spawnLightColumn(x, y, 0x4488ff)
    } else if (rarity === 'epic') {
      this._emitSparkleRing(x, y, 0xdd44ff, 20)
      this._emitSparkleRing(x, y, 0xff88ff, 12)
      this._flashScreen(0x330044, 300)
    } else if (rarity === 'legendary') {
      this._emitSparkleRing(x, y, 0xffd700, 30)
      this._emitSparkleRing(x, y, 0xff8800, 20)
      this._flashScreen(0x221100, 500)
    } else if (rarity === 'mythic') {
      this._emitSparkleRing(x, y, 0xff00ff, 40)
      this._emitSparkleRing(x, y, 0x00ffff, 30)
      this._emitSparkleRing(x, y, 0xffd700, 20)
      this._flashScreen(0x110022, 800)
    }
  }

  /**
   * Emit a burst of sparkle particles in a ring pattern.
   *
   * @param x     - World X center
   * @param y     - World Y center
   * @param tint  - Particle color
   * @param count - Number of particles to emit
   */
  private _emitSparkleRing(x: number, y: number, tint: number, count: number): void {
    if (!this.scene.textures.exists('particle_square')) return
    const emitter = this.scene.add.particles(x, y, 'particle_square', {
      speed: { min: 40, max: 120 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 600,
      quantity: count,
      tint,
      emitting: false,
    })
    emitter.setDepth(25)
    emitter.explode(count)
    this.scene.time.delayedCall(700, () => emitter.destroy())
  }

  /**
   * Spawn a brief vertical light column effect.
   *
   * @param x    - World X center
   * @param y    - World Y center
   * @param tint - Column color
   */
  private _spawnLightColumn(x: number, y: number, tint: number): void {
    const rect = this.scene.add.rectangle(x, y - 40, 8, 80, tint, 0.4)
    rect.setDepth(22)
    this.scene.tweens.add({
      targets: rect,
      alpha: 0,
      scaleY: 2,
      duration: 400,
      ease: 'Quad.Out',
      onComplete: () => rect.destroy(),
    })
  }

  /**
   * Trigger a camera flash effect with a color.
   *
   * @param color    - 24-bit hex color (0xRRGGBB)
   * @param duration - Flash duration in ms
   */
  private _flashScreen(color: number, duration: number): void {
    const cam = this.scene.cameras.main
    cam.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false)
  }
}
