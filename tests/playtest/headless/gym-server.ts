#!/usr/bin/env npx tsx
/**
 * Gymnasium-compatible JSON server for RL training.
 * Wraps the real game loop (turnManager, cardEffectResolver, etc.) via stdin/stdout JSON lines protocol.
 * Supports the FULL game loop: combat, card rewards, relic rewards, shop, rest, mystery, treasure.
 *
 * Phase state machine:
 *   reset → room_select → [combat → card_reward → (relic_reward) → room_select] → retreat_or_delve → [next floor or done]
 *
 * Protocol: one JSON object per line on stdin → one JSON object per line on stdout.
 * Use console.error for all debug/diagnostic output — stdout is reserved for protocol.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/gym-server.ts
 */

import './browser-shim.js';

import { createDeck, drawHand } from '../../../src/services/deckManager.js';
import { getEnemiesForNode } from '../../../src/data/enemies.js';
import { createEnemy } from '../../../src/services/enemyManager.js';
import {
  startEncounter,
  playCardAction,
  endPlayerTurn,
  checkEncounterEnd,
  type TurnState,
} from '../../../src/services/turnManager.js';
import type { Card, CardType, FactDomain, CardTier, CardRunState } from '../../../src/data/card-types.js';
import type { EnemyTemplate } from '../../../src/data/enemies.js';
import { PLAYER_START_HP, PLAYER_MAX_HP, POST_ENCOUNTER_HEAL_PCT, CHARGE_AP_SURCHARGE } from '../../../src/data/balance.js';
import { getAscensionModifiers } from '../../../src/services/ascension.js';
import { FULL_RELIC_CATALOGUE, RELIC_BY_ID, STARTER_RELIC_IDS } from '../../../src/data/relics/index.js';
import type { RoomOption } from '../../../src/services/floorManager.js';
import {
  resolveEncounterEndCurrency,
  resolveBaseDrawCount,
  resolveFloorAdvanceHeal,
} from '../../../src/services/relicEffectResolver.js';
import readline from 'readline';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type GamePhase =
  | 'combat'
  | 'card_reward'
  | 'relic_reward'
  | 'relic_swap'
  | 'room_select'
  | 'shop'
  | 'rest'
  | 'mystery'
  | 'retreat_or_delve';

interface RunState {
  phase: GamePhase;
  floor: number;
  encounterInFloor: number;
  playerHP: number;
  playerMaxHP: number;
  gold: number;
  relics: string[];
  deckCards: Card[];
  deck: CardRunState;
  ascensionLevel: number;
  correctRate: number;

  // Phase-specific pending data
  turnState: TurnState | null;
  pendingCardRewards: Card[];
  pendingRelicRewards: string[];
  pendingRelicToAcquire: string | null;
  roomOptions: RoomOption[];
  shopRelics: string[];
  shopCards: Card[];
  shopRemovalCost: number;
  restUpgradeCandidates: number[];

  // Economy tracking
  removalCount: number;
  pendingPostShopPhase: GamePhase | null;
}

interface PrevState {
  playerHp: number;
  enemyHp: number;
  consecutiveCorrectThisEncounter: number;
  chainLength: number;
}

interface ActionResult {
  damageDealt: number;
  shieldGained: number;
  chainExtended: boolean;
  chainBroken: boolean;
  wasCorrect: boolean;
  wasCharge: boolean;
}

