/**
 * Terra Gacha Server — entry point.
 * Builds and starts the Fastify application with all plugins and routes.
 */

import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import * as path from "path";
import { fileURLToPath } from "url";
import { config, validateProductionConfig } from "./config.js";
import { initSchema } from "./db/migrate.js";
import { initFactsSchema } from "./db/facts-migrate.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { savesRoutes } from "./routes/saves.js";
import { leaderboardRoutes } from "./routes/leaderboards.js";
import { factsRoutes } from "./routes/facts.js";
import { factPackRoutes } from "./routes/factPacks.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { adminRoutes } from "./routes/admin.js";
import { seasonRoutes } from "./routes/seasons.js";
import { notificationRoutes } from "./routes/notifications.js";
import { ugcRoutes } from "./routes/ugc.js";
import { emailRoutes } from "./routes/email.js";
import { audioRoutes } from "./routes/audio.js";
import { iapRoutes } from "./routes/iap.js";
import { patronRoutes } from "./routes/patrons.js";
import { seasonPassRoutes } from "./routes/seasonPass.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { factBundleRoutes } from "./routes/factBundles.js";
import { startBundleScheduler } from "./jobs/bundleScheduler.js";
import { featureFlagRoutes } from "./routes/featureFlags.js";
import { parentalRoutes } from "./routes/parental.js";
import websocket from "@fastify/websocket";
import { coopWsRoutes } from "./routes/coopWs.js";
import { coopRoutes } from "./routes/coop.js";
import { pruneStaleRooms } from "./services/coopRoomService.js";
import { educatorRoutes } from "./routes/educator.js";
import { classroomsRoutes } from "./routes/classrooms.js";

// ── In-memory rate limiter ────────────────────────────────────────────────────

/** Per-key hit counter with a rolling reset timestamp. */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Create a Fastify preHandler that rate-limits requests by (IP + route).
 * Uses a simple fixed-window counter stored in process memory.
 * No external dependencies required.
 *
 * @param max      - Maximum number of requests allowed per window.
 * @param windowMs - Window duration in milliseconds.
 * @returns A preHandler hook function compatible with Fastify route options.
 */
function createRateLimiter(max: number, windowMs: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.ip + ":" + request.routeOptions.url;
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    entry.count++;
    if (entry.count > max) {
      reply.header("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return reply.status(429).send({ error: "Too many requests" });
    }
  };
}

