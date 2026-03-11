// === Enemy Types and Roster ===
// Pure logic layer for enemy definitions in the card roguelite.
// NO Phaser, Svelte, or DOM imports.

import type { StatusEffectType, StatusEffect } from './statusEffects';
import type { FactDomain } from './card-types';

/** Enemy difficulty category. */
export type EnemyCategory = 'common' | 'elite' | 'mini_boss' | 'boss';

/** A single intent in an enemy's action pool. */
export interface EnemyIntent {
  /** The action type this intent represents. */
  type: 'attack' | 'defend' | 'buff' | 'debuff' | 'heal' | 'multi_attack' | 'charge';
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
  /** Whether this intent bypasses the per-turn damage cap (used for charged attacks). */
  bypassDamageCap?: boolean;
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
  /** Current block/shield amount. Absorbs damage before HP. Resets at start of enemy turn. */
  block: number;
  /** The pre-rolled next action. */
  nextIntent: EnemyIntent;
  /** Active status effects on this enemy. */
  statusEffects: StatusEffect[];
  /** Current phase (1 or 2). */
  phase: 1 | 2;
  /** The floor this enemy was spawned on. Used for damage scaling. */
  floor: number;
  /** Whether the enemy is currently charging an attack. */
  isCharging: boolean;
  /** The base damage value of the pending charged attack. */
  chargedDamage: number;
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
    baseHP: 30,
    intentPool: [
      { type: 'attack', value: 11, weight: 3, telegraph: 'Swooping strike' },
      { type: 'attack', value: 15, weight: 1, telegraph: 'Frenzied bite' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Screeching', statusEffect: { type: 'strength', value: 1, turns: 2 } },
    ],
    description: 'A common cave-dwelling bat. Quick but fragile.',
  },

