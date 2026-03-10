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
  registerEncounterCompleteHandler,
  sellCardFromActiveDeck,
  startEncounterForRoom,
} from './encounterBridge';
import { activeRunState } from './runStateStore';
import {
  onboardingState,
  incrementRunsCompleted,
  markOnboardingComplete,
  difficultyMode,
  getAscensionLevel,
  unlockAscensionLevel,
  unlockNextAscensionLevel,
} from './cardPreferences';
import { isSlowReader } from './cardPreferences';
import { STORY_MODE_FORCED_RUNS, ARCHETYPE_UNLOCK_RUNS } from '../data/balance';
import { updateBounties } from './bountyManager';
import { resetCanaryFloor } from './canaryService';
import {
  applyMasteryTrialOutcome,
  applyRunAccuracyBonus,
  playerSave,
  persistPlayer,
  prioritizeGraduatedRelicFact,
  recordDiveComplete,
} from '../ui/stores/playerData';
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
import {
  completeDailyExpeditionAttempt,
  reserveDailyExpeditionAttempt,
} from './dailyExpeditionService'
import {
  completeScholarChallengeAttempt,
  reserveScholarChallengeAttempt,
} from './scholarChallengeService'
import { recordEndlessDepthsRun } from './endlessDepthsService'
import { apiClient } from './apiClient'
import { enqueueCompetitiveScoreSubmission } from './scoreSubmissionQueue'
import {
  activateDeterministicRandom,
  deactivateDeterministicRandom,
} from './deterministicRandom'
import {
  rollMasteryChallenge,
  type MasteryChallengeQuestion,
} from './masteryChallengeService'
import { getCardTier } from './tierDerivation'
import { shuffled } from './randomUtils'
import { getAscensionModifiers } from './ascension';

export type GameFlowState =
  | 'idle'
  | 'domainSelection'
  | 'archetypeSelection'
  | 'combat'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'masteryChallenge'
  | 'restRoom'
  | 'treasureReward'
  | 'bossEncounter'
  | 'cardReward'
  | 'retreatOrDelve'
  | 'shopRoom'
  | 'specialEvent'
  | 'campfire'
  | 'relicSanctum'
  | 'runEnd';

export const gameFlowState = writable<GameFlowState>('idle');
export { activeRunState };
export const activeRoomOptions = writable<RoomOption[]>([]);
export const activeMysteryEvent = writable<MysteryEvent | null>(null);
export const activeRunEndData = writable<RunEndData | null>(null);
export const activeCardRewardOptions = writable<Card[]>([]);
export const activeShopCards = writable<Card[]>([]);
export const activeSpecialEvent = writable<SpecialEvent | null>(null);
export const activeMasteryChallenge = writable<MasteryChallengeQuestion | null>(null);
export const campfireReturnScreen = writable<GameFlowState | null>(null);

let pendingFloorCompleted = false;
let pendingSpecialEvent = false;
let pendingClearedFloor = 0;
let pendingDomainSelection: { primary: FactDomain; secondary: FactDomain } | null = null;
type ActiveRunMode = 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge'
let activeRunMode: ActiveRunMode = 'standard'
let activeDailySeed: number | null = null

export function startNewRun(): void {
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  const onboarding = get(onboardingState);
  if (!onboarding.hasCompletedOnboarding) {
    gameFlowState.set('idle');
    currentScreen.set('onboarding');
    return;
  }
  gameFlowState.set('domainSelection');
  currentScreen.set('domainSelection');
}

function getTier3MasteredCount(): number {
  const states = get(playerSave)?.reviewStates ?? []
  return states.filter((state) => (
    getCardTier({
      stability: state.stability ?? state.interval ?? 0,
      consecutiveCorrect: state.consecutiveCorrect ?? state.repetitions ?? 0,
      passedMasteryTrial: state.passedMasteryTrial ?? false,
    }) === '3'
  )).length
}

export function canOpenRelicSanctum(): boolean {
  if (get(activeRunState)) return false
  return getTier3MasteredCount() > 12
}

export function openRelicSanctum(): { ok: true } | { ok: false; reason: string } {
  if (get(activeRunState)) return { ok: false, reason: 'run_active' }
  if (!canOpenRelicSanctum()) return { ok: false, reason: 'insufficient_mastered' }
  gameFlowState.set('relicSanctum')
  currentScreen.set('relicSanctum')
  return { ok: true }
}

