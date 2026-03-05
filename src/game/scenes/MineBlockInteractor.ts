/**
 * MineBlockInteractor — extracted block interaction and gameplay logic from MineScene.
 * All functions receive `scene: MineScene` as their first parameter.
 */
import { get } from 'svelte/store'
import { BALANCE } from '../../data/balance'
import { BlockType, type InventorySlot, type MineralTier, type RunUpgrade, type BackpackItemState } from '../../data/types'
import { canMine, mineBlock } from '../systems/MiningSystem'
import { revealAround } from '../systems/MineGenerator'
import {
  addOxygen,
  consumeOxygen,
  getOxygenCostForBlock,
} from '../systems/OxygenSystem'
import { audioManager } from '../../services/audioService'
import { pickRandomRelic } from '../../data/relics'
import { QUOTE_STONES } from '../../data/quoteStones'
import { CAVERN_TEXTS } from '../../data/cavernTexts'
import { quoteStoneModalEntry, cavernTextModalEntry } from '../../ui/stores/gameState'
import { invalidateNeighborVariants } from '../systems/AutotileSystem'
import { TickSystem } from '../systems/TickSystem'
import { tickCount, layerTickCount } from '../../ui/stores/gameState'
import { BASE_LAVA_HAZARD_DAMAGE, BASE_GAS_HAZARD_DAMAGE, getO2DepthMultiplier, CONSUMABLE_DROP_CHANCE } from '../../data/balance'
import { ALL_CONSUMABLE_IDS, CONSUMABLE_DEFS, type ConsumableId } from '../../data/consumables'
import {
  activeConsumables, addConsumableToDive, useConsumableFromDive,
  shieldActive, instabilityLevel, instabilityCollapsing, instabilityCountdown,
  gaiaMessage, decisionScreenState, currentScreen, inventory,
} from '../../ui/stores/gameState'
import { LANDMARK_TEMPLATES, COMPLETION_EVENTS, getLandmarkIdForLayer } from '../../data/landmarks'
import { BOSS_LAYER_MAP, createBoss } from '../entities/Boss'
import { encounterManager } from '../managers/EncounterManager'
import { playerSave } from '../../ui/stores/playerData'
import { GameManager } from '../GameManager'
import type { MineScene } from './MineScene'

const TILE_SIZE = BALANCE.TILE_SIZE

/**
 * Core logic for moving into an empty tile or mining an adjacent block.
 * Called by both handlePointerDown and handleKeyDown after the target
 * grid position has been determined.
 */
