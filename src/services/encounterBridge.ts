/**
 * Bridge between game flow (screen routing) and combat systems (turn/deck/enemy).
 */

import { writable, get } from 'svelte/store';
import type { TurnState } from './turnManager';
import { startEncounter, playCardAction, skipCard, endPlayerTurn, resolveInscription, getActiveInscription, applyPendingChoice, revertTransmutedCards, resetFactLastSeenEncounter } from './turnManager';
import { initChainSystem } from './chainSystem';
import { selectRunChainTypes } from '../data/chainTypes';
import { buildRunPool, recordRunFacts } from './runPoolBuilder';
import { addCardToDeck, createDeck, drawHand, insertCardWithDelay, addFactsToCooldown, tickFactCooldowns, getEncounterSeenFacts, resetEncounterSeenFacts, forgetCard } from './deckManager';
import { createEnemy, snapshotEnemy, hydrateEnemyFromSnapshot, applyEnemyDeltaToState, rollNextIntent } from './enemyManager';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { activeRunState } from './runStateStore';
import { getBossForFloor, pickCombatEnemy, isBossFloor, isMiniBossEncounter, getMiniBossForFloor, getRegionForFloor, getEnemiesForFloorNode, getActForFloor } from './floorManager';
import type { Card, CardRunState } from '../data/card-types';
import { recordCardPlay } from './runManager';
import type { RunState } from './runManager';
import {
  applyMasteryTrialOutcome,
  awardMasteryCoin,
  getReviewStateByFactId,
  playerSave,
  updateReviewStateByButton,
} from '../ui/stores/playerData';
import { HINTS_PER_ENCOUNTER, POST_ENCOUNTER_HEAL_PCT, RELAXED_POST_ENCOUNTER_HEAL_BONUS, POST_BOSS_ENCOUNTER_HEAL_BONUS, POST_ENCOUNTER_HEAL_CAP, getBalanceValue, STARTER_DECK_COMPOSITION } from '../data/balance';
import { generateCurrencyReward } from './encounterRewards';
import type { CombatScene } from '../game/scenes/CombatScene';
import { factsDB } from './factsDB';
import { RELIC_BY_ID } from '../data/relics/index';
import { onboardingState, difficultyMode } from './cardPreferences';
import { updateBounties } from './bountyManager';
import { juiceManager } from './juiceManager';
import { getCardTier } from './tierDerivation';
import { playCardAudio } from './cardAudioManager';
import { MECHANIC_BY_ID, type PlayMode } from '../data/mechanics';
import { analyticsService } from './analyticsService';

import {
  applyAscensionEnemyTemplateAdjustments,
  getAscensionModifiers,
} from './ascension';
import { activeRewardBundle, dismissScreenTransition, combatExitEnemyId } from '../ui/stores/gameState';
import {
  resolveEncounterStartEffects,
  resolveBaseDrawCount,
} from './relicEffectResolver';
import { applyStatusEffect } from '../data/statusEffects';
import { buildPresetRunPool, buildGeneralRunPool, buildLanguageRunPool, buildCuratedDeckRunPool } from './presetPoolBuilder'
import { getCuratedDeck, getCuratedDeckFact, getCuratedDeckFacts } from '../data/curatedDeckStore'
import type { FactDomain } from '../data/card-types'
import { turboDelay } from '../utils/turboMode'
import { getRunRng, isRunRngActive } from './seededRng'
import {
  awaitCoopTurnEnd,
  awaitCoopTurnEndWithDelta,
  awaitCoopEnemyReconcile,
  CoopReconcileTimeoutError,
  requestCoopEnemyStateRetry,
  cancelCoopTurnEnd,
  isLocalTurnEndPending,
  broadcastPartnerState,
  broadcastSharedEnemyState,
  broadcastEnemyHpUpdate,
  onEnemyHpUpdate,
  getCollectedDeltas,
  handleCoopPlayerDeath,
} from './multiplayerCoopSync'
import { computeRaceScore } from './multiplayerScoring'
import { recordRaceAnswer, hostCreateSharedEnemy } from './multiplayerGameService'
import { isHost as mpIsHost, getCurrentLobby } from './multiplayerLobbyService'
import { calculateFunnessBoostFactor } from './funnessBoost';
import { calculateAccuracyGrade } from './accuracyGradeSystem';
import {
  calculateDeckMastery,
  getCombinedPoolRewardMultiplier,
  getNovelFactPercentage,
  shouldSuppressRewardsForTinyPool,
} from './masteryScalingService';
import { computeCatchUpMastery } from './catchUpMasteryService';
import { deepMerge } from '../dev/deepMerge';
import { getIsMysteryRoomCombat, getIsMysteryRoomCombatElite } from './gameFlowController';
import { initFailsafeWatchdogs, destroyFailsafeWatchdogs, validateEnemyState, handleCoopReconcileFailure, handleCoopBarrierCancel } from './failsafeWatchdogs';
import { rrLog } from './rrLog';

export interface EncounterSnapshot {
  activeDeck: CardRunState | null
  activeRunPool: Card[]
}

/**
 * Snapshot of narrative-relevant encounter data captured just before TurnState is cleared.
 * Populated in the victory settlement timer; consumed by gameFlowController.onEncounterComplete().
 */
export interface NarrativeEncounterSnapshot {
  /** All fact IDs answered (any mode) during this encounter. */
  answeredFactIds: string[];
  /** Fact IDs that produced a fizzle (charge-wrong). */
  fizzledFactIds: string[];
  /** Map of cardId → factId for deck cards, used to resolve fizzle cardIds to factIds. */
  cardIdToFactId: Map<string, string>;
  /** Whether the completed encounter was a boss. */
  isBoss: boolean;
  /** Whether the completed encounter was an elite. */
  isElite: boolean;
  /** Enemy template ID, if known. */
  enemyId?: string;
  /** Consecutive correct streak at encounter end. */
  streakAtEnd: number;
  /**
   * Narrative: completed chain sequences for this encounter.
   * Each inner array contains factIds for a chain that reached 3+ consecutive correct answers.
   * Resolved to answer strings by gameFlowController before passing to recordEncounterResults().
   */
  chainCompletions: string[][];
}

/**
 * Unified fact metadata for narrative echo text generation.
 * Populated from either factsDB (trivia runs) or curatedDeckStore (study / custom_deck runs).
 */
export interface NarrativeFactInfo {
  factId: string;
  answer: string;
  quizQuestion: string;
  partOfSpeech?: string;
  targetLanguageWord?: string;
  pronunciation?: string;
  categoryL1?: string;
  categoryL2?: string;
  language?: string;
}

/**
 * Resolve a fact ID to full narrative metadata.
 * Checks factsDB first (trivia runs); falls back to curatedDeckStore using run.deckMode.
 * Returns null if neither source finds the fact.
 */
export function resolveNarrativeFact(factId: string, run: RunState): NarrativeFactInfo | null {
  // 1. Try trivia factsDB (works for general trivia runs)
  const triviaFact = factsDB.getById(factId);
  if (triviaFact) {
    return {
      factId: triviaFact.id,
      answer: triviaFact.correctAnswer,
      quizQuestion: triviaFact.quizQuestion,
      categoryL1: triviaFact.categoryL1,
      categoryL2: triviaFact.categoryL2,
      language: triviaFact.language,
      pronunciation: triviaFact.pronunciation,
      // partOfSpeech and targetLanguageWord are not on base Fact — left undefined
    };
  }

  // 2. Fall back to curated deck store using run.deckMode
  const deckMode = run.deckMode;
  if (!deckMode) return null;

  if (deckMode.type === 'study') {
    const cur = getCuratedDeckFact(deckMode.deckId, factId);
    if (cur) {
      return {
        factId: cur.id,
        answer: cur.correctAnswer,
        quizQuestion: cur.quizQuestion,
        partOfSpeech: cur.partOfSpeech,
        targetLanguageWord: cur.targetLanguageWord,
        pronunciation: cur.pronunciation,
        categoryL1: cur.categoryL1,
        categoryL2: cur.categoryL2,
        language: cur.language,
      };
    }
  } else if (deckMode.type === 'custom_deck') {
    for (const item of deckMode.items) {
      const cur = getCuratedDeckFact(item.deckId, factId);
      if (cur) {
        return {
          factId: cur.id,
          answer: cur.correctAnswer,
          quizQuestion: cur.quizQuestion,
          partOfSpeech: cur.partOfSpeech,
          targetLanguageWord: cur.targetLanguageWord,
          pronunciation: cur.pronunciation,
          categoryL1: cur.categoryL1,
          categoryL2: cur.categoryL2,
          language: cur.language,
        };
      }
    }
  } else if (deckMode.type === 'study-multi') {
    // Search all curated decks in the multi selection; trivia-domain facts
    // resolve via the factsDB path above, so we only check curated items here.
    for (const entry of deckMode.decks) {
      const cur = getCuratedDeckFact(entry.deckId, factId);
      if (cur) {
        return {
          factId: cur.id,
          answer: cur.correctAnswer,
          quizQuestion: cur.quizQuestion,
          partOfSpeech: cur.partOfSpeech,
          targetLanguageWord: cur.targetLanguageWord,
          pronunciation: cur.pronunciation,
          categoryL1: cur.categoryL1,
          categoryL2: cur.categoryL2,
          language: cur.language,
        };
      }
    }
  }

  return null;
}

/** Module-level storage: snapshot from the most recent victory, cleared after consumption. */
let _lastNarrativeSnapshot: NarrativeEncounterSnapshot | null = null;

/** Create a shallow copy of TurnState with fresh array references for Svelte reactivity. */
function freshTurnState(ts: TurnState): TurnState {
  return {
    ...ts,
    deck: {
      ...ts.deck,
      hand: [...ts.deck.hand],
      drawPile: [...ts.deck.drawPile],
      discardPile: [...ts.deck.discardPile],
      factCooldown: [...ts.deck.factCooldown],
    },
    encounterAnsweredFacts: [...ts.encounterAnsweredFacts],
    // AR-204: preserve active inscriptions across turn state refreshes
    activeInscriptions: [...(ts.activeInscriptions ?? [])],
  };
}

export function getCombatScene(): CombatScene | null {
  try {
    const reg = globalThis as Record<symbol, unknown>;
    const sym = Symbol.for('rr:cardGameManager');
    const mgr = reg[sym] as { getCombatScene(): CombatScene | null; startCombat(): void } | undefined;
    return mgr?.getCombatScene() ?? null;
  } catch {
    return null;
  }
}

export function stopCombatScene(): void {
  try {
    const reg = globalThis as Record<symbol, unknown>;
    const sym = Symbol.for('rr:cardGameManager');
    const mgr = reg[sym] as { stopCombat(): void } | undefined;
    mgr?.stopCombat();
  } catch {
    // ignore
  }
}

function ensureCombatStarted(): void {
  try {
    const reg = globalThis as Record<symbol, unknown>;
    const sym = Symbol.for('rr:cardGameManager');
    const mgr = reg[sym] as { startCombat(): void } | undefined;
    mgr?.startCombat();
  } catch {
    // ignore
  }
}

export const activeTurnState = writable<TurnState | null>(null);

/** Dispatched after enemy turn resolves so the UI can spawn damage/block numbers at player position. */
export interface EnemyDamageEvent {
  damageDealt: number;
  blockGained: number;
}
export const enemyDamageEvent = writable<EnemyDamageEvent | null>(null);

/** True while the local player has ended their turn but is waiting for co-op partners
 *  to do the same. UI uses this to dim the End Turn button and show a "Waiting…" hint. */
export const coopWaitingForPartner = writable<boolean>(false);

/**
 * Reentrancy guard — set to true while handleEndTurn is executing its async body.
 * Prevents a second End Turn call from corrupting deck state during the 2-second
 * enemy phase window. Module-level flag (fast path) + exported writable store (UI path).
 */
let _endTurnInProgress = false;
/** Reactive mirror of _endTurnInProgress — read by CardCombatOverlay to disable the End Turn button. */
export const endTurnInProgress = writable<boolean>(false);

/**
 * Pre-turn enemy snapshot for coop delta computation.
 * Captured at the start of each new turn (after the enemy phase resolves) so
 * handleEndTurn can compute EnemyTurnDelta = (preTurnHP - postCardsHP).
 * Null in solo/race modes.
 */
let _coopPreTurnEnemySnapshot: import('../data/multiplayerTypes').SharedEnemySnapshot | null = null;

/**
 * Cleanup function for the co-op enemy-HP-update subscriber wired at encounter start.
 * Stored here so startEncounterForRoom can re-wire it on each new encounter without leaking.
 */
