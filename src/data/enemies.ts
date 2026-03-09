// === Enemy Types and Roster ===
// Pure logic layer for enemy definitions in the card roguelite.
// NO Phaser, Svelte, or DOM imports.

import type { StatusEffectType, StatusEffect } from './statusEffects';
import type { FactDomain } from './card-types';

/** Enemy difficulty category. */
export type EnemyCategory = 'common' | 'elite' | 'boss';

/** A single intent in an enemy's action pool. */
export interface EnemyIntent {
  /** The action type this intent represents. */
  type: 'attack' | 'defend' | 'buff' | 'debuff' | 'heal' | 'multi_attack';
  /** Base numeric value of the intent (damage, heal amount, etc.). */
  value: number;
  /** Weighted probability of this intent being selected. */
  weight: number;
  /** Player-facing telegraph text describing the upcoming action. */
  telegraph: string;
  /** Optional status effect applied by this intent. */
  statusEffect?: { type: StatusEffectType; value: number; turns: number };
  /** Number of hits for multi-attack intents. */
  hitCount?: number;
}

/** Template definition for an enemy type. */
export interface EnemyTemplate {
  /** Unique identifier for this enemy type. */
  id: string;
  /** Display name. */
  name: string;
  /** Difficulty category. */
  category: EnemyCategory;
  /** Base hit points (scaled by floor). */
  baseHP: number;
  /** Pool of possible actions in phase 1 (or only phase). */
  intentPool: EnemyIntent[];
  /** Flavor description. */
  description: string;
  /** Domain that this enemy is immune to (cards of this domain deal 0 damage). */
  immuneDomain?: FactDomain;
  /** HP percentage at which the enemy transitions to phase 2 (0-1). */
  phaseTransitionAt?: number;
  /** Pool of possible actions in phase 2. */
  phase2IntentPool?: EnemyIntent[];
}

/** A live enemy instance in an encounter. */
export interface EnemyInstance {
  /** The template this instance is based on. */
  template: EnemyTemplate;
  /** Current hit points. */
  currentHP: number;
  /** Maximum hit points (after floor scaling). */
  maxHP: number;
  /** The pre-rolled next action. */
  nextIntent: EnemyIntent;
  /** Active status effects on this enemy. */
  statusEffects: StatusEffect[];
  /** Current phase (1 or 2). */
  phase: 1 | 2;
}

// ============================================================
// ENEMY ROSTER
// ============================================================

/** Complete roster of enemy templates for the card roguelite. */
export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  // ── COMMON (4) ──

  {
    id: 'cave_bat',
    name: 'Cave Bat',
    category: 'common',
    baseHP: 22,
    intentPool: [
      { type: 'attack', value: 6, weight: 3, telegraph: 'Swooping strike' },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Frenzied bite' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Screeching', statusEffect: { type: 'strength', value: 1, turns: 2 } },
    ],
    description: 'A common cave-dwelling bat. Quick but fragile.',
  },

  {
    id: 'crystal_golem',
    name: 'Crystal Golem',
    category: 'common',
    baseHP: 45,
    intentPool: [
      { type: 'attack', value: 9, weight: 2, telegraph: 'Crystal slam' },
      { type: 'defend', value: 8, weight: 2, telegraph: 'Hardening crystals' },
      { type: 'attack', value: 13, weight: 1, telegraph: 'Shard barrage' },
    ],
    description: 'A slow golem encrusted with resonating crystals.',
  },

  {
    id: 'toxic_spore',
    name: 'Toxic Spore',
    category: 'common',
    baseHP: 18,
    intentPool: [
      { type: 'attack', value: 5, weight: 2, telegraph: 'Spore burst' },
      { type: 'debuff', value: 2, weight: 3, telegraph: 'Toxic cloud', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Weakening mist', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'A fungal growth that releases debilitating spores.',
  },

  {
    id: 'shadow_mimic',
    name: 'Shadow Mimic',
    category: 'common',
    baseHP: 28,
    intentPool: [
      { type: 'attack', value: 7, weight: 2, telegraph: 'Shadow strike' },
      { type: 'multi_attack', value: 2, weight: 2, telegraph: 'Flurry of shadows', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Expose weakness', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
    description: 'A shifting shadow that mimics the miner\'s movements.',
  },

  // ── ELITE (2) ──

  {
    id: 'ore_wyrm',
    name: 'Ore Wyrm',
    category: 'elite',
    baseHP: 58,
    intentPool: [
      { type: 'attack', value: 8, weight: 2, telegraph: 'Tail sweep' },
      { type: 'attack', value: 12, weight: 1, telegraph: 'Crushing bite' },
      { type: 'defend', value: 6, weight: 1, telegraph: 'Burrowing deeper' },
    ],
    description: 'A massive worm that feeds on mineral veins. Enrages when wounded.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'attack', value: 14, weight: 2, telegraph: 'Enraged thrash' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Frenzied bites', hitCount: 3 },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Tremor', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
  },

  {
    id: 'fossil_guardian',
    name: 'Fossil Guardian',
    category: 'elite',
    baseHP: 45,
    intentPool: [
      { type: 'attack', value: 9, weight: 2, telegraph: 'Ancient strike' },
      { type: 'defend', value: 10, weight: 2, telegraph: 'Petrified shield' },
      { type: 'heal', value: 5, weight: 1, telegraph: 'Mineral absorption' },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Calcifying gaze', statusEffect: { type: 'weakness', value: 1, turns: 3 } },
    ],
    description: 'An ancient guardian immune to history-domain knowledge.',
    immuneDomain: 'history',
  },

  // ── BOSS (3) ──

  {
    id: 'the_excavator',
    name: 'The Excavator',
    category: 'boss',
    baseHP: 72,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Drill charge' },
      { type: 'multi_attack', value: 4, weight: 1, telegraph: 'Grinding gears', hitCount: 3 },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Reinforcing plating' },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Oil slick', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'A corrupted mining machine, still drilling after millennia.',
  },

  {
    id: 'magma_core',
    name: 'Magma Core',
    category: 'boss',
    baseHP: 80,
    intentPool: [
      { type: 'attack', value: 8, weight: 1, telegraph: 'Lava splash' },
      { type: 'attack', value: 15, weight: 1, telegraph: 'Eruption' },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Searing heat', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'buff', value: 3, weight: 1, telegraph: 'Magma surge', statusEffect: { type: 'strength', value: 2, turns: 3 } },
    ],
    description: 'A living core of molten rock. Radiates intense heat.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 18, weight: 2, telegraph: 'Volcanic blast' },
      { type: 'multi_attack', value: 6, weight: 1, telegraph: 'Magma rain', hitCount: 3 },
      { type: 'debuff', value: 4, weight: 1, telegraph: 'Meltdown', statusEffect: { type: 'poison', value: 4, turns: 3 } },
    ],
  },

  {
    id: 'the_archivist',
    name: 'The Archivist',
    category: 'boss',
    baseHP: 100,
    intentPool: [
      { type: 'attack', value: 7, weight: 1, telegraph: 'Data beam' },
      { type: 'defend', value: 12, weight: 1, telegraph: 'Firewall' },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'System scan', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'heal', value: 8, weight: 1, telegraph: 'Self-repair' },
    ],
    description: 'The ancient AI librarian, guardian of forgotten knowledge.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Archive purge' },
      { type: 'multi_attack', value: 4, weight: 1, telegraph: 'Rapid queries', hitCount: 4 },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Memory wipe', statusEffect: { type: 'weakness', value: 2, turns: 2 } },
      { type: 'heal', value: 10, weight: 1, telegraph: 'Backup restore' },
    ],
  },
];
