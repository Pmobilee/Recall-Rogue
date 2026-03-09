/**
 * build-facts-db.mjs
 *
 * Reads all *.json seed files from src/data/seed/, inserts every Fact object
 * into a SQLite database, and writes the result to public/facts.db.
 *
 * Usage:  node scripts/build-facts-db.mjs
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
const SEED_DIR   = path.join(ROOT, 'src', 'data', 'seed');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DB       = path.join(PUBLIC_DIR, 'facts.db');
const OUT_SEED_PACK = path.join(PUBLIC_DIR, 'seed-pack.json');
const WASM_PATH  = path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

// ---------------------------------------------------------------------------
// Bootstrap sql.js (WASM build — works in Node.js without extra native deps)
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url);
const initSqlJs = require(
  path.join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js')
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const DDL = `
CREATE TABLE IF NOT EXISTS facts (
  id               TEXT    PRIMARY KEY,
  type             TEXT    NOT NULL,
  statement        TEXT    NOT NULL,
  wow_factor       TEXT,
  explanation      TEXT    NOT NULL,
  gaia_comment     TEXT,
  quiz_question    TEXT    NOT NULL,
  correct_answer   TEXT    NOT NULL,
  distractors      TEXT    NOT NULL,
  category         TEXT    NOT NULL,
  rarity           TEXT    NOT NULL,
  difficulty       INTEGER NOT NULL,
  fun_score        INTEGER NOT NULL,
  age_rating       TEXT    NOT NULL,
  source_name      TEXT,
  language         TEXT,
  pronunciation    TEXT,
  example_sentence TEXT,
  image_url        TEXT,
  mnemonic         TEXT,
  status            TEXT    DEFAULT 'approved',
  alternate_explanations TEXT,
  gaia_comments     TEXT,
  gaia_wrong_comments TEXT,
  acceptable_answers TEXT,
  distractor_count  INTEGER DEFAULT 0,
  category_l1       TEXT    DEFAULT '',
  category_l2       TEXT    DEFAULT '',
  category_l3       TEXT    DEFAULT '',
  novelty_score     INTEGER DEFAULT 5,
  sensitivity_level INTEGER DEFAULT 0,
  sensitivity_note  TEXT,
  content_volatility TEXT   DEFAULT 'timeless',
  source_url        TEXT,
  verified_at       TEXT,
  in_game_reports   INTEGER DEFAULT 0,
  related_facts     TEXT,
  tags              TEXT,
  image_prompt      TEXT,
  visual_description TEXT,
  has_pixel_art     INTEGER DEFAULT 0,
  pixel_art_status  TEXT    DEFAULT 'none',
  variants          TEXT,
  db_version        INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_facts_type       ON facts(type);
CREATE INDEX IF NOT EXISTS idx_facts_rarity     ON facts(rarity);
CREATE INDEX IF NOT EXISTS idx_facts_difficulty ON facts(difficulty);
CREATE INDEX IF NOT EXISTS idx_facts_age_rating ON facts(age_rating);
CREATE INDEX IF NOT EXISTS idx_facts_status       ON facts(status);
CREATE INDEX IF NOT EXISTS idx_facts_category_l1  ON facts(category_l1);
CREATE INDEX IF NOT EXISTS idx_facts_db_version   ON facts(db_version);
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a camelCase Fact object to the snake_case column values expected by
 * the INSERT statement.  Arrays are JSON-stringified; missing optional fields
 * become null.
 *
 * @param {Record<string, unknown>} fact - Raw fact object from seed JSON.
 * @returns {unknown[]} Ordered parameter array matching the INSERT columns.
 */
