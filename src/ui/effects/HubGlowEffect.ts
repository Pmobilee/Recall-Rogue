/**
 * Hub Glow Overlay Effect
 *
 * Renders a full-viewport warm radial glow centered on the campfire.
 * Uses mix-blend-mode: screen on the canvas CSS so the warm glow is additive —
 * it adds light without washing out bright areas near the fire.
 *
 * A secondary mouse-following light pass is drawn after the campfire glow when
 * a mouse position has been provided via setMousePosition(). This adds a subtle
 * warm light wherever the cursor is hovering in the hub.
 *
 * The vignette darkening pass is rendered onto a SEPARATE canvas (vignetteCanvas)
 * using a canvas radial-gradient instead of a CSS radial-gradient div. This
 * eliminates CSS gradient reparse overhead that occurred every frame when the
 * gradient string was rebuilt from reactive $derived values.
 *
 * Uses the shared 30fps loop from hubAnimationLoop.ts (no own RAF).
 *
 * @module HubGlowEffect
 */

import { getSnapshot } from './hubLightingState'
import { registerCallback, unregisterCallback } from './hubAnimationLoop'
import type { FrameCallback } from './hubAnimationLoop'

const REDUCE_MOTION_KEY = 'card:reduceMotionMode'

function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem(REDUCE_MOTION_KEY) ?? 'false') === true
  } catch {
    return false
  }
}

export class HubGlowEffect {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  private vignetteCanvas: HTMLCanvasElement
  private vignetteCtx: CanvasRenderingContext2D | null
  private campfireCenterFn: () => { x: number; y: number }
  private running: boolean = false

  /** Current mouse position in viewport pixels, or null when outside hub. */
  private mouseX: number | null = null
  private mouseY: number | null = null

  /** Bound frame callback for registration with the shared loop. */
  private _boundOnFrame: FrameCallback

