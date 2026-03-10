/**
 * Screen routing and run flow state machine for card roguelite.
 */

import { writable, get } from 'svelte/store';
import { currentScreen } from '../ui/stores/gameState';
import type { RunState, RunEndData } from './runManager';
import { createRunState, endRun } from './runManager';
import type { RewardArchetype } from './runManager';
import type { RoomOption, MysteryEvent } from './floorManager';
import {
  generateRoomOptions,
  generateMysteryEvent,
  advanceEncounter,
  advanceFloor,
  getSegment,
  isBossFloor,
  isMiniBossEncounter,
} from './floorManager';
import type { Card, FactDomain } from '../data/card-types';
import { DEATH_PENALTY } from '../data/balance';
import { generateCardRewardOptionsByType, rerollRewardCardInType } from './rewardGenerator';
import {
  addRewardCardToActiveDeck,
  getActiveDeckCards,
  getActiveDeckFactIds,
  getRunPoolCards,
  sellCardFromActiveDeck,
} from './encounterBridge';
import { onboardingState, incrementRunsCompleted, markOnboardingComplete, difficultyMode } from './cardPreferences';
import { isSlowReader } from './cardPreferences';
import { STORY_MODE_FORCED_RUNS, ARCHETYPE_UNLOCK_RUNS } from '../data/balance';
import { updateBounties } from './bountyManager';
import { resetCanaryFloor } from './canaryService';
import { applyRunAccuracyBonus, playerSave, persistPlayer, recordDiveComplete } from '../ui/stores/playerData';
import { recordRunCompleted as recordRunForReview, checkBossKillTrigger } from './reviewPromptService';
import { captureRunSummary, lastRunSummary } from './hubState';
import {
  getRunNumberForDomain,
  incrementDomainRunCount,
  isEarlyBoostActiveForDomain,
} from './runEarlyBoostController';
import { getExperimentValue } from './experimentService';
import { analyticsService } from './analyticsService';
import type { SpecialEvent } from '../data/specialEvents';
import { rollSpecialEvent } from '../data/specialEvents';
import { saveActiveRun, loadActiveRun, clearActiveRun, hasActiveRun } from './runSaveService'
import { requestNotificationPermission, rescheduleNotifications } from './notificationService'
import type { NotificationPlayerData } from './notificationService'
import { getDueReviews } from '../ui/stores/playerData';

export type GameFlowState =
  | 'idle'
  | 'domainSelection'
  | 'archetypeSelection'
  | 'combat'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
  | 'treasureReward'
  | 'bossEncounter'
  | 'cardReward'
  | 'retreatOrDelve'
  | 'shopRoom'
  | 'specialEvent'
  | 'campfire'
  | 'runEnd';

export const gameFlowState = writable<GameFlowState>('idle');
export const activeRunState = writable<RunState | null>(null);
export const activeRoomOptions = writable<RoomOption[]>([]);
export const activeMysteryEvent = writable<MysteryEvent | null>(null);
export const activeRunEndData = writable<RunEndData | null>(null);
export const activeCardRewardOptions = writable<Card[]>([]);
export const activeShopCards = writable<Card[]>([]);
export const activeSpecialEvent = writable<SpecialEvent | null>(null);
export const campfireReturnScreen = writable<GameFlowState | null>(null);

let pendingFloorCompleted = false;
let pendingSpecialEvent = false;
let pendingClearedFloor = 0;
let pendingDomainSelection: { primary: FactDomain; secondary: FactDomain } | null = null;

export function startNewRun(): void {
  const onboarding = get(onboardingState);
  if (!onboarding.hasCompletedOnboarding) {
    gameFlowState.set('idle');
    currentScreen.set('onboarding');
    return;
  }
  gameFlowState.set('domainSelection');
  currentScreen.set('domainSelection');
}

