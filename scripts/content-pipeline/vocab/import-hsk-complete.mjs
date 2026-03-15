#!/usr/bin/env node
/**
 * import-hsk-complete.mjs
 *
 * Downloads or reads the drkameleon/complete-hsk-vocabulary dataset and
 * transforms it to the intermediate vocab format used by the content pipeline.
 *
 * Usage:
 *   node import-hsk-complete.mjs [--input path] [--url URL] [--output-dir path] [--limit N]
 *
 * Options:
 *   --input       Path to a local complete.json file (skips network download)
 *   --url         URL to fetch the dataset from (default: GitHub raw URL)
 *   --output-dir  Directory for output files (default: data/curated/vocab/zh)
 *   --limit       Maximum entries to output, 0 = no limit (default: 0)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson } from './shared.mjs'
import fs from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DEFAULT_URL =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json'

const SOURCE_NAME = 'Complete HSK Vocabulary (drkameleon)'
const SOURCE_URL = 'https://github.com/drkameleon/complete-hsk-vocabulary'

// ---------------------------------------------------------------------------
// Level-mapping helpers
// ---------------------------------------------------------------------------

/**
 * Parse the raw HSK level tag (e.g. "new-3", "old-6") into a numeric level.
 * Returns { version: 'new'|'old', level: number }.
 *
 * @param {string} tag
 * @returns {{ version: string, level: number } | null}
 */
function parseLevel(tag) {
  const match = String(tag || '').match(/^(new|old)-(\d+)$/)
  if (!match) return null
  return { version: match[1], level: Number(match[2]) }
}

/**
 * Choose the most relevant numeric HSK level from an entry's `level` array.
 * Prefers "new-*" (HSK 3.0) over "old-*" (HSK 2.0).
 * Returns null if no valid level tag found.
 *
 * @param {string[]} levelTags
 * @returns {number | null}
 */
function pickHskLevel(levelTags) {
  if (!Array.isArray(levelTags) || levelTags.length === 0) return null

  const parsed = levelTags.map(parseLevel).filter(Boolean)
  if (parsed.length === 0) return null

  // Prefer new-* (HSK 3.0)
  const newLevels = parsed.filter((p) => p.version === 'new')
  if (newLevels.length > 0) {
    return Math.min(...newLevels.map((p) => p.level))
  }

  // Fall back to old-*
  const oldLevels = parsed.filter((p) => p.version === 'old')
  if (oldLevels.length > 0) {
    return Math.min(...oldLevels.map((p) => p.level))
  }

  return null
}

/**
 * Map a numeric HSK level to a CEFR string.
 * HSK 3.0 has levels 1–9; levels 7-9 all map to C2.
 *
 * @param {number} level
 * @returns {string}
 */
function hskToCefr(level) {
  if (level <= 1) return 'A1'
  if (level === 2) return 'A2'
  if (level === 3) return 'B1'
  if (level === 4) return 'B2'
  if (level === 5) return 'C1'
  return 'C2' // 6, 7, 8, 9
}

/**
 * Map a numeric HSK level to a numeric difficulty (1–5).
 *
 * @param {number} level
 * @returns {number}
 */
function hskToDifficulty(level) {
  if (level <= 2) return 1
  if (level === 3) return 2
  if (level === 4) return 3
  if (level === 5) return 4
  return 5 // 6+
}

/**
 * Map a numeric HSK level to the label string used in the output (e.g. "HSK3").
 *
 * @param {number} level
 * @returns {string}
 */
