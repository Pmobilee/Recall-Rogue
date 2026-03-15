/**
 * fetch-vital-articles.mjs
 *
 * Fetches Wikipedia Vital Articles Level 4 (~10,000 articles) and maps them
 * to Wikidata Q-IDs. Output is written to data/raw/vital-articles-l4.json.
 *
 * Usage:
 *   node scripts/content-pipeline/curate/fetch-vital-articles.mjs
 *   node scripts/content-pipeline/curate/fetch-vital-articles.mjs --force
 *   node scripts/content-pipeline/curate/fetch-vital-articles.mjs --skip-qids
 *
 * CLI options:
 *   --force      Re-fetch even if output file already exists
 *   --skip-qids  Skip Q-ID mapping step (output titles only, qid will be null)
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import {
  fetchJson,
  writeJson,
  readJson,
  sleep,
  parseCliArgs,
  takeDistinct,
} from '../fetch/shared-utils.mjs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT_PATH = path.join(REPO_ROOT, 'data/raw/vital-articles-l4.json')
const INTERMEDIATE_PATH = path.join(REPO_ROOT, 'data/raw/vital-articles-l4.intermediate.json')

const USER_AGENT = 'recall-rogue-content-pipeline/1.0 (educational quiz game)'

const MEDIAWIKI_API = 'https://en.wikipedia.org/w/api.php'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'

/** Delay between MediaWiki sub-page fetches (max 200 req/min = 300ms min; use 250ms) */
const MEDIAWIKI_DELAY_MS = 250
/** Delay between Wikidata batch requests (1.5s avoids 429s at ~10K articles) */
const WIKIDATA_BATCH_DELAY_MS = 1500
/** Wikidata batch size (API supports up to 50 titles per request) */
const WIKIDATA_BATCH_SIZE = 50
/** Save intermediate results every N articles during Q-ID mapping */
const INTERMEDIATE_SAVE_EVERY = 1000

/** Wikipedia namespaces to exclude when extracting article titles */
const EXCLUDED_NAMESPACE_PREFIXES = [
  'Wikipedia:',
  'Talk:',
  'Help:',
  'Template:',
  'Template_talk:',
  'User:',
  'User_talk:',
  'Category:',
  'Category_talk:',
  'File:',
  'File_talk:',
  'MediaWiki:',
  'MediaWiki_talk:',
  'Module:',
  'Module_talk:',
  'Portal:',
  'Portal_talk:',
  'Special:',
  'WP:',
  'WT:',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if a link title should be excluded (is a non-article namespace page).
 * @param {string} title
 * @returns {boolean}
 */
function isExcludedTitle(title) {
  for (const prefix of EXCLUDED_NAMESPACE_PREFIXES) {
    if (title.startsWith(prefix)) return true
  }
  return false
}

/**
 * Derives the wiki category label from a Vital Articles sub-page title.
 * e.g. "Wikipedia:Vital_articles/Level/4/Geography" → "Geography"
 *      "Wikipedia:Vital_articles/Level/4/Science/Biology/Animals" → "Science/Biology/Animals"
 * @param {string} subPageTitle
 * @returns {string}
 */
function subPageToCategory(subPageTitle) {
  // Normalize to spaces for consistent matching
  const norm = subPageTitle.replace(/_/g, ' ')
  const prefix = 'Wikipedia:Vital articles/Level/4/'
  if (norm.startsWith(prefix)) {
    return norm.slice(prefix.length)
  }
  return norm
}

/**
 * Builds MediaWiki API URL for fetching links from a page.
 * @param {string} pageTitle
 * @param {string|undefined} plcontinue  Continuation token for paged results
 * @returns {string}
 */
function buildLinksUrl(pageTitle, plcontinue) {
  const params = new URLSearchParams({
    action: 'query',
    titles: pageTitle,
    prop: 'links',
    pllimit: '500',
    format: 'json',
    formatversion: '2',
  })
  if (plcontinue) params.set('plcontinue', plcontinue)
  return `${MEDIAWIKI_API}?${params}`
}

/**
 * Builds MediaWiki API URL for parsing links from a page (used for main L4 page
 * to discover sub-pages).
 * @param {string} pageTitle
 * @returns {string}
 */
function buildParseLinksUrl(pageTitle) {
  const params = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'links',
    format: 'json',
    formatversion: '2',
  })
  return `${MEDIAWIKI_API}?${params}`
}

