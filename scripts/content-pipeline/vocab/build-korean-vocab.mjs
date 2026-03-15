#!/usr/bin/env node
/**
 * build-korean-vocab.mjs
 *
 * Builds Korean vocabulary from the NIKL Korean-English Dictionary.
 * Filters to levelled content words (명사/동사/형용사/부사), maps NIKL vocabulary
 * levels to CEFR equivalents, cleans English definitions, deduplicates on the
 * Korean form, and writes a unified vocab-ko-all.json.
 *
 * Usage:
 *   node scripts/content-pipeline/vocab/build-korean-vocab.mjs \
 *     --nikl data/references/nikl/nikl-dict.json \
 *     --output-dir data/curated/vocab/ko
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CEFR levels in ascending order of difficulty. */
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * Korean POS labels to normalized English labels.
 * Only noun/verb/adjective/adverb pass through the content-word filter.
 *
 * @type {Record<string, string>}
 */
const KO_POS_MAP = {
  '명사': 'noun',
  '동사': 'verb',
  '형용사': 'adjective',
  '부사': 'adverb',
  '관형사': 'determiner',
  '의존 명사': 'noun',
  '대명사': 'pronoun',
  '수사': 'numeral',
  '감탄사': 'interjection',
  '조사': 'particle',
  '접사': 'affix',
  '어미': 'suffix',
  '보조 동사': 'verb',
  '보조 형용사': 'adjective',
}

/** POS labels we keep after normalization — content words only. */
const CONTENT_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])

/**
 * NIKL vocabulary level metadata.
 * 초급 entries are split into A1/A2 by form order (first half → A1, second half → A2).
 * 중급 entries are split into B1/B2 similarly.
 * 고급 entries all map to C1.
 */
const NIKL_LEVEL_META = {
  초급: { cefr: 'A1_A2', difficulty: 1, rarity: 'common', subcategory: 'korean_vocab' },
  중급: { cefr: 'B1_B2', difficulty: 2, rarity: 'uncommon', subcategory: 'korean_vocab' },
  고급: { cefr: 'C1', difficulty: 4, rarity: 'rare', subcategory: 'korean_vocab' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a NIKL vocabulary level string to a resolved CEFR level.
 * The split levels (초급→A1/A2, 중급→B1/B2) are resolved after counting,
 * so this returns the intermediate token used in NIKL_LEVEL_META.
 *
 * @param {string} niklLevel  e.g. "초급", "중급", "고급"
 * @returns {string | null}  NIKL_LEVEL_META key or null if unknown/absent
 */
function niklLevelKey(niklLevel) {
  if (!niklLevel) return null
  const trimmed = String(niklLevel).trim()
  return Object.prototype.hasOwnProperty.call(NIKL_LEVEL_META, trimmed) ? trimmed : null
}

/**
 * Map a CEFR level string to a numeric difficulty (1–5).
 *
 * @param {string} cefr
 * @returns {number}
 */
function cefrToDifficulty(cefr) {
  switch (cefr) {
    case 'A1': return 1
    case 'A2': return 1
    case 'B1': return 2
    case 'B2': return 3
    case 'C1': return 4
    case 'C2': return 5
    default: return 2
  }
}

/**
 * Map a CEFR level to a rarity label.
 *
 * @param {string} cefr
 * @returns {'common' | 'uncommon' | 'rare'}
 */
function cefrToRarity(cefr) {
  if (cefr === 'A1' || cefr === 'A2') return 'common'
  if (cefr === 'B1' || cefr === 'B2') return 'uncommon'
  return 'rare'
}

/**
 * Return the sort index (0–5) for a CEFR level string. Unknown levels sort last.
 *
 * @param {string} cefr
 * @returns {number}
 */
function cefrSortIndex(cefr) {
  const idx = CEFR_LEVELS.indexOf(cefr)
  return idx === -1 ? 999 : idx
}

/**
 * Clean a single English definition string from NIKL.
 *
 * Rules:
 * 1. Trim whitespace.
 * 2. Remove a trailing period.
 * 3. For short results (≤40 chars after period removal), strip a leading article
 *    ("A ", "An ", "The ") so the result is the bare word/phrase.
 * 4. For long results (>40 chars) the definition is an explanation — return as-is
 *    (but still stripped of the trailing period).
 *
 * @param {string} raw  e.g. "An apple."
 * @returns {string}    e.g. "apple"
 */
function cleanEnglishDef(raw) {
  let s = String(raw || '').trim()

  // Remove trailing period
  if (s.endsWith('.')) s = s.slice(0, -1).trimEnd()

  // Strip leading article for short definitions only
  if (s.length <= 40) {
    s = s.replace(/^(A|An|The)\s+/i, '')
  }

  return s.trim()
}

/**
 * Produce a deduplicated list of cleaned English definitions.
 * Empty strings after cleaning are dropped.
 *
 * @param {string[]} rawDefs
 * @returns {string[]}
 */
function cleanAllMeanings(rawDefs) {
  const seen = new Set()
  const out = []
  for (const raw of rawDefs) {
    const cleaned = cleanEnglishDef(raw)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    out.push(cleaned)
  }
  return out
}

// ---------------------------------------------------------------------------
// Step 1: Load and filter NIKL JSON
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   form: string,
 *   pos: string,
 *   koreanDefs: string[],
 *   englishDefs: string[],
 *   vocabLevel: string | null,
 *   semanticCategory: string | null
 * }} NiklEntry
 */

