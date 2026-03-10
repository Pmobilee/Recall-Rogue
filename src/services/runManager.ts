/**
 * Run lifecycle management for the card roguelite.
 * Pure logic layer — no Phaser/Svelte/DOM imports.
 */

import type { FactDomain } from '../data/card-types';
import type { FloorState } from './floorManager';
import { createFloorState, getSegment } from './floorManager';
import { PLAYER_START_HP, PLAYER_MAX_HP, DEATH_PENALTY, DIFFICULTY_REWARD_MULTIPLIER } from '../data/balance';
import { difficultyMode } from './cardPreferences';
import { get } from 'svelte/store';
import type { ActiveBounty } from './bountyManager';
import { selectRunBounties } from './bountyManager';
import type { CanaryState } from './canaryService';
import { createCanaryState, recordCanaryAnswer } from './canaryService';
import { getAscensionModifiers, type AscensionModifiers } from './ascension';

export type RewardArchetype = 'balanced' | 'aggressive' | 'defensive' | 'control' | 'hybrid';

export interface RunState {
  isActive: boolean;
  primaryDomain: FactDomain;
  secondaryDomain: FactDomain;
  selectedArchetype: RewardArchetype;
  starterDeckSize: number;
  startingAp: number;
  primaryDomainRunNumber: number;
  earlyBoostActive: boolean;
  floor: FloorState;
  playerHp: number;
  playerMaxHp: number;
  currency: number;
  cardsEarned: number;
  factsAnswered: number;
  factsCorrect: number;
  bestCombo: number;
  correctAnswers: number;
  newFactsLearned: number;
  factsMastered: number;
  encountersWon: number;
  encountersTotal: number;
  currentEncounterWrongAnswers: number;
  bounties: ActiveBounty[];
  canary: CanaryState;
  startedAt: number;
  echoFactIds: Set<string>;
  echoCount: number;
  consumedRewardFactIds: Set<string>;
  factsAnsweredCorrectly: Set<string>;
  factsAnsweredIncorrectly: Set<string>;
  runAccuracyBonusApplied: boolean;
  endlessEnemyDamageMultiplier: number;
  ascensionLevel: number;
  ascensionModifiers: AscensionModifiers;
  retreatRewardLocked: boolean;
}

export interface RunEndData {
  result: 'victory' | 'defeat' | 'retreat';
  floorReached: number;
  factsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  bestCombo: number;
  cardsEarned: number;
  newFactsLearned: number;
  factsMastered: number;
  encountersWon: number;
  encountersTotal: number;
  completedBounties: string[];
  duration: number;
  runDurationMs: number;
  rewardMultiplier: number;
  currencyEarned: number;
}

export function createRunState(
  primary: FactDomain,
  secondary: FactDomain,
  options?: {
    selectedArchetype?: RewardArchetype;
    starterDeckSize?: number;
    startingAp?: number;
    primaryDomainRunNumber?: number;
    earlyBoostActive?: boolean;
    ascensionLevel?: number;
  },
): RunState {
  const bountyCount = Math.random() < 0.5 ? 1 : 2;
  const ascensionLevel = options?.ascensionLevel ?? 0;
  const ascensionModifiers = getAscensionModifiers(ascensionLevel);
  const maxHp = ascensionModifiers.playerMaxHpOverride ?? PLAYER_MAX_HP;
  const starterDeckSize = ascensionModifiers.starterDeckSizeOverride ?? options?.starterDeckSize ?? 15;
  return {
    isActive: true,
    primaryDomain: primary,
    secondaryDomain: secondary,
    selectedArchetype: options?.selectedArchetype ?? 'balanced',
    starterDeckSize,
    startingAp: options?.startingAp ?? 3,
    primaryDomainRunNumber: options?.primaryDomainRunNumber ?? 1,
    earlyBoostActive: options?.earlyBoostActive ?? true,
    floor: createFloorState(),
    playerHp: maxHp,
    playerMaxHp: maxHp,
    currency: 0,
    cardsEarned: 0,
    factsAnswered: 0,
    factsCorrect: 0,
    correctAnswers: 0,
    bestCombo: 0,
    newFactsLearned: 0,
    factsMastered: 0,
    encountersWon: 0,
    encountersTotal: 0,
    currentEncounterWrongAnswers: 0,
    bounties: selectRunBounties(primary, secondary, bountyCount),
    canary: createCanaryState(),
    startedAt: Date.now(),
    echoFactIds: new Set<string>(),
    echoCount: 0,
    consumedRewardFactIds: new Set<string>(),
    factsAnsweredCorrectly: new Set<string>(),
    factsAnsweredIncorrectly: new Set<string>(),
    runAccuracyBonusApplied: false,
    endlessEnemyDamageMultiplier: 1,
    ascensionLevel,
    ascensionModifiers,
    retreatRewardLocked: false,
  };
}

