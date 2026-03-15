#!/usr/bin/env node
/**
 * build-european-vocab.mjs
 *
 * Builds vocabulary word lists for Spanish, French, German, and Dutch by
 * joining CEFRLex TSV files (word → CEFR level + POS) with Kaikki.org
 * JSONL.gz files (word → English translation + IPA).
 *
 * Output: intermediate vocab JSON matching the schema used by vocab-to-facts-v2.mjs
 *
 * Usage (single language):
 *   node build-european-vocab.mjs \
 *     --language es \
 *     --cefrlex data/references/cefrlex/ELELex.tsv \
 *     --kaikki data/references/kaikki/en-es-wikt.jsonl.gz \
 *     --output-dir data/curated/vocab/es
 *
 * Usage (all four languages with hardcoded paths):
 *   node build-european-vocab.mjs --all
 */
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

// ---------------------------------------------------------------------------
// Language configuration
// ---------------------------------------------------------------------------

/** @type {Record<string, { label: string, cefrlex: string, kaikki: string, outputDir: string, cefrFormat: string }>} */
const LANGUAGES = {
  es: {
    label: 'Spanish',
    cefrlex: 'data/references/cefrlex/ELELex.tsv',
    kaikki: 'data/references/kaikki/en-es-wikt.jsonl.gz',
    outputDir: 'data/curated/vocab/es',
    cefrFormat: 'elelex',
  },
  fr: {
    label: 'French',
    cefrlex: 'data/references/cefrlex/FLELex_TT_Beacco.tsv',
    kaikki: 'data/references/kaikki/en-fr-wikt.jsonl.gz',
    outputDir: 'data/curated/vocab/fr',
    cefrFormat: 'flelex_beacco',
  },
  de: {
    label: 'German',
    cefrlex: 'data/references/cefrlex/DAFlex.tsv',
    kaikki: 'data/references/kaikki/en-de-wikt.jsonl.gz',
    outputDir: 'data/curated/vocab/de',
    cefrFormat: 'daflex',
  },
  nl: {
    label: 'Dutch',
    cefrlex: 'data/references/cefrlex/NT2Lex-CGN-v01.tsv',
    kaikki: 'data/references/kaikki/en-nl-wikt.jsonl.gz',
    outputDir: 'data/curated/vocab/nl',
    cefrFormat: 'nt2lex',
  },
}

/** CEFR levels in order (used for sorting and level-lookup by index). */
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Source name label per format. */
const SOURCE_NAMES = {
  elelex: 'CEFRLex ELELex + Kaikki.org',
  flelex_beacco: 'CEFRLex FLELex + Kaikki.org',
  daflex: 'CEFRLex DAFlex + Kaikki.org',
  nt2lex: 'CEFRLex NT2Lex + Kaikki.org',
}

/**
 * Kaikki pos values we want to keep (others are discarded).
 * English Wiktionary uses English POS labels: noun, verb, adj, adv, name (proper noun).
 * 'name' (proper nouns) are included so they survive the POS filter; the CEFRLex
 * join step then normalizes them to 'noun'.
 */
const KAIKKI_KEEP_POS = new Set(['noun', 'verb', 'adj', 'adv', 'name'])

/** Kaikki pos values to explicitly skip (defined here for documentation clarity). */
const KAIKKI_SKIP_POS = new Set([
  'phrase', 'affix', 'prefix', 'suffix', 'particle',
  'det', 'pron', 'prep', 'conj', 'num', 'intj', 'character',
])

/**
 * Regex that matches glosses which indicate an inflected/derived form rather than
 * a headword. Entries whose first gloss matches this pattern are skipped entirely.
 * English Wiktionary uses this pattern extensively for non-lemma forms.
 */
