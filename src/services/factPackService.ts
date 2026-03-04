/**
 * @file factPackService.ts
 * Offline-first fact pack manager.
 *
 * Downloads fact packs from the server and caches them in localStorage so the
 * game can serve quiz content without a network connection. The local sql.js
 * database (facts.db) remains the primary query path; this service acts as a
 * supplementary layer that keeps an up-to-date JSON copy of approved facts for
 * environments where the binary .db file may be stale or unavailable.
 *
 * Key guarantees:
 * - `init()` is synchronous — it never touches the network.
 * - `getFacts()` never makes a network call; it always returns cached data.
 * - `syncPacks()` fails silently so offline users are never blocked.
 */

const PACK_VERSION_KEY = 'terra_fact_pack_version'
const PACK_DATA_KEY = 'terra_fact_pack_data'
const PACK_LAST_SYNC_KEY = 'terra_fact_pack_last_sync'
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/** A single entry within a FactPack. */
export interface FactPackEntry {
  id: string
  question: string
  answer: string
  distractors: string[]
  gaiaComment: string
  explanation: string
  category: string
  wowFactor: number
}

/** The full fact pack payload returned by the server. */
export interface FactPack {
  packId: string
  category: string
  version: number
  factCount: number
  facts: FactPackEntry[]
}

/**
 * Offline-first service that downloads, caches, and serves fact packs.
 *
 * Usage:
 *   factPackService.init()                          // call once at startup
 *   const facts = factPackService.getFacts()        // always synchronous
 *   factPackService.syncPacks().catch(() => {})     // fire-and-forget background sync
 */
export class FactPackService {
  private cachedPack: FactPack | null = null

  /**
   * Loads the cached fact pack from localStorage.
   * Must be called once at startup before any query methods are used.
   * This method is entirely synchronous and never touches the network.
   */
  init(): void {
    try {
      const raw = localStorage.getItem(PACK_DATA_KEY)
      if (raw) {
        this.cachedPack = JSON.parse(raw) as FactPack
      }
    } catch {
      // Corrupt cache — start fresh; syncPacks() will repopulate
      this.cachedPack = null
    }
  }

  /**
   * Returns facts from the local cache.
   * Never makes a network call.
   *
   * @param category Optional category filter (matches FactPackEntry.category).
   * @returns Array of matching FactPackEntry objects, or an empty array if no
   *          pack is cached.
   */
  getFacts(category?: string): FactPackEntry[] {
    if (!this.cachedPack) return []
    if (category) {
      return this.cachedPack.facts.filter(f => f.category === category)
    }
    return this.cachedPack.facts
  }

  /**
   * Returns true if the cached pack is older than the sync interval (7 days)
   * or has never been synced.
   */
  isPackStale(): boolean {
    const lastSync = localStorage.getItem(PACK_LAST_SYNC_KEY)
    if (!lastSync) return true
    return Date.now() - parseInt(lastSync, 10) > SYNC_INTERVAL_MS
  }

  /**
   * Returns true if a non-empty fact pack is currently cached in memory.
   */
  hasCachedPack(): boolean {
    return this.cachedPack !== null && this.cachedPack.facts.length > 0
  }

  /**
   * Returns the version number of the currently cached pack, or 0 if no pack
   * is cached.
   */
  getCachedVersion(): number {
    return this.cachedPack?.version ?? 0
  }

  /**
   * Downloads updated packs from the server and persists them to localStorage.
   * This is a background operation — it should be called fire-and-forget style
   * and must never be awaited in a way that blocks the critical path.
   *
   * Fails silently on network errors so offline players are never affected.
   */
  async syncPacks(): Promise<void> {
    if (!this.isPackStale()) return
    try {
      const response = await fetch(`${this.getApiBase()}/api/facts/packs/all`)
      if (!response.ok) return
      const pack = (await response.json()) as FactPack
      // Basic validation before persisting
      if (!pack || !Array.isArray(pack.facts)) return
      this.cachedPack = pack
      localStorage.setItem(PACK_DATA_KEY, JSON.stringify(pack))
      localStorage.setItem(PACK_VERSION_KEY, String(pack.version))
      localStorage.setItem(PACK_LAST_SYNC_KEY, String(Date.now()))
    } catch {
      // Silent failure — offline-first: do not crash on network errors
    }
  }

  /**
   * Downloads facts for a single category from the server and merges them into
   * the local cache.  Fails silently on network errors.
   *
   * @param category The category_l1 value to fetch.
   */
  async syncCategory(category: string): Promise<void> {
    try {
      const encoded = encodeURIComponent(category)
      const response = await fetch(`${this.getApiBase()}/api/facts/packs/${encoded}`)
      if (!response.ok) return
      const pack = (await response.json()) as FactPack
      if (!pack || !Array.isArray(pack.facts)) return

      // Merge into existing cache
      if (this.cachedPack) {
        const existingIds = new Set(this.cachedPack.facts.map(f => f.id))
        const newFacts = pack.facts.filter(f => !existingIds.has(f.id))
        this.cachedPack = {
          ...this.cachedPack,
          factCount: this.cachedPack.factCount + newFacts.length,
          facts: [...this.cachedPack.facts, ...newFacts],
        }
      } else {
        this.cachedPack = pack
      }

      localStorage.setItem(PACK_DATA_KEY, JSON.stringify(this.cachedPack))
      localStorage.setItem(PACK_LAST_SYNC_KEY, String(Date.now()))
    } catch {
      // Silent failure
    }
  }

  /** Resolves the API base URL from the Vite environment, falling back to localhost. */
  private getApiBase(): string {
    if (typeof import.meta !== 'undefined') {
      const env = (import.meta as unknown as Record<string, Record<string, string>>).env
      if (env?.VITE_API_BASE_URL) return env.VITE_API_BASE_URL
    }
    return 'http://localhost:3001'
  }
}

/** The shared FactPackService singleton. Call `factPackService.init()` once at startup. */
export const factPackService = new FactPackService()
