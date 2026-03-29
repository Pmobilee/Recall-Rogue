/**
 * Client-side analytics service.
 * Batches events locally and flushes them to the server every 30 seconds.
 * PII fields are stripped before any event is queued.
 * Events are persisted to localStorage so they survive page reloads.
 */

import { generateUUID } from '../utils/uuid'
import { assignExperiment, type MonetizationEvent, type PrestigeEvent } from '../data/analyticsEvents'
import { get } from 'svelte/store'
import { playerSave } from '../ui/stores/playerData'
import { EXPERIMENTS } from '../data/experiments'
import { assignVariant } from '../utils/experimentBucket'

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

/** Fired when the user interacts with the PWA install prompt. */
interface PwaInstallEvent {
  name: 'pwa_install_prompted'
  properties: { action: 'accepted' | 'installed' | 'dismissed' | 'banner_dismissed' }
}

/** Fired once per session with Core Web Vitals measurements. */
interface WebVitalsEvent {
  name: 'web_vitals'
  properties: {
    lcp: number
    fcp: number
    cls: number
    inp: number
    ttfb: number
    input_delay_p95?: number
    long_task_count?: number
    long_task_max?: number
  }
}

/** Fired the first time an experiment variant is assigned to a session. */
interface ExperimentAssignedEvent {
  name: 'experiment_assigned'
  properties: { experiment_key: string; variant: string; session_id: string }
}

/** Fired when a share card is generated and the player confirms sharing. */
interface ShareCardGeneratedEvent {
  name: 'share_card_generated'
  properties: {
    template: 'fact_mastery' | 'dive_record' | 'guild_win'
    platform: 'web_share' | 'download' | 'clipboard'
    facts_mastered: number
    tree_completion_pct: number
  }
}

/** Recall Rogue run/deck funnel events (AR-14). */
interface DomainSelectEvent {
  name: 'domain_select'
  properties: {
    primary: string
    secondary: string
    archetype: string
    run_number: number
    starter_deck_size: number
    starting_ap: number
    early_boost_active: boolean
    ascension_level: number
  }
}

interface RunStartEvent {
  name: 'run_start'
  properties: {
    domain_primary: string
    domain_secondary: string
    archetype: string
    starting_ap: number
    starter_deck_size: number
    run_number: number
    ascension_level: number
  }
}

interface RunCompleteEvent {
  name: 'run_complete'
  properties: {
    result: 'retreat' | 'defeat' | 'victory'
    floor: number
    accuracy: number
    facts_answered: number
    facts_correct: number
    best_combo: number
    cards_earned: number
    bounties_completed: number
    retreat_rewards_locked: boolean
    ascension_level: number
  }
}

interface RunDeathEvent {
  name: 'run_death'
  properties: {
    floor: number
    cause: string
    accuracy: number
    encounters_won: number
  }
}

interface CashOutEvent {
  name: 'cash_out'
  properties: {
    floor: number
    gold: number
    accuracy?: number
    reason?: string
    decision?: string
    retreat_rewards_locked: boolean
    ascension_level: number
  }
}

interface CardRewardEvent {
  name: 'card_reward'
  properties: {
    option_types: string[]
    floor: number
    encounter: number
  }
}

interface CardRewardRerollEvent {
  name: 'card_reward_reroll'
  properties: {
    card_type: string
    floor: number
    encounter: number
  }
}

interface CardTypeSelectedEvent {
  name: 'card_type_selected'
  properties: {
    card_type: string
    fact_id: string
    floor: number
    encounter: number
  }
}

interface ShopVisitEvent {
  name: 'shop_visit'
  properties: {
    floor: number
    options: number
    currency: number
  }
}

interface ShopSellEvent {
  name: 'shop_sell'
  properties: {
    fact_id: string
    card_type: string
    tier: string
    gold: number
    floor: number
  }
}

/** Fired when the player buys a relic from the shop. */
interface ShopBuyRelicEvent {
  name: 'shop_buy_relic'
  properties: {
    relic_id: string
    price: number
    base_price?: number
    haggled?: boolean
    rarity: string
    floor: number
    remaining_currency: number
  }
}

/** Fired when the player buys a card from the shop. */
interface ShopBuyCardEvent {
  name: 'shop_buy_card'
  properties: {
    card_type: string
    tier: string
    price: number
    base_price?: number
    haggled?: boolean
    floor: number
    remaining_currency: number
  }
}