const INFLECTION_GLOSS_RE = /^(plural|singular|feminine|masculine|diminutive|augmentative|superlative|comparative|past tense|present tense|past participle|present participle|gerund|imperative|infinitive|preterite|imperfect|conditional|subjunctive|indicative|conjugation|inflection|declension|alternative form|archaic form|obsolete form|dated form|eye dialect|misspelling|alternative spelling|rare spelling|nonstandard spelling) of /i

/** Content-word POS labels we keep after normalization. */
const KEEP_POS = new Set(['noun', 'verb', 'adjective', 'adverb'])

// ---------------------------------------------------------------------------
// POS normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw POS tag from any CEFRLex format into a simple English label.
 * Returns 'other' for tags that don't match any known content-word class.
 *
 * @param {string} tag  Raw tag string from CEFRLex TSV
 * @returns {string}
 */
function normalizePos(tag) {
  const t = String(tag || '').trim()
  // Nouns
  if (/^(n[cm]f?m?|nn|n\(soort\)|nom|subs)/i.test(t)) return 'noun'
  // Verbs: V, VM, VA, VV, VE, VER (ES/FR/DE), WW (NL)
  if (/^v$/i.test(t) || /^(v[vema]|ver|ww)/i.test(t)) return 'verb'
  // Adjectives
  if (/^(aq|adj|adja|adjd)/i.test(t)) return 'adjective'
  // Adverbs
  if (/^(rg|adv|bw)/i.test(t)) return 'adverb'
  // Prepositions
  if (/^(sp|pre|vz)/i.test(t)) return 'preposition'
  // Conjunctions
  if (/^(cc|cs|con|vg)/i.test(t)) return 'conjunction'
  // Determiners/Articles
  if (/^(da|dd|dt|art|lid)/i.test(t)) return 'determiner'
  // Pronouns
  if (/^(pp|pd|pi|pr|vnw)/i.test(t)) return 'pronoun'
  // Interjections
  if (/^(ij|int|tsw)/i.test(t)) return 'interjection'
  // Numbers
  if (/^(z|num|tw)/i.test(t)) return 'numeral'
  return 'other'
}

/**
 * Normalize a Kaikki pos string (English Wiktionary labels) to a simple English
 * label compatible with the CEFRLex normalization output.
 *
 * English Wiktionary POS labels: noun, verb, adj, adv, name (proper noun),
 * phrase, prefix, suffix, conj, prep, intj, det, pron, num, character, particle.
 *
 * @param {string} kaikkiPos  Raw Kaikki pos (e.g. "noun", "verb", "adj", "adv", "name")
 * @returns {string}
 */
function normalizeKaikkiPos(kaikkiPos) {
  const t = String(kaikkiPos || '').trim().toLowerCase()
  if (t === 'noun' || t === 'name') return 'noun'
  if (t === 'verb') return 'verb'
  if (t === 'adj') return 'adjective'
  if (t === 'adv') return 'adverb'
  return 'other'
}

// ---------------------------------------------------------------------------
// CEFR level helpers
// ---------------------------------------------------------------------------

/**
 * Map a CEFR level string to a numeric difficulty value (1–5).
 *
 * @param {string} level  e.g. "A1", "B2", "C1"
 * @returns {number}
 */
