#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const LANGUAGE_NAMES = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  nl: 'Dutch',
  cs: 'Czech',
}

function estimateCefrByRank(rank) {
  if (rank <= 1000) return 'A1'
  if (rank <= 2000) return 'A2'
  if (rank <= 3500) return 'B1'
  if (rank <= 5000) return 'B2'
  if (rank <= 8000) return 'C1'
  return 'C2'
}

function parseFrequencyLines(text, limit) {
  const rows = []
  const lines = text.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split(/[\t\s]+/).filter(Boolean)
    if (parts.length < 2) continue

    const rank = Number(parts[0])
    const word = parts[1]

    if (!Number.isFinite(rank) || !word) continue
    rows.push({ rank, word })
    if (rows.length >= limit) break
  }

  return rows
}

async function loadFrequencyData(input, url, limit, language) {
  if (input) {
    const text = await fs.readFile(input, 'utf8')
    return parseFrequencyLines(text, limit)
  }

  if (url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download frequency list: HTTP ${response.status}`)
    const text = await response.text()
    return parseFrequencyLines(text, limit)
  }

  return Array.from({ length: Math.min(limit, 2000) }, (_, index) => ({
    rank: index + 1,
    word: `${language}_word_${index + 1}`,
  }))
}

async function main() {
  const args = parseArgs(process.argv, {
    language: 'es',
    input: '',
    url: '',
    limit: 10_000,
    'output-dir': 'src/data/seed',
  })

  const language = String(args.language)
  const limit = Number(args.limit) > 0 ? Number(args.limit) : 10_000
  const outputDir = path.resolve(root, String(args['output-dir']))

  const rows = await loadFrequencyData(
    args.input ? path.resolve(root, String(args.input)) : '',
    String(args.url || ''),
    limit,
    language,
  )

  const entries = rows.map((row) => ({
    id: `eu-${language}-${row.rank}`,
    word: row.word,
    language,
    cefrLevel: estimateCefrByRank(row.rank),
    rank: row.rank,
    translation: null,
    sourceName: 'Leipzig Corpora',
    sourceUrl: 'https://wortschatz.uni-leipzig.de/en/download',
    languageName: LANGUAGE_NAMES[language] || language,
  }))

  const outputPath = path.join(outputDir, `vocab-${language}.json`)
  await writeJson(outputPath, entries)
  console.log(`wrote ${entries.length} entries to ${outputPath}`)
}

main().catch((error) => {
  console.error('[import-european-vocab] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
