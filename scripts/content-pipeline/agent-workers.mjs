#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parseArgs as parseSharedArgs, readJson, writeJson } from './qa/shared.mjs'
import { getSubcategoryDefs, toTaxonomyPromptBlock } from './subcategory-taxonomy.mjs'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../..')
const VALID_COMMANDS = new Set(['prepare', 'ingest', 'qa', 'promote', 'status', 'all', 'help'])
const DEFAULT_DOMAIN_TARGET = 1000

function parseCli(argv) {
  const token = argv[2]
  const command = token && !token.startsWith('--') ? token : 'help'
  const optionStart = token && !token.startsWith('--') ? 3 : 2
  const optionArgv = [argv[0], argv[1], ...argv.slice(optionStart)]
  const args = parseSharedArgs(optionArgv, {})
  return { command, args }
}

function toDomainKey(value) {
  return String(value || '').trim().replaceAll('-', '_')
}

function toDomainSlug(value) {
  return String(value || '').trim().replaceAll('_', '-')
}

function parseDomainList(value, fallback = []) {
  const parsed = String(value || '')
    .split(',')
    .map((item) => toDomainKey(item))
    .filter(Boolean)
  if (parsed.length > 0) return [...new Set(parsed)]
  return fallback
}

function rel(filePath) {
  return path.relative(root, filePath) || '.'
}

function resolveAbsolute(value) {
  if (!value) return null
  return path.isAbsolute(String(value)) ? String(value) : path.resolve(root, String(value))
}

function toCliArgs(options) {
  const out = []
  for (const [key, value] of Object.entries(options || {})) {
    if (value == null || value === '') continue
    out.push(`--${key}`, String(value))
  }
  return out
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function countRecords(filePath) {
  const absolutePath = path.resolve(root, filePath)
  if (!(await exists(absolutePath))) return 0

  const ext = path.extname(absolutePath).toLowerCase()
  const text = await fs.readFile(absolutePath, 'utf8')

  if (ext === '.jsonl') {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .length
  }

  if (ext === '.json') {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.length
    if (Array.isArray(parsed?.data)) return parsed.data.length
    if (Array.isArray(parsed?.results)) return parsed.results.length
    if (Array.isArray(parsed?.facts)) return parsed.facts.length
    if (Array.isArray(parsed?.words)) return parsed.words.length
    return 0
  }

  return 0
}

async function runNodeScript(scriptRelativePath, args = [], allowExitCodes = [0]) {
  const scriptPath = path.resolve(root, scriptRelativePath)
  const startedAt = Date.now()

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: root,
      env: process.env,
      maxBuffer: 1024 * 1024 * 50,
    })

    return {
      script: scriptRelativePath,
      ok: true,
      exitCode: 0,
      durationMs: Date.now() - startedAt,
      stdout: String(stdout || '').trim(),
      stderr: String(stderr || '').trim(),
      args,
    }
  } catch (error) {
    const exitCode = typeof error?.code === 'number' ? error.code : 1
    const allowed = allowExitCodes.includes(exitCode)
    return {
      script: scriptRelativePath,
      ok: allowed,
      exitCode,
      durationMs: Date.now() - startedAt,
      stdout: String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || '').trim(),
      error: error instanceof Error ? error.message : String(error),
      args,
    }
  }
}

async function loadSourcesConfig(configPath) {
  const absolutePath = path.resolve(root, configPath)
  const config = await readJson(absolutePath)
  const domainKeys = Object.keys(config?.sourceMix?.domains || config?.domains || {})
  return { config, domainKeys }
}

async function resolveDomainInputPath(domainKey, options) {
  const fromSourceMix = path.resolve(root, options.mixedDir, `${domainKey}.json`)
  if (await exists(fromSourceMix)) return fromSourceMix

  const sourceMixPrimary = options.sourceMixConfig?.[domainKey]?.primary
  if (sourceMixPrimary) {
    const primaryPath = path.resolve(root, sourceMixPrimary)
    if (await exists(primaryPath)) return primaryPath
  }

  const rawCandidates = [
    path.resolve(root, options.rawDir, `${domainKey}.json`),
    path.resolve(root, options.rawDir, `${toDomainSlug(domainKey)}.json`),
  ]

  for (const candidate of rawCandidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await exists(candidate)) return candidate
  }

  return null
}

