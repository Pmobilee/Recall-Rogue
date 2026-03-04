import './app.css'
import './ui/styles/overlay.css'
import App from './App.svelte'
import WebGLFallback from './ui/components/WebGLFallback.svelte'
import { mount } from 'svelte'
import { initPlayer, playerSave } from './ui/stores/playerData'
import { currentScreen } from './ui/stores/gameState'
import { get } from 'svelte/store'
import { BALANCE } from './data/balance'

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
  // Lazy-load game engine (Phaser) and facts DB in parallel — keeps them
  // out of the critical render path so the Svelte UI appears instantly.
  const [{ GameManager }, { factsDB }, { gameManagerStore }] = await Promise.all([
    import('./game/GameManager'),
    import('./services/factsDB'),
    import('./game/gameManagerRef'),
  ])

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
}

bootGame()

export default app
