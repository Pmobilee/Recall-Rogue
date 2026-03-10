/**
 * Shared type definitions for the Recall Rogue server.
 * These types are used across routes, middleware, and database layers.
 */

// ── JWT Payload ──────────────────────────────────────────────────────────────

/** Payload embedded in access JWTs. */
export interface JwtPayload {
  /** User UUID. */
  sub: string;
  /** User email. */
  email: string;
  /** Token type discriminator. */
  type: "access";
  /** Issued-at (epoch seconds). */
  iat?: number;
  /** Expiry (epoch seconds). */
  exp?: number;
}

/** Payload embedded in refresh JWTs. */
export interface RefreshPayload {
  /** User UUID. */
  sub: string;
  /** Token type discriminator. */
  type: "refresh";
  iat?: number;
  exp?: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Public user object returned to clients (no password hash). */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: number;
}

/** Response body for successful auth operations. */
export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: PublicUser;
}

// ── Saves ────────────────────────────────────────────────────────────────────

/**
 * Minimal representation of a save record returned to clients.
 * The full saveData JSON blob is included for GET /saves.
 */
export interface SaveRecord {
  id: string;
  userId: string;
  saveData: unknown;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/** Slim save record for history lists (no saveData blob). */
export interface SaveSummary {
  id: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

/** Known leaderboard category identifiers. */
export type LeaderboardCategory =
  | "deepest_dive"
  | "facts_mastered"
  | "longest_streak"
  | "total_dust"
  | string; // allow future categories

/** A single leaderboard entry as returned to clients. */
export interface LeaderboardEntry {
  id: string;
  userId: string;
  displayName: string | null;
  category: LeaderboardCategory;
  score: number;
  metadata: unknown | null;
  createdAt: number;
  /** 1-based rank within the category result set. */
  rank: number;
}

/** The caller's own ranking row for a given category. */
export interface MyRanking {
  category: LeaderboardCategory;
  score: number;
  rank: number | null;
}

// ── Error responses ───────────────────────────────────────────────────────────

/** Consistent error envelope returned by all routes on failure. */
export interface ApiError {
  error: string;
  statusCode: number;
}

// Note: request.user is provided by @fastify/jwt and typed as
// string | object | Buffer. We cast to JwtPayload explicitly in
// getAuthUser() rather than re-declaring the property here.