/** Fired when the player uses the card removal service in the shop (AR-59.15). */
interface ShopBuyRemovalEvent {
  name: 'shop_buy_removal'
  properties: {
    card_id: string
    card_type: string
    tier: string
    price: number
    base_price: number
    haggled: boolean
    floor: number
    remaining_currency: number
  }
}

interface RoomSelectedEvent {
  name: 'room_selected'
  properties: {
    room: string
    floor: number
    encounter: number
  }
}

interface CardPlayEvent {
  name: 'card_play'
  properties: {
    fact_id: string
    card_type: string
    tier: string
    correct: boolean
    combo: number
    response_time_ms: number | null
    floor: number
    encounter: number
  }
}

interface AnswerCorrectEvent {
  name: 'answer_correct'
  properties: {
    fact_id: string
    card_type: string
    response_time_ms: number | null
    floor: number
  }
}

interface AnswerIncorrectEvent {
  name: 'answer_incorrect'
  properties: {
    fact_id: string
    card_type: string
    response_time_ms: number | null
    floor: number
  }
}

interface TierUpgradeEvent {
  name: 'tier_upgrade'
  properties: {
    fact_id: string
    old_tier: string
    new_tier: string
  }
}

interface DailyExpeditionStartEvent {
  name: 'daily_expedition_start'
  properties: {
    date_key: string
    seed: number
    player_id: string
  }
}

interface DailyExpeditionCompleteEvent {
  name: 'daily_expedition_complete'
  properties: {
    score: number
    floor_reached: number
    accuracy: number
    best_combo: number
    run_duration_ms: number
  }
}

interface MasteryChallengeEvent {
  name: 'mastery_challenge_start' | 'mastery_challenge_pass' | 'mastery_challenge_fail'
  properties: {
    fact_id: string
    floor: number
    encounter?: number
  }
}

interface SettingsChangeEvent {
  name: 'settings_change'
  properties: {
    setting: string
    value: string | number | boolean
  }
}

interface AccountCreatedEvent {
  name: 'account_created'
  properties: {
    method: 'register' | 'login'
    has_cloud_sync: boolean
  }
}

interface FeedbackSubmittedEvent {
  name: 'feedback_submitted'
  properties: {
    length: number
  }
}

interface InviteCodeValidatedEvent {
  name: 'invite_code_validated'
  properties: {
    code: string
    accepted: boolean
  }
}

/** Fired when the player shares their referral link from the ReferralModal. */
interface ReferralLinkSharedEvent {
  name: 'referral_link_shared'
  properties: {
    channel: 'copy' | 'native_share' | 'direct'
    qualified_referrals_so_far: number
    current_tier_threshold: number
  }
}

/** Fired on the NEW player's device when they complete their first dive
 *  and a referral code was present in their onboarding session. */
interface ReferralConvertedEvent {
  name: 'referral_converted'
  properties: {
    days_since_click:  number   // float
    referrer_tier:     string   // 'none' | 'patron' | 'pioneer'
    onboarding_source: 'invite_link' | 'badge_link' | 'organic'
  }
}

