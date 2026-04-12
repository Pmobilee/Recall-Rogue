/**
 * build-curated-db.mjs
 *
 * Reads all curated deck JSON files listed in data/decks/manifest.json and
 * compiles them into a single SQLite database at public/curated.db.
 *
 * Tables produced:
 *   decks            — one row per deck (top-level metadata + JSON blobs)
 *   deck_facts       — every DeckFact, all array fields JSON-stringified
 *   answer_type_pools — every AnswerTypePool per deck
 *   synonym_groups   — every SynonymGroup per deck
 *
 * Usage:  node scripts/build-curated-db.mjs
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
const DECKS_DIR  = path.join(ROOT, 'data', 'decks');
const MANIFEST   = path.join(DECKS_DIR, 'manifest.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DB     = path.join(PUBLIC_DIR, 'curated.db');
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
CREATE TABLE IF NOT EXISTS decks (
  id                 TEXT    PRIMARY KEY,
  name               TEXT    NOT NULL,
  description        TEXT,
  domain             TEXT,
  sub_domain         TEXT,
  minimum_facts      INTEGER,
  target_facts       INTEGER,
  chain_themes       TEXT,   -- JSON array (from deck.chainThemes if present)
  sub_decks          TEXT,   -- JSON array (from deck.subDecks if present)
  question_templates TEXT,   -- JSON array
  difficulty_tiers   TEXT,   -- JSON array
  metadata           TEXT    -- JSON blob for any extra top-level fields
);

CREATE TABLE IF NOT EXISTS deck_facts (
  id                     TEXT    PRIMARY KEY,
  deck_id                TEXT    NOT NULL,
  correct_answer         TEXT    NOT NULL,
  quiz_question          TEXT    NOT NULL,
  explanation            TEXT,
  grammar_note           TEXT,
  display_as_full_form   INTEGER DEFAULT 0,
  full_form_display      TEXT,
  difficulty             INTEGER,
  fun_score              INTEGER,
  chain_theme_id         INTEGER,
  sub_deck               TEXT,
  answer_type_pool_id    TEXT,
  quiz_mode              TEXT,
  quiz_response_mode     TEXT,
  image_asset_path       TEXT,
  visual_description     TEXT,
  source_name            TEXT,
  source_url             TEXT,
  volatile               INTEGER DEFAULT 0,
  distractors            TEXT,   -- JSON array
  acceptable_alternatives TEXT,  -- JSON array
  synonym_group_id       TEXT,
  target_language_word   TEXT,
  reading                TEXT,
  language               TEXT,
  pronunciation          TEXT,
  part_of_speech         TEXT,
  exam_tags              TEXT,   -- JSON array
  sentence_furigana      TEXT,   -- JSON array of baked furigana segments
  sentence_romaji        TEXT,
  sentence_translation   TEXT,
  grammar_point_label    TEXT,
  category_l1            TEXT,
  category_l2            TEXT,
  fen_position           TEXT,
  solution_moves         TEXT,
  tactic_theme           TEXT,
  lichess_rating         INTEGER,
  map_coordinates        TEXT,    -- JSON [lat, lng] tuple
  map_region             TEXT,
  map_difficulty_tier    INTEGER,
  FOREIGN KEY (deck_id) REFERENCES decks(id)
);

CREATE TABLE IF NOT EXISTS answer_type_pools (
  id                   TEXT    NOT NULL,
  deck_id              TEXT    NOT NULL,
  label                TEXT,
  answer_format        TEXT,
  fact_ids             TEXT,   -- JSON array
  minimum_size         INTEGER DEFAULT 5,
  synthetic_distractors TEXT,  -- JSON array
  PRIMARY KEY (id, deck_id),
  FOREIGN KEY (deck_id) REFERENCES decks(id)
);

CREATE TABLE IF NOT EXISTS synonym_groups (
  id       TEXT NOT NULL,
  deck_id  TEXT NOT NULL,
  fact_ids TEXT,  -- JSON array
  reason   TEXT,
  PRIMARY KEY (id, deck_id),
  FOREIGN KEY (deck_id) REFERENCES decks(id)
);

CREATE INDEX IF NOT EXISTS idx_deck_facts_deck  ON deck_facts(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_facts_chain ON deck_facts(chain_theme_id);
CREATE INDEX IF NOT EXISTS idx_deck_facts_pool  ON deck_facts(answer_type_pool_id);
CREATE INDEX IF NOT EXISTS idx_pools_deck       ON answer_type_pools(deck_id);
CREATE INDEX IF NOT EXISTS idx_synonym_groups_deck ON synonym_groups(deck_id);
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** JSON-stringify a value only if it's a non-null object or array. */
function jsonOrNull(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/**
 * Maps a DeckFact object to the ordered parameter array for the INSERT.
 *
 * @param {Record<string, unknown>} fact
 * @param {string} deckId
 * @returns {unknown[]}
 */
function factToRow(fact, deckId) {
  return [
    fact.id                                          ?? null,
    deckId,
    fact.correctAnswer                               ?? null,
    fact.quizQuestion                                ?? null,
    fact.explanation                                 ?? null,
    fact.grammarNote                                 ?? null,
    fact.displayAsFullForm ? 1 : 0,
    fact.fullFormDisplay                             ?? null,
    fact.difficulty                                  ?? null,
    fact.funScore                                    ?? null,
    fact.chainThemeId                                ?? null,
    fact.subDeck                                     ?? null,
    fact.answerTypePoolId                            ?? null,
    fact.quizMode                                    ?? null,
    fact.quizResponseMode                            ?? null,
    fact.imageAssetPath                              ?? null,
    fact.visualDescription                           ?? null,
    fact.sourceName                                  ?? null,
    fact.sourceUrl                                   ?? null,
    fact.volatile ? 1 : 0,
    jsonOrNull(fact.distractors                      ?? []),
    jsonOrNull(fact.acceptableAlternatives           ?? []),
    fact.synonymGroupId                              ?? null,
    fact.targetLanguageWord                          ?? null,
    fact.reading                                     ?? null,
    fact.language                                    ?? null,
    fact.pronunciation                               ?? null,
    fact.partOfSpeech                                ?? null,
    jsonOrNull(fact.examTags                         ?? null),
    jsonOrNull(fact.sentenceFurigana                 ?? null),
    fact.sentenceRomaji                              ?? null,
    fact.sentenceTranslation                         ?? null,
    fact.grammarPointLabel                           ?? null,
    fact.categoryL1                                  ?? null,
    fact.categoryL2                                  ?? null,
    fact.fenPosition                                 ?? null,
    jsonOrNull(fact.solutionMoves                    ?? null),
    fact.tacticTheme                                 ?? null,
    fact.lichessRating                               ?? null,
    fact.mapCoordinates  ? JSON.stringify(fact.mapCoordinates) : null,
    fact.mapRegion       ?? null,
    fact.mapDifficultyTier ?? null,
  ];
}

/**
 * Maps a deck's top-level fields to the INSERT parameter array.
 * Extra top-level fields not explicitly mapped are stored as JSON in metadata.
 *
 * @param {Record<string, unknown>} deck
 * @returns {unknown[]}
 */
function deckToRow(deck) {
  // Collect any extra top-level keys not covered by explicit columns
  const knownKeys = new Set([
    'id', 'name', 'description', 'domain', 'subDomain',
    'minimumFacts', 'targetFacts', 'chainThemes', 'subDecks',
    'questionTemplates', 'difficultyTiers',
    'facts', 'answerTypePools', 'synonymGroups',
  ]);
  const extra = {};
  for (const [k, v] of Object.entries(deck)) {
    if (!knownKeys.has(k)) extra[k] = v;
  }

  return [
    deck.id                               ?? null,
    deck.name                             ?? null,
    deck.description                      ?? null,
    deck.domain                           ?? null,
    deck.subDomain                        ?? null,
    deck.minimumFacts                     ?? null,
    deck.targetFacts                      ?? null,
    jsonOrNull(deck.chainThemes           ?? null),
    jsonOrNull(deck.subDecks              ?? null),
    jsonOrNull(deck.questionTemplates     ?? null),
    jsonOrNull(deck.difficultyTiers       ?? null),
    Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
  ];
}

/**
 * Maps an AnswerTypePool to the INSERT parameter array.
 *
 * @param {Record<string, unknown>} pool
 * @param {string} deckId
 * @returns {unknown[]}
 */
function poolToRow(pool, deckId) {
  return [
    pool.id                                    ?? null,
    deckId,
    pool.label                                 ?? null,
    pool.answerFormat                          ?? null,
    jsonOrNull(pool.factIds                    ?? []),
    pool.minimumSize                           ?? 5,
    jsonOrNull(pool.syntheticDistractors       ?? null),
  ];
}

/**
 * Maps a SynonymGroup to the INSERT parameter array.
 *
 * Handles the legacy schema used by ap_world_history.json where groups have
 * { poolId, answer, factIds } instead of { id, factIds, reason }.
 * For legacy groups an id is synthesised from the answer value.
 *
 * @param {Record<string, unknown>} group
 * @param {string} deckId
 * @param {number} index - fallback index used when no id or answer is available
 * @returns {unknown[]}
 */
function synonymGroupToRow(group, deckId, index) {
  // Canonical schema: { id, factIds, reason }
  // Legacy schema:    { poolId, answer, factIds }
  const id = group.id
    ?? (group.answer ? String(group.answer).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : null)
    ?? `auto_${index}`;

  const reason = group.reason
    ?? (group.answer ? `answer: ${group.answer}` : null)
    ?? null;

  return [
    id,
    deckId,
    jsonOrNull(group.factIds ?? []),
    reason,
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

  // -- Read manifest --
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Could not read manifest at ${MANIFEST}: ${err.message}`);
    process.exit(1);
  }

  const deckFiles = manifest.decks ?? [];
  console.log(`[build-curated-db] Loading ${deckFiles.length} decks...`);

  // -- Prepare INSERT statements --
  const INSERT_DECK = db.prepare(`
    INSERT OR REPLACE INTO decks (
      id, name, description, domain, sub_domain,
      minimum_facts, target_facts,
      chain_themes, sub_decks, question_templates, difficulty_tiers,
      metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const INSERT_FACT = db.prepare(`
    INSERT OR REPLACE INTO deck_facts (
      id, deck_id, correct_answer, quiz_question, explanation,
      grammar_note, display_as_full_form, full_form_display,
      difficulty, fun_score, chain_theme_id, sub_deck,
      answer_type_pool_id, quiz_mode, quiz_response_mode,
      image_asset_path, visual_description,
      source_name, source_url, volatile,
      distractors, acceptable_alternatives, synonym_group_id,
      target_language_word, reading, language, pronunciation,
      part_of_speech, exam_tags,
      sentence_furigana, sentence_romaji, sentence_translation, grammar_point_label,
      category_l1, category_l2,
      fen_position, solution_moves, tactic_theme, lichess_rating,
      map_coordinates, map_region, map_difficulty_tier
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const INSERT_POOL = db.prepare(`
    INSERT OR REPLACE INTO answer_type_pools (
      id, deck_id, label, answer_format,
      fact_ids, minimum_size, synthetic_distractors
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const INSERT_SYNONYM = db.prepare(`
    INSERT OR REPLACE INTO synonym_groups (
      id, deck_id, fact_ids, reason
    ) VALUES (?, ?, ?, ?)
  `);

  let totalFacts = 0;
  let totalDecks = 0;

  // -- Process each deck file --
  for (const filename of deckFiles) {
    const filePath = path.join(DECKS_DIR, filename);
    const relPath  = path.relative(ROOT, filePath);
    let deck;

    try {
      deck = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error(`[ERROR] Failed to parse ${relPath}: ${err.message}`);
      process.exit(1);
    }

    if (!deck || typeof deck !== 'object' || !deck.id) {
      console.error(`[ERROR] ${relPath} is not a valid deck object (missing id)`);
      process.exit(1);
    }

    const deckId    = deck.id;
    const facts     = Array.isArray(deck.facts)           ? deck.facts           : [];
    const pools     = Array.isArray(deck.answerTypePools) ? deck.answerTypePools : [];
    const synonyms  = Array.isArray(deck.synonymGroups)   ? deck.synonymGroups   : [];

    // Wrap all inserts for this deck in a single transaction for speed.
    db.run('BEGIN');
    try {
      // Insert deck row
      INSERT_DECK.run(deckToRow(deck));

      // Insert all facts
      for (const fact of facts) {
        INSERT_FACT.run(factToRow(fact, deckId));
      }

      // Insert all answer type pools
      for (const pool of pools) {
        INSERT_POOL.run(poolToRow(pool, deckId));
      }

      // Insert all synonym groups
      for (let i = 0; i < synonyms.length; i++) {
        INSERT_SYNONYM.run(synonymGroupToRow(synonyms[i], deckId, i));
      }

      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      console.error(`[ERROR] Insert failed while processing ${relPath}: ${err.message}`);
      process.exit(1);
    }

    console.log(`  [OK] ${relPath} — ${facts.length} facts, ${pools.length} pools, ${synonyms.length} synonym groups`);
    totalFacts += facts.length;
    totalDecks += 1;
  }

  INSERT_DECK.free();
  INSERT_FACT.free();
  INSERT_POOL.free();
  INSERT_SYNONYM.free();

  // -- Write database to disk --
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const exported = db.export(); // Uint8Array
  fs.writeFileSync(OUT_DB, Buffer.from(exported));

  db.close();

  const sizeKb = (fs.statSync(OUT_DB).size / 1024).toFixed(1);
  console.log('');
  console.log('Build complete:');
  console.log(`  Decks processed : ${totalDecks}`);
  console.log(`  Total facts     : ${totalFacts}`);
  console.log(`  Output          : ${path.relative(ROOT, OUT_DB)} (${sizeKb} KB)`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
