#!/usr/bin/env node
/**
 * LLM-first fact quality fixer for the live facts DB.
 *
 * Rules baked into this script:
 * - Never mine distractors from DB pools.
 * - Generate distractors only via GPT-5.2 sub-worker prompts per fact.
 * - Validate generated distractors against blocklists and collisions.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  parseArgs,
  normalizeText,
  parseDistractorsColumn,
  isBadDistractor,
} from './shared.mjs'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')
const VALID_COMMANDS = new Set([
  'distractors',
  'vague-vocab',
  'rewrite-questions',
  'rewrite-answers',
  'run-all',
  'help',
])

function parseCli(argv) {
  const token = argv[2]
  const command = token && !token.startsWith('--') ? token : 'help'
  const optionStart = token && !token.startsWith('--') ? 3 : 2
  const optionArgv = [argv[0], argv[1], ...argv.slice(optionStart)]
  const args = parseArgs(optionArgv, {})
  return { command, args }
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false
  return fallback
}

function rel(filePath) {
  return path.relative(root, filePath) || '.'
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
}

function getColumnSet(db) {
  return new Set(db.prepare('PRAGMA table_info(facts)').all().map((entry) => String(entry.name)))
}

function hasAnswerCheckColumns(db) {
  const cols = getColumnSet(db)
  return cols.has('answer_check_issue') && cols.has('answer_check_needs_fix')
}

async function ensureDir(fileOrDirPath, asFile = true) {
  const target = asFile ? path.dirname(fileOrDirPath) : fileOrDirPath
  await fs.mkdir(target, { recursive: true })
}

function extractJsonPayload(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      // continue
    }
  }

  try {
    return JSON.parse(raw)
  } catch {
    // continue
  }

  const firstBracket = raw.indexOf('[')
  const lastBracket = raw.lastIndexOf(']')
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try {
      return JSON.parse(raw.slice(firstBracket, lastBracket + 1))
    } catch {
      // continue
    }
  }

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1))
    } catch {
      return null
    }
  }

  return null
}

function cleanTextResponse(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return ''
  const fence = raw.match(/```(?:text)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1].trim() : raw
  const stripped = body
    .replace(/^["'`]/, '')
    .replace(/["'`]$/, '')
    .trim()
  const firstLine = stripped.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || ''
  return firstLine.replace(/\s+/g, ' ').trim()
}

function languageLabel(code) {
  const map = {
    es: 'Spanish',
    de: 'German',
    fr: 'French',
    it: 'Italian',
    pt: 'Portuguese',
    ja: 'Japanese',
    ko: 'Korean',
    nl: 'Dutch',
  }
  return map[String(code || '').trim().toLowerCase()] || 'the source language'
}

async function runCodexPrompt({
  prompt,
  model = 'gpt-5.2',
  timeoutMs = 240000,
  retries = 2,
  retryBackoffMs = 800,
}) {
  let lastError = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const outPath = path.join(
      os.tmpdir(),
      `codex-llm-fix-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
    )
    try {
      await ensureDir(outPath, true)
      await execFileAsync(
        'codex',
        [
          'exec',
          '-m',
          model,
          '-s',
          'read-only',
          '--skip-git-repo-check',
          '--color',
          'never',
          '-o',
          outPath,
          prompt,
        ],
        {
          cwd: root,
          env: process.env,
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 20,
        },
      )
      const text = await fs.readFile(outPath, 'utf8')
      await fs.rm(outPath, { force: true })
      return text.trim()
    } catch (error) {
      await fs.rm(outPath, { force: true }).catch(() => {})
      lastError = error
      if (attempt < retries) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, retryBackoffMs * attempt))
        continue
      }
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : String(lastError))
}

function tokenCountApprox(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

function matchesShape(answer, candidate) {
  const a = String(answer || '').trim()
  const c = String(candidate || '').trim()
  if (!a || !c) return false

  const aIsYear = /^\d{4}$/.test(a)
  if (aIsYear) return /^\d{4}$/.test(c)

  const aIsNumber = /^-?\d+(?:\.\d+)?$/.test(a)
  if (aIsNumber) return /^-?\d+(?:\.\d+)?$/.test(c)

  const aHasPercent = a.includes('%')
  if (aHasPercent) return c.includes('%')

  const aTokens = tokenCountApprox(a)
  const cTokens = tokenCountApprox(c)
  if (aTokens <= 2 && cTokens > 5) return false
  if (aTokens >= 5 && cTokens <= 1) return false
  return true
}

function normalizeStringList(items) {
  const out = []
  const seen = new Set()
  for (const item of items || []) {
    const text = String(item ?? '').trim()
    if (!text) continue
    const norm = normalizeText(text)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    out.push(text)
  }
  return out
}

function parseWordFromStatement(statement) {
  const text = String(statement || '').trim()
  if (!text) return ''
  const quoted = text.match(/"([^"]+)"/)
  if (quoted?.[1]) return quoted[1].trim()
  const singleQuoted = text.match(/'([^']+)'/)
  if (singleQuoted?.[1]) return singleQuoted[1].trim()
  return text.replace(/\s+means\s+something\s+in\s+.*/i, '').trim()
}