async function countGeneratedFacts(generatedDir, domainKey) {
  const candidates = [
    path.resolve(root, generatedDir, `${domainKey}.jsonl`),
    path.resolve(root, generatedDir, `${toDomainSlug(domainKey)}.jsonl`),
    path.resolve(root, generatedDir, `${domainKey}.json`),
    path.resolve(root, generatedDir, `${toDomainSlug(domainKey)}.json`),
  ]

  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await exists(candidate)) {
      // eslint-disable-next-line no-await-in-loop
      return { count: await countRecords(candidate), path: candidate }
    }
  }

  return { count: 0, path: null }
}

function workerPrompt(task) {
  const taxonomyDefs = getSubcategoryDefs(task.domain)
  const taxonomyBlock = taxonomyDefs.length > 0
    ? toTaxonomyPromptBlock(task.domain)
    : '- (no taxonomy available for this domain)'

  return [
    `# Claude Worker Task: ${task.domain}`,
    '',
    '## Goal',
    `Generate up to ${task.requestedNewFacts} new fact rows for \`${task.domain}\` using your Claude subscription worker.`,
    '',
    '## Inputs/Outputs',
    `- Input source file: \`${task.inputPath}\``,
    `- Output JSONL file: \`${task.workerOutputPath}\``,
    `- Existing generated facts: ${task.existingFacts}`,
    `- Target facts for domain: ${task.targetFacts}`,
    `- Missing facts to fill: ${task.missingFacts}`,
    '',
    '## Hard Rules',
    '- Do NOT call any paid API scripts from this repository.',
    '- Use Claude worker reasoning and write JSONL output directly.',
    '- One JSON object per line, UTF-8, no markdown fences.',
    '- Keep all source attribution fields when available: sourceRecordId, sourceName, sourceUrl.',
    '- categoryL2 is REQUIRED and must be one of the taxonomy IDs listed below for this domain.',
    '- Keep category aligned to domain key and subcategory ID: category should include [domain, categoryL2].',
    '',
    '## Domain categoryL2 taxonomy (use ID values exactly)',
    taxonomyBlock,
    '',
    '## Fact Schema Minimum',
    '- id (string)',
    '- statement (string)',
    '- quizQuestion (string)',
    '- correctAnswer (string)',
    '- variants (array, at least 2)',
    '- distractors (array, at least 4)',
    '- categoryL2 (string taxonomy ID from list above)',
    '',
    '## Variant Rules (MANDATORY)',
    '- Generate at least 3 variants per fact, each as: { "question": "...", "type": "forward|reverse|negative|fill_blank|true_false", "correctAnswer": "...", "distractors": ["a","b","c"] }',
    '- Each variant MUST have its own correctAnswer that DIRECTLY answers its specific question (1-5 words)',
    '- NEVER copy the base correctAnswer to a variant unless it genuinely answers the variant question',
    '- Each variant needs exactly 3 plausible distractors',
    '- forward: "What/Who/Where...?" → factual answer',
    '- reverse: description → identify the subject (answer must be a NOUN)',
    '- negative: "Which is NOT...?" → the FALSE claim (distractors are TRUE statements)',
    '- fill_blank: "Sentence with _____." → missing word',
    '- true_false: "Statement." → "True" or "False"',
    '',
    '## Bad vs Good Variant Examples',
    '- BAD: Q "How long has X been used?" A "X is gluten-free" (answer doesn\'t match question)',
    '- GOOD: Q "How long has X been used?" A "Over 4,000 years" (answer matches question)',
    '- BAD: Q "What year did Y open?" A "Theobromine" (unrelated answer)',
    '- GOOD: Q "What year did Y open?" A "1993" (directly answers the question)',
    '',
    '## Local Validation (optional before handoff)',
    `node scripts/content-pipeline/manual-ingest/run.mjs validate --input ${task.workerOutputPath} --domain ${task.domain} --require-subcategory true`,
    '',
    '## Completion',
    `When done, ensure \`${task.workerOutputPath}\` exists and contains only valid JSONL facts.`,
    '',
  ].join('\n')
}

