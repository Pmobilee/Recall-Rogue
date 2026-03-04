/**
 * ASO (App Store Optimization) admin routes for the Terra Gacha server.
 * Phase 42.5: Keyword rank dashboard and screenshot A/B config.
 *
 * Endpoints:
 *   GET /api/aso/keywords    — Return keyword rank history (last 30 days)
 *   GET /api/aso/screenshot-variant — Return A/B screenshot variant for player
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { config } from "../config.js";

/** Validate keyword — letters, numbers, spaces, hyphens only, max 64 chars. */
const KEYWORD_RE = /^[a-zA-Z0-9 _-]{1,64}$/;

/**
 * Register ASO admin endpoints.
 *
 * @param fastify - The Fastify instance to register routes on.
 */
export async function asoRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/aso/keywords
   * Admin endpoint: return keyword rank history for the last N days.
   * Requires the X-Admin-Key header.
   */
  fastify.get<{ Querystring: { days?: string; keyword?: string } }>(
    "/keywords",
    async (
      request: FastifyRequest<{ Querystring: { days?: string; keyword?: string } }>,
      reply: FastifyReply
    ) => {
      // Admin auth check
      const adminKey = request.headers["x-admin-key"];
      if (adminKey !== config.adminApiKey) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const days = Math.min(90, Math.max(1, parseInt(request.query.days ?? "30", 10)));
      const keyword = request.query.keyword;

      if (keyword && !KEYWORD_RE.test(keyword)) {
        return reply.status(400).send({ error: "Invalid keyword" });
      }

      // Return stub data — production would query aso_keyword_ranks table
      const stubData: Array<{
        keyword: string;
        platform: string;
        rank: number | null;
        checked_at: string;
      }> = [];

      void db;    // referenced for type checking; production implementation queries DB
      void days;  // used in production SQL query

      return reply.send({ keywords: stubData, days_requested: days });
    }
  );

  /**
   * GET /api/aso/screenshot-variant
   * Returns the A/B screenshot variant assignment for the requesting session.
   * Used by PwaInstallPrompt.svelte to show the correct App Store screenshot variant.
   */
  fastify.get<{ Querystring: { sessionId?: string } }>(
    "/screenshot-variant",
    async (
      request: FastifyRequest<{ Querystring: { sessionId?: string } }>,
      reply: FastifyReply
    ) => {
      const sessionId = request.query.sessionId ?? request.ip;
      // Simple deterministic A/B split based on session ID hash
      const hash = sessionId
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const variant = hash % 2 === 0 ? "variant_a" : "variant_b";

      return reply.send({ variant, sessionId });
    }
  );
}