// Pre-built rate-limiter instances for each sensitive auth endpoint.
// Limits are intentionally tighter than the global default.
const loginRateLimit = createRateLimiter(10, 60_000);           // 10/min
const registerRateLimit = createRateLimiter(5, 60_000);          // 5/min
const refreshRateLimit = createRateLimiter(20, 60_000);          // 20/min
const passwordResetRateLimit = createRateLimiter(3, 5 * 60_000); // 3 per 5 min
const savesRateLimit = createRateLimiter(30, 60_000);            // 30/min
const leaderboardRateLimit = createRateLimiter(60, 60_000);      // 60/min

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

  // ── Static asset serving (Phase 34: fact sprites with long-lived Cache-Control) ──
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, "../../../src/assets"),
    prefix: "/assets/",
    decorateReply: false,
    setHeaders: (res, filePath: string) => {
      if (filePath.includes(`${path.sep}sprites${path.sep}facts${path.sep}`)) {
        // Fact sprites are content-addressed by stable fact ID.
        // Safe to cache for 30 days.
        res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      }
    },
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

  // Auth routes — wrapped in an encapsulated plugin so we can attach
  // per-endpoint rate limiters via a scoped preHandler hook.
  await fastify.register(
    async (authInstance) => {
      // Route-level rate limiting: match on the path *after* the /api/auth prefix.
      authInstance.addHook(
        "preHandler",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const url = request.routeOptions.url ?? "";
          if (url === "/login") {
            return loginRateLimit(request, reply);
          }
          if (url === "/register") {
            return registerRateLimit(request, reply);
          }
          if (url === "/refresh") {
            return refreshRateLimit(request, reply);
          }
          if (url === "/password-reset-request") {
            return passwordResetRateLimit(request, reply);
          }
        }
      );

      await authRoutes(authInstance);
    },
    { prefix: "/api/auth" }
  );

  // Saves routes — rate limited to 30 requests/min per IP to prevent save spam.
  await fastify.register(
    async (savesInstance) => {
      savesInstance.addHook("preHandler", savesRateLimit);
      await savesRoutes(savesInstance);
    },
    { prefix: "/api/saves" }
  );

  // Leaderboard routes — rate limited to 60 requests/min per IP.
  await fastify.register(
    async (lbInstance) => {
      lbInstance.addHook("preHandler", leaderboardRateLimit);
      await leaderboardRoutes(lbInstance);
    },
    { prefix: "/api/leaderboards" }
  );
  await fastify.register(factsRoutes, { prefix: "/api/facts" });
  await fastify.register(factPackRoutes, { prefix: "/api/facts/packs" });
  await fastify.register(analyticsRoutes, { prefix: "/api/analytics" });
  await fastify.register(adminRoutes, { prefix: "/api/admin" });

  // Phase 23: Live Ops routes
  await fastify.register(async (scoped) => {
    await scoped.register(seasonRoutes, { prefix: "/api/seasons" });
  }, {});

  await fastify.register(async (scoped) => {
    await scoped.register(notificationRoutes, { prefix: "/api/notifications" });
  }, {});

  await fastify.register(async (scoped) => {
    await scoped.register(ugcRoutes, { prefix: "/api/ugc" });
  }, {});

  await fastify.register(async (scoped) => {
    await scoped.register(emailRoutes, { prefix: "/api/email" });
  }, {});

  // Phase 26: Production backend routes
  await fastify.register(audioRoutes,        { prefix: "/api/audio" });
  await fastify.register(iapRoutes,          { prefix: "/api/iap" });
  await fastify.register(patronRoutes,       { prefix: "/api/patrons" });
  await fastify.register(seasonPassRoutes,   { prefix: "/api/season-pass" });
  await fastify.register(subscriptionRoutes, { prefix: "/api/subscriptions" });

  // Phase 32: Content Scaling routes
  await fastify.register(factBundleRoutes, { prefix: "/api/fact-bundles" });

  // Phase 41: Feature flags routes (registers /api/flags and /api/flags/:key)
  await fastify.register(featureFlagRoutes);

  // Phase 45: Parental controls routes
  await fastify.register(parentalRoutes, { prefix: "/parental" });

  // Phase 44: Teacher Dashboard routes
  const educatorRateLimit = createRateLimiter(20, 60_000); // 20/min
  await fastify.register(
    async (educatorInstance) => {
      educatorInstance.addHook("preHandler", educatorRateLimit);
      await educatorRoutes(educatorInstance);
    },
    { prefix: "/api/educator" }
  );
  await fastify.register(classroomsRoutes, { prefix: "/api/classrooms" });

  // Phase 43: Co-op WebSocket + REST routes
  await fastify.register(websocket);
  await fastify.register(coopRoutes, { prefix: "/api/coop" });
  await fastify.register(coopWsRoutes);   // WebSocket routes registered at root level

  // Prune stale co-op rooms every 30 minutes.
  setInterval(pruneStaleRooms, 30 * 60 * 1000);

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
  // Validate production-critical environment variables before starting
  validateProductionConfig();

  // Bootstrap the database schema (idempotent)
  initSchema();
  initFactsSchema();

  // Schedule win-back cron: initial run after 30s warmup, then daily
  const { runWinBackCron } = await import('./jobs/winBackCron.js');
  setTimeout(() => runWinBackCron().catch(console.error), 30_000);
  setInterval(() => {
    runWinBackCron().catch((err: unknown) =>
      console.error('[Cron] Win-back failed:', err)
    );
  }, 86_400_000);

  // Phase 41.5: Retention alert job — runs every hour
  const { runRetentionAlertJob } = await import('./jobs/retentionAlertJob.js');
  setTimeout(() => { void runRetentionAlertJob() }, 10_000);
  setInterval(() => { void runRetentionAlertJob() }, 60 * 60 * 1000);

  // Phase 41.7: Analytics data retention enforcement — daily purge
  const { runAnalyticsRetentionJob } = await import('./jobs/analyticsRetentionJob.js');
  setTimeout(() => { void runAnalyticsRetentionJob() }, 30_000);
  setInterval(() => { void runAnalyticsRetentionJob() }, 24 * 60 * 60 * 1000);

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

  // Phase 32.6: Start weekly bundle release scheduler
  startBundleScheduler();

  // Phase 45: Weekly learning report cron job (Mondays 08:00 UTC)
  const { registerWeeklyReportJob } = await import('./jobs/weeklyReportJob.js');
  await registerWeeklyReportJob(app);
}

start();
