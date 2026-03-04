/**
 * Fact bundle discovery routes.
 * GET /api/fact-bundles         — list available weekly bundles
 * GET /api/fact-bundles/:week   — fetch a specific bundle
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// Resolve relative to server/src/routes/ → <project_root>/public/fact-bundles
const BUNDLES_DIR = path.resolve(__dirname, "../../../public/fact-bundles");

/**
 * Register fact bundle discovery routes.
 *
 * @param fastify - The Fastify instance to register routes on.
 */
export async function factBundleRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/fact-bundles
   * Returns the index of all available weekly bundles.
   */
  fastify.get("/", async (_req: FastifyRequest, reply: FastifyReply) => {
    const indexPath = path.join(BUNDLES_DIR, "index.json");
    if (!fs.existsSync(indexPath)) return reply.send({ bundles: [] });
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as unknown;
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send({ bundles: index });
  });

  /**
   * GET /api/fact-bundles/:week
   * Returns the fact bundle for the given ISO year-week (e.g. 2026-W12).
   */
  fastify.get("/:week", async (request: FastifyRequest, reply: FastifyReply) => {
    const { week } = request.params as { week: string };
    // Validate week format (YYYY-WNN)
    if (!/^\d{4}-W\d{2}$/.test(week)) {
      return reply
        .status(400)
        .send({ error: "Invalid week format. Expected YYYY-WNN." });
    }
    const bundlePath = path.join(BUNDLES_DIR, `${week}.json`);
    if (!fs.existsSync(bundlePath)) {
      return reply
        .status(404)
        .send({ error: `Bundle ${week} not found.` });
    }
    const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8")) as unknown;
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.send(bundle);
  });
}
