/**
 * Hub Shared Animation Loop
 *
 * A single requestAnimationFrame loop at 30fps that all hub ambient systems
 * register callbacks with. Replaces 4 separate RAF loops that were running
 * simultaneously (hubLightingState, CampfireEffect, HubGlowEffect, HubFireflies).
 *
 * Architecture:
 * - Auto-starts when the first callback is registered
 * - Auto-stops when the last callback is unregistered
 * - Throttles to 30fps using a frame-skip approach
 * - Guards against tab-hidden time spikes (caps delta at 100ms)
 * - Each callback receives (now: DOMHighResTimeStamp, deltaMs: number)
 */

/** A function called each 30fps tick with the current timestamp and elapsed ms. */
export type FrameCallback = (now: number, deltaMs: number) => void

const _callbacks: FrameCallback[] = []
let _rafId: number | null = null
let _lastFrameTime = 0

const FRAME_MS = 1000 / 30

/**
 * Inner RAF loop body. Throttles to 30fps and dispatches to all registered callbacks.
 */
function _tick(now: number): void {
  _rafId = requestAnimationFrame(_tick)

  const delta = now - _lastFrameTime
  if (delta < FRAME_MS) return

  _lastFrameTime = now - (delta % FRAME_MS)
  const dt = Math.min(delta, 100)  // guard: tab-hidden wake-up spikes

  for (const cb of _callbacks) {
    cb(now, dt)
  }
}

/**
 * Register a callback to be called every 30fps tick.
 * If this is the first callback, the RAF loop is automatically started.
 * Safe to call multiple times with the same callback (de-duplicated).
 *
 * @param cb - Frame callback receiving (now, deltaMs)
 */
export function registerCallback(cb: FrameCallback): void {
  if (_callbacks.includes(cb)) return
  _callbacks.push(cb)
  // Auto-start when first callback is registered
  if (_callbacks.length === 1 && _rafId === null) {
    _lastFrameTime = performance.now()
    _rafId = requestAnimationFrame(_tick)
  }
}

/**
 * Unregister a previously registered callback.
 * If this was the last callback, the RAF loop is automatically stopped.
 *
 * @param cb - The same callback reference passed to registerCallback
 */
export function unregisterCallback(cb: FrameCallback): void {
  const idx = _callbacks.indexOf(cb)
  if (idx >= 0) _callbacks.splice(idx, 1)
  // Auto-stop when no callbacks remain
  if (_callbacks.length === 0 && _rafId !== null) {
    cancelAnimationFrame(_rafId)
    _rafId = null
  }
}