function markRunCompleted(): void {
  const onboarding = get(onboardingState);
  incrementRunsCompleted();
  recordRunForReview();
  if (!onboarding.hasCompletedOnboarding) {
    markOnboardingComplete();
  }

  // Request notification permission after first completed run.
  if (onboarding.runsCompleted === 0) {
    void requestNotificationPermission();
  }

  // Reschedule notifications with current player state.
  void rescheduleNotificationsFromPlayerState();
}

/** Builds NotificationPlayerData from current stores and triggers reschedule. */
export function rescheduleNotificationsFromPlayerState(): void {
  const save = get(playerSave);
  if (!save) return;

  const dueReviews = getDueReviews();

  const playerData: NotificationPlayerData = {
    currentStreak: save.stats.currentStreak,
    dueReviewCount: dueReviews.length,
    lastSessionDate: save.lastDiveDate ?? null,
    nearMilestoneDomain: null,
    factsToMilestone: Infinity,
  };

  void rescheduleNotifications(playerData);
}

function finishRunAndReturnToHub(run: RunState, endData: RunEndData): void {
  clearActiveRun();
  lastRunSummary.set(captureRunSummary(run, endData));
  activeRunEndData.set(endData);
  activeRunState.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeSpecialEvent.set(null);
  pendingFloorCompleted = false;
  pendingSpecialEvent = false;
  pendingClearedFloor = 0;
  pendingDomainSelection = null;
  gameFlowState.set('idle');
  currentScreen.set('hub');
}

function applyRunCompletionBonuses(run: RunState): void {
  const totalAnswers = run.factsAnswered;
  if (totalAnswers <= 0) return;

  const accuracy = (run.factsCorrect / totalAnswers) * 100;
  if (accuracy < 80) return;

  const applied = applyRunAccuracyBonus(run.factsAnsweredCorrectly, 2);
  if (applied) {
    run.runAccuracyBonusApplied = true;
  }
}

export function onDomainsSelected(primary: FactDomain, secondary: FactDomain): void {
  pendingDomainSelection = { primary, secondary };

  // Skip archetype selection for runs 1-3; auto-assign 'balanced'
  const onboarding = get(onboardingState);
  if (onboarding.runsCompleted < ARCHETYPE_UNLOCK_RUNS) {
    onArchetypeSelected('balanced');
    return;
  }

  gameFlowState.set('archetypeSelection');
  currentScreen.set('archetypeSelection');
}

export function onArchetypeSelected(archetype: RewardArchetype): void {
  const pending = pendingDomainSelection;
  if (!pending) return;
  const save = get(playerSave);
  const userId = save?.deviceId ?? save?.playerId ?? 'anonymous';
  const runNumber = save ? getRunNumberForDomain(save, pending.primary) : 1;
  const earlyBoostActive = save ? isEarlyBoostActiveForDomain(save, pending.primary) : true;
  const startingAp = getExperimentValue('starting_ap_3_vs_4', userId);
  const starterDeckSize = getExperimentValue('starter_deck_15_vs_18', userId);
  const slowReaderDefault = getExperimentValue('slow_reader_default', userId);

  // Apply first-run default only once; user preferences continue to override after this.
  if (typeof window !== 'undefined' && window.localStorage.getItem('card:isSlowReader') === null) {
    isSlowReader.set(Boolean(slowReaderDefault));
  }

  if (save) {
    let updatedSave = incrementDomainRunCount(save, pending.primary);
    if (pending.secondary !== pending.primary) {
      updatedSave = incrementDomainRunCount(updatedSave, pending.secondary);
    }
    playerSave.set(updatedSave);
    persistPlayer();
  }

  // Force Story Mode (explorer) for first N runs
  const onboarding = get(onboardingState);
  if (onboarding.runsCompleted < STORY_MODE_FORCED_RUNS) {
    difficultyMode.set('explorer');
  }

  const run = createRunState(pending.primary, pending.secondary, {
    selectedArchetype: archetype,
    starterDeckSize: Number(starterDeckSize),
    startingAp: Number(startingAp),
    primaryDomainRunNumber: runNumber,
    earlyBoostActive,
  });
  analyticsService.track({
    name: 'domain_select',
    properties: {
      primary: pending.primary,
      secondary: pending.secondary,
      archetype,
      run_number: runNumber,
      starter_deck_size: starterDeckSize,
      starting_ap: startingAp,
      early_boost_active: earlyBoostActive,
    },
  });
  analyticsService.track({
    name: 'run_start',
    properties: {
      domain_primary: pending.primary,
      domain_secondary: pending.secondary,
      archetype,
      starting_ap: startingAp,
      starter_deck_size: starterDeckSize,
      run_number: runNumber,
    },
  });
  run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
  activeRunState.set(run);
  pendingDomainSelection = null;
  gameFlowState.set('combat');
  currentScreen.set('combat');
}

