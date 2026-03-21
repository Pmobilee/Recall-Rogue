import type { PlayerSave, PendingArtifact, ReviewState, HubSaveState, FloorUpgradeTier } from '../data/types'
import type { Screen } from '../ui/stores/gameState'
import { createReviewState } from '../services/sm2'
import { SAVE_VERSION } from '../services/saveService'
import { createDefaultInterestConfig } from '../data/interestConfig'

/** All 10 canonical floor IDs (inlined from archived hubFloors.ts) */
const ALL_FLOOR_IDS = ['starter', 'study', 'farm', 'workshop', 'zoo', 'collection', 'market', 'research', 'observatory', 'gallery'] as const

/** Inlined from archived hubLayout.ts */
function defaultHubSaveState(): HubSaveState {
  return {
    unlockedFloorIds: [...ALL_FLOOR_IDS],
    activeWallpapers: {},
    floorTiers: Object.fromEntries(ALL_FLOOR_IDS.map(id => [id, 0 as FloorUpgradeTier])) as Record<string, FloorUpgradeTier>,
    lastBriefingDate: null,
  }
}

// ============================================================
// SCENARIO PRESET TYPES
// ============================================================

/**
 * A named scenario preset used by the DevPanel to quickly load a
 * specific player state for testing and QA.
 */
export interface ScenarioPreset {
  id: string
  label: string
  description: string
  /** The screen to navigate to after loading. Defaults to 'base' if omitted. */
  targetScreen?: Screen
  /** Builds a complete PlayerSave for the given timestamp. */
  buildSave(now: number): PlayerSave
}

// ============================================================
// BASE SAVE FACTORY
// ============================================================

/**
 * Returns a complete default PlayerSave with all fields set to safe
 * zero/empty values. This mirrors createNewPlayer() from saveService
 * but accepts a timestamp parameter so presets can build deterministic saves.
 *
 * @param now - Unix timestamp (ms) used for createdAt / lastPlayedAt.
 */
export function BASE_SAVE(now: number): PlayerSave {
  return {
    version: SAVE_VERSION,
    factDbVersion: 0,
    playerId: 'dev-player',
    deviceId: 'dev-device',
    accountId: null,
    accountEmail: null,
    cloudSyncEnabled: true,
    lastCloudSyncAt: 0,
    ageRating: 'teen',
    createdAt: now,
    lastPlayedAt: now,
    domainRunCounts: {},

    // Resources
    oxygen: 3, // legacy mining field
    minerals: {
      dust: 0,
      shard: 0,
      crystal: 0,
      geode: 0,
      essence: 0,
    },

    // Knowledge
    learnedFacts: [],
    reviewStates: [],
    soldFacts: [],
    discoveredFacts: [],

    // Stats
    stats: {
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
    },

    // Streak tracking
    lastPlayDate: undefined,

    // Data Discs
    unlockedDiscs: [],

    // Crafting
    craftedItems: {},
    craftCounts: {},
    activeConsumables: [],

    // Dive insurance
    insuredDive: false,

    // Cosmetics
    ownedCosmetics: [],
    equippedCosmetic: null,

    // Daily Deals
    purchasedDeals: [],
    lastDealDate: undefined,

    // Review Rituals
    lastMorningReview: undefined,
    lastEveningReview: undefined,

    // Knowledge Store
    knowledgePoints: 0,
    purchasedKnowledgeItems: [],

    // Dome Expansion
    unlockedRooms: ['command'],

    // Premium Materials
    premiumMaterials: {},

    // Streak protection & milestones
    streakFreezes: 0,
    lastStreakMilestone: 0,
    claimedMilestones: [],
    streakProtected: false,
    titles: [],
    activeTitle: null,
    hubState: defaultHubSaveState(),

    // Interest & personalization
    interestConfig: createDefaultInterestConfig(),
    behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
    archetypeData: { detected: 'undetected', manualOverride: null, lastEvaluatedDate: null, detectedOnDay: null },
    engagementData: { dailySnapshots: [], currentScore: 50, mode: 'normal' },

    // Phase 14: Onboarding & Tutorial
    tutorialComplete: false,
    hasCompletedInitialStudy: false,
    selectedInterests: [],
    interestWeights: {},
    runCount: 0,
    tutorialStep: 0,
    studySessionsCompleted: 0,
    newCardsStudiedToday: 0,

    // Phase 59: Artifact Analyzer persistence
    pendingArtifacts: [],

    // Character progression
    totalXP: 0,
    characterLevel: 0,
    lastDailyBonusDate: null,
  }
}

