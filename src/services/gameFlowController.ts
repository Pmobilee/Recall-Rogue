/**
 * Screen routing and run flow state machine for card roguelite.
 */

import { writable, get } from 'svelte/store';
import { currentScreen, activeRewardBundle, activeRewardRevealStep, holdScreenTransition } from '../ui/stores/gameState';
import type { RunState, RunEndData } from './runManager';
import { createRunState, endRun } from './runManager';
import type { RewardArchetype } from './runManager';
import { healPlayer } from './runManager';
import type { RoomOption, MysteryEvent } from './floorManager';
import {
  generateRoomOptions,
  generateMysteryEvent,
  advanceEncounter,
  advanceFloor,
  getSegment,
  isBossFloor,
  isMiniBossEncounter,
  generateCombatRoomOptions,
  generateEventRoomOptions,
  shouldOfferEvent,
} from './floorManager';
import type { Card, FactDomain } from '../data/card-types';
import { DEATH_PENALTY, POST_MINI_BOSS_HEAL_PCT, SHOP_RELIC_PRICE, SHOP_HAGGLE_DISCOUNT, RELIC_SELL_REFUND_PCT, RELIC_REROLL_COST, RELIC_REROLL_MAX, RELIC_BOSS_CHOICES, RELIC_PITY_THRESHOLD, RELIC_RARITY_WEIGHTS } from '../data/balance';
import { generateCardRewardOptionsByType, rerollRewardCardInType } from './rewardGenerator';
import {
  addRewardCardToActiveDeck,
  getActiveDeckCards,
  getActiveDeckFactIds,
  getRunPoolCards,
  registerEncounterCompleteHandler,
  resetEncounterBridge,
  serializeEncounterSnapshot,
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
import { updateAutoCalibration, createDefaultCalibrationState } from './difficultyCalibration'
import {
  activateDeterministicRandom,
  deactivateDeterministicRandom,
} from './deterministicRandom'
import { initRunRng, destroyRunRng } from './seededRng'
import {
  rollMasteryChallenge,
  type MasteryChallengeQuestion,
} from './masteryChallengeService'
import { getCardTier } from './tierDerivation'
import { shuffled } from './randomUtils'
import { getAscensionModifiers } from './ascension';
import { openRewardRoom } from './rewardRoomBridge';
import type { RewardItem } from '../game/scenes/RewardRoomScene';
import type { RelicDefinition } from '../data/relics/types'
import { STARTER_RELIC_IDS, RELIC_BY_ID } from '../data/relics/index'
import {
  getEligibleRelicPool,
  generateBossRelicChoices,
  generateMiniBossRelicChoices,
  generateRandomRelicDrop,
  shouldDropRandomRelic,
} from './relicAcquisitionService'
import { isRelicSlotsFull, getMaxRelicSlots } from './relicEffectResolver'
import type { UpgradePreview } from './cardUpgradeService';
import { getUpgradeCandidates, getUpgradePreview, upgradeCard } from './cardUpgradeService'
import type { QuizQuestion } from './bossQuizPhase';
import { factsDB } from './factsDB';
import type { ShopInventory } from './shopService';
import { generateShopRelics, priceShopCards, removalPrice } from './shopService';
import type { DeckMode } from '../data/studyPreset'
import { generateActMap, selectMapNode, deriveFloorFromNode, type ActMap } from './mapGenerator'

export type GameFlowState =
  | 'idle'
  | 'domainSelection'
  | 'archetypeSelection'
  | 'combat'
  | 'roomSelection'
  | 'dungeonMap'
  | 'mysteryEvent'
  | 'masteryChallenge'
  | 'restRoom'
  | 'treasureReward'
  | 'bossEncounter'
  | 'cardReward'
  | 'relicReward'
  | 'retreatOrDelve'
  | 'shopRoom'
  | 'specialEvent'
  | 'campfire'
  | 'relicSanctum'
  | 'runEnd'
  | 'upgradeSelection'
  | 'postMiniBossRest'
  | 'relicSwapOverlay'
  | 'restStudy'
  | 'restMeditate';
  // 'starterRelicSelection' removed AR-59.12 — runs start directly at dungeonMap

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
export const activeRelicRewardOptions = writable<RelicDefinition[]>([]);
export const activeRelicPickup = writable<RelicDefinition | null>(null);
export const activeUpgradeCandidates = writable<Array<{ card: Card; preview: UpgradePreview }>>([]);
export const activeShopInventory = writable<ShopInventory | null>(null);

let pendingFloorCompleted = false;
let pendingSpecialEvent = false;
let pendingClearedFloor = 0;
let pendingDomainSelection: { primary: FactDomain; secondary: FactDomain } | null = null;
type ActiveRunMode = 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge'
let activeRunMode: ActiveRunMode = 'standard'

/** The relic being offered when the player's slots are full (pending swap decision). */
let pendingSwapRelicId: string | null = null;

/** Number of rerolls used for the current relic selection screen (resets per opening). */
let currentSelectionRerollsUsed = 0;

/** Tracks relic IDs shown during the current reroll session. Cleared at end of selection event. */
let rerollSeenIds: Set<string> = new Set();

/** Returns the ID of the relic being offered for swap, or null if none pending. */
export function getPendingSwapRelicId(): string | null {
  return pendingSwapRelicId;
}

/** Clears the pending swap relic without acquiring it. */
export function clearPendingSwapRelicId(): void {
  pendingSwapRelicId = null;
}

/** Resets the reroll counter and session-seen IDs for the current relic selection screen. */
export function resetRelicSelectionRerolls(): void {
  currentSelectionRerollsUsed = 0;
  rerollSeenIds = new Set();
}

/** Returns true if the player can still reroll the current relic selection. */
export function canRerollRelicSelection(): boolean {
  const run = get(activeRunState);
  if (!run) return false;
  return currentSelectionRerollsUsed < RELIC_REROLL_MAX && run.currency >= RELIC_REROLL_COST;
}

/** Returns true when the pity counter has reached the threshold for Uncommon+ guarantee. */
export function isRelicPityActive(): boolean {
  const run = get(activeRunState);
  return (run?.relicPityCounter ?? 0) >= RELIC_PITY_THRESHOLD;
}

/** Update the pity counter after any relic acquisition. Call inside addRelicToRun. */
function updateRelicPityCounter(relic: RelicDefinition): void {
  const run = get(activeRunState);
  if (!run) return;
  if (relic.rarity === 'common') {
    run.relicPityCounter = (run.relicPityCounter ?? 0) + 1;
  } else {
    run.relicPityCounter = 0;
  }
  activeRunState.set(run);
}

/**
 * Rerolls the current relic reward selection.
 * Deducts RELIC_REROLL_COST gold, marks current offers as seen, draws fresh choices.
 */
export function rerollRelicSelection(currentOfferedIds: string[]): void {
  const run = get(activeRunState);
  if (!run || !canRerollRelicSelection()) return;
  run.currency = Math.max(0, run.currency - RELIC_REROLL_COST);
  for (const id of currentOfferedIds) {
    rerollSeenIds.add(id);
  }
  currentSelectionRerollsUsed++;
  activeRunState.set(run);
  const pool = buildRelicPool();
  const choices = generateBossRelicChoices(pool);
  activeRelicRewardOptions.set(choices);
}

/**
 * Removes an equipped relic and refunds RELIC_SELL_REFUND_PCT of its base buy price.
 */
export function sellEquippedRelic(definitionId: string): void {
  const run = get(activeRunState);
  if (!run) return;
  const idx = run.runRelics.findIndex(r => r.definitionId === definitionId);
  if (idx === -1) return;
  run.runRelics.splice(idx, 1);
  const def = RELIC_BY_ID[definitionId];
  if (def) {
    const basePrice = SHOP_RELIC_PRICE[def.rarity] ?? 0;
    const refund = Math.floor(basePrice * RELIC_SELL_REFUND_PCT);
    run.currency += refund;
  }
  activeRunState.set(run);
}

/**
 * Completes a pending relic swap: acquires the pending relic directly (bypassing slot check).
 * Call after sellEquippedRelic to add the new relic.
 */
export function acquirePendingSwapRelic(): void {
  if (!pendingSwapRelicId) return;
  const def = RELIC_BY_ID[pendingSwapRelicId];
  if (def) {
    addRelicToRunDirect(def);
  }
}
let activeDailySeed: number | null = null
let pendingDeckMode: DeckMode | null = null
let pendingIncludeOutsideDueReviews = false

export function startNewRun(options?: { includeOutsideDueReviews?: boolean }): void {
  activeRunMode = 'standard'
  activeDailySeed = null
  pendingIncludeOutsideDueReviews = options?.includeOutsideDueReviews ?? false
  deactivateDeterministicRandom()
  destroyRunRng()
  // Always set deck mode from hub selector, even for onboarding flow
  const save = get(playerSave);
  pendingDeckMode = save?.activeDeckMode ?? { type: 'general' as const };
  const onboarding = get(onboardingState);
  if (!onboarding.hasCompletedOnboarding) {
    gameFlowState.set('idle');
    currentScreen.set('onboarding');
    return;
  }
  // Placeholder domains (pool builder uses deckMode, not these)
  pendingDomainSelection = { primary: 'general_knowledge', secondary: 'general_knowledge' };

  // Skip archetype selection for runs 1-3; auto-assign 'balanced'
  if (onboarding.runsCompleted < ARCHETYPE_UNLOCK_RUNS) {
    onArchetypeSelected('balanced');
    return;
  }
  gameFlowState.set('archetypeSelection');
  currentScreen.set('archetypeSelection');
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
  gameFlowState.set('relicSanctum')
  currentScreen.set('relicSanctum')
  return { ok: true }
}

export function closeRelicSanctum(): void {
  if (get(activeRunState)) return
  gameFlowState.set('idle')
  currentScreen.set('hub')
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
  pendingIncludeOutsideDueReviews = false
  activateDeterministicRandom(reservation.attempt.seed)
  pendingDomainSelection = { primary: 'general_knowledge', secondary: 'history' }
  onArchetypeSelected('balanced')
  if (!(await startEncounterForRoom())) {
    currentScreen.set('hub')
    activeRunState.set(null)
    activeRunMode = 'standard'
    activeDailySeed = null
    deactivateDeterministicRandom()
    destroyRunRng()
    return { ok: false, reason: 'failed_to_start_encounter' }
  }
  autoSaveRun('combat')
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
  pendingIncludeOutsideDueReviews = false
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
    destroyRunRng()
    return { ok: false, reason: 'failed_to_start_encounter' }
  }
  autoSaveRun('combat')
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
  pendingIncludeOutsideDueReviews = false
  deactivateDeterministicRandom()
  destroyRunRng()
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
  autoSaveRun('combat')
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
  // Auto-calibrate difficulty based on per-domain accuracy
  const calibSave = get(playerSave);
  if (calibSave) {
    const calibration = calibSave.calibrationState ?? createDefaultCalibrationState();
    if (calibration.autoCalibrate && run.domainAccuracy) {
      const updated = updateAutoCalibration(run.domainAccuracy, calibration);
      playerSave.update(s => s ? { ...s, calibrationState: updated } : s);
      persistPlayer();
    }
  }

  // Store last deck mode for "repeat last run" default
  if (run.deckMode) {
    const currentSave = get(playerSave);
    if (currentSave) {
      playerSave.set({ ...currentSave, lastRunDeckMode: run.deckMode });
      persistPlayer();
    }
  }
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  destroyRunRng()
  resetEncounterBridge()
  clearActiveRun();
  lastRunSummary.set(captureRunSummary(run, endData));
  activeRunEndData.set(endData);
  activeRunState.set(null);
  activeCardRewardOptions.set([]);
  activeRewardBundle.set(null);
  activeRewardRevealStep.set('gold');
  activeShopCards.set([]);
  activeShopInventory.set(null);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
  activeRelicRewardOptions.set([]);
  activeRelicPickup.set(null);
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

  // Force Relaxed Mode for first N runs
  const onboarding = get(onboardingState);
  if (onboarding.runsCompleted < STORY_MODE_FORCED_RUNS) {
    difficultyMode.set('normal');
  }

  const run = createRunState(pending.primary, pending.secondary, {
    selectedArchetype: archetype,
    starterDeckSize,
    startingAp: Number(startingAp),
    primaryDomainRunNumber: runNumber,
    earlyBoostActive,
    ascensionLevel: selectedAscensionLevel,
    deckMode: pendingDeckMode ?? undefined,
    includeOutsideDueReviews: pendingIncludeOutsideDueReviews,
  });
  pendingDeckMode = null;
  pendingIncludeOutsideDueReviews = false;
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
  // Generate the initial ActMap for the first segment
  run.floor.actMap = generateActMap(run.floor.segment, run.runSeed);
  activeRunState.set(run);
  // Initialize forked RNG system for all modes that use a seed
  initRunRng(run.runSeed);
  // Activate deterministic random for standard and endless_depths runs
  if (activeRunMode === 'standard' || activeRunMode === 'endless_depths') {
    activateDeterministicRandom(run.runSeed);
  }
  pendingDomainSelection = null;
  // AR-59.12: No starter relic. Runs start with 0 relics. First relic earned at Act 1 mini-boss.
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

/**
 * Called when the player selects a starter relic.
 * Adds the relic to the run, then transitions to the dungeon map.
 */
export function onStarterRelicSelected(relicId: string): void {
  const run = get(activeRunState);
  if (!run) return;

  // Add starter relic to the run (with safety check for duplicates)
  const alreadyHeld = run.runRelics.some(r => r.definitionId === relicId);
  if (!alreadyHeld) {
    run.runRelics.push({
      definitionId: relicId,
      acquiredAtFloor: 0,
      acquiredAtEncounter: 0,
      triggerCount: 0,
    });
    if (!(run.offeredRelicIds instanceof Set)) run.offeredRelicIds = new Set(run.offeredRelicIds as any ?? []);
    run.offeredRelicIds.add(relicId);
  }

  activeRunState.set(run);
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

async function proceedAfterReward(): Promise<void> {
  const run = get(activeRunState);
  if (!run) return;

  // === Map-based progression (actMap flow) ===
  if (run.floor.actMap) {
    const currentNodeId = run.floor.actMap.currentNodeId;
    const currentNode = currentNodeId ? run.floor.actMap.nodes[currentNodeId] : null;

    if (currentNode?.type === 'boss') {
      // Boss node defeated — trigger special event → retreat/delve
      if (!pendingSpecialEvent) {
        pendingSpecialEvent = true;
        const event = rollSpecialEvent();
        activeSpecialEvent.set(event);
        gameFlowState.set('specialEvent');
        currentScreen.set('specialEvent');
        return;
      }
      pendingSpecialEvent = false;
      gameFlowState.set('retreatOrDelve');
      currentScreen.set('retreatOrDelve');
      return;
    }

    // Non-boss node cleared — return to dungeon map
    gameFlowState.set('dungeonMap');
    currentScreen.set('dungeonMap');
    autoSaveRun('dungeonMap');
    return;
  }
  // === End map-based progression ===

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
    holdScreenTransition();
    currentScreen.set('combat');
    await startEncounterForRoom();
    autoSaveRun('combat');
    return;
  }

  // After event rooms, force combat. After combat rooms, roll for event.
  if (run.floor.lastSlotWasEvent) {
    // Coming from an event room — force combat options
    activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
    // Reset slot type for next cycle
    run.floor.lastSlotWasEvent = false;
  } else {
    // Coming from combat — roll for event
    if (shouldOfferEvent(run.floor.currentFloor)) {
      run.floor.lastSlotWasEvent = true;
      activeRoomOptions.set(generateEventRoomOptions(run.floor.currentFloor));
    } else {
      run.floor.lastSlotWasEvent = false;
      activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
    }
  }
  activeRunState.set(run);
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

const USE_REWARD_ROOM_SCENE = true;

function openCardReward(): void {
  const run = get(activeRunState);
  if (!run) return;

  const options = generateCardRewardOptionsByType(
    getRunPoolCards(),
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    run.selectedArchetype,
    run.floor.currentFloor,
  );

  if (options.length === 0) {
    void proceedAfterReward();
    return;
  }

  if (USE_REWARD_ROOM_SCENE) {
    const bundle = get(activeRewardBundle);
    const totalGold = bundle ? (bundle.goldEarned + bundle.comboBonus) : 0;
    const healAmount = bundle ? bundle.healAmount : 0;

    const rewards: RewardItem[] = [];
    // Always include gold (minimum 5 from encounter)
    const displayGold = totalGold > 0 ? totalGold : 5;
    rewards.push({ type: 'gold', amount: displayGold });
    // Always include a health vial
    const displayHeal = healAmount > 0 ? healAmount : 8;
    rewards.push({ type: 'health_vial', size: displayHeal > 15 ? 'large' : 'small', healAmount: displayHeal });
    for (const card of options) {
      rewards.push({ type: 'card', card });
    }

    analyticsService.track({
      name: 'card_reward',
      properties: {
        option_types: options.map((option) => option.cardType),
        floor: run.floor.currentFloor,
        encounter: run.floor.currentEncounter,
      },
    });

    void openRewardRoom(
      rewards,
      // onGoldCollected
      (amount) => {
        const r = get(activeRunState);
        if (!r) return;
        r.currency += amount;
        activeRunState.set(r);
      },
      // onVialCollected
      (healAmt) => {
        const r = get(activeRunState);
        if (!r) return;
        healPlayer(r, healAmt);
        activeRunState.set(r);
      },
      // onCardAccepted
      (card) => {
        const r = get(activeRunState);
        if (!r) return;
        r.consumedRewardFactIds.add(card.factId);
        activeRunState.set(r);
        addRewardCardToActiveDeck(card);
        analyticsService.track({
          name: 'card_type_selected',
          properties: {
            card_type: card.cardType,
            fact_id: card.factId,
            floor: r.floor.currentFloor,
            encounter: r.floor.currentEncounter,
          },
        });
      },
      // onRelicAccepted
      (relic) => {
        addRelicToRun(relic);
      },
      // onComplete
      () => {
        activeCardRewardOptions.set([]);
        activeRewardBundle.set(null);
        activeRewardRevealStep.set('gold');
        autoSaveRun('dungeonMap');
        void proceedAfterReward();
      },
    );
    return;
  }

  // Existing Svelte card reward (fallback)
  const bundle = get(activeRewardBundle);
  const initialRevealStep = (!bundle || (bundle.goldEarned === 0 && bundle.healAmount === 0))
    ? 'card'
    : 'gold';

  activeCardRewardOptions.set(options);
  activeRewardRevealStep.set(initialRevealStep);
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
  autoSaveRun('cardReward');
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

/** Build the eligible relic pool for the current run. Excludes reroll-session-seen IDs during active reroll events. */
function buildRelicPool(): RelicDefinition[] {
  const run = get(activeRunState)
  const save = get(playerSave)
  if (!run || !save) return []
  const unlockedIds = save.unlockedRelicIds ?? []
  // Merge persistent exclusions with current reroll-session seen IDs
  const excludedIds = [...(save.excludedRelicIds ?? []), ...rerollSeenIds]
  const heldIds = run.runRelics.map((r) => r.definitionId)
  return getEligibleRelicPool(unlockedIds, excludedIds, heldIds)
}

/**
 * Adds a relic directly to the run without checking slot capacity.
 * Use for post-swap acquisition or when slot check is not needed.
 */
function addRelicToRunDirect(relic: RelicDefinition): void {
  const run = get(activeRunState)
  if (!run) return
  const alreadyHeld = run.runRelics.some(r => r.definitionId === relic.id)
  if (alreadyHeld) return // Prevent duplicate relics
  run.runRelics.push({
    definitionId: relic.id,
    acquiredAtFloor: run.floor.currentFloor,
    acquiredAtEncounter: run.floor.currentEncounter,
    triggerCount: 0,
  })
  // Only acquired relics are added to offeredRelicIds (declined options are NOT tracked)
  if (!(run.offeredRelicIds instanceof Set)) run.offeredRelicIds = new Set(run.offeredRelicIds as any ?? []);
  run.offeredRelicIds.add(relic.id)
  activeRunState.set(run)
  updateRelicPityCounter(relic)
}

/**
 * Opens the RewardRoomScene with relic-only items for a choose-1-of-3 relic reward.
 * After the player accepts or skips, proceeds to openCardReward().
 * Used for boss, elite, and first mini-boss relic rewards.
 */
function openRelicChoiceRewardRoom(choices: RelicDefinition[], _postMiniBoss: boolean): void {
  gameFlowState.set('relicReward');
  const relicRewards: RewardItem[] = choices.map((relic) => ({ type: 'relic' as const, relic }));
  void openRewardRoom(
    relicRewards,
    // onGoldCollected — no gold in relic-only reward
    (_amount) => {},
    // onVialCollected — no vial in relic-only reward
    (_healAmt) => {},
    // onCardAccepted — no cards in relic-only reward
    (_card) => {},
    // onRelicAccepted — player chose a relic; apply slot enforcement
    (relic) => {
      addRelicToRun(relic);
    },
    // onComplete — regardless of accept/skip, proceed to card reward
    () => {
      activeRelicRewardOptions.set([]);
      openCardReward();
    },
  );
}

/**
 * Adds a relic to the run with slot-cap enforcement.
 * If at capacity, stores the relic as pending and routes to relicSwapOverlay.
 * Used for choose-1-of-3 events where the selection screen is clearing.
 */
function addRelicToRun(relic: RelicDefinition): void {
  const run = get(activeRunState)
  if (!run) return
  if (isRelicSlotsFull(run.runRelics)) {
    pendingSwapRelicId = relic.id
    gameFlowState.set('relicSwapOverlay')
    currentScreen.set('relicSwapOverlay')
    return
  }
  addRelicToRunDirect(relic)
}

/**
 * Gives a relic as a toast (random drop).
 * If slots are full: stores as pending swap and shows toast with "Swap" button.
 * Player can dismiss to forfeit, or tap Swap to open the swap overlay.
 * If slots available: adds immediately and shows simple toast.
 */
function giveRelicAsToastDrop(relic: RelicDefinition): void {
  const run = get(activeRunState)
  if (!run) return
  if (isRelicSlotsFull(run.runRelics)) {
    // Store pending swap but don't navigate yet — toast will show swap button
    pendingSwapRelicId = relic.id
    activeRelicPickup.set(relic)
  } else {
    addRelicToRunDirect(relic)
    activeRelicPickup.set(relic)
  }
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

  // Capture current encounter info BEFORE advancing
  const justCompletedEncounter = run.floor.currentEncounter;
  const justCompletedFloor = run.floor.currentFloor;
  const wasMiniBoss = isMiniBossEncounter(justCompletedFloor, justCompletedEncounter);

  // Capture actMap node type BEFORE advancing (for elite/boss detection)
  const justCompletedNodeId = run.floor.actMap?.currentNodeId ?? null;
  const justCompletedNode = justCompletedNodeId
    ? run.floor.actMap?.nodes[justCompletedNodeId] ?? null
    : null;
  const wasElite = justCompletedNode?.type === 'elite';

  // actMap boss nodes have a single encounter; encountersPerFloor is always 3,
  // so the old check (justCompletedEncounter === run.floor.encountersPerFloor)
  // is always false for actMap bosses. Include the actMap node-type check as a fallback.
  const wasBoss =
    (isBossFloor(justCompletedFloor) && justCompletedEncounter === run.floor.encountersPerFloor)
    || (justCompletedNode?.type === 'boss');

  if (import.meta.env.DEV) console.log('[GameFlow] onEncounterComplete:', result, 'wasBoss:', wasBoss, 'floor:', justCompletedFloor, 'encounter:', justCompletedEncounter);

  // For actMap boss nodes, force floor completion since boss is a single encounter
  if (run.floor.actMap && justCompletedNode?.type === 'boss') {
    run.floor.encountersPerFloor = justCompletedEncounter;
  }

  pendingFloorCompleted = advanceEncounter(run.floor);
  pendingClearedFloor = run.floor.currentFloor;
  activeRunState.set(run);

  // Relic acquisition — priority: boss > elite > first-mini-boss > subsequent-mini-boss > regular
  const relicPool = buildRelicPool();

  if (wasBoss && relicPool.length > 0) {
    const choices = generateBossRelicChoices(relicPool);
    if (choices.length > 0) {
      resetRelicSelectionRerolls();
      openRelicChoiceRewardRoom(choices, false);
      return;
    }
  } else if (wasElite && relicPool.length > 0) {
    // Elite: choose-1-of-3 with regular weights (same as first mini-boss)
    const choices = generateMiniBossRelicChoices(relicPool);
    if (choices.length > 0) {
      resetRelicSelectionRerolls();
      openRelicChoiceRewardRoom(choices, false);
      return;
    }
  } else if (wasMiniBoss && !run.firstMiniBossRelicAwarded && relicPool.length > 0) {
    // First mini-boss: choose-1-of-3
    run.firstMiniBossRelicAwarded = true;
    activeRunState.set(run);
    const choices = generateMiniBossRelicChoices(relicPool);
    if (choices.length > 0) {
      resetRelicSelectionRerolls();
      openRelicChoiceRewardRoom(choices, false);
      return;
    }
  } else if (wasMiniBoss && run.firstMiniBossRelicAwarded && relicPool.length > 0) {
    // Subsequent mini-boss: single random toast drop with full rarity table
    const drop = generateRandomRelicDrop(relicPool, RELIC_RARITY_WEIGHTS, isRelicPityActive());
    if (drop) {
      giveRelicAsToastDrop(drop);
    }
  } else if (!wasBoss && !wasMiniBoss && !wasElite && shouldDropRandomRelic() && relicPool.length > 0) {
    // Regular combat: 10% random toast drop with full rarity table
    const drop = generateRandomRelicDrop(relicPool, RELIC_RARITY_WEIGHTS, isRelicPityActive());
    if (drop) {
      giveRelicAsToastDrop(drop);
    }
  }

  // Post-mini-boss rest: heal + optional upgrade (for non-first mini-bosses)
  if (wasMiniBoss && run.firstMiniBossRelicAwarded) {
    openPostMiniBossRest();
    return;
  }

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
  activeRewardBundle.set(null);
  activeRewardRevealStep.set('gold');
  autoSaveRun('dungeonMap');
  void proceedAfterReward();
}

export function onCardRewardSkipped(): void {
  activeCardRewardOptions.set([]);
  activeRewardBundle.set(null);
  activeRewardRevealStep.set('gold');
  autoSaveRun('dungeonMap');
  void proceedAfterReward();
}

export function onRelicRewardSelected(relic: RelicDefinition): void {
  addRelicToRun(relic);
  activeRelicRewardOptions.set([]);
  // Clear reroll session state when selection event resolves
  resetRelicSelectionRerolls();
  openCardReward();
}

function openShopRoom(): void {
  const run = get(activeRunState);
  if (!run) return;

  // Existing sell cards
  const sellCards = shuffled(
    [...getActiveDeckCards()].filter((card) => !card.isEcho),
  ).slice(0, 3);
  activeShopCards.set(sellCards);

  // Generate buy inventory
  const relicPool = buildRelicPool();
  const shopRelics = generateShopRelics(run.floor.currentFloor, relicPool);

  // Generate card reward options for buying
  const cardRewardOptions = generateCardRewardOptionsByType(
    getRunPoolCards() as any,
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    run.selectedArchetype,
    run.floor.currentFloor,
  );
  const shopCards = priceShopCards(cardRewardOptions.slice(0, 3), run.floor.currentFloor);

  const inventory: ShopInventory = {
    relics: shopRelics,
    cards: shopCards,
    removalCost: removalPrice(run.cardsRemovedAtShop ?? 0),
  };
  activeShopInventory.set(inventory);

  analyticsService.track({
    name: 'shop_visit',
    properties: {
      floor: run.floor.currentFloor,
      options: sellCards.length,
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

/** Buy a relic from the shop. When haggled=true, applies 30% discount before deducting. */
export function onShopBuyRelic(relicId: string, haggled = false): boolean {
  const run = get(activeRunState);
  const inventory = get(activeShopInventory);
  if (!run || !inventory) return false;

  const item = inventory.relics.find(r => r.relic.id === relicId);
  if (!item) return false;

  const finalPrice = haggled ? Math.floor(item.price * (1 - SHOP_HAGGLE_DISCOUNT)) : item.price;
  if (run.currency < finalPrice) return false;

  run.currency -= finalPrice;
  if (haggled) run.haggleSuccesses = (run.haggleSuccesses ?? 0) + 1;
  addRelicToRun(item.relic);
  inventory.relics = inventory.relics.filter(r => r.relic.id !== relicId);
  activeShopInventory.set(inventory);
  activeRunState.set(run);

  analyticsService.track({
    name: 'shop_buy_relic',
    properties: {
      relic_id: relicId,
      price: finalPrice,
      base_price: item.price,
      haggled,
      rarity: item.relic.rarity,
      floor: run.floor.currentFloor,
      remaining_currency: run.currency,
    },
  });
  return true;
}

/** Buy a card from the shop. When haggled=true, applies 30% discount before deducting. */
export function onShopBuyCard(cardIndex: number, haggled = false): boolean {
  const run = get(activeRunState);
  const inventory = get(activeShopInventory);
  if (!run || !inventory) return false;

  const item = inventory.cards[cardIndex];
  if (!item) return false;

  const finalPrice = haggled ? Math.floor(item.price * (1 - SHOP_HAGGLE_DISCOUNT)) : item.price;
  if (run.currency < finalPrice) return false;

  run.currency -= finalPrice;
  if (haggled) run.haggleSuccesses = (run.haggleSuccesses ?? 0) + 1;
  run.consumedRewardFactIds.add(item.card.factId);
  addRewardCardToActiveDeck(item.card);
  inventory.cards.splice(cardIndex, 1);
  activeShopInventory.set(inventory);
  activeRunState.set(run);

  analyticsService.track({
    name: 'shop_buy_card',
    properties: {
      card_type: item.card.cardType,
      tier: item.card.tier,
      price: finalPrice,
      base_price: item.price,
      haggled,
      floor: run.floor.currentFloor,
      remaining_currency: run.currency,
    },
  });
  return true;
}

/**
 * Remove a card from the active deck via the shop removal service.
 * Price escalates with each removal: 50g base +25g per prior removal.
 * When haggled=true, applies 30% discount before deducting.
 */
export function onShopBuyRemoval(cardId: string, haggled = false): boolean {
  const run = get(activeRunState);
  if (!run) return false;

  const basePrice = removalPrice(run.cardsRemovedAtShop ?? 0);
  const finalPrice = haggled ? Math.floor(basePrice * (1 - SHOP_HAGGLE_DISCOUNT)) : basePrice;
  if (run.currency < finalPrice) return false;

  const { soldCard } = sellCardFromActiveDeck(cardId);
  if (!soldCard) return false;

  run.currency -= finalPrice;
  run.cardsRemovedAtShop = (run.cardsRemovedAtShop ?? 0) + 1;
  if (haggled) run.haggleSuccesses = (run.haggleSuccesses ?? 0) + 1;

  // Update removal cost in shop inventory to reflect new count
  const inventory = get(activeShopInventory);
  if (inventory) {
    inventory.removalCost = removalPrice(run.cardsRemovedAtShop);
    activeShopInventory.set(inventory);
  }
  activeRunState.set(run);

  analyticsService.track({
    name: 'shop_buy_removal',
    properties: {
      card_id: cardId,
      card_type: soldCard.cardType,
      tier: soldCard.tier,
      price: finalPrice,
      base_price: basePrice,
      haggled,
      floor: run.floor.currentFloor,
      remaining_currency: run.currency,
    },
  });
  return true;
}

/**
 * Record a haggle attempt for telemetry (called when a haggle quiz answer is submitted).
 * Call regardless of correct/wrong outcome.
 */
export function recordHaggleAttempt(): void {
  const run = get(activeRunState);
  if (!run) return;
  run.haggleAttempts = (run.haggleAttempts ?? 0) + 1;
  activeRunState.set(run);
}

export function onShopDone(): void {
  const run = get(activeRunState);
  if (!run) return;
  activeShopCards.set([]);
  activeShopInventory.set(null);
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);
  activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
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
  // Generate a new act map for the next segment (seed offset by segment for deterministic but varied maps)
  run.floor.actMap = generateActMap(run.floor.segment, run.runSeed + run.floor.segment);
  activeRunState.set(run);
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

export function getCurrentDelvePenalty(): number {
  const run = get(activeRunState);
  if (!run) return 1;
  const nextFloor = run.floor.currentFloor + 1;
  const segment = getSegment(nextFloor);
  return DEATH_PENALTY[segment];
}

/**
 * Called when the player taps a node on the dungeon map.
 * Updates map state, derives floor scaling, and routes to the appropriate room.
 * For combat/elite/boss nodes, only updates map state — the caller (CardApp)
 * handles Phaser boot and encounter start to avoid race conditions.
 */
export function onMapNodeSelected(nodeId: string): void {
  const run = get(activeRunState);
  if (!run || !run.floor.actMap) return;

  const node = run.floor.actMap.nodes[nodeId];
  if (!node) return;

  // Select the node on the map (marks it 'current', unlocks children, locks siblings)
  selectMapNode(run.floor.actMap, nodeId);

  // Derive equivalent floor number for difficulty scaling
  const derivedFloor = deriveFloorFromNode(run.floor.actMap, node);
  run.floor.currentFloor = derivedFloor;
  run.floor.segment = getSegment(derivedFloor);

  // Mark boss floor if this is a boss node
  if (node.type === 'boss') {
    run.floor.isBossFloor = true;
  }

  activeRunState.set(run);

  // Track analytics
  analyticsService.track({
    name: 'room_selected',
    properties: {
      room: node.type,
      floor: run.floor.currentFloor,
      encounter: run.floor.currentEncounter,
    },
  });

  // For combat-type nodes, DON'T call onRoomSelected — the caller handles
  // Phaser boot + encounter start to avoid the "encounter already active" race.
  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
    return;
  }

  // Non-combat nodes: route via onRoomSelected
  const room: RoomOption = {
    type: node.type as RoomOption['type'],
    icon: '',
    label: node.type,
    detail: '',
    hidden: false,
  };
  onRoomSelected(room);
}

export async function onRoomSelected(room: RoomOption): Promise<void> {
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
      holdScreenTransition();
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
      {
        const treasureRun = get(activeRunState);
        if (treasureRun) {
          treasureRun.currency += 15;
          treasureRun.floor.lastSlotWasEvent = true;
          activeRunState.set(treasureRun);
        }
      }
      openCardReward();
      return;
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
  resetEncounterBridge()
  activeRunState.set(null);
  campfireReturnScreen.set(null);
  gameFlowState.set('idle');
  currentScreen.set('hub');
}

export function abandonActiveRun(): void {
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  destroyRunRng()
  resetEncounterBridge()
  clearActiveRun();
  activeRunState.set(null);
  activeCardRewardOptions.set([]);
  activeRewardBundle.set(null);
  activeRewardRevealStep.set('gold');
  activeShopCards.set([]);
  activeShopInventory.set(null);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
  activeRelicRewardOptions.set([]);
  activeRelicPickup.set(null);
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
export function autoSaveRun(screen: string): void {
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
      runSeed: (activeRunMode === 'standard' || activeRunMode === 'endless_depths') ? run.runSeed : null,
      roomOptions: get(activeRoomOptions),
      cardRewardOptions: get(activeCardRewardOptions),
      activeRewardBundle: get(activeRewardBundle),
      rewardRevealStep: get(activeRewardRevealStep),
      encounterSnapshot: serializeEncounterSnapshot(),
    });
  } catch {
    // Silently fail — save is best-effort
  }
}

/** Prepare upgrade candidates and transition to upgrade selection screen. */
export function openUpgradeSelection(): boolean {
  const candidates = prepareUpgradeCandidates();
  if (candidates.length === 0) {
    return false;
  }
  activeUpgradeCandidates.set(candidates);
  gameFlowState.set('upgradeSelection');
  currentScreen.set('upgradeSelection');
  return true;
}

export function hasRestUpgradeCandidates(): boolean {
  return prepareUpgradeCandidates().length > 0;
}

/** Prepare upgrade candidates from the active deck. */
function prepareUpgradeCandidates(): Array<{ card: Card; preview: UpgradePreview }> {
  const allCards = getActiveDeckCards();
  const candidates = getUpgradeCandidates(allCards, Infinity);
  return candidates.map(card => {
    const preview = getUpgradePreview(card);
    return { card, preview: preview! };
  }).filter(c => c.preview != null);
}

/** Called when the player selects a card to upgrade. */
export function onUpgradeSelected(cardId: string): void {
  const run = get(activeRunState);
  if (!run) return;

  // Find the card in the active deck and upgrade it
  const allCards = getActiveDeckCards();
  const card = allCards.find(c => c.id === cardId);
  if (card) {
    upgradeCard(card);
    run.cardsUpgraded = (run.cardsUpgraded ?? 0) + 1;
    activeRunState.set(run);
  }

  activeUpgradeCandidates.set([]);
  onRestResolved();
}

/** Called when the player skips upgrade selection. */
export function onUpgradeSkipped(): void {
  activeUpgradeCandidates.set([]);
  onRestResolved();
}

// ---------------------------------------------------------------------------
// Study (quiz-gated card upgrading)
// ---------------------------------------------------------------------------

/**
 * Generate 3 study questions from the run's current fact pool.
 * Falls back to any available facts if the pool is too small.
 */
export function generateStudyQuestions(): QuizQuestion[] {
  const allFacts = factsDB.getAll();
  const factMap = new Map(allFacts.map(f => [f.id, f]));

  // Get fact IDs from the run's pool cards
  const poolCards = getRunPoolCards();
  const poolFactIds = [...new Set(poolCards.map(c => c.factId))];

  // Filter to facts that have valid quiz data
  const validPoolIds = poolFactIds.filter(id => {
    const fact = factMap.get(id);
    return fact && fact.quizQuestion && fact.correctAnswer && (fact.distractors ?? []).length >= 1;
  });

  // If pool too small, supplement from all facts
  let candidateIds = validPoolIds;
  if (candidateIds.length < 3) {
    const allValidIds = allFacts
      .filter(f => f.quizQuestion && f.correctAnswer && (f.distractors ?? []).length >= 1)
      .map(f => f.id);
    candidateIds = [...new Set([...validPoolIds, ...allValidIds])];
  }

  const selected = shuffled(candidateIds).slice(0, 3);

  const questions: QuizQuestion[] = [];
  for (const factId of selected) {
    const fact = factMap.get(factId);
    if (!fact) continue;
    const distractors = (fact.distractors ?? []).slice(0, 3);
    const answers = shuffled([fact.correctAnswer, ...distractors]);
    questions.push({
      factId: fact.id,
      question: fact.quizQuestion,
      answers,
      correctAnswer: fact.correctAnswer,
      categoryL2: fact.categoryL2,
    });
  }

  return questions;
}

/**
 * Called when Study quiz completes.
 * Upgrades one random eligible card per correct answer.
 */
export function onStudyComplete(correctCount: number): void {
  const run = get(activeRunState);
  if (!run) return;

  const allCards = getActiveDeckCards();
  for (let i = 0; i < correctCount; i++) {
    const candidates = getUpgradeCandidates(allCards, Infinity).filter(c => !c.isUpgraded);
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    upgradeCard(pick);
    run.cardsUpgraded = (run.cardsUpgraded ?? 0) + 1;
  }

  activeRunState.set(run);
  onRestResolved();
}

// ---------------------------------------------------------------------------
// Meditate (deck thinning)
// ---------------------------------------------------------------------------

/**
 * Get all active deck cards for the meditate card picker.
 */
export function getMeditateCandidates(): Card[] {
  return getActiveDeckCards();
}

/**
 * Called when player confirms card removal via Meditate.
 */
export function onMeditateRemove(cardId: string): void {
  sellCardFromActiveDeck(cardId);
  onRestResolved();
}

/**
 * Returns true if Meditate is available (deck must have more than 5 cards).
 */
export function canMeditate(): boolean {
  return getActiveDeckCards().length > 5;
}

/** Opens the post-mini-boss rest overlay with heal + upgrade. */
export function openPostMiniBossRest(): void {
  const run = get(activeRunState);
  if (!run) return;

  // Apply the heal
  const healAmount = Math.round(run.playerMaxHp * POST_MINI_BOSS_HEAL_PCT);
  healPlayer(run, healAmount);
  activeRunState.set(run);

  // Prepare upgrade candidates
  const candidates = prepareUpgradeCandidates();
  activeUpgradeCandidates.set(candidates);
  gameFlowState.set('postMiniBossRest');
  currentScreen.set('postMiniBossRest');
}

/** Called when the player selects a card to upgrade from post-mini-boss rest. */
export function onPostMiniBossUpgradeSelected(cardId: string): void {
  const run = get(activeRunState);
  if (!run) return;

  const allCards = getActiveDeckCards();
  const card = allCards.find(c => c.id === cardId);
  if (card) {
    upgradeCard(card);
    run.cardsUpgraded = (run.cardsUpgraded ?? 0) + 1;
    activeRunState.set(run);
  }

  activeUpgradeCandidates.set([]);
  // Continue to relic/card reward flow
  openCardReward();
}

/** Called when the player skips upgrade from post-mini-boss rest. */
export function onPostMiniBossUpgradeSkipped(): void {
  activeUpgradeCandidates.set([]);
  openCardReward();
}

export function onMysteryResolved(): void {
  const run = get(activeRunState);
  if (!run) return;
  activeMysteryEvent.set(null)
  activeMasteryChallenge.set(null)
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);
  activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

export function onRestResolved(): void {
  const run = get(activeRunState);
  if (!run) return;
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);
  activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

export function returnToMenu(): void {
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  destroyRunRng()
  clearActiveRun();
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  activeRewardBundle.set(null);
  activeRewardRevealStep.set('gold');
  activeShopCards.set([]);
  activeShopInventory.set(null);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
  activeRelicRewardOptions.set([]);
  activeRelicPickup.set(null);
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
  destroyRunRng()
  clearActiveRun();
  activeRunState.set(null);
  activeRunEndData.set(null);
  activeCardRewardOptions.set([]);
  activeRewardBundle.set(null);
  activeRewardRevealStep.set('gold');
  activeShopCards.set([]);
  activeShopInventory.set(null);
  activeMysteryEvent.set(null);
  activeSpecialEvent.set(null);
  activeMasteryChallenge.set(null);
  activeRelicRewardOptions.set([]);
  activeRelicPickup.set(null);
  pendingFloorCompleted = false;
  pendingSpecialEvent = false;
  pendingClearedFloor = 0;
  pendingDomainSelection = null;
  // Always use deck mode from hub selector (defaults to "general" = all topics)
  const replaySave = get(playerSave);
  pendingDeckMode = replaySave?.activeDeckMode ?? { type: 'general' as const };
  pendingDomainSelection = { primary: 'general_knowledge', secondary: 'general_knowledge' };

  const onboarding = get(onboardingState);
  if (onboarding.runsCompleted < ARCHETYPE_UNLOCK_RUNS) {
    onArchetypeSelected('balanced');
    return;
  }
  gameFlowState.set('archetypeSelection');
  currentScreen.set('archetypeSelection');
}

export function restoreRunMode(runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge', dailySeed?: number | null, runSeed?: number | null): void {
  if (runMode === 'daily_expedition' && typeof dailySeed === 'number' && Number.isFinite(dailySeed)) {
    activeRunMode = 'daily_expedition'
    activeDailySeed = dailySeed
    activateDeterministicRandom(dailySeed)
    initRunRng(dailySeed)
    return
  }
  if (runMode === 'scholar_challenge' && typeof dailySeed === 'number' && Number.isFinite(dailySeed)) {
    activeRunMode = 'scholar_challenge'
    activeDailySeed = dailySeed
    activateDeterministicRandom(dailySeed)
    initRunRng(dailySeed)
    return
  }
  if (runMode === 'endless_depths' && typeof runSeed === 'number' && Number.isFinite(runSeed)) {
    activeRunMode = 'endless_depths'
    activeDailySeed = null
    activateDeterministicRandom(runSeed)
    initRunRng(runSeed)
    return
  }
  if (runMode === 'standard' && typeof runSeed === 'number' && Number.isFinite(runSeed)) {
    activeRunMode = 'standard'
    activeDailySeed = null
    activateDeterministicRandom(runSeed)
    initRunRng(runSeed)
    return
  }
  activeRunMode = 'standard'
  activeDailySeed = null
  deactivateDeterministicRandom()
  destroyRunRng()
}
