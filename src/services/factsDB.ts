// sql.js is loaded lazily via dynamic import to defer ~300 KB WASM from the critical path.
// The facts DB is not needed until the player's first quiz (30+ seconds into a session).
// DD-V2-218: Initial JS bundle < 500 KB gzipped.
import type { Database } from 'sql.js'
import type { Fact, ContentType, Rarity, AgeRating, QuestionVariant } from '../data/types'
import { factPackService } from './factPackService'
import { AGE_BRACKET_KEY } from './legalConstants'
import { shuffled } from './randomUtils'

type SqlJsStatic = typeof import('sql.js')['default']
let _initSqlJs: SqlJsStatic | null = null

/**
 * Lazily loads sql.js on first call. Subsequent calls return the cached module.
 * This defers ~300 KB of WASM from the critical path (DD-V2-218).
 */
async function getSqlJs(): Promise<SqlJsStatic> {
  if (!_initSqlJs) {
    try {
      const mod = await import('sql.js')
      _initSqlJs = mod.default
    } catch {
      // Stale Vite dep cache (504 Outdated Optimize Dep) — retry once after clearing
      const mod = await import(/* @vite-ignore */ 'sql.js')
      _initSqlJs = mod.default
    }
  }
  return _initSqlJs
}

/** Returns the URL to the sql-wasm.wasm file served from public/. */
async function getSqlWasmUrl(): Promise<string> {
  return '/sql-wasm.wasm'
}

/**
 * Maps the raw `terra_age_bracket` localStorage string to the canonical
 * `AgeRating` type used throughout the app.
 *
 * - 'under_13' → 'kid'
 * - 'teen'     → 'teen'
 * - 'adult'    → 'adult'
 * - unknown / missing → 'adult' (safest default for existing players)
 */
function ageBracketToRating(bracket: string | null): AgeRating {
  if (bracket === 'under_13') return 'kid'
  if (bracket === 'teen') return 'teen'
  return 'adult'
}

/**
 * Reads the age bracket that was set by the AgeGate and converts it to an
 * `AgeRating`. Returns 'adult' when no bracket has been stored.
 */
function getStoredAgeRating(): AgeRating {
  if (typeof localStorage === 'undefined') return 'adult'
  return ageBracketToRating(localStorage.getItem(AGE_BRACKET_KEY))
}

/**
 * Singleton service that loads a SQLite database via sql.js (WASM) in the browser
 * and exposes typed query methods over the `facts` table.
 *
 * Usage:
 *   await factsDB.init()
 *   const all = factsDB.getAll()
 *   const fact = factsDB.getById('some-id')
 */
class FactsDB {
  private db: Database | null = null
  private initialized = false
  private allFactsCache: Fact[] | null = null
  private factByIdCache: Map<string, Fact> | null = null
  private topCategoryIndex: Map<string, Fact[]> | null = null
  private ageRatingIndex: { kid: Fact[]; teen: Fact[]; adult: Fact[] } | null = null

  private constructor() {}

  /**
   * Returns the shared singleton instance of FactsDB.
   */
  static getInstance(): FactsDB {
    const sym = Symbol.for('terra:factsDB')
    const singletonRegistry = globalThis as typeof globalThis & Record<symbol, unknown>
    if (!(sym in singletonRegistry)) {
      singletonRegistry[sym] = new FactsDB()
    }
    return singletonRegistry[sym] as FactsDB
  }

