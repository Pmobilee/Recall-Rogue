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
 * Result of `computeIntentDisplayDamageWithPerHit` — both the total and per-hit
 * display values for an intent. Per-hit is only meaningful for multi_attack; for
 * regular attack intents, total === perHit.
 */
export interface IntentDisplayDamageResult {
  /**
   * Total damage the intent will deal across all hits.
   * For regular `attack`: same as perHit.
   * For `multi_attack`: perHit × hitCount.
   */
  total: number;
  /**
   * Per-hit damage value for multi_attack intents, post-cap and post-scaling.
   * For regular `attack`: same as total (single hit).
   * For non-attack intents: 0.
   *
   * Used by the UI to show "N hits × M" format so players understand that M is
   * the per-hit amount and total is M × N — not M per hit × N = ambiguous large number.
   */
  perHit: number;
}

/**
 * Compute display damage with per-hit breakdown for multi_attack intents.
 *
 * This is the canonical computation function used by both the display pipeline
 * and the snapshot pipeline. `computeIntentDisplayDamage` delegates to this.
 *
 * **Pipeline order (matches executeEnemyIntent exactly):**
 *
 * For `multi_attack`:
 *   1. `perHit = round(intent.value × strengthMod × floorScaling × GLOBAL_ENEMY_DAMAGE_MULTIPLIER)`
 *   2. Apply `difficultyVariance` to perHit
 *   3. Apply Brain Fog (+20%) to perHit
 *   4. Apply PER-HIT cap: `perHit = min(perHit, floor(segmentCap / hitCount))`
 *   5. Apply post-intent scaling (relaxed/ascension/canary) to perHit
 *   6. `total = perHit × hitCount`
 *
 * For `attack`:
 *   1–5 same but no hitCount multiplication
 *   total = perHit
 *
 * **Why per-hit cap for multi_attack:**
 * The executor (enemyManager.ts) caps each hit individually rather than the total.
 * This ensures the display formula `total = perHit × hits` stays exact — the total
 * shown in the UI is always exactly what the player takes.
 *
 * **Intentionally EXCLUDED from display** (runtime/HP-dependent):
 *   - Enrage bonus (changes as enemy takes damage)
 *   - Glass Cannon relic penalty (changes as player HP changes)
 *   - Self-Burn bonus (changes with player burn stacks)
 *
 * @param intent      - The enemy intent to evaluate.
 * @param enemy       - The enemy instance (for strength, floor, variance).
 * @param scalingCtx  - Optional scaling context (canary/ascension/difficulty).
 * @returns `{ total, perHit }` — both values for display.
 */
