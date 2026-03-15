#!/usr/bin/env node
/**
 * validate-batch.mjs — Validates a batch of generated knowledge facts against all 11 gates.
 *
 * Usage:
 *   node validate-batch.mjs --input data/generated/knowledge/animals-batch-01.json
 *   node validate-batch.mjs --input "data/generated/knowledge/animals-*.json"
 *   node validate-batch.mjs --input data/generated/knowledge/animals-batch-01.json --fix
 *   node validate-batch.mjs --input data/generated/knowledge/animals-batch-01.json --strict
 *   node validate-batch.mjs --input data/generated/knowledge/animals-batch-01.json --entities data/curated/entities.json
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { parseCliArgs, readJson } from '../fetch/shared-utils.mjs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'to', 'for',
  'and', 'or', 'that', 'this', 'it', 'what', 'which', 'how', 'does', 'do', 'did',
])

const DISTRACTOR_BLOCKLIST = new Set([
  'unknown', 'other', 'n/a', 'none', 'all of the above', 'none of the above',
])

const ADULT_KEYWORDS = /\b(death|kill|killed|killing|blood|drug|drugs|weapon|weapons|torture|genocide|massacre|sexual|sex|murder|suicide|execution)\b/i

const CLASSIFICATION_PATTERN = /what (type|kind|category|class|group) of/i

const REQUIRED_STRING_FIELDS = [
  'id', 'type', 'domain', 'subdomain', 'categoryL1', 'categoryL2', 'categoryL3',
  'statement', 'quizQuestion', 'correctAnswer', 'explanation', 'wowFactor',
  'rarity', 'sourceName', 'sourceUrl', 'contentVolatility', 'sensitivityNote',
  'visualDescription',
]

const VALID_AGE_RATINGS = new Set(['kid', 'teen', 'adult'])
const VALID_CONTENT_VOLATILITY = new Set(['timeless', 'current', 'seasonal'])

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Split text into a set of lowercase non-stopword tokens.
 * @param {string} text
 * @returns {Set<string>}
 */
function tokenSet(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0 && !STOPWORDS.has(w)),
  )
}

/**
 * Jaccard similarity between two sets.
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number} 0..1
 */
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  return intersection / (a.size + b.size - intersection)
}

/**
 * Compute standard deviation of a numeric array.
 * @param {number[]} values
 * @returns {{ mean: number, stdDev: number }}
 */
function stats(values) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
  return { mean, stdDev }
}

/**
 * Pad a string to a fixed width.
 * @param {string} s
 * @param {number} width
 * @returns {string}
 */
function padEnd(s, width) {
  return s.length >= width ? s : s + ' '.repeat(width - s.length)
}

// ---------------------------------------------------------------------------
// Glob helper (simple pattern: dir/prefix*.suffix)
// ---------------------------------------------------------------------------

/**
 * Expand a simple glob pattern (supports single trailing * wildcard in filename).
 * @param {string} pattern
 * @returns {string[]}
 */
function expandGlob(pattern) {
  if (!pattern.includes('*')) return [pattern]

  const dir = dirname(pattern)
  const base = basename(pattern)
  const [prefix, suffix] = base.split('*')

  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }

  return entries
    .filter(e => e.startsWith(prefix) && e.endsWith(suffix) && e !== prefix + suffix)
    .map(e => `${dir}/${e}`)
    .sort()
}

// ---------------------------------------------------------------------------
// Per-fact validation gates
// ---------------------------------------------------------------------------

/**
 * G1: Answer length — correctAnswer <= 30 chars AND <= 5 words.
 */
function gateG1(fact) {
  const issues = []
  if (fact.correctAnswer.length > 30) {
    issues.push(`answer too long (${fact.correctAnswer.length} chars, max 30): "${fact.correctAnswer}"`)
  }
  if (fact.correctAnswer.split(/\s+/).filter(Boolean).length > 5) {
    issues.push(`answer too many words (${fact.correctAnswer.split(/\s+/).filter(Boolean).length}, max 5): "${fact.correctAnswer}"`)
  }
  return issues
}

/**
 * G2: Schema validation — all 28 required fields present with correct types.
 */
