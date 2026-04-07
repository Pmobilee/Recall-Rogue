<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { fly } from 'svelte/transition'
  import { get } from 'svelte/store'

  let phaserContainer: HTMLDivElement
  import {
    currentScreen,
    screenTransitionActive,
    screenTransitionDirection,
    screenTransitionLoading,
    holdScreenTransition,
    releaseScreenTransition,
    activeRewardBundle,
    activeRewardRevealStep,
    combatExitRequested,
    combatExitEnemyId,
  } from './ui/stores/gameState'
  import type { Screen } from './ui/stores/gameState'
  import { navigateToScreen } from './services/screenController'
  import {
    activeCardRewardOptions,
    activeMysteryEvent,
    activeMasteryChallenge,
    activeRoomOptions,
    activeRunEndData,
    activeRunState,
    activeShopCards,
    activeShopInventory,
    activeSpecialEvent,
    activeUpgradeCandidates,
    getCurrentDelvePenalty,
    getDefeatedBossName,
    onArchetypeSelected,
    onCardRewardSelected,
    onCardRewardSkipped,
    onCardRewardReroll,
    onDelve,
    onDomainsSelected,
    onMysteryResolved,
    onMysteryEffectResolved,
    onMasteryChallengeResolved,
    onRestResolved,
    onRetreat,
    onRoomSelected,
    onShopDone,
    onShopSell,
    onShopBuyRelic,
    onShopBuyCard,
    onShopBuyRemoval,
    onSpecialEventResolved,
    openCampfire,
    openUpgradeSelection,
    hasRestUpgradeCandidates,
    onUpgradeSelected,
    onUpgradeSkipped,
    generateStudyQuestions,
    onStudyComplete,
    getMeditateCandidates,
    onMeditateRemove,
    canMeditate,
    onPostMiniBossUpgradeSelected,
    onPostMiniBossUpgradeSkipped,
    resumeFromCampfire,
    returnToHubFromCampfire,
    abandonActiveRun,
    autoSaveRun,
    hasActiveRun,
    loadActiveRun,
    restoreRunMode,
    playAgain,
    returnToMenu,
    startNewRun,
    startDailyExpeditionRun,
    startEndlessDepthsRun,
    startScholarChallengeRun,
    openRelicSanctum,
    closeRelicSanctum,
    activeRelicRewardOptions,
    activeRelicPickup,
    onRelicRewardSelected,
    onMapNodeSelected,
    gameFlowState,
    getPendingSwapRelicId,
    clearPendingSwapRelicId,
    sellEquippedRelic,
    acquirePendingSwapRelic,
    canRerollRelicSelection,
    rerollRelicSelection,
    isRelicPityActive,
    onCombatExitComplete,
    reshuffleChainDistribution,
    confirmChainDistribution,
  } from './services/gameFlowController'
  import {
    activeTurnState,
    hydrateEncounterSnapshot,
    handleEndTurn,
    handlePlayCard,
    handleSkipCard,
    handleUseHint,
    startEncounterForRoom,
    devForceEncounterVictory,
  } from './services/encounterBridge'
  import type { FactDomain } from './data/card-types'
  import type { QuizQuestion } from './services/bossQuizPhase'
  import type { MysteryEffect } from './services/floorManager'
  import { generateCombatRoomOptions } from './services/floorManager'
  import { healPlayer } from './services/runManager'
  import { POST_MINI_BOSS_HEAL_PCT, REST_SITE_HEAL_PCT, SHOP_RELIC_PRICE, RELIC_SELL_REFUND_PCT, RELIC_REROLL_COST } from './data/balance'
  import { RELIC_BY_ID } from './data/relics/index'
  import { getMaxRelicSlots, isRelicSlotsFull } from './services/relicEffectResolver'
  import { isSlowReader, onboardingState, textSize, fontChoice, type FontChoice } from './services/cardPreferences'
  import { unlockCardAudio, playCardAudio } from './services/cardAudioManager'
  import { audioManager } from './services/audioService'
  import { languageService } from './services/languageService'
  import { getDueReviews, playerSave, persistPlayer } from './ui/stores/playerData'
  import { lastRunSummary } from './services/hubState'
  import { factsDB } from './services/factsDB'
  import { initializeCuratedDecks } from './data/curatedDeckStore'
  import { registerProceduralDecks } from './services/math/proceduralDeckRegistry'
  import { initConfusionMatrix } from './services/confusionMatrixStore'
  import { getPresetById } from './services/studyPresetService'
  import type { CustomDeckRunItem } from './data/studyPreset'
  import { collectMatchingFactIds } from './services/presetSelectionService'
  import { resumeCombatWithFallback } from './services/combatResumeService'
  import { BASE_WIDTH } from './data/layout'
  import { layoutMode } from './stores/layoutStore'

  import ArchetypeSelection from './ui/components/ArchetypeSelection.svelte'
  import CardCombatOverlay from './ui/components/CardCombatOverlay.svelte'
  import MysteryEventOverlay from './ui/components/MysteryEventOverlay.svelte'
  import MasteryChallengeOverlay from './ui/components/MasteryChallengeOverlay.svelte'
  import RestRoomOverlay from './ui/components/RestRoomOverlay.svelte'
  import StudyQuizOverlay from './ui/components/StudyQuizOverlay.svelte'
  import MeditateOverlay from './ui/components/MeditateOverlay.svelte'
  import RunEndScreen from './ui/components/RunEndScreen.svelte'
  import CardRewardScreen from './ui/components/CardRewardScreen.svelte'
  import RetreatOrDelve from './ui/components/RetreatOrDelve.svelte'
  import DungeonEntrance from './ui/components/DungeonEntrance.svelte'
  import HubScreen from './ui/components/HubScreen.svelte'
  import ShopRoomOverlay from './ui/components/ShopRoomOverlay.svelte'
  import CampfirePause from './ui/components/CampfirePause.svelte'
  import SpecialEventOverlay from './ui/components/SpecialEventOverlay.svelte'
  import FireflyBackground from './ui/components/FireflyBackground.svelte'
  import KnowledgeLibrary from './ui/components/KnowledgeLibrary.svelte'
  import SettingsPanel from './ui/components/SettingsPanel.svelte'
  import ProfileScreen from './ui/components/ProfileScreen.svelte'
  import JournalScreen from './ui/components/JournalScreen.svelte'
  import LeaderboardsScreen from './ui/components/LeaderboardsScreen.svelte'
  import SocialScreen from './ui/components/SocialScreen.svelte'
  import RelicCollectionScreen from './ui/components/RelicCollectionScreen.svelte'
  import RelicSwapOverlay from './ui/components/RelicSwapOverlay.svelte'
  import RelicPickupToast from './ui/components/RelicPickupToast.svelte'
  import UpgradeSelectionOverlay from './ui/components/UpgradeSelectionOverlay.svelte'
  import PostMiniBossRestOverlay from './ui/components/PostMiniBossRestOverlay.svelte'
  import DungeonMap from './ui/components/DungeonMap.svelte'
  // StarterRelicSelection removed in AR-59.12 — file kept as dead code pending deletion approval
  import DeckSelectionHub from './ui/components/DeckSelectionHub.svelte'
  import TriviaDungeonScreen from './ui/components/TriviaDungeonScreen.svelte'
  import StudyTempleScreen from './ui/components/StudyTempleScreen.svelte'
