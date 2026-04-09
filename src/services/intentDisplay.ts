import type { EnemyIntent, EnemyInstance } from '../data/enemies';
import { getStrengthModifier } from '../data/statusEffects';
import { getFloorDamageScaling } from './enemyManager';
import { GLOBAL_ENEMY_DAMAGE_MULTIPLIER, ENEMY_TURN_DAMAGE_CAP, getBalanceValue } from '../data/balance';
import { getAuraState } from './knowledgeAuraSystem';
import { applyPostIntentDamageScaling, type EnemyDamageScalingContext } from './enemyDamageScaling';

/**
 * Map floor number to the damage-cap segment used in executeEnemyIntent.
 * Mirrors the unexported `getSegmentForFloor()` in enemyManager.ts.
 */
function _getSegmentForFloor(floor: number): 1 | 2 | 3 | 4 | 'endless' {
  if (floor <= 6) return 1;
  if (floor <= 12) return 2;
  if (floor <= 18) return 3;
  if (floor <= 24) return 4;
  return 'endless';
}

/**
 * Compute the display damage for an enemy intent, applying the EXACT same
 * multipliers the real damage pipeline uses.
 *
 * **Only attack-type intents produce damage.** Non-attack intents (defend, buff,
 * debuff, heal, charge) return 0, matching `executeEnemyIntent()` behavior.
 *
 * **First-layer modifiers** (mirrors `executeEnemyIntent()` — same formula):
 *   1. `intent.value × strengthMod × floorScaling × GLOBAL_ENEMY_DAMAGE_MULTIPLIER`
 *   2. `enemy.difficultyVariance` (0.8–1.2× for common enemies)
 *   3. Brain Fog aura (+20% when aura is 'brain_fog')
 *   4. Segment damage cap (`enemyTurnDamageCap` by floor segment)
 *
 * **Second-layer modifiers** (mirrors `turnManager.ts` §3094-3130, requires `scalingCtx`):
 *   5. Relaxed difficulty mode (×0.7)
 *   6. `ascensionEnemyDamageMultiplier`
 *   7. `canaryEnemyDamageMultiplier` (co-op scaling — main cause of 18→~11 display drift)
 *
 * **Intentionally EXCLUDED from display** (runtime/HP-dependent, would mislead players):
 *   - Enrage bonus (changes continuously as enemy takes damage)
 *   - Glass Cannon relic penalty (changes as player HP changes)
 *   - Self-Burn bonus (changes with player burn stack count)
 *
 * @param intent      - The enemy intent whose `.value` we are scaling.
 * @param enemy       - The enemy instance (for strength, floor, difficultyVariance).
 * @param scalingCtx  - Optional turn-state snapshot for canary/ascension/difficulty modifiers.
 *                      If omitted, only first-layer modifiers are applied (backward-compatible
 *                      for call sites that haven't been updated yet).
 */
export function computeIntentDisplayDamage(
  intent: EnemyIntent,
  enemy: EnemyInstance,
  scalingCtx?: EnemyDamageScalingContext,
): number {
  // Only attack and multi_attack intents deal damage.
  // Defend, buff, debuff, heal, charge all return 0.
  if (intent.type !== 'attack' && intent.type !== 'multi_attack') return 0;

  // ── First-layer: mirrors executeEnemyIntent() ────────────────────────────

  const strengthMod = getStrengthModifier(enemy.statusEffects);
  const floorScaling = getFloorDamageScaling(enemy.floor);

  let damage = Math.round(intent.value * strengthMod * floorScaling * GLOBAL_ENEMY_DAMAGE_MULTIPLIER);

  if (damage <= 0) return 0;

  // difficultyVariance (fixed per enemy instance, 0.8–1.2× for common)
  if (enemy.difficultyVariance !== 1) {
    damage = Math.round(damage * enemy.difficultyVariance);
  }

  // Brain Fog aura: +20% when the player's answer accuracy is very low
  if (getAuraState() === 'brain_fog') {
    damage = Math.round(damage * 1.2);
  }

  // Segment damage cap (first application — enrage re-application is excluded)
  if (!intent.bypassDamageCap) {
    const seg = _getSegmentForFloor(enemy.floor);
    const capLookup = getBalanceValue('enemyTurnDamageCap', ENEMY_TURN_DAMAGE_CAP) as Record<1 | 2 | 3 | 4 | 'endless', number | null>;
    const cap = capLookup[seg];
    if (cap != null) {
      damage = Math.min(damage, cap);
    }
  }

  // ── Second-layer: relaxed mode + ascension + canary ──────────────────────

  if (!scalingCtx) {
    return damage;
  }
  return applyPostIntentDamageScaling(damage, scalingCtx);
}
