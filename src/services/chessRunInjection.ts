/**
 * chessRunInjection.ts
 *
 * Thin helper that replaces the `chess_tactics` baked 298-fact fallback deck
 * with live Elo-targeted puzzles from `public/chess-puzzles.db` at run start.
 *
 * Extracted as a standalone module so it can be unit-tested without spinning
 * up the full gameFlowController dependency tree.
 *
 * Callers:
 *   - gameFlowController.ts — before initRunRng(), after runDeckId is set
 *   - (future) Study Temple entry when deckId === 'chess_tactics'
 */

import { refreshChessTacticsFacts, isChessPuzzleDbReady } from '../data/curatedDeckStore';
import { getChessElo } from './chessEloService';

/** The deck ID that triggers live puzzle injection. */
export const CHESS_TACTICS_DECK_ID = 'chess_tactics';

/** Number of live puzzles to inject per run (enough for a full run with variety). */
export const CHESS_INJECTION_COUNT = 30;

/**
 * Attempt to replace the baked `chess_tactics` deck with live Elo-targeted
 * puzzles from `public/chess-puzzles.db`.
 *
 * Safe to call for any deck — silently no-ops unless `deckId === 'chess_tactics'`.
 *
 * Returns the number of puzzles injected, or 0 if the deck is not chess, the
 * DB is not ready, or injection fails.
 */
export async function injectChessPuzzlesForDeck(deckId: string | undefined): Promise<number> {
  if (deckId !== CHESS_TACTICS_DECK_ID) return 0;

  if (!isChessPuzzleDbReady()) {
    console.log('[ChessInjection] chess-puzzles.db not ready — using baked fallback');
    return 0;
  }

  const targetRating = getChessElo();

  try {
    const injected = await refreshChessTacticsFacts({
      targetRating,
      count: CHESS_INJECTION_COUNT,
    });
    console.log(`[ChessInjection] Injected ${injected} live chess puzzles at Elo ${targetRating}`);
    return injected;
  } catch (err) {
    console.warn('[ChessInjection] Puzzle injection failed, using baked fallback:', err);
    return 0;
  }
}