function gateG2(fact) {
  const issues = []

  // String fields (with special handling for sensitivityNote which can be null)
  for (const field of REQUIRED_STRING_FIELDS) {
    if (field === 'sensitivityNote') {
      if (fact[field] !== null && typeof fact[field] !== 'string') {
        issues.push(`field "${field}" must be string or null, got ${typeof fact[field]}`)
      }
    } else if (typeof fact[field] !== 'string' || (field !== 'sensitivityNote' && fact[field] === '')) {
      if (fact[field] === undefined) {
        issues.push(`missing required field "${field}"`)
      } else if (typeof fact[field] !== 'string') {
        issues.push(`field "${field}" must be string, got ${typeof fact[field]}`)
      }
    }
  }

  // type must be "knowledge"
  if (fact.type !== 'knowledge') {
    issues.push(`field "type" must be "knowledge", got "${fact.type}"`)
  }

  // quizQuestion must end with ?
  if (typeof fact.quizQuestion === 'string' && !fact.quizQuestion.endsWith('?')) {
    issues.push('quizQuestion must end with "?"')
  }

  // distractors: array of 8-12 strings each <= 30 chars
  if (!Array.isArray(fact.distractors)) {
    issues.push('field "distractors" must be an array')
  } else {
    if (fact.distractors.length < 7 || fact.distractors.length > 12) {
      issues.push(`distractors array length must be 7-12, got ${fact.distractors.length}`)
    }
    fact.distractors.forEach((d, i) => {
      if (typeof d !== 'string') issues.push(`distractors[${i}] must be a string`)
      else if (d.length > 30) issues.push(`distractors[${i}] too long (${d.length} chars): "${d}"`)
    })
  }

  // acceptableAnswers: array of strings
  if (!Array.isArray(fact.acceptableAnswers)) {
    issues.push('field "acceptableAnswers" must be an array')
  } else {
    fact.acceptableAnswers.forEach((a, i) => {
      if (typeof a !== 'string') issues.push(`acceptableAnswers[${i}] must be a string`)
    })
  }

  // explanation: 1+ sentences (non-empty string)
  if (typeof fact.explanation === 'string' && fact.explanation.trim().length === 0) {
    issues.push('field "explanation" must be non-empty')
  }

  // variants: array length >= 4
  if (!Array.isArray(fact.variants)) {
    issues.push('field "variants" must be an array')
  } else if (fact.variants.length < 4) {
    issues.push(`variants array length must be >= 4, got ${fact.variants.length}`)
  }

  // numeric fields
  const numericChecks = [
    ['difficulty', 1, 5],
    ['funScore', 1, 10],
    ['noveltyScore', 1, 10],
    ['sensitivityLevel', 0, 5],
  ]
  for (const [field, min, max] of numericChecks) {
    if (fact[field] === undefined) {
      issues.push(`missing required numeric field "${field}"`)
    } else if (typeof fact[field] !== 'number') {
      issues.push(`field "${field}" must be a number, got ${typeof fact[field]}`)
    } else if (fact[field] < min || fact[field] > max) {
      issues.push(`field "${field}" must be ${min}-${max}, got ${fact[field]}`)
    }
  }

  // ageRating
  if (!VALID_AGE_RATINGS.has(fact.ageRating)) {
    issues.push(`field "ageRating" must be "kid"|"teen"|"adult", got "${fact.ageRating}"`)
  }

  // contentVolatility
  if (!VALID_CONTENT_VOLATILITY.has(fact.contentVolatility)) {
    issues.push(`field "contentVolatility" must be "timeless"|"current"|"seasonal", got "${fact.contentVolatility}"`)
  }

  // tags: array of strings
  if (!Array.isArray(fact.tags)) {
    issues.push('field "tags" must be an array')
  } else {
    fact.tags.forEach((t, i) => {
      if (typeof t !== 'string') issues.push(`tags[${i}] must be a string`)
    })
  }

  return issues
}

/**
 * G3: Source attribution — sourceName non-null, non-empty, not "N/A".
 */
function gateG3(fact) {
  if (!fact.sourceName || fact.sourceName.trim() === '' || fact.sourceName.trim().toUpperCase() === 'N/A') {
    return [`invalid sourceName: "${fact.sourceName}""`]
  }
  return []
}

/**
 * G4: Variant count — variants.length >= 4, each has type/question/answer.
 */
function gateG4(fact) {
  const issues = []
  if (!Array.isArray(fact.variants) || fact.variants.length < 4) {
    issues.push(`insufficient variants: ${fact.variants?.length ?? 0} (need >= 4)`)
    return issues
  }
  fact.variants.forEach((v, i) => {
    if (!v.type) issues.push(`variants[${i}] missing "type"`)
    if (!v.question) issues.push(`variants[${i}] missing "question"`)
    if (!v.answer) issues.push(`variants[${i}] missing "answer"`)
  })
  return issues
}

