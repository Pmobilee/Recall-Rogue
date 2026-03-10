const DEFAULT_TIMEOUT_MS = 3500
const DEFAULT_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000

interface CacheEnvelope<T> {
  savedAt: number
  rows: T[]
}

export function withAbortTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
  return operation(controller.signal).finally(() => {
    globalThis.clearTimeout(timer)
  })
}

export function readCachedLeaderboardRows<T>(
  cacheKey: string,
  maxAgeMs = DEFAULT_CACHE_MAX_AGE_MS,
): T[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed || typeof parsed.savedAt !== 'number' || !Array.isArray(parsed.rows)) return null
    if (Date.now() - parsed.savedAt > Math.max(1, maxAgeMs)) return null
    return parsed.rows
  } catch {
    return null
  }
}

export function writeCachedLeaderboardRows<T>(cacheKey: string, rows: T[]): void {
  if (typeof window === 'undefined') return
  const payload: CacheEnvelope<T> = {
    savedAt: Date.now(),
    rows,
  }
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(payload))
  } catch {
    // Ignore localStorage quota/storage failures.
  }
}
