/**
 * Unified enemy damage scaling helper for Recall Rogue.
 *
 * This module is the SINGLE source of truth for enemy damage modifiers that are
 * applied between `executeEnemyIntent()` and `takeDamage()`. Both the intent
 * DISPLAY path and the RUNTIME application path must call `applyEnemyDamageScaling()`
 * so the two can never silently drift apart.
 *
 * Modifier application order (matches turnManager.ts §3094-3130):
 *   1. (pre-applied in executeEnemyIntent): strengthMod, floorScaling, GLOBAL_ENEMY_DAMAGE_MULTIPLIER,
 *      difficultyVariance, Brain Fog aura, segment damage cap
 *   2. enrageBonus (runtime: depends on enemy HP%) — excluded from display
 *   3. segment damage cap re-applied after enrage
 *   4. relaxed difficulty mode (×0.7)
 *   5. ascensionEnemyDamageMultiplier
 *   6. canaryEnemyDamageMultiplier
 *   7. glass cannon relic penalty (runtime: depends on player HP%) — excluded from display
 *   8. self-burn bonus (runtime: depends on player burn stacks) — excluded from display
 *
 * The intent DISPLAY only applies modifiers that are knowable before the attack
 * lands: #4, #5, #6. Modifiers #2, #7, #8 depend on mid-encounter runtime state
 * and are excluded from display (they would be misleading since they change
 * throughout a turn).
 *
 * Source files:
 *   Consumers: `src/services/intentDisplay.ts`, `src/services/turnManager.ts`
 */

import type { DifficultyMode } from './cardPreferences';

/** Minimal turn-state fields needed by the scaling helper. */
export interface EnemyDamageScalingContext {
  /**
   * Global enemy damage multiplier set by the Canary co-op scaling system and
   * endless mode. In co-op mode this is often < 1 (e.g. 0.6) to avoid
   * punishing players for shared HP pools.
   * Defaults to 1 if omitted.
   */
  canaryEnemyDamageMultiplier?: number;
  /**
   * Multiplier from the ascension (Ascension Mode difficulty) system.
   * Defaults to 1 if omitted.
   */
  ascensionEnemyDamageMultiplier?: number;
  /**
   * Current difficulty mode. Relaxed mode applies a 0.7× reduction.
   */
  difficultyMode?: DifficultyMode;
}

/**
 * Apply the post-executeEnemyIntent damage scaling modifiers.
 *
 * Takes the `damage` value already returned by `executeEnemyIntent()` (which has
 * difficultyVariance, Brain Fog, and the first segment cap baked in) and applies
 * the second layer of multipliers from `turnManager.ts`:
 *   - relaxed difficulty mode (×0.7)
 *   - ascensionEnemyDamageMultiplier
 *   - canaryEnemyDamageMultiplier
 *
 * @param baseDamage  - Damage from `executeEnemyIntent()` (already includes strength,
 *                      floor scaling, global multiplier, variance, Brain Fog, first cap).
 * @param context     - Turn-state snapshot with the scaling multipliers.
 * @returns           - Scaled damage (floored to int via Math.max + Math.round).
 */
export function applyPostIntentDamageScaling(
  baseDamage: number,
  context: EnemyDamageScalingContext,
): number {
  if (baseDamage <= 0) return 0;

  let damage = baseDamage;

  if (context.difficultyMode === 'relaxed') {
    damage = Math.round(damage * 0.7);
  }

  damage = Math.max(
    0,
    Math.round(
      damage *
      (context.ascensionEnemyDamageMultiplier ?? 1) *
      (context.canaryEnemyDamageMultiplier ?? 1),
    ),
  );

  return damage;
}
