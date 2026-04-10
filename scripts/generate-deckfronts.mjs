#!/usr/bin/env node
/**
 * Direct deckfront generator — one-shot, no review, no artstudio UI.
 *
 * Workflow (per user feedback 2026-04-10):
 *   1. Look at data/decks/*.json for all knowledge decks
 *   2. Diff against public/assets/sprites/deckfronts/ to find missing
 *   3. For each missing deck, craft a prompt in the house style
 *      (see sprite-gen/cardback-tool/artstudio-items.json for existing examples)
 *   4. Call OpenRouter google/gemini-2.5-flash-image (portrait)
 *   5. Save directly as public/assets/sprites/deckfronts/{id}.webp
 *   6. Run depth map generation (optional, stored for future use)
 *
 * Usage:
 *   node scripts/generate-deckfronts.mjs                # all missing
 *   node scripts/generate-deckfronts.mjs --id foo,bar   # specific ids
 *   node scripts/generate-deckfronts.mjs --force        # regenerate existing
 *
 * Env: OPENROUTER_API_KEY must be set (reads from ./.env).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load .env manually
try {
  const env = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY not set in .env');
  process.exit(1);
}

const MODEL = 'google/gemini-2.5-flash-image';
const TARGET_W = 768;
const TARGET_H = 1024;

const DECK_DIR = resolve(ROOT, 'data/decks');
const OUT_DIR = resolve(ROOT, 'public/assets/sprites/deckfronts');
const ARTSTUDIO_ITEMS = resolve(ROOT, 'sprite-gen/cardback-tool/artstudio-items.json');

// Parent prefixes: language decks share one image per family
const PARENT_PREFIXES = ['japanese', 'chinese', 'korean', 'spanish', 'french', 'german', 'dutch', 'czech'];

function deckIdToImageId(deckId) {
  for (const p of PARENT_PREFIXES) {
    if (deckId.startsWith(p + '_') || deckId === p) return p;
  }
  return deckId;
}

// House style: 16-bit pixel art RPG scene, pixel art dungeon aesthetic, no text
const STYLE_SUFFIX = 'JRPG dungeon tileset aesthetic, rich pixel detail, {palette} palette, dithered shadows, clean pixel edges, retro game screenshot composition, fills entire frame edge to edge, no border no frame, absolutely no readable text no letters no numbers no words no symbols that resemble writing';
const STYLE_LEAD = '16-bit pixel art RPG scene, ';

/**
 * Built-in subject/palette library for known decks. Extend this as new decks are added.
 * If a deck is not in this list, generateFallbackPrompt() will synthesize from its name.
 */
const DECK_PROMPTS = {
  anime_manga: {
    palette: 'magenta neon cyan and deep violet',
    subject: 'a hidden underground shrine chamber stacked with ornate manga tomes and scrolls, a glowing cel-shaded fox spirit floating amid swirling sakura petals, paper lanterns hanging from stone rafters casting dithered neon glow, katana resting against a cracked stone pedestal, speed-line rays carved into the walls',
  },
  chess_tactics: {
    palette: 'checkered black and white with royal gold',
    subject: 'a vast vaulted crypt where a giant chessboard sprawls across cracked flagstones, marble and obsidian pieces locked mid-battle, a fallen king lying on its side near a stream of glowing runes, torches flickering in iron sconces, dithered shadows across the tile grid',
  },
  fifa_world_cup: {
    palette: 'emerald grass warm gold and crimson banners',
    subject: 'a forgotten underground arena with a crumbling grass pitch, a gleaming pixel-art golden trophy resting atop a mossy stone pedestal at center, a worn leather football in the foreground, tattered team banners hanging from cavern walls, shafts of sunlight piercing a broken roof',
  },
  ocean_life: {
    palette: 'deep teal aquamarine and bioluminescent cyan',
    subject: 'a sunken coral grotto deep underwater, glowing pixel-art jellyfish drifting through shafts of dithered light, colorful coral formations covering ancient ruined pillars, a distant whale silhouette passing through a crack in the cavern wall, a treasure chest half-buried in sand',
  },
  philosophy: {
    palette: 'parchment tan sage green and cool stone grey',
    subject: 'a dim underground stone library lined with toppled marble busts of ancient philosophers, scrolls and tomes scattered across a long oak table, a quill and inkwell in the foreground, glowing rune-like thought symbols hovering in the air, candlelight casting dithered shadows',
  },
  pop_culture: {
    palette: 'hot pink electric blue and retro yellow',
    subject: 'a subterranean arcade chamber with stacks of retro CRT televisions flickering on mossy stone shelves, cassette tapes and vinyl records scattered across the floor, a glowing vinyl record levitating above a cracked stone altar, neon signs carved into cave walls, dithered pink haze in the air',
  },
  world_literature: {
    palette: 'deep burgundy aged parchment and warm brass',
    subject: 'a cavernous vaulted library dungeon with towering stone bookshelves carved into the walls, ancient leather tomes floating gently in dithered beams of candlelight, a quill writing by itself over an open manuscript on a heavy oak desk, hanging brass lanterns casting warm shadows',
  },
};

