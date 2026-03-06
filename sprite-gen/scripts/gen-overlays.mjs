/**
 * gen-overlays.mjs — Overlay sprite generation pipeline via OpenRouter (NB1)
 *
 * Generates transparent overlay sprites (minerals, cracks, structures, artifacts,
 * hazards, etc.) that get composited on top of terrain blocks in the game.
 * Includes pre-baked shadow halos for blending with any terrain color.
 *
 * Usage:
 *   node sprite-gen/scripts/gen-overlays.mjs                          # Generate all pending overlays
 *   node sprite-gen/scripts/gen-overlays.mjs --key overlay_mineral_dust_00  # Single overlay
 *   node sprite-gen/scripts/gen-overlays.mjs --category minerals      # One category
 *   node sprite-gen/scripts/gen-overlays.mjs --dry-run                # Preview
 *   node sprite-gen/scripts/gen-overlays.mjs --force                  # Regenerate all
 *
 * Environment:
 *   OPENROUTER_API_KEY — required, loaded from .env at project root
 *
 * Dependencies:
 *   npm install sharp dotenv
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
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

const HIRES_DIR = join(PROJECT_ROOT, 'public/assets/sprites-hires/tiles/overlays');
const LOWRES_DIR = join(PROJECT_ROOT, 'public/assets/sprites/tiles/overlays');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// MANDATORY: Always use Nano Banana 1 (cheapest model at $0.04/img)
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

/** Max API requests per minute (OpenRouter rate-limit safety) */
const RATE_LIMIT_RPM = 10;
/** Minimum delay between requests in ms */
const MIN_REQUEST_INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_RPM);
/** Max retry attempts per sprite */
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms) */
const BACKOFF_BASE_MS = 2_000;

const COST_PER_IMAGE = 0.04;

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
// Overlay definitions
// ---------------------------------------------------------------------------

/**
 * Generate variant definitions for an overlay type.
 * @param {string} prefix  Key prefix (e.g. 'overlay_mineral_dust')
 * @param {number} count   Number of variants
 * @param {string} baseDescription  Base prompt description
 * @param {string} category  Category name
 * @returns {object[]}
 */
function makeVariants(prefix, count, baseDescription, category) {
  const positions = [
    'slightly left of center',
    'slightly right of center',
    'slightly above center',
    'slightly below center',
    'centered',
  ];
  return Array.from({ length: count }, (_, i) => ({
    key: `${prefix}_${String(i).padStart(2, '0')}`,
    prompt: baseDescription + ', ' + positions[i % positions.length],
    category,
  }));
}

const OVERLAY_DEFS = [
  // Minerals (25 images)
  ...makeVariants('overlay_mineral_dust', 5, 'small dull mineral specks and flecks scattered on rock surface', 'minerals'),
  ...makeVariants('overlay_mineral_shard', 5, 'pointed crystal shard fragment embedded in rock', 'minerals'),
  ...makeVariants('overlay_mineral_crystal', 5, 'glowing blue-teal crystal cluster growing from rock', 'minerals'),
  ...makeVariants('overlay_mineral_geode', 5, 'cracked geode with purple crystals inside, partially embedded in rock', 'minerals'),
  ...makeVariants('overlay_mineral_essence', 5, 'radiant golden energy orb floating above rock surface', 'minerals'),

  // Cracks (10 images) — progressive fracture patterns
  { key: 'overlay_crack_01', prompt: 'a single thin hairline crack on rock surface', category: 'cracks' },
  { key: 'overlay_crack_02', prompt: 'two small cracks branching on rock surface', category: 'cracks' },
  { key: 'overlay_crack_03', prompt: 'several small cracks forming a Y-pattern on rock', category: 'cracks' },
  { key: 'overlay_crack_04', prompt: 'moderate crack network spreading across rock', category: 'cracks' },
  { key: 'overlay_crack_05', prompt: 'multiple intersecting cracks on rock surface', category: 'cracks' },
  { key: 'overlay_crack_06', prompt: 'dense crack pattern covering most of rock surface', category: 'cracks' },
  { key: 'overlay_crack_07', prompt: 'heavy fracture web across rock with some pieces loose', category: 'cracks' },
  { key: 'overlay_crack_08', prompt: 'severely cracked rock surface with deep fissures', category: 'cracks' },
  { key: 'overlay_crack_09', prompt: 'nearly shattered rock with wide cracks and fragments breaking off', category: 'cracks' },
  { key: 'overlay_crack_10', prompt: 'completely shattered rock surface, web of deep cracks everywhere', category: 'cracks' },

  // Structures (15 images)
  ...makeVariants('overlay_exit_ladder', 5, 'wooden ladder rungs embedded in rock wall', 'structures'),
  ...makeVariants('overlay_descent_shaft', 5, 'dark circular shaft opening in rock floor', 'structures'),
  ...makeVariants('overlay_quiz_gate', 5, 'glowing golden question mark symbol carved in rock', 'structures'),

  // Artifacts (15 images)
  ...makeVariants('overlay_artifact_common', 5, 'dull ancient pottery fragment partially buried in rock', 'artifacts'),
  ...makeVariants('overlay_artifact_uncommon', 5, 'glowing green ancient artifact piece embedded in rock', 'artifacts'),
  ...makeVariants('overlay_artifact_rare', 5, 'brilliant radiant golden artifact with magical aura embedded in rock', 'artifacts'),

  // Hazards (15 images)
  ...makeVariants('overlay_lava_seep', 5, 'molten orange lava seeping through rock cracks', 'hazards'),
  ...makeVariants('overlay_gas_wisp', 5, 'green toxic gas wisps emanating from rock crevice', 'hazards'),
  ...makeVariants('overlay_fossil', 5, 'embedded fossil bones and shell impressions in rock', 'hazards'),

  // Other (15 images)
  ...makeVariants('overlay_oxygen_cache', 5, 'glowing blue oxygen canister lodged in rock', 'other'),
  ...makeVariants('overlay_chest', 5, 'small treasure chest partially buried in rock', 'other'),
  ...makeVariants('overlay_data_disc', 5, 'glowing cyan data disc embedded in rock wall', 'other'),
];

