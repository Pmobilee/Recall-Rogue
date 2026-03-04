/**
 * Analytics event definitions for Phase 21 monetization tracking (DD-V2-181).
 * All events are privacy-compliant — no PII in payloads.
 */

/** Monetization analytics events */
export type MonetizationEvent =
  | { name: 'terra_pass_viewed'; properties: { source: 'dome' | 'pre_dive' | 'oxygen_empty' } }
  | { name: 'iap_purchase_started'; properties: { productId: string } }
  | { name: 'iap_purchase_completed'; properties: { productId: string; priceUSD: number } }
  | { name: 'iap_purchase_failed'; properties: { productId: string; error: string } }
  | { name: 'pioneer_pack_shown'; properties: { daysRemaining: number } }
  | { name: 'pioneer_pack_purchased'; properties: Record<string, never> }
  | { name: 'pioneer_pack_dismissed'; properties: { daysRemaining: number } }
  | { name: 'oxygen_depleted'; properties: { lootLostPercent: number; layer: number } }
  | { name: 'subscription_started'; properties: { productId: string; tier: string } }
  | { name: 'subscription_cancelled'; properties: { productId: string; daysActive: number } }
  | { name: 'season_pass_milestone_claimed'; properties: { milestone: number; track: 'free' | 'premium' } }
  | { name: 'economy_dust_spent'; properties: { amount: number; category: string } }
  | { name: 'economy_wealth_snapshot'; properties: { dustHeld: number; shardHeld: number; crystalHeld: number; totalDustEquivalent: number } }

/** Social & Multiplayer analytics events — Phase 22 */
export type SocialEvent =
  | { name: 'hub_visited'; properties: { targetPlayerId: string; visitDurationMs: number } }
  | { name: 'guestbook_entry_written'; properties: { targetPlayerId: string; messageLength: number } }
  | { name: 'gift_sent'; properties: { giftType: 'minerals' | 'fact_link'; recipientId: string } }
  | { name: 'gift_claimed'; properties: { giftType: 'minerals' | 'fact_link'; delayMs: number } }
  | { name: 'duel_challenged'; properties: { wagerDust: number } }
  | { name: 'duel_accepted'; properties: { wagerDust: number } }
  | { name: 'duel_completed'; properties: { outcome: 'win' | 'loss' | 'tie'; wagerDust: number; myScore: number; opponentScore: number } }
  | { name: 'trade_offer_sent'; properties: { additionalDust: number } }
  | { name: 'trade_offer_accepted'; properties: { additionalDust: number } }
  | { name: 'guild_joined'; properties: { guildId: string; isOpen: boolean } }
  | { name: 'guild_challenge_contributed'; properties: { challengeType: string; contribution: number } }
  | { name: 'referral_link_shared'; properties: { platform: 'copy' | 'native_share' } }

/** Learning effectiveness metrics (DD-V2-134) */
export type LearningMetricEvent =
  | { name: 'learning_retention_rate'; properties: { rate: number; totalReviews: number } }
  | { name: 'learning_lapse_rate'; properties: { rate: number; totalReviews: number } }
  | { name: 'learning_daily_study_rate'; properties: { rate: number; dau: number } }
  | { name: 'learning_facts_per_player'; properties: { median: number; p90: number } }
  | { name: 'learning_time_to_mastery'; properties: { medianDays: number } }

/** Experiment assignment for A/B testing */
export interface ExperimentAssignment {
  name: string
  group: 'A' | 'B'
  assignedAt: number
}

/**
 * Deterministic A/B experiment assignment based on hashed user ID.
 * Same user always gets same group for a given experiment.
 */
export function assignExperiment(
  userId: string,
  experimentName: string,
  weightA: number = 0.5,
): 'A' | 'B' {
  // Simple deterministic hash
  let hash = 0
  const key = `${userId}:${experimentName}`
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  const normalized = Math.abs(hash) / 2147483647 // Normalize to 0-1
  return normalized < weightA ? 'A' : 'B'
}
