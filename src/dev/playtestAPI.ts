/**
 * Playtest gameplay API — registers window.__rrPlay in dev mode.
 * Lets AI models play Recall Rogue programmatically via action and perception methods.
 * DEV MODE ONLY — never included in production builds.
 */

import {
  look, getAllText, getQuizText, getStudyCardText, getHUDText,
  getNotifications, validateScreen,
} from './playtestDescriber'
import { readStore } from './storeBridge'
import { turboDelay } from '../utils/turboMode'
import { factsDB } from '../services/factsDB'
import { RELIC_BY_ID } from '../data/relics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayResult {
  ok: boolean;
  message: string;
  state?: Record<string, unknown>;
}

/** Write a value to a Svelte store singleton. */
function writeStore<T>(key: string, value: T): void {
  const sym = Symbol.for(key);
  const store = (globalThis as Record<symbol, unknown>)[sym];
  if (!store || typeof store !== 'object') return;
  const s = store as { set?: (v: T) => void };
  if (typeof s.set === 'function') s.set(value);
}

/** Get the GameManager instance from the store. */
function getGM(): any {
  return readStore('rr:gameManagerStore');
}


/** Small async delay helper. */
function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Wrap an async action with try/catch, returning a PlayResult. */
async function safeAction(fn: () => Promise<PlayResult>): Promise<PlayResult> {
  try {
    return await fn();
  } catch (err: any) {
    return { ok: false, message: `Error: ${err?.message ?? String(err)}` };
  }
}


// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Navigate to a screen by writing the currentScreen store. */
async function navigate(screen: string): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('rr:currentScreen', screen);
    await wait(turboDelay(300));
    const actual = readStore<string>('rr:currentScreen');
    if (actual === screen) {
      return { ok: true, message: `Navigated to ${screen}` };
    }
    return { ok: false, message: `Requested ${screen}, but current screen is ${actual}` };
  });
}

/** Get the current screen name. */
function getScreen(): string {
  return readStore<string>('rr:currentScreen') ?? 'unknown';
}

/** Get the list of available screens based on current state. */
function getAvailableScreens(): string[] {
  const always = ['hub', 'library', 'settings', 'profile', 'journal', 'leaderboards'];
  const screen = getScreen();
  const extras: string[] = [];

  const runState = readStore<any>('rr:activeRunState');
  if (runState) {
    extras.push('combat', 'dungeonMap', 'cardReward', 'retreatOrDelve');
  }

  return [...new Set([...always, ...extras])];
}

// ---------------------------------------------------------------------------
// Card Roguelite — Run Management
// ---------------------------------------------------------------------------

/** Start a new run by clicking the Start Run button. */
async function startRun(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-start-run"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Start Run button not found' };
    btn.click();
    await wait(turboDelay(1500));
    return { ok: true, message: `Run started. Screen: ${getScreen()}` };
  });
}

/** Select a domain — handles deckSelectionHub → triviaDungeon → start flow. */
async function selectDomain(domain: string): Promise<PlayResult> {
  return safeAction(async () => {
    const screen = getScreen();

    // Step 1: If on deckSelectionHub, click Trivia Dungeon panel first
    if (screen === 'deckSelectionHub') {
      const triviaPanel = document.querySelector('button.panel--trivia') as HTMLElement | null;
      if (!triviaPanel) return { ok: false, message: 'Trivia Dungeon panel not found on deckSelectionHub' };
      triviaPanel.click();
      await wait(turboDelay(1000));
    }

    // Step 2: Click domain card on triviaDungeon screen
    const domainCard = document.querySelector(`[data-testid="domain-card-${domain}"]`) as HTMLElement | null;
    if (domainCard) {
      domainCard.click();
      await wait(turboDelay(500));
    }

    // Step 3: Click Start Run footer button
    const startBtn = document.querySelector('button.footer-start-btn') as HTMLElement | null;
    if (startBtn) {
      startBtn.click();
      await wait(turboDelay(1500));
    }

    return { ok: true, message: `Selected domain: ${domain}. Screen: ${getScreen()}` };
  });
}

/** Archetype is auto-selected as 'balanced' per GAME_DESIGN.md. This is a no-op. */
async function selectArchetype(_archetype: string): Promise<PlayResult> {
  return { ok: true, message: 'Archetype auto-selected as balanced. Screen: ' + getScreen() };
}

// ---------------------------------------------------------------------------
// Card Roguelite — Combat
// ---------------------------------------------------------------------------

