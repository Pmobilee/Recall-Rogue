/**
 * devMode store — tracks whether the developer UI overlay is enabled.
 *
 * GATING RULE: Dev-only UI (debug buttons, internal testing shortcuts)
 * MUST be gated on this store. NEVER gate on `devpreset` or `botMode` —
 * those are playtest entry points, not developer-tools flags.
 *
 * Activation: ?dev=true URL param OR VITE_DEV_TOOLS env var.
 *
 * See .claude/rules/ui-layout.md §"Dev-only UI gating" and
 * docs/gotchas.md §2026-04-10 for the incident that required this.
 */

import { readable } from 'svelte/store'

/** True when the dev-tools overlay should be visible. */
export const devMode = readable<boolean>(false, (set) => {
  if (typeof window === 'undefined') {
    set(false)
    return
  }

  // Activation: ?dev=true URL param
  const urlParams = new URLSearchParams(window.location.search)
  const urlFlag = urlParams.get('dev') === 'true'

  // Activation: VITE_DEV_TOOLS env var (set at build time, e.g. VITE_DEV_TOOLS=1)
  const envFlag =
    (import.meta.env as Record<string, string>)['VITE_DEV_TOOLS'] === '1' ||
    (import.meta.env as Record<string, string>)['VITE_DEV_TOOLS'] === 'true'

  set(urlFlag || envFlag)
})
