#!/usr/bin/env node
import fs from 'node:fs/promises'
import fssync from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs, writeJson, normalizeText, isPlaceholderDistractor, parseDistractorsColumn } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')
const require = createRequire(import.meta.url)

const VALID_COMMANDS = new Set(['assign', 'check', 'export-flagged', 'apply-fixes', 'preview', 'help'])

function parseCli(argv) {
  const token = argv[2]
  const command = token && !token.startsWith('--') ? token : 'help'
  const optionStart = token && !token.startsWith('--') ? 3 : 2
  const optionArgv = [argv[0], argv[1], ...argv.slice(optionStart)]
  const args = parseArgs(optionArgv, {})
  return { command, args }
}

function rel(filePath) {
  return path.relative(root, filePath) || '.'
}

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

function parseTagsJson(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(String(value))
    if (!Array.isArray(parsed)) return []
    return parsed.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
  } catch {
    return []
  }
}

function rowMatchesTags(row, requiredTags, tagMode) {
  if (requiredTags.length === 0) return true
  const tags = parseTagsJson(row.tags)
  if (tags.length === 0) return false
  const set = new Set(tags)
  if (tagMode === 'all') return requiredTags.every((tag) => set.has(tag))
  return requiredTags.some((tag) => set.has(tag))
}

export function baseHeuristicIssues(row) {
  const issues = []
  const question = String(row?.quiz_question || row?.quizQuestion || '').trim()
  const answer = String(row?.correct_answer || row?.correctAnswer || '').trim()
  const type = String(row?.type || '').trim().toLowerCase()
  const language = String(row?.language || '').trim().toLowerCase()
  const qLower = question.toLowerCase()

  if (!question) issues.push('missing question')
  if (!answer) issues.push('missing answer')
  if (question.endsWith('...')) issues.push('truncated question')
  if (answer.endsWith('...')) issues.push('truncated answer')

  if (question === 'What does this mean?') {
    issues.push('vague vocab question')
  }

  if (type === 'vocabulary' && /^what is the [a-z][a-z\s-]{1,24} word for\b/i.test(question)) {
    issues.push('templated vocab prompt')
  }

  if (type === 'vocabulary' && language && /^what does .+ mean\??$/i.test(question)) {
    issues.push('low-context vocab prompt')
  }

  if (/^fill in the blank[:\s]/i.test(question)) {
    const promptBody = question.replace(/^fill in the blank[:\s]*/i, '').trim()
    const bodyWordCount = promptBody.split(/\s+/).filter(Boolean).length
    if (bodyWordCount < 6 || /_{3,}/.test(promptBody) && bodyWordCount < 10) {
      issues.push('low-context cloze prompt')
    }
  }

  if (type && type !== 'vocabulary' && question && question.length < 20) {
    issues.push('question too short')
  }

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

  // Distractor quality checks
  const distractorIssues = distractorHeuristicIssues(row)
  issues.push(...distractorIssues)

  return [...new Set(issues)]
}

