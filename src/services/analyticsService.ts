/**
 * Client-side analytics service.
 * Batches events locally and flushes them to the server every 10 seconds.
 * PII fields are stripped before any event is queued.
 * Events are persisted to localStorage so they survive page reloads.
 */

import { generateUUID } from '../utils/uuid'
import { assignExperiment, type MonetizationEvent } from '../data/analyticsEvents'

// ── Event type definitions ────────────────────────────────────────────────────

/** Fired once on cold/warm app launch. */
interface AppOpenEvent {
  name: 'app_open'
  properties: {
    platform: 'android' | 'ios' | 'web'
    app_version: string
    launch_type: 'cold' | 'warm'
    client_ts: number
    has_existing_save: boolean
    age_bracket: 'under_13' | 'teen' | 'adult' | 'unknown'
  }
}

/** Fired whenever the player completes a tutorial step. */
interface TutorialStepCompleteEvent {
  name: 'tutorial_step_complete'
  properties: {
    step_name: string
    step_index: number
    elapsed_ms: number
    used_hint: boolean
  }
}

/** Fired once when the player finishes their very first dive. */
interface FirstDiveCompleteEvent {
  name: 'first_dive_complete'
  properties: {
    layer_reached: number
    o2_remaining: number
    items_found: number
    blocks_mined: number
    dive_duration_ms: number
  }
}

/** Fired each time the player submits an answer in a quiz. */
interface QuizAnsweredEvent {
  name: 'quiz_answered'
  properties: {
    fact_id: string
    correct: boolean
    quiz_type: string
    response_time_ms: number
    current_layer: number
    distractor_count: number
  }
}

/** Fired when a fact reaches mastery threshold (SM-2 interval ≥ target days). */
interface FactMasteredEvent {
  name: 'fact_mastered'
  properties: {
    fact_id: string
    category: string
    days_to_mastery: number
    total_reviews: number
  }
}

/** Fired when the player successfully revives a fossil companion. */
interface FossilRevivedEvent {
  name: 'fossil_revived'
  properties: {
    species: string
    dives_to_unlock: number
    facts_required: number
    animation_key: string
  }
}

/** Fired at session end (visibilitychange hidden or beforeunload). */
interface SessionEndEvent {
  name: 'session_end'
  properties: {
    duration_ms: number
    screens_visited: string[]
    dives_completed: number
    reviews_completed: number
    facts_learned: number
    exit_reason: 'app_close' | 'idle_timeout' | 'explicit_exit'
  }
}

/** Fired when the player initiates any in-app purchase flow. */
interface PurchaseInitiatedEvent {
  name: 'purchase_initiated'
  properties: {
    item_type: string
    price_point: string
    trigger_context: string
    current_layer: number
  }
}

/** Fired by the backend (or client) when an absence pattern is detected. */
interface ChurnSignalEvent {
  name: 'churn_signal'
  properties: {
    absence_type: 'D3' | 'D7' | 'D30'
    days_absent: number
    last_layer: number
    streak_at_churn: number
  }
}

/** Fired when the engagement score transitions meaningfully. */
interface EngagementScoreChangeEvent {
  name: 'engagement_score_change'
  properties: {
    score_before: number
    score_after: number
    trigger_action: string
    delta: number
  }
}

/** Union of all supported analytics events. */
export type AnalyticsEvent =
  | AppOpenEvent
  | TutorialStepCompleteEvent
  | FirstDiveCompleteEvent
  | QuizAnsweredEvent
  | FactMasteredEvent
  | FossilRevivedEvent
  | SessionEndEvent
  | PurchaseInitiatedEvent
  | ChurnSignalEvent
  | EngagementScoreChangeEvent
  | MonetizationEvent

