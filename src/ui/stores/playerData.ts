import { get, writable } from 'svelte/store'
import type { Writable } from 'svelte/store'

/** Ensure writable store singletons survive module re-evaluation from code-split chunks. */
function singletonWritable<T>(key: string, initial: T): Writable<T> {
  const sym = Symbol.for('terra:' + key)
  if (!(globalThis as any)[sym]) {
    (globalThis as any)[sym] = writable<T>(initial)
  }
  return (globalThis as any)[sym] as Writable<T>
}
import type { AgeRating, MineralTier, PendingArtifact, PlayerSave, ReviewState } from '../../data/types'
import { createNewPlayer, load, save as saveFn } from '../../services/saveService'
import { getUnlockedPaintingIds } from './achievements'
import { AGE_BRACKET_KEY } from '../../services/legalConstants'
import { createReviewState, isDue, getMasteryLevel, reviewFact } from '../../services/sm2'
import type { Cosmetic } from '../../data/cosmetics'
import { calculateKnowledgePoints } from '../../data/knowledgeStore'
import { BALANCE, LEARNING_SPARKS_PER_MILESTONE } from '../../data/balance'
import { evaluateArchetype } from '../../services/archetypeDetector'
import { updateEngagementAfterDive, getEngagementGaiaComment } from '../../services/engagementScorer'
import { gaiaMessage } from '../stores/gameState'
import { recordFastMastery } from '../../services/behavioralLearner'

/** The active player save data. */
export const playerSave = singletonWritable<PlayerSave | null>('playerSave', null)

/**
 * Reads the age bracket stored by the AgeGate and maps it to an AgeRating.
 * Returns 'teen' as the default if no bracket has been stored yet (safe for
 * existing players who pre-date the AgeGate).
 */
function getStoredAgeRating(): AgeRating {
  if (typeof localStorage === 'undefined') return 'teen'
  const bracket = localStorage.getItem(AGE_BRACKET_KEY)
  if (bracket === 'under_13') return 'kid'
  if (bracket === 'adult') return 'adult'
  // 'teen' or missing → 'teen'
  return 'teen'
}

/**
 * Initializes player data from storage or creates a fresh save.
 * When creating a new save, reads the age bracket stored by the AgeGate and
 * uses that to set the ageRating, falling back to the explicit `ageRating`
 * parameter (default: 'teen') if nothing is stored.
 *
 * @param ageRating - Fallback age rating to use if no bracket is stored.
 * @returns The loaded or newly created player save.
 */
export function initPlayer(ageRating: AgeRating = 'teen'): PlayerSave {
  let save = load()

  if (!save) {
    const effectiveRating = getStoredAgeRating() ?? ageRating
    save = createNewPlayer(effectiveRating)
    saveFn(save)
  }

  playerSave.set(save)
  return save
}

/**
 * Persists the current player data to localStorage.
 */
export function persistPlayer(): void {
  const current = get(playerSave)

  if (!current) {
    return
  }

  const updated: PlayerSave = {
    ...current,
    lastPlayedAt: Date.now(),
    // Phase 47: Persist unlocked paintings from the achievement store
    unlockedPaintings: getUnlockedPaintingIds(),
  }

  playerSave.set(updated)
  saveFn(updated)
}

/**
 * Save pending artifacts to player save.
 *
 * @param artifacts - The current pending artifacts array.
 */
export function savePendingArtifacts(artifacts: PendingArtifact[]): void {
  playerSave.update(s => s ? { ...s, pendingArtifacts: artifacts } : s)
}

/**
 * Load pending artifacts from player save.
 *
 * @returns Array of pending artifacts from the save, or empty array.
 */
export function loadPendingArtifacts(): PendingArtifact[] {
  const save = get(playerSave)
  return save?.pendingArtifacts ?? []
}

/**
 * Adds a fact ID to learned facts and creates its review state.
 *
 * @param factId - Fact identifier to add to the learned list.
 */
export function addLearnedFact(factId: string): void {
  playerSave.update((save) => {
    if (!save || save.learnedFacts.includes(factId)) {
      return save
    }

    return {
      ...save,
      learnedFacts: [...save.learnedFacts, factId],
      reviewStates: [...save.reviewStates, createReviewState(factId)],
      stats: {
        ...save.stats,
        totalFactsLearned: save.stats.totalFactsLearned + 1,
      },
    }
  })

  persistPlayer()
}

/**
 * Sells a learned fact for mineral rewards.
 *
 * @param factId - Fact identifier to sell.
 * @param mineralReward - Dust reward granted for this sale.
 */
