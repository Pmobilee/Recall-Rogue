/**
 * Knowledge Surge System (AR-59.4)
 *
 * Every 3rd player turn is a Surge turn where Charging costs +0 AP.
 * Surge turns: 2, 5, 8, 11, 14, ...
 * Resets per encounter (turnNumber resets to 1 on new encounter).
 */

import { SURGE_FIRST_TURN, SURGE_INTERVAL } from '../data/balance';

/**
 * Returns true if the given turn number is a Surge turn.
 *
 * Formula: turn 2 is always first Surge. Then every SURGE_INTERVAL turns after.
 * isSurgeTurn(1) = false
 * isSurgeTurn(2) = true
 * isSurgeTurn(5) = true
 * isSurgeTurn(8) = true
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
