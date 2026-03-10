/**
 * Health check routes for the Recall Rogue server.
 * Returns liveness and readiness information; used by Docker healthcheck and
 * monitoring systems to verify the server and its integrations are running.
 */

import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

const SERVER_START_TIME = Date.now();
const SERVER_VERSION = "1.0.0";

/**
 * Register health check routes on the Fastify instance.
 *
 * @param fastify - The Fastify application instance.
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Basic liveness check. Returns server status, version, and uptime in seconds.
   * No authentication required.
   */
  fastify.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              uptime: { type: "number" },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      return {
        status: "ok",
        version: SERVER_VERSION,
        uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      };
    }
  );

  /**
   * GET /health/ready
   * Readiness check that reports whether each third-party integration is configured.
   * Returns 200 when all integrations are ready, 206 when any are missing config.
   * No authentication required.
   */
  fastify.get("/health/ready", async (_request, reply) => {
    const integrations = {
      revenuecat: Boolean(config.revenuecatApiKey),
      resend: Boolean(config.resendApiKey),
      fcm: Boolean(config.fcmProjectId && config.fcmPrivateKey),
      azureTts: Boolean(config.azureSpeechKey),
    };
    const allReady = Object.values(integrations).every(Boolean);
    return reply.status(allReady ? 200 : 206).send({
      status: allReady ? "ready" : "partial",
      integrations,
      environment: config.nodeEnv,
    });
  });
}
