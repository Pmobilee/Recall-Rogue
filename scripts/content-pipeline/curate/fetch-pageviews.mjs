/**
 * fetch-pageviews.mjs
 *
 * Fetches 90-day average Wikipedia pageview data for entities and adds
 * a `monthlyPageviews` field to each entry. Uses a file-based cache to
 * avoid re-fetching titles across runs.
 *
 * Usage:
 *   node fetch-pageviews.mjs --input <path> [--output <path>] [--cache <path>] [--force]
 *
 * Options:
 *   --input  <path>   Input JSON file (array of objects with `title` field) [required]
 *   --output <path>   Output JSON file (default: same as input, overwrite)
 *   --cache  <path>   Cache file path (default: data/raw/pageviews-cache.json)
 *   --force           Ignore cache and re-fetch all titles
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchJson, writeJson, readJson, sleep, parseCliArgs } from '../fetch/shared-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

const USER_AGENT = 'recall-rogue-content-pipeline/1.0 (educational quiz game; contact: github.com/recall-rogue)'
const PAGEVIEW_BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user'

const RATE_LIMIT_DELAY_MS = 200     // 5 req/s — avoid Wikimedia 429s on sustained loads
const CACHE_SAVE_INTERVAL = 200     // save cache every N fetches
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 1_000       // 1s, 2s, 4s on 429

/**
 * Returns a YYYYMMDD date string offset by `deltaDays` from today.
 * @param {number} deltaDays - negative for past dates
 * @returns {string}
 */
function toWikiDate(deltaDays) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + deltaDays)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/**
 * Encodes a Wikipedia article title for use in the pageview API path.
 * Spaces become underscores, then the whole string is percent-encoded.
 * @param {string} title
 * @returns {string}
 */
function encodeTitle(title) {
  return encodeURIComponent(title.replace(/ /g, '_'))
}

/**
 * Fetches the 90-day average monthly pageviews for a single Wikipedia article title.
 * Returns 0 for 404 (no article), -1 after all retries fail.
 *
 * @param {string} title - Wikipedia article title
 * @param {string} start - YYYYMMDD
 * @param {string} end   - YYYYMMDD
 * @returns {Promise<number>}
 */
async function fetchPageviewsForTitle(title, start, end) {
  const url = `${PAGEVIEW_BASE}/${encodeTitle(title)}/daily/${start}/${end}`
  const headers = { 'User-Agent': USER_AGENT }

  let backoffMs = BACKOFF_BASE_MS

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await fetchJson(url, {
        headers,
        retries: 0,     // we handle retries manually for 429 backoff control
        timeoutMs: 30_000,
      })

      const items = data?.items ?? []
      if (items.length === 0) return 0

      const totalViews = items.reduce((sum, item) => sum + (item.views ?? 0), 0)
      // Divide by 3 to get monthly average from ~90 days
      return Math.round(totalViews / 3)

    } catch (err) {
      const message = err?.message ?? ''

      if (message.includes('HTTP 404')) {
        return 0
      }

      if (message.includes('HTTP 429')) {
        console.warn(`  [429] Rate limited on "${title}", backing off ${backoffMs}ms (attempt ${attempt}/${MAX_RETRIES})`)
        await sleep(backoffMs)
        backoffMs *= 2
        continue
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`  [error] "${title}" attempt ${attempt}/${MAX_RETRIES}: ${message.slice(0, 120)}`)
        await sleep(backoffMs)
        backoffMs *= 2
        continue
      }

      console.error(`  [fail] "${title}" gave up after ${MAX_RETRIES} attempts: ${message.slice(0, 120)}`)
      return -1
    }
  }

  return -1
}

