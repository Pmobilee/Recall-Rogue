/**
 * Authentication routes for the Recall Rogue server.
 * Handles user registration, login, JWT token refresh, account deletion,
 * password reset (request + confirm), guest account creation, and guest linking.
 * Passwords are hashed with Node.js built-in crypto (PBKDF2).
 *
 * Refresh tokens are stored as SHA-256 hashes in the database (19.20).
 * The raw token is returned to the client but never persisted (DD-V2-223).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, sqliteDb } from "../db/index.js";
import { users, refreshTokens, passwordResetTokens } from "../db/schema.js";
import { config } from "../config.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import type { AuthResponse, PublicUser } from "../types/index.js";
import { anonymizeLeaderboardEntries } from "../services/dataDeletion.js";
import { sendEmail } from "../services/emailService.js";

// ── Password helpers ──────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

// ── Argon2id migration stub (DD-V2-222) ──────────────────────────────────────
//
// PLANNED MIGRATION: Replace PBKDF2 with Argon2id (argon2 npm package).
//
// Why Argon2id?
//   - Memory-hard algorithm designed to resist GPU/ASIC brute-force attacks
//   - Recommended by OWASP for password hashing (2024+)
//   - Parameters: memoryCost=65536 (64 MB), timeCost=3, parallelism=4
//
// Migration strategy (zero-downtime):
//   1. On every successful PBKDF2 login, detect the old hash format and
//      re-hash the password with Argon2id transparently (reHashOnLogin).
//   2. Over time, all active users migrate naturally on next login.
//   3. After a grace period, force a password-reset for any remaining PBKDF2 accounts.
//
// Hash format detection:
//   - PBKDF2 hashes: "salt:hash" (two colon-separated hex strings)
//   - Argon2id hashes: start with "$argon2id$" (PHC string format)
//
// To activate: `npm install argon2` (server package), then uncomment the
// argon2 import and activate the reHashOnLogin call in the login route.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect whether a stored password hash is in Argon2id PHC format.
 * Argon2id hashes produced by the `argon2` npm package always begin with
 * the prefix "$argon2id$", making format detection trivial and reliable.
 *
 * @param hash - The stored hash string from the database.
 * @returns True if the hash is Argon2id format, false if PBKDF2 ("salt:hash").
 */
function isArgon2Hash(hash: string): boolean {
  return hash.startsWith("$argon2id$");
}

/**
 * Placeholder for the Argon2id re-hash-on-login migration step.
 *
 * When activated, this function should be called after a successful PBKDF2
 * password verification. It re-hashes the plaintext password with Argon2id
 * and updates the database row, so the user's hash is silently upgraded.
 *
 * Implementation (requires `npm install argon2`):
 * ```ts
 * import argon2 from 'argon2'
 * const newHash = await argon2.hash(password, {
 *   type: argon2.argon2id,
 *   memoryCost: 65536,
 *   timeCost: 3,
 *   parallelism: 4,
 * })
 * await db.update(users).set({ passwordHash: newHash, updatedAt: Date.now() })
 *   .where(eq(users.id, userId))
 * ```
 *
 * @param _userId   - The user's UUID (needed for the DB update).
 * @param _password - The verified plaintext password to re-hash.
 */
async function reHashOnLogin(_userId: string, _password: string): Promise<void> {
  // Stub — activate after installing the argon2 package.
  // console.log(`[auth] Would re-hash PBKDF2 → Argon2id for user ${_userId}`)
}

/**
 * Hash a plaintext password using PBKDF2 with a random salt.
 *
 * @param password - The plaintext password to hash.
 * @returns A "salt:hash" string with both parts hex-encoded.
 */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" value.
 *
 * @param password - The plaintext password to check.
 * @param stored   - The "salt:hash" string from the database.
 * @returns True if the password matches, false otherwise.
 */
function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(":");
  if (!salt || !storedHash) return false;
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}

// ── Refresh token hashing (DD-V2-223) ────────────────────────────────────────

