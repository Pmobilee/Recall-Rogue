#!/usr/bin/env node
/**
 * pool-homogeneity-analysis.mjs
 *
 * Analyzes answer type pool quality across curated knowledge decks.
 * Flags pools with large answer-length disparities (which make correct answers
 * trivially guessable by length alone), undersized pools, and bare numbers
 * that should use {N} bracket notation.
 *
 * Usage:
 *   node scripts/pool-homogeneity-analysis.mjs
 *   node scripts/pool-homogeneity-analysis.mjs --deck solar_system
 *   node scripts/pool-homogeneity-analysis.mjs --json
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes('--json');
const DECK_FILTER = (() => {
  const idx = args.indexOf('--deck');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// ANSI colours (skipped in JSON mode)
// ---------------------------------------------------------------------------
const GREEN  = JSON_OUTPUT ? '' : '\x1b[32m';
const RED    = JSON_OUTPUT ? '' : '\x1b[31m';
const YELLOW = JSON_OUTPUT ? '' : '\x1b[33m';
const CYAN   = JSON_OUTPUT ? '' : '\x1b[36m';
const BLUE   = JSON_OUTPUT ? '' : '\x1b[34m';
const DIM    = JSON_OUTPUT ? '' : '\x1b[2m';
const BOLD   = JSON_OUTPUT ? '' : '\x1b[1m';
const RESET  = JSON_OUTPUT ? '' : '\x1b[0m';

// ---------------------------------------------------------------------------
// Replicated from numericalDistractorService.ts
// ---------------------------------------------------------------------------
const BRACE_NUMBER_RE = /\{(\d[\d,]*\.?\d*)\}/;

function displayAnswer(answer) {
  return answer.replace(/\{(\d[\d,]*\.?\d*)\}/, '$1');
}

// ---------------------------------------------------------------------------
// Bare-number detection for {N} conversion candidates
// Number words limited to common ones that appear as standalone answers
// ---------------------------------------------------------------------------
const BARE_NUMBER_RE = /^\d[\d,]*\.?\d*$/;
const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand', 'million', 'billion',
]);

function isBareNumber(answer) {
  if (BRACE_NUMBER_RE.test(answer)) return false; // already bracketed
  const trimmed = answer.trim();
  if (BARE_NUMBER_RE.test(trimmed)) return true;
  // Single number word (case-insensitive)
  return NUMBER_WORDS.has(trimmed.toLowerCase());
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

/** @param {number[]} values */
function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** @param {number[]} values */
function stdev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Exempt deck detection
// ---------------------------------------------------------------------------
const EXEMPT_DOMAINS = new Set(['vocabulary']);
const EXEMPT_DECK_PREFIXES = ['test_'];
const EXEMPT_DECK_IDS = new Set([
  'world_flags',
  // hiragana/katakana/hangul are script decks (image-based)
  'japanese_hiragana',
  'japanese_katakana',
  'korean_hangul',
]);

