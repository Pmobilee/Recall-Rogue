/**
 * Platform detection service for Recall Rogue.
 *
 * Determines which native APIs are available (Tauri, Capacitor, or web-only).
 * Layout mode (portrait/landscape) is SEPARATE from platform — layout depends
 * on viewport shape, not which native wrapper is active.
 *
 * Detection order:
 *  1. Tauri  — checked via `window.__TAURI_INTERNALS__` (always present in Tauri v2,
 *              since `invoke` depends on it) OR `window.__TAURI__` (present in Tauri v1
 *              and in Tauri v2 when `app.withGlobalTauri: true` is set).
 *              Checking both ensures compatibility across Tauri v1 and v2 regardless of
 *              the `withGlobalTauri` config flag. In production Steam builds that do NOT
 *              set `withGlobalTauri: true`, only `__TAURI_INTERNALS__` is injected —
 *              relying solely on `__TAURI__` causes `isDesktop` to be false and silently
 *              routes multiplayer through the web backend instead of Steam.
 *  2. Capacitor — `window.Capacitor` is injected by the Capacitor runtime
 *  3. Web    — fallback for plain browser or SSR
 */

/** Which native wrapper (if any) is hosting the web app. */
export type Platform = 'mobile' | 'desktop' | 'web';

/**
 * The current platform, detected once at module load time.
 * - `'desktop'`  — running inside a Tauri native window
 * - `'mobile'`   — running inside Capacitor (iOS / Android)
 * - `'web'`      — plain browser, no native wrapper
 */
export const platform: Platform = (() => {
  if (typeof window !== 'undefined') {
    // __TAURI_INTERNALS__ is the reliable Tauri v2 marker (always injected; invoke depends on it).
    // __TAURI__ is the Tauri v1 / v2-withGlobalTauri marker. Check both for full compatibility.
    if ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__) return 'desktop';
    if ((window as any).Capacitor) return 'mobile';
  }
  return 'web';
})();

/** True when running inside a Tauri desktop window. */
export const isDesktop = platform === 'desktop';

/** True when running inside Capacitor on iOS or Android. */
export const isMobile = platform === 'mobile';

/** True when running in a plain browser with no native wrapper. */
export const isWeb = platform === 'web';

/**
 * Whether Steam APIs are available.
 * Currently maps to `isDesktop`; refined when the Steamworks SDK is integrated
 * in AR-80 (Steam Integration).
 */
export const hasSteam = isDesktop;

// -- Memoized live check -------------------------------------------------------

/**
 * Memoized live Tauri detection. Unlike the module-load-time `isDesktop` constant,
 * this defers the check to first call and caches it for the session.
 *
 * Use this instead of the inline `!!(window.__TAURI_INTERNALS__ || window.__TAURI__)`
 * pattern scattered through multiplayer services — a single cached result is cheaper
 * and avoids the packaged-build ordering race where the globals arrive after the IIFE
 * that set `isDesktop` has already evaluated.
 *
 * `pickBackend()` in multiplayerLobbyService and `createTransport()` in
 * multiplayerTransport use this for call-time accuracy.
 */
let _tauriPresent: boolean | null = null;

export function isTauriPresent(): boolean {
  if (_tauriPresent !== null) return _tauriPresent;
  if (typeof window === 'undefined') return (_tauriPresent = false);
  _tauriPresent = !!((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
  return _tauriPresent;
}


/**
 * ULTRATHINK 045: Warn if BroadcastChannel transport is selected while running inside Tauri.
 *
 * Background: BroadcastChannel is browser-only and works only across same-origin tabs.
 * Two Tauri windows are separate processes with separate webview origins (Tauri assigns
 * `tauri://localhost` per window in dev, custom protocol in prod), so BroadcastChannel
 * messages NEVER cross between them. The `?mp` URL flag is a developer convenience for
 * the two-tab browser dev path — when it survives into a packaged Tauri Steam build the
 * lobby silently never connects.
 *
 * The actual `pickBackend()` decision lives in `multiplayerLobbyService.ts` which is
 * owned by Agent A in this wave. To stay in our lane we expose a runtime-warn helper
 * that any caller (lobby UI, debug overlay, Agent A's pickBackend) can use to surface
 * the misconfiguration to the player. Logs once per session via the cached flag so
 * we don't spam the console at every transport tick.
 *
 * Returns true if a warning was logged (i.e. broadcast was selected on Tauri).
 */
let _broadcastInTauriWarned = false;
export function warnIfBroadcastInTauri(selectedBackend: string): boolean {
  if (selectedBackend !== 'broadcast') return false;
  if (!isTauriPresent()) return false;
  if (_broadcastInTauriWarned) return true;
  _broadcastInTauriWarned = true;
  console.warn(
    '[platformService] BroadcastChannel transport selected inside Tauri — messages will NOT cross between Tauri windows. ' +
      'BroadcastChannel works only between same-origin browser tabs. In a packaged Steam build, remove `?mp` from the launch args ' +
      'and let pickBackend route to the Steam P2P backend instead.',
  );
  return true;
}
