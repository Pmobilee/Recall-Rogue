/**
 * Unit tests for chessGrader.ts — chess puzzle grading service.
 *
 * Test positions used:
 *   - Starting position: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
 *   - Scholar's Mate opportunity: r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4
 *     (White Qxf7# is mate — a puzzle where the setup is opponent has left f7 hanging)
 *   - Simple fork test: using a known Lichess-style format with setup + solution moves
 */

import { describe, it, expect } from 'vitest';
import {
  setupPuzzlePosition,
  getPlayerContext,
  gradeChessMove,
  uciToSan,
  getLegalMovesForSquare,
  isInCheck,
  applyMove,
  getOpponentResponse,
} from '../chessGrader';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Scholar's Mate position: White queen on h5, bishop on c4, can play Qxf7#
const SCHOLARS_MATE_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

// A simple position for Lichess-style puzzle testing (fork setup).
// In this position it's Black's turn after White plays Nd5 (a setup for Black to find Nxe4 fork)
// We construct it from a known simple sequence.
// Starting from a stable test position where e.g. we can verify pawn moves.
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

// ---------------------------------------------------------------------------
// setupPuzzlePosition
// ---------------------------------------------------------------------------

describe('setupPuzzlePosition', () => {
  it('applies a pawn move from starting position', () => {
    const resultFen = setupPuzzlePosition(STARTING_FEN, 'e2e4');
    // After 1.e4, black to move, e4 pawn on e4
    expect(resultFen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b');
  });

  it('applies a knight move correctly', () => {
    const resultFen = setupPuzzlePosition(STARTING_FEN, 'g1f3');
    expect(resultFen).toContain('PPPPPPPP/RNBQKB1R b');
    expect(resultFen).toContain('5N2');
  });

  it('returns a valid FEN string (7 spaces = 8 fields)', () => {
    const resultFen = setupPuzzlePosition(STARTING_FEN, 'e2e4');
    const fields = resultFen.split(' ');
    expect(fields).toHaveLength(6); // FEN has 6 space-separated fields
  });

  it('throws on illegal move', () => {
    // e2e5 is illegal from starting position (pawn can only advance 1 or 2 squares)
    expect(() => setupPuzzlePosition(STARTING_FEN, 'e2e5')).toThrow();
  });

  it('throws on invalid FEN', () => {
    expect(() => setupPuzzlePosition('not-a-fen', 'e2e4')).toThrow();
  });

  it('applies a capture move correctly', () => {
    // After 1.e4 d5 2.exd5: e4 captures d5
    const afterE4D5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const resultFen = setupPuzzlePosition(afterE4D5, 'e4d5');
    expect(resultFen).toContain('3P4'); // d5 now has a white pawn
  });
});

// ---------------------------------------------------------------------------
// getPlayerContext
// ---------------------------------------------------------------------------

describe('getPlayerContext', () => {
  it('returns black orientation when white plays the setup move', () => {
    // White plays e2e4 (setup), so it becomes Black's turn → player is black
    const ctx = getPlayerContext(STARTING_FEN, ['e2e4', 'e7e5']);
    expect(ctx.orientation).toBe('black');
  });

  it('returns white orientation when black plays the setup move', () => {
    // Black plays e7e5 (setup) from after-e4 position, so it becomes White's turn
    const ctx = getPlayerContext(AFTER_E4_FEN, ['e7e5', 'd2d4']);
    expect(ctx.orientation).toBe('white');
  });

  it('returns the correct solutionUCI', () => {
    const ctx = getPlayerContext(STARTING_FEN, ['e2e4', 'e7e5']);
    expect(ctx.solutionUCI).toBe('e7e5');
  });

  it('returns the correct setupMove from/to squares', () => {
    const ctx = getPlayerContext(STARTING_FEN, ['e2e4', 'e7e5']);
    expect(ctx.setupMove.from).toBe('e2');
    expect(ctx.setupMove.to).toBe('e4');
  });

  it('returns a valid playerFen after setup move', () => {
    const ctx = getPlayerContext(STARTING_FEN, ['e2e4', 'e7e5']);
    expect(ctx.playerFen).toBe(setupPuzzlePosition(STARTING_FEN, 'e2e4'));
  });

  it('throws when solutionMoves has fewer than 2 entries', () => {
    expect(() => getPlayerContext(STARTING_FEN, ['e2e4'])).toThrow();
  });

  it('correctly identifies white to play Scholar\'s Mate lead-up', () => {
    // Before ...Nf6: Black's knight on g8 plays to f6. After that it's White's turn.
    const beforeNf6 = 'r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3'; // Black queen d8 can go to f6
    const ctx = getPlayerContext(beforeNf6, ['d8f6', 'h5f7']);
    // After Black plays Ng8-f6 it's White's turn -> orientation is white
    expect(ctx.orientation).toBe('white');
    expect(ctx.solutionUCI).toBe('h5f7');
    expect(ctx.setupMove).toEqual({ from: 'd8', to: 'f6' });
  });

  it('returns baseFen equal to the input FEN', () => {
    const ctx = getPlayerContext(STARTING_FEN, ['e2e4', 'e7e5']);
    expect(ctx.baseFen).toBe(STARTING_FEN);
  });

  it('single-move puzzle has totalPlayerMoves=1 and moveSequence of length 1', () => {
    const ctx = getPlayerContext(STARTING_FEN, ['e2e4', 'e7e5']);
    expect(ctx.totalPlayerMoves).toBe(1);
    expect(ctx.moveSequence).toHaveLength(1);
    expect(ctx.moveSequence[0].solutionUCI).toBe('e7e5');
  });
});

// ---------------------------------------------------------------------------
// gradeChessMove
// ---------------------------------------------------------------------------

describe('gradeChessMove', () => {
  it('returns true for an exact UCI match', () => {
    expect(gradeChessMove('e7e5', 'e7e5')).toBe(true);
  });

  it('returns false for a wrong move', () => {
    expect(gradeChessMove('e7e6', 'e7e5')).toBe(false);
  });

  it('returns false for a completely different move', () => {
    expect(gradeChessMove('d2d4', 'e2e4')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(gradeChessMove('', 'e2e4')).toBe(false);
  });

  it('is case-sensitive (UCI is always lowercase)', () => {
    expect(gradeChessMove('E2E4', 'e2e4')).toBe(false);
  });

  it('handles promotion moves correctly', () => {
    expect(gradeChessMove('e7e8q', 'e7e8q')).toBe(true);
    expect(gradeChessMove('e7e8r', 'e7e8q')).toBe(false);
  });

  it('handles scholar\'s mate solution', () => {
    // Qxf7# in UCI is h5f7
    expect(gradeChessMove('h5f7', 'h5f7')).toBe(true);
    expect(gradeChessMove('h5e5', 'h5f7')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// uciToSan
// ---------------------------------------------------------------------------

describe('uciToSan', () => {
  it('converts pawn advance to SAN', () => {
    expect(uciToSan(STARTING_FEN, 'e2e4')).toBe('e4');
  });

  it('converts knight development to SAN', () => {
    expect(uciToSan(STARTING_FEN, 'g1f3')).toBe('Nf3');
  });

  it('converts capture to SAN (includes x)', () => {
    // After 1.e4 d5, white can capture exd5
    const afterE4D5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(uciToSan(afterE4D5, 'e4d5')).toBe('exd5');
  });

  it('converts Scholar\'s Mate (Qxf7#) to SAN', () => {
    expect(uciToSan(SCHOLARS_MATE_FEN, 'h5f7')).toBe('Qxf7#');
  });

  it('converts kingside castling to O-O', () => {
    // Position where white can castle kingside
    // Pieces cleared: king on e1, rook on h1
    const castleFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 6 4';
    expect(uciToSan(castleFen, 'e1g1')).toBe('O-O');
  });

  it('returns raw UCI string if move is illegal in given position', () => {
    // e2e5 is illegal from starting position
    expect(uciToSan(STARTING_FEN, 'e2e5')).toBe('e2e5');
  });

  it('converts pawn promotion to SAN', () => {
    // White pawn on e7 can promote
    const promotionFen = '8/4P3/8/8/8/8/8/4K1k1 w - - 0 1';
    const san = uciToSan(promotionFen, 'e7e8q');
    expect(san).toBe('e8=Q');
  });
});

// ---------------------------------------------------------------------------
// getLegalMovesForSquare
// ---------------------------------------------------------------------------

describe('getLegalMovesForSquare', () => {
  it('returns two pawn moves from starting position e2', () => {
    const moves = getLegalMovesForSquare(STARTING_FEN, 'e2');
    expect(moves).toContain('e2e3');
    expect(moves).toContain('e2e4');
    expect(moves).toHaveLength(2);
  });

  it('returns two knight moves from g1 in starting position', () => {
    const moves = getLegalMovesForSquare(STARTING_FEN, 'g1');
    expect(moves).toContain('g1f3');
    expect(moves).toContain('g1h3');
    expect(moves).toHaveLength(2);
  });

  it('returns empty array for an empty square', () => {
    // e4 is empty in starting position
    const moves = getLegalMovesForSquare(STARTING_FEN, 'e4');
    expect(moves).toHaveLength(0);
  });

  it('returns empty array for opponent\'s piece (can\'t move opponent pieces)', () => {
    // e7 has a black pawn, but it's white's turn in STARTING_FEN
    const moves = getLegalMovesForSquare(STARTING_FEN, 'e7');
    expect(moves).toHaveLength(0);
  });

  it('returns UCI strings in correct format (4 or 5 chars)', () => {
    const moves = getLegalMovesForSquare(STARTING_FEN, 'e2');
    for (const m of moves) {
      expect(m.length).toBeGreaterThanOrEqual(4);
      expect(m.length).toBeLessThanOrEqual(5);
    }
  });

  it('returns empty array on invalid FEN', () => {
    const moves = getLegalMovesForSquare('invalid-fen', 'e2');
    expect(moves).toHaveLength(0);
  });

  it('returns all legal queen moves from Scholar\'s Mate position', () => {
    // White queen on h5 should have many moves
    const moves = getLegalMovesForSquare(SCHOLARS_MATE_FEN, 'h5');
    expect(moves.length).toBeGreaterThan(0);
    // The winning move Qxf7# should be among them
    expect(moves).toContain('h5f7');
  });
});

// ---------------------------------------------------------------------------
// isInCheck
// ---------------------------------------------------------------------------

describe('isInCheck', () => {
  it('returns false for starting position (no check)', () => {
    expect(isInCheck(STARTING_FEN)).toBe(false);
  });

  it('returns true for a position in check', () => {
    // Scholar's Mate after Qxf7+: black king is in check
    // Apply Qxf7+ from SCHOLARS_MATE_FEN
    const afterQf7 = setupPuzzlePosition(SCHOLARS_MATE_FEN, 'h5f7');
    // This is checkmate, which also means the active side is in check
    expect(isInCheck(afterQf7)).toBe(true);
  });

  it('returns false for normal middlegame position (no check)', () => {
    // After 1.e4 e5, no check
    const afterE4E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(isInCheck(afterE4E5)).toBe(false);
  });

  it('returns false for invalid FEN', () => {
    expect(isInCheck('not-a-fen')).toBe(false);
  });

  it('detects check in a direct check position', () => {
    // Black king on a8, white queen on b7 — queen diagonally checks king on a8
    const checkFen = 'k7/1Q6/8/8/8/8/8/K7 b - - 0 1';
    expect(isInCheck(checkFen)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// multi-move puzzles
// ---------------------------------------------------------------------------

describe('multi-move puzzles', () => {
  it('getPlayerContext with 4-move puzzle returns 2 player moves', () => {
    // Setup: e2e4 (setup), Player1: d7d5, Opponent1: e4d5 (capture), Player2: d8d5 (recapture)
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5'];
    const ctx = getPlayerContext(STARTING_FEN, moves);
    expect(ctx.totalPlayerMoves).toBe(2);
    expect(ctx.moveSequence).toHaveLength(2);
    expect(ctx.moveSequence[0].solutionUCI).toBe('d7d5');
    expect(ctx.moveSequence[1].solutionUCI).toBe('d8d5');
    expect(ctx.baseFen).toBe(STARTING_FEN);
  });

  it('getPlayerContext with 4-move puzzle has correct FEN for second player move', () => {
    // After e2e4 (setup), d7d5 (player1), e4d5 (opp1), the board should show d5 pawn captured
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5'];
    const ctx = getPlayerContext(STARTING_FEN, moves);

    // First player move FEN = after e4 is played
    expect(ctx.moveSequence[0].fen).toBe(setupPuzzlePosition(STARTING_FEN, 'e2e4'));

    // Second player move FEN = after e4, d5, exd5 — position where queen captures
    const fenAfterSetup = setupPuzzlePosition(STARTING_FEN, 'e2e4');
    const fenAfterD5 = setupPuzzlePosition(fenAfterSetup, 'd7d5');
    const fenAfterExd5 = setupPuzzlePosition(fenAfterD5, 'e4d5');
    expect(ctx.moveSequence[1].fen).toBe(fenAfterExd5);
  });

  it('single-move puzzle still works (backward compat)', () => {
    const moves = ['e2e4', 'd7d5'];
    const ctx = getPlayerContext(STARTING_FEN, moves);
    expect(ctx.totalPlayerMoves).toBe(1);
    expect(ctx.moveSequence).toHaveLength(1);
    expect(ctx.moveSequence[0].solutionUCI).toBe('d7d5');
    expect(ctx.baseFen).toBe(STARTING_FEN);
  });

  it('6-move puzzle returns 3 player moves', () => {
    // Sequence: setup, p1, opp1, p2, opp2, p3
    // Using simple legal pawn/queen moves from a known position
    // Start: e2e4 (setup), then d7d5, e4d5, d8d5, d2d4, d5d4 — 3 player moves
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'd2d4', 'd5d4'];
    const ctx = getPlayerContext(STARTING_FEN, moves);
    expect(ctx.totalPlayerMoves).toBe(3);
    expect(ctx.moveSequence).toHaveLength(3);
    expect(ctx.moveSequence[0].solutionUCI).toBe('d7d5');
    expect(ctx.moveSequence[1].solutionUCI).toBe('d8d5');
    expect(ctx.moveSequence[2].solutionUCI).toBe('d5d4');
  });

  it('applyMove returns correct FEN after a pawn move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const newFen = applyMove(fen, 'd7d5');
    // d5 square should now have a black pawn
    expect(newFen).toContain('3p4');
  });

  it('applyMove throws on an illegal move', () => {
    // d7d5 is Black's move, but STARTING_FEN is White to move
    expect(() => applyMove(STARTING_FEN, 'd7d5')).toThrow();
  });

  it('getOpponentResponse returns correct move at index 0', () => {
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5'];
    expect(getOpponentResponse(moves, 0)).toBe('e4d5');
  });

  it('getOpponentResponse returns null after last player move', () => {
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5'];
    // playerMoveIndex=1 → oppIndex=4, but moves only has 4 entries (indices 0-3)
    expect(getOpponentResponse(moves, 1)).toBeNull();
  });

  it('getOpponentResponse for 6-move puzzle', () => {
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'd2d4', 'd5d4'];
    expect(getOpponentResponse(moves, 0)).toBe('e4d5');  // opp response to player move 1
    expect(getOpponentResponse(moves, 1)).toBe('d2d4');  // opp response to player move 2
    expect(getOpponentResponse(moves, 2)).toBeNull();    // no response after player move 3 (last)
  });
});

// ---------------------------------------------------------------------------
// Edge cases: promotion grading strictness
// ---------------------------------------------------------------------------

describe('gradeChessMove — promotion edge cases', () => {
  it('returns false when player omits promotion piece (e7e8 vs e7e8q)', () => {
    // Phase 1 is a strict UCI match: "e7e8" (4 chars) does not equal "e7e8q" (5 chars)
    expect(gradeChessMove('e7e8', 'e7e8q')).toBe(false);
  });

  it('returns false when player promotes to wrong piece (e7e8r vs e7e8q)', () => {
    expect(gradeChessMove('e7e8r', 'e7e8q')).toBe(false);
  });

  it('returns false when player promotes to bishop instead of queen (e7e8b vs e7e8q)', () => {
    expect(gradeChessMove('e7e8b', 'e7e8q')).toBe(false);
  });

  it('returns true for exact promotion match (e7e8q vs e7e8q)', () => {
    expect(gradeChessMove('e7e8q', 'e7e8q')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPlayerContext — 4-move puzzle matching real deck structure
// ---------------------------------------------------------------------------

describe('getPlayerContext — 4-move puzzle matching real deck structure', () => {
  // Simulates a real Lichess-style 4-move puzzle (2 player moves).
  // The structure matches puzzles in chess-puzzles.db where the opponent plays
  // a setup move and the player must find two consecutive correct responses.
  // Using Italian Game opening moves as a known-legal 4-move sequence.
  //
  // solutionMoves[0]: e2e4  — white setup (creates the position)
  // solutionMoves[1]: e7e5  — player (black) first response
  // solutionMoves[2]: g1f3  — opponent (white) response
  // solutionMoves[3]: b8c6  — player (black) second move
  const FOUR_MOVE_PUZZLE = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];

  it('returns totalPlayerMoves === 2', () => {
    const ctx = getPlayerContext(STARTING_FEN, FOUR_MOVE_PUZZLE);
    expect(ctx.totalPlayerMoves).toBe(2);
  });

  it('returns moveSequence of length 2', () => {
    const ctx = getPlayerContext(STARTING_FEN, FOUR_MOVE_PUZZLE);
    expect(ctx.moveSequence).toHaveLength(2);
  });

  it('has correct player move at moveSequence[0]', () => {
    const ctx = getPlayerContext(STARTING_FEN, FOUR_MOVE_PUZZLE);
    expect(ctx.moveSequence[0].solutionUCI).toBe('e7e5');
  });

  it('has correct player move at moveSequence[1]', () => {
    const ctx = getPlayerContext(STARTING_FEN, FOUR_MOVE_PUZZLE);
    expect(ctx.moveSequence[1].solutionUCI).toBe('b8c6');
  });
});

// ---------------------------------------------------------------------------
// getPlayerContext — 10-move puzzle (5 player moves)
// ---------------------------------------------------------------------------

describe('getPlayerContext — 10-move puzzle (5 player moves)', () => {
  // 10-element solutionMoves array: 1 setup + 4 opponent responses + 5 player moves = 10 total
  // Layout: [setup, p1, o1, p2, o2, p3, o3, p4, o4, p5]
  // Using an Italian Game / Giuoco Piano opening sequence — all legal consecutive moves.
  //
  // solutionMoves[0]: e2e4  — white setup
  // solutionMoves[1]: e7e5  — player (black) move 1
  // solutionMoves[2]: g1f3  — opponent (white) response 1
  // solutionMoves[3]: b8c6  — player (black) move 2
  // solutionMoves[4]: f1c4  — opponent (white) response 2
  // solutionMoves[5]: g8f6  — player (black) move 3
  // solutionMoves[6]: b1c3  — opponent (white) response 3
  // solutionMoves[7]: f8c5  — player (black) move 4
  // solutionMoves[8]: d2d3  — opponent (white) response 4
  // solutionMoves[9]: d7d6  — player (black) move 5
  const TEN_MOVE_SEQUENCE = [
    'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4',
    'g8f6', 'b1c3', 'f8c5', 'd2d3', 'd7d6',
  ];

  it('returns totalPlayerMoves === 5', () => {
    const ctx = getPlayerContext(STARTING_FEN, TEN_MOVE_SEQUENCE);
    expect(ctx.totalPlayerMoves).toBe(5);
  });

  it('returns moveSequence of length 5', () => {
    const ctx = getPlayerContext(STARTING_FEN, TEN_MOVE_SEQUENCE);
    expect(ctx.moveSequence).toHaveLength(5);
  });

  it('has correct solution UCI at each step', () => {
    const ctx = getPlayerContext(STARTING_FEN, TEN_MOVE_SEQUENCE);
    expect(ctx.moveSequence[0].solutionUCI).toBe('e7e5');
    expect(ctx.moveSequence[1].solutionUCI).toBe('b8c6');
    expect(ctx.moveSequence[2].solutionUCI).toBe('g8f6');
    expect(ctx.moveSequence[3].solutionUCI).toBe('f8c5');
    expect(ctx.moveSequence[4].solutionUCI).toBe('d7d6');
  });

  it('preserves baseFen through the full sequence', () => {
    const ctx = getPlayerContext(STARTING_FEN, TEN_MOVE_SEQUENCE);
    expect(ctx.baseFen).toBe(STARTING_FEN);
  });
});

// ---------------------------------------------------------------------------
// getOpponentResponse — boundary conditions with specific 4-move index mapping
// ---------------------------------------------------------------------------

describe('getOpponentResponse — boundary conditions', () => {
  // For solutionMoves of length 4 (['a1a2', 'b1b2', 'c1c2', 'd1d2']):
  //   oppIndex for playerMoveIndex=0 → 2 + 0*2 = 2 → solutionMoves[2] = 'c1c2'
  //   oppIndex for playerMoveIndex=1 → 2 + 1*2 = 4 → index 4 >= length 4 → null
  const FOUR_MOVES = ['a1a2', 'b1b2', 'c1c2', 'd1d2'];

  it('returns solutionMoves[2] ("c1c2") when playerMoveIndex=0', () => {
    expect(getOpponentResponse(FOUR_MOVES, 0)).toBe('c1c2');
  });

  it('returns null when playerMoveIndex=1 (index 4 is out of bounds for 4-element array)', () => {
    expect(getOpponentResponse(FOUR_MOVES, 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// uciToSan — castling via standard chess position with full castling rights
// ---------------------------------------------------------------------------

describe('uciToSan — castling', () => {
  // FEN with clear paths and full castling rights: kings and rooks in starting positions
  // r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1
  const CASTLING_FEN = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';

  it('converts kingside castling e1g1 to O-O', () => {
    expect(uciToSan(CASTLING_FEN, 'e1g1')).toBe('O-O');
  });

  it('converts queenside castling e1c1 to O-O-O', () => {
    expect(uciToSan(CASTLING_FEN, 'e1c1')).toBe('O-O-O');
  });
});

// ---------------------------------------------------------------------------
// applyMove — pawn promotion
// ---------------------------------------------------------------------------

describe('applyMove — pawn promotion', () => {
  // White pawn on e7, kings away from promotion square.
  // FEN: 7k/4P3/8/8/8/8/8/4K3 w - - 0 1
  // White king e1, black king h8, white pawn e7.
  const PROMOTION_FEN = '7k/4P3/8/8/8/8/8/4K3 w - - 0 1';

  it('applyMove with queen promotion places queen on e8', () => {
    const resultFen = applyMove(PROMOTION_FEN, 'e7e8q');
    // FEN board part: rank 8 is the first segment before the first '/'
    const rank8 = resultFen.split(' ')[0].split('/')[0];
    // Rank 8 should contain a white queen ('Q') where the pawn promoted
    expect(rank8).toContain('Q');
  });

  it('applyMove with rook promotion places rook on e8', () => {
    const resultFen = applyMove(PROMOTION_FEN, 'e7e8r');
    const rank8 = resultFen.split(' ')[0].split('/')[0];
    expect(rank8).toContain('R');
  });

  it('applyMove with knight promotion places knight on e8', () => {
    const resultFen = applyMove(PROMOTION_FEN, 'e7e8n');
    const rank8 = resultFen.split(' ')[0].split('/')[0];
    expect(rank8).toContain('N');
  });

  it('applyMove pawn no longer on e7 after promotion', () => {
    const resultFen = applyMove(PROMOTION_FEN, 'e7e8q');
    // rank 7 is the second segment (index 1) of the FEN board part
    const rank7 = resultFen.split(' ')[0].split('/')[1];
    // e7 was the only pawn; rank 7 should now be all empty (8 empty squares)
    expect(rank7).toBe('8');
  });

  it('applyMove promotion changes the active side to black', () => {
    const resultFen = applyMove(PROMOTION_FEN, 'e7e8q');
    // After white moves, it is black's turn
    const activeColor = resultFen.split(' ')[1];
    expect(activeColor).toBe('b');
  });
});
