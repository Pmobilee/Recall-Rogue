/**
 * Build-time manifest of which facts have cardback art available.
 * Uses import.meta.glob to discover WebP files at compile time so
 * we never make a network request for a cardback that doesn't exist.
 */

// Glob to discover which cardbacks exist at build time.
// Keys look like: "/public/assets/cardbacks/lowres/cult-001.webp"
const cardbackModules = import.meta.glob('/public/assets/cardbacks/lowres/*.webp')

// Extract fact IDs from the glob keys
const cardbackFactIds = new Set<string>(
  Object.keys(cardbackModules).map(path => {
    const filename = path.split('/').pop() ?? ''
    return filename.replace('.webp', '')
  })
)

/**
 * Checks whether a cardback image exists for the given fact ID.
 * @param factId - The fact identifier (e.g. "cult-001")
 * @returns `true` if a cardback WebP is available
 */
export function hasCardback(factId: string): boolean {
  return cardbackFactIds.has(factId)
}

/**
 * Returns the URL path for a fact's lowres cardback image, or `null`
 * if no cardback exists for that fact.
 * @param factId - The fact identifier (e.g. "cult-001")
 * @returns The public URL path like `/assets/cardbacks/lowres/cult-001.webp`, or `null`
 */
export function getCardbackUrl(factId: string): string | null {
  if (!cardbackFactIds.has(factId)) return null
  return `/assets/cardbacks/lowres/${factId}.webp`
}