function buildDistractorPrompt(fact, keepDistractors = [], rejected = []) {
  const keepBlock = keepDistractors.length > 0
    ? `Already-approved distractors to keep (do not repeat): ${JSON.stringify(keepDistractors)}`
    : 'Already-approved distractors to keep: []'
  const rejectedBlock = rejected.length > 0
    ? `Previously rejected options (do not repeat): ${JSON.stringify(rejected)}`
    : 'Previously rejected options: []'

  return [
    'You are a quiz question writer for an educational card game.',
    'Generate exactly 5 wrong answers (distractors) for this specific question.',
    '',
    `Domain: ${fact.category_l1 || 'Unknown'} / ${fact.category_l2 || 'Unknown'}`,
    `Question: ${fact.quiz_question || ''}`,
    `Correct answer: ${fact.correct_answer || ''}`,
    `Context statement: ${fact.statement || ''}`,
    `Explanation: ${fact.explanation || ''}`,
    keepBlock,
    rejectedBlock,
    '',
    'Rules:',
    '- Each distractor must be plausible but factually WRONG for this question.',
    '- Match answer format and length (year->years, person->people, place->places, etc).',
    '- Keep distractors semantically close enough that a real learner could pick them.',
    '- All 5 must be distinct from each other and from the correct answer.',
    '- Do not output placeholders or generic filler words.',
    '- Do not output any item from the keep/rejected lists.',
    '',
    'Return ONLY a JSON array of exactly 5 strings.',
  ].join('\n')
}

function buildQuestionRewritePrompt(fact, reason = '') {
  return [
    'Rewrite this quiz question so it is clear, complete, and playable.',
    '',
    `Issue focus: ${reason || 'general quality rewrite'}`,
    `Domain: ${fact.category_l1 || 'Unknown'} / ${fact.category_l2 || 'Unknown'}`,
    `Original question: ${fact.quiz_question || ''}`,
    `Correct answer: ${fact.correct_answer || ''}`,
    `Statement/context: ${fact.statement || ''}`,
    `Explanation: ${fact.explanation || ''}`,
    '',
    'Constraints:',
    '- Keep the same knowledge target.',
    '- Do NOT include the correct answer text verbatim in the question.',
    '- Return one complete grammatical question ending with "?".',
    '- Keep the question concise and natural.',
    '',
    'Return ONLY the rewritten question text.',
  ].join('\n')
}

function buildVocabQuestionPrompt(fact) {
  const lang = languageLabel(fact.language)
  const target = parseWordFromStatement(fact.statement)
  return [
    'Fix this vague vocabulary question into a clear one.',
    '',
    `Language: ${lang}`,
    `Current question: ${fact.quiz_question || ''}`,
    `Statement: ${fact.statement || ''}`,
    `Known target from statement (if present): ${target || '(none)'}`,
    `Correct answer (must stay unchanged): ${fact.correct_answer || ''}`,
    '',
    'Requirements:',
    '- The question must clearly identify what term/meaning is being asked.',
    '- The question must NOT contain the correct answer text verbatim.',
    '- Keep the existing correct answer valid for the new question.',
    '- If the opposite-side term is missing, infer a likely counterpart from world knowledge.',
    '',
    'Return ONLY the rewritten question text.',
  ].join('\n')
}

function buildAnswerRepairPrompt(fact) {
  return [
    'The answer below is missing or truncated. Repair it.',
    '',
    `Question: ${fact.quiz_question || ''}`,
    `Current answer: ${fact.correct_answer || ''}`,
    `Statement/context: ${fact.statement || ''}`,
    `Explanation: ${fact.explanation || ''}`,
    `Domain: ${fact.category_l1 || 'Unknown'} / ${fact.category_l2 || 'Unknown'}`,
    '',
    'Rules:',
    '- Produce one concise corrected answer.',
    '- Keep answer style compatible with the question (year, name, place, etc).',
    '- Do not include commentary.',
    '',
    'Return ONLY the corrected answer text.',
  ].join('\n')
}

