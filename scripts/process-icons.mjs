#!/usr/bin/env node
/**
 * process-icons.mjs — Rebuild all game icons from art studio originals.
 *
 * Reads every *_original.png from sprite-gen/output/icons/ (1024×1024),
 * trims backgrounds, resizes to standard sizes, and deploys to:
 *   - public/assets/sprites/icons/       (128×128 lo-res — combat, quiz, badges)
 *   - public/assets/sprites-hires/icons/  (256×256 hi-res — topbar, popups)
 *
 * Each icon is output as both .png (RGBA) and .webp (quality 90).
 *
 * Usage:
 *   node scripts/process-icons.mjs              # Process all originals
 *   node scripts/process-icons.mjs --audit      # Also audit which icons have zero code refs
 *   node scripts/process-icons.mjs --dry-run    # Show what would be processed without writing
 */

import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = new URL('..', import.meta.url).pathname;
const SRC_DIR = join(ROOT, 'sprite-gen/output/icons');
const LO_RES_DIR = join(ROOT, 'public/assets/sprites/icons');
const HI_RES_DIR = join(ROOT, 'public/assets/sprites-hires/icons');

const LO_RES_SIZE = 128;
const HI_RES_SIZE = 256;
const WEBP_QUALITY = 90;

const SUFFIX = '_original.png';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const audit = args.includes('--audit');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure output dirs exist
  if (!dryRun) {
    await mkdir(LO_RES_DIR, { recursive: true });
    await mkdir(HI_RES_DIR, { recursive: true });
  }

  // Discover originals
  const allFiles = await readdir(SRC_DIR);
  const originals = allFiles
    .filter(f => f.endsWith(SUFFIX))
    .sort();

  console.log(`[process-icons] Found ${originals.length} originals in ${SRC_DIR}`);
  if (originals.length === 0) {
    console.error('[process-icons] No *_original.png files found — aborting');
    process.exit(1);
  }

  let processed = 0;
  let failed = 0;
  const failedList = [];

  for (const file of originals) {
    const name = file.slice(0, -SUFFIX.length); // strip _original.png
    const srcPath = join(SRC_DIR, file);

    try {
      // Load and ensure RGBA
      let img = sharp(srcPath).ensureAlpha();

      // ── Stray pixel removal ──────────────────────────────────
      // AI-generated icons often have semi-transparent stray pixels far from the
      // main content. These cause trim() to keep a huge bounding box, making the
      // actual icon tiny within the output frame.
      //
      // Strategy: threshold the alpha channel — pixels below a minimum opacity
      // become fully transparent. Then apply a median filter to remove isolated
      // single-pixel noise while preserving edges.
      {
        const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
        const { width, height, channels } = info;
        if (channels === 4) {
          // Pass 1: zero out pixels with alpha < 20 (nearly invisible stray pixels)
          const ALPHA_THRESHOLD = 20;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < ALPHA_THRESHOLD) {
              data[i - 3] = 0; data[i - 2] = 0; data[i - 1] = 0; data[i] = 0;
            }
          }

          // Pass 2: remove isolated opaque pixels (no opaque neighbours = stray)
          // Check a 3x3 neighbourhood; if fewer than 2 neighbours have alpha > ALPHA_THRESHOLD,
          // clear the pixel. This kills scattered noise without affecting icon edges.
          const NEIGHBOUR_MIN = 2;
          const cleared = Buffer.from(data); // work on a copy
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4;
              if (data[idx + 3] === 0) continue; // already transparent
              let neighbours = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dy === 0 && dx === 0) continue;
                  const nx = x + dx, ny = y + dy;
                  if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                  if (data[(ny * width + nx) * 4 + 3] >= ALPHA_THRESHOLD) neighbours++;
                }
              }
              if (neighbours < NEIGHBOUR_MIN) {
                cleared[idx] = 0; cleared[idx + 1] = 0; cleared[idx + 2] = 0; cleared[idx + 3] = 0;
              }
            }
          }

          img = sharp(cleared, { raw: { width, height, channels } }).ensureAlpha();
        }
      }

      // Trim transparent borders after stray pixel removal.
      try {
        img = img.trim({ threshold: 30 });
      } catch {
        // trim() failed — proceed with untrimmed image
      }

      if (dryRun) {
        console.log(`  [dry-run] ${file} → ${name}.{png,webp} at ${LO_RES_SIZE}px + ${HI_RES_SIZE}px`);
        processed++;
        continue;
      }

      // Generate lo-res (128×128)
      const loResBuffer = await img
        .clone()
        .resize(LO_RES_SIZE, LO_RES_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      await sharp(loResBuffer).toFile(join(LO_RES_DIR, `${name}.png`));
      await sharp(loResBuffer).webp({ quality: WEBP_QUALITY }).toFile(join(LO_RES_DIR, `${name}.webp`));

      // Generate hi-res (256×256)
      const hiResBuffer = await img
        .clone()
        .resize(HI_RES_SIZE, HI_RES_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      await sharp(hiResBuffer).toFile(join(HI_RES_DIR, `${name}.png`));
      await sharp(hiResBuffer).webp({ quality: WEBP_QUALITY }).toFile(join(HI_RES_DIR, `${name}.webp`));

      processed++;
      if (processed % 20 === 0) {
        console.log(`  ... ${processed}/${originals.length} processed`);
      }
    } catch (err) {
      failed++;
      failedList.push({ file, error: err.message });
      console.error(`  [FAIL] ${file}: ${err.message}`);
    }
  }

  console.log('');
  console.log(`[process-icons] Done.`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Lo-res:    ${LO_RES_DIR} (${LO_RES_SIZE}×${LO_RES_SIZE})`);
  console.log(`  Hi-res:    ${HI_RES_DIR} (${HI_RES_SIZE}×${HI_RES_SIZE})`);

  if (failedList.length > 0) {
    console.log('');
    console.log('  Failed files:');
    for (const { file, error } of failedList) {
      console.log(`    ${file}: ${error}`);
    }
  }

  // --audit: check which deployed icons have zero code references
  if (audit) {
    console.log('');
    await runAudit();
  }
}

// ---------------------------------------------------------------------------
// Audit: find icons with no code references
// ---------------------------------------------------------------------------

async function runAudit() {
  const { execSync } = await import('node:child_process');

  console.log('[audit] Checking which deployed icons are referenced in src/...');

  const deployed = (await readdir(LO_RES_DIR))
    .filter(f => f.endsWith('.png'))
    .map(f => f.replace('.png', ''))
    .sort();

  const referenced = [];
  const unreferenced = [];

  for (const name of deployed) {
    try {
      // Search for the icon name (without extension) in src/
      const result = execSync(
        `grep -r "${name}" "${join(ROOT, 'src')}" --include="*.ts" --include="*.svelte" --include="*.js" -l 2>/dev/null`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      if (result) {
        referenced.push({ name, files: result.split('\n').length });
      } else {
        unreferenced.push(name);
      }
    } catch {
      // grep returns non-zero when no matches
      unreferenced.push(name);
    }
  }

  console.log(`  Referenced:   ${referenced.length} icons`);
  console.log(`  Unreferenced: ${unreferenced.length} icons`);

  if (unreferenced.length > 0) {
    console.log('');
    console.log('  Unreferenced icons (no matches in src/):');
    for (const name of unreferenced) {
      console.log(`    ${name}`);
    }
  }
}

main().catch(err => {
  console.error('[process-icons] Fatal error:', err);
  process.exit(1);
});
