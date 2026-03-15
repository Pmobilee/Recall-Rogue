/**
 * normalize-vocab-answers.mjs
 *
 * Normalizes vocabulary fact `correctAnswer` fields across 8 language seed files
 * to fix length inconsistency issues that let players guess answers by length alone.
 *
 * Usage:
 *   node scripts/content-pipeline/normalize-vocab-answers.mjs --dry-run
 *   node scripts/content-pipeline/normalize-vocab-answers.mjs --write
 *   node scripts/content-pipeline/normalize-vocab-answers.mjs --dry-run --lang=de
 *   node scripts/content-pipeline/normalize-vocab-answers.mjs --write --lang=fr
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SEED_DIR = resolve(REPO_ROOT, 'src', 'data', 'seed');

/** Languages that get the full normalization pipeline. */
const NORMALIZABLE_LANGS = ['zh', 'ja', 'es', 'fr', 'de', 'nl', 'cs'];

/** Languages that get cognate detection (after normalization). */
const COGNATE_LANGS = new Set(['de', 'nl', 'es', 'fr']);

/** Korean — skip normalization, just report. */
const SKIP_LANGS = new Set(['ko']);

const ALL_LANGS = [...NORMALIZABLE_LANGS, 'ko'];

const MAX_ANSWER_LEN = 45;
const MIN_AFTER_TRUNCATE = 8;
const MAX_COGNATE_DISTANCE = 2;
const MIN_COGNATE_LENGTH = 4;

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isWrite = args.includes('--write');
const langArg = args.find((a) => a.startsWith('--lang='));
const singleLang = langArg ? langArg.split('=')[1] : null;

if (!isDryRun && !isWrite) {
  console.error('ERROR: Must specify either --dry-run or --write');
  console.error('Usage: node normalize-vocab-answers.mjs [--dry-run | --write] [--lang=xx]');
  process.exit(1);
}

if (isDryRun && isWrite) {
  console.error('ERROR: Cannot specify both --dry-run and --write');
  process.exit(1);
}

if (singleLang && !ALL_LANGS.includes(singleLang)) {
  console.error(`ERROR: Unknown language "${singleLang}". Valid options: ${ALL_LANGS.join(', ')}`);
  process.exit(1);
}

const langsToProcess = singleLang ? [singleLang] : ALL_LANGS;

// ---------------------------------------------------------------------------
// Levenshtein distance (simple iterative implementation — no deps)
// ---------------------------------------------------------------------------

/**
 * Compute Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  // Allocate two rows
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// ---------------------------------------------------------------------------
// Normalization Steps
// ---------------------------------------------------------------------------

/**
 * Step 2: Strip parenthetical clarifications.
 * Removes ALL (...) blocks from the answer, iteratively.
 * Also strips " — context" suffixes.
 * Returns the stripped string, or the original if result < 2 chars.
 *
 * @param {string} answer
 * @returns {string}
 */
function stripParentheticals(answer) {
  let result = answer;

  // Strip " — " and everything after (em dash or double-hyphen used as separator)
  const dashIdx = result.indexOf(' — ');
  if (dashIdx !== -1) {
    const candidate = result.slice(0, dashIdx).trim();
    if (candidate.length >= 2) {
      result = candidate;
    }
  }
  // Also handle " - " only if it looks like a separator (i.e., not part of a word)
  // We skip this — " - " is too common in legitimate compound answers.

  // Remove ALL (...) blocks iteratively.
  // We loop because some answers have nested or sequential parens.
  let prevResult;
  do {
    prevResult = result;
    // Match outermost (...) — using a non-greedy match, strip the whole block
    // and any surrounding whitespace that becomes orphaned.
    result = result.replace(/\s*\([^()]*\)\s*/g, ' ').trim();
    // Re-trim any double spaces
    result = result.replace(/\s{2,}/g, ' ').trim();
    // Fix orphaned commas/semicolons left after paren removal (e.g., "word , more" → "word, more")
    result = result.replace(/\s+([,;])/g, '$1').trim();
    // Remove trailing punctuation left after stripping (e.g., trailing comma)
    result = result.replace(/[,;]\s*$/, '').trim();
  } while (result !== prevResult && result.includes('('));

  // Guard: if result ended up too short, revert
  if (result.length < 2) {
    return answer;
  }

  return result;
}

/**
 * Step 3: Take first meaning before semicolons.
 * Splits on `;` and returns first segment, trimmed.
 * Does NOT split on commas.
 *
 * @param {string} answer
 * @returns {string}
 */
function takeFirstSemicolon(answer) {
  const semicolonIdx = answer.indexOf(';');
  if (semicolonIdx === -1) return answer;
  const first = answer.slice(0, semicolonIdx).trim();
  // Guard: if first segment is too short (e.g., a single tilde prefix), keep original
  if (first.length < 2) return answer;
  return first;
}

/**
 * Step 4: Cap at 45 characters.
 * Truncates at last word boundary before MAX_ANSWER_LEN.
 * Adds "..." if truncated.
 * Skips truncation if result would be < MIN_AFTER_TRUNCATE chars.
 *
 * @param {string} answer
 * @returns {string}
 */