function isExempt(deck, deckId) {
  if (EXEMPT_DOMAINS.has(deck.domain)) return true;
  if (EXEMPT_DECK_IDS.has(deckId)) return true;
  if (EXEMPT_DECK_PREFIXES.some(p => deckId.startsWith(p))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Pool-level analysis
// ---------------------------------------------------------------------------

/**
 * Normalized pool member ID list.
 * Handles both `factIds` (current) and legacy `members` field.
 */
function poolFactIds(pool) {
  if (!pool) return [];
  return Array.isArray(pool.factIds) ? pool.factIds
    : Array.isArray(pool.members)   ? pool.members
    : [];
}

/**
 * Analyzes a single pool within a deck.
 * Returns a structured result object.
 */
function analyzePool(pool, deck) {
  const factById = new Map((deck.facts || []).map(f => [f.id, f]));
  const ids = poolFactIds(pool);
  const factCount = ids.length;

  const members = ids
    .map(id => factById.get(id))
    .filter(Boolean);

  // Compute displayed answers, flagging bracket numbers and bare numbers
  const memberData = members.map(f => {
    const raw = f.correctAnswer || '';
    const isBracket = BRACE_NUMBER_RE.test(raw);
    const displayed = displayAnswer(raw);
    const bare = isBareNumber(raw);
    return { factId: f.id, raw, displayed, isBracket, isBareNumber: bare, len: displayed.length };
  });

  // Separate bracket-number facts from text facts for length analysis
  // Bracket facts have algorithmically-generated numeric distractors — length
  // ratio is irrelevant for them since they all display as numbers.
  const textMembers = memberData.filter(m => !m.isBracket);
  const bareNumberMembers = memberData.filter(m => m.isBareNumber && !m.isBracket);

  // Length stats — computed on text members only
  const lengths = textMembers.map(m => m.len);
  const minLen = lengths.length > 0 ? Math.min(...lengths) : 0;
  const maxLen = lengths.length > 0 ? Math.max(...lengths) : 0;
  const medianLen = median(lengths);
  const stdevLen = stdev(lengths);
  const lengthRatio = minLen > 0 ? maxLen / minLen : (maxLen > 0 ? Infinity : 1);

  // Find the actual outlier facts (for display)
  const shortestFact = textMembers.find(m => m.len === minLen) || null;
  const longestFact = textMembers.find(m => m.len === maxLen) || null;

  // Flags
  const flags = [];

  // FAIL: length ratio > 3× (text members only, need at least 2 to compare)
  // If pool.homogeneityExempt is true, LENGTH_RATIO_HIGH is downgraded to INFO
  // (acknowledges inherent domain variation that cannot be normalized).
  const isExemptPool = pool.homogeneityExempt === true;
  if (textMembers.length >= 2 && lengthRatio > 3) {
    flags.push({
      severity: isExemptPool ? 'INFO' : 'FAIL',
      code: 'LENGTH_RATIO_HIGH',
      message: `Length ratio ${lengthRatio.toFixed(1)}× (min ${minLen}, max ${maxLen}) — answers trivially distinguishable by length` +
        (isExemptPool ? ` (exempt: ${pool.homogeneityExemptNote || 'pool marked homogeneityExempt'})` : ''),
    });
  } else if (textMembers.length >= 2 && lengthRatio > 2) {
    flags.push({
      severity: 'WARN',
      code: 'LENGTH_RATIO_MODERATE',
      message: `Length ratio ${lengthRatio.toFixed(1)}× (min ${minLen}, max ${maxLen}) — consider evening out answer lengths`,
    });
  }

  // FAIL: pool < 5 members AND no syntheticDistractors
  // bracket_numbers pools use algorithmic numeric distractor generation — minimum size N/A.
  const hasSynthetic = Array.isArray(pool.syntheticDistractors) && pool.syntheticDistractors.length > 0;
  const isBracketPool = pool.id === 'bracket_numbers';
  const effectiveMin = typeof pool.minimumSize === 'number' ? pool.minimumSize : 5;
  if (!isBracketPool && factCount < effectiveMin && !hasSynthetic) {
    flags.push({
      severity: 'FAIL',
      code: 'POOL_TOO_SMALL',
      message: `Pool has only ${factCount} member${factCount !== 1 ? 's' : ''} (minimum ${effectiveMin}) and no syntheticDistractors`,
    });
  }

  // INFO: bare-number answers that should use {N} notation
  if (bareNumberMembers.length > 0) {
    flags.push({
      severity: 'INFO',
      code: 'BARE_NUMBER_ANSWERS',
      message: `${bareNumberMembers.length} fact${bareNumberMembers.length !== 1 ? 's' : ''} with bare-number answers — consider {N} bracket notation for algorithmic distractors`,
      factIds: bareNumberMembers.map(m => m.factId),
    });
  }

  return {
    poolId: pool.id,
    label: pool.label || '',
    factCount,
    textMemberCount: textMembers.length,
    bracketCount: memberData.filter(m => m.isBracket).length,
    bareNumberCount: bareNumberMembers.length,
    hasSynthetic,
    stats: {
      minLen,
      maxLen,
      medianLen: Math.round(medianLen * 10) / 10,
      stdevLen: Math.round(stdevLen * 10) / 10,
      lengthRatio: Math.round(lengthRatio * 10) / 10,
    },
    shortestFact: shortestFact ? { factId: shortestFact.factId, answer: shortestFact.displayed } : null,
    longestFact: longestFact ? { factId: longestFact.factId, answer: longestFact.displayed } : null,
    flags,
  };
}

// ---------------------------------------------------------------------------
// Per-deck analysis
// ---------------------------------------------------------------------------

function analyzeDeck(deckId, deck) {
  const pools = deck.answerTypePools || [];
  const poolResults = pools.map(pool => analyzePool(pool, deck));

  const failCount = poolResults.reduce((s, r) => s + r.flags.filter(f => f.severity === 'FAIL').length, 0);
  const warnCount = poolResults.reduce((s, r) => s + r.flags.filter(f => f.severity === 'WARN').length, 0);
  const infoCount = poolResults.reduce((s, r) => s + r.flags.filter(f => f.severity === 'INFO').length, 0);

  return {
    deckId,
    deckName: deck.name || deckId,
    domain: deck.domain || '',
    totalFacts: (deck.facts || []).length,
    totalPools: pools.length,
    failCount,
    warnCount,
    infoCount,
    pools: poolResults,
  };
}

// ---------------------------------------------------------------------------
// Pad helper
// ---------------------------------------------------------------------------

function pad(str, width, right = false) {
  const s = String(str);
  if (s.length >= width) return s.slice(0, width);
  const padding = ' '.repeat(width - s.length);
  return right ? padding + s : s + padding;
}

// ---------------------------------------------------------------------------
// Human-readable output
// ---------------------------------------------------------------------------

function severityColor(sev) {
  if (sev === 'FAIL') return RED;
  if (sev === 'WARN') return YELLOW;
  if (sev === 'INFO') return BLUE;
  return RESET;
}

function printDeckResult(result) {
  const hasIssues = result.failCount > 0 || result.warnCount > 0 || result.infoCount > 0;
  const headerColor = result.failCount > 0 ? RED : result.warnCount > 0 ? YELLOW : DIM;

  console.log(`\n${BOLD}${CYAN}${result.deckId}${RESET} ${DIM}(${result.deckName})${RESET}`);
  console.log(`  ${DIM}${result.totalFacts} facts, ${result.totalPools} pools${RESET}`);

  if (!hasIssues) {
    console.log(`  ${GREEN}All pools OK${RESET}`);
    return;
  }

  for (const pool of result.pools) {
    const poolHasIssues = pool.flags.length > 0;
    if (!poolHasIssues) continue;

    const worstSeverity = pool.flags.reduce((worst, f) => {
      if (f.severity === 'FAIL') return 'FAIL';
      if (worst === 'FAIL') return worst;
      if (f.severity === 'WARN') return 'WARN';
      return worst || f.severity;
    }, '');

    const poolColor = severityColor(worstSeverity);
    console.log(`\n  ${poolColor}${BOLD}${pool.poolId}${RESET} ${DIM}(${pool.label || 'no label'})${RESET}`);
    console.log(
      `    ${DIM}facts: ${pool.factCount}` +
      (pool.bracketCount > 0 ? ` | bracket-num: ${pool.bracketCount}` : '') +
      (pool.hasSynthetic ? ` | has syntheticDistractors` : '') +
      `  —  lengths: min=${pool.stats.minLen} max=${pool.stats.maxLen}` +
      ` median=${pool.stats.medianLen} σ=${pool.stats.stdevLen}` +
      ` ratio=${pool.stats.lengthRatio}×` +
      RESET
    );

    if (pool.shortestFact && pool.longestFact && pool.shortestFact.factId !== pool.longestFact.factId) {
      console.log(`    ${DIM}Shortest: "${pool.shortestFact.answer}" (${pool.shortestFact.answer.length}c) — ${pool.shortestFact.factId}${RESET}`);
      console.log(`    ${DIM}Longest:  "${pool.longestFact.answer.slice(0, 80)}${pool.longestFact.answer.length > 80 ? '…' : ''}" (${pool.longestFact.answer.length}c) — ${pool.longestFact.factId}${RESET}`);
    }

    for (const flag of pool.flags) {
      const col = severityColor(flag.severity);
      console.log(`    ${col}[${flag.severity}]${RESET} ${flag.message}`);
      if (flag.factIds && flag.factIds.length <= 5) {
        for (const fid of flag.factIds) {
          console.log(`      ${DIM}• ${fid}${RESET}`);
        }
      } else if (flag.factIds && flag.factIds.length > 5) {
        for (const fid of flag.factIds.slice(0, 4)) {
          console.log(`      ${DIM}• ${fid}${RESET}`);
        }
        console.log(`      ${DIM}  … and ${flag.factIds.length - 4} more${RESET}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const manifestPath = resolve(repoRoot, 'data/decks/manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`ERROR: Could not load manifest at ${manifestPath}`);
  console.error(e.message);
  process.exit(1);
}

const deckFiles = manifest.decks || [];

const results = [];
const skipped = [];
const loadErrors = [];

for (const filename of deckFiles) {
  const deckId = filename.replace('.json', '');

  // Single-deck filter
  if (DECK_FILTER && deckId !== DECK_FILTER) continue;

  const deckPath = resolve(repoRoot, 'data/decks', filename);
  let deck;
  try {
    deck = JSON.parse(readFileSync(deckPath, 'utf8'));
  } catch (e) {
    loadErrors.push({ deckId, error: e.message });
    continue;
  }

  if (isExempt(deck, deckId)) {
    skipped.push(deckId);
    continue;
  }

  const result = analyzeDeck(deckId, deck);
  results.push(result);
}

// ---------------------------------------------------------------------------
// JSON output mode
// ---------------------------------------------------------------------------

if (JSON_OUTPUT) {
  const output = {
    analyzed: results.length,
    skipped: skipped.length,
    loadErrors,
    summary: {
      totalPools: results.reduce((s, r) => s + r.totalPools, 0),
      totalFail: results.reduce((s, r) => s + r.failCount, 0),
      totalWarn: results.reduce((s, r) => s + r.warnCount, 0),
      totalInfo: results.reduce((s, r) => s + r.infoCount, 0),
    },
    decks: results,
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Human-readable output
// ---------------------------------------------------------------------------

const totalDecksAnalyzed = results.length;
const totalPools = results.reduce((s, r) => s + r.totalPools, 0);
const totalFail = results.reduce((s, r) => s + r.failCount, 0);
const totalWarn = results.reduce((s, r) => s + r.warnCount, 0);
const totalInfo = results.reduce((s, r) => s + r.infoCount, 0);
const decksWithFail = results.filter(r => r.failCount > 0).length;
const decksWithWarn = results.filter(r => r.failCount === 0 && r.warnCount > 0).length;
const cleanDecks = results.filter(r => r.failCount === 0 && r.warnCount === 0 && r.infoCount === 0).length;

console.log('');
console.log(`${BOLD}=== POOL HOMOGENEITY ANALYSIS ===${RESET}`);
console.log(`${DIM}Analyzing ${totalDecksAnalyzed} knowledge decks (${skipped.length} language/exempt decks skipped)${RESET}`);

if (loadErrors.length > 0) {
  console.log(`\n${RED}${BOLD}LOAD ERRORS:${RESET}`);
  for (const { deckId, error } of loadErrors) {
    console.log(`  ${RED}- ${deckId}: ${error}${RESET}`);
  }
}

// Sort: failures first, then warnings, then info-only, then clean
results.sort((a, b) => {
  if (b.failCount !== a.failCount) return b.failCount - a.failCount;
  if (b.warnCount !== a.warnCount) return b.warnCount - a.warnCount;
  if (b.infoCount !== a.infoCount) return b.infoCount - a.infoCount;
  return a.deckId.localeCompare(b.deckId);
});

// ---------------------------------------------------------------------------
// Summary table (all decks, brief)
// ---------------------------------------------------------------------------

const COL_DECK   = 30;
const COL_POOLS  = 6;
const COL_FAIL   = 6;
const COL_WARN   = 6;
const COL_INFO   = 6;

const header =
  pad('DECK', COL_DECK) +
  pad('POOLS', COL_POOLS, true) +
  pad('FAIL', COL_FAIL, true) +
  pad('WARN', COL_WARN, true) +
  pad('INFO', COL_INFO, true) +
  '  STATUS';
const divider = '─'.repeat(header.length + 8);

console.log('');
console.log(header);
console.log(divider);

for (const r of results) {
  const failColor = r.failCount > 0 ? RED : GREEN;
  const warnColor = r.warnCount > 0 ? YELLOW : DIM;
  const infoColor = r.infoCount > 0 ? BLUE : DIM;

  let status;
  if (r.failCount === 0 && r.warnCount === 0 && r.infoCount === 0) {
    status = `${GREEN}CLEAN${RESET}`;
  } else if (r.failCount > 0) {
    status = `${RED}NEEDS FIX${RESET}`;
  } else if (r.warnCount > 0) {
    status = `${YELLOW}REVIEW${RESET}`;
  } else {
    status = `${BLUE}INFO${RESET}`;
  }

  const row =
    pad(r.deckId, COL_DECK) +
    pad(r.totalPools, COL_POOLS, true) +
    `${failColor}` + pad(r.failCount, COL_FAIL, true) + RESET +
    `${warnColor}` + pad(r.warnCount, COL_WARN, true) + RESET +
    `${infoColor}` + pad(r.infoCount, COL_INFO, true) + RESET +
    `  ${status}`;
  console.log(row);
}

console.log(divider);

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

console.log('');
console.log(
  `${BOLD}SUMMARY:${RESET}` +
  ` ${totalDecksAnalyzed} decks | ${totalPools} pools` +
  ` | ${totalFail > 0 ? RED : GREEN}${totalFail} FAIL${RESET}` +
  ` | ${totalWarn > 0 ? YELLOW : DIM}${totalWarn} WARN${RESET}` +
  ` | ${totalInfo > 0 ? BLUE : DIM}${totalInfo} INFO${RESET}`
);
console.log(
  `  ${decksWithFail > 0 ? RED : GREEN}${decksWithFail} deck${decksWithFail !== 1 ? 's' : ''} with failures${RESET}` +
  ` | ${decksWithWarn > 0 ? YELLOW : DIM}${decksWithWarn} with warnings only${RESET}` +
  ` | ${DIM}${cleanDecks} clean${RESET}`
);

// ---------------------------------------------------------------------------
// Per-deck details (only decks with issues)
// ---------------------------------------------------------------------------

const decksWithIssues = results.filter(r => r.failCount > 0 || r.warnCount > 0 || r.infoCount > 0);

if (decksWithIssues.length === 0) {
  console.log(`\n${GREEN}${BOLD}All pools pass — no homogeneity issues found.${RESET}`);
} else {
  console.log(`\n${BOLD}=== PER-DECK DETAILS (flagged decks only) ===${RESET}`);
  for (const r of decksWithIssues) {
    printDeckResult(r);
  }
}

// ---------------------------------------------------------------------------
// Fix priority list
// ---------------------------------------------------------------------------

const failingDecks = results.filter(r => r.failCount > 0);
if (failingDecks.length > 0) {
  console.log(`\n${BOLD}${RED}=== FIX PRIORITY (decks with FAIL) ===${RESET}`);
  let n = 1;
  for (const r of failingDecks) {
    const failPools = r.pools
      .filter(p => p.flags.some(f => f.severity === 'FAIL'))
      .map(p => p.poolId);
    console.log(`  ${n}. ${CYAN}${r.deckId}${RESET} — ${RED}${r.failCount} failure${r.failCount !== 1 ? 's' : ''}${RESET} in pools: ${failPools.join(', ')}`);
    n++;
  }
}

console.log('');
process.exit(totalFail > 0 ? 1 : 0);
