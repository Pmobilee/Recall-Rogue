// === Enemy Manager ===
// Creates and manages enemy instances during encounters.
// NO Phaser, Svelte, or DOM imports.

import type { EnemyTemplate, EnemyInstance, EnemyIntent, EnemyTurnStartContext } from '../data/enemies';
import type { StatusEffect } from '../data/statusEffects';
import { applyStatusEffect, tickStatusEffects, getStrengthModifier } from '../data/statusEffects';
import { ENEMY_TURN_DAMAGE_CAP, FLOOR_DAMAGE_SCALING_PER_FLOOR, FLOOR_DAMAGE_SCALE_MID, GLOBAL_ENEMY_DAMAGE_MULTIPLIER, getBalanceValue, ENEMY_BASE_HP_MULTIPLIER, ENEMY_HP_SCALING_PER_FLOOR, ENEMY_HP_SCALING_PER_FLOOR_BY_SEGMENT } from '../data/balance';
import { resolvePoisonTickBonus } from './relicEffectResolver';
import { getAuraState } from './knowledgeAuraSystem';

/**
 * Computes HP scaling factor for a given floor using segment-based scaling.
 *
 * Scaling rate varies by segment so early floors are gentle for beginners
 * while late floors ramp steeply for experienced players.
 * - Segment 1 (1-6): 0.08/floor  → Floor 1: 1.00×, Floor 6: 1.40×
 * - Segment 2 (7-12): 0.14/floor → Floor 7: ~1.48×, Floor 12: ~2.18×
 * - Segment 3 (13-18): 0.20/floor → Floor 13: ~2.38×, Floor 18: ~3.38×
 * - Segment 4 (19-24): 0.25/floor → Floor 19: ~3.63×, Floor 24: ~4.88×
 *
 * @param floor - The current floor number (1-indexed).
 * @returns The HP scaling multiplier.
 */
export function getFloorScaling(floor: number): number {
  // Determine segment (1-4)
  const segment = floor <= 6 ? 1 : floor <= 12 ? 2 : floor <= 18 ? 3 : 4;
  const scalingRate = ENEMY_HP_SCALING_PER_FLOOR_BY_SEGMENT[segment] ?? 0.18;
  return 1.0 + (floor - 1) * scalingRate;
}

/**
 * Computes damage scaling factor for a given floor.
 *
 * Floors 1-6 = 100% base, floors 7+ = 100% + 4% per floor above 6.
 */
export function getFloorDamageScaling(floor: number): number {
  if (floor <= 6) return FLOOR_DAMAGE_SCALE_MID;
  return FLOOR_DAMAGE_SCALE_MID + (floor - 6) * getBalanceValue('floorDamageScalingPerFloor', FLOOR_DAMAGE_SCALING_PER_FLOOR);
}

/**
 * Selects a random intent from a weighted pool.
 *
 * Uses weighted random selection where each intent's weight determines
 * its probability of being chosen.
 *
 * @param pool - The intent pool to select from.
 * @returns The selected EnemyIntent.
 */
function weightedRandomIntent(pool: EnemyIntent[]): EnemyIntent {
  const totalWeight = pool.reduce((sum, intent) => sum + intent.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const intent of pool) {
    roll -= intent.weight;
    if (roll <= 0) {
      return intent;
    }
  }

  // Fallback (should not reach here)
  return pool[pool.length - 1];
}

/**
 * Computes HP scaling multiplier for co-op/multiplayer encounters.
 * Uses a sublinear curve inspired by Monster Hunter:
 * - 1 player: 1.0x (solo baseline)
 * - 2 players: 1.6x (not 2x — accounts for accuracy-dependent damage + co-op synergy)
 * - 3 players: 2.2x
 * - 4 players: 2.3x (capped)
 *
 * Recall Rogue scales lower than StS2 because damage depends on quiz accuracy:
 * two 70% accuracy players deal ~1.4x effective DPS, not 2x. The 0.6 coefficient
 * (vs naive 0.5) accounts for co-op synergy effects pushing combined DPS above
 * raw accuracy alone.
 *
 * @param playerCount - Number of players in the encounter (1 = solo baseline).
 * @returns The HP scaling multiplier (1.0 minimum).
 */
