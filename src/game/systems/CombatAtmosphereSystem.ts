import Phaser from 'phaser'
import { getDeviceTier } from '../../services/deviceTierService'
import {
  getAtmosphereConfig,
  getBossAtmosphereConfig,
  type FloorTheme,
  type AtmosphereConfig,
} from '../../data/roomAtmosphere'

function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
  } catch {
    return false
  }
}

/** Maps particle type names to their procedural texture keys. */
const PARTICLE_TEXTURE_MAP: Record<string, string> = {
  dust: 'atm_dust',
  embers: 'atm_ember',
  ice_crystals: 'atm_ice',
  arcane_runes: 'atm_arcane',
  void_wisps: 'atm_void',
}

/**
 * CombatAtmosphereSystem manages ambient particles, fog overlays, and
 * light shafts that give each floor a distinct atmospheric feel.
 * Uses dual-depth emitters (back depth 3, front depth 12) with
 * per-type procedural particle textures and optional light shaft sprites.
 * Configuration is driven by {@link AtmosphereConfig} presets from roomAtmosphere.ts.
 */
export class CombatAtmosphereSystem {
  private scene: Phaser.Scene
  private fogGfx: Phaser.GameObjects.Graphics | null = null
  private fogTween: Phaser.Tweens.Tween | null = null
  private backEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private frontEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private lightShafts: Phaser.GameObjects.Image[] = []
  private lightShaftTweens: Phaser.Tweens.Tween[] = []
  private reduceMotion: boolean
  private currentTheme: FloorTheme = 'dust'
  private config: AtmosphereConfig | null = null
  private isActive = false
  private enemyX: number = 0
  private bgLightPool: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image | null = null
  private bgLightPoolTween: Phaser.Tweens.Tween | null = null

