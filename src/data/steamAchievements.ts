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
    name: 'First Steps',
    description: 'Complete your first run.',
  },
  {
    id: 'REACH_ACT_2',
    name: 'Into the Depths',
    description: 'Reach Act 2 — The Depths.',
  },
  {
    id: 'REACH_ACT_3',
    name: 'The Archive Awaits',
    description: 'Reach Act 3 — The Archive.',
  },
  {
    id: 'DEFEAT_CURATOR',
    name: 'Knowledge is Power',
    description: 'Defeat The Curator, guardian of the Archive.',
  },

  // ── Chain Mastery ──────────────────────────────────────────────────────────

  {
    id: 'CHAIN_5',
    name: 'Chain Master',
    description: 'Build a 5-card Knowledge Chain in a single turn.',
  },

  // ── Fact Mastery ───────────────────────────────────────────────────────────

  {
    id: 'MASTER_10',
    name: 'Scholar',
    description: 'Reach Tier 3 (Mastered) on 10 facts.',
  },
  {
    id: 'MASTER_50',
    name: 'Professor',
    description: 'Reach Tier 3 (Mastered) on 50 facts.',
  },
  {
    id: 'MASTER_100',
    name: 'Sage',
    description: 'Reach Tier 3 (Mastered) on 100 facts.',
  },

  // ── Combat Performance ─────────────────────────────────────────────────────

  {
    id: 'PERFECT_ENCOUNTER',
    name: 'Untouchable',
    description: 'Win an encounter without taking any damage.',
  },
  {
    id: 'PERFECT_ACCURACY',
    name: 'Flawless Mind',
    description: 'Complete a full run with 100% Charge accuracy.',
  },

  // ── Ascension ─────────────────────────────────────────────────────────────

  {
    id: 'ASCENSION_1',
    name: 'Rising Challenge',
    description: 'Complete a run at Ascension Level 1.',
  },
  {
    id: 'ASCENSION_10',
    name: 'Ascended',
    description: 'Complete a run at Ascension Level 10.',
  },

  // ── Collection ────────────────────────────────────────────────────────────

  {
    id: 'RELIC_COLLECTOR',
    name: 'Relic Hunter',
    description: 'Find every relic at least once across all your runs.',
  },
  {
    id: 'ALL_DOMAINS',
    name: 'Renaissance',
    description: 'Complete a run in each knowledge domain at least once.',
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
