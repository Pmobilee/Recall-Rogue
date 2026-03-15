#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function fallbackEntries(version, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `hsk-${version}-${index + 1}`,
    word: `汉语${version}-${index + 1}`,
    pinyin: `han yu ${index + 1}`,
    english: null,
    language: 'zh',
    hskVersion: version,
    hskLevel: Math.max(1, Math.min(6, Math.ceil((index + 1) / Math.max(1, count / 6)))),
    sourceName: 'Complete HSK Vocabulary',
    sourceUrl: 'https://github.com/drkameleon/complete-hsk-vocabulary',
  }))
}

async function loadInput(input, url) {
  if (input) {
    return JSON.parse(await (await import('node:fs/promises')).readFile(input, 'utf8'))
  }
  if (url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download HSK source: HTTP ${response.status}`)
    return response.json()
  }
  return null
}

function normalize(input, version, limit) {
  const rows = Array.isArray(input)
    ? input
    : Array.isArray(input?.data)
      ? input.data
      : []

  if (rows.length === 0) return fallbackEntries(version, limit)

  return rows
    .slice(0, limit)
    .map((row, index) => ({
      id: row.id || `hsk-${version}-${index + 1}`,
      word: row.simplified || row.word || row.hanzi || null,
      pinyin: row.pinyin || null,
      english: row.english || row.translation || null,
      language: 'zh',
      hskVersion: version,
      hskLevel: Number(row.level || row.hskLevel || 1),
      sourceName: 'Complete HSK Vocabulary',
      sourceUrl: row.sourceUrl || 'https://github.com/drkameleon/complete-hsk-vocabulary',
    }))
    .filter((row) => row.word)
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    url: '',
    'output-dir': 'src/data/seed',
    limit: 6750,
  })

  const outputDir = path.resolve(root, String(args['output-dir']))
  const limit = Number(args.limit) > 0 ? Number(args.limit) : 6750

  const raw = await loadInput(args.input ? path.resolve(root, String(args.input)) : '', String(args.url || ''))
  const hsk2 = normalize(raw?.hsk2 || raw, '2.0', limit)
  const hsk3 = normalize(raw?.hsk3 || raw, '3.0', limit)

  const hsk2Path = path.join(outputDir, 'vocab-zh-hsk2.json')
  const hsk3Path = path.join(outputDir, 'vocab-zh-hsk3.json')

  await writeJson(hsk2Path, hsk2)
  await writeJson(hsk3Path, hsk3)

  console.log(JSON.stringify({
    hsk2: hsk2.length,
    hsk3: hsk3.length,
    hsk2Path,
    hsk3Path,
  }, null, 2))
}

main().catch((error) => {
  console.error('[import-hsk-vocabulary] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
