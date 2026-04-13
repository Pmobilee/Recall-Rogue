/**
 * Screen routing and run flow state machine for card roguelite.
 */

import { writable, get } from 'svelte/store';
import { currentScreen, activeRewardBundle, activeRewardRevealStep, holdScreenTransition, combatExitRequested, combatExitEnemyId, type Screen } from '../ui/stores/gameState';
import type { RunState, RunEndData } from './runManager';
import { createRunState, endRun } from './runManager';
import type { RewardArchetype } from './runManager';
import { healPlayer } from './runManager';
import type { RoomOption, MysteryEvent, MysteryEffect } from './floorManager';
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
import { DEATH_PENALTY, POST_MINI_BOSS_HEAL_PCT, SHOP_RELIC_PRICE, SHOP_HAGGLE_DISCOUNT, RELIC_SELL_REFUND_PCT, RELIC_REROLL_COST, RELIC_REROLL_MAX, RELIC_BOSS_CHOICES, RELIC_PITY_THRESHOLD, RELIC_RARITY_WEIGHTS, RELIC_BONUS_CHANCE_REWARD_ROOM, HEALTH_VIAL_DROP_CHANCE } from '../data/balance';
import { generateCardRewardOptionsByType, rerollRewardCardInType } from './rewardGenerator';
import {
  addRewardCardToActiveDeck,
  activeTurnState,
  getActiveDeckCards,
  getActiveDeckFactIds,
  getRunPoolCards,
  registerEncounterCompleteHandler,
  resetEncounterBridge,
  serializeEncounterSnapshot,
  sellCardFromActiveDeck,
  startEncounterForRoom,
  getLastNarrativeEncounterSnapshot,
  clearNarrativeEncounterSnapshot,
  resolveNarrativeFact,
  getCombatScene,
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
import { STORY_MODE_FORCED_RUNS, ARCHETYPE_UNLOCK_RUNS, START_AP_PER_TURN } from '../data/balance';
import { updateBounties } from './bountyManager';
import { resetCanaryFloor } from './canaryService';
import {
  applyMasteryTrialOutcome,
  applyRunAccuracyBonus,
  playerSave,
  persistPlayer,
  prioritizeGraduatedRelicFact,
  recordRunComplete,
  awardRunXP,
} from '../ui/stores/playerData';
import { recordRunCompleted as recordRunForReview, checkBossKillTrigger } from './reviewPromptService';
import { captureRunSummary, lastRunSummary } from './hubState';
import type { RunSummary } from '../data/types';
import {
  getRunNumberForDomain,
  incrementDomainRunCount,
  isEarlyBoostActiveForDomain,
} from './runEarlyBoostController';
import { analyticsService } from './analyticsService';
import type { SpecialEvent } from '../data/specialEvents';
import { rollSpecialEvent } from '../data/specialEvents';
import { saveActiveRun, loadActiveRun, clearActiveRun, hasActiveRun } from './runSaveService'
import { playCardAudio } from './cardAudioManager'
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
import { isRelicSlotsFull, getMaxRelicSlots, resolveMaxHpBonusV2 } from './relicEffectResolver'
import type { UpgradePreview } from './cardUpgradeService';
import { getUpgradeCandidates, getUpgradePreview, upgradeCard, canMasteryUpgrade, masteryUpgrade } from './cardUpgradeService'
import type { QuizQuestion } from './bossQuizPhase';
import { factsDB } from './factsDB';
import { selectNonCombatStudyQuestion, selectNonCombatCustomDeckQuestion } from './nonCombatQuizSelector';
import { getConfusionMatrix } from './confusionMatrixStore';
import type { ShopInventory } from './shopService';
import { generateShopRelics, priceShopCards, removalPrice, transformPrice, applySaleDiscount, getSalePrice } from './shopService';
import type { DeckMode } from '../data/studyPreset'
import { precomputeChainDistribution } from './chainDistribution'
import { generateActMap, selectMapNode, deriveFloorFromNode, type ActMap } from './mapGenerator'
import { getBossForFloor } from './floorManager'
import { ENEMY_TEMPLATES } from '../data/enemies'
import { ambientAudio } from './ambientAudioService'
import type { AmbientContext } from './ambientAudioService'
import { getFloorTheme } from '../data/roomAtmosphere'
import {
  initNarrative,
  recordEncounterResults,
  getNarrativeLines,
  recordShopPurchase,
  recordRestAction,
  resetNarrative,
} from './narrativeEngine'
import { preloadNarrativeData } from './narrativeLoader'
import { showNarrative } from '../ui/stores/narrativeStore'
import { CHAIN_TYPES } from '../data/chainTypes'
import { unlockAchievement } from './steamService'
import { startRaceProgressBroadcast, updateLocalProgress, stopRaceProgressBroadcast } from './multiplayerGameService'
import { getCurrentLobby } from './multiplayerLobbyService'
import { computeRaceScore } from './multiplayerScoring'
import type { MultiplayerMode } from '../data/multiplayerTypes'
import { ensureCuratedDeckLoaded } from '../data/curatedDeckStore'
import { injectChessPuzzlesForDeck } from './chessRunInjection'
// Fire-and-forget: preload narrative JSON data in parallel with other init.
// The loader warns but never throws if narrative files are absent.
void preloadNarrativeData();

// ── Steam Achievements ────────────────────────────────────────────────────────

/**
 * Fire-and-forget achievement unlock. Safe to call redundantly — Steam ignores
 * re-unlocks. Suppresses floating promise lint warnings.
 */
function tryUnlock(id: string): void {
  void unlockAchievement(id);
}

/**
 * Check cumulative per-save achievements that require totalling across runs.
 * Call at run end (after playerSave has been updated with the run's stats).
 */
function checkCumulativeAchievements(): void {
  const save = get(playerSave);
  if (!save) return;

  // Cumulative correct quiz answers
  const totalCorrect = save.stats.totalQuizCorrect;
  if (totalCorrect >= 100) tryUnlock('FACTS_100');
  if (totalCorrect >= 1000) tryUnlock('FACTS_1000');
  if (totalCorrect >= 5000) tryUnlock('FACTS_5000');

  // Cumulative elite kills — tracked in bestFloor proxy via elitesDefeated field
  // (stored in stats when each run ends via recordRunComplete; we derive from
  // totalDivesCompleted as a proxy — see ELITE_SLAYER note below)
  // Since PlayerStats does not yet track cumulative elites, we accumulate via
  // the save.stats extension field; gracefully handle missing field.
  const cumulativeElites = (save.stats as any).totalElitesDefeated as number | undefined;
  if ((cumulativeElites ?? 0) >= 10) tryUnlock('ELITE_SLAYER');

  // Cumulative mastery — facts that reached tier 3 across all runs
  const factsMastered = save.stats.lifetimeFactsMastered ?? 0;
  if (factsMastered >= 1) tryUnlock('MASTERY_FIRST');
  if (factsMastered >= 100) tryUnlock('MASTERY_100');
  if (factsMastered >= 500) tryUnlock('MASTERY_500');

  // Daily play streak
  if ((save.longestStreak ?? 0) >= 7) tryUnlock('STREAK_7');

  // Unique curated decks used across runs
  const uniqueDecks = new Set(
    (save.runHistory ?? []).filter(r => r.deckId).map(r => r.deckId)
  ).size;
  if (uniqueDecks >= 5) tryUnlock('DECK_EXPLORER');
}

/**
 * Set ambient audio context for a combat encounter based on floor and boss status.
 * Call at every combat start point.
 */
function setCombatAmbient(floor: number, isBoss: boolean): void {
  if (isBoss) {
    void ambientAudio.setContext('boss_arena')
    ambientAudio.addBossOverlay()
  } else {
    const theme = getFloorTheme(floor)
    void ambientAudio.setContext(`combat_${theme}` as AmbientContext)
  }
}

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
  | 'restMeditate'
  | 'studyUpgradeSelection'
  | 'runPreview';
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

/**
 * Set when Study quiz completes with upgradeable cards.
 * The UI subscribes to this and shows the card picker (multi mode).
 * Cleared by onStudyUpgradeConfirmed() after the player makes their selection.
 */
export const pendingStudyUpgrade = writable<{ count: number; candidates: Card[] } | null>(null);

/**
 * Set when a card transform is initiated in the shop.
 * The UI subscribes to this and shows the card picker (single mode) for the player to choose one.
 * Cleared by onShopTransformChoice() after the player selects a replacement card.
 */
export const pendingTransformOptions = writable<Card[] | null>(null);

let pendingFloorCompleted = false;
let pendingSpecialEvent = false;
let pendingClearedFloor = 0;
let pendingPostCombatAction: (() => void) | null = null;

/**
 * Guard against `onEncounterComplete` being called more than once per encounter.
 * Set to true when the handler starts processing and cleared when `proceedAfterReward`
 * navigates back to the dungeon map (i.e. the reward flow is fully complete).
 * Prevents a stale encounterBridge 550 ms timer from triggering a spurious second
 * completion in the rare case where it fires after a new encounter has started.
 */
let isProcessingEncounterResult = false;
/**
 * Set to true when the current reward is for an elite, mini-boss, or boss encounter.
 * Elite/boss rewards always include a health vial; normal combat uses HEALTH_VIAL_DROP_CHANCE.
 */
let pendingRewardIsEliteOrBoss = false;
let pendingDomainSelection: { primary: FactDomain; secondary: FactDomain } | null = null;
type ActiveRunMode = 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge' | 'multiplayer_race'
let activeRunMode: ActiveRunMode = 'standard'
let multiplayerSeed: number | null = null
let multiplayerModeState: MultiplayerMode | null = null
let stopRaceBroadcastFn: (() => void) | null = null

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

/** Called by CardApp when the combat exit transition animation finishes. */
export function onCombatExitComplete(): void {
  combatExitRequested.set(false);
  combatExitEnemyId.set(null);
  const action = pendingPostCombatAction;
  pendingPostCombatAction = null;
  if (action) action();
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

export function startNewRun(options?: {
  includeOutsideDueReviews?: boolean;
  multiplayerSeed?: number;
  multiplayerMode?: MultiplayerMode;
}): void {
  activeRunMode = 'standard'
  activeDailySeed = null
  pendingIncludeOutsideDueReviews = options?.includeOutsideDueReviews ?? false
  if (options?.multiplayerMode) {
    activeRunMode = 'multiplayer_race'
    multiplayerSeed = options.multiplayerSeed ?? null
    multiplayerModeState = options.multiplayerMode
  }
  deactivateDeterministicRandom()
  destroyRunRng()
  resetEncounterBridge()  // clear stale encounter state from previous run
  // Always set deck mode from hub selector, even for onboarding flow
  const save = get(playerSave);
  pendingDeckMode = save?.activeDeckMode ?? { type: 'general' as const };
  const onboarding = get(onboardingState);
  // Skip onboarding for multiplayer races — both players should enter the dungeon
  // simultaneously. Single-player onboarding is irrelevant in MP context.
  if (!onboarding.hasCompletedOnboarding && activeRunMode !== 'multiplayer_race') {
    gameFlowState.set('idle');
    currentScreen.set('onboarding');
    return;
  }
  // Placeholder domains (pool builder uses deckMode, not these)
  pendingDomainSelection = { primary: 'general_knowledge', secondary: 'general_knowledge' };

  // Archetype selection disabled — always use balanced (see GAME_DESIGN.md)
  onArchetypeSelected('balanced');
  return;
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
    lastSessionDate: save.lastPlayDate ?? null,
    nearMilestoneDomain: null,
    factsToMilestone: Infinity,
  };

  void rescheduleNotifications(playerData);
}

function finishRunAndReturnToHub(run: RunState, endData: RunEndData, prebuiltSummary?: RunSummary): void {
  // Always clear the encounter-result guard when a run ends, regardless of path.
  isProcessingEncounterResult = false;
  // Clear narrative state on run end
  resetNarrative();
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

  // Store last deck mode for "repeat last run" default
  if (run.deckMode) {
    const currentSave = get(playerSave);
    if (currentSave) {
      playerSave.set({ ...currentSave, lastRunDeckMode: run.deckMode });
      persistPlayer();
    }
  }
  // Send race finish update and stop broadcast for multiplayer race
  if (activeRunMode === 'multiplayer_race') {
    const lobby = getCurrentLobby();
    const localId = lobby?.players.find(p => p.isHost !== undefined)?.id ?? 'local';
    updateLocalProgress({
      playerId: localId,
      floor: run.floor.currentFloor,
      playerHp: run.playerHp,
      playerMaxHp: run.playerMaxHp,
      score: computeRaceScore(run),
      accuracy: run.factsAnswered > 0 ? run.factsCorrect / run.factsAnswered : 0,
      encountersWon: run.encountersWon,
      isFinished: true,
      result: endData.result,
    });
    stopRaceBroadcastFn?.();
    stopRaceBroadcastFn = null;
  }

  activeRunMode = 'standard'
  activeDailySeed = null
  multiplayerSeed = null
  multiplayerModeState = null
  deactivateDeterministicRandom()
  destroyRunRng()
  resetEncounterBridge()
  clearActiveRun();

  // Award run currency as grey matter (skip for practice runs)
  if (!endData.isPracticeRun && endData.currencyEarned > 0) {
    playerSave.update(s => {
      if (!s) return s;
      return {
        ...s,
        minerals: {
          ...s.minerals,
          greyMatter: (s.minerals?.greyMatter ?? 0) + endData.currencyEarned,
        },
      };
    });
    persistPlayer();
  }

  // Award XP (skip for practice runs)
  if (!endData.isPracticeRun) {
    const xpResult = awardRunXP({
      floorsCleared: endData.floorReached - 1, // floor 1 is starting floor
      combatsWon: endData.encountersWon,
      elitesDefeated: endData.elitesDefeated,
      miniBossesDefeated: endData.miniBossesDefeated,
      bossesDefeated: endData.bossesDefeated,
      questionsCorrect: endData.correctAnswers,
      questionsTotal: endData.factsAnswered,
      speedBonuses: 0, // TODO: track speed bonuses in future
      maxStreak: endData.bestCombo,
      newFactsEncountered: endData.newFactsLearned,
      completedRun: endData.result === 'victory',
      retreated: endData.result === 'retreat',
      ascensionLevel: run.ascensionLevel ?? 0,
    });
    // Attach XP result to endData for RunEndScreen display
    (endData as any).xpResult = xpResult;
    playCardAudio('xp-award');
    if (xpResult.levelsGained > 0) {
      playCardAudio('level-up');
      // Steam achievements: character level milestones
      if (xpResult.newLevel >= 5) tryUnlock('LEVEL_5');
      if (xpResult.newLevel >= 15) tryUnlock('LEVEL_15');
      if (xpResult.newLevel >= 25) tryUnlock('LEVEL_25');
    }
  }

  // Steam achievements: run-completion milestones
  if (!endData.isPracticeRun) {
    tryUnlock('FIRST_RUN_COMPLETE');

    if (endData.floorReached >= 5) tryUnlock('FLOOR_5');
    if (endData.floorReached >= 12) tryUnlock('FLOOR_12');
    if (endData.floorReached >= 24) tryUnlock('FLOOR_24');

    if (endData.bestCombo >= 10) tryUnlock('STREAK_10');
    if (endData.bestCombo >= 25) tryUnlock('STREAK_25');

    if (endData.relicsCollected !== undefined && endData.relicsCollected >= 5) tryUnlock('RELIC_COLLECTOR');

    const ascLevel = run.ascensionLevel ?? 0;
    if (ascLevel >= 1 && (endData.result === 'victory' || endData.result === 'retreat')) {
      tryUnlock('ASCENSION_1');
    }
    if (ascLevel >= 5 && (endData.result === 'victory' || endData.result === 'retreat')) {
      tryUnlock('ASCENSION_5');
    }

    // Cumulative achievements (read from save after XP/stats have been applied)
    checkCumulativeAchievements();
  }

  // factStateSummary is now computed inside endRun() from snapshot diffs — no post-hoc patch needed.

  lastRunSummary.set(prebuiltSummary ?? captureRunSummary(run, endData));
  activeRunEndData.set(endData);
  activeRunState.set(null);
  activeCardRewardOptions.set([]);
  activeRewardBundle.set(null);
  activeRewardRevealStep.set('gold');
  activeShopCards.set([]);
  activeShopInventory.set(null);
  pendingTransformOptions.set(null);
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
  // Navigate to runEnd screen first — player must see run summary before returning to hub.
  // Hub navigation happens when player clicks 'Play Again' or 'Return to Hub' on RunEndScreen.
  currentScreen.set('runEnd');
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

  // Archetype selection disabled — always use balanced (see GAME_DESIGN.md)
  onArchetypeSelected('balanced');
  return;
}

export async function onArchetypeSelected(archetype: RewardArchetype): Promise<void> {
  const pending = pendingDomainSelection;
  if (!pending) return;
  const save = get(playerSave);
  const runNumber = save ? getRunNumberForDomain(save, pending.primary) : 1;
  const earlyBoostActive = save ? isEarlyBoostActiveForDomain(save, pending.primary) : true;
  const selectedAscensionLevel = getAscensionLevel();
  const ascensionModifiers = getAscensionModifiers(selectedAscensionLevel);
  // Starter deck size: ascension overrides take priority; default is 15.
  const starterDeckSize = ascensionModifiers.starterDeckSizeOverride ?? 15;

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
    startingAp: START_AP_PER_TURN,
    primaryDomainRunNumber: runNumber,
    earlyBoostActive,
    ascensionLevel: selectedAscensionLevel,
    deckMode: pendingDeckMode ?? undefined,
    includeOutsideDueReviews: pendingIncludeOutsideDueReviews,
    providedSeed: multiplayerSeed ?? undefined,
    multiplayerMode: multiplayerModeState ?? undefined,
  });
  pendingDeckMode = null;
  pendingIncludeOutsideDueReviews = false;

  // Build reviewStateSnapshot for Journal/Profile tracking.
  // Snapshot current FSRS state per fact so endRun() can compute tier deltas.
  {
    const currentSave = get(playerSave);
    const reviewStates = currentSave?.reviewStates ?? [];
    const snapshot = new Map<string, { cardState: string; stability: number; tier: string }>();
    for (const rs of reviewStates) {
      const factId = (rs as unknown as Record<string, unknown>)['factId'] as string | undefined ?? (rs as unknown as Record<string, unknown>)['id'] as string | undefined;
      if (!factId) continue;
      const tier = getCardTier({
        stability: rs.stability ?? (rs as unknown as Record<string, unknown>)['interval'] as number ?? 0,
        consecutiveCorrect: rs.consecutiveCorrect ?? (rs as unknown as Record<string, unknown>)['repetitions'] as number ?? 0,
        passedMasteryTrial: rs.passedMasteryTrial ?? false,
      });
      snapshot.set(factId, {
        cardState: (rs as unknown as Record<string, unknown>)['cardState'] as string ?? 'new',
        stability: rs.stability ?? 0,
        tier,
      });
    }
    run.reviewStateSnapshot = snapshot;
    run.firstTimeFactIds = new Set<string>();
    run.tierAdvancedFactIds = new Set<string>();
    run.masteredThisRunFactIds = new Set<string>();
    // Capture deck label for run history display
    if (run.deckMode?.type === 'study') {
      run.runDeckId = run.deckMode.deckId;
      run.runDeckLabel = run.deckMode.deckId; // UI can resolve to human label; store ID for now
    } else if (run.deckMode?.type === 'custom_deck' && run.deckMode.items.length > 0) {
      run.runDeckId = run.deckMode.items[0].deckId;
      run.runDeckLabel = run.deckMode.items.map(i => i.deckId).join(', ');
    } else if (run.deckMode?.type === 'study-multi') {
      const deckIds = run.deckMode.decks.map(e => e.deckId);
      const parts = [
        ...deckIds,
        ...run.deckMode.triviaDomains,
      ];
      run.runDeckId = deckIds[0]; // Primary key is first deck (may be undefined for trivia-only)
      run.runDeckLabel = parts.join(', ') || 'study-multi';
    }
  }

  analyticsService.track({
    name: 'domain_select',
    properties: {
      primary: pending.primary,
      secondary: pending.secondary,
      archetype,
      run_number: runNumber,
      starter_deck_size: starterDeckSize,
      starting_ap: START_AP_PER_TURN,
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
      starting_ap: START_AP_PER_TURN,
      starter_deck_size: starterDeckSize,
      run_number: runNumber,
      ascension_level: selectedAscensionLevel,
    },
  });
  run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
  // Generate the initial ActMap for the first segment
  run.floor.actMap = generateActMap(run.floor.segment, run.runSeed);

  // Precompute chain distribution for curated study runs (eager, before pool build).
  // This allows the RunPreviewScreen to show topic-to-chain mapping before combat starts.
  if (run.deckMode) {
    const reviewStates = get(playerSave)?.reviewStates ?? [];
    const dist = precomputeChainDistribution(run.deckMode, reviewStates, run.runSeed);
    if (dist) {
      run.chainDistribution = dist;
    }
  }

  activeRunState.set(run);
  // Ensure narrative data is loaded before initializing the narrative engine
  await preloadNarrativeData();
  initNarrative(run);
  playCardAudio('domain-select');
  playCardAudio('run-start');
  // Chess runtime puzzle injection — replace baked fallback with live Elo-targeted
  // Lichess puzzles when starting a chess_tactics run. Graceful fallback on DB unavailability.
  await injectChessPuzzlesForDeck(run.runDeckId);

  // Initialize forked RNG system for all modes that use a seed
  initRunRng(run.runSeed);
  // Activate deterministic random for standard and endless_depths runs
  if (activeRunMode === 'standard' || activeRunMode === 'endless_depths') {
    activateDeterministicRandom(run.runSeed);
  }

  // Start multiplayer race progress broadcast
  if (activeRunMode === 'multiplayer_race') {
    stopRaceBroadcastFn = startRaceProgressBroadcast(() => {
      const r = get(activeRunState);
      if (!r) {
        return {
          playerId: 'local',
          floor: 0,
          playerHp: 0,
          playerMaxHp: 0,
          score: 0,
          accuracy: 0,
          encountersWon: 0,
          isFinished: true,
        };
      }
      const lobby = getCurrentLobby();
      const localId = lobby?.players.find(p => p.isHost)?.id ?? 'local';
      return {
        playerId: localId,
        floor: r.floor.currentFloor,
        playerHp: r.playerHp,
        playerMaxHp: r.playerMaxHp,
        score: computeRaceScore(r),
        accuracy: r.factsAnswered > 0 ? r.factsCorrect / r.factsAnswered : 0,
        encountersWon: r.encountersWon,
        isFinished: false,
      };
    });
  }

  pendingDomainSelection = null;

  // Route to run preview screen if a chain distribution was computed (Study Temple).
  // Trivia/general runs go directly to the dungeon map (no preview).
  if (run.chainDistribution) {
    // AR-59.12: No starter relic. Runs start with 0 relics. First relic earned at Act 1 mini-boss.
    gameFlowState.set('runPreview');
    currentScreen.set('runPreview');
  } else {
    // AR-59.12: No starter relic. Runs start with 0 relics. First relic earned at Act 1 mini-boss.
    // Show run_start narrative before entering dungeon map
    const startLines = getNarrativeLines({
      roomType: 'combat',  // dummy — run_start beat triggers on room count = 0
      isPostBoss: false,
      isPostEncounter: false,
      floor: run.floor.currentFloor,
      segment: run.floor.segment as 1 | 2 | 3 | 4,
      playerHp: run.playerHp,
      playerMaxHp: run.playerMaxHp,
      relicIds: run.runRelics.map(r => r.definitionId),
      currentStreak: 0,
      chainColors: [],  // Trivia path — no chain distribution at run start
      topicLabels: undefined,
    });
    if (startLines.length > 0) {
      showNarrative(startLines, 'click-through');
    }
    gameFlowState.set('dungeonMap');
    currentScreen.set('dungeonMap');
  }
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

    // vitality_ring: apply +20 max HP at run start
    const relicIds = new Set(run.runRelics.map(r => r.definitionId));
    const hpBonus = resolveMaxHpBonusV2(relicIds);
    if (hpBonus > 0) {
      run.playerMaxHp += hpBonus;
      run.playerHp += hpBonus;
    }
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
    isProcessingEncounterResult = false;
    gameFlowState.set('dungeonMap');
    currentScreen.set('dungeonMap');
    autoSaveRun('dungeonMap');
    return;
  }
  // === End map-based progression ===

  const floorToResolve = pendingClearedFloor || run.floor.currentFloor;
  if (pendingFloorCompleted) {
    playCardAudio('floor-cleared');
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
    // Spec 04: floor descent ceremony — fire Phaser particle/shake effects and DOM event for Svelte
    getCombatScene()?.playDescentEffects(run.floor.currentFloor, run.floor.isBossFloor);
    if (activeRunMode === 'endless_depths') {
      applyEndlessDepthsScaling(run)
    }
    run.canary = resetCanaryFloor(run.canary);
    run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
    activeRunState.set(run);
  }

  // After encounter 2, auto-start encounter 3 (mini-boss/boss) — no room selection
  if (run.floor.currentEncounter === run.floor.encountersPerFloor) {
    // Reset guard now — encounter 3 will need its own onEncounterComplete call
    isProcessingEncounterResult = false;
    // Set ambient for encounter 3 (boss/mini-boss floor final encounter)
    setCombatAmbient(run.floor.currentFloor, isBossFloor(run.floor.currentFloor));
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
  isProcessingEncounterResult = false;
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

function openCardReward(): void {
  const run = get(activeRunState);
  if (!run) return;

  // AR-262: Apply accuracy grade bonuses to reward generation
  const rewardBundle = get(activeRewardBundle);
  const accuracyGrade = rewardBundle?.accuracyGrade;
  const guaranteeUncommon = accuracyGrade === 'S';
  const typeCount = 3;

  const options = generateCardRewardOptionsByType(
    getRunPoolCards(),
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    run.selectedArchetype,
    run.floor.currentFloor,
    typeCount,
    guaranteeUncommon,
  );

  if (options.length === 0) {
    void proceedAfterReward();
    return;
  }

  const bundle = get(activeRewardBundle);
  const totalGold = bundle ? bundle.goldEarned : 0;
  const healAmount = bundle ? bundle.healAmount : 0;

  const rewards: RewardItem[] = [];
  // Always include gold (minimum 5 from encounter)
  const displayGold = totalGold > 0 ? totalGold : 5;
  rewards.push({ type: 'gold', amount: displayGold });
  // Include health vial: always for elite/boss, 10% chance for normal combat
  const isElevatedReward = pendingRewardIsEliteOrBoss;
  pendingRewardIsEliteOrBoss = false; // consume the flag
  if (isElevatedReward || Math.random() < HEALTH_VIAL_DROP_CHANCE) {
    const displayHeal = healAmount > 0 ? healAmount : 8;
    rewards.push({ type: 'health_vial', size: displayHeal > 15 ? 'large' : 'small', healAmount: displayHeal });
  }
  for (const card of options) {
    rewards.push({ type: 'card', card });
  }

  // 8% chance per floor to include a bonus relic alongside card choices
  if (!run.floor.bonusRelicOfferedThisFloor && Math.random() < RELIC_BONUS_CHANCE_REWARD_ROOM) {
    const relicPool = buildRelicPool();
    if (relicPool.length > 0) {
      const bonusRelic = relicPool[Math.floor(Math.random() * relicPool.length)];
      rewards.push({ type: 'relic', relic: bonusRelic });
      run.floor.bonusRelicOfferedThisFloor = true;
      activeRunState.set(run);
    }
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
  const playerLevel = save.characterLevel ?? 0
  return getEligibleRelicPool(unlockedIds, excludedIds, heldIds, playerLevel)
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
 * Opens a treasure room with 3 relic choices from the player's unlocked pool.
 * Uses the RewardRoomScene with relic-only items.
 * Falls back to proceeding directly to map (no gold, no cards) if no eligible relics remain.
 * Treasure rooms are relic-only — they do NOT chain to openCardReward().
 */
function openTreasureRoom(): void {
  const run = get(activeRunState);
  if (!run) return;

  // Mark as event room for flow tracking
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);

  // Build relic pool from character-unlocked relics, excluding already-held
  const pool = buildRelicPool();

  if (pool.length === 0) {
    // Fallback: no relics available — proceed directly to map, no gold, no cards
    void proceedAfterReward();
    return;
  }

  // Pick up to 3 random relics from the pool
  const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
  const choices = shuffledPool.slice(0, Math.min(3, shuffledPool.length));

  // Use the relic choice reward room flow with a custom onComplete that skips card reward
  gameFlowState.set('relicReward');
  const relicRewards: RewardItem[] = choices.map((relic) => ({ type: 'relic' as const, relic }));
  void openRewardRoom(
    relicRewards,
    // onGoldCollected — no gold in treasure room
    (_amount) => {},
    // onVialCollected — no vial in treasure room
    (_healAmt) => {},
    // onCardAccepted — no cards in treasure room
    (_card) => {},
    // onRelicAccepted — player chose a relic; apply slot enforcement
    (relic) => {
      addRelicToRun(relic);
    },
    // onComplete — proceed directly to map, bypassing openCardReward()
    () => {
      activeRelicRewardOptions.set([]);
      showRoomExitNarrative('treasure');
      void proceedAfterReward();
    },
  );
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

  // Remove boss overlay when combat ends (safe to call even if no overlay is active)
  ambientAudio.removeBossOverlay()

  // Guard: prevent double-processing if a stale 550 ms timer fires after the reward flow
  // has already completed and a new encounter has started. This is the root cause of Bug 9
  // (second encounter immediately skips to reward) and Bug 10 (broken third encounter state).
  if (isProcessingEncounterResult) {
    if (import.meta.env.DEV) console.warn('[GameFlow] onEncounterComplete called while already processing — ignoring duplicate call');
    return;
  }
  isProcessingEncounterResult = true;

  // Enemy ID for exit transition is captured by encounterBridge BEFORE clearing activeTurnState

  run.encountersTotal += 1;
  if (result === 'victory') {
    run.encountersWon += 1;
    // Track defeated enemy for run-end screen
    const exitEnemyId = get(combatExitEnemyId);
    if (exitEnemyId) {
      (run.defeatedEnemyIds ??= []).push(exitEnemyId);
    }
    const encounterWasFlawless = run.currentEncounterWrongAnswers === 0;
    run.bounties = updateBounties(run.bounties, {
      type: 'encounter_won',
      flawless: encounterWasFlawless,
    });
    run.currentEncounterWrongAnswers = 0;

    // Track enemy type for XP calculation (read node/floor before advancing)
    const victoryNodeId = run.floor.actMap?.currentNodeId ?? null;
    const victoryNode = victoryNodeId ? run.floor.actMap?.nodes[victoryNodeId] ?? null : null;
    const victoryFloor = run.floor.currentFloor;
    const victoryEncounter = run.floor.currentEncounter;
    const victoryWasMiniBoss = isMiniBossEncounter(victoryFloor, victoryEncounter);
    if (victoryNode?.type === 'elite') {
      run.elitesDefeated += 1;
      // Increment cumulative elite counter in save for ELITE_SLAYER achievement
      playerSave.update(s => {
        if (!s) return s;
        const prev = (s.stats as any).totalElitesDefeated as number | undefined;
        return { ...s, stats: { ...s.stats, totalElitesDefeated: (prev ?? 0) + 1 } as any };
      });
    } else if (victoryNode?.type === 'boss' || (isBossFloor(victoryFloor) && victoryEncounter === run.floor.encountersPerFloor)) {
      run.bossesDefeated += 1;
      // Achievement: defeat a boss
      tryUnlock('BOSS_SLAYER');
    } else if (victoryWasMiniBoss) {
      run.miniBossesDefeated += 1;
    }

    // Achievement: first combat victory
    if (run.encountersWon === 1) {
      tryUnlock('FIRST_VICTORY');
    }

    // Achievement: flawless encounter (0 wrong answers, captured before reset above)
    if (encounterWasFlawless) {
      tryUnlock('PERFECT_ENCOUNTER');
      // Track perfect encounters for multiplayer scoring
      run.perfectEncountersCount = (run.perfectEncountersCount ?? 0) + 1;
    }
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
    applyRunCompletionBonuses(run);
    markRunCompleted();
    const endData = endRun(run, 'defeat');
    const summary = captureRunSummary(run, endData);
    recordRunComplete(run.floor.currentFloor, endData, summary);
    isProcessingEncounterResult = false;
    finishRunAndReturnToHub(run, endData, summary);
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

  // Record encounter results in narrative engine using the snapshot captured in encounterBridge
  // before activeTurnState was cleared. Non-blocking; skips silently if narrative not ready.
  {
    const narrativeSnap = getLastNarrativeEncounterSnapshot();
    if (narrativeSnap) {
      const domain = run.primaryDomain ?? 'general_knowledge';
      const fizzledSet = new Set(narrativeSnap.fizzledFactIds);
      const correctAnswers: Array<{ factId: string; answer: string; quizQuestion: string; partOfSpeech?: string; targetLanguageWord?: string; pronunciation?: string; categoryL1?: string; categoryL2?: string; language?: string }> = [];
      const wrongAnswers: Array<{ factId: string; answer: string; quizQuestion: string }> = [];
      for (const factId of narrativeSnap.answeredFactIds) {
        const info = resolveNarrativeFact(factId, run);
        if (!info) continue;
        const entry = { factId: info.factId, answer: info.answer, quizQuestion: info.quizQuestion, partOfSpeech: info.partOfSpeech, targetLanguageWord: info.targetLanguageWord, pronunciation: info.pronunciation, categoryL1: info.categoryL1, categoryL2: info.categoryL2, language: info.language };
        if (fizzledSet.has(factId)) {
          wrongAnswers.push(entry);
        } else {
          correctAnswers.push(entry);
        }
      }
      // Resolve chainCompletions: snapshot holds factId arrays; convert each to answer strings.
      // Sequences that lose facts during resolution (fact not found) and drop below 3 are dropped.
      const chainCompletions: string[][] = narrativeSnap.chainCompletions.map(factIds =>
        factIds.map(fid => resolveNarrativeFact(fid, run)?.answer ?? '').filter(Boolean)
      ).filter(seq => seq.length >= 3);
      recordEncounterResults({
        correctAnswers,
        wrongAnswers,
        chainCompletions,
        enemyId: narrativeSnap.enemyId,
        isBoss: narrativeSnap.isBoss,
        isElite: narrativeSnap.isElite,
        domain,
      });
      clearNarrativeEncounterSnapshot();

      // Show post-encounter narrative lines (non-blocking auto-fade).
      // The overlay auto-dismisses independently; reward screen still proceeds on its own.
      const chainColors = run.chainDistribution?.runChainTypes.map(
        (i: number) => CHAIN_TYPES[i]?.name ?? 'Unknown',
      ) ?? [];
      const topicLabels = run.chainDistribution?.assignments.flatMap(
        (g: Array<{ label?: string }>) => g.map(t => t.label ?? '').filter(Boolean),
      );
      const narrativeLines = getNarrativeLines({
        roomType: narrativeSnap.isBoss ? 'boss' : narrativeSnap.isElite ? 'elite' : 'combat',
        isPostBoss: narrativeSnap.isBoss,
        isPostEncounter: true,
        floor: justCompletedFloor,
        segment: run.floor.segment,
        playerHp: run.playerHp,
        playerMaxHp: run.playerMaxHp,
        relicIds: run.runRelics.map(r => r.definitionId),
        currentStreak: narrativeSnap.streakAtEnd,
        chainColors,
        topicLabels,
      });
      if (narrativeLines.length > 0) {
        showNarrative(narrativeLines, 'click-through');
      }
    }
  }

  pendingFloorCompleted = advanceEncounter(run.floor);
  pendingClearedFloor = run.floor.currentFloor;
  activeRunState.set(run);

  // Relic acquisition — priority: boss > elite > first-mini-boss > subsequent-mini-boss > regular
  const relicPool = buildRelicPool();

  // Determine post-combat action, then trigger exit transition
  if (wasBoss && relicPool.length > 0) {
    const choices = generateBossRelicChoices(relicPool);
    if (choices.length > 0) {
      pendingPostCombatAction = () => {
        resetRelicSelectionRerolls();
        pendingRewardIsEliteOrBoss = true;
        openRelicChoiceRewardRoom(choices, false);
      };
      combatExitRequested.set(true);
      return;
    }
  } else if (wasElite && relicPool.length > 0) {
    const choices = generateMiniBossRelicChoices(relicPool);
    if (choices.length > 0) {
      pendingPostCombatAction = () => {
        resetRelicSelectionRerolls();
        pendingRewardIsEliteOrBoss = true;
        openRelicChoiceRewardRoom(choices, false);
      };
      combatExitRequested.set(true);
      return;
    }
  } else if (wasMiniBoss && !run.firstMiniBossRelicAwarded && relicPool.length > 0) {
    run.firstMiniBossRelicAwarded = true;
    activeRunState.set(run);
    const choices = generateMiniBossRelicChoices(relicPool);
    if (choices.length > 0) {
      pendingPostCombatAction = () => {
        resetRelicSelectionRerolls();
        pendingRewardIsEliteOrBoss = true;
        openRelicChoiceRewardRoom(choices, false);
      };
      combatExitRequested.set(true);
      return;
    }
  } else if (wasMiniBoss && run.firstMiniBossRelicAwarded && relicPool.length > 0) {
    const drop = generateRandomRelicDrop(relicPool, RELIC_RARITY_WEIGHTS, isRelicPityActive());
    if (drop) {
      giveRelicAsToastDrop(drop);
    }
  } else if (!wasBoss && !wasMiniBoss && !wasElite && shouldDropRandomRelic() && relicPool.length > 0) {
    const drop = generateRandomRelicDrop(relicPool, RELIC_RARITY_WEIGHTS, isRelicPityActive());
    if (drop) {
      giveRelicAsToastDrop(drop);
    }
  }

  // Post-mini-boss rest: heal + optional upgrade (for non-first mini-bosses)
  if (wasMiniBoss && run.firstMiniBossRelicAwarded) {
    pendingPostCombatAction = () => openPostMiniBossRest();
    combatExitRequested.set(true);
    return;
  }

  // Mystery-room combat: skip card reward and return to map
  if (isMysteryRoomCombat) {
    isMysteryRoomCombat = false;
    pendingPostCombatAction = () => {
      const freshRun = get(activeRunState);
      if (freshRun) {
        freshRun.floor.lastSlotWasEvent = true;
        activeRunState.set(freshRun);
        activeRoomOptions.set(generateCombatRoomOptions(freshRun.floor.currentFloor));
      }
      gameFlowState.set('dungeonMap');
      currentScreen.set('dungeonMap');
    };
    combatExitRequested.set(true);
    return;
  }

  pendingPostCombatAction = () => openCardReward();
  combatExitRequested.set(true);
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

/**
 * Gaussian approximation using sum of 3 uniform samples (Box-Muller-free).
 * Produces values with mean ≈ `mean` and std dev ≈ `stdDev`.
 * Range is approximately mean ± 1.72 * stdDev (never goes below mean-2σ in practice).
 *
 * Used for shop card mastery display — small spread around deck average.
 */
function approxGaussian(mean: number, stdDev: number): number {
  const u = Math.random() + Math.random() + Math.random();
  return mean + (u - 1.5) * 1.15 * stdDev;
}

function openShopRoom(): void {
  const run = get(activeRunState);
  if (!run) return;

  // Card selling removed (Ch14.2) — clear the sell cards store
  activeShopCards.set([]);

  // Generate buy inventory
  const relicPool = buildRelicPool();
  const hasMerchantsFavor = run.runRelics.some(r => r.definitionId === 'merchants_favor');
  const shopRelicCount = hasMerchantsFavor ? 4 : 3; // merchants_favor: +1 relic option
  const shopRelics = generateShopRelics(run.floor.currentFloor, relicPool, shopRelicCount);

  // Generate card reward options for buying
  const cardRewardOptions = generateCardRewardOptionsByType(
    getRunPoolCards() as any,
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    run.selectedArchetype,
    run.floor.currentFloor,
  );
  const shopCardCount = hasMerchantsFavor ? 4 : 3; // merchants_favor: +1 card option
  const rawShopCards = priceShopCards(cardRewardOptions.slice(0, shopCardCount), run.floor.currentFloor);

  // 14.7 — Apply deck-mean-based mastery to each shop card so the UI shows mastery
  // indicators reflecting where the player currently is in mastery progression.
  // The actual mastery assigned at purchase time is computed independently by
  // addRewardCardToActiveDeck → computeCatchUpMastery.
  const deckCards = getActiveDeckCards();
  const avgMastery = deckCards.length > 0
    ? deckCards.reduce((s, c) => s + (c.masteryLevel ?? 0), 0) / deckCards.length
    : 0;
  const shopCards: import('./shopService').ShopCardItem[] = rawShopCards.map(item => {
    const masteryLevel = Math.max(0, Math.min(5, Math.round(approxGaussian(avgMastery, 0.8))));
    const card: Card = { ...item.card, masteryLevel };
    return { ...item, card };
  });

  // One random card per visit gets a 50% sale discount (applied after floor discount).
  // Haggle still works on top of this price multiplicatively.
  const saleIndex = shopCards.length > 0 ? Math.floor(Math.random() * shopCards.length) : undefined;
  if (saleIndex !== undefined) {
    applySaleDiscount(shopCards, saleIndex);
  }

  const inventory: ShopInventory = {
    relics: shopRelics,
    cards: shopCards,
    removalCost: removalPrice(run.cardsRemovedAtShop ?? 0),
    saleCardIndex: saleIndex,
    transformCost: transformPrice(run.cardsTransformedAtShop ?? 0),
  };
  activeShopInventory.set(inventory);

  analyticsService.track({
    name: 'shop_visit',
    properties: {
      floor: run.floor.currentFloor,
      options: shopCards.length,
      currency: run.currency,
    },
  });
  gameFlowState.set('shopRoom');
  currentScreen.set('shopRoom');
}

/**
 * Card selling has been removed from the shop (Ch14.2).
 * This stub is kept for backward compatibility with CardApp.svelte imports.
 * @deprecated — no longer performs any action
 */
export function onShopSell(_cardId: string): void {
  // Selling removed — no-op
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
  recordShopPurchase('relic');
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
  recordShopPurchase('card');
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
 * Handler for card transformation: deducts gold, destroys the selected card,
 * generates 6 replacement card options (for a 2x3 grid display), and stores them
 * in `pendingTransformOptions` for the UI to display.
 * Price escalates with each transformation: 35g base +25g per prior transform.
 * When haggled=true, applies 30% discount before deducting.
 *
 * Returns true on success, false if insufficient funds or card not found.
 * The UI should subscribe to `pendingTransformOptions` to receive the choices.
 *
 * Replacement options receive catch-up mastery: average of the source card's
 * mastery level and the deck average, floored and capped at the source mastery,
 * so a mastery-3 transform doesn't drop the player back to mastery-0 options.
 *
 * @param cardId - ID of the card to transform.
 * @param haggled - Whether a haggle discount was applied.
 */
export function onShopTransform(cardId: string, haggled = false): boolean {
  const run = get(activeRunState);
  if (!run) return false;

  const cost = transformPrice(run.cardsTransformedAtShop ?? 0);
  const effectiveCost = haggled ? Math.floor(cost * (1 - SHOP_HAGGLE_DISCOUNT)) : cost;

  if (run.currency < effectiveCost) return false;

  const { soldCard } = sellCardFromActiveDeck(cardId);
  if (!soldCard) return false;

  run.currency -= effectiveCost;
  if (haggled) run.haggleSuccesses = (run.haggleSuccesses ?? 0) + 1;
  run.cardsTransformedAtShop = (run.cardsTransformedAtShop ?? 0) + 1;

  // Update transform cost in shop inventory to reflect new count
  const inventory = get(activeShopInventory);
  if (inventory) {
    inventory.transformCost = transformPrice(run.cardsTransformedAtShop);
    activeShopInventory.set(inventory);
  }

  // Generate 6 replacement card options (for a 2×3 grid, same-rarity-or-higher from the run pool)
  const options = generateCardRewardOptionsByType(
    getRunPoolCards() as any,
    getActiveDeckFactIds(),
    run.consumedRewardFactIds,
    run.selectedArchetype,
    run.floor.currentFloor,
  ).slice(0, 6);

  // Apply smart catch-up mastery to replacement options.
  // Transforms a mastery-3 card shouldn't yield all mastery-0 replacements —
  // options get mastery = floor((sourceMastery + deckAvgMastery) / 2),
  // capped at max(sourceMastery, 1) so there is always at least 1 level.
  const sourceMastery = soldCard.masteryLevel ?? 0;
  const deckCards = getActiveDeckCards();
  const avgDeckMastery = deckCards.length > 0
    ? deckCards.reduce((sum, c) => sum + (c.masteryLevel ?? 0), 0) / deckCards.length
    : 0;
  const transformMastery = Math.floor((sourceMastery + avgDeckMastery) / 2);
  for (const opt of options) {
    opt.masteryLevel = Math.min(transformMastery, Math.max(sourceMastery, 1));
  }

  activeRunState.set(run);

  // Expose options to UI via store — cleared by onShopTransformChoice()
  pendingTransformOptions.set(options);

  analyticsService.track({
    name: 'shop_transform',
    properties: {
      floor: run.floor.currentFloor,
      card_id: cardId,
      card_type: soldCard.cardType,
      tier: soldCard.tier,
      cost: effectiveCost,
      base_cost: cost,
      haggled,
      options: options.length,
      source_mastery: sourceMastery,
      transform_mastery: transformMastery,
    },
  });

  return true;
}

/**
 * @deprecated Use onShopTransform() instead — same API with boolean return and store-based options.
 * Retained for backward compatibility.
 */
export function onShopTransformCard(cardId: string, haggled = false): Card[] {
  onShopTransform(cardId, haggled);
  return get(pendingTransformOptions) ?? [];
}

/**
 * Handler for choosing a replacement card after transformation.
 * Adds the chosen card to the active deck at catch-up mastery level,
 * marks its fact as consumed, and clears pendingTransformOptions.
 *
 * @param card - The replacement card chosen by the player.
 */
export function onShopTransformChoice(card: Card): void {
  addRewardCardToActiveDeck(card);

  const run = get(activeRunState);
  if (run) {
    run.consumedRewardFactIds.add(card.factId);
    activeRunState.set(run);
  }

  // Clear the pending transform options — flow returns to shop
  pendingTransformOptions.set(null);

  analyticsService.track({
    name: 'shop_transform_select',
    properties: {
      card_type: card.cardType,
      tier: card.tier,
      fact_id: card.factId,
    },
  });
}

/**
 * @deprecated Use onShopTransformChoice() instead.
 * Retained for backward compatibility.
 */
export function onShopTransformSelect(card: Card): void {
  onShopTransformChoice(card);
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

/**
 * Show exit narration for a special room (shop/rest/mystery/treasure).
 * Narration fires on EXIT — never on room entry — so the player sees it
 * after experiencing the room content, just before returning to the map.
 *
 * @param roomType  The room type string for NarrativeContext.
 * @param mysteryRoomId  Optional mystery event ID (for 13.4 pool-specific templates).
 */
function showRoomExitNarrative(
  roomType: 'shop' | 'rest' | 'mystery' | 'treasure',
  mysteryRoomId?: string,
): void {
  const run = get(activeRunState);
  if (!run) return;
  const chainColors = run.chainDistribution?.runChainTypes.map(
    (i: number) => CHAIN_TYPES[i]?.name ?? 'Unknown',
  ) ?? [];
  const topicLabels = run.chainDistribution?.assignments.flatMap(
    (g: Array<{ label?: string }>) => g.map(t => t.label ?? '').filter(Boolean),
  );
  const narrativeLines = getNarrativeLines({
    roomType,
    isPostBoss: false,
    isPostEncounter: false,
    floor: run.floor.currentFloor,
    segment: run.floor.segment,
    playerHp: run.playerHp,
    playerMaxHp: run.playerMaxHp,
    relicIds: run.runRelics.map(r => r.definitionId),
    currentStreak: 0,
    chainColors,
    topicLabels,
    mysteryRoomId,
  });
  if (narrativeLines.length > 0) {
    showNarrative(narrativeLines, 'click-through');
  }
}

export function onShopDone(): void {
  const run = get(activeRunState);
  if (!run) return;
  activeShopCards.set([]);
  activeShopInventory.set(null);
  pendingTransformOptions.set(null);
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);
  showRoomExitNarrative('shop');
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
  applyRunCompletionBonuses(run);
  markRunCompleted();
  if (isAscensionSuccess(run, 'retreat')) {
    progressAscensionAfterSuccess(run)
  }
  // Boss kill review prompt (retreat always follows a boss floor)
  void checkBossKillTrigger();
  const endData = endRun(run, 'retreat');
  const summary = captureRunSummary(run, endData);
  recordRunComplete(run.floor.currentFloor, endData, summary);
  finishRunAndReturnToHub(run, endData, summary);
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
  // Spec 04: floor descent ceremony — fire Phaser particle/shake effects and DOM event for Svelte
  getCombatScene()?.playDescentEffects(run.floor.currentFloor, run.floor.isBossFloor);
  playCardAudio('floor-transition');
  if (activeRunMode === 'endless_depths') {
    applyEndlessDepthsScaling(run)
  }
  run.canary = resetCanaryFloor(run.canary);
  run.bounties = updateBounties(run.bounties, { type: 'floor_reached', floor: run.floor.currentFloor });
  // Generate a new act map for the next segment (seed offset by segment for deterministic but varied maps)
  run.floor.actMap = generateActMap(run.floor.segment, run.runSeed + run.floor.segment);
  activeRunState.set(run);
  isProcessingEncounterResult = false;
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
 * Returns the display name of the boss defeated on the current/most recent boss floor.
 * Falls back to a generic name if the boss cannot be determined.
 */
export function getDefeatedBossName(): string {
  const run = get(activeRunState);
  if (!run) return 'the Boss';
  const bossId = getBossForFloor(run.floor.currentFloor);
  if (!bossId) return 'the Boss';
  const template = ENEMY_TEMPLATES.find(t => t.id === bossId);
  return template?.name ?? 'the Boss';
}

/**
 * Called when the player taps a node on the dungeon map.
 * Updates map state, derives floor scaling, and routes to the appropriate room.
 * For combat/elite/boss nodes, only updates map state — the caller (CardApp)
 * handles Phaser boot and encounter start to avoid race conditions.
 */
export function onMapNodeSelected(nodeId: string): void {
  if (isProcessingEncounterResult) {
    if (import.meta.env.DEV) console.warn('[GameFlow] Node selected while still processing encounter result — ignoring');
    return;
  }
  const run = get(activeRunState);
  if (!run || !run.floor.actMap) return;

  const node = run.floor.actMap.nodes[nodeId];
  if (!node) return;

  // Select the node on the map (marks it 'current', unlocks children, locks siblings)
  selectMapNode(run.floor.actMap, nodeId);
  playCardAudio('map-node-click');

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
      // Set ambient for regular combat encounter
      if (run) setCombatAmbient(run.floor.currentFloor, false)
      gameFlowState.set('combat');
      holdScreenTransition();
      currentScreen.set('combat');
      break;
    case 'mystery':
      // Guard: ensure curated deck is loaded before opening mystery room (13.2).
      // In study mode, some mystery events (e.g. flashcard_merchant) need deck facts.
      if (run?.deckMode?.type === 'study' && run.deckMode.deckId) {
        await ensureCuratedDeckLoaded(run.deckMode.deckId);
        // Late injection: if chess-puzzles.db became ready after run start, inject now.
        // injectChessPuzzlesForDeck is a no-op when already injected or DB still not ready.
        await injectChessPuzzlesForDeck(run.deckMode.deckId);
      }
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
      activeMysteryEvent.set(generateMysteryEvent(run?.floor.currentFloor ?? 1));
      gameFlowState.set('mysteryEvent');
      currentScreen.set('mysteryEvent');
      break;
    case 'rest':
      gameFlowState.set('restRoom');
      currentScreen.set('restRoom');
      break;
    case 'treasure':
      openTreasureRoom();
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
    playCardAudio('mastery-trial-pass')
  } else {
    applyMasteryTrialOutcome(challenge.factId, false)
    playCardAudio('mastery-trial-fail')
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
  // Auto-save with the original screen so a reload restores the correct encounter
  autoSaveRun(currentState);
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
    // Resuming combat from campfire — restore ambient
    const campfireRun = get(activeRunState)
    if (campfireRun) setCombatAmbient(campfireRun.floor.currentFloor, isBossFloor(campfireRun.floor.currentFloor))
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

export function abandonActiveRun(returnScreen?: Screen): void {
  // Load the persisted run state to check whether any encounters were completed.
  // loadActiveRun() returns a fully deserialized RunState (Sets re-wrapped) so
  // we can call encountersWon safely without further hydration.
  const saved = loadActiveRun();
  const savedRun = saved?.runState ?? null;

  if (savedRun && savedRun.encountersWon >= 1) {
    // Meaningful run (at least one encounter won) — route through RunEndScreen
    // so the player sees their summary, earns XP, and gets journal/stats entries.
    // Restore mode context so finishRunAndReturnToHub handles mode-specific logic.
    activeRunMode = saved!.runMode ?? 'standard';
    activeDailySeed = saved!.dailySeed ?? null;

    applyRunCompletionBonuses(savedRun);
    markRunCompleted();
    const endData = endRun(savedRun, 'defeat');
    const summary = captureRunSummary(savedRun, endData);
    recordRunComplete(savedRun.floor.currentFloor, endData, summary);
    // finishRunAndReturnToHub handles all cleanup (clearActiveRun, store resets,
    // XP award, achievements, analytics) and navigates to 'runEnd'.
    finishRunAndReturnToHub(savedRun, endData, summary);
    return;
  }

  // Pre-encounter abandon (encountersWon === 0) or no saved run: silent discard.
  // Also covers the RunPreview "Back" button path where no encounters have started.
  // returnScreen is preserved for callers like handleRunPreviewBack('studyTemple').
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
  pendingTransformOptions.set(null);
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
  currentScreen.set(returnScreen ?? 'hub');
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
  // getActiveDeckCards() returns [] when activeDeck is null (between encounters).
  // Fall back to the run pool, which always contains the player's cards.
  const allCards = getActiveDeckCards();
  const cards = allCards.length > 0 ? allCards : getRunPoolCards();
  return cards.some(c => canMasteryUpgrade(c));
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

  recordRestAction('upgrade');
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
 * In study mode (curated deck runs), uses selectNonCombatStudyQuestion to draw
 * from the full deck pool with FSRS-aware selection and deck-specific templates.
 * In trivia mode, falls back to factsDB pool selection.
 */
export function generateStudyQuestions(): QuizQuestion[] {
  const run = get(activeRunState);

  // Study mode branch: use curated deck selector
  if (run?.deckMode?.type === 'study') {
    const confusionMatrix = getConfusionMatrix();
    const inRunTracker = run.inRunFactTracker ?? null;
    const questions: QuizQuestion[] = [];
    // Track already-selected fact IDs across iterations to prevent duplicate questions.
    // selectNonCombatStudyQuestion only excludes the single lastFactId from tracker, so
    // without this accumulating set the same fact can appear twice in a 3-question batch.
    const excludeFactIds = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const q = selectNonCombatStudyQuestion(
        'rest',
        run.deckMode.deckId,
        run.deckMode.subDeckId,
        confusionMatrix,
        inRunTracker,
        1,
        run.runSeed + i * 1000,
        run.deckMode.examTags,
        undefined, // meditatedThemeId
        excludeFactIds,
      );
      if (q) {
        excludeFactIds.add(q.factId);
        questions.push({
          factId: q.factId,
          question: q.question,
          answers: q.choices,
          correctAnswer: q.correctAnswer,
          quizMode: q.quizMode,
          imageAssetPath: q.imageAssetPath,
          answerImagePaths: q.answerImagePaths,
          sentenceFurigana: q.sentenceFurigana,
          sentenceRomaji: q.sentenceRomaji,
          sentenceTranslation: q.sentenceTranslation,
          grammarPointLabel: q.grammarPointLabel,
          // Chess puzzle fields — must be forwarded so chess_move mode renders correctly
          fenPosition: q.fenPosition,
          solutionMoves: q.solutionMoves,
          lichessRating: q.lichessRating,
          quizResponseMode: q.quizResponseMode,
          // Map pin fields
          mapCoordinates: q.mapCoordinates,
          mapRegion: q.mapRegion,
          mapDifficultyTier: q.mapDifficultyTier,
        });
      }
    }
    if (questions.length > 0) return questions;
    // Fall through to trivia path if no study questions could be generated
  }

  // Custom deck mode branch: use curated deck selector across all custom deck items
  if (run?.deckMode?.type === 'custom_deck') {
    const confusionMatrix = getConfusionMatrix();
    const inRunTracker = run.inRunFactTracker ?? null;
    const factSourceDeckMap = run.factSourceDeckMap ?? {};
    const questions: QuizQuestion[] = [];
    const excludeFactIds = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const q = selectNonCombatCustomDeckQuestion(
        'rest',
        run.deckMode.items,
        factSourceDeckMap,
        confusionMatrix,
        inRunTracker,
        1,
        run.runSeed + i * 1000,
        undefined, // meditatedThemeId
        excludeFactIds,
      );
      if (q) {
        excludeFactIds.add(q.factId);
        questions.push({
          factId: q.factId,
          question: q.question,
          answers: q.choices,
          correctAnswer: q.correctAnswer,
          quizMode: q.quizMode,
          imageAssetPath: q.imageAssetPath,
          answerImagePaths: q.answerImagePaths,
          sentenceFurigana: q.sentenceFurigana,
          sentenceRomaji: q.sentenceRomaji,
          sentenceTranslation: q.sentenceTranslation,
          grammarPointLabel: q.grammarPointLabel,
          // Chess puzzle fields — must be forwarded so chess_move mode renders correctly
          fenPosition: q.fenPosition,
          solutionMoves: q.solutionMoves,
          lichessRating: q.lichessRating,
          quizResponseMode: q.quizResponseMode,
          // Map pin fields
          mapCoordinates: q.mapCoordinates,
          mapRegion: q.mapRegion,
          mapDifficultyTier: q.mapDifficultyTier,
        });
      }
    }
    if (questions.length > 0) return questions;
    // Fall through to trivia path if no custom deck questions could be generated
  }

  const allFacts = factsDB.getTriviaFacts();
  const factMap = new Map(allFacts.map(f => [f.id, f]));

  // Get fact IDs from the player's run pool (the deck cards for this run)
  const poolCards = getRunPoolCards();
  const poolFactIds = [...new Set(poolCards.map(c => c.factId))];

  // Filter to pool facts that have valid quiz data (question + answer + at least 1 distractor)
  const validPoolIds = poolFactIds.filter(id => {
    const fact = factMap.get(id);
    return fact && fact.quizQuestion && fact.correctAnswer && (fact.distractors ?? []).length >= 1;
  });

  // Only use deck facts — never fall back to random DB facts.
  // If fewer than 3 valid pool facts exist, use however many are available.
  const candidateIds = validPoolIds;

  // Prefer cards that can still be mastery-upgraded
  const upgradableCards = poolCards.filter(c => canMasteryUpgrade(c));
  const priorityFactIds = upgradableCards.length >= 3
    ? [...new Set(upgradableCards.map(c => c.factId))].filter(id => candidateIds.includes(id))
    : candidateIds;

  const finalCandidates = priorityFactIds.length >= 3 ? priorityFactIds : candidateIds;
  const selected = shuffled(finalCandidates).slice(0, 3);

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
 * If upgrade candidates exist, sets pendingStudyUpgrade and transitions to
 * studyUpgradeSelection so the player can choose which cards to upgrade.
 * Falls through to onRestResolved() when no upgradeable cards are available.
 */
export function onStudyComplete(correctFactIds: string[]): void {
  const run = get(activeRunState);
  if (!run) return;

  const upgradeCount = correctFactIds.length;
  const upgradeCandidates = getActiveDeckCards().filter(c => canMasteryUpgrade(c));

  if (upgradeCount > 0 && upgradeCandidates.length > 0) {
    // Defer to the picker UI — don't auto-upgrade
    pendingStudyUpgrade.set({
      count: Math.min(upgradeCount, upgradeCandidates.length),
      candidates: upgradeCandidates,
    });
    gameFlowState.set('studyUpgradeSelection');
    return;
  }

  // No upgrades available — proceed normally
  onRestResolved();
}

/**
 * Called when the player confirms their card selections in the study upgrade picker.
 * Applies mastery upgrades to the selected cards, clears the pending store, and
 * resumes the rest flow via onRestResolved().
 */
export function onStudyUpgradeConfirmed(selectedCards: Card[]): void {
  const run = get(activeRunState);
  if (!run) return;

  for (const card of selectedCards) {
    if (canMasteryUpgrade(card)) {
      masteryUpgrade(card);
      run.cardsUpgraded = (run.cardsUpgraded ?? 0) + 1;
    }
  }

  activeRunState.set(run);
  pendingStudyUpgrade.set(null);
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
  // Capture event ID before clearing (needed for per-event narration templates — 13.4).
  const mysteryEventId = get(activeMysteryEvent)?.id;
  activeMysteryEvent.set(null)
  activeMasteryChallenge.set(null)
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);
  showRoomExitNarrative('mystery', mysteryEventId);
  activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

/** Flag: true when we're in a mystery-room combat so post-combat skips the card reward. */
let isMysteryRoomCombat = false;

/**
 * Handle a mystery event effect and route to the appropriate next screen.
 * Replaces the old CardApp.handleMysteryResolve + onMysteryResolved pattern.
 */
export function onMysteryEffectResolved(effect: MysteryEffect): void {
  const run = get(activeRunState);
  if (!run) return;

  // Capture event ID before applying/clearing — needed for per-event narration (13.4).
  const mysteryEventId = get(activeMysteryEvent)?.id;

  // Apply all single-step effects directly
  applyMysteryEffect(effect, run);

  // Route based on effect type
  switch (effect.type) {
    case 'combat': {
      // Trigger a mystery-room combat. No card reward after.
      isMysteryRoomCombat = true;
      activeMysteryEvent.set(null);
      activeMasteryChallenge.set(null);
      activeRunState.set(run);
      // Transition to combat screen and start the encounter
      // Set ambient for mystery room combat
      setCombatAmbient(run.floor.currentFloor, false)
      gameFlowState.set('combat');
      holdScreenTransition();
      currentScreen.set('combat');
      void startEncounterForRoom();
      break;
    }
    case 'cardReward': {
      activeMysteryEvent.set(null);
      activeMasteryChallenge.set(null);
      run.floor.lastSlotWasEvent = true;
      activeRunState.set(run);
      openCardReward();
      break;
    }
    default: {
      // All other effects (heal, damage, currency, maxHpChange, upgradeRandomCard,
      // removeRandomCard, healPercent, transformCard, freeCard, nothing, choice)
      // already applied above — return to map.
      activeMysteryEvent.set(null);
      activeMasteryChallenge.set(null);
      run.floor.lastSlotWasEvent = true;
      activeRunState.set(run);
      showRoomExitNarrative('mystery', mysteryEventId);
      activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
      gameFlowState.set('dungeonMap');
      currentScreen.set('dungeonMap');
      break;
    }
  }
}

/**
 * Apply a single mystery effect to the run state (mutates run in-place).
 * Does NOT persist run state or route screens.
 */
function applyMysteryEffect(effect: MysteryEffect, run: RunState): void {
  switch (effect.type) {
    case 'heal':
      run.playerHp = Math.min(run.playerHp + effect.amount, run.playerMaxHp);
      break;
    case 'damage':
      run.playerHp = Math.max(0, run.playerHp - effect.amount);
      break;
    case 'healPercent': {
      const healAmount = Math.round((effect.percent / 100) * run.playerMaxHp);
      run.playerHp = Math.min(run.playerHp + healAmount, run.playerMaxHp);
      break;
    }
    case 'currency':
      run.currency = Math.max(0, run.currency + effect.amount);
      break;
    case 'maxHpChange':
      run.playerMaxHp = Math.max(1, run.playerMaxHp + effect.amount);
      run.playerHp = Math.min(run.playerHp, run.playerMaxHp);
      break;
    case 'upgradeRandomCard': {
      const allCards = getActiveDeckCards();
      const eligible = allCards.filter(c => canMasteryUpgrade(c));
      if (eligible.length > 0) {
        const card = eligible[Math.floor(Math.random() * eligible.length)];
        masteryUpgrade(card);
      }
      break;
    }
    case 'removeRandomCard': {
      const allCards = getActiveDeckCards();
      const removable = allCards;
      if (removable.length > 5) {
        const card = removable[Math.floor(Math.random() * removable.length)];
        sellCardFromActiveDeck(card.id); // removes from deck (gold returned is discarded)
      }
      break;
    }
    case 'transformCard': {
      const allCards = getActiveDeckCards();
      const transformable = allCards;
      if (transformable.length > 0) {
        const card = transformable[Math.floor(Math.random() * transformable.length)];
        const TRANSFORM_TYPES: Array<'attack' | 'shield' | 'heal' | 'buff'> = ['attack', 'shield', 'heal', 'buff'];
        const others = TRANSFORM_TYPES.filter(t => t !== card.cardType);
        card.cardType = others[Math.floor(Math.random() * others.length)] as typeof card.cardType;
      }
      break;
    }
    case 'compound':
      for (const subEffect of effect.effects) {
        applyMysteryEffect(subEffect, run);
      }
      break;
    case 'random': {
      const outcomeIdx = Math.floor(Math.random() * effect.outcomes.length);
      for (const subEffect of effect.outcomes[outcomeIdx]) {
        applyMysteryEffect(subEffect, run);
      }
      break;
    }
    case 'choice':
      // Choice effects are pre-resolved by the overlay before calling this function.
      // When a choice is picked, the overlay calls onresolve with the chosen sub-effect.
      // So we recurse on the chosen effect if it arrives here directly.
      // (normally the overlay picks a sub-effect and calls onresolve with it)
      break;
    case 'curseRandomCards': {
      const run2 = get(activeRunState);
      if (run2) {
        const allCards = getActiveDeckCards();
        const uncursed = allCards.filter(c => c.factId && !run2.cursedFactIds.has(c.factId));
        const toCount = Math.min(effect.count, uncursed.length);
        const shuffled = [...uncursed].sort(() => Math.random() - 0.5);
        for (let i = 0; i < toCount; i++) {
          run2.cursedFactIds.add(shuffled[i].factId!);
        }
      }
      break;
    }
    case 'upgradeAllCards': {
      const allCards = getActiveDeckCards();
      for (const card of allCards) {
        if (canMasteryUpgrade(card)) {
          masteryUpgrade(card);
        }
      }
      break;
    }
    case 'freeCard':
    case 'nothing':
    case 'combat':
    case 'cardReward':
    case 'doubleOrNothing':
    case 'speedRound':
    case 'cardRoulette':
    case 'factOrFiction':
    case 'knowledgeShop':
      // Handled by routing logic in onMysteryEffectResolved / MysteryEventOverlay UI
      break;
  }
}

/**
 * Called after a mystery-room combat completes (win or lose path).
 * Skips the card reward and returns straight to the map.
 */
export function onMysteryRoomCombatComplete(): void {
  if (!isMysteryRoomCombat) return;
  isMysteryRoomCombat = false;
  const run = get(activeRunState);
  if (!run) return;
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);
  activeRoomOptions.set(generateCombatRoomOptions(run.floor.currentFloor));
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}

/**
 * Whether the current combat is a mystery-room encounter (no post-combat card reward).
 */
export function getIsMysteryRoomCombat(): boolean {
  return isMysteryRoomCombat;
}

export function onRestResolved(): void {
  const run = get(activeRunState);
  if (!run) return;
  run.floor.lastSlotWasEvent = true;
  activeRunState.set(run);
  showRoomExitNarrative('rest');
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
  pendingTransformOptions.set(null);
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
  pendingTransformOptions.set(null);
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

  // Archetype selection disabled — always use balanced (see GAME_DESIGN.md)
  onArchetypeSelected('balanced');
  return;
}

export function restoreRunMode(runMode?: 'standard' | 'daily_expedition' | 'endless_depths' | 'scholar_challenge' | 'multiplayer_race', dailySeed?: number | null, runSeed?: number | null): void {
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

// ---------------------------------------------------------------------------
// Run preview helpers — used by RunPreviewScreen
// ---------------------------------------------------------------------------

/**
 * Recompute the chain distribution for the active run with a new seed offset.
 * Called by the RunPreviewScreen "Shuffle" button so the player can explore
 * different topic-to-chain arrangements before committing.
 *
 * The seed offset is added to the run's base seed to produce a deterministic
 * but distinct arrangement each time the button is pressed.
 *
 * Does nothing if no active run, no deckMode, or no distribution was computed.
 */
export function reshuffleChainDistribution(seedOffset: number): void {
  const run = get(activeRunState);
  if (!run?.deckMode) return;

  const reviewStates = get(playerSave)?.reviewStates ?? [];
  const newSeed = (run.runSeed + seedOffset) >>> 0; // unsigned 32-bit wrap
  const dist = precomputeChainDistribution(run.deckMode, reviewStates, newSeed);
  if (!dist) return;

  activeRunState.update(r => {
    if (!r) return r;
    r.chainDistribution = dist;
    return r;
  });
}

/**
 * Confirm the current chain distribution and proceed to the dungeon map.
 * Called by the RunPreviewScreen "Begin Expedition" button.
 *
 * Does nothing if no active run.
 */
export async function confirmChainDistribution(): Promise<void> {
  const run = get(activeRunState);
  if (!run) return;

  // Ensure narrative data is loaded (may already be from onArchetypeSelected)
  await preloadNarrativeData();

  // Show run_start narrative before entering dungeon map (Study Temple path)
  const startLines = getNarrativeLines({
    roomType: 'combat',  // dummy — run_start beat triggers on room count = 0
    isPostBoss: false,
    isPostEncounter: false,
    floor: run.floor.currentFloor,
    segment: run.floor.segment as 1 | 2 | 3 | 4,
    playerHp: run.playerHp,
    playerMaxHp: run.playerMaxHp,
    relicIds: run.runRelics.map(r => r.definitionId),
    currentStreak: 0,
    chainColors: run.chainDistribution?.runChainTypes.map(i => CHAIN_TYPES[i]?.name ?? 'Unknown') ?? [],
    topicLabels: run.chainDistribution?.assignments?.flat().map(g => g.label),
  });
  if (startLines.length > 0) {
    showNarrative(startLines, 'click-through');
  }
  gameFlowState.set('dungeonMap');
  currentScreen.set('dungeonMap');
}