export function sellFact(factId: string, mineralReward: number): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    return {
      ...save,
      soldFacts: [...save.soldFacts, factId],
      learnedFacts: save.learnedFacts.filter((id) => id !== factId),
      reviewStates: save.reviewStates.filter((state) => state.factId !== factId),
      minerals: {
        ...save.minerals,
        dust: save.minerals.dust + mineralReward,
      },
      stats: {
        ...save.stats,
        totalFactsSold: save.stats.totalFactsSold + 1,
      },
    }
  })

  persistPlayer()
}

/**
 * Updates SM-2 review state and quiz stats after one answer.
 * If factCategory is provided and behavioral learning is enabled, records fast mastery
 * signals when the fact's interval crosses the 14-day threshold for the first time.
 *
 * @param factId - Fact identifier whose review state should change.
 * @param correct - Whether the submitted answer was correct.
 * @param factCategory - Optional top-level category of the fact (e.g. 'Language').
 *   Pass this from callers that already have the fact object to enable Phase 12
 *   behavioral learning signal tracking (DD-V2-118).
 */
export function updateReviewState(factId: string, correct: boolean, factCategory?: string): void {
  let masteryEvent: { factId: string; masteryNumber: number } | null = null

  playerSave.update((save) => {
    if (!save) {
      return save
    }

    // Phase 12: Check for fast mastery (interval crossing 14-day threshold)
    let updatedSignals = save.behavioralSignals ?? { perCategory: {}, lastRecalcDives: 0 }
    if (correct && factCategory && save.interestConfig?.behavioralLearningEnabled) {
      const oldState = save.reviewStates.find(s => s.factId === factId)
      if (oldState && oldState.interval < 14) {
        const newState = reviewFact(oldState, correct)
        if (newState.interval >= 14) {
          updatedSignals = recordFastMastery(updatedSignals, factCategory)
        }
      }
    }

    // Phase 15.6: Check if this answer crosses the mastery threshold
    const existingState = save.reviewStates.find(s => s.factId === factId)
    if (existingState && getMasteryLevel(existingState) !== 'mastered') {
      const newState = reviewFact(existingState, correct)
      if (getMasteryLevel(newState) === 'mastered') {
        // Count how many facts will be mastered after this update (including this one)
        const alreadyMastered = save.reviewStates.filter(
          s => s.factId !== factId && getMasteryLevel(s) === 'mastered',
        ).length
        masteryEvent = { factId, masteryNumber: alreadyMastered + 1 }
      }
    }

    return {
      ...save,
      reviewStates: save.reviewStates.map((state) =>
        state.factId === factId ? reviewFact(state, correct) : state,
      ),
      behavioralSignals: updatedSignals,
      stats: {
        ...save.stats,
        totalQuizCorrect: correct ? save.stats.totalQuizCorrect + 1 : save.stats.totalQuizCorrect,
        totalQuizWrong: correct ? save.stats.totalQuizWrong : save.stats.totalQuizWrong + 1,
      },
    }
  })

  persistPlayer()

  // Phase 15.6: Dispatch mastery event outside the store update to avoid side effects
  if (masteryEvent) {
    document.dispatchEvent(
      new CustomEvent('game:fact-mastered', { detail: masteryEvent }),
    )
  }
}

/**
 * Returns review states that are currently due.
 *
 * @returns Array of review states due for study.
 */
export function getDueReviews(): ReviewState[] {
  const save = get(playerSave)

  if (!save) {
    return []
  }

  return save.reviewStates.filter((state) => isDue(state))
}

/**
 * Adds minerals earned from gameplay.
 *
 * @param tier - Mineral tier to increment.
 * @param amount - Amount to add.
 */
export function addMinerals(tier: MineralTier, amount: number): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    return {
      ...save,
      minerals: {
        ...save.minerals,
        [tier]: save.minerals[tier] + amount,
      },
    }
  })

  persistPlayer()
}

/**
 * Deducts minerals from the player. Clamps to zero — never goes negative.
 *
 * @param tier - Mineral tier to decrement.
 * @param amount - Amount to deduct.
 */
export function deductMinerals(tier: MineralTier, amount: number): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    return {
      ...save,
      minerals: {
        ...save.minerals,
        [tier]: Math.max(0, save.minerals[tier] - amount),
      },
    }
  })

  persistPlayer()
}

/**
 * Unlocks a dome room for the player if it is not already unlocked.
 *
 * @param roomId - The room ID to unlock.
 */
