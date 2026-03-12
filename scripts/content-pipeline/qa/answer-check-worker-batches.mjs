#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, writeJson, normalizeText } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DEFAULT_WORKERS = [
  { name: 'gpt-5.1-mini', modelLabel: 'gpt-5.1-mini (subscription worker)' },
  { name: 'spark', modelLabel: 'gpt-5-spark (subscription worker)' },
]

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseWorkers(workersCsv) {
  const workerNames = parseCsv(workersCsv)
  if (workerNames.length === 0) return [...DEFAULT_WORKERS]

  return workerNames.map((name) => {
    const fallback = DEFAULT_WORKERS.find((entry) => entry.name === name)
    return {
      name,
      modelLabel: fallback?.modelLabel || `${name} (subscription worker)`,
    }
  })
}

function toTagsSet(fact) {
  const tags = new Set()
  const rawTags = fact?.tags
  if (Array.isArray(rawTags)) {
    for (const item of rawTags) {
      const value = String(item || '').trim().toLowerCase()
      if (value) tags.add(value)
    }
  } else if (typeof rawTags === 'string') {
    for (const item of parseCsv(rawTags)) {
      const value = item.toLowerCase()
      if (value) tags.add(value)
    }
  }
  return tags
}

function matchesTags(fact, requiredTags, tagMode) {
  if (requiredTags.length === 0) return true
  const tags = toTagsSet(fact)
  if (tags.size === 0) return false

  if (tagMode === 'all') {
    return requiredTags.every((tag) => tags.has(tag))
  }
  return requiredTags.some((tag) => tags.has(tag))
}

function extractRowsFromParsed(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.facts)) return payload.facts
  return []
}

function sanitizeWorkerFileName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'worker'
}

function baseHeuristicIssues(fact) {
  const issues = []
  const question = String(fact?.quizQuestion || '').trim()
  const answer = String(fact?.correctAnswer || '').trim()
  const qLower = question.toLowerCase()

  if (!question) issues.push('missing question')
  if (!answer) issues.push('missing answer')
  if (question.endsWith('...')) issues.push('truncated question')
  if (answer.endsWith('...')) issues.push('truncated answer')

  const questionNorm = normalizeText(question)
  const answerNorm = normalizeText(answer)

  if (answerNorm && answerNorm.length >= 5 && questionNorm.includes(answerNorm)) {
    issues.push('answer appears directly in question')
  }

  const isNumericOrDateQuestion = /\b(how many|how much|what year|which year)\b/.test(qLower) || /^when\b/.test(qLower)
  if (isNumericOrDateQuestion && !/\d/.test(answer)) {
    if (answer.length > 8) issues.push('question expects numeric/date answer')
  }

  if (/\b(where|which country|which city|which continent)\b/.test(qLower)) {
    const words = answer.split(/\s+/).filter(Boolean)
    if (words.length > 8) issues.push('location question has non-location style answer')
  }

  if (/\b(who|which person|which scientist|which leader)\b/.test(qLower)) {
    const words = answer.split(/\s+/).filter(Boolean)
    if (words.length > 8) issues.push('person question has non-person style answer')
  }

  return [...new Set(issues)]
}

function buildWorkerPrompt({ workerName, modelLabel, issueColumn, assignmentPath, reviewedPath }) {
  return [
    `# Worker Task: ${workerName}`,
    '',
    `Model target: ${modelLabel}`,
    'Execution mode: direct subscription worker only (NO API calls).',
    '',
    '## Hard Rules',
    '- Do NOT use any external model gateway or paid API from scripts.',
    '- Do NOT use SDK-based direct model API calls.',
    '- Use only direct Codex/Claude subscription worker execution.',
    '- If running in Claude/Anthropic tooling, use Haiku worker tier by default.',
    '- For every row, keep all existing fields unchanged except the issue column.',
    `- Write issues into \`${issueColumn}\` and leave it as empty string when valid.`,
    '',
    '## Input',
    `- Assignment JSONL: \`${assignmentPath}\``,
    '',
    '## Validation Target',
    '- Check whether `correctAnswer` directly and sensibly answers `quizQuestion`.',
    '- If invalid, write a short issue reason (<= 14 words).',
    '- If valid, write empty string.',
    '',
    '## Output',
    `- Reviewed JSONL: \`${reviewedPath}\``,
    '- Must contain the same number of rows as input.',
    '- Must preserve row order and IDs.',
    '',
  ].join('\n')
}