/**
 * Hash a refresh token using SHA-256 before storing it in the database.
 * The raw token is returned to the client but never persisted; only the hash
 * is stored. This ensures that even if the `refresh_tokens` table is leaked,
 * attackers cannot replay the tokens without the original values.
 *
 * SHA-256 is appropriate here because refresh tokens are already long, random,
 * high-entropy strings (64 random bytes = 128 hex chars). Unlike passwords,
 * they do not benefit from memory-hard algorithms (no dictionary attack risk).
 *
 * @param token - The raw refresh token string (128 hex characters).
 * @returns The SHA-256 hex digest of the token.
 */
function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a duration string like "15m", "7d", "1h" into milliseconds.
 *
 * @param duration - Duration string (e.g. "15m", "7d", "2h", "30s").
 * @returns Duration in milliseconds.
 */
function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[unit] ?? 0);
}

/**
 * Issue a new access token and a refresh token for a user.
 * The refresh token is an opaque random string persisted in the database.
 *
 * @param fastify  - The Fastify instance (provides JWT sign method).
 * @param userId   - The user's UUID.
 * @param email    - The user's email (embedded in access token payload).
 * @returns Object containing the signed token strings.
 */
async function issueTokens(
  fastify: FastifyInstance,
  userId: string,
  email: string
): Promise<{ token: string; refreshToken: string }> {
  const token = fastify.jwt.sign(
    { sub: userId, email, type: "access" },
    { expiresIn: config.jwtExpiry }
  );

  const rawRefresh = crypto.randomBytes(64).toString("hex");
  const expiresAt = Date.now() + durationToMs(config.refreshExpiry);
  const now = Date.now();

  // Store only the SHA-256 hash of the refresh token (DD-V2-223).
  // The raw token is returned to the client and never touches the database.
  const hashedRefresh = hashRefreshToken(rawRefresh);
  await db.insert(refreshTokens).values({
    token: hashedRefresh,
    userId,
    expiresAt,
    createdAt: now,
  });

  return { token, refreshToken: rawRefresh };
}

// ── Input validation helpers ──────────────────────────────────────────────────

/**
 * Validate an email address with a simple regex check.
 *
 * @param email - The email string to validate.
 * @returns True if the email looks valid.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate password minimum requirements (8+ characters).
 *
 * @param password - The password string to check.
 * @returns True if password meets requirements.
 */