function validateGeneratedDistractors({
  generated,
  fact,
  keepDistractors = [],
  globalAnswerSet = new Set(),
  allowGlobalAnswerCollisions = false,
}) {
  const answer = String(fact.correct_answer || '').trim()
  const answerNorm = normalizeText(answer)
  const keepNorm = new Set(normalizeStringList(keepDistractors).map((d) => normalizeText(d)))
  const accepted = []
  const rejected = []
  const seen = new Set()

  for (const raw of generated || []) {
    const text = String(raw ?? '').trim()
    if (!text) {
      rejected.push({ value: text, reason: 'empty' })
      continue
    }
    const norm = normalizeText(text)
    if (!norm) {
      rejected.push({ value: text, reason: 'empty-normalized' })
      continue
    }
    if (seen.has(norm) || keepNorm.has(norm)) {
      rejected.push({ value: text, reason: 'duplicate' })
      continue
    }
    if (norm === answerNorm) {
      rejected.push({ value: text, reason: 'matches-correct-answer' })
      continue
    }
    if (isBadDistractor(text)) {
      rejected.push({ value: text, reason: 'blocklisted' })
      continue
    }
    if (!matchesShape(answer, text)) {
      rejected.push({ value: text, reason: 'shape-mismatch' })
      continue
    }
    if (!allowGlobalAnswerCollisions && globalAnswerSet.has(norm)) {
      rejected.push({ value: text, reason: 'matches-other-fact-answer' })
      continue
    }
    seen.add(norm)
    accepted.push(text)
  }

  return { accepted, rejected }
}

function parseIssues(issueText) {
  return String(issueText || '')
    .split('|')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
}

async function runWithConcurrency(items, concurrency, workerFn) {
  const out = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      // eslint-disable-next-line no-await-in-loop
      out[index] = await workerFn(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker())
  await Promise.all(workers)
  return out
}

function parseModelJsonArray(text) {
  const payload = extractJsonPayload(text)
  if (!Array.isArray(payload)) return []
  return payload.map((entry) => String(entry ?? '').trim()).filter(Boolean)
}

function shouldRefreshDistractors(fact) {
  const issues = parseIssues(fact.answer_check_issue)
  const hasDistractorIssue = issues.some((entry) =>
    entry.includes('no distractors')
    || entry.includes('placeholder distractors')
    || entry.includes('real distractors')
    || entry.includes('duplicate distractors')
    || entry.includes('distractor identical')
    || entry.includes('single-char distractors')
    || entry.includes('scientific-name distractors'))

  const distractors = parseDistractorsColumn(fact.distractors)
  if (distractors.length === 0) return true
  if (hasDistractorIssue) return true

  const question = String(fact.quiz_question || '').trim()
  const commonNameQuestion = /\b(common name|which common|what common)\b/i.test(question)
  const answerNorm = normalizeText(String(fact.correct_answer || ''))
  const unique = new Set()
  let good = 0
  for (const d of distractors) {
    const norm = normalizeText(d)
    if (!norm || norm === answerNorm || isBadDistractor(d) || unique.has(norm) || d.trim().length <= 1) continue
    if (commonNameQuestion && /^[A-Z][a-z]+ [a-z]+$/.test(String(d).trim())) return true
    unique.add(norm)
    good += 1
  }
  return good < 3
}

function questionNeedsRewrite(fact, minLength) {
  const question = String(fact.quiz_question || '').trim()
  const answer = String(fact.correct_answer || '').trim()
  const type = String(fact.type || '').trim().toLowerCase()
  const qNorm = normalizeText(question)
  const aNorm = normalizeText(answer)
  const qLower = question.toLowerCase()

  if (!question) return true
  if (question.endsWith('...')) return true
  if (type && type !== 'vocabulary' && question.length < minLength) return true
  if (aNorm && aNorm.length >= 5 && qNorm.includes(aNorm)) return true

  const numericStyle = /\b(how many|how much|what year|which year)\b/.test(qLower) || /^when\b/.test(qLower)
  if (numericStyle && !/\d/.test(answer) && answer.length > 8) return true

  if (/\b(where|which country|which city|which continent)\b/.test(qLower)) {
    const words = answer.split(/\s+/).filter(Boolean)
    if (words.length > 8) return true
  }

  return false
}

function answerNeedsRepair(fact) {
  const answer = String(fact.correct_answer || '').trim()
  if (!answer) return true
  if (answer.endsWith('...')) return true
  return false
}