export function closeRelicSanctum(): void {
  if (get(activeRunState)) return
  gameFlowState.set('idle')
  currentScreen.set('social')
}

function calculateDailyExpeditionScore(endData: RunEndData): number {
  const accuracyFactor = Math.max(0, endData.accuracy) / 100
  const speedFactor = Math.max(0.4, Math.min(2.5, 600_000 / Math.max(60_000, endData.runDurationMs)))
  const depthFactor = Math.max(1, endData.floorReached)
  const comboFactor = Math.max(1, endData.bestCombo)
  return Math.round(accuracyFactor * speedFactor * depthFactor * comboFactor * 1000)
}

function calculateEndlessDepthsScore(endData: RunEndData): number {
  const depthFactor = Math.max(10, endData.floorReached)
  const comboFactor = Math.max(1, endData.bestCombo)
  const accuracyFactor = Math.max(0, endData.accuracy)
  return Math.round((depthFactor * 650) + (comboFactor * 180) + (accuracyFactor * 22))
}

function calculateScholarChallengeScore(endData: RunEndData): number {
  const accuracyFactor = Math.max(0, endData.accuracy) / 100
  const speedFactor = Math.max(0.5, Math.min(2.2, 520_000 / Math.max(60_000, endData.runDurationMs)))
  const depthFactor = Math.max(1, endData.floorReached)
  const comboFactor = Math.max(1, endData.bestCombo)
  return Math.round(accuracyFactor * speedFactor * depthFactor * comboFactor * 1150)
}

function computeEndlessEnemyDamageMultiplier(floor: number): number {
  const depthPast10 = Math.max(0, floor - 10)
  // Endless balance pass: +3% enemy damage per floor after 10, capped at +75%.
  return 1 + Math.min(0.75, depthPast10 * 0.03)
}

function applyEndlessDepthsScaling(run: RunState): void {
  run.endlessEnemyDamageMultiplier = computeEndlessEnemyDamageMultiplier(run.floor.currentFloor)
}

function submitCompetitiveScore(
  category: 'daily_expedition' | 'endless_depths' | 'scholar_challenge',
  score: number,
  metadata: Record<string, unknown>,
): void {
  if (!apiClient.isLoggedIn()) return
  enqueueCompetitiveScoreSubmission(category, score, metadata)
}

export async function startDailyExpeditionRun(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const onboarding = get(onboardingState)
  if (!onboarding.hasCompletedOnboarding) {
    currentScreen.set('onboarding')
    gameFlowState.set('idle')
    return { ok: false, reason: 'onboarding_required' }
  }

  const save = get(playerSave)
  const playerId = save?.accountId ?? save?.deviceId ?? save?.playerId ?? 'anonymous'
  const playerName = save?.accountEmail?.split('@')[0] ?? `Rogue-${playerId.slice(0, 6)}`
  const reservation = reserveDailyExpeditionAttempt(playerId, playerName)
  if (!reservation.ok) {
    return { ok: false, reason: reservation.reason }
  }

  activeRunMode = 'daily_expedition'
  activeDailySeed = reservation.attempt.seed
  activateDeterministicRandom(reservation.attempt.seed)
  pendingDomainSelection = { primary: 'general_knowledge', secondary: 'history' }
  onArchetypeSelected('balanced')
  if (!(await startEncounterForRoom())) {
    currentScreen.set('hub')
    activeRunState.set(null)
    activeRunMode = 'standard'
    activeDailySeed = null
    deactivateDeterministicRandom()
    return { ok: false, reason: 'failed_to_start_encounter' }
  }
  analyticsService.track({
    name: 'daily_expedition_start',
    properties: {
      date_key: reservation.attempt.dateKey,
      seed: reservation.attempt.seed,
      player_id: reservation.attempt.playerId,
    },
  })
  return { ok: true }
}

