import type { PlayerSave } from '../data/types'
import { BALANCE } from '../data/balance'
import { FOSSIL_SPECIES } from '../data/fossils'
import { defaultHubSaveState } from '../data/hubLayout'
import { createReviewState } from '../services/sm2'
import { SAVE_VERSION } from '../services/saveService'
import { createDefaultInterestConfig } from '../data/interestConfig'

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
  targetScreen?: string
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
    ageRating: 'teen',
    createdAt: now,
    lastPlayedAt: now,

    // Resources
    oxygen: BALANCE.STARTING_OXYGEN_TANKS,
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

    // Stats
    stats: {
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
    },

    // Streak tracking
    lastDiveDate: undefined,

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

    // Fossil collection
    fossils: {},

    // Companion
    activeCompanion: null,

    // Review Rituals
    lastMorningReview: undefined,
    lastEveningReview: undefined,

    // Knowledge Store
    knowledgePoints: 0,
    purchasedKnowledgeItems: [],

    // Dome Expansion
    unlockedRooms: ['command'],

    // Farm
    farm: {
      slots: [null, null, null],
      maxSlots: 3,
    },

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
    selectedInterests: [],
    interestWeights: {},
    diveCount: 0,
    tutorialStep: 0,
    activeFossil: null,
    studySessionsCompleted: 0,
  }
}

// ============================================================
// HELPER — build N fake fact IDs and their review states
// ============================================================

/**
 * Generates `count` synthetic fact IDs (e.g. "fact-001") and matching
 * initial ReviewState entries. Used by presets to simulate learned facts
 * without requiring actual DB content to exist.
 */
