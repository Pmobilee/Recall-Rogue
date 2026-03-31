/**
 * Scenario Recipes — auto-generates ready-to-use spawn configs for testing
 * specific game elements (relics, enemies, status effects, card mechanics).
 *
 * DEV MODE ONLY — never imported in production builds.
 *
 * Usage:
 *   import { getRecipe, listRecipes } from './scenarioRecipes';
 *   getRecipe('soul_jar')        // by relic ID
 *   getRecipe('relic:soul_jar')  // by prefixed ID
 *   getRecipe('algorithm')       // by enemy ID
 *   getRecipe('poison')          // status effect (player side)
 *   getRecipe('strike')          // mechanic ID
 *   listRecipes()                // console.table of all recipes
 */

import { RELIC_BY_ID } from '../data/relics/index';
import { ENEMY_TEMPLATES } from '../data/enemies';
import { MECHANIC_BY_ID } from '../data/mechanics';
import type { RelicTrigger } from '../data/relics/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal SpawnConfig shape for recipes (avoids circular import with scenarioSimulator) */
export interface RecipeConfig {
  screen: string;
  enemy?: string;
  playerHp?: number;
  playerMaxHp?: number;
  hand?: string[];
  relics?: string[];
  gold?: number;
  floor?: number;
  domain?: string;
  turnOverrides?: Record<string, unknown>;
  runOverrides?: Record<string, unknown>;
}

