/**
 * Delta sync service for the Terra Gacha fact cache.
 * Fetches only facts modified since the client's last sync cursor.
 * Falls back to full pack on first install or corrupted cursor.
 */

import type { Fact } from '../data/types.js';

const SYNC_VERSION_KEY = 'terra-gacha-fact-sync-version';
const SYNC_URL_BASE = '/api/facts';

export interface DeltaSyncResult {
  added: number;
  updated: number;
  deleted: number;
  newVersion: number;
}

/**
 * Retrieve the client's last-sync version cursor from localStorage.
 *
 * @returns The stored version number, or 0 if not set.
 */
export function getSyncVersion(): number {
  const raw = localStorage.getItem(SYNC_VERSION_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Persist the sync version cursor.
 *
 * @param version - The new version number to store.
 */
export function setSyncVersion(version: number): void {
  localStorage.setItem(SYNC_VERSION_KEY, String(version));
}

/**
 * Fetch one page of delta facts from the server.
 * Returns null if the server is unreachable (offline).
 *
 * @param since - The last-known db_version cursor.
 * @param limit - Max facts per page.
 */
async function fetchDeltaPage(
  since: number,
  limit = 500
): Promise<{
  facts: Fact[];
  deletedIds: string[];
  latestVersion: number;
  hasMore: boolean;
} | null> {
  try {
    const url = `${SYNC_URL_BASE}/delta?since=${since}&limit=${limit}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (resp.status === 304)
      return {
        facts: [],
        deletedIds: [],
        latestVersion: since,
        hasMore: false,
      };
    if (!resp.ok) return null;
    return (await resp.json()) as {
      facts: Fact[];
      deletedIds: string[];
      latestVersion: number;
      hasMore: boolean;
    };
  } catch {
    return null; // Offline
  }
}

/**
 * A minimal sql.js-compatible DB interface used by applyDelta.
 * Matches the subset of the sql.js Database API that we need.
 */
interface SqlJsDb {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string): Array<{ values: unknown[][] }>;
}

/**
 * Apply a delta to the provided sql.js database instance.
 * Upserts new/updated facts and hard-deletes archived IDs.
 *
 * @param db         - The sql.js database instance (must have a facts table).
 * @param facts      - New or updated approved facts.
 * @param deletedIds - IDs of facts to remove from the local cache.
 * @returns Counts of rows added, updated, and deleted.
 */
export function applyDelta(
  db: SqlJsDb,
  facts: Fact[],
  deletedIds: string[]
): { added: number; updated: number; deleted: number } {
  let added = 0;
  let updated = 0;

  for (const fact of facts) {
    const existing = db.exec(
      `SELECT id FROM facts WHERE id = '${fact.id.replace(/'/g, "''")}'`
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(
        `UPDATE facts SET
           question = ?, answer = ?, distractors = ?,
           category = ?, updated_at = ?
         WHERE id = ?`,
        [
          fact.quizQuestion ?? '',
          fact.correctAnswer ?? '',
          JSON.stringify(fact.distractors ?? []),
          fact.category?.[0] ?? '',
          Date.now(),
          fact.id,
        ]
      );
      updated++;
    } else {
      db.run(
        `INSERT OR IGNORE INTO facts
           (id, question, answer, distractors, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          fact.id,
          fact.quizQuestion ?? '',
          fact.correctAnswer ?? '',
          JSON.stringify(fact.distractors ?? []),
          fact.category?.[0] ?? '',
          Date.now(),
          Date.now(),
        ]
      );
      added++;
    }
  }

  let deleted = 0;
  for (const id of deletedIds) {
    db.run(`DELETE FROM facts WHERE id = ?`, [id]);
    deleted++;
  }

  return { added, updated, deleted };
}

/**
 * Run a full delta sync cycle:
 *   1. Read local sync cursor.
 *   2. Fetch all delta pages until hasMore is false.
 *   3. Apply each page to the sql.js cache.
 *   4. Persist the new cursor.
 *
 * @param db - The sql.js database instance.
 * @returns Sync result counts, or null if offline.
 */
export async function runDeltaSync(
  db: SqlJsDb
): Promise<DeltaSyncResult | null> {
  const since = getSyncVersion();
  let cursor = since;
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;

  while (true) {
    const page = await fetchDeltaPage(cursor);
    if (!page) return null; // Offline

    const result = applyDelta(db, page.facts, page.deletedIds);
    totalAdded += result.added;
    totalUpdated += result.updated;
    totalDeleted += result.deleted;
    cursor = page.latestVersion;

    if (!page.hasMore) break;
  }

  setSyncVersion(cursor);

  return {
    added: totalAdded,
    updated: totalUpdated,
    deleted: totalDeleted,
    newVersion: cursor,
  };
}
