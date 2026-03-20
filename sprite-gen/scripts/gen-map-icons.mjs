/**
 * gen-map-icons.mjs — Generate 7 map node icons via OpenRouter image model
 *
 * Generates pixel-art icons for each dungeon map node type, removes the
 * green-screen background using Sharp, and saves 128x128 WebP files.
 *
 * Usage:
 *   node sprite-gen/scripts/gen-map-icons.mjs             # Generate all missing icons
 *   node sprite-gen/scripts/gen-map-icons.mjs --dry-run   # Preview without calling API
 *   node sprite-gen/scripts/gen-map-icons.mjs --force     # Regenerate all, even existing
 *   node sprite-gen/scripts/gen-map-icons.mjs --icon combat  # Generate a single icon
 *
 * Environment:
 *   OPENROUTER_API_KEY — required, loaded from .env at project root
 *
 * Dependencies:
 *   sharp, dotenv (already installed)
 */

import { writeFile, mkdir } from 'node:fs/promises';
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
const ENV_PATH = join(PROJECT_ROOT, '.env');
const OUTPUT_DIR = join(PROJECT_ROOT, 'public/assets/sprites/map-icons');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-image';

/** Max API requests per minute */
const RATE_LIMIT_RPM = 10;
/** Minimum delay between requests in ms */
const MIN_REQUEST_INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_RPM);
/** Max retry attempts per icon */
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms) */
const BACKOFF_BASE_MS = 2_000;

/** Target output size in pixels */
const ICON_SIZE = 128;

// ---------------------------------------------------------------------------
// Icon definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {{ key: string, description: string }} IconDef
 */

/** @type {IconDef[]} */
const ICONS = [
  { key: 'combat',   description: 'pair of crossed medieval swords' },
  { key: 'elite',    description: 'menacing skull with glowing purple eyes' },
  { key: 'boss',     description: 'golden royal crown with red jewels' },
  { key: 'mystery',  description: 'glowing purple question mark with sparkles' },
  { key: 'rest',     description: 'glowing red heart' },
  { key: 'treasure', description: 'ornate golden treasure chest overflowing with gems' },
  { key: 'shop',     description: 'leather coin pouch with gold coins spilling out' },
];

/**
 * Build the generation prompt for an icon.
 * @param {string} description
 * @returns {string}
 */
function buildPrompt(description) {
  return (
    `A ${description}, cel-shaded 2D pixel art icon, bold black outlines, ` +
    `flat color shading with 2-3 tones per color, no gradients, no anti-aliasing, ` +
    `high contrast, vibrant saturated colors, clean crisp edges, top-left lighting, ` +
    `retro 16-bit game style, visible chunky pixels, flat front-facing view, game UI icon, ` +
    `centered in frame, solid bright green (#00FF00) background, 128x128 pixels`
  );
}

