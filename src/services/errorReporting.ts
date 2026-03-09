/**
 * Error reporting service — Phase 20.12 (DD-V2-221)
 *
 * Lightweight error capture for uncaught exceptions and unhandled promise rejections.
 * Designed as a thin abstraction that can be backed by Sentry or a custom endpoint.
 * No third-party SDK required — sends errors to the game's own API server.
 */

interface ErrorReport {
  message: string
  stack?: string
  context: string
  timestamp: number
  userAgent: string
  url: string
  platform: 'web' | 'android' | 'ios'
  appVersion: string
}

const MAX_ERRORS_PER_SESSION = 20
const APP_VERSION = '0.1.0'

let errorCount = 0

function resolveApiBase(): string {
  const env = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env
  if (env?.VITE_API_BASE_URL) return env.VITE_API_BASE_URL

  const host = window.location.hostname
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local')

  if (isLocal) return `${window.location.protocol}//${host}:3001`
  return window.location.origin
}

function getPlatform(): 'web' | 'android' | 'ios' {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios'
  if (ua.includes('android')) return 'android'
  return 'web'
}

/** Reports an error to the backend error collection endpoint */
function reportError(error: ErrorReport): void {
  if (errorCount >= MAX_ERRORS_PER_SESSION) return
  errorCount++
  const endpoint = `${resolveApiBase()}/api/errors`

  // Fire-and-forget — don't let error reporting itself cause crashes
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(error),
  }).catch(() => {
    // Silently swallow — we can't report errors about error reporting
  })
}

/** Initializes global error handlers for uncaught exceptions and unhandled rejections */
export function initErrorReporting(): void {
  window.addEventListener('error', (event) => {
    reportError({
      message: event.message,
      stack: event.error?.stack,
      context: 'uncaught_exception',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      platform: getPlatform(),
      appVersion: APP_VERSION,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportError({
      message: reason?.message ?? String(reason),
      stack: reason?.stack,
      context: 'unhandled_rejection',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      platform: getPlatform(),
      appVersion: APP_VERSION,
    })
  })
}

/** Manually capture and report an error with context */
export function captureError(error: Error, context: string): void {
  reportError({
    message: error.message,
    stack: error.stack,
    context,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    platform: getPlatform(),
    appVersion: APP_VERSION,
  })
}