async function cmdDistractors(rawArgs) {
  const args = {
    db: 'public/facts.db',
    model: 'gpt-5.2',
    status: 'approved',
    limit: 500,
    offset: 0,
    concurrency: 6,
    fixer: 'gpt-5.2-distractor-gen',
    report: 'data/generated/qa-reports/answer-check-live-db/llm-distractor-fix-report.json',
    'strict-global-answer-collision': true,
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 500)
  const offset = Math.max(0, Number(args.offset) || 0)
  const concurrency = Math.max(1, Number(args.concurrency) || 6)
  const model = String(args.model || 'gpt-5.2').trim()
  const fixer = String(args.fixer || 'gpt-5.2-distractor-gen').trim()
  const strictGlobal = parseBool(args['strict-global-answer-collision'], true)

  const db = new Database(dbPath)
  const hasAnswerCheck = hasAnswerCheckColumns(db)

  const baseSelect = hasAnswerCheck
    ? `
      SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
             distractors, category_l1, category_l2, answer_check_issue
      FROM facts
      WHERE status = @status
      ORDER BY id
      LIMIT @limit OFFSET @offset
    `
    : `
      SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
             distractors, category_l1, category_l2, '' AS answer_check_issue
      FROM facts
      WHERE status = @status
      ORDER BY id
      LIMIT @limit OFFSET @offset
    `
  const candidates = db.prepare(baseSelect).all({ status, limit, offset })

  const toFix = candidates.filter(shouldRefreshDistractors)
  const answerRows = db.prepare("SELECT correct_answer FROM facts WHERE status = 'approved'").all()
  const globalAnswerSet = new Set(answerRows.map((row) => normalizeText(String(row.correct_answer || ''))).filter(Boolean))

  const update = hasAnswerCheck
    ? db.prepare(`
      UPDATE facts SET
        distractors = @distractors,
        answer_check_issue = '',
        answer_check_needs_fix = 0,
        answer_check_checked_at = @now,
        answer_check_checked_by = @fixer,
        answer_check_fixed_at = @now,
        answer_check_fixed_by = @fixer
      WHERE id = @id
    `)
    : db.prepare(`
      UPDATE facts SET
        distractors = @distractors
      WHERE id = @id
    `)

  let fixed = 0
  let failed = 0
  let strictRelaxed = 0
  const failures = []
  const now = Date.now()

  const results = await runWithConcurrency(toFix, concurrency, async (fact, index) => {
    const existing = normalizeStringList(parseDistractorsColumn(fact.distractors))
    const answerNorm = normalizeText(String(fact.correct_answer || ''))
    const existingGood = existing.filter((item) => {
      const norm = normalizeText(item)
      return norm && norm !== answerNorm && !isBadDistractor(item) && item.trim().length > 1
    })

    const preserveGood = existingGood.length > 0 && !parseIssues(fact.answer_check_issue).includes('no distractors')
    let rejected = []
    let best = []
    let usedRelaxed = false

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const prompt = buildDistractorPrompt(fact, preserveGood ? existingGood : [], rejected.map((r) => r.value))
      let response = ''
      try {
        // eslint-disable-next-line no-await-in-loop
        response = await runCodexPrompt({ prompt, model, retries: 2 })
      } catch (error) {
        if (attempt === 3) {
          return {
            ok: false,
            id: fact.id,
            reason: `codex error: ${error instanceof Error ? error.message : String(error)}`,
          }
        }
        // eslint-disable-next-line no-continue
        continue
      }

      const parsed = parseModelJsonArray(response)
      if (parsed.length === 0) {
        if (attempt === 3) {
          return { ok: false, id: fact.id, reason: 'model did not return a JSON array' }
        }
        // eslint-disable-next-line no-continue
        continue
      }

      const strictValidation = validateGeneratedDistractors({
        generated: parsed,
        fact,
        keepDistractors: preserveGood ? existingGood : [],
        globalAnswerSet,
        allowGlobalAnswerCollisions: !strictGlobal,
      })

      rejected = strictValidation.rejected
      best = strictValidation.accepted
      if (best.length >= 5) break

      if (strictGlobal && attempt >= 2) {
        const relaxed = validateGeneratedDistractors({
          generated: parsed,
          fact,
          keepDistractors: preserveGood ? existingGood : [],
          globalAnswerSet,
          allowGlobalAnswerCollisions: true,
        })
        if (relaxed.accepted.length > best.length) {
          best = relaxed.accepted
          usedRelaxed = true
        }
      }
    }

    const merged = normalizeStringList([...(preserveGood ? existingGood : []), ...best]).slice(0, 5)
    if (merged.length < 3) {
      return {
        ok: false,
        id: fact.id,
        reason: `insufficient distractors (${merged.length})`,
      }
    }

    if (hasAnswerCheck) {
      update.run({
        id: fact.id,
        distractors: JSON.stringify(merged),
        now,
        fixer,
      })
    } else {
      update.run({
        id: fact.id,
        distractors: JSON.stringify(merged),
      })
    }

    if ((index + 1) % 25 === 0) {
      console.log(`[distractors] processed ${index + 1}/${toFix.length}`)
    }

    return { ok: true, id: fact.id, relaxed: usedRelaxed }
  })

  for (const row of results) {
    if (!row?.ok) {
      failed += 1
      failures.push(row)
      continue
    }
    fixed += 1
    if (row.relaxed) strictRelaxed += 1
  }

  db.close()

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'distractors',
    dbPath: rel(dbPath),
    model,
    status,
    limit,
    offset,
    concurrency,
    strictGlobal,
    counts: {
      selected: candidates.length,
      attempted: toFix.length,
      fixed,
      failed,
      strictRelaxed,
    },
    sampleFailures: failures.slice(0, 20),
  }

  await ensureDir(reportPath, true)
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), counts: report.counts }, null, 2))
}

