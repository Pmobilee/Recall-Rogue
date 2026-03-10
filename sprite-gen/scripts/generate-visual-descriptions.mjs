#!/usr/bin/env node
/**
 * Generate visual descriptions for facts missing them.
 * Uses Claude API (requires ANTHROPIC_API_KEY in environment).
 *
 * Supports two modes:
 *   - Single mode: one API call per fact (default, or <10 facts with --language)
 *   - Batch mode:  10 facts per API call with cultural theming (--language + ≥10 facts)
 *
 * Usage:
 *   node generate-visual-descriptions.mjs                    # Process all missing
 *   node generate-visual-descriptions.mjs --dry-run          # Show what would be generated
 *   node generate-visual-descriptions.mjs --limit 10         # Process at most 10
 *   node generate-visual-descriptions.mjs --file vocab-n3    # Only process matching file
 *   node generate-visual-descriptions.mjs --reset            # Clear checkpoint, force regeneration
 *   node generate-visual-descriptions.mjs --language ja      # Japanese cultural theming (batch)
 *   node generate-visual-descriptions.mjs --analyze          # Print element frequency table
 *   node generate-visual-descriptions.mjs --regenerate-all   # Null all existing descriptions first
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths & constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '../../src/data/seed');
const CHECKPOINT_PATH = join(__dirname, '.vd-checkpoint.json');
const SETTINGS_PATH = join(__dirname, 'setting-assignments.json');
const LANG_CONFIG_DIR = join(__dirname, 'language-configs');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 10;
const MAX_TOKENS_BATCH = 1500;
const MAX_TOKENS_SINGLE = 100;
const RATE_LIMIT_MS = 7000;
const RETRY_DELAY_MS = 30000;
const OVERUSE_THRESHOLD = 0.10; // 10%
const LOCAL_PAID_LLM_SCRIPTS_DISABLED = true;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESET = args.includes('--reset');
const ANALYZE = args.includes('--analyze');
const REGENERATE_ALL = args.includes('--regenerate-all');

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

const GENERIC_FANTASY_PATTERNS = [
  /\bglowing\s+orb(s)?\b/i,
  /\bmagic\s+portal(s)?\b/i,
  /\bmystic\s+rune(s)?\b/i,
  /\bspell\s+circle(s)?\b/i,
  /\barcane\s+sigil(s)?\b/i,
];

const OFFENSIVE_STEREOTYPE_PATTERNS = [
  /\bexotic\s+orient(al)?\b/i,
  /\bprimitive\s+tribe\b/i,
  /\bbarbaric\b/i,
  /\bsavage\b/i,
];

/**
 * Validate a generated visual description for content safety.
 * @param {string} text
 * @param {object} [opts]
 * @param {object} [opts.languageConfig]
 * @param {string} [opts.language]
 * @returns {{ safe: boolean, reason?: string }}
 */
function validateDescription(text, opts = {}) {
  const trimmed = String(text ?? '').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lower = trimmed.toLowerCase();

  for (const pattern of BLOCKLIST) {
    if (pattern.test(trimmed)) return { safe: false, reason: pattern.toString() };
  }

  for (const pattern of OFFENSIVE_STEREOTYPE_PATTERNS) {
    if (pattern.test(trimmed)) return { safe: false, reason: 'offensive_stereotype' };
  }

  if (words.length < 15) return { safe: false, reason: 'too_short_words' };
  if (trimmed.length > 450) return { safe: false, reason: 'too_long' };

  const languageConfig = opts.languageConfig;
  if (languageConfig) {
    const markerKeywords = Array.isArray(languageConfig.elementKeywords)
      ? languageConfig.elementKeywords
      : [];
    const hasCulturalMarker = markerKeywords.some((keyword) =>
      lower.includes(String(keyword).toLowerCase()),
    );
    const hasGenericFantasyPattern = GENERIC_FANTASY_PATTERNS.some((pattern) => pattern.test(trimmed));

    if (!hasCulturalMarker) {
      return { safe: false, reason: `missing_cultural_marker:${opts.language ?? 'lang'}` };
    }
    if (hasGenericFantasyPattern) {
      return { safe: false, reason: 'generic_fantasy_pattern' };
    }
  }

  return { safe: true };
}

// ---------------------------------------------------------------------------
// System prompt (single mode / no-language mode)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You write hyper-literal visual scene descriptions for pixel art card illustrations in a knowledge card game called Recall Rogue.

