import type { InterestConfig } from './interestConfig'
import { CATEGORIES, type FactDomain, isFactDomain } from './categories'
import type { StudyPreset, DeckMode, LastDungeonSelection } from './studyPreset'

/** Visual upgrade tier for a hub floor. 0 = bare scaffolding, 3 = premium. */
export type FloorUpgradeTier = 0 | 1 | 2 | 3

/** Per-save state for the hub (inlined from archived hubLayout.ts for backward compat). */
export interface HubSaveState {
  unlockedFloorIds: string[]
  activeWallpapers: Record<string, string | null>
  floorTiers: Record<string, FloorUpgradeTier>
  lastBriefingDate: string | null
  firstDomeTourComplete?: boolean
}
import type { BehavioralSignals } from '../services/behavioralLearner'
import type { ArchetypeData } from '../services/archetypeDetector'
import type { EngagementData } from '../services/engagementScorer'

// ============================================================
// CONTENT TYPES
// ============================================================

/** Content type - extensible for language learning */
export type ContentType = 'fact' | 'vocabulary' | 'grammar' | 'phrase'

/** Distractor with confidence score and difficulty tier (DD-V2-086, DD-V2-087) */
export interface Distractor {
  text: string
  difficultyTier: 'easy' | 'medium' | 'hard'
  distractorConfidence: number
}

/** Content volatility enum (DD-V2-092) */
export type ContentVolatility = 'timeless' | 'slow_change' | 'current_events'

/** Pixel art generation status */
export type PixelArtStatus = 'none' | 'generating' | 'review' | 'approved' | 'rejected'

/** Pipeline review state (DD-V2-088) */
export type FactStatus = 'draft' | 'approved' | 'archived'

/** GAIA wrong-answer comments per mood (DD-V2-105) */
export interface GaiaWrongComments {
  snarky: string
  enthusiastic: string
  calm: string
}

/** Core fact subset for boot-time loading — only essential quiz fields */
export interface CoreFact {
  id: string
  statement: string
  correctAnswer: string
  category: string[]
  categoryL1?: string
  categoryL2?: string
  contentVolatility?: ContentVolatility
  distractorCount?: number
  status?: FactStatus
}

/** Age rating for content filtering */
export type AgeRating = 'kid' | 'teen' | 'adult'

export { CATEGORIES, isFactDomain }
export type { FactDomain }

/** Artifact rarity tier */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

/** A pending artifact awaiting analysis in the Artifact Lab. */
export interface PendingArtifact {
  factId: string
  rarity: Rarity
  discoveredAt: number
}

/** A question variant for knowledge facts (vocab cards use their own system) */
export interface QuestionVariant {
  question: string;
  type: 'forward' | 'reverse' | 'negative' | 'context' | 'fill_blank' | 'true_false';
  correctAnswer?: string; // May differ from fact.correctAnswer for reverse questions
  answer?: string;        // Alternate field name used by some generated variants
  distractors?: string[]; // Variant-specific distractors (optional, falls back to fact.distractors)
}

/** A single learnable fact/word in the database */
export interface Fact {
  id: string
  type: ContentType

  // Core content
  statement: string           // Clear, concise (Anki-optimized)
  wowFactor?: string          // Mind-blowing framing (shown on reveal)
  explanation: string         // Why it's true / context
  gaiaComment?: string        // GAIA's snarky ingestion comment

  // Quiz
  quizQuestion: string
  correctAnswer: string
  distractors: string[]       // 8-25 plausible wrong answers
  variants?: QuestionVariant[]; // Question variants for knowledge facts (vocab excluded)

  // Classification
  category: string[]          // Hierarchical: ["Language", "Japanese", "N3"]
  rarity: Rarity
  difficulty: number          // 1-5
  funScore: number            // 1-10
  ageRating: AgeRating

  // Sourcing
  sourceName?: string
  verifiedAt?: string | null

  // Language-specific (optional)
  language?: string           // e.g., "ja"
  pronunciation?: string      // Reading/IPA
  exampleSentence?: string
  fullDefinition?: string     // Extended dictionary-style definition (vocab facts)
  cognate?: string            // Cognate word in another language (vocab facts)

