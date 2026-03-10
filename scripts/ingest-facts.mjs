#!/usr/bin/env node
/**
 * Bulk fact ingestion + validation tool (AR-11).
 *
 * Examples:
 *   node scripts/ingest-facts.mjs --source ./tmp/facts.json --domain geography --dry-run
 *   node scripts/ingest-facts.mjs --source ./tmp/facts.json --domain geography --target ./src/data/seed/facts-general.json
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  normalizeFactInput,
  validateFactRecord,
  detectDuplicateQuestions,
  buildCoverageReport,
} from './contentPipelineUtils.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const SEED_DIR = path.join(ROOT, 'src', 'data', 'seed')
const DEFAULT_REPORT = path.join(ROOT, 'docs', 'roadmap', 'evidence', 'content-ingest-report.json')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function readFactsSource(filePath) {
  if (filePath.endsWith('.jsonl')) {
    return readJsonl(filePath)
  }
  return readJson(filePath)
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...findJsonFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full)
  }
  return files
}

function loadExistingFacts() {
  const files = findJsonFiles(SEED_DIR)
  const facts = []
  for (const file of files) {
    try {
      const parsed = readJson(file)
      if (Array.isArray(parsed)) facts.push(...parsed)
    } catch {
      // Ignore malformed seed files during import auditing.
    }
  }
  return facts
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const source = args.source
  if (!source || typeof source !== 'string') {
    console.error('Usage: node scripts/ingest-facts.mjs --source <file.json> [--domain <name>] [--target <seed.json>] [--verify] [--dry-run]')
    process.exit(1)
  }

  const sourcePath = path.resolve(process.cwd(), source)
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`)
    process.exit(1)
  }

  const dryRun = Boolean(args['dry-run'])
  const verify = Boolean(args.verify)
  const domain = typeof args.domain === 'string' ? args.domain : 'general'
  const outputPath = typeof args.output === 'string'
    ? path.resolve(process.cwd(), args.output)
    : path.join(ROOT, 'docs', 'roadmap', 'evidence', 'ingest-output.normalized.json')
  const targetPath = typeof args.target === 'string' ? path.resolve(process.cwd(), args.target) : null
  const reportPath = typeof args.report === 'string' ? path.resolve(process.cwd(), args.report) : DEFAULT_REPORT

  const incomingRaw = readFactsSource(sourcePath)
  if (!Array.isArray(incomingRaw)) {
    console.error('Source must be a JSON array (.json) or JSONL stream (.jsonl) of fact objects.')
    process.exit(1)
  }

  const existing = loadExistingFacts()
  const normalized = incomingRaw.map((raw) => normalizeFactInput(raw, { domain, verify }))

  const validations = normalized.map((fact) => ({
    fact,
    ...validateFactRecord(fact),
  }))

  const validPreDedup = validations.filter((item) => item.valid).map((item) => item.fact)
  const invalid = validations
    .filter((item) => !item.valid)
    .map((item) => ({
      id: item.fact.id,
      question: item.fact.quizQuestion,
      errors: item.errors,
      warnings: item.warnings,
    }))

  const duplicates = detectDuplicateQuestions(validPreDedup, existing, 0.85)
  const duplicateQuestionSet = new Set(duplicates.map((row) => row.question))
  const valid = validPreDedup.filter((fact) => !duplicateQuestionSet.has(fact.quizQuestion))

  const report = {
    generatedAt: new Date().toISOString(),
    sourcePath: path.relative(ROOT, sourcePath),
    targetPath: targetPath ? path.relative(ROOT, targetPath) : null,
    dryRun,
    verify,
    totals: {
      input: incomingRaw.length,
      valid: valid.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
    },
    invalid,
    duplicates,
    coverage: buildCoverageReport(valid),
  }

  writeJson(reportPath, report)

  if (!dryRun) {
    writeJson(outputPath, valid)
    if (targetPath) {
      const current = fs.existsSync(targetPath) ? readJson(targetPath) : []
      if (!Array.isArray(current)) {
        throw new Error(`Target file is not an array JSON: ${targetPath}`)
      }
      writeJson(targetPath, [...current, ...valid])
    }
  }

  console.log(`Ingest report: ${path.relative(ROOT, reportPath)}`)
  if (!dryRun) {
    console.log(`Normalized output: ${path.relative(ROOT, outputPath)}`)
    if (targetPath) console.log(`Target updated: ${path.relative(ROOT, targetPath)}`)
  }
  console.log(`Input: ${report.totals.input}`)
  console.log(`Valid: ${report.totals.valid}`)
  console.log(`Invalid: ${report.totals.invalid}`)
  console.log(`Duplicates: ${report.totals.duplicates}`)
}

main()