export function handleMoveOrMine(scene: MineScene, targetX: number, targetY: number): void {
  const playerX = scene.player.gridX
  const playerY = scene.player.gridY
  const targetCell = scene.grid[targetY][targetX]

  // Track facing direction for Drill Charge
  const dx = targetX - playerX
  const dy = targetY - playerY
  if (dx > 0) scene.playerFacing = 'right'
  else if (dx < 0) scene.playerFacing = 'left'
  else if (dy > 0) scene.playerFacing = 'down'
  else if (dy < 0) scene.playerFacing = 'up'

  if (targetCell.type === BlockType.Empty || targetCell.type === BlockType.ExitLadder) {
    const isExitLadder = targetCell.type === BlockType.ExitLadder
    const moved = scene.player.moveToEmpty(targetX, targetY, scene.grid)
    if (!moved) {
      return
    }

    // Trigger walk animation
    scene.animController.setWalk(targetX - playerX, targetY - playerY)
    scene.time.delayedCall(200, () => {
      if (!scene.animController.isPlayingMineAnim) {
        scene.animController.setIdle()
      }
    })

    revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
    if (scene.activeUpgrades.has('scanner_boost')) {
      revealSpecialBlocks(scene)
    }
    // Update fog glow after block reveals
    if (scene.glowSystem) {
      scene.glowSystem.update(scene.grid)
    }

    // Phase 35.3: Check adjacent cells for offering altar after each move
    {
      const newX = scene.player.gridX
      const newY = scene.player.gridY
      for (const [adx, ady] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const ax = newX + adx, ay = newY + ady
        if (ax >= 0 && ax < scene.gridWidth && ay >= 0 && ay < scene.gridHeight) {
          const aCell = scene.grid[ay][ax]
          if (aCell?.type === BlockType.OfferingAltar && !aCell.altarUsed) {
            scene.game.events.emit('altar-adjacent', { x: ax, y: ay })
            break
          }
        }
      }
    }

    // Advance tick on every successful player move
    const tsMove = TickSystem.getInstance()
    tsMove.advance()
    tickCount.set(tsMove.getTick())
    layerTickCount.set(tsMove.getLayerTick())

    scene.game.events.emit('oxygen-changed', scene.oxygenState)
    scene.game.events.emit('depth-changed', scene.player.gridY)
    checkPointOfNoReturn(scene)

    if (isExitLadder) {
      scene.game.events.emit('exit-reached')
    }

    scene.redrawAll()
    return
  }

  // WallText: non-mineable but tappable — opens cavern text modal
  if (targetCell.type === BlockType.WallText) {
    const isAdjacent = Math.abs(targetX - playerX) + Math.abs(targetY - playerY) === 1
    if (isAdjacent) {
      const textId = targetCell.content?.factId
      if (textId) {
        const ctEntry = CAVERN_TEXTS.find(ct => ct.id === textId)
        if (ctEntry) {
          cavernTextModalEntry.set(ctEntry)
          currentScreen.set('cavern_text' as any)
        }
      }
    }
    return
  }

  if (!canMine(scene.grid, targetX, targetY, playerX, playerY)) {
    return
  }

  const blockType = targetCell.type

  if (blockType !== BlockType.QuizGate) {
    let oxygenCost = getOxygenCostForBlock(blockType)
    if (scene.activeUpgrades.has('oxygen_efficiency')) {
      const o2Count = scene.activeUpgrades.get('oxygen_efficiency') ?? 0
      oxygenCost = Math.max(1, Math.ceil(oxygenCost * Math.pow(BALANCE.UPGRADE_OXYGEN_EFFICIENCY, o2Count)))
    }
    // Apply depth multiplier: O2 costs scale linearly with layer (DD-V2-061)
    const depthMult = getO2DepthMultiplier(scene.currentLayer)
    oxygenCost = Math.ceil(oxygenCost * depthMult)
    const oxygenResult = consumeOxygen(scene.oxygenState, oxygenCost)
    scene.oxygenState = oxygenResult.state

    if (oxygenResult.depleted) {
      scene.game.events.emit('oxygen-changed', scene.oxygenState)
      scene.game.events.emit('oxygen-depleted')
      scene.redrawAll()
      return
    }
  }

  // QuizGate: trigger quiz before mining — each correct answer removes 1 hardness
  if (blockType === BlockType.QuizGate) {
    scene.isPaused = true
    scene.game.events.emit('quiz-gate', {
      factId: targetCell.content?.factId,
      gateX: targetX,
      gateY: targetY,
      gateRemaining: targetCell.hardness,
      gateTotal: targetCell.maxHardness,
    })
    return
  }

  // LockedBlock guard (Phase 35.6): check if player can break this block
  if (blockType === BlockType.LockedBlock && targetCell.requiredTier !== undefined) {
    const hasPickaxe = scene.pickaxeTierIndex >= targetCell.requiredTier
    const consumableSlots = get(activeConsumables)
    const hasDrill = consumableSlots.some(s => s.id === 'drill_charge' && s.count > 0)
    const hasBomb = consumableSlots.some(s => s.id === 'bomb' && s.count > 0)
    if (!hasPickaxe && !hasDrill && !hasBomb) {
      // Only show the GAIA denial message once per unique block position per layer
      const blockKey = `${targetX},${targetY}`
      if (!scene.lockedBlockDeniedSet.has(blockKey)) {
        scene.lockedBlockDeniedSet.add(blockKey)
        scene.game.events.emit('locked-block-denied', { x: targetX, y: targetY, requiredTier: targetCell.requiredTier })
      }
      return  // No O2 cost, no block damage
    }
  }

  // OfferingAltar guard (Phase 35.3): can't be mined — tap does nothing
  if (blockType === BlockType.OfferingAltar) {
    return
  }

  // ChallengeGate guard (Phase 48.4): tap opens Challenge Quiz overlay
  if (blockType === BlockType.ChallengeGate) {
    scene.game.events.emit('challenge-gate-tapped', { x: targetX, y: targetY })
    return
  }

  // Companion instant_break: N% chance to destroy any block in one hit
  if (
    scene.companionEffect?.type === 'instant_break' &&
    scene.rng() < scene.companionEffect.value &&
    targetCell.hardness > 1
  ) {
    targetCell.hardness = 1
    scene.companionFlash = true
    scene.gearOverlay?.flashCompanionBadge()   // Phase 29: flash badge on companion trigger
    scene.game.events.emit('companion-triggered', { effect: 'instant_break' })
  }

  // Pickaxe tier damage: apply tier-based extra damage before mining
  // Tier 0 (Stone Pick) does 1 damage (default mineBlock), higher tiers do bonus damage
  const tierDamage = BALANCE.PICKAXE_TIERS[scene.pickaxeTierIndex].damage
  if (tierDamage > 1 && targetCell.hardness > 1) {
    targetCell.hardness = Math.max(1, targetCell.hardness - (tierDamage - 1))
  }

  // Track per-block hit count for impact escalation
  const hitCount = scene.player.recordHit(targetX, targetY)
  const targetCellBefore = scene.grid[targetY][targetX]
  const isFinalHit = targetCellBefore.hardness === 1

  // Trigger mine animation with input buffering support
  const mineDx = targetX - playerX
  const mineDy = targetY - playerY
  scene.animController.setMine(mineDx, mineDy, () => {
    scene.animController.setIdle()
    // Process buffered input for rhythm mining
    if (scene.bufferedInput) {
      const buf = scene.bufferedInput
      scene.bufferedInput = null
      handleMoveOrMine(scene, buf.x, buf.y)
    }
  })

  const mineResult = mineBlock(scene.grid, targetX, targetY)
  if (mineResult.destroyed) {
    invalidateNeighborVariants(scene.grid, targetX, targetY, scene.currentBiome.id)
  }
  if (mineResult.success) {
    const blockWorldX = targetX * TILE_SIZE + TILE_SIZE * 0.5
    const blockWorldY = targetY * TILE_SIZE + TILE_SIZE * 0.5

    // Trigger impact feedback (shake, flash, haptic)
    scene.impactSystem.triggerHit(
      blockType,
      hitCount,
      isFinalHit,
      blockWorldX,
      blockWorldY,
      targetX,
      targetY,
      scene.pickaxeTierIndex,
      scene.flashTiles
    )

    scene.blocksMinedThisRun += 1
    scene.blocksSinceLastQuake += 1
    scene.game.events.emit('blocks-mined-update', scene.blocksMinedThisRun)

    // Phase 36: Creature spawn check after each block mined
    if (mineResult.destroyed) {
      const spawnedCreature = scene.creatureSpawner.checkSpawn(
        scene.currentLayer,
        (scene.currentBiome?.id as import('../../data/biomes').BiomeId) ?? null
      )
      if (spawnedCreature) {
        scene.game.events.emit('creature-encounter', spawnedCreature)
      }
    }

    // Advance tick on every successful block hit
    const tsMine = TickSystem.getInstance()
    tsMine.advance()
    tickCount.set(tsMine.getTick())
    layerTickCount.set(tsMine.getLayerTick())
    // oxygen_regen relic: restore O2 every 10 blocks mined
    if (scene.blocksMinedThisRun % 10 === 0) {
      const regenRelic = scene.collectedRelics.find(r => r.effect.type === 'oxygen_regen')
      if (regenRelic && regenRelic.effect.type === 'oxygen_regen') {
        // oxygen_regen_boost synergy: add extra O2 on top of base regen
        const synergyEffects = scene.getActiveSynergyEffects()
        const boostEffect = synergyEffects.find(e => e.type === 'oxygen_regen_boost')
        const bonusAmount = (boostEffect && boostEffect.type === 'oxygen_regen_boost') ? boostEffect.amount : 0
        scene.oxygenState = addOxygen(scene.oxygenState, regenRelic.effect.amount + bonusAmount)
        scene.game.events.emit('oxygen-changed', scene.oxygenState)
      }
    }
    if (!mineResult.destroyed) {
      // Sound feedback for non-destroying hits (impact system handles flash)
      if (blockType === BlockType.Dirt || blockType === BlockType.SoftRock || blockType === BlockType.GasPocket) {
        audioManager.playSound('mine_dirt')
      } else if (blockType === BlockType.Stone || blockType === BlockType.HardRock || blockType === BlockType.Unbreakable || blockType === BlockType.LavaBlock) {
        audioManager.playSound('mine_rock')
      } else if (blockType === BlockType.MineralNode) {
        audioManager.playSound('mine_crystal')
      } else {
        audioManager.playSound('mine_dirt')
      }
    }

    // Clear hit count when block is destroyed
    if (mineResult.destroyed) {
      scene.player.clearHitCount(targetX, targetY)
    }
  }

  if (mineResult.destroyed) {
    scene.spawnBreakParticles(targetX * TILE_SIZE, targetY * TILE_SIZE, blockType)
    audioManager.playSound('mine_break')

    // Consumable drop chance (DD-V2-064)
    if (Math.random() < CONSUMABLE_DROP_CHANCE) {
      const dropped = ALL_CONSUMABLE_IDS[Math.floor(Math.random() * ALL_CONSUMABLE_IDS.length)]
      const added = addConsumableToDive(dropped)
      if (added) {
        scene.game.events.emit('gaia-toast', `Found: ${CONSUMABLE_DEFS[dropped].label}`)
      }
    }

    // Random quiz: only on plain terrain blocks, not when already paused.
    // The adaptive rate check (cooldown, fatigue, first-trigger-after-N) is
    // delegated to QuizManager via the game registry. (DD-V2-060)
    const randomQuizEligibleTypes = new Set<BlockType>([
      BlockType.Dirt,
      BlockType.SoftRock,
      BlockType.Stone,
      BlockType.HardRock,
      BlockType.LavaBlock,
      BlockType.GasPocket,
    ])
    const adaptiveQuizCheck = scene.game.registry.get('shouldTriggerRandomQuiz') as (() => boolean) | undefined
    const shouldTriggerQuiz = adaptiveQuizCheck
      ? adaptiveQuizCheck()
      : (scene.blocksMinedThisRun >= BALANCE.RANDOM_QUIZ_MIN_BLOCKS && Math.random() < BALANCE.RANDOM_QUIZ_CHANCE)
    if (
      randomQuizEligibleTypes.has(blockType) &&
      !scene.isPaused &&
      shouldTriggerQuiz
    ) {
      scene.isPaused = true
      scene.game.events.emit('random-quiz')
      // Flush state updates so the UI is current when the quiz overlay appears
      revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
      if (scene.activeUpgrades.has('scanner_boost')) {
        revealSpecialBlocks(scene)
      }
      scene.game.events.emit('oxygen-changed', scene.oxygenState)
      scene.redrawAll()
      return
    }

    // Earthquake trigger: after cooldown and minimum blocks, random chance per destroyed block
    if (
      scene.blocksSinceLastQuake >= BALANCE.EARTHQUAKE_COOLDOWN &&
      scene.blocksMinedThisRun >= BALANCE.EARTHQUAKE_MIN_BLOCKS &&
      !scene.isPaused &&
      Math.random() < BALANCE.EARTHQUAKE_CHANCE_PER_BLOCK
    ) {
      triggerEarthquake(scene)
    }

    switch (blockType) {
      case BlockType.MineralNode: {
        let mineralAmount = mineResult.content?.mineralAmount ?? 0
        // lucky_strike relic: chance to double mineral drops
        const luckyRelic = scene.collectedRelics.find(r => r.effect.type === 'lucky_strike')
        if (luckyRelic && luckyRelic.effect.type === 'lucky_strike' && scene.rng() < luckyRelic.effect.chance) {
          mineralAmount = mineralAmount * 2
        }
        // mineral_multiplier synergy (Treasure Hunter): multiply mineral drops
        const mineralSynergyEffects = scene.getActiveSynergyEffects()
        const multiplierEffect = mineralSynergyEffects.find(e => e.type === 'mineral_multiplier')
        if (multiplierEffect && multiplierEffect.type === 'mineral_multiplier') {
          mineralAmount = Math.round(mineralAmount * multiplierEffect.multiplier)
        }
        // mineral_rate companion: N% chance to add +1 to mineral yield
        if (scene.companionEffect?.type === 'mineral_rate' && scene.rng() < scene.companionEffect.value) {
          mineralAmount += 1
          scene.companionFlash = true
          scene.gearOverlay?.flashCompanionBadge()   // Phase 29: flash badge on companion trigger
          scene.game.events.emit('companion-triggered', { effect: 'mineral_rate' })
        }
        // mineral_magnet relic: after collecting, auto-collect adjacent MineralNodes
        const mineralSlot: InventorySlot = {
          type: 'mineral',
          mineralTier: mineResult.content?.mineralType,
          mineralAmount,
        }
        const added = addToInventory(scene, mineralSlot)
        if (!added) {
          triggerDecisionScreen(scene, mineralSlot)
        }
        scene.game.events.emit('mineral-collected', {
          ...mineResult.content,
          mineralAmount,
          addedToInventory: added,
        })
        audioManager.playSound('collect')
        // Pop loot toward player with physics arc
        scene.lootPop.popLoot({
          spriteKey: `block_mineral_${mineResult.content?.mineralType ?? 'dust'}`,
          worldX: targetX * TILE_SIZE + TILE_SIZE * 0.5,
          worldY: targetY * TILE_SIZE + TILE_SIZE * 0.5,
          targetX: scene.player.gridX * TILE_SIZE + TILE_SIZE * 0.5,
          targetY: scene.player.gridY * TILE_SIZE + TILE_SIZE * 0.5,
        })
        // mineral_magnet: auto-collect minerals within radius
        applyMineralMagnet(scene, targetX, targetY)
        break
      }
      case BlockType.ArtifactNode: {
        // Phase 31.3: Remove shimmer when ArtifactNode is broken
        scene.blockShimmer?.unregisterNode(targetX, targetY)
        const artifactSlot: InventorySlot = {
          type: 'artifact',
          artifactRarity: mineResult.content?.artifactRarity,
          factId: mineResult.content?.factId,
        }
        // double_artifact_chance synergy (Scholar's Blessing): 2x the rarity-boost quiz trigger chance
        const artifactSynergyEffects = scene.getActiveSynergyEffects()
        const doubleArtifactChance = artifactSynergyEffects.some(e => e.type === 'double_artifact_chance')
        const effectiveArtifactQuizChance = doubleArtifactChance
          ? Math.min(1, BALANCE.ARTIFACT_QUIZ_CHANCE * 2)
          : BALANCE.ARTIFACT_QUIZ_CHANCE
        if (Math.random() < effectiveArtifactQuizChance && scene.facts.length > 0) {
          // Artifact triggers a multi-question appraisal quiz — store the slot pending quiz result
          scene.pendingArtifactSlot = artifactSlot
          scene.pendingArtifactQuestions = BALANCE.ARTIFACT_QUIZ_QUESTIONS
          scene.pendingArtifactBoosts = 0
          scene.isPaused = true
          const factId = scene.facts[Math.floor(Math.random() * scene.facts.length)]
          scene.game.events.emit('artifact-quiz', {
            factId,
            artifactRarity: mineResult.content?.artifactRarity,
            questionsRemaining: BALANCE.ARTIFACT_QUIZ_QUESTIONS,
            questionsTotal: BALANCE.ARTIFACT_QUIZ_QUESTIONS,
          })
        } else {
          // Phase 31.2: trigger camera zoom + GAIA commentary before collecting
          const revealRarity = (mineResult.content?.artifactRarity ?? 'common') as import('../../data/types').Rarity
          scene.triggerArtifactRevealSequence(
            artifactSlot,
            targetX * TILE_SIZE + TILE_SIZE * 0.5,
            targetY * TILE_SIZE + TILE_SIZE * 0.5,
            revealRarity,
            targetX,
            targetY,
          )
        }
        break
      }
      case BlockType.OxygenCache: {
        const oxygenAmount = mineResult.content?.oxygenAmount ?? BALANCE.OXYGEN_CACHE_RESTORE
        if (Math.random() < BALANCE.OXYGEN_CACHE_QUIZ_CHANCE && scene.facts.length > 0) {
          // Store the pending oxygen amount so we can grant it after quiz
          scene.pendingOxygenReward = oxygenAmount
          scene.isPaused = true
          // Pick a random fact ID for the quiz
          const factId = scene.facts[Math.floor(Math.random() * scene.facts.length)]
          scene.game.events.emit('oxygen-quiz', { factId, oxygenAmount })
        } else {
          scene.oxygenState = addOxygen(scene.oxygenState, oxygenAmount)
          scene.game.events.emit('oxygen-restored', {
            amount: oxygenAmount,
            state: scene.oxygenState,
          })
          audioManager.playSound('collect')
        }
        break
      }
      case BlockType.UpgradeCrate: {
        const upgrade = rollUpgrade(scene)
        applyUpgrade(scene, upgrade)
        scene.game.events.emit('upgrade-found', { upgrade })
        audioManager.playSound('collect')
        break
      }
      case BlockType.OxygenTank: {
        // Permanent progression reward — emits event for GameManager to handle save update.
        scene.game.events.emit('oxygen-tank-found')
        audioManager.playSound('collect')
        break
      }
      case BlockType.DataDisc: {
        // Collectible that unlocks a themed fact pack — emits event for GameManager to handle.
        scene.game.events.emit('data-disc-found')
        audioManager.playSound('collect')
        break
      }
      case BlockType.FossilNode: {
        // Fossil fragment found — GameManager picks species from run RNG and updates save.
        scene.game.events.emit('fossil-found', { x: targetX, y: targetY })
        audioManager.playSound('collect')
        break
      }
      case BlockType.LavaBlock: {
        // Lava costs extra oxygen when broken through
        // hazard_immunity synergy (Deep Diver): skip all O2 cost for hazards
        const lavaHazardImmune = scene.getActiveSynergyEffects().some(e => e.type === 'hazard_immunity')
        if (!lavaHazardImmune) {
          const toughSkinLava = scene.collectedRelics.find(r => r.effect.type === 'tough_skin')
          const relicReduction = (toughSkinLava && toughSkinLava.effect.type === 'tough_skin') ? toughSkinLava.effect.reduction : 0
          const companionReduction = scene.companionEffect?.type === 'hazard_resist' ? scene.companionEffect.value : 0
          const lavaCost = Math.max(1, BALANCE.LAVA_OXYGEN_COST - relicReduction - companionReduction)
          const lavaResult = consumeOxygen(scene.oxygenState, lavaCost)
          scene.oxygenState = lavaResult.state
          if (lavaResult.depleted) {
            scene.game.events.emit('oxygen-changed', scene.oxygenState)
            scene.game.events.emit('oxygen-depleted')
            scene.redrawAll()
            return
          }
        }
        break
      }
      case BlockType.GasPocket: {
        // Gas pocket drains oxygen when the player steps into it
        // hazard_immunity synergy (Deep Diver): skip all O2 cost for hazards
        const gasHazardImmune = scene.getActiveSynergyEffects().some(e => e.type === 'hazard_immunity')
        if (!gasHazardImmune) {
          const toughSkinGas = scene.collectedRelics.find(r => r.effect.type === 'tough_skin')
          const relicReductionGas = (toughSkinGas && toughSkinGas.effect.type === 'tough_skin') ? toughSkinGas.effect.reduction : 0
          const companionReductionGas = scene.companionEffect?.type === 'hazard_resist' ? scene.companionEffect.value : 0
          const gasCost = Math.max(1, BALANCE.GAS_POCKET_OXYGEN_DRAIN - relicReductionGas - companionReductionGas)
          const gasResult = consumeOxygen(scene.oxygenState, gasCost)
          scene.oxygenState = gasResult.state
          if (gasResult.depleted) {
            scene.game.events.emit('oxygen-changed', scene.oxygenState)
            scene.game.events.emit('oxygen-depleted')
            scene.redrawAll()
            return
          }
        }
        break
      }
      case BlockType.RelicShrine: {
        // Relic shrine: pick a random relic not already owned this run.
        const relic = pickRandomRelic(scene.collectedRelics.map(r => r.id), scene.rng)
        if (relic) {
          scene.collectedRelics.push(relic)
          // Apply immediate effects
          if (relic.effect.type === 'deep_breath') {
            scene.oxygenState = {
              ...scene.oxygenState,
              max: scene.oxygenState.max + relic.effect.bonus,
              current: Math.min(scene.oxygenState.current + relic.effect.bonus, scene.oxygenState.max + relic.effect.bonus),
            }
            scene.game.events.emit('oxygen-changed', scene.oxygenState)
          }
          scene.game.events.emit('relic-found', { relic })
          audioManager.playSound('collect')
          // Phase 29: Update relic glow overlay when a new relic is collected
          if (scene.gearOverlay) {
            // Show glow when any relic is equipped (tier info not on Relic type)
            scene.gearOverlay.setRelicGlow('common')
          }
        }
        break
      }
      case BlockType.DescentShaft: {
        // Phase 36: Boss gate check — block descent at landmark layers until boss is defeated
        const bossTemplateId = BOSS_LAYER_MAP[scene.currentLayer]
        if (bossTemplateId !== undefined) {
          const save = get(playerSave)
          const defeatedThisRun: string[] = save?.defeatedBossesThisRun ?? []
          if (!defeatedThisRun.includes(bossTemplateId)) {
            const boss = createBoss(bossTemplateId, scene.currentLayer + 1)
            if (boss) {
              scene.game.events.emit('boss-encounter', boss)
              return  // Halt descent until boss is defeated
            }
          }
        }
        // Phase 36: The Deep unlock check at layer index 19
        if (scene.currentLayer === 19 && encounterManager.isTheDeepUnlocked()) {
          scene.game.events.emit('the-deep-unlocked')
          return
        }
        // Phase 29: Start fall animation before descent
        scene.animController?.startFall()
        // Phase 31.5: Animate descent before showing the layer entrance quiz.
        scene.isPaused = true
        scene.triggerDescentAnimation(() => {
          // After animation completes, emit the layer-entrance-quiz event.
          scene.game.events.emit('layer-entrance-quiz', { layer: scene.currentLayer })
        })
        // Don't destroy or move — GameManager will handle the quiz then call resumeFromLayerQuiz().
        return
      }
      case BlockType.QuoteStone: {
        // Quote stone mined — open the QuoteStone modal with full quote + GAIA reaction
        const quoteStoneId = targetCell.content?.factId
        const entry = quoteStoneId
          ? QUOTE_STONES.find(q => q.id === quoteStoneId)
          : QUOTE_STONES[Math.floor(scene.rng() * QUOTE_STONES.length)]
        if (entry) {
          quoteStoneModalEntry.set(entry)
          currentScreen.set('quote_stone' as any)
        }
        break
      }
      case BlockType.UnstableGround: {
        // Cave-in: collapse nearby terrain when this block is broken.
        const caveInRadius = BALANCE.CAVE_IN_RADIUS
        const playerPosKey = `${scene.player.gridX},${scene.player.gridY}`
        const specialTypes = new Set<BlockType>([
          BlockType.MineralNode,
          BlockType.ArtifactNode,
          BlockType.OxygenCache,
          BlockType.UpgradeCrate,
          BlockType.QuizGate,
          BlockType.ExitLadder,
          BlockType.DescentShaft,
          BlockType.RelicShrine,
          BlockType.QuoteStone,
          BlockType.LavaBlock,
          BlockType.GasPocket,
          BlockType.UnstableGround,
          BlockType.OxygenTank,
          BlockType.FossilNode,
          BlockType.Chest,
          BlockType.Tablet,
          BlockType.Unbreakable,
          BlockType.WallText,
        ])
        const terrainTypes = new Set<BlockType>([
          BlockType.Dirt,
          BlockType.SoftRock,
          BlockType.Stone,
          BlockType.HardRock,
        ])
        let affectedCount = 0
        for (let dy = -caveInRadius; dy <= caveInRadius; dy++) {
          for (let dx = -caveInRadius; dx <= caveInRadius; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = targetX + dx
            const ny = targetY + dy
            if (nx < 0 || ny < 0 || ny >= scene.gridHeight || nx >= scene.gridWidth) continue
            // Never affect the player's current position
            if (`${nx},${ny}` === playerPosKey) continue
            const nCell = scene.grid[ny][nx]
            // Only affect revealed cells (don't reshape unexplored territory)
            if (!nCell.revealed) continue
            // Skip special/protected block types
            if (specialTypes.has(nCell.type)) continue
            // Roll for collapse
            if (Math.random() < BALANCE.CAVE_IN_COLLAPSE_CHANCE) {
              if (nCell.type === BlockType.Empty) {
                // Empty space: rubble falls in
                scene.grid[ny][nx] = { type: BlockType.Dirt, hardness: 1, maxHardness: 1, revealed: true }
                affectedCount++
              } else if (terrainTypes.has(nCell.type)) {
                // Terrain crumbles away
                scene.grid[ny][nx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
                affectedCount++
              }
            }
          }
        }
        // Update fog of war from player position after cave-in reshapes terrain
        revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
        if (scene.activeUpgrades.has('scanner_boost')) {
          revealSpecialBlocks(scene)
        }
        // Emit event so GameManager can show a GAIA quip
        scene.game.events.emit('cave-in', { affectedCount })
        // Phase 35.4: Cave-in contributes to instability
        scene.instabilitySystem?.addInstability('cave_in')
        // Screen shake: jitter camera for ~300ms then re-center on player
        const shakeCamera = (): void => {
          const offsetX = (Math.random() - 0.5) * 6
          const offsetY = (Math.random() - 0.5) * 6
          scene.cameras.main.setScroll(
            scene.cameras.main.scrollX + offsetX,
            scene.cameras.main.scrollY + offsetY,
          )
        }
        shakeCamera()
        setTimeout(() => { shakeCamera() }, 80)
        setTimeout(() => { shakeCamera() }, 160)
        setTimeout(() => { shakeCamera() }, 240)
        setTimeout(() => {
          const centerX = scene.player.gridX * TILE_SIZE + TILE_SIZE / 2
          const centerY = scene.player.gridY * TILE_SIZE + TILE_SIZE / 2
          scene.cameras.main.centerOn(centerX, centerY)
        }, 320)
        break
      }
      case BlockType.SendUpStation: {
        // Send-up station reached — emit event and pause; don't destroy the block.
        // GameManager will show the SendUpOverlay; resumeFromSendUp() will unpause.
        scene.isPaused = true
        scene.game.events.emit('send-up-station', {
          inventory: scene.inventory.map(s => ({ ...s })),
        })
        // Early return: do NOT move the player or proceed with normal mine logic.
        return
      }
      case BlockType.Chest: {
        // Treasure chest opened — award bonus minerals based on current layer. (DD-V2-055)
        scene.game.events.emit('chest-opened', { layer: scene.currentLayer })
        audioManager.playSound('collect')
        break
      }
      case BlockType.Tablet: {
        // Stone tablet found — trigger a discovery quiz. (DD-V2-055)
        scene.isPaused = true
        scene.game.events.emit('random-quiz')
        break
      }
      case BlockType.RecipeFragmentNode: {
        // Phase 35.5: Recipe fragment node — collect and notify GameManager
        const fragId = targetCell.fragmentId
        if (fragId) {
          scene.game.events.emit('fragment-collected', { fragmentId: fragId })
        }
        audioManager.playSound('collect')
        break
      }
      default:
        break
    }

    // ---- Phase 35.4: Instability triggers based on what was mined ----
    if (scene.instabilitySystem) {
      // Lava adjacent trigger: was this block next to any lava?
      let adjacentToLava = false
      for (const [adx, ady] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const anx = targetX + adx, any = targetY + ady
        if (any >= 0 && any < scene.gridHeight && anx >= 0 && anx < scene.gridWidth) {
          if (scene.grid[any][anx]?.type === BlockType.LavaBlock) {
            adjacentToLava = true
            break
          }
        }
      }
      if (adjacentToLava) {
        scene.instabilitySystem.addInstability('lava_adjacent')
      }
      // UnstableGround trigger
      if (blockType === BlockType.UnstableGround) {
        scene.instabilitySystem.addInstability('unstable_broke')
      }
      // HardRock in extreme layer tier (layer index 15+ = layers 16-20)
      if (blockType === BlockType.HardRock && scene.currentLayer >= 15) {
        scene.instabilitySystem.addInstability('hard_rock_deep')
      }
    }

    // Check adjacent cells for lava blocks — if a lava block is now exposed, spawn a flow. (Phase 8.3)
    if (scene.hazardSystem) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const nx = targetX + dx, ny = targetY + dy
        if (ny >= 0 && ny < scene.gridHeight && nx >= 0 && nx < scene.gridWidth) {
          if (scene.grid[ny][nx]?.type === BlockType.LavaBlock) {
            scene.hazardSystem.spawnLava(nx, ny)
          }
        }
      }
    }

    // Spawn a gas cloud when a GasPocket block is broken. (Phase 8.3)
    if (blockType === BlockType.GasPocket && scene.hazardSystem) {
      scene.hazardSystem.spawnGas(targetX, targetY)
    }

    const moved = scene.player.moveToEmpty(targetX, targetY, scene.grid)
    if (moved) {
      revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
      if (scene.activeUpgrades.has('scanner_boost')) {
        revealSpecialBlocks(scene)
      }
      scene.game.events.emit('depth-changed', scene.player.gridY)
      checkPointOfNoReturn(scene)
    }
  }

  revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
  if (scene.activeUpgrades.has('scanner_boost')) {
    revealSpecialBlocks(scene)
  }
  scene.game.events.emit('oxygen-changed', scene.oxygenState)
  if (scene.oxygenState.current / scene.oxygenState.max < 0.2 && !scene.oxygenWarningPlayed) {
    scene.oxygenWarningPlayed = true
    audioManager.playSound('oxygen_warning')
  }
  scene.game.events.emit('depth-changed', scene.player.gridY)
  checkPointOfNoReturn(scene)
  scene.redrawAll()
}

