import { writable } from 'svelte/store'
import type { Fact, InventorySlot, Relic, ReviewState } from '../../data/types'
import type { RelicSynergy } from '../../data/relics'
import type { CompanionEffect } from '../../data/fossils'

/** All top-level UI screens used by routing state. */
export type Screen =
  | 'mainMenu'
  | 'base'
  | 'divePrepScreen'
  | 'mining'
  | 'quiz'
  | 'factReveal'
  | 'backpack'
  | 'runStats'
  | 'sacrifice'
  | 'diveResults'
  | 'knowledgeTree'
  | 'studySession'
  | 'materializer'
  | 'premiumMaterializer'
  | 'cosmeticsShop'
  | 'knowledgeStore'
  | 'fossilGallery'
  | 'zoo'
  | 'farm'
  | 'streakPanel'
  | 'settings'

export const currentScreen = writable<Screen>('mainMenu')

/** Summary data shown on the dive results screen. */
export interface DiveResults {
  dustCollected: number
  shardsCollected: number
  crystalsCollected: number
  geodesCollected: number
  essenceCollected: number
  artifactsFound: number
  blocksMined: number
  maxDepth: number
  forced: boolean        // true if oxygen depleted
  streakDay?: number     // Current streak day count after this dive
  streakBonus?: boolean  // Whether a bonus oxygen tank was awarded
  relicsCollected?: Relic[]  // Relics picked up during this dive
}
export const diveResults = writable<DiveResults | null>(null)

// In-mine state (updated by Phaser events)
export const oxygenCurrent = writable<number>(0)
export const oxygenMax = writable<number>(0)
export const currentDepth = writable<number>(0)
export const currentLayer = writable<number>(0)
/** Display name of the active biome for the current mine layer (empty string while at base). */
export const currentBiome = writable<string>('')
export const inventory = writable<InventorySlot[]>([])

// Quiz overlay state
export const activeQuiz = writable<{
  fact: Fact
  choices: string[]
  source?: 'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer'
  gateProgress?: { remaining: number; total: number }
  /** True when the player has demonstrably learned this fact (repetitions >= CONSISTENCY_MIN_REPS) but answered wrong in-dive. */
  isConsistencyPenalty?: boolean
} | null>(null)

// Fact reveal state
export const activeFact = writable<Fact | null>(null)

// Pending artifacts to review at base (accumulated during dive)
export const pendingArtifacts = writable<string[]>([])

// Active in-run upgrades collected from upgrade crates
export const activeUpgrades = writable<Record<string, number>>({})

// Current pickaxe tier index (into BALANCE.PICKAXE_TIERS), reset each dive
export const pickaxeTier = writable<number>(0)

// Live blocks-mined counter for current run (reset each dive)
export const blocksMinedLive = writable<number>(0)

// GAIA commentary toast — set to a string to display, null to hide
export const gaiaMessage = writable<string | null>(null)

/**
 * Current GAIA expression id (matches a key in GAIA_EXPRESSIONS from gaiaAvatar.ts).
 * Updated alongside gaiaMessage whenever a new in-mine message is emitted.
 * Consumers can import this to render the contextual avatar emoji.
 */
export const gaiaExpression = writable<string>('neutral')

// Study session facts and review states passed to StudySession component
export const studyFacts = writable<Fact[]>([])
export const studyReviewStates = writable<ReviewState[]>([])

// Send-up station overlay — true while the player is selecting items to send up
export const showSendUp = writable<boolean>(false)

// Relics active during the current dive run
export const activeRelics = writable<Relic[]>([])

// Active relic synergies for the current dive run
export const activeSynergies = writable<RelicSynergy[]>([])

// True once the player descends past BALANCE.POINT_OF_NO_RETURN_PERCENT depth — surfaces disabled
export const pastPointOfNoReturn = writable<boolean>(false)

// Current scanner tier index (0 = Basic, 1 = Enhanced, 2 = Advanced, 3 = Deep)
export const scannerTier = writable<number>(0)

// Temporary backpack slots added by in-run expansions (resets to 0 on dive start)
export const tempBackpackSlots = writable<number>(0)

/**
 * Active fossil companion for the current dive.
 * Set by GameManager at dive start (null if no companion).
 * Used by HUD to show the companion badge and flash it on effect triggers.
 */
export const activeCompanion = writable<{
  icon: string
  name: string
  effect: CompanionEffect
} | null>(null)

/** Whether the companion badge should flash (triggered effect pulse). Reset after each flash. */
export const companionBadgeFlash = writable<boolean>(false)