  // Media (future)
  imageUrl?: string
  /** Path to image asset for image-based quiz modes (e.g. flags). */
  imageAssetPath?: string
  /** Quiz presentation mode: 'text' (default), 'image_question', 'image_answers'. */
  quizMode?: 'text' | 'image_question' | 'image_answers'
  mnemonic?: string

  // Phase 11 extended fields
  status?: FactStatus                         // DD-V2-088
  alternateExplanations?: string[]            // DD-V2-112
  gaiaComments?: string[]                     // DD-V2-114 (3-5 entries, replaces gaiaComment)
  gaiaWrongComments?: GaiaWrongComments       // DD-V2-105
  acceptableAnswers?: string[]                // DD-V2-104
  distractorObjects?: Distractor[]            // Full structured distractors from server
  distractorCount?: number                    // DD-V2-090
  categoryL1?: string                         // DD-V2 hierarchical decomposition
  categoryL2?: string
  categoryL3?: string
  noveltyScore?: number                       // 1-10
  sensitivityLevel?: number                   // 0-5
  sensitivityNote?: string
  contentVolatility?: ContentVolatility       // DD-V2-092
  sourceUrl?: string                          // DD-V2-089
  inGameReports?: number                      // DD-V2-089
  relatedFacts?: string[]                     // DD-V2-121
  tags?: string[]
  imagePrompt?: string
  visualDescription?: string
  hasPixelArt?: boolean
  pixelArtStatus?: PixelArtStatus
  /** Relative path of the approved 64×64 sprite served by the asset pipeline.
   *  Null when the sprite has not yet been generated or approved.
   *  e.g. "/assets/sprites/facts/fact_geol_001.png" */
  pixelArtPath?: string | null
}

// ============================================================
// SM-2 SPACED REPETITION
// ============================================================

/** Anki-faithful card state machine */
export type CardState = 'new' | 'learning' | 'review' | 'relearning' | 'suspended'

/** SM-2 review state for a single fact (Anki-faithful) */
export interface ReviewState {
  factId: string
  cardState: CardState          // Anki card state machine
  easeFactor: number            // Starts 2.5, min 1.3
  interval: number              // Days until next review (for review cards)
  repetitions: number           // Consecutive correct answers in review state
  nextReviewAt: number          // Unix timestamp (ms)
  lastReviewAt: number          // Unix timestamp (ms)
  quality: number               // Last response quality (0-5)
  learningStep: number          // Current step index in learning/relearning (0-based)
  lapseCount: number            // Total times card has lapsed
  isLeech: boolean              // Flagged after SM2_LEECH_THRESHOLD lapses
  /** Context in which the fact was last reviewed. */
  lastReviewContext?: 'study' | 'ritual'
  /** Cumulative number of times this fact has been answered incorrectly (never resets). */
  wrongCount?: number
  /** FSRS-style stability (days) used by card tier derivation. */
  stability?: number
  /** Consecutive correct answers used for tier progression gates. */
  consecutiveCorrect?: number
  /** True once the fact passes Mastery Trial and can become Tier 3. */
  passedMasteryTrial?: boolean
  /** FSRS retrievability used for relic dormancy checks. */
  retrievability?: number
  /** FSRS difficulty (1-10), lower is easier recall. */
  difficulty?: number
  /** Next due timestamp mirror for FSRS wrappers. */
  due?: number
  /** Last review timestamp mirror for FSRS wrappers. */
  lastReview?: number
  /** Total successful review reps (FSRS mirror). */
  reps?: number
  /** Total lapses (FSRS mirror). */
  lapses?: number
  /** Current FSRS state label for compatibility. */
  state?: 'new' | 'learning' | 'review' | 'relearning'
  /** Timestamp (ms) when fact entered mastery/relic state. */
  masteredAt?: number
  /** Relic assigned when this fact graduated to Tier 3. */
  graduatedRelicId?: string | null
  /** Last question variant index used for this fact (anti-repeat). */
  lastVariantIndex?: number
  /** Lifetime analytics for encounter answers. */
  totalAttempts?: number
  totalCorrect?: number
  averageResponseTimeMs?: number
  /** Tier transition log for library detail view. */
  tierHistory?: Array<{ from: '1' | '2a' | '2b' | '3'; to: '1' | '2a' | '2b' | '3'; date: number }>
}

