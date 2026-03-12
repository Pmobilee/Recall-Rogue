import Phaser from 'phaser'
import { getDeviceTier, getQualityPreset } from '../../services/deviceTierService'

/**
 * CombatParticleSystem — Multi-emitter particle manager for combat visual effects.
 * Handles impact bursts, directional trails, combo milestones, tier-up cascades,
 * enemy death effects, gold showers, and ambient background particles.
 *
 * Respects reduceMotion preference and device-tier budgets to prevent performance cliffs.
 */
export class CombatParticleSystem {
  private scene: Phaser.Scene
  private reduceMotion: boolean
  private effectScale: number
  private particleBudget: number
  private ambientBudget: number
  private activeParticleCount: number = 0

  // Emitters (lazy-created, reused across effects)
  private impactEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private directionalEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private ambientEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  /**
   * Create a new CombatParticleSystem.
   * Initializes quality settings from device tier and localStorage preferences.
   * @param scene The Phaser scene to emit particles into
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Read reduceMotion from localStorage
    try {
      this.reduceMotion =
        JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
    } catch {
      this.reduceMotion = false
    }

    // Set effect scale based on device tier
    this.effectScale = getDeviceTier() === 'low-end' ? 0.65 : 1

    // Get particle budgets from quality preset
    const preset = getQualityPreset()
    this.particleBudget = preset.particleBudget
    this.ambientBudget = preset.ambientParticleBudget

    // Create procedural textures
    this.createTextures()
  }

  /**
   * Create all procedural particle textures.
   * Only generates if textures don't already exist.
   */
  private createTextures(): void {
    // 4x4 white filled rect
    if (!this.scene.textures.exists('vfx_square_4')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false)
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(0, 0, 4, 4)
      gfx.generateTexture('vfx_square_4', 4, 4)
      gfx.destroy()
    }

