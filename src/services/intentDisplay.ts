import type { EnemyIntent, EnemyInstance } from '../data/enemies';
import { getStrengthModifier } from '../data/statusEffects';
import { getFloorDamageScaling } from './enemyManager';
import { GLOBAL_ENEMY_DAMAGE_MULTIPLIER, ENEMY_TURN_DAMAGE_CAP, BLOCK_DECAY_PER_ACT, BLOCK_DECAY_RETAIN_RATE, getBalanceValue } from '../data/balance';
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
 *
 * @deprecated For display purposes, prefer `computeIntentHpImpact` which accounts for
 *             block decay applied at end-of-player-turn (before the enemy swings).
 *             Raw damage misleads players who have block — the actual HP loss is lower.
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

/**
 * Result of `computeIntentHpImpact` — the three numbers the UI needs to
 * tell the player what the enemy intent will actually cost them.
 */
export interface IntentHpImpact {
  /** Raw scaled damage before block is applied (what `computeIntentDisplayDamage` returns). */
  raw: number;
  /**
   * Player's block value AFTER end-of-player-turn decay (act-aware).
   * This is the block the enemy will actually hit, not the current displayed block.
   * Decay: Act 1 = 15%, Act 2 = 25%, Act 3 = 35%. Falls back to 25% when act is unknown.
   */
  postDecayBlock: number;
  /**
   * HP the player will lose after their decayed block absorbs damage.
   * This is the number that should be shown in the intent preview bubble — it is
   * what actually matters to the player's decision-making.
   * `Math.max(0, raw - postDecayBlock)`
   */
  hpDamage: number;
}

/**
 * Compute the HP impact of an enemy intent, accounting for block decay.
 *
 * **Why this is needed (Issue 11):**
 * Block decays at end-of-player-turn (`resetTurnState()` in `playerCombatState.ts`)
 * BEFORE the enemy swings. A player with 15 block facing 15 damage in Act 1 will
 * retain `floor(15 × 0.85) = 12` block and take 3 HP — not 0. Showing the raw
 * damage ("15") misleads the player into thinking their block fully covers it.
 *
 * **Act fallback:** when `act` is undefined or not in `BLOCK_DECAY_PER_ACT`,
 * falls back to `BLOCK_DECAY_RETAIN_RATE` (75% retain = 25% decay) — consistent
 * with the fallback in `playerCombatState.resetTurnState()`.
 *
 * **Non-attack intents:** return `{ raw: 0, postDecayBlock: playerBlock, hpDamage: 0 }`.
 * Block decay still happens but the player takes no damage, so hpDamage is 0.
 *
 * @param intent      - The enemy intent to evaluate.
 * @param enemy       - The enemy instance (for damage pipeline modifiers).
 * @param playerBlock - The player's CURRENT block value (before decay).
 * @param act         - The current act number (1, 2, or 3). If undefined, falls back to 25% decay.
 * @param scalingCtx  - Optional scaling context (same as `computeIntentDisplayDamage`).
 */
export function computeIntentHpImpact(
  intent: EnemyIntent,
  enemy: EnemyInstance,
  playerBlock: number,
  act: number | undefined,
  scalingCtx?: EnemyDamageScalingContext,
): IntentHpImpact {
  const raw = computeIntentDisplayDamage(intent, enemy, scalingCtx);

  // Compute the decay rate: act-aware first, fallback to legacy BLOCK_DECAY_RETAIN_RATE.
  // Mirrors the exact logic in playerCombatState.resetTurnState().
  const decayRate = act !== undefined
    ? (BLOCK_DECAY_PER_ACT[act] ?? (1 - BLOCK_DECAY_RETAIN_RATE))
    : (1 - BLOCK_DECAY_RETAIN_RATE); // 0.25 decay = 0.75 retain

  const retainRate = 1 - decayRate;
  const postDecayBlock = Math.floor(playerBlock * retainRate);
  const hpDamage = Math.max(0, raw - postDecayBlock);

  return { raw, postDecayBlock, hpDamage };
}
