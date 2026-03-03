// src/game/systems/ParticleSystem.ts

import Phaser from 'phaser'
import { BlockType } from '../../data/types'
import type { Biome } from '../../data/biomes'

// ============================================================
// PER-BLOCK-TYPE PARTICLE CONFIGURATION
// ============================================================

/** Configuration for block-break burst particles */
interface BreakParticleConfig {
  tint: number
  count: number
  lifespan: number
  speed: { min: number; max: number }
  scale: { start: number; end: number }
  gravity?: number
}

/**
 * Per-block-type break particle configurations.
 * Keys are the numeric BlockType enum values.
 */
const BREAK_CONFIGS: Partial<Record<BlockType, BreakParticleConfig>> = {
  [BlockType.Dirt]: {
    tint: 0x5c4033,
    count: 8,
    lifespan: 400,
    speed: { min: 20, max: 60 },
    scale: { start: 0.8, end: 0 },
  },
  [BlockType.SoftRock]: {
    tint: 0x7a6652,
    count: 10,
    lifespan: 450,
    speed: { min: 25, max: 70 },
    scale: { start: 0.9, end: 0 },
  },
  [BlockType.Stone]: {
    tint: 0x6b6b6b,
    count: 10,
    lifespan: 500,
    speed: { min: 30, max: 80 },
    scale: { start: 1.0, end: 0 },
  },
  [BlockType.HardRock]: {
    tint: 0x4a4a4a,
    count: 14,
    lifespan: 600,
    speed: { min: 40, max: 100 },
    scale: { start: 1.2, end: 0 },
    gravity: 150,
  },
  [BlockType.MineralNode]: {
    tint: 0x4ecca3,
    count: 16,
    lifespan: 800,
    speed: { min: 50, max: 120 },
    scale: { start: 1.0, end: 0 },
  },
  [BlockType.ArtifactNode]: {
    tint: 0xe94560,
    count: 20,
    lifespan: 1200,
    speed: { min: 60, max: 150 },
    scale: { start: 1.5, end: 0 },
  },
  [BlockType.LavaBlock]: {
    tint: 0xff4500,
    count: 18,
    lifespan: 900,
    speed: { min: 40, max: 110 },
    scale: { start: 1.2, end: 0 },
    gravity: -60,
  },
  [BlockType.GasPocket]: {
    tint: 0x88ff44,
    count: 22,
    lifespan: 1000,
    speed: { min: 30, max: 90 },
    scale: { start: 1.0, end: 0 },
    gravity: -120,
  },
}

/** Fallback config used when a BlockType has no entry in BREAK_CONFIGS */
const DEFAULT_BREAK_CONFIG: BreakParticleConfig = {
  tint: 0x888888,
  count: 6,
  lifespan: 400,
  speed: { min: 20, max: 60 },
  scale: { start: 0.8, end: 0 },
}

// ============================================================
// TEXTURE KEYS
// ============================================================

/** Texture key prefix for particle squares */
const PARTICLE_TEX_PREFIX = 'particle_sq_'

/** Texture key for O2 warning edge particles */
const O2_WARNING_TEX = 'particle_o2_warn'

// ============================================================
// PARTICLE SYSTEM
// ============================================================

/**
 * Centralised particle system for Terra Miner.
 *
 * Responsibilities:
 *  - Block-break burst emitters (one per configured BlockType)
 *  - Biome-specific ambient continuous emitters (dust motes, gas wisps, crystal sparks)
 *  - O2 warning edge-glow particles
 *
 * Usage:
 *  ```ts
 *  const particles = new ParticleSystem(scene)
 *  particles.init()
 *  // …on block break:
 *  particles.emitBreak(BlockType.Stone, worldX, worldY)
 *  // …when entering a biome layer:
 *  particles.startAmbientEmitters(biome, worldWidth, worldHeight)
 *  // …when O2 is critical:
 *  particles.setO2Warning(true, cam.scrollX, cam.scrollY, viewW, viewH)
 *  ```
 */
export class ParticleSystem {
  private scene: Phaser.Scene

  /** Map from BlockType value → pre-built emitter (stopped; emitParticleAt called on demand) */
  private breakEmitters: Map<BlockType, Phaser.GameObjects.Particles.ParticleEmitter> = new Map()

  /** Currently active ambient emitters for the current biome layer */
  private ambientEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []

  /** O2 warning emitters (four edges) */
  private o2Emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []

  /** Whether the O2 warning particles are currently active */
  private o2Active = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /**
   * Ensures a plain white square texture exists in the scene texture manager.
   * Creates it procedurally via Graphics if it is not already registered.
   *
   * @param key - Texture key to register
   * @param size - Side length of the square in pixels
   */
  private ensureTexture(key: string, size: number): void {
    if (this.scene.textures.exists(key)) return

    const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false)
    gfx.fillStyle(0xffffff, 1)
    gfx.fillRect(0, 0, size, size)
    gfx.generateTexture(key, size, size)
    gfx.destroy()
  }

  // ----------------------------------------------------------
  // LIFECYCLE
  // ----------------------------------------------------------

  /**
   * Initialises all emitters.
   * Must be called once during the owning scene's `create()` phase.
   */
  init(): void {
    // Ensure base textures exist
    this.ensureTexture(PARTICLE_TEX_PREFIX + '4', 4)
    this.ensureTexture(PARTICLE_TEX_PREFIX + '3', 3)
    this.ensureTexture(PARTICLE_TEX_PREFIX + '2', 2)
    this.ensureTexture(O2_WARNING_TEX, 6)

    // Pre-build one stopped emitter per BlockType config
    for (const [typeStr, cfg] of Object.entries(BREAK_CONFIGS) as [string, BreakParticleConfig][]) {
      const blockType = Number(typeStr) as BlockType
      const texKey = PARTICLE_TEX_PREFIX + '4'

      const emitter = this.scene.add.particles(0, 0, texKey, {
        color: [cfg.tint],
        lifespan: cfg.lifespan,
        speed: cfg.speed,
        scale: cfg.scale,
        gravityY: cfg.gravity ?? 80,
        alpha: { start: 1, end: 0 },
        quantity: 1,
        frequency: -1, // manual / explode mode
        emitting: false,
      })

      emitter.setDepth(200)
      this.breakEmitters.set(blockType, emitter)
    }
  }

  // ----------------------------------------------------------
  // BLOCK-BREAK BURSTS
  // ----------------------------------------------------------

  /**
   * Fires a block-break particle burst at the given world position.
   *
   * @param blockType - The type of block that was broken
   * @param px - World X position of the block centre
   * @param py - World Y position of the block centre
   */
  emitBreak(blockType: BlockType, px: number, py: number): void {
    const cfg = BREAK_CONFIGS[blockType] ?? DEFAULT_BREAK_CONFIG

    let emitter = this.breakEmitters.get(blockType)
    if (!emitter) {
      // Fallback: create an ad-hoc emitter for block types without a pre-built one
      const texKey = PARTICLE_TEX_PREFIX + '4'
      this.ensureTexture(texKey, 4)
      emitter = this.scene.add.particles(px, py, texKey, {
        color: [cfg.tint],
        lifespan: cfg.lifespan,
        speed: cfg.speed,
        scale: cfg.scale,
        gravityY: cfg.gravity ?? 80,
        alpha: { start: 1, end: 0 },
        quantity: 1,
        frequency: -1,
        emitting: false,
      })
      emitter.setDepth(200)
      this.breakEmitters.set(blockType, emitter)
    }

    emitter.setPosition(px, py)
    emitter.explode(cfg.count)
  }

  // ----------------------------------------------------------
  // AMBIENT EMITTERS
  // ----------------------------------------------------------

  /**
   * Starts biome-specific continuous ambient particle emitters.
   * Stops and replaces any previously running ambient emitters.
   *
   * Biome ambient effects:
   *  - `volcanic`    → Rising ember/spark motes
   *  - `crystalline` → Drifting crystal sparkles
   *  - `sedimentary` → Slow falling dust
   *  - (all others)  → Minimal dust
   *
   * @param biome - The Biome descriptor for the current layer
   * @param worldWidth - Total world width in pixels (for emitter zone coverage)
   * @param worldHeight - Total world height in pixels
   */
  startAmbientEmitters(biome: Biome, worldWidth: number, worldHeight: number): void {
    this.stopAmbientEmitters()

    const texSmall = PARTICLE_TEX_PREFIX + '2'
    this.ensureTexture(texSmall, 2)

    const texMedium = PARTICLE_TEX_PREFIX + '3'
    this.ensureTexture(texMedium, 3)

    // Each biome adds its own set of emitters
    switch (biome.id) {
      case 'volcanic': {
        // Embers rising from bottom of world — fast, upward, warm red-orange
        const embers = this.scene.add.particles(0, worldHeight, texSmall, {
          color: [0xff4500, 0xff6a00, 0xffaa00],
          lifespan: { min: 1000, max: 2200 },
          speed: { min: 15, max: 50 },
          angle: { min: 240, max: 300 }, // upward spread
          scale: { start: 0.6, end: 0 },
          alpha: { start: 0.9, end: 0 },
          quantity: 1,
          frequency: 80,
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(0, 0, worldWidth, 20),
          } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        })
        embers.setDepth(50)
        this.ambientEmitters.push(embers)

        // Hot gas shimmer — subtle, quick, scattered
        const shimmer = this.scene.add.particles(0, 0, texSmall, {
          color: [0xff2200, 0xff7722],
          lifespan: { min: 500, max: 900 },
          speed: { min: 5, max: 20 },
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.4, end: 0 },
          quantity: 1,
          frequency: 120,
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(0, 0, worldWidth, worldHeight),
          } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        })
        shimmer.setDepth(50)
        this.ambientEmitters.push(shimmer)
        break
      }

      case 'crystalline': {
        // Crystal sparkles — slow drift, blue/cyan/white tints
        const sparkles = this.scene.add.particles(0, 0, texSmall, {
          color: [0x88eeff, 0x44ccff, 0xffffff, 0xaaffdd],
          lifespan: { min: 1500, max: 3500 },
          speed: { min: 3, max: 18 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 0.8, end: 0 },
          quantity: 1,
          frequency: 60,
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(0, 0, worldWidth, worldHeight),
          } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        })
        sparkles.setDepth(50)
        this.ambientEmitters.push(sparkles)

        // Occasional bright flash — rare, bigger, pure white
        const flashes = this.scene.add.particles(0, 0, texMedium, {
          color: [0xffffff],
          lifespan: { min: 200, max: 500 },
          speed: { min: 0, max: 5 },
          scale: { start: 1.2, end: 0 },
          alpha: { start: 1, end: 0 },
          quantity: 1,
          frequency: 400,
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(0, 0, worldWidth, worldHeight),
          } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        })
        flashes.setDepth(51)
        this.ambientEmitters.push(flashes)
        break
      }

      case 'sedimentary':
      default: {
        // Falling dust particles — slow, brownish
        const dust = this.scene.add.particles(0, 0, texSmall, {
          color: [0x887766, 0x998877, 0x776655],
          lifespan: { min: 2000, max: 4000 },
          speed: { min: 4, max: 12 },
          angle: { min: 80, max: 100 }, // mostly downward
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.5, end: 0 },
          quantity: 1,
          frequency: 150,
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(0, 0, worldWidth, 20),
          } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
        })
        dust.setDepth(50)
        this.ambientEmitters.push(dust)
        break
      }
    }
  }

  /**
   * Stops all active ambient emitters and removes them from the scene.
   */
  stopAmbientEmitters(): void {
    for (const emitter of this.ambientEmitters) {
      emitter.stop()
      emitter.destroy()
    }
    this.ambientEmitters = []
  }

  // ----------------------------------------------------------
  // O2 WARNING EDGE PARTICLES
  // ----------------------------------------------------------

  /**
   * Activates or deactivates the O2 critical-warning edge particle effect.
   * When active, red pulsing particles appear along all four viewport edges.
   *
   * @param active - Whether the warning should be shown
   * @param camScrollX - Camera scroll X (world X of viewport left edge)
   * @param camScrollY - Camera scroll Y (world Y of viewport top edge)
   * @param viewWidth - Viewport width in pixels
   * @param viewHeight - Viewport height in pixels
   */
  setO2Warning(
    active: boolean,
    camScrollX: number,
    camScrollY: number,
    viewWidth: number,
    viewHeight: number,
  ): void {
    if (active === this.o2Active && active === (this.o2Emitters.length > 0)) return

    if (!active) {
      this._destroyO2Emitters()
      this.o2Active = false
      return
    }

    this.ensureTexture(O2_WARNING_TEX, 6)
    this._destroyO2Emitters()
    this.o2Active = true

    const edgeConfigs = [
      // Top edge
      {
        x: camScrollX,
        y: camScrollY,
        zone: new Phaser.Geom.Rectangle(0, 0, viewWidth, 4),
        angle: { min: 60, max: 120 },
      },
      // Bottom edge
      {
        x: camScrollX,
        y: camScrollY + viewHeight - 4,
        zone: new Phaser.Geom.Rectangle(0, 0, viewWidth, 4),
        angle: { min: 240, max: 300 },
      },
      // Left edge
      {
        x: camScrollX,
        y: camScrollY,
        zone: new Phaser.Geom.Rectangle(0, 0, 4, viewHeight),
        angle: { min: 330, max: 390 },
      },
      // Right edge
      {
        x: camScrollX + viewWidth - 4,
        y: camScrollY,
        zone: new Phaser.Geom.Rectangle(0, 0, 4, viewHeight),
        angle: { min: 150, max: 210 },
      },
    ]

    for (const cfg of edgeConfigs) {
      const emitter = this.scene.add.particles(cfg.x, cfg.y, O2_WARNING_TEX, {
        color: [0xff0000, 0xff4444, 0xff8800],
        lifespan: { min: 300, max: 600 },
        speed: { min: 10, max: 40 },
        angle: cfg.angle,
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        quantity: 2,
        frequency: 40,
        emitZone: {
          type: 'random',
          source: cfg.zone,
        } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
      })
      emitter.setDepth(300)
      this.o2Emitters.push(emitter)
    }
  }

  // ----------------------------------------------------------
  // CLEANUP
  // ----------------------------------------------------------

  /**
   * Destroys all particle emitters managed by this system.
   * Call when the owning scene shuts down.
   */
  destroy(): void {
    // Destroy break emitters
    for (const emitter of this.breakEmitters.values()) {
      emitter.destroy()
    }
    this.breakEmitters.clear()

    // Destroy ambient emitters
    this.stopAmbientEmitters()

    // Destroy O2 warning emitters
    this._destroyO2Emitters()
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /** Tears down the four O2 warning emitters. */
  private _destroyO2Emitters(): void {
    for (const emitter of this.o2Emitters) {
      emitter.stop()
      emitter.destroy()
    }
    this.o2Emitters = []
  }
}