/** Forward-compatible alias used by card-roguelite systems after FSRS migration. */
export type PlayerFactState = ReviewState

/** Mineral currency tiers — ordered from common (surface) to rare (extreme depth) */
export type MineralTier = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'

// ============================================================
// SOCIAL TYPES — Phase 22
// ============================================================

/** Hub snapshot for visiting another player's dome */
export interface HubSnapshot {
  playerId: string;
  displayName: string;
  playerLevel: number;
  patronBadge: string | null;
  pioneerBadge: boolean;
  joinDate: string;
  dome: {
    wallpaper: string;
    unlockedRooms: string[];
    decorations: { objectKey: string; x: number; y: number }[];
    petDisplayed: { species: string; stage: number } | null;
  };
  knowledgeTree: {
    totalFacts: number;
    masteredFacts: number;
    categoryBreakdown: Record<string, { total: number; mastered: number }>;
    topBranch: string;
    completionPercent: number;
  };
  zoo: { revived: string[]; totalCount: number; rarest: string };
  farm: { animalCount: number; activeSpecies: string[] };
  gallery: { achievements: string[] };
  guestbook: GuestbookEntry[];
  visitCount: number;
  lastActive: string;
}

/** A single entry in a player's dome guestbook */
export interface GuestbookEntry {
  id: string;
  authorId: string;
  authorDisplayName: string;
  message: string;
  createdAt: number;
}

/** Record of a gift sent between players */
export interface GiftRecord {
  id: string;
  senderId: string;
  senderName: string;
  giftType: 'minerals' | 'fact_link';
  payload: { amount?: number; factId?: string; factPreview?: string };
  sentAt: number;
  claimed: boolean;
}

/** Aggregate duel performance stats for a player */
export interface DuelStats {
  wins: number;
  losses: number;
  ties: number;
  totalDuels: number;
  totalDustWon: number;
  totalDustLost: number;
  currentWinStreak: number;
  longestWinStreak: number;
}

/** A single asynchronous knowledge duel record */
export interface DuelRecord {
  id: string;
  opponentId: string;
  opponentName: string;
  status: 'pending' | 'challenger_done' | 'opponent_done' | 'completed' | 'timed_out' | 'declined';
  wagerDust: number;
  myScore?: number;
  opponentScore?: number;
  createdAt: number;
  expiresAt: number;
}

/** A tradeable artifact card instance in a player's inventory */
export interface ArtifactCard {
  instanceId: string;
  factId: string;
  rarity: string;
  discoveredAt: number;
  isSoulbound: boolean;
  isListed: boolean;
  listPrice?: number;
}

/** A peer-to-peer artifact card trade offer */
export interface TradeOffer {
  id: string;
  offererId: string;
  receiverId: string;
  offeredCardInstanceId: string;
  requestedCardInstanceId: string;
  additionalDust: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: number;
}

/** Summarised guild membership info stored in a player's save */
export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  emblemId: number;
  rank: number;
  gkp: number;
  memberCount: number;
  isOpen: boolean;
  description: string;
  /** Primary knowledge focus area for the guild (Phase 56). */
  primaryFocus?: string;
  /** Branch completion percentages keyed by category (Phase 56). */
  branchCompletion?: Record<string, number>;
  /** Total guild XP pool (Phase 56). */
  guildXp?: number;
}

/** A guild's weekly collaborative challenge */
export interface GuildChallenge {
  id: string;
  challengeType: string;
  target: number;
  progress: number;
  isCompleted: boolean;
  weekStart: number;
}

/** Record of a referral invitation and its reward status (Phase 22 base + Phase 42.2 extension) */
export interface ReferralRecord {
  inviteeId: string;
  inviteeName: string;
  status: 'pending' | 'dive_reward_sent' | 'streak_reward_sent' | 'completed' | 'flagged';
  createdAt: number;
  // Phase 42.2 extended fields
  referredPlayerId?: string;
  linkClickedAt?: string;       // ISO timestamp
  appInstalledAt?: string | null;
  firstDiveAt?: string | null;
  qualified?: boolean;          // true once first dive complete within attribution window
  rewardClaimed?: boolean;
}

