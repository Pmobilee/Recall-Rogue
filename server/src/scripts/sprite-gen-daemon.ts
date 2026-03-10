/**
 * Recall Rogue Sprite Generation Daemon.
 * Background process that scans for approved facts needing pixel art,
 * generates sprites via ComfyUI, applies resizing via sharp, and
 * saves them to the public fact-sprites directory.
 *
 * Run: npm run sprite-daemon
 * Stop: SIGINT (Ctrl+C) or SIGTERM
 */

import * as path from "path";
import * as fs from "fs";
import * as url from "url";
import sharp from "sharp";
import { factsDb } from "../db/facts-db.js";
import { initFactsSchema } from "../db/facts-migrate.js";
import { generatePixelArt } from "../services/comfyui.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const SPRITES_OUTPUT_DIR = path.resolve(
  __dirname,
  "../../../../public/fact-sprites"
);
const POLL_INTERVAL_MS = 5000;

/** Row shape for pending sprite facts. */
interface PendingFact {
  id: string;
  statement: string;
  image_prompt: string;
  category_l1: string;
}

let running = true;

// ── Graceful shutdown ────────────────────────────────────────────────────────

process.on("SIGINT", () => {
  console.log("\n[sprite-daemon] Received SIGINT, shutting down...");
  running = false;
});

process.on("SIGTERM", () => {
  console.log("[sprite-daemon] Received SIGTERM, shutting down...");
  running = false;
});

// ── Core generation logic ────────────────────────────────────────────────────

/**
 * Process a single fact: generate 3 variants, resize to 256px and 32px,
 * auto-approve the first variant, and update the DB record.
 *
 * @param fact - The fact to generate sprites for.
 */
async function processFact(fact: PendingFact): Promise<void> {
  const outputDir = path.join(SPRITES_OUTPUT_DIR, fact.id);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`[sprite-daemon] Generating sprites for: "${fact.statement.slice(0, 60)}..."`);

  // Mark as generating
  factsDb
    .prepare("UPDATE facts SET pixel_art_status = 'generating', updated_at = ? WHERE id = ?")
    .run(Date.now(), fact.id);

  try {
    // Generate 3 variants
    for (let i = 0; i < 3; i++) {
      console.log(`[sprite-daemon]   Variant ${i + 1}/3...`);

      const tempPath = await generatePixelArt(fact.image_prompt);

      const dest256 = path.join(outputDir, `variant-${i}-256.png`);
      const dest32 = path.join(outputDir, `variant-${i}-32.png`);

      // Resize and save both sizes
      await sharp(tempPath).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(dest256);
      await sharp(tempPath).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(dest32);

      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Non-fatal
      }
    }

    // Auto-approve variant 0
    const variant0_256 = path.join(outputDir, "variant-0-256.png");
    const variant0_32 = path.join(outputDir, "variant-0-32.png");
    const approved256 = path.join(outputDir, "approved-256.png");
    const approved32 = path.join(outputDir, "approved-32.png");

    if (fs.existsSync(variant0_256)) {
      fs.copyFileSync(variant0_256, approved256);
    }
    if (fs.existsSync(variant0_32)) {
      fs.copyFileSync(variant0_32, approved32);
    }

    const imageUrl = `/fact-sprites/${fact.id}/approved-256.png`;

    factsDb
      .prepare(
        `UPDATE facts
         SET pixel_art_status = 'approved',
             has_pixel_art = 1,
             image_url = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .run(imageUrl, Date.now(), fact.id);

    console.log(`[sprite-daemon] Done: ${fact.id} — saved to ${outputDir}`);
  } catch (err) {
    console.error(`[sprite-daemon] Failed for fact ${fact.id}:`, err);

    factsDb
      .prepare("UPDATE facts SET pixel_art_status = 'failed', updated_at = ? WHERE id = ?")
      .run(Date.now(), fact.id);
  }
}

// ── Main daemon loop ─────────────────────────────────────────────────────────

/**
 * Main loop: scan for pending facts and process them one at a time.
 */
async function runDaemon(): Promise<void> {
  initFactsSchema();
  fs.mkdirSync(SPRITES_OUTPUT_DIR, { recursive: true });

  console.log("[sprite-daemon] Starting sprite generation daemon...");
  console.log(`[sprite-daemon] Output directory: ${SPRITES_OUTPUT_DIR}`);

  while (running) {
    // Find next fact that needs sprites
    const fact = factsDb
      .prepare(
        `SELECT id, statement, image_prompt, category_l1
         FROM facts
         WHERE status = 'approved'
           AND pixel_art_status = 'none'
           AND type NOT IN ('vocabulary', 'grammar', 'phrase')
           AND image_prompt IS NOT NULL
           AND image_prompt != ''
         LIMIT 1`
      )
      .get() as PendingFact | undefined;

    if (!fact) {
      // Nothing to do — wait before polling again
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, POLL_INTERVAL_MS);
        // Allow SIGINT to cancel the wait early
        if (!running) {
          clearTimeout(timeout);
          resolve();
        }
      });
      continue;
    }

    await processFact(fact);
  }

  console.log("[sprite-daemon] Daemon stopped.");
}

// ── Entry point ──────────────────────────────────────────────────────────────
runDaemon().catch((err) => {
  console.error("[sprite-daemon] Fatal error:", err);
  process.exit(1);
});
