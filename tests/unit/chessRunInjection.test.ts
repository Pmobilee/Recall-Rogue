/**
 * Unit tests for chessRunInjection.ts
 *
 * Tests the injectChessPuzzlesForDeck() helper that wires
 * public/chess-puzzles.db into chess_tactics runs at run start.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---- mocks ---------------------------------------------------------------
// Must be hoisted before imports so vi.mock() intercepts the module.

vi.mock('../../src/data/curatedDeckStore', () => ({
  refreshChessTacticsFacts: vi.fn(),
  isChessPuzzleDbReady: vi.fn(),
}));

vi.mock('../../src/services/chessEloService', () => ({
  getChessElo: vi.fn(),
}));

// ---- imports -------------------------------------------------------------
import {
  injectChessPuzzlesForDeck,
  CHESS_TACTICS_DECK_ID,
  CHESS_INJECTION_COUNT,
} from '../../src/services/chessRunInjection';
import { refreshChessTacticsFacts, isChessPuzzleDbReady } from '../../src/data/curatedDeckStore';
import { getChessElo } from '../../src/services/chessEloService';

// ---- helpers -------------------------------------------------------------
const mockRefresh = vi.mocked(refreshChessTacticsFacts);
const mockIsReady = vi.mocked(isChessPuzzleDbReady);
const mockGetElo = vi.mocked(getChessElo);

beforeEach(() => {
  vi.clearAllMocks();
});

// --------------------------------------------------------------------------
describe('injectChessPuzzlesForDeck', () => {
  // ── non-chess deck ──────────────────────────────────────────────────────
  it('returns 0 and does not call refresh for a non-chess deckId', async () => {
    const result = await injectChessPuzzlesForDeck('history_world');
    expect(result).toBe(0);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('returns 0 and does not call refresh for undefined deckId', async () => {
    const result = await injectChessPuzzlesForDeck(undefined);
    expect(result).toBe(0);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // ── DB not ready ────────────────────────────────────────────────────────
  it('returns 0 and does not call refresh when chess-puzzles.db is not ready', async () => {
    mockIsReady.mockReturnValue(false);

    const result = await injectChessPuzzlesForDeck(CHESS_TACTICS_DECK_ID);
    expect(result).toBe(0);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // ── happy path ──────────────────────────────────────────────────────────
  it('calls refreshChessTacticsFacts with player Elo and CHESS_INJECTION_COUNT when DB is ready', async () => {
    mockIsReady.mockReturnValue(true);
    mockGetElo.mockReturnValue(1500);
    mockRefresh.mockResolvedValue(30);

    const result = await injectChessPuzzlesForDeck(CHESS_TACTICS_DECK_ID);

    expect(result).toBe(30);
    expect(mockRefresh).toHaveBeenCalledOnce();
    expect(mockRefresh).toHaveBeenCalledWith({
      targetRating: 1500,
      count: CHESS_INJECTION_COUNT,
    });
  });

  it('returns the count returned by refreshChessTacticsFacts', async () => {
    mockIsReady.mockReturnValue(true);
    mockGetElo.mockReturnValue(900);
    mockRefresh.mockResolvedValue(28);

    const result = await injectChessPuzzlesForDeck(CHESS_TACTICS_DECK_ID);
    expect(result).toBe(28);
  });

  // ── rejection / fallback ────────────────────────────────────────────────
  it('returns 0 and does not throw when refreshChessTacticsFacts rejects', async () => {
    mockIsReady.mockReturnValue(true);
    mockGetElo.mockReturnValue(1200);
    mockRefresh.mockRejectedValue(new Error('DB query failed'));

    // Should not throw
    await expect(injectChessPuzzlesForDeck(CHESS_TACTICS_DECK_ID)).resolves.toBe(0);
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  // ── constant sanity ─────────────────────────────────────────────────────
  it('exports CHESS_TACTICS_DECK_ID matching chess_tactics string', () => {
    expect(CHESS_TACTICS_DECK_ID).toBe('chess_tactics');
  });

  it('exports CHESS_INJECTION_COUNT of 30', () => {
    expect(CHESS_INJECTION_COUNT).toBe(30);
  });
});
