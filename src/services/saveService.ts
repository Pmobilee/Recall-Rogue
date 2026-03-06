import { BALANCE } from '../data/balance'
import { generateUUID } from '../utils/uuid'
import { defaultHubSaveState } from '../data/hubLayout'
import type {
  AgeRating,
  FarmState,
  MineralTier,
  PlayerSave,
  PlayerStats,
  ReviewState,
} from '../data/types'
import { RECIPES, type Recipe } from '../data/recipes'
import { PREMIUM_RECIPES, type PremiumMaterial } from '../data/premiumRecipes'
import type { DailyDeal } from '../data/dailyDeals'
import { calculateProduction, FARM_EXPANSION_COSTS, FARM_MAX_SLOTS } from '../data/farm'
import { createDefaultInterestConfig } from '../data/interestConfig'
import { DEFAULT_ARCHETYPE_DATA } from '../services/archetypeDetector'
import { DEFAULT_ENGAGEMENT_DATA } from '../services/engagementScorer'
import { profileService } from '../services/profileService'

/**
 * Legacy/fallback save key. Used when no profiles exist (backward compatibility).
 * Active profile saves use the profile-namespaced key from profileService.getSaveKey().
 */
export const SAVE_KEY = 'terra-gacha-save'
export const SAVE_VERSION = 1

// ============================================================
// SAVE DURABILITY — APP BACKGROUND LISTENER (19.12)
//
// When the app is backgrounded (tab hidden or Capacitor sends the app to
// background), we immediately trigger a cloud sync to prevent data loss
// if the OS kills the process. This fires BEFORE the process is suspended.
//
// The import is dynamic and lazy to avoid a circular-dependency issue:
// syncService → saveService → syncService would create a cycle. Using
// import() at call time breaks the cycle because the module is only
// resolved after both modules have finished initialising.
// ============================================================
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Trigger cloud sync on background — fire-and-forget; errors are swallowed
      // inside syncService.pushToCloud() and must not propagate here.
      import('./syncService').then(m => m.syncService.pushToCloud()).catch(() => {})
    }
  })
}

/**
 * Returns the localStorage key to use for the current player's save.
 * When profiles exist, delegates to profileService to get the namespaced key.
 * Falls back to the legacy SAVE_KEY for backward compatibility.
 */
function getActiveSaveKey(): string {
  return profileService.getSaveKey()
}

const DEFAULT_FARM_STATE: FarmState = {
  slots: [null, null, null],
  maxSlots: 3,
}

const EMPTY_MINERALS: Record<MineralTier, number> = {
  dust: 0,
  shard: 0,
  crystal: 0,
  geode: 0,
  essence: 0,
}

const EMPTY_STATS: PlayerStats = {
  totalBlocksMined: 0,
  totalDivesCompleted: 0,
  deepestLayerReached: 0,
  totalFactsLearned: 0,
  totalFactsSold: 0,
  totalQuizCorrect: 0,
  totalQuizWrong: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalSessions: 0,
  zeroDiveSessions: 0,
}

/**
 * Stores player save data in localStorage using the active profile's key.
 */
export function save(data: PlayerSave): void {
  localStorage.setItem(getActiveSaveKey(), JSON.stringify(data))
}

/**
 * Loads player save data from localStorage using the active profile's key.
 *
 * Returns null when no save exists or the stored JSON is invalid.
 */
