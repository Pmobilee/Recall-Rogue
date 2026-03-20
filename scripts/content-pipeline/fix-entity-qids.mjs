#!/usr/bin/env node
/**
 * fix-entity-qids.mjs
 *
 * Validates and corrects Wikidata Q-IDs in entity files by searching
 * the Wikidata search API for each entity's label and comparing results.
 *
 * Usage:
 *   node fix-entity-qids.mjs --domain food_cuisine --dry-run
 *   node fix-entity-qids.mjs --domain food_cuisine
 *   node fix-entity-qids.mjs --all --dry-run
 *   node fix-entity-qids.mjs --all
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../');
const CURATED_DIR = resolve(REPO_ROOT, 'data/curated');

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const RATE_LIMIT_MS = 3000;
const MAX_RETRIES = 4;
const USER_AGENT = 'RecallRogue/1.0';

/** Exponential backoff delays in milliseconds (matches enrich-entities.mjs). */
const BACKOFF_DELAYS = [5_000, 15_000, 45_000, 120_000];

/** Domain-specific keywords used to prefer the most relevant Wikidata search result. */
const DOMAIN_KEYWORDS = {
  food_cuisine: ['food', 'ingredient', 'cuisine', 'dish', 'beverage', 'spice', 'plant', 'sauce', 'recipe', 'culinary', 'drink', 'fruit', 'vegetable', 'meat', 'grain', 'cheese', 'bread'],
  mythology_folklore: ['deity', 'god', 'goddess', 'myth', 'legend', 'folklore', 'spirit', 'creature', 'hero', 'monster', 'divine', 'supernatural', 'mythological', 'religion', 'ritual'],
  animals_wildlife: ['animal', 'species', 'bird', 'mammal', 'fish', 'reptile', 'insect', 'amphibian', 'invertebrate', 'vertebrate', 'genus', 'family', 'fauna', 'wildlife', 'taxon'],
  art_architecture: ['art', 'painting', 'sculpture', 'architecture', 'building', 'style', 'movement', 'artist', 'architect', 'artwork', 'museum', 'design', 'structure'],
  general_knowledge: ['concept', 'phenomenon', 'theory', 'invention', 'discovery', 'organization', 'institution', 'event'],
  geography: ['country', 'city', 'region', 'mountain', 'river', 'ocean', 'sea', 'island', 'continent', 'capital', 'lake', 'desert', 'geographic'],
  history: ['event', 'battle', 'war', 'revolution', 'empire', 'kingdom', 'dynasty', 'historical', 'period', 'era', 'civilization', 'treaty'],
  human_body_health: ['organ', 'disease', 'syndrome', 'bone', 'muscle', 'gland', 'cell', 'tissue', 'medical', 'health', 'anatomy', 'physiology', 'condition', 'disorder'],
  natural_sciences: ['chemical', 'element', 'compound', 'reaction', 'physics', 'biology', 'chemistry', 'geology', 'phenomenon', 'theory', 'particle', 'force', 'wave'],
  space_astronomy: ['planet', 'star', 'galaxy', 'nebula', 'comet', 'asteroid', 'constellation', 'moon', 'satellite', 'astronomical', 'celestial', 'solar', 'cosmic'],
};

const ALL_DOMAINS = Object.keys(DOMAIN_KEYWORDS);

/** Sleep for a given number of milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build and execute a SPARQL query against the Wikidata SPARQL endpoint.
 * Returns array of up to 5 candidate results: { id, label, description }.
 * Tries exact-case match first; falls back to lowercase if no results.
 * Retries with exponential backoff (5s → 15s → 45s → 120s) on 429 or
 * "too many requests" body text — matching the pattern in enrich-entities.mjs.
 */
async function wikidataSearch(label) {
  // Escape double quotes inside the label for safe SPARQL string interpolation
  const escapedLabel = label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedLower = label.toLowerCase().replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // Try exact match first; if empty, fall back to lowercase
  const labelsToTry = [escapedLabel];
  if (escapedLabel !== escapedLower) labelsToTry.push(escapedLower);

  for (const tryLabel of labelsToTry) {
    const sparql = `SELECT ?item ?itemLabel ?itemDescription WHERE {
  ?item rdfs:label "${tryLabel}"@en .
  ?item wikibase:sitelinks ?sl .
  FILTER(?sl > 5)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
} ORDER BY DESC(?sl) LIMIT 5`;

    const results = await sparqlQuery(sparql, label);
    if (results.length > 0) return results;
  }

  return [];
}

/**
 * Execute a raw SPARQL query against the Wikidata endpoint via POST.
 * Returns array of { id, label, description }.
 * Handles 429 / "too many requests" with exponential backoff.
 */
