import { apiClient } from './apiClient'
import { generateUUID } from '../utils/uuid'
import { writable } from 'svelte/store'

// EL-002 / SL-001: Widened to include multiplayer categories so MP run-end scores
// can be submitted to the season leaderboard via the existing queue infrastructure.
// The server's /leaderboards/:category endpoint accepts any string key, so no backend
// changes are needed for this to land. Server-side category validation can be added
// in a follow-up once the Fastify route layer is ready to enforce the enum.
type CompetitiveCategory =
  | 'daily_expedition'
  | 'endless_depths'
  | 'scholar_challenge'
  | 'multiplayer_race'
  | 'multiplayer_coop'
  | 'multiplayer_duel'

interface QueuedScoreSubmission {
  id: string
  category: CompetitiveCategory
  score: number
  metadata: Record<string, unknown>
  attemptCount: number
  queuedAt: number
}

const STORAGE_KEY = 'recall-rogue-score-submission-queue-v1'
const STATUS_KEY = 'recall-rogue-score-submission-status-v1'
const MAX_ATTEMPTS = 5
const MAX_QUEUE_SIZE = 80

export interface ScoreSubmissionQueueStatus {
  pendingCount: number
  lastAttemptAt: number | null
  lastSuccessAt: number | null
  lastFailureAt: number | null
  lastErrorMessage: string | null
}

const defaultStatus: ScoreSubmissionQueueStatus = {
  pendingCount: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastErrorMessage: null,
}

export const scoreSubmissionQueueStatus = writable<ScoreSubmissionQueueStatus>(defaultStatus)

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

function sanitizeScore(score: number): number {
  const safe = Number(score)
  if (!Number.isFinite(safe)) return 0
  return Math.max(0, Math.round(safe))
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(metadata ?? {})) as Record<string, unknown>
  } catch {
    return {}
  }
}

export class ScoreSubmissionQueue {
  private queue: QueuedScoreSubmission[] = []
  private isFlushing = false
  private initialized = false
  private status: ScoreSubmissionQueueStatus = defaultStatus

  constructor() {
    this.queue = this.readQueue()
    this.status = this.readStatus()
    this.syncStatusStore()
  }

  init(): void {
    if (this.initialized) return
    this.initialized = true
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.flush()
      })
    }
    void this.flush()
  }

  enqueue(category: CompetitiveCategory, score: number, metadata: Record<string, unknown>): void {
    if (!apiClient.isLoggedIn()) return
    const item: QueuedScoreSubmission = {
      id: generateUUID(),
      category,
      score: sanitizeScore(score),
      metadata: sanitizeMetadata(metadata),
      attemptCount: 0,
      queuedAt: Date.now(),
    }
    this.queue.push(item)
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(this.queue.length - MAX_QUEUE_SIZE)
    }
    this.writeQueue()
    this.updateStatus()
    void this.flush()
  }

  async flush(): Promise<void> {
    if (this.isFlushing) return
    if (!apiClient.isLoggedIn()) return
    if (!isOnline()) return
    if (this.queue.length === 0) return

    const attemptAt = Date.now()
    this.updateStatus({
      lastAttemptAt: attemptAt,
    })
    this.isFlushing = true
    try {
      const remaining: QueuedScoreSubmission[] = []
      let hadSuccess = false
      let lastFailureMessage: string | null = null
      for (const item of this.queue) {
        try {
          await apiClient.submitScore(item.category, item.score, item.metadata)
          hadSuccess = true
        } catch (error) {
          item.attemptCount += 1
          lastFailureMessage = error instanceof Error ? error.message : String(error)
          if (item.attemptCount >= MAX_ATTEMPTS) {
            console.warn(
              `[scoreSubmissionQueue] Dropping ${item.category} score after ${item.attemptCount} attempts`,
              { id: item.id, error },
            )
          } else {
            remaining.push(item)
          }
        }
      }
      this.queue = remaining
      this.writeQueue()
      this.updateStatus({
        ...(hadSuccess ? { lastSuccessAt: Date.now() } : {}),
        ...(lastFailureMessage !== null
          ? { lastFailureAt: Date.now(), lastErrorMessage: lastFailureMessage }
          : hadSuccess
            ? { lastErrorMessage: null }
            : {}),
      })
    } finally {
      this.isFlushing = false
    }
  }

  getPendingCount(): number {
    return this.queue.length
  }

  private readQueue(): QueuedScoreSubmission[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as QueuedScoreSubmission[]
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((entry) => (
          entry &&
          typeof entry.id === 'string' &&
          typeof entry.category === 'string' &&
          typeof entry.score === 'number' &&
          Number.isFinite(entry.score) &&
          typeof entry.attemptCount === 'number' &&
          typeof entry.queuedAt === 'number' &&
          typeof entry.metadata === 'object' &&
          entry.metadata !== null &&
          !Array.isArray(entry.metadata)
        ))
        .map((entry) => ({
          ...entry,
          score: sanitizeScore(entry.score),
          metadata: sanitizeMetadata(entry.metadata),
          attemptCount: Math.max(0, Math.floor(entry.attemptCount)),
          queuedAt: Math.max(0, Math.floor(entry.queuedAt)),
        }))
    } catch {
      return []
    }
  }

  private writeQueue(): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
    } catch {
      // Ignore localStorage failures.
    }
  }

  private readStatus(): ScoreSubmissionQueueStatus {
    if (typeof window === 'undefined') return { ...defaultStatus, pendingCount: this.queue.length }
    try {
      const raw = window.localStorage.getItem(STATUS_KEY)
      if (!raw) return { ...defaultStatus, pendingCount: this.queue.length }
      const parsed = JSON.parse(raw) as Partial<ScoreSubmissionQueueStatus>
      if (!parsed || typeof parsed !== 'object') return { ...defaultStatus, pendingCount: this.queue.length }
      return {
        pendingCount: this.queue.length,
        lastAttemptAt: typeof parsed.lastAttemptAt === 'number' ? parsed.lastAttemptAt : null,
        lastSuccessAt: typeof parsed.lastSuccessAt === 'number' ? parsed.lastSuccessAt : null,
        lastFailureAt: typeof parsed.lastFailureAt === 'number' ? parsed.lastFailureAt : null,
        lastErrorMessage: typeof parsed.lastErrorMessage === 'string' ? parsed.lastErrorMessage : null,
      }
    } catch {
      return { ...defaultStatus, pendingCount: this.queue.length }
    }
  }

  private writeStatus(): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STATUS_KEY, JSON.stringify(this.status))
    } catch {
      // Ignore localStorage failures.
    }
  }

  private syncStatusStore(): void {
    this.status = {
      ...this.status,
      pendingCount: this.queue.length,
    }
    scoreSubmissionQueueStatus.set(this.status)
    this.writeStatus()
  }

  private updateStatus(partial: Partial<ScoreSubmissionQueueStatus> = {}): void {
    this.status = {
      ...this.status,
      ...partial,
      pendingCount: this.queue.length,
    }
    this.syncStatusStore()
  }
}

export const scoreSubmissionQueue = new ScoreSubmissionQueue()

export function initScoreSubmissionQueue(): void {
  scoreSubmissionQueue.init()
}

export function enqueueCompetitiveScoreSubmission(
  category: CompetitiveCategory,
  score: number,
  metadata: Record<string, unknown>,
): void {
  scoreSubmissionQueue.enqueue(category, score, metadata)
}