async function cmdVagueVocab(rawArgs) {
  const args = {
    db: 'public/facts.db',
    model: 'gpt-5.2',
    status: 'approved',
    limit: 500,
    offset: 0,
    concurrency: 6,
    fixer: 'gpt-5.2-vague-vocab-fix',
    report: 'data/generated/qa-reports/answer-check-live-db/llm-vague-vocab-fix-report.json',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 500)
  const offset = Math.max(0, Number(args.offset) || 0)
  const concurrency = Math.max(1, Number(args.concurrency) || 6)
  const model = String(args.model || 'gpt-5.2').trim()
  const fixer = String(args.fixer || 'gpt-5.2-vague-vocab-fix').trim()
  const now = Date.now()

  const db = new Database(dbPath)
  const hasAnswerCheck = hasAnswerCheckColumns(db)
  const rows = db.prepare(`
    SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
           category_l1, category_l2
    FROM facts
    WHERE status = @status AND quiz_question = 'What does this mean?'
    ORDER BY id
    LIMIT @limit OFFSET @offset
  `).all({ status, limit, offset })

  const update = hasAnswerCheck
    ? db.prepare(`
      UPDATE facts SET
        quiz_question = @quizQuestion,
        answer_check_issue = '',
        answer_check_needs_fix = 0,
        answer_check_checked_at = @now,
        answer_check_checked_by = @fixer,
        answer_check_fixed_at = @now,
        answer_check_fixed_by = @fixer
      WHERE id = @id
    `)
    : db.prepare(`
      UPDATE facts SET
        quiz_question = @quizQuestion
      WHERE id = @id
    `)

  let fixed = 0
  let failed = 0
  const failures = []

  const results = await runWithConcurrency(rows, concurrency, async (fact, index) => {
    const prompt = buildVocabQuestionPrompt(fact)
    let question = ''

    try {
      const text = await runCodexPrompt({ prompt, model, retries: 2 })
      question = cleanTextResponse(text)
    } catch (error) {
      return { ok: false, id: fact.id, reason: `codex error: ${error instanceof Error ? error.message : String(error)}` }
    }

    const answerNorm = normalizeText(String(fact.correct_answer || ''))
    const questionNorm = normalizeText(question)
    if (!question || question.length < 10) {
      return { ok: false, id: fact.id, reason: 'empty/short rewrite' }
    }
    if (answerNorm.length >= 5 && questionNorm.includes(answerNorm)) {
      return { ok: false, id: fact.id, reason: 'rewrite still contains answer' }
    }

    const withQMark = question.endsWith('?') ? question : `${question}?`
    if (hasAnswerCheck) {
      update.run({
        id: fact.id,
        quizQuestion: withQMark,
        now,
        fixer,
      })
    } else {
      update.run({
        id: fact.id,
        quizQuestion: withQMark,
      })
    }

    if ((index + 1) % 25 === 0) {
      console.log(`[vague-vocab] processed ${index + 1}/${rows.length}`)
    }
    return { ok: true, id: fact.id }
  })

  for (const row of results) {
    if (row?.ok) fixed += 1
    else {
      failed += 1
      failures.push(row)
    }
  }

  db.close()

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'vague-vocab',
    dbPath: rel(dbPath),
    model,
    status,
    limit,
    offset,
    concurrency,
    counts: { selected: rows.length, fixed, failed },
    sampleFailures: failures.slice(0, 20),
  }
  await ensureDir(reportPath, true)
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), counts: report.counts }, null, 2))
}