export function load(): PlayerSave | null {
  const raw = localStorage.getItem(getActiveSaveKey())

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as PlayerSave & {
      minerals: Record<string, number>
    }
    // Backward compatibility: migrate old tier names to new ones (geode/essence)
    if (parsed.minerals) {
      if ('coreFragment' in parsed.minerals) {
        parsed.minerals.geode = (parsed.minerals.geode ?? 0) + (parsed.minerals.coreFragment ?? 0)
        delete parsed.minerals.coreFragment
      }
      if ('primordialEssence' in parsed.minerals) {
        parsed.minerals.essence = (parsed.minerals.essence ?? 0) + (parsed.minerals.primordialEssence ?? 0)
        delete parsed.minerals.primordialEssence
      }
      // Ensure new fields exist with defaults
      parsed.minerals.geode = parsed.minerals.geode ?? 0
      parsed.minerals.essence = parsed.minerals.essence ?? 0
    }
    // Backward compatibility: ensure crafting fields exist
    const parsedAny = parsed as unknown as Record<string, unknown>
    if (!parsedAny['craftedItems'] || typeof parsedAny['craftedItems'] !== 'object') {
      parsedAny['craftedItems'] = {}
    }
    if (!Array.isArray(parsedAny['activeConsumables'])) {
      parsedAny['activeConsumables'] = []
    }
    // Backward compatibility: ensure unlockedDiscs exists
    if (!Array.isArray(parsedAny['unlockedDiscs'])) {
      parsedAny['unlockedDiscs'] = []
    }
    // Backward compatibility: ensure craftCounts and insuredDive exist
    if (!parsedAny['craftCounts'] || typeof parsedAny['craftCounts'] !== 'object') {
      parsedAny['craftCounts'] = {}
    }
    if (!('insuredDive' in parsedAny)) {
      parsedAny['insuredDive'] = false
    }
    // Backward compatibility: ensure cosmetic fields exist
    if (!Array.isArray(parsedAny['ownedCosmetics'])) {
      parsedAny['ownedCosmetics'] = []
    }
    if (!('equippedCosmetic' in parsedAny)) {
      parsedAny['equippedCosmetic'] = null
    }
    // Backward compatibility: ensure daily deals fields exist
    if (!Array.isArray(parsedAny['purchasedDeals'])) {
      parsedAny['purchasedDeals'] = []
    }
    if (!('lastDealDate' in parsedAny)) {
      parsedAny['lastDealDate'] = undefined
    }
    // Backward compatibility: ensure review ritual fields exist
    if (!('lastMorningReview' in parsedAny)) {
      parsedAny['lastMorningReview'] = undefined
    }
    if (!('lastEveningReview' in parsedAny)) {
      parsedAny['lastEveningReview'] = undefined
    }
    // Backward compatibility: ensure fossil/knowledge fields exist
    if (!parsedAny['fossils'] || typeof parsedAny['fossils'] !== 'object') {
      parsedAny['fossils'] = {}
    }
    if (typeof parsedAny['knowledgePoints'] !== 'number') {
      parsedAny['knowledgePoints'] = 0
    }
    if (!Array.isArray(parsedAny['purchasedKnowledgeItems'])) {
      parsedAny['purchasedKnowledgeItems'] = []
    }
    // Backward compatibility: ensure unlockedRooms exists
    if (!Array.isArray(parsedAny['unlockedRooms'])) {
      parsedAny['unlockedRooms'] = ['command']
    }
    // Backward compatibility: ensure activeCompanion exists
    if (!('activeCompanion' in parsedAny)) {
      parsedAny['activeCompanion'] = null
    }
    // Backward compatibility: ensure premiumMaterials exists
    if (!parsedAny['premiumMaterials'] || typeof parsedAny['premiumMaterials'] !== 'object') {
      parsedAny['premiumMaterials'] = {}
    }
    // Backward compatibility: ensure farm state exists
    if (!parsedAny['farm'] || typeof parsedAny['farm'] !== 'object') {
      parsedAny['farm'] = { slots: [null, null, null], maxSlots: 3 }
    } else {
      const farm = parsedAny['farm'] as Record<string, unknown>
      if (!Array.isArray(farm['slots'])) {
        farm['slots'] = [null, null, null]
      }
      if (typeof farm['maxSlots'] !== 'number') {
        farm['maxSlots'] = 3
      }
    }
    // Backward compatibility: ensure streak system fields exist
    if (typeof parsedAny['streakFreezes'] !== 'number') {
      parsedAny['streakFreezes'] = 1
    }
    if (typeof parsedAny['lastStreakMilestone'] !== 'number') {
      parsedAny['lastStreakMilestone'] = 0
    }
    if (!Array.isArray(parsedAny['claimedMilestones'])) {
      parsedAny['claimedMilestones'] = []
    }
    if (!('streakProtected' in parsedAny)) {
      parsedAny['streakProtected'] = false
    }
    if (!Array.isArray(parsedAny['titles'])) {
      parsedAny['titles'] = []
    }
    if (!('activeTitle' in parsedAny)) {
      parsedAny['activeTitle'] = null
    }
    // Reset purchasedDeals if lastDealDate doesn't match today
    const todayStr = new Date().toISOString().split('T')[0]
    if (parsedAny['lastDealDate'] !== todayStr) {
      parsedAny['purchasedDeals'] = []
      parsedAny['lastDealDate'] = undefined
    }
    // Backward compatibility: ensure session tracking stats fields exist
    if (parsed.stats.totalSessions === undefined) parsed.stats.totalSessions = 0
    if (parsed.stats.zeroDiveSessions === undefined) parsed.stats.zeroDiveSessions = 0
    // Backward compatibility: ensure hubState exists (Phase 10)
    if (!parsedAny['hubState'] || typeof parsedAny['hubState'] !== 'object') {
      parsedAny['hubState'] = defaultHubSaveState()
    }
    // Phase 61: Migrate legacy unlockedRooms → hubState.unlockedFloorIds
    {
      const hs = parsedAny['hubState'] as Record<string, unknown>
      if (!Array.isArray(hs['unlockedFloorIds'])) {
        hs['unlockedFloorIds'] = ['starter']
      }
      // If player has rooms beyond 'command' but hubState only has 'starter', sync them
      const rooms = parsedAny['unlockedRooms'] as string[] | undefined
      const currentFloors = hs['unlockedFloorIds'] as string[]
      if (rooms && rooms.length > 1 && currentFloors.length <= 1) {
        const roomToFloor: Record<string, string> = {
          command: 'starter', lab: 'starter', workshop: 'workshop',
          museum: 'museum', market: 'market', archive: 'archive',
        }
        const migrated = new Set<string>(currentFloors)
        for (const roomId of rooms) {
          const floorId = roomToFloor[roomId]
          if (floorId) migrated.add(floorId)
        }
        hs['unlockedFloorIds'] = [...migrated]
        // Initialize floor tiers for newly migrated floors
        if (!hs['floorTiers'] || typeof hs['floorTiers'] !== 'object') {
          hs['floorTiers'] = {}
        }
        const tiers = hs['floorTiers'] as Record<string, number>
        for (const fId of hs['unlockedFloorIds'] as string[]) {
          if (!(fId in tiers)) tiers[fId] = 0
        }
      }
    }
    // Backward compatibility: Phase 12 — interest & personalization fields
    if (!parsedAny['interestConfig'] || typeof parsedAny['interestConfig'] !== 'object') {
      parsedAny['interestConfig'] = createDefaultInterestConfig()
    }
    if (!parsedAny['behavioralSignals'] || typeof parsedAny['behavioralSignals'] !== 'object') {
      parsedAny['behavioralSignals'] = { perCategory: {}, lastRecalcDives: 0 }
    }
    if (!parsedAny['archetypeData'] || typeof parsedAny['archetypeData'] !== 'object') {
      parsedAny['archetypeData'] = { ...DEFAULT_ARCHETYPE_DATA }
    }
    if (!parsedAny['engagementData'] || typeof parsedAny['engagementData'] !== 'object') {
      parsedAny['engagementData'] = { ...DEFAULT_ENGAGEMENT_DATA }
    }
    // Backward compatibility: Phase 14 tutorial fields
    if (!('tutorialComplete' in parsedAny)) {
      // Existing players who already have dives are past the tutorial
      parsedAny['tutorialComplete'] = parsed.stats.totalDivesCompleted > 0
    }
    if (!Array.isArray(parsedAny['selectedInterests'])) {
      parsedAny['selectedInterests'] = []
    }
    if (!parsedAny['interestWeights'] || typeof parsedAny['interestWeights'] !== 'object') {
      parsedAny['interestWeights'] = {}
    }
    if (typeof parsedAny['diveCount'] !== 'number') {
      parsedAny['diveCount'] = parsed.stats.totalDivesCompleted ?? 0
    }
    if (typeof parsedAny['tutorialStep'] !== 'number') {
      parsedAny['tutorialStep'] = 0
    }
    if (!('activeFossil' in parsedAny)) {
      parsedAny['activeFossil'] = null
    }
    if (typeof parsedAny['studySessionsCompleted'] !== 'number') {
      parsedAny['studySessionsCompleted'] = 0
    }
    // Backward compatibility: Phase 17 — Addictiveness Pass fields
    if (typeof parsedAny['loginCalendarDay'] !== 'number') {
      parsedAny['loginCalendarDay'] = 1
    }
    if (typeof parsedAny['loginCalendarLastClaimed'] !== 'number') {
      parsedAny['loginCalendarLastClaimed'] = 0
    }
    if (typeof parsedAny['lastLoginDate'] !== 'number') {
      parsedAny['lastLoginDate'] = 0
    }
    if (typeof parsedAny['longestStreak'] !== 'number') {
      parsedAny['longestStreak'] = parsed.stats?.bestStreak ?? 0
    }
    if (typeof parsedAny['gracePeriodUsedAt'] !== 'number') {
      parsedAny['gracePeriodUsedAt'] = 0
    }
    if (!parsedAny['weeklyChallenge'] || typeof parsedAny['weeklyChallenge'] !== 'object') {
      parsedAny['weeklyChallenge'] = undefined
    }
    if (!parsedAny['consumables'] || typeof parsedAny['consumables'] !== 'object') {
      parsedAny['consumables'] = {}
    }
    // Phase 51: Owned pickaxes migration
    if (!Array.isArray(parsedAny['ownedPickaxes'])) {
      parsedAny['ownedPickaxes'] = ['standard_pick']
    }
    // Phase 21: Oxygen regen migration
    if (parsedAny['lastRegenAt'] === undefined) {
      parsedAny['lastRegenAt'] = Date.now()
    }
    if (parsedAny['tankBank'] === undefined) {
      parsedAny['tankBank'] = BALANCE.OXYGEN_MAX_BANK_FREE
    }
    // Phase 47: Achievement Gallery migration
    if (!Array.isArray(parsedAny['unlockedPaintings'])) {
      parsedAny['unlockedPaintings'] = []
    }
    if (!Array.isArray(parsedAny['defeatedBosses'])) {
      parsedAny['defeatedBosses'] = []
    }
    // Phase 48: Prestige & Endgame migration
    if (typeof parsedAny['prestigeLevel'] !== 'number') {
      parsedAny['prestigeLevel'] = 0
    }
    if (!Array.isArray(parsedAny['prestigedAt'])) {
      parsedAny['prestigedAt'] = []
    }
    if (typeof parsedAny['lifetimeMasteredFacts'] !== 'number') {
      parsedAny['lifetimeMasteredFacts'] = 0
    }
    if (!Array.isArray(parsedAny['completedBiomes'])) {
      parsedAny['completedBiomes'] = []
    }
    if (typeof parsedAny['challengeModeActive'] !== 'boolean') {
      parsedAny['challengeModeActive'] = false
    }
    if (typeof parsedAny['challengeStreak'] !== 'number') {
      parsedAny['challengeStreak'] = 0
    }
    if (typeof parsedAny['mentorPrestigePoints'] !== 'number') {
      parsedAny['mentorPrestigePoints'] = 0
    }
    if (!Array.isArray(parsedAny['authoredHints'])) {
      parsedAny['authoredHints'] = []
    }
    // Phase 59: Artifact Analyzer — migrate pendingArtifacts persistence
    if (!Array.isArray(parsedAny['pendingArtifacts'])) {
      parsedAny['pendingArtifacts'] = []
    }
    // Phase 59: Artifact Analyzer — initialize new fields
    if (!Array.isArray(parsedAny['lastStudySessionTimestamps'])) {
      parsedAny['lastStudySessionTimestamps'] = []
    }
    if (typeof parsedAny['upgradeTokens'] !== 'number') {
      parsedAny['upgradeTokens'] = 0
    }
    if (typeof parsedAny['hasSeenStudyNudge'] !== 'boolean') {
      parsedAny['hasSeenStudyNudge'] = false
    }
    return parsed as PlayerSave
  } catch {
    return null
  }
}

