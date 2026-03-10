/**
 * Recall Rogue JavaScript/TypeScript SDK.
 * Wraps all public API endpoints with typed interfaces and built-in
 * CC attribution handling.
 *
 * Usage:
 *   import { RecallRogueClient } from 'recall-rogue-sdk'
 *   const client = new RecallRogueClient({ apiKey: 'tg_live_...' })
 *   const facts = await client.getFacts({ category: 'Biology', limit: 10 })
 */

/** CC attribution metadata returned with every API response. */
export interface CcMeta {
  license: string
  licenseUrl: string
  attribution: string
  requiresAttribution: boolean
}

/** A single fact record from the public API. */
export interface Fact {
  id: string
  statement: string
  quizQuestion?: string
  correctAnswer: string
  categoryL1: string
  categoryL2?: string
  difficulty?: number
  rarity?: string
  ageRating?: string
  sourceName?: string
  sourceUrl?: string
  language?: string
  updatedAt?: number
}

/** A fact with full detail including distractors. */
export interface FactDetail extends Fact {
  explanation?: string
  acceptableAnswers?: string[]
  funScore?: number
  mnemonic?: string
  hasPixelArt?: boolean
  imageUrl?: string
  distractors: Array<{ text: string; difficultyTier: string }>
}

/** Pagination envelope for list responses. */
export interface Pagination {
  limit: number
  hasMore: boolean
  nextCursor: string | null
}

/** Response from GET /facts */
export interface FactsListResponse {
  data: Fact[]
  pagination: Pagination
  meta: CcMeta & { totalApproved: number }
}

/** Response from GET /facts/random */
export interface FactsRandomResponse {
  data: Fact[]
  meta: CcMeta & { count: number }
}

/** Response from GET /facts/:id */
export interface FactDetailResponse {
  data: FactDetail
  meta: CcMeta
}

/** Response from GET /categories */
export interface CategoriesResponse {
  data: Record<string, { total: number; subcategories: Record<string, number> }>
  meta: CcMeta
}

/** Response from GET /stats */
export interface StatsResponse {
  data: {
    totalApprovedFacts: number
    totalCategories: number
    lastUpdated: string
  }
  meta: CcMeta
}

/** Options for the RecallRogueClient constructor. */
export interface RecallRogueClientOptions {
  /** Your API key (starts with tg_live_). */
  apiKey: string
  /**
   * Base URL of the API.
   * Defaults to 'https://api.terragacha.com'.
   */
  baseUrl?: string
}

/** Options for getFacts() */
export interface GetFactsOptions {
  category?: string
  difficulty?: string
  limit?: number
  cursor?: string
}

/** Options for getRandomFacts() */
export interface GetRandomFactsOptions {
  count?: number
  category?: string
}

/**
 * Recall Rogue public API client.
 * All methods automatically include CC attribution in the response.
 */
export class RecallRogueClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  /**
   * Create a new RecallRogueClient.
   *
   * @param options - Client configuration including API key and optional base URL.
   */
  constructor(options: RecallRogueClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? 'https://api.terragacha.com').replace(/\/$/, '')
  }

  /** Build standard request headers. */
  private headers(): Record<string, string> {
    return {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  /** Perform a GET request and parse JSON. */
  private async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
    }
    const res = await fetch(url.toString(), { headers: this.headers() })
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
      throw new Error(errorBody.error ?? `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  }

  /**
   * Get a paginated list of approved facts.
   *
   * @param options - Filter and pagination options.
   * @returns Paginated list of facts with CC attribution metadata.
   */
  async getFacts(options: GetFactsOptions = {}): Promise<FactsListResponse> {
    return this.get<FactsListResponse>('/api/v1/facts', {
      category: options.category,
      difficulty: options.difficulty,
      limit: options.limit,
      cursor: options.cursor,
    })
  }

  /**
   * Get a random sample of facts for quiz use.
   *
   * @param options - Count and optional category filter.
   * @returns Random facts with CC attribution metadata.
   */
  async getRandomFacts(options: GetRandomFactsOptions = {}): Promise<FactsRandomResponse> {
    return this.get<FactsRandomResponse>('/api/v1/facts/random', {
      count: options.count,
      category: options.category,
    })
  }

  /**
   * Get full detail for a single fact, including distractors.
   *
   * @param factId - The fact ID to retrieve.
   * @returns Full fact detail with distractors and CC attribution metadata.
   */
  async getFactDetail(factId: string): Promise<FactDetailResponse> {
    return this.get<FactDetailResponse>(`/api/v1/facts/${encodeURIComponent(factId)}`)
  }

  /**
   * Get the full category tree with fact counts.
   *
   * @returns Nested category tree with CC attribution metadata.
   */
  async getCategories(): Promise<CategoriesResponse> {
    return this.get<CategoriesResponse>('/api/v1/categories')
  }

  /**
   * Get database statistics.
   *
   * @returns Total approved facts, categories count, and last update time.
   */
  async getStats(): Promise<StatsResponse> {
    return this.get<StatsResponse>('/api/v1/stats')
  }

  /**
   * Get CC license metadata for this API deployment.
   * No API key required for this endpoint.
   *
   * @returns License information for fact text and pixel art images.
   */
  async getLicense(): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/api/v1/license`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<Record<string, unknown>>
  }
}

export default RecallRogueClient
