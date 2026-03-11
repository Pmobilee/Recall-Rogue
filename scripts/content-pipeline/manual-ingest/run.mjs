#!/usr/bin/env node
/**
 * Manual fact ingestion pipeline — CLI orchestrator.
 * Usage: node scripts/content-pipeline/manual-ingest/run.mjs <command> [options]
 *
 * Commands:
 *   validate       Normalize and validate input facts
 *   dedup          Two-stage dedup against existing data
 *   merge-preview  Preview what merge would produce
 *   finalize       Execute merge (appends to target)
 *   full           Run validate → dedup → merge-preview → finalize
 *   review         Launch interactive review UI for ambiguous matches
 *   build-index    Build/rebuild persistent dedup index from all existing data
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeFactInput,
  validateFactRecord,
  buildCoverageReport,
  levenshteinSimilarity,
} from '../../contentPipelineUtils.mjs'
import {
  normalizeTaxonomyDomain,
  hasSubcategoryTaxonomy,
  isValidSubcategoryId,
  getSubcategoryIds,
  resolveFactTaxonomyDomain,
} from '../subcategory-taxonomy.mjs'
import {
  compositeScore,
  exactDedupKey,
  generateCandidatePairs,
  normalizeText,
} from './similarity.mjs'
import { TFIDFScorer, compositeScoreEnhanced } from './similarity.mjs'
import { DedupIndex } from './dedup-index.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../../..')
let QA_DIR = path.join(ROOT, 'data/generated/qa-reports')

// --- CLI arg parsing ---

function parseArgs(argv) {
  const args = { _command: argv[2] || '' }
  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next === 'true' ? true : next === 'false' ? false : next
        i++
      } else {
        args[key] = true
      }
    }
  }
  return args
}

// --- I/O helpers ---

function loadInput(filePath) {
  const abs = path.resolve(ROOT, filePath)
  const stat = fs.statSync(abs)

  // Directory: scan for .jsonl and .json files
  if (stat.isDirectory()) {
    const all = []
    for (const f of fs.readdirSync(abs).sort()) {
      if (f.endsWith('.jsonl')) {
        const raw = fs.readFileSync(path.join(abs, f), 'utf-8').trim()
        const facts = raw.split('\n').filter(Boolean).map((line, i) => {
          try { return JSON.parse(line) }
          catch { return { _parseError: true, _line: i + 1, _file: f } }
        })
        all.push(...facts)
      } else if (f.endsWith('.json') && !f.includes('report') && !f.includes('pid')) {
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf-8'))
          const arr = Array.isArray(parsed) ? parsed : parsed.data || parsed.results || parsed.facts || []
          all.push(...arr)
        } catch { /* skip unparseable */ }
      }
    }
    return all
  }

  // Single file
  const raw = fs.readFileSync(abs, 'utf-8').trim()
  if (abs.endsWith('.jsonl')) {
    return raw.split('\n').filter(Boolean).map((line, i) => {
      try { return JSON.parse(line) }
      catch { return { _parseError: true, _line: i + 1 } }
    })
  }
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : parsed.data || parsed.results || parsed.facts || [parsed]
}

function loadExistingFacts(paths) {
  const all = []
  for (const p of paths) {
    try {
      const abs = path.resolve(ROOT, p.trim())
      if (!fs.existsSync(abs)) continue
      const stat = fs.statSync(abs)

      if (stat.isDirectory()) {
        for (const f of fs.readdirSync(abs).sort()) {
          const fp = path.join(abs, f)
          try {
            if (f.endsWith('.jsonl')) {
              const raw = fs.readFileSync(fp, 'utf-8').trim()
              all.push(...raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean))
            } else if (f.endsWith('.json') && !f.includes('report') && !f.includes('pid')) {
              const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'))
              const arr = Array.isArray(parsed) ? parsed : parsed.data || parsed.results || parsed.facts || []
              all.push(...arr)
            }
          } catch { /* skip */ }
        }
        continue
      }

      const raw = fs.readFileSync(abs, 'utf-8').trim()
      if (abs.endsWith('.jsonl')) {
        const facts = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
        all.push(...facts)
      } else {
        const parsed = JSON.parse(raw)
        const arr = Array.isArray(parsed) ? parsed : parsed.data || parsed.results || parsed.facts || []
        all.push(...arr)
      }
    } catch (e) {
      console.warn(`  [warn] could not load ${p}: ${e.message}`)
    }
  }
  return all
}

