/**
 * Fact of the Day client service.
 * Fetches the daily curated fact with localStorage caching.
 */

/** A curated daily fact with GAIA commentary. */
export interface FactOfDay {
  factId: string
  statement: string
  category: string
  explanation: string
  gaiaComment: string
  date: string  // YYYY-MM-DD UTC
}

/**
 * Fetch today's Fact of the Day, using localStorage as a same-day cache.
 * Returns null if the fetch fails or no fact is available.
 */
export async function fetchFactOfDay(): Promise<FactOfDay | null> {
  const today = new Date().toISOString().slice(0, 10)
  const cacheKey = `terra:fact-of-day-${today}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) as FactOfDay } catch { /* fallback to fetch */ }
  }
  try {
    const res = await fetch('/api/v1/fact-of-day')
    if (!res.ok) return null
    const data = await res.json() as FactOfDay
    localStorage.setItem(cacheKey, JSON.stringify(data))
    return data
  } catch {
    return null
  }
}
