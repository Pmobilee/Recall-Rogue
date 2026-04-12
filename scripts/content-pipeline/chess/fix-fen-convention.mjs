#!/usr/bin/env node
/**
 * fix-fen-convention.mjs
 *
 * One-off post-processing fix: replace the stored `fenPosition` in
 * data/decks/chess_tactics.json with the raw Lichess pre-setup FEN.
 *
 * Background
 * ----------
 * assemble-facts.mjs (lines 200-250) stored `fenPosition: playerFen` —
 * the FEN *after* applying solutionMoves[0] (the opponent's setup move).
 * chessGrader.ts and chessPuzzleService.ts both expect `fenPosition` to be
 * the *pre-setup* (raw Lichess) FEN, and re-apply solutionMoves[0] themselves
 * to reach the player's starting position.  The mismatch caused every puzzle
 * to render as "Invalid puzzle position" at runtime.
 *
 * Fix strategy
 * ------------
 * 1. Try public/chess-puzzles.db (preferred runtime source).
 * 2. Fall back to data/sources/lichess/puzzles-selected.json in this worktree.
 * 3. Fall back to puzzles-selected.json in the main repo (git --git-common-dir).
 *
 * Sanity checks after each replacement:
 *   a. new Chess(fenPosition).move(solutionMoves[0])  must succeed
 *   b. new Chess(playerFen).move(solutionMoves[1])    must succeed
 *      where playerFen = FEN after applying solutionMoves[0]
 *
 * Usage: node scripts/content-pipeline/chess/fix-fen-convention.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { Chess } from '../../../node_modules/chess.js/dist/esm/chess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

// Derive the main repo root from git's common-dir (works inside worktrees too).
// git --git-common-dir returns e.g. /Users/damion/CODE/Recall_Rogue/.git
// so the main repo root is one level up from that.
let MAIN_REPO_ROOT = ROOT;
try {
  const gitCommonDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
  // gitCommonDir is either '.git' (if we're in main repo) or an absolute path (worktree)
  if (path.isAbsolute(gitCommonDir)) {
    MAIN_REPO_ROOT = path.dirname(gitCommonDir);
  }
} catch {
  // Ignore — MAIN_REPO_ROOT stays as ROOT
}

const DECK_PATH = path.join(ROOT, 'data/decks/chess_tactics.json');
const CHESS_DB_PATH = path.join(ROOT, 'public/chess-puzzles.db');

// Candidate paths for puzzles-selected.json (checked in order)
const SELECTED_JSON_CANDIDATES = [
  path.join(ROOT, 'data/sources/lichess/puzzles-selected.json'),
  path.join(MAIN_REPO_ROOT, 'data/sources/lichess/puzzles-selected.json'),
];

// ---------------------------------------------------------------------------
// Load raw puzzle data — DB first, JSON fallback
// ---------------------------------------------------------------------------

/**
 * Build a Map<lichessId, rawFen> from the available source.
 * Returns { source, puzzleMap }.
 */