let _unsubCoopEnemyHpUpdate: (() => void) | null = null;

// ── Boss rotation helpers (AR-98) ──
const LAST_BOSS_KEY = 'recall-rogue-last-boss';

/** Returns the last boss ID fought for a given act number, or null. */
function getLastBossForAct(act: number): string | null {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_BOSS_KEY) ?? '{}') as Record<number, string>;
    return data[act] ?? null;
  } catch {
    return null;
  }
}

/** Persists the last boss fought for a given act number. */
function setLastBossForAct(act: number, bossId: string): void {
  try {
    const data = JSON.parse(localStorage.getItem(LAST_BOSS_KEY) ?? '{}') as Record<number, string>;
    data[act] = bossId;
    localStorage.setItem(LAST_BOSS_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}


// ── Same-floor enemy dedup helpers ──
// Tracks the last regular and elite enemy spawned on the current floor.
// Reset when the floor number changes, ensuring dedup only applies within a single floor.
let _lastFloorEnemyId: string | null = null;
let _lastFloorEliteId: string | null = null;
let _lastFloorTracked: number = -1;

type EncounterCompletionResult = 'victory' | 'defeat';
let encounterCompleteHandler: ((result: EncounterCompletionResult) => void) | null = null;

/**
 * Registers the game-flow callback invoked when an encounter ends.
 */
export function registerEncounterCompleteHandler(
  handler: (result: EncounterCompletionResult) => void,
): void {
  encounterCompleteHandler = handler;
}

function notifyEncounterComplete(result: EncounterCompletionResult): void {
  destroyFailsafeWatchdogs();
  encounterCompleteHandler?.(result);
}

let activeDeck: CardRunState | null = null;
let activeRunPool: Card[] = [];

/**
 * Monotonically increasing counter incremented every time a new encounter starts.
 * The victory/defeat 550 ms timers capture this value and abort if the generation
 * has changed by the time they fire — preventing a completed encounter's timeout
 * from accidentally clearing and completing a freshly-started second encounter.
 */
let encounterGeneration = 0;

function cloneCard(card: Card): Card {
  return { ...card }
}

function cloneDeck(deck: CardRunState): CardRunState {
  return {
    ...deck,
    drawPile: deck.drawPile.map(cloneCard),
    discardPile: deck.discardPile.map(cloneCard),
    hand: deck.hand.map(cloneCard),
    forgetPile: deck.forgetPile.map(cloneCard),
    factPool: [...deck.factPool],
    factCooldown: deck.factCooldown.map((entry) => ({ ...entry })),
  }
}

export function serializeEncounterSnapshot(): EncounterSnapshot {
  return {
    activeDeck: activeDeck ? cloneDeck(activeDeck) : null,
    activeRunPool: activeRunPool.map(cloneCard),
  }
}

export function hydrateEncounterSnapshot(snapshot?: EncounterSnapshot | null): void {
  if (!snapshot) {
    activeDeck = null
    activeRunPool = []
    return
  }
  activeDeck = snapshot.activeDeck ? cloneDeck(snapshot.activeDeck) : null
  activeRunPool = (snapshot.activeRunPool ?? []).map(cloneCard)
}

/**
 * Builds the fixed 10-card starter deck: 5 Strike, 4 Block, 1 Surge (foresight).
 * Cards are drawn from the run pool so they carry real fact IDs and domains.
 * Mechanic slots are filled strictly to STARTER_DECK_COMPOSITION ratios (AR-59.6).
 */
function buildFixedStarterDeck(runPool: Card[]): Card[] {
  const result: Card[] = [];
  const usedIds = new Set<string>();

  for (const { mechanicId, count } of STARTER_DECK_COMPOSITION) {
    const m = MECHANIC_BY_ID[mechanicId];
    if (!m) continue;
    const candidates = runPool.filter(c => !usedIds.has(c.id));
    const picked = candidates.slice(0, count);
    for (const card of picked) {
      result.push({
        ...card,
        cardType: m.type,
        mechanicId: m.id,
        mechanicName: m.name,
        baseEffectValue: m.baseValue,
        originalBaseEffectValue: m.baseValue,
        apCost: m.apCost,
      });
      usedIds.add(card.id);
    }
  }

  return result;
}

function syncCombatScene(turnState: TurnState): void {
  ensureCombatStarted();
  const pushDisplayData = () => {
    const scene = getCombatScene();
    if (!scene) return;
    scene.setEnemy(
      turnState.enemy.template.name,
      turnState.enemy.template.category,
      turnState.enemy.currentHP,
      turnState.enemy.maxHP,
      turnState.enemy.template.id,
      turnState.enemy.template.animArchetype,
    );
    scene.setEnemyIntent(
      turnState.enemy.nextIntent.telegraph,
      turnState.enemy.nextIntent.value > 0 ? turnState.enemy.nextIntent.value : undefined,
    );
    scene.updatePlayerHP(turnState.playerState.hp, turnState.playerState.maxHP, false);
    scene.updatePlayerBlock(turnState.playerState.shield, false);
    scene.updateEnemyBlock(turnState.enemy.block, false);
    scene.setFloorInfo(
      turnState.deck.currentFloor,
      turnState.deck.currentEncounter,
      3,
    );
    scene.setBackground(
      turnState.deck.currentFloor,
      isBossFloor(turnState.deck.currentFloor),
      turnState.enemy.template.id,
    ).then(() => {
      dismissScreenTransition();
    });
    const run = get(activeRunState);
    scene.setRelics(
      (run?.runRelics ?? []).map((rr) => {
        const def = RELIC_BY_ID[rr.definitionId];
        return {
          domain: def?.category ?? 'tactical',
          label: def?.name ?? rr.definitionId,
        };
      }),
    );
  };

  const tryPush = (retries: number) => {
    ensureCombatStarted();
    const s = getCombatScene();
    if (s && (s as any).sceneReady) {
      pushDisplayData();
    } else if (retries > 0) {
      setTimeout(() => tryPush(retries - 1), 200);
    } else {
      // All retries failed — release transition to avoid permanent overlay
      dismissScreenTransition();
    }
  };
  tryPush(25);
}

export async function startEncounterForRoom(enemyId?: string): Promise<boolean> {
  // Reset reentrancy guard — a stale guard from a previous encounter (e.g. error during enemy phase)
  // must not block the player from taking their first turn in the next encounter.
  _endTurnInProgress = false;
  endTurnInProgress.set(false);
  // Immediately invalidate any pending victory/defeat timers from the previous encounter
  encounterGeneration++;
  const existingTurn = get(activeTurnState);
  if (existingTurn) {
    if (existingTurn.result === null) {
      // Encounter genuinely in progress — return true (already started) instead of
      // blocking with false which causes the caller to navigate away from combat
      if (import.meta.env.DEV) console.debug('[encounterBridge] Encounter already active, reusing');
      return true;
    }
    // Clear stale turn state from a completed encounter (cleanup timeout hasn't fired yet)
    activeTurnState.set(null);
  }
  const run = get(activeRunState);
  if (!run) return false;
  const ascensionModifiers = run.ascensionModifiers ?? getAscensionModifiers(run.ascensionLevel ?? 0);

  if (!activeDeck) {
    if (!factsDB.isReady()) {
      try {
        await factsDB.init();
      } catch (err) {
        console.warn('[encounterBridge] factsDB failed to initialize', err);
        return false;
      }
    }
    const save = get(playerSave);
    const reviewStates = save?.reviewStates ?? [];

    if (run.deckMode) {
      // New path: use preset/general pool builders
      const categoryFilters = save?.categoryFilters ?? undefined;
      if (run.deckMode.type === 'general') {
        activeRunPool = buildGeneralRunPool(reviewStates, {
          categoryFilters,
          funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
        });
      } else if (run.deckMode.type === 'preset') {
        const dm = run.deckMode as { type: 'preset'; presetId: string };
        const preset = (save?.studyPresets ?? []).find(p => p.id === dm.presetId);
        const domainSelections = preset?.domainSelections ?? {};
        activeRunPool = buildPresetRunPool(domainSelections, reviewStates, {
          categoryFilters,
          funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
          includeOutsideDueReviews: run.includeOutsideDueReviews ?? false,
        });
      } else if (run.deckMode.type === 'language') {
        // Language mode — strict language-only pool.
        // Pass chainDistribution so Study Temple language runs get proportional chain assignment.
        activeRunPool = buildLanguageRunPool(run.deckMode.languageCode, reviewStates, {
          categoryFilters,
          funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
          chainDistribution: run.chainDistribution,
        });
      } else if (run.deckMode.type === 'study') {
        const studyDeckId = run.deckMode.deckId;

        if (studyDeckId.startsWith('all:')) {
          // "All language" mode — combine all curated decks for this language.
          // Map full language names to ISO codes used by buildLanguageRunPool.
          const LANG_PREFIX_TO_CODE: Record<string, string> = {
            japanese: 'ja', korean: 'ko', chinese: 'zh', mandarin: 'zh',
            spanish: 'es', french: 'fr', german: 'de', dutch: 'nl',
            czech: 'cs', portuguese: 'pt', italian: 'it', russian: 'ru',
            arabic: 'ar', hindi: 'hi', vietnamese: 'vi', turkish: 'tr',
          };
          const langName = studyDeckId.substring(4).toLowerCase(); // e.g. 'japanese'
          const langCode = LANG_PREFIX_TO_CODE[langName] ?? langName;
          // Pass chainDistribution so Study Temple all-language runs get proportional chain assignment.
          activeRunPool = buildLanguageRunPool(langCode, reviewStates, {
            categoryFilters,
            funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
            chainDistribution: run.chainDistribution,
          });
        } else {
          // Single curated deck — build pool from this deck's facts only.
          // Previously this used buildGeneralRunPool (knowledge) or buildLanguageRunPool
          // (language prefix match), both of which pulled from the ENTIRE trivia/language
          // pool instead of the specific deck. That caused chess decks to show Hindu
          // tradition questions and grammar decks to show kanji meaning questions.
          activeRunPool = buildCuratedDeckRunPool(studyDeckId, run.deckMode.subDeckId, reviewStates, {
            funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
            chainDistribution: run.chainDistribution,
          });
        }
      } else if (run.deckMode.type === 'trivia') {
        // Trivia mode — filter by selected domains + subdomains.
        const dm = run.deckMode;
        // Build domainSelections: { domainId: subcategories[] } — empty array = all subcategories.
        const domainSelections: Record<string, string[]> = {};
        for (const domain of dm.domains) {
          domainSelections[domain] = dm.subdomains?.[domain] ?? [];
        }
        activeRunPool = buildPresetRunPool(domainSelections, reviewStates, {
          categoryFilters,
          funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
          includeOutsideDueReviews: run.includeOutsideDueReviews ?? false,
        });
      } else if (run.deckMode.type === 'custom_deck') {
        // Custom deck mode: build merged pool from all deck items.
        // Each item builds its own curated deck pool, then we merge them.
        let mergedPool: Card[] = [];
        const seenFactIds = new Set<string>();

        for (const item of run.deckMode.items) {
          const itemPool = buildCuratedDeckRunPool(item.deckId, undefined, reviewStates, {
            funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
            chainDistribution: run.chainDistribution,
          });

          for (const card of itemPool) {
            if (!seenFactIds.has(card.factId)) {
              seenFactIds.add(card.factId);
              mergedPool.push(card);
            }
          }
        }

        activeRunPool = mergedPool;
      } else if (run.deckMode.type === 'study-multi') {
        // Multi-source mode: merge curated deck facts and trivia-domain facts.
        // Curated deck entries use buildCuratedDeckRunPool for per-deck filtering.
        // Trivia domains use buildPresetRunPool.
        // All cards are deduplicated by factId (first-seen wins).
        const smMergedPool: Card[] = [];
        const smSeenFactIds = new Set<string>();

        // --- Curated deck contributions ---
        for (const entry of run.deckMode.decks) {
          // When subDeckIds is 'all' or undefined, pass undefined to get all facts.
          // When it's an array, build pool for each subdeck and merge.
          const subDeckIds = entry.subDeckIds === 'all' ? [undefined] : (entry.subDeckIds ?? [undefined]);
          for (const subId of subDeckIds) {
            const entryPool = buildCuratedDeckRunPool(entry.deckId, subId, reviewStates, {
              funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
              chainDistribution: run.chainDistribution,
            });
            for (const card of entryPool) {
              if (!smSeenFactIds.has(card.factId)) {
                smSeenFactIds.add(card.factId);
                smMergedPool.push(card);
              }
            }
          }
        }

        // --- Trivia domain contributions ---
        for (const domain of run.deckMode.triviaDomains) {
          const triviaPool = buildPresetRunPool(
            { [domain]: [] },
            reviewStates,
            {
              categoryFilters,
              funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
              includeOutsideDueReviews: run.includeOutsideDueReviews ?? false,
            },
          );
          for (const card of triviaPool) {
            if (!smSeenFactIds.has(card.factId)) {
              smSeenFactIds.add(card.factId);
              smMergedPool.push(card);
            }
          }
        }

        activeRunPool = smMergedPool;
      } else {
        // Other modes — fall back to general pool until dedicated builders exist.
        activeRunPool = buildGeneralRunPool(reviewStates, {
          categoryFilters,
          funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
        });
      }
    } else {
      // Legacy path: standard 2-domain builder
      const subscriberCategoryFilters = undefined;
      activeRunPool = buildRunPool(run.primaryDomain, run.secondaryDomain, reviewStates, {
        probeRunNumber: run.primaryDomainRunNumber,
        probeDomain: run.primaryDomain,
        subscriberCategoryFilters,
        funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
      });
    }

    const uniquePoolFactIds = [...new Set(activeRunPool.map((card) => card.factId))];
    const deckMasteryPct = calculateDeckMastery(uniquePoolFactIds, reviewStates);
    const poolNoveltyPct = getNovelFactPercentage(uniquePoolFactIds, reviewStates);
    const poolRewardScale = getCombinedPoolRewardMultiplier(uniquePoolFactIds.length, poolNoveltyPct);
    run.deckMasteryPct = deckMasteryPct;
    run.poolFactCount = uniquePoolFactIds.length;
    run.poolNoveltyPct = poolNoveltyPct;
    run.poolRewardScale = poolRewardScale;
    if (shouldSuppressRewardsForTinyPool(uniquePoolFactIds.length)) {
      run.rewardsDisabled = true;
    }
    if (deckMasteryPct > 0.75) {
      run.practiceRunDetected = true;
    }
    activeRunState.set(run);

    // Record pool fact IDs for recently-played deprioritization in future runs
    recordRunFacts(activeRunPool.map(c => c.factId));
    if (activeRunPool.length === 0) {
      console.warn('[encounterBridge] Empty run pool — cannot start encounter');
      return false;
    }
    // AR-59.6: fixed 10-card starter deck (5 Strike, 4 Block, 1 Surge)
    const starterDeck = buildFixedStarterDeck(activeRunPool);
    activeDeck = createDeck(starterDeck);
  }

  // Build active relic IDs from run state
  const runRelicIds = new Set<string>(
    (run.runRelics ?? []).map((r) => r.definitionId)
  );

  let templateId = enemyId;
  if (!templateId) {
    // Use seeded RNG fork for enemy pool picks so co-op and replays are deterministic.
    const poolRng = isRunRngActive() ? getRunRng('enemyPool') : null;
    const poolRand = () => poolRng ? poolRng.next() : Math.random();

    // Reset per-floor dedup trackers when we move to a new floor.
    // This ensures no same-enemy consecutive encounters within a floor, but does
    // not bleed across floors (floor 2 may repeat an enemy that appeared on floor 1).
    if (run.floor.currentFloor !== _lastFloorTracked) {
      _lastFloorEnemyId = null;
      _lastFloorEliteId = null;
      _lastFloorTracked = run.floor.currentFloor;
    }

    if (isBossFloor(run.floor.currentFloor) && run.floor.currentEncounter === run.floor.encountersPerFloor) {
      // V2: use act-based boss pool with rotation (AR-98 — no same boss twice in a row per act)
      const bossCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'boss');
      if (bossCandidates.length > 0) {
        const act = getActForFloor(run.floor.currentFloor);
        const lastBoss = getLastBossForAct(act);
        const filtered = lastBoss ? bossCandidates.filter(b => b.id !== lastBoss) : bossCandidates;
        const pool = filtered.length > 0 ? filtered : bossCandidates;
        templateId = pool[Math.floor(poolRand() * pool.length)].id;
        setLastBossForAct(act, templateId);
      } else {
        templateId = getBossForFloor(run.floor.currentFloor) ?? pickCombatEnemy(run.floor.currentFloor);
      }
    } else if (isMiniBossEncounter(run.floor.currentFloor, run.floor.currentEncounter)) {
      // V2: use act-based mini-boss pool, fall back to legacy
      const miniBossCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'mini_boss');
      templateId = miniBossCandidates.length > 0
        ? miniBossCandidates[Math.floor(poolRand() * miniBossCandidates.length)].id
        : getMiniBossForFloor(run.floor.currentFloor);
    } else {
      // Respect mystery event's own elite decision — don't let canary override it.
      // isMysteryRoomCombat is still true when startEncounterForRoom runs; the elite flag tracks
      // whether the mystery event system already decided this should be elite.
      const isMysteryNonElite = getIsMysteryRoomCombat() && !getIsMysteryRoomCombatElite();
      if (run.canary.mode === 'challenge' && poolRand() < 0.50 && !isMysteryNonElite) {
        // V2: use act-based elite pool, fall back to region-based, no same elite twice on same floor
        const eliteCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'elite');
        if (eliteCandidates.length > 0) {
          const dedupedElites = _lastFloorEliteId && eliteCandidates.length > 1
            ? eliteCandidates.filter(e => e.id !== _lastFloorEliteId)
            : eliteCandidates;
          const elitePool = dedupedElites.length > 0 ? dedupedElites : eliteCandidates;
          templateId = elitePool[Math.floor(poolRand() * elitePool.length)].id;
          _lastFloorEliteId = templateId;
        } else {
          const region = getRegionForFloor(run.floor.currentFloor);
          const regionElites = ENEMY_TEMPLATES.filter((enemyTemplate) => enemyTemplate.category === 'elite' && enemyTemplate.region === region);
          const effectiveElites = regionElites.length > 0 ? regionElites : ENEMY_TEMPLATES.filter((enemyTemplate) => enemyTemplate.category === 'elite');
          const dedupedFallbackElites = _lastFloorEliteId && effectiveElites.length > 1
            ? effectiveElites.filter(e => e.id !== _lastFloorEliteId)
            : effectiveElites;
          const eliteFallbackPool = dedupedFallbackElites.length > 0 ? dedupedFallbackElites : effectiveElites;
          templateId = eliteFallbackPool[Math.floor(poolRand() * eliteFallbackPool.length)]?.id ?? pickCombatEnemy(run.floor.currentFloor);
          if (templateId) _lastFloorEliteId = templateId;
        }
      } else {
        // V2: use act-based common pool for regular encounters, no same enemy twice on same floor
        const commonCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'combat');
        if (commonCandidates.length > 0) {
          const dedupedCommon = _lastFloorEnemyId && commonCandidates.length > 1
            ? commonCandidates.filter(c => c.id !== _lastFloorEnemyId)
            : commonCandidates;
          const commonPool = dedupedCommon.length > 0 ? dedupedCommon : commonCandidates;
          templateId = commonPool[Math.floor(poolRand() * commonPool.length)].id;
          _lastFloorEnemyId = templateId;
        } else {
          templateId = pickCombatEnemy(run.floor.currentFloor);
          if (templateId) _lastFloorEnemyId = templateId;
        }
      }
    }
  }

  const template = ENEMY_TEMPLATES.find((enemyTemplate) => enemyTemplate.id === templateId);
  if (!template || !activeDeck) return false;

  activeDeck.currentFloor = run.floor.currentFloor;
  activeDeck.currentEncounter = run.floor.currentEncounter;
  const ascensionTemplate = applyAscensionEnemyTemplateAdjustments(
    template,
    run.floor.currentFloor,
    ascensionModifiers,
  );
  // Canary HP multiplier is disabled in coop — shared enemy already uses getCoopHpMultiplier().
  // canary.enemyHpMultiplier would unfairly double-scale for no per-player benefit.
  const isCoopRun = run.multiplayerMode === 'coop';
  let enemyHpMultiplier = (
    ascensionModifiers.enemyHpMultiplier *
    (ascensionTemplate.category === 'boss' ? ascensionModifiers.bossHpMultiplier : 1) *
    (isCoopRun ? 1.0 : run.canary.enemyHpMultiplier)
  );
  // Roll difficulty variance for common and elite enemies (0.85-1.15x HP and damage)
  // Uses a dedicated seeded RNG fork ('enemyVariance') so co-op players see identical
  // enemy HP for the same node. Falls back to Math.random in non-run contexts (tests, dev).
  const varianceRng = isRunRngActive() ? getRunRng('enemyVariance') : null;
  const difficultyVariance = (ascensionTemplate.category === 'common' || ascensionTemplate.category === 'elite')
    ? 0.85 + (varianceRng ? varianceRng.next() : Math.random()) * 0.30
    : 1.0;
  // FIX C-005: pass playerCount to createEnemy so getCoopHpMultiplier() applies 1.6x for 2P coop.
  // run.multiplayerPlayerCount is populated by gameFlowController from lobby.players.length.
  // For non-coop runs, playerCount defaults to 1 inside createEnemy (no double-scaling).
  const coopPlayerCount = isCoopRun ? (run.multiplayerPlayerCount ?? 2) : 1;
  const enemy = createEnemy(ascensionTemplate, run.floor.currentFloor, { hpMultiplier: enemyHpMultiplier, difficultyVariance, playerCount: coopPlayerCount });
  validateEnemyState(enemy);
  // AR-310: Initialise chain color rotation before startEncounter so the first-turn
  // active chain color is set correctly. Use the pre-computed chain distribution's
  // runChainTypes for curated runs; fall back to selectRunChainTypes for trivia runs.
  const encounterChainTypes = run.chainDistribution?.runChainTypes ?? selectRunChainTypes(run.runSeed);
  initChainSystem(encounterChainTypes, run.runSeed);
  const turnState = startEncounter(activeDeck, enemy, run.playerMaxHp, run.globalTurnCounter ?? 1);
  // AR-269: Thread encounter number for Akashic Record fact-spacing mechanic.
  // Use a global encounter counter = (floor - 1) * encountersPerFloor + currentEncounter.
  // This gives a monotonically increasing number across the entire run.
  turnState.encounterNumber = ((run.floor.currentFloor - 1) * (run.floor.encountersPerFloor ?? 3)) + run.floor.currentEncounter;
  activeDeck.hintsRemaining = HINTS_PER_ENCOUNTER;
  // Tick encounter cooldowns at the start of each new encounter
  tickFactCooldowns(activeDeck);
  // Reset seen-facts tracker so this encounter starts fresh
  resetEncounterSeenFacts(activeDeck);
  turnState.playerState.hp = run.playerHp;
  // Issue-7 fix: startingAp is the A/B experiment's per-turn AP value (3 control / 4 test).
  // Previously this wrongly set apMax = startingAp, which:
  //   (a) capped apMax at 3 for control group (blocking Act 2's 4 AP), and
  //   (b) failed to grant startingAp=4 on turn 1 for the test group (Math.min(3,4)=3).
  // Fix: thread startingAp into turnState.startingApPerTurn (used as per-turn AP floor
  // in endPlayerTurn) and set apCurrent directly here for the first encounter turn.
  // apMax remains MAX_AP_PER_TURN (5) — relics and surge can still exceed startingAp.
  turnState.startingApPerTurn = run.startingAp;
  turnState.apCurrent = run.startingAp;
  // Dev assertion: startingAp must be a valid AP value (within [START_AP_PER_TURN, MAX_AP_PER_TURN]).
  // If this warns, a new code path is writing apCurrent without going through startingApPerTurn.
  if (import.meta.env.DEV) {
    const expectedMin = 3; // START_AP_PER_TURN
    const expectedMax = 5; // MAX_AP_PER_TURN
    if (run.startingAp < expectedMin || run.startingAp > expectedMax) {
      console.warn('[encounterBridge] first-encounter AP out of range', {
        startingAp: run.startingAp,
        expectedRange: [expectedMin, expectedMax],
      });
    }
  }
  turnState.activeRelicIds = runRelicIds;
  turnState.baseDrawCount = resolveBaseDrawCount(runRelicIds);
  // If a relic (e.g. swift_boots) boosts the draw count above the default 5,
  // startEncounter already drew 5 cards. Draw the extra cards now so the first
  // hand reflects the full boosted count.
  if (turnState.baseDrawCount > 5 && activeDeck) {
    const extraCards = turnState.baseDrawCount - 5;
    drawHand(activeDeck, extraCards);
  }
  // Canary damage multiplier is disabled in coop — enemy targets both players directly.
  // Solo and race retain canary scaling as normal.
  turnState.canaryEnemyDamageMultiplier = isCoopRun
    ? 1.0
    : run.canary.enemyDamageMultiplier * (run.endlessEnemyDamageMultiplier ?? 1);
  turnState.canaryQuestionBias = run.canary.questionBias;
  turnState.ascensionLevel = run.ascensionLevel ?? 0;
  turnState.ascensionEnemyDamageMultiplier = ascensionModifiers.enemyDamageMultiplier;
  turnState.ascensionShieldCardMultiplier = ascensionModifiers.shieldCardMultiplier;
  turnState.ascensionWrongAnswerSelfDamage = ascensionModifiers.wrongAnswerSelfDamage;
  turnState.ascensionBaseTimerPenaltySeconds = ascensionModifiers.timerBasePenaltySeconds;
  turnState.ascensionEncounterTimerPenaltySeconds = (
    run.floor.currentEncounter === 2 ? ascensionModifiers.encounterTwoTimerPenaltySeconds : 0
  );
  turnState.ascensionPreferCloseDistractors = ascensionModifiers.preferCloseDistractors;
  turnState.ascensionTier1OptionCount = ascensionModifiers.tier1OptionCount;
  turnState.ascensionForceHardQuestionFormats = ascensionModifiers.forceHardQuestionFormats;
  turnState.ascensionPreventFlee = ascensionModifiers.preventFlee;
  // A20 Scholar's Inversion: wrong-charge fizzle damage redirects to player.
  turnState.ascensionScholarsInversion = ascensionModifiers.scholarsInversion;
  // A17+ buff: HP healed per correct Charge answer.
  turnState.ascensionCorrectAnswerHeal = ascensionModifiers.correctAnswerHeal;

  // Thread player character level so Deja Vu can apply level-15+ scaling (2 cards instead of 1).
  const saveForLevel = get(playerSave);
  turnState.characterLevel = saveForLevel?.characterLevel ?? 0;

  // Encounter-start relic hooks (resolved by relicEffectResolver).
  const encounterStartFx = resolveEncounterStartEffects(runRelicIds);
  if (encounterStartFx.bonusBlock > 0) {
    turnState.playerState.shield += encounterStartFx.bonusBlock;
  }
  if (encounterStartFx.bonusHeal > 0) {
    turnState.playerState.hp = Math.min(turnState.playerState.maxHP, turnState.playerState.hp + encounterStartFx.bonusHeal);
  }
  if (encounterStartFx.bonusAP > 0) {
    turnState.apCurrent = Math.min(turnState.apMax, turnState.apCurrent + encounterStartFx.bonusAP);
  }
  // hollow_armor: grant starting block at encounter start (block gain disabled after turn 0)
  if (encounterStartFx.startingBlock) {
    turnState.playerState.shield += encounterStartFx.startingBlock;
  }
  // thick_skin: start each encounter with +5 block (stacks with bonusBlock from other sources)
  if ((encounterStartFx.thickSkinBlock ?? 0) > 0) {
    turnState.playerState.shield += encounterStartFx.thickSkinBlock!;
  }
  // plague_flask: apply 2 Poison to all enemies at encounter start
  if ((encounterStartFx.encounterStartPoison ?? 0) > 0) {
    playCardAudio('relic-trigger');
    applyStatusEffect(turnState.enemy.statusEffects, {
      type: 'poison',
      value: encounterStartFx.encounterStartPoison!,
      turnsRemaining: 99,
    });
    turnState.triggeredRelicId = 'plague_flask';
  }
  // gladiator_s_mark: grant +1 Strength for 3 turns at encounter start
  if (encounterStartFx.tempStrengthBonus !== null) {
    playCardAudio('relic-trigger');
    const { amount, durationTurns } = encounterStartFx.tempStrengthBonus!;
    applyStatusEffect(turnState.playerState.statusEffects, {
      type: 'strength',
      value: amount,
      turnsRemaining: durationTurns,
    });
    turnState.triggeredRelicId = 'gladiator_s_mark';
  }

  turnState.activePassives = [];

  // Phase 8: Dispatch onEncounterStart callback (e.g. Headmistress Detention — forget top-2 mastery cards).
  // Called after hand is drawn and relic hooks applied, so we're operating on the real opening hand.
  if (enemy.template.onEncounterStart && activeDeck) {
    const deckArg = {
      hand: activeDeck.hand,
      drawPile: activeDeck.drawPile,
      forgetPile: activeDeck.forgetPile,
    };
    const idsToForget = enemy.template.onEncounterStart(enemy, deckArg);
    for (const cardId of idsToForget) {
      // Remove from hand first, then drawPile
      const handIdx = activeDeck.hand.findIndex(c => c.id === cardId);
      if (handIdx !== -1) {
        const [card] = activeDeck.hand.splice(handIdx, 1);
        activeDeck.forgetPile.push(card);
      } else {
        const drawIdx = activeDeck.drawPile.findIndex(c => c.id === cardId);
        if (drawIdx !== -1) {
          const [card] = activeDeck.drawPile.splice(drawIdx, 1);
          activeDeck.forgetPile.push(card);
        }
      }
    }
    // Sync the modified deck back to turnState
    turnState.deck.hand = activeDeck.hand;
    turnState.deck.drawPile = activeDeck.drawPile;
    turnState.deck.forgetPile = activeDeck.forgetPile;
  }

  // Increment generation so any stale 550ms victory/defeat timers from the previous
  // encounter will abort before clearing this new encounter's state.
  encounterGeneration++;
  initFailsafeWatchdogs();

  activeTurnState.set(freshTurnState(turnState));
  syncCombatScene(turnState);

  // FIX H-012: Prime bidirectional P2P sessions before coop enemy sync to ensure
  // zero-byte primers have landed and the channel is open on both sides.
  if (isCoopRun) {
    const _lobbyId = getCurrentLobby()?.lobbyId;
    if (_lobbyId) {
      const { primeP2PSessions } = await import('./steamNetworkingService');
      const primeCount = await primeP2PSessions(_lobbyId);
      // Short pause to let the zero-byte primers propagate before the first real send.
      await new Promise<void>(r => setTimeout(r, 100));
      console.log(`[encounterBridge] coop: primed ${primeCount} P2P session(s) for lobby ${_lobbyId}`);
    }
  }

  // Coop: synchronize initial enemy state before the encounter becomes visible.
  // Host broadcasts the authoritative snapshot as an anchor (guards against any
  // seed/variance drift). Non-host awaits and overwrites local enemy state.
  if (isCoopRun) {
    if (mpIsHost()) {
      // Broadcast the enemy we just created as the canonical starting state (coop).
      broadcastSharedEnemyState(snapshotEnemy(enemy));
      // FIX C-002: For duel mode, also call hostCreateSharedEnemy to set up the duel state
      // machine's shared enemy reference and broadcast mp:duel:enemy_state to the opponent.
      if (run.multiplayerMode === 'duel') {
        hostCreateSharedEnemy(ascensionTemplate.id, run.floor.currentFloor, coopPlayerCount);
      }
    } else {
      // Await the host's initial snapshot, then hydrate our local enemy.
      // The mp:coop:request_initial_state mechanism (initCoopSync) handles retries
      // automatically — awaitCoopEnemyReconcile just waits for the next enemy_state.
      let initialSnapshot: import('../data/multiplayerTypes').SharedEnemySnapshot | null = null;
      try {
        initialSnapshot = await awaitCoopEnemyReconcile();
      } catch (err) {
        if (err instanceof CoopReconcileTimeoutError) {
          console.warn('[encounterBridge] coop: initial reconcile timed out — requesting re-broadcast');
          requestCoopEnemyStateRetry();
          try {
            initialSnapshot = await awaitCoopEnemyReconcile();
          } catch (retryErr) {
            console.warn('[encounterBridge] coop: retry reconcile also timed out — using local enemy state', retryErr);
            handleCoopReconcileFailure(2);
          }
        } else {
          console.warn('[encounterBridge] coop: failed to receive initial enemy snapshot, using local', err);
        }
      }
      if (initialSnapshot) {
        hydrateEnemyFromSnapshot(enemy, initialSnapshot);
        // Reflect the hydrated state in turnState and the store.
        turnState.enemy = enemy;
        activeTurnState.set(freshTurnState(turnState));
        syncCombatScene(turnState);
      }
    }
  }

  // Coop: capture the initial pre-turn enemy snapshot for delta computation on turn 1.
  // This is either the hydrated (non-host) or just-created (host) enemy state.
  if (isCoopRun) {
    _coopPreTurnEnemySnapshot = snapshotEnemy(enemy);
  } else {
    _coopPreTurnEnemySnapshot = null;
  }

  // Coop: subscribe to real-time enemy HP updates from the partner.
  // Each card play the partner makes broadcasts `mp:coop:enemy_hp_update`, letting this
  // player's scene reflect enemy HP changes without waiting for the turn-end reconcile.
  // Clean up any previous encounter's subscriber before subscribing fresh.
  if (_unsubCoopEnemyHpUpdate) {
    _unsubCoopEnemyHpUpdate();
    _unsubCoopEnemyHpUpdate = null;
  }
  if (isCoopRun) {
    _unsubCoopEnemyHpUpdate = onEnemyHpUpdate((currentHP, maxHP) => {
      // Update the current TurnState enemy HP so subsequent card-play calculations see it.
      const currentTurnState = get(activeTurnState);
      if (currentTurnState?.enemy) {
        currentTurnState.enemy.currentHP = currentHP;
        currentTurnState.enemy.maxHP = maxHP;
        activeTurnState.set(freshTurnState(currentTurnState));
      }
      // Update the Phaser scene's visual immediately.
      const liveScene = getCombatScene();
      if (liveScene) {
        liveScene.updateEnemyHP(currentHP, true);
      }
    });
  }

  // BUG-10: broadcast initial partner state at encounter start so the partner's HUD
  // shows our correct starting HP/block instead of waiting until our first turn end.
  // broadcastPartnerState is a no-op if initCoopSync has not been called (non-coop runs).
  if (isCoopRun) {
    broadcastPartnerState({
      hp: run.playerHp,
      maxHp: run.playerMaxHp,
      block: 0, // no block at encounter start
      score: 0,
      accuracy: 1,
    });
  }

  // Encounter start sound + draw swooshes.
  // Determine encounter type audio
  const isBoss = isBossFloor(run.floor.currentFloor) && run.floor.currentEncounter === run.floor.encountersPerFloor;
  const isElite = template.category === 'elite';
  if (isBoss) {
    playCardAudio('encounter-start-boss');
  } else if (isElite) {
    playCardAudio('encounter-start-elite');
  } else {
    playCardAudio('encounter-start');
  }
  playCardAudio('turn-chime');
  // Check if first turn is a Surge turn
  if (turnState.isSurge) {
    setTimeout(() => playCardAudio('surge-announce'), 300);
  }
  turnState.deck.hand.forEach((_, index) => {
    setTimeout(() => playCardAudio('card-draw'), index * turboDelay(90));
  });

  return true;
}

