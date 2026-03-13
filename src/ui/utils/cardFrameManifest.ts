/**
 * Dynamic manifest of card frame art available for different mechanics.
 * Fetches manifest.json and provides URL lookups for lowres and hires frames.
 */

interface FrameEntry {
  file: string
  lowres: string
  width: number
  height: number
  ratio: number
}

interface FrameManifest {
  frames: Record<string, FrameEntry>
  defaultRatio: number
}

let frameManifest: FrameManifest | null = null
let initialized = false
let initPromise: Promise<void> | null = null

const DEFAULT_RATIO = 1.42
const EMPTY_MANIFEST: FrameManifest = {
  frames: {},
  defaultRatio: DEFAULT_RATIO,
}

/** Callbacks notified when the card frame manifest finishes loading */
type CardFrameListener = () => void
const listeners = new Set<CardFrameListener>()

/**
 * Subscribe to card frame manifest ready notifications.
 * @returns unsubscribe function
 */
export function onCardFrameReady(cb: CardFrameListener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * Fetches the card frame manifest from the assets directory.
 */
async function fetchManifest(): Promise<FrameManifest> {
  try {
    const res = await fetch('/assets/cardframes/manifest.json', { cache: 'no-store' })
    if (!res.ok) return EMPTY_MANIFEST
    const data = await res.json()
    if (data.frames && typeof data.frames === 'object') {
      return {
        frames: data.frames,
        defaultRatio: data.defaultRatio ?? DEFAULT_RATIO,
      }
    }
  } catch { /* fallback */ }
  return EMPTY_MANIFEST
}

/**
 * Initialize the card frame manifest. Safe to call multiple times.
 */
export function initCardFrameManifest(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    frameManifest = await fetchManifest()
    initialized = true
    for (const cb of listeners) {
      try { cb() } catch { /* ignore */ }
    }
  })()
  return initPromise
}

/**
 * Get the lowres card frame URL for the hand view (256px wide). Returns null if no frame.
 */
export function getCardFrameUrl(mechanicId: string | undefined): string | null {
  if (!initialized || !mechanicId) return null
  if (!frameManifest?.frames[mechanicId]) return null
  return `/assets/cardframes/lowres/${mechanicId}.webp`
}

/**
 * Get the hires card frame URL for animation/expanded view (512px wide). Returns null if no frame.
 */
export function getCardFrameHiresUrl(mechanicId: string | undefined): string | null {
  if (!initialized || !mechanicId) return null
  if (!frameManifest?.frames[mechanicId]) return null
  return `/assets/cardframes/${mechanicId}.webp`
}

/**
 * Get the natural aspect ratio (height/width) for a mechanic's card frame. Returns defaultRatio if unknown.
 */
export function getCardFrameRatio(mechanicId: string | undefined): number {
  if (!initialized || !mechanicId) return DEFAULT_RATIO
  if (!frameManifest?.frames[mechanicId]) return frameManifest?.defaultRatio ?? DEFAULT_RATIO
  return frameManifest.frames[mechanicId].ratio
}

/**
 * Check if a mechanic has a custom card frame.
 */
export function hasCardFrame(mechanicId: string | undefined): boolean {
  if (!initialized || !mechanicId) return false
  return !!(frameManifest?.frames[mechanicId])
}
