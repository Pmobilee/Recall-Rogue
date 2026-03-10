#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureParentDir, loadJsonl, parseArgs } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length
}

function distractorText(d) {
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && typeof d.text === 'string') return d.text
  return ''
}

function medianCharCheck(options) {
  const lengths = options.map((s) => s.length).sort((a, b) => a - b)
  if (lengths.length < 2) return true
  const mid = Math.floor(lengths.length / 2)
  const median = lengths.length % 2 === 1 ? lengths[mid] : (lengths[mid - 1] + lengths[mid]) / 2
  if (median === 0) return true
  return lengths.every((len) => Math.abs(len - median) / median <= 0.2)
}

function brevityWarnings(fact) {
  const warnings = []

  // 1. quizQuestion word count
  if (typeof fact.quizQuestion === 'string') {
    const wc = wordCount(fact.quizQuestion)
    if (wc > 15) warnings.push(`quizQuestion too long (${wc} words, max 15)`)
  }

  // 2-3. correctAnswer word count and char count
  if (typeof fact.correctAnswer === 'string') {
    const wc = wordCount(fact.correctAnswer)
    if (wc > 5) warnings.push(`correctAnswer too long (${wc} words, max 5)`)
    const cc = fact.correctAnswer.length
    if (cc > 35) warnings.push(`correctAnswer too many chars (${cc}, max 35)`)
  }

  // 4-7. Top-level distractors
  if (Array.isArray(fact.distractors)) {
    const count = fact.distractors.length
    if (count < 8) warnings.push(`too few distractors (${count}, min 8)`)
    if (count > 12) warnings.push(`too many distractors (${count}, max 12)`)

    for (let i = 0; i < fact.distractors.length; i += 1) {
      const text = distractorText(fact.distractors[i])
      if (!text) continue
      const wc = wordCount(text)
      if (wc > 5) warnings.push(`distractor[${i}] too long (${wc} words, max 5)`)
      if (text.length > 30) warnings.push(`distractor[${i}] too many chars (${text.length}, max 30)`)
    }
  }

  // 8. Variant checks
  if (Array.isArray(fact.variants)) {
    for (let vi = 0; vi < fact.variants.length; vi += 1) {
      const v = fact.variants[vi]
      if (!v || typeof v !== 'object') continue

      if (typeof v.question === 'string') {
        const wc = wordCount(v.question)
        if (wc > 15) warnings.push(`variant[${vi}].question too long (${wc} words, max 15)`)
      }

      if (typeof v.correctAnswer === 'string') {
        const isTrueFalse = v.type === 'true_false'
        const maxWords = isTrueFalse ? 1 : 5
        const wc = wordCount(v.correctAnswer)
        if (wc > maxWords) warnings.push(`variant[${vi}].correctAnswer too long (${wc} words, max ${maxWords})`)
      }

      if (Array.isArray(v.distractors)) {
        for (let di = 0; di < v.distractors.length; di += 1) {
          const text = distractorText(v.distractors[di])
          if (!text) continue
          const wc = wordCount(text)
          if (wc > 5) warnings.push(`variant[${vi}].distractor[${di}] too long (${wc} words, max 5)`)
        }
      }
    }
  }

  // 9. Similar-length check for top-level options
  if (typeof fact.correctAnswer === 'string' && Array.isArray(fact.distractors)) {
    // Check with first 2 distractors (typical shown set)
    const shownDistractors = fact.distractors.slice(0, 2).map(distractorText).filter(Boolean)
    const allOptions = [fact.correctAnswer, ...shownDistractors]
    if (allOptions.length >= 2 && !medianCharCheck(allOptions)) {
      warnings.push('option lengths not within 20% of median char count')
    }
  }

  // 10. Variant count for knowledge facts
  if (fact.type === 'fact') {
    const variantCount = Array.isArray(fact.variants) ? fact.variants.length : 0
    if (variantCount < 4) warnings.push(`too few variants for knowledge fact (${variantCount}, min 4)`)
  }

  return warnings
}

