/**
 * Simple Elo rating system for ranked multiplayer matches.
 *
 * Uses the standard chess Elo formula:
 *   E = 1 / (1 + 10^((Rb - Ra) / 400))
 *   newRating = oldRating + K * (actualScore - E)
 *
 * K_FACTOR is fixed at 32 (same for all games, by design for this v1 implementation).
 * The existing eloMatchmakingService.ts uses K=32/16 split at 20 games; this module
 * is simpler and intentionally separate — it focuses on per-match delta computation
 * that can be applied at race/duel end without needing full match history.
 *
 * Profile persistence: if the profileService exposes a `multiplayerRating` field,
 * `applyEloResult` can be wired to it at the call site. See TODO(M19-profile-wire).
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Starting Elo for new players. */
export const DEFAULT_RATING = 1500;

/** K-factor: controls how much a single match moves the rating. */
export const K_FACTOR = 32;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Outcome of a single match from the local player's perspective. */
export type EloOutcome = 'win' | 'loss' | 'tie';

/** Result of applying an Elo update to both players. */
export interface EloResult {
  newLocal: number;
  newOpponent: number;
  localDelta: number;
  opponentDelta: number;
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Compute the expected win probability for player A given both ratings.
 *
 * Standard Elo formula: E_A = 1 / (1 + 10^((Rb - Ra) / 400))
 *
 * @param ratingA - Current rating of player A.
 * @param ratingB - Current rating of player B.
 * @returns Value in (0, 1) — 0.5 means an even match.
 */
export function expectedWinProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Compute the Elo delta for the local player after one match.
 *
 * @param localRating    - Current Elo rating of the local player.
 * @param opponentRating - Current Elo rating of the opponent.
 * @param outcome        - Match result from the local player's perspective.
 * @returns Signed integer delta (positive = rating increase, negative = decrease).
 */
export function computeEloDelta(
  localRating: number,
  opponentRating: number,
  outcome: EloOutcome,
): number {
  const actualScore = outcome === 'win' ? 1 : outcome === 'tie' ? 0.5 : 0;
  const expected = expectedWinProbability(localRating, opponentRating);
  return Math.round(K_FACTOR * (actualScore - expected));
}

/**
 * Apply an Elo result for a completed match, returning new ratings for both players.
 *
 * Ratings are floored at 0 — a player cannot go below 0.
 *
 * Note: the opponent's delta is always the mirror of the local delta at equal K-factors.
 * We compute it independently (using opponent's perspective) to be safe if K-factors
 * ever differ per player.
 *
 * @param localRating    - Local player's current rating.
 * @param opponentRating - Opponent's current rating.
 * @param outcome        - Match result from the local player's perspective.
 *                         ('win' for local → 'loss' for opponent, etc.)
 * @returns New ratings and deltas for both players.
 */
export function applyEloResult(
  localRating: number,
  opponentRating: number,
  outcome: EloOutcome,
): EloResult {
  const localDelta = computeEloDelta(localRating, opponentRating, outcome);

  // Opponent sees the mirror outcome
  const opponentOutcome: EloOutcome = outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'tie';
  const opponentDelta = computeEloDelta(opponentRating, localRating, opponentOutcome);

  const newLocal = Math.max(0, localRating + localDelta);
  const newOpponent = Math.max(0, opponentRating + opponentDelta);

  return { newLocal, newOpponent, localDelta, opponentDelta };
}

// ── Profile Integration ───────────────────────────────────────────────────────

/**
 * Read the local player's multiplayer Elo rating from the profile store.
 *
 * TODO(M19-profile-wire): PlayerProfile in profileTypes.ts does not yet have
 * a `multiplayerRating` field. When it is added, implement this function to read:
 *   profileService.getActiveProfile()?.multiplayerRating ?? DEFAULT_RATING
 *
 * Until then, returns DEFAULT_RATING as a safe fallback.
 */
export function getLocalMultiplayerRating(): number {
  // TODO(M19-profile-wire): read from profileService.getActiveProfile().multiplayerRating
  return DEFAULT_RATING;
}

/**
 * Persist the local player's new multiplayer Elo rating to the profile store.
 *
 * TODO(M19-profile-wire): PlayerProfile in profileTypes.ts does not yet have
 * a `multiplayerRating` field. When it is added, implement this function to call:
 *   profileService.updateProfile(id, { multiplayerRating: newRating })
 *
 * Until then, this is a no-op with a logged warning.
 *
 * @param _newRating - The new Elo rating to persist.
 */
export function persistLocalMultiplayerRating(_newRating: number): void {
  // TODO(M19-profile-wire): uncomment when multiplayerRating field added to PlayerProfile
  // const id = profileService.getActiveId()
  // if (id) profileService.updateProfile(id, { multiplayerRating: _newRating })
  console.debug(
    `[multiplayerElo] persistLocalMultiplayerRating: ${_newRating} — no-op until M19-profile-wire`,
  );
}
