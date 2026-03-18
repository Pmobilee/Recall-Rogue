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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioConfig {
  /** Target screen to navigate to after setup. */
  screen: string;
  /** Enemy template ID (e.g. 'cave_bat', 'the_archivist'). */
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
    enemy: 'cave_bat',
    hand: ['strike', 'strike', 'strike', 'block', 'block'],
  },
  'combat-10-cards': {
    screen: 'combat',
    enemy: 'crystal_golem',
    handSize: 10,
  },
  'combat-boss': {
    screen: 'combat',
    enemy: 'the_archivist',
    playerHp: 50,
    hand: ['heavy_strike', 'strike', 'block', 'lifetap', 'expose'],
    relics: ['whetstone', 'iron_buckler', 'swift_boots'],
  },
  'combat-scholar': {
    screen: 'combat',
    enemy: 'scholar',
    handSize: 10,
    relics: ['combo_ring', 'momentum_gem'],
  },
  'combat-all-chains': {
    screen: 'combat',
    enemy: 'cave_bat',
    hand: ['strike', 'strike', 'block', 'block', 'strike'],
    chainTypes: [0, 1, 2, 3, 4],
  },
  'combat-low-hp': {
    screen: 'combat',
    enemy: 'cave_bat',
    playerHp: 10,
    playerMaxHp: 100,
    hand: ['strike', 'block', 'heavy_strike', 'strike', 'block'],
  },
  'combat-elite': {
    screen: 'combat',
    enemy: 'the_librarian',
    playerHp: 80,
    relics: ['whetstone', 'iron_shield'],
    hand: ['heavy_strike', 'strike', 'multi_hit', 'block', 'lifetap'],
  },
  'combat-mini-boss': {
    screen: 'combat',
    enemy: 'cave_guardian',
    playerHp: 60,
    hand: ['heavy_strike', 'strike', 'block', 'expose', 'surge'],
    relics: ['whetstone'],
  },
  'combat-relic-heavy': {
    screen: 'combat',
    enemy: 'cave_bat',
    relics: ['whetstone', 'iron_shield', 'vitality_ring', 'combo_ring', 'momentum_gem'],
    hand: ['strike', 'strike', 'block', 'heavy_strike', 'multi_hit'],
  },
  'combat-big-hand': {
    screen: 'combat',
    enemy: 'cave_bat',
    handSize: 8,
    relics: ['expanded_satchel'],
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
  },
  'dungeon-map': {
    screen: 'dungeonMap',
  },
  'retreat-or-delve': {
    screen: 'retreatOrDelve',
    gold: 200,
    floor: 3,
  },

  // === Hub scenarios ===
  'hub-endgame': {
    screen: 'hub',
    relics: ['whetstone', 'iron_buckler', 'swift_boots', 'combo_ring', 'scholars_hat'],
    gold: 5000,
  },
  'hub-fresh': {
    screen: 'hub',
    gold: 0,
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
 * If no enemy ID is given, falls back to cave_bat (the tutorial enemy).
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

  const enemyId = config.enemy ?? 'cave_bat';

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
  if (config.screen === 'hub' && (config.relics || config.gold !== undefined)) {
    // Bootstrap a run stub just to set the data, then go to hub
    await bootstrapRun(config);
  }

  writeStore('terra:currentScreen', config.screen);
  await wait(300);

  return {
    ok: true,
    message: `Navigated to: ${config.screen}`,
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
  const isCombat = config.screen === 'combat';
  if (isCombat) {
    return startCombatScenario(config);
  }
  return loadNonCombatScenario(config);
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
    '  __terraScenario.setGold(amount)          Set gold',
    '  __terraScenario.setFloor(floor)          Set floor number',
    '  __terraScenario.forceHand(mechanicIds)   Replace hand cards',
    '  __terraScenario.addRelic(relicId)        Add a relic',
    '  __terraScenario.removeRelic(relicId)     Remove a relic',
    '',
    'SCENARIO CONFIG SHAPE',
    '  {',
    '    screen: string          // "combat" | "hub" | "shopRoom" | etc.',
    '    enemy?: string          // Enemy template ID (see ENEMY_TEMPLATES)',
    '    enemyHp?: number        // Override spawned enemy HP',
    '    playerHp?: number       // Override player HP',
    '    playerMaxHp?: number    // Override player max HP',
    '    hand?: string[]         // Mechanic IDs for the hand',
    '    handSize?: number       // Target hand size (pads/trims hand[])',
    '    relics?: string[]       // Relic IDs to equip',
    '    gold?: number           // Starting gold',
    '    floor?: number          // Floor number',
    '    domain?: string         // Knowledge domain for pool',
    '    chainTypes?: number[]   // Chain type per hand card (0-5)',
    '  }',
    '',
    'VALID MECHANIC IDs (sample)',
    '  strike, block, heavy_strike, multi_hit, lifetap, expose, surge',
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

    // Mid-combat helpers
    setPlayerHp,
    setEnemyHp,
    setGold,
    setFloor,
    forceHand,
    addRelic,
    removeRelic,

    help: printHelp,

    /** Expose scenario configs for inspection. */
    scenarios: SCENARIOS,
  };

  (window as any).__terraScenario = api;

  console.log('[dev] __terraScenario ready. Type __terraScenario.help() for usage.');
}
