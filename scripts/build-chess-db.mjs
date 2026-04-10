/**
 * build-chess-db.mjs
 *
 * Compiles data/sources/lichess/puzzles-filtered.json (620K+ puzzles) into
 * public/chess-puzzles.db — a SQLite database indexed by rating for fast
 * Elo-targeted puzzle selection at runtime.
 *
 * Schema:
 *   puzzles(id, fen, moves, rating, themes, game_url)
 *   INDEX on rating for fast range queries
 *
 * Usage:  node scripts/build-chess-db.mjs
 * NPM:    npm run build:chess
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');
const SOURCE     = path.join(ROOT, 'data', 'sources', 'lichess', 'puzzles-filtered.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DB     = path.join(PUBLIC_DIR, 'chess-puzzles.db');
const WASM_PATH  = path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

// ---------------------------------------------------------------------------
// Bootstrap sql.js
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url);
const initSqlJs = require(
  path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js')
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const DDL = `
CREATE TABLE IF NOT EXISTS puzzles (
  id       TEXT PRIMARY KEY,
  fen      TEXT NOT NULL,
  moves    TEXT NOT NULL,
  rating   INTEGER NOT NULL,
  themes   TEXT NOT NULL,
  game_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles(rating);
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // -- Load sql.js WASM --
  let wasmBinary;
  try {
    wasmBinary = fs.readFileSync(WASM_PATH);
  } catch (err) {
    console.error(`[ERROR] Could not read sql.js WASM at ${WASM_PATH}`);
    console.error(err.message);
    process.exit(1);
  }

  const SQL = await initSqlJs({ wasmBinary });
  const db  = new SQL.Database();

  db.run(DDL);

  // -- Load puzzles JSON --
  console.log(`[build-chess-db] Reading puzzles from ${path.relative(ROOT, SOURCE)}...`);
  let puzzles;
  try {
    const raw = fs.readFileSync(SOURCE, 'utf-8');
    puzzles = JSON.parse(raw);
  } catch (err) {
    console.error(`[ERROR] Could not read/parse ${SOURCE}: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(puzzles)) {
    console.error('[ERROR] Expected JSON array of puzzles');
    process.exit(1);
  }

  console.log(`[build-chess-db] Processing ${puzzles.length.toLocaleString()} puzzles...`);

  // -- Rating distribution tracking --
  const ratingBuckets = {
    'under_1000':  0,
    '1000_1200':   0,
    '1200_1400':   0,
    '1400_1600':   0,
    '1600_1800':   0,
    '1800_2000':   0,
    '2000_2200':   0,
    '2200_2400':   0,
    'over_2400':   0,
  };

  function classifyRating(rating) {
    if (rating < 1000) return 'under_1000';
    if (rating < 1200) return '1000_1200';
    if (rating < 1400) return '1200_1400';
    if (rating < 1600) return '1400_1600';
    if (rating < 1800) return '1600_1800';
    if (rating < 2000) return '1800_2000';
    if (rating < 2200) return '2000_2200';
    if (rating < 2400) return '2200_2400';
    return 'over_2400';
  }

  // -- Prepare INSERT statement --
  const INSERT = db.prepare(`
    INSERT OR REPLACE INTO puzzles (id, fen, moves, rating, themes, game_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // -- Process in batched transactions (5000 puzzles per transaction) --
  const BATCH_SIZE = 5000;
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < puzzles.length; i += BATCH_SIZE) {
    const batch = puzzles.slice(i, Math.min(i + BATCH_SIZE, puzzles.length));

    db.run('BEGIN');
    try {
      for (const puzzle of batch) {
        // Validate required fields
        if (!puzzle.id || !puzzle.fen || !puzzle.moves || puzzle.rating == null) {
          skipped++;
          continue;
        }

        const movesStr   = Array.isArray(puzzle.moves)  ? puzzle.moves.join(' ')  : String(puzzle.moves);
        const themesStr  = Array.isArray(puzzle.themes) ? puzzle.themes.join(' ') : String(puzzle.themes ?? '');
        const gameUrl    = puzzle.gameUrl ?? null;
        const rating     = Number(puzzle.rating);

        INSERT.run([
          puzzle.id,
          puzzle.fen,
          movesStr,
          rating,
          themesStr,
          gameUrl,
        ]);

        ratingBuckets[classifyRating(rating)]++;
        processed++;
      }
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      console.error(`[ERROR] Batch insert failed at offset ${i}: ${err.message}`);
      process.exit(1);
    }

    // Progress reporting every 100K puzzles
    if ((i + BATCH_SIZE) % 100000 < BATCH_SIZE) {
      const pct = Math.min(100, Math.round(((i + BATCH_SIZE) / puzzles.length) * 100));
      console.log(`  ${processed.toLocaleString()} puzzles inserted (${pct}%)`);
    }
  }

  INSERT.free();

  // -- Write to disk --
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const exported = db.export();
  fs.writeFileSync(OUT_DB, Buffer.from(exported));
  db.close();

  const sizeMb = (fs.statSync(OUT_DB).size / (1024 * 1024)).toFixed(1);

  // -- Print stats --
  console.log('');
  console.log('Build complete:');
  console.log(`  Total puzzles inserted : ${processed.toLocaleString()}`);
  if (skipped > 0) {
    console.log(`  Skipped (invalid data) : ${skipped}`);
  }
  console.log(`  Output                 : ${path.relative(ROOT, OUT_DB)} (${sizeMb} MB)`);
  console.log('');
  console.log('Rating distribution:');
  for (const [bucket, count] of Object.entries(ratingBuckets)) {
    if (count > 0) {
      const pct = ((count / processed) * 100).toFixed(1);
      console.log(`  ${bucket.padEnd(12)} : ${count.toLocaleString().padStart(8)} (${pct}%)`);
    }
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
