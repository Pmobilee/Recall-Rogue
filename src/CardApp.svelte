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
    dismissScreenTransition,
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
    pendingStudyUpgrade,
    onStudyUpgradeConfirmed,
    pendingTransformOptions,
    onShopTransform,
    onShopTransformChoice,
    activeCardUpgradeReveal,
    onCardUpgradeRevealDismissed,
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
  import { authStore } from './ui/stores/authStore'
  import { devMode } from './ui/stores/devMode'
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
  import { restoreRunRngState } from './services/seededRng'
  import { getLanguageCodeForDeck } from './services/deckOptionsService'
  import { isTurboMode } from './utils/turboMode'
  import { setWindowResolution } from './services/fullscreenService'

  import ArchetypeSelection from './ui/components/ArchetypeSelection.svelte'
  import CardCombatOverlay from './ui/components/CardCombatOverlay.svelte'
  import MysteryEventOverlay from './ui/components/MysteryEventOverlay.svelte'
  import MasteryChallengeOverlay from './ui/components/MasteryChallengeOverlay.svelte'
  import RestRoomOverlay from './ui/components/RestRoomOverlay.svelte'
  import StudyQuizOverlay from './ui/components/StudyQuizOverlay.svelte'
  import MeditateOverlay from './ui/components/MeditateOverlay.svelte'
  import RunEndScreen from './ui/components/RunEndScreen.svelte'
  import RetreatOrDelve from './ui/components/RetreatOrDelve.svelte'
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
  import RelicCollectionScreen from './ui/components/RelicCollectionScreen.svelte'
  import RelicSwapOverlay from './ui/components/RelicSwapOverlay.svelte'
  import RelicPickupToast from './ui/components/RelicPickupToast.svelte'
  import UpgradeSelectionOverlay from './ui/components/UpgradeSelectionOverlay.svelte'
  import PostMiniBossRestOverlay from './ui/components/PostMiniBossRestOverlay.svelte'
  import CardPickerOverlay from './ui/components/CardPickerOverlay.svelte'
  import CardUpgradeRevealOverlay from './ui/components/CardUpgradeRevealOverlay.svelte'
  import DungeonMap from './ui/components/DungeonMap.svelte'
  // StarterRelicSelection removed in AR-59.12 — file kept as dead code pending deletion approval
  import DeckSelectionHub from './ui/components/DeckSelectionHub.svelte'
  import TriviaDungeonScreen from './ui/components/TriviaDungeonScreen.svelte'
  import StudyTempleScreen from './ui/components/StudyTempleScreen.svelte'
