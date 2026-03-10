/**
 * JWT authentication middleware for the Recall Rogue server.
 * Verifies the Bearer token in the Authorization header and
 * provides a typed accessor for the decoded payload.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "../types/index.js";

/**
 * Fastify preHandler hook that enforces JWT authentication.
 * Attach this to any route or plugin that requires a logged-in user.
 *
 * @example
 * fastify.get('/protected', { preHandler: requireAuth }, handler)
 *
 * @param request - The incoming Fastify request.
 * @param reply   - The Fastify reply object (used to send 401 on failure).
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // @fastify/jwt attaches verify() to the fastify instance; the request
    // convenience method delegates to it using the configured secret.
    await request.jwtVerify();

    // Type-cast: @fastify/jwt sets request.user to the decoded payload.
    // We cast via unknown to satisfy strict typing.
    const payload = request.user as unknown as JwtPayload;

    // Reject refresh tokens presented as access tokens.
    if (payload.type !== "access") {
      return reply.status(401).send({
        error: "Invalid token type",
        statusCode: 401,
      });
    }
  } catch {
    return reply.status(401).send({
      error: "Unauthorized: missing or invalid token",
      statusCode: 401,
    });
  }
}

/**
 * Decode and return the authenticated user from the request.
 * Assumes requireAuth has already run for this request.
 *
 * @param request - An authenticated Fastify request.
 * @returns The JWT payload for the authenticated user.
 * @throws If request.user is not set (i.e. requireAuth was not applied).
 */
export function getAuthUser(request: FastifyRequest): JwtPayload {
  // @fastify/jwt sets request.user; we cast to our typed payload.
  const user = request.user as unknown as JwtPayload | undefined;
  if (!user) {
    throw new Error("getAuthUser called on an unauthenticated request");
  }
  return user;
}
