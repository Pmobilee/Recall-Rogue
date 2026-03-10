#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function findExamples(word, sentences, maxExamples) {
  const token = String(word || '').toLowerCase()
  if (!token) return []

  const matches = []
  for (const sentence of sentences) {
    const text = String(sentence?.sentence || '').toLowerCase()
    if (!text.includes(token)) continue

    matches.push({
      id: sentence?.id || null,
      language: sentence?.language || null,
      sentence: sentence?.sentence || '',
      sourceName: 'Tatoeba',
      sourceUrl: sentence?.id ? `https://tatoeba.org/en/sentences/show/${sentence.id}` : 'https://tatoeba.org',
    })

    if (matches.length >= maxExamples) break
  }
  return matches
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    tatoeba: 'data/raw/tatoeba-examples.json',
    output: '',
    language: '',
    'max-examples': 3,
  })

  if (!args.input) {
    throw new Error('Usage: node match-tatoeba.mjs --input <vocab.json> --output <vocab-with-examples.json> [--language xx]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output || String(args.input).replace(/\.json$/i, '-examples.json')))
  const tatoebaPath = path.resolve(root, String(args.tatoeba))

  const vocab = await readJson(inputPath)
  const sentences = await readJson(tatoebaPath)
  const language = String(args.language || '')

  const filteredSentences = Array.isArray(sentences)
    ? (language ? sentences.filter((row) => String(row?.language || '') === language) : sentences)
    : []

  const maxExamples = Math.max(1, Number(args['max-examples']) || 3)
  const enriched = (Array.isArray(vocab) ? vocab : []).map((entry) => ({
    ...entry,
    examples: findExamples(entry.word, filteredSentences, maxExamples),
  }))

  await writeJson(outputPath, enriched)
  console.log(`wrote ${enriched.length} entries with examples to ${outputPath}`)
}

main().catch((error) => {
  console.error('[match-tatoeba] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
