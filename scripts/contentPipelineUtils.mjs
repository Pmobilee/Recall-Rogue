/**
 * Shared helpers for the content ingestion pipeline (AR-11).
 */

import { normalizeTaxonomyDomain, isValidSubcategoryId } from './content-pipeline/subcategory-taxonomy.mjs'

export const VALID_TYPES = new Set(['fact', 'vocabulary', 'grammar', 'phrase'])
export const VALID_AGE_RATINGS = new Set(['kid', 'teen', 'adult'])

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'under', 'what', 'which', 'where',
  'when', 'who', 'why', 'how', 'does', 'did', 'was', 'were', 'are', 'is', 'be', 'been', 'being', 'about', 'after', 'before',
  'ever',
])

function slug(input) {
  return String(input ?? 'fact')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeDifficulty(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return 2
  return Math.max(1, Math.min(5, parsed))
}

function normalizeAgeRating(value) {
  const normalized = String(value ?? 'teen').toLowerCase()
  return VALID_AGE_RATINGS.has(normalized) ? normalized : 'teen'
}

function normalizeType(value) {
  const normalized = String(value ?? 'fact').toLowerCase()
  return VALID_TYPES.has(normalized) ? normalized : 'fact'
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

const DOMAIN_TO_CATEGORY_LABEL = {
  general_knowledge: 'General Knowledge',
  natural_sciences: 'Natural Sciences',
  space_astronomy: 'Space & Astronomy',
  geography: 'Geography',
  history: 'History',
  mythology_folklore: 'Mythology & Folklore',
  animals_wildlife: 'Animals & Wildlife',
  human_body_health: 'Human Body & Health',
  food_cuisine: 'Food & World Cuisine',
  art_architecture: 'Art & Architecture',
  language: 'Language',
  science: 'Natural Sciences',
  math: 'General Knowledge',
  arts: 'Art & Architecture',
  medicine: 'Human Body & Health',
  technology: 'General Knowledge',
}

function normalizeCategoryToken(value) {
  const text = cleanString(value)
  if (!text) return ''
  const key = text.toLowerCase().replace(/[ -]+/g, '_')
  return DOMAIN_TO_CATEGORY_LABEL[key] || text
}

function toStringArray(values) {
  if (!Array.isArray(values)) return []
  return values
    .map((item) => {
      if (typeof item === 'string') return cleanString(item)
      if (item && typeof item === 'object' && typeof item.text === 'string') return cleanString(item.text)
      return ''
    })
    .filter(Boolean)
}

function normalizeCategory(value, fallbackDomain) {
  const fallback = normalizeCategoryToken(fallbackDomain) || 'General Knowledge'
  if (Array.isArray(value)) {
    const normalized = value.map(normalizeCategoryToken).filter(Boolean)
    return normalized.length > 0 ? normalized : [fallback]
  }
  if (typeof value === 'string') {
    const text = normalizeCategoryToken(value)
    return text ? [text] : [fallback]
  }
  return [fallback]
}

function resolveCategoryL2(rawCategoryL2, category, domain) {
  const canonicalDomain = normalizeTaxonomyDomain(domain || category?.[0] || '')
  if (!canonicalDomain) return ''

  const direct = cleanString(rawCategoryL2)
  if (isValidSubcategoryId(canonicalDomain, direct)) return direct

  const fromCategory = cleanString(Array.isArray(category) ? category[1] : '')
  if (isValidSubcategoryId(canonicalDomain, fromCategory)) return fromCategory

  return ''
}

function normalizeVariants(rawVariants, correctAnswer, distractors) {
  const values = ensureArray(rawVariants)
  if (values.length === 0) return []

  const fallbackDistractors = distractors.slice(0, 3)
  return values
    .map((variant) => {
      if (typeof variant === 'string') {
        const question = cleanString(variant)
        if (!question) return null
        return {
          question,
          type: 'forward',
          correctAnswer,
          distractors: fallbackDistractors,
        }
      }

      if (!variant || typeof variant !== 'object') return null

      const question = cleanString(variant.question ?? variant.prompt ?? variant.text ?? '')
      if (!question) return null

      const type = cleanString(variant.type || 'forward')
      const normalizedType = [
        'forward',
        'reverse',
        'negative',
        'context',
        'fill_blank',
        'true_false',
      ].includes(type) ? type : 'forward'

      const variantDistractors = toStringArray(variant.distractors)
      return {
        question,
        type: normalizedType,
        correctAnswer: cleanString(variant.correctAnswer ?? correctAnswer),
        distractors: variantDistractors.length > 0 ? variantDistractors : fallbackDistractors,
      }
    })
    .filter(Boolean)
}

export function levenshteinDistance(a, b) {
  const left = String(a ?? '')
  const right = String(b ?? '')
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  const matrix = Array.from({ length: right.length + 1 }, () => new Array(left.length + 1).fill(0))
  for (let i = 0; i <= right.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= left.length; j += 1) matrix[0][j] = j

  for (let i = 1; i <= right.length; i += 1) {
    for (let j = 1; j <= left.length; j += 1) {
      const cost = right[i - 1] === left[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[right.length][left.length]
}

export function levenshteinSimilarity(a, b) {
  const left = String(a ?? '')
  const right = String(b ?? '')
  if (left.length === 0 && right.length === 0) return 1
  const maxLen = Math.max(left.length, right.length)
  if (maxLen === 0) return 1
  return (maxLen - levenshteinDistance(left, right)) / maxLen
}

export function extractKeywords(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
}

function keywordOverlapSimilarity(a, b) {
  const left = new Set(extractKeywords(a))
  const right = new Set(extractKeywords(b))
  if (left.size === 0 && right.size === 0) return 1
  if (left.size === 0 || right.size === 0) return 0

  let intersection = 0
  for (const token of left) {
    if (right.has(token)) intersection += 1
  }

  const union = left.size + right.size - intersection
  return union === 0 ? 1 : (intersection / union)
}

export function flagDistractorQuality(fact) {
  const warnings = []
  const correct = cleanString(fact.correctAnswer).toLowerCase()
  const distractors = ensureArray(fact.distractors)

  if (distractors.length < 2) {
    warnings.push('distractors_below_minimum')
  }

  for (const distractor of distractors) {
    const text = cleanString(distractor)
    if (!text) {
      warnings.push('empty_distractor')
      continue
    }
    const normalized = text.toLowerCase()
    if (normalized === correct) {
      warnings.push(`distractor_matches_correct:${text}`)
      continue
    }
    const sim = levenshteinSimilarity(normalized, correct)
    if (sim >= 0.92) {
      warnings.push(`distractor_too_similar:${text}`)
    }
  }

  return warnings
}

export function normalizeFactInput(raw, options = {}) {
  const domain = cleanString(options.domain ?? 'general')
  const statement = cleanString(raw.statement ?? raw.question ?? raw.prompt ?? '')
  const quizQuestion = cleanString(raw.quizQuestion ?? raw.question ?? raw.statement ?? '')
  const answers = ensureArray(raw.answers).map(cleanString).filter(Boolean)
  const correctAnswer = cleanString(raw.correctAnswer ?? raw.answer ?? answers[0] ?? '')

  const rawDistractors = toStringArray(raw.distractors)
  const fallbackDistractors = answers
    .slice(correctAnswer && answers[0] === correctAnswer ? 1 : 0)
    .map(cleanString)
    .filter((answer) => answer && answer !== correctAnswer)

  const distractors = rawDistractors.length > 0 ? rawDistractors : fallbackDistractors
  const category = normalizeCategory(raw.category, domain)
  const categoryL2 = resolveCategoryL2(raw.categoryL2, category, domain)
  const normalizedCategory = category.length > 0 ? [...category] : [domain]
  if (categoryL2) {
    normalizedCategory[1] = categoryL2
  }
  const acceptableAnswers = ensureArray(raw.acceptableAnswers ?? raw.variantAnswers)
    .map(cleanString)
    .filter(Boolean)
  const variants = normalizeVariants(raw.variants, correctAnswer, distractors)

  const id = cleanString(raw.id) || `${slug(domain)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    ...raw,
    id,
    type: normalizeType(raw.type),
    statement,
    explanation: cleanString(raw.explanation ?? raw.reason ?? ''),
    quizQuestion,
    correctAnswer,
    distractors,
    category: normalizedCategory,
    rarity: cleanString(raw.rarity || 'common'),
    difficulty: normalizeDifficulty(raw.difficulty),
    funScore: normalizeDifficulty(raw.funScore ?? 6),
    ageRating: normalizeAgeRating(raw.ageRating),
    sourceName: cleanString(raw.sourceName ?? raw.sourceAttribution ?? raw.source ?? ''),
    sourceUrl: cleanString(raw.sourceUrl ?? ''),
    acceptableAnswers: acceptableAnswers.length > 0 ? acceptableAnswers : [correctAnswer].filter(Boolean),
    variants: variants.length > 0 ? variants : undefined,
    categoryL1: cleanString(raw.categoryL1 || normalizedCategory[0] || domain),
    categoryL2,
    categoryL3: cleanString(raw.categoryL3 || normalizedCategory[2] || ''),
    verifiedAt: options.verify ? nowIso() : (raw.verifiedAt ?? null),
    createdAt: cleanString(raw.createdAt || nowIso()),
  }
}

/**
 * Validates a normalized fact meets minimum quality standards.
 * Called during ingestion — facts that fail are rejected and logged.
 * @param {object} fact - Normalized fact object
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validateFactQuality(fact) {
  const issues = []

  // 1. Question must exist and be meaningful
  const question = fact.quizQuestion || ''
  if (question.length < 10) {
    issues.push('question_too_short: quizQuestion is <10 chars')
  }

  // 2. Answer must exist
  if (!fact.correctAnswer || fact.correctAnswer.trim().length === 0) {
    issues.push('empty_answer: correctAnswer is empty')
  }

  // 3. Knowledge facts need at least 3 distractors (vocab uses runtime generation)
  const distractors = fact.distractors || []
  if (fact.type !== 'vocabulary' && distractors.length < 3) {
    issues.push(`too_few_distractors: ${distractors.length} distractors (need 3+)`)
  }

  // 4. No distractor matches correct answer
  const answer = (fact.correctAnswer || '').trim().toLowerCase()
  for (const d of distractors) {
    if (typeof d === 'string' && d.trim().toLowerCase() === answer) {
      issues.push(`distractor_matches_answer: "${d}"`)
      break
    }
  }

  // 5. No duplicate distractors
  const seen = new Set()
  for (const d of distractors) {
    const norm = typeof d === 'string' ? d.trim().toLowerCase() : ''
    if (norm && seen.has(norm)) {
      issues.push(`duplicate_distractor: "${d}"`)
      break
    }
    if (norm) seen.add(norm)
  }

  // 6. Distractor length spread (knowledge facts only)
  if (fact.type !== 'vocabulary' && distractors.length >= 3) {
    const lengths = distractors.filter(d => typeof d === 'string' && d.trim().length > 0).map(d => d.trim().length)
    if (lengths.length >= 2) {
      const maxLen = Math.max(...lengths)
      const minLen = Math.min(...lengths)
      if (minLen > 0 && maxLen / minLen >= 3.5 && (maxLen - minLen) >= 18) {
        issues.push(`distractor_length_spread: max=${maxLen} min=${minLen} ratio=${(maxLen/minLen).toFixed(1)}`)
      }
    }
  }

  // 7. Distractor type should match answer type
  if (fact.type !== 'vocabulary' && distractors.length >= 3 && answer) {
    const answerIsNumeric = /^\d{1,6}$/.test(answer.trim()) || /^\d{4}\s*(BCE|CE|AD|BC)?$/i.test(answer.trim())
    if (answerIsNumeric) {
      const numericDistractors = distractors.filter(d => typeof d === 'string' && /^\d{1,6}/.test(d.trim()))
      if (numericDistractors.length < distractors.length * 0.5) {
        issues.push('distractor_type_mismatch: numeric answer but non-numeric distractors')
      }
    }
  }

  // 8. Variants use correct field names
  if (Array.isArray(fact.variants)) {
    for (let i = 0; i < fact.variants.length; i++) {
      const v = fact.variants[i]
      if (typeof v === 'string') continue // string variants are OK after normalization
      if (v.quizQuestion && !v.question) {
        issues.push(`variant_wrong_field: variant[${i}] uses quizQuestion instead of question`)
      }
      if (typeof v === 'object' && v !== null && !v.question && !v.quizQuestion) {
        issues.push(`variant_empty_question: variant[${i}] has no question`)
      }
    }
  }

  // 9. Category is present
  if (!fact.category || (Array.isArray(fact.category) && fact.category.length === 0)) {
    issues.push('missing_category: no category assigned')
  }

  return { valid: issues.length === 0, issues }
}

export function validateFactRecord(fact) {
  const errors = []
  const warnings = []

  if (!fact.statement || fact.statement.length < 10) errors.push('statement_too_short')
  if (!fact.quizQuestion || fact.quizQuestion.length < 10) errors.push('quiz_question_too_short')
  if (!fact.correctAnswer) errors.push('missing_correct_answer')
  if (!Array.isArray(fact.distractors) || fact.distractors.length < 2) errors.push('distractors_below_minimum')
  if (!Array.isArray(fact.variants) || fact.variants.length < 2) errors.push('variants_below_minimum')
  if (!fact.sourceName) errors.push('missing_source_name')
  if (!VALID_TYPES.has(fact.type)) errors.push('invalid_type')
  if (!VALID_AGE_RATINGS.has(fact.ageRating)) errors.push('invalid_age_rating')

  if (!Array.isArray(fact.acceptableAnswers) || fact.acceptableAnswers.length < 2) {
    warnings.push('variant_answers_below_recommended')
  }

  // Check for variants that copied the base answer without adapting it
  if (Array.isArray(fact.variants)) {
    const baseQ = (fact.quizQuestion || '').toLowerCase().trim()
    const baseA = (fact.correctAnswer || '').toLowerCase().trim()
    let copiedCount = 0
    for (const v of fact.variants) {
      const vq = (v.question || '').toLowerCase().trim()
      const va = (v.correctAnswer || '').toLowerCase().trim()
      if (va === baseA && vq !== baseQ) copiedCount++
    }
    if (copiedCount > 0) {
      warnings.push(`variant_answer_copied_from_base:${copiedCount}`)
    }
  }

  warnings.push(...flagDistractorQuality(fact))
  return { valid: errors.length === 0, errors, warnings }
}

export function detectDuplicateQuestions(candidates, existingFacts, threshold = 0.85) {
  const existingQuestions = existingFacts
    .map((fact) => cleanString(fact.quizQuestion ?? fact.statement))
    .filter(Boolean)

  const accepted = []
  const duplicates = []

  for (const candidate of candidates) {
    const question = cleanString(candidate.quizQuestion ?? candidate.statement)
    if (!question) {
      duplicates.push({
        question: '',
        matchedQuestion: '',
        similarity: 1,
        reason: 'missing_question',
      })
      continue
    }

    let bestSimilarity = 0
    let bestMatch = ''

    for (const seen of [...existingQuestions, ...accepted]) {
      const normalizedQuestion = question.toLowerCase()
      const normalizedSeen = seen.toLowerCase()
      const charSimilarity = levenshteinSimilarity(normalizedQuestion, normalizedSeen)
      const keywordSimilarity = keywordOverlapSimilarity(normalizedQuestion, normalizedSeen)
      const sim = Math.max(charSimilarity, keywordSimilarity)
      if (sim > bestSimilarity) {
        bestSimilarity = sim
        bestMatch = seen
      }
    }

    if (bestSimilarity >= threshold) {
      duplicates.push({
        question,
        matchedQuestion: bestMatch,
        similarity: Number(bestSimilarity.toFixed(4)),
        reason: 'fuzzy_duplicate',
      })
      continue
    }

    accepted.push(question)
  }

  return duplicates
}

export function buildCoverageReport(facts) {
  const byCategory = {}
  const byDifficulty = {}
  const byType = {}
  const byAgeRating = {}
  const byVerification = { verified: 0, unverified: 0 }
  const distractorWarnings = []

  for (const fact of facts) {
    const category = fact.categoryL1 || fact.category?.[0] || 'Unknown'
    byCategory[category] = (byCategory[category] ?? 0) + 1

    const difficulty = String(fact.difficulty ?? 'unknown')
    byDifficulty[difficulty] = (byDifficulty[difficulty] ?? 0) + 1

    const type = fact.type || 'fact'
    byType[type] = (byType[type] ?? 0) + 1

    const age = fact.ageRating || 'teen'
    byAgeRating[age] = (byAgeRating[age] ?? 0) + 1

    if (fact.verifiedAt) byVerification.verified += 1
    else byVerification.unverified += 1

    const warnings = flagDistractorQuality(fact)
    if (warnings.length > 0) {
      distractorWarnings.push({
        id: fact.id,
        warnings,
      })
    }
  }

  const totalFacts = facts.length
  const withSource = facts.filter((fact) => cleanString(fact.sourceName).length > 0).length

  return {
    generatedAt: nowIso(),
    totalFacts,
    withSource,
    sourceCoveragePct: totalFacts > 0 ? Number(((withSource / totalFacts) * 100).toFixed(2)) : 0,
    byCategory,
    byDifficulty,
    byType,
    byAgeRating,
    byVerification,
    distractorWarnings,
  }
}
