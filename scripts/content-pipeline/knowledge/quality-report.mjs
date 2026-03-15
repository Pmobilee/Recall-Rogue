#!/usr/bin/env node
/**
 * quality-report.mjs — Aggregate quality report for generated knowledge fact batches
 *
 * Usage:
 *   node quality-report.mjs --domain animals_wildlife
 *   node quality-report.mjs                              # all domains
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { readJson, parseCliArgs } from '../fetch/shared-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const MANIFEST_PATH = path.join(__dirname, 'manifest.json')
const GENERATED_DIR = path.join(REPO_ROOT, 'data/generated/knowledge')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jaccard(a, b) {
  const setA = new Set(a.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/))
  const setB = new Set(b.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/))
  const intersection = [...setA].filter(x => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function mean(arr) {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

function stdDev(arr) {
  if (arr.length === 0) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function pad(str, width) {
  return String(str).padEnd(width)
}

function lpad(str, width) {
  return String(str).padStart(width)
}

function bar(count, max, width = 20) {
  const filled = max === 0 ? 0 : Math.round((count / max) * width)
  return '[' + '#'.repeat(filled) + ' '.repeat(width - filled) + ']'
}

function pct(num, denom) {
  return denom === 0 ? '—' : `${((num / denom) * 100).toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

async function findBatchFiles(domainPrefix) {
  let entries
  try {
    entries = await fs.readdir(GENERATED_DIR)
  } catch {
    return []
  }
  return entries
    .filter(f => f.startsWith(domainPrefix + '-') && f.endsWith('.json') && f !== 'manifest.json')
    .sort()
    .map(f => path.join(GENERATED_DIR, f))
}

// ---------------------------------------------------------------------------
// Per-domain analysis
// ---------------------------------------------------------------------------

async function analyzeDomain(domainKey, domainConfig) {
  const { domainPrefix, displayName, targetFacts, subcategoryDistribution } = domainConfig

  const files = await findBatchFiles(domainPrefix)
  if (files.length === 0) {
    return { domainKey, displayName, domainPrefix, targetFacts, totalFacts: 0, files: [], facts: null }
  }

  const allFacts = []
  const seenIds = new Set()

  for (const file of files) {
    let batch
    try {
      batch = await readJson(file)
    } catch (e) {
      console.error(`  [warn] Could not parse ${path.basename(file)}: ${e.message}`)
      continue
    }
    if (!Array.isArray(batch)) continue
    for (const f of batch) {
      if (!seenIds.has(f.id)) {
        seenIds.add(f.id)
        allFacts.push(f)
      }
    }
  }

  // --- Distributions ---
  const diffDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const funDist = {}
  for (let i = 1; i <= 10; i++) funDist[i] = 0
  const ageDist = { kid: 0, teen: 0, adult: 0 }
  const subDist = {}
  let withSourceName = 0
  let withSourceUrl = 0
  let totalDistractors = 0
  let totalVariants = 0
  let classificationCount = 0
  let circularCount = 0
  const funScores = []

  for (const f of allFacts) {
    if (diffDist[f.difficulty] !== undefined) diffDist[f.difficulty]++
    if (f.funScore >= 1 && f.funScore <= 10) {
      funDist[f.funScore]++
      funScores.push(f.funScore)
    }
    const age = f.ageRating?.toLowerCase()
    if (ageDist[age] !== undefined) ageDist[age]++
    const sub = f.categoryL2 || 'unknown'
    subDist[sub] = (subDist[sub] || 0) + 1
    if (f.sourceName) withSourceName++
    if (f.sourceUrl) withSourceUrl++
    if (Array.isArray(f.distractors)) totalDistractors += f.distractors.length
    if (Array.isArray(f.variants)) totalVariants += f.variants.length
    if (/what (type|kind|category) of/i.test(f.quizQuestion || '')) classificationCount++
    if (jaccard(f.quizQuestion || '', f.correctAnswer || '') > 0.5) circularCount++
  }

  const n = allFacts.length

  return {
    domainKey,
    displayName,
    domainPrefix,
    targetFacts,
    totalFacts: n,
    files,
    subcategoryDistribution,
    diffDist,
    funDist,
    funMean: mean(funScores),
    funStd: stdDev(funScores),
    ageDist,
    subDist,
    withSourceName,
    withSourceUrl,
    avgDistractors: n === 0 ? 0 : totalDistractors / n,
    avgVariants: n === 0 ? 0 : totalVariants / n,
    classificationCount,
    circularCount,
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function printDomainReport(r) {
  const sep = '─'.repeat(70)
  const n = r.totalFacts

  console.log(`\n${sep}`)
  console.log(`  ${r.displayName}  [${r.domainKey}]`)
  console.log(sep)

  if (n === 0) {
    console.log('  No batch files found.')
    return
  }

  console.log(`  Files loaded : ${r.files.map(f => path.basename(f)).join(', ')}`)
  console.log(`  Facts        : ${n} / ${r.targetFacts} target  (${pct(n, r.targetFacts)} complete)`)

  // Difficulty histogram
  console.log(`\n  Difficulty distribution (1=easy … 5=hard):`)
  const maxDiff = Math.max(...Object.values(r.diffDist))
  for (let d = 1; d <= 5; d++) {
    const cnt = r.diffDist[d]
    console.log(`    ${d}  ${bar(cnt, maxDiff, 24)}  ${lpad(cnt, 4)}  (${pct(cnt, n)})`)
  }

  // Fun score histogram
  console.log(`\n  Fun score distribution (1–10):  mean=${r.funMean.toFixed(2)}  σ=${r.funStd.toFixed(2)}`)
  const maxFun = Math.max(...Object.values(r.funDist))
  for (let s = 1; s <= 10; s++) {
    const cnt = r.funDist[s]
    console.log(`    ${lpad(s, 2)}  ${bar(cnt, maxFun, 24)}  ${lpad(cnt, 4)}  (${pct(cnt, n)})`)
  }

  // Age rating
  console.log(`\n  Age ratings:  kid=${r.ageDist.kid}  teen=${r.ageDist.teen}  adult=${r.ageDist.adult}`)

  // Subcategory distribution
  const quotas = r.subcategoryDistribution || {}
  const hasQuotas = Object.keys(quotas).length > 0
  console.log(`\n  Subcategory distribution${hasQuotas ? ' (vs quota target)' : ''}:`)
  const allSubs = new Set([...Object.keys(r.subDist), ...Object.keys(quotas)])
  for (const sub of [...allSubs].sort()) {
    const cnt = r.subDist[sub] || 0
    const quota = quotas[sub]
    const quotaStr = quota != null ? `  target: ${quota}` : ''
    console.log(`    ${pad(sub, 28)}  ${lpad(cnt, 4)}${quotaStr}`)
  }

  // Source coverage
  console.log(`\n  Source coverage:`)
  console.log(`    sourceName  ${lpad(r.withSourceName, 4)} / ${n}  (${pct(r.withSourceName, n)})`)
  console.log(`    sourceUrl   ${lpad(r.withSourceUrl, 4)} / ${n}  (${pct(r.withSourceUrl, n)})`)

  // Average counts
  console.log(`\n  Avg distractors per fact : ${r.avgDistractors.toFixed(2)}`)
  console.log(`  Avg variants per fact    : ${r.avgVariants.toFixed(2)}`)

  // Quality flags
  console.log(`\n  Quality flags:`)
  console.log(`    Classification questions ("what type/kind of…")  : ${r.classificationCount}  (${pct(r.classificationCount, n)})`)
  console.log(`    Circular answers (Jaccard q↔a > 0.5)             : ${r.circularCount}  (${pct(r.circularCount, n)})`)
}

function printCrossDomainSummary(results) {
  const sep = '═'.repeat(70)
  console.log(`\n${sep}`)
  console.log('  CROSS-DOMAIN SUMMARY')
  console.log(sep)

  const totalFacts = results.reduce((s, r) => s + r.totalFacts, 0)
  const totalTarget = results.reduce((s, r) => s + r.targetFacts, 0)
  let totalClassification = 0
  let totalCircular = 0

  console.log(`\n  ${'Domain'.padEnd(30)}  ${'Facts'.padStart(6)}  ${'Target'.padStart(6)}  ${'Complete'.padStart(9)}`)
  console.log('  ' + '─'.repeat(58))

  for (const r of results) {
    const status = r.totalFacts === 0 ? '—' : pct(r.totalFacts, r.targetFacts)
    console.log(`  ${pad(r.displayName, 30)}  ${lpad(r.totalFacts, 6)}  ${lpad(r.targetFacts, 6)}  ${lpad(status, 9)}`)
    totalClassification += r.classificationCount || 0
    totalCircular += r.circularCount || 0
  }

  console.log('  ' + '─'.repeat(58))
  console.log(`  ${'TOTAL'.padEnd(30)}  ${lpad(totalFacts, 6)}  ${lpad(totalTarget, 6)}  ${lpad(pct(totalFacts, totalTarget), 9)}`)

  // Overall quality score: % facts passing all hard gates
  const hardGatePass = results.reduce((s, r) => {
    if (!r.facts && r.totalFacts === 0) return s
    return s + (r.totalFacts - (r.classificationCount || 0) - (r.circularCount || 0))
  }, 0)

  console.log(`\n  Overall classification issues  : ${totalClassification}`)
  console.log(`  Overall circular answer issues : ${totalCircular}`)
  if (totalFacts > 0) {
    const passCount = totalFacts - totalClassification - totalCircular
    console.log(`  Overall quality pass rate      : ${pct(passCount, totalFacts)}  (${passCount} / ${totalFacts} facts clean)`)
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = parseCliArgs(process.argv, {})
const domainFilter = args.domain || null

let manifest
try {
  manifest = await readJson(MANIFEST_PATH)
} catch (e) {
  console.error(`Could not read manifest at ${MANIFEST_PATH}: ${e.message}`)
  process.exit(1)
}

const domains = manifest.domains
const domainKeys = domainFilter
  ? [domainFilter]
  : Object.keys(domains)

// Validate requested domain
if (domainFilter && !domains[domainFilter]) {
  console.error(`Unknown domain: "${domainFilter}". Available: ${Object.keys(domains).join(', ')}`)
  process.exit(1)
}

console.log(`\nRecall Rogue — Knowledge Quality Report`)
console.log(`Generated: ${new Date().toISOString()}`)
if (domainFilter) console.log(`Domain filter: ${domainFilter}`)

const results = []
for (const key of domainKeys) {
  const config = domains[key]
  const r = await analyzeDomain(key, config)
  results.push(r)
  printDomainReport(r)
}

if (results.length > 1) {
  printCrossDomainSummary(results)
}