/**
 * G5: Circular detection — Jaccard(question words, answer words) > 0.5.
 */
function gateG5(fact) {
  const qTokens = tokenSet(fact.quizQuestion || '')
  const aTokens = tokenSet(fact.correctAnswer || '')
  const sim = jaccard(qTokens, aTokens)
  if (sim > 0.5) {
    return [`circular: question/answer word overlap too high (Jaccard=${sim.toFixed(2)})`]
  }
  return []
}

/**
 * G6: Duplicate detection — Jaccard(statement words) > 0.85 vs any other fact in batch.
 * @param {object} fact
 * @param {Map<string, Set<string>>} statementTokenCache keyed by fact.id
 * @param {object[]} allFacts
 * @returns {string[]}
 */
function gateG6(fact, statementTokenCache, allFacts) {
  const myTokens = statementTokenCache.get(fact.id)
  for (const other of allFacts) {
    if (other.id === fact.id) continue
    const otherTokens = statementTokenCache.get(other.id)
    if (!otherTokens) continue
    const sim = jaccard(myTokens, otherTokens)
    if (sim > 0.85) {
      return [`duplicate of "${other.id}" (Jaccard statement similarity=${sim.toFixed(2)})`]
    }
  }
  return []
}

/**
 * G7: Classification filter — regex on quizQuestion.
 */
function gateG7(fact) {
  if (CLASSIFICATION_PATTERN.test(fact.quizQuestion || '')) {
    return [`classification question banned: "${fact.quizQuestion}"`]
  }
  return []
}

/**
 * G8: Entity validation — entity label must appear in question/answer/statement/explanation.
 * @param {object} fact
 * @param {string|null} entityLabel
 * @returns {string[]}
 */
function gateG8(fact, entityLabel) {
  if (!entityLabel) return []
  const label = entityLabel.toLowerCase()
  const haystack = [
    fact.quizQuestion, fact.correctAnswer, fact.statement, fact.explanation,
  ].join(' ').toLowerCase()
  if (!haystack.includes(label)) {
    return [`entity "${entityLabel}" not found in fact text`]
  }
  return []
}

/**
 * G9: Distractor quality — each distractor non-empty, != correctAnswer, not on blocklist.
 */
function gateG9(fact) {
  const issues = []
  const correct = (fact.correctAnswer || '').toLowerCase().trim()
  for (const d of (fact.distractors || [])) {
    const dNorm = (d || '').toLowerCase().trim()
    if (!dNorm) {
      issues.push('distractor is empty/whitespace')
    } else if (dNorm === correct) {
      issues.push(`distractor equals correctAnswer: "${d}"`)
    } else if (DISTRACTOR_BLOCKLIST.has(dNorm)) {
      issues.push(`distractor on blocklist: "${d}"`)
    }
  }
  return issues
}

// ---------------------------------------------------------------------------
// Batch-level gates
// ---------------------------------------------------------------------------

/**
 * G10: Fun score distribution check.
 * @param {object[]} facts
 * @returns {string[]} warning messages
 */
function gateG10(facts) {
  const scores = facts.map(f => f.funScore).filter(s => typeof s === 'number')
  if (scores.length === 0) return ['no valid funScore values to analyze']
  const { mean, stdDev } = stats(scores)
  const warnings = []
  if (stdDev < 1.5) {
    warnings.push(`low fun score variance: std_dev=${stdDev.toFixed(2)} (threshold 1.5)`)
  }
  const freq = {}
  for (const s of scores) freq[Math.round(s)] = (freq[Math.round(s)] || 0) + 1
  const maxFreq = Math.max(...Object.values(freq))
  if (maxFreq / scores.length > 0.3) {
    const dominant = Object.entries(freq).find(([, v]) => v === maxFreq)?.[0]
    warnings.push(`>30% of facts share funScore=${dominant} (${maxFreq}/${scores.length})`)
  }
  return warnings
}

/**
 * G11: Age rating consistency — kid-rated facts must not contain adult keywords.
 * @param {object[]} facts
 * @returns {{ id: string, msg: string }[]}
 */