interface ResetOpts {
  ascensionLevel?: number;
  deckSize?: number;
  correctRate?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Card Factory
// ──────────────────────────────────────────────────────────────────────────────

let _cardIdCounter = 0;

/**
 * Creates a synthetic Card for simulation purposes.
 * No factsDB lookup needed — uses placeholder fact IDs.
 */
function makeSyntheticCard(
  cardType: CardType,
  domain: FactDomain = 'general_knowledge',
  tier: CardTier = '1',
): Card {
  const id = `sim_card_${++_cardIdCounter}`;
  const factId = `sim_fact_${_cardIdCounter}`;
  const baseValues: Record<CardType, number> = {
    attack: 12,
    shield: 10,
    utility: 8,
    buff: 6,
    debuff: 8,
    wild: 10,
  };
  return {
    id,
    factId,
    cardType,
    domain,
    tier,
    baseEffectValue: baseValues[cardType] ?? 10,
    effectMultiplier: 1.0,
    apCost: 1,
    masteryLevel: 0,
  };
}

/**
 * Builds a starting deck for simulation with realistic type distribution.
 * Also assigns chain types cyclically (0-5) to all cards.
 */
function buildSimDeck(deckSize: number): Card[] {
  const distribution: CardType[] = [
    'attack', 'attack', 'attack', 'attack',
    'shield', 'shield', 'shield',
    'utility', 'utility',
    'buff',
  ];
  const cards: Card[] = [];
  for (let i = 0; i < deckSize; i++) {
    const cardType = distribution[i % distribution.length];
    cards.push(makeSyntheticCard(cardType));
  }
  cards.forEach((c, i) => { (c as any).chainType = i % 6; });
  return cards;
}

/**
 * Pick a random enemy template for the given act and node type.
 */
function pickRandomEnemy(
  act: 1 | 2 | 3,
  nodeType: 'combat' | 'elite' | 'mini_boss' | 'boss',
): EnemyTemplate {
  const pool = getEnemiesForNode(act, nodeType);
  if (pool.length === 0) throw new Error(`No enemies for act=${act} nodeType=${nodeType}`);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ──────────────────────────────────────────────────────────────────────────────
// Room Generation (simplified, no Svelte dependency)
// ──────────────────────────────────────────────────────────────────────────────

function generateRoomOptionsSimple(floor: number): RoomOption[] {
  const segment = Math.min(Math.ceil(floor / 3), 4);

  const weights: Record<number, { type: string; weight: number }[]> = {
    1: [{ type: 'combat', weight: 50 }, { type: 'mystery', weight: 20 }, { type: 'rest', weight: 15 }, { type: 'shop', weight: 10 }, { type: 'treasure', weight: 5 }],
    2: [{ type: 'combat', weight: 45 }, { type: 'mystery', weight: 20 }, { type: 'rest', weight: 15 }, { type: 'shop', weight: 15 }, { type: 'treasure', weight: 5 }],
    3: [{ type: 'combat', weight: 40 }, { type: 'mystery', weight: 20 }, { type: 'rest', weight: 15 }, { type: 'shop', weight: 15 }, { type: 'treasure', weight: 10 }],
    4: [{ type: 'combat', weight: 35 }, { type: 'mystery', weight: 25 }, { type: 'rest', weight: 15 }, { type: 'shop', weight: 15 }, { type: 'treasure', weight: 10 }],
  };

  const pool = weights[segment];
  const totalWeight = pool.reduce((s, w) => s + w.weight, 0);

  const options: RoomOption[] = [];
  for (let i = 0; i < 3; i++) {
    let r = Math.random() * totalWeight;
    let type = 'combat';
    for (const w of pool) {
      r -= w.weight;
      if (r <= 0) { type = w.type; break; }
    }
    options.push({ type: type as RoomOption['type'], icon: '', label: type, detail: '', hidden: false });
  }

  // Ensure at least 1 combat room
  if (!options.some(o => o.type === 'combat')) {
    options[0] = { type: 'combat', icon: '', label: 'combat', detail: '', hidden: false };
  }

  return options;
}

// ──────────────────────────────────────────────────────────────────────────────
// Card / Shop / Relic Generators
// ──────────────────────────────────────────────────────────────────────────────

function generateCardRewards(_deckCards: Card[]): Card[] {
  const types: CardType[] = ['attack', 'shield', 'utility', 'buff', 'debuff', 'wild'];
  const rewards: Card[] = [];
  for (let i = 0; i < 3; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const card = makeSyntheticCard(type);
    (card as any).chainType = Math.floor(Math.random() * 6);
    rewards.push(card);
  }
  return rewards;
}

/** All relic IDs from the full catalogue (starters + unlockables). */
const ALL_RELIC_IDS: string[] = FULL_RELIC_CATALOGUE.map(r => r.id);

function generateShop(_floor: number): { relics: string[]; cards: Card[] } {
  const relics = [...ALL_RELIC_IDS].sort(() => Math.random() - 0.5).slice(0, 2);
  const cards = generateCardRewards([]);
  return { relics, cards };
}

/** Relic price by rarity (matches real game balance.ts SHOP_RELIC_PRICE). */
const RELIC_PRICES: Record<string, number> = { common: 100, uncommon: 160, rare: 250, legendary: 400 };

/** Get shop price for a relic by its ID. */
function getRelicPrice(relicId: string): number {
  const def = RELIC_BY_ID[relicId];
  return def ? (RELIC_PRICES[def.rarity] ?? 100) : 100;
}

/** Real game card price (tier 1). */
const CARD_PRICE = 50;

/** Compute removal cost: 50 base + 25 per prior removal in this run. */
function removalCost(removalCount: number): number {
  return 50 + removalCount * 25;
}

/** Simple deterministic hash of a relic ID string to [0, 1]. */
function hashRelicId(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return (sum % 997) / 997;
}


// ──────────────────────────────────────────────────────────────────────────────
// Encounter Initializer
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns the appropriate enemy node type for a given floor and encounter position.
 * Encounter 3 of each floor is always the harder encounter (mini_boss / elite / boss).
 */
function getNodeTypeForEncounter(floor: number, encounterInFloor: number): 'combat' | 'elite' | 'mini_boss' | 'boss' {
  if (encounterInFloor < 3) return 'combat';
  // Third encounter = harder fight based on floor band
  if (floor <= 3) return 'mini_boss';
  if (floor <= 6) return 'elite';
  return 'boss';
}

/**
 * Returns the act number (1-3) for a given floor.
 */
function actForFloor(floor: number): 1 | 2 | 3 {
  if (floor <= 4) return 1;
  if (floor <= 8) return 2;
  return 3;
}

/**
 * Initializes a new combat encounter within the current run state.
 */
function initEncounterFromRun(run: RunState): TurnState {
  const ascMods = getAscensionModifiers(run.ascensionLevel);

  const deck = createDeck(run.deckCards);
  deck.currentFloor = run.floor;
  deck.currentEncounter = run.encounterInFloor - 1;
  deck.playerHP = run.playerHP;
  deck.playerMaxHP = run.playerMaxHP;
  deck.playerShield = 0;

  const act = actForFloor(run.floor);
  const nodeType = getNodeTypeForEncounter(run.floor, run.encounterInFloor);
  const isBossLike = nodeType === 'boss' || nodeType === 'elite';
  const enemyTemplate = pickRandomEnemy(act, nodeType);
  const enemy = createEnemy(enemyTemplate, run.floor, {
    hpMultiplier: ascMods.enemyHpMultiplier * (isBossLike ? ascMods.bossHpMultiplier : 1),
  });

  const ts = startEncounter(deck, enemy, run.playerHP);

  ts.ascensionLevel = ascMods.level;
  ts.ascensionEnemyDamageMultiplier = ascMods.enemyDamageMultiplier;
  ts.ascensionShieldCardMultiplier = ascMods.shieldCardMultiplier;
  ts.ascensionWrongAnswerSelfDamage = ascMods.wrongAnswerSelfDamage;
  // NOTE: ascMods.comboResetsOnTurnEnd (A14) is defined but NOT yet wired into TurnState.
  // The endPlayerTurn() function does not reset consecutiveCorrectThisEncounter on turn end.
  // Removed dead assignment — ts.ascensionComboResetsOnTurnEnd does not exist on TurnState.
  // See docs/gotchas.md 2026-04-11 "A14 comboResetsOnTurnEnd unimplemented in turnManager".
  ts.ascensionBaseTimerPenaltySeconds = ascMods.timerBasePenaltySeconds;
  ts.ascensionEncounterTimerPenaltySeconds = ascMods.encounterTwoTimerPenaltySeconds;
  ts.ascensionPreferCloseDistractors = ascMods.preferCloseDistractors;
  ts.ascensionTier1OptionCount = ascMods.tier1OptionCount;
  ts.ascensionForceHardQuestionFormats = ascMods.forceHardQuestionFormats;
  ts.ascensionPreventFlee = ascMods.preventFlee;

  // Use the run's relic set
  ts.activeRelicIds = new Set(run.relics);

  if (ascMods.firstTurnBonusAp > 0) {
    ts.apCurrent += ascMods.firstTurnBonusAp;
  }
  if (ascMods.encounterStartShield > 0) {
    ts.playerState.shield += ascMods.encounterStartShield;
  }

  return ts;
}

// ──────────────────────────────────────────────────────────────────────────────
// Observation Builder
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Observation vector: 120 floats.
 *
 * Indices 0-79: Combat state (same layout as before).
 *   0-11:  Global combat state (HP, AP, turn, combo, chain, etc.)
 *   12-15: Player status effects
 *   16-18: Enemy status effects
 *   19-20: Enemy intent
 *   21-23: Misc flags (perfect turn, thorns, focus)
 *   24-63: Hand cards (8 slots × 5 features)
 *   64-79: Extra combat features + relic flags (reserved)
 *
 * Indices 80-119: Run-level state (40 floats).
 *   80:    phase encoding
 *   81:    gold (normalized)
 *   82:    floor progress
 *   83:    encounter in floor
 *   84:    deck size
 *   85:    HP% (for non-combat phases)
 *   86-90: relic slot hashes
 *   91:    relic slots used
 *   92-94: room option types
 *   95-106: card reward options (3 x 4 features)
 *   107-115: shop info (2 relic slots + 3 card slots)
 *   116:   removal cost
 *   117:   reserved
 *   118:   reserved
 *   119:   ascension level
 */
function buildCombatObsSlice(ts: TurnState, deckSize: number): number[] {
  const obs: number[] = [];
  const maxHP = ts.playerState.maxHP || PLAYER_MAX_HP;
  const enemyMaxHP = ts.enemy.maxHP || 1;

  obs.push(ts.playerState.hp / maxHP);
  obs.push(Math.min(ts.playerState.shield / maxHP, 1));
  obs.push(ts.enemy.currentHP / enemyMaxHP);
  obs.push(Math.min((ts.enemy.block ?? 0) / (enemyMaxHP * 0.3), 1));
  obs.push(ts.apCurrent / (ts.apMax || 5));
  obs.push(ts.turnNumber / 40);
  obs.push(Math.min((ts.consecutiveCorrectThisEncounter ?? 0) / 10, 1));
  obs.push(Math.min(ts.chainLength / 5, 1));
  obs.push(Math.min((ts.chainMultiplier - 1.0) / 2.0, 1));
  obs.push(ts.isSurge ? 1 : 0);
  obs.push(Math.min((ts.deck.currentFloor ?? 1) / 30, 1));
  obs.push(ts.deck.drawPile.length / Math.max(deckSize, 1));

  const pStatus = ts.playerState.statusEffects || [];
  obs.push(Math.min((pStatus.find(s => s.type === 'poison')?.value ?? 0) / 20, 1));
  obs.push(Math.min((pStatus.find(s => s.type === 'regen')?.value ?? 0) / 20, 1));
  obs.push(Math.min(((pStatus.find(s => s.type === 'strength')?.value ?? 0) + 5) / 10, 1));
  obs.push(Math.min((pStatus.find(s => s.type === 'weakness')?.value ?? 0) / 5, 1));

  const eStatus = ts.enemy.statusEffects || [];
  obs.push(Math.min((eStatus.find(s => s.type === 'poison')?.value ?? 0) / 20, 1));
  obs.push(Math.min(((eStatus.find(s => s.type === 'strength')?.value ?? 0) + 5) / 10, 1));
  obs.push(Math.min((eStatus.find(s => s.type === 'weakness')?.value ?? 0) / 5, 1));

  const intentMap: Record<string, number> = {
    attack: 0.17, multi_attack: 0.33, defend: 0.5, buff: 0.67, debuff: 0.83, heal: 1.0, charge: 0.17,
  };
  obs.push(intentMap[ts.enemy.nextIntent?.type] ?? 0);
  obs.push(Math.min((ts.enemy.nextIntent?.value ?? 0) / maxHP, 1));

  obs.push(ts.isPerfectTurn ? 1 : 0);
  obs.push(ts.thornsActive ? 1 : 0);
  obs.push(Math.min((ts.focusCharges ?? 0) / 5, 1));

  const cardTypeMap: Record<string, number> = {
    attack: 0.17, shield: 0.33, buff: 0.5, debuff: 0.67, utility: 0.83, wild: 1.0,
  };
  const tierMap: Record<string, number> = { '1': 0.25, '2a': 0.5, '2b': 0.75, '3': 1.0 };
  const hand = ts.deck.hand || [];
  for (let i = 0; i < 8; i++) {
    if (i < hand.length) {
      const c = hand[i];
      obs.push(cardTypeMap[c.cardType] ?? 0);
      obs.push(tierMap[c.tier] ?? 0.25);
      obs.push(((c as any).chainType ?? 0) / 5);
      obs.push((c.masteryLevel ?? 0) / 5);
      obs.push(Math.min((c.apCost ?? 1) / 3, 1));
    } else {
      obs.push(0, 0, 0, 0, 0);
    }
  }

  obs.push((ts.chainType ?? 0) / 5);
  obs.push(0);
  obs.push(Math.min((ts.persistentShield ?? 0) / maxHP, 1));
  obs.push(Math.min(ts.cardsPlayedThisTurn / 10, 1));
  const totalAnswers = (ts.cardsCorrectThisTurn ?? 0) +
    ((ts.cardsPlayedThisTurn ?? 0) - (ts.cardsCorrectThisTurn ?? 0));
  obs.push(totalAnswers > 0 ? (ts.cardsCorrectThisTurn ?? 0) / totalAnswers : 0.5);
  obs.push(Math.min((ts.ascensionLevel ?? 0) / 20, 1));
  for (let i = 70; i < 80; i++) obs.push(0);

  while (obs.length < 80) obs.push(0);
  return obs.slice(0, 80);
}

function buildRunObsSlice(run: RunState): number[] {
  const obs = new Array(40).fill(0);

  const phaseMap: Record<GamePhase, number> = {
    combat: 0, card_reward: 0.1, relic_reward: 0.2, relic_swap: 0.25,
    room_select: 0.3, shop: 0.4, rest: 0.5, mystery: 0.6, retreat_or_delve: 0.7,
  };
  obs[0] = phaseMap[run.phase] ?? 0;
  obs[1] = Math.min(run.gold / 500, 1);
  obs[2] = run.floor / 12;
  obs[3] = run.encounterInFloor / 3;
  obs[4] = Math.min(run.deckCards.length / 30, 1);
  obs[5] = run.playerHP / run.playerMaxHP;

  for (let i = 0; i < 5; i++) {
    obs[6 + i] = run.relics[i] ? hashRelicId(run.relics[i]) : 0;
  }
  obs[11] = run.relics.length / 5;

  const roomTypeMap: Record<string, number> = {
    combat: 0.2, elite: 0.4, shop: 0.6, rest: 0.8, mystery: 0.9, treasure: 1.0, boss: 0.3,
  };
  for (let i = 0; i < 3; i++) {
    obs[12 + i] = run.roomOptions[i] ? (roomTypeMap[run.roomOptions[i].type] ?? 0) : 0;
  }

  const cardTypeMap: Record<string, number> = {
    attack: 0.17, shield: 0.33, buff: 0.5, debuff: 0.67, utility: 0.83, wild: 1.0,
  };
  const tierMap: Record<string, number> = { '1': 0.25, '2a': 0.5, '2b': 0.75, '3': 1.0 };
  for (let i = 0; i < 3; i++) {
    const c = run.pendingCardRewards[i];
    if (c) {
      obs[15 + i * 4 + 0] = cardTypeMap[c.cardType] ?? 0;
      obs[15 + i * 4 + 1] = tierMap[c.tier] ?? 0.25;
      obs[15 + i * 4 + 2] = Math.min((c.baseEffectValue ?? 10) / 20, 1);
      obs[15 + i * 4 + 3] = Math.min((c.apCost ?? 1) / 3, 1);
    }
  }

  // Shop card slots (obs[29..31])
  for (let i = 0; i < 3; i++) {
    const c = run.shopCards?.[i];
    obs[29 + i] = c ? (cardTypeMap[c.cardType] ?? 0) : 0;
  }
  obs[32] = Math.min((run.shopRemovalCost ?? 75) / 200, 1);
  obs[33] = 0;
  obs[34] = Math.min((run.ascensionLevel ?? 0) / 20, 1);

  return obs;
}

/**
 * Builds the full 120-float observation vector.
 * Combat slice (0-79): populated from turnState if available, otherwise zeroed except HP.
 * Run slice (80-119): always populated from RunState.
 */
function buildFullObservation(run: RunState): number[] {
  let combatSlice: number[];

  if (run.turnState) {
    combatSlice = buildCombatObsSlice(run.turnState, run.deckCards.length);
  } else {
    // Non-combat phase: zero out combat-specific fields but preserve HP info at index 0
    combatSlice = new Array(80).fill(0);
    combatSlice[0] = run.playerMaxHP > 0 ? run.playerHP / run.playerMaxHP : 0;
    combatSlice[11] = run.deck ? run.deck.drawPile.length / Math.max(run.deckCards.length, 1) : 0;
  }

  const runSlice = buildRunObsSlice(run);
  return [...combatSlice, ...runSlice];
}

// ──────────────────────────────────────────────────────────────────────────────
// Action Mask
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns a 30-element boolean array indicating which actions are valid
 * in the current phase and state. Index layout mirrors the action space:
 *   0-7:   charge card 0-7
 *   8-15:  quick card 0-7
 *   16:    skip turn
 *   17:    hint (disabled)
 *   18-20: pick option 0-2 (room/card reward/relic reward/shop/rest)
 *   21:    skip card reward / leave shop / rest upgrade candidate 2
 *   22:    buy shop card 1
 *   23:    remove card from shop
 *   24-28: swap relic slot 0-4
 *   29:    skip relic reward/swap / skip relic in shop
 */
function getActionMask(run: RunState): boolean[] {
  const mask = new Array(30).fill(false);

  if (run.phase === 'combat' && run.turnState) {
    const ts = run.turnState;
    const hand = ts.deck.hand;
    const ap = ts.apCurrent;

    // Cards 0-7 charge (CHARGE_AP_SURCHARGE = 0: same AP cost as quick play)
    for (let i = 0; i < Math.min(hand.length, 8); i++) {
      const baseCost = hand[i].apCost ?? 1;
      const chargeCost = baseCost + CHARGE_AP_SURCHARGE;
      if (ap >= chargeCost) mask[i] = true;        // charge
      if (ap >= baseCost) mask[i + 8] = true;       // quick
    }
    mask[16] = true; // skip turn is always valid
    // mask[17] = false; // hint — disabled for now

  } else if (run.phase === 'room_select') {
    const n = run.roomOptions.length;
    if (n >= 1) mask[18] = true;
    if (n >= 2) mask[19] = true;
    if (n >= 3) mask[20] = true;

  } else if (run.phase === 'card_reward') {
    const n = run.pendingCardRewards.length;
    if (n >= 1) mask[18] = true;
    if (n >= 2) mask[19] = true;
    if (n >= 3) mask[20] = true;
    mask[21] = true; // skip

  } else if (run.phase === 'relic_reward') {
    const n = run.pendingRelicRewards.length;
    if (n >= 1) mask[18] = true;
    if (n >= 2) mask[19] = true;
    if (n >= 3) mask[20] = true;
    mask[29] = true; // skip relic

  } else if (run.phase === 'relic_swap') {
    for (let i = 0; i < Math.min(run.relics.length, 5); i++) {
      mask[24 + i] = true; // swap slot i
    }
    mask[29] = true; // skip (don't acquire)

  } else if (run.phase === 'shop') {
    // Buy relic 0/1 (common price = 100g)
    if (run.shopRelics.length >= 1 && run.shopRelics[0] && run.gold >= getRelicPrice(run.shopRelics[0] || '')) mask[18] = true;
    if (run.shopRelics.length >= 2 && run.shopRelics[1] && run.gold >= getRelicPrice(run.shopRelics[1] || '')) mask[19] = true;
    // Buy card 0/1 (tier 1 price = 50g)
    if (run.shopCards.length >= 1 && run.shopCards[0] && run.gold >= CARD_PRICE) mask[20] = true;
    if (run.shopCards.length >= 2 && run.shopCards[1] && run.gold >= CARD_PRICE) mask[22] = true;
    // Leaving is the action mapped to 21
    mask[21] = true; // leave shop
    // Remove card (dynamic removal cost)
    if (run.deckCards.length > 5 && run.gold >= run.shopRemovalCost) mask[23] = true;

  } else if (run.phase === 'rest') {
    mask[18] = true; // heal
    // Upgrade candidates
    const n = run.restUpgradeCandidates?.length ?? 0;
    if (n >= 1) mask[19] = true;
    if (n >= 2) mask[20] = true;
    if (n >= 3) mask[21] = true;

  } else if (run.phase === 'retreat_or_delve') {
    mask[18] = true; // retreat
    mask[19] = true; // delve (at max floor, this triggers victory)

  } else if (run.phase === 'mystery') {
    mask[18] = true; // continue
  }

  return mask;
}

// ──────────────────────────────────────────────────────────────────────────────
// Reward Function
// ──────────────────────────────────────────────────────────────────────────────

function calculateCombatReward(
  prevState: PrevState,
  ts: TurnState,
  actionResult: ActionResult,
  done: boolean,
  isSkip: boolean,
): number {
  const maxHP = ts.playerState.maxHP || PLAYER_MAX_HP;
  const enemyMaxHP = ts.enemy.maxHP || 1;
  let reward = 0;

  if (!isSkip) {
    reward += (actionResult.damageDealt / enemyMaxHP) * 2.0;
    reward += (actionResult.shieldGained / maxHP) * 0.5;
    if (actionResult.chainExtended) reward += 0.3;
    if (actionResult.chainBroken) reward -= 0.2;
    if (actionResult.wasCharge) {
      if (actionResult.wasCorrect) reward += 0.1 * (ts.consecutiveCorrectThisEncounter ?? 0);
      else reward -= 0.3;
    }
  }

  if (isSkip) {
    const damageTaken = prevState.playerHp - ts.playerState.hp;
    reward -= (Math.max(0, damageTaken) / maxHP) * 2.0;
  }

  if (done) {
    if (ts.result === 'victory') {
      reward += 3.0; // Reduced from 5.0 — floor completion bonuses supplement this
      reward += (ts.playerState.hp / maxHP) * 2.0;
    } else {
      reward -= 5.0;
    }
  }

  return reward;
}

// ──────────────────────────────────────────────────────────────────────────────
// Run State Machine Helpers
// ──────────────────────────────────────────────────────────────────────────────

const MAX_FLOORS = 4;
const ENCOUNTERS_PER_FLOOR = 3;
const RELIC_DROP_CHANCE_REGULAR = 0.20;

/**
 * Advances to the next encounter, or on floor completion offers an end-of-floor shop
 * before transitioning to retreat_or_delve.
 */
function advanceEncounter(run: RunState): void {
  run.encounterInFloor++;
  if (run.encounterInFloor > ENCOUNTERS_PER_FLOOR) {
    // End-of-floor: offer a shop before the retreat/delve decision
    const shopData = generateShop(run.floor);
    run.shopRelics = shopData.relics;
    run.shopCards = shopData.cards;
    run.shopRemovalCost = removalCost(run.removalCount);
    run.phase = 'shop';
    run.pendingPostShopPhase = 'retreat_or_delve';
  } else {
    run.roomOptions = generateRoomOptionsSimple(run.floor);
    // For encounter 3 always force combat (boss/mini-boss)
    if (run.encounterInFloor === 3) {
      run.roomOptions = [
        { type: 'combat', icon: '', label: 'combat', detail: '', hidden: false },
        { type: 'combat', icon: '', label: 'combat', detail: '', hidden: false },
        { type: 'combat', icon: '', label: 'combat', detail: '', hidden: false },
      ];
    }
    run.phase = 'room_select';
  }
  run.pendingCardRewards = [];
  run.pendingRelicRewards = [];
  run.pendingRelicToAcquire = null;
  run.restUpgradeCandidates = [];
  run.turnState = null;
}

/**
 * After a combat victory, heals the player, adds gold, applies relic effects,
 * generates card rewards.
 *
 * Gold formula mirrors real game: base 10 (regular) or 30 (encounter 3 mini-boss/boss),
 * scaled by floor: round(base * (1 + (floor-1) * 0.15)).
 * Combo bonus: maxCombo * 2 (simplified to 0 here since we don't track maxCombo).
 */
function onCombatVictory(run: RunState): void {
  const healAmount = Math.floor(run.playerMaxHP * POST_ENCOUNTER_HEAL_PCT);
  run.playerHP = Math.min(run.playerMaxHP, run.playerHP + healAmount);

  // Gold reward based on encounter type and floor (matches real game balance.ts)
  const isEncounter3 = run.encounterInFloor === ENCOUNTERS_PER_FLOOR;
  const baseGold = isEncounter3 ? 30 : 10;
  const goldEarned = Math.round(baseGold * (1 + (run.floor - 1) * 0.15));
  run.gold += goldEarned;

  // Apply between-combat relic effects using the real resolver
  const relicIdSet = new Set(run.relics);

  // Encounter-end currency bonus (lucky_coin: +2 gold)
  run.gold += resolveEncounterEndCurrency(relicIdSet);

  // herbal_pouch: heal 8 HP after combat (not exported from resolver — handle manually)
  if (relicIdSet.has('herbal_pouch')) {
    run.playerHP = Math.min(run.playerMaxHP, run.playerHP + 8);
  }

  // Generate 3 card reward options
  run.pendingCardRewards = generateCardRewards(run.deckCards);
  run.phase = 'card_reward';
}

/**
 * After card reward is resolved, roll for relic drop or advance encounter.
 */
function afterCardReward(run: RunState): void {
  const isEncounter3 = run.encounterInFloor === ENCOUNTERS_PER_FLOOR;
  const relicDrop = isEncounter3 || Math.random() < RELIC_DROP_CHANCE_REGULAR;

  if (relicDrop) {
    // Pick 1-3 random relic IDs to offer
    const count = isEncounter3 ? 3 : 1;
    run.pendingRelicRewards = [...ALL_RELIC_IDS]
      .filter(id => !run.relics.includes(id))
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
    run.phase = 'relic_reward';
  } else {
    advanceEncounter(run);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Server State
// ──────────────────────────────────────────────────────────────────────────────

let run: RunState | null = null;
let prevState: PrevState = { playerHp: PLAYER_START_HP, enemyHp: 0, consecutiveCorrectThisEncounter: 0, chainLength: 0 };

// ──────────────────────────────────────────────────────────────────────────────
// Command Handlers
// ──────────────────────────────────────────────────────────────────────────────

/** Handle "reset" command: start a new full run and return the initial observation. */
function handleReset(opts: ResetOpts): object {
  const ascensionLevel = opts.ascensionLevel ?? 0;
  const deckSize = opts.deckSize ?? 15;
  const correctRate = opts.correctRate ?? 0.75;

  const ascMods = getAscensionModifiers(ascensionLevel);
  const effectiveDeckSize = ascMods.starterDeckSizeOverride ?? deckSize;
  const playerMaxHP = ascMods.playerMaxHpOverride ?? PLAYER_MAX_HP;
  const playerHP = PLAYER_START_HP;

  const deckCards = buildSimDeck(effectiveDeckSize);
  const deck = createDeck(deckCards);

  // Starter relics from ascension
  const startingRelics: string[] = [];
  const availableRelics = [...STARTER_RELIC_IDS];
  for (let r = 0; r < ascMods.startingRelicCount && availableRelics.length > 0; r++) {
    const idx = Math.floor(Math.random() * availableRelics.length);
    startingRelics.push(availableRelics[idx]);
    availableRelics.splice(idx, 1);
  }

  run = {
    phase: 'room_select',
    floor: 1,
    encounterInFloor: 1,
    playerHP,
    playerMaxHP,
    gold: 0,
    relics: startingRelics,
    deckCards,
    deck,
    ascensionLevel,
    correctRate,
    turnState: null,
    pendingCardRewards: [],
    pendingRelicRewards: [],
    pendingRelicToAcquire: null,
    roomOptions: generateRoomOptionsSimple(1),
    shopRelics: [],
    shopCards: [],
    shopRemovalCost: 50,
    restUpgradeCandidates: [],
    removalCount: 0,
    pendingPostShopPhase: null,
  };

  // Apply vitality_ring bonus at run start
  if (run.relics.includes('vitality_ring')) {
    run.playerMaxHP += 20;
    run.playerHP = Math.min(run.playerHP + 20, run.playerMaxHP);
  }

  prevState = { playerHp: playerHP, enemyHp: 0, consecutiveCorrectThisEncounter: 0, chainLength: 0 };

  const obs = buildFullObservation(run);
  const actionMask = getActionMask(run);
  return {
    obs,
    actionMask,
    info: {
      phase: run.phase,
      floor: run.floor,
      encounterInFloor: run.encounterInFloor,
      playerHp: run.playerHP,
      gold: run.gold,
      relics: run.relics,
      roomOptions: run.roomOptions.map(r => r.type),
      actionMask,
    },
  };
}

/** Handle "step" command with full phase state machine. */
function handleStep(actionId: number): object {
  if (!run) {
    return { error: 'No active run — call reset first' };
  }

  // Validate action range
  if (actionId < 0 || actionId > 29) {
    const obs = buildFullObservation(run);
    const actionMask = getActionMask(run);
    return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'action_out_of_range', actionMask }, actionMask };
  }

  let reward = 0;
  let done = false;
  const truncated = false;
  const info: Record<string, unknown> = {};

  // ── COMBAT PHASE ──────────────────────────────────────────────────────────
  if (run.phase === 'combat') {
    if (!run.turnState) {
      return { error: 'In combat phase but no turnState — internal error' };
    }

    const ts = run.turnState;

    // Actions 0-15: play card (0-7 CHARGE, 8-15 QUICK)
    // Actions 16-17: skip / hint
    const isSkip = actionId === 16 || actionId === 17;

    // Invalid actions for combat: 18-29 are non-combat actions
    if (actionId >= 18) {
      const obs = buildFullObservation(run);
      const actionMask = getActionMask(run);
      return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'non_combat_action_in_combat_phase', actionMask }, actionMask };
    }

    const snapBefore: PrevState = {
      playerHp: ts.playerState.hp,
      enemyHp: ts.enemy.currentHP,
      consecutiveCorrectThisEncounter: ts.consecutiveCorrectThisEncounter ?? 0,
      chainLength: ts.chainLength,
    };

    if (isSkip) {
      const enemyResult = endPlayerTurn(ts);
      run.turnState = enemyResult.turnState;

      const encResult = checkEncounterEnd(run.turnState);
      if (encResult !== null) {
        if (encResult === 'victory') {
          run.playerHP = run.turnState.playerState.hp;
          info['encounterVictory'] = true;
          onCombatVictory(run);
        } else {
          done = true;
          info['result'] = 'defeat';
          run.playerHP = Math.max(0, run.turnState.playerState.hp);
        }
      }

      const actionResult: ActionResult = {
        damageDealt: 0, shieldGained: 0, chainExtended: false,
        chainBroken: false, wasCorrect: false, wasCharge: false,
      };
      reward = calculateCombatReward(snapBefore, run.turnState, actionResult, done && run.phase === 'combat', true);
      info['damageTaken'] = Math.max(0, snapBefore.playerHp - run.turnState.playerState.hp);
      info['enemyDamage'] = enemyResult.damageDealt;
    } else {
      // 0-7 = CHARGE for card indices 0-7; 8-15 = QUICK for card indices 0-7
      const cardIndex = actionId <= 7 ? actionId : actionId - 8;
      const mode = actionId <= 7 ? 'charge' : 'quick';
      const hand = ts.deck.hand;

      if (cardIndex >= hand.length) {
        const obs = buildFullObservation(run);
        const actionMask = getActionMask(run);
        return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'card_index_out_of_range', actionMask }, actionMask };
      }

