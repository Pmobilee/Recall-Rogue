// === Enemy Manager ===
// Creates and manages enemy instances during encounters.
// NO Phaser, Svelte, or DOM imports.

import type { EnemyTemplate, EnemyInstance, EnemyIntent } from '../data/enemies';
import type { StatusEffect } from '../data/statusEffects';
import { applyStatusEffect, tickStatusEffects, getStrengthModifier } from '../data/statusEffects';

/**
 * Computes HP scaling factor for a given floor.
 *
 * Floor 1 = 1.0x, each subsequent floor adds 12%.
 *
 * @param floor - The current floor number (1-indexed).
 * @returns The HP scaling multiplier.
 */
export function getFloorScaling(floor: number): number {
  return 1.0 + (floor - 1) * 0.12;
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
 * Creates a live enemy instance from a template, scaled to the given floor.
 *
 * HP = round(baseHP * getFloorScaling(floor)). The first intent is pre-rolled.
 *
 * @param template - The enemy template to instantiate.
 * @param floor - The current floor number for HP scaling.
 * @returns A fully initialized EnemyInstance.
 */
export function createEnemy(template: EnemyTemplate, floor: number): EnemyInstance {
  const scaledHP = Math.round(template.baseHP * getFloorScaling(floor));
  return {
    template,
    currentHP: scaledHP,
    maxHP: scaledHP,
    block: 0,
    nextIntent: weightedRandomIntent(template.intentPool),
    statusEffects: [],
    phase: 1,
  };
}

/**
 * Rolls a new intent for the enemy from its current phase's intent pool.
 *
 * If the enemy is in phase 2 and has a phase2IntentPool, uses that pool.
 *
 * @param enemy - The enemy instance (mutated in place).
 * @returns The newly rolled intent.
 */
export function rollNextIntent(enemy: EnemyInstance): EnemyIntent {
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
  }

  return {
    defeated: enemy.currentHP <= 0,
    remainingHP: enemy.currentHP,
  };
}

/**
 * Executes the enemy's current intent, applying strength modifier.
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
} {
  const intent = enemy.nextIntent;
  const strengthMod = getStrengthModifier(enemy.statusEffects);

  let damage = 0;
  let enemyHealed = 0;
  const playerEffects: StatusEffect[] = [];

  switch (intent.type) {
    case 'attack': {
      damage = Math.round(intent.value * strengthMod);
      break;
    }
    case 'multi_attack': {
      const hits = intent.hitCount ?? 1;
      damage = Math.round(intent.value * strengthMod) * hits;
      break;
    }
    case 'defend': {
      enemy.block += intent.value;
      break;
    }
    case 'buff': {
      // Apply buff to enemy (e.g., strength)
      if (intent.statusEffect) {
        applyStatusEffect(enemy.statusEffects, {
          type: intent.statusEffect.type,
          value: intent.statusEffect.value,
          turnsRemaining: intent.statusEffect.turns,
        });
      }
      break;
    }
    case 'debuff': {
      // Apply debuff to player
      if (intent.statusEffect) {
        playerEffects.push({
          type: intent.statusEffect.type,
          value: intent.statusEffect.value,
          turnsRemaining: intent.statusEffect.turns,
        });
      }
      break;
    }
    case 'heal': {
      enemyHealed = Math.min(intent.value, enemy.maxHP - enemy.currentHP);
      enemy.currentHP += enemyHealed;
      break;
    }
  }

  return { damage, playerEffects, enemyHealed };
}

/**
 * Ticks status effects on an enemy (poison damage, regen heal, expiry).
 *
 * @param enemy - The enemy instance (mutated in place).
 * @returns The tick results (poison damage dealt, regen applied).
 */
export function tickEnemyStatusEffects(enemy: EnemyInstance): {
  poisonDamage: number;
  regenHeal: number;
} {
  const result = tickStatusEffects(enemy.statusEffects);

  // Apply poison damage to enemy
  if (result.poisonDamage > 0) {
    enemy.currentHP = Math.max(0, enemy.currentHP - result.poisonDamage);
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
