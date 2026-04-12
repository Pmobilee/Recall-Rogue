/**
 * Steam achievement definitions for Recall Rogue.
 *
 * IDs MUST match the API names registered in the Steamworks dashboard under
 * App Admin → Achievements. The name and description fields are display strings
 * for in-code documentation only — the authoritative display strings live in
 * the Steamworks dashboard and are returned by the Steam overlay at runtime.
 */

export interface SteamAchievementDef {
  /** Steamworks API name — must match dashboard exactly. */
  id: string;
  /** Short display name (documentation reference). */
  name: string;
  /** Description shown in the Steam overlay (documentation reference). */
  description: string;
}

export const STEAM_ACHIEVEMENTS: SteamAchievementDef[] = [
  // ── Combat milestones ────────────────────────────────────────────────────────
  {
    id: 'FIRST_VICTORY',
    name: 'First Blood',
    description: 'Win your first combat encounter.',
  },
  {
    id: 'BOSS_SLAYER',
    name: 'Boss Slayer',
    description: 'Defeat a boss.',
  },
  {
    id: 'PERFECT_ENCOUNTER',
    name: 'Flawless Scholar',
    description: 'Win a combat encounter with 100% quiz accuracy.',
  },
  {
    id: 'ELITE_SLAYER',
    name: 'Elite Hunter',
    description: 'Defeat 10 elite enemies across all runs.',
  },

  // ── Run milestones ───────────────────────────────────────────────────────────
  {
    id: 'FIRST_RUN_COMPLETE',
    name: "The Scholar's Journey",
    description: 'Complete a run (retreat or victory).',
  },
  {
    id: 'FLOOR_5',
    name: 'Deeper Knowledge',
    description: 'Reach floor 5.',
  },
  {
    id: 'FLOOR_12',
    name: 'Into the Depths',
    description: 'Reach floor 12.',
  },
  {
    id: 'FLOOR_24',
    name: 'The Final Test',
    description: 'Reach floor 24.',
  },

  // ── Knowledge / streak ───────────────────────────────────────────────────────
  {
    id: 'STREAK_10',
    name: 'Chain Master',
    description: 'Achieve a 10-answer streak in a single run.',
  },
  {
    id: 'STREAK_25',
    name: 'Unstoppable Mind',
    description: 'Achieve a 25-answer streak in a single run.',
  },
  {
    id: 'FACTS_100',
    name: 'Century of Knowledge',
    description: 'Answer 100 facts correctly across all runs.',
  },
  {
    id: 'FACTS_1000',
    name: 'Encyclopedic Mind',
    description: 'Answer 1000 facts correctly across all runs.',
  },
  {
    id: 'FACTS_5000',
    name: 'Grand Librarian',
    description: 'Answer 5000 facts correctly across all runs.',
  },

  // ── Character level ──────────────────────────────────────────────────────────
  {
    id: 'LEVEL_5',
    name: 'Novice',
    description: 'Reach character level 5.',
  },
  {
    id: 'LEVEL_15',
    name: 'Adept',
    description: 'Reach character level 15.',
  },
  {
    id: 'LEVEL_25',
    name: 'Grand Scholar',
    description: 'Reach character level 25.',
  },

  // ── Collection ───────────────────────────────────────────────────────────────
  {
    id: 'RELIC_COLLECTOR',
    name: 'Relic Hoarder',
    description: 'Collect 5 relics in a single run.',
  },

  // ── Ascension ────────────────────────────────────────────────────────────────
  {
    id: 'ASCENSION_1',
    name: 'Rising Challenge',
    description: 'Complete a run at Ascension 1 or higher.',
  },
  {
    id: 'ASCENSION_5',
    name: 'True Scholar',
    description: 'Complete a run at Ascension 5 or higher.',
  },

  // ── Mastery / learning progression ───────────────────────────────────────────
  {
    id: 'MASTERY_FIRST',
    name: 'First Mastery',
    description: 'Master your first fact.',
  },
  {
    id: 'MASTERY_100',
    name: 'Centurion Scholar',
    description: 'Master 100 facts across all runs.',
  },
  {
    id: 'MASTERY_500',
    name: 'Living Encyclopedia',
    description: 'Master 500 facts across all runs.',
  },

  // ── Play streak ──────────────────────────────────────────────────────────────
  {
    id: 'STREAK_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day play streak.',
  },

  // ── Exploration ──────────────────────────────────────────────────────────────
  {
    id: 'DECK_EXPLORER',
    name: 'Deck Explorer',
    description: 'Complete a run using 5 different curated decks.',
  },
];