Given a learning fact, write a single-sentence visual description (20-40 words) that depicts the fact AS IF IT IS PHYSICALLY HAPPENING right now.

HYPER-LITERAL RULES:
- Show the SPECIFIC CLAIM of the fact in action — not just the subject, but the exact detail
- If the fact says "X has property Y" → show X actively demonstrating/acquiring property Y
- If the fact says "X did Y" → show X in the physical act of doing Y
- Every object, body position, and spatial relationship must be concrete and unambiguous
- A viewer who knows the fact should INSTANTLY recognize it; a viewer who doesn't should be intrigued
- Describe exact physical details: what is being held, how hands are positioned, what is broken/open/moving
- NO metaphor, NO mood descriptions, NO abstract concepts — only physical reality
- NO text, NO labels, NO numbers, NO writing, NO letters, NO symbols anywhere in the scene
- NO realistic human faces (historical figures OK if stylized/symbolic as pixel art characters)
- NO political symbols, religious controversy, or disputed territories
- NO violence beyond fantasy, NO sexual content
- Vivid colors, dramatic moment frozen in time
- Subject fills 80% of frame with breathing room at edges

GOOD hyper-literal examples:
- Fact: "The Mona Lisa has no eyebrows" → "A woman in Renaissance dress seated before a mirror carefully shaving off her eyebrows with a small blade, her reflection showing a smooth browless forehead, a painting easel visible behind her"
- Fact: "Honey never spoils" → "An ancient Egyptian clay jar being cracked open to reveal perfectly golden liquid honey inside, hieroglyphic tomb walls visible behind, the honey gleaming fresh despite dusty surroundings"
- Fact: "Octopuses have three hearts" → "A large octopus with its chest cavity dramatically opened like an anatomy display, three distinct glowing red hearts visible beating inside, tentacles spread wide, underwater coral background"
- Fact: "The Eiffel Tower grows 6 inches in summer" → "The Eiffel Tower visibly stretching taller with a measuring tape running up its side, a bright summer sun beating down, heat shimmer waves rising from the metal, a small figure below looking up in surprise"

BAD examples (too vague, not depicting the specific claim):
- "The Mona Lisa has no eyebrows" → "A mysterious painting in a golden frame" (WHERE are the missing eyebrows?)
- "Honey never spoils" → "A golden honeycomb glowing warmly" (nothing about it NOT spoiling)

