/**
 * enrich-entities.mjs
 *
 * Enriches entities in data/curated/{domain}/entities.json with:
 *   1. Wikipedia intro extract (first ~3000 chars)
 *   2. Wikidata structured claims (excluding external IDs, URLs, CommonsMedia)
 *
 * Saves output to data/curated/{domain}/entities-enriched.json
 *
 * Usage:
 *   node scripts/content-pipeline/enrich-entities.mjs --qid Q726
 *   node scripts/content-pipeline/enrich-entities.mjs --qids Q726,Q339
 *   node scripts/content-pipeline/enrich-entities.mjs --domain animals_wildlife
 *   node scripts/content-pipeline/enrich-entities.mjs --domain animals_wildlife --limit 10
 *   node scripts/content-pipeline/enrich-entities.mjs --domain animals_wildlife --delay 3000
 *
 * Rate limiting: fetchWithRetry wraps all API calls with exponential backoff
 * (5s → 15s → 45s → 120s) on HTTP 429 or "too many requests" responses.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

let DELAY_MS = 2000;
const WIKIPEDIA_EXTRACT_MAX_CHARS = 3000;

const HEADERS = {
  'User-Agent': 'RecallRogue/1.0 (educational quiz game)',
  'Accept': 'application/json',
};

/** Sleep for a given number of milliseconds. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Exponential backoff delays in milliseconds (4 retries max). */
const BACKOFF_DELAYS = [5_000, 15_000, 45_000, 120_000];

/**
 * Fetch JSON from a URL with automatic retry on rate limiting (HTTP 429 or
 * "too many requests" body text).  Returns null if all retries are exhausted
 * or a non-rate-limit error occurs.
 */