  /**
   * Create a new HubGlowEffect.
   *
   * @param canvas - The full-viewport screen-blend canvas for warm glow
   * @param vignetteCanvas - A second full-viewport normal-blend canvas for vignette darkening
   * @param campfireCenterFn - Returns campfire center in absolute viewport pixels
   */
  constructor(
    canvas: HTMLCanvasElement,
    vignetteCanvas: HTMLCanvasElement,
    campfireCenterFn: () => { x: number; y: number }
  ) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })
    this.vignetteCanvas = vignetteCanvas
    this.vignetteCtx = vignetteCanvas.getContext('2d', { alpha: true })
    this.campfireCenterFn = campfireCenterFn
    this._boundOnFrame = this._onFrame.bind(this)
  }

  /**
   * Update the mouse position for the secondary light pass.
   * Call this whenever the pointer moves within the hub area.
   *
   * @param x - Mouse viewport X (e.clientX)
   * @param y - Mouse viewport Y (e.clientY)
   */
  setMousePosition(x: number, y: number): void {
    this.mouseX = x
    this.mouseY = y
  }

  /**
   * Clear the mouse position when the pointer leaves the hub area.
   * The secondary light pass is skipped when mouse position is null.
   */
  clearMousePosition(): void {
    this.mouseX = null
    this.mouseY = null
  }

  /**
   * Draw a single frame to both canvases.
   *
   * Canvas 1 (screen-blend glow):
   *   Pass 1: warm orange radial glow centered on campfire
   *   Pass 2 (optional): subtle warm light following the mouse cursor
   *
   * Canvas 2 (normal-blend vignette):
   *   Radial gradient darkening the scene edges; intensity-modulated stops
   *   pulse with fire brightness. Drawing to canvas instead of rebuilding
   *   a CSS gradient string eliminates the browser's CSS gradient reparse cost.
   *
   * @param intensityOverride - When set, bypasses getSnapshot() (for static reduce-motion frame).
   */
  private drawFrame(intensityOverride?: number): void {
    const snap = getSnapshot()
    const intensity = intensityOverride !== undefined ? intensityOverride : snap.intensity

    // -------------------------------------------------------------------------
    // Canvas 1: Warm glow (mix-blend-mode: screen on CSS)
    // -------------------------------------------------------------------------
    if (this.ctx) {
      const w = this.canvas.width
      const h = this.canvas.height
      this.ctx.clearRect(0, 0, w, h)

      const center = this.campfireCenterFn()
      const cx = center.x
      const cy = center.y
      const diagonal = Math.sqrt(w * w + h * h)

      // Glow radius: 55–65% of diagonal, modulated slightly by intensity
      const glowRadius = diagonal * (0.55 + intensity * 0.10)

      // Pass 1: Warm orange radial glow
      this.ctx.globalCompositeOperation = 'source-over'
      const glowGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
      glowGrad.addColorStop(0, `rgba(255, 140, 40, ${intensity * 0.25})`)   // warm core
      glowGrad.addColorStop(0.3, `rgba(255, 100, 20, ${intensity * 0.12})`) // mid-range warmth
      glowGrad.addColorStop(1, 'rgba(255, 80, 10, 0)')
      this.ctx.fillStyle = glowGrad
      this.ctx.fillRect(0, 0, w, h)

      // Pass 2: Secondary mouse-following light (when mouse is in the hub)
      if (this.mouseX !== null && this.mouseY !== null) {
        const mouseGlowRadius = diagonal * 0.15
        const mouseGrad = this.ctx.createRadialGradient(
          this.mouseX, this.mouseY, 0,
          this.mouseX, this.mouseY, mouseGlowRadius
        )
        mouseGrad.addColorStop(0, `rgba(255, 220, 160, ${intensity * 0.10})`)
        mouseGrad.addColorStop(0.4, `rgba(255, 200, 140, ${intensity * 0.04})`)
        mouseGrad.addColorStop(1, 'rgba(255, 180, 120, 0)')
        this.ctx.fillStyle = mouseGrad
        this.ctx.fillRect(0, 0, w, h)
      }
    }

    // -------------------------------------------------------------------------
    // Canvas 2: Vignette darkening (mix-blend-mode: normal on CSS)
    // Drawn as a canvas radial-gradient instead of a CSS gradient string.
    // This avoids the browser having to reparse a gradient CSS string each frame,
    // which Chrome does even when the string is quantized to 20 discrete values.
    // -------------------------------------------------------------------------
    if (this.vignetteCtx) {
      const vw = this.vignetteCanvas.width
      const vh = this.vignetteCanvas.height
      this.vignetteCtx.clearRect(0, 0, vw, vh)

      // Campfire center in canvas pixels (same fn as glow canvas)
      const center = this.campfireCenterFn()
      const vcx = center.x
      const vcy = center.y

      // Intensity-driven expansion factor: at max intensity, stops shift outward ~12%
      const s = intensity * 0.12

      // Radial gradient parameters matching the old CSS vignette:
      // transparent → dark mid → darker outer
      // Stop positions and alphas mirror the old $derived vignetteStyle formula.
      const r1 = Math.max(vw, vh) * (0.10 + s * 0.03)  // transparent stop radius
      const r2 = Math.max(vw, vh) * (0.26 + s * 0.02)  // 2nd stop
      const r3 = Math.max(vw, vh) * (0.48 + s * 0.02)  // 3rd stop
      const r4 = Math.max(vw, vh) * (0.70 + s * 0.01)  // 4th stop
      const r5 = Math.max(vw, vh) * 0.88               // outer edge

      const a2 = 0.30 - intensity * 0.10  // 0.20–0.30
      const a3 = 0.65 - intensity * 0.10  // 0.55–0.65
      const a4 = 0.88 - intensity * 0.05  // 0.83–0.88
      const a5 = 0.93                     // constant outer darkness

      // Use a radial gradient from campfire center outward
      const vig = this.vignetteCtx.createRadialGradient(vcx, vcy, r1, vcx, vcy, r5)
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vig.addColorStop(r2 / r5, `rgba(5, 5, 15, ${a2.toFixed(3)})`)
      vig.addColorStop(r3 / r5, `rgba(5, 5, 15, ${a3.toFixed(3)})`)
      vig.addColorStop(r4 / r5, `rgba(2, 2, 8, ${a4.toFixed(3)})`)
      vig.addColorStop(1, `rgba(2, 2, 8, ${a5})`)

      this.vignetteCtx.fillStyle = vig
      this.vignetteCtx.fillRect(0, 0, vw, vh)
    }
  }

  /**
   * Frame callback called by the shared hub animation loop each 30fps tick.
   */
  private _onFrame(_now: number, _deltaMs: number): void {
    this.drawFrame()
  }

  /**
   * Start the render loop. If reduce-motion is active, draws a single static
   * frame at middle intensity and does not register with the shared loop.
   */
  start(): void {
    if (isReduceMotionEnabled()) {
      // Single static frame — no ongoing animation
      this.drawFrame(0.5)
      return
    }

    if (this.running) return
    this.running = true
    registerCallback(this._boundOnFrame)
  }

  /**
   * Stop the render loop.
   */
  stop(): void {
    this.running = false
    unregisterCallback(this._boundOnFrame)
  }

  /**
   * Stop the loop and release references.
   */
  destroy(): void {
    this.stop()
    this.ctx = null
    this.vignetteCtx = null
  }
}