  {
    id: 'crystal_golem',
    name: 'Crystal Golem',
    category: 'common',
    baseHP: 55,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Crystal slam' },
      { type: 'defend', value: 8, weight: 2, telegraph: 'Hardening crystals' },
      { type: 'charge', value: 25, weight: 1, telegraph: 'Charging: Crystal Crush!' },
    ],
    description: 'A slow golem encrusted with resonating crystals.',
  },

  {
    id: 'toxic_spore',
    name: 'Toxic Spore',
    category: 'common',
    baseHP: 25,
    intentPool: [
      { type: 'attack', value: 10, weight: 2, telegraph: 'Spore burst' },
      { type: 'debuff', value: 2, weight: 3, telegraph: 'Toxic cloud', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Weakening mist', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'A fungal growth that releases debilitating spores.',
  },

  {
    id: 'shadow_mimic',
    name: 'Shadow Mimic',
    category: 'common',
    baseHP: 38,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Shadow strike' },
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Flurry of shadows', hitCount: 3 },
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
      { type: 'charge', value: 30, weight: 1, telegraph: 'Charging: Burrowing Devastation!' },
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
    baseHP: 70,
    intentPool: [
      { type: 'attack', value: 16, weight: 2, telegraph: 'Drill charge' },
      { type: 'multi_attack', value: 5, weight: 1, telegraph: 'Grinding gears', hitCount: 4 },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Reinforcing plating' },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Oil slick', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'A corrupted mining machine, still drilling after millennia.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 20, weight: 2, telegraph: 'Overdrive slam' },
      { type: 'multi_attack', value: 6, weight: 2, telegraph: 'Drill barrage', hitCount: 3 },
      { type: 'defend', value: 10, weight: 1, telegraph: 'Emergency plating' },
      { type: 'charge', value: 35, weight: 1, telegraph: 'Charging: Overdrive Burst!' },
    ],
  },

  {
    id: 'magma_core',
    name: 'Magma Core',
    category: 'boss',
    baseHP: 75,
    intentPool: [
      { type: 'attack', value: 8, weight: 1, telegraph: 'Lava splash' },
      { type: 'attack', value: 15, weight: 1, telegraph: 'Eruption' },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Searing heat', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'buff', value: 3, weight: 1, telegraph: 'Magma surge', statusEffect: { type: 'strength', value: 2, turns: 3 } },
    ],
    description: 'A living core of molten rock. Radiates intense heat.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 22, weight: 2, telegraph: 'Volcanic blast' },
      { type: 'multi_attack', value: 7, weight: 1, telegraph: 'Magma rain', hitCount: 4 },
      { type: 'debuff', value: 4, weight: 1, telegraph: 'Meltdown', statusEffect: { type: 'poison', value: 4, turns: 3 } },
    ],
  },

  {
    id: 'the_archivist',
    name: 'The Archivist',
    category: 'boss',
    baseHP: 85,
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

  {
    id: 'crystal_warden',
    name: 'Crystal Warden',
    category: 'boss',
    baseHP: 90,
    intentPool: [
      { type: 'attack', value: 12, weight: 4, telegraph: 'Prismatic slash' },
      { type: 'defend', value: 10, weight: 3, telegraph: 'Crystal barrier' },
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Shard storm', hitCount: 3 },
      { type: 'heal', value: 8, weight: 1, telegraph: 'Crystalline mend' },
    ],
    description: 'A towering sentinel of living crystal. Immune to status effects, it guards the deep caverns with unwavering resolve.',
  },

  {
    id: 'shadow_hydra',
    name: 'Shadow Hydra',
    category: 'boss',
    baseHP: 110,
    intentPool: [
      { type: 'attack', value: 14, weight: 35, telegraph: 'Hydra strike' },
      { type: 'multi_attack', value: 5, weight: 30, telegraph: 'Twin fangs', hitCount: 3 },
      { type: 'debuff', value: 3, weight: 20, telegraph: 'Venom spray', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'attack', value: 10, weight: 15, telegraph: 'Tail lash' },
    ],
    description: 'A many-headed beast of shadow. At half strength, a second head awakens, doubling its fury.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'multi_attack', value: 7, weight: 3, telegraph: 'Dual hydra strike', hitCount: 2 },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Fang barrage', hitCount: 4 },
      { type: 'debuff', value: 4, weight: 2, telegraph: 'Toxic deluge', statusEffect: { type: 'poison', value: 4, turns: 3 } },
      { type: 'attack', value: 18, weight: 1, telegraph: 'Decapitation bite' },
    ],
  },

  {
    id: 'void_weaver',
    name: 'Void Weaver',
    category: 'boss',
    baseHP: 125,
    intentPool: [
      { type: 'attack', value: 18, weight: 4, telegraph: 'Void bolt' },
      { type: 'multi_attack', value: 6, weight: 2, telegraph: 'Void storm', hitCount: 3 },
      { type: 'debuff', value: 3, weight: 15, telegraph: 'Reality tear', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'debuff', value: 2, weight: 15, telegraph: 'Hand disruption', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'defend', value: 12, weight: 1, telegraph: 'Phase shift' },
    ],
    description: 'A being woven from the spaces between dimensions. Its attacks disrupt not just flesh, but thought itself.',
  },

  {
    id: 'knowledge_golem',
    name: 'Knowledge Golem',
    category: 'boss',
    baseHP: 120,
    intentPool: [
      { type: 'attack', value: 15, weight: 35, telegraph: 'Tome slam' },
      { type: 'attack', value: 17, weight: 25, telegraph: 'Crushing knowledge' },
      { type: 'defend', value: 10, weight: 20, telegraph: 'Page shield' },
      { type: 'buff', value: 2, weight: 20, telegraph: 'Absorb text', statusEffect: { type: 'strength', value: 2, turns: 3 } },
      { type: 'charge', value: 32, weight: 1, telegraph: 'Charging: Tome Avalanche!' },
    ],
    description: 'An ancient construct built from compressed tomes. Deals bonus damage when knowledge fails — wrong answers empower it.',
  },

  {
    id: 'the_curator',
    name: 'The Curator',
    category: 'boss',
    baseHP: 140,
    intentPool: [
      { type: 'attack', value: 16, weight: 25, telegraph: 'Cataloguing strike' },
      { type: 'multi_attack', value: 5, weight: 20, telegraph: 'Archive barrage', hitCount: 4 },
      { type: 'debuff', value: 3, weight: 20, telegraph: 'Forgotten lore', statusEffect: { type: 'weakness', value: 2, turns: 2 } },
      { type: 'buff', value: 3, weight: 15, telegraph: 'Ancient wisdom', statusEffect: { type: 'strength', value: 2, turns: 3 } },
      { type: 'heal', value: 12, weight: 10, telegraph: 'Restoration protocol' },
      { type: 'attack', value: 18, weight: 10, telegraph: 'Final examination' },
    ],
    description: 'The ultimate guardian of the Archive. Master of all knowledge domains, it tests the worth of those who dare reach the deepest floor.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 16, weight: 3, telegraph: 'Judgement' },
      { type: 'multi_attack', value: 7, weight: 2, telegraph: 'Knowledge storm', hitCount: 4 },
      { type: 'debuff', value: 4, weight: 2, telegraph: 'Mind shatter', statusEffect: { type: 'vulnerable', value: 2, turns: 3 } },
      { type: 'heal', value: 10, weight: 1, telegraph: 'Archive restoration' },
      { type: 'buff', value: 3, weight: 1, telegraph: 'Final form', statusEffect: { type: 'strength', value: 3, turns: 5 } },
    ],
  },

  // ── MINI-BOSS (6) ──

  {
    id: 'crystal_guardian',
    name: 'Crystal Guardian',
    category: 'mini_boss',
    baseHP: 52,
    intentPool: [
      { type: 'attack', value: 11, weight: 3, telegraph: 'Crystal strike' },
      { type: 'defend', value: 6, weight: 3, telegraph: 'Stone shell' },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Shard eruption' },
    ],
    description: 'A golem variant encased in protective crystal. Gains block every turn.',
  },

  {
    id: 'venomfang',
    name: 'Venomfang',
    category: 'mini_boss',
    baseHP: 45,
    intentPool: [
      { type: 'attack', value: 10, weight: 3, telegraph: 'Fang strike' },
      { type: 'debuff', value: 2, weight: 3, telegraph: 'Venom bite', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'multi_attack', value: 3, weight: 1, telegraph: 'Rapid fangs', hitCount: 3 },
    ],
    description: 'A venomous spider lurking in the shadows. Its bites leave a lingering poison.',
  },

  {
    id: 'stone_sentinel',
    name: 'Stone Sentinel',
    category: 'mini_boss',
    baseHP: 60,
    intentPool: [
      { type: 'attack', value: 10, weight: 2, telegraph: 'Heavy swing' },
      { type: 'defend', value: 10, weight: 3, telegraph: 'Fortify' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Harden', statusEffect: { type: 'strength', value: 1, turns: 3 } },
      { type: 'charge', value: 28, weight: 1, telegraph: 'Charging: Seismic Slam!' },
    ],
    description: 'An ancient stone warrior. Slow but incredibly tough — a war of attrition.',
  },

  {
    id: 'ember_drake',
    name: 'Ember Drake',
    category: 'mini_boss',
    baseHP: 48,
    intentPool: [
      { type: 'attack', value: 10, weight: 3, telegraph: 'Fire breath' },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Inferno blast' },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Scorching heat', statusEffect: { type: 'poison', value: 2, turns: 2 } },
    ],
    description: 'A small but ferocious drake. Glass cannon — hits hard but shatters easily.',
  },

  {
    id: 'shade_stalker',
    name: 'Shade Stalker',
    category: 'mini_boss',
    baseHP: 42,
    intentPool: [
      { type: 'attack', value: 11, weight: 3, telegraph: 'Shadow lunge' },
      { type: 'multi_attack', value: 3, weight: 2, telegraph: 'Phantom copies', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Expose weakness', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
    description: 'An enhanced shadow that copies the player\'s last played card type. More dangerous than its mimic cousin.',
  },

  {
    id: 'bone_collector',
    name: 'Bone Collector',
    category: 'mini_boss',
    baseHP: 54,
    intentPool: [
      { type: 'attack', value: 10, weight: 3, telegraph: 'Bone slash' },
      { type: 'heal', value: 5, weight: 2, telegraph: 'Consume remains' },
      { type: 'defend', value: 6, weight: 1, telegraph: 'Bone armor' },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Marrow drain', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'A skeletal scavenger that feeds on failure. Heals when the player answers wrong.',
  },
];
