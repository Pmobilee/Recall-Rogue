// === Chain System (AR-70) ===
// Tracks the Knowledge Chain state for the current player turn.
// A chain forms when consecutive correctly-Charged cards share the same chainType (0-5).
//
// Rotating Active Chain Color (AR-310):
// Each turn, one of the 3 run chain types is pseudo-randomly selected as the
// "active chain color". Cards matching the active color extend the chain multiplier.
// The multiplier persists across turns; only the active color rotates. This forces
// variety — players cannot hoard a single color to build chains indefinitely.
//
// 7.7: Weighted rotation (rotateActiveChainColorWeighted) biases toward chain types
// with more cards in the deck, improving distribution fairness.
//
// 7.8: Wrong off-colour charges reduce the chain (×0.5) rather than fully resetting.
//
// Mid-turn active color switch (2026-04-09):
// When a player correctly Charges an off-colour card, the active chain color switches
// to that card's color for the remainder of the turn. This rewards strategic pivots —
// the new color becomes surcharge-free, and the chain length is preserved (the pivot
// was earned by answering correctly). The turn-boundary rotation is unchanged.

import { CHAIN_MULTIPLIERS, MAX_CHAIN_LENGTH, CHAIN_DECAY_RATE } from '../data/balance';

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
 * Deck composition for weighted chain color rotation (AR-7.7).
 * Maps chainTypeIndex → card count. Set via initChainSystem.
 * When empty, uniform distribution is used.
 */
let _deckComposition: Map<number, number> = new Map();

/**
 * Initialise the chain system for a new encounter.
 * Stores the run chain types and rotation seed so `rotateActiveChainColor` can
 * select a deterministic color per turn without needing external state.
 *
 * Call this once from encounterBridge when starting a new combat encounter.
 *
 * @param runChainTypes   - The 3 chain type indices for this run (e.g. [0, 2, 4]).
 * @param seed            - Deterministic rotation seed (use RunState.runSeed).
 * @param deckComposition - Optional map of chainTypeIndex → card count for weighted rotation (7.7).
 */
export function initChainSystem(runChainTypes: number[], seed: number, deckComposition?: Map<number, number>): void {
  _runChainTypes = runChainTypes.length > 0 ? runChainTypes : [];
  _chainRotationSeed = seed;
  _deckComposition = deckComposition ?? new Map();
}

/**
 * Fully resets the chain. Called at encounter start for a clean slate.
 */
export function resetChain(): void {
  _chain = { chainType: null, length: 0 };
}

/**
 * Decays the chain proportionally at the end of each player turn.
 * Instead of a flat reduction, loses `ceil(length × CHAIN_DECAY_RATE)` length points.
 * Higher chains lose more absolute length but still retain partial momentum.
 * If length reaches 0, chain type clears.
 *
 * Decay table at CHAIN_DECAY_RATE = 0.5:
 *   length 1 → 0 (decay 1)
 *   length 2 → 1 (decay 1)
 *   length 3 → 1 (decay 2)
 *   length 4 → 2 (decay 2)
 *   length 5 → 2 (decay 3)
 *
 * Call this at end-of-turn (instead of resetChain) in turnManager.
 */
