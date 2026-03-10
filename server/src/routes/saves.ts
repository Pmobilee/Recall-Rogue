/**
 * Save data routes for the Recall Rogue server.
 * Allows authenticated players to upload and retrieve their game saves.
 * All routes require a valid JWT (enforced via requireAuth preHandler).
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  RouteShorthandOptions,
} from "fastify";
import * as crypto from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { saves } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import type { SaveRecord, SaveSummary } from "../types/index.js";
import { checkSavePlausibility, logAntiCheatFlags } from "../services/antiCheat.js";

/**
 * Save summary extended with an is_active flag.
 * The active save is the most recent one (last written); older ones are
 * history-only snapshots that are retained per the MAX_SAVE_HISTORY policy.
 */
interface SaveSummaryWithActive extends SaveSummary {
  /** True for the most recent (active) save; false for older history entries. */
  isActive: boolean;
}

/** Maximum number of save history entries to keep per user. */
const MAX_SAVE_HISTORY = 10;

/** Maximum allowed size for save data JSON (1 MB). */
const MAX_SAVE_BYTES = 1_048_576;

const withAuth: RouteShorthandOptions = { preHandler: requireAuth };

/**
 * Register save-data routes on the Fastify instance.
 * All routes are prefixed with /api/saves by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function savesRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET / — latest save ─────────────────────────────────────────────────────

  /**
   * GET /api/saves
   * Returns the most recent save for the authenticated user.
   * Returns 404 if no save exists yet.
   */
  fastify.get("/", withAuth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: userId } = getAuthUser(request);

    const row = await db
      .select()
      .from(saves)
      .where(eq(saves.userId, userId))
      .orderBy(desc(saves.createdAt))
      .limit(1)
      .get();

    if (!row) {
      return reply
        .status(404)
        .send({ error: "No save found for this user", statusCode: 404 });
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(row.saveData);
    } catch {
      return reply.status(500).send({
        error: "Stored save data is corrupted",
        statusCode: 500,
      });
    }

    const result: SaveRecord = {
      id: row.id,
      userId: row.userId,
      saveData: parsedData,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return result;
  });

  // ── POST / — upload save ────────────────────────────────────────────────────

  /**
   * POST /api/saves
   * Uploads a new save snapshot for the authenticated user.
   * Body: { saveData: object, version?: number }
   * Prunes old entries to keep only the last MAX_SAVE_HISTORY saves.
   */
  fastify.post("/", withAuth, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub: userId } = getAuthUser(request);

    // Access body as unknown and validate manually
    const body = request.body as Record<string, unknown> | null | undefined;
    const saveData = body?.saveData;
    const version = typeof body?.version === "number" ? Math.floor(body.version) : 1;

    if (saveData === undefined || saveData === null) {
      return reply
        .status(400)
        .send({ error: "saveData is required", statusCode: 400 });
    }

    // Validate that saveData is a plain object (not a string, array, etc.)
    if (typeof saveData !== "object" || Array.isArray(saveData)) {
      return reply
        .status(400)
        .send({ error: "saveData must be a JSON object", statusCode: 400 });
    }

    // Enforce size limit
    let serialised: string;
    try {
      serialised = JSON.stringify(saveData);
    } catch {
      return reply
        .status(400)
        .send({ error: "saveData is not serialisable", statusCode: 400 });
    }

    if (Buffer.byteLength(serialised, "utf8") > MAX_SAVE_BYTES) {
      return reply.status(413).send({
        error: `saveData exceeds maximum size (${MAX_SAVE_BYTES} bytes)`,
        statusCode: 413,
      });
    }

    // Anti-cheat plausibility check (DD-V2-225).
    // Flags anomalous saves for soft review but always accepts the save.
    const { flags } = checkSavePlausibility(saveData as Record<string, unknown>);
    if (flags.length > 0) {
      logAntiCheatFlags(userId, flags);
    }

    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(saves).values({
      id,
      userId,
      saveData: serialised,
      version,
      createdAt: now,
      updatedAt: now,
    });

    // Prune old saves beyond MAX_SAVE_HISTORY
    const allSaves = await db
      .select({ id: saves.id })
      .from(saves)
      .where(eq(saves.userId, userId))
      .orderBy(desc(saves.createdAt))
      .all();

    if (allSaves.length > MAX_SAVE_HISTORY) {
      const toDelete = allSaves.slice(MAX_SAVE_HISTORY).map((s) => s.id);
      for (const oldId of toDelete) {
        await db.delete(saves).where(eq(saves.id, oldId));
      }
    }

    const result: SaveRecord = {
      id,
      userId,
      saveData,
      version,
      createdAt: now,
      updatedAt: now,
    };
    return reply.status(201).send(result);
  });

  // ── GET /history ────────────────────────────────────────────────────────────

  /**
   * GET /api/saves/history
   * Returns a list of save summaries (no saveData blob) for the user,
   * capped at MAX_SAVE_HISTORY entries. The first entry (index 0, most recent)
   * is marked is_active=true; all older entries are history-only (is_active=false).
   * Ordered by creation date, most recent first.
   */
  fastify.get("/history", withAuth, async (request: FastifyRequest): Promise<SaveSummaryWithActive[]> => {
    const { sub: userId } = getAuthUser(request);

    const rows = await db
      .select({
        id: saves.id,
        version: saves.version,
        createdAt: saves.createdAt,
        updatedAt: saves.updatedAt,
      })
      .from(saves)
      .where(eq(saves.userId, userId))
      .orderBy(desc(saves.createdAt))
      .limit(MAX_SAVE_HISTORY)
      .all();

    // The latest save (first row after DESC sort) is the active one.
    // All others are historical snapshots that can be restored but not modified.
    return rows.map((row, index) => ({
      ...row,
      isActive: index === 0,
    }));
  });
}
