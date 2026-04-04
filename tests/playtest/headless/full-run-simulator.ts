/**
 * Full Run Simulator
 * ==================
 * Simulates complete Recall Rogue runs including map progression, card rewards,
 * relics, shops, rest sites, mystery events, gold economy, and act transitions.
 *
 * Uses REAL game code (mapGenerator, floorManager, shopService, relics) — no reimplementation.
 * Combat is delegated to the existing simulateSingleEncounter logic via simulator.ts.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
 *           tests/playtest/headless/run-batch.ts --runs 100 --profile scholar
 */

import './browser-shim.js';

import { createDeck } from '../../../src/services/deckManager.js';
import { getEnemiesForNode } from '../../../src/data/enemies.js';
import { createEnemy } from '../../../src/services/enemyManager.js';
import {
  startEncounter,
  playCardAction,
  endPlayerTurn,
  checkEncounterEnd,
  isHandEmpty,
  type TurnState,
} from '../../../src/services/turnManager.js';
import type { Card, CardType, FactDomain, CardTier } from '../../../src/data/card-types.js';
import type { EnemyTemplate } from '../../../src/data/enemies.js';
import { selectRunChainTypes } from '../../../src/data/chainTypes.js';
import { BotBrain, type BotSkills } from './bot-brain.js';
import {
  PLAYER_START_HP,
  PLAYER_MAX_HP,
  ENABLE_PHASE2_MECHANICS,
  STARTER_DECK_COMPOSITION,
  SHOP_CARD_PRICE_V2,
  SHOP_RELIC_PRICE,
  SHOP_REMOVAL_BASE_PRICE,
  SHOP_REMOVAL_PRICE_INCREMENT,
  SHOP_FOOD_ITEMS,
  CHARGE_AP_SURCHARGE,
  SURGE_FIRST_TURN,
  SURGE_INTERVAL,
  REST_SITE_HEAL_PCT,
} from '../../../src/data/balance.js';
import { MECHANIC_DEFINITIONS, type MechanicDefinition } from '../../../src/data/mechanics.js';
import { getAscensionModifiers } from '../../../src/services/ascension.js';
import {
  STARTER_RELIC_IDS,
  FULL_RELIC_CATALOGUE,
  RELIC_BY_ID,
} from '../../../src/data/relics/index.js';
import {
  generateActMap,
  selectMapNode,
  getAvailableNodes,
  deriveFloorFromNode,
  type ActMap,
  type MapNode,
  type MapNodeType,
} from '../../../src/services/mapGenerator.js';
import { generateMysteryEvent } from '../../../src/services/floorManager.js';

// Re-export types used by run-batch.ts so it can import from one place
export type { CardPlayRecord, EncounterSummary } from './simulator.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface FullRunOptions {
  /** Probability of answering correctly (0-1). Default: 0.75 */
  correctRate?: number;
  /** Probability of using Charge (vs Quick Play). Default: 0.7 */
  chargeRate?: number;
  /** Seed for map generation. Default: random */
  seed?: number;
  /** Max turns per encounter before giving up (defeat). Default: 50 */
  maxTurnsPerEncounter?: number;
  /** Verbose logging. Default: false */
  verbose?: boolean;
  /** Ascension level (0-20). Default: 0 */
  ascensionLevel?: number;
  /** Number of acts to simulate (1-3). Default: 3 */
  acts?: 1 | 2 | 3;
  /** Bot skill profile. If provided, overrides correctRate/chargeRate for BotBrain-driven play. */
  botSkills?: BotSkills;
  /** Force specific relics at run start (for causal relic testing). These are added IN ADDITION to normal starter relics. */
  forceRelics?: string[];
}

export interface NodeVisitRecord {
  nodeType: MapNodeType;
  act: number;
  floor: number;
  result?: 'victory' | 'defeat' | 'timeout' | 'skipped';
  goldChange?: number;
  hpChange?: number;
  deckSizeChange?: number;
}