function maybeApplyMasteryOutcome(card: Card, wasCorrect: boolean): void {
  if (!card.isMasteryTrial) return;
  applyMasteryTrialOutcome(card.factId, wasCorrect);
  if (!wasCorrect) return;

  // Award a Mastery Coin for reaching Tier 3 (replaces old relic assignment)
  awardMasteryCoin();
}

export function handlePlayCard(
  cardId: string,
  correct: boolean,
  speedBonus: boolean,
  responseTimeMs?: number,
  variantIndex?: number,
  playMode: PlayMode = 'charge',
  distractorCount?: number,
  wasQuizzed?: boolean,
  previewValue?: { qpValue: number; ccValue: number },
): {
  curedCursedFact: boolean;
  damageDealt?: number;
  shieldApplied?: number;
  healApplied?: number;
  pendingChoice?: {
    cardId: string;
    mechanicId: 'phase_shift' | 'unstable_flux';
    options: Array<{
      id: string;
      label: string;
      damageDealt?: number;
      shieldApplied?: number;
      extraCardsDrawn?: number;
      statusesApplied?: Array<{ type: string; value: number; turnsRemaining: number }>;
    }>;
  };
  pendingCardPick?: {
    type: string;
    sourceCardId: string;
    candidates: Card[];
    pickCount: number;
    allowSkip: boolean;
    title: string;
  };
} {
  const turnState = get(activeTurnState);
  if (!turnState) return { curedCursedFact: false };

  const playedCard = turnState.deck.hand.find((card) => card.id === cardId);
  const previousReviewState = playedCard?.factId ? getReviewStateByFactId(playedCard.factId) : undefined;
  const previousTier = previousReviewState ? getCardTier(previousReviewState) : null;
  const result = playCardAction(turnState, cardId, correct, speedBonus, playMode, distractorCount, wasQuizzed, previewValue);
  const run = get(activeRunState);

  // AR-204: Inscription detection — if the played card is an Inscription, register it,
  // move it from discard to forget pile, and mark it as permanently removed from game.
  // Note: playCardAction already moved the card from hand to discard via deckPlayCard().
  // Skip if blocked (AP insufficient) — card never left hand and inscription was never played.
  if (!result.blocked && playedCard && (playedCard.isInscription || playedCard.mechanicId?.startsWith('inscription_'))) {
    const isWisdomCW = playedCard.mechanicId === 'inscription_wisdom' && playMode === 'charge_wrong';
    // Wisdom CW = fizzle: do not register the inscription, but still forget and mark removed.
    if (!isWisdomCW) {
      resolveInscription(result.turnState, playedCard, playMode);
    }
    // Move card from discard pile to forget pile (card was placed in discard by playCard()).
    const deck = result.turnState.deck;
    const discardIdx = deck.discardPile.findIndex(c => c.id === playedCard.id);
    if (discardIdx !== -1) {
      const [inscriptionCard] = deck.discardPile.splice(discardIdx, 1);
      inscriptionCard.isRemovedFromGame = true;
      deck.forgetPile.push(inscriptionCard);
      playCardAudio('card-forget');
    }
  }

  // AR-204: Inscription of Wisdom — CC resolution trigger. Draws 1 extra card on correct Charge.
  // If the inscription was itself played CC, also heals 1 HP.
  // Wisdom CW = fizzle (no inscription entry registered), so this block never runs for CW plays.
  const isChargeCorrectPlay = playMode === 'charge' || playMode === 'charge_correct';
  if (correct && isChargeCorrectPlay) {
    const wisdomInscription = getActiveInscription(result.turnState, 'inscription_wisdom');
    if (wisdomInscription) {
      // Read mastery-scaled values from inscription extras (set by inscriptionWisdomActivated wiring)
      const drawCount = wisdomInscription.extras?.extraDrawPerCC ?? 1;
      const healAmount = wisdomInscription.extras?.healPerCC ?? 0;
      // Draw mastery-scaled extra cards
      if (drawCount > 0) {
        drawHand(result.turnState.deck, drawCount);
      }
      // CC inscription effect: heal mastery-scaled HP
      if (healAmount > 0 && (wisdomInscription.playMode === 'charge_correct' || wisdomInscription.playMode === 'charge')) {
        result.turnState.playerState.hp = Math.min(
          result.turnState.playerState.maxHP,
          result.turnState.playerState.hp + healAmount,
        );
      }
    }
  }

  if (run && playedCard) {
    if (!playedCard?.factId) {
      console.warn(`[encounterBridge] handlePlayCard: card ${cardId} has no factId! playedCard exists: ${!!playedCard}`);
    }
    recordCardPlay(run, correct, 0, playedCard.factId, playedCard.domain, playedCard.tier === '1');
    // Track Charge Play attempts separately from Quick Play.
    // Quick Play passes correct=true unconditionally and is not a quiz attempt.
    if (playMode !== 'quick' && playMode !== 'quick_play') {
      run.chargesAttempted = (run.chargesAttempted ?? 0) + 1;
    }
    analyticsService.track({
      name: 'card_play',
      properties: {
        fact_id: playedCard.factId,
        card_type: playedCard.cardType,
        tier: playedCard.tier,
        correct,
        combo: 0,
        response_time_ms: responseTimeMs ?? null,
        floor: run.floor.currentFloor,
        encounter: run.floor.currentEncounter,
      },
    });
    analyticsService.track({
      name: correct ? 'answer_correct' : 'answer_incorrect',
      properties: {
        fact_id: playedCard.factId,
        card_type: playedCard.cardType,
        response_time_ms: responseTimeMs ?? null,
        floor: run.floor.currentFloor,
      },
    });

    if (correct) {
      run.bounties = updateBounties(run.bounties, {
        type: 'card_correct',
        domain: playedCard.domain,
        responseTimeMs,
      });
    }

    if (result.turnState.isPerfectTurn && result.turnState.cardsPlayedThisTurn === 3) {
      run.bounties = updateBounties(run.bounties, { type: 'perfect_turn' });
    }

    run.playerHp = result.turnState.playerState.hp;
    result.turnState.canaryEnemyDamageMultiplier = run.multiplayerMode === 'coop' ? 1.0 : run.canary.enemyDamageMultiplier * (run.endlessEnemyDamageMultiplier ?? 1);
    result.turnState.canaryQuestionBias = run.canary.questionBias;
    activeRunState.set(run);
  }

  if (playedCard?.factId) {
    // H6: In MP race modes (race / same_cards), FSRS updates are batched at race-end
    // by multiplayerGameService._applyRaceFsrsBatch() via recordRaceAnswer().
    // Skipping the per-answer updateReviewStateByButton here ensures single-write
    // semantics — the richer per-answer metadata (timing, speed bonus) is not available
    // at batch time, but the batch write is the canonical FSRS record for races.
    const isRaceMode =
      run?.multiplayerMode === 'race' || run?.multiplayerMode === 'same_cards';
    if (isRaceMode) {
      recordRaceAnswer(playedCard.factId, correct);
    } else {
      const button = !correct ? 'again' : speedBonus ? 'good' : 'okay';
      updateReviewStateByButton(playedCard.factId, button, undefined, {
        responseTimeMs,
        variantIndex,
        earlyBoostActive: run?.earlyBoostActive,
        speedBonus,
        runNumber: run?.primaryDomainRunNumber,
      });
    }

    const updatedReviewState = getReviewStateByFactId(playedCard.factId);
    if (run && updatedReviewState) {
      if ((previousReviewState?.totalAttempts ?? 0) === 0 && (updatedReviewState.totalAttempts ?? 0) > 0) {
        run.newFactsLearned += 1;
      }

      const nextTier = getCardTier(updatedReviewState);
      if (previousTier !== '3' && nextTier === '3') {
        run.factsMastered += 1;
      }
      if (previousTier !== nextTier) {
        analyticsService.track({
          name: 'tier_upgrade',
          properties: {
            fact_id: playedCard.factId,
            old_tier: previousTier ?? 'none',
            new_tier: nextTier,
          },
        });
      }

      activeRunState.set(run);
    }

    maybeApplyMasteryOutcome(playedCard, correct);
  }

  activeTurnState.set(freshTurnState(result.turnState));

  // Chain combo visual escalation: fire after every card play so the environment
  // tracks chain count in real time (Spec 03). chainType from TurnState is number|null.
  {
    const chainScene = getCombatScene();
    if (chainScene) {
      chainScene.onChainUpdated(
        result.turnState.chainLength,
        result.turnState.chainType ?? undefined,
      );
    }
  }

  const scene = getCombatScene();
  if (scene) {
    // For attack and cast cards: enemy hit reaction is deferred to the weapon's
    // onImpact callback so it fires at the visual contact frame (T+250ms sword,
    // T+330ms tome) rather than at T+0 when the card resolves.
    // For shield cards and wrong answers with no weapon animation: fire immediately.
    const hasWeaponAnimation = correct && playedCard?.cardType !== 'shield';
    const shouldDeferHit = hasWeaponAnimation && result.effect.damageDealt > 0 && !result.enemyDefeated;

    if (result.effect.damageDealt > 0 && !result.enemyDefeated && !shouldDeferHit) {
      // Immediate hit reaction — shield block or non-weapon damage path
      scene.playEnemyHitAnimation();
    }

    if (correct) {
      // Build the deferred hit callback for weapon animations (or undefined for shield)
      const hitCallback = shouldDeferHit ? () => scene.playEnemyHitAnimation() : undefined;

      if (playedCard?.cardType === 'attack') scene.playPlayerAttackAnimation(hitCallback);
      else if (playedCard?.cardType === 'shield') scene.playPlayerBlockAnimation();
      else scene.playPlayerCastAnimation(playedCard?.cardType, hitCallback);
    }

    scene.updateEnemyHP(result.turnState.enemy?.currentHP ?? 0, true);
    scene.updateEnemyBlock(result.turnState.enemy?.block ?? 0, true);
    scene.updatePlayerHP(result.turnState.playerState?.hp ?? 0, result.turnState.playerState?.maxHP ?? 0, true);
    scene.updatePlayerBlock(result.turnState.playerState?.shield ?? 0, true);

    // Co-op: broadcast the updated enemy HP to the partner so their scene reflects
    // damage dealt mid-turn without waiting for the turn-end reconcile.
    if (run?.multiplayerMode === 'coop' && result.turnState.enemy) {
      broadcastEnemyHpUpdate(result.turnState.enemy.currentHP, result.turnState.enemy.maxHP);
    }

    if (result.enemyDefeated) {
      const runForVictory = get(activeRunState);
      const isBossVictory = runForVictory && isBossFloor(runForVictory.floor.currentFloor) && runForVictory.floor.currentEncounter === runForVictory.floor.encountersPerFloor;
      if (isBossVictory) {
        playCardAudio('boss-defeated');
      } else {
        playCardAudio('encounter-victory');
      }
      playCardAudio('enemy-death');
      juiceManager.fireKillConfirmation();
      // Kill confirmation punch FIRST, then death animation
      scene.playKillConfirmation().then(() => {
        scene.playEnemyDeathAnimation();
        scene.playPlayerVictoryAnimation();
      });
    }
  }

  if (result.enemyDefeated) {
    // Record ALL facts seen this encounter for cooldown (not just answered ones)
    if (activeDeck) {
      const seenFacts = getEncounterSeenFacts(activeDeck);
      if (seenFacts.length > 0) addFactsToCooldown(activeDeck, seenFacts);

      // AR-202: Auto-cure safety valve — if pendingAutoCure is set, remove oldest cursed fact.
      if (activeDeck.pendingAutoCure) {
        const runForCure = get(activeRunState);
        if (runForCure && runForCure.cursedFactIds.size > 0) {
          // Sets preserve insertion order — the first entry is the oldest.
          const oldest = runForCure.cursedFactIds.values().next().value as string;
          runForCure.cursedFactIds.delete(oldest);
          console.log('[cursed] auto-cure safety valve: removed oldest cursed fact', oldest);
          activeRunState.set(runForCure);
        }
        activeDeck.pendingAutoCure = false;
        activeDeck.consecutiveCursedDraws = 0;
      }

    }
    // Post-encounter healing: restore a percentage of max HP
    // Boss/mini-boss encounters grant bonus healing (AR-32)
    if (run) {
      const isRelaxedMode = get(difficultyMode) === 'relaxed';
      const enemyCategory = result.turnState.enemy.template.category;
      const isBossOrMiniBoss = enemyCategory === 'boss' || enemyCategory === 'mini_boss';
      const healPct = getBalanceValue('postEncounterHealPct', POST_ENCOUNTER_HEAL_PCT)
        + (isRelaxedMode ? getBalanceValue('relaxedPostEncounterHealBonus', RELAXED_POST_ENCOUNTER_HEAL_BONUS) : 0)
        + (isBossOrMiniBoss ? getBalanceValue('postBossEncounterHealBonus', POST_BOSS_ENCOUNTER_HEAL_BONUS) : 0);
      const healAmt = Math.round(run.playerMaxHp * healPct);
      const hpBefore = run.playerHp;
      let hpAfterHeal = Math.min(run.playerMaxHp, run.playerHp + healAmt);

      // Apply segment-based healing cap
      const segment = run.floor.currentFloor <= 6 ? 1 : run.floor.currentFloor <= 12 ? 2 : run.floor.currentFloor <= 18 ? 3 : 4;
      const healCapLookup = getBalanceValue('postEncounterHealCap', POST_ENCOUNTER_HEAL_CAP) as Record<1 | 2 | 3 | 4, number>;
      const healCap = healCapLookup[segment] ?? 1.0;
      const maxAllowedHp = Math.round(run.playerMaxHp * healCap);
      run.playerHp = Math.min(hpAfterHeal, maxAllowedHp);
      const actualHeal = run.playerHp - hpBefore;

      // Award encounter currency
      const currencyReward = generateCurrencyReward(
        run.floor.currentFloor,
        result.turnState.enemy.template.category,
      );
      run.currency += currencyReward;

      // AR-262: Compute post-encounter accuracy grade from charge statistics
      const gradeResult = calculateAccuracyGrade(
        result.turnState.encounterChargesTotal,
        result.turnState.chargesCorrectThisEncounter,
      );

      // Capture reward data for step-by-step reveal
      activeRewardBundle.set({
        goldEarned: currencyReward,
        healAmount: actualHeal,
        accuracyGrade: gradeResult.grade,
        accuracyPct: gradeResult.accuracy,
      });

      activeRunState.set(run);
    }
    // Revert any Transmute-transformed cards back to their original form before next encounter
    if (activeDeck) revertTransmutedCards(activeDeck);
    const victoryGeneration = encounterGeneration;
    setTimeout(() => {
      // Guard: if a new encounter started while this timer was pending, abort.
      // Without this check a quick map-node tap can start encounter N+1 before this timer
      // fires, causing the timer to wipe encounter N+1's state and immediately complete it.
      if (encounterGeneration !== victoryGeneration) {
        if (import.meta.env.DEV) console.debug('[encounterBridge] Stale victory timer discarded (generation mismatch)');
        return;
      }
      // Capture enemy ID for exit transition BEFORE clearing activeTurnState
      const ts = get(activeTurnState);
      if (ts?.enemy?.template?.id) {
        combatExitEnemyId.set(ts.enemy.template.id);
      }
      // Capture narrative snapshot BEFORE clearing activeTurnState
      if (ts) {
        const allDeckCards = [
          ...ts.deck.hand,
          ...ts.deck.drawPile,
          ...ts.deck.discardPile,
          ...(ts.deck.forgetPile ?? []),
        ];
        const cardIdToFactId = new Map<string, string>(
          allDeckCards.filter(c => c.factId).map(c => [c.id, c.factId]),
        );
        const fizzledFactIds = ts.turnLog
          .filter(e => e.type === 'fizzle' && e.cardId)
          .map(e => cardIdToFactId.get(e.cardId!) ?? '')
          .filter(Boolean);
        const run = get(activeRunState);
        const currentNode = run?.floor?.actMap?.nodes[run?.floor?.actMap?.currentNodeId ?? ''];
        // Narrative: flush any remaining chain buffer (final chain that was still active at encounter end)
        if (ts.currentChainAnswerFactIds.length >= 3) {
          ts.completedChainSequences.push([...ts.currentChainAnswerFactIds]);
          ts.currentChainAnswerFactIds = [];
        }
        _lastNarrativeSnapshot = {
          answeredFactIds: [...ts.encounterQuizzedFacts],
          fizzledFactIds,
          cardIdToFactId,
          isBoss:
            (run ? (isBossFloor(run.floor.currentFloor) && run.floor.currentEncounter >= run.floor.encountersPerFloor) : false)
            || currentNode?.type === 'boss',
          isElite: currentNode?.type === 'elite',
          enemyId: ts.enemy?.template?.id,
          streakAtEnd: ts.consecutiveCorrectThisEncounter,
          chainCompletions: ts.completedChainSequences.map(seq => [...seq]),
        };
      }
      // Return non-inscription forgotten cards to discard pile at end of encounter
      if (ts) {
        const returnCards = ts.deck.forgetPile.filter(c => !c.isRemovedFromGame);
        ts.deck.discardPile.push(...returnCards);
        ts.deck.forgetPile = ts.deck.forgetPile.filter(c => c.isRemovedFromGame);
      }
      activeTurnState.set(null);
      notifyEncounterComplete('victory');
    }, turboDelay(550));
  }

  // AR-202: Wire Soul Jar charge increment — accumulate soulJarChargeGained into runState.
  // Must happen after result is finalized and run exists.
  if (run && correct && result.effect) {
    const isChargeCorrectPlay = playMode === 'charge' || playMode === 'charge_correct';
    if (isChargeCorrectPlay) {
      // resolveChargeCorrectEffects already ran inside playCardAction (turnManager).
      // We re-derive the soulJarChargeGained here from the encounter charge count.
      // The encounterChargesTotal is updated inside playCardAction before we read it.
      const encChargeCount = result.turnState.consecutiveCorrectThisEncounter;
      if (result.turnState.activeRelicIds.has('soul_jar') && encChargeCount > 0 && encChargeCount % 5 === 0) {
        run.soulJarCharges = (run.soulJarCharges ?? 0) + 1;
        activeRunState.set(run);
      }
    }
  }

  return {
    curedCursedFact: result.curedCursedFact ?? false,
    damageDealt: result.effect?.damageDealt ?? 0,
    shieldApplied: result.effect?.shieldApplied ?? 0,
    healApplied: result.effect?.healApplied ?? 0,
    pendingChoice: result.pendingChoice,
    pendingCardPick: result.pendingCardPick,
  };
}

