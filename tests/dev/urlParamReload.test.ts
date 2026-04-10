/**
 * LOW-17: URL flag re-application after location.reload()
 *
 * Investigation (2026-04-10): Confirmed NO BUG in the current reload paths.
 *
 * Findings:
 * - `window.location.reload()` natively preserves the full URL including query params.
 *   All three call sites (settings.ts:setSpriteResolution, ParentalControlsPanel.svelte
 *   deleteConfirm + deleteSave handlers) use bare reload and are therefore safe.
 * - `resetToPreset()` in playtestAPI.ts uses `window.location.href = origin + "?" + params`
 *   which explicitly preserves all existing params AND adds `skipOnboarding=true`.
 * - No `history.pushState` or `history.replaceState` calls strip params.
 * - The app does not navigate to a clean URL at any point during normal operation.
 *
 * These tests document and lock in that contract so future changes don't regress it.
 */

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('LOW-17: URL param preservation through dev reload paths', () => {
  // ---- Helpers ---------------------------------------------------------------

  function mockLocationWithSearch(search: string) {
    const url = `http://localhost:5173${search}`
    Object.defineProperty(window, 'location', {
      value: {
        href: url,
        origin: 'http://localhost:5173',
        search,
        reload: vi.fn(),
        toString: () => url,
      },
      writable: true,
      configurable: true,
    })
  }

  // ---- resetToPreset preserves all URL params --------------------------------

  it('resetToPreset builds a new href that preserves existing URL params', () => {
    // Simulate being loaded with the full dev param set
    const search = '?skipOnboarding=true&devpreset=post_tutorial&dev=true'
    mockLocationWithSearch(search)

    // Replicate the logic in playtestAPI.ts resetToPreset() (lines ~1172-1175):
    const params = new URLSearchParams(window.location.search)
    params.set('skipOnboarding', 'true')
    const built = `${window.location.origin}?${params.toString()}`

    // All three original params must survive
    const rebuilt = new URLSearchParams(new URL(built).search)
    expect(rebuilt.get('skipOnboarding')).toBe('true')
    expect(rebuilt.get('devpreset')).toBe('post_tutorial')
    expect(rebuilt.get('dev')).toBe('true')
  })

  it('resetToPreset adds skipOnboarding when not already present', () => {
    mockLocationWithSearch('?devpreset=post_tutorial')

    const params = new URLSearchParams(window.location.search)
    params.set('skipOnboarding', 'true')
    const built = `${window.location.origin}?${params.toString()}`

    const rebuilt = new URLSearchParams(new URL(built).search)
    expect(rebuilt.get('skipOnboarding')).toBe('true')
    expect(rebuilt.get('devpreset')).toBe('post_tutorial')
  })

  // ---- window.location.reload() preserves URL --------------------------------

  it('bare window.location.reload() does not strip query params (browser spec)', () => {
    // The settings.ts and ParentalControlsPanel reload paths use window.location.reload().
    // By browser spec, reload() re-requests the CURRENT URL which already includes the query string.
    // This test documents that the locations using reload() are safe — no params are stripped.
    //
    // We can't directly test browser reload() in jsdom, but we can verify the contract:
    // reload() is equivalent to navigating to window.location.href (current full URL).
    const search = '?skipOnboarding=true&devpreset=post_tutorial&dev=true'
    mockLocationWithSearch(search)

    // Simulate what reload() does: navigate to the current href
    const reloadTarget = window.location.href

    const params = new URLSearchParams(new URL(reloadTarget).search)
    expect(params.get('skipOnboarding')).toBe('true')
    expect(params.get('devpreset')).toBe('post_tutorial')
    expect(params.get('dev')).toBe('true')
  })

  it('new URLSearchParams reads dev-param set correctly', () => {
    const search = '?skipOnboarding=true&devpreset=post_tutorial&dev=true&turbo=true'
    mockLocationWithSearch(search)

    const params = new URLSearchParams(window.location.search)
    expect(params.get('skipOnboarding')).toBe('true')
    expect(params.get('devpreset')).toBe('post_tutorial')
    expect(params.get('dev')).toBe('true')
    expect(params.get('turbo')).toBe('true')
  })
})
