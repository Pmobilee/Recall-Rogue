/**
 * @file offlineQueue.ts
 * Offline operation queue — stores pending sync operations when the device is
 * offline and replays them when connectivity is restored.
 */

// ============================================================
// TYPES
// ============================================================

/** A single queued sync operation awaiting replay. */
interface QueuedOperation {
  /** Unique identifier for the operation (random UUID). */
  id: string
  /** Whether this is a full save upload or a leaderboard submission. */
  type: 'save' | 'leaderboard'
  /** The serialisable payload attached to the operation. */
  payload: unknown
  /** How many times this operation has already been attempted. */
  attemptCount: number
  /** Unix timestamp (ms) when the operation was first enqueued. */
  enqueuedAt: number
}

// ============================================================
// CONSTANTS
// ============================================================

/** localStorage key used to persist the queue across page reloads. */
const QUEUE_KEY = 'terra_offline_queue'

/** Operations that have failed this many times are dropped permanently. */
const MAX_ATTEMPTS = 5

// ============================================================
// OFFLINE QUEUE
// ============================================================

/**
 * Persists sync operations that could not be sent while the device was offline
 * and flushes them when connectivity is restored.
 *
 * Use the exported `offlineQueue` singleton — do not instantiate directly.
 *
 * @example
 * ```ts
 * import { offlineQueue } from './offlineQueue'
 *
 * // Enqueue a save operation while offline:
 * offlineQueue.enqueue({ type: 'save', payload: playerSave })
 *
 * // Replay all pending operations when back online:
 * await offlineQueue.flush(async (op) => {
 *   if (op.type === 'save') { await pushSave(); return true }
 *   return false
 * })
 * ```
 */
export class OfflineQueue {
  private queue: QueuedOperation[] = []

  constructor() {
    this.loadQueue()
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  /**
   * Adds an operation to the persistent queue.
   *
   * @param op - The operation to enqueue (without `id`, `attemptCount`, or
   *   `enqueuedAt` — those are assigned automatically).
   */
  enqueue(op: Omit<QueuedOperation, 'id' | 'attemptCount' | 'enqueuedAt'>): void {
    this.queue.push({
      ...op,
      id: crypto.randomUUID(),
      attemptCount: 0,
      enqueuedAt: Date.now(),
    })
    this.saveQueue()
  }

  /**
   * Attempts to execute all pending operations via the supplied `executor`.
   *
   * Operations for which `executor` returns `true` are removed from the queue.
   * Operations that fail or return `false` have their `attemptCount` incremented
   * and are retained until they reach `MAX_ATTEMPTS`, at which point they are
   * permanently dropped.
   *
   * @param executor - An async function that receives a queued operation and
   *   returns `true` on success or `false` to reschedule the operation.
   */
  async flush(executor: (op: QueuedOperation) => Promise<boolean>): Promise<void> {
    const remaining: QueuedOperation[] = []

    for (const op of this.queue) {
      try {
        const success = await executor(op)
        if (!success) {
          op.attemptCount++
          if (op.attemptCount < MAX_ATTEMPTS) {
            remaining.push(op)
          } else {
            console.warn(
              `[OfflineQueue] Dropping operation ${op.id} (type=${op.type}) after ${op.attemptCount} failed attempts`,
            )
          }
        }
        // success === true → operation is done, not pushed to remaining
      } catch (err) {
        console.warn(`[OfflineQueue] Executor threw for operation ${op.id}:`, err)
        op.attemptCount++
        if (op.attemptCount < MAX_ATTEMPTS) {
          remaining.push(op)
        }
      }
    }

    this.queue = remaining
    this.saveQueue()
  }

  /**
   * The number of operations currently waiting in the queue.
   */
  get pendingCount(): number {
    return this.queue.length
  }

  // ----------------------------------------------------------
  // PERSISTENCE
  // ----------------------------------------------------------

  /** Loads the queue from localStorage, falling back to an empty array on error. */
  private loadQueue(): void {
    try {
      const raw = localStorage.getItem(QUEUE_KEY)
      this.queue = raw ? (JSON.parse(raw) as QueuedOperation[]) : []
    } catch {
      this.queue = []
    }
  }

  /** Persists the current queue to localStorage. */
  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue))
    } catch (err) {
      console.warn('[OfflineQueue] Could not persist queue to localStorage:', err)
    }
  }
}

// ============================================================
// SINGLETON
// ============================================================

/** Shared offline-queue instance. Import and use this directly. */
export const offlineQueue = new OfflineQueue()
