#!/usr/bin/env node
/**
 * fix-pool-heterogeneity.mjs
 *
 * Fixes answer type pool heterogeneity by splitting pools with high answer-length
 * ratios into short/long sub-pools. This eliminates length_mismatch FAIL issues
 * in the quiz audit (quiz-audit.mjs --full).
 *
 * The quiz audit fails when a correct answer's length ratio vs avg distractor
 * length is >3x or <0.33x. Splitting pools by length ensures distractors come
 * from facts with similar answer lengths.
 *
 * Strategy:
 * - For each pool with text answer length ratio > 3x, find split points that
 *   produce groups where each sub-group has ratio <= 3x and >= MIN_POOL_SIZE members.
 * - Supports multi-way splits (2-way, 3-way) for pools with very wide length ranges.
 * - Bracket-number facts ({N}) are split into a separate pool that keeps the
 *   original pool ID (since they use algorithmic numeric distractors).
 * - If no valid split exists (too few facts to produce valid sub-groups),
 *   the pool is left unchanged.
 *
 * Usage:
 *   node scripts/fix-pool-heterogeneity.mjs --dry-run         # Preview changes
 *   node scripts/fix-pool-heterogeneity.mjs                   # Apply changes
 *   node scripts/fix-pool-heterogeneity.mjs --deck ap_biology # Single deck
 *   node scripts/fix-pool-heterogeneity.mjs --verbose         # Show all splits
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const deckArg = args.indexOf('--deck');
const SINGLE_DECK = deckArg !== -1 ? args[deckArg + 1] : null;

// ---------------------------------------------------------------------------
// ANSI colours
// ---------------------------------------------------------------------------
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Length ratio threshold that triggers a quiz audit FAIL
const FAIL_RATIO = 3.0;
// Minimum facts required in a sub-pool after splitting
const MIN_POOL_SIZE = 5;
// Bracket number pattern — these use algorithmic distractors, skip length check
const BRACE_NUMBER_RE = /^\{[\d,]+\.?\d*\}$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBracketNumber(answer) {
  return BRACE_NUMBER_RE.test(answer);
}

function displayAnswer(answer) {
  const m = answer.match(/^\{([\d,]+\.?\d*)\}$/);
  return m ? m[1] : answer;
}

/**
 * Find 2-way split: returns threshold value or null.
 * A valid split produces two groups each with:
 *   - >= MIN_POOL_SIZE members
 *   - max/min length ratio <= FAIL_RATIO
 */
function find2WaySplit(sortedItems) {
  if (sortedItems.length < MIN_POOL_SIZE * 2) return null;

  let bestThreshold = null;
  let bestScore = -1;

  for (let i = MIN_POOL_SIZE - 1; i <= sortedItems.length - MIN_POOL_SIZE; i++) {
    const shortGroup = sortedItems.slice(0, i + 1);
    const longGroup = sortedItems.slice(i + 1);

    if (shortGroup.length < MIN_POOL_SIZE || longGroup.length < MIN_POOL_SIZE) continue;

    const shortMin = shortGroup[0].len;
    const shortMax = shortGroup[shortGroup.length - 1].len;
    const longMin = longGroup[0].len;
    const longMax = longGroup[longGroup.length - 1].len;

    const shortRatio = shortMin > 0 ? shortMax / shortMin : Infinity;
    const longRatio = longMin > 0 ? longMax / longMin : Infinity;

    if (shortRatio > FAIL_RATIO || longRatio > FAIL_RATIO) continue;

    // Prefer splits with larger gap and more balanced groups
    const gap = longMin - shortMax;
    const balance = Math.min(shortGroup.length, longGroup.length);
    const score = gap * 10 + balance;

    if (score > bestScore) {
      bestScore = score;
      bestThreshold = shortMax;
    }
  }

  return bestThreshold;
}