/**
 * Creates a fresh player save with default resources and stats.
 */
export function createNewPlayer(ageRating: AgeRating): PlayerSave {
  const now = Date.now()
  const reviewStates: ReviewState[] = []

  return {
    version: SAVE_VERSION,
    factDbVersion: 0,
    playerId: generateUUID(),
    ageRating,
    createdAt: now,
    lastPlayedAt: now,
    oxygen: BALANCE.STARTING_OXYGEN_TANKS,
    minerals: { ...EMPTY_MINERALS },
    learnedFacts: [],
    reviewStates,
    soldFacts: [],
    craftedItems: {},
    craftCounts: {},
    activeConsumables: [],
    unlockedDiscs: [],
    insuredDive: false,
    ownedCosmetics: [],
    equippedCosmetic: null,
    purchasedDeals: [],
    lastDealDate: undefined,
    lastMorningReview: undefined,
    lastEveningReview: undefined,
    fossils: {},
    activeCompanion: null,
    knowledgePoints: 0,
    purchasedKnowledgeItems: [],
    unlockedRooms: ['command'],
    farm: { ...DEFAULT_FARM_STATE, slots: [null, null, null] },
    premiumMaterials: {},
    streakFreezes: 0,
    lastStreakMilestone: 0,
    claimedMilestones: [],
    streakProtected: false,
    titles: [],
    activeTitle: null,
    stats: { ...EMPTY_STATS },
    hubState: defaultHubSaveState(),
    interestConfig: createDefaultInterestConfig(),
    behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
    archetypeData: { ...DEFAULT_ARCHETYPE_DATA },
    engagementData: { ...DEFAULT_ENGAGEMENT_DATA },
    // Phase 14: Onboarding & Tutorial
    tutorialComplete: false,
    selectedInterests: [],
    interestWeights: {},
    diveCount: 0,
    tutorialStep: 0,
    activeFossil: null,
    studySessionsCompleted: 0,
    // Phase 17: Addictiveness Pass
    loginCalendarDay: 1,
    loginCalendarLastClaimed: 0,
    lastLoginDate: 0,
    longestStreak: 0,
    gracePeriodUsedAt: 0,
    weeklyChallenge: undefined,
    consumables: {},
    // Phase 47: Achievement Gallery
    unlockedPaintings: [],
    defeatedBosses: [],

    // Phase 59: Artifact Analyzer persistence
    pendingArtifacts: [],
  }
}