export function distractorHeuristicIssues(row) {
  const issues = []
  const distractors = parseDistractorsColumn(row.distractors)
  const answer = String(row?.correct_answer || row?.correctAnswer || '').trim()
  const question = String(row?.quiz_question || row?.quizQuestion || '').trim()
  const qLower = question.toLowerCase()

  if (distractors.length === 0) {
    issues.push('no distractors')
    return issues
  }

  // Check for placeholder distractors
  const placeholders = distractors.filter(d => isPlaceholderDistractor(d))
  if (placeholders.length > 0) {
    issues.push(`${placeholders.length} placeholder distractors`)
  }

  // Check real distractor count after removing placeholders
  const realDistractors = distractors.filter(d => !isPlaceholderDistractor(d))
  if (realDistractors.length < 3) {
    issues.push(`only ${realDistractors.length} real distractors (need 3+)`)
  }

  // Check for duplicates (normalized)
  const normalized = realDistractors.map(d => normalizeText(d))
  const uniqueCount = new Set(normalized).size
  if (uniqueCount < normalized.length) {
    issues.push(`${normalized.length - uniqueCount} duplicate distractors`)
  }

  // Check if any distractor matches the correct answer
  const answerNorm = normalizeText(answer)
  if (answerNorm && normalized.some(d => d === answerNorm)) {
    issues.push('distractor identical to correct answer')
  }

  // Check for very short distractors
  const tooShort = realDistractors.filter(d => d.trim().length <= 1)
  if (tooShort.length > 0) {
    issues.push(`${tooShort.length} empty/single-char distractors`)
  }

  const answerLength = answer.trim().length
  const distractorLengths = realDistractors
    .map((entry) => entry.trim().length)
    .filter((length) => length > 0)
  const lengthPool = answerLength > 0 ? [answerLength, ...distractorLengths] : distractorLengths
  if (lengthPool.length >= 3) {
    const minLen = Math.min(...lengthPool)
    const maxLen = Math.max(...lengthPool)
    const ratio = minLen > 0 ? maxLen / minLen : Number.POSITIVE_INFINITY
    const delta = maxLen - minLen
    if (ratio >= 3.5 && delta >= 18) {
      issues.push('severe distractor length spread')
    }
  }

  // Semantic mismatch: question asks for "common name" but distractors are Latin binomials
  if (/\b(common name|which common|what common)\b/i.test(qLower)) {
    const latinBinomials = realDistractors.filter(d => /^[A-Z][a-z]+ [a-z]+$/.test(d.trim()))
    if (latinBinomials.length > 0) {
      issues.push(`${latinBinomials.length} scientific-name distractors for common-name question`)
    }
  }

  // Check variant distractors too
  if (row.variants) {
    try {
      const variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants
      if (Array.isArray(variants)) {
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i]
          if (!v?.distractors || !Array.isArray(v.distractors)) continue
          const vDistractors = v.distractors.map(d => typeof d === 'string' ? d : String(d?.text ?? d ?? '')).filter(Boolean)
          const vPlaceholders = vDistractors.filter(d => isPlaceholderDistractor(d))
          if (vPlaceholders.length > 0) {
            issues.push(`variant[${i}]: ${vPlaceholders.length} placeholder distractors`)
          }
        }
      }
    } catch { /* ignore parse errors */ }
  }

  return [...new Set(issues)]
}

function loadBetterSqlite() {
  try {
    return require('better-sqlite3')
  } catch {
    return require(path.resolve(root, 'server/node_modules/better-sqlite3'))
  }
}