Return ONLY the visual description string. No JSON, no quotes, no explanation.`;

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

/**
 * Create a seeded PRNG using the mulberry32 algorithm.
 * @param {number} seed
 * @returns {() => number} Returns values in [0, 1)
 */
function seededRandom(seed) {
  let t = seed + 0x6D2B79F5;
  return function () {
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Simple string hash to derive a numeric seed from a fact ID.
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {number} ms */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Checkpoint
// ---------------------------------------------------------------------------

/** @returns {Promise<Set<string>>} */
async function loadCheckpoint() {
  if (RESET) return new Set();
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
// Setting assignments (persistent)
// ---------------------------------------------------------------------------

/** @returns {Promise<Record<string, number>>} */
async function loadSettingAssignments() {
  try {
    const data = await readFile(SETTINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/** @param {Record<string, number>} assignments */
async function saveSettingAssignments(assignments) {
  await writeFile(SETTINGS_PATH, JSON.stringify(assignments, null, 2) + '\n');
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
// Language config loading
// ---------------------------------------------------------------------------

/**
 * Load a language config from ./language-configs/{lang}.json
 * @param {string} lang
 * @returns {Promise<object>}
 */
async function loadLanguageConfig(lang) {
  const configPath = join(LANG_CONFIG_DIR, `${lang}.json`);
  try {
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to load language config for "${lang}" at ${configPath}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Setting assignment algorithm
// ---------------------------------------------------------------------------

/**
 * Assign each fact to a setting index using seeded shuffle-and-deal.
 * Existing assignments from disk are preserved; only new facts get assigned.
 *
 * @param {Array<{ id: string }>} facts
 * @param {Array<{ anchor: string, zone: string }>} settings
 * @param {Record<string, number>} existingAssignments
 * @returns {Record<string, number>} Updated assignments map (factId -> settingIndex)
 */
function assignSettings(facts, settings, existingAssignments) {
  const assignments = { ...existingAssignments };
  const unassigned = facts.filter(f => !(f.id in assignments));

  if (unassigned.length === 0) return assignments;

  // Seed from hash of first unassigned fact ID
  const seed = hashString(unassigned[0].id);
  const rng = seededRandom(seed);

  // Create enough copies of the settings indices to cover all unassigned facts
  const copies = Math.ceil(unassigned.length / settings.length);
  const pool = [];
  for (let c = 0; c < copies; c++) {
    for (let s = 0; s < settings.length; s++) {
      pool.push(s);
    }
  }

  // Fisher-Yates shuffle with seeded RNG
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Zip: fact[i] -> pool[i]
  for (let i = 0; i < unassigned.length; i++) {
    assignments[unassigned[i].id] = pool[i];
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Element frequency tracking
// ---------------------------------------------------------------------------

/**
 * Count keyword frequencies across all descriptions.
 * @param {string[]} descriptions
 * @param {string[]} keywords
 * @returns {Map<string, number>} keyword -> count
 */
function countKeywordFrequencies(descriptions, keywords) {
  /** @type {Map<string, number>} */
  const freq = new Map();
  for (const kw of keywords) freq.set(kw, 0);

  const lowerDescs = descriptions.map(d => d.toLowerCase());
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    for (const desc of lowerDescs) {
      if (desc.includes(kwLower)) {
        freq.set(kw, freq.get(kw) + 1);
      }
    }
  }
  return freq;
}

/**
 * Build an avoid list of overused elements.
 * @param {string[]} descriptions - All descriptions generated so far
 * @param {string[]} keywords - Element keywords to track
 * @returns {string[]} Avoid list entries like "lantern (42/400)"
 */
function buildAvoidList(descriptions, keywords) {
  if (descriptions.length === 0) return [];
  const freq = countKeywordFrequencies(descriptions, keywords);
  const threshold = Math.floor(descriptions.length * OVERUSE_THRESHOLD);
  const avoid = [];
  for (const [kw, count] of freq) {
    if (count > threshold) {
      avoid.push(`${kw} (${count}/${descriptions.length})`);
    }
  }
  return avoid.sort((a, b) => {
    const countA = parseInt(a.match(/\((\d+)\//)?.[1] || '0');
    const countB = parseInt(b.match(/\((\d+)\//)?.[1] || '0');
    return countB - countA;
  });
}

// ---------------------------------------------------------------------------
// Batch category rotation
// ---------------------------------------------------------------------------

/**
 * Select 3-4 element categories for a given batch index.
 * @param {Record<string, string[]>} elementCategories
 * @param {number} batchIndex
 * @returns {Record<string, string[]>} Subset of categories
 */
function selectBatchCategories(elementCategories, batchIndex) {
  const categoryNames = Object.keys(elementCategories);
  const numCategories = categoryNames.length;
  // Alternate between 3 and 4 categories
  const pickCount = (batchIndex % 2 === 0) ? 3 : 4;
  const startIdx = (batchIndex * 3) % numCategories;

  const selected = {};
  for (let i = 0; i < pickCount; i++) {
    const idx = (startIdx + i) % numCategories;
    const name = categoryNames[idx];
    selected[name] = elementCategories[name];
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Claude API — single mode
// ---------------------------------------------------------------------------

const API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Build single-mode system prompt.
 * @param {object | null} config
 * @returns {string}
 */
function buildSingleSystemPrompt(config) {
  if (!config) return SYSTEM_PROMPT;

  return `${SYSTEM_PROMPT}

Language theming requirements (strict):
- Scene must clearly reflect: ${config.baseTheme}
- Palette cues: ${config.palette}
- Include at least one culturally specific marker naturally in-scene (architecture, setting, object, flora/fauna, or craft detail).
- Avoid generic fantasy motifs (glowing orbs, magic portals, abstract runes) unless explicitly grounded in the target culture.`;
}

/**
 * Call Claude API to generate a visual description for one fact.
 * @param {{ statement: string, category: string[], type: string }} fact
 * @param {object | null} config
 * @returns {Promise<string>}
 */
async function generateDescriptionSingle(fact, config = null) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY environment variable is required');

  const userPrompt = [
    `Fact: ${fact.statement}`,
    `Category: ${fact.category[0]}${fact.category[1] ? ' > ' + fact.category[1] : ''}`,
    `Type: ${fact.type}`,
  ].join('\n');

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS_SINGLE,
    system: buildSingleSystemPrompt(config),
    messages: [{ role: 'user', content: userPrompt }],
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * attempt;
      console.log(`  Retrying after ${delay / 1000}s (attempt ${attempt + 1}/3)...`);
      await sleep(delay);
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
      if (!text) throw new Error('Empty response from API');
      return text;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Claude API — batch mode
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for a batch API call.
 * @param {object} config - Language config
 * @param {Record<string, string[]>} selectedCategories - Categories for this batch
 * @param {string[]} avoidList - Overused element strings
 * @param {number} count - Number of facts in the batch
 * @returns {string}
 */
function buildBatchSystemPrompt(config, selectedCategories, avoidList, count) {
  let prompt = `You write hyper-literal visual scene descriptions for pixel art card illustrations in a knowledge card game.

