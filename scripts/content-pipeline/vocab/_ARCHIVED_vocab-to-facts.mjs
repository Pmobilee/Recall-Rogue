#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function pickDistractors(entries, currentWord, limit = 4) {
  const out = []
  for (const entry of entries) {
    const word = String(entry?.word || '')
    if (!word || word === currentWord) continue
    out.push({ text: word, difficultyTier: out.length < 2 ? 'easy' : 'medium' })
    if (out.length >= limit) break
  }
  return out
}

function toFact(entry, allEntries, language, index) {
  const word = String(entry?.word || '').trim()
  const translation = String(entry?.translation || entry?.english || entry?.meanings?.[0] || '').trim()
  const level = String(entry?.cefrLevel || entry?.mappedLevel || entry?.jlptLevel || entry?.hskLevel || 'A1')

  return {
    id: `vocab-${language}-${index + 1}`,
    statement: `${word} means ${translation || 'unknown translation'}.`,
    quizQuestion: `What is the meaning of "${word}"?`,
    correctAnswer: translation || word,
    variants: [
      `What does "${word}" mean?`,
      `Which ${language.toUpperCase()} word means "${translation || word}"?`,
      `Fill in the blank: "${word}" means _____.`,
      `True or false: "${word}" means "${translation || word}".`,
    ],
    distractors: pickDistractors(allEntries, word, 8),
    difficulty: Math.min(5, Math.max(1, level.startsWith('C') ? 5 : level.startsWith('B') ? 3 : 2)),
    funScore: 5,
    wowFactor: `"${word}" is a useful ${language.toUpperCase()} vocabulary item for active recall practice.`,
    visualDescription: `Pixel-art word card for ${word} with contextual scene hinting at ${translation || 'meaning'}.`,
    ageRating: 'kid',
    sourceName: entry?.sourceName || 'Vocabulary Pipeline',
    sourceUrl: entry?.sourceUrl || null,
    category: 'language',
    contentType: 'vocabulary',
    tags: [language, level],
    language,
    level,
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: '',
    language: 'es',
    limit: 0,
  })

  if (!args.input || !args.output) {
    throw new Error('Usage: node vocab-to-facts.mjs --input <vocab.json> --output <facts.jsonl> --language <code>')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const language = String(args.language)

  const entries = await readJson(inputPath)
  const rows = Array.isArray(entries) ? entries : []
  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), rows.length) : rows.length
  const selected = rows.slice(0, limit)

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
  const stream = fs.createWriteStream(outputPath, { flags: 'w' })

  for (let i = 0; i < selected.length; i += 1) {
    const fact = toFact(selected[i], selected, language, i)
    stream.write(`${JSON.stringify(fact)}\n`)
  }

  stream.end()
  console.log(`wrote ${selected.length} vocab facts to ${outputPath}`)
}

main().catch((error) => {
  console.error('[vocab-to-facts] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
