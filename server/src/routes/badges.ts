/**
 * Badge routes for the Recall Rogue server.
 * Phase 42.3: Social proof badges with public badge pages (Open Graph).
 *
 * Endpoints:
 *   GET /api/badges/me          — Fetch current player's earned badges
 *   GET /badge/:playerId/:badgeId — Public badge OG page (social unfurl)
 *   GET /api/badges/:playerId/:badgeId/image.svg — Badge SVG image
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";

// ── Badge definitions (server-side mirror of client badgeService.ts) ──────────

interface BadgeDefinitionServer {
  id: string;
  label: string;
  description: string;
  iconSvgPath: string;
}

const BADGE_DEFINITIONS_SERVER: BadgeDefinitionServer[] = [
  {
    id: "century_scholar",
    label: "Century Scholar",
    description: "100 facts mastered",
    iconSvgPath:
      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  },
  {
    id: "deep_diver",
    label: "Deep Diver",
    description: "Reached Layer 15",
    iconSvgPath: "M20 14l-8 8-8-8 1.4-1.4L11 17.2V4h2v13.2l5.6-5.6L20 14z",
  },
  {
    id: "streak_legend",
    label: "Streak Legend",
    description: "30-day login streak",
    iconSvgPath:
      "M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 13C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.05Z",
  },
  {
    id: "guild_champion",
    label: "Guild Champion",
    description: "Guild completed 3 challenges",
    iconSvgPath:
      "M12 1L15.39 8.28L23 9.27L17.5 14.64L18.78 22.27L12 18.77L5.22 22.27L6.5 14.64L1 9.27L8.61 8.28L12 1Z",
  },
  {
    id: "pioneer",
    label: "Pioneer",
    description: "Early Supporter",
    iconSvgPath:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z",
  },
];

/** Validate player ID / badge ID — alphanumeric + hyphens + underscores only. */
const PARAM_RE = /^[\w-]{1,64}$/;