export function handleSkipCard(cardId: string): void {
  const turnState = get(activeTurnState);
  if (!turnState) return;
  skipCard(turnState, cardId);

  const run = get(activeRunState);
  if (run && turnState.activeRelicIds.has('scavengers_pouch')) {
    run.currency += 1;
    activeRunState.set(run);
  }

  activeTurnState.set(freshTurnState(turnState));
}

export function handleUseHint(): void {
  const turnState = get(activeTurnState);
  if (!turnState) return;
  if (turnState.deck.hintsRemaining <= 0) return;
  turnState.deck.hintsRemaining -= 1;
  activeTurnState.set(freshTurnState(turnState));
}

/**
 * Applies a player's choice from a Phase Shift QP/CW or Unstable Flux CC pending choice popup.
 * Mutates the active turn state with the chosen effect (damage, shield, draw, or debuff).
 * @returns Effect info for UI feedback.
 */
export function handlePendingChoice(
  choiceId: string,
  options: Array<{
    id: string;
    label: string;
    damageDealt?: number;
    shieldApplied?: number;
    extraCardsDrawn?: number;
    statusesApplied?: Array<{ type: string; value: number; turnsRemaining: number }>;
  }>,
): { damageDealt: number; shieldApplied: number; extraCardsDrawn: number; enemyDefeated: boolean } {
  const turnState = get(activeTurnState);
  if (!turnState) return { damageDealt: 0, shieldApplied: 0, extraCardsDrawn: 0, enemyDefeated: false };

  const applied = applyPendingChoice(turnState, choiceId, options);
  activeTurnState.set(freshTurnState(turnState));
  return applied;
}

