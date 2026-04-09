#!/usr/bin/env node
/**
 * Select 300 diverse chess puzzles from the filtered pool.
 * Input:  data/sources/lichess/puzzles-filtered.json
 * Output: data/sources/lichess/puzzles-selected.json
 *
 * Selection algorithm:
 * 1. Assign each puzzle a primaryTheme using a priority list
 * 2. Map primaryTheme to one of 10 chainThemeIds
 * 3. Select ~30 puzzles per chain theme with difficulty distribution:
 *    easy(600-1000): 8, intermediate(1001-1400): 8, advanced(1401-1800): 7,
 *    expert(1801-2200): 4, master(2201+): 3
 * 4. Diversity: no duplicate FENs, no more than 3 puzzles from same game
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const IN_PATH = path.join(ROOT, 'data/sources/lichess/puzzles-filtered.json');
const OUT_PATH = path.join(ROOT, 'data/sources/lichess/puzzles-selected.json');

// ---------------------------------------------------------------------------
// Chain theme definitions
// ---------------------------------------------------------------------------
export const CHAIN_THEMES = {
  0: { label: 'Knight Forks',              themes: ['fork'] },
  1: { label: 'Pins & Skewers',            themes: ['pin', 'skewer'] },
  2: { label: 'Discovered Attacks',        themes: ['discoveredAttack', 'doubleCheck'] },
  3: { label: 'Mate in One',               themes: ['mateIn1', 'smotheredMate'] },
  4: { label: 'Mate in Two+',              themes: ['mateIn2', 'mateIn3', 'arabianMate', 'hookMate', 'anastasiasMate'] },
  5: { label: 'Sacrificial Combinations',  themes: ['sacrifice', 'attraction', 'clearance'] },
  6: { label: 'Deflection & Decoy',        themes: ['deflection', 'overloading', 'interference', 'xRayAttack'] },
  7: { label: 'Trapped Pieces',            themes: ['trappedPiece', 'hangingPiece'] },
  8: { label: 'Endgame Technique',         themes: ['endgame', 'pawnEndgame', 'rookEndgame', 'bishopEndgame', 'knightEndgame', 'queenEndgame'] },
  9: { label: 'Back Rank & Mating Nets',   themes: ['backRankMate', 'mateIn4'] },
};

// Theme priority list: most specific tactics first
const THEME_PRIORITY = [
  'smotheredMate', 'backRankMate', 'arabianMate', 'hookMate', 'anastasiasMate',
  'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4',
  'fork', 'pin', 'skewer',
  'discoveredAttack', 'doubleCheck',
  'sacrifice', 'deflection', 'trappedPiece', 'hangingPiece',
  'endgame', 'pawnEndgame', 'rookEndgame', 'bishopEndgame', 'knightEndgame', 'queenEndgame',
  'overloading', 'attraction', 'clearance', 'interference', 'xRayAttack',
  'zugzwang',
];

// Build reverse lookup: theme string -> chainThemeId
const THEME_TO_CHAIN = new Map();
for (const [id, { themes }] of Object.entries(CHAIN_THEMES)) {
  for (const t of themes) {
    THEME_TO_CHAIN.set(t, Number(id));
  }
}

// Meta/non-tactic tags to ignore when resolving primary theme
const META_TAGS = new Set(['short', 'long', 'veryLong', 'crushing', 'advantage', 'equality',
  'oneMove', 'master', 'masterVsMaster', 'superGM']);

// ---------------------------------------------------------------------------
// Difficulty buckets
// ---------------------------------------------------------------------------
const DIFFICULTY_TIERS = [
  { name: 'easy',         min: 600,  max: 1000, target: 8 },
  { name: 'intermediate', min: 1001, max: 1400, target: 8 },
  { name: 'advanced',     min: 1401, max: 1800, target: 7 },
  { name: 'expert',       min: 1801, max: 2200, target: 4 },
  { name: 'master',       min: 2201, max: 9999, target: 3 },
];

// Target per chain theme (will distribute 300 / 10 = 30 each)
const TARGET_PER_THEME = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shuffle(arr) {
  // Fisher-Yates
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Resolve the primary tactic theme for a puzzle.
 * Returns the first theme in THEME_PRIORITY order, or the first
 * theme in the puzzle's list that maps to a known chain, or null.
 */
function resolvePrimaryTheme(puzzle) {
  const tacticThemes = puzzle.themes.filter(t => !META_TAGS.has(t));
  // Try priority-ordered match first
  for (const priority of THEME_PRIORITY) {
    if (tacticThemes.includes(priority)) return priority;
  }
  // Fallback: first theme that maps to a chain
  for (const t of tacticThemes) {
    if (THEME_TO_CHAIN.has(t)) return t;
  }
  return null;
}

/**
 * Extract the base game ID from a Lichess game URL.
 * e.g. "https://lichess.org/abc123/black#42" -> "abc123"
 */
