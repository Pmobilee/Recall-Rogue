/**
 * One-time migration of localStorage keys from legacy terra_ prefix to rr_.
 * Called once at app startup in main.ts.
 */

/** Migrate a single localStorage key from old to new name. */
function migrateKey(oldKey: string, newKey: string): void {
  try {
    const value = localStorage.getItem(oldKey)
    if (value !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, value)
    }
  } catch { /* ignore storage errors (private browsing, quota, etc.) */ }
}

/** Migrate all localStorage keys matching a prefix. */
function migratePrefixedKeys(oldPrefix: string, newPrefix: string): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(oldPrefix)) {
        const newKey = newPrefix + key.slice(oldPrefix.length)
        migrateKey(key, newKey)
      }
    }
  } catch { /* ignore */ }
}

/** Run all terra_ → rr_ localStorage migrations. Call once at app startup. */
export function runStorageMigrations(): void {
  // Fixed keys
  const migrations: [string, string][] = [
    ['terra_ui_locale', 'rr_ui_locale'],
    ['terra_profiles', 'rr_profiles'],
    ['terra_onboarding_complete', 'rr_onboarding_complete'],
    ['terra_language_mode', 'rr_language_mode'],
    ['terra_analytics_queue', 'rr_analytics_queue'],
    ['terra_analytics_session', 'rr_analytics_session'],
    ['terra_parental_controls', 'rr_parental_controls'],
    ['terra_parental_v1', 'rr_parental_v1'],
    ['terra_shortcuts_v1', 'rr_shortcuts_v1'],
    ['terra_last_sync_time', 'rr_last_sync_time'],
    ['terra_age_bracket', 'rr_age_bracket'],
    ['terra_local_accounts', 'rr_local_accounts'],
    ['terra_local_user', 'rr_local_user'],
    ['terra_fact_pack_version', 'rr_fact_pack_version'],
    ['terra_fact_pack_data', 'rr_fact_pack_data'],
    ['terra_fact_pack_last_sync', 'rr_fact_pack_last_sync'],
    ['terra_offline_queue', 'rr_offline_queue'],
    ['terra_seen_subcats', 'rr_seen_subcats'],
    ['terra_guest_mode', 'rr_guest_mode'],
  ]
  for (const [oldKey, newKey] of migrations) {
    migrateKey(oldKey, newKey)
  }
  // Prefixed keys (terra_save_*, terra_session_*, terra_playtime_*)
  migratePrefixedKeys('terra_save_', 'rr_save_')
  migratePrefixedKeys('terra_session_', 'rr_session_')
  migratePrefixedKeys('terra_playtime_', 'rr_playtime_')
}
