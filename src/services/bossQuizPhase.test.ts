// === Boss Quiz Phase Tests (AR-59.7) ===

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkQuizPhaseThreshold,
  resolveQuizPhaseResults,
  generateQuizPhaseQuestions,
} from './bossQuizPhase';
import type { BossQuizPhaseConfig } from '../data/balance';
import { BOSS_QUIZ_PHASES } from '../data/balance';
import type { RunState } from './runManager';
import type { Card } from '../data/card-types';

// ---------------------------------------------------------------------------
// Mock factsDB for generateQuizPhaseQuestions tests
// ---------------------------------------------------------------------------

vi.mock('./factsDB', () => ({
  factsDB: {
    getAll: vi.fn(() => [
      {
        id: 'fact_1',
        quizQuestion: 'Q1?',
        correctAnswer: 'A1',
        distractors: ['B1', 'C1', 'D1'],
        categoryL2: 'mammals',
        category: ['Animals'],
        type: 'knowledge',
        statement: 'S1',
        explanation: 'E1',
        rarity: 'common',
        difficulty: 1,
        funScore: 5,
        ageRating: 'all',
      },
      {
        id: 'fact_2',
        quizQuestion: 'Q2?',
        correctAnswer: 'A2',
        distractors: ['B2', 'C2', 'D2'],
        categoryL2: 'birds',
        category: ['Animals'],
        type: 'knowledge',
        statement: 'S2',
        explanation: 'E2',
        rarity: 'common',
        difficulty: 1,
        funScore: 5,
        ageRating: 'all',
      },
      {
        id: 'fact_3',
        quizQuestion: 'Q3?',
        correctAnswer: 'A3',
        distractors: ['B3', 'C3', 'D3'],
        categoryL2: 'mammals',
        category: ['Animals'],
        type: 'knowledge',
        statement: 'S3',
        explanation: 'E3',
        rarity: 'common',
        difficulty: 1,
        funScore: 5,
        ageRating: 'all',
      },
      {
        id: 'fact_4',
        quizQuestion: 'Q4?',
        correctAnswer: 'A4',
        distractors: ['B4', 'C4', 'D4'],
        categoryL2: 'reptiles',
        category: ['Animals'],
        type: 'knowledge',
        statement: 'S4',
        explanation: 'E4',
        rarity: 'common',
        difficulty: 1,
        funScore: 5,
        ageRating: 'all',
      },
      {
        id: 'fact_5',
        quizQuestion: 'Q5?',
        correctAnswer: 'A5',
        distractors: ['B5', 'C5', 'D5'],
        categoryL2: 'reptiles',
        category: ['Animals'],
        type: 'knowledge',
        statement: 'S5',
        explanation: 'E5',
        rarity: 'common',
        difficulty: 1,
        funScore: 5,
        ageRating: 'all',
      },
    ]),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(factId: string, categoryL2?: string): Card {
  return {
    id: `card_${factId}`,
    factId,
    cardType: 'attack',
    domain: 'natural_sciences',
    tier: '1',
    baseEffectValue: 5,
    effectMultiplier: 1,
    categoryL2,
  };
}

function makeRunState(categoryL2Accuracy?: Map<string, { correct: number; total: number }>): RunState {
  return {
    isActive: true,
    primaryDomain: 'natural_sciences',
    secondaryDomain: 'general_knowledge',
    selectedArchetype: 'balanced',
    starterDeckSize: 15,
    startingAp: 3,
    primaryDomainRunNumber: 1,
    earlyBoostActive: true,
    floor: {} as RunState['floor'],
    playerHp: 100,
    playerMaxHp: 100,
    currency: 0,
    cardsEarned: 0,
    factsAnswered: 10,
    factsCorrect: 7,
    bestCombo: 3,
    correctAnswers: 7,
    newFactsLearned: 5,
    factsMastered: 2,
    encountersWon: 4,
    encountersTotal: 5,
    elitesDefeated: 0,
    miniBossesDefeated: 0,
    bossesDefeated: 0,
    currentEncounterWrongAnswers: 0,
    bounties: [],
    canary: {} as RunState['canary'],
    startedAt: Date.now(),
    firstChargeFreeFactIds: new Set(),
    cursedFactIds: new Set(),
    consumedRewardFactIds: new Set(),
    factsAnsweredCorrectly: new Set(),
    factsAnsweredIncorrectly: new Set(),
    runAccuracyBonusApplied: false,
    endlessEnemyDamageMultiplier: 1,
    ascensionLevel: 0,
    ascensionModifiers: {} as RunState['ascensionModifiers'],
    retreatRewardLocked: false,
    runRelics: [],
    offeredRelicIds: new Set(),
    firstMiniBossRelicAwarded: false,
    relicPityCounter: 0,
    phoenixFeatherUsed: false,
    domainAccuracy: {},
    cardsUpgraded: 0,
    cardsRemovedAtShop: 0,
    haggleAttempts: 0,
    haggleSuccesses: 0,
    questionsAnswered: 10,
    questionsCorrect: 7,
    novelQuestionsAnswered: 3,
    novelQuestionsCorrect: 2,
    runSeed: 12345,
    globalTurnCounter: 1,
    soulJarCharges: 0,
    categoryL2Accuracy: categoryL2Accuracy ?? new Map(),
  } as RunState;
}

// ---------------------------------------------------------------------------
// checkQuizPhaseThreshold tests
// ---------------------------------------------------------------------------

describe('checkQuizPhaseThreshold', () => {
  it('returns null when bossId has no quiz phase config', () => {
    const result = checkQuizPhaseThreshold('unknown_boss', 0.3, []);
    expect(result).toBeNull();
  });

  it('returns null when HP is above all thresholds', () => {
    const result = checkQuizPhaseThreshold('algorithm', 0.80, []);
    expect(result).toBeNull();
  });

  it('returns phase 0 config when HP drops to/below 0.50 threshold (Archivist)', () => {
    const result = checkQuizPhaseThreshold('algorithm', 0.50, []);
    expect(result).not.toBeNull();
    expect(result!.phaseIndex).toBe(0);
    expect(result!.config.hpThreshold).toBe(0.50);
    expect(result!.config.questionCount).toBe(5);
  });

  it('returns null when phase 0 already in triggeredIndices', () => {
    const result = checkQuizPhaseThreshold('algorithm', 0.40, [0]);
    expect(result).toBeNull();
  });

  it('returns phase 1 config when HP drops to/below 0.33 (Curator)', () => {
    // Phase 0 (66%) already triggered
    const result = checkQuizPhaseThreshold('final_lesson', 0.30, [0]);
    expect(result).not.toBeNull();
    expect(result!.phaseIndex).toBe(1);
    expect(result!.config.hpThreshold).toBe(0.33);
    expect(result!.config.rapidFire).toBe(true);
    expect(result!.config.timerOverrideMs).toBe(4000);
  });

  it('does not return phase 0 again if already triggered, even if HP still below threshold', () => {
    const result = checkQuizPhaseThreshold('final_lesson', 0.60, [0]);
    // HP at 0.60 is below phase 0 threshold (0.66), but phase 0 already triggered
    expect(result).toBeNull();
  });

  it('returns curator phase 0 at 66% HP when no phases triggered', () => {
    const result = checkQuizPhaseThreshold('final_lesson', 0.65, []);
    expect(result).not.toBeNull();
    expect(result!.phaseIndex).toBe(0);
    expect(result!.config.useWeakestDomain).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveQuizPhaseResults tests
// ---------------------------------------------------------------------------

const standardConfig: BossQuizPhaseConfig = {
  hpThreshold: 0.50,
  questionCount: 5,
  timerOverrideMs: null,
  useWeakestDomain: false,
  rapidFire: false,
  rewards: { correctHpDrainPct: 0.10, correctRandomBuff: true },
  penalties: { wrongStrengthGain: 3 },
};

const rapidFireConfig: BossQuizPhaseConfig = {
  hpThreshold: 0.33,
  questionCount: 8,
  timerOverrideMs: 4000,
  useWeakestDomain: false,
  rapidFire: true,
  rewards: { correctDirectDamage: 5 },
  penalties: { wrongBossHeal: 5 },
};

describe('resolveQuizPhaseResults', () => {
  it('calculates bossDamage correctly for standard phase (5 correct × 10% of 100 HP = 50)', () => {
    const outcome = resolveQuizPhaseResults(standardConfig, { correct: 5, wrong: 0 }, 100);
    expect(outcome.bossDamage).toBe(50); // 5 × (100 × 0.10) = 50
  });

  it('calculates bossStrengthGain correctly for standard phase (3 wrong × 3 strength = 9)', () => {
    const outcome = resolveQuizPhaseResults(standardConfig, { correct: 0, wrong: 3 }, 100);
    expect(outcome.bossStrengthGain).toBe(9);
  });

  it('returns theme "positive" when >60% correct', () => {
    const outcome = resolveQuizPhaseResults(standardConfig, { correct: 4, wrong: 1 }, 100);
    expect(outcome.theme).toBe('positive');
  });

  it('returns theme "negative" when <40% correct', () => {
    const outcome = resolveQuizPhaseResults(standardConfig, { correct: 1, wrong: 4 }, 100);
    expect(outcome.theme).toBe('negative');
  });

  it('returns theme "neutral" for exactly 50% correct', () => {
    const outcome = resolveQuizPhaseResults(standardConfig, { correct: 2, wrong: 2 }, 100);
    expect(outcome.theme).toBe('neutral');
  });

  it('returns bossDamage=0 and bossHeal=0 for rapid-fire phase (effects were per-answer)', () => {
    const outcome = resolveQuizPhaseResults(rapidFireConfig, { correct: 4, wrong: 4 }, 100);
    expect(outcome.bossDamage).toBe(0);
    expect(outcome.bossHeal).toBe(0);
  });

  it('sets correct/wrong/total counts', () => {
    const outcome = resolveQuizPhaseResults(standardConfig, { correct: 3, wrong: 2 }, 100);
    expect(outcome.correctCount).toBe(3);
    expect(outcome.wrongCount).toBe(2);
    expect(outcome.totalCount).toBe(5);
  });

  it('grants playerRandomBuffs for standard config with correctRandomBuff', () => {
    const outcome = resolveQuizPhaseResults(standardConfig, { correct: 3, wrong: 2 }, 100);
    expect(outcome.playerRandomBuffs).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// generateQuizPhaseQuestions tests
// ---------------------------------------------------------------------------

const poolCards: Card[] = [
  makeCard('fact_1', 'mammals'),
  makeCard('fact_2', 'birds'),
  makeCard('fact_3', 'mammals'),
  makeCard('fact_4', 'reptiles'),
  makeCard('fact_5', 'reptiles'),
];

describe('generateQuizPhaseQuestions', () => {
  it('returns exactly questionCount items when pool is large enough', () => {
    const config: BossQuizPhaseConfig = {
      hpThreshold: 0.50,
      questionCount: 3,
      timerOverrideMs: null,
      useWeakestDomain: false,
      rapidFire: false,
      rewards: {},
      penalties: {},
    };
    const runState = makeRunState();
    const questions = generateQuizPhaseQuestions(config, runState, poolCards);
    expect(questions.length).toBe(3);
  });

  it('with useWeakestDomain=true selects correct categoryL2 (worst accuracy)', () => {
    const accuracy = new Map([
      ['mammals', { correct: 1, total: 5 }],   // 20% — WORST
      ['birds', { correct: 4, total: 5 }],      // 80%
      ['reptiles', { correct: 3, total: 5 }],   // 60%
    ]);
    const config: BossQuizPhaseConfig = {
      hpThreshold: 0.66,
      questionCount: 2,
      timerOverrideMs: null,
      useWeakestDomain: true,
      rapidFire: false,
      rewards: {},
      penalties: {},
    };
    const runState = makeRunState(accuracy);
    const questions = generateQuizPhaseQuestions(config, runState, poolCards);
    // All questions should be from 'mammals' (the weakest domain) since there are 2 mammals facts
    expect(questions.length).toBe(2);
    questions.forEach(q => {
      expect(q.categoryL2).toBe('mammals');
    });
  });

  it('falls back to general pool if weakest domain has fewer facts than questionCount', () => {
    const accuracy = new Map([
      ['mammals', { correct: 1, total: 5 }],   // 20% — WORST but only 2 facts
      ['birds', { correct: 4, total: 5 }],      // 80%
      ['reptiles', { correct: 3, total: 5 }],
    ]);
    const config: BossQuizPhaseConfig = {
      hpThreshold: 0.66,
      questionCount: 5, // more than 2 mammals facts available
      timerOverrideMs: null,
      useWeakestDomain: true,
      rapidFire: false,
      rewards: {},
      penalties: {},
    };
    const runState = makeRunState(accuracy);
    const questions = generateQuizPhaseQuestions(config, runState, poolCards);
    // Should return 5 questions (fills from general pool)
    expect(questions.length).toBe(5);
  });

  it('rapid fire timerOverrideMs is 4000, not null', () => {
    const curatorRapidFire = BOSS_QUIZ_PHASES['final_lesson']?.[1];
    expect(curatorRapidFire).toBeDefined();
    expect(curatorRapidFire!.timerOverrideMs).toBe(4000);
    expect(curatorRapidFire!.rapidFire).toBe(true);
  });
});
