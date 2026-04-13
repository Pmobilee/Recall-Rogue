import { BALANCE } from '../data/balance'
import { generateUUID } from '../utils/uuid'
import type {
  AgeRating,
  PlayerSave,
  PlayerStats,
  ReviewState,
} from '../data/types'
// Recipe/Recipe/PremiumMaterial types removed — archived with mining code
// recipes, premiumRecipes, dailyDeals, farm — archived (mining-era)
import { createDefaultInterestConfig } from '../data/interestConfig'
import { DEFAULT_ARCHETYPE_DATA } from '../services/archetypeDetector'
import { DEFAULT_ENGAGEMENT_DATA } from '../services/engagementScorer'
import { profileService } from '../services/profileService'
import { getBackend } from './storageBackend'
import { migrateRelicsV1toV2, needsRelicMigrationV1toV2, migrateV2toV3, needsMigrationV2toV3 } from './saveMigration'

/**
 * Legacy/fallback save key. Used when no profiles exist (backward compatibility).
 * Active profile saves use the profile-namespaced key from profileService.getSaveKey().
 */
export const SAVE_KEY = 'recall-rogue-save'
export const SAVE_VERSION = 3

/**
 * Returns the localStorage key to use for the current player's save.
 * When profiles exist, delegates to profileService to get the namespaced key.
 * Falls back to the legacy SAVE_KEY for backward compatibility.
 */
function getActiveSaveKey(): string {
  return profileService.getSaveKey()
}

const EMPTY_MINERALS = {
  greyMatter: 0,
}

const EMPTY_STATS: PlayerStats = {
  totalDivesCompleted: 0,
  bestFloor: 0,
  totalFactsLearned: 0,
  totalFactsSold: 0,
  totalQuizCorrect: 0,
  totalQuizWrong: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalSessions: 0,
  zeroDiveSessions: 0,
  // Journal/Profile counters (v3)
  totalVictories: 0,
  totalDefeats: 0,
  totalRetreats: 0,
  totalAbandons: 0,
  cumulativePlaytimeMs: 0,
  totalEnemiesDefeated: 0,
  totalElitesDefeated: 0,
  totalBossesDefeated: 0,
  lifetimeFactsMastered: 0,
}

/**
 * Stores player save data in localStorage using the active profile's key.
 */
export function save(data: PlayerSave): void {
  getBackend().write(getActiveSaveKey(), JSON.stringify(data))
}

/**
 * Loads player save data from localStorage using the active profile's key.
 *
 * Returns null when no save exists or the stored JSON is invalid.
 *
 * Applies all in-place compatibility migrations before returning, including
 * the V1→V2 relic catalogue migration. When migration runs, the result is
 * immediately re-persisted so the migration only executes once.
 */
