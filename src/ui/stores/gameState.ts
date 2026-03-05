import { writable, derived } from 'svelte/store'
import type { Writable, Readable } from 'svelte/store'
import type { BackpackItemState, Fact, InventorySlot, Relic, ReviewState } from '../../data/types'
import type { RelicSynergy, RelicDefinition } from '../../data/relics'
import type { CompanionEffect } from '../../data/fossils'
import { getO2DepthMultiplier } from '../../data/balance'
import type { ConsumableId } from '../../data/consumables'
import type { BiomeId } from '../../data/biomes'

// =========================================================
// Singleton helpers — survive module re-evaluation from
// Rollup code-split chunks (gameState may be bundled into
// multiple chunks; globalThis ensures one store instance).
// =========================================================

/** Ensure writable store singletons survive module re-evaluation from code-split chunks. */
function singletonWritable<T>(key: string, initial: T): Writable<T> {
  const sym = Symbol.for('terra:' + key)
  if (!(globalThis as any)[sym]) {
    (globalThis as any)[sym] = writable<T>(initial)
  }
  return (globalThis as any)[sym] as Writable<T>
}

/** Ensure derived store singletons survive module re-evaluation from code-split chunks. */
function singletonDerived<T>(key: string, deps: any, fn: any): Readable<T> {
  const sym = Symbol.for('terra:' + key)
  if (!(globalThis as any)[sym]) {
    (globalThis as any)[sym] = derived<any, T>(deps, fn)
  }
  return (globalThis as any)[sym] as Readable<T>
}

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
export const selectedLoadout = singletonWritable<DiveLoadout>('selectedLoadout', {
  pickaxeId: null,
  companionId: null,
  consumableSlots: [null, null, null],
  relicIds: [],
})

/**
 * True when the minimum viable loadout is filled (pickaxe selected).
 * Used to gate the "Enter Mine" button on the DivePrepScreen.
 */
export const loadoutReady = singletonDerived<boolean>('loadoutReady', selectedLoadout, (loadout: DiveLoadout): boolean => {
  return loadout.pickaxeId !== null
})

/** Player's relic vault — all relics collected across runs, available for pre-dive equipping. */
export const relicVault = singletonWritable<RelicDefinition[]>('relicVault', [])

export interface ConsumableSlot {
  id: ConsumableId
  count: number
}

/** Active consumables carried during current dive */
export const activeConsumables = singletonWritable<ConsumableSlot[]>('activeConsumables', [])

/** Shield charge active flag — absorbs next hazard hit */
export const shieldActive = singletonWritable<boolean>('shieldActive', false)

/** Pending consumables for pre-dive loadout (stub for Phase 8.11) */
export const pendingConsumables = singletonWritable<ConsumableSlot[]>('pendingConsumables', [])

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
  | 'combat'
  | 'the-deep-unlock'
  | 'factReveal'
  | 'backpack'
  | 'runStats'
  | 'sacrifice'
  | 'decision'
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
  | 'quote_stone'
  | 'cavern_text'

export const currentScreen = singletonWritable<Screen>('currentScreen', 'mainMenu')

/** Index of the currently displayed hub floor (0 = Starter Hub). */
export const currentFloorIndex = singletonWritable<number>('currentFloorIndex', 0)

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
  layerCompleted: number       // 0-indexed layer that was just finished
  canDiveDeeper: boolean       // false if forced exit OR on max layer
  artifactNames: string[]      // fact titles of artifacts found
  relicNames: string[]         // names of relics found this run
  factsLearnedCount: number    // new facts added this dive
  layersReached: number        // how many layers completed
  lootLostToForce: boolean     // true if forced exit caused loot loss
}
export const diveResults = singletonWritable<DiveResults | null>('diveResults', null)

// In-mine state (updated by Phaser events)
export const oxygenCurrent = singletonWritable<number>('oxygenCurrent', 0)
export const oxygenMax = singletonWritable<number>('oxygenMax', 0)
export const currentDepth = singletonWritable<number>('currentDepth', 0)
export const currentLayer = singletonWritable<number>('currentLayer', 0)

/**
 * Tier label derived from the current layer (0-based → 1-based display).
 * Shallow = L1-5, Mid = L6-10, Deep = L11-15, Extreme = L16-20.
 */
