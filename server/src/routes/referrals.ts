/**
 * Referral system routes for the Recall Rogue server.
 * Players earn rewards for referring new users:
 *   - Invitee completes first dive → referrer earns a fossil egg.
 *   - Invitee reaches a 7-day login streak → referrer earns bonus dust.
 *
 * Referral codes are deterministic: base36(first 5 bytes of SHA-256(playerId))
 * padded/truncated to 8 characters.  This means codes are stable and can be
 * recomputed without a database round-trip.
 *
 * Referral records are stored in process memory for this phase.
 * Internal webhook endpoints are guarded by the admin API key.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import { config } from "../config.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Length of generated referral codes. */
const REFERRAL_CODE_LENGTH = 8;

/** Reward description for the first-dive referral milestone. */
const REWARD_FIRST_DIVE = "fossil_egg";

/** Reward description for the 7-day streak referral milestone. */
const REWARD_STREAK = "bonus_dust_250";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Status of a referral relationship. */
type ReferralStatus =
  | "registered"      // Invitee signed up with the code
  | "dive_rewarded"   // Invitee completed first dive; referrer earned fossil egg
  | "streak_rewarded"; // Invitee hit 7-day streak; referrer earned bonus dust

/** A single referral record. */
interface ReferralRecord {
  id: string;
  referrerId: string;
  inviteeId: string;
  referralCode: string;
  status: ReferralStatus;
  registeredAt: number;
  diveRewardedAt: number | null;
  streakRewardedAt: number | null;
}

// ── In-memory stores ──────────────────────────────────────────────────────────

/** All referral records, keyed by record ID. */
const referralStore = new Map<string, ReferralRecord>();

/** Maps referral code → referrer's userId for O(1) lookup on registration. */
const codeToReferrer = new Map<string, string>();

/** Maps inviteeId → referral record ID for O(1) lookup on milestones. */
const inviteeIndex = new Map<string, string>();

// ── Code generation ───────────────────────────────────────────────────────────

/**
 * Generate a deterministic 8-character alphanumeric referral code from a
 * player's UUID. The code is derived by taking the first 5 bytes of the
 * SHA-256 hash of the player ID, encoding them in base36, and
 * uppercasing/padding to exactly REFERRAL_CODE_LENGTH characters.
 *
 * Properties:
 *   - Deterministic: same playerId always yields the same code.
 *   - No DB round-trip needed to look up or verify a code.
 *   - Collision probability is negligible for the expected user count
 *     (≈ 36^8 ≈ 2.8 trillion possible codes).
 *
 * @param playerId - The player's UUID.
 * @returns An 8-character uppercase alphanumeric code.
 */
export function generateReferralCode(playerId: string): string {
  const hash = crypto.createHash("sha256").update(playerId).digest();
  // Read first 5 bytes as a big-endian unsigned integer
  const value =
    (hash[0]! * 0x100000000 +
      hash[1]! * 0x1000000 +
      hash[2]! * 0x10000 +
      hash[3]! * 0x100 +
      hash[4]!) >>>
    0;
  // Convert to base36 string, pad/truncate to REFERRAL_CODE_LENGTH
  const raw = value.toString(36).toUpperCase();
  return raw.padStart(REFERRAL_CODE_LENGTH, "0").slice(-REFERRAL_CODE_LENGTH);
}

// ── Admin key middleware ───────────────────────────────────────────────────────

/**
 * Fastify preHandler that requires the X-Admin-Key header to match the
 * configured admin API key. Used to protect internal webhook endpoints.
 *
 * @param request - The incoming Fastify request.
 * @param reply   - The Fastify reply object.
 */
