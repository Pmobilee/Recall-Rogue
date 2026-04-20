/**
 * Workshop deck integration for multiplayer lobbies.
 *
 * Enables:
 * - In-lobby deck browsing from Workshop
 * - Auto-subscribe all players when host selects a Workshop deck
 * - Deck voting in 4-player lobbies
 * - "Deck of the Day" community events
 * - Post-match deck rating
 * - Pre-flight check that all players have a required Workshop deck installed (H16)
 * - Metadata validation for Workshop deck updates received via mp:lobby:deck_select (M14)
 *
 * Transport message types used here:
 *   mp:lobby:deck_select         — host broadcasts chosen Workshop deck to all lobby members
 *   mp:workshop:deck_selected    — (legacy alias) same as above
 *   mp:workshop:vote_submit      — player submits a deck vote
 *   mp:workshop:vote_result      — host broadcasts the winning workshopId
 *   mp:workshop:deck_check       — host asks all clients if a Workshop deck is installed
 *   mp:workshop:deck_check_ack   — client responds with installed status
 *
 * See docs/architecture/services/index.md for service catalog entry.
 */

import { getMultiplayerTransport } from './multiplayerTransport';
import { isWorkshopAvailable } from './workshopService';
import type { WorkshopDeck } from './workshopService';
import type { MultiplayerMessageType } from './multiplayerTransport';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal lobby-safe preview of a Workshop deck (no fact content). */
export interface WorkshopDeckPreview {
  workshopId: string;
  title: string;
  author: string;
  description: string;
  factCount: number;
  /** Aggregate star rating (1-5). */
  rating: number;
  ratingCount: number;
  domains: string[];
  subscriberCount: number;
  /** Unix timestamp (ms) of last update. */
  lastUpdated: number;
}

/** A single player's deck nomination in a vote round. */
export interface DeckVote {
  playerId: string;
  workshopId: string;
}

/** Deck of the Day entry (deterministic per-date pick). */
export interface DeckOfTheDay {
  workshopId: string;
  title: string;
  /** ISO date string YYYY-MM-DD. */
  date: string;
  featuredReason?: string;
}

/** Post-match rating submitted by one player for the Workshop deck played. */
export interface DeckRating {
  workshopId: string;
  playerId: string;
  /** Fun factor 1-5. */
  fun: number;
  /** Perceived difficulty 1-5. */
  difficulty: number;
  /** Content quality 1-5. */
  quality: number;
  /** Unix timestamp (ms) of submission. */
  timestamp: number;
}

/**
 * Result of the pre-flight deck-check before the host starts a Workshop game.
 *
 * `missing` holds the player IDs of any players who either do not have the
 * deck installed or did not respond within the ACK timeout window.
 * An empty `missing` array means all players are ready to play.
 */
export interface WorkshopDeckCheckResult {
  missing: string[];
}

/**
 * Validation result for Workshop deck metadata received over the wire.
 *
 * On success, `ok` is `true`.
 * On failure, `ok` is `false` and `reason` is a short dev-facing description
 * of the constraint that was violated (not displayed verbatim to the player —
 * the UI layer owns the player-facing message).
 */
export type WorkshopMetaValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

// ── Module-level state ────────────────────────────────────────────────────────

/** Current vote round: maps playerId → their nominated workshopId. */
let _votes: Map<string, DeckVote> = new Map();

/** Callback invoked when a vote round resolves with a winner. */
let _onVoteResultCb: ((winnerId: string) => void) | null = null;

/** Pending message-handler unsubscribe functions (cleared on destroy). */
const _cleanupFns: (() => void)[] = [];

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * How long (ms) the host waits for deck-check ACKs before treating non-ACKing
 * players as "deck not installed / unknown."
 */
const DECK_CHECK_ACK_TIMEOUT_MS = 2000;

// HTML-like tag pattern: any `<…>` sequence is rejected.
const HTML_TAG_PATTERN = /<[^>]+>/;

// ── Deck Browsing ─────────────────────────────────────────────────────────────

/**
 * Convert a WorkshopDeck metadata object into the lobby-safe preview format.
 * Pure helper — no side effects.
 */
