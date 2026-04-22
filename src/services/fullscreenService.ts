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

/**
 * Common 16:9 windowed resolutions offered in the Settings resolution dropdown.
 * Values are LOGICAL pixels — DPI scaling is handled by the OS.
 */
export const WINDOWED_RESOLUTIONS = [
  { label: '1280 × 720',  width: 1280, height: 720  },
  { label: '1600 × 900',  width: 1600, height: 900  },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '2560 × 1440', width: 2560, height: 1440 },
  { label: '3840 × 2160', width: 3840, height: 2160 },
] as const

export type WindowedResolution = typeof WINDOWED_RESOLUTIONS[number]

/**
 * Set the Tauri window to a logical pixel size (windowed mode only).
 * No-op on mobile, web, or when the window is currently fullscreen.
 * Un-maximizes first so setSize is honored on Windows.
 * Returns true on success.
 */
export async function setWindowResolution(width: number, height: number): Promise<boolean> {
  if (isMobile || !isDesktop) return false
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const { LogicalSize } = await import('@tauri-apps/api/dpi')
    const win = getCurrentWindow()
    if (await win.isFullscreen()) return false
    if (await win.isMaximized()) await win.unmaximize()
    await win.setSize(new LogicalSize(width, height))
    await win.center()
    return true
  } catch (e) {
    console.warn('[Window] setWindowResolution failed:', e)
    return false
  }
}

/**
 * Current window inner size in LOGICAL pixels, or null on web / mobile / failure.
 * Used by SettingsPanel to preselect the dropdown value.
 */
export async function getWindowResolution(): Promise<{ width: number; height: number } | null> {
  if (isMobile || !isDesktop) return null
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    const physical = await win.innerSize()
    const scale = await win.scaleFactor()
    return {
      width: Math.round(physical.width / scale),
      height: Math.round(physical.height / scale),
    }
  } catch {
    return null
  }
}
