/**
 * Hub Campfire Ambient Lighting State Engine
 *
 * Central flicker engine driving glow radius/alpha, sprite brightness,
 * and background warmth in synchrony across canvas and CSS consumers.
 *
 * Architecture:
 * - Uses the shared 30fps loop from hubAnimationLoop.ts (no own RAF)
 * - Smooth interpolation between random target values — natural organic fire feel
 * - `getSnapshot()` is allocation-free — mutates a single shared object (read every frame)
 * - Svelte reactive store for CSS consumers is throttled to every 3rd frame (~10fps)
 *   to reduce Svelte reactive cascade overhead while keeping canvas consumers at full 30fps
 * - Respects `localStorage 'card:reduceMotionMode'`
 */

import { writable } from 'svelte/store'
import { registerCallback, unregisterCallback } from './hubAnimationLoop'
import type { FrameCallback } from './hubAnimationLoop'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Synchronous snapshot consumed by canvas renderers (allocation-free). */
export interface HubLightingSnapshot {
  /** 0–1, primary flicker — drives glow radius and alpha. */
  intensity: number
  /** 0–1, slow warm cycle — drives background sepia/warmth overlay. */
  warmth: number
  /** 0–1, occasional random spike — triggers white-hot spark bursts. */
  sparkChance: number
}

/** Reactive state exported for CSS/Svelte consumers (brightness, warmth class). */
export interface HubLightingReactive {
  /** CSS `brightness()` factor for hub sprites, clamped 0.35–1.0. */
  spriteBrightness: number
  /** 0–1 warmth value mirroring snapshot.warmth for CSS use. */
  warmth: number
  /** 0–1 intensity value mirroring snapshot.intensity for CSS use. */
  intensity: number
}

// ---------------------------------------------------------------------------
// Campfire geometry constant
// ---------------------------------------------------------------------------

/**
 * Campfire center as percentage of the hub container.
 * Derived from campfire hitbox: left=38%, width=24% → centerX=50%;
 * top=55%, height=18% → centerY=64%.
 */
export const CAMPFIRE_CENTER_PCT = { x: 50, y: 64 }

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const REDUCE_MOTION_KEY = 'card:reduceMotionMode'

/** Mutable snapshot object — never replaced, only mutated (zero allocation). */
const _snapshot: HubLightingSnapshot = {
  intensity: 0.5,
  warmth: 0.5,
  sparkChance: 0,
}

/** Svelte store for CSS consumers — throttled to ~10fps (every 3rd frame) to
 *  reduce Svelte reactive cascade overhead. getSnapshot() still updates every frame
 *  so canvas consumers (CampfireEffect, HubGlowEffect) see full 30fps data. */
const _reactiveStore = writable<HubLightingReactive>({
  spriteBrightness: 1.0,
  warmth: 0.5,
  intensity: 0.5,
})

let _frameCount = 0
let _streak = 0
let _running = false

// ---------------------------------------------------------------------------
// Smooth flicker interpolation state
// ---------------------------------------------------------------------------

/** Current smooth intensity value (exponentially eased toward _targetIntensity). */
let _currentIntensity = 0.55
/** Next target intensity the fire is interpolating toward. */
let _targetIntensity = 0.55
/** Timestamp (ms) when to pick the next random target. */
let _nextTargetTime = 0

// ---------------------------------------------------------------------------
// Reduce-motion helper
// ---------------------------------------------------------------------------

function isReduceMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem(REDUCE_MOTION_KEY) ?? 'false') === true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Flicker math
// ---------------------------------------------------------------------------

/**
 * Compute smooth interpolation-based flicker for natural campfire feel.
 *
 * - Picks a new random target intensity every 150–600ms (active fire pacing)
 * - Exponentially eases toward target at 0.15/frame (~5 frames to 63% = ~170ms at 30fps)
 * - Adds one slow breathing sine for gentle macro rhythm
 * - Adds secondary micro-jitter (+/-0.02) per frame for frame-to-frame variation
 * - 3% chance of super flare (instant max burst, 100–200ms), 10% dim dip (down to 0.15),
 *   10% bright flare (0.90–1.0+), 77% normal range (0.45–0.75)
 *
 * @param t - `performance.now()` timestamp in ms
 * @param streak - Player's current login streak
 */
