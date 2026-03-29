/**
 * @file duelService.ts
 * Client-side duel service wrapping backend API calls for asynchronous
 * knowledge duels between friends (Phase 22).
 */

import type { DuelRecord, DuelStats } from '../data/types'
import { authedGet, authedPost } from './authedFetch'

// Re-export for convenience
export type { DuelRecord, DuelStats }

/** A submitted answer for a single duel question. */
export interface DuelAnswer {
  /** The fact ID being answered. */
  factId: string
  /** The zero-based index of the chosen answer option. */
  answeredIndex: number
  /** How long the player took to answer, in milliseconds. */
  timingMs: number
}

// ============================================================
// DUEL SERVICE
// ============================================================

/**
 * Client-side duel service.
 * All methods delegate to the backend REST API via authenticated fetch calls.
 * Any non-2xx response is surfaced as an `ApiError`.
 */
export const duelService = {
  /**
   * Challenge a friend to an asynchronous knowledge duel.
   * The server selects 5 quiz questions from overlapping learned-fact sets.
   * The challenger answers first; the opponent has 48 hours to respond.
   *
   * @param opponentId - The friend's player ID.
   * @param wagerGreyMatter - Amount of grey matter wagered (must be > 0; server enforces max).
   * @returns The newly created duel's ID.
   * @throws {ApiError} 400 on invalid wager, 404 if opponent not found, 409 if duel already pending.
   */
  async challengeDuel(opponentId: string, wagerGreyMatter: number): Promise<{ duelId: string }> {
    const response = await authedPost('/duels/challenge', { opponentId, wagerGreyMatter })
    const data = (await response.json()) as { id?: string; duelId?: string }
    return { duelId: data.duelId ?? data.id ?? '' }
  },

  /**
   * Get all duels pending the authenticated player's action.
   * Includes both incoming challenges (status `'pending'`) and duels where the
   * player has answered but is waiting for the opponent (status `'challenger_done'`).
   *
   * @returns Array of pending duel records (empty if none).
   * @throws {ApiError} On network failure or server error.
   */
  async getPendingDuels(): Promise<DuelRecord[]> {
    const response = await authedGet('/duels/pending')
    const data = (await response.json()) as DuelRecord[] | { duels?: DuelRecord[] }
    return Array.isArray(data) ? data : (data.duels ?? [])
  },

  /**
   * Accept a duel challenge.
   * Transitions the duel from `'pending'` to `'opponent_done'` (challenger waits).
   * The player must then submit answers via `submitAnswers`.
   *
   * @param duelId - The duel record ID to accept.
   * @throws {ApiError} 404 if duel not found, 409 if already accepted/declined.
   */
  async acceptDuel(duelId: string): Promise<void> {
    await authedPost(`/duels/${encodeURIComponent(duelId)}/accept`, {})
  },

  /**
   * Decline a duel challenge, returning the wager to the challenger.
   * Transitions the duel to `'declined'`.
   *
   * @param duelId - The duel record ID to decline.
   * @throws {ApiError} 404 if duel not found, 409 if duel is not in `'pending'` state.
   */
  async declineDuel(duelId: string): Promise<void> {
    await authedPost(`/duels/${encodeURIComponent(duelId)}/decline`, {})
  },

  /**
   * Submit the authenticated player's answers for a duel.
   * The server scores timing-weighted answers, resolves the duel if both sides
   * have now submitted, and transfers wager grey matter accordingly.
   *
   * @param duelId - The duel record ID.
   * @param answers - The player's answers, one per duel question.
   * @throws {ApiError} 400 on answer count mismatch, 404 if duel not found,
   *   409 if answers already submitted.
   */
  async submitAnswers(duelId: string, answers: DuelAnswer[]): Promise<void> {
    await authedPost(`/duels/${encodeURIComponent(duelId)}/submit-answers`, { answers })
  },

  /**
   * Fetch the full result record for a specific duel.
   * Useful for checking resolution after polling or push notification.
   *
   * @param duelId - The duel record ID.
   * @returns The full `DuelRecord` including scores when status is `'completed'`.
   * @throws {ApiError} 404 if duel not found.
   */
  async getDuelResult(duelId: string): Promise<DuelRecord> {
    const response = await authedGet(`/duels/${encodeURIComponent(duelId)}/result`)
    return (await response.json()) as DuelRecord
  },

  /**
   * Get the authenticated player's duel history, newest first.
   *
   * @param limit - Maximum number of records to return (default 20, max 100).
   * @returns Array of duel records (empty if no history).
   * @throws {ApiError} On network failure or server error.
   */
  async getDuelHistory(limit: number = 20): Promise<DuelRecord[]> {
    const params = new URLSearchParams({ limit: String(Math.min(limit, 100)) })
    const response = await authedGet(`/duels/history?${params.toString()}`)
    const data = (await response.json()) as DuelRecord[] | { duels?: DuelRecord[] }
    return Array.isArray(data) ? data : (data.duels ?? [])
  },

  /**
   * Get aggregate duel performance stats for the authenticated player.
   *
   * @returns The player's win/loss/tie counts, dust totals, and streak info.
   * @throws {ApiError} On network failure or server error.
   */
  async getDuelStats(): Promise<DuelStats> {
    const response = await authedGet('/duels/stats')
    const raw = (await response.json()) as {
      wins?: number
      losses?: number
      ties?: number
      total?: number
      winRate?: number
    } | { stats?: DuelStats }
    if ('stats' in raw && raw.stats) return raw.stats
    const summary = raw as { wins?: number; losses?: number; ties?: number; total?: number }
    return {
      wins: summary.wins ?? 0,
      losses: summary.losses ?? 0,
      ties: summary.ties ?? 0,
      totalDuels: summary.total ?? 0,
      totalGreyMatterWon: 0,
      totalGreyMatterLost: 0,
      currentWinStreak: 0,
      longestWinStreak: 0,
    }
  },
}