/** Phase 42.3: An earned social proof badge. */
export interface EarnedBadge {
  id:       string;
  earnedAt: string;  // ISO timestamp
}

// ============================================================
// PLAYER / SAVE STATE
// ============================================================

/** Full player save data */
export interface PlayerSave {
  version: number             // Save format version (for migrations)
  factDbVersion: number       // Tracks last synced facts DB version for delta sync
  playerId: string
  /** Anonymous device identity used for optional cloud save. */
  deviceId?: string
  /** Optional claimed account ID (set after login/register). */
  accountId?: string | null
  /** Optional account email for settings display. */
  accountEmail?: string | null
  /** Whether cloud sync is enabled for this profile. */
  cloudSyncEnabled?: boolean
  /** Last successful cloud sync timestamp (epoch ms). */
  lastCloudSyncAt?: number
  ageRating: AgeRating
  createdAt: number
  lastPlayedAt: number
  /** Per-domain run counters used for early FSRS boost windows. */
  domainRunCounts: Record<string, number>

  // Resources
  oxygen: number              // Current stored oxygen tanks
  minerals: Record<MineralTier, number>

  // Knowledge
  learnedFacts: string[]      // Fact IDs the player has ingested
  reviewStates: ReviewState[] // SM-2 state per fact
  soldFacts: string[]         // Fact IDs sold (never show again)
  discoveredFacts: string[]    // Fact IDs discovered but not yet activated for study

  // Stats
  stats: PlayerStats

  // Streak tracking
  lastPlayDate?: string       // ISO date string (YYYY-MM-DD) of last completed run

  // Data Discs
  unlockedDiscs: string[]     // Disc IDs the player has found

  // Crafting (Materializer)
  craftedItems: Record<string, number>  // recipe_id → times crafted
  craftCounts: Record<string, number>   // recipe_id → times crafted (for scaling cost calculation)
  activeConsumables: string[]           // consumable recipe_ids queued for next dive

  // Dive insurance
  insuredDive: boolean                  // whether the next dive is insured

  // Cosmetics
  ownedCosmetics: string[]              // cosmetic IDs the player owns
  equippedCosmetic: string | null       // currently equipped cosmetic ID

  // Daily Deals
  purchasedDeals: string[]              // deal IDs purchased today
  lastDealDate?: string                 // ISO date (YYYY-MM-DD) of last deal purchase batch; resets daily

  // Review Rituals
  lastMorningReview?: string            // ISO date of last morning ritual (YYYY-MM-DD)
  lastEveningReview?: string            // ISO date of last evening ritual (YYYY-MM-DD)

  // Knowledge Store
  knowledgePoints: number               // Derived currency earned through learning milestones
  purchasedKnowledgeItems: string[]     // Knowledge Store item IDs the player has purchased

  // Dome Expansion
  unlockedRooms: string[]               // Room IDs the player has unlocked (legacy, retained for hub migration)

  // Premium Materials (earned from rare in-game drops, never purchasable with real money)
  premiumMaterials: Record<string, number>  // premium material id → count

  // Streak protection & milestones
  streakFreezes: number         // remaining freeze days available
  lastStreakMilestone: number   // last milestone days value that triggered a claim
  claimedMilestones: number[]  // milestone day values already claimed
  streakProtected: boolean      // whether current streak is protected for today
  titles: string[]              // unlocked titles (cosmetic)
  activeTitle: string | null    // currently displayed title

  // Progression (future: dome, etc.)

  // Hub (Phase 10)
  hubState: HubSaveState

  // Phase 12: Interest & Personalization
  /** Player's interest and personalization settings. */
  interestConfig: InterestConfig
  /** Behavioral signals for opt-in interest inference. */
  behavioralSignals: BehavioralSignals
  /** Archetype detection state (DD-V2-172). */
  archetypeData: ArchetypeData
  /** Hidden engagement scoring for dynamic difficulty (DD-V2-163). */
  engagementData: EngagementData