For each vocabulary word below, depict its meaning AS A PHYSICAL ACTION OR STATE happening right now. The scene must be so specific and concrete that a viewer could GUESS the word just by looking.

HYPER-LITERAL RULES:
- Show the EXACT MEANING through unambiguous physical action, body language, and spatial relationships
- Every object, gesture, and position must be concrete — describe what hands are doing, what is being held, what direction things move
- For verbs: show someone DOING the action with clear before/after visual evidence
- For nouns: show the thing being USED, ENCOUNTERED, or DEMONSTRATED in its most recognizable context
- For adjectives: show something BEING that quality in an obvious, exaggerated way
- Include 1-2 distinctly ${config.baseTheme} visual elements (architecture, clothing, nature) as background flavor
- The word meaning is the STAR — background setting is just cultural flavor
- Each description: 20-40 words, one sentence, extremely concrete and physical
- Absolutely NO text, NO writing, NO letters, NO numbers, NO kanji, NO kana, NO symbols, NO script of any kind in the scene
- No realistic human faces (stylized pixel art people OK)
- No violence beyond fantasy, no sexual content

GOOD hyper-literal examples (specific physical action depicting the word):
- "to deliver" → A courier in a happi coat extending both arms to hand a large wrapped package to a merchant whose hands reach forward to receive it, a delivery cart with more boxes behind, cherry blossoms falling
- "to apologize" → A person with closed eyes bowing deeply with both hands pressed together in front of their chest, a broken ceramic vase lying in pieces on the floor beside them, guilt visible in hunched shoulders
- "scenery" → A stunning panoramic mountain vista seen through a natural stone torii gate, rolling green hills with a winding river below, dramatic colorful sunset sky with layers of clouds
- "to increase" → A merchant's abacus with beads being rapidly pushed upward as stacks of gold coins grow visibly taller on the wooden counter, coins still falling from above into the growing piles
- "rather/instead" → A person at a crossroads dramatically turning their whole body away from one path and striding decisively toward the other path, one hand pointing firmly at their chosen direction

BAD examples (too vague — viewer CANNOT guess the word):
- "to give up" → "A lighthouse keeper gazes at sunset" (HOW is this giving up? Show someone dropping something, walking away, hands releasing)
- "investigation" → "Storm-tossed fishing net on a dock" (NOTHING about investigating)
- "meaning" → "Alpine shrine gate emerging from mist" (vague mood, no concept shown)