function makeLearnedFacts(count: number): { learnedFacts: string[]; reviewStates: ReturnType<typeof createReviewState>[] } {
  const learnedFacts: string[] = []
  const reviewStates = []
  for (let i = 1; i <= count; i++) {
    const id = `fact-${String(i).padStart(3, '0')}`
    learnedFacts.push(id)
    reviewStates.push(createReviewState(id))
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
          totalBlocksMined: 120,
          totalDivesCompleted: 1,
          deepestLayerReached: 3,
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
  // 3. FIRST PET — trilobite revived as first companion
  // ----------------------------------------------------------
  {
    id: 'first_pet',
    label: 'First Pet',
    description: 'First fossil species (trilobite) revived. 10 facts, 600 dust, 15 shards, companion active.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(10)
      const trilobiteSpecies = FOSSIL_SPECIES.find(s => s.id === 'trilobite')!
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 600, shard: 15, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        fossils: {
          trilobite: {
            speciesId: 'trilobite',
            fragmentsFound: trilobiteSpecies.fragmentsNeeded,
            fragmentsNeeded: trilobiteSpecies.fragmentsNeeded,
            revived: true,
            revivedAt: now - 3600_000,
          },
        },
        activeCompanion: 'trilobite',
        stats: {
          totalBlocksMined: 450,
          totalDivesCompleted: 5,
          deepestLayerReached: 6,
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
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 2400, shard: 80, crystal: 15, geode: 0, essence: 0 },
        knowledgePoints: 240,
        unlockedRooms: ['command', 'lab', 'workshop', 'museum'],
        stats: {
          totalBlocksMined: 1800,
          totalDivesCompleted: 18,
          deepestLayerReached: 10,
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
      const { learnedFacts, reviewStates } = makeLearnedFacts(80)
      const allRoomIds = BALANCE.DOME_ROOMS.map(r => r.id)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 18_000, shard: 400, crystal: 80, geode: 20, essence: 5 },
        knowledgePoints: 2800,
        unlockedRooms: allRoomIds as string[],
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
          totalBlocksMined: 12_000,
          totalDivesCompleted: 95,
          deepestLayerReached: 20,
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
  // 6. FULL COLLECTION — every fossil revived, all discs, max resources
  // ----------------------------------------------------------
  {
    id: 'full_collection',
    label: 'Full Collection',
    description: 'All fossils revived, 120 facts, all discs collected, max resources, cosmetics.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(120)
      const allRoomIds = BALANCE.DOME_ROOMS.map(r => r.id)

      const fossils: PlayerSave['fossils'] = {}
      for (const species of FOSSIL_SPECIES) {
        fossils[species.id] = {
          speciesId: species.id,
          fragmentsFound: species.fragmentsNeeded,
          fragmentsNeeded: species.fragmentsNeeded,
          revived: true,
          revivedAt: now - 7 * 24 * 3600_000,
        }
      }

      const discs = Array.from({ length: 12 }, (_, i) => `disc-${String(i + 1).padStart(3, '0')}`)

      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 50_000, shard: 1500, crystal: 300, geode: 80, essence: 20 },
        knowledgePoints: 5000,
        unlockedRooms: allRoomIds as string[],
        unlockedDiscs: discs,
        fossils,
        activeCompanion: 'trex',
        ownedCosmetics: ['skin_neon', 'skin_forest', 'helmet_chrome'],
        equippedCosmetic: 'skin_neon',
        premiumMaterials: {
          star_dust: 30,
          void_crystal: 15,
          ancient_essence: 8,
        },
        titles: ['Centurion', 'Deep Scholar', 'Fossil Hunter', 'Completionist'],
        activeTitle: 'Completionist',
        streakFreezes: 3,
        lastStreakMilestone: 100,
        claimedMilestones: [3, 7, 14, 30, 60, 100],
        stats: {
          totalBlocksMined: 40_000,
          totalDivesCompleted: 300,
          deepestLayerReached: 20,
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
        stats: {
          totalBlocksMined: 3000,
          totalDivesCompleted: 32,
          deepestLayerReached: 12,
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
      const allRoomIds = BALANCE.DOME_ROOMS.map(r => r.id)
      // ISO date string for yesterday so streak is "active" but not yet completed today
      const yesterday = new Date(now - 86_400_000).toISOString().split('T')[0]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 22_000, shard: 500, crystal: 100, geode: 25, essence: 6 },
        knowledgePoints: 3200,
        unlockedRooms: allRoomIds as string[],
        lastDiveDate: yesterday,
        titles: ['Centurion', 'Deep Scholar'],
        activeTitle: 'Centurion',
        streakFreezes: 3,
        lastStreakMilestone: 100,
        claimedMilestones: [3, 7, 14, 30, 60, 100],
        streakProtected: false,
        stats: {
          totalBlocksMined: 15_000,
          totalDivesCompleted: 100,
          deepestLayerReached: 20,
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
  // 9. FIRST FOSSIL FOUND — 1 fragment found, not yet revived
  // ----------------------------------------------------------
  {
    id: 'first_fossil_found',
    label: 'First Fossil Found',
    description: '1 trilobite fragment found (not yet revived), 8 facts, 350 dust.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(8)
      const trilobiteSpecies = FOSSIL_SPECIES.find(s => s.id === 'trilobite')!
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 350, shard: 8, crystal: 0, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab'],
        fossils: {
          trilobite: {
            speciesId: 'trilobite',
            fragmentsFound: 1,
            fragmentsNeeded: trilobiteSpecies.fragmentsNeeded,
            revived: false,
          },
        },
        activeCompanion: null,
        stats: {
          totalBlocksMined: 300,
          totalDivesCompleted: 4,
          deepestLayerReached: 5,
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
      const trilobiteSpecies = FOSSIL_SPECIES.find(s => s.id === 'trilobite')!
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 800, shard: 25, crystal: 3, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        fossils: {
          trilobite: {
            speciesId: 'trilobite',
            fragmentsFound: trilobiteSpecies.fragmentsNeeded,
            fragmentsNeeded: trilobiteSpecies.fragmentsNeeded,
            revived: true,
            revivedAt: now - 7 * 24 * 3600_000,
          },
        },
        activeCompanion: 'trilobite',
        tutorialComplete: true,
        diveCount: 8,
        stats: {
          totalBlocksMined: 600,
          totalDivesCompleted: 8,
          deepestLayerReached: 8,
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
        state.nextReviewAt = now - 86_400_000
        state.interval = 1
      }
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 1500, shard: 50, crystal: 10, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        tutorialComplete: true,
        diveCount: 15,
        stats: {
          totalBlocksMined: 1200,
          totalDivesCompleted: 15,
          deepestLayerReached: 10,
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
      const allRoomIds = BALANCE.DOME_ROOMS.map(r => r.id)
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 99_999, shard: 5000, crystal: 500, geode: 100, essence: 20 },
        knowledgePoints: 10_000,
        unlockedRooms: allRoomIds as string[],
        premiumMaterials: {
          star_dust: 50,
          void_crystal: 25,
          ancient_essence: 15,
        },
        tutorialComplete: true,
        diveCount: 50,
        stats: {
          totalBlocksMined: 20_000,
          totalDivesCompleted: 50,
          deepestLayerReached: 20,
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
        diveCount: 0,
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
        tutorialComplete: true,
        diveCount: 3,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        lastDiveDate: yesterday,
        stats: {
          totalBlocksMined: 200,
          totalDivesCompleted: 3,
          deepestLayerReached: 5,
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
    targetScreen: 'divePrepScreen',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(15)
      const trilobiteSpecies = FOSSIL_SPECIES.find(s => s.id === 'trilobite')!
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 800, shard: 25, crystal: 3, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab', 'workshop'],
        fossils: {
          trilobite: {
            speciesId: 'trilobite',
            fragmentsFound: trilobiteSpecies.fragmentsNeeded,
            fragmentsNeeded: trilobiteSpecies.fragmentsNeeded,
            revived: true,
            revivedAt: now - 7 * 24 * 3600_000,
          },
        },
        activeCompanion: 'trilobite',
        tutorialComplete: true,
        diveCount: 8,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalBlocksMined: 600,
          totalDivesCompleted: 8,
          deepestLayerReached: 8,
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
  // 16. FIVE ROOMS — 5 rooms unlocked, active farm
  // ----------------------------------------------------------
  {
    id: 'five_rooms',
    label: '5 Rooms + Active Farm',
    description: '20 dives, 40 facts, 6 rooms, trilobite on farm, ammonite partial, streak 12.',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(40)
      const trilobiteSpecies = FOSSIL_SPECIES.find(s => s.id === 'trilobite')!
      const ammoniteSpecies = FOSSIL_SPECIES.find(s => s.id === 'ammonite')!
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 5000, shard: 150, crystal: 30, geode: 5, essence: 0 },
        knowledgePoints: 800,
        unlockedRooms: ['command', 'lab', 'workshop', 'museum', 'farm', 'zoo'],
        fossils: {
          trilobite: {
            speciesId: 'trilobite',
            fragmentsFound: trilobiteSpecies.fragmentsNeeded,
            fragmentsNeeded: trilobiteSpecies.fragmentsNeeded,
            revived: true,
            revivedAt: now - 14 * 24 * 3600_000,
          },
          ammonite: {
            speciesId: 'ammonite',
            fragmentsFound: Math.min(2, ammoniteSpecies.fragmentsNeeded),
            fragmentsNeeded: ammoniteSpecies.fragmentsNeeded,
            revived: false,
          },
        },
        activeCompanion: 'trilobite',
        farm: {
          slots: [
            { speciesId: 'trilobite', placedAt: now - 3 * 24 * 3600_000, lastCollectedAt: now - 2 * 3600_000 },
            null,
            null,
          ],
          maxSlots: 3,
        },
        streakFreezes: 1,
        tutorialComplete: true,
        diveCount: 20,
        selectedInterests: ['Natural Sciences', 'History'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalBlocksMined: 3500,
          totalDivesCompleted: 20,
          deepestLayerReached: 12,
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
        lastDiveDate: twoDaysAgo,
        streakFreezes: 0,
        tutorialComplete: true,
        diveCount: 12,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalBlocksMined: 1000,
          totalDivesCompleted: 12,
          deepestLayerReached: 8,
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
    targetScreen: 'diveResults',
    buildSave(now) {
      const { learnedFacts, reviewStates } = makeLearnedFacts(5)
      const today = new Date(now).toISOString().split('T')[0]
      return {
        ...BASE_SAVE(now),
        learnedFacts,
        reviewStates,
        minerals: { dust: 320, shard: 8, crystal: 1, geode: 0, essence: 0 },
        unlockedRooms: ['command', 'lab'],
        lastDiveDate: today,
        lastDiveBiome: 'limestone_caves',
        tutorialComplete: true,
        diveCount: 3,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalBlocksMined: 250,
          totalDivesCompleted: 3,
          deepestLayerReached: 4,
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
        tutorialComplete: true,
        diveCount: 25,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalBlocksMined: 4000,
          totalDivesCompleted: 25,
          deepestLayerReached: 12,
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
        craftedItems: { reinforced_tank: 1 },
        craftCounts: { reinforced_tank: 1 },
        activeConsumables: ['bomb_kit'],
        tutorialComplete: true,
        diveCount: 15,
        selectedInterests: ['Generalist'],
        ownedPickaxes: ['standard_pick'],
        stats: {
          totalBlocksMined: 1500,
          totalDivesCompleted: 15,
          deepestLayerReached: 10,
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
] as const
