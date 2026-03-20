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
import { PLAYER_START_HP, PLAYER_MAX_HP, POST_ENCOUNTER_HEAL_PCT } from '../../../src/data/balance.js';
import { getAscensionModifiers } from '../../../src/services/ascension.js';
import { STARTER_RELIC_IDS } from '../../../src/data/relics/index.js';

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
}

export interface SimRunResult {
  runId: string;
  options: Required<SimOptions>;
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
// Card Factory — builds synthetic cards without factsDB
// ──────────────────────────────────────────────────────────────────────────────

let _cardIdCounter = 0;

/**
 * Creates a synthetic Card for simulation purposes.
 * No factsDB lookup needed — the simulator uses placeholder fact IDs.
 */
function makeSyntheticCard(
  cardType: CardType,
  domain: FactDomain = 'general_knowledge',
  tier: CardTier = '1',
): Card {
  const id = `sim_card_${++_cardIdCounter}`;
  const factId = `sim_fact_${_cardIdCounter}`;

  // Base effect values that match rough game balance
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
  };
}

/**
 * Builds a starting deck pool for simulation.
 * Distribution: ~40% attack, 25% shield, 15% utility, 10% buff, 10% debuff.
 */
function buildSimDeck(deckSize: number): Card[] {
  const distribution: CardType[] = [
    'attack', 'attack', 'attack', 'attack',  // 4/10
    'shield', 'shield', 'shield',              // 3/10
    'utility', 'utility',                       // 2/10
    'buff',                                     // 1/10
  ];

  const cards: Card[] = [];
  for (let i = 0; i < deckSize; i++) {
    const cardType = distribution[i % distribution.length];
    cards.push(makeSyntheticCard(cardType));
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

function simulateSingleEncounter(
  turnState: TurnState,
  opts: {
    correctRate: number;
    chargeRate: number;
    maxTurns: number;
    verbose: boolean;
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
} {
  let turnsUsed = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let cardsPlayed = 0;
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let maxCombo = 0;

  const { verbose, correctRate, chargeRate, maxTurns } = opts;

  while (turnsUsed < maxTurns) {
    // ── Player turn: play all cards in hand ────────────────────────────────
    let safetyBreak = 0;
    const handCardsBefore = new Set(turnState.deck.hand.map(c => c.id));
    while (!isHandEmpty(turnState) && turnState.result === null) {
      if (safetyBreak++ > 200) break; // absolute safety guard

      const hand = turnState.deck.hand;
      if (hand.length === 0) break;

      // AP check: if no card in hand can be played with remaining AP, end turn
      const minCardCost = hand.reduce((min, c) => Math.min(min, c.apCost ?? 1), Infinity);
      const minPlayCost = minCardCost + (chargeRate > 0 ? 1 : 0); // +1 for charge surcharge
      const minQuickCost = minCardCost; // quick play has no surcharge
      if (turnState.apCurrent < Math.min(minPlayCost, minQuickCost)) break;

      // Pick first card in hand (simple strategy — no AI needed)
      const card = hand[0];
      const cardMinCost = card.apCost ?? 1;

      // Decide play mode based on available AP
      // A19 buff: free charging (no +1 AP surcharge)
      const chargeSurcharge = ascMods.freeCharging ? 0 : 1;
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

      const res = playCardAction(
        turnState,
        card.id,
        answeredCorrectly,
        speedBonus,
        isCharge ? 'charge' : 'quick',
      );

      // If the card was blocked (returned from hand unchanged), AP is exhausted
      if (res.blocked && !res.fizzled) {
        break; // AP exhausted, end player turn
      }

      turnState = res.turnState;
      cardsPlayed++;

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
          `  [T${turnsUsed + 1}] card=${card.cardType} correct=${answeredCorrectly} ` +
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
        };
      }
    }
    void handCardsBefore; // suppress unused warning

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

  const options: Required<SimOptions> = {
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
  };

  // Compute ascension modifiers once for the entire run
  const ascMods = getAscensionModifiers(options.ascensionLevel);

  const runId = `sim_${options.seed}_${Date.now()}`;

  // Build deck once; it persists across encounters (roguelite model)
  const effectiveDeckSize = ascMods.starterDeckSizeOverride ?? options.deckSize;
  const cardPool = buildSimDeck(effectiveDeckSize);
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
    const enemy = createEnemy(enemyTemplate, floor, {
      hpMultiplier: ascMods.enemyHpMultiplier * (isBossLike ? ascMods.bossHpMultiplier : 1),
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
      correctRate: options.correctRate,
      chargeRate: options.chargeRate,
      maxTurns: options.maxTurnsPerEncounter,
      verbose: options.verbose,
    }, ascMods);

    // Update persistent HP from the last known turn state (approximation)
    // The turnState's playerState.hp is the authoritative source after the encounter
    const finalHpThisEncounter = Math.max(0, currentPlayerHP - encounterResult.damageTaken);
    currentPlayerHP = finalHpThisEncounter;

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
