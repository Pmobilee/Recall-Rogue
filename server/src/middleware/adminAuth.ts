/**
 * Admin API key authentication middleware for the Recall Rogue server.
 * Protects fact management endpoints from unauthenticated access.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";

/**
 * Fastify preHandler that enforces admin API key authentication.
 * Reads the X-Admin-Key header. Returns 401 if missing or wrong.
 *
 * @example
 * fastify.post('/admin-endpoint', { preHandler: requireAdmin }, handler)
 *
 * @param request - The incoming Fastify request.
 * @param reply   - The Fastify reply object (used to send 401 on failure).
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const key = request.headers["x-admin-key"];
  if (!key || key !== config.adminApiKey) {
    reply.status(401).send({ error: "Unauthorized", statusCode: 401 });
  }
}