export function load(): PlayerSave | null {
  const raw = getBackend().readSync(getActiveSaveKey())

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as PlayerSave & {
      minerals: Record<string, number>
    }
    // Backward compatibility: collapse all legacy mineral tiers into greyMatter
    if (parsed.minerals) {
      let total = parsed.minerals.greyMatter ?? 0
      // Legacy tier conversions (approx GM equivalents)
      for (const [key, mult] of [['shard', 25], ['crystal', 100], ['geode', 500], ['essence', 2000], ['coreFragment', 500], ['primordialEssence', 2000]] as const) {
        if (key in parsed.minerals) {
          total += (parsed.minerals[key] ?? 0) * mult
          delete parsed.minerals[key]
        }
      }
      parsed.minerals.greyMatter = total
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
    // Backward compatibility: knowledge fields
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
    // Backward compatibility: ensure premiumMaterials exists
    if (!parsedAny['premiumMaterials'] || typeof parsedAny['premiumMaterials'] !== 'object') {
      parsedAny['premiumMaterials'] = {}
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
    // Backward compatibility: run calibration + cloud profile metadata
    if (!parsedAny['domainRunCounts'] || typeof parsedAny['domainRunCounts'] !== 'object') {
      parsedAny['domainRunCounts'] = {}
    }
    if (typeof parsedAny['deviceId'] !== 'string' || parsedAny['deviceId'].length === 0) {
      parsedAny['deviceId'] = generateUUID()
    }
    if (!('accountId' in parsedAny)) {
      parsedAny['accountId'] = null
    }
    if (!('accountEmail' in parsedAny)) {
      parsedAny['accountEmail'] = null
    }
    if (typeof parsedAny['cloudSyncEnabled'] !== 'boolean') {
      parsedAny['cloudSyncEnabled'] = true
    }
    if (typeof parsedAny['lastCloudSyncAt'] !== 'number') {
      parsedAny['lastCloudSyncAt'] = 0
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
    // Backward compat: migrate deepestLayerReached → bestFloor, drop totalBlocksMined
    const statsAny = parsed.stats as unknown as Record<string, unknown>
    if (typeof statsAny['bestFloor'] !== 'number') {
      statsAny['bestFloor'] = statsAny['deepestLayerReached'] ?? 0
    }
    // Backward compat: migrate lastDiveDate → lastPlayDate
    if (!('lastPlayDate' in parsedAny) && 'lastDiveDate' in parsedAny) {
      parsedAny['lastPlayDate'] = parsedAny['lastDiveDate']
    }
    // Backward compatibility: ensure hubState exists (Phase 10)
    if (!parsedAny['hubState'] || typeof parsedAny['hubState'] !== 'object') {
      parsedAny['hubState'] = {
        unlockedFloorIds: ['starter', 'study', 'farm', 'workshop', 'zoo', 'collection', 'market', 'research', 'observatory', 'gallery'],
        activeWallpapers: {},
        floorTiers: { starter: 0, study: 0, farm: 0, workshop: 0, zoo: 0, collection: 0, market: 0, research: 0, observatory: 0, gallery: 0 },
        lastBriefingDate: null,
      }
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
          museum: 'collection', market: 'market', archive: 'research',
        }
        const migrated = new Set<string>(currentFloors)
        for (const roomId of rooms) {
          const floorId = roomToFloor[roomId]
          if (floorId) migrated.add(floorId)
        }
        hs['unlockedFloorIds'] = [...migrated]
      }
      // Migrate renamed floor IDs (dome overhaul)
      const floorIdRenames: Record<string, string> = { museum: 'collection', archive: 'research' }
      const currentFloorIds = hs['unlockedFloorIds'] as string[]
      hs['unlockedFloorIds'] = currentFloorIds.map((id: string) => floorIdRenames[id] ?? id)
      // Migrate floorTiers keys
      if (!hs['floorTiers'] || typeof hs['floorTiers'] !== 'object') {
        hs['floorTiers'] = {}
      }
      const tiers = hs['floorTiers'] as Record<string, number>
      for (const [oldId, newId] of Object.entries(floorIdRenames)) {
        if (oldId in tiers) { tiers[newId] = tiers[oldId]; delete tiers[oldId] }
      }
      // Initialize floor tiers for newly migrated floors
      for (const fId of hs['unlockedFloorIds'] as string[]) {
        if (!(fId in tiers)) tiers[fId] = 0
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
    // Backward compat: migrate diveCount → runCount
    if (typeof parsedAny['runCount'] !== 'number') {
      parsedAny['runCount'] = parsedAny['diveCount'] ?? parsed.stats.totalDivesCompleted ?? 0
    }
    if (typeof parsedAny['tutorialStep'] !== 'number') {
      parsedAny['tutorialStep'] = 0
    }
    if (typeof parsedAny['studySessionsCompleted'] !== 'number') {
      parsedAny['studySessionsCompleted'] = 0
    }
    // Backward compatibility: ensure workload tracking fields exist
    if (typeof parsedAny['newCardsStudiedToday'] !== 'number') {
      parsedAny['newCardsStudiedToday'] = 0
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
    if (parsedAny['lastRegenAt'] === undefined) {
      parsedAny['lastRegenAt'] = Date.now()
    }
    if (!parsedAny['subscriberCategoryFilters'] || typeof parsedAny['subscriberCategoryFilters'] !== 'object') {
      parsedAny['subscriberCategoryFilters'] = {}
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
    // Backward compatibility: ensure discoveredFacts exists
    if (!Array.isArray(parsedAny['discoveredFacts'])) {
      parsedAny['discoveredFacts'] = []
    }
    // Anki-faithful SM-2 migration — backfill new ReviewState fields
    if (Array.isArray(parsedAny['reviewStates'])) {
      for (const rs of parsedAny['reviewStates'] as Record<string, unknown>[]) {
        if (typeof rs['cardState'] !== 'string') {
          // Infer card state from existing data
          if ((rs['interval'] as number) === 0 && (rs['repetitions'] as number) === 0) {
            rs['cardState'] = 'new'
          } else if ((rs['interval'] as number) <= 1 && (rs['repetitions'] as number) <= 2) {
            rs['cardState'] = 'learning'
          } else {
            rs['cardState'] = 'review'
          }
        }
        if (typeof rs['learningStep'] !== 'number') {
          rs['learningStep'] = 0
        }
        if (typeof rs['lapseCount'] !== 'number') {
          rs['lapseCount'] = 0
        }
        if (typeof rs['isLeech'] !== 'boolean') {
          rs['isLeech'] = false
        }
        if (typeof rs['difficulty'] !== 'number') {
          rs['difficulty'] = 5
        }
        if (typeof rs['due'] !== 'number') {
          rs['due'] = (rs['nextReviewAt'] as number) ?? Date.now()
        }
        if (typeof rs['lastReview'] !== 'number') {
          rs['lastReview'] = (rs['lastReviewAt'] as number) ?? 0
        }
        if (typeof rs['reps'] !== 'number') {
          rs['reps'] = (rs['repetitions'] as number) ?? 0
        }
        if (typeof rs['lapses'] !== 'number') {
          rs['lapses'] = (rs['lapseCount'] as number) ?? 0
        }
        if (typeof rs['state'] !== 'string') {
          rs['state'] = rs['cardState'] === 'suspended' ? 'review' : rs['cardState']
        }
        if (typeof rs['lastVariantIndex'] !== 'number') {
          rs['lastVariantIndex'] = -1
        }
        if (typeof rs['totalAttempts'] !== 'number') {
          rs['totalAttempts'] = 0
        }
        if (typeof rs['totalCorrect'] !== 'number') {
          rs['totalCorrect'] = 0
        }
        if (typeof rs['averageResponseTimeMs'] !== 'number') {
          rs['averageResponseTimeMs'] = 0
        }
        if (!Array.isArray(rs['tierHistory'])) {
          rs['tierHistory'] = []
        }
      }
    }
    if (typeof parsedAny['hasCompletedInitialStudy'] !== 'boolean') {
      // Existing players have already studied, so default to true
      parsedAny['hasCompletedInitialStudy'] = true
    }
    // Relic system overhaul: mastery coins and relic unlocks
    if (typeof parsedAny['masteryCoins'] !== 'number') {
      // Retroactive coins: count Tier 3 (mastered) facts
      const tier3Count = Array.isArray(parsedAny['reviewStates'])
        ? (parsedAny['reviewStates'] as Record<string, unknown>[]).filter((rs) => {
            const stability = rs['stability'] as number ?? 0
            const reps = rs['reps'] as number ?? rs['repetitions'] as number ?? 0
            return stability >= 21 && reps >= 5
          }).length
        : 0
      parsedAny['masteryCoins'] = tier3Count
      parsedAny['masteryCoinsAvailable'] = tier3Count
    }
    if (typeof parsedAny['masteryCoinsAvailable'] !== 'number') {
      parsedAny['masteryCoinsAvailable'] = parsedAny['masteryCoins'] as number ?? 0
    }
    if (!Array.isArray(parsedAny['unlockedRelicIds'])) {
      parsedAny['unlockedRelicIds'] = []
    }
    if (!Array.isArray(parsedAny['unlockedTracks'])) {
      parsedAny['unlockedTracks'] = []
    }
    if (!Array.isArray(parsedAny['excludedRelicIds'])) {
      parsedAny['excludedRelicIds'] = []
    }
    // Study Presets & Deck Builder migration
    if (!Array.isArray(parsedAny['studyPresets'])) {
      parsedAny['studyPresets'] = []
    }
    if (!parsedAny['categoryFilters'] || typeof parsedAny['categoryFilters'] !== 'object') {
      parsedAny['categoryFilters'] = parsedAny['subscriberCategoryFilters'] ?? {}
    }
    // Character progression migration
    if (typeof parsedAny['totalXP'] !== 'number') {
      parsedAny['totalXP'] = 0
    }
    if (typeof parsedAny['characterLevel'] !== 'number') {
      parsedAny['characterLevel'] = 1
    }
    // DEV: force max level + all relics unlocked for testing
    if (import.meta.env.DEV) {
      parsedAny['characterLevel'] = 25;
      parsedAny['totalXP'] = 999999;
      // Unlock all relics in collection
      try {
        const { FULL_RELIC_CATALOGUE } = require('../data/relics/index');
        parsedAny['unlockedRelicIds'] = FULL_RELIC_CATALOGUE.map((r: any) => r.id);
      } catch { /* relics not loaded yet */ }
      console.log('[DEV] Forced characterLevel 25 + all relics unlocked');
    }
    if (!('lastDailyBonusDate' in parsedAny) || (parsedAny['lastDailyBonusDate'] !== null && typeof parsedAny['lastDailyBonusDate'] !== 'string')) {
      parsedAny['lastDailyBonusDate'] = null
    }
    // Procedural math skill states migration
    if (!Array.isArray(parsedAny['skillStates'])) {
      parsedAny['skillStates'] = []
    }
    // Migration: rename customPlaylists → customDecks in lastDungeonSelection (2026-04-07)
    {
      const lds = parsedAny['lastDungeonSelection'] as Record<string, unknown> | undefined
      if (lds) {
        if (lds['customPlaylists'] !== undefined && lds['customDecks'] === undefined) {
          lds['customDecks'] = lds['customPlaylists']
          delete lds['customPlaylists']
        }
        if (lds['activePlaylistId'] !== undefined && lds['activeCustomDeckId'] === undefined) {
          lds['activeCustomDeckId'] = lds['activePlaylistId']
          delete lds['activePlaylistId']
        }
      }
    }

    // V1 → V2 relic catalogue migration.
    // Must run after unlockedRelicIds is guaranteed to be an array (see above).
    // Re-persists the save immediately so the migration only executes once.
    if (needsRelicMigrationV1toV2(parsed)) {
      migrateRelicsV1toV2(parsed)
      getBackend().write(getActiveSaveKey(), JSON.stringify(parsed))
    }

    // V2 → V3: Journal/Profile stats and run history.
    // Additive migration — no existing data is removed or changed.
    if (needsMigrationV2toV3(parsed as unknown as Record<string, unknown>)) {
      migrateV2toV3(parsed as unknown as Record<string, unknown>)
      getBackend().write(getActiveSaveKey(), JSON.stringify(parsed))
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
    deviceId: generateUUID(),
    accountId: null,
    accountEmail: null,
    cloudSyncEnabled: true,
    lastCloudSyncAt: 0,
    ageRating,
    createdAt: now,
    lastPlayedAt: now,
    domainRunCounts: {},
    oxygen: 3, // legacy mining field (3 tanks default)
    minerals: { ...EMPTY_MINERALS },
    learnedFacts: [],
    reviewStates,
    soldFacts: [],
    discoveredFacts: [],
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
    knowledgePoints: 0,
    purchasedKnowledgeItems: [],
    unlockedRooms: ['command'],
    premiumMaterials: {},
    streakFreezes: 0,
    lastStreakMilestone: 0,
    claimedMilestones: [],
    streakProtected: false,
    titles: [],
    activeTitle: null,
    stats: { ...EMPTY_STATS },
    hubState: {
      unlockedFloorIds: ['starter', 'study', 'farm', 'workshop', 'zoo', 'collection', 'market', 'research', 'observatory', 'gallery'],
      activeWallpapers: {},
      floorTiers: { starter: 0, study: 0, farm: 0, workshop: 0, zoo: 0, collection: 0, market: 0, research: 0, observatory: 0, gallery: 0 },
      lastBriefingDate: null,
    },
    interestConfig: createDefaultInterestConfig(),
    behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
    archetypeData: { ...DEFAULT_ARCHETYPE_DATA },
    engagementData: { ...DEFAULT_ENGAGEMENT_DATA },
    // Phase 14: Onboarding & Tutorial
    tutorialComplete: false,
    hasCompletedInitialStudy: false,
    selectedInterests: [],
    interestWeights: {},
    runCount: 0,
    tutorialStep: 0,
    studySessionsCompleted: 0,
    newCardsStudiedToday: 0,
    // Phase 17: Addictiveness Pass
    loginCalendarDay: 1,
    loginCalendarLastClaimed: 0,
    lastLoginDate: 0,
    longestStreak: 0,
    gracePeriodUsedAt: 0,
    weeklyChallenge: undefined,
    consumables: {},
    subscriberCategoryFilters: {},
    studyPresets: [],
    categoryFilters: {},
    // Phase 47: Achievement Gallery
    unlockedPaintings: [],
    defeatedBosses: [],

    // Phase 59: Artifact Analyzer persistence
    pendingArtifacts: [],

    // Relic system: mastery coins and unlocks
    masteryCoins: 0,
    masteryCoinsAvailable: 0,
    unlockedRelicIds: [],
    excludedRelicIds: [],
    unlockedTracks: [],
    // Character progression
    totalXP: 0,
    characterLevel: 1, // New players start at level 1
    lastDailyBonusDate: null,
    // Procedural math skill states
    skillStates: [],
    // Journal/Profile history (v3)
    runHistory: [],
    lifetimeEnemyKillCounts: {},
  }
}

/**
 * Deletes the current player save from localStorage.
 */
export function deleteSave(): void {
  getBackend().remove(getActiveSaveKey())
}

// ============================================================
// ARCHIVED: craftRecipe, convertMineral, applyWeeklyMaintenance,
// checkSpendingBonus, getScaledCost, getCraftScaleMultiplier,
// purchaseDeal, collectFarmResources, placeFarmAnimal,
// removeFarmAnimal, expandFarm, craftPremiumRecipe,
// updateStreakOnLogin — all mining-era functions removed.
// Historical implementation notes live in docs/archive/.
// ============================================================
