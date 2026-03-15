#!/usr/bin/env node
/**
 * build-japanese-vocab.mjs
 *
 * Builds Japanese vocabulary by joining JMdict (translations/readings) with
 * JLPT level lists. Outputs a unified vocab-ja-all.json with one entry per
 * word, tagged by JLPT level, CEFR level, and normalized POS.
 *
 * Usage:
 *   node scripts/content-pipeline/vocab/build-japanese-vocab.mjs \
 *     --jmdict data/references/jmdict/jmdict-eng-common-3.6.2.json \
 *     --jlpt-dir data/references/jlpt \
 *     --output-dir data/curated/vocab/ja
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

// ---------------------------------------------------------------------------
// Level mappings
// ---------------------------------------------------------------------------

/** JLPT numeric level → metadata. N5=easiest (5), N1=hardest (1). */
const LEVEL_META = {
  5: { label: 'N5', cefr: 'A1', difficulty: 1, rarity: 'common',   subcategory: 'japanese_n5' },
  4: { label: 'N4', cefr: 'A2', difficulty: 1, rarity: 'common',   subcategory: 'japanese_n4' },
  3: { label: 'N3', cefr: 'B1', difficulty: 2, rarity: 'uncommon', subcategory: 'japanese_n3' },
  2: { label: 'N2', cefr: 'B2', difficulty: 3, rarity: 'uncommon', subcategory: 'japanese_n2' },
  1: { label: 'N1', cefr: 'C1', difficulty: 4, rarity: 'rare',     subcategory: 'japanese_n1' },
}

/** Ordered from easiest to hardest for sorting purposes. */
const JLPT_ORDER = [5, 4, 3, 2, 1]

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line, respecting double-quoted fields that may contain
 * commas. Strips surrounding quotes from field values.
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// ---------------------------------------------------------------------------
// POS normalization
// ---------------------------------------------------------------------------

/**
 * Normalize JMdict POS tag arrays into simple human-readable labels.
 * JMdict uses fine-grained codes like "v5u", "adj-i", "n-suf" etc.
 *
 * @param {string[]} posTags
 * @returns {string[]}
 */
function normalizeJmdictPos(posTags) {
  if (!Array.isArray(posTags) || posTags.length === 0) return ['word']
  const mapped = new Set()
  for (const tag of posTags) {
    if (/^v[15]|^vk|^vs(-[a-z]+)?$|^vi$|^vz$|^vr$|^vn$/i.test(tag)) {
      mapped.add('verb')
    } else if (/^adj/i.test(tag)) {
      mapped.add('adjective')
    } else if (/^adv/i.test(tag)) {
      mapped.add('adverb')
    } else if (/^n$|^n-/i.test(tag)) {
      mapped.add('noun')
    } else if (/^prt$/i.test(tag)) {
      mapped.add('particle')
    } else if (/^conj$/i.test(tag)) {
      mapped.add('conjunction')
    } else if (/^int$/i.test(tag)) {
      mapped.add('interjection')
    } else if (/^pn$/i.test(tag)) {
      mapped.add('pronoun')
    } else if (/^exp$/i.test(tag)) {
      mapped.add('expression')
    } else if (/^ctr$/i.test(tag)) {
      mapped.add('counter')
    } else if (/^num$/i.test(tag)) {
      mapped.add('numeral')
    } else if (/^pref$/i.test(tag)) {
      mapped.add('prefix')
    } else if (/^suf$/i.test(tag)) {
      mapped.add('suffix')
    } else if (/^aux/i.test(tag)) {
      mapped.add('auxiliary')
    }
    // Unknown tags are silently dropped; 'word' is the fallback below.
  }
  return mapped.size > 0 ? [...mapped] : ['word']
}

// ---------------------------------------------------------------------------
// Step 1: Parse JLPT CSVs → build level lookup
// ---------------------------------------------------------------------------

/**
 * @typedef {{ reading: string, meaning: string, jlptLevel: number }} JlptEntry
 */

/**
 * Read all JLPT CSV files and build a Map from expression → JlptEntry.
 * When a word appears in multiple levels, the LOWEST (easiest) level wins,
 * i.e. the highest numeric value (N5=5 is easiest).
 *
 * @param {string} jlptDir  Absolute path to the directory containing n1–n5.csv
 * @returns {Promise<Map<string, JlptEntry>>}
 */
