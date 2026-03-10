/**
 * Manual fact ingestion — similarity utilities.
 * Zero external dependencies. Deterministic scoring.
 */

import { levenshteinSimilarity, extractKeywords } from '../../contentPipelineUtils.mjs'

// --- Trigram similarity ---

export function charTrigrams(text) {
  const s = String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (s.length < 3) return new Set()
  const trigrams = new Set()
  for (let i = 0; i <= s.length - 3; i++) {
    trigrams.add(s.slice(i, i + 3))
  }
  return trigrams
}

// CJK Unicode ranges for detection
const CJK_REGEX = /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/

/** Detect if text contains CJK characters */
export function hasCJK(text) {
  return CJK_REGEX.test(String(text ?? ''))
}

/** Character bigrams for CJK text (each char carries more semantic weight) */
export function cjkCharBigrams(text) {
  const s = String(text ?? '').replace(/\s+/g, '')
  if (s.length < 2) return new Set()
  const bigrams = new Set()
  for (let i = 0; i <= s.length - 2; i++) {
    bigrams.add(s.slice(i, i + 2))
  }
  return bigrams
}

/**
 * Extract keywords from CJK text using character n-grams.
 * For CJK, individual characters and 2-char combinations are "keywords".
 */
export function extractCJKTokens(text) {
  const s = String(text ?? '')
  const tokens = new Set()
  // Individual CJK characters
  for (const ch of s) {
    if (CJK_REGEX.test(ch)) tokens.add(ch)
  }
  // 2-char windows
  for (let i = 0; i < s.length - 1; i++) {
    const pair = s.slice(i, i + 2)
    if (CJK_REGEX.test(pair)) tokens.add(pair)
  }
  return tokens
}

export function trigramSimilarity(a, b) {
  const textA = String(a ?? '')
  const textB = String(b ?? '')
  // Use bigrams for CJK text
  if (hasCJK(textA) || hasCJK(textB)) {
    const ba = cjkCharBigrams(textA)
    const bb = cjkCharBigrams(textB)
    if (ba.size === 0 && bb.size === 0) return 1
    if (ba.size === 0 || bb.size === 0) return 0
    let intersection = 0
    for (const t of ba) { if (bb.has(t)) intersection++ }
    const union = ba.size + bb.size - intersection
    return union === 0 ? 1 : intersection / union
  }
  const ta = charTrigrams(a)
  const tb = charTrigrams(b)
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) {
    if (tb.has(t)) intersection++
  }
  const union = ta.size + tb.size - intersection
  return union === 0 ? 1 : intersection / union
}

// --- Keyword Jaccard ---

export function keywordJaccard(a, b) {
  const textA = String(a ?? '')
  const textB = String(b ?? '')
  // Use CJK token extraction for CJK text
  if (hasCJK(textA) || hasCJK(textB)) {
    const ka = extractCJKTokens(textA)
    const kb = extractCJKTokens(textB)
    // Also add latin keywords if present
    for (const k of extractKeywords(textA)) ka.add(k)
    for (const k of extractKeywords(textB)) kb.add(k)
    if (ka.size === 0 && kb.size === 0) return 1
    if (ka.size === 0 || kb.size === 0) return 0
    let intersection = 0
    for (const k of ka) { if (kb.has(k)) intersection++ }
    const union = ka.size + kb.size - intersection
    return union === 0 ? 1 : intersection / union
  }
  const ka = new Set(extractKeywords(a))
  const kb = new Set(extractKeywords(b))
  if (ka.size === 0 && kb.size === 0) return 1
  if (ka.size === 0 || kb.size === 0) return 0
  let intersection = 0
  for (const k of ka) {
    if (kb.has(k)) intersection++
  }
  const union = ka.size + kb.size - intersection
  return union === 0 ? 1 : intersection / union
}

// --- Composite similarity scoring ---

