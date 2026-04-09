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
 *   solutionMoves[2] = opponent's response (for multi-move puzzles)
 *   solutionMoves[3] = player's second move (for 4-move puzzles)
 *   ... and so on: player moves at odd indices, opponent responses at even indices ≥2
 */

import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerContext {
  /** FEN after the opponent's setup move — this is what the player sees on the board. */
  playerFen: string;
  /** The player's correct response in UCI notation (e.g. "f3f7"). For multi-move puzzles this is the first player move. */
  solutionUCI: string;
  /** Which color the player controls. */
  orientation: 'white' | 'black';
  /** The from/to squares of the opponent's setup move, for highlighting. */
  setupMove: { from: string; to: string };
  /** The original FEN before the setup move (for setup animation). */
  baseFen: string;
  /** Total number of player moves in this puzzle (1 for 2-move, 2 for 4-move, etc.). */
  totalPlayerMoves: number;
  /**
   * Per-player-move contexts. Index 0 = first player move, index 1 = second, etc.
   * Each entry contains the FEN the player sees at that step and the expected solution UCI.
   */
  moveSequence: Array<{ fen: string; solutionUCI: string }>;
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
 *   solutionMoves[1] = the player's correct first response
 *   solutionMoves[2] = opponent's response (multi-move puzzles only)
 *   solutionMoves[3] = the player's second move (multi-move puzzles only)
 *   ... player moves at odd indices, opponent responses at even indices ≥ 2
 *
 * For single-move puzzles (2 entries), totalPlayerMoves = 1 and moveSequence has 1 entry.
 * For 4-move puzzles (4 entries), totalPlayerMoves = 2 and moveSequence has 2 entries.
 *
 * @param baseFen  The FEN before the opponent's setup move.
 * @param solutionMoves  Array of UCI moves. Index 0 = setup, index 1+ = alternating player/opponent.
 * @returns Full context for rendering the puzzle, including multi-move sequence.
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

  // Build the full move sequence for multi-move puzzles.
  // solutionMoves layout: [setup, playerMove1, opponentResponse1, playerMove2, opponentResponse2, ...]
  // Player moves are at odd indices (1, 3, 5, ...).
  // Opponent responses are at even indices ≥ 2 (2, 4, 6, ...).
  const moveSequence: Array<{ fen: string; solutionUCI: string }> = [];
  let currentFen = playerFen;

  for (let i = 1; i < solutionMoves.length; i += 2) {
    const playerMoveUCI = solutionMoves[i];
    moveSequence.push({ fen: currentFen, solutionUCI: playerMoveUCI });

    // Apply the player's move, then the opponent's response (if any), to advance the FEN.
    const chessStep = new Chess(currentFen);
    const pm = parseUCI(playerMoveUCI);
    chessStep.move({ from: pm.from, to: pm.to, promotion: pm.promotion });

    if (i + 1 < solutionMoves.length) {
      const oppMoveUCI = solutionMoves[i + 1];
      const opm = parseUCI(oppMoveUCI);
      chessStep.move({ from: opm.from, to: opm.to, promotion: opm.promotion });
    }

    currentFen = chessStep.fen();
  }

  const totalPlayerMoves = moveSequence.length;

  return { playerFen, solutionUCI, orientation, setupMove, baseFen, totalPlayerMoves, moveSequence };
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

/**
 * Apply a player's move to a position and return the resulting FEN.
 * Used by the UI to update the board after a correct move in a multi-move puzzle.
 *
 * @param fen  The position before the move.
 * @param moveUCI  The move to apply in UCI notation (e.g. "e2e4").
 * @returns The FEN after the move has been applied.
 * @throws If the move is illegal in the given position.
 */
export function applyMove(fen: string, moveUCI: string): string {
  const chess = new Chess(fen);
  const { from, to, promotion } = parseUCI(moveUCI);
  const result = chess.move({ from, to, promotion });
  if (!result) {
    throw new Error(`Illegal move "${moveUCI}" in position "${fen}"`);
  }
  return chess.fen();
}

/**
 * Get the opponent's response move for a given step in a multi-move puzzle.
 * Returns null if there is no opponent response (i.e. the player's last move ends the puzzle).
 *
 * @param solutionMoves  Full solutionMoves array from the puzzle (Lichess format).
 * @param playerMoveIndex  0-based index of the player move (0 = first player move, 1 = second, etc.).
 * @returns The opponent response UCI string, or null if there is none.
 *
 * @example
 * // For moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5']:
 * getOpponentResponse(moves, 0) // → 'e4d5' (response to first player move d7d5)
 * getOpponentResponse(moves, 1) // → null (no response after last player move d8d5)
 */
export function getOpponentResponse(solutionMoves: string[], playerMoveIndex: number): string | null {
  // Layout: setup=0, player1=1, opp1=2, player2=3, opp2=4, ...
  // Opponent response for player move at index i is at solutionMoves[2 + (i * 2)].
  const oppIndex = 2 + playerMoveIndex * 2;
  return oppIndex < solutionMoves.length ? solutionMoves[oppIndex] : null;
}