async function cmdPrepare(rawArgs) {
  const args = {
    sources: 'scripts/content-pipeline/sources.json',
    'generated-dir': 'data/generated',
    'raw-dir': 'data/raw',
    'mixed-dir': 'data/raw/mixed',
    'tasks-dir': 'data/generated/worker-packages',
    'worker-output-dir': 'data/generated/worker-output',
    'qa-dir': 'data/generated/qa-reports',
    report: 'data/generated/qa-reports/agent-workers-prepare.json',
    domains: '',
    'target-per-domain': DEFAULT_DOMAIN_TARGET,
    'source-mix': true,
    'source-mix-target': 0,
    fetch: false,
    strict: false,
    seed: 'worker-packages-v1',
    ...rawArgs,
  }

  const sourcesPath = path.resolve(root, String(args.sources))
  const generatedDir = String(args['generated-dir'])
  const rawDir = String(args['raw-dir'])
  const mixedDir = String(args['mixed-dir'])
  const tasksDir = path.resolve(root, String(args['tasks-dir']))
  const workerOutputDir = path.resolve(root, String(args['worker-output-dir']))
  const qaDir = String(args['qa-dir'])
  const reportPath = path.resolve(root, String(args.report))
  const strict = Boolean(args.strict)

  const { config, domainKeys } = await loadSourcesConfig(sourcesPath)
  const domains = parseDomainList(args.domains, domainKeys)
  const sourceMixConfig = config?.sourceMix?.domains || {}
  const targetPerDomain = Math.max(0, Number(args['target-per-domain']) || 0)

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'prepare',
    configPath: sourcesPath,
    domains,
    tasksDir,
    workerOutputDir,
    generatedDir: path.resolve(root, generatedDir),
    targetPerDomain: targetPerDomain || null,
    sourceMixEnabled: Boolean(args['source-mix']),
    strict,
    steps: [],
    tasks: [],
    totals: {
      domains: domains.length,
      missingFacts: 0,
      requestedFacts: 0,
      alreadySatisfiedDomains: 0,
      missingInputDomains: 0,
    },
    pass: true,
  }

  if (Boolean(args.fetch)) {
    const fetchStep = await runNodeScript('scripts/content-pipeline/fetch-all.mjs', [])
    report.steps.push(fetchStep)
    if (!fetchStep.ok) {
      report.pass = false
      await writeJson(reportPath, report)
      process.exit(1)
    }
  }

  if (Boolean(args['source-mix'])) {
    const mixArgs = [
      '--domains', domains.join(','),
      '--output-dir', mixedDir,
      '--report', path.join(qaDir, 'source-mix-report.json'),
      '--seed', String(args.seed),
    ]
    if (Number(args['source-mix-target']) > 0) {
      mixArgs.push('--target', String(Number(args['source-mix-target'])))
    }
    if (strict) {
      mixArgs.push('--strict')
    }

    const mixStep = await runNodeScript('scripts/content-pipeline/manual-ingest/source-mix.mjs', mixArgs)
    report.steps.push(mixStep)
    if (!mixStep.ok) {
      report.pass = false
      await writeJson(reportPath, report)
      process.exit(1)
    }
  }

  await fs.mkdir(path.join(tasksDir, 'tasks'), { recursive: true })
  await fs.mkdir(path.join(tasksDir, 'prompts'), { recursive: true })
  await fs.mkdir(workerOutputDir, { recursive: true })

  for (const domain of domains) {
    const generated = await countGeneratedFacts(generatedDir, domain)
    const expectedMinimum = Math.max(0, Number(config?.domains?.[domain]?.expectedMinimum || 0))
    const targetFacts = targetPerDomain > 0 ? targetPerDomain : expectedMinimum
    const missingFacts = Math.max(0, targetFacts - generated.count)
    const inputAbsolutePath = await resolveDomainInputPath(domain, {
      mixedDir,
      rawDir,
      sourceMixConfig,
    })

    const task = {
      domain,
      domainSlug: toDomainSlug(domain),
      existingFacts: generated.count,
      existingFactsPath: generated.path ? rel(generated.path) : null,
      targetFacts,
      expectedMinimum,
      missingFacts,
      requestedNewFacts: missingFacts,
      inputPath: inputAbsolutePath ? rel(inputAbsolutePath) : null,
      workerOutputPath: rel(path.join(workerOutputDir, `${domain}.jsonl`)),
      recommendation: missingFacts > 0 ? 'generate' : 'skip',
      pass: true,
      notes: [],
    }

    if (!inputAbsolutePath) {
      task.pass = false
      task.notes.push('input source file missing')
      report.totals.missingInputDomains += 1
      report.pass = false
    }

    if (missingFacts === 0) {
      report.totals.alreadySatisfiedDomains += 1
      task.notes.push('domain target already satisfied')
    }

    report.totals.missingFacts += missingFacts
    report.totals.requestedFacts += missingFacts
    report.tasks.push(task)

    const taskPath = path.join(tasksDir, 'tasks', `${domain}.json`)
    const promptPath = path.join(tasksDir, 'prompts', `${domain}.md`)
    await writeJson(taskPath, task)
    await fs.writeFile(promptPath, `${workerPrompt(task)}\n`, 'utf8')
  }

  const manifest = {
    generatedAt: report.generatedAt,
    seed: String(args.seed),
    domains,
    totals: report.totals,
    tasks: report.tasks,
    usage: {
      prepare: 'npm run content:workers:prepare',
      ingest: 'npm run content:workers:ingest',
      qa: 'npm run content:workers:qa',
      promote: 'npm run content:workers:promote',
      full: 'npm run content:workers:all',
    },
  }

  await writeJson(path.join(tasksDir, 'manifest.json'), manifest)
  await writeJson(reportPath, report)

  console.log(JSON.stringify({
    ok: report.pass,
    reportPath,
    manifestPath: path.join(tasksDir, 'manifest.json'),
    domains: domains.length,
    totalMissingFacts: report.totals.missingFacts,
    missingInputDomains: report.totals.missingInputDomains,
  }, null, 2))

  if (strict && !report.pass) {
    process.exit(1)
  }
}