/**
 * Deletes the current player save from localStorage.
 */
export function deleteSave(): void {
  localStorage.removeItem(getActiveSaveKey())
}

/**
 * Attempts to craft a recipe. Validates cost, maxCrafts limit, and unlockAfterDives.
 * Deducts minerals, increments craftedItems count, and (if consumable) adds to activeConsumables.
 *
 * Follows the same pattern as `convertMineral`: caller provides the current save and receives
 * a result containing the updated save (or the original if the craft failed).
 *
 * @param currentSave - The current player save to read from and update.
 * @param recipeId - The ID of the recipe to craft.
 * @returns An object with `success` indicating whether the craft happened,
 *          and `updatedSave` containing the mutated save (or original if unsuccessful).
 */
export function craftRecipe(
  currentSave: PlayerSave,
  recipeId: string,
): { success: boolean; updatedSave: PlayerSave } {
  const recipe = RECIPES.find(r => r.id === recipeId)
  if (!recipe) return { success: false, updatedSave: currentSave }

  // Check unlock requirement
  const divesCompleted = currentSave.stats.totalDivesCompleted
  if (divesCompleted < recipe.unlockAfterDives) return { success: false, updatedSave: currentSave }

  // Check maxCrafts limit (0 = unlimited for consumables)
  const timesCrafted = currentSave.craftedItems[recipeId] ?? 0
  if (recipe.maxCrafts > 0 && timesCrafted >= recipe.maxCrafts) return { success: false, updatedSave: currentSave }

  // Validate mineral cost
  for (const [tier, required] of Object.entries(recipe.cost) as [MineralTier, number][]) {
    if ((currentSave.minerals[tier] ?? 0) < required) return { success: false, updatedSave: currentSave }
  }

  // Deduct cost
  const updatedMinerals = { ...currentSave.minerals }
  for (const [tier, required] of Object.entries(recipe.cost) as [MineralTier, number][]) {
    updatedMinerals[tier] = (updatedMinerals[tier] ?? 0) - required
  }

  const updatedCraftedItems: Record<string, number> = {
    ...currentSave.craftedItems,
    [recipeId]: timesCrafted + 1,
  }

  // Also increment craftCounts (used for scaling cost display)
  const updatedCraftCounts: Record<string, number> = {
    ...(currentSave.craftCounts ?? {}),
    [recipeId]: (currentSave.craftCounts?.[recipeId] ?? 0) + 1,
  }

  const updatedConsumables = recipe.category === 'consumable'
    ? [...currentSave.activeConsumables, recipeId]
    : currentSave.activeConsumables

  const updatedSave: PlayerSave = {
    ...currentSave,
    minerals: updatedMinerals,
    craftedItems: updatedCraftedItems,
    craftCounts: updatedCraftCounts,
    activeConsumables: updatedConsumables,
    lastPlayedAt: Date.now(),
  }

  save(updatedSave)
  return { success: true, updatedSave }
}

