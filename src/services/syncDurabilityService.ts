import { syncService } from './syncService'

const LISTENER_KEY = Symbol.for('rr:sync-durability-listener-registered')

/**
 * Registers a single visibilitychange listener that triggers cloud sync when
 * the app is backgrounded. This preserves durability without coupling
 * saveService to syncService (avoids circular dependency).
 */
export function initSyncDurabilityListener(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const registry = globalThis as typeof globalThis & Record<symbol, unknown>
  if (registry[LISTENER_KEY] === true) return

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void syncService.pushToCloud()
    }
  })

  registry[LISTENER_KEY] = true
}

