/**
 * Bridge between game flow (screen routing) and combat systems (turn/deck/enemy).
 */

import { writable, get } from 'svelte/store';
import type { TurnState } from './turnManager';
import { startEncounter, playCardAction, skipCard, endPlayerTurn } from './turnManager';
import { buildRunPool, recordRunFacts } from './runPoolBuilder';
import { addCardToDeck, createDeck, insertCardWithDelay, addFactsToCooldown, tickFactCooldowns, getEncounterSeenFacts, resetEncounterSeenFacts, exhaustCard } from './deckManager';
import { createEnemy } from './enemyManager';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { activeRunState } from './runStateStore';
import { getBossForFloor, pickCombatEnemy, isBossFloor, isMiniBossEncounter, getMiniBossForFloor, getRegionForFloor, getEnemiesForFloorNode } from './floorManager';
import type { Card, CardRunState } from '../data/card-types';
import { recordCardPlay } from './runManager';
import {
  applyEchoStabilityBonus,
  applyMasteryTrialOutcome,
  awardMasteryCoin,
  getReviewStateByFactId,
  playerSave,
  updateReviewStateByButton,
} from '../ui/stores/playerData';
import { ECHO, HINTS_PER_ENCOUNTER, POST_ENCOUNTER_HEAL_PCT, RELAXED_POST_ENCOUNTER_HEAL_BONUS, POST_BOSS_ENCOUNTER_HEAL_BONUS, EARLY_MINI_BOSS_HP_MULTIPLIER, POST_ENCOUNTER_HEAL_CAP, getBalanceValue, STARTER_DECK_COMPOSITION } from '../data/balance';
import { generateCurrencyReward, generateComboBonus } from './encounterRewards';
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
import { activeRewardBundle, releaseScreenTransition } from '../ui/stores/gameState';
import {
  resolveEncounterStartEffects,
  resolveBaseDrawCount,
  resolveComboStartValue,
} from './relicEffectResolver';
import { resolveDistributionForDomain, createDefaultCalibrationState } from './difficultyCalibration';
import { buildPresetRunPool, buildGeneralRunPool, buildLanguageRunPool } from './presetPoolBuilder'
import { calculateFunnessBoostFactor } from './funnessBoost';
import {
  calculateDeckMastery,
  getCombinedPoolRewardMultiplier,
  getNovelFactPercentage,
  shouldSuppressRewardsForTinyPool,
} from './masteryScalingService';

export interface EncounterSnapshot {
  activeDeck: CardRunState | null
  activeRunPool: Card[]
}

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
  };
}

export function getCombatScene(): CombatScene | null {
  try {
    const reg = globalThis as Record<symbol, unknown>;
    const sym = Symbol.for('terra:cardGameManager');
    const mgr = reg[sym] as { getCombatScene(): CombatScene | null; startCombat(): void } | undefined;
    return mgr?.getCombatScene() ?? null;
  } catch {
    return null;
  }
}

function ensureCombatStarted(): void {
  try {
    const reg = globalThis as Record<symbol, unknown>;
    const sym = Symbol.for('terra:cardGameManager');
    const mgr = reg[sym] as { startCombat(): void } | undefined;
    mgr?.startCombat();
  } catch {
    // ignore
  }
}