// Re-export specific types used externally
export type {
  AppOpenEvent,
  QuizAnsweredEvent,
  FactMasteredEvent,
  SessionEndEvent,
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 10_000
const QUEUE_KEY = 'terra_analytics_queue'
const SESSION_KEY = 'terra_analytics_session'

/** PII field names that must never appear in event properties. */
const PII_FIELDS = ['email', 'password', 'displayName', 'name']

// ── Service class ─────────────────────────────────────────────────────────────

/**
 * Batched analytics service.
 * Events are queued in memory (and localStorage) and sent in bulk every
 * FLUSH_INTERVAL_MS ms. On flush failure the events are re-queued and retried
 * on the next flush cycle. Session-end events are always flushed immediately
 * using the Fetch keepalive flag so they survive page unload.
 */
export class AnalyticsService {
  private sessionId: string
  private queue: AnalyticsEvent[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private sessionStartTime: number = Date.now()
  private screensVisited: string[] = []
  private divesCompleted = 0
  private reviewsCompleted = 0
  private factsLearned = 0

  constructor() {
    this.sessionId = this.getOrCreateSessionId()
    this.loadQueue()
    this.setupSessionEnd()
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Return existing session ID from sessionStorage, or create a new UUID v4. */
  private getOrCreateSessionId(): string {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = generateUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  }

  /** Load any unsent events that were persisted to localStorage. */
  private loadQueue(): void {
    try {
      const raw = localStorage.getItem(QUEUE_KEY)
      this.queue = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : []
    } catch {
      this.queue = []
    }
  }

  /** Persist the current queue to localStorage. */
  private saveQueue(): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue))
  }

  /** Schedule a flush if one is not already pending. */
  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, FLUSH_INTERVAL_MS)
  }

  /** Send all queued events to the server. On network failure, re-queue them. */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return
    const batch = [...this.queue]
    this.queue = []
    this.saveQueue()
    try {
      const apiBase = this.getApiBase()
      await fetch(`${apiBase}/api/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, events: batch }),
        keepalive: true,
      })
    } catch {
      // Network error — put events back at the front of the queue to retry
      this.queue = [...batch, ...this.queue]
      this.saveQueue()
    }
  }

  /**
   * Attach visibilitychange and beforeunload listeners to fire a session_end
   * event and immediately flush when the page is hidden or closed.
   */
  private setupSessionEnd(): void {
    if (typeof document === 'undefined') return

    const handleEnd = () => {
      this.track({
        name: 'session_end',
        properties: {
          duration_ms: Date.now() - this.sessionStartTime,
          screens_visited: this.screensVisited,
          dives_completed: this.divesCompleted,
          reviews_completed: this.reviewsCompleted,
          facts_learned: this.factsLearned,
          exit_reason: 'app_close',
        },
      })
      void this.flush()
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleEnd()
    })
    window.addEventListener('beforeunload', handleEnd)
  }

  /**
   * Resolve the API base URL from the Vite environment variable,
   * falling back to localhost for local development.
   */
  private getApiBase(): string {
    const env = (import.meta as unknown as Record<string, Record<string, string>>).env
    return env?.VITE_API_BASE_URL ?? 'http://localhost:3001'
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Queue an analytics event for delivery.
   * Any PII fields found in the properties object are stripped before queueing.
   *
   * @param event - A typed analytics event matching one of the AnalyticsEvent variants.
   */
  track(event: AnalyticsEvent): void {
    // Privacy: strip any PII fields that might have leaked in
    const props = event.properties as Record<string, unknown>
    for (const key of PII_FIELDS) {
      if (key in props) delete props[key]
    }
    this.queue.push(event)
    this.saveQueue()
    this.scheduleFlush()
  }

  /**
   * Record a screen visit for the current session.
   * Each unique screen name is recorded once; duplicates are ignored.
   *
   * @param screen - A short identifier for the screen (e.g. "mining", "dome", "quiz").
   */
  trackScreen(screen: string): void {
    if (!this.screensVisited.includes(screen)) {
      this.screensVisited.push(screen)
    }
  }

  /** Increment the dive-completion counter for the current session. */
  trackDiveComplete(): void {
    this.divesCompleted++
  }

  /** Increment the review-completion counter for the current session. */
  trackReviewComplete(): void {
    this.reviewsCompleted++
  }

  /** Increment the facts-learned counter for the current session. */
  trackFactLearned(): void {
    this.factsLearned++
  }

  // ── Monetization tracking (Phase 21.3 / DD-V2-181) ──────────────────────────

  /**
   * Track a Terra Pass modal view.
   *
   * @param source - Where the modal was triggered from.
   */
  trackTerraPassViewed(source: 'dome' | 'pre_dive' | 'oxygen_empty'): void {
    this.track({ name: 'terra_pass_viewed', properties: { source } })
  }

  /**
   * Track the start of an IAP purchase flow.
   *
   * @param productId - The store product identifier (e.g. "terra_pass_monthly").
   */
  trackIAPPurchaseStarted(productId: string): void {
    this.track({ name: 'iap_purchase_started', properties: { productId } })
  }

  /**
   * Track a completed IAP purchase.
   *
   * @param productId - The store product identifier.
   * @param priceUSD  - Converted USD price for normalization across stores.
   */
  trackIAPPurchaseCompleted(productId: string, priceUSD: number): void {
    this.track({ name: 'iap_purchase_completed', properties: { productId, priceUSD } })
  }

  /**
   * Track a failed IAP purchase attempt.
   *
   * @param productId - The store product identifier.
   * @param error     - Short error description (no user PII).
   */
  trackIAPPurchaseFailed(productId: string, error: string): void {
    this.track({ name: 'iap_purchase_failed', properties: { productId, error } })
  }

  /**
   * Track when the player's oxygen runs out in the mine.
   *
   * @param lootLostPercent - Percentage of session loot lost (0-100).
   * @param layer           - Mine layer the player was on when O2 hit zero.
   */
  trackOxygenDepleted(lootLostPercent: number, layer: number): void {
    this.track({ name: 'oxygen_depleted', properties: { lootLostPercent, layer } })
  }

  /**
   * Track a daily economy wealth snapshot for balance monitoring.
   * Should be called once per day on session open when a save is loaded.
   *
   * @param dustHeld    - Current dust currency balance.
   * @param shardHeld   - Current shard currency balance.
   * @param crystalHeld - Current crystal (premium) currency balance.
   */
  trackEconomySnapshot(dustHeld: number, shardHeld: number, crystalHeld: number): void {
    // Compute a rough unified equivalent (shards = 10× dust, crystals = 100× dust)
    const totalDustEquivalent = dustHeld + shardHeld * 10 + crystalHeld * 100
    this.track({
      name: 'economy_wealth_snapshot',
      properties: { dustHeld, shardHeld, crystalHeld, totalDustEquivalent },
    })
  }

  // ── A/B experiment assignment ────────────────────────────────────────────────

  /**
   * Return the current session ID so module-level helpers can use it.
   * The session ID is stable for the lifetime of the browser tab.
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * Get or assign a deterministic A/B experiment group for the current player.
   * The assignment is persisted in localStorage so it remains stable across
   * sessions as long as the same browser is used.
   *
   * @param experimentName - Unique name for the experiment (e.g. "pioneer_pack_cta_v2").
   * @returns 'A' or 'B' group assignment.
   */
  getExperimentGroup(experimentName: string): 'A' | 'B' {
    const key = `experiment_${experimentName}`
    const stored = localStorage.getItem(key)
    if (stored === 'A' || stored === 'B') return stored
    const group = assignExperiment(this.sessionId, experimentName)
    localStorage.setItem(key, group)
    return group
  }
}

/** Singleton analytics service instance — import and use throughout the app. */
export const analyticsService = new AnalyticsService()