import ProceduralStudyScreen from './ui/components/ProceduralStudyScreen.svelte'
  import RunPreviewScreen from './ui/components/RunPreviewScreen.svelte'
  import RewardCardDetail from './ui/components/RewardCardDetail.svelte'
  import { rewardCardDetail, getCardDetailCallbacks } from './services/rewardRoomBridge'
  import RewardRoomOverlay from './ui/components/RewardRoomOverlay.svelte'
  import { updateRichPresence } from './services/steamService'
  import { getLocalPersonaName } from './services/steamNetworkingService'
  import { getCombatBgForEnemy, getCombatDepthMap } from './data/backgroundManifest'
  import ParallaxTransition from './ui/components/ParallaxTransition.svelte'
  import InRunTopBar from './ui/components/InRunTopBar.svelte'
  import RunDeckOverlay from './ui/components/RunDeckOverlay.svelte'
  import { runDeckOverlayOpen } from './ui/stores/runDeckOverlayStore'
  import MusicWidget from './ui/components/MusicWidget.svelte'
  import NarrativeOverlay from './ui/components/NarrativeOverlay.svelte'
  import TutorialCoachMark from './ui/components/TutorialCoachMark.svelte'
  import {
    tutorialActive,
    tutorialMessage,
    tutorialAnchor,
    tutorialSpotlight,
    tutorialBlocksInput,
    advanceStep,
    skipTutorial,
    startTutorial,
    isTutorialActive,
  } from './services/tutorialService' 
  import { musicService } from './services/musicService'
  import { rrLog } from './services/rrLog'
  import { ambientAudio } from './services/ambientAudioService'
  import { quizPanelVisible } from './ui/stores/combatUiStore'
  import { getAuraLevel, getAuraState } from './services/knowledgeAuraSystem'
  import { narrativeDisplay, dismissNarrative } from './ui/stores/narrativeStore'
  import MultiplayerLobby from './ui/components/MultiplayerLobby.svelte'
  import MultiplayerHUD from './ui/components/MultiplayerHUD.svelte'
  import MultiplayerMenu from './ui/components/MultiplayerMenu.svelte'
  import LobbyBrowserScreen from './ui/components/LobbyBrowserScreen.svelte'
  import TriviaRoundScreen from './ui/components/TriviaRoundScreen.svelte'
  import RaceResultsScreen from './ui/components/RaceResultsScreen.svelte'
  import PlayerRosterPanel from './ui/components/PlayerRosterPanel.svelte'
  import DuelOpponentPanel from './ui/components/DuelOpponentPanel.svelte'
  import { setMpDebugState } from './services/mpDebugState'
  import {
    createLobby,
    joinLobby,
    joinLobbyById,
    leaveLobby,
    getCurrentLobby,
    onLobbyUpdate,
    onGameStart as registerGameStartCb,
    generatePlayerId,
    isHost as mpIsHost,
  } from './services/multiplayerLobbyService'
  import { onOpponentProgressUpdate, onRaceComplete, initGameMessageHandlers, initDuel } from './services/multiplayerGameService'
  import {
    initMapNodeSync,
    destroyMapNodeSync,
    pickMapNode,
    resetMapNodePicks,
    onMapNodeConsensus,
    onMapNodePicksChanged,
  } from './services/multiplayerMapSync'
  import {
    initCoopSync,
    destroyCoopSync,
    onPartnerStateUpdate,
    onPartnerUnresponsive,
    broadcastPartnerState,
    type PartnerState,
  } from './services/multiplayerCoopSync'
  import type { LobbyState, RaceProgress, RaceResults, MultiplayerMode, LobbyContentSelection, LobbyVisibility } from './data/multiplayerTypes'
  import { computeRaceScore } from './services/multiplayerScoring'
  import { initTriviaGame, initTriviaMessageHandlers, destroyTriviaGame, DEFAULT_ROUNDS, getTriviaState, onTriviaStateChange, onTriviaRoundResult, submitAnswer } from './services/triviaNightService'
  import type { TriviaGameState, TriviaQuestion, TriviaRoundResult } from './services/triviaNightService'

  // Update Steam Rich Presence whenever the active screen changes.
  $effect(() => {
    updateRichPresence($currentScreen)
  })

  /**
   * Pause Phaser's RAF loop on non-Phaser screens (2026-04-20).
   *
   * The Phaser canvas is hidden via `visibility: hidden` (NOT display:none) on
   * the hub so it stays mounted for fast re-entry into combat. But Phaser's
   * game loop keeps ticking 60fps update + WebGL render to the hidden canvas
   * unless we explicitly sleep it. Safari's compositor handles a hidden
   * WebGL canvas for free; Chrome's does not — it costs 30–50% of frame
   * budget on the hub even though the canvas isn't visible.
   *
   * `game.loop.sleep()` halts the loop entirely; `wake()` resumes it. We sleep
   * whenever the phaser-container is not in its `.visible` state (matching the
   * CSS class predicate used in the markup).
   */
  $effect(() => {
    const screen = $currentScreen
    const phaserVisible = showBootAnimation || screen === 'combat' || screen === 'rewardRoom'
    if (!phaserBooted) return
    void import('./game/CardGameManager').then(({ CardGameManager }) => {
      const game = CardGameManager.getInstance().getGame()
      if (!game?.loop) return
      if (phaserVisible) game.loop.wake()
      else game.loop.sleep()
    })
  })

  // Auto-trigger combat tutorial on first-ever combat encounter.
  // Suppressed during multiplayer runs: the tutorial pauses turn flow for the
  // local player and makes no sense alongside a peer who's also being tutorialed.
  $effect(() => {
    const screen = $currentScreen
    if (isTutorialActive()) return  // Don't restart if already running
    if (currentLobby !== null) return  // Never tutorial during an MP session
    const state = get(onboardingState)
    if (screen === 'combat' && state.runsCompleted === 0 && !state.hasSeenCombatTutorial && !state.tutorialDismissedEarly) {
      startTutorial('combat')
    }
  })

  // Auto-trigger study tutorial on first-ever study session.
  // Same MP suppression as combat tutorial above.
  $effect(() => {
    const screen = $currentScreen
    if (isTutorialActive()) return  // Don't restart if already running
    if (currentLobby !== null) return  // Never tutorial during an MP session
    const state = get(onboardingState)
    if (screen === 'restStudy' && !state.hasSeenStudyTutorial && !state.tutorialDismissedEarly) {
      startTutorial('study')
    }
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
    shuffleSeedOffset = 0
  }

  function handleRunPreviewBack(): void {
    shuffleSeedOffset = 0
    abandonActiveRun('studyTemple')
  }


  function handleGuardContinue(): void {
    showRunGuardPopup = false
    guardRunStats = null
    handleResumeActiveRun()
  }

  function handleGuardAbandon(): void {
    showRunGuardPopup = false
    guardRunStats = null
    abandonActiveRun()
    hasRunSave = false
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
          dismissScreenTransition()
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
  /** True when combat has ended and we're waiting for the player to click the doorway. */
  let combatExitWaiting = $state(false)
  /** Tracks 5-second timeout ID for doorway hint display. */
  let doorwayHintTimer = $state<ReturnType<typeof setTimeout> | null>(null)
  /** True after 5 seconds of waiting — shows the hint message. */
  let doorwayHintVisible = $state(false)

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

  /**
   * C2: The local player's resolved display name — Steam persona name when available,
   * falling back to auth profile name. Populated in onMount.
   */
  let localDisplayName = $state($authStore.displayName ?? $authStore.email ?? 'Player')

  /** Unique player ID for this tab session (stable across lobby create/join). */
  const localPlayerId = generatePlayerId()

  /** True while an active multiplayer lobby exists (race progress HUD visible in combat). */
  let isMultiplayerRun = $derived(currentLobby !== null)

  /** True for modes with more than 2 max players (trivia_night, race with 3-4). Roster panel replaces MultiplayerHUD. */
  let isManyPlayerMode = $derived(currentLobby !== null && (currentLobby.mode === 'trivia_night' || currentLobby.maxPlayers > 2))

  /** Whether the PlayerRosterPanel overlay is open. */
  let rosterPanelOpen = $state(false)

  /** Live partner states for the roster panel. */
  let partnerStates = $state<Record<string, import('./services/multiplayerCoopSync').PartnerState>>({})

  /** Race/duel results received from onRaceComplete — shown on raceResults screen. */
  let activeRaceResults = $state<RaceResults | null>(null)

  /**
   * MP-STEAM-20260422-009: Sync-health pill / banner state.
   * Surfaces a transient banner when a coop partner stops sending heartbeats so
   * the player has an in-game signal that sync is failing — the previous design
   * routed everything to debug.log on disk, which a Steam player can't see.
   */
  let syncHealthBanner = $state<string | null>(null)
  let _syncHealthBannerTimer: ReturnType<typeof setTimeout> | null = null
  function showSyncHealthBanner(message: string, durationMs = 6000): void {
    syncHealthBanner = message
    if (_syncHealthBannerTimer) clearTimeout(_syncHealthBannerTimer)
    _syncHealthBannerTimer = setTimeout(() => {
      syncHealthBanner = null
      _syncHealthBannerTimer = null
    }, durationMs)
  }

  /**
   * Cleanup function for initGameMessageHandlers, stored across the game-start callback.
   * Called on run end (destroyCoopSync path). Module-scoped so the effect cleanup can reach it.
   */
  let _pendingGameMessageCleanup: (() => void) | null = null

  /**
   * Cleanup function for initTriviaMessageHandlers (trivia_night mode only).
   * Module-scoped so the $effect cleanup can reach it alongside _pendingGameMessageCleanup.
   */
  let _pendingTriviaCleanup: (() => void) | null = null

  // L-028 / H-015: Live trivia state for TriviaRoundScreen.
  // Seeded by onTriviaStateChange subscription below; null before trivia_night mode starts.
  let _triviaGameState = $state<TriviaGameState | null>(null)
  let _triviaCurrentQuestion = $state<TriviaQuestion | null>(null)
  let _triviaLastRoundResult = $state<TriviaRoundResult | null>(null)

  /** Live map node picks across all players, refreshed via multiplayerMapSync. */
  let mapNodePicks = $state<Record<string, string | null>>({})

  /** Non-null when a lobby entry call (create/join) fails — shown as a banner in multiplayerMenu. */
  let multiplayerError = $state<string | null>(null)

  /** Stable distinct colors per player slot used for the map node pick badges. */
  const PLAYER_PICK_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'] as const

  /** Derived: nodeId → list of players who've picked that node (for DungeonMap). */
  let nodePickIndicators = $derived.by(() => {
    const out: Record<string, Array<{ playerId: string; initial: string; color: string }>> = {}
    if (!currentLobby) return out
    const players = currentLobby.players
    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      const picked = mapNodePicks[p.id]
      if (!picked) continue
      const initial = (p.displayName || p.id).charAt(0).toUpperCase()
      const color = PLAYER_PICK_COLORS[i % PLAYER_PICK_COLORS.length]
      if (!out[picked]) out[picked] = []
      out[picked].push({ playerId: p.id, initial, color })
    }
    return out
  })

  // Live co-op partner state broadcast: whenever activeRunState or activeTurnState changes
  // while in co-op mode, broadcast our current HP/block/score/accuracy to the partner so
  // their HUD reflects mid-turn changes (not just at turn-end).
  $effect(() => {
    if (currentLobby?.mode !== 'coop') return
    const run = $activeRunState
    if (!run) return
    const turn = $activeTurnState
    const block = turn?.playerState?.shield ?? 0
    const score = computeRaceScore(run)
    const accuracy = run.factsAnswered > 0 ? run.factsCorrect / run.factsAnswered : 1
    broadcastPartnerState({
      hp: run.playerHp,
      maxHp: run.playerMaxHp,
      block,
      score,
      accuracy,
    })
  })

  function handleOpenMultiplayer(): void {
    // Navigate to the multiplayer menu for mode selection before creating a lobby.
    multiplayerError = null
    transitionScreen('multiplayerMenu')
  }

  function handleMultiplayerBack(): void {
    if (currentLobby) {
      try {
        leaveLobby()
      } catch (err) {
        console.warn('[CardApp] leaveLobby failed during back navigation:', err)
      }
      currentLobby = null
      activeRaceResults = null
      transitionScreen('multiplayerMenu')
    } else {
      transitionScreen('hub')
    }
  }

  /**
   * C2: Resolve the best available display name for the local player.
   * Tries Steam persona name first (works on Tauri/Steam builds), falls back
   * to the auth profile display name, then a generic fallback.
   */
  async function getLocalDisplayName(): Promise<string> {
    const steamName = await getLocalPersonaName()
    if (steamName && steamName.trim()) return steamName.trim()
    return $authStore.displayName ?? 'Player'
  }

  async function handleCreateLobby(mode: MultiplayerMode, opts: { visibility: LobbyVisibility; password?: string }): Promise<void> {
    multiplayerError = null
    try {
      const displayName = await getLocalDisplayName()
      const lobby = await createLobby(localPlayerId, displayName, mode, opts)
      currentLobby = lobby
      transitionScreen('multiplayerLobby')
    } catch (error) {
      console.error('[CardApp] createLobby failed:', error)
      const detail = error instanceof Error ? error.message : String(error)
      multiplayerError = `Couldn't create lobby. ${detail}`
    }
  }

  async function handleJoinLobby(code: string): Promise<void> {
    multiplayerError = null
    try {
      const displayName = await getLocalDisplayName()
      const lobby = await joinLobby(code, localPlayerId, displayName)
      currentLobby = lobby
      transitionScreen('multiplayerLobby')
    } catch (error) {
      console.error('[CardApp] joinLobby failed:', error)
      const detail = error instanceof Error ? error.message : String(error)
      multiplayerError = `Couldn't join that lobby. ${detail}`
    }
  }

  function handleBrowseLobbies(): void {
    multiplayerError = null
    transitionScreen('lobbyBrowser')
  }

  function handleLobbyJoined(lobby: LobbyState): void {
    currentLobby = lobby
    transitionScreen('multiplayerLobby')
  }

  // Keep currentLobby in sync when the lobby service updates state (other players join/leave).
  // Shallow-spread on every update so Svelte sees a new object reference and re-fires
  // all `$derived` computations downstream (amHost, canStart, etc.). Without the spread,
  // the service mutates _currentLobby in-place, notifyLobbyUpdate hands back the same
  // reference, and Svelte's `$state` skips the change — UI looks frozen. Deck selection
  // was the visible symptom: setContentSelection mutated contentSelection, notified,
  // but CardApp saw the same ref and MultiplayerLobby never re-rendered.
  $effect(() => {
    const unsub = onLobbyUpdate((lobby) => {
      rrLog('mp:ui:cardapp', 'onLobbyUpdate', {
        beforeContentType: currentLobby?.contentSelection?.type,
        afterContentType: lobby?.contentSelection?.type,
        afterDecks: lobby?.contentSelection && 'decks' in lobby.contentSelection
          ? (lobby.contentSelection as { decks?: unknown[] }).decks?.length
          : undefined,
      })
      // Explicit spread of contentSelection so Svelte's $state proxy detects
      // nested changes (shallow spread alone misses mutations inside the object).
      currentLobby = lobby
        ? {
            ...lobby,
            players: [...lobby.players],
            contentSelection: lobby.contentSelection ? { ...lobby.contentSelection } : undefined,
          }
        : null
      // Publish to window.__rrMpState for console/devtools inspection (MpDebugOverlay removed).
      if (lobby) {
        setMpDebugState({
          lobby: {
            id: lobby.lobbyId,
            code: lobby.lobbyCode,
            mode: lobby.mode,
            deckSelectionMode: lobby.deckSelectionMode,
            playerCount: lobby.players.length,
            contentSelectionType: lobby.contentSelection?.type ?? null,
            contentDecksLength: lobby.contentSelection && 'decks' in lobby.contentSelection
              ? ((lobby.contentSelection as { decks?: unknown[] }).decks?.length ?? null)
              : null,
          },
        })
      } else {
        setMpDebugState({ lobby: null })
      }
    })
    return unsub
  })

  // Clean up lobby state when navigating away from multiplayer.
  //
  // MP-STEAM-20260422-008 (polarity inversion): the previous design hand-enumerated
  // every in-run screen (gameScreens). Adding a new in-run screen meant remembering
  // to extend the allowlist; forgetting silently nuked the lobby mid-run (BUG 27,
  // commit 61a60edd9). Inverted now: list the screens that should TEAR DOWN the
  // lobby (hub-side + multiplayerMenu re-entry) and treat every other screen as
  // "stay in lobby". Adding a new in-run screen no longer requires touching this.
  //
  // MP-003 also lives here: multiplayerMenu is treated as "outside the lobby" so
  // navigating back to the mode-select screen (e.g. via the menu's back button or
  // an rrPlay scenario) clears the previous lobby instead of silently auto-rejoining.
  // multiplayerLobby, lobbyBrowser, and raceResults are LOBBY-SCOPED screens — those
  // preserve currentLobby. Everything else (every in-run screen, every overlay) is
  // implicitly preserved too.
  $effect(() => {
    const screen = $currentScreen
    // Screens that explicitly destroy the lobby on entry. Anything outside this
    // set keeps currentLobby intact. Typed against Screen so a renamed entry
    // fails to compile.
    const lobbyTerminatingScreens: Set<Screen> = new Set<Screen>([
      'hub',
      'mainMenu',
      'base',
      'library',
      'settings',
      'profile',
      'journal',
      'leaderboards',
      'relicSanctum',
      'deckSelectionHub',
      'triviaDungeon',
      'studyTemple',
      'multiplayerMenu', // MP-003: returning to mode select means "I'm done with this lobby"
    ])

    if (lobbyTerminatingScreens.has(screen) && currentLobby) {
      try {
        leaveLobby()
      } catch (err) {
        console.warn('[CardApp] leaveLobby failed during screen navigation cleanup:', err)
      }
      currentLobby = null
      activeRaceResults = null
    }
  })

  // MP-STEAM-20260422-065: warn if currentLobby goes null while we're sitting in an
  // in-run screen. That should NEVER happen with the inverted polarity above — only
  // explicit lobby-terminating screens null the lobby. If we observe a transient null
  // here, MultiplayerHUD / PlayerRosterPanel will unmount and remount, losing local
  // state. Surface it loudly so we can find the culprit.
  $effect(() => {
    const screen = $currentScreen
    const inRunScreens: Set<Screen> = new Set<Screen>([
      'runPreview',
      'dungeonMap',
      'combat',
      'shopRoom',
      'restRoom',
      'restStudy',
      'restMeditate',
      'mysteryEvent',
      'rewardRoom',
      'cardReward',
      'cardUpgradeReveal',
      'retreatOrDelve',
      'specialEvent',
      'campfire',
      'masteryChallenge',
      'relicSwapOverlay',
      'upgradeSelection',
      'postMiniBossRest',
      'runEnd',
      'triviaRound',
    ])
    if (inRunScreens.has(screen) && currentLobby === null) {
      // The HUD will have just unmounted. Log loudly so we can attach a culprit.
      console.warn(
        '[CardApp] MP-STEAM-20260422-065: currentLobby is null while in an in-run screen',
        { screen, isMultiplayerRun, hint: 'HUD will remount when lobby returns' }
      )
    }
  })

  // Wire game start and live opponent progress for multiplayer races.
  $effect(() => {
    const unsubStart = registerGameStartCb((seed: number, lobby: LobbyState) => {
      const opponent = lobby.players.find(p => p.id !== localPlayerId)
      opponentDisplayName = opponent?.displayName ?? 'Opponent'

      // Guard: mode and contentSelection must be present before starting the run.
      // If either is missing the guest received mp:lobby:start before the host's
      // settings broadcast — proceeding would silently diverge host and guest onto
      // different card pools or game modes.
      //
      // NOTE: lobby.selectedDeckId is NOT required. It's a legacy field only set
      // for contentSelection.type === 'study' or 'custom_deck' (see
      // multiplayerLobbyService.ts:994). `study-multi` and `trivia` selections
      // leave it undefined and carry their data inside contentSelection itself.
      // Requiring it here blocked every study-multi coop lobby from starting —
      // the guard fired, redirected to the lobby, the H5 seed-ACK retried,
      // fired the callback again, looped forever. See 2026-04-23 gotcha.
      if (!lobby.mode || !lobby.contentSelection) {
        const missing: string[] = []
        if (!lobby.mode) missing.push('mode')
        if (!lobby.contentSelection) missing.push('contentSelection')
        console.error(
          '[Multiplayer] mp:lobby:start arrived with missing fields — aborting to prevent host/guest divergence.',
          { missing, lobby, seed, localPlayerId }
        )
        multiplayerError = `Could not start — missing: ${missing.join(', ')}. Returning to lobby.`
        transitionScreen('multiplayerLobby')
        return
      }

      // Set deck mode from lobby content selection so the run knows what content to load
      const sel: LobbyContentSelection = lobby.contentSelection
      if (sel.type === 'study') {
        playerSave.update(s => s ? { ...s, activeDeckMode: { type: 'study' as const, deckId: sel.deckId, subDeckId: sel.subDeckId } } : s)
      } else if (sel.type === 'trivia') {
        playerSave.update(s => s ? { ...s, activeDeckMode: { type: 'trivia' as const, domains: sel.domains, subdomains: sel.subdomains } } : s)
      } else if (sel.type === 'custom_deck') {
        // Load custom deck items from player's saved custom decks and map to run items
        const save = get(playerSave)
        const customDeck = save?.lastDungeonSelection?.customDecks?.find(d => d.id === sel.customDeckId)
        if (customDeck) {
          const items: CustomDeckRunItem[] = customDeck.items
            .filter((item): item is { type: 'study'; deckId: string; subDeckId?: string; label: string } => item.type === 'study')
            .map(item => ({ deckId: item.deckId, subDeckId: item.subDeckId }))
          playerSave.update(s => s ? { ...s, activeDeckMode: { type: 'custom_deck' as const, items } } : s)
        }
      } else if (sel.type === 'study-multi') {
        // DeckMode now has a native study-multi variant — wire it directly.
        // encounterBridge.ts builds a merged pool from both decks and trivia domains.
        playerSave.update(s => s ? {
          ...s,
          activeDeckMode: { type: 'study-multi' as const, decks: sel.decks, triviaDomains: sel.triviaDomains },
        } : s)
      }
      persistPlayer()

      // FIX C-001/C-002/MP-STEAM-20260422-002: Register ALL multiplayer subscriptions
      // BEFORE startNewRun so no host broadcast can land before listeners are live.
      // startNewRun -> onArchetypeSelected -> startEncounterForRoom -> broadcastSharedEnemyState
      // runs synchronously on host. Guest listeners must be installed first.

      // Determine host / opponent for duel/coop init
      const isLocalHost = mpIsHost()
      const opponentPlayer = lobby.players.find(p => p.id !== localPlayerId)
      const opponentId = opponentPlayer?.id ?? 'unknown_opponent'

      // Initialise map node consensus so both players must agree on the next room.
      initMapNodeSync(localPlayerId)

      // Initialise co-op turn-end barrier and partner HP heartbeat (coop only).
      if (lobby.mode === 'coop') {
        initCoopSync(localPlayerId)
      }

      // FIX C-001 / RC-001: Wire up transport message handlers for duel/coop/race game messages.
      // Race mode needs initGameMessageHandlers too — it registers mp:race:progress and
      // mp:race:finish listeners inside that function. startRaceProgressBroadcast handles
      // the local broadcast side; this registers the receive-side handlers.
      let cleanupGameMessages: (() => void) | null = null
      if (lobby.mode === 'coop' || lobby.mode === 'duel' || lobby.mode === 'race') {
        cleanupGameMessages = initGameMessageHandlers(lobby.mode)
      }

      // FIX C-002: Initialise duel state machine for coop and duel modes.
      // This must run before hostCreateSharedEnemy (called in encounterBridge on host side).
      if (lobby.mode === 'coop' || lobby.mode === 'duel') {
        initDuel(isLocalHost, localPlayerId, opponentId)
      }

      // FIX MP-STEAM-20260422-017: Initialise trivia game state and message handlers for
      // trivia_night mode. Without this both host and guest entered undefined _gameState,
      // causing every hostNextQuestion / submitAnswer call to silently no-op.
      if (lobby.mode === 'trivia_night') {
        const triviaPlayers = lobby.players.map(p => ({ id: p.id, displayName: p.displayName }))
        initTriviaGame(triviaPlayers, DEFAULT_ROUNDS, isLocalHost)
        _pendingTriviaCleanup = initTriviaMessageHandlers()
      }

      // Store cleanup in a module-level variable so the effect cleanup can call it.
      _pendingGameMessageCleanup = cleanupGameMessages

      startNewRun({
        multiplayerSeed: seed,
        multiplayerMode: lobby.mode,
      })
    })
    const unsubProgress = onOpponentProgressUpdate((progress: RaceProgress) => {
      opponentProgress = progress
    })
    const unsubPicks = onMapNodePicksChanged((picks) => {
      mapNodePicks = { ...picks }
    })
    const unsubConsensus = onMapNodeConsensus((nodeId) => {
      // Both players have agreed on this node — commit the selection locally.
      // Reset picks first so the badges clear before the room transition.
      resetMapNodePicks()
      void commitMapNodeSelection(nodeId)
    })
    const unsubPartner = onPartnerStateUpdate((states) => {
      // Update roster panel data for all partner states.
      partnerStates = { ...states }
      // FIX H-014: Only pipe partner HP into opponentProgress in coop mode.
      // In race mode there is no real partner state — unconditionally overwriting
      // opponentProgress would corrupt the race-progress HUD with stale/zero values.
      if (currentLobby?.mode !== 'coop') return
      // Pipe the first available partner's HP (and score/accuracy in co-op) into
      // opponentProgress so the existing MultiplayerHUD renders it during co-op combat.
      const ids = Object.keys(states)
      if (ids.length === 0) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const partner = states[ids[0]] as PartnerState & { score?: number; accuracy?: number }
      opponentProgress = {
        ...opponentProgress,
        playerId: partner.playerId,
        playerHp: partner.hp,
        playerMaxHp: partner.maxHp,
        playerBlock: partner.block,
        score: partner.score ?? opponentProgress.score,
        accuracy: partner.accuracy ?? opponentProgress.accuracy,
      }
    })
    const unsubRace = onRaceComplete((results) => {
      activeRaceResults = results
      currentScreen.set('raceResults')
    })
    // MP-STEAM-20260422-009: surface partner-unresponsive events as a player-visible
    // toast banner. The roster-panel HUD already shows partner HP, but a stalled
    // sync looked like "all is fine" until the user noticed score divergence.
    const unsubUnresponsive = onPartnerUnresponsive((playerId) => {
      const partner = currentLobby?.players.find(p => p.id === playerId)
      const name = partner?.displayName ?? 'A partner'
      showSyncHealthBanner(`${name} stopped responding. Sync is falling behind.`, 8000)
    })
    return () => {
      unsubStart()
      unsubProgress()
      unsubPicks()
      unsubConsensus()
      unsubPartner()
      unsubRace()
      unsubUnresponsive()
      destroyMapNodeSync()
      destroyCoopSync()
      // FIX C-001: clean up game message handlers registered at game start
      _pendingGameMessageCleanup?.()
      _pendingGameMessageCleanup = null
      // FIX MP-STEAM-20260422-017 / TN-001: clean up trivia message handlers for trivia_night.
      // destroyTriviaGame() clears all module-level Maps and callback refs so a second
      // trivia_night session in the same app lifetime starts from clean state.
      _pendingTriviaCleanup?.()
      _pendingTriviaCleanup = null
      destroyTriviaGame()
    }
  })

  // L-028 / H-015: Subscribe to trivia service state so TriviaRoundScreen receives live data.
  // This effect runs for the lifetime of the app. The subscription callbacks are no-ops when
  // _gameState is null (before initTriviaGame fires), so there is no risk of stale reads.
  $effect(() => {
    // Seed initial state in case the screen mounts after initTriviaGame has already run.
    const initial = getTriviaState()
    if (initial) _triviaGameState = initial

    const unsubState = onTriviaStateChange((state) => {
      _triviaGameState = state
      _triviaCurrentQuestion = state.currentQuestion
    })
    const unsubResult = onTriviaRoundResult((result) => {
      _triviaLastRoundResult = result
    })
    return () => {
      unsubState()
      unsubResult()
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

  /**
   * User clicked a map node. In single-player this commits immediately.
   * In multiplayer, this broadcasts a "pick" for consensus — the actual room
   * transition only happens when every player has picked the SAME node
   * (handled by the onMapNodeConsensus callback).
   */
  async function handleMapNodeSelect(nodeId: string): Promise<void> {
    if (mapNodeSelectionInProgress) return
    if (isMultiplayerRun) {
      // Multiplayer: broadcast pick, wait for consensus before committing.
      pickMapNode(nodeId)
      return
    }
    await commitMapNodeSelection(nodeId)
  }

  /** Run the actual map node selection + room transition (single-player path
   *  and the multiplayer consensus callback path both call this). */
  async function commitMapNodeSelection(nodeId: string): Promise<void> {
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
  let studyLanguageCode = $state<string | null>(null)
  let meditateCandidates = $state<import('./data/card-types').Card[]>([])

  // Pick up scenario-injected study questions when the screen switches to restStudy.
  // Always prefer scenario data over stale questions — the length===0 guard was removed
  // because re-spawning restStudy with a different deck left stale questions from the
  // first spawn (staleness bug found in BATCH-2026-04-13-001 grammar playtest).
  $effect(() => {
    if ($currentScreen === 'restStudy') {
      const sym = Symbol.for('rr:scenarioStudyQuestions')
      const langSym = Symbol.for('rr:scenarioStudyLanguage')
      const injected = (globalThis as any)[sym]
      if (Array.isArray(injected) && injected.length > 0) {
        studyQuestions = injected
        studyLanguageCode = (globalThis as any)[langSym] ?? null
        delete (globalThis as any)[sym]
        delete (globalThis as any)[langSym]
      }
    }
  })

  function handleRestStudy(): void {
    studyQuestions = generateStudyQuestions()
    // Derive language code from active deck mode so StudyQuizOverlay can use alwaysWrite
    const save = get(playerSave)
    const dm = save?.activeDeckMode
    if (dm?.type === 'study' && dm.deckId) {
      studyLanguageCode = getLanguageCodeForDeck(dm.deckId)
    } else if (dm?.type === 'preset' && dm.presetId) {
      studyLanguageCode = getLanguageCodeForDeck(dm.presetId)
    } else if (dm?.type === 'language') {
      studyLanguageCode = dm.languageCode
    } else {
      studyLanguageCode = null
    }
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
    studyLanguageCode = null
    onStudyComplete(correctFactIds)
  }

  // Accumulates cards selected in the study upgrade picker (multi-mode).
  // CardPickerOverlay.onselect is called once per card in multi mode (not as an array).
  // We buffer selections and flush them all to onStudyUpgradeConfirmed when the count is met.
  let studyUpgradeSelectionBuffer = $state<import('./data/card-types').Card[]>([])

  function handleStudyUpgradeSelect(card: import('./data/card-types').Card): void {
    const pending = get(pendingStudyUpgrade)
    const buffer = [...studyUpgradeSelectionBuffer, card]
    studyUpgradeSelectionBuffer = buffer
    if (pending && buffer.length >= pending.count) {
      studyUpgradeSelectionBuffer = []
      onStudyUpgradeConfirmed(buffer)
    }
  }

  function handleStudyUpgradeSkip(): void {
    studyUpgradeSelectionBuffer = []
    onStudyUpgradeConfirmed([])
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
    if (saved.rngState) {
      restoreRunRngState(saved.rngState)
    }
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
      // Look up enemy from saved map node so resume doesn't pick a random one.
      const actMap = saved.runState.floor.actMap
      const resumeNodeId = actMap?.currentNodeId
      const resumeEnemyId = resumeNodeId ? actMap?.nodes?.[resumeNodeId]?.enemyId : undefined
      // Make Phaser container visible before combat re-init.
      currentScreen.set('combat')
      await tick()
      targetScreen = await resumeCombatWithFallback({
        floor: saved.runState.floor.currentFloor,
        ensurePhaserBooted,
        startEncounter: () => startEncounterForRoom(resumeEnemyId),
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

  // Music pause state is now persisted across sessions via musicUserPaused store.
  // No resetUserPause() at run start — if the player paused, it stays paused.

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
              dismissScreenTransition()
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

  // Combat exit: gate on doorway click — player must click the doorway zone to proceed.
  $effect(() => {
    if ($combatExitRequested && $currentScreen === 'combat') {
      // Use store captured BEFORE activeTurnState was cleared by encounterBridge
      const enemyId = $combatExitEnemyId
      if (enemyId) {
        exitEnemyId = enemyId
        combatTransitionType = 'exit-forward'
        // In turbo/bot mode, skip the doorway click gate — proceed immediately.
        if (isTurboMode()) {
          combatExitWaiting = false
          combatTransitionActive = true
          return
        }
        // Normal mode: show doorway zone instead of auto-triggering the transition.
        // After 5 seconds, reveal the hint text.
        combatExitWaiting = true
        const timer = setTimeout(() => {
          doorwayHintVisible = true
        }, 5000)
        doorwayHintTimer = timer
      } else {
        onCombatExitComplete()
      }
    }
  })

  /** Called when the player clicks the doorway zone after combat. Triggers the exit transition. */
  function handleDoorwayClick(): void {
    if (!combatExitWaiting) return
    // Clear the hint timer if still pending
    if (doorwayHintTimer !== null) {
      clearTimeout(doorwayHintTimer)
      doorwayHintTimer = null
    }
    doorwayHintVisible = false
    combatExitWaiting = false
    combatTransitionActive = true
  }

  // Clean up doorway hint timer whenever combatExitWaiting turns off for any reason
  $effect(() => {
    if (!combatExitWaiting && doorwayHintTimer !== null) {
      clearTimeout(doorwayHintTimer)
      doorwayHintTimer = null
      doorwayHintVisible = false
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
    // C2: Resolve the real Steam persona name as early as possible so that lobby
    // creates/joins (which also call getLocalDisplayName) have it cached in state.
    void getLocalPersonaName().then((steamName) => {
      if (steamName && steamName.trim()) {
        localDisplayName = steamName.trim()
      }
    })

    // Publish local Steam ID and player ID to window.__rrMpState for console inspection
    // (MpDebugOverlay removed 2026-04-22 — logging is the primary diagnostic channel).
    void import('./services/steamNetworkingService').then(async ({ getLocalSteamId }) => {
      const steamId = await getLocalSteamId()
      setMpDebugState({
        steam: {
          localSteamId: steamId,
          localPlayerId,
          p2pConnectionState: null,
        },
      })
    })

    const onInteraction = (): void => {
      handleUserInteraction()
      window.removeEventListener('pointerdown', onInteraction)
      window.removeEventListener('keydown', onInteraction)
    }

    window.addEventListener('pointerdown', onInteraction, { once: true })
    window.addEventListener('keydown', onInteraction, { once: true })

    updateLayoutScale()
    window.addEventListener('resize', updateLayoutScale)

    // Restore saved window resolution on boot (desktop only; no-op on web/mobile)
    void ((): void => {
      const saved = localStorage.getItem('rr-window-resolution')
      if (saved) {
        try {
          const { width, height } = JSON.parse(saved) as { width: number; height: number }
          if (typeof width === 'number' && typeof height === 'number') {
            void setWindowResolution(width, height)
          }
        } catch {
          // Malformed saved value — ignore silently
        }
      }
    })()

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

<!-- Global SVG filter defs (single source of truth, shared across all consumers).
     #rpg-outline-filter renders a 2px black outline around any image's alpha channel
     using a single GPU-accelerated feMorphology dilate + flood + composite. Used by
     CampSpriteButton.svelte's .rpg-outline class to replace what was previously an
     8-chained CSS drop-shadow() filter — that chain forced ~50 MB of per-frame
     compositor work on Chrome with ~10 fullscreen-sized camp sprites. See
     docs/gotchas.md 2026-04-20. -->
<svg
  width="0"
  height="0"
  style="position: absolute; pointer-events: none;"
  aria-hidden="true"
>
  <defs>
    <filter id="rpg-outline-filter" x="-10%" y="-10%" width="120%" height="120%">
      <!-- Step 1: dilate the source alpha channel by 2px to make a fattened mask -->
      <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated" />
      <!-- Step 2: flood with solid black, masked by the dilated alpha -->
      <feFlood flood-color="#000" flood-opacity="1" result="black" />
      <feComposite in="black" in2="dilated" operator="in" result="outline" />
      <!-- Step 3: paint the original sprite on top of the black outline -->
      <feMerge>
        <feMergeNode in="outline" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
</svg>

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
      fogLevel={$activeTurnState != null ? getAuraLevel() : 0}
      fogState={$activeTurnState != null ? getAuraState() : undefined}
      statusEffects={topBarPlayerEffects}
      onpause={handlePause}
    />
    <MusicWidget />
  {/if}

  {#if showTopBar && $runDeckOverlayOpen}
    <RunDeckOverlay />
  {/if}

  <div
    id="phaser-container"
    class="phaser-container"
    class:visible={showBootAnimation || $currentScreen === 'combat' || $currentScreen === 'rewardRoom'}
    class:boot-anim-active={showBootAnimation}
    bind:this={phaserContainer}
  ></div>

  <!-- A11y DOM overlays for Reward Room Phaser buttons.
       RewardRoomOverlay covers 4 canvas-only interactive objects (BATCH-ULTRA T11):
       Continue (line 970, fully wired), Relic Accept (820), Relic Leave (851),
       and the backdrop blocker (999, no DOM equivalent needed).
       See RewardRoomOverlay.svelte and docs/ui/components.md. -->
  {#if $currentScreen === 'rewardRoom'}
    <RewardRoomOverlay />
  {/if}

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
            <button class="run-guard-btn-abandon" onclick={handleGuardAbandon}>Abandon Run</button>
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


  {#if $currentScreen === 'combat'}
    {#if !combatExitWaiting}
      <CardCombatOverlay
        turnState={$activeTurnState}
        onplaycard={handlePlayCard}
        onskipcard={handleSkipCard}
        onendturn={handleEndTurn}
        onusehint={handleUseHint}
        onreturnhub={() => { currentScreen.set('hub'); activeRunState.set(null); }}
        fogLevel={$activeTurnState != null ? getAuraLevel() : 0}
        fogState={$activeTurnState != null ? getAuraState() : undefined}
        showRosterTrigger={isMultiplayerRun && isManyPlayerMode}
        otherPlayerCount={Object.keys(partnerStates).length}
        onopenroster={() => { rosterPanelOpen = true }}
      />
      <button
        type="button"
        class="pause-btn"
        data-testid="btn-pause"
        onclick={handlePause}
        aria-label="Pause"
      ><span class="pause-icon" aria-hidden="true"></span></button>
      <!-- Dev skip button disabled — use __rrScenario.load() from console instead -->
      <!-- {#if $devMode}
        <button
          type="button"
          class="dev-skip-btn"
          data-dev-only="true"
          onclick={() => devForceEncounterVictory()}
        >&#x23ED; Skip</button>
      {/if} -->
      {#if isMultiplayerRun && !isManyPlayerMode && currentLobby?.mode === 'duel'}
        <!-- L-026 / H-015: Duel mode renders the dedicated opponent panel
             instead of the race-style MultiplayerHUD. opponentProgress carries
             the partner HP; opponent name comes from the lobby roster. The
             remaining fields use safe defaults so the panel renders even before
             the first turn-end broadcast lands. -->
        <DuelOpponentPanel
          opponentName={opponentDisplayName}
          opponentHp={opponentProgress.playerHp}
          opponentMaxHp={opponentProgress.playerMaxHp}
          localDamageTotal={0}
          opponentDamageTotal={0}
          opponentChainLength={0}
          opponentChainColor={'Obsidian'}
          turnTimerSecs={0}
          turnTimerMax={0}
          enemyTargetIsLocal={false}
        />
      {:else if isMultiplayerRun && !isManyPlayerMode}
        <MultiplayerHUD
          progress={opponentProgress}
          displayName={opponentDisplayName}
          mode={currentLobby?.mode ?? 'race'}
          quizVisible={$quizPanelVisible}
        />
      {/if}
      {#if isMultiplayerRun && isManyPlayerMode}
        <PlayerRosterPanel
          open={rosterPanelOpen}
          players={partnerStates}
          lobbyPlayers={currentLobby?.players ?? []}
          localPlayerId={localPlayerId}
          onclose={() => { rosterPanelOpen = false }}
        />
      {/if}
    {/if}
    {#if combatExitWaiting}
      <!-- Doorway exit zone: player clicks this to leave after combat victory -->
      <div
        class="doorway-exit-zone"
        role="button"
        tabindex="0"
        aria-label="Doorway to next room"
        onclick={handleDoorwayClick}
        onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? handleDoorwayClick() : null}
      >
        <div class="doorway-glow" aria-hidden="true"></div>
        {#if doorwayHintVisible}
          <p class="doorway-hint" aria-live="polite">Step through the doorway.</p>
        {/if}
      </div>
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
        ontransform={onShopTransform}
        ontransformchoice={onShopTransformChoice}
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
          nodePicks={nodePickIndicators}
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

  {#if $currentScreen === 'cardUpgradeReveal' && $activeCardUpgradeReveal}
    <div in:fly={{ y: 8, duration: 350 }}>
      <CardUpgradeRevealOverlay
        beforeCard={$activeCardUpgradeReveal.beforeCard}
        afterCard={$activeCardUpgradeReveal.afterCard}
        mechanicName={$activeCardUpgradeReveal.mechanicName}
        beforeLevel={$activeCardUpgradeReveal.beforeLevel}
        afterLevel={$activeCardUpgradeReveal.afterLevel}
        mode={$activeCardUpgradeReveal.mode}
        ondismiss={onCardUpgradeRevealDismissed}
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
        meditateDisabledReason="Need 6+ cards to remove one"
      />
    </div>
  {/if}

  {#if $currentScreen === 'restStudy'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <StudyQuizOverlay questions={studyQuestions} oncomplete={handleStudyComplete} quizLanguageCode={studyLanguageCode} />
    </div>
  {/if}

  {#if $pendingStudyUpgrade}
    <div in:fly={{ y: 8, duration: 350 }}>
      <CardPickerOverlay
        title="Choose {$pendingStudyUpgrade.count} card(s) to upgrade"
        cards={$pendingStudyUpgrade.candidates}
        pickCount={$pendingStudyUpgrade.count}
        mode="multi"
        confirmLabel="Upgrade"
        onselect={handleStudyUpgradeSelect}
        onskip={handleStudyUpgradeSkip}
      />
    </div>
  {/if}

  {#if $pendingTransformOptions}
    <div in:fly={{ y: 8, duration: 350 }}>
      <CardPickerOverlay
        title="Choose a replacement card"
        cards={$pendingTransformOptions}
        pickCount={1}
        mode="single"
        confirmLabel="Transform"
        onselect={(card) => onShopTransformChoice(card)}
        onskip={() => { pendingTransformOptions.set(null) }}
      />
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
        onBack={handleRunPreviewBack}
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
    <div in:fly={{ y: 8, duration: 350 }} class="mp-screen-wrapper">
      {#if multiplayerError}
        <div class="mp-error-banner" role="alert" data-testid="mp-error-banner">
          <span class="mp-error-text">{multiplayerError}</span>
          <button
            class="mp-error-dismiss"
            aria-label="Dismiss error"
            onclick={() => { multiplayerError = null }}
          >✕</button>
        </div>
      {/if}
      <MultiplayerMenu
        onBack={() => { multiplayerError = null; transitionScreen('hub') }}
        onCreateLobby={handleCreateLobby}
        onJoinLobby={handleJoinLobby}
        onBrowseLobbies={handleBrowseLobbies}
      />
    </div>
  {/if}

  {#if $currentScreen === 'lobbyBrowser'}
    <div in:fly={{ y: 8, duration: 350 }}>
      <LobbyBrowserScreen
        localPlayerId={localPlayerId}
        localDisplayName={localDisplayName}
        onBack={() => transitionScreen('multiplayerMenu')}
        onJoined={handleLobbyJoined}
      />
    </div>
  {/if}

  {#if $currentScreen === 'multiplayerLobby' && currentLobby}
    <div in:fly={{ y: 8, duration: 350 }}>
      {#if multiplayerError}
        <div class="mp-error-banner" role="alert" data-testid="mp-error-banner">
          <span class="mp-error-text">{multiplayerError}</span>
          <button
            class="mp-error-dismiss"
            aria-label="Dismiss error"
            onclick={() => { multiplayerError = null }}
          >✕</button>
        </div>
      {/if}
      <MultiplayerLobby
        lobby={currentLobby}
        localPlayerId={localPlayerId}
        onBack={handleMultiplayerBack}
      />
    </div>
  {/if}


  {#if $currentScreen === 'triviaRound' && _triviaGameState}
    <div in:fly={{ y: 8, duration: 350 }}>
      <!-- L-028 / H-015: TriviaRoundScreen is now bound to live trivia service state.
           _triviaGameState is populated by the onTriviaStateChange subscription above,
           which fires whenever initTriviaGame / phase transitions update the service.
           The screen is only mounted when _triviaGameState is non-null (i.e. after
           initTriviaGame has run for trivia_night mode). -->
      <TriviaRoundScreen
        gameState={_triviaGameState}
        localPlayerId={localPlayerId}
        currentQuestion={_triviaCurrentQuestion}
        lastRoundResult={_triviaLastRoundResult}
        onAnswer={(selectedIndex, timingMs) => { submitAnswer(selectedIndex, timingMs) }}
        onPlayAgain={() => { currentScreen.set('multiplayerMenu'); }}
        onReturnToLobby={() => { currentScreen.set('multiplayerLobby'); }}
        onReturnToHub={() => { currentScreen.set('hub'); }}
      />
    </div>
  {/if}

  {#if $currentScreen === 'raceResults' && activeRaceResults}
    <div in:fly={{ y: 8, duration: 350 }}>
      <RaceResultsScreen
        results={activeRaceResults}
        localPlayerId={localPlayerId}
        mode={currentLobby?.mode === 'same_cards' ? 'same_cards' : currentLobby?.mode === 'duel' ? 'duel' : 'race'}
        onPlayAgain={() => { activeRaceResults = null; transitionScreen('multiplayerMenu'); }}
        onReturnToLobby={() => { activeRaceResults = null; transitionScreen('multiplayerLobby'); }}
        onReturnToHub={() => { activeRaceResults = null; transitionScreen('hub'); }}
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


  {#if gainedFactText}
    <div class="fact-gained-toast" role="status">
      <div class="toast-header">New Fact Acquired</div>
      <div class="toast-text">{gainedFactText}</div>
    </div>
  {/if}

  {#if syncHealthBanner}
    <!-- MP-STEAM-20260422-009: visible diagnostic when coop sync silently fails.
         Floats top-center, dismissible. -->
    <div class="sync-health-banner" role="alert" aria-live="polite" data-testid="sync-health-banner">
      <span class="sync-health-dot" aria-hidden="true"></span>
      <span class="sync-health-text">{syncHealthBanner}</span>
      <button
        class="sync-health-dismiss"
        type="button"
        aria-label="Dismiss"
        onclick={() => { syncHealthBanner = null }}
      >×</button>
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

  {#if $tutorialActive && $tutorialMessage && $tutorialAnchor}
    <TutorialCoachMark
      message={$tutorialMessage}
      anchor={$tutorialAnchor}
      spotlight={$tutorialSpotlight}
      blockInput={$tutorialBlocksInput}
      ondismiss={advanceStep}
      onskip={skipTutorial}
    />
  {/if}

  {#if $narrativeDisplay.active}
    <NarrativeOverlay
      lines={$narrativeDisplay.lines}
      mode={$narrativeDisplay.mode}
      onDismiss={dismissNarrative}
      showTutorialButton={currentLobby === null && ($currentScreen === 'combat' || $currentScreen === 'dungeonMap')}
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

  /* Multiplayer error banner — shown at top of multiplayerMenu when lobby create/join fails. */
  .mp-screen-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .mp-error-banner {
    position: absolute;
    top: calc(12px * var(--layout-scale, 1));
    left: calc(16px * var(--layout-scale, 1));
    right: calc(16px * var(--layout-scale, 1));
    z-index: 600;
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    background: rgba(127, 29, 29, 0.92);
    border: 1px solid rgba(252, 165, 165, 0.4);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    animation: mp-banner-in 0.25s ease-out;
  }

  .mp-error-text {
    flex: 1;
    font-size: calc(14px * var(--text-scale, 1));
    color: #fecaca;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .mp-error-dismiss {
    flex-shrink: 0;
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #fca5a5;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    border-radius: 50%;
    transition: background 0.15s;
  }

  .mp-error-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  @keyframes mp-banner-in {
    from { opacity: 0; transform: translateY(calc(-6px * var(--layout-scale, 1))); }
    to { opacity: 1; transform: translateY(0); }
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

  .sync-health-banner {
    position: fixed;
    top: calc(64px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    background: rgba(15, 25, 35, 0.94);
    border: 1px solid rgba(231, 126, 34, 0.55);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    color: #f0c674;
    font-size: calc(13px * var(--text-scale, 1));
    z-index: 9000;
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(0,0,0,0.55);
    animation: sync-health-in 0.25s ease-out;
  }
  .sync-health-dot {
    width: calc(8px * var(--layout-scale, 1));
    height: calc(8px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #e67e22;
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) #e67e22;
    animation: sync-health-pulse 1.4s ease-in-out infinite;
  }
  .sync-health-text {
    line-height: 1.3;
  }
  .sync-health-dismiss {
    background: none;
    border: none;
    color: #f0c674;
    font-size: calc(18px * var(--text-scale, 1));
    line-height: 1;
    cursor: pointer;
    padding: 0 calc(2px * var(--layout-scale, 1));
    margin-left: calc(4px * var(--layout-scale, 1));
    min-width: calc(24px * var(--layout-scale, 1));
    min-height: calc(24px * var(--layout-scale, 1));
  }
  .sync-health-dismiss:hover {
    color: #fff;
  }
  @keyframes sync-health-in {
    from { opacity: 0; transform: translateX(-50%) translateY(calc(-8px * var(--layout-scale, 1))); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes sync-health-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
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

  /* Dev skip button disabled — CSS kept for reference if re-enabled
  .dev-skip-btn { ... }
  .dev-skip-btn:hover { ... }
  */

  /* ── Doorway exit zone (shown after combat victory, before parallax transition) ── */

  .doorway-exit-zone {
    position: fixed;
    /* Upper-center: doorway sits on the far wall, roughly 20-40% from top */
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    width: calc(140px * var(--layout-scale, 1));
    height: calc(340px * var(--layout-scale, 1));
    /* Above Phaser canvas (z-index 1), below full-screen overlays */
    z-index: 100;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    /* Minimum tap target: 44×44px */
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .doorway-exit-zone:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.6);
    outline-offset: calc(4px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
  }

  /* Subtle pulsing glow — visible enough to be a hint, subtle enough not to break immersion */
  .doorway-glow {
    width: calc(120px * var(--layout-scale, 1));
    height: calc(300px * var(--layout-scale, 1));
    border-radius: calc(60px * var(--layout-scale, 1)) calc(60px * var(--layout-scale, 1)) 0 0;
    background: radial-gradient(ellipse at 50% 40%, rgba(255, 245, 200, 0.08) 0%, rgba(255, 245, 200, 0) 70%);
    animation: doorway-pulse 2.5s ease-in-out infinite;
    transition: background 0.3s ease;
  }

  .doorway-exit-zone:hover .doorway-glow {
    background: radial-gradient(ellipse at 50% 40%, rgba(255, 245, 200, 0.15) 0%, rgba(255, 245, 200, 0) 70%);
  }

  @keyframes doorway-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .doorway-hint {
    margin: calc(8px * var(--layout-scale, 1)) 0 0;
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(255, 245, 200, 0.75);
    text-align: center;
    letter-spacing: 0.03em;
    pointer-events: none;
    animation: doorway-hint-in 0.8s ease-out both;
  }

  @keyframes doorway-hint-in {
    from { opacity: 0; transform: translateY(calc(4px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: translateY(0); }
  }

</style>