function proceedAfterReward(): void {
  const run = get(activeRunState);
  if (!run) return;

  const floorToResolve = pendingClearedFloor || run.floor.currentFloor;
  if (pendingFloorCompleted) {
    // After boss floor: show special event first, then retreat/delve
    if (isBossFloor(floorToResolve)) {
      if (!pendingSpecialEvent) {
        // Show special event before retreat/delve
        pendingSpecialEvent = true;
        const event = rollSpecialEvent();
        activeSpecialEvent.set(event);
        gameFlowState.set('specialEvent');
        currentScreen.set('specialEvent');
        return;
      }
      // Special event already resolved, now show retreat/delve
      pendingSpecialEvent = false;
      gameFlowState.set('retreatOrDelve');
      currentScreen.set('retreatOrDelve');
      return;
    }

    advanceFloor(run.floor);
    run.canary = resetCanaryFloor(run.canary);
    run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
    activeRunState.set(run);
  }

  // After encounter 2, auto-start encounter 3 (mini-boss/boss) — no room selection
  if (run.floor.currentEncounter === run.floor.encountersPerFloor) {
    gameFlowState.set('combat');
    currentScreen.set('combat');
    return;
  }

  activeRoomOptions.set(generateRoomOptions(run.floor.currentFloor));
  gameFlowState.set('roomSelection');
  currentScreen.set('roomSelection');
}

function openCardReward(): void {
  const run = get(activeRunState);
  if (!run) return;

  const options = generateCardRewardOptionsByType(
    getRunPoolCards(),
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    run.selectedArchetype,
  );

  if (options.length === 0) {
    proceedAfterReward();
    return;
  }

  activeCardRewardOptions.set(options);
  analyticsService.track({
    name: 'card_reward',
    properties: {
      option_types: options.map((option) => option.cardType),
      floor: run.floor.currentFloor,
      encounter: run.floor.currentEncounter,
    },
  });
  gameFlowState.set('cardReward');
  currentScreen.set('cardReward');
}

export function onCardRewardReroll(type: Card['cardType']): void {
  const run = get(activeRunState);
  if (!run) return;
  const updated = rerollRewardCardInType(
    getRunPoolCards(),
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    get(activeCardRewardOptions),
    type,
  );
  activeCardRewardOptions.set(updated);
  analyticsService.track({
    name: 'card_reward_reroll',
    properties: {
      card_type: type,
      floor: run.floor.currentFloor,
      encounter: run.floor.currentEncounter,
    },
  });
}

