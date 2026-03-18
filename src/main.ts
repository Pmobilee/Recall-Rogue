import './app.css'
import './ui/styles/overlay.css'

// CSS code-splitting: load desktop.css only on non-mobile screens (saves ~4KB on mobile)
if (window.matchMedia('(min-width: 768px)').matches) {
  import('./ui/styles/desktop.css')
}

// CSS code-splitting: load rtl.css only when an RTL locale is active (saves ~3KB for LTR users)
// Uses the same storage key as src/i18n/index.ts (LOCALE_STORAGE_KEY = 'terra_ui_locale').
const rtlLocales = new Set(['ar', 'he'])
const storedLocale = localStorage.getItem('terra_ui_locale') ?? 'en'
if (rtlLocales.has(storedLocale)) {
  import('./ui/styles/rtl.css')
}

import CardApp from './CardApp.svelte'
import WebGLFallback from './ui/components/WebGLFallback.svelte'
import { mount } from 'svelte'
import { initPlayer, playerSave } from './ui/stores/playerData'
import { currentScreen } from './ui/stores/gameState'
import { get } from 'svelte/store'
import { difficultyMode, onboardingState } from './services/cardPreferences'
import { STORY_MODE_FORCED_RUNS } from './data/balance'
import { factsDB } from './services/factsDB'
import { initI18n } from './i18n/index'
import { initAccessibilityManager } from './services/accessibilityManager'
import { initCardAudio } from './services/cardAudioManager'
import { initErrorReporting } from './services/errorReporting'
import { initCardbackManifest } from './ui/utils/cardbackManifest'
import { initCardFrameManifest } from './ui/utils/cardFrameManifest'
import { syncService } from './services/syncService'
import { save as persistRaw } from './services/saveService'
import { analyticsService } from './services/analyticsService'
import { rescheduleNotificationsFromPlayerState } from './services/gameFlowController'
import { initSyncDurabilityListener } from './services/syncDurabilityService'
import { initScoreSubmissionQueue } from './services/scoreSubmissionQueue'

/**
 * Sets up Capacitor-specific integrations: Android hardware back button handling
 * and splash screen management. Uses dynamic imports so the app never crashes on web.
 * Only @capacitor/core and @capacitor/splash-screen are imported (both installed).
 * The App plugin (back button) is accessed via Capacitor's registerPlugin to avoid
 * importing the uninstalled @capacitor/app package.
 *
 * @returns The SplashScreen plugin instance if running natively, otherwise null.
 */
const setupCapacitor = async (): Promise<{ hide: () => Promise<void> } | null> => {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return null

    const { SplashScreen } = await import('@capacitor/splash-screen')

    // Register the App plugin via Capacitor's bridge (avoids needing @capacitor/app installed)
    const CapApp = registerPlugin<{
      addListener(event: string, cb: (data: { canGoBack: boolean }) => void): void
      exitApp(): void
    }>('App')

    // Handle Android hardware back button
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const screen = document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? ''
      if (screen === 'combat') {
        document.dispatchEvent(new CustomEvent('game:back-pressed'))
        return
      }
      if (screen === 'quiz') {
        return  // Ignore back during quiz
      }
      if (!canGoBack) {
        CapApp.exitApp()
      }
    })

    return SplashScreen
  } catch {
    return null
  }
}

/**
 * Checks whether the current browser supports WebGL rendering.
 * @returns true if WebGL is available, false otherwise
 */
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

// Run browser compatibility checks and apply engine-specific patches (deferred — not needed before first paint)
import('./services/browserCompat').then(({ checkBrowserCompat, applyCompatPatches }) => {
  const report = checkBrowserCompat()
  applyCompatPatches(report)
})

// Start Core Web Vitals collection (deferred — can begin after first paint)
import('./services/perfService').then(m => m.perfService.observe())

// Initialize dev debug bridge (window.__terraDebug, window.__terraLog) — DEV only, deferred
if (import.meta.env.DEV) {
  import('./dev/debugBridge').then(m => m.initDebugBridge())
}

// Prevent long-press context menu on mobile
document.addEventListener('contextmenu', (e) => e.preventDefault())

// Show fallback if WebGL is unavailable — game requires it (DD-V2-190)
if (!isWebGLSupported()) {
  mount(WebGLFallback, { target: document.getElementById('app')! })
  throw new Error('WebGL not supported — halting boot')
}

// Mount Svelte UI overlay
const app = mount(CardApp, {
  target: document.getElementById('app')!,
})
document.getElementById('splash')?.remove()

// Initialize global accessibility + audio settings before user interaction.
initAccessibilityManager()
initCardAudio()
initSyncDurabilityListener()
initScoreSubmissionQueue()

