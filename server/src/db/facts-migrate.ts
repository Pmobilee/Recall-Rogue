/**
 * Schema migration for the Terra Gacha facts content database.
 * Creates all tables, indexes, and triggers needed for the fact content engine.
 * All DDL statements use IF NOT EXISTS — safe to run multiple times.
 */

import { factsDb } from "./facts-db.js";

/**
 * Initialise the facts database schema idempotently.
 * Creates tables, indexes, and triggers for the fact content engine.
 * Safe to call on every server startup.
 */
export function initFactsSchema(): void {
  // ── facts table ─────────────────────────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      -- Identity
      id                    TEXT PRIMARY KEY,
      type                  TEXT NOT NULL DEFAULT 'fact',
      status                TEXT NOT NULL DEFAULT 'draft',
      in_game_reports       INTEGER NOT NULL DEFAULT 0,

      -- Core content
      statement             TEXT NOT NULL,
      wow_factor            TEXT,
      explanation           TEXT NOT NULL,
      alternate_explanations TEXT,          -- JSON array of strings
      gaia_comments         TEXT,           -- JSON array of {variant, text}
      gaia_wrong_comments   TEXT,           -- JSON object {snarky, enthusiastic, calm}

      -- Quiz fields
      quiz_question         TEXT NOT NULL,
      correct_answer        TEXT NOT NULL,
      acceptable_answers    TEXT,           -- JSON array of strings
      distractor_count      INTEGER NOT NULL DEFAULT 0,

      -- Categorisation
      category_l1           TEXT NOT NULL DEFAULT '',
      category_l2           TEXT NOT NULL DEFAULT '',
      category_l3           TEXT NOT NULL DEFAULT '',
      category_legacy       TEXT,           -- JSON array (migration compatibility)

      -- Quality scoring
      rarity                TEXT NOT NULL DEFAULT 'common',
      difficulty            INTEGER NOT NULL DEFAULT 3,
      fun_score             INTEGER NOT NULL DEFAULT 5,
      novelty_score         INTEGER NOT NULL DEFAULT 5,

      -- Safety & content policy
      age_rating            TEXT NOT NULL DEFAULT 'teen',
      sensitivity_level     INTEGER NOT NULL DEFAULT 0,
      sensitivity_note      TEXT,

      -- Longevity
      content_volatility    TEXT NOT NULL DEFAULT 'timeless',
      source_name           TEXT,
      source_url            TEXT,

      -- Relations
      related_facts         TEXT,           -- JSON array of fact IDs
      tags                  TEXT,           -- JSON array of strings
      mnemonic              TEXT,

      -- Visuals
      image_prompt          TEXT,
      visual_description    TEXT,
      image_url             TEXT,
      has_pixel_art         INTEGER NOT NULL DEFAULT 0,
      pixel_art_status      TEXT NOT NULL DEFAULT 'none',

      -- Language / vocabulary fields
      language              TEXT,
      pronunciation         TEXT,
      example_sentence      TEXT,

      -- Sync / versioning
      db_version            INTEGER NOT NULL DEFAULT 0,
      created_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at            INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      last_reviewed_at      INTEGER
    );
  `);

  // ── Auto-increment db_version triggers ──────────────────────────────────────
  factsDb.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_facts_version_insert
    AFTER INSERT ON facts
    BEGIN
      UPDATE facts
      SET db_version = (SELECT COALESCE(MAX(db_version), 0) + 1 FROM facts)
      WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_facts_version_update
    AFTER UPDATE ON facts
    WHEN OLD.db_version = NEW.db_version
    BEGIN
      UPDATE facts
      SET db_version = (SELECT COALESCE(MAX(db_version), 0) + 1 FROM facts)
      WHERE id = NEW.id;
    END;
  `);

  // ── facts indexes ────────────────────────────────────────────────────────────
  factsDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_facts_status
      ON facts (status);

    CREATE INDEX IF NOT EXISTS idx_facts_type
      ON facts (type);

    CREATE INDEX IF NOT EXISTS idx_facts_rarity
      ON facts (rarity);

    CREATE INDEX IF NOT EXISTS idx_facts_difficulty
      ON facts (difficulty);

    CREATE INDEX IF NOT EXISTS idx_facts_age_rating
      ON facts (age_rating);

    CREATE INDEX IF NOT EXISTS idx_facts_category_l1
      ON facts (category_l1);

    CREATE INDEX IF NOT EXISTS idx_facts_category_l1_l2
      ON facts (category_l1, category_l2);

    CREATE INDEX IF NOT EXISTS idx_facts_pixel_art_status
      ON facts (pixel_art_status);

    CREATE INDEX IF NOT EXISTS idx_facts_content_volatility
      ON facts (content_volatility);

    CREATE INDEX IF NOT EXISTS idx_facts_in_game_reports
      ON facts (in_game_reports DESC);

    CREATE INDEX IF NOT EXISTS idx_facts_db_version
      ON facts (db_version);
  `);

  // ── distractors table ────────────────────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS distractors (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id              TEXT NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      text                 TEXT NOT NULL,
      difficulty_tier      TEXT NOT NULL DEFAULT 'medium',
      distractor_confidence REAL NOT NULL DEFAULT 1.0,
      is_approved          INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_distractors_fact_id
      ON distractors (fact_id);

    CREATE INDEX IF NOT EXISTS idx_distractors_confidence
      ON distractors (distractor_confidence);
  `);

  // ── fact_reports table ───────────────────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS fact_reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id     TEXT NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      player_id   TEXT,
      report_text TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_fact_reports_fact_id
      ON fact_reports (fact_id);
  `);

  // ── fact_pack_versions table ─────────────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS fact_pack_versions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_name   TEXT NOT NULL,
      version     INTEGER NOT NULL,
      fact_count  INTEGER NOT NULL DEFAULT 0,
      built_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      file_path   TEXT
    );
  `);

  // ── facts_processing_queue table ─────────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS facts_processing_queue (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id          TEXT NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      status           TEXT NOT NULL DEFAULT 'pending',
      attempts         INTEGER NOT NULL DEFAULT 0,
      last_error       TEXT,
      enqueued_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      processed_at     INTEGER,
      raw_llm_response TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status
      ON facts_processing_queue (status);

    CREATE INDEX IF NOT EXISTS idx_queue_fact_id
      ON facts_processing_queue (fact_id);
  `);

  // ── Phase 32.1: New columns on facts ────────────────────────────────────────
  const newFactColumns: Array<[string, string]> = [
    // Difficulty tier enum — coarser than difficulty (1-5); used for biome gating
    // 'novice' | 'explorer' | 'scholar' | 'expert'
    ["difficulty_tier", "TEXT NOT NULL DEFAULT 'explorer'"],

    // Source quality enum — drives weighting in gap analysis
    // 'primary' | 'secondary' | 'generated' | 'community'
    ["source_quality", "TEXT NOT NULL DEFAULT 'generated'"],

    // Source attribution detail — URL may be long, store separately from source_url
    ["source_doi", "TEXT"],

    // Third-stage review gate result (null = not yet run)
    // 'pass' | 'fail' | 'needs_edit'
    ["quality_gate_status", "TEXT"],

    // Composite quality score (0-100) computed after all 3 gate passes
    ["quality_score", "REAL"],

    // Gate run timestamp (epoch ms) — avoid re-running unnecessarily
    ["quality_gate_ran_at", "INTEGER"],

    // Gate failure reason — short string for dashboard display
    ["quality_gate_failure_reason", "TEXT"],

    // Weekly bundle tag — which release bundle this fact belongs to
    // e.g. '2026-W10', null = not yet bundled
    ["bundle_tag", "TEXT"],

    // Whether this fact was sourced from a specific seed topic batch
    ["seed_topic", "TEXT"],
  ];

  for (const [column, definition] of newFactColumns) {
    try {
      factsDb.exec(`ALTER TABLE facts ADD COLUMN ${column} ${definition}`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // ── Phase 32.1: New columns on distractors ───────────────────────────────────
  const newDistractorColumns: Array<[string, string]> = [
    // Cosine similarity to the correct answer (0-1); high similarity = bad distractor
    ["similarity_to_answer", "REAL"],

    // Whether this distractor passed the 3rd-stage gate
    ["gate_approved", "INTEGER NOT NULL DEFAULT 1"],
  ];

  for (const [column, definition] of newDistractorColumns) {
    try {
      factsDb.exec(`ALTER TABLE distractors ADD COLUMN ${column} ${definition}`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // ── Phase 32.1: Composite indexes for quality gate queries ──────────────────
  factsDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_facts_quality_gate
      ON facts (quality_gate_status, status);

    CREATE INDEX IF NOT EXISTS idx_facts_bundle_tag
      ON facts (bundle_tag);

    CREATE INDEX IF NOT EXISTS idx_facts_difficulty_tier
      ON facts (difficulty_tier, status);
  `);

  console.log("[facts-db] Facts schema initialised.");
}
