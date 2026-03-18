/**
 * Steam platform service for Recall Rogue.
 *
 * Wraps all Steamworks SDK calls behind a `hasSteam` platform guard. On non-Steam
 * platforms (mobile, web), every function is a no-op.
 *
 * The Rust backend (src-tauri/src/steam.rs) implements the actual Steamworks calls.
 * This module communicates with it via Tauri IPC (`invoke`).
 *
 * DLC ownership results are cached for the session to avoid per-frame Steam API polls.
 */

import { hasSteam } from './platformService';

// ── DLC cache ────────────────────────────────────────────────────────────────

const _dlcCache = new Map<string, boolean>();

// ── Internal Tauri IPC helper ─────────────────────────────────────────────────

/**
 * Thin wrapper around Tauri `invoke` that:
 *  - Dynamically imports `@tauri-apps/api/core` (safe in non-Tauri builds)
 *  - Returns `null` and logs a warning on any failure
 *  - Short-circuits if `hasSteam` is false (non-desktop platforms)
 */
async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!hasSteam) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[Steam] invoke '${cmd}' failed:`, e);
    return null;
  }
}

// ── Achievements ──────────────────────────────────────────────────────────────

/**
 * Unlock a Steam achievement by its Steamworks API ID.
 * No-op on non-Steam platforms. Safe to call redundantly (Steam ignores re-unlocks).
 */
export async function unlockAchievement(achievementId: string): Promise<void> {
  if (!hasSteam) return;
  await tauriInvoke('steam_unlock_achievement', { id: achievementId });
}

// ── Rich Presence ─────────────────────────────────────────────────────────────

/**
 * Set a Steam Rich Presence key/value pair.
 * Steam displays these in the friends list next to the player's name.
 * No-op on non-Steam platforms.
 */
export async function setRichPresence(key: string, value: string): Promise<void> {
  if (!hasSteam) return;
  await tauriInvoke('steam_set_rich_presence', { key, value });
}

// ── Cloud Save ────────────────────────────────────────────────────────────────

/**
 * Write serialized save data to Steam Cloud.
 * Called on run end and encounter end for incremental cloud backup.
 * No-op on non-Steam platforms.
 *
 * TODO (AR-80 follow-up): Wire to `steam_cloud_save` Tauri command once the
 * Rust backend implements RemoteStorage. For now this is a logged stub.
 */
export async function cloudSave(data: string): Promise<void> {
  if (!hasSteam) return;
  // TODO: await tauriInvoke('steam_cloud_save', { data });
  // no-op stub — Rust backend not yet implemented (AR-80 follow-up)
}

/**
 * Read serialized save data from Steam Cloud.
 * Returns null on non-Steam platforms or when no cloud save exists.
 * Caller is responsible for conflict resolution (compare timestamps).
 *
 * TODO (AR-80 follow-up): Wire to `steam_cloud_load` Tauri command once the
 * Rust backend implements RemoteStorage.
 */
export async function cloudLoad(): Promise<string | null> {
  if (!hasSteam) return null;
  // TODO: return await tauriInvoke<string>('steam_cloud_load');
  // no-op stub — Rust backend not yet implemented (AR-80 follow-up)
  return null;
}

// ── DLC Ownership ─────────────────────────────────────────────────────────────

/**
 * Check whether the player owns a specific Steam DLC.
 * Results are cached for the lifetime of the session.
 * Returns false on non-Steam platforms.
 *
 * TODO (AR-80 follow-up): Wire to `steam_has_dlc` Tauri command once implemented.
 */
export async function hasDLC(dlcId: string): Promise<boolean> {
  if (!hasSteam) return false;

  if (_dlcCache.has(dlcId)) {
    return _dlcCache.get(dlcId)!;
  }

  // TODO: const owned = await tauriInvoke<boolean>('steam_has_dlc', { dlcId }) ?? false;
  const owned = false; // stub until Rust backend implements DLC check
  _dlcCache.set(dlcId, owned);
  return owned;
}

// ── Leaderboards ──────────────────────────────────────────────────────────────

export interface SteamLeaderboardEntry {
  steamId: string;
  displayName: string;
  score: number;
  rank: number;
}

/**
 * Fetch the top entries for a named Steam leaderboard.
 * Returns an empty array on non-Steam platforms or on failure.
 *
 * TODO (AR-80 follow-up): Wire to `steam_get_leaderboard_entries` once Rust backend
 * implements async leaderboard fetching.
 */
export async function getLeaderboardEntries(board: string): Promise<SteamLeaderboardEntry[]> {
  if (!hasSteam) return [];
  // TODO: return await tauriInvoke<SteamLeaderboardEntry[]>('steam_get_leaderboard_entries', { board }) ?? [];
  // no-op stub — Rust backend not yet implemented (AR-80 follow-up)
  return [];
}

/**
 * Submit a score to a named Steam leaderboard.
 * No-op on non-Steam platforms.
 *
 * TODO (AR-80 follow-up): Wire to `steam_submit_score` once Rust backend is implemented.
 */
export async function submitScore(board: string, score: number): Promise<void> {
  if (!hasSteam) return;
  // TODO: await tauriInvoke('steam_submit_score', { board, score });
  // no-op stub — Rust backend not yet implemented (AR-80 follow-up)
}

// ── Rich Presence Helper ──────────────────────────────────────────────────────

/**
 * Update Steam Rich Presence based on the current game screen.
 * Call this whenever `currentScreen` changes.
 */
export function updateRichPresence(
  screen: string,
  details?: { floor?: number; enemy?: string; domain?: string },
): void {
  if (!hasSteam) return;

  switch (screen) {
    case 'hub':
    case 'mainMenu':
    case 'base':
      setRichPresence('status', 'In the Hub');
      break;

    case 'combat':
      if (details?.enemy) {
        setRichPresence(
          'status',
          `Floor ${details.floor ?? 1} — Fighting ${details.enemy}`,
        );
      } else {
        setRichPresence('status', `Floor ${details?.floor ?? 1} — In Combat`);
      }
      break;

    case 'cardReward':
      setRichPresence('status', 'Choosing Rewards');
      break;

    case 'shopRoom':
      setRichPresence('status', 'Browsing the Shop');
      break;

    case 'library':
      if (details?.domain) {
        setRichPresence('status', `Studying — ${details.domain}`);
      } else {
        setRichPresence('status', 'In the Knowledge Library');
      }
      break;

    case 'restRoom':
      setRichPresence('status', 'Resting at the Campsite');
      break;

    case 'roomSelection':
    case 'dungeonMap':
      setRichPresence('status', `Floor ${details?.floor ?? 1} — Choosing Path`);
      break;

    case 'retreatOrDelve':
      setRichPresence('status', 'Deciding — Retreat or Delve Deeper');
      break;

    case 'relicSanctum':
      setRichPresence('status', 'Browsing the Relic Sanctum');
      break;

    default:
      setRichPresence('status', 'Playing Recall Rogue');
      break;
  }
}