/**
 * Point-of-no-return check removed (Phase 8.2 — PONR mechanic retired).
 * Stub retained to avoid touching call sites; becomes a no-op.
 */
export function checkPointOfNoReturn(_scene: MineScene): void {
  // no-op: PONR mechanic removed in Phase 8.2
}

/**
 * Adds an item to inventory with auto-stacking for minerals.
 * Minerals stack up to their max stack size before using a new slot.
 * Returns true if at least some of the item was added.
 */
export function addToInventory(scene: MineScene, slot: InventorySlot): boolean {
  // Non-minerals go to first empty slot (no stacking)
  if (slot.type !== 'mineral' || !slot.mineralTier) {
    const emptyIndex = scene.inventory.findIndex((s) => s.type === 'empty')
    if (emptyIndex === -1) return false
    scene.inventory[emptyIndex] = slot
    return true
  }

  const tier = slot.mineralTier
  const maxStack = getMaxStackSize(tier)
  let remaining = slot.mineralAmount ?? 1

  // First: try to add to existing stacks of the same mineral tier
  for (let i = 0; i < scene.inventory.length && remaining > 0; i++) {
    const existing = scene.inventory[i]
    if (existing.type === 'mineral' && existing.mineralTier === tier) {
      const currentAmount = existing.mineralAmount ?? 0
      const space = maxStack - currentAmount
      if (space > 0) {
        const toAdd = Math.min(remaining, space)
        scene.inventory[i] = {
          ...existing,
          mineralAmount: currentAmount + toAdd,
        }
        remaining -= toAdd
      }
    }
  }

  // Second: overflow into empty slots as new stacks
  while (remaining > 0) {
    const emptyIndex = scene.inventory.findIndex((s) => s.type === 'empty')
    if (emptyIndex === -1) break  // Inventory full

    const toAdd = Math.min(remaining, maxStack)
    scene.inventory[emptyIndex] = {
      type: 'mineral',
      mineralTier: tier,
      mineralAmount: toAdd,
    }
    remaining -= toAdd
  }

  // Return true if we managed to store at least some
  return remaining < (slot.mineralAmount ?? 1)
}

