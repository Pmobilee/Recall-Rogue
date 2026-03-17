/**
 * preprocess-reward-room.mjs
 *
 * One-time preprocessing script for Reward Room assets.
 * Processes source images from data/generated/reward_room/ and outputs
 * game-ready files to public/assets/reward_room/.
 *
 * Run: node scripts/preprocess-reward-room.mjs
 */

import sharp from 'sharp';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

const SRC = resolve(ROOT, 'data/generated/reward_room');
const OUT = resolve(ROOT, 'public/assets/reward_room');

// Gold tier config: target widths and gold ranges
const GOLD_TIERS = [
  { tier: 0, width: 48,  minGold: 1,   maxGold: 10  },
  { tier: 1, width: 56,  minGold: 11,  maxGold: 30  },
  { tier: 2, width: 64,  minGold: 31,  maxGold: 60  },
  { tier: 3, width: 80,  minGold: 61,  maxGold: 100 },
  { tier: 4, width: 96,  minGold: 101, maxGold: 200 },
  { tier: 5, width: 112, minGold: 201, maxGold: null },
];

// Tracking output file info for summary table
const outputSummary = [];

// ---------------------------------------------------------------------------
// Utility: get image dimensions after processing
// ---------------------------------------------------------------------------
async function getDimensions(filePath) {
  const meta = await sharp(filePath).metadata();
  return { width: meta.width, height: meta.height };
}

// ---------------------------------------------------------------------------
// Convex Hull: Andrew's Monotone Chain algorithm
// ---------------------------------------------------------------------------

/**
 * Compute the 2D convex hull of a set of points.
 * Returns points in counter-clockwise order.
 * @param {{ x: number, y: number }[]} points
 * @returns {{ x: number, y: number }[]}
 */
