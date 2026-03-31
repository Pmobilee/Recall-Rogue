/**
 * Scenario Schema — runtime schema discovery for LLM playtest agents.
 *
 * Walks activeTurnState and activeRunState Svelte stores to produce a
 * human/LLM-readable list of all available game state fields.
 *
 * DEV MODE ONLY — never included in production builds.
 */

import { readStore } from './storeBridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaField {
  /** Dotted path like "turnState.chainMultiplier" or "runState.ascensionLevel" */
  path: string;
  /** JS type: "number", "string", "boolean", "Set<string>", "StatusEffect[]", etc. */
  type: string;
  /** Current live value (for context) */
  currentValue: unknown;
  /** Human description (from FIELD_DESCRIPTIONS map, null if unmapped) */
  description: string | null;
  /** Valid enum values if applicable (e.g. status effect types) */
  validValues?: string[];
}

// ---------------------------------------------------------------------------
// Enum definitions
// ---------------------------------------------------------------------------

const VALID_ENUMS: Record<string, string[]> = {
  'turnState.phase': ['draw', 'player_action', 'enemy_turn', 'turn_end', 'encounter_end'],
  'turnState.result': ['victory', 'defeat', 'null'],
  'statusEffectType': ['poison', 'regen', 'strength', 'weakness', 'vulnerable', 'immunity', 'burn', 'bleed', 'charge_damage_amp_percent', 'charge_damage_amp_flat'],
  'runState.selectedArchetype': ['balanced', 'aggressive', 'defensive', 'control', 'hybrid'],
  'cardType': ['attack', 'shield', 'utility', 'buff', 'debuff', 'wild'],
};

// ---------------------------------------------------------------------------
// Field descriptions
// ---------------------------------------------------------------------------

const FIELD_DESCRIPTIONS: Record<string, string> = {
  // TurnState fields
  'turnState.phase': 'Current turn phase',
  'turnState.turnNumber': 'Global turn counter (persists across encounters, used by Surge)',
  'turnState.encounterTurnNumber': 'Per-encounter turn counter (resets each fight, used by enrage)',
  'turnState.apCurrent': 'Action Points available this turn',
  'turnState.apMax': 'Maximum AP this turn',
  'turnState.bonusApNextTurn': 'Extra AP to add at start of next turn',
  'turnState.baseDrawCount': 'Base cards drawn per turn',
  'turnState.bonusDrawNextTurn': 'Extra cards drawn next turn',
  'turnState.cardsPlayedThisTurn': 'Cards played so far this turn',
  'turnState.cardsCorrectThisTurn': 'Correct Charge answers this turn',
  'turnState.damageDealtThisTurn': 'Total damage dealt this turn',
  'turnState.chainMultiplier': 'Knowledge Chain damage multiplier (1.0–3.0)',
  'turnState.chainLength': 'Current chain length (0–5)',
  'turnState.chainType': 'Current chain type index (0–5) or null',
  'turnState.isSurge': 'Whether this is a Surge turn (Charge costs +0 AP)',
  'turnState.isPerfectTurn': 'No damage taken this turn',
  'turnState.result': "Encounter result: 'victory', 'defeat', or null (in progress)",
  'turnState.buffNextCard': 'Empower buff value on next card played',
  'turnState.firstAttackUsed': 'Whether first free attack was used',
  'turnState.doubleStrikeReady': 'Strike double bonus ready',
  'turnState.focusReady': 'Focus AP reduction active',
  'turnState.focusCharges': 'Remaining Focus AP reduction charges',
  'turnState.overclockReady': 'Overclock ready flag',
  'turnState.foresightTurnsRemaining': 'Foresight vision buff turns left',
  'turnState.persistentShield': 'Block carrying to next turn',
  'turnState.thornsActive': 'Thorns retaliation active',
  'turnState.thornsValue': 'Thorns damage to reflect',
  'turnState.staggeredEnemyNextTurn': "Enemy's next turn will be skipped",
  'turnState.ignitePendingBurn': 'Burn stacks to add to next attack',
  'turnState.battleTranceRestriction': 'No more card plays allowed this turn',
  'turnState.warcryFreeChargeActive': 'Next Charge surcharge is waived',
  'turnState.chainAnchorActive': 'Chain starter boost active',
  'turnState.phoenixAutoChargeTurns': 'Auto-succeed Charges remaining (phoenix)',
  'turnState.phoenixRageTurnsRemaining': 'Phoenix Rage +50% damage turns remaining',
  'turnState.encounterChargesTotal': 'Total Charge plays this encounter',
  'turnState.activeInscriptions': 'Persistent card effects active in this combat',
  'turnState.playerState.hp': 'Player current HP',
  'turnState.playerState.maxHP': 'Player maximum HP',
  'turnState.playerState.shield': 'Player block/shield',
  'turnState.playerState.statusEffects': 'Player active status effects',
  'turnState.enemy.currentHP': 'Enemy current HP',
  'turnState.enemy.maxHP': 'Enemy maximum HP',
  'turnState.enemy.block': 'Enemy block/shield',
  'turnState.enemy.statusEffects': 'Enemy active status effects',
  'turnState.enemy.phase': 'Enemy combat phase (1 or 2)',
  'turnState.enemy.isCharging': 'Enemy is charging an attack',
  'turnState.enemy.chargedDamage': 'Charged attack damage value',
  'turnState.enemy.nextIntent': "Enemy's next action",

  // RunState fields
  'runState.ascensionLevel': 'Challenge difficulty level (0–20)',
  'runState.playerHp': 'Player HP (run-level)',
  'runState.playerMaxHp': 'Player max HP (run-level)',
  'runState.currency': 'Gold/dust earned this run',
  'runState.floor.currentFloor': 'Current dungeon floor (1-indexed)',
  'runState.floor.segment': 'Dungeon segment (1–4)',
  'runState.encountersWon': 'Encounters won this run',
  'runState.encountersTotal': 'Total encounters faced',
  'runState.elitesDefeated': 'Elites defeated this run',
  'runState.bossesDefeated': 'Bosses defeated this run',
  'runState.factsAnswered': 'Total quiz questions answered',
  'runState.factsCorrect': 'Correct quiz answers',
  'runState.bestCombo': 'Longest answer streak',
  'runState.soulJarCharges': 'Soul Jar guaranteed-correct charges',
  'runState.phoenixFeatherUsed': 'Phoenix Feather one-time save used',
  'runState.cursedFactIds': 'Set of fact IDs that are cursed',
  'runState.runRelics': 'Relics collected during this run',
  'runState.primaryDomain': 'Main knowledge domain for this run',
  'runState.selectedArchetype': 'Reward archetype (balanced/aggressive/defensive/control/hybrid)',
  'runState.globalTurnCounter': 'Global turn counter across all encounters',
};