/**
 * Gets the max stack size for a mineral tier.
 */
export function getMaxStackSize(tier: MineralTier): number {
  switch (tier) {
    case 'dust': return BALANCE.DUST_STACK_SIZE
    case 'shard': return BALANCE.SHARD_STACK_SIZE
    case 'crystal': return BALANCE.CRYSTAL_STACK_SIZE
    case 'geode': return BALANCE.GEODE_STACK_SIZE
    case 'essence': return BALANCE.ESSENCE_STACK_SIZE
    default: return 1
  }
}

/**
 * Triggers the Decision Screen ("The Cloth") when backpack is full and a new item is found.
 * Pauses mining input and shows the overlay. (Phase 51)
 */
function triggerDecisionScreen(scene: MineScene, newItemSlot: InventorySlot): void {
  const inv = scene.inventory

  const newItem: BackpackItemState = {
    slotIndex: -1,
    type: newItemSlot.type,
    displayName: newItemSlot.type === 'mineral'
      ? (newItemSlot.mineralTier ? newItemSlot.mineralTier.charAt(0).toUpperCase() + newItemSlot.mineralTier.slice(1) : 'Mineral')
      : newItemSlot.type === 'artifact'
        ? `${newItemSlot.artifactRarity ? newItemSlot.artifactRarity.charAt(0).toUpperCase() + newItemSlot.artifactRarity.slice(1) : 'Common'} Artifact`
        : 'Fossil',
    rarity: newItemSlot.artifactRarity,
    mineralTier: newItemSlot.mineralTier,
    stackCurrent: newItemSlot.mineralAmount,
  }

  const existingItems: BackpackItemState[] = inv
    .map((slot, i) => ({
      slotIndex: i,
      type: slot.type,
      displayName: slot.type === 'mineral'
        ? (slot.mineralTier ? slot.mineralTier.charAt(0).toUpperCase() + slot.mineralTier.slice(1) : 'Mineral')
        : slot.type === 'artifact'
          ? `${slot.artifactRarity ? slot.artifactRarity.charAt(0).toUpperCase() + slot.artifactRarity.slice(1) : 'Common'} Artifact`
          : slot.type === 'fossil' ? 'Fossil' : '',
      rarity: slot.artifactRarity,
      mineralTier: slot.mineralTier,
      stackCurrent: slot.mineralAmount,
    }))
    .filter(item => item.type !== 'empty')

  // Pause input
  scene.isPaused = true

  // Activate decision screen
  decisionScreenState.set({
    active: true,
    newItem,
    existingItems,
    selectedEvictIndex: null,
  })
  currentScreen.set('decision')

  // Listen for decision confirmation
  const handleDecision = (e: Event) => {
    window.removeEventListener('decision-confirmed', handleDecision)
    const detail = (e as CustomEvent).detail as { action: 'take' | 'leave'; evictIndex?: number }

    if (detail.action === 'take' && detail.evictIndex !== undefined) {
      // Swap: put new item in the evicted slot
      const evictedItem = existingItems[detail.evictIndex]
      if (evictedItem) {
        scene.inventory[evictedItem.slotIndex] = newItemSlot
      }
    }
    // If 'leave', new item is discarded (nothing to do)

    // Resume input and return to mining
    scene.isPaused = false
    currentScreen.set('mining')

    // Sync inventory to store
    inventory.set([...scene.inventory])
  }
  window.addEventListener('decision-confirmed', handleDecision)
}