export const activeTurnState = writable<TurnState | null>(null);

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
      isBossFloor(turnState.deck.currentFloor)
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
  const existingTurn = get(activeTurnState);
  if (existingTurn && existingTurn.result === null) {
    console.warn('[encounterBridge] Encounter already active, ignoring duplicate start');
    return false;
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
      } else {
        // Language mode — strict language-only pool.
        activeRunPool = buildLanguageRunPool(run.deckMode.languageCode, reviewStates, {
          categoryFilters,
          funnessBoostFactor: calculateFunnessBoostFactor(save?.stats?.totalDivesCompleted ?? 0),
        });
      }
    } else {
      // Legacy path: standard 2-domain builder
      const subscriberCategoryFilters = save && isSubscriber(save)
        ? (save.subscriberCategoryFilters ?? undefined)
        : undefined;
      const calibration = save?.calibrationState ?? createDefaultCalibrationState();
      const primaryDistribution = resolveDistributionForDomain(run.primaryDomain, calibration);
      const secondaryDistribution = resolveDistributionForDomain(run.secondaryDomain, calibration);
      activeRunPool = buildRunPool(run.primaryDomain, run.secondaryDomain, reviewStates, {
        probeRunNumber: run.primaryDomainRunNumber,
        probeDomain: run.primaryDomain,
        subscriberCategoryFilters,
        primaryDistribution,
        secondaryDistribution,
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
      // V2: use act-based boss pool
      const bossCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'boss');
      templateId = bossCandidates.length > 0
        ? bossCandidates[Math.floor(Math.random() * bossCandidates.length)].id
        : (getBossForFloor(run.floor.currentFloor) ?? pickCombatEnemy(run.floor.currentFloor));
    } else if (isMiniBossEncounter(run.floor.currentFloor, run.floor.currentEncounter)) {
      // V2: use act-based mini-boss pool, fall back to legacy
      const miniBossCandidates = getEnemiesForFloorNode(run.floor.currentFloor, 'mini_boss');
      templateId = miniBossCandidates.length > 0
        ? miniBossCandidates[Math.floor(Math.random() * miniBossCandidates.length)].id
        : getMiniBossForFloor(run.floor.currentFloor);
    } else {
      if (run.canary.mode === 'challenge' && Math.random() < 0.35) {
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
  // Early mini-bosses (floors 1-3) have reduced HP for smoother difficulty curve
  if (ascensionTemplate.category === 'mini_boss' && run.floor.currentFloor <= 3) {
    enemyHpMultiplier *= EARLY_MINI_BOSS_HP_MULTIPLIER;
  }
  // Roll difficulty variance for common enemies (0.8-1.2x HP and damage)
  const difficultyVariance = ascensionTemplate.category === 'common'
    ? 0.8 + Math.random() * 0.4
    : 1.0;
  const enemy = createEnemy(ascensionTemplate, run.floor.currentFloor, { hpMultiplier: enemyHpMultiplier, difficultyVariance });
  const turnState = startEncounter(activeDeck, enemy, run.playerMaxHp);
  activeDeck.hintsRemaining = HINTS_PER_ENCOUNTER;
  // Tick encounter cooldowns at the start of each new encounter
  tickFactCooldowns(activeDeck);
  // Reset seen-facts tracker so this encounter starts fresh
  resetEncounterSeenFacts(activeDeck);
  turnState.playerState.hp = run.playerHp;
  turnState.apMax = Math.max(2, run.startingAp);
  turnState.apCurrent = Math.min(turnState.apCurrent, turnState.apMax);
  turnState.activeRelicIds = runRelicIds;
  turnState.baseComboCount = resolveComboStartValue(runRelicIds);
  turnState.comboCount = turnState.baseComboCount;
  turnState.baseDrawCount = resolveBaseDrawCount(runRelicIds);
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
  turnState.ascensionComboResetsOnTurnEnd = ascensionModifiers.comboResetsOnTurnEnd;

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

  turnState.activePassives = [];

  activeTurnState.set(freshTurnState(turnState));
  syncCombatScene(turnState);

  // Encounter start sound + draw swooshes.
  playCardAudio('turn-chime');
  turnState.deck.hand.forEach((_, index) => {
    setTimeout(() => playCardAudio('card-draw'), index * 90);
  });

  return true;
}

function createEchoCardFrom(card: Card): Card {
  // V2: Store full base power at spawn. Multiplier (if any) is applied at resolve time in
  // resolveEchoBase(), not here. originalBaseEffectValue is kept for echo_lens compatibility.
  return {
    ...card,
    id: `echo_${Math.random().toString(36).slice(2, 10)}`,
    isEcho: true,
    originalBaseEffectValue: card.originalBaseEffectValue ?? card.baseEffectValue,
    baseEffectValue: card.originalBaseEffectValue ?? card.baseEffectValue,
  };
}

/**
 * V2: Spawns an Echo card only when a Charge play is answered incorrectly.
 * Quick Play answers never spawn Echoes.
 */
function maybeGenerateEcho(card: Card, wasCorrect: boolean, playMode: PlayMode): void {
  // V2: only wrong Charge answers spawn Echoes; Quick Play never creates Echoes
  if (playMode !== 'charge') return;
  const run = get(activeRunState);
  if (!run || !activeDeck) return;
  if (run.ascensionModifiers?.disableEcho) return;
  if (wasCorrect || card.isEcho || card.isMasteryTrial) return;
  if (run.echoCount >= ECHO.MAX_ECHOES_PER_RUN) return;
  if (run.echoFactIds.has(card.factId)) return;
  if (Math.random() >= ECHO.REAPPEARANCE_CHANCE) return;

  const echoCard = createEchoCardFrom(card);
  insertCardWithDelay(activeDeck, echoCard, ECHO.INSERT_DELAY_CARDS);
  run.echoFactIds.add(card.factId);
  run.echoCount += 1;
  activeRunState.set(run);
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
): void {
  const turnState = get(activeTurnState);
  if (!turnState) return;

  const playedCard = turnState.deck.hand.find((card) => card.id === cardId);
  const previousReviewState = playedCard?.factId ? getReviewStateByFactId(playedCard.factId) : undefined;
  const previousTier = previousReviewState ? getCardTier(previousReviewState) : null;
  const result = playCardAction(turnState, cardId, correct, speedBonus, playMode);
  const run = get(activeRunState);

  if (run && playedCard) {
    recordCardPlay(run, correct, result.comboCount, playedCard.factId, playedCard.domain, playedCard.tier === '1');
    analyticsService.track({
      name: 'card_play',
      properties: {
        fact_id: playedCard.factId,
        card_type: playedCard.cardType,
        tier: playedCard.tier,
        correct,
        combo: result.comboCount,
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
        comboCount: result.comboCount,
      });
    }

    if (result.comboCount >= 4) {
      run.bounties = updateBounties(run.bounties, {
        type: 'combo_reached',
        combo: result.comboCount,
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

    // V2: Correct Echo Charge — double FSRS credit + redeem fact (cannot spawn another Echo)
    if (playedCard.isEcho && correct && playMode === 'charge' && run) {
      applyEchoStabilityBonus(playedCard.factId, ECHO.FSRS_STABILITY_BONUS_CORRECT_V2);
      run.echoFactIds.delete(playedCard.factId);
      activeRunState.set(run);
    }

    // V2: Wrong Echo Charge — exhaust the card (cannot be re-drawn this run)
    if (playedCard.isEcho && !correct && playMode === 'charge' && activeDeck) {
      try {
        exhaustCard(activeDeck, playedCard.id);
      } catch {
        // Card may already have been removed from hand by playCardAction — safe to ignore
      }
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
    maybeGenerateEcho(playedCard, correct, playMode);
  }

  activeTurnState.set(freshTurnState(result.turnState));

  const scene = getCombatScene();
  if (scene) {
    if (result.effect.damageDealt > 0 && !result.enemyDefeated) {
      scene.playEnemyHitAnimation();
    }

    if (correct) {
      if (playedCard?.cardType === 'attack') scene.playPlayerAttackAnimation();
      else if (playedCard?.cardType === 'shield') scene.playPlayerBlockAnimation();
      else scene.playPlayerCastAnimation();
    }

    scene.updateEnemyHP(result.turnState.enemy.currentHP, true);
    scene.updateEnemyBlock(result.turnState.enemy.block, true);
    scene.updatePlayerHP(result.turnState.playerState.hp, result.turnState.playerState.maxHP, true);
    scene.updatePlayerBlock(result.turnState.playerState.shield, true);
    if (result.enemyDefeated) {
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
      const comboBonus = generateComboBonus(result.turnState.baseComboCount);
      run.currency += currencyReward + comboBonus;

      // Capture reward data for step-by-step reveal
      activeRewardBundle.set({
        goldEarned: currencyReward,
        comboBonus,
        healAmount: actualHeal,
      });

      activeRunState.set(run);
    }
    setTimeout(() => {
      activeTurnState.set(null);
      notifyEncounterComplete('victory');
    }, 550);
  }
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

export function handleEndTurn(): void {
  const turnState = get(activeTurnState);
  if (!turnState) return;

  const result = endPlayerTurn(turnState);
  const run = get(activeRunState);
  if (run) {
    run.playerHp = result.turnState.playerState.hp;
    activeRunState.set(run);
  }

  activeTurnState.set(freshTurnState(result.turnState));

  const scene = getCombatScene();
  if (scene) {
    // Animate based on executed enemy intent type
    switch (result.executedIntentType) {
      case 'attack':
        scene.playEnemyAttackAnimation()
        if (result.blockAbsorbedAll) {
          scene.playBlockAbsorbFlash()
        } else if (result.damageDealt > 0) {
          scene.playPlayerDamageFlash()
        }
        break
      case 'multi_attack':
        scene.playEnemyMultiAttackAnimation()
        if (result.blockAbsorbedAll) {
          scene.playBlockAbsorbFlash()
        } else if (result.damageDealt > 0) {
          scene.playPlayerDamageFlash()
        }
        break
      case 'defend':
        scene.playEnemyDefendAnimation()
        break
      case 'buff':
        scene.playEnemyBuffAnimation()
        break
      case 'debuff':
        scene.playEnemyDebuffAnimation()
        break
      case 'heal':
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
      scene.playPlayerDefeatAnimation();
    }
  }

  if (!result.playerDefeated) {
    playCardAudio('turn-chime');
  }

  if (result.playerDefeated) {
    // Record ALL facts seen this encounter for cooldown (not just answered ones)
    if (activeDeck) {
      const seenFacts = getEncounterSeenFacts(activeDeck);
      if (seenFacts.length > 0) addFactsToCooldown(activeDeck, seenFacts);
    }
    setTimeout(() => {
      activeTurnState.set(null);
      activeDeck = null;
      notifyEncounterComplete('defeat');
    }, 550);
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

export function addRewardCardToActiveDeck(card: Card): void {
  if (!activeDeck) return;
  const cloned: Card = {
    ...card,
    id: `reward_${Math.random().toString(36).slice(2, 10)}`,
  };
  addCardToDeck(activeDeck, cloned, 'top');
}

export function calculateCardSellPrice(card: Card): number {
  if (card.tier === '3') return 3;
  if (card.tier === '2a' || card.tier === '2b') return 2;
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
}