/** Get the current combat state. */
function getCombatState(): Record<string, unknown> | null {
  const turnState = readStore<any>('rr:activeTurnState');
  if (!turnState) return null;
  // Guard: if combat has ended (enemy/player state cleared during transition), return null
  const enemy = turnState.enemy;
  if (!enemy || !turnState.playerState) return null;
  const runState = readStore<any>('rr:activeRunState');
  return {
    // Player
    playerHp: turnState.playerState?.hp,
    playerMaxHp: turnState.playerState?.maxHP,
    playerBlock: turnState.playerState?.shield ?? 0,
    playerStatusEffects: (turnState.playerState?.statusEffects ?? []).map((s: any) => ({
      type: s.type, value: s.value, turnsRemaining: s.turnsRemaining,
    })),
    ap: turnState.apCurrent,
    apMax: turnState.apMax,
    // Enemy
    enemyName: enemy?.template?.name ?? enemy?.name ?? 'Unknown',
    enemyHp: enemy?.currentHP ?? enemy?.health,
    enemyMaxHp: enemy?.maxHP ?? enemy?.maxHealth,
    enemyBlock: enemy?.block ?? 0,
    enemyIntent: enemy?.nextIntent ? {
      type: enemy.nextIntent.type,
      value: enemy.nextIntent.value,
      telegraph: enemy.nextIntent.telegraph,
      hitCount: enemy.nextIntent.hitCount,
      statusEffect: enemy.nextIntent.statusEffect ?? null,
    } : null,
    enemyStatusEffects: (enemy?.statusEffects ?? []).map((s: any) => ({
      type: s.type, value: s.value, turnsRemaining: s.turnsRemaining,
    })),
    // Hand
    handSize: turnState.deck?.hand?.length ?? 0,
    hand: (turnState.deck?.hand ?? []).map((c: any) => {
      const fact = c.factId && factsDB.isReady() ? factsDB.getById(c.factId) : null;
      return {
        type: c.cardType,
        mechanic: c.mechanicId ?? null,
        mechanicName: c.mechanicName ?? null,
        tier: c.tier,
        apCost: c.apCost ?? 1,
        baseEffectValue: c.baseEffectValue,
        domain: c.domain ?? null,
        factId: c.factId ?? null,
        factQuestion: fact?.quizQuestion ?? null,
        factAnswer: fact?.correctAnswer ?? null,
        isLocked: c.isLocked ?? false,
        isCursed: c.isCursed ?? false,
        isUpgraded: c.isUpgraded ?? false,
        masteryLevel: c.masteryLevel ?? 0,
        chainType: c.chainType ?? null,
      };
    }),
    // Turn & Run
    turn: turnState.turn,
    cardsPlayedThisTurn: turnState.cardsPlayedThisTurn ?? 0,
    floor: runState?.currentFloor,
    segment: runState?.currentSegment,
    gold: runState?.currency,
  };
}

/** Play a card by clicking it in the hand. */
async function playCard(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="card-hand-${index}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Card at index ${index} not found` };
    btn.click();
    await wait(turboDelay(800));
    return { ok: true, message: `Selected card ${index}. Screen: ${getScreen()}` };
  });
}

/** Quick Play a card at the given hand index (base damage, no quiz, 1 AP cost).
 *  Calls handlePlayCard with playMode='quick' — the same code path as a real quick play tap. */
async function quickPlayCard(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const { handlePlayCard, activeTurnState } = await import('../services/encounterBridge');
    const { get } = await import('svelte/store');
    const turnState = get(activeTurnState);
    if (!turnState) return { ok: false, message: 'No active turn state — are you in combat?' };

    const hand = turnState.deck?.hand;
    if (!Array.isArray(hand) || index < 0 || index >= hand.length) {
      return { ok: false, message: `Card index ${index} is out of range (hand size: ${hand?.length ?? 0})` };
    }

    const card = hand[index];
    if (!card) return { ok: false, message: `No card at index ${index}` };
    if ((card.apCost ?? 1) > (turnState.apCurrent ?? 0)) {
      return { ok: false, message: `Not enough AP to play card ${index} (needs ${card.apCost ?? 1}, have ${turnState.apCurrent ?? 0})` };
    }

    const prevHandSize = hand.length;
    handlePlayCard(card.id, true, false, undefined, undefined, 'quick');
    // Poll until the turn state actually updates (hand shrinks or AP changes)
    for (let i = 0; i < 50; i++) {
      await wait(10);
      const updated = get(activeTurnState);
      if (!updated) break; // Turn ended (encounter resolved)
      const newHand = updated.deck?.hand;
      if (!newHand || newHand.length < prevHandSize || updated.apCurrent < turnState.apCurrent) break;
    }
    return {
      ok: true,
      message: `Quick-played card ${index} (${card.cardType}, "${(card as any).fact?.question ?? card.id}")`,
      state: { cardId: card.id, cardType: card.cardType, playMode: 'quick' },
    };
  });
}

/** Charge a card and auto-answer the quiz (correct or incorrect based on parameter).
 *  Calls handlePlayCard with playMode='charge' — the same code path as a real charge play. */
async function chargePlayCard(index: number, answerCorrectly: boolean): Promise<PlayResult> {
  return safeAction(async () => {
    const { handlePlayCard, activeTurnState } = await import('../services/encounterBridge');
    const { get } = await import('svelte/store');
    const turnState = get(activeTurnState);
    if (!turnState) return { ok: false, message: 'No active turn state — are you in combat?' };

    const hand = turnState.deck?.hand;
    if (!Array.isArray(hand) || index < 0 || index >= hand.length) {
      return { ok: false, message: `Card index ${index} is out of range (hand size: ${hand?.length ?? 0})` };
    }

    const card = hand[index];
    if (!card) return { ok: false, message: `No card at index ${index}` };

    // Charge play costs +1 AP compared to quick play
    const chargeCost = (card.apCost ?? 1) + 1;
    if (chargeCost > (turnState.apCurrent ?? 0)) {
      return { ok: false, message: `Not enough AP to charge-play card ${index} (needs ${chargeCost}, have ${turnState.apCurrent ?? 0})` };
    }

    const prevHandSize = hand.length;
    handlePlayCard(card.id, answerCorrectly, false, 1500, undefined, 'charge');
    // Poll until the turn state actually updates (hand shrinks or AP changes)
    for (let i = 0; i < 50; i++) {
      await wait(10);
      const updated = get(activeTurnState);
      if (!updated) break; // Turn ended (encounter resolved)
      const newHand = updated.deck?.hand;
      if (!newHand || newHand.length < prevHandSize || updated.apCurrent < turnState.apCurrent) break;
    }
    return {
      ok: true,
      message: `Charge-played card ${index} (${card.cardType}) — answered ${answerCorrectly ? 'correctly' : 'incorrectly'}`,
      state: { cardId: card.id, cardType: card.cardType, playMode: 'charge', answerCorrectly },
    };
  });
}

