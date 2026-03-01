// ============================================================
// CONTENT TYPES
// ============================================================

/** Content type - extensible for language learning */
export type ContentType = 'fact' | 'vocabulary' | 'grammar' | 'phrase'

/** Age rating for content filtering */
export type AgeRating = 'kid' | 'teen' | 'adult'

/** Top-level fact categories */
export const CATEGORIES = [
  'Language',
  'Natural Sciences',
  'Life Sciences',
  'History',
  'Geography',
  'Technology',
  'Culture',
] as const

/** Artifact rarity tier */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

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

  // Classification
  category: string[]          // Hierarchical: ["Language", "Japanese", "N3"]
  rarity: Rarity
  difficulty: number          // 1-5
  funScore: number            // 1-10
  ageRating: AgeRating

  // Sourcing
  sourceName?: string

  // Language-specific (optional)
  language?: string           // e.g., "ja"
  pronunciation?: string      // Reading/IPA
  exampleSentence?: string

  // Media (future)
  imageUrl?: string
  mnemonic?: string
}

// ============================================================
// SM-2 SPACED REPETITION
// ============================================================

/** SM-2 review state for a single fact */
export interface ReviewState {
  factId: string
  easeFactor: number          // Starts 2.5, min 1.3
  interval: number            // Days until next review
  repetitions: number         // Consecutive correct answers
  nextReviewAt: number        // Unix timestamp (ms)
  lastReviewAt: number        // Unix timestamp (ms)
  quality: number             // Last response quality (0-5)
}

// ============================================================
// MINE / RUN TYPES
// ============================================================

/** Block types in the mine grid */
export enum BlockType {
  Empty = 0,
  Dirt = 1,
  SoftRock = 2,
  Stone = 3,
  HardRock = 4,
  MineralNode = 10,
  ArtifactNode = 11,
  OxygenCache = 12,
  UpgradeCrate = 13,
  QuizGate = 14,
  ExitLadder = 15,
  DescentShaft = 16,
  RelicShrine = 17,
  QuoteStone = 18,
  SendUpStation = 19,
  LavaBlock = 20,
  GasPocket = 21,
  UnstableGround = 22,
  OxygenTank = 23,
  DataDisc = 24,
  FossilNode = 25,
  Unbreakable = 99,
}

// ============================================================
// RELIC SYSTEM
// ============================================================

/** The effect a relic provides during a dive */
export type RelicEffect =
  | { type: 'oxygen_regen'; amount: number }      // Restore N O2 every 10 blocks mined
  | { type: 'mineral_magnet'; radius: number }     // Auto-collect minerals within N tiles
  | { type: 'tough_skin'; reduction: number }      // Reduce hazard O2 cost by N
  | { type: 'lucky_strike'; chance: number }       // N% chance to double mineral drops
  | { type: 'deep_breath'; bonus: number }         // +N max oxygen
  | { type: 'quiz_master'; bonus: number }         // +N bonus dust on correct quiz answers

/** A collectible relic found at shrines, providing persistent in-run bonuses */
export interface Relic {
  id: string
  name: string
  description: string
  icon: string        // emoji for now
  effect: RelicEffect
}

/** A single cell in the mine grid */
export interface MineCell {
  type: BlockType
  hardness: number            // Taps remaining to break
  maxHardness: number         // Original hardness
  revealed: boolean           // Visible to player?
  visibilityLevel?: number    // 0=hidden, 1=silhouette, 2=dim, 3=faint — controlled by scanner
  content?: MineCellContent   // What's inside (if special block)
}

/** Content inside a special block */
export interface MineCellContent {
  mineralType?: MineralTier
  mineralAmount?: number
  artifactRarity?: Rarity
  factId?: string             // Which fact this artifact contains
  oxygenAmount?: number
}

/** Mineral currency tiers — ordered from common (surface) to rare (extreme depth) */
export type MineralTier = 'dust' | 'shard' | 'crystal' | 'geode' | 'essence'