  // ── Chain modifier state (Spec 03) ────────────────────────────────────────
  /** Base frequency stored at start() for back emitter so chain mods can restore it. */
  private baseBackFrequency: number = 0
  /** Base frequency stored at start() for front emitter so chain mods can restore it. */
  private baseFrontFrequency: number = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.reduceMotion = isReduceMotionEnabled()
  }

  /**
   * Returns the current atmosphere config, or null if not yet started.
   */
  public getConfig(): AtmosphereConfig | null {
    return this.config
  }

  /**
   * Temporarily double the front emitter's particle emission rate for a brief
   * visual spike (e.g. at turn transitions). No-op if reduceMotion is active
   * or if no front emitter exists.
   * @param durationMs How long to hold the spiked rate before restoring.
   */
  public spikeParticleRate(durationMs: number): void {
    if (!this.frontEmitter || this.reduceMotion) return
    // frequency is ms-between-emissions; halving it doubles the emission rate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origFreq: number = (this.frontEmitter as any).frequency
    this.frontEmitter.setFrequency(Math.max(1, Math.round(origFreq / 2)))
    this.scene.time.delayedCall(durationMs, () => {
      if (this.frontEmitter) this.frontEmitter.setFrequency(origFreq)
    })
  }

  /**
   * Apply chain combo atmosphere modifiers.
   * Scales both emitter frequencies so particles emit more often during a chain.
   * No-op on low-end devices or when reduceMotion is active.
   * @param frequencyMultiplier Interval multiplier (0.5 = double rate, 1.0 = no change).
   */
  public applyChainModifiers(frequencyMultiplier: number): void {
    if (!this.isActive || this.reduceMotion) return
    if (getDeviceTier() === 'low-end') return
    if (this.backEmitter && this.baseBackFrequency > 0) {
      this.backEmitter.setFrequency(Math.max(1, Math.round(this.baseBackFrequency * frequencyMultiplier)))
    }
    if (this.frontEmitter && this.baseFrontFrequency > 0) {
      this.frontEmitter.setFrequency(Math.max(1, Math.round(this.baseFrontFrequency * frequencyMultiplier)))
    }
  }

  /**
   * Reset particle emission rates to their base values after a chain ends.
   * No-op if system is not active or emitters are absent.
   */
  public clearChainModifiers(): void {
    if (!this.isActive) return
    if (this.backEmitter && this.baseBackFrequency > 0) {
      this.backEmitter.setFrequency(this.baseBackFrequency)
    }
    if (this.frontEmitter && this.baseFrontFrequency > 0) {
      this.frontEmitter.setFrequency(this.baseFrontFrequency)
    }
  }

  /**
   * Set the enemy's X position so the spotlight can center on it.
   * @param x The enemy's X coordinate
   */
  public setEnemyPosition(x: number): void {
    this.enemyX = x
    // Reposition existing spotlight
    for (const shaft of this.lightShafts) {
      shaft.setX(x)
    }
    // After the existing light shaft repositioning code, recreate the background light pool
    if (this.bgLightPool && this.config?.lightShafts.enabled) {
      if (this.bgLightPoolTween) { this.bgLightPoolTween.destroy(); this.bgLightPoolTween = null }
      this.bgLightPool.destroy()
      this.bgLightPool = null
      this.createBackgroundLightPool()
    }
  }

  /**
   * Start atmosphere effects for a given floor.
   * Always sets config even if reduceMotion is enabled so getConfig() works.
   * @param floor Current dungeon floor number
   * @param isBoss Whether this is a boss encounter
   */
  public start(floor: number, isBoss: boolean): void {
    this.stop()
    this.config = isBoss ? getBossAtmosphereConfig(floor) : getAtmosphereConfig(floor)
    this.currentTheme = this.config.theme
    if (this.reduceMotion) return

    this.isActive = true
    const w = this.scene.scale.width
    const h = this.scene.scale.height

    // ── Fog layer (depth 2) ───────────────────────────
    // Skipped on mid/flagship where DepthLightingFX handles depth-based fog
    if (getDeviceTier() === 'low-end') {
      this.fogGfx = this.scene.add.graphics().setDepth(2).setAlpha(this.config.fogAlpha)
      this.fogGfx.fillStyle(0x000000, this.config.fogAlpha)
      this.fogGfx.fillRect(0, h * 0.6, w, h * 0.4)

      // Gentle alpha oscillation for fog drift
      this.fogTween = this.scene.tweens.add({
        targets: this.fogGfx,
        alpha: { from: this.config.fogAlpha, to: this.config.fogAlpha * 1.5 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // ── Particles ─────────────────────────────────────
    const pConfig = this.config.particles
    if (pConfig.type !== 'none') {
      this.ensureParticleTextures()
      const textureKey = PARTICLE_TEXTURE_MAP[pConfig.type] ?? 'atm_dust'

      // Back emitter — large slow particles behind everything (depth 3)
      this.backEmitter = this.scene.add.particles(0, 0, textureKey, {
        x: { min: 0, max: w },
        y: { min: 0, max: h },
        scale: { min: pConfig.scaleRange[0], max: pConfig.scaleRange[1] },
        alpha: { start: 0.1, end: 0.6, ease: 'Sine.easeInOut' },
        lifespan: pConfig.lifespan,
        speedX: { min: -10, max: 10 },
        speedY: { min: -8, max: 8 },
        gravityY: pConfig.gravityY,
        frequency: pConfig.frequency,
        quantity: 1,
        maxAliveParticles: this.getScaledBudget(pConfig.maxBack),
        blendMode: pConfig.blendMode,
        tint: pConfig.tints,
        advance: 3000,
      }).setDepth(3)

      // Store base frequencies for chain modifier restoration
      this.baseBackFrequency = pConfig.frequency

      // Front emitter — smaller faster particles in front of characters (depth 12)
      this.frontEmitter = this.scene.add.particles(0, 0, textureKey, {
        x: { min: 0, max: w },
        y: { min: 0, max: h },
        scale: { min: pConfig.scaleRange[0] * 0.8, max: pConfig.scaleRange[1] * 0.7 },
        alpha: { start: 0.05, end: 0.4, ease: 'Sine.easeInOut' },
        lifespan: pConfig.lifespan * 0.8,
        speedX: { min: -12, max: 12 },
        speedY: { min: -6, max: 6 },
        gravityY: pConfig.gravityY,
        frequency: Math.round(pConfig.frequency * 1.5),
        quantity: 1,
        maxAliveParticles: this.getScaledBudget(pConfig.maxFront),
        blendMode: pConfig.blendMode,
        tint: pConfig.tints,
        advance: 2000,
      }).setDepth(12)

      this.baseFrontFrequency = Math.round(pConfig.frequency * 1.5)

      // Embers rise from the bottom third of the screen.
      // Cast to `any` to work around a Phaser typings mismatch: Rectangle.getRandomPoint
      // returns `O extends Point` but RandomZoneSource expects `Vector2Like`.
      if (pConfig.type === 'embers') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bottomRect = new Phaser.Geom.Rectangle(0, h * 0.7, w, h * 0.3) as any
        const backZone = new Phaser.GameObjects.Particles.Zones.RandomZone(bottomRect)
        const frontZone = new Phaser.GameObjects.Particles.Zones.RandomZone(bottomRect)
        this.backEmitter.setEmitZone(backZone)
        this.frontEmitter.setEmitZone(frontZone)
      }
    }

    // ── Light shafts ──────────────────────────────────
    this.createLightShafts()
    // Background light pool only needed on low-end where DepthLightingFX is inactive
    if (getDeviceTier() === 'low-end') {
      this.createBackgroundLightPool()
    }
  }

  /** Stop all atmosphere effects and clean up. */
  public stop(): void {
    this.isActive = false
    this.baseBackFrequency = 0
    this.baseFrontFrequency = 0

    if (this.fogTween) { this.fogTween.destroy(); this.fogTween = null }
    if (this.fogGfx) { this.fogGfx.destroy(); this.fogGfx = null }

    if (this.backEmitter) { this.backEmitter.destroy(); this.backEmitter = null }
    if (this.frontEmitter) { this.frontEmitter.destroy(); this.frontEmitter = null }

    for (const tween of this.lightShaftTweens) { tween.destroy() }
    this.lightShaftTweens = []
    for (const shaft of this.lightShafts) { shaft.destroy() }
    this.lightShafts = []

    if (this.bgLightPoolTween) { this.bgLightPoolTween.destroy(); this.bgLightPoolTween = null }
    if (this.bgLightPool) { this.bgLightPool.destroy(); this.bgLightPool = null }
  }

  /** Clean up all resources. */
  public destroy(): void {
    this.stop()
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Scales particle budget based on device tier to maintain performance.
   */
  private getScaledBudget(configMax: number): number {
    const tier = getDeviceTier()
    if (tier === 'low-end') return Math.max(2, Math.round(configMax * 0.4))
    if (tier === 'mid') return Math.round(configMax * 0.7)
    return configMax
  }

  /**
   * Creates procedural particle textures for each atmosphere type.
   * Only generates textures that don't already exist in the texture cache.
   */
  private ensureParticleTextures(): void {
    // atm_dust — 4x4 filled white square
    if (!this.scene.textures.exists('atm_dust')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(0, 0, 4, 4)
      gfx.generateTexture('atm_dust', 4, 4)
      gfx.destroy()
    }

    // atm_ember — 5x5 with outer ring at alpha 0.4, inner 3x3 at alpha 1.0
    if (!this.scene.textures.exists('atm_ember')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff, 0.4)
      gfx.fillRect(0, 0, 5, 5)
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(1, 1, 3, 3)
      gfx.generateTexture('atm_ember', 5, 5)
      gfx.destroy()
    }

    // atm_ice — 5x5 diamond (center + 4 cardinal + 4 diagonal pixels)
    if (!this.scene.textures.exists('atm_ice')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff, 1)
      // Center
      gfx.fillRect(2, 2, 1, 1)
      // Cardinal arms
      gfx.fillRect(2, 0, 1, 1)
      gfx.fillRect(2, 4, 1, 1)
      gfx.fillRect(0, 2, 1, 1)
      gfx.fillRect(4, 2, 1, 1)
      // Diagonal arms
      gfx.fillRect(1, 1, 1, 1)
      gfx.fillRect(3, 1, 1, 1)
      gfx.fillRect(1, 3, 1, 1)
      gfx.fillRect(3, 3, 1, 1)
      gfx.generateTexture('atm_ice', 5, 5)
      gfx.destroy()
    }

    // atm_arcane — 6x6 cross shape (vertical 2px bar + horizontal 2px bar)
    if (!this.scene.textures.exists('atm_arcane')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff, 1)
      // Vertical bar (2px wide, full height)
      gfx.fillRect(2, 0, 2, 6)
      // Horizontal bar (full width, 2px tall)
      gfx.fillRect(0, 2, 6, 2)
      gfx.generateTexture('atm_arcane', 6, 6)
      gfx.destroy()
    }

    // atm_void — 7x7 soft circle at alpha 0.3, bright center pixel at alpha 0.9
    if (!this.scene.textures.exists('atm_void')) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0 })
      gfx.fillStyle(0xffffff, 0.3)
      gfx.fillCircle(3, 3, 3)
      gfx.fillStyle(0xffffff, 0.9)
      gfx.fillRect(3, 3, 1, 1)
      gfx.generateTexture('atm_void', 7, 7)
      gfx.destroy()
    }
  }

  /**
   * Creates a smooth spotlight cone using overlapping radial gradients.
   * No clip paths — the cone shape emerges naturally from stacked gradient circles
   * that grow wider as they move down, with soft falloff at every edge.
   */
  private createLightShafts(): void {
    if (!this.config?.lightShafts.enabled) return
    if (getDeviceTier() === 'low-end') return

    const w = this.scene.scale.width
    const h = this.scene.scale.height
    const shaftConfig = this.config.lightShafts
    const cx = this.enemyX || w * 0.5

    const texKey = 'spotlight_soft'
    if (this.scene.textures.exists(texKey)) {
      this.scene.textures.remove(texKey)
    }

    // Make texture wide enough for the full cone
    const tw = Math.round(w * 0.7)
    const th = Math.round(h * 0.92)
    const canvasTex = this.scene.textures.createCanvas(texKey, tw, th)
    if (!canvasTex) return

    const ctx = canvasTex.getContext()
    const centerX = tw / 2

    // Draw the cone as many overlapping radial gradients stacked vertically.
    // Each layer is a horizontal radial gradient that:
    // - Gets wider as Y increases (cone widens downward)
    // - Gets dimmer as Y increases (light fades with distance)
    // - Has smooth Gaussian-like falloff at edges (no hard boundaries)
    const layers = 30
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1) // 0 = top, 1 = bottom

      // Y position for this gradient layer
      const y = t * th

      // Radius grows from tiny at top to wide at bottom
      // Use a curve so it expands faster near the bottom
      const radius = 8 + Math.pow(t, 0.7) * (tw * 0.42)

      // Alpha diminishes from top to bottom
      // Bright at top (source), fading toward floor
      const layerAlpha = (1 - t * 0.8) * 0.12

      if (layerAlpha < 0.002) continue

      const grad = ctx.createRadialGradient(centerX, y, 0, centerX, y, radius)
      grad.addColorStop(0, `rgba(255, 255, 255, ${layerAlpha})`)
      grad.addColorStop(0.4, `rgba(255, 255, 255, ${layerAlpha * 0.6})`)
      grad.addColorStop(0.7, `rgba(255, 255, 255, ${layerAlpha * 0.2})`)
      grad.addColorStop(1.0, `rgba(255, 255, 255, 0)`)

      ctx.fillStyle = grad
      ctx.fillRect(0, 0, tw, th)
    }

    canvasTex.refresh()

    // Display as a single image with ADD blend
    const shaft = this.scene.add.image(cx, 0, texKey)
      .setOrigin(0.5, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(shaftConfig.alpha)
      .setTint(shaftConfig.tint)
      .setDepth(4)

    this.lightShafts.push(shaft)

    // Very subtle breathing
    const tween = this.scene.tweens.add({
      targets: shaft,
      alpha: { from: shaftConfig.alpha * 0.8, to: shaftConfig.alpha },
      scaleX: { from: 0.98, to: 1.02 },
      duration: 5000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.lightShaftTweens.push(tween)
  }

  /**
   * Creates a smooth light pool on the background using canvas radial gradients.
   * No banding — uses Canvas2D createRadialGradient for buttery-smooth falloff.
   */
  private createBackgroundLightPool(): void {
    if (!this.config?.lightShafts.enabled) return
    if (getDeviceTier() === 'low-end') return

    const w = this.scene.scale.width
    const h = this.scene.scale.height
    const cx = this.enemyX || w * 0.5
    const shaftConfig = this.config.lightShafts

    // Convert tint hex to CSS color components
    const col = Phaser.Display.Color.ValueToColor(shaftConfig.tint)
    const r = col.red, g = col.green, b = col.blue

    // Generate smooth floor pool texture
    const texKey = 'bg_light_pool'
    // Always regenerate (position-dependent)
    if (this.scene.textures.exists(texKey)) {
      this.scene.textures.remove(texKey)
    }

    const tw = Math.round(w * 0.6)  // texture width
    const th = Math.round(h * 0.5)  // texture height
    const canvasTex = this.scene.textures.createCanvas(texKey, tw, th)
    if (!canvasTex) return

    const ctx = canvasTex.getContext()

    // Floor pool — elliptical radial gradient
    // Centered in texture, wider than tall (floor perspective)
    const poolCX = tw / 2
    const poolCY = th * 0.6

    const grad = ctx.createRadialGradient(
      poolCX, poolCY, 0,
      poolCX, poolCY, tw * 0.45
    )
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`)
    grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.2)`)
    grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.08)`)
    grad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, tw, th)

    // Wall wash — upper area, dimmer
    const wallGrad = ctx.createRadialGradient(
      poolCX, th * 0.2, 0,
      poolCX, th * 0.2, tw * 0.35
    )
    wallGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`)
    wallGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.06)`)
    wallGrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`)
    ctx.fillStyle = wallGrad
    ctx.fillRect(0, 0, tw, th)

    canvasTex.refresh()

    // Create image from the texture
    const poolImg = this.scene.add.image(cx, h * 0.35, texKey)
      .setOrigin(0.5, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1)

    // Scale to squish vertically for floor perspective
    poolImg.setScale(1.0, 0.8)

    // Store for cleanup — reuse bgLightPool field but as any since it was Graphics before
    this.bgLightPool = poolImg as any

    // Gentle breathing
    this.bgLightPoolTween = this.scene.tweens.add({
      targets: poolImg,
      alpha: { from: 0.7, to: 1.0 },
      duration: 5000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }
}
