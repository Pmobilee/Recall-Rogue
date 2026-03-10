/**
 * Guild system routes for the Recall Rogue server.
 * Guilds are player-formed groups that collaborate on weekly challenges and
 * accumulate Guild Knowledge Points (GKP) to appear on the guild leaderboard.
 *
 * All guild data is stored in process memory for this phase.
 * In production these would be PostgreSQL tables with proper indexes.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of members in a single guild. */
const GUILD_MAX_MEMBERS = 30;

/** Maximum length for guild name. */
const GUILD_NAME_MAX_LEN = 32;

/** Maximum length for guild tag (shown next to player names). */
const GUILD_TAG_MAX_LEN = 6;

/** Maximum length for guild description. */
const GUILD_DESC_MAX_LEN = 200;

/** Number of top guilds returned on the leaderboard. */
const GUILD_LEADERBOARD_TOP_N = 50;

/** Maximum number of search results. */
const GUILD_SEARCH_MAX = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Roles within a guild. */
type GuildRole = "leader" | "officer" | "member";

/** A single guild member record. */
interface GuildMember {
  userId: string;
  displayName: string | null;
  role: GuildRole;
  joinedAt: number;
}

/** A guild challenge contributed this week. */
interface GuildChallenge {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  rewardGkp: number;
  completedAt: number | null;
}

/** A guild record. */
interface Guild {
  id: string;
  name: string;
  tag: string;
  emblemId: string;
  description: string;
  members: GuildMember[];
  gkp: number;
  challenges: GuildChallenge[];
  createdAt: number;
  /** Open guilds can be joined without an invite. */
  open: boolean;
}

/** A pending guild invite. */
interface GuildInvite {
  id: string;
  guildId: string;
  invitedBy: string;
  inviteeId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

// ── In-memory stores ──────────────────────────────────────────────────────────

/** All guilds, keyed by guild ID. */
const guildStore = new Map<string, Guild>();

/** All guild invites. */
const inviteStore = new Map<string, GuildInvite>();

/** Maps userId → guildId for O(1) membership lookup. */
const membershipIndex = new Map<string, string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find the guild a user currently belongs to.
 *
 * @param userId - The player's UUID.
 * @returns The guild record, or null if the player has no guild.
 */
function getPlayerGuild(userId: string): Guild | null {
  const guildId = membershipIndex.get(userId);
  if (!guildId) return null;
  return guildStore.get(guildId) ?? null;
}

/**
 * Find a member record within a guild.
 *
 * @param guild  - The guild to search.
 * @param userId - The player's UUID.
 * @returns The member record, or undefined if not a member.
 */
function findMember(guild: Guild, userId: string): GuildMember | undefined {
  return guild.members.find((m) => m.userId === userId);
}

/**
 * Sanitize a string by stripping HTML-like tags.
 * Used on guild names, tags, and descriptions before storage.
 *
 * @param value - Raw input string.
 * @returns Sanitized string.
 */
function sanitize(value: string): string {
  return value.trim().replace(/<[^>]*>/g, "");
}

/**
 * Seed placeholder weekly challenges for a newly created guild.
 * In production these would be drawn from a challenge pool table.
 *
 * @returns An array of three weekly challenges.
 */
function seedWeeklyChallenges(): GuildChallenge[] {
  return [
    {
      id: crypto.randomUUID(),
      title: "Collective Dives",
      description: "Complete 50 dives as a guild this week.",
      targetCount: 50,
      currentCount: 0,
      rewardGkp: 200,
      completedAt: null,
    },
    {
      id: crypto.randomUUID(),
      title: "Knowledge Rally",
      description: "Answer 500 quiz questions correctly across all members.",
      targetCount: 500,
      currentCount: 0,
      rewardGkp: 300,
      completedAt: null,
    },
    {
      id: crypto.randomUUID(),
      title: "Relic Hunters",
      description: "Collect 10 rare or higher relics as a guild.",
      targetCount: 10,
      currentCount: 0,
      rewardGkp: 150,
      completedAt: null,
    },
  ];
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register guild system routes on the Fastify instance.
 * Prefixed with /api/guilds by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function guildRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /leaderboard ────────────────────────────────────────────────────────

  /**
   * GET /api/guilds/leaderboard
   * Returns the top 50 guilds by GKP.
   * Public endpoint — no authentication required.
   */
  fastify.get(
    "/leaderboard",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const ranked = [...guildStore.values()]
        .sort((a, b) => b.gkp - a.gkp)
        .slice(0, GUILD_LEADERBOARD_TOP_N)
        .map((g, i) => ({
          rank: i + 1,
          id: g.id,
          name: g.name,
          tag: g.tag,
          emblemId: g.emblemId,
          gkp: g.gkp,
          memberCount: g.members.length,
        }));

      return reply.status(200).send(ranked);
    }
  );

