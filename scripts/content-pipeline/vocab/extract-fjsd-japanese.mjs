#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson, readJson, dedupeStrings } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const LEVEL_TO_DIFFICULTY = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 }
const LEVEL_TO_RARITY = {
  N5: 'common',
  N4: 'common',
  N3: 'uncommon',
  N2: 'uncommon',
  N1: 'rare',
}

/**
 * Fisher-Yates shuffle
 */
function shuffle(arr) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Pad a number to 3 digits
 */
function padNum(n) {
  return String(n).padStart(3, '0')
}

/**
 * Extract first comma-separated meaning from a translation string
 */
function extractFirstMeaning(translation) {
  if (!translation) return ''
  return String(translation).split(',')[0].trim()
}

/**
 * Load and index JMdict by ID
 */
async function loadJMDict(jmdictPath) {
  const data = await readJson(jmdictPath)
  const words = Array.isArray(data?.words) ? data.words : []

  const indexed = new Map()
  for (const word of words) {
    const id = String(word.id || '')
    if (!id) continue
    indexed.set(id, word)
  }

  return indexed
}

/**
 * Load FJSD vocab ID lists for all levels
 */
async function loadVocabIds(basePath) {
  const ids = {}

  for (const level of JLPT_LEVELS) {
    const filePath = path.join(basePath, `vocabJLPT/ids/vocab_${level.toLowerCase()}.json`)
    try {
      const data = await readJson(filePath)
      ids[level] = Array.isArray(data) ? data : []
    } catch {
      ids[level] = []
    }
  }

  return ids
}

/**
 * Load FJSD readings/audio data indexed by ID
 */
async function loadReadings(readingsPath) {
  try {
    const data = await readJson(readingsPath)
    const indexed = new Map()

    if (Array.isArray(data)) {
      for (const entry of data) {
        const id = String(entry.id || '')
        if (!id) continue
        indexed.set(id, entry)
      }
    }

    return indexed
  } catch {
    return new Map()
  }
}

/**
 * Load kanji info indexed by kanji character
 */
async function loadKanjiInfo(kanjiInfoPath) {
  try {
    const data = await readJson(kanjiInfoPath)
    const indexed = new Map()

    if (Array.isArray(data)) {
      for (const entry of data) {
        const kanji = String(entry.kanji || '')
        if (!kanji) continue
        indexed.set(kanji, entry)
      }
    }

    return indexed
  } catch {
    return new Map()
  }
}

/**
 * Load kanji level lists
 */
async function loadKanjiIds(basePath) {
  const ids = {}

  for (const level of JLPT_LEVELS) {
    const filePath = path.join(basePath, `kanjiJLPT/kanji/kanji_${level.toLowerCase()}.json`)
    try {
      const data = await readJson(filePath)
      ids[level] = Array.isArray(data) ? data : []
    } catch {
      ids[level] = []
    }
  }

  return ids
}

/**
 * Load grammar entries by level
 */
async function loadGrammar(basePath) {
  const grammar = {}

  for (const level of JLPT_LEVELS) {
    const filePath = path.join(basePath, `grammar/json/grammar_${level.toLowerCase()}.json`)
    try {
      const data = await readJson(filePath)
      grammar[level] = Array.isArray(data) ? data : []
    } catch {
      grammar[level] = []
    }
  }

  // Load grammar_additional.json (no level specified)
  const additionalPath = path.join(basePath, 'grammar/json/grammar_additional.json')
  try {
    const data = await readJson(additionalPath)
    grammar.additional = Array.isArray(data) ? data : []
  } catch {
    grammar.additional = []
  }

  return grammar
}

/**
 * Load kana data by type
 */
async function loadKana(basePath) {
  const kana = {}
  const types = ['hiragana', 'katakana', 'hiragana_extended', 'katakana_extended']

  for (const type of types) {
    const filePath = path.join(basePath, `kana/json/${type}.json`)
    try {
      const data = await readJson(filePath)
      kana[type] = Array.isArray(data) ? data : []
    } catch {
      kana[type] = []
    }
  }

  return kana
}

/**
 * Extract vocabulary facts from JMDict + FJSD vocab IDs
 */