export async function startScholarChallengeRun(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const onboarding = get(onboardingState)
  if (!onboarding.hasCompletedOnboarding) {
    currentScreen.set('onboarding')
    gameFlowState.set('idle')
    return { ok: false, reason: 'onboarding_required' }
  }

  const save = get(playerSave)
  const playerId = save?.accountId ?? save?.deviceId ?? save?.playerId ?? 'anonymous'
  const playerName = save?.accountEmail?.split('@')[0] ?? `Rogue-${playerId.slice(0, 6)}`
  const reservation = reserveScholarChallengeAttempt(playerId, playerName)
  if (!reservation.ok) {
    return { ok: false, reason: reservation.reason }
  }

  activeRunMode = 'scholar_challenge'
  activeDailySeed = reservation.attempt.seed
  activateDeterministicRandom(reservation.attempt.seed)
  pendingDomainSelection = {
    primary: reservation.attempt.primaryDomain,
    secondary: reservation.attempt.secondaryDomain,
  }
  onArchetypeSelected('balanced')
  if (!(await startEncounterForRoom())) {
    currentScreen.set('hub')
    activeRunState.set(null)
    activeRunMode = 'standard'
    activeDailySeed = null
    deactivateDeterministicRandom()
    return { ok: false, reason: 'failed_to_start_encounter' }
  }
  return { ok: true }
}

export async function startEndlessDepthsRun(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const onboarding = get(onboardingState)
  if (!onboarding.hasCompletedOnboarding) {
    currentScreen.set('onboarding')
    gameFlowState.set('idle')
    return { ok: false, reason: 'onboarding_required' }
  }

  activeRunMode = 'endless_depths'
  activeDailySeed = null
  deactivateDeterministicRandom()
  pendingDomainSelection = { primary: 'general_knowledge', secondary: 'history' }
  onArchetypeSelected('balanced')

  const run = get(activeRunState)
  if (!run) {
    activeRunMode = 'standard'
    return { ok: false, reason: 'failed_to_create_run' }
  }

  run.floor.currentFloor = 10
  run.floor.currentEncounter = 1
  run.floor.segment = getSegment(10)
  run.floor.encountersPerFloor = 3
  run.floor.eventsPerFloor = 2
  run.floor.isBossFloor = isBossFloor(10)
  run.floor.bossDefeated = false
  applyEndlessDepthsScaling(run)
  activeRunState.set(run)

  if (!(await startEncounterForRoom())) {
    currentScreen.set('hub')
    activeRunState.set(null)
    activeRunMode = 'standard'
    return { ok: false, reason: 'failed_to_start_encounter' }
  }
  return { ok: true }
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
  if (activeRunMode === 'daily_expedition') {
    const score = calculateDailyExpeditionScore(endData)
    const completedAttempt = completeDailyExpeditionAttempt({
      score,
      floorReached: endData.floorReached,
      accuracy: endData.accuracy,
      bestCombo: endData.bestCombo,
      runDurationMs: endData.runDurationMs,
    })
    if (completedAttempt) {
      submitCompetitiveScore('daily_expedition', score, {
        dateKey: completedAttempt.dateKey,
        floorReached: endData.floorReached,
        accuracy: endData.accuracy,
        bestCombo: endData.bestCombo,
        runDurationMs: endData.runDurationMs,
      })
    }
    analyticsService.track({
      name: 'daily_expedition_complete',
      properties: {
        score,
        floor_reached: endData.floorReached,
        accuracy: endData.accuracy,
        best_combo: endData.bestCombo,
        run_duration_ms: endData.runDurationMs,
      },
    })
  } else if (activeRunMode === 'endless_depths') {
    const save = get(playerSave)
    const playerId = save?.accountId ?? save?.deviceId ?? save?.playerId ?? 'anonymous'
    const playerName = save?.accountEmail?.split('@')[0] ?? `Rogue-${playerId.slice(0, 6)}`
    const score = calculateEndlessDepthsScore(endData)
    recordEndlessDepthsRun(playerId, playerName, score, endData.floorReached)
    submitCompetitiveScore('endless_depths', score, {
      floorReached: endData.floorReached,
      accuracy: endData.accuracy,
      bestCombo: endData.bestCombo,
      runDurationMs: endData.runDurationMs,
    })
  } else if (activeRunMode === 'scholar_challenge') {
    const score = calculateScholarChallengeScore(endData)
    const completedAttempt = completeScholarChallengeAttempt({
      score,
      floorReached: endData.floorReached,
      accuracy: endData.accuracy,
      bestCombo: endData.bestCombo,
      runDurationMs: endData.runDurationMs,
    })
    if (completedAttempt) {
      submitCompetitiveScore('scholar_challenge', score, {
        weekKey: completedAttempt.weekKey,
        floorReached: endData.floorReached,
        accuracy: endData.accuracy,
        bestCombo: endData.bestCombo,
        runDurationMs: endData.runDurationMs,
        primaryDomain: completedAttempt.primaryDomain,
        secondaryDomain: completedAttempt.secondaryDomain,
      })
    }
  }
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  clearActiveRun();
  lastRunSummary.set(captureRunSummary(run, endData));
  activeRunEndData.set(endData);
  activeRunState.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
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

function isAscensionSuccess(run: RunState, result: 'retreat' | 'victory' | 'defeat'): boolean {
  if (activeRunMode !== 'standard') return false
  if (result === 'retreat') return run.floor.currentFloor >= 9
  if (result === 'victory') return run.floor.currentFloor >= 24
  return false
}

function progressAscensionAfterSuccess(run: RunState): void {
  const currentLevel = run.ascensionLevel ?? 0
  if (currentLevel <= 0) {
    unlockAscensionLevel(1)
    return
  }
  unlockNextAscensionLevel(currentLevel)
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
  const starterDeckSizeExperiment = getExperimentValue('starter_deck_15_vs_18', userId);
  const selectedAscensionLevel = getAscensionLevel();
  const ascensionModifiers = getAscensionModifiers(selectedAscensionLevel);
  const starterDeckSize = ascensionModifiers.starterDeckSizeOverride ?? Number(starterDeckSizeExperiment);
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
  } else if (get(difficultyMode) === 'explorer') {
    // Reset from forced explorer after tutorial runs complete
    difficultyMode.set('standard');
  }

  const run = createRunState(pending.primary, pending.secondary, {
    selectedArchetype: archetype,
    starterDeckSize,
    startingAp: Number(startingAp),
    primaryDomainRunNumber: runNumber,
    earlyBoostActive,
    ascensionLevel: selectedAscensionLevel,
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
      ascension_level: selectedAscensionLevel,
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
      ascension_level: selectedAscensionLevel,
    },
  });
  run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
  activeRunState.set(run);
  pendingDomainSelection = null;
  gameFlowState.set('combat');
  currentScreen.set('combat');
}

