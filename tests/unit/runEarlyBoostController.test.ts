import { describe, expect, it } from 'vitest'
import type { PlayerSave, ReviewState } from '../../src/data/types'
import {
  applyStabilityBonusToFacts,
  EARLY_BOOST_RUN_LIMIT,
  getRunNumberForDomain,
  incrementDomainRunCount,
  isEarlyBoostActiveForDomain,
} from '../../src/services/runEarlyBoostController'

function makeSave(): PlayerSave {
  return {
    version: 2,
    factDbVersion: 0,
    playerId: 'player_1',
    deviceId: 'device_1',
    accountId: null,
    accountEmail: null,
    cloudSyncEnabled: true,
    lastCloudSyncAt: 0,
    ageRating: 'teen',
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    domainRunCounts: {},
    oxygen: 3,
    minerals: { greyMatter: 0 },
    learnedFacts: [],
    reviewStates: [],
    soldFacts: [],
    discoveredFacts: [],
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
    unlockedDiscs: [],
    craftedItems: {},
    craftCounts: {},
    activeConsumables: [],
    insuredDive: false,
    ownedCosmetics: [],
    equippedCosmetic: null,
    purchasedDeals: [],
    fossils: {},
    activeCompanion: null,
    knowledgePoints: 0,
    purchasedKnowledgeItems: [],
    unlockedRooms: ['command'],
    farm: { slots: [null, null, null], maxSlots: 3 },
    premiumMaterials: {},
    streakFreezes: 0,
    lastStreakMilestone: 0,
    claimedMilestones: [],
    streakProtected: false,
    titles: [],
    activeTitle: null,
    hubState: {
      unlockedFloorIds: ['starter'],
      activeWallpapers: {},
      floorTiers: { starter: 0 },
      lastBriefingDate: null,
    },
    interestConfig: {
      selectedInterests: [],
      categoryWeights: {},
      languageMode: 'normal',
      hiddenCategories: [],
      uiPacing: 'normal',
      gaiaVerbosity: 'normal',
      suggestiveNudgesEnabled: false,
      behavioralLearningEnabled: false,
      adaptiveDifficultyEnabled: false,
    },
    behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
    archetypeData: { detected: 'undetected', manualOverride: null, lastEvaluatedDate: null, detectedOnDay: null },
    engagementData: { dailySnapshots: [], currentScore: 50, mode: 'normal' },
    tutorialComplete: false,
    hasCompletedInitialStudy: false,
    selectedInterests: [],
    interestWeights: {},
    diveCount: 0,
    tutorialStep: 0,
    activeFossil: null,
    studySessionsCompleted: 0,
    newCardsStudiedToday: 0,
    pendingArtifacts: [],
  }
}

function makeReviewState(factId: string, stability: number): ReviewState {
  return {
    factId,
    cardState: 'review',
    easeFactor: 2.5,
    interval: Math.max(1, Math.floor(stability)),
    repetitions: 3,
    nextReviewAt: Date.now() + 86400000,
    lastReviewAt: Date.now() - 86400000,
    quality: 4,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
    stability,
    consecutiveCorrect: 2,
    passedMasteryTrial: false,
    retrievability: 0.9,
    difficulty: 5,
    due: Date.now() + 86400000,
    lastReview: Date.now() - 86400000,
    reps: 3,
    lapses: 0,
    state: 'review',
    lastVariantIndex: 0,
    totalAttempts: 3,
    totalCorrect: 2,
    averageResponseTimeMs: 1300,
    tierHistory: [],
  }
}

describe('runEarlyBoostController', () => {
  it('tracks domain run numbers and early boost window', () => {
    let save = makeSave()
    expect(getRunNumberForDomain(save, 'science')).toBe(1)
    expect(isEarlyBoostActiveForDomain(save, 'science')).toBe(true)

    for (let i = 0; i < EARLY_BOOST_RUN_LIMIT; i++) {
      save = incrementDomainRunCount(save, 'science')
    }

    expect(getRunNumberForDomain(save, 'science')).toBe(EARLY_BOOST_RUN_LIMIT + 1)
    expect(isEarlyBoostActiveForDomain(save, 'science')).toBe(false)
  })

  it('applies flat stability bonus to matching fact ids', () => {
    const states = [
      makeReviewState('a', 3),
      makeReviewState('b', 5),
    ]
    const next = applyStabilityBonusToFacts(states, ['b'], 2)
    expect(next.find((state) => state.factId === 'a')?.stability).toBe(3)
    expect(next.find((state) => state.factId === 'b')?.stability).toBe(7)
  })
})
