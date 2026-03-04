/**
 * @file duelService.ts
 * Client-side duel service wrapping backend API calls for asynchronous
 * knowledge duels between friends (Phase 22).
 */

import { ApiError } from './apiClient'
import type { DuelRecord, DuelStats } from '../data/types'

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
   * @param wagerDust - Amount of dust wagered (must be > 0; server enforces max).
   * @returns The newly created duel's ID.
   * @throws {ApiError} 400 on invalid wager, 404 if opponent not found, 409 if duel already pending.
   */
  async challengeDuel(opponentId: string, wagerDust: number): Promise<{ duelId: string }> {
    const response = await _authedPost('/duels/challenge', { opponentId, wagerDust })
    const data = (await response.json()) as { duelId: string }
    return { duelId: data.duelId }
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
    const response = await _authedGet('/duels/pending')
    const data = (await response.json()) as { duels: DuelRecord[] }
    return data.duels ?? []
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
    await _authedPost(`/duels/${encodeURIComponent(duelId)}/accept`, {})
  },

  /**
   * Decline a duel challenge, returning the wager to the challenger.
   * Transitions the duel to `'declined'`.
   *
   * @param duelId - The duel record ID to decline.
   * @throws {ApiError} 404 if duel not found, 409 if duel is not in `'pending'` state.
   */
  async declineDuel(duelId: string): Promise<void> {
    await _authedPost(`/duels/${encodeURIComponent(duelId)}/decline`, {})
  },

  /**
   * Submit the authenticated player's answers for a duel.
   * The server scores timing-weighted answers, resolves the duel if both sides
   * have now submitted, and transfers wager dust accordingly.
   *
   * @param duelId - The duel record ID.
   * @param answers - The player's answers, one per duel question.
   * @throws {ApiError} 400 on answer count mismatch, 404 if duel not found,
   *   409 if answers already submitted.
   */
  async submitAnswers(duelId: string, answers: DuelAnswer[]): Promise<void> {
    await _authedPost(`/duels/${encodeURIComponent(duelId)}/answers`, { answers })
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
    const response = await _authedGet(`/duels/${encodeURIComponent(duelId)}`)
    const data = (await response.json()) as { duel: DuelRecord }
    return data.duel
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
    const response = await _authedGet(`/duels/history?${params.toString()}`)
    const data = (await response.json()) as { duels: DuelRecord[] }
    return data.duels ?? []
  },

  /**
   * Get aggregate duel performance stats for the authenticated player.
   *
   * @returns The player's win/loss/tie counts, dust totals, and streak info.
   * @throws {ApiError} On network failure or server error.
   */
  async getDuelStats(): Promise<DuelStats> {
    const response = await _authedGet('/duels/stats')
    const data = (await response.json()) as { stats: DuelStats }
    return data.stats
  },
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/** Reads the backend base URL from environment or falls back to localhost. */
function _resolveBaseUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
      ? (import.meta.env.VITE_API_URL as string)
      : null
  return (envUrl ?? 'http://localhost:3001/api').replace(/\/$/, '')
}

/** Reads the stored access token from localStorage (mirrors apiClient internals). */
function _readToken(): string | null {
  try {
    return localStorage.getItem('terra_auth_token')
  } catch {
    return null
  }
}

/** Parses a user-friendly error message from a failed Response. */
async function _extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? `Server error (${response.status})`
  } catch {
    return response.statusText || `Server error (${response.status})`
  }
}

/**
 * Issues an authenticated GET request.
 * @internal
 */
async function _authedGet(path: string): Promise<Response> {
  const baseUrl = _resolveBaseUrl()
  const token = _readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, { method: 'GET', headers })
  } catch {
    throw new ApiError(
      'Unable to reach the server. Please check your internet connection.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    const message = await _extractErrorMessage(response)
    throw new ApiError(message, response.status)
  }
  return response
}

/**
 * Issues an authenticated POST request with a JSON body.
 * @internal
 */
async function _authedPost(path: string, body: object): Promise<Response> {
  const baseUrl = _resolveBaseUrl()
  const token = _readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      'Unable to reach the server. Please check your internet connection.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    const message = await _extractErrorMessage(response)
    throw new ApiError(message, response.status)
  }
  return response
}