/** Preview the quiz that would appear if a card is charge-played. Does NOT play the card or consume AP. */
async function previewCardQuiz(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const { activeTurnState } = await import('../services/encounterBridge');
    const { get } = await import('svelte/store');
    const turnState = get(activeTurnState);
    if (!turnState) return { ok: false, message: 'No active turn state — are you in combat?' };

    const hand = turnState.deck?.hand;
    if (!Array.isArray(hand) || index < 0 || index >= hand.length) {
      return { ok: false, message: `Card index ${index} is out of range (hand size: ${hand?.length ?? 0})` };
    }

    const card = hand[index];
    if (!card?.factId) {
      return { ok: false, message: `Card at index ${index} has no fact assigned` };
    }

    const fact = factsDB.isReady() ? factsDB.getById(card.factId) : null;
    if (!fact) {
      return { ok: false, message: `Fact '${card.factId}' not found in factsDB` };
    }

    const { getQuizChoices } = await import('../services/quizService');
    const { displayAnswer } = await import('../services/numericalDistractorService');
    const choices = getQuizChoices(fact);
    const correctAnswer = displayAnswer(fact.correctAnswer ?? '');
    const correctIndex = choices.indexOf(correctAnswer);

    return {
      ok: true,
      message: `Quiz preview for card ${index}`,
      state: {
        question: fact.quizQuestion ?? '',
        choices,
        correctAnswer,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        factId: card.factId,
        domain: card.domain ?? null,
        cardType: card.cardType,
      },
    };
  });
}

/** End the current combat turn. Polls until the turn actually advances (max 3s). */
async function endTurn(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-end-turn"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'End turn button not found' };
    if (btn.disabled) return { ok: false, message: 'End turn button is disabled' };

    // Read current screen before clicking
    const prevScreen = getScreen();
    btn.click();

    // Poll until turn advances or screen changes (max 3s)
    for (let i = 0; i < 60; i++) {
      await wait(50);
      const screen = getScreen();
      if (screen !== prevScreen || screen !== 'combat') break;
      // Check if button is re-enabled (new turn started)
      const newBtn = document.querySelector('[data-testid="btn-end-turn"]') as HTMLButtonElement | null;
      if (newBtn && !newBtn.disabled) break;
    }

    return { ok: true, message: `Turn ended. Screen: ${getScreen()}` };
  });
}

// ---------------------------------------------------------------------------
// Card Roguelite — Room & Reward
// ---------------------------------------------------------------------------

/** Select a room choice door. */
async function selectRoom(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="room-choice-${index}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Room choice ${index} not found` };
    btn.click();
    await wait(turboDelay(1500));
    return { ok: true, message: `Selected room ${index}. Screen: ${getScreen()}` };
  });
}

/** Select a map node by ID (e.g. 'r0-n0'). Triggers the full node selection + room entry flow.
 *  Polls until screen changes from dungeonMap (max 5s) to handle slow ensurePhaserBooted + startEncounterForRoom. */
async function selectMapNode(nodeId: string): Promise<PlayResult> {
  return safeAction(async () => {
    // Click the DOM button directly — this fires the Svelte onclick handler
    const btn = document.querySelector(`[data-testid="map-node-${nodeId}"]`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Map node ${nodeId} not found` };
    if (btn.disabled) return { ok: false, message: `Map node ${nodeId} is disabled (state: ${btn.className})` };
    btn.click();

    // Poll until screen changes from dungeonMap (max 5s)
    // Needed because ensurePhaserBooted + startEncounterForRoom can take 500ms+ in turbo mode
    for (let i = 0; i < 100; i++) {
      await wait(50);
      const screen = getScreen();
      if (screen !== 'dungeonMap') break;
    }

    return { ok: true, message: `Selected map node ${nodeId}. Screen: ${getScreen()}` };
  });
}

/**
 * Accept rewards in the Phaser RewardRoomScene.
 *
 * The reward room is a Phaser scene — no DOM buttons exist. This function:
 * 1. Falls back to a DOM button if one is present (for any Svelte-only fallback screens).
 * 2. Otherwise, drives the Phaser RewardRoomScene directly:
 *    - Emits 'pointerdown' on gold/vial sprites to collect them immediately.
 *    - For card items, emits 'pointerdown' on the sprite (shows the card detail overlay),
 *      then accepts via getCardDetailCallbacks().onAccept().
 *    - For relic items, follows the same accept-via-callbacks pattern.
 * 3. Waits for the scene to auto-advance (checkAutoAdvance fires when all collected).
 */
async function acceptReward(): Promise<PlayResult> {
  return safeAction(async () => {
    // Try DOM button first (Svelte fallback screen)
    const btn = document.querySelector('[data-testid="reward-accept"]') as HTMLButtonElement | null;
    if (btn) {
      btn.click();
      await wait(turboDelay(1000));
      return { ok: true, message: `Reward accepted via DOM. Screen: ${getScreen()}` };
    }

    // Phaser RewardRoomScene path
    const reg = globalThis as Record<symbol, unknown>;
    const mgr = reg[Symbol.for('rr:cardGameManager')] as any;
    if (!mgr) return { ok: false, message: 'CardGameManager not found' };

    // Poll for scene activation — Phaser queues scene.start() asynchronously,
    // so the scene may not be active on the first check after combat ends.
    let scene = null;
    for (let i = 0; i < 60; i++) {  // 60 × 50ms = 3s max
      scene = mgr.getRewardRoomScene();
      if (scene && scene.scene?.isActive()) break;
      scene = null;
      await wait(50);
    }
    if (!scene) {
      return { ok: false, message: 'RewardRoomScene not active after 3s wait' };
    }

    // Auto-collect all non-card, non-relic items first (gold, vials).
    // Each item's sprite has a pointerdown listener that calls handleItemTap.
    const items = scene.items as Array<{ collected: boolean; reward: { type: string }; sprite: any }>;
    for (const item of items) {
      if (item.collected) continue;
      if (item.reward.type === 'gold' || item.reward.type === 'health_vial') {
        (item.sprite as any)?.emit('pointerdown');
        await wait(turboDelay(200));
      }
    }

    // Handle first uncollected card item.
    // Tapping opens the card detail overlay; accept via bridge callbacks.
    const cardItem = items.find(i => !i.collected && i.reward.type === 'card');
    if (cardItem) {
      (cardItem.sprite as any)?.emit('pointerdown');
      await wait(turboDelay(300));

      const { getCardDetailCallbacks } = await import('../services/rewardRoomBridge');
      const callbacks = getCardDetailCallbacks();
      if (callbacks) {
        callbacks.onAccept();
        await wait(turboDelay(500));
      }
    }

    // Handle first uncollected relic item.
    const relicItem = items.find(i => !i.collected && i.reward.type === 'relic');
    if (relicItem) {
      (relicItem.sprite as any)?.emit('pointerdown');
      await wait(turboDelay(300));

      const { getCardDetailCallbacks } = await import('../services/rewardRoomBridge');
      const callbacks = getCardDetailCallbacks();
      if (callbacks) {
        callbacks.onAccept();
        await wait(turboDelay(500));
      }
    }

    // Wait for checkAutoAdvance to fire (triggers sceneComplete when all items collected).
    await wait(turboDelay(1000));

    return { ok: true, message: `Reward accepted via Phaser scene. Screen: ${getScreen()}` };
  });
}

/** Select a card reward type option. */
async function selectRewardType(cardType: string): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="reward-type-${cardType}"]`) as HTMLElement | null;
    if (!btn) return { ok: false, message: `Reward type '${cardType}' not found` };
    btn.click();
    await wait(turboDelay(500));
    return { ok: true, message: `Selected reward type: ${cardType}` };
  });
}

