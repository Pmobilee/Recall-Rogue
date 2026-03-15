#!/usr/bin/env node
/**
 * vocab-to-facts-v2.mjs
 *
 * Converts the intermediate vocab JSON (output of import-hsk-complete.mjs) into
 * a seed-ready JSON array of Fact objects for use by build-facts-db.mjs.
 *
 * Usage:
 *   node vocab-to-facts-v2.mjs \
 *     --input data/curated/vocab/zh/vocab-zh-all.json \
 *     --output src/data/seed/vocab-zh.json \
 *     --language zh
 *
 * Options:
 *   --input     Path to the intermediate vocab JSON array
 *   --output    Destination path for the seed JSON array
 *   --language  BCP-47 language code (zh, ja, ko, es, fr, de, nl, cs)
 *   --limit     Maximum entries to convert, 0 = no limit (default: 0)
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

/** Human-readable language labels for statement/question text. */
const LANGUAGE_LABELS = {
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  nl: 'Dutch',
  cs: 'Czech',
}

/** Languages that use a logographic or syllabic script and always include reading. */
const CJK_LANGUAGES = new Set(['zh', 'ja', 'ko'])

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Map a numeric HSK level to a rarity string.
 * HSK 1-2 (difficulty 1) → common
 * HSK 3-4 (difficulty 2-3) → uncommon
 * HSK 5+  (difficulty 4-5) → rare
 *
 * @param {number} hskLevel
 * @returns {'common' | 'uncommon' | 'rare'}
 */
function rarityFromHskLevel(hskLevel) {
  if (hskLevel <= 2) return 'common'
  if (hskLevel <= 4) return 'uncommon'
  return 'rare'
}

/**
 * Map a numeric HSK level to the categoryL2 subcategory tag.
 * Matches the subcategoryTaxonomy entries (e.g. "chinese_hsk3").
 *
 * @param {number} hskLevel
 * @returns {string}
 */
function categoryL2FromHskLevel(hskLevel) {
  return `chinese_hsk${hskLevel}`
}

/**
 * Resolve rarity from difficulty when hskLevel is unavailable.
 * difficulty 1 → common, 2-3 → uncommon, 4-5 → rare.
 *
 * @param {number} difficulty
 * @returns {'common' | 'uncommon' | 'rare'}
 */
