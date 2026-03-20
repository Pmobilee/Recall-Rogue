#!/usr/bin/env node
/**
 * prepare-worker-prompts.mjs
 *
 * For each domain, reads entities-enriched.json and the existing seed facts,
 * determines which entities still need fact generation, and writes worker
 * prompt files to /tmp/worker-prompt-{domain}.txt containing ONLY the
 * unprocessed entities.
 *
 * Prevents Sonnet workers from regenerating duplicate facts for entities
 * that already have sufficient coverage in the seed files.
 *
 * Usage:
 *   node scripts/content-pipeline/prepare-worker-prompts.mjs
 *   node scripts/content-pipeline/prepare-worker-prompts.mjs --domain animals_wildlife
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

// Minimum number of facts an entity must already have to be considered "done".
// Workers generate ~2-3 facts per entity; 2 is sufficient to skip re-generation.
const DONE_THRESHOLD = 2;

// All knowledge domains (excluding vocab)
const ALL_DOMAINS = [
  'animals_wildlife',
  'art_architecture',
  'food_cuisine',
  'general_knowledge',
  'geography',
  'history',
  'human_body_health',
  'mythology_folklore',
  'natural_sciences',
  'space_astronomy',
];

// Wikidata claim properties that are useless for fact generation.
// These are either meta/admin properties or ones that produce noise rather than
// interesting quiz-worthy claims.
const SKIP_CLAIM_PROPERTIES = new Set([
  // Admin / meta
  'Commons category',
  'Commons gallery',
  "topic's main category",
  'maintained by WikiProject',
  'on focus list of Wikimedia project',
  'described by source',
  'Wikimedia page protected',
  'Wikimedia portal main linked topic',

  // Taxonomy noise
  'instance of',
  'subclass of',
  'taxon common name',   // foreign language names
  'different from',
  'said to be the same as',

  // Personal metadata (low quiz value)
  'sex or gender',
  'name in native language',
  'native label',
  'short name',
  'code of nomenclature',

  // Social media / popularity metrics
  'social media followers',
  'social media account',

  // Wikidata internal
  'category for this taxon',
  'image',
  'coat of arms image',
  'flag image',
  'locator map image',
  'pronunciation audio',
  'WikiProject',
  'topic\'s main template',

  // License plates / postal codes (rarely quiz-worthy)
  'licence plate code',
  'calling code',
  'postal code',
  'ISO 3166-1 alpha-2',
  'ISO 3166-1 alpha-3',
  'ISO 3166-1 numeric',
  'ISO 3166-2',
  'MCN code',
  'located in time zone',
]);

/**
 * Normalize a string to an ASCII slug for fuzzy matching.
 * Strips accents, lowercases, converts spaces/underscores to hyphens,
 * removes non-alphanumeric characters.
 *
 * @param {string} s
 * @returns {string}
 */
function toSlug(s) {
  if (!s) return '';
  // Normalize Unicode accents (e.g. Dürer → Durer)
  const ascii = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return ascii
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .trim('-');
}

/**
 * URL-decode a string (handles %C3%BC etc.).
 *
 * @param {string} s
 * @returns {string}
 */
function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Returns true if the given fact can be attributed to the given entity.
 *
 * Matching strategy (any of these is sufficient):
 * 1. Entity label slug appears as a substring of the fact ID.
 * 2. Entity Wikipedia title (with underscores) appears in the sourceUrl.
 * 3. Entity label (with underscores) appears in the sourceUrl.
 * 4. Entity Wikipedia title slug appears as a substring of the fact ID.
 *
 * NOTE: Wikipedia URLs use underscores for spaces (e.g. /wiki/Francisco_Goya),
 * so we must compare with underscores, not spaces.
 *
 * @param {{ qid: string, label: string, enrichment?: { wikipediaTitle?: string } }} entity
 * @param {{ id: string, sourceUrl?: string }} fact
 * @returns {boolean}
 */
function entityMatchesFact(entity, fact) {
  const label = entity.label || '';
  const wikiTitle = entity.enrichment?.wikipediaTitle || '';

  const factId = fact.id || '';
  // Keep the raw URL for underscore-based matching; also try URL-decoded for percent-encoded chars
  const srcRaw = fact.sourceUrl || '';
  const srcDecoded = decode(srcRaw);

  const labelSlug = toSlug(label);
  const wikiSlug = toSlug(wikiTitle);

  // 1. Label slug substring in fact id
  if (labelSlug && factId.includes(labelSlug)) return true;

  // 2. Wikipedia title (with underscores) in raw sourceUrl — standard Wikipedia URL format
  if (wikiTitle) {
    const wikiTitleUnderscored = wikiTitle.replace(/ /g, '_');
    if (srcRaw.includes(wikiTitleUnderscored)) return true;
    // Also try URL-decoded version (for accented characters like Dürer)
    if (srcDecoded.includes(wikiTitle)) return true;
  }

  // 3. Label (with underscores) in sourceUrl
  if (label) {
    const labelUnderscored = label.replace(/ /g, '_');
    if (srcRaw.includes(labelUnderscored)) return true;
    if (srcDecoded.includes(label)) return true;
  }

  // 4. Wikipedia title slug substring in fact id
  if (wikiSlug && factId.includes(wikiSlug)) return true;

  return false;
}