/**
 * Consumes one Soul Jar charge from the active run state.
 * Call this immediately before auto-succeeding a Charge quiz via the GUARANTEED button.
 * Returns true if a charge was successfully consumed, false if none available.
 */
export function consumeSoulJarCharge(): boolean {
  const run = get(activeRunState);
  if (!run || (run.soulJarCharges ?? 0) <= 0) return false;
  run.soulJarCharges = Math.max(0, run.soulJarCharges - 1);
  activeRunState.set(run);
  return true;
}

export async function handleEndTurn(): Promise<void> {
  if (_endTurnInProgress) return;
  const turnState = get(activeTurnState);
  if (!turnState) return;

  _endTurnInProgress = true;
  endTurnInProgress.set(true);

  try {
  // Capture pre-turn HP so the UI stays at the old value during the animation delay
  const previousHp = turnState.playerState.hp;

  // Co-op turn barrier + shared enemy reconciliation:
  // In coop, both players fight ONE shared enemy (host-authoritative HP).
  // Flow:
  //   1. Snapshot the enemy at the start of this handleEndTurn call.
  //   2. Compute delta = what THIS player did to the enemy during their card plays.
  //   3. Send delta + wait for all players to signal via awaitCoopTurnEndWithDelta.
  //   4. Host: collect all deltas, merge onto pre-turn snapshot, broadcast authoritative state.
  //   5. Non-host: await the host's merged broadcast, overwrite local enemy state.
  //   6. Both: run enemy phase locally against their own player.
  const runForMode = get(activeRunState);
  const isCoop = runForMode?.multiplayerMode === 'coop';
  if (isCoop) {
    coopWaitingForPartner.set(true);
    let coopResult: 'completed' | 'cancelled' = 'completed';

    // The pre-turn snapshot was captured at the end of the PREVIOUS turn (see below).
    // On turn 1 it is captured at encounter start by startEncounterForRoom.
    // Compute how much HP the enemy lost due to this player's cards this turn.
    const preTurnSnapshot = _coopPreTurnEnemySnapshot ?? snapshotEnemy(turnState.enemy);
    const postCardHP = turnState.enemy.currentHP;
    const postCardBlock = turnState.enemy.block;
    const damageDealt = Math.max(0, preTurnSnapshot.currentHP - postCardHP);
    const blockDealt = Math.max(0, preTurnSnapshot.block - postCardBlock);
    // Simple status diff: any effects not in the pre-turn set are "added"
    const preTurnEffectTypes = new Set(preTurnSnapshot.statusEffects.map(s => s.type));
    const statusEffectsAdded = turnState.enemy.statusEffects.filter(s => !preTurnEffectTypes.has(s.type));
    const delta = {
      playerId: '',  // filled in by awaitCoopTurnEndWithDelta via _localPlayerId
      damageDealt,
      blockDealt,
      statusEffectsAdded: statusEffectsAdded.map(s => ({ ...s })),
    };

    try {
      coopResult = await awaitCoopTurnEndWithDelta(delta);
    } finally {
      coopWaitingForPartner.set(false);
    }

    if (coopResult === 'cancelled') {
      // Partner (or local player) cancelled the turn-end barrier.
      // Restore turn control without running the enemy phase.
      handleCoopBarrierCancel('timeout');
      return;
    }

    // Barrier complete — now reconcile the shared enemy state.
    if (mpIsHost()) {
      // Host: collect all deltas, apply to pre-turn snapshot, broadcast.
      const allDeltas = getCollectedDeltas();
      const mergedSnapshot = applyEnemyDeltaToState(
        preTurnSnapshot,
        allDeltas,
        turnState.enemy.template.phaseTransitionAt,
      );
      // Roll next intent on the hydrated enemy (mutates enemy in place for phase 2 awareness)
      hydrateEnemyFromSnapshot(turnState.enemy, mergedSnapshot);
      rollNextIntent(turnState.enemy);
      // Snapshot again with the new intent, then broadcast
      const broadcastSnapshot = snapshotEnemy(turnState.enemy);
      broadcastSharedEnemyState(broadcastSnapshot);
      // Update the pre-turn snapshot for the next turn
      _coopPreTurnEnemySnapshot = snapshotEnemy(turnState.enemy);
    } else {
      // Non-host: await the host's authoritative state
      try {
        const reconciledSnapshot = await awaitCoopEnemyReconcile();
        // Drift detection: roll what we would have computed locally and compare with the host.
        // Both clients use the same seeded RNG fork ('enemy-intent'), so these should always match.
        // A mismatch indicates RNG desync (e.g. one client consumed an extra roll somewhere).
        const localRolledIntent = rollNextIntent(turnState.enemy);
        const hostIntent = reconciledSnapshot.nextIntent;
        if (localRolledIntent.type !== hostIntent.type || localRolledIntent.value !== hostIntent.value) {
          console.warn('[coop-sync] intent drift', {
            local: { type: localRolledIntent.type, value: localRolledIntent.value },
            host: { type: hostIntent.type, value: hostIntent.value },
          });
        }
        // Host is always authoritative — overwrite local state including the intent we just rolled.
        hydrateEnemyFromSnapshot(turnState.enemy, reconciledSnapshot);
        // Update the pre-turn snapshot for the next turn
        _coopPreTurnEnemySnapshot = snapshotEnemy(turnState.enemy);
      } catch (err) {
        console.warn('[encounterBridge] coop: failed to receive reconciled enemy state, using local', err);
      }
    }
  }

  // ── Beat 1: Enemy turn begins ────────────────────────────────────────────
  // Hide the player's cards while the enemy phase plays out.
  // Use the current (pre-damage) turn state with an empty hand so the UI
  // doesn't show stale cards. HP stays at the pre-damage value.
  const preAnimTurnState = { ...freshTurnState(turnState), deck: { ...turnState.deck, hand: [] } };
  activeTurnState.set(preAnimTurnState);

  // Announce enemy turn start with audio + visual transition.
  playCardAudio('enemy-turn-start');
  // Visual beat: transient vignette darken + enemy sprite pulse + particle spike.
  getCombatScene()?.playTurnTransitionToEnemy();

  // Pause 1s so the player can register the enemy turn beginning before damage lands.
  await new Promise<void>((r) => setTimeout(r, turboDelay(1000)));

  // ── Beat 2: Enemy attack resolves ────────────────────────────────────────
  // Now run the enemy phase. This resolves all damage, status ticks, and draw.
  const result = endPlayerTurn(turnState);

  // Commit the global turn counter immediately so surge tracking is correct.
  const run = get(activeRunState);
  if (run) {
    run.globalTurnCounter = result.turnState.turnNumber;
    activeRunState.set(run);
  }

  // Commit post-damage HP to run state now — the enemy attack animation fires below
  // at the same moment so the UI shows damage landing visibly during this beat.
  const runAfterTurn = get(activeRunState);
  if (runAfterTurn) {
    runAfterTurn.playerHp = result.turnState.playerState.hp;
    activeRunState.set(runAfterTurn);
  }

  // H18: Co-op solo-survivor rule — if this player's HP just hit 0, signal death
  // to all co-op partners. This ends the encounter for everyone with a loss.
  if (isCoop && runAfterTurn && runAfterTurn.playerHp <= 0) {
    const { getLocalMultiplayerPlayerId } = await import('./multiplayerLobbyService');
    handleCoopPlayerDeath(getLocalMultiplayerPlayerId());
  }

  // Co-op: broadcast updated HP/block/score/accuracy immediately after the HP commit
  // so the partner's HUD reflects the damage taken during this beat (not at beat end).
  if (isCoop && runAfterTurn) {
    const coopScore = computeRaceScore(runAfterTurn);
    const coopAccuracy = runAfterTurn.factsAnswered > 0
      ? runAfterTurn.factsCorrect / runAfterTurn.factsAnswered
      : 1;
    broadcastPartnerState({
      hp: runAfterTurn.playerHp,
      maxHp: runAfterTurn.playerMaxHp,
      block: result.turnState.playerState.shield ?? 0,
      score: coopScore,
      accuracy: coopAccuracy,
    });
  }

  // Update chain visuals to reflect chain decay at turn end (Spec 03).
  // decayChain() already ran inside endPlayerTurn; chainLength reflects the decayed value.
  {
    const chainScene = getCombatScene();
    if (chainScene) {
      chainScene.onChainUpdated(
        result.turnState.chainLength,
        result.turnState.chainType ?? undefined,
      );
    }
  }

  const scene = getCombatScene();
  if (scene) {
    // Animate based on executed enemy intent type — fires NOW (mid-beat-2) so the
    // attack animation and the HP commit land at the same visible moment.
    switch (result.executedIntentType) {
      case 'attack':
        playCardAudio('enemy-attack');
        scene.playEnemyAttackAnimation()
        if (result.blockAbsorbedAll) {
          playCardAudio('shield-absorb');
          scene.playBlockAbsorbFlash()
        } else if (result.damageDealt > 0) {
          playCardAudio('player-damage');
          scene.playPlayerDamageFlash()
        }
        break
      case 'multi_attack':
        playCardAudio('enemy-charge-release');
        scene.playEnemyMultiAttackAnimation()
        if (result.blockAbsorbedAll) {
          playCardAudio('shield-absorb');
          scene.playBlockAbsorbFlash()
        } else if (result.damageDealt > 0) {
          playCardAudio('player-damage');
          scene.playPlayerDamageFlash()
        }
        break
      case 'defend':
        playCardAudio('enemy-defend');
        scene.playEnemyDefendAnimation()
        break
      case 'buff':
        playCardAudio('enemy-buff');
        scene.playEnemyBuffAnimation()
        break
      case 'debuff':
        playCardAudio('enemy-debuff');
        scene.playEnemyDebuffAnimation()
        break
      case 'heal':
        playCardAudio('enemy-heal');
        scene.playEnemyHealAnimation()
        break
    }
    scene.updatePlayerHP(result.turnState.playerState.hp, result.turnState.playerState.maxHP, true);
    scene.updatePlayerBlock(result.turnState.playerState.shield, true);
    scene.updateEnemyHP(result.turnState.enemy.currentHP, true);
    scene.updateEnemyBlock(result.turnState.enemy.block, true);
    scene.setEnemyIntent(
      result.turnState.enemy.nextIntent.telegraph,
      result.turnState.enemy.nextIntent.value > 0 ? result.turnState.enemy.nextIntent.value : undefined,
    );
    if (result.playerDefeated) {
      playCardAudio('player-defeated');
      scene.playPlayerDefeatAnimation();
    }
  }

  // Dispatch enemy damage/block numbers to the UI overlay
  const enemyBlock = result.turnState.enemy.block;
  const damageToPlayer = result.damageDealt;
  if (damageToPlayer > 0 || enemyBlock > 0) {
    enemyDamageEvent.set({ damageDealt: damageToPlayer, blockGained: enemyBlock });
    // Reset so the store can fire again next turn
    setTimeout(() => enemyDamageEvent.set(null), 50);
  }

  // Pause 1s so the damage visually settles before the player turn begins.
  await new Promise<void>((r) => setTimeout(r, turboDelay(1000)));

  // ── Reactive-damage victory check ────────────────────────────────────────
  // pain_conduit reflect, thornReflect, thorns, or counterDamage may have killed
  // the enemy during endPlayerTurn.  turnManager now sets result='victory' and
  // returns early (no new hand is drawn), but handleEndTurn previously ignored
  // that flag and fell through to "Player turn begins" — reactivating the player
  // turn with a won encounter, causing a permanent freeze on the NEXT end-turn.
  if (result.turnState.result === 'victory') {
    const runForVictory = get(activeRunState);
    const isBossVictory =
      runForVictory &&
      isBossFloor(runForVictory.floor.currentFloor) &&
      runForVictory.floor.currentEncounter === runForVictory.floor.encountersPerFloor;
    if (isBossVictory) {
      playCardAudio('boss-defeated');
    } else {
      playCardAudio('encounter-victory');
    }
    playCardAudio('enemy-death');
    juiceManager.fireKillConfirmation();
    scene?.playKillConfirmation().then(() => {
      scene?.playEnemyDeathAnimation();
      scene?.playPlayerVictoryAnimation();
    });

    // Record ALL facts seen this encounter for cooldown (not just answered ones)
    if (activeDeck) {
      const seenFacts = getEncounterSeenFacts(activeDeck);
      if (seenFacts.length > 0) addFactsToCooldown(activeDeck, seenFacts);

      // AR-202: Auto-cure safety valve
      if (activeDeck.pendingAutoCure) {
        const runForCure = get(activeRunState);
        if (runForCure && runForCure.cursedFactIds.size > 0) {
          const oldest = runForCure.cursedFactIds.values().next().value as string;
          runForCure.cursedFactIds.delete(oldest);
          console.log('[cursed] auto-cure safety valve (reactive victory): removed oldest cursed fact', oldest);
          activeRunState.set(runForCure);
        }
        activeDeck.pendingAutoCure = false;
        activeDeck.consecutiveCursedDraws = 0;
      }
    }

    if (runForVictory) {
      const isRelaxedMode = get(difficultyMode) === 'relaxed';
      const enemyCategory = result.turnState.enemy.template.category;
      const isBossOrMiniBoss = enemyCategory === 'boss' || enemyCategory === 'mini_boss';
      const healPct =
        getBalanceValue('postEncounterHealPct', POST_ENCOUNTER_HEAL_PCT) +
        (isRelaxedMode ? getBalanceValue('relaxedPostEncounterHealBonus', RELAXED_POST_ENCOUNTER_HEAL_BONUS) : 0) +
        (isBossOrMiniBoss ? getBalanceValue('postBossEncounterHealBonus', POST_BOSS_ENCOUNTER_HEAL_BONUS) : 0);
      const healAmt = Math.round(runForVictory.playerMaxHp * healPct);
      const hpBefore = runForVictory.playerHp;
      let hpAfterHeal = Math.min(runForVictory.playerMaxHp, runForVictory.playerHp + healAmt);

      const segment = runForVictory.floor.currentFloor <= 6 ? 1
        : runForVictory.floor.currentFloor <= 12 ? 2
        : runForVictory.floor.currentFloor <= 18 ? 3
        : 4;
      const healCapLookup = getBalanceValue('postEncounterHealCap', POST_ENCOUNTER_HEAL_CAP) as Record<1 | 2 | 3 | 4, number>;
      const healCap = healCapLookup[segment] ?? 1.0;
      const maxAllowedHp = Math.round(runForVictory.playerMaxHp * healCap);
      runForVictory.playerHp = Math.min(hpAfterHeal, maxAllowedHp);
      const actualHeal = runForVictory.playerHp - hpBefore;

      const currencyReward = generateCurrencyReward(
        runForVictory.floor.currentFloor,
        result.turnState.enemy.template.category,
      );
      runForVictory.currency += currencyReward;

      const gradeResult = calculateAccuracyGrade(
        result.turnState.encounterChargesTotal,
        result.turnState.chargesCorrectThisEncounter,
      );

      activeRewardBundle.set({
        goldEarned: currencyReward,
        healAmount: actualHeal,
        accuracyGrade: gradeResult.grade,
        accuracyPct: gradeResult.accuracy,
      });

      activeRunState.set(runForVictory);
    }

    if (activeDeck) revertTransmutedCards(activeDeck);

    const reactiveVictoryGeneration = encounterGeneration;
    setTimeout(() => {
      if (encounterGeneration !== reactiveVictoryGeneration) {
        if (import.meta.env.DEV)
          console.debug('[encounterBridge] Stale reactive-victory timer discarded (generation mismatch)');
        return;
      }
      const ts = get(activeTurnState);
      if (ts?.enemy?.template?.id) {
        combatExitEnemyId.set(ts.enemy.template.id);
      }
      if (ts) {
        const allDeckCards = [
          ...ts.deck.hand,
          ...ts.deck.drawPile,
          ...ts.deck.discardPile,
          ...(ts.deck.forgetPile ?? []),
        ];
        const cardIdToFactId = new Map<string, string>(
          allDeckCards.filter(c => c.factId).map(c => [c.id, c.factId]),
        );
        const fizzledFactIds = ts.turnLog
          .filter(e => e.type === 'fizzle' && e.cardId)
          .map(e => cardIdToFactId.get(e.cardId!) ?? '')
          .filter(Boolean);
        const run = get(activeRunState);
        const currentNode = run?.floor?.actMap?.nodes[run?.floor?.actMap?.currentNodeId ?? ''];
        if (ts.currentChainAnswerFactIds.length >= 3) {
          ts.completedChainSequences.push([...ts.currentChainAnswerFactIds]);
          ts.currentChainAnswerFactIds = [];
        }
        _lastNarrativeSnapshot = {
          answeredFactIds: [...ts.encounterQuizzedFacts],
          fizzledFactIds,
          cardIdToFactId,
          isBoss:
            (run ? (isBossFloor(run.floor.currentFloor) && run.floor.currentEncounter >= run.floor.encountersPerFloor) : false)
            || currentNode?.type === 'boss',
          isElite: currentNode?.type === 'elite',
          enemyId: ts.enemy?.template?.id,
          streakAtEnd: ts.consecutiveCorrectThisEncounter,
          chainCompletions: ts.completedChainSequences.map(seq => [...seq]),
        };
      }
      // Return non-inscription forgotten cards to discard pile at end of encounter
      if (ts) {
        const returnCards = ts.deck.forgetPile.filter(c => !c.isRemovedFromGame);
        ts.deck.discardPile.push(...returnCards);
        ts.deck.forgetPile = ts.deck.forgetPile.filter(c => c.isRemovedFromGame);
      }
      activeTurnState.set(null);
      notifyEncounterComplete('victory');
    }, turboDelay(550));

    return;
  }

  // ── Player turn begins ────────────────────────────────────────────────────
  // Restore the real post-turn state with the full new hand — this is the
  // moment the player regains control.
  activeTurnState.set(freshTurnState(result.turnState));

  if (!result.playerDefeated) {
    playCardAudio('turn-chime');
    // Visual beat: release vignette overlay + warm flash + dispatch rr:player-turn-start event.
    getCombatScene()?.playTurnTransitionToPlayer();
    if (result.turnState.isSurge) {
      setTimeout(() => playCardAudio('surge-announce'), 200);
    }
  }

  if (result.playerDefeated) {
    // Record ALL facts seen this encounter for cooldown (not just answered ones)
    if (activeDeck) {
      const seenFacts = getEncounterSeenFacts(activeDeck);
      if (seenFacts.length > 0) addFactsToCooldown(activeDeck, seenFacts);

      // AR-202: Auto-cure safety valve — fires on defeat too (don't punish player twice).
      if (activeDeck.pendingAutoCure) {
        const runForCure = get(activeRunState);
        if (runForCure && runForCure.cursedFactIds.size > 0) {
          const oldest = runForCure.cursedFactIds.values().next().value as string;
          runForCure.cursedFactIds.delete(oldest);
          console.log('[cursed] auto-cure safety valve (defeat): removed oldest cursed fact', oldest);
          activeRunState.set(runForCure);
        }
        activeDeck.pendingAutoCure = false;
        activeDeck.consecutiveCursedDraws = 0;
      }
    }
    const defeatGeneration = encounterGeneration;
    setTimeout(() => {
      if (encounterGeneration !== defeatGeneration) {
        if (import.meta.env.DEV) console.debug('[encounterBridge] Stale defeat timer discarded (generation mismatch)');
        return;
      }
      playCardAudio('encounter-defeat');
      // Return non-inscription forgotten cards to discard pile at end of encounter
      const tsDefeat = get(activeTurnState);
      if (tsDefeat) {
        const returnCards = tsDefeat.deck.forgetPile.filter(c => !c.isRemovedFromGame);
        tsDefeat.deck.discardPile.push(...returnCards);
        tsDefeat.deck.forgetPile = tsDefeat.deck.forgetPile.filter(c => c.isRemovedFromGame);
      }
      activeTurnState.set(null);
      activeDeck = null;
      notifyEncounterComplete('defeat');
    }, turboDelay(550));
  }
  } finally {
    _endTurnInProgress = false;
    endTurnInProgress.set(false);
  }
}