function writeReport(name, data) {
  fs.mkdirSync(QA_DIR, { recursive: true })
  const outPath = path.join(QA_DIR, name)
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n')
  console.log(`  report: ${path.relative(ROOT, outPath)}`)
  return outPath
}

function setQaDir(value) {
  if (!value) return
  QA_DIR = path.resolve(ROOT, value)
}

function nowIso() { return new Date().toISOString() }

function inferDomainFromInputPath(inputPath) {
  if (!inputPath) return null
  const stem = path.basename(String(inputPath), path.extname(String(inputPath))).replaceAll('-', '_')
  if (stem.startsWith('geography_')) return 'geography'
  return normalizeTaxonomyDomain(stem)
}

// --- Default comparison targets (all generated + all seed) ---

function defaultCompareTargets() {
  const targets = []
  const genDir = path.join(ROOT, 'data/generated')
  if (fs.existsSync(genDir)) {
    for (const f of fs.readdirSync(genDir)) {
      if (f.endsWith('.jsonl')) targets.push(path.join('data/generated', f))
    }
  }
  const seedDir = path.join(ROOT, 'src/data/seed')
  if (fs.existsSync(seedDir)) {
    for (const f of fs.readdirSync(seedDir)) {
      if (f.endsWith('.json')) targets.push(path.join('src/data/seed', f))
    }
  }
  return targets
}

// ============ VALIDATE COMMAND ============

