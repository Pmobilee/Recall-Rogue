import Phaser from 'phaser'
import { get } from 'svelte/store'
import { BALANCE } from '../data/balance'
import { audioManager } from '../services/audioService'
import type { Fact, FossilState, InventorySlot, MineralTier, Relic } from '../data/types'
import { pickFossilDrop, getActiveCompanionEffect, getSpeciesById, type CompanionEffect } from '../data/fossils'
import { PREMIUM_MATERIALS, type PremiumMaterial } from '../data/premiumRecipes'
import { pickRandomDisc } from '../data/dataDiscs'
import { getActiveSynergies } from '../data/relics'
import { gaiaMood, gaiaChattiness } from '../ui/stores/settings'
import { getGaiaLine, GAIA_TRIGGERS } from '../data/gaiaDialogue'
import { getGaiaExpression } from '../data/gaiaAvatar'
import {
  currentScreen,
  oxygenCurrent,
  oxygenMax,
  currentDepth,
  currentLayer as currentLayerStore,
  currentBiome as currentBiomeStore,
  inventory,
  activeQuiz,
  activeFact,
  pendingArtifacts,
  diveResults,
  activeUpgrades,
  pickaxeTier,
  blocksMinedLive,
  gaiaMessage,
  gaiaExpression,
  activeRelics,
  activeSynergies,
  showSendUp,
  studyFacts,
  studyReviewStates,
  pastPointOfNoReturn,
  tempBackpackSlots,
  scannerTier,
  activeCompanion,
  companionBadgeFlash,
} from '../ui/stores/gameState'
import {
  playerSave,
  initPlayer,
  persistPlayer,
  addLearnedFact,
  sellFact,
  updateReviewState,
  addMinerals,
  recordDiveComplete,
  getDueReviews,
  syncKnowledgePoints,
} from '../ui/stores/playerData'
import { getQuizChoices, selectQuestion } from '../services/quizService'
import { factsDB } from '../services/factsDB'
import { RECIPES } from '../data/recipes'
import { save as savePlayer, applyMineralDecay } from '../services/saveService'
import type { OxygenState } from './systems/OxygenSystem'
import { type Biome, pickBiome, generateBiomeSequence } from '../data/biomes'
import { seededRandom } from './systems/MineGenerator'
import { BootScene } from './scenes/BootScene'
import { MineScene } from './scenes/MineScene'

/**
 * Singleton manager for the Phaser game instance.
 * Bridges Phaser events to Svelte stores and provides game lifecycle methods.
 */
export class GameManager {
  private static instance: GameManager
  private game: Phaser.Game | null = null
  private studyQueue: Fact[] = []
  private studyIndex = 0
  private pendingGateCoords: { x: number; y: number } | null = null
  private maxDepthThisRun = 0
  private gaiaDepthMilestones = new Set<number>()
  private gaiaLowO2Warned = false
  /** Zero-based index of the current mine layer within the active dive. */
  private currentLayer = 0
  /** Seed used for the current dive (layer seeds are derived from this). */
  private diveSeed = 0
  /** Relics collected during the current dive run. */
  private runRelics: Relic[] = []
  /** Fact IDs already used in the current artifact appraisal flow (to avoid repeats). */
  private artifactQuizUsedFactIds = new Set<string>()
  /** Items secured at a send-up station — preserved across layers and exempt from forced-surface loss. */
  private sentUpItems: InventorySlot[] = []
  /** Pre-dive oxygen tank count (includes permanent upgrades). Used to restore the correct amount on dive end. */
  private preDiveOxygenTanks: number = BALANCE.STARTING_OXYGEN_TANKS
  /** Whether the current dive is insured (no forced-surface item loss if true). */
  private currentDiveInsured = false
  /** Shuffled biome sequence for the current dive run, indexed by layer number. */
  private biomeSequence: Biome[] = []
  /** Seeded RNG for fossil species selection during the current dive. */
  private fossilRng: () => number = Math.random
  /** Companion effect active for the current dive (null if no companion equipped). */
  private companionEffect: CompanionEffect | null = null

  private constructor() {}