function convexHull(points) {
  if (points.length < 3) return points;

  // Sort by x, then y
  const sorted = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point from each half (it's the same as the first of the other)
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

// ---------------------------------------------------------------------------
// Step 1A: Slice & crop gold sprite sheet
// ---------------------------------------------------------------------------
async function processGoldSheet() {
  console.log('\n[1A] Processing gold sprite sheet...');

  const srcPath = resolve(SRC, 'Gold-sheet.png');
  const meta = await sharp(srcPath).metadata();
  const sheetW = meta.width;
  const sheetH = meta.height;

  const cols = 3;
  const rows = 2;
  const cellW = Math.floor(sheetW / cols);
  const cellH = Math.floor(sheetH / rows);

  console.log(`     Sheet: ${sheetW}×${sheetH}, cell: ${cellW}×${cellH}`);

  const tierMeta = [];

  for (let i = 0; i < GOLD_TIERS.length; i++) {
    const tierCfg = GOLD_TIERS[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const left = col * cellW;
    const top = row * cellH;

    const outPath = resolve(OUT, `gold_tier_${tierCfg.tier}.png`);

    // Extract cell
    let pipeline = sharp(srcPath).extract({ left, top, width: cellW, height: cellH });

    // Attempt trim (remove transparent padding)
    try {
      pipeline = pipeline.trim();
    } catch {
      console.warn(`     Tier ${tierCfg.tier}: trim not supported, skipping`);
    }

    // Resize to target width using nearest-neighbor, maintain aspect ratio
    pipeline = pipeline.resize(tierCfg.width, null, { kernel: sharp.kernel.nearest });

    // Try to process; if trim fails at runtime, fall back without trim
    let finalBuffer;
    try {
      finalBuffer = await pipeline.toBuffer();
    } catch (err) {
      console.warn(`     Tier ${tierCfg.tier}: trim failed (${err.message}), retrying without trim`);
      finalBuffer = await sharp(srcPath)
        .extract({ left, top, width: cellW, height: cellH })
        .resize(tierCfg.width, null, { kernel: sharp.kernel.nearest })
        .toBuffer();
    }

    await sharp(finalBuffer).toFile(outPath);

    const dims = await getDimensions(outPath);
    console.log(`     Tier ${tierCfg.tier}: ${dims.width}×${dims.height} → gold_tier_${tierCfg.tier}.png`);

    outputSummary.push({ file: `gold_tier_${tierCfg.tier}.png`, ...dims });
    tierMeta.push({
      tier: tierCfg.tier,
      file: `gold_tier_${tierCfg.tier}.png`,
      width: dims.width,
      height: dims.height,
      minGold: tierCfg.minGold,
      maxGold: tierCfg.maxGold,
    });
  }

  // Write gold_tiers.json
  const jsonPath = resolve(OUT, 'gold_tiers.json');
  await writeFile(jsonPath, JSON.stringify({ tiers: tierMeta }, null, 2));
  console.log(`     Wrote gold_tiers.json`);
}

// ---------------------------------------------------------------------------
// Step 1B: Compute cloth spawn zone
// ---------------------------------------------------------------------------
async function processClothZone() {
  console.log('\n[1B] Computing cloth spawn zone...');

  const srcPath = resolve(SRC, 'Cloth Area.png');
  const meta = await sharp(srcPath).metadata();
  const imgW = meta.width;
  const imgH = meta.height;

  // Get raw RGBA pixel data
  const { data } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const BRIGHTNESS_THRESHOLD = 240;
  const HULL_SAMPLE_STEP = 50;
  const GRID_STEP = 12;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const hullSamplePoints = [];
  const spawnGrid = [];

  // Single pass: compute bounding box and collect hull sample points
  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      const idx = (y * imgW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;

      if (brightness < BRIGHTNESS_THRESHOLD) {
        // Cloth pixel
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;

        // Sample every HULL_SAMPLE_STEP pixels for hull computation
        if (x % HULL_SAMPLE_STEP === 0 && y % HULL_SAMPLE_STEP === 0) {
          hullSamplePoints.push({ x, y });
        }
      }
    }
  }

  if (minX === Infinity) {
    throw new Error('Cloth zone: no cloth pixels found — check brightness threshold');
  }

  console.log(`     Bounds: (${minX},${minY}) → (${maxX},${maxY})`);

  // Compute convex hull
  const hull = convexHull(hullSamplePoints);
  console.log(`     Hull: ${hull.length} points (from ${hullSamplePoints.length} samples)`);

  // Build spawn grid — sample every GRID_STEP px within bounding box, keep cloth pixels
  for (let y = minY; y <= maxY; y += GRID_STEP) {
    for (let x = minX; x <= maxX; x += GRID_STEP) {
      const idx = (y * imgW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;

      if (brightness < BRIGHTNESS_THRESHOLD) {
        spawnGrid.push({ x, y });
      }
    }
  }

  console.log(`     Spawn grid: ${spawnGrid.length} points`);

  const zoneData = {
    bounds: { minX, minY, maxX, maxY },
    polygon: hull,
    spawnGrid,
    maskWidth: imgW,
    maskHeight: imgH,
  };

  const jsonPath = resolve(OUT, 'cloth_spawn_zone.json');
  await writeFile(jsonPath, JSON.stringify(zoneData, null, 2));
  console.log(`     Wrote cloth_spawn_zone.json`);

  return { spawnGridCount: spawnGrid.length };
}

// ---------------------------------------------------------------------------
// Step 1C: Trim & resize health vials
// ---------------------------------------------------------------------------
async function processHealthVials() {
  console.log('\n[1C] Processing health vials...');

  const vials = [
    { src: 'small health vial.png',   out: 'health_vial_small.png', targetWidth: 56 },
    { src: 'larger health flash.png', out: 'health_vial_large.png', targetWidth: 64 },
  ];

  for (const vial of vials) {
    const srcPath = resolve(SRC, vial.src);
    const outPath = resolve(OUT, vial.out);

    let finalBuffer;
    try {
      finalBuffer = await sharp(srcPath)
        .trim()
        .resize(vial.targetWidth, null, { kernel: sharp.kernel.nearest })
        .toBuffer();
    } catch (err) {
      console.warn(`     "${vial.src}": trim failed (${err.message}), retrying without trim`);
      finalBuffer = await sharp(srcPath)
        .resize(vial.targetWidth, null, { kernel: sharp.kernel.nearest })
        .toBuffer();
    }

    await sharp(finalBuffer).toFile(outPath);

    const dims = await getDimensions(outPath);
    console.log(`     ${vial.out}: ${dims.width}×${dims.height}`);
    outputSummary.push({ file: vial.out, ...dims });
  }
}

// ---------------------------------------------------------------------------
// Step 1D: Background conversion
// ---------------------------------------------------------------------------
async function processBackground() {
  console.log('\n[1D] Processing background...');

  const srcPath = resolve(SRC, 'Reward_room_Background.png');

  // Convert to WebP
  const webpPath = resolve(OUT, 'reward_room_bg.webp');
  await sharp(srcPath).webp({ quality: 90 }).toFile(webpPath);
  const webpDims = await getDimensions(webpPath);
  console.log(`     reward_room_bg.webp: ${webpDims.width}×${webpDims.height}`);
  outputSummary.push({ file: 'reward_room_bg.webp', ...webpDims });

  // PNG fallback copy
  const pngPath = resolve(OUT, 'reward_room_bg.png');
  await copyFile(srcPath, pngPath);
  const pngDims = await getDimensions(pngPath);
  console.log(`     reward_room_bg.png: ${pngDims.width}×${pngDims.height}`);
  outputSummary.push({ file: 'reward_room_bg.png', ...pngDims });
}

// ---------------------------------------------------------------------------
// Step 1E: Validation & summary
// ---------------------------------------------------------------------------
function printSummary(spawnGridCount) {
  console.log('\n[1E] Validation & Summary');
  console.log('─'.repeat(52));
  console.log(`${'File'.padEnd(36)} ${'Width'.padStart(6)} ${'Height'.padStart(7)}`);
  console.log('─'.repeat(52));

  let allValid = true;

  for (const entry of outputSummary) {
    const wStr = entry.width != null ? String(entry.width) : '?';
    const hStr = entry.height != null ? String(entry.height) : '?';
    console.log(`${entry.file.padEnd(36)} ${wStr.padStart(6)} ${hStr.padStart(7)}`);

    if (!entry.width || !entry.height) {
      console.warn(`  ⚠ WARNING: ${entry.file} has zero or missing dimensions`);
      allValid = false;
    }
  }

  console.log('─'.repeat(52));
  console.log(`\nSpawn grid points: ${spawnGridCount}`);

  if (spawnGridCount === 0) {
    console.error('ERROR: Cloth spawn zone is empty — cloth detection may have failed');
    allValid = false;
  } else if (spawnGridCount < 10) {
    console.warn('WARNING: Very few spawn grid points — cloth zone may be too small');
  }

  if (allValid) {
    console.log('\nAll output files validated successfully.');
  } else {
    console.error('\nSome validations failed — review warnings above.');
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Reward Room Asset Preprocessor');
  console.log('================================');
  console.log(`Source : ${SRC}`);
  console.log(`Output : ${OUT}`);

  // Ensure output directory exists
  await mkdir(OUT, { recursive: true });

  await processGoldSheet();
  const { spawnGridCount } = await processClothZone();
  await processHealthVials();
  await processBackground();
  printSummary(spawnGridCount);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
