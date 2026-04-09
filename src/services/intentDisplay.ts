import type { EnemyIntent, EnemyInstance } from '../data/enemies';
import { getStrengthModifier } from '../data/statusEffects';
import { getFloorDamageScaling } from './enemyManager';
import { GLOBAL_ENEMY_DAMAGE_MULTIPLIER } from '../data/balance';

/**
 * Compute the display damage for an enemy intent, applying the EXACT same
 * multipliers the real damage pipeline uses (strength, floor scaling, global
 * multiplier). This is the single source of truth — both the UI intent text
 * formatter and executeEnemyIntent() must produce the same number for the
 * same (intent, enemy) pair.
 */
export function computeIntentDisplayDamage(intent: EnemyIntent, enemy: EnemyInstance): number {
  const strengthMod = getStrengthModifier(enemy.statusEffects);
  const floorScaling = getFloorDamageScaling(enemy.floor);
  return Math.round(intent.value * strengthMod * floorScaling * GLOBAL_ENEMY_DAMAGE_MULTIPLIER);
}