import ProceduralStudyScreen from './ui/components/ProceduralStudyScreen.svelte'
  import RunPreviewScreen from './ui/components/RunPreviewScreen.svelte'
  import RewardCardDetail from './ui/components/RewardCardDetail.svelte'
  import { rewardCardDetail, getCardDetailCallbacks } from './services/rewardRoomBridge'
  import { updateRichPresence } from './services/steamService'
  import { getCombatBgForEnemy, getCombatDepthMap } from './data/backgroundManifest'
  import ParallaxTransition from './ui/components/ParallaxTransition.svelte'
  import InRunTopBar from './ui/components/InRunTopBar.svelte'
  import MusicWidget from './ui/components/MusicWidget.svelte'
  import NarrativeOverlay from './ui/components/NarrativeOverlay.svelte'
  import { musicService } from './services/musicService'
  import { ambientAudio } from './services/ambientAudioService'
  import { getReviewQueueLength } from './services/reviewQueueSystem'
  import { getAuraLevel, getAuraState } from './services/knowledgeAuraSystem'
  import { narrativeDisplay, dismissNarrative } from './ui/stores/narrativeStore'
  import MultiplayerLobby from './ui/components/MultiplayerLobby.svelte'
  import MultiplayerHUD from './ui/components/MultiplayerHUD.svelte'
  import MultiplayerMenu from './ui/components/MultiplayerMenu.svelte'
  import {
    createLobby,
    joinLobby,
    leaveLobby,
    getCurrentLobby,
    onLobbyUpdate,
    onGameStart as registerGameStartCb,
  } from './services/multiplayerLobbyService'
  import { onOpponentProgressUpdate } from './services/multiplayerGameService'
  import type { LobbyState, RaceProgress, MultiplayerMode } from './data/multiplayerTypes'

  // Update Steam Rich Presence whenever the active screen changes.
  $effect(() => {
    updateRichPresence($currentScreen)
  })

  // Apply font accessibility class to document.body based on user preference.
  $effect(() => {
    const unsub = fontChoice.subscribe((fc: FontChoice) => {
      document.body.classList.remove('font-dyslexic', 'font-system')
      if (fc === 'dyslexic') document.body.classList.add('font-dyslexic')
      else if (fc === 'system') document.body.classList.add('font-system')
    })
    return () => unsub()
  })

  function transitionScreen(target: Screen): void {
    const nextScreen = navigateToScreen(target, $currentScreen)
    currentScreen.set(nextScreen)
  }

  let shuffleSeedOffset = 0

  let proceduralDeckId = $state('')
  let proceduralSubDeckId = $state<string | undefined>(undefined)

  let showOutsideDuePrompt = $state(false)
  let outsideDueCount = $state(0)

  async function maybePromptOutsideDueReviews(): Promise<boolean> {
    const save = get(playerSave)
    const deckMode = save?.activeDeckMode
    if (!deckMode || deckMode.type !== 'preset') return false

    const preset = getPresetById(deckMode.presetId)
    if (!preset) return false

    if (!factsDB.isReady()) {
      try {
        await factsDB.init()
      } catch {
        return false
      }
    }

    const selectedFactIds = collectMatchingFactIds(factsDB.getAll(), preset.domainSelections)
    const outsideDue = getDueReviews().filter((state) => !selectedFactIds.has(state.factId))
    if (outsideDue.length === 0) return false

    outsideDueCount = outsideDue.length
    showOutsideDuePrompt = true
    return true
  }

  async function handleStartRun(): Promise<void> {
    if (hasActiveRun()) {
      const saved = loadActiveRun()
      if (saved) {
        guardRunStats = {
          floor: saved.runState.floor.currentFloor,
          gold: saved.runState.currency,
          encounters: saved.runState.encountersWon,
          factsCorrect: saved.runState.factsCorrect,
        }
      }
      showRunGuardPopup = true
      return
    }
    // Navigate to dungeon selection instead of directly starting
    handleOpenDungeonSelection()
  }

  function handleOpenDungeonSelection(): void {
    transitionScreen('deckSelectionHub')
  }

  function handleOpenTriviaDungeon(): void {
    transitionScreen('triviaDungeon')
  }

  function handleOpenStudyTemple(): void {
    transitionScreen('studyTemple')
  }

  function handleBackToDeckHub(): void {
    transitionScreen('deckSelectionHub')
  }

  function handleDungeonRunStart(config: { mode: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> } | { mode: 'study'; deckId: string; subDeckId?: string; examTags?: string[] } | { mode: 'procedural'; deckId: string; subDeckId?: string } | { mode: 'custom_deck'; items: CustomDeckRunItem[] }): void {
    // Procedural math decks bypass the combat run — navigate directly to practice screen
    if (config.mode === 'procedural') {
      proceduralDeckId = config.deckId
      proceduralSubDeckId = config.subDeckId
      transitionScreen('proceduralStudy')
      return
    }

    // Set the deck mode in playerSave so the run uses it
    if (config.mode === 'custom_deck') {
      playerSave.update(s => s ? { ...s, activeDeckMode: { type: 'custom_deck' as const, items: config.items } } : s)
    } else if (config.mode === 'trivia') {
      playerSave.update(s => s ? { ...s, activeDeckMode: { type: 'trivia' as const, domains: config.domains, subdomains: config.subdomains } } : s)
    } else {
      playerSave.update(s => s ? { ...s, activeDeckMode: { type: 'study' as const, deckId: config.deckId, subDeckId: config.subDeckId, examTags: config.examTags } } : s)
    }
    persistPlayer()
    // Navigate back to hub, then start the run
    transitionScreen('hub')
    // Small delay to let the hub render, then start
    setTimeout(() => {
      startNewRun({ includeOutsideDueReviews: false })
    }, 100)
  }

  function handleRunPreviewShuffle(): void {
    reshuffleChainDistribution(++shuffleSeedOffset)
  }

  function handleRunPreviewBeginExpedition(): void {
    confirmChainDistribution()
  }


  function handleGuardContinue(): void {
    showRunGuardPopup = false
    guardRunStats = null
    handleResumeActiveRun()
  }

  async function handleGuardAbandon(): Promise<void> {
    showRunGuardPopup = false
    guardRunStats = null
    if (await maybePromptOutsideDueReviews()) return
    startNewRun({ includeOutsideDueReviews: false })
  }

  function handleOutsideDueChoice(includeOutsideDueReviews: boolean): void {
    showOutsideDuePrompt = false
    startNewRun({ includeOutsideDueReviews })
  }


  function handleOpenLibrary(): void {
    transitionScreen('library')
  }

  function handleOpenSettings(): void {
    transitionScreen('settings')
  }

  function handleOpenProfile(): void {
    transitionScreen('profile')
  }

  function handleOpenJournal(): void {
    transitionScreen('journal')
  }

  function handleOpenLeaderboards(): void {
    transitionScreen('leaderboards')
  }

  function handleOpenSocial(): void {
    transitionScreen('social')
  }


  function handleReplayBootAnim(): void {
    if (import.meta.env.DEV) console.log('[BootAnim] Replay triggered, phaserBooted:', phaserBooted)
    showBootAnimation = true

    if (phaserBooted) {
      // Phaser already running — add scene if missing, then start it
      Promise.all([
        import('./game/CardGameManager'),
        import('./game/scenes/BootAnimScene'),
      ]).then(([{ CardGameManager }, { default: BootAnimScene }]) => {
        const mgr = CardGameManager.getInstance()
        const game = mgr.getGame()
        if (import.meta.env.DEV) console.log('[BootAnim] game:', !!game, 'transparent:', game?.config?.transparent)
        if (!game) return

        // Reset phaser container visibility
        const container = document.getElementById('phaser-container')
        if (import.meta.env.DEV) console.log('[BootAnim] container visible class:', container?.classList.contains('visible'))
        if (container) {
          container.style.transition = ''
          container.style.opacity = ''
        }

        // Add scene if it wasn't included in initial boot
        const existing = game.scene.getScene('BootAnimScene')
        if (import.meta.env.DEV) console.log('[BootAnim] scene exists:', !!existing)
        if (!existing) {
          game.scene.add('BootAnimScene', BootAnimScene)
          if (import.meta.env.DEV) console.log('[BootAnim] added scene')
        } else {
          game.scene.stop('BootAnimScene')
          if (import.meta.env.DEV) console.log('[BootAnim] stopped existing scene')
        }

        // Start the boot animation scene
        game.scene.start('BootAnimScene')
        if (import.meta.env.DEV) console.log('[BootAnim] started scene, active scenes:', game.scene.getScenes(true).map((s: Phaser.Scene) => s.scene.key))

        // Listen for show-blurred, deblur, completion
        game.events.once('boot-anim-show-blurred', () => { hubShowBlurred = true })
        game.events.once('boot-anim-deblur', () => { hubDeblurring = true })
        game.events.once('boot-anim-complete', () => {
          const el = document.getElementById('phaser-container')
          if (el) {
            el.style.transition = 'opacity 0.3s ease-out'
            el.style.opacity = '0'
          }
          setTimeout(() => {
            showBootAnimation = false
            hubDeblurring = false
            hubShowBlurred = false
            mgr.stopBootAnim()
            if (el) {
              el.style.transition = ''
              el.style.opacity = ''
            }
          }, 350)
        })
      })
    } else {
      void ensurePhaserBooted(true)
    }
  }

  let gainedFactText = $state<string | null>(null)

  let combatTransitionActive = $state(false)
  let combatTransitionType = $state<'enter' | 'exit-forward'>('enter')
  let prevScreen = $state('')
  let exitEnemyId = $state<string | null>(null)

  let showArcanePassModal = $state(false)
  let showSeasonPassModal = $state(false)
  let showCosmeticStoreModal = $state(false)

  function handleOpenArcanePass(): void {
    showArcanePassModal = true
  }

  function handleOpenSeasonPass(): void {
    showSeasonPassModal = true
  }

  function handleOpenCosmeticStore(): void {
    showCosmeticStoreModal = true
  }

  // ── Multiplayer state ─────────────────────────────────────────────────────

  /** Current lobby state — null when not in a multiplayer lobby. */
  let currentLobby = $state<LobbyState | null>(getCurrentLobby())

  /** Live opponent progress for MultiplayerHUD — updated via onOpponentProgressUpdate subscription. */
  let opponentProgress = $state<RaceProgress>({
    playerId: 'opponent',
    floor: 1,
    playerHp: 100,
    playerMaxHp: 100,
    score: 0,
    accuracy: 0,
    encountersWon: 0,
    isFinished: false,
  })
  let opponentDisplayName = $state('Opponent')

  /** True while an active multiplayer lobby exists (race progress HUD visible in combat). */
  let isMultiplayerRun = $derived(currentLobby !== null)

  function handleOpenMultiplayer(): void {
    // Navigate to the multiplayer menu for mode selection before creating a lobby.
    transitionScreen('multiplayerMenu')
  }

  function handleMultiplayerBack(): void {
    if (currentLobby) {
      leaveLobby()
      currentLobby = null
      transitionScreen('multiplayerMenu')
    } else {
      transitionScreen('hub')
    }
  }

  function handleCreateLobby(mode: MultiplayerMode): void {
    const lobby = createLobby('local_player', 'Player', mode)
    currentLobby = lobby
    transitionScreen('multiplayerLobby')
  }

  function handleJoinLobby(code: string): void {
    joinLobby(code, 'local_player', 'Player')
    transitionScreen('multiplayerLobby')
  }

  // Keep currentLobby in sync when the lobby service updates state (other players join/leave).
  $effect(() => {
    const unsub = onLobbyUpdate((lobby) => {
      currentLobby = lobby
    })
    return unsub
  })

  // Wire game start and live opponent progress for multiplayer races.
  $effect(() => {
    const unsubStart = registerGameStartCb((seed: number, lobby: LobbyState) => {
      const opponent = lobby.players.find(p => p.id !== 'local_player')
      opponentDisplayName = opponent?.displayName ?? 'Opponent'
      startNewRun({
        multiplayerSeed: seed,
        multiplayerMode: lobby.mode,
      })
    })
    const unsubProgress = onOpponentProgressUpdate((progress: RaceProgress) => {
      opponentProgress = progress
    })
    return () => {
      unsubStart()
      unsubProgress()
    }
  })

  function handleStartDailyExpedition(): Promise<{ ok: true } | { ok: false; reason: string }> {
    return startDailyExpeditionRun()
  }

  function handleStartEndlessDepths(): Promise<{ ok: true } | { ok: false; reason: string }> {
    return startEndlessDepthsRun()
  }

  function handleStartScholarChallenge(): Promise<{ ok: true } | { ok: false; reason: string }> {
    return startScholarChallengeRun()
  }

  function handleOpenRelicSanctum(): { ok: true } | { ok: false; reason: string } {
    return openRelicSanctum()
  }

  function handleBackToMenu(): void {
    transitionScreen('hub')
  }

  function handleCloseRelicSanctum(): void {
    closeRelicSanctum()
  }

  function handleRelicRewardSelect(relic: import('./data/relics/types').RelicDefinition): void {
    onRelicRewardSelected(relic)
  }

  function handleRelicReroll(): void {
    const currentIds = $activeRelicRewardOptions.map((r) => r.id)
    rerollRelicSelection(currentIds)
  }

  function handleRelicPickupSwap(): void {
    // Toast "Swap" button tapped: navigate to swap overlay.
    // pendingSwapRelicId was already set when the toast drop was stored at full capacity.
    activeRelicPickup.set(null)
    currentScreen.set('relicSwapOverlay')
    gameFlowState.set('relicSwapOverlay')
  }

  /** Derived data for the RelicSwapOverlay: the relic being offered and equipped relic display. */
  let swapOfferedRelic = $derived.by(() => {
    const offeredId = getPendingSwapRelicId()
    if (!offeredId) return null
    return RELIC_BY_ID[offeredId] ?? null
  })

  let swapEquippedRelics = $derived.by(() => {
    const run = $activeRunState
    if (!run) return []
    return run.runRelics.map(r => {
      const def = RELIC_BY_ID[r.definitionId]
      const basePrice = def ? (SHOP_RELIC_PRICE[def.rarity] ?? 60) : 60
      return {
        definitionId: r.definitionId,
        name: def?.name ?? r.definitionId,
        description: def?.description ?? '',
        icon: def?.icon ?? '?',
        rarity: def?.rarity ?? 'common',
        sellRefund: Math.floor(basePrice * RELIC_SELL_REFUND_PCT),
      }
    })
  })

  let swapSlotLabel = $derived.by(() => {
    const run = $activeRunState
    if (!run) return '5/5'
    const max = getMaxRelicSlots(run.runRelics)
    return `${run.runRelics.length}/${max}`
  })

  function handleSwapSellAndAcquire(sellId: string): void {
    sellEquippedRelic(sellId)
    acquirePendingSwapRelic()
    clearPendingSwapRelicId()
    gameFlowState.set('dungeonMap')
    currentScreen.set('dungeonMap')
  }

  function handleSwapPass(): void {
    clearPendingSwapRelicId()
    gameFlowState.set('dungeonMap')
    currentScreen.set('dungeonMap')
  }

  async function handleArchetypeSelect(archetype: import('./services/runManager').RewardArchetype): Promise<void> {
    onArchetypeSelected(archetype)
    // If run has a dungeon map, onArchetypeSelected already navigated to dungeonMap — no encounter to start
    const run = get(activeRunState)
    if (run?.floor.actMap) return
    // Legacy path: start encounter directly (no map)
    void ensurePhaserBooted()
    try {
      if (!(await startEncounterForRoom())) {
        releaseScreenTransition()
        currentScreen.set('hub')
        activeRunState.set(null)
      } else {
        autoSaveRun('combat')
      }
    } catch (err) {
      console.error('[CardApp] Failed to start encounter', err)
      releaseScreenTransition()
      currentScreen.set('hub')
      activeRunState.set(null)
    }
  }

  async function handleOnboardingBegin(slowReader: boolean, _languageCode: string | null): Promise<void> {
    isSlowReader.set(slowReader)
    // Use placeholder domains — the pool builder uses deckMode (set in startNewRun), not these
    onDomainsSelected('general_knowledge', 'general_knowledge')
    onArchetypeSelected('balanced')
    // If run has a dungeon map, onArchetypeSelected already navigated to dungeonMap — no encounter to start
    const run = get(activeRunState)
    if (run?.floor.actMap) return
    // Legacy path: start encounter directly (no map)
    void ensurePhaserBooted()
    try {
      if (!(await startEncounterForRoom())) {
        releaseScreenTransition()
        currentScreen.set('hub')
        activeRunState.set(null)
      } else {
        autoSaveRun('combat')
      }
    } catch (err) {
      console.error('[CardApp] Failed to start onboarding encounter', err)
      releaseScreenTransition()
      currentScreen.set('hub')
      activeRunState.set(null)
    }
  }

  async function handleRoomPick(index: number): Promise<void> {
    const room = get(activeRoomOptions)[index]
    if (!room) return
    onRoomSelected(room)
    if (room.type === 'combat') {
      void ensurePhaserBooted()
      try {
        if (!(await startEncounterForRoom(room.enemyId))) {
          releaseScreenTransition()
          currentScreen.set('hub')
          activeRunState.set(null)
        } else {
          autoSaveRun('combat')
        }
      } catch (err) {
        console.error('[CardApp] Failed to start room encounter', err)
        releaseScreenTransition()
        currentScreen.set('hub')
        activeRunState.set(null)
      }
    }
  }

  let mapNodeSelectionInProgress = false
  async function handleMapNodeSelect(nodeId: string): Promise<void> {
    if (mapNodeSelectionInProgress) return
    mapNodeSelectionInProgress = true
    try {
      const run = get(activeRunState)
      if (!run?.floor.actMap) return
      const node = run.floor.actMap.nodes[nodeId]
      if (!node) return

      // Update map state (node selection, floor derivation, analytics)
      onMapNodeSelected(nodeId)

      // Combat-type nodes: CardApp owns the full combat start sequence
      if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
        void ensurePhaserBooted()
        gameFlowState.set('combat')
        holdScreenTransition()
        currentScreen.set('combat')
        try {
          if (!(await startEncounterForRoom(node.enemyId))) {
            releaseScreenTransition()
            currentScreen.set('dungeonMap')
          } else {
            autoSaveRun('combat')
          }
        } catch (err) {
          console.error('[CardApp] Failed to start map node encounter', err)
          releaseScreenTransition()
          currentScreen.set('dungeonMap')
        }
      }
    } finally {
      mapNodeSelectionInProgress = false
    }
  }

  function handleMysteryResolve(effect: MysteryEffect): void {
    onMysteryEffectResolved(effect)
  }

  function handleRestHeal(): void {
    const run = get(activeRunState)
    if (!run) return
    const healMultiplier = run.ascensionModifiers?.restHealMultiplier ?? 1.0
    const amount = Math.round(run.playerMaxHp * REST_SITE_HEAL_PCT * healMultiplier)
    healPlayer(run, amount)
    activeRunState.set(run)
    onRestResolved()
  }

  function handleRestUpgrade(): void {
    if (!openUpgradeSelection()) {
      return
    }
  }

  let studyQuestions = $state<QuizQuestion[]>([])
  let meditateCandidates = $state<import('./data/card-types').Card[]>([])

  // Pick up scenario-injected study questions when the screen switches to restStudy
  // and the normal flow hasn't already populated studyQuestions.
  $effect(() => {
    if ($currentScreen === 'restStudy' && studyQuestions.length === 0) {
      const sym = Symbol.for('rr:scenarioStudyQuestions')
      const injected = (globalThis as any)[sym]
      if (Array.isArray(injected) && injected.length > 0) {
        studyQuestions = injected
        delete (globalThis as any)[sym]
      }
    }
  })

  function handleRestStudy(): void {
    studyQuestions = generateStudyQuestions()
    gameFlowState.set('restStudy')
    currentScreen.set('restStudy')
  }

  function handleRestMeditate(): void {
    meditateCandidates = getMeditateCandidates()
    gameFlowState.set('restMeditate')
    currentScreen.set('restMeditate')
  }

  function handleStudyComplete(correctFactIds: string[]): void {
    studyQuestions = []
    onStudyComplete(correctFactIds)
  }

  function handleMeditateRemove(cardId: string): void {
    meditateCandidates = []
    onMeditateRemove(cardId)
  }

  function handleMeditateCancel(): void {
    meditateCandidates = []
    gameFlowState.set('restRoom')
    currentScreen.set('restRoom')
  }

  function handleRewardSelected(card: import('./data/card-types').Card): void {
    onCardRewardSelected(card)
    // Show "Fact Gained" toast
    const fact = factsDB.getById(card.factId)
    if (fact) {
      const text = fact.quizQuestion ?? fact.statement ?? ''
      gainedFactText = text.length > 140 ? text.slice(0, 137) + '...' : text
      setTimeout(() => { gainedFactText = null }, 2500)
    }
  }

  function handlePause(): void {
    openCampfire()
  }

  function handleCampfireResume(): void {
    resumeFromCampfire()
  }

  function handleCampfireHub(): void {
    returnToHubFromCampfire()
  }

  function handleSpecialEventResolved(): void {
    onSpecialEventResolved()
  }

  async function handleResumeActiveRun(): Promise<void> {
    const saved = loadActiveRun()
    if (!saved) return
    restoreRunMode(saved.runMode, saved.dailySeed, saved.runSeed)
    activeRunState.set(saved.runState)
    hydrateEncounterSnapshot(saved.encounterSnapshot ?? null)
    activeCardRewardOptions.set(saved.cardRewardOptions ?? [])
    activeRewardBundle.set(saved.activeRewardBundle ?? null)
    activeRewardRevealStep.set(saved.rewardRevealStep ?? 'gold')
    if (saved.roomOptions && saved.roomOptions.length > 0) {
      activeRoomOptions.set(saved.roomOptions)
    }
    // Navigate to the saved screen or default to dungeon map
    const screen = saved.currentScreen as import('./ui/stores/gameState').Screen
    const mapOrRoom = 'dungeonMap'
    let targetScreen = screen === 'campfire' ? mapOrRoom : (screen || mapOrRoom)
    if (targetScreen === 'cardReward' && (saved.cardRewardOptions?.length ?? 0) === 0) {
      targetScreen = mapOrRoom
    }
    if (screen === 'combat') {
      // Make Phaser container visible before combat re-init.
      currentScreen.set('combat')
      await tick()
      targetScreen = await resumeCombatWithFallback({
        floor: saved.runState.floor.currentFloor,
        ensurePhaserBooted,
        startEncounter: () => startEncounterForRoom(),
        hasTurnState: () => get(activeTurnState) !== null,
        onCombatResumed: () => {
          autoSaveRun('combat')
        },
        onFallbackMap: () => { /* map will show automatically */ },
        logger: console,
      })
    }
    currentScreen.set(targetScreen)
    hasRunSave = false
  }

  let showBootAnimation = $state(false)
  let hubDeblurring = $state(false)
  let hubShowBlurred = $state(false) // true = hub visible but heavily blurred during cave fly-through

  let showAbandonConfirm = $state(false)
  let abandonRunInfo = $state<{ floor: number; gold: number; encounters: number; factsCorrect: number } | null>(null)

  let showRunGuardPopup = $state(false)
  let guardRunStats = $state<{ floor: number; gold: number; encounters: number; factsCorrect: number } | null>(null)

  function handleAbandonRun(): void {
    const saved = loadActiveRun()
    if (saved) {
      abandonRunInfo = {
        floor: saved.runState.floor.currentFloor,
        gold: saved.runState.currency,
        encounters: saved.runState.encountersWon,
        factsCorrect: saved.runState.factsCorrect,
      }
    }
    showAbandonConfirm = true
  }

  function confirmAbandon(): void {
    abandonActiveRun()
    hasRunSave = false
    showAbandonConfirm = false
    abandonRunInfo = null
  }

  function cancelAbandon(): void {
    showAbandonConfirm = false
    abandonRunInfo = null
  }

  let activeRunFloor = $derived($activeRunState?.floor.currentFloor ?? 0)
  let hasRunSave = $state(hasActiveRun())
  let showActiveRunBanner = $derived(!$activeRunState && hasRunSave && !showRunGuardPopup)

  const IN_RUN_SCREENS: Set<Screen> = new Set([
    'combat', 'cardReward', 'shopRoom', 'restRoom', 'mysteryEvent',
    'dungeonMap', 'retreatOrDelve', 'campfire', 'specialEvent',
    'upgradeSelection', 'postMiniBossRest', 'restStudy', 'restMeditate',
    'rewardRoom', 'masteryChallenge', 'relicSwapOverlay',
  ])

  let showTopBar = $derived($layoutMode === 'landscape' && IN_RUN_SCREENS.has($currentScreen) && $activeRunState !== null)

  let topBarRelics = $derived(
    ($activeRunState?.runRelics ?? []).map((r) => {
      const def = RELIC_BY_ID[r.definitionId]
      return {
        definitionId: r.definitionId,
        name: def?.name ?? r.definitionId,
        description: def?.description ?? '',
        icon: def?.icon ?? '?',
        rarity: def?.rarity ?? 'common',
      }
    })
  )
  let topBarMaxRelicSlots = $derived($activeRunState ? getMaxRelicSlots($activeRunState.runRelics) : 5)

  let topBarPlayerEffects = $derived((() => {
    const ts = $activeTurnState
    if (!ts) return []
    const effects: Array<{ type: string; value: number; turnsRemaining: number }> = [
      ...(ts.playerState?.statusEffects ?? []).map((e: { type: string; value: number; turnsRemaining: number }) => ({ type: e.type as string, value: e.value, turnsRemaining: e.turnsRemaining })),
    ]
    if (ts.thornsActive && ts.thornsValue > 0)
      effects.push({ type: 'thorns', value: ts.thornsValue, turnsRemaining: 1 })
    if (ts.buffNextCard > 0)
      effects.push({ type: 'empower', value: ts.buffNextCard, turnsRemaining: 1 })
    if (ts.doubleStrikeReady)
      effects.push({ type: 'double_strike', value: 60, turnsRemaining: 1 })
    if (ts.foresightTurnsRemaining > 0)
      effects.push({ type: 'foresight', value: 2, turnsRemaining: ts.foresightTurnsRemaining })
    if (ts.focusReady && ts.focusCharges > 0)
      effects.push({ type: 'focus', value: ts.focusCharges, turnsRemaining: 1 })
    if (ts.overclockReady)
      effects.push({ type: 'overclock', value: 1, turnsRemaining: 1 })
    if (ts.persistentShield > 0)
      effects.push({ type: 'fortify', value: ts.persistentShield, turnsRemaining: 1 })
    if (ts.phoenixRageTurnsRemaining > 0)
      effects.push({ type: 'strength', value: 1, turnsRemaining: ts.phoenixRageTurnsRemaining })
    const lockedCards = ts.deck?.hand?.filter((c: { isLocked?: boolean }) => c.isLocked) ?? []
    if (lockedCards.length > 0)
      effects.push({ type: 'locked', value: lockedCards.length, turnsRemaining: 999 })
    return effects.filter((e) => e.turnsRemaining > 0)
  })())

  $effect(() => {
    if ($currentScreen === 'hub') {
      hasRunSave = hasActiveRun()
    }
  })

  // Auto-start music when entering a run. Music keeps playing when leaving
  // (hub screen, etc.) so users retain control via MusicWidget.
  $effect(() => {
    const inRun = IN_RUN_SCREENS.has($currentScreen) && $activeRunState !== null
    if (inRun) {
      musicService.startWithFadeIn(5000)
    }
  })

  function nextSegmentName(floor: number): string {
    if (floor < 3) return 'Shallow Depths'
    if (floor < 6) return 'Deep Dungeon'
    if (floor < 9) return 'The Abyss'
    return 'Endless Depths'
  }

  let bootLogoPlayed = false

  function handleUserInteraction(): void {
    unlockCardAudio()
    ambientAudio.init()
    ambientAudio.unlock()
    // Preload combat-critical SFX files in background (synthesis handles first play)
    void audioManager.preloadSounds([
      // Quiz — heard every encounter
      'quiz_correct', 'quiz_wrong', 'quiz_appear', 'quiz_answer_select', 'quiz_dismiss',
      // Card play — every card every fight
      'card_swoosh_attack', 'card_swoosh_shield', 'card_swoosh_buff', 'card_swoosh_debuff', 'card_swoosh_wild',
      'card_deal', 'card_select', 'card_deselect', 'card_discard',
      // Chain — signature mechanic
      'chain_link_1', 'chain_link_2', 'chain_link_3', 'chain_link_4', 'chain_link_5', 'chain_break',
      // Core combat feedback
      'player_damage', 'enemy_attack', 'shield_absorb', 'shield_break', 'shield_gain',
      // UI — heard constantly
      'button_click', 'modal_open', 'modal_close',
      // Turn flow
      'end_turn_click', 'ap_spend',
    ])
    musicService.init()    // CREATE context on first gesture
    musicService.unlock()  // RESUME if suspended
    if (!bootLogoPlayed) {
      bootLogoPlayed = true
      playCardAudio('boot-logo')
    }
  }

  function createLazyLoader<T>(factory: () => Promise<T>): () => Promise<T> {
    let promise: Promise<T> | null = null
    return () => {
      if (!promise) {
        promise = factory()
      }
      return promise
    }
  }

  const loadRoguePassModal = createLazyLoader(() => import('./ui/components/RoguePassModal.svelte'))
  const loadSeasonPassView = createLazyLoader(() => import('./ui/components/SeasonPassView.svelte'))
  const loadCosmeticStoreModal = createLazyLoader(() => import('./ui/components/CosmeticStoreModal.svelte'))

  let phaserBooted = false
  let phaserBootPromise: Promise<void> | null = null

  function ensurePhaserBooted(startAnimation = false): Promise<void> {
    if (phaserBooted) return Promise.resolve()
    if (phaserBootPromise) return phaserBootPromise

    phaserBootPromise = import('./game/CardGameManager')
      .then(({ CardGameManager }) => {
        const mgr = CardGameManager.getInstance()
        mgr.boot(startAnimation)
        phaserBooted = true

        if (startAnimation) {
          const game = mgr.getGame()
          if (game) {
            game.events.once('boot-anim-show-blurred', () => {
              hubShowBlurred = true
            })
            game.events.once('boot-anim-deblur', () => {
              hubDeblurring = true
            })
            game.events.once('boot-anim-complete', () => {
              const container = document.getElementById('phaser-container')
              if (container) {
                container.style.transition = 'opacity 0.3s ease-out'
                container.style.opacity = '0'
              }
              setTimeout(() => {
                showBootAnimation = false
                hubDeblurring = false
                hubShowBlurred = false
                mgr.stopBootAnim()
                localStorage.setItem('recall-rogue-boot-anim-seen', 'true')
                if (container) {
                  container.style.transition = ''
                  container.style.opacity = ''
                  if (import.meta.env.DEV) console.log('[BootAnim] opacity reset, container opacity:', container?.style.opacity)
                }
              }, 350)
            })
          }
        }
      })
      .catch((error) => {
        phaserBootPromise = null
        console.warn('[CardApp] Failed to boot Phaser on demand', error)
        throw error
      })

    return phaserBootPromise
  }

  $effect(() => {
    if ($currentScreen === 'combat' || $currentScreen === 'rewardRoom') {
      void ensurePhaserBooted()
      // Defensive: clear any lingering inline styles from boot animation
      // that could leave the canvas invisible (opacity: '0')
      const el = document.getElementById('phaser-container')
      if (el) {
        el.style.opacity = ''
        el.style.transition = ''
      }
    }
  })

  // Combat enter transition: show parallax when entering combat
  $effect(() => {
    const screen = $currentScreen
    if (screen === 'combat' && prevScreen !== 'combat' && prevScreen !== 'campfire') {
      combatTransitionType = 'enter'
      combatTransitionActive = true
    }
    prevScreen = screen
  })

  // Combat exit transition: show parallax walk-forward when combat ends
  $effect(() => {
    if ($combatExitRequested && $currentScreen === 'combat') {
      // Use store captured BEFORE activeTurnState was cleared by encounterBridge
      const enemyId = $combatExitEnemyId
      if (enemyId) {
        exitEnemyId = enemyId
        combatTransitionType = 'exit-forward'
        combatTransitionActive = true
      } else {
        onCombatExitComplete()
      }
    }
  })

  function updateLayoutScale(): void {
    const container = document.querySelector('.card-app') as HTMLElement | null
    if (!container) return

    const mode = get(layoutMode)
    let scale: number
    let scaleX: number
    let scaleY: number

    if (mode === 'landscape') {
      // Landscape: always use the real viewport dimensions, NOT .card-app clientWidth.
      // .card-app has a portrait-aspect-ratio CSS width constraint (~603px at 1920×1080)
      // which would give a bogus scale of ~0.47 instead of the correct ~1.5.
      const vw = window.innerWidth
      const vh = window.innerHeight
      scaleX = vw / 1280
      scaleY = vh / 720
      scale = Math.min(scaleX, scaleY)
    } else {
      // Portrait: existing behaviour — scale from 390px base using .card-app clientWidth
      const w = container.clientWidth || window.innerWidth
      scale = Math.max(0.8, Math.min(1.4, w / BASE_WIDTH))
      scaleX = scale
      scaleY = scale
    }

    // AR-82: Apply user UI Scale preference (80–150%, default 100%)
    const userScalePct = parseInt(localStorage.getItem('recall-rogue-ui-scale') ?? '100', 10)
    const userScale = (isNaN(userScalePct) ? 100 : Math.max(80, Math.min(150, userScalePct))) / 100

    const root = document.documentElement
    root.style.setProperty('--layout-scale', String(scale * userScale))
    root.style.setProperty('--layout-scale-x', String(scaleX * userScale))
    root.style.setProperty('--layout-scale-y', String(scaleY * userScale))
    root.style.setProperty('--layout-mode', mode)

    // Text scale: grows at half the rate of layout, multiplied by user text pref.
    // Portrait keeps text at base user-pref scale (mobile-first, layout-scale handles sizing).
    const TEXT_SCALE_MAP: Record<string, number> = { small: 0.85, medium: 1, large: 1.2 }
    const textPref = TEXT_SCALE_MAP[get(textSize)] ?? 1
    const viewportTextFactor = mode === 'landscape' ? 1 + (scale - 1) * 0.5 : 1
    root.style.setProperty('--text-scale', String(viewportTextFactor * textPref * userScale))

    // Attribute on root container for CSS selectors: [data-layout="landscape"]
    container.setAttribute('data-layout', mode)
  }

  onMount(() => {
    const onInteraction = (): void => {
      handleUserInteraction()
      window.removeEventListener('pointerdown', onInteraction)
      window.removeEventListener('keydown', onInteraction)
    }

    window.addEventListener('pointerdown', onInteraction, { once: true })
    window.addEventListener('keydown', onInteraction, { once: true })

    updateLayoutScale()
    window.addEventListener('resize', updateLayoutScale)

    // Load curated decks in parallel — non-blocking, store handles empty state gracefully
    // Register procedural math decks into the shared deck registry
    registerProceduralDecks()
    void initializeCuratedDecks()

    // Initialize confusion matrix from player save
    initConfusionMatrix()

    // Re-run scale computation whenever layout mode changes (dev toggle or orientation flip)
    const unsubLayoutMode = layoutMode.subscribe(() => {
      updateLayoutScale()
    })

    // Re-run scale computation whenever user changes text size preference
    const unsubTextSize = textSize.subscribe(() => updateLayoutScale())

    // Boot animation — play once on first launch
    const urlParams = new URLSearchParams(window.location.search)
    const forceAnim = urlParams.has('forceBootAnim')
    const skipAnim = !forceAnim && (
      localStorage.getItem('recall-rogue-boot-anim-seen') === 'true'
      || urlParams.has('skipOnboarding')
      || urlParams.has('devpreset')
    )

    if (!skipAnim) {
      showBootAnimation = true
      void ensurePhaserBooted(true)
    }

    return () => {
      window.removeEventListener('pointerdown', onInteraction)
      window.removeEventListener('keydown', onInteraction)
      window.removeEventListener('resize', updateLayoutScale)
      unsubLayoutMode()
      unsubTextSize()
    }
  })