export function unlockRoom(roomId: string): void {
  playerSave.update((save) => {
    if (!save) return save
    const currentRooms = save.unlockedRooms ?? ['command']
    if (currentRooms.includes(roomId)) return save
    return {
      ...save,
      unlockedRooms: [...currentRooms, roomId],
    }
  })

  persistPlayer()
}

/**
 * Records a completed dive in player statistics and updates the daily streak.
 * Also checks if any new dome rooms should be unlocked based on total dives,
 * and auto-claims any newly reached streak milestones.
 *
 * @param deepestLayer - Deepest layer reached in the dive.
 * @param blocksMined - Number of blocks mined during the dive.
 */
export function recordDiveComplete(deepestLayer: number, blocksMined: number): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    const today = new Date().toISOString().split('T')[0]
    const lastDate = save.lastDiveDate

    let newStreak = save.stats.currentStreak
    let streakProtected = save.streakProtected ?? false

    if (lastDate === today) {
      // Already dived today — streak unchanged, clear protection flag
      streakProtected = false
    } else if (lastDate) {
      const lastDiveDate = new Date(lastDate)
      const todayDate = new Date(today)
      const diffDays = Math.floor((todayDate.getTime() - lastDiveDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // Consecutive day — increment streak
        newStreak += 1
        streakProtected = false
      } else if (diffDays > 1 && streakProtected) {
        // Missed a day but streak was protected — don't reset, just consume the protection
        streakProtected = false
      } else {
        // Streak broken — reset to 1
        newStreak = 1
        streakProtected = false
      }
    } else {
      // First ever dive
      newStreak = 1
      streakProtected = false
    }

    const newDiveCount = save.stats.totalDivesCompleted + 1

    // Check if any dome rooms should be unlocked based on new dive count
    const currentRooms = save.unlockedRooms ?? ['command']
    const newlyUnlocked = BALANCE.DOME_ROOMS
      .filter(room => room.unlockDives > 0 && newDiveCount >= room.unlockDives && !currentRooms.includes(room.id))
      .map(room => room.id)
    const updatedRooms = newlyUnlocked.length > 0
      ? [...currentRooms, ...newlyUnlocked]
      : currentRooms

    // Auto-claim newly reached streak milestones
    const claimedMilestones = [...(save.claimedMilestones ?? [])]
    let updatedMinerals = { ...save.minerals }
    let updatedOxygen = save.oxygen
    const updatedTitles = [...(save.titles ?? [])]

    for (const milestone of BALANCE.STREAK_MILESTONES) {
      if (newStreak >= milestone.days && !claimedMilestones.includes(milestone.days)) {
        claimedMilestones.push(milestone.days)
        // Apply the milestone reward
        if (milestone.reward === 'dust_bonus') {
          updatedMinerals = { ...updatedMinerals, dust: updatedMinerals.dust + milestone.value }
        } else if (milestone.reward === 'crystal_bonus') {
          updatedMinerals = { ...updatedMinerals, crystal: updatedMinerals.crystal + milestone.value }
        } else if (milestone.reward === 'geode_bonus') {
          updatedMinerals = { ...updatedMinerals, geode: updatedMinerals.geode + milestone.value }
        } else if (milestone.reward === 'essence_bonus') {
          updatedMinerals = { ...updatedMinerals, essence: updatedMinerals.essence + milestone.value }
        } else if (milestone.reward === 'oxygen_bonus') {
          updatedOxygen = updatedOxygen + milestone.value
        } else if (milestone.reward === 'title') {
          if (!updatedTitles.includes(milestone.name)) {
            updatedTitles.push(milestone.name)
          }
        }
      }
    }

    const highestClaimed = claimedMilestones.length > 0 ? Math.max(...claimedMilestones) : 0

    const updatedStats = {
      ...save.stats,
      totalDivesCompleted: newDiveCount,
      totalBlocksMined: save.stats.totalBlocksMined + blocksMined,
      deepestLayerReached:
        deepestLayer > save.stats.deepestLayerReached
          ? deepestLayer
          : save.stats.deepestLayerReached,
      currentStreak: newStreak,
      bestStreak: Math.max(save.stats.bestStreak, newStreak),
    }

    // Phase 12: Evaluate archetype (weekly re-eval)
    const todayStr = today
    const updatedArchetype = evaluateArchetype(
      { stats: updatedStats, fossils: save.fossils ?? {} },
      save.archetypeData ?? { detected: 'undetected', manualOverride: null, lastEvaluatedDate: null, detectedOnDay: null },
      todayStr,
    )

    // Phase 12: Update engagement score
    const diveAccuracy = updatedStats.totalQuizCorrect / Math.max(1, updatedStats.totalQuizCorrect + updatedStats.totalQuizWrong)
    const previousMode = save.engagementData?.mode ?? 'normal'
    const updatedEngagement = updateEngagementAfterDive(
      save.engagementData ?? { dailySnapshots: [], currentScore: 50, mode: 'normal' },
      todayStr,
      diveAccuracy,
      deepestLayer,
    )
    const gaiaComment = getEngagementGaiaComment(previousMode, updatedEngagement.mode)
    if (gaiaComment) {
      gaiaMessage.set(gaiaComment)
    }

    return {
      ...save,
      lastDiveDate: today,
      streakProtected,
      claimedMilestones,
      lastStreakMilestone: highestClaimed,
      titles: updatedTitles,
      minerals: updatedMinerals,
      oxygen: updatedOxygen,
      unlockedRooms: updatedRooms,
      archetypeData: updatedArchetype,
      engagementData: updatedEngagement,
      stats: updatedStats,
    }
  })

  persistPlayer()
}