/** Encode HTML special characters to prevent XSS in server-rendered HTML. */
function htmlEncode(str: string): string {
  return str.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

// ── In-memory badge store (stub — replace with DB in production) ──────────────
/** Maps playerId → Set<badgeId> for earned badges. */
const badgeStore = new Map<string, Set<string>>();
const badgeEarnedAt = new Map<string, Map<string, string>>();

/**
 * Register all badge routes on the given Fastify instance.
 *
 * @param fastify - The Fastify instance to register routes on.
 */
export async function badgeRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/badges/me
   * Returns all badges earned by the authenticated player.
   */
  fastify.get(
    "/me",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getAuthUser(request);
      if (!user) return reply.status(401).send({ error: "Unauthorized" });

      const earned = badgeStore.get(user.sub) ?? new Set<string>();
      const earnedAtMap = badgeEarnedAt.get(user.sub) ?? new Map<string, string>();

      const badges = Array.from(earned).map((id) => ({
        id,
        earnedAt: earnedAtMap.get(id) ?? new Date().toISOString(),
      }));

      return reply.send({ badges });
    }
  );

  /**
   * POST /api/badges/award
   * Awards a badge to a player (called by internal game events).
   * Body: { playerId, badgeId }
   */
  fastify.post<{ Body: { playerId: string; badgeId: string } }>(
    "/award",
    async (request: FastifyRequest<{ Body: { playerId: string; badgeId: string } }>, reply: FastifyReply) => {
      const { playerId, badgeId } = request.body ?? {};
      if (!playerId || !badgeId) {
        return reply.status(400).send({ error: "Missing playerId or badgeId" });
      }
      if (!PARAM_RE.test(playerId) || !PARAM_RE.test(badgeId)) {
        return reply.status(400).send({ error: "Invalid parameters" });
      }
      if (!BADGE_DEFINITIONS_SERVER.find((b) => b.id === badgeId)) {
        return reply.status(404).send({ error: "Unknown badge" });
      }

      if (!badgeStore.has(playerId)) badgeStore.set(playerId, new Set());
      if (!badgeEarnedAt.has(playerId)) badgeEarnedAt.set(playerId, new Map());

      badgeStore.get(playerId)!.add(badgeId);
      badgeEarnedAt.get(playerId)!.set(badgeId, new Date().toISOString());

      return reply.send({ awarded: true });
    }
  );

  /**
   * GET /badge/:playerId/:badgeId
   * Public badge OG page for social media link unfurling.
   * Returns HTML with Open Graph meta tags.
   */
  fastify.get<{ Params: { playerId: string; badgeId: string } }>(
    "/badge/:playerId/:badgeId",
    async (
      request: FastifyRequest<{ Params: { playerId: string; badgeId: string } }>,
      reply: FastifyReply
    ) => {
      const { playerId, badgeId } = request.params;

      // Validate inputs — alphanumeric + hyphens + underscores only
      if (!PARAM_RE.test(playerId) || !PARAM_RE.test(badgeId)) {
        return reply.status(400).send("Invalid parameters");
      }

      // Check badge exists
      const def = BADGE_DEFINITIONS_SERVER.find((b) => b.id === badgeId);
      if (!def) return reply.status(404).send("Unknown badge");

      // Check player has earned it (stub: check in-memory store; production would query DB)
      const earned = badgeStore.get(playerId);
      if (!earned?.has(badgeId)) {
        return reply.status(404).send("Badge not found");
      }

      // Get display name — stub uses playerId prefix
      const safeName = htmlEncode(`Explorer-${playerId.slice(0, 6)}`);

      const ogImageUrl = `https://terragacha.com/api/badges/${encodeURIComponent(playerId)}/${encodeURIComponent(badgeId)}/image.svg`;

      reply.type("text/html").send(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${htmlEncode(safeName)} earned: ${htmlEncode(def.label)}">
  <meta property="og:description" content="${htmlEncode(def.description)} \u2014 Recall Rogue">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:url" content="https://terragacha.com/badge/${encodeURIComponent(playerId)}/${encodeURIComponent(badgeId)}">
  <meta name="twitter:card" content="summary_large_image">
  <title>${htmlEncode(safeName)} \u2014 ${htmlEncode(def.label)} | Recall Rogue</title>
</head>
<body>
  <p>Redirecting to Recall Rogue\u2026</p>
  <script>
    window.location = 'terragacha://badge/${encodeURIComponent(playerId)}/${encodeURIComponent(badgeId)}';
    setTimeout(function() { window.location = 'https://terragacha.com'; }, 2000);
  <\/script>
</body>
</html>`
      );
    }
  );

  /**
   * GET /api/badges/:playerId/:badgeId/image.svg
   * Returns an SVG badge image for the given player and badge.
   */
  fastify.get<{ Params: { playerId: string; badgeId: string } }>(
    "/:playerId/:badgeId/image.svg",
    async (
      request: FastifyRequest<{ Params: { playerId: string; badgeId: string } }>,
      reply: FastifyReply
    ) => {
      const { playerId, badgeId } = request.params;
      if (!PARAM_RE.test(playerId) || !PARAM_RE.test(badgeId)) {
        return reply.status(400).send("Invalid parameters");
      }

      const def = BADGE_DEFINITIONS_SERVER.find((b) => b.id === badgeId);
      if (!def) return reply.status(404).send("Unknown badge");

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="24" fill="#0D1B2A"/>
  <circle cx="100" cy="80" r="48" fill="#00CCFF22" stroke="#00CCFF" stroke-width="2"/>
  <path d="${def.iconSvgPath}" fill="#00CCFF" transform="translate(88,68) scale(1)"/>
  <text x="100" y="148" font-family="monospace" font-size="14" font-weight="bold" fill="#F0F4FF" text-anchor="middle">${htmlEncode(def.label)}</text>
  <text x="100" y="168" font-family="monospace" font-size="11" fill="#8AA8CC" text-anchor="middle">RECALL ROGUE</text>
</svg>`;

      reply.type("image/svg+xml").send(svg);
    }
  );
}

void db; // referenced for type-checking only; production implementation would query the DB