export function onEncounterComplete(result: 'victory' | 'defeat'): void {
  const run = get(activeRunState);
  if (!run) return;

  run.encountersTotal += 1;
  if (result === 'victory') {
    run.encountersWon += 1;
    run.bounties = updateBounties(run.bounties, {
      type: 'encounter_won',
      flawless: run.currentEncounterWrongAnswers === 0,
    });
    run.currentEncounterWrongAnswers = 0;
  }

  if (result === 'defeat') {
    const accuracy = run.factsAnswered > 0 ? Math.round((run.factsCorrect / run.factsAnswered) * 100) : 0;
    analyticsService.track({
      name: 'run_complete',
      properties: {
        result: 'defeat',
        floor: run.floor.currentFloor,
        accuracy,
        facts_answered: run.factsAnswered,
        facts_correct: run.factsCorrect,
        best_combo: run.bestCombo,
        cards_earned: run.cardsEarned,
        bounties_completed: run.bounties.filter((b) => b.completed).length,
      },
    });
    analyticsService.track({
      name: 'run_death',
      properties: {
        floor: run.floor.currentFloor,
        cause: 'defeat',
        accuracy,
        encounters_won: run.encountersWon,
      },
    });
    recordDiveComplete(run.floor.currentFloor, run.factsAnswered);
    applyRunCompletionBonuses(run);
    markRunCompleted();
    const endData = endRun(run, 'defeat');
    finishRunAndReturnToHub(run, endData);
    return;
  }

  pendingFloorCompleted = advanceEncounter(run.floor);
  pendingClearedFloor = run.floor.currentFloor;
  activeRunState.set(run);
  autoSaveRun('cardReward');
  openCardReward();
}

export function onCardRewardSelected(card: Card): void {
  const run = get(activeRunState);
  if (!run) return;
  run.consumedRewardFactIds.add(card.factId);
  activeRunState.set(run);
  addRewardCardToActiveDeck(card);
  analyticsService.track({
    name: 'card_type_selected',
    properties: {
      card_type: card.cardType,
      fact_id: card.factId,
      floor: run.floor.currentFloor,
      encounter: run.floor.currentEncounter,
    },
  });
  activeCardRewardOptions.set([]);
  autoSaveRun('roomSelection');
  proceedAfterReward();
}

export function onCardRewardSkipped(): void {
  activeCardRewardOptions.set([]);
  proceedAfterReward();
}

function openShopRoom(): void {
  const run = get(activeRunState);
  if (!run) return;
  const cards = [...getActiveDeckCards()]
    .filter((card) => !card.isEcho)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  activeShopCards.set(cards);
  analyticsService.track({
    name: 'shop_visit',
    properties: {
      floor: run.floor.currentFloor,
      options: cards.length,
      currency: run.currency,
    },
  });
  gameFlowState.set('shopRoom');
  currentScreen.set('shopRoom');
}

export function onShopSell(cardId: string): void {
  const run = get(activeRunState);
  if (!run) return;
  const { soldCard, gold } = sellCardFromActiveDeck(cardId);
  if (!soldCard || gold <= 0) return;
  run.currency += gold;
  activeRunState.set(run);
  activeShopCards.update((cards) => cards.filter((card) => card.id !== cardId));
  analyticsService.track({
    name: 'shop_sell',
    properties: {
      fact_id: soldCard.factId,
      card_type: soldCard.cardType,
      tier: soldCard.tier,
      gold,
      floor: run.floor.currentFloor,
    },
  });
}

export function onShopDone(): void {
  const run = get(activeRunState);
  if (!run) return;
  activeShopCards.set([]);
  activeRoomOptions.set(generateRoomOptions(run.floor.currentFloor));
  gameFlowState.set('roomSelection');
  currentScreen.set('roomSelection');
}

export function onRetreat(): void {
  const run = get(activeRunState);
  if (!run) return;
  const accuracy = run.factsAnswered > 0 ? Math.round((run.factsCorrect / run.factsAnswered) * 100) : 0;
  analyticsService.track({
    name: 'cash_out',
    properties: {
      floor: run.floor.currentFloor,
      gold: run.currency,
      accuracy,
      reason: 'retreat',
    },
  });
  analyticsService.track({
    name: 'run_complete',
    properties: {
      result: 'retreat',
      floor: run.floor.currentFloor,
      accuracy,
      facts_answered: run.factsAnswered,
      facts_correct: run.factsCorrect,
      best_combo: run.bestCombo,
      cards_earned: run.cardsEarned,
      bounties_completed: run.bounties.filter((b) => b.completed).length,
    },
  });
  recordDiveComplete(run.floor.currentFloor, run.factsAnswered);
  applyRunCompletionBonuses(run);
  markRunCompleted();
  // Boss kill review prompt (retreat always follows a boss floor)
  void checkBossKillTrigger();
  const endData = endRun(run, 'retreat');
  finishRunAndReturnToHub(run, endData);
}