/** Ordered list of mineral tiers from lowest to highest. */
const MINERAL_TIER_ORDER: MineralTier[] = ['dust', 'shard', 'crystal', 'geode', 'essence']

/**
 * Converts `amount` units of `fromTier` mineral into the next higher tier.
 *
 * Total cost per conversion: `MINERAL_CONVERSION_RATIO + ceil(MINERAL_CONVERSION_RATIO * MINERAL_CONVERSION_TAX)`.
 * For the default values this is 100 + 10 = 110 of the source tier per 1 of the target tier.
 *
 * @param currentSave - The current player save to read from and update.
 * @param fromTier - The lower mineral tier to spend.
 * @param toTier - The higher mineral tier to receive. Must be exactly one tier above `fromTier`.
 * @param amount - How many of the target tier to produce (default 1).
 * @returns An object with `success` indicating whether the conversion happened,
 *          and `updatedSave` containing the mutated save (or the original if unsuccessful).
 */
export function convertMineral(
  currentSave: PlayerSave,
  fromTier: MineralTier,
  toTier: MineralTier,
  amount: number = 1,
): { success: boolean; updatedSave: PlayerSave } {
  const fromIndex = MINERAL_TIER_ORDER.indexOf(fromTier)
  const toIndex = MINERAL_TIER_ORDER.indexOf(toTier)

  // Validate: toTier must be exactly one tier above fromTier
  if (fromIndex === -1 || toIndex === -1 || toIndex !== fromIndex + 1) {
    return { success: false, updatedSave: currentSave }
  }

  const costPerUnit = BALANCE.MINERAL_CONVERSION_RATIO + Math.ceil(BALANCE.MINERAL_CONVERSION_RATIO * BALANCE.MINERAL_CONVERSION_TAX)
  const totalCost = costPerUnit * amount

  // Validate: player has enough of the source mineral
  if (currentSave.minerals[fromTier] < totalCost) {
    return { success: false, updatedSave: currentSave }
  }

  const updatedSave: PlayerSave = {
    ...currentSave,
    minerals: {
      ...currentSave.minerals,
      [fromTier]: currentSave.minerals[fromTier] - totalCost,
      [toTier]: currentSave.minerals[toTier] + amount,
    },
  }

  save(updatedSave)
  return { success: true, updatedSave }
}

/**
 * Apply weekly dome maintenance cost (DD-V2-151).
 * Charges dust based on number of active rooms above the free threshold.
 * First 2 rooms (Command, Lab) are maintenance-free.
 * Consequence of not paying: cosmetic only (flickering, dust motes).
 */
export function applyWeeklyMaintenance(currentSave: PlayerSave): PlayerSave {
  const now = new Date()
  const lastMaintenance = currentSave.lastMaintenanceDate
    ? new Date(currentSave.lastMaintenanceDate)
    : now

  // Check if 7 days have passed since last maintenance
  const daysSinceLast = (now.getTime() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLast < 7) return currentSave

  const roomCount = (currentSave.unlockedRooms?.length ?? 0)
  const billableRooms = Math.max(0, roomCount - BALANCE.DOME_MAINTENANCE_FREE_ROOMS)
  const maintenanceCost = billableRooms * BALANCE.DOME_MAINTENANCE_BASE_DUST

  if (maintenanceCost <= 0) {
    return { ...currentSave, lastMaintenanceDate: now.toISOString().split('T')[0] }
  }

  const updatedSave: PlayerSave = {
    ...currentSave,
    minerals: {
      ...currentSave.minerals,
      dust: Math.max(0, currentSave.minerals.dust - maintenanceCost),
    },
    lastMaintenanceDate: now.toISOString().split('T')[0],
  }

  save(updatedSave)
  return updatedSave
}

/**
 * Check and apply spending bonus (DD-V2-151).
 * First 500 dust spent per calendar week activates +10% mineral yield.
 * Resets Monday 00:00 UTC.
 */
export function checkSpendingBonus(currentSave: PlayerSave): PlayerSave {
  const now = new Date()
  const currentDay = now.getUTCDay()
  const isMonday = currentDay === BALANCE.SPENDING_BONUS_RESET_DAY

  // Reset weekly spending on Monday
  if (isMonday && (currentSave.weeklyDustSpent ?? 0) > 0) {
    const weekStart = now.toISOString().split('T')[0]
    if (currentSave.lastMaintenanceDate !== weekStart) {
      return {
        ...currentSave,
        weeklyDustSpent: 0,
        spendingBonusActive: false,
      }
    }
  }

  // Check if spending threshold is met
  const weeklySpent = currentSave.weeklyDustSpent ?? 0
  const bonusActive = weeklySpent >= BALANCE.SPENDING_BONUS_THRESHOLD

  if (bonusActive !== (currentSave.spendingBonusActive ?? false)) {
    return { ...currentSave, spendingBonusActive: bonusActive }
  }

  return currentSave
}