/**
 * Consumes one streak freeze to protect the current streak for the next missed day.
 *
 * @returns `true` if a freeze was available and consumed, `false` otherwise.
 */
export function useStreakFreeze(): boolean {
  const current = get(playerSave)
  if (!current) return false

  const freezes = current.streakFreezes ?? 0
  if (freezes <= 0) return false

  playerSave.update(save => {
    if (!save) return save
    return {
      ...save,
      streakFreezes: (save.streakFreezes ?? 0) - 1,
      streakProtected: true,
      lastPlayedAt: Date.now(),
    }
  })

  persistPlayer()
  return true
}

/**
 * Purchases one streak freeze for the configured dust cost.
 * Respects BALANCE.STREAK_FREEZE_MAX as the cap on total freezes.
 *
 * @returns `true` if purchase succeeded, `false` if insufficient dust or at max freezes.
 */
export function purchaseStreakFreeze(): boolean {
  const current = get(playerSave)
  if (!current) return false

  const freezes = current.streakFreezes ?? 0
  if (freezes >= BALANCE.STREAK_FREEZE_MAX) return false

  const cost = BALANCE.STREAK_PROTECTION_COST.dust ?? 200
  if (current.minerals.dust < cost) return false

  playerSave.update(save => {
    if (!save) return save
    return {
      ...save,
      streakFreezes: (save.streakFreezes ?? 0) + 1,
      minerals: {
        ...save.minerals,
        dust: save.minerals.dust - cost,
      },
      lastPlayedAt: Date.now(),
    }
  })

  persistPlayer()
  return true
}

/**
 * Sets or clears the active cosmetic title displayed under the pilot name.
 *
 * @param title - The title string to activate, or `null` to clear.
 */
export function setActiveTitle(title: string | null): void {
  playerSave.update(save => {
    if (!save) return save
    // Only allow titles the player has actually unlocked
    if (title !== null && !(save.titles ?? []).includes(title)) return save
    return {
      ...save,
      activeTitle: title,
      lastPlayedAt: Date.now(),
    }
  })

  persistPlayer()
}

/**
 * Attempts to buy a cosmetic. Checks affordability, deducts cost, adds to ownedCosmetics.
 *
 * @param cosmeticId - The ID of the cosmetic to buy.
 * @param cost - Mineral cost map for this cosmetic.
 * @returns `true` if the purchase succeeded, `false` if insufficient funds or already owned.
 */
export function buyCosmetic(cosmeticId: string, cost: Cosmetic['cost']): boolean {
  const current = get(playerSave)
  if (!current) return false

  // Already owned — no double purchase
  if (current.ownedCosmetics.includes(cosmeticId)) return false

  // Validate player can afford
  for (const [tier, required] of Object.entries(cost) as [MineralTier, number][]) {
    if ((current.minerals[tier] ?? 0) < required) return false
  }

  // Deduct minerals
  const updatedMinerals = { ...current.minerals }
  for (const [tier, required] of Object.entries(cost) as [MineralTier, number][]) {
    updatedMinerals[tier] = (updatedMinerals[tier] ?? 0) - required
  }

  playerSave.update(save => {
    if (!save) return save
    return {
      ...save,
      minerals: updatedMinerals,
      ownedCosmetics: [...save.ownedCosmetics, cosmeticId],
      lastPlayedAt: Date.now(),
    }
  })

  persistPlayer()
  return true
}

