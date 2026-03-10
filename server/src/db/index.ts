/**
 * Database connection setup for the Recall Rogue server.
 * Uses better-sqlite3 + Drizzle ORM for SQLite (development/self-hosted).
 * The connection is a singleton; import `db` throughout the application.
 */

import Database, { type Database as BetterSqliteDatabase } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { config } from "../config.js";
import * as schema from "./schema.js";

/**
 * Resolve the database file path, creating parent directories if needed.
 *
 * @param url - The DATABASE_URL config value (file path for SQLite).
 * @returns Absolute path to the SQLite database file.
 */
function resolveDbPath(url: string): string {
  // Treat the URL as a plain file path for SQLite
  const resolved = path.resolve(url);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return resolved;
}

const dbPath = resolveDbPath(config.databaseUrl);

/**
 * Raw better-sqlite3 Database instance.
 * Exposed so the migrate runner can use it directly.
 */
export const sqliteDb: BetterSqliteDatabase = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqliteDb.pragma("journal_mode = WAL");
// Enforce foreign-key constraints
sqliteDb.pragma("foreign_keys = ON");

/**
 * Drizzle ORM database client.
 * Use this for all query operations throughout the application.
 */
export const db = drizzle(sqliteDb, { schema });

export type Database = typeof db;
