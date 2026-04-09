/**
 * Chess Elo Rating Service
 *
 * Tracks the player's chess tactics rating using standard Elo formula.
 * Each puzzle has a Lichess rating. After solving (or failing), the player's
 * rating is updated based on the expected vs actual outcome.
 *
 * Elo formula:
 *   expectedScore = 1 / (1 + 10^((puzzleRating - playerRating) / 400))
 *   newRating = oldRating + K * (actualScore - expectedScore)
 *   where actualScore = 1 for correct, 0 for wrong
 *   K-factor = 32 (standard for developing players)
 */

import { get } from 'svelte/store';
import { playerSave } from '../ui/stores/playerData';

/** Starting Elo for new players. */
export const CHESS_ELO_START = 1000;

/** K-factor: how much each puzzle affects rating. 32 = aggressive learning. */
export const CHESS_ELO_K_FACTOR = 32;

/** Minimum Elo floor (can't go below this). */
export const CHESS_ELO_MIN = 400;

/** Maximum Elo ceiling. */
export const CHESS_ELO_MAX = 3200;

/**
 * Calculate the expected score (probability of solving) for a player vs a puzzle.
 * Returns value between 0 and 1.
 */
export function expectedScore(playerRating: number, puzzleRating: number): number {
  return 1 / (1 + Math.pow(10, (puzzleRating - playerRating) / 400));
}

/**
 * Calculate the new Elo rating after a puzzle attempt.
 * Returns the new rating (clamped to [CHESS_ELO_MIN, CHESS_ELO_MAX]).
 */
export function calculateNewRating(
  playerRating: number,
  puzzleRating: number,
  correct: boolean,
): { newRating: number; ratingChange: number } {
  const expected = expectedScore(playerRating, puzzleRating);
  const actual = correct ? 1 : 0;
  const change = Math.round(CHESS_ELO_K_FACTOR * (actual - expected));
  const newRating = Math.max(CHESS_ELO_MIN, Math.min(CHESS_ELO_MAX, playerRating + change));
  return { newRating, ratingChange: newRating - playerRating };
}

/**
 * Get the player's current chess Elo rating from the save.
 */
export function getChessElo(): number {
  const save = get(playerSave);
  return save?.chessEloRating ?? CHESS_ELO_START;
}

/**
 * Update the player's chess Elo after a puzzle attempt.
 * Persists to PlayerSave.
 */
export function updateChessElo(
  puzzleRating: number,
  correct: boolean,
): { newRating: number; ratingChange: number; oldRating: number } {
  const oldRating = getChessElo();
  const { newRating, ratingChange } = calculateNewRating(oldRating, puzzleRating, correct);

  // Update the save
  playerSave.update((save) => {
    if (!save) return save;
    return {
      ...save,
      chessEloRating: newRating,
      chessEloHistory: [
        ...(save.chessEloHistory ?? []).slice(-99), // keep last 100 entries
        { rating: newRating, puzzleRating, correct, timestamp: Date.now() },
      ],
    };
  });

  return { newRating, ratingChange, oldRating };
}

/**
 * Get the Elo rating label for display.
 */
export function getEloLabel(rating: number): string {
  if (rating < 800) return 'Novice';
  if (rating < 1000) return 'Beginner';
  if (rating < 1200) return 'Intermediate';
  if (rating < 1400) return 'Advanced';
  if (rating < 1600) return 'Expert';
  if (rating < 1800) return 'Master';
  if (rating < 2000) return 'Grandmaster';
  return 'Super GM';
}

/**
 * Select puzzles appropriate for the player's current rating.
 * Returns puzzles sorted by proximity to player rating.
 * Prefers puzzles within ±200 of player rating (optimal learning zone).
 */
export function filterPuzzlesByElo<T extends { lichessRating?: number; id: string }>(
  puzzles: T[],
  playerRating: number,
  targetCount: number = 20,
): T[] {
  // Sort by distance from player rating
  const sorted = [...puzzles]
    .filter((p) => p.lichessRating != null)
    .sort((a, b) => {
      const distA = Math.abs((a.lichessRating ?? 1000) - playerRating);
      const distB = Math.abs((b.lichessRating ?? 1000) - playerRating);
      return distA - distB;
    });
  return sorted.slice(0, targetCount);
}