// ============================================================
// HELPER — build N fake fact IDs and their review states
// ============================================================

/** Real fact IDs from the database — used by presets so study sessions actually work. */
const PRESET_FACT_IDS = [
  'cult-001', 'cult-002', 'cult-003', 'cult-004', 'cult-005',
  'cult-006', 'cult-007', 'cult-008', 'cult-009', 'cult-010',
  'geo-001', 'geo-002', 'geo-003', 'geo-004', 'geo-005',
  'lsci-001', 'lsci-002', 'lsci-003', 'lsci-004', 'lsci-005',
  'hist-001', 'hist-002', 'hist-003', 'hist-004', 'hist-005',
  'nsci-001', 'nsci-002', 'nsci-003', 'nsci-004', 'nsci-005',
]

function makeLearnedFacts(count: number, mature = false): { learnedFacts: string[]; reviewStates: ReviewState[] } {
  const learnedFacts: string[] = []
  const reviewStates: ReviewState[] = []
  const now = Date.now()
  for (let i = 0; i < count && i < PRESET_FACT_IDS.length; i++) {
    const id = PRESET_FACT_IDS[i]
    learnedFacts.push(id)
    if (mature) {
      // Create a realistic mature review state (interval > 60 = mastered)
      reviewStates.push({
        ...createReviewState(id),
        cardState: 'review',
        interval: 90 + Math.floor(Math.random() * 60),
        repetitions: 8 + Math.floor(Math.random() * 4),
        easeFactor: 2.5 + Math.random() * 0.3,
        lastReviewAt: now - 7 * 24 * 60 * 60 * 1000,
        nextReviewAt: now + 30 * 24 * 60 * 60 * 1000,
      })
    } else {
      reviewStates.push(createReviewState(id))
    }
  }
  return { learnedFacts, reviewStates }
}