function schemaErrors(fact) {
  const issues = []

  if (!fact || typeof fact !== 'object') {
    return ['Fact must be an object']
  }

  const requiredStrings = ['id', 'statement', 'quizQuestion', 'correctAnswer', 'category']
  for (const field of requiredStrings) {
    if (typeof fact[field] !== 'string' || fact[field].trim().length === 0) {
      issues.push(`invalid ${field}`)
    }
  }

  if (!Array.isArray(fact.variants) || fact.variants.length < 2) {
    issues.push('variants must have at least 2 entries')
  }

  if (!Array.isArray(fact.distractors) || fact.distractors.length < 4) {
    issues.push('distractors must have at least 4 entries')
  }

  const difficulty = Number(fact.difficulty)
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
    issues.push('difficulty must be 1-5')
  }

  const funScore = Number(fact.funScore)
  if (!Number.isFinite(funScore) || funScore < 1 || funScore > 10) {
    issues.push('funScore must be 1-10')
  }

  return issues
}

async function loadFacts(inputPath) {
  if (inputPath.endsWith('.jsonl')) {
    return loadJsonl(inputPath)
  }

  const parsed = JSON.parse(await fs.readFile(inputPath, 'utf8'))
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.data)) return parsed.data
  return []
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: '',
    strict: false,
    'schema-only': false,
    'brevity-only': false,
  })

  if (!args.input) {
    throw new Error('Usage: node validate-output.mjs --input <jsonl|json> [--output report.json] [--strict] [--schema-only] [--brevity-only]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const facts = await loadFacts(inputPath)

  const skipSchema = Boolean(args['brevity-only'])
  const skipBrevity = Boolean(args['schema-only'])

  const errors = []
  const brevityIssues = []
  const difficultyCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let funScoreTotal = 0
  let funScoreCount = 0
  let visualMissing = 0

  for (let i = 0; i < facts.length; i += 1) {
    const fact = facts[i]

    // Schema validation (skip if --brevity-only)
    if (!skipSchema) {
      const issues = schemaErrors(fact)
      if (issues.length > 0) {
        errors.push({ index: i, id: fact?.id ?? null, issues })
        if (!skipBrevity) {
          // Still run brevity even on schema-invalid facts if not schema-only
          const bw = brevityWarnings(fact)
          if (bw.length > 0) {
            brevityIssues.push({ index: i, id: fact?.id ?? null, warnings: bw })
          }
        }
        continue
      }

      const d = Number(fact.difficulty)
      if (difficultyCounts[d] !== undefined) difficultyCounts[d] += 1

      const fun = Number(fact.funScore)
      if (Number.isFinite(fun)) {
        funScoreTotal += fun
        funScoreCount += 1
      }

      if (typeof fact.visualDescription !== 'string' || fact.visualDescription.trim().length === 0) {
        visualMissing += 1
      }
    }

    // Brevity checks (skip if --schema-only)
    if (!skipBrevity) {
      const bw = brevityWarnings(fact)
      if (bw.length > 0) {
        brevityIssues.push({ index: i, id: fact?.id ?? null, warnings: bw })
      }
    }
  }

  const report = {
    input: inputPath,
    generatedAt: new Date().toISOString(),
    summary: {
      totalFacts: facts.length,
      ...(skipSchema
        ? {}
        : {
            validFacts: facts.length - errors.length,
            schemaErrorCount: errors.length,
            schemaErrorRate: facts.length > 0 ? Number((errors.length / facts.length).toFixed(4)) : 0,
            difficultyCounts,
            averageFunScore: funScoreCount > 0 ? Number((funScoreTotal / funScoreCount).toFixed(2)) : 0,
            visualDescriptionCoverage: facts.length > 0 ? Number(((facts.length - visualMissing) / facts.length).toFixed(4)) : 0,
          }),
      ...(skipBrevity ? {} : { brevityWarningCount: brevityIssues.length }),
    },
    ...(skipSchema ? {} : { errors }),
    ...(skipBrevity ? {} : { brevityWarnings: brevityIssues }),
  }

  if (args.output) {
    const outPath = path.resolve(root, String(args.output))
    await ensureParentDir(outPath)
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`validation report: ${outPath}`)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }

  if (!skipBrevity) {
    console.log(`brevity warnings: ${brevityIssues.length} facts with issues out of ${facts.length} total`)
  }

  if (args.strict) {
    if (errors.length > 0 || brevityIssues.length > 0) {
      process.exitCode = 1
      return
    }
  }

  if (!skipSchema && !skipBrevity) {
    if (report.summary.visualDescriptionCoverage < 0.9) {
      console.warn('warning: visualDescription coverage is below 90%')
    }
  }
}

main().catch((error) => {
  console.error('[validate-output] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