async function loadTaskManifest(tasksDir) {
  const manifestPath = path.join(tasksDir, 'manifest.json')
  if (!(await exists(manifestPath))) return null
  return readJson(manifestPath)
}

async function resolveWorkerOutputPath(domain, workerOutputDir, manifestTask = null) {
  const fromManifest = manifestTask?.workerOutputPath
    ? path.resolve(root, manifestTask.workerOutputPath)
    : null
  if (fromManifest && await exists(fromManifest)) {
    return fromManifest
  }

  const candidates = [
    path.resolve(root, workerOutputDir, `${domain}.jsonl`),
    path.resolve(root, workerOutputDir, `${toDomainSlug(domain)}.jsonl`),
    path.resolve(root, workerOutputDir, `${domain}.json`),
    path.resolve(root, workerOutputDir, `${toDomainSlug(domain)}.json`),
  ]

  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await exists(candidate)) return candidate
  }

  return null
}

async function tryReadJson(filePath) {
  try {
    return await readJson(filePath)
  } catch {
    return null
  }
}

function summarizeStage(report, fallbackPass = null) {
  if (!report) {
    return { available: false, pass: fallbackPass, generatedAt: null }
  }
  return {
    available: true,
    pass: typeof report?.pass === 'boolean'
      ? report.pass
      : (typeof report?.run?.ok === 'boolean' ? report.run.ok : fallbackPass),
    generatedAt: report?.generatedAt || null,
  }
}