function computeSnapshot(t: number, streak: number): void {
  // Amplitude scalar: streak=0 → 1.0, streak=7 → 1.6, capped at 1.8
  const amp = Math.min(1.0 + streak * 0.08, 1.8)

  // Pick new random target intensity at variable intervals (150–600ms for active fire)
  if (t >= _nextTargetTime) {
    const r = Math.random()
    if (r < 0.03) {
      // 3% chance: super flare — fire briefly surges to maximum
      _targetIntensity = 1.0
      _nextTargetTime = t + 100 + Math.random() * 100  // quick burst, 100-200ms
    } else if (r < 0.13) {
      // 10% chance: dim dip (fire briefly lowers — deeper than before: 0.15 floor)
      _targetIntensity = 0.15 + Math.random() * 0.15
      // Schedule next target change in 150–600ms (was 300–1200ms)
      _nextTargetTime = t + 150 + Math.random() * 450
    } else if (r > 0.9) {
      // 10% chance: bright flare — consistently hits 0.90–1.0+
      _targetIntensity = 0.90 + Math.random() * 0.10 * amp
      // Schedule next target change in 150–600ms (was 300–1200ms)
      _nextTargetTime = t + 150 + Math.random() * 450
    } else {
      // 77%: normal organic range (widened from 0.45–0.70 to 0.45–0.75)
      _targetIntensity = 0.45 + Math.random() * 0.30
      // Schedule next target change in 150–600ms (was 300–1200ms)
      _nextTargetTime = t + 150 + Math.random() * 450
    }
  }

  // Smooth exponential ease toward target — factor 0.15 = visible within ~5 frames (~170ms)
  // Increased from 0.04 (was sluggish at ~25 frames = 0.8s to 63%)
  _currentIntensity += (_targetIntensity - _currentIntensity) * 0.15

  // Secondary micro-jitter: small per-frame random variation for alive feel
  const microJitter = (Math.random() - 0.5) * 0.04

  // Add one slow breathing sine for gentle macro rhythm
  const breath = 0.08 * Math.sin(t * 0.0015) * amp

  const rawIntensity = _currentIntensity + breath + microJitter

  // Slow warmth cycle (unchanged)
  const rawWarmth = 0.5 + 0.3 * Math.sin(t * 0.001) + 0.2 * Math.sin(t * 0.0023 + 0.5)

  // Spark chance: beat pattern fires more frequently — threshold lowered from 0.9 to 0.5
  // The product of two sines with close frequencies creates natural beats
  const beatA = Math.sin(t * 0.0017 + 2.1)
  const beatB = Math.sin(t * 0.0019 + 0.3)
  const rawSpark = Math.max(0, beatA * beatB * 2 - 0.5)

  _snapshot.intensity = Math.max(0, Math.min(1, rawIntensity))
  _snapshot.warmth = Math.max(0, Math.min(1, rawWarmth))
  _snapshot.sparkChance = Math.max(0, Math.min(1, rawSpark))
}

// ---------------------------------------------------------------------------
// Shared-loop callback
// ---------------------------------------------------------------------------

/**
 * Called each 30fps tick by the shared hubAnimationLoop.
 * Updates the snapshot every frame (for canvas consumers) and
 * throttles the Svelte store update to every 3rd frame (~10fps)
 * to reduce reactive cascade overhead.
 */
const _onFrame: FrameCallback = (now: number): void => {
  _frameCount++

  if (isReduceMotionEnabled()) {
    // Static middle values when reduce-motion is active
    _snapshot.intensity = 0.5
    _snapshot.warmth = 0.5
    _snapshot.sparkChance = 0
  } else {
    computeSnapshot(now, _streak)
  }

  // Throttle reactive store to ~10fps (every 3rd frame).
  // Canvas consumers (CampfireEffect, HubGlowEffect) call getSnapshot() directly
  // and still get full 30fps data. Only Svelte DOM bindings need the store.
  if (_frameCount % 3 === 0) {
    _reactiveStore.set({
      spriteBrightness: computeSpriteBrightnessFromSnapshot(_snapshot.intensity),
      warmth: _snapshot.warmth,
      intensity: _snapshot.intensity,
    })
  }
}