async function proceedAfterReward(): Promise<void> {
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
    if (activeRunMode === 'endless_depths') {
      applyEndlessDepthsScaling(run)
    }
    run.canary = resetCanaryFloor(run.canary);
    run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
    activeRunState.set(run);
  }

  // After encounter 2, auto-start encounter 3 (mini-boss/boss) — no room selection
  if (run.floor.currentEncounter === run.floor.encountersPerFloor) {
    gameFlowState.set('combat');
    currentScreen.set('combat');
    await startEncounterForRoom();
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
    void proceedAfterReward();
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
        retreat_rewards_locked: run.retreatRewardLocked,
        ascension_level: run.ascensionLevel ?? 0,
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

registerEncounterCompleteHandler(onEncounterComplete)

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
  void proceedAfterReward();
}

export function onCardRewardSkipped(): void {
  activeCardRewardOptions.set([]);
  void proceedAfterReward();
}

function openShopRoom(): void {
  const run = get(activeRunState);
  if (!run) return;
  const cards = shuffled(
    [...getActiveDeckCards()].filter((card) => !card.isEcho),
  ).slice(0, 3);
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
  const minRetreatFloorForRewards = run.ascensionModifiers?.minRetreatFloorForRewards ?? null
  run.retreatRewardLocked = Boolean(
    minRetreatFloorForRewards != null && run.floor.currentFloor < minRetreatFloorForRewards,
  )
  const accuracy = run.factsAnswered > 0 ? Math.round((run.factsCorrect / run.factsAnswered) * 100) : 0;
  analyticsService.track({
    name: 'cash_out',
    properties: {
      floor: run.floor.currentFloor,
      gold: run.currency,
      accuracy,
      reason: 'retreat',
      retreat_rewards_locked: run.retreatRewardLocked,
      ascension_level: run.ascensionLevel ?? 0,
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
      retreat_rewards_locked: run.retreatRewardLocked,
      ascension_level: run.ascensionLevel ?? 0,
    },
  });
  recordDiveComplete(run.floor.currentFloor, run.factsAnswered);
  applyRunCompletionBonuses(run);
  markRunCompleted();
  if (isAscensionSuccess(run, 'retreat')) {
    progressAscensionAfterSuccess(run)
  }
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
      retreat_rewards_locked: run.retreatRewardLocked,
      ascension_level: run.ascensionLevel ?? 0,
    },
  });
  advanceFloor(run.floor);
  if (activeRunMode === 'endless_depths') {
    applyEndlessDepthsScaling(run)
  }
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
      activeMasteryChallenge.set(null);
      activeMysteryEvent.set(null);
      {
        const challenge = rollMasteryChallenge(get(playerSave)?.reviewStates ?? [])
        if (challenge) {
          activeMasteryChallenge.set(challenge)
          analyticsService.track({
            name: 'mastery_challenge_start',
            properties: {
              fact_id: challenge.factId,
              floor: run?.floor.currentFloor ?? 0,
              encounter: run?.floor.currentEncounter ?? 0,
            },
          })
          gameFlowState.set('masteryChallenge')
          currentScreen.set('masteryChallenge')
          break
        }
      }
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
  void proceedAfterReward();
}