const DEFAULT_WEIGHTS = {
  exactKey: 1.0,    // binary — if exact key matches, score is 1.0 immediately
  trigram: 0.25,
  keyword: 0.30,
  levenshtein: 0.20,
  answer: 0.15,
  statement: 0.10,
}

export function normalizeText(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function exactDedupKey(fact) {
  return `${normalizeText(fact.statement)}::${normalizeText(fact.correctAnswer)}`
}

/**
 * Compute composite similarity between two facts.
 * Returns { score, features, isExactMatch }
 */
export function compositeScore(factA, factB, weights = DEFAULT_WEIGHTS) {
  // Check exact key match first
  const keyA = exactDedupKey(factA)
  const keyB = exactDedupKey(factB)
  if (keyA === keyB) {
    return {
      score: 1.0,
      features: { exactKey: 1, trigram: 1, keyword: 1, levenshtein: 1, answer: 1, statement: 1 },
      isExactMatch: true,
    }
  }

  const qA = factA.quizQuestion || factA.statement || ''
  const qB = factB.quizQuestion || factB.statement || ''

  const features = {
    exactKey: 0,
    trigram: trigramSimilarity(qA, qB),
    keyword: keywordJaccard(qA, qB),
    levenshtein: levenshteinSimilarity(qA, qB),
    answer: levenshteinSimilarity(factA.correctAnswer || '', factB.correctAnswer || ''),
    statement: keywordJaccard(factA.statement || '', factB.statement || ''),
  }

  // Weighted sum (excluding exactKey which is binary gate)
  const totalWeight = weights.trigram + weights.keyword + weights.levenshtein + weights.answer + weights.statement
  let score = (
    features.trigram * weights.trigram +
    features.keyword * weights.keyword +
    features.levenshtein * weights.levenshtein +
    features.answer * weights.answer +
    features.statement * weights.statement
  ) / totalWeight

  // Answer-match boost: when answers are nearly identical AND questions share
  // meaningful overlap, boost the score. Identical answers are a strong signal
  // for quiz-style content — two questions with the same answer are likely asking
  // the same thing even if phrased differently.
  if (features.answer >= 0.90) {
    const questionOverlap = Math.max(features.trigram, features.keyword, features.levenshtein)
    if (questionOverlap >= 0.30) {
      // Boost: blend toward a higher floor based on answer + question signals
      const boost = 0.15 + (questionOverlap * 0.25)
      score = Math.min(1.0, score + boost)
    }
  }

  return { score: Number(score.toFixed(4)), features, isExactMatch: false }
}

/**
 * Stage A: Generate candidate pairs using cheap filters.
 * Uses trigram blocking — only compare facts that share at least 1 trigram
 * or are in the same domain (if domainBlocking=true).
 * Returns array of [indexA, indexB] pairs.
 */
export function generateCandidatePairs(facts, { domainBlocking = false, trigramThreshold = 0.15 } = {}) {
  const pairs = []
  // Build trigram index for blocking
  const trigramIndex = new Map() // trigram -> [factIndex, ...]

  for (let i = 0; i < facts.length; i++) {
    const q = facts[i].quizQuestion || facts[i].statement || ''
    const trigrams = charTrigrams(q)
    for (const t of trigrams) {
      if (!trigramIndex.has(t)) trigramIndex.set(t, [])
      trigramIndex.get(t).push(i)
    }
  }

  // Collect candidate pairs from shared trigrams
  const seen = new Set()
  for (const indices of trigramIndex.values()) {
    if (indices.length > 100) continue // skip very common trigrams
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const i = indices[a]
        const j = indices[b]
        const pairKey = i < j ? `${i}:${j}` : `${j}:${i}`
        if (seen.has(pairKey)) continue
        seen.add(pairKey)

        // Domain blocking: only compare within same domain if enabled
        if (domainBlocking) {
          const domA = facts[i].category?.[0] || facts[i].domain || ''
          const domB = facts[j].category?.[0] || facts[j].domain || ''
          if (domA && domB && domA !== domB) continue
        }

        // Quick trigram pre-filter
        const sim = trigramSimilarity(
          facts[i].quizQuestion || facts[i].statement || '',
          facts[j].quizQuestion || facts[j].statement || ''
        )
        if (sim >= trigramThreshold) {
          pairs.push([i, j])
        }
      }
    }
  }

  return pairs
}