const VALID_CATEGORIES = ['minerals', 'cracks', 'structures', 'artifacts', 'hazards', 'other'];

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    key:       { type: 'string' },
    category:  { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    force:     { type: 'boolean', default: false },
    help:      { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (args.help) {
  console.log(`
Usage: node sprite-gen/scripts/gen-overlays.mjs [options]

Options:
  --key <name>       Generate a single overlay by key
  --category <name>  Generate overlays in a category (${VALID_CATEGORIES.join(', ')})
  --dry-run          Show what would be generated without calling the API
  --force            Regenerate even if output file already exists
  -h, --help         Show this help message

With no flags, generates all pending overlays.
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
// Selection
// ---------------------------------------------------------------------------

/**
 * Filter overlay definitions based on CLI flags.
 * @returns {object[]}
 */
function selectOverlays() {
  let selected = OVERLAY_DEFS;

  if (args.key) {
    selected = selected.filter((d) => d.key === args.key);
    if (selected.length === 0) {
      console.error(`[ERROR] No overlay with key "${args.key}" found.`);
      process.exit(1);
    }
  } else if (args.category) {
    if (!VALID_CATEGORIES.includes(args.category)) {
      console.error(`[ERROR] Invalid category "${args.category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
      process.exit(1);
    }
    selected = selected.filter((d) => d.category === args.category);
  }

  // Skip already-generated (check hires output) unless --force
  if (!args.force) {
    selected = selected.filter((d) => !existsSync(hiresPath(d.key)));
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** @param {string} key */
function hiresPath(key) {
  return join(HIRES_DIR, `${key}.png`);
}

/** @param {string} key */
function lowresPath(key) {
  return join(LOWRES_DIR, `${key}.png`);
}

// ---------------------------------------------------------------------------
// Prompt template
// ---------------------------------------------------------------------------

/**
 * Wrap a definition's prompt in the standard overlay generation template.
 * @param {string} prompt
 * @returns {string}
 */
function buildPrompt(prompt) {
  return `Generate an image of: ${prompt}, small object floating in center of frame, transparent game sprite, cel-shaded 2D pixel art, bold black outlines, flat color shading with 2-3 tones per color, no gradients, vibrant saturated colors, clean crisp edges, retro 16-bit game style. Solid bright green (#00FF00) background. NO text, NO labels, NO watermarks.`;
}

// ---------------------------------------------------------------------------
// API interaction (same as generate-sprites.mjs)
// ---------------------------------------------------------------------------

/**
 * Call the OpenRouter API to generate an image.
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
async function callOpenRouter(prompt) {
  const body = {
    model: DEFAULT_MODEL,
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

  // Navigate the response to find the base64 image
  const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    const inlineB64 = data?.choices?.[0]?.message?.content?.[0]?.inline_data?.data
      ?? data?.choices?.[0]?.message?.images?.[0]?.b64_json;
    if (inlineB64) {
      return Buffer.from(inlineB64, 'base64');
    }
    throw new Error(
      'No image found in API response. Keys: ' +
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
// Green screen removal (same algorithm as generate-sprites.mjs)
// ---------------------------------------------------------------------------

/**
 * Remove green-screen background from a raw PNG buffer.
 * @param {Buffer} pngBuffer
 * @returns {Promise<Buffer>}  Processed PNG with transparent background, auto-cropped
 */
async function removeGreenScreen(pngBuffer) {
  const image = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Sample corners to detect green-screen color
  const cornerOffsets = [
    0,
    (width - 1) * channels,
    (height - 1) * width * channels,
    ((height - 1) * width + (width - 1)) * channels,
  ];

  let gr = 0, gg = 0, gb = 0, count = 0;
  for (const off of cornerOffsets) {
    const r = data[off], g = data[off + 1], b = data[off + 2];
    if (g > r && g > b && g > 50) {
      gr += r; gg += g; gb += b;
      count++;
    }
  }

  if (count === 0) {
    gr = 0; gg = 255; gb = 0; count = 1;
  } else {
    gr = Math.round(gr / count);
    gg = Math.round(gg / count);
    gb = Math.round(gb / count);
  }

  const HARD_TOLERANCE = 80;
  const EDGE_TOLERANCE = 130;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - gr) ** 2 + (g - gg) ** 2 + (b - gb) ** 2);

    if (dist < HARD_TOLERANCE) {
      data[i + 3] = 0;
    } else if (dist < EDGE_TOLERANCE) {
      const alpha = Math.round(((dist - HARD_TOLERANCE) / (EDGE_TOLERANCE - HARD_TOLERANCE)) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
  }

  // Auto-crop to content bounds
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

  const pad = Math.max(4, Math.round(Math.max(width, height) * 0.02));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  return sharp(data, { raw: { width, height, channels } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Shadow baking
// ---------------------------------------------------------------------------

/**
 * Bake a subtle dark shadow halo around the sprite content.
 * This helps overlays blend with any terrain color underneath.
 *
 * Algorithm:
 *   1. Blur the entire sprite image (radius 8) to spread it outward
 *   2. Tint the blurred version to black (keep only alpha, make RGB=0)
 *   3. Reduce opacity to 30%
 *   4. Composite the original sprite on top of the shadow
 *
 * @param {Buffer} pngBuffer  Clean PNG with transparent background
 * @returns {Promise<Buffer>}  PNG with shadow halo baked in
 */
async function bakeShadow(pngBuffer) {
  const meta = await sharp(pngBuffer).metadata();
  const { width, height } = meta;

  // Decode original to raw RGBA
  const { data: origData } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create blurred version of the alpha channel for shadow extent
  const alphaChannel = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    alphaChannel[i] = origData[i * 4 + 3];
  }

  // Blur the alpha channel (box blur approximation, radius 8)
  const blurredAlpha = boxBlur(alphaChannel, width, height, 8);

  // Build shadow layer: black pixels with blurred alpha at 30% opacity
  const shadowData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const shadowAlpha = Math.round(blurredAlpha[i] * 0.3);
    shadowData[i * 4 + 0] = 0; // R
    shadowData[i * 4 + 1] = 0; // G
    shadowData[i * 4 + 2] = 0; // B
    shadowData[i * 4 + 3] = shadowAlpha; // A
  }

  // Create shadow PNG
  const shadowPng = await sharp(shadowData, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  // Composite: shadow under original
  return sharp(shadowPng)
    .composite([{ input: pngBuffer, blend: 'over' }])
    .png()
    .toBuffer();
}

/**
 * Simple box blur on a single-channel buffer (3-pass for approximate Gaussian).
 * @param {Buffer} channel  Single-channel pixel data
 * @param {number} w  Width
 * @param {number} h  Height
 * @param {number} radius  Blur radius
 * @returns {Buffer}  Blurred single-channel data
 */
function boxBlur(channel, w, h, radius) {
  // We do 3 passes of box blur to approximate Gaussian
  let src = new Float32Array(channel);
  let dst = new Float32Array(w * h);

  for (let pass = 0; pass < 3; pass++) {
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w) {
            sum += src[y * w + nx];
            count++;
          }
        }
        dst[y * w + x] = sum / count;
      }
    }
    // Swap
    [src, dst] = [dst, src];

    // Vertical pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < h) {
            sum += src[ny * w + x];
            count++;
          }
        }
        dst[y * w + x] = sum / count;
      }
    }
    [src, dst] = [dst, src];
  }

  // Convert back to uint8
  const result = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    result[i] = Math.min(255, Math.round(src[i]));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Downscaling