function ensureAnswerCheckColumns(db) {
  const columns = db.prepare('PRAGMA table_info(facts)').all()
  const names = new Set(columns.map((entry) => String(entry.name)))

  const needed = [
    ['answer_check_issue', "TEXT NOT NULL DEFAULT ''"],
    ['answer_check_needs_fix', 'INTEGER NOT NULL DEFAULT 0'],
    ['answer_check_checked_at', 'INTEGER'],
    ['answer_check_checked_by', 'TEXT'],
    ['answer_check_fixed_at', 'INTEGER'],
    ['answer_check_fixed_by', 'TEXT'],
  ]

  for (const [name, ddl] of needed) {
    if (names.has(name)) continue
    db.exec(`ALTER TABLE facts ADD COLUMN ${name} ${ddl}`)
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_facts_answer_check_needs_fix ON facts(answer_check_needs_fix)')

  const columnsAfter = db.prepare('PRAGMA table_info(facts)').all()
  return new Set(columnsAfter.map((entry) => String(entry.name)))
}

function rowToAssignment(row) {
  return {
    id: row.id,
    type: row.type,
    language: row.language,
    statement: row.statement,
    quizQuestion: row.quiz_question,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    distractors: parseDistractorsColumn(row.distractors),
    variants: row.variants ? (() => { try { return JSON.parse(String(row.variants)) } catch { return [] } })() : [],
    tags: parseTagsJson(row.tags),
    answerCheckIssue: String(row.answer_check_issue || ''),
  }
}

async function loadJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

async function writeJsonl(filePath, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const text = rows.map((row) => JSON.stringify(row)).join('\n')
  await fs.writeFile(filePath, `${text}\n`, 'utf8')
}

function selectFacts(db, { status, limit, offset }) {
  if (status) {
    return db
      .prepare(`
        SELECT id, statement, quiz_question, correct_answer, explanation, tags,
               type, language,
               distractors, variants,
               answer_check_issue, answer_check_needs_fix
        FROM facts
        WHERE status = ?
        ORDER BY id
        LIMIT ? OFFSET ?
      `)
      .all(status, limit, offset)
  }

  return db
    .prepare(`
      SELECT id, statement, quiz_question, correct_answer, explanation, tags,
             type, language,
             distractors, variants,
             answer_check_issue, answer_check_needs_fix
      FROM facts
      ORDER BY id
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset)
}

function selectFlaggedFacts(db, { status, limit, offset }) {
  if (status) {
    return db
      .prepare(`
        SELECT id, statement, quiz_question, correct_answer, explanation, tags,
               type, language,
               distractors, variants,
               answer_check_issue, answer_check_needs_fix, answer_check_checked_at
        FROM facts
        WHERE answer_check_needs_fix = 1 AND status = ?
        ORDER BY COALESCE(answer_check_checked_at, 0) DESC, id
        LIMIT ? OFFSET ?
      `)
      .all(status, limit, offset)
  }

  return db
    .prepare(`
      SELECT id, statement, quiz_question, correct_answer, explanation, tags,
             type, language,
             distractors, variants,
             answer_check_issue, answer_check_needs_fix, answer_check_checked_at
      FROM facts
      WHERE answer_check_needs_fix = 1
      ORDER BY COALESCE(answer_check_checked_at, 0) DESC, id
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset)
}

async function cmdAssign(rawArgs) {
  const args = {
    db: 'public/facts.db',
    status: 'approved',
    limit: 500,
    offset: 0,
    tags: '',
    'tag-mode': 'any',
    output: 'data/generated/qa-reports/answer-check-live-db/assignments.jsonl',
    report: 'data/generated/qa-reports/answer-check-live-db/assign-report.json',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const outputPath = path.resolve(root, String(args.output))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 500)
  const offset = Math.max(0, Number(args.offset) || 0)
  const requiredTags = parseCsv(args.tags).map((tag) => tag.toLowerCase())
  const tagMode = String(args['tag-mode'] || 'any').trim().toLowerCase() === 'all' ? 'all' : 'any'

  const db = new Database(dbPath)
  ensureAnswerCheckColumns(db)
  const rows = selectFacts(db, { status: status || null, limit, offset })
  db.close()

  const filtered = rows.filter((row) => rowMatchesTags(row, requiredTags, tagMode))
  const assignments = filtered.map(rowToAssignment)
  await writeJsonl(outputPath, assignments)

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'assign',
    dbPath: rel(dbPath),
    status: status || null,
    limit,
    offset,
    requiredTags,
    tagMode,
    selectedRows: assignments.length,
    outputPath: rel(outputPath),
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), selectedRows: assignments.length }, null, 2))
}