/**
 * Auto-collects MineralNode blocks within mineral_magnet relic radius around (originX, originY).
 * The companion magnet_range effect adds extra tiles to the base relic radius.
 * Called after manually mining a MineralNode.
 */
export function applyMineralMagnet(scene: MineScene, originX: number, originY: number): void {
  const magnetRelic = scene.collectedRelics.find(r => r.effect.type === 'mineral_magnet')
  // magnet_range companion: also activate even without the relic (using companion value as base radius)
  const companionRange = scene.companionEffect?.type === 'magnet_range' ? scene.companionEffect.value : 0
  if (!magnetRelic && companionRange === 0) return
  const relicRadius = (magnetRelic && magnetRelic.effect.type === 'mineral_magnet') ? magnetRelic.effect.radius : 0
  const radius = relicRadius + companionRange
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = originX + dx
      const ny = originY + dy
      if (nx < 0 || ny < 0 || nx >= scene.gridWidth || ny >= scene.gridHeight) continue
      const cell = scene.grid[ny][nx]
      if (cell.type === BlockType.MineralNode) {
        // Collect the mineral node without mining cost
        const slot: InventorySlot = {
          type: 'mineral',
          mineralTier: cell.content?.mineralType,
          mineralAmount: cell.content?.mineralAmount,
        }
        const added = addToInventory(scene, slot)
        // Clear the block
        scene.grid[ny][nx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
        scene.blocksMinedThisRun += 1
        scene.spawnBreakParticles(nx * TILE_SIZE, ny * TILE_SIZE, BlockType.MineralNode)
        scene.game.events.emit('mineral-collected', { ...cell.content, addedToInventory: added })
      }
    }
  }
  scene.game.events.emit('blocks-mined-update', scene.blocksMinedThisRun)
}

