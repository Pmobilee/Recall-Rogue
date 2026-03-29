import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'
import { getAnimConfig, type AnimConfig, type AnimArchetype, type IdlePatternStep, type IdleBehavior } from '../../data/enemyAnimations'
import type { AtmosphereConfig } from '../../data/roomAtmosphere'

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
  private customIdleTweens: Phaser.Tweens.Tween[] = []
  private customIdleTimers: Phaser.Time.TimerEvent[] = []
  private customPatternRunning = false
  private isAnimating = false
  private baseX = 0
  private baseY = 0
  private reduceMotion: boolean
  private effectScale: number
  private hasRealTexture = false
  private jitterTimer: Phaser.Time.TimerEvent | null = null
  private animConfig: AnimConfig = getAnimConfig()
  private animSpeed = 0.25

  private isEnraged = false
  private enrageParticleTimer: Phaser.Time.TimerEvent | null = null
  private enrageGlowRect: Phaser.GameObjects.Rectangle | null = null
  private enrageGlowTween: Phaser.Tweens.Tween | null = null

  // ── Atmosphere visual effects ─────────────────────────────
  private _aoFx: Phaser.FX.Gradient | null = null
  private _currentAtmosphereTint: number | null = null
  private _depthTextureKey: string | null = null

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
    this.baseX = x
    this.baseY = y
    this.hasRealTexture = true

    // Compute aspect-ratio-preserving display dimensions
    const frame = this.scene.textures.getFrame(textureKey)
    const tw = frame.width
    const th = frame.height
    let dw: number, dh: number
    if (tw >= th) {
      dw = displaySize
      dh = displaySize * (th / tw)
    } else {
      dh = displaySize
      dw = displaySize * (tw / th)
    }

    // Scale shadow and outline offsets proportionally to displaySize (base design: 300px)
    const scaleFactor = displaySize / 300
    const shadowX = Math.round(4 * scaleFactor)
    const shadowY = Math.round(5 * scaleFactor)
    const outlineO = Math.max(1, Math.round(2 * scaleFactor))

    // Create shadow
    this.shadowSprite = this.scene.add
      .image(shadowX, shadowY, textureKey)
      .setDisplaySize(dw, dh)
      .setTint(0x000000)
      .setAlpha(0.25)

    // Create 4 outline sprites at cardinal offsets
    const outlineOffsets: [number, number][] = [[-outlineO, 0], [outlineO, 0], [0, -outlineO], [0, outlineO]]
    for (const [ox, oy] of outlineOffsets) {
      const outline = this.scene.add
        .image(ox, oy, textureKey)
        .setDisplaySize(dw, dh)
        .setTint(0x000000)
        .setAlpha(0.9)
      this.outlineSprites.push(outline)
    }

    // Create main sprite
    this.mainSprite = this.scene.add.image(0, 0, textureKey).setDisplaySize(dw, dh)

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
    this.baseX = x
    this.baseY = y
    this.hasRealTexture = false

    // Scale shadow and outline offsets proportionally to size (base design: 300px)
    const scaleFactor = size / 300
    const shadowX = Math.round(4 * scaleFactor)
    const shadowY = Math.round(5 * scaleFactor)
    const outlineO = Math.max(1, Math.round(2 * scaleFactor))

    // Create shadow rect
    this.shadowRect = this.scene.add
      .rectangle(shadowX, shadowY, size, size, 0x000000)
      .setOrigin(0.5, 0.5)
      .setAlpha(0.25)

    // Create 4 outline rects at cardinal offsets
    const outlineOffsets: [number, number][] = [[-outlineO, 0], [outlineO, 0], [0, -outlineO], [0, outlineO]]
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
   * Set the animation config for the current enemy based on archetype.
   * Call this after setSprite/setPlaceholder and before startIdle.
   * @param archetype Optional animation archetype identifier
   */
  public setAnimConfig(archetype?: AnimArchetype, enemyId?: string): void {
    this.animConfig = getAnimConfig(archetype, enemyId)
  }

  /**
   * Apply room-specific atmosphere color grading to the enemy sprite.
   * Tints the main sprite with the room's color temperature.
   * @param config The atmosphere config for the current room
   */
  public applyAtmosphereTint(config: Pick<AtmosphereConfig, 'spriteTint'>): void {
    if (!this.mainSprite) return
    this._currentAtmosphereTint = config.spriteTint
    this.mainSprite.setTint(config.spriteTint)
  }

  /**
   * Clear any atmosphere tinting from the enemy sprite.
   * Called before hit flash and restored after.
   */
  public clearAtmosphereTint(): void {
    if (!this.mainSprite) return
    this._currentAtmosphereTint = null
    this.mainSprite.clearTint()
  }

  /**
   * Apply ambient occlusion gradient to darken the sprite's base.
   * Simulates how light reaches less of the surface near ground contact.
   * @param aoStrength Strength of the AO effect (0.0-0.4). 0 = disabled.
   */
  public applyAO(aoStrength: number): void {
    if (!this.mainSprite || aoStrength <= 0) return
    // Only apply on high-end/mid devices (preFX costs a shader pass)
    if (getDeviceTier() === 'low-end') return

    // Remove previous AO if exists
    this.removeAO()

    // Darken bottom 40% of sprite — simulates ground-contact light falloff
    if (!this.mainSprite.preFX) return
    this._aoFx = this.mainSprite.preFX.addGradient(
      0x000000, 0x000000,
      aoStrength,
      0, 0.6,
      0, 1.0
    )
  }

  /**
   * Remove ambient occlusion effect from the sprite.
   */
  public removeAO(): void {
    if (this._aoFx && this.mainSprite?.preFX) {
      this.mainSprite.preFX.remove(this._aoFx)
      this._aoFx = null
    }
  }

  /**
   * Remove depth effects from the sprite.
   */
  public removeDepthEffects(): void {
    this._depthTextureKey = null
  }

  /**
   * Start idle animations (bobbing, breathing, wobbling) plus any custom archetype pattern.
   */
  public startIdle(): void {
    if (this.reduceMotion || this.isAnimating) return

    this.stopIdle()

    const behavior = this.animConfig.idleBehavior
    const idleConfig = behavior?.base ?? this.animConfig.idle

    // Start base layer (bob/breathe/wobble) unless suppressed
    if (!behavior?.suppressBase) {
      // Bob tween: vertical oscillation
      this.idleBobTween = this.scene.tweens.add({
        targets: this.container,
        y: this.baseY - idleConfig.bobAmplitude,
        duration: idleConfig.bobDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        timeScale: this.animSpeed,
      })

      // Breathe tween: slight scale pulse
      this.breatheTween = this.scene.tweens.add({
        targets: this.container,
        scaleX: idleConfig.breatheScale,
        scaleY: idleConfig.breatheScale,
        duration: idleConfig.breatheDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 400,
        timeScale: this.animSpeed,
      })

      // Wobble tween: subtle rotation
      this.wobbleTween = this.scene.tweens.add({
        targets: this.container,
        angle: idleConfig.wobbleAngle,
        duration: idleConfig.wobbleDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 800,
        timeScale: this.animSpeed,
      })
    }

    // Start custom pattern if defined
    if (behavior?.pattern && behavior.pattern.length > 0) {
      this.customPatternRunning = true
      this.runPatternStep(behavior.pattern, 0)
    }
  }

  /**
   * Pause idle animations and reset container to neutral position.
   */
  private stopIdle(): void {
    this.idleBobTween?.destroy()
    this.breatheTween?.destroy()
    this.wobbleTween?.destroy()
    this.idleBobTween = null
    this.breatheTween = null
    this.wobbleTween = null
    this.killCustomIdleTweens()
    this.container.setPosition(this.baseX, this.baseY)
    this.container.setScale(1)
    this.container.setAngle(0)
  }

  /**
   * Resume idle animations (no-op if reduceMotion is enabled).
   */
  private resumeIdle(): void {
    if (this.reduceMotion) return
    this.startIdle()
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
    this.killCustomIdleTweens()
  }

  /**
   * Run a single step of the custom idle pattern, then advance to next.
   */
  private runPatternStep(pattern: IdlePatternStep[], index: number): void {
    if (!this.customPatternRunning) return
    const step = pattern[index]
    const nextIndex = (index + 1) % pattern.length

    switch (step.type) {
      case 'move': {
        const tween = this.scene.tweens.add({
          targets: this.container,
          x: this.baseX + (step.dx ?? 0),
          y: this.baseY + (step.dy ?? 0),
          duration: step.duration,
          ease: step.ease ?? 'Sine.easeInOut',
          timeScale: this.animSpeed,
          onComplete: () => this.runPatternStep(pattern, nextIndex),
        })
        this.customIdleTweens.push(tween)
        break
      }

      case 'pause': {
        const timer = this.scene.time.delayedCall(step.duration, () => {
          this.runPatternStep(pattern, nextIndex)
        })
        this.customIdleTimers.push(timer)
        break
      }

      case 'flip': {
        const targetScaleX = (step.flipX ?? -1) * Math.abs(this.container.scaleX)
        const tween = this.scene.tweens.add({
          targets: this.container,
          scaleX: targetScaleX,
          duration: step.duration,
          ease: step.ease ?? 'Sine.easeInOut',
          timeScale: this.animSpeed,
          onComplete: () => this.runPatternStep(pattern, nextIndex),
        })
        this.customIdleTweens.push(tween)
        break
      }

      case 'squash':
      case 'pulse': {
        const tween = this.scene.tweens.add({
          targets: this.container,
          scaleX: step.scaleX ?? 1,
          scaleY: step.scaleY ?? 1,
          duration: step.duration,
          ease: step.ease ?? 'Power2',
          yoyo: step.yoyo ?? true,
          timeScale: this.animSpeed,
          onComplete: () => this.runPatternStep(pattern, nextIndex),
        })
        this.customIdleTweens.push(tween)
        break
      }

      case 'jitter': {
        const intensity = (step.intensity ?? 2) * this.effectScale
        const interval = (step.interval ?? 100) * (1 / this.animSpeed)
        const elapsed = { value: 0 }
        const timer = this.scene.time.addEvent({
          delay: interval,
          loop: true,
          callback: () => {
            elapsed.value += interval
            if (elapsed.value >= step.duration * (1 / this.animSpeed)) {
              timer.destroy()
              // Reset position to base
              this.container.x = this.baseX
              this.container.y = this.baseY
              this.runPatternStep(pattern, nextIndex)
              return
            }
            this.container.x = this.baseX + (Math.random() - 0.5) * intensity * 2
            this.container.y = this.baseY + (Math.random() - 0.5) * intensity * 2
          },
        })
        this.customIdleTimers.push(timer)
        break
      }

      case 'drift': {
        // Drift works alongside the base bob by only affecting X
        // (Y is controlled by the bob tween when base isn't suppressed)
        const tween = this.scene.tweens.add({
          targets: this.container,
          x: this.baseX + (step.dx ?? 0),
          duration: step.duration,
          ease: step.ease ?? 'Sine.easeInOut',
          timeScale: this.animSpeed,
          onComplete: () => this.runPatternStep(pattern, nextIndex),
        })
        this.customIdleTweens.push(tween)
        break
      }

      case 'rotate': {
        const tween = this.scene.tweens.add({
          targets: this.container,
          angle: step.angle ?? 0,
          duration: step.duration,
          ease: step.ease ?? 'Sine.easeInOut',
          yoyo: step.yoyo ?? false,
          timeScale: this.animSpeed,
          onComplete: () => this.runPatternStep(pattern, nextIndex),
        })
        this.customIdleTweens.push(tween)
        break
      }

      case 'fade': {
        const tween = this.scene.tweens.add({
          targets: this.container,
          alpha: step.alpha ?? 1,
          duration: step.duration,
          ease: step.ease ?? 'Sine.easeInOut',
          yoyo: step.yoyo ?? false,
          timeScale: this.animSpeed,
          onComplete: () => this.runPatternStep(pattern, nextIndex),
        })
        this.customIdleTweens.push(tween)
        break
      }

      default:
        // Unknown step type — skip to next
        this.runPatternStep(pattern, nextIndex)
    }
  }

  /**
   * Stop and destroy all custom idle pattern tweens and timers.
   */
  private killCustomIdleTweens(): void {
    this.customPatternRunning = false
    for (const tween of this.customIdleTweens) {
      tween.destroy()
    }
    this.customIdleTweens = []
    for (const timer of this.customIdleTimers) {
      timer.destroy()
    }
    this.customIdleTimers = []
  }

  /**
   * Activate enrage visual effects — red particle border and intensified idle.
   */
  public setEnraged(enraged: boolean): void {
    if (enraged === this.isEnraged) return
    this.isEnraged = enraged

    if (enraged && !this.reduceMotion) {
      // Intensify idle: increase bob amplitude and speed
      if (this.idleBobTween) {
        this.idleBobTween.updateTo('y', this.baseY - this.animConfig.idle.bobAmplitude * 1.5)
        this.idleBobTween.timeScale = 1.3 * this.animSpeed
      }
      if (this.breatheTween) {
        this.breatheTween.timeScale = 1.3 * this.animSpeed
      }
      // If base is suppressed, add a fast bob tween as enrage override
      if (!this.idleBobTween && this.animConfig.idleBehavior?.suppressBase) {
        this.idleBobTween = this.scene.tweens.add({
          targets: this.container,
          y: this.baseY - 6,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          timeScale: this.animSpeed,
        })
        this.idleBobTween.timeScale = 1.3 * this.animSpeed
      }

      // Red/orange glow rectangle around enemy
      const size = this.mainSprite
        ? Math.max(this.mainSprite.displayWidth, this.mainSprite.displayHeight)
        : (this.mainRect ? this.mainRect.displayWidth : 100)
      this.enrageGlowRect = this.scene.add.rectangle(0, 0, size + 16, size + 16)
        .setStrokeStyle(3, 0xff4400, 0.6)
        .setFillStyle(0xff0000, 0)
        .setDepth(4)
      this.container.add(this.enrageGlowRect)
      this.container.sendToBack(this.enrageGlowRect)

      // Pulse the glow
      this.enrageGlowTween = this.scene.tweens.add({
        targets: this.enrageGlowRect,
        alpha: { from: 0.4, to: 0.8 },
        scaleX: { from: 1, to: 1.05 },
        scaleY: { from: 1, to: 1.05 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        timeScale: this.animSpeed,
      })

      // Ensure enrage particle texture
      if (!this.scene.textures.exists('enrage_particle')) {
        const gfx = this.scene.make.graphics({ x: 0, y: 0 })
        gfx.fillStyle(0xffffff)
        gfx.fillRect(0, 0, 3, 3)
        gfx.generateTexture('enrage_particle', 3, 3)
        gfx.destroy()
      }

      // Continuous particle border
      this.enrageParticleTimer = this.scene.time.addEvent({
        delay: 300 / this.animSpeed,
        loop: true,
        callback: () => {
          if (!this.isEnraged) return
          const halfSize = (size + 16) / 2
          const side = Math.floor(Math.random() * 4)
          let px = 0, py = 0
          switch (side) {
            case 0: px = -halfSize + Math.random() * (size + 16); py = -halfSize; break
            case 1: px = -halfSize + Math.random() * (size + 16); py = halfSize; break
            case 2: px = -halfSize; py = -halfSize + Math.random() * (size + 16); break
            case 3: px = halfSize; py = -halfSize + Math.random() * (size + 16); break
          }
          const emitter = this.scene.add.particles(
            this.container.x + px, this.container.y + py, 'enrage_particle', {
              speed: { min: 10, max: 30 },
              angle: { min: 250, max: 290 },
              scale: { start: 0.5, end: 0 },
              alpha: { start: 0.7, end: 0 },
              tint: [0xff4400, 0xff6600, 0xff2200],
              lifespan: 500,
              emitting: false,
            }
          )
          emitter.setDepth(999)
          emitter.explode(Math.max(1, Math.round(2 * this.effectScale)), 0, 0)
          this.scene.time.delayedCall(600, () => emitter.destroy())
        },
      })
    } else {
      // Deactivate enrage
      if (this.idleBobTween) {
        this.idleBobTween.updateTo('y', this.baseY - this.animConfig.idle.bobAmplitude)
        this.idleBobTween.timeScale = this.animSpeed
      }
      if (this.breatheTween) {
        this.breatheTween.timeScale = this.animSpeed
      }
      // If base was suppressed, remove the enrage override bob
      if (this.animConfig.idleBehavior?.suppressBase && this.idleBobTween) {
        this.idleBobTween.destroy()
        this.idleBobTween = null
      }
      if (this.enrageGlowTween) {
        this.enrageGlowTween.destroy()
        this.enrageGlowTween = null
      }
      if (this.enrageGlowRect) {
        this.enrageGlowRect.destroy()
        this.enrageGlowRect = null
      }
      if (this.enrageParticleTimer) {
        this.enrageParticleTimer.destroy()
        this.enrageParticleTimer = null
      }
    }
  }

  /**
   * Play attack animation (lunge forward with camera shake).
   * @returns Promise that resolves when attack completes
   */
  public playAttack(): Promise<void> {
    if (this.reduceMotion) return Promise.resolve()

    const { attack } = this.animConfig
    this.isAnimating = true
    this.stopIdle()
    ;(this.scene as any).screenShake?.trigger('medium')

    return new Promise<void>((resolve) => {
      // Phase 1: lunge forward
      this.scene.tweens.add({
        targets: this.container,
        angle: attack.rotation,
        x: this.baseX + attack.lungeX,
        y: this.baseY + attack.lungeY,
        scaleX: attack.scale,
        scaleY: attack.scale,
        duration: attack.lungeDuration,
        ease: 'Power2',
        timeScale: this.animSpeed,
        onComplete: () => {
          // Phase 2: spring back
          this.scene.tweens.add({
            targets: this.container,
            angle: 0,
            x: this.baseX,
            y: this.baseY,
            scaleX: 1,
            scaleY: 1,
            duration: attack.returnDuration,
            ease: attack.returnEase,
            timeScale: this.animSpeed,
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
          if (this._currentAtmosphereTint != null) {
            this.mainSprite?.setTint(this._currentAtmosphereTint)
          } else {
            this.mainSprite?.clearTint()
          }
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
    ;(this.scene as any).screenShake?.trigger('micro')

    // White flash on main sprite
    if (this.mainSprite) {
      this.mainSprite.setTint(0xffffff)
      this.scene.time.delayedCall(60, () => {
        if (this._currentAtmosphereTint != null) {
          this.mainSprite?.setTint(this._currentAtmosphereTint)
        } else {
          this.mainSprite?.clearTint()
        }
      })
    } else if (this.mainRect) {
      const origColor = this.mainRect.fillColor
      this.mainRect.setFillStyle(0xffffff)
      this.scene.time.delayedCall(60, () => {
        this.mainRect?.setFillStyle(origColor)
      })
    }

    const { hit } = this.animConfig

    // Phase 1: knockback
    this.scene.tweens.add({
      targets: this.container,
      angle: hit.rotation,
      x: this.baseX + hit.knockbackX,
      y: this.baseY + hit.knockbackY,
      scaleX: hit.scale,
      scaleY: hit.scale,
      duration: hit.knockbackDuration,
      ease: 'Sine.easeOut',
      timeScale: this.animSpeed,
      onComplete: () => {
        // Phase 2: spring back with elastic overshoot
        this.scene.tweens.add({
          targets: this.container,
          angle: 0,
          x: this.baseX,
          y: this.baseY,
          scaleX: 1,
          scaleY: 1,
          duration: hit.returnDuration,
          ease: hit.returnEase,
          timeScale: this.animSpeed,
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
        delay: 30 / this.animSpeed,
        repeat: 4, // 5 iterations × 30ms = 150ms (scaled by animSpeed)
        callback: () => {
          this.container.x = baseX + (Math.random() - 0.5) * 6
        },
      })

      // Phase 2 starts at 150ms (scaled by animSpeed)
      this.scene.time.delayedCall(150 / this.animSpeed, () => {
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
          timeScale: this.animSpeed,
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
              timeScale: this.animSpeed,
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
    const startScale = isBoss ? 0.05 : 0.1
    const overshootScale = isBoss ? 1.25 : 1.15
    const popDuration = isBoss ? 400 : 300
    const settleDuration = isBoss ? 250 : 180

    this.container.setAlpha(this.reduceMotion ? 1 : 0)
    this.container.setScale(this.reduceMotion ? 1 : startScale)

    if (this.reduceMotion) {
      this.startIdle()
      return
    }

    // Phase 1: Pop up from tiny to overshoot
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: overshootScale,
      scaleY: overshootScale,
      duration: popDuration,
      ease: 'Back.Out',
      timeScale: this.animSpeed,
      onComplete: () => {
        // Camera shake on landing
        ;(this.scene as any).screenShake?.trigger(isBoss ? 'medium' : 'micro')

        // Phase 2: Settle back to 1.0
        this.scene.tweens.add({
          targets: this.container,
          scaleX: 1,
          scaleY: 1,
          duration: settleDuration,
          ease: 'Sine.easeInOut',
          timeScale: this.animSpeed,
          onComplete: () => {
            this.startIdle()
          },
        })
      },
    })
  }

  /**
   * Flash the enemy sprite with an additive-blend colored overlay.
   *
   * Uses a Graphics rectangle in ADD blend mode rather than setTint() so the
   * flash stays vibrant on already-colored sprites (setTint multiplies, which
   * produces muddy results).  Multiple concurrent calls each create their own
   * independent rectangle, so they compose correctly.
   *
   * @param color    RGB hex color for the flash (e.g. 0xff0000 for red)
   * @param duration Fade duration in milliseconds
   * @param intensity Peak alpha of the overlay (0.0–1.0)
   */
  public flashColor(color: number, duration: number, intensity: number): void {
    // Determine the bounds of the main visual element in container-local space
    const sprite = this.mainSprite ?? this.mainRect
    if (!sprite) return

    const hw = (sprite instanceof Phaser.GameObjects.Image
      ? sprite.displayWidth
      : (sprite as Phaser.GameObjects.Rectangle).displayWidth) / 2
    const hh = (sprite instanceof Phaser.GameObjects.Image
      ? sprite.displayHeight
      : (sprite as Phaser.GameObjects.Rectangle).displayHeight) / 2

    // Create an additive-blend overlay rectangle positioned over the sprite
    const gfx = this.scene.add.graphics()
    gfx.setBlendMode(Phaser.BlendModes.ADD)
    gfx.fillStyle(color, intensity)
    gfx.fillRect(-hw, -hh, hw * 2, hh * 2)

    // Add to the container so it follows any container transforms
    this.container.add(gfx)

    // Tween alpha from intensity → 0, then destroy
    this.scene.tweens.add({
      targets: gfx,
      alpha: { from: intensity, to: 0 },
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.container.remove(gfx, true)
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

  /** Update the base position used by idle animations. Called by quiz slide. */
  public updateBasePosition(x: number, y: number): void {
    this.baseX = x
    this.baseY = y
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
    this.setEnraged(false)
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
    this.setEnraged(false)
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
    this.animConfig = getAnimConfig()

    // Reset atmosphere effects
    this._aoFx = null
    this._currentAtmosphereTint = null
    this._depthTextureKey = null

    // Clean up jitter timer
    if (this.jitterTimer) {
      this.jitterTimer.destroy()
      this.jitterTimer = null
    }
  }
}