export function getCoopHpMultiplier(playerCount: number): number {
  if (playerCount <= 1) return 1.0;
  return Math.min(2.3, 1.0 + (playerCount - 1) * 0.6);
}

/**
 * Computes block scaling for co-op encounters.
 * +60% per additional player scales in lockstep with HP to prevent combined
 * DPS from trivializing enemy defense.
 *
 * @param playerCount - Number of players in the encounter (1 = solo baseline).
 * @returns The block scaling multiplier (1.0 minimum).
 */
export function getCoopBlockMultiplier(playerCount: number): number {
  if (playerCount <= 1) return 1.0;
  return 1.0 + (playerCount - 1) * 0.6;
}

/**
 * Computes damage cap scaling for co-op encounters.
 * Scales in lockstep with HP (0.6 coefficient) so caps don't bottleneck enemy
 * damage output against multi-HP pools.
 * Solo caps: 7/10/15/22 → 2P: ~11/16/24/35.
 *
 * @param playerCount - Number of players in the encounter (1 = solo baseline).
 * @returns The damage cap scaling multiplier (1.0 minimum).
 */
export function getCoopDamageCapMultiplier(playerCount: number): number {
  if (playerCount <= 1) return 1.0;
  return 1.0 + (playerCount - 1) * 0.6;
}

/**
 * Creates a live enemy instance from a template, scaled to the given floor.
 *
 * HP = round(baseHP × ENEMY_BASE_HP_MULTIPLIER × getFloorScaling(floor) × hpMultiplier × coopHpScale × difficultyVariance).
 * The first intent is pre-rolled.
 *
 * @param template - The enemy template to instantiate.
 * @param floor - The current floor number for HP scaling.
 * @param options - Optional {hpMultiplier, difficultyVariance, playerCount}. All default to 1.
 * @returns A fully initialized EnemyInstance.
 */
export function createEnemy(
  template: EnemyTemplate,
  floor: number,
  options?: { hpMultiplier?: number; difficultyVariance?: number; playerCount?: number },
): EnemyInstance {
  const hpMultiplier = options?.hpMultiplier ?? 1;
  const difficultyVariance = options?.difficultyVariance ?? 1;
  const playerCount = options?.playerCount ?? 1;
  const coopHpScale = getCoopHpMultiplier(playerCount);
  const scaledHP = Math.max(1, Math.round(
    template.baseHP * ENEMY_BASE_HP_MULTIPLIER * getFloorScaling(floor)
    * hpMultiplier * coopHpScale * difficultyVariance
  ));
  const instance: EnemyInstance = {
    template,
    currentHP: scaledHP,
    maxHP: scaledHP,
    block: 0,
    nextIntent: weightedRandomIntent(template.intentPool),
    statusEffects: [],
    phase: 1,
    floor,
    isCharging: false,
    chargedDamage: 0,
    difficultyVariance,
    enrageBonusDamage: 0,
    playerChargedThisTurn: false,
    playerCount,
  };
  // AR-263: Initialize hardcover armor from template if defined (The Textbook)
  if (template.hardcoverArmor !== undefined) {
    instance._hardcover = template.hardcoverArmor;
  }
  return instance;
}

/**
 * Rolls a new intent for the enemy from its current phase's intent pool.
 *
 * If the enemy is in phase 2 and has a phase2IntentPool, uses that pool.
 * If the enemy is currently charging, returns a synthetic attack intent that fires the charged attack.
 *
 * @param enemy - The enemy instance (mutated in place).
 * @returns The newly rolled intent.
 */
export function rollNextIntent(enemy: EnemyInstance): EnemyIntent {
  // If charging, next turn automatically fires the charged attack
  if (enemy.isCharging) {
    const chargedIntent: EnemyIntent = {
      type: 'attack',
      value: enemy.chargedDamage,
      weight: 1,
      telegraph: 'Unleashing charged attack!',
      bypassDamageCap: true,
    };
    enemy.nextIntent = chargedIntent;
    enemy.isCharging = false;
    enemy.chargedDamage = 0;
    return chargedIntent;
  }

  const pool = (enemy.phase === 2 && enemy.template.phase2IntentPool)
    ? enemy.template.phase2IntentPool
    : enemy.template.intentPool;
  enemy.nextIntent = weightedRandomIntent(pool);
  return enemy.nextIntent;
}

