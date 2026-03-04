/**
 * Offline feature tier definitions — Phase 20.13 (DD-V2-201)
 *
 * Three tiers of offline capability:
 * - Tier 1: Full play offline with cached facts DB and saved game state
 * - Tier 2: Read-only access to knowledge tree, history, and stats
 * - Tier 3: Queued actions that sync when connectivity returns
 */

export enum OfflineTier {
  /** Full gameplay: mining, quizzes, dome interaction (requires cached facts.db) */
  FULL_PLAY = 1,
  /** Read-only: knowledge tree, dive history, stats (no new dives) */
  READ_ONLY = 2,
  /** Queued sync: profile changes, settings updates sync on reconnect */
  QUEUED_SYNC = 3,
}

interface OfflineCapability {
  tier: OfflineTier
  feature: string
  available: boolean
  requirement: string
}

/** Defines which features are available at each offline tier */
export const OFFLINE_CAPABILITIES: OfflineCapability[] = [
  // Tier 1 — Full play
  { tier: OfflineTier.FULL_PLAY, feature: 'Mining gameplay', available: true, requirement: 'Cached facts.db' },
  { tier: OfflineTier.FULL_PLAY, feature: 'Quiz answering', available: true, requirement: 'Cached facts.db' },
  { tier: OfflineTier.FULL_PLAY, feature: 'Dome hub interaction', available: true, requirement: 'Local save state' },
  { tier: OfflineTier.FULL_PLAY, feature: 'SM-2 review scheduling', available: true, requirement: 'Local review state' },
  { tier: OfflineTier.FULL_PLAY, feature: 'Fossil revival', available: true, requirement: 'Local save state' },

  // Tier 2 — Read-only
  { tier: OfflineTier.READ_ONLY, feature: 'Knowledge tree viewing', available: true, requirement: 'Local mastery data' },
  { tier: OfflineTier.READ_ONLY, feature: 'Dive history', available: true, requirement: 'Local save state' },
  { tier: OfflineTier.READ_ONLY, feature: 'Stats & achievements', available: true, requirement: 'Local save state' },
  { tier: OfflineTier.READ_ONLY, feature: 'Settings changes', available: true, requirement: 'Local storage' },

  // Tier 3 — Queued sync
  { tier: OfflineTier.QUEUED_SYNC, feature: 'Profile updates', available: true, requirement: 'Sync queue' },
  { tier: OfflineTier.QUEUED_SYNC, feature: 'Cloud save sync', available: true, requirement: 'Sync queue' },
  { tier: OfflineTier.QUEUED_SYNC, feature: 'Analytics events', available: true, requirement: 'Event queue' },
]

/** Checks whether the facts database is cached locally for offline play */
export function isFactsDBCached(): boolean {
  // facts.db is loaded from IndexedDB / localStorage by factsDB service
  // If it was ever loaded successfully, it's cached
  try {
    return localStorage.getItem('facts-db-loaded') === 'true'
  } catch {
    return false
  }
}

/** Returns which offline tier is currently available */
export function getCurrentOfflineTier(): OfflineTier {
  if (isFactsDBCached()) return OfflineTier.FULL_PLAY
  return OfflineTier.READ_ONLY
}
