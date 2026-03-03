// src/game/systems/LootPopSystem.ts

import type { Rarity } from '../../data/types'

interface LootPopConfig {
  spriteKey: string
  worldX: number
  worldY: number
  targetX: number
  targetY: number
  rarity?: Rarity
  onComplete?: () => void
}

/**
 * Spawns loot items with a physics pop arc + suck-to-player animation.
 * Rarity-based reveal effects escalate from subtle shimmer (common) to
 * full-screen prismatic lightshow (mythic).
 */
export class LootPopSystem {
  private scene: Phaser.Scene
  private activePops: Phaser.GameObjects.Image[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Spawn a loot item with physics pop + suck-to-player animation.
   *
   * Sequence:
   * 1. Block breaks → loot sprite appears at block center with random upward velocity
   * 2. Physics arc: gravity pulls loot down, settles at resting position ~1 tile above break (250ms)
   * 3. Suck animation: loot accelerates toward player position over 350ms
   * 4. On arrival: onComplete callback fires (caller handles HUD flash)
   */
  popLoot(config: LootPopConfig): void {
    const { spriteKey, worldX, worldY, targetX, targetY, rarity, onComplete } = config

    // Use fallback texture if sprite doesn't exist
    const textureKey = this.scene.textures.exists(spriteKey) ? spriteKey : 'block_mineral_dust'
    if (!this.scene.textures.exists(textureKey)) {
      // No valid texture at all — skip visual, still call onComplete
      onComplete?.()
      return
    }

    const sprite = this.scene.add.image(worldX, worldY, textureKey)
    sprite.setDisplaySize(16, 16)
    sprite.setDepth(20)
    this.activePops.push(sprite)

    // Phase 1: physics arc upward (200ms)
    const arcX = worldX + (Math.random() - 0.5) * 24
    const arcY = worldY - 24 - Math.random() * 16
    this.scene.tweens.add({
      targets: sprite,
      x: arcX,
      y: arcY,
      ease: 'Quad.Out',
      duration: 200,
      onComplete: () => {
        // Phase 2: gravity settle (150ms)
        this.scene.tweens.add({
          targets: sprite,
          y: arcY + 8,
          ease: 'Quad.In',
          duration: 150,
          onComplete: () => {
            // Phase 3: suck toward player (350ms, accelerating)
            this.scene.tweens.add({
              targets: sprite,
              x: targetX,
              y: targetY,
              scale: 0,
              ease: 'Quad.In',
              duration: 350,
              onComplete: () => {
                sprite.destroy()
                const idx = this.activePops.indexOf(sprite)
                if (idx >= 0) this.activePops.splice(idx, 1)
                onComplete?.()
              },
            })
          },
        })
      },
    })

    // Rarity-based overlay effects (played immediately on pop, not waiting for suck)
    this.playRarityEffect(rarity, worldX, worldY)
  }

  /**
   * Play a descent shaft transition animation.
   * Camera zooms in and pans down, then fades to black.
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
   * Play a rarity reveal effect at the given world position.
   */
  private playRarityEffect(rarity: Rarity | undefined, x: number, y: number): void {
    if (!rarity || rarity === 'common') return

    if (rarity === 'uncommon') {
      this.emitSparkleRing(x, y, 0xaaffaa, 8)
    } else if (rarity === 'rare') {
      this.emitSparkleRing(x, y, 0x4488ff, 14)
      this.spawnLightColumn(x, y, 0x4488ff)
    } else if (rarity === 'epic') {
      this.emitSparkleRing(x, y, 0xdd44ff, 20)
      this.emitSparkleRing(x, y, 0xff88ff, 12)
      this.flashScreen(0x330044, 300)
    } else if (rarity === 'legendary') {
      this.emitSparkleRing(x, y, 0xffd700, 30)
      this.emitSparkleRing(x, y, 0xff8800, 20)
      this.flashScreen(0x221100, 500)
    } else if (rarity === 'mythic') {
      this.emitSparkleRing(x, y, 0xff00ff, 40)
      this.emitSparkleRing(x, y, 0x00ffff, 30)
      this.emitSparkleRing(x, y, 0xffd700, 20)
      this.flashScreen(0x110022, 800)
    }
  }

  /**
   * Emit a burst of sparkle particles in a ring pattern.
   */
  private emitSparkleRing(x: number, y: number, tint: number, count: number): void {
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
   */
  private spawnLightColumn(x: number, y: number, tint: number): void {
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
   */
  private flashScreen(color: number, duration: number): void {
    const cam = this.scene.cameras.main
    cam.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false)
  }

  /**
   * Destroy all active pop sprites. Call on scene shutdown.
   */
  destroy(): void {
    for (const s of this.activePops) s.destroy()
    this.activePops = []
  }
}
