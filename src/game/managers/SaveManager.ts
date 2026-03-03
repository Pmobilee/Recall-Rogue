import type { DiveSaveState } from '../../data/saveState'
import { DIVE_SAVE_KEY, DIVE_SAVE_VERSION } from '../../data/saveState'

/** Auto-save fires every this many ticks. */
export const AUTO_SAVE_TICK_INTERVAL = 30

/**
 * SaveManager handles mid-dive auto-save, state hydration, and save deletion.
 * Writes to localStorage every AUTO_SAVE_TICK_INTERVAL ticks. (DD-V2-053)
 */
export class SaveManager {
  /**
   * Write a snapshot to localStorage.
   * Called by the TickSystem listener every AUTO_SAVE_TICK_INTERVAL ticks.
   */
  static save(state: DiveSaveState): void {
    try {
      const data: DiveSaveState = {
        ...state,
        version: DIVE_SAVE_VERSION,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem(DIVE_SAVE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[SaveManager] Failed to write dive save:', e)
    }
  }

  /**
   * Load a dive save. Returns null if missing or version-mismatched.
   */
  static load(): DiveSaveState | null {
    try {
      const raw = localStorage.getItem(DIVE_SAVE_KEY)
      if (!raw) return null
      const parsed: DiveSaveState = JSON.parse(raw)
      if (parsed.version !== DIVE_SAVE_VERSION) {
        console.warn('[SaveManager] Dive save version mismatch — discarding.')
        SaveManager.clear()
        return null
      }
      return parsed
    } catch (e) {
      console.warn('[SaveManager] Failed to parse dive save:', e)
      return null
    }
  }

  /**
   * Delete the dive save. Called on successful run completion or deliberate abandonment.
   */
  static clear(): void {
    localStorage.removeItem(DIVE_SAVE_KEY)
  }

  /**
   * Returns true if a mid-dive save exists in localStorage.
   */
  static hasSave(): boolean {
    return localStorage.getItem(DIVE_SAVE_KEY) !== null
  }
}
