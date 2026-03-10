/**
 * Social feature routes for the Recall Rogue server.
 * Handles hub visiting, guestbook entries, gifts, friend connections,
 * and player search. All write endpoints require JWT authentication.
 *
 * Rate limits for social writes are enforced per (actor, target) or per actor
 * using in-memory counters that reset on a 24-hour rolling basis.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, saves } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum guestbook message length in characters. */
const GUESTBOOK_MAX_LEN = 200;

/** Maximum number of guestbook entries one visitor may post per hub owner per day. */
const GUESTBOOK_DAILY_LIMIT = 3;

/** Maximum mineral dust that may be included in a single gift. */
const GIFT_MAX_DUST = 100;

/** Maximum number of gifts one sender may send per day (all recipients combined). */
const GIFT_DAILY_LIMIT = 3;

/** Maximum number of player search results returned. */
const SEARCH_MAX_RESULTS = 20;

/** Window duration for rate-limit counters (24 hours in ms). */
const DAY_MS = 86_400_000;

// ── In-memory rate-limit store ────────────────────────────────────────────────

/**
 * In-memory counter for social write rate limits.
 * Key format: `<action>:<actorId>:<targetId|''>`.
 * Resets automatically when the resetAt timestamp is passed.
 */
const socialRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Check and increment a social rate limit counter.
 * Returns true if the action is allowed (within the limit), false if exceeded.
 *
 * @param key   - Unique key identifying the actor+action+target combination.
 * @param limit - Maximum allowed actions within the window.
 * @returns True if the action is within quota, false if the quota is exhausted.
 */
function checkSocialRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = socialRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    socialRateLimits.set(key, { count: 1, resetAt: now + DAY_MS });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// ── In-memory data stores ─────────────────────────────────────────────────────
//
// The social graph, guestbook, and gift queue are stored in process memory for
// this phase. In production these would live in dedicated PostgreSQL tables.
// All collections are keyed by player UUID for O(1) lookup.

interface GuestbookEntry {
  id: string;
  authorId: string;
  authorDisplayName: string | null;
  message: string;
  createdAt: number;
}

interface Gift {
  id: string;
  senderId: string;
  senderDisplayName: string | null;
  receiverId: string;
  type: "minerals" | "fact_link";
  payload: object;
  createdAt: number;
  claimedAt: number | null;
}

interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

/** guestbookStore[ownerId] = list of entries on that owner's hub. */
const guestbookStore = new Map<string, GuestbookEntry[]>();

/** giftStore[receiverId] = list of unclaimed gifts for that player. */
const giftStore = new Map<string, Gift[]>();

/** friendStore = all friend requests/connections. */
const friendStore: FriendRequest[] = [];
const flaggedGuestbookEntries = new Set<string>();

// ── Helper: parse and validate save data ─────────────────────────────────────

/**
 * Safely parse a JSON save blob, returning null on failure.
 *
 * @param raw - Raw JSON string from the saves table.
 * @returns Parsed object or null.
 */
