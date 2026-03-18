// === Enemy Types and Roster ===
// Pure logic layer for enemy definitions in the card roguelite.
// NO Phaser, Svelte, or DOM imports.

import type { StatusEffectType, StatusEffect } from './statusEffects';
import { applyStatusEffect } from './statusEffects';
import type { FactDomain } from './card-types';
import type { AnimArchetype } from './enemyAnimations';

/** Enemy difficulty category. */
export type EnemyCategory = 'common' | 'elite' | 'mini_boss' | 'boss';

/** Dungeon region where this enemy spawns. */
export type EnemyRegion = 'shallow_depths' | 'deep_caverns' | 'the_abyss' | 'the_archive';

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

/**
 * Minimal snapshot passed to enemy reaction callbacks.
 * Enemy manager reads this; callbacks may mutate enemy instance fields via the ref.
 */
export interface EnemyReactContext {
  /** The live enemy instance (mutable). */
  enemy: EnemyInstance;
  /** Base damage value of the card just played (before multipliers). */
  cardBaseDamage: number;
  /** The playMode used: 'quick' | 'charge'. */
  playMode: 'quick' | 'charge';
  /** Whether the Charge quiz was answered correctly (false if quick play). */
  chargeCorrect: boolean;
}

/** Context passed to onEnemyTurnStart callbacks. */
export interface EnemyTurnStartContext {
  /** The live enemy instance (mutable). */
  enemy: EnemyInstance;
  /** Current turn number (1-indexed). */
  turnNumber: number;
}

/**
 * Boss Quiz Phase configuration. Combat pauses at each HP threshold.
 * Full runtime implementation handled by AR-59.7 quiz phase service.
 */
export interface QuizPhaseConfig {
  /** HP fraction threshold (0-1) at which this phase triggers. E.g. 0.5 = 50% HP. */
  hpThreshold: number;
  /** Number of questions in this phase. */
  questionCount: number;
  /** Timer in seconds per question (null = use floor default). */
  timerSeconds?: number;
  /** Whether this phase is RAPID FIRE mode (shorter timers, more questions). */
  rapidFire?: boolean;
}

/** Template definition for an enemy type. */
export interface EnemyTemplate {
  /** Unique identifier for this enemy type. */
  id: string;
  /** Display name. */
  name: string;
  /** Difficulty category. */
  category: EnemyCategory;
  /** Dungeon region where this enemy naturally spawns. */
  region: EnemyRegion;
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
  /** Enemy rarity tier (common enemies only). Standard=most common, rare=least. */
  rarity?: 'standard' | 'uncommon' | 'rare';
  /** Spawn weight for weighted selection. Default 10. Standard=10, uncommon=5, rare=2. */
  spawnWeight?: number;
  /** Animation archetype controlling idle/attack/hit tween parameters. */
  animArchetype?: AnimArchetype;
  /** Informational only: the base enemy ID this variant is derived from. */
  variantOf?: string;
  /**
   * Called after a player Charge play resolves as WRONG.
   * Receives a partial combat state snapshot for computing effect values.
   */
  onPlayerChargeWrong?: (ctx: EnemyReactContext) => void;
  /**
   * Called at the end of a player's turn if the player made NO Charge plays that turn.
   * Fires once per turn, regardless of how many Quick Plays were made.
   */
  onPlayerNoCharge?: (ctx: EnemyReactContext) => void;
  /**
   * Called after a player Charge play resolves as CORRECT.
   */
  onPlayerChargeCorrect?: (ctx: EnemyReactContext) => void;
  /**
   * Called at the start of each enemy turn.
   * Used by Timer Wyrm for enrage logic.
   */
  onEnemyTurnStart?: (ctx: EnemyTurnStartContext) => void;
  /**
   * If set, forces all Knowledge Chain multipliers to this value while this enemy is alive.
   * Does not affect Charge multipliers. Used by The Nullifier.
   */
  chainMultiplierOverride?: number;
  /**
   * If true, Quick Play card plays deal 0 damage to this enemy.
   * Charge plays (correct or wrong) deal normal damage.
   * Used by The Librarian.
   */
  quickPlayImmune?: boolean;
  /**
   * Boss Quiz Phase configurations. Combat pauses at each HP threshold.
   * Full spec in AR-59.7. Handled by the quiz phase service (AR-59.7 scope).
   */
  quizPhases?: QuizPhaseConfig[];
  /**
   * Quick Play attacks deal 50% damage against this enemy. Charged attacks deal full damage.
   * Incentivizes players to Charge rather than Quick Play against armored/resistant foes.
   */
  chargeResistant?: boolean;
  /**
   * Chain attacks (2+ chain multiplier) deal +50% damage against this enemy.
   * Incentivizes players to build Knowledge Chains against vulnerable foes.
   */
  chainVulnerable?: boolean;
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
  /** Difficulty variance multiplier applied to both HP and damage (0.8-1.2 for common enemies). */
  difficultyVariance: number;
  /**
   * Cumulative enrage damage bonus added by Timer Wyrm's onEnemyTurnStart hook.
   * Added to all attack intent values before floor scaling. Defaults to 0.
   */
  enrageBonusDamage: number;
  /**
   * Tracks whether the player has made at least one Charge play this turn.
   * Reset to false at the start of every player turn.
   * Read by onPlayerNoCharge logic at end-of-player-turn.
   */
  playerChargedThisTurn: boolean;
}

// ============================================================
// ENEMY ROSTER
// ============================================================

