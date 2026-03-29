#!/usr/bin/env node
/**
 * build-jdict-compact.mjs
 *
 * Reads jmdict-eng-common-3.6.2.json and produces a compact lookup map:
 *   { "kanji_or_kana": { "r": "reading_kana", "g": "primary_english_gloss" } }
 *
 * Key = first kanji text (or first kana text if no kanji)
 * r   = first kana reading
 * g   = first sense's first English gloss
 *
 * Output: public/assets/dict/jdict-compact.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const INPUT = resolve(ROOT, 'data/references/jmdict/jmdict-eng-common-3.6.2.json')
const OUTPUT_DIR = resolve(ROOT, 'public/assets/dict')
const OUTPUT = resolve(OUTPUT_DIR, 'jdict-compact.json')

console.log('Reading JMdict...')
const raw = JSON.parse(readFileSync(INPUT, 'utf-8'))
const words = raw.words ?? raw

console.log(`Total entries: ${words.length}`)

const compact = {}

for (const entry of words) {
  // Determine the lookup key: first kanji text, or first kana text if no kanji
  const kanjiList = entry.kanji ?? []
  const kanaList = entry.kana ?? []

  if (kanaList.length === 0) continue // skip malformed entries

  const key = kanjiList.length > 0 ? kanjiList[0].text : kanaList[0].text
  const reading = kanaList[0].text

  // First sense, first English gloss
  const senses = entry.sense ?? []
  if (senses.length === 0) continue

  const gloss = senses[0].gloss?.find(g => g.lang === 'eng')
  if (!gloss) continue

  // If kana-only word, reading === key — still store it for lookup consistency
  compact[key] = {
    r: reading,
    g: gloss.text,
  }

  // Also index by kana form directly (so kuromoji surface/basic_form lookups work even for kana-only words)
  if (kanjiList.length > 0 && kanaList[0].text !== key) {
    if (!compact[kanaList[0].text]) {
      compact[kanaList[0].text] = {
        r: reading,
        g: gloss.text,
      }
    }
  }
}

const totalEntries = Object.keys(compact).length
console.log(`Compact entries: ${totalEntries}`)

mkdirSync(OUTPUT_DIR, { recursive: true })
const json = JSON.stringify(compact)
writeFileSync(OUTPUT, json, 'utf-8')

const sizeKB = (json.length / 1024).toFixed(1)
console.log(`Output: ${OUTPUT}`)
console.log(`File size: ${sizeKB} KB`)
console.log('Done.')