function toPreview(deck: WorkshopDeck): WorkshopDeckPreview {
  const total = deck.upvotes + deck.downvotes;
  const rating = total > 0 ? Math.round(((deck.upvotes / total) * 4 + 1) * 10) / 10 : 0;
  return {
    workshopId: deck.workshopId,
    title: deck.title,
    author: deck.authorName,
    description: deck.description,
    factCount: 0, // fact count is not available in metadata-only WorkshopDeck
    rating,
    ratingCount: total,
    domains: deck.tags,
    subscriberCount: deck.subscriberCount,
    lastUpdated: deck.updatedAt * 1000, // convert seconds → ms
  };
}

/**
 * Return locally installed Workshop decks as lobby-browsable previews.
 *
 * Reads from localStorage under the key `workshop_installed_decks` which is
 * maintained by workshopService when decks are downloaded. In production the
 * Steamworks UGC layer writes this; in dev/web it falls back to an empty list.
 */
export function getInstalledWorkshopDecks(): WorkshopDeckPreview[] {
  try {
    const raw = localStorage.getItem('workshop_installed_decks');
    if (!raw) return [];
    const decks = JSON.parse(raw) as WorkshopDeck[];
    return decks.map(toPreview);
  } catch {
    return [];
  }
}

/**
 * Request all lobby members subscribe to a Workshop deck (host action).
 *
 * On a real Steam build this would trigger UGC subscribe for each remote
 * player via Tauri IPC. For now it broadcasts the selection so the lobby UI
 * can reflect the chosen deck immediately.
 *
 * @param workshopId  - Steam Workshop item ID to subscribe to.
 * @param lobbyPlayerIds - IDs of all players in the lobby (host included).
 * @returns true if the broadcast was sent; false if Workshop is unavailable.
 */
export async function subscribeAllToWorkshopDeck(
  workshopId: string,
  lobbyPlayerIds: string[],
): Promise<boolean> {
  if (!isWorkshopAvailable()) {
    console.warn('[multiplayerWorkshopService] subscribeAllToWorkshopDeck: Workshop not available');
    return false;
  }

  // TODO: When Tauri UGC commands are wired, call steam_ugc_subscribe for each
  // remote player's client via a server-side relay or lobby message fan-out.
  // For now, broadcast via transport so all clients update their lobby preview.
  const preview = getInstalledWorkshopDecks().find(d => d.workshopId === workshopId);
  if (!preview) {
    console.warn('[multiplayerWorkshopService] subscribeAllToWorkshopDeck: deck not found locally', workshopId);
    return false;
  }

  broadcastWorkshopDeckSelection(preview);

  // Log which players should receive the subscribe request.
  console.info(
    '[multiplayerWorkshopService] Requested subscribe for',
    lobbyPlayerIds.length,
    'players to workshopId', workshopId,
  );
  return true;
}

/**
 * Broadcast the host's chosen Workshop deck preview to all lobby members.
 * Non-host clients update their lobby state via the transport listener wired
 * in `initWorkshopMessageHandlers()`.
 */
export function broadcastWorkshopDeckSelection(deck: WorkshopDeckPreview): void {
  const transport = getMultiplayerTransport();
  transport.send('mp:lobby:deck_select', deck as unknown as Record<string, unknown>);
}

// ── H16 — Workshop Deck Install Pre-Flight ────────────────────────────────────

/**
 * Ask every player in `playerIds` whether they have `workshopItemId` installed,
 * then return the IDs of any players who either answered "no" or did not
 * respond within DECK_CHECK_ACK_TIMEOUT_MS (2 s).
 *
 * Host calls this before allowing `startGame()`. If the returned `missing`
 * array is non-empty, the lobby start must be blocked until every player has
 * installed the deck. The UI layer is responsible for rendering the block
 * message — this function returns structured data only.
 *
 * Protocol:
 *   1. Host sends `mp:workshop:deck_check { workshopItemId, requestId }` to all peers.
 *   2. Each client receives the message, checks localStorage for the deck, and
 *      replies with `mp:workshop:deck_check_ack { requestId, playerId, installed }`.
 *   3. Host waits up to 2 s; any player that has not ACK'd with `installed: true`
 *      is counted as missing.
 *
 * @param workshopItemId - Steam Workshop item ID to check.
 * @param playerIds      - All player IDs in the lobby (host included).
 * @returns `{ missing }` — IDs of players who do not have the deck.
 */
