#!/usr/bin/env node
/**
 * Assemble chess_tactics deck from selected puzzles.
 * Input:  data/sources/lichess/puzzles-selected.json
 * Output: data/decks/chess_tactics.json
 *
 * Uses chess.js for UCI→SAN conversion.
 * Each puzzle becomes a DeckFact with quizMode: "chess_tactic"
 * and quizResponseMode: "chess_move" — the board IS the answer space,
 * so distractors are empty and syntheticDistractors on the pool serve as
 * plausible wrong moves shown during review.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Chess } from '../../../node_modules/chess.js/dist/esm/chess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const IN_PATH = path.join(ROOT, 'data/sources/lichess/puzzles-selected.json');
const OUT_PATH = path.join(ROOT, 'data/decks/chess_tactics.json');

// ---------------------------------------------------------------------------
// Re-export CHAIN_THEMES (duplicated here for standalone use)
// ---------------------------------------------------------------------------
const CHAIN_THEMES = {
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

// ---------------------------------------------------------------------------
// Difficulty mapping: Lichess Elo -> 1-5
// ---------------------------------------------------------------------------
function ratingToDifficulty(rating) {
  if (rating <= 1000) return 1;
  if (rating <= 1400) return 2;
  if (rating <= 1800) return 3;
  if (rating <= 2200) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// Fun score: popularity (-100..+100) -> 1..10
// ---------------------------------------------------------------------------
function popularityToFunScore(popularity) {
  // Clamp to -100..100, then map to 1..10
  const clamped = Math.max(-100, Math.min(100, popularity));
  return Math.min(10, Math.max(1, Math.ceil((clamped + 100) / 20)));
}

// ---------------------------------------------------------------------------
// Quiz question templates per tactic theme
// ---------------------------------------------------------------------------
const THEME_QUESTIONS = {
  mateIn1:          (color) => `${color} to move. Deliver checkmate in one move.`,
  smotheredMate:    (color) => `${color} to move. Deliver a smothered checkmate.`,
  backRankMate:     (color) => `${color} to move. Deliver a back rank checkmate.`,
  arabianMate:      (color) => `${color} to move. Deliver an Arabian mate.`,
  hookMate:         (color) => `${color} to move. Deliver a hook mate.`,
  anastasiasMate:   (color) => `${color} to move. Deliver Anastasia's mate.`,
  mateIn2:          (color) => `${color} to move. Start a forced checkmate in two.`,
  mateIn3:          (color) => `${color} to move. Start a forced checkmate in three.`,
  mateIn4:          (color) => `${color} to move. Start a forced checkmate combination.`,
  fork:             (color) => `${color} to move. Find the fork.`,
  pin:              (color) => `${color} to move. Exploit the pin.`,
  skewer:           (color) => `${color} to move. Find the skewer.`,
  discoveredAttack: (color) => `${color} to move. Unleash a discovered attack.`,
  doubleCheck:      (color) => `${color} to move. Deliver a double check.`,
  sacrifice:        (color) => `${color} to move. Find the winning sacrifice.`,
  attraction:       (color) => `${color} to move. Attract the king into a mating net.`,
  clearance:        (color) => `${color} to move. Clear the critical square.`,
  deflection:       (color) => `${color} to move. Deflect the key defender.`,
  overloading:      (color) => `${color} to move. Overload the defender.`,
  interference:     (color) => `${color} to move. Interfere with the defender.`,
  xRayAttack:       (color) => `${color} to move. Find the X-ray attack.`,
  zugzwang:         (color) => `${color} to move. Put the opponent in zugzwang.`,
  trappedPiece:     (color) => `${color} to move. Win the trapped piece.`,
  hangingPiece:     (color) => `${color} to move. Capture the hanging piece.`,
  endgame:          (color) => `${color} to move. Find the winning endgame technique.`,
  pawnEndgame:      (color) => `${color} to move. Find the winning pawn endgame move.`,
  rookEndgame:      (color) => `${color} to move. Find the winning rook endgame move.`,
  bishopEndgame:    (color) => `${color} to move. Find the winning bishop endgame technique.`,
  knightEndgame:    (color) => `${color} to move. Find the winning knight endgame move.`,
  queenEndgame:     (color) => `${color} to move. Find the winning queen endgame technique.`,
};

function buildQuestion(primaryTheme, color) {
  const fn = THEME_QUESTIONS[primaryTheme];
  if (fn) return fn(color);
  return `${color} to move. Find the best move.`;
}

// ---------------------------------------------------------------------------
// Explanation templates
// ---------------------------------------------------------------------------
const THEME_EXPLANATIONS = {
  mateIn1:          'delivers checkmate immediately.',
  smotheredMate:    'smothers the king using a knight check — the king is blocked by its own pieces.',
  backRankMate:     'exploits the back rank weakness — the king has no escape squares on its first rank.',
  arabianMate:      'uses the Arabian mate pattern — rook and knight working together on the corner.',
  hookMate:         'delivers the hook mate — knight, rook, and pawn trap the king on the edge.',
  anastasiasMate:   "delivers Anastasia's mate — knight and rook cut off the king.",
  mateIn2:          'begins a forced two-move checkmate combination.',
  mateIn3:          'starts a forced three-move mating sequence.',
  mateIn4:          'initiates a forced mating combination.',
  fork:             'attacks two or more pieces simultaneously — the opponent can only save one.',
  pin:              'pins a piece against a more valuable piece behind it, restricting its movement.',
  skewer:           'attacks a valuable piece that must move, exposing the piece behind it.',
  discoveredAttack: 'unmasks a hidden attack by moving a piece out of the line of fire.',
  doubleCheck:      'delivers a double check — both the moving piece and a revealed piece give check simultaneously.',
  sacrifice:        'sacrifices material to gain a decisive positional or tactical advantage.',
  attraction:       'lures the opposing king or key piece to a square where it can be attacked.',
  clearance:        'clears a critical square or line by sacrificing or moving a piece out of the way.',
  deflection:       'forces a key defender away from its defensive duty.',
  overloading:      'overwhelms a piece that is defending too many targets at once.',
  interference:     "interrupts a key defensive connection between the opponent's pieces.",
  xRayAttack:       'strikes through an intervening piece to attack the piece behind it.',
  zugzwang:         'puts the opponent in zugzwang — any move they make worsens their position.',
  trappedPiece:     'wins the piece that has no safe escape square.',
  hangingPiece:     'captures a piece that is undefended and can be taken for free.',
  endgame:          'applies the key endgame principle to convert the advantage.',
  pawnEndgame:      'uses pawn endgame technique — king activity, opposition, or the passed pawn.',
  rookEndgame:      'applies rook endgame technique — the rook belongs behind passed pawns.',
  bishopEndgame:    'uses bishop endgame technique to convert the advantage.',
  knightEndgame:    'exploits the knight endgame structure to win.',
  queenEndgame:     'converts the queen endgame advantage with accurate technique.',
};

function buildExplanation(primaryTheme, sanMove, chainThemeLabel) {
  const themeDesc = THEME_EXPLANATIONS[primaryTheme] ?? `applies the ${chainThemeLabel} theme.`;
  return `The winning move is ${sanMove}. This move ${themeDesc}`;
}

// ---------------------------------------------------------------------------
// acceptable alternatives for a SAN move
// ---------------------------------------------------------------------------
function buildAlternatives(san) {
  const alternatives = new Set();
  // Lowercase variant
  alternatives.add(san.toLowerCase());
  // Without check/mate symbols
  const stripped = san.replace(/[+#!?]/g, '');
  if (stripped !== san) {
    alternatives.add(stripped);
    alternatives.add(stripped.toLowerCase());
  }
  // Remove current answer from its own alternatives
  alternatives.delete(san);
  return [...alternatives].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Pool ID from chain theme label
// ---------------------------------------------------------------------------
function poolId(chainThemeId) {
  const label = CHAIN_THEMES[chainThemeId].label;
  return 'chess_moves_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// ---------------------------------------------------------------------------
// Synthetic distractors for chess move pools — plausible wrong moves
// ---------------------------------------------------------------------------
const CHESS_SYNTHETIC_DISTRACTORS = [
  'Nxe5', 'Bxf7+', 'Qd1', 'Re1', 'O-O', 'Rxd8+', 'Bg5', 'Nc3',
  'Qxh7+', 'Bb5', 'Nd5', 'exd5', 'Nf3', 'Bc4', 'Rd1', 'Qe2',
  'Bxb7', 'Rxe8+', 'Nf6+', 'Qh5', 'Rg1', 'Ng5', 'Bf4', 'Rd8+',
];

// ---------------------------------------------------------------------------
// Convert a UCI move to SAN given the position BEFORE the move
// Returns { san, fenAfter } or null on error
// ---------------------------------------------------------------------------
function uciToSan(fen, uciMove) {
  try {
    const chess = new Chess(fen);
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
    const moveObj = chess.move({ from, to, promotion });
    if (!moveObj) return null;
    return { san: moveObj.san, fenAfter: chess.fen() };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build DeckFact from a selected puzzle
// ---------------------------------------------------------------------------
function buildFact(puzzle) {
  const { id, fen, moves, rating, popularity, themes, gameUrl, primaryTheme, chainThemeId } = puzzle;

  // Apply setup move (moves[0]) to get the player's starting position
  let setupResult;
  try {
    setupResult = uciToSan(fen, moves[0]);
  } catch {
    return null;
  }
  if (!setupResult) return null;

  const playerFen = setupResult.fenAfter;

  // Parse the player's position to determine whose turn it is
  let playerChess;
  try {
    playerChess = new Chess(playerFen);
  } catch {
    return null;
  }
  const color = playerChess.turn() === 'w' ? 'White' : 'Black';

  // Convert the solution move (moves[1]) to SAN
  const solResult = uciToSan(playerFen, moves[1]);
  if (!solResult) return null;
  const sanMove = solResult.san;

  // Question and explanation
  const quizQuestion = buildQuestion(primaryTheme, color);
  const explanation = buildExplanation(primaryTheme, sanMove, CHAIN_THEMES[chainThemeId].label);

  return {
    id: `chess_tac_${id}`,
    correctAnswer: sanMove,
    acceptableAlternatives: buildAlternatives(sanMove),
    chainThemeId,
    answerTypePoolId: poolId(chainThemeId),
    difficulty: ratingToDifficulty(rating),
    funScore: popularityToFunScore(popularity),
    quizQuestion,
    explanation,
    visualDescription: `Chess board position — ${CHAIN_THEMES[chainThemeId].label} puzzle, rated ${rating}`,
    sourceName: 'Lichess Puzzle Database',
    sourceUrl: gameUrl,
    volatile: false,
    categoryL1: 'games',
    categoryL2: 'chess_tactics',
    // Chess-specific fields
    quizMode: 'chess_tactic',
    quizResponseMode: 'chess_move',
    fenPosition: playerFen,
    solutionMoves: moves,
    tacticTheme: primaryTheme,
    lichessRating: rating,
    distractors: [],   // not used for chess_move mode — board IS the answer space
  };
}

// ---------------------------------------------------------------------------
// Build answer type pools
// ---------------------------------------------------------------------------
function buildPools(facts) {
  return Object.entries(CHAIN_THEMES).map(([id, { label }]) => {
    const numericId = Number(id);
    const pid = poolId(numericId);
    const factIds = facts
      .filter(f => f.chainThemeId === numericId)
      .map(f => f.id);
    return {
      id: pid,
      label: `${label} Moves`,
      answerFormat: 'move',
      factIds,
      minimumSize: 5,
      syntheticDistractors: CHESS_SYNTHETIC_DISTRACTORS,
    };
  });
}

// ---------------------------------------------------------------------------
// Build difficulty tiers
// ---------------------------------------------------------------------------
function buildDifficultyTiers(facts) {
  return [
    { tier: 'easy',   factIds: facts.filter(f => f.difficulty <= 2).map(f => f.id) },
    { tier: 'medium', factIds: facts.filter(f => f.difficulty === 3).map(f => f.id) },
    { tier: 'hard',   factIds: facts.filter(f => f.difficulty >= 4).map(f => f.id) },
  ];
}

// ---------------------------------------------------------------------------
// Build sub-decks (one per chain theme)
// ---------------------------------------------------------------------------
function buildSubDecks(facts) {
  return Object.entries(CHAIN_THEMES).map(([id, { label }]) => {
    const numericId = Number(id);
    return {
      id: `chain_${numericId}`,
      name: label,
      factIds: facts.filter(f => f.chainThemeId === numericId).map(f => f.id),
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(IN_PATH)) {
    console.error(`ERROR: selected puzzles not found at:\n  ${IN_PATH}`);
    console.error('Run select-puzzles.mjs first.');
    process.exit(1);
  }

  console.log(`Loading: ${IN_PATH}`);
  const selected = JSON.parse(fs.readFileSync(IN_PATH, 'utf8'));
  console.log(`Loaded ${selected.length} selected puzzles.\n`);

  // Build facts
  let failCount = 0;
  const facts = [];
  for (const puzzle of selected) {
    const fact = buildFact(puzzle);
    if (!fact) {
      console.warn(`WARN: failed to build fact for puzzle ${puzzle.id} (${puzzle.primaryTheme})`);
      failCount++;
      continue;
    }
    facts.push(fact);
  }

  console.log(`Built ${facts.length} facts (${failCount} failed UCI conversion)`);

  // Pools, tiers, sub-decks
  const answerTypePools = buildPools(facts);
  const difficultyTiers = buildDifficultyTiers(facts);
  const subDecks = buildSubDecks(facts);

  const deck = {
    id: 'chess_tactics',
    name: 'Chess Tactics',
    domain: 'games',
    subDomain: 'chess_tactics',
    description: 'Master chess tactical patterns — forks, pins, skewers, sacrifices, and checkmate combinations. Each puzzle is a real game position from the Lichess database with a verified winning move. Move the pieces to solve!',
    minimumFacts: 200,
    targetFacts: 300,
    facts,
    answerTypePools,
    synonymGroups: [],
    questionTemplates: [],
    difficultyTiers,
    subDecks,
  };

  // Write output
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(deck, null, 2), 'utf8');
  console.log(`\nWrote: ${OUT_PATH}`);

  // Summary
  console.log('\n=== DECK SUMMARY ===');
  console.log(`Total facts:  ${facts.length}`);
  console.log(`Pools:        ${answerTypePools.length}`);
  for (const pool of answerTypePools) {
    console.log(`  ${pool.label.padEnd(38)}: ${pool.factIds.length} facts`);
  }
  console.log('\nDifficulty tiers:');
  for (const tier of difficultyTiers) {
    console.log(`  ${tier.tier.padEnd(8)}: ${tier.factIds.length} facts`);
  }

  // Sample 5 facts for verification
  console.log('\n=== SAMPLE FACTS (first 5) ===');
  for (const fact of facts.slice(0, 5)) {
    console.log(`\n  ID:       ${fact.id}`);
    console.log(`  Question: ${fact.quizQuestion}`);
    console.log(`  Answer:   ${fact.correctAnswer}`);
    console.log(`  Theme:    ${fact.tacticTheme} (chain ${fact.chainThemeId})`);
    console.log(`  Rating:   ${fact.lichessRating}  Difficulty: ${fact.difficulty}`);
    console.log(`  FEN:      ${fact.fenPosition.substring(0, 50)}...`);
  }

  if (failCount > 0) {
    console.warn(`\nWARNING: ${failCount} puzzles failed UCI conversion and were skipped.`);
  }
}

main();
