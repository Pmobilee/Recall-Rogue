// === Chain System ===
// Tracks the Knowledge Chain state for the current player turn.
// A chain forms when consecutive correctly-answered cards in the same turn
// share the same categoryL2 value.

import { CHAIN_MULTIPLIERS, MAX_CHAIN_LENGTH } from '../data/balance';

export interface ChainState {
  /** The categoryL2 value of the current chain, or null if no chain is active. */
  categoryL2: string | null;
  /** Current chain length. 0 = no cards played yet. 1 = first card (no bonus). */
  length: number;
}

let _chain: ChainState = { categoryL2: null, length: 0 };

/**
 * Resets the chain at the start of each player turn.
 * Called by turnManager at the start of each new turn.
 */
export function resetChain(): void {
  _chain = { categoryL2: null, length: 0 };
}

/**
 * Called when a card is played correctly.
 * Extends the chain if categoryL2 matches, or resets it to a new chain.
 *
 * @param categoryL2 - The categoryL2 value of the card just played. Undefined = no chain contribution.
 * @param chainMultiplierOverride - If set, the raw chain multiplier is clamped to this value.
 *   Used by The Nullifier (AR-59.13) to neutralize chain stacking.
 * @returns The chain multiplier that applies to this card's effect.
 */
export function extendOrResetChain(categoryL2: string | undefined, chainMultiplierOverride?: number): number {
  if (!categoryL2) {
    // Card has no categoryL2 — reset chain, no bonus
    _chain = { categoryL2: null, length: 0 };
    return 1.0;
  }

  if (categoryL2 === _chain.categoryL2) {
    _chain.length = Math.min(_chain.length + 1, MAX_CHAIN_LENGTH);
  } else {
    _chain = { categoryL2, length: 1 };
  }

  const rawMult = getChainMultiplier(_chain.length);
  return chainMultiplierOverride !== undefined ? chainMultiplierOverride : rawMult;
}

/**
 * Returns the current chain multiplier for the given chain length.
 */
export function getChainMultiplier(length: number): number {
  const clamped = Math.min(Math.max(0, length), MAX_CHAIN_LENGTH);
  return CHAIN_MULTIPLIERS[clamped] ?? 1.0;
}

/**
 * Returns the current chain length (0 if no chain active).
 */
export function getCurrentChainLength(): number {
  return _chain.length;
}

/**
 * Returns a snapshot of the current chain state for UI consumption.
 */
export function getChainState(): Readonly<ChainState> {
  return { ..._chain };
}