</script>

<div class:hidden-during-boot={showBootAnimation}>
  <FireflyBackground />
</div>
<div class="card-app" class:boot-bg-black={showBootAnimation && !hubShowBlurred} class:boot-bg-clear={hubShowBlurred && showBootAnimation} data-screen={$currentScreen} data-layout={$layoutMode}>
  {#if showTopBar}
    <InRunTopBar
      playerHp={$activeRunState?.playerHp ?? 0}
      playerMaxHp={$activeRunState?.playerMaxHp ?? 100}
      playerBlock={$activeTurnState?.playerState?.shield ?? 0}
      currency={$activeRunState?.currency ?? 0}
      currentFloor={$activeRunState?.floor.currentFloor ?? 1}
      segment={$activeRunState?.floor.segment ?? 1}
      currentEncounter={$activeRunState?.floor.currentEncounter ?? 0}
      encountersPerFloor={$activeRunState?.floor.encountersPerFloor ?? 3}
      relics={topBarRelics}
      triggeredRelicId={$activeTurnState?.triggeredRelicId ?? null}
      maxRelicSlots={topBarMaxRelicSlots}
      ascensionLevel={$activeRunState?.ascensionLevel ?? 0}
      reviewQueueLength={$activeTurnState != null ? getReviewQueueLength() : 0}
      fogLevel={$activeTurnState != null ? getAuraLevel() : 0}
      fogState={$activeTurnState != null ? getAuraState() : undefined}
      statusEffects={topBarPlayerEffects}
      onpause={handlePause}
    />
    <MusicWidget />
  {/if}

  <div
    id="phaser-container"
    class="phaser-container"
    class:visible={showBootAnimation || $currentScreen === 'combat' || $currentScreen === 'rewardRoom'}
    class:boot-anim-active={showBootAnimation}
    bind:this={phaserContainer}
  ></div>


  {#if $currentScreen === 'hub' || $currentScreen === 'mainMenu' || $currentScreen === 'base'}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="hub-wrapper" class:no-interact={showBootAnimation} class:boot-hidden={showBootAnimation && !hubShowBlurred} class:blurred={hubShowBlurred && !hubDeblurring} class:deblurring={hubDeblurring}>
    <HubScreen
      streak={$playerSave?.stats.currentStreak ?? 0}
      lastRunSummary={$lastRunSummary}
      hasActiveRunBanner={showActiveRunBanner}
      onStartRun={handleStartRun}
      onOpenLibrary={handleOpenLibrary}
      onOpenSettings={handleOpenSettings}
      onOpenProfile={handleOpenProfile}
      onOpenJournal={handleOpenJournal}
      onOpenLeaderboards={handleOpenLeaderboards}
      onOpenSocial={handleOpenSocial}
      onOpenMultiplayer={handleOpenMultiplayer}
      onOpenRelicSanctum={() => handleOpenRelicSanctum()}
      onReplayBootAnim={handleReplayBootAnim}
      disableEffects={showBootAnimation}
    />
    {#if showActiveRunBanner && !showBootAnimation}
      <div class="active-run-banner" data-testid="active-run-banner">
        <span class="banner-label">Run in progress</span>
        <div class="banner-buttons">
          <button type="button" class="banner-resume-btn" data-testid="btn-resume-run" onclick={handleResumeActiveRun}>Resume</button>
          <button type="button" class="banner-abandon-btn" data-testid="btn-abandon-run" onclick={handleAbandonRun}>Abandon</button>
        </div>
      </div>
    {/if}
    {#if showOutsideDuePrompt}
      <div class="abandon-confirm-overlay" role="dialog" aria-modal="true" aria-label="Outside deck reviews prompt">
        <div class="abandon-confirm-modal">
          <h3>Deck Review Option</h3>
          <p class="outside-due-text">Add to-review cards from other decks to the card pool?</p>
          <p class="outside-due-count">{outsideDueCount} due card{outsideDueCount === 1 ? '' : 's'} outside this deck.</p>
          <div class="abandon-confirm-buttons">
            <button class="abandon-btn-cancel" onclick={() => handleOutsideDueChoice(false)}>Keep Deck Only</button>
            <button class="abandon-btn-confirm" onclick={() => handleOutsideDueChoice(true)}>Add Due Cards</button>
          </div>
        </div>
      </div>
    {/if}
    {#if showAbandonConfirm}
      <div class="abandon-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm abandon run">
        <div class="abandon-confirm-modal">
          <h3>Abandon Run?</h3>
          {#if abandonRunInfo}
            <div class="abandon-run-stats">
              <div class="abandon-stat"><span class="stat-label">Floor</span><span class="stat-value">{abandonRunInfo.floor}</span></div>
              <div class="abandon-stat"><span class="stat-label">Gold</span><span class="stat-value">{abandonRunInfo.gold}</span></div>
              <div class="abandon-stat"><span class="stat-label">Encounters Won</span><span class="stat-value">{abandonRunInfo.encounters}</span></div>
              <div class="abandon-stat"><span class="stat-label">Facts Correct</span><span class="stat-value">{abandonRunInfo.factsCorrect}</span></div>
            </div>
          {/if}
          <p class="abandon-warning">All progress will be lost!</p>
          <div class="abandon-confirm-buttons">
            <button class="abandon-btn-cancel" onclick={cancelAbandon}>Cancel</button>
            <button class="abandon-btn-confirm" onclick={confirmAbandon}>Yes, Abandon</button>
          </div>
        </div>
      </div>
    {/if}
    {#if showRunGuardPopup}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="abandon-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Run in progress"
        tabindex="-1"
        onclick={(e) => { if (e.target === e.currentTarget) { showRunGuardPopup = false; guardRunStats = null } }}
      >
        <div class="abandon-confirm-modal run-guard-modal">
          <h3 class="run-guard-title">Run In Progress</h3>
          {#if guardRunStats}
            <div class="abandon-run-stats">
              <div class="abandon-stat"><span class="stat-label">Floor</span><span class="stat-value">{guardRunStats.floor}</span></div>
              <div class="abandon-stat"><span class="stat-label">Gold</span><span class="stat-value">{guardRunStats.gold}</span></div>
              <div class="abandon-stat"><span class="stat-label">Encounters Won</span><span class="stat-value">{guardRunStats.encounters}</span></div>
              <div class="abandon-stat"><span class="stat-label">Facts Correct</span><span class="stat-value">{guardRunStats.factsCorrect}</span></div>
            </div>
          {/if}
          <p class="abandon-warning">Abandoning will lose all progress from this run.</p>
          <div class="abandon-confirm-buttons">
            <button class="run-guard-btn-continue" onclick={handleGuardContinue}>Continue Run</button>
            <button class="run-guard-btn-abandon" onclick={handleGuardAbandon}>Abandon & Start New</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
  {/if}


  {#if $currentScreen === 'archetypeSelection'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <ArchetypeSelection onselect={handleArchetypeSelect} onskip={() => handleArchetypeSelect('balanced')} onback={returnToMenu} />
    </div>
  {/if}

  {#if $currentScreen === 'onboarding'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <DungeonEntrance onbegin={handleOnboardingBegin} onback={returnToMenu} />
    </div>
  {/if}

  {#if $currentScreen === 'combat'}
    <CardCombatOverlay
      turnState={$activeTurnState}
      onplaycard={handlePlayCard}
      onskipcard={handleSkipCard}
      onendturn={handleEndTurn}
      onusehint={handleUseHint}
      onreturnhub={() => { currentScreen.set('hub'); activeRunState.set(null); }}
    />
    <button
      type="button"
      class="pause-btn"
      data-testid="btn-pause"
      onclick={handlePause}
      aria-label="Pause"
    ><span class="pause-icon" aria-hidden="true"></span></button>
    {#if import.meta.env.DEV}
      <button
        type="button"
        class="dev-skip-btn"
        onclick={() => devForceEncounterVictory()}
      >&#x23ED; Skip</button>
    {/if}
    {#if isMultiplayerRun}
      <MultiplayerHUD
        progress={opponentProgress}
        displayName={opponentDisplayName}
      />
    {/if}
    {#if combatTransitionActive}
      {@const enemyId = combatTransitionType === 'exit-forward' ? exitEnemyId : $activeTurnState?.enemy?.template?.id}
      {#if enemyId}
        <ParallaxTransition
          imageUrl={getCombatBgForEnemy(enemyId)}
          depthUrl={getCombatDepthMap(enemyId)}
          type={combatTransitionType}
          onComplete={() => {
            combatTransitionActive = false
            if (combatTransitionType === 'exit-forward') {
              exitEnemyId = null
              onCombatExitComplete()
            }
          }}
        />
      {/if}
    {/if}
  {/if}

  {#if $currentScreen === 'cardReward'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <CardRewardScreen
        options={$activeCardRewardOptions}
        onselect={handleRewardSelected}
        onskip={onCardRewardSkipped}
        onrewardstepchange={() => autoSaveRun('cardReward')}
        onreroll={(type) => onCardRewardReroll(type)}
      />
    </div>
  {/if}

  {#if $currentScreen === 'shopRoom'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <ShopRoomOverlay
        cards={$activeShopCards}
        currency={$activeRunState?.currency ?? 0}
        shopInventory={$activeShopInventory}
        onsell={onShopSell}
        onbuyRelic={onShopBuyRelic}
        onbuyCard={onShopBuyCard}
        onbuyRemoval={onShopBuyRemoval}
        ondone={onShopDone}
      />
    </div>
  {/if}

  {#if $currentScreen === 'specialEvent'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <SpecialEventOverlay
        event={$activeSpecialEvent}
        onresolve={handleSpecialEventResolved}
      />
    </div>
  {/if}

  {#if $currentScreen === 'campfire'}
    {@const run = $activeRunState}
    {#if run}
      <div in:fly={{ y: 8, duration: 350 }}>
        <CampfirePause
          currentFloor={run.floor.currentFloor}
          playerHp={run.playerHp}
          playerMaxHp={run.playerMaxHp}
          deckSize={run.starterDeckSize + run.cardsEarned}
          relicCount={run.runRelics.length}
          accuracy={run.factsAnswered > 0 ? Math.round((run.factsCorrect / run.factsAnswered) * 100) : 0}
          canReturnHub={!(run.ascensionModifiers?.preventFlee ?? false)}
          onresume={handleCampfireResume}
          onreturnhub={handleCampfireHub}
        />
      </div>
    {/if}
  {/if}

  {#if $currentScreen === 'retreatOrDelve'}
    {@const run = $activeRunState}
    {#if run}
      <div in:fly={{ y: 8, duration: 350 }}>
        <RetreatOrDelve
          bossName={getDefeatedBossName()}
          segment={run.floor.segment}
          currency={run.currency}
          playerHp={run.playerHp}
          playerMaxHp={run.playerMaxHp}
          nextSegmentName={nextSegmentName(run.floor.currentFloor)}
          deathPenalty={getCurrentDelvePenalty()}
          retreatRewardsLocked={Boolean(
            run.ascensionModifiers?.minRetreatFloorForRewards != null &&
            run.floor.currentFloor < run.ascensionModifiers.minRetreatFloorForRewards
          )}
          retreatRewardsMinFloor={run.ascensionModifiers?.minRetreatFloorForRewards ?? null}
          onretreat={onRetreat}
          ondelve={onDelve}
        />
      </div>
    {/if}
  {/if}


  {#if $currentScreen === 'dungeonMap'}
    {@const run = $activeRunState}
    {#if run?.floor.actMap}
      <div in:fly={{ y: 8, duration: 350 }}>
        <DungeonMap
          map={run.floor.actMap}
          playerHp={run.playerHp}
          playerMaxHp={run.playerMaxHp}
          onNodeSelect={handleMapNodeSelect}
        />
        <button
          type="button"
          class="pause-btn"
          data-testid="btn-pause-map"
          onclick={handlePause}
          aria-label="Pause"
        ><span class="pause-icon" aria-hidden="true"></span></button>
      </div>
    {/if}
  {/if}

  {#if $currentScreen === 'mysteryEvent'}
    {@const run = $activeRunState}
    <div in:fly={{ y: 8, duration: 350 }}>
      <MysteryEventOverlay
        event={$activeMysteryEvent}
        playerHp={run?.playerHp ?? 0}
        playerMaxHp={run?.playerMaxHp ?? 0}
        onresolve={handleMysteryResolve}
      />
    </div>
  {/if}

  {#if $currentScreen === 'masteryChallenge'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <MasteryChallengeOverlay
        challenge={$activeMasteryChallenge}
        onresolve={onMasteryChallengeResolved}
      />
    </div>
  {/if}

  {#if $currentScreen === 'restRoom'}
    {@const run = $activeRunState}
    <div in:fly={{ y: 8, duration: 350 }}>
      <RestRoomOverlay
        playerHp={run?.playerHp ?? 0}
        playerMaxHp={run?.playerMaxHp ?? 0}
        onheal={handleRestHeal}
        onstudy={handleRestStudy}
        onmeditate={handleRestMeditate}
        studyDisabled={!hasRestUpgradeCandidates()}
        studyDisabledReason="No cards to upgrade"
        meditateDisabled={!canMeditate()}
        meditateDisabledReason="Deck too small (min 5)"
      />
    </div>
  {/if}

  {#if $currentScreen === 'restStudy'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <StudyQuizOverlay questions={studyQuestions} oncomplete={handleStudyComplete} />
    </div>
  {/if}

  {#if $currentScreen === 'restMeditate'}
    {@const run = $activeRunState}
    <div in:fly={{ y: 8, duration: 350 }}>
      <MeditateOverlay
        cards={meditateCandidates.map(c => ({
          id: c.id,
          mechanicName: c.mechanicName ?? '',
          factQuestion: c.factId ? (factsDB.getById(c.factId)?.quizQuestion ?? '') : '',
          isUpgraded: c.isUpgraded ?? false,
          tier: c.tier ?? '1',
        }))}
        onremove={handleMeditateRemove}
        oncancel={handleMeditateCancel}
      />
    </div>
  {/if}

  {#if $currentScreen === 'upgradeSelection'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <UpgradeSelectionOverlay
        candidates={$activeUpgradeCandidates}
        onselect={onUpgradeSelected}
        onskip={onUpgradeSkipped}
      />
    </div>
  {/if}

  {#if $currentScreen === 'postMiniBossRest'}
    {@const run = $activeRunState}
    <div in:fly={{ y: 8, duration: 350 }}>
      <PostMiniBossRestOverlay
        healAmount={Math.round((run?.playerMaxHp ?? 100) * POST_MINI_BOSS_HEAL_PCT)}
        candidates={$activeUpgradeCandidates}
        onselect={onPostMiniBossUpgradeSelected}
        onskip={onPostMiniBossUpgradeSkipped}
      />
    </div>
  {/if}

  {#if $currentScreen === 'runEnd'}
    {@const end = $activeRunEndData}
    {#if end}
      <div in:fly={{ y: 8, duration: 350 }}>
        <RunEndScreen
          result={end.result}
          floorReached={end.floorReached}
          factsAnswered={end.factsAnswered}
          correctAnswers={end.correctAnswers}
          accuracy={end.accuracy}
          bestCombo={end.bestCombo}
          cardsEarned={end.cardsEarned}
          newFactsLearned={end.newFactsLearned}
          factsMastered={end.factsMastered}
          encountersWon={end.encountersWon}
          encountersTotal={end.encountersTotal}
          completedBounties={end.completedBounties}
          runDurationMs={end.runDurationMs}
          rewardMultiplier={end.rewardMultiplier}
          currencyEarned={end.currencyEarned}
          isPracticeRun={end.isPracticeRun}
          xpResult={(end as any).xpResult}
          defeatedEnemyIds={(end as any).defeatedEnemyIds ?? []}
          factStateSummary={(end as any).factStateSummary ?? { seen: 0, reviewing: 0, mastered: 0 }}
          elitesDefeated={end.elitesDefeated ?? 0}
          miniBossesDefeated={end.miniBossesDefeated ?? 0}
          bossesDefeated={end.bossesDefeated ?? 0}
          onplayagain={playAgain}
          onhome={returnToMenu}
        />
      </div>
    {/if}
  {/if}

  {#if $currentScreen === 'library'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <KnowledgeLibrary onback={handleBackToMenu} />
    </div>
  {/if}

  {#if $currentScreen === 'settings'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <SettingsPanel onback={handleBackToMenu} />
    </div>
  {/if}


  {#if $currentScreen === 'deckSelectionHub'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <DeckSelectionHub
        onback={handleBackToMenu}
        onSelectTrivia={handleOpenTriviaDungeon}
        onSelectStudy={handleOpenStudyTemple}
      />
    </div>
  {/if}

  {#if $currentScreen === 'triviaDungeon'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <TriviaDungeonScreen
        onback={handleBackToDeckHub}
        onStartRun={handleDungeonRunStart}
      />
    </div>
  {/if}

  {#if $currentScreen === 'studyTemple'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <StudyTempleScreen
        onback={handleBackToDeckHub}
        onStartRun={handleDungeonRunStart}
      />
    </div>
  {/if}

  {#if $currentScreen === 'proceduralStudy'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <ProceduralStudyScreen
        deckId={proceduralDeckId}
        subDeckId={proceduralSubDeckId}
        onBack={() => transitionScreen('studyTemple')}
      />
    </div>
  {/if}

  {#if $currentScreen === 'runPreview'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <RunPreviewScreen
        onShuffle={handleRunPreviewShuffle}
        onBeginExpedition={handleRunPreviewBeginExpedition}
      />
    </div>
  {/if}

  {#if $currentScreen === 'profile'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <ProfileScreen onBack={handleBackToMenu} />
    </div>
  {/if}

  {#if $currentScreen === 'journal'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <JournalScreen summary={$lastRunSummary} onBack={handleBackToMenu} />
    </div>
  {/if}

  {#if $currentScreen === 'leaderboards'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <LeaderboardsScreen onBack={handleBackToMenu} />
    </div>
  {/if}

  {#if $currentScreen === 'multiplayerMenu'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <MultiplayerMenu
        onBack={() => transitionScreen('hub')}
        onCreateLobby={handleCreateLobby}
        onJoinLobby={handleJoinLobby}
      />
    </div>
  {/if}

  {#if $currentScreen === 'multiplayerLobby' && currentLobby}
    <div in:fly={{ y: 8, duration: 350 }}>
      <MultiplayerLobby
        lobby={currentLobby}
        localPlayerId="local_player"
        onBack={handleMultiplayerBack}
      />
    </div>
  {/if}

  {#if $currentScreen === 'social'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <SocialScreen
        onBack={handleBackToMenu}
        onOpenSettings={handleOpenSettings}
        onStartDailyExpedition={handleStartDailyExpedition}
        onStartEndlessDepths={handleStartEndlessDepths}
        onStartScholarChallenge={handleStartScholarChallenge}
        onOpenRelicSanctum={handleOpenRelicSanctum}
        onOpenArcanePass={handleOpenArcanePass}
        onOpenSeasonPass={handleOpenSeasonPass}
        onOpenCosmeticStore={handleOpenCosmeticStore}
      />
    </div>
  {/if}

  {#if $currentScreen === 'relicSanctum'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <RelicCollectionScreen onBack={handleCloseRelicSanctum} />
    </div>
  {/if}

  {#if $currentScreen === 'relicSwapOverlay' && swapOfferedRelic}
    <div in:fly={{ y: 8, duration: 350 }}>
      <RelicSwapOverlay
        offeredRelic={swapOfferedRelic}
        equippedRelics={swapEquippedRelics}
        slotLabel={swapSlotLabel}
        onSellAndAcquire={handleSwapSellAndAcquire}
        onPass={handleSwapPass}
      />
    </div>
  {/if}

  {#if $activeRelicPickup}
    <RelicPickupToast
      relic={$activeRelicPickup}
      ondismiss={() => activeRelicPickup.set(null)}
      onswap={$activeRunState && isRelicSlotsFull($activeRunState.runRelics) ? handleRelicPickupSwap : undefined}
    />
  {/if}

  {#if showArcanePassModal}
    {#await loadRoguePassModal() then module}
      {@const RoguePassModalView = module.default}
      <RoguePassModalView onClose={() => { showArcanePassModal = false }} />
    {/await}
  {/if}

  {#if showSeasonPassModal}
    {#await loadSeasonPassView() then module}
      {@const SeasonPassViewModal = module.default}
      <SeasonPassViewModal onClose={() => { showSeasonPassModal = false }} />
    {/await}
  {/if}

  {#if showCosmeticStoreModal}
    {#await loadCosmeticStoreModal() then module}
      {@const CosmeticStoreModalView = module.default}
      <CosmeticStoreModalView onClose={() => { showCosmeticStoreModal = false }} />
    {/await}
  {/if}

  {#if gainedFactText}
    <div class="fact-gained-toast" role="status">
      <div class="toast-header">New Fact Acquired</div>
      <div class="toast-text">{gainedFactText}</div>
    </div>
  {/if}

  {#if $rewardCardDetail}
    {@const callbacks = getCardDetailCallbacks()}
    {#if callbacks}
      <RewardCardDetail
        card={$rewardCardDetail}
        onaccept={callbacks.onAccept}
        onreject={callbacks.onReject}
      />
    {/if}
  {/if}

  {#if $narrativeDisplay.active}
    <NarrativeOverlay
      lines={$narrativeDisplay.lines}
      mode={$narrativeDisplay.mode}
      onDismiss={dismissNarrative}
    />
  {/if}

  <!-- Screen transition overlay -->
  <div
    class="screen-transition"
    class:loading={$screenTransitionLoading}
    class:active={$screenTransitionActive}
    class:wipe-down={$screenTransitionDirection === 'down'}
    class:wipe-up={$screenTransitionDirection === 'up'}
    class:wipe-left={$screenTransitionDirection === 'left'}
    class:wipe-right={$screenTransitionDirection === 'right'}
    class:wipe-zoom={$screenTransitionDirection === 'zoom'}
  >
    <div class="loading-dots" aria-label="Loading">
      <span></span><span></span><span></span>
    </div>
  </div>
</div>

<style>
  .card-app {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: min(100vw, calc(100vh * 571 / 1024)); /* GAME_ASPECT_RATIO: 9/16 ≈ 0.5625, legacy: 571/1024 ≈ 0.5576 */
    background: #0d1117;
    overflow: hidden;
    --run-viewport-top: 0px;
  }

  /* Landscape: expand .card-app to fill the full viewport — remove portrait column constraints.
     All landscape screens use position:fixed so they already escape any parent, but this ensures
     the container background, Phaser canvas, and non-fixed children span the full viewport. */
  .card-app[data-layout="landscape"] {
    left: 0;
    transform: none;
    width: 100vw;
    overflow: visible;
    --topbar-height: max(28px, 4.5vh);
    --run-viewport-top: var(--topbar-height, 0px);
  }

  /* Suppress the portrait-mode side-curtain gradients in landscape — they would overlay the hub. */
  .card-app[data-layout="landscape"]::before,
  .card-app[data-layout="landscape"]::after {
    display: none !important;
  }

  @media (min-width: 450px) {
    .card-app::before,
    .card-app::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 30px;
      z-index: 10000;
      pointer-events: none;
    }

    .card-app::before {
      left: 0;
      background: linear-gradient(to right, rgba(0, 0, 0, 0.5), transparent);
    }

    .card-app::after {
      right: 0;
      background: linear-gradient(to left, rgba(0, 0, 0, 0.5), transparent);
    }
  }

  .phaser-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    visibility: hidden;
    pointer-events: none;
  }

  .phaser-container.visible {
    visibility: visible;
    pointer-events: auto;
    z-index: 1;
    opacity: 1;
  }

  .phaser-container.boot-anim-active {
    z-index: 9999;
    max-width: none;
    width: 100vw;
  }

  /* Stretch Phaser canvas to fill viewport (no letterbox bars) */
  .phaser-container.visible :global(canvas) {
    object-fit: cover !important;
    width: 100vw !important;
    height: 100dvh !important;
  }

  /* Landscape: canvas fills full viewport — topbar overlays on top (z-index 200) */
  [data-layout="landscape"] .phaser-container.visible {
    top: 0;
    height: 100dvh;
  }

  [data-layout="landscape"] .phaser-container.visible :global(canvas) {
    height: 100dvh !important;
  }

  .hub-wrapper {
    display: contents;
  }

  .hub-wrapper.no-interact {
    display: block;
    pointer-events: none;
  }

  .hub-wrapper.boot-hidden {
    visibility: hidden;
  }

  .hidden-during-boot {
    display: none !important;
  }

  .card-app.boot-bg-black {
    background: #000 !important;
  }

  .card-app.boot-bg-clear {
    background: transparent !important;
  }

  .hub-wrapper.blurred {
    filter: blur(10px) brightness(0.4);
    transition: filter 1s ease-out;
  }

  .hub-wrapper.deblurring {
    filter: blur(0px) brightness(1);
  }

  .pause-btn {
    position: fixed;
    top: calc(8px * var(--layout-scale, 1) + var(--safe-top));
    right: max(calc(8px * var(--layout-scale, 1)), calc(8px + var(--safe-right, 0px)));
    width: calc(36px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.85);
    color: #cbd5e1;
    font-size: calc(14px * var(--layout-scale, 1));
    font-family: monospace;
    font-weight: 700;
    z-index: 150;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 2px;
  }

  .pause-icon {
    display: flex;
    gap: calc(3px * var(--layout-scale, 1));
    align-items: center;
    justify-content: center;
  }
  .pause-icon::before,
  .pause-icon::after {
    content: '';
    width: calc(3px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    background: currentColor;
    border-radius: 1px;
  }

  [data-layout="landscape"] .pause-btn {
    display: none;
  }

  [data-layout="landscape"] .active-run-banner {
    margin-top: 0;
    left: 0;
  }

  .active-run-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 250;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    margin-top: max(4px, var(--safe-top, 0px));
    padding-top: calc(10px * var(--layout-scale, 1));
    padding-bottom: calc(10px * var(--layout-scale, 1));
    padding-left: calc(16px * var(--layout-scale, 1));
    padding-right: calc(16px * var(--layout-scale, 1));
    margin-bottom: calc(8px * var(--layout-scale, 1));
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.08));
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
  }

  .banner-label {
    font-size: calc(11px * var(--text-scale, 1));
    opacity: 0.8;
  }

  .banner-buttons {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    justify-content: center;
  }

  .banner-resume-btn {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid #f59e0b;
    background: linear-gradient(180deg, #2f7a35, #1f5c28);
    color: #f8fafc;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
  }

  .banner-abandon-btn {
    min-height: 44px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(30, 41, 59, 0.75);
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
  }

  .abandon-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
  }

  .abandon-confirm-modal {
    background: #1a1a2e;
    border: 2px solid #e74c3c;
    border-radius: 12px;
    padding: calc(24px * var(--layout-scale, 1));
    max-width: calc(320px * var(--layout-scale, 1));
    width: 90%;
    text-align: center;
  }

  .abandon-confirm-modal h3 {
    color: #e74c3c;
    margin: 0 0 16px;
    font-size: 20px;
  }

  .abandon-run-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }

  .abandon-stat {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: 18px;
    font-weight: bold;
    color: #f1c40f;
  }

  .abandon-warning {
    color: #e74c3c;
    font-weight: bold;
    margin: 12px 0;
    font-size: 14px;
  }

  .outside-due-text {
    color: #e2e8f0;
    margin: 10px 0 6px;
    font-size: 14px;
  }

  .outside-due-count {
    color: #fbbf24;
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
  }

  .abandon-confirm-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 16px;
  }

  .abandon-btn-cancel {
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid #64748b;
    background: transparent;
    color: #e2e8f0;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    flex: 1;
    text-align: center;
  }

  .abandon-btn-confirm {
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(8px * var(--layout-scale, 1));
    border: none;
    background: #e74c3c;
    color: white;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: bold;
    cursor: pointer;
    flex: 1;
    text-align: center;
  }

  .run-guard-modal {
    border-color: #3b82f6;
  }

  .run-guard-title {
    color: #60a5fa;
    margin: 0 0 16px;
    font-size: 20px;
  }

  .run-guard-btn-continue {
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: #16a34a;
    color: white;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  }

  .run-guard-btn-abandon {
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid #e74c3c;
    background: transparent;
    color: #e74c3c;
    font-size: 14px;
    cursor: pointer;
  }

  .fact-gained-toast {
    position: fixed;
    bottom: calc(100px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    width: min(340px, calc(100vw - 32px));
    background: linear-gradient(180deg, #1a2332, #0f1923);
    border: 1px solid rgba(99, 179, 237, 0.4);
    border-radius: 12px;
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    z-index: 500;
    animation: toast-in 0.3s ease-out;
  }

  .toast-header {
    font-size: 12px;
    font-weight: 700;
    color: #63b3ed;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .toast-text {
    font-size: 13px;
    color: #e2e8f0;
    line-height: 1.4;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .screen-transition {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: #0a0e18;
    opacity: 0;
    pointer-events: none;
  }

  .screen-transition.active {
    pointer-events: none;
  }

  .screen-transition.loading {
    opacity: 1;
    pointer-events: all;
    animation: none;
  }

  .loading-dots {
    position: absolute;
    bottom: 40%;
    left: 50%;
    transform: translateX(-50%);
    display: none;
    gap: 8px;
  }

  .screen-transition.loading .loading-dots {
    display: flex;
  }

  .loading-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(148, 163, 184, 0.5);
    animation: loadingPulse 1.2s ease-in-out infinite;
  }

  .loading-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes loadingPulse {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1.2); }
  }

  .screen-transition.active:not(.wipe-down):not(.wipe-up):not(.wipe-left):not(.wipe-right):not(.wipe-zoom) {
    animation: revealFade 400ms ease-out forwards;
  }

  .screen-transition.active.wipe-down {
    animation: revealDown 400ms ease-in-out forwards;
  }

  .screen-transition.active.wipe-up {
    animation: revealUp 400ms ease-in-out forwards;
  }

  .screen-transition.active.wipe-left {
    animation: revealLeft 400ms ease-in-out forwards;
  }

  .screen-transition.active.wipe-right {
    animation: revealRight 400ms ease-in-out forwards;
  }

  .screen-transition.active.wipe-zoom {
    animation: revealZoomIn 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes revealFade {
    0% { opacity: 1; }
    30% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes revealDown {
    0% { clip-path: inset(0 0 0 0); opacity: 1; }
    85% { clip-path: inset(100% 0 0 0); opacity: 1; }
    100% { clip-path: inset(100% 0 0 0); opacity: 0; }
  }

  @keyframes revealUp {
    0% { clip-path: inset(0 0 0 0); opacity: 1; }
    85% { clip-path: inset(0 0 100% 0); opacity: 1; }
    100% { clip-path: inset(0 0 100% 0); opacity: 0; }
  }

  @keyframes revealLeft {
    0% { clip-path: inset(0 0 0 0); opacity: 1; }
    85% { clip-path: inset(0 100% 0 0); opacity: 1; }
    100% { clip-path: inset(0 100% 0 0); opacity: 0; }
  }

  @keyframes revealRight {
    0% { clip-path: inset(0 0 0 0); opacity: 1; }
    85% { clip-path: inset(0 0 0 100%); opacity: 1; }
    100% { clip-path: inset(0 0 0 100%); opacity: 0; }
  }

  @keyframes revealZoomIn {
    0% {
      opacity: 1;
      transform: scale(1);
      filter: blur(0px);
    }
    30% {
      opacity: 0.9;
      transform: scale(1.3);
      filter: blur(1px);
    }
    60% {
      opacity: 0.5;
      transform: scale(2.0);
      filter: blur(3px);
    }
    100% {
      opacity: 0;
      transform: scale(3.0);
      filter: blur(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .screen-transition.active,
    .screen-transition.active.wipe-down,
    .screen-transition.active.wipe-up,
    .screen-transition.active.wipe-left,
    .screen-transition.active.wipe-right,
    .screen-transition.active.wipe-zoom {
      animation: revealFade 400ms ease-out forwards;
    }
  }

  /* ═══ LANDSCAPE DESKTOP OVERRIDES ═══════════════════════════════════════════ */

  /* F-16: hover states moved to desktop.css (unscoped) */

  /* Dev-only: skip encounter button (only shown in import.meta.env.DEV builds) */
  .dev-skip-btn {
    position: fixed;
    top: calc(var(--topbar-height, 4.5vh) + 0.5vh + clamp(36px, 4vw, 52px) + calc(8px * var(--layout-scale, 1)));
    right: 1vw;
    z-index: 201;
    background: rgba(255, 50, 50, 0.8);
    color: white;
    border: none;
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    font-family: inherit;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dev-skip-btn:hover {
    background: rgba(255, 50, 50, 1);
  }

</style>
