#!/usr/bin/env node
/**
 * Validate chess_tactics deck — FEN legality, move legality, theme consistency, pool integrity.
 * Input: data/decks/chess_tactics.json
 *
 * Checks:
 *  1. Every fenPosition parses as a valid chess position
 *  2. Every solutionMoves[1] is legal in the fenPosition
 *  3. correctAnswer matches the SAN of solutionMoves[1]
 *  4. No duplicate fenPosition values
 *  5. mateIn1 puzzles: solution delivers checkmate
 *  6. All answerTypePoolId values reference existing pools
 *  7. All pool factIds reference existing facts
 *  8. Each chain theme has at least 15 facts
 *  9. Difficulty distribution is non-empty in all tiers
 * 10. All facts have required fields (id, correctAnswer, quizQuestion, explanation, difficulty, funScore)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Chess } from '../../../node_modules/chess.js/dist/esm/chess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const DECK_PATH = path.join(ROOT, 'data/decks/chess_tactics.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pass(label) {
  console.log(`  PASS  ${label}`);
}

function fail(label, details = '') {
  const detailStr = details ? `: ${details}` : '';
  console.log(`  FAIL  ${label}${detailStr}`);
  return false;
}

function uciApply(fen, uciMove) {
  try {
    const chess = new Chess(fen);
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
    const moveObj = chess.move({ from, to, promotion });
    if (!moveObj) return null;
    return { san: moveObj.san, chess };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(DECK_PATH)) {
    console.error(`ERROR: deck not found at:\n  ${DECK_PATH}`);
    console.error('Run assemble-facts.mjs first.');
    process.exit(1);
  }

  console.log(`Loading: ${DECK_PATH}`);
  const deck = JSON.parse(fs.readFileSync(DECK_PATH, 'utf8'));
  const { facts, answerTypePools, difficultyTiers } = deck;

  console.log(`Facts: ${facts.length}, Pools: ${answerTypePools.length}\n`);
  console.log('=== RUNNING CHESS DECK VALIDATION ===\n');

  let totalPass = 0;
  let totalFail = 0;
  const failDetails = [];

  function checkPass(label) {
    pass(label);
    totalPass++;
  }

  function checkFail(label, details = '') {
    fail(label, details);
    totalFail++;
    failDetails.push(`${label}${details ? ': ' + details : ''}`);
    return false;
  }

  // -------------------------------------------------------------------------
  // Check 1: Valid FEN positions
  // -------------------------------------------------------------------------
  {
    const invalidFens = [];
    for (const fact of facts) {
      if (!fact.fenPosition) { invalidFens.push(`${fact.id}: missing fenPosition`); continue; }
      try {
        const chess = new Chess(fact.fenPosition);
        if (!chess.fen()) throw new Error('empty fen');
      } catch (e) {
        invalidFens.push(`${fact.id}: ${e.message}`);
      }
    }
    if (invalidFens.length === 0) {
      checkPass(`Check 1: All ${facts.length} fenPosition values are valid`);
    } else {
      checkFail('Check 1: Invalid FEN positions', `${invalidFens.length} failures (first: ${invalidFens[0]})`);
    }
  }

  // -------------------------------------------------------------------------
  // Check 2: Solution move legality
  // -------------------------------------------------------------------------
  {
    const illegalMoves = [];
    for (const fact of facts) {
      if (!fact.fenPosition || !fact.solutionMoves?.[1]) {
        illegalMoves.push(`${fact.id}: missing fenPosition or solutionMoves[1]`);
        continue;
      }
      const result = uciApply(fact.fenPosition, fact.solutionMoves[1]);
      if (!result) {
        illegalMoves.push(`${fact.id}: ${fact.solutionMoves[1]} is illegal in position`);
      }
    }
    if (illegalMoves.length === 0) {
      checkPass(`Check 2: All solution moves are legal in their positions`);
    } else {
      checkFail('Check 2: Illegal solution moves', `${illegalMoves.length} failures (first: ${illegalMoves[0]})`);
    }
  }

  // -------------------------------------------------------------------------
  // Check 3: correctAnswer matches SAN of solution move
  // -------------------------------------------------------------------------
  {
    const mismatches = [];
    for (const fact of facts) {
      if (!fact.fenPosition || !fact.solutionMoves?.[1]) continue;
      const result = uciApply(fact.fenPosition, fact.solutionMoves[1]);
      if (!result) continue;  // Already caught in Check 2
      if (result.san !== fact.correctAnswer) {
        mismatches.push(`${fact.id}: expected "${result.san}", got "${fact.correctAnswer}"`);
      }
    }
    if (mismatches.length === 0) {
      checkPass('Check 3: All correctAnswer values match SAN of solution move');
    } else {
      checkFail('Check 3: correctAnswer/SAN mismatches', `${mismatches.length} (first: ${mismatches[0]})`);
    }
  }

  // -------------------------------------------------------------------------
  // Check 4: No duplicate FEN positions
  // -------------------------------------------------------------------------
  {
    const fenCounts = new Map();
    for (const fact of facts) {
      if (!fact.fenPosition) continue;
      fenCounts.set(fact.fenPosition, (fenCounts.get(fact.fenPosition) ?? 0) + 1);
    }
    const dups = [...fenCounts.entries()].filter(([, count]) => count > 1);
    if (dups.length === 0) {
      checkPass(`Check 4: No duplicate FEN positions`);
    } else {
      const examples = dups.slice(0, 3).map(([fen, n]) => `"${fen.substring(0, 30)}..." x${n}`);
      checkFail('Check 4: Duplicate FEN positions', `${dups.length} dups (${examples.join(', ')})`);
    }
  }

  // -------------------------------------------------------------------------
  // Check 5: mateIn1 puzzles result in checkmate
  // -------------------------------------------------------------------------
  {
    const mateIn1Facts = facts.filter(f => f.tacticTheme === 'mateIn1' || f.tacticTheme === 'smotheredMate');
    const notMate = [];
    for (const fact of mateIn1Facts) {
      if (!fact.fenPosition || !fact.solutionMoves?.[1]) continue;
      const result = uciApply(fact.fenPosition, fact.solutionMoves[1]);
      if (!result) continue;
      if (!result.chess.isCheckmate()) {
        notMate.push(`${fact.id}: solution ${fact.solutionMoves[1]} (SAN: ${result.san}) does not give checkmate`);
      }
    }
    if (mateIn1Facts.length === 0) {
      checkPass('Check 5: No mateIn1/smotheredMate puzzles to verify (skipped)');
    } else if (notMate.length === 0) {
      checkPass(`Check 5: All ${mateIn1Facts.length} mateIn1/smotheredMate solutions deliver checkmate`);
    } else {
      checkFail('Check 5: mateIn1 solutions not delivering checkmate', `${notMate.length} (first: ${notMate[0]})`);
    }
  }

  // -------------------------------------------------------------------------
  // Check 6: All answerTypePoolId values reference existing pools
  // -------------------------------------------------------------------------
  {
    const poolIds = new Set(answerTypePools.map(p => p.id));
    const missingPool = facts.filter(f => f.answerTypePoolId && !poolIds.has(f.answerTypePoolId));
    if (missingPool.length === 0) {
      checkPass('Check 6: All answerTypePoolId values reference existing pools');
    } else {
      const examples = missingPool.slice(0, 3).map(f => `${f.id} -> "${f.answerTypePoolId}"`);
      checkFail('Check 6: Unknown answerTypePoolId references', `${missingPool.length} (${examples.join(', ')})`);
    }
  }

  // -------------------------------------------------------------------------
  // Check 7: All pool factIds reference existing facts
  // -------------------------------------------------------------------------
  {
    const factIds = new Set(facts.map(f => f.id));
    const orphanedRefs = [];
    for (const pool of answerTypePools) {
      for (const fid of (pool.factIds ?? [])) {
        if (!factIds.has(fid)) {
          orphanedRefs.push(`pool "${pool.id}" -> "${fid}"`);
        }
      }
    }
    if (orphanedRefs.length === 0) {
      checkPass('Check 7: All pool factIds reference existing facts');
    } else {
      checkFail('Check 7: Orphaned pool factId references', `${orphanedRefs.length} (first: ${orphanedRefs[0]})`);
    }
  }

  // -------------------------------------------------------------------------
  // Check 8: Each chain theme has at least 15 facts
  // -------------------------------------------------------------------------
  {
    const underweight = [];
    for (const pool of answerTypePools) {
      const count = pool.factIds?.length ?? 0;
      if (count < 15) {
        underweight.push(`"${pool.label}": ${count} facts (need 15+)`);
      }
    }
    if (underweight.length === 0) {
      checkPass('Check 8: All chain theme pools have >= 15 facts');
    } else {
      checkFail('Check 8: Chain themes with insufficient facts', underweight.join('; '));
    }
  }

  // -------------------------------------------------------------------------
  // Check 9: Difficulty distribution non-empty in all tiers
  // -------------------------------------------------------------------------
  {
    const emptyTiers = (difficultyTiers ?? []).filter(t => (t.factIds?.length ?? 0) === 0);
    if (emptyTiers.length === 0) {
      checkPass(`Check 9: All difficulty tiers are populated`);
    } else {
      checkFail('Check 9: Empty difficulty tiers', emptyTiers.map(t => t.tier).join(', '));
    }
  }

  // -------------------------------------------------------------------------
  // Check 10: Required fields on all facts
  // -------------------------------------------------------------------------
  {
    const REQUIRED_FIELDS = ['id', 'correctAnswer', 'quizQuestion', 'explanation', 'difficulty', 'funScore',
      'chainThemeId', 'answerTypePoolId', 'fenPosition', 'solutionMoves', 'tacticTheme'];
    const missingFields = [];
    for (const fact of facts) {
      for (const field of REQUIRED_FIELDS) {
        if (fact[field] === undefined || fact[field] === null || fact[field] === '') {
          missingFields.push(`${fact.id}: missing ${field}`);
          break;
        }
      }
    }
    if (missingFields.length === 0) {
      checkPass(`Check 10: All facts have required fields`);
    } else {
      checkFail('Check 10: Facts with missing required fields', `${missingFields.length} (first: ${missingFields[0]})`);
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n=== VALIDATION SUMMARY ===');
  console.log(`Pass: ${totalPass}  Fail: ${totalFail}`);

  if (totalFail > 0) {
    console.log('\nFailed checks:');
    for (const d of failDetails) {
      console.log(`  - ${d}`);
    }
    console.log('\nFix issues before committing.');
    process.exit(1);
  } else {
    console.log('\nAll checks passed. Deck is valid.');
  }

  // Per-theme stats
  console.log('\n=== CHAIN THEME STATS ===');
  for (const pool of answerTypePools) {
    const n = pool.factIds?.length ?? 0;
    const status = n >= 15 ? 'OK' : 'LOW';
    console.log(`  [${status}] ${pool.label.padEnd(38)}: ${n} facts`);
  }

  // Difficulty distribution
  console.log('\n=== DIFFICULTY DISTRIBUTION ===');
  for (const tier of (difficultyTiers ?? [])) {
    console.log(`  ${tier.tier.padEnd(8)}: ${(tier.factIds?.length ?? 0)} facts`);
  }
}

main();
