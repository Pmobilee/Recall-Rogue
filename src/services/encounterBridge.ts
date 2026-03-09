/**
 * Bridge between game flow (screen routing) and combat systems (turn/deck/enemy).
 */

import { writable, get } from 'svelte/store';
import type { TurnState } from './turnManager';
import { startEncounter, playCardAction, skipCard, endPlayerTurn } from './turnManager';
import { buildRunPool } from './runPoolBuilder';
import { addCardToDeck, createDeck, insertCardWithDelay } from './deckManager';
import { createEnemy } from './enemyManager';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { activeRunState, onEncounterComplete } from './gameFlowController';
import { getBossForFloor, pickCombatEnemy, isBossFloor } from './floorManager';
import type { Card, CardRunState, PassiveEffect } from '../data/card-types';
import { recordCardPlay } from './runManager';
import {
  applyEchoStabilityBonus,
  applyMasteryTrialOutcome,
  getReviewStateByFactId,
  playerSave,
  setGraduatedRelicId,
  updateReviewStateByButton,
} from '../ui/stores/playerData';
import { ECHO, TIER3_PASSIVE, DORMANCY_THRESHOLD } from '../data/balance';
import type { CombatScene } from '../game/scenes/CombatScene';
import { factsDB } from './factsDB';
import { resolveDomain, resolveCardType } from './domainResolver';
import type { ActiveRelic } from '../data/passiveRelics';
import { assignRelicOnGraduation, buildActiveRelics, checkRelicDormancy } from './relicManager';

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

let activeDeck: CardRunState | null = null;
let activeRunPool: Card[] = [];
let activeRelics: ActiveRelic[] = [];

function factCardTypeResolver(factId: string): ReturnType<typeof resolveCardType> | null {
  const inPool = activeRunPool.find((card) => card.factId === factId);
  if (inPool) return inPool.cardType;
  const fact = factsDB.getById(factId);
  if (!fact) return null;
  return resolveCardType(resolveDomain(fact));
}

function buildPassiveEffectsFromRelics(relics: ActiveRelic[]): PassiveEffect[] {
  return relics
    .filter((relic) => !relic.isDormant)
    .map((relic) => ({
      sourceFactId: relic.sourceFactId,
      cardType: relic.definition.graduationType[0] ?? 'attack',
      domain: 'science',
      value: TIER3_PASSIVE[relic.definition.graduationType[0] ?? 'attack'] ?? 1,
    }));
}

function recomputeActiveRelics(): void {
  const save = get(playerSave);
  const reviewStates = save?.reviewStates ?? [];
  activeRelics = buildActiveRelics(reviewStates, factCardTypeResolver);

  const factStates = new Map<string, { retrievability: number }>();
  for (const state of reviewStates) {
    factStates.set(state.factId, { retrievability: state.retrievability ?? 1 });
  }
  checkRelicDormancy(activeRelics, factStates);
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
    );
    scene.setEnemyIntent(
      turnState.enemy.nextIntent.telegraph,
      turnState.enemy.nextIntent.value > 0 ? turnState.enemy.nextIntent.value : undefined,
    );
    scene.updatePlayerHP(turnState.playerState.hp, turnState.playerState.maxHP, false);
    scene.setFloorInfo(
      turnState.deck.currentFloor,
      turnState.deck.currentEncounter,
      3,
    );
    scene.setRelics(
      activeRelics
        .filter((relic) => !relic.isDormant)
        .map((relic) => ({
          domain: relic.definition.category,
          label: relic.definition.name,
        })),
    );
  };

  const scene = getCombatScene();
  if (scene && scene.scene.isActive()) {
    pushDisplayData();
  } else {
    setTimeout(pushDisplayData, 100);
  }
}

