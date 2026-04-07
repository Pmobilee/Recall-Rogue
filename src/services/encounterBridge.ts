/**
 * Bridge between game flow (screen routing) and combat systems (turn/deck/enemy).
 */

import { writable, get } from 'svelte/store';
import type { TurnState } from './turnManager';
import { startEncounter, playCardAction, skipCard, endPlayerTurn, resolveInscription, getActiveInscription, applyPendingChoice, revertTransmutedCards, resetFactLastSeenEncounter } from './turnManager';
import { initChainSystem } from './chainSystem';
import { selectRunChainTypes } from '../data/chainTypes';
import { buildRunPool, recordRunFacts } from './runPoolBuilder';
import { addCardToDeck, createDeck, drawHand, insertCardWithDelay, addFactsToCooldown, tickFactCooldowns, getEncounterSeenFacts, resetEncounterSeenFacts, exhaustCard } from './deckManager';
import { createEnemy } from './enemyManager';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { activeRunState } from './runStateStore';
import { getBossForFloor, pickCombatEnemy, isBossFloor, isMiniBossEncounter, getMiniBossForFloor, getRegionForFloor, getEnemiesForFloorNode, getActForFloor } from './floorManager';
import type { Card, CardRunState } from '../data/card-types';
import { recordCardPlay } from './runManager';
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
import { isSubscriber } from './subscriptionService';
import {
  applyAscensionEnemyTemplateAdjustments,
  getAscensionModifiers,
} from './ascension';
import { activeRewardBundle, releaseScreenTransition, combatExitEnemyId } from '../ui/stores/gameState';
import {
  resolveEncounterStartEffects,
  resolveBaseDrawCount,
} from './relicEffectResolver';
import { buildPresetRunPool, buildGeneralRunPool, buildLanguageRunPool } from './presetPoolBuilder'
import { getCuratedDeck } from '../data/curatedDeckStore'
import type { FactDomain } from '../data/card-types'
import { turboDelay } from '../utils/turboMode'
import { calculateFunnessBoostFactor } from './funnessBoost';
import { calculateAccuracyGrade } from './accuracyGradeSystem';
import {
  calculateDeckMastery,
  getCombinedPoolRewardMultiplier,
  getNovelFactPercentage,
  shouldSuppressRewardsForTinyPool,
} from './masteryScalingService';
import { computeCatchUpMastery } from './catchUpMasteryService';

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
    exhaustPile: deck.exhaustPile.map(cloneCard),
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
      releaseScreenTransition();
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
      // All retries exhausted — release transition to avoid permanent overlay
      releaseScreenTransition();
    }
  };
  tryPush(25);
}

