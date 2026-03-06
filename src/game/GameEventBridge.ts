/** SIZE BUDGET: Event bridge — extracted from GameManager. Stay below 600 lines. */
import type Phaser from 'phaser'
import type { GameManager } from './GameManager'
import type { OxygenState } from './systems/OxygenSystem'
import type { InventorySlot, MineralTier, FossilState } from '../data/types'
import type { Relic } from '../data/types'
import type { MineEventType } from '../data/mineEvents'
import type { Boss } from './entities/Boss'
import type { Creature } from './entities/Creature'
import { get } from 'svelte/store'
import { BALANCE, getLayerGridSize, BASE_LAVA_HAZARD_DAMAGE, BASE_GAS_HAZARD_DAMAGE } from '../data/balance'
import { PREMIUM_MATERIALS } from '../data/premiumRecipes'
import { pickRandomDisc } from '../data/dataDiscs'
import { getActiveSynergies } from '../data/relics'
import { pickFossilDrop } from '../data/fossils'
import { getQuizChoices } from '../services/quizService'
import { factsDB } from '../services/factsDB'
import { encounterManager } from './managers/EncounterManager'
import {
  currentScreen,
  oxygenCurrent,
  oxygenMax,
  currentDepth,
  currentLayer as currentLayerStore,
  currentBiome as currentBiomeStore,
  inventory,
  activeQuiz,
  activeUpgrades,
  pickaxeTier,
  blocksMinedLive,
  gaiaMessage,
  activeRelics,
  activeSynergies,
  showSendUp,
  tempBackpackSlots,
  scannerTier,
  companionBadgeFlash,
  shieldActive,
  currentBiomeId,
  descentOverlayState,
  activeAltar,
  activeMineEvent,
} from '../ui/stores/gameState'
import {
  playerSave,
  persistPlayer,
  addMinerals,
} from '../ui/stores/playerData'

/**
 * Sets up all Phaser -> Svelte event listeners.
 * Extracted from GameManager to reduce file size.
 * @internal
 */