/**
 * Sets or clears the equipped cosmetic.
 *
 * @param cosmeticId - The cosmetic ID to equip, or `null` to unequip.
 */
export function equipCosmetic(cosmeticId: string | null): void {
  playerSave.update(save => {
    if (!save) return save
    return {
      ...save,
      equippedCosmetic: cosmeticId,
      lastPlayedAt: Date.now(),
    }
  })

  persistPlayer()
}

/**
 * Recalculates the player's Knowledge Points from stats and mastery, then updates
 * the store and persists. Call this after any study session or stat-changing event.
 */
export function syncKnowledgePoints(): void {
  const save = get(playerSave)
  if (!save) return

  const masteredCount = save.reviewStates.filter(
    rs => getMasteryLevel(rs) === 'mastered',
  ).length

  const kp = calculateKnowledgePoints(save.stats, masteredCount)

  // Only update if the value actually changed to avoid unnecessary re-renders
  if (save.knowledgePoints === kp) return

  playerSave.update(s => {
    if (!s) return s
    return { ...s, knowledgePoints: kp }
  })

  persistPlayer()
}

/**
 * Sets or clears the active companion fossil species.
 *
 * @param speciesId - The species ID to set as companion, or `null` to remove.
 */
export function setActiveCompanion(speciesId: string | null): void {
  playerSave.update(save => {
    if (!save) return save
    return {
      ...save,
      activeCompanion: speciesId,
      lastPlayedAt: Date.now(),
    }
  })

  persistPlayer()
}

/**
 * Attempts to purchase a Knowledge Store item. Checks KP balance, deducts KP,
 * and appends the item ID to purchasedKnowledgeItems.
 *
 * For items with maxPurchases > 1 the same ID is appended multiple times so the
 * count is simply derived via `filter`.
 *
 * @param itemId - The Knowledge Store item ID to purchase.
 * @param cost - KP cost of the item (taken from KNOWLEDGE_ITEMS).
 * @returns `true` if the purchase succeeded, `false` otherwise.
 */
export function purchaseKnowledgeItem(itemId: string, cost: number): boolean {
  const current = get(playerSave)
  if (!current) return false

  if (current.knowledgePoints < cost) return false

  playerSave.update(save => {
    if (!save) return save
    return {
      ...save,
      knowledgePoints: save.knowledgePoints - cost,
      purchasedKnowledgeItems: [...save.purchasedKnowledgeItems, itemId],
      lastPlayedAt: Date.now(),
    }
  })

  persistPlayer()
  return true
}

import type { CompanionState } from '../../data/companions'
import { COMPANION_CATALOGUE } from '../../data/companions'

/** Persistent companion states for all companions (unlocked or not). */
export const playerCompanionStates = singletonWritable<CompanionState[]>(
  'playerCompanionStates',
  COMPANION_CATALOGUE.map(c => ({
    companionId: c.id,
    currentStage: 0,
    unlocked: c.id === 'comp_borebot', // Borebot unlocked by default
  }))
)

import type { FloorUpgradeTier } from '../../data/hubLayout'
import { getUpgradeDef, canUpgrade } from '../../data/hubUpgrades'

/**
 * Upgrades a hub floor to the next tier, spending resources.
 * Returns true on success.
 *
 * @param floorId - The hub floor identifier.
 * @param targetTier - The tier to upgrade to.
 */
export function upgradeFloor(floorId: string, targetTier: FloorUpgradeTier): boolean {
  const current = get(playerSave)
  if (!current) return false

  const check = canUpgrade(floorId, targetTier, current)
  if (!check.allowed) return false

  const def = getUpgradeDef(floorId, targetTier)!

  playerSave.update(s => {
    if (!s) return s
    const updatedMinerals = { ...s.minerals, dust: s.minerals.dust - def.dustCost }
    const updatedPremium = { ...s.premiumMaterials }
    for (const { materialId, count } of def.premiumCosts) {
      updatedPremium[materialId] = Math.max(0, (updatedPremium[materialId] ?? 0) - count)
    }
    return {
      ...s,
      minerals: updatedMinerals,
      premiumMaterials: updatedPremium,
      hubState: {
        ...s.hubState,
        floorTiers: { ...s.hubState.floorTiers, [floorId]: targetTier },
      },
    }
  })

  persistPlayer()
  return true
}

/**
 * Sets the active wallpaper for a hub floor.
 *
 * @param floorId - The hub floor identifier.
 * @param wallpaperId - The wallpaper ID to apply, or null to clear.
 */
