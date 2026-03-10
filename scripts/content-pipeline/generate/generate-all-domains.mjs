#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DEFAULT_DOMAINS = [
  'general-knowledge',
  'natural-sciences',
  'space-astronomy',
  'geography',
  'history',
  'mythology-folklore',
  'animals-wildlife',
  'human-body-health',
  'food-cuisine',
  'art-architecture',
]

function parseArgs(argv, defaults = {}) {
  const out = { ...defaults }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next == null || next.startsWith('--')) {
      out[key] = true
      continue
    }
    if (next === 'true') out[key] = true
    else if (next === 'false') out[key] = false
    else if (!Number.isNaN(Number(next)) && next.trim() !== '') out[key] = Number(next)
    else out[key] = next
    i += 1
  }
  return out
}

function resolveFromRoot(relativePath) {
  return path.resolve(root, relativePath)
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function runNodeScript(scriptRelativePath, args = []) {
  const scriptPath = resolveFromRoot(scriptRelativePath)
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env: process.env,
    maxBuffer: 1024 * 1024 * 30,
  })
  return {
    stdout: String(stdout || '').trim(),
    stderr: String(stderr || '').trim(),
  }
}

function toUnderscoreDomain(slug) {
  return String(slug).replace(/-/g, '_')
}

function toSlugDomain(raw) {
  return String(raw).trim().replace(/_/g, '-')
}