async function buildJlptLookup(jlptDir) {
  /** @type {Map<string, JlptEntry>} */
  const lookup = new Map()

  // Process from hardest (N1=1) to easiest (N5=5) so that when there are
  // conflicts, the easiest level overwrites the harder one.
  const levelFiles = [
    { numeric: 1, file: 'n1.csv' },
    { numeric: 2, file: 'n2.csv' },
    { numeric: 3, file: 'n3.csv' },
    { numeric: 4, file: 'n4.csv' },
    { numeric: 5, file: 'n5.csv' },
  ]

  for (const { numeric, file } of levelFiles) {
    const filePath = path.join(jlptDir, file)
    let raw
    try {
      raw = await fs.readFile(filePath, 'utf8')
    } catch {
      console.warn(`[jlpt] Warning: could not read ${filePath} — skipping`)
      continue
    }

    const lines = raw.split('\n')
    let skipped = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const fields = parseCSVLine(line)
      // Header row: expression,reading,meaning,tags,guid
      if (i === 0 && fields[0].toLowerCase() === 'expression') continue

      const [expression, reading, meaning] = fields
      if (!expression) { skipped++; continue }

      lookup.set(expression, {
        reading: reading ?? '',
        meaning: meaning ?? '',
        jlptLevel: numeric,
      })
    }

    const label = LEVEL_META[numeric].label
    console.log(`[jlpt] Loaded ${label}: ${lookup.size} cumulative entries (skipped ${skipped} blank)`)
  }

  return lookup
}

// ---------------------------------------------------------------------------
// Step 2: Load JMdict → build word lookup
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   id: string,
 *   kanji: Array<{ common: boolean, text: string, tags: string[] }>,
 *   kana: Array<{ common: boolean, text: string, tags: string[], appliesToKanji: string[] }>,
 *   sense: Array<{
 *     partOfSpeech: string[],
 *     gloss: Array<{ lang: string, text: string }>,
 *     field: string[],
 *     misc: string[],
 *     info: string[]
 *   }>
 * }} JMdictEntry
 */

/**
 * Load JMdict JSON and build lookup maps keyed by kanji form and kana form.
 * Common-flagged entries are preferred; if both common and non-common exist
 * for the same key, the common entry wins.
 *
 * @param {string} jmdictPath  Absolute path to the JMdict JSON file
 * @returns {Promise<Map<string, JMdictEntry>>}
 */
async function buildJmdictLookup(jmdictPath) {
  console.log('[jmdict] Loading JMdict (this may take a moment)…')
  const raw = await readJson(jmdictPath)

  // scriptin/jmdict-simplified wraps entries under a `words` key
  /** @type {JMdictEntry[]} */
  const entries = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.words)
      ? raw.words
      : Array.isArray(raw?.entries)
        ? raw.entries
        : []

  console.log(`[jmdict] Parsed ${entries.length.toLocaleString()} entries`)

  /** @type {Map<string, JMdictEntry>} */
  const lookup = new Map()

  /**
   * Insert entry into the lookup, preferring common entries over non-common.
   * @param {string} key
   * @param {JMdictEntry} entry
   * @param {boolean} isCommon
   */
  function insertIfBetter(key, entry, isCommon) {
    if (!key) return
    const existing = lookup.get(key)
    if (!existing) {
      lookup.set(key, entry)
    } else if (isCommon) {
      // Overwrite a non-common entry with a common one
      const existingCommon =
        existing.kanji?.[0]?.common === true || existing.kana?.[0]?.common === true
      if (!existingCommon) {
        lookup.set(key, entry)
      }
    }
  }

  for (const entry of entries) {
    const kanji = Array.isArray(entry.kanji) ? entry.kanji : []
    const kana = Array.isArray(entry.kana) ? entry.kana : []

    const kanjiText = kanji[0]?.text ?? null
    const kanaText = kana[0]?.text ?? null
    const isCommon = kanji[0]?.common === true || kana[0]?.common === true

    if (kanjiText) insertIfBetter(kanjiText, entry, isCommon)
    if (kanaText) insertIfBetter(kanaText, entry, isCommon)
  }

  console.log(`[jmdict] Built lookup with ${lookup.size.toLocaleString()} keys`)
  return lookup
}

