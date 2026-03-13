/**
 * process-cardframes.mjs
 *
 * Processes card frame PNGs into web-ready WebP files.
 *
 * Usage (run from project root):
 *   node scripts/process-cardframes.mjs
 *
 * Source:  data/generated/CARDFRAMES/Unedited/{category}/{filename}.png
 * Output:  public/assets/cardframes/{mechanicId}.webp        (hires, 512px wide)
 *          public/assets/cardframes/lowres/{mechanicId}.webp (lowres, 256px wide)
 *          public/assets/cardframes/manifest.json
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Mechanic ID → source file mapping
// ---------------------------------------------------------------------------
const FRAME_MAP = {
  strike: 'Attacks/Strike.png',
  multi_hit: 'Attacks/multi-hit.png',
  heavy_strike: 'Attacks/Heavy Strike.png',
  piercing: 'Attacks/Piercing.png',
  reckless: 'Attacks/Reckless.png',
  execute: 'Attacks/Execute.png',
  lifetap: 'Attacks/lifetap.png',
  block: 'Defence/Block.png',
  thorns: 'Defence/Thorns.png',
  fortify: 'Defence/Fortify.png',
  parry: 'Defence/Parry.png',
  brace: 'Defence/Brace.png',
  cleanse: 'Defence/cleanse.png',
  overheal: 'Defence/Overheal.png',
  emergency: 'Defence/Emergency.png',
  empower: 'Buff/Empower.png',
  quicken: 'Buff/Quicken.png',
  double_strike: 'Buff/Double Strike.png',
  focus: 'Buff/Focus.png',
  weaken: 'Debuff/Weaken.png',
  expose: 'Debuff/Expose.png',
  slow: 'Debuff/Slow.png',
  hex: 'Debuff/Hex.png',
  scout: 'Utility/Scout.png',
  recycle: 'Utility/Recycle.png',
  foresight: 'Utility/Foresight.png',
  transmute: 'Utility/Transmute.png',
  immunity: 'Utility/Immunity.png',
  mirror: 'Wild/Mirror.png',
  adapt: 'Wild/Adapt.png',
  overclock: 'Wild/Overclock.png',
};

// ---------------------------------------------------------------------------
// Paths (relative to project root)
// ---------------------------------------------------------------------------
const PROJECT_ROOT = process.cwd();
const SOURCE_BASE = path.join(PROJECT_ROOT, 'data/generated/CARDFRAMES/Unedited');
const OUTPUT_BASE = path.join(PROJECT_ROOT, 'public/assets/cardframes');
const OUTPUT_LOWRES = path.join(OUTPUT_BASE, 'lowres');
const MANIFEST_PATH = path.join(OUTPUT_BASE, 'manifest.json');

const HIRES_WIDTH = 512;
const LOWRES_WIDTH = 256;
const WEBP_QUALITY = 90;

// Weaken has a known broken ratio (~1.12); anything below this threshold triggers a warning.
const RATIO_WARNING_THRESHOLD = 1.2;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Ensure output directories exist
  await mkdir(OUTPUT_BASE, { recursive: true });
  await mkdir(OUTPUT_LOWRES, { recursive: true });

  const frames = {};
  const warnings = [];
  let processed = 0;
  let skipped = 0;

  for (const [mechId, relPath] of Object.entries(FRAME_MAP)) {
    const srcPath = path.join(SOURCE_BASE, relPath);

    if (!existsSync(srcPath)) {
      console.warn(`[${mechId}] WARNING: source file not found — ${srcPath}`);
      warnings.push(`${mechId}: source file not found`);
      skipped++;
      continue;
    }

    try {
      // Step 1: Load and trim transparent borders
      const trimmed = sharp(srcPath).trim();

      // Step 2: Get metadata of the trimmed image to compute ratio
      // We pipe through a resize to get the final dimensions
      const hiresBuffer = await trimmed
        .clone()
        .resize(HIRES_WIDTH, null, { fit: 'inside', withoutEnlargement: false })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

      const { width, height } = hiresBuffer.info;
      const ratio = parseFloat((height / width).toFixed(2));

      // Step 3: Write hires WebP
      const hiresOut = path.join(OUTPUT_BASE, `${mechId}.webp`);
      await writeFile(hiresOut, hiresBuffer.data);

      // Step 4: Write lowres WebP
      const lowresBuffer = await trimmed
        .clone()
        .resize(LOWRES_WIDTH, null, { fit: 'inside', withoutEnlargement: false })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const lowresOut = path.join(OUTPUT_LOWRES, `${mechId}.webp`);
      await writeFile(lowresOut, lowresBuffer);

      console.log(
        `[${mechId}] ${relPath} → trimmed ${width}x${height} ratio=${ratio}`
      );

      // Warn on suspiciously small ratio (broken outlier like Weaken ~1.12)
      if (ratio < RATIO_WARNING_THRESHOLD) {
        const msg = `${mechId}: ratio ${ratio} is unusually low (possible broken/landscape frame)`;
        console.warn(`  ⚠ WARNING: ${msg}`);
        warnings.push(msg);
      }

      frames[mechId] = {
        file: `${mechId}.webp`,
        lowres: `lowres/${mechId}.webp`,
        width,
        height,
        ratio,
      };

      processed++;
    } catch (err) {
      const msg = `${mechId}: processing failed — ${err.message}`;
      console.error(`[${mechId}] ERROR: ${err.message}`);
      warnings.push(msg);
      skipped++;
    }
  }

  // Compute defaultRatio as median of all processed ratios (robust to outliers)
  const ratios = Object.values(frames).map((f) => f.ratio);
  let defaultRatio = 1.42;
  if (ratios.length > 0) {
    const sorted = [...ratios].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    defaultRatio =
      sorted.length % 2 === 0
        ? parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
        : sorted[mid];
  }

  const manifest = { frames, defaultRatio };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('');
  console.log('─'.repeat(60));
  console.log(`Manifest written to: ${MANIFEST_PATH}`);
  console.log(`Processed: ${processed}  Skipped/errored: ${skipped}`);
  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  • ${w}`);
    }
  } else {
    console.log('No warnings.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
