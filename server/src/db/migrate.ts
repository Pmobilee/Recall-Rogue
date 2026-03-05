/**
 * Migration runner for the Terra Gacha database.
 * Applies all pending Drizzle ORM migrations to the SQLite database.
 *
 * Run via: npm run migrate
 * This file is safe to import — it only runs migrations when invoked directly.
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as path from "path";
import * as url from "url";
import { db, sqliteDb } from "./index.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

/**
 * Initialise the database tables directly from the inline schema DDL.
 * Idempotent — uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
 * Called at server startup when Drizzle migration files are not yet present.
 */
export function initSchema(): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      age_bracket TEXT NOT NULL DEFAULT 'adult',
      is_guest INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      save_data TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      profile_id TEXT NOT NULL DEFAULT 'default',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leaderboards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      score INTEGER NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      properties TEXT NOT NULL,
      platform TEXT,
      app_version TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fact_packs (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      category TEXT NOT NULL,
      pack_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id);
    CREATE INDEX IF NOT EXISTS idx_saves_created_at ON saves(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboards_category ON leaderboards(category);
    CREATE INDEX IF NOT EXISTS idx_leaderboards_score ON leaderboards(score DESC);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_fact_packs_category ON fact_packs(category);

    CREATE TABLE IF NOT EXISTS leaderboard_review_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      score INTEGER NOT NULL,
      metadata TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      review_note TEXT
    );

    CREATE TABLE IF NOT EXISTS flagged_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      reason TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      cleared_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_review_queue_status ON leaderboard_review_queue(status);
    CREATE INDEX IF NOT EXISTS idx_review_queue_user_id ON leaderboard_review_queue(user_id);
    CREATE INDEX IF NOT EXISTS idx_flagged_accounts_user_id ON flagged_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_flagged_accounts_is_active ON flagged_accounts(is_active);

    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      rollout_pct INTEGER NOT NULL DEFAULT 100,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feature_flag_overrides (
      id TEXT PRIMARY KEY,
      flag_key TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      value INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_flag_key ON feature_flag_overrides(flag_key);
    CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_user_id ON feature_flag_overrides(user_id);

    -- Phase 44: Educator columns on users (ALTER TABLE is idempotent via try/catch)
    -- SQLite only allows ADD COLUMN, not IF NOT EXISTS for columns.
  `);

  // Phase 44: Add educator columns to users table (idempotent — ignore errors if column exists)
  const educatorColumns: [string, string][] = [
    ['role', "TEXT NOT NULL DEFAULT 'player'"],
    ['educator_verification', 'TEXT'],
    ['educator_org', 'TEXT'],
    ['educator_domain', 'TEXT'],
    ['class_limit', 'INTEGER NOT NULL DEFAULT 5'],
  ];
  for (const [col, def] of educatorColumns) {
    try {
      sqliteDb.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`)
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Phase 44: New tables for teacher dashboard
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS educator_verification_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      school_name TEXT NOT NULL,
      email_domain TEXT NOT NULL,
      school_url TEXT,
      verification_note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      review_note TEXT,
      submitted_at INTEGER NOT NULL,
      reviewed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      age_rating TEXT NOT NULL DEFAULT 'teen',
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classroom_students (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS homework_assignments (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      categories TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      due_date INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_announcements (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      posted_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_evr_user_id ON educator_verification_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_evr_status ON educator_verification_requests(status);
    CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_classrooms_join_code ON classrooms(join_code);
    CREATE INDEX IF NOT EXISTS idx_classroom_students_classroom_id ON classroom_students(classroom_id);
    CREATE INDEX IF NOT EXISTS idx_classroom_students_student_id ON classroom_students(student_id);
    CREATE INDEX IF NOT EXISTS idx_homework_classroom_id ON homework_assignments(classroom_id);
    CREATE INDEX IF NOT EXISTS idx_announcements_classroom_id ON class_announcements(classroom_id);
  `);

  console.log("[db] Schema initialised.");
}

/**
 * Run all pending Drizzle ORM migrations from the drizzle/ folder.
 * Safe to run multiple times; already-applied migrations are skipped.
 * Closes the database connection after completing or on failure.
 */
async function runMigrations(): Promise<void> {
  console.log(`[migrate] Running migrations from: ${migrationsFolder}`);
  try {
    migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    sqliteDb.close();
  }
}

// Only execute when this file is the direct entry point (not when imported).
// Detect by comparing the resolved file path to process.argv[1].
const isMain =
  process.argv[1] !== undefined &&
  (path.resolve(process.argv[1]) === __filename ||
    // Also handle the compiled dist/ path
    path.resolve(process.argv[1]) === __filename.replace("/src/", "/dist/").replace(".ts", ".js"));

if (isMain) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
