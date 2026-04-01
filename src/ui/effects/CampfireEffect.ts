/**
 * Campfire Living Fire VFX System (C1)
 * Renders animated fire particles with streak-based intensity.
 * Uses Canvas2D at 30fps via the shared hubAnimationLoop (no own RAF).
 *
 * The constructor accepts an optional `scale` parameter (ratio of rendered
 * canvas pixels to the base 200px design size). CampfireCanvas.svelte measures
 * the CSS-computed clientWidth at mount time and passes it; ResizeObserver
 * updates it dynamically via `setScale()`.
 *
 * Particle types:
 * - `ember` (80%) — orange→yellow drift, standard size, 1–1.5s life
 * - `spark` (20%) — white-hot, small, fast, short-lived; only emitted during
 *   flicker spikes (getSnapshot().sparkChance > 0.7)
 *
 * Glow alpha is driven by the shared hubLightingState snapshot intensity
 * rather than a standalone inline sine, keeping campfire and overlay in sync.
 */

import { getSnapshot } from './hubLightingState'
import { registerCallback, unregisterCallback } from './hubAnimationLoop'
import type { FrameCallback } from './hubAnimationLoop'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  alpha: number
  color: number
  /** Particle category — affects color, size, speed, and emission gating. */
  type: 'ember' | 'spark'
}

/**
 * Check if reduced motion is enabled in localStorage.
 */
function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
  } catch {
    return false
  }
}

export class CampfireEffect {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private streak: number
  private scale: number
  private particles: Particle[] = []
  private maxParticles: number = 30
  private reduceMotion: boolean = false
  private glowRadius: number = 80
  private emissionRate: number = 10

  /** Bound frame callback for registration with the shared loop. */
  private _boundOnFrame: FrameCallback