function buildPrompt(imageId, deckName) {
  const spec = DECK_PROMPTS[imageId];
  if (spec) {
    return STYLE_LEAD + spec.subject + ', ' + STYLE_SUFFIX.replace('{palette}', spec.palette);
  }
  // Fallback: generic dungeon scene themed by deck name
  const subj = `an underground dungeon chamber themed around ${deckName}, thematic artifacts and props in the foreground, torches and glowing runes, dramatic dithered lighting`;
  return STYLE_LEAD + subj + ', ' + STYLE_SUFFIX.replace('{palette}', 'warm torchlight amber deep indigo and mossy green');
}

function extractBase64(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error('No message in response');
  const sources = [];
  if (Array.isArray(message.content)) sources.push(...message.content);
  if (Array.isArray(message.images)) sources.push(...message.images);
  if (typeof message.content === 'string') throw new Error(`Text-only: ${message.content.slice(0,100)}`);
  for (const part of sources) {
    if (part.image_url?.url) {
      const m = part.image_url.url.match(/^data:image\/[^;]+;base64,(.+)$/s);
      if (m) return m[1];
      return part.image_url.url;
    }
    if (part.type === 'image' && part.data) return part.data;
    if (part.inline_data?.data) return part.inline_data.data;
  }
  throw new Error('No image in response');
}

async function callOpenRouter(prompt) {
  const MAX = 3;
  for (let a = 1; a <= MAX; a++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        modalities: ['image', 'text'],
        stream: false,
        messages: [
          { role: 'system', content: 'You are an image generator. Always respond with a generated image. Never respond with only text.' },
          { role: 'user', content: `${prompt}\n\nIMPORTANT: Generate this image at exactly ${TARGET_W}x${TARGET_H} pixels resolution. Aspect ratio must be ${TARGET_W}:${TARGET_H}.` },
        ],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (a < MAX) { console.warn(`  HTTP ${r.status} attempt ${a}, retrying...`); await new Promise(x => setTimeout(x, 2000)); continue; }
      throw new Error(`HTTP ${r.status}: ${t.slice(0,300)}`);
    }
    const d = await r.json();
    try { extractBase64(d); return d; } catch (e) {
      if (a < MAX) { console.warn(`  text-only attempt ${a}, retrying...`); await new Promise(x => setTimeout(x, 1000)); continue; }
      throw e;
    }
  }
}

async function generateAndDeploy(imageId, deckName) {
  const prompt = buildPrompt(imageId, deckName);
  console.log(`\n→ ${imageId}`);
  console.log(`  prompt: ${prompt.slice(0, 140)}...`);
  const data = await callOpenRouter(prompt);
  const b64 = extractBase64(data);
  const buf = Buffer.from(b64, 'base64');
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, `${imageId}.webp`);
  await sharp(buf)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', kernel: sharp.kernel.nearest })
    .webp({ quality: 90 })
    .toFile(outPath);
  console.log(`  ✓ wrote ${outPath}`);
  return outPath;
}

// --- Main ---
const args = process.argv.slice(2);
const force = args.includes('--force');
const idArg = args.find(a => a.startsWith('--id='))?.slice(5) ||
              (args.indexOf('--id') >= 0 ? args[args.indexOf('--id') + 1] : null);

// Enumerate decks
const deckFiles = readdirSync(DECK_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json' && !f.startsWith('test_'));
const allDeckIds = deckFiles.map(f => basename(f, '.json'));

// Collapse to image IDs (language families share one image)
const imageIdToDeckName = new Map();
for (const deckId of allDeckIds) {
  const imgId = deckIdToImageId(deckId);
  if (!imageIdToDeckName.has(imgId)) {
    // Load deck for display name
    let name = imgId;
    try {
      const deck = JSON.parse(readFileSync(resolve(DECK_DIR, `${deckId}.json`), 'utf-8'));
      name = deck.name || deck.title || imgId;
    } catch {}
    imageIdToDeckName.set(imgId, name);
  }
}

// Determine what to generate
let targets;
if (idArg) {
  targets = idArg.split(',').map(s => s.trim()).filter(Boolean);
} else {
  targets = [];
  for (const [imgId] of imageIdToDeckName) {
    const existing = resolve(OUT_DIR, `${imgId}.webp`);
    if (force || !existsSync(existing)) targets.push(imgId);
  }
}

if (targets.length === 0) {
  console.log('All deckfronts already generated. Use --force to regenerate.');
  process.exit(0);
}

console.log(`Generating ${targets.length} deckfront(s): ${targets.join(', ')}`);

const results = { ok: [], fail: [] };
for (const imgId of targets) {
  try {
    const name = imageIdToDeckName.get(imgId) || imgId;
    await generateAndDeploy(imgId, name);
    results.ok.push(imgId);
  } catch (e) {
    console.error(`  ✗ ${imgId}: ${e.message}`);
    results.fail.push(imgId);
  }
}

console.log(`\nDone. ok=${results.ok.length} fail=${results.fail.length}`);
if (results.fail.length) {
  console.log(`Failed: ${results.fail.join(', ')}`);
  process.exit(1);
}
