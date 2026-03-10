#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadJsonl, listJsonlFiles } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')
const generatedDir = path.join(root, 'data/generated')

/**
 * Extract the string value from a distractor entry.
 * Distractors can be plain strings or objects with a `.text` property.
 */
function extractDistractorText(distractor) {
  if (typeof distractor === 'string') return distractor
  if (distractor && typeof distractor === 'object' && typeof distractor.text === 'string') {
    return distractor.text
  }
  return String(distractor)
}

/**
 * Pick `count` distractors starting at `offset`, wrapping around if needed.
 * Returns plain string array.
 */
function pickDistractors(distractors, offset, count) {
  const texts = distractors.map(extractDistractorText)
  if (texts.length === 0) return []
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(texts[(offset + i) % texts.length])
  }
  return result
}

/**
 * Build a fill-in-the-blank question from a statement and correctAnswer.
 * Uses case-insensitive substring matching.
 * Falls back to true_false if the answer doesn't appear in the statement.
 */
function buildFillBlank(statement, correctAnswer, distractors) {
  const idx = statement.toLowerCase().indexOf(correctAnswer.toLowerCase())
  if (idx !== -1) {
    const blanked =
      statement.slice(0, idx) + '_____' + statement.slice(idx + correctAnswer.length)
    return {
      question: `Fill in the blank: ${blanked}`,
      type: 'fill_blank',
      correctAnswer,
      distractors,
    }
  }
  // Fallback: true/false
  return {
    question: `True or False: ${statement}`,
    type: 'true_false',
    correctAnswer: 'True',
    distractors: ['False'],
  }
}

/**
 * Convert string-only variants into proper QuestionVariant objects.
 * Returns the new variants array, or null if no fix was needed.
 */
function fixVariants(fact) {
  const variants = fact.variants
  if (!Array.isArray(variants) || variants.length === 0) return null
  // Only fix if ALL variants are strings
  if (!variants.every((v) => typeof v === 'string')) return null

  const distractors = fact.distractors || []

  const forward = {
    question: fact.quizQuestion,
    type: 'forward',
    correctAnswer: fact.correctAnswer,
    distractors: pickDistractors(distractors, 0, 3),
  }

  const fillBlank = buildFillBlank(
    fact.statement,
    fact.correctAnswer,
    pickDistractors(distractors, 3, 3)
  )

  return [forward, fillBlank]
}

async function main() {
  const files = await listJsonlFiles(generatedDir)
  const summary = []

  for (const filePath of files) {
    const basename = path.basename(filePath)
    if (basename === 'production-facts.jsonl') continue

    const facts = await loadJsonl(filePath)
    let fixedCount = 0

    for (let i = 0; i < facts.length; i++) {
      const newVariants = fixVariants(facts[i])
      if (newVariants) {
        facts[i] = { ...facts[i], variants: newVariants }
        fixedCount++
      }
    }

    if (fixedCount > 0) {
      const lines = facts.map((f) => JSON.stringify(f))
      fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8')
    }

    summary.push({ domain: basename.replace('.jsonl', ''), fixed: fixedCount })
  }

  console.log('\n=== fix-malformed-variants summary ===')
  let totalFixed = 0
  for (const { domain, fixed } of summary) {
    if (fixed > 0) {
      console.log(`  ${domain}: ${fixed} facts fixed`)
      totalFixed += fixed
    }
  }
  if (totalFixed === 0) {
    console.log('  No malformed variants found.')
  } else {
    console.log(`\n  Total: ${totalFixed} facts fixed across ${summary.filter((s) => s.fixed > 0).length} domains`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
