// src/game/systems/ScreenShakeSystem.ts

/** Available shake tiers, in ascending intensity order */
export type ShakeTier = 'micro' | 'medium' | 'heavy'

/** Internal shake tier configuration */
interface ShakeTierConfig {
  /** Peak amplitude in pixels */
  amplitude: number
  /** Total shake duration in milliseconds */
  durationMs: number
  /** Oscillation frequency in Hz */
  frequencyHz: number
}

/** Tier configurations (spec: micro=2px/100ms/40Hz, medium=4px/200ms/28Hz, heavy=8px/400ms/18Hz) */
const SHAKE_TIERS: Record<ShakeTier, ShakeTierConfig> = {
  micro:  { amplitude: 2, durationMs: 100, frequencyHz: 40 },
  medium: { amplitude: 4, durationMs: 200, frequencyHz: 28 },
  heavy:  { amplitude: 8, durationMs: 400, frequencyHz: 18 },
}

/** Priority ordering for tier comparison (higher index = higher priority) */
const TIER_PRIORITY: ShakeTier[] = ['micro', 'medium', 'heavy']

/**
 * Smooth 1D value noise using linear interpolation with smoothstep.
 *
 * Produces pseudo-random values in [-1, 1] based on a continuous input x.
 * Uses integer-indexed pseudo-random lattice values and smoothstep blending.
 *
 * @param x - Continuous input value
 * @returns Interpolated noise value in [-1, 1]
 */
function smoothNoise1D(x: number): number {
  const i0 = Math.floor(x)
  const i1 = i0 + 1
  const t = x - i0

  // Smoothstep S-curve: 3t² - 2t³
  const s = t * t * (3 - 2 * t)

  // Pseudo-random lattice via bit-mixing
  const hash = (n: number): number => {
    let h = n * 1664525 + 1013904223
    h = Math.imul(h, h ^ (h >>> 15))
    h = Math.imul(h ^ (h >>> 13), 0xac4d1a2e)
    return ((h ^ (h >>> 15)) & 0x7fffffff) / 0x7fffffff * 2 - 1
  }

  return hash(i0) * (1 - s) + hash(i1) * s
}

/**
 * Perlin-noise-based screen shake system with 3 intensity tiers.
 *
 * Features:
 *  - Smooth 1D noise for organic-feeling oscillation (not uniform random)
 *  - Linear fade-out envelope (last 30% of duration)
 *  - Respects `prefers-reduced-motion` media query
 *  - Intensity slider support (0.0–1.0)
 *  - Higher priority tier replaces lower; lower tier ignored during higher
 *  - Camera scroll offset approach (not Phaser camera.shake())
 */
export class ScreenShakeSystem {
  private scene: Phaser.Scene

  /** Currently active shake tier (null = no shake) */
  private activeTier: ShakeTier | null = null

  /** Time elapsed in the current shake (ms) */
  private elapsed = 0

  /** Config snapshot for the currently active shake */
  private activeConfig: ShakeTierConfig | null = null

  /** User-facing intensity multiplier (0.0–1.0, default 1.0) */
  private intensityMultiplier = 1.0

  /** Accumulated camera scroll offset from this system */
  private offsetX = 0
  private offsetY = 0

  /** Seed value for the noise function (randomized per shake) */
  private noiseSeedX = 0
  private noiseSeedY = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  /**
   * Trigger a shake at the given tier.
   *
   * Higher priority tiers replace lower priority active shakes.
   * If an equal or higher priority shake is already running, this call is ignored.
   *
   * @param tier - The shake intensity tier to trigger
   */
  trigger(tier: ShakeTier): void {
    // Respect reduced motion preference
    if (this._isReducedMotion()) return

    // Ignore if current tier has equal or higher priority
    if (this.activeTier !== null) {
      const currentPriority = TIER_PRIORITY.indexOf(this.activeTier)
      const newPriority = TIER_PRIORITY.indexOf(tier)
      if (currentPriority >= newPriority) return
    }

    // Restore camera offset before starting new shake
    this._restoreCamera()

    this.activeTier = tier
    this.activeConfig = SHAKE_TIERS[tier]
    this.elapsed = 0

    // Randomize noise seed so each shake feels different
    this.noiseSeedX = Math.random() * 1000
    this.noiseSeedY = Math.random() * 1000 + 500
  }