export async function checkAllPlayersHaveWorkshopDeck(
  workshopItemId: string,
  playerIds: string[],
  localPlayerId?: string,
): Promise<WorkshopDeckCheckResult> {
  const transport = getMultiplayerTransport();
  const requestId = `deckcheck_${workshopItemId}_${Date.now()}`;

  // Track which players have confirmed installation.
  const confirmed = new Set<string>();

  // #71 Host self-check fix: transport messages don't loop back to the sender,
  // so the host will never receive its own deck_check_ack. Pre-populate confirmed
  // with the host's own ID if the host has the deck installed locally.
  if (localPlayerId && playerIds.includes(localPlayerId)) {
    const hostHasDeck = getInstalledWorkshopDecks().some(d => d.workshopId === workshopItemId);
    if (hostHasDeck) {
      confirmed.add(localPlayerId);
    }
  }

  return new Promise<WorkshopDeckCheckResult>((resolve) => {
    // Subscribe to ACKs before sending the request to avoid a race.
    const unsub = transport.on(
      'mp:workshop:deck_check_ack' as MultiplayerMessageType,
      (msg) => {
        const { requestId: ackRequestId, playerId, installed } = msg.payload as {
          requestId: string;
          playerId: string;
          installed: boolean;
        };
        if (ackRequestId !== requestId) return;
        if (installed && playerId) {
          confirmed.add(playerId);
        }
      },
    );

    // Broadcast the check request to all peers.
    transport.send(
      'mp:workshop:deck_check' as MultiplayerMessageType,
      { workshopItemId, requestId },
    );

    // Resolve after the ACK window closes.
    setTimeout(() => {
      unsub();
      const missing = playerIds.filter(id => !confirmed.has(id));
      resolve({ missing });
    }, DECK_CHECK_ACK_TIMEOUT_MS);
  });
}

// ── M14 — Workshop Deck Metadata Validation ───────────────────────────────────

/**
 * Validate Workshop deck metadata received over the wire before applying it
 * to local lobby state.
 *
 * Constraints:
 *   - `title`:       1–100 characters, no HTML-like tags
 *   - `description`: 0–500 characters, no HTML-like tags
 *   - `factCount`:   1–5000
 *   - `author`:      0–64 characters
 *
 * Returns `{ ok: true }` on success.
 * Returns `{ ok: false, reason }` on failure — `reason` is dev-facing (e.g.
 * for logging); the UI layer owns the player-visible error message.
 *
 * @param meta - Partial deck metadata object (fields that are missing or of
 *               wrong type are treated as constraint violations).
 */
export function validateWorkshopDeckMetadata(
  meta: Partial<WorkshopDeckPreview>,
): WorkshopMetaValidationResult {
  const { title, description, factCount, author } = meta;

  // title: required, 1-100 chars, no HTML tags
  if (typeof title !== 'string' || title.length === 0) {
    return { ok: false, reason: 'title is required and must be a non-empty string' };
  }
  if (title.length > 100) {
    return { ok: false, reason: `title too long: ${title.length} > 100 characters` };
  }
  if (HTML_TAG_PATTERN.test(title)) {
    return { ok: false, reason: 'title contains HTML-like markup' };
  }

  // description: optional but if present must be ≤500 chars and no HTML tags
  if (description !== undefined) {
    if (typeof description !== 'string') {
      return { ok: false, reason: 'description must be a string' };
    }
    if (description.length > 500) {
      return { ok: false, reason: `description too long: ${description.length} > 500 characters` };
    }
    if (HTML_TAG_PATTERN.test(description)) {
      return { ok: false, reason: 'description contains HTML-like markup' };
    }
  }

  // factCount: required, 1-5000
  if (typeof factCount !== 'number' || !Number.isInteger(factCount)) {
    return { ok: false, reason: 'factCount must be an integer' };
  }
  if (factCount < 1) {
    return { ok: false, reason: `factCount too small: ${factCount} < 1` };
  }
  if (factCount > 5000) {
    return { ok: false, reason: `factCount too large: ${factCount} > 5000` };
  }

  // author: optional but if present must be ≤64 chars
  if (author !== undefined) {
    if (typeof author !== 'string') {
      return { ok: false, reason: 'author must be a string' };
    }
    if (author.length > 64) {
      return { ok: false, reason: `author too long: ${author.length} > 64 characters` };
    }
  }

  return { ok: true };
}

// ── Deck Voting ───────────────────────────────────────────────────────────────

/**
 * Submit a deck nomination/vote for this player.
 *
 * Stores locally and broadcasts to peers so tallies stay in sync on all
 * clients. Overwrites any prior vote from the same player.
 */