async function cmdIngest(rawArgs) {
  const args = {
    sources: 'scripts/content-pipeline/sources.json',
    domains: '',
    'tasks-dir': 'data/generated/worker-packages',
    'worker-output-dir': 'data/generated/worker-output',
    'generated-dir': 'data/generated',
    'qa-root': 'data/generated/qa-reports/worker-ingest',
    report: 'data/generated/qa-reports/agent-workers-ingest.json',
    'use-index': true,
    'compare-against': '',
    'auto-dedup-threshold': 0.95,
    'review-threshold': 0.75,
    'dry-run': false,
    strict: true,
    ...rawArgs,
  }

  const { domainKeys } = await loadSourcesConfig(String(args.sources))
  const tasksDir = path.resolve(root, String(args['tasks-dir']))
  const workerOutputDir = String(args['worker-output-dir'])
  const generatedDir = String(args['generated-dir'])
  const qaRoot = path.resolve(root, String(args['qa-root']))
  const reportPath = path.resolve(root, String(args.report))
  const strict = Boolean(args.strict)
  const dryRun = Boolean(args['dry-run'])
  const useIndex = Boolean(args['use-index'])
  const compareAgainst = String(args['compare-against'] || '').trim()

  const manifest = await loadTaskManifest(tasksDir)
  const manifestTasks = new Map(
    Array.isArray(manifest?.tasks)
      ? manifest.tasks.map((task) => [toDomainKey(task?.domain), task])
      : [],
  )
  const domains = parseDomainList(args.domains, manifest?.domains || domainKeys)

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'ingest',
    domains,
    dryRun,
    strict,
    useIndex,
    compareAgainst: compareAgainst || null,
    tasksDir,
    workerOutputDir: path.resolve(root, workerOutputDir),
    qaRoot,
    results: [],
    pass: true,
    totals: {
      domains: domains.length,
      domainsProcessed: 0,
      domainsMissingOutput: 0,
      inputsFound: 0,
      inputsRows: 0,
    },
  }

  await fs.mkdir(qaRoot, { recursive: true })

  if (useIndex) {
    const indexArgs = ['build-index']
    if (compareAgainst) {
      indexArgs.push('--compare-against', compareAgainst)
    }
    const indexStep = await runNodeScript('scripts/content-pipeline/manual-ingest/run.mjs', indexArgs)
    report.indexStep = indexStep
    if (!indexStep.ok && strict) {
      report.pass = false
      await writeJson(reportPath, report)
      process.exit(1)
    }
  }

  for (const domain of domains) {
    const task = manifestTasks.get(domain) || null
    const expectedMissing = Math.max(0, Number(task?.missingFacts || 0))
    const inputPath = await resolveWorkerOutputPath(domain, workerOutputDir, task)
    const targetPath = path.resolve(root, generatedDir, `${domain}.jsonl`)
    const qaDir = path.join(qaRoot, domain)

    const domainResult = {
      domain,
      expectedMissing,
      inputPath: inputPath ? rel(inputPath) : null,
      targetPath: rel(targetPath),
      qaDir: rel(qaDir),
      ok: false,
      skipped: false,
      pass: true,
      inputRows: 0,
      mergePreview: null,
      dedupReport: null,
      validationReport: null,
      run: null,
      notes: [],
    }

    if (!inputPath) {
      domainResult.pass = expectedMissing === 0
      domainResult.skipped = true
      domainResult.notes.push(expectedMissing > 0 ? 'worker output missing' : 'no missing facts requested')
      report.totals.domainsMissingOutput += 1
      if (!domainResult.pass) report.pass = false
      report.results.push(domainResult)
      continue
    }

    domainResult.inputRows = await countRecords(inputPath)
    report.totals.inputsFound += 1
    report.totals.inputsRows += domainResult.inputRows

    const runArgs = [
      'full',
      '--input', rel(inputPath),
      '--domain', domain,
      '--target', rel(targetPath),
      '--qa-dir', rel(qaDir),
      '--require-subcategory', 'true',
      '--auto-dedup-threshold', String(args['auto-dedup-threshold']),
      '--review-threshold', String(args['review-threshold']),
    ]

    if (dryRun) runArgs.push('--dry-run')
    if (useIndex) runArgs.push('--use-index')
    if (compareAgainst) runArgs.push('--compare-against', compareAgainst)

    const run = await runNodeScript('scripts/content-pipeline/manual-ingest/run.mjs', runArgs)
    domainResult.run = run
    domainResult.ok = run.ok
    domainResult.pass = run.ok

    const mergePreviewPath = path.join(qaDir, 'manual-ingest-merge-preview.json')
    const dedupPath = path.join(qaDir, 'manual-ingest-dedup-report.json')
    const validationPath = path.join(qaDir, 'manual-ingest-validation-report.json')

    const mergePreview = await tryReadJson(mergePreviewPath)
    const dedupReport = await tryReadJson(dedupPath)
    const validationReport = await tryReadJson(validationPath)

    domainResult.mergePreview = mergePreview
      ? { factsToAdd: mergePreview.factsToAdd, newTotalAfterMerge: mergePreview.newTotalAfterMerge }
      : null
    domainResult.dedupReport = dedupReport ? dedupReport.counts : null
    domainResult.validationReport = validationReport ? validationReport.counts : null

    if (!run.ok) {
      report.pass = false
    }

    report.results.push(domainResult)
    report.totals.domainsProcessed += 1
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({
    ok: report.pass,
    reportPath,
    domains: report.totals.domains,
    processed: report.totals.domainsProcessed,
    missingOutputs: report.totals.domainsMissingOutput,
    inputRows: report.totals.inputsRows,
  }, null, 2))

  if (strict && !report.pass) {
    process.exit(1)
  }
}