export function decayChain(): void {
  if (_chain.length <= 0) return;
  const decay = Math.max(1, Math.ceil(_chain.length * CHAIN_DECAY_RATE));
  const newLength = Math.max(0, _chain.length - decay);
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
 * @param turnNumber   - The global turn number for the coming turn.
 * @param excludeColor - Optional color to exclude from selection (used at turn
 *   boundaries to guarantee the color always rotates to something different).
 *   If only one chain type exists and it matches excludeColor, falls back to
 *   the full candidate list (no alternative available).
 * @returns The newly active chain type index, or null if rotation is not configured.
 */
export function rotateActiveChainColor(turnNumber: number, excludeColor?: number | null): number | null {
  if (_runChainTypes.length === 0) {
    _activeChainColor = null;
    return null;
  }

  // Filter out the excluded color (typically the previous turn's color).
  let candidates = excludeColor != null
    ? _runChainTypes.filter(c => c !== excludeColor)
    : _runChainTypes;

  // If only one chain type exists and it's excluded, fall back to all types.
  if (candidates.length === 0) {
    candidates = _runChainTypes;
  }

  // Deterministic LCG: mix seed + turn number to pick an index.
  // Using the same LCG constants as chainDistribution.ts / chainTypes.ts.
  const mixed = ((_chainRotationSeed * 1664525 + turnNumber * 1013904223) & 0xFFFFFFFF) >>> 0;
  const idx = mixed % candidates.length;
  _activeChainColor = candidates[idx];
  return _activeChainColor;
}

/**
 * Selects the active chain color weighted by deck composition (AR-7.7).
 * Chain types with more cards in the deck appear more frequently as the active color.
 * This improves turn fairness: a color representing 13/24 cards is the active color
 * ~54% of turns rather than the uniform 33%.
 *
 * Falls back to uniform distribution if deckComposition is empty or all counts are 0.
 * Falls back to null if no run chain types are configured.
 *
 * @param turnNumber      - The global turn number (used as RNG seed input).
 * @param deckComposition - chainTypeIndex → card count (can override the stored one).
 * @param excludeColor    - Optional color to exclude from selection (same semantics
 *   as rotateActiveChainColor's excludeColor).
 * @returns The newly active chain type index, or null if rotation is not configured.
 */
export function rotateActiveChainColorWeighted(turnNumber: number, deckComposition?: Map<number, number>, excludeColor?: number | null): number | null {
  if (_runChainTypes.length === 0) {
    _activeChainColor = null;
    return null;
  }

  const composition = deckComposition ?? _deckComposition;

  // Filter out the excluded color.
  let candidates = excludeColor != null
    ? _runChainTypes.filter(c => c !== excludeColor)
    : _runChainTypes;
  if (candidates.length === 0) candidates = _runChainTypes;

  const totalCards = candidates.reduce((sum, ct) => sum + (composition.get(ct) ?? 0), 0);

  if (totalCards === 0) {
    // No deck composition data for candidates — fall back to uniform among candidates.
    const mixed = ((_chainRotationSeed * 1664525 + turnNumber * 1013904223) & 0xFFFFFFFF) >>> 0;
    const idx = mixed % candidates.length;
    _activeChainColor = candidates[idx];
    return _activeChainColor;
  }

  // Deterministic LCG: same constants as rotateActiveChainColor for reproducibility.
  const mixed = ((_chainRotationSeed * 1664525 + turnNumber * 1013904223) & 0xFFFFFFFF) >>> 0;
  // Scale to [0, totalCards) bucket.
  const roll = mixed % totalCards;

  // Walk cumulative buckets to find which chain type was rolled.
  let cumulative = 0;
  for (const ct of candidates) {
    cumulative += composition.get(ct) ?? 0;
    if (roll < cumulative) {
      _activeChainColor = ct;
      return ct;
    }
  }

  // Fallback: last candidate (should never reach here if totalCards > 0).
  _activeChainColor = candidates[candidates.length - 1];
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
 * Switches the active chain color mid-turn to `newChainType`.
 *
 * Called by turnManager when a player correctly Charges an off-colour card.
 * The new color becomes the surcharge-free color for the rest of the turn, and
 * `_chain.chainType` is updated so subsequent extends apply to the new color.
 * Chain **length** is deliberately preserved — answering correctly earned the pivot.
 *
 * This is a no-op when:
 * - `newChainType` is not one of the current run's chain types (invalid).
 * - `_runChainTypes` is empty (legacy/trivia mode — no rotating color system).
 *
 * Do NOT call this at turn boundaries — use `rotateActiveChainColor` for that.
 *
 * @param newChainType - The chain type index to switch to (must be a run chain type).
 */
export function switchActiveChainColor(newChainType: number): void {
  // Guard: only valid in rotation mode with a known run chain type.
  if (_runChainTypes.length === 0 || !_runChainTypes.includes(newChainType)) {
    return;
  }
  _activeChainColor = newChainType;
  // Mirror onto _chain.chainType so subsequent extendOrResetChain calls see the new
  // color as the active color and extend the chain correctly.
  // Chain length is preserved — the player earned the pivot by answering correctly.
  _chain = { ..._chain, chainType: newChainType };
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
 * 7.8: isOffColourWrong — if true, chain length is halved (floor) instead of fully reset.
 * This applies when the player charges a card off-colour and answers incorrectly,
 * turning a full chain break into a partial penalty that preserves some momentum.
 *
 * If no run chain types are configured (_runChainTypes is empty), falls back
 * to the legacy same-type-consecutive matching for backward compatibility.
 *
 * @param chainType           - The chainType (0-5) of the card just played. Undefined/null = no chain contribution.
 * @param chainMultiplierOverride - If set, the raw chain multiplier is clamped to this value.
 *   Used by The Nullifier (AR-59.13) to neutralize chain stacking.
 * @param isOffColourWrong    - If true (7.8): halve chain length instead of full reset.
 * @returns The chain multiplier that applies to this card's effect.
 */
export function extendOrResetChain(
  chainType: number | undefined | null,
  chainMultiplierOverride?: number,
  isOffColourWrong?: boolean,
): number {
  if (chainType === undefined || chainType === null) {
    if (isOffColourWrong) {
      // 7.8: Wrong off-colour charge: partial chain reset (halve, floor at 1)
      _chain = { ..._chain, length: Math.max(1, Math.floor(_chain.length * 0.5)) };
    } else {
      // Wrong on-colour charge or unchained card — full reset
      _chain = { chainType: null, length: 0 };
    }
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