/**
 * Cancel a pending co-op end-turn while waiting for partner consensus.
 *
 * Design (Issue 9): In co-op mode, `handleEndTurn()` sends the turn-end signal and
 * then waits at a barrier (`awaitCoopTurnEndWithDelta`). The hand discard and enemy
 * phase run only AFTER the barrier completes. While waiting, the player's hand is still
 * intact — cancelling removes the local player from the barrier and resumes normal play.
 *
 * Guards:
 *   - Returns `'not_in_coop'` if the current run is not a co-op run.
 *   - Returns `'no_barrier'` if no turn-end barrier is in flight (safe to call idempotently).
 *   - Returns `'empty_hand'` if the player's hand was empty when they ended their turn.
 *     In that case, cancel is not available — the "Waiting…" button should be shown disabled.
 *     The barrier continues; the player cannot take further actions regardless.
 *   - Returns `'cancelled'` on success — the barrier promise resolves `'cancelled'`,
 *     `coopWaitingForPartner` is cleared, and the player regains turn control.
 *
 * @see multiplayerCoopSync.cancelCoopTurnEnd — the underlying barrier cancel
 */
export function cancelEndTurnRequested():
  'cancelled' | 'not_in_coop' | 'no_barrier' | 'empty_hand' {
  const run = get(activeRunState);
  if (run?.multiplayerMode !== 'coop') return 'not_in_coop';
  if (!isLocalTurnEndPending()) return 'no_barrier';

  // If the player ended their turn with an empty hand, cancel is not available.
  // Show "Waiting…" (disabled) — there is nothing to restore.
  const ts = get(activeTurnState);
  const handSize = ts?.deck.hand.length ?? 0;
  if (handSize === 0) return 'empty_hand';

  // Cancel the barrier — this removes local player from the signal set,
  // broadcasts mp:coop:turn_end_cancel to partners, and resolves the
  // awaitCoopTurnEndWithDelta promise with 'cancelled'.
  // handleEndTurn() will then return early, leaving the hand intact.
  cancelCoopTurnEnd();
  return 'cancelled';
}