function rarityFromDifficulty(difficulty) {
  if (difficulty <= 1) return 'common'
  if (difficulty <= 3) return 'uncommon'
  return 'rare'
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Build the reading annotation string "(reading)" if the language uses CJK
 * script and a non-empty reading is available; otherwise returns "".
 *
 * @param {string} reading
 * @param {string} language
 * @returns {string}  e.g. " (ā yí)" or ""
 */
function readingAnnotation(reading, language) {
  if (!CJK_LANGUAGES.has(language)) return ''
  const r = String(reading || '').trim()
  return r ? ` (${r})` : ''
}

/**
 * Build the quiz statement line.
 * Format: `{targetWord} ({reading}) means "{englishTranslation}" in {languageLabel}`
 * Reading is omitted for non-CJK languages or when empty.
 *
 * @param {string} targetWord
 * @param {string} reading
 * @param {string} englishTranslation
 * @param {string} language
 * @returns {string}
 */
function buildStatement(targetWord, reading, englishTranslation, language) {
  const langLabel = LANGUAGE_LABELS[language] ?? language
  const annotation = readingAnnotation(reading, language)
  return `${targetWord}${annotation} means "${englishTranslation}" in ${langLabel}`
}

/**
 * Build the primary quiz question (L2 → L1 meaning).
 * Format: `What does "{targetWord}" ({reading}) mean?`
 * Reading is omitted for non-CJK languages or when empty.
 *
 * @param {string} targetWord
 * @param {string} reading
 * @param {string} language
 * @returns {string}
 */
function buildQuizQuestion(targetWord, reading, language) {
  const annotation = readingAnnotation(reading, language)
  return `What does "${targetWord}"${annotation} mean?`
}

/**
 * Build the explanation line.
 * Format: `{targetWord} ({reading}) — {englishTranslation}. Part of speech: {pos}.`
 * If allMeanings has more than 1 entry, appends: `Also: {other meanings joined by ", "}`
 *
 * @param {string} targetWord
 * @param {string} reading
 * @param {string} englishTranslation
 * @param {string[]} allMeanings
 * @param {string[]} partOfSpeech
 * @param {string} language
 * @returns {string}
 */
function buildExplanation(targetWord, reading, englishTranslation, allMeanings, partOfSpeech, language) {
  const annotation = readingAnnotation(reading, language)
  const posLabel = Array.isArray(partOfSpeech) && partOfSpeech.length > 0
    ? partOfSpeech.join(', ')
    : 'word'

  let explanation = `${targetWord}${annotation} — ${englishTranslation}. Part of speech: ${posLabel}.`

  const otherMeanings = Array.isArray(allMeanings)
    ? allMeanings.filter((m) => m !== englishTranslation)
    : []
  if (otherMeanings.length > 0) {
    explanation += ` Also: ${otherMeanings.join(', ')}`
  }

  return explanation
}

// ---------------------------------------------------------------------------
// Core transformation
// ---------------------------------------------------------------------------

/**
 * Convert a single intermediate vocab entry into a game-ready Fact object.
 *
 * @param {object} entry   One element from the intermediate vocab JSON array
 * @param {string} language  BCP-47 language code (used as fallback if entry.language is absent)
 * @returns {object}  Fact object
 */
function toFact(entry, language) {
  const id = String(entry?.id || '').trim()
  const targetWord = String(entry?.targetWord || '').trim()
  const reading = String(entry?.reading || '').trim()
  const englishTranslation = String(entry?.englishTranslation || '').trim()
  const allMeanings = Array.isArray(entry?.allMeanings) ? entry.allMeanings.map(String) : [englishTranslation]
  const partOfSpeech = Array.isArray(entry?.partOfSpeech) ? entry.partOfSpeech.map(String) : []
  const lang = String(entry?.language || language || 'zh')
  const hskLevel = typeof entry?.hskLevel === 'number' ? entry.hskLevel : null
  const difficulty = typeof entry?.difficulty === 'number' ? entry.difficulty : 2
  const frequencyRank = typeof entry?.frequencyRank === 'number' ? entry.frequencyRank : null
  const sourceName = String(entry?.sourceName || 'Vocabulary Pipeline')
  const sourceUrl = entry?.sourceUrl ? String(entry.sourceUrl) : null

  // Rarity — prefer hskLevel-based mapping; fall back to difficulty
  const rarity = hskLevel !== null ? rarityFromHskLevel(hskLevel) : rarityFromDifficulty(difficulty)

  // categoryL2 — for Chinese HSK data we have the level; for others default to language code
  const categoryL2 = hskLevel !== null ? categoryL2FromHskLevel(hskLevel) : lang

  // Build human-readable strings
  const statement = buildStatement(targetWord, reading, englishTranslation, lang)
  const quizQuestion = buildQuizQuestion(targetWord, reading, lang)
  const explanation = buildExplanation(targetWord, reading, englishTranslation, allMeanings, partOfSpeech, lang)

  // Tags
  const tags = ['vocab', lang]
  if (hskLevel !== null) tags.push(`hsk${hskLevel}`)

  return {
    // Core identity
    id,
    type: 'vocabulary',

    // Core content
    statement,
    explanation,

    // Quiz — primary question variant (L2→L1 meaning)
    quizQuestion,
    correctAnswer: englishTranslation,
    distractors: [], // Runtime distractor selection — spec 1.8 Option E

    // Classification
    category: ['language', categoryL2],
    categoryL1: 'language',
    categoryL2,
    rarity,
    difficulty,
    funScore: 5,
    ageRating: 'kid',

    // Sourcing
    sourceName,
    sourceUrl,

    // Language-specific
    language: lang,
    pronunciation: reading || null,
    ...(frequencyRank !== null ? { frequencyRank } : {}),

    // Pipeline
    status: 'approved',
    contentVolatility: 'timeless',
    tags,

    // Variants — vocab facts use type: "vocabulary" flag at runtime; no QuestionVariant system
    variants: null,
  }
}

// ---------------------------------------------------------------------------
// Summary printing
// ---------------------------------------------------------------------------

/**
 * Print a human-readable summary to stdout.
 *
 * @param {object[]} facts
 */
function printSummary(facts) {
  const byHsk = {}
  const byRarity = {}

  for (const f of facts) {
    // Extract HSK level from tags (e.g. "hsk3")
    const hskTag = f.tags.find((t) => /^hsk\d+$/.test(t))
    if (hskTag) {
      byHsk[hskTag.toUpperCase()] = (byHsk[hskTag.toUpperCase()] ?? 0) + 1
    }
    byRarity[f.rarity] = (byRarity[f.rarity] ?? 0) + 1
  }

  console.log('\n[vocab-to-facts-v2] Conversion summary')
  console.log(`  Total facts: ${facts.length}`)

  if (Object.keys(byHsk).length > 0) {
    console.log('  By HSK level:')
    for (const [k, v] of Object.entries(byHsk).sort()) {
      console.log(`    ${k}: ${v}`)
    }
  }

  console.log('  By rarity:')
  for (const rarity of ['common', 'uncommon', 'rare']) {
    const count = byRarity[rarity] ?? 0
    if (count > 0) console.log(`    ${rarity}: ${count}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: '',
    language: 'zh',
    limit: 0,
  })

  if (!args.input || !args.output) {
    console.error(
      'Usage: node vocab-to-facts-v2.mjs --input <vocab.json> --output <facts.json> --language <code>'
    )
    process.exit(1)
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const language = String(args.language)
  const limit = Number(args.limit) > 0 ? Number(args.limit) : 0

  console.log(`[vocab-to-facts-v2] Reading: ${inputPath}`)
  const entries = await readJson(inputPath)
  const rows = Array.isArray(entries) ? entries : []

  const selected = limit > 0 ? rows.slice(0, limit) : rows

  console.log(`[vocab-to-facts-v2] Converting ${selected.length} entries (language=${language})`)

  const facts = selected.map((entry) => toFact(entry, language))

  await writeJson(outputPath, facts)
  console.log(`[vocab-to-facts-v2] Wrote ${facts.length} facts → ${outputPath}`)

  printSummary(facts)
}

main().catch((err) => {
  console.error('[vocab-to-facts-v2] Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
