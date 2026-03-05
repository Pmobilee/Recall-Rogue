/**
 * @file socialService.ts
 * Client-side social service wrapping backend API calls for hub visiting,
 * guestbook, gifting, and friend management (Phase 22).
 */

import { apiClient, ApiError } from './apiClient'
import type { HubSnapshot, GuestbookEntry, GiftRecord } from '../data/types'

// Re-export for convenience
export type { HubSnapshot, GuestbookEntry, GiftRecord }

/** A minimal player search result. */
export interface PlayerSearchResult {
  id: string
  displayName: string
}

/** A minimal friend list entry. */
export interface FriendEntry {
  id: string
  displayName: string
}

// ============================================================
// SOCIAL SERVICE
// ============================================================

/**
 * Client-side social service.
 * All methods delegate to the backend REST API via `apiClient`.
 * Any non-2xx response is surfaced as an `ApiError`.
 */
export const socialService = {
  /**
   * Search players by display name (case-insensitive prefix search).
   *
   * @param query - The display-name query string (min 2 chars recommended).
   * @returns A list of matching players with id and displayName.
   * @throws {ApiError} On network failure or server error.
   */
  async searchPlayers(query: string): Promise<PlayerSearchResult[]> {
    const params = new URLSearchParams({ q: query.trim() })
    const response = await (apiClient as unknown as {
      fetchPublic: (path: string, opts?: RequestInit) => Promise<Response>
    }).fetchPublic?.(`/social/search?${params.toString()}`, { method: 'GET' })
      ?? await _authedGet(`/social/search?${params.toString()}`)

    const data = (await response.json()) as { players: PlayerSearchResult[] }
    return data.players ?? []
  },

  /**
   * Fetch a read-only hub snapshot for visiting another player's dome.
   * Returns 403 if the player's hub is set to private.
   *
   * @param playerId - The target player's ID.
   * @returns The hub snapshot including rooms, knowledge tree, zoo, farm, guestbook.
   * @throws {ApiError} 403 if hub is private, 404 if player not found.
   */
  async getHubSnapshot(playerId: string): Promise<HubSnapshot> {
    const response = await _authedGet(`/social/hubs/${encodeURIComponent(playerId)}`)
    const data = (await response.json()) as { snapshot: HubSnapshot }
    return data.snapshot
  },

  /**
   * Post a guestbook entry on another player's dome.
   * The server enforces rate-limiting (max 3 per target per day) and content moderation.
   *
   * @param playerId - The target player's ID.
   * @param message - The message text (max 200 chars; server validates).
   * @throws {ApiError} On validation failure, rate limit (429), or network error.
   */
  async postGuestbookEntry(playerId: string, message: string): Promise<void> {
    await _authedPost(`/social/hubs/${encodeURIComponent(playerId)}/guestbook`, { message })
  },

  /**
   * Flag a guestbook entry for moderation review.
   * @param playerId - Hub owner's player ID.
   * @param entryId  - The guestbook entry ID to flag.
   */
  async flagGuestbookEntry(playerId: string, entryId: string): Promise<void> {
    await _authedPost(`/social/hubs/${encodeURIComponent(playerId)}/guestbook/${encodeURIComponent(entryId)}/flag`, {})
  },

  /**
   * Send a gift to another player.
   * Gift types:
   *  - `'minerals'`: payload must include `{ amount: number }` (100 dust, server enforces).
   *  - `'fact_link'`: payload must include `{ factId: string }`.
   *
   * Server enforces a daily gift limit (3 gifts sent per calendar day).
   *
   * @param playerId - The recipient player's ID.
   * @param type - Gift type: `'minerals'` or `'fact_link'`.
   * @param payload - Type-specific payload object.
   * @throws {ApiError} On rate limit (429), invalid payload (400), or network error.
   */
  async sendGift(
    playerId: string,
    type: 'minerals' | 'fact_link',
    payload: object,
  ): Promise<void> {
    await _authedPost(`/social/gifts`, { recipientId: playerId, type, payload })
  },

  /**
   * Retrieve all unclaimed gifts received by the authenticated player.
   *
   * @returns Array of unclaimed gift records (empty if none pending).
   * @throws {ApiError} On network failure or server error.
   */
  async getReceivedGifts(): Promise<GiftRecord[]> {
    const response = await _authedGet(`/social/gifts/received`)
    const data = (await response.json()) as { gifts: GiftRecord[] }
    return data.gifts ?? []
  },

  /**
   * Claim a specific received gift, applying its reward to the player's save.
   * The server applies the reward and marks the gift as claimed atomically.
   *
   * @param giftId - The gift record ID to claim.
   * @throws {ApiError} 404 if gift not found or already claimed.
   */
  async claimGift(giftId: string): Promise<void> {
    await _authedPost(`/social/gifts/${encodeURIComponent(giftId)}/claim`, {})
  },

  /**
   * Send a friend request to another player.
   * Idempotent — resending an existing pending request is a no-op on the server.
   *
   * @param playerId - The target player's ID.
   * @throws {ApiError} 409 if already friends, 404 if player not found.
   */
  async sendFriendRequest(playerId: string): Promise<void> {
    await _authedPost(`/social/friends/request`, { targetId: playerId })
  },

  /**
   * Get the authenticated player's current friends list.
   *
   * @returns Array of friends with id and displayName (empty if none).
   * @throws {ApiError} On network failure or server error.
   */
  async getFriends(): Promise<FriendEntry[]> {
    const response = await _authedGet(`/social/friends`)
    const data = (await response.json()) as { friends: FriendEntry[] }
    return data.friends ?? []
  },
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/**
 * Issues an authenticated GET request via the apiClient's internal fetch.
 * Wraps the private `fetchWithAuth` method by calling a known public method
 * that uses the same underlying mechanism.
 *
 * We access the underlying fetch mechanism by constructing a minimal URL
 * and relying on the apiClient singleton's token injection.
 *
 * @internal
 */
async function _authedGet(path: string): Promise<Response> {
  // apiClient exposes no public generic fetch, so we access the base URL and
  // replicate its auth header logic using a thin wrapper.
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
 *
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

/** Reads the backend base URL from environment or falls back to localhost. */
function _resolveBaseUrl(): string {
  // Vite exposes import.meta.env; fall back to localhost for dev/test.
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
