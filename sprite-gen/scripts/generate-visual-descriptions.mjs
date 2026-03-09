#!/usr/bin/env node
/**
 * Generate visual descriptions for facts missing them.
 * Uses Claude API (requires ANTHROPIC_API_KEY in environment).
 *
 * Usage:
 *   node generate-visual-descriptions.mjs                    # Process all missing
 *   node generate-visual-descriptions.mjs --dry-run          # Show what would be generated
 *   node generate-visual-descriptions.mjs --limit 10         # Process at most 10
 *   node generate-visual-descriptions.mjs --file vocab-n3    # Only process matching file
 *   node generate-visual-descriptions.mjs --reset            # Clear checkpoint and start fresh
 *   node generate-visual-descriptions.mjs --language ja    # Japanese cultural theming
 *   node generate-visual-descriptions.mjs --language es    # Spanish cultural theming
 *   node generate-visual-descriptions.mjs --language fr    # French cultural theming
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '../../src/data/seed');
const CHECKPOINT_PATH = join(__dirname, '.vd-checkpoint.json');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 100;
const RATE_LIMIT_MS = 500;
const RETRY_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESET = args.includes('--reset');

let LIMIT = Infinity;
const limitIdx = args.indexOf('--limit');
if (limitIdx !== -1 && args[limitIdx + 1]) {
  LIMIT = parseInt(args[limitIdx + 1], 10);
  if (isNaN(LIMIT) || LIMIT <= 0) {
    console.error('Error: --limit must be a positive integer');
    process.exit(1);
  }
}

let FILE_FILTER = null;
const fileIdx = args.indexOf('--file');
if (fileIdx !== -1 && args[fileIdx + 1]) {
  FILE_FILTER = args[fileIdx + 1];
}

let LANGUAGE = null;
const langIdx = args.indexOf('--language');
if (langIdx !== -1 && args[langIdx + 1]) {
  LANGUAGE = args[langIdx + 1];
}

// ---------------------------------------------------------------------------
// Content safety
// ---------------------------------------------------------------------------

const BLOCKLIST = [
  /\bblood\b/i, /\bgore\b/i, /\bnude\b/i, /\bsexy\b/i, /\bnaked\b/i,
  /\bpolitical\b/i, /\bterrorist\b/i, /\bweapon\s+aimed\b/i,
  /\breal\s+photo\b/i, /\bphotograph\b/i, /\bphotorealistic\b/i,
  /\btext\b.*\bsay/i, /\bwrite\b.*\btext/i, /\bletter.*\bspell/i,
];

/**
 * Validate a generated visual description for content safety.
 * @param {string} text
 * @returns {{ safe: boolean, reason?: string }}
 */