function gameIdFromUrl(url) {
  const match = url.match(/lichess\.org\/([a-zA-Z0-9]+)/);
  return match ? match[1] : url;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(IN_PATH)) {
    console.error(`ERROR: filtered puzzles not found at:\n  ${IN_PATH}`);
    console.error('Run fetch-lichess-puzzles.mjs first.');
    process.exit(1);
  }

  console.log(`Loading: ${IN_PATH}`);
  const allPuzzles = JSON.parse(fs.readFileSync(IN_PATH, 'utf8'));
  console.log(`Loaded ${allPuzzles.length.toLocaleString()} filtered puzzles.\n`);

  // -------------------------------------------------------------------------
  // Step 1: Assign primaryTheme and chainThemeId to each puzzle
  // -------------------------------------------------------------------------
  const annotated = [];
  let unassigned = 0;

  for (const puzzle of allPuzzles) {
    const primaryTheme = resolvePrimaryTheme(puzzle);
    if (!primaryTheme) { unassigned++; continue; }
    const chainThemeId = THEME_TO_CHAIN.get(primaryTheme);
    if (chainThemeId === undefined) { unassigned++; continue; }
    annotated.push({ ...puzzle, primaryTheme, chainThemeId });
  }

  console.log(`Puzzles with assigned chain theme: ${annotated.length.toLocaleString()}`);
  console.log(`Puzzles without chain mapping:     ${unassigned.toLocaleString()}\n`);

  // -------------------------------------------------------------------------
  // Step 2: Group by chainThemeId
  // -------------------------------------------------------------------------
  const byChain = new Map();
  for (let id = 0; id <= 9; id++) byChain.set(id, []);
  for (const puzzle of annotated) {
    byChain.get(puzzle.chainThemeId).push(puzzle);
  }

  // -------------------------------------------------------------------------
  // Step 3: Select TARGET_PER_THEME per chain with difficulty distribution
  // -------------------------------------------------------------------------
  const selected = [];
  const seenFens = new Set();
  const gamePlayCounts = new Map(); // gameId -> count

  for (let chainId = 0; chainId <= 9; chainId++) {
    const candidates = byChain.get(chainId);
    const themeLabel = CHAIN_THEMES[chainId].label;

    if (candidates.length === 0) {
      console.warn(`WARNING: No puzzles available for chain ${chainId} (${themeLabel})`);
      continue;
    }

    // Group by difficulty tier
    const byTier = DIFFICULTY_TIERS.map(tier => ({
      ...tier,
      puzzles: shuffle(candidates.filter(p => p.rating >= tier.min && p.rating <= tier.max)),
    }));

    const chainSelected = [];
    let remaining = TARGET_PER_THEME;

    // First pass: fill each tier to its target
    for (const tier of byTier) {
      const want = Math.min(tier.target, tier.puzzles.length, remaining);
      let added = 0;
      for (const puzzle of tier.puzzles) {
        if (added >= want) break;
        if (seenFens.has(puzzle.fen)) continue;
        const gameId = gameIdFromUrl(puzzle.gameUrl);
        if ((gamePlayCounts.get(gameId) ?? 0) >= 3) continue;

        seenFens.add(puzzle.fen);
        gamePlayCounts.set(gameId, (gamePlayCounts.get(gameId) ?? 0) + 1);
        chainSelected.push(puzzle);
        added++;
        remaining--;
      }
    }

    // Second pass: borrow from any tier if we're short
    if (remaining > 0) {
      const allShuffled = shuffle(candidates);
      for (const puzzle of allShuffled) {
        if (remaining <= 0) break;
        if (seenFens.has(puzzle.fen)) continue;
        const gameId = gameIdFromUrl(puzzle.gameUrl);
        if ((gamePlayCounts.get(gameId) ?? 0) >= 3) continue;

        seenFens.add(puzzle.fen);
        gamePlayCounts.set(gameId, (gamePlayCounts.get(gameId) ?? 0) + 1);
        chainSelected.push(puzzle);
        remaining--;
      }
    }

    selected.push(...chainSelected);
    console.log(`Chain ${chainId} (${themeLabel}): selected ${chainSelected.length} of ${candidates.length} available`);

    // Per-tier breakdown
    for (const tier of byTier) {
      const n = chainSelected.filter(p => p.rating >= tier.min && p.rating <= tier.max).length;
      if (n > 0) console.log(`  ${tier.name.padEnd(14)}: ${n}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Summary
  // -------------------------------------------------------------------------
  console.log(`\n=== SELECTION SUMMARY ===`);
  console.log(`Total selected: ${selected.length}`);

  const difficultyCounts = DIFFICULTY_TIERS.map(tier => ({
    name: tier.name,
    count: selected.filter(p => p.rating >= tier.min && p.rating <= tier.max).length,
  }));
  console.log('\nDifficulty distribution:');
  for (const { name, count } of difficultyCounts) {
    console.log(`  ${name.padEnd(14)}: ${count}`);
  }

  // -------------------------------------------------------------------------
  // Step 5: Write output
  // -------------------------------------------------------------------------
  fs.writeFileSync(OUT_PATH, JSON.stringify(selected, null, 2), 'utf8');
  console.log(`\nWrote: ${OUT_PATH}`);
}

main();
