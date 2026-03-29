import { describe, it, expect } from 'vitest'
import { getActivationCap, getActivationSlotsUsed } from '../../src/ui/stores/playerData'
import { BALANCE } from '../../src/data/balance'
import type { PlayerSave, ReviewState } from '../../src/data/types'
import { createReviewState } from '../../src/services/sm2'

function makeMinimalSave(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return {
    version: 1,
    factDbVersion: 0,
    playerId: 'test',
    ageRating: 'adult',
    createdAt: 0,
    lastPlayedAt: 0,
    oxygen: 3,
    minerals: { greyMatter: 0 },
    learnedFacts: [],
    reviewStates: [],
    soldFacts: [],
    discoveredFacts: [],
    stats: { totalFactsLearned: 0, totalDives: 0, totalBlocksMined: 0, currentStreak: 0, longestStreak: 0, totalQuizCorrect: 0, totalQuizAttempts: 0, totalArtifactsFound: 0, deepestLayer: 0, totalDustCollected: 0, totalShardsCollected: 0, totalCrystalsCollected: 0, highScoreDive: 0 },
    craftedItems: {},
    craftCounts: {},
    activeConsumables: [],
    unlockedDiscs: [],
    insuredDive: false,
    ownedCosmetics: [],
    equippedCosmetic: null,
    purchasedDeals: [],
    fossils: {},
    activeCompanion: null,
    knowledgePoints: 0,
    purchasedKnowledgeItems: [],
    unlockedRooms: ['command'],
    farm: { slots: [null, null, null], maxSlots: 3 } as any,
    premiumMaterials: {},
    streakFreezes: 0,
    lastStreakMilestone: 0,
    claimedMilestones: [],
    streakProtected: false,
    titles: [],
    activeTitle: null,
    hubState: {} as any,
    interestConfig: {} as any,
    behavioralSignals: { perCategory: {}, lastRecalcDives: 0 },
    archetypeData: {} as any,
    engagementData: {} as any,
    tutorialComplete: false,
    hasCompletedInitialStudy: false,
    selectedInterests: [],
    interestWeights: {},
    diveCount: 0,
    tutorialStep: 0,
    activeFossil: null,
    studySessionsCompleted: 0,
    ...overrides,
  } as PlayerSave
}

describe('getActivationCap', () => {
  it('returns base cap with no mastered cards', () => {
    const ps = makeMinimalSave()
    expect(getActivationCap(ps)).toBe(BALANCE.ACTIVATION_CAP_BASE)
  })

  it('increases by 1 per 5 mastered cards', () => {
    const mastered: ReviewState[] = Array.from({ length: 10 }, (_, i) => ({
      ...createReviewState(`f${i}`),
      cardState: 'review' as const,
      interval: 100, // well above mastery threshold
    }))
    const ps = makeMinimalSave({ reviewStates: mastered })
    expect(getActivationCap(ps)).toBe(BALANCE.ACTIVATION_CAP_BASE + 2) // 10/5 = 2
  })

  it('caps at ACTIVATION_CAP_MAX', () => {
    const mastered: ReviewState[] = Array.from({ length: 200 }, (_, i) => ({
      ...createReviewState(`f${i}`),
      cardState: 'review' as const,
      interval: 100,
    }))
    const ps = makeMinimalSave({ reviewStates: mastered })
    expect(getActivationCap(ps)).toBe(BALANCE.ACTIVATION_CAP_MAX)
  })
})

describe('getActivationSlotsUsed', () => {
  it('counts new and learning cards', () => {
    const states: ReviewState[] = [
      { ...createReviewState('f1'), cardState: 'new' },
      { ...createReviewState('f2'), cardState: 'learning' },
      { ...createReviewState('f3'), cardState: 'review' },
      { ...createReviewState('f4'), cardState: 'relearning' },
    ]
    const ps = makeMinimalSave({ reviewStates: states })
    expect(getActivationSlotsUsed(ps)).toBe(2) // new + learning
  })

  it('returns 0 with no cards', () => {
    expect(getActivationSlotsUsed(makeMinimalSave())).toBe(0)
  })
})