  // Phase 15.1: Post-Dive Reactions
  /** Biome ID of the most recently completed dive, used for post-dive GAIA commentary. */
  lastDiveBiome?: string

  // Phase 14: Onboarding & Tutorial
  /** Whether the player has completed the tutorial flow. */
  tutorialComplete: boolean
  /** Whether the player has completed their initial study session (5 seed facts). */
  hasCompletedInitialStudy: boolean
  /** Which interests the player selected during onboarding (e.g. ['Historian', 'Linguist']). */
  selectedInterests: string[]
  /** Category weighting from interest selection (category → multiplier). */
  interestWeights: Record<string, number>
  /** Total runs completed (includes tutorial run). Used for progressive unlock gates. */
  runCount: number
  /** Current tutorial step (0 = not started). */
  tutorialStep: number
  /** Number of study sessions completed (for first-session bonus oxygen). */
  studySessionsCompleted: number
  /** Number of new cards introduced today (resets daily). */
  newCardsStudiedToday: number
  /** ISO date string of last day new cards were introduced. */
  lastNewCardDate?: string

  // Phase 17: Addictiveness Pass
  /** Current login calendar day (1-7), wraps after Day 7 is claimed. */
  loginCalendarDay?: number
  /** Timestamp of last login calendar claim. */
  loginCalendarLastClaimed?: number
  /** Timestamp of last login to the app. */
  lastLoginDate?: number
  /** Longest ever streak (never decrements). */
  longestStreak?: number
  /** Timestamp when grace period was last used. */
  gracePeriodUsedAt?: number
  /** Weekly challenge tracking state. */
  weeklyChallenge?: { weekStartIso: string; stats: Record<string, number> }
  /** Consumable items (bomb, flare, shield, etc.) */
  consumables?: Record<string, number>
  /** Pickaxe IDs the player has acquired. Defaults to ['standard_pick']. */
  ownedPickaxes?: string[]
  // Phase 21: Monetization
  /** Unix timestamp of last oxygen regen calculation */
  lastRegenAt?: number
  /** Current number of oxygen tanks banked */
  tankBank?: number
  /** Fractional tank credit from mastery bonuses */
  tankCredit?: number
  /** Unix timestamp of account creation (for Pioneer Pack 7-day window) */
  installDate?: number
  /** Whether player has purchased the Pioneer Pack */
  hasPioneerPack?: boolean
  /** Whether Pioneer Pack modal was dismissed */
  pioneerPackDismissed?: boolean
  /** List of IAP product IDs the player has purchased */
  purchasedProducts?: string[]
  /** True when one-time ad-removal has been purchased. */
  adsRemoved?: boolean
  /** Active subscription record */
  subscription?: { type: string; expiresAt: string; source: 'apple' | 'google' | 'web' }
  /** Season pass progress */
  seasonPassProgress?: { seasonId: string; points: number; claimedFree: number[]; claimedPremium: number[]; hasPremium: boolean }
  /** Arcane Pass subscriber sub-category filters (domainId -> enabled subcategory labels). */
  subscriberCategoryFilters?: Record<string, string[]>
  /** Dust spent this calendar week (resets Monday 00:00 UTC) */
  weeklyDustSpent?: number
  /** ISO date of last weekly maintenance charge */
  lastMaintenanceDate?: string
  /** Whether spending bonus (+10% yield) is active this week */
  spendingBonusActive?: boolean
  /** Patron tier level */
  patronTier?: 'expedition' | 'grand'
  /** Patron badge text for leaderboards */
  patronBadge?: string | null
  /** Data Disc Radar remaining charges */
  dataDiscRadarCharges?: number

