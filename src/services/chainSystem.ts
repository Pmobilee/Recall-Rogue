// === Chain System (AR-70) ===
// Tracks the Knowledge Chain state for the current player turn.
// A chain forms when consecutive correctly-Charged cards share the same chainType (0-5).
//
// Rotating Active Chain Color (AR-310):
// Each turn, one of the 3 run chain types is pseudo-randomly selected as the
// "active chain color". Cards matching the active color extend the chain multiplier.
// The multiplier persists across turns; only the active color rotates. This forces
// variety — players cannot hoard a single color to build chains indefinitely.

import { CHAIN_MULTIPLIERS, MAX_CHAIN_LENGTH, CHAIN_DECAY_PER_TURN } from '../data/balance';

export interface ChainState {
  /** The chainType index of the current chain, or null if no chain is active. */
  chainType: number | null;
  /** Current chain length. 0 = no cards played yet. 1 = first card (no bonus). */
  length: number;
}

let _chain: ChainState = { chainType: null, length: 0 };

// ---------------------------------------------------------------------------
// Active chain color — AR-310 rotating chain color mechanic
// ---------------------------------------------------------------------------

/** The 3 chain type indices active for this run (set via initChainSystem). */
let _runChainTypes: number[] = [];

/**
 * Deterministic seed for chain color rotation (set via initChainSystem).
 * Ensures the rotation sequence is reproducible from run seed.
 */
let _chainRotationSeed: number = 0;

/**
 * The active chain color for the current turn.
 * Cards with this chainType extend the chain; others do not.
 * null when the chain system has not been initialised (non-curated / pre-encounter).
 */
let _activeChainColor: number | null = null;

/**
 * Initialise the chain system for a new encounter.
 * Stores the run chain types and rotation seed so `rotateActiveChainColor` can
 * select a deterministic color per turn without needing external state.
 *
 * Call this once from encounterBridge when starting a new combat encounter.
 *
 * @param runChainTypes - The 3 chain type indices for this run (e.g. [0, 2, 4]).
 * @param seed          - Deterministic rotation seed (use RunState.runSeed).
 */
export function initChainSystem(runChainTypes: number[], seed: number): void {
  _runChainTypes = runChainTypes.length > 0 ? runChainTypes : [];
  _chainRotationSeed = seed;
}

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
 * Selects the active chain color for the given turn number using a deterministic
 * LCG derived from the run seed. The active color rotates each turn so players
 * must play cards of a varying color to extend the chain multiplier.
 *
 * If no run chain types are configured (e.g. trivia/general runs before
 * initChainSystem is called), returns null and no rotation is applied.
 *
 * Call this at the start of each player turn (i.e. at the top of endPlayerTurn
 * after incrementing turnNumber, so the new turn already has the rotated color).
 *
 * @param turnNumber - The global turn number for the coming turn.
 * @returns The newly active chain type index, or null if rotation is not configured.
 */
export function rotateActiveChainColor(turnNumber: number): number | null {
  if (_runChainTypes.length === 0) {
    _activeChainColor = null;
    return null;
  }
  // Deterministic LCG: mix seed + turn number to pick an index.
  // Using the same LCG constants as chainDistribution.ts / chainTypes.ts.
  const mixed = ((_chainRotationSeed * 1664525 + turnNumber * 1013904223) & 0xFFFFFFFF) >>> 0;
  const idx = mixed % _runChainTypes.length;
  _activeChainColor = _runChainTypes[idx];
  return _activeChainColor;
}

/**
 * Returns the active chain color for the current turn, or null if not configured.
 * Used by the UI (CardHand.svelte) to highlight cards that would extend the chain.
 */
export function getActiveChainColor(): number | null {
  return _activeChainColor;
}

/**
 * Called when a card is played correctly via Charge.
 * Extends the chain if chainType matches the ACTIVE chain color, or does not
 * extend the chain this turn (but does NOT reset the multiplier).
 *
 * With rotating chain colors (AR-310):
 * - Matching the active chain color → chain extends (length + 1)
 * - Not matching the active chain color → chain does not extend this turn
 *   (multiplier is preserved at its current level)
 * - null/undefined chainType → resets chain to 0
 *
 * If no run chain types are configured (_runChainTypes is empty), falls back
 * to the legacy same-type-consecutive matching for backward compatibility.
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

  if (_runChainTypes.length > 0 && _activeChainColor !== null) {
    // AR-310: rotating chain color mode.
    // Only the active color extends the chain; wrong color preserves length without extending.
    if (chainType === _activeChainColor) {
      // Card matches the active color — extend chain.
      _chain = {
        chainType,
        length: Math.min(_chain.length + 1, MAX_CHAIN_LENGTH),
      };
    }
    // Cards not matching the active color: chain state unchanged (multiplier preserved).
    // _chain.chainType remains as is; length is not incremented.
  } else {
    // Legacy mode (no run chain types configured): consecutive same-type matching.
    if (chainType === _chain.chainType) {
      _chain.length = Math.min(_chain.length + 1, MAX_CHAIN_LENGTH);
    } else {
      _chain = { chainType, length: 1 };
    }
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
