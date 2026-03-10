#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dedupeStrings, parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function parseLines(text, limit) {
  const rows = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue

    rows.push({
      id: parts[0],
      language: parts[1],
      sentence: parts.slice(2).join('\t'),
    })

    if (rows.length >= limit) break
  }
  return rows
}

function includesAnyWord(sentence, wordsSet) {
  const normalized = sentence.toLowerCase()
  for (const word of wordsSet) {
    if (normalized.includes(word)) return true
  }
  return false
}

async function loadText(input, url) {
  if (input) {
    return fs.readFile(input, 'utf8')
  }

  if (!url) {
    return [
      '1\ten\tThe Earth orbits the Sun.',
      '2\ten\tTokyo is the capital of Japan.',
      '3\ten\tWater boils at one hundred degrees Celsius.',
      '4\tes\tMadrid es la capital de España.',
      '5\tfr\tParis est la capitale de la France.',
    ].join('\n')
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download Tatoeba source: HTTP ${response.status}`)
  }
  return response.text()
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    url: '',
    limit: 100_000,
    output: 'data/raw/tatoeba-examples.json',
    'match-vocab': '',
  })

  const inputPath = args.input ? path.resolve(root, String(args.input)) : ''
  const outputPath = path.resolve(root, String(args.output))
  const text = await loadText(inputPath, String(args.url || ''))

  const limit = Number(args.limit) > 0 ? Number(args.limit) : 100_000
  let rows = parseLines(text, limit)

  if (args['match-vocab']) {
    const vocabPath = path.resolve(root, String(args['match-vocab']))
    const vocab = await readJson(vocabPath)
    const words = dedupeStrings(Array.isArray(vocab) ? vocab.map((item) => item.word || item.reading || item.text) : [])
      .map((word) => word.toLowerCase())
      .filter((word) => word.length >= 2)

    const wordSet = new Set(words)
    rows = rows.filter((row) => includesAnyWord(row.sentence, wordSet))
  }

  await writeJson(outputPath, rows)
  console.log(`wrote ${rows.length} Tatoeba rows to ${outputPath}`)
}

main().catch((error) => {
  console.error('[import-tatoeba] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