/**
 * Calculates the scaled cost of a recipe based on how many times it has been crafted.
 *
 * Each craft of the same recipe increases the cost by `BALANCE.SCALING_CRAFT_MULTIPLIER`.
 * For example, if the base cost is 100 dust and the recipe has been crafted twice,
 * the scaled cost is `100 * 1.25^2 = 156.25`, floored to 156.
 *
 * @param recipe - The recipe to calculate cost for.
 * @param craftCounts - The player's current craft count map (recipe_id → times crafted).
 * @returns A partial record of mineral tier → scaled cost (integers, floored).
 */
export function getScaledCost(
  recipe: Recipe,
  craftCounts: Record<string, number>,
): Partial<Record<MineralTier, number>> {
  const timesCrafted = craftCounts[recipe.id] ?? 0
  const multiplier = Math.pow(BALANCE.SCALING_CRAFT_MULTIPLIER, timesCrafted)

  const scaled: Partial<Record<MineralTier, number>> = {}
  for (const [tier, baseCost] of Object.entries(recipe.cost) as [MineralTier, number][]) {
    scaled[tier] = Math.floor(baseCost * multiplier)
  }
  return scaled
}

/**
 * Returns the scaling multiplier currently applied to a recipe.
 *
 * @param recipe - The recipe to check.
 * @param craftCounts - The player's current craft count map.
 * @returns The raw multiplier (e.g. 1.25 after one craft).
 */
export function getCraftScaleMultiplier(recipe: Recipe, craftCounts: Record<string, number>): number {
  const timesCrafted = craftCounts[recipe.id] ?? 0
  return Math.pow(BALANCE.SCALING_CRAFT_MULTIPLIER, timesCrafted)
}

/**
 * Attempts to purchase a daily deal. Validates affordability and that the deal
 * has not already been purchased today. Deducts the cost, applies the reward,
 * and marks the deal as purchased for the day.
 *
 * @param currentSave - The current player save to read from and update.
 * @param deal - The daily deal to purchase.
 * @returns An object with `success` indicating whether the purchase happened,
 *          and `updatedSave` containing the mutated save (or original if unsuccessful).
 */
export function purchaseDeal(
  currentSave: PlayerSave,
  deal: DailyDeal,
): { success: boolean; updatedSave: PlayerSave } {
  const today = new Date().toISOString().split('T')[0]

  // Reset purchased deals if last deal date doesn't match today
  const activePurchasedDeals =
    currentSave.lastDealDate === today ? (currentSave.purchasedDeals ?? []) : []

  // Already purchased today
  if (activePurchasedDeals.includes(deal.id)) {
    return { success: false, updatedSave: currentSave }
  }

  // Validate affordability
  for (const [tier, required] of Object.entries(deal.cost) as [MineralTier, number][]) {
    if ((currentSave.minerals[tier] ?? 0) < required) {
      return { success: false, updatedSave: currentSave }
    }
  }

  // Deduct cost
  const updatedMinerals = { ...currentSave.minerals }
  for (const [tier, required] of Object.entries(deal.cost) as [MineralTier, number][]) {
    updatedMinerals[tier] = (updatedMinerals[tier] ?? 0) - required
  }

  // Apply reward
  const reward = deal.reward
  let updatedOxygen = currentSave.oxygen

  if (reward.type === 'minerals') {
    updatedMinerals[reward.tier] = (updatedMinerals[reward.tier] ?? 0) + reward.amount
  } else if (reward.type === 'oxygen_tanks') {
    updatedOxygen = currentSave.oxygen + reward.amount
  } else if (reward.type === 'random_minerals') {
    const dustAmount = Math.floor(
      Math.random() * (reward.maxDust - reward.minDust + 1) + reward.minDust,
    )
    updatedMinerals.dust = (updatedMinerals.dust ?? 0) + dustAmount
  } else if (reward.type === 'recipe_discount') {
    // Simplified: give dust equivalent to the discounted recipe value
    // Find the recipe's base cost in dust and grant the discount portion as dust
    const recipe = RECIPES.find(r => r.id === reward.recipeId)
    if (recipe) {
      const baseDust = recipe.cost.dust ?? 0
      const bonusDust = Math.floor(baseDust * (reward.discountPercent / 100))
      updatedMinerals.dust = (updatedMinerals.dust ?? 0) + bonusDust
    }
  }
  // cosmetic_unlock is a no-op for now (simplified)

  const updatedSave: PlayerSave = {
    ...currentSave,
    minerals: updatedMinerals,
    oxygen: updatedOxygen,
    purchasedDeals: [...activePurchasedDeals, deal.id],
    lastDealDate: today,
    lastPlayedAt: Date.now(),
  }

  save(updatedSave)
  return { success: true, updatedSave }
}

// ============================================================
// FARM FUNCTIONS
// ============================================================

/**
 * Collects all accumulated resources from every occupied farm slot.
 * Updates `lastCollectedAt` on each slot and adds the minerals to the player's balance.
 *
 * @param currentSave - The current player save.
 * @returns The updated save (minerals added, timestamps reset) and a summary of what was collected.
 */
