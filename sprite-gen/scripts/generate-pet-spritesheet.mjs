/**
 * generate-pet-spritesheet.mjs — Generate pet animation spritesheets via OpenRouter Gemini
 *
 * Calls the OpenRouter image generation API to produce a horizontal spritesheet
 * for a given pet species and behavior. Removes the green-screen background,
 * splits into individual frames, bottom-aligns each frame consistently, then
 * assembles the final spritesheet.
 *
 * Usage:
 *   node sprite-gen/scripts/generate-pet-spritesheet.mjs --species cat --behavior walk
 *   node sprite-gen/scripts/generate-pet-spritesheet.mjs --species cat --behavior idle --frames 6
 *   node sprite-gen/scripts/generate-pet-spritesheet.mjs --species cat --behavior walk --skip-generate
 *   node sprite-gen/scripts/generate-pet-spritesheet.mjs --species cat --behavior walk --prompt-override "..."
 *
 * Environment:
 *   OPENROUTER_API_KEY — required, loaded from .env at project root
 *
 * Outputs:
 *   sprite-gen/output/pets/{species}_{behavior}_raw.png   — raw API image
 *   public/assets/camp/pets/{species}/{behavior}.png      — final spritesheet (PNG)
 *   public/assets/camp/pets/{species}/{behavior}.webp     — final spritesheet (WebP)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
/** Gemini 2.5 Flash image model — same as generate-sprites.mjs */
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

/** Anti-text suffix — ALWAYS appended to every prompt. */
const ANTI_TEXT_SUFFIX =
  'No text, no letters, no words, no numbers, no symbols, no writing of any kind. No runes, glyphs, or illegible scrawl.';

/** Bottom padding in px applied when placing frame content. */
const BOTTOM_PADDING = 2;

// ---------------------------------------------------------------------------
// Dependency check
// ---------------------------------------------------------------------------

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(
    '\n[ERROR] "sharp" is not installed.\n' +
      '  Run:  npm install sharp\n' +
      '  Then re-run this script.\n'
  );
  process.exit(1);
}