export function recordCardPlay(
  state: RunState,
  correct: boolean,
  comboCount: number,
  factId?: string,
): void {
  state.factsAnswered += 1;
  if (correct) {
    state.factsCorrect += 1;
    state.cardsEarned += 1;
    if (factId) {
      state.factsAnsweredCorrectly.add(factId);
      state.factsAnsweredIncorrectly.delete(factId);
    }
  } else {
    state.currentEncounterWrongAnswers += 1;
    if (factId) {
      state.factsAnsweredIncorrectly.add(factId);
      state.factsAnsweredCorrectly.delete(factId);
    }
  }
  state.correctAnswers = state.factsCorrect;
  state.canary = recordCanaryAnswer(state.canary, correct);
  if (comboCount > state.bestCombo) state.bestCombo = comboCount;
}

export function damagePlayer(state: RunState, amount: number): number {
  state.playerHp = Math.max(0, state.playerHp - amount);
  return state.playerHp;
}

export function healPlayer(state: RunState, amount: number): number {
  state.playerHp = Math.min(state.playerMaxHp, state.playerHp + amount);
  return state.playerHp;
}

export function isDefeated(state: RunState): boolean {
  return state.playerHp <= 0;
}

export function endRun(state: RunState, reason: 'victory' | 'defeat' | 'retreat'): RunEndData {
  state.isActive = false;

  const duration = Date.now() - state.startedAt;
  const accuracy = state.factsAnswered > 0
    ? Math.round((state.factsCorrect / state.factsAnswered) * 100)
    : 0;

  const segment = getSegment(state.floor.currentFloor);
  const deathPenalty = reason === 'defeat' ? DEATH_PENALTY[segment] : 1.0;
  const mode = get(difficultyMode);
  const difficultyBonus = DIFFICULTY_REWARD_MULTIPLIER[mode] ?? 1.0;
  const rewardMultiplier = deathPenalty * difficultyBonus;
  const completedBounties = state.bounties.filter((bounty) => bounty.completed).map((bounty) => bounty.name);
  const rewardsSuppressed = reason === 'retreat' && state.retreatRewardLocked;
  const bountyBonusCurrency = rewardsSuppressed ? 0 : completedBounties.length * 20;
  const baseCurrency = rewardsSuppressed ? 0 : (state.currency + bountyBonusCurrency);
  const currencyEarned = Math.floor(baseCurrency * rewardMultiplier);

  return {
    result: reason,
    floorReached: state.floor.currentFloor,
    factsAnswered: state.factsAnswered,
    correctAnswers: state.factsCorrect,
    accuracy,
    bestCombo: state.bestCombo,
    cardsEarned: state.cardsEarned,
    newFactsLearned: state.newFactsLearned,
    factsMastered: state.factsMastered,
    encountersWon: state.encountersWon,
    encountersTotal: state.encountersTotal,
    completedBounties,
    duration,
    runDurationMs: duration,
    rewardMultiplier,
    currencyEarned,
  };
}