// Start loading cardback manifest in background (enables live reload in dev)
initCardbackManifest()
initCardFrameManifest()

// Launch error capture in production (or when explicitly enabled in dev).
if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true') {
  initErrorReporting()
}

// Initialize player save data
const save = initPlayer('teen')

// Migrate legacy difficulty values from old saves + enforce relaxed during forced runs
{
  const _onb = get(onboardingState)
  const currentMode = get(difficultyMode)
  // Migrate legacy difficulty values from old saves
  if (currentMode === ('explorer' as any) || currentMode === ('standard' as any) || currentMode === ('scholar' as any)) {
    difficultyMode.set(currentMode === ('explorer' as any) ? 'relaxed' : 'normal')
  }
  // Force relaxed mode during the first N runs
  if (_onb.runsCompleted < STORY_MODE_FORCED_RUNS) {
    difficultyMode.set('normal')
  }
}

// pendingArtifacts store removed — card roguelite doesn't use artifact system

async function bootGame(): Promise<void> {
  // Initialize i18n before rendering any UI (loads locale JSON, sets dir attribute)
  await initI18n()

  // Start DB init in background — don't block game boot
  const dbPromise = factsDB.init().catch(err => {
    console.error('FactsDB init failed:', err)
    console.warn('FactsDB init failed, continuing without database:', err)
  })

  // Navigate to main menu (skip when a dev preset is active)
  const urlParams = new URLSearchParams(window.location.search)
  const hasDevPreset = import.meta.env.DEV && urlParams.get('devpreset')

  // Turbo mode: skip all animations for bot testing (game logic unchanged)
  const turboMode = import.meta.env.DEV && urlParams.has('turbo');
  if (turboMode) {
    (globalThis as Record<symbol, unknown>)[Symbol.for('terra:turboMode')] = true;
  }
  if (!hasDevPreset) {
    currentScreen.set('hub')
  }

  // Pull cloud save on launch for authenticated users, then merge locally.
  try {
    const remote = await syncService.pullFromCloud()
    if (remote) {
      const local = get(playerSave)
      const merged = local ? syncService.fieldLevelMerge(local, remote) : remote
      playerSave.set(merged)
      persistRaw(merged)
    }
  } catch {
    // Silent fallback to local state.
  }

  // Wait for DB to finish loading
  await dbPromise

  // Hide splash screen now that the game is fully initialized
  const splashScreen = await setupCapacitor()
  if (splashScreen) await splashScreen.hide()

  // Track app_open analytics event
  const currentSave = get(playerSave)
  analyticsService.track({
    name: 'app_open',
    properties: {
      platform: 'web',
      app_version: '0.1.0',
      launch_type: 'cold',
      client_ts: Date.now(),
      has_existing_save: currentSave !== null,
      age_bracket: currentSave?.ageRating === 'kid' ? 'under_13' : (currentSave?.ageRating ?? 'unknown'),
    },
  })

  // Reschedule local push notifications on every app open.
  rescheduleNotificationsFromPlayerState()

  // Auto-load scenario from URL param — dev only.
  // Usage: ?scenario=combat-boss  or  ?scenario=shop
  if (import.meta.env.DEV) {
    const scenarioParam = urlParams.get('scenario')
    if (scenarioParam) {
      // Wait for debug bridge (which registers __terraScenario) to be ready, then load.
      // The bridge is initialized via a deferred import above, so we poll briefly.
      const tryLoadScenario = async (attemptsLeft: number): Promise<void> => {
        const scenarioApi = (window as any).__terraScenario
        if (scenarioApi) {
          console.log(`[dev] Auto-loading scenario from URL: "${scenarioParam}"`)
          const result = await scenarioApi.load(scenarioParam)
          if (!result.ok) {
            console.warn(`[dev] Scenario "${scenarioParam}" failed:`, result.message)
          }
        } else if (attemptsLeft > 0) {
          setTimeout(() => tryLoadScenario(attemptsLeft - 1), 200)
        } else {
          console.warn('[dev] __terraScenario not available — scenario URL param ignored')
        }
      }
      setTimeout(() => tryLoadScenario(20), 500)
    }
  }
}

bootGame()

// Service Worker management.
// In dev mode, actively unregister any stale SW and clear caches — the cache-first
// strategy serves stale modules that break HMR and prevent code changes from reaching
// the browser. In production, register the SW for offline asset caching.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Dev mode: tear down any existing SW to prevent stale cache issues
    navigator.serviceWorker.getRegistrations().then(regs => {
      for (const r of regs) r.unregister()
    }).catch(() => {})
    caches.keys().then(names => {
      for (const n of names) caches.delete(n)
    }).catch(() => {})
  } else {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent failure — SW is an optional enhancement, not a hard requirement.
    })
  }
}

export default app