async function requireAdminKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const adminKey = request.headers["x-admin-key"];
  if (adminKey !== config.adminApiKey) {
    return reply
      .status(401)
      .send({ error: "Unauthorized: invalid admin key", statusCode: 401 });
  }
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register referral system routes on the Fastify instance.
 * Prefixed with /api/referrals by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function referralRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /my-code ────────────────────────────────────────────────────────────

  /**
   * GET /api/referrals/my-code
   * Returns the authenticated player's unique referral code.
   * The code is deterministically derived from the player's ID so it can be
   * recomputed at any time without a database query.
   * Returns: { code: string }
   */
  fastify.get(
    "/my-code",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const code = generateReferralCode(userId);
      // Cache the code → referrer mapping for O(1) lookup on registration
      codeToReferrer.set(code, userId);
      return reply.status(200).send({ code });
    }
  );

  // ── POST /register ──────────────────────────────────────────────────────────

  /**
   * POST /api/referrals/register
   * Called at account creation with the referral code used.
   * Links the new player (invitee) to the code owner (referrer).
   * Body: { referralCode: string }
   * Returns: 200 with the created referral record, or 404 if code is unknown.
   * Authentication required (the newly created account's token).
   */
  fastify.post(
    "/register",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: inviteeId } = getAuthUser(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const referralCode = body?.referralCode;

      if (typeof referralCode !== "string" || referralCode.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "referralCode is required", statusCode: 400 });
      }

      const normalizedCode = referralCode.trim().toUpperCase();

      // Prevent self-referral
      const selfCode = generateReferralCode(inviteeId);
      if (normalizedCode === selfCode) {
        return reply
          .status(400)
          .send({ error: "Cannot use your own referral code", statusCode: 400 });
      }

      // Check if the invitee already used a code
      if (inviteeIndex.has(inviteeId)) {
        return reply
          .status(409)
          .send({ error: "Referral code already registered for this account", statusCode: 409 });
      }

      // Look up the referrer from the in-memory cache; if not cached, scan all users
      let referrerId = codeToReferrer.get(normalizedCode);
      if (!referrerId) {
        // Exhaustive scan: check if any registered user matches the code.
        // In production this would be an indexed DB query.
        const allUsers = await db
          .select({ id: users.id })
          .from(users)
          .all();

        for (const u of allUsers) {
          if (generateReferralCode(u.id) === normalizedCode) {
            referrerId = u.id;
            codeToReferrer.set(normalizedCode, u.id);
            break;
          }
        }
      }

      if (!referrerId) {
        return reply
          .status(404)
          .send({ error: "Referral code not found", statusCode: 404 });
      }

      const record: ReferralRecord = {
        id: crypto.randomUUID(),
        referrerId,
        inviteeId,
        referralCode: normalizedCode,
        status: "registered",
        registeredAt: Date.now(),
        diveRewardedAt: null,
        streakRewardedAt: null,
      };

      referralStore.set(record.id, record);
      inviteeIndex.set(inviteeId, record.id);

      return reply.status(200).send(record);
    }
  );

  // ── GET /my-history ─────────────────────────────────────────────────────────

  /**
   * GET /api/referrals/my-history
   * Returns the authenticated player's outbound referral history.
   * Shows each referred player (invitee) and the milestone status.
   * Returns: Array of referral records.
   */
  fastify.get(
    "/my-history",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);

      const records = [...referralStore.values()].filter(
        (r) => r.referrerId === userId
      );

      // Enrich with invitee display name
      const enriched = await Promise.all(
        records.map(async (r) => {
          const invitee = await db
            .select({ displayName: users.displayName })
            .from(users)
            .where(eq(users.id, r.inviteeId))
            .get();
          return {
            ...r,
            inviteeDisplayName: invitee?.displayName ?? null,
          };
        })
      );

      return reply.status(200).send(enriched);
    }
  );

  // ── POST /internal/process-dive ─────────────────────────────────────────────

  /**
   * POST /api/referrals/internal/process-dive
   * Internal webhook: called when an invitee completes their first dive.
   * Issues a fossil egg reward to the referrer.
   * Guarded by X-Admin-Key header.
   * Body: { inviteeId: string }
   * Returns: 200 with the updated referral record and reward details.
   */
  fastify.post(
    "/internal/process-dive",
    { preHandler: requireAdminKey },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const inviteeId = body?.inviteeId;

      if (typeof inviteeId !== "string" || inviteeId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "inviteeId is required", statusCode: 400 });
      }

      const recordId = inviteeIndex.get(inviteeId);
      if (!recordId) {
        // Invitee registered without a referral code — no action needed
        return reply
          .status(200)
          .send({ rewarded: false, reason: "No referral record for this player" });
      }

      const record = referralStore.get(recordId);
      if (!record) {
        return reply
          .status(404)
          .send({ error: "Referral record not found", statusCode: 404 });
      }
      if (record.diveRewardedAt !== null) {
        return reply
          .status(200)
          .send({ rewarded: false, reason: "Dive reward already issued" });
      }

      record.diveRewardedAt = Date.now();
      record.status = "dive_rewarded";

      // In production: credit the referrer's save document with REWARD_FIRST_DIVE.
      console.log(
        `[referrals] Dive reward: referrer ${record.referrerId} earns ${REWARD_FIRST_DIVE} ` +
          `for invitee ${inviteeId} completing first dive`
      );

      return reply.status(200).send({
        rewarded: true,
        reward: REWARD_FIRST_DIVE,
        referrerId: record.referrerId,
        record,
      });
    }
  );

  // ── POST /internal/process-streak ───────────────────────────────────────────

  /**
   * POST /api/referrals/internal/process-streak
   * Internal webhook: called when an invitee reaches a 7-day login streak.
   * Issues bonus dust reward to the referrer.
   * Guarded by X-Admin-Key header.
   * Body: { inviteeId: string }
   * Returns: 200 with the updated referral record and reward details.
   */
  fastify.post(
    "/internal/process-streak",
    { preHandler: requireAdminKey },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown> | null | undefined;
      const inviteeId = body?.inviteeId;

      if (typeof inviteeId !== "string" || inviteeId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "inviteeId is required", statusCode: 400 });
      }

      const recordId = inviteeIndex.get(inviteeId);
      if (!recordId) {
        return reply
          .status(200)
          .send({ rewarded: false, reason: "No referral record for this player" });
      }

      const record = referralStore.get(recordId);
      if (!record) {
        return reply
          .status(404)
          .send({ error: "Referral record not found", statusCode: 404 });
      }
      if (record.streakRewardedAt !== null) {
        return reply
          .status(200)
          .send({ rewarded: false, reason: "Streak reward already issued" });
      }

      record.streakRewardedAt = Date.now();
      record.status = "streak_rewarded";

      // In production: credit the referrer's save document with REWARD_STREAK.
      console.log(
        `[referrals] Streak reward: referrer ${record.referrerId} earns ${REWARD_STREAK} ` +
          `for invitee ${inviteeId} reaching 7-day streak`
      );

      return reply.status(200).send({
        rewarded: true,
        reward: REWARD_STREAK,
        referrerId: record.referrerId,
        record,
      });
    }
  );
}