export interface RecipeEntry {
  /** Category: 'relic', 'enemy', 'status_effect', 'mechanic' */
  category: string;
  /** Element ID (e.g. 'soul_jar', 'algorithm', 'poison', 'heavy_strike') */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this recipe tests */
  description: string;
  /** Ready-to-use spawn config */
  config: RecipeConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard hand for combat scenarios — covers attack, defense, heavy */
const STANDARD_HAND = ['strike', 'block', 'heavy_strike', 'expose', 'block'];

/** A full 5-card hand for card_play relic triggers */
const FULL_HAND = ['strike', 'heavy_strike', 'block', 'expose', 'multi_hit'];

/** Hand biased toward attack cards */
const ATTACK_HAND = ['strike', 'heavy_strike', 'expose', 'volatile_slash', 'strike'];

/** Hand biased toward defense cards */
const DEFENSE_HAND = ['block', 'iron_ward', 'parry', 'block', 'brace'];

/** Basic combat config */
function basicCombat(overrides: Partial<RecipeConfig> = {}): RecipeConfig {
  return {
    screen: 'combat',
    enemy: 'page_flutter',
    playerHp: 100,
    playerMaxHp: 100,
    hand: STANDARD_HAND,
    floor: 1,
    ...overrides,
  };
}

/**
 * Map a relic trigger to the optimal setup conditions for observing it.
 */
function configForTrigger(trigger: RelicTrigger, relicId: string): Partial<RecipeConfig> {
  switch (trigger) {
    case 'on_encounter_start':
      // Fires automatically at encounter start
      return {};

    case 'on_turn_start':
    case 'on_turn_end':
      // Fires each turn — just need to be in combat
      return {};

    case 'on_attack':
      return { hand: ATTACK_HAND };

    case 'on_block':
      return { hand: DEFENSE_HAND };

    case 'on_correct_answer':
    case 'on_charge_correct':
      return { hand: STANDARD_HAND };

    case 'on_wrong_answer':
    case 'on_charge_wrong':
      return { hand: STANDARD_HAND };

    case 'on_damage_taken':
    case 'on_hp_loss':
      // Low HP so enemy attacks matter
      return { playerHp: 50, playerMaxHp: 100, hand: DEFENSE_HAND };

    case 'on_lethal':
      // Very low HP to trigger lethal save
      return { playerHp: 5, playerMaxHp: 100, enemy: 'final_exam', floor: 3 };

    case 'on_kill':
    case 'on_elite_kill':
      // Enemy at low HP so first hit kills
      return {
        turnOverrides: { enemyCurrentHp: 1 },
        hand: ATTACK_HAND,
      };

    case 'on_boss_kill':
      return {
        enemy: 'final_exam',
        floor: 3,
        turnOverrides: { enemyCurrentHp: 1 },
        hand: ATTACK_HAND,
      };

    case 'on_speed_bonus':
      return { hand: STANDARD_HAND };

    case 'on_perfect_turn':
      // No damage taken this turn — stay at full HP
      return { playerHp: 100, playerMaxHp: 100, hand: STANDARD_HAND };

    case 'on_card_play':
      return { hand: FULL_HAND };

    case 'on_echo_play':
      return { hand: STANDARD_HAND };

    case 'on_card_skip':
      return { hand: STANDARD_HAND };

    case 'on_multi_hit':
      return { hand: ['multi_hit', 'strike', 'block', 'heavy_strike', 'expose'] };

    case 'on_chain_complete':
      return {
        hand: STANDARD_HAND,
        turnOverrides: { chainLength: 4, chainBroken: false },
      };

    case 'on_chain_break':
      // Mixed domain hand to break chain
      return {
        hand: STANDARD_HAND,
        turnOverrides: { chainLength: 3 },
      };

    case 'on_surge_start':
      return {
        hand: STANDARD_HAND,
        turnOverrides: { isSurge: true },
      };

    case 'on_overheal':
      // At full HP with a lifetap card — lifetap triggers overheal
      return {
        playerHp: 100,
        playerMaxHp: 100,
        hand: ['lifetap', 'strike', 'block', 'heavy_strike', 'expose'],
      };

    case 'on_exhaust':
      // Inscription cards exhaust on use
      return { hand: ['inscription', 'strike', 'block', 'heavy_strike', 'expose'] };

    case 'on_discard':
      // Cards get discarded at end of turn
      return { hand: STANDARD_HAND };

    case 'on_parry':
      return {
        hand: DEFENSE_HAND,
        playerHp: 80,
        playerMaxHp: 100,
      };

    case 'on_encounter_end':
    case 'permanent':
    case 'on_run_start':
    case 'on_floor_advance':
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Recipe Generators
// ---------------------------------------------------------------------------

/** Generate relic recipes from RELIC_BY_ID */
function generateRelicRecipes(): RecipeEntry[] {
  return Object.values(RELIC_BY_ID).map((relic) => {
    const triggerOverrides = configForTrigger(relic.trigger, relic.id);
    const config = basicCombat({
      relics: [relic.id],
      ...triggerOverrides,
    });

    return {
      category: 'relic',
      id: relic.id,
      name: relic.name,
      description: `Test relic "${relic.name}" (trigger: ${relic.trigger}): ${relic.description}`,
      config,
    };
  });
}

/** Generate enemy recipes from ENEMY_TEMPLATES */
function generateEnemyRecipes(): RecipeEntry[] {
  return ENEMY_TEMPLATES.map((enemy) => {
    // Player HP scaled to enemy difficulty
    const playerHp =
      enemy.category === 'common' ? 100 :
      enemy.category === 'elite' ? 80 :
      60;

    // Floor scaled to enemy region
    const floorByRegion: Record<string, number> = {
      shallow_depths: 1,
      deep_caverns: 4,
      the_abyss: 8,
      the_archive: 12,
    };
    const floor = floorByRegion[enemy.region] ?? 1;

    // Boss fights get some relics for a realistic encounter
    const relics = (enemy.category === 'boss' || enemy.category === 'mini_boss')
      ? ['leather_satchel', 'ember_core']
      : undefined;

    const turnOverrides: Record<string, unknown> = {};
    if (enemy.phaseTransitionAt !== undefined) {
      // Set enemy HP near phase transition threshold (use baseHP as rough proxy)
      turnOverrides['enemyNearPhaseTransition'] = true;
      turnOverrides['phaseTransitionAt'] = enemy.phaseTransitionAt;
    }

    const config: RecipeConfig = {
      screen: 'combat',
      enemy: enemy.id,
      playerHp,
      playerMaxHp: 100,
      hand: ['strike', 'block', 'heavy_strike', 'expose', 'block'],
      floor,
      ...(relics ? { relics } : {}),
      ...(Object.keys(turnOverrides).length ? { turnOverrides } : {}),
    };

    return {
      category: 'enemy',
      id: enemy.id,
      name: enemy.name,
      description: `Fight "${enemy.name}" (${enemy.category}, ${enemy.region}, ${enemy.baseHP} base HP)${enemy.phaseTransitionAt ? ` — phase transition at ${enemy.phaseTransitionAt * 100}% HP` : ''}`,
      config,
    };
  });
}

/** Status effect configurations: [id, stacks, duration, description] */
const STATUS_EFFECT_SPECS: Array<[string, number, number, string]> = [
  ['poison',                    5,  3, 'deals damage each turn'],
  ['regen',                     3,  5, 'heals HP each turn'],
  ['strength',                  2, 99, 'bonus attack damage'],
  ['weakness',                  1,  3, 'reduced attack damage'],
  ['vulnerable',                1,  3, 'take increased damage'],
  ['immunity',                  1,  1, 'block next debuff'],
  ['burn',                      3,  3, 'stacking damage on actions'],
  ['bleed',                     2,  4, 'damage when attacked'],
  ['charge_damage_amp_percent', 2,  3, 'amplify charge damage (%)'],
  ['charge_damage_amp_flat',    5,  3, 'amplify charge damage (flat)'],
];

/** Generate status effect recipes (two per effect: on-player and on-enemy) */
function generateStatusEffectRecipes(): RecipeEntry[] {
  const entries: RecipeEntry[] = [];

  for (const [effectId, stacks, duration, desc] of STATUS_EFFECT_SPECS) {
    const statusEntry = { id: effectId, stacks, duration };

    // Player has the effect
    entries.push({
      category: 'status_effect',
      id: `${effectId}_on_player`,
      name: `${effectId} (on player)`,
      description: `Test status effect "${effectId}" on the player — ${desc}`,
      config: basicCombat({
        turnOverrides: {
          playerState: {
            statusEffects: [statusEntry],
          },
        },
      }),
    });

    // Enemy has the effect
    entries.push({
      category: 'status_effect',
      id: `${effectId}_on_enemy`,
      name: `${effectId} (on enemy)`,
      description: `Test status effect "${effectId}" on the enemy — ${desc}`,
      config: basicCombat({
        turnOverrides: {
          enemy: {
            statusEffects: [statusEntry],
          },
        },
      }),
    });
  }

  return entries;
}

/** Generate mechanic recipes from MECHANIC_BY_ID */
function generateMechanicRecipes(): RecipeEntry[] {
  return Object.values(MECHANIC_BY_ID).map((mechanic) => {
    // Fill the rest of the hand with standard cards
    const otherCards = STANDARD_HAND.filter((id) => id !== mechanic.id).slice(0, 4);
    const hand = [mechanic.id, ...otherCards];

    return {
      category: 'mechanic',
      id: mechanic.id,
      name: mechanic.name,
      description: `Test mechanic "${mechanic.name}" (type: ${mechanic.type}, AP cost: ${mechanic.apCost})`,
      config: basicCombat({
        hand,
        turnOverrides: {
          // Ensure enough AP to play the card
          playerAp: mechanic.apCost + 1,
        },
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Lazy Singleton Cache
// ---------------------------------------------------------------------------

let _cachedRecipes: RecipeEntry[] | null = null;

/**
 * Generate all recipes. Results are cached after first call.
 */
export function generateRecipes(): RecipeEntry[] {
  if (_cachedRecipes !== null) return _cachedRecipes;

  _cachedRecipes = [
    ...generateRelicRecipes(),
    ...generateEnemyRecipes(),
    ...generateStatusEffectRecipes(),
    ...generateMechanicRecipes(),
  ];

  return _cachedRecipes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a recipe by ID. Searches across all categories.
 *
 * Accepts:
 *   - Bare ID:        'soul_jar', 'algorithm', 'poison', 'strike'
 *   - Prefixed ID:    'relic:soul_jar', 'enemy:algorithm', 'mechanic:strike'
 *   - Status effect:  'status_effect:poison_on_player', 'poison_on_player'
 */
export function getRecipe(id: string): RecipeEntry | undefined {
  const recipes = generateRecipes();

  // Try exact match on recipe.id first
  const exact = recipes.find((r) => r.id === id);
  if (exact) return exact;

  // Try stripping category prefix (e.g. 'relic:soul_jar' → 'soul_jar')
  const colonIdx = id.indexOf(':');
  if (colonIdx !== -1) {
    const category = id.slice(0, colonIdx);
    const bareId = id.slice(colonIdx + 1);

    const prefixed = recipes.find((r) => r.category === category && r.id === bareId);
    if (prefixed) return prefixed;

    // Also try exact id match with the bare part (for 'status_effect:poison_on_player')
    const prefixedExact = recipes.find((r) => r.id === bareId);
    if (prefixedExact) return prefixedExact;
  }

  // Fuzzy: match any recipe whose id contains the query
  return recipes.find((r) => r.id.includes(id));
}

/**
 * Pretty-print all recipes grouped by category via console.table.
 */
export function listRecipes(): void {
  const recipes = generateRecipes();

  const grouped: Record<string, Array<{ id: string; name: string; description: string }>> = {};
  for (const r of recipes) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push({ id: r.id, name: r.name, description: r.description });
  }

  for (const [category, entries] of Object.entries(grouped)) {
    console.group(`[scenarioRecipes] ${category} (${entries.length})`);
    console.table(entries);
    console.groupEnd();
  }
}

/**
 * Return all recipes for a given category.
 *
 * @param category - 'relic' | 'enemy' | 'status_effect' | 'mechanic'
 */
export function getRecipesByCategory(category: string): RecipeEntry[] {
  return generateRecipes().filter((r) => r.category === category);
}
