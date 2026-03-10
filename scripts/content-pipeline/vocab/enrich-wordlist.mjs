#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function asEntries(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.words)) return payload.words
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function inferWord(entry) {
  if (typeof entry === 'string') return normalizeSpace(entry)
  return normalizeSpace(
    entry?.word
      || entry?.term
      || entry?.token
      || entry?.lemma
      || entry?.text
      || '',
  )
}

function inferLevel(entry) {
  const value = normalizeSpace(entry?.level || entry?.cefr || entry?.difficulty || 'A1')
  return value || 'A1'
}

function inferPartOfSpeech(entry) {
  const value = normalizeSpace(entry?.partOfSpeech || entry?.pos || entry?.wordClass || 'unknown')
  return value || 'unknown'
}

function enrichEntry(entry, language) {
  const word = inferWord(entry)
  if (!word) return null

  const translation = normalizeSpace(
    entry?.translation
      || entry?.meaning
      || entry?.gloss
      || word,
  ) || word

  const romanization = normalizeSpace(entry?.romanization || entry?.reading || word) || word
  const example = normalizeSpace(entry?.example || `${word} (${language})`)

  return {
    word,
    language,
    translation,
    romanization,
    partOfSpeech: inferPartOfSpeech(entry),
    level: inferLevel(entry),
    example,
    sourceName: normalizeSpace(entry?.sourceName || entry?.source || 'local-wordlist'),
    sourceUrl: entry?.sourceUrl || entry?.url || null,
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: 'data/extracted/enriched-wordlist.json',
    language: 'unknown',
    limit: 1000,
  })

  if (!args.input) {
    throw new Error('Usage: node enrich-wordlist.mjs --input <wordlist.json> --language <code> --output <json>')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const language = String(args.language || 'unknown')
  const payload = await readJson(inputPath)
  const entries = asEntries(payload)
  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), entries.length) : entries.length

  const enriched = entries
    .slice(0, limit)
    .map((entry) => enrichEntry(entry, language))
    .filter(Boolean)

  await writeJson(outputPath, enriched)
  console.log(`wrote ${enriched.length} enriched entries to ${outputPath}`)
}

main().catch((error) => {
  console.error('[enrich-wordlist] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
