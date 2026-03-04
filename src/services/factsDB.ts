import initSqlJs, { type Database } from 'sql.js'
import type { Fact, ContentType, Rarity, AgeRating } from '../data/types'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { factPackService } from './factPackService'

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
  private static instance: FactsDB
  private db: Database | null = null
  private initialized = false

  private constructor() {}

  /**
   * Returns the shared singleton instance of FactsDB.
   */
  static getInstance(): FactsDB {
    if (!FactsDB.instance) {
      FactsDB.instance = new FactsDB()
    }
    return FactsDB.instance
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

    const [SQL, buffer] = await Promise.all([
      initSqlJs({ locateFile: () => sqlWasmUrl }),
      fetch('/facts.db').then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch /facts.db: ${response.status} ${response.statusText}`)
        }
        return response.arrayBuffer()
      }),
    ])
    this.db = new SQL.Database(new Uint8Array(buffer))
    this.initialized = true
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
    return this.query('SELECT * FROM facts')
  }

  /**
   * Returns the fact with the given id, or null if not found.
   */
  getById(id: string): Fact | null {
    const results = this.query('SELECT * FROM facts WHERE id = ?', [id])
    return results[0] ?? null
  }

  /**
   * Returns all facts whose ids appear in the given array.
   * Returns an empty array if ids is empty.
   */
  getByIds(ids: string[]): Fact[] {
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(', ')
    return this.query(`SELECT * FROM facts WHERE id IN (${placeholders})`, ids)
  }

  /**
   * Returns all facts of the given content type.
   */
  getByType(type: ContentType): Fact[] {
    return this.query('SELECT * FROM facts WHERE type = ?', [type])
  }

  /**
   * Returns a random selection of facts.
   * @param count Number of facts to return (default 1).
   */
  getRandom(count = 1): Fact[] {
    return this.query(`SELECT * FROM facts ORDER BY RANDOM() LIMIT ${Math.max(1, Math.floor(count))}`)
  }

  /**
   * Convenience wrapper that returns a single random fact, or null if the
   * database is empty.
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
    if (rating === 'adult') {
      return this.query('SELECT * FROM facts')
    }
    if (rating === 'teen') {
      return this.query("SELECT * FROM facts WHERE age_rating IN ('kid', 'teen')")
    }
    // 'kid'
    return this.query("SELECT * FROM facts WHERE age_rating = 'kid'")
  }

  /**
   * Returns a random selection of facts, optionally filtered by age rating.
   * When `ageRating` is omitted the behaviour is identical to `getRandom`.
   * @param count     Number of facts to return (default 1).
   * @param ageRating Optional age-rating filter applied before random selection.
   */
  getRandomFiltered(count = 1, ageRating?: AgeRating): Fact[] {
    const n = Math.max(1, Math.floor(count))
    if (ageRating === undefined || ageRating === 'adult') {
      return this.query(`SELECT * FROM facts ORDER BY RANDOM() LIMIT ${n}`)
    }
    if (ageRating === 'teen') {
      return this.query(
        `SELECT * FROM facts WHERE age_rating IN ('kid', 'teen') ORDER BY RANDOM() LIMIT ${n}`,
      )
    }
    // 'kid'
    return this.query(
      `SELECT * FROM facts WHERE age_rating = 'kid' ORDER BY RANDOM() LIMIT ${n}`,
    )
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
    if (!this.ensureReady()) return []
    const stmt = this.db!.prepare('SELECT id FROM facts')
    const ids: string[] = []
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>
        if (typeof row['id'] === 'string') {
          ids.push(row['id'])
        }
      }
    } finally {
      stmt.free()
    }
    return ids
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

  /**
   * Runs a parameterized SQL query and maps all result rows to Fact objects.
   * @param sql  The SQL string with `?` placeholders.
   * @param params  Positional parameter values, in order.
   */
  private query(sql: string, params: unknown[] = []): Fact[] {
    if (!this.ensureReady()) return []
    // sql.js accepts BindParams as an array of values or a named object.
    // Casting through unknown keeps strict-mode happy while staying correct.
    const stmt = this.db!.prepare(sql, params as Parameters<Database['prepare']>[1])
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
      distractors:     JSON.parse(String(row['distractors'])) as string[],
      category:        JSON.parse(String(row['category'])) as string[],
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
    }
  }
}

/** The shared FactsDB singleton. Call `factsDB.init()` once at startup. */
export const factsDB = FactsDB.getInstance()
