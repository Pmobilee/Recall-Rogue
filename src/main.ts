import './app.css'
import './ui/styles/overlay.css'
import App from './App.svelte'
import WebGLFallback from './ui/components/WebGLFallback.svelte'
import { mount } from 'svelte'
import { initPlayer, playerSave } from './ui/stores/playerData'
import { currentScreen } from './ui/stores/gameState'
import { get } from 'svelte/store'
import { BALANCE } from './data/balance'
import { analyticsService } from './services/analyticsService'
import { GameManager } from './game/GameManager'
import { factsDB } from './services/factsDB'
import { gameManagerStore } from './game/gameManagerRef'
import { getSyncVersion, setSyncVersion } from './services/deltaSync'

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

// Initialize player save data
const save = initPlayer('teen')

// Ensure oxygen tanks are available (replenish if 0)
playerSave.update(s => {
  if (!s) return s
  const oxygen = s.oxygen <= 0 ? BALANCE.STARTING_OXYGEN_TANKS : s.oxygen
  return { ...s, oxygen }
})

async function bootGame(): Promise<void> {
  // Start DB init in background — don't block Phaser boot
  const dbPromise = factsDB.init().catch(err => {
    console.warn('FactsDB init failed, continuing without database:', err)
  })

  // Boot Phaser engine immediately (parallel with DB load)
  const gameManager = GameManager.getInstance()
  gameManagerStore.set(gameManager)
  gameManager.boot()

  // BootScene has no preload, so boot completes synchronously.
  // Navigate to appropriate screen immediately.
  // Phase 14: Route through tutorial flow for new players
  if (!save.tutorialComplete) {
    // Brand new player — start the onboarding cutscene
    currentScreen.set('cutscene')
  } else {
    currentScreen.set('base')
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

bootGame()

// Register the Service Worker for offline asset caching.
// This is an optional progressive enhancement — failure is silent so the game
// continues to work in environments where SW is not supported or blocked.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Silent failure — SW is an optional enhancement, not a hard requirement.
  })
}

export default app