  // Social — Phase 22
  /** Whether the player's dome hub is hidden from public visits. */
  hubPrivate?: boolean
  /** Messages left by visitors in this player's dome guestbook. */
  guestbook?: GuestbookEntry[]
  /** Gifts received from other players, pending or already claimed. */
  receivedGifts?: GiftRecord[]
  /** Total number of times other players have visited this dome. */
  visitCount?: number
  /** Whether the player has opted out of all leaderboard appearances. */
  leaderboardOptOut?: boolean
  /** ID of the guild the player currently belongs to. */
  guildId?: string
  /** Player's role within their guild. */
  guildRole?: 'leader' | 'officer' | 'member'
  /** Aggregate knowledge-duel win/loss statistics. */
  duelStats?: DuelStats
  /** Active or recently resolved duel records. */
  pendingDuels?: DuelRecord[]
  /** Artifact card instances in the player's social inventory. */
  inventoryArtifacts?: ArtifactCard[]
  /** Unique referral code this player can share with friends. */
  referralCode?: string
  /** Referral code used when this player registered, if any. */
  referredBy?: string
  /** Total number of referral reward grants this player has received. */
  referralRewardsEarned?: number

  // Phase 48: Prestige & Endgame
  /** Current prestige level (0 = never prestiged). Permanent, never resets. */
  prestigeLevel?: number
  /** Unix timestamps of each prestige event. Length equals prestigeLevel. */
  prestigedAt?: number[]
  /** Total facts ever mastered across all prestige resets (cumulative lifetime counter). */
  lifetimeMasteredFacts?: number
  /** Which biomes the player has reached 100% fact mastery for. */
  completedBiomes?: string[]
  /** Whether challenge mode is currently active for the session. */
  challengeModeActive?: boolean
  /** Current challenge mode streak (resets on wrong answer). */
  challengeStreak?: number
  /** Total prestige points earned from mentoring. */
  mentorPrestigePoints?: number
  /** Fact IDs for which the player has authored a mentor hint. */
  authoredHints?: string[]
  /** Unix timestamp when omniscient status was first achieved. */
  omniscientUnlockedAt?: number

  // Language Learning (FIX-8)
  /** BCP-47 language code of the target language for vocabulary facts (e.g. "ja"). null = no language selected. */
  targetLanguage?: string | null
  /** Unlocked fact IDs for paced discovery (FIX-9). Populated with starter set on first dive. */
  unlockedFactIds?: string[]
  /** Number of new facts introduced in the current dive session (reset per dive). */
  newFactsThisDive?: number

  // Phase 35.5: Recipe Fragments
  /** Fragment collection progress: recipe_id → count of fragments found. */
  recipeFragments?: Record<string, number>
  /** Recipe IDs fully assembled and available to craft in the Materializer. */
  assembledRecipes?: string[]
  /** Recipe IDs already crafted via assembled fragments. */
  craftedFragmentRecipes?: string[]

  // Phase 47: Achievement Gallery
  /** IDs of paintings the player has unlocked (achievement conditions met). */
  unlockedPaintings?: string[]
  /** IDs of boss entities the player has defeated (used by isPaintingUnlocked). */
  defeatedBosses?: string[]

  // Phase 36: Combat System
  /** Boss template IDs defeated in the CURRENT dive run. Cleared when dive ends. */
  defeatedBossesThisRun?: string[]
  /** Total creature (non-boss) kills across all dives. */
  creatureKills?: number
  /** Number of times "The Deep" has been entered. */
  theDeepVisits?: number

  // Phase 37: Advanced Pet System
  /** Whether the Dust Cat has been received (given after first completed dome tour). */
  dustCatUnlocked?: boolean
  /** Current happiness score 0–100. Decays by 2/hour while unlocked. */
  dustCatHappiness?: number
  /** Unix timestamp of last happiness decay calculation. */
  dustCatLastDecayAt?: number
  /** Assigned personality trait IDs (exactly 2, assigned at unlock, permanent). */
  dustCatTraits?: [string, string]
  /** Currently equipped cosmetic IDs for the Dust Cat. Keys: 'hat' | 'accessory' | 'color'. */
  dustCatCosmetics?: Record<string, string>
  /** Evolution stage for each companion (0-3, extending Phase 8's 0-2). */
  companionLegendaryStages?: Record<string, boolean>  // companionId → has reached stage 3
  /** Unix timestamp of last feeding mini-game (60-minute cooldown). */
  dustCatLastFed?: number
  /** Unix timestamp of last grooming mini-game (90-minute cooldown). */
  dustCatLastGroomed?: number

