/**
 * Turbo mode — disables all blocking animations/delays for bot testing.
 * Game logic is byte-for-byte identical. Only affects timing.
 * Activated via ?turbo URL parameter (dev mode only).
 */

/** Check if turbo mode is enabled. */
export function isTurboMode(): boolean {
  return (globalThis as Record<symbol, unknown>)[Symbol.for('terra:turboMode')] === true;
}

/** Returns 5ms in turbo mode (minimum for async state flush), otherwise the given duration. */
export function turboDelay(normalMs: number): number {
  return isTurboMode() ? 5 : normalMs;
}
