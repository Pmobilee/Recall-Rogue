/**
 * Bridge between game flow (screen routing) and combat systems (turn/deck/enemy).
 */

import { writable, get } from 'svelte/store';
import type { TurnState } from './turnManager';
import { startEncounter, playCardAction, skipCard, endPlayerTurn } from './turnManager';
import { buildRunPool, recordRunFacts } from './runPoolBuilder';
import { addCardToDeck, createDeck, insertCardWithDelay, addFactsToCooldown, tickFactCooldowns } from './deckManager';
import { createEnemy } from './enemyManager';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { activeRunState } from './runStateStore';
import { getBossForFloor, pickCombatEnemy, isBossFloor, isMiniBossEncounter, getMiniBossForFloor } from './floorManager';
import type { Card, CardRunState, CardType } from '../data/card-types';
import { recordCardPlay } from './runManager';
import {
  applyEchoStabilityBonus,
  applyMasteryTrialOutcome,
  awardMasteryCoin,
  getReviewStateByFactId,
  playerSave,
  updateReviewStateByButton,
} from '../ui/stores/playerData';
import { ECHO, HINTS_PER_ENCOUNTER, POST_ENCOUNTER_HEAL_PCT, EXPLORER_POST_ENCOUNTER_HEAL_BONUS, POST_BOSS_ENCOUNTER_HEAL_BONUS, EARLY_MINI_BOSS_HP_MULTIPLIER } from '../data/balance';
import type { CombatScene } from '../game/scenes/CombatScene';
import { factsDB } from './factsDB';
import { RELIC_BY_ID } from '../data/relics/index';
import { onboardingState, difficultyMode } from './cardPreferences';
import { updateBounties } from './bountyManager';
import { getCardTier } from './tierDerivation';
import { playCardAudio } from './cardAudioManager';
import { analyticsService } from './analyticsService';
import { isSubscriber } from './subscriptionService';
import {
  applyAscensionEnemyTemplateAdjustments,
  getAscensionModifiers,
} from './ascension';
import {
  resolveEncounterStartEffects,
  resolveBaseDrawCount,
  resolveComboStartValue,
} from './relicEffectResolver';

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

function getCombatScene(): CombatScene | null {
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

function buildStarterDeckFromRunPool(runPool: Card[], targetSize: number): Card[] {
  const byType = new Map<CardType, Card[]>();
  for (const card of runPool) {
    if (!byType.has(card.cardType)) byType.set(card.cardType, []);
    byType.get(card.cardType)!.push(card);
  }

  const size = Math.max(9, Math.min(targetSize, runPool.length));
  const attackTarget = Math.max(1, Math.round(size * 0.4));
  const shieldTarget = Math.max(1, Math.round(size * 0.33));
  const healTarget = Math.max(1, size - attackTarget - shieldTarget);
  const picked: Card[] = [];
  const used = new Set<string>();

  const take = (type: CardType, count: number): void => {
    const bucket = byType.get(type) ?? [];
    for (const card of bucket) {
      if (picked.length >= size || count <= 0) break;
      if (used.has(card.id)) continue;
      picked.push(card);
      used.add(card.id);
      count -= 1;
    }
  };

  take('attack', attackTarget);
  take('shield', shieldTarget);
  take('heal', healTarget);

  for (const card of runPool) {
    if (picked.length >= size) break;
    if (used.has(card.id)) continue;
    picked.push(card);
    used.add(card.id);
  }

  return picked;
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
    );
    scene.setEnemyIntent(
      turnState.enemy.nextIntent.telegraph,
      turnState.enemy.nextIntent.value > 0 ? turnState.enemy.nextIntent.value : undefined,
    );
    scene.updatePlayerHP(turnState.playerState.hp, turnState.playerState.maxHP, false);
    scene.updateEnemyBlock(turnState.enemy.block, false);
    scene.setFloorInfo(
      turnState.deck.currentFloor,
      turnState.deck.currentEncounter,
      3,
    );
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
    }
  };
  tryPush(25);
}