async function main() {
  const args = parseArgs(process.argv, {
    domains: DEFAULT_DOMAINS.join(','),
    'input-dir': 'data/raw',
    'output-dir': 'data/generated',
    'report-path': 'data/generated/qa-reports/generate-all-domains-report.json',
    limit: 0,
    'dry-run': true,
    resume: true,
    validate: true,
    strict: false,
    concurrency: 2,
    'rate-limit': Number(process.env.HAIKU_RATE_LIMIT || 50),
    retries: Number(process.env.HAIKU_RETRIES || 3),
    'max-cost-usd': Number(process.env.HAIKU_MAX_COST_USD || 0),
    'budget-ledger': process.env.HAIKU_BUDGET_LEDGER_PATH || '',
    'retry-report-limit': 5000,
    'retry-flag-threshold': 3,
    'source-mix': false,
    'source-mix-output-dir': 'data/raw/mixed',
    'source-mix-report': 'data/generated/qa-reports/source-mix-report.json',
    'source-mix-target': 0,
  })

  const domains = String(args.domains)
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean)

  const inputDir = resolveFromRoot(String(args['input-dir']))
  const outputDir = resolveFromRoot(String(args['output-dir']))
  const reportPath = resolveFromRoot(String(args['report-path']))
  const limit = Math.max(0, Number(args.limit) || 0)
  const dryRun = Boolean(args['dry-run'])
  const resume = Boolean(args.resume)
  const validate = Boolean(args.validate)
  const strict = Boolean(args.strict)
  const concurrency = Math.max(1, Number(args.concurrency) || 2)
  const rateLimit = Math.max(1, Number(args['rate-limit']) || 50)
  const retries = Math.max(1, Number(args.retries) || 3)
  const maxCostUsd = Math.max(0, Number(args['max-cost-usd']) || 0)
  const budgetLedger = String(args['budget-ledger'] || '').trim()
  const retryReportLimit = Math.max(0, Number(args['retry-report-limit']) || 5000)
  const retryFlagThreshold = Math.max(1, Number(args['retry-flag-threshold']) || 3)
  const sourceMix = Boolean(args['source-mix'])
  const sourceMixOutputDir = String(args['source-mix-output-dir'] || 'data/raw/mixed')
  const sourceMixReport = String(args['source-mix-report'] || 'data/generated/qa-reports/source-mix-report.json')
  const sourceMixTarget = Math.max(0, Number(args['source-mix-target']) || 0)

  if (sourceMix) {
    const mixArgs = [
      '--domains', domains.map((domain) => toUnderscoreDomain(toSlugDomain(domain))).join(','),
      '--output-dir', sourceMixOutputDir,
      '--report', sourceMixReport,
    ]
    if (sourceMixTarget > 0) {
      mixArgs.push('--target', String(sourceMixTarget))
    }
    await runNodeScript('scripts/content-pipeline/manual-ingest/source-mix.mjs', mixArgs)
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.mkdir(path.dirname(reportPath), { recursive: true })

  const results = []

  for (const domainSlug of domains) {
    const startedAt = Date.now()
    const normalizedSlug = toSlugDomain(domainSlug)
    const domainKey = toUnderscoreDomain(normalizedSlug)
    const inputCandidates = [
      ...(sourceMix ? [path.join(resolveFromRoot(sourceMixOutputDir), `${domainKey}.json`)] : []),
      path.join(inputDir, `${domainSlug}.json`),
      path.join(inputDir, `${normalizedSlug}.json`),
      path.join(inputDir, `${domainKey}.json`),
    ].filter((candidate, idx, arr) => arr.indexOf(candidate) === idx)

    let inputPath = null
    for (const candidate of inputCandidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await exists(candidate)) {
        inputPath = candidate
        break
      }
    }

    const outputPath = path.join(outputDir, `${domainKey}.jsonl`)

    const result = {
      requestedDomain: domainSlug,
      domain: normalizedSlug,
      domainKey,
      inputPath,
      outputPath,
      ok: false,
      generated: false,
      validated: false,
      dryRun,
      durationMs: 0,
      steps: [],
    }

    if (!inputPath) {
      result.steps.push({
        name: 'preflight',
        ok: false,
        error: `input file missing; tried: ${inputCandidates.join(', ')}`,
      })
      result.durationMs = Date.now() - startedAt
      results.push(result)
      if (strict) {
        const report = {
          generatedAt: new Date().toISOString(),
          inputDir,
          outputDir,
          domains,
          dryRun,
          validate,
          strict,
          concurrency,
          results,
          pass: false,
        }
        await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
        process.exit(1)
      }
      continue
    }

    const generateArgs = [
      '--input', inputPath,
      '--domain', domainKey,
      '--output', outputPath,
      '--concurrency', String(concurrency),
      '--rate-limit', String(rateLimit),
      '--retries', String(retries),
      '--max-cost-usd', String(maxCostUsd),
      '--retry-report-limit', String(retryReportLimit),
      '--retry-flag-threshold', String(retryFlagThreshold),
    ]

    if (budgetLedger) {
      generateArgs.push('--budget-ledger', budgetLedger)
    }

    if (limit > 0) {
      generateArgs.push('--limit', String(limit))
    }

    if (resume) {
      generateArgs.push('--resume')
    }

    if (dryRun) {
      generateArgs.push('--dry-run')
    }

    try {
      const run = await runNodeScript('scripts/content-pipeline/generate/batch-generate.mjs', generateArgs)
      result.steps.push({ name: 'generate', ok: true, stdout: run.stdout, stderr: run.stderr })
      result.generated = true
    } catch (error) {
      result.steps.push({
        name: 'generate',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
      result.durationMs = Date.now() - startedAt
      results.push(result)
      if (strict) {
        break
      }
      continue
    }

    if (validate) {
      try {
        const run = await runNodeScript('scripts/content-pipeline/generate/validate-output.mjs', [
          '--input',
          outputPath,
          '--strict',
        ])
        result.steps.push({ name: 'validate', ok: true, stdout: run.stdout, stderr: run.stderr })
        result.validated = true
      } catch (error) {
        result.steps.push({
          name: 'validate',
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })
        result.durationMs = Date.now() - startedAt
        results.push(result)
        if (strict) {
          break
        }
        continue
      }
    }

    result.ok = true
    result.durationMs = Date.now() - startedAt
    results.push(result)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputDir,
    outputDir,
    domains,
    dryRun,
    validate,
    strict,
    concurrency,
    rateLimit,
    retries,
    maxCostUsd,
    budgetLedger: budgetLedger || null,
    retryReportLimit,
    retryFlagThreshold,
    resume,
    limit: limit || null,
    results,
    pass: results.length > 0 && results.every((result) => result.ok),
  }

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    ok: report.pass,
    reportPath,
    totalDomains: results.length,
    passedDomains: results.filter((result) => result.ok).length,
  }, null, 2))

  if (strict && !report.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[generate-all-domains] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
  if (!dryRun) {
    throw new Error('Paid API generation is disabled in this repo. Keep --dry-run true and use external Claude workers for live fact generation.')
  }
