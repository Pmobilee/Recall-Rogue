/**
 * Terra Gacha Server — entry point.
 * Builds and starts the Fastify application with all plugins and routes.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "./config.js";
import { initSchema } from "./db/migrate.js";
import { initFactsSchema } from "./db/facts-migrate.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { savesRoutes } from "./routes/saves.js";
import { leaderboardRoutes } from "./routes/leaderboards.js";
import { factsRoutes } from "./routes/facts.js";
import { factPackRoutes } from "./routes/factPacks.js";

/**
 * Build the Fastify application instance with all plugins and routes.
 * Separated from `start()` so tests can import the app without binding a port.
 *
 * @returns A configured Fastify instance (not yet listening).
 */
export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.isProduction ? "warn" : "info",
    },
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: config.corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
    credentials: true,
  });

  // ── JWT ─────────────────────────────────────────────────────────────────────
  await fastify.register(jwt, {
    secret: config.jwtSecret,
  });

  // ── Content-Type parser ─────────────────────────────────────────────────────
  // Fastify parses application/json by default; no extra config needed.

  // ── Global error handler ────────────────────────────────────────────────────
  fastify.setErrorHandler((err: { statusCode?: number; message?: string }, _request, reply) => {
    const statusCode = err.statusCode ?? 500;
    fastify.log.error(err);
    reply.status(statusCode).send({
      error: err.message ?? "Internal Server Error",
      statusCode,
    });
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(savesRoutes, { prefix: "/api/saves" });
  await fastify.register(leaderboardRoutes, { prefix: "/api/leaderboards" });
  await fastify.register(factsRoutes, { prefix: "/api/facts" });
  await fastify.register(factPackRoutes, { prefix: "/api/facts/packs" });

  // ── 404 handler ─────────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: "Route not found", statusCode: 404 });
  });

  return fastify;
}

/**
 * Start the server by building the app and binding to the configured port.
 */
async function start(): Promise<void> {
  // Bootstrap the database schema (idempotent)
  initSchema();
  initFactsSchema();

  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(
      `[server] Terra Gacha API listening on http://0.0.0.0:${config.port}`
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
