#!/usr/bin/env node
/**
 * Fetch and filter the Lichess puzzle database.
 * Source: https://database.lichess.org/lichess_db_puzzle.csv.zst (CC0)
 * Output: data/sources/lichess/puzzles-filtered.json
 *
 * The CSV has NO header row. Fields in order:
 * PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 *
 * Filter criteria:
 * - RatingDeviation <= 80  (stable rating)
 * - NbPlays >= 500          (well-tested)
 * - Popularity >= 70        (well-liked; range is roughly -100 to +100)
 * - Themes not empty
 * - Exactly 2 space-separated moves (single-move puzzles, Phase 1)
 *
 * DOWNLOAD INSTRUCTIONS (if CSV not present):
 *   1. curl -L "https://database.lichess.org/lichess_db_puzzle.csv.zst" \
 *         -o data/sources/lichess/lichess_db_puzzle.csv.zst
 *   2. /opt/homebrew/bin/zstd -d data/sources/lichess/lichess_db_puzzle.csv.zst \
 *         -o data/sources/lichess/lichess_db_puzzle.csv
 *
 * Or, to get a ~50K-puzzle sample from the first portion of the file:
 *   curl -L "https://database.lichess.org/lichess_db_puzzle.csv.zst" | \
 *     /opt/homebrew/bin/zstd -d - | head -500000 > data/sources/lichess/lichess_db_puzzle.csv
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

const CSV_PATH = path.join(ROOT, 'data/sources/lichess/lichess_db_puzzle.csv');
const OUT_DIR = path.join(ROOT, 'data/sources/lichess');
const OUT_PATH = path.join(OUT_DIR, 'puzzles-filtered.json');

// ---------------------------------------------------------------------------
// Filter thresholds
// ---------------------------------------------------------------------------
const MIN_RATING_DEVIATION = 80;  // lower = more stable
const MIN_NB_PLAYS = 500;
const MIN_POPULARITY = 60;
const MIN_MOVE_COUNT = 2;  // At least setup + 1 player move (may have more for multi-move puzzles)

// Meta-tags that are not real tactic types — skip these when checking themes
const META_TAGS = new Set(['short', 'long', 'veryLong', 'crushing', 'advantage', 'equality',
  'oneMove', 'master', 'masterVsMaster', 'superGM']);

// ---------------------------------------------------------------------------
// CSV field indices (0-based)
// ---------------------------------------------------------------------------
const F = {
  PuzzleId: 0,
  FEN: 1,
  Moves: 2,
  Rating: 3,
  RatingDeviation: 4,
  Popularity: 5,
  NbPlays: 6,
  Themes: 7,
  GameUrl: 8,
  OpeningTags: 9,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function splitCSVLine(line) {
  // Lichess CSV is straightforward comma-separated with no quoting
  return line.split(',');
}

function parsePuzzle(fields) {
  const id = fields[F.PuzzleId]?.trim();
  const fen = fields[F.FEN]?.trim();
  const movesRaw = fields[F.Moves]?.trim() ?? '';
  const rating = parseInt(fields[F.Rating], 10);
  const ratingDeviation = parseInt(fields[F.RatingDeviation], 10);
  const popularity = parseInt(fields[F.Popularity], 10);
  const nbPlays = parseInt(fields[F.NbPlays], 10);
  const themesRaw = fields[F.Themes]?.trim() ?? '';
  const gameUrlPath = fields[F.GameUrl]?.trim() ?? '';
  const openingTagsRaw = fields[F.OpeningTags]?.trim() ?? '';

  if (!id || !fen || !movesRaw) return null;

  const moves = movesRaw.split(' ').filter(Boolean);
  const themes = themesRaw.split(' ').filter(t => t && !META_TAGS.has(t));
  const openingTags = openingTagsRaw ? openingTagsRaw.split('_').filter(Boolean) : [];
  const gameUrl = gameUrlPath ? `https://lichess.org${gameUrlPath}` : '';

  return { id, fen, moves, rating, ratingDeviation, popularity, nbPlays, themes, gameUrl, openingTags };
}

function passesFilter(puzzle) {
  if (!puzzle) return false;
  if (puzzle.ratingDeviation > MIN_RATING_DEVIATION) return false;
  if (puzzle.nbPlays < MIN_NB_PLAYS) return false;
  if (puzzle.popularity < MIN_POPULARITY) return false;
  if (puzzle.themes.length === 0) return false;
  if (puzzle.moves.length < MIN_MOVE_COUNT) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Check for CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\nERROR: Lichess puzzle CSV not found at:\n  ${CSV_PATH}\n`);
    console.error(`To download and decompress (requires ~1.5GB disk, ~10 min):`);
    console.error(`  mkdir -p data/sources/lichess`);
    console.error(`  curl -L "https://database.lichess.org/lichess_db_puzzle.csv.zst" \\`);
    console.error(`    -o data/sources/lichess/lichess_db_puzzle.csv.zst`);
    console.error(`  /opt/homebrew/bin/zstd -d data/sources/lichess/lichess_db_puzzle.csv.zst \\`);
    console.error(`    -o data/sources/lichess/lichess_db_puzzle.csv`);
    console.error(`\nFor a faster ~50K-puzzle sample (runs in ~30 seconds):`);
    console.error(`  mkdir -p data/sources/lichess`);
    console.error(`  curl -L "https://database.lichess.org/lichess_db_puzzle.csv.zst" | \\`);
    console.error(`    /opt/homebrew/bin/zstd -d - | head -500000 > data/sources/lichess/lichess_db_puzzle.csv`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Reading: ${CSV_PATH}`);
  console.log('Filtering puzzles...\n');

  const rl = readline.createInterface({
    input: fs.createReadStream(CSV_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let totalParsed = 0;
  let totalPassed = 0;
  const filtered = [];
  const themeDistribution = {};
  let firstLineChecked = false;

  for await (const line of rl) {
    if (!line.trim()) continue;

    // Skip header row if one unexpectedly appears
    if (!firstLineChecked) {
      firstLineChecked = true;
      if (line.toLowerCase().startsWith('puzzleid,')) {
        console.log('(Skipping header row)');
        continue;
      }
    }

    totalParsed++;
    if (totalParsed % 200000 === 0) {
      process.stdout.write(`  Parsed ${(totalParsed / 1e6).toFixed(1)}M lines, kept ${totalPassed}...\r`);
    }

    const fields = splitCSVLine(line);
    if (fields.length < 8) continue;

    const puzzle = parsePuzzle(fields);
    if (!passesFilter(puzzle)) continue;

    totalPassed++;
    filtered.push(puzzle);

    // Track theme distribution (primary theme = first non-meta theme)
    if (puzzle.themes.length > 0) {
      const primary = puzzle.themes[0];
      themeDistribution[primary] = (themeDistribution[primary] ?? 0) + 1;
    }
  }

  process.stdout.write('\n');

  // Write output
  console.log(`\nWriting ${filtered.length} puzzles to: ${OUT_PATH}`);
  fs.writeFileSync(OUT_PATH, JSON.stringify(filtered, null, 2), 'utf8');

  // Stats
  console.log(`\n=== FILTER RESULTS ===`);
  console.log(`Total lines parsed:  ${totalParsed.toLocaleString()}`);
  console.log(`Passed filters:      ${totalPassed.toLocaleString()}`);
  console.log(`Filter rate:         ${((totalPassed / totalParsed) * 100).toFixed(2)}%`);
  console.log(`\nFilter criteria applied:`);
  console.log(`  RatingDeviation <= ${MIN_RATING_DEVIATION}`);
  console.log(`  NbPlays >= ${MIN_NB_PLAYS}`);
  console.log(`  Popularity >= ${MIN_POPULARITY}`);
  console.log(`  At least ${MIN_MOVE_COUNT} moves (setup + player response)`);

  console.log('\n=== THEME DISTRIBUTION (top 25) ===');
  const sortedThemes = Object.entries(themeDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
  for (const [theme, count] of sortedThemes) {
    console.log(`  ${theme.padEnd(28)} ${count.toLocaleString()}`);
  }

  console.log(`\nDone. Output: ${OUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