export function submitDeckVote(playerId: string, workshopId: string): void {
  _votes.set(playerId, { playerId, workshopId });
  const transport = getMultiplayerTransport();
  transport.send('mp:workshop:vote_submit', { playerId, workshopId });
}

/**
 * Return the current vote tally: workshopId → vote count.
 */
export function getVoteTally(): Map<string, number> {
  const tally = new Map<string, number>();
  for (const vote of _votes.values()) {
    tally.set(vote.workshopId, (tally.get(vote.workshopId) ?? 0) + 1);
  }
  return tally;
}

/**
 * Resolve the vote round and return the winning workshopId.
 *
 * Picks the deck with the most votes. Ties are broken randomly.
 * Broadcasts the result via transport and fires `_onVoteResultCb`.
 *
 * @returns The winning workshopId, or null if no votes have been cast.
 */
export function resolveVote(): string | null {
  const tally = getVoteTally();
  if (tally.size === 0) return null;

  // Collect all entries with the max vote count.
  let maxCount = 0;
  for (const count of tally.values()) {
    if (count > maxCount) maxCount = count;
  }
  const winners: string[] = [];
  for (const [id, count] of tally.entries()) {
    if (count === maxCount) winners.push(id);
  }

  // Random tiebreak among equals.
  const winnerId = winners[Math.floor(Math.random() * winners.length)];

  // Broadcast result so all clients agree.
  const transport = getMultiplayerTransport();
  transport.send('mp:workshop:vote_result', { workshopId: winnerId });
  _onVoteResultCb?.(winnerId);

  // Reset vote state for next round.
  _votes = new Map();

  return winnerId;
}

/**
 * Register a callback invoked when a vote round resolves (host or peer broadcast).
 *
 * @returns Unsubscribe function — call to remove the listener.
 */
export function onVoteResult(cb: (winnerId: string) => void): () => void {
  _onVoteResultCb = cb;
  return () => { _onVoteResultCb = null; };
}

// ── Deck of the Day ───────────────────────────────────────────────────────────

/**
 * Return today's Deck of the Day, chosen deterministically from installed
 * Workshop decks using the current date as a seed.
 *
 * Returns null when no Workshop decks are installed locally.
 */
export function getDeckOfTheDay(): DeckOfTheDay | null {
  const decks = getInstalledWorkshopDecks();
  if (decks.length === 0) return null;

  // Build a deterministic seed from YYYY-MM-DD so every client picks the same
  // deck on the same calendar day without any server coordination.
  const today = new Date();
  const dateStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  // Simple hash: sum char codes of the date string.
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = ((seed << 5) - seed + dateStr.charCodeAt(i)) | 0;
  }
  // Ensure positive index.
  const idx = Math.abs(seed) % decks.length;
  const chosen = decks[idx];

  return {
    workshopId: chosen.workshopId,
    title: chosen.title,
    date: dateStr,
    featuredReason: 'Algorithmically selected daily pick',
  };
}

// ── Post-Match Rating ─────────────────────────────────────────────────────────

/** In-memory buffer of ratings that haven't been flushed to the server yet. */
let _pendingRatings: DeckRating[] = [];

/** Maximum number of ratings persisted in localStorage. */
const MAX_LOCAL_RATINGS = 100;

/** How many milliseconds constitute "rated recently" (7 days). */
const RATING_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Submit a post-match deck rating.
 *
 * Appends to the in-memory pending list and persists to localStorage (capped
 * at the last 100 entries). In production, also POSTs to the server.
 */
export function submitDeckRating(rating: DeckRating): void {
  _pendingRatings.push(rating);
  try {
    const existing: DeckRating[] = JSON.parse(
      localStorage.getItem('mp_deck_ratings') ?? '[]',
    );
    existing.push(rating);
    localStorage.setItem(
      'mp_deck_ratings',
      JSON.stringify(existing.slice(-MAX_LOCAL_RATINGS)),
    );
  } catch {
    // Ignore storage errors (private browsing, quota, etc.)
  }
  // TODO: POST to server endpoint when backend is live.
}

/**
 * Determine whether the local player should be prompted to rate a deck.
 *
 * Returns false if the player has already rated this workshopId within the
 * last 7 days.
 */
