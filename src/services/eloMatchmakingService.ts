/**
 * ELO rating and matchmaking service for ranked multiplayer.
 *
 * Rating system:
 * - Starting ELO: 1000
 * - K-factor: 32 for first 20 games, 16 after (settles rating faster for new players)
 * - Standard ELO formula: E = 1 / (1 + 10^((Rb-Ra)/400))
 *
 * Matchmaking queue:
 * - Pairs players within 200 ELO initially
 * - Widens to 400 after 30s
 * - Matches anyone after 60s
 * - Falls back to AI opponent after 90s
 *
 * Storage:
 * - Ratings and match history persisted to localStorage.
 * - In production these would be server-side; client-local is the v1 approach
 *   while the Fastify backend is pending.
 *
 * Queue simulation:
 * - No real server queue yet. Client-side timers track band widening.
 * - After AI_FALLBACK_AFTER_MS, generates a synthetic AI opponent entry.
 * - The actual server-side matchmaking will be wired when the Fastify backend ships.
 */

import type { MultiplayerMode } from '../data/multiplayerTypes';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerRating {
  playerId: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestElo: number;
  lastMatchAt: number; // Unix timestamp (ms)
}

export interface MatchResult {
  matchId: string;
  mode: MultiplayerMode;
  player1Id: string;
  player2Id: string;
  player1Score: number;
  player2Score: number;
  winnerId: string | null; // null = draw
  player1EloChange: number;
  player2EloChange: number;
  timestamp: number;
  seed: number;
  ranked: boolean;
}

export interface QueueEntry {
  playerId: string;
  displayName: string;
  elo: number;
  mode: MultiplayerMode;
  joinedAt: number; // Unix timestamp (ms)
  deckId?: string;
}

export type MatchmakingState = 'idle' | 'searching' | 'matched' | 'timeout';

// ── Constants ─────────────────────────────────────────────────────────────────

export const STARTING_ELO = 1000;
/** K-factor for first 20 games — converges rating faster for new players. */
export const K_FACTOR_NEW = 32;
/** K-factor after 20 games — more stable, smaller swings. */
export const K_FACTOR_SETTLED = 16;
/** Games played threshold before K-factor drops from 32 to 16. */
export const K_FACTOR_THRESHOLD = 20;
/** Initial ELO band: only match players within ±200 ELO. */
export const INITIAL_ELO_BAND = 200;
/** Expanded ELO band after EXPAND_AFTER_MS: match within ±400. */
export const EXPANDED_ELO_BAND = 400;
/** Widen band from 200 → 400 after 30 seconds in queue. */
export const EXPAND_AFTER_MS = 30_000;
/** Match anyone (infinite band) after 60 seconds in queue. */
export const MATCH_ANYONE_AFTER_MS = 60_000;
/** Fall back to AI opponent after 90 seconds in queue. */
export const AI_FALLBACK_AFTER_MS = 90_000;
/** Maximum match history entries stored in localStorage. */
export const MAX_MATCH_HISTORY = 50;

// ── ELO Calculation ──────────────────────────────────────────────────────────

/**
 * Calculate expected win probability for player A against player B.
 *
 * Standard ELO formula: E = 1 / (1 + 10^((Rb - Ra) / 400))
 *
 * Returns a value in [0, 1] — 0.5 means even match, higher means A is favoured.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate ELO change for a player after a single match.
 *
 * @param playerRating   Current ELO of the player whose change is computed.
 * @param opponentRating Current ELO of the opponent.
 * @param actualScore    1 = win, 0.5 = draw, 0 = loss.
 * @param gamesPlayed    Total games played by this player (determines K-factor).
 * @returns Signed integer ELO delta (rounded to nearest integer).
 */
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  actualScore: number,
  gamesPlayed: number,
): number {
  const k = gamesPlayed < K_FACTOR_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_SETTLED;
  const expected = expectedScore(playerRating, opponentRating);
  return Math.round(k * (actualScore - expected));
}

/**
 * Process a match result and return the ELO deltas for both players.
 * Mutates the `PlayerRating` objects in place and returns the changes.
 *
 * @param player1  Player 1's current rating (mutated in place).
 * @param player2  Player 2's current rating (mutated in place).
 * @param winnerId The playerId of the winner, or null for a draw.
 * @returns The signed ELO changes applied to each player.
 */