/**
 * Roll a random upgrade from the full options pool using weighted random selection.
 * Bomb has a lower weight than the other upgrades to keep it feeling special.
 */
export function rollUpgrade(scene: MineScene): RunUpgrade {
  let weightedOptions: { upgrade: RunUpgrade; weight: number }[] = [
    { upgrade: 'pickaxe_boost', weight: 25 },
    { upgrade: 'scanner_boost', weight: 25 },
    { upgrade: 'backpack_expand', weight: 25 },
    { upgrade: 'oxygen_efficiency', weight: 25 },
    { upgrade: 'bomb', weight: BALANCE.BOMB_DROP_WEIGHT },
  ]
  // Exclude backpack_expand when the temporary expansion cap has been reached.
  if (scene.backpackExpansionCount >= BALANCE.BACKPACK_MAX_TEMP_EXPANSIONS) {
    weightedOptions = weightedOptions.filter(o => o.upgrade !== 'backpack_expand')
  }
  const totalWeight = weightedOptions.reduce((sum, o) => sum + o.weight, 0)
  let roll = Math.random() * totalWeight
  for (const option of weightedOptions) {
    roll -= option.weight
    if (roll <= 0) return option.upgrade
  }
  return weightedOptions[0].upgrade
}

/**
 * Apply an upgrade for the current run, recording it in activeUpgrades.
 */
export function applyUpgrade(scene: MineScene, upgrade: RunUpgrade): void {
  const currentCount = scene.activeUpgrades.get(upgrade) ?? 0
  switch (upgrade) {
    case 'bomb': {
      const newCount = Math.min(currentCount + 1, BALANCE.BOMB_MAX_STACK)
      scene.activeUpgrades.set(upgrade, newCount)
      break
    }
    case 'pickaxe_boost': {
      // Advance tier index up to the maximum tier
      const maxTier = BALANCE.PICKAXE_TIERS.length - 1
      scene.pickaxeTierIndex = Math.min(scene.pickaxeTierIndex + 1, maxTier)
      // Keep count in activeUpgrades for display purposes
      scene.activeUpgrades.set(upgrade, scene.pickaxeTierIndex)
      const tier = BALANCE.PICKAXE_TIERS[scene.pickaxeTierIndex]
      // Phase 29: Update gear overlay when pickaxe tier changes
      scene.gearOverlay?.setPickaxeTier(scene.pickaxeTierIndex)
      scene.game.events.emit('pickaxe-upgraded', {
        tierIndex: scene.pickaxeTierIndex,
        tierName: tier.name,
      })
      break
    }
    case 'backpack_expand': {
      if (scene.backpackExpansionCount < BALANCE.BACKPACK_MAX_TEMP_EXPANSIONS) {
        const bonus = BALANCE.BACKPACK_EXPANSION_SIZES[scene.backpackExpansionCount]
        scene.backpackExpansionCount++
        for (let i = 0; i < bonus; i++) {
          scene.inventory.push({ type: 'empty' as const })
        }
        scene.inventorySlots += bonus
        scene.activeUpgrades.set(upgrade, currentCount + 1)
        scene.game.events.emit('backpack-expanded', {
          slotsAdded: bonus,
          totalSlots: scene.inventory.length,
          expansionCount: scene.backpackExpansionCount,
        })
      }
      // If at max expansions, the caller should have re-rolled; applyUpgrade is a no-op here.
      break
    }
    case 'scanner_boost': {
      scene.activeUpgrades.set(upgrade, currentCount + 1)
      // Advance scanner tier (capped at max tier index)
      const maxTierIndex = BALANCE.SCANNER_TIERS.length - 1
      scene.scannerTierIndex = Math.min(scene.scannerTierIndex + 1, maxTierIndex)
      const tierName = BALANCE.SCANNER_TIERS[scene.scannerTierIndex].name
      scene.game.events.emit('scanner-upgraded', { tierIndex: scene.scannerTierIndex, tierName })
      revealSpecialBlocks(scene)
      break
    }
    default:
      scene.activeUpgrades.set(upgrade, currentCount + 1)
      break
  }
}

/**
 * Reveal special blocks within scanner range around the player.
 * Range is determined by the current scanner tier's revealRadius.
 */
export function revealSpecialBlocks(scene: MineScene): void {
  const scanRadius = BALANCE.SCANNER_TIERS[scene.scannerTierIndex].revealRadius
  const px = scene.player.gridX
  const py = scene.player.gridY
  for (let dy = -scanRadius; dy <= scanRadius; dy++) {
    for (let dx = -scanRadius; dx <= scanRadius; dx++) {
      const x = px + dx
      const y = py + dy
      if (x < 0 || y < 0 || x >= scene.gridWidth || y >= scene.gridHeight) continue
      if (Math.abs(dx) + Math.abs(dy) > scanRadius) continue
      const cell = scene.grid[y][x]
      if (
        cell.type === BlockType.MineralNode ||
        cell.type === BlockType.ArtifactNode ||
        cell.type === BlockType.OxygenCache ||
        cell.type === BlockType.UpgradeCrate ||
        cell.type === BlockType.ExitLadder ||
        cell.type === BlockType.DescentShaft
      ) {
        cell.revealed = true
      }
    }
  }
}

/**
 * Triggers a random earthquake event that reshapes a portion of the mine.
 */
