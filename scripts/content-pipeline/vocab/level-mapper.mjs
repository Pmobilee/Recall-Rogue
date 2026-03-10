#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function mapLevel(entry, index) {
  if (entry.cefrLevel) return entry.cefrLevel
  if (entry.jlptLevel) return entry.jlptLevel
  if (entry.hskLevel) return `HSK${entry.hskLevel}`

  const rank = Number(entry.rank || index + 1)
  if (rank <= 1000) return 'A1'
  if (rank <= 2000) return 'A2'
  if (rank <= 3500) return 'B1'
  if (rank <= 5000) return 'B2'
  if (rank <= 8000) return 'C1'
  return 'C2'
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: '',
    language: '',
  })

  if (!args.input || !args.output) {
    throw new Error('Usage: node level-mapper.mjs --input <vocab.json> --output <leveled.json> [--language xx]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))

  const entries = await readJson(inputPath)
  const mapped = (Array.isArray(entries) ? entries : []).map((entry, index) => ({
    ...entry,
    language: entry.language || args.language || null,
    mappedLevel: mapLevel(entry, index),
    cefrLevel: entry.cefrLevel || mapLevel(entry, index),
  }))

  await writeJson(outputPath, mapped)
  console.log(`wrote ${mapped.length} leveled entries to ${outputPath}`)
}

main().catch((error) => {
  console.error('[level-mapper] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