export function processMatchResult(
  player1: PlayerRating,
  player2: PlayerRating,
  winnerId: string | null, // null = draw
): { player1Change: number; player2Change: number } {
  // Determine actual scores: 1=win, 0.5=draw, 0=loss
  let p1Score: number;
  let p2Score: number;

  if (winnerId === null) {
    p1Score = 0.5;
    p2Score = 0.5;
  } else if (winnerId === player1.playerId) {
    p1Score = 1;
    p2Score = 0;
  } else {
    p1Score = 0;
    p2Score = 1;
  }

  const player1Change = calculateEloChange(player1.elo, player2.elo, p1Score, player1.gamesPlayed);
  const player2Change = calculateEloChange(player2.elo, player1.elo, p2Score, player2.gamesPlayed);

  // Apply ELO changes
  player1.elo = Math.max(0, player1.elo + player1Change);
  player2.elo = Math.max(0, player2.elo + player2Change);

  // Update game counts
  player1.gamesPlayed++;
  player2.gamesPlayed++;

  const now = Date.now();
  player1.lastMatchAt = now;
  player2.lastMatchAt = now;

  // Update win/loss/draw
  if (winnerId === null) {
    player1.draws++;
    player2.draws++;
    // Win streak resets on draw
    player1.winStreak = 0;
    player2.winStreak = 0;
  } else if (winnerId === player1.playerId) {
    player1.wins++;
    player2.losses++;
    player1.winStreak++;
    player2.winStreak = 0;
  } else {
    player2.wins++;
    player1.losses++;
    player2.winStreak++;
    player1.winStreak = 0;
  }

  // Update bestElo records
  if (player1.elo > player1.bestElo) player1.bestElo = player1.elo;
  if (player2.elo > player2.bestElo) player2.bestElo = player2.elo;

  return { player1Change, player2Change };
}

// ── Local Rating Storage ──────────────────────────────────────────────────────

const STORAGE_KEY = 'recall_rogue_elo_ratings';
const MATCH_HISTORY_KEY = 'recall_rogue_match_history';

/**
 * Build a default PlayerRating for a new player.
 * Used when no stored rating exists.
 */
function buildDefaultRating(playerId: string): PlayerRating {
  return {
    playerId,
    elo: STARTING_ELO,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    bestElo: STARTING_ELO,
    lastMatchAt: 0,
  };
}

/**
 * Get a player's rating from localStorage, creating a default entry if none exists.
 *
 * Reads the full ratings map, extracts the player's entry, and returns it.
 * Does NOT write to storage — call `savePlayerRating` to persist changes.
 */
export function getPlayerRating(playerId: string): PlayerRating {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, PlayerRating>;
      if (map[playerId]) return map[playerId];
    }
  } catch (e) {
    console.warn('[eloMatchmakingService] Failed to read ratings from localStorage:', e);
  }
  return buildDefaultRating(playerId);
}

/**
 * Persist an updated PlayerRating to localStorage.
 * Merges into the existing ratings map (preserving other players' data).
 */
export function savePlayerRating(rating: PlayerRating): void {
  try {
    let map: Record<string, PlayerRating> = {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) map = JSON.parse(raw) as Record<string, PlayerRating>;
    map[rating.playerId] = rating;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('[eloMatchmakingService] Failed to save rating to localStorage:', e);
  }
}

/**
 * Get match history from localStorage.
 * Returns up to MAX_MATCH_HISTORY entries in chronological order (newest last).
 */
export function getMatchHistory(): MatchResult[] {
  try {
    const raw = localStorage.getItem(MATCH_HISTORY_KEY);
    if (raw) return JSON.parse(raw) as MatchResult[];
  } catch (e) {
    console.warn('[eloMatchmakingService] Failed to read match history from localStorage:', e);
  }
  return [];
}

/**
 * Append a match result to localStorage history.
 * Enforces MAX_MATCH_HISTORY limit via FIFO eviction.
 */
export function saveMatchResult(result: MatchResult): void {
  try {
    const history = getMatchHistory();
    history.push(result);
    // Evict oldest entries beyond limit
    const trimmed = history.length > MAX_MATCH_HISTORY
      ? history.slice(history.length - MAX_MATCH_HISTORY)
      : history;
    localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[eloMatchmakingService] Failed to save match result to localStorage:', e);
  }
}

// ── Matchmaking Queue ─────────────────────────────────────────────────────────

let _queueState: MatchmakingState = 'idle';
let _queueEntry: QueueEntry | null = null;
let _queueCheckInterval: ReturnType<typeof setInterval> | null = null;
let _onMatchFound: ((opponent: QueueEntry) => void) | null = null;
let _onQueueStateChange: ((state: MatchmakingState) => void) | null = null;

function setQueueState(state: MatchmakingState): void {
  _queueState = state;
  _onQueueStateChange?.(state);
}

/**
 * Get the current matchmaking state.
 */
export function getMatchmakingState(): MatchmakingState {
  return _queueState;
}