export function triggerEarthquake(scene: MineScene): void {
  scene.blocksSinceLastQuake = 0

  const playerPosKey = `${scene.player.gridX},${scene.player.gridY}`

  // Block types that are safe to collapse (plain terrain only)
  const terrainTypes = new Set<BlockType>([
    BlockType.Dirt,
    BlockType.SoftRock,
    BlockType.Stone,
    BlockType.HardRock,
  ])

  // Block types that must never be altered by an earthquake
  const protectedTypes = new Set<BlockType>([
    BlockType.Unbreakable,
    BlockType.MineralNode,
    BlockType.ArtifactNode,
    BlockType.OxygenCache,
    BlockType.QuizGate,
    BlockType.UpgradeCrate,
    BlockType.ExitLadder,
    BlockType.DescentShaft,
    BlockType.RelicShrine,
    BlockType.QuoteStone,
    BlockType.LavaBlock,
    BlockType.GasPocket,
    BlockType.UnstableGround,
    BlockType.SendUpStation,
    BlockType.WallText,
  ])

  // === Phase 1: Screen shake (stronger than cave-in) ===
  const shakeStep = (): void => {
    const offsetX = (Math.random() - 0.5) * 12
    const offsetY = (Math.random() - 0.5) * 12
    scene.cameras.main.setScroll(
      scene.cameras.main.scrollX + offsetX,
      scene.cameras.main.scrollY + offsetY,
    )
  }
  shakeStep()
  setTimeout(() => { shakeStep() }, 100)
  setTimeout(() => { shakeStep() }, 200)
  setTimeout(() => { shakeStep() }, 320)
  setTimeout(() => { shakeStep() }, 440)
  // Re-center after shake
  setTimeout(() => {
    const centerX = scene.player.gridX * TILE_SIZE + TILE_SIZE / 2
    const centerY = scene.player.gridY * TILE_SIZE + TILE_SIZE / 2
    scene.cameras.main.centerOn(centerX, centerY)
  }, 600)

  // === Phase 2: Collapse — destroy revealed terrain blocks to create new passages ===
  const terrainCandidates: { x: number; y: number }[] = []
  for (let row = 0; row < scene.gridHeight; row++) {
    for (let col = 0; col < scene.gridWidth; col++) {
      if (`${col},${row}` === playerPosKey) continue
      const cell = scene.grid[row][col]
      if (!cell.revealed) continue
      if (!terrainTypes.has(cell.type)) continue
      terrainCandidates.push({ x: col, y: row })
    }
  }

  // Shuffle and take up to EARTHQUAKE_COLLAPSE_COUNT
  for (let i = terrainCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [terrainCandidates[i], terrainCandidates[j]] = [terrainCandidates[j], terrainCandidates[i]]
  }

  const collapseTargets = terrainCandidates.slice(0, BALANCE.EARTHQUAKE_COLLAPSE_COUNT)
  const collapsedPositions: { x: number; y: number }[] = []

  for (const pos of collapseTargets) {
    scene.grid[pos.y][pos.x] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
    collapsedPositions.push(pos)
    scene.spawnBreakParticles(pos.x * TILE_SIZE, pos.y * TILE_SIZE, BlockType.Dirt)
  }

  // === Phase 3: Rubble — fill some Empty cells near collapsed blocks with Dirt ===
  const rubbleCandidates = new Set<string>()
  for (const pos of collapsedPositions) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = pos.x + dx
      const ny = pos.y + dy
      if (nx < 0 || ny < 0 || nx >= scene.gridWidth || ny >= scene.gridHeight) continue
      if (`${nx},${ny}` === playerPosKey) continue
      const nCell = scene.grid[ny][nx]
      if (nCell.type !== BlockType.Empty) continue
      if (!nCell.revealed) continue
      // 50% chance to become rubble
      if (Math.random() < 0.5) {
        rubbleCandidates.add(`${nx},${ny}`)
      }
    }
  }

  for (const key of rubbleCandidates) {
    const [rx, ry] = key.split(',').map(Number)
    if (`${rx},${ry}` === playerPosKey) continue
    scene.grid[ry][rx] = { type: BlockType.Dirt, hardness: 1, maxHardness: 1, revealed: true }
  }

  // === Phase 4: Reveal — crack open fog near revealed space ===
  const revealCandidates: { x: number; y: number }[] = []
  for (let row = 0; row < scene.gridHeight; row++) {
    for (let col = 0; col < scene.gridWidth; col++) {
      const cell = scene.grid[row][col]
      if (cell.revealed || cell.visibilityLevel !== undefined) continue
      if (protectedTypes.has(cell.type)) continue
      // Check if any orthogonal neighbour is revealed
      let hasRevealedNeighbour = false
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = col + dx
        const ny = row + dy
        if (nx < 0 || ny < 0 || nx >= scene.gridWidth || ny >= scene.gridHeight) continue
        if (scene.grid[ny][nx].revealed) {
          hasRevealedNeighbour = true
          break
        }
      }
      if (hasRevealedNeighbour) {
        revealCandidates.push({ x: col, y: row })
      }
    }
  }

  // Shuffle and take up to EARTHQUAKE_REVEAL_COUNT
  for (let i = revealCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [revealCandidates[i], revealCandidates[j]] = [revealCandidates[j], revealCandidates[i]]
  }

  const revealTargets = revealCandidates.slice(0, BALANCE.EARTHQUAKE_REVEAL_COUNT)
  for (const pos of revealTargets) {
    scene.grid[pos.y][pos.x].visibilityLevel = 1
  }

  // === Update fog of war from player position after all grid changes ===
  revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
  if (scene.activeUpgrades.has('scanner_boost')) {
    revealSpecialBlocks(scene)
  }

  // Emit event for GameManager to display a GAIA quip
  scene.game.events.emit('earthquake', {
    collapsed: collapsedPositions.length,
    revealed: revealTargets.length,
  })

  scene.redrawAll()
}

/**
 * Detonates a bomb centered on the player, clearing a 3x3 area of blocks.
 */
export function useBomb(scene: MineScene): void {
  const bombCount = scene.activeUpgrades.get('bomb') ?? 0
  if (bombCount <= 0) return

  // Deduct one bomb
  scene.activeUpgrades.set('bomb', bombCount - 1)

  // Deduct oxygen cost
  const oxygenResult = consumeOxygen(scene.oxygenState, BALANCE.BOMB_OXYGEN_COST)
  scene.oxygenState = oxygenResult.state
  scene.game.events.emit('oxygen-changed', scene.oxygenState)

  const cx = scene.player.gridX
  const cy = scene.player.gridY
  const radius = BALANCE.BOMB_RADIUS

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= scene.gridWidth || y >= scene.gridHeight) continue

      const cell = scene.grid[y][x]

      // Skip the player's own cell (already empty), unbreakable, wall text, exit ladder, and quiz gates
      if (
        cell.type === BlockType.Empty ||
        cell.type === BlockType.Unbreakable ||
        cell.type === BlockType.WallText ||
        cell.type === BlockType.ExitLadder ||
        cell.type === BlockType.QuizGate
      ) continue

      const blockType = cell.type
      const content = cell.content

      // Destroy the block instantly
      scene.spawnBreakParticles(x * TILE_SIZE, y * TILE_SIZE, blockType)
      scene.grid[y][x] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
      scene.blocksMinedThisRun += 1

      // Flash the destroyed tile with yellow tint
      scene.flashTiles.set(`${x},${y}`, scene.time.now)

      // Handle special block content (no hazard effects for lava/gas)
      switch (blockType) {
        case BlockType.MineralNode: {
          const mineralSlot: InventorySlot = {
            type: 'mineral',
            mineralTier: content?.mineralType,
            mineralAmount: content?.mineralAmount,
          }
          const added = addToInventory(scene, mineralSlot)
          if (!added) {
            triggerDecisionScreen(scene, mineralSlot)
          }
          scene.game.events.emit('mineral-collected', { ...content, addedToInventory: added })
          break
        }
        case BlockType.ArtifactNode: {
          const artifactSlot: InventorySlot = {
            type: 'artifact',
            artifactRarity: content?.artifactRarity,
            factId: content?.factId,
          }
          const added = addToInventory(scene, artifactSlot)
          if (!added) {
            triggerDecisionScreen(scene, artifactSlot)
          }
          if (content?.factId) {
            scene.artifactsFound.push(content.factId)
          }
          scene.game.events.emit('artifact-found', {
            factId: content?.factId,
            rarity: content?.artifactRarity,
            addedToInventory: added,
          })
          break
        }
        case BlockType.OxygenCache: {
          const oxygenAmount = content?.oxygenAmount ?? BALANCE.OXYGEN_CACHE_RESTORE
          scene.oxygenState = addOxygen(scene.oxygenState, oxygenAmount)
          scene.game.events.emit('oxygen-restored', { amount: oxygenAmount, state: scene.oxygenState })
          scene.game.events.emit('oxygen-changed', scene.oxygenState)
          break
        }
        case BlockType.UpgradeCrate: {
          const upgrade = rollUpgrade(scene)
          applyUpgrade(scene, upgrade)
          scene.game.events.emit('upgrade-found', { upgrade })
          break
        }
        default:
          // LavaBlock and GasPocket are destroyed without hazard effects
          break
      }
    }
  }

  scene.game.events.emit('blocks-mined-update', scene.blocksMinedThisRun)
  audioManager.playSound('mine_break')

  // Update fog of war after blast
  revealAround(scene.grid, cx, cy, BALANCE.FOG_REVEAL_RADIUS)
  if (scene.activeUpgrades.has('scanner_boost')) {
    revealSpecialBlocks(scene)
  }

  // Update the bomb count in the Svelte store
  scene.game.events.emit('bomb-used', { remaining: scene.activeUpgrades.get('bomb') ?? 0 })

  if (oxygenResult.depleted) {
    scene.game.events.emit('oxygen-depleted')
  }

  scene.redrawAll()
}

/**
 * Called by HazardSystem when the player occupies a lava cell. (Phase 8.3)
 */
export function handleLavaContact(scene: MineScene): void {
  scene.animController?.setHurt()    // Phase 29: trigger hurt flash animation
  scene.game.events.emit('hazard-lava-contact')
}

/**
 * Called by HazardSystem when the player occupies a gas cloud cell. (Phase 8.3)
 */
export function handleGasContact(scene: MineScene): void {
  scene.animController?.setHurt()    // Phase 29: trigger hurt flash animation
  scene.game.events.emit('hazard-gas-contact')
}

/**
 * Called by HazardSystem when lava spreads into a new empty cell. (Phase 8.3)
 */
