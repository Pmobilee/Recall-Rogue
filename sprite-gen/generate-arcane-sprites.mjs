#!/usr/bin/env node
/**
 * Arcane Recall — NB1 Sprite Generation Pipeline
 *
 * Generates pixel art sprites via OpenRouter (Gemini 2.5 Flash Image)
 * with green screen removal and nearest-neighbor resizing.
 *
 * Usage:
 *   node sprite-gen/generate-arcane-sprites.mjs --all
 *   node sprite-gen/generate-arcane-sprites.mjs --category enemies
 *   node sprite-gen/generate-arcane-sprites.mjs --id cave_bat_idle
 *   node sprite-gen/generate-arcane-sprites.mjs --id cave_bat_idle --force
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { removeGreenScreen } from './lib/green-screen.mjs';
import { autoCrop, resizeNearest } from './lib/post-process.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────────

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-image';
const BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

if (!API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY not set in .env');
  process.exit(1);
}

// ── CLI Args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
const hasFlag = (name) => args.includes(`--${name}`);

const filterCategory = getArg('category');
const filterId = getArg('id');
const forceOverwrite = hasFlag('force');
const generateAll = hasFlag('all');

if (!filterCategory && !filterId && !generateAll) {
  console.log('Usage: --all | --category <name> | --id <sprite_id> [--force]');
  process.exit(0);
}

// ── Load manifest ───────────────────────────────────────────────────────

const manifestPath = path.join(__dirname, 'arcane-prompts.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Combine sprites and backgrounds into one list
const allEntries = [
  ...manifest.sprites.map((s) => ({ ...s, type: 'sprite' })),
  ...manifest.backgrounds.map((b) => ({ ...b, type: 'background', useGreenScreen: false })),
];

// Filter
const entries = allEntries.filter((entry) => {
  if (filterId) return entry.id === filterId;
  if (filterCategory) return entry.category === filterCategory;
  return true; // --all
});

if (entries.length === 0) {
  console.error(`No entries found matching filter (id=${filterId}, category=${filterCategory})`);
  process.exit(1);
}

console.log(`\n🎨 Arcane Recall Sprite Generator — ${entries.length} sprite(s) queued\n`);

// ── Registry ────────────────────────────────────────────────────────────

const registryPath = path.join(__dirname, 'sprite-registry.json');
let registry = {};
try {
  registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
} catch {
  registry = {};
}
if (!registry.arcane) registry.arcane = {};

// ── API Call with Retry ─────────────────────────────────────────────────

async function callOpenRouterRaw(prompt) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      modalities: ['image', 'text'],
      stream: false,
      messages: [
        { role: 'system', content: 'You are an image generator. Always respond with a generated image. Never respond with only text.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (response.status === 429 || response.status >= 500) {
    throw Object.assign(new Error(`HTTP ${response.status}`), { retryable: true, code: `HTTP_${response.status}` });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  return await response.json();
}

async function callOpenRouter(prompt, retries = 5) {
  const delays = [2000, 4000, 6000, 8000, 10000];

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const data = await callOpenRouterRaw(prompt);

      // Check if we got an image or just text
      const message = data?.choices?.[0]?.message;
      if (message) {
        const hasImage = (
          (Array.isArray(message.images) && message.images.length > 0) ||
          (Array.isArray(message.content) && message.content.some(p =>
            p.image_url?.url || p.type === 'image' || p.inline_data?.data
          ))
        );
        if (!hasImage) {
          // Text-only response — retry with modified prompt
          if (attempt < retries - 1) {
            const delay = delays[attempt] || 6000;
            console.log(`\n  ⚠ Text-only response (attempt ${attempt + 1}/${retries}), retrying in ${delay / 1000}s...`);
            await sleep(delay);
            // Don't modify the prompt — the system message handles it
            continue;
          }
          throw new Error(`Response was text only after ${retries} attempts: "${String(message.content || '').slice(0, 100)}"`);
        }
      }

      return data;
    } catch (err) {
      const isRetryable = err.retryable || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (attempt < retries - 1 && isRetryable) {
        const delay = delays[attempt] || 6000;
        console.log(`  ⚠ ${err.code || err.message}, retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Extract Image from Response ─────────────────────────────────────────

function extractImageBase64(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) {
    console.log('\n  DEBUG full response:', JSON.stringify(data, null, 2).slice(0, 500));
    throw new Error('No message in response');
  }

  // Collect all image-bearing arrays: message.content, message.images, or message itself
  const sources = [];
  if (Array.isArray(message.content)) sources.push(...message.content);
  if (Array.isArray(message.images)) sources.push(...message.images);
  if (message.content && typeof message.content === 'string') {
    // Plain text only — no image
    throw new Error(`Response was text only: "${message.content.slice(0, 100)}"`);
  }

  if (sources.length === 0 && !message.content && !message.images) {
    console.log('\n  DEBUG message keys:', Object.keys(message));
    console.log('  DEBUG message:', JSON.stringify(message).slice(0, 500));
    throw new Error('No content or images in response');
  }

  for (const part of sources) {
    // Format: { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
    if (part.image_url?.url) {
      const match = part.image_url.url.match(/^data:image\/[^;]+;base64,(.+)$/s);
      if (match) return match[1];
      return part.image_url.url;
    }

    // Format: { type: 'image', data: '...' }
    if (part.type === 'image' && part.data) {
      return part.data;
    }

    // Format: inline_data
    if (part.inline_data?.data) {
      return part.inline_data.data;
    }
  }

  console.log('  DEBUG: source items:');
  for (const part of sources) {
    console.log(`    type=${part.type}, keys=${Object.keys(part).join(',')}`);
  }

  throw new Error('Could not find image data in response');
}

// ── Process Single Entry ────────────────────────────────────────────────

async function processEntry(entry) {
  const start = Date.now();
  const isBackground = entry.type === 'background';
  const outputCategory = entry.outputDir || entry.category;

  // Output paths
  const rawDir = path.join(__dirname, 'output', outputCategory);
  const rawPath = path.join(rawDir, `${entry.id}_original.png`);

  let finalDir, finalPath2x, finalPath1x;
  if (isBackground) {
    finalDir = path.join(ROOT, 'public', 'assets', 'backgrounds', outputCategory);
    finalPath2x = path.join(finalDir, `${entry.id}.png`);
    finalPath1x = null; // backgrounds don't need 1x
  } else {
    finalDir = path.join(ROOT, 'public', 'assets', 'sprites', outputCategory);
    finalPath2x = path.join(finalDir, `${entry.id}.png`);
    finalPath1x = path.join(finalDir, `${entry.id}_1x.png`);
  }

  // Check existing
  if (!forceOverwrite && fs.existsSync(finalPath2x)) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ⏭ ${entry.id} — already exists (${elapsed}s) [use --force to overwrite]`);
    return true;
  }

  // Ensure dirs exist
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(finalDir, { recursive: true });

  // Call API
  process.stdout.write(`  Generating ${entry.id}...`);
  const data = await callOpenRouter(entry.prompt);
  const base64 = extractImageBase64(data);
  let buffer = Buffer.from(base64, 'base64');

  // Save raw
  fs.writeFileSync(rawPath, buffer);
  const rawMeta = await sharp(buffer).metadata();
  console.log(` raw ${rawMeta.width}x${rawMeta.height}`);

  // Green screen removal
  if (entry.useGreenScreen) {
    process.stdout.write('  Removing green screen...');
    buffer = await removeGreenScreen(buffer);
    console.log(' done');
  }

  // Auto-crop (sprites only)
  if (!isBackground) {
    buffer = await autoCrop(buffer);
    const croppedMeta = await sharp(buffer).metadata();
    console.log(`  Cropped to ${croppedMeta.width}x${croppedMeta.height}`);
  }

  // Resize to target (2x)
  const tw = entry.targetWidth;
  const th = entry.targetHeight;
  if (tw && th) {
    const resized2x = await resizeNearest(buffer, tw, th);
    fs.writeFileSync(finalPath2x, resized2x);
    console.log(`  Saved 2x: ${tw}x${th} → ${finalPath2x}`);

    // 1x version (half dimensions) — sprites only
    if (!isBackground && finalPath1x) {
      const resized1x = await resizeNearest(buffer, Math.round(tw / 2), Math.round(th / 2));
      fs.writeFileSync(finalPath1x, resized1x);
      console.log(`  Saved 1x: ${Math.round(tw / 2)}x${Math.round(th / 2)} → ${finalPath1x}`);
    }
  } else {
    // No target size — save as-is
    fs.writeFileSync(finalPath2x, buffer);
    console.log(`  Saved → ${finalPath2x}`);
  }

  // Update registry
  registry.arcane[entry.id] = {
    id: entry.id,
    category: entry.category,
    type: entry.type,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    targetSize: tw && th ? { width: tw, height: th } : null,
    paths: {
      raw: path.relative(ROOT, rawPath),
      '2x': path.relative(ROOT, finalPath2x),
      ...(finalPath1x ? { '1x': path.relative(ROOT, finalPath1x) } : {}),
    },
  };

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  ✓ ${entry.id} complete (${elapsed}s)\n`);
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────

let successes = 0;
let failures = 0;

for (const entry of entries) {
  try {
    const ok = await processEntry(entry);
    if (ok) successes++;
  } catch (err) {
    failures++;
    console.error(`  ✗ ${entry.id} FAILED: ${err.message}\n`);
  }
}

// Save registry
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

console.log(`\nDone: ${successes} succeeded, ${failures} failed`);
if (failures > 0) process.exit(1);
