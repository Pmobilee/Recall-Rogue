/**
 * Knowledge Surge System (AR-59.4, updated AR-122)
 *
 * Every 4th player turn is a Surge turn where Charging costs +0 AP.
 * The turn counter persists across encounters within a run (not reset per encounter).
 * Surge turns: 2, 6, 10, 14, ...
 *
 * Because the counter persists, Surge timing varies per encounter depending on
 * where in the run the fight begins. Short fights may have no Surge at all.
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
 * During a Surge turn: 0 (free Charging).
 * During normal turns: 1 (standard surcharge from AR-59.1).
 */
export function getSurgeChargeSurcharge(turnNumber: number): number {
  return isSurgeTurn(turnNumber) ? 0 : 1;
}
