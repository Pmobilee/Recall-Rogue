/**
 * devMode store — tracks whether the developer UI overlay is enabled.
 *
 * GATING RULE: Dev-only UI (debug buttons, internal testing shortcuts)
 * MUST be gated on this store. NEVER gate on `devpreset` or `botMode` —
 * those are playtest entry points, not developer-tools flags.
 *
 * Activation (any of the following):
 *   1. ?dev=true URL param
 *   2. VITE_DEV_TOOLS=1 build-time env var
 *   3. localStorage.getItem('rr-dev-mode') === '1'
 *   4. Runtime keyboard chord Cmd+Shift+D (macOS) or Ctrl+Shift+D (Windows/Linux) —
 *      toggles the store AND persists the decision to localStorage.
 *
 * The keyboard chord is intentional — Tauri release builds load from
 * tauri://localhost/index.html with no accessible query string, and
 * VITE_DEV_TOOLS wasn't set at build time for test macOS builds. Without a
 * runtime activation path the debug overlay is invisible in production builds.
 *
 * See .claude/rules/ui-layout.md §"Dev-only UI gating" and
 * docs/gotchas.md §2026-04-10 for the incident that required this,
 * and docs/gotchas.md §BUG9-2026-04-22c for the Steam release invisibility fix.
 */

import { writable } from 'svelte/store'

// ── Initialise from all three static activation sources ──────────────────────

function readInitialDevMode(): boolean {
  if (typeof window === 'undefined') return false

  // 1. ?dev=true URL param
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('dev') === 'true') return true

  // 2. VITE_DEV_TOOLS env var (set at build time, e.g. VITE_DEV_TOOLS=1)
  const env = import.meta.env as Record<string, string>
  if (env['VITE_DEV_TOOLS'] === '1' || env['VITE_DEV_TOOLS'] === 'true') return true

  // 3. Persisted toggle from a prior keyboard-chord activation
  try {
    if (localStorage.getItem('rr-dev-mode') === '1') return true
  } catch {
    // localStorage may be unavailable (private browsing, etc.) — ignore
  }

  return false
}

/** True when the dev-tools overlay should be visible. */
export const devMode = writable<boolean>(readInitialDevMode())

// ── Runtime keyboard chord ────────────────────────────────────────────────────

/**
 * Register the global Cmd+Shift+D / Ctrl+Shift+D keyboard chord that toggles
 * devMode at runtime. This is the primary activation path in Tauri release builds
 * where URL params and build-time env vars are unavailable.
 *
 * Safe to call multiple times — only registers once via a module-level guard.
 * No-op in non-browser environments (SSR, tests).
 */
let _chordRegistered = false

export function registerDevModeChord(): void {
  if (typeof window === 'undefined' || _chordRegistered) return
  _chordRegistered = true

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Cmd+Shift+D on macOS; Ctrl+Shift+D on Windows/Linux
    const isMeta = e.metaKey || e.ctrlKey
    if (isMeta && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      devMode.update((current) => {
        const next = !current
        try {
          if (next) {
            localStorage.setItem('rr-dev-mode', '1')
          } else {
            localStorage.removeItem('rr-dev-mode')
          }
        } catch {
          // localStorage unavailable — toggle only persists for this session
        }
        console.log('[devMode] toggled via keychord →', next)
        return next
      })
    }
  })
}

// Auto-register the chord when this module loads in a browser context.
registerDevModeChord()