  /**
   * Sets the intensity multiplier.
   * Clamps to [0.0, 1.0].
   *
   * @param intensity - Value from 0.0 (no shake) to 1.0 (full shake)
   */
  setIntensity(intensity: number): void {
    this.intensityMultiplier = Math.max(0, Math.min(1, intensity))
  }

  /**
   * Update the shake system. Must be called every frame from the scene's update().
   *
   * Applies a camera scroll offset based on the current shake state.
   * Automatically stops the shake when the duration elapses.
   *
   * @param deltaMs - Frame delta time in milliseconds
   */
  update(deltaMs: number): void {
    // Always pin the camera to (0, 0) before applying shake. This prevents
    // zoom-tween interactions from leaking residual scroll offsets across frames
    // (the zoom punch tweens change cam.zoom while scrollX/Y is non-zero, which
    // causes Phaser to recalculate the viewport and leaves behind drift that
    // accumulates each time a shake + zoom overlap). By zeroing scroll here and
    // adding the shake delta freshly each frame, no drift can accumulate.
    const cam = this.scene.cameras.main
    cam.scrollX = 0
    cam.scrollY = 0
    this.offsetX = 0
    this.offsetY = 0

    if (this.activeTier === null || this.activeConfig === null) return

    this.elapsed += deltaMs
    const cfg = this.activeConfig

    if (this.elapsed >= cfg.durationMs) {
      // Shake finished — reset state (camera already zeroed above)
      this.activeTier = null
      this.activeConfig = null
      this.elapsed = 0
      return
    }

    // Compute envelope: linear fade-out in the last 30% of duration
    const progress = this.elapsed / cfg.durationMs
    const fadeStart = 0.7
    const envelope = progress >= fadeStart
      ? 1 - (progress - fadeStart) / (1 - fadeStart)
      : 1.0

    // Sample noise at current time position
    const noiseT = (this.elapsed / 1000) * cfg.frequencyHz
    const nx = smoothNoise1D(this.noiseSeedX + noiseT)
    const ny = smoothNoise1D(this.noiseSeedY + noiseT)

    const effectiveAmp = cfg.amplitude * envelope * this.intensityMultiplier

    // Apply fresh offset (camera is already at 0 from the pin above)
    this.offsetX = nx * effectiveAmp
    this.offsetY = ny * effectiveAmp
    cam.scrollX = this.offsetX
    cam.scrollY = this.offsetY
  }

  /**
   * Immediately stops any active shake and restores the camera.
   */
  stop(): void {
    this._restoreCamera()
    this.activeTier = null
    this.activeConfig = null
    this.elapsed = 0
  }

  /**
   * Returns whether a shake is currently active.
   */
  isActive(): boolean {
    return this.activeTier !== null
  }

  /**
   * Returns the currently active shake tier, or null if no shake is active.
   */
  getActiveTier(): ShakeTier | null {
    return this.activeTier
  }

  // ----------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------

  /**
   * Reverts the camera scroll offset applied by this system.
   * With the pin-then-apply approach in update(), explicit restore is only
   * needed for stop() calls between frames.
   */
  private _restoreCamera(): void {
    if (this.offsetX !== 0 || this.offsetY !== 0) {
      const cam = this.scene.cameras.main
      cam.scrollX = 0
      cam.scrollY = 0
      this.offsetX = 0
      this.offsetY = 0
    }
  }

  /**
   * Checks whether the `prefers-reduced-motion` media query is active.
   * Returns false (do not reduce) when window is unavailable (server-side).
   */
  private _isReducedMotion(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
}