/**
 * Find 3-way split: returns [threshold1, threshold2] or null.
 * Produces three groups each with >= MIN_POOL_SIZE and ratio <= FAIL_RATIO.
 */
function find3WaySplit(sortedItems) {
  if (sortedItems.length < MIN_POOL_SIZE * 3) return null;

  let best = null;
  let bestScore = -1;

  for (let i = MIN_POOL_SIZE - 1; i <= sortedItems.length - MIN_POOL_SIZE * 2; i++) {
    const g1 = sortedItems.slice(0, i + 1);
    if (g1.length < MIN_POOL_SIZE) continue;

    const r1 = g1[0].len > 0 ? g1[g1.length - 1].len / g1[0].len : Infinity;
    if (r1 > FAIL_RATIO) continue;

    for (let j = i + MIN_POOL_SIZE; j <= sortedItems.length - MIN_POOL_SIZE; j++) {
      const g2 = sortedItems.slice(i + 1, j + 1);
      const g3 = sortedItems.slice(j + 1);

      if (g2.length < MIN_POOL_SIZE || g3.length < MIN_POOL_SIZE) continue;

      const r2 = g2[0].len > 0 ? g2[g2.length - 1].len / g2[0].len : Infinity;
      const r3 = g3[0].len > 0 ? g3[g3.length - 1].len / g3[0].len : Infinity;

      if (r2 > FAIL_RATIO || r3 > FAIL_RATIO) continue;

      const score = g1.length + g2.length + g3.length;
      if (score > bestScore) {
        bestScore = score;
        best = [g1[g1.length - 1].len, g2[g2.length - 1].len];
      }
    }
  }

  return best;
}

/**
 * Build suffix for a split sub-pool.
 * e.g. "short" for the first (shortest) group, "mid" for middle, "long" for last.
 */
function splitSuffix(index, total) {
  if (total === 2) return index === 0 ? 'short' : 'long';
  if (total === 3) {
    if (index === 0) return 'short';
    if (index === 1) return 'mid';
    return 'long';
  }
  return `part${index + 1}`;
}

/**
 * Generate a new pool ID that avoids double-suffixing.
 * If poolId already ends in _short, _long, _mid, etc., use a clean base.
 */
function makeSubPoolId(poolId, suffix) {
  // Strip any existing short/long/mid/partN suffixes to avoid _short_short
  const base = poolId.replace(/_(short|long|mid|part\d+)$/, '');
  return `${base}_${suffix}`;
}

/**
 * Core pool splitting logic.
 * Returns an array of sub-pool descriptors, or null if no split is possible.
 * Each descriptor: { id, label, factIds, groupFacts }
 */
