#!/usr/bin/env node
/**
 * ingest-batch.mjs
 *
 * Runs one complete enrichment batch across all domains (or a single domain).
 * Designed to be called by a cron job or a future agent without needing to
 * know the internal pipeline details.
 *
 * What it does:
 *   1. Checks that Wikidata is reachable and not throttled.
 *   2. For each domain (or specified domain):
 *      a. Runs enrich-entities.mjs --domain {domain} --limit {N}
 *      b. Logs how many entities were enriched.
 *   3. Prints a summary of results and the exact next command to run.
 *
 * What it does NOT do:
 *   - Fact generation (requires LLM workers via the Claude Code Agent tool).
 *
 * Usage:
 *   node scripts/content-pipeline/ingest-batch.mjs --limit 10
 *   node scripts/content-pipeline/ingest-batch.mjs --domain animals_wildlife --limit 5
 *   node scripts/content-pipeline/ingest-batch.mjs --limit 20 --delay 3000
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

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

/** Wikidata endpoint for connectivity check. */
const WIKIDATA_HEALTH_URL =
  'https://www.wikidata.org/w/api.php?action=query&format=json&meta=siteinfo&siprop=general';

/** Exponential backoff delays (ms) when Wikidata is throttled at startup. */
const STARTUP_BACKOFF_DELAYS = [60_000, 60_000, 60_000, 60_000, 60_000]; // 5 × 60s

/** Sleep for a given number of milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format milliseconds into a human-readable string. */
function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

/**
 * Check if Wikidata is reachable and not throttling us.
 * Returns { ok: boolean, reason?: string }.
 */
async function checkWikidata() {
  try {
    const res = await fetch(WIKIDATA_HEALTH_URL, {
      headers: { 'User-Agent': 'RecallRogue/1.0 (educational quiz game)' },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 429) {
      return { ok: false, reason: `HTTP 429 (rate limited)` };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (text.toLowerCase().includes('too many requests')) {
        return { ok: false, reason: `Rate limited (text response)` };
      }
      return { ok: false, reason: `HTTP ${res.status} ${res.statusText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Network error: ${err.message}` };
  }
}

/**
 * Wait for Wikidata to become available.
 * Retries up to STARTUP_BACKOFF_DELAYS.length times with 60s waits.
 * Throws if all retries are exhausted.
 */
async function waitForWikidata() {
  for (let attempt = 0; attempt <= STARTUP_BACKOFF_DELAYS.length; attempt++) {
    const { ok, reason } = await checkWikidata();
    if (ok) {
      if (attempt > 0) {
        console.log(`  Wikidata is now available after ${attempt} retry/retries.\n`);
      }
      return;
    }

    if (attempt < STARTUP_BACKOFF_DELAYS.length) {
      const waitMs = STARTUP_BACKOFF_DELAYS[attempt];
      console.warn(
        `  [WIKIDATA UNAVAILABLE] ${reason} — waiting ${formatMs(waitMs)} before retry ${attempt + 1}/${STARTUP_BACKOFF_DELAYS.length}...`
      );
      await sleep(waitMs);
    } else {
      throw new Error(
        `Wikidata is unavailable after ${STARTUP_BACKOFF_DELAYS.length} retries. Last error: ${reason}`
      );
    }
  }
}

/**
 * Count how many entities in a domain still need enrichment.
 * Returns { total, enriched, pending }.
 */
function getDomainStats(domain) {
  const entitiesPath = join(REPO_ROOT, 'data', 'curated', domain, 'entities.json');
  const enrichedPath = join(REPO_ROOT, 'data', 'curated', domain, 'entities-enriched.json');

  if (!existsSync(entitiesPath)) {
    return { total: 0, enriched: 0, pending: 0 };
  }

  const entities = JSON.parse(readFileSync(entitiesPath, 'utf8'));
  const total = entities.length;

  let enrichedCount = 0;
  if (existsSync(enrichedPath)) {
    const enriched = JSON.parse(readFileSync(enrichedPath, 'utf8'));
    enrichedCount = enriched.length;
  }

  return { total, enriched: enrichedCount, pending: Math.max(0, total - enrichedCount) };
}

/**
 * Run enrich-entities.mjs for a domain and return { enriched, error }.
 * Streams the child process output to stdout in real time.
 */
function runEnrichment(domain, limit, delay) {
  return new Promise((resolve) => {
    const args = [
      join(__dirname, 'enrich-entities.mjs'),
      '--domain', domain,
      '--limit', String(limit),
    ];
    if (delay != null) {
      args.push('--delay', String(delay));
    }

    console.log(`\n  Running: node enrich-entities.mjs --domain ${domain} --limit ${limit}${delay != null ? ` --delay ${delay}` : ''}`);
    console.log('  ' + '-'.repeat(60));

    const child = spawn('node', args, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      // Indent child output for readability
      process.stdout.write(text.replace(/^/gm, '  ').replace(/\n  $/s, '\n'));
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text.replace(/^/gm, '  [stderr] '));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({
          enriched: 0,
          error: `Process exited with code ${code}${stderr ? ': ' + stderr.trim().slice(0, 200) : ''}`,
        });
        return;
      }

      // Parse "Saved N enriched entities" from stdout
      const match = stdout.match(/Saved (\d+) enriched entities/);
      const enriched = match ? parseInt(match[1], 10) : 0;
      resolve({ enriched, error: null });
    });

    child.on('error', (err) => {
      resolve({ enriched: 0, error: `Failed to spawn process: ${err.message}` });
    });
  });
}