function capLength(answer) {
  if (answer.length <= MAX_ANSWER_LEN) return answer;

  // Find last space at or before MAX_ANSWER_LEN
  const slice = answer.slice(0, MAX_ANSWER_LEN);
  const lastSpace = slice.lastIndexOf(' ');

  let truncated;
  if (lastSpace === -1) {
    // No word boundary found — truncate hard
    truncated = slice;
  } else {
    truncated = slice.slice(0, lastSpace).trim();
    // Remove trailing punctuation
    truncated = truncated.replace(/[,;:]\s*$/, '').trim();
  }

  // Guard: if truncated too short, skip
  if (truncated.length < MIN_AFTER_TRUNCATE) {
    return answer;
  }

  return truncated + '...';
}

/**
 * Apply the full normalization pipeline for a single answer (non-Korean).
 * Returns `{ normalized, wasModified }`.
 *
 * @param {string} original
 * @returns {{ normalized: string, wasModified: boolean }}
 */
function normalizeAnswer(original) {
  let s = original;

  // Step 2: Strip parentheticals
  s = stripParentheticals(s);

  // Step 3: First meaning before semicolons
  s = takeFirstSemicolon(s);

  // Step 4: Cap at 45 chars
  s = capLength(s);

  return { normalized: s, wasModified: s !== original };
}

// ---------------------------------------------------------------------------
// Step 5: Cognate Detection
// ---------------------------------------------------------------------------

/**
 * Extract the quoted foreign word from a quizQuestion like:
 *   What does "Abend" mean?
 *   What does "的" (de) mean?
 *
 * @param {string} question
 * @returns {string|null}
 */