function cmdValidate(args) {
  const inputPath = args.input
  if (!inputPath) { console.error('--input required'); process.exit(1) }
  const domain = args.domain || 'auto'
  const requireSubcategory = args['require-subcategory'] !== false && args['require-subcategory'] !== 'false'
  const requestedTaxonomyDomain = domain === 'auto' ? null : normalizeTaxonomyDomain(domain)
  const inferredDomain = inferDomainFromInputPath(inputPath)
  const taxonomyDomainsEnforced = new Set()

  console.log(`[validate] input=${inputPath} domain=${domain} requireSubcategory=${requireSubcategory}`)
  const raw = loadInput(inputPath)
  console.log(`  loaded ${raw.length} records`)

  const valid = []
  const invalid = []
  const flagged = []

  for (let i = 0; i < raw.length; i++) {
    const rec = raw[i]
    if (rec._parseError) {
      flagged.push({ index: i, id: null, errors: [`JSON parse error on line ${rec._line}`], attempts: 1 })
      continue
    }

    let normalized = null
    let attempts = 0
    let lastErrors = []
    let acceptedRecord = false

    // Try normalization up to 3 times with progressive relaxation
    for (let attempt = 0; attempt < 3; attempt++) {
      attempts++
      try {
        const normalizationDomain = domain === 'auto'
          ? (resolveFactTaxonomyDomain(rec, inferredDomain || '') || inferredDomain || 'general_knowledge')
          : domain

        normalized = normalizeFactInput(rec, { domain: normalizationDomain, verify: false })
        const taxonomyDomain = resolveFactTaxonomyDomain(normalized, inferredDomain || '')
        const result = validateFactRecord(normalized)
        const taxonomyErrors = []
        const enforcementDomain = requestedTaxonomyDomain || taxonomyDomain

        if (requireSubcategory && requestedTaxonomyDomain && taxonomyDomain && taxonomyDomain !== requestedTaxonomyDomain) {
          taxonomyDomainsEnforced.add(requestedTaxonomyDomain)
          taxonomyErrors.push(`domain_mismatch:${taxonomyDomain}`)
        }

        if (requireSubcategory && hasSubcategoryTaxonomy(enforcementDomain)) {
          taxonomyDomainsEnforced.add(enforcementDomain)
          if (!isValidSubcategoryId(enforcementDomain, normalized.categoryL2)) {
            taxonomyErrors.push('invalid_or_missing_category_l2')
          }
        }
        const allErrors = [...result.errors, ...taxonomyErrors]

        if (allErrors.length === 0) {
          valid.push({ fact: normalized, warnings: result.warnings })
          acceptedRecord = true
          break
        }
        lastErrors = allErrors

        // categoryL2 taxonomy errors are not auto-fixable in this stage
        if (taxonomyErrors.length > 0) {
          break
        }

        // On retry, try to fix common issues
        if (attempt === 0 && result.errors.includes('variants_below_minimum') && !rec.variants) {
          // Auto-generate minimal variants from quizQuestion
          rec.variants = [
            { question: rec.quizQuestion || rec.statement || '', type: 'forward', correctAnswer: rec.correctAnswer || '' },
            { question: `What is ${rec.correctAnswer || ''}?`, type: 'reverse', correctAnswer: rec.correctAnswer || '' },
          ]
        }
        if (attempt === 1) {
          // last attempt — accept with warnings if only minor issues
          const fatal = result.errors.filter(e => !['variants_below_minimum'].includes(e))
          if (fatal.length === 0) {
            valid.push({ fact: normalized, warnings: [...result.errors, ...result.warnings] })
            break
          }
        }
      } catch (e) {
        lastErrors = [e.message]
      }
      normalized = null
    }

    if (!acceptedRecord) {
      const entry = {
        index: i,
        id: rec.id || null,
        question: rec.quizQuestion || rec.statement || '(unknown)',
        errors: lastErrors,
        attempts,
      }
      const entryDomain = requestedTaxonomyDomain || resolveFactTaxonomyDomain(rec, inferredDomain || '')
      if (requireSubcategory && hasSubcategoryTaxonomy(entryDomain)) {
        entry.domain = entryDomain
        entry.allowedCategoryL2 = getSubcategoryIds(entryDomain)
      }
      if (attempts >= 3) flagged.push(entry)
      else invalid.push(entry)
    }
  }

  const enforcedDomains = [...taxonomyDomainsEnforced]
  const taxonomyDomain = enforcedDomains.length === 1 ? enforcedDomains[0] : null
  const allowedCategoryL2 = taxonomyDomain ? getSubcategoryIds(taxonomyDomain) : []
  const allowedCategoryL2ByDomain = Object.fromEntries(
    enforcedDomains.map((entryDomain) => [entryDomain, getSubcategoryIds(entryDomain)]),
  )

  const validationReport = {
    generatedAt: nowIso(),
    inputFiles: [inputPath],
    domain,
    requireSubcategory,
    taxonomyDomain,
    taxonomyDomainsEnforced: enforcedDomains,
    allowedCategoryL2,
    allowedCategoryL2ByDomain,
    counts: {
      input: raw.length,
      valid: valid.length,
      invalid: invalid.length,
      flagged: flagged.length,
    },
    invalid: invalid.slice(0, 50),
    topExamples: valid.slice(0, 5).map(v => ({ id: v.fact.id, question: v.fact.quizQuestion })),
  }

  const flaggedReport = {
    generatedAt: nowIso(),
    inputFiles: [inputPath],
    counts: { flagged: flagged.length },
    items: flagged,
  }

  writeReport('manual-ingest-validation-report.json', validationReport)
  if (flagged.length > 0) writeReport('manual-ingest-flagged-report.json', flaggedReport)

  console.log(`  valid=${valid.length} invalid=${invalid.length} flagged=${flagged.length}`)
  return { valid: valid.map(v => v.fact), invalid, flagged, validationReport }
}

// ============ DEDUP COMMAND ============

