/**
 * Steam Achievement definitions for Recall Rogue.
 *
 * Each entry maps an in-game achievement milestone to the exact Steamworks API ID
 * registered in the Steamworks Partner portal. The `id` values here must match
 * the API Names set in the portal exactly (case-sensitive).
 *
 * Achievement unlock calls go through `steamService.unlockAchievement(id)`, which
 * guards the Steam API call behind `hasSteam` and silently no-ops on web/mobile.
 *
 * See also: AR-80 (Steam Integration) and `src/services/steamService.ts`.
 */

export interface SteamAchievement {
  /** Steamworks API Name — must match the portal exactly. */
  id: string;
  /** Human-readable title shown in Steam overlay and achievement list. */
  name: string;
  /** Short description shown under the achievement title. */
  description: string;
}

export const STEAM_ACHIEVEMENTS: SteamAchievement[] = [
  // ── Run Progression ────────────────────────────────────────────────────────

  {
    id: 'FIRST_RUN',
    name: 'Down You Go',
    description: 'Complete your first run.',
  },
  {
    id: 'REACH_ACT_2',
    name: 'Into the Depths',
    description: 'Reach Act 2.',
  },
  {
    id: 'REACH_ACT_3',
    name: 'The Archive',
    description: 'Reach Act 3.',
  },
  {
    id: 'DEFEAT_CURATOR',
    name: 'Overdue',
    description: 'Defeat The Curator.',
  },

  // ── Chain Mastery ──────────────────────────────────────────────────────────

  {
    id: 'CHAIN_5',
    name: 'Linked',
    description: 'Build a 5-card Chain in a single turn.',
  },

  // ── Fact Mastery ───────────────────────────────────────────────────────────

  {
    id: 'MASTER_10',
    name: 'It Sticks',
    description: 'Master 10 facts.',
  },
  {
    id: 'MASTER_50',
    name: 'Long Memory',
    description: 'Master 50 facts.',
  },
  {
    id: 'MASTER_100',
    name: 'Cannot Forget',
    description: 'Master 100 facts.',
  },

  // ── Combat Performance ─────────────────────────────────────────────────────

  {
    id: 'PERFECT_ENCOUNTER',
    name: 'Not a Scratch',
    description: 'Win an encounter without taking damage.',
  },
  {
    id: 'PERFECT_ACCURACY',
    name: 'Clean Run',
    description: 'Finish a run with 100% Charge accuracy.',
  },

  // ── Ascension ─────────────────────────────────────────────────────────────

  {
    id: 'ASCENSION_1',
    name: 'Harder Way Down',
    description: 'Complete a run at Ascension 1.',
  },
  {
    id: 'ASCENSION_10',
    name: 'The Pit',
    description: 'Complete a run at Ascension 10.',
  },

  // ── Collection ────────────────────────────────────────────────────────────

  {
    id: 'RELIC_COLLECTOR',
    name: 'Nothing Left Behind',
    description: 'Find every relic at least once.',
  },
  {
    id: 'ALL_DOMAINS',
    name: 'Broad Education',
    description: 'Win a run in every knowledge domain.',
  },
];

/**
 * Convenience lookup: get a Steam achievement definition by its API ID.
 * Returns undefined if the ID is not found.
 */
export function getSteamAchievement(id: string): SteamAchievement | undefined {
  return STEAM_ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * All registered Steamworks API IDs as a string union — useful for
 * type-checking calls to `unlockAchievement`.
 */
export type SteamAchievementId = (typeof STEAM_ACHIEVEMENTS)[number]['id'];