export function collectFarmResources(
  currentSave: PlayerSave,
): { updatedSave: PlayerSave; collected: { dust: number; shard: number; crystal: number } } {
  const collected = { dust: 0, shard: 0, crystal: 0 }
  const now = Date.now()

  const updatedSlots = currentSave.farm.slots.map(slot => {
    if (!slot) return null
    const result = calculateProduction(slot)
    if (result) {
      collected[result.tier] += result.amount
    }
    return { ...slot, lastCollectedAt: now }
  })

  const updatedMinerals = { ...currentSave.minerals }
  if (collected.dust > 0) updatedMinerals.dust = (updatedMinerals.dust ?? 0) + collected.dust
  if (collected.shard > 0) updatedMinerals.shard = (updatedMinerals.shard ?? 0) + collected.shard
  if (collected.crystal > 0) updatedMinerals.crystal = (updatedMinerals.crystal ?? 0) + collected.crystal

  const updatedSaveFarm: PlayerSave = {
    ...currentSave,
    minerals: updatedMinerals,
    farm: { ...currentSave.farm, slots: updatedSlots },
    lastPlayedAt: now,
  }

  save(updatedSaveFarm)
  return { updatedSave: updatedSaveFarm, collected }
}

/**
 * Places a revived fossil companion into an empty farm slot.
 *
 * @param currentSave - The current player save.
 * @param slotIndex - Index into the farm slots array (must be within maxSlots).
 * @param speciesId - The fossil species ID to place.
 * @returns `{ success, updatedSave }`. Fails if slot is occupied, out of range, or fossil not revived.
 */
export function placeFarmAnimal(
  currentSave: PlayerSave,
  slotIndex: number,
  speciesId: string,
): { success: boolean; updatedSave: PlayerSave } {
  const farm = currentSave.farm
  if (slotIndex < 0 || slotIndex >= farm.maxSlots || slotIndex >= farm.slots.length) {
    return { success: false, updatedSave: currentSave }
  }
  if (farm.slots[slotIndex] !== null) {
    return { success: false, updatedSave: currentSave }
  }
  const fossilState = currentSave.fossils[speciesId]
  if (!fossilState?.revived) {
    return { success: false, updatedSave: currentSave }
  }

  const now = Date.now()
  const newSlot = { speciesId, placedAt: now, lastCollectedAt: now }
  const updatedSlots = farm.slots.map((s, i) => (i === slotIndex ? newSlot : s))

  const updatedSaveFarm: PlayerSave = {
    ...currentSave,
    farm: { ...farm, slots: updatedSlots },
    lastPlayedAt: now,
  }

  save(updatedSaveFarm)
  return { success: true, updatedSave: updatedSaveFarm }
}

/**
 * Removes a fossil companion from a farm slot. Any uncollected production is discarded.
 *
 * @param currentSave - The current player save.
 * @param slotIndex - Index of the slot to clear.
 * @returns `{ success, updatedSave }`. Fails if the slot is empty or out of range.
 */
export function removeFarmAnimal(
  currentSave: PlayerSave,
  slotIndex: number,
): { success: boolean; updatedSave: PlayerSave } {
  const farm = currentSave.farm
  if (slotIndex < 0 || slotIndex >= farm.slots.length) {
    return { success: false, updatedSave: currentSave }
  }
  if (farm.slots[slotIndex] === null) {
    return { success: false, updatedSave: currentSave }
  }

  const updatedSlots = farm.slots.map((s, i) => (i === slotIndex ? null : s))
  const updatedSaveFarm: PlayerSave = {
    ...currentSave,
    farm: { ...farm, slots: updatedSlots },
    lastPlayedAt: Date.now(),
  }

  save(updatedSaveFarm)
  return { success: true, updatedSave: updatedSaveFarm }
}

/**
 * Expands the farm by one slot if the player can afford the next expansion tier.
 *
 * @param currentSave - The current player save.
 * @returns `{ success, updatedSave }`. Fails if already at max slots or player cannot afford.
 */
export function expandFarm(
  currentSave: PlayerSave,
): { success: boolean; updatedSave: PlayerSave } {
  const farm = currentSave.farm
  if (farm.maxSlots >= FARM_MAX_SLOTS) {
    return { success: false, updatedSave: currentSave }
  }

  const expansionIndex = farm.maxSlots - 3 // 3 is the starting slot count
  const cost = FARM_EXPANSION_COSTS[expansionIndex]
  if (!cost) {
    return { success: false, updatedSave: currentSave }
  }

  for (const [tier, required] of Object.entries(cost) as ['dust' | 'shard' | 'crystal', number][]) {
    if ((currentSave.minerals[tier] ?? 0) < required) {
      return { success: false, updatedSave: currentSave }
    }
  }

  const updatedMinerals = { ...currentSave.minerals }
  for (const [tier, required] of Object.entries(cost) as ['dust' | 'shard' | 'crystal', number][]) {
    updatedMinerals[tier] = (updatedMinerals[tier] ?? 0) - required
  }

  const updatedSaveFarm: PlayerSave = {
    ...currentSave,
    minerals: updatedMinerals,
    farm: {
      ...farm,
      maxSlots: farm.maxSlots + 1,
      slots: [...farm.slots, null],
    },
    lastPlayedAt: Date.now(),
  }

  save(updatedSaveFarm)
  return { success: true, updatedSave: updatedSaveFarm }
}

// ============================================================
// PREMIUM MATERIALIZER
// ============================================================

/**
 * Attempts to craft a premium recipe. Validates the maxCrafts limit and that the player
 * has sufficient premium materials and/or regular minerals to cover the cost.
 * Deducts all costs, increments the craft count, and applies cosmetic ownership if applicable.
 *
 * @param currentSave - The current player save to read from and update.
 * @param recipeId - The ID of the premium recipe to craft.
 * @returns An object with `success` indicating whether the craft happened,
 *          and `updatedSave` containing the mutated save (or original if unsuccessful).
 */