/** Fired when a player shares a social proof badge. */
interface BadgeSharedEvent {
  name: 'badge_shared'
  properties: {
    badge_id:     string
    share_method: 'clipboard' | 'native_share' | 'direct_link'
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
  | PwaInstallEvent
  | WebVitalsEvent
  | ExperimentAssignedEvent
  | ShareCardGeneratedEvent
  | DomainSelectEvent
  | RunStartEvent
  | RunCompleteEvent
  | RunDeathEvent
  | CashOutEvent
  | CardRewardEvent
  | CardRewardRerollEvent
  | CardTypeSelectedEvent
  | ShopVisitEvent
  | ShopSellEvent
  | ShopBuyRelicEvent
  | ShopBuyCardEvent
  | ShopBuyRemovalEvent
  | RoomSelectedEvent
  | CardPlayEvent
  | AnswerCorrectEvent
  | AnswerIncorrectEvent
  | TierUpgradeEvent
  | DailyExpeditionStartEvent
  | DailyExpeditionCompleteEvent
  | MasteryChallengeEvent
  | SettingsChangeEvent
  | AccountCreatedEvent
  | FeedbackSubmittedEvent
  | InviteCodeValidatedEvent
  | ReferralLinkSharedEvent
  | ReferralConvertedEvent
  | BadgeSharedEvent
  | PrestigeEvent

// Re-export specific types used externally
export type {
  AppOpenEvent,
  QuizAnsweredEvent,
  FactMasteredEvent,
  SessionEndEvent,
}

// ── COPPA: Kid Mode analytics allowlist (DD-V2-131) ───────────────────────────

/** Events allowed to be tracked even in kid mode (COPPA compliance). */
const KID_ALLOWED_EVENTS = new Set(['session_start', 'session_end', 'dive_complete', 'fact_learned'])

/**
 * Returns true when the current player is in kid mode (ageRating === 'kid').
 * Safe to call when playerSave is null (returns false by default).
 */
export function isKidMode(): boolean {
  const save = get(playerSave)
  return save?.ageRating === 'kid'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 30_000
const MAX_QUEUE_BEFORE_FLUSH = 50
const QUEUE_KEY = 'rr_analytics_queue'
const SESSION_KEY = 'rr_analytics_session'

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
    return env?.VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Queue an analytics event for delivery.
   * Any PII fields found in the properties object are stripped before queueing.
   * On iOS, this is gated behind ATT consent (analyticsEnabled store).
   *
   * @param event - A typed analytics event matching one of the AnalyticsEvent variants.
   */
  track(event: AnalyticsEvent): void {
    // ATT consent gate (Phase 38): do not queue any event if analytics is disabled.
    // Read directly from localStorage to avoid circular import: analyticsService → settings → playerData → analyticsService
    if (window.localStorage.getItem('setting_analyticsEnabled') === 'false') return

    // COPPA compliance (Phase 45): in kid mode, only allow a small set of events.
    if (isKidMode() && !KID_ALLOWED_EVENTS.has(event.name)) return

    // Privacy: strip any PII fields that might have leaked in
    const props = event.properties as Record<string, unknown>
    for (const key of PII_FIELDS) {
      if (key in props) delete props[key]
    }
    this.queue.push(event)
    this.saveQueue()

    if (this.queue.length >= MAX_QUEUE_BEFORE_FLUSH) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer)
        this.flushTimer = null
      }
      void this.flush()
      return
    }

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
   * Track a Rogue Pass modal view.
   *
   * @param source - Where the modal was triggered from.
   */
  trackRoguePassViewed(source: 'dome' | 'pre_dive' | 'oxygen_empty'): void {
    this.track({ name: 'terra_pass_viewed', properties: { source } })
  }

  /**
   * Track the start of an IAP purchase flow.
   *
   * @param productId - The store product identifier (e.g. "rogue_pass_monthly").
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
   * Get the assigned variant for an experiment.
   * Assignment is stable for the lifetime of the device.
   * Fires an `experiment_assigned` event the first time a variant is resolved,
   * so we can count impressions in the cohort dashboard.
   *
   * @param experimentKey - Must match an ExperimentDef.key in EXPERIMENTS.
   * @returns The variant label string.
   */
  getExperimentVariant(experimentKey: string): string {
    const cacheKey = `exp_${experimentKey}`
    const stored = localStorage.getItem(cacheKey)
    if (stored) return stored

    // Hash sessionId + experimentKey to pick a variant
    const allVariants = EXPERIMENTS.find((e) => e.key === experimentKey)?.variants ?? ['control', 'treatment']
    const variant = assignVariant(this.sessionId, experimentKey, allVariants)
    localStorage.setItem(cacheKey, variant)

    // Track assignment — fires only on first resolution
    this.track({
      name: 'experiment_assigned',
      properties: { experiment_key: experimentKey, variant, session_id: this.sessionId },
    })
    return variant
  }

  /**
   * Backward-compatible wrapper for getExperimentVariant().
   * Returns 'A' if the variant is the first (control) variant, 'B' otherwise.
   *
   * @param experimentName - Unique name for the experiment.
   * @returns 'A' or 'B' group assignment.
   * @deprecated Use getExperimentVariant() instead for full variant label support.
   */
  getExperimentGroup(experimentName: string): 'A' | 'B' {
    const variant = this.getExperimentVariant(experimentName)
    const allVariants = EXPERIMENTS.find((e) => e.key === experimentName)?.variants ?? ['control', 'treatment']
    return variant === allVariants[0] ? 'A' : 'B'
  }
}

/** Singleton analytics service instance — import and use throughout the app. */
export const analyticsService = new AnalyticsService()
