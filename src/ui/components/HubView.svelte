<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { getDefaultHubStack } from '../../data/hubFloors'
  import { BALANCE } from '../../data/balance'
  import { playerSave, isMorningReviewAvailable, isEveningReviewAvailable } from '../stores/playerData'
  import { currentFloorIndex } from '../stores/gameState'
  import FloorIndicator from './FloorIndicator.svelte'
  import type { Fact } from '../../data/types'
  import { gameManagerStore, getGM } from '../../game/gameManagerRef'
  import { hubEvents } from '../../game/hubEvents'
  import GaiaThoughtBubble from './GaiaThoughtBubble.svelte'
  import PaintRevealOverlay from './PaintRevealOverlay.svelte'
  import AchievementGalleryView from './AchievementGalleryView.svelte'
  import { pendingReveal } from '../stores/achievements'
  import PrestigeScreen from './PrestigeScreen.svelte'
  import PrestigeBadge from './PrestigeBadge.svelte'
  import OmniscientReveal from './OmniscientReveal.svelte'
  import { isEligibleForPrestige, isOmniscient } from '../../services/prestigeService'
  import { fetchFactOfDay, type FactOfDay } from '../../services/factOfDayService'
  import { addLearnedFact } from '../stores/playerData'

  interface Props {
    onDive: () => void
    onStudy?: () => void
    onReviewArtifact?: () => void
    onGaiaReport?: () => void
    onViewTree?: () => void
    onMaterializer?: () => void
    onPremiumMaterializer?: () => void
    onCosmetics?: () => void
    onKnowledgeStore?: () => void
    onFossils?: () => void
    onZoo?: () => void
    onStreakPanel?: () => void
    onFarm?: () => void
    onDecorator?: () => void
    onSettings?: () => void
    facts?: Fact[]
  }

  const {
    onDive, onStudy, onReviewArtifact, onGaiaReport, onViewTree,
    onMaterializer, onPremiumMaterializer, onCosmetics,
    onKnowledgeStore, onFossils, onZoo, onStreakPanel,
    onFarm, onDecorator, onSettings,
  }: Props = $props()

  const hubStack = getDefaultHubStack()

  // Derive hub state from playerSave
  const unlockedIds = $derived.by(() => {
    const hubFloorIds = $playerSave?.hubState?.unlockedFloorIds ?? ['starter']
    const legacyRooms = $playerSave?.unlockedRooms ?? ['command']
    // Merge both sources — hubState is canonical, but legacy rooms provide backward compat
    const merged = new Set<string>(hubFloorIds)
    merged.add('starter') // always present
    for (const roomId of legacyRooms) {
      const mapped: Record<string, string> = {
        command: 'starter', lab: 'starter', workshop: 'workshop',
        museum: 'museum', market: 'market', archive: 'archive',
      }
      if (mapped[roomId]) merged.add(mapped[roomId])
    }
    return [...merged]
  })
  const floorTiers    = $derived(($playerSave?.hubState?.floorTiers ?? { starter: 0 }) as Record<string, number>)
  const masteredCount = $derived(
    ($playerSave?.reviewStates ?? []).filter(rs => rs.repetitions >= 6).length
  )

  // Filter to unlocked floors only
  const unlockedFloors = $derived(
    hubStack.floors.filter(f => unlockedIds.includes(f.id))
  )

  let floorIndex = $state(0)

  // Sync floor index to the shared store
  $effect(() => {
    currentFloorIndex.set(floorIndex)
  })

  // Clamp floor index if unlocked floors shrinks
  $effect(() => {
    if (floorIndex >= unlockedFloors.length) {
      floorIndex = Math.max(0, unlockedFloors.length - 1)
    }
  })

  // Keep DomeScene in sync when player save or floor index changes
  $effect(() => {
    const gm = getGM()
    const dome = gm?.getDomeScene()
    if (dome) {
      dome.setHubState(unlockedIds, floorTiers, masteredCount)
      dome.setOmniscient(omniscientStatus)
    }
  })

  $effect(() => {
    const gm = getGM()
    const dome = gm?.getDomeScene()
    if (dome) {
      dome.goToFloor(floorIndex)
    }
  })

  // Touch navigation
  let touchStartY = $state(0)

  function handleTouchStart(e: TouchEvent): void {
    touchStartY = e.touches[0].clientY
  }

  function handleTouchEnd(e: TouchEvent): void {
    const deltaY = touchStartY - e.changedTouches[0].clientY
    if (Math.abs(deltaY) > 40) {
      if (deltaY > 0 && floorIndex < unlockedFloors.length - 1) {
        floorIndex++
      } else if (deltaY < 0 && floorIndex > 0) {
        floorIndex--
      }
    }
  }

  function handleWheel(e: WheelEvent): void {
    e.preventDefault()
    if (e.deltaY > 0 && floorIndex < unlockedFloors.length - 1) {
      floorIndex++
    } else if (e.deltaY < 0 && floorIndex > 0) {
      floorIndex--
    }
  }

  function handleFloorSelect(index: number): void {
    if (index >= 0 && index < unlockedFloors.length) {
      floorIndex = index
    }
  }

  function handleObjectTap(objectId: string, action: string): void {
    if (action === 'dive') { onDive(); return }
    if (action === 'none') return
    switch (action) {
      case 'knowledgeTree':       onViewTree?.(); break
      case 'workshop':
      case 'materializer':        onMaterializer?.(); break
      case 'premiumMaterializer': onPremiumMaterializer?.(); break
      case 'cosmeticsShop':       onCosmetics?.(); break
      case 'knowledgeStore':      onKnowledgeStore?.(); break
      case 'fossilGallery':       onFossils?.(); break
      case 'zoo':                 onZoo?.(); break
      case 'streakPanel':         onStreakPanel?.(); break
      case 'farm':                onFarm?.(); break
      case 'decorator':           onDecorator?.(); break
      case 'studySession':        onStudy?.(); break
      case 'reviewArtifact':      onReviewArtifact?.(); break
      case 'settings':            onSettings?.(); break
      case 'command':             onGaiaReport?.(); break
      case 'gaiaReport':          onGaiaReport?.(); break
      // Phase 47: Achievement Gallery
      case 'galleryPainting':
      case 'galleryOverview':     showGallery = true; break
      default: break
    }
  }

  // Gallery panel state (Phase 47)
  let showGallery = $state(false)

  // Phase 48: Prestige & Endgame
  let showPrestigeScreen = $state(false)

  const prestigeLevel = $derived($playerSave?.prestigeLevel ?? 0)
  const prestigeEligible = $derived($playerSave ? isEligibleForPrestige($playerSave) : false)
  const omniscientStatus = $derived($playerSave ? isOmniscient($playerSave) : false)

  // Phase 56: Fact of the Day
  let factOfDay = $state<FactOfDay | null>(null)
  let factDismissed = $state(false)

  $effect(() => {
    fetchFactOfDay().then(f => { factOfDay = f }).catch(() => {})
  })

  const factAlreadyLearned = $derived(
    factOfDay ? ($playerSave?.learnedFacts ?? []).includes(factOfDay.factId) : false
  )

  function dismissFact(): void {
    factDismissed = true
  }

  function addFactToStudy(): void {
    if (factOfDay && !factAlreadyLearned) {
      addLearnedFact(factOfDay.factId)
    }
  }

  // Phase 52: Morning/evening review bonus
  const showMorningPrompt = $derived(
    $playerSave ? isMorningReviewAvailable($playerSave) : false
  )
  const showEveningPrompt = $derived(
    $playerSave ? isEveningReviewAvailable($playerSave) : false
  )

  function startMorningReview(): void {
    // Trigger a study session — StudyManager detects the morning window
    onStudy?.()
  }

  function startEveningReview(): void {
    // Trigger a study session — StudyManager detects the evening window
    onStudy?.()
  }

  // ---- Lifecycle ----

  let hubEventsConnected = false

  onMount(() => {
    let unsub: (() => void) | undefined
    unsub = gameManagerStore.subscribe(gm => {
      if (!gm || hubEventsConnected) return
      hubEventsConnected = true

      // Start DomeScene, passing current hub state
      gm.startDome({
        unlockedIds,
        floorTiers,
        masteredCount,
        floorIndex,
      })

      // Listen for object taps emitted by DomeScene
      hubEvents.on('objectTap', handleObjectTap)

      // Phase 15.5: Fire return engagement greeting before idle bubbles start.
      // This takes priority over the idle bubble timer so the welcome message
      // is the first thing the player sees when they open or return to the app.
      gm.getGaiaManager()?.fireReturnEngagement()

      // Start GAIA idle thought bubble timer (Phase 15.2)
      gm.getGaiaManager()?.startIdleBubbleTimer()

      // Phase 15.4: Fire a journey memory comment after a short delay so the
      // player has time to see the dome before GAIA references their history.
      setTimeout(() => {
        gm.getGaiaManager()?.fireJourneyMemory()
      }, 2000)

      // Defer unsub to next microtask so subscribe() can return first,
      // avoiding a TDZ error when the store already has a non-null value
      // at mount time (synchronous callback invocation).
      queueMicrotask(() => unsub?.())
    })

    // Floor navigation listeners — attached to document since hub-view
    // has pointer-events:none for Phaser canvas passthrough
    document.addEventListener('touchstart', handleTouchStart as unknown as EventListener)
    document.addEventListener('touchend', handleTouchEnd as unknown as EventListener)
    document.addEventListener('wheel', handleWheel as unknown as EventListener, { passive: false })
  })

  onDestroy(() => {
    document.removeEventListener('touchstart', handleTouchStart as unknown as EventListener)
    document.removeEventListener('touchend', handleTouchEnd as unknown as EventListener)
    document.removeEventListener('wheel', handleWheel as unknown as EventListener)
    hubEvents.off('objectTap', handleObjectTap)
    // Stop GAIA thought bubble timer on cleanup (Phase 15.2)
    const gm = getGM()
    gm?.getGaiaManager().stopIdleBubbleTimer()
    // Do NOT stop DomeScene here — GameManager.startDive() / stopDome() handles that
    // so we don't flicker when navigating to other hub sub-screens.
  })