async function loadCandidates(inputPath, issueColumn, mode, requiredTags, tagMode, cap) {
  const absoluteInput = path.resolve(root, inputPath)
  const stat = await fs.stat(absoluteInput)

  const candidates = []

  async function tryPush(row, sourceFile, index) {
    if (!row || typeof row !== 'object') return

    if (!matchesTags(row, requiredTags, tagMode)) return

    const hasIssue = String(row?.[issueColumn] || '').trim().length > 0
    if (mode === 'recheck' && !hasIssue) return

    if (!row.quizQuestion && !row.correctAnswer) return

    candidates.push({
      fact: row,
      sourceFile,
      sourceIndex: index,
    })
  }

  async function loadJsonlFile(filePath) {
    const text = await fs.readFile(filePath, 'utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim()
      if (!line) continue
      let parsed = null
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }
      // eslint-disable-next-line no-await-in-loop
      await tryPush(parsed, path.relative(root, filePath), i)
      if (cap > 0 && candidates.length >= cap) return true
    }
    return false
  }

  async function loadJsonFile(filePath) {
    let parsed = null
    try {
      parsed = JSON.parse(await fs.readFile(filePath, 'utf8'))
    } catch {
      return false
    }

    const rows = extractRowsFromParsed(parsed)
    for (let i = 0; i < rows.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await tryPush(rows[i], path.relative(root, filePath), i)
      if (cap > 0 && candidates.length >= cap) return true
    }
    return false
  }

  if (stat.isDirectory()) {
    const names = (await fs.readdir(absoluteInput)).sort((a, b) => a.localeCompare(b))
    for (const name of names) {
      const filePath = path.join(absoluteInput, name)
      const innerStat = await fs.stat(filePath)
      if (!innerStat.isFile()) continue
      if (name.endsWith('.jsonl')) {
        // eslint-disable-next-line no-await-in-loop
        const done = await loadJsonlFile(filePath)
        if (done) break
      } else if (name.endsWith('.json')) {
        // eslint-disable-next-line no-await-in-loop
        const done = await loadJsonFile(filePath)
        if (done) break
      }
    }
  } else if (absoluteInput.endsWith('.jsonl')) {
    await loadJsonlFile(absoluteInput)
  } else if (absoluteInput.endsWith('.json')) {
    await loadJsonFile(absoluteInput)
  } else {
    throw new Error(`unsupported input path type: ${inputPath}`)
  }

  return candidates
}

async function loadReviewedIssuesById(reviewedPath, issueColumn) {
  const text = await fs.readFile(reviewedPath, 'utf8')
  const lines = text.split(/\r?\n/)
  const byId = new Map()
  let rowCount = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    let row = null
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    rowCount += 1
    const id = String(row?.id || '').trim()
    if (!id) continue
    byId.set(id, String(row?.[issueColumn] || '').trim())
  }

  return { byId, rowCount }
}