// ============================================================
// SCENARIO PRESETS
// ============================================================

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  // ----------------------------------------------------------
  // 1. NEW PLAYER — fresh start, zero progress
  // ----------------------------------------------------------
  {
    id: 'new_player',
    label: 'New Player',
    description: 'Completely fresh save. Zero progress, 50 dust, only command room unlocked.',
    buildSave(now) {
      return {
        ...BASE_SAVE(now),
        minerals: { dust: 50, shard: 0, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command'],
      }
    },
  },

  // ----------------------------------------------------------
  // 2. POST TUTORIAL — just finished onboarding
  // ----------------------------------------------------------
  {
    id: 'post_tutorial',
    label: 'Post Tutorial',
    description: '5 facts learned, 180 dust, 2 shards, 1 dive completed, 2 rooms unlocked.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(5)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 180, shard: 2, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab'],
        stats: {
          totalDivesCompleted: 1,
          bestFloor: 3,
          totalFactsLearned: 5,
          totalFactsSold: 0,
          totalQuizCorrect: 8,
          totalQuizWrong: 2,
          currentStreak: 1,
          bestStreak: 1,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 3. EARLY GAME — early run progress
  // ----------------------------------------------------------
  {
    id: 'first_pet',
    label: 'Early Game',
    description: '10 facts learned, 600 dust, 15 shards, workshop unlocked.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(10)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 600, shard: 15, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        stats: {
          totalDivesCompleted: 5,
          bestFloor: 6,
          totalFactsLearned: 10,
          totalFactsSold: 0,
          totalQuizCorrect: 22,
          totalQuizWrong: 4,
          currentStreak: 3,
          bestStreak: 3,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 4. MID GAME 3 ROOMS
  // ----------------------------------------------------------
  {
    id: 'mid_game_3_rooms',
    label: 'Mid Game (3 Rooms)',
    description: '25 facts, 2400 dust, 80 shards, 15 crystals, 3 rooms, 240 KP.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(25)
      // Make first 5 review states mature for realistic mid-game data
      for (let i = 0; i < 5 && i < reviewStates.length; i++) {
        reviewStates[i] = { ...reviewStates[i], cardState: 'review', interval: 75, repetitions: 7, easeFactor: 2.6 }
      }
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 2400, shard: 80, crystal: 15, geode: 0, essence: 0 },
        knowledgePoints: 240,
        unlockedRooms: ['command', 'lab', 'workshop', 'museum'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'study', 'workshop', 'collection'], floorTiers: { starter: 1, study: 0, workshop: 0, collection: 0 } },
        stats: {
          totalDivesCompleted: 18,
          bestFloor: 10,
          totalFactsLearned: 25,
          totalFactsSold: 2,
          totalQuizCorrect: 85,
          totalQuizWrong: 15,
          currentStreak: 7,
          bestStreak: 10,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 5. ENDGAME ALL ROOMS
  // ----------------------------------------------------------
  {
    id: 'endgame_all_rooms',
    label: 'Endgame (All Rooms)',
    description: '80 facts, 18 000 dust, all rooms unlocked, 2800 KP, titles, premium materials.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(80, true)
      const allRoomIds = ["command", "lab", "workshop", "museum", "market", "archive"]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 18_000, shard: 400, crystal: 80, geode: 20, essence: 5 },
        knowledgePoints: 2800,
        unlockedRooms: allRoomIds as string[],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: [...ALL_FLOOR_IDS], floorTiers: Object.fromEntries(ALL_FLOOR_IDS.map(id => [id, 1])) },
        premiumMaterials: {
          star_dust: 12,
          void_crystal: 5,
          ancient_essence: 2,
        },
        titles: ['Centurion', 'Deep Scholar', 'Fossil Hunter'],
        activeTitle: 'Deep Scholar',
        streakFreezes: 3,
        lastStreakMilestone: 60,
        claimedMilestones: [3, 7, 14, 30, 60],
        stats: {
          totalDivesCompleted: 95,
          bestFloor: 20,
          totalFactsLearned: 80,
          totalFactsSold: 8,
          totalQuizCorrect: 520,
          totalQuizWrong: 40,
          currentStreak: 45,
          bestStreak: 60,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 6. FULL COLLECTION — all discs collected, max resources
  // ----------------------------------------------------------
  {
    id: 'full_collection',
    label: 'Full Collection',
    description: '120 facts, all discs collected, max resources, cosmetics.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(120)
      const allRoomIds = ["command", "lab", "workshop", "museum", "market", "archive"]

      const discs = Array.from({ length: 12 }, (_, i) => `disc-${String(i + 1).padStart(3, '0')}`)

      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 50_000, shard: 1500, crystal: 300, geode: 80, essence: 20 },
        knowledgePoints: 5000,
        unlockedRooms: allRoomIds as string[],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: [...ALL_FLOOR_IDS], floorTiers: Object.fromEntries(ALL_FLOOR_IDS.map(id => [id, 1])) },
        unlockedDiscs: discs,
        ownedCosmetics: ['skin_neon', 'skin_forest', 'helmet_chrome'],
        equippedCosmetic: 'skin_neon',
        premiumMaterials: {
          star_dust: 30,
          void_crystal: 15,
          ancient_essence: 8,
        },
        titles: ['Centurion', 'Deep Scholar', 'Completionist'],
        activeTitle: 'Completionist',
        streakFreezes: 3,
        lastStreakMilestone: 100,
        claimedMilestones: [3, 7, 14, 30, 60, 100],
        stats: {
          totalDivesCompleted: 300,
          bestFloor: 20,
          totalFactsLearned: 120,
          totalFactsSold: 15,
          totalQuizCorrect: 1800,
          totalQuizWrong: 90,
          currentStreak: 100,
          bestStreak: 100,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 7. EMPTY INVENTORY — scarcity / stressed state test
  // ----------------------------------------------------------
  {
    id: 'empty_inventory',
    label: 'Empty Inventory',
    description: '40 facts learned but 0 oxygen tanks, 0 minerals — tests scarcity UI states.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(40)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        oxygen: 0,
        minerals: { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 },
        knowledgePoints: 180,
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        stats: {
          totalDivesCompleted: 32,
          bestFloor: 12,
          totalFactsLearned: 40,
          totalFactsSold: 5,
          totalQuizCorrect: 200,
          totalQuizWrong: 30,
          currentStreak: 0,
          bestStreak: 14,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 8. MAX STREAK — 100-day streak, all milestones claimed
  // ----------------------------------------------------------
  {
    id: 'max_streak',
    label: 'Max Streak',
    description: '100-day streak, all milestones claimed, all rooms unlocked.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(90)
      const allRoomIds = ["command", "lab", "workshop", "museum", "market", "archive"]
      // ISO date string for yesterday so streak is "active" but not yet completed today
      const yesterday = new Date(now - 86_400_000).toISOString().split('T')[0]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 22_000, shard: 500, crystal: 100, geode: 25, essence: 6 },
        knowledgePoints: 3200,
        unlockedRooms: allRoomIds as string[],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: [...ALL_FLOOR_IDS], floorTiers: Object.fromEntries(ALL_FLOOR_IDS.map(id => [id, 1])) },
        lastPlayDate: yesterday,
        titles: ['Centurion', 'Deep Scholar'],
        activeTitle: 'Centurion',
        streakFreezes: 3,
        lastStreakMilestone: 100,
        claimedMilestones: [3, 7, 14, 30, 60, 100],
        streakProtected: false,
        stats: {
          totalDivesCompleted: 100,
          bestFloor: 20,
          totalFactsLearned: 90,
          totalFactsSold: 10,
          totalQuizCorrect: 700,
          totalQuizWrong: 50,
          currentStreak: 100,
          bestStreak: 100,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 9. EARLY RUN — 4 runs completed, 8 facts, small reserves
  // ----------------------------------------------------------
  {
    id: 'first_fossil_found',
    label: 'Early Run',
    description: '4 runs completed, 8 facts, 350 dust.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(8)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 350, shard: 8, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab'],
        stats: {
          totalDivesCompleted: 4,
          bestFloor: 5,
          totalFactsLearned: 8,
          totalFactsSold: 0,
          totalQuizCorrect: 18,
          totalQuizWrong: 3,
          currentStreak: 2,
          bestStreak: 2,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },
  // ----------------------------------------------------------
  // 10. MID DIVE — mid-game player with active companion
  // ----------------------------------------------------------
  {
    id: 'mid_dive',
    label: 'Mid Dive',
    description: 'Mid-game player with active companion, 15 facts, good mineral reserves.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(15)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 800, shard: 25, crystal: 3, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        tutorialComplete: true,
        runCount: 8,
        stats: {
          totalDivesCompleted: 8,
          bestFloor: 8,
          totalFactsLearned: 15,
          totalFactsSold: 0,
          totalQuizCorrect: 35,
          totalQuizWrong: 5,
          currentStreak: 4,
          bestStreak: 6,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 11. QUIZ DUE — facts with overdue reviews
  // ----------------------------------------------------------
  {
    id: 'quiz_due',
    label: 'Quiz Due',
    description: '30 facts with overdue reviews — tests quiz prompts and study screen.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(30)
      // Make all reviews overdue by setting nextReviewAt to 1 day ago
      for (const state of reviewStates) {
        state.cardState = 'review'
        state.nextReviewAt = now - 86_400_000
        state.interval = 1
      }
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 1500, shard: 50, crystal: 10, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        tutorialComplete: true,
        runCount: 15,
        stats: {
          totalDivesCompleted: 15,
          bestFloor: 10,
          totalFactsLearned: 30,
          totalFactsSold: 0,
          totalQuizCorrect: 80,
          totalQuizWrong: 10,
          currentStreak: 5,
          bestStreak: 8,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 12. RICH PLAYER — max resources for testing purchases/crafting
  // ----------------------------------------------------------
  {
    id: 'rich_player',
    label: 'Rich Player',
    description: 'Max resources for testing crafting, purchases, and store UI.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(50)
      const allRoomIds = ["command", "lab", "workshop", "museum", "market", "archive"]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 99_999, shard: 5000, crystal: 500, geode: 100, essence: 20 },
        knowledgePoints: 10_000,
        unlockedRooms: allRoomIds as string[],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: [...ALL_FLOOR_IDS], floorTiers: Object.fromEntries(ALL_FLOOR_IDS.map(id => [id, 1])) },
        premiumMaterials: {
          star_dust: 50,
          void_crystal: 25,
          ancient_essence: 15,
        },
        tutorialComplete: true,
        runCount: 50,
        stats: {
          totalDivesCompleted: 50,
          bestFloor: 20,
          totalFactsLearned: 50,
          totalFactsSold: 5,
          totalQuizCorrect: 350,
          totalQuizWrong: 20,
          currentStreak: 20,
          bestStreak: 30,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 13. FIRST BOOT — absolute fresh state, tests onboarding
  // ----------------------------------------------------------
  {
    id: 'first_boot',
    label: 'First Boot',
    description: 'Absolute first boot — tests onboarding, age gate, tutorial.',
    buildSave(now) {
      return {
        ...BASE_SAVE(now),
        tutorialComplete: false,
        runCount: 0,
        oxygen: 0,
        minerals: { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 },
      }
    },
  },

  // ----------------------------------------------------------
  // 14. WORKSHOP UNLOCKED — workshop just unlocked, early game
  // ----------------------------------------------------------
  {
    id: 'workshop_unlocked',
    label: 'Workshop Just Unlocked',
    description: '3 dives, 3 rooms unlocked, 450 dust, 12 shards, 8 facts. Workshop just accessible.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(8)
      const yesterday = new Date(now - 86_400_000).toISOString().split('T')[0]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 450, shard: 12, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        tutorialComplete: true,
        runCount: 3,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        lastPlayDate: yesterday,
        stats: {
          totalDivesCompleted: 3,
          bestFloor: 5,
          totalFactsLearned: 8,
          totalFactsSold: 0,
          totalQuizCorrect: 16,
          totalQuizWrong: 3,
          currentStreak: 2,
          bestStreak: 2,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 15. MID DIVE ACTIVE — about to start dive (DivePrepScreen)
  // ----------------------------------------------------------
  {
    id: 'mid_dive_active',
    label: 'Mid Dive Active (Dive Prep)',
    description: 'Mid-game player ready to start a dive. Targets DivePrepScreen.',
    targetScreen: 'divePrepScreen' as Screen,
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(15)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 800, shard: 25, crystal: 3, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        tutorialComplete: true,
        runCount: 8,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalDivesCompleted: 8,
          bestFloor: 8,
          totalFactsLearned: 15,
          totalFactsSold: 0,
          totalQuizCorrect: 35,
          totalQuizWrong: 5,
          currentStreak: 4,
          bestStreak: 6,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 16. FIVE ROOMS — 5 rooms unlocked, mid-game
  // ----------------------------------------------------------
  {
    id: 'five_rooms',
    label: '5 Rooms',
    description: '20 runs, 40 facts, 5 rooms unlocked, streak 12.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(40)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 5000, shard: 150, crystal: 30, geode: 5, essence: 0 },
        knowledgePoints: 800,
        unlockedRooms: ['command', 'lab', 'workshop', 'museum', 'zoo'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'study', 'workshop', 'zoo', 'collection'], floorTiers: { starter: 1, study: 0, workshop: 1, zoo: 0, collection: 0 } },
        streakFreezes: 1,
        tutorialComplete: true,
        runCount: 20,
        selectedInterests: ['Natural Sciences', 'History'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalDivesCompleted: 20,
          bestFloor: 12,
          totalFactsLearned: 40,
          totalFactsSold: 3,
          totalQuizCorrect: 140,
          totalQuizWrong: 20,
          currentStreak: 12,
          bestStreak: 15,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 17. STREAK ABOUT TO BREAK — streak at risk, no freezes
  // ----------------------------------------------------------
  {
    id: 'streak_about_to_break',
    label: 'Streak at Risk',
    description: '14-day streak, last dive 2 days ago, 0 freezes — streak about to break!',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(25)
      const twoDaysAgo = new Date(now - 2 * 86_400_000).toISOString().split('T')[0]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 1200, shard: 40, crystal: 5, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        lastPlayDate: twoDaysAgo,
        streakFreezes: 0,
        tutorialComplete: true,
        runCount: 12,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalDivesCompleted: 12,
          bestFloor: 8,
          totalFactsLearned: 25,
          totalFactsSold: 1,
          totalQuizCorrect: 60,
          totalQuizWrong: 8,
          currentStreak: 14,
          bestStreak: 14,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 18. DIVE RESULTS — just finished a dive (results screen)
  // ----------------------------------------------------------
  {
    id: 'dive_results',
    label: 'Dive Results Screen',
    description: '3 dives done, just finished a dive. Targets diveResults screen.',
    targetScreen: 'diveResults' as Screen,
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(5)
      const today = new Date(now).toISOString().split('T')[0]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 320, shard: 8, crystal: 1, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab'],
        lastPlayDate: today,
        lastDiveBiome: 'limestone_caves',
        tutorialComplete: true,
        runCount: 3,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalDivesCompleted: 3,
          bestFloor: 4,
          totalFactsLearned: 5,
          totalFactsSold: 0,
          totalQuizCorrect: 10,
          totalQuizWrong: 2,
          currentStreak: 2,
          bestStreak: 2,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 19. MANY REVIEWS DUE — heavy review load, all overdue
  // ----------------------------------------------------------
  {
    id: 'many_reviews_due',
    label: 'Many Reviews Due',
    description: '50 facts, ALL overdue by 2 days. Tests heavy review load.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(50)
      // Make all reviews overdue by 2 days with non-trivial interval/repetitions
      for (const state of reviewStates) {
        state.cardState = 'review'
        state.nextReviewAt = now - 2 * 86_400_000
        state.interval = 3
        state.repetitions = 2
      }
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 3000, shard: 80, crystal: 15, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop', 'museum'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'study', 'workshop', 'collection'], floorTiers: { starter: 1, study: 0, workshop: 0, collection: 0 } },
        tutorialComplete: true,
        runCount: 25,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalDivesCompleted: 25,
          bestFloor: 12,
          totalFactsLearned: 50,
          totalFactsSold: 2,
          totalQuizCorrect: 200,
          totalQuizWrong: 25,
          currentStreak: 8,
          bestStreak: 12,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 20. JUST CRAFTED — has crafted items and consumables active
  // ----------------------------------------------------------
  {
    id: 'just_crafted',
    label: 'Just Crafted',
    description: '15 dives, reinforced_tank crafted, bomb_kit active consumable.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(20)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 800, shard: 30, crystal: 5, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        craftedItems: { reinforced_tank: 1 },
        craftCounts: { reinforced_tank: 1 },
        activeConsumables: ['bomb_kit'],
        tutorialComplete: true,
        runCount: 15,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalDivesCompleted: 15,
          bestFloor: 10,
          totalFactsLearned: 20,
          totalFactsSold: 1,
          totalQuizCorrect: 55,
          totalQuizWrong: 8,
          currentStreak: 5,
          bestStreak: 7,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 21. HAS PENDING ARTIFACTS — mid-game with 3 pending artifacts
  // ----------------------------------------------------------
  {
    id: 'has_pending_artifacts',
    label: 'Has Pending Artifacts',
    description: 'Mid-game player with 3 pending artifacts (common, uncommon, rare)',
    targetScreen: 'base' as const,
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(15)
      const pendingArtifacts: PendingArtifact[] = [
        { factId: 'cult-001', rarity: 'common', discoveredAt: now - 600_000 },
        { factId: 'geo-002', rarity: 'uncommon', discoveredAt: now - 400_000 },
        { factId: 'hist-003', rarity: 'rare', discoveredAt: now - 200_000 },
      ]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 1200, shard: 35, crystal: 5, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        tutorialComplete: true,
        runCount: 10,
        pendingArtifacts,
        stats: {
          totalDivesCompleted: 10,
          bestFloor: 8,
          totalFactsLearned: 15,
          totalFactsSold: 0,
          totalQuizCorrect: 40,
          totalQuizWrong: 6,
          currentStreak: 5,
          bestStreak: 7,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 22. ALL FLOORS UNLOCKED — endgame with all dome floors
  // ----------------------------------------------------------
  {
    id: 'all_floors_unlocked',
    label: 'All Floors Unlocked',
    description: 'Endgame player with all dome floors unlocked',
    targetScreen: 'base' as const,
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(30, true)
      const allRoomIds = ["command", "lab", "workshop", "museum", "market", "archive"]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 12_000, shard: 300, crystal: 60, geode: 15, essence: 3 },
        knowledgePoints: 2000,
        unlockedRooms: allRoomIds as string[],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: [...ALL_FLOOR_IDS], floorTiers: Object.fromEntries(ALL_FLOOR_IDS.map(id => [id, 1])) },
        tutorialComplete: true,
        runCount: 70,
        titles: ['Explorer', 'Scholar'],
        activeTitle: 'Explorer',
        stats: {
          totalDivesCompleted: 70,
          bestFloor: 18,
          totalFactsLearned: 60,
          totalFactsSold: 5,
          totalQuizCorrect: 400,
          totalQuizWrong: 30,
          currentStreak: 25,
          bestStreak: 35,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 23. STREAK JUST CLAIMED — 14-day streak with milestones claimed
  // ----------------------------------------------------------
  {
    id: 'streak_just_claimed',
    label: 'Streak Just Claimed',
    description: '14-day streak with 3-Day and 7-Day milestones already claimed',
    targetScreen: 'base' as const,
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(20)
      const yesterday = new Date(now - 86_400_000).toISOString().split('T')[0]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 2000, shard: 60, crystal: 10, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'workshop'], floorTiers: { starter: 0, workshop: 0 } },
        tutorialComplete: true,
        runCount: 14,
        lastPlayDate: yesterday,
        claimedMilestones: [3, 7],
        titles: ['Explorer'],
        activeTitle: 'Explorer',
        streakFreezes: 1,
        stats: {
          totalDivesCompleted: 14,
          bestFloor: 9,
          totalFactsLearned: 20,
          totalFactsSold: 1,
          totalQuizCorrect: 70,
          totalQuizWrong: 10,
          currentStreak: 14,
          bestStreak: 14,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 24. HEAVY REVIEW OVERDUE — 100 facts, all 7+ days overdue
  // ----------------------------------------------------------
  {
    id: 'heavy_review_overdue',
    label: 'Heavy Review Overdue',
    description: '100 learned facts, ALL overdue by 7+ days',
    targetScreen: 'base' as const,
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(30)
      // Generate 70 synthetic fact IDs to reach 100 total
      for (let i = 1; i <= 70; i++) {
        const id = `synth-fact-${String(i).padStart(3, '0')}`
        learnedFacts.push(id)
        reviewStates.push(createReviewState(id))
      }
      // Make ALL review states 7 days overdue
      const sevenDaysAgo = now - 7 * 86_400_000
      for (const state of reviewStates) {
        state.cardState = 'review'
        state.nextReviewAt = sevenDaysAgo
        state.interval = 5
        state.repetitions = 3
      }
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 5000, shard: 120, crystal: 20, geode: 3, essence: 0 },
        knowledgePoints: 1500,
        unlockedRooms: ['command', 'lab', 'workshop', 'museum', 'market'],
        hubState: { ...defaultHubSaveState(), unlockedFloorIds: ['starter', 'study', 'farm', 'workshop', 'collection', 'market'], floorTiers: { starter: 1, study: 0, farm: 0, workshop: 0, collection: 0, market: 0 } },
        tutorialComplete: true,
        runCount: 45,
        stats: {
          totalDivesCompleted: 45,
          bestFloor: 15,
          totalFactsLearned: 100,
          totalFactsSold: 5,
          totalQuizCorrect: 350,
          totalQuizWrong: 40,
          currentStreak: 0,
          bestStreak: 20,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },

  // ----------------------------------------------------------
  // 25. FIRST DIVE RETURNING — first-time player back from dive
  // ----------------------------------------------------------
  {
    id: 'first_dive_returning',
    label: 'First Dive Returning',
    description: 'First-time player returning from dive with 1 pending artifact',
    targetScreen: 'base' as const,
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(2)
      const today = new Date(now).toISOString().split('T')[0]
      const pendingArtifacts: PendingArtifact[] = [
        { factId: 'cult-003', rarity: 'common', discoveredAt: now - 300_000 },
      ]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 120, shard: 3, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab'],
        tutorialComplete: true,
        runCount: 1,
        lastPlayDate: today,
        pendingArtifacts,
        stats: {
          totalDivesCompleted: 1,
          bestFloor: 3,
          totalFactsLearned: 2,
          totalFactsSold: 0,
          totalQuizCorrect: 4,
          totalQuizWrong: 1,
          currentStreak: 1,
          bestStreak: 1,
          totalSessions: 0,
          zeroDiveSessions: 0,
        },
      }
    },
  },
] as const