  // Phase 42: Viral Growth
  /** Phase 42.2: Extended referral statistics with tier progress and yearly cap. */
  referralStats?: {
    code:                string             // permanent per-player code
    qualifiedCount:      number             // total qualifying referrals all-time
    yearlyCount:         number             // qualifying referrals this calendar year
    yearlyResetDate:     string             // ISO date of next yearly reset
    pendingRewardTiers:  number[]           // threshold values of unclaimed rewards
    claimedRewardKeys:   string[]           // reward keys already credited
  }
  /** Phase 42.3: Earned social proof badges. */
  earnedBadges?: EarnedBadge[]
  /** Phase 42.3: Count of guild challenge wins (used for guild_champion badge). */
  guildChampionWins?: number
  /** Phase 42.3: Whether the player has the Pioneer Pack (used for pioneer badge). */
  isPioneer?: boolean

  // Phase 59: Artifact Analyzer
  /** Pending artifacts awaiting analysis (persisted across sessions). */
  pendingArtifacts?: PendingArtifact[]
  /** Timestamps of recent study sessions (pruned to last 7 days). */
  lastStudySessionTimestamps?: number[]
  /** Upgrade tokens earned from artifact cracking. */
  upgradeTokens?: number
  /** Whether the player has seen the study nudge tutorial. */
  hasSeenStudyNudge?: boolean

  // Decorator
  /** Purchased floor background IDs for the Decorator */
  ownedBackgrounds?: string[]

  // Phase 53: Learning Sparks
  /** Learning Sparks currency — earned through mastery milestones, used in Knowledge Store. */
  learningSparks?: number
  /** How many Sparks have been earned since the start of the current ISO week (Mon-Sun). */
  sparkEarnedThisWeek?: number
  /** ISO date string (YYYY-MM-DD) of the Monday that started the current Spark week. */
  sparkWeekStart?: string
  /** Branch milestones already awarded (prevents double-award). e.g. ["Natural Sciences:25", "History:100"] */
  awardedBranchMilestones?: string[]
  // Relic System Overhaul
  /** Total mastery coins earned lifetime (1 per Tier 3 mastered fact). */
  masteryCoins?: number
  /** Mastery coins available to spend (lifetime earned minus spent). */
  masteryCoinsAvailable?: number
  /** Relic definition IDs the player has permanently unlocked. */
  unlockedRelicIds?: string[]
  /** Relic definition IDs the player has excluded from their run pool. */
  excludedRelicIds?: string[]

  // Study Presets & Deck Builder
  /** Saved study presets (max 10). */
  studyPresets?: StudyPreset[]
  /** Active deck mode for next run. */
  activeDeckMode?: DeckMode
  /** Last successful run's deck mode (for "repeat last run" default). */
  lastRunDeckMode?: DeckMode
  /** Per-domain category filters for the deck builder. */
  categoryFilters?: Record<string, string[]>
  /** Last selection on the Dungeon Selection screen (mode, domains, deck). */
  lastDungeonSelection?: LastDungeonSelection
  /** Confusion matrix for curated deck study mode — tracks which facts the player confuses. */
  confusionMatrix?: Array<{ targetFactId: string; confusedFactId: string; count: number; lastOccurred: number }>

  // Character progression (XP / levelling)
  /** Cumulative XP earned across all runs. */
  totalXP: number
  /** Current character level derived from totalXP. */
  characterLevel: number
  /** ISO date string (YYYY-MM-DD) of the last run that claimed the daily-first bonus, or null. */
  lastDailyBonusDate: string | null
}

/** Player statistics */
export interface PlayerStats {
  totalDivesCompleted: number
  bestFloor: number
  totalFactsLearned: number
  totalFactsSold: number
  totalQuizCorrect: number
  totalQuizWrong: number
  currentStreak: number       // Daily review streak
  bestStreak: number
  totalSessions: number         // incremented on app open
  zeroDiveSessions: number      // incremented when session ends with 0 runs completed
}