async function writeJsonl(filePath, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const text = rows.map((row) => JSON.stringify(row)).join('\n')
  await fs.writeFile(filePath, `${text}\n`, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated/worker-output',
    'output-dir': 'data/generated/qa-reports/answer-check',
    report: 'data/generated/qa-reports/answer-check-worker-batches.json',
    workers: DEFAULT_WORKERS.map((worker) => worker.name).join(','),
    'per-worker': 50,
    tags: '',
    'tag-mode': 'any',
    'issue-column': 'answerCheckIssue',
    mode: 'check',
    'reviewed-dir': '',
    'require-reviewed': false,
    'emit-prompts': true,
    'prompts-dir': '',
    'assignments-dir': '',
  })

  const workers = parseWorkers(args.workers)
  const perWorker = Math.max(1, Number(args['per-worker']) || 50)
  const mode = String(args.mode || 'check').trim().toLowerCase()
  if (!['check', 'recheck'].includes(mode)) {
    throw new Error(`invalid mode: ${mode} (expected check|recheck)`)
  }

  const issueColumn = String(args['issue-column'] || 'answerCheckIssue').trim()
  const requiredTags = parseCsv(args.tags).map((tag) => tag.toLowerCase())
  const tagMode = String(args['tag-mode'] || 'any').trim().toLowerCase() === 'all' ? 'all' : 'any'
  const reviewedDir = String(args['reviewed-dir'] || '').trim()
  const requireReviewed = parseBool(args['require-reviewed'], false)
  const emitPrompts = parseBool(args['emit-prompts'], true)

  const outputDir = path.resolve(root, String(args['output-dir']))
  const promptsDir = path.resolve(root, String(args['prompts-dir'] || path.join(String(args['output-dir']), 'prompts')))
  const assignmentsDir = path.resolve(root, String(args['assignments-dir'] || path.join(String(args['output-dir']), 'assignments')))
  const reportPath = path.resolve(root, String(args.report))

  const totalTarget = workers.length * perWorker
  const candidates = await loadCandidates(
    String(args.input),
    issueColumn,
    mode,
    requiredTags,
    tagMode,
    totalTarget,
  )

  const report = {
    generatedAt: new Date().toISOString(),
    input: String(args.input),
    outputDir: String(args['output-dir']),
    mode,
    issueColumn,
    perWorker,
    requiredTags,
    tagMode,
    reviewedDir: reviewedDir || null,
    requireReviewed,
    totalCandidates: candidates.length,
    totalTarget,
    pass: true,
    workers: [],
    totals: {
      assigned: 0,
      flagged: 0,
      cleared: 0,
      reviewedApplied: 0,
      heuristicApplied: 0,
      missingReviewedWorkers: 0,
    },
  }

  for (let workerIndex = 0; workerIndex < workers.length; workerIndex += 1) {
    const worker = workers[workerIndex]
    const start = workerIndex * perWorker
    const batch = candidates.slice(start, start + perWorker)

    const workerFile = `${sanitizeWorkerFileName(worker.name)}.jsonl`
    const assignmentPath = path.join(assignmentsDir, workerFile)
    const reviewedPath = reviewedDir
      ? path.resolve(root, reviewedDir, workerFile)
      : path.join(outputDir, 'reviewed', workerFile)
    const promptPath = path.join(promptsDir, `${sanitizeWorkerFileName(worker.name)}.md`)

    const workerSummary = {
      worker: worker.name,
      modelLabel: worker.modelLabel,
      requested: perWorker,
      assigned: batch.length,
      assignmentPath: path.relative(root, assignmentPath),
      promptPath: emitPrompts ? path.relative(root, promptPath) : null,
      reviewedPath: path.relative(root, reviewedPath),
      outputPath: null,
      reviewSource: 'heuristic',
      reviewedFileFound: false,
      reviewedRows: 0,
      pass: true,
      flagged: 0,
      cleared: 0,
      sampleIssues: [],
      notes: [],
    }

    if (batch.length === 0) {
      report.workers.push(workerSummary)
      continue
    }

    const assignmentRows = batch.map((entry) => ({
      ...entry.fact,
      [issueColumn]: String(entry.fact?.[issueColumn] || ''),
    }))

    // eslint-disable-next-line no-await-in-loop
    await writeJsonl(assignmentPath, assignmentRows)

    if (emitPrompts) {
      const promptText = buildWorkerPrompt({
        workerName: worker.name,
        modelLabel: worker.modelLabel,
        issueColumn,
        assignmentPath: path.relative(root, assignmentPath),
        reviewedPath: path.relative(root, reviewedPath),
      })
      // eslint-disable-next-line no-await-in-loop
      await fs.mkdir(path.dirname(promptPath), { recursive: true })
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(promptPath, `${promptText}\n`, 'utf8')
    }

    let reviewedById = null
    try {
      // eslint-disable-next-line no-await-in-loop
      const reviewed = await loadReviewedIssuesById(reviewedPath, issueColumn)
      reviewedById = reviewed.byId
      workerSummary.reviewedRows = reviewed.rowCount
      workerSummary.reviewedFileFound = true
      workerSummary.reviewSource = 'worker-reviewed'
      report.totals.reviewedApplied += batch.length
    } catch {
      if (requireReviewed) {
        workerSummary.pass = false
        workerSummary.notes.push('missing reviewed file while require-reviewed=true')
        report.pass = false
        report.totals.missingReviewedWorkers += 1
      } else {
        report.totals.heuristicApplied += batch.length
      }
    }

    const outputRows = []
    for (const entry of batch) {
      const previousIssue = String(entry.fact?.[issueColumn] || '').trim()

      let issueText = ''
      if (reviewedById && entry.fact?.id != null) {
        issueText = String(reviewedById.get(String(entry.fact.id)) || '').trim()
      } else {
        issueText = baseHeuristicIssues(entry.fact).join(' | ')
      }

      if (issueText) {
        workerSummary.flagged += 1
        if (workerSummary.sampleIssues.length < 5) {
          workerSummary.sampleIssues.push({
            id: entry.fact?.id || null,
            issue: issueText,
          })
        }
      } else if (mode === 'recheck' && previousIssue) {
        workerSummary.cleared += 1
      }

      outputRows.push({
        ...entry.fact,
        [issueColumn]: issueText,
      })
    }

    const outputPath = path.join(outputDir, workerFile)
    // eslint-disable-next-line no-await-in-loop
    await writeJsonl(outputPath, outputRows)
    workerSummary.outputPath = path.relative(root, outputPath)

    report.totals.assigned += batch.length
    report.totals.flagged += workerSummary.flagged
    report.totals.cleared += workerSummary.cleared
    report.workers.push(workerSummary)
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({
    ok: report.pass,
    reportPath: path.relative(root, reportPath),
    totals: report.totals,
  }, null, 2))

  if (!report.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[answer-check-worker-batches] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