export function setFloorWallpaper(floorId: string, wallpaperId: string | null): void {
  playerSave.update(s => {
    if (!s) return s
    return {
      ...s,
      hubState: {
        ...s.hubState,
        activeWallpapers: { ...s.hubState.activeWallpapers, [floorId]: wallpaperId },
      },
    }
  })
  persistPlayer()
}

// =========================================================
// Phase 37: Advanced Pet System — Dust Cat functions
// =========================================================

import { assignTraits } from '../../data/petTraits'
import { playerOwnsDustCatCosmetic } from '../../data/dustCatCosmetics'

/**
 * Decay Dust Cat happiness based on elapsed real time.
 * Rate: -2 per hour. Floor: 0. Ceil: 100.
 * Called on app focus and blur to avoid mid-session decay jumps.
 */
export function tickDustCatHappiness(): void {
  playerSave.update(s => {
    if (!s || !s.dustCatUnlocked || s.dustCatHappiness === undefined) return s
    const now = Date.now()
    const lastDecay = s.dustCatLastDecayAt ?? now
    const elapsedHours = (now - lastDecay) / 3_600_000
    let decayRate = 2  // 2 points per hour base rate

    // Apply trait modifiers
    if (s.dustCatTraits) {
      for (const trait of s.dustCatTraits) {
        if (trait === 'stubborn') decayRate *= 0.75
        if (trait === 'nocturnal') {
          const h = new Date().getHours()
          if (h >= 22 || h < 6) decayRate *= 0.5
        }
      }
    }

    const decay = elapsedHours * decayRate

    // Respect 'lazy' trait happiness floor
    let happinessFloor = 0
    if (s.dustCatTraits?.includes('lazy')) happinessFloor = 20

    return {
      ...s,
      dustCatHappiness: Math.max(happinessFloor, (s.dustCatHappiness ?? 100) - decay),
      dustCatLastDecayAt: now,
    }
  })
}

/**
 * Add happiness to the Dust Cat. Clamps to [0, 100].
 * Call persistPlayer() after if the change should be immediately saved.
 *
 * @param amount - Amount to add (can be negative to subtract).
 */
export function addDustCatHappiness(amount: number): void {
  playerSave.update(s => {
    if (!s || !s.dustCatUnlocked) return s
    return {
      ...s,
      dustCatHappiness: Math.max(0, Math.min(100, (s.dustCatHappiness ?? 0) + amount)),
    }
  })
}

/**
 * Unlock the Dust Cat for this player. Assigns two permanent personality traits
 * using the player's ID as the random seed. (DD-V2-042)
 */
export function unlockDustCat(): void {
  playerSave.update(s => {
    if (!s) return s
    if (s.dustCatUnlocked) return s  // idempotent
    const seed = parseInt(s.playerId.replace(/\D/g, '').slice(0, 8) || '42', 10)
    const [traitA, traitB] = assignTraits(seed)
    return {
      ...s,
      dustCatUnlocked: true,
      dustCatHappiness: 100,
      dustCatLastDecayAt: Date.now(),
      dustCatTraits: [traitA, traitB],
      dustCatCosmetics: {},
    }
  })
  persistPlayer()
}

/**
 * Equip a Dust Cat cosmetic. Only applies if player owns it.
 *
 * @param slot - 'hat' | 'accessory' | 'color'
 * @param cosmeticId - The cosmetic ID to equip.
 */
export function equipDustCatCosmetic(slot: string, cosmeticId: string): void {
  playerSave.update(s => {
    if (!s) return s
    const owned = playerOwnsDustCatCosmetic(cosmeticId, s.ownedCosmetics)
    if (!owned) return s
    return {
      ...s,
      dustCatCosmetics: { ...(s.dustCatCosmetics ?? {}), [slot]: cosmeticId },
    }
  })
  persistPlayer()
}

/**
 * Unlock a Dust Cat cosmetic (adds to ownedCosmetics if not already there).
 *
 * @param cosmeticId - The cosmetic ID to unlock.
 */
export function unlockDustCatCosmetic(cosmeticId: string): void {
  playerSave.update(s => {
    if (!s) return s
    if (s.ownedCosmetics.includes(cosmeticId)) return s
    return { ...s, ownedCosmetics: [...s.ownedCosmetics, cosmeticId] }
  })
  persistPlayer()
}

// =========================================================
// Phase 55: Economy Depth — Duplicate Artifact Mixing
// =========================================================

import type { ArtifactCard } from '../../data/types'

const RARITY_ORDER_MIX = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