async function loadPuzzleMap() {
  // --- Try chess-puzzles.db first ---
  const dbStats = fs.existsSync(CHESS_DB_PATH) ? fs.statSync(CHESS_DB_PATH) : null;
  if (dbStats && dbStats.size > 0) {
    console.log('Loading raw FENs from public/chess-puzzles.db …');
    const require = createRequire(import.meta.url);
    const initSqlJs = require(path.join(ROOT, 'node_modules/sql.js/dist/sql-wasm.js'));
    const wasmBinary = fs.readFileSync(path.join(ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm'));
    const SQL = await initSqlJs({ wasmBinary });
    const db = new SQL.Database(fs.readFileSync(CHESS_DB_PATH));
    const stmt = db.prepare('SELECT id, fen FROM puzzles');
    const puzzleMap = new Map();
    while (stmt.step()) {
      const row = stmt.getAsObject();
      puzzleMap.set(String(row['id']), String(row['fen']));
    }
    stmt.free();
    db.close();
    console.log(`  Loaded ${puzzleMap.size.toLocaleString()} puzzles from DB.`);
    return { source: 'chess-puzzles.db', puzzleMap };
  }

  // --- Fall back to puzzles-selected.json (try multiple locations) ---
  for (const candidatePath of SELECTED_JSON_CANDIDATES) {
    if (fs.existsSync(candidatePath)) {
      const displayPath = path.relative(MAIN_REPO_ROOT, candidatePath);
      console.log(`chess-puzzles.db is empty — falling back to ${displayPath} …`);
      const selected = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
      const puzzleMap = new Map(selected.map(p => [String(p.id), String(p.fen)]));
      console.log(`  Loaded ${puzzleMap.size.toLocaleString()} puzzles from JSON.`);
      return { source: displayPath, puzzleMap };
    }
  }

  throw new Error(
    'No puzzle source available.\n' +
    '  Checked:\n' +
    `    ${CHESS_DB_PATH} (empty)\n` +
    SELECTED_JSON_CANDIDATES.map(p => `    ${p} (not found)`).join('\n') + '\n' +
    '  Run "npm run build:chess" to build the DB, or run fetch-lichess-puzzles.mjs + select-puzzles.mjs.'
  );
}

// ---------------------------------------------------------------------------
// Apply a UCI move to a FEN and return the resulting FEN
// Returns null on failure.
// ---------------------------------------------------------------------------
function applyUCI(fen, uciMove) {
  try {
    const chess = new Chess(fen);
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;
    const result = chess.move({ from, to, promotion });
    return result ? chess.fen() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Load deck
  if (!fs.existsSync(DECK_PATH)) {
    console.error(`ERROR: deck not found at ${DECK_PATH}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DECK_PATH, 'utf8'));
  const facts = data.facts;
  console.log(`Loaded ${facts.length} facts from chess_tactics.json.\n`);

  // Load puzzle map
  const { source, puzzleMap } = await loadPuzzleMap();
  console.log(`Using source: ${source}\n`);

  // Process each fact
  let fixed = 0;
  let skipped = 0;
  let sanityFailed = 0;
  const sanityErrors = [];

  for (const fact of facts) {
    const lichessId = fact.id.replace(/^chess_tac_/, '');
    const rawFen = puzzleMap.get(lichessId);

    if (!rawFen) {
      console.warn(`  SKIP  ${fact.id}: Lichess ID "${lichessId}" not found in ${source}`);
      skipped++;
      continue;
    }

    // Sanity check a: solutionMoves[0] must be legal on the raw FEN
    const setupMove = fact.solutionMoves?.[0];
    if (!setupMove) {
      console.warn(`  SKIP  ${fact.id}: no solutionMoves[0]`);
      skipped++;
      continue;
    }

    const playerFen = applyUCI(rawFen, setupMove);
    if (!playerFen) {
      console.error(`  FAIL  ${fact.id}: solutionMoves[0]="${setupMove}" is illegal on raw FEN "${rawFen}"`);
      sanityFailed++;
      sanityErrors.push(`${fact.id}: setup move ${setupMove} illegal on raw FEN`);
      continue;
    }

    // Sanity check b: solutionMoves[1] must be legal on the post-setup FEN
    const playerMove = fact.solutionMoves?.[1];
    if (playerMove) {
      const afterPlayer = applyUCI(playerFen, playerMove);
      if (!afterPlayer) {
        console.error(`  FAIL  ${fact.id}: solutionMoves[1]="${playerMove}" is illegal on post-setup FEN "${playerFen}"`);
        sanityFailed++;
        sanityErrors.push(`${fact.id}: player move ${playerMove} illegal on post-setup FEN`);
        continue;
      }
    }

    // Apply fix
    fact.fenPosition = rawFen;
    fixed++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Processed: ${facts.length} facts`);
  console.log(`Fixed:     ${fixed}`);
  console.log(`Skipped:   ${skipped}  (Lichess ID not found in source)`);
  console.log(`Sanity failed: ${sanityFailed}`);

  if (sanityErrors.length > 0) {
    console.error('\nSanity errors:');
    for (const e of sanityErrors) console.error(`  ${e}`);
  }

  if (sanityFailed > 0) {
    console.error('\nAborting write — sanity failures detected. Investigate before proceeding.');
    process.exit(1);
  }

  if (fixed === 0 && skipped === 0) {
    console.log('\nNothing to do (no facts matched).');
    process.exit(0);
  }

  // Write updated deck back, preserving key order
  fs.writeFileSync(DECK_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nWrote updated deck to: ${DECK_PATH}`);
  console.log(`\nProcessed ${facts.length} facts, fixed ${fixed}, skipped ${skipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