export interface FullRunResult {
  runId: string;
  options: Required<Omit<FullRunOptions, 'botSkills' | 'forceRelics'>> & { botSkills?: BotSkills; forceRelics?: string[] };
  survived: boolean;
  actsCompleted: number;
  finalHP: number;
  finalDeckSize: number;
  goldEarned: number;
  goldSpent: number;
  goldFinal: number;
  relicsAcquired: string[];
  roomsVisited: Record<MapNodeType, number>;
  nodeVisits: NodeVisitRecord[];
  // Combat aggregates
  totalEncounters: number;
  encountersWon: number;
  totalTurns: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalCardsPlayed: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  maxComboSeen: number;
  // Economy
  cardsAddedToRun: number;
  cardsRemovedFromRun: number;
  durationMs: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Run State
// ──────────────────────────────────────────────────────────────────────────────

interface SimRunState {
  deck: Card[];
  relicIds: Set<string>;
  gold: number;
  hp: number;
  maxHp: number;
  cardRemovalCount: number;
  // Counters for output
  goldEarned: number;
  goldSpent: number;
  cardsAdded: number;
  cardsRemoved: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Card Factory (mirrors simulator.ts)
// ──────────────────────────────────────────────────────────────────────────────

let _cardIdCounter = 0;

function getActiveMechanics(): MechanicDefinition[] {
  if (ENABLE_PHASE2_MECHANICS) return MECHANIC_DEFINITIONS;
  return MECHANIC_DEFINITIONS.filter(m => m.launchPhase === 1);
}

function makeMechanicCard(
  mechanic: MechanicDefinition,
  _domain: FactDomain = 'general_knowledge',
  tier: CardTier = '1',
): Card {
  const id = `sim_card_${++_cardIdCounter}`;
  const factId = `sim_fact_${_cardIdCounter}`;
  return {
    id,
    factId,
    cardType: mechanic.type,
    domain: _domain,
    tier,
    baseEffectValue: mechanic.baseValue,
    effectMultiplier: 1.0,
    apCost: mechanic.apCost,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    originalBaseEffectValue: mechanic.baseValue,
    masteryLevel: 0,  // enables mastery tracking via playCardAction/masteryUpgrade
  };
}

function findMechanic(id: string): MechanicDefinition {
  const m = MECHANIC_DEFINITIONS.find(m => m.id === id);
  if (!m) throw new Error(`[FullRunSim] Mechanic '${id}' not found`);
  return m;
}

function pickRandomMechanic(): MechanicDefinition {
  const typePool: CardType[] = [
    'attack', 'attack', 'attack', 'attack',
    'shield', 'shield', 'shield',
    'utility', 'utility',
    'buff',
  ];
  const type = typePool[Math.floor(Math.random() * typePool.length)];
  const activeMechanics = getActiveMechanics();
  const pool = activeMechanics.filter(m => m.type === type);
  if (pool.length === 0) return findMechanic('strike');

  const BASIC_MECHANICS: Partial<Record<CardType, string>> = {
    attack: 'strike',
    shield: 'block',
  };
  const basicId = BASIC_MECHANICS[type];
  if (basicId && Math.random() < 0.6) {
    const basic = pool.find(m => m.id === basicId);
    if (basic) return basic;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildStarterDeck(seed: number = 0): Card[] {
  const cards: Card[] = [];
  for (const entry of STARTER_DECK_COMPOSITION) {
    const mechanic = findMechanic(entry.mechanicId);
    for (let i = 0; i < entry.count; i++) {
      cards.push(makeMechanicCard(mechanic));
    }
  }
  // Assign chain types round-robin from the 3 types selected for this run
  const runChainTypes = selectRunChainTypes(seed);
  for (let i = 0; i < cards.length; i++) {
    cards[i].chainType = runChainTypes[i % runChainTypes.length];
  }
  return cards;
}

// ──────────────────────────────────────────────────────────────────────────────
// Card Reward Logic — simple bot heuristic
// ──────────────────────────────────────────────────────────────────────────────

const MAX_DECK_SIZE = 20;

/**
 * Picks the best card from 3 random options by balancing deck type distribution.
 * Returns null if deck is already at max size.
 */
function pickCardReward(currentDeck: Card[]): Card | null {
  if (currentDeck.length >= MAX_DECK_SIZE) return null;

  // Generate 3 random options
  const options: MechanicDefinition[] = [
    pickRandomMechanic(),
    pickRandomMechanic(),
    pickRandomMechanic(),
  ];

  // Count current type distribution
  const typeCounts: Partial<Record<CardType, number>> = {};
  for (const card of currentDeck) {
    typeCounts[card.cardType] = (typeCounts[card.cardType] ?? 0) + 1;
  }

  // Pick the type with lowest representation in deck
  let bestOption = options[0];
  let lowestCount = Infinity;
  for (const opt of options) {
    const count = typeCounts[opt.type] ?? 0;
    if (count < lowestCount) {
      lowestCount = count;
      bestOption = opt;
    }
  }

  return makeMechanicCard(bestOption);
}

// ──────────────────────────────────────────────────────────────────────────────
// Enemy Picker
// ──────────────────────────────────────────────────────────────────────────────

function pickEnemyForNode(
  act: 1 | 2 | 3,
  nodeType: 'combat' | 'elite' | 'mini_boss' | 'boss',
): EnemyTemplate {
  const pool = getEnemiesForNode(act, nodeType);
  if (pool.length === 0) throw new Error(`No enemies for act=${act} nodeType=${nodeType}`);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ──────────────────────────────────────────────────────────────────────────────
// Single Encounter (inlined from simulator.ts to avoid circular import issues)
// ──────────────────────────────────────────────────────────────────────────────

interface EncounterResult {
  result: 'victory' | 'defeat' | 'timeout';
  turnsUsed: number;
  damageDealt: number;
  damageTaken: number;
  cardsPlayed: number;
  correctAnswers: number;
  wrongAnswers: number;
  maxCombo: number;
}

function simulateSingleEncounter(
  turnState: TurnState,
  opts: {
    correctRate: number;
    chargeRate: number;
    maxTurns: number;
    /** Optional BotBrain for intelligent play. When absent, uses legacy dumb-bot logic. */
    brain?: BotBrain;
  },
  ascMods: ReturnType<typeof getAscensionModifiers>,
): EncounterResult {
  let turnsUsed = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let cardsPlayed = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let maxCombo = 0;

  const { correctRate, chargeRate, maxTurns, brain } = opts;

  while (turnsUsed < maxTurns) {
    // ── Player turn: play all cards in hand ──
    let safetyBreak = 0;

    if (brain) {
      // ── BotBrain-driven play loop ──────────────────────────────────────
      // Re-plan each iteration because playCardAction can change the hand
      // (cards consumed, new cards drawn, etc.)
      while (!isHandEmpty(turnState) && turnState.result === null) {
        if (safetyBreak++ > 200) break;

        const hand = turnState.deck.hand;
        if (hand.length === 0) break;

        const plan = brain.planTurn(hand, turnState, { freeCharging: ascMods.freeCharging });
        if (plan.length === 0) break;

        // Execute only the FIRST valid play, then re-plan
        let played = false;
        for (const play of plan) {
          // Re-check hand after each attempt — cards may have been removed
          const card = turnState.deck.hand.find(c => c.id === play.cardId);
          if (!card) continue;

          const apCost = card.apCost ?? 1;
          // AP surcharge check — must mirror real playCardAction() logic for momentum/surge/warcry
          let chargeSurcharge = CHARGE_AP_SURCHARGE;
          if (play.mode === 'charge') {
            // Chain momentum: correct Charge on chain X → next Charge on chain X is free
            if (turnState.nextChargeFreeForChainType !== null
                && card.chainType === turnState.nextChargeFreeForChainType) {
              chargeSurcharge = 0;
            }
            // Surge turns: surcharge waived
            else if (turnState.turnNumber >= SURGE_FIRST_TURN
                && (turnState.turnNumber - SURGE_FIRST_TURN) % SURGE_INTERVAL === 0) {
              chargeSurcharge = 0;
            }
            // Warcry free charge
            else if (turnState.warcryFreeChargeActive) {
              chargeSurcharge = 0;
            }
          }
          const totalCost = play.mode === 'charge' ? apCost + chargeSurcharge : apCost;
          if (turnState.apCurrent < totalCost) continue;

          const answeredCorrectly = Math.random() < brain.skills.accuracy;
          const speedBonus = answeredCorrectly && Math.random() < 0.5;

          const res = playCardAction(turnState, card.id, answeredCorrectly, speedBonus, play.mode);

          if (res.blocked && !res.fizzled) break;

          turnState = res.turnState;
          cardsPlayed++;
          played = true;

          if (answeredCorrectly) {
            correctAnswers++;
            if (ascMods.correctAnswerHeal > 0) {
              turnState.playerState.hp = Math.min(
                turnState.playerState.hp + ascMods.correctAnswerHeal,
                turnState.playerState.maxHP,
              );
            }
          } else {
            wrongAnswers++;
          }

          if (ascMods.comboHealThreshold > 0 && res.comboCount >= ascMods.comboHealThreshold && res.comboCount === ascMods.comboHealThreshold) {
            turnState.playerState.hp = Math.min(
              turnState.playerState.hp + ascMods.comboHealAmount,
              turnState.playerState.maxHP,
            );
          }

          if (res.effect.damageDealt > 0) damageDealt += res.effect.damageDealt;
          if (res.comboCount > maxCombo) maxCombo = res.comboCount;

          const midCheckResult = checkEncounterEnd(turnState);
          if (midCheckResult !== null) {
            return { result: midCheckResult, turnsUsed: turnsUsed + 1, damageDealt, damageTaken, cardsPlayed, correctAnswers, wrongAnswers, maxCombo };
          }

          break; // Only execute first valid play, then re-plan
        }

        if (!played) break;
      }
    } else {
      // ── Legacy dumb-bot play loop (unchanged for backward compatibility) ──
      while (!isHandEmpty(turnState) && turnState.result === null) {
        if (safetyBreak++ > 200) break;

        const hand = turnState.deck.hand;
        if (hand.length === 0) break;

        const minCardCost = hand.reduce((min, c) => Math.min(min, c.apCost ?? 1), Infinity);
        const minQuickCost = minCardCost;
        if (turnState.apCurrent < minQuickCost) break;

        const card = hand[0];
        const cardMinCost = card.apCost ?? 1;

        // CHARGE_AP_SURCHARGE = 0: Charge costs same AP as Quick Play
        const chargeSurcharge = CHARGE_AP_SURCHARGE;
        const chargeApCost = cardMinCost + chargeSurcharge;
        const canCharge = turnState.apCurrent >= chargeApCost;
        const isCharge = canCharge && Math.random() < chargeRate;

        if (turnState.apCurrent < cardMinCost) {
          if (hand.length <= 1) break;
          const rotated = hand.shift()!;
          hand.push(rotated);
          continue;
        }

        const answeredCorrectly = Math.random() < correctRate;
        const speedBonus = answeredCorrectly && Math.random() < 0.5;

        const res = playCardAction(
          turnState,
          card.id,
          answeredCorrectly,
          speedBonus,
          isCharge ? 'charge' : 'quick',
        );

        if (res.blocked && !res.fizzled) break;

        turnState = res.turnState;
        cardsPlayed++;

        if (answeredCorrectly) {
          correctAnswers++;
          if (ascMods.correctAnswerHeal > 0) {
            turnState.playerState.hp = Math.min(
              turnState.playerState.hp + ascMods.correctAnswerHeal,
              turnState.playerState.maxHP,
            );
          }
        } else {
          wrongAnswers++;
        }

        if (ascMods.comboHealThreshold > 0 && res.comboCount >= ascMods.comboHealThreshold && res.comboCount === ascMods.comboHealThreshold) {
          turnState.playerState.hp = Math.min(
            turnState.playerState.hp + ascMods.comboHealAmount,
            turnState.playerState.maxHP,
          );
        }

        if (res.effect.damageDealt > 0) damageDealt += res.effect.damageDealt;
        if (res.comboCount > maxCombo) maxCombo = res.comboCount;

        const midCheckResult = checkEncounterEnd(turnState);
        if (midCheckResult !== null) {
          return { result: midCheckResult, turnsUsed: turnsUsed + 1, damageDealt, damageTaken, cardsPlayed, correctAnswers, wrongAnswers, maxCombo };
        }
      }
    }

    // ── Enemy turn ──
    const enemyResult = endPlayerTurn(turnState);
    turnState = enemyResult.turnState;
    turnsUsed++;
    damageTaken += enemyResult.damageDealt;

    if (ascMods.enemyRegenPerTurn > 0 && turnState.enemy.currentHP > 0) {
      turnState.enemy.currentHP = Math.min(
        turnState.enemy.currentHP + ascMods.enemyRegenPerTurn,
        turnState.enemy.maxHP,
      );
    }

    const afterEnemyResult = checkEncounterEnd(turnState);
    if (afterEnemyResult !== null) {
      return { result: afterEnemyResult, turnsUsed, damageDealt, damageTaken, cardsPlayed, correctAnswers, wrongAnswers, maxCombo };
    }
  }

  return { result: 'timeout', turnsUsed, damageDealt, damageTaken, cardsPlayed, correctAnswers, wrongAnswers, maxCombo };
}

// ──────────────────────────────────────────────────────────────────────────────
// Gold Rewards
// ──────────────────────────────────────────────────────────────────────────────

const GOLD_COMBAT_MIN = 15;
const GOLD_COMBAT_MAX = 30;
const GOLD_ELITE_MIN = 40;
const GOLD_ELITE_MAX = 60;
const GOLD_BOSS_MIN = 80;
const GOLD_BOSS_MAX = 120;
const GOLD_MYSTERY_CURRENCY = 25;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function awardCombatGold(runState: SimRunState, nodeType: MapNodeType): number {
  let gold = 0;
  if (nodeType === 'combat') {
    gold = randInt(GOLD_COMBAT_MIN, GOLD_COMBAT_MAX);
  } else if (nodeType === 'elite') {
    gold = randInt(GOLD_ELITE_MIN, GOLD_ELITE_MAX);
  } else if (nodeType === 'boss') {
    gold = randInt(GOLD_BOSS_MIN, GOLD_BOSS_MAX);
  }
  runState.gold += gold;
  runState.goldEarned += gold;
  return gold;
}

// ──────────────────────────────────────────────────────────────────────────────
// Relic Pool Management
// ──────────────────────────────────────────────────────────────────────────────

function buildRelicPool(excludeIds: Set<string>): string[] {
  return FULL_RELIC_CATALOGUE
    .filter(r => !excludeIds.has(r.id))
    .map(r => r.id);
}

function pickRelicFromPool(pool: string[]): string | null {
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const id = pool[idx];
  pool.splice(idx, 1);
  return id;
}

function awardRelic(runState: SimRunState, relicPool: string[]): string | null {
  const id = pickRelicFromPool(relicPool);
  if (id) {
    runState.relicIds.add(id);
    // Apply passive HP bonus relics immediately
    const def = RELIC_BY_ID[id];
    if (def) {
      for (const eff of def.effects) {
        if (eff.effectId === 'max_hp_bonus') {
          runState.maxHp += eff.value ?? 0;
          runState.hp = Math.min(runState.hp + (eff.value ?? 0), runState.maxHp);
        }
      }
    }
  }
  return id;
}

// ──────────────────────────────────────────────────────────────────────────────
// Node Handlers
// ──────────────────────────────────────────────────────────────────────────────

function handleCombatNode(
  runState: SimRunState,
  nodeType: MapNodeType,
  floor: number,
  act: 1 | 2 | 3,
  opts: Required<Omit<FullRunOptions, 'botSkills' | 'forceRelics'>> & { botSkills?: BotSkills; forceRelics?: string[] },
  ascMods: ReturnType<typeof getAscensionModifiers>,
  relicPool: string[],
  verbose: boolean,
  runChainTypes: number[],
  brain?: BotBrain,
): EncounterResult & { goldAwarded: number } {
  // Map MapNodeType to enemy pool type
  let enemyPoolType: 'combat' | 'elite' | 'mini_boss' | 'boss';
  if (nodeType === 'boss') enemyPoolType = 'boss';
  else if (nodeType === 'elite') enemyPoolType = 'elite';
  else enemyPoolType = 'combat';

  let enemyTemplate: EnemyTemplate;
  try {
    enemyTemplate = pickEnemyForNode(act, enemyPoolType);
  } catch {
    // Fallback to combat if pool empty for this type
    try {
      enemyTemplate = pickEnemyForNode(act, 'combat');
    } catch {
      return { result: 'victory', turnsUsed: 0, damageDealt: 0, damageTaken: 0, cardsPlayed: 0, correctAnswers: 0, wrongAnswers: 0, maxCombo: 0, goldAwarded: 0 };
    }
  }

  const isBossLike = nodeType === 'boss' || nodeType === 'elite';
  const enemy = createEnemy(enemyTemplate, floor, {
    hpMultiplier: ascMods.enemyHpMultiplier * (isBossLike ? ascMods.bossHpMultiplier : 1),
  });

  const deckCards = [...runState.deck];
  const deck = createDeck(deckCards);
  deck.currentFloor = floor;
  deck.playerHP = runState.hp;
  deck.playerMaxHP = runState.maxHp;
  deck.playerShield = 0;

  if (verbose) {
    console.log(`    [${nodeType.toUpperCase()}] ${enemyTemplate.name} (floor ${floor}, act ${act}) | HP: ${runState.hp}/${runState.maxHp}`);
  }

  const initialTurnState = startEncounter(deck, enemy, runState.hp);

  // Apply ascension modifiers
  initialTurnState.ascensionLevel = ascMods.level;
  initialTurnState.ascensionEnemyDamageMultiplier = ascMods.enemyDamageMultiplier;
  initialTurnState.ascensionShieldCardMultiplier = ascMods.shieldCardMultiplier;
  initialTurnState.ascensionWrongAnswerSelfDamage = ascMods.wrongAnswerSelfDamage;
  initialTurnState.ascensionComboResetsOnTurnEnd = ascMods.comboResetsOnTurnEnd;
  initialTurnState.ascensionBaseTimerPenaltySeconds = ascMods.timerBasePenaltySeconds;
  initialTurnState.ascensionEncounterTimerPenaltySeconds = ascMods.encounterTwoTimerPenaltySeconds;
  initialTurnState.ascensionPreferCloseDistractors = ascMods.preferCloseDistractors;
  initialTurnState.ascensionTier1OptionCount = ascMods.tier1OptionCount;
  initialTurnState.ascensionForceHardQuestionFormats = ascMods.forceHardQuestionFormats;
  initialTurnState.ascensionPreventFlee = ascMods.preventFlee;
  initialTurnState.activeRelicIds = new Set(runState.relicIds);

  if (ascMods.firstTurnBonusAp > 0) initialTurnState.apCurrent += ascMods.firstTurnBonusAp;
  if (ascMods.encounterStartShield > 0) initialTurnState.playerState.shield += ascMods.encounterStartShield;

  const result = simulateSingleEncounter(
    initialTurnState,
    {
      correctRate: opts.botSkills?.accuracy ?? opts.correctRate,
      chargeRate: opts.chargeRate,
      maxTurns: opts.maxTurnsPerEncounter,
      brain,
    },
    ascMods,
  );

  // Update HP from encounter result
  const hpAfter = Math.max(0, runState.hp - result.damageTaken);
  runState.hp = hpAfter;

  if (verbose) {
    console.log(`    Result: ${result.result.toUpperCase()} | Turns: ${result.turnsUsed} | HP: ${runState.hp}/${runState.maxHp}`);
  }

  if (result.result === 'victory' || result.result === 'timeout') {
    // 25% chance health vial drop (matches real game probability)
    if (Math.random() < 0.25) {
      const isLarge = Math.random() < 0.3;
      const vialHeal = isLarge
        ? 20 + Math.floor(Math.random() * 16)  // 20-35 HP
        : 8 + Math.floor(Math.random() * 11);  // 8-18 HP
      runState.hp = Math.min(runState.maxHp, runState.hp + vialHeal);
      if (verbose) console.log(`    Health vial: +${vialHeal} HP → ${runState.hp}`);
    }

    // Award gold
    const goldAwarded = awardCombatGold(runState, nodeType);

    // Card reward (all combat nodes, plus elite and boss get one too)
    if (brain) {
      const options = [pickRandomMechanic(), pickRandomMechanic(), pickRandomMechanic()];
      const chosen = brain.pickReward(options, runState.deck);
      if (chosen && runState.deck.length < MAX_DECK_SIZE) {
        const newCard = makeMechanicCard(chosen);
        newCard.chainType = runChainTypes[runState.deck.length % runChainTypes.length];
        runState.deck.push(newCard);
        runState.cardsAdded++;
      }
    } else {
      const newCard = pickCardReward(runState.deck);
      if (newCard) {
        newCard.chainType = runChainTypes[runState.deck.length % runChainTypes.length];
        runState.deck.push(newCard);
        runState.cardsAdded++;
      }
    }

    // Elite: also award a relic
    if (nodeType === 'elite' || nodeType === 'boss') {
      if (brain && relicPool.length >= 3) {
        // Brain-driven relic selection: offer 3 candidates, let brain pick best
        const candidates = [relicPool[0], relicPool[1], relicPool[2]];
        const hpPct = runState.hp / (runState.maxHp || 1);
        const attackCount = runState.deck.filter(c => c.cardType === 'attack').length;
        const attackPct = runState.deck.length > 0 ? attackCount / runState.deck.length : 0;
        const chosenId = brain.pickRelic(candidates, hpPct, attackPct);
        // Remove chosen from pool and award it
        const chosenIdx = relicPool.indexOf(chosenId);
        if (chosenIdx >= 0) {
          relicPool.splice(chosenIdx, 1);
          runState.relicIds.add(chosenId);
          const def = RELIC_BY_ID[chosenId];
          if (def) {
            for (const eff of def.effects) {
              if (eff.effectId === 'max_hp_bonus') {
                runState.maxHp += eff.value ?? 0;
                runState.hp = Math.min(runState.hp + (eff.value ?? 0), runState.maxHp);
              }
            }
          }
        } else {
          awardRelic(runState, relicPool);
        }
      } else {
        awardRelic(runState, relicPool);
      }
    }

    return { ...result, goldAwarded };
  }

  return { ...result, goldAwarded: 0 };
}

function handleShopNode(
  runState: SimRunState,
  _floor: number,
  relicPool: string[],
  verbose: boolean,
  runChainTypes: number[],
  brain?: BotBrain,
): void {
  const cardPrice = SHOP_CARD_PRICE_V2['common'] ?? 50;
  const relicPrice = SHOP_RELIC_PRICE['common'] ?? 100;
  const removalCost = SHOP_REMOVAL_BASE_PRICE + runState.cardRemovalCount * SHOP_REMOVAL_PRICE_INCREMENT;
  const rationPrice = SHOP_FOOD_ITEMS.ration.basePrice;

  if (brain) {
    // ── BotBrain-driven shop ──────────────────────────────────────────────
    const shopCards = [pickRandomMechanic(), pickRandomMechanic(), pickRandomMechanic()];
    const shopRelics = relicPool.slice(0, 2); // offer 2 relics
    const foodItems = [{ healPct: SHOP_FOOD_ITEMS.ration.healPct, cost: rationPrice }];

    const actions = brain.planShop(
      { hp: runState.hp, maxHp: runState.maxHp, gold: runState.gold, deckSize: runState.deck.length },
      shopCards,
      shopRelics,
      removalCost,
      cardPrice,
      relicPrice,
      foodItems,
    );

    for (const action of actions) {
      if (action.type === 'remove_card' && runState.gold >= removalCost && runState.deck.length > 0) {
        const strikeIdx = runState.deck.findIndex(c => c.mechanicId === 'strike');
        const removeIdx = strikeIdx >= 0 ? strikeIdx : 0;
        runState.deck.splice(removeIdx, 1);
        runState.gold -= removalCost;
        runState.goldSpent += removalCost;
        runState.cardRemovalCount++;
        runState.cardsRemoved++;
        if (verbose) console.log(`    [SHOP/bot] Removed card. Deck: ${runState.deck.length}`);
      } else if (action.type === 'buy_card' && runState.gold >= cardPrice && runState.deck.length < MAX_DECK_SIZE) {
        const mechanic = shopCards[action.index] ?? shopCards[0];
        if (mechanic) {
          const newCard = makeMechanicCard(mechanic);
          newCard.chainType = runChainTypes[runState.deck.length % runChainTypes.length];
          runState.deck.push(newCard);
          runState.gold -= cardPrice;
          runState.goldSpent += cardPrice;
          runState.cardsAdded++;
          if (verbose) console.log(`    [SHOP/bot] Bought card. Deck: ${runState.deck.length}`);
        }
      } else if (action.type === 'buy_relic' && runState.gold >= relicPrice && relicPool.length > 0) {
        const id = awardRelic(runState, relicPool);
        if (id) {
          runState.gold -= relicPrice;
          runState.goldSpent += relicPrice;
          if (verbose) console.log(`    [SHOP/bot] Bought relic: ${id}`);
        }
      } else if (action.type === 'buy_food' && runState.gold >= rationPrice) {
        const healAmt = Math.floor(runState.maxHp * SHOP_FOOD_ITEMS.ration.healPct);
        runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
        runState.gold -= rationPrice;
        runState.goldSpent += rationPrice;
        if (verbose) console.log(`    [SHOP/bot] Bought ration. HP: ${runState.hp}/${runState.maxHp}`);
      }
    }
    return;
  }

  // ── Legacy dumb-bot shop (unchanged for backward compatibility) ──────────
  // 1. Card removal if deck is bloated and we can afford it
  if (runState.deck.length > 15) {
    if (runState.gold >= removalCost) {
      // Heuristic: remove the first 'strike' in the deck (basic cards become weaker as deck grows)
      const strikeIdx = runState.deck.findIndex(c => c.mechanicId === 'strike');
      const removeIdx = strikeIdx >= 0 ? strikeIdx : 0;
      if (runState.deck.length > 0) {
        runState.deck.splice(removeIdx, 1);
        runState.gold -= removalCost;
        runState.goldSpent += removalCost;
        runState.cardRemovalCount++;
        runState.cardsRemoved++;
        if (verbose) console.log(`    [SHOP] Removed card. Deck: ${runState.deck.length}`);
      }
    }
  }

  // 2. Buy a card if affordable (common price = 50g)
  if (runState.gold >= cardPrice && runState.deck.length < MAX_DECK_SIZE) {
    const newCard = pickCardReward(runState.deck);
    if (newCard) {
      newCard.chainType = runChainTypes[runState.deck.length % runChainTypes.length];
      runState.deck.push(newCard);
      runState.gold -= cardPrice;
      runState.goldSpent += cardPrice;
      runState.cardsAdded++;
      if (verbose) console.log(`    [SHOP] Bought card. Deck: ${runState.deck.length}`);
    }
  }

  // 3. Buy a relic if affordable and pool is not empty (common relic = 100g)
  if (runState.gold >= relicPrice && relicPool.length > 0) {
    const id = awardRelic(runState, relicPool);
    if (id) {
      runState.gold -= relicPrice;
      runState.goldSpent += relicPrice;
      if (verbose) console.log(`    [SHOP] Bought relic: ${id}`);
    }
  }

  // 4. Buy food (ration) if low HP and affordable (ration = 25g)
  const hpPct = runState.hp / runState.maxHp;
  if (hpPct < 0.6 && runState.gold >= rationPrice) {
    const healAmt = Math.floor(runState.maxHp * SHOP_FOOD_ITEMS.ration.healPct);
    runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
    runState.gold -= rationPrice;
    runState.goldSpent += rationPrice;
    if (verbose) console.log(`    [SHOP] Bought ration. HP: ${runState.hp}/${runState.maxHp}`);
  }
}

function handleRestNode(
  runState: SimRunState,
  ascMods: ReturnType<typeof getAscensionModifiers>,
  verbose: boolean,
  brain?: BotBrain,
): void {
  if (brain) {
    // ── BotBrain-driven rest ──────────────────────────────────────────────
    const decision = brain.planRest({ hp: runState.hp, maxHp: runState.maxHp, deckSize: runState.deck.length });

    if (decision === 'heal') {
      const healPct = REST_SITE_HEAL_PCT * ascMods.restHealMultiplier;
      const healAmt = Math.floor(runState.maxHp * healPct);
      runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
      if (verbose) console.log(`    [REST/bot] Healed ${healAmt}. HP: ${runState.hp}/${runState.maxHp}`);
    } else if (decision === 'meditate') {
      // Remove weakest card (basic strike first)
      if (runState.deck.length > 8) {
        const strikeIdx = runState.deck.findIndex(c => c.mechanicId === 'strike');
        const removeIdx = strikeIdx >= 0 ? strikeIdx : 0;
        runState.deck.splice(removeIdx, 1);
        runState.cardsRemoved++;
        if (verbose) console.log(`    [REST/bot] Meditated (removed card). Deck: ${runState.deck.length}`);
      } else {
        // Deck too small to remove, heal instead
        const healPct = REST_SITE_HEAL_PCT * ascMods.restHealMultiplier;
        const healAmt = Math.floor(runState.maxHp * healPct);
        runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
        if (verbose) console.log(`    [REST/bot] Deck too small to meditate, healed ${healAmt}. HP: ${runState.hp}/${runState.maxHp}`);
      }
    } else {
      // Study: heal a bit as proxy for mastery gain
      const healAmt = Math.floor(runState.maxHp * 0.05);
      runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
      if (verbose) console.log(`    [REST/bot] Studied. HP: ${runState.hp}/${runState.maxHp}`);
    }
    return;
  }

  // ── Legacy dumb-bot rest (unchanged for backward compatibility) ──────────
  const hpPct = runState.hp / runState.maxHp;

  if (hpPct < 0.5) {
    // Heal REST_SITE_HEAL_PCT of max HP (ascension may reduce this)
    const healPct = REST_SITE_HEAL_PCT * ascMods.restHealMultiplier;
    const healAmt = Math.floor(runState.maxHp * healPct);
    runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
    if (verbose) console.log(`    [REST] Healed ${healAmt}. HP: ${runState.hp}/${runState.maxHp}`);
  } else if (runState.deck.length > 15) {
    // Meditate: remove a weak card (basic strike)
    const strikeIdx = runState.deck.findIndex(c => c.mechanicId === 'strike');
    const removeIdx = strikeIdx >= 0 ? strikeIdx : 0;
    if (runState.deck.length > 8) { // Keep at least 8 cards
      runState.deck.splice(removeIdx, 1);
      runState.cardsRemoved++;
      if (verbose) console.log(`    [REST] Meditated (removed card). Deck: ${runState.deck.length}`);
    }
  } else {
    // Study: "upgrade" a card by boosting its base effect value slightly
    if (runState.deck.length > 0) {
      // In sim terms: just heal a bit since we don't track mastery
      const healAmt = Math.floor(runState.maxHp * 0.05);
      runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
      if (verbose) console.log(`    [REST] Studied. HP: ${runState.hp}/${runState.maxHp}`);
    }
  }
}

function handleTreasureNode(
  runState: SimRunState,
  relicPool: string[],
  verbose: boolean,
): void {
  const id = awardRelic(runState, relicPool);
  if (verbose) console.log(`    [TREASURE] Got relic: ${id ?? 'none'}`);
}

/**
 * Pick the best option from a mystery event choice by scoring each effect.
 * Prefers heals when HP is low, gold, and card rewards; avoids damage/costs.
 */
function pickBestMysteryOption(
  options: Array<{ label: string; effect: { type: string; amount?: number; percent?: number; message?: string } }>,
  runState: SimRunState,
): { type: string; amount?: number; percent?: number; message?: string } {
  if (options.length === 0) return { type: 'nothing', message: '' };

  const hpPct = runState.hp / (runState.maxHp || 1);
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < options.length; i++) {
    const e = options[i].effect;
    let score = 0;
    if (e.type === 'heal' || e.type === 'healPercent') score += hpPct < 0.5 ? 40 : 20;
    if (e.type === 'currency' && (e.amount ?? 0) > 0) score += 15;
    if (e.type === 'freeCard' || e.type === 'cardReward') score += 10;
    if (e.type === 'upgradeRandomCard') score += 10;
    if (e.type === 'damage') score -= 30;
    if (e.type === 'currency' && (e.amount ?? 0) < 0) score -= 15;
    if (e.type === 'removeRandomCard') score += runState.deck.length > 12 ? 10 : -10;
    if (e.type === 'nothing') score += 0;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return options[bestIdx].effect;
}

function handleMysteryNode(
  runState: SimRunState,
  floor: number,
  act: 1 | 2 | 3,
  opts: Required<Omit<FullRunOptions, 'botSkills' | 'forceRelics'>> & { botSkills?: BotSkills; forceRelics?: string[] },
  ascMods: ReturnType<typeof getAscensionModifiers>,
  relicPool: string[],
  verbose: boolean,
  runChainTypes: number[],
  brain?: BotBrain,
): { didCombat: boolean; combatResult?: EncounterResult } {
  const event = generateMysteryEvent(floor);

  if (verbose) console.log(`    [MYSTERY] ${event.name}: effect=${event.effect.type}`);

  // Resolve the top-level effect (for 'choice' effects, pick the best positive option)
  const effect = event.effect.type === 'choice'
    ? pickBestMysteryOption(event.effect.options, runState)
    : event.effect;

  switch (effect.type) {
    case 'heal':
      runState.hp = Math.min(runState.maxHp, runState.hp + (effect.amount ?? 0));
      break;
    case 'healPercent': {
      const healAmt = Math.floor(runState.maxHp * ((effect.percent ?? 15) / 100));
      runState.hp = Math.min(runState.maxHp, runState.hp + healAmt);
      break;
    }
    case 'damage':
      runState.hp = Math.max(0, runState.hp - (effect.amount ?? 0));
      break;
    case 'currency': {
      const delta = effect.amount ?? 0;
      if (delta > 0) {
        runState.gold += delta;
        runState.goldEarned += delta;
      } else {
        const cost = Math.abs(delta);
        if (runState.gold >= cost) {
          runState.gold -= cost;
          runState.goldSpent += cost;
        }
      }
      break;
    }
    case 'freeCard':
    case 'cardReward': {
      if (brain) {
        const options = [pickRandomMechanic(), pickRandomMechanic(), pickRandomMechanic()];
        const chosen = brain.pickReward(options, runState.deck);
        if (chosen && runState.deck.length < MAX_DECK_SIZE) {
          const newCard = makeMechanicCard(chosen);
          newCard.chainType = runChainTypes[runState.deck.length % runChainTypes.length];
          runState.deck.push(newCard);
          runState.cardsAdded++;
        }
      } else {
        const newCard = pickCardReward(runState.deck);
        if (newCard) {
          newCard.chainType = runChainTypes[runState.deck.length % runChainTypes.length];
          runState.deck.push(newCard);
          runState.cardsAdded++;
        }
      }
      break;
    }
    case 'upgradeRandomCard':
      // In sim: minor heal as proxy for "card got stronger"
      runState.hp = Math.min(runState.maxHp, runState.hp + 2);
      break;
    case 'removeRandomCard':
      if (runState.deck.length > 8) {
        // Remove a basic strike (weakest card)
        const strikeIdx = runState.deck.findIndex(c => c.mechanicId === 'strike');
        const removeIdx = strikeIdx >= 0 ? strikeIdx : 0;
        runState.deck.splice(removeIdx, 1);
        runState.cardsRemoved++;
      }
      break;
    case 'maxHpChange':
      runState.maxHp = Math.max(20, runState.maxHp + (effect.amount ?? 0));
      runState.hp = Math.min(runState.hp, runState.maxHp);
      break;
    case 'combat': {
      // Fight a random enemy, no reward
      const combatResult = handleCombatNode(
        runState, 'combat', floor, act, opts, ascMods, relicPool, verbose, runChainTypes, brain,
      );
      return { didCombat: true, combatResult };
    }
    case 'transformCard':
    case 'nothing':
    default:
      // No effect
      break;
  }

  return { didCombat: false };
}

// ──────────────────────────────────────────────────────────────────────────────
// Map Walking
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Walks a random path through an act map from row 0 to the boss row.
 * Returns nodes in traversal order (bottom to top).
 */
function walkMapPath(actMap: ActMap): MapNode[] {
  const path: MapNode[] = [];

  // Start from a random row-0 node
  const row0Ids = actMap.rows[0] ?? [];
  if (row0Ids.length === 0) return path;

  let currentId = row0Ids[Math.floor(Math.random() * row0Ids.length)];
  selectMapNode(actMap, currentId);
  path.push(actMap.nodes[currentId]);

  // Walk until there are no more available children
  while (true) {
    const available = getAvailableNodes(actMap);
    if (available.length === 0) break;

    // Pick a random available node (they're all children of the current node)
    const nextId = available[Math.floor(Math.random() * available.length)];
    selectMapNode(actMap, nextId);
    path.push(actMap.nodes[nextId]);
    currentId = nextId;
  }

  return path;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API: simulateFullRun
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Simulates a complete Recall Rogue run with map progression, card rewards,
 * relics, shops, rest sites, mystery events, and gold economy.
 *
 * Uses real game code (mapGenerator, floorManager, shopService) — no reimplementation.
 *
 * @param opts - Run options. All fields have sensible defaults.
 * @returns A complete run result with all aggregate statistics.
 */
export function simulateFullRun(opts: FullRunOptions = {}): FullRunResult {
  const startTime = Date.now();

  const options: Required<Omit<FullRunOptions, 'botSkills' | 'forceRelics'>> & { botSkills?: BotSkills; forceRelics?: string[] } = {
    correctRate: opts.correctRate ?? 0.75,
    chargeRate: opts.chargeRate ?? 0.7,
    seed: opts.seed ?? Math.floor(Math.random() * 1_000_000),
    maxTurnsPerEncounter: opts.maxTurnsPerEncounter ?? 50,
    verbose: opts.verbose ?? false,
    ascensionLevel: opts.ascensionLevel ?? 0,
    acts: opts.acts ?? 3,
    botSkills: opts.botSkills,
    forceRelics: opts.forceRelics,
  };

  const { verbose } = options;

  const ascMods = getAscensionModifiers(options.ascensionLevel);
  const runId = `fullrun_${options.seed}_${Date.now()}`;

  // Create BotBrain if botSkills provided — used for intelligent play decisions
  const brain = options.botSkills ? new BotBrain(options.botSkills) : undefined;

  // Chain types selected for this run — used round-robin for all cards added during the run
  const runChainTypes = selectRunChainTypes(options.seed);

  // ── Initialize run state ──
  // PLAYER_START_HP (120) is the actual starting HP+MaxHP for a fresh run.
  // PLAYER_MAX_HP (100) is a lower baseline used by the old combat-only sim.
  // In a full run we start at PLAYER_START_HP for both, matching the real game.
  const baseMaxHp = ascMods.playerMaxHpOverride ?? PLAYER_START_HP;
  const runState: SimRunState = {
    deck: buildStarterDeck(options.seed),
    relicIds: new Set<string>(),
    gold: 0,
    hp: baseMaxHp,
    maxHp: baseMaxHp,
    cardRemovalCount: 0,
    goldEarned: 0,
    goldSpent: 0,
    cardsAdded: 0,
    cardsRemoved: 0,
  };

  // Apply starter deck size override from ascension
  if (ascMods.starterDeckSizeOverride && ascMods.starterDeckSizeOverride !== runState.deck.length) {
    while (runState.deck.length < ascMods.starterDeckSizeOverride) {
      const newCard = makeMechanicCard(pickRandomMechanic());
      newCard.chainType = runChainTypes[runState.deck.length % runChainTypes.length];
      runState.deck.push(newCard);
    }
  }

  // Pick a random starter relic
  const starterRelicPool = [...STARTER_RELIC_IDS];
  for (let r = 0; r < ascMods.startingRelicCount && starterRelicPool.length > 0; r++) {
    const idx = Math.floor(Math.random() * starterRelicPool.length);
    const id = starterRelicPool[idx];
    starterRelicPool.splice(idx, 1);
    runState.relicIds.add(id);
    // Apply passive effects
    const def = RELIC_BY_ID[id];
    if (def) {
      for (const eff of def.effects) {
        if (eff.effectId === 'max_hp_bonus') {
          runState.maxHp += eff.value ?? 0;
          runState.hp = Math.min(runState.hp + (eff.value ?? 0), runState.maxHp);
        }
      }
    }
  }

  // Add forced relics for causal testing
  if (options.forceRelics) {
    for (const id of options.forceRelics) {
      if (!runState.relicIds.has(id)) {
        runState.relicIds.add(id);
        // Apply passive effects
        const def = RELIC_BY_ID[id];
        if (def) {
          for (const eff of def.effects) {
            if (eff.effectId === 'max_hp_bonus') {
              runState.maxHp += eff.value ?? 0;
              runState.hp = Math.min(runState.hp + (eff.value ?? 0), runState.maxHp);
            }
          }
        }
      }
    }
  }

  // Build relic pool (relics not already held)
  const relicPool = buildRelicPool(runState.relicIds);

  // ── Aggregate counters ──
  const roomsVisited: Record<MapNodeType, number> = {
    combat: 0, elite: 0, boss: 0, mystery: 0, rest: 0, treasure: 0, shop: 0,
  };
  const nodeVisits: NodeVisitRecord[] = [];

  let totalEncounters = 0;
  let encountersWon = 0;
  let totalTurns = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let totalCardsPlayed = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let maxComboSeen = 0;
  let actsCompleted = 0;
  let survived = true;

  // ── Act loop ──
  for (let act = 1; act <= options.acts; act++) {
    if (!survived) break;

    if (verbose) console.log(`\n  === ACT ${act} === (HP: ${runState.hp}/${runState.maxHp}, Gold: ${runState.gold}, Deck: ${runState.deck.length})`);

    // Generate map for this act (segment = act number, 1-3)
    const segment = act as 1 | 2 | 3;
    const actSeed = options.seed + act * 31337;
    const actMap = generateActMap(segment, actSeed);

    /**
     * Process a single map node — shared by both the brain-driven and legacy paths.
     * Mutates survived, roomsVisited, nodeVisits, and all aggregate counters.
     */
    const processNode = (node: MapNode): void => {
      const floor = deriveFloorFromNode(actMap, node);
      const nodeType = node.type;

      roomsVisited[nodeType] = (roomsVisited[nodeType] ?? 0) + 1;

      const visitRecord: NodeVisitRecord = {
        nodeType,
        act,
        floor,
      };

      const hpBefore = runState.hp;
      const goldBefore = runState.gold;
      const deckSizeBefore = runState.deck.length;

      switch (nodeType) {
        case 'combat':
        case 'elite':
        case 'boss': {
          totalEncounters++;
          const combatResult = handleCombatNode(
            runState, nodeType, floor, act as 1 | 2 | 3,
            options, ascMods, relicPool, verbose, runChainTypes, brain,
          );

          visitRecord.result = combatResult.result;
          totalTurns += combatResult.turnsUsed;
          totalDamageDealt += combatResult.damageDealt;
          totalDamageTaken += combatResult.damageTaken;
          totalCardsPlayed += combatResult.cardsPlayed;
          totalCorrect += combatResult.correctAnswers;
          totalWrong += combatResult.wrongAnswers;
          if (combatResult.maxCombo > maxComboSeen) maxComboSeen = combatResult.maxCombo;

          if (combatResult.result === 'victory' || combatResult.result === 'timeout') {
            encountersWon++;
          } else {
            // Defeat
            survived = false;
            runState.hp = 0;
          }
          break;
        }

        case 'shop':
          handleShopNode(runState, floor, relicPool, verbose, runChainTypes, brain);
          visitRecord.result = 'skipped'; // shops don't have win/loss
          break;

        case 'rest':
          handleRestNode(runState, ascMods, verbose, brain);
          visitRecord.result = 'skipped';
          break;

        case 'treasure':
          handleTreasureNode(runState, relicPool, verbose);
          visitRecord.result = 'skipped';
          break;

        case 'mystery': {
          const { didCombat, combatResult } = handleMysteryNode(
            runState, floor, act as 1 | 2 | 3,
            options, ascMods, relicPool, verbose, runChainTypes, brain,
          );
          if (didCombat && combatResult) {
            totalEncounters++;
            totalTurns += combatResult.turnsUsed;
            totalDamageDealt += combatResult.damageDealt;
            totalDamageTaken += combatResult.damageTaken;
            totalCardsPlayed += combatResult.cardsPlayed;
            totalCorrect += combatResult.correctAnswers;
            totalWrong += combatResult.wrongAnswers;
            if (combatResult.maxCombo > maxComboSeen) maxComboSeen = combatResult.maxCombo;
            if (combatResult.result === 'victory' || combatResult.result === 'timeout') {
              encountersWon++;
            } else {
              survived = false;
              runState.hp = 0;
            }
            visitRecord.result = combatResult.result;
          } else {
            visitRecord.result = 'skipped';
          }
          break;
        }
      }

      visitRecord.hpChange = runState.hp - hpBefore;
      visitRecord.goldChange = runState.gold - goldBefore;
      visitRecord.deckSizeChange = runState.deck.length - deckSizeBefore;
      nodeVisits.push(visitRecord);

      // Check defeat after any node
      if (runState.hp <= 0) {
        survived = false;
        runState.hp = 0;
      }
    };

    if (brain) {
      // ── Brain-driven path: step-by-step room selection via brain.pickRoom() ──
      const row0Ids = actMap.rows[0] ?? [];
      if (row0Ids.length === 0) {
        if (survived) actsCompleted++;
        continue;
      }

      let currentNodeId = row0Ids[Math.floor(Math.random() * row0Ids.length)];
      selectMapNode(actMap, currentNodeId);

      if (verbose) console.log(`  Brain walk starting at node ${currentNodeId}`);

      while (true) {
        if (!survived) break;

        const node = actMap.nodes[currentNodeId];
        processNode(node);
        if (!survived) break;

        // After processing, pick next room
        const availableIds = getAvailableNodes(actMap);
        if (availableIds.length === 0) break;

        let nextNodeId: string;
        if (availableIds.length === 1) {
          nextNodeId = availableIds[0];
        } else {
          const availableNodes = availableIds.map(id => actMap.nodes[id]);
          const picked = brain.pickRoom(availableNodes, { hp: runState.hp, maxHp: runState.maxHp });
          nextNodeId = picked.id;
        }
        selectMapNode(actMap, nextNodeId);
        currentNodeId = nextNodeId;
      }
    } else {
      // ── Legacy path: random walk via walkMapPath() ──
      const path = walkMapPath(actMap);

      if (verbose) console.log(`  Path: ${path.map(n => `${n.type}(r${n.row})`).join(' -> ')}`);

      for (const node of path) {
        if (!survived) break;
        processNode(node);
      }
    }

    if (survived) {
      actsCompleted++;
      if (verbose) {
        console.log(`  Act ${act} complete! HP: ${runState.hp}/${runState.maxHp}, Gold: ${runState.gold}, Deck: ${runState.deck.length}, Relics: ${runState.relicIds.size}`);
      }
    }
  }

  const totalAnswered = totalCorrect + totalWrong;

  return {
    runId,
    options,
    survived,
    actsCompleted,
    finalHP: runState.hp,
    finalDeckSize: runState.deck.length,
    goldEarned: runState.goldEarned,
    goldSpent: runState.goldSpent,
    goldFinal: runState.gold,
    relicsAcquired: [...runState.relicIds],
    roomsVisited,
    nodeVisits,
    totalEncounters,
    encountersWon,
    totalTurns,
    totalDamageDealt,
    totalDamageTaken,
    totalCardsPlayed,
    totalCorrect,
    totalWrong,
    accuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
    maxComboSeen,
    cardsAddedToRun: runState.cardsAdded,
    cardsRemovedFromRun: runState.cardsRemoved,
    durationMs: Date.now() - startTime,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────────────────

/** Print a formatted full run result summary */
export function printFullRunSummary(result: FullRunResult): void {
  console.log('\n' + '═'.repeat(65));
  console.log(`  FULL RUN SUMMARY  [${result.runId}]`);
  console.log('═'.repeat(65));
  console.log(`  Survived:          ${result.survived ? 'YES' : 'NO'}`);
  console.log(`  Acts completed:    ${result.actsCompleted}/${result.options.acts}`);
  console.log(`  Final HP:          ${result.finalHP}/${PLAYER_START_HP}`);
  console.log(`  Final deck size:   ${result.finalDeckSize}`);
  console.log(`  Gold earned:       ${result.goldEarned}`);
  console.log(`  Gold spent:        ${result.goldSpent}`);
  console.log(`  Gold remaining:    ${result.goldFinal}`);
  console.log(`  Relics acquired:   ${result.relicsAcquired.length} — ${result.relicsAcquired.join(', ')}`);
  console.log(`  Cards added:       ${result.cardsAddedToRun}`);
  console.log(`  Cards removed:     ${result.cardsRemovedFromRun}`);
  console.log('─'.repeat(65));
  console.log(`  Rooms visited:`);
  for (const [type, count] of Object.entries(result.roomsVisited)) {
    if (count > 0) console.log(`    ${type.padEnd(10)} ${count}`);
  }
  console.log('─'.repeat(65));
  console.log(`  Combat stats:`);
  console.log(`    Encounters:    ${result.encountersWon}/${result.totalEncounters} won`);
  console.log(`    Total turns:   ${result.totalTurns}`);
  console.log(`    Accuracy:      ${(result.accuracy * 100).toFixed(1)}%  (${result.totalCorrect}/${result.totalCorrect + result.totalWrong})`);
  console.log(`    Damage dealt:  ${result.totalDamageDealt}`);
  console.log(`    Damage taken:  ${result.totalDamageTaken}`);
  console.log(`    Max combo:     ${result.maxComboSeen}`);
  console.log(`  Duration:          ${result.durationMs}ms`);
  console.log('═'.repeat(65));
}

if (process.argv[1] && process.argv[1].includes('full-run-simulator')) {
  console.log('Full Run Simulator — starting...\n');

  const args = process.argv.slice(2);
  const getArg = (key: string, defaultVal: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
  };

  const opts: FullRunOptions = {
    correctRate: parseFloat(getArg('correct-rate', '0.75')),
    chargeRate: parseFloat(getArg('charge-rate', '0.7')),
    acts: parseInt(getArg('acts', '3')) as 1 | 2 | 3,
    maxTurnsPerEncounter: parseInt(getArg('max-turns', '50')),
    verbose: args.includes('--verbose') || args.includes('-v'),
    ascensionLevel: parseInt(getArg('ascension', '0')),
  };

  console.log('Options:', opts);
  const result = simulateFullRun(opts);
  printFullRunSummary(result);

  process.exit(result.survived ? 0 : 1);
}