async function cmdRewriteQuestions(rawArgs) {
  const args = {
    db: 'public/facts.db',
    model: 'gpt-5.2',
    status: 'approved',
    limit: 500,
    offset: 0,
    concurrency: 6,
    fixer: 'gpt-5.2-question-fix',
    'min-length': 20,
    report: 'data/generated/qa-reports/answer-check-live-db/llm-question-fix-report.json',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 500)
  const offset = Math.max(0, Number(args.offset) || 0)
  const concurrency = Math.max(1, Number(args.concurrency) || 6)
  const minLength = Math.max(10, Number(args['min-length']) || 20)
  const model = String(args.model || 'gpt-5.2').trim()
  const fixer = String(args.fixer || 'gpt-5.2-question-fix').trim()
  const now = Date.now()

  const DatabaseCtor = loadBetterSqlite()
  const db = new DatabaseCtor(dbPath)
  const hasAnswerCheck = hasAnswerCheckColumns(db)

  const rowsAll = db.prepare(hasAnswerCheck
    ? `
      SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
             category_l1, category_l2, answer_check_issue
      FROM facts
      WHERE status = @status
      ORDER BY id
      LIMIT @limit OFFSET @offset
    `
    : `
      SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
             category_l1, category_l2, '' AS answer_check_issue
      FROM facts
      WHERE status = @status
      ORDER BY id
      LIMIT @limit OFFSET @offset
    `).all({ status, limit, offset })

  const rows = rowsAll.filter((fact) => questionNeedsRewrite(fact, minLength))

  const update = hasAnswerCheck
    ? db.prepare(`
      UPDATE facts SET
        quiz_question = @quizQuestion,
        answer_check_issue = '',
        answer_check_needs_fix = 0,
        answer_check_checked_at = @now,
        answer_check_checked_by = @fixer,
        answer_check_fixed_at = @now,
        answer_check_fixed_by = @fixer
      WHERE id = @id
    `)
    : db.prepare(`
      UPDATE facts SET
        quiz_question = @quizQuestion
      WHERE id = @id
    `)

  let fixed = 0
  let failed = 0
  const failures = []

  const results = await runWithConcurrency(rows, concurrency, async (fact, index) => {
    const prompt = buildQuestionRewritePrompt(fact, fact.answer_check_issue || '')
    let question = ''
    try {
      const text = await runCodexPrompt({ prompt, model, retries: 2 })
      question = cleanTextResponse(text)
    } catch (error) {
      return { ok: false, id: fact.id, reason: `codex error: ${error instanceof Error ? error.message : String(error)}` }
    }

    const answerNorm = normalizeText(String(fact.correct_answer || ''))
    const qNorm = normalizeText(question)
    if (!question || question.length < minLength) {
      return { ok: false, id: fact.id, reason: `rewrite shorter than ${minLength}` }
    }
    if (answerNorm.length >= 5 && qNorm.includes(answerNorm)) {
      return { ok: false, id: fact.id, reason: 'rewrite still contains answer' }
    }

    const withQMark = question.endsWith('?') ? question : `${question}?`
    if (hasAnswerCheck) {
      update.run({
        id: fact.id,
        quizQuestion: withQMark,
        now,
        fixer,
      })
    } else {
      update.run({
        id: fact.id,
        quizQuestion: withQMark,
      })
    }

    if ((index + 1) % 25 === 0) {
      console.log(`[rewrite-questions] processed ${index + 1}/${rows.length}`)
    }
    return { ok: true, id: fact.id }
  })

  for (const row of results) {
    if (row?.ok) fixed += 1
    else {
      failed += 1
      failures.push(row)
    }
  }

  db.close()

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'rewrite-questions',
    dbPath: rel(dbPath),
    model,
    status,
    limit,
    offset,
    concurrency,
    minLength,
    counts: { selected: rows.length, fixed, failed },
    sampleFailures: failures.slice(0, 20),
  }
  await ensureDir(reportPath, true)
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), counts: report.counts }, null, 2))
}

