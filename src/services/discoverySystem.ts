/**
 * Fact Discovery System — "Free First Charge"
 *
 * The first time a player Charges a fact in a run:
 * - AP surcharge = 0 (same as CHARGE_AP_SURCHARGE globally — no special distinction now)
 * - Wrong answer = 1.0× multiplier (same as Quick Play — no penalty for trying)
 * - Correct answer = full Charge multiplier
 *
 * After the first Charge, the fact is normal for the rest of the run:
 * - AP surcharge = CHARGE_AP_SURCHARGE (currently 0)
 * - Wrong answer = FIZZLE_EFFECT_RATIO (0.25×)
 *
 * Note: With CHARGE_AP_SURCHARGE = 0, the "free" AP distinction no longer exists.
 * The system remains for tracking wrong-answer multiplier differences on first Charge.
 *
 * Per-run, not per-encounter. Resets only on new run.
 *
 * Design spec: docs/roadmap/completed/AR-59.23-FACT-DISCOVERY-SYSTEM.md
 */

/**
 * Returns true if this fact has NOT yet had its free first Charge used this run.
 * A free Charge is available for every fact once per run.
 */
export function isFirstChargeFree(
  factId: string,
  freeChargeIds: Set<string>,
): boolean {
  return !freeChargeIds.has(factId);
}

/**
 * Marks a fact's free first Charge as used. Call this after Charge resolution
 * (regardless of correct/wrong outcome).
 *
 * Mutates the freeChargeIds set in place.
 */
export function markFirstChargeUsed(
  factId: string,
  freeChargeIds: Set<string>,
): void {
  freeChargeIds.add(factId);
}

/**
 * Returns the damage multiplier for a wrong answer on a free first Charge.
 * Same as Quick Play — 1.0× — so there is no penalty for trying a new fact.
 */
export function getFirstChargeWrongMultiplier(): number {
  return 1.0;
}
