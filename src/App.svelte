<script lang="ts">
  import { get } from 'svelte/store'
  import { untrack, onDestroy } from 'svelte'
  import { getGM } from './game/gameManagerRef'
  import {
    currentScreen,
    activeQuiz,
    activeFact,
    inventory,
    diveResults,
    pendingArtifacts,
    blocksMinedLive,
    studyFacts,
    studyReviewStates,
    showSendUp,
    pendingRelicPickup,
    equippedRelicsV2,
    quizStreak,
    descentOverlayState,
    currentLayer,
    sacrificeState,
    decisionScreenState,
  } from './ui/stores/gameState'
  import { playerSave } from './ui/stores/playerData'
  import type { Fact } from './data/types'

  // Components
  import HUD from './ui/components/HUD.svelte'
  import QuizOverlay from './ui/components/QuizOverlay.svelte'
  import BackpackOverlay from './ui/components/BackpackOverlay.svelte'
  import RunStatsOverlay from './ui/components/RunStatsOverlay.svelte'
  import FactReveal from './ui/components/FactReveal.svelte'
  import DivePrepScreen from './ui/components/DivePrepScreen.svelte'
  import BaseView from './ui/components/BaseView.svelte'
  import HubView from './ui/components/HubView.svelte'
  import DiveResults from './ui/components/DiveResults.svelte'
  import DevPanel from './ui/components/DevPanel.svelte'
  import KnowledgeTreeView from './ui/components/KnowledgeTreeView.svelte'
  import StudySession from './ui/components/StudySession.svelte'
  import SendUpOverlay from './ui/components/SendUpOverlay.svelte'
  import Materializer from './ui/components/Materializer.svelte'
  import PremiumMaterializer from './ui/components/PremiumMaterializer.svelte'
  import CosmeticsShop from './ui/components/CosmeticsShop.svelte'
  import KnowledgeStore from './ui/components/KnowledgeStore.svelte'
  import FossilGallery from './ui/components/FossilGallery.svelte'
  import Zoo from './ui/components/Zoo.svelte'
  import StreakPanel from './ui/components/StreakPanel.svelte'
  import Farm from './ui/components/Farm.svelte'
  import Settings from './ui/components/Settings.svelte'
  import GaiaReport from './ui/components/GaiaReport.svelte'
  import InterestSettings from './ui/components/InterestSettings.svelte'
  import InterestAssessment from './ui/components/InterestAssessment.svelte'
  import OnboardingCutscene from './ui/components/OnboardingCutscene.svelte'
  import GaiaIntro from './ui/components/GaiaIntro.svelte'
  import AgeSelection from './ui/components/AgeSelection.svelte'
  import MiniMap from './ui/components/MiniMap.svelte'
  import PwaInstallPrompt from './ui/components/PwaInstallPrompt.svelte'
  import KeyboardShortcutHelp from './ui/components/KeyboardShortcutHelp.svelte'
  import DesktopSidePanel from './ui/components/DesktopSidePanel.svelte'
  import RelicPickupOverlay from './ui/components/RelicPickupOverlay.svelte'
  import ResumeDiveModal from './ui/components/ResumeDiveModal.svelte'
  import GaiaToast from './ui/components/GaiaToast.svelte'
  import ATTConsentPrompt from './ui/components/ATTConsentPrompt.svelte'
  import DescentOverlay from './ui/components/DescentOverlay.svelte'
  import StreakFeedback from './ui/components/StreakFeedback.svelte'
  import SacrificeOverlay from './ui/components/SacrificeOverlay.svelte'
  import DecisionScreen from './ui/components/DecisionScreen.svelte'
  import { shortcutService } from './services/shortcutService'
  import { SaveManager } from './game/managers/SaveManager'
  import { collectFarmResources, save as persistSave } from './services/saveService'
  import { calculateTotalPending } from './data/farm'
  import { gaiaMessage } from './ui/stores/gameState'
  import { generateBiomeSequence } from './data/biomes'
  import { seededRandom } from './game/systems/MineGenerator'
  import { authStore } from './ui/stores/authStore'
  import LoginView from './ui/components/auth/LoginView.svelte'
  import RegisterView from './ui/components/auth/RegisterView.svelte'
  import ForgotPasswordView from './ui/components/auth/ForgotPasswordView.svelte'
  import ProfileView from './ui/components/auth/ProfileView.svelte'
  import OfflineToast from './ui/components/OfflineToast.svelte'
  import AgeGate from './ui/components/legal/AgeGate.svelte'
  import { AGE_BRACKET_KEY, type AgeBracket } from './services/legalConstants'
  import PrivacyPolicy from './ui/components/legal/PrivacyPolicy.svelte'
  import TermsOfService from './ui/components/legal/TermsOfService.svelte'
  import { profileService } from './services/profileService'
  import { profileStore } from './ui/stores/profileStore'
  import type { PlayerProfile } from './data/profileTypes'
  import ProfileSelectView from './ui/components/profiles/ProfileSelectView.svelte'
  import ProfileCreateView from './ui/components/profiles/ProfileCreateView.svelte'
  import ProfileManageView from './ui/components/profiles/ProfileManageView.svelte'
  // Phase 35: Mine Mechanics HUD
  import QuizStreakBadge from './ui/components/QuizStreakBadge.svelte'
  import InstabilityMeter from './ui/components/InstabilityMeter.svelte'
  import MineEventOverlay from './ui/components/MineEventOverlay.svelte'
  import AltarSacrificeOverlay from './ui/components/AltarSacrificeOverlay.svelte'
  import { activeAltar } from './ui/stores/gameState'
  // Phase 36: Combat System
  import CombatOverlay from './ui/components/CombatOverlay.svelte'
  import BossIntroOverlay from './ui/components/BossIntroOverlay.svelte'
  import TheDeepUnlockOverlay from './ui/components/TheDeepUnlockOverlay.svelte'
  import { combatState } from './ui/stores/combatState'

  // Phase 42: Deep link listener
  import { registerDeepLinkListener, type DeepLinkRoute } from './services/deepLinkService'

  // Phase 45: Kid Mode
  import { sessionTimer, type SessionTimerState } from './services/sessionTimer'
  import { parentalStore } from './ui/stores/parentalStore'
  import TimeUpOverlay from './ui/components/TimeUpOverlay.svelte'
  import SessionWarningBanner from './ui/components/SessionWarningBanner.svelte'
  import './app-kid-theme.css'

  // Phase 44: Teacher Dashboard — in-game classroom integration
  import AnnouncementBanner from './ui/components/AnnouncementBanner.svelte'
  import { syncAllClassroomData } from './services/classroomService'

  // ============================================================
  // PROFILE ROUTING LAYER (Phase 19.6)
  // ============================================================

  /** Which profile screen is shown. null = proceed to auth/game. */
  type ProfileScreen = 'select' | 'create' | 'manage' | null

  /** If a profile is already active from a previous session, skip the profile gate. */
  const hasActiveProfile = profileService.getActiveId() !== null

  const _devSkipOnboarding = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('skipOnboarding') === 'true'
  let profileScreen = $state<ProfileScreen>(
    (hasActiveProfile || _devSkipOnboarding) ? null : (profileService.hasProfiles() ? 'select' : 'create'),
  )

  /** Whether the player has passed the profile gate and entered the game layer. */
  let profileGateCleared = $state(hasActiveProfile || _devSkipOnboarding)

  function handleProfileSelect(id: string): void {
    profileStore.setActive(id)
    profileGateCleared = true
    profileScreen = null
  }

  function handleProfileCreated(_profile: PlayerProfile): void {
    // Profile was created and set active by profileService.createProfile()
    profileStore.refresh()
    profileGateCleared = true
    profileScreen = null
  }

  function handleAddProfile(): void {
    profileScreen = 'create'
  }

  function handleManageProfiles(): void {
    profileScreen = 'manage'
  }

  function handleBackFromManage(): void {
    profileScreen = profileService.hasProfiles() ? 'select' : 'create'
  }

  function handleProfileDeleted(): void {
    // If all profiles were deleted, go to create; otherwise stay in manage
    if (!profileService.hasProfiles()) {
      profileScreen = 'create'
    }
  }

  function handleBackFromCreate(): void {
    if (profileService.hasProfiles()) {
      profileScreen = 'select'
    }
    // If no profiles exist there is nowhere to go back to — stay on create
  }

  // ============================================================
  // AUTH ROUTING LAYER
  // ============================================================

  /** Which auth sub-screen is visible (null = game is shown). */
  type AuthScreen = 'login' | 'register' | 'forgot' | 'profile' | 'privacy' | 'terms' | null

  let authScreen = $state<AuthScreen>(null)

  // ── DEV BYPASS — stripped in production builds (import.meta.env.DEV is false in prod) ──
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('skipOnboarding') === 'true') {
      if (!localStorage.getItem(AGE_BRACKET_KEY)) localStorage.setItem(AGE_BRACKET_KEY, 'teen')
      localStorage.setItem('terra_guest_mode', 'true')
    }
    const presetId = params.get('devpreset')
    if (presetId) {
      import('./dev/presets').then(({ SCENARIO_PRESETS }) => {
        const preset = SCENARIO_PRESETS.find((p: { id: string }) => p.id === presetId)
        if (preset) {
          const builtSave = preset.buildSave(Date.now())
          persistSave(builtSave)
          playerSave.set(builtSave)
          currentScreen.set(preset.targetScreen ?? 'base')
        }
      })
    }
  }

  // ── Guest mode tracking — reactive state for Svelte reactivity ──
  let isGuestMode = $state(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('terra_guest_mode') === 'true'
      : false,
  )

  // ── Age gate — shown on first-ever launch before anything else ──
  /**
   * Whether we need to show the age gate.
   * We check once at mount; AgeGate writes the result to localStorage so the
   * check will be false on every subsequent app start.
   */
  let showAgeGate = $state(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(AGE_BRACKET_KEY) === null
      : false,
  )

  /** AgeGate confirmation — persist bracket and dismiss the gate. */
  function handleAgeGateSelect(_bracket: AgeBracket): void {
    // AGE_BRACKET_KEY is written inside AgeGate before onSelect fires;
    // we just need to hide the gate and let the normal auth flow continue.
    showAgeGate = false
  }

  /**
   * Determines whether the game should be visible.
   * True when the profile gate is cleared AND
   * (user is authenticated OR has chosen guest mode).
   */
  const gameVisible = $derived.by(() => {
    if (!profileGateCleared) return false
    if ($authStore.isLoggedIn) return true
    if (isGuestMode) return true
    return false
  })

  // Show login gate once profile gate is cleared but auth is missing
  $effect(() => {
    if (profileGateCleared && !gameVisible && authScreen === null) {
      authScreen = 'login'
    }
  })

  /** Handle successful login — dismiss auth screens and enter the game. */
  function handleAuthLogin(user: { id: string; email: string; displayName: string | null }): void {
    authStore.setUser(user)
    authScreen = null
    // Phase 44: Sync classroom data (active assignment + announcement) on login
    void syncAllClassroomData()
  }

  /** Navigates from login to register. */
  function handleAuthGoRegister(): void {
    authScreen = 'register'
  }

  /** Navigates from login to forgot password. */
  function handleAuthGoForgot(): void {
    authScreen = 'forgot'
  }

  /** Handles "Continue as Guest" — sets the guest flag and dismisses auth. */
  function handleAuthGuest(): void {
    localStorage.setItem('terra_guest_mode', 'true')
    isGuestMode = true
    authScreen = null
  }

  /** Navigates back from register or forgot to login. */
  function handleAuthBack(): void {
    authScreen = 'login'
  }

  /** Opens the Privacy Policy screen from within the register flow. */
  function handleViewPrivacy(): void {
    authScreen = 'privacy'
  }

  /** Opens the Terms of Service screen from within the register flow. */
  function handleViewTerms(): void {
    authScreen = 'terms'
  }

  /** Profile view: logout handler. */
  function handleProfileLogout(): void {
    localStorage.removeItem('terra_guest_mode')
    isGuestMode = false
    authScreen = 'login'
  }

  /** Opens the profile screen from Settings. */
  function handleViewProfile(): void {
    authScreen = 'profile'
  }

  // Cache getFacts() — avoids full SQL scan on every re-render
  let cachedFacts = $state<Fact[]>([])

  $effect(() => {
    if (untrack(() => cachedFacts.length) === 0) {
      try {
        const gm = getGM()
        if (gm) cachedFacts = gm.getFacts()
      } catch { /* DB not ready yet */ }
    }
  })

  // Preview biome for DivePrepScreen — seed changes every minute so it varies without being random
  const previewBiome = $derived.by(() => {
    const previewSeed = Math.floor(Date.now() / 60000)
    const rng = seededRandom(previewSeed ^ 0xb10e5)
    const seq = generateBiomeSequence(rng, 1)
    return seq[0] ?? null
  })

  // Quiz mode tracking
  let quizMode = $state<'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer' | 'combat' | 'artifact_boost'>('gate')

  // Phase 36: boss intro overlay state
  let showBossIntro = $state(false)

  // Resume modal state — shown when a mid-dive save is detected on app start (DD-V2-053)
  let showResumeModal = $state(false)

  // Main menu start handler
  function handleStart(): void {
    currentScreen.set('base')
  }

  // Phase 14: Onboarding flow handlers
  function handleCutsceneComplete(): void {
    currentScreen.set('onboarding')
  }

  function handleGaiaIntroComplete(interests: string[], weights: Record<string, number>, targetLanguage: string | null): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, selectedInterests: interests, interestWeights: weights, targetLanguage, tutorialComplete: true }
    })
    import('./ui/stores/playerData').then(m => m.persistPlayer())
    // Skip AgeSelection — age bracket was already captured by AgeGate (legal compliance step).
    currentScreen.set('mainMenu')
  }

  function handleAgeSelected(ageRating: import('./data/types').AgeRating): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, ageRating, tutorialComplete: true }
    })
    import('./ui/stores/playerData').then(m => m.persistPlayer())
    // After age selection, go to main menu which starts the dive prep
    currentScreen.set('mainMenu')
  }

  // Base actions
  function handleDive(): void {
    getGM()?.goToDivePrep()
  }

  function handleStudy(): void {
    getGM()?.startStudySession()
  }

  // Study session (card-flip mode) handlers
  let studySessionCorrectCount = $state(0)
  let studySessionTotal = $state(0)

  function handleStudyCardAnswer(factId: string, correct: boolean): void {
    if (correct) studySessionCorrectCount++
    studySessionTotal++
    getGM()?.handleStudyCardAnswer(factId, correct)
  }

  function handleStudyComplete(): void {
    getGM()?.completeStudySession(studySessionCorrectCount, studySessionTotal)
    studySessionCorrectCount = 0
    studySessionTotal = 0
  }

  // Reset counters whenever a new study session starts
  $effect(() => {
    if ($currentScreen === 'studySession') {
      studySessionCorrectCount = 0
      studySessionTotal = 0
    }
  })

  function handleReviewArtifact(): void {
    getGM()?.reviewNextArtifact()
  }

  function handleViewKnowledgeTree(): void {
    currentScreen.set('knowledgeTree')
  }

  function handleBackFromTree(): void {
    currentScreen.set('base')
  }

  function handleViewMaterializer(): void {
    currentScreen.set('materializer')
  }

  function handleBackFromMaterializer(): void {
    currentScreen.set('base')
  }

  function handleViewPremiumMaterializer(): void {
    currentScreen.set('premiumMaterializer')
  }

  function handleBackFromPremiumMaterializer(): void {
    currentScreen.set('base')
  }

  function handleViewCosmeticsShop(): void {
    currentScreen.set('cosmeticsShop')
  }

  function handleBackFromCosmeticsShop(): void {
    currentScreen.set('base')
  }

  function handleViewKnowledgeStore(): void {
    currentScreen.set('knowledgeStore')
  }

  function handleBackFromKnowledgeStore(): void {
    currentScreen.set('base')
  }

  function handleViewFossils(): void {
    currentScreen.set('fossilGallery')
  }

  function handleBackFromFossils(): void {
    currentScreen.set('base')
  }

  function handleViewZoo(): void {
    currentScreen.set('zoo')
  }

  function handleBackFromZoo(): void {
    currentScreen.set('base')
  }

  function handleViewStreakPanel(): void {
    currentScreen.set('streakPanel')
  }

  function handleBackFromStreakPanel(): void {
    currentScreen.set('base')
  }

  function handleViewFarm(): void {
    currentScreen.set('farm')
  }

  function handleBackFromFarm(): void {
    // Auto-collect any remaining farm resources on returning to base and show a GAIA toast
    const save = $playerSave
    if (save) {
      const pending = calculateTotalPending(save.farm.slots)
      const anyPending = pending.dust > 0 || pending.shard > 0 || pending.crystal > 0
      if (anyPending) {
        const { updatedSave, collected } = collectFarmResources(save)
        playerSave.set(updatedSave)
        const parts: string[] = []
        if (collected.dust > 0) parts.push(`${collected.dust} dust`)
        if (collected.shard > 0) parts.push(`${collected.shard} shards`)
        if (collected.crystal > 0) parts.push(`${collected.crystal} crystal`)
        if (parts.length > 0) {
          gaiaMessage.set(`Your farm produced ${parts.join(', ')}!`)
          setTimeout(() => gaiaMessage.set(null), 4000)
        }
      }
    }
    currentScreen.set('base')
  }

  function handleViewGaiaReport(): void {
    currentScreen.set('gaiaReport')
  }

  // Settings handlers
  function handleViewSettings(): void {
    currentScreen.set('settings')
  }

  function handleBackFromSettings(): void {
    currentScreen.set('base')
  }

  // Dive prep actions
  function handleStartDive(tanks: number): void {
    getGM()?.startDive(tanks)
  }

  function handleBackFromDivePrep(): void {
    getGM()?.goToBase()
  }

  // Mining HUD actions
  function handleSurface(): void {
    getGM()?.endDive(false)
  }

  function handleOpenBackpack(): void {
    // Triggered by Phaser event, screen already set by GameManager
    // But also support direct call from HUD
    currentScreen.set('backpack')
  }

  function handleUseBomb(): void {
    getGM()?.useBomb()
  }

  function handleUseConsumable(id: import('./data/consumables').ConsumableId): void {
    getGM()?.applyConsumable(id)
  }

  // Quiz actions
  function handleQuizAnswer(correct: boolean): void {
    const gm = getGM()
    if (!gm) return
    if (quizMode === 'gate') {
      gm.handleQuizAnswer(correct)
    } else if (quizMode === 'oxygen') {
      gm.handleOxygenQuizAnswer(correct)
    } else if (quizMode === 'artifact') {
      gm.handleArtifactQuizAnswer(correct)
    } else if (quizMode === 'random') {
      gm.handleRandomQuizAnswer(correct)
    } else if (quizMode === 'layer') {
      gm.handleLayerQuizAnswer(correct)
    } else if (quizMode === 'combat') {
      gm.handleCombatQuizAnswer(correct)
    } else {
      gm.handleStudyAnswer(correct)
    }
  }

  function handleQuizClose(): void {
    if (quizMode === 'gate') {
      getGM()?.resumeQuiz(false)
    } else if (quizMode === 'oxygen') {
      getGM()?.handleOxygenQuizAnswer(false)
    } else if (quizMode === 'artifact') {
      getGM()?.handleArtifactQuizAnswer(false)
    } else if (quizMode === 'random') {
      getGM()?.handleRandomQuizAnswer(false)
    } else if (quizMode === 'layer') {
      getGM()?.handleLayerQuizAnswer(false)
    } else if (quizMode === 'combat') {
      getGM()?.handleCombatQuizAnswer(false)
    } else {
      currentScreen.set('base')
    }
  }

  // Backpack actions
  function handleCloseBackpack(): void {
    getGM()?.closeBackpack()
  }

  function handleDropItem(index: number): void {
    getGM()?.dropItem(index)
  }

  // Run stats actions
  function handleOpenRunStats(): void {
    getGM()?.openRunStats()
  }

  function handleCloseRunStats(): void {
    getGM()?.closeRunStats()
  }

  // Send-up station actions
  function handleSendUpConfirm(selectedItems: import('./data/types').InventorySlot[]): void {
    getGM()?.confirmSendUp(selectedItems)
  }

  function handleSendUpSkip(): void {
    getGM()?.skipSendUp()
  }

  // Fact reveal actions
  function handleLearnFact(): void {
    getGM()?.learnArtifact()
  }

  function handleSellFact(): void {
    getGM()?.sellArtifact()
  }

  // Dive results actions
  function handleDiveResultsContinue(): void {
    diveResults.set(null)
    const pending = get(pendingArtifacts)
    if (pending.length > 0) {
      getGM()?.reviewNextArtifact()
    } else {
      getGM()?.goToBase()
    }
  }

  // Track quiz mode from the activeQuiz source field
  $effect(() => {
    if ($currentScreen === 'quiz' && $activeQuiz) {
      quizMode = $activeQuiz.source ?? 'gate'
    }
  })

  // Check for mid-dive save on app start (DD-V2-053)
  $effect(() => {
    if ($currentScreen === 'base' && SaveManager.hasSave()) {
      showResumeModal = true
    }
  })

  function handleResumeDive(): void {
    showResumeModal = false
    // Full restore-from-save requires MineScene hydration (future enhancement).
    // For now, clear the save and let the player start a fresh dive.
    SaveManager.clear()
    gaiaMessage.set('Welcome back! Your previous dive data has been recovered.')
    setTimeout(() => gaiaMessage.set(null), 4000)
  }

  function handleAbandonDive(): void {
    showResumeModal = false
    const save = SaveManager.load()
    if (save) {
      getGM()?.applyLootLoss(save.layer)
    }
    SaveManager.clear()
    gaiaMessage.set('Run abandoned. Some minerals were lost in the extraction.')
    setTimeout(() => gaiaMessage.set(null), 4000)
  }

  // ============================================================
  // KEYBOARD SHORTCUTS (Phase 39.3)
  // ============================================================
  $effect(() => {
    if (!gameVisible) return

    const handlers: Array<[Parameters<typeof shortcutService.on>[0], Parameters<typeof shortcutService.on>[1]]> = [
      ['dive',    () => { if ($currentScreen === 'base') handleDive() }],
      ['study',   () => { if ($currentScreen === 'base') handleStudy() }],
      ['back',    () => {
        if ($currentScreen === 'settings') handleBackFromSettings()
        else if ($currentScreen === 'knowledgeTree') handleBackFromTree()
      }],
      ['surface', () => { if ($currentScreen === 'mining') handleSurface() }],
      ['minimap', () => {
        if ($currentScreen === 'mining') {
          document.dispatchEvent(new CustomEvent('game:toggle-minimap'))
        }
      }],
      ['quiz_1',  () => { if ($currentScreen === 'quiz') document.dispatchEvent(new CustomEvent('quiz:answer', { detail: 0 })) }],
      ['quiz_2',  () => { if ($currentScreen === 'quiz') document.dispatchEvent(new CustomEvent('quiz:answer', { detail: 1 })) }],
      ['quiz_3',  () => { if ($currentScreen === 'quiz') document.dispatchEvent(new CustomEvent('quiz:answer', { detail: 2 })) }],
      ['quiz_4',  () => { if ($currentScreen === 'quiz') document.dispatchEvent(new CustomEvent('quiz:answer', { detail: 3 })) }],
    ]

    for (const [id, fn] of handlers) shortcutService.on(id, fn)
    return () => { for (const [id, fn] of handlers) shortcutService.off(id, fn) }
  })

  // ============================================================
  // PHASE 42: DEEP LINK LISTENER — handle incoming universal links
  // ============================================================

  $effect(() => {
    // Register once on mount; the listener handles Capacitor appUrlOpen events
    // and the initial page URL so invite/badge/fact links route correctly.
    // registerDeepLinkListener() has no return value — it sets up a persistent listener.
    registerDeepLinkListener()

    /** Handle terra:deeplink CustomEvents dispatched by deepLinkService. */
    function handleDeepLink(e: Event): void {
      const { route } = (e as CustomEvent<{ route: DeepLinkRoute }>).detail
      if (route.type === 'invite') {
        // Navigate to the referral screen with the incoming code pre-filled.
        // The referral service will attribute the install on the server side.
        currentScreen.set('base')
      } else if (route.type === 'fact') {
        // Future: open the fact reveal for the given factId
        currentScreen.set('base')
      }
      // badge routes are handled on the web (server-rendered OG page) only
    }

    window.addEventListener('terra:deeplink', handleDeepLink)
    return () => {
      window.removeEventListener('terra:deeplink', handleDeepLink)
    }
  })

  // ============================================================
  // PHASE 45: KID MODE — session timer & kid-theme CSS class
  // ============================================================

  /** Reactive session timer state. */
  let timerState = $state<SessionTimerState>({ secondsToday: 0, limitSeconds: 0, warningSent: false, hardStopped: false })

  /** Whether the 5-minute warning banner is visible. */
  let showWarningBanner = $state(false)

  // Subscribe to the session timer
  $effect(() => {
    const unsub = sessionTimer.subscribe((s) => {
      timerState = s
      if (s.warningSent && !s.hardStopped) {
        showWarningBanner = true
      }
      if (s.hardStopped) {
        showWarningBanner = false
      }
    })
    return () => unsub()
  })

  // Start timer when kid-mode player enters the game
  $effect(() => {
    const save = $playerSave
    const parental = $parentalStore
    if (!gameVisible || !save) return
    if (save.ageRating === 'kid' && parental.limitSeconds > 0) {
      sessionTimer.start(parental.limitSeconds)
    }
    return () => sessionTimer.stop()
  })

  // Toggle body.kid-theme CSS class based on player age rating and parental setting
  $effect(() => {
    const save = $playerSave
    const parental = $parentalStore
    const isKid = save?.ageRating === 'kid'
    const themeEnabled = parental.kidThemeEnabled !== false
    if (isKid && themeEnabled) {
      document.body.classList.add('kid-theme')
    } else {
      document.body.classList.remove('kid-theme')
    }
  })
