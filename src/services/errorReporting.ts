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
}

const ERROR_ENDPOINT = '/api/errors'
const MAX_ERRORS_PER_SESSION = 20

let errorCount = 0

/** Reports an error to the backend error collection endpoint */
function reportError(error: ErrorReport): void {
  if (errorCount >= MAX_ERRORS_PER_SESSION) return
  errorCount++

  // Fire-and-forget — don't let error reporting itself cause crashes
  fetch(ERROR_ENDPOINT, {
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
  })
}
