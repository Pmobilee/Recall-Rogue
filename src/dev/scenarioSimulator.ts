/**
 * Scenario Simulator — registers window.__terraScenario in dev mode.
 * Lets developers instantly jump to specific game states for visual testing.
 *
 * Usage (browser console):
 *   __terraScenario.list()                    // List all available scenarios
 *   __terraScenario.load('combat-boss')       // Load a named scenario
 *   __terraScenario.loadCustom({ ... })       // Load a custom config
 *   __terraScenario.help()                    // Print full reference
 *
 * Mid-combat state overrides (callable any time during combat):
 *   __terraScenario.setPlayerHp(50)
 *   __terraScenario.setEnemyHp(1)
 *   __terraScenario.setPlayerBlock(10)
 *   __terraScenario.setEnemyBlock(5)
 *   __terraScenario.setGold(999)
 *   __terraScenario.forceHand(['heavy_strike', 'strike', 'block'])
 *   __terraScenario.addRelic('whetstone')
 *   __terraScenario.setFloor(5)
 *
 * DEV MODE ONLY — never included in production builds.
 */

import { get } from 'svelte/store';
import { readStore } from './storeBridge';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { RELIC_BY_ID } from '../data/relics/index';
import { MECHANIC_BY_ID } from '../data/mechanics';
import { factsDB } from '../services/factsDB';
import { markOnboardingComplete, markOnboardingTooltipSeen } from '../services/cardPreferences';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioConfig {
  /** Target screen to navigate to after setup. */
  screen: string;
  /** Enemy template ID (e.g. 'page_flutter', 'algorithm'). */
  enemy?: string;
  /** Override enemy HP after spawn. */
  enemyHp?: number;
  /** Override player HP (default 100). */
  playerHp?: number;
  /** Override player max HP. */
  playerMaxHp?: number;
  /** Mechanic IDs for the hand (e.g. ['strike', 'block', 'heavy_strike']). */
  hand?: string[];
  /** Override hand size (overrides hand[] count). */
  handSize?: number;
  /** Relic IDs to equip on the run. */
  relics?: string[];
  /** Starting gold. */
  gold?: number;
  /** Floor number. */
  floor?: number;
  /** Primary knowledge domain. */
  domain?: string;
  /** Chain type indices for hand cards (0-5). Applies in order to hand cards. */
  chainTypes?: number[];
  /** Reward room: explicit reward items. If not provided, generates random rewards. */
  rewards?: Array<
    | { type: 'gold'; amount: number }
    | { type: 'health_vial'; size?: 'small' | 'large'; healAmount?: number }
    | { type: 'card'; mechanicId: string; upgraded?: boolean }
    | { type: 'relic'; relicId: string }
  >;
  /** Shop: explicit relic IDs to stock. */
  shopRelics?: string[];
  /** Shop: explicit card mechanic IDs to stock. */
  shopCards?: string[];
  /** Mystery event: specific event ID to show. */
  mysteryEventId?: string;
  /** Card reward: specific mechanic IDs for the 3 card choices. */
  cardRewardMechanics?: string[];
  /** Run end: result type. */
  runEndResult?: 'victory' | 'defeat' | 'retreat';
  /** Run end: override stats. */
  runEndStats?: Partial<{
    floorReached: number;
    factsAnswered: number;
    correctAnswers: number;
    accuracy: number;
    bestCombo: number;
    cardsEarned: number;
    encountersWon: number;
    elitesDefeated: number;
    bossesDefeated: number;
    currencyEarned: number;
    relicsCollected: number;
  }>;
  /** Ascension level for the run. */
  ascension?: number;
  /** Study quiz: number of questions to generate (default 3). */
  quizQuestionCount?: number;
  /** Mastery challenge: question text. */
  masteryChallengeQuestion?: string;
  /** Mastery challenge: correct answer. */
  masteryChallengeAnswer?: string;
  /** Mastery challenge: wrong answers. */
  masteryChallengeDistractors?: string[];
  /** Mastery challenge: timer seconds (default 10). */
  masteryChallengeTimer?: number;
  /** Player block amount (combat). */
  playerBlock?: number;
  /** Enemy block amount (combat). */
  enemyBlock?: number;
  /** Status effects on enemy (combat). */
  enemyStatusEffects?: Array<{ id: string; stacks: number }>;
  /** Turn number override (combat). */
  turn?: number;
}