// ---------------------------------------------------------------------------
// Step 3: Join JLPT words against JMdict
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   id: string,
 *   targetWord: string,
 *   reading: string,
 *   englishTranslation: string,
 *   allMeanings: string[],
 *   language: 'ja',
 *   partOfSpeech: string[],
 *   level: string,
 *   jlptLevel: number,
 *   cefrLevel: string,
 *   difficulty: number,
 *   frequencyRank: null,
 *   sourceName: string,
 *   sourceUrl: string
 * }} VocabEntry
 */

/**
 * Join JLPT level entries with JMdict data to produce unified vocab entries.
 *
 * @param {Map<string, import('./shared.mjs').JlptEntry>} jlptLookup
 * @param {Map<string, JMdictEntry>} jmdictLookup
 * @returns {{ entries: VocabEntry[], matchedCount: number, unmatchedCount: number }}
 */
function joinJlptWithJmdict(jlptLookup, jmdictLookup) {
  /** @type {VocabEntry[]} */
  const entries = []
  let matchedCount = 0
  let unmatchedCount = 0
  let idCounter = 0

  for (const [expression, jlptData] of jlptLookup) {
    idCounter++
    const meta = LEVEL_META[jlptData.jlptLevel]

    // Try to find in JMdict: first by kanji/expression, then by kana/reading
    const jmEntry = jmdictLookup.get(expression) ?? jmdictLookup.get(jlptData.reading) ?? null

    let targetWord
    let reading
    let englishTranslation
    let allMeanings
    let partOfSpeech

    if (jmEntry) {
      matchedCount++
      const kanji = Array.isArray(jmEntry.kanji) ? jmEntry.kanji : []
      const kana = Array.isArray(jmEntry.kana) ? jmEntry.kana : []
      const senses = Array.isArray(jmEntry.sense) ? jmEntry.sense : []

      targetWord = kanji[0]?.text ?? kana[0]?.text ?? expression
      reading = kana[0]?.text ?? jlptData.reading ?? ''

      // Collect all English glosses across all senses
      const engGlosses = senses.flatMap((sense) => {
        if (!Array.isArray(sense.gloss)) return []
        return sense.gloss
          .filter((g) => g.lang === 'eng' && typeof g.text === 'string' && g.text.trim())
          .map((g) => g.text.trim())
      })

      allMeanings = [...new Set(engGlosses)]
      englishTranslation = allMeanings[0] ?? jlptData.meaning ?? ''

      // Normalize POS from all senses (use first sense's POS as primary)
      const allPos = senses.flatMap((s) => Array.isArray(s.partOfSpeech) ? s.partOfSpeech : [])
      partOfSpeech = normalizeJmdictPos(allPos)
    } else {
      unmatchedCount++
      // Fall back to JLPT CSV data
      targetWord = expression
      reading = jlptData.reading ?? ''
      englishTranslation = jlptData.meaning ?? ''
      // Split comma-separated meanings from the CSV meaning field
      allMeanings = jlptData.meaning
        ? jlptData.meaning.split(',').map((m) => m.trim()).filter(Boolean)
        : []
      partOfSpeech = ['word']
    }

    entries.push({
      id: `ja-jlpt-${idCounter}`,
      targetWord,
      reading,
      englishTranslation,
      allMeanings,
      language: 'ja',
      partOfSpeech,
      level: meta.label,
      jlptLevel: jlptData.jlptLevel,
      cefrLevel: meta.cefr,
      difficulty: meta.difficulty,
      frequencyRank: null,
      sourceName: 'JMdict + JLPT (jamsinclair)',
      sourceUrl: 'https://github.com/scriptin/jmdict-simplified',
    })
  }

  return { entries, matchedCount, unmatchedCount }
}

// ---------------------------------------------------------------------------
// Step 4: Deduplicate and sort
// ---------------------------------------------------------------------------

/**
 * Deduplicate entries on `targetWord`, keeping the entry with the lowest
 * JLPT level (highest numeric value = easiest). Then sort by level (N5
 * first), then alphabetically by targetWord.
 *
 * @param {VocabEntry[]} entries
 * @returns {VocabEntry[]}
 */