// ---------------------------------------------------------------------------
// Sprite brightness (internal helper for reactive store)
// ---------------------------------------------------------------------------

/**
 * Global average sprite brightness based on current intensity.
 * Used for the reactive store update (not per-sprite position).
 */
function computeSpriteBrightnessFromSnapshot(intensity: number): number {
  // Intensity 0–1 maps to brightness 0.6–1.0 with ±8% flicker
  const base = 0.6 + intensity * 0.4
  const flicker = (Math.random() - 0.5) * 0.16 // ±8%
  return Math.max(0.35, Math.min(1.0, base + flicker))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the reactive Svelte store for CSS consumers.
 * Subscribe in components for brightness and warmth values.
 * Updated at ~10fps (every 3rd frame) to reduce reactive cascade overhead.
 *
 * @example
 * ```ts
 * import { getHubLightingStore } from '../effects/hubLightingState'
 * const lighting = getHubLightingStore()
 * // In svelte: $lighting.spriteBrightness
 * ```
 */
export function getHubLightingStore(): typeof _reactiveStore {
  return _reactiveStore
}

/**
 * Synchronously read the latest lighting snapshot.
 * Allocation-free — returns the same mutated object every call.
 * Intended for canvas consumers polled inside the shared RAF loop.
 * Updated every frame at full 30fps.
 *
 * @example
 * ```ts
 * const snap = getSnapshot()
 * ctx.globalAlpha = snap.intensity * 0.2
 * ```
 */
export function getSnapshot(): HubLightingSnapshot {
  return _snapshot
}

/**
 * Start the lighting engine by registering with the shared hub animation loop.
 * Safe to call multiple times — only registers once.
 *
 * @param streak - Current player login streak (drives flicker amplitude)
 */
export function start(streak: number): void {
  _streak = streak
  if (_running) return
  _running = true
  _frameCount = 0
  _nextTargetTime = 0  // ensure first frame picks a target immediately
  registerCallback(_onFrame)
}

/**
 * Stop the lighting engine and reset snapshot to static middle values.
 */
export function stop(): void {
  _running = false
  unregisterCallback(_onFrame)
  _snapshot.intensity = 0.5
  _snapshot.warmth = 0.5
  _snapshot.sparkChance = 0
  _reactiveStore.set({ spriteBrightness: 1.0, warmth: 0.5, intensity: 0.5 })
}

/**
 * Update the streak multiplier without restarting the loop.
 *
 * @param streak - New login streak value
 */
export function updateStreak(streak: number): void {
  _streak = streak
}

/**
 * Calculate per-sprite brightness based on its hitbox position and current intensity.
 *
 * Uses the distance from the sprite's center to CAMPFIRE_CENTER_PCT to derive
 * a distance falloff, then modulates by ±8% flicker from the current intensity.
 *
 * @param hitTop - CSS percent string like "55%" or numeric percent
 * @param hitLeft - CSS percent string like "38%"
 * @param hitWidth - CSS percent string like "24%"
 * @param hitHeight - CSS percent string like "18%"
 * @param intensity - Current snapshot intensity (0–1)
 * @returns Brightness factor clamped to 0.35–1.0
 */
export function getSpriteBrightness(
  hitTop: number,
  hitLeft: number,
  hitWidth: number,
  hitHeight: number,
  intensity: number
): number {
  // Sprite center from hitbox
  const spriteCenterX = hitLeft + hitWidth / 2
  const spriteCenterY = hitTop + hitHeight / 2

  // Distance from campfire center (in percentage units)
  const dx = spriteCenterX - CAMPFIRE_CENTER_PCT.x
  const dy = spriteCenterY - CAMPFIRE_CENTER_PCT.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Distance falloff: dist=0 → 1.0, dist=50 → ~0.45
  // Linear blend between close=1.0 and far=0.45 over 0–50% range
  const distFactor = Math.max(0, 1.0 - (dist / 50) * 0.55)
  const base = 0.45 + distFactor * 0.55

  // ±8% flicker pulse modulated by intensity
  const flicker = (intensity - 0.5) * 0.16 // intensity=1 → +8%, intensity=0 → -8%

  return Math.max(0.35, Math.min(1.0, base + flicker))
}