function cefrToDifficulty(level) {
  switch (level) {
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
 * Map a CEFR level string to a rarity label.
 *
 * @param {string} level  e.g. "A1", "B2", "C1"
 * @returns {'common' | 'uncommon' | 'rare'}
 */
function cefrToRarity(level) {
  if (level === 'A1' || level === 'A2') return 'common'
  if (level === 'B1' || level === 'B2') return 'uncommon'
  return 'rare'
}

/**
 * Return the CEFR level index (0–5) for sorting purposes.
 * Unknown levels sort last.
 *
 * @param {string} level
 * @returns {number}
 */
function cefrSortIndex(level) {
  const idx = CEFR_LEVELS.indexOf(level)
  return idx === -1 ? 999 : idx
}

// ---------------------------------------------------------------------------
// CEFRLex parsers
// ---------------------------------------------------------------------------

/**
 * Strip surrounding double-quotes from a TSV cell value (ELELex / DAFlex style).
 *
 * @param {string} cell
 * @returns {string}
 */
function stripQuotes(cell) {
  const s = cell.trim()
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
  return s
}

/**
 * Find the lowest CEFR level where the corresponding frequency value is > 0.
 * Levels is an array of [levelName, freqValue] pairs in order A1..C1 or A1..C2.
 *
 * @param {Array<[string, number]>} levels
 * @returns {string | null}
 */
function lowestNonZeroLevel(levels) {
  for (const [name, freq] of levels) {
    if (freq > 0) return name
  }
  return null
}

/**
 * Parse a CEFRLex TSV file into a Map<lowercaseWord, { pos: string, cefrLevel: string }>.
 * Skips function words (keeps only content-word POS: noun, verb, adjective, adverb).
 * Skips lines where CEFR level cannot be determined.
 *
 * @param {string} filePath  Absolute path to the TSV file
 * @param {string} format    One of 'elelex', 'flelex_beacco', 'daflex', 'nt2lex'
 * @returns {Promise<Map<string, { pos: string, cefrLevel: string }>>}
 */
async function parseCefrlex(filePath, format) {
  const map = new Map()

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let lineIndex = 0
  let headerParsed = false
  /** @type {string[]} */
  let headers = []

  for await (const line of rl) {
    lineIndex++
    const raw = line.trim()
    if (!raw) continue

    // Split on tab
    const cells = raw.split('\t')

    // First line is always header
    if (!headerParsed) {
      headers = cells.map((c) => stripQuotes(c).toLowerCase())
      headerParsed = true
      continue
    }

    /** @type {string} */
    let word
    /** @type {string} */
    let rawPos
    /** @type {string | null} */
    let cefrLevel = null

    if (format === 'elelex') {
      // Quoted columns: "word", "tag", freq@a1, freq@a2, freq@b1, freq@b2, freq@c1, total
      if (cells.length < 7) continue
      word = stripQuotes(cells[0])
      rawPos = stripQuotes(cells[1])
      const freqs = [
        ['A1', parseFloat(stripQuotes(cells[2]))],
        ['A2', parseFloat(stripQuotes(cells[3]))],
        ['B1', parseFloat(stripQuotes(cells[4]))],
        ['B2', parseFloat(stripQuotes(cells[5]))],
        ['C1', parseFloat(stripQuotes(cells[6]))],
      ]
      cefrLevel = lowestNonZeroLevel(freqs)
    } else if (format === 'flelex_beacco') {
      // Unquoted: word, tag, freq_A1, freq_A2, freq_B1, freq_B2, freq_C1, freq_C2, freq_total, level
      if (cells.length < 10) continue
      word = cells[0].trim()
      rawPos = cells[1].trim()
      // Last column is the pre-computed level — use it directly
      cefrLevel = cells[cells.length - 1].trim().toUpperCase()
      if (!CEFR_LEVELS.includes(cefrLevel)) cefrLevel = null
    } else if (format === 'daflex') {
      // Quoted columns: "word", "tag", freq@a1..c2, total
      if (cells.length < 9) continue
      word = stripQuotes(cells[0])
      rawPos = stripQuotes(cells[1])
      const freqs = [
        ['A1', parseFloat(stripQuotes(cells[2]))],
        ['A2', parseFloat(stripQuotes(cells[3]))],
        ['B1', parseFloat(stripQuotes(cells[4]))],
        ['B2', parseFloat(stripQuotes(cells[5]))],
        ['C1', parseFloat(stripQuotes(cells[6]))],
        ['C2', parseFloat(stripQuotes(cells[7]))],
      ]
      cefrLevel = lowestNonZeroLevel(freqs)
    } else if (format === 'nt2lex') {
      // Unquoted: word, tag, D@A1, F@A1, SFI@A1, U@A1, tf-idf@A1, D@A2, F@A2, ...
      // 5 metrics per level: D, F, SFI, U, tf-idf — levels A1, A2, B1, B2, C1, then TOTAL
      // F (raw frequency) columns are at offsets 1 within each 5-column block (indices 3, 8, 13, 18, 23)
      if (cells.length < 4) continue
      word = cells[0].trim()
      rawPos = cells[1].trim()
      // F@A1=idx3, F@A2=idx8, F@B1=idx13, F@B2=idx18, F@C1=idx23
      const fIndices = [
        ['A1', 3],
        ['A2', 8],
        ['B1', 13],
        ['B2', 18],
        ['C1', 23],
      ]
      const freqs = fIndices.map(([lvl, idx]) => {
        const raw = cells[idx] != null ? cells[idx].trim() : '-'
        return [lvl, raw === '-' ? 0 : parseFloat(raw) || 0]
      })
      cefrLevel = lowestNonZeroLevel(freqs)
    } else {
      continue
    }

    if (!word || !cefrLevel) continue

    const pos = normalizePos(rawPos)
    if (!KEEP_POS.has(pos)) continue

    const key = word.toLowerCase()
    // If key already exists, keep the one with the lower CEFR level (more common)
    if (map.has(key)) {
      const existing = map.get(key)
      if (cefrSortIndex(existing.cefrLevel) <= cefrSortIndex(cefrLevel)) continue
    }

    map.set(key, { pos, cefrLevel })
  }

  return map
}

// ---------------------------------------------------------------------------
// Kaikki.org streaming parser
// ---------------------------------------------------------------------------

/**
 * Stream a gzipped Kaikki.org JSONL file and yield parsed Kaikki entries that
 * match words present in the CEFRLex map. Only emits content-word POS entries.
 *
 * @param {string} filePath  Absolute path to the .jsonl.gz file
 * @param {Map<string, { pos: string, cefrLevel: string }>} cefrMap
 * @yields {{ word: string, kaikkiPos: string, englishTranslation: string, allMeanings: string[], ipa: string | null }}
 */
async function* streamKaikki(filePath, cefrMap) {
  const gunzip = createGunzip()
  const fileStream = createReadStream(filePath)
  const rl = createInterface({
    input: fileStream.pipe(gunzip),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    const raw = line.trim()
    if (!raw) continue

    let entry
    try {
      entry = JSON.parse(raw)
    } catch {
      continue
    }

    const word = String(entry?.word || '').trim()
    if (!word) continue

    // Filter by POS — only keep content-word types
    const rawPos = String(entry?.pos || '').trim().toLowerCase()
    if (!KAIKKI_KEEP_POS.has(rawPos)) continue

    // Must have senses with English glosses
    const senses = Array.isArray(entry?.senses) ? entry.senses : []
    if (senses.length === 0) continue

    // Skip inflected/non-lemma forms from English Wiktionary.
    // These appear as entries like "plural of X", "feminine of Y", etc.
    // Detect via: form_of field, "form-of" tag, or gloss pattern.
    const firstSense = senses[0]
    if (firstSense?.form_of != null) continue
    const firstTags = Array.isArray(firstSense?.tags) ? firstSense.tags : []
    if (firstTags.includes('form-of')) continue
    const firstGloss = String(Array.isArray(firstSense?.glosses) ? (firstSense.glosses[0] ?? '') : '').trim()
    if (firstGloss && INFLECTION_GLOSS_RE.test(firstGloss)) continue

    // Collect all unique English glosses across all senses
    const allMeanings = []
    const seen = new Set()
    for (const sense of senses) {
      const glosses = Array.isArray(sense?.glosses) ? sense.glosses : []
      for (const gloss of glosses) {
        const g = String(gloss || '').trim()
        if (!g || seen.has(g)) continue
        seen.add(g)
        allMeanings.push(g)
      }
    }
    if (allMeanings.length === 0) continue

    const englishTranslation = allMeanings[0]

    // Check if this word is in the CEFRLex map (case-insensitive)
    const key = word.toLowerCase()
    if (!cefrMap.has(key)) continue

    // Extract IPA if present
    let ipa = null
    const sounds = Array.isArray(entry?.sounds) ? entry.sounds : []
    for (const sound of sounds) {
      const rawIpa = String(sound?.ipa || '').trim()
      if (rawIpa) {
        ipa = rawIpa
        break
      }
    }

    yield { word, kaikkiPos: rawPos, englishTranslation, allMeanings, ipa }
  }
}

// ---------------------------------------------------------------------------
// Main per-language builder
// ---------------------------------------------------------------------------

/**
 * Build the intermediate vocab JSON for a single language.
 *
 * @param {string} langCode   e.g. 'es'
 * @param {{ label: string, cefrlex: string, kaikki: string, outputDir: string, cefrFormat: string }} config
 * @returns {Promise<{ langCode: string, count: number, byCefr: Record<string, number>, byPos: Record<string, number> }>}
 */
async function buildLanguage(langCode, config) {
  const cefrPath = path.resolve(root, config.cefrlex)
  const kaikkiPath = path.resolve(root, config.kaikki)
  const outputDir = path.resolve(root, config.outputDir)

  console.log(`\n[build-european-vocab] Processing ${config.label} (${langCode})`)
  console.log(`  CEFRLex: ${cefrPath}`)
  console.log(`  Kaikki:  ${kaikkiPath}`)

  // Step 1: Parse CEFRLex
  console.log(`  Parsing CEFRLex (format: ${config.cefrFormat})...`)
  const cefrMap = await parseCefrlex(cefrPath, config.cefrFormat)
  console.log(`  CEFRLex entries loaded: ${cefrMap.size}`)

  // Step 2: Stream Kaikki and join
  console.log(`  Streaming Kaikki.org JSONL.gz...`)

  // Deduplication map: lowercase word → best entry (most allMeanings wins)
  /** @type {Map<string, { word: string, kaikkiPos: string, englishTranslation: string, allMeanings: string[], ipa: string | null, cefrLevel: string, pos: string }>} */
  const dedupeMap = new Map()

  for await (const hit of streamKaikki(kaikkiPath, cefrMap)) {
    const key = hit.word.toLowerCase()
    const cefrEntry = cefrMap.get(key)
    if (!cefrEntry) continue

    // Loose POS compatibility check: both should be in the same broad content-word class
    // CEFRLex pos is already normalized; Kaikki pos needs normalization
    const kaikkiNorm = normalizeKaikkiPos(hit.kaikkiPos)
    // We allow a mismatch here (language resources often differ on POS assignment)
    // but use the CEFRLex POS as the authoritative one for output

    const existing = dedupeMap.get(key)
    if (existing) {
      // Keep the entry with more meanings
      if (hit.allMeanings.length <= existing.allMeanings.length) continue
    }

    dedupeMap.set(key, {
      word: hit.word,
      kaikkiPos: hit.kaikkiPos,
      englishTranslation: hit.englishTranslation,
      allMeanings: hit.allMeanings,
      ipa: hit.ipa,
      cefrLevel: cefrEntry.cefrLevel,
      pos: cefrEntry.pos,
    })
  }

  console.log(`  Joined entries: ${dedupeMap.size}`)

  // Step 3: Sort (by CEFR level, then alphabetically within each level)
  const sorted = [...dedupeMap.values()].sort((a, b) => {
    const levelDiff = cefrSortIndex(a.cefrLevel) - cefrSortIndex(b.cefrLevel)
    if (levelDiff !== 0) return levelDiff
    return a.word.toLowerCase().localeCompare(b.word.toLowerCase())
  })

  // Step 4: Build output array
  const sourceName = SOURCE_NAMES[config.cefrFormat] ?? 'CEFRLex + Kaikki.org'
  const sourceUrl = 'https://cental.uclouvain.be/cefrlex/'

  const output = sorted.map((entry, index) => ({
    id: `${langCode}-cefr-${index + 1}`,
    targetWord: entry.word,
    reading: null,
    englishTranslation: entry.englishTranslation,
    allMeanings: entry.allMeanings,
    language: langCode,
    partOfSpeech: [entry.pos],
    level: entry.cefrLevel,
    cefrLevel: entry.cefrLevel,
    difficulty: cefrToDifficulty(entry.cefrLevel),
    frequencyRank: null,
    ipa: entry.ipa,
    sourceName,
    sourceUrl,
  }))

  // Step 5: Write output
  const outPath = path.join(outputDir, `vocab-${langCode}-all.json`)
  await writeJson(outPath, output)
  console.log(`  Wrote ${output.length} words → ${outPath}`)

  // Collect stats for summary
  const byCefr = {}
  const byPos = {}
  for (const entry of output) {
    byCefr[entry.cefrLevel] = (byCefr[entry.cefrLevel] ?? 0) + 1
    const pos = entry.partOfSpeech[0] ?? 'other'
    byPos[pos] = (byPos[pos] ?? 0) + 1
  }

  return { langCode, count: output.length, byCefr, byPos }
}

// ---------------------------------------------------------------------------
// Summary printing
// ---------------------------------------------------------------------------

/**
 * Print a per-language summary to stdout.
 *
 * @param {Array<{ langCode: string, count: number, byCefr: Record<string, number>, byPos: Record<string, number> }>} results
 */
function printSummary(results) {
  console.log('\n[build-european-vocab] === Final Summary ===')
  for (const { langCode, count, byCefr, byPos } of results) {
    const config = LANGUAGES[langCode]
    console.log(`\n  ${config?.label ?? langCode} (${langCode}): ${count} words total`)

    console.log('    By CEFR level:')
    for (const level of CEFR_LEVELS) {
      const n = byCefr[level]
      if (n) console.log(`      ${level}: ${n}`)
    }

    console.log('    By POS:')
    for (const [pos, n] of Object.entries(byPos).sort()) {
      console.log(`      ${pos}: ${n}`)
    }
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv, {
    all: false,
    language: '',
    cefrlex: '',
    kaikki: '',
    'output-dir': '',
  })

  if (args.all) {
    // Process all four languages sequentially using hardcoded paths
    const results = []
    for (const [langCode, config] of Object.entries(LANGUAGES)) {
      const result = await buildLanguage(langCode, config)
      results.push(result)
    }
    printSummary(results)
    return
  }

  // Single language mode
  const langCode = String(args.language || '').trim()
  if (!langCode) {
    console.error(
      'Usage: node build-european-vocab.mjs --language <code> --cefrlex <path> --kaikki <path> --output-dir <dir>\n' +
      '       node build-european-vocab.mjs --all',
    )
    process.exit(1)
  }

  const cefrlex = String(args.cefrlex || '').trim()
  const kaikki = String(args.kaikki || '').trim()
  const outputDir = String(args['output-dir'] || '').trim()

  if (!cefrlex || !kaikki || !outputDir) {
    console.error('Error: --cefrlex, --kaikki, and --output-dir are all required in single-language mode.')
    process.exit(1)
  }

  // Determine format from language code or look up in LANGUAGES
  const langDefaults = LANGUAGES[langCode]
  const cefrFormat = langDefaults?.cefrFormat ?? 'elelex'
  const label = langDefaults?.label ?? langCode

  const result = await buildLanguage(langCode, {
    label,
    cefrlex,
    kaikki,
    outputDir,
    cefrFormat,
  })

  printSummary([result])
}

main().catch((err) => {
  console.error(
    '[build-european-vocab] Fatal error:',
    err instanceof Error ? err.message : String(err),
  )
  process.exit(1)
})
