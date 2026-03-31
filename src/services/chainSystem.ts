// === Chain System (AR-70) ===
// Tracks the Knowledge Chain state for the current player turn.
// A chain forms when consecutive correctly-Charged cards share the same chainType (0-5).

import { CHAIN_MULTIPLIERS, MAX_CHAIN_LENGTH, CHAIN_DECAY_PER_TURN } from '../data/balance';

export interface ChainState {
  /** The chainType index of the current chain, or null if no chain is active. */
  chainType: number | null;
  /** Current chain length. 0 = no cards played yet. 1 = first card (no bonus). */
  length: number;
}

let _chain: ChainState = { chainType: null, length: 0 };

/**
 * Fully resets the chain. Called at encounter start for a clean slate.
 */
export function resetChain(): void {
  _chain = { chainType: null, length: 0 };
}

/**
 * Decays the chain by CHAIN_DECAY_PER_TURN at the end of each player turn.
 * Instead of fully resetting, the chain length decreases by 1 so players carry
 * partial momentum into the next turn. If length reaches 0, chain type clears.
 *
 * Call this at end-of-turn (instead of resetChain) in turnManager.
 */
export function decayChain(): void {
  const newLength = Math.max(0, _chain.length - CHAIN_DECAY_PER_TURN);
  if (newLength === 0) {
    _chain = { chainType: null, length: 0 };
  } else {
    _chain = { ..._chain, length: newLength };
  }
}

/**
 * Called when a card is played correctly via Charge.
 * Extends the chain if chainType matches, or resets it to a new chain.
 *
 * @param chainType - The chainType (0-5) of the card just played. Undefined/null = no chain contribution.
 * @param chainMultiplierOverride - If set, the raw chain multiplier is clamped to this value.
 *   Used by The Nullifier (AR-59.13) to neutralize chain stacking.
 * @returns The chain multiplier that applies to this card's effect.
 */
export function extendOrResetChain(chainType: number | undefined | null, chainMultiplierOverride?: number): number {
  if (chainType === undefined || chainType === null) {
    // Card has no chainType — reset chain, no bonus
    _chain = { chainType: null, length: 0 };
    return 1.0;
  }

  if (chainType === _chain.chainType) {
    _chain.length = Math.min(_chain.length + 1, MAX_CHAIN_LENGTH);
  } else {
    _chain = { chainType, length: 1 };
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
