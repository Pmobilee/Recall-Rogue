#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson, normalizeText } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'what', 'which', 'where',
  'when', 'into', 'over', 'under', 'about', 'are', 'was', 'were', 'its',
  'for', 'than', 'then', 'their', 'there', 'have', 'has', 'had', 'can',
  'could', 'would', 'should', 'not', 'true', 'false', 'who', 'why', 'also',
  'called', 'found', 'named', 'world', 'often', 'large', 'small', 'human',
  'water', 'cause', 'makes', 'earth', 'based', 'using', 'comes', 'system',
  'really', 'years', 'point', 'known', 'being', 'these', 'those', 'other',
  'after', 'before', 'during', 'between', 'first', 'every', 'never',
])

/**
 * Extract non-stopword keywords (5+ chars) from text.
 */
function extractKeywords(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w))
}

/**
 * Word count of a string.
 */
function wordCount(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Get distractor text, handling both string and object formats.
 */
function distractorText(d) {
  if (typeof d === 'string') return d
  if (d && typeof d === 'object') return d.text || d.value || ''
  return ''
}

/**
 * Check SELF_ANSWER_FULL: entire correctAnswer appears in quizQuestion.
 */
function checkSelfAnswerFull(fact) {
  const answer = (fact.correctAnswer || '').toLowerCase()
  const question = (fact.quizQuestion || '').toLowerCase()
  if (answer.length < 5) return null
  if (question.includes(answer)) {
    return { answer: fact.correctAnswer }
  }
  return null
}

/**
 * Check SELF_ANSWER_KEYWORD: keyword from correctAnswer appears in quizQuestion.
 */
function checkSelfAnswerKeyword(fact) {
  const questionNorm = normalizeText(fact.quizQuestion || '')
  const keywords = extractKeywords(fact.correctAnswer || '')
  const matched = keywords.filter((kw) => questionNorm.includes(kw))
  if (matched.length > 0) {
    return { matchedKeywords: matched, answer: fact.correctAnswer, question: fact.quizQuestion }
  }
  return null
}

/**
 * Check VARIANT_SELF_ANSWER: keyword from variant correctAnswer appears in variant question.
 */
function checkVariantSelfAnswer(fact) {
  const variants = Array.isArray(fact.variants) ? fact.variants : []
  const hits = []
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    if (!v || typeof v !== 'object' || !v.question) continue
    const questionNorm = normalizeText(v.question)
    const keywords = extractKeywords(v.correctAnswer || '')
    const matched = keywords.filter((kw) => questionNorm.includes(kw))
    if (matched.length > 0) {
      hits.push({ variantIndex: i, matchedKeywords: matched, question: v.question, answer: v.correctAnswer })
    }
  }
  return hits.length > 0 ? hits : null
}

/**
 * Check VARIANT_QA_MISMATCH: variant question asks for a type the answer doesn't provide.
 */
function checkVariantQaMismatch(fact) {
  const variants = Array.isArray(fact.variants) ? fact.variants : []
  const hits = []
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    if (!v || typeof v !== 'object' || !v.question) continue
    const qLower = (v.question || '').toLowerCase().trim()
    const answer = v.correctAnswer || ''
    const hasDigits = /\d/.test(answer)

    // Numeric questions
    if (/^(how many|how much|what number|what percentage)/.test(qLower)) {
      if (!hasDigits && answer.length > 30) {
        hits.push({ variantIndex: i, reason: 'numeric_question_non_numeric_answer', question: v.question, answer })
      }
    }

    // Date questions
    if (/^(when did|when was|what year|in what year)/.test(qLower)) {
      if (!hasDigits && answer.length > 20) {
        hits.push({ variantIndex: i, reason: 'date_question_non_date_answer', question: v.question, answer })
      }
    }

    // Location questions
    if (/^(where|in which city|in which country)/.test(qLower)) {
      // Check if answer looks like a place: short enough OR has capital letter after first word
      const words = answer.trim().split(/\s+/)
      const hasCapitalAfterFirst = words.slice(1).some((w) => /^[A-Z]/.test(w))
      if (answer.length > 40 && !hasCapitalAfterFirst) {
        hits.push({ variantIndex: i, reason: 'location_question_non_place_answer', question: v.question, answer })
      }
    }
  }
  return hits.length > 0 ? hits : null
}

/**
 * Check MALFORMED_VARIANT: variant is a string instead of an object with question property.
 */
