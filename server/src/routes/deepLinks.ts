/**
 * Deep link routing endpoints for the Terra Gacha server.
 * Phase 42.4: Serves AASA (Apple App Site Association) and assetlinks.json.
 *
 * Endpoints:
 *   GET /.well-known/apple-app-site-association  — iOS Universal Links config
 *   GET /.well-known/assetlinks.json             — Android App Links config
 *   GET /invite/:code                            — Invite landing page
 *   GET /fact/:factId                            — Fact share landing page
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/** Validate referral code format: alphanumeric + hyphens, 6-32 chars. */
const INVITE_CODE_RE = /^[a-zA-Z0-9-]{6,32}$/;
/** Validate fact/badge IDs: word chars + hyphens, 1-64 chars. */
const PARAM_RE = /^[\w-]{1,64}$/;

/**
 * Register deep link related routes.
 *
 * @param fastify - The Fastify instance to register routes on.
 */
export async function deepLinkRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /.well-known/apple-app-site-association
   * Serves the AASA file for iOS Universal Links.
   * Must be served with Content-Type: application/json and no redirect.
   */
  fastify.get("/.well-known/apple-app-site-association", async (_req, reply: FastifyReply) => {
    reply
      .header("Cache-Control", "public, max-age=86400")
      .type("application/json")
      .send({
        applinks: {
          apps: [],
          details: [
            {
              appID: "TEAMID.com.terragacha.app",
              paths: ["/invite/*", "/badge/*/*", "/fact/*"],
            },
          ],
        },
      });
  });

  /**
   * GET /.well-known/assetlinks.json
   * Serves the Android App Links verification file.
   * Must be served with Content-Type: application/json and no redirect.
   */
  fastify.get("/.well-known/assetlinks.json", async (_req, reply: FastifyReply) => {
    reply
      .header("Cache-Control", "public, max-age=86400")
      .type("application/json")
      .send([
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "com.terragacha.app",
            sha256_cert_fingerprints: [
              "PLACEHOLDER_REPLACE_WITH_KEYSTORE_SHA256",
            ],
          },
        },
      ]);
  });

  /**
   * GET /invite/:code
   * Landing page for referral invite links.
   * Detects mobile and attempts to open the app; falls back to App Store / Play Store.
   */
  fastify.get<{ Params: { code: string } }>(
    "/invite/:code",
    async (
      request: FastifyRequest<{ Params: { code: string } }>,
      reply: FastifyReply
    ) => {
      const { code } = request.params;
      if (!code || !INVITE_CODE_RE.test(code)) {
        return reply.status(400).send("Invalid invite code");
      }

      const safeCode = encodeURIComponent(code);

      reply.type("text/html").send(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="Join me on Terra Gacha!">
  <meta property="og:description" content="Mine for ancient knowledge in Terra Gacha.">
  <title>Terra Gacha Invite</title>
</head>
<body>
  <p>Opening Terra Gacha\u2026</p>
  <script>
    var code = ${JSON.stringify(safeCode)};
    window.location = 'terragacha://invite/' + code;
    setTimeout(function() {
      var ua = navigator.userAgent;
      if (/iPad|iPhone|iPod/.test(ua)) {
        window.location = 'https://apps.apple.com/app/terra-gacha/id000000000';
      } else if (/Android/.test(ua)) {
        window.location = 'https://play.google.com/store/apps/details?id=com.terragacha.app';
      } else {
        window.location = 'https://terragacha.com';
      }
    }, 1500);
  <\/script>
</body>
</html>`
      );
    }
  );

  /**
   * GET /fact/:factId
   * Static fact share landing page.
   */
  fastify.get<{ Params: { factId: string } }>(
    "/fact/:factId",
    async (
      request: FastifyRequest<{ Params: { factId: string } }>,
      reply: FastifyReply
    ) => {
      const { factId } = request.params;
      if (!factId || !PARAM_RE.test(factId)) {
        return reply.status(400).send("Invalid fact ID");
      }

      const safeFactId = encodeURIComponent(factId);

      reply.type("text/html").send(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="Discover this Earth fact in Terra Gacha">
  <meta property="og:description" content="Learn fascinating facts about Earth's history through mining and exploration.">
  <title>Terra Gacha Fact</title>
</head>
<body>
  <p>Opening Terra Gacha\u2026</p>
  <script>
    window.location = 'terragacha://fact/${safeFactId}';
    setTimeout(function() { window.location = 'https://terragacha.com'; }, 1500);
  <\/script>
</body>
</html>`
      );
    }
  );
}