export function markCellAsLava(scene: MineScene, x: number, y: number): void {
  if (scene.grid[y]?.[x]) {
    scene.grid[y][x] = {
      type: BlockType.LavaBlock,
      hardness: 0,
      maxHardness: 0,
      revealed: true,
    }
  }
}

/**
 * Apply a consumable tool effect. (DD-V2-064)
 */
export function applyConsumable(scene: MineScene, id: ConsumableId): void {
  const used = useConsumableFromDive(id)
  if (!used) return

  switch (id) {
    case 'bomb':
      applyBomb(scene)
      break
    case 'flare':
      applyFlare(scene)
      break
    case 'shield_charge':
      shieldActive.set(true)
      scene.game.events.emit('gaia-toast', 'Shield active — next hazard blocked.')
      break
    case 'drill_charge':
      applyDrillCharge(scene)
      break
    case 'sonar_pulse':
      applySonarPulse(scene)
      break
  }
}

/** Bomb: clear 3x3 area around player */
export function applyBomb(scene: MineScene): void {
  const cx = scene.player.gridX
  const cy = scene.player.gridY
  let cleared = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= scene.grid[0].length || ny >= scene.grid.length) continue
      const cell = scene.grid[ny][nx]
      if (cell.type !== BlockType.Empty && cell.type !== BlockType.Unbreakable &&
          cell.type !== BlockType.WallText &&
          cell.type !== BlockType.ExitLadder && cell.type !== BlockType.DescentShaft) {
        scene.grid[ny][nx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
        cleared++
      }
    }
  }
  revealAround(scene.grid, cx, cy, BALANCE.FOG_REVEAL_RADIUS)
  TickSystem.getInstance().advance()
  tickCount.set(TickSystem.getInstance().getTick())
  layerTickCount.set(TickSystem.getInstance().getLayerTick())
  scene.redrawAll()
  scene.game.events.emit('gaia-toast', `Bomb detonated — ${cleared} blocks cleared.`)
}

/** Flare: reveal 7x7 area */
export function applyFlare(scene: MineScene): void {
  const cx = scene.player.gridX
  const cy = scene.player.gridY
  const width = scene.grid[0].length
  const height = scene.grid.length
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
        scene.grid[ny][nx].revealed = true
      }
    }
  }
  TickSystem.getInstance().advance()
  tickCount.set(TickSystem.getInstance().getTick())
  layerTickCount.set(TickSystem.getInstance().getLayerTick())
  scene.redrawAll()
  scene.game.events.emit('gaia-toast', 'Flare deployed — 7×7 area revealed.')
}

/** Drill Charge: mine 5 blocks in facing direction */
export function applyDrillCharge(scene: MineScene): void {
  const dirMap: Record<string, [number, number]> = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  }
  const [ddx, ddy] = dirMap[scene.playerFacing]
  let mined = 0
  let cx = scene.player.gridX
  let cy = scene.player.gridY
  const width = scene.grid[0].length
  const height = scene.grid.length
  while (mined < 5) {
    cx += ddx
    cy += ddy
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) break
    const cell = scene.grid[cy][cx]
    if (cell.type === BlockType.Unbreakable || cell.type === BlockType.WallText) break
    if (cell.type !== BlockType.Empty) {
      scene.grid[cy][cx] = { type: BlockType.Empty, hardness: 0, maxHardness: 0, revealed: true }
      mined++
    }
  }
  revealAround(scene.grid, scene.player.gridX, scene.player.gridY, BALANCE.FOG_REVEAL_RADIUS)
  TickSystem.getInstance().advance()
  tickCount.set(TickSystem.getInstance().getTick())
  layerTickCount.set(TickSystem.getInstance().getLayerTick())
  scene.redrawAll()
  scene.game.events.emit('gaia-toast', `Drill Charge — ${mined} blocks bored through.`)
}

/** Sonar Pulse: highlight minerals within 10 Manhattan distance */
export function applySonarPulse(scene: MineScene): void {
  const cx = scene.player.gridX
  const cy = scene.player.gridY
  const width = scene.grid[0].length
  const height = scene.grid.length
  let revealed = 0
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 10) continue
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const cell = scene.grid[ny][nx]
      if (cell.type === BlockType.MineralNode || cell.type === BlockType.ArtifactNode ||
          cell.type === BlockType.FossilNode) {
        cell.revealed = true
        revealed++
      }
    }
  }
  TickSystem.getInstance().advance()
  tickCount.set(TickSystem.getInstance().getTick())
  layerTickCount.set(TickSystem.getInstance().getLayerTick())
  scene.redrawAll()
  scene.game.events.emit('gaia-toast', `Sonar Pulse — ${revealed} nodes detected.`)
}

/**
 * Called after mine generation to handle landmark-specific entry effects. (DD-V2-055)
 */
export function handleLandmarkEntry(scene: MineScene): void {
  const oneIndexedLayer = scene.currentLayer + 1
  const landmarkId = getLandmarkIdForLayer(oneIndexedLayer)
  if (!landmarkId) return

  switch (landmarkId) {
    case 'gauntlet':
      scene.game.events.emit('gaia-toast', 'GAUNTLET — Multiple active hazards detected. Survive.')
      // Activate all lava and gas cells in the stamped grid
      for (let y = 0; y < scene.grid.length; y++) {
        for (let x = 0; x < scene.grid[0].length; x++) {
          if (scene.grid[y][x].type === BlockType.LavaBlock) {
            scene.hazardSystem?.spawnLava(x, y)
          }
          if (scene.grid[y][x].type === BlockType.GasPocket) {
            scene.hazardSystem?.spawnGas(x, y)
          }
        }
      }
      break
    case 'treasure_vault':
      scene.game.events.emit('gaia-toast', 'Treasure Vault — Elevated mineral density detected. A chest lies within.')
      break
    case 'ancient_archive':
      scene.game.events.emit('gaia-toast', 'Ancient Archive — Stone tablets detected. Approach to learn.')
      break
    case 'completion_event': {
      const event = COMPLETION_EVENTS[Math.floor(Math.random() * COMPLETION_EVENTS.length)]
      scene.game.events.emit('gaia-toast', `DEPTH RECORD — ${event.title}`)
      // Show monologue after a delay
      setTimeout(() => {
        scene.game.events.emit('gaia-toast', event.gaiaMonologue)
      }, 3000)
      break
    }
  }
}

/**
 * Trigger the instability collapse event: fills random cells with HardRock
 * and spawns lava near the center. (Phase 35.4)
 */
export function triggerInstabilityCollapse(scene: MineScene): void {
  const count = BALANCE.INSTABILITY_COLLAPSE_BLOCK_COUNT
  let placed = 0
  const minY = Math.floor(scene.gridHeight * 0.4)
  for (let attempts = 0; attempts < count * 4 && placed < count; attempts++) {
    const rx = Math.floor(Math.random() * scene.gridWidth)
    const ry = Math.floor(minY + Math.random() * (scene.gridHeight - minY))
    const cell = scene.grid[ry]?.[rx]
    if (!cell) continue
    if (cell.type === BlockType.Empty && cell.revealed && !isPlayerAt(scene, rx, ry)) {
      scene.grid[ry][rx] = { type: BlockType.HardRock, hardness: BALANCE.HARDNESS_HARD_ROCK, maxHardness: BALANCE.HARDNESS_HARD_ROCK, revealed: true }
      placed++
    }
  }
  // Spawn lava near grid center
  if (scene.hazardSystem) {
    const cx = Math.floor(scene.gridWidth / 2)
    const cy = Math.floor(scene.gridHeight * 0.6)
    scene.hazardSystem.spawnLava(cx, cy)
  }
  scene.redrawAll()
  gaiaMessage.set("The layer is collapsing! Find the shaft — NOW.")
  scene.game.events.emit('earthquake', { collapsed: placed, revealed: 0 })
}

/** Returns true if the player is at grid cell (x, y). */
export function isPlayerAt(scene: MineScene, x: number, y: number): boolean {
  return scene.player.gridX === x && scene.player.gridY === y
}

/**
 * Force a layer failure (triggered when instability countdown reaches 0).
 * Behaves like oxygen depletion — forced surface with loot loss. (Phase 35.4)
 */
export function forceLayerFail(scene: MineScene): void {
  scene.game.events.emit('oxygen-depleted')
}
