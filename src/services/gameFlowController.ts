/**
 * Screen routing and run flow state machine for card roguelite.
 */

import { writable, get } from 'svelte/store';
import { currentScreen } from '../ui/stores/gameState';
import type { RunState, RunEndData } from './runManager';
import { createRunState, endRun } from './runManager';
import type { RoomOption, MysteryEvent } from './floorManager';
import {
  generateRoomOptions,
  generateMysteryEvent,
  advanceEncounter,
  advanceFloor,
  getSegment,
  isBossFloor,
} from './floorManager';
import type { Card, FactDomain } from '../data/card-types';
import { DEATH_PENALTY } from '../data/balance';
import { generateCardRewardOptions } from './rewardGenerator';
import { addRewardCardToActiveDeck, getActiveDeckFactIds, getRunPoolCards } from './encounterBridge';

export type GameFlowState =
  | 'idle'
  | 'domainSelection'
  | 'combat'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
  | 'treasureReward'
  | 'bossEncounter'
  | 'cardReward'
  | 'retreatOrDelve'
  | 'runEnd';

export const gameFlowState = writable<GameFlowState>('idle');
export const activeRunState = writable<RunState | null>(null);
export const activeRoomOptions = writable<RoomOption[]>([]);
export const activeMysteryEvent = writable<MysteryEvent | null>(null);
export const activeRunEndData = writable<RunEndData | null>(null);
export const activeCardRewardOptions = writable<Card[]>([]);

let pendingFloorCompleted = false;
let pendingClearedFloor = 0;

export function startNewRun(): void {
  gameFlowState.set('domainSelection');
  currentScreen.set('domainSelection');
}

export function onDomainsSelected(primary: FactDomain, secondary: FactDomain): void {
  activeRunState.set(createRunState(primary, secondary));
  gameFlowState.set('combat');
  currentScreen.set('combat');
}

function proceedAfterReward(): void {
  const run = get(activeRunState);
  if (!run) return;

  const floorToResolve = pendingClearedFloor || run.floor.currentFloor;
  if (pendingFloorCompleted) {
    if (isBossFloor(floorToResolve)) {
      gameFlowState.set('retreatOrDelve');
      currentScreen.set('retreatOrDelve');
      return;
    }

    advanceFloor(run.floor);
    activeRunState.set(run);
  }

  activeRoomOptions.set(generateRoomOptions(run.floor.currentFloor));
  gameFlowState.set('roomSelection');
  currentScreen.set('roomSelection');
}

function openCardReward(): void {
  const run = get(activeRunState);
  if (!run) return;

  const options = generateCardRewardOptions(
    getRunPoolCards(),
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    3,
  );

  if (options.length === 0) {
    proceedAfterReward();
    return;
  }

  activeCardRewardOptions.set(options);
  gameFlowState.set('cardReward');
  currentScreen.set('cardReward');
}

export function onEncounterComplete(result: 'victory' | 'defeat'): void {
  const run = get(activeRunState);
  if (!run) return;

  if (result === 'defeat') {
    const endData = endRun(run, 'defeat');
    activeRunEndData.set(endData);
    gameFlowState.set('runEnd');
    currentScreen.set('runEnd');
    return;
  }

  pendingFloorCompleted = advanceEncounter(run.floor);
  pendingClearedFloor = run.floor.currentFloor;
  activeRunState.set(run);
  openCardReward();
}

export function onCardRewardSelected(card: Card): void {
  const run = get(activeRunState);
  if (!run) return;
  run.consumedRewardFactIds.add(card.factId);
  activeRunState.set(run);
  addRewardCardToActiveDeck(card);
  activeCardRewardOptions.set([]);
  proceedAfterReward();
}

export function onCardRewardSkipped(): void {
  activeCardRewardOptions.set([]);
  proceedAfterReward();
}

export function onRetreat(): void {
  const run = get(activeRunState);
  if (!run) return;
  const endData = endRun(run, 'retreat');
  activeRunEndData.set(endData);
  gameFlowState.set('runEnd');
  currentScreen.set('runEnd');
}

export function onDelve(): void {
  const run = get(activeRunState);
  if (!run) return;
  advanceFloor(run.floor);
  activeRunState.set(run);
  activeRoomOptions.set(generateRoomOptions(run.floor.currentFloor));
  gameFlowState.set('roomSelection');
  currentScreen.set('roomSelection');
}

export function getCurrentDelvePenalty(): number {
  const run = get(activeRunState);
  if (!run) return 1;
  const nextFloor = run.floor.currentFloor + 1;
  const segment = getSegment(nextFloor);
  return DEATH_PENALTY[segment];
}

export function onRoomSelected(room: RoomOption): void {
  switch (room.type) {
    case 'combat':
      gameFlowState.set('combat');
      currentScreen.set('combat');
      break;
    case 'mystery':
      activeMysteryEvent.set(generateMysteryEvent());
      gameFlowState.set('mysteryEvent');
      currentScreen.set('mysteryEvent');
      break;
    case 'rest':
      gameFlowState.set('restRoom');
      currentScreen.set('restRoom');
      break;
    case 'treasure':
      gameFlowState.set('treasureReward');
      currentScreen.set('combat');
      break;
    case 'shop':
      gameFlowState.set('combat');
      currentScreen.set('combat');
      break;
  }
}

export function onMysteryResolved(): void {
  const run = get(activeRunState);
  if (!run) return;
  activeRoomOptions.set(generateRoomOptions(run.floor.currentFloor));
  gameFlowState.set('roomSelection');
  currentScreen.set('roomSelection');
}

export function onRestResolved(): void {
  const run = get(activeRunState);
  if (!run) return;
  activeRoomOptions.set(generateRoomOptions(run.floor.currentFloor));
  gameFlowState.set('roomSelection');
  currentScreen.set('roomSelection');
}

export function returnToMenu(): void {
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  pendingFloorCompleted = false;
  pendingClearedFloor = 0;
  gameFlowState.set('idle');
  currentScreen.set('mainMenu');
}

export function playAgain(): void {
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  pendingFloorCompleted = false;
  pendingClearedFloor = 0;
  gameFlowState.set('domainSelection');
  currentScreen.set('domainSelection');
}