function factToRow(fact) {
  return [
    fact.id               ?? null,
    fact.type             ?? null,
    fact.statement        ?? null,
    fact.wowFactor        ?? null,
    fact.explanation      ?? null,
    fact.gaiaComment      ?? null,
    fact.quizQuestion     ?? null,
    fact.correctAnswer    ?? null,
    JSON.stringify(fact.distractors ?? []),
    JSON.stringify(fact.category    ?? []),
    fact.rarity           ?? null,
    fact.difficulty       ?? null,
    fact.funScore         ?? null,
    fact.ageRating        ?? null,
    fact.sourceName       ?? null,
    fact.language         ?? null,
    fact.pronunciation    ?? null,
    fact.exampleSentence  ?? null,
    fact.imageUrl         ?? null,
    fact.mnemonic         ?? null,
    // Phase 11 extended fields — default-safe for old seed data
    fact.status                                                     ?? 'approved',
    fact.alternateExplanations ? JSON.stringify(fact.alternateExplanations) : null,
    fact.gaiaComments          ? JSON.stringify(fact.gaiaComments)          : null,
    fact.gaiaWrongComments     ? JSON.stringify(fact.gaiaWrongComments)     : null,
    fact.acceptableAnswers     ? JSON.stringify(fact.acceptableAnswers)     : null,
    fact.distractorCount       ?? 0,
    fact.categoryL1            ?? '',
    fact.categoryL2            ?? '',
    fact.categoryL3            ?? '',
    fact.noveltyScore          ?? 5,
    fact.sensitivityLevel      ?? 0,
    fact.sensitivityNote       ?? null,
    fact.contentVolatility     ?? 'timeless',
    fact.sourceUrl             ?? null,
    fact.verifiedAt            ?? null,
    fact.inGameReports         ?? 0,
    fact.relatedFacts          ? JSON.stringify(fact.relatedFacts)          : null,
    fact.tags                  ? JSON.stringify(fact.tags)                  : null,
    fact.imagePrompt           ?? null,
    fact.visualDescription     ?? null,
    fact.hasPixelArt           ? 1 : 0,
    fact.pixelArtStatus        ?? 'none',
    fact.variants              ? JSON.stringify(fact.variants) : null,
    fact.dbVersion             ?? 0,
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // -- Initialise sql.js with the WASM binary read from disk --
  let wasmBinary;
  try {
    wasmBinary = fs.readFileSync(WASM_PATH);
  } catch (err) {
    console.error(`[ERROR] Could not read sql.js WASM binary at ${WASM_PATH}`);
    console.error(err.message);
    process.exit(1);
  }

  const SQL = await initSqlJs({ wasmBinary });
  const db  = new SQL.Database();

  // -- Create schema --
  db.run(DDL);

  // -- Discover seed files --
  let seedFiles;
  try {
    // Read top-level seed files
    seedFiles = fs.readdirSync(SEED_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(SEED_DIR, f));

  } catch (err) {
    console.error(`[ERROR] Could not read seed directory: ${SEED_DIR}`);
    console.error(err.message);
    process.exit(1);
  }

  if (seedFiles.length === 0) {
    console.warn('[WARN] No *.json files found in', SEED_DIR);
  }

  // -- Prepare INSERT statement --
  const INSERT = db.prepare(`
    INSERT OR REPLACE INTO facts (
      id, type, statement, wow_factor, explanation, gaia_comment,
      quiz_question, correct_answer, distractors, category,
      rarity, difficulty, fun_score, age_rating,
      source_name, language, pronunciation, example_sentence,
      image_url, mnemonic,
      status, alternate_explanations, gaia_comments, gaia_wrong_comments,
      acceptable_answers, distractor_count,
      category_l1, category_l2, category_l3,
      novelty_score, sensitivity_level, sensitivity_note,
      content_volatility, source_url, verified_at, in_game_reports,
      related_facts, tags, image_prompt, visual_description,
      has_pixel_art, pixel_art_status, variants, db_version
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  let totalFacts = 0;

  // -- Process each seed file --
  for (const filePath of seedFiles) {
    const relPath = path.relative(ROOT, filePath);
    let facts;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      facts = JSON.parse(raw);
    } catch (err) {
      console.error(`[ERROR] Failed to parse ${relPath}: ${err.message}`);
      process.exit(1);
    }

    if (!Array.isArray(facts)) {
      console.error(`[ERROR] ${relPath} must export a JSON array at top level`);
      process.exit(1);
    }

    // Wrap all inserts for this file in a single transaction for speed.
    db.run('BEGIN');
    try {
      for (const fact of facts) {
        INSERT.run(factToRow(fact));
      }
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      console.error(`[ERROR] Insert failed while processing ${relPath}: ${err.message}`);
      process.exit(1);
    }

    console.log(`  [OK] ${relPath} — ${facts.length} facts`);
    totalFacts += facts.length;
  }

  INSERT.free();

  // -- Write database to disk --
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const exported = db.export(); // Uint8Array
  fs.writeFileSync(OUT_DB, Buffer.from(exported));

  // -- Export seed-pack.json for offline FactPackService bootstrap --
  // Re-query all facts from the just-built database and format as a FactPack
  // so the client can serve quiz content without a network call on first run.
  const seedStmt = db.prepare(
    `SELECT
      id, quiz_question, correct_answer, distractors,
      gaia_comment, gaia_comments, explanation, category_l1,
      novelty_score
     FROM facts
     WHERE status = 'approved' OR status IS NULL
     ORDER BY category_l1 ASC, id ASC`
  );
  const seedRows = [];
  while (seedStmt.step()) {
    seedRows.push(seedStmt.getAsObject());
  }
  seedStmt.free();

  const seedFacts = seedRows.map(row => {
    let distractors = [];
    try {
      if (row['distractors']) {
        const parsed = JSON.parse(String(row['distractors']));
        if (Array.isArray(parsed)) distractors = parsed.map(String);
      }
    } catch { /* ignore */ }

    let gaiaComment = '';
    if (row['gaia_comments']) {
      try {
        const pool = JSON.parse(String(row['gaia_comments']));
        if (Array.isArray(pool) && pool.length > 0) gaiaComment = String(pool[0]);
      } catch { /* fall through */ }
    }
    if (!gaiaComment && row['gaia_comment']) gaiaComment = String(row['gaia_comment']);

    return {
      id:          String(row['id']),
      question:    String(row['quiz_question'] ?? ''),
      answer:      String(row['correct_answer'] ?? ''),
      distractors,
      gaiaComment,
      explanation: String(row['explanation'] ?? ''),
      category:    String(row['category_l1'] ?? ''),
      wowFactor:   Number(row['novelty_score'] ?? 5),
    };
  });

  const seedPack = {
    packId:    'seed-v1',
    category:  'all',
    version:   1,
    factCount: seedFacts.length,
    facts:     seedFacts,
  };

  fs.writeFileSync(OUT_SEED_PACK, JSON.stringify(seedPack, null, 2));

  db.close();

  const sizeKb     = (fs.statSync(OUT_DB).size        / 1024).toFixed(1);
  const packSizeKb = (fs.statSync(OUT_SEED_PACK).size / 1024).toFixed(1);
  console.log('');
  console.log('Build complete:');
  console.log(`  Files processed : ${seedFiles.length}`);
  console.log(`  Total facts     : ${totalFacts}`);
  console.log(`  Output          : ${path.relative(ROOT, OUT_DB)} (${sizeKb} KB)`);
  console.log(`  Seed pack       : ${path.relative(ROOT, OUT_SEED_PACK)} (${packSizeKb} KB) — ${seedFacts.length} facts`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