async function cmdQa(rawArgs) {
  const args = {
    'generated-dir': 'data/generated',
    'qa-dir': 'data/generated/qa-reports',
    output: 'data/generated/qa-reports/agent-workers-qa.json',
    'coverage-knowledge-min': 3000,
    'coverage-language-min': 0,
    'dedup-compare-against': 'src/data/seed',
    'fact-check-sample': 200,
    'gate-max-invalid-rate': 0.03,
    'gate-max-flagged-rate': 0.01,
    'gate-max-semantic-dup-rate': 0.2,
    'gate-max-needs-review-rate': 0.35,
    'gate-max-cross-domain-duplicates': 200,
    'stop-on-fail': true,
    ...rawArgs,
  }

  const runArgs = toCliArgs({
    input: args['generated-dir'],
    'qa-dir': args['qa-dir'],
    output: args.output,
    'coverage-knowledge-min': args['coverage-knowledge-min'],
    'coverage-language-min': args['coverage-language-min'],
    'dedup-compare-against': args['dedup-compare-against'],
    'fact-check-sample': args['fact-check-sample'],
    'gate-max-invalid-rate': args['gate-max-invalid-rate'],
    'gate-max-flagged-rate': args['gate-max-flagged-rate'],
    'gate-max-semantic-dup-rate': args['gate-max-semantic-dup-rate'],
    'gate-max-needs-review-rate': args['gate-max-needs-review-rate'],
    'gate-max-cross-domain-duplicates': args['gate-max-cross-domain-duplicates'],
    'stop-on-fail': args['stop-on-fail'],
  })

  const run = await runNodeScript('scripts/content-pipeline/qa/run-post-generation-qa.mjs', runArgs)
  const summaryPath = path.resolve(root, String(args.output).replace(/\.json$/i, '-wrapper.json'))
  await writeJson(summaryPath, {
    generatedAt: new Date().toISOString(),
    command: 'qa',
    args,
    run,
  })

  if (!run.ok) {
    process.exit(1)
  }
}