export function computeIntentDisplayDamageWithPerHit(
  intent: EnemyIntent,
  enemy: EnemyInstance,
  scalingCtx?: EnemyDamageScalingContext,
): IntentDisplayDamageResult {
  // Only attack and multi_attack intents deal damage.
  if (intent.type !== 'attack' && intent.type !== 'multi_attack') {
    return { total: 0, perHit: 0 };
  }

  // ── First-layer: mirrors executeEnemyIntent() ────────────────────────────

  const strengthMod = getStrengthModifier(enemy.statusEffects);
  const floorScaling = getFloorDamageScaling(enemy.floor);

  let perHit = Math.round(intent.value * strengthMod * floorScaling * GLOBAL_ENEMY_DAMAGE_MULTIPLIER);

  if (perHit <= 0) return { total: 0, perHit: 0 };

  // difficultyVariance (fixed per enemy instance, 0.8–1.2× for common)
  if (enemy.difficultyVariance !== 1) {
    perHit = Math.round(perHit * enemy.difficultyVariance);
  }

  // Brain Fog aura: +20% when the player's answer accuracy is very low
  if (getAuraState() === 'brain_fog') {
    perHit = Math.round(perHit * 1.2);
  }

  // For multi_attack: apply segment cap PER HIT (floor(totalCap / hits)).
  // This matches the executor which caps perHit before multiplying by hits,
  // ensuring total = perHit × hits is exact and predictable.
  // For regular attack: apply the full segment cap to the single-hit value.
  if (!intent.bypassDamageCap) {
    const seg = _getSegmentForFloor(enemy.floor);
    const capLookup = getBalanceValue('enemyTurnDamageCap', ENEMY_TURN_DAMAGE_CAP) as Record<1 | 2 | 3 | 4 | 'endless', number | null>;
    const cap = capLookup[seg];
    if (cap != null) {
      if (intent.type === 'multi_attack') {
        const hits = intent.hitCount ?? 1;
        const perHitCap = Math.floor(cap / hits);
        perHit = Math.min(perHit, perHitCap);
      } else {
        perHit = Math.min(perHit, cap);
      }
    }
  }

  // ── Second-layer: relaxed mode + ascension + canary ──────────────────────
  // Applied to perHit so that total = perHit × hits divides evenly.

  if (scalingCtx) {
    perHit = applyPostIntentDamageScaling(perHit, scalingCtx);
  }

  if (intent.type === 'multi_attack') {
    const hits = intent.hitCount ?? 1;
    const total = perHit * hits;
    return { total, perHit };
  }

  // Regular attack: total === perHit
  return { total: perHit, perHit };
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
 *   4. For `multi_attack`: per-hit segment cap, then `total = perHit × hitCount`
 *   5. For `attack`: full segment cap on single-hit value
 *
 * **Second-layer modifiers** (mirrors `turnManager.ts`, requires `scalingCtx`):
 *   6. Relaxed difficulty mode (×0.7)
 *   7. `ascensionEnemyDamageMultiplier`
 *   8. `canaryEnemyDamageMultiplier` (co-op scaling)
 *
 * **Intentionally EXCLUDED from display** (runtime/HP-dependent, would mislead players):
 *   - Enrage bonus (changes continuously as enemy takes damage)
 *   - Glass Cannon relic penalty (changes as player HP changes)
 *   - Self-Burn bonus (changes with player burn stack count)
 *
 * **Return value for `multi_attack`:** TOTAL damage (perHit × hits).
 * The UI shows this number directly — it is what the player will actually take (minus block).
 *
 * @param intent      - The enemy intent whose `.value` we are scaling.
 * @param enemy       - The enemy instance (for strength, floor, difficultyVariance).
 * @param scalingCtx  - Optional turn-state snapshot for canary/ascension/difficulty modifiers.
 *                      If omitted, only first-layer modifiers are applied (backward-compatible).
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
  return computeIntentDisplayDamageWithPerHit(intent, enemy, scalingCtx).total;
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
 * Compute and return a snapshot of the intent's display damage WITH per-hit breakdown,
 * pinned to the player state that exists at the moment rollNextIntent() is called.
 *
 * This is the canonical snapshot function used by turnManager.ts to populate both
 * `enemy.lockedDisplayDamage` (total) and `enemy.lockedDisplayDamagePerHit` (per-hit).
 *
 * For `multi_attack` intents, `perHit` is the per-hit value and `total = perHit × hits`.
 * For regular `attack` intents, `total === perHit`.
 *
 * @param intent      - The newly rolled enemy intent.
 * @param enemy       - The enemy instance (for strength, floor, variance).
 * @param playerState - Snapshot of the player state AT INTENT-ROLL TIME.
 * @param scalingCtx  - Optional scaling context (canary/ascension/difficulty).
 * @returns `{ total, perHit }` — store total on lockedDisplayDamage, perHit on lockedDisplayDamagePerHit.
 */
export function computeIntentDisplayDamageWithPerHitSnapshot(
  intent: EnemyIntent,
  enemy: EnemyInstance,
  playerState: Pick<PlayerStateSnapshot, 'shield' | 'statusEffects'>,
  scalingCtx?: EnemyDamageScalingContext,
): IntentDisplayDamageResult {
  // Snapshot the raw scaled damage using the same pipeline as live display.
  // Block adjustment is the UI's responsibility at render time, not stored here.
  // playerState is accepted for interface consistency (future use) but not read for damage.
  return computeIntentDisplayDamageWithPerHit(intent, enemy, scalingCtx);
}

/**
 * Compute and return a SNAPSHOT of the intent's display damage, pinned to the
 * player state that exists at the moment rollNextIntent() is called.
 *
 * This is the value that should be stored on `EnemyInstance.lockedDisplayDamage`
 * so that the UI reads a stable number rather than re-deriving it live from
 * mutable `turnState.playerState.shield`.
 *
 * For `multi_attack` intents, stores the TOTAL damage (per-hit × hits).
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
  // Delegate to the with-per-hit variant and return just the total for backward compat.
  return computeIntentDisplayDamageWithPerHit(intent, enemy, scalingCtx).total;
}
