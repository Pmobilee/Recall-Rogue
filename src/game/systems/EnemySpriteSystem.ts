import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'

type EnemyCategory = 'common' | 'elite' | 'mini_boss' | 'boss'

/**
 * EnemySpriteSystem renders enemy sprites with a layered "3D paper cutout" effect
 * and provides procedural animations (idle bobbing, attack lunge, hit knockback, death ash-disintegration).
 * Replaces the old texture-swap animation approach.
 */
export class EnemySpriteSystem {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private mainSprite: Phaser.GameObjects.Image | null = null
  private shadowSprite: Phaser.GameObjects.Image | null = null
  private outlineSprites: Phaser.GameObjects.Image[] = []

  // For placeholder enemies (no texture)
  private mainRect: Phaser.GameObjects.Rectangle | null = null
  private shadowRect: Phaser.GameObjects.Rectangle | null = null
  private outlineRects: Phaser.GameObjects.Rectangle[] = []
  private placeholderBorder: Phaser.GameObjects.Rectangle | null = null
  private placeholderIcon: Phaser.GameObjects.Text | null = null

  private idleBobTween: Phaser.Tweens.Tween | null = null
  private breatheTween: Phaser.Tweens.Tween | null = null
  private wobbleTween: Phaser.Tweens.Tween | null = null
  private isAnimating = false
  private baseY = 0
  private reduceMotion: boolean
  private effectScale: number
  private hasRealTexture = false
  private jitterTimer: Phaser.Time.TimerEvent | null = null

  /**
   * Create a new EnemySpriteSystem.
   * @param scene The Phaser scene to render into
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.container = scene.add.container(0, 0).setDepth(5)

    // Read reduceMotion from localStorage
    try {
      this.reduceMotion =
        JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
    } catch {
      this.reduceMotion = false
    }

    // Set effect scale based on device tier
    this.effectScale = getDeviceTier() === 'low-end' ? 0.65 : 1
  }

  /**
   * Set a sprite texture for the enemy with layered shadow and outline effect.
   * @param textureKey The key of the texture to use
   * @param displaySize The size to display the sprite at
   * @param x The x position for the container
   * @param y The y position for the container
   * @param category The enemy category (affects outline styling)
   */
  public setSprite(
    textureKey: string,
    displaySize: number,
    x: number,
    y: number,
    category: EnemyCategory
  ): void {
    this.destroyChildren()
    this.baseY = y
    this.hasRealTexture = true

    // Create shadow
    this.shadowSprite = this.scene.add
      .image(4, 5, textureKey)
      .setDisplaySize(displaySize, displaySize)
      .setTint(0x000000)
      .setAlpha(0.25)

    // Create 4 outline sprites at cardinal offsets
    const outlineOffsets: [number, number][] = [[-2, 0], [2, 0], [0, -2], [0, 2]]
    for (const [ox, oy] of outlineOffsets) {
      const outline = this.scene.add
        .image(ox, oy, textureKey)
        .setDisplaySize(displaySize, displaySize)
        .setTint(0x000000)
        .setAlpha(0.9)
      this.outlineSprites.push(outline)
    }

    // Create main sprite
    this.mainSprite = this.scene.add.image(0, 0, textureKey).setDisplaySize(displaySize, displaySize)

    // Add all to container in order: shadow, outlines, main
    this.container.add(this.shadowSprite)
    for (const outline of this.outlineSprites) {
      this.container.add(outline)
    }
    this.container.add(this.mainSprite)

    // Position container and reset state
    this.container.setPosition(x, y)
    this.container.setAlpha(1).setScale(1).setAngle(0)
  }