let dotenv;
try {
  dotenv = await import('dotenv');
} catch {
  console.error(
    '\n[ERROR] "dotenv" is not installed.\n' +
      '  Run:  npm install dotenv\n' +
      '  Then re-run this script.\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    species:           { type: 'string' },
    behavior:          { type: 'string' },
    frames:            { type: 'string', default: '8' },
    'frame-size':      { type: 'string', default: '64' },
    'skip-generate':   { type: 'boolean', default: false },
    'prompt-override': { type: 'string' },
    help:              { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.help) {
  console.log(`
Usage: node sprite-gen/scripts/generate-pet-spritesheet.mjs [options]

Required:
  --species <name>          Pet species (e.g. "cat", "owl")
  --behavior <name>         Animation behavior (e.g. "walk", "idle", "sit")

Optional:
  --frames <n>              Number of animation frames (default: 8)
  --frame-size <px>         Pixel size of each square frame cell (default: 64)
  --skip-generate           Skip API call; reprocess existing raw image from sprite-gen/output/pets/
  --prompt-override <text>  Custom prompt (overrides the default prompt)
  -h, --help                Show this help
`);
  process.exit(0);
}

if (!args.species) {
  console.error('[ERROR] --species is required. Use --help for usage.');
  process.exit(1);
}

if (!args.behavior) {
  console.error('[ERROR] --behavior is required. Use --help for usage.');
  process.exit(1);
}

const SPECIES    = args.species.toLowerCase();
const BEHAVIOR   = args.behavior.toLowerCase();
const FRAME_COUNT = parseInt(args.frames, 10);
const FRAME_SIZE  = parseInt(args['frame-size'], 10);

if (Number.isNaN(FRAME_COUNT) || FRAME_COUNT < 1) {
  console.error('[ERROR] --frames must be a positive integer.');
  process.exit(1);
}

if (Number.isNaN(FRAME_SIZE) || FRAME_SIZE < 16) {
  console.error('[ERROR] --frame-size must be a positive integer >= 16.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const ENV_PATH = join(PROJECT_ROOT, '.env');
dotenv.config({ path: ENV_PATH });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY && !args['skip-generate']) {
  console.error('[ERROR] OPENROUTER_API_KEY not found. Add it to .env at the project root.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Raw output directory for intermediate images. */
const RAW_DIR = join(PROJECT_ROOT, 'sprite-gen/output/pets');
const RAW_PATH = join(RAW_DIR, `${SPECIES}_${BEHAVIOR}_raw.png`);

/** Final spritesheet output directory. */
const OUT_DIR = join(PROJECT_ROOT, `public/assets/camp/pets/${SPECIES}`);
const OUT_PNG  = join(OUT_DIR, `${BEHAVIOR}.png`);
const OUT_WEBP = join(OUT_DIR, `${BEHAVIOR}.webp`);

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} dirPath - Directory to ensure
 */
async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the default generation prompt for a given species and behavior.
 *
 * The prompt always requests a solid bright green (#00FF00) background —
 * this avoids the checkerboard pattern Gemini outputs for transparency.
 * Green is removed in post-processing.
 *
 * @param {string} species   - Pet species name
 * @param {string} behavior  - Behavior/animation name
 * @param {number} frameCount - Number of frames to request
 * @returns {string} Full prompt including anti-text suffix
 */
function buildDefaultPrompt(species, behavior, frameCount) {
  const speciesDescriptions = {
    cat:          'cute orange tabby cat',
    owl:          'small round brown owl with big eyes',
    fox:          'small orange fox with a white-tipped tail',
    dragon_whelp: 'tiny emerald green baby dragon with small wings',
  };

  const behaviorDescriptions = {
    walk:  `walking, side view facing right, ${frameCount} frames showing a smooth walk cycle, feet always on the same baseline`,
    idle:  `standing and looking around, side view, ${frameCount} frames showing a relaxed idle loop with subtle breathing or head movement`,
    sit:   `sitting upright with a gentle tail flick, ${frameCount} frames showing a calm seated loop`,
    lick:  `grooming itself, ${frameCount} frames showing a self-grooming animation sequence`,
    sleep: `curled up asleep with gentle breathing rise and fall, ${frameCount} frames`,
    react: `startled reaction, ${frameCount} frames showing a quick surprised pose then settling`,
  };

  const speciesDesc = speciesDescriptions[species] ?? `${species}`;
  const behaviorDesc = behaviorDescriptions[behavior]
    ?? `${behavior}, ${frameCount} frames of smooth animation`;

  // Approximate content height leaving room for the cell (roughly 75% of cell)
  const contentHeight = Math.round(FRAME_SIZE * 0.75);

  return (
    `Pixel art spritesheet of a ${speciesDesc} ${behaviorDesc}. ` +
    `${frameCount} frames arranged in a single horizontal row. ` +
    `The ${species} should be approximately ${contentHeight} pixels tall, ` +
    `consistently sized and positioned across all frames. ` +
    `Style: 16-bit retro game pixel art, warm colors, detailed. ` +
    `Solid bright green (#00FF00) background filling the entire image. ` +
    ANTI_TEXT_SUFFIX
  );
}

// ---------------------------------------------------------------------------
// API interaction
// ---------------------------------------------------------------------------

/**
 * Call the OpenRouter API to generate an image from a text prompt.
 * Returns a raw Buffer decoded from the base64 response.
 *
 * Handles both response formats:
 *   - images[0].image_url.url  (data URI)
 *   - content[0].inline_data.data  (raw base64)
 *
 * @param {string} prompt  - Generation prompt
 * @param {string} model   - OpenRouter model ID
 * @returns {Promise<Buffer>} Raw PNG buffer
 */
async function callOpenRouter(prompt, model) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image', 'text'],
    stream: false,
  };

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`API ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Path 1: image_url (data URI)
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (imageUrl) {
    const b64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!b64Match) {
      throw new Error('image_url is not a base64 data URI: ' + imageUrl.slice(0, 80));
    }
    return Buffer.from(b64Match[1], 'base64');
  }

  // Path 2: inline_data
  const inlineB64 =
    data?.choices?.[0]?.message?.content?.[0]?.inline_data?.data ??
    data?.choices?.[0]?.message?.images?.[0]?.b64_json;
  if (inlineB64) {
    return Buffer.from(inlineB64, 'base64');
  }

  throw new Error(
    'No image found in API response. Message keys: ' +
      JSON.stringify(Object.keys(data?.choices?.[0]?.message ?? {}))
  );
}

// ---------------------------------------------------------------------------
// Frame processing
// ---------------------------------------------------------------------------

/**
 * Remove checkerboard transparency pattern commonly output by Gemini.
 *
 * Gemini sometimes outputs a grey/white checkerboard (alternating ~#CCCCCC
 * and ~#FFFFFF pixels) instead of real transparency. This function detects
 * and removes those pixels by scanning for high-brightness, low-saturation
 * pixels that have at least 2 transparent (or also grey/white) 4-connected
 * neighbours.
 *
 * Runs AFTER green-screen removal, BEFORE frame splitting.
 *
 * Algorithm per pixel:
 *   1. Skip if already transparent (alpha < 20)
 *   2. Check brightness: all R, G, B channels > 180
 *   3. Check saturation: max(R,G,B) - min(R,G,B) < 30
 *   4. Count 4-connected neighbours that are transparent (alpha < 20)
 *      OR also grey/white (same brightness + saturation criteria)
 *   5. If at least 2 such neighbours → set alpha to 0
 *
 * @param {Buffer} pngBuffer - Input PNG buffer (post green-screen removal)
 * @returns {Promise<Buffer>} Cleaned PNG buffer with checkerboard removed
 */
async function removeCheckerboard(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const buf = Buffer.from(data); // mutable copy

  /**
   * Return true if the pixel at (x, y) is a grey/white candidate:
   *   - High brightness (R, G, B all > 180)
   *   - Low saturation (max - min < 30)
   *   - Not already transparent
   */
  function isGreyWhite(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const base = (y * width + x) * channels;
    if (buf[base + 3] < 20) return false; // already transparent
    const r = buf[base];
    const g = buf[base + 1];
    const b = buf[base + 2];
    const lo = Math.min(r, g, b);
    const hi = Math.max(r, g, b);
    return hi > 180 && (hi - lo) < 30;
  }

  /**
   * Return true if the pixel at (x, y) is transparent (alpha < 20).
   * Out-of-bounds pixels are treated as transparent.
   */
  function isTransparent(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return true;
    const base = (y * width + x) * channels;
    return buf[base + 3] < 20;
  }

  let removedCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = (y * width + x) * channels;

      // Skip already-transparent pixels
      if (buf[base + 3] < 20) continue;

      const r = buf[base];
      const g = buf[base + 1];
      const b = buf[base + 2];
      const lo = Math.min(r, g, b);
      const hi = Math.max(r, g, b);

      // Must be high-brightness and low-saturation to be a checker candidate
      if (hi <= 180 || (hi - lo) >= 30) continue;

      // Count 4-connected neighbours that are transparent OR grey/white
      let qualifyingNeighbours = 0;
      if (isTransparent(x - 1, y) || isGreyWhite(x - 1, y)) qualifyingNeighbours++;
      if (isTransparent(x + 1, y) || isGreyWhite(x + 1, y)) qualifyingNeighbours++;
      if (isTransparent(x, y - 1) || isGreyWhite(x, y - 1)) qualifyingNeighbours++;
      if (isTransparent(x, y + 1) || isGreyWhite(x, y + 1)) qualifyingNeighbours++;

      if (qualifyingNeighbours >= 2) {
        buf[base + 3] = 0; // fully transparent
        removedCount++;
      }
    }
  }

  console.log('  Checkerboard removal: ' + removedCount + ' pixels cleared');

  return sharp(buf, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

/**
 * Split a cleaned spritesheet into individual frame buffers using row detection
 * and equal-width column division.
 *
 * Strategy:
 *   1. Build a horizontal projection (opaque pixels per row of image)
 *   2. Find content rows by detecting large horizontal gaps
 *   3. Distribute frameCount across detected rows
 *   4. Within each row, divide into equal-width columns
 *   5. Extract each cell
 *
 * This handles all Gemini layouts: single rows, 4×2 grids, scattered sprites.
 * More reliable than blob detection which fails when sprites touch.
 *
 * @param {Buffer} cleanBuffer  - Transparent-background PNG buffer
 * @param {number} frameCount   - Number of frames to extract
 * @returns {Promise<Buffer[]>} Array of per-frame PNG buffers
 */
async function splitIntoFrames(cleanBuffer, frameCount) {
  const meta = await sharp(cleanBuffer).metadata();
  const totalWidth = meta.width;
  const totalHeight = meta.height;

  console.log(`  Source image: ${totalWidth}×${totalHeight}px`);

  // Get raw pixel data
  const { data, info } = await sharp(cleanBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // --- Step 1: Horizontal projection (opaque pixels per row) ---
  const hProj = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 20) count++;
    }
    hProj[y] = count;
  }

  // --- Step 2: Find content rows by detecting horizontal gaps ---
  // A row of the image is "active" if it has > 1% of width opaque pixels
  const activeThreshold = Math.max(5, Math.floor(width * 0.01));
  const contentRows = []; // array of { startY, endY }
  let inRow = false;
  let rowStart = 0;

  for (let y = 0; y < height; y++) {
    if (hProj[y] >= activeThreshold) {
      if (!inRow) {
        rowStart = y;
        inRow = true;
      }
    } else {
      if (inRow) {
        contentRows.push({ startY: rowStart, endY: y - 1 });
        inRow = false;
      }
    }
  }
  if (inRow) {
    contentRows.push({ startY: rowStart, endY: height - 1 });
  }

  // Merge rows that are very close together (< 2% of image height gap)
  const mergeGap = Math.floor(height * 0.02);
  const mergedRows = [];
  for (const row of contentRows) {
    if (mergedRows.length > 0) {
      const prev = mergedRows[mergedRows.length - 1];
      if (row.startY - prev.endY < mergeGap) {
        prev.endY = row.endY; // merge
        continue;
      }
    }
    mergedRows.push({ ...row });
  }

  let numRows = mergedRows.length;
  console.log(`  Detected ${numRows} content row(s) from gap analysis`);

  // --- Grid heuristic: if we detected 1 tall row but it's likely a grid ---
  // If the single content area's aspect ratio is close to what a grid would produce,
  // force-split it into multiple rows
  if (numRows === 1 && frameCount > 1) {
    const contentH = mergedRows[0].endY - mergedRows[0].startY + 1;

    // Find content width for this row
    let hRowMinX = width, hRowMaxX = 0;
    for (let y = mergedRows[0].startY; y <= mergedRows[0].endY; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * channels + 3] > 20) {
          if (x < hRowMinX) hRowMinX = x;
          if (x > hRowMaxX) hRowMaxX = x;
        }
      }
    }
    const contentW = hRowMaxX - hRowMinX + 1;

    // If content area is wider than tall by less than frameCount ratio,
    // it's probably a grid (e.g., 4×2 instead of 8×1)
    const expectedStripRatio = frameCount * 0.6; // 8 frames → expect ratio > 4.8 for a strip
    const actualRatio = contentW / contentH;

    if (actualRatio < expectedStripRatio) {
      // Determine likely grid: try dividing into 2 rows, 3 rows, etc.
      for (let tryRows = 2; tryRows <= 4; tryRows++) {
        if (frameCount % tryRows === 0) {
          const cellH = contentH / tryRows;
          const cellW = contentW / (frameCount / tryRows);
          const cellAspect = cellW / cellH;
          // Side-view sprites are typically 0.5-2.0 aspect ratio
          if (cellAspect > 0.4 && cellAspect < 2.5) {
            console.log(`  Grid heuristic: content ratio ${actualRatio.toFixed(2)} suggests ${frameCount/tryRows}×${tryRows} grid (cell ~${Math.round(cellW)}×${Math.round(cellH)}px)`);
            // Force-split the single row into tryRows rows
            const origRow = mergedRows[0];
            const rowH = Math.floor(contentH / tryRows);
            mergedRows.length = 0;
            for (let r = 0; r < tryRows; r++) {
              mergedRows.push({
                startY: origRow.startY + r * rowH,
                endY: r === tryRows - 1 ? origRow.endY : origRow.startY + (r + 1) * rowH - 1,
              });
            }
            numRows = tryRows;
            break;
          }
        }
      }
    }
  }

  // --- Step 3: Distribute frames across rows ---
  // Use vertical projection within each row to estimate frame count per row
  const rowFrameCounts = [];

  if (numRows === 1) {
    rowFrameCounts.push(frameCount);
  } else {
    // For multi-row layouts, use vertical projection to count frames per row
    for (const row of mergedRows) {
      // Vertical projection for this row
      const vProj = new Uint32Array(width);
      for (let y = row.startY; y <= row.endY; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * channels + 3] > 20) vProj[x]++;
        }
      }

      // Count the number of "peaks" (continuous runs of activity)
      const colThreshold = Math.max(3, Math.floor((row.endY - row.startY + 1) * 0.03));
      let peaks = 0;
      let inPeak = false;
      for (let x = 0; x < width; x++) {
        if (vProj[x] >= colThreshold) {
          if (!inPeak) { peaks++; inPeak = true; }
        } else {
          inPeak = false;
        }
      }
      rowFrameCounts.push(peaks);
    }

    // Adjust to match total frameCount
    const totalDetected = rowFrameCounts.reduce((a, b) => a + b, 0);
    if (totalDetected !== frameCount) {
      console.log(`  Detected ${totalDetected} frames across rows, expected ${frameCount}`);
      // Scale proportionally
      const scale = frameCount / totalDetected;
      let assigned = 0;
      for (let i = 0; i < rowFrameCounts.length - 1; i++) {
        rowFrameCounts[i] = Math.max(1, Math.round(rowFrameCounts[i] * scale));
        assigned += rowFrameCounts[i];
      }
      rowFrameCounts[rowFrameCounts.length - 1] = frameCount - assigned;
    }
  }

  for (let i = 0; i < numRows; i++) {
    const row = mergedRows[i];
    console.log(`  Row ${i}: y=${row.startY}..${row.endY} (${row.endY - row.startY + 1}px tall), ${rowFrameCounts[i]} frames`);
  }

  // --- Step 4: Split each row into frames using vertical projection valleys ---
  const frames = [];

  for (let ri = 0; ri < numRows; ri++) {
    const row = mergedRows[ri];
    const framesInRow = rowFrameCounts[ri];

    // Vertical projection for this row (opaque pixels per column)
    const vProj = new Uint32Array(width);
    for (let y = row.startY; y <= row.endY; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * channels + 3] > 20) vProj[x]++;
      }
    }

    // Find content X bounds for this row
    let rowMinX = width, rowMaxX = 0;
    for (let x = 0; x < width; x++) {
      if (vProj[x] > 0) {
        if (x < rowMinX) rowMinX = x;
        rowMaxX = x;
      }
    }

    const contentWidth = rowMaxX - rowMinX + 1;

    // Find valley positions (low points in the vertical projection)
    // We need (framesInRow - 1) split points
    const splits = framesInRow - 1;

    if (splits === 0) {
      // Single frame in this row — take the whole content
      const frameBuf = await sharp(cleanBuffer)
        .extract({ left: rowMinX, top: row.startY, width: contentWidth, height: row.endY - row.startY + 1 })
        .png()
        .toBuffer();
      frames.push(frameBuf);
    } else {
      // Find the best split points: divide content into roughly equal zones,
      // then within each zone find the column with minimum opaque pixels (valley)
      const zoneWidth = contentWidth / framesInRow;
      const splitXs = [];

      for (let si = 1; si <= splits; si++) {
        // Expected split position
        const expected = rowMinX + Math.round(si * zoneWidth);
        // Search within ±25% of zone width for the best valley
        const searchRadius = Math.floor(zoneWidth * 0.25);
        const searchStart = Math.max(rowMinX + 1, expected - searchRadius);
        const searchEnd = Math.min(rowMaxX - 1, expected + searchRadius);

        let bestX = expected;
        let bestVal = Infinity;
        for (let x = searchStart; x <= searchEnd; x++) {
          // Use a small window (3px) to smooth the projection
          const val = (vProj[x - 1] || 0) + vProj[x] + (vProj[x + 1] || 0);
          if (val < bestVal) {
            bestVal = val;
            bestX = x;
          }
        }
        splitXs.push(bestX);
      }

      // Build frame boundaries
      const boundaries = [rowMinX, ...splitXs, rowMaxX + 1];
      for (let ci = 0; ci < framesInRow; ci++) {
        const left = boundaries[ci];
        const right = boundaries[ci + 1];
        const cellW = right - left;
        const cellH = row.endY - row.startY + 1;

        if (cellW > 0 && cellH > 0) {
          const frameBuf = await sharp(cleanBuffer)
            .extract({ left, top: row.startY, width: cellW, height: cellH })
            .png()
            .toBuffer();
          frames.push(frameBuf);
        }
      }
    }
  }

  console.log(`  Split complete — ${frames.length} frames extracted`);
  return frames;
}

/**
 * Find the bounding box of non-transparent pixels in a frame buffer.
 * Returns null if the frame is entirely transparent.
 *
 * @param {Buffer} frameBuffer - PNG frame buffer with alpha channel
 * @returns {Promise<{minX: number, minY: number, maxX: number, maxY: number,
 *   contentWidth: number, contentHeight: number} | null>}
 */
async function findContentBounds(frameBuffer) {
  const { data, info } = await sharp(frameBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIdx = (y * width + x) * channels + 3;
      if (data[alphaIdx] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) return null; // Fully transparent

  return {
    minX,
    minY,
    maxX,
    maxY,
    contentWidth:  maxX - minX + 1,
    contentHeight: maxY - minY + 1,
  };
}

/**
 * Center a single frame's content onto a square cell canvas.
 *
 * Layout rules:
 *   - Horizontally centered in the cell
 *   - Bottom-aligned with BOTTOM_PADDING gap from the cell bottom
 *     (so feet stay on the same baseline regardless of frame height variation)
 *
 * @param {Buffer} frameBuffer  - Raw extracted frame PNG
 * @param {object} bounds       - Bounding box from findContentBounds
 * @param {number} cellSize     - Output cell size in pixels (square)
 * @returns {Promise<Buffer>}   - Transparent cellSize×cellSize PNG
 */
async function centerFrameOnCell(frameBuffer, bounds, cellSize) {
  const { minX, minY, contentWidth, contentHeight } = bounds;

  // Extract just the content region from the source frame
  let contentBuf = await sharp(frameBuffer)
    .extract({ left: minX, top: minY, width: contentWidth, height: contentHeight })
    .png()
    .toBuffer();

  // If content is larger than the cell, scale it down to fit (preserving aspect ratio)
  const maxFit = cellSize - BOTTOM_PADDING;
  let finalWidth = contentWidth;
  let finalHeight = contentHeight;

  if (contentWidth > maxFit || contentHeight > maxFit) {
    const scale = Math.min(maxFit / contentWidth, maxFit / contentHeight);
    finalWidth = Math.round(contentWidth * scale);
    finalHeight = Math.round(contentHeight * scale);
    contentBuf = await sharp(contentBuf)
      .resize(finalWidth, finalHeight, { kernel: sharp.kernel.nearest, fit: 'fill' })
      .png()
      .toBuffer();
  }

  // Calculate placement: horizontally centered, bottom-aligned
  const placeX = Math.round((cellSize - finalWidth) / 2);
  const placeY = cellSize - finalHeight - BOTTOM_PADDING;

  const safeX = Math.max(0, placeX);
  const safeY = Math.max(0, placeY);

  // Create transparent cell canvas and composite the content onto it
  const cellBuf = await sharp({
    create: {
      width:      cellSize,
      height:     cellSize,
      channels:   4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: contentBuf, left: safeX, top: safeY }])
    .png()
    .toBuffer();

  return cellBuf;
}

/**
 * Assemble an array of cellSize×cellSize frame buffers into a horizontal spritesheet.
 *
 * @param {Buffer[]} frameCells  - Ordered array of square frame buffers
 * @param {number} cellSize      - Size of each cell in pixels
 * @returns {Promise<Buffer>}    - Final PNG spritesheet buffer
 */
async function assembleHorizontalStrip(frameCells, cellSize) {
  const totalWidth  = cellSize * frameCells.length;
  const totalHeight = cellSize;

  const composites = frameCells.map((buf, i) => ({
    input: buf,
    left:  i * cellSize,
    top:   0,
  }));

  return sharp({
    create: {
      width:      totalWidth,
      height:     totalHeight,
      channels:   4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n[PET SPRITESHEET] ${SPECIES} / ${BEHAVIOR} — ${FRAME_COUNT} frames @ ${FRAME_SIZE}px\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Get raw image (generate or load existing)
  // -------------------------------------------------------------------------

  let rawBuffer;

  if (args['skip-generate']) {
    // Reprocess an existing raw image
    if (!existsSync(RAW_PATH)) {
      console.error(`[ERROR] --skip-generate was set but no raw image found at:\n  ${RAW_PATH}`);
      process.exit(1);
    }
    console.log(`[SKIP] Loading existing raw image: ${RAW_PATH}`);
    rawBuffer = await readFile(RAW_PATH);
  } else {
    // Build the prompt
    const prompt = args['prompt-override']
      ? args['prompt-override'] + ' ' + ANTI_TEXT_SUFFIX
      : buildDefaultPrompt(SPECIES, BEHAVIOR, FRAME_COUNT);

    console.log('[PROMPT]', prompt);
    console.log('\n[GENERATE] Calling OpenRouter API...');
    const startMs = Date.now();

    rawBuffer = await callOpenRouter(prompt, DEFAULT_MODEL);

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`  API call complete (${elapsed}s) — ${rawBuffer.length} bytes received`);

    // Save raw image for inspection / reprocessing
    await ensureDir(RAW_DIR);
    await writeFile(RAW_PATH, rawBuffer);
    console.log(`  Raw image saved: ${RAW_PATH}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Green-screen removal
  // -------------------------------------------------------------------------

  console.log('\n[PROCESS] Removing green-screen background...');

  // Import the shared green-screen library
  const { removeGreenScreen } = await import('../lib/green-screen.mjs');
  const cleanBuffer = await removeGreenScreen(rawBuffer, { tolerance: 80, despillStrength: 0.5 });
  console.log(`  Background removed — clean image: ${cleanBuffer.length} bytes`);

  // -------------------------------------------------------------------------
  // Phase 2b: Remove checkerboard artifacts
  // -------------------------------------------------------------------------

  console.log('\n[PROCESS] Removing checkerboard pattern...');
  const deCheckedBuffer = await removeCheckerboard(cleanBuffer);
  console.log(`  Checkerboard step complete — ${deCheckedBuffer.length} bytes`);

  // -------------------------------------------------------------------------
  // Phase 3: Split into frames
  // -------------------------------------------------------------------------

  console.log(`\n[SPLIT] Dividing into ${FRAME_COUNT} frames...`);
  const rawFrames = await splitIntoFrames(deCheckedBuffer, FRAME_COUNT);
  console.log(`  Split complete — ${rawFrames.length} frames extracted`);

  // -------------------------------------------------------------------------
  // Phase 4: Find bounds for each frame
  // -------------------------------------------------------------------------

  console.log('\n[BOUNDS] Finding content bounds per frame...');
  const boundsList = [];
  let maxContentWidth  = 0;
  let maxContentHeight = 0;

  for (let i = 0; i < rawFrames.length; i++) {
    const bounds = await findContentBounds(rawFrames[i]);
    if (bounds === null) {
      console.warn(`  Frame ${i}: fully transparent — using placeholder bounds`);
      boundsList.push({
        minX: 0, minY: 0, maxX: 0, maxY: 0,
        contentWidth: 1, contentHeight: 1,
      });
    } else {
      console.log(`  Frame ${i}: ${bounds.contentWidth}×${bounds.contentHeight}px content`);
      boundsList.push(bounds);
      if (bounds.contentWidth  > maxContentWidth)  maxContentWidth  = bounds.contentWidth;
      if (bounds.contentHeight > maxContentHeight) maxContentHeight = bounds.contentHeight;
    }
  }

  console.log(`  Max content size across frames: ${maxContentWidth}×${maxContentHeight}px`);

  // Warn if content is too large for the cell
  if (maxContentHeight > FRAME_SIZE - BOTTOM_PADDING) {
    console.warn(
      `  [WARN] Content height (${maxContentHeight}px) exceeds cell size (${FRAME_SIZE}px) ` +
      `with bottom padding (${BOTTOM_PADDING}px). Frames will be clipped.`
    );
  }

  // -------------------------------------------------------------------------
  // Phase 5: Center each frame on its cell
  // -------------------------------------------------------------------------

  console.log(`\n[CENTER] Placing frames on ${FRAME_SIZE}×${FRAME_SIZE}px cells (bottom-aligned)...`);
  const cellFrames = [];

  for (let i = 0; i < rawFrames.length; i++) {
    const cell = await centerFrameOnCell(rawFrames[i], boundsList[i], FRAME_SIZE);
    cellFrames.push(cell);
    process.stdout.write(`.`);
  }
  console.log(' done');

  // -------------------------------------------------------------------------
  // Phase 6: Assemble spritesheet
  // -------------------------------------------------------------------------

  const stripWidth = FRAME_SIZE * FRAME_COUNT;
  console.log(`\n[ASSEMBLE] Building ${stripWidth}×${FRAME_SIZE}px spritesheet...`);
  const sheetBuffer = await assembleHorizontalStrip(cellFrames, FRAME_SIZE);
  console.log(`  Spritesheet assembled — ${sheetBuffer.length} bytes`);

  // -------------------------------------------------------------------------
  // Phase 7: Output PNG and WebP
  // -------------------------------------------------------------------------

  console.log('\n[OUTPUT] Writing final files...');
  await ensureDir(OUT_DIR);

  // PNG
  await writeFile(OUT_PNG, sheetBuffer);
  console.log(`  PNG:  ${OUT_PNG}`);

  // WebP — re-encode from the assembled PNG for best quality
  const webpBuffer = await sharp(sheetBuffer)
    .webp({ quality: 90, effort: 6 })
    .toBuffer();
  await writeFile(OUT_WEBP, webpBuffer);
  console.log(`  WebP: ${OUT_WEBP}`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  console.log('\n[DONE] Spritesheet generation complete.');
  console.log(`  Species:    ${SPECIES}`);
  console.log(`  Behavior:   ${BEHAVIOR}`);
  console.log(`  Frames:     ${FRAME_COUNT}`);
  console.log(`  Frame size: ${FRAME_SIZE}×${FRAME_SIZE}px`);
  console.log(`  Sheet size: ${stripWidth}×${FRAME_SIZE}px`);
  console.log(`  Max content:${maxContentWidth}×${maxContentHeight}px`);
  console.log(`  PNG size:   ${(sheetBuffer.length / 1024).toFixed(1)}KB`);
  console.log(`  WebP size:  ${(webpBuffer.length / 1024).toFixed(1)}KB`);
}

main().catch((err) => {
  console.error('\n[FATAL]', err.message);
  console.error(err.stack);
  process.exit(1);
});
