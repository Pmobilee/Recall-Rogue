/**
 * Analytics event definitions for Phase 21 monetization tracking (DD-V2-181).
 * All events are privacy-compliant — no PII in payloads.
 */

/** Monetization analytics events */
export type MonetizationEvent =
  | { name: 'iap_purchase_started'; properties: { productId: string } }
  | { name: 'iap_purchase_completed'; properties: { productId: string; priceUSD: number } }
  | { name: 'iap_purchase_failed'; properties: { productId: string; error: string } }
  | { name: 'subscription_started'; properties: { productId: string; tier: string } }
  | { name: 'subscription_cancelled'; properties: { productId: string; daysActive: number } }
  | { name: 'season_pass_milestone_claimed'; properties: { milestone: number; track: 'free' | 'premium' } }
  | { name: 'economy_grey_matter_spent'; properties: { amount: number; category: string } }
  | { name: 'economy_wealth_snapshot'; properties: { greyMatterHeld: number } }

/** Social & Multiplayer analytics events — Phase 22 */
export type SocialEvent =
  | { name: 'hub_visited'; properties: { targetPlayerId: string; visitDurationMs: number } }
  | { name: 'guestbook_entry_written'; properties: { targetPlayerId: string; messageLength: number } }
  | { name: 'gift_sent'; properties: { giftType: 'minerals' | 'fact_link'; recipientId: string } }
  | { name: 'gift_claimed'; properties: { giftType: 'minerals' | 'fact_link'; delayMs: number } }
  | { name: 'duel_challenged'; properties: { wagerGreyMatter: number } }
  | { name: 'duel_accepted'; properties: { wagerGreyMatter: number } }
  | { name: 'duel_completed'; properties: { outcome: 'win' | 'loss' | 'tie'; wagerGreyMatter: number; myScore: number; opponentScore: number } }
  | { name: 'trade_offer_sent'; properties: { additionalGreyMatter: number } }
  | { name: 'trade_offer_accepted'; properties: { additionalGreyMatter: number } }
  | { name: 'guild_joined'; properties: { guildId: string; isOpen: boolean } }
  | { name: 'guild_challenge_contributed'; properties: { challengeType: string; contribution: number } }
  | { name: 'referral_link_shared'; properties: { platform: 'copy' | 'native_share' } }

/** Prestige & Endgame analytics events — Phase 48 */
export type PrestigeEvent =
  | { name: 'prestige_triggered'; properties: { new_level: number; lifetime_mastered: number } }
  | { name: 'challenge_mode_result'; properties: { mode: 'speed' | 'no_hint' | 'reverse'; correct: boolean; streak: number } }
  | { name: 'biome_completed'; properties: { biome_id: string } }

/** Co-op analytics events — Phase 43 */
export type CoopEvent =
  | { name: 'coop_dive_started'; properties: { role: 'miner' | 'scholar'; matchType: 'friend' | 'code' | 'quickmatch' } }
  | { name: 'coop_dive_completed'; properties: { bothActive: boolean; cooperationBonusEarned: boolean; totalLoot: number } }
  | { name: 'coop_scholar_disconnect'; properties: { tick: number; reconnected: boolean } }
  | { name: 'coop_emote_sent'; properties: { emote: string } }

/** Learning effectiveness metrics (DD-V2-134) */
export type LearningMetricEvent =
  | { name: 'learning_retention_rate'; properties: { rate: number; totalReviews: number } }
  | { name: 'learning_lapse_rate'; properties: { rate: number; totalReviews: number } }
  | { name: 'learning_daily_study_rate'; properties: { rate: number; dau: number } }
  | { name: 'learning_facts_per_player'; properties: { median: number; p90: number } }
  | { name: 'learning_time_to_mastery'; properties: { medianDays: number } }
