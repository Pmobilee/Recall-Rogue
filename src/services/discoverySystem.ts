/**
 * Fact Discovery System — "Free First Charge"
 *
 * The first time a player Charges a fact in a run, it is FREE:
 * - AP surcharge = 0 (regardless of Surge state)
 * - Wrong answer = 1.0× multiplier (same as Quick Play — no penalty for trying)
 * - Correct answer = full Charge multiplier (2.5×/3.0×/3.5× per tier)
 *
 * After the first Charge, the fact is normal for the rest of the run:
 * - AP surcharge = +1
 * - Wrong answer = 0.7× multiplier
 *
 * Per-run, not per-encounter. Resets only on new run.
 *
 * The ONLY visual indicator: the CHARGE button displays "FREE" (instead of "+1 AP")
 * when a fact hasn't been Charged yet this run.
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