export function onMasteryChallengeResolved(passed: boolean): void {
  const challenge = get(activeMasteryChallenge)
  if (!challenge) {
    onMysteryResolved()
    return
  }

  if (passed) {
    prioritizeGraduatedRelicFact(challenge.factId)
  } else {
    applyMasteryTrialOutcome(challenge.factId, false)
  }

  analyticsService.track({
    name: passed ? 'mastery_challenge_pass' : 'mastery_challenge_fail',
    properties: {
      fact_id: challenge.factId,
      floor: get(activeRunState)?.floor.currentFloor ?? 0,
    },
  })

  activeMasteryChallenge.set(null)
  onMysteryResolved()
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
  if (activeRunMode === 'daily_expedition' && activeDailySeed !== null) {
    activateDeterministicRandom(activeDailySeed)
  }
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
  const run = get(activeRunState)
  if (run?.ascensionModifiers?.preventFlee) {
    return
  }
  // Save run state so player can resume later
  autoSaveRun('campfire');
  deactivateDeterministicRandom()
  campfireReturnScreen.set(null);
  gameFlowState.set('idle');
  currentScreen.set('hub');
}

export function abandonActiveRun(): void {
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  clearActiveRun();
  activeRunState.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
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
      runMode: activeRunMode,
      dailySeed: activeDailySeed,
      roomOptions: get(activeRoomOptions),
    });
  } catch {
    // Silently fail — save is best-effort
  }
}

export function onMysteryResolved(): void {
  const run = get(activeRunState);
  if (!run) return;
  activeMysteryEvent.set(null)
  activeMasteryChallenge.set(null)
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
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  clearActiveRun();
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
  pendingFloorCompleted = false;
  pendingSpecialEvent = false;
  pendingClearedFloor = 0;
  pendingDomainSelection = null;
  gameFlowState.set('idle');
  currentScreen.set('hub');
}

export function playAgain(): void {
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  clearActiveRun();
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  activeShopCards.set([]);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
  pendingFloorCompleted = false;
  pendingSpecialEvent = false;
  pendingClearedFloor = 0;
  pendingDomainSelection = null;
  gameFlowState.set('domainSelection');
  currentScreen.set('domainSelection');
}

export function restoreRunMode(runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge', dailySeed?: number | null): void {
  if (runMode === 'daily_expedition' && typeof dailySeed === 'number' && Number.isFinite(dailySeed)) {
    activeRunMode = 'daily_expedition'
    activeDailySeed = dailySeed
    activateDeterministicRandom(dailySeed)
    return
  }
  if (runMode === 'scholar_challenge' && typeof dailySeed === 'number' && Number.isFinite(dailySeed)) {
    activeRunMode = 'scholar_challenge'
    activeDailySeed = dailySeed
    activateDeterministicRandom(dailySeed)
    return
  }
  if (runMode === 'endless_depths') {
    activeRunMode = 'endless_depths'
    activeDailySeed = null
    deactivateDeterministicRandom()
    return
  }
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
}
