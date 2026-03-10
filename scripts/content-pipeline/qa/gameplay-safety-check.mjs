#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, normalizeText, parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const DOMAIN_CATEGORY_HINTS = {
  general_knowledge: ['general knowledge', 'technology', 'mathematics', 'math'],
  natural_sciences: ['natural sciences', 'science'],
  space_astronomy: ['space & astronomy', 'space astronomy'],
  history: ['history'],
  geography: ['geography'],
  mythology_folklore: ['mythology & folklore', 'mythology folklore'],
  animals_wildlife: ['animals & wildlife', 'animals wildlife'],
  human_body_health: ['human body & health', 'life sciences', 'medicine', 'health'],
  food_cuisine: ['food & world cuisine', 'food cuisine'],
  art_architecture: ['art & architecture', 'culture', 'arts'],
}

function isLanguageBucket(name) {
  const lower = String(name || '').toLowerCase()
  return lower.includes('vocab') || /-(ja|es|fr|de|ko|zh|nl|cs)$/.test(lower)
}

function mapShare(count, total) {
  if (total <= 0) return 0
  return Number((count / total).toFixed(4))
}

function encounterDupRisk(uniqueQuestions, encounterSize) {
  const n = Math.max(0, Number(uniqueQuestions) || 0)
  const k = Math.max(0, Number(encounterSize) || 0)
  if (k <= 1) return 0
  if (n === 0 || k > n) return 1

  let noDupProbability = 1
  for (let i = 0; i < k; i += 1) {
    noDupProbability *= (n - i) / n
  }
  return Number((1 - noDupProbability).toFixed(6))
}

function summarizeDomainFacts(domain, facts, encounterSize) {
  const questionCounts = new Map()
  const answerCounts = new Map()
  const difficulty = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  let variantsPassing = 0
  let distractorsPassing = 0
  let sourcePassing = 0
  let categoryHintMatches = 0

  const categoryHints = DOMAIN_CATEGORY_HINTS[domain] || []

  for (const fact of facts) {
    const question = normalizeText(fact?.quizQuestion || fact?.statement || '')
    if (question) {
      questionCounts.set(question, (questionCounts.get(question) ?? 0) + 1)
    }

    const answer = normalizeText(fact?.correctAnswer || '')
    if (answer) {
      answerCounts.set(answer, (answerCounts.get(answer) ?? 0) + 1)
    }

    const difficultyValue = Number(fact?.difficulty)
    if (difficulty[difficultyValue] != null) {
      difficulty[difficultyValue] += 1
    }

    if (Array.isArray(fact?.variants) && fact.variants.length >= 2) {
      variantsPassing += 1
    }

    if (Array.isArray(fact?.distractors) && fact.distractors.length >= 2) {
      distractorsPassing += 1
    }

    if (String(fact?.sourceName || '').trim() && String(fact?.sourceUrl || '').trim()) {
      sourcePassing += 1
    }

    if (categoryHints.length > 0) {
      const categories = Array.isArray(fact?.category) ? fact.category : [fact?.category]
      const normalized = categories.map((value) => normalizeText(value)).filter(Boolean)
      if (normalized.some((value) => categoryHints.includes(value))) {
        categoryHintMatches += 1
      }
    }
  }

  const total = facts.length
  const uniqueQuestions = questionCounts.size
  const duplicateQuestionCount = Math.max(0, total - uniqueQuestions)
  const duplicateQuestionRate = mapShare(duplicateQuestionCount, total)

  let topAnswer = { value: null, count: 0 }
  for (const [value, count] of answerCounts.entries()) {
    if (count > topAnswer.count) {
      topAnswer = { value, count }
    }
  }

  const difficultyBucketsPresent = Object.values(difficulty).filter((value) => value > 0).length

  return {
    total,
    uniqueQuestions,
    duplicateQuestionCount,
    duplicateQuestionRate,
    uniqueAnswers: answerCounts.size,
    topAnswer,
    topAnswerShare: mapShare(topAnswer.count, total),
    variantsCoverage: mapShare(variantsPassing, total),
    distractorsCoverage: mapShare(distractorsPassing, total),
    sourceCoverage: mapShare(sourcePassing, total),
    categoryHintCoverage: categoryHints.length > 0 ? mapShare(categoryHintMatches, total) : null,
    encounterDuplicateRisk: encounterDupRisk(uniqueQuestions, encounterSize),
    difficulty,
    difficultyBucketsPresent,
  }
}

