/**
 * Client-side feature flag SDK (Phase 41.1).
 * Bootstraps all flags on login, caches them in memory and localStorage,
 * and exposes a synchronous `isEnabled(key)` helper for use throughout the UI.
 *
 * Falls back to hardcoded defaults when offline or when the bootstrap endpoint
 * is unavailable, ensuring the game is always playable without connectivity.
 */
import { readAccessToken } from './authTokens'

/** Hardcoded defaults used offline / before bootstrap completes. */
const FLAG_DEFAULTS: Record<string, boolean> = {
  rewarded_ads: false,
  subscriptions_enabled: false,
  season_pass_enabled: true,
  pioneer_pack_enabled: true,
  ab_pioneer_pack_timing: true,
  patron_features_enabled: true,
  dome_maintenance_enabled: true,
  spending_bonus_enabled: true,
}

const CACHE_KEY = 'terra_feature_flags'

class FeatureFlagService {
  private flags: Record<string, boolean> = { ...FLAG_DEFAULTS }
  private loaded = false

  constructor() {
    this.loadFromCache()
  }

  /**
   * Bootstrap all flags from the server.
   * Call once after a successful login.  Safe to call multiple times.
   */
  async bootstrap(): Promise<void> {
    try {
      const apiBase = (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`
      const token = readAccessToken()
      const res = await fetch(`${apiBase}/api/flags`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const data = (await res.json()) as { flags: Record<string, boolean> }
      this.flags = { ...FLAG_DEFAULTS, ...data.flags }
      this.loaded = true
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.flags))
    } catch {
      // Network error — already using cache or defaults, no action needed
    }
  }

  /**
   * Check whether a feature flag is enabled for the current user.
   * Synchronous after bootstrap; returns defaults before bootstrap completes.
   *
   * @param key - The feature flag key to check.
   * @returns true if the flag is enabled, false otherwise.
   */
  isEnabled(key: string): boolean {
    return this.flags[key] ?? FLAG_DEFAULTS[key] ?? false
  }

  /**
   * True once the server has successfully responded to bootstrap().
   */
  isLoaded(): boolean {
    return this.loaded
  }

  private loadFromCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) this.flags = { ...FLAG_DEFAULTS, ...JSON.parse(raw) }
    } catch {
      // Corrupt cache — use defaults
    }
  }
}

/** Singleton feature flag service — import and use throughout the app. */
export const featureFlagService = new FeatureFlagService()