    // 6px diameter circle
    if (!this.scene.textures.exists('vfx_circle_6')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false)
      gfx.fillStyle(0xffffff, 1)
      gfx.fillCircle(3, 3, 3)
      gfx.generateTexture('vfx_circle_6', 6, 6)
      gfx.destroy()
    }

    // 4px diamond shape (two triangles)
    if (!this.scene.textures.exists('vfx_diamond_4')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false)
      gfx.fillStyle(0xffffff, 1)
      // Top triangle
      gfx.fillTriangle(2, 0, 4, 2, 0, 2)
      // Bottom triangle
      gfx.fillTriangle(0, 2, 4, 2, 2, 4)
      gfx.generateTexture('vfx_diamond_4', 4, 4)
      gfx.destroy()
    }

    // 2x8 white filled rect (directional streak)
    if (!this.scene.textures.exists('vfx_streak_2x8')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false)
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(0, 0, 2, 8)
      gfx.generateTexture('vfx_streak_2x8', 2, 8)
      gfx.destroy()
    }
  }

  /**
   * Burst particles at position (impact effect).
   * Immediate radial explosion with scaled particle count.
   * @param x World x position
   * @param y World y position
   * @param count Base particle count
   * @param tint Particle color (0xRRGGBB)
   */
  public burstImpact(x: number, y: number, count: number, tint: number): void {
    if (this.reduceMotion) return

    const scaledCount = Math.min(
      Math.round(count * this.effectScale),
      this.particleBudget - this.activeParticleCount
    )
    if (scaledCount <= 0) return

    // Create or reuse impact emitter
    if (!this.impactEmitter) {
      this.impactEmitter = this.scene.add.particles(x, y, 'vfx_square_4', {
        speed: { min: 60, max: 160 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 400,
        gravityY: 0,
        emitting: false,
        maxParticles: this.particleBudget,
      })
      this.impactEmitter.setDepth(998)
    } else {
      this.impactEmitter.setPosition(x, y)
    }

    this.impactEmitter.setParticleTint(tint)
    this.impactEmitter.explode(scaledCount, x, y)
    this.activeParticleCount += scaledCount
    this.scene.time.delayedCall(450, () => {
      this.activeParticleCount = Math.max(0, this.activeParticleCount - scaledCount)
    })
  }

  /**
   * Directional burst toward a target angle (speed lines, directional effect).
   * Used for projectile trails and directional impact feedback.
   * @param x World x position
   * @param y World y position
   * @param angle Center direction in degrees
   * @param spread Angular spread around center (e.g., 30 = ±15° from center)
   * @param count Base particle count
   * @param tint Particle color (0xRRGGBB)
   */
  public burstDirectional(
    x: number,
    y: number,
    angle: number,
    spread: number,
    count: number,
    tint: number
  ): void {
    if (this.reduceMotion) return

    const scaledCount = Math.min(
      Math.round(count * this.effectScale),
      this.particleBudget - this.activeParticleCount
    )
    if (scaledCount <= 0) return

    // Create fresh directional emitter (angle cannot be changed after creation)
    const emitter = this.scene.add.particles(x, y, 'vfx_streak_2x8', {
      speed: { min: 100, max: 200 },
      angle: { min: angle - spread / 2, max: angle + spread / 2 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 350,
      gravityY: 0,
      emitting: false,
      maxParticles: this.particleBudget,
    })
    emitter.setDepth(998)
    emitter.setParticleTint(tint)
    emitter.explode(scaledCount, x, y)

    this.activeParticleCount += scaledCount
    this.scene.time.delayedCall(400, () => {
      this.activeParticleCount = Math.max(0, this.activeParticleCount - scaledCount)
      emitter.destroy()
    })
  }

  /**
   * Combo milestone celebration particles.
   * Effects intensify with combo level (3, 4, 5, 6+).
   * @param level Combo milestone level (3, 4, 5, or 6+)
   * @param x World x position
   * @param y World y position
   */
  public comboMilestone(level: number, x: number, y: number): void {
    if (this.reduceMotion) return

    let particleCount = 8
    let ringRadius = 30
    let tint = 0xffd700 // Gold default
    let lifespan = 500

    if (level >= 6) {
      particleCount = 30
      ringRadius = 80
      tint = 0xff44ff // Magenta for 6+
      lifespan = 700
    } else if (level === 5) {
      particleCount = 20
      ringRadius = 60
      tint = 0xffcc00 // Bright gold
      lifespan = 600
    } else if (level === 4) {
      particleCount = 12
      ringRadius = 45
      tint = 0xffd700
      lifespan = 550
    }

    const scaledCount = Math.min(
      particleCount,
      this.particleBudget - this.activeParticleCount
    )
    if (scaledCount <= 0) return

    const emitter = this.scene.add.particles(x, y, 'vfx_circle_6', {
      speed: { min: 40, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan,
      gravityY: -50,
      emitting: false,
      maxParticles: this.particleBudget,
    })
    emitter.setDepth(998)
    emitter.setParticleTint(tint)
    emitter.explode(scaledCount, x, y)
    this.activeParticleCount += scaledCount

    this.scene.time.delayedCall(lifespan + 100, () => {
      this.activeParticleCount = Math.max(0, this.activeParticleCount - scaledCount)
      emitter.destroy()
    })
  }

  /**
   * Tier-up sparkle cascade at position.
   * Particle color indicates tier progression.
   * @param x World x position
   * @param y World y position
   * @param color Sparkle tint (0xRRGGBB) — blue for 1→2a, green for 2a→2b, gold for mastery
   */
  public tierUpCascade(x: number, y: number, color: number): void {
    if (this.reduceMotion) return

    const particleCount = 15
    const scaledCount = Math.min(
      particleCount,
      this.particleBudget - this.activeParticleCount
    )
    if (scaledCount <= 0) return

    const emitter = this.scene.add.particles(x, y, 'vfx_diamond_4', {
      speed: { min: 30, max: 80 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 600,
      gravityY: -40,
      emitting: false,
      maxParticles: this.particleBudget,
    })
    emitter.setDepth(998)
    emitter.setParticleTint(color)
    emitter.explode(scaledCount, x, y)
    this.activeParticleCount += scaledCount

    this.scene.time.delayedCall(650, () => {
      this.activeParticleCount = Math.max(0, this.activeParticleCount - scaledCount)
      emitter.destroy()
    })
  }

  /**
   * Enhanced enemy death ash burst.
   * Two-phase effect: initial upward fast burst, then slower lingering fall.
   * @param x World x position
   * @param y World y position
   * @param spriteSize Size of enemy sprite (unused in current design, reserved for future scaling)
   */
  public enemyDeathAsh(x: number, y: number, spriteSize: number): void {
    if (this.reduceMotion) return

    const phase1Count = Math.min(
      15,
      this.particleBudget - this.activeParticleCount
    )
    if (phase1Count <= 0) return

    // Phase 1: initial fast upward burst
    const emitter1 = this.scene.add.particles(x, y, 'vfx_square_4', {
      speed: { min: 60, max: 140 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x555555, 0x777777, 0x444444],
      lifespan: 600,
      gravityY: -30,
      emitting: false,
      maxParticles: this.particleBudget,
    })
    emitter1.setDepth(998)
    emitter1.explode(phase1Count, x, y)
    this.activeParticleCount += phase1Count

    // Phase 2: after 200ms, slower lingering particles
    this.scene.time.delayedCall(200, () => {
      const phase2Count = Math.min(
        10,
        this.particleBudget - this.activeParticleCount
      )
      if (phase2Count > 0) {
        const emitter2 = this.scene.add.particles(x, y - 20, 'vfx_square_4', {
          speed: { min: 20, max: 50 },
          angle: { min: 250, max: 290 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.6, end: 0 },
          tint: [0x777777, 0x999999],
          lifespan: 500,
          gravityY: -20,
          emitting: false,
          maxParticles: this.particleBudget,
        })
        emitter2.setDepth(998)
        emitter2.explode(phase2Count, x, y - 20)
        this.activeParticleCount += phase2Count

        this.scene.time.delayedCall(550, () => {
          this.activeParticleCount = Math.max(0, this.activeParticleCount - phase2Count)
          emitter2.destroy()
        })
      }
    })

    this.scene.time.delayedCall(650, () => {
      this.activeParticleCount = Math.max(0, this.activeParticleCount - phase1Count)
      emitter1.destroy()
    })
  }

  /**
   * Gold coin shower effect.
   * Particles rise briefly then fall with gravity.
   * @param x World x position
   * @param y World y position
   * @param count Base particle count
   */
  public goldCoinShower(x: number, y: number, count: number): void {
    if (this.reduceMotion) return

    const scaledCount = Math.min(
      Math.round(count * this.effectScale),
      this.particleBudget - this.activeParticleCount
    )
    if (scaledCount <= 0) return

    const emitter = this.scene.add.particles(x, y, 'vfx_circle_6', {
      speed: { min: 40, max: 100 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: 0xffd700,
      lifespan: 800,
      gravityY: 150,
      emitting: false,
      maxParticles: this.particleBudget,
    })
    emitter.setDepth(998)
    emitter.explode(scaledCount, x, y)
    this.activeParticleCount += scaledCount

    this.scene.time.delayedCall(850, () => {
      this.activeParticleCount = Math.max(0, this.activeParticleCount - scaledCount)
      emitter.destroy()
    })
  }

  /**
   * Start continuous ambient particles for combat atmosphere.
   * Low emission rate to provide background visual interest without performance impact.
   * @param theme Ambient particle theme ('dust', 'embers', 'ice', 'arcane', 'void')
   */
  public startAmbient(theme: 'dust' | 'embers' | 'ice' | 'arcane' | 'void'): void {
    if (this.reduceMotion) {
      return
    }

    if (this.ambientEmitter) {
      this.stopAmbient()
    }

    let texture = 'vfx_square_4'
    let speed = { min: 10, max: 20 }
    let angle = { min: 200, max: 340 }
    let gravityY = 15
    let tints: number | number[] = 0x999999
    let emitRate = 1 // particles per 500ms
    let lifespan = 3000

    switch (theme) {
      case 'dust':
        texture = 'vfx_circle_6'
        speed = { min: 5, max: 15 }
        angle = { min: 180, max: 360 }
        gravityY = 15
        tints = 0x999999
        break

      case 'embers':
        texture = 'vfx_circle_6'
        speed = { min: 20, max: 40 }
        angle = { min: 200, max: 340 }
        gravityY = -25
        tints = [0xff6600, 0xff4400]
        lifespan = 2000
        emitRate = 2
        break

      case 'ice':
        texture = 'vfx_circle_6'
        speed = { min: 8, max: 18 }
        angle = { min: 150, max: 390 }
        gravityY = 5
        tints = 0x88ccff
        break

      case 'arcane':
        texture = 'vfx_diamond_4'
        speed = { min: 15, max: 35 }
        angle = { min: 0, max: 360 }
        gravityY = 0
        tints = [0x9944ff, 0xbb66ff]
        lifespan = 2500
        emitRate = 1.5
        break

      case 'void':
        texture = 'vfx_circle_6'
        speed = { min: 12, max: 32 }
        angle = { min: 0, max: 360 }
        gravityY = 0
        tints = [0xccddff, 0x8899ff]
        lifespan = 2800
        emitRate = 1
        break
    }

    this.ambientEmitter = this.scene.add.particles(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      texture,
      {
        speed,
        angle,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.4, end: 0 },
        tint: tints,
        lifespan,
        gravityY,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(-50, -50, 100, 100),
        } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        emitting: true,
        frequency: 500 / emitRate,
        maxParticles: this.ambientBudget,
      }
    )
    this.ambientEmitter.setDepth(997)
  }

  /**
   * Stop ambient particle emission and clean up emitter.
   */
  public stopAmbient(): void {
    if (this.ambientEmitter) {
      this.ambientEmitter.stop()
      // Let existing particles fade, then destroy emitter
      this.scene.time.delayedCall(3100, () => {
        if (this.ambientEmitter) {
          this.ambientEmitter.destroy()
          this.ambientEmitter = null
        }
      })
    }
  }

  /**
   * Clean up all resources.
   * Stops all active emitters and removes texture keys.
   */
  public destroy(): void {
    if (this.impactEmitter) {
      this.impactEmitter.destroy()
      this.impactEmitter = null
    }

    if (this.directionalEmitter) {
      this.directionalEmitter.destroy()
      this.directionalEmitter = null
    }

    if (this.ambientEmitter) {
      this.ambientEmitter.destroy()
      this.ambientEmitter = null
    }

    // Note: Texture keys are not removed as they may be reused across multiple CombatParticleSystem instances.
    // They will be cleaned up when the scene shuts down.
  }
}