// ---------------------------------------------------------------------------

/**
 * Resize a PNG buffer to exact target dimensions using nearest-neighbor.
 * @param {Buffer} pngBuffer
 * @param {number} targetW
 * @param {number} targetH
 * @returns {Promise<Buffer>}
 */
async function downscale(pngBuffer, targetW, targetH) {
  return sharp(pngBuffer)
    .resize(targetW, targetH, {
      kernel: sharp.kernel.nearest,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} filePath  Path to a file (its parent dir will be ensured)
 */
async function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Format elapsed time in seconds.
 * @param {number} startMs
 * @param {number} endMs
 * @returns {string}
 */
function elapsed(startMs, endMs) {
  return ((endMs - startMs) / 1000).toFixed(1) + 's';
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  const toProcess = selectOverlays();

  if (toProcess.length === 0) {
    console.log('[INFO] All matching overlays already exist. Use --force to regenerate.');
    process.exit(0);
  }

  // Dry-run mode
  if (args['dry-run']) {
    console.log(`\n[DRY RUN] Would generate ${toProcess.length} overlay(s):\n`);
    const byCat = {};
    for (const d of toProcess) {
      if (!byCat[d.category]) byCat[d.category] = [];
      byCat[d.category].push(d);
    }
    for (const [cat, defs] of Object.entries(byCat)) {
      console.log(`  ${cat} (${defs.length}):`);
      for (const d of defs) {
        console.log(`    - ${d.key}`);
        console.log(`      Prompt: ${d.prompt.slice(0, 70)}...`);
      }
    }
    const cost = (toProcess.length * COST_PER_IMAGE).toFixed(2);
    console.log(`\nTotal: ${toProcess.length} overlay(s). Estimated cost: $${cost}`);
    console.log('Remove --dry-run to execute.');
    process.exit(0);
  }

  // Run generation
  console.log(`\n[START] Generating ${toProcess.length} overlay(s)...\n`);

  const failures = [];
  const categoryStats = {};
  let generated = 0;
  let skipped = 0;
  let lastRequestTime = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const def = toProcess[i];
    const tag = `[${i + 1}/${toProcess.length}]`;
    const prompt = buildPrompt(def.prompt);

    process.stdout.write(`${tag} Generating ${def.key}... `);
    const startTime = Date.now();

    // Rate limiting
    const timeSinceLast = Date.now() - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
      const waitMs = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
      process.stdout.write(`(rate limit, waiting ${(waitMs / 1000).toFixed(1)}s) `);
      await sleep(waitMs);
    }

    try {
      // 1. Call the API
      lastRequestTime = Date.now();
      const rawBuffer = await callWithRetry(prompt);

      // 2. Remove green screen + auto-crop
      const cleanBuffer = await removeGreenScreen(rawBuffer);

      // 3. Bake shadow halo
      const shadowedBuffer = await bakeShadow(cleanBuffer);

      // 4. Downscale to hi-res (256x256)
      const hiresBuffer = await downscale(shadowedBuffer, 256, 256);
      const hp = hiresPath(def.key);
      await ensureDir(hp);
      await writeFile(hp, hiresBuffer);

      // 5. Downscale to lo-res (32x32)
      const lowresBuffer = await downscale(shadowedBuffer, 32, 32);
      const lp = lowresPath(def.key);
      await ensureDir(lp);
      await writeFile(lp, lowresBuffer);

      generated++;
      const elapsedStr = elapsed(startTime, Date.now());
      console.log(`done (${elapsedStr})`);

      // Track category stats
      if (!categoryStats[def.category]) {
        categoryStats[def.category] = { count: 0, timeMs: 0 };
      }
      categoryStats[def.category].count++;
      categoryStats[def.category].timeMs += Date.now() - startTime;
    } catch (err) {
      const elapsedStr = elapsed(startTime, Date.now());
      console.log(`FAILED (${elapsedStr})`);
      console.error(`    Error: ${err.message}`);
      failures.push({ key: def.key, error: err.message });
    }
  }

  // Category summaries
  const categories = Object.entries(categoryStats);
  if (categories.length > 0) {
    console.log('\n--- Category Summaries ---');
    for (const [cat, stats] of categories) {
      console.log(`  ${cat}: ${stats.count} overlay(s) in ${(stats.timeMs / 1000).toFixed(1)}s`);
    }
  }

  // Auto-regenerate sprite keys so new overlays are available in-game
  if (generated > 0) {
    console.log('\n[SPRITE KEYS] Regenerating spriteKeys.ts...');
    try {
      execSync('node scripts/gen-sprite-keys.mjs', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (e) {
      console.error('[SPRITE KEYS] Failed to regenerate:', e.message);
    }
  }

  // Final summary
  skipped = OVERLAY_DEFS.length - toProcess.length;
  const cost = (generated * COST_PER_IMAGE).toFixed(2);
  console.log(`\n[DONE] Summary:`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped} (already exist)`);
  console.log(`  Failed:    ${failures.length}`);
  console.log(`  Cost:      ~$${cost}`);

  if (failures.length > 0) {
    console.log(`\n[FAILURES] ${failures.length} overlay(s) failed:`);
    for (const f of failures) {
      console.log(`  - ${f.key}: ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