function computePoolSplit(pool, deck) {
  const factMap = new Map(deck.facts.map(f => [f.id, f]));
  const allFactIds = pool.factIds || pool.members || [];

  // Separate bracket numbers from text facts
  const bracketFacts = [];
  const textItems = [];

  for (const id of allFactIds) {
    const f = factMap.get(id);
    if (!f) continue;
    if (isBracketNumber(f.correctAnswer)) {
      bracketFacts.push(f);
    } else {
      textItems.push({ id: f.id, len: displayAnswer(f.correctAnswer).length, fact: f });
    }
  }

  // Check if text facts need splitting
  if (textItems.length < 2) {
    return null; // Nothing to split
  }

  const sorted = [...textItems].sort((a, b) => a.len - b.len);
  const minLen = sorted[0].len;
  const maxLen = sorted[sorted.length - 1].len;
  const ratio = minLen > 0 ? maxLen / minLen : Infinity;

  if (ratio <= FAIL_RATIO) {
    return null; // Already homogeneous
  }

  // Try 2-way split first
  const threshold2 = find2WaySplit(sorted);
  if (threshold2 !== null) {
    const group1 = sorted.filter(item => item.len <= threshold2);
    const group2 = sorted.filter(item => item.len > threshold2);

    const subPools = [];

    for (let i = 0; i < 2; i++) {
      const group = [group1, group2][i];
      const suffix = splitSuffix(i, 2);
      const subPoolId = makeSubPoolId(pool.id, suffix);

      subPools.push({
        id: subPoolId,
        label: `${pool.label || pool.id} (${suffix})`,
        factIds: group.map(item => item.id),
        groupFacts: group.map(item => item.fact),
        threshold: threshold2,
        isLast: i === 1,
      });
    }

    // If there were bracket facts, add them back under original pool ID
    if (bracketFacts.length >= 1) {
      subPools.push({
        id: pool.id,
        label: `${pool.label || pool.id} (numeric)`,
        factIds: bracketFacts.map(f => f.id),
        groupFacts: bracketFacts,
        isBracketPool: true,
      });
    }

    return { type: '2-way', subPools, originalRatio: ratio };
  }

  // Try 3-way split
  const thresholds3 = find3WaySplit(sorted);
  if (thresholds3 !== null) {
    const [t1, t2] = thresholds3;
    const group1 = sorted.filter(item => item.len <= t1);
    const group2 = sorted.filter(item => item.len > t1 && item.len <= t2);
    const group3 = sorted.filter(item => item.len > t2);

    const subPools = [];

    for (let i = 0; i < 3; i++) {
      const group = [group1, group2, group3][i];
      const suffix = splitSuffix(i, 3);
      const subPoolId = makeSubPoolId(pool.id, suffix);

      subPools.push({
        id: subPoolId,
        label: `${pool.label || pool.id} (${suffix})`,
        factIds: group.map(item => item.id),
        groupFacts: group.map(item => item.fact),
        thresholds: [t1, t2],
      });
    }

    // Bracket facts under original pool ID
    if (bracketFacts.length >= 1) {
      subPools.push({
        id: pool.id,
        label: `${pool.label || pool.id} (numeric)`,
        factIds: bracketFacts.map(f => f.id),
        groupFacts: bracketFacts,
        isBracketPool: true,
      });
    }

    return { type: '3-way', subPools, originalRatio: ratio };
  }

  // No valid split found
  return null;
}

// ---------------------------------------------------------------------------
// Main deck processing
// ---------------------------------------------------------------------------

function processDeck(deckId, deckPath) {
  const raw = readFileSync(deckPath, 'utf8');
  const deck = JSON.parse(raw);

  if (!deck.facts || !deck.answerTypePools) {
    return { deckId, skipped: true, reason: 'No facts or pools' };
  }

  if (deck.domain === 'vocabulary') {
    return { deckId, skipped: true, reason: 'Vocabulary deck' };
  }

  const originalPools = deck.answerTypePools;
  const changes = [];
  const newPools = [];
  const factPoolUpdates = new Map(); // factId -> newPoolId

  for (const pool of originalPools) {
    const splitResult = computePoolSplit(pool, deck);

    if (splitResult === null) {
      // Pool doesn't need splitting — just normalize it
      newPools.push(normalizePool(pool));
      continue;
    }

    // Pool is being split
    const { type, subPools, originalRatio } = splitResult;

    // Build new pool objects from sub-pool descriptors
    for (const sp of subPools) {
      // Build pool with all original fields preserved, overriding id/label/factIds
      const newPool = {
        ...pool,
        id: sp.id,
        factIds: sp.factIds,
      };

      if (sp.label) newPool.label = sp.label;

      // Clean up legacy fields
      delete newPool.members;
      // Remove homogeneityExempt since we're fixing the actual issue
      delete newPool.homogeneityExempt;
      delete newPool.homogeneityNote;

      newPools.push(newPool);

      // Update fact pool IDs
      for (const f of sp.groupFacts) {
        factPoolUpdates.set(f.id, sp.id);
      }
    }

    // Record change for reporting
    const nonBracketSubPools = subPools.filter(sp => !sp.isBracketPool);
    changes.push({
      type: 'split',
      splitType: type,
      poolId: pool.id,
      originalRatio: originalRatio.toFixed(1),
      subPools: nonBracketSubPools.map(sp => ({
        id: sp.id,
        count: sp.factIds.length,
      })),
      bracketCount: subPools.find(sp => sp.isBracketPool)?.factIds.length || 0,
    });
  }

  if (changes.filter(c => c.type === 'split').length === 0) {
    return { deckId, changes: [], modified: false };
  }

  // Apply fact pool ID updates
  const updatedFacts = deck.facts.map(f => {
    const newPoolId = factPoolUpdates.get(f.id);
    if (newPoolId && f.answerTypePoolId) {
      return { ...f, answerTypePoolId: newPoolId };
    }
    return f;
  });

  const updatedDeck = {
    ...deck,
    facts: updatedFacts,
    answerTypePools: newPools,
  };

  return { deckId, deck: updatedDeck, changes, modified: true, deckPath };
}