export function onDelve(): void {
  const run = get(activeRunState);
  if (!run) return;
  analyticsService.track({
    name: 'cash_out',
    properties: {
      floor: run.floor.currentFloor,
      gold: 0,
      decision: 'delve',
    },
  });
  advanceFloor(run.floor);
  run.canary = resetCanaryFloor(run.canary);
  run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
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
  const run = get(activeRunState);
  if (run) {
    analyticsService.track({
      name: 'room_selected',
      properties: {
        room: room.type,
        floor: run.floor.currentFloor,
        encounter: run.floor.currentEncounter,
      },
    });
  }
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
      openShopRoom();
      break;
  }
}

export function onSpecialEventResolved(): void {
  activeSpecialEvent.set(null);
  proceedAfterReward();
}

export function openCampfire(): void {
  const currentState = get(gameFlowState);
  campfireReturnScreen.set(currentState);
  // Auto-save when entering campfire
  autoSaveRun('campfire');
  gameFlowState.set('campfire');
  currentScreen.set('campfire');
}

export function resumeFromCampfire(): void {
  const returnState = get(campfireReturnScreen);
  if (returnState) {
    gameFlowState.set(returnState);
    currentScreen.set(returnState as string as import('../ui/stores/gameState').Screen);
  } else {
    gameFlowState.set('combat');
    currentScreen.set('combat');
  }
  campfireReturnScreen.set(null);
}

export function returnToHubFromCampfire(): void {
  // Save run state so player can resume later
  autoSaveRun('campfire');
  campfireReturnScreen.set(null);
  gameFlowState.set('idle');
  currentScreen.set('hub');
}

export function abandonActiveRun(): void {
  clearActiveRun();
  activeRunState.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeSpecialEvent.set(null);
  pendingFloorCompleted = false;
  pendingSpecialEvent = false;
  pendingClearedFloor = 0;
  pendingDomainSelection = null;
  gameFlowState.set('idle');
  currentScreen.set('hub');
}

export function checkAndResumeActiveRun(): boolean {
  if (!hasActiveRun()) return false;
  const saved = loadActiveRun();
  if (!saved) return false;
  // Restore is delegated to the caller (CardApp) which handles bridge restoration
  return true;
}

export { hasActiveRun, loadActiveRun, clearActiveRun };

/** Auto-save the current run state at a safe point. */
function autoSaveRun(screen: string): void {
  const run = get(activeRunState);
  if (!run) return;
  try {
    saveActiveRun({
      version: 1,
      savedAt: new Date().toISOString(),
      runState: run,
      currentScreen: screen,
      roomOptions: get(activeRoomOptions),
    });
  } catch {
    // Silently fail — save is best-effort
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
  clearActiveRun();
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeSpecialEvent.set(null);
  pendingFloorCompleted = false;
  pendingSpecialEvent = false;
  pendingClearedFloor = 0;
  pendingDomainSelection = null;
  gameFlowState.set('idle');
  currentScreen.set('hub');
}

export function playAgain(): void {
  clearActiveRun();
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeSpecialEvent.set(null);
  pendingFloorCompleted = false;
  pendingSpecialEvent = false;
  pendingClearedFloor = 0;
  pendingDomainSelection = null;
  gameFlowState.set('domainSelection');
  currentScreen.set('domainSelection');
}