async function cmdDedup(args, inputFacts = null) {
  const inputPath = args.input
  const domain = args.domain || 'general_knowledge'
  const autoThreshold = Number(args['auto-dedup-threshold'] || 0.92)
  const reviewThreshold = Number(args['review-threshold'] || 0.70)
  const dryRun = args['dry-run'] === true || args['dry-run'] === 'true'
  const compareAgainst = args['compare-against']
    ? args['compare-against'].split(',')
    : defaultCompareTargets()

  const useIndex = args['use-index'] === true || args['use-index'] === 'true'
  const useTfidf = args['use-tfidf'] !== 'false' // enabled by default
  console.log(`[dedup] thresholds: auto=${autoThreshold} review=${reviewThreshold} dryRun=${dryRun} tfidf=${useTfidf} index=${useIndex}`)

  // Load input facts (either from prior validate step or from file)
  const candidates = inputFacts || (() => {
    if (!inputPath) { console.error('--input required'); process.exit(1) }
    return loadInput(inputPath).map(r => normalizeFactInput(r, { domain }))
  })()

  // Load existing facts — either from index or from files
  let existing
  let dedupIndex = null
  if (useIndex) {
    dedupIndex = new DedupIndex()
    const loaded = await dedupIndex.load()
    if (loaded && dedupIndex.facts.size > 0) {
      console.log(`  loaded dedup index: ${dedupIndex.facts.size} facts from cache`)
      existing = Array.from(dedupIndex.facts.values())
    } else {
      console.log(`  index empty/missing — loading from files and building`)
      existing = loadExistingFacts(compareAgainst)
      dedupIndex.addFacts(existing)
      await dedupIndex.save()
      console.log(`  built index: ${dedupIndex.stats().factCount} facts`)
    }
  } else {
    console.log(`  comparing against ${compareAgainst.length} target files`)
    existing = loadExistingFacts(compareAgainst)
  }
  console.log(`  loaded ${existing.length} existing facts`)

  // Build TF-IDF scorer if enabled
  let tfidfScorer = null
  if (useTfidf && existing.length > 0) {
    const corpus = [...existing, ...candidates].map(f => f.quizQuestion || f.statement || '')
    tfidfScorer = new TFIDFScorer(corpus)
    console.log(`  built TF-IDF scorer (${corpus.length} documents)`)
  }

  // Build exact key index from existing
  const existingKeys = new Map()
  for (const fact of existing) {
    const key = exactDedupKey(fact)
    if (!existingKeys.has(key)) existingKeys.set(key, fact)
  }

  const exactDupes = []
  const semanticDupes = []
  const needsReview = []
  const accepted = []

  // Phase 1: Check candidates against existing (exact + semantic)
  for (const candidate of candidates) {
    const key = exactDedupKey(candidate)
    const existingMatch = existingKeys.get(key)
    if (existingMatch) {
      exactDupes.push({
        candidateId: candidate.id,
        candidateQuestion: candidate.quizQuestion,
        matchId: existingMatch.id,
        matchQuestion: existingMatch.quizQuestion,
        score: 1.0,
        decision: 'exact_duplicate',
        source: 'existing',
      })
      continue
    }

    // Semantic check against existing
    let bestScore = 0
    let bestMatch = null
    let bestFeatures = null

    for (const ex of existing) {
      const result = tfidfScorer ? compositeScoreEnhanced(candidate, ex, { tfidfScorer }) : compositeScore(candidate, ex)
      if (result.score > bestScore) {
        bestScore = result.score
        bestMatch = ex
        bestFeatures = result.features
      }
    }

    if (bestScore >= autoThreshold && bestMatch) {
      semanticDupes.push({
        candidateId: candidate.id,
        candidateQuestion: candidate.quizQuestion,
        matchId: bestMatch.id,
        matchQuestion: bestMatch.quizQuestion,
        score: bestScore,
        features: bestFeatures,
        decision: 'semantic_duplicate',
        reason: 'above_auto_threshold',
        source: 'existing',
      })
    } else if (bestScore >= reviewThreshold && bestMatch) {
      needsReview.push({
        candidateId: candidate.id,
        candidateQuestion: candidate.quizQuestion,
        candidateAnswer: candidate.correctAnswer,
        matchId: bestMatch.id,
        matchQuestion: bestMatch.quizQuestion,
        matchAnswer: bestMatch.correctAnswer,
        score: bestScore,
        features: bestFeatures,
        decision: 'needs_review',
        reason: 'between_thresholds',
        source: 'existing',
      })
    } else {
      accepted.push(candidate)
    }
  }

  // Phase 2: Intra-batch dedup on accepted candidates
  if (accepted.length > 1) {
    const pairs = generateCandidatePairs(accepted, { trigramThreshold: 0.20 })
    const removedIndices = new Set()

    for (const [i, j] of pairs) {
      if (removedIndices.has(i) || removedIndices.has(j)) continue
      const result = tfidfScorer ? compositeScoreEnhanced(accepted[i], accepted[j], { tfidfScorer }) : compositeScore(accepted[i], accepted[j])
      if (result.score >= autoThreshold) {
        semanticDupes.push({
          candidateId: accepted[j].id,
          candidateQuestion: accepted[j].quizQuestion,
          matchId: accepted[i].id,
          matchQuestion: accepted[i].quizQuestion,
          score: result.score,
          features: result.features,
          decision: 'semantic_duplicate',
          reason: 'intra_batch',
          source: 'batch',
        })
        removedIndices.add(j)
      } else if (result.score >= reviewThreshold) {
        needsReview.push({
          candidateId: accepted[j].id,
          candidateQuestion: accepted[j].quizQuestion,
          candidateAnswer: accepted[j].correctAnswer,
          matchId: accepted[i].id,
          matchQuestion: accepted[i].quizQuestion,
          matchAnswer: accepted[i].correctAnswer,
          score: result.score,
          features: result.features,
          decision: 'needs_review',
          reason: 'intra_batch',
          source: 'batch',
        })
      }
    }

    // Remove intra-batch dupes from accepted
    const filtered = accepted.filter((_, i) => !removedIndices.has(i))
    accepted.length = 0
    accepted.push(...filtered)
  }

  const dedupReport = {
    generatedAt: nowIso(),
    inputFiles: [inputPath || '(from-validate)'],
    domain,
    thresholds: { autoDedup: autoThreshold, review: reviewThreshold },
    counts: {
      input: candidates.length,
      existingCompared: existing.length,
      exactDuplicates: exactDupes.length,
      semanticDuplicates: semanticDupes.length,
      needsReview: needsReview.length,
      accepted: accepted.length,
    },
    exactDuplicates: exactDupes.slice(0, 20),
    semanticDuplicates: semanticDupes.slice(0, 20),
    needsReview: needsReview,
    topAccepted: accepted.slice(0, 5).map(f => ({ id: f.id, question: f.quizQuestion })),
  }

  writeReport('manual-ingest-dedup-report.json', dedupReport)

  console.log(`  exact=${exactDupes.length} semantic=${semanticDupes.length} review=${needsReview.length} accepted=${accepted.length}`)
  return { accepted, exactDupes, semanticDupes, needsReview, dedupReport }
}

