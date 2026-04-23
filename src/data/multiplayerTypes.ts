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

/**
 * Lobby visibility — how a lobby shows up in the public browser.
 * - 'public' → appears in the browser, anyone can join.
 * - 'password' → appears in the browser with a 🔒 badge; join requires the password.
 * - 'friends_only' → not listed in the public browser. On Steam uses SteamLobbyType::FriendsOnly;
 *                    on web / broadcast degrades to code-only (reachable only via invite code).
 */
export type LobbyVisibility = 'public' | 'password' | 'friends_only';

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
  ascensionLevel: number;   // 0 = off, 1-20 = ascension level for the lobby
}

/** Content selection for a multiplayer lobby — replaces bare deckId */
export type LobbyContentSelection =
  /**
   * @deprecated Use 'study-multi' for new code. Single-deck single-subdeck selection.
   */
  | { type: 'study'; deckId: string; subDeckId?: string; deckName: string }
  /**
   * @deprecated Use 'study-multi' for new code. Trivia domains only — no study decks.
   */
  | { type: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }
  | { type: 'custom_deck'; customDeckId: string; deckName: string }
  /**
   * Multi-deck selection: one or more study decks (optionally narrowed to sub-decks)
   * plus optional trivia domains. Introduced Issue 2 (2026-04-11).
   * Use this variant for all new lobby content selection code.
   */
  | {
      type: 'study-multi';
      decks: Array<{
        deckId: string;
        deckName: string;
        /** Sub-deck IDs to include, or 'all' for the full deck. */
        subDeckIds: string[] | 'all';
      }>;
      /** Trivia domain IDs that can coexist with study decks. */
      triviaDomains: string[];
    }

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
  /**
   * H10 (reconnect grace): connection state of this player. 'connected' is the
   * default; 'reconnecting' means the peer dropped and the 60s grace timer is running.
   * Primitive only — UI reads this to show a reconnecting badge.
   */
  connectionState?: 'connected' | 'reconnecting';
  /**
   * H13 (ready-version merge): monotonic counter incremented on each setReady() call.
   * Broadcast with mp:lobby:ready so settings-merge logic can detect stale incoming
   * ready states and preserve the fresher local value.
   */
  readyVersion?: number;
  /**
   * #80: Real Elo rating of this player, populated on join from getLocalMultiplayerRating().
   * Optional for back-compat with peers that have not yet updated.
   * Used at race/duel end to compute accurate Elo deltas instead of the 1500 default.
   */
  multiplayerRating?: number;
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
  /**
   * Optional host-supplied title for the lobby, shown in the browser as the
   * primary label. When absent the browser falls back to hostName.
   * Max 40 chars — enforced by sanitizeLobbyTitle() at creation time.
   */
  title?: string;
  seed?: number;                // Shared run seed (set when game starts)
  status: 'waiting' | 'ready' | 'starting' | 'in_game';
  /**
   * Visibility in the public browser. Default 'public'.
   * Use `lobbyHasPassword(lobby)` from multiplayerLobbyService to derive the boolean — do not store a copy.
   */
  visibility: LobbyVisibility;
}

/**
 * One row in the lobby browser. Built by a backend's `listPublicLobbies` implementation
 * from the authoritative lobby state and presented to `LobbyBrowserScreen.svelte`.
 * `friends_only` lobbies are filtered out on the web/broadcast paths (no friends graph);
 * on Steam the friends filter is enforced by Steam Matchmaking itself.
 */
export interface LobbyBrowserEntry {
  lobbyId: string;
  hostName: string;
  mode: MultiplayerMode;
  currentPlayers: number;
  maxPlayers: number;
  visibility: LobbyVisibility;
  /** Optional fairness rating from `fairnessService` (0-100). */
  fairnessRating?: number;
  /** Epoch ms of lobby creation — drives the "new" pulse on recently-created tiles. */
  createdAt: number;
  /**
   * Optional host-supplied lobby title. When present, shown as the primary label
   * in the browser card; hostName is rendered as secondary text below.
   * Max 40 chars (sanitizeLobbyTitle enforced). Absent when no title was set.
   */
  title?: string;
  /** Which backend served this entry. Shown as a badge in the browser header. */
  source: 'steam' | 'web' | 'broadcast';
}

/** Filter for listing public lobbies. */
export interface LobbyListFilter {
  mode?: MultiplayerMode;
  /** 'open' excludes full lobbies; 'any' includes them. */
  fullness?: 'any' | 'open';
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
  /**
   * Epoch ms when this player finished the race.
   * Set at the moment isFinished flips to true — used for accurate duration computation
   * on the results screen. Undefined for in-progress broadcasts.
   */
  finishedAt?: number;
  /**
   * Total correct quiz answers answered during this race.
   * Replaces the encountersWon * 3 heuristic when provided.
   */
  correctCount?: number;
  /**
   * Total wrong quiz answers answered during this race.
   * Replaces the derived wrong-count formula when provided.
   */
  wrongCount?: number;
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
  /**
   * ID of the winning player, or null when the race ends in a tie.
   */
  winnerId: string | null;
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

/**
 * CT-001 (MP-AUDIT-2026-04-23-OPUS-A-CT-001): Payload for mp:coop:rest_action.
 * Broadcast by a player when they choose a rest-site action.
 * Partner receives this for awareness UI. Both players advance only after the
 * mp:coop:rest_done barrier resolves (awaitCoopRestResolution).
 */
export interface CoopRestActionPayload {
  /** The player who acted. */
  playerId: string;
  /** Which rest action was taken. */
  action: 'heal' | 'study' | 'meditate' | 'upgrade';
  /** Optional context for UI narration: HP gained, etc. */
  payload?: {
    hpGained?: number;
  };
}

/**
 * CT-001 (MP-AUDIT-2026-04-23-OPUS-A-CT-001): Payload for mp:coop:rest_done.
 * Sent by each player once their local rest action is complete.
 * Both players advance to dungeonMap only when all have signaled.
 */
export interface CoopRestDonePayload {
  playerId: string;
}

/**
 * CM-001 (MP-AUDIT-2026-04-23-OPUS-A-CM-001): Payload for mp:coop:mystery_event.
 * Host-only broadcast: the host generates the mystery event and sends it to all players
 * so both see the same event. Non-host waits for this before setting activeMysteryEvent.
 */
export interface CoopMysteryEventPayload {
  /** Serialised MysteryEvent. Non-host sets activeMysteryEvent from this. */
  event: {
    id: string;
    name: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effect: any;
    requiresStudyMode?: boolean;
  };
}

/**
 * CM-001 (MP-AUDIT-2026-04-23-OPUS-A-CM-001): Payload for mp:coop:mystery_done.
 * Sent by each player once they have finished their local mystery resolution.
 * Both players advance to dungeonMap only when all have signaled.
 */
export interface CoopMysteryDonePayload {
  playerId: string;
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
  ascensionLevel: 0,
};

/** Max players per mode — acts as the cap for the host's max-players selector. */
export const MODE_MAX_PLAYERS: Record<MultiplayerMode, number> = {
  race: 4,
  same_cards: 2,
  duel: 2,
  coop: 2,
  trivia_night: 8,
};

/** Min players per mode — the floor for the host's max-players selector. */
export const MODE_MIN_PLAYERS: Record<MultiplayerMode, number> = {
  race: 2,
  same_cards: 2,
  duel: 2,
  coop: 2,
  trivia_night: 2,
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
