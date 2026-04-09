/**
 * Shared type definitions for Recall Rogue multiplayer.
 * Used by lobby service, transport layer, game sync, and UI components.
 */

import type { EnemyIntent, EnemyInstance } from './enemies';
import type { StatusEffect } from './statusEffects';

/** Multiplayer game modes */
export type MultiplayerMode =
  | 'race'           // Same seed, independent play, compare scores
  | 'same_cards'     // Race + identical hands/shuffles
  | 'duel'           // Real-time head-to-head vs shared enemy
  | 'coop'           // Cooperative vs shared enemy
  | 'trivia_night';  // Pure quiz party mode

/** Deck selection strategy for the lobby */
export type DeckSelectionMode =
  | 'host_picks'     // Host chooses deck for all
  | 'each_picks'     // Each player picks their own
  | 'workshop_daily' // Server-selected Workshop deck of the day
  | 'vote'           // Players vote on deck
  | 'random';        // Random deck assigned

/** Fairness options for competitive modes */
export interface FairnessOptions {
  freshFactsOnly: boolean;      // Only FSRS state=new facts
  masteryEqualized: boolean;    // Everyone starts L0
  handicapPercent: number;      // Stronger player damage penalty (0-50)
  deckPracticeSecs: number;     // Pre-match deck browsing time (0=disabled)
  chainNormalized: boolean;     // Same chain types for all
}

/** House rules configurable in lobby */
export interface HouseRules {
  turnTimerSecs: number;        // 20 (speed) | 45 (standard) | 90 (relaxed)
  quizDifficulty: 'adaptive' | 'easy' | 'hard';
  fairness: FairnessOptions;
}

/** Content selection for a multiplayer lobby — replaces bare deckId */
export type LobbyContentSelection =
  | { type: 'study'; deckId: string; subDeckId?: string; deckName: string }
  | { type: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }
  | { type: 'custom_deck'; customDeckId: string; deckName: string }

/** A player in a multiplayer lobby */
export interface LobbyPlayer {
  id: string;                   // Platform-specific ID (Steam ID or user UUID)
  displayName: string;
  isHost: boolean;
  isReady: boolean;
  /** @deprecated Use contentSelection */
  selectedDeckId?: string;      // For 'each_picks' mode
  contentSelection?: LobbyContentSelection;
  elo?: number;                 // For ranked modes
}

/** Full lobby state */
export interface LobbyState {
  lobbyId: string;
  hostId: string;
  mode: MultiplayerMode;
  deckSelectionMode: DeckSelectionMode;
  /** @deprecated Use contentSelection */
  selectedDeckId?: string;      // For 'host_picks' mode
  contentSelection?: LobbyContentSelection;
  houseRules: HouseRules;
  players: LobbyPlayer[];
  maxPlayers: number;
  isRanked: boolean;
  lobbyCode?: string;           // 6-char join code
  seed?: number;                // Shared run seed (set when game starts)
  status: 'waiting' | 'ready' | 'starting' | 'in_game';
}

/** Race mode progress snapshot (sent at ~0.5 Hz) */
export interface RaceProgress {
  playerId: string;
  floor: number;
  playerHp: number;
  playerMaxHp: number;
  /** Current block/shield value — populated in co-op mode for the partner HUD. */
  playerBlock?: number;
  score: number;
  accuracy: number;             // 0-1
  encountersWon: number;
  isFinished: boolean;
  result?: 'victory' | 'defeat' | 'retreat';
}

/** Race mode final results */
export interface RaceResults {
  players: Array<{
    playerId: string;
    displayName: string;
    score: number;
    floorReached: number;
    accuracy: number;
    factsAnswered: number;
    correctAnswers: number;
    duration: number;
    result: 'victory' | 'defeat' | 'retreat';
  }>;
  winnerId: string;
  seed: number;
}

/**
 * Authoritative snapshot of the shared enemy state broadcast by the host.
 * Used for coop enemy synchronization (initial anchor + end-of-turn reconcile).
 * Contains only the mutable fields that can change during combat —
 * template, maxHP, floor, and difficultyVariance are established at creation
 * and never change, so they are not included.
 */
export interface SharedEnemySnapshot {
  /** Current hit points (clamped 0..maxHP). */
  currentHP: number;
  /** Maximum hit points (after floor/coop scaling). Included so receivers can compute % correctly. */
  maxHP: number;
  /** Current block value. */
  block: number;
  /** Current combat phase (1 or 2). */
  phase: 1 | 2;
  /** Next action the enemy will take, as decided by the host. */
  nextIntent: EnemyIntent;
  /** Active status effects on the enemy. */
  statusEffects: StatusEffect[];
}

/**
 * Per-player damage delta sent at end-of-turn during coop.
 * Describes what a single player did to the enemy during their turn,
 * computed as (preTurnState − postTurnState). Host accumulates all deltas
 * and applies them to the pre-turn snapshot to produce the authoritative state.
 */
export interface EnemyTurnDelta {
  /** Player ID who generated this delta. Used by host for deterministic sort order. */
  playerId: string;
  /** Net HP damage dealt to the enemy this turn (post-block absorption, pre-clamp). */
  damageDealt: number;
  /** Amount of block stripped from the enemy this turn. */
  blockDealt: number;
  /** Status effects applied to the enemy by this player this turn. */
  statusEffectsAdded: StatusEffect[];
}

// Re-export imported types so callers that import from multiplayerTypes get them
export type { EnemyIntent, EnemyInstance, StatusEffect };

/** Default house rules */
export const DEFAULT_HOUSE_RULES: HouseRules = {
  turnTimerSecs: 45,
  quizDifficulty: 'adaptive',
  fairness: {
    freshFactsOnly: false,
    masteryEqualized: false,
    handicapPercent: 0,
    deckPracticeSecs: 0,
    chainNormalized: false,
  },
};

/** Max players per mode */
export const MODE_MAX_PLAYERS: Record<MultiplayerMode, number> = {
  race: 4,
  same_cards: 2,
  duel: 2,
  coop: 2,
  trivia_night: 8,
};

/** Mode display names */
export const MODE_DISPLAY_NAMES: Record<MultiplayerMode, string> = {
  race: 'Race Mode',
  same_cards: 'Same Cards',
  duel: 'Knowledge Duel',
  coop: 'Co-op',
  trivia_night: 'Trivia Night',
};

/** Mode descriptions */
export const MODE_DESCRIPTIONS: Record<MultiplayerMode, string> = {
  race: 'Both players run the same dungeon independently. Same enemies, same layout \u2014 race to the highest score.',
  same_cards: 'Everything is identical \u2014 same cards, same draws, same shuffles. The only difference is you.',
  duel: 'Face-to-face battle. You share one enemy and take simultaneous turns. Outsmart your opponent.',
  coop: 'Team up against a tougher shared enemy. Combine your knowledge to survive.',
  trivia_night: 'No combat, no cards \u2014 just rapid-fire quiz rounds for up to 8 players.',
};

/** Short taglines for mode cards */
export const MODE_TAGLINES: Record<MultiplayerMode, string> = {
  race: 'Race to the highest score',
  same_cards: 'Pure skill, zero luck',
  duel: 'Outsmart your opponent',
  coop: 'Survive together',
  trivia_night: 'Party quiz for up to 8',
};
