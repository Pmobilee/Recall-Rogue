/**
 * Knowledge Surge System (AR-59.4, updated AR-122)
 *
 * Every 4th player turn is a Surge turn granting a CC bonus multiplier and extra draw.
 * The turn counter persists across encounters within a run (not reset per encounter).
 * Surge turns: 2, 6, 10, 14, ...
 *
 * Note: Surge no longer waives a charge AP surcharge (CHARGE_AP_SURCHARGE = 0 globally).
 * Surge's value is its CC bonus multiplier (SURGE_CC_BONUS_MULTIPLIER) and extra card draw.
 */

import { SURGE_FIRST_TURN, SURGE_INTERVAL } from '../data/balance';

/**
 * Returns true if the given (global, run-persistent) turn number is a Surge turn.
 *
 * Formula: turn 2 is always the first Surge. Then every SURGE_INTERVAL turns after.
 * isSurgeTurn(1) = false
 * isSurgeTurn(2) = true
 * isSurgeTurn(6) = true
 * isSurgeTurn(10) = true
 */
export function isSurgeTurn(turnNumber: number): boolean {
  if (turnNumber === SURGE_FIRST_TURN) return true;
  if (turnNumber > SURGE_FIRST_TURN && (turnNumber - SURGE_FIRST_TURN) % SURGE_INTERVAL === 0) return true;
  return false;
}

/**
 * Returns the AP surcharge for Charge Play on this turn.
 * Always 0 — CHARGE_AP_SURCHARGE is 0 globally (Surge no longer waives a surcharge).
 * @deprecated Surcharge is always 0 now. Use CHARGE_AP_SURCHARGE directly.
 */
export function getSurgeChargeSurcharge(_turnNumber: number): number {
  return 0;
}
