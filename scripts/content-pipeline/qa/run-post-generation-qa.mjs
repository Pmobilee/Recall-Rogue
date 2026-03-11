#!/usr/bin/env node
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson } from './shared.mjs'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function runScript(scriptRelativePath, args = []) {
  const scriptPath = path.resolve(root, scriptRelativePath)
  const startedAt = Date.now()
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env: process.env,
      maxBuffer: 1024 * 1024 * 25,
    })

    return {
      script: scriptRelativePath,
      ok: true,
      durationMs: Date.now() - startedAt,
      stdout: String(stdout || '').trim(),
      stderr: String(stderr || '').trim(),
    }
  } catch (error) {
    return {
      script: scriptRelativePath,
      ok: false,
      durationMs: Date.now() - startedAt,
      stdout: String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || '').trim(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    'qa-dir': 'data/generated/qa-reports',
    output: 'data/generated/qa-reports/run-post-generation-qa.json',
    'coverage-knowledge-min': 10000,
    'coverage-language-min': 5000,
    'dedup-compare-against': 'src/data/seed',
    'fact-check-sample': 200,
    'gate-max-invalid-rate': 0.03,
    'gate-max-flagged-rate': 0.01,
    'gate-max-semantic-dup-rate': 0.2,
    'gate-max-needs-review-rate': 0.35,
    'gate-max-cross-domain-duplicates': 200,
    'stop-on-fail': true,
    verify: false,
  })

  const input = String(args.input)
  const qaDir = String(args['qa-dir'])
  const dedupCompareAgainst = String(args['dedup-compare-against'])
  const stopOnFail = Boolean(args['stop-on-fail'])
  const verify = Boolean(args.verify)
  const outputPath = path.resolve(root, String(args.output))

  const steps = [
    {
      script: 'scripts/content-pipeline/qa/coverage-report.mjs',
      args: ['--input', input, '--output', `${qaDir}/coverage-report.json`],
    },
    {
      script: 'scripts/content-pipeline/qa/cross-domain-dedup.mjs',
      args: ['--input', input, '--output', `${qaDir}/cross-domain-dedup.json`],
    },
    {
      script: 'scripts/content-pipeline/qa/id-collision-gate.mjs',
      args: ['--input', input, '--output', `${qaDir}/id-collision-gate.json`, '--strict'],
    },
    {
      script: 'scripts/content-pipeline/manual-ingest/run.mjs',
      args: ['validate', '--input', input, '--domain', 'general_knowledge', '--qa-dir', qaDir],
    },
    {
      script: 'scripts/content-pipeline/manual-ingest/run.mjs',
      args: [
        'dedup',
        '--input', input,
        '--compare-against', dedupCompareAgainst,
        '--use-tfidf', 'true',
        '--dry-run',
        '--auto-dedup-threshold', '0.95',
        '--review-threshold', '0.75',
        '--qa-dir', qaDir,
      ],
    },
    {
      script: 'scripts/content-pipeline/qa/flag-content-risks.mjs',
      args: ['--input', input, '--output', `${qaDir}/content-risk-report.json`],
    },
    {
      script: 'scripts/content-pipeline/qa/source-fact-check.mjs',
      args: ['--input', input, '--output', `${qaDir}/source-fact-check.json`, '--sample', String(args['fact-check-sample'])],
    },
    ...(verify
      ? [
          {
            script: 'scripts/content-pipeline/qa/verify-facts-websearch.mjs',
            args: ['--input', 'src/data/seed/facts-generated.json', '--output', `${qaDir}/verification-report.json`, '--stamp', 'true'],
          },
        ]
      : []),
    {
      script: 'scripts/content-pipeline/qa/review-sample.mjs',
      args: ['--input', input, '--output', 'samples/human-review/review-sample.md', '--perDomain', '20'],
    },
    {
      script: 'scripts/content-pipeline/qa/coverage-gate.mjs',
      args: [
        '--input', `${qaDir}/coverage-report.json`,
        '--output', `${qaDir}/coverage-gate.json`,
        '--knowledge-min', String(args['coverage-knowledge-min']),
        '--language-min', String(args['coverage-language-min']),
        '--strict',
      ],
    },
    {
      script: 'scripts/content-pipeline/qa/post-ingestion-gate.mjs',
      args: [
        '--output', `${qaDir}/post-ingestion-gate.json`,
        '--validation', `${qaDir}/manual-ingest-validation-report.json`,
        '--dedup', `${qaDir}/manual-ingest-dedup-report.json`,
        '--cross-domain', `${qaDir}/cross-domain-dedup.json`,
        '--id-collision', `${qaDir}/id-collision-gate.json`,
        '--coverage', `${qaDir}/coverage-gate.json`,
        '--max-invalid-rate', String(args['gate-max-invalid-rate']),
        '--max-flagged-rate', String(args['gate-max-flagged-rate']),
        '--max-semantic-dup-rate', String(args['gate-max-semantic-dup-rate']),
        '--max-needs-review-rate', String(args['gate-max-needs-review-rate']),
        '--max-cross-domain-duplicates', String(args['gate-max-cross-domain-duplicates']),
        '--strict',
      ],
    },
    {
      script: 'scripts/content-pipeline/qa/migrate-to-production.mjs',
      args: ['--input', input, '--output', 'data/generated/production-facts.jsonl', '--report', `${qaDir}/migration-report.json`],
    },
    {
      script: 'scripts/content-pipeline/qa/final-validation.mjs',
      args: [
        '--coverage', `${qaDir}/coverage-report.json`,
        '--dedup', `${qaDir}/cross-domain-dedup.json`,
        '--migration', `${qaDir}/migration-report.json`,
        '--gate', `${qaDir}/post-ingestion-gate.json`,
      ],
    },
  ]

  const results = []
  let haltedAfterStep = null
  for (const step of steps) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runScript(step.script, step.args)
    results.push(result)
    if (!result.ok && stopOnFail) {
      haltedAfterStep = step.script
      break
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    input,
    qaDir,
    dedupCompareAgainst,
    stopOnFail,
    haltedAfterStep,
    results,
    pass: results.every((result) => result.ok),
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify({ ok: report.pass, outputPath }, null, 2))

  if (!report.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[run-post-generation-qa] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