  // ── GET /search ─────────────────────────────────────────────────────────────

  /**
   * GET /api/guilds/search
   * Search for guilds by name prefix.
   * Query: ?q=<name>
   * Returns: Array of guild summaries (max 20).
   * Public endpoint — no authentication required.
   */
  fastify.get(
    "/search",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = (request.query as Record<string, unknown>)?.q;
      if (typeof q !== "string" || q.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "Query parameter q is required", statusCode: 400 });
      }

      const prefix = q.trim().toLowerCase().slice(0, 50);
      const results = [...guildStore.values()]
        .filter((g) => g.name.toLowerCase().startsWith(prefix))
        .slice(0, GUILD_SEARCH_MAX)
        .map((g) => ({
          id: g.id,
          name: g.name,
          tag: g.tag,
          emblemId: g.emblemId,
          description: g.description,
          memberCount: g.members.length,
          maxMembers: GUILD_MAX_MEMBERS,
          gkp: g.gkp,
          open: g.open,
        }));

      return reply.status(200).send(results);
    }
  );

  // ── GET /me/challenges ──────────────────────────────────────────────────────

  /**
   * GET /api/guilds/me/challenges
   * Returns the current week's challenges for the authenticated player's guild.
   * Returns: Array of GuildChallenge objects, or 404 if not in a guild.
   */
  fastify.get(
    "/me/challenges",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const guild = getPlayerGuild(userId);

      if (!guild) {
        return reply
          .status(404)
          .send({ error: "You are not a member of any guild", statusCode: 404 });
      }

      return reply.status(200).send(guild.challenges);
    }
  );

  // ── GET /invites/:inviteId/respond — registered before /:guildId ───────────
  // (Fastify matches routes in registration order; specific paths must come first
  // to avoid the /:guildId wildcard capturing "invites".)

  /**
   * POST /api/guilds/invites/:inviteId/respond
   * Accept or decline a guild invite.
   * Body: { accept: boolean }
   * Returns: 200 with the resolved invite.
   */
  fastify.post(
    "/invites/:inviteId/respond",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { inviteId } = request.params as { inviteId: string };
      const body = request.body as Record<string, unknown> | null | undefined;
      const accept = body?.accept;

      if (typeof accept !== "boolean") {
        return reply
          .status(400)
          .send({ error: "accept must be a boolean", statusCode: 400 });
      }

      const invite = inviteStore.get(inviteId);
      if (!invite) {
        return reply
          .status(404)
          .send({ error: "Invite not found", statusCode: 404 });
      }
      if (invite.inviteeId !== userId) {
        return reply
          .status(403)
          .send({ error: "Not the recipient of this invite", statusCode: 403 });
      }
      if (invite.status !== "pending") {
        return reply
          .status(409)
          .send({ error: "Invite is no longer pending", statusCode: 409 });
      }

      if (!accept) {
        invite.status = "declined";
        return reply.status(200).send(invite);
      }

      // Accept: join the guild
      const guild = guildStore.get(invite.guildId);
      if (!guild) {
        return reply
          .status(404)
          .send({ error: "Guild no longer exists", statusCode: 404 });
      }
      if (guild.members.length >= GUILD_MAX_MEMBERS) {
        return reply
          .status(409)
          .send({ error: "Guild is full", statusCode: 409 });
      }
      if (membershipIndex.has(userId)) {
        return reply
          .status(409)
          .send({ error: "Already a member of a guild. Leave first.", statusCode: 409 });
      }

      const joiner = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      guild.members.push({
        userId,
        displayName: joiner?.displayName ?? null,
        role: "member",
        joinedAt: Date.now(),
      });
      membershipIndex.set(userId, guild.id);
      invite.status = "accepted";

      return reply.status(200).send(invite);
    }
  );

  // ── POST /create ────────────────────────────────────────────────────────────

  /**
   * POST /api/guilds/create
   * Create a new guild. The creator becomes the leader.
   * Body: { name, tag, emblemId, description }
   * Returns: 201 with the created guild.
   */
  fastify.post(
    "/create",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const name = body?.name;
      const tag = body?.tag;
      const emblemId = body?.emblemId;
      const description = body?.description;

      if (typeof name !== "string" || name.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "name is required", statusCode: 400 });
      }
      if (name.trim().length > GUILD_NAME_MAX_LEN) {
        return reply.status(400).send({
          error: `name must be at most ${GUILD_NAME_MAX_LEN} characters`,
          statusCode: 400,
        });
      }
      if (typeof tag !== "string" || tag.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "tag is required", statusCode: 400 });
      }
      if (tag.trim().length > GUILD_TAG_MAX_LEN) {
        return reply.status(400).send({
          error: `tag must be at most ${GUILD_TAG_MAX_LEN} characters`,
          statusCode: 400,
        });
      }
      if (typeof emblemId !== "string" || emblemId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "emblemId is required", statusCode: 400 });
      }
      if (description !== undefined && typeof description !== "string") {
        return reply
          .status(400)
          .send({ error: "description must be a string", statusCode: 400 });
      }
      if (
        typeof description === "string" &&
        description.length > GUILD_DESC_MAX_LEN
      ) {
        return reply.status(400).send({
          error: `description must be at most ${GUILD_DESC_MAX_LEN} characters`,
          statusCode: 400,
        });
      }

      // A player may only be in one guild at a time
      if (membershipIndex.has(userId)) {
        return reply
          .status(409)
          .send({ error: "Already a member of a guild. Leave first.", statusCode: 409 });
      }

      // Guild names must be unique
      const nameTaken = [...guildStore.values()].some(
        (g) => g.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (nameTaken) {
        return reply
          .status(409)
          .send({ error: "Guild name is already taken", statusCode: 409 });
      }

      const creator = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      const guild: Guild = {
        id: crypto.randomUUID(),
        name: sanitize(name),
        tag: sanitize(tag).toUpperCase(),
        emblemId: sanitize(emblemId),
        description: typeof description === "string" ? sanitize(description) : "",
        members: [
          {
            userId,
            displayName: creator?.displayName ?? null,
            role: "leader",
            joinedAt: Date.now(),
          },
        ],
        gkp: 0,
        challenges: seedWeeklyChallenges(),
        createdAt: Date.now(),
        open: true,
      };

      guildStore.set(guild.id, guild);
      membershipIndex.set(userId, guild.id);

      return reply.status(201).send(guild);
    }
  );

  // ── GET /:guildId ───────────────────────────────────────────────────────────

  /**
   * GET /api/guilds/:guildId
   * Returns the full guild profile including members, challenges, and GKP.
   * Public endpoint — no authentication required.
   */
  fastify.get(
    "/:guildId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { guildId } = request.params as { guildId: string };
      const guild = guildStore.get(guildId);

      if (!guild) {
        return reply
          .status(404)
          .send({ error: "Guild not found", statusCode: 404 });
      }

      return reply.status(200).send(guild);
    }
  );

  // ── POST /:guildId/join ─────────────────────────────────────────────────────

  /**
   * POST /api/guilds/:guildId/join
   * Join an open guild directly (no invite required). Max 30 members.
   * Returns: 200 with the updated guild.
   */
  fastify.post(
    "/:guildId/join",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { guildId } = request.params as { guildId: string };

      const guild = guildStore.get(guildId);
      if (!guild) {
        return reply
          .status(404)
          .send({ error: "Guild not found", statusCode: 404 });
      }
      if (!guild.open) {
        return reply
          .status(403)
          .send({ error: "This guild is invite-only", statusCode: 403 });
      }
      if (guild.members.length >= GUILD_MAX_MEMBERS) {
        return reply
          .status(409)
          .send({ error: "Guild is full", statusCode: 409 });
      }
      if (membershipIndex.has(userId)) {
        return reply
          .status(409)
          .send({ error: "Already a member of a guild. Leave first.", statusCode: 409 });
      }

      const joiner = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      guild.members.push({
        userId,
        displayName: joiner?.displayName ?? null,
        role: "member",
        joinedAt: Date.now(),
      });
      membershipIndex.set(userId, guildId);

      return reply.status(200).send(guild);
    }
  );

  // ── POST /:guildId/leave ────────────────────────────────────────────────────

  /**
   * POST /api/guilds/:guildId/leave
   * Leave a guild. A leader must promote another member first.
   * Returns: 204 No Content.
   */
  fastify.post(
    "/:guildId/leave",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { guildId } = request.params as { guildId: string };

      const guild = guildStore.get(guildId);
      if (!guild) {
        return reply
          .status(404)
          .send({ error: "Guild not found", statusCode: 404 });
      }

      const member = findMember(guild, userId);
      if (!member) {
        return reply
          .status(400)
          .send({ error: "Not a member of this guild", statusCode: 400 });
      }

      if (member.role === "leader" && guild.members.length > 1) {
        return reply.status(409).send({
          error:
            "As leader, promote another member to leader before leaving",
          statusCode: 409,
        });
      }

      guild.members = guild.members.filter((m) => m.userId !== userId);
      membershipIndex.delete(userId);

      // If the last member leaves, dissolve the guild
      if (guild.members.length === 0) {
        guildStore.delete(guildId);
      }

      return reply.status(204).send();
    }
  );

  // ── POST /:guildId/invite ───────────────────────────────────────────────────

  /**
   * POST /api/guilds/:guildId/invite
   * Send a guild invite. Requires officer or leader role.
   * Body: { playerId: string }
   * Returns: 201 with the invite record.
   */
  fastify.post(
    "/:guildId/invite",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown> | null | undefined;
      const inviteeId = body?.playerId;

      if (typeof inviteeId !== "string" || inviteeId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "playerId is required", statusCode: 400 });
      }

      const guild = guildStore.get(guildId);
      if (!guild) {
        return reply
          .status(404)
          .send({ error: "Guild not found", statusCode: 404 });
      }

      const inviter = findMember(guild, userId);
      if (!inviter) {
        return reply
          .status(403)
          .send({ error: "Not a member of this guild", statusCode: 403 });
      }
      if (inviter.role === "member") {
        return reply
          .status(403)
          .send({ error: "Only officers and leaders can send invites", statusCode: 403 });
      }
      if (guild.members.length >= GUILD_MAX_MEMBERS) {
        return reply
          .status(409)
          .send({ error: "Guild is full", statusCode: 409 });
      }

      // Verify the invitee exists
      const invitee = await db
        .select({ id: users.id, isDeleted: users.isDeleted })
        .from(users)
        .where(eq(users.id, inviteeId))
        .get();

      if (!invitee || invitee.isDeleted === 1) {
        return reply
          .status(404)
          .send({ error: "Player not found", statusCode: 404 });
      }
      if (membershipIndex.has(inviteeId)) {
        return reply
          .status(409)
          .send({ error: "Player is already in a guild", statusCode: 409 });
      }

      // Check for a pre-existing pending invite
      const existingInvite = [...inviteStore.values()].find(
        (inv) =>
          inv.guildId === guildId &&
          inv.inviteeId === inviteeId &&
          inv.status === "pending"
      );
      if (existingInvite) {
        return reply
          .status(409)
          .send({ error: "An invite is already pending for this player", statusCode: 409 });
      }

      const invite: GuildInvite = {
        id: crypto.randomUUID(),
        guildId,
        invitedBy: userId,
        inviteeId,
        status: "pending",
        createdAt: Date.now(),
      };

      inviteStore.set(invite.id, invite);

      return reply.status(201).send(invite);
    }
  );

  // ── POST /:guildId/kick ─────────────────────────────────────────────────────

  /**
   * POST /api/guilds/:guildId/kick
   * Kick a member from the guild.
   * Officers may kick regular members; leaders may kick officers and members.
   * Body: { playerId: string }
   * Returns: 200 with the updated guild.
   */
  fastify.post(
    "/:guildId/kick",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown> | null | undefined;
      const targetId = body?.playerId;

      if (typeof targetId !== "string" || targetId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "playerId is required", statusCode: 400 });
      }

      const guild = guildStore.get(guildId);
      if (!guild) {
        return reply
          .status(404)
          .send({ error: "Guild not found", statusCode: 404 });
      }

      const kicker = findMember(guild, userId);
      if (!kicker || kicker.role === "member") {
        return reply
          .status(403)
          .send({ error: "Only officers and leaders can kick members", statusCode: 403 });
      }

      const target = findMember(guild, targetId);
      if (!target) {
        return reply
          .status(404)
          .send({ error: "Target player is not a member of this guild", statusCode: 404 });
      }

      if (target.userId === userId) {
        return reply
          .status(400)
          .send({ error: "Cannot kick yourself", statusCode: 400 });
      }

      // Officers cannot kick other officers or leaders
      if (kicker.role === "officer" && target.role !== "member") {
        return reply
          .status(403)
          .send({ error: "Officers can only kick regular members", statusCode: 403 });
      }

      // Leaders cannot be kicked
      if (target.role === "leader") {
        return reply
          .status(403)
          .send({ error: "Cannot kick the guild leader", statusCode: 403 });
      }

      guild.members = guild.members.filter((m) => m.userId !== targetId);
      membershipIndex.delete(targetId);

      return reply.status(200).send(guild);
    }
  );
}