// ---------------------------------------------------------------------------
// Step 1: Discover sub-pages from main Vital Articles L4 page
// ---------------------------------------------------------------------------

/**
 * Fetches the main Vital Articles L4 page and returns all sub-page titles
 * matching Wikipedia:Vital_articles/Level/4/*.
 * @returns {Promise<string[]>}
 */
async function fetchSubPageList() {
  console.log('Fetching main Vital Articles L4 page to discover sub-pages...')

  const url = buildParseLinksUrl('Wikipedia:Vital_articles/Level/4')
  let data

  try {
    data = await fetchJson(url, {
      headers: { 'User-Agent': USER_AGENT },
      onRetry: ({ attempt, error }) =>
        console.warn(`  Retry ${attempt} for main page: ${error.message}`),
    })
  } catch (err) {
    console.error(`Failed to fetch main L4 page: ${err.message}`)
    throw err
  }

  const links = data?.parse?.links ?? []
  const subPages = links
    .map((l) => (typeof l === 'string' ? l : l['*'] ?? l.title ?? ''))
    .filter((title) => {
      // API may return spaces or underscores — normalize both
      const norm = title.replace(/_/g, ' ')
      return norm.startsWith('Wikipedia:Vital articles/Level/4/')
    })

  console.log(`  Found ${subPages.length} sub-pages.`)
  return subPages
}

// ---------------------------------------------------------------------------
// Step 2: Fetch article titles from each sub-page
// ---------------------------------------------------------------------------

/**
 * Fetches all article links from a single sub-page, handling API pagination.
 * Returns an array of plain article title strings.
 * @param {string} subPageTitle
 * @returns {Promise<string[]>}
 */
async function fetchArticlesFromSubPage(subPageTitle) {
  const titles = []
  let plcontinue

  do {
    const url = buildLinksUrl(subPageTitle, plcontinue)
    let data

    try {
      data = await fetchJson(url, {
        headers: { 'User-Agent': USER_AGENT },
        onRetry: ({ attempt, error }) =>
          console.warn(`  Retry ${attempt} for "${subPageTitle}": ${error.message}`),
      })
    } catch (err) {
      console.warn(`  Warning: failed to fetch sub-page "${subPageTitle}": ${err.message}`)
      return titles
    }

    const pages = data?.query?.pages ?? []
    // formatversion=2 returns pages as an array
    const pageArr = Array.isArray(pages) ? pages : Object.values(pages)

    for (const page of pageArr) {
      const links = page.links ?? []
      for (const link of links) {
        const title = typeof link === 'string' ? link : link.title ?? ''
        if (title && !isExcludedTitle(title)) {
          titles.push(title)
        }
      }
    }

    plcontinue = data?.continue?.plcontinue ?? null
  } while (plcontinue)

  return titles
}

/**
 * Fetches all Vital Articles L4 article titles across all sub-pages.
 * Returns an array of {title, wikiCategory} objects.
 * @param {string[]} subPages
 * @returns {Promise<Array<{title: string, wikiCategory: string}>>}
 */
async function fetchAllArticleTitles(subPages) {
  /** @type {Array<{title: string, wikiCategory: string}>} */
  const results = []

  for (let i = 0; i < subPages.length; i++) {
    const subPage = subPages[i]
    const category = subPageToCategory(subPage)

    const articles = await fetchArticlesFromSubPage(subPage)
    console.log(
      `  [${i + 1}/${subPages.length}] "${category}" → ${articles.length} articles`,
    )

    for (const title of articles) {
      results.push({ title, wikiCategory: category })
    }

    if (i < subPages.length - 1) {
      await sleep(MEDIAWIKI_DELAY_MS)
    }
  }

  // Deduplicate by title (keep first occurrence / first category)
  const distinct = takeDistinct(results, (r) => r.title)
  console.log(
    `\nTotal articles collected: ${results.length} (${distinct.length} unique after dedup)`,
  )
  return distinct
}

