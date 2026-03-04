<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { getDefaultHubStack } from '../../data/hubFloors'
  import type { FloorUpgradeTier } from '../../data/hubLayout'
  import { playerSave } from '../stores/playerData'
  import { currentFloorIndex } from '../stores/gameState'
  import FloorIndicator from './FloorIndicator.svelte'
  import FloorUpgradePanel from './FloorUpgradePanel.svelte'
  import { upgradeFloor } from '../stores/playerData'
  import type { Fact } from '../../data/types'
  import { gameManagerStore, getGM } from '../../game/gameManagerRef'
  import { hubEvents } from '../../game/hubEvents'
  import GaiaThoughtBubble from './GaiaThoughtBubble.svelte'

  interface Props {
    onDive: () => void
    onStudy?: () => void
    onReviewArtifact?: () => void
    onViewTree?: () => void
    onMaterializer?: () => void
    onPremiumMaterializer?: () => void
    onCosmetics?: () => void
    onKnowledgeStore?: () => void
    onFossils?: () => void
    onZoo?: () => void
    onStreakPanel?: () => void
    onFarm?: () => void
    onSettings?: () => void
    facts?: Fact[]
  }

  const {
    onDive, onStudy, onReviewArtifact, onViewTree,
    onMaterializer, onPremiumMaterializer, onCosmetics,
    onKnowledgeStore, onFossils, onZoo, onStreakPanel,
    onFarm, onSettings,
  }: Props = $props()

  const hubStack = getDefaultHubStack()

  // Derive hub state from playerSave
  const unlockedIds   = $derived($playerSave?.hubState?.unlockedFloorIds ?? ['starter'])
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
      case 'studySession':        onStudy?.(); break
      case 'settings':            onSettings?.(); break
      case 'command':             onStudy?.(); break // GAIA terminal -> study for now
      default: break
    }
  }

  // Upgrade panel state
  let showUpgradePanel = $state(false)

  function handleUpgrade(floorId: string, targetTier: FloorUpgradeTier): void {
    upgradeFloor(floorId, targetTier)
    showUpgradePanel = false
  }

  // ---- Lifecycle ----

  let hubEventsConnected = false

  onMount(() => {
    const unsub = gameManagerStore.subscribe(gm => {
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
      gm.getGaiaManager().fireReturnEngagement()

      // Start GAIA idle thought bubble timer (Phase 15.2)
      gm.getGaiaManager().startIdleBubbleTimer()

      // Phase 15.4: Fire a journey memory comment after a short delay so the
      // player has time to see the dome before GAIA references their history.
      setTimeout(() => {
        gm.getGaiaManager().fireJourneyMemory()
      }, 2000)

      unsub()
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
    <button class="upgrade-floor-btn" onclick={() => { showUpgradePanel = true }} aria-label="Upgrade current floor">⬆</button>
  </div>

  {#if showUpgradePanel}
    <FloorUpgradePanel
      floorId={unlockedFloors[floorIndex]?.id ?? 'starter'}
      currentTier={(floorTiers[unlockedFloors[floorIndex]?.id ?? 'starter'] ?? 0) as FloorUpgradeTier}
      onClose={() => { showUpgradePanel = false }}
      onUpgrade={handleUpgrade}
    />
  {/if}

  <FloorIndicator
    floors={hubStack.floors}
    {unlockedIds}
    currentIndex={floorIndex}
    onFloorSelect={handleFloorSelect}
  />

  <!-- Phase 15.2: GAIA idle thought bubbles -->
  <GaiaThoughtBubble />
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

  .upgrade-floor-btn {
    background: #4ecca3;
    color: #0a0a1a;
    border: none;
    border-radius: 4px;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    padding: 4px 8px;
    cursor: pointer;
    min-height: 28px;
    min-width: 32px;
    margin-left: auto;
  }

  .upgrade-floor-btn:hover {
    background: #6eddb8;
  }
</style>