async function fetchWithRetry(url) {
  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });

      // Detect rate limiting
      if (res.status === 429) {
        if (attempt < BACKOFF_DELAYS.length) {
          const waitMs = BACKOFF_DELAYS[attempt];
          const waitSec = waitMs / 1000;
          console.warn(`\n  Rate limited, waiting ${waitSec}s before retry (attempt ${attempt + 1}/${BACKOFF_DELAYS.length})...`);
          await sleep(waitMs);
          continue;
        }
        console.error(`  Rate limited on ${url} — all retries exhausted, skipping.`);
        return null;
      }

      if (!res.ok) {
        // Check body text for "too many requests" even without a 429 status
        const text = await res.text();
        if (text.toLowerCase().includes('too many requests')) {
          if (attempt < BACKOFF_DELAYS.length) {
            const waitMs = BACKOFF_DELAYS[attempt];
            const waitSec = waitMs / 1000;
            console.warn(`\n  Rate limited (text), waiting ${waitSec}s before retry (attempt ${attempt + 1}/${BACKOFF_DELAYS.length})...`);
            await sleep(waitMs);
            continue;
          }
          console.error(`  Rate limited on ${url} — all retries exhausted, skipping.`);
          return null;
        }
        console.error(`  HTTP ${res.status} for ${url}`);
        return null;
      }

      return await res.json();
    } catch (err) {
      console.error(`  Fetch error for ${url}: ${err.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Fetch JSON from a URL with error handling.
 * Returns null on failure.
 * @deprecated Use fetchWithRetry instead.
 */
async function fetchJSON(url) {
  return fetchWithRetry(url);
}

/**
 * Get the English Wikipedia article title for a Wikidata Q-ID.
 * Returns null if no English Wikipedia sitelink exists.
 */
async function getWikipediaTitle(qid) {
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities` +
    `&ids=${encodeURIComponent(qid)}&props=sitelinks&sitelinkfilter=enwiki&format=json`;

  const data = await fetchWithRetry(url);
  if (!data) return null;

  const entity = data.entities?.[qid];
  if (!entity || entity.missing !== undefined) return null;

  return entity.sitelinks?.enwiki?.title ?? null;
}

/**
 * Fetch the Wikipedia intro extract for an article title.
 * Truncates to WIKIPEDIA_EXTRACT_MAX_CHARS characters.
 * Returns null on failure.
 */
async function getWikipediaExtract(title) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query` +
    `&titles=${encodeURIComponent(title)}&prop=extracts&exintro=1&explaintext=1&format=json`;

  const data = await fetchWithRetry(url);
  if (!data) return null;

  const pages = data.query?.pages;
  if (!pages) return null;

  // The API returns a single-key object; the key is the page ID (or -1 for missing)
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;

  const extract = page.extract ?? '';
  return extract.slice(0, WIKIPEDIA_EXTRACT_MAX_CHARS) || null;
}

/**
 * Fetch structured Wikidata claims for a Q-ID using SPARQL.
 * Excludes ExternalId, Url, and CommonsMedia property types.
 * Returns an array of { property, value, unit } objects.
 */
async function getWikidataClaims(qid) {
  const sparql = `
SELECT ?propLabel ?val ?valLabel ?unitLabel WHERE {
  wd:${qid} ?p ?statement .
  ?statement ?ps ?val .
  ?prop wikibase:claim ?p .
  ?prop wikibase:statementProperty ?ps .
  ?prop wikibase:propertyType ?ptype .
  FILTER(?ptype NOT IN (wikibase:ExternalId, wikibase:Url, wikibase:CommonsMedia))
  OPTIONAL {
    ?statement ?psv ?valNode .
    ?prop wikibase:statementValue ?psv .
    ?valNode wikibase:quantityUnit ?unit .
    FILTER(?unit != wd:Q199)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 200
`.trim();

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;

  const data = await fetchWithRetry(url);
  if (!data) return [];

  const rows = data.results?.bindings ?? [];

  return rows.map(row => ({
    property: row.propLabel?.value ?? null,
    value: row.valLabel?.value ?? row.val?.value ?? null,
    unit: row.unitLabel?.value ?? null,
  })).filter(c => c.property && c.value);
}

/**
 * Enrich a single entity object with Wikipedia extract and Wikidata claims.
 * Returns the enriched entity.
 */
async function enrichEntity(entity) {
  const { qid, label } = entity;
  process.stdout.write(`Enriching ${qid} (${label})... `);

  let wikipediaTitle = null;
  let wikipediaExtract = null;
  let wikidataClaims = [];

  // Step 1: Get Wikipedia title from Wikidata sitelinks
  try {
    wikipediaTitle = await getWikipediaTitle(qid);
  } catch (err) {
    console.error(`  Error fetching Wikipedia title for ${qid}: ${err.message}`);
  }
  await sleep(DELAY_MS);

  // Step 2: Fetch Wikipedia extract if we have a title
  if (wikipediaTitle) {
    try {
      wikipediaExtract = await getWikipediaExtract(wikipediaTitle);
    } catch (err) {
      console.error(`  Error fetching Wikipedia extract for ${qid}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  // Step 3: Fetch Wikidata claims
  try {
    wikidataClaims = await getWikidataClaims(qid);
  } catch (err) {
    console.error(`  Error fetching Wikidata claims for ${qid}: ${err.message}`);
  }
  await sleep(DELAY_MS);

  const extractLen = wikipediaExtract?.length ?? 0;
  console.log(`Wikipedia: ${extractLen} chars, Wikidata: ${wikidataClaims.length} claims`);

  return {
    ...entity,
    enrichment: {
      wikipediaTitle,
      wikipediaExtract,
      wikidataClaims,
      enrichedAt: new Date().toISOString(),
    },
  };
}

/**
 * Load entities from a domain's entities.json file.
 */
function loadDomainEntities(domain) {
  const path = join(REPO_ROOT, 'data', 'curated', domain, 'entities.json');
  if (!existsSync(path)) {
    throw new Error(`entities.json not found for domain "${domain}" at ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Save enriched entities to a domain's entities-enriched.json file.
 * @param {string} domain
 * @param {object[]} entities - full merged list to write
 * @param {number} newlyEnriched - count of entities enriched in this run
 */
function saveEnrichedEntities(domain, entities, newlyEnriched) {
  const path = join(REPO_ROOT, 'data', 'curated', domain, 'entities-enriched.json');
  writeFileSync(path, JSON.stringify(entities, null, 2), 'utf8');
  console.log(`\nSaved ${newlyEnriched} enriched entities to data/curated/${domain}/entities-enriched.json (total: ${entities.length})`);
}

// ---- CLI entry point --------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const flags = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] ?? true;
      i++;
    }
  }

  // --delay flag: override base delay between entities (milliseconds)
  if (flags.delay !== undefined) {
    const parsed = parseInt(flags.delay, 10);
    if (isNaN(parsed) || parsed < 0) {
      console.error(`Invalid --delay value: "${flags.delay}". Must be a non-negative integer (milliseconds).`);
      process.exit(1);
    }
    DELAY_MS = parsed;
    console.log(`Base delay set to ${DELAY_MS}ms between entities.\n`);
  }

  // --domain mode: enrich all (or --limit N) unprocessed entities in a domain
  if (flags.domain) {
    const domain = flags.domain;
    const limit = flags.limit ? parseInt(flags.limit, 10) : null;

    if (limit !== null && (isNaN(limit) || limit <= 0)) {
      console.error(`Invalid --limit value: "${flags.limit}". Must be a positive integer.`);
      process.exit(1);
    }

    let entities;
    try {
      entities = loadDomainEntities(domain);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }

    // Load existing enriched file if present (skip already-enriched Q-IDs)
    const enrichedPath = join(REPO_ROOT, 'data', 'curated', domain, 'entities-enriched.json');
    let existing = [];
    if (existsSync(enrichedPath)) {
      existing = JSON.parse(readFileSync(enrichedPath, 'utf8'));
      console.log(`Found ${existing.length} already-enriched entities — will skip them.\n`);
    }
    const enrichedQids = new Set(existing.map(e => e.qid));

    // Filter to unprocessed entities not yet in the enriched file
    const unprocessed = entities.filter(e => e.processed !== true && !enrichedQids.has(e.qid));

    // Apply --limit if provided
    const toEnrich = limit !== null ? unprocessed.slice(0, limit) : unprocessed;

    if (limit !== null) {
      console.log(`Enriching ${toEnrich.length} of ${unprocessed.length} unprocessed entities in ${domain}\n`);
    } else {
      console.log(`Enriching ${toEnrich.length} unprocessed entities in ${domain} (${enrichedQids.size} already done).\n`);
    }

    const results = [...existing];
    for (const entity of toEnrich) {
      try {
        const enriched = await enrichEntity(entity);
        results.push(enriched);
      } catch (err) {
        console.error(`  Skipping ${entity.qid} due to unexpected error: ${err.message}`);
        results.push(entity); // keep original if enrichment fails
      }
    }

    saveEnrichedEntities(domain, results, toEnrich.length);
    return;
  }

  // --qid or --qids mode: enrich specific entities, output to stdout
  const rawQids = flags.qids ?? (flags.qid ? flags.qid : null);
  if (!rawQids) {
    console.error('Usage:');
    console.error('  node enrich-entities.mjs --qid Q726');
    console.error('  node enrich-entities.mjs --qids Q726,Q339');
    console.error('  node enrich-entities.mjs --domain animals_wildlife');
    console.error('  node enrich-entities.mjs --domain animals_wildlife --limit 10');
    console.error('  node enrich-entities.mjs --domain animals_wildlife --delay 3000');
    process.exit(1);
  }

  const qids = String(rawQids).split(',').map(q => q.trim()).filter(Boolean);
  console.log(`\nEnriching ${qids.length} entity/entities: ${qids.join(', ')}\n`);

  // Build lookup across all domain entity files
  const { readdirSync } = await import('fs');
  const curatedDir = join(REPO_ROOT, 'data', 'curated');
  const allEntities = {};

  for (const domainDir of readdirSync(curatedDir, { withFileTypes: true })) {
    if (!domainDir.isDirectory()) continue;
    const entPath = join(curatedDir, domainDir.name, 'entities.json');
    if (!existsSync(entPath)) continue;
    const domEntities = JSON.parse(readFileSync(entPath, 'utf8'));
    for (const e of domEntities) {
      allEntities[e.qid] = e;
    }
  }

  const results = [];
  for (const qid of qids) {
    const entity = allEntities[qid] ?? { qid, label: qid, description: '', processed: false };
    try {
      const enriched = await enrichEntity(entity);
      results.push(enriched);
    } catch (err) {
      console.error(`  Skipping ${qid} due to unexpected error: ${err.message}`);
      results.push(entity);
    }
  }

  console.log('\n--- Enriched Output (stdout) ---\n');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
