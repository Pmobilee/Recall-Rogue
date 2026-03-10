#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './qa/shared.mjs'
import { normalizeFactInput } from '../contentPipelineUtils.mjs'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../..')

const DEFAULT_LANGUAGES = ['ja', 'es', 'fr', 'de', 'ko', 'zh', 'nl', 'cs']
const JLPT_FILES = ['vocab-n5.json', 'vocab-n4.json', 'vocab-n3.json', 'vocab-n2.json', 'vocab-n1.json']

function rel(filePath) {
  return path.relative(root, filePath) || '.'
}

function toDomainKey(value) {
  return String(value || '').trim().replaceAll('-', '_')
}

function parseList(value, fallback = []) {
  const parsed = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return parsed.length > 0 ? [...new Set(parsed)] : fallback
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  const text = String(value).toLowerCase().trim()
  if (text === 'true') return true
  if (text === 'false') return false
  return fallback
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function runNodeScript(scriptRelativePath, args = [], allowExitCodes = [0]) {
  const scriptPath = path.resolve(root, scriptRelativePath)
  const startedAt = Date.now()
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env: process.env,
      maxBuffer: 1024 * 1024 * 60,
    })
    return {
      ok: true,
      exitCode: 0,
      script: scriptRelativePath,
      args,
      durationMs: Date.now() - startedAt,
      stdout: String(stdout || '').trim(),
      stderr: String(stderr || '').trim(),
    }
  } catch (error) {
    const exitCode = typeof error?.code === 'number' ? error.code : 1
    return {
      ok: allowExitCodes.includes(exitCode),
      exitCode,
      script: scriptRelativePath,
      args,
      durationMs: Date.now() - startedAt,
      stdout: String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || '').trim(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function listJsonlFiles(directory) {
  const out = []
  try {
    const names = await fs.readdir(directory)
    for (const name of names) {
      if (name.endsWith('.jsonl')) out.push(path.join(directory, name))
    }
  } catch {
    // ignore
  }
  return out.sort()
}

async function countLanguageFactsFromJsonl(directory) {
  const files = await listJsonlFiles(directory)
  const counts = {}

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const text = await fs.readFile(file, 'utf8')
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
    for (const line of lines) {
      let row
      try {
        row = JSON.parse(line)
      } catch {
        continue
      }
      const language = String(row?.language || '').trim().toLowerCase()
      if (!language) continue
      counts[language] = (counts[language] || 0) + 1
    }
  }
  return counts
}

async function countLanguageFactsFromSeed(seedDir) {
  const counts = {}
  let names = []
  try {
    names = await fs.readdir(seedDir)
  } catch {
    return counts
  }

  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const filePath = path.join(seedDir, name)
    let payload
    try {
      // eslint-disable-next-line no-await-in-loop
      payload = await readJson(filePath)
    } catch {
      continue
    }
    if (!Array.isArray(payload)) continue
    for (const row of payload) {
      const language = String(row?.language || '').trim().toLowerCase()
      if (!language) continue
      counts[language] = (counts[language] || 0) + 1
    }
  }
  return counts
}

function mergeCounts(...maps) {
  const out = {}
  for (const map of maps) {
    for (const [key, value] of Object.entries(map || {})) {
      out[key] = (out[key] || 0) + Number(value || 0)
    }
  }
  return out
}

async function loadJsonArray(filePath) {
  const payload = await readJson(filePath)
  return Array.isArray(payload) ? payload : []
}

function isFactShaped(row) {
  return row && typeof row === 'object'
    && typeof row.statement === 'string'
    && typeof row.quizQuestion === 'string'
    && typeof row.correctAnswer === 'string'
}

function deriveLanguageFromFileName(fileName) {
  const lower = fileName.toLowerCase()
  if (JLPT_FILES.includes(lower)) return 'ja'
  const match = lower.match(/^vocab-([a-z]{2})\.json$/)
  return match ? match[1] : null
}

