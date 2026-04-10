/**
 * chessPuzzleService.ts
 *
 * Runtime service for loading chess puzzles from public/chess-puzzles.db (SQLite)
 * and providing Elo-targeted puzzle selection for the chess_tactics deck.
 *
 * The DB is fetched on first use, XOR-decoded (same as curated.db), and queried
 * via sql.js. All 620K+ Lichess puzzles are indexed by rating for fast range queries.
 *
 * Key behaviours:
 *   - Lazy load: DB is only fetched when getNextPuzzles() is first called
 *   - Rating targeting: queries within ±200 of target Elo, shuffled randomly
 *   - Theme filtering: optional; puzzles matching theme in their themes string
 *   - Exclusion: already-seen puzzle IDs are filtered client-side after fetch
 *   - UCI→SAN: puzzleToDeckFact() converts the solution move to SAN for display
 */

import { Chess } from 'chess.js';
import type { DeckFact } from '../data/curatedDeckTypes';
import { decodeDbBuffer } from './dbDecoder';

// ---------------------------------------------------------------------------
// sql.js lazy loader (mirrors curatedDeckStore.ts pattern)
// ---------------------------------------------------------------------------

type SqlJsStatic = typeof import('sql.js')['default'];
let _initSqlJs: SqlJsStatic | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!_initSqlJs) {
    try {
      const mod = await import('sql.js');
      _initSqlJs = mod.default;
    } catch {
      const mod = await import(/* @vite-ignore */ 'sql.js');
      _initSqlJs = mod.default;
    }
  }
  return _initSqlJs;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChessPuzzleQuery {
  /** Target Elo rating for puzzle difficulty. Queries within ±200 of this. */
  targetRating: number;
  /** Optional theme filter — matches puzzles containing this theme string. */
  theme?: string;
  /** Puzzle IDs already seen in this session, to exclude from results. */
  excludeIds?: Set<string>;
  /** Number of puzzles to return (default 10). */
  count?: number;
}

export interface ChessPuzzle {
  id: string;
  fen: string;
  /** UCI move array: [setupMove, playerMove, opponentResponse?, ...] */
  moves: string[];
  rating: number;
  themes: string[];
  gameUrl: string;
}

// ---------------------------------------------------------------------------
// Database state
// ---------------------------------------------------------------------------

/** sql.js Database instance — null until loadDatabase() completes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any | null = null;
let _loading = false;
let _loadPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lazy-load chess-puzzles.db.
 * Safe to call multiple times — subsequent calls return the existing promise.
 * Called automatically by getNextPuzzles(); explicit calls are optional.
 */
export async function loadDatabase(): Promise<void> {
  if (_db) return;           // Already loaded
  if (_loadPromise) return _loadPromise; // Already loading

  _loading = true;
  _loadPromise = _loadDatabaseInternal().finally(() => {
    _loading = false;
  });
  return _loadPromise;
}

async function _loadDatabaseInternal(): Promise<void> {
  try {
    const [initFn, resp] = await Promise.all([
      getSqlJs(),
      fetch('/chess-puzzles.db'),
    ]);

    if (!resp.ok) {
      console.warn(`[ChessPuzzleService] /chess-puzzles.db not found (${resp.status}) — chess runtime puzzles unavailable`);
      return;
    }

    const rawBuffer = await resp.arrayBuffer();
    const decodedBytes = decodeDbBuffer(rawBuffer);

    const SQL = await initFn({ locateFile: () => '/sql-wasm.wasm' });
    _db = new SQL.Database(decodedBytes);

    // Quick sanity check
    const countStmt = _db.prepare('SELECT COUNT(*) as n FROM puzzles');
    countStmt.step();
    const row = countStmt.getAsObject() as Record<string, unknown>;
    countStmt.free();
    console.log(`[ChessPuzzleService] Loaded chess-puzzles.db — ${Number(row['n']).toLocaleString()} puzzles`);
  } catch (err) {
    console.warn('[ChessPuzzleService] Failed to load chess-puzzles.db:', err);
    _loadPromise = null; // Allow retry
  }
}

/**
 * Query puzzles by Elo rating range with optional theme filter.
 * Returns up to `count` puzzles (default 10), shuffled, excluding seen IDs.
 *
 * Falls back to a wider ±400 window if fewer than `count` results found at ±200.
 */
export async function getNextPuzzles(query: ChessPuzzleQuery): Promise<ChessPuzzle[]> {
  await loadDatabase();
  if (!_db) return [];

  const {
    targetRating,
    theme,
    excludeIds = new Set<string>(),
    count = 10,
  } = query;

  // Fetch more than needed so we can filter excludeIds and still return `count`.
  const fetchMultiplier = 5;
  const fetchCount = count * fetchMultiplier + excludeIds.size;

  const results = _queryPuzzles(targetRating, 200, theme, fetchCount);

  // If we don't have enough, widen the window
  let pool = results;
  if (pool.length < count) {
    const wider = _queryPuzzles(targetRating, 400, theme, fetchCount * 2);
    // Merge, deduplicate by id
    const seen = new Set(pool.map(p => p.id));
    for (const p of wider) {
      if (!seen.has(p.id)) {
        pool.push(p);
        seen.add(p.id);
      }
    }
  }

  // Filter already-seen IDs
  const filtered = pool.filter(p => !excludeIds.has(p.id));

  // Shuffle and take count
  shuffleArray(filtered);
  return filtered.slice(0, count);
}

