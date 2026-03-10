#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DEFAULT_URL = 'https://raw.githubusercontent.com/scriptin/jmdict-simplified/master/jmdict.json'
const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

function pickJlpt(entry, index, total) {
  const tags = [
    ...(Array.isArray(entry?.tags) ? entry.tags : []),
    ...(Array.isArray(entry?.sense?.flatMap?.((sense) => sense?.tags || [])) ? entry.sense.flatMap((sense) => sense?.tags || []) : []),
  ]

  const direct = tags
    .map((tag) => String(tag).toLowerCase())
    .find((tag) => /jlpt[-_ ]?n[1-5]/.test(tag))

  if (direct) {
    const level = direct.match(/n([1-5])/)
    if (level) return `N${level[1]}`
  }

  const ratio = total > 0 ? index / total : 0
  if (ratio < 0.08) return 'N5'
  if (ratio < 0.2) return 'N4'
  if (ratio < 0.45) return 'N3'
  if (ratio < 0.7) return 'N2'
  return 'N1'
}

function toEntry(raw, index, total) {
  const kanji = Array.isArray(raw?.kanji) ? raw.kanji : []
  const kana = Array.isArray(raw?.kana) ? raw.kana : []
  const senses = Array.isArray(raw?.sense) ? raw.sense : []

  const word = kanji[0]?.text || kana[0]?.text || raw?.word || null
  const reading = kana[0]?.text || null
  const meanings = senses.flatMap((sense) => Array.isArray(sense?.gloss) ? sense.gloss.map((g) => String(g)) : [])
  const pos = senses[0]?.partOfSpeech?.[0] || raw?.partOfSpeech?.[0] || 'other'
  const jlptLevel = pickJlpt(raw, index, total)

  if (!word || meanings.length === 0) return null

  return {
    id: `jmdict-${raw?.id ?? raw?.ent_seq ?? index + 1}`,
    word,
    reading,
    meanings: meanings.slice(0, 4),
    partOfSpeech: pos,
    jlptLevel,
    difficulty: Number(jlptLevel.replace('N', '')),
    language: 'ja',
    sourceName: 'JMdict/EDRDG',
    sourceUrl: 'https://www.edrdg.org/jmdict/j_jmdict.html',
  }
}

function splitByLevel(entries) {
  const buckets = {
    N5: [],
    N4: [],
    N3: [],
    N2: [],
    N1: [],
  }

  for (const entry of entries) {
    const level = JLPT_LEVELS.includes(entry.jlptLevel) ? entry.jlptLevel : 'N3'
    buckets[level].push(entry)
  }

  return buckets
}

async function loadSource(input, url) {
  if (input) {
    const fileText = await (await import('node:fs/promises')).readFile(input, 'utf8')
    return JSON.parse(fileText)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download JMdict source: HTTP ${response.status}`)
  }

  return response.json()
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    url: DEFAULT_URL,
    limit: 20_000,
    'output-dir': 'src/data/seed',
  })

  const outputDir = path.resolve(root, String(args['output-dir']))
  const source = await loadSource(args.input ? path.resolve(root, String(args.input)) : '', String(args.url || DEFAULT_URL))

  const rawEntries = Array.isArray(source)
    ? source
    : Array.isArray(source?.words)
      ? source.words
      : Array.isArray(source?.entries)
        ? source.entries
        : []

  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), rawEntries.length) : rawEntries.length
  const entries = rawEntries
    .slice(0, limit)
    .map((entry, index) => toEntry(entry, index, limit))
    .filter(Boolean)

  const buckets = splitByLevel(entries)

  await writeJson(path.join(outputDir, 'vocab-n5.json'), buckets.N5)
  await writeJson(path.join(outputDir, 'vocab-n4.json'), buckets.N4)
  await writeJson(path.join(outputDir, 'vocab-n3.json'), buckets.N3)
  await writeJson(path.join(outputDir, 'vocab-n2.json'), buckets.N2)
  await writeJson(path.join(outputDir, 'vocab-n1.json'), buckets.N1)

  console.log(JSON.stringify({
    total: entries.length,
    byLevel: {
      N5: buckets.N5.length,
      N4: buckets.N4.length,
      N3: buckets.N3.length,
      N2: buckets.N2.length,
      N1: buckets.N1.length,
    },
    outputDir,
  }, null, 2))
}

main().catch((error) => {
  console.error('[import-jmdict] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