/**
 * @typedef {{
 *   form: string,
 *   normalizedPos: string,
 *   niklLevelKey: string,
 *   englishTranslation: string,
 *   allMeanings: string[]
 * }} FilteredEntry
 */

/**
 * Parse a Python-style list literal string into a JavaScript string array.
 * The NIKL JSON stores list fields as strings like "['foo', 'bar']" rather
 * than native JSON arrays.  This function handles that format, and also
 * accepts a real Array (passed through unchanged) so callers are safe either way.
 *
 * @param {string | string[] | null | undefined} value
 * @returns {string[]}
 */
function parsePythonList(value) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return []
  const inner = trimmed.slice(1, -1).trim()
  if (inner === '') return []
  // Split on the delimiter used by Python's str(list): ', '  (comma + space)
  // between quoted items.  Each item is wrapped in single quotes.
  return inner.split(/', '/).map(item => item.replace(/^'|'$/g, '').trim())
}

/**
 * Load the NIKL JSON file and return only entries that:
 * - Have a non-null vocabLevel recognized in NIKL_LEVEL_META
 * - Have a POS that maps to a content-word type (noun/verb/adjective/adverb)
 * - Have at least one non-empty English definition
 *
 * @param {string} niklPath  Absolute path to the NIKL JSON file
 * @returns {Promise<FilteredEntry[]>}
 */
async function loadAndFilter(niklPath) {
  console.log(`\n  Loading NIKL dictionary: ${niklPath}`)
  /** @type {NiklEntry[]} */
  const raw = await readJson(niklPath)

  console.log(`  Total NIKL entries: ${raw.length.toLocaleString()}`)

  let droppedNoLevel = 0
  let droppedBadPos = 0
  let droppedNoEnglish = 0

  /** @type {FilteredEntry[]} */
  const filtered = []

  for (const entry of raw) {
    // Must have a recognized NIKL vocab level
    const levelKey = niklLevelKey(entry.vocabLevel)
    if (!levelKey) {
      droppedNoLevel++
      continue
    }

    // Must map to a content-word POS
    const normalizedPos = KO_POS_MAP[String(entry.pos || '').trim()] ?? null
    if (!normalizedPos || !CONTENT_POS.has(normalizedPos)) {
      droppedBadPos++
      continue
    }

    // Must have at least one non-empty English definition
    const englishDefs = parsePythonList(entry.englishDefs)
    const cleaned = cleanAllMeanings(englishDefs)
    if (cleaned.length === 0) {
      droppedNoEnglish++
      continue
    }

    filtered.push({
      form: String(entry.form || '').trim(),
      normalizedPos,
      niklLevelKey: levelKey,
      englishTranslation: cleaned[0],
      allMeanings: cleaned,
    })
  }

  console.log(`  After filtering: ${filtered.length.toLocaleString()} entries`)
  console.log(`    Dropped (no vocab level):    ${droppedNoLevel.toLocaleString()}`)
  console.log(`    Dropped (non-content POS):   ${droppedBadPos.toLocaleString()}`)
  console.log(`    Dropped (no English def):    ${droppedNoEnglish.toLocaleString()}`)

  return filtered
}

// ---------------------------------------------------------------------------
// Step 2: Deduplicate on form — keep easiest level
// ---------------------------------------------------------------------------