COLOR PALETTE: ${config.palette}`;

  prompt += `\n\nAVAILABLE CULTURAL ELEMENTS (use 1-2 per description to add ${config.baseTheme} flavor):`;

  for (const [category, items] of Object.entries(selectedCategories)) {
    prompt += `\n- ${category.charAt(0).toUpperCase() + category.slice(1)}: ${items.join(', ')}`;
  }

  if (avoidList.length > 0) {
    prompt += `\n\nAVOID these overused elements: ${avoidList.join(', ')}`;
  }

  prompt += `\n\nReturn EXACTLY ${count} lines, numbered 1-${count}. Each line is ONLY the description text (no quotes, no JSON).`;

  return prompt;
}

/**
 * Build the user prompt for a batch API call.
 * @param {Array<{ fact: any, settingAnchor: string }>} batchItems
 * @returns {string}
 */
function buildBatchUserPrompt(batchItems) {
  return batchItems
    .map((item, i) => `${i + 1}. Word meaning: "${item.fact.statement}" | Background hint: ${item.settingAnchor}`)
    .join('\n');
}

/**
 * Call Claude API with a batch of facts, returning an array of descriptions.
 * @param {Array<{ fact: any, settingAnchor: string }>} batchItems
 * @param {object} config - Language config
 * @param {Record<string, string[]>} selectedCategories
 * @param {string[]} avoidList
 * @param {object} validationOptions
 * @returns {Promise<(string|null)[]>} Array with descriptions or null for failed lines
 */
async function generateDescriptionsBatch(batchItems, config, selectedCategories, avoidList, validationOptions) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY environment variable is required');

  const systemPrompt = buildBatchSystemPrompt(config, selectedCategories, avoidList, batchItems.length);
  const userPrompt = buildBatchUserPrompt(batchItems);

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS_BATCH,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log(`  Retrying batch after ${RETRY_DELAY_MS}ms...`);
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
      if (!text) throw new Error('Empty response from API');
      return parseBatchResponse(text, batchItems.length, validationOptions);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Batch response parsing
// ---------------------------------------------------------------------------

/**
 * Parse a numbered-list batch response into individual descriptions.
 * @param {string} text - Raw response text
 * @param {number} expectedCount
 * @returns {(string|null)[]} Array of descriptions; null for unparseable/invalid lines
 */
function parseBatchResponse(text, expectedCount) {
  // Split by numbered lines: "1. ...", "2) ...", etc.
  const lines = text.split(/^\d+[\.\)]\s*/m).filter(l => l.trim().length > 0);
  const results = [];

  for (let i = 0; i < expectedCount; i++) {
    if (i < lines.length) {
      const trimmed = lines[i].trim().replace(/^["']|["']$/g, '');
      const validation = validateDescription(trimmed);
      if (validation.safe && trimmed.length >= 20 && trimmed.length <= 300) {
        results.push(trimmed);
      } else {
        results.push(null);
      }
    } else {
      results.push(null);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// --regenerate-all: null out existing visualDescriptions
// ---------------------------------------------------------------------------

/**
 * Null out all visualDescription fields in the given files.
 * @param {string[]} jsonFiles
 * @returns {Promise<number>} Number of descriptions cleared
 */
async function nullAllDescriptions(jsonFiles) {
  let cleared = 0;
  for (const file of jsonFiles) {
    const raw = await readFile(file, 'utf-8');
    const facts = JSON.parse(raw);
    if (!Array.isArray(facts)) continue;

    let modified = false;
    for (const fact of facts) {
      if (fact.visualDescription) {
        fact.visualDescription = null;
        modified = true;
        cleared++;
      }
    }
    if (modified) {
      await writeFile(file, JSON.stringify(facts, null, 2) + '\n');
    }
  }
  return cleared;
}

// ---------------------------------------------------------------------------
// --analyze: element frequency analysis
// ---------------------------------------------------------------------------

/**
 * Run the analyze command: print element frequency and diversity stats.
 * @param {string[]} jsonFiles
 */
async function runAnalyze(jsonFiles) {
  // Load language config
  if (!LANGUAGE) {
    console.error('Error: --analyze requires --language to know which keywords to check');
    process.exit(1);
  }

  const config = await loadLanguageConfig(LANGUAGE);
  const keywords = config.elementKeywords || [];

  // Collect all descriptions
  const descriptions = [];
  const allFacts = [];
  for (const file of jsonFiles) {
    const raw = await readFile(file, 'utf-8');
    const facts = JSON.parse(raw);
    if (!Array.isArray(facts)) continue;
    for (const fact of facts) {
      if (fact.visualDescription) {
        descriptions.push(fact.visualDescription);
      }
      if (fact.id) allFacts.push(fact);
    }
  }

  console.log(`\n=== Element Frequency Analysis (${LANGUAGE}) ===`);
  console.log(`Total facts: ${allFacts.length}`);
  console.log(`Facts with descriptions: ${descriptions.length}`);
  console.log(`Facts without descriptions: ${allFacts.length - descriptions.length}\n`);

  if (descriptions.length === 0) {
    console.log('No descriptions to analyze.');
    return;
  }

  // Keyword frequency table
  const freq = countKeywordFrequencies(descriptions, keywords);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);

  const threshold = Math.floor(descriptions.length * OVERUSE_THRESHOLD);

  console.log('--- Element Frequency Table ---');
  console.log(`${'Keyword'.padEnd(25)} ${'Count'.padStart(6)} ${'%'.padStart(7)}  Status`);
  console.log('-'.repeat(55));

  let overused = 0;
  let used = 0;
  for (const [kw, count] of sorted) {
    if (count === 0) continue;
    used++;
    const pct = ((count / descriptions.length) * 100).toFixed(1);
    const status = count > threshold ? 'OVERUSED' : '';
    if (count > threshold) overused++;
    console.log(`${kw.padEnd(25)} ${String(count).padStart(6)} ${(pct + '%').padStart(7)}  ${status}`);
  }

  const unused = keywords.length - used;
  console.log(`\nUsed keywords: ${used}/${keywords.length}`);
  console.log(`Unused keywords: ${unused}`);
  console.log(`Overused (>${(OVERUSE_THRESHOLD * 100).toFixed(0)}%): ${overused}`);

  // Diversity score: % of used keywords under threshold
  const underThreshold = used - overused;
  const diversityScore = used > 0 ? ((underThreshold / used) * 100).toFixed(1) : '0.0';
  console.log(`\nDiversity score: ${diversityScore}% (keywords under ${(OVERUSE_THRESHOLD * 100).toFixed(0)}% threshold)`);

  // Zone distribution from setting assignments
  try {
    const assignments = await loadSettingAssignments();
    const assignedCount = Object.keys(assignments).length;
    if (assignedCount > 0 && config.settings) {
      console.log(`\n--- Zone Distribution (${assignedCount} assignments) ---`);
      /** @type {Map<string, number>} */
      const zoneCounts = new Map();
      for (const settingIdx of Object.values(assignments)) {
        const setting = config.settings[settingIdx];
        if (setting) {
          const zone = setting.zone;
          zoneCounts.set(zone, (zoneCounts.get(zone) || 0) + 1);
        }
      }
      const sortedZones = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]);
      for (const [zone, count] of sortedZones) {
        const pct = ((count / assignedCount) * 100).toFixed(1);
        console.log(`  ${zone.padEnd(15)} ${String(count).padStart(5)} (${pct}%)`);
      }
    }
  } catch {
    // No assignments file, skip
  }
}

// ---------------------------------------------------------------------------
// Processing: single mode
// ---------------------------------------------------------------------------

/**
 * Process facts one at a time (no language config or <10 facts).
 * @param {Array<{ file: string, index: number, fact: any }>} items
 * @param {Set<string>} processed
 * @returns {Promise<{ success: number, failed: number, unsafe: number, modifiedFiles: Set<string> }>}
 */
async function processSingleMode(items, processed) {
  /** @type {Map<string, any[]>} */
  const modifiedFiles = new Map();
  let success = 0;
  let failed = 0;
  let unsafe = 0;

  for (let i = 0; i < items.length; i++) {
    const { file, fact } = items[i];
    const relFile = relative(SEED_DIR, file);
    const prefix = `[${i + 1}/${items.length}] ${fact.id}`;

    try {
      const description = await generateDescriptionSingle(fact);
      const validation = validateDescription(description);

      if (!validation.safe) {
        console.log(`${prefix}: UNSAFE (${validation.reason}) — "${description.substring(0, 60)}..."`);
        unsafe++;
        processed.add(fact.id);
        await saveCheckpoint(processed);
        continue;
      }

      // Load file data if not already cached
      if (!modifiedFiles.has(file)) {
        const raw = await readFile(file, 'utf-8');
        modifiedFiles.set(file, JSON.parse(raw));
      }

      const fileData = modifiedFiles.get(file);
      const targetFact = fileData.find(f => f.id === fact.id);
      if (targetFact) targetFact.visualDescription = description;

      await writeFile(file, JSON.stringify(fileData, null, 2) + '\n');
      processed.add(fact.id);
      await saveCheckpoint(processed);

      success++;
      console.log(`${prefix}: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`);

      if (i < items.length - 1) await sleep(RATE_LIMIT_MS);
    } catch (err) {
      failed++;
      console.error(`${prefix}: ERROR — ${err.message}`);
    }
  }

  return { success, failed, unsafe, modifiedFiles: new Set(modifiedFiles.keys()) };
}

// ---------------------------------------------------------------------------
// Processing: batch mode
// ---------------------------------------------------------------------------

/**
 * Process facts in batches of BATCH_SIZE with cultural theming.
 * @param {Array<{ file: string, index: number, fact: any }>} items
 * @param {Set<string>} processed
 * @param {object} config - Language config
 * @param {Record<string, number>} settingAssignments
 * @param {string} language
 * @returns {Promise<{ success: number, failed: number, unsafe: number, modifiedFiles: Set<string> }>}
 */
async function processBatchMode(items, processed, config, settingAssignments, language) {
  /** @type {Map<string, any[]>} */
  const modifiedFiles = new Map();
  let success = 0;
  let failed = 0;
  let unsafe = 0;

  // Track all descriptions generated so far (for frequency analysis)
  const allDescriptions = [];

  const keywords = config.elementKeywords || [];
  const totalBatches = Math.ceil(items.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, items.length);
    const batchItems = items.slice(batchStart, batchEnd);

    console.log(`\n--- Batch ${batchIdx + 1}/${totalBatches} (${batchItems.length} facts) ---`);

    // Select rotating categories for this batch
    const selectedCategories = selectBatchCategories(config.elementCategories, batchIdx);
    console.log(`  Categories: ${Object.keys(selectedCategories).join(', ')}`);

    // Build avoid list from descriptions so far
    const avoidList = buildAvoidList(allDescriptions, keywords);
    if (avoidList.length > 0) {
      console.log(`  Avoiding ${avoidList.length} overused elements`);
    }

    // Prepare batch items with setting anchors
    const batchWithSettings = batchItems.map(item => {
      const settingIdx = settingAssignments[item.fact.id] ?? 0;
      const setting = config.settings[settingIdx] || config.settings[0];
      return { fact: item.fact, settingAnchor: setting.anchor, file: item.file };
    });

    if (DRY_RUN) {
      for (const item of batchWithSettings) {
        console.log(`  ${item.fact.id}: "${item.fact.statement.substring(0, 50)}..." → ${item.settingAnchor}`);
      }
      continue;
    }

    try {
      const descriptions = await generateDescriptionsBatch(
        batchWithSettings,
        config,
        selectedCategories,
        avoidList,
        { languageConfig: config, language },
      );

      // Process each result
      for (let j = 0; j < batchItems.length; j++) {
        const { file, fact } = batchItems[j];
        const prefix = `  [${batchStart + j + 1}/${items.length}] ${fact.id}`;
        let description = descriptions[j];

        // If batch line failed, try single-call fallback
        if (!description) {
          console.log(`${prefix}: batch line failed, trying single fallback...`);
          try {
            description = await generateDescriptionSingle(fact, config);
            const validation = validateDescription(description, { languageConfig: config, language });
            if (!validation.safe) {
              console.log(`${prefix}: UNSAFE (${validation.reason})`);
              unsafe++;
              processed.add(fact.id);
              await saveCheckpoint(processed);
              continue;
            }
          } catch (err) {
            failed++;
            console.error(`${prefix}: FALLBACK ERROR — ${err.message}`);
            continue;
          }
          await sleep(RATE_LIMIT_MS);
        }

        // Load file data if not cached
        if (!modifiedFiles.has(file)) {
          const raw = await readFile(file, 'utf-8');
          modifiedFiles.set(file, JSON.parse(raw));
        }

        const fileData = modifiedFiles.get(file);
        const targetFact = fileData.find(f => f.id === fact.id);
        if (targetFact) targetFact.visualDescription = description;

        await writeFile(file, JSON.stringify(fileData, null, 2) + '\n');
        processed.add(fact.id);
        await saveCheckpoint(processed);

        allDescriptions.push(description);
        success++;
        console.log(`${prefix}: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`);
      }
    } catch (err) {
      // Entire batch failed — fall back to single mode for this batch
      console.error(`  Batch failed: ${err.message} — falling back to single mode`);
      for (let j = 0; j < batchItems.length; j++) {
        const { file, fact } = batchItems[j];
        const prefix = `  [${batchStart + j + 1}/${items.length}] ${fact.id}`;

        try {
          const description = await generateDescriptionSingle(fact, config);
          const validation = validateDescription(description, { languageConfig: config, language });

          if (!validation.safe) {
            console.log(`${prefix}: UNSAFE (${validation.reason})`);
            unsafe++;
            processed.add(fact.id);
            await saveCheckpoint(processed);
            continue;
          }

          if (!modifiedFiles.has(file)) {
            const raw = await readFile(file, 'utf-8');
            modifiedFiles.set(file, JSON.parse(raw));
          }

          const fileData = modifiedFiles.get(file);
          const targetFact = fileData.find(f => f.id === fact.id);
          if (targetFact) targetFact.visualDescription = description;

          await writeFile(file, JSON.stringify(fileData, null, 2) + '\n');
          processed.add(fact.id);
          await saveCheckpoint(processed);

          allDescriptions.push(description);
          success++;
          console.log(`${prefix}: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`);
          await sleep(RATE_LIMIT_MS);
        } catch (singleErr) {
          failed++;
          console.error(`${prefix}: ERROR — ${singleErr.message}`);
        }
      }
    }

    // Rate limit between batches
    if (batchIdx < totalBatches - 1) await sleep(RATE_LIMIT_MS);
  }

  return { success, failed, unsafe, modifiedFiles: new Set(modifiedFiles.keys()) };
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
  if (ANALYZE) console.log('  Mode: ANALYZE (frequency analysis only)');
  if (REGENERATE_ALL) console.log('  Mode: REGENERATE ALL (clearing existing descriptions)');
  console.log();

  if (!DRY_RUN && LOCAL_PAID_LLM_SCRIPTS_DISABLED) {
    console.error('Error: Paid LLM visual-description generation is disabled in this repository. Use --dry-run and external Claude workers for live generation.');
    process.exit(1);
  }

  // Discover JSON files
  let jsonFiles = await findJsonFiles(SEED_DIR);
  if (FILE_FILTER) {
    jsonFiles = jsonFiles.filter(f => basename(f, '.json').includes(FILE_FILTER));
  }
  console.log(`Found ${jsonFiles.length} seed file(s)\n`);

  // --analyze: just print stats and exit
  if (ANALYZE) {
    await runAnalyze(jsonFiles);
    return;
  }

  // --regenerate-all: null out all existing descriptions
  if (REGENERATE_ALL) {
    const cleared = await nullAllDescriptions(jsonFiles);
    console.log(`Cleared ${cleared} existing visual description(s)\n`);
  }

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

  const toProcess = missing.slice(0, total);

  // Decide mode: batch (language + ≥10 facts) or single
  const useBatchMode = LANGUAGE && total >= 10;
  let result;
  const languageConfig = LANGUAGE ? await loadLanguageConfig(LANGUAGE) : null;

  if (useBatchMode) {
    console.log(`Using BATCH mode (${BATCH_SIZE} facts/call, language: ${LANGUAGE})\n`);

    const config = languageConfig;
    const existingAssignments = await loadSettingAssignments();
    const factList = toProcess.map(m => m.fact);
    const assignments = assignSettings(factList, config.settings, existingAssignments);
    await saveSettingAssignments(assignments);
    console.log(`Setting assignments: ${Object.keys(assignments).length} total (${factList.length} new)\n`);

    if (DRY_RUN) {
      // Dry-run preview for batch mode
      for (let i = 0; i < toProcess.length; i++) {
        const { fact } = toProcess[i];
        const settingIdx = assignments[fact.id] ?? 0;
        const setting = config.settings[settingIdx] || config.settings[0];
        console.log(`[${i + 1}/${total}] ${fact.id}: "${fact.statement.substring(0, 50)}..." → ${setting.anchor} (${setting.zone})`);
      }
      console.log(`\nWould process: ${total} fact(s) in ${Math.ceil(total / BATCH_SIZE)} batch(es)`);
      return;
    }

    result = await processBatchMode(toProcess, processed, config, assignments, LANGUAGE);
  } else {
    if (LANGUAGE) {
      console.log(`Using SINGLE mode (${total} facts < ${BATCH_SIZE} threshold for batch)\n`);
    } else {
      console.log('Using SINGLE mode\n');
    }

    if (DRY_RUN) {
      for (let i = 0; i < toProcess.length; i++) {
        const { file, fact } = toProcess[i];
        const relFile = relative(SEED_DIR, file);
        console.log(`[${i + 1}/${total}] ${fact.id}: (${relFile}) "${fact.statement.substring(0, 60)}..."`);
      }
      console.log(`\nWould process: ${total} fact(s)`);
      return;
    }

    result = await processSingleMode(toProcess, processed, languageConfig, LANGUAGE);
  }

  console.log();
  console.log('=== Summary ===');
  console.log(`Success: ${result.success}`);
  console.log(`Failed:  ${result.failed}`);
  console.log(`Unsafe:  ${result.unsafe}`);
  console.log(`Files modified: ${result.modifiedFiles.size}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
