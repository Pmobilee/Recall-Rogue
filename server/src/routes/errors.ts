import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as crypto from "crypto";
import { sqliteDb } from "../db/index.js";
import { config } from "../config.js";

interface ErrorReportBody {
  message?: unknown;
  stack?: unknown;
  context?: unknown;
  timestamp?: unknown;
  userAgent?: unknown;
  url?: unknown;
  platform?: unknown;
  appVersion?: unknown;
}

interface ErrorRow {
  id: string;
  message: string;
  context: string;
  platform: string;
  app_version: string | null;
  url: string;
  ts: number;
}

const MAX_MESSAGE_LEN = 2000;
const MAX_STACK_LEN = 16_000;
const MAX_CONTEXT_LEN = 120;
const MAX_URL_LEN = 1024;
const MAX_USER_AGENT_LEN = 1024;
const MAX_PLATFORM_LEN = 24;
const MAX_APP_VERSION_LEN = 64;

function ensureErrorReportsTable(): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS error_reports (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'web',
      app_version TEXT,
      user_agent TEXT,
      url TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_error_reports_ts ON error_reports(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_error_reports_platform ON error_reports(platform);
    CREATE INDEX IF NOT EXISTS idx_error_reports_context ON error_reports(context);
  `);
}

function clipString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen);
}

function detectPlatform(
  claimedPlatform: string | null,
  userAgent: string
): string {
  if (claimedPlatform && claimedPlatform.trim().length > 0) {
    return clipString(claimedPlatform.trim().toLowerCase(), MAX_PLATFORM_LEN);
  }

  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
    return "ios";
  }
  if (ua.includes("android")) {
    return "android";
  }
  return "web";
}

export async function errorRoutes(fastify: FastifyInstance): Promise<void> {
  ensureErrorReportsTable();

  // Public ingestion endpoint used by the client-side error reporting utility.
  fastify.post(
    "/",
    async (
      request: FastifyRequest<{ Body: ErrorReportBody }>,
      reply: FastifyReply,
    ) => {
      const body = request.body ?? {};
      const message =
        typeof body.message === "string" ? body.message.trim() : "";
      if (message.length < 1) {
        return reply.status(400).send({ error: "message is required" });
      }

      const context =
        typeof body.context === "string" && body.context.trim().length > 0
          ? body.context.trim()
          : "unknown";
      const userAgent =
        typeof body.userAgent === "string" ? body.userAgent : "";
      const url = typeof body.url === "string" ? body.url : "";
      const appVersion =
        typeof body.appVersion === "string" && body.appVersion.trim().length > 0
          ? body.appVersion.trim()
          : null;
      const platform = detectPlatform(
        typeof body.platform === "string" ? body.platform : null,
        userAgent,
      );
      const stack =
        typeof body.stack === "string" && body.stack.trim().length > 0
          ? body.stack
          : null;

      const id = crypto.randomUUID();
      const ts =
        typeof body.timestamp === "number" && Number.isFinite(body.timestamp)
          ? Math.max(0, Math.floor(body.timestamp))
          : Date.now();

      sqliteDb
        .prepare(
          `INSERT INTO error_reports (id, message, stack, context, platform, app_version, user_agent, url, ts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          clipString(message, MAX_MESSAGE_LEN),
          stack ? clipString(stack, MAX_STACK_LEN) : null,
          clipString(context, MAX_CONTEXT_LEN),
          clipString(platform, MAX_PLATFORM_LEN),
          appVersion ? clipString(appVersion, MAX_APP_VERSION_LEN) : null,
          clipString(userAgent, MAX_USER_AGENT_LEN),
          clipString(url, MAX_URL_LEN),
          ts,
        );

      return reply.status(201).send({ accepted: true, id });
    },
  );

  // Admin-only listing for launch triage.
  fastify.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply,
    ) => {
      if (request.headers["x-admin-key"] !== config.adminApiKey) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const parsedLimit = Number.parseInt(request.query?.limit ?? "100", 10);
      const limit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(500, parsedLimit))
        : 100;

      const rows = sqliteDb
        .prepare(
          `SELECT id, message, context, platform, app_version, url, ts
           FROM error_reports
           ORDER BY ts DESC
           LIMIT ?`,
        )
        .all(limit) as ErrorRow[];

      return reply.send({
        items: rows.map((row) => ({
          id: row.id,
          message: row.message,
          context: row.context,
          platform: row.platform,
          appVersion: row.app_version,
          url: row.url,
          timestamp: row.ts,
        })),
      });
    },
  );

  // Health check helper for local verification.
  fastify.get("/health", async (_request, reply) => {
    const row = sqliteDb
      .prepare(`SELECT COUNT(*) as count FROM error_reports`)
      .get() as { count: number };
    return reply.send({ status: "ok", totalReports: row.count });
  });
}