export function getRunPoolCards(): Card[] {
  return [...activeRunPool];
}

/**
 * Seed the run pool with a set of pre-built cards.
 * Used by scenarioSimulator when spawning a restStudy screen without going
 * through a full encounter start (which normally populates activeRunPool).
 * Without this, generateStudyQuestions() sees an empty pool and returns 0 questions.
 */
export function seedRunPool(cards: Card[]): void {
  activeRunPool = [...cards];
}

export function getActiveDeckCards(): Card[] {
  if (!activeDeck) return [];
  return [
    ...activeDeck.drawPile,
    ...activeDeck.hand,
    ...activeDeck.discardPile,
    ...activeDeck.forgetPile,
  ];
}

export function getActiveDeckFactIds(): Set<string> {
  if (!activeDeck) return new Set<string>();
  const ids = new Set<string>();
  for (const pile of [activeDeck.drawPile, activeDeck.hand, activeDeck.discardPile, activeDeck.forgetPile]) {
    for (const card of pile) ids.add(card.factId);
  }
  return ids;
}

/**
 * Add a reward card to the active deck with catch-up mastery applied.
 * New cards get mastery proportional to the deck's current average so late-game
 * picks are not dead on arrival. See catchUpMasteryService for scaling details.
 */
export function addRewardCardToActiveDeck(card: Card): void {
  if (!activeDeck) return;
  const catchUpLevel = computeCatchUpMastery(card, getActiveDeckCards());
  const cloned: Card = {
    ...card,
    id: `reward_${Math.random().toString(36).slice(2, 10)}`,
    masteryLevel: catchUpLevel,
    isUpgraded: catchUpLevel > 0,
  };
  addCardToDeck(activeDeck, cloned, 'top');
}

