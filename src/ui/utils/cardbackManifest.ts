/**
 * Dynamic manifest of which facts have cardback art available.
 * In dev mode, fetches manifest.json from the cardback tool and
 * listens for SSE updates for live reload. In production, falls
 * back to build-time glob.
 */

/** The set of fact IDs that have cardback art */
let cardbackFactIds = new Set<string>()
let initialized = false
let initPromise: Promise<void> | null = null

// Keep bundle size lean: cardback IDs are sourced from manifest JSON at runtime.
const EMPTY_IDS = new Set<string>()

/** Callbacks notified when new cardbacks become available */
type CardbackListener = (factId: string) => void
const listeners = new Set<CardbackListener>()

/**
 * Subscribe to new cardback notifications.
 * @returns unsubscribe function
 */
export function onCardbackReady(cb: CardbackListener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

async function fetchManifest(): Promise<Set<string>> {
  try {
    const res = await fetch('/assets/cardbacks/manifest.json', { cache: 'no-store' })
    if (!res.ok) return EMPTY_IDS
    const data = await res.json()
    if (Array.isArray(data.ids)) return new Set<string>(data.ids)
  } catch { /* fallback */ }
  return EMPTY_IDS
}

/**
 * Maximum consecutive SSE connection errors before giving up.
 * The cardback tool server is rarely running; stop reconnecting quickly
 * to avoid spamming "Failed to load resource" errors in devtools.
 */
const SSE_MAX_ERRORS = 3

function connectSSE(): void {
  // In dev mode, connect to cardback tool SSE for live updates
  const CARDBACK_TOOL_URL = 'http://100.74.153.81:5175'
  try {
    const es = new EventSource(`${CARDBACK_TOOL_URL}/api/game/cardback-updates`)
    let errorCount = 0

    es.onmessage = (event) => {
      // Reset error count on successful message
      errorCount = 0
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'cardback_ready' && data.factId) {
          cardbackFactIds.add(data.factId)
          for (const cb of listeners) {
            try { cb(data.factId) } catch { /* ignore */ }
          }
        }
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      errorCount++
      // Stop reconnecting after SSE_MAX_ERRORS consecutive failures.
      // EventSource auto-reconnects by default; closing it prevents infinite
      // "Failed to load resource" spam when the cardback tool isn't running.
      if (errorCount >= SSE_MAX_ERRORS) {
        es.close()
      }
    }
  } catch {
    // SSE not available — fall back to polling
    setInterval(async () => {
      cardbackFactIds = await fetchManifest()
    }, 30_000)
  }
}

/** Initialize the manifest. Safe to call multiple times. */
export function initCardbackManifest(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    cardbackFactIds = await fetchManifest()
    initialized = true
    // Only connect SSE in dev mode
    if (import.meta.env.DEV) {
      connectSSE()
    }
  })()
  return initPromise
}

/**
 * Checks whether a cardback image exists for the given fact ID.
 */
export function hasCardback(factId: string): boolean {
  if (!initialized) return false
  return cardbackFactIds.has(factId)
}

/**
 * Returns the URL path for a fact's lowres cardback image, or `null`.
 */
export function getCardbackUrl(factId: string): string | null {
  if (!hasCardback(factId)) return null
  return `/assets/cardbacks/lowres/${factId}.webp`
}