/** Select a relic from the relic reward choices. Returns the picked relic's definitionId. */
async function selectRelic(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="relic-option-${index}"]`) as HTMLElement | null;
    if (!btn) {
      // Try alternate selectors
      const alt = document.querySelector(`[data-testid="relic-choice-${index}"]`) as HTMLElement | null;
      if (!alt) return { ok: false, message: `Relic option ${index} not found` };
      alt.click();
    } else {
      btn.click();
    }
    await wait(turboDelay(1000));

    // Read the run state to get the latest relic
    const runState = readStore<any>('rr:activeRunState');
    const relics = runState?.runRelics ?? [];
    const lastRelic = relics[relics.length - 1];

    return {
      ok: true,
      message: `Selected relic ${index}`,
      state: { relicId: lastRelic?.definitionId ?? '' },
    };
  });
}

/** Get detailed relic information from the active run, including definitions. */
function getRelicDetails(): Array<Record<string, unknown>> {
  const runState = readStore<any>('rr:activeRunState');
  if (!runState?.runRelics) return [];
  return runState.runRelics.map((r: any) => {
    const def = RELIC_BY_ID[r.definitionId];
    return {
      id: r.definitionId ?? '',
      name: def?.name ?? r.definitionId ?? '',
      description: def?.description ?? '',
      rarity: def?.rarity ?? 'common',
      trigger: def?.trigger ?? 'unknown',
      acquiredAtFloor: r.acquiredAtFloor ?? 0,
      triggerCount: r.triggerCount ?? 0,
    };
  });
}

/** Retreat at a checkpoint (cash out). */
async function retreat(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-retreat"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Retreat button not found' };
    btn.click();
    await wait(turboDelay(2000));
    return { ok: true, message: `Retreated. Screen: ${getScreen()}` };
  });
}

/** Delve deeper at a checkpoint. */
async function delve(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="btn-delve"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Delve button not found' };
    btn.click();
    await wait(turboDelay(2000));
    return { ok: true, message: `Delving deeper. Screen: ${getScreen()}` };
  });
}

/** Get the current run state. */
function getRunState(): Record<string, unknown> | null {
  const runState = readStore<any>('rr:activeRunState');
  if (!runState) return null;
  return {
    floor: runState.currentFloor,
    segment: runState.currentSegment,
    currency: runState.currency,
    deckSize: runState.deck?.length,
    relics: runState.relics?.map((r: any) => r.id),
    playerHp: runState.playerHp,
    playerMaxHp: runState.playerMaxHp,
    encountersCompleted: runState.encountersCompleted,
  };
}

/** Click the heal option in a rest room. */
async function restHeal(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="rest-heal"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Rest heal button not found' };
    btn.click();
    await wait(turboDelay(1000));
    return { ok: true, message: 'Healed at rest room' };
  });
}

/** Click the upgrade option in a rest room. */
async function restUpgrade(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="rest-upgrade"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Rest upgrade button not found' };
    btn.click();
    await wait(turboDelay(1000));
    return { ok: true, message: 'Upgrading at rest room' };
  });
}

/** Continue past a mystery event. */
async function mysteryContinue(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="mystery-continue"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Mystery continue button not found' };
    btn.click();
    await wait(turboDelay(1000));
    return { ok: true, message: `Mystery resolved. Screen: ${getScreen()}` };
  });
}

/** Get the current shop inventory (relics, cards, prices). */
async function getShopInventory(): Promise<Record<string, unknown> | null> {
  const { activeShopInventory } = await import('../services/gameFlowController');
  const { get } = await import('svelte/store');
  const inventory = get(activeShopInventory);
  if (!inventory) return null;
  return {
    relics: (inventory.relics ?? []).map((item: any, i: number) => {
      const def = RELIC_BY_ID[item.relic?.definitionId];
      return {
        index: i,
        id: item.relic?.definitionId ?? '',
        name: def?.name ?? item.relic?.definitionId ?? '',
        description: def?.description ?? '',
        rarity: def?.rarity ?? 'common',
        price: item.price ?? 0,
        sold: item.sold ?? false,
      };
    }),
    cards: (inventory.cards ?? []).map((item: any, i: number) => {
      const fact = item.card?.factId && factsDB.isReady() ? factsDB.getById(item.card.factId) : null;
      return {
        index: i,
        type: item.card?.cardType ?? '',
        mechanic: item.card?.mechanicId ?? null,
        mechanicName: item.card?.mechanicName ?? null,
        domain: item.card?.domain ?? null,
        factQuestion: fact?.quizQuestion ?? null,
        price: item.price ?? 0,
        sold: item.sold ?? false,
      };
    }),
    removalCost: inventory.removalCost ?? null,
  };
}

/** Buy a relic from the shop by index. */
async function shopBuyRelic(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="shop-relic-${index}"]`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Shop relic button ${index} not found` };
    if (btn.disabled) return { ok: false, message: `Shop relic ${index} is not purchasable (sold or not enough gold)` };
    btn.click();
    await wait(turboDelay(1000));
    return { ok: true, message: `Bought shop relic ${index}. Screen: ${getScreen()}` };
  });
}

/** Buy a card from the shop by index. */
async function shopBuyCard(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="shop-card-${index}"]`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Shop card button ${index} not found` };
    if (btn.disabled) return { ok: false, message: `Shop card ${index} is not purchasable (sold or not enough gold)` };
    btn.click();
    await wait(turboDelay(1000));
    return { ok: true, message: `Bought shop card ${index}. Screen: ${getScreen()}` };
  });
}

/** Click the meditate option in a rest room. */
async function restMeditate(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="rest-meditate"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Rest meditate button not found' };
    if (btn.disabled) return { ok: false, message: 'Meditate is currently disabled' };
    btn.click();
    await wait(turboDelay(1000));
    return { ok: true, message: `Meditating. Screen: ${getScreen()}` };
  });
}

/** Reroll the current card reward options. */
async function rerollReward(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector('[data-testid="reward-reroll"]') as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: 'Reward reroll button not found' };
    if (btn.disabled) return { ok: false, message: 'No rerolls remaining' };
    btn.click();
    await wait(turboDelay(500));
    return { ok: true, message: 'Rerolled card reward' };
  });
}

/** Get mystery event choices from the DOM. */
function getMysteryEventChoices(): Array<{ index: number; text: string }> {
  const choices: Array<{ index: number; text: string }> = [];
  for (let i = 0; i < 5; i++) {
    const btn = document.querySelector(`[data-testid="mystery-choice-${i}"]`) as HTMLElement | null;
    if (!btn) break;
    const style = getComputedStyle(btn);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    choices.push({ index: i, text: btn.textContent?.trim() ?? '' });
  }
  return choices;
}

/** Select a mystery event choice by index. */
async function selectMysteryChoice(index: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="mystery-choice-${index}"]`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Mystery choice ${index} not found` };
    btn.click();
    await wait(turboDelay(1000));
    return { ok: true, message: `Selected mystery choice ${index}. Screen: ${getScreen()}` };
  });
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/** Get the current active quiz data from the store. */
function getQuiz(): { question: string; choices: string[]; correctIndex: number; mode: string } | null {
  const quiz = readStore<any>('rr:activeQuiz');
  if (!quiz) return null;

  return {
    question: quiz.fact?.question ?? quiz.question ?? '',
    choices: Array.isArray(quiz.choices) ? quiz.choices : [],
    correctIndex: typeof quiz.correctIndex === 'number' ? quiz.correctIndex : -1,
    mode: quiz.mode ?? 'unknown',
  };
}

/** Answer a quiz by clicking the DOM button at the given choice index. */
async function answerQuiz(choiceIndex: number): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`[data-testid="quiz-answer-${choiceIndex}"]`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Quiz answer button ${choiceIndex} not found` };
    btn.click();
    await wait(turboDelay(1200));
    return { ok: true, message: `Answered choice ${choiceIndex}` };
  });
}