/** Sell price is flat 1 gold for all cards — FSRS tier no longer affects gold. */
export function calculateCardSellPrice(_card: Card): number {
  return 1;
}

export function sellCardFromActiveDeck(cardId: string): { soldCard: Card | null; gold: number } {
  if (!activeDeck) return { soldCard: null, gold: 0 };
  const piles: Card[][] = [activeDeck.drawPile, activeDeck.hand, activeDeck.discardPile, activeDeck.forgetPile];

  for (const pile of piles) {
    const index = pile.findIndex((card) => card.id === cardId);
    if (index === -1) continue;
    const [soldCard] = pile.splice(index, 1);
    return { soldCard, gold: calculateCardSellPrice(soldCard) };
  }

  return { soldCard: null, gold: 0 };
}

export function resetEncounterBridge(): void {
  destroyFailsafeWatchdogs();
  activeTurnState.set(null);
  activeDeck = null;
  activeRunPool = [];
  _lastNarrativeSnapshot = null;
  // Clear reentrancy guard so a new run can end turns normally.
  _endTurnInProgress = false;
  endTurnInProgress.set(false);
  // Invalidate any pending victory/defeat timers from the previous run.
  encounterGeneration++;
  // AR-269: Clear Akashic Record fact-spacing history so it doesn't persist across runs.
  resetFactLastSeenEncounter();
  // Reset same-floor enemy dedup trackers so a new run starts fresh.
  _lastFloorEnemyId = null;
  _lastFloorEliteId = null;
  _lastFloorTracked = -1;
}

/**
 * Return the narrative snapshot captured from the last completed encounter victory.
 * Returns null if no victory snapshot is available (defeat, or not yet populated).
 */
export function getLastNarrativeEncounterSnapshot(): NarrativeEncounterSnapshot | null {
  return _lastNarrativeSnapshot;
}

/**
 * Clear the narrative snapshot after it has been consumed by gameFlowController.
 */
export function clearNarrativeEncounterSnapshot(): void {
  _lastNarrativeSnapshot = null;
}

/**
 * DEV ONLY — Force an immediate encounter victory, bypassing combat.
 * Properly cleans up encounter state before notifying completion.
 */
export function devForceEncounterVictory(): void {
  const ts = get(activeTurnState);
  if (!ts) {
    if (import.meta.env.DEV) console.warn('[encounterBridge] devForceEncounterVictory: no active encounter');
    return;
  }
  // Capture enemy ID for exit transition
  if (ts.enemy?.template?.id) {
    combatExitEnemyId.set(ts.enemy.template.id);
  }
  // Build minimal narrative snapshot
  const run = get(activeRunState);
  const currentNode = run?.floor?.actMap?.nodes[run?.floor?.actMap?.currentNodeId ?? ''];
  // Flush any remaining chain buffer before snapshot
  if (ts.currentChainAnswerFactIds.length >= 3) {
    ts.completedChainSequences.push([...ts.currentChainAnswerFactIds]);
  }
  _lastNarrativeSnapshot = {
    answeredFactIds: [...ts.encounterQuizzedFacts],
    fizzledFactIds: [],
    cardIdToFactId: new Map(),
    isBoss:
      (run ? (isBossFloor(run.floor.currentFloor) && run.floor.currentEncounter >= run.floor.encountersPerFloor) : false)
      || currentNode?.type === 'boss',
    isElite: currentNode?.type === 'elite',
    enemyId: ts.enemy?.template?.id,
    streakAtEnd: ts.consecutiveCorrectThisEncounter,
    chainCompletions: ts.completedChainSequences.map(seq => [...seq]),
  };
  // Return non-inscription forgotten cards to discard pile at end of encounter
  if (ts) {
    const returnCards = ts.deck.forgetPile.filter(c => !c.isRemovedFromGame);
    ts.deck.discardPile.push(...returnCards);
    ts.deck.forgetPile = ts.deck.forgetPile.filter(c => c.isRemovedFromGame);
  }
  // Clear turn state BEFORE notifying (matches normal victory flow)
  activeTurnState.set(null);
  notifyEncounterComplete('victory');
}

/**
 * DEV / SCENARIO TOOL — Sync the Phaser CombatScene display state from the
 * current `activeTurnState` store value.
 *
 * Call this after restoring a snapshot to 'combat' screen so the CombatScene
 * re-renders the correct enemy sprite, HP bars, and background. Without this,
 * the Phaser canvas shows whatever was last rendered (or a black frame) even
 * though the Svelte overlay has the correct card state.
 *
 * Also ensures the CombatScene is started (Phaser engine must already be
 * booted — caller is responsible for calling `CardGameManager.boot()` first).
 *
 * CRITICAL-3 fix (2026-04-10): `__rrScenario.restore()` was writing stores
 * but not triggering this sync, leaving the Phaser canvas black.
 */
export function syncCombatDisplayFromCurrentState(): void {
  const ts = get(activeTurnState);
  if (!ts) {
    if (import.meta.env.DEV) {
      console.warn('[encounterBridge] syncCombatDisplayFromCurrentState: no active turn state');
    }
    return;
  }
  syncCombatScene(ts);
}

/**
 * DEV ONLY — Deep-merge overrides into the internal activeTurnState AND refresh the
 * Svelte store.  Use this instead of writing the store directly via the globalThis
 * Symbol bridge so that the patch is applied to the live store reference — which is
 * the same object all in-module handlers (handlePlayCard, handleEndTurn, etc.) read
 * via `get(activeTurnState)`.
 *
 * Using the Symbol bridge (writeStore) risks patching a copy that is later
 * overwritten when the bridge hasn't been registered yet, or when a deferred
 * timer re-reads from a stale reference.
 *
 * Returns true if a turn state was found and patched, false if no encounter is active.
 */
export function patchTurnState(overrides: Record<string, unknown>): boolean {
  const ts = get(activeTurnState);
  if (!ts) return false;
  const merged = deepMerge(ts, overrides as Partial<typeof ts>);
  // Object.assign copies all enumerable own-properties from merged back onto the
  // EXISTING ts reference so the mutated object is the same one that handlers
  // (handlePlayCard, handleEndTurn, etc.) already hold.  Then freshTurnState
  // triggers Svelte subscriber updates.
  Object.assign(ts, merged);
  activeTurnState.set(freshTurnState(ts));
  return true;
}

/**
 * Failsafe watchdog hook — draw `count` cards into the live activeDeck and
 * mirror the result back into activeTurnState so UI reactivity picks it up.
 *
 * This is the repair path for Class A1 (empty hand, AP > 0, player_action phase).
 * Snapshot-based patching is wrong here because `activeDeck` is the object that
 * `endPlayerTurn` reads when it discards and redraws — patching only TurnState
 * leaves the live deck stale, so the very next turn-end undoes the repair.
 *
 * Calling drawHand on the live activeDeck then mirroring via patchTurnState
 * keeps both in sync.
 *
 * Only intended for use by failsafeWatchdogs._repairEmptyHand (solo path).
 * Do NOT call from game-flow code — use the normal turn/draw pipeline.
 *
 * @param count  Number of cards to draw (should match ts.baseDrawCount, typically 5).
 */
export function forceRedraw(count: number): void {
  if (!activeDeck) {
    rrLog('watchdog:hand', 'forceRedraw called with no activeDeck', {});
    return;
  }
  const before = {
    hand: activeDeck.hand.length,
    draw: activeDeck.drawPile.length,
    discard: activeDeck.discardPile.length,
  };
  drawHand(activeDeck, count);
  const after = {
    hand: activeDeck.hand.length,
    draw: activeDeck.drawPile.length,
    discard: activeDeck.discardPile.length,
  };
  rrLog('watchdog:hand', 'forceRedraw complete', { before, after });
  // Mirror into the TurnState so UI reactivity picks it up.
  patchTurnState({ deck: { ...activeDeck } });
}
