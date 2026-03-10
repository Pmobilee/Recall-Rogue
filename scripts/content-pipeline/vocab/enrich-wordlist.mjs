#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')
const LOCAL_PAID_GENERATION_DISABLED = true

async function createAnthropic() {
  const mod = await import('@anthropic-ai/sdk')
  return new mod.default({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function fallbackEnrichment(word, language) {
  return {
    word,
    language,
    translation: word,
    romanization: word,
    partOfSpeech: 'unknown',
    level: 'A1',
    example: `${word} (${language})`,
    sourceName: 'Haiku fallback',
    sourceUrl: null,
  }
}

async function enrichWithHaiku(client, word, language) {
  const prompt = `For the ${language} word "${word}", output JSON with keys translation, romanization, partOfSpeech, level, example.`
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = Array.isArray(response?.content)
    ? response.content.map((part) => part?.text || '').join('\n')
    : String(response?.content || '')

  const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim())
  return {
    word,
    language,
    translation: parsed.translation || word,
    romanization: parsed.romanization || word,
    partOfSpeech: parsed.partOfSpeech || 'unknown',
    level: parsed.level || 'A1',
    example: parsed.example || '',
    sourceName: 'Claude Haiku',
    sourceUrl: null,
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: 'data/extracted/enriched-wordlist.json',
    language: 'unknown',
    limit: 1000,
    'dry-run': true,
  })

  if (!args.input) {
    throw new Error('Usage: node enrich-wordlist.mjs --input <wordlist.json> --language <code> --output <json> [--dry-run]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const language = String(args.language)
  const dryRun = Boolean(args['dry-run'])

  if (!dryRun && LOCAL_PAID_GENERATION_DISABLED) {
    throw new Error('Paid API enrichment is disabled in this repository. Use --dry-run and external Claude workers for live enrichment.')
  }

  const payload = await readJson(inputPath)
  const words = Array.isArray(payload?.words)
    ? payload.words
    : Array.isArray(payload)
      ? payload.map((item) => item.word || item)
      : []

  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), words.length) : words.length
  const selected = words.slice(0, limit)

  let client = null
  if (!dryRun && process.env.ANTHROPIC_API_KEY) {
    client = await createAnthropic()
  }

  const enriched = []
  for (const word of selected) {
    try {
      if (client) {
        enriched.push(await enrichWithHaiku(client, String(word), language))
      } else {
        enriched.push(fallbackEnrichment(String(word), language))
      }
    } catch {
      enriched.push(fallbackEnrichment(String(word), language))
    }
  }

  await writeJson(outputPath, enriched)
  console.log(`wrote ${enriched.length} enriched entries to ${outputPath}`)
}

main().catch((error) => {
  console.error('[enrich-wordlist] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