export async function startEncounterForRoom(enemyId?: string): Promise<boolean> {
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
          // Single curated deck.
          // Check if it's a vocabulary deck (ID starts with a known language prefix).
          const LANG_PREFIX_TO_CODE: Record<string, string> = {
            japanese: 'ja', korean: 'ko', chinese: 'zh', mandarin: 'zh',
            spanish: 'es', french: 'fr', german: 'de', dutch: 'nl',
            czech: 'cs', portuguese: 'pt', italian: 'it', russian: 'ru',
            arabic: 'ar', hindi: 'hi', vietnamese: 'vi', turkish: 'tr',
          };
          const deckPrefix = studyDeckId.indexOf('_') > 0 ? studyDeckId.substring(0, studyDeckId.indexOf('_')) : studyDeckId;
          const langCode = LANG_PREFIX_TO_CODE[deckPrefix];

          if (langCode) {
            // Vocabulary deck — use language-specific pool so facts have language field.
            // Pass chainDistribution so Study Temple vocabulary runs get proportional chain assignment.
            activeRunPool = buildLanguageRunPool(langCode, reviewStates, {
              categoryFilters,
              funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
              chainDistribution: run.chainDistribution,
            });
          } else {
            // Knowledge curated deck — build general pool and stamp domain.
            // Pass chainDistribution so topic-aware chain assignment is used (Study Temple).
            activeRunPool = buildGeneralRunPool(reviewStates, {
              categoryFilters,
              funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
              chainDistribution: run.chainDistribution,
            });
            const curatedDeck = getCuratedDeck(studyDeckId);
            if (curatedDeck) {
              const deckDomain = curatedDeck.domain as FactDomain;
              for (const card of activeRunPool) {
                card.domain = deckDomain;
              }
            }
          }
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
        // Each item is either a vocab deck (language prefix) or a knowledge deck.
        const LANG_PREFIX_TO_CODE: Record<string, string> = {
          japanese: 'ja', korean: 'ko', chinese: 'zh', mandarin: 'zh',
          spanish: 'es', french: 'fr', german: 'de', dutch: 'nl',
          czech: 'cs', portuguese: 'pt', italian: 'it', russian: 'ru',
          arabic: 'ar', hindi: 'hi', vietnamese: 'vi', turkish: 'tr',
        };

        let mergedPool: Card[] = [];
        const seenFactIds = new Set<string>();

        for (const item of run.deckMode.items) {
          const deckPrefix = item.deckId.indexOf('_') > 0 ? item.deckId.substring(0, item.deckId.indexOf('_')) : item.deckId;
          const langCode = LANG_PREFIX_TO_CODE[deckPrefix];

          let itemPool: Card[];
          if (langCode) {
            itemPool = buildLanguageRunPool(langCode, reviewStates, {
              categoryFilters,
              funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
              chainDistribution: run.chainDistribution,
            });
          } else {
            // Knowledge curated deck — build general pool and stamp domain.
            itemPool = buildGeneralRunPool(reviewStates, {
              categoryFilters,
              funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
              chainDistribution: run.chainDistribution,
            });
            const curatedDeck = getCuratedDeck(item.deckId);
            if (curatedDeck) {
              const deckDomain = curatedDeck.domain as FactDomain;
              for (const card of itemPool) {
                card.domain = deckDomain;
              }
            }
          }

          // Deduplicate by factId across deck items.
          for (const card of itemPool) {
            if (!seenFactIds.has(card.factId)) {
              seenFactIds.add(card.factId);
              mergedPool.push(card);
            }
          }
        }

        activeRunPool = mergedPool;
      } else {
        // Other modes — fall back to general pool until dedicated builders exist.
        activeRunPool = buildGeneralRunPool(reviewStates, {
          categoryFilters,
          funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
        });
      }
    } else {
      // Legacy path: standard 2-domain builder
      const subscriberCategoryFilters = save && isSubscriber(save)
        ? (save.subscriberCategoryFilters ?? undefined)
        : undefined;
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
    if (isBossFloor(run.floor.currentFloor) && run.floor.currentEncounter === run.floor.encountersPerFloor) {
      // V2: use act-based boss pool with rotation (AR-98 — no same boss twice in a row per act)
      const bossCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'boss');
      if (bossCandidates.length > 0) {
        const act = getActForFloor(run.floor.currentFloor);
        const lastBoss = getLastBossForAct(act);
        const filtered = lastBoss ? bossCandidates.filter(b => b.id !== lastBoss) : bossCandidates;
        const pool = filtered.length > 0 ? filtered : bossCandidates;
        templateId = pool[Math.floor(Math.random() * pool.length)].id;
        setLastBossForAct(act, templateId);
      } else {
        templateId = getBossForFloor(run.floor.currentFloor) ?? pickCombatEnemy(run.floor.currentFloor);
      }
    } else if (isMiniBossEncounter(run.floor.currentFloor, run.floor.currentEncounter)) {
      // V2: use act-based mini-boss pool, fall back to legacy
      const miniBossCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'mini_boss');
      templateId = miniBossCandidates.length > 0
        ? miniBossCandidates[Math.floor(Math.random() * miniBossCandidates.length)].id
        : getMiniBossForFloor(run.floor.currentFloor);
    } else {
      if (run.canary.mode === 'challenge' && Math.random() < 0.50) {
        // V2: use act-based elite pool, fall back to region-based
        const eliteCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'elite');
        if (eliteCandidates.length > 0) {
          templateId = eliteCandidates[Math.floor(Math.random() * eliteCandidates.length)].id;
        } else {
          const region = getRegionForFloor(run.floor.currentFloor);
          const regionElites = ENEMY_TEMPLATES.filter((enemyTemplate) => enemyTemplate.category === 'elite' && enemyTemplate.region === region);
          const effectiveElites = regionElites.length > 0 ? regionElites : ENEMY_TEMPLATES.filter((enemyTemplate) => enemyTemplate.category === 'elite');
          templateId = effectiveElites[Math.floor(Math.random() * effectiveElites.length)]?.id ?? pickCombatEnemy(run.floor.currentFloor);
        }
      } else {
        // V2: use act-based common pool for regular encounters
        const commonCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'combat');
        templateId = commonCandidates.length > 0
          ? commonCandidates[Math.floor(Math.random() * commonCandidates.length)].id
          : pickCombatEnemy(run.floor.currentFloor);
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
  let enemyHpMultiplier = (
    ascensionModifiers.enemyHpMultiplier *
    (ascensionTemplate.category === 'boss' ? ascensionModifiers.bossHpMultiplier : 1)
  );
  // Roll difficulty variance for common and elite enemies (0.85-1.15x HP and damage)
  const difficultyVariance = (ascensionTemplate.category === 'common' || ascensionTemplate.category === 'elite')
    ? 0.85 + Math.random() * 0.30
    : 1.0;
  const enemy = createEnemy(ascensionTemplate, run.floor.currentFloor, { hpMultiplier: enemyHpMultiplier, difficultyVariance });
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
  turnState.apMax = Math.max(2, run.startingAp);
  turnState.apCurrent = Math.min(turnState.apCurrent, turnState.apMax);
  turnState.activeRelicIds = runRelicIds;
  turnState.baseDrawCount = resolveBaseDrawCount(runRelicIds);
  // If a relic (e.g. swift_boots) boosts the draw count above the default 5,
  // startEncounter already drew 5 cards. Draw the extra cards now so the first
  // hand reflects the full boosted count.
  if (turnState.baseDrawCount > 5 && activeDeck) {
    const extraCards = turnState.baseDrawCount - 5;
    drawHand(activeDeck, extraCards);
  }
  turnState.canaryEnemyDamageMultiplier = run.canary.enemyDamageMultiplier * (run.endlessEnemyDamageMultiplier ?? 1);
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

  turnState.activePassives = [];

  // Increment generation so any stale 550ms victory/defeat timers from the previous
  // encounter will abort before clearing this new encounter's state.
  encounterGeneration++;

  activeTurnState.set(freshTurnState(turnState));
  syncCombatScene(turnState);

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
  const result = playCardAction(turnState, cardId, correct, speedBonus, playMode, distractorCount, wasQuizzed);
  const run = get(activeRunState);

  // AR-204: Inscription detection — if the played card is an Inscription, register it,
  // move it from discard to exhaust pile, and mark it as permanently removed from game.
  // Note: playCardAction already moved the card from hand to discard via deckPlayCard().
  // Skip if blocked (AP insufficient) — card never left hand and inscription was never played.
  if (!result.blocked && playedCard && (playedCard.isInscription || playedCard.mechanicId?.startsWith('inscription_'))) {
    const isWisdomCW = playedCard.mechanicId === 'inscription_wisdom' && playMode === 'charge_wrong';
    // Wisdom CW = fizzle: do not register the inscription, but still exhaust and mark removed.
    if (!isWisdomCW) {
      resolveInscription(result.turnState, playedCard, playMode);
    }
    // Move card from discard pile to exhaust pile (card was placed in discard by playCard()).
    const deck = result.turnState.deck;
    const discardIdx = deck.discardPile.findIndex(c => c.id === playedCard.id);
    if (discardIdx !== -1) {
      const [inscriptionCard] = deck.discardPile.splice(discardIdx, 1);
      inscriptionCard.isRemovedFromGame = true;
      deck.exhaustPile.push(inscriptionCard);
      playCardAudio('card-exhaust');
    }
  }

  // AR-204: Inscription of Wisdom — CC resolution trigger. Draws 1 extra card on correct Charge.
  // If the inscription was itself played CC, also heals 1 HP.
  // Wisdom CW = fizzle (no inscription entry registered), so this block never runs for CW plays.
  const isChargeCorrectPlay = playMode === 'charge' || playMode === 'charge_correct';
  if (correct && isChargeCorrectPlay) {
    const wisdomInscription = getActiveInscription(result.turnState, 'inscription_wisdom');
    if (wisdomInscription) {
      // Draw 1 extra card
      drawHand(result.turnState.deck, 1);
      // CC inscription effect: also heal 1 HP
      if (wisdomInscription.playMode === 'charge_correct' || wisdomInscription.playMode === 'charge') {
        result.turnState.playerState.hp = Math.min(
          result.turnState.playerState.maxHP,
          result.turnState.playerState.hp + 1,
        );
      }
    }
  }

  if (run && playedCard) {
    recordCardPlay(run, correct, 0, playedCard.factId, playedCard.domain, playedCard.tier === '1');
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
    result.turnState.canaryEnemyDamageMultiplier = run.canary.enemyDamageMultiplier * (run.endlessEnemyDamageMultiplier ?? 1);
    result.turnState.canaryQuestionBias = run.canary.questionBias;
    activeRunState.set(run);
  }

  if (playedCard?.factId) {
    const button = !correct ? 'again' : speedBonus ? 'good' : 'okay';
    updateReviewStateByButton(playedCard.factId, button, undefined, {
      responseTimeMs,
      variantIndex,
      earlyBoostActive: run?.earlyBoostActive,
      speedBonus,
      runNumber: run?.primaryDomainRunNumber,
    });

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
          ...(ts.deck.exhaustPile ?? []),
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
        };
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
  const turnState = get(activeTurnState);
  if (!turnState) return;

  // Capture pre-turn HP so the UI stays at the old value during the animation delay
  const previousHp = turnState.playerState.hp;

  const result = endPlayerTurn(turnState);
  playCardAudio('enemy-turn-start');

  // Visual beat: transient vignette darken + enemy sprite pulse + particle spike.
  // Fires immediately during the existing 1s delay — adds no wall-clock time.
  getCombatScene()?.playTurnTransitionToEnemy();

  // Sync only the turn counter now; defer HP update until after the animation.
  const run = get(activeRunState);
  if (run) {
    // Sync the global turn counter back to run state so it persists across encounters.
    run.globalTurnCounter = result.turnState.turnNumber;
    activeRunState.set(run);
  }

  // Keep the HP store at the pre-damage value so the UI does not jump before the animation.
  // Publish a modified turn state where playerState.hp is still the old value.
  const preAnimTurnState = freshTurnState(result.turnState);
  preAnimTurnState.playerState = { ...preAnimTurnState.playerState, hp: previousHp };
  activeTurnState.set(preAnimTurnState);

  // AR-222: Delay before enemy animations so the player can register their
  // turn ending before the enemy immediately acts. 1 second normal, shorter in turbo.
  await new Promise<void>((r) => setTimeout(r, turboDelay(1000)));

  // Now update HP in run state and the active turn state with the real post-turn values.
  // This runs after the animation delay so the UI shows the damage at the same moment
  // as the enemy attack animation plays, not before it.
  const runAfterDelay = get(activeRunState);
  if (runAfterDelay) {
    runAfterDelay.playerHp = result.turnState.playerState.hp;
    activeRunState.set(runAfterDelay);
  }
  activeTurnState.set(freshTurnState(result.turnState));

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
    // Animate based on executed enemy intent type
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
      activeTurnState.set(null);
      activeDeck = null;
      notifyEncounterComplete('defeat');
    }, turboDelay(550));
  }
}