function validateDescription(text) {
  for (const pattern of BLOCKLIST) {
    if (pattern.test(text)) return { safe: false, reason: pattern.toString() };
  }
  if (text.length < 20) return { safe: false, reason: 'too short' };
  if (text.length > 300) return { safe: false, reason: 'too long' };
  return { safe: true };
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You write visual scene descriptions for pixel art card illustrations in a fantasy card game called Arcane Recall.

Given a learning fact, write a single-sentence visual description (20-40 words) suitable as a prompt for generating pixel art card art.

Rules:
- Describe a CONCRETE visual scene, not an abstract concept
- ONE clear focal subject that embodies the fact
- No text, labels, numbers, or UI elements in the scene
- No realistic human faces (historical figures OK if stylized/symbolic)
- No political symbols, religious controversy, or disputed territories
- No violence beyond fantasy (no blood, no weapons pointed at viewer)
- No sexual content
- For vocabulary/language facts: illustrate the MEANING of the word, not the word itself
- Vivid colors, dramatic lighting, pixel-art-friendly composition
- Subject fills 80% of frame with breathing room at edges

Return ONLY the visual description string. No JSON, no quotes, no explanation.`;

const LANGUAGE_PROMPTS = {
  ja: `

CRITICAL — CULTURAL THEMING (Japanese vocabulary):
Every scene MUST be unmistakably set in Japan. Use feudal, Edo-period, or traditional Japanese settings.

REQUIRED ELEMENTS (use at least 2 per description):
- Architecture: torii gates, pagodas, tatami rooms, shoji screens, castle towns, wooden bridges, thatched roofs
- Nature: bamboo forests, cherry blossoms, koi ponds, zen rock gardens, misty mountains, rice paddies
- Cultural: tea ceremonies, calligraphy brushes, paper lanterns, shrine bells, incense, silk kimonos
- People: samurai, monks, merchants, artisans, fishermen (all stylized pixel art, no realistic faces)
- Settings: moonlit temple roofs, bustling Edo markets, mountain hot springs, coastal fishing villages

COLOR PALETTE: Ukiyo-e influence — deep indigos, warm ambers, cherry blossom pink, moss green, twilight purple, lantern gold.

CRITICAL RULE: The scene must ILLUSTRATE THE MEANING of the word using Japanese cultural elements.
- "to calculate" → A merchant in a lantern-lit Edo shop carefully moving beads on a soroban abacus
- "to endure" → A samurai kneeling motionless in falling snow before a weathered temple gate
- "to translate" → A scholar in a candlelit room surrounded by scrolls, brush poised between kanji and foreign text
- "to export" → A bustling harbor with workers loading silk-wrapped crates onto a wooden trading vessel at sunrise

BAD examples (REJECT these patterns):
- Generic fantasy with no Japanese elements
- Just "a person doing X" with no cultural setting
- Glowing orbs, magic portals, generic wizards — these belong to general facts, NOT vocab cards
- Offensive stereotypes or modern settings (no neon, no anime tropes)`,

  es: `

CRITICAL — CULTURAL THEMING (Spanish vocabulary):
Every scene MUST be unmistakably set in Spain or Latin America.

REQUIRED ELEMENTS (use at least 2 per description):
- Architecture: terracotta plazas, haciendas, Moorish arches, colonial churches, adobe walls
- Nature: agave fields, jungle cenotes, olive groves, volcanic landscapes, desert mesas
- Cultural: flamenco dancers, guitar players, bull arenas, mercados, Day of the Dead altars
- People: matadors, conquistadors, artisans, farmers, musicians (stylized pixel art)
- Settings: sun-drenched courtyards, candlelit cantinas, Mediterranean harbors, Aztec temple ruins

COLOR PALETTE: Warm sunset tones — burnt orange, terracotta red, golden yellow, turquoise, deep crimson.`,

  fr: `

CRITICAL — CULTURAL THEMING (French vocabulary):
Every scene MUST be unmistakably set in France or French-speaking regions.

REQUIRED ELEMENTS (use at least 2 per description):
- Architecture: cobblestone cafés, cathedral stained glass, château gardens, wrought-iron balconies
- Nature: lavender fields, vineyard hillsides, misty river bridges, poplar-lined roads
- Cultural: patisserie windows, wine barrels, beret-wearing painters, bookshop stalls along the Seine
- People: bakers, artists, musketeers, vineyard workers (stylized pixel art)
- Settings: Parisian rooftops at dusk, Provençal markets, candlelit bistros, fog-wrapped lighthouses

COLOR PALETTE: Soft pastels — powder blue, dusty rose, cream, sage green, warm gold, violet twilight.`,
};

// ---------------------------------------------------------------------------
// Checkpoint
// ---------------------------------------------------------------------------

/** @returns {Set<string>} */
async function loadCheckpoint() {
  if (RESET) {
    return new Set();
  }
  try {
    const data = await readFile(CHECKPOINT_PATH, 'utf-8');
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

/** @param {Set<string>} processed */
async function saveCheckpoint(processed) {
  await writeFile(CHECKPOINT_PATH, JSON.stringify([...processed], null, 2));
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Recursively find all .json files under a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function findJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files.sort();
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

const API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Call Claude API to generate a visual description for one fact.
 * @param {{ statement: string, category: string[], type: string }} fact
 * @returns {Promise<string>}
 */
async function generateDescription(fact) {
  if (!API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const userPrompt = [
    `Fact: ${fact.statement}`,
    `Category: ${fact.category[0]}${fact.category[1] ? ' > ' + fact.category[1] : ''}`,
    `Type: ${fact.type}`,
  ].join('\n');

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT + (LANGUAGE && LANGUAGE_PROMPTS[LANGUAGE] ? LANGUAGE_PROMPTS[LANGUAGE] : ''),
    messages: [{ role: 'user', content: userPrompt }],
  };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log(`  Retrying after ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
    }

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API ${resp.status}: ${errText}`);
      }

      const json = await resp.json();
      const text = json.content?.[0]?.text?.trim();
      if (!text) {
        throw new Error('Empty response from API');
      }
      return text;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Visual Description Generator ===');
  if (DRY_RUN) console.log('  Mode: DRY RUN (no files will be modified)');
  if (LIMIT < Infinity) console.log(`  Limit: ${LIMIT}`);
  if (FILE_FILTER) console.log(`  File filter: ${FILE_FILTER}`);
  if (RESET) console.log('  Checkpoint reset');
  if (LANGUAGE) console.log(`  Language: ${LANGUAGE}`);
  console.log();

  // Discover JSON files
  let jsonFiles = await findJsonFiles(SEED_DIR);
  if (FILE_FILTER) {
    jsonFiles = jsonFiles.filter(f => basename(f, '.json').includes(FILE_FILTER));
  }
  console.log(`Found ${jsonFiles.length} seed file(s)\n`);

  // Load checkpoint
  const processed = await loadCheckpoint();
  if (processed.size > 0) {
    console.log(`Checkpoint: ${processed.size} fact(s) already processed\n`);
  }

  // Collect facts missing visualDescription
  /** @type {Array<{ file: string, index: number, fact: any }>} */
  const missing = [];

  for (const file of jsonFiles) {
    const raw = await readFile(file, 'utf-8');
    const facts = JSON.parse(raw);
    if (!Array.isArray(facts)) continue;

    for (let i = 0; i < facts.length; i++) {
      const fact = facts[i];
      if (!fact.id || !fact.statement) continue;
      if (fact.visualDescription) continue;
      if (processed.has(fact.id)) continue;
      missing.push({ file, index: i, fact });
    }
  }

  const total = Math.min(missing.length, LIMIT);
  console.log(`Facts missing visualDescription: ${missing.length}`);
  console.log(`Will process: ${total}\n`);

  if (total === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!DRY_RUN && !API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  // Track which files have been modified (file path -> parsed JSON array)
  /** @type {Map<string, any[]>} */
  const modifiedFiles = new Map();

  let successCount = 0;
  let failCount = 0;
  let skippedUnsafe = 0;

  for (let i = 0; i < total; i++) {
    const { file, index, fact } = missing[i];
    const relFile = relative(SEED_DIR, file);
    const prefix = `[${i + 1}/${total}] ${fact.id}`;

    if (DRY_RUN) {
      console.log(`${prefix}: (${relFile}) "${fact.statement.substring(0, 60)}..."`);
      continue;
    }

    try {
      const description = await generateDescription(fact);
      const validation = validateDescription(description);

      if (!validation.safe) {
        console.log(`${prefix}: UNSAFE (${validation.reason}) — "${description.substring(0, 60)}..."`);
        skippedUnsafe++;
        // Still mark as processed so we don't retry unsafe content endlessly
        processed.add(fact.id);
        await saveCheckpoint(processed);
        continue;
      }

      // Load file data if not already cached
      if (!modifiedFiles.has(file)) {
        const raw = await readFile(file, 'utf-8');
        modifiedFiles.set(file, JSON.parse(raw));
      }

      // Update the fact in our cached data
      const fileData = modifiedFiles.get(file);
      const targetFact = fileData.find(f => f.id === fact.id);
      if (targetFact) {
        targetFact.visualDescription = description;
      }

      // Write back immediately so progress isn't lost on crash
      await writeFile(file, JSON.stringify(fileData, null, 2) + '\n');

      processed.add(fact.id);
      await saveCheckpoint(processed);

      successCount++;
      console.log(`${prefix}: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`);

      // Rate limit
      if (i < total - 1) {
        await sleep(RATE_LIMIT_MS);
      }
    } catch (err) {
      failCount++;
      console.error(`${prefix}: ERROR — ${err.message}`);
    }
  }

  console.log();
  console.log('=== Summary ===');
  if (DRY_RUN) {
    console.log(`Would process: ${total} fact(s)`);
  } else {
    console.log(`Success: ${successCount}`);
    console.log(`Failed:  ${failCount}`);
    console.log(`Unsafe:  ${skippedUnsafe}`);
    console.log(`Files modified: ${modifiedFiles.size}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