export function shouldPromptRating(workshopId: string, playerId: string): boolean {
  try {
    const stored: DeckRating[] = JSON.parse(
      localStorage.getItem('mp_deck_ratings') ?? '[]',
    );
    const cutoff = Date.now() - RATING_COOLDOWN_MS;
    return !stored.some(
      r => r.workshopId === workshopId &&
           r.playerId === playerId &&
           r.timestamp > cutoff,
    );
  } catch {
    return true; // If we can't check, prompt anyway.
  }
}

/**
 * Return all locally persisted deck ratings.
 */
export function getLocalRatings(): DeckRating[] {
  try {
    return JSON.parse(localStorage.getItem('mp_deck_ratings') ?? '[]') as DeckRating[];
  } catch {
    return [];
  }
}

// ── Message Handlers ──────────────────────────────────────────────────────────

/**
 * Wire transport listeners for Workshop multiplayer messages.
 *
 * Messages handled:
 *   mp:workshop:vote_submit      — a peer submitted a vote; merge into local tally
 *   mp:workshop:vote_result      — host resolved the vote; fire callback with winner
 *   mp:workshop:deck_check       — host is asking if we have a Workshop deck installed;
 *                                  reply with mp:workshop:deck_check_ack
 *   mp:lobby:deck_select         — host broadcast a Workshop deck selection; validate
 *                                  metadata (M14) before forwarding to onDeckSelect cb
 *
 * (mp:lobby:deck_select metadata validation is performed here; lobby service
 * may also consume this event for its own state — they coexist safely.)
 *
 * @param localPlayerId - This client's player ID, used when replying to deck checks.
 * @param onDeckSelect  - Optional callback invoked with validated deck metadata;
 *                        called only when the incoming deck passes validation.
 * @returns Cleanup function — call to remove all listeners (use on unmount or
 *          lobby leave).
 */
export function initWorkshopMessageHandlers(
  localPlayerId?: string,
  onDeckSelect?: (deck: WorkshopDeckPreview) => void,
): () => void {
  const transport = getMultiplayerTransport();

  const unsubVoteSubmit = transport.on('mp:workshop:vote_submit', (msg) => {
    const { playerId, workshopId } = msg.payload as { playerId: string; workshopId: string };
    if (playerId && workshopId) {
      _votes.set(playerId, { playerId, workshopId });
    }
  });

  const unsubVoteResult = transport.on('mp:workshop:vote_result', (msg) => {
    const { workshopId } = msg.payload as { workshopId: string };
    if (workshopId) {
      _onVoteResultCb?.(workshopId);
      _votes = new Map(); // Reset vote state to match host.
    }
  });

  // H16 — respond to host's deck-check broadcast
  const unsubDeckCheck = transport.on(
    'mp:workshop:deck_check' as MultiplayerMessageType,
    (msg) => {
      const { workshopItemId, requestId } = msg.payload as {
        workshopItemId: string;
        requestId: string;
      };
      if (!workshopItemId || !requestId) return;

      const installed = getInstalledWorkshopDecks().some(
        d => d.workshopId === workshopItemId,
      );

      const playerId = localPlayerId ?? '';
      transport.send(
        'mp:workshop:deck_check_ack' as MultiplayerMessageType,
        { requestId, playerId, installed },
      );
    },
  );

  // M14 — validate metadata on incoming deck selections
  const unsubDeckSelect = transport.on('mp:lobby:deck_select', (msg) => {
    const raw = msg.payload as Partial<WorkshopDeckPreview>;

    // Only validate when payload looks like a Workshop deck (has workshopId).
    if (!raw.workshopId) return;

    const validation = validateWorkshopDeckMetadata(raw);
    if (!validation.ok) {
      console.warn(
        '[multiplayerWorkshopService] Dropping mp:lobby:deck_select — invalid metadata:',
        validation.reason,
        '| workshopId:', raw.workshopId,
      );
      return;
    }

    onDeckSelect?.(raw as WorkshopDeckPreview);
  });

  _cleanupFns.push(unsubVoteSubmit, unsubVoteResult, unsubDeckCheck, unsubDeckSelect);

  return () => {
    unsubVoteSubmit();
    unsubVoteResult();
    unsubDeckCheck();
    unsubDeckSelect();
  };
}

/**
 * Tear down all Workshop multiplayer state and listeners.
 *
 * Call when the player leaves a multiplayer lobby entirely.
 */
export function destroyWorkshopMultiplayer(): void {
  for (const fn of _cleanupFns) fn();
  _cleanupFns.length = 0;
  _votes = new Map();
  _onVoteResultCb = null;
  _pendingRatings = [];
}
