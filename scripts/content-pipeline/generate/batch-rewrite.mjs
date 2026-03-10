#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureParentDir, parseArgs, readSourceInput } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const VARIANT_TYPES = ['forward', 'reverse', 'negative', 'fill_blank', 'true_false']
const DISTRACTOR_TIERS = ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard']

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function truncateWords(value, maxWords) {
  const words = normalizeSpace(value).split(' ').filter(Boolean)
  return words.slice(0, maxWords).join(' ')
}

function shortAnswer(value) {
  const answer = truncateWords(value, 5)
  return answer.length > 30 ? answer.slice(0, 30).trim() : answer
}

function normalizeQuestion(value) {
  const cleaned = truncateWords(value, 12)
  if (!cleaned) return 'Which answer is correct?'
  return cleaned.endsWith('?') ? cleaned : `${cleaned}?`
}

function normalizeDistractorText(value) {
  return truncateWords(value, 5).slice(0, 30).trim()
}

function baseDistractors(correctAnswer) {
  const answer = String(correctAnswer || 'answer').toLowerCase()
  const defaults = ['Option Alpha', 'Option Beta', 'Option Gamma', 'Option Delta', 'Option Epsilon', 'Option Zeta', 'Option Eta', 'Option Theta']
  return defaults
    .filter((item) => item.toLowerCase() !== answer)
    .slice(0, 8)
}

function normalizeTopLevelDistractors(rawDistractors, correctAnswer) {
  const raw = Array.isArray(rawDistractors) ? rawDistractors : []
  const normalized = []

  for (const item of raw) {
    const text = normalizeDistractorText(typeof item === 'string' ? item : item?.text)
    if (!text) continue
    normalized.push(text)
    if (normalized.length >= 8) break
  }

  for (const fallback of baseDistractors(correctAnswer)) {
    if (normalized.length >= 8) break
    if (!normalized.includes(fallback)) {
      normalized.push(fallback)
    }
  }

  return normalized.slice(0, 8).map((text, index) => ({
    text,
    difficultyTier: DISTRACTOR_TIERS[index] || 'medium',
  }))
}

function variantQuestion(question, fallback, maxWords) {
  const text = truncateWords(question || fallback, maxWords)
  if (!text) return fallback
  return text
}

function normalizeVariant(variant, index, correctAnswer, topLevelDistractors) {
  const type = VARIANT_TYPES[index % VARIANT_TYPES.length]
  const distractors = topLevelDistractors
    .map((item) => item.text)
    .filter((item) => item !== correctAnswer)
    .slice(index, index + 3)

  while (distractors.length < 3) {
    distractors.push(`Option ${String.fromCharCode(65 + distractors.length)}`)
  }

  const fallbackQuestion = type === 'true_false'
    ? `This statement matches ${correctAnswer}`
    : `Which option matches ${correctAnswer}`

  return {
    question: variantQuestion(variant?.question, fallbackQuestion, type === 'reverse' ? 15 : type === 'fill_blank' ? 15 : 12),
    type,
    correctAnswer: type === 'true_false' ? (String(variant?.correctAnswer || 'True').toLowerCase() === 'false' ? 'False' : 'True') : correctAnswer,
    distractors,
  }
}

function normalizeVariants(rawVariants, correctAnswer, topLevelDistractors) {
  const base = Array.isArray(rawVariants) ? rawVariants : []
  const variants = []

  for (let i = 0; i < 5; i += 1) {
    variants.push(normalizeVariant(base[i], i, correctAnswer, topLevelDistractors))
  }

  return variants
}

function rewriteFields(original) {
  const correctAnswer = shortAnswer(original?.correctAnswer || original?.answer || 'Unknown')
  const quizQuestion = normalizeQuestion(original?.quizQuestion || original?.statement || '')
  const distractors = normalizeTopLevelDistractors(original?.distractors, correctAnswer)
  const variants = normalizeVariants(original?.variants, correctAnswer, distractors)

  return {
    quizQuestion,
    correctAnswer,
    variants,
    distractors,
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: '',
    limit: 0,
    concurrency: 3,
    'dry-run': true,
  })

  if (!args.input || !args.output) {
    throw new Error('Usage: node batch-rewrite.mjs --input <json|jsonl> --output <json>')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const allFacts = await readSourceInput(inputPath)
  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), allFacts.length) : allFacts.length
  const facts = allFacts.slice(0, limit)

  const rewritten = facts.map((original) => ({
    ...original,
    ...rewriteFields(original),
  }))

  await ensureParentDir(outputPath)
  await fs.writeFile(outputPath, `${JSON.stringify(rewritten, null, 2)}\n`, 'utf8')

  const reportPath = path.join(root, 'data/generated/qa-reports/batch-rewrite-report.json')
  await ensureParentDir(reportPath)
  await fs.writeFile(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    inputPath,
    outputPath,
    totalInput: facts.length,
    rewritten: rewritten.length,
    mode: 'local-deterministic',
    note: 'Paid API rewrite paths removed. This script now performs local shape normalization only.',
  }, null, 2)}\n`, 'utf8')

  console.log(`rewrote ${rewritten.length} facts -> ${outputPath}`)
  console.log(`report: ${reportPath}`)
}

main().catch((error) => {
  console.error('[batch-rewrite] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