/**
 * NIKL level ordering for "easiest wins" deduplication (lower index = easier).
 */
const NIKL_EASE_ORDER = ['초급', '중급', '고급']

/**
 * Deduplicate filtered entries on the Korean `form` field.
 * When the same form appears at multiple levels, keep the easiest entry
 * (lowest index in NIKL_EASE_ORDER).
 *
 * @param {FilteredEntry[]} entries
 * @returns {FilteredEntry[]}
 */
function deduplicateOnForm(entries) {
  /** @type {Map<string, FilteredEntry>} */
  const byForm = new Map()

  for (const entry of entries) {
    if (!entry.form) continue
    const existing = byForm.get(entry.form)
    if (!existing) {
      byForm.set(entry.form, entry)
      continue
    }
    // Keep the easier entry
    const existingEase = NIKL_EASE_ORDER.indexOf(existing.niklLevelKey)
    const newEase = NIKL_EASE_ORDER.indexOf(entry.niklLevelKey)
    if (newEase < existingEase) {
      byForm.set(entry.form, entry)
    }
  }

  return [...byForm.values()]
}

// ---------------------------------------------------------------------------
// Step 3: Assign split CEFR levels
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   form: string,
 *   normalizedPos: string,
 *   niklLevelKey: string,
 *   cefrLevel: string,
 *   englishTranslation: string,
 *   allMeanings: string[]
 * }} LevelledEntry
 */

/**
 * Assign final CEFR levels to deduplicated entries.
 *
 * 초급 words are sorted alphabetically by form, then the first half get A1
 * and the second half get A2 (approximately equal splits).
 * 중급 words are split the same way into B1 / B2.
 * 고급 words all get C1.
 *
 * @param {FilteredEntry[]} entries
 * @returns {LevelledEntry[]}
 */
function assignCefrLevels(entries) {
  // Bucket by NIKL level
  /** @type {Record<string, FilteredEntry[]>} */
  const buckets = { 초급: [], 중급: [], 고급: [] }
  for (const entry of entries) {
    if (Object.prototype.hasOwnProperty.call(buckets, entry.niklLevelKey)) {
      buckets[entry.niklLevelKey].push(entry)
    }
  }

  /** @type {LevelledEntry[]} */
  const levelled = []

  // 초급 → A1 (first half) / A2 (second half)
  const chogup = [...buckets['초급']].sort((a, b) => a.form.localeCompare(b.form, 'ko'))
  const chogupMid = Math.ceil(chogup.length / 2)
  for (let i = 0; i < chogup.length; i++) {
    levelled.push({ ...chogup[i], cefrLevel: i < chogupMid ? 'A1' : 'A2' })
  }

  // 중급 → B1 (first half) / B2 (second half)
  const junggeup = [...buckets['중급']].sort((a, b) => a.form.localeCompare(b.form, 'ko'))
  const junggeupMid = Math.ceil(junggeup.length / 2)
  for (let i = 0; i < junggeup.length; i++) {
    levelled.push({ ...junggeup[i], cefrLevel: i < junggeupMid ? 'B1' : 'B2' })
  }

  // 고급 → C1
  for (const entry of buckets['고급']) {
    levelled.push({ ...entry, cefrLevel: 'C1' })
  }

  console.log(`\n  CEFR level assignment:`)
  console.log(`    초급 (${chogup.length}) → A1: ${chogupMid}, A2: ${chogup.length - chogupMid}`)
  console.log(`    중급 (${junggeup.length}) → B1: ${junggeupMid}, B2: ${junggeup.length - junggeupMid}`)
  console.log(`    고급 (${buckets['고급'].length}) → C1: ${buckets['고급'].length}`)

  return levelled
}

// ---------------------------------------------------------------------------
// Step 4: Sort
// ---------------------------------------------------------------------------

/**
 * Sort levelled entries by CEFR level (A1 first), then alphabetically by
 * Korean form within each level.
 *
 * @param {LevelledEntry[]} entries
 * @returns {LevelledEntry[]}
 */
function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const levelDiff = cefrSortIndex(a.cefrLevel) - cefrSortIndex(b.cefrLevel)
    if (levelDiff !== 0) return levelDiff
    return a.form.localeCompare(b.form, 'ko')
  })
}