function extractVocab(jmdictIndexed, vocabIds, readingsIndexed, kanjiInfoIndexed) {
  const facts = {}

  for (const level of JLPT_LEVELS) {
    facts[level] = []
    const ids = vocabIds[level] || []
    const meanings = []

    // First pass: collect all meanings for this level for distractor pool
    for (const vocabId of ids) {
      const word = jmdictIndexed.get(vocabId)
      if (!word) continue

      const senses = Array.isArray(word.sense) ? word.sense : []
      for (const sense of senses) {
        const glosses = Array.isArray(sense.gloss) ? sense.gloss : []
        for (const gloss of glosses) {
          const text = String(gloss.text || gloss || '').trim()
          if (text && !meanings.includes(text)) {
            meanings.push(text)
          }
        }
      }
    }

    // Second pass: create fact entries
    let num = 0
    for (const vocabId of ids) {
      const word = jmdictIndexed.get(vocabId)
      if (!word) continue

      const kanji = (Array.isArray(word.kanji) && word.kanji[0]) ? word.kanji[0].text : null
      const kana = (Array.isArray(word.kana) && word.kana[0]) ? word.kana[0].text : null
      const senses = Array.isArray(word.sense) ? word.sense : []

      if (!kanji && !kana) continue
      if (senses.length === 0) continue

      const glosses = senses.flatMap((sense) =>
        Array.isArray(sense.gloss) ? sense.gloss.map((g) => String(g.text || g || '').trim()) : []
      ).filter(Boolean)

      if (glosses.length === 0) continue

      const correctAnswer = glosses[0]

      // Pick distractors: other meanings from same level, exclude correct answer
      const candidates = meanings.filter((m) => m !== correctAnswer)
      const distractors = shuffle(candidates).slice(0, Math.min(7, candidates.length))

      // Ensure we have at least 5 distractors; if not enough, pad with empty or skip
      if (distractors.length < 5) {
        // Skip this fact if we can't get enough distractors
        continue
      }

      const reading = kana || ''
      const display = kanji || kana

      num += 1
      facts[level].push({
        id: `ja-vocab-${level.toLowerCase()}-${padNum(num)}`,
        type: 'vocabulary',
        statement: `${display} means '${correctAnswer}' in Japanese`,
        quizQuestion: kanji
          ? `What does '${kanji}' (${kana}) mean in English?`
          : `What does '${kana}' mean in English?`,
        correctAnswer,
        distractors,
        explanation: `${display} (${reading}) means '${correctAnswer}'.`,
        wowFactor: 6,
        difficulty: LEVEL_TO_DIFFICULTY[level],
        ageRating: 'kid',
        categoryL1: 'Language',
        categoryL2: 'japanese',
        pronunciation: reading,
        exampleSentence: '',
        domain: 'vocab_ja',
        language: 'ja',
        reading,
        subdeck: 'Vocabulary',
        jlptLevel: level,
        category: ['language_vocab', 'Language'],
        rarity: LEVEL_TO_RARITY[level],
      })
    }
  }

  return facts
}

/**
 * Extract kanji facts
 */