/**
 * Mixes 3+ duplicate artifact cards into a new card with a chance of rarity upgrade.
 * Deducts MIX_FEE_DUST dust. Removes input cards, adds one output card.
 *
 * @param instanceIds - Array of 3+ artifact card instanceIds to consume.
 * @returns The output rarity string, or null if the mix failed (insufficient cards/dust).
 */
export function mixArtifacts(instanceIds: string[]): string | null {
  const current = get(playerSave)
  if (!current) return null

  const cards = current.inventoryArtifacts ?? []
  if (instanceIds.length < BALANCE.MIX_MIN_CARDS) return null
  if (current.minerals.dust < BALANCE.MIX_FEE_DUST) return null

  // Validate all instanceIds exist
  const selectedCards = instanceIds.map(id => cards.find(c => c.instanceId === id)).filter(Boolean) as ArtifactCard[]
  if (selectedCards.length < BALANCE.MIX_MIN_CARDS) return null

  // Determine base rarity: most common rarity among selected cards
  const rarityCounts: Record<string, number> = {}
  for (const card of selectedCards) {
    rarityCounts[card.rarity] = (rarityCounts[card.rarity] ?? 0) + 1
  }
  let baseRarity = selectedCards[0].rarity
  let maxCount = 0
  for (const [rarity, count] of Object.entries(rarityCounts)) {
    if (count > maxCount) {
      maxCount = count
      baseRarity = rarity
    }
  }

  // Roll for output rarity
  const roll = Math.random()
  const baseIdx = RARITY_ORDER_MIX.indexOf(baseRarity)
  let outputRarity: string
  if (roll < BALANCE.MIX_RARITY_TWO_UP) {
    // Two tiers up (capped at mythic)
    outputRarity = RARITY_ORDER_MIX[Math.min(baseIdx + 2, RARITY_ORDER_MIX.length - 1)]
  } else if (roll < BALANCE.MIX_RARITY_TWO_UP + BALANCE.MIX_RARITY_ONE_UP) {
    // One tier up (capped at mythic)
    outputRarity = RARITY_ORDER_MIX[Math.min(baseIdx + 1, RARITY_ORDER_MIX.length - 1)]
  } else {
    // Same rarity
    outputRarity = baseRarity
  }

  // Build new card
  const newCard: ArtifactCard = {
    instanceId: crypto.randomUUID(),
    factId: selectedCards[0].factId,
    rarity: outputRarity,
    discoveredAt: Date.now(),
    isSoulbound: false,
    isListed: false,
  }

  const removeSet = new Set(instanceIds)

  playerSave.update(save => {
    if (!save) return save
    return {
      ...save,
      minerals: {
        ...save.minerals,
        dust: save.minerals.dust - BALANCE.MIX_FEE_DUST,
      },
      inventoryArtifacts: [
        ...(save.inventoryArtifacts ?? []).filter(c => !removeSet.has(c.instanceId)),
        newCard,
      ],
    }
  })

  persistPlayer()
  return outputRarity
}

// =========================================================
// Phase 48: Prestige & Endgame
// =========================================================

import { applyPrestige as _applyPrestige } from '../../services/prestigeService'

/**
 * Applies a prestige reset to the current player save.
 * Delegates to prestigeService.applyPrestige(), updates the store, and persists.
 * No-op if the player is not eligible (all facts must be mastered).
 */
export function applyPrestigeReset(): void {
  playerSave.update(s => {
    if (!s) return s
    return _applyPrestige(s)
  })
  persistPlayer()
}

/**
 * Awards mentor prestige points to the player (earned when their authored hints
 * receive upvotes from other players).
 *
 * @param amount - Number of points to award (typically 1 per upvote).
 */
export function awardMentorPrestigePoints(amount: number): void {
  if (amount <= 0) return
  playerSave.update(s => {
    if (!s) return s
    return {
      ...s,
      mentorPrestigePoints: (s.mentorPrestigePoints ?? 0) + amount,
    }
  })
  persistPlayer()
}

/** Returns true if the player is eligible for the morning review bonus right now. */
export function isMorningReviewAvailable(save: PlayerSave): boolean {
  const now = new Date()
  const hour = now.getHours()
  const todayIso = now.toISOString().slice(0, 10)
  if (hour < BALANCE.MORNING_REVIEW_HOUR || hour >= BALANCE.MORNING_REVIEW_END) return false
  return save.lastMorningReview !== todayIso
}