  /**
   * Set a placeholder rectangle for enemies without textures.
   * @param color The fill color for the placeholder
   * @param size The size of the placeholder
   * @param x The x position for the container
   * @param y The y position for the container
   * @param category The enemy category (affects border styling)
   */
  public setPlaceholder(
    color: number,
    size: number,
    x: number,
    y: number,
    category: EnemyCategory
  ): void {
    this.destroyChildren()
    this.baseY = y
    this.hasRealTexture = false

    // Create shadow rect
    this.shadowRect = this.scene.add
      .rectangle(4, 5, size, size, 0x000000)
      .setOrigin(0.5, 0.5)
      .setAlpha(0.25)

    // Create 4 outline rects at cardinal offsets
    const outlineOffsets: [number, number][] = [[-2, 0], [2, 0], [0, -2], [0, 2]]
    for (const [ox, oy] of outlineOffsets) {
      const outline = this.scene.add
        .rectangle(ox, oy, size, size, 0x000000)
        .setOrigin(0.5, 0.5)
        .setAlpha(0.9)
      this.outlineRects.push(outline)
    }

    // Create main rect
    this.mainRect = this.scene.add
      .rectangle(0, 0, size, size, color)
      .setOrigin(0.5, 0.5)

    // Create border
    const borderSize = size + 10
    const borderColor =
      category === 'boss' ? 0xff4444 : category === 'elite' || category === 'mini_boss' ? 0xffd700 : 0xaaaaaa
    this.placeholderBorder = this.scene.add
      .rectangle(0, 0, borderSize, borderSize)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, borderColor)
      .setFillStyle(0x000000, 0)

    // Create "?" icon
    this.placeholderIcon = this.scene.add.text(0, 0, '?', {
      fontFamily: 'monospace',
      fontSize: '46px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5)
    this.placeholderIcon.setAlpha(0.6)

    // Add all to container
    this.container.add(this.shadowRect)
    for (const outline of this.outlineRects) {
      this.container.add(outline)
    }
    this.container.add(this.mainRect)
    this.container.add(this.placeholderBorder)
    this.container.add(this.placeholderIcon)

    // Position container and reset state
    this.container.setPosition(x, y)
    this.container.setAlpha(1).setScale(1).setAngle(0)
  }

  /**
   * Start idle animations (bobbing, breathing, wobbling).
   */
  public startIdle(): void {
    if (this.reduceMotion || this.isAnimating) return

    this.stopIdle()

    // Bob tween: vertical oscillation
    this.idleBobTween = this.scene.tweens.add({
      targets: this.container,
      y: this.baseY - 5,
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Breathe tween: slight scale pulse
    this.breatheTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 400,
    })

    // Wobble tween: subtle rotation
    this.wobbleTween = this.scene.tweens.add({
      targets: this.container,
      angle: 1,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 800,
    })
  }

  /**
   * Pause idle animations and reset container to neutral position.
   */
  private stopIdle(): void {
    this.idleBobTween?.pause()
    this.breatheTween?.pause()
    this.wobbleTween?.pause()
    this.container.setPosition(this.container.x, this.baseY)
    this.container.setScale(1)
    this.container.setAngle(0)
  }

  /**
   * Resume idle animations (no-op if reduceMotion is enabled).
   */
  private resumeIdle(): void {
    if (this.reduceMotion) return
    this.idleBobTween?.resume()
    this.breatheTween?.resume()
    this.wobbleTween?.resume()
  }

  /**
   * Stop and destroy idle tweens permanently.
   */
  private killIdleTweens(): void {
    this.idleBobTween?.destroy()
    this.breatheTween?.destroy()
    this.wobbleTween?.destroy()
    this.idleBobTween = null
    this.breatheTween = null
    this.wobbleTween = null
  }

  /**
   * Play attack animation (lunge forward with camera shake).
   * @returns Promise that resolves when attack completes
   */
  public playAttack(): Promise<void> {
    if (this.reduceMotion) return Promise.resolve()

    this.isAnimating = true
    this.stopIdle()
    this.scene.cameras.main.shake(130, 0.0034 * this.effectScale, true)

    return new Promise<void>((resolve) => {
      // Phase 1: lunge forward
      this.scene.tweens.add({
        targets: this.container,
        angle: 10,
        y: this.baseY + 22,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 180,
        ease: 'Power2',
        onComplete: () => {
          // Phase 2: spring back
          this.scene.tweens.add({
            targets: this.container,
            angle: 0,
            y: this.baseY,
            scaleX: 1,
            scaleY: 1,
            duration: 250,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.isAnimating = false
              this.resumeIdle()
              resolve()
            },
          })
        },
      })
    })
  }