  /** Get or create the singleton instance */
  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager()
    }
    return GameManager.instance
  }

  /** Get all loaded facts from the database */
  getFacts(): Fact[] {
    return factsDB.getAll()
  }

  /** Boot the Phaser game engine and attach to DOM */
  boot(): void {
    if (this.game) {
      console.warn('GameManager: game already booted')
      return
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      backgroundColor: '#1a1a2e',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [BootScene, MineScene],
      input: {
        activePointers: 3,
      },
    }

    this.game = new Phaser.Game(config)
    this.setupEventBridge()

    // Unlock audio on first user gesture (click/tap)
    const unlockAudio = (): void => {
      audioManager.unlock()
      document.removeEventListener('pointerdown', unlockAudio)
      document.removeEventListener('touchstart', unlockAudio)
    }
    document.addEventListener('pointerdown', unlockAudio, { once: true })
    document.addEventListener('touchstart', unlockAudio, { once: true })
  }

  /** Get the Phaser game instance */
  getGame(): Phaser.Game | null {
    return this.game
  }

  /** Destroy the game instance (cleanup) */
  destroy(): void {
    if (this.game) {
      this.game.events.removeAllListeners()
      this.game.destroy(true)
      this.game = null
    }
  }

  // =========================================================
  // Event Bridge: Phaser → Svelte stores
  // =========================================================

  /** Wire up all Phaser event listeners to update Svelte stores */
  private setupEventBridge(): void {
    if (!this.game) return

    const events = this.game.events

    events.on('mine-started', (data: { seed: number; oxygen: OxygenState; inventorySlots: number; layer?: number }) => {
      oxygenCurrent.set(data.oxygen.current)
      oxygenMax.set(data.oxygen.max)
      currentDepth.set(1)
      currentLayerStore.set(data.layer ?? 0)
      // Only reset inventory display on fresh layer-0 starts; layer descents carry it over.
      if ((data.layer ?? 0) === 0) {
        inventory.set(
          Array.from({ length: data.inventorySlots }, () => ({ type: 'empty' as const }))
        )
      }
    })

    events.on('oxygen-changed', (state: OxygenState) => {
      oxygenCurrent.set(state.current)
      oxygenMax.set(state.max)
      if (!this.gaiaLowO2Warned && state.max > 0 && state.current / state.max < 0.25) {
        this.gaiaLowO2Warned = true
        this.triggerGaia('lowOxygen')
      }
    })

    events.on('depth-changed', (depth: number) => {
      currentDepth.set(depth)
      if (depth > this.maxDepthThisRun) this.maxDepthThisRun = depth

      const gridHeight = BALANCE.MINE_LAYER_HEIGHT
      const pct = depth / gridHeight

      if (pct >= 0.25 && !this.gaiaDepthMilestones.has(25)) {
        this.gaiaDepthMilestones.add(25)
        this.triggerGaia('depthMilestone25')
      } else if (pct >= 0.5 && !this.gaiaDepthMilestones.has(50)) {
        this.gaiaDepthMilestones.add(50)
        this.triggerGaia('depthMilestone50')
      } else if (pct >= 0.75 && !this.gaiaDepthMilestones.has(75)) {
        this.gaiaDepthMilestones.add(75)
        this.triggerGaia('depthMilestone75')
      }
    })

    events.on('mineral-collected', (data: { mineralType?: string; mineralAmount?: number; addedToInventory: boolean }) => {
      // Update inventory display
      this.syncInventoryFromScene()
      // 1% chance to drop a void_crystal when collecting a geode or essence mineral
      const tier = data.mineralType as MineralTier | undefined
      if ((tier === 'geode' || tier === 'essence') && Math.random() < PREMIUM_MATERIALS.find(m => m.id === 'void_crystal')!.dropChance) {
        this.awardPremiumMaterial('void_crystal')
      }
    })

    events.on('cave-in', (_data: { affectedCount: number }) => {
      this.triggerGaia('caveIn')
    })

    events.on('earthquake', (_data: { collapsed: number; revealed: number }) => {
      this.triggerGaia('earthquake')
    })

    events.on(
      'artifact-found',
      (data: { factId?: string; rarity?: string; addedToInventory: boolean; rarityBoosted?: boolean }) => {
        this.syncInventoryFromScene()
        // 3% chance to drop star_dust when collecting any artifact
        if (Math.random() < PREMIUM_MATERIALS.find(m => m.id === 'star_dust')!.dropChance) {
          this.awardPremiumMaterial('star_dust')
        }
        if (data.rarityBoosted) {
          // Rarity was upgraded through the appraisal quiz
          gaiaMessage.set("Rarity boost! This artifact is more valuable than it looked.")
        } else if (data.factId) {
          // Show GAIA's per-fact comment if available, otherwise use mood-based dialogue
          const fact = factsDB.getById(data.factId)
          if (fact?.gaiaComment) {
            gaiaMessage.set(fact.gaiaComment)
          } else {
            this.triggerGaia('artifactFound')
          }
        } else {
          this.triggerGaia('artifactFound')
        }
      },
    )

    events.on('oxygen-restored', () => {
      // Already handled by oxygen-changed
    })

    events.on('oxygen-tank-found', () => {
      const save = get(playerSave)
      if (!save) return
      if (save.oxygen < BALANCE.OXYGEN_TANK_MAX_TOTAL) {
        playerSave.update(s => {
          if (!s) return s
          return { ...s, oxygen: s.oxygen + 1 }
        })
        persistPlayer()
        const current = get(playerSave)?.oxygen ?? save.oxygen + 1
        gaiaMessage.set(`A salvaged oxygen tank! Your reserves just grew. (${current}/${BALANCE.OXYGEN_TANK_MAX_TOTAL} tanks)`)
      } else {
        gaiaMessage.set(`Another tank, but your reserves are full. Wasted opportunity.`)
      }
    })

    events.on('upgrade-found', (data: { upgrade: string }) => {
      this.syncInventoryFromScene()
      if (data.upgrade === 'bomb') {
        // Bomb is capped at BOMB_MAX_STACK in MineScene; mirror the cap here
        activeUpgrades.update(rec => ({
          ...rec,
          bomb: Math.min((rec['bomb'] ?? 0) + 1, BALANCE.BOMB_MAX_STACK),
        }))
      } else {
        activeUpgrades.update(rec => ({ ...rec, [data.upgrade]: (rec[data.upgrade] ?? 0) + 1 }))
      }
      // GAIA reacts to each upgrade type
      const upgradeQuips: Record<string, string[]> = {
        pickaxe_boost: ["Ooh, sharper tools. Try not to cut yourself."],
        scanner_boost: ["Enhanced sensors. Now you can see all the ways you might die."],
        // backpack_expand quips are handled by the 'backpack-expanded' event for count-based messages.
        oxygen_efficiency: ["Better breathing tech. Staying alive — how novel."],
        bomb: ["A bomb. For when subtlety fails. Which is often."],
      }
      const quips = upgradeQuips[data.upgrade]
      if (quips) {
        this.randomGaia(quips)
      }
    })

    events.on('pickaxe-upgraded', (data: { tierIndex: number; tierName: string }) => {
      pickaxeTier.set(data.tierIndex)
      gaiaMessage.set(`Upgraded to ${data.tierName}! Mining just got easier.`)
    })

    events.on('backpack-expanded', (data: { slotsAdded: number; totalSlots: number; expansionCount: number }) => {
      // Sync inventory now that new slots have been added.
      this.syncInventoryFromScene()
      // Accumulate temporary slots in the store so UI can show the "Temp: +N" indicator.
      tempBackpackSlots.update(n => n + data.slotsAdded)
      // Show a count-based GAIA message for each expansion milestone.
      const messages: Record<number, string> = {
        1: "Extra pockets! You can carry more now.",
        2: "Another expansion! Getting spacious in there.",
        3: "Maximum storage reached! That's one big backpack.",
      }
      const msg = messages[data.expansionCount]
      if (msg) {
        gaiaMessage.set(msg)
        setTimeout(() => gaiaMessage.set(null), 4000)
      }
    })

    events.on('bomb-used', (data: { remaining: number }) => {
      activeUpgrades.update(rec => ({ ...rec, bomb: data.remaining }))
    })

    events.on('scanner-upgraded', (data: { tierIndex: number; tierName: string }) => {
      scannerTier.set(data.tierIndex)
      gaiaMessage.set(`Scanner upgraded to ${data.tierName}!`)
    })

    events.on('relic-found', (data: { relic: Relic }) => {
      const { relic } = data
      this.runRelics.push(relic)
      activeRelics.set([...this.runRelics])

      // Check for newly activated synergies
      const relicIds = this.runRelics.map(r => r.id)
      const newSynergies = getActiveSynergies(relicIds)
      const previousSynergies = get(activeSynergies)
      activeSynergies.set(newSynergies)

      // If a new synergy just activated, show GAIA message for it
      if (newSynergies.length > previousSynergies.length) {
        const justActivated = newSynergies.find(
          s => !previousSynergies.some(p => p.id === s.id)
        )
        if (justActivated) {
          gaiaMessage.set(`Synergy activated: ${justActivated.name}! ${justActivated.description}`)
          return
        }
      }

      // GAIA commentary on finding a relic (only when no synergy message shown)
      const relicQuips = [
        `${relic.icon} ${relic.name} acquired. ${relic.description}`,
        `Relic found: ${relic.name}. ${relic.description}`,
      ]
      this.randomGaia(relicQuips)
    })

    events.on('blocks-mined-update', (count: number) => {
      blocksMinedLive.set(count)
    })

    events.on('quiz-gate', (data: { factId?: string; gateX?: number; gateY?: number; gateRemaining?: number; gateTotal?: number }) => {
      this.pendingGateCoords = (data.gateX !== undefined && data.gateY !== undefined)
        ? { x: data.gateX, y: data.gateY }
        : null
      // Pick a random fact for each gate question (not the same stored factId every time)
      const fact = factsDB.getRandomOne()
      if (fact) {
        const choices = getQuizChoices(fact)
        activeQuiz.set({
          fact,
          choices,
          source: 'gate',
          gateProgress: (data.gateRemaining !== undefined)
            ? { remaining: data.gateRemaining, total: data.gateTotal ?? data.gateRemaining }
            : undefined,
        })
        currentScreen.set('quiz')
      } else {
        // No fact found — just resume (treat as passed to avoid blocking player)
        this.resumeQuiz(true)
      }
    })

    events.on('oxygen-quiz', (data: { factId?: string; oxygenAmount: number }) => {
      const fact = data.factId ? factsDB.getById(data.factId) : null
      if (fact) {
        const choices = getQuizChoices(fact)
        activeQuiz.set({ fact, choices, source: 'oxygen' })
        currentScreen.set('quiz')
      } else {
        // No fact found — grant oxygen anyway
        const scene = this.getMineScene()
        if (scene) {
          scene.resumeFromOxygenQuiz(true)
        }
      }
    })

    events.on('exit-reached', () => {
      this.triggerGaia('exitReached')
      this.endDive(false)
    })

    events.on(
      'artifact-quiz',
      (data: {
        factId?: string
        artifactRarity?: string
        questionsRemaining?: number
        questionsTotal?: number
        boostedSoFar?: number
      }) => {
        const total = data.questionsTotal ?? BALANCE.ARTIFACT_QUIZ_QUESTIONS
        const remaining = data.questionsRemaining ?? total
        const questionNumber = total - remaining + 1

        // If this is the first question in a new artifact flow, clear the used-fact set
        if (remaining === total) {
          this.artifactQuizUsedFactIds.clear()
        }

        // Pick a fact we haven't used yet in this artifact flow
        let fact: ReturnType<typeof factsDB.getById> = null
        if (data.factId && !this.artifactQuizUsedFactIds.has(data.factId)) {
          fact = factsDB.getById(data.factId)
        }
        if (!fact) {
          // Find a random unused fact
          const allIds = factsDB.getAllIds()
          const unusedIds = allIds.filter((id) => !this.artifactQuizUsedFactIds.has(id))
          if (unusedIds.length > 0) {
            const randomId = unusedIds[Math.floor(Math.random() * unusedIds.length)]
            fact = factsDB.getById(randomId)
          }
        }

        if (fact) {
          this.artifactQuizUsedFactIds.add(fact.id)
          const choices = getQuizChoices(fact)
          activeQuiz.set({
            fact,
            choices,
            source: 'artifact',
            gateProgress: { remaining: total - questionNumber, total },
          })
          currentScreen.set('quiz')
          if (questionNumber === 1) {
            gaiaMessage.set("Appraisal time. Answer well and the artifact's value might surprise you.")
          }
        } else {
          // No fact available — skip to finalize with whatever boosts accumulated
          const scene = this.getMineScene()
          if (scene) {
            scene.resumeFromArtifactQuiz(true)
          }
        }
      },
    )

    events.on('random-quiz', () => {
      const fact = factsDB.getRandomOne()
      if (fact) {
        const choices = getQuizChoices(fact)
        activeQuiz.set({ fact, choices, source: 'random' })
        currentScreen.set('quiz')
        gaiaMessage.set("Pop quiz! Get it right for bonus minerals.")
      } else {
        // No fact available — resume without quiz
        const scene = this.getMineScene()
        if (scene) {
          scene.resumeFromRandomQuiz(false)
        }
      }
    })

    events.on('oxygen-depleted', () => {
      this.handleOxygenDepleted()
    })

    events.on('open-backpack', () => {
      this.syncInventoryFromScene()
      currentScreen.set('backpack')
    })

    events.on('run-complete', () => {
      // Handled by endDive
    })

    events.on('layer-entrance-quiz', (_data: { layer: number }) => {
      const fact = factsDB.getRandomOne()
      if (fact) {
        const choices = getQuizChoices(fact)
        activeQuiz.set({ fact, choices, source: 'layer' })
        currentScreen.set('quiz')
        gaiaMessage.set("The shaft hums with energy. Prove your knowledge to descend safely.")
      } else {
        // No fact available — skip the quiz and descend immediately
        const scene = this.getMineScene()
        if (scene) {
          scene.resumeFromLayerQuiz(true)
        }
      }
    })

    events.on('descent-shaft-entered', (data: {
      layer: number
      inventory: InventorySlot[]
      blocksMinedThisRun: number
      artifactsFound: string[]
      oxygenState: OxygenState
    }) => {
      this.handleDescentShaft(data)
    })

    events.on('quote-found', (data: { quote: string }) => {
      gaiaMessage.set(data.quote)
    })

    events.on('send-up-station', (_data: { inventory: InventorySlot[] }) => {
      showSendUp.set(true)
      this.randomGaia([
        "A send-up station! Secure your best finds before going deeper.",
        "Pneumatic tube to the surface. Smart miners use these.",
        "Send up what matters. The deep layers aren't forgiving.",
      ])
    })

    events.on('data-disc-found', () => {
      const save = get(playerSave)
      if (!save) return

      const unlockedDiscs = save.unlockedDiscs ?? []
      // Use a fresh random for disc selection (not seeded — fine for this reward pick)
      const disc = pickRandomDisc(unlockedDiscs, Math.random)

      if (disc) {
        playerSave.update(s => {
          if (!s) return s
          return { ...s, unlockedDiscs: [...(s.unlockedDiscs ?? []), disc.id] }
        })
        persistPlayer()
        gaiaMessage.set(`Data Disc acquired: ${disc.icon} ${disc.name}! ${disc.description}`)
      } else {
        gaiaMessage.set("Another data disc, but you've already collected them all!")
      }
    })

    events.on('fossil-found', (_data: { x: number; y: number }) => {
      const save = get(playerSave)
      if (!save) return

      // 0.5% chance to drop ancient_essence from any fossil fragment
      if (Math.random() < PREMIUM_MATERIALS.find(m => m.id === 'ancient_essence')!.dropChance) {
        this.awardPremiumMaterial('ancient_essence')
      }

      // Pick species using seeded RNG for this dive (deterministic per seed).
      const species = pickFossilDrop(this.fossilRng)
      const existingFossils: Record<string, FossilState> = save.fossils ?? {}
      const existing = existingFossils[species.id]

      let updatedFossil: FossilState
      if (existing) {
        // Already collecting this species — increment fragment count (capped at fragmentsNeeded).
        updatedFossil = {
          ...existing,
          fragmentsFound: Math.min(existing.fragmentsFound + 1, species.fragmentsNeeded),
        }
      } else {
        // First fragment of this species.
        updatedFossil = {
          speciesId: species.id,
          fragmentsFound: 1,
          fragmentsNeeded: species.fragmentsNeeded,
          revived: false,
        }
      }

      playerSave.update(s => {
        if (!s) return s
        return {
          ...s,
          fossils: {
            ...(s.fossils ?? {}),
            [species.id]: updatedFossil,
          },
        }
      })
      persistPlayer()

      const { fragmentsFound, fragmentsNeeded } = updatedFossil
      const learnedCount = save.learnedFacts.length

      if (fragmentsFound >= fragmentsNeeded && !updatedFossil.revived && learnedCount >= species.requiredFacts) {
        gaiaMessage.set(`${species.icon} ${species.name} collection complete — Ready to revive!`)
      } else if (fragmentsFound >= fragmentsNeeded && !updatedFossil.revived) {
        const needed = species.requiredFacts - learnedCount
        gaiaMessage.set(`${species.icon} ${species.name} fragments complete! Learn ${needed} more facts to revive.`)
      } else {
        gaiaMessage.set(`${species.icon} Found a ${species.name} fragment! (${fragmentsFound}/${fragmentsNeeded})`)
      }
    })

    events.on('point-of-no-return', (_data: { depth: number; maxDepth: number }) => {
      pastPointOfNoReturn.set(true)
      this.randomGaia([
        "No turning back now, pilot. The only way is deeper.",
        "Surface access sealed. Find the exit or... well, let's not think about that.",
        "We've passed the point of no return. Stay focused.",
      ])
    })

    events.on('companion-triggered', (_data: { effect: string }) => {
      // Flash the companion badge for a moment
      companionBadgeFlash.set(true)
      setTimeout(() => companionBadgeFlash.set(false), 600)
    })
  }

  /**
   * Handles the player entering a descent shaft: transitions to the next mine layer.
   * Preserves inventory, artifacts, and blocks mined from the current layer.
   * Restores oxygen bonus and generates a fresh, harder mine for the new layer.
   */
  private handleDescentShaft(data: {
    layer: number
    inventory: InventorySlot[]
    blocksMinedThisRun: number
    artifactsFound: string[]
    oxygenState: OxygenState
  }): void {
    if (!this.game) return

    const nextLayer = data.layer + 1
    if (nextLayer >= BALANCE.MAX_LAYERS) {
      // Shouldn't happen (no shaft on last layer), but guard against it gracefully.
      return
    }

    this.currentLayer = nextLayer
    currentLayerStore.set(nextLayer)

    // Derive a deterministic seed for this layer.
    const layerSeed = (this.diveSeed + nextLayer * 1000) >>> 0

    // Restore oxygen bonus, capped at current max.
    // Also apply companion layer_oxygen bonus on top of the base bonus.
    const companionLayerO2 = (this.companionEffect?.type === 'layer_oxygen') ? this.companionEffect.value : 0
    const restoredOxygen = Math.min(
      data.oxygenState.current + BALANCE.LAYER_OXYGEN_BONUS + companionLayerO2,
      data.oxygenState.max
    )
    // Convert to fractional tanks so MineScene's createOxygenState reconstructs the correct value.
    const oxygenTanks = restoredOxygen / BALANCE.OXYGEN_PER_TANK

    const factIds = factsDB.getAllIds()

    // Use the pre-generated biome sequence for this layer.
    // Fall back to pickBiome (legacy behaviour) if the sequence is missing or too short.
    let nextBiome: Biome
    if (this.biomeSequence.length > nextLayer) {
      nextBiome = this.biomeSequence[nextLayer]
    } else {
      const biomeRng = seededRandom(layerSeed ^ 0xb10e5)
      nextBiome = pickBiome(biomeRng, nextLayer)
    }
    currentBiomeStore.set(nextBiome.name)

    // GAIA descent quips — include a biome greeting.
    this.triggerGaia('mineEntry')
    // Biome greeting shown as a separate GAIA message after a short delay.
    setTimeout(() => {
      gaiaMessage.set(`Welcome to ${nextBiome.name}. ${nextBiome.description}`)
    }, 2000)

    // Harvest any items already sent up in the current layer before the scene is torn down.
    const currentScene = this.getMineScene()
    if (currentScene) {
      this.sentUpItems.push(...currentScene.sentUpItems)
    }

    // Stop current scene and start fresh for the new layer, carrying over run data.
    this.game.scene.stop('MineScene')
    this.game.scene.start('MineScene', {
      seed: layerSeed,
      oxygenTanks,
      inventorySlots: data.inventory.length,
      facts: factIds,
      layer: nextLayer,
      inventory: data.inventory,
      blocksMinedThisRun: data.blocksMinedThisRun,
      artifactsFound: data.artifactsFound,
      biome: nextBiome,
      companionEffect: this.companionEffect,
    })

    currentScreen.set('mining')
  }

  /** Sync inventory from MineScene to Svelte store */
  private syncInventoryFromScene(): void {
    const scene = this.getMineScene()
    if (!scene) return
    // Access the inventory from surfaceRun (peek without ending)
    // We'll use a direct access approach
    const sceneAny = scene as unknown as { inventory: InventorySlot[] }
    if (sceneAny.inventory) {
      inventory.set([...sceneAny.inventory])
    }
  }

  /** Get active MineScene if running */
  private getMineScene(): MineScene | null {
    if (!this.game) return null
    const scene = this.game.scene.getScene('MineScene')
    return scene as MineScene | null
  }

  // =========================================================
  // Dive lifecycle
  // =========================================================

  /** Start a new dive with the given number of oxygen tanks */
  startDive(tanks: number): void {
    if (!this.game) return

    const save = get(playerSave)
    if (!save) return

    // ---- Apply mineral decay (oxidation of hoarded dust) ----
    const decayedSave = applyMineralDecay(save)
    if (decayedSave !== save) {
      playerSave.set(decayedSave)
    }

    // ---- Deduct dive insurance cost if insured ----
    const isInsured = decayedSave.insuredDive
    if (isInsured) {
      const insuranceCost = Math.floor(decayedSave.minerals.dust * BALANCE.INSURANCE_COST_PERCENT)
      if (insuranceCost > 0 && decayedSave.minerals.dust >= insuranceCost) {
        playerSave.update(s => {
          if (!s) return s
          return {
            ...s,
            minerals: { ...s.minerals, dust: s.minerals.dust - insuranceCost },
            // Reset insuredDive flag — insurance is consumed per dive
            insuredDive: false,
          }
        })
      } else {
        // Can't afford; cancel insurance silently
        playerSave.update(s => s ? { ...s, insuredDive: false } : s)
      }
    }
    // Track whether this dive is actually insured (after affordability check)
    this.currentDiveInsured = isInsured && (decayedSave.minerals.dust >= Math.floor(decayedSave.minerals.dust * BALANCE.INSURANCE_COST_PERCENT))

    // Record pre-dive tank count (includes permanent upgrades) for restoration on dive end.
    const currentSave = get(playerSave) ?? decayedSave
    this.preDiveOxygenTanks = currentSave.oxygen

    // Deduct oxygen tanks from save
    const actualTanks = Math.min(tanks, currentSave.oxygen)
    playerSave.update(s => {
      if (!s) return s
      return { ...s, oxygen: s.oxygen - actualTanks }
    })
    persistPlayer()

    // ---- Resolve active companion effect ----
    this.companionEffect = getActiveCompanionEffect(currentSave)
    // Set the activeCompanion store so HUD can display the badge
    if (this.companionEffect && currentSave.activeCompanion) {
      const species = getSpeciesById(currentSave.activeCompanion)
      if (species) {
        activeCompanion.set({ icon: species.icon, name: species.name, effect: this.companionEffect })
      }
    }

    // ---- Apply permanent crafted upgrade effects ----
    const craftedItems = save.craftedItems ?? {}
    let oxygenBonusFromCrafts = 0
    let startingBombsFromCrafts = 0
    let inventoryBonusFromCrafts = 0
    for (const recipe of RECIPES) {
      const count = craftedItems[recipe.id] ?? 0
      if (count === 0 || !recipe.effect) continue
      switch (recipe.effect.type) {
        case 'max_oxygen_bonus':
          oxygenBonusFromCrafts += recipe.effect.value * count
          break
        case 'starting_bombs':
          startingBombsFromCrafts += recipe.effect.value * count
          break
        case 'extra_inventory':
          inventoryBonusFromCrafts += recipe.effect.value * count
          break
      }
    }

    // ---- Apply companion startup bonuses ----
    if (this.companionEffect) {
      switch (this.companionEffect.type) {
        case 'max_oxygen':
          oxygenBonusFromCrafts += this.companionEffect.value
          break
        case 'extra_slot':
          inventoryBonusFromCrafts += this.companionEffect.value
          break
        default:
          break
      }
    }

    // ---- Apply active consumables, then clear them ----
    const activeConsumablesSnapshot = save.activeConsumables ? [...save.activeConsumables] : []
    let consumableOxygenBonus = 0
    for (const recipeId of activeConsumablesSnapshot) {
      if (recipeId === 'oxygen_reserve') consumableOxygenBonus += 30
    }
    if (activeConsumablesSnapshot.length > 0) {
      playerSave.update(s => {
        if (!s) return s
        return { ...s, activeConsumables: [] }
      })
      const updatedSave = get(playerSave)
      if (updatedSave) savePlayer(updatedSave)
    }

    // Get fact IDs for mine generation
    const factIds = factsDB.getAllIds()

    // Reset run-scoped stores
    activeUpgrades.set({})
    pickaxeTier.set(0)
    scannerTier.set(0)
    blocksMinedLive.set(0)
    activeRelics.set([])
    activeSynergies.set([])
    pastPointOfNoReturn.set(false)
    tempBackpackSlots.set(0)
    activeCompanion.set(null)
    companionBadgeFlash.set(false)
    this.runRelics = []
    this.maxDepthThisRun = 0
    this.gaiaDepthMilestones.clear()
    this.gaiaLowO2Warned = false
    this.currentLayer = 0
    this.diveSeed = Date.now() >>> 0
    this.sentUpItems = []
    this.fossilRng = seededRandom(this.diveSeed ^ 0xf055111)
    currentLayerStore.set(0)

    // Generate a shuffled biome sequence for the entire run, seeded by the dive seed.
    const biomeRng = seededRandom(this.diveSeed ^ 0xb10e5)
    this.biomeSequence = generateBiomeSequence(biomeRng, BALANCE.MAX_LAYERS)
    const layer0Biome = this.biomeSequence[0]
    currentBiomeStore.set(layer0Biome.name)

    // Start the MineScene (pass crafted bonuses so MineScene can apply them)
    this.game.scene.start('MineScene', {
      seed: this.diveSeed,
      oxygenTanks: actualTanks,
      inventorySlots: BALANCE.STARTING_INVENTORY_SLOTS + inventoryBonusFromCrafts,
      facts: factIds,
      layer: 0,
      biome: layer0Biome,
      craftedOxygenBonus: oxygenBonusFromCrafts + consumableOxygenBonus,
      craftedStartingBombs: startingBombsFromCrafts,
      activeConsumables: activeConsumablesSnapshot,
      companionEffect: this.companionEffect,
    })

    currentScreen.set('mining')

    // GAIA mine entry comment (delayed so the scene has time to load)
    setTimeout(() => {
      this.triggerGaia('mineEntry')
    }, 1500)
  }

  /** End the current dive and process results */
  endDive(forced: boolean = false): void {
    const scene = this.getMineScene()
    if (!scene) {
      currentScreen.set('base')
      return
    }

    const results = scene.surfaceRun()

    // Merge scene-tracked sentUpItems with any accumulated on the GameManager
    // (scene resets on layer transitions, so GameManager accumulates across layers).
    const allSentUp = [
      ...this.sentUpItems,
      ...(results.sentUpItems ?? []),
    ]

    // Process in-pack inventory (subject to forced-surface loss penalty)
    const mineralTotals: Record<string, number> = { dust: 0, shard: 0, crystal: 0, geode: 0, essence: 0 }
    const artifactFactIds: string[] = []

    for (const slot of results.inventory) {
      if (slot.type === 'mineral' && slot.mineralAmount) {
        const tier = slot.mineralTier ?? 'dust'
        mineralTotals[tier] = (mineralTotals[tier] ?? 0) + slot.mineralAmount
      }
      if (slot.type === 'artifact' && slot.factId) {
        artifactFactIds.push(slot.factId)
      }
    }

    // If forced (oxygen depleted), lose 30% of in-pack inventory.
    // Exception: if the dive was insured, skip the penalty entirely.
    // Items secured at a send-up station are NOT subject to this penalty regardless.
    if (forced && !this.currentDiveInsured) {
      const lossRatio = 0.3
      for (const tier of Object.keys(mineralTotals)) {
        mineralTotals[tier] = Math.floor(mineralTotals[tier] * (1 - lossRatio))
      }
      // Remove ~30% of in-pack artifacts
      const numToLose = Math.floor(artifactFactIds.length * lossRatio)
      for (let i = 0; i < numToLose; i++) {
        const idx = Math.floor(Math.random() * artifactFactIds.length)
        artifactFactIds.splice(idx, 1)
      }
    }

    // Process secured (sent-up) items — always at full value, no loss.
    for (const slot of allSentUp) {
      if (slot.type === 'mineral' && slot.mineralAmount) {
        const tier = slot.mineralTier ?? 'dust'
        mineralTotals[tier] = (mineralTotals[tier] ?? 0) + slot.mineralAmount
      }
      if (slot.type === 'artifact' && slot.factId) {
        artifactFactIds.push(slot.factId)
      }
    }

    // Reset accumulator now that we've consumed it.
    this.sentUpItems = []
    // Reset dive insurance flag for the next dive.
    this.currentDiveInsured = false

    // Add all mineral tiers to player save
    for (const [tier, amount] of Object.entries(mineralTotals)) {
      if (amount > 0) {
        addMinerals(tier as MineralTier, amount)
      }
    }

    // Queue artifacts for review at base
    if (artifactFactIds.length > 0) {
      pendingArtifacts.update(existing => [...existing, ...artifactFactIds])
    }

    // Record dive stats
    recordDiveComplete(0, results.blocksMinedThisRun)

    // Replenish oxygen tanks for next dive.
    // Restore to the pre-dive count (which includes permanent tank upgrades),
    // plus a streak bonus of +1 if the player has a 3+ day streak.
    // Cap at OXYGEN_TANK_MAX_TOTAL to prevent exceeding the upgrade ceiling.
    const streakBonus = (get(playerSave)?.stats.currentStreak ?? 0) >= 3 ? 1 : 0
    const replenishAmount = Math.min(
      Math.max(this.preDiveOxygenTanks, BALANCE.STARTING_OXYGEN_TANKS) + streakBonus,
      BALANCE.OXYGEN_TANK_MAX_TOTAL + streakBonus,
    )
    playerSave.update(s => {
      if (!s) return s
      return { ...s, oxygen: replenishAmount }
    })
    persistPlayer()

    // GAIA rare mineral find comments
    if ((mineralTotals.essence ?? 0) > 0) {
      gaiaMessage.set("Primordial Essence... the building blocks of worlds. Handle it carefully.")
      setTimeout(() => gaiaMessage.set(null), 5000)
    } else if ((mineralTotals.geode ?? 0) > 0) {
      gaiaMessage.set("A geode! These haven't formed in millennia.")
      setTimeout(() => gaiaMessage.set(null), 4000)
    }

    // Store dive results for the summary screen
    diveResults.set({
      dustCollected: mineralTotals.dust ?? 0,
      shardsCollected: mineralTotals.shard ?? 0,
      crystalsCollected: mineralTotals.crystal ?? 0,
      geodesCollected: mineralTotals.geode ?? 0,
      essenceCollected: mineralTotals.essence ?? 0,
      artifactsFound: artifactFactIds.length,
      blocksMined: results.blocksMinedThisRun,
      maxDepth: this.maxDepthThisRun,
      forced,
      streakDay: get(playerSave)?.stats.currentStreak ?? 0,
      streakBonus: streakBonus > 0,
      relicsCollected: results.collectedRelics ?? [],
    })

    // Stop the mine scene
    this.game?.scene.stop('MineScene')

    // Navigate to dive results summary
    currentScreen.set('diveResults')
  }

  /** Handle oxygen depletion — forced surface */
  private handleOxygenDepleted(): void {
    this.endDive(true)
  }

  // =========================================================
  // Quiz handling
  // =========================================================

  /**
   * Checks if a wrong answer constitutes a consistency violation —
   * the player has demonstrably learned this fact (repetitions >= CONSISTENCY_MIN_REPS)
   * but answered it incorrectly during a dive.
   *
   * @param factId - The fact that was answered.
   * @param wasCorrect - Whether the player got it right (always false for a penalty check).
   */
  private isConsistencyViolation(factId: string, wasCorrect: boolean): boolean {
    if (wasCorrect) return false // only penalize wrong answers
    const save = get(playerSave)
    if (!save) return false
    const reviewState = save.reviewStates.find(rs => rs.factId === factId)
    if (!reviewState) return false
    // Penalize if player has answered this correctly at least CONSISTENCY_MIN_REPS times before
    return reviewState.repetitions >= BALANCE.CONSISTENCY_MIN_REPS
  }

  /**
   * Applies the consistency penalty: drains extra O2 and shows a GAIA message.
   * Also updates the activeQuiz store flag so the overlay can show the warning.
   *
   * @param factId - The fact that triggered the violation.
   */
  private applyConsistencyPenalty(factId: string): void {
    // Mark the active quiz with the consistency penalty flag before the overlay
    // transitions away, so it can display the warning line while showing results.
    activeQuiz.update(q => q ? { ...q, isConsistencyPenalty: true } : q)

    // Drain extra O2 in the MineScene
    const scene = this.getMineScene()
    if (scene) {
      scene.drainOxygen(BALANCE.CONSISTENCY_PENALTY_O2)
    }

    // GAIA callout — pick from snarky "you knew this" lines
    this.randomGaia([
      "You knew that one before! Sloppy, pilot.",
      "Inconsistent answer — you've gotten this right before.",
      "Focus! You learned this already.",
    ])
  }

  /** Resume mining after a quiz gate answer */
  resumeQuiz(passed: boolean): void {
    activeQuiz.set(null)

    const scene = this.getMineScene()
    if (scene) {
      const coords = this.pendingGateCoords
      this.pendingGateCoords = null
      scene.resumeFromQuiz(passed, coords?.x, coords?.y)
      currentScreen.set('mining')
    } else {
      this.pendingGateCoords = null
      currentScreen.set('base')
    }
  }

  /** Handle a quiz answer during mining (gate mode) */
  handleQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    this.resumeQuiz(correct)
  }

  /** Handle an oxygen quiz answer */
  handleOxygenQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromOxygenQuiz(correct)
      currentScreen.set('mining')
    } else {
      currentScreen.set('base')
    }
  }

  /** Handle an artifact quiz answer */
  handleArtifactQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
    }
    // Check if more questions remain by inspecting gateProgress
    const moreQuestionsRemain = quiz?.gateProgress != null && quiz.gateProgress.remaining > 0
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      // resumeFromArtifactQuiz will emit another 'artifact-quiz' event if questions remain
      scene.resumeFromArtifactQuiz(correct)
      if (!moreQuestionsRemain || !correct) {
        // Quiz flow is ending — return to mining
        currentScreen.set('mining')
        if (!correct) {
          gaiaMessage.set("Close enough. Let's see what we've got.")
        }
        // If all questions were answered correctly the scene will have emitted artifact-found
        // with a potentially boosted rarity — show a boost message if warranted
      }
      // If moreQuestionsRemain && correct: the scene emitted another 'artifact-quiz',
      // which updates activeQuiz and keeps currentScreen on 'quiz' via that listener
    } else {
      currentScreen.set('base')
    }
  }

  /** Handle a random (pop quiz) answer while mining */
  handleRandomQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromRandomQuiz(correct)
      currentScreen.set('mining')
      if (correct) {
        gaiaMessage.set(`Not bad. Here's some dust for your trouble.`)
      } else {
        gaiaMessage.set("Wrong. That'll cost you some oxygen.")
      }
    } else {
      currentScreen.set('base')
    }
  }

  /** Handle a layer entrance quiz answer */
  handleLayerQuizAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
      if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
        this.applyConsistencyPenalty(quiz.fact.id)
      }
    }
    activeQuiz.set(null)
    const scene = this.getMineScene()
    if (scene) {
      if (correct) {
        gaiaMessage.set("Well done. Descending...")
      } else {
        gaiaMessage.set("Wrong, but you'll survive. Barely.")
      }
      scene.resumeFromLayerQuiz(correct)
      currentScreen.set('mining')
    } else {
      currentScreen.set('base')
    }
  }

  // =========================================================
  // Study session
  // =========================================================

  /**
   * Start a dedicated card-flip study session at base.
   * Gathers due-review facts (or random learned facts as fallback),
   * populates the studyFacts/studyReviewStates stores, and navigates
   * to the 'studySession' screen — handled by StudySession.svelte.
   */
  startStudySession(): void {
    const save = get(playerSave)
    if (!save) return

    // Gather due reviews
    const dueReviews = getDueReviews()

    const facts: import('../data/types').Fact[] = []
    for (const review of dueReviews) {
      const fact = factsDB.getById(review.factId)
      if (fact) facts.push(fact)
    }

    // Fallback: pick random learned facts when nothing is due
    if (facts.length === 0 && save.learnedFacts.length > 0) {
      const shuffled = [...save.learnedFacts].sort(() => Math.random() - 0.5)
      for (const id of shuffled) {
        const fact = factsDB.getById(id)
        if (fact) facts.push(fact)
      }
    }

    if (facts.length === 0) return

    // Collect matching review states
    const reviewStates = save.reviewStates.filter(rs =>
      facts.some(f => f.id === rs.factId)
    )

    studyFacts.set(facts)
    studyReviewStates.set(reviewStates)
    currentScreen.set('studySession')
  }

  /**
   * Handle a single card answer from the StudySession component.
   * Updates SM-2 review state with quality 4 (correct) or 1 (incorrect).
   *
   * @param factId - The fact that was answered.
   * @param correct - Whether the player self-rated as correct.
   */
  handleStudyCardAnswer(factId: string, correct: boolean): void {
    updateReviewState(factId, correct)
  }

  /**
   * Called when the StudySession component signals completion.
   * Shows a GAIA comment based on performance and returns to base.
   *
   * @param correctCount - Number of cards the player rated as correct.
   * @param totalCount - Total cards in the session.
   */
  completeStudySession(correctCount: number, totalCount: number): void {
    studyFacts.set([])
    studyReviewStates.set([])

    const ratio = totalCount > 0 ? correctCount / totalCount : 0

    // Check for active review ritual and award bonus if not yet completed today
    const hour = new Date().getHours()
    const today = new Date().toISOString().split('T')[0]
    const save = get(playerSave)

    let ritualType: 'morning' | 'evening' | null = null
    if (hour >= BALANCE.MORNING_REVIEW_HOUR && hour < BALANCE.MORNING_REVIEW_END) {
      ritualType = 'morning'
    } else if (hour >= BALANCE.EVENING_REVIEW_HOUR && hour < BALANCE.EVENING_REVIEW_END) {
      ritualType = 'evening'
    }

    const alreadyCompleted = ritualType === 'morning'
      ? save?.lastMorningReview === today
      : ritualType === 'evening'
        ? save?.lastEveningReview === today
        : true

    if (ritualType !== null && !alreadyCompleted && save) {
      // Mark ritual completed and award bonus dust
      const updatedField = ritualType === 'morning'
        ? { lastMorningReview: today }
        : { lastEveningReview: today }
      playerSave.update(s => s ? { ...s, ...updatedField } : s)
      addMinerals('dust', BALANCE.RITUAL_BONUS_DUST)

      const bonusMsg = ritualType === 'morning'
        ? `Great morning practice! +${BALANCE.RITUAL_BONUS_DUST} dust bonus!`
        : `A productive evening! +${BALANCE.RITUAL_BONUS_DUST} dust bonus!`
      gaiaMessage.set(bonusMsg)
      setTimeout(() => gaiaMessage.set(null), 5000)
    } else {
      if (ratio === 1) {
        gaiaMessage.set('Perfect session! Your knowledge grows stronger.')
      } else if (ratio > 0.7) {
        gaiaMessage.set('Solid review. The tree appreciates your effort.')
      } else {
        gaiaMessage.set('Some of those need more practice. The tree will wait.')
      }
    }

    // Persist after potential ritual field update
    persistPlayer()

    // Recalculate and sync knowledge points from updated stats/mastery
    syncKnowledgePoints()

    currentScreen.set('base')
  }

  /** Handle a study mode quiz answer (legacy, kept for backward compatibility) */
  handleStudyAnswer(correct: boolean): void {
    const quiz = get(activeQuiz)
    if (quiz) {
      updateReviewState(quiz.fact.id, correct)
    }
    this.studyIndex++
    // Legacy path — just return to base if somehow called
    if (this.studyIndex >= this.studyQueue.length) {
      activeQuiz.set(null)
      currentScreen.set('base')
    }
  }

  // =========================================================
  // Artifact review
  // =========================================================

  /** Start reviewing pending artifacts from last dive */
  reviewNextArtifact(): void {
    const pending = get(pendingArtifacts)
    if (pending.length === 0) {
      activeFact.set(null)
      currentScreen.set('base')
      return
    }

    const factId = pending[0]
    const fact = factsDB.getById(factId)
    if (fact) {
      activeFact.set(fact)
      currentScreen.set('factReveal')
    } else {
      // Skip unknown fact
      pendingArtifacts.update(arr => arr.slice(1))
      this.reviewNextArtifact()
    }
  }

  /** Player chose to learn the current artifact fact */
  learnArtifact(): void {
    const fact = get(activeFact)
    if (fact) {
      addLearnedFact(fact.id)
      pendingArtifacts.update(arr => arr.filter(id => id !== fact.id))
    }
    activeFact.set(null)
    this.reviewNextArtifact()
  }

  /** Player chose to sell the current artifact fact */
  sellArtifact(): void {
    const fact = get(activeFact)
    if (fact) {
      // Sell value based on rarity
      const sellValues: Record<string, number> = {
        common: 5, uncommon: 10, rare: 20, epic: 40, legendary: 80, mythic: 150,
      }
      const reward = sellValues[fact.rarity] ?? 5
      addMinerals('dust', reward)
      pendingArtifacts.update(arr => arr.filter(id => id !== fact.id))
    }
    activeFact.set(null)
    this.reviewNextArtifact()
  }

  // =========================================================
  // Backpack handling
  // =========================================================

  /** Close backpack overlay and return to mining */
  closeBackpack(): void {
    currentScreen.set('mining')
  }

  /** Drop an item from the backpack during a dive */
  dropItem(index: number): void {
    const scene = this.getMineScene()
    if (!scene) return

    const sceneAny = scene as unknown as { inventory: InventorySlot[] }
    if (sceneAny.inventory && sceneAny.inventory[index]) {
      sceneAny.inventory[index] = { type: 'empty' }
      inventory.set([...sceneAny.inventory])
    }
  }

  // =========================================================
  // Send-up station
  // =========================================================

  /**
   * Called by SendUpOverlay when the player confirms their item selection.
   * Passes selected items to MineScene (which removes them from in-run inventory),
   * caches them on the GameManager so they survive layer transitions, and
   * hides the overlay.
   */
  confirmSendUp(selectedItems: InventorySlot[]): void {
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromSendUp(selectedItems)
      // Merge newly sent-up items into our accumulator.
      this.sentUpItems.push(...selectedItems)
    }
    showSendUp.set(false)
    currentScreen.set('mining')
  }

  /**
   * Called by SendUpOverlay when the player skips without sending anything.
   * Simply resumes mining.
   */
  skipSendUp(): void {
    const scene = this.getMineScene()
    if (scene) {
      scene.resumeFromSendUp([])
    }
    showSendUp.set(false)
    currentScreen.set('mining')
  }

  // =========================================================
  // Run stats panel
  // =========================================================

  /** Open the run stats/upgrades overlay */
  openRunStats(): void {
    currentScreen.set('runStats')
  }

  /** Close the run stats overlay and return to mining */
  closeRunStats(): void {
    currentScreen.set('mining')
  }

  // =========================================================
  // Navigation helpers
  // =========================================================

  /** Navigate to dive prep screen */
  goToDivePrep(): void {
    currentScreen.set('divePrepScreen')
  }

  /** Navigate back to base */
  goToBase(): void {
    currentScreen.set('base')
  }

  /** Navigate to main menu */
  goToMainMenu(): void {
    currentScreen.set('mainMenu')
  }

  // =========================================================
  // Bomb
  // =========================================================

  /** Trigger bomb detonation in the active MineScene. */
  useBomb(): void {
    const scene = this.getMineScene()
    if (scene) {
      scene.useBomb()
    }
  }

  // =========================================================
  // GAIA (ship AI) commentary
  // =========================================================

  /**
   * Pick a random line and push it to the gaiaMessage store,
   * subject to the player's chattiness setting.
   * Level 10 = always speaks; level 0 = never; intermediate = proportional probability.
   * The toast UI will display and auto-dismiss it.
   */
  private randomGaia(lines: string[], trigger = 'idle'): void {
    const chattiness = get(gaiaChattiness)
    if (Math.random() * 10 >= chattiness) return
    const msg = lines[Math.floor(Math.random() * lines.length)]
    const mood = get(gaiaMood)
    const expr = getGaiaExpression(trigger, mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(msg)
  }

  /**
   * Emit a mood-aware GAIA line for the given named trigger, respecting chattiness.
   * Also updates the gaiaExpression store so the toast and avatar reflect context.
   */
  private triggerGaia(trigger: keyof typeof GAIA_TRIGGERS): void {
    const chattiness = get(gaiaChattiness)
    if (Math.random() * 10 >= chattiness) return
    const mood = get(gaiaMood)
    const text = getGaiaLine(trigger, mood)
    const expr = getGaiaExpression(trigger, mood)
    gaiaExpression.set(expr.id)
    gaiaMessage.set(text)
  }

  /**
   * Awards one unit of the given premium material to the player's save and shows a
   * GAIA toast. Premium materials are rare in-game drops — never sold for real money.
   *
   * @param materialId - The premium material to award.
   */
  private awardPremiumMaterial(materialId: PremiumMaterial): void {
    const meta = PREMIUM_MATERIALS.find(m => m.id === materialId)
    if (!meta) return

    playerSave.update(s => {
      if (!s) return s
      const current = (s.premiumMaterials ?? {})[materialId] ?? 0
      return {
        ...s,
        premiumMaterials: {
          ...(s.premiumMaterials ?? {}),
          [materialId]: current + 1,
        },
      }
    })
    persistPlayer()

    // Always show a GAIA toast for premium drops — they are rare enough to be noteworthy.
    gaiaMessage.set(`${meta.icon} Rare find! ${meta.name}!`)
    setTimeout(() => gaiaMessage.set(null), 4000)
  }
}