/** Answer the quiz correctly using the stored correct index. */
async function answerQuizCorrectly(): Promise<PlayResult> {
  const quiz = getQuiz();
  if (!quiz) return { ok: false, message: 'No active quiz' };
  if (quiz.correctIndex < 0) return { ok: false, message: 'Correct index unknown' };
  return answerQuiz(quiz.correctIndex);
}

/** Answer the quiz incorrectly by picking a wrong choice. */
async function answerQuizIncorrectly(): Promise<PlayResult> {
  const quiz = getQuiz();
  if (!quiz) return { ok: false, message: 'No active quiz' };
  if (quiz.correctIndex < 0) return { ok: false, message: 'Correct index unknown' };

  const wrongIndex = quiz.choices.findIndex((_: any, i: number) => i !== quiz.correctIndex);
  if (wrongIndex < 0) return { ok: false, message: 'Could not find wrong answer' };
  return answerQuiz(wrongIndex);
}

/** Force a quiz for a specific fact ID (for deterministic playtest targeting). */
async function forceQuizForFact(factId: string): Promise<PlayResult> {
  return safeAction(async () => {
    const save = getSave();
    if (!save) return { ok: false, message: 'No save data' };

    const fact = save.learnedFacts?.find((f: any) => f.id === factId);
    if (!fact) return { ok: false, message: `Fact '${factId}' not found in learnedFacts` };

    const { getQuizChoices } = await import('../services/quizService');
    const choices = getQuizChoices(fact);
    const correctIndex = choices.indexOf(fact.answer);

    const quiz = {
      fact,
      choices,
      correctIndex,
      mode: 'forced',
      quizType: 'random',
    };

    writeStore('rr:activeQuiz', quiz);
    await wait(turboDelay(300));
    return { ok: true, message: `Forced quiz for fact '${factId}': ${fact.question}`, state: { factId, question: fact.question } };
  });
}