async function buildVocabWorkerOutputs(args, report) {
  const includeVocab = parseBool(args['include-vocab'], true)
  if (!includeVocab) return { ok: true, outputs: [] }

  const vocabLanguages = parseList(args.languages, DEFAULT_LANGUAGES)
  const vocabLimit = Math.max(1, Number(args['vocab-limit'] || 5000))
  const vocabMinRows = Math.max(1, Number(args['vocab-min-rows'] || 100))
  const seedDir = path.resolve(root, String(args['seed-dir'] || 'src/data/seed'))
  const tempDir = path.resolve(root, String(args['vocab-temp-dir'] || 'data/generated/vocab-build'))
  const workerOutputDir = path.resolve(root, String(args['language-worker-output-dir'] || 'data/generated/worker-output-languages'))
  const qaRoot = path.resolve(root, String(args['qa-root'] || 'data/generated/qa-reports/worker-ingest'))

  await fs.mkdir(workerOutputDir, { recursive: true })

  const buildStep = await runNodeScript('scripts/content-pipeline/vocab/build-seed-packs.mjs', [
    '--languages', vocabLanguages.join(','),
    '--limit', String(vocabLimit),
    '--output-dir', rel(seedDir),
    '--temp-dir', rel(tempDir),
  ])
  report.steps.push({ stage: 'vocab-build', ...buildStep })
  if (!buildStep.ok) return { ok: false, outputs: [] }

  const validateStep = await runNodeScript('scripts/content-pipeline/vocab/validate-seed-packs.mjs', [
    '--languages', vocabLanguages.join(','),
    '--min-rows', String(vocabMinRows),
    '--strict', 'false',
  ])
  report.steps.push({ stage: 'vocab-validate', ...validateStep })

  let seedFiles = []
  try {
    seedFiles = (await fs.readdir(seedDir))
      .filter((name) => name.endsWith('.json'))
      .filter((name) => JLPT_FILES.includes(name.toLowerCase()) || /^vocab-[a-z]{2}\.json$/i.test(name))
      .sort()
  } catch {
    return { ok: false, outputs: [] }
  }

  const outputs = []
  for (const fileName of seedFiles) {
    const inputPath = path.join(seedDir, fileName)
    const language = deriveLanguageFromFileName(fileName)
    if (!language || !vocabLanguages.includes(language)) continue

    const stem = fileName.replace(/\.json$/i, '')
    const outputPath = path.join(workerOutputDir, `${stem}.jsonl`)

    const rows = await loadJsonArray(inputPath)
    const first = rows[0] || null

    if (first && isFactShaped(first)) {
      const normalized = rows.map((row) => normalizeFactInput({
        ...row,
        sourceName: row.sourceName || 'Vocabulary Pipeline',
        type: row.type || 'vocabulary',
        ageRating: row.ageRating || 'kid',
        rarity: row.rarity || 'common',
        category: row.category || ['Language'],
      }, { domain: 'language', verify: false }))
      await fs.writeFile(outputPath, `${normalized.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')
    } else {
      const convert = await runNodeScript('scripts/content-pipeline/vocab/vocab-to-facts.mjs', [
        '--input', rel(inputPath),
        '--output', rel(outputPath),
        '--language', language,
      ])
      report.steps.push({ stage: `vocab-to-facts:${stem}`, ...convert })
      if (!convert.ok) continue
    }

    const targetPath = path.resolve(root, String(args['generated-dir'] || 'data/generated'), `${stem}.jsonl`)
    const ingestQaDir = path.join(qaRoot, `language-${stem}`)
    const ingest = await runNodeScript('scripts/content-pipeline/manual-ingest/run.mjs', [
      'full',
      '--input', rel(outputPath),
      '--domain', 'language',
      '--target', rel(targetPath),
      '--qa-dir', rel(ingestQaDir),
      '--auto-dedup-threshold', String(Number(args['auto-dedup-threshold'] || 0.95)),
      '--review-threshold', String(Number(args['review-threshold'] || 0.75)),
      '--use-index',
      '--compare-against', String(args['compare-against'] || 'src/data/seed'),
    ], [0, 2])

    report.steps.push({ stage: `vocab-ingest:${stem}`, ...ingest })
    outputs.push({
      language,
      seedFile: rel(inputPath),
      workerOutput: rel(outputPath),
      target: rel(targetPath),
      ingestOk: ingest.ok,
      ingestExitCode: ingest.exitCode,
    })
  }

  return { ok: true, outputs }
}

async function runKnowledgePipeline(args, report) {
  const domains = parseList(args.domains, [])
  const prepareArgs = [
    'prepare',
    '--target-per-domain', String(Math.max(1, Number(args['target-per-domain'] || 1000))),
    '--source-mix', String(parseBool(args['source-mix'], true)),
    '--strict', String(parseBool(args.strict, false)),
  ]
  if (domains.length > 0) prepareArgs.push('--domains', domains.map(toDomainKey).join(','))
  if (args['worker-output-dir']) prepareArgs.push('--worker-output-dir', String(args['worker-output-dir']))
  if (args['tasks-dir']) prepareArgs.push('--tasks-dir', String(args['tasks-dir']))
  if (args['qa-dir']) prepareArgs.push('--qa-dir', String(args['qa-dir']))
  if (args['generated-dir']) prepareArgs.push('--generated-dir', String(args['generated-dir']))

  const prepare = await runNodeScript('scripts/content-pipeline/agent-workers.mjs', prepareArgs)
  report.steps.push({ stage: 'knowledge-prepare', ...prepare })

  const ingestArgs = [
    'ingest',
    '--strict', String(parseBool(args['knowledge-strict-ingest'], false)),
    '--dry-run', String(parseBool(args['dry-run'], false)),
    '--use-index', 'true',
    '--compare-against', String(args['compare-against'] || 'src/data/seed'),
    '--auto-dedup-threshold', String(Number(args['auto-dedup-threshold'] || 0.95)),
    '--review-threshold', String(Number(args['review-threshold'] || 0.75)),
  ]
  if (domains.length > 0) ingestArgs.push('--domains', domains.map(toDomainKey).join(','))
  if (args['worker-output-dir']) ingestArgs.push('--worker-output-dir', String(args['worker-output-dir']))
  if (args['tasks-dir']) ingestArgs.push('--tasks-dir', String(args['tasks-dir']))
  if (args['qa-root']) ingestArgs.push('--qa-root', String(args['qa-root']))
  if (args['generated-dir']) ingestArgs.push('--generated-dir', String(args['generated-dir']))

  const ingest = await runNodeScript('scripts/content-pipeline/agent-workers.mjs', ingestArgs, [0, 1])
  report.steps.push({ stage: 'knowledge-ingest', ...ingest })
  return { prepare, ingest }
}

async function runVisualFill(args, report) {
  if (!parseBool(args['fill-visuals'], true)) return { ok: true }
  const fill = await runNodeScript('scripts/content-pipeline/fill-missing-visual-descriptions.mjs', [
    '--generated-dir', String(args['generated-dir'] || 'data/generated'),
    '--seed-dir', String(args['seed-dir'] || 'src/data/seed'),
    '--include-generated', 'true',
    '--include-seed', String(parseBool(args['fill-visuals-in-seed'], true)),
    '--dry-run', String(parseBool(args['dry-run'], false)),
  ])
  report.steps.push({ stage: 'fill-visuals', ...fill })
  return fill
}

async function runQaAndPromote(args, report) {
  const skipQa = parseBool(args['skip-qa'], false)
  const skipPromote = parseBool(args['skip-promote'], false)

  let qa = { ok: true, exitCode: 0, skipped: true }
  let promote = { ok: true, exitCode: 0, skipped: true }

  if (!skipQa) {
    qa = await runNodeScript('scripts/content-pipeline/agent-workers.mjs', [
      'qa',
      '--generated-dir', String(args['generated-dir'] || 'data/generated'),
      '--qa-dir', String(args['qa-dir'] || 'data/generated/qa-reports'),
      '--output', String(args['qa-output'] || 'data/generated/qa-reports/agent-workers-qa.json'),
      '--coverage-knowledge-min', String(Number(args['coverage-knowledge-min'] || 3000)),
      '--coverage-language-min', String(Number(args['coverage-language-min'] || 0)),
      '--stop-on-fail', 'true',
    ], [0, 1])
    report.steps.push({ stage: 'qa', ...qa })
  } else {
    report.steps.push({ stage: 'qa', ok: true, skipped: true })
  }

  if (!skipPromote) {
    promote = await runNodeScript('scripts/content-pipeline/agent-workers.mjs', [
      'promote',
      '--generated-dir', String(args['generated-dir'] || 'data/generated'),
      '--rebuild-db', String(parseBool(args['rebuild-db'], true)),
      '--enforce-qa-gate', String(parseBool(args['enforce-qa-gate'], true)),
      '--approved-only', 'true',
    ], [0, 1])
    report.steps.push({ stage: 'promote', ...promote })
  } else {
    report.steps.push({ stage: 'promote', ok: true, skipped: true })
  }

  return { qa, promote }
}

async function main() {
  const args = parseArgs(process.argv, {
    domains: '',
    languages: DEFAULT_LANGUAGES.join(','),
    'generated-dir': 'data/generated',
    'seed-dir': 'src/data/seed',
    'worker-output-dir': 'data/generated/worker-output',
    'language-worker-output-dir': 'data/generated/worker-output-languages',
    'tasks-dir': 'data/generated/worker-packages',
    'qa-dir': 'data/generated/qa-reports',
    'qa-root': 'data/generated/qa-reports/worker-ingest',
    'qa-output': 'data/generated/qa-reports/agent-workers-qa.json',
    report: 'data/generated/qa-reports/autopilot-report.json',
    'target-per-domain': 1000,
    'target-per-language': 1000,
    'vocab-limit': 5000,
    'vocab-min-rows': 100,
    'include-vocab': true,
    'fill-visuals': true,
    'fill-visuals-in-seed': true,
    'source-mix': true,
    'knowledge-strict-ingest': false,
    'coverage-knowledge-min': 3000,
    'coverage-language-min': 0,
    'skip-qa': false,
    'skip-promote': false,
    'compare-against': 'src/data/seed',
    'auto-dedup-threshold': 0.95,
    'review-threshold': 0.75,
    'dry-run': false,
    strict: false,
    'rebuild-db': true,
    'enforce-qa-gate': true,
  })

  const reportPath = path.resolve(root, String(args.report))
  const generatedDir = path.resolve(root, String(args['generated-dir']))
  const seedDir = path.resolve(root, String(args['seed-dir']))
  const targetPerLanguage = Math.max(1, Number(args['target-per-language'] || 1000))
  const languages = parseList(args.languages, DEFAULT_LANGUAGES).map((code) => code.toLowerCase())
  const strict = parseBool(args.strict, false)

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'autopilot',
    args,
    steps: [],
    languageOutputs: [],
    shortages: {
      languages: {},
    },
    pass: true,
  }

  const knowledge = await runKnowledgePipeline(args, report)
  if (!knowledge.prepare.ok) report.pass = false
  if (!knowledge.ingest.ok && parseBool(args['knowledge-strict-ingest'], false)) report.pass = false

  const vocab = await buildVocabWorkerOutputs(args, report)
  report.languageOutputs = vocab.outputs
  if (!vocab.ok) report.pass = false

  const visuals = await runVisualFill(args, report)
  if (!visuals.ok) report.pass = false

  const qaPromote = await runQaAndPromote(args, report)
  if (!qaPromote.qa.ok) report.pass = false
  if (!qaPromote.promote.ok) report.pass = false

  const generatedLangCounts = await countLanguageFactsFromJsonl(generatedDir)
  const seedLangCounts = await countLanguageFactsFromSeed(seedDir)
  const totalLangCounts = mergeCounts(generatedLangCounts, seedLangCounts)

  for (const language of languages) {
    const count = Number(totalLangCounts[language] || 0)
    report.shortages.languages[language] = {
      count,
      target: targetPerLanguage,
      missing: Math.max(0, targetPerLanguage - count),
    }
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({
    ok: report.pass,
    reportPath,
    languageShortages: report.shortages.languages,
  }, null, 2))

  if (strict && !report.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[content-autopilot] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