/** Parse CLI arguments. */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    domain: null,   // single domain, or null = all
    limit: 10,      // entities per domain
    delay: null,    // ms between API calls (null = use enrich-entities default)
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--domain' && args[i + 1]) {
      opts.domain = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (isNaN(n) || n <= 0) {
        console.error(`Invalid --limit value. Must be a positive integer.`);
        process.exit(1);
      }
      opts.limit = n;
    } else if (args[i] === '--delay' && args[i + 1]) {
      const d = parseInt(args[++i], 10);
      if (isNaN(d) || d < 0) {
        console.error(`Invalid --delay value. Must be a non-negative integer (milliseconds).`);
        process.exit(1);
      }
      opts.delay = d;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage:
  node ingest-batch.mjs --limit 10
  node ingest-batch.mjs --domain animals_wildlife --limit 5
  node ingest-batch.mjs --limit 20 --delay 3000

Options:
  --domain <name>   Only enrich this domain (default: all domains)
  --limit  <N>      Entities to enrich per domain (default: 10)
  --delay  <ms>     Delay between API calls in ms (default: enrich-entities default)

Available domains: ${ALL_DOMAINS.join(', ')}`);
      process.exit(0);
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();

  // Validate domain if specified
  if (opts.domain && !ALL_DOMAINS.includes(opts.domain)) {
    console.error(`Unknown domain: "${opts.domain}"`);
    console.error(`Available domains: ${ALL_DOMAINS.join(', ')}`);
    process.exit(1);
  }

  const domains = opts.domain ? [opts.domain] : ALL_DOMAINS;
  const startTime = Date.now();

  console.log('='.repeat(64));
  console.log('INGEST BATCH');
  console.log('='.repeat(64));
  console.log(`Domains:  ${domains.join(', ')}`);
  console.log(`Limit:    ${opts.limit} entities per domain`);
  if (opts.delay != null) console.log(`Delay:    ${opts.delay}ms between API calls`);
  console.log(`Started:  ${new Date().toISOString()}`);
  console.log('');

  // --- Pre-flight: check Wikidata availability ---
  console.log('Checking Wikidata availability...');
  try {
    await waitForWikidata();
    console.log('  Wikidata is reachable.\n');
  } catch (err) {
    console.error(`\nFATAL: ${err.message}`);
    console.error('Aborting batch. Try again later.');
    process.exit(1);
  }

  // --- Pre-flight: print current domain stats ---
  console.log('Current enrichment status:');
  for (const domain of domains) {
    const { total, enriched, pending } = getDomainStats(domain);
    console.log(`  ${domain.padEnd(22)} ${enriched}/${total} enriched, ${pending} pending`);
  }
  console.log('');

  // --- Run enrichment for each domain ---
  const results = {};

  for (const domain of domains) {
    console.log(`\n${'='.repeat(64)}`);
    console.log(`DOMAIN: ${domain}`);
    console.log('='.repeat(64));

    const statsBefore = getDomainStats(domain);

    if (statsBefore.pending === 0) {
      console.log(`  All ${statsBefore.total} entities already enriched — skipping.\n`);
      results[domain] = { enriched: 0, skipped: true, error: null };
      continue;
    }

    const { enriched, error } = await runEnrichment(domain, opts.limit, opts.delay);

    if (error) {
      console.error(`\n  [ERROR] ${domain}: ${error}`);
      results[domain] = { enriched: 0, skipped: false, error };
    } else {
      console.log(`\n  Done: ${enriched} entities enriched in ${domain}.`);
      results[domain] = { enriched, skipped: false, error: null };
    }
  }

  // --- Final summary ---
  const elapsed = Date.now() - startTime;
  console.log(`\n${'='.repeat(64)}`);
  console.log('BATCH SUMMARY');
  console.log('='.repeat(64));

  let totalEnriched = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (const [domain, result] of Object.entries(results)) {
    const statsAfter = getDomainStats(domain);
    if (result.error) {
      console.log(`  ${domain.padEnd(22)} ERROR: ${result.error.slice(0, 80)}`);
      totalErrors++;
    } else if (result.skipped) {
      console.log(`  ${domain.padEnd(22)} SKIPPED (all enriched)`);
      totalSkipped++;
    } else {
      console.log(`  ${domain.padEnd(22)} +${result.enriched} enriched  (${statsAfter.enriched}/${statsAfter.total} total)`);
      totalEnriched += result.enriched;
    }
  }

  console.log('');
  console.log(`Total enriched:  ${totalEnriched}`);
  console.log(`Domains skipped: ${totalSkipped}`);
  console.log(`Domains errored: ${totalErrors}`);
  console.log(`Elapsed:         ${formatMs(elapsed)}`);
  console.log(`Finished:        ${new Date().toISOString()}`);
  console.log('');

  // --- Next step guidance ---
  if (totalEnriched > 0) {
    console.log('='.repeat(64));
    console.log('READY FOR FACT GENERATION');
    console.log('='.repeat(64));
    console.log(`${totalEnriched} entities were enriched and are ready for fact generation.`);
    console.log('');
    console.log('Run the /manual-fact-ingest-dedup skill with:');
    console.log('  "Generate facts for the newly enriched entities in all domains"');
    console.log('');
    if (opts.domain) {
      console.log(`Or for a single domain:`);
      console.log(`  "Generate facts for the newly enriched entities in ${opts.domain}"`);
      console.log('');
    }
  } else if (totalErrors === 0 && totalSkipped === domains.length) {
    console.log('All domains are fully enriched. Nothing new to send for fact generation.');
    console.log('Add more entities to data/curated/{domain}/entities.json first.');
    console.log('');
  } else if (totalErrors > 0 && totalEnriched === 0) {
    console.log('No entities were enriched due to errors. Check the output above.');
    console.log('');
  }

  // Exit non-zero if there were errors
  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
