/**
 * Chess puzzle grading service for the chess_tactic quiz mode.
 *
 * Wraps chess.js to handle FEN parsing, UCI move application, SAN conversion,
 * legal move enumeration, and puzzle grading. All functions are pure — no state,
 * no side effects, no Phaser imports.
 *
 * Lichess puzzle format:
 *   solutionMoves[0] = opponent's last move (setup) — applied to base FEN to reach puzzle position
 *   solutionMoves[1] = player's correct response in UCI notation
 */

import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerContext {
  /** FEN after the opponent's setup move — this is what the player sees on the board. */
  playerFen: string;
  /** The player's correct response in UCI notation (e.g. "f3f7"). */
  solutionUCI: string;
  /** Which color the player controls. */
  orientation: 'white' | 'black';
  /** The from/to squares of the opponent's setup move, for highlighting. */
  setupMove: { from: string; to: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a UCI move string into { from, to, promotion? }.
 * UCI format: fromSquare + toSquare + optional promotion piece.
 * Examples: "e2e4", "e7e8q", "g1f3"
 */
function parseUCI(uci: string): { from: string; to: string; promotion?: string } {
  if (uci.length < 4) throw new Error(`Invalid UCI move: "${uci}"`);
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply the opponent's setup move to a base FEN, returning the resulting position.
 * This is the position the player will see on the board.
 *
 * @param baseFen  The FEN before the setup move is played.
 * @param setupMoveUCI  The opponent's move in UCI notation (e.g. "e2e4").
 * @returns The FEN after the setup move has been applied.
 * @throws If the FEN is invalid or the move is illegal.
 */
export function setupPuzzlePosition(baseFen: string, setupMoveUCI: string): string {
  const chess = new Chess(baseFen);
  const { from, to, promotion } = parseUCI(setupMoveUCI);
  const result = chess.move({ from, to, promotion });
  if (!result) {
    throw new Error(`Illegal setup move "${setupMoveUCI}" in position "${baseFen}"`);
  }
  return chess.fen();
}

/**
 * Get the full player context from a Lichess puzzle.
 *
 * Lichess format:
 *   solutionMoves[0] = opponent's last move (the "setup" move that creates the tactic)
 *   solutionMoves[1] = the player's correct response
 *
 * @param baseFen  The FEN before the opponent's setup move.
 * @param solutionMoves  Array of UCI moves. Index 0 = setup, index 1 = player solution.
 * @returns Full context for rendering the puzzle.
 */
export function getPlayerContext(baseFen: string, solutionMoves: string[]): PlayerContext {
  if (solutionMoves.length < 2) {
    throw new Error(`solutionMoves must have at least 2 entries, got ${solutionMoves.length}`);
  }

  const setupUCI = solutionMoves[0];
  const solutionUCI = solutionMoves[1];

  const playerFen = setupPuzzlePosition(baseFen, setupUCI);
  const chess = new Chess(playerFen);

  // After the setup move, it's the player's turn. Determine their color from active side.
  const orientation = chess.turn() === 'w' ? 'white' : 'black';

  const { from, to } = parseUCI(setupUCI);
  const setupMove = { from, to };

  return { playerFen, solutionUCI, orientation, setupMove };
}

/**
 * Grade a player's chess move against the solution.
 *
 * Phase 1 implementation: exact UCI string match.
 * Future phases may add equivalence checks for promotions and SAN normalization.
 *
 * @param playerMoveUCI  The move the player submitted, in UCI notation.
 * @param solutionMoveUCI  The correct solution move in UCI notation.
 * @returns true if the move matches the solution.
 */
export function gradeChessMove(playerMoveUCI: string, solutionMoveUCI: string): boolean {
  return playerMoveUCI === solutionMoveUCI;
}

/**
 * Convert a UCI move to Standard Algebraic Notation (SAN) for display.
 *
 * Used in UI to show the correct answer after a quiz resolves.
 * E.g. "e2e4" → "e4", "g1f3" → "Nf3", "e1g1" → "O-O"
 *
 * @param fen  The position before the move.
 * @param uci  The move in UCI notation.
 * @returns The SAN string, or the raw UCI string if conversion fails.
 */
export function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const { from, to, promotion } = parseUCI(uci);
    const result = chess.move({ from, to, promotion });
    if (!result) return uci;
    return result.san;
  } catch {
    return uci;
  }
}

/**
 * Get all legal moves for a piece on a given square.
 *
 * Used by the ChessBoard component to highlight valid destination squares
 * when the player clicks a piece.
 *
 * @param fen  The current board position.
 * @param square  The square to query (e.g. "e2").
 * @returns Array of UCI move strings from this square (e.g. ["e2e3", "e2e4"]).
 */
export function getLegalMovesForSquare(fen: string, square: string): string[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ square: square as Square, verbose: true });
    return moves.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
  } catch {
    return [];
  }
}

/**
 * Check if the active side is currently in check.
 *
 * Used to provide visual feedback on the board (highlighting the king in check).
 *
 * @param fen  The position to inspect.
 * @returns true if the side to move is in check.
 */
export function isInCheck(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.isCheck();
  } catch {
    return false;
  }
}
