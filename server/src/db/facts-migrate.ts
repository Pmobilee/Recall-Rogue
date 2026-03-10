/**
 * Schema migration for the Recall Rogue facts content database.
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

  // ── Phase 34: Add pixel_art_path column ─────────────────────────────────────
  try {
    factsDb.exec(`ALTER TABLE facts ADD COLUMN pixel_art_path TEXT`);
  } catch {
    // Column already exists — safe to ignore
  }

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

  // ── Phase 50: UGC submission tables ──────────────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS ugc_submissions (
      id                  TEXT PRIMARY KEY,
      player_id           TEXT NOT NULL,
      fact_text           TEXT NOT NULL,
      correct_answer      TEXT NOT NULL,
      distractors         TEXT NOT NULL,   -- JSON array of strings
      category            TEXT NOT NULL,   -- JSON array of strings
      source_url          TEXT NOT NULL,
      source_name         TEXT NOT NULL,
      license_consented   INTEGER NOT NULL DEFAULT 0,
      auto_filter_passed  INTEGER NOT NULL DEFAULT 0,
      auto_filter_reason  TEXT,
      upvotes             INTEGER NOT NULL DEFAULT 0,
      downvotes           INTEGER NOT NULL DEFAULT 0,
      status              TEXT NOT NULL DEFAULT 'pending',
      appeal_id           TEXT,
      submitted_at        TEXT NOT NULL,
      reviewed_by         TEXT,
      reviewed_at         TEXT,
      rejection_reason    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ugc_submissions_status
      ON ugc_submissions (status);
    CREATE INDEX IF NOT EXISTS idx_ugc_submissions_player_id
      ON ugc_submissions (player_id);

    CREATE TABLE IF NOT EXISTS ugc_votes (
      id            TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES ugc_submissions(id) ON DELETE CASCADE,
      voter_id      TEXT NOT NULL,
      vote          TEXT NOT NULL,   -- 'up' | 'down'
      voted_at      TEXT NOT NULL,
      UNIQUE (submission_id, voter_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ugc_votes_submission_id
      ON ugc_votes (submission_id);
  `);

  // ── Phase 50: Open Content Ecosystem tables ──────────────────────────────────
  factsDb.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id          TEXT PRIMARY KEY,
      owner_id    TEXT,
      key_hash    TEXT NOT NULL UNIQUE,
      key_prefix  TEXT NOT NULL,
      name        TEXT NOT NULL,
      tier        TEXT NOT NULL DEFAULT 'free',
      quota_per_day  INTEGER NOT NULL DEFAULT 1000,
      quota_per_min  INTEGER NOT NULL DEFAULT 60,
      is_active   INTEGER NOT NULL DEFAULT 1,
      last_used_at   INTEGER,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id         TEXT PRIMARY KEY,
      key_id     TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL,
      hour_bucket INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE (key_id, endpoint, hour_bucket)
    );
    CREATE INDEX IF NOT EXISTS idx_usage_logs_key_hour
      ON usage_logs (key_id, hour_bucket DESC);

    CREATE TABLE IF NOT EXISTS partner_orgs (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      domain        TEXT NOT NULL UNIQUE,
      org_type      TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_name  TEXT NOT NULL,
      license_tier  TEXT NOT NULL DEFAULT 'pending',
      api_key_id    TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
      content_config TEXT NOT NULL DEFAULT '{}',
      verified      INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS license_grants (
      id            TEXT PRIMARY KEY,
      key_id        TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      fact_ids      TEXT NOT NULL,
      license_type  TEXT NOT NULL,
      granted_at    INTEGER NOT NULL,
      attribution_text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_license_grants_key
      ON license_grants (key_id, granted_at DESC);

    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id            TEXT PRIMARY KEY,
      key_id        TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      endpoint_url  TEXT NOT NULL,
      event         TEXT NOT NULL,
      secret        TEXT NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_key_event
      ON webhook_subscriptions (key_id, event);

    CREATE TABLE IF NOT EXISTS ugc_appeals (
      id              TEXT PRIMARY KEY,
      submission_id   TEXT NOT NULL,
      appellant_id    TEXT NOT NULL,
      reason          TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      moderator_note  TEXT,
      filed_at        INTEGER NOT NULL,
      resolved_at     INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_ugc_appeals_submission
      ON ugc_appeals (submission_id);
  `);

  console.log("[facts-db] Facts schema initialised.");
}
