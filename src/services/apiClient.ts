/**
 * @file apiClient.ts
 * Typed HTTP client for the Recall Rogue backend API.
 *
 * Handles authentication (register/login/logout), cloud save upload/download,
 * and leaderboard operations. Tokens are persisted in localStorage and the
 * client automatically retries a single request after refreshing an expired
 * access token.
 */

import type { PlayerSave } from '../data/types'

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_BASE_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001/api`
  : 'http://localhost:3001/api'
const TOKEN_KEY = 'terra_auth_token'
const REFRESH_TOKEN_KEY = 'terra_refresh_token'

// ============================================================
// TOKEN STORAGE ABSTRACTION (19.11)
//
// Tokens are currently stored in localStorage. This is a known security
// trade-off: localStorage is susceptible to XSS extraction. The planned
// migration path is:
//
//   1. Server: Set tokens as httpOnly, Secure, SameSite=Strict cookies.
//   2. Client: Remove `storeAuthResponse` / `persistTokens` / `loadTokens`.
//   3. Client: All authenticated requests automatically carry the cookie;
//      no explicit Authorization header is needed.
//   4. Server: Validate the httpOnly cookie on every protected route.
//
// Until the backend is updated, `LocalStorageTokenStorage` is the active
// implementation. Swapping to `HttpOnlyCookieTokenStorage` (a no-op stub)
// requires only changing the `tokenStorage` assignment below.
// ============================================================

/** Contract for reading and writing auth tokens. */
export interface TokenStorage {
  /** Read the access token. Returns `null` if not present. */
  getToken(): string | null
  /** Read the refresh token. Returns `null` if not present. */
  getRefreshToken(): string | null
  /** Persist both tokens. */
  store(token: string, refreshToken: string): void
  /** Clear all stored tokens. */
  clear(): void
}

/**
 * Current implementation: stores tokens in localStorage.
 *
 * NOTE: When the backend is migrated to httpOnly cookie delivery,
 * replace this class with a no-op stub and remove `loadTokens` /
 * `persistTokens` calls from `ApiClient`.
 */
class LocalStorageTokenStorage implements TokenStorage {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  }

  store(token: string, refreshToken: string): void {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }
}

/**
 * Future implementation stub: tokens will be set as httpOnly cookies by
 * the server and are inaccessible from JavaScript. This class intentionally
 * does nothing — the browser handles cookie transmission automatically.
 *
 * Activate by: `const tokenStorage: TokenStorage = new HttpOnlyCookieTokenStorage()`
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class HttpOnlyCookieTokenStorage implements TokenStorage {
  getToken(): null { return null }
  getRefreshToken(): null { return null }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  store(_token: string, _refreshToken: string): void { /* no-op: server sets httpOnly cookie */ }
  clear(): void { /* no-op: server clears httpOnly cookie via /auth/logout */ }
}

// ============================================================
// PUBLIC TYPES
// ============================================================

/** Response returned by register and login endpoints. */
export interface AuthResponse {
  token: string
  refreshToken: string
  user: {
    id: string
    email: string
    displayName: string
  }
}

/** A single entry on a leaderboard. */
export interface LeaderboardEntry {
  userId: string
  displayName: string
  score: number
  rank: number
  category: string
  createdAt: number
}

/** Typed API error carrying a user-facing message and HTTP status. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ============================================================
// API CLIENT
// ============================================================

/**
 * Typed HTTP client for all backend communication.
 *
 * Instantiate once and export a singleton (`apiClient`) for use throughout
 * the application. All methods that require authentication will add an
 * `Authorization: Bearer <token>` header automatically. A 401 response
 * triggers exactly one token-refresh attempt before the error propagates.
 *
 * @example
 * ```ts
 * import { apiClient } from './apiClient'
 * await apiClient.login('user@example.com', 'password')
 * const save = await apiClient.downloadSave()
 * ```
 */
export class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private refreshToken: string | null = null

  /**
   * @param baseUrl - Root URL of the backend API (default: http://localhost:3001/api).
   */
  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // strip trailing slash
    this.loadTokens()
  }

  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------

  /**
   * Registers a new account and stores the returned tokens.
   *
   * @param email - User's email address.
   * @param password - Plaintext password (transmitted over HTTPS only).
   * @param displayName - Public display name shown on leaderboards.
   * @returns The auth response containing tokens and basic user info.
   * @throws {ApiError} On validation failure or if the email is already taken.
   */
  async register(email: string, password: string, displayName: string): Promise<AuthResponse> {
    const response = await this.fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    })

    const data = (await response.json()) as AuthResponse
    this.storeAuthResponse(data)
    return data
  }

  /**
   * Authenticates an existing account and stores the returned tokens.
   *
   * @param email - Registered email address.
   * @param password - Account password.
   * @returns The auth response containing tokens and basic user info.
   * @throws {ApiError} On invalid credentials (401) or other errors.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const data = (await response.json()) as AuthResponse
    this.storeAuthResponse(data)
    return data
  }

  /**
   * Creates a temporary guest account on the server and stores the returned
   * tokens, allowing immediate play without registering.
   *
   * The guest account is identified by a generated email like
   * `guest-<uuid>@terragacha.local`. Guests can later upgrade their account
   * to a full registered account via `linkGuest()`.
   *
   * @returns The auth response containing tokens and the guest user's info.
   * @throws {ApiError} On network failure or server error.
   */
  async loginAsGuest(): Promise<AuthResponse> {
    const response = await this.fetchWithAuth('/auth/guest', {
      method: 'POST',
    })

    const data = (await response.json()) as AuthResponse
    this.storeAuthResponse(data)
    return data
  }

  /**
   * Upgrades the currently authenticated guest account to a full account
   * by linking it to a real email address and password.
   * All progress associated with the guest account is preserved.
   *
   * @param email       - The real email address to attach to the account.
   * @param password    - The desired password (min 8 characters).
   * @param displayName - Optional public display name.
   * @returns The auth response with refreshed tokens and updated user info.
   * @throws {ApiError} On validation failure (400), if already a full account
   *   (403), or if the email is already taken (409).
   */
  async linkGuest(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const response = await this.fetchWithAuth('/auth/link-guest', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    })

    const data = (await response.json()) as AuthResponse
    this.storeAuthResponse(data)
    return data
  }

  /**
   * Permanently deletes the authenticated user's account on the server,
   * then clears local tokens.
   *
   * @throws {ApiError} On network failure or server error.
   */
  async deleteAccount(): Promise<void> {
    await this.fetchWithAuth('/auth/account', { method: 'DELETE' })
    this.logout()
  }

  /**
   * Sends a password-reset email to the specified address.
   * The server does not reveal whether the address is registered (anti-enumeration).
   *
   * @param email - The email address to send the reset link to.
   * @throws {ApiError} On network failure or server error.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.fetchWithAuth('/auth/password-reset-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  /**
   * Clears stored tokens, effectively logging the user out locally.
   * Does not call the server (no server-side session to invalidate for JWT).
   */
  logout(): void {
    this.token = null
    this.refreshToken = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }

  /**
   * Returns `true` when an access token is currently stored in memory.
   * Does not validate the token's expiry — use as a quick UI check only.
   */
  isLoggedIn(): boolean {
    return this.token !== null
  }

  // ----------------------------------------------------------
  // SAVE SYNC
  // ----------------------------------------------------------

  /**
   * Uploads the full player save to the backend, overwriting any existing
   * cloud save for this account.
   *
   * @param saveData - The complete serialisable `PlayerSave` object.
   * @throws {ApiError} On network failure or server error.
   */
  async uploadSave(saveData: PlayerSave): Promise<void> {
    try {
      await this.fetchWithAuth('/saves', {
        method: 'POST',
        body: JSON.stringify({ saveData }),
      })
      return
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) throw err
    }

    // Backward compatibility for older backend route names.
    await this.fetchWithAuth('/saves/upload', {
      method: 'POST',
      body: JSON.stringify({ save: saveData }),
    })
  }

  /**
   * Downloads the player's cloud save from the backend.
   *
   * @returns The stored `PlayerSave` object, or `null` if no cloud save exists yet.
   * @throws {ApiError} On server error (but NOT on 404, which returns `null`).
   */
  async downloadSave(): Promise<PlayerSave | null> {
    try {
      const response = await this.fetchWithAuth('/saves', { method: 'GET' })
      const data = (await response.json()) as { saveData?: PlayerSave; save?: PlayerSave }
      return data.saveData ?? data.save ?? null
    } catch (err) {
      if (!(err instanceof ApiError)) throw err
      if (err.status !== 404 && err.status !== 405) throw err
    }

    // Backward compatibility for older backend route names.
    let response: Response
    try {
      response = await this.fetchWithAuth('/saves/download', { method: 'GET' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }

    if (response.status === 404) {
      return null
    }

    const data = (await response.json()) as { save: PlayerSave }
    return data.save ?? null
  }

  // ----------------------------------------------------------
  // LEADERBOARDS
  // ----------------------------------------------------------

  /**
   * Retrieves the top entries for a named leaderboard category.
   *
   * @param category - Leaderboard identifier (e.g. `'deepest_layer'`, `'total_facts'`).
   * @param limit - Maximum number of entries to return (default: 50).
   * @returns Sorted array of leaderboard entries (rank 1 = best).
   * @throws {ApiError} On network failure or server error.
   */
  async getLeaderboard(category: string, limit: number = 50): Promise<LeaderboardEntry[]> {
    const params = new URLSearchParams({ category, limit: String(limit) })
    const response = await this.fetchWithAuth(`/leaderboards?${params.toString()}`, {
      method: 'GET',
    })

    const data = (await response.json()) as { entries: LeaderboardEntry[] }
    return data.entries ?? []
  }

  /**
   * Submits a score for the authenticated user in the given category.
   * The server will only update the stored score if the new value is higher.
   *
   * @param category - Leaderboard identifier.
   * @param score - The score value to submit (integer).
   * @throws {ApiError} On network failure or server error.
   */
  async submitScore(category: string, score: number): Promise<void> {
    await this.fetchWithAuth('/leaderboards/submit', {
      method: 'POST',
      body: JSON.stringify({ category, score }),
    })
  }

  /**
   * Returns all leaderboard entries for the currently authenticated user,
   * across every category in which they have a score.
   *
   * @returns Array of the user's own entries (may be empty if no scores exist yet).
   * @throws {ApiError} On network failure or server error.
   */
  async getMyRankings(): Promise<LeaderboardEntry[]> {
    const response = await this.fetchWithAuth('/leaderboards/me', { method: 'GET' })
    const data = (await response.json()) as { entries: LeaderboardEntry[] }
    return data.entries ?? []
  }

  // ----------------------------------------------------------
  // FACTS
  // ----------------------------------------------------------

  /**
   * Submit a player report for a fact (DD-V2-089).
   * This is a public endpoint — no auth required.
   */
  async reportFact(factId: string, reportText: string, playerId?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/facts/${factId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, reportText }),
    })
    if (!res.ok) throw new ApiError(`Report failed`, res.status)
  }

  /**
   * Fetch full metadata for a single fact from the server.
   * Used for lazy-loading fact details at quiz time.
   */
  async getFact(factId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/facts/${factId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new ApiError(`Failed to fetch fact`, res.status)
    const data = await res.json()
    return data as Record<string, unknown>
  }

  /**
   * Fetch fact deltas from the server since a given version.
   * Used for incremental fact sync (DD-V2-198).
   */
  async getFactsDelta(since: number): Promise<{ version: number; facts: Record<string, unknown>[]; deletedIds: string[] }> {
    const res = await fetch(`${this.baseUrl}/facts/delta?since=${since}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new ApiError(`Delta sync failed`, res.status)
    return (await res.json()) as { version: number; facts: Record<string, unknown>[]; deletedIds: string[] }
  }

  // ----------------------------------------------------------
  // INTERNALS
  // ----------------------------------------------------------

  /**
   * Executes an HTTP request against `this.baseUrl + path`, injecting the
   * Bearer token when available. On a `401` response the method attempts
   * a single token refresh and retries the original request.
   *
   * @param path - API path relative to `baseUrl` (must start with `/`).
   * @param options - Standard `RequestInit` options. `Content-Type` defaults to
   *   `application/json` when a body is provided.
   * @returns The resolved `Response` object (status is always checked — rejects
   *   on non-2xx unless the caller handles 404 explicitly).
   * @throws {ApiError} On non-2xx HTTP status or network failure.
   */
  private async fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers)

    if (!headers.has('Content-Type') && options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (this.token !== null) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...options, headers })
    } catch (networkErr) {
      throw new ApiError(
        'Unable to reach the server. Please check your internet connection.',
        0,
        'NETWORK_ERROR',
      )
    }

    // If 401, try a token refresh then retry exactly once.
    if (response.status === 401 && this.refreshToken !== null) {
      const refreshed = await this.refreshAuthToken()
      if (refreshed) {
        // Rebuild headers with the new token and retry.
        headers.set('Authorization', `Bearer ${this.token!}`)
        try {
          response = await fetch(`${this.baseUrl}${path}`, { ...options, headers })
        } catch {
          throw new ApiError(
            'Unable to reach the server. Please check your internet connection.',
            0,
            'NETWORK_ERROR',
          )
        }
      }
    }

    if (!response.ok) {
      const message = await this.extractErrorMessage(response)
      throw new ApiError(message, response.status)
    }

    return response
  }

  /**
   * Exchanges the stored refresh token for a new access token.
   * Persists the new tokens on success, or clears all tokens on failure.
   *
   * @returns `true` when the refresh succeeded, `false` otherwise.
   */
  private async refreshAuthToken(): Promise<boolean> {
    if (this.refreshToken === null) return false

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      })

      if (!response.ok) {
        this.logout()
        return false
      }

      const data = (await response.json()) as { token: string; refreshToken?: string }
      this.token = data.token
      if (data.refreshToken) {
        this.refreshToken = data.refreshToken
      }
      this.persistTokens()
      return true
    } catch {
      // Network failure during refresh — do not clear tokens so offline play
      // can continue; the next authenticated request will attempt again.
      return false
    }
  }

  /**
   * Writes the current in-memory tokens to localStorage.
   *
   * MIGRATION NOTE (19.11): When the backend migrates to httpOnly cookie
   * delivery, this method becomes a no-op and can be removed. The server
   * will set tokens directly via Set-Cookie headers on auth responses.
   */
  private persistTokens(): void {
    // TODO(codex): [security] remove localStorage token writes after httpOnly cookie migration — needs human decision
    if (this.token !== null) {
      localStorage.setItem(TOKEN_KEY, this.token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }

    if (this.refreshToken !== null) {
      localStorage.setItem(REFRESH_TOKEN_KEY, this.refreshToken)
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  }

  /**
   * Reads any previously persisted tokens from localStorage into memory.
   * Called once during construction.
   *
   * MIGRATION NOTE (19.11): When the backend migrates to httpOnly cookie
   * delivery, this method becomes a no-op and can be removed. The browser
   * will transmit the cookie automatically on each request.
   */
  private loadTokens(): void {
    // TODO(codex): [security] remove localStorage token reads after httpOnly cookie migration — needs human decision
    this.token = localStorage.getItem(TOKEN_KEY)
    this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  }

  /**
   * Stores tokens from an auth response and persists them to localStorage.
   *
   * @param data - The `AuthResponse` returned by login or register.
   */
  private storeAuthResponse(data: AuthResponse): void {
    this.token = data.token
    this.refreshToken = data.refreshToken
    this.persistTokens()
  }

  /**
   * Attempts to parse a user-friendly error message from an HTTP error response.
   * Falls back to the HTTP status text when the body cannot be parsed.
   *
   * @param response - The failed `Response` object.
   */
  private async extractErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      return body.message ?? body.error ?? `Server error (${response.status})`
    } catch {
      return response.statusText || `Server error (${response.status})`
    }
  }
}

// ============================================================
// SINGLETON
// ============================================================

/** Shared API client instance. Import and use this directly in services and components. */
export const apiClient = new ApiClient()
