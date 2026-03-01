import './app.css'
import App from './App.svelte'
import { mount } from 'svelte'
import { GameManager } from './game/GameManager'
import { addLearnedFact, initPlayer, persistPlayer, playerSave } from './ui/stores/playerData'
import { currentScreen } from './ui/stores/gameState'
import { get } from 'svelte/store'
import { BALANCE } from './data/balance'
import { factsDB } from './services/factsDB'

// Prevent long-press context menu on mobile
document.addEventListener('contextmenu', (e) => e.preventDefault())

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

  // When Phaser finishes booting, navigate to base screen
  const game = gameManager.getGame()
  if (game) {
    game.events.on('boot-complete', () => {
      currentScreen.set('base')
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