export function getRunPoolCards(): Card[] {
  return [...activeRunPool];
}

export function getActiveDeckCards(): Card[] {
  if (!activeDeck) return [];
  return [
    ...activeDeck.drawPile,
    ...activeDeck.hand,
    ...activeDeck.discardPile,
    ...activeDeck.exhaustPile,
  ];
}

export function getActiveDeckFactIds(): Set<string> {
  if (!activeDeck) return new Set<string>();
  const ids = new Set<string>();
  for (const pile of [activeDeck.drawPile, activeDeck.hand, activeDeck.discardPile, activeDeck.exhaustPile]) {
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
  const piles: Card[][] = [activeDeck.drawPile, activeDeck.hand, activeDeck.discardPile, activeDeck.exhaustPile];

  for (const pile of piles) {
    const index = pile.findIndex((card) => card.id === cardId);
    if (index === -1) continue;
    const [soldCard] = pile.splice(index, 1);
    return { soldCard, gold: calculateCardSellPrice(soldCard) };
  }

  return { soldCard: null, gold: 0 };
}

export function resetEncounterBridge(): void {
  activeTurnState.set(null);
  activeDeck = null;
  activeRunPool = [];
  _lastNarrativeSnapshot = null;
  // Invalidate any pending victory/defeat timers from the previous run.
  encounterGeneration++;
  // AR-269: Clear Akashic Record fact-spacing history so it doesn't persist across runs.
  resetFactLastSeenEncounter();
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
  };
  // Clear turn state BEFORE notifying (matches normal victory flow)
  activeTurnState.set(null);
  notifyEncounterComplete('victory');
}