function extractKanji(kanjiIds, kanjiInfoIndexed) {
  const facts = {}

  for (const level of JLPT_LEVELS) {
    facts[level] = []
    const kanjis = kanjiIds[level] || []
    let meaningList = []

    // First pass: collect all meanings for distractors
    for (const kanji of kanjis) {
      const info = kanjiInfoIndexed.get(kanji)
      if (!info || !Array.isArray(info.words) || info.words.length === 0) continue

      const translations = info.words.flatMap((w) =>
        Array.isArray(w.translations) ? w.translations.map((t) => extractFirstMeaning(t.translation)) : []
      ).filter(Boolean)

      if (translations.length > 0) {
        meaningList.push(...translations)
      }
    }

    meaningList = dedupeStrings(meaningList) // Remove duplicates

    // Second pass: create facts
    let num = 0
    for (const kanji of kanjis) {
      const info = kanjiInfoIndexed.get(kanji)
      if (!info || !Array.isArray(info.words) || info.words.length === 0) continue

      const firstWord = info.words[0]
      const translations = Array.isArray(firstWord.translations) ? firstWord.translations : []
      if (translations.length === 0) continue

      const correctAnswer = extractFirstMeaning(translations[0].translation)
      if (!correctAnswer) continue

      const reading = (Array.isArray(firstWord.readings) && firstWord.readings[0])
        ? firstWord.readings[0].reading
        : ''

      // Collect example from words[0]
      const firstCompound = (Array.isArray(firstWord.kanjiForms) && firstWord.kanjiForms[0])
        ? firstWord.kanjiForms[0].kanjiForm
        : kanji

      const exampleSentence = firstCompound !== kanji ? `${firstCompound} (${reading})` : ''

      // Pick distractors
      const candidates = meaningList.filter((m) => m !== correctAnswer)
      const distractors = shuffle(candidates).slice(0, Math.min(7, candidates.length))

      if (distractors.length < 5) continue

      const mnemonic = String(info.mnemonic || '').trim().slice(0, 200)

      num += 1
      facts[level].push({
        id: `ja-kanji-${level.toLowerCase()}-${padNum(num)}`,
        type: 'vocabulary',
        statement: `The kanji ${kanji} means '${correctAnswer}'`,
        quizQuestion: `What does the kanji '${kanji}' mean?`,
        correctAnswer,
        distractors,
        explanation: mnemonic,
        wowFactor: 6,
        difficulty: LEVEL_TO_DIFFICULTY[level],
        ageRating: 'kid',
        categoryL1: 'Language',
        categoryL2: 'japanese',
        pronunciation: reading,
        exampleSentence,
        domain: 'vocab_ja',
        language: 'ja',
        reading,
        subdeck: 'Kanji',
        jlptLevel: level,
        category: ['language_kanji', 'Language'],
        rarity: LEVEL_TO_RARITY[level],
      })
    }
  }

  return facts
}

/**
 * Extract grammar facts
 */
function extractGrammar(grammarData) {
  const facts = {}

  // Process N5-N1
  for (const level of JLPT_LEVELS) {
    facts[level] = []
    const entries = grammarData[level] || []
    const meanings = []

    // First pass: collect all meanings
    for (const entry of entries) {
      const meaning = String(entry.meaning?.meaning || '').trim()
      if (meaning && !meanings.includes(meaning)) {
        meanings.push(meaning)
      }
    }

    // Second pass: create facts
    let num = 0
    for (const entry of entries) {
      const point = String(entry.point || '').trim()
      const meaning = String(entry.meaning?.meaning || '').trim()
      if (!point || !meaning) continue

      const usages = (Array.isArray(entry.usages) ? entry.usages : [])
        .map((u) => String(u || '').trim())
        .filter(Boolean)

      const phrases = Array.isArray(entry.phrases) ? entry.phrases : []
      const exampleSentence = phrases.length > 0
        ? `${phrases[0].originalPhrase} (${phrases[0].translation || ''})`
        : ''

      // Pick distractors
      const candidates = meanings.filter((m) => m !== meaning)
      const distractors = shuffle(candidates).slice(0, Math.min(7, candidates.length))

      if (distractors.length < 5) continue

      const explanation = usages.length > 0
        ? `Pattern: ${usages.join(', ')}. ${entry.meaning?.example || ''}`
        : String(entry.meaning?.example || '').trim()

      num += 1
      facts[level].push({
        id: `ja-grammar-${level.toLowerCase()}-${padNum(num)}`,
        type: 'vocabulary',
        statement: `The grammar pattern ${point} means '${meaning}'`,
        quizQuestion: `What does the grammar pattern '${point}' mean?`,
        correctAnswer: meaning,
        distractors,
        explanation: explanation.slice(0, 500),
        wowFactor: 6,
        difficulty: LEVEL_TO_DIFFICULTY[level],
        ageRating: 'kid',
        categoryL1: 'Language',
        categoryL2: 'japanese',
        pronunciation: point,
        exampleSentence,
        domain: 'vocab_ja',
        language: 'ja',
        reading: point,
        subdeck: 'Grammar',
        jlptLevel: level,
        category: ['language_grammar', 'Language'],
        rarity: LEVEL_TO_RARITY[level],
      })
    }
  }

  // Process additional grammar (no level)
  facts.additional = []
  const additionalEntries = grammarData.additional || []
  const additionalMeanings = []

  for (const entry of additionalEntries) {
    const meaning = String(entry.meaning?.meaning || '').trim()
    if (meaning && !additionalMeanings.includes(meaning)) {
      additionalMeanings.push(meaning)
    }
  }

  let num = 0
  for (const entry of additionalEntries) {
    const point = String(entry.point || '').trim()
    const meaning = String(entry.meaning?.meaning || '').trim()
    if (!point || !meaning) continue

    const usages = (Array.isArray(entry.usages) ? entry.usages : [])
      .map((u) => String(u || '').trim())
      .filter(Boolean)

    const phrases = Array.isArray(entry.phrases) ? entry.phrases : []
    const exampleSentence = phrases.length > 0
      ? `${phrases[0].originalPhrase} (${phrases[0].translation || ''})`
      : ''

    const candidates = additionalMeanings.filter((m) => m !== meaning)
    const distractors = shuffle(candidates).slice(0, Math.min(7, candidates.length))

    if (distractors.length < 5) continue

    const explanation = usages.length > 0
      ? `Pattern: ${usages.join(', ')}. ${entry.meaning?.example || ''}`
      : String(entry.meaning?.example || '').trim()

    num += 1
    facts.additional.push({
      id: `ja-grammar-additional-${padNum(num)}`,
      type: 'vocabulary',
      statement: `The grammar pattern ${point} means '${meaning}'`,
      quizQuestion: `What does the grammar pattern '${point}' mean?`,
      correctAnswer: meaning,
      distractors,
      explanation: explanation.slice(0, 500),
      wowFactor: 6,
      difficulty: 2,
      ageRating: 'kid',
      categoryL1: 'Language',
      categoryL2: 'japanese',
      pronunciation: point,
      exampleSentence,
      domain: 'vocab_ja',
      language: 'ja',
      reading: point,
      subdeck: 'Grammar',
      jlptLevel: 'N3',
      category: ['language_grammar', 'Language'],
      rarity: 'uncommon',
    })
  }

  return facts
}