interface ScenarioResult {
  ok: boolean;
  message: string;
  state?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Pre-built scenario presets
// ---------------------------------------------------------------------------

const SCENARIOS: Record<string, ScenarioConfig> = {
  // === Combat scenarios ===
  'combat-basic': {
    screen: 'combat',
    enemy: 'page_flutter',
    hand: ['strike', 'strike', 'strike', 'block', 'block'],
  },
  'combat-10-cards': {
    screen: 'combat',
    enemy: 'thesis_construct',
    handSize: 10,
  },
  'combat-boss': {
    screen: 'combat',
    enemy: 'algorithm',
    playerHp: 50,
    hand: ['heavy_strike', 'strike', 'block', 'lifetap', 'expose'],
    relics: ['whetstone', 'iron_shield', 'swift_boots'],
  },
  'combat-scholar': {
    screen: 'combat',
    enemy: 'omnibus',
    handSize: 10,
    relics: ['resonance_crystal'],
  },
  'combat-all-chains': {
    screen: 'combat',
    enemy: 'page_flutter',
    hand: ['strike', 'strike', 'block', 'block', 'strike'],
    chainTypes: [0, 1, 2, 3, 4],
  },
  'combat-low-hp': {
    screen: 'combat',
    enemy: 'page_flutter',
    playerHp: 10,
    playerMaxHp: 100,
    hand: ['strike', 'block', 'heavy_strike', 'strike', 'block'],
  },
  'combat-elite': {
    screen: 'combat',
    enemy: 'final_lesson',
    playerHp: 80,
    relics: ['whetstone', 'iron_shield'],
    hand: ['heavy_strike', 'strike', 'multi_hit', 'block', 'lifetap'],
  },
  'combat-mini-boss': {
    screen: 'combat',
    enemy: 'peer_reviewer',
    playerHp: 60,
    hand: ['heavy_strike', 'strike', 'block', 'expose', 'reckless'],
    relics: ['whetstone'],
  },
  'combat-relic-heavy': {
    screen: 'combat',
    enemy: 'page_flutter',
    relics: ['whetstone', 'iron_shield', 'vitality_ring', 'resonance_crystal'],
    hand: ['strike', 'strike', 'block', 'heavy_strike', 'multi_hit'],
  },
  'combat-big-hand': {
    screen: 'combat',
    enemy: 'page_flutter',
    handSize: 8,
    relics: ['scavengers_eye'],
  },

  // === Room / navigation scenarios ===
  'reward-room': {
    screen: 'rewardRoom',
  },
  'shop': {
    screen: 'shopRoom',
    gold: 500,
  },
  'rest-site': {
    screen: 'restRoom',
  },
  'card-reward': {
    screen: 'cardReward',
    cardRewardMechanics: ['strike', 'block', 'heavy_strike'],
  },
  'dungeon-map': {
    screen: 'dungeonMap',
  },
  'retreat-or-delve': {
    screen: 'retreatOrDelve',
    gold: 200,
    floor: 3,
  },

  // === Reward room scenarios ===
  'reward-gold-and-cards': {
    screen: 'rewardRoom',
    rewards: [
      { type: 'gold', amount: 50 },
      { type: 'card', mechanicId: 'heavy_strike', upgraded: true },
      { type: 'card', mechanicId: 'block' },
      { type: 'health_vial', size: 'large', healAmount: 30 },
    ],
  },
  'reward-relic': {
    screen: 'rewardRoom',
    rewards: [
      { type: 'gold', amount: 30 },
      { type: 'relic', relicId: 'whetstone' },
      { type: 'card', mechanicId: 'reckless' },
    ],
  },

  // === Shop scenarios ===
  'shop-loaded': {
    screen: 'shopRoom',
    gold: 1000,
    shopRelics: ['whetstone', 'iron_shield'],
    shopCards: ['heavy_strike', 'lifetap', 'reckless', 'multi_hit'],
  },

  // === Mystery event ===
  'mystery-event': {
    screen: 'mysteryEvent',
    floor: 3,
  },

  // === Card reward scenarios ===
  'card-reward-attacks': {
    screen: 'cardReward',
    cardRewardMechanics: ['heavy_strike', 'multi_hit', 'lifetap'],
  },
  'card-reward-mixed': {
    screen: 'cardReward',
    cardRewardMechanics: ['strike', 'block', 'expose'],
  },

  // === Run end scenarios ===
  'run-end-victory': {
    screen: 'runEnd',
    runEndResult: 'victory',
    floor: 10,
    runEndStats: { floorReached: 10, accuracy: 92, bestCombo: 12, encountersWon: 15, bossesDefeated: 2, currencyEarned: 500, relicsCollected: 5 },
  },
  'run-end-defeat': {
    screen: 'runEnd',
    runEndResult: 'defeat',
    floor: 4,
    runEndStats: { floorReached: 4, accuracy: 65, bestCombo: 3, encountersWon: 5, currencyEarned: 80 },
  },
  'run-end-retreat': {
    screen: 'runEnd',
    runEndResult: 'retreat',
    floor: 6,
    runEndStats: { floorReached: 6, accuracy: 78, bestCombo: 8, encountersWon: 9, currencyEarned: 200 },
  },

  // === More combat presets ===
  'combat-near-death': {
    screen: 'combat',
    enemy: 'page_flutter',
    playerHp: 3,
    playerMaxHp: 100,
    hand: ['lifetap', 'block', 'strike', 'heavy_strike', 'block'],
  },
  // === Hub scenarios ===
  'hub-endgame': {
    screen: 'hub',
    relics: ['whetstone', 'iron_shield', 'swift_boots', 'insight_prism'],
    gold: 5000,
  },
  'hub-fresh': {
    screen: 'hub',
    gold: 0,
  },

  // === Screen navigation scenarios ===
  'onboarding': {
    screen: 'onboarding',
  },
'archetype-selection': {
    screen: 'archetypeSelection',
  },
  'relic-sanctum': {
    screen: 'relicSanctum',
  },
  'library': {
    screen: 'library',
  },
  'profile': {
    screen: 'profile',
  },
  'journal': {
    screen: 'journal',
  },
  'settings': {
    screen: 'settings',
  },
  'study-quiz': {
    screen: 'restStudy',
  },
  'mastery-challenge': {
    screen: 'masteryChallenge',
  },
  'dungeon-selection': {
    screen: 'deckSelectionHub',
  },

  // Mystery event by ID examples
  'mystery-healing-fountain': {
    screen: 'mysteryEvent',
    mysteryEventId: 'healing_fountain',
  },
  'mystery-gamblers-tome': {
    screen: 'mysteryEvent',
    mysteryEventId: 'gamblers_tome',
    floor: 4,
  },
  'mystery-final-wager': {
    screen: 'mysteryEvent',
    mysteryEventId: 'final_wager',
    floor: 10,
  },

  // === Special event (post-boss) ===
  'special-event': {
    screen: 'specialEvent',
    floor: 10,
  },

  // === Relic swap overlay ===
  // Run has 5 relics (at max capacity). Buying from the shop triggers pendingSwapRelicId.
  'relic-swap': {
    screen: 'relicSwapOverlay',
    relics: ['whetstone', 'iron_shield', 'swift_boots', 'vitality_ring'],
    gold: 500,
  },

  // === Upgrade selection (standalone) ===
  // Bootstraps a run with upgradeable cards, then opens the upgrade selection overlay.
  'upgrade-selection': {
    screen: 'upgradeSelection',
    hand: ['strike', 'block', 'heavy_strike', 'multi_hit', 'lifetap'],
  },

  // === Post-mini-boss rest with upgrade candidates ===
  // Like post-mini-boss-rest but with upgradeable cards so "Upgrade a Card" button is active.
  'post-mini-boss-rest-full': {
    screen: 'postMiniBossRest',
    hand: ['strike', 'block', 'heavy_strike', 'multi_hit', 'lifetap'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Small async delay. */
function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Write a value to a Svelte store singleton. */
function writeStore<T>(key: string, value: T): void {
  const sym = Symbol.for(key);
  const store = (globalThis as Record<symbol, unknown>)[sym];
  if (!store || typeof store !== 'object') return;
  const s = store as { set?: (v: T) => void };
  if (typeof s.set === 'function') s.set(value);
}

/** Update a Svelte store by applying an updater function. */
function updateStore<T>(key: string, updater: (v: T) => T): void {
  const sym = Symbol.for(key);
  const store = (globalThis as Record<symbol, unknown>)[sym];
  if (!store || typeof store !== 'object') return;
  const s = store as { update?: (fn: (v: T) => T) => void };
  if (typeof s.update === 'function') s.update(updater);
}

/** Wrap an async action with try/catch. */
async function safeAction(fn: () => Promise<ScenarioResult>): Promise<ScenarioResult> {
  try {
    return await fn();
  } catch (err: any) {
    return { ok: false, message: `Error: ${err?.message ?? String(err)}` };
  }
}

/** Get current screen. */
function getScreen(): string {
  return readStore<string>('terra:currentScreen') ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Run bootstrap helpers
// ---------------------------------------------------------------------------

/**
 * Bootstraps a minimal run state for scenario testing.
 * Uses the existing gameFlowController functions where possible,
 * but bypasses domain selection / onboarding gating.
 */
async function bootstrapRun(config: ScenarioConfig): Promise<boolean> {
  const { createRunState } = await import('../services/runManager');
  const { activeRunState } = await import('../services/runStateStore');
  const { resetEncounterBridge } = await import('../services/encounterBridge');
  const { generateActMap } = await import('../services/mapGenerator');
  const { initRunRng, destroyRunRng } = await import('../services/seededRng');
  const { activateDeterministicRandom, deactivateDeterministicRandom } = await import('../services/deterministicRandom');

  // Tear down any existing run first
  deactivateDeterministicRandom();
  destroyRunRng();
  resetEncounterBridge();
  activeRunState.set(null);
  await wait(100);

  const domain = (config.domain ?? 'general_knowledge') as any;
  const run = createRunState(domain, domain, {
    selectedArchetype: 'balanced',
    starterDeckSize: 15,
    startingAp: 3,
  });

  // Apply config overrides to run
  if (config.gold !== undefined) run.currency = config.gold;
  if (config.playerHp !== undefined) run.playerHp = config.playerHp;
  if (config.playerMaxHp !== undefined) run.playerMaxHp = config.playerMaxHp;
  if (config.floor !== undefined) {
    const { getSegment, isBossFloor } = await import('../services/floorManager');
    run.floor.currentFloor = config.floor;
    run.floor.segment = getSegment(config.floor);
    run.floor.isBossFloor = isBossFloor(config.floor);
  }

  // Apply relics
  if (config.relics && config.relics.length > 0) {
    for (const relicId of config.relics) {
      const def = RELIC_BY_ID[relicId];
      if (!def) {
        console.warn(`[__terraScenario] Unknown relic ID: '${relicId}' — skipping`);
        continue;
      }
      const alreadyHeld = run.runRelics.some(r => r.definitionId === relicId);
      if (!alreadyHeld) {
        run.runRelics.push({
          definitionId: relicId,
          acquiredAtFloor: run.floor.currentFloor,
          acquiredAtEncounter: run.floor.currentEncounter,
          triggerCount: 0,
        });
      }
    }
  }

  run.floor.actMap = generateActMap(run.floor.segment, run.runSeed);
  activeRunState.set(run);

  initRunRng(run.runSeed);
  activateDeterministicRandom(run.runSeed);

  return true;
}

/**
 * Launches a combat encounter with the specified enemy.
 * If no enemy ID is given, falls back to page_flutter (the tutorial enemy).
 */
async function startCombatScenario(config: ScenarioConfig): Promise<ScenarioResult> {
  // Ensure DB is ready — facts are needed for card pool
  if (!factsDB.isReady()) {
    try {
      await factsDB.init();
    } catch {
      return { ok: false, message: 'factsDB failed to initialize' };
    }
  }

  const bootstrapped = await bootstrapRun(config);
  if (!bootstrapped) {
    return { ok: false, message: 'Failed to bootstrap run state' };
  }

  const { startEncounterForRoom, activeTurnState } = await import('../services/encounterBridge');

  const enemyId = config.enemy ?? 'page_flutter';

  // Validate enemy exists
  const enemyTemplate = ENEMY_TEMPLATES.find(t => t.id === enemyId);
  if (!enemyTemplate) {
    const validIds = ENEMY_TEMPLATES.map(t => t.id).join(', ');
    return { ok: false, message: `Unknown enemy ID: '${enemyId}'. Valid IDs: ${validIds}` };
  }

  const started = await startEncounterForRoom(enemyId);
  if (!started) {
    return { ok: false, message: 'startEncounterForRoom returned false — check run state and factsDB' };
  }

  // Sync gameFlowState so pause/resume works correctly
  const { gameFlowState } = await import('../services/gameFlowController');
  gameFlowState.set('combat');
  // Navigate to combat screen
  writeStore('terra:currentScreen', 'combat');
  await wait(500);

  // --- Post-launch overrides ---

  // Override player HP in turn state
  const ts = get(activeTurnState as any) as any;
  if (ts) {
    let mutated = false;

    if (config.playerHp !== undefined) {
      ts.playerState = { ...ts.playerState, hp: config.playerHp };
      mutated = true;
    }
    if (config.playerMaxHp !== undefined) {
      ts.playerState = { ...ts.playerState, maxHP: config.playerMaxHp };
      mutated = true;
    }

    // Override enemy HP
    if (config.enemyHp !== undefined && ts.enemy) {
      ts.enemy = {
        ...ts.enemy,
        currentHP: config.enemyHp,
        maxHP: Math.max(ts.enemy.maxHP, config.enemyHp),
      };
      mutated = true;
    }

    // Override hand by replacing cards with the specified mechanic IDs
    if ((config.hand && config.hand.length > 0) || config.handSize !== undefined) {
      const mechanicIds = config.hand ?? [];
      const newHand = buildHandFromMechanicIds(mechanicIds, ts.deck?.hand ?? [], config.handSize);
      if (config.chainTypes) {
        newHand.forEach((card: any, i: number) => {
          if (config.chainTypes![i] !== undefined) {
            card.chainType = config.chainTypes![i];
          }
        });
      }
      ts.deck = { ...ts.deck, hand: newHand };
      mutated = true;
    } else if (config.chainTypes) {
      // Just apply chain types to existing hand
      const hand = [...(ts.deck?.hand ?? [])];
      hand.forEach((card: any, i: number) => {
        if (config.chainTypes![i] !== undefined) {
          card.chainType = config.chainTypes![i];
        }
      });
      ts.deck = { ...ts.deck, hand };
      mutated = true;
    }

    // Player block
    if (config.playerBlock !== undefined) {
      ts.playerState = { ...ts.playerState, block: config.playerBlock };
      mutated = true;
    }

    // Enemy block
    if (config.enemyBlock !== undefined && ts.enemy) {
      ts.enemy = { ...ts.enemy, block: config.enemyBlock };
      mutated = true;
    }

    // Turn number
    if (config.turn !== undefined) {
      ts.turn = config.turn;
      mutated = true;
    }

    if (mutated) {
      activeTurnState.set({ ...ts });
    }
  }

  return {
    ok: true,
    message: `Combat scenario loaded: ${enemyId} on floor ${config.floor ?? 1}`,
    state: {
      screen: getScreen(),
      enemy: enemyId,
      playerHp: config.playerHp,
      relics: config.relics,
    },
  };
}

/**
 * Builds a hand array from mechanic IDs.
 * Reuses existing cards from the current hand as templates; creates synthetic cards for
 * mechanic IDs not present. Pads/trims to handSize if specified.
 */
function buildHandFromMechanicIds(
  mechanicIds: string[],
  currentHand: any[],
  handSize?: number,
): any[] {
  const targetIds = handSize !== undefined
    ? mechanicIds.slice(0, handSize)
    : mechanicIds;

  const templateCard = currentHand[0] ?? {
    id: 'scenario_card_0',
    factId: '',
    cardType: 'attack',
    domain: 'general_knowledge',
    tier: '1' as const,
    baseEffectValue: 8,
    effectMultiplier: 1,
  };

  const result: any[] = targetIds.map((mId, i) => {
    const mechanic = MECHANIC_BY_ID[mId];
    if (!mechanic) {
      console.warn(`[__terraScenario] Unknown mechanic ID: '${mId}' — using bare card`);
      return { ...templateCard, id: `scenario_${i}`, mechanicId: mId, mechanicName: mId };
    }

    // Try to find an existing hand card we can repurpose (preserves factId)
    const existing = currentHand[i];
    return {
      ...(existing ?? templateCard),
      id: existing?.id ?? `scenario_${i}_${Math.random().toString(36).slice(2, 6)}`,
      cardType: mechanic.type,
      mechanicId: mechanic.id,
      mechanicName: mechanic.name,
      baseEffectValue: mechanic.baseValue,
      originalBaseEffectValue: mechanic.baseValue,
      apCost: mechanic.apCost,
      effectMultiplier: 1,
    };
  });

  // If handSize > mechanicIds.length, pad with copies of the first card
  if (handSize !== undefined && handSize > result.length) {
    while (result.length < handSize) {
      const source = currentHand[result.length] ?? result[0] ?? templateCard;
      result.push({
        ...source,
        id: `scenario_pad_${result.length}_${Math.random().toString(36).slice(2, 6)}`,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hub / non-combat scenarios
// ---------------------------------------------------------------------------

async function loadNonCombatScenario(config: ScenarioConfig): Promise<ScenarioResult> {
  const screen = config.screen;

  // -----------------------------------------------------------------------
  // rewardRoom
  // -----------------------------------------------------------------------
  if (screen === 'rewardRoom') {
    await bootstrapRun(config);
    const { openRewardRoom, openTestRewardRoom } = await import('../services/rewardRoomBridge');

    if (!config.rewards || config.rewards.length === 0) {
      await openTestRewardRoom();
      return { ok: true, message: 'Reward room opened with random test rewards' };
    }

    const rewards: any[] = config.rewards.map(r => {
      if (r.type === 'gold') return { type: 'gold', amount: r.amount };
      if (r.type === 'health_vial') return { type: 'health_vial', size: r.size ?? 'small', healAmount: r.healAmount ?? 15 };
      if (r.type === 'card') {
        const mechanic = MECHANIC_BY_ID[r.mechanicId];
        if (!mechanic) { console.warn(`[__terraScenario] Unknown mechanic: ${r.mechanicId}`); return null; }
        return {
          type: 'card',
          card: {
            id: `scenario_${r.mechanicId}_${Math.random().toString(36).slice(2, 6)}`,
            factId: `fact_${Math.random().toString(36).slice(2, 8)}`,
            cardType: mechanic.type,
            domain: (config.domain ?? 'general_knowledge') as any,
            tier: '1' as const,
            baseEffectValue: mechanic.baseValue + (r.upgraded ? 3 : 0),
            effectMultiplier: 1,
            mechanicId: mechanic.id,
            mechanicName: r.upgraded ? mechanic.name + '+' : mechanic.name,
            apCost: mechanic.apCost,
            isUpgraded: r.upgraded ?? false,
          },
        };
      }
      if (r.type === 'relic') {
        const def = RELIC_BY_ID[r.relicId];
        if (!def) { console.warn(`[__terraScenario] Unknown relic: ${r.relicId}`); return null; }
        return { type: 'relic', relic: def };
      }
      return null;
    }).filter(Boolean);

    await openRewardRoom(
      rewards,
      (amount: number) => console.log('[Scenario] Gold collected:', amount),
      (heal: number) => console.log('[Scenario] Vial collected:', heal),
      (card: any) => console.log('[Scenario] Card accepted:', card.mechanicName),
      (relic: any) => console.log('[Scenario] Relic accepted:', relic.name),
      () => { console.log('[Scenario] Reward room complete'); writeStore('terra:currentScreen', 'hub'); },
    );
    return { ok: true, message: `Reward room with ${rewards.length} items`, state: { rewards } };
  }

  // -----------------------------------------------------------------------
  // shopRoom
  // -----------------------------------------------------------------------
  if (screen === 'shopRoom') {
    await bootstrapRun(config);
    const { activeShopInventory } = await import('../services/gameFlowController');
    const { calculateShopPrice } = await import('../services/shopService');

    const floor = config.floor ?? 1;
    const inventory: any = { relics: [], cards: [], removalCost: 75 };

    if (config.shopRelics) {
      for (const relicId of config.shopRelics) {
        const def = RELIC_BY_ID[relicId];
        if (!def) { console.warn(`[__terraScenario] Unknown relic: ${relicId}`); continue; }
        const basePrice = def.rarity === 'common' ? 100 : def.rarity === 'uncommon' ? 150 : def.rarity === 'rare' ? 250 : 400;
        inventory.relics.push({ relic: def, price: calculateShopPrice(basePrice, floor) });
      }
    }

    if (config.shopCards) {
      for (const mId of config.shopCards) {
        const mechanic = MECHANIC_BY_ID[mId];
        if (!mechanic) { console.warn(`[__terraScenario] Unknown mechanic: ${mId}`); continue; }
        const card = {
          id: `shop_${mId}_${Math.random().toString(36).slice(2, 6)}`,
          factId: `fact_${Math.random().toString(36).slice(2, 8)}`,
          cardType: mechanic.type,
          domain: (config.domain ?? 'general_knowledge') as any,
          tier: '1' as const,
          baseEffectValue: mechanic.baseValue,
          effectMultiplier: 1,
          mechanicId: mechanic.id,
          mechanicName: mechanic.name,
          apCost: mechanic.apCost,
        };
        inventory.cards.push({ card, price: 50 + Math.floor(Math.random() * 30) });
      }
    }

    // Default fallback: show first 3 relics if nothing specified
    if (!config.shopRelics && !config.shopCards) {
      const allRelics = Object.values(RELIC_BY_ID);
      inventory.relics = allRelics.slice(0, 3).map((def: any) => ({ relic: def, price: 150 }));
    }

    activeShopInventory.set(inventory);
    writeStore('terra:currentScreen', 'shopRoom');
    await wait(300);
    return { ok: true, message: `Shop opened with ${inventory.relics.length} relics, ${inventory.cards.length} cards` };
  }

  // -----------------------------------------------------------------------
  // mysteryEvent
  // -----------------------------------------------------------------------
  if (screen === 'mysteryEvent') {
    await bootstrapRun(config);
    const { activeMysteryEvent } = await import('../services/gameFlowController');

    let event;
    if (config.mysteryEventId) {
      const { getMysteryEventById } = await import('../services/floorManager');
      event = getMysteryEventById(config.mysteryEventId);
      if (!event) {
        return { ok: false, message: `Unknown mystery event ID: '${config.mysteryEventId}'` };
      }
    } else {
      const { generateMysteryEvent } = await import('../services/floorManager');
      event = generateMysteryEvent(config.floor ?? 1);
    }

    activeMysteryEvent.set(event);
    writeStore('terra:currentScreen', 'mysteryEvent');
    await wait(300);
    return { ok: true, message: `Mystery event: ${event.name} (${event.id})` };
  }

  // -----------------------------------------------------------------------
  // specialEvent
  // -----------------------------------------------------------------------
  if (screen === 'specialEvent') {
    await bootstrapRun(config);
    const { activeSpecialEvent } = await import('../services/gameFlowController');
    const { rollSpecialEvent } = await import('../data/specialEvents');
    const event = rollSpecialEvent();
    activeSpecialEvent.set(event);
    writeStore('terra:currentScreen', 'specialEvent');
    await wait(300);
    return { ok: true, message: `Special event: ${event.name} (${event.id})` };
  }

  // -----------------------------------------------------------------------
  // relicSwapOverlay
  // -----------------------------------------------------------------------
  if (screen === 'relicSwapOverlay') {
    // Bootstrap run with relics already at max capacity (5 slots filled).
    // Then set up a shop inventory with one extra relic and buy it — this triggers
    // addRelicToRun's slot-cap branch, which sets pendingSwapRelicId and navigates
    // to relicSwapOverlay automatically.
    await bootstrapRun(config);
    const { activeShopInventory, onShopBuyRelic } = await import('../services/gameFlowController');
    const offeredRelicId = 'insight_prism';
    const def = RELIC_BY_ID[offeredRelicId];
    if (!def) return { ok: false, message: `Unknown offered relic: ${offeredRelicId}` };
    // Inject a minimal shop inventory so onShopBuyRelic can find the item.
    activeShopInventory.set({ relics: [{ relic: def, price: 1 }], cards: [], removalCost: 75 } as any);
    onShopBuyRelic(offeredRelicId);
    // onShopBuyRelic → addRelicToRun → slot full → sets pendingSwapRelicId + navigates screen.
    await wait(300);
    return { ok: true, message: `Relic swap overlay: offering ${def.name} against 5 equipped relics` };
  }

  // -----------------------------------------------------------------------
  // upgradeSelection
  // -----------------------------------------------------------------------
  if (screen === 'upgradeSelection') {
    await bootstrapRun(config);
    // Build synthetic upgrade candidates from mechanic IDs in config.hand.
    // canMasteryUpgrade requires card.mechanicId to be in MASTERY_UPGRADE_DEFS.
    const mechanicIds = config.hand ?? ['strike', 'block', 'heavy_strike', 'multi_hit', 'lifetap'];
    const { activeUpgradeCandidates } = await import('../services/gameFlowController');
    const { getUpgradePreview, canMasteryUpgrade } = await import('../services/cardUpgradeService');
    const candidates = mechanicIds.map((mId, i) => {
      const mechanic = MECHANIC_BY_ID[mId];
      if (!mechanic) return null;
      const card: any = {
        id: `scenario_upgrade_${i}_${Math.random().toString(36).slice(2, 6)}`,
        factId: `fact_scenario_${i}`,
        cardType: mechanic.type,
        domain: (config.domain ?? 'general_knowledge') as any,
        tier: '1' as const,
        baseEffectValue: mechanic.baseValue,
        effectMultiplier: 1,
        mechanicId: mechanic.id,
        mechanicName: mechanic.name,
        apCost: mechanic.apCost,
        masteryLevel: 0,
        masteryChangedThisEncounter: false,
      };
      if (!canMasteryUpgrade(card)) return null;
      const preview = getUpgradePreview(card);
      if (!preview) return null;
      return { card, preview };
    }).filter(Boolean) as Array<{ card: any; preview: any }>;

    if (candidates.length === 0) {
      return { ok: false, message: 'No upgradeable candidates built — check mechanic IDs are in MASTERY_UPGRADE_DEFS' };
    }

    activeUpgradeCandidates.set(candidates);
    writeStore('terra:currentScreen', 'upgradeSelection');
    await wait(300);
    return { ok: true, message: `Upgrade selection opened with ${candidates.length} candidate(s)` };
  }

  // -----------------------------------------------------------------------
  // cardReward
  // -----------------------------------------------------------------------
  if (screen === 'cardReward') {
    await bootstrapRun(config);
    const { activeCardRewardOptions } = await import('../services/gameFlowController');

    if (config.cardRewardMechanics && config.cardRewardMechanics.length > 0) {
      const cards = config.cardRewardMechanics.map((mId, i) => {
        const mechanic = MECHANIC_BY_ID[mId];
        if (!mechanic) { console.warn(`[__terraScenario] Unknown mechanic: ${mId}`); return null; }
        return {
          id: `reward_${mId}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          factId: `fact_${Math.random().toString(36).slice(2, 8)}`,
          cardType: mechanic.type,
          domain: (config.domain ?? 'general_knowledge') as any,
          tier: '1' as const,
          baseEffectValue: mechanic.baseValue,
          effectMultiplier: 1,
          mechanicId: mechanic.id,
          mechanicName: mechanic.name,
          apCost: mechanic.apCost,
        };
      }).filter(Boolean);
      activeCardRewardOptions.set(cards as any);
    }

    writeStore('terra:currentScreen', 'cardReward');
    await wait(300);
    return { ok: true, message: 'Card reward screen opened' };
  }

  // -----------------------------------------------------------------------
  // runEnd
  // -----------------------------------------------------------------------
  if (screen === 'runEnd') {
    const { activeRunEndData } = await import('../services/gameFlowController');

    const defaults = {
      result: config.runEndResult ?? 'victory',
      floorReached: config.floor ?? 5,
      factsAnswered: 42,
      correctAnswers: 35,
      accuracy: 83,
      bestCombo: 7,
      cardsEarned: 12,
      newFactsLearned: 8,
      factsMastered: 3,
      encountersWon: 8,
      encountersTotal: 10,
      elitesDefeated: 2,
      miniBossesDefeated: 1,
      bossesDefeated: config.runEndResult === 'victory' ? 1 : 0,
      completedBounties: [],
      duration: 900,
      runDurationMs: 900000,
      rewardMultiplier: 1.5,
      currencyEarned: 250,
      relicsCollected: 3,
      isPracticeRun: false,
    };

    const endData = { ...defaults, ...(config.runEndStats ?? {}) };
    activeRunEndData.set(endData as any);
    writeStore('terra:currentScreen', 'runEnd');
    await wait(300);
    return { ok: true, message: `Run end screen: ${endData.result}` };
  }

  // -----------------------------------------------------------------------
  // retreatOrDelve
  // -----------------------------------------------------------------------
  if (screen === 'retreatOrDelve') {
    await bootstrapRun(config);
    writeStore('terra:currentScreen', 'retreatOrDelve');
    await wait(300);
    return { ok: true, message: `Retreat/Delve on floor ${config.floor ?? 1}` };
  }

  // -----------------------------------------------------------------------
  // restRoom / postMiniBossRest
  // -----------------------------------------------------------------------
  if (screen === 'restRoom' || screen === 'postMiniBossRest') {
    await bootstrapRun(config);

    // For postMiniBossRest, populate upgrade candidates when hand mechanics are specified.
    // This makes the "Upgrade a Card" button active (e.g. 'post-mini-boss-rest-full').
    if (screen === 'postMiniBossRest' && config.hand && config.hand.length > 0) {
      const { activeUpgradeCandidates } = await import('../services/gameFlowController');
      const { getUpgradePreview, canMasteryUpgrade } = await import('../services/cardUpgradeService');
      const candidates = config.hand.map((mId, i) => {
        const mechanic = MECHANIC_BY_ID[mId];
        if (!mechanic) return null;
        const card: any = {
          id: `scenario_rest_${i}_${Math.random().toString(36).slice(2, 6)}`,
          factId: `fact_scenario_${i}`,
          cardType: mechanic.type,
          domain: (config.domain ?? 'general_knowledge') as any,
          tier: '1' as const,
          baseEffectValue: mechanic.baseValue,
          effectMultiplier: 1,
          mechanicId: mechanic.id,
          mechanicName: mechanic.name,
          apCost: mechanic.apCost,
          masteryLevel: 0,
          masteryChangedThisEncounter: false,
          };
        if (!canMasteryUpgrade(card)) return null;
        const preview = getUpgradePreview(card);
        if (!preview) return null;
        return { card, preview };
      }).filter(Boolean) as Array<{ card: any; preview: any }>;
      activeUpgradeCandidates.set(candidates);
    }

    writeStore('terra:currentScreen', screen);
    await wait(300);
    return { ok: true, message: `Rest room opened on floor ${config.floor ?? 1}` };
  }

  // -----------------------------------------------------------------------
  // dungeonMap
  // -----------------------------------------------------------------------
  if (screen === 'dungeonMap') {
    await bootstrapRun(config);
    writeStore('terra:currentScreen', 'dungeonMap');
    await wait(300);
    return { ok: true, message: `Dungeon map on floor ${config.floor ?? 1}` };
  }

  // -----------------------------------------------------------------------
  // onboarding
  // -----------------------------------------------------------------------
  if (screen === 'onboarding') {
    writeStore('terra:currentScreen', 'onboarding');
    await wait(300);
    return { ok: true, message: 'Onboarding cutscene opened' };
  }

  // -----------------------------------------------------------------------
  // archetypeSelection
  // -----------------------------------------------------------------------
  if (screen === 'archetypeSelection') {
    writeStore('terra:currentScreen', 'archetypeSelection');
    await wait(300);
    return { ok: true, message: 'Archetype selection screen opened' };
  }

  // -----------------------------------------------------------------------
  // relicSanctum
  // -----------------------------------------------------------------------
  if (screen === 'relicSanctum') {
    writeStore('terra:currentScreen', 'relicSanctum');
    await wait(300);
    return { ok: true, message: 'Relic sanctum opened' };
  }

  // -----------------------------------------------------------------------
  // library, profile, journal, settings
  // -----------------------------------------------------------------------
  if (['library', 'profile', 'journal', 'settings'].includes(screen)) {
    writeStore('terra:currentScreen', screen);
    await wait(300);
    return { ok: true, message: `${screen} screen opened` };
  }

  // -----------------------------------------------------------------------
  // masteryChallenge
  // -----------------------------------------------------------------------
  if (screen === 'masteryChallenge') {
    await bootstrapRun(config);
    const { activeMasteryChallenge, gameFlowState } = await import('../services/gameFlowController');

    // Use provided question or fall back to a hardcoded example so the screen is never blank
    const questionText = config.masteryChallengeQuestion ?? 'What is the approximate speed of light in a vacuum?';
    const correctAnswer = config.masteryChallengeAnswer ?? '299,792 km/s';
    const distractors = config.masteryChallengeDistractors ?? ['150,000 km/s', '1,000,000 km/s', '3,000 km/s'];
    const allAnswers = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);

    const challenge = {
      factId: 'scenario_mastery',
      factStatement: questionText,
      question: questionText,
      correctAnswer,
      answers: allAnswers,
      timerSeconds: config.masteryChallengeTimer ?? 10,
    };
    activeMasteryChallenge.set(challenge as any);
    gameFlowState.set('masteryChallenge' as any);
    writeStore('terra:currentScreen', 'masteryChallenge');
    await wait(300);
    return { ok: true, message: 'Mastery challenge screen opened' };
  }

  // -----------------------------------------------------------------------
  // restStudy
  // -----------------------------------------------------------------------
  if (screen === 'restStudy') {
    // Ensure factsDB is ready — study questions need it
    if (!factsDB.isReady()) {
      try { await factsDB.init(); } catch { /* ignore */ }
    }

    await bootstrapRun(config);

    // Generate study questions and inject via global bridge so CardApp can pick them up
    const { generateStudyQuestions, gameFlowState } = await import('../services/gameFlowController');
    const questions = generateStudyQuestions();

    // Store on a well-known symbol so CardApp's $effect can read them
    const sym = Symbol.for('terra:scenarioStudyQuestions');
    (globalThis as any)[sym] = questions;

    gameFlowState.set('restStudy' as any);
    writeStore('terra:currentScreen', 'restStudy');
    await wait(300);

    return { ok: true, message: `Study quiz opened with ${questions.length} questions` };
  }

  // -----------------------------------------------------------------------
  // hub (with optional run state for relics/gold display)
  // -----------------------------------------------------------------------
  if (screen === 'hub' && (config.relics || config.gold !== undefined)) {
    await bootstrapRun(config);
  }

  writeStore('terra:currentScreen', screen);
  await wait(300);

  return {
    ok: true,
    message: `Navigated to: ${screen}`,
    state: { screen: getScreen() },
  };
}

// ---------------------------------------------------------------------------
// Mid-combat state override helpers
// ---------------------------------------------------------------------------

/** Set player HP in the active turn state. */
function setPlayerHp(hp: number, maxHp?: number): ScenarioResult {
  const ts = readStore<any>('terra:activeTurnState');
  if (!ts) return { ok: false, message: 'No active turn state — start combat first' };

  updateStore<any>('terra:activeTurnState', (s) => {
    if (!s) return s;
    return {
      ...s,
      playerState: {
        ...s.playerState,
        hp: Math.max(1, hp),
        ...(maxHp !== undefined ? { maxHP: maxHp } : {}),
      },
    };
  });

  // Also sync run state
  updateStore<any>('terra:activeRunState', (r) => {
    if (!r) return r;
    return { ...r, playerHp: Math.max(1, hp), ...(maxHp !== undefined ? { playerMaxHp: maxHp } : {}) };
  });

  return { ok: true, message: `Player HP set to ${hp}${maxHp !== undefined ? ` / ${maxHp}` : ''}` };
}

/** Set enemy HP in the active turn state. */
function setEnemyHp(hp: number): ScenarioResult {
  const ts = readStore<any>('terra:activeTurnState');
  if (!ts) return { ok: false, message: 'No active turn state — start combat first' };
  if (!ts.enemy) return { ok: false, message: 'No enemy in current turn state' };

  updateStore<any>('terra:activeTurnState', (s) => {
    if (!s || !s.enemy) return s;
    return {
      ...s,
      enemy: {
        ...s.enemy,
        currentHP: Math.max(1, hp),
        maxHP: Math.max(s.enemy.maxHP, hp),
      },
    };
  });

  return { ok: true, message: `Enemy HP set to ${hp}` };
}

/** Set gold in the active run state. */
function setGold(amount: number): ScenarioResult {
  updateStore<any>('terra:activeRunState', (r) => {
    if (!r) return r;
    return { ...r, currency: Math.max(0, amount) };
  });
  return { ok: true, message: `Gold set to ${amount}` };
}

/** Set floor in the active run state. */
function setFloor(floor: number): ScenarioResult {
  updateStore<any>('terra:activeRunState', (r) => {
    if (!r) return r;
    return {
      ...r,
      floor: {
        ...r.floor,
        currentFloor: floor,
      },
    };
  });
  return { ok: true, message: `Floor set to ${floor}` };
}

/** Replace the current hand with cards for the given mechanic IDs. */
function forceHand(mechanicIds: string[]): ScenarioResult {
  const ts = readStore<any>('terra:activeTurnState');
  if (!ts) return { ok: false, message: 'No active turn state — start combat first' };

  const newHand = buildHandFromMechanicIds(mechanicIds, ts.deck?.hand ?? []);
  updateStore<any>('terra:activeTurnState', (s) => {
    if (!s) return s;
    return { ...s, deck: { ...s.deck, hand: newHand } };
  });

  return { ok: true, message: `Hand replaced with: ${mechanicIds.join(', ')}` };
}

/** Add a relic to the active run. */
function addRelic(relicId: string): ScenarioResult {
  const def = RELIC_BY_ID[relicId];
  if (!def) {
    const valid = Object.keys(RELIC_BY_ID).slice(0, 10).join(', ');
    return { ok: false, message: `Unknown relic ID: '${relicId}'. Sample valid IDs: ${valid} ...` };
  }

  const run = readStore<any>('terra:activeRunState');
  if (!run) return { ok: false, message: 'No active run state — start a run first' };

  if (run.runRelics.some((r: any) => r.definitionId === relicId)) {
    return { ok: false, message: `Relic '${relicId}' is already equipped` };
  }

  updateStore<any>('terra:activeRunState', (r) => {
    if (!r) return r;
    return {
      ...r,
      runRelics: [
        ...r.runRelics,
        { definitionId: relicId, acquiredAtFloor: r.floor.currentFloor, acquiredAtEncounter: r.floor.currentEncounter, triggerCount: 0 },
      ],
    };
  });

  // Also sync relic IDs into turn state so relic effects resolve correctly
  updateStore<any>('terra:activeTurnState', (s) => {
    if (!s) return s;
    const newIds = new Set(s.activeRelicIds);
    newIds.add(relicId);
    return { ...s, activeRelicIds: newIds };
  });

  return { ok: true, message: `Relic '${def.name}' (${relicId}) added` };
}

/** Remove a relic from the active run. */
function removeRelic(relicId: string): ScenarioResult {
  const run = readStore<any>('terra:activeRunState');
  if (!run) return { ok: false, message: 'No active run state — start a run first' };

  updateStore<any>('terra:activeRunState', (r) => {
    if (!r) return r;
    return {
      ...r,
      runRelics: r.runRelics.filter((rr: any) => rr.definitionId !== relicId),
    };
  });

  updateStore<any>('terra:activeTurnState', (s) => {
    if (!s) return s;
    const newIds = new Set(s.activeRelicIds);
    newIds.delete(relicId);
    return { ...s, activeRelicIds: newIds };
  });

  return { ok: true, message: `Relic '${relicId}' removed` };
}

/** Set player block in active combat. */
function setPlayerBlock(block: number): ScenarioResult {
  const ts = readStore<any>('terra:activeTurnState');
  if (!ts) return { ok: false, message: 'No active turn state — start combat first' };
  updateStore<any>('terra:activeTurnState', (s) => {
    if (!s) return s;
    return { ...s, playerState: { ...s.playerState, block } };
  });
  return { ok: true, message: `Player block set to ${block}` };
}

/** Set enemy block in active combat. */
function setEnemyBlock(block: number): ScenarioResult {
  const ts = readStore<any>('terra:activeTurnState');
  if (!ts) return { ok: false, message: 'No active turn state — start combat first' };
  if (!ts.enemy) return { ok: false, message: 'No enemy in current turn state' };
  updateStore<any>('terra:activeTurnState', (s) => {
    if (!s?.enemy) return s;
    return { ...s, enemy: { ...s.enemy, block } };
  });
  return { ok: true, message: `Enemy block set to ${block}` };
}

// ---------------------------------------------------------------------------
// Core load function
// ---------------------------------------------------------------------------

async function loadScenario(name: string): Promise<ScenarioResult> {
  const config = SCENARIOS[name];
  if (!config) {
    const available = Object.keys(SCENARIOS).join(', ');
    return { ok: false, message: `Unknown scenario '${name}'. Available: ${available}` };
  }
  return loadCustom(config);
}

async function loadCustom(config: ScenarioConfig): Promise<ScenarioResult> {
  // Mark onboarding complete so dev tooltips (e.g. "Tap a card to examine it") never show
  markOnboardingComplete()
  markOnboardingTooltipSeen('hasSeenCardTapTooltip')
  markOnboardingTooltipSeen('hasSeenCastTooltip')
  markOnboardingTooltipSeen('hasSeenAnswerTooltip')
  markOnboardingTooltipSeen('hasSeenEndTurnTooltip')
  markOnboardingTooltipSeen('hasSeenAPTooltip')

  const isCombat = config.screen === 'combat';
  if (isCombat) {
    return startCombatScenario(config);
  }
  return loadNonCombatScenario(config);
}

// ---------------------------------------------------------------------------
// Mystery event helpers
// ---------------------------------------------------------------------------

/** List all available mystery event IDs. Logs a table in the console and returns the IDs. */
async function listMysteryEvents(): Promise<string[]> {
  const { getAllMysteryEventIds } = await import('../services/floorManager');
  const ids = getAllMysteryEventIds();
  console.table(ids.map(id => ({ id })));
  return ids;
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp(): void {
  const lines: string[] = [
    '╔══════════════════════════════════════════════════╗',
    '║      window.__terraScenario  —  Dev Scenario API ║',
    '╚══════════════════════════════════════════════════╝',
    '',
    'SCENARIO LOADING',
    '  __terraScenario.list()                   List all scenario names',
    '  __terraScenario.load(name)               Load a named preset',
    '  __terraScenario.loadCustom(config)       Load a custom ScenarioConfig',
    '',
    'AVAILABLE SCENARIOS',
    ...Object.entries(SCENARIOS).map(([name, cfg]) =>
      `  ${name.padEnd(28)} screen: ${cfg.screen}${cfg.enemy ? `, enemy: ${cfg.enemy}` : ''}${cfg.relics ? `, relics: [${cfg.relics.join(',')}]` : ''}`,
    ),
    '',
    'MID-COMBAT OVERRIDES  (usable any time during combat)',
    '  __terraScenario.setPlayerHp(hp, maxHp?)  Set player HP',
    '  __terraScenario.setEnemyHp(hp)           Set enemy HP',
    '  __terraScenario.setPlayerBlock(block)    Set player block',
    '  __terraScenario.setEnemyBlock(block)     Set enemy block',
    '  __terraScenario.setGold(amount)          Set gold',
    '  __terraScenario.pause()                  Pause Phaser + CSS for screenshots',
    '  __terraScenario.resume()                 Resume after screenshot',
    '  __terraScenario.setFloor(floor)          Set floor number',
    '  __terraScenario.forceHand(mechanicIds)   Replace hand cards',
    '  __terraScenario.addRelic(relicId)        Add a relic',
    '  __terraScenario.removeRelic(relicId)     Remove a relic',
    '',
    'MYSTERY EVENT HELPERS',
    '  __terraScenario.listMysteryEvents()      List all event IDs (logs table)',
    '  load("mystery-healing-fountain")         Load event by ID preset',
    '  loadCustom({ screen:"mysteryEvent", mysteryEventId:"healing_fountain" })',
    '',
    'SCREEN NAVIGATION SCENARIOS',
    '  onboarding, domain-selection, archetype-selection, relic-sanctum',
    '  library, profile, journal, settings',
    '  study-quiz  (restStudy screen)',
    '  mastery-challenge  (masteryChallenge screen)',
    '',
    'SCENARIO CONFIG SHAPE',
    '  {',
    '    screen: string              // "combat" | "hub" | "shopRoom" | "rewardRoom" | etc.',
    '    enemy?: string              // Enemy template ID (combat)',
    '    enemyHp?: number            // Override spawned enemy HP (combat)',
    '    playerHp?: number           // Override player HP',
    '    playerMaxHp?: number        // Override player max HP',
    '    playerBlock?: number        // Override player block (combat)',
    '    enemyBlock?: number         // Override enemy block (combat)',
    '    comboMultiplier?: number    // Override combo multiplier (combat)',
    '    turn?: number               // Override turn counter (combat)',
    '    hand?: string[]             // Mechanic IDs for the hand',
    '    handSize?: number           // Target hand size (pads/trims hand[])',
    '    relics?: string[]           // Relic IDs to equip',
    '    gold?: number               // Starting gold',
    '    floor?: number              // Floor number',
    '    domain?: string             // Knowledge domain for pool',
    '    chainTypes?: number[]       // Chain type per hand card (0-5)',
    '    rewards?: RewardItem[]      // rewardRoom: explicit reward items',
    '    shopRelics?: string[]       // shopRoom: explicit relic IDs',
    '    shopCards?: string[]        // shopRoom: explicit card mechanic IDs',
    '    mysteryEventId?: string     // mysteryEvent: specific event ID (use listMysteryEvents())',
    '    cardRewardMechanics?: string[] // cardReward: 3 mechanic IDs',
    '    runEndResult?: string       // runEnd: "victory"|"defeat"|"retreat"',
    '    runEndStats?: object        // runEnd: stat overrides',
    '    quizQuestionCount?: number  // restStudy: number of questions (default 3)',
    '    masteryChallengeQuestion?: string  // masteryChallenge: question text',
    '    masteryChallengeAnswer?: string    // masteryChallenge: correct answer',
    '    masteryChallengeDistractors?: string[] // masteryChallenge: wrong answers',
    '    masteryChallengeTimer?: number     // masteryChallenge: timer seconds (default 10)',
    '  }',
    '',
    'VALID MECHANIC IDs (sample)',
    '  strike, block, heavy_strike, multi_hit, lifetap, expose, reckless',
    '',
    'VALID ENEMY IDs (sample)',
    '  ' + ENEMY_TEMPLATES.slice(0, 8).map(t => t.id).join(', '),
    '',
    'VALID RELIC IDs (sample)',
    '  ' + Object.keys(RELIC_BY_ID).slice(0, 10).join(', '),
  ];
  console.log(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/** Initialize the scenario simulator on window.__terraScenario. Dev mode only. */
export function initScenarioSimulator(): void {
  if (!import.meta.env.DEV) return;

  const api = {
    list: () => {
      const names = Object.keys(SCENARIOS);
      console.table(
        Object.entries(SCENARIOS).map(([name, cfg]) => ({
          name,
          screen: cfg.screen,
          enemy: cfg.enemy ?? '—',
          relics: cfg.relics?.join(', ') ?? '—',
          hand: cfg.hand?.join(', ') ?? (cfg.handSize ? `${cfg.handSize} cards` : '—'),
        })),
      );
      return names;
    },

    load: (name: string) => loadScenario(name),
    loadCustom: (config: ScenarioConfig) => loadCustom(config),
    listMysteryEvents,

    // Mid-combat helpers
    setPlayerHp,
    setEnemyHp,
    setGold,
    setFloor,
    forceHand,
    addRelic,
    removeRelic,
    setPlayerBlock,
    setEnemyBlock,

    /** Pause ALL animation sources for stable Playwright screenshots. */
    pause: () => {
      // 1. Pause CSS animations via attribute
      document.documentElement.setAttribute('data-pw-animations', 'disabled');

      // 2. Pause all Web Animations API animations
      const webAnims = document.getAnimations();
      webAnims.forEach(a => a.pause());

      // 3. Pause Phaser game loop if running
      const reg = globalThis as Record<symbol, unknown>;
      const mgr = reg[Symbol.for('terra:cardGameManager')] as { getGame(): { loop: { sleep(): void; wake(): void } } | null } | undefined;
      const game = mgr?.getGame();
      if (game) {
        game.loop.sleep();
      }

      // 4. Override requestAnimationFrame to suppress any remaining RAF loops
      if (!(window as any).__origRAF) {
        (window as any).__origRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = () => 0 as any;
      }

      return { ok: true, phaserPaused: !!game, webAnimsPaused: webAnims.length };
    },

    /** Resume ALL animation sources after screenshot. */
    resume: () => {
      // 1. Resume CSS animations
      document.documentElement.removeAttribute('data-pw-animations');

      // 2. Resume Web Animations
      document.getAnimations().forEach(a => a.play());

      // 3. Resume Phaser
      const reg = globalThis as Record<symbol, unknown>;
      const mgr = reg[Symbol.for('terra:cardGameManager')] as { getGame(): { loop: { sleep(): void; wake(): void } } | null } | undefined;
      const game = mgr?.getGame();
      if (game) {
        game.loop.wake();
      }

      // 4. Restore requestAnimationFrame
      if ((window as any).__origRAF) {
        window.requestAnimationFrame = (window as any).__origRAF;
        delete (window as any).__origRAF;
      }

      return { ok: true };
    },

    help: printHelp,

    /** Expose scenario configs for inspection. */
    scenarios: SCENARIOS,
  };

  (window as any).__terraScenario = api;

  console.log('[dev] __terraScenario ready. Type __terraScenario.help() for usage.');
}