/** Complete roster of enemy templates for the card roguelite. */
export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  // ── COMMON (4) ──

  // ── ACT 1 BASE ENEMIES ──
  // AR-59.13: v2 roster. Stats updated to match phase doc.

  {
    id: 'cave_bat',
    name: 'Cave Bat',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 19,
    intentPool: [
      { type: 'attack', value: 8, weight: 3, telegraph: 'Swooping strike' },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Frenzied bite' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Screeching', statusEffect: { type: 'strength', value: 1, turns: 2 } },
    ],
    description: 'Common cave predator. Fast and fragile. First thing you\'ll see down here.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'swooper',
  },

  {
    id: 'crystal_golem',
    name: 'Crystal Golem',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 32,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Crystal slam' },
      { type: 'defend', value: 8, weight: 2, telegraph: 'Hardening crystals' },
      { type: 'charge', value: 25, weight: 1, telegraph: 'Charging: Crystal Crush!', bypassDamageCap: true },
    ],
    description: 'Crystal-encrusted and slow. Blocks on off-turns, then charges a heavy spike.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'slammer',
    chargeResistant: true,
  },

  {
    id: 'toxic_spore',
    name: 'Toxic Spore',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 15,
    intentPool: [
      { type: 'attack', value: 8, weight: 2, telegraph: 'Spore burst' },
      { type: 'debuff', value: 2, weight: 3, telegraph: 'Toxic cloud', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Weakening mist', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'Low HP fungus. Stacks poison fast. Kill it before it stacks.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'caster',
  },

  // ── ACT 2 BASE ENEMIES ──
  // AR-59.13: quiz-reactive behaviors introduced.

  {
    id: 'shadow_mimic',
    name: 'Shadow Mimic',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 28,
    intentPool: [
      { type: 'attack', value: 8, weight: 2, telegraph: 'Shadow strike' },
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Flurry of shadows', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Expose weakness', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
    description: 'Mirrors your failures. Miss a Charge and it hits you back for the same damage.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
    onPlayerChargeWrong: (ctx) => {
      // Mirror the card's base damage back to the player via context
      // (actual player damage application handled in turnManager after callback)
      (ctx as any)._mirrorDamage = ctx.cardBaseDamage;
    },
  },

  // ── DEPRECATED ELITES (pre-v2 roster) ──
  // @deprecated — kept for backwards compatibility, not in ACT_ENEMY_POOLS. Remove in AR-59.19.

  {
    id: 'ore_wyrm',
    name: 'Ore Wyrm',
    category: 'elite',
    region: 'shallow_depths',
    baseHP: 58,
    intentPool: [
      { type: 'attack', value: 8, weight: 2, telegraph: 'Tail sweep' },
      { type: 'attack', value: 12, weight: 1, telegraph: 'Crushing bite' },
      { type: 'defend', value: 6, weight: 1, telegraph: 'Burrowing deeper' },
    ],
    description: 'Feeds on mineral veins. Gets angrier as it takes damage.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'attack', value: 14, weight: 2, telegraph: 'Enraged thrash' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Frenzied bites', hitCount: 3 },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Tremor', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'charge', value: 30, weight: 1, telegraph: 'Charging: Burrowing Devastation!' },
    ],
    animArchetype: 'lurcher',
  },

  {
    id: 'fossil_guardian',
    name: 'Fossil Guardian',
    category: 'elite',
    region: 'deep_caverns',
    baseHP: 55,
    intentPool: [
      { type: 'attack', value: 10, weight: 3, telegraph: 'Examiner\'s strike' },
      { type: 'buff', value: 3, weight: 2, telegraph: 'Academic rigor', statusEffect: { type: 'strength', value: 1, turns: 2 } },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Pop quiz' },
    ],
    description: 'Gains +3 Strength every turn you don\'t Charge. Charges or it wins.',
    animArchetype: 'trembler',
    onPlayerNoCharge: (ctx) => {
      // Apply +3 Strength (encounter-permanent: 999 turns)
      applyStatusEffect(ctx.enemy.statusEffects, {
        type: 'strength',
        value: 3,
        turnsRemaining: 999,
      });
    },
  },

  // ── BOSS (3) ──

  {
    id: 'the_excavator',
    name: 'The Excavator',
    category: 'boss',
    region: 'shallow_depths',
    baseHP: 70,
    intentPool: [
      { type: 'attack', value: 16, weight: 2, telegraph: 'Drill charge' },
      { type: 'multi_attack', value: 5, weight: 1, telegraph: 'Grinding gears', hitCount: 4 },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Reinforcing plating' },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Oil slick', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'An old mining rig, still running. Nobody told it to stop.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 20, weight: 2, telegraph: 'Overdrive slam' },
      { type: 'multi_attack', value: 6, weight: 2, telegraph: 'Drill barrage', hitCount: 3 },
      { type: 'defend', value: 10, weight: 1, telegraph: 'Emergency plating' },
      { type: 'charge', value: 35, weight: 1, telegraph: 'Charging: Overdrive Burst!' },
    ],
    animArchetype: 'slammer',
  },

  {
    id: 'magma_core',
    name: 'Magma Core',
    category: 'boss',
    region: 'shallow_depths',
    baseHP: 75,
    intentPool: [
      { type: 'attack', value: 8, weight: 1, telegraph: 'Lava splash' },
      { type: 'attack', value: 15, weight: 1, telegraph: 'Eruption' },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Searing heat', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'buff', value: 3, weight: 1, telegraph: 'Magma surge', statusEffect: { type: 'strength', value: 2, turns: 3 } },
    ],
    description: 'Molten rock, given shape. The heat alone is a threat.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 22, weight: 2, telegraph: 'Volcanic blast' },
      { type: 'multi_attack', value: 7, weight: 1, telegraph: 'Magma rain', hitCount: 4 },
      { type: 'debuff', value: 4, weight: 1, telegraph: 'Meltdown', statusEffect: { type: 'poison', value: 4, turns: 3 } },
    ],
    animArchetype: 'trembler',
  },

  // AR-59.13: The Archivist is the Act 2 boss. Stats updated; quizPhases added for AR-59.7.
  {
    id: 'the_archivist',
    name: 'The Archivist',
    category: 'boss',
    region: 'deep_caverns',
    baseHP: 80,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Data beam' },
      { type: 'defend', value: 12, weight: 1, telegraph: 'Firewall' },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'System scan', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'heal', value: 8, weight: 1, telegraph: 'Self-repair' },
    ],
    description: 'Old archive AI. Still running, still territorial. Triggers a quiz phase at half health.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'attack', value: 14, weight: 2, telegraph: 'Archive purge' },
      { type: 'multi_attack', value: 4, weight: 1, telegraph: 'Rapid queries', hitCount: 4 },
      { type: 'debuff', value: 3, weight: 1, telegraph: 'Memory wipe', statusEffect: { type: 'weakness', value: 2, turns: 2 } },
      { type: 'heal', value: 10, weight: 1, telegraph: 'Backup restore' },
    ],
    animArchetype: 'caster',
    quizPhases: [
      { hpThreshold: 0.5, questionCount: 5 },
    ],
  },

  {
    id: 'crystal_warden',
    name: 'Crystal Warden',
    category: 'boss',
    region: 'deep_caverns',
    baseHP: 90,
    intentPool: [
      { type: 'attack', value: 12, weight: 4, telegraph: 'Prismatic slash' },
      { type: 'defend', value: 10, weight: 3, telegraph: 'Crystal barrier' },
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Shard storm', hitCount: 3 },
      { type: 'heal', value: 8, weight: 1, telegraph: 'Crystalline mend' },
    ],
    description: 'Living crystal. Status effects don\'t stick. It just keeps coming.',
    animArchetype: 'slammer',
  },

  {
    id: 'shadow_hydra',
    name: 'Shadow Hydra',
    category: 'boss',
    region: 'the_abyss',
    baseHP: 110,
    intentPool: [
      { type: 'attack', value: 14, weight: 35, telegraph: 'Hydra strike' },
      { type: 'multi_attack', value: 5, weight: 30, telegraph: 'Twin fangs', hitCount: 3 },
      { type: 'debuff', value: 3, weight: 20, telegraph: 'Venom spray', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'attack', value: 10, weight: 15, telegraph: 'Tail lash' },
    ],
    description: 'Shadow serpent with multiple heads. At half HP, a second head wakes up.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'multi_attack', value: 7, weight: 3, telegraph: 'Dual hydra strike', hitCount: 2 },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Fang barrage', hitCount: 4 },
      { type: 'debuff', value: 4, weight: 2, telegraph: 'Toxic deluge', statusEffect: { type: 'poison', value: 4, turns: 3 } },
      { type: 'attack', value: 18, weight: 1, telegraph: 'Decapitation bite' },
    ],
    animArchetype: 'lurcher',
  },

  {
    id: 'void_weaver',
    name: 'Void Weaver',
    category: 'boss',
    region: 'the_abyss',
    baseHP: 125,
    intentPool: [
      { type: 'attack', value: 18, weight: 4, telegraph: 'Void bolt' },
      { type: 'multi_attack', value: 6, weight: 2, telegraph: 'Void storm', hitCount: 3 },
      { type: 'debuff', value: 3, weight: 15, telegraph: 'Reality tear', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'debuff', value: 2, weight: 15, telegraph: 'Hand disruption', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'defend', value: 12, weight: 1, telegraph: 'Phase shift' },
    ],
    description: 'Something from between spaces. Its attacks hit your hand as much as your health.',
    animArchetype: 'caster',
  },

  {
    id: 'knowledge_golem',
    name: 'Knowledge Golem',
    category: 'boss',
    region: 'the_archive',
    baseHP: 120,
    intentPool: [
      { type: 'attack', value: 15, weight: 35, telegraph: 'Tome slam' },
      { type: 'attack', value: 17, weight: 25, telegraph: 'Crushing knowledge' },
      { type: 'defend', value: 10, weight: 20, telegraph: 'Page shield' },
      { type: 'buff', value: 2, weight: 20, telegraph: 'Absorb text', statusEffect: { type: 'strength', value: 2, turns: 3 } },
      { type: 'charge', value: 32, weight: 1, telegraph: 'Charging: Tome Avalanche!' },
    ],
    description: 'Built from compressed books. Wrong answers feed it power.',
    animArchetype: 'slammer',
  },

  // AR-59.13: The Curator is the Act 3 final boss with 2 quiz phases at 66% and 33% HP.
  {
    id: 'the_curator',
    name: 'The Curator',
    category: 'boss',
    region: 'the_archive',
    baseHP: 120,
    intentPool: [
      { type: 'attack', value: 15, weight: 3, telegraph: 'Cataloguing strike' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Archive barrage', hitCount: 4 },
      { type: 'debuff', value: 3, weight: 2, telegraph: 'Forgotten lore', statusEffect: { type: 'weakness', value: 2, turns: 2 } },
      { type: 'buff', value: 3, weight: 2, telegraph: 'Ancient wisdom', statusEffect: { type: 'strength', value: 2, turns: 3 } },
      { type: 'heal', value: 12, weight: 1, telegraph: 'Restoration protocol' },
    ],
    description: 'Final guardian. Quiz phases at 66% and 33% HP. The second one is Rapid Fire.',
    phaseTransitionAt: 0.33,
    phase2IntentPool: [
      { type: 'attack', value: 15, weight: 3, telegraph: 'Judgement' },
      { type: 'multi_attack', value: 7, weight: 2, telegraph: 'Knowledge storm', hitCount: 4 },
      { type: 'debuff', value: 4, weight: 2, telegraph: 'Mind shatter', statusEffect: { type: 'vulnerable', value: 2, turns: 3 } },
      { type: 'heal', value: 10, weight: 1, telegraph: 'Archive restoration' },
      { type: 'buff', value: 3, weight: 1, telegraph: 'Final form', statusEffect: { type: 'strength', value: 3, turns: 5 } },
    ],
    animArchetype: 'caster',
    quizPhases: [
      { hpThreshold: 0.66, questionCount: 5 },
      { hpThreshold: 0.33, questionCount: 8, timerSeconds: 4, rapidFire: true },
    ],
  },

  // ── MINI-BOSS (6) ──

  {
    id: 'crystal_guardian',
    name: 'Crystal Guardian',
    category: 'mini_boss',
    region: 'deep_caverns',
    baseHP: 52,
    intentPool: [
      { type: 'attack', value: 11, weight: 3, telegraph: 'Crystal strike' },
      { type: 'defend', value: 6, weight: 3, telegraph: 'Stone shell' },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Shard eruption' },
    ],
    description: 'Crystal-armored golem. Blocks accumulate each turn.',
    animArchetype: 'trembler',
    onPlayerNoCharge: (ctx) => {
      // AR-99 Phase 3: quickPlayPunish — gains +1 Strength if player makes no Charge plays.
      applyStatusEffect(ctx.enemy.statusEffects, {
        type: 'strength',
        value: 1,
        turnsRemaining: 999,
      });
    },
  },

  {
    id: 'venomfang',
    name: 'Venomfang',
    category: 'mini_boss',
    region: 'shallow_depths',
    baseHP: 45,
    intentPool: [
      { type: 'attack', value: 12, weight: 3, telegraph: 'Serpent lunge' },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Tail whip' },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Venom bite', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
    description: 'Gets deadlier each turn. Survive to turn 4 and it permanently gains +5 damage per turn after that.',
    animArchetype: 'crawler',
    onEnemyTurnStart: (ctx) => {
      if (ctx.turnNumber >= 4) {
        ctx.enemy.enrageBonusDamage += 5;
      }
    },
  },

  {
    id: 'stone_sentinel',
    name: 'Stone Sentinel',
    category: 'mini_boss',
    region: 'deep_caverns',
    baseHP: 60,
    intentPool: [
      { type: 'attack', value: 10, weight: 2, telegraph: 'Heavy swing' },
      { type: 'defend', value: 10, weight: 3, telegraph: 'Fortify' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Harden', statusEffect: { type: 'strength', value: 1, turns: 3 } },
      { type: 'charge', value: 28, weight: 1, telegraph: 'Charging: Seismic Slam!' },
    ],
    description: 'Old stone warrior. Very slow, very durable. A war of attrition.',
    animArchetype: 'slammer',
    onPlayerNoCharge: (ctx) => {
      // AR-99 Phase 3: quickPlayPunish — gains +1 Strength if player makes no Charge plays.
      applyStatusEffect(ctx.enemy.statusEffects, {
        type: 'strength',
        value: 1,
        turnsRemaining: 999,
      });
    },
  },

  {
    id: 'ember_drake',
    name: 'Ember Drake',
    category: 'mini_boss',
    region: 'the_abyss',
    baseHP: 48,
    intentPool: [
      { type: 'attack', value: 10, weight: 3, telegraph: 'Fire breath' },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Inferno blast' },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Scorching heat', statusEffect: { type: 'poison', value: 2, turns: 2 } },
    ],
    description: 'Small and vicious. Hits hard, breaks easy.',
    animArchetype: 'swooper',
  },

  {
    id: 'shade_stalker',
    name: 'Shade Stalker',
    category: 'mini_boss',
    region: 'the_abyss',
    baseHP: 42,
    intentPool: [
      { type: 'attack', value: 11, weight: 3, telegraph: 'Shadow lunge' },
      { type: 'multi_attack', value: 3, weight: 2, telegraph: 'Phantom copies', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Expose weakness', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
    description: 'Copies your last card type. Nastier than the Shadow Mimic.',
    animArchetype: 'striker',
  },

  // AR-59.13: Bone Collector promoted to Act 2 common with onPlayerChargeWrong hook.
  // The old mini_boss variant is kept as 'bone_collector_old' for backwards compat (deprecated).
  {
    id: 'bone_collector',
    name: 'Bone Collector',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 30,
    intentPool: [
      { type: 'attack', value: 10, weight: 3, telegraph: 'Bone slash' },
      { type: 'heal', value: 5, weight: 2, telegraph: 'Consume remains' },
      { type: 'defend', value: 6, weight: 1, telegraph: 'Bone armor' },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Marrow drain', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
    ],
    description: 'Scavenger. Heals 5 HP every time you miss a Charge.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
    onPlayerChargeWrong: (ctx) => {
      const healAmount = Math.min(5, ctx.enemy.maxHP - ctx.enemy.currentHP);
      ctx.enemy.currentHP += healAmount;
    },
  },

  // ── SHALLOW DEPTHS — COMMON (8 new) ──

  {
    id: 'mud_crawler',
    name: 'Mud Crawler',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 26,
    intentPool: [
      { type: 'attack', value: 9, weight: 2, telegraph: 'Mud slash' },
      { type: 'debuff', value: 2, weight: 3, telegraph: 'Bog grasp', statusEffect: { type: 'poison', value: 2, turns: 2 } },
      { type: 'defend', value: 5, weight: 1, telegraph: 'Sliming' },
    ],
    description: 'Slug-shaped and wet. Poison seeps from its touch.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
  },

  {
    id: 'root_strangler',
    name: 'Root Strangler',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 28,
    intentPool: [
      { type: 'multi_attack', value: 3, weight: 3, telegraph: 'Vine lash', hitCount: 3 },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Poisoned thorns', statusEffect: { type: 'poison', value: 2, turns: 2 } },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Root strike' },
    ],
    description: 'Roots that move on their own. Vines, poison, persistence.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'crawler',
    chainVulnerable: true,
  },

  {
    id: 'iron_beetle',
    name: 'Iron Beetle',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 32,
    intentPool: [
      { type: 'defend', value: 9, weight: 3, telegraph: 'Harden shell' },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Mandible snap' },
      { type: 'multi_attack', value: 2, weight: 1, telegraph: 'Chittering strike', hitCount: 2 },
    ],
    description: 'Heavy carapace. Prefers to block and wait.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'trembler',
    chargeResistant: true,
  },

  {
    id: 'limestone_imp',
    name: 'Limestone Imp',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 26,
    intentPool: [
      { type: 'attack', value: 12, weight: 3, telegraph: 'Nimble jab' },
      { type: 'buff', value: 1, weight: 2, telegraph: 'Rocky surge', statusEffect: { type: 'strength', value: 1, turns: 2 } },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Stone kick' },
    ],
    description: 'Pale limestone imp. Quick, aggressive, annoying.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'striker',
  },

  {
    id: 'cave_spider',
    name: 'Cave Spider',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 27,
    intentPool: [
      { type: 'multi_attack', value: 4, weight: 3, telegraph: 'Fang barrage', hitCount: 3 },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Web poison', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Puncture' },
    ],
    description: 'Venomous and fast. Multiple attacks per encounter.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'crawler',
    chainVulnerable: true,
  },

  {
    id: 'peat_shambler',
    name: 'Peat Shambler',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 30,
    intentPool: [
      { type: 'heal', value: 6, weight: 2, telegraph: 'Bog absorption' },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Peat decay', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Sludge swing' },
    ],
    description: 'Bog water and peat, barely held together. Heals from the muck.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
  },

  {
    id: 'fungal_sprout',
    name: 'Fungal Sprout',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 24,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Spore shower', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Fungal decay', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 7, weight: 1, telegraph: 'Cap strike' },
    ],
    description: 'Young fungus. Spores before strikes.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'caster',
  },

  {
    id: 'blind_grub',
    name: 'Blind Grub',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 30,
    intentPool: [
      { type: 'multi_attack', value: 5, weight: 3, telegraph: 'Bite frenzy', hitCount: 4 },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Larval grasp', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Mandible crush' },
    ],
    description: 'No eyes, hunts by vibration. Never stops biting.',
    rarity: 'rare',
    spawnWeight: 2,
    animArchetype: 'crawler',
    chainVulnerable: true,
  },

  // ── ACT 1 ADDITIONAL COMMONS (AR-98) ──

  {
    id: 'dust_mite',
    name: 'Dust Mite',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 12,
    intentPool: [
      { type: 'attack', value: 6, weight: 7, telegraph: 'Quick bite' },
      { type: 'attack', value: 8, weight: 2, telegraph: 'Frenetic strike' },
      { type: 'defend', value: 4, weight: 1, telegraph: 'Skittering evasion' },
    ],
    description: 'Fragile but relentless. Chip damage adds up if you let it.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'striker',
  },

  {
    id: 'stalactite_bat',
    name: 'Stalactite Bat',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 18,
    intentPool: [
      { type: 'attack', value: 7, weight: 5, telegraph: 'Diving strike' },
      { type: 'defend', value: 6, weight: 4, telegraph: 'Roosting' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Enrage screech', statusEffect: { type: 'strength', value: 2, turns: 2 } },
    ],
    description: 'Alternates between striking and retreating. Read its intents — time your blocks.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'swooper',
  },

  {
    id: 'glow_worm',
    name: 'Glow Worm',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 22,
    intentPool: [
      { type: 'attack', value: 5, weight: 4, telegraph: 'Mucus lash' },
      { type: 'heal', value: 5, weight: 3, telegraph: 'Regenerating glow' },
      { type: 'defend', value: 4, weight: 2, telegraph: 'Coiling' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Blinding flash' },
    ],
    description: 'Heals itself every few turns. Burst it down before it heals back up.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'caster',
  },

  {
    id: 'rock_crab',
    name: 'Rock Crab',
    category: 'common',
    region: 'shallow_depths',
    baseHP: 28,
    intentPool: [
      { type: 'defend', value: 8, weight: 4, telegraph: 'Shell hardening' },
      { type: 'attack', value: 4, weight: 3, telegraph: 'Claw pinch' },
      { type: 'defend', value: 12, weight: 2, telegraph: 'Fortified shell' },
      { type: 'attack', value: 6, weight: 1, telegraph: 'Crushing claw' },
    ],
    description: 'Stacks block every other turn. Use debuffs to break through the shell.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'slammer',
  },

  // ── SHALLOW DEPTHS — MINI-BOSS (4 new) ──

  {
    id: 'root_mother',
    name: 'Root Mother',
    category: 'mini_boss',
    region: 'shallow_depths',
    baseHP: 48,
    intentPool: [
      { type: 'heal', value: 8, weight: 2, telegraph: 'Root mending' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Root whip', hitCount: 3 },
      { type: 'debuff', value: 2, weight: 1, telegraph: 'Entangle', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'attack', value: 11, weight: 1, telegraph: 'Vine strike' },
    ],
    description: 'The source of all those roots. Old, vast, and furious.',
    animArchetype: 'caster',
  },

  {
    id: 'iron_matriarch',
    name: 'Iron Matriarch',
    category: 'mini_boss',
    region: 'shallow_depths',
    baseHP: 55,
    intentPool: [
      { type: 'defend', value: 10, weight: 3, telegraph: 'Fortify shell' },
      { type: 'charge', value: 26, weight: 1, telegraph: 'Charging: Metallic crush!' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Hardened rage', statusEffect: { type: 'strength', value: 1, turns: 2 } },
      { type: 'attack', value: 12, weight: 1, telegraph: 'Iron slam' },
    ],
    description: 'A colony of iron beetles, stacked and coordinated. Doesn\'t yield.',
    animArchetype: 'slammer',
  },

  {
    id: 'bog_witch',
    name: 'Bog Witch',
    category: 'mini_boss',
    region: 'shallow_depths',
    baseHP: 44,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Weakening curse', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Brittle hex', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'heal', value: 6, weight: 1, telegraph: 'Bogwater heal' },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Curse strike' },
    ],
    description: 'Swamp hag. Curses and weakens before she bothers to hit.',
    animArchetype: 'caster',
  },

  {
    id: 'mushroom_sovereign',
    name: 'Mushroom Sovereign',
    category: 'mini_boss',
    region: 'shallow_depths',
    baseHP: 50,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Toxic bloom', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Spore ascension', statusEffect: { type: 'strength', value: 2, turns: 2 } },
      { type: 'defend', value: 7, weight: 1, telegraph: 'Cap shield' },
      { type: 'attack', value: 11, weight: 1, telegraph: 'Regal strike' },
    ],
    description: 'Crowned fungus. Rules its colony through poison.',
    animArchetype: 'caster',
  },

  // ── SHALLOW DEPTHS — ELITE (1 new) ──

  {
    id: 'cave_troll',
    name: 'Cave Troll',
    category: 'elite',
    region: 'shallow_depths',
    baseHP: 68,
    intentPool: [
      { type: 'attack', value: 13, weight: 2, telegraph: 'Club smash' },
      { type: 'defend', value: 7, weight: 1, telegraph: 'Hunkering down' },
      { type: 'charge', value: 28, weight: 1, telegraph: 'Charging: Devastating roar!' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Troll rage', statusEffect: { type: 'strength', value: 2, turns: 2 } },
    ],
    description: 'Thick hide, slow temper. Wound it and it stops being slow.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 18, weight: 2, telegraph: 'Enraged smash' },
      { type: 'multi_attack', value: 6, weight: 2, telegraph: 'Rending claws', hitCount: 3 },
      { type: 'charge', value: 32, weight: 1, telegraph: 'Charging: Unstoppable rampage!' },
    ],
    animArchetype: 'slammer',
  },

  // ── DEEP CAVERNS — COMMON (11 new) ──

  {
    id: 'basalt_crawler',
    name: 'Basalt Crawler',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 32,
    intentPool: [
      { type: 'defend', value: 6, weight: 2, telegraph: 'Stone shell' },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Basalt bite' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Crawling strike' },
    ],
    description: 'Basalt-skinned reptile. Attacks and blocks in equal measure.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'crawler',
    chargeResistant: true,
  },

  {
    id: 'salt_wraith',
    name: 'Salt Wraith',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 30,
    intentPool: [
      { type: 'debuff', value: 1, weight: 3, telegraph: 'Salt sting', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Crystalline strike' },
      { type: 'attack', value: 7, weight: 1, telegraph: 'Spectral touch' },
    ],
    description: 'Salt crystals, loosely haunting. Saps strength on contact.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'caster',
  },

  {
    id: 'coal_imp',
    name: 'Coal Imp',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 28,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Fire jab' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Burning touch', statusEffect: { type: 'poison', value: 2, turns: 2 } },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Ember strike' },
    ],
    description: 'Carved from burning coal, still burning. Leaves poison behind.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'striker',
  },

  {
    id: 'granite_hound',
    name: 'Granite Hound',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 32,
    intentPool: [
      { type: 'multi_attack', value: 4, weight: 3, telegraph: 'Bite combo', hitCount: 3 },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Pounce' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Snap' },
    ],
    description: 'Stone wolf. Hunts in the dark, bites multiple times.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'striker',
    chargeResistant: true,
  },

  {
    id: 'sulfur_sprite',
    name: 'Sulfur Sprite',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 27,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Toxic cloud', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Brittle aura', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Sulfur burst' },
    ],
    description: 'Born from a vent. Toxic by nature, multiple debuffs.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'floater',
  },

  {
    id: 'magma_tick',
    name: 'Magma Tick',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 30,
    intentPool: [
      { type: 'attack', value: 10, weight: 2, telegraph: 'Lava bite' },
      { type: 'buff', value: 1, weight: 2, telegraph: 'Molten pulse', statusEffect: { type: 'strength', value: 1, turns: 2 } },
      { type: 'heal', value: 4, weight: 1, telegraph: 'Lava soak' },
    ],
    description: 'Feeds on magma. The heat heals it.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
  },

  {
    id: 'deep_angler',
    name: 'Deep Angler',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 30,
    intentPool: [
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Lure bite', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Fin slash' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Snap' },
    ],
    description: 'Adapted to total darkness. Leaves you vulnerable.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'floater',
  },

  {
    id: 'rock_hermit',
    name: 'Rock Hermit',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 34,
    intentPool: [
      { type: 'defend', value: 8, weight: 3, telegraph: 'Shell retreat' },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Claw strike' },
      { type: 'attack', value: 7, weight: 1, telegraph: 'Pinch' },
    ],
    description: 'Crustacean in a geode shell. Stubborn and difficult to crack.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'trembler',
    chargeResistant: true,
  },

  {
    id: 'gas_phantom',
    name: 'Gas Phantom',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 30,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Toxic vapor', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Weakening mist', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Ethereal touch' },
    ],
    description: 'Gas that haunts. Poisons and weakens on contact.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'floater',
  },

  {
    id: 'stalactite_drake',
    name: 'Stalactite Drake',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 30,
    intentPool: [
      { type: 'multi_attack', value: 3, weight: 3, telegraph: 'Fang barrage', hitCount: 3 },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Stone bite' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Tail swipe' },
    ],
    description: 'Hangs from the ceiling and drops on you. Fast attacker.',
    rarity: 'rare',
    spawnWeight: 2,
    animArchetype: 'swooper',
    chainVulnerable: true,
  },

  {
    id: 'ember_moth',
    name: 'Ember Moth',
    category: 'common',
    region: 'deep_caverns',
    baseHP: 26,
    intentPool: [
      { type: 'attack', value: 10, weight: 2, telegraph: 'Ember touch' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Burning embers', statusEffect: { type: 'poison', value: 2, turns: 2 } },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Wing strike' },
    ],
    description: 'Moth on fire. Leaves scorch-poison on contact.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'swooper',
  },

  // ── DEEP CAVERNS — MINI-BOSS (4 new) ──

  {
    id: 'sulfur_queen',
    name: 'Sulfur Queen',
    category: 'mini_boss',
    region: 'deep_caverns',
    baseHP: 52,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Sulfur crown', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Decay aura', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'multi_attack', value: 4, weight: 1, telegraph: 'Toxic barrage', hitCount: 3 },
      { type: 'attack', value: 11, weight: 1, telegraph: 'Queen\'s sting' },
    ],
    description: 'Crystallized sulfur, given authority. Stacks poison fast.',
    animArchetype: 'caster',
  },

  {
    id: 'granite_colossus',
    name: 'Granite Colossus',
    category: 'mini_boss',
    region: 'deep_caverns',
    baseHP: 55,
    intentPool: [
      { type: 'defend', value: 12, weight: 2, telegraph: 'Stone fortification' },
      { type: 'charge', value: 30, weight: 1, telegraph: 'Charging: Granite slam!' },
      { type: 'attack', value: 12, weight: 1, telegraph: 'Heavy strike' },
    ],
    description: 'Solid granite, enormous. Damage barely registers.',
    animArchetype: 'slammer',
  },

  {
    id: 'deep_lurker',
    name: 'Deep Lurker',
    category: 'mini_boss',
    region: 'deep_caverns',
    baseHP: 50,
    intentPool: [
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Lurking assault', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Vulnerable strike', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 13, weight: 1, telegraph: 'Deep bite' },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Predatory strike' },
    ],
    description: 'Deep cave predator. Patient, then very fast.',
    animArchetype: 'striker',
  },

  {
    id: 'lava_salamander',
    name: 'Lava Salamander',
    category: 'mini_boss',
    region: 'deep_caverns',
    baseHP: 48,
    intentPool: [
      { type: 'attack', value: 11, weight: 2, telegraph: 'Magma bite' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Scalding heat', statusEffect: { type: 'poison', value: 3, turns: 2 } },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Magma shield' },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Tail lash' },
    ],
    description: 'Lava-formed lizard. Bites and burns.',
    animArchetype: 'crawler',
  },

  // ── DEEP CAVERNS — ELITE (2 new) ──

  {
    id: 'magma_serpent',
    name: 'Magma Serpent',
    category: 'elite',
    region: 'deep_caverns',
    baseHP: 62,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Lava fangs' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Burning venom', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'multi_attack', value: 4, weight: 1, telegraph: 'Serpent strike', hitCount: 2 },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Constriction' },
    ],
    description: 'Lava-formed cobra. Deadly at range and up close.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'attack', value: 16, weight: 2, telegraph: 'Enraged strike' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Fang storm', hitCount: 3 },
      { type: 'charge', value: 32, weight: 1, telegraph: 'Charging: Molten eruption!' },
    ],
    animArchetype: 'lurcher',
  },

  {
    id: 'basalt_titan',
    name: 'Basalt Titan',
    category: 'elite',
    region: 'deep_caverns',
    baseHP: 70,
    intentPool: [
      { type: 'defend', value: 9, weight: 2, telegraph: 'Stone wall' },
      { type: 'charge', value: 29, weight: 1, telegraph: 'Charging: Titanic crush!' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Basalt surge', statusEffect: { type: 'strength', value: 2, turns: 2 } },
      { type: 'attack', value: 13, weight: 1, telegraph: 'Titan strike' },
    ],
    description: 'Basalt column, upright and hostile. Hits slowly, hits hard.',
    animArchetype: 'slammer',
  },

  // ── THE ABYSS — COMMON (11 new) ──

  {
    id: 'obsidian_shard',
    name: 'Obsidian Shard',
    category: 'common',
    region: 'the_abyss',
    baseHP: 32,
    intentPool: [
      { type: 'multi_attack', value: 3, weight: 3, telegraph: 'Shard volley', hitCount: 4 },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Obsidian slash' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Sharp strike' },
    ],
    description: 'Obsidian shard, floating and sharp. Attacks in volleys.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'floater',
    chainVulnerable: true,
  },

  {
    id: 'magma_slime',
    name: 'Magma Slime',
    category: 'common',
    region: 'the_abyss',
    baseHP: 30,
    intentPool: [
      { type: 'attack', value: 11, weight: 2, telegraph: 'Lava blob' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Molten splash', statusEffect: { type: 'poison', value: 2, turns: 2 } },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Ooze strike' },
    ],
    description: 'Lava that moves with purpose. Leaves burn-poison.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
  },

  {
    id: 'quartz_elemental',
    name: 'Quartz Elemental',
    category: 'common',
    region: 'the_abyss',
    baseHP: 34,
    intentPool: [
      { type: 'defend', value: 7, weight: 2, telegraph: 'Crystal shell' },
      { type: 'attack', value: 12, weight: 2, telegraph: 'Quartz spike' },
      { type: 'buff', value: 1, weight: 1, telegraph: 'Crystalline surge', statusEffect: { type: 'strength', value: 1, turns: 2 } },
    ],
    description: 'Pure crystal, animated. Blocks and attacks with equal comfort.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'caster',
    chargeResistant: true,
  },

  {
    id: 'fossil_raptor',
    name: 'Fossil Raptor',
    category: 'common',
    region: 'the_abyss',
    baseHP: 32,
    intentPool: [
      { type: 'multi_attack', value: 4, weight: 3, telegraph: 'Claw barrage', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Expose wound', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Raptor strike' },
    ],
    description: 'Dinosaur skeleton, still furious. Fast and relentless.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'striker',
    chainVulnerable: true,
  },

  {
    id: 'geode_beetle',
    name: 'Geode Beetle',
    category: 'common',
    region: 'the_abyss',
    baseHP: 34,
    intentPool: [
      { type: 'defend', value: 8, weight: 3, telegraph: 'Geode armor' },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Crystal bite' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Shell strike' },
    ],
    description: 'Crystalline shell. Nearly impossible to reach through all that block.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'trembler',
    chargeResistant: true,
  },

  {
    id: 'lava_crawler',
    name: 'Lava Crawler',
    category: 'common',
    region: 'the_abyss',
    baseHP: 36,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Molten trail', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'multi_attack', value: 3, weight: 2, telegraph: 'Segment strike', hitCount: 3 },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Burn strike' },
    ],
    description: 'Magma centipede. The trail it leaves burns.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'crawler',
    chainVulnerable: true,
  },

  {
    id: 'crystal_bat',
    name: 'Crystal Bat',
    category: 'common',
    region: 'the_abyss',
    baseHP: 32,
    intentPool: [
      { type: 'attack', value: 12, weight: 3, telegraph: 'Crystal dive' },
      { type: 'multi_attack', value: 3, weight: 2, telegraph: 'Swoop attack', hitCount: 3 },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Wing strike' },
    ],
    description: 'Crystal wings. Each swoop is a blade.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'swooper',
  },

  {
    id: 'void_mite',
    name: 'Void Mite',
    category: 'common',
    region: 'the_abyss',
    baseHP: 40,
    intentPool: [
      { type: 'attack', value: 6, weight: 3, telegraph: 'Academic strike' },
      { type: 'defend', value: 8, weight: 2, telegraph: 'Study shield' },
      { type: 'heal', value: 5, weight: 1, telegraph: 'Knowledge recovery' },
    ],
    description: 'Feeds on correct answers. Heals 5 HP each time you Charge correctly. Quick Play denies it.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'crawler',
    onPlayerChargeCorrect: (ctx) => {
      const healAmount = Math.min(5, ctx.enemy.maxHP - ctx.enemy.currentHP);
      ctx.enemy.currentHP += healAmount;
    },
    chargeResistant: true,
  },

  {
    id: 'ash_wraith',
    name: 'Ash Wraith',
    category: 'common',
    region: 'the_abyss',
    baseHP: 33,
    intentPool: [
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Ash veil', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Ember strike' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Ghostly touch' },
    ],
    description: 'Ash from old eruptions. Leaves you open to damage.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'caster',
  },

  {
    id: 'prismatic_jelly',
    name: 'Prismatic Jelly',
    category: 'common',
    region: 'the_abyss',
    baseHP: 36,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Prismatic sting', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Rainbow burn', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Jelly strike' },
    ],
    description: 'Iridescent and toxic. Stacks weakness and vulnerability.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'floater',
  },

  {
    id: 'ember_skeleton',
    name: 'Ember Skeleton',
    category: 'common',
    region: 'the_abyss',
    baseHP: 38,
    intentPool: [
      { type: 'attack', value: 11, weight: 2, telegraph: 'Bone strike' },
      { type: 'multi_attack', value: 3, weight: 2, telegraph: 'Burning strike', hitCount: 3 },
      { type: 'buff', value: 1, weight: 1, telegraph: 'Ember surge', statusEffect: { type: 'strength', value: 1, turns: 2 } },
    ],
    description: 'Burning skeleton. Gets stronger while it burns.',
    rarity: 'rare',
    spawnWeight: 2,
    animArchetype: 'striker',
    chainVulnerable: true,
  },

  // ── THE ABYSS — MINI-BOSS (4 new) ──

  {
    id: 'obsidian_knight',
    name: 'Obsidian Knight',
    category: 'mini_boss',
    region: 'the_abyss',
    baseHP: 59,
    intentPool: [
      { type: 'defend', value: 11, weight: 2, telegraph: 'Glass shield' },
      { type: 'charge', value: 28, weight: 1, telegraph: 'Charging: Obsidian slash!' },
      { type: 'attack', value: 12, weight: 2, telegraph: 'Obsidian blade' },
    ],
    description: 'Obsidian glass forged into armor. Blocks well, then cuts.',
    animArchetype: 'slammer',
    onPlayerNoCharge: (ctx) => {
      // AR-99 Phase 3: quickPlayPunish — gains +1 Strength if player makes no Charge plays.
      applyStatusEffect(ctx.enemy.statusEffects, {
        type: 'strength',
        value: 1,
        turnsRemaining: 999,
      });
    },
  },

  {
    id: 'quartz_hydra',
    name: 'Quartz Hydra',
    category: 'mini_boss',
    region: 'the_abyss',
    baseHP: 57,
    intentPool: [
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Triple strike', hitCount: 3 },
      { type: 'defend', value: 9, weight: 1, telegraph: 'Crystal wall' },
      { type: 'heal', value: 6, weight: 1, telegraph: 'Crystalline mend' },
      { type: 'attack', value: 12, weight: 1, telegraph: 'Hydra snap' },
    ],
    description: 'Three crystal heads. At least one is always healing.',
    animArchetype: 'lurcher',
  },

  {
    id: 'fossil_wyvern',
    name: 'Fossil Wyvern',
    category: 'mini_boss',
    region: 'the_abyss',
    baseHP: 55,
    intentPool: [
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Wing barrage', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Fossilize', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 12, weight: 2, telegraph: 'Wyvern bite' },
    ],
    description: 'Ancient bones, reanimated and airborne. Drops fast.',
    animArchetype: 'swooper',
  },

  {
    id: 'magma_broodmother',
    name: 'Magma Broodmother',
    category: 'mini_boss',
    region: 'the_abyss',
    baseHP: 61,
    intentPool: [
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Spawn swarm', hitCount: 3 },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Magma spawn', statusEffect: { type: 'poison', value: 3, turns: 3 } },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Magma protection' },
      { type: 'attack', value: 11, weight: 1, telegraph: 'Brood strike' },
    ],
    description: 'Lava spider, large. Floods the field with spawn and poison.',
    animArchetype: 'crawler',
  },

  // ── THE ABYSS — ELITE (3 new) ──

  {
    id: 'geode_king',
    name: 'Geode King',
    category: 'elite',
    region: 'the_abyss',
    baseHP: 68,
    intentPool: [
      { type: 'defend', value: 10, weight: 2, telegraph: 'Royal shield' },
      { type: 'heal', value: 7, weight: 1, telegraph: 'Crystal mending' },
      { type: 'attack', value: 12, weight: 1, telegraph: 'Royal strike' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Regal surge', statusEffect: { type: 'strength', value: 2, turns: 2 } },
    ],
    description: 'Crystal-built, hard to kill. Becomes far more dangerous at half HP.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Crystal barrage', hitCount: 3 },
      { type: 'charge', value: 31, weight: 1, telegraph: 'Charging: Geode avalanche!' },
      { type: 'attack', value: 14, weight: 1, telegraph: 'Enraged strike' },
    ],
    animArchetype: 'trembler',
  },

  {
    id: 'abyssal_leviathan',
    name: 'Abyssal Leviathan',
    category: 'elite',
    region: 'the_abyss',
    baseHP: 75,
    intentPool: [
      { type: 'attack', value: 14, weight: 2, telegraph: 'Leviathan bite' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Tentacle strike', hitCount: 3 },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Vulnerability aura', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 11, weight: 1, telegraph: 'Deep strike' },
    ],
    description: 'Deep-abyss serpent. Wound it and it stops caring about defense.',
    phaseTransitionAt: 0.4,
    phase2IntentPool: [
      { type: 'attack', value: 18, weight: 2, telegraph: 'Enraged strike' },
      { type: 'multi_attack', value: 6, weight: 2, telegraph: 'Frenzy', hitCount: 4 },
      { type: 'attack', value: 14, weight: 1, telegraph: 'Devastating bite' },
    ],
    animArchetype: 'lurcher',
  },

  {
    id: 'crystal_lich',
    name: 'Crystal Lich',
    category: 'elite',
    region: 'the_abyss',
    baseHP: 65,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Curse', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Brittle hex', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'heal', value: 8, weight: 1, telegraph: 'Lich drain' },
      { type: 'attack', value: 11, weight: 1, telegraph: 'Crystal strike' },
    ],
    description: 'Crystal lich. Natural science cards do nothing to it. Debuffs everything.',
    immuneDomain: 'natural_sciences',
    animArchetype: 'caster',
  },

  // ── THE ARCHIVE — COMMON (11 new) ──

  {
    id: 'pressure_djinn',
    name: 'Pressure Djinn',
    category: 'common',
    region: 'the_archive',
    baseHP: 42,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Air burst' },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Pressure strike', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Wind strike' },
    ],
    description: 'Compressed air elemental. The pressure alone opens wounds.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'floater',
    chargeResistant: true,
  },

  {
    id: 'core_worm',
    name: 'Core Worm',
    category: 'common',
    region: 'the_archive',
    baseHP: 40,
    intentPool: [
      { type: 'attack', value: 11, weight: 2, telegraph: 'Iron strike' },
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Bite frenzy', hitCount: 3 },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Segmented strike' },
    ],
    description: 'Iron-bodied worm from the core. Bites repeatedly.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
  },

  {
    id: 'biolume_jellyfish',
    name: 'Biolume Jellyfish',
    category: 'common',
    region: 'the_archive',
    baseHP: 38,
    intentPool: [
      { type: 'debuff', value: 1, weight: 3, telegraph: 'Glowing sting', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Luminous strike' },
      { type: 'attack', value: 8, weight: 1, telegraph: 'Tentacle strike' },
    ],
    description: 'Bioluminescent jellyfish. Its sting saps strength.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'floater',
  },

  {
    id: 'tectonic_scarab',
    name: 'Tectonic Scarab',
    category: 'common',
    region: 'the_archive',
    baseHP: 45,
    intentPool: [
      { type: 'defend', value: 8, weight: 2, telegraph: 'Plate armor' },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Carapace strike' },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Mandible crunch' },
    ],
    description: 'Plated beetle, massive. Difficult to damage through that shell.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'trembler',
    chargeResistant: true,
  },

  {
    id: 'mantle_fiend',
    name: 'Mantle Fiend',
    category: 'common',
    region: 'the_archive',
    baseHP: 41,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Molten jab' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Magma burn', statusEffect: { type: 'poison', value: 2, turns: 2 } },
      { type: 'buff', value: 1, weight: 1, telegraph: 'Heat surge', statusEffect: { type: 'strength', value: 1, turns: 2 } },
    ],
    description: 'Mantle-born demon. Burns, poisons, and gets stronger doing it.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'striker',
  },

  {
    id: 'iron_core_golem',
    name: 'Iron Core Golem',
    category: 'common',
    region: 'the_archive',
    baseHP: 48,
    intentPool: [
      { type: 'defend', value: 9, weight: 3, telegraph: 'Iron plating' },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Core slam' },
      { type: 'charge', value: 25, weight: 1, telegraph: 'Charging: Iron crush!' },
    ],
    description: 'Pure iron golem. Dense enough that most damage just doesn\'t register.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'slammer',
    chargeResistant: true,
  },

  {
    id: 'glyph_sentinel',
    name: 'Glyph Sentinel',
    category: 'common',
    region: 'the_archive',
    baseHP: 39,
    intentPool: [
      { type: 'defend', value: 7, weight: 2, telegraph: 'Rune shield' },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Curse glyph', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Rune strike' },
    ],
    description: 'Inscribed stone tablet, floating. Curses weaken on contact.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'floater',
  },

  {
    id: 'archive_moth',
    name: 'Archive Moth',
    category: 'common',
    region: 'the_archive',
    baseHP: 36,
    intentPool: [
      { type: 'attack', value: 11, weight: 2, telegraph: 'Paper flurry' },
      { type: 'debuff', value: 1, weight: 2, telegraph: 'Papyrus curse', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'attack', value: 9, weight: 1, telegraph: 'Wing strike' },
    ],
    description: 'Eats books and scrolls. Leaves you vulnerable.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'swooper',
  },

  {
    id: 'rune_spider',
    name: 'Rune Spider',
    category: 'common',
    region: 'the_archive',
    baseHP: 37,
    intentPool: [
      { type: 'multi_attack', value: 4, weight: 2, telegraph: 'Rune web', hitCount: 3 },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Cursed bite', statusEffect: { type: 'poison', value: 2, turns: 3 } },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Fang strike' },
    ],
    description: 'Weaves runic webs. The threads poison.',
    rarity: 'uncommon',
    spawnWeight: 5,
    animArchetype: 'crawler',
  },

  {
    id: 'void_tendril',
    name: 'Void Tendril',
    category: 'common',
    region: 'the_archive',
    baseHP: 39,
    intentPool: [
      { type: 'attack', value: 11, weight: 2, telegraph: 'Void strike' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Void weakness', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Void fracture', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
    description: 'Tendril from somewhere else. Weakens and exposes in equal measure.',
    rarity: 'rare',
    spawnWeight: 2,
    animArchetype: 'caster',
  },

  {
    id: 'tome_mimic',
    name: 'Tome Mimic',
    category: 'common',
    region: 'the_archive',
    baseHP: 40,
    intentPool: [
      { type: 'attack', value: 10, weight: 2, telegraph: 'Page slash' },
      { type: 'multi_attack', value: 3, weight: 2, telegraph: 'Paper storm', hitCount: 3 },
      { type: 'defend', value: 6, weight: 1, telegraph: 'Bookmark shield' },
    ],
    description: 'Shaped like a tome, moves like a predator.',
    rarity: 'standard',
    spawnWeight: 10,
    animArchetype: 'lurcher',
    chargeResistant: true,
  },

  // ── THE ARCHIVE — MINI-BOSS (7 new) ──

  {
    id: 'primordial_wyrm',
    name: 'Primordial Wyrm',
    category: 'mini_boss',
    region: 'the_archive',
    baseHP: 63,
    intentPool: [
      { type: 'attack', value: 13, weight: 2, telegraph: 'Ancient bite' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Coil strike', hitCount: 3 },
      { type: 'charge', value: 28, weight: 1, telegraph: 'Charging: Primordial rage!' },
      { type: 'attack', value: 10, weight: 1, telegraph: 'Tail sweep' },
    ],
    description: 'Old enough to remember the world\'s formation. Wound it and you\'ll know.',
    phaseTransitionAt: 0.5,
    phase2IntentPool: [
      { type: 'attack', value: 16, weight: 2, telegraph: 'Enraged bite' },
      { type: 'multi_attack', value: 6, weight: 2, telegraph: 'Fury coil', hitCount: 4 },
    ],
    animArchetype: 'lurcher',
  },

  {
    id: 'iron_archon',
    name: 'Iron Archon',
    category: 'mini_boss',
    region: 'the_archive',
    baseHP: 62,
    intentPool: [
      { type: 'attack', value: 12, weight: 2, telegraph: 'Angelic strike' },
      { type: 'defend', value: 10, weight: 2, telegraph: 'Magnetic shield' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Metallic surge', statusEffect: { type: 'strength', value: 2, turns: 2 } },
      { type: 'debuff', value: 1, weight: 1, telegraph: 'Expose weakness', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
    ],
    description: 'Iron-forged and magnetic. Fights without favoring offense or defense.',
    animArchetype: 'caster',
    onPlayerNoCharge: (ctx) => {
      // AR-99 Phase 3: quickPlayPunish — gains +1 Strength if player makes no Charge plays.
      applyStatusEffect(ctx.enemy.statusEffects, {
        type: 'strength',
        value: 1,
        turnsRemaining: 999,
      });
    },
  },

  {
    id: 'pressure_colossus',
    name: 'Pressure Colossus',
    category: 'mini_boss',
    region: 'the_archive',
    baseHP: 72,
    intentPool: [
      { type: 'defend', value: 12, weight: 2, telegraph: 'Pressure wall' },
      { type: 'charge', value: 32, weight: 1, telegraph: 'Charging: Pressure burst!' },
      { type: 'attack', value: 13, weight: 2, telegraph: 'Crushing slam' },
    ],
    description: 'Ultra-dense golem under extreme pressure. Barely flinches.',
    animArchetype: 'slammer',
  },

  {
    id: 'biolume_monarch',
    name: 'Biolume Monarch',
    category: 'mini_boss',
    region: 'the_archive',
    baseHP: 59,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Luminous curse', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Brittle glow', statusEffect: { type: 'vulnerable', value: 1, turns: 2 } },
      { type: 'heal', value: 7, weight: 1, telegraph: 'Radiant mend' },
      { type: 'attack', value: 11, weight: 1, telegraph: 'Glow strike' },
    ],
    description: 'Bioluminescent butterfly, vast and old. Curses you while healing itself.',
    animArchetype: 'floater',
  },

  {
    id: 'tectonic_titan',
    name: 'Tectonic Titan',
    category: 'mini_boss',
    region: 'the_archive',
    baseHP: 68,
    intentPool: [
      { type: 'attack', value: 13, weight: 2, telegraph: 'Earthquake slam' },
      { type: 'charge', value: 30, weight: 1, telegraph: 'Charging: Tectonic shift!' },
      { type: 'multi_attack', value: 5, weight: 2, telegraph: 'Plate break', hitCount: 3 },
    ],
    description: 'A living earthquake. Stone given will and direction.',
    animArchetype: 'slammer',
  },

  {
    id: 'glyph_warden',
    name: 'Glyph Warden',
    category: 'mini_boss',
    region: 'the_archive',
    baseHP: 61,
    intentPool: [
      { type: 'defend', value: 10, weight: 2, telegraph: 'Rune fortification' },
      { type: 'heal', value: 7, weight: 1, telegraph: 'Glyph mending' },
      { type: 'attack', value: 12, weight: 1, telegraph: 'Rune strike' },
      { type: 'buff', value: 2, weight: 1, telegraph: 'Protective runes', statusEffect: { type: 'strength', value: 1, turns: 3 } },
    ],
    description: 'Built from protective runes. Hard to chip down, keeps healing.',
    animArchetype: 'trembler',
    onPlayerNoCharge: (ctx) => {
      // AR-99 Phase 3: quickPlayPunish — gains +1 Strength if player makes no Charge plays.
      applyStatusEffect(ctx.enemy.statusEffects, {
        type: 'strength',
        value: 1,
        turnsRemaining: 999,
      });
    },
  },

  {
    id: 'archive_specter',
    name: 'Archive Specter',
    category: 'mini_boss',
    region: 'the_archive',
    baseHP: 48,
    intentPool: [
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Forgotten curse', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 11, weight: 2, telegraph: 'Spectral strike' },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Ghostly form' },
      { type: 'heal', value: 6, weight: 1, telegraph: 'Memory drain' },
    ],
    description: 'The ghost of a librarian. Still cataloguing. Still territorial.',
    animArchetype: 'caster',
  },

  // ── THE ARCHIVE — ELITE (2 new) ──

  {
    id: 'mantle_dragon',
    name: 'Mantle Dragon',
    category: 'elite',
    region: 'the_archive',
    baseHP: 70,
    intentPool: [
      { type: 'attack', value: 14, weight: 3, telegraph: 'Nullification strike' },
      { type: 'debuff', value: 2, weight: 2, telegraph: 'Chain disruption', statusEffect: { type: 'weakness', value: 1, turns: 2 } },
      { type: 'attack', value: 12, weight: 2, telegraph: 'Void impact' },
      { type: 'defend', value: 8, weight: 1, telegraph: 'Null barrier' },
    ],
    description: 'Chain multipliers don\'t work while this is alive. Knowledge Chains flatline at 1.0x.',
    animArchetype: 'swooper',
    chainMultiplierOverride: 1.0,
  },

  {
    id: 'core_harbinger',
    name: 'Core Harbinger',
    category: 'elite',
    region: 'the_archive',
    baseHP: 65,
    intentPool: [
      { type: 'attack', value: 12, weight: 3, telegraph: 'Tome strike' },
      { type: 'buff', value: 2, weight: 2, telegraph: 'Study buff', statusEffect: { type: 'strength', value: 2, turns: 3 } },
      { type: 'attack', value: 10, weight: 2, telegraph: 'Shelf sweep' },
      { type: 'defend', value: 10, weight: 1, telegraph: 'Book barrier' },
    ],
    description: 'Quick Play does nothing to it. Only Charge deals damage.',
    animArchetype: 'caster',
    quickPlayImmune: true,
  },

];

// ============================================================
// ACT ENEMY POOLS
// ============================================================

/**
 * Enemy pool configuration for each act in the 3-act structure.
 * Used by getEnemiesForNode() to select appropriate enemies by act and node type.
 */
export interface ActEnemyPool {
  act: 1 | 2 | 3;
  /** Enemy template IDs eligible for standard combat nodes. */
  commons: string[];
  /** Enemy template IDs eligible for elite nodes. */
  elites: string[];
  /** Enemy template IDs eligible for mini-boss gate. */
  miniBosses: string[];
  /** Enemy template IDs eligible for act boss node (usually 1). */
  bosses: string[];
}

/**
 * Act-based enemy pools for the v2 3-act run structure (AR-59.5).
 * Replaces the legacy region-based BOSS_POOL_BY_REGION and MINI_BOSS_POOL_BY_REGION
 * lookups in floorManager.ts.
 */
export const ACT_ENEMY_POOLS: ActEnemyPool[] = [
  // ── ACT 1: Shallow Depths ──
  {
    act: 1,
    commons: [
      'cave_bat', 'crystal_golem', 'toxic_spore',
      'mud_crawler', 'root_strangler', 'iron_beetle', 'limestone_imp',
      'cave_spider', 'peat_shambler', 'fungal_sprout', 'blind_grub',
      // AR-98: 4 new commons for early-game variety
      'dust_mite', 'stalactite_bat', 'glow_worm', 'rock_crab',
    ],
    elites: ['ore_wyrm', 'cave_troll'],
    miniBosses: ['venomfang', 'root_mother', 'iron_matriarch', 'bog_witch', 'mushroom_sovereign'],
    bosses: ['the_excavator', 'magma_core'],
  },
  // ── ACT 2: Deep Caverns + The Abyss ──
  {
    act: 2,
    commons: [
      // deep_caverns commons
      'shadow_mimic', 'bone_collector', 'basalt_crawler', 'salt_wraith',
      'coal_imp', 'granite_hound', 'sulfur_sprite', 'magma_tick',
      'deep_angler', 'rock_hermit', 'gas_phantom', 'stalactite_drake',
      'ember_moth',
      // the_abyss commons
      'obsidian_shard', 'magma_slime', 'quartz_elemental', 'fossil_raptor',
      'geode_beetle', 'lava_crawler', 'crystal_bat', 'void_mite',
      'ash_wraith', 'prismatic_jelly', 'ember_skeleton',
    ],
    elites: [
      'fossil_guardian', 'magma_serpent', 'basalt_titan',
      'geode_king', 'abyssal_leviathan', 'crystal_lich',
    ],
    miniBosses: [
      'crystal_guardian', 'stone_sentinel', 'sulfur_queen', 'granite_colossus',
      'deep_lurker', 'lava_salamander',
      'ember_drake', 'shade_stalker', 'obsidian_knight', 'quartz_hydra',
      'fossil_wyvern', 'magma_broodmother',
    ],
    bosses: ['the_archivist', 'crystal_warden', 'shadow_hydra', 'void_weaver'],
  },
  // ── ACT 3: The Archive ──
  {
    act: 3,
    commons: [
      'pressure_djinn', 'core_worm', 'biolume_jellyfish', 'tectonic_scarab',
      'mantle_fiend', 'iron_core_golem', 'glyph_sentinel', 'archive_moth',
      'rune_spider', 'void_tendril', 'tome_mimic',
    ],
    elites: ['mantle_dragon', 'core_harbinger'],
    miniBosses: [
      'primordial_wyrm', 'iron_archon', 'pressure_colossus', 'biolume_monarch',
      'tectonic_titan', 'glyph_warden', 'archive_specter',
    ],
    bosses: ['knowledge_golem', 'the_curator'],
  },
];

/**
 * Returns enemy template objects for a given act and node type.
 *
 * @param act - The act number (1, 2, or 3).
 * @param nodeType - The node type: 'combat', 'elite', 'mini_boss', or 'boss'.
 * @returns Array of EnemyTemplate objects matching the request.
 */
export function getEnemiesForNode(
  act: 1 | 2 | 3,
  nodeType: 'combat' | 'elite' | 'mini_boss' | 'boss',
): EnemyTemplate[] {
  const pool = ACT_ENEMY_POOLS.find(p => p.act === act);
  if (!pool) return [];

  let ids: string[];
  switch (nodeType) {
    case 'combat': ids = pool.commons; break;
    case 'elite': ids = pool.elites; break;
    case 'mini_boss': ids = pool.miniBosses; break;
    case 'boss': ids = pool.bosses; break;
    default: ids = [];
  }

  return ids
    .map(id => ENEMY_TEMPLATES.find(t => t.id === id))
    .filter((t): t is EnemyTemplate => t !== undefined);
}