</script>

<div class="hub-view">
  <!-- Resource bar at top -->
  <div class="hub-resource-bar">
    {#if $playerSave}
      <span class="res">💎 {$playerSave.minerals.dust}</span>
      <span class="res">🔷 {$playerSave.minerals.shard}</span>
      <span class="res">💠 {$playerSave.minerals.crystal}</span>
      <span class="res">🫧 {$playerSave.oxygen} O₂</span>
    {/if}
  </div>

  <!-- Phase 52: Morning/Evening review bonus banners -->
  {#if showMorningPrompt}
    <div class="review-bonus-banner morning">
      <span class="review-icon">🌅</span>
      <div class="review-text">
        <strong>Morning Review</strong>
        <small>Answer {BALANCE.MORNING_REVIEW_FACT_COUNT} facts — earn +{BALANCE.MORNING_REVIEW_O2_BONUS} O₂ Tank</small>
      </div>
      <button class="review-start-btn" type="button" onclick={startMorningReview}>Start</button>
    </div>
  {/if}
  {#if showEveningPrompt}
    <div class="review-bonus-banner evening">
      <span class="review-icon">🌙</span>
      <div class="review-text">
        <strong>Evening Review</strong>
        <small>Answer {BALANCE.EVENING_REVIEW_FACT_COUNT} facts — earn +{BALANCE.EVENING_REVIEW_O2_BONUS} O₂ Tank</small>
      </div>
      <button class="review-start-btn" type="button" onclick={startEveningReview}>Start</button>
    </div>
  {/if}

  <!-- Phase 56: Today's Discovery panel -->
  {#if factOfDay && !factDismissed}
    <div class="fact-of-day-panel" role="region" aria-label="Today's Discovery">
      <div class="fact-header">
        <span class="fact-category-tag">{factOfDay.category}</span>
        <button class="fact-dismiss-btn" type="button" onclick={dismissFact} aria-label="Dismiss">&#x2715;</button>
      </div>
      <p class="fact-statement">{factOfDay.statement}</p>
      <p class="fact-gaia-comment">GAIA: "{factOfDay.gaiaComment}"</p>
      <div class="fact-actions">
        {#if factAlreadyLearned}
          <button class="fact-add-btn" type="button" disabled>Already in collection</button>
        {:else}
          <button class="fact-add-btn fact-add-active" type="button" onclick={addFactToStudy}>Add to Study</button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Settings button — always visible in dome -->
  <button class="settings-btn" type="button" onclick={() => onSettings?.()} aria-label="Open settings">
    ⚙
  </button>

  <FloorIndicator
    floors={hubStack.floors}
    {unlockedIds}
    currentIndex={floorIndex}
    onFloorSelect={handleFloorSelect}
  />

  <!-- Phase 15.2: GAIA idle thought bubbles -->
  <GaiaThoughtBubble />

  <!-- Phase 47: Achievement Gallery view -->
  {#if showGallery}
    <AchievementGalleryView onClose={() => { showGallery = false }} />
  {/if}

  <!-- Phase 47: Paint reveal overlay -->
  {#if $pendingReveal}
    <PaintRevealOverlay />
  {/if}

  <!-- Phase 48: Prestige badge and button -->
  {#if prestigeLevel > 0}
    <div class="prestige-badge-row">
      <PrestigeBadge level={prestigeLevel} />
    </div>
  {/if}

  {#if prestigeEligible}
    <button
      type="button"
      class="prestige-btn"
      onclick={() => { showPrestigeScreen = true }}
      aria-label="Open Prestige screen"
    >
      PRESTIGE
    </button>
  {/if}

  <!-- Phase 48: Prestige screen overlay -->
  {#if showPrestigeScreen}
    <PrestigeScreen onClose={() => { showPrestigeScreen = false }} />
  {/if}

  <!-- Phase 48: Omniscient reveal (one-time) -->
  {#if omniscientStatus && !$playerSave?.omniscientUnlockedAt}
    <OmniscientReveal onDone={() => { /* store updated inside component */ }} />
  {/if}
</div>

<style>
  /* Transparent overlay — DomeScene renders behind this in #game-container */
  .hub-view {
    width: 100%;
    height: 100vh;
    position: relative;
    /* Canvas passthrough — DomeScene handles clicks via Phaser input.
       Interactive children (resource bar, floor indicator) opt in individually. */
    pointer-events: none;
  }

  .hub-resource-bar {
    pointer-events: auto;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 8px 12px;
    background: rgba(10,10,30,0.85);
    z-index: 40;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #ccc;
  }

  .res {
    white-space: nowrap;
  }

  .settings-btn {
    pointer-events: auto;
    position: absolute;
    top: 0;
    right: 48px;
    background: rgba(10, 10, 30, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0 0 0 6px;
    color: #aaa;
    font-size: 18px;
    width: 40px;
    height: 40px;
    cursor: pointer;
    z-index: 41;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }

  .settings-btn:hover {
    color: #fff;
    background: rgba(20, 20, 50, 0.95);
  }

  /* Phase 48: Prestige elements */
  .prestige-badge-row {
    pointer-events: auto;
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 42;
  }

  .prestige-btn {
    pointer-events: auto;
    position: absolute;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #ffd700, #ff8c00);
    border: none;
    border-radius: 6px;
    color: #0a0a1a;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    padding: 8px 18px;
    cursor: pointer;
    z-index: 42;
    animation: prestige-pulse 2s ease-in-out infinite;
    min-height: 32px;
  }

  @keyframes prestige-pulse {
    0%, 100% { box-shadow: 0 0 8px rgba(255, 215, 0, 0.4); }
    50% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.9); }
  }

  /* Phase 52: Review bonus banners */
  .review-bonus-banner {
    pointer-events: auto;
    position: absolute;
    top: 44px;
    left: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    z-index: 42;
    animation: banner-slide-in 300ms ease-out;
  }

  .review-bonus-banner.morning {
    background: linear-gradient(135deg, rgba(255, 183, 77, 0.25), rgba(255, 138, 0, 0.15));
    border: 1px solid rgba(255, 183, 77, 0.5);
  }

  .review-bonus-banner.evening {
    background: linear-gradient(135deg, rgba(100, 100, 255, 0.25), rgba(80, 80, 200, 0.15));
    border: 1px solid rgba(100, 100, 255, 0.5);
    top: 44px;
  }

  .review-bonus-banner.morning + .review-bonus-banner.evening {
    top: 104px;
  }

  .review-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .review-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .review-text strong {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    color: #fff;
  }

  .review-text small {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #ccc;
  }

  .review-start-btn {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: #fff;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    padding: 6px 12px;
    cursor: pointer;
    min-height: 32px;
    transition: background 0.15s;
  }

  .review-start-btn:active {
    background: rgba(255, 255, 255, 0.3);
  }

  @keyframes banner-slide-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Phase 56: Fact of the Day panel */
  .fact-of-day-panel {
    pointer-events: auto;
    position: absolute;
    bottom: 120px;
    left: 12px;
    right: 12px;
    background: linear-gradient(135deg, rgba(40, 80, 160, 0.3), rgba(30, 60, 120, 0.2));
    border: 1px solid rgba(80, 140, 220, 0.45);
    border-radius: 12px;
    padding: 12px 14px;
    z-index: 42;
    animation: banner-slide-in 300ms ease-out;
    max-width: 400px;
    margin: 0 auto;
  }

  .fact-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .fact-category-tag {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #6cb4ee;
    background: rgba(80, 140, 220, 0.2);
    border: 1px solid rgba(80, 140, 220, 0.35);
    border-radius: 4px;
    padding: 3px 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .fact-dismiss-btn {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    color: #888;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .fact-dismiss-btn:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #ccc;
  }

  .fact-statement {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #e0e8f0;
    line-height: 1.5;
    margin: 0 0 6px;
  }

  .fact-gaia-comment {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #8ab8e0;
    font-style: italic;
    margin: 0;
    line-height: 1.4;
  }

  .fact-actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
  }

  .fact-add-btn {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #888;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    padding: 5px 10px;
    cursor: default;
    min-height: 28px;
  }

  .fact-add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .fact-add-active {
    background: rgba(80, 140, 220, 0.2);
    border-color: rgba(80, 140, 220, 0.45);
    color: #6cb4ee;
    cursor: pointer;
    transition: background 0.15s;
  }

  .fact-add-active:active {
    background: rgba(80, 140, 220, 0.35);
  }
</style>
