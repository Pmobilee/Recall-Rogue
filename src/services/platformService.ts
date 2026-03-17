/**
 * Platform detection service for Recall Rogue.
 *
 * Determines which native APIs are available (Tauri, Capacitor, or web-only).
 * Layout mode (portrait/landscape) is SEPARATE from platform — layout depends
 * on viewport shape, not which native wrapper is active.
 *
 * Detection order:
 *  1. Tauri  — `window.__TAURI__` is injected by the Tauri runtime
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
  if (typeof window !== 'undefined' && (window as any).__TAURI__) return 'desktop';
  if (typeof window !== 'undefined' && (window as any).Capacitor) return 'mobile';
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