function gateG11(facts) {
  const flagged = []
  for (const f of facts) {
    if (f.ageRating !== 'kid') continue
    const text = [f.statement, f.visualDescription, f.explanation].join(' ')
    if (ADULT_KEYWORDS.test(text)) {
      flagged.push({ id: f.id, msg: `ageRating="kid" but adult keywords found in text` })
    }
  }
  return flagged
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs(process.argv, {
    input: null,
    fix: false,
    strict: false,
    entities: null,
  })

  if (!args.input) {
    console.error('Error: --input <path> is required')
    console.error('Usage: node validate-batch.mjs --input data/generated/knowledge/animals-batch-01.json [--fix] [--strict] [--entities data/curated/entities.json]')
    process.exit(1)
  }

  const inputFiles = expandGlob(String(args.input))
  if (inputFiles.length === 0) {
    console.error(`Error: no files matched pattern "${args.input}"`)
    process.exit(1)
  }

  // Load optional entities map (id -> label)
  let entitiesMap = null
  if (args.entities) {
    try {
      const entitiesData = JSON.parse(readFileSync(String(args.entities), 'utf8'))
      entitiesMap = new Map(Object.entries(entitiesData))
    } catch (e) {
      console.warn(`Warning: could not load entities file "${args.entities}": ${e.message}`)
    }
  }

  let anyHardFailure = false

  for (const inputFile of inputFiles) {
    let facts
    try {
      facts = JSON.parse(readFileSync(inputFile, 'utf8'))
    } catch (e) {
      console.error(`Error reading "${inputFile}": ${e.message}`)
      anyHardFailure = true
      continue
    }

    if (!Array.isArray(facts)) {
      console.error(`Error: "${inputFile}" does not contain a JSON array`)
      anyHardFailure = true
      continue
    }

    // Pre-compute statement token sets for G6 duplicate detection
    const statementTokenCache = new Map()
    for (const f of facts) {
      statementTokenCache.set(f.id, tokenSet(f.statement || ''))
    }

    // Track gate results
    const gateCounters = {
      G1: { pass: 0, fail: 0, rejected: [] },
      G2: { pass: 0, fail: 0, rejected: [] },
      G3: { pass: 0, fail: 0, rejected: [] },
      G4: { pass: 0, fail: 0, rejected: [] },
      G5: { pass: 0, fail: 0, rejected: [] },
      G6: { pass: 0, fail: 0, rejected: [] },
      G7: { pass: 0, fail: 0, rejected: [] },
      G8: { pass: 0, fail: 0, rejected: [] },
      G9: { pass: 0, fail: 0, rejected: [] },
    }

    const hardRejectedIds = new Set()
    const softRejectedIds = new Set()

    for (const fact of facts) {
      const entityLabel = entitiesMap?.get(fact.id) ?? null

      // Hard reject gates
      const hardGates = [
        ['G1', gateG1(fact)],
        ['G2', gateG2(fact)],
        ['G3', gateG3(fact)],
        ['G4', gateG4(fact)],
      ]

      for (const [gate, issues] of hardGates) {
        if (issues.length > 0) {
          gateCounters[gate].fail++
          gateCounters[gate].rejected.push({ id: fact.id, issues })
          hardRejectedIds.add(fact.id)
        } else {
          gateCounters[gate].pass++
        }
      }

      // Soft reject gates
      const softGates = [
        ['G5', gateG5(fact)],
        ['G6', gateG6(fact, statementTokenCache, facts)],
        ['G7', gateG7(fact)],
        ['G8', gateG8(fact, entityLabel)],
        ['G9', gateG9(fact)],
      ]

      for (const [gate, issues] of softGates) {
        if (issues.length > 0) {
          gateCounters[gate].fail++
          gateCounters[gate].rejected.push({ id: fact.id, issues })
          softRejectedIds.add(fact.id)
        } else {
          gateCounters[gate].pass++
        }
      }
    }

    // Batch-level gates
    const g10Warnings = gateG10(facts)
    const g11Flags = gateG11(facts)

    // Statistics
    const funScores = facts.map(f => f.funScore).filter(s => typeof s === 'number')
    const funStats = funScores.length > 0 ? stats(funScores) : { mean: 0, stdDev: 0 }
    const funDist = {}
    funScores.forEach(s => { funDist[s] = (funDist[s] || 0) + 1 })

    const diffDist = {}
    facts.forEach(f => { if (f.difficulty != null) diffDist[f.difficulty] = (diffDist[f.difficulty] || 0) + 1 })

    const subDist = {}
    facts.forEach(f => { if (f.categoryL2) subDist[f.categoryL2] = (subDist[f.categoryL2] || 0) + 1 })

    // Count true hard vs soft exclusive rejects
    const exclusiveSoft = new Set([...softRejectedIds].filter(id => !hardRejectedIds.has(id)))
    const totalHard = hardRejectedIds.size
    const totalSoft = exclusiveSoft.size
    const passingCount = facts.length - hardRejectedIds.size - exclusiveSoft.size
    const passingPct = facts.length > 0 ? ((passingCount / facts.length) * 100).toFixed(1) : '0.0'

    // -----------------------------------------------------------------------
    // Print report
    // -----------------------------------------------------------------------
    const fileName = basename(inputFile)
    console.log(`\n=== Validation Report: ${fileName} ===`)
    console.log(`Total facts: ${facts.length}`)
    console.log('')
    console.log('Gate Results:')

    const gateLabels = {
      G1: 'Answer length:       ',
      G2: 'Schema validation:   ',
      G3: 'Source attribution:  ',
      G4: 'Variant count:       ',
      G5: 'Circular detection:  ',
      G6: 'Duplicate detection: ',
      G7: 'Classification filter:',
      G8: 'Entity validation:   ',
      G9: 'Distractor quality:  ',
    }
    const hardGateKeys = ['G1', 'G2', 'G3', 'G4']
    const softGateKeys = ['G5', 'G6', 'G7', 'G8', 'G9']

    for (const [gate, label] of Object.entries(gateLabels)) {
      const c = gateCounters[gate]
      const isHard = hardGateKeys.includes(gate)
      const isSoft = softGateKeys.includes(gate)
      const total = c.pass + c.fail
      if (c.fail === 0) {
        console.log(`  ${gate}  ${label} ${total}/${total} PASS`)
      } else {
        const status = isHard ? `FAIL (${c.fail} rejected)` : `WARN (${c.fail} flagged)`
        console.log(`  ${gate}  ${label} ${c.pass}/${total} ${status}`)
        for (const r of c.rejected) {
          for (const issue of r.issues) {
            console.log(`        ${r.id}: ${issue}`)
          }
        }
      }
    }

    // G10
    if (g10Warnings.length === 0) {
      console.log(`  G10 Fun score dist:    PASS`)
    } else {
      console.log(`  G10 Fun score dist:    WARN`)
      for (const w of g10Warnings) console.log(`        ${w}`)
    }

    // G11
    if (g11Flags.length === 0) {
      console.log(`  G11 Age rating:        PASS`)
    } else {
      console.log(`  G11 Age rating:        WARN (${g11Flags.length} facts flagged)`)
      for (const f of g11Flags) console.log(`        ${f.id}: ${f.msg}`)
    }

    console.log('')
    console.log(`Hard rejects:  ${totalHard}`)
    console.log(`Soft rejects:  ${totalSoft}`)
    console.log(`Passing facts: ${passingCount} (${passingPct}%)`)
    console.log('')

    // Distribution summaries
    const diffStr = Object.entries(diffDist).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => `${k}:${v}`).join(' ')
    console.log(`Difficulty distribution: ${diffStr || '(none)'}`)
    console.log(`Fun score distribution: mean=${funStats.mean.toFixed(1)} std=${funStats.stdDev.toFixed(2)}`)

    const subStr = Object.entries(subDist).sort(([, a], [, b]) => b - a).map(([k, v]) => `${k}:${v}`).join(' ')
    console.log(`Subcategory distribution: ${subStr || '(none)'}`)

    // --fix: write cleaned output
    if (args.fix) {
      const rejectIds = new Set([...hardRejectedIds, ...softRejectedIds])
      const cleaned = facts.filter(f => !rejectIds.has(f.id))
      const outPath = inputFile.replace(/\.json$/, '-validated.json')
      writeFileSync(outPath, JSON.stringify(cleaned, null, 2) + '\n', 'utf8')
      console.log(`\nFixed output written to: ${outPath} (${cleaned.length} facts retained)`)
    }

    // Determine exit failure
    const hasHardFailures = hardRejectedIds.size > 0
    const hasSoftFailures = softRejectedIds.size > 0 || g10Warnings.length > 0 || g11Flags.length > 0
    if (hasHardFailures || (args.strict && hasSoftFailures)) {
      anyHardFailure = true
    }
  }

  process.exit(anyHardFailure ? 1 : 0)
}

main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