async function cmdCheck(rawArgs) {
  const args = {
    db: 'public/facts.db',
    checker: 'gpt-5.1-mini',
    status: 'approved',
    limit: 500,
    offset: 0,
    tags: '',
    'tag-mode': 'any',
    input: '',
    'reviewed-file': '',
    'dry-run': false,
    report: 'data/generated/qa-reports/answer-check-live-db/check-report.json',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 500)
  const offset = Math.max(0, Number(args.offset) || 0)
  const checker = String(args.checker || 'gpt-5.1-mini').trim()
  const requiredTags = parseCsv(args.tags).map((tag) => tag.toLowerCase())
  const tagMode = String(args['tag-mode'] || 'any').trim().toLowerCase() === 'all' ? 'all' : 'any'
  const inputPath = String(args.input || '').trim()
  const reviewedFile = String(args['reviewed-file'] || '').trim()
  const dryRun = parseBool(args['dry-run'], false)

  let candidates = []
  if (inputPath) {
    const parsed = await loadJsonl(path.resolve(root, inputPath))
    candidates = parsed.map((row) => ({
      id: row.id,
      statement: row.statement,
      quiz_question: row.quizQuestion || row.quiz_question || '',
      correct_answer: row.correctAnswer || row.correct_answer || '',
      explanation: row.explanation || '',
      tags: Array.isArray(row.tags) ? JSON.stringify(row.tags) : null,
      answer_check_issue: row.answerCheckIssue || row.answer_check_issue || '',
    }))
  } else {
    const dbRead = new Database(dbPath)
    const columns = ensureAnswerCheckColumns(dbRead)
    const rows = selectFacts(dbRead, { status: status || null, limit, offset })
    dbRead.close()
    candidates = rows.filter((row) => rowMatchesTags(row, requiredTags, tagMode))
    if (!columns.has('answer_check_issue')) {
      throw new Error('answer_check_issue column missing after ensure step')
    }
  }

  const reviewedById = new Map()
  if (reviewedFile) {
    const reviewedRows = await loadJsonl(path.resolve(root, reviewedFile))
    for (const row of reviewedRows) {
      const id = String(row?.id || '').trim()
      if (!id) continue
      const issue = String(row?.answerCheckIssue ?? row?.answer_check_issue ?? '').trim()
      reviewedById.set(id, issue)
    }
  }

  const now = Date.now()
  const updates = []
  let flagged = 0
  for (const row of candidates) {
    const id = String(row.id || '').trim()
    if (!id) continue

    const issue = reviewedById.has(id)
      ? String(reviewedById.get(id) || '')
      : baseHeuristicIssues(row).join(' | ')

    if (issue) flagged += 1
    updates.push({
      id,
      issue,
      needsFix: issue ? 1 : 0,
      checkedAt: now,
      checkedBy: checker,
    })
  }

  if (!dryRun && updates.length > 0) {
    const db = new Database(dbPath)
    const columnSet = ensureAnswerCheckColumns(db)
    const setParts = [
      'answer_check_issue = @issue',
      'answer_check_needs_fix = @needsFix',
      'answer_check_checked_at = @checkedAt',
      'answer_check_checked_by = @checkedBy',
    ]
    if (columnSet.has('updated_at')) {
      setParts.push('updated_at = @checkedAt')
    }

    const stmt = db.prepare(`UPDATE facts SET ${setParts.join(', ')} WHERE id = @id`)
    const tx = db.transaction((rows) => {
      for (const row of rows) stmt.run(row)
    })
    tx(updates)
    db.close()
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'check',
    dbPath: rel(dbPath),
    checker,
    dryRun,
    fromInput: inputPath ? rel(path.resolve(root, inputPath)) : null,
    reviewedFile: reviewedFile ? rel(path.resolve(root, reviewedFile)) : null,
    status: status || null,
    limit,
    offset,
    requiredTags,
    tagMode,
    counts: {
      scanned: updates.length,
      flagged,
      clear: Math.max(0, updates.length - flagged),
      reviewedOverrides: reviewedById.size,
    },
    sampleFlagged: updates.filter((row) => row.issue).slice(0, 10),
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), counts: report.counts }, null, 2))
}

async function cmdExportFlagged(rawArgs) {
  const args = {
    db: 'public/facts.db',
    status: 'approved',
    limit: 500,
    offset: 0,
    tags: '',
    'tag-mode': 'any',
    output: 'data/generated/qa-reports/answer-check-live-db/flagged.jsonl',
    report: 'data/generated/qa-reports/answer-check-live-db/export-flagged-report.json',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const outputPath = path.resolve(root, String(args.output))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 500)
  const offset = Math.max(0, Number(args.offset) || 0)
  const requiredTags = parseCsv(args.tags).map((tag) => tag.toLowerCase())
  const tagMode = String(args['tag-mode'] || 'any').trim().toLowerCase() === 'all' ? 'all' : 'any'

  const db = new Database(dbPath)
  ensureAnswerCheckColumns(db)
  const rows = selectFlaggedFacts(db, { status: status || null, limit, offset })
  db.close()

  const filtered = rows.filter((row) => rowMatchesTags(row, requiredTags, tagMode))
  const outputRows = filtered.map((row) => ({
    id: row.id,
    type: row.type,
    language: row.language,
    statement: row.statement,
    quizQuestion: row.quiz_question,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    distractors: parseDistractorsColumn(row.distractors),
    variants: row.variants ? (() => { try { return JSON.parse(String(row.variants)) } catch { return [] } })() : [],
    tags: parseTagsJson(row.tags),
    answerCheckIssue: String(row.answer_check_issue || ''),
  }))

  await writeJsonl(outputPath, outputRows)

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'export-flagged',
    dbPath: rel(dbPath),
    status: status || null,
    limit,
    offset,
    requiredTags,
    tagMode,
    exported: outputRows.length,
    outputPath: rel(outputPath),
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), exported: outputRows.length }, null, 2))
}