      const card = hand[cardIndex];
      const apCost = (card.apCost ?? 1) + (mode === 'charge' && !ts.isSurge ? 1 : 0);
      if (ts.apCurrent < apCost) {
        const obs = buildFullObservation(run);
        const actionMask = getActionMask(run);
        return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'insufficient_ap', actionMask }, actionMask };
      }

      // Mastery-aware correctness: higher mastery = higher correct rate.
      // At base correctRate=0.65: mastery 0→65%, 1→69%, 2→73%, 3→77%, 4→81%, 5→100%.
      const cardMastery = (card as any).masteryLevel ?? 0;
      const masteryBonus = (cardMastery / 5) * (1.0 - run.correctRate) * 0.6;
      const effectiveCorrectRate = Math.min(1.0, run.correctRate + masteryBonus);
      const wasCorrect = cardMastery >= 5 ? true : Math.random() < effectiveCorrectRate;
      const speedBonus = wasCorrect && Math.random() < 0.5;
      const chainLengthBefore = ts.chainLength;
      const shieldBefore = ts.playerState.shield;

      const playResult = playCardAction(ts, card.id, wasCorrect, speedBonus, mode as 'charge' | 'quick');
      run.turnState = playResult.turnState;

      // Update card mastery based on charge play outcome
      if (mode === 'charge') {
        const masteryBefore = (card as any).masteryLevel ?? 0;
        if (wasCorrect && masteryBefore < 5) {
          (card as any).masteryLevel = masteryBefore + 1;
        } else if (!wasCorrect && masteryBefore > 0) {
          (card as any).masteryLevel = masteryBefore - 1;
        }
      }

      const damageDealt = playResult.effect.damageDealt;
      const shieldGained = Math.max(0, run.turnState.playerState.shield - shieldBefore);
      const chainExtended = run.turnState.chainLength > chainLengthBefore;
      const chainBroken = !wasCorrect && chainLengthBefore > 0 && run.turnState.chainLength === 0;

      const actionResult: ActionResult = {
        damageDealt, shieldGained, chainExtended, chainBroken,
        wasCorrect, wasCharge: mode === 'charge',
      };

      const encResult = checkEncounterEnd(run.turnState);
      if (encResult !== null) {
        if (encResult === 'victory') {
          run.playerHP = run.turnState.playerState.hp;
          info['encounterVictory'] = true;
          onCombatVictory(run);
        } else {
          done = true;
          info['result'] = 'defeat';
          run.playerHP = Math.max(0, run.turnState.playerState.hp);
        }
      }

      reward = calculateCombatReward(snapBefore, run.turnState, actionResult, done && run.phase === 'combat', false);
      info['damageDealt'] = damageDealt;
      info['shieldGained'] = shieldGained;
      info['wasCorrect'] = wasCorrect;
      info['wasCharge'] = mode === 'charge';
      info['chainExtended'] = chainExtended;
      info['chainBroken'] = chainBroken;
    }

    if (run.turnState) {
      prevState = {
        playerHp: run.turnState.playerState.hp,
        enemyHp: run.turnState.enemy.currentHP,
        consecutiveCorrectThisEncounter: run.turnState.consecutiveCorrectThisEncounter ?? 0,
        chainLength: run.turnState.chainLength,
      };
      info['playerHp'] = run.turnState.playerState.hp;
      info['enemyHp'] = run.turnState.enemy.currentHP;
      info['consecutiveCorrectThisEncounter'] = run.turnState.consecutiveCorrectThisEncounter ?? 0;
      info['chainLength'] = run.turnState.chainLength;
    }
  }

  // ── CARD REWARD PHASE ─────────────────────────────────────────────────────
  else if (run.phase === 'card_reward') {
    // 18=pick 0, 19=pick 1, 20=pick 2, 21=skip
    if (actionId < 18 || actionId > 21) {
      const obs = buildFullObservation(run);
      const actionMask = getActionMask(run);
      return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'invalid_action_for_card_reward', actionMask }, actionMask };
    }

    if (actionId === 21) {
      // Skip reward
      reward = 0;
      info['cardReward'] = 'skipped';
    } else {
      const pickIdx = actionId - 18;
      const picked = run.pendingCardRewards[pickIdx];
      if (picked) {
        run.deckCards.push(picked);
        reward = 0.2;
        info['cardReward'] = picked.cardType;
      } else {
        // No card at that index — treat as skip
        reward = 0;
        info['cardReward'] = 'empty_slot';
      }
    }

    afterCardReward(run);
  }

  // ── RELIC REWARD PHASE ────────────────────────────────────────────────────
  else if (run.phase === 'relic_reward') {
    // 18=pick 0, 19=pick 1, 20=pick 2, 29=skip
    const validActions = new Set([18, 19, 20, 29]);
    if (!validActions.has(actionId)) {
      const obs = buildFullObservation(run);
      const actionMask = getActionMask(run);
      return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'invalid_action_for_relic_reward', actionMask }, actionMask };
    }

    if (actionId === 29) {
      reward = 0;
      info['relicReward'] = 'skipped';
      advanceEncounter(run);
    } else {
      const pickIdx = actionId - 18;
      const pickedId = run.pendingRelicRewards[pickIdx];
      if (pickedId) {
        if (run.relics.length < 5) {
          run.relics.push(pickedId);
          reward = 0.5;
          info['relicReward'] = pickedId;
          advanceEncounter(run);
        } else {
          // Full relic slots — go to swap phase
          run.pendingRelicToAcquire = pickedId;
          run.phase = 'relic_swap';
          reward = 0;
          info['relicReward'] = 'swap_required';
        }
      } else {
        reward = 0;
        info['relicReward'] = 'empty_slot';
        advanceEncounter(run);
      }
    }
  }

  // ── RELIC SWAP PHASE ──────────────────────────────────────────────────────
  else if (run.phase === 'relic_swap') {
    // 24-28=swap slot 0-4, 29=skip
    if (actionId === 29) {
      reward = 0;
      info['relicSwap'] = 'skipped';
      run.pendingRelicToAcquire = null;
      advanceEncounter(run);
    } else if (actionId >= 24 && actionId <= 28) {
      const slotIdx = actionId - 24;
      if (slotIdx < run.relics.length && run.pendingRelicToAcquire) {
        const dropped = run.relics[slotIdx];
        run.relics[slotIdx] = run.pendingRelicToAcquire;
        reward = 0.3;
        info['relicSwap'] = { replaced: dropped, acquired: run.pendingRelicToAcquire };
      } else {
        reward = -0.1;
        info['invalid'] = 'swap_slot_out_of_range';
      }
      run.pendingRelicToAcquire = null;
      advanceEncounter(run);
    } else {
      const obs = buildFullObservation(run);
      const actionMask = getActionMask(run);
      return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'invalid_action_for_relic_swap', actionMask }, actionMask };
    }
  }

  // ── ROOM SELECT PHASE ─────────────────────────────────────────────────────
  else if (run.phase === 'room_select') {
    if (actionId < 18 || actionId > 20) {
      const obs = buildFullObservation(run);
      const actionMask = getActionMask(run);
      return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'invalid_action_for_room_select', actionMask }, actionMask };
    }

    const roomIdx = actionId - 18;
    const room = run.roomOptions[roomIdx] ?? run.roomOptions[0];
    info['roomChosen'] = room.type;
    info['roomType'] = room.type;

    switch (room.type) {
      case 'combat': {
        run.turnState = initEncounterFromRun(run);
        run.phase = 'combat';

        // Apply draw count from relics (swift_boots/blood_price)
        const relicIdSetCombat = new Set(run.relics);
        const drawCount = resolveBaseDrawCount(relicIdSetCombat);
        if (drawCount !== 5 && run.turnState) {
          run.turnState.baseDrawCount = drawCount;
        }

        // Note: combo_ring relic no longer exists (consecutiveCorrectThisEncounter replaces
        // the old comboCount field — reset to 0 at encounter start by turnManager.startEncounter)

        info['enemy'] = run.turnState.enemy.template.id;
        info['enemyName'] = run.turnState.enemy.template.name;
        info['enemyHp'] = run.turnState.enemy.currentHP;
        reward = 0;
        break;
      }

      case 'shop': {
        const shopData = generateShop(run.floor);
        run.shopRelics = shopData.relics;
        run.shopCards = shopData.cards;
        run.shopRemovalCost = removalCost(run.removalCount);
        run.pendingPostShopPhase = null;
        run.phase = 'shop';
        reward = 0;
        break;
      }

      case 'rest': {
        // Find candidates: non-upgraded cards in deck by index
        run.restUpgradeCandidates = run.deckCards
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.isUpgraded)
          .map(({ i }) => i)
          .slice(0, 3);
        run.phase = 'rest';
        reward = 0;
        break;
      }

      case 'mystery': {
        // Auto-resolve a random mystery event
        const outcomes = [
          () => { run!.playerHP = Math.min(run!.playerMaxHP, run!.playerHP + Math.floor(run!.playerMaxHP * 0.15)); reward = 0.1; info['mystery'] = 'heal'; },
          () => { run!.playerHP = Math.max(1, run!.playerHP - Math.floor(run!.playerMaxHP * 0.10)); reward = -0.1; info['mystery'] = 'damage'; },
          () => { run!.gold += 25 + run!.floor * 5; reward = 0.1; info['mystery'] = 'gold'; },
          () => {
            const card = makeSyntheticCard('attack');
            (card as any).chainType = Math.floor(Math.random() * 6);
            run!.deckCards.push(card);
            reward = 0.1;
            info['mystery'] = 'free_card';
          },
          () => { reward = 0; info['mystery'] = 'nothing'; },
        ];
        const pick = Math.floor(Math.random() * outcomes.length);
        outcomes[pick]();
        advanceEncounter(run);
        break;
      }

      case 'treasure': {
        // Gold + 30% chance of a relic
        run.gold += 40 + run.floor * 5;
        reward = 0.1;
        info['treasure'] = 'gold';
        const relicRoll = Math.random();
        if (relicRoll < 0.30) {
          const available = ALL_RELIC_IDS.filter(id => !run!.relics.includes(id));
          if (available.length > 0) {
            const relicId = available[Math.floor(Math.random() * available.length)];
            if (run.relics.length < 5) {
              run.relics.push(relicId);
              reward += 0.5;
              info['treasureRelic'] = relicId;
            } else {
              run.pendingRelicToAcquire = relicId;
              run.pendingRelicRewards = [relicId];
              advanceEncounter(run);
              // Override phase to relic_swap since slots are full
              run.phase = 'relic_swap';
              const obs = buildFullObservation(run);
              const actionMask = getActionMask(run);
              info['actionMask'] = actionMask;
              return { obs, reward, done: false, truncated, info, actionMask };
            }
          }
        }
        advanceEncounter(run);
        break;
      }

      default: {
        // Unknown room type — treat as combat
        run.turnState = initEncounterFromRun(run);
        run.phase = 'combat';

        // Apply draw count from relics (swift_boots/blood_price)
        const relicIdSetDefault = new Set(run.relics);
        const drawCountDefault = resolveBaseDrawCount(relicIdSetDefault);
        if (drawCountDefault !== 5 && run.turnState) {
          run.turnState.baseDrawCount = drawCountDefault;
        }

        // Note: combo_ring relic no longer exists (consecutiveCorrectThisEncounter replaces
        // the old comboCount field — reset to 0 at encounter start by turnManager.startEncounter)

        reward = 0;
        break;
      }
    }
  }

  // ── SHOP PHASE ────────────────────────────────────────────────────────────
  else if (run.phase === 'shop') {
    // 18=buy relic 0, 19=buy relic 1, 20=buy card 0, 21=leave, 22=buy card 1, 23=remove card

    switch (actionId) {
      case 18: {
        const relicId = run.shopRelics[0];
        const price0 = getRelicPrice(relicId || '');
        if (relicId && run.gold >= price0) {
          if (run.relics.length < 5) {
            run.relics.push(relicId);
            run.gold -= price0;
            run.shopRelics[0] = '';
            reward = 0.3;
            info['shopBought'] = `relic:${relicId}`;
          } else {
            reward = -0.1;
            info['invalid'] = 'relic_slots_full';
          }
        } else {
          reward = -0.1;
          info['invalid'] = relicId ? 'insufficient_gold' : 'empty_slot';
        }
        break;
      }
      case 19: {
        const relicId = run.shopRelics[1];
        const price1 = getRelicPrice(relicId || '');
        if (relicId && run.gold >= price1) {
          if (run.relics.length < 5) {
            run.relics.push(relicId);
            run.gold -= price1;
            run.shopRelics[1] = '';
            reward = 0.3;
            info['shopBought'] = `relic:${relicId}`;
          } else {
            reward = -0.1;
            info['invalid'] = 'relic_slots_full';
          }
        } else {
          reward = -0.1;
          info['invalid'] = relicId ? 'insufficient_gold' : 'empty_slot';
        }
        break;
      }
      case 20: {
        const card = run.shopCards[0];
        if (card && run.gold >= CARD_PRICE) {
          run.deckCards.push(card);
          run.gold -= CARD_PRICE;
          run.shopCards[0] = null as any;
          reward = 0.1;
          info['shopBought'] = `card:${card.cardType}`;
        } else {
          reward = -0.1;
          info['invalid'] = card ? 'insufficient_gold' : 'empty_slot';
        }
        break;
      }
      case 21: {
        // Leave shop — check if we have a pending post-shop phase (e.g. end-of-floor retreat/delve)
        reward = 0;
        info['shop'] = 'left';
        if (run.pendingPostShopPhase !== null) {
          run.phase = run.pendingPostShopPhase;
          run.pendingPostShopPhase = null;
          run.shopCards = [];
          run.shopRelics = [];
        } else {
          advanceEncounter(run);
        }
        break;
      }
      case 22: {
        const card = run.shopCards[1];
        if (card && run.gold >= CARD_PRICE) {
          run.deckCards.push(card);
          run.gold -= CARD_PRICE;
          run.shopCards[1] = null as any;
          reward = 0.1;
          info['shopBought'] = `card:${card.cardType}`;
        } else {
          reward = -0.1;
          info['invalid'] = card ? 'insufficient_gold' : 'empty_slot';
        }
        break;
      }
      case 23: {
        // Remove worst card (first 'debuff' found, or last card — simplified heuristic)
        if (run.gold >= run.shopRemovalCost && run.deckCards.length > 5) {
          const removeIdx = run.deckCards.findIndex(c => c.cardType === 'debuff');
          const idx = removeIdx >= 0 ? removeIdx : run.deckCards.length - 1;
          run.deckCards.splice(idx, 1);
          run.gold -= run.shopRemovalCost;
          run.removalCount++;
          // Update removal cost for next potential removal this shop visit
          run.shopRemovalCost = removalCost(run.removalCount);
          reward = 0.1;
          info['shopRemoved'] = true;
        } else {
          reward = -0.1;
          info['invalid'] = run.gold < run.shopRemovalCost ? 'insufficient_gold' : 'deck_too_small';
        }
        break;
      }
      default: {
        const obs = buildFullObservation(run);
        const actionMask = getActionMask(run);
        return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'invalid_action_for_shop', actionMask }, actionMask };
      }
    }
  }

  // ── REST PHASE ────────────────────────────────────────────────────────────
  else if (run.phase === 'rest') {
    // 18=heal, 19=upgrade candidate 0, 20=upgrade candidate 1, 21=upgrade candidate 2
    if (actionId < 18 || actionId > 21) {
      const obs = buildFullObservation(run);
      const actionMask = getActionMask(run);
      return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'invalid_action_for_rest', actionMask }, actionMask };
    }

    if (actionId === 18) {
      const healed = Math.floor(run.playerMaxHP * 0.30);
      const before = run.playerHP;
      run.playerHP = Math.min(run.playerMaxHP, run.playerHP + healed);
      reward = 0.2 * ((run.playerHP - before) / run.playerMaxHP);
      info['rest'] = 'healed';
      info['healedAmount'] = run.playerHP - before;
    } else {
      const candidateIdx = actionId - 19; // 0-2
      const cardIdx = run.restUpgradeCandidates[candidateIdx];
      if (cardIdx !== undefined && run.deckCards[cardIdx]) {
        const card = run.deckCards[cardIdx];
        card.baseEffectValue = (card.baseEffectValue ?? 10) + 3;
        card.isUpgraded = true;
        reward = 0.3;
        info['rest'] = `upgraded:${card.cardType}`;
      } else {
        // No candidate — fall back to heal
        const healed = Math.floor(run.playerMaxHP * 0.30);
        const before = run.playerHP;
        run.playerHP = Math.min(run.playerMaxHP, run.playerHP + healed);
        reward = 0.2 * ((run.playerHP - before) / run.playerMaxHP);
        info['rest'] = 'fallback_heal';
      }
    }

    advanceEncounter(run);
  }

  // ── RETREAT OR DELVE PHASE ────────────────────────────────────────────────
  else if (run.phase === 'retreat_or_delve') {
    if (actionId === 18) {
      // Retreat — end run, reward for floors cleared
      reward = 1.0 * run.floor;
      done = true;
      // At max floor, retreat = victory (completed all floors)
      if (run.floor >= MAX_FLOORS) {
        info['result'] = 'victory';
        info['runEnd'] = 'max_floors_cleared';
      } else {
        info['result'] = 'retreat';
        info['runEnd'] = 'retreat';
      }
      info['floorsCleared'] = run.floor;
    } else if (actionId === 19) {
      // Delve deeper
      if (run.floor >= MAX_FLOORS) {
        // Already at max floor — run is complete (victory)
        reward = 1.0 * run.floor + 3.0;
        done = true;
        info['result'] = 'victory';
        info['runEnd'] = 'max_floors_cleared';
        info['floorsCleared'] = run.floor;
      } else {
        run.floor++;
        run.encounterInFloor = 1;
        run.roomOptions = generateRoomOptionsSimple(run.floor);
        run.phase = 'room_select';
        reward = 0.1;
        info['delve'] = run.floor;

        // Apply floor advance heal from relics (renewal_spring)
        const relicIdSetDelve = new Set(run.relics);
        const floorHeal = resolveFloorAdvanceHeal(relicIdSetDelve, run.playerMaxHP, run.playerHP / run.playerMaxHP);
        if (floorHeal.healHp > 0) {
          run.playerHP = Math.min(run.playerMaxHP, run.playerHP + floorHeal.healHp);
          info['floorAdvanceHeal'] = floorHeal.healHp;
        }
      }
    } else {
      const obs = buildFullObservation(run);
      const actionMask = getActionMask(run);
      return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: 'invalid_action_for_retreat_or_delve', actionMask }, actionMask };
    }
  }

  else {
    const obs = buildFullObservation(run);
    const actionMask = getActionMask(run);
    return { obs, reward: -0.1, done: false, truncated: false, info: { invalid: `unknown_phase:${run.phase}`, actionMask }, actionMask };
  }

  // ── Finalize response ─────────────────────────────────────────────────────

  if (done) {
    info['finalPlayerHp'] = run.playerHP;
    info['finalGold'] = run.gold;
    info['floorsCleared'] = run.floor;
    info['relicsAcquired'] = run.relics.length;
    info['deckSize'] = run.deckCards.length;
  }

  info['phase'] = run.phase;
  info['floor'] = run.floor;
  info['encounterInFloor'] = run.encounterInFloor;
  info['gold'] = run.gold;
  info['playerHp'] = run.playerHP;
  if (run.turnState) {
    info['enemyId'] = run.turnState.enemy.template.id;
    info['enemyName'] = run.turnState.enemy.template.name;
  }

  const obs = buildFullObservation(run);
  const actionMask = getActionMask(run);
  info['actionMask'] = actionMask;
  return { obs, reward, done, truncated, info, actionMask };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main readline loop
// ──────────────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: undefined,
  terminal: false,
});

function respond(obj: object): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let parsed: {
    cmd: string;
    opts?: ResetOpts;
    action?: number;
  };
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    respond({ error: `JSON parse error: ${(e as Error).message}` });
    return;
  }

  try {
    switch (parsed.cmd) {
      case 'reset':
        respond(handleReset(parsed.opts ?? {}));
        break;

      case 'step':
        if (parsed.action === undefined || typeof parsed.action !== 'number') {
          respond({ error: 'step command requires an "action" field (integer 0-29)' });
          break;
        }
        respond(handleStep(parsed.action));
        break;

      case 'close':
        console.error('[gym-server] Received close command. Exiting.');
        process.exit(0);
        break;

      default:
        respond({ error: `Unknown command: ${parsed.cmd}` });
    }
  } catch (e) {
    console.error('[gym-server] Error handling command:', e);
    respond({ error: `Internal error: ${(e as Error).message}` });
  }
});

rl.on('close', () => {
  console.error('[gym-server] stdin closed. Exiting.');
  process.exit(0);
});

console.error('[gym-server] Ready (full game loop). Waiting for commands on stdin...');
