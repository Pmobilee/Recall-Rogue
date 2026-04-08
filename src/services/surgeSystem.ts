/**
 * Knowledge Surge System (AR-59.4, updated AR-122)
 *
 * Every 4th player turn is a Surge turn granting a CC bonus multiplier and extra draw.
 * The turn counter persists across encounters within a run (not reset per encounter).
 * Surge turns: 2, 6, 10, 14, ...
 *
 * Surge waives the CHARGE_AP_SURCHARGE (+1 AP) on Charge plays, making it the strategic
 * burst window for free charging. On non-surge turns, charging costs base AP + CHARGE_AP_SURCHARGE.
 */

import { CHARGE_AP_SURCHARGE, SURGE_FIRST_TURN, SURGE_INTERVAL } from '../data/balance';

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
 * Surge turns return 0 (surcharge waived — free charging window).
 * Non-surge turns return CHARGE_AP_SURCHARGE (currently 1).
 */
export function getSurgeChargeSurcharge(turnNumber: number): number {
  return isSurgeTurn(turnNumber) ? 0 : CHARGE_AP_SURCHARGE;
}