async function cmdApplyFixes(rawArgs) {
  const args = {
    db: 'public/facts.db',
    input: '',
    fixer: 'haiku-worker',
    'dry-run': false,
    report: 'data/generated/qa-reports/answer-check-live-db/apply-fixes-report.json',
    ...rawArgs,
  }

  const inputPath = String(args.input || '').trim()
  if (!inputPath) {
    throw new Error('--input is required for apply-fixes')
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const reportPath = path.resolve(root, String(args.report))
  const fixer = String(args.fixer || 'haiku-worker').trim()
  const dryRun = parseBool(args['dry-run'], false)
  const rows = await loadJsonl(path.resolve(root, inputPath))

  const db = new Database(dbPath)
  const columnSet = ensureAnswerCheckColumns(db)
  const now = Date.now()

  const selectStmt = db.prepare('SELECT id, statement, quiz_question, correct_answer, explanation, distractors, variants FROM facts WHERE id = ?')
  const setParts = [
    'statement = @statement',
    'quiz_question = @quizQuestion',
    'correct_answer = @correctAnswer',
    'explanation = @explanation',
    'distractors = @distractors',
    'variants = @variants',
    'answer_check_issue = @issue',
    'answer_check_needs_fix = @needsFix',
    'answer_check_checked_at = @checkedAt',
    'answer_check_checked_by = @checkedBy',
    'answer_check_fixed_at = @fixedAt',
    'answer_check_fixed_by = @fixedBy',
  ]
  if (columnSet.has('updated_at')) {
    setParts.push('updated_at = @checkedAt')
  }
  const updateStmt = db.prepare(`UPDATE facts SET ${setParts.join(', ')} WHERE id = @id`)

  const updates = []
  let missing = 0
  let keptFlagged = 0
  let cleared = 0

  for (const row of rows) {
    const id = String(row?.id || '').trim()
    if (!id) continue

    const current = selectStmt.get(id)
    if (!current) {
      missing += 1
      continue
    }

    const issue = String(row?.answerCheckIssue ?? row?.answer_check_issue ?? '').trim()
    const needsFix = issue ? 1 : 0
    if (needsFix) keptFlagged += 1
    else cleared += 1

    const statement = String(row?.statement ?? current.statement ?? '')
    const quizQuestion = String(row?.quizQuestion ?? row?.quiz_question ?? current.quiz_question ?? '')
    const correctAnswer = String(row?.correctAnswer ?? row?.correct_answer ?? current.correct_answer ?? '')
    const explanation = String(row?.explanation ?? current.explanation ?? '')
    const distractors = row?.distractors != null
      ? (typeof row.distractors === 'string' ? row.distractors : JSON.stringify(row.distractors))
      : (current.distractors ?? '[]')
    const variants = row?.variants != null
      ? (typeof row.variants === 'string' ? row.variants : JSON.stringify(row.variants))
      : (current.variants ?? '[]')

    updates.push({
      id,
      statement,
      quizQuestion,
      correctAnswer,
      explanation,
      distractors,
      variants,
      issue,
      needsFix,
      checkedAt: now,
      checkedBy: fixer,
      fixedAt: needsFix ? null : now,
      fixedBy: needsFix ? null : fixer,
    })
  }

  if (!dryRun && updates.length > 0) {
    const tx = db.transaction((batch) => {
      for (const row of batch) updateStmt.run(row)
    })
    tx(updates)
  }

  db.close()

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'apply-fixes',
    dbPath: rel(dbPath),
    inputPath: rel(path.resolve(root, inputPath)),
    fixer,
    dryRun,
    counts: {
      inputRows: rows.length,
      updated: updates.length,
      missing,
      cleared,
      keptFlagged,
    },
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), counts: report.counts }, null, 2))
}

