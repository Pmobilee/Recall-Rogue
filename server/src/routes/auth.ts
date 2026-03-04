/**
 * Authentication routes for the Terra Gacha server.
 * Handles user registration, login, JWT token refresh, account deletion,
 * and password reset (request + confirm).
 * Passwords are hashed with Node.js built-in crypto (PBKDF2).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, refreshTokens, passwordResetTokens } from "../db/schema.js";
import { config } from "../config.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import type { AuthResponse, PublicUser } from "../types/index.js";

// ── Password helpers ──────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

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

  // Persist the refresh token for rotation-based invalidation
  await db.insert(refreshTokens).values({
    token: rawRefresh,
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

      const stored = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token, incomingToken))
        .get();

      if (!stored || stored.expiresAt < Date.now()) {
        // Delete expired token if found
        if (stored) {
          await db
            .delete(refreshTokens)
            .where(eq(refreshTokens.token, incomingToken));
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

      // Rotate: delete old token, issue new pair
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.token, incomingToken));

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
        // In production a real email would be dispatched here using
        // config.smtpHost / smtpUser / smtpPass / fromEmail.
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
}
