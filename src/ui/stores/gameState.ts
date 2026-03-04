import { writable, derived } from 'svelte/store'
import type { Fact, InventorySlot, Relic, ReviewState } from '../../data/types'
import type { RelicSynergy, RelicDefinition } from '../../data/relics'
import type { CompanionEffect } from '../../data/fossils'
import { getO2DepthMultiplier } from '../../data/balance'
import type { ConsumableId } from '../../data/consumables'
import type { BiomeId } from '../../data/biomes'

// =========================================================
// Phase 8.11 — Dive Loadout
// =========================================================

/** Full pre-dive loadout selected on the DivePrepScreen. */
export interface DiveLoadout {
  pickaxeId: string | null
  companionId: string | null
  /** Exactly 3 slots; null = empty slot. */
  consumableSlots: [string | null, string | null, string | null]
  /** Relic ids; max 3. */
  relicIds: string[]
}

/** Currently selected dive loadout (persists within a session). */
export const selectedLoadout = writable<DiveLoadout>({
  pickaxeId: null,
  companionId: null,
  consumableSlots: [null, null, null],
  relicIds: [],
})

/**
 * True when the minimum viable loadout is filled (pickaxe selected).
 * Used to gate the "Enter Mine" button on the DivePrepScreen.
 */
export const loadoutReady = derived(selectedLoadout, (loadout): boolean => {
  return loadout.pickaxeId !== null
})

/** Player's relic vault — all relics collected across runs, available for pre-dive equipping. */
export const relicVault = writable<RelicDefinition[]>([])

export interface ConsumableSlot {
  id: ConsumableId
  count: number
}

/** Active consumables carried during current dive */
export const activeConsumables = writable<ConsumableSlot[]>([])

/** Shield charge active flag — absorbs next hazard hit */
export const shieldActive = writable<boolean>(false)

/** Pending consumables for pre-dive loadout (stub for Phase 8.11) */
export const pendingConsumables = writable<ConsumableSlot[]>([])

/**
 * Add a consumable to the active dive inventory.
 * Returns true if added, false if carry limit reached.
 */
export function addConsumableToDive(id: ConsumableId): boolean {
  let added = false
  activeConsumables.update(slots => {
    const total = slots.reduce((sum, s) => sum + s.count, 0)
    if (total >= 5) return slots // CONSUMABLE_CARRY_LIMIT
    const existing = slots.find(s => s.id === id)
    if (existing) {
      added = true
      return slots.map(s => s.id === id ? { ...s, count: s.count + 1 } : s)
    }
    added = true
    return [...slots, { id, count: 1 }]
  })
  return added
}

/**
 * Use a consumable from the active dive inventory.
 * Returns true if used, false if not in inventory.
 */
export function useConsumableFromDive(id: ConsumableId): boolean {
  let used = false
  activeConsumables.update(slots => {
    const slot = slots.find(s => s.id === id)
    if (!slot || slot.count <= 0) return slots
    used = true
    if (slot.count === 1) {
      return slots.filter(s => s.id !== id)
    }
    return slots.map(s => s.id === id ? { ...s, count: s.count - 1 } : s)
  })
  return used
}

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
  | 'gaiaReport'
  | 'interestSettings'
  | 'interestAssessment'
  | 'cutscene'
  | 'onboarding'
  | 'ageSelection'
  | 'tutorialMine'

export const currentScreen = writable<Screen>('mainMenu')

/** Index of the currently displayed hub floor (0 = Starter Hub). */
export const currentFloorIndex = writable<number>(0)

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

/**
 * Tier label derived from the current layer (0-based → 1-based display).
 * Shallow = L1-5, Mid = L6-10, Deep = L11-15, Extreme = L16-20.
 */
export const layerTierLabel = derived(currentLayer, (layer): string => {
  const l = layer + 1  // convert from 0-based to 1-based for display
  if (l <= 5)  return 'Shallow'
  if (l <= 10) return 'Mid'
  if (l <= 15) return 'Deep'
  return 'Extreme'
})

/**
 * O2 cost multiplier derived from the current layer (0-based).
 * Layer 0 = 1.0×, Layer 9 ≈ 1.5×, Layer 19 = 2.5×. (DD-V2-061)
 */
export const o2DepthMultiplier = derived(currentLayer, (layer) =>
  getO2DepthMultiplier(layer)
)

/** Display name of the active biome for the current mine layer (empty string while at base). */
export const currentBiome = writable<string>('')

/** Biome ID of the active biome for the current mine layer (null while at base). */
export const currentBiomeId = writable<BiomeId | null>(null)
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

/** V2 equipped relics for the current run (max 3). */
export const equippedRelicsV2 = writable<RelicDefinition[]>([])

/** Pending relic pickup (shown in RelicPickupOverlay). */
export const pendingRelicPickup = writable<RelicDefinition | null>(null)

// Retained for compatibility; PONR mechanic removed in Phase 8.2 — always stays false
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

/** Cumulative ticks this dive — increments on every player movement or block hit */
export const tickCount = writable(0)
/** Ticks since last layer entry — reset on layer change */
export const layerTickCount = writable(0)

// =========================================================
// Phase 15.2 — GAIA Idle Thought Bubbles
// =========================================================

/**
 * A GAIA thought bubble shown as a floating card in the dome/base view.
 * Set to non-null to display; null to hide.
 */
export interface GaiaThoughtBubble {
  /** The text to display in the bubble. */
  text: string
  /** Expression id referencing a key in GAIA_EXPRESSIONS. */
  expressionId: string
  /** Optional action type: study-related actions show a CTA and fire an event. */
  action?: 'study_due' | 'study_near_mastery' | 'study_interest' | 'dismiss'
  /** Optional payload for the action (e.g. factId for study actions). */
  actionData?: string
}

/** Active GAIA thought bubble for the dome/base view. Null means no bubble is shown. */
export const gaiaThoughtBubble = writable<GaiaThoughtBubble | null>(null)