/**
 * Convert a ChessPuzzle to a DeckFact-shaped object for the quiz engine.
 *
 * The puzzle's fenPosition is the base FEN (before setup move).
 * solutionMoves[0] = setup move (opponent), solutionMoves[1] = player answer.
 * correctAnswer is the player's first move in SAN notation.
 */
export function puzzleToDeckFact(puzzle: ChessPuzzle, chainThemeId: number): DeckFact {
  const sanMove = _uciToSanAfterSetup(puzzle.fen, puzzle.moves);
  const colorToMove = _colorAfterSetup(puzzle.fen, puzzle.moves[0]);
  const theme = puzzle.themes[0] ?? 'tactic';

  return {
    id: `chess_rt_${puzzle.id}`,
    correctAnswer: sanMove,
    acceptableAlternatives: [sanMove.toLowerCase()],
    chainThemeId,
    answerTypePoolId: 'chess_moves',
    difficulty: _ratingToDifficulty(puzzle.rating),
    funScore: 10,
    quizQuestion: `${colorToMove} to move.`,
    explanation: `The winning move is ${sanMove}.`,
    visualDescription: `Chess puzzle — ${theme} tactic`,
    sourceName: 'Lichess CC0',
    sourceUrl: puzzle.gameUrl || undefined,
    distractors: [],
    categoryL1: 'games',
    categoryL2: 'chess_tactics',
    quizMode: 'chess_tactic',
    quizResponseMode: 'chess_move',
    fenPosition: puzzle.fen,
    solutionMoves: puzzle.moves,
    tacticTheme: theme,
    lichessRating: puzzle.rating,
  };
}

/**
 * Check whether the chess-puzzles.db has been loaded successfully.
 */
export function isChessDbLoaded(): boolean {
  return _db !== null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Query puzzles from the DB in a rating window around `targetRating`.
 * Returns up to `limit` rows as ChessPuzzle objects.
 *
 * SQL uses the idx_puzzles_rating index for fast range scans.
 * ORDER BY RANDOM() is only applied in SQLite to a small result set
 * (limited by inner query) to keep performance acceptable.
 */
function _queryPuzzles(
  targetRating: number,
  window: number,
  theme: string | undefined,
  limit: number,
): ChessPuzzle[] {
  if (!_db) return [];

  const lo = targetRating - window;
  const hi = targetRating + window;

  let sql: string;
  let params: (string | number)[];

  if (theme) {
    // Theme is stored as space-separated string — use LIKE for substring match
    sql = `
      SELECT id, fen, moves, rating, themes, game_url
      FROM puzzles
      WHERE rating BETWEEN ? AND ?
        AND themes LIKE ?
      LIMIT ?
    `;
    params = [lo, hi, `%${theme}%`, limit];
  } else {
    sql = `
      SELECT id, fen, moves, rating, themes, game_url
      FROM puzzles
      WHERE rating BETWEEN ? AND ?
      LIMIT ?
    `;
    params = [lo, hi, limit];
  }

  const stmt = _db.prepare(sql);
  stmt.bind(params as Parameters<typeof stmt.bind>[0]);

  const results: ChessPuzzle[] = [];
  try {
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      results.push({
        id: String(row['id']),
        fen: String(row['fen']),
        moves: String(row['moves']).split(' ').filter(Boolean),
        rating: Number(row['rating']),
        themes: String(row['themes']).split(' ').filter(Boolean),
        gameUrl: String(row['game_url'] ?? ''),
      });
    }
  } finally {
    stmt.free();
  }

  return results;
}

/**
 * Convert the player's solution move from UCI to SAN.
 * Applies the setup move (solutionMoves[0]) to the base FEN, then converts
 * solutionMoves[1] (the player's move) to SAN in that resulting position.
 */
function _uciToSanAfterSetup(baseFen: string, moves: string[]): string {
  if (moves.length < 2) return moves[1] ?? '';
  try {
    const setupUCI = moves[0];
    const playerUCI = moves[1];

    const chess = new Chess(baseFen);

    // Apply setup move
    const setupParsed = _parseUCI(setupUCI);
    chess.move(setupParsed);

    // Convert player's move to SAN
    const playerParsed = _parseUCI(playerUCI);
    const result = chess.move(playerParsed);
    return result?.san ?? playerUCI;
  } catch {
    return moves[1] ?? '';
  }
}

/**
 * Determine which color is to move after the setup move.
 * Returns "White" or "Black".
 */
function _colorAfterSetup(baseFen: string, setupUCI: string): string {
  try {
    const chess = new Chess(baseFen);
    chess.move(_parseUCI(setupUCI));
    return chess.turn() === 'w' ? 'White' : 'Black';
  } catch {
    return 'White';
  }
}

/** Parse a UCI move string into { from, to, promotion? }. */
function _parseUCI(uci: string): { from: string; to: string; promotion?: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

/**
 * Map a Lichess puzzle rating (400–3200) to the game's 1-5 difficulty scale.
 * Breakpoints chosen to distribute puzzles somewhat evenly across difficulty tiers.
 */
function _ratingToDifficulty(rating: number): number {
  if (rating < 1000) return 1;
  if (rating < 1400) return 2;
  if (rating < 1800) return 3;
  if (rating < 2200) return 4;
  return 5;
}

/** Fisher-Yates shuffle (in-place). */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
