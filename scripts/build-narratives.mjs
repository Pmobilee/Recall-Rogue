/**
 * build-narratives.mjs
 *
 * Converts all YAML narrative files from data/narratives/ to JSON files in
 * public/data/narratives/, mirroring the directory structure. Also writes
 * a manifest.json listing all output files for the runtime loader.
 *
 * Run: node scripts/build-narratives.mjs
 * npm script: narratives:build
 *
 * Output format mirrors the YAML input but with snake_case keys normalized
 * to camelCase where the TypeScript interfaces require it.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { load } from 'js-yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const INPUT_DIR = join(ROOT, 'data/narratives');
const OUTPUT_DIR = join(ROOT, 'public/data/narratives');

// ============================================================
// KEY NORMALISATION
// Converts snake_case YAML keys to camelCase TypeScript keys.
// ============================================================

/** Fields that need snake_case → camelCase normalisation. */
const KEY_MAP = {
  deck_categories: 'deckCategories',
  min_gravity: 'minGravity',
  relic_id: 'relicId',
  lens_id: 'lensId',
};

/**
 * Recursively normalise snake_case keys in a parsed YAML object
 * to the camelCase keys expected by the TypeScript interfaces.
 * @param {unknown} value
 * @returns {unknown}
 */
function normaliseKeys(value) {
  if (Array.isArray(value)) {
    return value.map(normaliseKeys);
  }
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const mapped = KEY_MAP[k] ?? k;
      out[mapped] = normaliseKeys(v);
    }
    return out;
  }
  return value;
}

// ============================================================
// DOMAIN-SPECIFIC TRANSFORMS
// Each YAML category has a slightly different shape; these
// functions normalise them to match the TS interface shapes.
// ============================================================

/**
 * Normalise a greeting map from the merchant/inhabitant format.
 * YAML uses { 1: "text", 2: "text", default: "text" }
 * TS expects InhabitantGreeting[]: [{ visitNumber: 1|'default', text }]
 * @param {Record<string|number, string>} greetingMap
 * @returns {Array<{visitNumber: number|'default', text: string}>}
 */
function normaliseGreeting(greetingMap) {
  if (Array.isArray(greetingMap)) return greetingMap; // already normalised
  const result = [];
  for (const [key, text] of Object.entries(greetingMap)) {
    result.push({
      visitNumber: key === 'default' ? 'default' : Number(key),
      text,
    });
  }
  return result;
}

/**
 * Transform a parsed inhabitant YAML object to match InhabitantDialogue.
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
function transformInhabitant(raw) {
  const normalised = normaliseKeys(raw);
  if (normalised.greeting && !Array.isArray(normalised.greeting)) {
    normalised.greeting = normaliseGreeting(normalised.greeting);
  }
  // state_reactive → stateReactive already handled by normaliseKeys? No — it's snake_case
  if (normalised.state_reactive !== undefined) {
    normalised.stateReactive = normalised.state_reactive;
    delete normalised.state_reactive;
  }
  return normalised;
}

/**
 * Transform a parsed echo YAML file.
 * YAML: { type, templates: [...] }
 * Result: { type, templates: EchoTemplate[] }
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
function transformEcho(raw) {
  return normaliseKeys(raw);
}

/**
 * Transform a parsed seeker YAML file.
 * Seeker files have: { category, lines: SeekerLine[] } or { category: relic_callbacks, lines: RelicCallback[] }
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
function transformSeeker(raw) {
  return normaliseKeys(raw);
}

/**
 * Transform a parsed ambient YAML file.
 * YAML: { lens_id, lines: AmbientLine[] }
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
function transformAmbient(raw) {
  return normaliseKeys(raw);
}

/**
 * Transform based on directory.
 * @param {string} dir - one of: archetypes, lenses, echoes, inhabitants, seeker, ambient
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
function transformForDirectory(dir, raw) {
  switch (dir) {
    case 'inhabitants':
      return transformInhabitant(raw);
    case 'echoes':
      return transformEcho(raw);
    case 'seeker':
      return transformSeeker(raw);
    case 'ambient':
      return transformAmbient(raw);
    default:
      // archetypes and lenses — standard key normalisation
      return normaliseKeys(raw);
  }
}

// ============================================================
// FILE DISCOVERY
// ============================================================

/**
 * Recursively collect all .yaml files under a directory.
 * @param {string} dir
 * @returns {string[]} Absolute file paths
 */
function collectYamlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectYamlFiles(fullPath));
    } else if (extname(entry) === '.yaml' || extname(entry) === '.yml') {
      files.push(fullPath);
    }
  }
  return files;
}

// ============================================================
// BUILD
// ============================================================

/**
 * Convert all YAML files and write manifest.
 */
function build() {
  const yamlFiles = collectYamlFiles(INPUT_DIR);

  if (yamlFiles.length === 0) {
    console.error('[narratives] No YAML files found under', INPUT_DIR);
    process.exit(1);
  }

  /** @type {string[]} Relative paths to JSON output (for manifest) */
  const manifestEntries = [];
  let converted = 0;
  let errors = 0;

  for (const srcPath of yamlFiles) {
    const relPath = relative(INPUT_DIR, srcPath);
    // e.g. "archetypes/lost_archive.yaml"
    const jsonRelPath = relPath.replace(/\.ya?ml$/, '.json');
    const outPath = join(OUTPUT_DIR, jsonRelPath);
    // Subdirectory name (first segment)
    const subDir = relPath.split('/')[0];

    // Ensure output directory exists
    const outDirPath = join(OUTPUT_DIR, subDir);
    mkdirSync(outDirPath, { recursive: true });

    try {
      const yamlText = readFileSync(srcPath, 'utf-8');
      const raw = load(yamlText);
      const transformed = transformForDirectory(subDir, raw);
      writeFileSync(outPath, JSON.stringify(transformed, null, 2), 'utf-8');
      manifestEntries.push(jsonRelPath);
      converted++;
    } catch (err) {
      console.error(`[narratives] Failed to convert ${relPath}:`, err.message);
      errors++;
    }
  }

  // Write manifest
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const manifest = {
    generated: new Date().toISOString(),
    files: manifestEntries.sort(),
  };
  writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`[narratives] Converted ${converted} YAML files → JSON`);
  if (errors > 0) {
    console.error(`[narratives] ${errors} file(s) failed — see above`);
    process.exit(1);
  }
  console.log(`[narratives] Manifest written: ${manifestEntries.length} entries`);
}

build();
