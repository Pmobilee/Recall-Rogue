/**
 * API key management service.
 * Keys are stored as SHA-256 hashes; the raw key is only returned once at creation.
 * Quota tracking uses an in-memory minute window + a persistent hourly bucket in usage_logs.
 */
import * as crypto from 'crypto'
import { factsDb } from '../db/facts-db.js'

export interface ApiKey {
  id: string
  ownerId: string | null
  keyPrefix: string
  name: string
  tier: 'free' | 'institutional' | 'enterprise'
  quotaPerDay: number
  quotaPerMin: number
  isActive: boolean
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface CreateApiKeyResult {
  apiKey: ApiKey
  rawKey: string  // Only returned at creation time; never stored
}

/** Quota limits per tier */
export const TIER_QUOTAS: Record<ApiKey['tier'], { perDay: number; perMin: number }> = {
  free:          { perDay: 1_000,   perMin: 60  },
  institutional: { perDay: 50_000,  perMin: 500 },
  enterprise:    { perDay: 500_000, perMin: 2_000 },
}

/** Raw DB row shape for api_keys table. */
interface ApiKeyRow {
  id: string
  owner_id: string | null
  key_prefix: string
  name: string
  tier: string
  quota_per_day: number
  quota_per_min: number
  is_active: number
  last_used_at: number | null
  created_at: number
  updated_at: number
}

/** Map snake_case DB row to camelCase ApiKey interface. */
function rowToApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    ownerId: row.owner_id,
    keyPrefix: row.key_prefix,
    name: row.name,
    tier: row.tier as ApiKey['tier'],
    quotaPerDay: row.quota_per_day,
    quotaPerMin: row.quota_per_min,
    isActive: row.is_active === 1,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Generate a new API key, store its hash, and return the raw key once.
 * Raw key format: tg_live_<32 random hex chars>
 *
 * @param name    - Human-readable label for this key.
 * @param tier    - Rate-limit tier for this key.
 * @param ownerId - Optional user ID linking the key to a registered account.
 * @returns The persisted ApiKey record and the raw key (shown only once).
 */
export function createApiKey(
  name: string,
  tier: ApiKey['tier'] = 'free',
  ownerId: string | null = null
): CreateApiKeyResult {
  const randomPart = crypto.randomBytes(16).toString('hex')
  const rawKey = `tg_live_${randomPart}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 15)  // "tg_live_" + first 7 hex chars
  const id = crypto.randomUUID()
  const now = Date.now()
  const quota = TIER_QUOTAS[tier]

  factsDb.prepare(`
    INSERT INTO api_keys
      (id, owner_id, key_hash, key_prefix, name, tier, quota_per_day, quota_per_min,
       is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, ownerId, keyHash, keyPrefix, name, tier, quota.perDay, quota.perMin, now, now)

  const row = factsDb.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as ApiKeyRow
  return { apiKey: rowToApiKey(row), rawKey }
}

/**
 * Validate an incoming raw API key against stored hashes.
 * Returns the ApiKey row if valid and active, null otherwise.
 *
 * @param rawKey - The raw API key string from the request header.
 * @returns The ApiKey record if valid, or null if invalid/revoked.
 */
export function validateApiKey(rawKey: string): ApiKey | null {
  if (!rawKey || typeof rawKey !== 'string') return null
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const row = factsDb.prepare(
    'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1'
  ).get(keyHash) as ApiKeyRow | undefined
  if (!row) return null

  // Update last_used_at asynchronously (non-blocking fire-and-forget)
  factsDb.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .run(Date.now(), row.id)

  return rowToApiKey(row)
}

/**
 * Record a request in the hourly usage bucket.
 * Performs an upsert so concurrent requests merge correctly.
 *
 * @param keyId    - The API key ID to record usage for.
 * @param endpoint - The endpoint path being accessed.
 */
export function recordUsage(keyId: string, endpoint: string): void {
  const now = Date.now()
  const hourBucket = Math.floor(now / 3_600_000) * 3_600_000
  const id = `${keyId}:${endpoint}:${hourBucket}`
  factsDb.prepare(`
    INSERT INTO usage_logs (id, key_id, endpoint, hour_bucket, request_count, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT (key_id, endpoint, hour_bucket)
    DO UPDATE SET request_count = request_count + 1
  `).run(id, keyId, endpoint, hourBucket, now)
}

/**
 * Return the total request count for a key in the last 24 hours.
 *
 * @param keyId - The API key ID to check usage for.
 * @returns Total request count in the last 24-hour window.
 */
export function getDailyUsage(keyId: string): number {
  const since = Date.now() - 86_400_000
  const sinceBucket = Math.floor(since / 3_600_000) * 3_600_000
  const row = factsDb.prepare(`
    SELECT COALESCE(SUM(request_count), 0) as total
    FROM usage_logs WHERE key_id = ? AND hour_bucket >= ?
  `).get(keyId, sinceBucket) as { total: number }
  return row.total
}

/**
 * List all API keys for a given owner.
 *
 * @param ownerId - The user ID whose keys to retrieve.
 * @returns Array of ApiKey records (no raw key — that is never stored).
 */
export function listApiKeys(ownerId: string): ApiKey[] {
  const rows = factsDb.prepare(
    'SELECT * FROM api_keys WHERE owner_id = ? ORDER BY created_at DESC'
  ).all(ownerId) as ApiKeyRow[]
  return rows.map(rowToApiKey)
}

/**
 * Revoke (deactivate) an API key by ID.
 * Only the owner or an admin should call this.
 *
 * @param keyId   - The key ID to revoke.
 * @param ownerId - If provided, ensures the key belongs to this owner.
 */
export function revokeApiKey(keyId: string, ownerId?: string): void {
  if (ownerId) {
    factsDb.prepare(
      'UPDATE api_keys SET is_active = 0, updated_at = ? WHERE id = ? AND owner_id = ?'
    ).run(Date.now(), keyId, ownerId)
  } else {
    factsDb.prepare(
      'UPDATE api_keys SET is_active = 0, updated_at = ? WHERE id = ?'
    ).run(Date.now(), keyId)
  }
}