// ============ TF-IDF Cosine Similarity ============

/**
 * Tokenize text for TF-IDF. Handles both Latin and CJK.
 */
function tfidfTokenize(text) {
  const s = String(text ?? '').toLowerCase()
  const tokens = []
  // Latin tokens (4+ chars, no stopwords)
  tokens.push(...extractKeywords(s))
  // CJK tokens if present
  if (hasCJK(s)) {
    for (const t of extractCJKTokens(s)) tokens.push(t)
  }
  return tokens
}

/**
 * Build IDF (Inverse Document Frequency) from a corpus of texts.
 * Returns Map<token, idf_value>
 */
export function buildIDF(texts) {
  const N = texts.length
  if (N === 0) return new Map()
  const docFreq = new Map()
  for (const text of texts) {
    const unique = new Set(tfidfTokenize(text))
    for (const token of unique) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1)
    }
  }
  const idf = new Map()
  for (const [token, df] of docFreq) {
    idf.set(token, Math.log((N + 1) / (df + 1)) + 1) // smoothed IDF
  }
  return idf
}

/**
 * Compute TF-IDF vector for a single text given pre-built IDF.
 * Returns Map<token, tfidf_value>
 */
function tfidfVector(text, idf) {
  const tokens = tfidfTokenize(text)
  if (tokens.length === 0) return new Map()
  // Term frequency
  const tf = new Map()
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1)
  }
  // Normalize TF and multiply by IDF
  const vec = new Map()
  for (const [term, count] of tf) {
    const normalizedTf = count / tokens.length
    const idfVal = idf.get(term) || 1
    vec.set(term, normalizedTf * idfVal)
  }
  return vec
}

/**
 * Cosine similarity between two TF-IDF vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.size === 0 || vecB.size === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (const [term, valA] of vecA) {
    normA += valA * valA
    const valB = vecB.get(term) || 0
    dot += valA * valB
  }
  for (const [, valB] of vecB) {
    normB += valB * valB
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * TF-IDF scorer class. Build once from corpus, score many pairs.
 *
 * Usage:
 *   const scorer = new TFIDFScorer(allFacts.map(f => f.quizQuestion))
 *   const sim = scorer.similarity('What is gold?', 'What element is Au?')
 */
export class TFIDFScorer {
  constructor(corpusTexts) {
    this.idf = buildIDF(corpusTexts)
    this._cache = new Map()
  }

  _getVector(text) {
    if (!this._cache.has(text)) {
      this._cache.set(text, tfidfVector(text, this.idf))
    }
    return this._cache.get(text)
  }

  similarity(textA, textB) {
    return cosineSimilarity(this._getVector(textA), this._getVector(textB))
  }

  clearCache() {
    this._cache.clear()
  }
}

/**
 * Enhanced composite scoring that includes TF-IDF when a scorer is provided.
 * Drop-in replacement for compositeScore with optional tfidfScorer param.
 */
export function compositeScoreEnhanced(factA, factB, { weights = DEFAULT_WEIGHTS, tfidfScorer = null } = {}) {
  const base = compositeScore(factA, factB, weights)
  if (base.isExactMatch || !tfidfScorer) return base

  const qA = factA.quizQuestion || factA.statement || ''
  const qB = factB.quizQuestion || factB.statement || ''
  const tfidfSim = tfidfScorer.similarity(qA, qB)

  // Blend TF-IDF into score: TF-IDF gets 0.30 weight, original gets 0.70
  const blended = base.score * 0.70 + tfidfSim * 0.30
  return {
    score: Number(Math.max(base.score, blended).toFixed(4)),
    features: { ...base.features, tfidf: Number(tfidfSim.toFixed(4)) },
    isExactMatch: false,
  }
}