export function craftPremiumRecipe(
  currentSave: PlayerSave,
  recipeId: string,
): { success: boolean; updatedSave: PlayerSave } {
  const recipe = PREMIUM_RECIPES.find(r => r.id === recipeId)
  if (!recipe) return { success: false, updatedSave: currentSave }

  // Check maxCrafts limit (99 = effectively unlimited for consumables, 1 = unique)
  const timesCrafted = (currentSave.craftedItems ?? {})[recipeId] ?? 0
  if (recipe.maxCrafts > 0 && timesCrafted >= recipe.maxCrafts) {
    return { success: false, updatedSave: currentSave }
  }

  const premiumMaterials = currentSave.premiumMaterials ?? {}
  const minerals = currentSave.minerals

  // Validate that the player can afford all parts of the cost
  const PREMIUM_IDS: PremiumMaterial[] = ['star_dust', 'void_crystal', 'ancient_essence']
  for (const [key, required] of Object.entries(recipe.cost) as [string, number][]) {
    const isPremium = PREMIUM_IDS.includes(key as PremiumMaterial)
    if (isPremium) {
      if ((premiumMaterials[key] ?? 0) < required) return { success: false, updatedSave: currentSave }
    } else {
      if ((minerals[key as MineralTier] ?? 0) < required) return { success: false, updatedSave: currentSave }
    }
  }

  // Deduct costs
  const updatedPremiumMaterials = { ...premiumMaterials }
  const updatedMinerals = { ...minerals }

  for (const [key, required] of Object.entries(recipe.cost) as [string, number][]) {
    if (PREMIUM_IDS.includes(key as PremiumMaterial)) {
      updatedPremiumMaterials[key] = (updatedPremiumMaterials[key] ?? 0) - required
    } else {
      updatedMinerals[key as MineralTier] = (updatedMinerals[key as MineralTier] ?? 0) - required
    }
  }

  const updatedCraftedItems: Record<string, number> = {
    ...(currentSave.craftedItems ?? {}),
    [recipeId]: timesCrafted + 1,
  }

  // For cosmetics: add to ownedCosmetics
  const updatedOwnedCosmetics = [...(currentSave.ownedCosmetics ?? [])]
  if (recipe.category === 'cosmetic' && !updatedOwnedCosmetics.includes(recipeId)) {
    updatedOwnedCosmetics.push(recipeId)
  }

  // For convenience items: add to activeConsumables (queued for next dive)
  const updatedConsumables =
    recipe.category === 'convenience'
      ? [...(currentSave.activeConsumables ?? []), recipeId]
      : (currentSave.activeConsumables ?? [])

  const updatedSave: PlayerSave = {
    ...currentSave,
    premiumMaterials: updatedPremiumMaterials,
    minerals: updatedMinerals,
    craftedItems: updatedCraftedItems,
    ownedCosmetics: updatedOwnedCosmetics,
    activeConsumables: updatedConsumables,
    lastPlayedAt: Date.now(),
  }

  save(updatedSave)
  return { success: true, updatedSave }
}

/**
 * Updates streak on daily login. Handles:
 * - Consecutive days: increment streak
 * - Missed 1 day with grace available: preserve streak, spend grace
 * - Missed 1 day without grace: reset streak (positive reframing applied in UI)
 * - Missed 2+ days: reset streak regardless of grace
 */
export function updateStreakOnLogin(s: PlayerSave): {
  streakKept: boolean
  graceUsed: boolean
  previousStreak: number
} {
  const now = new Date()
  const prev = s.lastDiveDate ? new Date(s.lastDiveDate) : null
  const previousStreak = s.stats.currentStreak

  if (!prev) {
    s.stats.currentStreak = 1
    return { streakKept: true, graceUsed: false, previousStreak: 0 }
  }

  const daysDiff = Math.floor((now.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff <= 1) {
    if (daysDiff === 1) {
      s.stats.currentStreak++
      if (s.stats.currentStreak > s.stats.bestStreak) {
        s.stats.bestStreak = s.stats.currentStreak
      }
      const longest = s.longestStreak ?? 0
      if (s.stats.currentStreak > longest) {
        s.longestStreak = s.stats.currentStreak
      }
    }
    return { streakKept: true, graceUsed: false, previousStreak }
  }

  if (daysDiff === 2) {
    // Missed exactly 1 day — check grace
    const windowStart = now.getTime() - (30 * 24 * 60 * 60 * 1000)
    const graceUsedAt = s.gracePeriodUsedAt ?? 0
    const graceAvailable = graceUsedAt < windowStart

    if (graceAvailable && (s.streakFreezes ?? 0) === 0) {
      s.gracePeriodUsedAt = now.getTime()
      s.stats.currentStreak++
      const longest = s.longestStreak ?? 0
      if (s.stats.currentStreak > longest) {
        s.longestStreak = s.stats.currentStreak
      }
      return { streakKept: true, graceUsed: true, previousStreak }
    }
  }

  // Streak broken — positive reframing in UI layer
  const longest = s.longestStreak ?? 0
  if (s.stats.currentStreak > longest) {
    s.longestStreak = s.stats.currentStreak
  }
  s.stats.currentStreak = 1
  return { streakKept: false, graceUsed: false, previousStreak }
}
