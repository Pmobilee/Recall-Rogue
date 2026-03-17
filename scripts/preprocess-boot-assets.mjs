/**
 * preprocess-boot-assets.mjs
 *
 * Processes boot animation source assets and outputs resized/blurred variants
 * to public/assets/boot/ for use in the boot animation sequence.
 *
 * Usage: node scripts/preprocess-boot-assets.mjs
 */

import sharp from 'sharp';
import { mkdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const SRC_DIR = join(ROOT, 'data/generated/boot_anim');
const OUT_DIR = join(ROOT, 'public/assets/boot');

const OUTPUT_WIDTH = 1024;

// --- Helpers ---

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function reportOutput(filePath) {
  const meta = await sharp(filePath).metadata();
  const size = statSync(filePath).size;
  const name = filePath.split('/').pop();
  console.log(`  ✓ ${name.padEnd(36)} ${meta.width}×${meta.height}  ${formatBytes(size)}`);
}

/**
 * Resize a source image to OUTPUT_WIDTH maintaining aspect ratio.
 * Returns a sharp pipeline with the resized image (as raw Buffer).
 */
async function resizedBuffer(srcPath) {
  return sharp(srcPath)
    .resize({ width: OUTPUT_WIDTH, withoutEnlargement: false })
    .png();
}

/**
 * Process a logo-layer image (logo, recallrogue, bramblegategames):
 * - Resize to 512px wide
 * - Save base, blur_medium (sigma 3), blur_heavy (sigma 6)
 */
async function processLogoLayer(srcFilename, outBasename) {
  const srcPath = join(SRC_DIR, srcFilename);
  const baseName = outBasename.replace(/\.png$/, '');

  // Base resized
  const baseOut = join(OUT_DIR, `${baseName}.png`);
  await sharp(srcPath)
    .resize({ width: OUTPUT_WIDTH })
    .png()
    .toFile(baseOut);
  await reportOutput(baseOut);

  // Blur medium (sigma 3)
  const blurMedOut = join(OUT_DIR, `${baseName}_blur_medium.png`);
  await sharp(srcPath)
    .resize({ width: OUTPUT_WIDTH })
    .blur(3)
    .png()
    .toFile(blurMedOut);
  await reportOutput(blurMedOut);

  // Blur heavy (sigma 6)
  const blurHeavyOut = join(OUT_DIR, `${baseName}_blur_heavy.png`);
  await sharp(srcPath)
    .resize({ width: OUTPUT_WIDTH })
    .blur(6)
    .png()
    .toFile(blurHeavyOut);
  await reportOutput(blurHeavyOut);
}

/**
 * Process a cave ring image:
 * - Resize to 512px wide
 * - Save as cave_ring_N.png (no # in name)
 * - No blur variants
 */
async function processCaveRing(srcFilename, outBasename) {
  const srcPath = join(SRC_DIR, srcFilename);
  const outPath = join(OUT_DIR, outBasename);

  await sharp(srcPath)
    .resize({ width: OUTPUT_WIDTH })
    .png()
    .toFile(outPath);
  await reportOutput(outPath);
}

// --- Main ---

async function main() {
  console.log('=== preprocess-boot-assets ===');
  console.log(`Source : ${SRC_DIR}`);
  console.log(`Output : ${OUT_DIR}`);
  console.log('');

  ensureDir(OUT_DIR);

  // Logo layers (3072×5504 → 1024×1835)
  console.log('Logo layers:');
  await processLogoLayer('logo.png', 'logo.png');
  await processLogoLayer('recallrogue.png', 'recallrogue.png');
  await processLogoLayer('bramblegategames.png', 'bramblegategames.png');

  // Cave rings (1536×2752 → 1024×1835, # removed from name)
  console.log('\nCave rings:');
  await processCaveRing('cave_ring_#1.png', 'cave_ring_1.png');
  await processCaveRing('cave_ring_#2.png', 'cave_ring_2.png');
  await processCaveRing('cave_ring_#3.png', 'cave_ring_3.png');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