  constructor(canvas: HTMLCanvasElement, streak: number, scale: number = 1) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })
    this.streak = streak
    this.scale = scale
    this.reduceMotion = isReduceMotionEnabled()
    this.updateIntensityFromStreak(streak)
    this.initParticlePool()
    this._boundOnFrame = this._onFrame.bind(this)
  }

  /**
   * Initialize empty particle pool.
   */
  private initParticlePool(): void {
    this.particles = []
  }

  /**
   * Update intensity based on streak.
   * - 0 streak: 15 particles, 80px glow, emission 10
   * - 3+ streak: 30 particles, 100px glow, emission 20
   * - 7+ streak: 45 particles, 120px glow, emission 30
   *
   * Glow radii are base values multiplied by `this.scale` during render.
   */
  private updateIntensityFromStreak(streak: number): void {
    if (streak >= 7) {
      this.maxParticles = 45
      this.glowRadius = 120
      this.emissionRate = 30
    } else if (streak >= 3) {
      this.maxParticles = 30
      this.glowRadius = 100
      this.emissionRate = 20
    } else {
      this.maxParticles = 15
      this.glowRadius = 80
      this.emissionRate = 10
    }
  }

  /**
   * Create a new ember particle at the base of the flame.
   */
  private createEmber(centerX: number, baseY: number): Particle {
    const angle = Math.random() * Math.PI * 2
    const speed = (0.5 + Math.random() * 1.5) * this.scale
    return {
      x: centerX + (Math.random() - 0.5) * 20 * this.scale,
      y: baseY,
      vx: Math.cos(angle) * speed * 0.3,
      vy: -speed,
      life: 1,
      maxLife: 1 + Math.random() * 0.5,
      size: (6 + Math.random() * 6) * this.scale,
      alpha: 1,
      color: 0xff6b1a, // orange base
      type: 'ember',
    }
  }

  /**
   * Create a new spark particle — white-hot, small, fast, short-lived.
   * Only emitted during flicker spikes (sparkChance > 0.7).
   */
  private createSpark(centerX: number, baseY: number): Particle {
    const angle = Math.random() * Math.PI * 2
    // 2–3× faster than base ember speed
    const speed = (1.5 + Math.random() * 2.0) * this.scale
    return {
      x: centerX + (Math.random() - 0.5) * 10 * this.scale,
      y: baseY,
      vx: Math.cos(angle) * speed * 0.25,
      vy: -speed * (2 + Math.random()),
      life: 1,
      maxLife: 0.4 + Math.random() * 0.4,
      size: (2 + Math.random() * 3) * this.scale,
      alpha: 0.9 + Math.random() * 0.1,
      color: 0xffffff, // white-hot
      type: 'spark',
    }
  }

  /**
   * Emit new particles at the base of the flame.
   * Embers fill 80% of the pool; sparks fill 20% but only during flicker spikes.
   */
  private emitParticles(): void {
    if (this.reduceMotion) return

    const centerX = this.canvas.width / 2
    const baseY = this.canvas.height * 0.85
    const snap = getSnapshot()

    while (this.particles.length < this.maxParticles) {
      const isSpark = Math.random() < 0.2 && snap.sparkChance > 0.7
      if (isSpark) {
        this.particles.push(this.createSpark(centerX, baseY))
      } else {
        this.particles.push(this.createEmber(centerX, baseY))
      }
    }
  }

  /**
   * Update particle positions and lifecycle.
   */
  private updateParticles(deltaTime: number): void {
    const dt = Math.min(deltaTime / 1000, 0.016) // cap at ~60fps

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]

      // Update position with drift
      const driftPhase = performance.now() * 0.002 + i * 0.5
      const horizontalDrift = Math.sin(driftPhase) * 0.4
      p.x += (p.vx + horizontalDrift) * (dt * 60)
      p.y += p.vy * (dt * 60)

      // Update life
      p.life -= dt / p.maxLife
      p.alpha = Math.max(0, p.life)

      if (p.type === 'ember') {
        // Orange → yellow color drift with more aggressive shrink
        const t = 1 - p.life
        const r = Math.round(0xff - (0xff - 0xcc) * t)
        const g = Math.round(0x6b + (0xcc - 0x6b) * t)
        const b = 0x1a
        p.color = (r << 16) | (g << 8) | b
        // More aggressive size shrink as ember dies
        p.size = p.size * 1 // size is set on creation; shrink applied in render
      } else {
        // Spark: white → blue-white over lifetime
        const t = 1 - p.life
        const r = Math.round(0xff - (0xff - 0xe8) * t)
        const g = Math.round(0xff - (0xff - 0xe8) * t)
        const b = Math.round(0xff - (0xff - 0xff) * t) // stays 0xff
        p.color = (r << 16) | (g << 8) | b
      }

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }
  }

  /**
   * Render particles and glow to the canvas.
   */
  private render(): void {
    if (!this.ctx) return

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height * 0.85
    const scaledGlowRadius = this.glowRadius * this.scale

    if (this.reduceMotion) {
      // Static glow only — use middle intensity
      const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, scaledGlowRadius)
      gradient.addColorStop(0, `rgba(255, 107, 26, ${0.14})`)
      gradient.addColorStop(1, 'rgba(255, 107, 26, 0)')
      this.ctx.fillStyle = gradient
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      return
    }

    // Glow alpha driven by shared hubLightingState intensity — keeps campfire
    // canvas and the HubGlowOverlay in synchrony (both read the same snapshot).
    const snap = getSnapshot()
    const glowAlpha = snap.intensity * 0.24

    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, scaledGlowRadius)
    gradient.addColorStop(0, `rgba(255, 107, 26, ${glowAlpha})`)
    gradient.addColorStop(1, 'rgba(255, 107, 26, 0)')
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw particles
    for (const p of this.particles) {
      const r = (p.color >> 16) & 0xff
      const g = (p.color >> 8) & 0xff
      const b = p.color & 0xff

      const alphaFactor = p.type === 'spark' ? 1.0 : 0.8
      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha * alphaFactor})`
      this.ctx.beginPath()

      // Embers shrink more aggressively; sparks maintain size until they die fast
      const sizeFactor = p.type === 'ember'
        ? p.life * 0.6 + 0.4   // more aggressive: 0.4 at death vs 0.5 before
        : p.alpha               // sparks scale linearly with alpha
      this.ctx.arc(p.x, p.y, p.size * sizeFactor, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  /**
   * Frame callback called by the shared hub animation loop each 30fps tick.
   * Replaces the internal RAF animate loop.
   */
  private _onFrame(_now: number, deltaMs: number): void {
    this.emitParticles()
    this.updateParticles(deltaMs)
    this.render()
  }

  /**
   * Start the fire animation by registering with the shared hub loop.
   */
  start(): void {
    if (this.reduceMotion) {
      // Static render only — draw once without registering for ongoing updates
      this.render()
      return
    }
    registerCallback(this._boundOnFrame)
  }

  /**
   * Stop the animation and clear particles.
   */
  stop(): void {
    unregisterCallback(this._boundOnFrame)
    this.particles = []
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  /**
   * Update the streak and adjust intensity dynamically.
   */
  updateStreak(streak: number): void {
    this.streak = streak
    this.updateIntensityFromStreak(streak)
  }

  /**
   * Update the scale factor when the canvas is resized.
   * Clears particles so they respawn at the correct scaled positions.
   *
   * @param scale - New ratio of canvas clientWidth to base size (200px)
   */
  setScale(scale: number): void {
    this.scale = scale
    // Clear existing particles — they'll respawn at scaled positions next frame
    this.particles = []
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.stop()
    this.ctx = null
  }
}
