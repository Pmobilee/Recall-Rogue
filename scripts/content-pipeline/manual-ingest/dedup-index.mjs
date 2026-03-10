/**
 * Persistent incremental dedup index.
 * Caches exact keys and trigram inverted index to disk for faster re-runs.
 *
 * Index file: data/generated/qa-reports/dedup-index.json
 *
 * Usage:
 *   import { DedupIndex } from './dedup-index.mjs'
 *   const index = new DedupIndex()
 *   await index.load()
 *   index.addFacts(existingFacts)
 *   const exactMatch = index.findExactMatch(candidate)
 *   const candidates = index.findCandidates(candidate, 0.15)
 *   await index.save()
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { charTrigrams, exactDedupKey, hasCJK, cjkCharBigrams } from './similarity.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const DEFAULT_INDEX_PATH = path.join(ROOT, 'data/generated/qa-reports/dedup-index.json')

export class DedupIndex {
  constructor(indexPath = DEFAULT_INDEX_PATH) {
    this.indexPath = indexPath
    /** Map<exactKey, { id, domain }> */
    this.exactKeys = new Map()
    /** Map<trigram, Set<factId>> */
    this.trigramIndex = new Map()
    /** Map<factId, fact> — stores minimal fact data for scoring */
    this.facts = new Map()
    /** Metadata */
    this.meta = { version: 1, createdAt: null, updatedAt: null, factCount: 0, sourceFiles: [] }
  }

  /** Load index from disk if it exists */
  async load() {
    try {
      if (!fs.existsSync(this.indexPath)) return false
      const raw = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'))
      if (raw.version !== 1) return false

      this.meta = raw.meta || this.meta
      // Restore exact keys
      for (const [key, val] of Object.entries(raw.exactKeys || {})) {
        this.exactKeys.set(key, val)
      }
      // Restore trigram index
      for (const [tri, ids] of Object.entries(raw.trigramIndex || {})) {
        this.trigramIndex.set(tri, new Set(ids))
      }
      // Restore facts
      for (const [id, fact] of Object.entries(raw.facts || {})) {
        this.facts.set(id, fact)
      }
      return true
    } catch {
      return false
    }
  }

  /** Save index to disk */
  async save() {
    const data = {
      version: 1,
      meta: {
        ...this.meta,
        updatedAt: new Date().toISOString(),
        factCount: this.facts.size,
      },
      exactKeys: Object.fromEntries(this.exactKeys),
      trigramIndex: Object.fromEntries(
        Array.from(this.trigramIndex.entries()).map(([k, v]) => [k, [...v]])
      ),
      facts: Object.fromEntries(this.facts),
    }

    fs.mkdirSync(path.dirname(this.indexPath), { recursive: true })
    fs.writeFileSync(this.indexPath, JSON.stringify(data) + '\n')
  }

  /** Add a batch of facts to the index */
  addFacts(facts, sourceFile = null) {
    if (sourceFile && !this.meta.sourceFiles.includes(sourceFile)) {
      this.meta.sourceFiles.push(sourceFile)
    }
    if (!this.meta.createdAt) this.meta.createdAt = new Date().toISOString()

    for (const fact of facts) {
      const id = fact.id
      if (!id || this.facts.has(id)) continue

      // Store minimal fact data
      this.facts.set(id, {
        id,
        quizQuestion: fact.quizQuestion || '',
        correctAnswer: fact.correctAnswer || '',
        statement: fact.statement || '',
        domain: fact.category?.[0] || fact.domain || '',
      })

      // Exact key
      const key = exactDedupKey(fact)
      if (!this.exactKeys.has(key)) {
        this.exactKeys.set(key, { id, domain: fact.category?.[0] || '' })
      }

      // Trigram index
      const text = fact.quizQuestion || fact.statement || ''
      const grams = hasCJK(text) ? cjkCharBigrams(text) : charTrigrams(text)
      for (const tri of grams) {
        if (!this.trigramIndex.has(tri)) this.trigramIndex.set(tri, new Set())
        this.trigramIndex.get(tri).add(id)
      }
    }
  }

  /** Check if a fact has an exact duplicate in the index */
  findExactMatch(fact) {
    const key = exactDedupKey(fact)
    return this.exactKeys.get(key) || null
  }

  /**
   * Find candidate fact IDs that share trigrams with the given fact.
   * Returns array of { id, sharedCount } sorted by shared count descending.
   */
  findCandidates(fact, minSharedRatio = 0.15) {
    const text = fact.quizQuestion || fact.statement || ''
    const grams = hasCJK(text) ? cjkCharBigrams(text) : charTrigrams(text)
    if (grams.size === 0) return []

    const hitCounts = new Map() // factId -> shared trigram count
    for (const tri of grams) {
      const ids = this.trigramIndex.get(tri)
      if (!ids || ids.size > 500) continue // skip overly common trigrams
      for (const id of ids) {
        hitCounts.set(id, (hitCounts.get(id) || 0) + 1)
      }
    }

    const minHits = Math.max(1, Math.floor(grams.size * minSharedRatio))
    const results = []
    for (const [id, count] of hitCounts) {
      if (count >= minHits) {
        results.push({ id, sharedCount: count, fact: this.facts.get(id) })
      }
    }

    return results.sort((a, b) => b.sharedCount - a.sharedCount)
  }

  /** Get stats about the index */
  stats() {
    return {
      factCount: this.facts.size,
      exactKeyCount: this.exactKeys.size,
      trigramCount: this.trigramIndex.size,
      sourceFiles: this.meta.sourceFiles,
      createdAt: this.meta.createdAt,
      updatedAt: this.meta.updatedAt,
    }
  }

  /** Clear the index */
  clear() {
    this.exactKeys.clear()
    this.trigramIndex.clear()
    this.facts.clear()
    this.meta = { version: 1, createdAt: null, updatedAt: null, factCount: 0, sourceFiles: [] }
  }
}
