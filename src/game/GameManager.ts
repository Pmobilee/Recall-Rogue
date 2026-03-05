import Phaser from 'phaser'
import { get } from 'svelte/store'
import { BALANCE, getLayerGridSize, BASE_LAVA_HAZARD_DAMAGE, BASE_GAS_HAZARD_DAMAGE, AUTO_BALANCE_DEATH_THRESHOLD } from '../data/balance'
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
  activeConsumables,
  shieldActive,
  currentBiomeId,
  equippedRelicsV2,
  descentOverlayState,
  activeAltar,
  activeMineEvent,
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
  deductMinerals,
} from '../ui/stores/playerData'
import { getQuizChoices, selectQuestion } from '../services/quizService'
import { factsDB } from '../services/factsDB'
import { RECIPES } from '../data/recipes'
import { save as savePlayer } from '../services/saveService'
import type { OxygenState } from './systems/OxygenSystem'
import { type Biome, pickBiome, generateBiomeSequence, ALL_BIOMES } from '../data/biomes'
import { generateInterestBiasedBiomeSequence, selectWeightedFact } from '../services/interestSpawner'
import type { InterestConfig } from '../data/interestConfig'
import { getEligibleFacts } from '../data/contentFilter'
import { seededRandom, buildDifficultyProfile, type DifficultyProfile } from './systems/MineGenerator'
import { BootScene } from './scenes/BootScene'
import { MineScene } from './scenes/MineScene'
import { DomeScene } from './scenes/DomeScene'
import { GaiaManager } from './managers/GaiaManager'
import { QuizManager } from './managers/QuizManager'
import { StudyManager } from './managers/StudyManager'
import { InventoryManager } from './managers/InventoryManager'
import { SaveManager, AUTO_SAVE_TICK_INTERVAL } from './managers/SaveManager'
import type { DiveSaveState } from '../data/saveState'
import { DIVE_SAVE_VERSION } from '../data/saveState'
import { encounterManager } from './managers/EncounterManager'
import type { Boss } from './entities/Boss'
import type { Creature } from './entities/Creature'
import { LOOT_LOSS_RATE_SHALLOW, LOOT_LOSS_RATE_MID, LOOT_LOSS_RATE_DEEP, SEND_UP_TICK_COST } from '../data/balance'
import { TickSystem } from './systems/TickSystem'
import type { MineEventType } from '../data/mineEvents'
import { getMineEvent } from '../data/mineEvents'
import { getFragmentRecipe } from '../data/recipeFragments'

/**
 * Singleton manager for the Phaser game instance.
 * Bridges Phaser events to Svelte stores and provides game lifecycle methods.
 *
 * Internal quiz, study, GAIA, and inventory logic is delegated to focused sub-managers.
 * All public method signatures remain unchanged for compatibility with existing callers.
 */
export class GameManager {
  private static instance: GameManager
  private game: Phaser.Game | null = null
  private maxDepthThisRun = 0
  private gaiaDepthMilestones = new Set<number>()
  /** Zero-based index of the current mine layer within the active dive. */
  private currentLayer = 0
  /** Seed used for the current dive (layer seeds are derived from this). */
  private diveSeed = 0
  /** Relics collected during the current dive run. */
  private runRelics: Relic[] = []
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
  /** Count of new (previously unseen) facts shown in the current dive session. Reset per dive. (FIX-9) */
  private newFactsThisDive = 0
  /** Whether O2 drain is paused (during quiz overlays). (DD-V2-085) */
  private o2Paused = false
  /** Number of completed dives at the start of this session — used to detect zero-dive sessions. */
  private _divesAtSessionStart = 0
  /** Consecutive deaths on the same layer — used for auto-balance easing. (DD-V2-053) */
  private sameLayerDeathCount = 0
  /** Layer index of the last recorded death — resets the counter when the layer changes. */
  private lastDeathLayer = -1
  /** Whether auto-balance easing is currently active (hazards reduced, O2 bonus applied). */
  private autoBalanceActive = false
  /** Minerals banked via send-up pod this run. Exempt from loot loss. (DD-V2-053) */
  private bankedMinerals: Record<string, number> = {}
  /** Whether the current dive is a tutorial dive (Phase 14). Set before starting the mine scene. */
  isTutorialDive = false
  /** Whether the earthquake tutorial has been shown this dive (local to tutorial mine session). */
  private tutorialEarthquakeShown = false

  // ---- Sub-managers (initialized lazily in boot()) ----
  private gaiaManager!: GaiaManager
  private quizManager!: QuizManager
  private studyManager!: StudyManager
  private inventoryManager!: InventoryManager

  private constructor() {}

