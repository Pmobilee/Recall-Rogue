/**
 * Run lifecycle management for the card roguelite.
 * Pure logic layer — no Phaser/Svelte/DOM imports.
 */

import type { FactDomain } from '../data/card-types';
import type { FloorState } from './floorManager';
import { createFloorState, getSegment } from './floorManager';
import { PLAYER_START_HP, PLAYER_MAX_HP, DEATH_PENALTY } from '../data/balance';

export interface RunState {
  isActive: boolean;
  primaryDomain: FactDomain;
  secondaryDomain: FactDomain;
  floor: FloorState;
  playerHp: number;
  playerMaxHp: number;
  currency: number;
  cardsEarned: number;
  factsAnswered: number;
  factsCorrect: number;
  bestCombo: number;
  startedAt: number;
  echoFactIds: Set<string>;
  echoCount: number;
  consumedRewardFactIds: Set<string>;
}

export interface RunEndData {
  result: 'victory' | 'defeat' | 'retreat';
  floorReached: number;
  factsAnswered: number;
  accuracy: number;
  bestCombo: number;
  cardsEarned: number;
  duration: number;
  rewardMultiplier: number;
  currencyEarned: number;
}

export function createRunState(primary: FactDomain, secondary: FactDomain): RunState {
  return {
    isActive: true,
    primaryDomain: primary,
    secondaryDomain: secondary,
    floor: createFloorState(),
    playerHp: PLAYER_START_HP,
    playerMaxHp: PLAYER_MAX_HP,
    currency: 0,
    cardsEarned: 0,
    factsAnswered: 0,
    factsCorrect: 0,
    bestCombo: 0,
    startedAt: Date.now(),
    echoFactIds: new Set<string>(),
    echoCount: 0,
    consumedRewardFactIds: new Set<string>(),
  };
}

export function recordCardPlay(state: RunState, correct: boolean, comboCount: number): void {
  state.factsAnswered += 1;
  if (correct) {
    state.factsCorrect += 1;
    state.cardsEarned += 1;
  }
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
  const rewardMultiplier = reason === 'defeat' ? DEATH_PENALTY[segment] : 1.0;
  const currencyEarned = Math.floor(state.currency * rewardMultiplier);

  return {
    result: reason,
    floorReached: state.floor.currentFloor,
    factsAnswered: state.factsAnswered,
    accuracy,
    bestCombo: state.bestCombo,
    cardsEarned: state.cardsEarned,
    duration,
    rewardMultiplier,
    currencyEarned,
  };
}