export async function startEncounterForRoom(enemyId?: string): Promise<boolean> {
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
    const subscriberCategoryFilters = save && isSubscriber(save)
      ? (save.subscriberCategoryFilters ?? undefined)
      : undefined;
    activeRunPool = buildRunPool(run.primaryDomain, run.secondaryDomain, reviewStates, {
      probeRunNumber: run.primaryDomainRunNumber,
      probeDomain: run.primaryDomain,
      subscriberCategoryFilters,
    });
    // Record pool fact IDs for recently-played deprioritization in future runs
    recordRunFacts(activeRunPool.map(c => c.factId));
    if (activeRunPool.length === 0) {
      console.warn('[encounterBridge] Empty run pool — cannot start encounter');
      return false;
    }
    const starterDeck = buildStarterDeckFromRunPool(activeRunPool, run.starterDeckSize);
    activeDeck = createDeck(starterDeck);
  }

  // Build active relic IDs from run state
  const runRelicIds = new Set<string>(
    (run.runRelics ?? []).map((r) => r.definitionId)
  );

  let templateId = enemyId;
  if (!templateId) {
    if (isBossFloor(run.floor.currentFloor) && run.floor.currentEncounter === run.floor.encountersPerFloor) {
      templateId = getBossForFloor(run.floor.currentFloor) ?? pickCombatEnemy(run.floor.currentFloor);
    } else if (isMiniBossEncounter(run.floor.currentFloor, run.floor.currentEncounter)) {
      templateId = getMiniBossForFloor(run.floor.currentFloor);
    } else {
      if (run.canary.mode === 'challenge' && Math.random() < 0.35) {
        const eliteCandidates = ENEMY_TEMPLATES.filter((enemyTemplate) => enemyTemplate.category === 'elite');
        templateId = eliteCandidates[Math.floor(Math.random() * eliteCandidates.length)]?.id ?? pickCombatEnemy(run.floor.currentFloor);
      } else {
        templateId = pickCombatEnemy(run.floor.currentFloor);
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
  const enemy = createEnemy(ascensionTemplate, run.floor.currentFloor, { hpMultiplier: enemyHpMultiplier });
  const turnState = startEncounter(activeDeck, enemy, run.playerMaxHp);
  activeDeck.hintsRemaining = HINTS_PER_ENCOUNTER;
  // Tick encounter cooldowns at the start of each new encounter
  tickFactCooldowns(activeDeck);
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
  turnState.ascensionHealCardMultiplier = ascensionModifiers.healCardMultiplier;
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

  const onboarding = get(onboardingState);
  if (!onboarding.hasCompletedOnboarding && run.floor.currentFloor === 1 && run.floor.currentEncounter <= 2) {
    turnState.apMax = 2;
    turnState.apCurrent = Math.min(turnState.apCurrent, 2);
  }

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
  return {
    ...card,
    id: `echo_${Math.random().toString(36).slice(2, 10)}`,
    isEcho: true,
    originalBaseEffectValue: card.originalBaseEffectValue ?? card.baseEffectValue,
    baseEffectValue: Math.max(1, Math.round(card.baseEffectValue * ECHO.POWER_MULTIPLIER)),
  };
}

function maybeGenerateEcho(card: Card, wasCorrect: boolean): void {
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
): void {
  const turnState = get(activeTurnState);
  if (!turnState) return;

  const playedCard = turnState.deck.hand.find((card) => card.id === cardId);
  const previousReviewState = playedCard?.factId ? getReviewStateByFactId(playedCard.factId) : undefined;
  const previousTier = previousReviewState ? getCardTier(previousReviewState) : null;
  const result = playCardAction(turnState, cardId, correct, speedBonus);
  const run = get(activeRunState);

  if (run && playedCard) {
    recordCardPlay(run, correct, result.comboCount, playedCard.factId);
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

    if (playedCard.isEcho && correct) {
      applyEchoStabilityBonus(playedCard.factId, ECHO.FSRS_STABILITY_BONUS);
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
    maybeGenerateEcho(playedCard, correct);
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
    if (result.enemyDefeated) {
      playCardAudio('enemy-death');
      scene.playEnemyDeathAnimation();
      scene.playPlayerVictoryAnimation();
    }
  }

  if (result.enemyDefeated) {
    // Record answered facts for cooldown before encounter ends
    if (activeDeck && result.turnState.encounterAnsweredFacts.length > 0) {
      addFactsToCooldown(activeDeck, result.turnState.encounterAnsweredFacts);
    }
    // Post-encounter healing: restore a percentage of max HP
    // Boss/mini-boss encounters grant bonus healing (AR-32)
    if (run) {
      const isStoryMode = get(difficultyMode) === 'explorer';
      const enemyCategory = result.turnState.enemy.template.category;
      const isBossOrMiniBoss = enemyCategory === 'boss' || enemyCategory === 'mini_boss';
      const healPct = POST_ENCOUNTER_HEAL_PCT
        + (isStoryMode ? EXPLORER_POST_ENCOUNTER_HEAL_BONUS : 0)
        + (isBossOrMiniBoss ? POST_BOSS_ENCOUNTER_HEAL_BONUS : 0);
      const healAmt = Math.round(run.playerMaxHp * healPct);
      run.playerHp = Math.min(run.playerMaxHp, run.playerHp + healAmt);
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
    if (result.damageDealt > 0) {
      scene.playEnemyAttackAnimation();
      scene.playPlayerDamageFlash();
    }
    scene.updatePlayerHP(result.turnState.playerState.hp, result.turnState.playerState.maxHP, true);
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
    // Record answered facts for cooldown before encounter ends
    if (activeDeck && result.turnState.encounterAnsweredFacts.length > 0) {
      addFactsToCooldown(activeDeck, result.turnState.encounterAnsweredFacts);
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