// ---------------------------------------------------------------------------
// Study
// ---------------------------------------------------------------------------

/** Navigate to the study screen and optionally start a session. */
async function startStudy(size?: number): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('rr:currentScreen', 'restStudy');
    await wait(turboDelay(500));

    if (size) {
      const sizeBtn = document.querySelector(`[data-testid="study-size-${size}"]`) as HTMLButtonElement | null;
      if (sizeBtn) {
        sizeBtn.click();
        await wait(turboDelay(500));
      }

      const startBtn = document.querySelector('[data-testid="btn-start-study"]') as HTMLButtonElement | null;
      if (startBtn) {
        startBtn.click();
        await wait(turboDelay(500));
      }
    }

    return { ok: true, message: `Study screen opened${size ? ` (size ${size})` : ''}` };
  });
}

/** Get the current study card from the DOM. */
function getStudyCard(): { question: string; answer: string | null; category: string | null } | null {
  const card = getStudyCardText();
  if (!card) return null;
  return {
    question: card.question,
    answer: card.answer,
    category: card.category,
  };
}

/** Grade a study card by clicking the rating button. */
async function gradeCard(button: 'again' | 'hard' | 'good' | 'easy'): Promise<PlayResult> {
  return safeAction(async () => {
    const btn = document.querySelector(`.rating-btn--${button}`) as HTMLButtonElement | null;
    if (!btn) return { ok: false, message: `Rating button '${button}' not found` };
    btn.click();
    await wait(turboDelay(800));
    return { ok: true, message: `Graded card as '${button}'` };
  });
}

/** End the study session by clicking the return button. */
async function endStudy(): Promise<PlayResult> {
  return safeAction(async () => {
    const btn =
      (document.querySelector('[data-testid="btn-end-study"]') as HTMLButtonElement | null) ??
      (document.querySelector('.return-btn') as HTMLButtonElement | null) ??
      (document.querySelector('.back-link') as HTMLButtonElement | null);
    if (btn) {
      btn.click();
      await wait(turboDelay(500));
    } else {
      writeStore('rr:currentScreen', 'base');
      await wait(turboDelay(300));
    }
    return { ok: true, message: `Study ended. Screen: ${getScreen()}` };
  });
}

/** Get leech and suspended card details for playtest observability. */
function getLeechInfo(): { suspended: any[]; nearLeech: any[]; totalLeeches: number } {
  const save = getSave();
  if (!save) return { suspended: [], nearLeech: [], totalLeeches: 0 };

  const states: any[] = save.reviewStates ?? [];
  const suspended = states.filter((rs: any) => rs.cardState === 'suspended' || rs.isLeech);
  const nearLeech = states.filter((rs: any) => rs.lapseCount >= 6 && rs.cardState !== 'suspended');

  return {
    suspended: suspended.map((rs: any) => ({ factId: rs.factId, lapseCount: rs.lapseCount, ease: rs.easeFactor })),
    nearLeech: nearLeech.map((rs: any) => ({ factId: rs.factId, lapseCount: rs.lapseCount, ease: rs.easeFactor, cardState: rs.cardState })),
    totalLeeches: suspended.length,
  };
}

// ---------------------------------------------------------------------------
// Dome
// ---------------------------------------------------------------------------

/** Enter a specific dome room by navigating to it. */
async function enterRoom(roomId: string): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('rr:currentScreen', roomId);
    await wait(turboDelay(300));
    return { ok: true, message: `Entered room: ${roomId}`, state: { screen: getScreen() } };
  });
}

/** Exit the current room and return to base/dome. */
async function exitRoom(): Promise<PlayResult> {
  return safeAction(async () => {
    writeStore('rr:currentScreen', 'base');
    await wait(turboDelay(300));
    return { ok: true, message: 'Returned to base' };
  });
}

// ---------------------------------------------------------------------------
// Inventory / Economy
// ---------------------------------------------------------------------------

/** Get the current inventory from the store. */
function getInventory(): any[] {
  return readStore<any[]>('rr:inventory') ?? [];
}

/** Get the full player save state. */
function getSave(): any {
  return readStore<any>('rr:playerSave') ?? null;
}

