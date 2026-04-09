/**
 * Headless Combat Simulator
 * ===========================
 * Runs full card-roguelite encounters entirely in Node.js, without Phaser,
 * Svelte, DOM, or browser APIs.
 *
 * Usage:
 *   npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
 *           tests/playtest/headless/simulator.ts
 *
 * Or import and call runSimulation() directly from other scripts.
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
import { PLAYER_START_HP, PLAYER_MAX_HP, POST_ENCOUNTER_HEAL_PCT, ENABLE_PHASE2_MECHANICS, STARTER_DECK_COMPOSITION, CHARGE_AP_SURCHARGE, SURGE_FIRST_TURN, SURGE_INTERVAL } from '../../../src/data/balance.js';
import { MECHANIC_DEFINITIONS, type MechanicDefinition } from '../../../src/data/mechanics.js';
import { getAscensionModifiers } from '../../../src/services/ascension.js';
import { STARTER_RELIC_IDS } from '../../../src/data/relics/index.js';
import { selectRunChainTypes } from '../../../src/data/chainTypes.js';
import { BotBrain, type BotSkills } from './bot-brain.js';
import { createCanaryState, recordCanaryAnswer, resetCanaryFloor, type CanaryState } from '../../../src/services/canaryService.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface SimOptions {
  /** Number of encounters to simulate per run. Default: 10 */
  encounterCount?: number;
  /** Probability of answering correctly (0-1). Default: 0.75 */
  correctRate?: number;
  /** Probability of using Charge (vs Quick Play) when hand is played. Default: 0.7 */
  chargeRate?: number;
  /** Cards in the starting deck. Default: 15 */
  deckSize?: number;
  /** Act number (1-3) for enemy selection. Default: 1 */
  act?: 1 | 2 | 3;
  /** Node type for enemy selection. Default: 'combat' */
  nodeType?: 'combat' | 'elite' | 'mini_boss' | 'boss';
  /** Seed for Math.random seeding (not seededRng). Default: undefined */
  seed?: number;
  /** Max turns per encounter before giving up (defeat). Default: 40 */
  maxTurnsPerEncounter?: number;
  /** Verbose logging. Default: false */
  verbose?: boolean;
  /** Amount to heal between encounters (as fraction of maxHP). Default: 0.2 */
  healBetweenEncounters?: number;
  /** Ascension level (0-20). Default: 0 */
  ascensionLevel?: number;
  /** Bot skill profile. If provided, overrides correctRate/chargeRate for BotBrain-driven play. */
  botSkills?: BotSkills;
}

/** Tracks a single card play event for per-mechanic win contribution analysis. */
export interface CardPlayRecord {
  mechanic: string;        // card.mechanicId e.g., 'strike', 'block', 'hex', 'empower'
  wasCharged: boolean;
  answeredCorrectly: boolean;
  damageDealt: number;
  wasMomentumFree: boolean;
}

export interface EncounterSummary {
  encounterIndex: number;
  floor: number;
  enemyId: string;
  enemyName: string;
  result: 'victory' | 'defeat' | 'timeout';
  turnsUsed: number;
  damageDealtTotal: number;
  damageTakenTotal: number;
  cardsPlayed: number;
  correctAnswers: number;
  wrongAnswers: number;
  maxCombo: number;
  playerHpStart: number;
  playerHpEnd: number;
  cardPlays: CardPlayRecord[];
}