  /**
   * Play hit reaction animation (knockback with camera shake and white flash).
   */
  public playHit(): void {
    if (this.reduceMotion) {
      // Minimal feedback: just a flash
      if (this.mainSprite) {
        this.mainSprite.setTint(0xffffff)
        this.scene.time.delayedCall(60, () => {
          this.mainSprite?.clearTint()
        })
      } else if (this.mainRect) {
        const origColor = this.mainRect.fillColor
        this.mainRect.setFillStyle(0xffffff)
        this.scene.time.delayedCall(60, () => {
          this.mainRect?.setFillStyle(origColor)
        })
      }
      return
    }

    this.isAnimating = true
    this.stopIdle()
    this.scene.cameras.main.shake(100, 0.0025 * this.effectScale, true)

    // White flash on main sprite
    if (this.mainSprite) {
      this.mainSprite.setTint(0xffffff)
      this.scene.time.delayedCall(60, () => {
        this.mainSprite?.clearTint()
      })
    } else if (this.mainRect) {
      const origColor = this.mainRect.fillColor
      this.mainRect.setFillStyle(0xffffff)
      this.scene.time.delayedCall(60, () => {
        this.mainRect?.setFillStyle(origColor)
      })
    }

    // Phase 1: knockback
    this.scene.tweens.add({
      targets: this.container,
      angle: -12,
      y: this.baseY - 15,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 95,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2: spring back with elastic overshoot
        this.scene.tweens.add({
          targets: this.container,
          angle: 0,
          y: this.baseY,
          scaleX: 1,
          scaleY: 1,
          duration: 350,
          ease: 'Elastic.easeOut',
          onComplete: () => {
            this.isAnimating = false
            this.resumeIdle()
          },
        })
      },
    })
  }

  /**
   * Play death animation (red tint, jitter, ash disintegration with particles).
   * @returns Promise that resolves when death animation completes
   */
  public playDeath(): Promise<void> {
    if (this.reduceMotion) {
      this.container.setAlpha(0)
      return Promise.resolve()
    }

    this.isAnimating = true
    this.stopIdle()
    this.killIdleTweens()

    // Ensure ash particle texture exists
    if (!this.scene.textures.exists('ash_particle')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff)
      gfx.fillRect(0, 0, 4, 4)
      gfx.generateTexture('ash_particle', 4, 4)
      gfx.destroy()
    }

    return new Promise<void>((resolve) => {
      const baseX = this.container.x

      // Phase 1 (0-150ms): Red tint + jitter
      if (this.mainSprite) {
        this.mainSprite.setTint(0xff2222)
      } else if (this.mainRect) {
        this.mainRect.setFillStyle(0xff2222)
      }

      // Rapid jitter
      this.jitterTimer = this.scene.time.addEvent({
        delay: 30,
        repeat: 4, // 5 iterations × 30ms = 150ms
        callback: () => {
          this.container.x = baseX + (Math.random() - 0.5) * 6
        },
      })

      // Phase 2 starts at 150ms
      this.scene.time.delayedCall(150, () => {
        this.container.x = baseX // Reset jitter
        if (this.jitterTimer) {
          this.jitterTimer.destroy()
          this.jitterTimer = null
        }

        // Tint to ash gray
        if (this.mainSprite) {
          this.mainSprite.setTint(0x555555)
        } else if (this.mainRect) {
          this.mainRect.setFillStyle(0x555555)
        }

        // Tint outlines gray too
        for (const outline of this.outlineSprites) {
          outline.setTint(0x333333)
        }
        for (const outline of this.outlineRects) {
          outline.setFillStyle(0x333333)
        }

        if (this.shadowSprite) this.shadowSprite.setAlpha(0)
        if (this.shadowRect) this.shadowRect.setAlpha(0)

        // Burst ash particles upward
        const particleCount = Math.max(8, Math.round(25 * this.effectScale))
        const emitter = this.scene.add.particles(this.container.x, this.baseY, 'ash_particle', {
          speed: { min: 40, max: 90 },
          angle: { min: 240, max: 300 },
          scale: { start: 0.6, end: 0 },
          alpha: { start: 0.8, end: 0 },
          tint: [0x555555, 0x777777, 0x444444],
          lifespan: 600,
          gravityY: -30,
          emitting: false,
        })
        emitter.setDepth(998)
        emitter.explode(particleCount, 0, 0)

        // Squish and fade tween
        this.scene.tweens.add({
          targets: this.container,
          scaleY: 0.3,
          scaleX: 0.8,
          alpha: 0.3,
          duration: 350,
          ease: 'Power2',
          onComplete: () => {
            // Phase 3 (500-800ms): second particle burst + final fade

            const smallBurst = Math.max(4, Math.round(10 * this.effectScale))
            const emitter2 = this.scene.add.particles(this.container.x, this.baseY - 20, 'ash_particle', {
              speed: { min: 20, max: 50 },
              angle: { min: 250, max: 290 },
              scale: { start: 0.4, end: 0 },
              alpha: { start: 0.6, end: 0 },
              tint: [0x777777, 0x999999],
              lifespan: 500,
              gravityY: -20,
              emitting: false,
            })
            emitter2.setDepth(998)
            emitter2.explode(smallBurst, 0, 0)

            this.scene.tweens.add({
              targets: this.container,
              alpha: 0,
              duration: 300,
              ease: 'Power2',
              onComplete: () => {
                // Clean up emitters after particles fade
                this.scene.time.delayedCall(700, () => {
                  emitter.destroy()
                  emitter2.destroy()
                })
                resolve()
              },
            })
          },
        })
      })
    })
  }

  /**
   * Play entry animation for new encounters (no Promise, fire-and-forget).
   * @param isBoss Whether this is a boss enemy (affects animation parameters)
   */
  public playEntry(isBoss: boolean): void {
    const startScale = isBoss ? 0.76 : 0.86
    const fadeDuration = isBoss ? 560 : 380

    this.container.setAlpha(this.reduceMotion ? 1 : 0.16)
    this.container.setScale(this.reduceMotion ? 1 : startScale)

    if (this.reduceMotion) {
      this.startIdle()
      return
    }

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: fadeDuration,
      ease: isBoss ? 'Back.Out' : 'Quad.Out',
      onComplete: () => {
        this.startIdle()
      },
    })
  }

  /**
   * Get the container game object.
   * @returns The container holding all sprite/rect children
   */
  public getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  /**
   * Set the alpha (opacity) of the entire sprite system.
   * @param alpha The alpha value (0-1)
   */
  public setAlpha(alpha: number): void {
    this.container.setAlpha(alpha)
  }

  /**
   * Set visibility of the entire sprite system.
   * @param visible Whether the container should be visible
   */
  public setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  /**
   * Destroy the sprite system and clean up all resources.
   */
  public destroy(): void {
    this.killIdleTweens()
    if (this.jitterTimer) {
      this.jitterTimer.destroy()
      this.jitterTimer = null
    }
    this.container.removeAll(true)
    this.container.destroy()
  }

  /**
   * Destroy all child objects and reset sprite references.
   */
  private destroyChildren(): void {
    this.killIdleTweens()
    this.container.removeAll(true)

    // Null sprite/rect references
    this.mainSprite = null
    this.shadowSprite = null
    this.outlineSprites = []
    this.mainRect = null
    this.shadowRect = null
    this.outlineRects = []
    this.placeholderBorder = null
    this.placeholderIcon = null

    // Reset state
    this.isAnimating = false

    // Clean up jitter timer
    if (this.jitterTimer) {
      this.jitterTimer.destroy()
      this.jitterTimer = null
    }
  }
}
