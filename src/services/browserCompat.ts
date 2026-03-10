/**
 * Browser compatibility detection service.
 *
 * Detects features used by Recall Rogue and reports compatibility issues
 * to the error reporting service and as a console warning.
 *
 * Called once at boot in main.ts.
 */

export interface CompatReport {
  webgl: boolean
  serviceWorker: boolean
  indexedDB: boolean
  webAudio: boolean
  webShare: boolean
  /** Estimated browser engine */
  engine: 'chromium' | 'gecko' | 'webkit' | 'unknown'
  /** Whether all required features are present */
  isSupported: boolean
}

/** Detect the rendering engine from navigator.userAgent. */
function detectEngine(): CompatReport['engine'] {
  const ua = navigator.userAgent
  if (ua.includes('Chrome') || ua.includes('Edg/')) return 'chromium'
  if (ua.includes('Firefox')) return 'gecko'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'webkit'
  return 'unknown'
}

/**
 * Run a compatibility check and return a report.
 * Required features: WebGL, ServiceWorker.
 * Optional features: IndexedDB, WebAudio, WebShare.
 */
export function checkBrowserCompat(): CompatReport {
  const webgl = (() => {
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl') || c.getContext('webgl2') || c.getContext('experimental-webgl'))
    } catch { return false }
  })()

  const serviceWorker = 'serviceWorker' in navigator

  const indexedDB = (() => {
    try { return !!window.indexedDB } catch { return false }
  })()

  const webAudio = typeof window.AudioContext !== 'undefined' || typeof (window as unknown as Record<string, unknown>).webkitAudioContext !== 'undefined'

  const webShare = 'share' in navigator

  const engine = detectEngine()
  const isSupported = webgl && serviceWorker

  return { webgl, serviceWorker, indexedDB, webAudio, webShare, engine, isSupported }
}

/**
 * Apply engine-specific workarounds.
 * Called once at boot after checkBrowserCompat().
 */
export function applyCompatPatches(report: CompatReport): void {
  // WebKit: ensure AudioContext resumes after user gesture
  if (report.engine === 'webkit') {
    document.addEventListener('touchstart', () => {
      const ctx = (window as unknown as Record<string, unknown>).__terraAudioContext
      if (ctx && (ctx as { state?: string; resume?: () => void }).state === 'suspended') {
        (ctx as { state?: string; resume?: () => void }).resume?.()
      }
    }, { once: true })
  }

  // Firefox: sql.js WASM needs ArrayBuffer, not SharedArrayBuffer — no action needed
  // but document that we tested it.

  // All engines: log compat report in dev
  if (import.meta.env.DEV) {
    console.info('[Compat]', report)
  }
}
