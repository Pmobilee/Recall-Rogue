#!/usr/bin/env node
/**
 * semantic-dedup.mjs
 *
 * Finds and removes semantic duplicate facts in the knowledge facts database.
 *
 * Algorithm:
 *  1. Read all knowledge facts from public/facts.db (WHERE type = 'knowledge')
 *  2. For each fact, build a "knowledge fingerprint":
 *     - normalize the correct_answer
 *     - extract key nouns from quiz_question (words > 4 chars, lowercased, sorted)
 *     - extract key nouns from statement (for secondary cross-check)
 *  3. Group facts sharing the same normalized correct_answer AND:
 *     - question noun Jaccard > 0.5, AND
 *     - statement noun Jaccard > 0.3 (guards against different sub-topics with same answer+entity)
 *  4. Group facts with very similar questions (Jaccard > 0.7 on all words > 3 chars)
 *     AND matching normalized answers.
 *  5. For each group, keep the BEST fact:
 *     most distractors > longer explanation > source_verified > longer ID
 *  6. Print dry-run output; accept --apply flag to actually delete
 *
 * Usage:
 *   node scripts/semantic-dedup.mjs            # dry run
 *   node scripts/semantic-dedup.mjs --apply    # actually delete duplicates
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'public', 'facts.db');
const APPLY = process.argv.includes('--apply');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip brace markers like {300}, lowercase, trim punctuation */
function normalizeAnswer(ans) {
  if (!ans) return '';
  return ans
    .replace(/\{([^}]+)\}/g, '$1')   // {300} -> 300
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Return a Set of words longer than minLen from a string */
function wordSet(str, minLen = 4) {
  if (!str) return new Set();
  return new Set(
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > minLen)
  );
}

/** Jaccard similarity between two Sets */
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Check if two normalized answers are "the same" — exact match, or one
 * contains the other (handles "{26} countries" vs "26").
 */
function answersMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // One is a substring of the other (e.g. "26" inside "26 countries")
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/** Score a fact for "quality" — higher is better (keep this one) */
function qualityScore(fact) {
  let score = 0;
  // Number of distractors (parsed from JSON array or comma list)
  try {
    const d = JSON.parse(fact.distractors || '[]');
    score += Array.isArray(d) ? d.length * 10 : 0;
  } catch {
    score += (fact.distractors || '').split(',').filter(Boolean).length * 10;
  }
  // distractor_count column
  score += (fact.distractor_count || 0) * 10;
  // Explanation length (longer = more informative)
  score += Math.min((fact.explanation || '').length / 20, 20);
  // Statement length
  score += Math.min((fact.statement || '').length / 30, 10);
  // Verified source bonus
  score += (fact.source_verified || 0) * 5;
  // Longer ID usually means newer pipeline with better content
  score += Math.min((fact.id || '').length / 5, 5);
  return score;
}

// ---------------------------------------------------------------------------
// Union-Find for grouping
// ---------------------------------------------------------------------------

class UnionFind {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    if (this.parent.get(x) !== x) this.parent.set(x, this.find(this.parent.get(x)));
    return this.parent.get(x);
  }
  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx !== ry) this.parent.set(rx, ry);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const db = new Database(DB_PATH, { readonly: APPLY ? false : true });

console.log(`\n=== Semantic Dedup — ${APPLY ? 'APPLY MODE' : 'DRY RUN'} ===`);
console.log(`Database: ${DB_PATH}\n`);

const facts = db.prepare("SELECT * FROM facts WHERE type = 'knowledge'").all();
console.log(`Loaded ${facts.length} knowledge facts`);

// Precompute fingerprints
const fingerprints = facts.map(f => ({
  id: f.id,
  fact: f,
  normAnswer: normalizeAnswer(f.correct_answer),
  questionNouns: wordSet(f.quiz_question, 4),   // words > 4 chars (len >= 5)
  questionWords: wordSet(f.quiz_question, 3),   // words > 3 chars (len >= 4)
  statementNouns: wordSet(f.statement, 4),      // statement nouns for cross-check
  score: qualityScore(f),
}));

console.log('Building fingerprint index...');

// Index by normalized answer for fast grouping
const byAnswer = new Map();
for (const fp of fingerprints) {
  if (!fp.normAnswer) continue;
  if (!byAnswer.has(fp.normAnswer)) byAnswer.set(fp.normAnswer, []);
  byAnswer.get(fp.normAnswer).push(fp);
}

const uf = new UnionFind();

let answerGroupChecks = 0;
let questionOnlyChecks = 0;
let answerGroupMatches = 0;
let questionOnlyMatches = 0;