export interface SimRunResult {
  runId: string;
  options: Required<Omit<SimOptions, 'botSkills'>> & { botSkills?: BotSkills };
  encounters: EncounterSummary[];
  totalTurns: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalCardsPlayed: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  floorsReached: number;
  finalHP: number;
  survived: boolean;
  ascensionLevel: number;
  durationMs: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Card Factory — builds cards using real mechanic definitions
// ──────────────────────────────────────────────────────────────────────────────

let _cardIdCounter = 0;

/** Returns all mechanics filtered by the current phase gate. */
function getActiveMechanics(): MechanicDefinition[] {
  if (ENABLE_PHASE2_MECHANICS) return MECHANIC_DEFINITIONS;
  return MECHANIC_DEFINITIONS.filter(m => m.launchPhase === 1);
}

/**
 * Creates a Card for simulation using a real MechanicDefinition.
 * No factsDB lookup needed — the simulator uses placeholder fact IDs.
 */
function makeMechanicCard(
  mechanic: MechanicDefinition,
  domain: FactDomain = 'general_knowledge',
  tier: CardTier = '1',
): Card {
  const id = `sim_card_${++_cardIdCounter}`;
  const factId = `sim_fact_${_cardIdCounter}`;

  return {
    id,
    factId,
    cardType: mechanic.type,
    domain,
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

/**
 * Finds a mechanic by ID. Throws if not found (indicates a bug in starter composition).
 */
function findMechanic(id: string): MechanicDefinition {
  const m = MECHANIC_DEFINITIONS.find(m => m.id === id);
  if (!m) throw new Error(`[Simulator] Mechanic '${id}' not found in MECHANIC_DEFINITIONS`);
  return m;
}

/**
 * Picks a random mechanic weighted similarly to runPoolBuilder:
 * 60% chance of the basic mechanic (strike/block) for attack/shield types,
 * otherwise random from the active phase pool for that type.
 */
function pickRandomMechanic(): MechanicDefinition {
  // Type distribution: ~40% attack, 25% shield, 15% utility, 10% buff, 10% debuff
  const typePool: CardType[] = [
    'attack', 'attack', 'attack',
    'shield', 'shield', 'shield',
    'utility', 'utility',
    'buff',
    'debuff', // enables poison/control builds in sim rewards
  ];
  const type = typePool[Math.floor(Math.random() * typePool.length)];

  const activeMechanics = getActiveMechanics();
  const pool = activeMechanics.filter(m => m.type === type);
  if (pool.length === 0) return findMechanic('strike'); // fallback

  // Mirror runPoolBuilder: 60% chance of basic mechanic for attack/shield
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

/**
 * Builds a starting deck pool for simulation using real mechanic definitions.
 * Starter deck matches the real game: 5 Strike, 4 Block, 1 Foresight (from STARTER_DECK_COMPOSITION).
 * Additional cards beyond the starter use weighted random mechanics (simulating card rewards).
 * Chain types are assigned round-robin from the run's selected 3 chain types.
 * Bug 5 fix: transmute cards are replaced with strike — transmute is dead weight in sim.
 */
function buildSimDeck(deckSize: number, seed: number = 0): Card[] {
  // Build the real starter deck from STARTER_DECK_COMPOSITION
  const starterCards: Card[] = [];
  for (const entry of STARTER_DECK_COMPOSITION) {
    const mechanic = findMechanic(entry.mechanicId);
    for (let i = 0; i < entry.count; i++) {
      starterCards.push(makeMechanicCard(mechanic));
    }
  }

  const cards = starterCards.slice(0, Math.min(starterCards.length, deckSize));

  // Extra cards beyond the starter size use weighted random mechanics (card rewards simulation)
  for (let i = cards.length; i < deckSize; i++) {
    const mechanic = pickRandomMechanic();
    cards.push(makeMechanicCard(mechanic));
  }

  // Bug 5: Replace any transmute cards with strike — transmute has no sim target behavior
  const strikeMechanic = findMechanic('strike');
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].mechanicId === 'transmute') {
      cards[i] = makeMechanicCard(strikeMechanic);
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
// Enemy Picker
// ──────────────────────────────────────────────────────────────────────────────

function pickRandomEnemy(
  act: 1 | 2 | 3,
  nodeType: 'combat' | 'elite' | 'mini_boss' | 'boss',
): EnemyTemplate {
  const pool = getEnemiesForNode(act, nodeType);
  if (pool.length === 0) {
    // Fallback: use the first enemy template available
    throw new Error(`No enemies found for act=${act} nodeType=${nodeType}`);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ──────────────────────────────────────────────────────────────────────────────
// Core Simulation Loop
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Bug 1 fix: returns finalPlayerHp (authoritative turnState HP) instead of
 * forcing callers to approximate via startHP - damageTaken, which misses relic
 * heals, self-damage, poison, and lethal saves.
 * Bug 3 fix: uses canaryService (createCanaryState/recordCanaryAnswer/resetCanaryFloor)
 * instead of a manual reimplementation.
 */
function simulateSingleEncounter(
  turnState: TurnState,
  opts: {
    correctRate: number;
    chargeRate: number;
    maxTurns: number;
    verbose: boolean;
    /** Optional BotBrain for intelligent play. When absent, uses legacy dumb-bot logic. */
    brain?: BotBrain;
    /** Canary state from the outer run context. Updated per-answer and returned. */
    canaryState: CanaryState;
  },
  ascMods: ReturnType<typeof getAscensionModifiers> = getAscensionModifiers(0),
): {
  result: 'victory' | 'defeat' | 'timeout';
  turnsUsed: number;
  damageDealt: number;
  damageTaken: number;
  cardsPlayed: number;
  correctAnswers: number;
  wrongAnswers: number;
  maxCombo: number;
  cardPlays: CardPlayRecord[];
  /** Bug 1: authoritative player HP from turnState at encounter end */
  finalPlayerHp: number;
  /** Bug 3: updated Canary state after this encounter (for carry-over to next floor) */
  canaryState: CanaryState;
} {
  let turnsUsed = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let cardsPlayed = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let maxCombo = 0;
  const cardPlays: CardPlayRecord[] = [];

  const { verbose, correctRate, chargeRate, maxTurns, brain } = opts;
  // Bug 3: use proper Canary state (passed in from outer context, reset per floor by caller)
  let canaryState = opts.canaryState;

  while (turnsUsed < maxTurns) {
    // ── Player turn: play all cards in hand ────────────────────────────────
    let safetyBreak = 0;
    const handCardsBefore = new Set(turnState.deck.hand.map(c => c.id));

    if (brain) {
      // ── BotBrain-driven play loop ──────────────────────────────────────
      // Re-plan each iteration because playCardAction can change the hand
      // (cards consumed, new cards drawn by utility cards, etc.)
      // Bug 4: track blocked cards within this turn so we continue trying others
      const blockedCardIds = new Set<string>();

      while (!isHandEmpty(turnState) && turnState.result === null) {
        if (safetyBreak++ > 200) break;

        const hand = turnState.deck.hand;
        if (hand.length === 0) break;

        const plan = brain.planTurn(hand, turnState, { freeCharging: ascMods.freeCharging });
        if (plan.length === 0) break;

        // Execute only the FIRST valid play, then re-plan with updated hand
        let played = false;
        for (const play of plan) {
          // Re-check hand — cards may have been removed by previous effects
          const card = turnState.deck.hand.find(c => c.id === play.cardId);
          if (!card) continue;

          // Bug 4: skip cards that were blocked this turn (AP exhausted for that card)
          if (blockedCardIds.has(card.id)) continue;

          const apCost = card.apCost ?? 1;
          // AP surcharge check — must mirror real playCardAction() logic for momentum/surge/warcry
          let chargeSurcharge = CHARGE_AP_SURCHARGE;
          if (play.mode === 'charge') {
            // Chain momentum: correct Charge on chain X → next Charge on chain X is free
            if (turnState.nextChargeFreeForChainType !== null
                && card.chainType === turnState.nextChargeFreeForChainType) {
              chargeSurcharge = 0;
            }
            // NOTE: Surge turns no longer waive surcharge — they grant +1 AP at turn-start instead.
            // Warcry free charge
            else if (turnState.warcryFreeChargeActive) {
              chargeSurcharge = 0;
            }
          }
          const totalCost = play.mode === 'charge' ? apCost + chargeSurcharge : apCost;
          if (turnState.apCurrent < totalCost) continue;

          const answeredCorrectly = Math.random() < brain.skills.accuracy;
          const speedBonus = answeredCorrectly && Math.random() < 0.5;

          // Bug 3: update Canary state per answer, then apply damage multiplier to turn state
          canaryState = recordCanaryAnswer(canaryState, answeredCorrectly);
          turnState.canaryEnemyDamageMultiplier = canaryState.enemyDamageMultiplier;

          const res = playCardAction(turnState, card.id, answeredCorrectly, speedBonus, play.mode);

          // Bug 4: on blocked, record the card as blocked this turn and try the next card
          if (res.blocked && !res.fizzled) {
            blockedCardIds.add(card.id);
            continue;
          }

          turnState = res.turnState;
          cardsPlayed++;
          played = true;

          cardPlays.push({
            mechanic: card.mechanicId ?? card.cardType,
            wasCharged: play.mode === 'charge',
            answeredCorrectly,
            damageDealt: res.effect.damageDealt ?? 0,
            wasMomentumFree: play.mode === 'charge' && chargeSurcharge === 0 && CHARGE_AP_SURCHARGE > 0,
          });

          if (answeredCorrectly) {
            correctAnswers++;
            if (ascMods.correctAnswerHeal > 0) {
              turnState.playerState.hp = Math.min(
                turnState.playerState.hp + ascMods.correctAnswerHeal,
                turnState.playerState.maxHp,
              );
            }
          } else {
            wrongAnswers++;
          }

          if (ascMods.comboHealThreshold > 0 && res.comboCount >= ascMods.comboHealThreshold && res.comboCount === ascMods.comboHealThreshold) {
            turnState.playerState.hp = Math.min(
              turnState.playerState.hp + ascMods.comboHealAmount,
              turnState.playerState.maxHp,
            );
          }

          if (res.effect.damageDealt > 0) damageDealt += res.effect.damageDealt;
          if (res.comboCount > maxCombo) maxCombo = res.comboCount;

          if (verbose) {
            const hp = turnState.playerState.hp;
            const eHP = turnState.enemy.currentHP;
            console.log(
              `  [T${turnsUsed + 1}] card=${card.mechanicId ?? card.cardType} correct=${answeredCorrectly} ` +
              `mode=${play.mode} dmg=${res.effect.damageDealt} ap=${turnState.apCurrent} combo=${res.comboCount} ` +
              `playerHP=${hp} enemyHP=${eHP}`
            );
          }

          const midCheckResult = checkEncounterEnd(turnState);
          if (midCheckResult !== null) {
            return {
              result: midCheckResult, turnsUsed: turnsUsed + 1,
              damageDealt, damageTaken, cardsPlayed, correctAnswers, wrongAnswers, maxCombo, cardPlays,
              finalPlayerHp: turnState.playerState.hp,
              canaryState,
            };
          }

          break; // Only execute first valid play, then re-plan
        }

        if (!played) break;
      }
    } else {
      // ── Legacy dumb-bot play loop (unchanged for backward compatibility) ──
      while (!isHandEmpty(turnState) && turnState.result === null) {
        if (safetyBreak++ > 200) break; // absolute safety guard

        const hand = turnState.deck.hand;
        if (hand.length === 0) break;

        // AP check: if no card in hand can be played with remaining AP, end turn
        const minCardCost = hand.reduce((min, c) => Math.min(min, c.apCost ?? 1), Infinity);
        const minPlayCost = minCardCost;
        const minQuickCost = minCardCost;
        if (turnState.apCurrent < Math.min(minPlayCost, minQuickCost)) break;

        // Pick first card in hand (simple strategy — no AI needed)
        const card = hand[0];
        const cardMinCost = card.apCost ?? 1;

        // Decide play mode based on available AP
        // Surge turns grant +1 AP at turn-start; no waiver here. Surcharge always applies.
        const chargeSurcharge = CHARGE_AP_SURCHARGE;
        const chargeApCost = cardMinCost + chargeSurcharge;
        const canCharge = turnState.apCurrent >= chargeApCost;
        const isCharge = canCharge && Math.random() < chargeRate;

        // Skip this card if even quick play can't be afforded
        if (turnState.apCurrent < cardMinCost) {
          // Move to next card if hand has more
          if (hand.length <= 1) break;
          // Rotate: move hand[0] to end
          const rotated = hand.shift()!;
          hand.push(rotated);
          continue;
        }

        const answeredCorrectly = Math.random() < correctRate;
        const speedBonus = answeredCorrectly && Math.random() < 0.5;

        // Bug 3: update Canary state per answer, then apply damage multiplier to turn state
        canaryState = recordCanaryAnswer(canaryState, answeredCorrectly);
        turnState.canaryEnemyDamageMultiplier = canaryState.enemyDamageMultiplier;

        const res = playCardAction(
          turnState,
          card.id,
          answeredCorrectly,
          speedBonus,
          isCharge ? 'charge' : 'quick',
        );

        // Bug 4: If the card was blocked, rotate to try next card instead of ending turn entirely
        if (res.blocked && !res.fizzled) {
          if (hand.length <= 1) break;
          const rotated = hand.shift()!;
          hand.push(rotated);
          continue;
        }

        turnState = res.turnState;
        cardsPlayed++;

        // Record this card play for per-mechanic analysis
        cardPlays.push({
          mechanic: card.mechanicId ?? card.cardType,
          wasCharged: isCharge,
          answeredCorrectly,
          damageDealt: res.effect.damageDealt ?? 0,
          wasMomentumFree: false, // quick plays are never momentum-free in sim
        });

        if (answeredCorrectly) {
          correctAnswers++;
          // A17 buff: correct answers heal 1 HP
          if (ascMods.correctAnswerHeal > 0) {
            turnState.playerState.hp = Math.min(
              turnState.playerState.hp + ascMods.correctAnswerHeal,
              turnState.playerState.maxHp,
            );
          }
        } else {
          wrongAnswers++;
        }

        // A6 buff: heal on combo threshold
        if (ascMods.comboHealThreshold > 0 && res.comboCount >= ascMods.comboHealThreshold && res.comboCount === ascMods.comboHealThreshold) {
          turnState.playerState.hp = Math.min(
            turnState.playerState.hp + ascMods.comboHealAmount,
            turnState.playerState.maxHp,
          );
        }

        if (res.effect.damageDealt > 0) {
          damageDealt += res.effect.damageDealt;
        }

        if (res.comboCount > maxCombo) {
          maxCombo = res.comboCount;
        }

        if (verbose) {
          const hp = turnState.playerState.hp;
          const eHP = turnState.enemy.currentHP;
          console.log(
            `  [T${turnsUsed + 1}] card=${card.mechanicId ?? card.cardType} correct=${answeredCorrectly} ` +
            `mode=${isCharge ? 'charge' : 'quick'} ` +
            `dmg=${res.effect.damageDealt} ap=${turnState.apCurrent} combo=${res.comboCount} ` +
            `playerHP=${hp} enemyHP=${eHP}`
          );
        }

        // Check encounter end after each card
        const midCheckResult = checkEncounterEnd(turnState);
        if (midCheckResult !== null) {
          return {
            result: midCheckResult,
            turnsUsed: turnsUsed + 1,
            damageDealt,
            damageTaken,
            cardsPlayed,
            correctAnswers,
            wrongAnswers,
            maxCombo,
            cardPlays,
            finalPlayerHp: turnState.playerState.hp,
            canaryState,
          };
        }
      }
    }
    void handCardsBefore; // suppress unused warning

    // ── Canary: apply latest multiplier before endPlayerTurn ──────────────
    // Bug 3: canaryState is already up-to-date from per-answer tracking above
    turnState.canaryEnemyDamageMultiplier = canaryState.enemyDamageMultiplier;

    // ── End player turn → enemy attacks ───────────────────────────────────
    const enemyResult = endPlayerTurn(turnState);
    turnState = enemyResult.turnState;
    turnsUsed++;

    damageTaken += enemyResult.damageDealt;

    // A9 challenge: enemy regenerates HP each turn
    if (ascMods.enemyRegenPerTurn > 0 && turnState.enemy.currentHP > 0) {
      turnState.enemy.currentHP = Math.min(
        turnState.enemy.currentHP + ascMods.enemyRegenPerTurn,
        turnState.enemy.maxHP,
      );
    }

    if (verbose) {
      console.log(
        `  [T${turnsUsed}] ENEMY attacks: dmg=${enemyResult.damageDealt} ` +
        `playerDefeated=${enemyResult.playerDefeated} ` +
        `playerHP=${turnState.playerState.hp}`
      );
    }

    // Check encounter end after enemy turn
    const afterEnemyResult = checkEncounterEnd(turnState);
    if (afterEnemyResult !== null) {
      return {
        result: afterEnemyResult,
        turnsUsed,
        damageDealt,
        damageTaken,
        cardsPlayed,
        correctAnswers,
        wrongAnswers,
        maxCombo,
        cardPlays,
        finalPlayerHp: turnState.playerState.hp,
        canaryState,
      };
    }
  }

  return {
    result: 'timeout',
    turnsUsed,
    damageDealt,
    damageTaken,
    cardsPlayed,
    correctAnswers,
    wrongAnswers,
    maxCombo,
    cardPlays,
    finalPlayerHp: turnState.playerState.hp,
    canaryState,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Runs a full headless simulation run.
 *
 * @param opts - Simulation options. All fields have sensible defaults.
 * @returns A summary of all encounters and aggregate statistics.
 */
export function runSimulation(opts: SimOptions = {}): SimRunResult {
  const startTime = Date.now();

  const options: Required<Omit<SimOptions, 'botSkills'>> & { botSkills?: BotSkills } = {
    encounterCount: opts.encounterCount ?? 10,
    correctRate: opts.correctRate ?? 0.75,
    chargeRate: opts.chargeRate ?? 0.7,
    deckSize: opts.deckSize ?? 15,
    act: opts.act ?? 1,
    nodeType: opts.nodeType ?? 'combat',
    seed: opts.seed ?? Math.floor(Math.random() * 1_000_000),
    maxTurnsPerEncounter: opts.maxTurnsPerEncounter ?? 40,
    verbose: opts.verbose ?? false,
    healBetweenEncounters: opts.healBetweenEncounters ?? POST_ENCOUNTER_HEAL_PCT,
    ascensionLevel: opts.ascensionLevel ?? 0,
    botSkills: opts.botSkills,
  };

  // Compute ascension modifiers once for the entire run
  const ascMods = getAscensionModifiers(options.ascensionLevel);

  const runId = `sim_${options.seed}_${Date.now()}`;

  // Create BotBrain if botSkills provided — used for intelligent encounter play
  const brain = options.botSkills ? new BotBrain(options.botSkills) : undefined;

  // Build deck once; it persists across encounters (roguelite model)
  const effectiveDeckSize = ascMods.starterDeckSizeOverride ?? options.deckSize;
  const cardPool = buildSimDeck(effectiveDeckSize, options.seed);
  const deck = createDeck(cardPool);

  // Track cross-encounter state
  let currentPlayerHP = PLAYER_START_HP;
  const playerMaxHP = ascMods.playerMaxHpOverride ?? PLAYER_MAX_HP;

  // Build relic set — starter relics from ascension + relics earned during run
  // In a real game, players pick relics at bosses/shops. We simulate by:
  // 1. Giving starter relics based on ascension level
  // 2. Adding a random relic every ~4 encounters (simulating boss/shop drops)
  const runRelicIds = new Set<string>();
  const availableRelics = [...STARTER_RELIC_IDS];
  // Pick starter relics
  for (let r = 0; r < ascMods.startingRelicCount && availableRelics.length > 0; r++) {
    const idx = Math.floor(Math.random() * availableRelics.length);
    runRelicIds.add(availableRelics[idx]);
    availableRelics.splice(idx, 1);
  }

  // Bug 3: Canary state persists across encounters, resets wrongs-per-floor each encounter
  let canaryState: CanaryState = createCanaryState();

  const encounterSummaries: EncounterSummary[] = [];
  let totalTurns = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let totalCardsPlayed = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let survived = true;

  for (let i = 0; i < options.encounterCount; i++) {
    const floor = i + 1;
    deck.currentFloor = floor;
    deck.currentEncounter = i;
    deck.playerHP = currentPlayerHP;
    deck.playerMaxHP = playerMaxHP;
    deck.playerShield = 0;

    // Pick enemy for this encounter
    let enemyTemplate: EnemyTemplate;
    try {
      enemyTemplate = pickRandomEnemy(options.act, options.nodeType);
    } catch (err) {
      console.error(`[Simulator] Failed to pick enemy: ${(err as Error).message}`);
      break;
    }

    const isBossLike = options.nodeType === 'boss' || options.nodeType === 'elite';

    // Bug 3: Canary HP multiplier modulates enemy HP per-encounter
    canaryState = resetCanaryFloor(canaryState);
    const enemy = createEnemy(enemyTemplate, floor, {
      hpMultiplier: ascMods.enemyHpMultiplier * canaryState.enemyHpMultiplier * (isBossLike ? ascMods.bossHpMultiplier : 1),
    });

    if (options.verbose) {
      console.log(`\n=== Encounter ${i + 1}/${options.encounterCount}: ${enemyTemplate.name} (floor ${floor}) ===`);
      console.log(`  Enemy HP: ${enemy.maxHP}, Player HP: ${currentPlayerHP}`);
    }

    // Start encounter — draws initial hand
    const initialTurnState = startEncounter(deck, enemy, currentPlayerHP);

    // Apply ascension challenge modifiers to turn state
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

    // Set active relics on the turn state (relicEffectResolver reads these)
    initialTurnState.activeRelicIds = new Set(runRelicIds);

    // Bug 3: apply initial Canary damage multiplier before the encounter starts
    initialTurnState.canaryEnemyDamageMultiplier = canaryState.enemyDamageMultiplier;

    // Simulate relic drops: add a random relic every 4 encounters (boss/shop simulation)
    if (i > 0 && i % 4 === 0 && availableRelics.length > 0) {
      const dropIdx = Math.floor(Math.random() * availableRelics.length);
      runRelicIds.add(availableRelics[dropIdx]);
      availableRelics.splice(dropIdx, 1);
    }

    // Apply ascension BUFF modifiers
    // A2: +1 AP on first turn
    if (ascMods.firstTurnBonusAp > 0) {
      initialTurnState.apCurrent += ascMods.firstTurnBonusAp;
    }
    // A9: Start encounter with shield
    if (ascMods.encounterStartShield > 0) {
      initialTurnState.playerState.shield += ascMods.encounterStartShield;
    }

    const encounterResult = simulateSingleEncounter(initialTurnState, {
      correctRate: options.botSkills?.accuracy ?? options.correctRate,
      chargeRate: options.chargeRate,
      maxTurns: options.maxTurnsPerEncounter,
      verbose: options.verbose,
      brain,
      canaryState,
    }, ascMods);

    // Bug 1: use authoritative HP from turnState instead of approximating via damageTaken
    currentPlayerHP = encounterResult.finalPlayerHp;
    // Bug 3: carry Canary state forward across encounters (streak persists, wrongs reset per floor)
    canaryState = encounterResult.canaryState;

    const summary: EncounterSummary = {
      encounterIndex: i,
      floor,
      enemyId: enemyTemplate.id,
      enemyName: enemyTemplate.name,
      result: encounterResult.result,
      turnsUsed: encounterResult.turnsUsed,
      damageDealtTotal: encounterResult.damageDealt,
      damageTakenTotal: encounterResult.damageTaken,
      cardsPlayed: encounterResult.cardsPlayed,
      correctAnswers: encounterResult.correctAnswers,
      wrongAnswers: encounterResult.wrongAnswers,
      maxCombo: encounterResult.maxCombo,
      playerHpStart: deck.playerHP,
      playerHpEnd: currentPlayerHP,
      cardPlays: encounterResult.cardPlays,
    };

    encounterSummaries.push(summary);
    totalTurns += encounterResult.turnsUsed;
    totalDamageDealt += encounterResult.damageDealt;
    totalDamageTaken += encounterResult.damageTaken;
    totalCardsPlayed += encounterResult.cardsPlayed;
    totalCorrect += encounterResult.correctAnswers;
    totalWrong += encounterResult.wrongAnswers;

    if (options.verbose) {
      console.log(
        `  Result: ${encounterResult.result.toUpperCase()} | ` +
        `Turns: ${encounterResult.turnsUsed} | ` +
        `DmgDealt: ${encounterResult.damageDealt} | ` +
        `DmgTaken: ${encounterResult.damageTaken} | ` +
        `PlayerHP: ${currentPlayerHP}`
      );
    }

    // Check for run-ending defeat
    if (encounterResult.result === 'defeat' || currentPlayerHP <= 0) {
      survived = false;
      currentPlayerHP = 0;
      if (options.verbose) console.log(`\n=== RUN ENDED: DEFEAT on encounter ${i + 1} ===`);
      break;
    }

    // Heal between encounters
    if (i < options.encounterCount - 1) {
      const healAmount = Math.floor(playerMaxHP * options.healBetweenEncounters);
      currentPlayerHP = Math.min(playerMaxHP, currentPlayerHP + healAmount);
      if (options.verbose) console.log(`  Healed ${healAmount} HP -> ${currentPlayerHP}`);
    }
  }

  const totalAnswered = totalCorrect + totalWrong;

  return {
    runId,
    options,
    encounters: encounterSummaries,
    totalTurns,
    totalDamageDealt,
    totalDamageTaken,
    totalCardsPlayed,
    totalCorrect,
    totalWrong,
    accuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
    floorsReached: encounterSummaries.length,
    finalHP: currentPlayerHP,
    survived,
    ascensionLevel: options.ascensionLevel,
    durationMs: Date.now() - startTime,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────────────────

/** Print a formatted run result summary */
function printRunSummary(result: SimRunResult): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  RUN SUMMARY  [${result.runId}]`);
  console.log('═'.repeat(60));
  console.log(`  Floors reached:    ${result.floorsReached}/${result.options.encounterCount}`);
  console.log(`  Survived:          ${result.survived ? 'YES' : 'NO'}`);
  console.log(`  Final HP:          ${result.finalHP}/${PLAYER_MAX_HP}`);
  console.log(`  Total turns:       ${result.totalTurns}`);
  console.log(`  Cards played:      ${result.totalCardsPlayed}`);
  console.log(`  Accuracy:          ${(result.accuracy * 100).toFixed(1)}%  (${result.totalCorrect}/${result.totalCorrect + result.totalWrong})`);
  console.log(`  Damage dealt:      ${result.totalDamageDealt}`);
  console.log(`  Damage taken:      ${result.totalDamageTaken}`);
  console.log(`  Duration:          ${result.durationMs}ms`);
  console.log('─'.repeat(60));
  console.log(`  Encounter breakdown:`);
  for (const enc of result.encounters) {
    const icon = enc.result === 'victory' ? '✓' : enc.result === 'defeat' ? '✗' : '⊘';
    console.log(
      `    ${icon} [${enc.floor.toString().padStart(2)}] ${enc.enemyName.padEnd(25)} ` +
      `${enc.result.padEnd(8)} T=${enc.turnsUsed.toString().padStart(2)} ` +
      `Dmg=${enc.damageDealtTotal.toString().padStart(4)} ` +
      `Taken=${enc.damageTakenTotal.toString().padStart(3)} ` +
      `HP:${enc.playerHpStart}→${enc.playerHpEnd}`
    );
  }
  console.log('═'.repeat(60));
}

// Run from CLI
if (process.argv[1] && process.argv[1].includes('simulator')) {
  console.log('Headless Combat Simulator — starting...\n');

  // Parse basic CLI args
  const args = process.argv.slice(2);
  const getArg = (key: string, defaultVal: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
  };

  const opts: SimOptions = {
    encounterCount: parseInt(getArg('encounters', '10')),
    correctRate: parseFloat(getArg('correct-rate', '0.75')),
    chargeRate: parseFloat(getArg('charge-rate', '0.7')),
    deckSize: parseInt(getArg('deck-size', '15')),
    act: parseInt(getArg('act', '1')) as 1 | 2 | 3,
    nodeType: getArg('node-type', 'combat') as 'combat' | 'elite',
    maxTurnsPerEncounter: parseInt(getArg('max-turns', '40')),
    verbose: args.includes('--verbose') || args.includes('-v'),
    healBetweenEncounters: parseFloat(getArg('heal-rate', String(POST_ENCOUNTER_HEAL_PCT))),
    ascensionLevel: parseInt(getArg('ascension', '0')),
  };

  console.log('Options:', opts);

  const result = runSimulation(opts);
  printRunSummary(result);

  // Exit 0 on survived, 1 on defeated run (for scripting)
  process.exit(result.survived ? 0 : 1);
}
