/**
 * Knowledge Surge System (AR-59.4, updated AR-122, Pass 3 balance 2026-04-09)
 *
 * Every 4th player turn is a Surge turn granting a CC bonus multiplier, extra draw, and +1 AP.
 * The turn counter persists across encounters within a run (not reset per encounter).
 * Surge turns: 2, 6, 10, 14, ...
 *
 * Pass 3 balance change: Surge no longer waives the CHARGE_AP_SURCHARGE.
 * Instead, Surge turns grant SURGE_BONUS_AP (+1 AP) at the start of the turn via endPlayerTurn().
 * Players spend this AP freely — charging still costs full surcharge.
 * getSurgeChargeSurcharge() is kept for API compatibility but always returns CHARGE_AP_SURCHARGE.
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
 * @deprecated As of Pass 3 balance (2026-04-09), Surge turns no longer waive the surcharge.
 * Surge grants +1 AP (SURGE_BONUS_AP) at turn-start instead. This function always returns
 * CHARGE_AP_SURCHARGE regardless of whether the turn is a Surge turn.
 * Kept for test compatibility — callers should check CHARGE_AP_SURCHARGE directly.
 */
export function getSurgeChargeSurcharge(_turnNumber: number): number {
  return CHARGE_AP_SURCHARGE;
}
