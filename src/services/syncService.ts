/**
 * @file syncService.ts
 * Coordinates local localStorage saves with the backend cloud save and
 * leaderboard endpoints via `apiClient`.
 *
 * Design goals:
 * - Silent failures: network/auth errors are logged to the console only — they
 *   must never interrupt gameplay.
 * - Debounced uploads: no more than one upload per `SYNC_DEBOUNCE_MS` window.
 * - Conflict resolution: the save with the higher `lastPlayedAt` timestamp wins;
 *   ties within 60 s are broken by `totalFactsLearned` (more progress preferred).
 * - Leaderboard submissions: derived automatically from a PlayerSave on every
 *   successful push to the cloud, using category names that match the server.
 * - Offline queue: operations attempted while offline are persisted and replayed
 *   automatically when connectivity is restored.
 */

import { apiClient } from './apiClient'
import { load as loadLocalSave } from './saveService'
import { offlineQueue } from './offlineQueue'
import { syncStatus } from '../ui/stores/syncStore'
import type { PlayerSave } from '../data/types'

// ============================================================
// CONSTANTS
// ============================================================

/** Minimum milliseconds between successive upload attempts (30 seconds). */
const SYNC_DEBOUNCE_MS = 30_000

/** localStorage key used to persist the last-successful-sync timestamp. */
const LAST_SYNC_KEY = 'rr_last_sync_time'

/**
 * Within this window (ms) two competing saves are considered "tied" on time
 * and the tiebreaker (`totalFactsLearned`) is applied instead.
 */
const CONFLICT_TIE_WINDOW_MS = 60_000

// ============================================================
// LEADERBOARD CATEGORY EXTRACTORS
// ============================================================

/**
 * Maps server leaderboard category identifiers to the corresponding numeric
 * value extracted from a `PlayerSave`.
 *
 * Category names MUST match the server's `VALID_CATEGORIES` set defined in
 * `server/src/routes/leaderboards.ts`.
 */
const LEADERBOARD_EXTRACTORS: Record<string, (s: PlayerSave) => number> = {
  deepest_dive: (s) => s.stats.bestFloor,
  facts_mastered: (s) => s.stats.totalFactsLearned,
  longest_streak: (s) => s.stats.bestStreak,
  total_dust: (s) => s.minerals?.dust ?? 0,
}

// ============================================================
// SYNC SERVICE
// ============================================================

/**
 * Manages synchronisation between the local save stored in localStorage and
 * the authenticated user's cloud save on the backend.
 *
 * Use the exported `syncService` singleton — do not instantiate directly.
 *
 * @example
 * ```ts
 * import { syncService } from './syncService'
 *
 * // After each local save:
 * await syncService.syncAfterSave(updatedSave)
 *
 * // Manual pull at game launch:
 * const cloudSave = await syncService.pullFromCloud()
 * ```
 */