async function sparqlQuery(sparql, labelForLogging) {
  const body = new URLSearchParams({ query: sparql });

  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    let response;
    try {
      response = await fetch(WIKIDATA_SPARQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: body.toString(),
      });
    } catch (err) {
      throw new Error(`Network error searching for "${labelForLogging}": ${err.message}`);
    }

    // HTTP 429 rate limit
    if (response.status === 429) {
      if (attempt < BACKOFF_DELAYS.length) {
        const waitMs = BACKOFF_DELAYS[attempt];
        console.warn(`  [RATE LIMITED] "${labelForLogging}" — waiting ${waitMs / 1000}s before retry ${attempt + 1}/${BACKOFF_DELAYS.length}...`);
        await sleep(waitMs);
        continue;
      }
      throw new Error(`Wikidata SPARQL: 429 Too Many Requests for "${labelForLogging}" (all retries exhausted)`);
    }

    if (!response.ok) {
      const text = await response.text();
      if (text.toLowerCase().includes('too many requests')) {
        if (attempt < BACKOFF_DELAYS.length) {
          const waitMs = BACKOFF_DELAYS[attempt];
          console.warn(`  [RATE LIMITED text] "${labelForLogging}" — waiting ${waitMs / 1000}s before retry ${attempt + 1}/${BACKOFF_DELAYS.length}...`);
          await sleep(waitMs);
          continue;
        }
        throw new Error(`Wikidata SPARQL: rate limited (text) for "${labelForLogging}" (all retries exhausted)`);
      }
      throw new Error(`Wikidata SPARQL error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const bindings = data?.results?.bindings || [];
    return bindings.map((b) => ({
      id: b.item?.value?.replace('http://www.wikidata.org/entity/', '') || '',
      label: b.itemLabel?.value || '',
      description: b.itemDescription?.value || '',
    })).filter((r) => r.id.startsWith('Q'));
  }

  throw new Error(`sparqlQuery: unreachable`);
}

/**
 * Given a list of Wikidata candidates and domain context, decide which is the best match.
 *
 * Strategy:
 * 1. If only one result, use it.
 * 2. If the correct stored QID appears in results AND its description matches domain keywords,
 *    keep the stored QID (it may still be correct).
 * 3. Otherwise, prefer the first result whose description contains domain keywords.
 * 4. If no domain-keyword match, use the first result but flag as potentially ambiguous.
 *
 * Returns: { bestId, bestDescription, ambiguous }
 */
function pickBestCandidate(candidates, domain, storedQid) {
  if (candidates.length === 0) {
    return { bestId: null, bestDescription: '', ambiguous: false };
  }

  const keywords = DOMAIN_KEYWORDS[domain] || [];

  // Exact match (stored QID is still in results)
  const storedMatch = candidates.find((c) => c.id === storedQid);

  // Score candidates by domain keyword presence in description
  function score(candidate) {
    const desc = candidate.description.toLowerCase();
    return keywords.filter((k) => desc.includes(k)).length;
  }

  const scored = candidates.map((c) => ({ ...c, score: score(c) }));
  const bestScore = Math.max(...scored.map((c) => c.score));

  // If stored QID still present and scores well, keep it
  if (storedMatch) {
    const storedScore = score(storedMatch);
    if (storedScore > 0 || bestScore === 0) {
      // Stored QID is domain-relevant or no candidate is — keep it
      return { bestId: storedMatch.id, bestDescription: storedMatch.description, ambiguous: false };
    }
    // Another candidate scores higher — prefer that one
  }

  // Pick highest-scoring candidate (first result wins ties)
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a), scored[0]);

  // Ambiguous if top score is 0 AND multiple candidates exist
  const ambiguous = best.score === 0 && candidates.length > 1;

  return { bestId: best.id, bestDescription: best.description, ambiguous };
}

/**
 * Process a single domain's entities.json file.
 *
 * @param {string} domain - e.g. "food_cuisine"
 * @param {boolean} dryRun - if true, don't write changes
 * @returns {{ total, fixed, ambiguous, alreadyCorrect, notFound }}
 */
async function processDomain(domain, dryRun) {
  const entitiesPath = resolve(CURATED_DIR, domain, 'entities.json');
  const enrichedPath = resolve(CURATED_DIR, domain, 'entities-enriched.json');

  if (!existsSync(entitiesPath)) {
    console.error(`  [ERROR] No entities.json found for domain: ${domain}`);
    return { total: 0, fixed: 0, ambiguous: 0, alreadyCorrect: 0, notFound: 0 };
  }

  const entities = JSON.parse(readFileSync(entitiesPath, 'utf8'));
  const stats = { total: entities.length, fixed: 0, ambiguous: 0, alreadyCorrect: 0, notFound: 0 };
  let anyChanged = false;

  console.log(`\n=== ${domain} (${entities.length} entities) ===`);

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const { qid: storedQid, label } = entity;

    if (!label) {
      console.log(`  [SKIP] Entity at index ${i} has no label`);
      continue;
    }

    // Rate limiting
    if (i > 0) await sleep(RATE_LIMIT_MS);

    let candidates;
    try {
      candidates = await wikidataSearch(label);
    } catch (err) {
      console.error(`  [ERROR] API call failed for "${label}": ${err.message}`);
      continue;
    }

    if (candidates.length === 0) {
      console.log(`  ${storedQid} "${label}" → (no results) [NOT FOUND]`);
      stats.notFound++;
      continue;
    }

    const { bestId, bestDescription, ambiguous } = pickBestCandidate(candidates, domain, storedQid);

    if (!bestId) {
      console.log(`  ${storedQid} "${label}" → (no results) [NOT FOUND]`);
      stats.notFound++;
      continue;
    }

    const descDisplay = bestDescription ? bestDescription.slice(0, 60) : '??';

    if (ambiguous) {
      console.log(`  ${storedQid} "${label}" → ${bestId} (${descDisplay}) [AMBIGUOUS - manual review needed]`);
      stats.ambiguous++;
    } else if (bestId !== storedQid) {
      console.log(`  ${storedQid} "${label}" → ${bestId} (${descDisplay}) [FIXED]`);
      if (!dryRun) {
        entity.qid = bestId;
        anyChanged = true;
      }
      stats.fixed++;
    } else {
      console.log(`  ${storedQid} "${label}" → ${bestId} (${descDisplay}) [OK]`);
      stats.alreadyCorrect++;
    }
  }

  // Write back corrected entities
  if (!dryRun && anyChanged) {
    writeFileSync(entitiesPath, JSON.stringify(entities, null, 2) + '\n', 'utf8');
    console.log(`\n  Wrote updated entities.json`);

    // Delete enriched file since Q-IDs changed
    if (existsSync(enrichedPath)) {
      unlinkSync(enrichedPath);
      console.log(`  Deleted entities-enriched.json (stale, re-run enrichment)`);
    }
  } else if (dryRun && stats.fixed > 0) {
    console.log(`\n  [DRY RUN] ${stats.fixed} fixes would be applied. Run without --dry-run to apply.`);
  } else if (!dryRun && !anyChanged) {
    console.log(`\n  No changes needed.`);
  }

  return stats;
}

/** Print summary statistics for a domain. */
function printSummary(domain, stats) {
  console.log(
    `\n${domain}: ${stats.total} entities, ${stats.fixed} fixed, ${stats.ambiguous} ambiguous, ${stats.alreadyCorrect} already correct, ${stats.notFound} not found`
  );
}

/** Parse CLI arguments. */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    domain: null,
    all: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--domain' && args[i + 1]) {
      opts.domain = args[++i];
    } else if (args[i] === '--all') {
      opts.all = true;
    } else if (args[i] === '--dry-run') {
      opts.dryRun = true;
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();

  if (!opts.domain && !opts.all) {
    console.error('Usage:');
    console.error('  node fix-entity-qids.mjs --domain <domain> [--dry-run]');
    console.error('  node fix-entity-qids.mjs --all [--dry-run]');
    console.error('\nAvailable domains:', ALL_DOMAINS.join(', '));
    process.exit(1);
  }

  const domains = opts.all ? ALL_DOMAINS : [opts.domain];

  if (opts.dryRun) {
    console.log('[DRY RUN MODE] No files will be modified.\n');
  }

  // Validate domain names
  for (const d of domains) {
    if (!ALL_DOMAINS.includes(d)) {
      console.error(`Unknown domain: "${d}". Valid domains: ${ALL_DOMAINS.join(', ')}`);
      process.exit(1);
    }
  }

  const allStats = {};

  for (const domain of domains) {
    const stats = await processDomain(domain, opts.dryRun);
    allStats[domain] = stats;
    printSummary(domain, stats);
  }

  if (domains.length > 1) {
    console.log('\n=== OVERALL SUMMARY ===');
    let totalEntities = 0, totalFixed = 0, totalAmbiguous = 0, totalCorrect = 0, totalNotFound = 0;
    for (const [domain, stats] of Object.entries(allStats)) {
      totalEntities += stats.total;
      totalFixed += stats.fixed;
      totalAmbiguous += stats.ambiguous;
      totalCorrect += stats.alreadyCorrect;
      totalNotFound += stats.notFound;
    }
    console.log(`Total: ${totalEntities} entities, ${totalFixed} fixed, ${totalAmbiguous} ambiguous, ${totalCorrect} already correct, ${totalNotFound} not found`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