// ============ MERGE-PREVIEW COMMAND ============

async function cmdMergePreview(args, acceptedFacts = null) {
  const inputPath = args.input
  const domain = args.domain || 'general_knowledge'
  const target = args.target || `data/generated/${domain}.jsonl`

  const accepted = acceptedFacts || await (async () => {
    // If no pre-deduped facts, run validate + dedup
    const { valid } = cmdValidate(args)
    const { accepted: deduped } = await cmdDedup(args, valid)
    return deduped
  })()

  const targetAbs = path.resolve(ROOT, target)
  const targetExists = fs.existsSync(targetAbs)
  const existingCount = targetExists
    ? fs.readFileSync(targetAbs, 'utf-8').trim().split('\n').filter(Boolean).length
    : 0

  const preview = {
    generatedAt: nowIso(),
    inputFiles: [inputPath || '(pipeline)'],
    target,
    targetExists,
    existingFactsInTarget: existingCount,
    factsToAdd: accepted.length,
    newTotalAfterMerge: existingCount + accepted.length,
    sampleFacts: accepted.slice(0, 10).map(f => ({
      id: f.id,
      question: f.quizQuestion,
      answer: f.correctAnswer,
      domain: f.category?.[0] || domain,
    })),
    coverage: buildCoverageReport(accepted),
  }

  writeReport('manual-ingest-merge-preview.json', preview)
  console.log(`  would add ${accepted.length} facts to ${target} (current: ${existingCount})`)
  return { preview, accepted }
}

// ============ FINALIZE COMMAND ============

async function cmdFinalize(args, acceptedFacts = null) {
  const inputPath = args.input
  const domain = args.domain || 'general_knowledge'
  const target = args.target || `data/generated/${domain}.jsonl`

  const accepted = acceptedFacts || await (async () => {
    const { valid } = cmdValidate(args)
    const { accepted: deduped } = await cmdDedup(args, valid)
    return deduped
  })()

  if (accepted.length === 0) {
    console.log('  no facts to merge — all were duplicates or invalid')
    return { merged: 0 }
  }

  const targetAbs = path.resolve(ROOT, target)

  // Backup existing target
  if (fs.existsSync(targetAbs)) {
    const backupPath = targetAbs + `.backup-${Date.now()}`
    fs.copyFileSync(targetAbs, backupPath)
    console.log(`  backup: ${path.relative(ROOT, backupPath)}`)
  }

  // Append JSONL
  const lines = accepted.map(f => JSON.stringify(f)).join('\n') + '\n'
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true })
  fs.appendFileSync(targetAbs, lines)

  console.log(`  merged ${accepted.length} facts into ${target}`)
  return { merged: accepted.length, target }
}

