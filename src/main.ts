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

import App from './App.svelte'
import WebGLFallback from './ui/components/WebGLFallback.svelte'
import { mount } from 'svelte'
import { initPlayer, playerSave } from './ui/stores/playerData'
import { currentScreen, pendingArtifacts } from './ui/stores/gameState'
import { get } from 'svelte/store'
import { factsDB } from './services/factsDB'
import { gameManagerStore, getGM } from './game/gameManagerRef'
import { getSyncVersion, setSyncVersion } from './services/deltaSync'
import { initI18n } from './i18n/index'

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
      if (screen === 'mining') {
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
const app = mount(App, {
  target: document.getElementById('app')!,
})
document.getElementById('splash')?.remove()

// Initialize player save data
const save = initPlayer('teen')

// Restore pending artifacts from save into the in-memory store
pendingArtifacts.set(save.pendingArtifacts ?? [])

async function bootGame(): Promise<void> {
  // Initialize i18n before rendering any UI (loads locale JSON, sets dir attribute)
  await initI18n()

  // Phase 47: Initialize achievement gallery state from saved data (deferred — doesn't affect first paint)
  const [{ initAchievements }, { achievementService }] = await Promise.all([
    import('./ui/stores/achievements'),
    import('./services/achievementService'),
  ])
  const currentSaveForAchievements = get(playerSave)
  if (currentSaveForAchievements) {
    initAchievements(currentSaveForAchievements.unlockedPaintings ?? [])
    achievementService.init()
  }

  // Start DB init in background — don't block Phaser boot
  const dbPromise = factsDB.init().catch(err => {
    console.error('FactsDB init failed:', err)
    console.warn('FactsDB init failed, continuing without database:', err)
  })

  // Lazy-load Phaser + GameManager (keeps 1.2MB Phaser out of critical path)
  const { GameManager } = await import('./game/GameManager')

  // Boot Phaser engine immediately (parallel with DB load)
  // IMPORTANT: boot() must be called BEFORE setting the store. Setting the store
  // fires Svelte subscribers synchronously (e.g. HubView calls gm.getGaiaManager()),
  // which will crash if boot() hasn't initialized the sub-managers yet.
  const gameManager = GameManager.getInstance()
  gameManager.boot()
  gameManagerStore.set(gameManager)

  // Ensure oxygen tanks are available (replenish if 0)
  const { BALANCE } = await import('./data/balance')
  playerSave.update(s => {
    if (!s) return s
    const oxygen = s.oxygen <= 0 ? BALANCE.STARTING_OXYGEN_TANKS : s.oxygen
    return { ...s, oxygen }
  })

  // BootScene has no preload, so boot completes synchronously.
  // Navigate to appropriate screen immediately.
  // Phase 14: Route through tutorial flow for new players.
  // Skip screen routing when a dev preset is active; App.svelte's async
  // preset loader sets the intended screen once the preset save is applied.
  const urlParams = new URLSearchParams(window.location.search)
  const hasDevPreset = import.meta.env.DEV && urlParams.get('devpreset')
  if (!hasDevPreset) {
    if (!save.tutorialComplete) {
      // Brand new player — start the onboarding cutscene
      currentScreen.set('cutscene')
    } else {
      currentScreen.set('base')
    }
  }

  // Wait for DB to finish loading
  await dbPromise

  // Phase 32.5: Background delta sync — fetch new/updated facts from server
  // This is fire-and-forget; the local cache remains valid even if offline.
  try {
    const since = getSyncVersion()
    const resp = await fetch(`/api/facts/delta?since=${since}&limit=500`, {
      headers: { Accept: 'application/json' },
    })
    if (resp.ok) {
      const delta = await resp.json() as {
        facts: unknown[]
        deletedIds: string[]
        latestVersion: number
        hasMore: boolean
      }
      if (delta.latestVersion > since) {
        setSyncVersion(delta.latestVersion)
        if (delta.facts.length > 0) {
          console.log(`[deltaSync] ${delta.facts.length} new facts synced (version ${delta.latestVersion})`)
        }
      }
    }
  } catch {
    // Offline — continue with cached facts
  }

  // Hide splash screen now that the game is fully initialized (DD-V2 Sub-Phase 20.1)
  const splashScreen = await setupCapacitor()
  if (splashScreen) await splashScreen.hide()

  // Track app_open analytics event (Phase 19.7)
  const currentSave = get(playerSave)
  const { analyticsService } = await import('./services/analyticsService')
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
}

bootGame().then(() => {
  // Handle PWA deep-link shortcuts (?action=dive, ?action=study)
  const params = new URLSearchParams(window.location.search)
  const action = params.get('action')
  if (action === 'dive') {
    // Wait one tick for game to be ready
    setTimeout(() => getGM()?.goToDivePrep(), 100)
  } else if (action === 'study') {
    setTimeout(() => getGM()?.startStudySession(), 100)
  }
})

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