// ---------------------------------------------------------------------------
// Step 3: Map titles to Wikidata Q-IDs
// ---------------------------------------------------------------------------

/**
 * Maps a batch of up to 50 Wikipedia titles to Wikidata Q-IDs.
 * Returns a Map<title, qid|null>.
 * @param {string[]} titles  Array of up to 50 titles
 * @returns {Promise<Map<string, string|null>>}
 */
async function fetchQidBatch(titles) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    sites: 'enwiki',
    titles: titles.join('|'),
    props: 'info|sitelinks',
    sitefilter: 'enwiki',
    format: 'json',
  })
  const url = `${WIKIDATA_API}?${params}`

  let data
  try {
    data = await fetchJson(url, {
      headers: { 'User-Agent': USER_AGENT },
      retries: 3,
      retryDelayMs: 3000,
      onRetry: ({ attempt, error }) =>
        console.warn(`  Retry ${attempt} for QID batch: ${error.message}`),
    })
  } catch (err) {
    console.warn(`  Warning: Q-ID batch fetch failed: ${err.message}`)
    return new Map(titles.map((t) => [t, null]))
  }

  /** @type {Map<string, string|null>} */
  const qidMap = new Map()

  const entities = data?.entities ?? {}
  for (const [id, entity] of Object.entries(entities)) {
    if (id === '-1' || entity.missing !== undefined) {
      // missing item — title from the sitelinks alias
      const sitelink = entity?.sitelinks?.enwiki?.title ?? null
      if (sitelink) qidMap.set(sitelink, null)
      continue
    }
    // entity.title is the Q-ID (e.g. "Q12345")
    const qid = entity.id ?? null
    // The enwiki sitelink title tells us which input title this maps to
    const sitelinkTitle = entity?.sitelinks?.enwiki?.title ?? null
    if (qid && sitelinkTitle) {
      qidMap.set(sitelinkTitle, qid)
    } else if (qid) {
      // Fallback: try to match by checking input titles
      // (sitelinks may be absent when only props=info is requested)
      // We'll resolve this below via the labels approach
    }
  }

  // For titles not yet resolved via sitelinks, build a lookup from
  // the API's normalised/redirected title mappings
  const normalized = data?.normalized ?? []
  const redirects = data?.redirects ?? []

  // Build reverse lookup: canonical title → original title
  const canonMap = new Map()
  for (const n of normalized) {
    canonMap.set(n.to, n.from)
  }
  for (const r of redirects) {
    canonMap.set(r.to, canonMap.get(r.from) ?? r.from)
  }

  // Re-pass entities to fill any still-missing mappings
  for (const [id, entity] of Object.entries(entities)) {
    if (id === '-1' || entity.missing !== undefined) continue
    const qid = entity.id ?? null
    const sitelinkTitle = entity?.sitelinks?.enwiki?.title ?? null
    if (!qid) continue

    if (sitelinkTitle && !qidMap.has(sitelinkTitle)) {
      qidMap.set(sitelinkTitle, qid)
    }

    // Also map the original (pre-normalisation) title if applicable
    const originalTitle = canonMap.get(sitelinkTitle ?? '')
    if (originalTitle && !qidMap.has(originalTitle)) {
      qidMap.set(originalTitle, qid)
    }
  }

  // Ensure every input title has an entry (even if null)
  for (const title of titles) {
    if (!qidMap.has(title)) qidMap.set(title, null)
  }

  return qidMap
}

/**
 * Maps all article titles to Wikidata Q-IDs, batching by WIKIDATA_BATCH_SIZE.
 * Writes intermediate results every INTERMEDIATE_SAVE_EVERY articles.
 *
 * @param {Array<{title: string, wikiCategory: string}>} articles
 * @returns {Promise<Array<{title: string, qid: string|null, wikiCategory: string}>>}
 */