// ============ FULL PIPELINE ============

async function cmdFull(args) {
  console.log('=== Manual Fact Ingestion Pipeline ===\n')

  console.log('[step 1/4] Validate')
  const { valid, flagged } = cmdValidate(args)

  console.log('\n[step 2/4] Deduplicate')
  const { accepted, needsReview } = await cmdDedup(args, valid)

  console.log('\n[step 3/4] Merge Preview')
  const { preview } = await cmdMergePreview(args, accepted)

  if (args['dry-run']) {
    console.log('\n[dry-run] Skipping finalize')
    return
  }

  console.log('\n[step 4/4] Finalize Merge')
  await cmdFinalize(args, accepted)

  console.log('\n=== Complete ===')
  console.log(`  Valid: ${valid.length} | Accepted: ${accepted.length} | Review: ${needsReview.length} | Flagged: ${flagged.length}`)
}

// ============ REVIEW COMMAND ============

async function cmdReview(args) {
  const port = args.port || '3456'
  const child = (await import('node:child_process')).execFile(
    process.execPath,
    [path.join(__dirname, 'review-server.mjs'), '--port', port],
    { cwd: ROOT, stdio: 'inherit' }
  )
  // Keep alive until Ctrl+C
  process.on('SIGINT', () => { child.kill(); process.exit(0) })
}

// ============ BUILD-INDEX COMMAND ============

async function cmdBuildIndex(args) {
  const compareAgainst = args['compare-against']
    ? args['compare-against'].split(',')
    : defaultCompareTargets()

  console.log('[build-index] Loading facts from all targets...')
  const existing = loadExistingFacts(compareAgainst)
  console.log(`  loaded ${existing.length} facts`)

  const index = new DedupIndex()
  index.addFacts(existing)
  await index.save()

  const stats = index.stats()
  console.log(`  index built: ${stats.factCount} facts, ${stats.exactKeyCount} keys, ${stats.trigramCount} trigrams`)
  console.log(`  saved to: ${path.relative(ROOT, index.indexPath)}`)
}

// ============ MAIN ============

;(async () => {
  const args = parseArgs(process.argv)
  const command = args._command
  setQaDir(args['qa-dir'])

  try {
    switch (command) {
      case 'validate': cmdValidate(args); break
      case 'dedup': await cmdDedup(args); break
      case 'merge-preview': await cmdMergePreview(args); break
      case 'finalize': await cmdFinalize(args); break
      case 'full': await cmdFull(args); break
      case 'review': await cmdReview(args); break
      case 'build-index': await cmdBuildIndex(args); break
      default:
        console.log('Usage: node run.mjs <command> [options]')
        console.log('')
        console.log('Commands:')
        console.log('  validate       Normalize and validate input facts')
        console.log('  dedup          Two-stage dedup against existing data')
        console.log('  merge-preview  Preview what merge would produce')
        console.log('  finalize       Execute merge (appends to target)')
        console.log('  full           Run validate → dedup → merge-preview → finalize')
        console.log('  review         Launch interactive review UI (port 3456)')
        console.log('  build-index    Build persistent dedup index from all existing data')
        console.log('')
        console.log('Options:')
        console.log('  --input <path>              Input JSON or JSONL file')
        console.log('  --domain <name>             Domain name (default: auto)')
        console.log('  --require-subcategory <bool> Require valid taxonomy categoryL2 during validate (default: true)')
        console.log('  --target <path>             Merge target file (default: data/generated/{domain}.jsonl)')
        console.log('  --compare-against <paths>   Comma-separated comparison files')
        console.log('  --auto-dedup-threshold <n>   Score above this = auto-duplicate (default: 0.92)')
        console.log('  --review-threshold <n>       Score above this = needs review (default: 0.70)')
        console.log('  --use-tfidf <bool>          Enable TF-IDF scoring (default: true)')
        console.log('  --use-index                 Use persistent dedup index')
        console.log('  --dry-run                   Skip finalize step in full pipeline')
        console.log('  --qa-dir <path>             Report output directory (default: data/generated/qa-reports)')
        console.log('  --port <n>                  Port for review UI (default: 3456)')
        process.exit(command ? 1 : 0)
    }
  } catch (e) {
    console.error(`[error] ${e.message}`)
    process.exit(1)
  }
})().catch(e => {
  console.error(`[error] ${e.message}`)
  process.exit(1)
})