function deduplicateAndSort(entries) {
  /** @type {Map<string, VocabEntry>} */
  const byWord = new Map()

  for (const entry of entries) {
    const existing = byWord.get(entry.targetWord)
    if (!existing) {
      byWord.set(entry.targetWord, entry)
    } else {
      // Keep the easiest (highest numeric jlptLevel) entry
      if (entry.jlptLevel > existing.jlptLevel) {
        byWord.set(entry.targetWord, entry)
      }
    }
  }

  return [...byWord.values()].sort((a, b) => {
    // Sort N5 (5) first, N1 (1) last — i.e. descending numeric
    const levelDiff = b.jlptLevel - a.jlptLevel
    if (levelDiff !== 0) return levelDiff
    return a.targetWord.localeCompare(b.targetWord, 'ja')
  })
}

// ---------------------------------------------------------------------------
// Step 5: Re-assign sequential IDs after dedup/sort
// ---------------------------------------------------------------------------

/**
 * @param {VocabEntry[]} entries
 * @returns {VocabEntry[]}
 */
function reassignIds(entries) {
  return entries.map((entry, i) => ({ ...entry, id: `ja-jlpt-${i + 1}` }))
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

/**
 * @param {VocabEntry[]} entries
 */
function printSummary(entries, matchedCount, unmatchedCount) {
  const byLevel = Object.fromEntries(JLPT_ORDER.map((n) => [LEVEL_META[n].label, 0]))
  for (const e of entries) {
    byLevel[e.level] = (byLevel[e.level] ?? 0) + 1
  }

  console.log('\n=== Build Summary ===')
  console.log(`Total words:      ${entries.length.toLocaleString()}`)
  console.log(`JMdict matched:   ${matchedCount.toLocaleString()}`)
  console.log(`JMdict unmatched: ${unmatchedCount.toLocaleString()} (used CSV meaning)`)
  console.log('\nBreakdown by JLPT level (easiest → hardest):')
  for (const n of JLPT_ORDER) {
    const label = LEVEL_META[n].label
    const count = byLevel[label] ?? 0
    console.log(`  ${label} (${LEVEL_META[n].cefr}): ${count.toLocaleString()} words`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv, {
    jmdict: '',
    'jlpt-dir': 'data/references/jlpt',
    'output-dir': 'data/curated/vocab/ja',
  })

  const jmdictPath = args.jmdict
    ? path.resolve(root, String(args.jmdict))
    : null

  if (!jmdictPath) {
    console.error('[build-japanese-vocab] Error: --jmdict <path> is required')
    process.exit(1)
  }

  const jlptDir = path.resolve(root, String(args['jlpt-dir']))
  const outputDir = path.resolve(root, String(args['output-dir']))

  console.log('[build-japanese-vocab] Starting Japanese vocab build')
  console.log(`  JMdict:     ${jmdictPath}`)
  console.log(`  JLPT dir:   ${jlptDir}`)
  console.log(`  Output dir: ${outputDir}`)
  console.log()

  // Step 1: Parse JLPT CSVs
  const jlptLookup = await buildJlptLookup(jlptDir)
  console.log(`\n[jlpt] Total unique expressions across all levels: ${jlptLookup.size.toLocaleString()}`)

  // Step 2: Load JMdict
  const jmdictLookup = await buildJmdictLookup(jmdictPath)

  // Step 3: Join
  console.log('\n[join] Joining JLPT words with JMdict…')
  const { entries: rawEntries, matchedCount, unmatchedCount } = joinJlptWithJmdict(jlptLookup, jmdictLookup)

  // Step 4: Deduplicate and sort
  console.log('[dedup] Deduplicating and sorting…')
  const sorted = deduplicateAndSort(rawEntries)

  // Step 5: Re-assign sequential IDs
  const finalEntries = reassignIds(sorted)

  // Step 6: Write output
  const outputPath = path.join(outputDir, 'vocab-ja-all.json')
  await writeJson(outputPath, finalEntries)
  console.log(`\n[output] Wrote ${finalEntries.length.toLocaleString()} entries → ${outputPath}`)

  // Summary
  printSummary(finalEntries, matchedCount, unmatchedCount)
}

main().catch((err) => {
  console.error('[build-japanese-vocab] Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