/**
 * Extract kana facts
 */
function extractKana(kana) {
  const facts = {}

  const typeMap = {
    hiragana: 'hira',
    katakana: 'kata',
    hiragana_extended: 'hira-ext',
    katakana_extended: 'kata-ext',
  }

  for (const [jsonType, factType] of Object.entries(typeMap)) {
    const entries = kana[jsonType] || []
    const readings = entries.map((e) => String(e.reading || '').trim()).filter(Boolean)
    const uniqueReadings = [...new Set(readings)]

    facts[factType] = []
    let num = 0

    for (const entry of entries) {
      const kanaChar = String(entry.kana || '').trim()
      const reading = String(entry.reading || '').trim()

      if (!kanaChar || !reading) continue

      // Pick distractors: other readings from same set
      const candidates = uniqueReadings.filter((r) => r !== reading)
      const distractors = shuffle(candidates).slice(0, Math.min(7, candidates.length))

      if (distractors.length < 5) continue

      num += 1
      facts[factType].push({
        id: `ja-kana-${factType}-${padNum(num)}`,
        type: 'vocabulary',
        statement: `${kanaChar} is read as '${reading}' in ${jsonType}`,
        quizQuestion: `What is the romaji reading for '${kanaChar}'?`,
        correctAnswer: reading,
        distractors,
        explanation: `${kanaChar} is the ${jsonType} character for '${reading}'`,
        wowFactor: 5,
        difficulty: 1,
        ageRating: 'kid',
        categoryL1: 'Language',
        categoryL2: 'japanese',
        pronunciation: reading,
        exampleSentence: '',
        domain: 'vocab_ja',
        language: 'ja',
        reading,
        subdeck: 'Kana',
        jlptLevel: 'N5',
        category: ['language_kana', 'Language'],
        rarity: 'common',
      })
    }
  }

  return facts
}