  /**
   * Initialize the database. Loads the sql.js WASM binary and fetches `/facts.db`
   * from the server. Must be called once before any query methods are used.
   * Subsequent calls are no-ops.
   *
   * Also initialises the FactPackService cache and kicks off a background sync
   * so the offline JSON pack stays fresh without blocking the SQL load.
   */
  async init(): Promise<void> {
    if (this.initialized) return

    // Initialise the offline fact pack cache from localStorage (synchronous).
    factPackService.init()

    // Kick off a background sync — fire-and-forget, never blocks DB init.
    // The sync only runs if the cached pack is stale (>7 days old).
    factPackService.syncPacks().catch(() => {
      // Silent failure is intentional — offline players must not be affected.
    })

    const [initFn, wasmUrl, buffer] = await Promise.all([
      getSqlJs(),
      getSqlWasmUrl(),
      fetch('/facts.db').then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch /facts.db: ${response.status} ${response.statusText}`)
        }
        return response.arrayBuffer()
      }),
    ])
    const SQL = await initFn({ locateFile: () => wasmUrl })
    this.db = new SQL.Database(new Uint8Array(buffer))
    this.initialized = true
    this.invalidateIndexes()
    this.ensureIndexes()
    if (import.meta.env.DEV) console.info(`[FactsDB] Initialized: ${this.allFactsCache?.length ?? 0} facts loaded`)
  }

  /**
   * Returns true if the database has been successfully initialized and is ready
   * to accept queries.
   */
  isReady(): boolean {
    return this.initialized && this.db !== null
  }

  // ──────────────────────────────────────────────
  // Public query methods
  // ──────────────────────────────────────────────

  /**
   * Returns every fact in the database.
   */
  getAll(): Fact[] {
    this.ensureIndexes()
    return this.allFactsCache ?? []
  }

  /**
   * Returns all facts EXCLUDING language/vocabulary facts.
   * Use this for trivia run pool building — language facts belong in Study
   * Temple curated decks only and must not leak into trivia runs.
   */
  getTriviaFacts(): Fact[] {
    return this.getAll().filter(f => f.categoryL1 !== 'language' && f.type !== 'vocabulary')
  }

  /**
   * Returns the fact with the given id, or null if not found.
   */
  getById(id: string): Fact | null {
    this.ensureIndexes()
    return this.factByIdCache?.get(id) ?? null
  }

  /**
   * Returns all facts whose ids appear in the given array.
   * Returns an empty array if ids is empty.
   */
  getByIds(ids: string[]): Fact[] {
    if (ids.length === 0) return []
    this.ensureIndexes()
    const byId = this.factByIdCache
    if (!byId) return []
    const results: Fact[] = []
    for (const id of ids) {
      const fact = byId.get(id)
      if (fact) results.push(fact)
    }
    return results
  }

  /**
   * Returns all facts of the given content type.
   */
  getByType(type: ContentType): Fact[] {
    this.ensureIndexes()
    const all = this.allFactsCache ?? []
    return all.filter((fact) => fact.type === type)
  }

  /**
   * Returns facts matching any of the given top-level categories.
   * Useful for interest-curated seed facts during onboarding.
   *
   * @param categories - Array of category names (e.g., ['History', 'Language'])
   * @param limit - Maximum facts to return
   */
  getByCategory(categories: string[], limit: number): Fact[] {
    if (categories.length === 0) return []
    this.ensureIndexes()
    const index = this.topCategoryIndex
    if (!index) return []

    const matching: Fact[] = []
    const seen = new Set<string>()
    for (const category of categories) {
      const rows = index.get(category)
      if (!rows) continue
      for (const fact of rows) {
        if (seen.has(fact.id)) continue
        seen.add(fact.id)
        matching.push(fact)
      }
    }

    // Shuffle and take up to limit
    return shuffled(matching).slice(0, limit)
  }

  /**
   * Returns a random selection of facts, automatically filtered by the age
   * bracket stored in localStorage (set by the AgeGate on first launch).
   * @param count Number of facts to return (default 1).
   */
  getRandom(count = 1): Fact[] {
    return this.getRandomFiltered(count, getStoredAgeRating())
  }

  /**
   * Convenience wrapper that returns a single random fact filtered by the
   * stored age bracket, or null if the database is empty.
   */
  getRandomOne(): Fact | null {
    const results = this.getRandom(1)
    return results[0] ?? null
  }

  /**
   * Returns facts appropriate for the given age rating:
   * - 'kid':   only facts with ageRating='kid'
   * - 'teen':  facts with ageRating='kid' OR ageRating='teen'
   * - 'adult': all facts (no filter applied)
   */
  getByAgeRating(rating: AgeRating): Fact[] {
    this.ensureIndexes()
    const index = this.ageRatingIndex
    if (!index) return []
    if (rating === 'adult') return index.adult
    if (rating === 'teen') return index.teen
    return index.kid
  }

  /**
   * Returns a random selection of facts, optionally filtered by age rating.
   * When `ageRating` is omitted, the age rating stored in localStorage
   * (written by the AgeGate on first launch) is used as the default.
   *
   * @param count     Number of facts to return (default 1).
   * @param ageRating Optional age-rating filter. Defaults to the stored bracket.
   *                  Pass 'adult' explicitly to bypass filtering.
   */
  getRandomFiltered(count = 1, ageRating?: AgeRating): Fact[] {
    const n = Math.max(1, Math.floor(count))
    const rating = ageRating ?? getStoredAgeRating()
    const source = this.getByAgeRating(rating)
    return this.pickRandomFacts(source, n)
  }

  /**
   * Returns the total number of facts in the database.
   */
  count(): number {
    if (!this.ensureReady()) return 0
    const stmt = this.db!.prepare('SELECT COUNT(*) AS n FROM facts')
    try {
      stmt.step()
      const row = stmt.getAsObject() as Record<string, unknown>
      return typeof row['n'] === 'number' ? row['n'] : Number(row['n'])
    } finally {
      stmt.free()
    }
  }

  /**
   * Returns the pre-generated mnemonic for a fact if one exists, or null
   * if the fact has no mnemonic or could not be found.
   *
   * @param factId - The id of the fact to look up.
   */
  getMnemonic(factId: string): string | null {
    if (!this.ensureReady()) return null
    const stmt = this.db!.prepare('SELECT mnemonic FROM facts WHERE id = ?', [factId] as Parameters<Database['prepare']>[1])
    try {
      if (!stmt.step()) return null
      const row = stmt.getAsObject() as Record<string, unknown>
      const v = row['mnemonic']
      return v !== null && v !== undefined && String(v).length > 0 ? String(v) : null
    } finally {
      stmt.free()
    }
  }

  /**
   * Returns the id of every fact in the database.
   */
  getAllIds(): string[] {
    this.ensureIndexes()
    return this.allFactsCache?.map((fact) => fact.id) ?? []
  }

  /**
   * Paced fact selection for the mine quiz system (FIX-9).
   *
   * Priority order:
   *  1. Review-due facts (SM-2 scheduled for today)
   *  2. Previously unlocked facts not yet mastered
   *  3. New facts — only introduced if the unmastered queue is manageable,
   *     capped at MAX_NEW_FACTS_PER_DIVE per dive session
   *
   * @param opts.learnedFacts       Fact IDs the player has already encountered
   * @param opts.reviewStates       SM-2 review states (to find due/low-mastery facts)
   * @param opts.unlockedFactIds    Fact IDs that have been unlocked for this player
   * @param opts.newFactsThisDive   How many new facts have already appeared this dive
   * @param opts.interestWeights    Category weight map (for weighted new-fact selection)
   * @param opts.maxNewPerDive      Cap on new facts per dive (default 4)
   * @returns Selected Fact or null
   */
  getPacedFact(opts: {
    learnedFacts: string[]
    reviewStates: Array<{ factId: string; repetitions: number; nextReviewAt: number }>
    unlockedFactIds?: string[]
    newFactsThisDive?: number
    interestWeights?: Record<string, number>
    maxNewPerDive?: number
    excludeIds?: string[]
  }): Fact | null {
    const MAX_NEW_PER_DIVE = opts.maxNewPerDive ?? 4
    const MAX_LOW_MASTERY_BEFORE_SLOWDOWN = 10
    const now = Date.now()

    // IDs to exclude from selection (recently asked / recently failed)
    const excludeSet = new Set(opts.excludeIds ?? [])

    // Identify which facts are "due" for review
    const dueFacts = opts.reviewStates
      .filter(rs => rs.nextReviewAt <= now)
      .filter(rs => !excludeSet.has(rs.factId))

    // If there are due review facts, prefer them
    if (dueFacts.length > 0) {
      for (const rs of shuffled(dueFacts)) {
        const fact = this.getById(rs.factId)
        if (fact) return fact
      }
    }

    // Count low-mastery facts (repetitions <= 1 = still struggling)
    const lowMasteryCount = opts.reviewStates.filter(rs => rs.repetitions <= 1).length
    const newFactsThisDive = opts.newFactsThisDive ?? 0
    const slowdownActive = lowMasteryCount > MAX_LOW_MASTERY_BEFORE_SLOWDOWN

    // Try to pick from unlocked-but-not-yet-seen facts (revisit known)
    const learnedSet = new Set(opts.learnedFacts)
    const unlockedIds = opts.unlockedFactIds ?? []
    const unlockedNotLearned = unlockedIds.filter(id => !learnedSet.has(id) && !excludeSet.has(id))
    if (unlockedNotLearned.length > 0) {
      const pick = unlockedNotLearned[Math.floor(Math.random() * unlockedNotLearned.length)]
      const fact = this.getById(pick)
      if (fact) return fact
    }

    // Introduce a new fact if: not slowdown mode AND under per-dive cap
    if (!slowdownActive && newFactsThisDive < MAX_NEW_PER_DIVE) {
      // Exclude already-learned and already-unlocked facts
      const newFactExcludeSet = new Set([...opts.learnedFacts, ...unlockedIds, ...excludeSet])
      const allFacts = this.getAll()
      const candidates = allFacts.filter(f => !newFactExcludeSet.has(f.id))

      if (candidates.length > 0) {
        // Apply interest weights if provided
        const weights = opts.interestWeights ?? {}
        const scored = candidates.map(f => {
          const catWeight = f.category.reduce((max, cat) => {
            return Math.max(max, weights[cat] ?? 1.0)
          }, 1.0)
          return { fact: f, weight: catWeight }
        })
        // Weighted random pick
        const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0)
        let r = Math.random() * totalWeight
        for (const s of scored) {
          r -= s.weight
          if (r <= 0) return s.fact
        }
        return scored[scored.length - 1]!.fact
      }
    }

    // Fallback: any learned fact that has a review state
    const anyLearned = opts.learnedFacts.filter(id => !excludeSet.has(id))
    if (anyLearned.length > 0) {
      const pick = anyLearned[Math.floor(Math.random() * anyLearned.length)]
      return this.getById(pick)
    }

    // Ultimate fallback (ignores excludeSet to guarantee a result)
    if (opts.learnedFacts.length > 0) {
      const pick = opts.learnedFacts[Math.floor(Math.random() * opts.learnedFacts.length)]
      return this.getById(pick)
    }

    return this.getRandomOne()
  }

  // ──────────────────────────────────────────────
  // Localization (Phase 40)
  // ──────────────────────────────────────────────

  /**
   * Returns a fact's content in the player's locale if a translation exists.
   * Falls back to the English content if no translation is available.
   *
   * Note: The `fact_translations` table is defined in Phase 40 but the actual
   * database migration is gated on explicit user approval (CLAUDE.md rule).
   * This method gracefully falls back to English when the table doesn't exist.
   *
   * @param factId - The fact ID to look up.
   * @param locale - The target locale code (e.g., 'es', 'fr').
   * @returns The fact with localized text fields, or null if not found.
   */
  async getLocalizedFact(factId: string, locale: string): Promise<Fact | null> {
    if (!this.db) await this.init()

    // Try localized version first (only if not English and table exists)
    if (locale !== 'en') {
      try {
        const result = this.db!.exec(
          `SELECT f.id, f.type,
                  COALESCE(ft.statement, f.statement) AS statement,
                  COALESCE(ft.wow_factor, f.wow_factor) AS wow_factor,
                  COALESCE(ft.explanation, f.explanation) AS explanation,
                  f.gaia_comment,
                  COALESCE(ft.quiz_question, f.quiz_question) AS quiz_question,
                  COALESCE(ft.correct_answer, f.correct_answer) AS correct_answer,
                  COALESCE(ft.distractors, f.distractors) AS distractors,
                  f.category, f.rarity, f.difficulty, f.fun_score, f.age_rating,
                  f.source_name, f.language, f.pronunciation, f.example_sentence,
                  f.image_url, f.mnemonic
           FROM facts f
           LEFT JOIN fact_translations ft ON ft.id = f.id AND ft.locale = ?
           WHERE f.id = ?`,
          [locale, factId]
        )
        if (result[0]?.values?.length > 0) {
          const row: Record<string, unknown> = {}
          const cols = result[0].columns
          const vals = result[0].values[0]
          cols.forEach((col, i) => { row[col] = vals[i] })
          return this.rowToFact(row)
        }
      } catch {
        // fact_translations table doesn't exist yet — fall through to English
      }
    }

    // Fall back to English
    return this.getById(factId)
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  /**
   * Returns true if the database is initialized and ready for queries.
   * Returns false (instead of throwing) so callers can return empty results
   * gracefully when WASM or the .db file failed to load.
   */
  private ensureReady(): boolean {
    return this.initialized && this.db !== null
  }

  private invalidateIndexes(): void {
    this.allFactsCache = null
    this.factByIdCache = null
    this.topCategoryIndex = null
    this.ageRatingIndex = null
  }

  /**
   * Build in-memory lookup indexes once per session to avoid repeated full-table scans.
   */
  private ensureIndexes(): void {
    if (!this.ensureReady()) return
    if (this.allFactsCache && this.factByIdCache && this.topCategoryIndex && this.ageRatingIndex) return

    const all = this.query('SELECT * FROM facts')
    const byId = new Map<string, Fact>()
    const categoryIndex = new Map<string, Fact[]>()
    const kid: Fact[] = []
    const teen: Fact[] = []

    for (const fact of all) {
      byId.set(fact.id, fact)

      const topCategory = fact.category[0] ?? ''
      if (topCategory) {
        const bucket = categoryIndex.get(topCategory)
        if (bucket) bucket.push(fact)
        else categoryIndex.set(topCategory, [fact])
      }

      if (fact.ageRating === 'kid') {
        kid.push(fact)
        teen.push(fact)
      } else if (fact.ageRating === 'teen') {
        teen.push(fact)
      }
    }

    this.allFactsCache = all
    this.factByIdCache = byId
    this.topCategoryIndex = categoryIndex
    this.ageRatingIndex = { kid, teen, adult: all }
  }

  private pickRandomFacts(pool: Fact[], count: number): Fact[] {
    if (pool.length === 0 || count <= 0) return []
    if (count >= pool.length) return shuffled(pool).slice(0, count)

    const picks: Fact[] = []
    const used = new Set<number>()
    while (picks.length < count && used.size < pool.length) {
      const idx = Math.floor(Math.random() * pool.length)
      if (used.has(idx)) continue
      used.add(idx)
      picks.push(pool[idx]!)
    }
    return picks
  }

  /**
   * Runs a parameterized SQL query and maps all result rows to Fact objects.
   * @param sql  The SQL string with `?` placeholders.
   * @param params  Positional parameter values, in order.
   */
  private query(sql: string, params: unknown[] = []): Fact[] {
    if (!this.ensureReady()) return []
    // sql.js accepts BindParams as an array of values or a named object.
    // Casting through unknown keeps strict-mode happy while staying correct.
    const stmt = this.db!.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params as Parameters<Database['prepare']>[1])
    }
    const facts: Fact[] = []
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>
        facts.push(this.rowToFact(row))
      }
    } catch (err) {
      console.error('FactsDB query error:', err, 'SQL:', sql)
    } finally {
      stmt.free()
    }
    return facts
  }

  /**
   * Maps a raw sql.js result row (snake_case keys) to a typed Fact object
   * (camelCase keys). JSON-serialised columns (distractors, category) are
   * parsed here. Nullable optional fields are converted to undefined so that
   * consumers can rely on the standard `fact.wowFactor ?? 'N/A'` pattern.
   */
  private rowToFact(row: Record<string, unknown>): Fact {
    /** Reads a column as a string or returns undefined if null/missing. */
    const optStr = (col: string): string | undefined => {
      const v = row[col]
      return v !== null && v !== undefined ? String(v) : undefined
    }

    return {
      id:              String(row['id']),
      type:            String(row['type']) as ContentType,
      statement:       String(row['statement']),
      wowFactor:       optStr('wow_factor'),
      explanation:     String(row['explanation']),
      gaiaComment:     optStr('gaia_comment'),
      quizQuestion:    String(row['quiz_question']),
      correctAnswer:   String(row['correct_answer']),
      distractors:     (JSON.parse(String(row['distractors'])) as unknown[]).map(
        d => typeof d === 'string' ? d : (d as { text: string }).text ?? String(d)
      ),
      category:        JSON.parse(String(row['category'])) as string[],
      categoryL1:      optStr('category_l1'),
      categoryL2:      optStr('category_l2'),
      rarity:          String(row['rarity']) as Rarity,
      difficulty:      Number(row['difficulty']),
      funScore:        Number(row['fun_score']),
      ageRating:       String(row['age_rating']) as AgeRating,
      sourceName:      optStr('source_name'),
      language:        optStr('language'),
      pronunciation:   optStr('pronunciation'),
      exampleSentence: optStr('example_sentence'),
      imageUrl:        optStr('image_url'),
      mnemonic:        optStr('mnemonic'),
      variants: row['variants'] ? (JSON.parse(String(row['variants'])) as Array<Record<string, unknown>>).map(v => ({
        ...v,
        distractors: Array.isArray(v.distractors)
          ? (v.distractors as unknown[]).map(d => typeof d === 'string' ? d : (d as { text: string }).text ?? String(d))
          : v.distractors,
      })) as QuestionVariant[] : undefined,
    }
  }
}

/** The shared FactsDB singleton. Call `factsDB.init()` once at startup. */
export const factsDB = FactsDB.getInstance()
