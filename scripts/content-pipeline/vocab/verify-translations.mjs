#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    tatoeba: 'data/raw/tatoeba-examples.json',
    output: 'data/extracted/verified-wordlist.json',
    language: '',
  })

  if (!args.input) {
    throw new Error('Usage: node verify-translations.mjs --input <enriched.json> --tatoeba <sentences.json> --output <json>')
  }

  const inputPath = path.resolve(root, String(args.input))
  const tatoebaPath = path.resolve(root, String(args.tatoeba))
  const outputPath = path.resolve(root, String(args.output))

  const words = await readJson(inputPath)
  const sentences = await readJson(tatoebaPath)

  const byLanguage = new Map()
  for (const sentence of Array.isArray(sentences) ? sentences : []) {
    const lang = String(sentence?.language || '')
    if (!byLanguage.has(lang)) byLanguage.set(lang, [])
    byLanguage.get(lang).push(String(sentence?.sentence || '').toLowerCase())
  }

  const verified = []
  let alignedCount = 0

  for (const entry of Array.isArray(words) ? words : []) {
    const language = String(args.language || entry?.language || '')
    const pool = byLanguage.get(language) || []
    const token = String(entry?.word || '').toLowerCase()
    const aligned = token.length > 0 && pool.some((sentence) => sentence.includes(token))
    if (aligned) alignedCount += 1

    verified.push({
      ...entry,
      verifiedAgainstTatoeba: aligned,
      verificationLanguage: language,
    })
  }

  await writeJson(outputPath, {
    total: verified.length,
    aligned: alignedCount,
    alignmentRate: verified.length > 0 ? Number((alignedCount / verified.length).toFixed(4)) : 0,
    entries: verified,
  })

  console.log(`wrote verification report to ${outputPath}`)
}

main().catch((error) => {
  console.error('[verify-translations] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