// ---------------------------------------------------------------------------
// Synthetic defaults for schema generation when no live state exists
// ---------------------------------------------------------------------------

const SYNTHETIC_TURN_STATE: Record<string, unknown> = {
  phase: 'player_action',
  turnNumber: 1,
  encounterTurnNumber: 1,
  apCurrent: 3,
  apMax: 3,
  bonusApNextTurn: 0,
  baseDrawCount: 5,
  bonusDrawNextTurn: 0,
  cardsPlayedThisTurn: 0,
  cardsCorrectThisTurn: 0,
  damageDealtThisTurn: 0,
  chainMultiplier: 1.0,
  chainLength: 0,
  chainType: null,
  isSurge: false,
  isPerfectTurn: true,
  result: null,
  buffNextCard: 0,
  firstAttackUsed: false,
  doubleStrikeReady: false,
  focusReady: false,
  focusCharges: 0,
  overclockReady: false,
  foresightTurnsRemaining: 0,
  persistentShield: 0,
  thornsActive: false,
  thornsValue: 0,
  staggeredEnemyNextTurn: false,
  ignitePendingBurn: 0,
  battleTranceRestriction: false,
  warcryFreeChargeActive: false,
  chainAnchorActive: false,
  phoenixAutoChargeTurns: 0,
  phoenixRageTurnsRemaining: 0,
  encounterChargesTotal: 0,
  activeInscriptions: [],
  playerState: {
    hp: 80,
    maxHP: 80,
    shield: 0,
    statusEffects: [],
  },
  enemy: {
    currentHP: 40,
    maxHP: 40,
    block: 0,
    statusEffects: [],
    phase: 1,
    isCharging: false,
    chargedDamage: 0,
    nextIntent: null,
  },
};

const SYNTHETIC_RUN_STATE: Record<string, unknown> = {
  ascensionLevel: 0,
  playerHp: 80,
  playerMaxHp: 80,
  currency: 0,
  floor: {
    currentFloor: 1,
    segment: 1,
  },
  encountersWon: 0,
  encountersTotal: 0,
  elitesDefeated: 0,
  bossesDefeated: 0,
  factsAnswered: 0,
  factsCorrect: 0,
  bestCombo: 0,
  soulJarCharges: 0,
  phoenixFeatherUsed: false,
  cursedFactIds: new Set<string>(),
  runRelics: [],
  primaryDomain: 'history',
  selectedArchetype: 'balanced',
  globalTurnCounter: 0,
};