async function cmdRewriteAnswers(rawArgs) {
  const args = {
    db: 'public/facts.db',
    model: 'gpt-5.2',
    status: 'approved',
    limit: 200,
    offset: 0,
    concurrency: 4,
    fixer: 'gpt-5.2-answer-fix',
    report: 'data/generated/qa-reports/answer-check-live-db/llm-answer-fix-report.json',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const reportPath = path.resolve(root, String(args.report))
  const status = String(args.status || '').trim()
  const limit = Math.max(1, Number(args.limit) || 200)
  const offset = Math.max(0, Number(args.offset) || 0)
  const concurrency = Math.max(1, Number(args.concurrency) || 4)
  const model = String(args.model || 'gpt-5.2').trim()
  const fixer = String(args.fixer || 'gpt-5.2-answer-fix').trim()
  const now = Date.now()

  const db = new Database(dbPath)
  const hasAnswerCheck = hasAnswerCheckColumns(db)
  const rowsAll = db.prepare(hasAnswerCheck
    ? `
      SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
             category_l1, category_l2, answer_check_issue
      FROM facts
      WHERE status = @status
      ORDER BY id
      LIMIT @limit OFFSET @offset
    `
    : `
      SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
             category_l1, category_l2, '' AS answer_check_issue
      FROM facts
      WHERE status = @status
      ORDER BY id
      LIMIT @limit OFFSET @offset
    `).all({ status, limit, offset })
  const rows = rowsAll.filter((fact) => answerNeedsRepair(fact))

  const update = hasAnswerCheck
    ? db.prepare(`
      UPDATE facts SET
        correct_answer = @correctAnswer,
        answer_check_issue = '',
        answer_check_needs_fix = 0,
        answer_check_checked_at = @now,
        answer_check_checked_by = @fixer,
        answer_check_fixed_at = @now,
        answer_check_fixed_by = @fixer
      WHERE id = @id
    `)
    : db.prepare(`
      UPDATE facts SET
        correct_answer = @correctAnswer
      WHERE id = @id
    `)

  let fixed = 0
  let failed = 0
  const failures = []

  const results = await runWithConcurrency(rows, concurrency, async (fact, index) => {
    const prompt = buildAnswerRepairPrompt(fact)
    let answer = ''
    try {
      const text = await runCodexPrompt({ prompt, model, retries: 2 })
      answer = cleanTextResponse(text)
    } catch (error) {
      return { ok: false, id: fact.id, reason: `codex error: ${error instanceof Error ? error.message : String(error)}` }
    }

    if (!answer || answer.length < 1) return { ok: false, id: fact.id, reason: 'empty answer' }
    if (answer.endsWith('...')) return { ok: false, id: fact.id, reason: 'still truncated' }

    if (hasAnswerCheck) {
      update.run({
        id: fact.id,
        correctAnswer: answer,
        now,
        fixer,
      })
    } else {
      update.run({
        id: fact.id,
        correctAnswer: answer,
      })
    }

    if ((index + 1) % 25 === 0) {
      console.log(`[rewrite-answers] processed ${index + 1}/${rows.length}`)
    }
    return { ok: true, id: fact.id }
  })

  for (const row of results) {
    if (row?.ok) fixed += 1
    else {
      failed += 1
      failures.push(row)
    }
  }

  db.close()
  const report = {
    generatedAt: new Date().toISOString(),
    command: 'rewrite-answers',
    dbPath: rel(dbPath),
    model,
    status,
    limit,
    offset,
    concurrency,
    counts: { selected: rows.length, fixed, failed },
    sampleFailures: failures.slice(0, 20),
  }
  await ensureDir(reportPath, true)
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), counts: report.counts }, null, 2))
}

async function runCheck(dbPath, checker, reportPath) {
  const script = path.resolve(root, 'scripts/content-pipeline/qa/answer-check-live-db.mjs')
  const args = [
    script,
    'check',
    '--db',
    dbPath,
    '--checker',
    checker,
    '--limit',
    '50000',
    '--report',
    reportPath,
  ]
  const { stdout } = await execFileAsync(process.execPath, args, {
    cwd: root,
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  })
  return String(stdout || '').trim()
}