function parseSave(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register social feature routes on the Fastify instance.
 * Prefixed with /api/players by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function socialRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /api/players/search ─────────────────────────────────────────────────

  /**
   * GET /api/players/search
   * Search players by display name substring.
   * Query: ?q=<name>
   * Returns: Array of { id, displayName } — max 20 results.
   * Authentication required.
   */
  fastify.get(
    "/search",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = (request.query as Record<string, unknown>)?.q;

      if (typeof query !== "string" || query.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "Query parameter q is required", statusCode: 400 });
      }

      const sanitized = query.trim().slice(0, 50);

      const rows = await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(
          sql`${users.displayName} IS NOT NULL AND ${users.isDeleted} = 0 AND LOWER(${users.displayName}) LIKE LOWER(${"%" + sanitized + "%"})`
        )
        .limit(SEARCH_MAX_RESULTS)
        .all();

      return reply.status(200).send(rows);
    }
  );

  // ── GET /api/players/me/friends ─────────────────────────────────────────────

  /**
   * GET /api/players/me/friends
   * Returns the authenticated player's list of accepted friends.
   * Returns: Array of { id, displayName, connectedAt }
   */
  fastify.get(
    "/me/friends",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);

      const accepted = friendStore.filter(
        (r) =>
          r.status === "accepted" &&
          (r.fromId === userId || r.toId === userId)
      );

      const friendIds = accepted.map((r) =>
        r.fromId === userId ? r.toId : r.fromId
      );

      if (friendIds.length === 0) {
        return reply.status(200).send([]);
      }

      // Fetch display names for all accepted friends
      const friendUsers = await Promise.all(
        friendIds.map((fid) =>
          db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(eq(users.id, fid))
            .get()
        )
      );

      const result = accepted.map((req, i) => ({
        id: friendIds[i],
        displayName: friendUsers[i]?.displayName ?? null,
        connectedAt: req.createdAt,
      }));

      return reply.status(200).send(result);
    }
  );

  // ── POST /api/players/friends/request ──────────────────────────────────────

  /**
   * POST /api/players/friends/request
   * Send a friend request to another player.
   * Body: { playerId: string }
   * Returns: 201 with the pending request record.
   */
  fastify.post(
    "/friends/request",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const targetId = body?.playerId;

      if (typeof targetId !== "string" || targetId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "playerId is required", statusCode: 400 });
      }

      if (targetId === userId) {
        return reply
          .status(400)
          .send({ error: "Cannot send a friend request to yourself", statusCode: 400 });
      }

      // Verify the target player exists and is not deleted
      const targetUser = await db
        .select({ id: users.id, isDeleted: users.isDeleted })
        .from(users)
        .where(eq(users.id, targetId))
        .get();

      if (!targetUser || targetUser.isDeleted === 1) {
        return reply
          .status(404)
          .send({ error: "Player not found", statusCode: 404 });
      }

      // Check for an existing request or connection between these two players
      const existing = friendStore.find(
        (r) =>
          (r.fromId === userId && r.toId === targetId) ||
          (r.fromId === targetId && r.toId === userId)
      );

      if (existing) {
        if (existing.status === "accepted") {
          return reply
            .status(409)
            .send({ error: "Already friends", statusCode: 409 });
        }
        if (existing.status === "pending") {
          return reply
            .status(409)
            .send({ error: "Friend request already pending", statusCode: 409 });
        }
      }

      const record: FriendRequest = {
        id: crypto.randomUUID(),
        fromId: userId,
        toId: targetId,
        status: "pending",
        createdAt: Date.now(),
      };
      friendStore.push(record);

      return reply.status(201).send(record);
    }
  );

  // ── GET /api/players/me/received-gifts ──────────────────────────────────────

  /**
   * GET /api/players/me/received-gifts
   * Returns all unclaimed gifts for the authenticated player.
   * Returns: Array of Gift objects (claimedAt will be null).
   */
  fastify.get(
    "/me/received-gifts",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const gifts = (giftStore.get(userId) ?? []).filter(
        (g) => g.claimedAt === null
      );
      return reply.status(200).send(gifts);
    }
  );

  // ── POST /api/players/me/received-gifts/:giftId/claim ───────────────────────

  /**
   * POST /api/players/me/received-gifts/:giftId/claim
   * Claim a specific unclaimed gift.
   * Returns: 200 with the claimed gift record.
   */
  fastify.post(
    "/me/received-gifts/:giftId/claim",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { giftId } = request.params as { giftId: string };

      const gifts = giftStore.get(userId);
      if (!gifts) {
        return reply
          .status(404)
          .send({ error: "Gift not found", statusCode: 404 });
      }

      const gift = gifts.find((g) => g.id === giftId);
      if (!gift) {
        return reply
          .status(404)
          .send({ error: "Gift not found", statusCode: 404 });
      }
      if (gift.claimedAt !== null) {
        return reply
          .status(409)
          .send({ error: "Gift already claimed", statusCode: 409 });
      }

      gift.claimedAt = Date.now();
      return reply.status(200).send(gift);
    }
  );

  // ── GET /api/players/:playerId/hub-snapshot ─────────────────────────────────

  /**
   * GET /api/players/:playerId/hub-snapshot
   * Returns a read-only snapshot of another player's hub for visiting.
   * Respects the hubPrivate flag in the owner's save data (returns 403 if set).
   * Authentication required.
   */
  fastify.get(
    "/:playerId/hub-snapshot",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { playerId } = request.params as { playerId: string };

      // Load the target player's save
      const latestSave = await db
        .select({ saveData: saves.saveData, userId: saves.userId })
        .from(saves)
        .where(eq(saves.userId, playerId))
        .orderBy(sql`${saves.updatedAt} DESC`)
        .limit(1)
        .get();

      if (!latestSave) {
        return reply
          .status(404)
          .send({ error: "Player not found", statusCode: 404 });
      }

      const saveData = parseSave(latestSave.saveData);
      if (!saveData) {
        return reply
          .status(404)
          .send({ error: "Player not found", statusCode: 404 });
      }

      // Respect the player's privacy setting
      if (saveData["hubPrivate"] === true) {
        return reply
          .status(403)
          .send({ error: "This player's hub is private", statusCode: 403 });
      }

      // Fetch the player's public display name
      const owner = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, playerId))
        .get();

      // Extract hub-relevant fields only — never return the full save blob
      const snapshot = {
        playerId,
        displayName: owner?.displayName ?? null,
        dome: saveData["dome"] ?? null,
        hubUpgrades: saveData["hubUpgrades"] ?? null,
        unlockedFloors: saveData["unlockedFloors"] ?? null,
        knowledgeTreeStage: saveData["knowledgeTreeStage"] ?? null,
        companions: saveData["companions"] ?? null,
        guestbook: guestbookStore.get(playerId) ?? [],
      };

      return reply.status(200).send(snapshot);
    }
  );

  // ── POST /api/players/:playerId/guestbook ───────────────────────────────────

  /**
   * POST /api/players/:playerId/guestbook
   * Add a guestbook entry to another player's hub.
   * Body: { message: string } — max 200 characters.
   * Rate limit: 3 entries per visitor per hub owner per 24 hours.
   * Authentication required.
   */
  fastify.post(
    "/:playerId/guestbook",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: authorId } = getAuthUser(request);
      const { playerId: ownerId } = request.params as { playerId: string };
      const body = request.body as Record<string, unknown> | null | undefined;
      const message = body?.message;

      if (authorId === ownerId) {
        return reply
          .status(400)
          .send({ error: "Cannot post to your own guestbook", statusCode: 400 });
      }

      if (typeof message !== "string" || message.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "message is required", statusCode: 400 });
      }

      if (message.length > GUESTBOOK_MAX_LEN) {
        return reply.status(400).send({
          error: `message must be at most ${GUESTBOOK_MAX_LEN} characters`,
          statusCode: 400,
        });
      }

      // Rate limit: 3 posts per visitor per hub owner per day
      const rlKey = `guestbook:${authorId}:${ownerId}`;
      if (!checkSocialRateLimit(rlKey, GUESTBOOK_DAILY_LIMIT)) {
        return reply.status(429).send({
          error: "Too many guestbook entries. Limit: 3 per day per hub.",
          statusCode: 429,
        });
      }

      // Verify the target hub owner exists
      const owner = await db
        .select({ id: users.id, isDeleted: users.isDeleted, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, ownerId))
        .get();

      if (!owner || owner.isDeleted === 1) {
        return reply
          .status(404)
          .send({ error: "Player not found", statusCode: 404 });
      }

      // Retrieve author display name for denormalized storage
      const author = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, authorId))
        .get();

      const entry: GuestbookEntry = {
        id: crypto.randomUUID(),
        authorId,
        authorDisplayName: author?.displayName ?? null,
        // Sanitize: strip HTML-like tags to prevent XSS if ever rendered
        message: message.trim().replace(/<[^>]*>/g, ""),
        createdAt: Date.now(),
      };

      if (!guestbookStore.has(ownerId)) {
        guestbookStore.set(ownerId, []);
      }
      guestbookStore.get(ownerId)!.push(entry);

      return reply.status(201).send(entry);
    }
  );

  // ── POST /api/players/:playerId/guestbook/:entryId/flag ───────────────────

  /**
   * POST /api/players/:playerId/guestbook/:entryId/flag
   * Flag a guestbook entry for moderation review.
   * This phase stores flags in memory; moderation tooling can poll later.
   * Authentication required.
   */
  fastify.post(
    "/:playerId/guestbook/:entryId/flag",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { playerId, entryId } = request.params as { playerId: string; entryId: string };
      const entries = guestbookStore.get(playerId) ?? [];
      const found = entries.find((entry) => entry.id === entryId);
      if (!found) {
        return reply
          .status(404)
          .send({ error: "Guestbook entry not found", statusCode: 404 });
      }

      flaggedGuestbookEntries.add(entryId);
      return reply.status(200).send({ ok: true });
    }
  );

  // ── POST /api/players/:playerId/gift ────────────────────────────────────────

  /**
   * POST /api/players/:playerId/gift
   * Send a gift to another player.
   * Body: { type: 'minerals'|'fact_link', payload: object }
   * Minerals capped at 100 dust per gift; max 3 gifts per sender per day.
   * Authentication required.
   */
  fastify.post(
    "/:playerId/gift",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: senderId } = getAuthUser(request);
      const { playerId: receiverId } = request.params as { playerId: string };
      const body = request.body as Record<string, unknown> | null | undefined;
      const type = body?.type;
      const payload = body?.payload;

      if (senderId === receiverId) {
        return reply
          .status(400)
          .send({ error: "Cannot send a gift to yourself", statusCode: 400 });
      }

      if (type !== "minerals" && type !== "fact_link") {
        return reply.status(400).send({
          error: "type must be 'minerals' or 'fact_link'",
          statusCode: 400,
        });
      }

      if (
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        payload === null
      ) {
        return reply
          .status(400)
          .send({ error: "payload must be a JSON object", statusCode: 400 });
      }

      // Validate dust cap for mineral gifts
      if (type === "minerals") {
        const dust = (payload as Record<string, unknown>)["dust"];
        if (typeof dust !== "number" || !Number.isFinite(dust) || dust < 1) {
          return reply
            .status(400)
            .send({ error: "payload.dust must be a positive number", statusCode: 400 });
        }
        if (dust > GIFT_MAX_DUST) {
          return reply.status(400).send({
            error: `Mineral gifts are capped at ${GIFT_MAX_DUST} dust`,
            statusCode: 400,
          });
        }
      }

      // Rate limit: 3 gifts sent per day (across all recipients)
      const rlKey = `gift:${senderId}`;
      if (!checkSocialRateLimit(rlKey, GIFT_DAILY_LIMIT)) {
        return reply.status(429).send({
          error: "Too many gifts sent today. Limit: 3 per day.",
          statusCode: 429,
        });
      }

      // Verify recipient exists
      const receiver = await db
        .select({ id: users.id, isDeleted: users.isDeleted })
        .from(users)
        .where(eq(users.id, receiverId))
        .get();

      if (!receiver || receiver.isDeleted === 1) {
        return reply
          .status(404)
          .send({ error: "Player not found", statusCode: 404 });
      }

      const sender = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, senderId))
        .get();

      const gift: Gift = {
        id: crypto.randomUUID(),
        senderId,
        senderDisplayName: sender?.displayName ?? null,
        receiverId,
        type,
        payload: payload as object,
        createdAt: Date.now(),
        claimedAt: null,
      };

      if (!giftStore.has(receiverId)) {
        giftStore.set(receiverId, []);
      }
      giftStore.get(receiverId)!.push(gift);

      return reply.status(201).send({ giftId: gift.id, createdAt: gift.createdAt });
    }
  );
}
