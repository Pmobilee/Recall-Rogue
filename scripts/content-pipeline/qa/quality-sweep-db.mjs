#!/usr/bin/env node
import fs from 'node:fs/promises'
import fssync from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs, writeJson, normalizeText, isPlaceholderDistractor, isGarbageDistractor, parseDistractorsColumn } from './shared.mjs'
import { SUBCATEGORY_TAXONOMY, DOMAIN_LABELS, toTaxonomyPromptBlock, isValidSubcategoryId, normalizeTaxonomyDomain } from '../subcategory-taxonomy.mjs'
import { baseHeuristicIssues } from './answer-check-live-db.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')
const require = createRequire(import.meta.url)

const VALID_COMMANDS = new Set(['export', 'status', 'apply', 'verify', 'help'])
const DEFAULT_OUTPUT_DIR = 'data/generated/quality-sweep'
const VOCAB_BATCH_SIZE = 100
const KNOWLEDGE_BATCH_SIZE = 50

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// JSONL helpers
// ---------------------------------------------------------------------------

async function loadJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      try {
        return JSON.parse(line)
      } catch (err) {
        throw new Error(`JSON parse error on line ${idx + 1} of ${filePath}: ${err.message}`)
      }
    })
}

async function writeJsonl(filePath, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const text = rows.map((row) => JSON.stringify(row)).join('\n')
  await fs.writeFile(filePath, `${text}\n`, 'utf8')
}

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------

const VOCAB_LANGUAGE_CODES = ['ja', 'ko', 'es', 'de', 'it', 'fr', 'nl', 'cs', 'pt', 'zh', 'ru', 'ar', 'pl', 'tr', 'sv', 'he', 'vi']

/**
 * Determine the group key for a DB row.
 * - vocabulary rows: `vocab-<language>` (language from row.language, fallback 'xx')
 * - all other types: `knowledge-<normalized_domain>` (from category_l1)
 */