export const layerTierLabel = singletonDerived<string>('layerTierLabel', currentLayer, (layer: number): string => {
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
export const o2DepthMultiplier = singletonDerived<number>('o2DepthMultiplier', currentLayer, (layer: number) =>
  getO2DepthMultiplier(layer)
)

/** Display name of the active biome for the current mine layer (empty string while at base). */
export const currentBiome = singletonWritable<string>('currentBiome', '')

/** Biome ID of the active biome for the current mine layer (null while at base). */
export const currentBiomeId = singletonWritable<BiomeId | null>('currentBiomeId', null)
export const inventory = singletonWritable<InventorySlot[]>('inventory', [])

// Quiz overlay state
export const activeQuiz = singletonWritable<{
  fact: Fact
  choices: string[]
  source?: 'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer' | 'combat' | 'artifact_boost'
  gateProgress?: { remaining: number; total: number }
  /** True when the player has demonstrably learned this fact (repetitions >= CONSISTENCY_MIN_REPS) but answered wrong in-dive. */
  isConsistencyPenalty?: boolean
  /** Whether GAIA should show a mnemonic hint for this fact (struggle detection). */
  showMnemonic?: boolean
  /** The mnemonic text to display, if available. */
  mnemonic?: string
  /** Layer challenge progress: current question number and total. */
  layerChallengeProgress?: { current: number; total: number }
} | null>('activeQuiz', null)

// Fact reveal state
export const activeFact = singletonWritable<Fact | null>('activeFact', null)

// Pending artifacts to review at base (accumulated during dive)
export const pendingArtifacts = singletonWritable<string[]>('pendingArtifacts', [])

// Active in-run upgrades collected from upgrade crates
export const activeUpgrades = singletonWritable<Record<string, number>>('activeUpgrades', {})

// Current pickaxe tier index (into BALANCE.PICKAXE_TIERS), reset each dive
export const pickaxeTier = singletonWritable<number>('pickaxeTier', 0)

// Live blocks-mined counter for current run (reset each dive)
export const blocksMinedLive = singletonWritable<number>('blocksMinedLive', 0)

// GAIA commentary toast — set to a string to display, null to hide
export const gaiaMessage = singletonWritable<string | null>('gaiaMessage', null)

/**
 * Current GAIA expression id (matches a key in GAIA_EXPRESSIONS from gaiaAvatar.ts).
 * Updated alongside gaiaMessage whenever a new in-mine message is emitted.
 * Consumers can import this to render the contextual avatar emoji.
 */
export const gaiaExpression = singletonWritable<string>('gaiaExpression', 'neutral')

// Study session facts and review states passed to StudySession component
export const studyFacts = singletonWritable<Fact[]>('studyFacts', [])
export const studyReviewStates = singletonWritable<ReviewState[]>('studyReviewStates', [])

// Send-up station overlay — true while the player is selecting items to send up
export const showSendUp = singletonWritable<boolean>('showSendUp', false)

// Phase 51: Sacrifice overlay state (oxygen depletion choice)
export interface SacrificeState {
  active: boolean
  items: BackpackItemState[]
  requiredDropCount: number
  markedForDrop: Set<number>
}

export const sacrificeState = singletonWritable<SacrificeState>('sacrificeState', {
  active: false,
  items: [],
  requiredDropCount: 0,
  markedForDrop: new Set(),
})

// Phase 51: Decision screen state (full-backpack item choice — "The Cloth")
export interface DecisionScreenState {
  active: boolean
  newItem: BackpackItemState
  existingItems: BackpackItemState[]
  selectedEvictIndex: number | null
}

export const decisionScreenState = singletonWritable<DecisionScreenState>('decisionScreenState', {
  active: false,
  newItem: { slotIndex: -1, type: 'empty', displayName: '' },
  existingItems: [],
  selectedEvictIndex: null,
})

// Relics active during the current dive run
export const activeRelics = singletonWritable<Relic[]>('activeRelics', [])

// Active relic synergies for the current dive run
export const activeSynergies = singletonWritable<RelicSynergy[]>('activeSynergies', [])

/** V2 equipped relics for the current run (max 3). */
export const equippedRelicsV2 = singletonWritable<RelicDefinition[]>('equippedRelicsV2', [])

/** Pending relic pickup (shown in RelicPickupOverlay). */
export const pendingRelicPickup = singletonWritable<RelicDefinition | null>('pendingRelicPickup', null)

// Retained for compatibility; PONR mechanic removed in Phase 8.2 — always stays false
export const pastPointOfNoReturn = singletonWritable<boolean>('pastPointOfNoReturn', false)

// Current scanner tier index (0 = Basic, 1 = Enhanced, 2 = Advanced, 3 = Deep)
export const scannerTier = singletonWritable<number>('scannerTier', 0)

// Temporary backpack slots added by in-run expansions (resets to 0 on dive start)
export const tempBackpackSlots = singletonWritable<number>('tempBackpackSlots', 0)

/**
 * Active fossil companion for the current dive.
 * Set by GameManager at dive start (null if no companion).
 * Used by HUD to show the companion badge and flash it on effect triggers.
 */
export const activeCompanion = singletonWritable<{
  icon: string
  name: string
  effect: CompanionEffect
} | null>('activeCompanion', null)

/** Whether the companion badge should flash (triggered effect pulse). Reset after each flash. */
export const companionBadgeFlash = singletonWritable<boolean>('companionBadgeFlash', false)

/** Cumulative ticks this dive — increments on every player movement or block hit */
export const tickCount = singletonWritable<number>('tickCount', 0)
/** Ticks since last layer entry — reset on layer change */
export const layerTickCount = singletonWritable<number>('layerTickCount', 0)

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
export const gaiaThoughtBubble = singletonWritable<GaiaThoughtBubble | null>('gaiaThoughtBubble', null)

// =========================================================
// Phase 31.6 — Streak Visual Feedback
// =========================================================

/**
 * Current quiz answer streak state during a dive.
 * count = consecutive correct answers; multiplier = active dust reward multiplier.
 * Reset to { count: 0, multiplier: 1.0 } on wrong answer or dive end.
 */
export const quizStreak = singletonWritable<{ count: number; multiplier: number }>('quizStreak', { count: 0, multiplier: 1.0 })

// =========================================================
// Phase 31.5 — Descent Overlay State
// =========================================================

/**
 * State for the DescentOverlay component shown during layer transitions.
 * visible=true triggers the animation.
 */
export interface DescentOverlayState {
  visible: boolean
  fromLayer: number
  toLayer: number
  biomeName: string | null
}

export const descentOverlayState = singletonWritable<DescentOverlayState>('descentOverlayState', {
  visible: false,
  fromLayer: 1,
  toLayer: 2,
  biomeName: null,
})

// =========================================================
// Phase 37 — Advanced Pet System
// =========================================================

/** Active Dust Cat synergy during a dive, or null. */
export const activeDustCatSynergy = singletonWritable<import('../../data/petPersonalities').CompanionSynergy | null>('activeDustCatSynergy', null)

// =========================================================
// Phase 35 — Mine Mechanics Completion
// =========================================================

/** Current layer instability level (0–100). Updated by InstabilitySystem. */
export const instabilityLevel = singletonWritable<number>('instabilityLevel', 0)

/** True when a collapse event is active and the countdown is running. */
export const instabilityCollapsing = singletonWritable<boolean>('instabilityCollapsing', false)

/** Ticks remaining before total collapse (shown on HUD during collapse event). */
export const instabilityCountdown = singletonWritable<number>('instabilityCountdown', 0)

/** Payload for the active altar sacrifice interaction. Null when no altar is active. */
export interface AltarPayload {
  altarX: number
  altarY: number
}

/** Active altar sacrifice state — set when the player stands adjacent to an OfferingAltar. */
export const activeAltar = singletonWritable<AltarPayload | null>('activeAltar', null)

/** The active mine event notification shown in the overlay. Null = no event. */
export const activeMineEvent = singletonWritable<{ type: string; label: string } | null>('activeMineEvent', null)

// =========================================================
// Phase 36 — Combat System
// =========================================================

/** True whenever a CombatOverlay is shown (blocks mining input). */
export const combatEncounterActive = singletonWritable<boolean>('combatEncounterActive', false)

// =========================================================
// Phase 48 — Prestige & Endgame
// =========================================================

/**
 * Set to a BiomeId string when a biome completion event fires post-dive.
 * BiomeCompletionOverlay listens for this and shows the mastery celebration.
 * Reset to null after the overlay is dismissed.
 */
export const biomeCompletionStore = singletonWritable<string | null>('biomeCompletion', null)

// =========================================================
// Phase 54 — Mine Atmosphere (Quote Stone & Cavern Text modals)
// =========================================================

import type { QuoteStoneEntry } from '../../data/quoteStones'
import type { CavernText } from '../../data/cavernTexts'

/** Active quote stone modal entry. Set to non-null to show the QuoteStoneModal. */
export const quoteStoneModalEntry = singletonWritable<QuoteStoneEntry | null>('quoteStoneModalEntry', null)

/** Active cavern text modal entry. Set to non-null to show the CavernTextModal. */
export const cavernTextModalEntry = singletonWritable<CavernText | null>('cavernTextModalEntry', null)