async function main() {
  const args = parseArgs(process.argv, {
    'fjsd-dir': 'data/references/full-japanese-study-deck/results',
    'jmdict-path': 'data/references/jmdict/jmdict-eng.json',
    'output-dir': 'data/raw/japanese',
  })

  const fjsdDir = path.resolve(root, String(args['fjsd-dir']))
  const jmdictPath = path.resolve(root, String(args['jmdict-path']))
  const outputDir = path.resolve(root, String(args['output-dir']))

  console.log('[extract-fjsd-japanese] Loading data...')

  // Load all data sources
  const jmdictIndexed = await loadJMDict(jmdictPath)
  const vocabIds = await loadVocabIds(fjsdDir)
  const readingsIndexed = await loadReadings(path.join(fjsdDir, 'vocabJLPT/json/readings_with_audio.json'))
  const kanjiInfoIndexed = await loadKanjiInfo(path.join(fjsdDir, 'kanji-info.json'))
  const kanjiIds = await loadKanjiIds(fjsdDir)
  const grammar = await loadGrammar(fjsdDir)
  const kanaData = await loadKana(fjsdDir)

  console.log('[extract-fjsd-japanese] Extracting vocabulary...')
  const vocabFacts = extractVocab(jmdictIndexed, vocabIds, readingsIndexed, kanjiInfoIndexed)

  console.log('[extract-fjsd-japanese] Extracting kanji...')
  const kanjiFacts = extractKanji(kanjiIds, kanjiInfoIndexed)

  console.log('[extract-fjsd-japanese] Extracting grammar...')
  const grammarFacts = extractGrammar(grammar)

  console.log('[extract-fjsd-japanese] Extracting kana...')
  const kanaFacts = extractKana(kanaData)

  // Write output files
  console.log('[extract-fjsd-japanese] Writing output files...')

  // Vocabulary
  for (const level of JLPT_LEVELS) {
    if (vocabFacts[level].length > 0) {
      await writeJson(path.join(outputDir, `vocab-${level.toLowerCase()}.json`), vocabFacts[level])
    }
  }

  // Kanji
  for (const level of JLPT_LEVELS) {
    if (kanjiFacts[level].length > 0) {
      await writeJson(path.join(outputDir, `kanji-${level.toLowerCase()}.json`), kanjiFacts[level])
    }
  }

  // Grammar
  for (const level of JLPT_LEVELS) {
    if (grammarFacts[level].length > 0) {
      await writeJson(path.join(outputDir, `grammar-${level.toLowerCase()}.json`), grammarFacts[level])
    }
  }

  if (grammarFacts.additional.length > 0) {
    await writeJson(path.join(outputDir, 'grammar-additional.json'), grammarFacts.additional)
  }

  // Kana
  const kanaTypesToWrite = ['hira', 'kata', 'hira-ext', 'kata-ext']
  const kanaFileNames = ['kana-hiragana', 'kana-katakana', 'kana-hiragana-ext', 'kana-katakana-ext']

  for (let i = 0; i < kanaTypesToWrite.length; i++) {
    const type = kanaTypesToWrite[i]
    const fileName = kanaFileNames[i]
    if (kanaFacts[type] && kanaFacts[type].length > 0) {
      await writeJson(path.join(outputDir, `${fileName}.json`), kanaFacts[type])
    }
  }

  // Print summary
  const summary = {
    vocab: {},
    kanji: {},
    grammar: {},
    kana: {},
    total: 0,
  }

  for (const level of JLPT_LEVELS) {
    summary.vocab[level] = vocabFacts[level].length
    summary.kanji[level] = kanjiFacts[level].length
    summary.grammar[level] = grammarFacts[level].length
    summary.total += vocabFacts[level].length + kanjiFacts[level].length + grammarFacts[level].length
  }

  summary.grammar.additional = grammarFacts.additional.length
  summary.total += grammarFacts.additional.length

  for (const type of kanaTypesToWrite) {
    summary.kana[type] = kanaFacts[type] ? kanaFacts[type].length : 0
    summary.total += summary.kana[type]
  }

  console.log('\n[extract-fjsd-japanese] SUMMARY')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`\nOutput directory: ${outputDir}`)
}

main().catch((error) => {
  console.error('[extract-fjsd-japanese] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