/**
 * Count how many facts in the seed array are attributed to the given entity.
 *
 * @param {object} entity
 * @param {Array} facts
 * @returns {number}
 */
function countMatchingFacts(entity, facts) {
  return facts.filter(fact => entityMatchesFact(entity, fact)).length;
}

/**
 * Filter Wikidata claims to remove noise properties.
 * Returns a formatted string like "property: value; property: value".
 *
 * @param {Array<{ property: string, value: string, unit: string|null }>} claims
 * @returns {string}
 */
function formatClaims(claims) {
  if (!claims || claims.length === 0) return '';

  const useful = claims.filter(c => {
    if (!c.property || !c.value) return false;
    if (SKIP_CLAIM_PROPERTIES.has(c.property)) return false;
    // Skip Q-ID placeholder values (unresolved Wikidata references)
    if (/^Q\d+$/.test(String(c.value))) return false;
    return true;
  });

  if (useful.length === 0) return '';

  return useful
    .map(c => {
      const val = c.unit && c.unit !== 'Q199' ? `${c.value} ${c.unit}` : c.value;
      return `${c.property}: ${val}`;
    })
    .join('; ');
}

/**
 * Render a single entity as a worker prompt section.
 *
 * @param {object} entity  Enriched entity object
 * @returns {string}
 */
function renderEntitySection(entity) {
  const { qid, label, enrichment } = entity;
  const heading = `### ${label.toUpperCase()} (${qid})`;

  let wikiPart = '';
  let wikidataPart = '';

  if (enrichment) {
    if (enrichment.wikipediaExtract) {
      wikiPart = `**Wikipedia:** ${enrichment.wikipediaExtract.trim()}`;
    }
    const claimsStr = formatClaims(enrichment.wikidataClaims || []);
    if (claimsStr) {
      wikidataPart = `**Wikidata:** ${claimsStr}`;
    }
  }

  const parts = [heading];
  if (wikiPart) parts.push(wikiPart);
  if (wikidataPart) parts.push(wikidataPart);

  return parts.join('\n');
}

/**
 * Process a single domain: identify new entities and write the worker prompt file.
 *
 * @param {string} domain  Domain key (e.g. "animals_wildlife")
 * @returns {{ domain: string, enrichedCount: number, doneCount: number, newCount: number, outputPath: string, skipped: boolean, noEnrichedFile: boolean }}
 */
function processDomain(domain) {
  const enrichedPath = join(REPO_ROOT, 'data', 'curated', domain, 'entities-enriched.json');
  const seedPath = join(REPO_ROOT, 'src', 'data', 'seed', `knowledge-${domain}.json`);
  const outputPath = `/tmp/worker-prompt-${domain}.txt`;

  // If no enriched file, skip this domain
  if (!existsSync(enrichedPath)) {
    return { domain, enrichedCount: 0, doneCount: 0, newCount: 0, outputPath, skipped: false, noEnrichedFile: true };
  }

  const entities = JSON.parse(readFileSync(enrichedPath, 'utf8'));

  // Load existing seed facts (may not exist yet for a brand-new domain)
  let facts = [];
  if (existsSync(seedPath)) {
    facts = JSON.parse(readFileSync(seedPath, 'utf8'));
  }

  // Separate into candidates (non-skipped) and skipped
  const candidates = entities.filter(e => !e.skip);
  const enrichedCount = candidates.length;

  const newEntities = [];
  let doneCount = 0;

  for (const entity of candidates) {
    const matchCount = countMatchingFacts(entity, facts);
    if (matchCount >= DONE_THRESHOLD) {
      doneCount++;
    } else {
      newEntities.push(entity);
    }
  }

  const newCount = newEntities.length;

  // Build prompt content
  let promptContent = '';
  if (newEntities.length > 0) {
    promptContent = newEntities.map(renderEntitySection).join('\n\n') + '\n';
  }

  writeFileSync(outputPath, promptContent, 'utf8');

  return { domain, enrichedCount, doneCount, newCount, outputPath, skipped: newCount === 0, noEnrichedFile: false };
}

/**
 * Parse CLI arguments.
 * Supports: --domain <name>
 *
 * @param {string[]} argv
 * @returns {{ domains: string[] }}
 */
function parseCli(argv) {
  const domainIdx = argv.indexOf('--domain');
  if (domainIdx !== -1 && argv[domainIdx + 1]) {
    return { domains: [argv[domainIdx + 1]] };
  }
  return { domains: ALL_DOMAINS };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

const { domains } = parseCli(process.argv);

for (const domain of domains) {
  const result = processDomain(domain);

  if (result.noEnrichedFile) {
    console.log(`${domain}: no entities-enriched.json — SKIPPED`);
    continue;
  }

  if (result.skipped) {
    console.log(
      `${domain}: ${result.enrichedCount} enriched, ${result.doneCount} already have facts, 0 new → SKIPPED (all done)`
    );
  } else {
    console.log(
      `${domain}: ${result.enrichedCount} enriched, ${result.doneCount} already have facts, ${result.newCount} new → ${result.outputPath}`
    );
  }
}
