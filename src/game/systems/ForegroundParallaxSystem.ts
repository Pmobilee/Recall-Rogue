/**
 * ForegroundParallaxSystem — depth-illusion foreground overlay layer.
 *
 * Renders a sparse set of semi-transparent foreground sprites (cobwebs, chains,
 * stalactites, etc.) at Phaser depth 13, above front particles (depth 12) and
 * below all HUD/UI layers.
 *
 * The elements:
 *  - Breathe gently in idle (8–10s sine cycle, ±0.5px X / ±0.3px Y)
 *  - React to screen shake (shift 1.5× the shake offset via tween)
 *  - Drift 1px on turn transitions (gentle sinusoidal yoyo tween)
 *
 * Placeholder textures are generated procedurally via Phaser Graphics so the
 * system functions without real PNG assets. Real assets placed at
 * src/assets/sprites/foreground/fg_[name].png override placeholders because
 * `createPlaceholderTextures()` checks `textures.exists()` before creating.
 *
 * Reduce-motion: sprites display statically; all tweens/breathing suppressed.
 * Device tier: low=1 element (no breathing/reactive shift), mid=2, flagship=3.
 *
 * @see src/data/foregroundElements.ts
 * @see docs/immersion/07-foreground-parallax.md
 */

import Phaser from 'phaser'
import {
  type ForegroundElementConfig,
  type AnchorSlot,
  selectForegroundElements,
  resolveAnchorPosition,
} from '../../data/foregroundElements'
import type { FloorTheme } from '../../data/roomAtmosphere'
import { getDeviceTier } from '../../services/deviceTierService'

/** Phaser depth for the foreground container — above front particles (12), below HUD. */
const FOREGROUND_DEPTH = 13

/** Idle breathing constants (spec §Technical Details). */
const BREATHE_FREQ_X = 0.000785  // 8s period: 2π / 0.000785 ≈ 8000ms
const BREATHE_FREQ_Y = 0.000628  // 10s period: 2π / 0.000628 ≈ 10000ms
const BREATHE_AMP_X = 0.5        // ±0.5px
const BREATHE_AMP_Y = 0.3        // ±0.3px

/** Reactive parallax multiplier — foreground moves more than background. */
const SHAKE_PARALLAX_FACTOR = 1.5

/** Turn transition drift in pixels (1px rightward yoyo). */
const TURN_DRIFT_PX = 1

/** Procedural placeholder texture size (square). */
const PLACEHOLDER_SIZE = 64

/** Internal representation of a live foreground element. */
interface ForegroundElement {
  sprite: Phaser.GameObjects.Image
  config: ForegroundElementConfig
  /** Resolved base position in viewport pixels (recomputed on resize). */
  baseX: number
  baseY: number
}

/**
 * Palette of procedural placeholder color per texture key.
 * These are generated once and reused across encounters.
 * Real PNG assets override these when present in the texture cache.
 */
const PLACEHOLDER_SPECS: Record<string, { color: number; shape: 'triangle' | 'lines' | 'diamond' | 'blob' | 'circle' }> = {
  fg_cobweb:        { color: 0xcccccc, shape: 'lines' },
  fg_chain_hang:    { color: 0x888888, shape: 'lines' },
  fg_rock_crack:    { color: 0x664433, shape: 'diamond' },
  fg_moss_drip:     { color: 0x336622, shape: 'blob' },
  fg_ash_edge:      { color: 0x998877, shape: 'blob' },
  fg_cracked_stone: { color: 0x665544, shape: 'diamond' },
  fg_icicle_top:    { color: 0x88ccff, shape: 'triangle' },
  fg_frost_edge:    { color: 0xaaddff, shape: 'blob' },
  fg_crystal_shard: { color: 0x66aacc, shape: 'diamond' },
  fg_rune_edge:     { color: 0x9966cc, shape: 'circle' },
  fg_magic_residue: { color: 0xaa44ff, shape: 'blob' },
  fg_arcane_tendril: { color: 0x8833cc, shape: 'lines' },
  fg_void_tendril:  { color: 0x330066, shape: 'lines' },
  fg_reality_crack: { color: 0x440033, shape: 'diamond' },
  fg_dark_seep:     { color: 0x220044, shape: 'blob' },
}

