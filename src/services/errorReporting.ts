/**
 * Error reporting service — Phase 20.12 (DD-V2-221)
 *
 * Lightweight error capture for uncaught exceptions and unhandled promise rejections.
 * Designed as a thin abstraction that can be backed by Sentry or a custom endpoint.
 * No third-party SDK required — sends errors to the game's own API server.
 *
 * On Steam/desktop (Tauri), there is no backend server, so HTTP reporting is skipped.
 * Errors are logged to the console with a [ErrorReport] prefix instead.
 */

// Vite injects this at build time via the `define` option in vite.config.ts.
declare const __RR_VERSION__: string;

import { isDesktop } from './platformService'

interface ErrorReport {
  message: string
  stack?: string
  context: string
  timestamp: number
  userAgent: string
  url: string
  platform: 'web' | 'android' | 'ios' | 'desktop'
  appVersion: string
}

const MAX_ERRORS_PER_SESSION = 20

/** App version from Vite define injection, falls back to 'unknown' if not set. */
const APP_VERSION: string = (() => {
  try {
    return typeof __RR_VERSION__ !== 'undefined' ? __RR_VERSION__ : 'unknown'
  } catch {
    return 'unknown'
  }
})()

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

function getPlatform(): 'web' | 'android' | 'ios' | 'desktop' {
  if (isDesktop) return 'desktop'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios'
  if (ua.includes('android')) return 'android'
  return 'web'
}

/** Reports an error to the backend error collection endpoint, or logs it on desktop. */
function reportError(error: ErrorReport): void {
  if (errorCount >= MAX_ERRORS_PER_SESSION) return
  errorCount++

  // On Steam/desktop there is no backend server — log to console instead of HTTP POST.
  if (isDesktop) {
    console.error(
      `[ErrorReport] ${error.context} | v${error.appVersion} | ${new Date(error.timestamp).toISOString()}`,
      '\nMessage:', error.message,
      '\nStack:', error.stack ?? '(none)',
      '\nURL:', error.url,
    )
    return
  }

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