async function cmdRunAll(rawArgs) {
  const args = {
    db: 'public/facts.db',
    model: 'gpt-5.2',
    status: 'approved',
    limit: 50000,
    concurrency: 6,
    fixer: 'gpt-5.2-fix-1',
    'max-passes': 4,
    report: 'data/generated/qa-reports/answer-check-live-db/llm-run-all-report.json',
    ...rawArgs,
  }

  const dbPath = String(args.db)
  const model = String(args.model)
  const status = String(args.status)
  const limit = Math.max(1, Number(args.limit) || 50000)
  const concurrency = Math.max(1, Number(args.concurrency) || 6)
  const fixer = String(args.fixer || 'gpt-5.2-fix-1')
  const maxPasses = Math.max(1, Number(args['max-passes']) || 4)
  const reportPath = path.resolve(root, String(args.report))
  const passReports = []

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    console.log(`[run-all] pass ${pass}/${maxPasses} - pre-check`)
    await runCheck(dbPath, `${fixer}-pre-pass-${pass}`, `data/generated/qa-reports/answer-check-live-db/check-pre-pass-${pass}.json`)

    console.log(`[run-all] pass ${pass}/${maxPasses} - fix vague vocab`)
    await cmdVagueVocab({
      db: dbPath,
      model,
      status,
      limit,
      offset: 0,
      concurrency,
      fixer,
      report: `data/generated/qa-reports/answer-check-live-db/llm-vague-vocab-fix-pass-${pass}.json`,
    })

    console.log(`[run-all] pass ${pass}/${maxPasses} - fix distractors`)
    await cmdDistractors({
      db: dbPath,
      model,
      status,
      limit,
      offset: 0,
      concurrency,
      fixer,
      report: `data/generated/qa-reports/answer-check-live-db/llm-distractor-fix-pass-${pass}.json`,
      'strict-global-answer-collision': true,
    })

    console.log(`[run-all] pass ${pass}/${maxPasses} - rewrite questions`)
    await cmdRewriteQuestions({
      db: dbPath,
      model,
      status,
      limit,
      offset: 0,
      concurrency,
      fixer,
      'min-length': 20,
      report: `data/generated/qa-reports/answer-check-live-db/llm-question-fix-pass-${pass}.json`,
    })

    console.log(`[run-all] pass ${pass}/${maxPasses} - repair answers`)
    await cmdRewriteAnswers({
      db: dbPath,
      model,
      status,
      limit: 300,
      offset: 0,
      concurrency: Math.max(1, Math.floor(concurrency / 2)),
      fixer,
      report: `data/generated/qa-reports/answer-check-live-db/llm-answer-fix-pass-${pass}.json`,
    })

    console.log(`[run-all] pass ${pass}/${maxPasses} - post-check`)
    const out = await runCheck(dbPath, `${fixer}-post-pass-${pass}`, `data/generated/qa-reports/answer-check-live-db/check-post-pass-${pass}.json`)
    passReports.push({ pass, checkOutput: out })

    const Database = loadBetterSqlite()
    const db = new Database(path.resolve(root, dbPath))
    ensureAnswerCheckColumns(db)
    const flagged = db.prepare('SELECT COUNT(*) AS c FROM facts WHERE answer_check_needs_fix = 1').get().c
    const vague = db.prepare("SELECT COUNT(*) AS c FROM facts WHERE quiz_question = 'What does this mean?'").get().c
    const short = db.prepare("SELECT COUNT(*) AS c FROM facts WHERE type='fact' AND LENGTH(quiz_question) < 20").get().c
    const noDistractors = db.prepare("SELECT COUNT(*) AS c FROM facts WHERE distractors IS NULL OR distractors='' OR distractors='[]'").get().c
    db.close()

    console.log(`[run-all] pass ${pass} summary: flagged=${flagged}, vague=${vague}, short=${short}, missing_distractors=${noDistractors}`)
    if (flagged === 0 && vague === 0 && short < 5 && noDistractors === 0) {
      console.log(`[run-all] early stop at pass ${pass} (gates met)`)
      break
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'run-all',
    db: dbPath,
    model,
    status,
    limit,
    concurrency,
    fixer,
    maxPasses,
    passReports,
  }
  await ensureDir(reportPath, true)
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ok: true, reportPath: rel(reportPath), passes: passReports.length }, null, 2))
}

function printHelp() {
  console.log([
    'Usage:',
    '  node scripts/content-pipeline/qa/llm-fact-quality-fix.mjs <command> [options]',
    '',
    'Commands:',
    '  distractors       Generate distractors with GPT-5.2 per fact (no pool mining)',
    '  vague-vocab       Rewrite "What does this mean?" vocabulary questions',
    '  rewrite-questions Rewrite answer-in-question, malformed, and short fact questions',
    '  rewrite-answers   Repair missing/truncated answers',
    '  run-all           Iterate all fixers with pre/post checks',
    '',
    'Examples:',
    '  node scripts/content-pipeline/qa/llm-fact-quality-fix.mjs distractors --db public/facts.db --model gpt-5.2 --limit 500 --concurrency 6',
    '  node scripts/content-pipeline/qa/llm-fact-quality-fix.mjs run-all --db public/facts.db --model gpt-5.2 --limit 50000 --concurrency 6 --max-passes 4',
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
    case 'distractors':
      await cmdDistractors(args)
      break
    case 'vague-vocab':
      await cmdVagueVocab(args)
      break
    case 'rewrite-questions':
      await cmdRewriteQuestions(args)
      break
    case 'rewrite-answers':
      await cmdRewriteAnswers(args)
      break
    case 'run-all':
      await cmdRunAll(args)
      break
    case 'help':
    default:
      printHelp()
      break
  }
}

main().catch((error) => {
  console.error('[llm-fact-quality-fix] failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