/**
 * Normalize a pool: ensure factIds is set, remove legacy members field.
 */
function normalizePool(pool) {
  const factIds = pool.factIds || pool.members || [];
  const normalized = { ...pool, factIds };
  delete normalized.members;
  return normalized;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

const manifestPath = resolve(repoRoot, 'data/decks/manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`ERROR: Could not load manifest at ${manifestPath}`);
  process.exit(1);
}

const deckFiles = manifest.decks || [];

console.log('');
console.log(`${BOLD}=== FIX POOL HETEROGENEITY ===${RESET}`);
if (DRY_RUN) {
  console.log(`${YELLOW}DRY RUN mode — no files will be written${RESET}`);
}
console.log('');

let totalSplits = 0;
let totalSkips = 0;
let decksModified = 0;

for (const filename of deckFiles) {
  const deckId = filename.replace('.json', '');

  if (SINGLE_DECK && deckId !== SINGLE_DECK) continue;

  const deckPath = resolve(repoRoot, 'data/decks', filename);
  let deck;
  try {
    deck = JSON.parse(readFileSync(deckPath, 'utf8'));
  } catch (e) {
    console.error(`  ${RED}ERROR loading ${deckId}: ${e.message}${RESET}`);
    continue;
  }

  if (deck.domain === 'vocabulary') continue;

  const result = processDeck(deckId, deckPath);

  if (result.skipped) continue;
  if (!result.modified) {
    if (VERBOSE) {
      console.log(`${DIM}${deckId}: no changes needed${RESET}`);
    }
    continue;
  }

  const splits = result.changes.filter(c => c.type === 'split');
  totalSplits += splits.length;
  decksModified++;

  console.log(`${CYAN}${BOLD}${deckId}${RESET}: ${splits.length} pool split(s)`);

  for (const change of splits) {
    const subPoolSummary = change.subPools.map(sp => `${sp.id}(${sp.count})`).join(' + ');
    const bracketNote = change.bracketCount > 0 ? ` + ${change.poolId}(${change.bracketCount} bracket)` : '';
    console.log(
      `  ${GREEN}SPLIT${RESET} ${change.poolId} [${change.splitType}, ratio ${change.originalRatio}x]` +
      ` → ${subPoolSummary}${bracketNote}`
    );
  }

  if (!DRY_RUN) {
    writeFileSync(result.deckPath, JSON.stringify(result.deck, null, 2) + '\n', 'utf8');
    if (VERBOSE) {
      console.log(`  ${DIM}Written: ${result.deckPath}${RESET}`);
    }
  }
}

console.log('');
console.log(`${BOLD}SUMMARY${RESET}`);
console.log(`  Decks modified: ${decksModified}`);
console.log(`  Pools split: ${totalSplits}`);
if (DRY_RUN) {
  console.log(`\n${YELLOW}Run without --dry-run to apply changes.${RESET}`);
}
console.log('');