// Pass 1: Same normalized answer + question noun Jaccard > 0.5
//   + statement noun Jaccard > 0.3 (prevents different sub-topics
//     with same answer entity from grouping — e.g. "largest population"
//     vs "second largest by land area" both answered "Yemen")
console.log('Pass 1: same-answer + question noun sim (J>0.5) + statement sim (J>0.3)...');
for (const [, group] of byAnswer) {
  if (group.length < 2) continue;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      answerGroupChecks++;
      const qSim = jaccard(group[i].questionNouns, group[j].questionNouns);
      if (qSim <= 0.5) continue;
      // Secondary guard: statement nouns must also overlap meaningfully
      const sSim = jaccard(group[i].statementNouns, group[j].statementNouns);
      if (sSim <= 0.3) continue;
      uf.union(group[i].id, group[j].id);
      answerGroupMatches++;
    }
  }
}
console.log(`  Checked ${answerGroupChecks} pairs, found ${answerGroupMatches} matches`);

// Pass 2: Very similar questions (Jaccard > 0.7 on all words > 3 chars)
//   + matching normalized answers
//   + statement noun Jaccard > 0.3
//
// Bucket by shared question words to avoid O(n²).
console.log('Pass 2: question similarity (J>0.7) + matching answers + statement sim...');
const wordIndex = new Map();
for (let i = 0; i < fingerprints.length; i++) {
  for (const w of fingerprints[i].questionWords) {
    if (!wordIndex.has(w)) wordIndex.set(w, []);
    wordIndex.get(w).push(i);
  }
}

const checkedPairs = new Set();
for (const [, indices] of wordIndex) {
  if (indices.length < 2 || indices.length > 200) continue; // skip ultra-common words
  for (let a = 0; a < indices.length; a++) {
    for (let b = a + 1; b < indices.length; b++) {
      const key = indices[a] < indices[b]
        ? `${indices[a]}:${indices[b]}`
        : `${indices[b]}:${indices[a]}`;
      if (checkedPairs.has(key)) continue;
      checkedPairs.add(key);
      questionOnlyChecks++;
      const fA = fingerprints[indices[a]];
      const fB = fingerprints[indices[b]];
      // CRITICAL: require matching answers to avoid false positives
      if (!answersMatch(fA.normAnswer, fB.normAnswer)) continue;
      const qSim = jaccard(fA.questionWords, fB.questionWords);
      if (qSim <= 0.7) continue;
      // Secondary guard: statement nouns must overlap
      const sSim = jaccard(fA.statementNouns, fB.statementNouns);
      if (sSim <= 0.3) continue;
      uf.union(fA.id, fB.id);
      questionOnlyMatches++;
    }
  }
}
console.log(`  Checked ${questionOnlyChecks} candidate pairs, found ${questionOnlyMatches} matches`);

// Collect groups
const groups = new Map();
for (const fp of fingerprints) {
  const root = uf.find(fp.id);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(fp);
}

// Filter to groups with > 1 member
const dupGroups = [...groups.values()].filter(g => g.length > 1);
console.log(`\nFound ${dupGroups.length} duplicate groups\n`);

if (dupGroups.length === 0) {
  console.log('No semantic duplicates found. Database is clean.');
  db.close();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Print groups and determine deletions
// ---------------------------------------------------------------------------

const toDelete = [];
let totalKept = 0;
let totalDeleted = 0;

for (let gi = 0; gi < dupGroups.length; gi++) {
  const group = dupGroups[gi];
  // Sort: best first
  group.sort((a, b) => b.score - a.score);
  const keep = group[0];
  const remove = group.slice(1);

  totalKept++;
  totalDeleted += remove.length;

  console.log(`--- Group ${gi + 1} (${group.length} facts) ---`);
  console.log(`  KEEP  [score=${keep.score.toFixed(1)}] ${keep.id}`);
  console.log(`        Q: ${keep.fact.quiz_question}`);
  console.log(`        A: ${keep.fact.correct_answer}`);
  for (const r of remove) {
    console.log(`  DEL   [score=${r.score.toFixed(1)}] ${r.id}`);
    console.log(`        Q: ${r.fact.quiz_question}`);
    console.log(`        A: ${r.fact.correct_answer}`);
    toDelete.push(r.id);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('=== Summary ===');
console.log(`  Total knowledge facts:   ${facts.length}`);
console.log(`  Duplicate groups found:  ${dupGroups.length}`);
console.log(`  Facts to keep (winners): ${totalKept}`);
console.log(`  Facts to DELETE:         ${totalDeleted}`);
console.log(`  Remaining after cleanup: ${facts.length - totalDeleted}`);
console.log();

if (!APPLY) {
  console.log('DRY RUN complete. Re-run with --apply to delete duplicates.');
  db.close();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Apply deletions
// ---------------------------------------------------------------------------

console.log('Applying deletions...');
const deleteStmt = db.prepare('DELETE FROM facts WHERE id = ?');
const deleteAll = db.transaction((ids) => {
  let count = 0;
  for (const id of ids) {
    const result = deleteStmt.run(id);
    if (result.changes > 0) count++;
  }
  return count;
});

const deleted = deleteAll(toDelete);
console.log(`Deleted ${deleted} facts from database.`);

const remaining = db.prepare("SELECT COUNT(*) as n FROM facts WHERE type = 'knowledge'").get();
console.log(`Knowledge facts remaining: ${remaining.n}`);

db.close();
console.log('\nDone.');