function rowGroupKey(row) {
  const type = String(row.type || '').trim().toLowerCase()
  if (type === 'vocabulary') {
    const lang = String(row.language || '').trim().toLowerCase() || 'xx'
    return `vocab-${lang}`
  }
  const domain = normalizeTaxonomyDomain(row.category_l1) || 'unknown'
  return `knowledge-${domain}`
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

async function readManifest(outputDir) {
  const manifestPath = path.join(outputDir, 'manifest.json')
  const text = await fs.readFile(manifestPath, 'utf8')
  return JSON.parse(text)
}

async function writeManifest(outputDir, manifest) {
  const manifestPath = path.join(outputDir, 'manifest.json')
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

// ---------------------------------------------------------------------------
// Command: export
// ---------------------------------------------------------------------------

async function cmdExport(rawArgs) {
  const args = {
    db: 'public/facts.db',
    'output-dir': DEFAULT_OUTPUT_DIR,
    'batch-size-vocab': VOCAB_BATCH_SIZE,
    'batch-size-knowledge': KNOWLEDGE_BATCH_SIZE,
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const outputDir = path.resolve(root, String(args['output-dir']))
  const batchSizeVocab = Math.max(1, Number(args['batch-size-vocab']) || VOCAB_BATCH_SIZE)
  const batchSizeKnowledge = Math.max(1, Number(args['batch-size-knowledge']) || KNOWLEDGE_BATCH_SIZE)

  console.log(`Opening DB: ${rel(dbPath)}`)
  const db = new Database(dbPath)
  ensureAnswerCheckColumns(db)

  const rows = db.prepare(`
    SELECT id, type, language, statement, quiz_question, correct_answer, explanation,
           distractors, variants, tags, category_l1, category_l2, category_l3,
           answer_check_issue, answer_check_needs_fix
    FROM facts
    ORDER BY id
  `).all()

  db.close()
  console.log(`Read ${rows.length.toLocaleString()} rows from DB`)

  // Group rows
  /** @type {Map<string, Array>} */
  const groups = new Map()
  for (const row of rows) {
    const key = rowGroupKey(row)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  const sortedGroupKeys = [...groups.keys()].sort()
  const batchesDir = path.join(outputDir, 'batches')

  const manifestGroups = {}
  const manifestBatches = []

  for (const groupKey of sortedGroupKeys) {
    const groupRows = groups.get(groupKey)
    const isVocab = groupKey.startsWith('vocab-')
    const batchSize = isVocab ? batchSizeVocab : batchSizeKnowledge
    const groupDir = path.join(batchesDir, groupKey)

    let batchIndex = 0
    for (let offset = 0; offset < groupRows.length; offset += batchSize) {
      const slice = groupRows.slice(offset, offset + batchSize)
      const batchFile = path.join('batches', groupKey, `batch-${String(batchIndex).padStart(3, '0')}.jsonl`)
      const absoluteFile = path.join(outputDir, batchFile)

      // Serialize each row to compact form
      const compact = slice.map((row) => ({
        id: row.id,
        s: row.statement || null,
        q: row.quiz_question || null,
        a: row.correct_answer || null,
        d: parseDistractorsColumn(row.distractors),
        e: row.explanation || null,
        l1: row.category_l1 || null,
        l2: row.category_l2 || null,
      }))

      await writeJsonl(absoluteFile, compact)

      manifestBatches.push({
        group: groupKey,
        index: batchIndex,
        file: batchFile,
        rows: slice.length,
        status: 'pending',
      })

      batchIndex++
    }

    manifestGroups[groupKey] = {
      rows: groupRows.length,
      batches: batchIndex,
    }

    console.log(`  ${groupKey}: ${groupRows.length.toLocaleString()} rows → ${batchIndex} batches`)
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    dbPath: rel(dbPath),
    totalRows: rows.length,
    groups: manifestGroups,
    batches: manifestBatches,
  }

  await writeManifest(outputDir, manifest)

  console.log(`\nExport complete.`)
  console.log(`  Groups:     ${sortedGroupKeys.length}`)
  console.log(`  Batches:    ${manifestBatches.length}`)
  console.log(`  Total rows: ${rows.length.toLocaleString()}`)
  console.log(`  Manifest:   ${rel(path.join(outputDir, 'manifest.json'))}`)
}

// ---------------------------------------------------------------------------
// Command: status
// ---------------------------------------------------------------------------

async function cmdStatus(rawArgs) {
  const args = {
    'output-dir': DEFAULT_OUTPUT_DIR,
    ...rawArgs,
  }

  const outputDir = path.resolve(root, String(args['output-dir']))
  const manifest = await readManifest(outputDir)

  const statusCounts = { pending: 0, done: 0, failed: 0, needs_retry: 0 }
  /** @type {Map<string, {pending:number, done:number, failed:number, needs_retry:number, total:number}>} */
  const byGroup = new Map()

  for (const batch of manifest.batches) {
    const s = batch.status || 'pending'
    statusCounts[s] = (statusCounts[s] || 0) + 1

    if (!byGroup.has(batch.group)) {
      byGroup.set(batch.group, { pending: 0, done: 0, failed: 0, needs_retry: 0, total: 0, rows: 0 })
    }
    const g = byGroup.get(batch.group)
    g[s] = (g[s] || 0) + 1
    g.total++
    g.rows += batch.rows
  }

  const total = manifest.batches.length
  const done = statusCounts.done || 0
  const pending = statusCounts.pending || 0
  const failed = (statusCounts.failed || 0) + (statusCounts.needs_retry || 0)
  const pct = total > 0 ? ((done / total) * 100).toFixed(1) : '0.0'

  console.log(`\nQuality Sweep Status`)
  console.log(`  Created:     ${manifest.createdAt}`)
  console.log(`  DB:          ${manifest.dbPath}`)
  console.log(`  Total rows:  ${manifest.totalRows.toLocaleString()}`)
  console.log(`  Total batches: ${total}`)
  console.log(`  Done:        ${done} / ${total} (${pct}%)`)
  console.log(`  Pending:     ${pending}`)
  console.log(`  Failed/Retry: ${failed}`)
  console.log()

  // Per-group summary
  const groupKeys = [...byGroup.keys()].sort()
  const maxKeyLen = Math.max(...groupKeys.map((k) => k.length), 10)
  const header = 'Group'.padEnd(maxKeyLen) + '  ' + 'Done'.padStart(5) + '  ' + 'Pend'.padStart(5) + '  ' + 'Fail'.padStart(5) + '  ' + 'Total'.padStart(6) + '  ' + 'Rows'.padStart(8)
  console.log(header)
  console.log('-'.repeat(header.length))

  for (const key of groupKeys) {
    const g = byGroup.get(key)
    const gFail = (g.failed || 0) + (g.needs_retry || 0)
    const line = key.padEnd(maxKeyLen)
      + '  ' + String(g.done || 0).padStart(5)
      + '  ' + String(g.pending || 0).padStart(5)
      + '  ' + String(gFail).padStart(5)
      + '  ' + String(g.total).padStart(6)
      + '  ' + String(g.rows).padStart(8)
    console.log(line)
  }

  // Estimated remaining time
  if (pending > 0) {
    // Rough estimate: 30s per knowledge batch, 15s per vocab batch
    const pendingBatches = manifest.batches.filter((b) => b.status === 'pending')
    const pendingVocab = pendingBatches.filter((b) => b.group.startsWith('vocab-')).length
    const pendingKnowledge = pendingBatches.length - pendingVocab
    const estimatedSeconds = pendingVocab * 15 + pendingKnowledge * 30
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60)
    console.log(`\n  Estimated remaining: ~${estimatedMinutes} min (rough estimate)`)
  } else if (pending === 0 && total > 0) {
    console.log(`\n  All batches processed.`)
  }
}

// ---------------------------------------------------------------------------
// Command: apply
// ---------------------------------------------------------------------------

/**
 * Validate a single output row from a result file against its input counterpart.
 * Returns an array of rejection reasons (empty = valid).
 * @param {string} [group] - batch group name; vocab-* groups skip the garbage word list
 */
function validateOutputRow(outputRow, inputRow, group = '') {
  const isVocab = group.startsWith('vocab-')
  const reasons = []

  const origAnswer = String(inputRow.a || '').trim()
  const newAnswer = outputRow.a != null ? String(outputRow.a).trim() : null

  // Answer preservation check
  if (newAnswer !== null && origAnswer.length > 0) {
    if (newAnswer.length < origAnswer.length * 0.5) {
      reasons.push(`answer too short: "${newAnswer}" vs original "${origAnswer}"`)
    }
  }

  // Distractor validation
  const distractors = outputRow.d
  if (!Array.isArray(distractors)) {
    reasons.push('distractors field is not an array')
  } else {
    if (distractors.length < 5) {
      reasons.push(`too few distractors: ${distractors.length} (need 5+)`)
    }

    const answerNorm = normalizeText(newAnswer ?? origAnswer)

    // Placeholder/garbage check — skip garbage word list for vocab batches
    // (common English words like "house", "to go" are valid vocab distractors when Sonnet generates them contextually)
    const badOnes = distractors.filter((d) => isPlaceholderDistractor(d) || (!isVocab && isGarbageDistractor(d)))
    if (badOnes.length > 0) {
      reasons.push(`${badOnes.length} placeholder/garbage distractors: ${badOnes.slice(0, 3).map((d) => JSON.stringify(d)).join(', ')}`)
    }

    // Duplicate check (normalized)
    const normalized = distractors.map((d) => normalizeText(String(d || '')))
    const uniqueNorm = new Set(normalized)
    if (uniqueNorm.size < normalized.length) {
      reasons.push(`${normalized.length - uniqueNorm.size} duplicate distractors`)
    }

    // No distractor matches correct answer
    if (answerNorm && normalized.some((d) => d === answerNorm)) {
      reasons.push('at least one distractor matches the correct answer')
    }
  }

  // Category l1 validation
  const origL1 = String(inputRow.l1 || '').trim()
  const newL1 = outputRow.l1 != null ? String(outputRow.l1).trim() : null

  // Geography protection: reject l1 changes for geography rows
  if (origL1 && /geography/i.test(origL1)) {
    if (newL1 !== null && newL1 !== origL1) {
      reasons.push(`geography l1 protection: cannot change l1 from "${origL1}" to "${newL1}"`)
    }
    // Also protect capitals_countries subcategory
    const origL2 = String(inputRow.l2 || '').trim()
    const newL2 = outputRow.l2 != null ? String(outputRow.l2).trim() : null
    if (origL2 === 'capitals_countries' && newL2 !== null && newL2 !== origL2) {
      reasons.push(`geography l2 protection: cannot change l2 from "capitals_countries" to "${newL2}"`)
    }
    if (newL2 === 'capitals_countries' && origL2 && origL2 !== 'capitals_countries') {
      reasons.push(`geography l2 protection: cannot change l2 to "capitals_countries" from "${origL2}"`)
    }
  }

  // l1 must be a valid domain if provided
  if (newL1 !== null && newL1 !== '') {
    const normalized = normalizeTaxonomyDomain(newL1)
    if (!normalized) {
      reasons.push(`invalid l1 domain: "${newL1}"`)
    }
  }

  // l2 must be valid for the effective domain if provided
  const effectiveDomain = newL1 ? normalizeTaxonomyDomain(newL1) : normalizeTaxonomyDomain(origL1)
  const newL2 = outputRow.l2 != null ? String(outputRow.l2).trim() : null
  if (newL2 !== null && newL2 !== '' && effectiveDomain) {
    if (!isValidSubcategoryId(effectiveDomain, newL2)) {
      reasons.push(`invalid l2 "${newL2}" for domain "${effectiveDomain}"`)
    }
  }

  return reasons
}

async function cmdApply(rawArgs) {
  const args = {
    db: 'public/facts.db',
    'output-dir': DEFAULT_OUTPUT_DIR,
    'dry-run': false,
    fixer: 'quality-sweep',
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const outputDir = path.resolve(root, String(args['output-dir']))
  const dryRun = parseBool(args['dry-run'], false)
  const fixer = String(args.fixer || 'quality-sweep').trim()

  const manifest = await readManifest(outputDir)
  const resultsDir = path.join(outputDir, 'results')

  // Find all done batches that have result files
  const doneBatches = manifest.batches.filter((b) => b.status === 'done')
  if (doneBatches.length === 0) {
    console.log('No batches with status "done" found in manifest. Nothing to apply.')
    console.log('Run the sweep workers first, then use "apply" to write results to DB.')
    return
  }

  console.log(`Found ${doneBatches.length} done batches. Loading results...`)

  const Database2 = loadBetterSqlite()
  const db = new Database2(dbPath)
  const columnSet = ensureAnswerCheckColumns(db)
  const now = Date.now()

  // Prepare statements
  const selectStmt = db.prepare(`
    SELECT id, quiz_question, correct_answer, explanation, distractors, category_l1, category_l2
    FROM facts WHERE id = ?
  `)

  // We'll build the update per-row since columns differ
  const updateBase = `
    UPDATE facts SET
      quiz_question = @q,
      correct_answer = @a,
      distractors = @d,
      explanation = @e,
      category_l1 = @l1,
      category_l2 = @l2,
      answer_check_issue = @issue,
      answer_check_needs_fix = @needsFix,
      answer_check_checked_at = @checkedAt,
      answer_check_checked_by = @checkedBy,
      answer_check_fixed_at = @fixedAt,
      answer_check_fixed_by = @fixedBy
    WHERE id = @id
  `
  const updateStmt = db.prepare(updateBase)

  let totalApplied = 0
  let totalRejected = 0
  let totalMissing = 0
  let totalBatchesProcessed = 0
  const rejectionReasons = {}
  const updatedManifestBatches = [...manifest.batches]

  for (const batch of doneBatches) {
    // batch.file includes "batches/" prefix — strip it for result path
    const batchRelative = batch.file.replace(/^batches\//, '')
    const resultFile = path.join(resultsDir, batchRelative)
    const inputFile = path.join(outputDir, batch.file)

    // Check result file exists
    if (!fssync.existsSync(resultFile)) {
      console.warn(`  [WARN] Result file missing for batch ${batch.group}/${batch.index}: ${rel(resultFile)}`)
      continue
    }

    // Load input and result
    let inputRows, resultRows
    try {
      inputRows = await loadJsonl(inputFile)
      resultRows = await loadJsonl(resultFile)
    } catch (err) {
      console.error(`  [ERROR] Failed to load batch ${batch.group}/${batch.index}: ${err.message}`)
      // Mark as needs_retry in manifest
      const batchEntry = updatedManifestBatches.find((b) => b.group === batch.group && b.index === batch.index)
      if (batchEntry) batchEntry.status = 'needs_retry'
      continue
    }

    // Build input lookup by id
    const inputById = new Map(inputRows.map((r) => [String(r.id), r]))

    // Row count check (warn but don't fail)
    if (resultRows.length !== inputRows.length) {
      console.warn(`  [WARN] ${batch.group}/batch-${batch.index}: row count mismatch (input=${inputRows.length}, result=${resultRows.length})`)
    }

    const batchUpdates = []

    for (const outputRow of resultRows) {
      const id = String(outputRow.id || '').trim()
      if (!id) {
        totalRejected++
        const key = 'missing id in output'
        rejectionReasons[key] = (rejectionReasons[key] || 0) + 1
        continue
      }

      const inputRow = inputById.get(id)
      if (!inputRow) {
        totalMissing++
        continue
      }

      // Validate
      const rejectionList = validateOutputRow(outputRow, inputRow, batch.group)
      if (rejectionList.length > 0) {
        totalRejected++
        for (const reason of rejectionList) {
          const short = reason.length > 80 ? reason.slice(0, 80) + '…' : reason
          rejectionReasons[short] = (rejectionReasons[short] || 0) + 1
        }
        continue
      }

      // Read current DB row to merge null-preserved fields
      const current = selectStmt.get(id)
      if (!current) {
        totalMissing++
        continue
      }

      // Merge: null in output = keep existing
      const mergedQ = outputRow.q != null ? String(outputRow.q) : String(current.quiz_question || '')
      const mergedA = outputRow.a != null ? String(outputRow.a) : String(current.correct_answer || '')
      const mergedE = outputRow.e != null ? String(outputRow.e) : String(current.explanation || '')
      const mergedL1 = outputRow.l1 != null ? normalizeTaxonomyDomain(String(outputRow.l1)) || String(outputRow.l1) : String(current.category_l1 || '')
      const mergedL2 = outputRow.l2 != null ? String(outputRow.l2) : String(current.category_l2 || '')
      const mergedD = Array.isArray(outputRow.d) ? JSON.stringify(outputRow.d) : String(current.distractors || '[]')

      // Re-run heuristics on the merged row to determine issue state
      const mergedRow = {
        quiz_question: mergedQ,
        correct_answer: mergedA,
        explanation: mergedE,
        distractors: mergedD,
        type: '', // type not tracked in compact form; heuristics still work
      }
      const issues = baseHeuristicIssues(mergedRow)
      const issue = issues.join(' | ')
      const needsFix = issue ? 1 : 0

      batchUpdates.push({
        id,
        q: mergedQ,
        a: mergedA,
        d: mergedD,
        e: mergedE,
        l1: mergedL1,
        l2: mergedL2,
        issue,
        needsFix,
        checkedAt: now,
        checkedBy: fixer,
        fixedAt: needsFix ? null : now,
        fixedBy: needsFix ? null : fixer,
      })
    }

    if (!dryRun && batchUpdates.length > 0) {
      const tx = db.transaction((rows) => {
        for (const row of rows) updateStmt.run(row)
      })
      tx(batchUpdates)
    }

    totalApplied += batchUpdates.length
    totalBatchesProcessed++

    // Mark batch as applied in manifest
    const batchEntry = updatedManifestBatches.find((b) => b.group === batch.group && b.index === batch.index)
    if (batchEntry) batchEntry.status = 'applied'
  }

  db.close()

  // Update manifest
  if (!dryRun) {
    const updatedManifest = { ...manifest, batches: updatedManifestBatches, lastAppliedAt: new Date().toISOString() }
    await writeManifest(outputDir, updatedManifest)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'apply',
    dbPath: rel(dbPath),
    outputDir: rel(outputDir),
    fixer,
    dryRun,
    counts: {
      batchesFound: doneBatches.length,
      batchesProcessed: totalBatchesProcessed,
      applied: totalApplied,
      rejected: totalRejected,
      missing: totalMissing,
    },
    topRejectionReasons: Object.entries(rejectionReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([reason, count]) => ({ reason, count })),
  }

  const reportPath = path.join(outputDir, 'reports', 'apply-report.json')
  await writeJson(reportPath, report)

  console.log(`\nApply complete${dryRun ? ' (DRY RUN — no DB writes)' : ''}.`)
  console.log(`  Batches processed: ${totalBatchesProcessed} / ${doneBatches.length}`)
  console.log(`  Applied:           ${totalApplied}`)
  console.log(`  Rejected:          ${totalRejected}`)
  console.log(`  Missing in DB:     ${totalMissing}`)
  if (report.topRejectionReasons.length > 0) {
    console.log('\n  Top rejection reasons:')
    for (const { reason, count } of report.topRejectionReasons.slice(0, 10)) {
      console.log(`    [${count}] ${reason}`)
    }
  }
  console.log(`\n  Report: ${rel(reportPath)}`)
}

// ---------------------------------------------------------------------------
// Command: verify
// ---------------------------------------------------------------------------

async function cmdVerify(rawArgs) {
  const args = {
    db: 'public/facts.db',
    'output-dir': DEFAULT_OUTPUT_DIR,
    ...rawArgs,
  }

  const Database = loadBetterSqlite()
  const dbPath = path.resolve(root, String(args.db))
  const outputDir = path.resolve(root, String(args['output-dir']))

  console.log(`Opening DB: ${rel(dbPath)}`)
  const db = new Database(dbPath, { readonly: true })

  const rows = db.prepare(`
    SELECT id, type, language, quiz_question, correct_answer, explanation,
           distractors, variants, category_l1, category_l2,
           answer_check_issue, answer_check_needs_fix
    FROM facts
    ORDER BY id
  `).all()

  db.close()
  console.log(`Scanning ${rows.length.toLocaleString()} rows for heuristic issues...`)

  let flagged = 0
  let clear = 0
  const issueCounts = {}

  for (const row of rows) {
    const issues = baseHeuristicIssues(row)
    if (issues.length > 0) {
      flagged++
      for (const issue of issues) {
        issueCounts[issue] = (issueCounts[issue] || 0) + 1
      }
    } else {
      clear++
    }
  }

  const total = rows.length
  const flaggedPct = total > 0 ? ((flagged / total) * 100).toFixed(2) : '0.00'
  const clearPct = total > 0 ? ((clear / total) * 100).toFixed(2) : '0.00'

  console.log(`\nVerification Results`)
  console.log(`  Total rows:  ${total.toLocaleString()}`)
  console.log(`  Flagged:     ${flagged.toLocaleString()} (${flaggedPct}%)`)
  console.log(`  Clear:       ${clear.toLocaleString()} (${clearPct}%)`)

  // Top issue types
  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  if (topIssues.length > 0) {
    console.log('\n  Top issues:')
    for (const [issue, count] of topIssues) {
      const pct = ((count / total) * 100).toFixed(2)
      console.log(`    [${count.toLocaleString().padStart(7)}] (${pct}%)  ${issue}`)
    }
  }

  // Compare with pre-sweep snapshot in manifest if available
  let preSweeepCounts = null
  try {
    const manifest = await readManifest(outputDir)
    if (manifest.preVerifySnapshot) {
      preSweeepCounts = manifest.preVerifySnapshot
    }
  } catch {
    // No manifest yet — that's fine
  }

  if (preSweeepCounts) {
    const improvement = preSweeepCounts.flagged - flagged
    console.log(`\n  Pre-sweep flagged:  ${preSweeepCounts.flagged.toLocaleString()}`)
    console.log(`  Post-sweep flagged: ${flagged.toLocaleString()}`)
    console.log(`  Improvement:        ${improvement > 0 ? '+' : ''}${improvement.toLocaleString()} rows fixed`)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: 'verify',
    dbPath: rel(dbPath),
    counts: {
      total,
      flagged,
      clear,
      flaggedPct: Number(flaggedPct),
      clearPct: Number(clearPct),
    },
    topIssues: topIssues.map(([issue, count]) => ({ issue, count })),
    preSweeepComparison: preSweeepCounts
      ? {
          preFlagged: preSweeepCounts.flagged,
          postFlagged: flagged,
          improved: preSweeepCounts.flagged - flagged,
        }
      : null,
  }

  const reportPath = path.join(outputDir, 'reports', 'sweep-final.json')
  await writeJson(reportPath, report)
  console.log(`\n  Report written: ${rel(reportPath)}`)
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log([
    'Usage:',
    '  node scripts/content-pipeline/qa/quality-sweep-db.mjs <command> [options]',
    '',
    'Commands:',
    '  export     Read all DB facts, group by domain/language, write batch JSONL files + manifest',
    '  status     Show progress summary from the manifest (pending/done/failed counts)',
    '  apply      Read sweep results from results/ dir, validate, and write back to DB',
    '  verify     Re-scan the entire DB with heuristics and report pre/post improvement',
    '',
    'export options:',
    '  --db <path>                  SQLite DB path (default: public/facts.db)',
    '  --output-dir <dir>           Output directory (default: data/generated/quality-sweep)',
    '  --batch-size-vocab <n>       Rows per batch for vocabulary facts (default: 100)',
    '  --batch-size-knowledge <n>   Rows per batch for knowledge facts (default: 50)',
    '',
    'status options:',
    '  --output-dir <dir>           Output directory (default: data/generated/quality-sweep)',
    '',
    'apply options:',
    '  --db <path>                  SQLite DB path (default: public/facts.db)',
    '  --output-dir <dir>           Output directory (default: data/generated/quality-sweep)',
    '  --dry-run                    Validate and report but do not write to DB',
    '  --fixer <name>               Name recorded in answer_check_fixed_by (default: quality-sweep)',
    '',
    'verify options:',
    '  --db <path>                  SQLite DB path (default: public/facts.db)',
    '  --output-dir <dir>           Output directory (default: data/generated/quality-sweep)',
    '',
    'Examples:',
    '  # Step 1: Export all DB facts into batch files',
    '  node scripts/content-pipeline/qa/quality-sweep-db.mjs export --db public/facts.db',
    '',
    '  # Step 2: Check export progress',
    '  node scripts/content-pipeline/qa/quality-sweep-db.mjs status',
    '',
    '  # Step 3: (Run Sonnet workers to process batches and write results to results/ dir)',
    '',
    '  # Step 4: Apply validated results back to DB (dry run first)',
    '  node scripts/content-pipeline/qa/quality-sweep-db.mjs apply --dry-run',
    '  node scripts/content-pipeline/qa/quality-sweep-db.mjs apply --fixer sonnet-4-5',
    '',
    '  # Step 5: Verify DB convergence',
    '  node scripts/content-pipeline/qa/quality-sweep-db.mjs verify',
  ].join('\n'))
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const { command, args } = parseCli(process.argv)

  if (!VALID_COMMANDS.has(command)) {
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exit(1)
  }

  switch (command) {
    case 'export':
      await cmdExport(args)
      break
    case 'status':
      await cmdStatus(args)
      break
    case 'apply':
      await cmdApply(args)
      break
    case 'verify':
      await cmdVerify(args)
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
    console.error('[quality-sweep-db] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