/** Returns true if the player is eligible for the evening review bonus right now. */
export function isEveningReviewAvailable(save: PlayerSave): boolean {
  const now = new Date()
  const hour = now.getHours()
  const todayIso = now.toISOString().slice(0, 10)
  if (hour < BALANCE.EVENING_REVIEW_HOUR || hour >= BALANCE.EVENING_REVIEW_END) return false
  return save.lastEveningReview !== todayIso
}

/** Awards the morning review bonus and updates the timestamp. */
export function claimMorningReviewBonus(save: PlayerSave): PlayerSave {
  const todayIso = new Date().toISOString().slice(0, 10)
  return {
    ...save,
    lastMorningReview: todayIso,
    oxygen: save.oxygen + BALANCE.MORNING_REVIEW_O2_BONUS,
  }
}

/** Awards the evening review bonus and updates the timestamp. */
export function claimEveningReviewBonus(save: PlayerSave): PlayerSave {
  const todayIso = new Date().toISOString().slice(0, 10)
  return {
    ...save,
    lastEveningReview: todayIso,
    oxygen: save.oxygen + BALANCE.EVENING_REVIEW_O2_BONUS,
  }
}

// =========================================================
// Phase 53: Learning Sparks
// =========================================================

/**
 * Returns the ISO date (YYYY-MM-DD) of the Monday starting the current week.
 */
function getCurrentIsoWeekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1 // Days since Monday
  const monday = new Date(now)
  monday.setDate(monday.getDate() - diff)
  return monday.toISOString().slice(0, 10)
}

/**
 * Checks if a fact's mastery level has crossed a threshold and awards Learning Sparks.
 * Call after every SM-2 update.
 */
export function awardLearningSparkIfMilestone(
  save: PlayerSave,
  prevState: ReviewState | undefined,
  newState: ReviewState,
): PlayerSave {
  if (!prevState) return save

  let sparksToAdd = 0
  const prevLevel = getMasteryLevel(prevState)
  const newLevel = getMasteryLevel(newState)

  if (prevLevel !== 'familiar' && prevLevel !== 'known' && prevLevel !== 'mastered' &&
      (newLevel === 'familiar' || newLevel === 'known' || newLevel === 'mastered')) {
    sparksToAdd += LEARNING_SPARKS_PER_MILESTONE.fact_familiar
  }
  if (prevLevel !== 'known' && prevLevel !== 'mastered' &&
      (newLevel === 'known' || newLevel === 'mastered')) {
    sparksToAdd += LEARNING_SPARKS_PER_MILESTONE.fact_known
  }
  if (prevLevel !== 'mastered' && newLevel === 'mastered') {
    sparksToAdd += LEARNING_SPARKS_PER_MILESTONE.fact_mastered
  }

  if (sparksToAdd === 0) return save

  const weekStart = getCurrentIsoWeekStart()
  const sameWeek = save.sparkWeekStart === weekStart
  return {
    ...save,
    learningSparks: (save.learningSparks ?? 0) + sparksToAdd,
    sparkEarnedThisWeek: sameWeek ? (save.sparkEarnedThisWeek ?? 0) + sparksToAdd : sparksToAdd,
    sparkWeekStart: weekStart,
  }
}

/**
 * Awards branch milestone Learning Sparks if a branch just crossed 25%, 50%, or 100%.
 */
export function awardBranchMilestone(
  save: PlayerSave,
  category: string,
  completionPercent: number,
): PlayerSave {
  const awarded = save.awardedBranchMilestones ?? []
  let sparksToAdd = 0
  const newMilestones: string[] = []

  for (const [threshold, sparks] of [
    [25, LEARNING_SPARKS_PER_MILESTONE.branch_25_pct],
    [50, LEARNING_SPARKS_PER_MILESTONE.branch_50_pct],
    [100, LEARNING_SPARKS_PER_MILESTONE.branch_100_pct],
  ] as const) {
    const key = `${category}:${threshold}`
    if (completionPercent >= threshold && !awarded.includes(key)) {
      sparksToAdd += sparks
      newMilestones.push(key)
    }
  }

  if (sparksToAdd === 0) return save

  const weekStart = getCurrentIsoWeekStart()
  const sameWeek = save.sparkWeekStart === weekStart
  return {
    ...save,
    learningSparks: (save.learningSparks ?? 0) + sparksToAdd,
    sparkEarnedThisWeek: sameWeek ? (save.sparkEarnedThisWeek ?? 0) + sparksToAdd : sparksToAdd,
    sparkWeekStart: weekStart,
    awardedBranchMilestones: [...awarded, ...newMilestones],
  }
}