// ---------------------------------------------------------------------------
// Step 5: Build output schema
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   id: string,
 *   targetWord: string,
 *   reading: null,
 *   englishTranslation: string,
 *   allMeanings: string[],
 *   language: 'ko',
 *   partOfSpeech: string[],
 *   level: string,
 *   cefrLevel: string,
 *   difficulty: number,
 *   frequencyRank: null,
 *   sourceName: string,
 *   sourceUrl: string
 * }} VocabEntry
 */

/**
 * Convert sorted levelled entries into the final VocabEntry schema objects.
 *
 * @param {LevelledEntry[]} sorted
 * @returns {VocabEntry[]}
 */
function buildOutput(sorted) {
  return sorted.map((entry, index) => ({
    id: `ko-nikl-${index + 1}`,
    targetWord: entry.form,
    reading: null,
    englishTranslation: entry.englishTranslation,
    allMeanings: entry.allMeanings,
    language: 'ko',
    partOfSpeech: [entry.normalizedPos],
    level: entry.cefrLevel,
    cefrLevel: entry.cefrLevel,
    difficulty: cefrToDifficulty(entry.cefrLevel),
    frequencyRank: null,
    sourceName: 'NIKL Korean-English Dictionary',
    sourceUrl: 'https://huggingface.co/datasets/binjang/NIKL-korean-english-dictionary',
  }))
}

// ---------------------------------------------------------------------------
// Step 6: Print summary
// ---------------------------------------------------------------------------

/**
 * Print a human-readable summary of the final output.
 *
 * @param {VocabEntry[]} entries
 */
function printSummary(entries) {
  /** @type {Record<string, number>} */
  const byCefr = {}
  /** @type {Record<string, number>} */
  const byPos = {}

  for (const entry of entries) {
    byCefr[entry.cefrLevel] = (byCefr[entry.cefrLevel] ?? 0) + 1
    const pos = entry.partOfSpeech[0] ?? 'other'
    byPos[pos] = (byPos[pos] ?? 0) + 1
  }

  console.log('\n[build-korean-vocab] === Summary ===')
  console.log(`  Korean (ko): ${entries.length.toLocaleString()} words total`)

  console.log('\n  By CEFR level:')
  for (const level of CEFR_LEVELS) {
    const n = byCefr[level]
    if (n) console.log(`    ${level}: ${n.toLocaleString()}`)
  }

  console.log('\n  By POS:')
  for (const [pos, n] of Object.entries(byPos).sort()) {
    console.log(`    ${pos}: ${n.toLocaleString()}`)
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv, {
    nikl: '',
    'output-dir': '',
  })

  const niklArg = String(args.nikl || '').trim()
  const outputDirArg = String(args['output-dir'] || '').trim()

  if (!niklArg || !outputDirArg) {
    console.error(
      'Usage: node build-korean-vocab.mjs \\\n' +
      '  --nikl <path-to-nikl-dict.json> \\\n' +
      '  --output-dir <output-directory>',
    )
    process.exit(1)
  }

  const niklPath = path.resolve(root, niklArg)
  const outputDir = path.resolve(root, outputDirArg)

  console.log('[build-korean-vocab] Starting Korean vocab build')
  console.log(`  NIKL dict:  ${niklPath}`)
  console.log(`  Output dir: ${outputDir}`)

  // Step 1: Load and filter
  console.log('\n  Step 1: Loading and filtering NIKL entries...')
  const filtered = await loadAndFilter(niklPath)

  // Step 2: Deduplicate on form
  console.log('\n  Step 2: Deduplicating on Korean form (keeping easiest level)...')
  const deduped = deduplicateOnForm(filtered)
  console.log(`  After dedup: ${deduped.length.toLocaleString()} unique forms`)

  // Step 3: Assign CEFR levels (with 초급/중급 splits)
  console.log('\n  Step 3: Assigning CEFR levels...')
  const levelled = assignCefrLevels(deduped)

  // Step 4: Sort by level then form
  console.log('\n  Step 4: Sorting...')
  const sorted = sortEntries(levelled)

  // Step 5: Build output
  const output = buildOutput(sorted)

  // Step 6: Write output
  const outPath = path.join(outputDir, 'vocab-ko-all.json')
  await writeJson(outPath, output)
  console.log(`\n  Wrote ${output.length.toLocaleString()} words → ${outPath}`)

  // Step 7: Print summary
  printSummary(output)
}

main().catch((err) => {
  console.error(
    '[build-korean-vocab] Fatal error:',
    err instanceof Error ? err.message : String(err),
  )
  process.exit(1)
})