/** Extract key stats from the save. */
function getStats(): Record<string, unknown> {
  const save = getSave();
  if (!save) return {};

  return {
    totalRunsCompleted: save.stats?.totalRunsCompleted ?? 0,
    totalEncountersWon: save.stats?.totalEncountersWon ?? 0,
    totalQuizCorrect: save.stats?.totalQuizCorrect ?? 0,
    totalQuizWrong: save.stats?.totalQuizWrong ?? 0,
    currentStreak: save.stats?.currentStreak ?? 0,
    bestStreak: save.stats?.bestStreak ?? 0,
    learnedFactCount: Array.isArray(save.learnedFacts) ? save.learnedFacts.length : 0,
    currency: save.minerals?.greyMatter ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

/** Manipulate save timestamps to simulate time passing (for SM-2 testing). */
async function fastForward(hours: number): Promise<PlayResult> {
  return safeAction(async () => {
    const sym = Symbol.for('rr:playerSave');
    const store = (globalThis as Record<symbol, unknown>)[sym] as any;
    if (!store?.update) return { ok: false, message: 'playerSave store not found' };

    const msShift = hours * 60 * 60 * 1000;
    store.update((s: any) => {
      if (!s) return s;
      const updated = { ...s };

      // Shift review states' nextReview dates backward (simulating time passing)
      if (Array.isArray(updated.reviewStates)) {
        updated.reviewStates = updated.reviewStates.map((rs: any) => ({
          ...rs,
          nextReview: rs.nextReview ? rs.nextReview - msShift : rs.nextReview,
          lastReview: rs.lastReview ? rs.lastReview - msShift : rs.lastReview,
        }));
      }

      // Shift lastDiveTime backward
      if (updated.lastDiveTime) {
        updated.lastDiveTime -= msShift;
      }

      // Shift lastStreakDate backward
      if (updated.lastStreakDate) {
        updated.lastStreakDate = new Date(
          new Date(updated.lastStreakDate).getTime() - msShift
        ).toISOString().slice(0, 10);
      }

      // Shift study session timestamps backward
      if (Array.isArray(updated.lastStudySessionTimestamps)) {
        updated.lastStudySessionTimestamps = updated.lastStudySessionTimestamps.map(
          (t: number) => t - msShift
        );
      }

      return updated;
    });

    return { ok: true, message: `Fast-forwarded ${hours} hours` };
  });
}

/** Seed a dense review state fixture for 7-day drift testing. */
async function seedDriftFixture(factCount = 30, maxIntervalDays = 3): Promise<PlayResult> {
  return safeAction(async () => {
    const sym = Symbol.for('rr:playerSave');
    const store = (globalThis as Record<symbol, unknown>)[sym] as any;
    if (!store?.update) return { ok: false, message: 'playerSave store not found' };

    store.update((s: any) => {
      if (!s) return s;
      const updated = { ...s };
      const now = Date.now();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      // Ensure we have enough learned facts
      if (!updated.learnedFacts || updated.learnedFacts.length < factCount) {
        return s; // Not enough facts to seed
      }

      // Set first N facts to short intervals with staggered due dates
      const states: any[] = [...(updated.reviewStates ?? [])];
      for (let i = 0; i < Math.min(factCount, updated.learnedFacts.length); i++) {
        const factId = updated.learnedFacts[i].id;
        const existingIdx = states.findIndex((rs: any) => rs.factId === factId);
        const interval = 1 + Math.floor(Math.random() * maxIntervalDays);
        const dueOffset = Math.floor(Math.random() * maxIntervalDays) * MS_PER_DAY;
        const rs = {
          factId,
          cardState: 'review' as const,
          easeFactor: 2.3 + Math.random() * 0.5,
          interval,
          repetitions: 2 + Math.floor(Math.random() * 3),
          nextReviewAt: now + dueOffset,
          lastReviewAt: now - interval * MS_PER_DAY,
          quality: 3,
          learningStep: 0,
          lapseCount: Math.floor(Math.random() * 3),
          isLeech: false,
        };
        if (existingIdx >= 0) {
          states[existingIdx] = rs;
        } else {
          states.push(rs);
        }
      }
      updated.reviewStates = states;
      return updated;
    });

    return { ok: true, message: `Seeded ${factCount} facts with intervals 1-${maxIntervalDays}d for drift testing` };
  });
}

/** Clear localStorage, inject a preset save, and reload. */
async function resetToPreset(presetId: string): Promise<PlayResult> {
  return safeAction(async () => {
    const mod = await import('./presets');
    const preset = mod.SCENARIO_PRESETS.find((p: any) => p.id === presetId);
    if (!preset) {
      const ids = mod.SCENARIO_PRESETS.map((p: any) => p.id);
      return { ok: false, message: `Unknown preset '${presetId}'. Available: ${ids.join(', ')}` };
    }

    const save = preset.buildSave(Date.now());
    localStorage.clear();
    localStorage.setItem('rr_save', JSON.stringify(save));
    localStorage.setItem('rr_onboarding_complete', 'true');
    // Ensure onboarding state marks runs as completed so explorer mode doesn't get stuck
    localStorage.setItem('card:onboardingState', JSON.stringify({
      hasCompletedOnboarding: true,
      hasSeenCardTapTooltip: true,
      hasSeenCastTooltip: true,
      hasSeenAnswerTooltip: true,
      hasSeenEndTurnTooltip: true,
      hasSeenAPTooltip: true,
      runsCompleted: 3,
    }));
    localStorage.setItem('card:difficultyMode', JSON.stringify('standard'));
    localStorage.setItem('tutorial:apShown', 'true');
    localStorage.setItem('tutorial:chargeShown', 'true');
    localStorage.setItem('tutorial:comparisonShown', 'true');

    // Preserve existing URL params (turbo, devpreset, etc.) through reload
    const params = new URLSearchParams(window.location.search);
    params.set('skipOnboarding', 'true');
    window.location.href = `${window.location.origin}?${params.toString()}`;
    return { ok: true, message: `Reset to preset '${presetId}'. Reloading...` };
  });
}

/** Get the last N entries from the __rrLog ring buffer. */
function getRecentEvents(n?: number): Array<{ ts: number; type: string; detail: string }> {
  const log = (window as any).__rrLog as Array<{ ts: number; type: string; detail: string }> | undefined;
  if (!Array.isArray(log)) return [];
  return log.slice(-(n ?? 20));
}

/** Aggregate __rrLog into a summary stats object. */
function getSessionSummary(): Record<string, unknown> {
  const log = (window as any).__rrLog as Array<{ ts: number; type: string; detail: string }> | undefined;
  if (!Array.isArray(log) || log.length === 0) {
    return { eventCount: 0 };
  }

  const typeCounts: Record<string, number> = {};
  for (const entry of log) {
    typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1;
  }

  const first = log[0];
  const last = log[log.length - 1];
  const durationMs = last.ts - first.ts;

  return {
    eventCount: log.length,
    typeCounts,
    durationMs,
    durationMin: Math.round(durationMs / 60_000 * 10) / 10,
    firstEvent: first.type,
    lastEvent: last.type,
  };
}

// ---------------------------------------------------------------------------
// Scenario Spawn System (delegates to __rrScenario)
// ---------------------------------------------------------------------------

/** Spawn into any game state with deep overrides. Delegates to __rrScenario.spawn(). */
async function spawnScenario(config: Record<string, unknown>): Promise<PlayResult> {
  return safeAction(async () => {
    const scenario = (window as any).__rrScenario;
    if (!scenario?.spawn) {
      return { ok: false, message: '__rrScenario not initialized — is the game loaded?' };
    }
    const result = await scenario.spawn(config);
    return { ok: result.ok, message: result.message, state: result.state };
  });
}

/** Mid-session state patching. Delegates to __rrScenario.patch(). */
function patchState(overrides: { turn?: Record<string, unknown>; run?: Record<string, unknown> }): PlayResult {
  const scenario = (window as any).__rrScenario;
  if (!scenario?.patch) {
    return { ok: false, message: '__rrScenario not initialized' };
  }
  return scenario.patch(overrides);
}

/** Capture full state snapshot. Delegates to __rrScenario.snapshot(). */
function snapshotState(label?: string): Record<string, unknown> | PlayResult {
  const scenario = (window as any).__rrScenario;
  if (!scenario?.snapshot) {
    return { ok: false, message: '__rrScenario not initialized' };
  }
  return scenario.snapshot(label);
}

/** Restore from snapshot. Delegates to __rrScenario.restore(). */
function restoreState(snap: Record<string, unknown>): PlayResult {
  const scenario = (window as any).__rrScenario;
  if (!scenario?.restore) {
    return { ok: false, message: '__rrScenario not initialized' };
  }
  return scenario.restore(snap);
}

/** Get schema of all available state fields. Delegates to __rrScenario.schema(). */
function getSchema(): unknown[] | PlayResult {
  const scenario = (window as any).__rrScenario;
  if (!scenario?.schema) {
    return { ok: false, message: '__rrScenario not initialized' };
  }
  return scenario.schema();
}

/** Get a recipe for testing a specific game element. Delegates to __rrScenario.recipes(). */
function getRecipes(id?: string): unknown {
  const scenario = (window as any).__rrScenario;
  if (!scenario?.recipes) {
    return { ok: false, message: '__rrScenario not initialized' };
  }
  return scenario.recipes(id);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** Initialize the playtest API on window.__rrPlay. Dev mode only. */
export function initPlaytestAPI(): void {
  if (!import.meta.env.DEV && !new URLSearchParams(window.location.search).has('playtest')) return;

  const api = {
    // Navigation
    navigate,
    getScreen,
    getAvailableScreens,
    // Card Roguelite — Run
    startRun,
    selectDomain,
    selectArchetype,
    // Card Roguelite — Combat
    getCombatState,
    playCard,
    quickPlayCard,
    chargePlayCard,
    previewCardQuiz,
    endTurn,
    // Card Roguelite — Room & Reward
    selectRoom,
    selectMapNode,
    acceptReward,
    selectRewardType,
    selectRelic,
    getRelicDetails,
    retreat,
    delve,
    getRunState,
    restHeal,
    restUpgrade,
    restMeditate,
    mysteryContinue,
    getShopInventory,
    shopBuyRelic,
    shopBuyCard,
    rerollReward,
    getMysteryEventChoices,
    selectMysteryChoice,
    // Quiz
    getQuiz,
    answerQuiz,
    answerQuizCorrectly,
    answerQuizIncorrectly,
    forceQuizForFact,
    // Study
    startStudy,
    getStudyCard,
    gradeCard,
    endStudy,
    getLeechInfo,
    // Dome (legacy but still functional)
    enterRoom,
    exitRoom,
    // Inventory / Economy
    getInventory,
    getSave,
    getStats,
    // Meta
    fastForward,
    seedDriftFixture,
    resetToPreset,
    getRecentEvents,
    getSessionSummary,
    // Scenario spawn system
    spawn: spawnScenario,
    patch: patchState,
    snapshot: snapshotState,
    restore: restoreState,
    schema: getSchema,
    recipes: getRecipes,
    // Perception (from playtestDescriber)
    look,
    getAllText,
    getQuizText,
    getStudyCardText,
    getHUDText,
    getNotifications,
    validateScreen,
  };

  (window as any).__rrPlay = api;

  // Backward compat — remove after 2026-06-01
  (window as any).__terraPlay = (window as any).__rrPlay;
}
