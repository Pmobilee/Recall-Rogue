/**
 * Manages per-biome ambient particle emitters.
 * Phase 9.5 — enforces a global particle budget and supports LOD reduction.
 * Phase 28 — uses device quality preset for particle budget (DD-V2-215).
 */

import { BIOME_PARTICLE_CONFIGS, type ParticleConfig } from '../../data/biomeParticles'
import { getQualityPreset } from '../../services/deviceTierService'

/** Hard cap on ambient particles visible at any time (DD-V2-253) */
const VIEWPORT_PARTICLE_CAP = 20
/** LOD cap for low-memory devices */
const VIEWPORT_PARTICLE_CAP_LOD = 10

/**
 * Manages per-biome ambient particle emitters for MineScene.
 * Enforces a global particle budget and supports LOD reduction for low-capability devices.
 */
export class BiomeParticleManager {
  private scene: Phaser.Scene
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  private currentBiomeId: string | null = null
  private lodMultiplier: number = 1.0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.lodMultiplier = this.detectLOD()
  }

  /**
   * Activates particle emitters for the given biome.
   * Destroys previous biome's emitters first.
   * Uses device quality preset for particle budget (DD-V2-215).
   */
  public activateBiome(biomeId: string): void {
    this.destroyAll()
    this.currentBiomeId = biomeId
    const configs = BIOME_PARTICLE_CONFIGS[biomeId] ?? []
    const maxParticles = getQualityPreset().ambientParticleBudget
    const perEmitterBudget = Math.floor(maxParticles / Math.max(configs.length, 1))
    for (const config of configs) {
      const emitter = this.createEmitter(config, perEmitterBudget)
      if (emitter) this.emitters.push(emitter)
    }
  }

  /** Destroys all active emitters and resets state. */
  public destroyAll(): void {
    for (const emitter of this.emitters) {
      emitter.destroy()
    }
    this.emitters = []
    this.currentBiomeId = null
  }

  /** Returns the current active biome ID, or null if none. */
  public getActiveBiome(): string | null {
    return this.currentBiomeId
  }

  /** Returns the total active particle count across all emitters. */
  public getParticleCount(): number {
    let count = 0
    for (const emitter of this.emitters) {
      count += emitter.getAliveParticleCount()
    }
    return count
  }

  /** Returns the total number of active particles across all emitters. */
  public getActiveParticleCount(): number {
    return this.getParticleCount()
  }

  /** Returns the viewport particle cap, respecting LOD for low-memory devices. */
  private getViewportCap(): number {
    const nav = globalThis.navigator as Navigator & { deviceMemory?: number }
    if (nav?.deviceMemory !== undefined && nav.deviceMemory < 4) {
      return VIEWPORT_PARTICLE_CAP_LOD
    }
    return VIEWPORT_PARTICLE_CAP
  }

  /**
   * Enforces viewport particle budget (DD-V2-253).
   * Pauses emitters when count exceeds cap, resumes at 80% hysteresis.
   */
  public enforceViewportBudget(_cameraBounds: { x: number; y: number; width: number; height: number }): void {
    if (!this.emitters.length) return
    const count = this.getActiveParticleCount()
    const cap = this.getViewportCap()
    if (count >= cap) {
      // Pause all emitters
      for (const emitter of this.emitters) {
        emitter.pause()
      }
    } else if (count < cap * 0.8) {
      // Resume (hysteresis)
      for (const emitter of this.emitters) {
        emitter.resume()
      }
    }
  }

  private createEmitter(
    config: ParticleConfig,
    maxParticles: number,
  ): Phaser.GameObjects.Particles.ParticleEmitter | null {
    // Check if texture exists — if not, skip this emitter silently
    if (!this.scene.textures.exists(config.texture)) {
      return null
    }
    const adjustedFrequency = config.frequency * this.lodMultiplier
    const emitter = this.scene.add.particles(0, 0, config.texture, {
      tint: config.tint,
      alpha: config.alpha,
      scale: config.scale,
      speed: config.speed,
      lifespan: config.lifespan,
      frequency: adjustedFrequency > 0 ? 1000 / adjustedFrequency : -1,
      blendMode: config.blendMode,
      angle: config.angle,
      gravityY: config.gravityY ?? 0,
      maxParticles,
      emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(
        // Phaser.Geom.Rectangle satisfies RandomZoneSource at runtime; cast resolves
        // the strict callback signature mismatch in phaser.d.ts.
        new Phaser.Geom.Rectangle(
          0, 0,
          this.scene.scale.width,
          this.scene.scale.height,
        ) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource,
      ),
    })
    return emitter
  }

  /**
   * Detects device capability and returns an LOD frequency multiplier.
   * Low-end devices get 0.3× particle frequency.
   */
  private detectLOD(): number {
    if (typeof navigator === 'undefined') return 1.0
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    if (mem !== undefined && mem <= 2) return 0.3
    return 1.0
  }
}