  /** Get or create the singleton instance */
  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager()
    }
    return GameManager.instance
  }

  /** Get all loaded facts from the database, filtered by the player's age rating (Phase 45). */
  getFacts(): Fact[] {
    const allFacts = factsDB.getAll()
    const save = get(playerSave)
    const ageRating = save?.ageRating ?? 'adult'
    return getEligibleFacts(allFacts, ageRating)
  }

  /** Boot the Phaser game engine and attach to DOM */
  boot(): void {
    if (this.game) {
      console.warn('GameManager: game already booted')
      return
    }

    // Initialise sub-managers now that we have a stable `this` reference.
    this.gaiaManager = new GaiaManager()
    this.quizManager = new QuizManager(
      () => this.getMineScene(),
      (lines, trigger) => this.randomGaia(lines, trigger),
    )
    this.studyManager = new StudyManager(
      (msg) => gaiaMessage.set(msg),
    )
    this.inventoryManager = new InventoryManager(
      () => this.getMineScene(),
    )

    // Wire EncounterManager cross-references (Phase 36)
    encounterManager.quizManagerRef = this.quizManager
    encounterManager.setMineSceneAccessor(() => this.getMineScene())
    this.quizManager.encounterManagerRef = encounterManager

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.WEBGL,   // Force WebGL (DD-V2-190)
      parent: 'game-container',
      width: window.innerWidth,
      height: window.innerHeight,
      pixelArt: true,
      roundPixels: true,
      autoRound: true,       // Prevent sub-pixel sprite positions (DD-V2-276)
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
      scene: [BootScene, MineScene, DomeScene],
      input: {
        activePointers: 3,
      },
    }

    this.game = new Phaser.Game(config)
    // Store adaptive quiz rate checker in game registry so MineScene can use it
    // without a circular import. (DD-V2-060)
    this.game.registry.set('shouldTriggerRandomQuiz', () => this.quizManager.shouldTriggerQuiz())
    this.setupEventBridge()

    // Unlock audio on first user gesture (click/tap)
    const unlockAudio = (): void => {
      audioManager.unlock()
      document.removeEventListener('pointerdown', unlockAudio)
      document.removeEventListener('touchstart', unlockAudio)
    }
    document.addEventListener('pointerdown', unlockAudio, { once: true })
    document.addEventListener('touchstart', unlockAudio, { once: true })

    // --- Session tracking (DD-V2, Phase 18.5) ---
    // Snapshot dives completed at boot so we can detect zero-dive sessions on close.
    const currentSave = get(playerSave)
    this._divesAtSessionStart = currentSave?.stats.totalDivesCompleted ?? 0

    // Increment totalSessions on each app boot.
    playerSave.update(s => {
      if (!s) return s
      return { ...s, stats: { ...s.stats, totalSessions: (s.stats.totalSessions ?? 0) + 1 } }
    })
    persistPlayer()

    // On page hide / tab switch, check if the player dived at all this session.
    // If not, increment zeroDiveSessions as a cozy-session signal.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return
      const save = get(playerSave)
      if (!save) return
      const divesNow = save.stats.totalDivesCompleted ?? 0
      if (divesNow <= this._divesAtSessionStart) {
        playerSave.update(s => {
          if (!s) return s
          return { ...s, stats: { ...s.stats, zeroDiveSessions: (s.stats.zeroDiveSessions ?? 0) + 1 } }
        })
        persistPlayer()
      }
    })
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
      if (!this.gaiaManager.gaiaLowO2Warned && state.max > 0 && state.current / state.max < 0.25) {
        this.gaiaManager.gaiaLowO2Warned = true
        this.triggerGaia('lowOxygen')
      }
    })

    events.on('depth-changed', (depth: number) => {
      currentDepth.set(depth)
      if (depth > this.maxDepthThisRun) this.maxDepthThisRun = depth

      // Derive grid height from current layer so depth milestones scale correctly.
      const [, gridHeight] = getLayerGridSize(this.currentLayer + 1)
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
      this.inventoryManager.syncInventoryFromScene()
      // 1% chance to drop a void_crystal when collecting a geode or essence mineral
      const tier = data.mineralType as MineralTier | undefined
      if ((tier === 'geode' || tier === 'essence') && Math.random() < PREMIUM_MATERIALS.find(m => m.id === 'void_crystal')!.dropChance) {
        this.gaiaManager.awardPremiumMaterial('void_crystal')
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
        this.inventoryManager.syncInventoryFromScene()
        // 3% chance to drop star_dust when collecting any artifact
        if (Math.random() < PREMIUM_MATERIALS.find(m => m.id === 'star_dust')!.dropChance) {
          this.gaiaManager.awardPremiumMaterial('star_dust')
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
      this.inventoryManager.syncInventoryFromScene()
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
      this.inventoryManager.syncInventoryFromScene()
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
      this.quizManager.pendingGateCoords = (data.gateX !== undefined && data.gateY !== undefined)
        ? { x: data.gateX, y: data.gateY }
        : null
      // Pick a random fact for each gate question (not the same stored factId every time)
      const fact = this.getInterestWeightedFact()
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
          this.quizManager.artifactQuizUsedFactIds.clear()
        }

        // Pick a fact we haven't used yet in this artifact flow
        let fact: ReturnType<typeof factsDB.getById> = null
        if (data.factId && !this.quizManager.artifactQuizUsedFactIds.has(data.factId)) {
          fact = factsDB.getById(data.factId)
        }
        if (!fact) {
          // Find a random unused fact
          const allIds = factsDB.getAllIds()
          const unusedIds = allIds.filter((id) => !this.quizManager.artifactQuizUsedFactIds.has(id))
          if (unusedIds.length > 0) {
            const randomId = unusedIds[Math.floor(Math.random() * unusedIds.length)]
            fact = factsDB.getById(randomId)
          }
        }

        if (fact) {
          this.quizManager.artifactQuizUsedFactIds.add(fact.id)
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
      const fact = this.getInterestWeightedFact()
      if (fact) {
        const choices = getQuizChoices(fact)
        activeQuiz.set({ fact, choices, source: 'random' })
        currentScreen.set('quiz')
        gaiaMessage.set("Scanner ping! Residual data detected — answer to earn bonus minerals.")
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
      this.inventoryManager.syncInventoryFromScene()
      currentScreen.set('backpack')
    })

    events.on('run-complete', () => {
      // Handled by endDive
    })

    events.on('layer-entrance-quiz', (_data: { layer: number }) => {
      const fact = this.getInterestWeightedFact()
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
        this.gaiaManager.awardPremiumMaterial('ancient_essence')
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

    events.on('companion-triggered', (_data: { effect: string }) => {
      // Flash the companion badge for a moment
      companionBadgeFlash.set(true)
      setTimeout(() => companionBadgeFlash.set(false), 600)
    })

    // ---- Hazard contact events (Phase 8.3) ----
    events.on('hazard-lava-contact', () => {
      // Shield charge interception: absorb the hit if shield is active (DD-V2-064)
      if (get(shieldActive)) {
        shieldActive.set(false)
        gaiaMessage.set('Shield absorbed the hit — charge depleted.')
        return
      }
      // Apply lava damage — drain O2 and trigger GAIA commentary (DD-V2-060)
      const damage = BASE_LAVA_HAZARD_DAMAGE
      oxygenCurrent.update(o => Math.max(0, o - damage))
      this.gaiaManager.triggerGaia('hazardLava')
    })

    events.on('hazard-gas-contact', () => {
      // Shield charge interception: absorb the hit if shield is active (DD-V2-064)
      if (get(shieldActive)) {
        shieldActive.set(false)
        gaiaMessage.set('Shield absorbed the hit — charge depleted.')
        return
      }
      // Apply gas damage per tick while player stands in cloud (DD-V2-062)
      const damage = BASE_GAS_HAZARD_DAMAGE
      oxygenCurrent.update(o => Math.max(0, o - damage))
    })

    // ---- Consumable toast (Phase 8.6) ----
    events.on('gaia-toast', (msg: string) => {
      gaiaMessage.set(msg)
    })

    // ---- Phase 31.5: Descent animation overlay ----
    events.on('descent-animation-start', (data: { fromLayer: number; toLayer: number; biomeName: string | null }) => {
      descentOverlayState.set({ visible: true, fromLayer: data.fromLayer, toLayer: data.toLayer, biomeName: data.biomeName })
    })

    // ---- Landmark: Chest opened (DD-V2-055) ----
    events.on('chest-opened', (data: { layer: number }) => {
      // Award bonus minerals based on current layer depth.
      const bonusTier = data.layer >= 14 ? 'geode' : data.layer >= 9 ? 'crystal' : 'shard'
      const bonusAmount = 5 + Math.floor(data.layer / 2)
      addMinerals(bonusTier as MineralTier, bonusAmount)
      gaiaMessage.set('You opened a treasure chest! Rare minerals secured.')
    })

    // ---- Phase 35.3: Offering Altar adjacent ----
    events.on('altar-adjacent', (data: { x: number; y: number }) => {
      activeAltar.set({ altarX: data.x, altarY: data.y })
      currentScreen.set('sacrifice')
    })

    // ---- Phase 35.6: Locked block denied ----
    events.on('locked-block-denied', (data: { requiredTier: number }) => {
      const tierNames = ['', 'Iron', 'Steel', 'Diamond', 'Plasma']
      const name = tierNames[data.requiredTier] ?? `Tier ${data.requiredTier}`
      gaiaMessage.set(`Locked. Requires ${name} Pick or drill charge.`)
    })

    // ---- Phase 35.5: Recipe fragment collected ----
    events.on('fragment-collected', (data: { fragmentId: string }) => {
      this.collectRecipeFragment(data.fragmentId)
    })

    // ---- Phase 35.7: Mine event fired ----
    events.on('mine-event', (data: { type: MineEventType }) => {
      this.handleMineEvent(data.type)
    })

    // ---- Phase 36: Combat encounters ----
    events.on('boss-encounter', (boss: Boss) => {
      gaiaMessage.set(boss.phases[0]?.dialogue ?? `${boss.name} blocks your path!`)
      encounterManager.startBossEncounter(boss)
    })

    events.on('creature-encounter', (creature: Creature) => {
      gaiaMessage.set(`Something stirs in the dark...`)
      encounterManager.startCreatureEncounter(creature)
    })

    events.on('the-deep-unlocked', () => {
      currentScreen.set('the-deep-unlock')
      playerSave.update(save =>
        save ? { ...save, theDeepVisits: (save.theDeepVisits ?? 0) + 1 } : save
      )
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
    this.onLayerAdvance()

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
    currentBiomeId.set(nextBiome.id)

    // Phase 49.2: Optionally assign a secondary biome for this layer (15% chance).
    const layerBlendRng = seededRandom(layerSeed ^ 0x49b10e5)
    let nextSecondaryBiome: Biome | undefined = undefined
    if (layerBlendRng() < BALANCE.DUAL_BIOME_CHANCE) {
      const candidates = ALL_BIOMES.filter(b =>
        b.id !== nextBiome.id &&
        (b.tier === nextBiome.tier ||
          (nextBiome.tier === 'shallow' && b.tier === 'mid') ||
          (nextBiome.tier === 'mid' && (b.tier === 'shallow' || b.tier === 'deep'))
        )
      )
      if (candidates.length > 0) {
        nextSecondaryBiome = candidates[Math.floor(layerBlendRng() * candidates.length)]
      }
    }

    // GAIA descent quips — include a biome greeting.
    this.triggerGaia('mineEntry')
    // Biome greeting shown as a separate GAIA message after a short delay.
    setTimeout(() => {
      gaiaMessage.set(`Welcome to ${nextBiome.name}. ${nextBiome.description}`)
    }, 2000)

    // Harvest any items already sent up in the current layer before the scene is torn down.
    const currentScene = this.getMineScene()
    if (currentScene) {
      this.inventoryManager.sentUpItems.push(...currentScene.sentUpItems)
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
      secondaryBiome: nextSecondaryBiome,
      companionEffect: this.companionEffect,
    })

    currentScreen.set('mining')
  }

  /** Get active MineScene if running */
  private getMineScene(): MineScene | null {
    if (!this.game) return null
    const scene = this.game.scene.getScene('MineScene')
    return scene as MineScene | null
  }

  /**
   * Selects a random fact with interest-weighted bias.
   * Falls back to factsDB.getRandomOne() if no interest config.
   */
  private getInterestWeightedFact(): Fact | null {
    const ps = get(playerSave)

    // FIX-9: Use paced fact selection to avoid overwhelming the player with new facts.
    // Prioritises review-due facts, then previously unlocked facts, then new introductions
    // (capped at maxNewPerDive per dive).
    if (ps) {
      const interestWeights: Record<string, number> = ps.interestWeights ?? {}
      // Also fold in interest-config category weights
      const interestConfig: InterestConfig | undefined = ps.interestConfig
      if (interestConfig) {
        for (const cat of interestConfig.categories) {
          if (cat.weight > 0) {
            interestWeights[cat.category] = Math.max(interestWeights[cat.category] ?? 0, cat.weight)
          }
        }
      }

      const fact = factsDB.getPacedFact({
        learnedFacts: ps.learnedFacts,
        reviewStates: ps.reviewStates,
        unlockedFactIds: ps.unlockedFactIds,
        newFactsThisDive: this.newFactsThisDive,
        interestWeights,
      })

      if (fact) {
        // Track if this is a new fact for pacing purposes
        const isNew = !ps.learnedFacts.includes(fact.id) && !(ps.unlockedFactIds ?? []).includes(fact.id)
        if (isNew) {
          this.newFactsThisDive++
        }
        return fact
      }
    }

    // Fallback: legacy interest-weighted selection
    const interestConfig: InterestConfig | undefined = ps?.interestConfig
    if (!interestConfig || !interestConfig.categories.some(c => c.weight > 0)) {
      return factsDB.getRandomOne()
    }
    const allFacts = factsDB.getAll()
    if (allFacts.length === 0) return null
    const pool = allFacts.map(f => ({ id: f.id, category: f.category }))
    const selectedId = selectWeightedFact(pool, interestConfig, () => Math.random())
    if (!selectedId) return factsDB.getRandomOne()
    return factsDB.getById(selectedId) ?? factsDB.getRandomOne()
  }

  /** Get the DomeScene instance (null if game not booted) */
  getDomeScene(): DomeScene | null {
    if (!this.game) return null
    return this.game.scene.getScene('DomeScene') as DomeScene | null
  }

  /**
   * Start the DomeScene (called when entering the hub).
   * Stops MineScene if it is currently active.
   */
  startDome(data?: {
    unlockedIds?: string[]
    floorTiers?: Record<string, number>
    masteredCount?: number
    floorIndex?: number
  }): void {
    if (!this.game) return
    const sceneManager = this.game.scene
    if (sceneManager.isActive('MineScene')) {
      sceneManager.stop('MineScene')
    }
    if (sceneManager.isActive('DomeScene')) {
      // Already running — just update its state in-place
      const dome = this.getDomeScene()
      if (dome && data) {
        dome.setHubState(
          data.unlockedIds ?? ['starter'],
          data.floorTiers  ?? { starter: 0 },
          data.masteredCount ?? 0,
        )
      }
    } else {
      sceneManager.start('DomeScene', data)
    }
  }

  /**
   * Stop the DomeScene (called when starting a dive or navigating away from hub).
   */
  stopDome(): void {
    if (!this.game) return
    if (this.game.scene.isActive('DomeScene')) {
      this.game.scene.stop('DomeScene')
    }
  }

  // =========================================================
  // Dive lifecycle
  // =========================================================

  /** Start a new dive with the given number of oxygen tanks */
  startDive(tanks: number): void {
    if (!this.game) return

    const save = get(playerSave)
    if (!save) return


    // ---- Deduct dive insurance cost if insured ----
    const isInsured = save.insuredDive
    if (isInsured) {
      const insuranceCost = Math.floor(save.minerals.dust * BALANCE.INSURANCE_COST_PERCENT)
      if (insuranceCost > 0 && save.minerals.dust >= insuranceCost) {
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
    this.currentDiveInsured = isInsured && (save.minerals.dust >= Math.floor(save.minerals.dust * BALANCE.INSURANCE_COST_PERCENT))

    // Record pre-dive tank count (includes permanent upgrades) for restoration on dive end.
    const currentSave = get(playerSave) ?? save
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
    activeConsumables.set([])
    shieldActive.set(false)
    this.runRelics = []
    this.maxDepthThisRun = 0
    this.o2Paused = false
    this.quizManager.resetForDive()
    this.gaiaDepthMilestones.clear()
    this.gaiaManager.gaiaLowO2Warned = false
    this.currentLayer = 0
    this.diveSeed = Date.now() >>> 0
    this.bankedMinerals = {}
    this.inventoryManager.sentUpItems = []
    this.fossilRng = seededRandom(this.diveSeed ^ 0xf055111)
    this.newFactsThisDive = 0  // reset new-fact counter for pacing (FIX-9)
    currentLayerStore.set(0)

    // Generate a shuffled biome sequence for the entire run, seeded by the dive seed.
    const biomeRng = seededRandom(this.diveSeed ^ 0xb10e5)
    const ps = get(playerSave)
    this.biomeSequence = ps?.interestConfig?.categories?.some((c: { weight: number }) => c.weight > 0)
      ? generateInterestBiasedBiomeSequence(biomeRng, BALANCE.MAX_LAYERS, ps.interestConfig)
      : generateBiomeSequence(biomeRng, BALANCE.MAX_LAYERS)
    const layer0Biome = this.biomeSequence[0]
    currentBiomeStore.set(layer0Biome.name)
    currentBiomeId.set(layer0Biome.id)

    // Phase 49.2: Optionally assign a secondary biome to layer 0 (15% chance).
    const biomeBlendRng = seededRandom(this.diveSeed ^ 0x49b10e5)
    let layer0SecondaryBiome: Biome | undefined = undefined
    if (biomeBlendRng() < BALANCE.DUAL_BIOME_CHANCE) {
      const candidates = ALL_BIOMES.filter(b =>
        b.id !== layer0Biome.id &&
        (b.tier === layer0Biome.tier ||
          (layer0Biome.tier === 'shallow' && b.tier === 'mid') ||
          (layer0Biome.tier === 'mid' && (b.tier === 'shallow' || b.tier === 'deep'))
        )
      )
      if (candidates.length > 0) {
        layer0SecondaryBiome = candidates[Math.floor(biomeBlendRng() * candidates.length)]
      }
    }

    // Phase 49.7: Build difficulty profile from player engagement + archetype data.
    const latestSave = get(playerSave)
    const difficultyProfile: DifficultyProfile | undefined =
      latestSave?.engagementData && latestSave?.archetypeData
        ? buildDifficultyProfile(latestSave.engagementData, latestSave.archetypeData)
        : undefined

    // Phase 14: Determine if this is a tutorial dive (first-time player, diveCount === 0).
    // MineScene reads GameManager.getInstance().isTutorialDive to call generateTutorialMine().
    this.isTutorialDive = !currentSave.tutorialComplete && currentSave.diveCount === 0
    this.tutorialEarthquakeShown = false

    // Phase 10.15 — Cinematic dive transition.
    // Build the mine-start payload now (before any async gap), then fire the
    // DomeScene zoom-to-hatch animation.  When it completes, stop the dome and
    // launch the MineScene.  startDive() remains synchronous from the caller's
    // perspective; the scene swap happens ~800 ms later after the fade-out.
    const mineStartData = {
      seed: this.diveSeed,
      oxygenTanks: actualTanks,
      inventorySlots: BALANCE.STARTING_INVENTORY_SLOTS + inventoryBonusFromCrafts,
      facts: factIds,
      layer: 0,
      biome: layer0Biome,
      secondaryBiome: layer0SecondaryBiome,
      difficultyProfile,
      craftedOxygenBonus: oxygenBonusFromCrafts + consumableOxygenBonus,
      craftedStartingBombs: startingBombsFromCrafts,
      activeConsumables: activeConsumablesSnapshot,
      companionEffect: this.companionEffect,
    }

    const domeScene = this.getDomeScene()
    const launchMine = () => {
      // Stop DomeScene before starting MineScene
      this.stopDome()
      // Start the MineScene (pass crafted bonuses so MineScene can apply them)
      this.game!.scene.start('MineScene', mineStartData)
    }

    if (domeScene) {
      // Fire transition, then launch mine when it resolves
      void domeScene.playDiveTransition().then(launchMine)
    } else {
      launchMine()
    }

    currentScreen.set('mining')

    // Register auto-save listener (DD-V2-053)
    TickSystem.getInstance().register('autoSave', (tick) => {
      if (tick % AUTO_SAVE_TICK_INTERVAL === 0 && tick > 0) {
        const snapshot = this.buildDiveSaveState()
        if (snapshot) SaveManager.save(snapshot)
      }
    })

    // GAIA mine entry comment (delayed so the scene has time to load)
    setTimeout(() => {
      this.triggerGaia('mineEntry')
    }, 1500)
  }

  /** End the current dive and process results */
  endDive(forced: boolean = false): void {
    // Clear mid-dive auto-save on dive end (DD-V2-053)
    SaveManager.clear()

    const scene = this.getMineScene()
    if (!scene) {
      currentScreen.set('base')
      return
    }

    const results = scene.surfaceRun()

    // Merge scene-tracked sentUpItems with any accumulated on the InventoryManager
    // (scene resets on layer transitions, so InventoryManager accumulates across layers).
    const allSentUp = [
      ...this.inventoryManager.sentUpItems,
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
    // Phase 14: 0% loot loss for first oxygen depletion (tutorial rescue).
    // Items secured at a send-up station are NOT subject to this penalty regardless.
    const saveForLoss = get(playerSave)
    const isTutorialFirstDepletion = saveForLoss && !saveForLoss.tutorialComplete && saveForLoss.diveCount === 0
    if (forced && !this.currentDiveInsured && !isTutorialFirstDepletion) {
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
    // Phase 14: Show GAIA rescue message for tutorial first depletion
    if (forced && isTutorialFirstDepletion) {
      this.gaiaManager.tutorialGaiaLine('first_depletion_rescue')
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
    this.inventoryManager.sentUpItems = []
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

    // Phase 47: Check achievements after dive completion
    import('../services/achievementService').then(m => m.achievementService.onDiveComplete()).catch(() => {})

    // Phase 14: Increment diveCount and handle tutorial completion
    const currentSave = get(playerSave)
    if (currentSave) {
      const newDiveCount = currentSave.diveCount + 1
      playerSave.update(s => {
        if (!s) return s
        const updates: Partial<typeof s> = { diveCount: newDiveCount }
        // Mark tutorial complete after first dive
        if (!s.tutorialComplete && s.diveCount === 0) {
          updates.tutorialComplete = true
          updates.tutorialStep = 1
        }
        return { ...s, ...updates }
      })
      persistPlayer()

      // Fire progressive unlock GAIA message for dives 2-4
      const unlock = this.gaiaManager.postDiveProgressiveUnlock(newDiveCount)
      if (unlock) {
        // Delay slightly so it appears after dive results are dismissed
        setTimeout(() => {
          gaiaMessage.set(unlock.message)
          setTimeout(() => gaiaMessage.set(null), 8000)
        }, 1000)
      }

      // Tutorial dive complete GAIA line
      if (newDiveCount === 1) {
        this.gaiaManager.tutorialGaiaLine('tutorial_dive_complete')
      }
    }

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
    const diveResultsData = {
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
    }
    diveResults.set(diveResultsData)

    // Fire GAIA post-dive reaction commentary (Phase 15.1).
    // Skip the rare-mineral GAIA toast above if we fire a post-dive reaction,
    // so we only skip if neither essence nor geode were found (the rare-mineral
    // comments already set gaiaMessage above; post-dive reaction overwrites after delay).
    const lastBiome = get(currentBiomeId) ?? 'limestone_caves'
    this.gaiaManager.firePostDiveReaction(diveResultsData, lastBiome)

    // Stop the mine scene
    this.game?.scene.stop('MineScene')

    // Navigate to dive results summary
    currentScreen.set('diveResults')
  }

  /** Handle oxygen depletion — forced surface */
  private handleOxygenDepleted(): void {
    this.onPlayerDeath()
    this.applyLootLoss(this.currentLayer)
    this.endDive(true)
  }

  /** Track player death for auto-balance easing. Called when O2 reaches 0. */
  onPlayerDeath(): void {
    const layer = get(currentLayerStore)
    if (layer === this.lastDeathLayer) {
      this.sameLayerDeathCount++
    } else {
      this.sameLayerDeathCount = 1
      this.lastDeathLayer = layer
    }
    this.autoBalanceActive = this.sameLayerDeathCount >= AUTO_BALANCE_DEATH_THRESHOLD
  }

  /** Reset auto-balance when advancing to a new layer. */
  onLayerAdvance(): void {
    this.sameLayerDeathCount = 0
    this.autoBalanceActive = false
  }

  /** Whether auto-balance easing is currently active. */
  isAutoBalanceActive(): boolean { return this.autoBalanceActive }

  // =========================================================
  // Save / loot-loss / send-up (DD-V2-053, DD-V2-181)
  // =========================================================

  /**
   * Build a DiveSaveState snapshot from current game state.
   * Returns null if no mine scene is active. (DD-V2-053)
   */
  buildDiveSaveState(): DiveSaveState | null {
    const scene = this.getMineScene()
    if (!scene) return null

    const playerPos = scene.getPlayerGridPos()

    return {
      version: DIVE_SAVE_VERSION,
      savedAt: new Date().toISOString(),
      mineGrid: scene.getGrid().map(row => row.map(cell => (cell.type as unknown) as string)),
      playerPos,
      inventorySnapshot: get(inventory).map(slot => ({ type: slot.type, count: slot.mineralAmount ?? 1 })),
      ticks: TickSystem.getInstance().getTick(),
      layer: this.currentLayer,
      biomeId: get(currentBiomeId) ?? 'limestone_caves',
      o2: get(oxygenCurrent),
      diveSeed: this.diveSeed,
      relicIds: get(equippedRelicsV2).map(r => r.id),
      consumables: get(activeConsumables),
      bankedMinerals: { ...this.bankedMinerals },
      sameLayerDeathCount: this.sameLayerDeathCount,
      lastDeathLayer: this.lastDeathLayer,
    }
  }

  /**
   * Apply graduated loot loss on forced surface / abandoned run.
   * Banked minerals are always exempt. (DD-V2-181)
   * Layer 0-4 (L1-5): 0% loss. Layer 5-9 (L6-10): 15% loss. Layer 10-19 (L11-20): 30% loss.
   */
  applyLootLoss(layer: number): void {
    let lossRate = LOOT_LOSS_RATE_SHALLOW
    if (layer >= 5 && layer <= 9) lossRate = LOOT_LOSS_RATE_MID
    else if (layer >= 10) lossRate = LOOT_LOSS_RATE_DEEP

    if (lossRate === 0) return

    playerSave.update(s => {
      if (!s) return s
      const minerals = { ...s.minerals }
      for (const key of Object.keys(minerals) as Array<keyof typeof minerals>) {
        const banked = this.bankedMinerals[key] ?? 0
        const current = minerals[key] ?? 0
        const atRisk = Math.max(0, current - banked)
        const lost = Math.floor(atRisk * lossRate)
        minerals[key] = Math.max(0, current - lost)
      }
      return { ...s, minerals }
    })
    persistPlayer()
  }

  /**
   * Execute send-up: bank all portable minerals at a tick cost.
   * Banked minerals are safe from death loot loss. (DD-V2-053)
   */
  executeSendUp(): void {
    const inv = get(inventory)
    // Track banked minerals for loot-loss exemption
    for (const slot of inv) {
      this.bankedMinerals[slot.type] = (this.bankedMinerals[slot.type] ?? 0) + (slot.mineralAmount ?? 1)
    }

    // Transfer minerals to player save (persist immediately)
    playerSave.update(s => {
      if (!s) return s
      const minerals = { ...s.minerals }
      for (const slot of inv) {
        if (slot.type === 'mineral' && slot.mineralTier) {
          const tier = slot.mineralTier
          minerals[tier] = (minerals[tier] ?? 0) + (slot.mineralAmount ?? 1)
        }
      }
      return { ...s, minerals }
    })
    persistPlayer()

    // Clear portable inventory
    inventory.set([])

    // Advance ticks for pod deployment
    const ts = TickSystem.getInstance()
    for (let i = 0; i < SEND_UP_TICK_COST; i++) {
      ts.advance()
    }

    gaiaMessage.set('Send-up pod deployed. Minerals safe in dome storage.')
    setTimeout(() => gaiaMessage.set(null), 4000)
  }

  // =========================================================
  // Quiz handling — delegated to QuizManager
  // =========================================================

  /** Resume mining after a quiz gate answer */
  resumeQuiz(passed: boolean): void {
    this.quizManager.resumeQuiz(passed)
  }

  /** Handle a quiz answer during mining (gate mode) */
  handleQuizAnswer(correct: boolean): void {
    this.quizManager.handleQuizAnswer(correct)
  }

  /** Handle an oxygen quiz answer */
  handleOxygenQuizAnswer(correct: boolean): void {
    this.quizManager.handleOxygenQuizAnswer(correct)
  }

  /** Handle an artifact quiz answer */
  handleArtifactQuizAnswer(correct: boolean): void {
    this.quizManager.handleArtifactQuizAnswer(correct)
  }

  /** Handle a random (pop quiz) answer while mining */
  handleRandomQuizAnswer(correct: boolean): void {
    this.quizManager.handleRandomQuizAnswer(correct)
  }

  /** Handle a layer entrance quiz answer */
  handleLayerQuizAnswer(correct: boolean): void {
    this.quizManager.handleLayerQuizAnswer(correct)
  }

  /** Handle a combat encounter quiz answer (Phase 36). */
  handleCombatQuizAnswer(correct: boolean): void {
    this.quizManager.handleCombatQuizAnswer(correct)
  }

  // =========================================================
  // O2 pause during overlays (DD-V2-085)
  // =========================================================

  /** Pause O2 drain (called when a quiz overlay opens). (DD-V2-085) */
  pauseO2(): void {
    this.o2Paused = true
  }

  /** Resume O2 drain (called when a quiz overlay closes). */
  resumeO2(): void {
    this.o2Paused = false
  }

  /** Whether O2 drain is currently paused. */
  get isO2Paused(): boolean {
    return this.o2Paused
  }

  /**
   * Returns the QuizManager instance (dev/testing access).
   */
  getQuizManager(): QuizManager {
    return this.quizManager
  }

  /**
   * Returns the GaiaManager instance.
   * Used by HubView to start/stop the idle thought bubble timer (Phase 15.2).
   */
  getGaiaManager(): GaiaManager {
    return this.gaiaManager
  }

  /**
   * Force a random quiz to trigger immediately (dev/testing helper).
   * No-ops if not in an active dive or game is not running.
   */
  forceQuiz(): void {
    if (!this.game) return
    this.game.events.emit('random-quiz')
  }

  // =========================================================
  // Study session — delegated to StudyManager
  // =========================================================

  /**
   * Start a dedicated card-flip study session at base.
   */
  startStudySession(): void {
    this.studyManager.startStudySession()
  }

  /**
   * Handle a single card answer from the StudySession component.
   */
  handleStudyCardAnswer(factId: string, correct: boolean): void {
    this.studyManager.handleStudyCardAnswer(factId, correct)
  }

  /**
   * Called when the StudySession component signals completion.
   */
  completeStudySession(correctCount: number, totalCount: number): void {
    this.studyManager.completeStudySession(correctCount, totalCount)
  }

  /** Handle a study mode quiz answer (legacy, kept for backward compatibility) */
  handleStudyAnswer(correct: boolean): void {
    this.studyManager.handleStudyAnswer(correct)
  }

  // =========================================================
  // Artifact review — delegated to StudyManager
  // =========================================================

  /** Start reviewing pending artifacts from last dive */
  reviewNextArtifact(): void {
    this.studyManager.reviewNextArtifact()
  }

  /** Player chose to learn the current artifact fact */
  learnArtifact(): void {
    this.studyManager.learnArtifact()
  }

  /** Player chose to sell the current artifact fact */
  sellArtifact(): void {
    this.studyManager.sellArtifact()
  }

  // =========================================================
  // Backpack handling — delegated to InventoryManager
  // =========================================================

  /** Close backpack overlay and return to mining */
  closeBackpack(): void {
    this.inventoryManager.closeBackpack()
  }

  /** Drop an item from the backpack during a dive */
  dropItem(index: number): void {
    this.inventoryManager.dropItem(index)
  }

  // =========================================================
  // Send-up station — delegated to InventoryManager
  // =========================================================

  /**
   * Called by SendUpOverlay when the player confirms their item selection.
   */
  confirmSendUp(selectedItems: InventorySlot[]): void {
    this.inventoryManager.confirmSendUp(selectedItems)
  }

  /**
   * Called by SendUpOverlay when the player skips without sending anything.
   */
  skipSendUp(): void {
    this.inventoryManager.skipSendUp()
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
  // Bomb — delegated to InventoryManager
  // =========================================================

  /** Trigger bomb detonation in the active MineScene. */
  useBomb(): void {
    this.inventoryManager.useBomb()
  }

  /**
   * Apply a consumable tool from the active dive inventory. (DD-V2-064)
   * Delegates to MineScene which handles the actual effect and inventory deduction.
   */
  applyConsumable(id: import('../data/consumables').ConsumableId): void {
    const scene = this.getMineScene()
    scene?.applyConsumable(id)
  }

  // =========================================================
  // Phase 35: Offering Altar, Fragment Collection, Mine Events
  // =========================================================

  /**
   * Execute an altar sacrifice for the given tier.
   * Deducts the mineral cost, awards an artifact (rarity guaranteed by tier),
   * optionally rolls a recipe fragment at tier 4, marks the altar as used,
   * and returns to mining. (Phase 35.3)
   */
  completeSacrifice(tier: string): void {
    const save = get(playerSave)
    if (!save) return

    const costs = BALANCE.ALTAR_SACRIFICE_COSTS as Record<string, Record<string, number>>
    const cost = costs[tier]
    if (!cost) return

    // Deduct each mineral cost
    for (const [mineralTier, amount] of Object.entries(cost)) {
      if (amount > 0) {
        deductMinerals(mineralTier as MineralTier, amount)
      }
    }

    // Determine guaranteed rarity floor by tier
    const rarityFloor: Record<string, string> = {
      tier1: 'uncommon',
      tier2: 'rare',
      tier3: 'epic',
      tier4: 'legendary',
    }
    const guaranteedRarity = rarityFloor[tier] ?? 'uncommon'

    // Emit artifact found event for the scene to handle inventory
    const altarState = get(activeAltar)
    if (altarState) {
      const scene = this.getMineScene()
      if (scene) {
        scene.markAltarUsed(altarState.altarX, altarState.altarY)
      }
    }

    // Add a pending artifact with the guaranteed rarity
    pendingArtifacts.update(existing => [...existing, `altar_${guaranteedRarity}_${Date.now()}`])

    gaiaMessage.set(`Sacrifice accepted. A ${guaranteedRarity} relic emerges from the stone.`)

    // Tier 4: roll for a bonus recipe fragment
    if (tier === 'tier4' && Math.random() < BALANCE.ALTAR_FRAGMENT_CHANCE_TIER4) {
      // Pick a random recipe fragment from all available recipes
      const eligibleRecipes = ['ancient_drill', 'resonance_lens', 'temporal_shard', 'echo_compass', 'deep_pact']
      if (eligibleRecipes.length > 0) {
        const randomId = eligibleRecipes[Math.floor(Math.random() * eligibleRecipes.length)]
        this.collectRecipeFragment(randomId)
      }
      // Tier 4 altar also adds instability
      const scene = this.getMineScene()
      if (scene) {
        scene.addInstability('altar_tier4')
      }
    }

    // Clear altar state and return to mining
    activeAltar.set(null)
    currentScreen.set('mining')
  }

  /**
   * Collect a recipe fragment for the given fragmentId.
   * Increments the fragment count in playerSave.recipeFragments.
   * If the total equals the recipe's totalFragments, pushes to assembledRecipes. (Phase 35.5)
   */
  private collectRecipeFragment(fragmentId: string): void {
    if (!fragmentId) return

    const recipe = getFragmentRecipe(fragmentId)
    if (!recipe) return

    let justCompleted = false
    playerSave.update(s => {
      if (!s) return s
      const recipeFragments: Record<string, number> = { ...(s.recipeFragments ?? {}) }
      recipeFragments[fragmentId] = (recipeFragments[fragmentId] ?? 0) + 1
      const count = recipeFragments[fragmentId]

      let assembledRecipes = [...(s.assembledRecipes ?? [])]
      if (count >= recipe.totalFragments && !assembledRecipes.includes(fragmentId)) {
        assembledRecipes = [...assembledRecipes, fragmentId]
        justCompleted = true
      }

      return { ...s, recipeFragments, assembledRecipes }
    })
    persistPlayer()

    const count = (get(playerSave)?.recipeFragments?.[fragmentId] ?? 0)
    if (justCompleted) {
      gaiaMessage.set(`${recipe.icon} Fragment set complete: ${recipe.name}! Check the Materializer to craft it.`)
    } else {
      gaiaMessage.set(`${recipe.icon} Fragment collected (${Math.min(count, recipe.totalFragments)}/${recipe.totalFragments}) — ${recipe.name}`)
    }
  }

  /**
   * Handle a random mine event dispatched by MineEventSystem. (Phase 35.7)
   * Each event type has distinct in-mine effects.
   */
  private handleMineEvent(type: MineEventType): void {
    const event = getMineEvent(type)
    if (!event) return

    // Show the event overlay in the HUD
    activeMineEvent.set({ type, label: event.label })
    gaiaMessage.set(event.gaiaLine)

    const scene = this.getMineScene()

    switch (type) {
      case 'tremor':
        // Trigger a small earthquake (scene handles block collapse)
        if (scene) {
          scene.triggerSmallEarthquake()
        }
        break

      case 'gas_leak':
        // Spawn a gas cloud at a random position in the lower half of the grid
        if (scene) {
          scene.spawnRandomGasLeak()
        }
        break

      case 'relic_signal':
        // Briefly reveal all RelicShrine cells (scene handles the reveal)
        if (scene) {
          scene.revealRelicShrines(5000)
        }
        break

      case 'crystal_vein':
        // Reveal mineral nodes near the player
        if (scene) {
          scene.revealNearbyMinerals(8)
        }
        break

      case 'pressure_surge':
        // Drain O2 immediately
        if (scene) {
          scene.drainOxygen(5)
        }
        break
    }

    // Auto-clear the overlay after 3 seconds
    setTimeout(() => {
      activeMineEvent.update(current => (current?.type === type ? null : current))
    }, 3000)
  }

  // =========================================================
  // GAIA (ship AI) commentary — delegated to GaiaManager
  // =========================================================

  /**
   * Pick a random line and push it to the gaiaMessage store,
   * subject to the player's chattiness setting.
   */
  private randomGaia(lines: string[], trigger = 'idle'): void {
    this.gaiaManager.randomGaia(lines, trigger)
  }

  /**
   * Emit a mood-aware GAIA line for the given named trigger, respecting chattiness.
   */
  private triggerGaia(trigger: keyof typeof GAIA_TRIGGERS): void {
    this.gaiaManager.triggerGaia(trigger)
  }

  /**
   * Awards one unit of the given premium material to the player's save and shows a
   * GAIA toast. Premium materials are rare in-game drops — never sold for real money.
   */
  private awardPremiumMaterial(materialId: PremiumMaterial): void {
    this.gaiaManager.awardPremiumMaterial(materialId)
  }
}
