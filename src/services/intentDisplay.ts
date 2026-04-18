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
 *   2. For `multi_attack`: multiply by `intent.hitCount` BEFORE the cap (matches executor order)
 *   3. `enemy.difficultyVariance` (0.8–1.2× for common enemies)
 *   4. Brain Fog aura (+20% when aura is 'brain_fog')
 *   5. Segment damage cap — applied to the TOTAL (not per-hit)
 *
 * **Second-layer modifiers** (mirrors `turnManager.ts` §3094-3130, requires `scalingCtx`):
 *   6. Relaxed difficulty mode (×0.7)
 *   7. `ascensionEnemyDamageMultiplier`
 *   8. `canaryEnemyDamageMultiplier` (co-op scaling — main cause of 18→~11 display drift)
 *
 * **Intentionally EXCLUDED from display** (runtime/HP-dependent, would mislead players):
 *   - Enrage bonus (changes continuously as enemy takes damage)
 *   - Glass Cannon relic penalty (changes as player HP changes)
 *   - Self-Burn bonus (changes with player burn stack count)
 *
 * **Return value for `multi_attack`:** TOTAL damage (per-hit × hits), not per-hit.
 * This matches `executeEnemyIntent()` which also returns total. The UI shows this
 * number directly — it is what the player will actually take (minus block).
 *
 * @param intent      - The enemy intent whose `.value` we are scaling.
 * @param enemy       - The enemy instance (for strength, floor, difficultyVariance).
 * @param scalingCtx  - Optional turn-state snapshot for canary/ascension/difficulty modifiers.
 *                      If omitted, only first-layer modifiers are applied (backward-compatible
 *                      for call sites that haven't been updated yet).
 *
 * @deprecated For display purposes, prefer `computeIntentHpImpact` which accounts for
 *             the current block value available when the enemy strikes.
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

  // Bug 1 fix: for multi_attack, multiply by hitCount BEFORE applying the cap.
  // executeEnemyIntent() computes: round(perHit * mods) * hits, then caps the total.
  // The old code was: round(perHit * mods), then cap per-hit, then the UI multiplied by
  // hits — meaning the cap was applied to the per-hit value, not the total. With a cap
  // of 16 and per-hit = 11, this showed "2×11" (22 implied) while the executor capped
  // the total at 16. Now both paths cap the same TOTAL value.
  if (intent.type === 'multi_attack') {
    const hits = intent.hitCount ?? 1;
    damage = damage * hits;
  }

  // difficultyVariance (fixed per enemy instance, 0.8–1.2× for common)
  if (enemy.difficultyVariance !== 1) {
    damage = Math.round(damage * enemy.difficultyVariance);
  }

  // Brain Fog aura: +20% when the player's answer accuracy is very low
  if (getAuraState() === 'brain_fog') {
    damage = Math.round(damage * 1.2);
  }

  // Segment damage cap applied to the TOTAL (matches executeEnemyIntent order)
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
  /** Raw scaled damage before block is applied (what `computeIntentDisplayDamage` returns).
   *  For multi_attack intents this is the TOTAL across all hits. */
  raw: number;
  /**
   * Player's current block value at display time.
   * Block does NOT decay before the enemy attacks — `resetTurnState()` (which decays
   * block) runs AFTER `takeDamage()` in the `endPlayerTurn()` sequence. This field
   * reflects the full undecayed block the enemy will actually hit.
   */
  postDecayBlock: number;
  /**
   * HP the player will lose after their block absorbs damage.
   * This is the number that should be shown in the intent preview bubble — it is
   * what actually matters to the player's decision-making.
   * `Math.max(0, raw - postDecayBlock)`
   */
  hpDamage: number;
}

/**
 * Compute the HP impact of an enemy intent against the player's current block.
 *
 * **Turn order correction (Bug 2 fix):**
 * Block does NOT decay before the enemy attacks. In `endPlayerTurn()`, the sequence is:
 *   4. `executeEnemyIntent()` — enemy attacks
 *   5. `takeDamage(playerState)` — uses FULL current block
 *   ...
 *  10. `resetTurnState(playerState, act)` — block decays here, AFTER the attack
 *
 * The previous implementation incorrectly applied act-aware block decay in this function,
 * which caused displayed HP damage to be higher than actual (player block was artificially
 * reduced before comparing to raw damage).
 *
 * **Non-attack intents:** return `{ raw: 0, postDecayBlock: playerBlock, hpDamage: 0 }`.
 * The enemy attacks with its current intent; block is available in full.
 *
 * **multi_attack:** `raw` is the TOTAL damage across all hits (Bug 1 fix).
 * Block is subtracted from the total once, matching `takeDamage()` behavior.
 *
 * @param intent      - The enemy intent to evaluate.
 * @param enemy       - The enemy instance (for damage pipeline modifiers).
 * @param playerBlock - The player's CURRENT block value.
 * @param act         - Unused. Kept for call-site compatibility — block decay is not applied.
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

  // Bug 2 fix: block does NOT decay before the enemy attacks. takeDamage() (step 5)
  // runs before resetTurnState() (step 10) in endPlayerTurn(). The player has their
  // full current block available when the hit lands.
  // The `act` parameter is retained for call-site compatibility but is no longer used.
  const postDecayBlock = playerBlock;
  const hpDamage = Math.max(0, raw - postDecayBlock);

  return { raw, postDecayBlock, hpDamage };
}


/**
 * Minimal player state snapshot passed to intent lock calculation.
 * Contains only the fields needed to compute display damage at a point in time.
 */
export interface PlayerStateSnapshot {
  /** Player's current shield/block value at the time the intent was rolled. */
  shield: number;
  /** Player's active status effects (e.g. strength/weakness that affect received damage). */
  statusEffects: import('../data/statusEffects').StatusEffect[];
}

/**
 * Compute and return a SNAPSHOT of the intent's display damage, pinned to the
 * player state that exists at the moment rollNextIntent() is called.
 *
 * This is the value that should be stored on `EnemyInstance.lockedDisplayDamage`
 * so that the UI reads a stable number rather than re-deriving it live from
 * mutable `turnState.playerState.shield`.
 *
 * For `multi_attack` intents, stores the TOTAL damage (per-hit × hits) — matching
 * `executeEnemyIntent()` and `computeIntentDisplayDamage()` which both work in totals.
 *
 * @param intent      - The newly rolled enemy intent.
 * @param enemy       - The enemy instance (for strength, floor, variance).
 * @param playerState - Snapshot of the player state AT INTENT-ROLL TIME.
 * @param scalingCtx  - Optional scaling context (canary/ascension/difficulty).
 * @returns The locked display damage value to store on the enemy.
 */
export function computeIntentDisplayDamageSnapshot(
  intent: EnemyIntent,
  enemy: EnemyInstance,
  playerState: Pick<PlayerStateSnapshot, 'shield' | 'statusEffects'>,
  scalingCtx?: EnemyDamageScalingContext,
): number {
  // Snapshot the raw scaled damage using the same pipeline as live display.
  // Block adjustment is the UI's responsibility at render time, not stored here.
  return computeIntentDisplayDamage(intent, enemy, scalingCtx);
}