// ============================================================
// INVENTORY
// ============================================================

/** A single inventory slot (MVP: simple slots, not Tetris) */
export interface InventorySlot {
  type: 'mineral' | 'artifact' | 'fossil' | 'empty'
  mineralTier?: MineralTier
  mineralAmount?: number      // Stack count
  artifactRarity?: Rarity
  factId?: string
}

// ============================================================
// FOSSIL SYSTEM
// ============================================================

/** Per-species fossil collection state stored in the player save */
export interface FossilState {
  speciesId: string
  fragmentsFound: number
  fragmentsNeeded: number
  revived: boolean
  revivedAt?: number
}

// ============================================================
// FARM SYSTEM
// ============================================================

/** A single occupied slot in The Farm */
export interface FarmSlot {
  speciesId: string
  placedAt: number        // Unix timestamp (ms) when placed
  lastCollectedAt: number // Unix timestamp (ms) of last resource collection
}

/** Persistent state of the player's farm */
export interface FarmState {
  slots: (FarmSlot | null)[] // null = empty slot
  maxSlots: number            // starts at 3, expandable up to FARM_MAX_SLOTS
}

// ============================================================
// PLAYER / SAVE STATE
// ============================================================

/** Full player save data */
export interface PlayerSave {
  version: number             // Save format version (for migrations)
  playerId: string
  ageRating: AgeRating
  createdAt: number
  lastPlayedAt: number

  // Resources
  oxygen: number              // Current stored oxygen tanks
  minerals: Record<MineralTier, number>

  // Knowledge
  learnedFacts: string[]      // Fact IDs the player has ingested
  reviewStates: ReviewState[] // SM-2 state per fact
  soldFacts: string[]         // Fact IDs sold (never show again)

  // Stats
  stats: PlayerStats

  // Streak tracking
  lastDiveDate?: string       // ISO date string (YYYY-MM-DD) of last completed dive

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

  // Fossil collection
  fossils: Record<string, FossilState> // speciesId → fossil state

  // Companion (active revived fossil)
  activeCompanion: string | null        // species ID of active companion, or null if none

  // Review Rituals
  lastMorningReview?: string            // ISO date of last morning ritual (YYYY-MM-DD)
  lastEveningReview?: string            // ISO date of last evening ritual (YYYY-MM-DD)

  // Knowledge Store
  knowledgePoints: number               // Derived currency earned through learning milestones
  purchasedKnowledgeItems: string[]     // Knowledge Store item IDs the player has purchased

  // Dome Expansion
  unlockedRooms: string[]               // Room IDs the player has unlocked

  // Farm
  farm: FarmState

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
}

/** Player statistics */
export interface PlayerStats {
  totalBlocksMined: number
  totalDivesCompleted: number
  deepestLayerReached: number
  totalFactsLearned: number
  totalFactsSold: number
  totalQuizCorrect: number
  totalQuizWrong: number
  currentStreak: number       // Daily review streak
  bestStreak: number
}

/** Temporary in-run upgrade types */
export type RunUpgrade = 'pickaxe_boost' | 'scanner_boost' | 'backpack_expand' | 'oxygen_efficiency' | 'bomb'

// ============================================================
// RUN STATE (active dive, not persisted)
// ============================================================

/** State of the current active dive */
export interface RunState {
  seed: number                // RNG seed for reproducibility
  oxygen: number              // Current oxygen remaining
  maxOxygen: number           // Starting oxygen for this run
  depth: number               // Current y-position
  layer: number               // Current layer index (0-based)
  maxLayers: number           // Total layers in this dive
  inventory: InventorySlot[]  // Current backpack contents
  inventorySlots: number      // Max inventory slots this run
  minerX: number              // Player grid position
  minerY: number
  grid: MineCell[][]          // The mine grid
  gridWidth: number
  gridHeight: number
  blocksMinedThisRun: number
  quizGatesPassed: number
  quizGatesFailed: number
  artifactsFound: string[]    // Fact IDs found this run
  isActive: boolean
}