export function wireEventBridge(gm: GameManager, events: Phaser.Events.EventEmitter): void {

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
    if (!gm.gaiaManager.gaiaLowO2Warned && state.max > 0 && state.current / state.max < 0.25) {
      gm.gaiaManager.gaiaLowO2Warned = true
      gm.triggerGaia('lowOxygen')
    }
  })

  events.on('depth-changed', (depth: number) => {
    currentDepth.set(depth)
    if (depth > gm.maxDepthThisRun) gm.maxDepthThisRun = depth

    // Derive grid height from current layer so depth milestones scale correctly.
    const [, gridHeight] = getLayerGridSize(gm.currentLayer + 1)
    const pct = depth / gridHeight

    if (pct >= 0.25 && !gm.gaiaDepthMilestones.has(25)) {
      gm.gaiaDepthMilestones.add(25)
      gm.triggerGaia('depthMilestone25')
    } else if (pct >= 0.5 && !gm.gaiaDepthMilestones.has(50)) {
      gm.gaiaDepthMilestones.add(50)
      gm.triggerGaia('depthMilestone50')
    } else if (pct >= 0.75 && !gm.gaiaDepthMilestones.has(75)) {
      gm.gaiaDepthMilestones.add(75)
      gm.triggerGaia('depthMilestone75')
    }
  })

  events.on('mineral-collected', (data: { mineralType?: string; mineralAmount?: number; addedToInventory: boolean }) => {
    // Update inventory display
    gm.inventoryManager.syncInventoryFromScene()
    // 1% chance to drop a void_crystal when collecting a geode or essence mineral
    const tier = data.mineralType as MineralTier | undefined
    if ((tier === 'geode' || tier === 'essence') && Math.random() < PREMIUM_MATERIALS.find(m => m.id === 'void_crystal')!.dropChance) {
      gm.gaiaManager.awardPremiumMaterial('void_crystal')
    }
  })

  events.on('cave-in', (_data: { affectedCount: number }) => {
    gm.triggerGaia('caveIn')
  })

  events.on('earthquake', (_data: { collapsed: number; revealed: number }) => {
    gm.triggerGaia('earthquake')
  })

  events.on(
    'artifact-found',
    (data: { factId?: string; rarity?: string; addedToInventory: boolean; rarityBoosted?: boolean }) => {
      gm.inventoryManager.syncInventoryFromScene()
      // 3% chance to drop star_dust when collecting any artifact
      if (Math.random() < PREMIUM_MATERIALS.find(m => m.id === 'star_dust')!.dropChance) {
        gm.gaiaManager.awardPremiumMaterial('star_dust')
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
          gm.triggerGaia('artifactFound')
        }
      } else {
        gm.triggerGaia('artifactFound')
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
    gm.inventoryManager.syncInventoryFromScene()
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
      gm.randomGaia(quips)
    }
  })

  events.on('pickaxe-upgraded', (data: { tierIndex: number; tierName: string }) => {
    pickaxeTier.set(data.tierIndex)
    gaiaMessage.set(`Upgraded to ${data.tierName}! Mining just got easier.`)
  })

  events.on('backpack-expanded', (data: { slotsAdded: number; totalSlots: number; expansionCount: number }) => {
    // Sync inventory now that new slots have been added.
    gm.inventoryManager.syncInventoryFromScene()
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
    gm.runRelics.push(relic)
    activeRelics.set([...gm.runRelics])

    // Check for newly activated synergies
    const relicIds = gm.runRelics.map(r => r.id)
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
    gm.randomGaia(relicQuips)
  })

  events.on('blocks-mined-update', (count: number) => {
    blocksMinedLive.set(count)
  })

  events.on('quiz-gate', (data: { factId?: string; gateX?: number; gateY?: number; gateRemaining?: number; gateTotal?: number }) => {
    const qm = gm.getQuizManager()
    qm.pendingGateCoords = (data.gateX !== undefined && data.gateY !== undefined)
      ? { x: data.gateX, y: data.gateY }
      : null
    // Initialize gate retry attempts for this gate encounter
    qm.resetGateAttempts()
    // Pick a random fact for each gate question (not the same stored factId every time)
    const fact = gm.getInterestWeightedFact()
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
      gm.resumeQuiz(true)
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
      const scene = gm.getMineScene()
      if (scene) {
        scene.resumeFromOxygenQuiz(true)
      }
    }
  })

  events.on('exit-reached', () => {
    gm.triggerGaia('exitReached')
    gm.endDive(false)
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
        gm.getQuizManager().artifactQuizUsedFactIds.clear()
      }

      // Pick a fact we haven't used yet in this artifact flow
      let fact: ReturnType<typeof factsDB.getById> = null
      if (data.factId && !gm.getQuizManager().artifactQuizUsedFactIds.has(data.factId)) {
        fact = factsDB.getById(data.factId)
      }
      if (!fact) {
        // Find a random unused fact
        const allIds = factsDB.getAllIds()
        const unusedIds = allIds.filter((id) => !gm.getQuizManager().artifactQuizUsedFactIds.has(id))
        if (unusedIds.length > 0) {
          const randomId = unusedIds[Math.floor(Math.random() * unusedIds.length)]
          fact = factsDB.getById(randomId)
        }
      }

      if (fact) {
        gm.getQuizManager().artifactQuizUsedFactIds.add(fact.id)
        const choices = getQuizChoices(fact)
        activeQuiz.set({
          fact,
          choices,
          source: 'artifact',
          gateProgress: { remaining, total },
        })
        currentScreen.set('quiz')
        if (questionNumber === 1) {
          gaiaMessage.set("Appraisal time. Answer well and the artifact's value might surprise you.")
        }
      } else {
        // No fact available — skip to finalize with whatever boosts accumulated
        const scene = gm.getMineScene()
        if (scene) {
          scene.resumeFromArtifactQuiz(true)
        }
      }
    },
  )

  events.on('random-quiz', () => {
    const fact = gm.getInterestWeightedFact()
    if (fact) {
      const choices = getQuizChoices(fact)
      activeQuiz.set({ fact, choices, source: 'random' })
      currentScreen.set('quiz')
      gaiaMessage.set("Scanner ping! Residual data detected — answer to earn bonus minerals.")
    } else {
      // No fact available — resume without quiz
      const scene = gm.getMineScene()
      if (scene) {
        scene.resumeFromRandomQuiz(false)
      }
    }
  })

  events.on('oxygen-depleted', () => {
    gm.handleOxygenDepleted()
  })

  events.on('open-backpack', () => {
    gm.inventoryManager.syncInventoryFromScene()
    currentScreen.set('backpack')
  })

  events.on('run-complete', () => {
    // Handled by endDive
  })

  // Phase 52: Layer entrance challenge — sequential multi-question flow
  let layerChallengeRemaining = 0
  let layerChallengeTotal = 0
  let layerChallengeAllCorrect = true

  function presentNextLayerQuestion(): void {
    if (layerChallengeRemaining <= 0) {
      gm.quizManager.layerChallengeActive = false
      const scene = gm.getMineScene()
      if (scene) {
        scene.resumeFromLayerQuiz(true)
        if (get(currentScreen) !== 'diveResults') {
          if (layerChallengeAllCorrect) {
            gaiaMessage.set("Perfect calibration. Descending with full confidence.")
          } else {
            gaiaMessage.set("Calibration complete. Descending...")
          }
          currentScreen.set('mining')
        }
      }
      return
    }

    const fact = gm.getInterestWeightedFact()
    if (!fact) {
      layerChallengeRemaining = 0
      presentNextLayerQuestion()
      return
    }

    const choices = getQuizChoices(fact)
    const currentQ = layerChallengeTotal - layerChallengeRemaining + 1
    const mnemonicInfo = gm.quizManager.getMnemonicInfo(fact.id, (fact as any).mnemonic)

    activeQuiz.set({
      fact,
      choices,
      source: 'layer',
      layerChallengeProgress: { current: currentQ, total: layerChallengeTotal },
      ...mnemonicInfo,
    })
    currentScreen.set('quiz')

    if (currentQ === 1) {
      gaiaMessage.set("The shaft hums with energy. Prove your knowledge to descend safely.")
    }
  }

  events.on('layer-entrance-quiz', (_data: { layer: number }) => {
    layerChallengeTotal = BALANCE.LAYER_ENTRANCE_QUESTIONS
    layerChallengeRemaining = layerChallengeTotal
    layerChallengeAllCorrect = true
    gm.quizManager.layerChallengeActive = true
    presentNextLayerQuestion()
  })

  // Phase 52: Listen for layer challenge answer events from QuizManager
  window.addEventListener('layer-challenge-answer', ((e: CustomEvent<{ correct: boolean }>) => {
    const { correct } = e.detail
    if (!correct) layerChallengeAllCorrect = false
    layerChallengeRemaining--
    presentNextLayerQuestion()
  }) as EventListener)

  events.on('descent-shaft-entered', (data: {
    layer: number
    inventory: InventorySlot[]
    blocksMinedThisRun: number
    artifactsFound: string[]
    oxygenState: OxygenState
  }) => {
    gm.handleDescentShaft(data)
  })

  events.on('quote-found', (data: { quote: string }) => {
    gaiaMessage.set(data.quote)
  })

  events.on('send-up-station', (_data: { inventory: InventorySlot[] }) => {
    showSendUp.set(true)
    gm.randomGaia([
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
      gm.gaiaManager.awardPremiumMaterial('ancient_essence')
    }

    // Pick species using seeded RNG for this dive (deterministic per seed).
    const species = pickFossilDrop(gm.fossilRng)
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
    gm.gaiaManager.triggerGaia('hazardLava')
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
    gm.collectRecipeFragment(data.fragmentId)
  })

  // ---- Phase 35.7: Mine event fired ----
  events.on('mine-event', (data: { type: MineEventType }) => {
    gm.handleMineEvent(data.type)
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