/**
 * Get the current ELO band based on time spent in queue.
 *
 * - 0–30s:  INITIAL_ELO_BAND (200)
 * - 30–60s: EXPANDED_ELO_BAND (400)
 * - 60s+:   Infinity (match anyone)
 * - Not in queue: INITIAL_ELO_BAND (default)
 */
export function getCurrentEloBand(): number {
  if (!_queueEntry) return INITIAL_ELO_BAND;
  const elapsed = Date.now() - _queueEntry.joinedAt;
  if (elapsed > MATCH_ANYONE_AFTER_MS) return Infinity;
  if (elapsed > EXPAND_AFTER_MS) return EXPANDED_ELO_BAND;
  return INITIAL_ELO_BAND;
}

/**
 * Join the matchmaking queue.
 *
 * Starts a client-side timer that simulates queue band widening.
 * After AI_FALLBACK_AFTER_MS with no human match found, automatically
 * invokes onMatchFound with a synthetic AI opponent entry.
 *
 * In production this will POST to the Fastify matchmaking endpoint, which
 * maintains a global queue and emits matches via WebSocket.
 */
export function joinQueue(
  playerId: string,
  displayName: string,
  mode: MultiplayerMode,
  elo: number,
  deckId?: string,
): void {
  // Prevent double-joining
  if (_queueState === 'searching') return;

  _queueEntry = {
    playerId,
    displayName,
    elo,
    mode,
    joinedAt: Date.now(),
    deckId,
  };

  setQueueState('searching');

  // Poll every 500 ms to check band thresholds and trigger AI fallback.
  // In production this poll would check a server-side match notification.
  _queueCheckInterval = setInterval(() => {
    if (!_queueEntry) {
      _clearQueueInterval();
      return;
    }

    const elapsed = Date.now() - _queueEntry.joinedAt;

    if (elapsed >= AI_FALLBACK_AFTER_MS) {
      _clearQueueInterval();
      // Generate a synthetic AI opponent near the player's ELO (±100)
      const spread = 100;
      const aiElo = Math.max(100, elo + Math.round((Math.random() * 2 - 1) * spread));
      const aiOpponent: QueueEntry = {
        playerId: `ai_${Date.now()}`,
        displayName: 'AI Opponent',
        elo: aiElo,
        mode,
        joinedAt: Date.now(),
        deckId: undefined,
      };
      setQueueState('matched');
      _onMatchFound?.(aiOpponent);
      _queueEntry = null;
    }
  }, 500);
}

function _clearQueueInterval(): void {
  if (_queueCheckInterval !== null) {
    clearInterval(_queueCheckInterval);
    _queueCheckInterval = null;
  }
}

/**
 * Leave the matchmaking queue.
 * Clears timers and resets state to idle.
 */
export function leaveQueue(): void {
  _clearQueueInterval();
  _queueEntry = null;
  setQueueState('idle');
}

/**
 * Register a callback invoked when a match is found.
 * Returns an unsubscribe function.
 *
 * The callback receives the opponent's QueueEntry.
 * For AI fallback matches, opponent.playerId starts with 'ai_'.
 */
export function onMatchFound(cb: (opponent: QueueEntry) => void): () => void {
  _onMatchFound = cb;
  return () => { _onMatchFound = null; };
}

/**
 * Register a callback invoked when the matchmaking state changes.
 * Returns an unsubscribe function.
 */
export function onQueueStateChange(cb: (state: MatchmakingState) => void): () => void {
  _onQueueStateChange = cb;
  return () => { _onQueueStateChange = null; };
}

// ── Rating Display Helpers ────────────────────────────────────────────────────

/** Rank tier thresholds and display info. */
export interface RankTier {
  name: string;
  color: string;
}

/**
 * Get the rank tier for a given ELO rating.
 *
 * Tiers (ascending): Novice → Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster
 */
export function getRankTier(elo: number): RankTier {
  if (elo >= 2000) return { name: 'Grandmaster', color: '#ff4444' };
  if (elo >= 1800) return { name: 'Master',      color: '#ff8800' };
  if (elo >= 1600) return { name: 'Diamond',     color: '#44bbff' };
  if (elo >= 1400) return { name: 'Platinum',    color: '#44ffaa' };
  if (elo >= 1200) return { name: 'Gold',        color: '#ffd700' };
  if (elo >= 1000) return { name: 'Silver',      color: '#c0c0c0' };
  if (elo >=  800) return { name: 'Bronze',      color: '#cd7f32' };
  return                  { name: 'Novice',      color: '#888888' };
}

/**
 * Format an ELO change value for display.
 *
 * Positive changes are prefixed with '+', negative values include '-' naturally.
 * Examples: +15, -8, +0
 */
export function formatEloChange(change: number): string {
  return change >= 0 ? `+${change}` : `${change}`;
}