function extractForeignWord(question) {
  const match = question.match(/[""]([^"""]+)[""]/);
  return match ? match[1].trim() : null;
}

/**
 * Check if normalized answer is a cognate of the foreign word.
 * A cognate here means: the answer IS essentially the same word (borrowed),
 * i.e., case-insensitive exact match or Levenshtein distance ≤ 2 and both > 4 chars.
 *
 * @param {string} foreignWord
 * @param {string} normalizedAnswer
 * @returns {boolean}
 */
function isCognate(foreignWord, normalizedAnswer) {
  if (!foreignWord || foreignWord.length <= MIN_COGNATE_LENGTH) return false;
  if (normalizedAnswer.length <= MIN_COGNATE_LENGTH) return false;

  const fw = foreignWord.toLowerCase();
  const na = normalizedAnswer.toLowerCase();

  if (fw === na) return true;

  const dist = levenshtein(fw, na);
  return dist <= MAX_COGNATE_DISTANCE;
}

// ---------------------------------------------------------------------------
// Statistics Helpers
// ---------------------------------------------------------------------------

/**
 * Compute percentile from a sorted array of numbers.
 * @param {number[]} sorted
 * @param {number} p  0–100
 * @returns {number}
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

/**
 * Compute length distribution stats from an array of strings.
 * @param {string[]} answers
 * @returns {{ median: number, p90: number, p99: number, max: number }}
 */
function lengthStats(answers) {
  const lengths = answers.map((a) => a.length).sort((a, b) => a - b);
  return {
    median: percentile(lengths, 50),
    p90: percentile(lengths, 90),
    p99: percentile(lengths, 99),
    max: lengths[lengths.length - 1] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Per-Language Processing
// ---------------------------------------------------------------------------

/**
 * Process a single language seed file.
 * @param {string} lang
 * @returns {{ lang: string, results: object }}
 */
function processLanguage(lang) {
  const filePath = resolve(SEED_DIR, `vocab-${lang}.json`);
  let facts;
  try {
    facts = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`ERROR: Could not read ${filePath}: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(facts)) {
    console.error(`ERROR: Expected array in ${filePath}`);
    process.exit(1);
  }

  // Korean — skip normalization, just report
  if (SKIP_LANGS.has(lang)) {
    const longCount = facts.filter((f) => (f.correctAnswer ?? '').length > MAX_ANSWER_LEN).length;
    return {
      lang,
      total: facts.length,
      modified: 0,
      longCount,
      skipped: true,
      cognatesDetected: 0,
      samples: [],
      beforeStats: lengthStats(facts.map((f) => f.correctAnswer ?? '')),
      afterStats: lengthStats(facts.map((f) => f.correctAnswer ?? '')),
      updatedFacts: facts,
    };
  }

  const doCognate = COGNATE_LANGS.has(lang);
  const updatedFacts = [];
  let modifiedCount = 0;
  let cognatesDetected = 0;
  const samples = [];
  const beforeAnswers = [];
  const afterAnswers = [];

  for (const fact of facts) {
    const original = fact.correctAnswer ?? '';
    beforeAnswers.push(original);

    const { normalized, wasModified } = normalizeAnswer(original);
    afterAnswers.push(normalized);

    let updatedFact = { ...fact };

    if (wasModified) {
      modifiedCount++;
      // Save original to fullDefinition (only if not already set)
      if (!updatedFact.fullDefinition) {
        updatedFact.fullDefinition = original;
      }
      updatedFact.correctAnswer = normalized;

      // Collect sample transformations (first 5)
      if (samples.length < 5) {
        samples.push({ before: original, after: normalized });
      }
    }

    // Step 5: Cognate detection for applicable languages
    if (doCognate && fact.quizQuestion) {
      const foreignWord = extractForeignWord(fact.quizQuestion);
      if (foreignWord && isCognate(foreignWord, normalized)) {
        if (!updatedFact.cognate) {
          updatedFact.cognate = true;
          cognatesDetected++;
        }
      }
    }

    updatedFacts.push(updatedFact);
  }

  return {
    lang,
    total: facts.length,
    modified: modifiedCount,
    longCount: facts.filter((f) => (f.correctAnswer ?? '').length > MAX_ANSWER_LEN).length,
    skipped: false,
    cognatesDetected,
    samples,
    beforeStats: lengthStats(beforeAnswers),
    afterStats: lengthStats(afterAnswers),
    updatedFacts,
    filePath,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Print a formatted summary for one language result.
 * @param {object} result
 */
function printSummary(result) {
  const { lang, total, modified, longCount, skipped, cognatesDetected, samples, beforeStats, afterStats } = result;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(` Language: ${lang.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total facts:          ${total}`);

  if (skipped) {
    console.log(`  Status:               SKIPPED (Korean — needs LLM rewrite)`);
    console.log(`  Facts needing fix:    ${longCount} (>${MAX_ANSWER_LEN} chars, ${((longCount / total) * 100).toFixed(1)}%)`);
    console.log(`\n  Length distribution (before, no changes applied):`);
    console.log(`    median=${beforeStats.median}  p90=${beforeStats.p90}  p99=${beforeStats.p99}  max=${beforeStats.max}`);
    return;
  }

  console.log(`  Facts modified:       ${modified} (${((modified / total) * 100).toFixed(1)}%)`);
  console.log(`  Long answers (>${MAX_ANSWER_LEN}):  before=${longCount}, after=${afterStats.max > MAX_ANSWER_LEN ? result.updatedFacts.filter((f) => (f.correctAnswer ?? '').length > MAX_ANSWER_LEN).length : 0}`);
  if (COGNATE_LANGS.has(lang)) {
    console.log(`  Cognates detected:    ${cognatesDetected}`);
  }

  console.log(`\n  Length distribution:`);
  console.log(`    Before: median=${beforeStats.median}  p90=${beforeStats.p90}  p99=${beforeStats.p99}  max=${beforeStats.max}`);
  console.log(`    After:  median=${afterStats.median}  p90=${afterStats.p90}  p99=${afterStats.p99}  max=${afterStats.max}`);

  if (samples.length > 0) {
    console.log(`\n  Sample transformations:`);
    for (const { before, after } of samples) {
      console.log(`    BEFORE [${before.length}]: ${before}`);
      console.log(`    AFTER  [${after.length}]: ${after}`);
      console.log('');
    }
  } else {
    console.log(`\n  No changes needed — all answers already normalized.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`\nRecall Rogue — Vocab Answer Normalizer`);
console.log(`Mode:  ${isDryRun ? 'DRY RUN (no files written)' : 'WRITE (files will be updated)'}`);
console.log(`Langs: ${langsToProcess.join(', ')}`);

const results = [];

for (const lang of langsToProcess) {
  const result = processLanguage(lang);
  results.push(result);
  printSummary(result);
}

// ---------------------------------------------------------------------------
// Write files if --write
// ---------------------------------------------------------------------------

if (isWrite) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` Writing files...`);
  console.log(`${'═'.repeat(60)}`);

  for (const result of results) {
    if (result.skipped) {
      console.log(`  ${result.lang}: SKIPPED (Korean)`);
      continue;
    }
    if (result.modified === 0 && result.cognatesDetected === 0) {
      console.log(`  ${result.lang}: no changes — skipping write`);
      continue;
    }
    try {
      writeFileSync(result.filePath, JSON.stringify(result.updatedFacts, null, 2) + '\n', 'utf8');
      console.log(`  ${result.lang}: wrote ${result.filePath}`);
    } catch (err) {
      console.error(`  ${result.lang}: ERROR writing file: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Grand summary
// ---------------------------------------------------------------------------

console.log(`\n${'═'.repeat(60)}`);
console.log(` Grand Summary`);
console.log(`${'═'.repeat(60)}`);

let totalFacts = 0;
let totalModified = 0;
let totalCognates = 0;

for (const r of results) {
  totalFacts += r.total;
  totalModified += r.modified;
  totalCognates += r.cognatesDetected;
}

console.log(`  Total facts processed: ${totalFacts}`);
console.log(`  Total facts modified:  ${totalModified} (${((totalModified / totalFacts) * 100).toFixed(1)}%)`);
console.log(`  Total cognates found:  ${totalCognates}`);
console.log(`  Mode: ${isDryRun ? 'DRY RUN — no files written' : 'WRITE — files updated'}`);
console.log('');
