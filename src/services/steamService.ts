/**
 * Steam platform service for Recall Rogue.
 *
 * Wraps all Steamworks SDK calls behind a `hasSteam` platform guard. On non-Steam
 * platforms (mobile, web), every function is a no-op. When Tauri + steamworks-rs
 * integration is ready (AR-80 Rust side), un-comment the `invoke` calls below
 * and remove the stub console.log lines.
 *
 * DLC ownership results are cached for the session to avoid per-frame Steam API polls.
 */

import { hasSteam } from './platformService';

// Tauri invoke — un-comment when Rust backend is ready:
// import { invoke } from '@tauri-apps/api/core';

// ── DLC cache ────────────────────────────────────────────────────────────────

const _dlcCache = new Map<string, boolean>();

// ── Achievements ──────────────────────────────────────────────────────────────

/**
 * Unlock a Steam achievement by its Steamworks API ID.
 * No-op on non-Steam platforms. Safe to call redundantly (Steam ignores re-unlocks).
 */
export async function unlockAchievement(achievementId: string): Promise<void> {
  if (!hasSteam) return;
  try {
    // When Tauri + Steam SDK is ready:
    // await invoke('steam_unlock_achievement', { id: achievementId });
    console.log(`[Steam] Achievement unlocked: ${achievementId}`);
  } catch (e) {
    console.warn('[Steam] Failed to unlock achievement:', e);
  }
}

// ── Rich Presence ─────────────────────────────────────────────────────────────

/**
 * Set a Steam Rich Presence key/value pair.
 * Steam displays these in the friends list next to the player's name.
 * No-op on non-Steam platforms.
 */
export async function setRichPresence(key: string, value: string): Promise<void> {
  if (!hasSteam) return;
  try {
    // await invoke('steam_set_rich_presence', { key, value });
    console.log(`[Steam] Rich Presence: ${key} = ${value}`);
  } catch (e) {
    console.warn('[Steam] Failed to set rich presence:', e);
  }
}

// ── Cloud Save ────────────────────────────────────────────────────────────────

/**
 * Write serialized save data to Steam Cloud.
 * Called on run end and encounter end for incremental cloud backup.
 * No-op on non-Steam platforms.
 */
export async function cloudSave(data: string): Promise<void> {
  if (!hasSteam) return;
  try {
    // await invoke('steam_cloud_save', { data });
    console.log('[Steam] Cloud save written');
  } catch (e) {
    console.warn('[Steam] Cloud save failed:', e);
  }
}

/**
 * Read serialized save data from Steam Cloud.
 * Returns null on non-Steam platforms or when no cloud save exists.
 * Caller is responsible for conflict resolution (compare timestamps).
 */
export async function cloudLoad(): Promise<string | null> {
  if (!hasSteam) return null;
  try {
    // return await invoke<string>('steam_cloud_load');
    console.log('[Steam] Cloud load requested (stub — no data)');
    return null;
  } catch (e) {
    console.warn('[Steam] Cloud load failed:', e);
    return null;
  }
}

// ── DLC Ownership ─────────────────────────────────────────────────────────────

/**
 * Check whether the player owns a specific Steam DLC.
 * Results are cached for the lifetime of the session.
 * Returns false on non-Steam platforms.
 */
export async function hasDLC(dlcId: string): Promise<boolean> {
  if (!hasSteam) return false;

  if (_dlcCache.has(dlcId)) {
    return _dlcCache.get(dlcId)!;
  }

  try {
    // const owned = await invoke<boolean>('steam_has_dlc', { dlcId });
    const owned = false; // stub until Rust backend is ready
    _dlcCache.set(dlcId, owned);
    return owned;
  } catch (e) {
    console.warn('[Steam] DLC check failed for', dlcId, ':', e);
    return false;
  }
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
 */
export async function getLeaderboardEntries(board: string): Promise<SteamLeaderboardEntry[]> {
  if (!hasSteam) return [];
  try {
    // return await invoke<SteamLeaderboardEntry[]>('steam_get_leaderboard_entries', { board });
    console.log(`[Steam] Leaderboard fetch (stub): ${board}`);
    return [];
  } catch (e) {
    console.warn('[Steam] Leaderboard fetch failed for', board, ':', e);
    return [];
  }
}

/**
 * Submit a score to a named Steam leaderboard.
 * No-op on non-Steam platforms.
 */
export async function submitScore(board: string, score: number): Promise<void> {
  if (!hasSteam) return;
  try {
    // await invoke('steam_submit_score', { board, score });
    console.log(`[Steam] Score submitted to ${board}: ${score}`);
  } catch (e) {
    console.warn('[Steam] Score submission failed:', e);
  }
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
