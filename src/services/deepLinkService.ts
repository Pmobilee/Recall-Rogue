/**
 * @file deepLinkService.ts
 * Parses incoming deep link URLs and dispatches navigation events.
 * Handles both Capacitor app-launched-from-url and in-browser URL params.
 *
 * Route patterns:
 *   terragacha://invite/:code       → show ReferralOnboarding, pre-fill code
 *   terragacha://badge/:pid/:bid    → show BadgeDetail modal
 *   terragacha://fact/:factId       → open KnowledgeTree to that fact
 *   https://terragacha.com/invite/:code  → same as above (universal link)
 */

export type DeepLinkRoute =
  | { type: 'invite';  code: string }
  | { type: 'badge';   playerId: string; badgeId: string }
  | { type: 'fact';    factId: string }
  | { type: 'unknown' }

/**
 * Parse a deep link URL into a typed route object.
 * Returns `{ type: 'unknown' }` for unrecognized patterns rather than throwing.
 *
 * @param rawUrl - The full URL string (custom scheme or https).
 * @returns Typed route or unknown sentinel.
 */
export function parseDeepLink(rawUrl: string): DeepLinkRoute {
  let url: URL
  try {
    // Normalize custom scheme to https for URL parsing
    const normalised = rawUrl.replace(/^terragacha:\/\//, 'https://terragacha.com/')
    url = new URL(normalised)
  } catch {
    return { type: 'unknown' }
  }

  const parts = url.pathname.split('/').filter(Boolean)
  if (!parts.length) return { type: 'unknown' }

  switch (parts[0]) {
    case 'invite': {
      const code = parts[1]
      // Validate: alphanumeric + hyphens, 6-32 chars
      if (!code || !/^[a-zA-Z0-9-]{6,32}$/.test(code)) return { type: 'unknown' }
      return { type: 'invite', code }
    }
    case 'badge': {
      const playerId = parts[1]
      const badgeId  = parts[2]
      if (!playerId || !badgeId) return { type: 'unknown' }
      if (!/^[\w-]{1,64}$/.test(playerId) || !/^[\w-]{1,64}$/.test(badgeId)) return { type: 'unknown' }
      return { type: 'badge', playerId, badgeId }
    }
    case 'fact': {
      const factId = parts[1]
      if (!factId || !/^[\w-]{1,64}$/.test(factId)) return { type: 'unknown' }
      return { type: 'fact', factId }
    }
    default:
      return { type: 'unknown' }
  }
}

/**
 * Register platform-specific deep link listeners.
 * Call once on app init from App.svelte.
 * Dispatches a custom DOM event `terra:deeplink` with the parsed route.
 *
 * On web: reads `?link=` query parameter from window.location.
 * On Capacitor: listens for `appUrlOpen` from @capacitor/core App plugin.
 */
export function registerDeepLinkListener(): void {
  // Web: check URL on load
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const linkParam = params.get('link')
    if (linkParam) {
      try {
        const decoded = decodeURIComponent(linkParam)
        const route = parseDeepLink(decoded)
        if (route.type !== 'unknown') {
          window.dispatchEvent(new CustomEvent('terra:deeplink', { detail: route }))
        }
      } catch { /* malformed — ignore */ }
    }

    // Also handle the full page URL as a potential universal link
    const route = parseDeepLink(window.location.href)
    if (route.type !== 'unknown') {
      window.dispatchEvent(new CustomEvent('terra:deeplink', { detail: route }))
    }
  }

  // Capacitor: listen for appUrlOpen
  try {
    // Use dynamic registration pattern from Phase 20 (no @capacitor/app import)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPlugin } = require('@capacitor/core') as typeof import('@capacitor/core')
    const App = registerPlugin<{ addListener: (event: string, cb: (data: { url: string }) => void) => void }>('App')
    App.addListener('appUrlOpen', (data: { url: string }) => {
      const route = parseDeepLink(data.url)
      if (route.type !== 'unknown' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('terra:deeplink', { detail: route }))
      }
    })
  } catch { /* Capacitor not available on web — ignore */ }
}