async function cmdPreview(rawArgs) {
  const args = {
    db: 'public/facts.db',
    status: 'approved',
    limit: 20,
    offset: 0,
    tags: '',
    'tag-mode': 'any',
    'option-count': 3,
    'flagged-only': false,
    output: '',
    report: 'data/generated/qa-reports/answer-check-live-db/preview-report.json',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 20)
  const offset = Math.max(0, Number(args.offset) || 0)
  const optionCount = Math.max(2, Number(args['option-count']) || 3)
  const flaggedOnly = parseBool(args['flagged-only'], false)
  const requiredTags = parseCsv(args.tags).map(tag => tag.toLowerCase())
  const tagMode = String(args['tag-mode'] || 'any').trim().toLowerCase() === 'all' ? 'all' : 'any'
  const outputPath = String(args.output || '').trim()

  const db = new Database(dbPath)
  ensureAnswerCheckColumns(db)
  const rows = flaggedOnly
    ? selectFlaggedFacts(db, { status: status || null, limit, offset })
    : selectFacts(db, { status: status || null, limit, offset })
  db.close()

  const filtered = rows.filter(row => rowMatchesTags(row, requiredTags, tagMode))
  const lines = []
  let issueCount = 0

  for (const row of filtered) {
    const question = String(row.quiz_question || '').trim()
    const correctAnswer = String(row.correct_answer || '').trim()
    const distractors = parseDistractorsColumn(row.distractors)
    const issues = baseHeuristicIssues(row)

    lines.push(`### ${row.id}`)
    lines.push(`**Q:** ${question}`)
    lines.push('')

    // Simulate game display: pick random distractors (excluding placeholders)
    const realDistractors = distractors.filter(d => d && d !== correctAnswer && !isPlaceholderDistractor(d))
    const shuffledReal = realDistractors.sort(() => Math.random() - 0.5)
    const picked = shuffledReal.slice(0, optionCount - 1)
    const gameAnswers = [...picked]
    gameAnswers.splice(Math.floor(Math.random() * (gameAnswers.length + 1)), 0, correctAnswer)

    lines.push('**As player sees it:**')
    for (let i = 0; i < gameAnswers.length; i++) {
      const marker = gameAnswers[i] === correctAnswer ? ' ✓' : ''
      lines.push(`  ${i + 1}. ${gameAnswers[i]}${marker}`)
    }
    lines.push('')

    // Show full distractor pool
    const placeholderCount = distractors.filter(d => isPlaceholderDistractor(d)).length
    lines.push(`**Distractor pool (${distractors.length} total, ${placeholderCount} bad):**`)
    for (const d of distractors) {
      if (isPlaceholderDistractor(d)) {
        lines.push(`  - ~~${d}~~ PLACEHOLDER`)
      } else {
        lines.push(`  - ${d}`)
      }
    }
    lines.push('')

    if (issues.length > 0) {
      issueCount++
      lines.push(`**Issues:** ${issues.join(' | ')}`)
    } else {
      lines.push('**Issues:** none')
    }

    lines.push('')
    lines.push('---')
    lines.push('')
  }

  const markdown = lines.join('\n')

  if (outputPath) {
    const fullOutputPath = path.resolve(root, outputPath)
    await fs.mkdir(path.dirname(fullOutputPath), { recursive: true })
    await fs.writeFile(fullOutputPath, markdown, 'utf8')
  } else {
    console.log(markdown)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'preview',
    dbPath: rel(dbPath),
    status: status || null,
    limit,
    offset,
    optionCount,
    flaggedOnly,
    counts: {
      displayed: filtered.length,
      withIssues: issueCount,
    },
  }

  await writeJson(reportPath, report)
  if (outputPath) {
    console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), displayed: filtered.length, withIssues: issueCount, outputPath: rel(path.resolve(root, outputPath)) }, null, 2))
  }
}

function printHelp() {
  console.log([
    'Usage:',
    '  node scripts/content-pipeline/qa/answer-check-live-db.mjs <command> [options]',
    '',
    'Commands:',
    '  assign         Select DB facts and write worker assignment JSONL',
    '  check          Evaluate rows and write answer_check_* flags into DB',
    '  export-flagged Export currently flagged DB rows for worker fixing',
    '  apply-fixes    Apply worker-reviewed fixes back into DB and clear/set flags',
    '  preview        Display facts as the player would see them (question + answers)',
    '',
    'Examples:',
    '  npm run content:qa:answer-check:db -- check --db public/facts.db --checker gpt-5.1-mini --limit 500',
    '  npm run content:qa:answer-check:db -- export-flagged --db public/facts.db --output data/generated/qa-reports/answer-check-live-db/flagged.jsonl',
    '  npm run content:qa:answer-check:db -- apply-fixes --db public/facts.db --input data/generated/qa-reports/answer-check-live-db/reviewed/flagged-fixed.jsonl --fixer haiku-1',
    '  npm run content:qa:answer-check:db -- preview --db public/facts.db --limit 20',
    '  npm run content:qa:answer-check:db -- preview --db public/facts.db --flagged-only --limit 50',
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
    case 'assign':
      await cmdAssign(args)
      break
    case 'check':
      await cmdCheck(args)
      break
    case 'export-flagged':
      await cmdExportFlagged(args)
      break
    case 'apply-fixes':
      await cmdApplyFixes(args)
      break
    case 'preview':
      await cmdPreview(args)
      break
    case 'help':
    default:
      printHelp()
      break
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error('[answer-check-live-db] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
