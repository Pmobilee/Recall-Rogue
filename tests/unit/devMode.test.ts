/**
 * devMode store — unit tests
 *
 * HIGH-7 regression suite (2026-04-10):
 * Verifies that dev-only UI is gated on the dedicated ?dev=true flag (or
 * VITE_DEV_TOOLS env var) and NOT on devpreset.
 *
 * Root cause: HubScreen.svelte dev-btn-row had no visibility guard at all,
 * so dev buttons shipped in ?devpreset=post_tutorial builds that playtests
 * and end-users access. See docs/gotchas.md §2026-04-10 for the full incident.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { get } from 'svelte/store'

// ─── URL + window shim ────────────────────────────────────────────────────────
// The devMode store reads window.location.search on init. We mock the URL per test.

const originalWindow = globalThis.window

function mockWindowSearch(search: string): void {
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        search,
      },
    },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  // Reset any vi.mock modules so the store is re-imported fresh per test
  vi.resetModules()
})

afterEach(() => {
  // Restore original window
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    writable: true,
    configurable: true,
  })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('devMode store — URL-based gating', () => {
  it('is false with no URL params', async () => {
    mockWindowSearch('')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(false)
  })

  it('is false when only devpreset is set (NOT a dev flag)', async () => {
    mockWindowSearch('?devpreset=post_tutorial')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(false)
  })

  it('is false when skipOnboarding is set without dev flag', async () => {
    mockWindowSearch('?skipOnboarding=true&devpreset=post_tutorial')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(false)
  })

  it('is false when botMode is set without dev flag', async () => {
    mockWindowSearch('?botMode=true')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(false)
  })

  it('is true when ?dev=true is set', async () => {
    mockWindowSearch('?dev=true')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(true)
  })

  it('is true when ?dev=true is combined with devpreset', async () => {
    mockWindowSearch('?skipOnboarding=true&devpreset=post_tutorial&dev=true')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(true)
  })

  it('is false when ?dev=false is set', async () => {
    mockWindowSearch('?dev=false')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(false)
  })

  it('is false when ?dev=1 is set (only "true" literal is valid)', async () => {
    mockWindowSearch('?dev=1')
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(false)
  })
})

describe('devMode store — absence of window', () => {
  it('returns false when window is undefined (SSR/node context)', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const { devMode } = await import('../../src/ui/stores/devMode')
    expect(get(devMode)).toBe(false)
  })
})
