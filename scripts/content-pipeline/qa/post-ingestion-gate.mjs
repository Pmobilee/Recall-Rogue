#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function toRate(value, total) {
  const count = Math.max(0, Number(value) || 0)
  const safeTotal = Math.max(1, Number(total) || 0)
  return Number((count / safeTotal).toFixed(6))
}

function addCheck(checks, name, pass, actual, expected, detail) {
  checks.push({ name, pass, actual, expected, detail })
}

async function main() {
  const args = parseArgs(process.argv, {
    output: 'data/generated/qa-reports/post-ingestion-gate.json',
    validation: 'data/generated/qa-reports/manual-ingest-validation-report.json',
    dedup: 'data/generated/qa-reports/manual-ingest-dedup-report.json',
    'cross-domain': 'data/generated/qa-reports/cross-domain-dedup.json',
    gameplay: 'data/generated/qa-reports/gameplay-safety-report.json',
    coverage: 'data/generated/qa-reports/coverage-gate.json',
    'max-invalid-rate': 0.03,
    'max-flagged-rate': 0.01,
    'max-semantic-dup-rate': 0.2,
    'max-needs-review-rate': 0.35,
    'max-cross-domain-duplicates': 200,
    'require-gameplay-pass': true,
    'require-coverage-pass': true,
    strict: false,
  })

  const outputPath = path.resolve(root, String(args.output))
  const validationPath = path.resolve(root, String(args.validation))
  const dedupPath = path.resolve(root, String(args.dedup))
  const crossDomainPath = path.resolve(root, String(args['cross-domain']))
  const gameplayPath = path.resolve(root, String(args.gameplay))
  const coveragePath = path.resolve(root, String(args.coverage))

  const maxInvalidRate = Math.max(0, Math.min(1, Number(args['max-invalid-rate']) || 0.03))
  const maxFlaggedRate = Math.max(0, Math.min(1, Number(args['max-flagged-rate']) || 0.01))
  const maxSemanticDupRate = Math.max(0, Math.min(1, Number(args['max-semantic-dup-rate']) || 0.2))
  const maxNeedsReviewRate = Math.max(0, Math.min(1, Number(args['max-needs-review-rate']) || 0.35))
  const maxCrossDomainDuplicates = Math.max(0, Number(args['max-cross-domain-duplicates']) || 200)
  const requireGameplayPass = Boolean(args['require-gameplay-pass'])
  const requireCoveragePass = Boolean(args['require-coverage-pass'])
  const strict = Boolean(args.strict)

  const checks = []

  const validationExists = await exists(validationPath)
  const dedupExists = await exists(dedupPath)
  const crossDomainExists = await exists(crossDomainPath)
  const gameplayExists = await exists(gameplayPath)
  const coverageExists = await exists(coveragePath)

  addCheck(checks, 'validation_report_exists', validationExists, validationExists, true, validationPath)
  addCheck(checks, 'dedup_report_exists', dedupExists, dedupExists, true, dedupPath)
  addCheck(checks, 'cross_domain_report_exists', crossDomainExists, crossDomainExists, true, crossDomainPath)
  addCheck(checks, 'gameplay_report_exists', gameplayExists, gameplayExists, true, gameplayPath)
  addCheck(checks, 'coverage_report_exists', coverageExists, coverageExists, true, coveragePath)

  let metrics = {
    validation: null,
    dedup: null,
    crossDomain: null,
    gameplay: null,
    coverage: null,
  }

  if (validationExists) {
    const validation = await readJson(validationPath)
    const totalInput = Number(validation?.counts?.input || 0)
    const invalid = Number(validation?.counts?.invalid || 0)
    const flagged = Number(validation?.counts?.flagged || 0)

    const invalidRate = toRate(invalid, totalInput)
    const flaggedRate = toRate(flagged, totalInput)

    addCheck(checks, 'invalid_rate', invalidRate <= maxInvalidRate, invalidRate, `<= ${maxInvalidRate}`, `invalid=${invalid} input=${totalInput}`)
    addCheck(checks, 'flagged_rate', flaggedRate <= maxFlaggedRate, flaggedRate, `<= ${maxFlaggedRate}`, `flagged=${flagged} input=${totalInput}`)

    metrics.validation = {
      input: totalInput,
      invalid,
      flagged,
      invalidRate,
      flaggedRate,
    }
  }

  if (dedupExists) {
    const dedup = await readJson(dedupPath)
    const input = Number(dedup?.counts?.input || 0)
    const semanticDuplicates = Number(dedup?.counts?.semanticDuplicates || 0)
    const needsReview = Number(dedup?.counts?.needsReview || 0)

    const semanticDupRate = toRate(semanticDuplicates, input)
    const needsReviewRate = toRate(needsReview, input)

    addCheck(checks, 'semantic_duplicate_rate', semanticDupRate <= maxSemanticDupRate, semanticDupRate, `<= ${maxSemanticDupRate}`, `semantic=${semanticDuplicates} input=${input}`)
    addCheck(checks, 'needs_review_rate', needsReviewRate <= maxNeedsReviewRate, needsReviewRate, `<= ${maxNeedsReviewRate}`, `review=${needsReview} input=${input}`)

    metrics.dedup = {
      input,
      semanticDuplicates,
      needsReview,
      semanticDupRate,
      needsReviewRate,
    }
  }

  if (crossDomainExists) {
    const crossDomain = await readJson(crossDomainPath)
    const duplicates = Number(crossDomain?.duplicates || 0)
    addCheck(
      checks,
      'cross_domain_duplicates',
      duplicates <= maxCrossDomainDuplicates,
      duplicates,
      `<= ${maxCrossDomainDuplicates}`,
      'exact statement+answer duplicates across generated domain files',
    )
    metrics.crossDomain = { duplicates }
  }

  if (gameplayExists) {
    const gameplay = await readJson(gameplayPath)
    const gameplayPass = Boolean(gameplay?.pass)
    if (requireGameplayPass) {
      addCheck(checks, 'gameplay_safety_pass', gameplayPass, gameplayPass, true, gameplayPath)
    }
    metrics.gameplay = {
      pass: gameplayPass,
      failures: Number(gameplay?.summary?.failures || 0),
    }
  }

  if (coverageExists) {
    const coverage = await readJson(coveragePath)
    const coveragePass = Boolean(coverage?.pass)
    if (requireCoveragePass) {
      addCheck(checks, 'coverage_gate_pass', coveragePass, coveragePass, true, coveragePath)
    }
    metrics.coverage = {
      pass: coveragePass,
      deficits: Number(coverage?.summary?.deficits || 0),
    }
  }

  const failedChecks = checks.filter((check) => !check.pass)
  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      maxInvalidRate,
      maxFlaggedRate,
      maxSemanticDupRate,
      maxNeedsReviewRate,
      maxCrossDomainDuplicates,
      requireGameplayPass,
      requireCoveragePass,
    },
    checks,
    failedChecks,
    metrics,
    pass: failedChecks.length === 0,
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify({
    ok: report.pass,
    outputPath,
    checks: checks.length,
    failedChecks: failedChecks.length,
  }, null, 2))

  if (strict && !report.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[post-ingestion-gate] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