function checkMalformedVariant(fact) {
  const variants = Array.isArray(fact.variants) ? fact.variants : []
  const hits = []
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    if (typeof v === 'string') {
      hits.push({ variantIndex: i, value: v })
    } else if (!v || typeof v !== 'object' || !v.question) {
      hits.push({ variantIndex: i, value: v })
    }
  }
  return hits.length > 0 ? hits : null
}

/**
 * Check FORMAT_MISMATCH: answer/distractor word count mismatch.
 */
function checkFormatMismatch(fact) {
  const answerWc = wordCount(fact.correctAnswer)
  const rawDistractors = Array.isArray(fact.distractors) ? fact.distractors : []
  const first4 = rawDistractors.slice(0, 4)
  if (first4.length === 0) return null

  const distractorWcs = first4.map((d) => wordCount(distractorText(d)))
  const avgDistractorWc = distractorWcs.reduce((a, b) => a + b, 0) / distractorWcs.length

  if (answerWc <= 3 && avgDistractorWc > 10) {
    return { answerWordCount: answerWc, avgDistractorWordCount: avgDistractorWc, answer: fact.correctAnswer }
  }
  if (answerWc > 10 && avgDistractorWc <= 3) {
    return { answerWordCount: answerWc, avgDistractorWordCount: avgDistractorWc, answer: fact.correctAnswer }
  }
  return null
}

/**
 * Check DISTRACTOR_COLLISION: a distractor exactly equals the correct answer.
 */
function checkDistractorCollision(fact) {
  const answer = (fact.correctAnswer || '').toLowerCase().trim()
  if (!answer) return null
  const rawDistractors = Array.isArray(fact.distractors) ? fact.distractors : []
  const collisions = []
  for (let i = 0; i < rawDistractors.length; i++) {
    const dText = distractorText(rawDistractors[i]).toLowerCase().trim()
    if (dText === answer) {
      collisions.push({ distractorIndex: i, text: distractorText(rawDistractors[i]) })
    }
  }
  return collisions.length > 0 ? collisions : null
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'src/data/seed/facts-generated.json',
    output: 'data/generated/qa-reports/fact-quality-audit.json',
  })

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))

  const raw = await readJson(inputPath)
  const facts = Array.isArray(raw) ? raw : (raw.facts || [])

  const byIssue = {
    SELF_ANSWER_FULL: 0,
    SELF_ANSWER_KEYWORD: 0,
    VARIANT_SELF_ANSWER: 0,
    VARIANT_QA_MISMATCH: 0,
    MALFORMED_VARIANT: 0,
    FORMAT_MISMATCH: 0,
    DISTRACTOR_COLLISION: 0,
  }

  const items = []

  for (const fact of facts) {
    const issues = []
    const details = {}

    const selfFull = checkSelfAnswerFull(fact)
    if (selfFull) {
      issues.push('SELF_ANSWER_FULL')
      details.SELF_ANSWER_FULL = selfFull
    }

    const selfKeyword = checkSelfAnswerKeyword(fact)
    if (selfKeyword) {
      issues.push('SELF_ANSWER_KEYWORD')
      details.SELF_ANSWER_KEYWORD = selfKeyword
    }

    const variantSelf = checkVariantSelfAnswer(fact)
    if (variantSelf) {
      issues.push('VARIANT_SELF_ANSWER')
      details.VARIANT_SELF_ANSWER = variantSelf
    }

    const variantMismatch = checkVariantQaMismatch(fact)
    if (variantMismatch) {
      issues.push('VARIANT_QA_MISMATCH')
      details.VARIANT_QA_MISMATCH = variantMismatch
    }

    const malformed = checkMalformedVariant(fact)
    if (malformed) {
      issues.push('MALFORMED_VARIANT')
      details.MALFORMED_VARIANT = malformed
    }

    const formatMismatch = checkFormatMismatch(fact)
    if (formatMismatch) {
      issues.push('FORMAT_MISMATCH')
      details.FORMAT_MISMATCH = formatMismatch
    }

    const collision = checkDistractorCollision(fact)
    if (collision) {
      issues.push('DISTRACTOR_COLLISION')
      details.DISTRACTOR_COLLISION = collision
    }

    if (issues.length > 0) {
      for (const issue of issues) {
        byIssue[issue] += 1
      }
      items.push({
        id: fact.id || null,
        issues,
        details,
      })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: facts.length,
      clean: facts.length - items.length,
      flagged: items.length,
      byIssue,
    },
    items,
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify(report.summary, null, 2))
}

main().catch((error) => {
  console.error('[audit-fact-quality] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