// ---------------------------------------------------------------------------
// Dependency loading
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
    'dry-run': { type: 'boolean', default: false },
    force:     { type: 'boolean', default: false },
    icon:      { type: 'string' },
    help:      { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.help) {
  console.log(`
Usage: node sprite-gen/scripts/gen-map-icons.mjs [options]

Options:
  --dry-run        Preview what would be generated without calling the API
  --force          Regenerate even if the output file already exists
  --icon <key>     Generate only the named icon (e.g. --icon combat)
  -h, --help       Show this help message

Available icon keys: ${ICONS.map((i) => i.key).join(', ')}
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

dotenv.config({ path: ENV_PATH });
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY && !args['dry-run']) {
  console.error('[ERROR] OPENROUTER_API_KEY not found. Add it to .env at the project root.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// API interaction
// ---------------------------------------------------------------------------

/**
 * Call the OpenRouter API and return the raw image as a Buffer.
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
async function callOpenRouter(prompt) {
  const body = {
    model: MODEL,
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

  // Navigate response to find base64 image (handles multiple response shapes)
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    const inlineB64 =
      data?.choices?.[0]?.message?.content?.[0]?.inline_data?.data ??
      data?.choices?.[0]?.message?.images?.[0]?.b64_json;
    if (inlineB64) return Buffer.from(inlineB64, 'base64');
    throw new Error(
      'No image in response. Keys: ' +
        JSON.stringify(Object.keys(data?.choices?.[0]?.message ?? {}))
    );
  }

  const b64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!b64Match) {
    throw new Error('Image URL is not a base64 data URI.');
  }
  return Buffer.from(b64Match[1], 'base64');
}

/**
 * Call the API with retry + exponential backoff.
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
async function callWithRetry(prompt) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callOpenRouter(prompt);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(`    Retry ${attempt + 1}/${MAX_RETRIES - 1} in ${(delay / 1000).toFixed(1)}s — ${err.message}`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Green screen removal
// ---------------------------------------------------------------------------

/**
 * Remove green-screen background and resize to 128×128 WebP.
 *
 * Algorithm:
 *   1. Decode to raw RGBA pixels
 *   2. Sample corner pixels to detect the actual green-screen color
 *   3. For each pixel, compute color distance to detected green
 *   4. Within hard tolerance (50) → fully transparent
 *   5. Edge zone (50–80) → alpha blending
 *   6. Auto-crop to content bounds with 4px padding
 *   7. Resize to 128×128 (nearest-neighbour to preserve pixel art crispness)
 *   8. Encode as WebP (quality 90)
 *
 * @param {Buffer} rawBuffer  Raw image from API
 * @returns {Promise<Buffer>}  128×128 WebP with transparent background
 */
async function processImage(rawBuffer) {
  const image = sharp(rawBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // channels === 4 (RGBA)

  // --- Step 1: Sample corners to detect green-screen color ---
  const cornerOffsets = [
    0,                                                        // top-left
    (width - 1) * channels,                                  // top-right
    (height - 1) * width * channels,                         // bottom-left
    ((height - 1) * width + (width - 1)) * channels,         // bottom-right
  ];

  let gr = 0, gg = 0, gb = 0, count = 0;
  for (const off of cornerOffsets) {
    const r = data[off], g = data[off + 1], b = data[off + 2];
    if (g > r && g > b && g > 50) {
      gr += r; gg += g; gb += b;
      count++;
    }
  }

  // Fallback to classic chroma green if corners are not greenish
  if (count === 0) {
    gr = 0; gg = 255; gb = 0;
  } else {
    gr = Math.round(gr / count);
    gg = Math.round(gg / count);
    gb = Math.round(gb / count);
  }

  // --- Step 2: Thresholds ---
  const HARD_TOLERANCE = 50;  // fully transparent
  const EDGE_TOLERANCE = 80;  // blended alpha zone

  // --- Step 3: Process each pixel ---
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - gr) ** 2 + (g - gg) ** 2 + (b - gb) ** 2);

    if (dist < HARD_TOLERANCE) {
      data[i + 3] = 0;
    } else if (dist < EDGE_TOLERANCE) {
      const alpha = Math.round(
        ((dist - HARD_TOLERANCE) / (EDGE_TOLERANCE - HARD_TOLERANCE)) * 255
      );
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
    // else: keep original alpha
  }

  // --- Step 4: Auto-crop to content bounds ---
  let minX = width, minY = height, maxX = 0, maxY = 0;
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

  // If nothing visible found, use full image
  if (minX > maxX || minY > maxY) {
    minX = 0; minY = 0; maxX = width - 1; maxY = height - 1;
  }

  // 4px padding
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // --- Step 5: Crop, resize, encode as WebP ---
  return sharp(data, { raw: { width, height, channels } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .resize(ICON_SIZE, ICON_SIZE, {
      kernel: sharp.kernel.nearest,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Format elapsed time as a seconds string.
 * @param {number} startMs
 * @param {number} endMs
 * @returns {string}
 */
function elapsed(startMs, endMs) {
  return ((endMs - startMs) / 1000).toFixed(1) + 's';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Resolve the icons to process
  let toProcess = ICONS;

  if (args.icon) {
    toProcess = ICONS.filter((i) => i.key === args.icon);
    if (toProcess.length === 0) {
      console.error(
        `[ERROR] Unknown icon key "${args.icon}". ` +
        `Valid keys: ${ICONS.map((i) => i.key).join(', ')}`
      );
      process.exit(1);
    }
  }

  // Skip existing unless --force
  if (!args.force) {
    const before = toProcess.length;
    toProcess = toProcess.filter((icon) => {
      const outPath = join(OUTPUT_DIR, `${icon.key}.webp`);
      return !existsSync(outPath);
    });
    const skipped = before - toProcess.length;
    if (skipped > 0) {
      console.log(`[INFO] Skipping ${skipped} already-generated icon(s). Use --force to regenerate.`);
    }
  }

  if (toProcess.length === 0) {
    console.log('[INFO] All icons already exist. Nothing to do.');
    process.exit(0);
  }

  // Dry-run
  if (args['dry-run']) {
    console.log(`\n[DRY RUN] Would generate ${toProcess.length} icon(s):\n`);
    for (const icon of toProcess) {
      const prompt = buildPrompt(icon.description);
      const outPath = join(OUTPUT_DIR, `${icon.key}.webp`);
      console.log(`  ${icon.key}`);
      console.log(`    Output : ${outPath}`);
      console.log(`    Prompt : ${prompt.slice(0, 100)}...`);
    }
    console.log(`\nTotal: ${toProcess.length} icon(s). Remove --dry-run to execute.`);
    process.exit(0);
  }

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`[INFO] Created output directory: ${OUTPUT_DIR}`);
  }

  console.log(`\n[START] Generating ${toProcess.length} map icon(s) → ${OUTPUT_DIR}\n`);

  const failures = [];
  let lastRequestTime = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const icon = toProcess[i];
    const tag = `[${i + 1}/${toProcess.length}]`;
    const outPath = join(OUTPUT_DIR, `${icon.key}.webp`);
    const prompt = buildPrompt(icon.description);

    process.stdout.write(`${tag} ${icon.key} (${icon.description})... `);
    const startTime = Date.now();

    // Rate limiting
    const timeSinceLast = Date.now() - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
      const waitMs = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
      process.stdout.write(`(rate limit: waiting ${(waitMs / 1000).toFixed(1)}s) `);
      await sleep(waitMs);
    }

    try {
      // 1. Call API
      lastRequestTime = Date.now();
      const rawBuffer = await callWithRetry(prompt);

      // 2. Remove green screen + resize + encode
      const webpBuffer = await processImage(rawBuffer);

      // 3. Save
      await writeFile(outPath, webpBuffer);

      const elapsedStr = elapsed(startTime, Date.now());
      const kb = (webpBuffer.length / 1024).toFixed(1);
      console.log(`done (${elapsedStr}, ${kb} KB) → ${icon.key}.webp`);
    } catch (err) {
      const elapsedStr = elapsed(startTime, Date.now());
      console.log(`FAILED (${elapsedStr})`);
      console.error(`    Error: ${err.message}`);
      failures.push({ key: icon.key, error: err.message });
    }
  }

  // Summary
  const successCount = toProcess.length - failures.length;
  console.log(`\n[DONE] ${successCount}/${toProcess.length} map icons generated successfully.`);

  if (failures.length > 0) {
    console.log(`\n[FAILURES] ${failures.length} icon(s) failed:`);
    for (const f of failures) {
      console.log(`  - ${f.key}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log(`\nIcons saved to: ${OUTPUT_DIR}`);
  console.log('Keys: ' + toProcess.map((i) => i.key).join(', '));
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