/**
 * Applies damage to an enemy, checking for phase transition and defeat.
 *
 * If the enemy has a phaseTransitionAt threshold and HP drops below it,
 * the enemy transitions to phase 2 and a new intent is rolled.
 *
 * @param enemy - The enemy instance (mutated in place).
 * @param damage - The amount of damage to deal.
 * @returns Object indicating whether the enemy was defeated and remaining HP.
 */
export function applyDamageToEnemy(
  enemy: EnemyInstance,
  damage: number
): { defeated: boolean; remainingHP: number } {
  if (enemy.block > 0) {
    const blockedDamage = Math.min(enemy.block, damage);
    enemy.block -= blockedDamage;
    damage -= blockedDamage;
  }
  enemy.currentHP = Math.max(0, enemy.currentHP - damage);

  // Check phase transition
  if (
    enemy.phase === 1 &&
    enemy.template.phaseTransitionAt != null &&
    enemy.template.phase2IntentPool &&
    enemy.currentHP > 0 &&
    enemy.currentHP / enemy.maxHP <= enemy.template.phaseTransitionAt
  ) {
    enemy.phase = 2;
    rollNextIntent(enemy);
    // AR-263: Fire onPhaseTransition callback for instance-level overrides (e.g. The Curriculum)
    if (enemy.template.onPhaseTransition) {
      enemy.template.onPhaseTransition(enemy);
    }
  }

  return {
    defeated: enemy.currentHP <= 0,
    remainingHP: enemy.currentHP,
  };
}

/**
 * Maps a floor number to its difficulty segment.
 *
 * @param floor - The current floor number.
 * @returns The segment (1-4) or 'endless' for floors 25+.
 */
function getSegmentForFloor(floor: number): 1 | 2 | 3 | 4 | 'endless' {
  if (floor <= 6) return 1;
  if (floor <= 12) return 2;
  if (floor <= 18) return 3;
  if (floor <= 24) return 4;
  return 'endless';
}

/**
 * Dispatches the onEnemyTurnStart callback for the given enemy, if defined.
 * Called at the start of each enemy turn (after player ends their turn).
 * Used for enrage logic (Timer Wyrm), mastery erosion (Brain Fog), and other per-turn enemy effects.
 *
 * @param enemy - The enemy instance (mutated in place by callback).
 * @param turnNumber - The current turn number (1-indexed).
 * @param playerChargedCorrectLastTurn - Whether the player made at least 1 correct Charge last turn.
 * @param playerHand - The actual card objects in the player's current hand (mutations affect real hand).
 */
export function dispatchEnemyTurnStart(
  enemy: EnemyInstance,
  turnNumber: number,
  playerChargedCorrectLastTurn: boolean,
  playerHand: Array<{ id: string; masteryLevel?: number }>,
): void {
  if (enemy.template.onEnemyTurnStart) {
    const ctx: EnemyTurnStartContext = { enemy, turnNumber, playerChargedCorrectLastTurn, playerHand };
    enemy.template.onEnemyTurnStart(ctx);
  }
}

/**
 * Executes the enemy's current intent, applying strength modifier and enrage bonus.
 *
 * Returns the results of the intent execution without modifying player state
 * (the turn manager is responsible for applying effects to the player).
 *
 * @param enemy - The enemy instance.
 * @returns The intent execution results.
 */