async function mapQids(articles) {
  console.log(`\nMapping ${articles.length} articles to Wikidata Q-IDs...`)

  /** @type {Array<{title: string, qid: string|null, wikiCategory: string}>} */
  const results = []
  let unmapped = 0

  for (let i = 0; i < articles.length; i += WIKIDATA_BATCH_SIZE) {
    const batch = articles.slice(i, i + WIKIDATA_BATCH_SIZE)
    const titles = batch.map((a) => a.title)

    const qidMap = await fetchQidBatch(titles)

    for (const article of batch) {
      const qid = qidMap.get(article.title) ?? null
      if (!qid) unmapped++
      results.push({ title: article.title, qid, wikiCategory: article.wikiCategory })
    }

    const processed = Math.min(i + WIKIDATA_BATCH_SIZE, articles.length)

    // Progress log every 500 articles
    if (processed % 500 < WIKIDATA_BATCH_SIZE || processed === articles.length) {
      const mapped = processed - unmapped
      console.log(
        `  Q-ID progress: ${processed}/${articles.length} processed, ` +
          `${mapped} mapped, ${unmapped} unmapped`,
      )
    }

    // Save intermediate results every INTERMEDIATE_SAVE_EVERY articles
    if (processed % INTERMEDIATE_SAVE_EVERY < WIKIDATA_BATCH_SIZE || processed === articles.length) {
      await writeJson(INTERMEDIATE_PATH, results)
      console.log(`  Intermediate save: ${results.length} records written to ${INTERMEDIATE_PATH}`)
    }

    if (i + WIKIDATA_BATCH_SIZE < articles.length) {
      await sleep(WIKIDATA_BATCH_DELAY_MS)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs(process.argv, { force: false, 'skip-qids': false })
  const force = Boolean(args.force)
  const skipQids = Boolean(args['skip-qids'])

  console.log('=== fetch-vital-articles.mjs ===')
  console.log(`Output: ${OUTPUT_PATH}`)
  console.log(`Options: force=${force}, skip-qids=${skipQids}\n`)

  // Check if output already exists and --force not set
  if (!force) {
    try {
      await fs.access(OUTPUT_PATH)
      console.log('Output file already exists. Use --force to re-fetch.')
      process.exit(0)
    } catch {
      // File doesn't exist — proceed
    }
  }

  // --- Step 1: Discover sub-pages ---
  const subPages = await fetchSubPageList()

  if (subPages.length === 0) {
    console.error('No sub-pages found. The main L4 page structure may have changed.')
    process.exit(1)
  }

  // --- Step 2: Fetch article titles from all sub-pages ---
  console.log(`\nFetching articles from ${subPages.length} sub-pages...\n`)
  const articles = await fetchAllArticleTitles(subPages)

  if (articles.length === 0) {
    console.error('No articles found. Check MediaWiki API response format.')
    process.exit(1)
  }

  // --- Step 3 (optional): Map to Wikidata Q-IDs ---
  let finalResults

  if (skipQids) {
    console.log('\nSkipping Q-ID mapping (--skip-qids).')
    finalResults = articles.map((a) => ({ title: a.title, qid: null, wikiCategory: a.wikiCategory }))
  } else {
    finalResults = await mapQids(articles)
  }

  // --- Write final output ---
  await writeJson(OUTPUT_PATH, finalResults)

  // Clean up intermediate file if it exists
  try {
    await fs.unlink(INTERMEDIATE_PATH)
  } catch {
    // Intermediate file may not exist — that's fine
  }

  // --- Summary ---
  const mappedCount = finalResults.filter((r) => r.qid !== null).length
  const unmappedCount = finalResults.length - mappedCount

  console.log('\n=== Summary ===')
  console.log(`Total articles:    ${finalResults.length}`)
  if (!skipQids) {
    console.log(`Mapped Q-IDs:      ${mappedCount}`)
    console.log(`Unmapped articles: ${unmappedCount}`)
  }
  console.log(`Output written to: ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