async function main() {
  const args = parseCliArgs(process.argv, {
    input: null,
    output: null,
    cache: path.join(REPO_ROOT, 'data', 'raw', 'pageviews-cache.json'),
    force: false,
  })

  if (!args.input) {
    console.error('Error: --input <path> is required')
    process.exit(1)
  }

  const inputPath = path.resolve(args.input)
  const outputPath = args.output ? path.resolve(args.output) : inputPath
  const cachePath = path.resolve(args.cache)

  // Load input data
  let entries
  try {
    entries = await readJson(inputPath)
  } catch (err) {
    console.error(`Error reading input file "${inputPath}": ${err.message}`)
    process.exit(1)
  }

  if (!Array.isArray(entries)) {
    console.error('Error: input file must contain a JSON array')
    process.exit(1)
  }

  console.log(`Loaded ${entries.length} entries from ${inputPath}`)

  // Load cache
  let cache = {}
  if (!args.force) {
    try {
      cache = await readJson(cachePath)
      console.log(`Loaded cache with ${Object.keys(cache).length} entries from ${cachePath}`)
    } catch {
      console.log(`No cache found at ${cachePath}, starting fresh`)
    }
  } else {
    console.log('--force: ignoring cache, re-fetching all titles')
  }

  // Compute 90-day date window
  const endDate = toWikiDate(-1)    // yesterday
  const startDate = toWikiDate(-91) // 90 days before yesterday

  console.log(`Pageview window: ${startDate} → ${endDate}`)

  // Identify titles that need fetching
  const titlesToFetch = entries
    .map((e) => e.title)
    .filter((t) => typeof t === 'string' && t.length > 0 && !(t in cache))

  const uniqueTitles = [...new Set(titlesToFetch)]

  console.log(`${uniqueTitles.length} titles need fetching (${entries.length - titlesToFetch.length} cached)`)

  // Fetch missing titles
  let fetchCount = 0
  for (const title of uniqueTitles) {
    const views = await fetchPageviewsForTitle(title, startDate, endDate)
    cache[title] = views
    fetchCount++

    if (fetchCount % 100 === 0) {
      console.log(`  Progress: ${fetchCount}/${uniqueTitles.length} fetched...`)
    }

    // Incremental cache save every CACHE_SAVE_INTERVAL fetches
    if (fetchCount % CACHE_SAVE_INTERVAL === 0) {
      await writeJson(cachePath, cache)
      console.log(`  Cache saved (${fetchCount} new entries)`)
    }

    await sleep(RATE_LIMIT_DELAY_MS)
  }

  // Final cache save
  if (fetchCount > 0) {
    await writeJson(cachePath, cache)
    console.log(`Cache saved with ${Object.keys(cache).length} total entries`)
  }

  // Annotate entries with monthlyPageviews
  let missing = 0
  const annotated = entries.map((entry) => {
    const title = entry.title
    if (typeof title !== 'string' || title.length === 0) {
      missing++
      return { ...entry, monthlyPageviews: -1 }
    }
    const views = cache[title]
    if (views === undefined) {
      missing++
      return { ...entry, monthlyPageviews: -1 }
    }
    return { ...entry, monthlyPageviews: views }
  })

  if (missing > 0) {
    console.warn(`Warning: ${missing} entries had no title or missing cache entry — set to -1`)
  }

  // Write output
  await writeJson(outputPath, annotated)
  console.log(`Wrote ${annotated.length} entries to ${outputPath}`)

  // Summary stats
  const flagged = annotated.filter((e) => e.monthlyPageviews === -1).length
  const noArticle = annotated.filter((e) => e.monthlyPageviews === 0).length
  const withViews = annotated.filter((e) => e.monthlyPageviews > 0)
  const avgViews = withViews.length > 0
    ? Math.round(withViews.reduce((s, e) => s + e.monthlyPageviews, 0) / withViews.length)
    : 0

  console.log(`\nSummary:`)
  console.log(`  With pageviews: ${withViews.length}  (avg ${avgViews.toLocaleString()} views/month)`)
  console.log(`  No article (404): ${noArticle}`)
  console.log(`  Flagged / fetch error: ${flagged}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