</script>

<div id="game-container"></div>
<div id="ui-overlay" data-screen={$currentScreen}>
  <!-- ============================================================
       AGE GATE — shown on first-ever launch, before everything else
       ============================================================ -->
  {#if showAgeGate}
    <AgeGate onSelect={handleAgeGateSelect} />

  <!-- ============================================================
       PROFILE ROUTING LAYER (Phase 19.6) — shown after age gate,
       before auth, to select or create a player profile
       ============================================================ -->
  {:else if profileScreen === 'select'}
    <ProfileSelectView
      profiles={$profileStore}
      onSelect={handleProfileSelect}
      onAddProfile={handleAddProfile}
      onManageProfiles={handleManageProfiles}
    />
  {:else if profileScreen === 'create'}
    <ProfileCreateView
      onCreated={handleProfileCreated}
      onBack={handleBackFromCreate}
    />
  {:else if profileScreen === 'manage'}
    <ProfileManageView
      onBack={handleBackFromManage}
      onProfileDeleted={handleProfileDeleted}
    />

  <!-- ============================================================
       AUTH ROUTING LAYER — overlays the entire game when visible
       ============================================================ -->
  {:else if authScreen === 'login'}
    <LoginView
      onLogin={handleAuthLogin}
      onRegister={handleAuthGoRegister}
      onForgotPassword={handleAuthGoForgot}
      onGuest={handleAuthGuest}
    />
  {:else if authScreen === 'register'}
    <RegisterView
      onRegisterSuccess={handleAuthLogin}
      onBack={handleAuthBack}
      onViewPrivacy={handleViewPrivacy}
      onViewTerms={handleViewTerms}
    />
  {:else if authScreen === 'forgot'}
    <ForgotPasswordView
      onBack={handleAuthBack}
    />
  {:else if authScreen === 'profile'}
    <ProfileView
      onLogout={handleProfileLogout}
      onBack={() => { authScreen = null }}
    />
  {:else if authScreen === 'privacy'}
    <PrivacyPolicy onBack={() => { authScreen = 'register' }} />
  {:else if authScreen === 'terms'}
    <TermsOfService onBack={() => { authScreen = 'register' }} />
  {:else}
    <!-- Game is visible — normal screen routing below -->

  {#if showResumeModal}
    <ResumeDiveModal onResume={handleResumeDive} onAbandon={handleAbandonDive} />
  {/if}

  {#if $currentScreen === 'cutscene'}
    <OnboardingCutscene onComplete={handleCutsceneComplete} />

  {:else if $currentScreen === 'onboarding'}
    <GaiaIntro onComplete={handleGaiaIntroComplete} />

  {:else if $currentScreen === 'ageSelection'}
    <AgeSelection onComplete={handleAgeSelected} />

  {:else if $currentScreen === 'mainMenu'}
    <div class="main-menu">
      <h1 class="game-title">Terra Gacha</h1>
      <p class="tagline">Mine. Discover. Learn.</p>
      <button class="start-btn" type="button" onclick={handleStart}>Start</button>
    </div>

  {:else if $currentScreen === 'base'}
    <HubView
      onDive={handleDive}
      onStudy={handleStudy}
      onReviewArtifact={handleReviewArtifact}
      onGaiaReport={handleViewGaiaReport}
      onViewTree={handleViewKnowledgeTree}
      onMaterializer={handleViewMaterializer}
      onPremiumMaterializer={handleViewPremiumMaterializer}
      onCosmetics={handleViewCosmeticsShop}
      onKnowledgeStore={handleViewKnowledgeStore}
      onFossils={handleViewFossils}
      onZoo={handleViewZoo}
      onStreakPanel={handleViewStreakPanel}
      onFarm={handleViewFarm}
      onSettings={handleViewSettings}
      facts={cachedFacts}
    />
    <GaiaToast />

  {:else if $currentScreen === 'divePrepScreen'}
    <DivePrepScreen
      availableTanks={$playerSave?.oxygen ?? 0}
      onStartDive={handleStartDive}
      onBack={handleBackFromDivePrep}
      nextBiomeName={previewBiome?.name}
      nextBiomeDesc={previewBiome?.description}
    />

  {:else if $currentScreen === 'mining'}
    <HUD
      onSurface={handleSurface}
      onOpenBackpack={handleOpenBackpack}
      onOpenRunStats={handleOpenRunStats}
      onUseBomb={handleUseBomb}
      onUseConsumable={handleUseConsumable}
    />
    <MiniMap />
    <DescentOverlay
      visible={$descentOverlayState.visible}
      fromLayer={$descentOverlayState.fromLayer}
      toLayer={$descentOverlayState.toLayer}
      biomeName={$descentOverlayState.biomeName}
      onAnimComplete={() => descentOverlayState.update(s => ({ ...s, visible: false }))}
    />
    {#if $quizStreak.count >= 3}
      <div style="position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 120; pointer-events: none;">
        <StreakFeedback streakCount={$quizStreak.count} multiplier={$quizStreak.multiplier} />
      </div>
    {/if}

  {:else if $currentScreen === 'quiz' && $activeQuiz}
    {#if quizMode === 'gate'}
      <HUD
        onSurface={handleSurface}
        onOpenBackpack={handleOpenBackpack}
        onOpenRunStats={handleOpenRunStats}
        onUseBomb={handleUseBomb}
        onUseConsumable={handleUseConsumable}
      />
    {/if}
    <QuizOverlay
      fact={$activeQuiz.fact}
      choices={$activeQuiz.choices}
      mode={quizMode}
      gateProgress={$activeQuiz.gateProgress}
      isConsistencyPenalty={$activeQuiz.isConsistencyPenalty ?? false}
      onAnswer={handleQuizAnswer}
      onClose={handleQuizClose}
    />

  {:else if $currentScreen === 'backpack'}
    <HUD
      onSurface={handleSurface}
      onOpenBackpack={handleOpenBackpack}
      onOpenRunStats={handleOpenRunStats}
      onUseBomb={handleUseBomb}
      onUseConsumable={handleUseConsumable}
    />
    <BackpackOverlay
      slots={$inventory}
      onClose={handleCloseBackpack}
      onDropItem={handleDropItem}
    />

  {:else if $currentScreen === 'runStats'}
    <HUD
      onSurface={handleSurface}
      onOpenBackpack={handleOpenBackpack}
      onOpenRunStats={handleOpenRunStats}
      onUseBomb={handleUseBomb}
      onUseConsumable={handleUseConsumable}
    />
    <RunStatsOverlay
      blocksMined={$blocksMinedLive}
      onClose={handleCloseRunStats}
    />

  {:else if $currentScreen === 'factReveal'}
    {#if $activeFact}
      <FactReveal
        fact={$activeFact}
        onLearn={handleLearnFact}
        onSell={handleSellFact}
      />
    {:else}
      <div class="empty-screen">
        <p class="empty-icon">🔬</p>
        <p class="empty-title">Artifact Lab</p>
        <p class="empty-message">No artifacts waiting for review. Find more during your next dive!</p>
        <button class="btn-back" type="button" onclick={() => currentScreen.set('base')}>← Back to Hub</button>
      </div>
    {/if}

  {:else if $currentScreen === 'knowledgeTree'}
    <KnowledgeTreeView
      facts={cachedFacts}
      onBack={handleBackFromTree}
    />

  {:else if $currentScreen === 'diveResults'}
    <DiveResults onContinue={handleDiveResultsContinue} onDiveDeeper={() => getGM()?.continueToNextLayer()} />

  {:else if $currentScreen === 'studySession'}
    <StudySession
      facts={$studyFacts}
      reviewStates={$studyReviewStates}
      onAnswer={handleStudyCardAnswer}
      onComplete={handleStudyComplete}
    />

  {:else if $currentScreen === 'materializer'}
    <Materializer onBack={handleBackFromMaterializer} />

  {:else if $currentScreen === 'premiumMaterializer'}
    <PremiumMaterializer onBack={handleBackFromPremiumMaterializer} />

  {:else if $currentScreen === 'cosmeticsShop'}
    <CosmeticsShop onBack={handleBackFromCosmeticsShop} />

  {:else if $currentScreen === 'knowledgeStore'}
    <KnowledgeStore onBack={handleBackFromKnowledgeStore} />

  {:else if $currentScreen === 'fossilGallery'}
    <FossilGallery onBack={handleBackFromFossils} />

  {:else if $currentScreen === 'zoo'}
    <Zoo onBack={handleBackFromZoo} />

  {:else if $currentScreen === 'streakPanel'}
    <StreakPanel onBack={handleBackFromStreakPanel} />

  {:else if $currentScreen === 'farm'}
    <Farm onBack={handleBackFromFarm} />

  {:else if $currentScreen === 'settings'}
    <Settings onBack={handleBackFromSettings} onViewProfile={handleViewProfile} />

  {:else if $currentScreen === 'gaiaReport'}
    <GaiaReport onBack={() => currentScreen.set('base')} />

  {:else if $currentScreen === 'interestSettings'}
    <InterestSettings onBack={() => currentScreen.set('settings')} />

  {:else if $currentScreen === 'interestAssessment'}
    <InterestAssessment />

  {:else if $currentScreen === 'sacrifice' && !$activeAltar}
    <SacrificeOverlay />

  {:else if $currentScreen === 'decision'}
    <DecisionScreen />
  {/if}

  {#if $showSendUp}
    <SendUpOverlay
      slots={$inventory}
      currentLayer={$currentLayer}
      onConfirm={handleSendUpConfirm}
      onSkip={handleSendUpSkip}
    />
  {/if}

  {#if $pendingRelicPickup}
    <RelicPickupOverlay
      relic={$pendingRelicPickup}
      onAccept={() => {
        const relic = $pendingRelicPickup
        if (relic) {
          equippedRelicsV2.update(relics => relics.length < 3 ? [...relics, relic] : relics)
        }
        pendingRelicPickup.set(null)
      }}
      onDecline={() => pendingRelicPickup.set(null)}
    />
  {/if}

  <!-- Phase 44: Teacher announcement banner (student-facing, dismissable) -->
  {#if gameVisible}
    <div style="position: fixed; top: 8px; left: 50%; transform: translateX(-50%); width: min(90vw, 480px); z-index: 300; pointer-events: auto;">
      <AnnouncementBanner />
    </div>
  {/if}

  <!-- Phase 35: Mine Mechanics HUD overlays (self-conditionally shown during mining) -->
  <QuizStreakBadge />
  <InstabilityMeter />
  <MineEventOverlay />
  <AltarSacrificeOverlay />

  <!-- Phase 36: Combat overlays -->
  {#if $combatState.active && $combatState.encounterType === 'boss' && showBossIntro && $combatState.creature}
    <BossIntroOverlay
      boss={$combatState.creature as import('./game/entities/Boss').Boss}
      onDismiss={() => { showBossIntro = false }}
    />
  {:else if $combatState.active}
    <CombatOverlay />
  {/if}
  {#if $currentScreen === 'the-deep-unlock'}
    <TheDeepUnlockOverlay onProceed={() => currentScreen.set('mining')} />
  {/if}

  <DevPanel />
  <PwaInstallPrompt />
  <KeyboardShortcutHelp />
  {#if gameVisible}
    <DesktopSidePanel />
  {/if}

  <!-- Phase 45: Session warning banner (5 min remaining) -->
  {#if showWarningBanner && !timerState.hardStopped}
    <SessionWarningBanner
      minutesRemaining={Math.ceil((timerState.limitSeconds - timerState.secondsToday) / 60)}
      onDismiss={() => { showWarningBanner = false }}
    />
  {/if}

  <!-- Phase 45: Time-up hard stop overlay -->
  {#if timerState.hardStopped}
    <TimeUpOverlay secondsPlayed={timerState.secondsToday} />
  {/if}

  {/if}
  <!-- /AUTH ROUTING LAYER -->
</div>
<OfflineToast />
<!-- ATT consent prompt (Phase 38): fires the iOS App Tracking Transparency dialog.
     Mounted outside the auth layer so it triggers on every cold app launch.
     No visible UI — the OS native dialog is presented by the Capacitor plugin. -->
<ATTConsentPrompt />

<style>
  .main-menu {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    background: var(--color-bg);
    z-index: 30;
    font-family: 'Courier New', monospace;
  }

  .game-title {
    font-size: clamp(2.5rem, 8vw, 4rem);
    color: var(--color-warning);
    text-transform: uppercase;
    letter-spacing: 4px;
    text-shadow: 0 0 20px rgba(255, 211, 105, 0.3);
  }

  .tagline {
    color: var(--color-text-dim);
    font-size: 1.1rem;
    letter-spacing: 2px;
  }

  .start-btn {
    margin-top: 1rem;
    min-width: 200px;
    min-height: 56px;
    border: 2px solid var(--color-success);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-success) 25%, var(--color-surface) 75%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 2px;
    cursor: pointer;
    transition: transform 120ms ease, background-color 120ms ease;
  }

  .start-btn:active {
    transform: scale(0.97);
    background: color-mix(in srgb, var(--color-success) 40%, var(--color-surface) 60%);
  }

  .empty-screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: 'Press Start 2P', monospace;
    text-align: center;
    padding: 2rem;
    z-index: 10;
  }
  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  .empty-title {
    font-size: 1.2rem;
    color: #4ecca3;
    margin-bottom: 1rem;
  }
  .empty-message {
    font-size: 0.7rem;
    line-height: 1.6;
    color: #aaa;
    max-width: 300px;
    margin-bottom: 2rem;
  }
  .btn-back {
    background: #2a2a4a;
    color: #4ecca3;
    border: 2px solid #4ecca3;
    padding: 0.6rem 1.2rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.65rem;
    cursor: pointer;
    border-radius: 4px;
  }
  .btn-back:hover {
    background: #4ecca3;
    color: #1a1a2e;
  }
</style>