export function startEncounterForRoom(enemyId?: string): void {
  const run = get(activeRunState);
  if (!run) return;

  if (!activeDeck) {
    const reviewStates = get(playerSave)?.reviewStates ?? [];
    activeRunPool = buildRunPool(run.primaryDomain, run.secondaryDomain, reviewStates);
    const starterDeck = activeRunPool.slice(0, 24);
    activeDeck = createDeck(starterDeck);
  }

  recomputeActiveRelics();

  let templateId = enemyId;
  if (!templateId) {
    if (isBossFloor(run.floor.currentFloor)) {
      templateId = getBossForFloor(run.floor.currentFloor) ?? pickCombatEnemy(run.floor.currentFloor);
    } else {
      templateId = pickCombatEnemy(run.floor.currentFloor);
    }
  }

  const template = ENEMY_TEMPLATES.find((enemyTemplate) => enemyTemplate.id === templateId);
  if (!template || !activeDeck) return;

  const enemy = createEnemy(template, run.floor.currentFloor);
  const turnState = startEncounter(activeDeck, enemy, run.playerMaxHp);
  turnState.playerState.hp = run.playerHp;
  turnState.activeRelics = activeRelics;
  turnState.activeRelicIds = new Set(
    activeRelics.filter((relic) => !relic.isDormant).map((relic) => relic.definition.id),
  );
  turnState.baseComboCount = turnState.activeRelicIds.has('combo_master') ? 1 : 0;
  turnState.comboCount = turnState.baseComboCount;
  turnState.baseDrawCount = turnState.activeRelicIds.has('quick_draw') ? 6 : 5;

  // Encounter-start relic hooks.
  if (turnState.activeRelicIds.has('iron_skin')) {
    turnState.playerState.shield += 4;
  }
  if (turnState.activeRelicIds.has('natural_recovery')) {
    turnState.playerState.hp = Math.min(turnState.playerState.maxHP, turnState.playerState.hp + 2);
  }

  // Tier-3 passives (legacy CR-08 layer) still supported.
  turnState.activePassives = buildPassiveEffectsFromRelics(activeRelics);

  activeTurnState.set(turnState);
  syncCombatScene(turnState);
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

  const reviewState = getReviewStateByFactId(card.factId);
  if (!reviewState) return;
  if (reviewState.retrievability != null && reviewState.retrievability < DORMANCY_THRESHOLD) return;

  const definition = assignRelicOnGraduation(card.cardType, activeRelics);
  if (!definition) {
    setGraduatedRelicId(card.factId, null);
    return;
  }

  setGraduatedRelicId(card.factId, definition.id);
  recomputeActiveRelics();
}

export function handlePlayCard(cardId: string, correct: boolean, speedBonus: boolean): void {
  const turnState = get(activeTurnState);
  if (!turnState) return;

  const playedCard = turnState.deck.hand.find((card) => card.id === cardId);
  const result = playCardAction(turnState, cardId, correct, speedBonus);
  const run = get(activeRunState);

  if (run) {
    recordCardPlay(run, correct, result.comboCount);
    run.playerHp = result.turnState.playerState.hp;
    activeRunState.set(run);
  }

  if (playedCard?.factId) {
    const button = !correct ? 'again' : speedBonus ? 'good' : 'okay';
    updateReviewStateByButton(playedCard.factId, button);

    if (playedCard.isEcho && correct) {
      applyEchoStabilityBonus(playedCard.factId, ECHO.FSRS_STABILITY_BONUS);
    }
    maybeApplyMasteryOutcome(playedCard, correct);
    maybeGenerateEcho(playedCard, correct);
  }

  activeTurnState.set({ ...result.turnState });

  const scene = getCombatScene();
  if (scene) {
    scene.updateEnemyHP(result.turnState.enemy.currentHP, true);
    scene.updatePlayerHP(result.turnState.playerState.hp, result.turnState.playerState.maxHP, true);
    if (result.enemyDefeated) scene.playEnemyDeathAnimation();
  }

  if (result.enemyDefeated) {
    setTimeout(() => {
      activeTurnState.set(null);
      onEncounterComplete('victory');
    }, 550);
  }
}

export function handleSkipCard(cardId: string): void {
  const turnState = get(activeTurnState);
  if (!turnState) return;
  skipCard(turnState, cardId);

  const run = get(activeRunState);
  if (run && turnState.activeRelicIds.has('scavenger')) {
    run.currency += 1;
    activeRunState.set(run);
  }

  activeTurnState.set({ ...turnState });
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

  activeTurnState.set({ ...result.turnState });

  const scene = getCombatScene();
  if (scene) {
    scene.updatePlayerHP(result.turnState.playerState.hp, result.turnState.playerState.maxHP, true);
    scene.updateEnemyHP(result.turnState.enemy.currentHP, true);
    scene.setEnemyIntent(
      result.turnState.enemy.nextIntent.telegraph,
      result.turnState.enemy.nextIntent.value > 0 ? result.turnState.enemy.nextIntent.value : undefined,
    );
  }

  if (result.playerDefeated) {
    setTimeout(() => {
      activeTurnState.set(null);
      activeDeck = null;
      onEncounterComplete('defeat');
    }, 550);
  }
}

export function getRunPoolCards(): Card[] {
  return activeRunPool;
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

export function resetEncounterBridge(): void {
  activeTurnState.set(null);
  activeDeck = null;
  activeRunPool = [];
  activeRelics = [];
}