export class SyncService {
  private _isSyncing: boolean = false
  private _lastSyncTime: number | null = null
  private _lastUploadAttempt: number = 0
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this._lastSyncTime = this.readLastSyncTime()
    this.registerConnectivityListener()
  }

  // ----------------------------------------------------------
  // PUBLIC ACCESSORS
  // ----------------------------------------------------------

  /** `true` while an upload or download is in progress. */
  get isSyncing(): boolean {
    return this._isSyncing
  }

  /**
   * Unix timestamp (ms) of the last successful cloud sync, or `null` if a
   * sync has never completed in this browser context.
   */
  get lastSyncTime(): number | null {
    return this._lastSyncTime
  }

  /**
   * `true` when `navigator.onLine` reports an active network connection.
   * Always returns `true` in environments where `navigator` is unavailable
   * (e.g. unit-test runtimes), so the call site should handle offline
   * gracefully rather than hard-blocking on this flag.
   */
  get isOnline(): boolean {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  }

  /** Cloud sync toggle from PlayerSave; defaults to enabled for backward compatibility. */
  private isCloudSyncEnabled(localSave?: PlayerSave | null): boolean {
    const source = localSave ?? loadLocalSave()
    return source?.cloudSyncEnabled !== false
  }

  // ----------------------------------------------------------
  // AUTO-SYNC
  // ----------------------------------------------------------

  /**
   * Schedules a cloud upload after a local save, honouring the debounce window.
   *
   * If the device is offline the operation is enqueued for later replay rather
   * than silently dropped. If the user is not logged in the call is a no-op.
   * Errors are swallowed so gameplay is never interrupted.
   *
   * @param localSave - The just-persisted `PlayerSave` object.
   */
  async syncAfterSave(localSave: PlayerSave): Promise<void> {
    if (!apiClient.isLoggedIn()) return
    if (!this.isCloudSyncEnabled(localSave)) return

    // If offline, persist the operation for later replay and return early.
    if (!this.isOnline) {
      offlineQueue.enqueue({ type: 'save', payload: null })
      return
    }

    const now = Date.now()
    const msSinceLastAttempt = now - this._lastUploadAttempt

    if (msSinceLastAttempt < SYNC_DEBOUNCE_MS) {
      // Debounce: schedule a deferred upload for when the window expires.
      if (this._debounceTimer !== null) {
        clearTimeout(this._debounceTimer)
      }
      const delay = SYNC_DEBOUNCE_MS - msSinceLastAttempt
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null
        void this.performUpload(localSave)
      }, delay)
      return
    }

    await this.performUpload(localSave)
  }

  // ----------------------------------------------------------
  // MANUAL SYNC
  // ----------------------------------------------------------

  /**
   * Pulls the cloud save and returns it (or `null` if none exists).
   *
   * The caller is responsible for deciding whether to apply the cloud save
   * (e.g. by comparing `lastPlayedAt` against the local save). Errors are
   * swallowed — the method returns `null` on any failure so callers do not
   * need to handle exceptions.
   *
   * @returns The cloud `PlayerSave`, or `null` on failure/no save.
   */
  async pullFromCloud(): Promise<PlayerSave | null> {
    if (!apiClient.isLoggedIn()) return null
    if (!this.isCloudSyncEnabled()) return null
    if (!this.isOnline) return null

    this._isSyncing = true
    syncStatus.set('syncing')
    try {
      const remote = await apiClient.downloadSave()
      syncStatus.set('idle')
      return remote
    } catch (err) {
      console.warn('[SyncService] pullFromCloud failed:', err)
      syncStatus.set('error')
      return null
    } finally {
      this._isSyncing = false
    }
  }

  /**
   * Reads the current local save from localStorage and uploads it to the cloud.
   *
   * Errors are swallowed and logged to the console only.
   */
  async pushToCloud(): Promise<void> {
    if (!apiClient.isLoggedIn()) return
    if (!this.isCloudSyncEnabled()) return
    if (!this.isOnline) return

    const localSave = loadLocalSave()
    if (localSave === null) return

    await this.performUpload(localSave)
  }

  // ----------------------------------------------------------
  // CONFLICT RESOLUTION
  // ----------------------------------------------------------

  /**
   * Chooses the authoritative save when local and remote copies differ.
   *
   * **Primary rule**: whichever save has the higher `lastPlayedAt` value wins.
   * **Tiebreaker**: if the two timestamps are within 60 seconds of each other,
   * the save with more `totalFactsLearned` is preferred — it reflects more
   * in-session progress that may not yet have updated `lastPlayedAt`. In a
   * true tie on both dimensions the local save is returned to avoid
   * unnecessary writes.
   *
   * @param local - The save currently stored in localStorage.
   * @param remote - The save downloaded from the cloud.
   * @returns The save that should be treated as the source of truth.
   */
  async resolveConflict(local: PlayerSave, remote: PlayerSave): Promise<PlayerSave> {
    const timeDiff = Math.abs(remote.lastPlayedAt - local.lastPlayedAt)

    if (timeDiff <= CONFLICT_TIE_WINDOW_MS) {
      // Timestamps are close enough to be considered a tie; use progress as
      // tiebreaker so we don't discard a session that was active very recently.
      const remoteBlocks = remote.stats.totalFactsLearned
      const localBlocks = local.stats.totalFactsLearned
      if (remoteBlocks > localBlocks) {
        return remote
      }
      return local
    }

    if (remote.lastPlayedAt > local.lastPlayedAt) {
      return remote
    }
    return local
  }

  // ----------------------------------------------------------
  // FIELD-LEVEL MERGE
  // ----------------------------------------------------------

  /**
   * Merges a local and remote `PlayerSave` at the field level, applying
   * domain-specific rules rather than a simple "latest timestamp wins"
   * strategy. This supplements `resolveConflict()` for callers that need
   * finer-grained control (DD-V2-182).
   *
   * Rules applied per field group:
   * - **SM-2 / review state** (`reviewStates`): remote timestamp wins.
   *   The server is the authority for learning progress to prevent cheating.
   * - **Cosmetic preferences** (`equippedCosmetic`, `activeTitle`):
   *   client (local) wins. These are low-stakes presentation choices that
   *   the player last set on this device.
   * - **Numeric progress** (`stats.*`, `minerals.*`):
   *   merge-max — take the higher value for each key independently.
   *   Ensures neither session's progress is lost when both were active.
   *
   * @param local - The save currently stored on this device.
   * @param remote - The save downloaded from the cloud.
   * @returns A merged `PlayerSave` that should be persisted and re-uploaded.
   */
  fieldLevelMerge(local: PlayerSave, remote: PlayerSave): PlayerSave {
    // --- SM-2: server wins (learning integrity) ---
    const mergedReviewStates = remote.reviewStates

    // --- Cosmetic prefs: client wins ---
    const mergedEquippedCosmetic = local.equippedCosmetic
    const mergedActiveTitle = local.activeTitle

    // --- Numeric stats: merge-max ---
    const mergedStats = { ...local.stats }
    for (const key of Object.keys(remote.stats) as (keyof typeof remote.stats)[]) {
      const rv = remote.stats[key] as number
      const lv = mergedStats[key] as number
      if (typeof rv === 'number' && typeof lv === 'number' && rv > lv) {
        // TypeScript narrows union; cast through unknown for assignment
        ;(mergedStats as Record<string, number>)[key] = rv
      }
    }

    // --- Minerals: merge-max per tier ---
    const mergedMinerals = { ...local.minerals }
    for (const tier of Object.keys(remote.minerals) as (keyof typeof remote.minerals)[]) {
      const rv = remote.minerals[tier] as number
      const lv = mergedMinerals[tier] as number
      if (typeof rv === 'number' && typeof lv === 'number' && rv > lv) {
        mergedMinerals[tier] = rv
      }
    }

    return {
      ...local,
      reviewStates: mergedReviewStates,
      equippedCosmetic: mergedEquippedCosmetic,
      activeTitle: mergedActiveTitle,
      stats: mergedStats,
      minerals: mergedMinerals,
    }
  }

  // ----------------------------------------------------------
  // INTERNALS
  // ----------------------------------------------------------

  /**
   * Uploads `saveData` to the cloud and submits derived leaderboard scores.
   * Sets `_lastUploadAttempt` before the network call so the debounce window
   * is respected even when the request fails. Updates `syncStatus` store to
   * reflect the operation state.
   *
   * @param saveData - The `PlayerSave` to upload.
   */
  private async performUpload(saveData: PlayerSave): Promise<void> {
    this._lastUploadAttempt = Date.now()
    this._isSyncing = true
    syncStatus.set('syncing')

    try {
      await apiClient.uploadSave(saveData)
      this._lastSyncTime = Date.now()
      this.writeLastSyncTime(this._lastSyncTime)
      await this.submitLeaderboardScores(saveData)
      syncStatus.set('idle')
    } catch (err) {
      console.warn('[SyncService] performUpload failed:', err)
      syncStatus.set('error')
    } finally {
      this._isSyncing = false
    }
  }

  /**
   * Iterates over all known leaderboard categories and submits the player's
   * current score for each one. Failures are logged and do not propagate.
   *
   * @param saveData - The `PlayerSave` to extract scores from.
   */
  private async submitLeaderboardScores(saveData: PlayerSave): Promise<void> {
    for (const [category, extractor] of Object.entries(LEADERBOARD_EXTRACTORS)) {
      try {
        const score = extractor(saveData)
        if (score > 0) {
          await apiClient.submitScore(category, score)
        }
      } catch (err) {
        console.warn(`[SyncService] submitScore(${category}) failed:`, err)
      }
    }
  }

  /**
   * Registers a `window.online` listener that flushes the offline queue when
   * network connectivity is restored. Safe to call in SSR environments where
   * `window` is unavailable.
   */
  private registerConnectivityListener(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('online', () => {
      void this.onConnectivityRestored()
    })
  }

  /**
   * Invoked when the `online` event fires. Flushes any operations that were
   * queued while the device was offline.
   */
  private async onConnectivityRestored(): Promise<void> {
    if (import.meta.env.DEV) console.info('[SyncService] Connectivity restored — flushing offline queue')
    await offlineQueue.flush(async (op) => {
      if (op.type === 'save') {
        // Re-push the current local save (the queued payload may be stale).
        await this.pushToCloud()
        return true
      }
      if (op.type === 'leaderboard') {
        // Re-derive leaderboard scores from the current local save.
        const localSave = loadLocalSave()
        if (localSave !== null) {
          await this.submitLeaderboardScores(localSave)
        }
        return true
      }
      return false
    })
  }

  /**
   * Reads the last-sync timestamp from localStorage.
   * Returns `null` when no timestamp has ever been stored.
   */
  private readLastSyncTime(): number | null {
    const raw = localStorage.getItem(LAST_SYNC_KEY)
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  /**
   * Persists the last-sync timestamp to localStorage.
   *
   * @param time - Unix timestamp in milliseconds.
   */
  private writeLastSyncTime(time: number): void {
    localStorage.setItem(LAST_SYNC_KEY, String(time))
  }
}

// ============================================================
// SINGLETON
// ============================================================

/** Shared sync service instance. Import and use this directly in components and GameManager. */
export const syncService = new SyncService()