function pushFailure(list, domain, check, actual, expected, reason) {
  list.push({
    domain,
    check,
    actual,
    expected,
    reason,
  })
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'data/generated/qa-reports/gameplay-safety-report.json',
    'knowledge-only': true,
    'min-domain-facts': 120,
    'pool-size': 45,
    'encounter-size': 10,
    'max-duplicate-question-rate': 0.03,
    'max-top-answer-share': 0.12,
    'min-variants-coverage': 0.9,
    'min-distractors-coverage': 0.95,
    'min-source-coverage': 0.95,
    'max-encounter-dup-risk': 0.2,
    'min-difficulty-buckets': 3,
    strict: false,
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const knowledgeOnly = Boolean(args['knowledge-only'])
  const minDomainFacts = Math.max(1, Number(args['min-domain-facts']) || 120)
  const poolSize = Math.max(5, Number(args['pool-size']) || 45)
  const encounterSize = Math.max(2, Number(args['encounter-size']) || 10)
  const maxDuplicateQuestionRate = Math.max(0, Math.min(1, Number(args['max-duplicate-question-rate']) || 0.03))
  const maxTopAnswerShare = Math.max(0, Math.min(1, Number(args['max-top-answer-share']) || 0.12))
  const minVariantsCoverage = Math.max(0, Math.min(1, Number(args['min-variants-coverage']) || 0.9))
  const minDistractorsCoverage = Math.max(0, Math.min(1, Number(args['min-distractors-coverage']) || 0.95))
  const minSourceCoverage = Math.max(0, Math.min(1, Number(args['min-source-coverage']) || 0.95))
  const maxEncounterDupRisk = Math.max(0, Math.min(1, Number(args['max-encounter-dup-risk']) || 0.2))
  const minDifficultyBuckets = Math.max(1, Math.min(5, Number(args['min-difficulty-buckets']) || 3))
  const strict = Boolean(args.strict)

  const files = await listJsonlFiles(inputDir)
  const domainReports = []
  const failures = []

  const globalQuestionCounts = new Map()
  let totalFacts = 0

  for (const file of files) {
    const domain = path.basename(file, '.jsonl')
    if (knowledgeOnly && isLanguageBucket(domain)) {
      continue
    }

    const facts = await loadJsonl(file)
    const summary = summarizeDomainFacts(domain, facts, encounterSize)
    domainReports.push({ domain, ...summary })
    totalFacts += summary.total

    for (const fact of facts) {
      const key = normalizeText(fact?.quizQuestion || fact?.statement || '')
      if (!key) continue
      globalQuestionCounts.set(key, (globalQuestionCounts.get(key) ?? 0) + 1)
    }

    if (summary.total < minDomainFacts) {
      pushFailure(failures, domain, 'min_domain_facts', summary.total, `>= ${minDomainFacts}`, 'domain has too few facts for stable run-pool variety')
    }

    if (summary.total < poolSize) {
      pushFailure(failures, domain, 'pool_size_readiness', summary.total, `>= ${poolSize}`, 'domain cannot fill one full run pool without repeats')
    }

    if (summary.duplicateQuestionRate > maxDuplicateQuestionRate) {
      pushFailure(
        failures,
        domain,
        'duplicate_question_rate',
        summary.duplicateQuestionRate,
        `<= ${maxDuplicateQuestionRate}`,
        'too many exact question repeats can reduce encounter variety',
      )
    }

    if (summary.topAnswerShare > maxTopAnswerShare) {
      pushFailure(
        failures,
        domain,
        'top_answer_share',
        summary.topAnswerShare,
        `<= ${maxTopAnswerShare}`,
        'single answer appears too frequently and may create predictable runs',
      )
    }

    if (summary.variantsCoverage < minVariantsCoverage) {
      pushFailure(
        failures,
        domain,
        'variants_coverage',
        summary.variantsCoverage,
        `>= ${minVariantsCoverage}`,
        'not enough multi-variant questions to avoid repetition in combat',
      )
    }

    if (summary.distractorsCoverage < minDistractorsCoverage) {
      pushFailure(
        failures,
        domain,
        'distractors_coverage',
        summary.distractorsCoverage,
        `>= ${minDistractorsCoverage}`,
        'insufficient distractors can weaken quiz challenge quality',
      )
    }

    if (summary.sourceCoverage < minSourceCoverage) {
      pushFailure(
        failures,
        domain,
        'source_coverage',
        summary.sourceCoverage,
        `>= ${minSourceCoverage}`,
        'facts without sources are unsafe for production promotion',
      )
    }

    if (summary.encounterDuplicateRisk > maxEncounterDupRisk) {
      pushFailure(
        failures,
        domain,
        'encounter_duplicate_risk',
        summary.encounterDuplicateRisk,
        `<= ${maxEncounterDupRisk}`,
        'estimated duplicate risk per encounter is too high',
      )
    }

    if (summary.difficultyBucketsPresent < minDifficultyBuckets) {
      pushFailure(
        failures,
        domain,
        'difficulty_spread',
        summary.difficultyBucketsPresent,
        `>= ${minDifficultyBuckets} buckets populated`,
        'difficulty spread is too narrow for stable run pacing',
      )
    }
  }

  let globalExactQuestionDuplicates = 0
  for (const count of globalQuestionCounts.values()) {
    if (count > 1) globalExactQuestionDuplicates += count - 1
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputDir,
    thresholds: {
      minDomainFacts,
      poolSize,
      encounterSize,
      maxDuplicateQuestionRate,
      maxTopAnswerShare,
      minVariantsCoverage,
      minDistractorsCoverage,
      minSourceCoverage,
      maxEncounterDupRisk,
      minDifficultyBuckets,
      knowledgeOnly,
    },
    summary: {
      domainsChecked: domainReports.length,
      totalFacts,
      globalExactQuestionDuplicates,
      failures: failures.length,
    },
    domains: domainReports,
    failures,
    pass: failures.length === 0,
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify({
    ok: report.pass,
    outputPath,
    domainsChecked: report.summary.domainsChecked,
    failures: report.summary.failures,
    globalExactQuestionDuplicates,
  }, null, 2))

  if (strict && !report.pass) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[gameplay-safety-check] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