export function executeEnemyIntent(enemy: EnemyInstance): {
  damage: number;
  playerEffects: StatusEffect[];
  enemyHealed: number;
  stunned: boolean;
} {
  // AR-263: Pop Quiz stun — if stunned, skip action entirely
  if (enemy._stunNextTurn) {
    enemy._stunNextTurn = false;
    return { damage: 0, playerEffects: [], enemyHealed: 0, stunned: true };
  }

  const intent = enemy.nextIntent;
  const strengthMod = getStrengthModifier(enemy.statusEffects);

  let damage = 0;
  let enemyHealed = 0;
  const playerEffects: StatusEffect[] = [];

  switch (intent.type) {
    case 'attack': {
      const baseValue = intent.value + (enemy.enrageBonusDamage ?? 0);
      damage = Math.round(baseValue * strengthMod * getFloorDamageScaling(enemy.floor) * GLOBAL_ENEMY_DAMAGE_MULTIPLIER);
      break;
    }
    case 'multi_attack': {
      const hits = intent.hitCount ?? 1;
      const baseValue = intent.value + (enemy.enrageBonusDamage ?? 0);
      damage = Math.round(baseValue * strengthMod * getFloorDamageScaling(enemy.floor) * GLOBAL_ENEMY_DAMAGE_MULTIPLIER) * hits;
      break;
    }
    case 'defend': {
      enemy.block += intent.value;
      break;
    }
    case 'buff': {
      // Apply buff to enemy (e.g., strength).
      // 6.3: Enemy buffs persist the entire encounter — use 9999 sentinel so
      // tickStatusEffects never expires them mid-fight. Player debuffs still use
      // their normal duration (handled in the 'debuff' case below).
      if (intent.statusEffect) {
        applyStatusEffect(enemy.statusEffects, {
          type: intent.statusEffect.type,
          value: intent.statusEffect.value,
          turnsRemaining: 9999,
        });
      }
      break;
    }
    case 'debuff': {
      // Apply debuff to player
      if (intent.statusEffect) {
        const effect = {
          type: intent.statusEffect.type,
          value: intent.statusEffect.value,
          turnsRemaining: intent.statusEffect.turns,
        };
        playerEffects.push(effect);
      }
      break;
    }
    case 'heal': {
      enemyHealed = Math.min(intent.value, enemy.maxHP - enemy.currentHP);
      enemy.currentHP += enemyHealed;
      break;
    }
    case 'charge': {
      // No damage this turn — enemy is winding up
      enemy.isCharging = true;
      enemy.chargedDamage = intent.value;
      damage = 0;
      break;
    }
  }

  // Apply difficulty variance for common enemies (0.8-1.2x)
  if (damage > 0 && enemy.difficultyVariance !== 1) {
    damage = Math.round(damage * enemy.difficultyVariance);
  }

  // AR-261: Brain Fog — player's poor answer accuracy makes enemy hits 20% harder
  if (damage > 0 && getAuraState() === 'brain_fog') {
    damage = Math.round(damage * 1.2);
  }

  // Apply per-turn damage cap by segment (AR-32)
  // Charged attacks (marked with bypassDamageCap) bypass the cap
  if (damage > 0 && !intent.bypassDamageCap) {
    const seg = getSegmentForFloor(enemy.floor);
    const capLookup = getBalanceValue('enemyTurnDamageCap', ENEMY_TURN_DAMAGE_CAP) as Record<1 | 2 | 3 | 4 | 'endless', number | null>;
    const cap = capLookup[seg];
    if (cap != null) {
      damage = Math.min(damage, cap);
    }
  }

  return { damage, playerEffects, enemyHealed, stunned: false };
}

/**
 * Ticks status effects on an enemy (poison damage, regen heal, expiry).
 *
 * @param enemy    - The enemy instance (mutated in place).
 * @param relicIds - Set of relic IDs the player holds (for plague_flask bonus).
 * @returns The tick results (poison damage dealt, regen applied).
 */
export function tickEnemyStatusEffects(enemy: EnemyInstance, relicIds?: Set<string>): {
  poisonDamage: number;
  regenHeal: number;
} {
  const result = tickStatusEffects(enemy.statusEffects);

  // Apply poison damage to enemy
  // plague_flask — each active poison stack deals +2 bonus damage per tick
  if (result.poisonDamage > 0) {
    const poisonStackCount = enemy.statusEffects.filter(s => s.type === 'poison').length;
    const plagueBonus = resolvePoisonTickBonus(relicIds ?? new Set()) * poisonStackCount;
    const totalPoisonDamage = result.poisonDamage + plagueBonus;
    enemy.currentHP = Math.max(0, enemy.currentHP - totalPoisonDamage);
    result.poisonDamage = totalPoisonDamage;
  }

  // Apply regen heal to enemy
  if (result.regenHeal > 0) {
    enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + result.regenHeal);
  }

  return {
    poisonDamage: result.poisonDamage,
    regenHeal: result.regenHeal,
  };
}