function hskLabel(level) {
  return `HSK${level}`
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Load raw JSON from a local file or remote URL.
 *
 * @param {string} inputPath  Local file path (may be empty string)
 * @param {string} url        Remote URL to fetch if no local file given
 * @returns {Promise<unknown>}
 */
async function loadSource(inputPath, url) {
  if (inputPath) {
    console.log(`[import-hsk-complete] Reading local file: ${inputPath}`)
    const text = await fs.readFile(inputPath, 'utf8')
    return JSON.parse(text)
  }

  console.log(`[import-hsk-complete] Downloading: ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }
  return response.json()
}

// ---------------------------------------------------------------------------
// Transformation
// ---------------------------------------------------------------------------

/**
 * Transform raw complete.json entries into the intermediate vocab format.
 * Deduplicates on simplified characters, keeping the entry with the lowest
 * HSK level. Sorts by HSK level ascending, then frequency ascending.
 *
 * @param {unknown[]} raw
 * @param {number} limit  0 = no limit
 * @returns {object[]}
 */
function transformEntries(raw, limit) {
  if (!Array.isArray(raw)) {
    throw new TypeError('Source data must be a JSON array')
  }

  // Deduplication map: simplified -> best entry so far
  /** @type {Map<string, { hskLevel: number, entry: object }>} */
  const dedupeMap = new Map()

  for (const item of raw) {
    const simplified = String(item?.simplified || '').trim()
    if (!simplified) continue

    const forms = Array.isArray(item?.forms) ? item.forms : []
    const form = forms[0] ?? {}

    const meanings = Array.isArray(form?.meanings)
      ? form.meanings.map((m) => String(m || '').trim()).filter(Boolean)
      : []

    if (meanings.length === 0) continue

    const hskLevel = pickHskLevel(item?.level)
    if (hskLevel === null) continue

    // Deduplicate: keep the entry with the lower HSK level (more basic)
    const existing = dedupeMap.get(simplified)
    if (existing && existing.hskLevel <= hskLevel) continue

    const traditional = String(form?.traditional || simplified).trim()
    const reading = String(form?.transcriptions?.pinyin || '').trim()
    const pos = Array.isArray(item?.pos)
      ? item.pos.map((p) => String(p || '').trim()).filter(Boolean)
      : []
    const frequencyRank =
      typeof item?.frequency === 'number' && item.frequency > 0
        ? item.frequency
        : null

    dedupeMap.set(simplified, {
      hskLevel,
      entry: {
        simplified,
        traditional,
        reading,
        englishTranslation: meanings[0],
        allMeanings: meanings,
        pos,
        hskLevel,
        frequencyRank,
      },
    })
  }

  // Sort by HSK level asc, then frequency asc (nulls last)
  const sorted = [...dedupeMap.values()].sort((a, b) => {
    if (a.hskLevel !== b.hskLevel) return a.hskLevel - b.hskLevel
    const fa = a.entry.frequencyRank ?? Infinity
    const fb = b.entry.frequencyRank ?? Infinity
    return fa - fb
  })

  // Apply limit
  const sliced = limit > 0 ? sorted.slice(0, limit) : sorted

  // Assign stable sequential IDs and build final output shape
  return sliced.map(({ entry }, index) => ({
    id: `zh-hsk-${index + 1}`,
    targetWord: entry.simplified,
    traditional: entry.traditional,
    reading: entry.reading,
    englishTranslation: entry.englishTranslation,
    allMeanings: entry.allMeanings,
    language: 'zh',
    partOfSpeech: entry.pos,
    level: hskLabel(entry.hskLevel),
    hskLevel: entry.hskLevel,
    cefrLevel: hskToCefr(entry.hskLevel),
    difficulty: hskToDifficulty(entry.hskLevel),
    frequencyRank: entry.frequencyRank,
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
  }))
}

// ---------------------------------------------------------------------------
// Summary printing
// ---------------------------------------------------------------------------

/**
 * Print a human-readable summary of the output to stdout.
 *
 * @param {object[]} words
 */
function printSummary(words) {
  const byHsk = {}
  const byCefr = {}

  for (const w of words) {
    const hKey = `HSK${w.hskLevel}`
    byHsk[hKey] = (byHsk[hKey] ?? 0) + 1
    byCefr[w.cefrLevel] = (byCefr[w.cefrLevel] ?? 0) + 1
  }

  console.log(`\n[import-hsk-complete] Summary`)
  console.log(`  Total words: ${words.length}`)
  console.log(`  By HSK level:`)
  for (const [k, v] of Object.entries(byHsk).sort()) {
    console.log(`    ${k}: ${v}`)
  }
  console.log(`  By CEFR level:`)
  for (const [k, v] of Object.entries(byCefr).sort()) {
    console.log(`    ${k}: ${v}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    url: DEFAULT_URL,
    'output-dir': 'data/curated/vocab/zh',
    limit: 0,
  })

  const inputPath = args.input ? path.resolve(root, String(args.input)) : ''
  const url = String(args.url || DEFAULT_URL)
  const outputDir = path.resolve(root, String(args['output-dir']))
  const limit = Number(args.limit) >= 0 ? Number(args.limit) : 0

  const raw = await loadSource(inputPath, url)
  const words = transformEntries(raw, limit)

  const allPath = path.join(outputDir, 'vocab-zh-all.json')
  await writeJson(allPath, words)
  console.log(`[import-hsk-complete] Wrote ${words.length} words → ${allPath}`)

  printSummary(words)
}

main().catch((err) => {
  console.error('[import-hsk-complete] Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