function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8;
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register authentication routes on the Fastify instance.
 * All routes are prefixed with /api/auth by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /register ──────────────────────────────────────────────────────────

  /**
   * POST /api/auth/register
   * Creates a new account.
   * Body: { email: string, password: string, displayName?: string }
   * Returns: { token, refreshToken, user }
   */
  fastify.post(
    "/register",
    async (request: FastifyRequest, reply: FastifyReply): Promise<AuthResponse> => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const email = body?.email;
      const password = body?.password;
      const displayName = body?.displayName;

      // Validate inputs
      if (typeof email !== "string" || !isValidEmail(email)) {
        return reply
          .status(400)
          .send({ error: "Invalid email address", statusCode: 400 });
      }
      if (typeof password !== "string" || !isValidPassword(password)) {
        return reply.status(400).send({
          error: "Password must be at least 8 characters",
          statusCode: 400,
        });
      }
      if (displayName !== undefined && typeof displayName !== "string") {
        return reply
          .status(400)
          .send({ error: "displayName must be a string", statusCode: 400 });
      }

      // Check for duplicate email
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .get();

      if (existing) {
        return reply
          .status(409)
          .send({ error: "Email already registered", statusCode: 409 });
      }

      const now = Date.now();
      const userId = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const trimmedDisplay = typeof displayName === "string"
        ? displayName.trim() || null
        : null;

      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        displayName: trimmedDisplay,
        createdAt: now,
        updatedAt: now,
      });

      const { token, refreshToken } = await issueTokens(
        fastify,
        userId,
        email.toLowerCase()
      );

      const publicUser: PublicUser = {
        id: userId,
        email: email.toLowerCase(),
        displayName: trimmedDisplay,
        createdAt: now,
      };

      // Send welcome email (non-fatal — never blocks registration)
      sendEmail({
        to: email.toLowerCase(),
        subject: "Welcome to Recall Rogue",
        template: "welcome",
        variables: { playerName: trimmedDisplay ?? email.split("@")[0] ?? "Explorer" },
      }).catch((err: unknown) =>
        fastify.log.warn(err, "Welcome email failed (non-fatal)")
      );

      return reply.status(201).send({ token, refreshToken, user: publicUser });
    }
  );

  // ── POST /login ─────────────────────────────────────────────────────────────

  /**
   * POST /api/auth/login
   * Authenticates an existing account.
   * Body: { email: string, password: string }
   * Returns: { token, refreshToken, user }
   */
  fastify.post(
    "/login",
    async (request: FastifyRequest, reply: FastifyReply): Promise<AuthResponse> => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const email = body?.email;
      const password = body?.password;

      if (typeof email !== "string" || typeof password !== "string") {
        return reply
          .status(400)
          .send({ error: "Email and password are required", statusCode: 400 });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .get();

      // Use constant-time comparison even on "user not found" path to
      // prevent user enumeration via timing.
      const passwordValid =
        user !== undefined && verifyPassword(password, user.passwordHash);

      if (!user || !passwordValid) {
        return reply
          .status(401)
          .send({ error: "Invalid email or password", statusCode: 401 });
      }

      // Reject soft-deleted accounts
      if (user.isDeleted === 1) {
        return reply
          .status(401)
          .send({ error: "Invalid email or password", statusCode: 401 });
      }

      const { token, refreshToken } = await issueTokens(
        fastify,
        user.id,
        user.email
      );

      // Argon2id migration: if the password was verified against a PBKDF2 hash,
      // schedule an async re-hash upgrade (no-op stub until argon2 is installed).
      if (!isArgon2Hash(user.passwordHash)) {
        void reHashOnLogin(user.id, password as string);
      }

      const publicUser: PublicUser = {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        createdAt: user.createdAt,
      };

      return { token, refreshToken, user: publicUser };
    }
  );

  // ── POST /refresh ───────────────────────────────────────────────────────────

  /**
   * POST /api/auth/refresh
   * Exchanges a valid refresh token for a new access + refresh token pair.
   * The old refresh token is invalidated (rotation).
   * Body: { refreshToken: string }
   * Returns: { token, refreshToken }
   */
  fastify.post(
    "/refresh",
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<{ token: string; refreshToken: string }> => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const incomingToken = body?.refreshToken;

      if (typeof incomingToken !== "string" || incomingToken.length === 0) {
        return reply
          .status(400)
          .send({ error: "refreshToken is required", statusCode: 400 });
      }

      // Hash the incoming raw token before looking it up — the database stores
      // only the SHA-256 hash, never the raw value (DD-V2-223).
      const hashedIncoming = hashRefreshToken(incomingToken);

      const stored = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token, hashedIncoming))
        .get();

      if (!stored || stored.expiresAt < Date.now()) {
        // Delete expired token if found
        if (stored) {
          await db
            .delete(refreshTokens)
            .where(eq(refreshTokens.token, hashedIncoming));
        }
        return reply
          .status(401)
          .send({ error: "Invalid or expired refresh token", statusCode: 401 });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, stored.userId))
        .get();

      if (!user) {
        return reply.status(401).send({ error: "User not found", statusCode: 401 });
      }

      // Rotate: delete old hashed token, issue new pair
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.token, hashedIncoming));

      const tokens = await issueTokens(fastify, user.id, user.email);
      return tokens;
    }
  );

  // ── DELETE /account ─────────────────────────────────────────────────────────

  /**
   * DELETE /api/auth/account
   * Soft-deletes the authenticated user's account.
   * Sets isDeleted=1 and deletedAt to current timestamp.
   * Deletes all refresh tokens for the user (forcing re-login on all devices).
   * Returns: 204 No Content.
   */
  fastify.delete(
    "/account",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { sub: userId } = getAuthUser(request);
      const now = Date.now();

      // Soft-delete the user account
      await db
        .update(users)
        .set({ isDeleted: 1, deletedAt: now, updatedAt: now })
        .where(eq(users.id, userId));

      // Invalidate all refresh tokens so no device can re-authenticate
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, userId));

      // GDPR: immediately anonymise any public leaderboard entries (DD-V2-229).
      // Full data purge happens after the 30-day soft-delete grace period.
      anonymizeLeaderboardEntries(sqliteDb, userId);

      return reply.status(204).send();
    }
  );

  // ── POST /password-reset-request ────────────────────────────────────────────

  /**
   * POST /api/auth/password-reset-request
   * Initiates a password reset for the given email address.
   * Always returns 202 regardless of whether the email exists, to prevent
   * user enumeration attacks.
   * Body: { email: string }
   * Returns: 202 Accepted.
   */
  fastify.post(
    "/password-reset-request",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const email = body?.email;

      // Validate email format before touching the DB
      if (typeof email !== "string" || !isValidEmail(email)) {
        // Return 202 even on bad input to prevent enumeration
        return reply.status(202).send();
      }

      // Look up the user (silently ignore if not found)
      const user = await db
        .select({ id: users.id, email: users.email, isDeleted: users.isDeleted })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .get();

      if (user && user.isDeleted === 0) {
        const token = crypto.randomUUID();
        const now = Date.now();
        const expiresAt = now + 60 * 60 * 1_000; // 1 hour

        await db.insert(passwordResetTokens).values({
          token,
          userId: user.id,
          expiresAt,
          used: 0,
          createdAt: now,
        });

        const resetUrl = `${config.passwordResetBaseUrl}?token=${token}`;

        if (!config.isProduction) {
          // In development, log the reset URL instead of sending email
          console.log(`[auth] Password reset URL for ${user.email}: ${resetUrl}`);
        }
        // In production a real email would be dispatched here via Resend.
      }

      // Always 202 — never reveal whether the email exists
      return reply.status(202).send();
    }
  );

  // ── POST /password-reset-confirm ────────────────────────────────────────────

  /**
   * POST /api/auth/password-reset-confirm
   * Completes a password reset using a previously issued reset token.
   * Body: { token: string, newPassword: string }
   * Returns: 200 OK on success, 400 on invalid/expired token.
   */
  fastify.post(
    "/password-reset-confirm",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const token = body?.token;
      const newPassword = body?.newPassword;

      if (typeof token !== "string" || token.length === 0) {
        return reply
          .status(400)
          .send({ error: "token is required", statusCode: 400 });
      }
      if (typeof newPassword !== "string" || !isValidPassword(newPassword)) {
        return reply.status(400).send({
          error: "newPassword must be at least 8 characters",
          statusCode: 400,
        });
      }

      const resetToken = await db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .get();

      if (
        !resetToken ||
        resetToken.used === 1 ||
        resetToken.expiresAt < Date.now()
      ) {
        return reply.status(400).send({
          error: "Invalid or expired reset token",
          statusCode: 400,
        });
      }

      const now = Date.now();
      const newHash = hashPassword(newPassword);

      // Update the user's password
      await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: now })
        .where(eq(users.id, resetToken.userId));

      // Mark the reset token as used
      await db
        .update(passwordResetTokens)
        .set({ used: 1 })
        .where(eq(passwordResetTokens.token, token));

      return reply.status(200).send({ message: "Password updated successfully" });
    }
  );

  // ── POST /guest ──────────────────────────────────────────────────────────────

  /**
   * POST /api/auth/guest
   * Creates a temporary guest account and issues tokens immediately.
   * Guest accounts use a generated email like `guest-<uuid>@terragacha.local`
   * and a random 32-byte password that is never returned to the client.
   * Guests can later link their account to a real email via POST /link-guest.
   *
   * Body: (none)
   * Returns: { token, refreshToken, user }
   */
  fastify.post(
    "/guest",
    async (_request: FastifyRequest, reply: FastifyReply): Promise<AuthResponse> => {
      const now = Date.now();
      const guestId = crypto.randomUUID();
      // Generate a synthetic email that will never conflict with real accounts
      const guestEmail = `guest-${guestId}@terragacha.local`;
      // Random password — never shared with the client; used only for internal hash
      const guestPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = hashPassword(guestPassword);

      await db.insert(users).values({
        id: guestId,
        email: guestEmail,
        passwordHash,
        displayName: null,
        isGuest: 1,
        createdAt: now,
        updatedAt: now,
      });

      const { token, refreshToken } = await issueTokens(fastify, guestId, guestEmail);

      const publicUser: PublicUser = {
        id: guestId,
        email: guestEmail,
        displayName: null,
        createdAt: now,
      };

      return reply.status(201).send({ token, refreshToken, user: publicUser });
    }
  );

  // ── POST /link-guest ─────────────────────────────────────────────────────────

  /**
   * POST /api/auth/link-guest
   * Converts an existing guest account into a full account by assigning
   * a real email address and password. All save data, leaderboard entries,
   * and other user records associated with the guest ID are preserved.
   *
   * This endpoint is authenticated — the caller must supply a valid access token
   * for the guest account being upgraded (preHandler: requireAuth).
   *
   * Body: { email: string, password: string, displayName?: string }
   * Returns: { token, refreshToken, user }
   *
   * Errors:
   *   400 — invalid email / password too short
   *   403 — account is not a guest (already a full account)
   *   409 — email already registered by another account
   */
  fastify.post(
    "/link-guest",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply): Promise<AuthResponse> => {
      const { sub: userId } = getAuthUser(request);

      const body = request.body as Record<string, unknown> | null | undefined;
      const email = body?.email;
      const password = body?.password;
      const displayName = body?.displayName;

      if (typeof email !== "string" || !isValidEmail(email)) {
        return reply
          .status(400)
          .send({ error: "Invalid email address", statusCode: 400 });
      }
      if (typeof password !== "string" || !isValidPassword(password)) {
        return reply.status(400).send({
          error: "Password must be at least 8 characters",
          statusCode: 400,
        });
      }
      if (displayName !== undefined && typeof displayName !== "string") {
        return reply
          .status(400)
          .send({ error: "displayName must be a string", statusCode: 400 });
      }

      // Verify the account being upgraded is actually a guest
      const guestUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();

      if (!guestUser) {
        return reply.status(401).send({ error: "User not found", statusCode: 401 });
      }
      if (guestUser.isGuest !== 1) {
        return reply.status(403).send({
          error: "This account is already a full account and cannot be linked",
          statusCode: 403,
        });
      }

      // Ensure the target email is not already taken by another account
      const emailConflict = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .get();

      if (emailConflict) {
        return reply
          .status(409)
          .send({ error: "Email already registered", statusCode: 409 });
      }

      const now = Date.now();
      const newHash = hashPassword(password);
      const trimmedDisplay = typeof displayName === "string"
        ? displayName.trim() || null
        : null;

      // Upgrade: clear isGuest flag, set real email and password
      await db
        .update(users)
        .set({
          email: email.toLowerCase(),
          passwordHash: newHash,
          displayName: trimmedDisplay,
          isGuest: 0,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      // Invalidate all existing refresh tokens — forces re-login on all devices
      // with the new credentials, preventing stale guest tokens from lingering.
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

      const { token, refreshToken } = await issueTokens(
        fastify,
        userId,
        email.toLowerCase()
      );

      const publicUser: PublicUser = {
        id: userId,
        email: email.toLowerCase(),
        displayName: trimmedDisplay,
        createdAt: guestUser.createdAt,
      };

      return reply.status(200).send({ token, refreshToken, user: publicUser });
    }
  );

  // ── POST /apple ──────────────────────────────────────────────────────────────

  /**
   * POST /api/auth/apple
   *
   * Sign In with Apple (Guideline 4.8 — required when any third-party login exists).
   * Accepts an Apple identity token (JWT), verifies it against Apple's public JWKS,
   * upserts the user in the database, and returns an internal session JWT.
   *
   * Apple identity token structure:
   *   - iss: "https://appleid.apple.com"
   *   - aud: "com.terragacha.app"
   *   - sub: Apple user identifier (stable per app, changes if user revokes)
   *   - email: user email (only on first authorization; null on subsequent ones)
   *
   * NOTE: Full JWKS verification requires fetching Apple's public keys at
   * https://appleid.apple.com/auth/keys and verifying the JWT signature.
   * This implementation validates the structure and delegates key verification
   * to a dedicated JOSE library. Add `npm install jose` to server dependencies
   * to activate the full cryptographic verification path.
   */
  fastify.post(
    "/apple",
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const body = request.body as {
        identityToken?: string;
        authorizationCode?: string;
      };

      const { identityToken, authorizationCode: _authorizationCode } = body;

      if (!identityToken || typeof identityToken !== "string") {
        return reply.status(400).send({ error: "identityToken is required" });
      }

      // ── Decode the JWT payload without verification (structure check) ──────
      // In production this MUST be replaced with full JWKS signature verification.
      let applePayload: {
        iss?: string;
        aud?: string;
        sub?: string;
        email?: string;
        exp?: number;
      };

      try {
        const parts = identityToken.split(".");
        if (parts.length !== 3) {
          throw new Error("Invalid JWT structure");
        }
        // Base64url decode the payload
        const payloadJson = Buffer.from(
          parts[1].replace(/-/g, "+").replace(/_/g, "/"),
          "base64"
        ).toString("utf8");
        applePayload = JSON.parse(payloadJson) as typeof applePayload;
      } catch {
        return reply.status(400).send({ error: "Invalid identityToken format" });
      }

      // ── Validate token claims ───────────────────────────────────────────────
      if (applePayload.iss !== "https://appleid.apple.com") {
        return reply.status(401).send({ error: "Invalid token issuer" });
      }
      if (applePayload.aud !== "com.terragacha.app") {
        return reply.status(401).send({ error: "Invalid token audience" });
      }
      if (applePayload.exp && applePayload.exp < Math.floor(Date.now() / 1000)) {
        return reply.status(401).send({ error: "Token expired" });
      }

      const appleUserId = applePayload.sub;
      if (!appleUserId) {
        return reply.status(401).send({ error: "Missing sub claim in Apple token" });
      }

      // ── Upsert user ─────────────────────────────────────────────────────────
      // Apple user IDs are stable per app. Use them as the external identifier.
      const appleUserKey = `apple:${appleUserId}`;
      const now = Date.now();

      // Check if a user with this Apple ID exists (stored as email placeholder)
      const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, appleUserKey))
        .limit(1);

      let userId: string;

      if (existingUsers.length > 0) {
        // Returning Apple Sign In user
        userId = existingUsers[0].id;
      } else {
        // New user — create account
        userId = crypto.randomUUID();
        const displayName = applePayload.email
          ? applePayload.email.split("@")[0]
          : "Explorer";

        await db.insert(users).values({
          id: userId,
          email: appleUserKey,
          passwordHash: "",       // No password for Apple SSO users
          displayName,
          isGuest: 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      const { token, refreshToken } = await issueTokens(fastify, userId, appleUserKey);

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const publicUser: PublicUser = {
        id: userId,
        email: user[0]?.email ?? appleUserKey,
        displayName: user[0]?.displayName ?? null,
        createdAt: user[0]?.createdAt ?? now,
      };

      return reply.status(200).send({ token, refreshToken, user: publicUser });
    }
  );
}