async function cmdPromote(rawArgs) {
  const args = {
    'generated-dir': 'data/generated',
    output: 'src/data/seed/facts-generated.json',
    'approved-only': false,
    'rebuild-db': true,
    'enforce-qa-gate': false,
    'qa-report': 'data/generated/qa-reports/post-ingestion-gate.json',
    report: 'data/generated/qa-reports/agent-workers-promote-wrapper.json',
    ...rawArgs,
  }

  const runArgs = [
    '--input', String(args['generated-dir']),
    '--output', String(args.output),
    '--approved-only', String(Boolean(args['approved-only'])),
    '--rebuild-db', String(Boolean(args['rebuild-db'])),
    '--enforce-qa-gate', String(Boolean(args['enforce-qa-gate'])),
    '--qa-report', String(args['qa-report']),
  ]

  const run = await runNodeScript('scripts/content-pipeline/qa/promote-approved-to-db.mjs', runArgs)
  const wrapperPath = path.resolve(root, String(args.report))
  await writeJson(wrapperPath, {
    generatedAt: new Date().toISOString(),
    command: 'promote',
    args,
    run,
  })

  if (!run.ok) {
    process.exit(1)
  }
}

async function cmdStatus(rawArgs) {
  const args = {
    sources: 'scripts/content-pipeline/sources.json',
    domains: '',
    'generated-dir': 'data/generated',
    'worker-output-dir': 'data/generated/worker-output',
    'tasks-dir': 'data/generated/worker-packages',
    'prepare-report': 'data/generated/qa-reports/agent-workers-prepare.json',
    'ingest-report': 'data/generated/qa-reports/agent-workers-ingest.json',
    'qa-report': 'data/generated/qa-reports/agent-workers-qa.json',
    'qa-wrapper-report': 'data/generated/qa-reports/agent-workers-qa-wrapper.json',
    'promote-report': 'data/generated/qa-reports/agent-workers-promote-wrapper.json',
    output: '',
    ...rawArgs,
  }

  const sourcesPath = path.resolve(root, String(args.sources))
  const generatedDir = String(args['generated-dir'])
  const workerOutputDir = String(args['worker-output-dir'])
  const tasksDir = path.resolve(root, String(args['tasks-dir']))

  const [{ config, domainKeys }, manifest, prepareReport, ingestReport, qaReport, qaWrapperReport, promoteReport] = await Promise.all([
    loadSourcesConfig(sourcesPath),
    loadTaskManifest(tasksDir),
    tryReadJson(path.resolve(root, String(args['prepare-report']))),
    tryReadJson(path.resolve(root, String(args['ingest-report']))),
    tryReadJson(path.resolve(root, String(args['qa-report']))),
    tryReadJson(path.resolve(root, String(args['qa-wrapper-report']))),
    tryReadJson(path.resolve(root, String(args['promote-report']))),
  ])

  const manifestTasks = new Map(
    Array.isArray(manifest?.tasks)
      ? manifest.tasks.map((task) => [toDomainKey(task?.domain), task])
      : [],
  )
  const domains = parseDomainList(args.domains, manifest?.domains || domainKeys)

  const rows = []
  const totals = {
    domains: domains.length,
    generatedFacts: 0,
    workerOutputFacts: 0,
    targetFacts: 0,
    missingFacts: 0,
    targetMetDomains: 0,
    pendingIngestDomains: 0,
    needsGenerationDomains: 0,
  }

  for (const domain of domains) {
    const task = manifestTasks.get(domain) || null
    const generated = await countGeneratedFacts(generatedDir, domain)
    const workerOutputPath = await resolveWorkerOutputPath(domain, workerOutputDir, task)
    const workerOutputCount = workerOutputPath ? await countRecords(workerOutputPath) : 0
    const expectedMinimum = Math.max(0, Number(config?.domains?.[domain]?.expectedMinimum || 0))
    const taskTarget = Math.max(0, Number(task?.targetFacts || 0))
    const targetFacts = Math.max(taskTarget, expectedMinimum)
    const missingFacts = Math.max(0, targetFacts - generated.count)

    let state = 'no_target'
    if (targetFacts > 0) {
      if (missingFacts === 0) state = 'target_met'
      else if (workerOutputCount > 0) state = 'pending_ingest'
      else state = 'needs_generation'
    }

    rows.push({
      domain,
      generatedFacts: generated.count,
      generatedPath: generated.path ? rel(generated.path) : null,
      workerOutputFacts: workerOutputCount,
      workerOutputPath: workerOutputPath ? rel(workerOutputPath) : null,
      targetFacts,
      missingFacts,
      state,
    })

    totals.generatedFacts += generated.count
    totals.workerOutputFacts += workerOutputCount
    totals.targetFacts += targetFacts
    totals.missingFacts += missingFacts
    if (state === 'target_met') totals.targetMetDomains += 1
    if (state === 'pending_ingest') totals.pendingIngestDomains += 1
    if (state === 'needs_generation') totals.needsGenerationDomains += 1
  }

  const prepareSummary = summarizeStage(prepareReport)
  const ingestSummary = summarizeStage(ingestReport)
  const qaSummary = summarizeStage(
    qaWrapperReport || qaReport,
    typeof qaReport?.pass === 'boolean' ? qaReport.pass : null,
  )
  const promoteSummary = summarizeStage(promoteReport)

  const [prepareContextExists, ingestContextExists, qaContextExists] = await Promise.all([
    prepareReport?.generatedDir ? exists(resolveAbsolute(prepareReport.generatedDir)) : null,
    ingestReport?.workerOutputDir ? exists(resolveAbsolute(ingestReport.workerOutputDir)) : null,
    qaReport?.input ? exists(resolveAbsolute(qaReport.input)) : null,
  ])
  if (prepareContextExists === false) prepareSummary.stale = true
  if (ingestContextExists === false) ingestSummary.stale = true
  if (qaContextExists === false) qaSummary.stale = true

  const qaFailedStep = Array.isArray(qaReport?.results)
    ? qaReport.results.find((entry) => entry?.ok === false)?.script || null
    : null

  const blockers = []
  for (const row of rows) {
    if (row.state !== 'target_met') {
      blockers.push({
        domain: row.domain,
        state: row.state,
        missingFacts: row.missingFacts,
      })
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    command: 'status',
    domains,
    totals,
    stages: {
      prepare: prepareSummary,
      ingest: ingestSummary,
      qa: {
        ...qaSummary,
        failedStep: qaFailedStep,
      },
      promote: promoteSummary,
    },
    blockers,
    rows,
  }

  if (String(args.output || '').trim()) {
    await writeJson(path.resolve(root, String(args.output)), summary)
  }

  console.log(JSON.stringify(summary, null, 2))
}

async function cmdAll(rawArgs) {
  await cmdPrepare(rawArgs)
  await cmdIngest(rawArgs)
  await cmdQa(rawArgs)
  await cmdPromote(rawArgs)
}

function printHelp() {
  console.log([
    'Usage:',
    '  node scripts/content-pipeline/agent-workers.mjs <command> [options]',
    '',
    'Commands:',
    '  prepare  Build source-mix, compute missing counts, emit worker task files + prompts',
    '  ingest   Merge worker outputs through manual-ingest validate/dedup/finalize flow',
    '  qa       Run strict post-generation QA chain',
    '  promote  Promote approved facts and rebuild DB',
    '  status   Summarize per-domain generation/ingest readiness + stage reports',
    '  all      Run prepare -> ingest -> qa -> promote',
    '',
    'Examples:',
    '  npm run content:workers:prepare -- --target-per-domain 1200',
    '  npm run content:workers:ingest -- --worker-output-dir data/generated/worker-output --strict true',
    '  npm run content:workers:status -- --output data/generated/qa-reports/agent-workers-status.json',
    '  npm run content:workers:all -- --domains geography,history --dry-run true --rebuild-db false',
  ].join('\n'))
}

async function main() {
  const { command, args } = parseCli(process.argv)
  if (!VALID_COMMANDS.has(command)) {
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exit(1)
  }

  switch (command) {
    case 'prepare':
      await cmdPrepare(args)
      break
    case 'ingest':
      await cmdIngest(args)
      break
    case 'qa':
      await cmdQa(args)
      break
    case 'promote':
      await cmdPromote(args)
      break
    case 'status':
      await cmdStatus(args)
      break
    case 'all':
      await cmdAll(args)
      break
    case 'help':
    default:
      printHelp()
      break
  }
}

main().catch((error) => {
  console.error('[agent-workers] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
