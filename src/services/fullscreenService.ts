/**
 * Fullscreen toggle service for Recall Rogue.
 *
 * Handles fullscreen toggling across platforms:
 * - Desktop (Tauri): uses the Tauri window API
 * - Web / Steam overlay browser: uses the standard Fullscreen API
 * - Mobile (Capacitor): no-op — Capacitor handles fullscreen natively via the manifest
 *
 * F11 keyboard shortcut is registered in src/main.ts and calls toggleFullscreen().
 */

import { isDesktop, isMobile } from './platformService'

/**
 * Toggle fullscreen mode.
 *
 * Returns the new fullscreen state (true = fullscreen, false = windowed).
 * Returns false and logs a warning if the toggle fails.
 */
export async function toggleFullscreen(): Promise<boolean> {
  // Mobile: Capacitor manages fullscreen via AndroidManifest/Info.plist — no runtime toggle.
  if (isMobile) return false

  if (isDesktop) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      const wasFullscreen = await win.isFullscreen()
      await win.setFullscreen(!wasFullscreen)
      return !wasFullscreen
    } catch (e) {
      console.warn('[Fullscreen] Tauri fullscreen toggle failed:', e)
      return false
    }
  }

  // Web fallback — standard Fullscreen API
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      return true
    } else {
      await document.exitFullscreen()
      return false
    }
  } catch (e) {
    console.warn('[Fullscreen] Web Fullscreen API failed:', e)
    return false
  }
}

/**
 * Check whether the app is currently in fullscreen mode.
 *
 * On desktop uses the Tauri window API; on web checks document.fullscreenElement.
 */
export async function isFullscreen(): Promise<boolean> {
  if (isMobile) return false

  if (isDesktop) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      return await getCurrentWindow().isFullscreen()
    } catch {
      return false
    }
  }

  return !!document.fullscreenElement
}