// ---------------------------------------------------------------------------
// Type detection helpers
// ---------------------------------------------------------------------------

/**
 * Returns a descriptive type string for a value.
 * Handles Sets, arrays of objects, primitives, and null/undefined.
 */
function detectType(val: unknown, path: string): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val instanceof Set) return 'Set<string>';
  if (Array.isArray(val)) {
    if (val.length === 0) {
      // Infer from path name
      if (path.includes('statusEffect')) return 'StatusEffect[]';
      if (path.includes('Relic') || path.includes('relic')) return 'Relic[]';
      if (path.includes('inscription') || path.includes('Inscription')) return 'string[]';
      return 'unknown[]';
    }
    const first = val[0];
    if (typeof first === 'string') return 'string[]';
    if (typeof first === 'number') return 'number[]';
    if (typeof first === 'object' && first !== null) {
      // Name the array type from the path
      if (path.includes('statusEffect')) return 'StatusEffect[]';
      if (path.includes('Relic') || path.includes('relic')) return 'Relic[]';
      if (path.includes('inscription') || path.includes('Inscription')) return 'Inscription[]';
      return 'object[]';
    }
    return 'unknown[]';
  }
  return typeof val;
}

/**
 * Returns true if a value should be treated as a leaf (not recursed into).
 * Arrays of objects and Sets are leaf-like — we describe the shape, not each element.
 */
function isLeaf(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (val instanceof Set) return true;
  if (Array.isArray(val)) return true; // treat all arrays as leaves
  return typeof val !== 'object';
}

// ---------------------------------------------------------------------------
// Recursive walker
// ---------------------------------------------------------------------------

/**
 * Recursively walks an object and produces SchemaField entries for each leaf.
 */
function walkObject(
  obj: Record<string, unknown>,
  prefix: string,
  fields: SchemaField[],
): void {
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isLeaf(val)) {
      const type = detectType(val, path);
      const field: SchemaField = {
        path,
        type,
        currentValue: val instanceof Set ? Array.from(val as Set<unknown>) : val,
        description: FIELD_DESCRIPTIONS[path] ?? null,
      };
      const enumKey = VALID_ENUMS[path];
      if (enumKey) field.validValues = enumKey;
      fields.push(field);
    } else {
      // Recurse into plain objects
      walkObject(val as Record<string, unknown>, path, fields);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Walks the current activeTurnState and activeRunState Svelte stores to
 * produce a human/LLM-readable list of all available game state fields.
 *
 * If no active run exists, uses synthetic defaults so schema discovery
 * always returns a complete field list regardless of game state.
 */
export function generateSchema(): SchemaField[] {
  const fields: SchemaField[] = [];

  // --- TurnState ---
  const liveTurnState = readStore<Record<string, unknown>>('rr:activeTurnState');
  if (liveTurnState == null) {
    console.warn('[scenarioSchema] activeTurnState store not found — using synthetic defaults');
  }
  const turnData = liveTurnState ?? SYNTHETIC_TURN_STATE;
  walkObject(turnData, 'turnState', fields);

  // --- RunState ---
  const liveRunState = readStore<Record<string, unknown>>('rr:activeRunState');
  if (liveRunState == null) {
    console.warn('[scenarioSchema] activeRunState store not found — using synthetic defaults');
  }
  const runData = liveRunState ?? SYNTHETIC_RUN_STATE;
  walkObject(runData, 'runState', fields);

  return fields;
}

/**
 * Pretty-prints the schema as a console.table grouped by top-level prefix
 * (turnState.*, runState.*).
 */
export function formatSchemaForConsole(fields: SchemaField[]): void {
  const groups: Record<string, SchemaField[]> = {};

  for (const field of fields) {
    const prefix = field.path.split('.')[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(field);
  }

  for (const [group, groupFields] of Object.entries(groups)) {
    console.group(`[scenarioSchema] ${group} (${groupFields.length} fields)`);
    console.table(
      groupFields.map(f => ({
        path: f.path,
        type: f.type,
        currentValue: f.currentValue,
        description: f.description ?? '—',
        validValues: f.validValues?.join(' | ') ?? '',
      })),
    );
    console.groupEnd();
  }
}
