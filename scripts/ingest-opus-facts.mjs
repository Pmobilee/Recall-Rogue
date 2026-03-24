#!/usr/bin/env node
/**
 * ingest-opus-facts.mjs
 * Ingests data/ingest-batches/all-opus-facts.json into public/facts.db
 * Maps the rich schema fields to the DB columns that exist in the facts table.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DB_PATH   = resolve(ROOT, 'public/facts.db');
const JSON_PATH = resolve(ROOT, 'data/ingest-batches/all-opus-facts.json');

// ── Load source data ─────────────────────────────────────────────────────────
const facts = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
console.log(`Loaded ${facts.length} facts from ${JSON_PATH}`);

// ── Open DB ──────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

// ── Prepare INSERT OR REPLACE ─────────────────────────────────────────────────
const stmt = db.prepare(`
  INSERT OR REPLACE INTO facts (
    id,
    type,
    statement,
    wow_factor,
    explanation,
    quiz_question,
    correct_answer,
    distractors,
    distractor_count,
    category,
    category_l1,
    category_l2,
    category_l3,
    difficulty,
    fun_score,
    age_rating,
    rarity,
    source_name,
    source_url,
    source_verified,
    status,
    novelty_score,
    sensitivity_level,
    sensitivity_note,
    content_volatility,
    visual_description,
    tags,
    acceptable_answers,
    variants
  ) VALUES (
    @id,
    @type,
    @statement,
    @wow_factor,
    @explanation,
    @quiz_question,
    @correct_answer,
    @distractors,
    @distractor_count,
    @category,
    @category_l1,
    @category_l2,
    @category_l3,
    @difficulty,
    @fun_score,
    @age_rating,
    @rarity,
    @source_name,
    @source_url,
    @source_verified,
    @status,
    @novelty_score,
    @sensitivity_level,
    @sensitivity_note,
    @content_volatility,
    @visual_description,
    @tags,
    @acceptable_answers,
    @variants
  )
`);

// ── Run in a transaction for atomicity + speed ────────────────────────────────
const domainCounts = {};
let insertedCount = 0;

const runAll = db.transaction(() => {
  for (const f of facts) {
    const distractorsArr = Array.isArray(f.distractors) ? f.distractors : [];

    // category JSON array: ["knowledge", categoryL2]
    const categoryL1 = f.categoryL1 || '';
    const categoryL2 = f.categoryL2 || '';
    const category   = JSON.stringify(['knowledge', categoryL2]);

    const row = {
      id:                f.id,
      type:              f.type || 'knowledge',
      statement:         f.statement || '',
      wow_factor:        f.wowFactor || null,
      explanation:       f.explanation || '',
      quiz_question:     f.quizQuestion || '',
      correct_answer:    f.correctAnswer || '',
      distractors:       JSON.stringify(distractorsArr),
      distractor_count:  distractorsArr.length,
      category,
      category_l1:       categoryL1,
      category_l2:       categoryL2,
      category_l3:       f.categoryL3 || '',
      difficulty:        f.difficulty ?? 3,
      fun_score:         f.funScore ?? 5,
      age_rating:        f.ageRating || 'adult',
      rarity:            f.rarity || 'common',
      source_name:       f.sourceName || null,
      source_url:        f.sourceUrl || null,
      source_verified:   f.sourceVerified ? 1 : 0,
      status:            'approved',
      novelty_score:     f.noveltyScore ?? 5,
      sensitivity_level: f.sensitivityLevel ?? 0,
      sensitivity_note:  f.sensitivityNote || null,
      content_volatility: f.contentVolatility || 'timeless',
      visual_description: f.visualDescription || null,
      tags:              f.tags ? JSON.stringify(f.tags) : null,
      acceptable_answers: f.acceptableAnswers ? JSON.stringify(f.acceptableAnswers) : null,
      variants:          f.variants ? JSON.stringify(f.variants) : null,
    };

    stmt.run(row);
    insertedCount++;

    const domain = f.domain || categoryL1 || 'unknown';
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }
});

runAll();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nInserted/replaced ${insertedCount} facts.\n`);
console.log('By domain:');
const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
for (const [domain, count] of sorted) {
  console.log(`  ${count.toString().padStart(3)}  ${domain}`);
}

// Verify total in DB
const total = db.prepare("SELECT COUNT(*) as cnt FROM facts WHERE status = 'approved'").get();
console.log(`\nTotal approved facts in DB: ${total.cnt}`);

db.close();
