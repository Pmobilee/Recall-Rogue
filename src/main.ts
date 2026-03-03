import './app.css'
import App from './App.svelte'
import WebGLFallback from './ui/components/WebGLFallback.svelte'
import { mount } from 'svelte'
import { GameManager } from './game/GameManager'
import { addLearnedFact, initPlayer, persistPlayer, playerSave } from './ui/stores/playerData'
import { currentScreen } from './ui/stores/gameState'
import { get } from 'svelte/store'
import { BALANCE } from './data/balance'
import { factsDB } from './services/factsDB'

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
  gameManager.boot()

  // When Phaser finishes booting, navigate to appropriate screen
  const game = gameManager.getGame()
  if (game) {
    game.events.on('boot-complete', () => {
      // Show main menu for first-time players, skip to base for returning players
      const isNewPlayer = save.stats.totalDivesCompleted === 0 && save.learnedFacts.length <= 6
      currentScreen.set(isNewPlayer ? 'mainMenu' : 'base')
    })
  }

  // Wait for DB to finish loading before seeding starter facts
  await dbPromise

  // Seed starter facts if DB is available and player has none learned yet
  if (factsDB.isReady() && save.learnedFacts.length === 0) {
    const starterVocab = factsDB.getByType('vocabulary').slice(0, 3)
    const starterFacts = factsDB.getByType('fact').slice(0, 3)
    for (const fact of [...starterVocab, ...starterFacts]) {
      addLearnedFact(fact.id)
    }
    persistPlayer()
  }
}

bootGame()

export default app
