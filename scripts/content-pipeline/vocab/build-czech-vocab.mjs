#!/usr/bin/env node
/**
 * build-czech-vocab.mjs
 *
 * Builds Czech vocabulary word lists by streaming Kaikki.org JSONL.gz and
 * inferring CEFR levels from word frequency using the Python `wordfreq` library.
 *
 * Czech has no CEFRLex resource, so Zipf frequency scores stand in for
 * hand-assigned CEFR levels. Words with a Zipf score of 0.0 (absent from the
 * wordfreq corpus) are dropped as too rare to be useful vocabulary items.
 *
 * Usage:
 *   node build-czech-vocab.mjs \
 *     --kaikki data/references/kaikki/en-cs-wikt.jsonl.gz \
 *     --output-dir data/curated/vocab/cs
 */
import path from 'node:path'
import { createReadStream, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CEFR levels in ascending order (A1 = easiest, C2 = hardest). */
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * Kaikki POS values we keep (English Wiktionary labels).
 * 'name' (proper nouns) is included and normalizes to 'noun' downstream.
 */
const KAIKKI_KEEP_POS = new Set(['noun', 'verb', 'adj', 'adv', 'name'])

/**
 * Regex that matches glosses indicating an inflected/derived form rather than a
 * headword. English Wiktionary uses this pattern for non-lemma form entries.
 */
const INFLECTION_GLOSS_RE = /^(plural|singular|feminine|masculine|diminutive|augmentative|superlative|comparative|past tense|present tense|past participle|present participle|gerund|imperative|infinitive|preterite|imperfect|conditional|subjunctive|indicative|conjugation|inflection|declension|alternative form|archaic form|obsolete form|dated form|eye dialect|misspelling|alternative spelling|rare spelling|nonstandard spelling) of /i

/**
 * Zipf → CEFR mapping per the spec (section 1.5).
 * Entries are tested in order; first match wins.
 * Words with Zipf == 0.0 are dropped before reaching this function.
 *
 * @type {Array<{ min: number, level: string }>}
 */
const ZIPF_TO_CEFR = [
  { min: 5.5, level: 'A1' },
  { min: 5.0, level: 'A2' },
  { min: 4.3, level: 'B1' },
  { min: 3.5, level: 'B2' },
  { min: 2.8, level: 'C1' },
  { min: 0.0, level: 'C2' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Zipf frequency score to a CEFR level string.
 * Returns null if the Zipf score is exactly 0.0 (word absent from corpus).
 *
 * @param {number} zipf
 * @returns {string | null}
 */
function zipfToCefr(zipf) {
  if (zipf === 0.0) return null
  for (const { min, level } of ZIPF_TO_CEFR) {
    if (zipf >= min) return level
  }
  return 'C2'
}

/**
 * Map a CEFR level to a numeric difficulty value (1–5).
 *
 * @param {string} level
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
 * Map a CEFR level to a rarity label.
 *
 * @param {string} level
 * @returns {'common' | 'uncommon' | 'rare'}
 */
function cefrToRarity(level) {
  if (level === 'A1' || level === 'A2') return 'common'
  if (level === 'B1' || level === 'B2') return 'uncommon'
  return 'rare'
}

/**
 * Return the sort index (0–5) for a CEFR level. Unknown levels sort last.
 *
 * @param {string} level
 * @returns {number}
 */
function cefrSortIndex(level) {
  const idx = CEFR_LEVELS.indexOf(level)
  return idx === -1 ? 999 : idx
}

/**
 * Normalize a Kaikki POS tag (English Wiktionary labels) to a simple English label.
 *
 * English Wiktionary POS labels: noun, verb, adj, adv, name (proper noun), etc.
 *
 * @param {string} kaikkiPos  e.g. "noun", "verb", "adj", "adv", "name"
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
// Step 1: Stream Kaikki.org JSONL.gz
// ---------------------------------------------------------------------------

/**
 * Stream a gzipped Kaikki.org JSONL file and yield content-word entries that
 * have at least one English gloss.
 *
 * @param {string} filePath  Absolute path to the .jsonl.gz file
 * @yields {{ word: string, kaikkiPos: string, normalizedPos: string, englishTranslation: string, allMeanings: string[], ipa: string | null }}
 */
async function* streamKaikki(filePath) {
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
    // These appear as entries like "plural of X", "past tense of Y", etc.
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

    yield {
      word,
      kaikkiPos: rawPos,
      normalizedPos: normalizeKaikkiPos(rawPos),
      englishTranslation,
      allMeanings,
      ipa,
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2: Get Zipf frequencies via Python wordfreq
// ---------------------------------------------------------------------------

/**
 * Python script source that reads words from stdin and writes `word\tfrequency`
 * TSV lines to stdout. Self-reports if wordfreq is not installed.
 */
const PYTHON_SCRIPT = `\
import sys

try:
    from wordfreq import zipf_frequency
except ImportError:
    print("ERROR: wordfreq is not installed. Run: pip install wordfreq", file=sys.stderr)
    sys.exit(1)

for line in sys.stdin:
    word = line.strip()
    if word:
        freq = zipf_frequency(word, 'cs')
        print(f"{word}\\t{freq}")
`

/**
 * Write a temporary Python script, pipe words through it, parse the TSV output,
 * and return a Map of word → Zipf frequency. Cleans up the temp file on exit.
 *
 * Fails gracefully with a clear error message if Python or wordfreq is missing.
 *
 * @param {string[]} words  List of Czech words to look up
 * @returns {Map<string, number>}  word → Zipf score
 */
function getZipfFrequencies(words) {
  const tmpScript = '/tmp/czech-wordfreq.py'

  // Write the helper script
  writeFileSync(tmpScript, PYTHON_SCRIPT, 'utf8')

  let stdout
  try {
    const input = words.join('\n')
    stdout = execSync(`python3 ${tmpScript}`, {
      input,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024, // 256 MB — large vocab lists are big
    })
  } catch (err) {
    // Clean up before re-throwing
    if (existsSync(tmpScript)) unlinkSync(tmpScript)

    const stderr = err?.stderr?.toString() ?? ''
    if (stderr.includes('wordfreq is not installed') || stderr.includes('ModuleNotFoundError')) {
      console.error(
        '\n[build-czech-vocab] ERROR: Python wordfreq library is not installed.\n' +
        '  Install it with:  pip install wordfreq\n' +
        '  Then re-run this script.\n',
      )
    } else if (err?.code === 'ENOENT' || stderr.includes('python3: command not found')) {
      console.error(
        '\n[build-czech-vocab] ERROR: python3 not found on PATH.\n' +
        '  Install Python 3 and the wordfreq package:  pip install wordfreq\n',
      )
    } else {
      console.error('[build-czech-vocab] Python subprocess failed:', err?.message ?? String(err))
      if (stderr) console.error(stderr)
    }
    process.exit(1)
  } finally {
    if (existsSync(tmpScript)) unlinkSync(tmpScript)
  }

  // Parse TSV output: word\tfrequency
  const freqMap = new Map()
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const tab = trimmed.indexOf('\t')
    if (tab === -1) continue
    const word = trimmed.slice(0, tab)
    const freq = parseFloat(trimmed.slice(tab + 1))
    if (word && !Number.isNaN(freq)) {
      freqMap.set(word, freq)
    }
  }

  return freqMap
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build the intermediate vocab JSON for Czech.
 *
 * @param {string} kaikkiPath    Absolute path to the Kaikki .jsonl.gz file
 * @param {string} outputDir     Absolute path to the output directory
 */
async function buildCzechVocab(kaikkiPath, outputDir, { minZipf = 0, maxLevel = '' } = {}) {
  console.log('\n[build-czech-vocab] Processing Czech (cs)')
  console.log(`  Kaikki: ${kaikkiPath}`)
  console.log(`  Output: ${outputDir}`)

  // ------------------------------------------------------------------
  // Step 1: Stream Kaikki, deduplicate on lowercase word
  // ------------------------------------------------------------------
  console.log('\n  Step 1: Streaming Kaikki.org JSONL.gz...')

  /**
   * Deduplication map: lowercase word → best entry (keep entry with most meanings).
   * @type {Map<string, { word: string, normalizedPos: string, englishTranslation: string, allMeanings: string[], ipa: string | null }>}
   */
  const dedupeMap = new Map()

  let kaikkiTotal = 0
  for await (const hit of streamKaikki(kaikkiPath)) {
    kaikkiTotal++
    const key = hit.word.toLowerCase()
    const existing = dedupeMap.get(key)
    if (existing) {
      // Keep the entry with more meanings
      if (hit.allMeanings.length <= existing.allMeanings.length) continue
    }
    dedupeMap.set(key, {
      word: hit.word,
      normalizedPos: hit.normalizedPos,
      englishTranslation: hit.englishTranslation,
      allMeanings: hit.allMeanings,
      ipa: hit.ipa,
    })
  }

  console.log(`  Kaikki lines processed: ${kaikkiTotal}`)
  console.log(`  Unique content words:   ${dedupeMap.size}`)

  // ------------------------------------------------------------------
  // Step 2: Batch Zipf frequency lookup via Python wordfreq
  // ------------------------------------------------------------------
  console.log('\n  Step 2: Looking up Zipf frequencies via Python wordfreq...')

  const uniqueWords = [...dedupeMap.keys()]
  console.log(`  Querying wordfreq for ${uniqueWords.length} words...`)

  const freqMap = getZipfFrequencies(uniqueWords)
  console.log(`  Received frequencies for ${freqMap.size} words`)

  // ------------------------------------------------------------------
  // Step 3: Map Zipf → CEFR, drop zero-frequency words
  // ------------------------------------------------------------------
  console.log('\n  Step 3: Mapping Zipf scores to CEFR levels...')

  /** @type {Array<{ word: string, normalizedPos: string, englishTranslation: string, allMeanings: string[], ipa: string | null, cefrLevel: string }>} */
  const cefrEntries = []
  let droppedZero = 0

  const maxLevelIdx = maxLevel ? cefrSortIndex(maxLevel) : 999
  let droppedLevel = 0

  for (const [key, entry] of dedupeMap) {
    const zipf = freqMap.get(key) ?? 0.0
    if (minZipf > 0 && zipf < minZipf && zipf > 0) { droppedZero++; continue }
    const cefrLevel = zipfToCefr(zipf)
    if (cefrLevel === null) {
      droppedZero++
      continue
    }
    if (cefrSortIndex(cefrLevel) > maxLevelIdx) {
      droppedLevel++
      continue
    }
    cefrEntries.push({ ...entry, cefrLevel })
  }

  console.log(`  Words with CEFR level: ${cefrEntries.length}`)
  console.log(`  Words dropped (Zipf=0): ${droppedZero}`)
  if (droppedLevel > 0) console.log(`  Words dropped (above ${maxLevel}): ${droppedLevel}`)

  // ------------------------------------------------------------------
  // Step 4: Sort (CEFR A1 first, then alphabetically within level)
  // ------------------------------------------------------------------
  cefrEntries.sort((a, b) => {
    const levelDiff = cefrSortIndex(a.cefrLevel) - cefrSortIndex(b.cefrLevel)
    if (levelDiff !== 0) return levelDiff
    return a.word.toLowerCase().localeCompare(b.word.toLowerCase(), 'cs')
  })

  // ------------------------------------------------------------------
  // Step 5: Build output array
  // ------------------------------------------------------------------
  const output = cefrEntries.map((entry, index) => ({
    id: `cs-freq-${index + 1}`,
    targetWord: entry.word,
    reading: null,
    englishTranslation: entry.englishTranslation,
    allMeanings: entry.allMeanings,
    language: 'cs',
    partOfSpeech: [entry.normalizedPos],
    level: entry.cefrLevel,
    cefrLevel: entry.cefrLevel,
    difficulty: cefrToDifficulty(entry.cefrLevel),
    frequencyRank: null,
    ipa: entry.ipa,
    sourceName: 'Kaikki.org + wordfreq',
    sourceUrl: 'https://kaikki.org/dictionary/Czech/',
  }))

  // ------------------------------------------------------------------
  // Step 6: Write output
  // ------------------------------------------------------------------
  const outPath = path.join(outputDir, 'vocab-cs-all.json')
  await writeJson(outPath, output)
  console.log(`\n  Wrote ${output.length} words → ${outPath}`)

  // ------------------------------------------------------------------
  // Step 7: Print summary
  // ------------------------------------------------------------------
  const byCefr = /** @type {Record<string, number>} */ ({})
  const byPos = /** @type {Record<string, number>} */ ({})
  for (const entry of output) {
    byCefr[entry.cefrLevel] = (byCefr[entry.cefrLevel] ?? 0) + 1
    const pos = entry.partOfSpeech[0] ?? 'other'
    byPos[pos] = (byPos[pos] ?? 0) + 1
  }

  console.log('\n[build-czech-vocab] === Summary ===')
  console.log(`  Czech (cs): ${output.length} words total`)

  console.log('\n  By CEFR level:')
  for (const level of CEFR_LEVELS) {
    const n = byCefr[level]
    if (n) console.log(`    ${level}: ${n}`)
  }

  console.log('\n  By POS:')
  for (const [pos, n] of Object.entries(byPos).sort()) {
    console.log(`    ${pos}: ${n}`)
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv, {
    kaikki: '',
    'output-dir': '',
    'min-zipf': 0,
    'max-level': '',
  })

  const kaikkiArg = String(args.kaikki || '').trim()
  const outputDirArg = String(args['output-dir'] || '').trim()

  if (!kaikkiArg || !outputDirArg) {
    console.error(
      'Usage: node build-czech-vocab.mjs \\\n' +
      '  --kaikki <path-to-en-cs-wikt.jsonl.gz> \\\n' +
      '  --output-dir <output-directory>',
    )
    process.exit(1)
  }

  // Resolve paths relative to cwd (or absolute if provided as such)
  const kaikkiPath = path.resolve(process.cwd(), kaikkiArg)
  const outputDir = path.resolve(process.cwd(), outputDirArg)

  const minZipf = Number(args['min-zipf']) || 0
  const maxLevel = String(args['max-level'] || '').toUpperCase()

  await buildCzechVocab(kaikkiPath, outputDir, { minZipf, maxLevel })
}

main().catch((err) => {
  console.error(
    '[build-czech-vocab] Fatal error:',
    err instanceof Error ? err.message : String(err),
  )
  process.exit(1)
})