/** Checks whether the prefers-reduced-motion media query is active. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      JSON.parse(window.localStorage.getItem('card:reduceMotionMode') ?? 'false') === true
    )
  } catch {
    return false
  }
}

export class ForegroundParallaxSystem {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private elements: ForegroundElement[] = []
  private idleTime = 0
  private isActive = false
  private reduceMotion: boolean
  /** On low-end devices, skip breathing and reactive shift entirely. */
  private isLowEnd: boolean

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.reduceMotion = prefersReducedMotion()
    this.isLowEnd = getDeviceTier() === 'low-end'
    this.container = scene.add.container(0, 0).setDepth(FOREGROUND_DEPTH)
  }

  // ─────────────────────────────────────────────────────────
  // Placeholder texture creation
  // ─────────────────────────────────────────────────────────

  /**
   * Create procedural placeholder textures for all known foreground keys.
   *
   * Must be called once during `CombatScene.create()` (not preload).
   * Only creates textures that don't already exist in the cache — so real
   * PNG assets loaded via `this.load.image()` in preload take precedence.
   */
  createPlaceholderTextures(): void {
    for (const [key, spec] of Object.entries(PLACEHOLDER_SPECS)) {
      if (this.scene.textures.exists(key)) continue
      this._createPlaceholder(key, spec.color, spec.shape)
    }
  }

  /**
   * Draw a single procedural placeholder texture into the Phaser texture cache.
   */
  private _createPlaceholder(
    key: string,
    color: number,
    shape: 'triangle' | 'lines' | 'diamond' | 'blob' | 'circle',
  ): void {
    const gfx = this.scene.make.graphics({ x: 0, y: 0 })
    const s = PLACEHOLDER_SIZE
    const alpha = 0.6

    gfx.fillStyle(color, alpha)

    switch (shape) {
      case 'triangle':
        // Downward-pointing triangle (icicle)
        gfx.fillTriangle(s / 2, s - 4, 4, 4, s - 4, 4)
        break

      case 'diamond':
        // Diamond / crack shape
        gfx.fillTriangle(s / 2, 4, 4, s / 2, s / 2, s - 4)
        gfx.fillTriangle(s / 2, 4, s - 4, s / 2, s / 2, s - 4)
        break

      case 'blob':
        // Rounded blob approximated by overlapping rects
        gfx.fillRect(s * 0.2, s * 0.1, s * 0.6, s * 0.8)
        gfx.fillRect(s * 0.1, s * 0.2, s * 0.8, s * 0.6)
        break

      case 'circle':
        // Filled circle
        gfx.fillCircle(s / 2, s / 2, s / 2 - 4)
        // Inner cross for rune feel
        gfx.fillStyle(0x000000, 0.3)
        gfx.fillRect(s / 2 - 2, s * 0.1, 4, s * 0.8)
        gfx.fillRect(s * 0.1, s / 2 - 2, s * 0.8, 4)
        break

      case 'lines':
      default:
        // Diagonal lines (cobweb / chain / tendril approximation)
        for (let i = 0; i < 4; i++) {
          const y0 = (s / 4) * i + s / 8
          gfx.fillRect(4, y0, s - 8, 2)
        }
        // Vertical center line
        gfx.fillRect(s / 2 - 1, 4, 2, s - 8)
        break
    }

    gfx.generateTexture(key, s, s)
    gfx.destroy()
  }

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  /**
   * Start the foreground layer for a given encounter.
   *
   * Call after `atmosphereSystem.start()` and `setEnemy()` so the theme is known.
   * Stops any existing elements before creating new ones.
   *
   * @param theme - The biome theme for this encounter
   * @param viewportW - Current viewport width (pixels)
   * @param viewportH - Current viewport height (pixels)
   */
  start(theme: FloorTheme, viewportW: number, viewportH: number): void {
    this.stop()
    this.reduceMotion = prefersReducedMotion()
    this.idleTime = 0

    const configs = selectForegroundElements(theme)

    for (const config of configs) {
      const { x, y } = resolveAnchorPosition(config.anchorSlot, viewportW, viewportH)

      // Validate texture exists (placeholder or real)
      const texKey = this.scene.textures.exists(config.key) ? config.key : '__DEFAULT'

      const sprite = this.scene.add.image(x, y, texKey)
        .setAlpha(config.alpha)
        .setScale(config.scale)
        .setFlipX(config.flipX ?? false)
        .setOrigin(0.5, 0.5)

      this.container.add(sprite)
      this.elements.push({ sprite, config, baseX: x, baseY: y })
    }

    this.isActive = true
  }

  /**
   * Stop the foreground layer and destroy all sprites.
   * Safe to call even when not active.
   */
  stop(): void {
    for (const el of this.elements) {
      this.scene.tweens.killTweensOf(el.sprite)
      el.sprite.destroy()
    }
    this.elements = []
    this.isActive = false
  }

  /**
   * Destroy the system entirely (call on scene shutdown).
   * Do not call `start()` after this.
   */
  destroy(): void {
    this.stop()
    this.container.destroy()
  }

  // ─────────────────────────────────────────────────────────
  // Per-frame update
  // ─────────────────────────────────────────────────────────

  /**
   * Advance idle breathing animation.
   * Must be called every frame from `CombatScene.update(time, delta)`.
   *
   * Formula (per spec §Technical Details):
   *   offsetX = sin(idleTime * 0.000785 + phaseOffset) * 0.5   // 8s period, ±0.5px
   *   offsetY = cos(idleTime * 0.000628 + phaseOffset) * 0.3   // 10s period, ±0.3px
   *
   * @param delta - Frame delta time in milliseconds
   */
  update(delta: number): void {
    if (!this.isActive) return
    // Breathing is disabled on low-end and when reduce-motion is set
    if (this.reduceMotion || this.isLowEnd) return

    this.idleTime += delta

    for (const el of this.elements) {
      const phase = el.config.idlePhaseOffset
      const offsetX = Math.sin(this.idleTime * BREATHE_FREQ_X + phase) * BREATHE_AMP_X
      const offsetY = Math.cos(this.idleTime * BREATHE_FREQ_Y + phase) * BREATHE_AMP_Y
      el.sprite.setPosition(el.baseX + offsetX, el.baseY + offsetY)
    }
  }

  // ─────────────────────────────────────────────────────────
  // Reactive events
  // ─────────────────────────────────────────────────────────

  /**
   * React to a damage/screen-shake event by briefly shifting all elements.
   *
   * Foreground elements move 1.5× the shake offset (closer = moves more),
   * then spring back. Uses a short yoyo tween so it settles in one pass.
   *
   * No-op when reduce-motion is active or device is low-end.
   *
   * @param shakeOffset - Shake pixel offset at peak (from ScreenShakeSystem amplitude)
   */
  onDamage(shakeOffset: { x: number; y: number }): void {
    if (!this.isActive) return
    if (this.reduceMotion || this.isLowEnd) return

    const fgX = shakeOffset.x * SHAKE_PARALLAX_FACTOR
    const fgY = shakeOffset.y * SHAKE_PARALLAX_FACTOR

    for (const el of this.elements) {
      // Kill any in-flight damage tween before starting a new one to avoid stacking
      this.scene.tweens.killTweensOf(el.sprite)
      this.scene.tweens.add({
        targets: el.sprite,
        x: el.baseX + fgX,
        y: el.baseY + fgY,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => {
          // Restore idle base position (breathing will take over on next update tick)
          if (el.sprite?.active) {
            el.sprite.setPosition(el.baseX, el.baseY)
          }
        },
      })
    }
  }

  /**
   * Play a gentle 1px drift on turn transition.
   *
   * Fires when the player's turn begins (end of enemy turn).
   * Creates subtle environmental sense of the dungeon "settling."
   *
   * No-op when reduce-motion is active.
   */
  onTurnTransition(): void {
    if (!this.isActive || this.reduceMotion) return

    for (const el of this.elements) {
      this.scene.tweens.add({
        targets: el.sprite,
        x: el.sprite.x + TURN_DRIFT_PX,
        duration: 150,
        yoyo: true,
        ease: 'Sine.easeInOut',
      })
    }
  }

  // ─────────────────────────────────────────────────────────
  // Resize
  // ─────────────────────────────────────────────────────────

  /**
   * Recalculate element base positions for a new viewport size.
   *
   * Called from `CombatScene.onScaleResize()` whenever the canvas dimensions change.
   *
   * @param w - New viewport width in pixels
   * @param h - New viewport height in pixels
   */
  resize(w: number, h: number): void {
    for (const el of this.elements) {
      const { x, y } = resolveAnchorPosition(el.config.anchorSlot, w, h)
      el.baseX = x
      el.baseY = y
      el.sprite.setPosition(x, y)
    }
  }
}
