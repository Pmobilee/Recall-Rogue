<script lang="ts">
  import { untrack } from 'svelte'
  import { getMasteryLevel } from '../../services/sm2'
  import { pendingArtifacts } from '../stores/gameState'
  import { getDueReviews, playerSave, persistPlayer } from '../stores/playerData'
  import { audioManager } from '../../services/audioService'
  import {
    gaiaMood,
    type GaiaMood,
  } from '../stores/settings'
  import { GAIA_IDLE_QUIPS } from '../../data/gaiaDialogue'
  import { GAIA_EXPRESSIONS, GAIA_NAME, GAIA_FULL_NAME, GAIA_TAGLINE, getGaiaExpression } from '../../data/gaiaAvatar'
  import { BALANCE } from '../../data/balance'
  import type { Fact } from '../../data/types'
  import MineralConverter from './MineralConverter.svelte'
  import CompanionBadge from './CompanionBadge.svelte'
  import { DATA_DISCS } from '../../data/dataDiscs'
  import { getTodaysDeals, getTimeUntilReset, type DailyDeal } from '../../data/dailyDeals'
  import { purchaseDeal } from '../../services/saveService'
  import { calculateTotalPending } from '../../data/farm'
  import type { FarmSlot } from '../../data/types'

  /** Pick a random idle quip from the pool matching the current mood. */
  function randomIdleQuip(mood: GaiaMood): string {
    const pool = GAIA_IDLE_QUIPS[mood]
    return pool[Math.floor(Math.random() * pool.length)]
  }

  let gaiaComment = $state(randomIdleQuip($gaiaMood))
  let gaiaVisible = $state(true)
  /** Expression id for the currently shown idle quip */
  let idleExpressionId = $state(getGaiaExpression('idle', $gaiaMood).id)

  $effect(() => {
    // Re-pick immediately when the mood changes (reactive on $gaiaMood)
    gaiaComment = randomIdleQuip($gaiaMood)
    idleExpressionId = getGaiaExpression('idle', $gaiaMood).id
    gaiaVisible = true
  })

  $effect(() => {
    const interval = setInterval(() => {
      gaiaVisible = false
      setTimeout(() => {
        gaiaComment = randomIdleQuip($gaiaMood)
        idleExpressionId = getGaiaExpression('idle', $gaiaMood).id
        gaiaVisible = true
      }, 400)
    }, 12000)

    return () => {
      clearInterval(interval)
    }
  })

  const idleEmoji = $derived(
    (GAIA_EXPRESSIONS[idleExpressionId] ?? GAIA_EXPRESSIONS.neutral).emoji
  )

  interface Props {
    onDive: () => void
    onStudy: () => void
    onReviewArtifact: () => void
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

  let { onDive, onStudy, onReviewArtifact, onViewTree, onMaterializer, onPremiumMaterializer, onCosmetics, onKnowledgeStore, onFossils, onZoo, onStreakPanel, onFarm, onSettings, facts }: Props = $props()

  const dueReviews = $derived.by(() => {
    $playerSave
    return getDueReviews()
  })

  const dueReviewCount = $derived(dueReviews.length)
  const hasDueReviews = $derived(dueReviewCount > 0)
  const artifactCount = $derived($pendingArtifacts.length)
  const hasArtifacts = $derived(artifactCount > 0)

  const learnedFactsWithMastery = $derived.by(() => {
    const save = $playerSave

    if (!save) {
      return [] as Array<{ factId: string; statement: string; mastery: string }>
    }

    return save.learnedFacts.map((factId: string) => {
      const reviewState = save.reviewStates.find((state: { factId: string }) => state.factId === factId)
      const factObj = facts?.find(f => f.id === factId)

      return {
        factId,
        statement: factObj?.statement ?? factId,
        mastery: reviewState ? getMasteryLevel(reviewState) : 'new',
      }
    })
  })

  const stats = $derived(
    $playerSave?.stats ?? {
      totalBlocksMined: 0,
      totalDivesCompleted: 0,
      deepestLayerReached: 0,
      totalFactsLearned: 0,
      totalFactsSold: 0,
      totalQuizCorrect: 0,
      totalQuizWrong: 0,
      currentStreak: 0,
      bestStreak: 0,
    },
  )

  const oxygen = $derived($playerSave?.oxygen ?? 0)
  const dust = $derived($playerSave?.minerals.dust ?? 0)
  const shard = $derived($playerSave?.minerals.shard ?? 0)
  const crystal = $derived($playerSave?.minerals.crystal ?? 0)
  const geode = $derived($playerSave?.minerals.geode ?? 0)
  const essence = $derived($playerSave?.minerals.essence ?? 0)

  // Insurance
  const insuredDive = $derived($playerSave?.insuredDive ?? false)
  const insuranceCost = $derived(Math.floor(dust * BALANCE.INSURANCE_COST_PERCENT))
  const canAffordInsurance = $derived(dust >= insuranceCost && insuranceCost > 0)

  function handleToggleInsurance(): void {
    const save = $playerSave
    if (!save) return
    audioManager.playSound('button_click')
    const newValue = !save.insuredDive
    playerSave.update(s => s ? { ...s, insuredDive: newValue } : s)
    persistPlayer()
  }

  const unlockedDiscIds = $derived($playerSave?.unlockedDiscs ?? [])
  const unlockedDiscObjects = $derived(
    DATA_DISCS.filter(d => unlockedDiscIds.includes(d.id))
  )
  const discCount = $derived(unlockedDiscIds.length)
  const totalDiscs = DATA_DISCS.length

  function formatMasteryLabel(level: string): string {
    return level.charAt(0).toUpperCase() + level.slice(1)
  }

  function handleDive(): void {
    audioManager.playSound('button_click')
    onDive()
  }
  function handleStudy(): void {
    audioManager.playSound('button_click')
    onStudy()
  }
  function handleReviewArtifact(): void {
    audioManager.playSound('button_click')
    onReviewArtifact()
  }

  function handleViewTree(): void {
    audioManager.playSound('button_click')
    onViewTree?.()
  }

  function handleMaterializer(): void {
    audioManager.playSound('button_click')
    onMaterializer?.()
  }

  function handlePremiumMaterializer(): void {
    audioManager.playSound('button_click')
    onPremiumMaterializer?.()
  }

  function handleCosmetics(): void {
    audioManager.playSound('button_click')
    onCosmetics?.()
  }

  function handleKnowledgeStore(): void {
    audioManager.playSound('button_click')
    onKnowledgeStore?.()
  }

  function handleFossils(): void {
    audioManager.playSound('button_click')
    onFossils?.()
  }

  function handleZoo(): void {
    audioManager.playSound('button_click')
    onZoo?.()
  }

  function handleStreakPanel(): void {
    audioManager.playSound('button_click')
    onStreakPanel?.()
  }

  function handleFarm(): void {
    audioManager.playSound('button_click')
    onFarm?.()
  }

  /** Calculates pending farm resources for the badge indicator. */
  const farmPending = $derived.by(() => {
    const save = $playerSave
    if (!save?.farm) return { dust: 0, shard: 0, crystal: 0 }
    return calculateTotalPending(save.farm.slots)
  })

  const hasFarmResources = $derived(
    farmPending.dust > 0 || farmPending.shard > 0 || farmPending.crystal > 0,
  )

  const kp = $derived($playerSave?.knowledgePoints ?? 0)

  // Streak-related derived state
  const claimedMilestones = $derived($playerSave?.claimedMilestones ?? [])
  const activeTitle = $derived($playerSave?.activeTitle ?? null)
  const lastDiveDate = $derived($playerSave?.lastDiveDate)
  const streakAtRisk = $derived.by(() => {
    const streak = stats.currentStreak
    if (streak <= 3) return false
    const today = new Date().toISOString().split('T')[0]
    if (lastDiveDate === today) return false
    if (!lastDiveDate) return false
    const last = new Date(lastDiveDate)
    const now = new Date(today)
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 1
  })
  const hasNewMilestone = $derived.by(() => {
    const streak = stats.currentStreak
    for (const m of BALANCE.STREAK_MILESTONES) {
      if (streak >= m.days && !claimedMilestones.includes(m.days)) return true
    }
    return false
  })

  const fossilsRecord = $derived($playerSave?.fossils ?? {})
  const discoveredFossilCount = $derived(Object.keys(fossilsRecord).length)
  const revivedFossilCount = $derived(Object.values(fossilsRecord).filter(f => f.revived).length)

  let showConverter = $state(false)

  function handleOpenConverter(): void {
    audioManager.playSound('button_click')
    showConverter = true
  }

  // === REVIEW RITUAL ===

  interface RitualState {
    active: boolean
    type: 'morning' | 'evening' | null
    completed: boolean
  }

  function getRitualState(): RitualState {
    const hour = new Date().getHours()
    const today = new Date().toISOString().split('T')[0]
    if (hour >= BALANCE.MORNING_REVIEW_HOUR && hour < BALANCE.MORNING_REVIEW_END) {
      return { active: true, type: 'morning', completed: $playerSave?.lastMorningReview === today }
    }
    if (hour >= BALANCE.EVENING_REVIEW_HOUR && hour < BALANCE.EVENING_REVIEW_END) {
      return { active: true, type: 'evening', completed: $playerSave?.lastEveningReview === today }
    }
    return { active: false, type: null, completed: false }
  }

  let ritualState = $state<RitualState>(getRitualState())

  $effect(() => {
    // Re-evaluate whenever playerSave changes (catches completion written by GameManager)
    $playerSave
    ritualState = getRitualState()
  })

  $effect(() => {
    // Refresh every minute to catch hour-boundary transitions
    const interval = setInterval(() => {
      ritualState = getRitualState()
    }, 60_000)
    return () => clearInterval(interval)
  })

  function handleStartRitual(): void {
    audioManager.playSound('button_click')
    onStudy()
  }

  // === DOME ROOM STATE ===
  let currentRoom = $state<string>('command')

  /** Rooms the player has unlocked. */
  const unlockedRooms = $derived($playerSave?.unlockedRooms ?? ['command'])

  /** Total dives completed — used to show "X more dives" unlock hints on locked tabs. */
  const totalDives = $derived($playerSave?.stats.totalDivesCompleted ?? 0)

  /** Track recently unlocked rooms to show a brief gold pulse animation. */
  let recentlyUnlockedSet = $state<string[]>([])
  let _prevUnlockedRooms = $state<string[]>(['command'])

  $effect(() => {
    const rooms = $playerSave?.unlockedRooms ?? ['command']
    const prev = untrack(() => _prevUnlockedRooms)
    const newOnes = rooms.filter(r => !prev.includes(r) && r !== 'command')
    if (newOnes.length > 0) {
      recentlyUnlockedSet = [...untrack(() => recentlyUnlockedSet), ...newOnes]
      for (const r of newOnes) {
        setTimeout(() => {
          recentlyUnlockedSet = untrack(() => recentlyUnlockedSet).filter(x => x !== r)
        }, 4000)
      }
    }
    _prevUnlockedRooms = rooms
  })

  function isRoomUnlocked(roomId: string): boolean {
    return unlockedRooms.includes(roomId)
  }

  function handleRoomSelect(roomId: string): void {
    if (!isRoomUnlocked(roomId)) return
    audioManager.playSound('button_click')
    currentRoom = roomId
  }

  // Mastery breakdown for Archive room
  const masteryBreakdown = $derived.by(() => {
    const save = $playerSave
    if (!save) return { new: 0, learning: 0, familiar: 0, known: 0, mastered: 0 }
    const counts: Record<string, number> = { new: 0, learning: 0, familiar: 0, known: 0, mastered: 0 }
    for (const rs of save.reviewStates) {
      const level = getMasteryLevel(rs)
      counts[level] = (counts[level] ?? 0) + 1
    }
    return counts
  })

    // --- Daily Deals ---
  const todaysDeals = $derived(getTodaysDeals())
  const resetTimer = $derived(getTimeUntilReset())

  const purchasedDealIds = $derived.by(() => {
    const save = $playerSave
    if (!save) return [] as string[]
    const today = new Date().toISOString().split('T')[0]
    if (save.lastDealDate !== today) return [] as string[]
    return save.purchasedDeals ?? []
  })

  function isDealPurchased(deal: DailyDeal): boolean {
    return purchasedDealIds.includes(deal.id)
  }

  function canAffordDeal(deal: DailyDeal): boolean {
    const save = $playerSave
    if (!save) return false
    for (const [tier, required] of Object.entries(deal.cost) as [string, number][]) {
      if ((save.minerals[tier as keyof typeof save.minerals] ?? 0) < required) return false
    }
    return true
  }

  function formatDealCost(deal: DailyDeal): string {
    return Object.entries(deal.cost)
      .map(([tier, amount]) => `${amount} ${tier}`)
      .join(' + ')
  }

  function handleBuyDeal(deal: DailyDeal): void {
    const save = $playerSave
    if (!save) return
    audioManager.playSound('button_click')
    const { success, updatedSave } = purchaseDeal(save, deal)
    if (success) {
      playerSave.set(updatedSave)
    }
  }
</script>

<section class="base-view" aria-label="Terra Base hub">
  <!-- === ROOM TAB BAR === -->
  <nav class="room-tab-bar" aria-label="Dome rooms">
    {#each BALANCE.DOME_ROOMS as room}
      {@const unlocked = isRoomUnlocked(room.id)}
      {@const active = currentRoom === room.id}
      {@const isNew = recentlyUnlockedSet.includes(room.id)}
      <button
        class="room-tab"
        class:room-tab-active={active}
        class:room-tab-locked={!unlocked}
        class:room-tab-new={isNew}
        type="button"
        onclick={() => handleRoomSelect(room.id)}
        disabled={!unlocked}
        aria-pressed={active}
        aria-label={unlocked ? room.name : room.name + ' — unlocks at ' + room.unlockDives + ' dives'}
        title={unlocked ? room.description : 'Unlocks after ' + room.unlockDives + ' dives (you have ' + totalDives + ')'}
      >
        <span class="room-tab-icon" aria-hidden="true">{unlocked ? room.icon : '🔒'}</span>
        <span class="room-tab-name">{room.name.split(' ')[0]}</span>
        {#if !unlocked}
          <span class="room-tab-unlock-hint">{room.unlockDives - totalDives}d</span>
        {/if}
      </button>
    {/each}
  </nav>

  <!-- === SCROLLABLE ROOM CONTENT === -->
  <div class="room-content">

    {#if currentRoom === 'command'}
      <!-- ========== COMMAND CENTER ========== -->
      <div class="card title-card">
        <div class="title-header-row">
          <h1>Terra Base</h1>
          {#if onSettings}
            <button
              class="gear-btn"
              type="button"
              onclick={onSettings}
              aria-label="Open settings"
              title="Settings"
            >&#9881;</button>
          {/if}
        </div>
        <p class="subtitle">
          Pilot {$playerSave?.playerId ?? 'Unknown'} | Dives: {stats.totalDivesCompleted} | Facts:
          {$playerSave?.learnedFacts.length ?? 0}
        </p>
        {#if activeTitle}
          <p class="active-title-display" aria-label="Active title: {activeTitle}">{activeTitle}</p>
        {/if}
        {#if stats.currentStreak > 0}
          <button
            class="streak-display streak-clickable"
            type="button"
            onclick={handleStreakPanel}
            aria-label="View streak details — {stats.currentStreak} day streak"
          >
            <span class="streak-flame">FIRE</span>
            <span class="streak-count">{stats.currentStreak} day streak</span>
            {#if stats.currentStreak >= stats.bestStreak && stats.currentStreak > 1}
              <span class="streak-best">BEST!</span>
            {/if}
            {#if hasNewMilestone}
              <span class="milestone-badge" aria-label="New milestone available">Milestone!</span>
            {/if}
          </button>
        {/if}
        {#if streakAtRisk}
          <p class="streak-at-risk" aria-live="polite">Streak at risk! Dive today to keep it!</p>
        {/if}
      </div>

      <div class="gaia-card" class:gaia-visible={gaiaVisible} aria-label="GAIA comment" aria-live="polite">
        <div class="gaia-avatar-col">
          <span class="gaia-avatar-emoji" aria-hidden="true">{idleEmoji}</span>
          <span class="gaia-name">{GAIA_NAME}</span>
        </div>
        <div class="gaia-body">
          <span class="gaia-text">{gaiaComment}</span>
          <details class="gaia-about">
            <summary class="gaia-about-toggle">About</summary>
            <div class="gaia-about-content">
              <strong>{GAIA_FULL_NAME}</strong>
              <span class="gaia-tagline">{GAIA_TAGLINE}</span>
            </div>
          </details>
        </div>
      </div>

      {#if revivedFossilCount > 0}
        <div class="card companion-card">
          <CompanionBadge />
        </div>
      {/if}

      <div class="card resources-card" aria-label="Resources">
        <div class="resource-item">
          <span class="resource-dot oxygen-dot" aria-hidden="true"></span>
          <span class="resource-label">Oxygen Tanks</span>
          <span class="resource-value">{oxygen}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot dust-dot" aria-hidden="true"></span>
          <span class="resource-label">Dust</span>
          <span class="resource-value">{dust}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot shard-dot" aria-hidden="true"></span>
          <span class="resource-label">Shard</span>
          <span class="resource-value">{shard}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot crystal-dot" aria-hidden="true"></span>
          <span class="resource-label">Crystal</span>
          <span class="resource-value">{crystal}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot geode-dot" aria-hidden="true"></span>
          <span class="resource-label">Geode</span>
          <span class="resource-value">{geode}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot essence-dot" aria-hidden="true"></span>
          <span class="resource-label">Essence</span>
          <span class="resource-value">{essence}</span>
        </div>
      </div>

      <div class="card dive-card" aria-label="Dive actions">
        <button class="action-button dive-button" type="button" onclick={handleDive}>
          <span>Dive</span>
          <span class="dive-arrow" aria-hidden="true">&#8595;</span>
        </button>

        <!-- Dive insurance toggle -->
        <div class="insurance-row" aria-label="Dive insurance options">
          <button
            class="insurance-toggle"
            class:insurance-active={insuredDive}
            class:insurance-disabled={!canAffordInsurance && !insuredDive}
            type="button"
            onclick={handleToggleInsurance}
            disabled={!canAffordInsurance && !insuredDive}
            aria-pressed={insuredDive}
            title={insuredDive
              ? 'Click to cancel dive insurance'
              : canAffordInsurance
                ? 'Click to insure this dive — costs ' + insuranceCost + ' dust, prevents item loss if O2 runs out'
                : 'Not enough dust to insure (need ' + insuranceCost + ')'}
          >
            <span class="insurance-icon">{insuredDive ? '[INSURED]' : '[Insure Dive]'}</span>
            <span class="insurance-cost">
              {#if insuranceCost > 0}
                {insuranceCost} dust
              {:else}
                No dust
              {/if}
            </span>
          </button>
          {#if insuredDive}
            <span class="insurance-note">Insured: no item loss if O2 depletes</span>
          {:else}
            <span class="insurance-note dim">Uninsured: lose 30% of items on O2 depletion</span>
          {/if}
        </div>

        {#if hasArtifacts}
          <button class="action-button artifact-button" type="button" onclick={handleReviewArtifact}>
            <span>Artifacts to Review</span>
            <span class="count-badge">{artifactCount}</span>
          </button>
        {/if}
      </div>

      <div class="card stats-card" aria-label="Player statistics">
        <h2>Stats</h2>
        <div class="stats-grid">
          <span>Total dives: {stats.totalDivesCompleted}</span>
          <span>Blocks mined: {stats.totalBlocksMined}</span>
          <span>Facts learned: {stats.totalFactsLearned}</span>
          <span>Deepest layer: {stats.deepestLayerReached}</span>
          <span>Current streak: {stats.currentStreak}</span>
          <span>Best streak: {stats.bestStreak}</span>
        </div>
      </div>

    {:else if currentRoom === 'lab'}
      <!-- ========== RESEARCH LAB ========== -->
      <div class="card room-header-card">
        <div class="room-header-info">
          <span class="room-header-icon" aria-hidden="true">🔬</span>
          <div>
            <h2 class="room-header-title">Research Lab</h2>
            <p class="room-header-desc">Study, review, and expand your knowledge</p>
          </div>
        </div>
      </div>

      <div class="gaia-card" class:gaia-visible={gaiaVisible} aria-label="GAIA comment" aria-live="polite">
        <div class="gaia-avatar-col">
          <span class="gaia-avatar-emoji" aria-hidden="true">{idleEmoji}</span>
          <span class="gaia-name">{GAIA_NAME}</span>
        </div>
        <div class="gaia-body">
          <span class="gaia-text">{gaiaComment}</span>
        </div>
      </div>

      <!-- Review Ritual Banner -->
      {#if ritualState.active}
        <div
          class="ritual-banner"
          class:ritual-completed={ritualState.completed}
          aria-label={ritualState.type === 'morning' ? 'Morning review ritual' : 'Evening review ritual'}
        >
          {#if ritualState.completed}
            <span class="ritual-check">&#10003;</span>
            <span class="ritual-complete-text">
              {ritualState.type === 'morning' ? 'Morning' : 'Evening'} ritual complete!
            </span>
          {:else}
            <div class="ritual-info">
              <span class="ritual-icon">{ritualState.type === 'morning' ? '&#9728;' : '&#127769;'}</span>
              <div class="ritual-text">
                {#if ritualState.type === 'morning'}
                  <span class="ritual-title">Morning Review</span>
                  <span class="ritual-desc">Start your day with {BALANCE.RITUAL_CARD_COUNT} cards (+{BALANCE.RITUAL_BONUS_DUST} dust bonus!)</span>
                {:else}
                  <span class="ritual-title">Evening Review</span>
                  <span class="ritual-desc">End your day right (+{BALANCE.RITUAL_BONUS_DUST} dust bonus!)</span>
                {/if}
              </div>
            </div>
            {#if hasDueReviews}
              <button class="ritual-start-btn" type="button" onclick={handleStartRitual}>
                Start Ritual
              </button>
            {:else}
              <span class="ritual-no-cards">No cards due</span>
            {/if}
          {/if}
        </div>
      {/if}

      <div class="card actions-card" aria-label="Lab actions">
        <button
          class="action-button study-button"
          class:dimmed={!hasDueReviews}
          type="button"
          onclick={handleStudy}
          aria-label="Start study session"
        >
          <span>Study Session</span>
          {#if hasDueReviews}
            <span class="count-badge">{dueReviewCount} due</span>
          {:else}
            <span class="empty-note">No reviews due</span>
          {/if}
        </button>

        <button class="action-button knowledge-store-button" type="button" onclick={handleKnowledgeStore}>
          <span>Knowledge Store</span>
          <span class="kp-badge">{kp} KP</span>
        </button>
      </div>

      <div class="card lab-tip-card" aria-label="Lab tip">
        <p class="lab-tip-text">Tip: Correct answers during dives earn dust. Wrong answers drain oxygen — but you'll remember them better!</p>
      </div>

    {:else if currentRoom === 'workshop'}
      <!-- ========== WORKSHOP ========== -->
      <div class="card room-header-card">
        <div class="room-header-info">
          <span class="room-header-icon" aria-hidden="true">⚒️</span>
          <div>
            <h2 class="room-header-title">Workshop</h2>
            <p class="room-header-desc">Craft equipment and convert minerals</p>
          </div>
        </div>
      </div>

      <div class="card resources-card" aria-label="Mineral resources">
        <div class="resource-item">
          <span class="resource-dot dust-dot" aria-hidden="true"></span>
          <span class="resource-label">Dust</span>
          <span class="resource-value">{dust}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot shard-dot" aria-hidden="true"></span>
          <span class="resource-label">Shard</span>
          <span class="resource-value">{shard}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot crystal-dot" aria-hidden="true"></span>
          <span class="resource-label">Crystal</span>
          <span class="resource-value">{crystal}</span>
        </div>
        <div class="resource-item">
          <span class="resource-dot geode-dot" aria-hidden="true"></span>
          <span class="resource-label">Geode</span>
          <span class="resource-value">{geode}</span>
        </div>
      </div>

      <div class="card actions-card" aria-label="Workshop actions">
        <button class="action-button materializer-button" type="button" onclick={handleMaterializer}>
          <span>Materializer</span>
          <span class="action-arrow" aria-hidden="true">&#8594;</span>
        </button>

        <button class="action-button convert-btn" type="button" onclick={handleOpenConverter}>
          <span>Convert Minerals</span>
          <span class="action-arrow" aria-hidden="true">&#8594;</span>
        </button>
      </div>

      <div class="card workshop-info-card" aria-label="Workshop tip">
        <p class="workshop-tip">Craft permanent upgrades and consumables in the Materializer. Convert lower-tier minerals to higher tiers using a 110:1 ratio.</p>
      </div>

      {#if showConverter}
        <MineralConverter onClose={() => { showConverter = false }} />
      {/if}

    {:else if currentRoom === 'museum'}
      <!-- ========== MUSEUM ========== -->
      <div class="card room-header-card">
        <div class="room-header-info">
          <span class="room-header-icon" aria-hidden="true">🏛️</span>
          <div>
            <h2 class="room-header-title">Museum</h2>
            <p class="room-header-desc">Your fossil discoveries and companions</p>
          </div>
        </div>
      </div>

      <div class="card museum-progress-card" aria-label="Fossil collection progress">
        <div class="museum-progress-header">
          <h2>Fossil Collection</h2>
          <span class="museum-progress-count">{discoveredFossilCount} species found</span>
        </div>
        {#if discoveredFossilCount === 0}
          <p class="empty-note">No fossils discovered yet. Dig deep — fossils appear below 35% depth.</p>
        {:else}
          <p class="museum-revived-summary">Revived: {revivedFossilCount} / {discoveredFossilCount}</p>
        {/if}
      </div>

      <div class="card actions-card" aria-label="Museum actions">
        <button class="action-button fossil-button" type="button" onclick={handleFossils}>
          <span>Fossil Gallery</span>
          {#if discoveredFossilCount > 0}
            <span class="fossil-count">{revivedFossilCount}/{discoveredFossilCount}</span>
          {:else}
            <span class="empty-note">No fossils yet</span>
          {/if}
        </button>

        <button class="action-button zoo-button" type="button" onclick={handleZoo} aria-label="Visit The Zoo">
          <span>The Zoo</span>
          {#if revivedFossilCount > 0}
            <span class="zoo-count">{revivedFossilCount}/10</span>
          {:else}
            <span class="empty-note">No companions yet</span>
          {/if}
        </button>
      </div>

      <div class="card museum-zoo-card" aria-label="Companion Zoo">
        <h2>Companion Zoo</h2>
        <p class="empty-note museum-zoo-placeholder">Revive fossils in the gallery to add companions to your zoo.</p>
      </div>

    {:else if currentRoom === 'market'}
      <!-- ========== MARKET ========== -->
      <div class="card room-header-card">
        <div class="room-header-info">
          <span class="room-header-icon" aria-hidden="true">🏪</span>
          <div>
            <h2 class="room-header-title">Market</h2>
            <p class="room-header-desc">Cosmetics, daily deals and special offers</p>
          </div>
        </div>
      </div>

      <div class="card actions-card" aria-label="Market actions">
        <button class="action-button cosmetics-button" type="button" onclick={handleCosmetics}>
          <span>Cosmetics Shop</span>
          <span class="action-arrow" aria-hidden="true">&#8594;</span>
        </button>

        <button class="action-button farm-button" type="button" onclick={handleFarm} aria-label="Visit The Farm">
          <span>The Farm</span>
          {#if hasFarmResources}
            <span class="farm-badge">Resources ready!</span>
          {:else}
            <span class="empty-note">Passive production</span>
          {/if}
        </button>
      </div>

      <!-- Daily Deals -->
      <div class="card deals-card" aria-label="Daily Deals">
        <div class="deals-header">
          <h2 class="deals-title">Daily Deals</h2>
          <span class="deals-timer" aria-label="Time until reset">
            Resets in {resetTimer.hours}h {resetTimer.minutes}m
          </span>
        </div>
        <div class="deals-grid">
          {#each todaysDeals as deal (deal.id)}
            {@const purchased = isDealPurchased(deal)}
            {@const affordable = canAffordDeal(deal)}
            <div
              class="deal-card"
              class:deal-purchased={purchased}
              class:deal-unaffordable={!affordable && !purchased}
              aria-label="{deal.name} deal"
            >
              <div class="deal-icon" aria-hidden="true">{deal.icon}</div>
              <div class="deal-name">{deal.name}</div>
              <div class="deal-desc">{deal.description}</div>
              <div class="deal-cost" aria-label="Cost: {formatDealCost(deal)}">
                {formatDealCost(deal)}
              </div>
              <button
                class="deal-buy-btn"
                class:deal-btn-sold={purchased}
                type="button"
                disabled={purchased || !affordable}
                onclick={() => handleBuyDeal(deal)}
                aria-label={purchased ? 'Already purchased' : 'Buy ' + deal.name}
              >
                {purchased ? 'Sold Out' : 'Buy'}
              </button>
            </div>
          {/each}
        </div>
      </div>

    {:else if currentRoom === 'archive'}
      <!-- ========== ARCHIVE ========== -->
      <div class="card room-header-card">
        <div class="room-header-info">
          <span class="room-header-icon" aria-hidden="true">📚</span>
          <div>
            <h2 class="room-header-title">Archive</h2>
            <p class="room-header-desc">Knowledge tree, data discs and mastery records</p>
          </div>
        </div>
      </div>

      <div class="card actions-card" aria-label="Archive actions">
        <button class="action-button tree-button" type="button" onclick={handleViewTree}>
          <span>Knowledge Tree</span>
          <span class="action-arrow" aria-hidden="true">&#8594;</span>
        </button>
      </div>

      <div class="card knowledge-card" aria-label="Knowledge overview">
        <div class="knowledge-header">
          <h2>Knowledge</h2>
          <span class="disc-counter" aria-label="Data Discs collected">
            Data Discs: {discCount}/{totalDiscs}
          </span>
        </div>
        {#if discCount > 0}
          <div class="disc-badges" aria-label="Unlocked data discs">
            {#each unlockedDiscObjects as disc}
              <span class="disc-badge" title="{disc.name}: {disc.description}">
                {disc.icon}
              </span>
            {/each}
          </div>
        {/if}

        <div class="mastery-summary" aria-label="Mastery breakdown">
          <div class="mastery-row">
            <span class="mastery-badge mastery-new">New</span>
            <span class="mastery-summary-count">{masteryBreakdown.new}</span>
          </div>
          <div class="mastery-row">
            <span class="mastery-badge mastery-learning">Learning</span>
            <span class="mastery-summary-count">{masteryBreakdown.learning}</span>
          </div>
          <div class="mastery-row">
            <span class="mastery-badge mastery-familiar">Familiar</span>
            <span class="mastery-summary-count">{masteryBreakdown.familiar}</span>
          </div>
          <div class="mastery-row">
            <span class="mastery-badge mastery-known">Known</span>
            <span class="mastery-summary-count">{masteryBreakdown.known}</span>
          </div>
          <div class="mastery-row">
            <span class="mastery-badge mastery-mastered">Mastered</span>
            <span class="mastery-summary-count">{masteryBreakdown.mastered}</span>
          </div>
        </div>
      </div>

      <div class="card knowledge-card" aria-label="Learned facts">
        <h2>Learned Facts ({learnedFactsWithMastery.length})</h2>
        {#if learnedFactsWithMastery.length === 0}
          <p class="empty-note">No learned facts yet. Start a dive to discover artifacts.</p>
        {:else}
          <div class="facts-list">
            {#each learnedFactsWithMastery as entry}
              <div class="fact-row">
                <span class="fact-id">{entry.statement}</span>
                <span class={`mastery-badge mastery-${entry.mastery}`}>{formatMasteryLabel(entry.mastery)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

  </div><!-- end .room-content -->
</section>

<style>
  .base-view {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    overflow: hidden;
    background: var(--color-bg);
    padding: 0;
    font-family: 'Courier New', monospace;
    display: flex;
    flex-direction: column;
  }

  /* ---- Room Tab Bar ---- */
  .room-tab-bar {
    display: flex;
    flex-direction: row;
    gap: 0;
    overflow-x: auto;
    background: color-mix(in srgb, var(--color-bg) 60%, #000 40%);
    border-bottom: 2px solid rgba(78, 204, 163, 0.2);
    padding: 6px 6px 0;
    flex-shrink: 0;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .room-tab-bar::-webkit-scrollbar {
    display: none;
  }

  .room-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 10px 6px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 8px 8px 0 0;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    min-width: 58px;
    position: relative;
  }

  .room-tab:active:not(:disabled) {
    transform: translateY(1px);
  }

  .room-tab-active {
    color: #4ecca3;
    border-bottom-color: #4ecca3;
    background: color-mix(in srgb, #4ecca3 10%, transparent 90%);
  }

  .room-tab-locked {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @keyframes room-unlock-pulse {
    0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
    50% { box-shadow: 0 0 0 6px rgba(255, 215, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
  }

  .room-tab-new {
    animation: room-unlock-pulse 0.8s ease-out 3;
    color: #ffd700;
    border-bottom-color: #ffd700;
  }

  .room-tab-icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .room-tab-name {
    font-size: 0.62rem;
    letter-spacing: 0.01em;
    line-height: 1;
  }

  .room-tab-unlock-hint {
    font-size: 0.55rem;
    color: var(--color-text-dim);
    opacity: 0.8;
    line-height: 1;
  }

  /* ---- Scrollable room content ---- */
  .room-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 0 8px;
  }

  /* ---- Room header cards ---- */
  .room-header-card {
    margin: 8px 8px 4px;
    padding: 12px 16px;
  }

  .room-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .room-header-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .room-header-title {
    color: var(--color-warning);
    font-size: 1.1rem;
    margin: 0 0 2px;
  }

  .room-header-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin: 0;
    line-height: 1.3;
  }

  .card {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
  }

  /* Companion card strips default card padding so the badge fills edge-to-edge */
  .companion-card {
    padding: 0;
    overflow: hidden;
  }

  h1,
  h2 {
    margin: 0;
  }

  h1 {
    color: var(--color-warning);
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    line-height: 1.1;
  }

  h2 {
    color: var(--color-text);
    font-size: 1rem;
    margin-bottom: 10px;
  }

  /* Title card header row — h1 + gear button side by side */
  .title-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .gear-btn {
    flex-shrink: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 1.25rem;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: color 0.12s, background 0.12s;
    margin-top: 4px;
  }

  .gear-btn:hover,
  .gear-btn:focus-visible {
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-primary) 20%, transparent 80%);
  }

  .gear-btn:active {
    transform: scale(0.93);
  }

  .subtitle {
    margin-top: 8px;
    color: var(--color-text-dim);
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .active-title-display {
    margin: 4px 0 0;
    color: #a78bfa;
    font-size: 0.82rem;
    font-weight: 700;
    font-style: italic;
    letter-spacing: 0.5px;
  }

  .streak-display {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .streak-clickable {
    background: none;
    border: 0;
    padding: 4px 6px;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    flex-wrap: wrap;
  }

  .streak-clickable:hover {
    background: color-mix(in srgb, var(--color-warning) 10%, transparent 90%);
  }

  .streak-clickable:active {
    transform: scale(0.97);
  }

  .streak-flame {
    color: var(--color-warning);
    font-size: 0.75rem;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .streak-count {
    color: var(--color-warning);
    font-size: 0.95rem;
    font-weight: 700;
  }

  .streak-best {
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .milestone-badge {
    background: var(--color-warning);
    color: #1a0e00;
    font-size: 0.68rem;
    font-weight: 900;
    border-radius: 999px;
    padding: 2px 8px;
    letter-spacing: 0.5px;
    animation: milestone-pulse 1.5s ease-in-out infinite;
  }

  @keyframes milestone-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .streak-at-risk {
    margin: 4px 0 0;
    color: #f97316;
    font-size: 0.78rem;
    font-weight: 700;
    font-style: italic;
  }

  .resources-card {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .convert-row {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    padding-top: 4px;
  }

  .convert-minerals-btn {
    border: 0;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-warning) 24%, var(--color-surface) 76%);
    color: var(--color-warning);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 9px 22px;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: opacity 0.15s;
  }

  .convert-minerals-btn:active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .resource-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    background: color-mix(in srgb, var(--color-bg) 35%, var(--color-surface) 65%);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .resource-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .oxygen-dot {
    background: #45b3ff;
  }

  .dust-dot {
    background: #4ecca3;
  }

  .shard-dot {
    background: #ffd369;
  }

  .crystal-dot {
    background: #e94560;
  }

  .geode-dot {
    background: #9b59b6;
  }

  .essence-dot {
    background: linear-gradient(135deg, #ffd700 0%, #fffde7 50%, #ffd700 100%);
    box-shadow: 0 0 4px rgba(255, 215, 0, 0.6);
  }

  .resource-label {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .resource-value {
    margin-left: auto;
    color: var(--color-text);
    font-size: 1rem;
    font-weight: 700;
  }

  .actions-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .action-button {
    min-height: 56px;
    border: 0;
    border-radius: 12px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    cursor: pointer;
  }

  .action-button:active {
    transform: translateY(1px);
  }

  .dive-button {
    min-height: 64px;
    font-size: 1.25rem;
    background: var(--color-success);
    color: #0b231a;
  }

  .study-button {
    background: var(--color-primary);
  }

  .artifact-button {
    background: color-mix(in srgb, var(--color-accent) 32%, var(--color-surface) 68%);
  }

  .materializer-button {
    background: color-mix(in srgb, #a78bfa 28%, var(--color-surface) 72%);
  }

  .premium-materializer-button {
    background: linear-gradient(135deg,
      color-mix(in srgb, #c084fc 22%, var(--color-surface) 78%) 0%,
      color-mix(in srgb, #fbbf24 18%, var(--color-surface) 82%) 100%
    );
    border: 1px solid rgba(192, 132, 252, 0.35);
  }

  .premium-badges {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pm-badge {
    font-size: 0.7rem;
    font-weight: 800;
    border-radius: 999px;
    padding: 2px 6px;
    white-space: nowrap;
  }

  .pm-star {
    color: #ffe97a;
    background: rgba(255, 233, 122, 0.15);
  }

  .pm-void {
    color: #b388ff;
    background: rgba(179, 136, 255, 0.15);
  }

  .pm-essence {
    color: #69f0ae;
    background: rgba(105, 240, 174, 0.15);
  }

  .cosmetics-button {
    background: color-mix(in srgb, #f97316 28%, var(--color-surface) 72%);
  }

  .tree-button {
    background: color-mix(in srgb, var(--color-warning) 28%, var(--color-surface) 72%);
  }

  .fossil-button {
    background: color-mix(in srgb, #d4a574 28%, var(--color-surface) 72%);
  }

  .fossil-count {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: rgba(212, 165, 116, 0.3);
    color: #d4a574;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .zoo-button {
    background: color-mix(in srgb, #0d9488 28%, var(--color-surface) 72%);
    border: 1px solid rgba(13, 148, 136, 0.4);
  }

  .zoo-count {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: rgba(0, 210, 180, 0.22);
    color: #00d2b4;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .farm-button {
    background: color-mix(in srgb, #4caf50 28%, var(--color-surface) 72%);
    border: 1px solid rgba(76, 175, 80, 0.4);
  }

  .farm-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: #4caf50;
    background: rgba(76, 175, 80, 0.2);
    border: 1px solid rgba(76, 175, 80, 0.4);
    border-radius: 999px;
    padding: 4px 10px;
    white-space: nowrap;
  }

  .knowledge-store-button {
    background: color-mix(in srgb, #a060ef 28%, var(--color-surface) 72%);
  }

  .kp-badge {
    font-size: 0.78rem;
    font-weight: 700;
    color: #e0c8ff;
    background: rgba(160, 100, 255, 0.22);
    border: 1px solid rgba(160, 100, 255, 0.4);
    border-radius: 999px;
    padding: 4px 10px;
  }

  /* ---- Insurance ---- */
  .insurance-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--color-bg) 40%, var(--color-surface) 60%);
    border-radius: 10px;
    border: 1px solid transparent;
    transition: border-color 200ms ease;
  }

  .insurance-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    width: 100%;
  }

  .insurance-toggle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .insurance-icon {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-dim);
    letter-spacing: 0.02em;
  }

  .insurance-active .insurance-icon {
    color: var(--color-success);
  }

  .insurance-cost {
    font-size: 0.8rem;
    font-weight: 600;
    color: #4ecca3;
  }

  .insurance-note {
    font-size: 0.72rem;
    color: var(--color-success);
    font-style: italic;
  }

  .insurance-note.dim {
    color: var(--color-text-dim);
  }

  .insurance-active {
    border-color: var(--color-success);
  }

  .insurance-disabled {
    opacity: 0.5;
  }

  .dimmed {
    opacity: 0.7;
  }

  .count-badge {
    min-width: 28px;
    height: 28px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text) 92%, var(--color-bg) 8%);
    color: var(--color-bg);
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    font-weight: 800;
    padding: 0 8px;
  }

  .knowledge-card {
    display: flex;
    flex-direction: column;
    min-height: 160px;
    max-height: 38dvh;
  }

  .knowledge-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .knowledge-header h2 {
    margin-bottom: 0;
  }

  .disc-counter {
    color: #22aacc;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .disc-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .disc-badge {
    font-size: 1.2rem;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, #22aacc 18%, var(--color-surface) 82%);
    border: 1px solid #22aacc44;
    border-radius: 8px;
    cursor: default;
  }

  .facts-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
  }

  .fact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: color-mix(in srgb, var(--color-bg) 45%, var(--color-surface) 55%);
    border-radius: 9px;
    padding: 8px 10px;
  }

  .fact-id {
    color: var(--color-text);
    font-size: 0.85rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .mastery-badge {
    border-radius: 999px;
    padding: 5px 10px;
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 700;
    flex-shrink: 0;
  }

  .mastery-new {
    background: color-mix(in srgb, var(--color-text-dim) 32%, var(--color-surface) 68%);
    color: var(--color-text);
  }

  .mastery-learning {
    background: color-mix(in srgb, var(--color-warning) 35%, var(--color-surface) 65%);
    color: #342500;
  }

  .mastery-familiar {
    background: color-mix(in srgb, var(--color-primary) 62%, var(--color-surface) 38%);
    color: var(--color-text);
  }

  .mastery-known {
    background: color-mix(in srgb, var(--color-success) 40%, var(--color-surface) 60%);
    color: #0b231a;
  }

  .mastery-mastered {
    background: color-mix(in srgb, var(--color-accent) 40%, var(--color-surface) 60%);
    color: #fff;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
    font-size: 0.82rem;
    color: var(--color-text-dim);
    line-height: 1.25;
  }

  .empty-note {
    color: var(--color-text-dim);
    font-size: 0.85rem;
  }

  .settings-card {
    margin-bottom: 20px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: color-mix(in srgb, var(--color-bg) 35%, var(--color-surface) 65%);
    border-radius: 10px;
    padding: 10px 12px;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    color: var(--color-text);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .setting-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
  }

  .setting-toggle {
    border: 0;
    border-radius: 8px;
    background: var(--color-primary);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 8px 14px;
    cursor: pointer;
    white-space: nowrap;
  }

  .setting-toggle:active {
    transform: translateY(1px);
  }

  .setting-note {
    margin: 8px 0 0;
    color: var(--color-text-dim);
    font-size: 0.75rem;
    font-style: italic;
  }

  /* Setting rows that stack label above control */
  .setting-row-col {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  /* Mood selector */
  .mood-buttons {
    display: flex;
    gap: 6px;
  }

  .mood-btn {
    flex: 1;
    border: 2px solid transparent;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-bg) 50%, var(--color-surface) 50%);
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 8px 4px;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .mood-btn:active {
    transform: translateY(1px);
  }

  .mood-active {
    border-color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 18%, var(--color-surface) 82%);
    color: var(--color-warning);
  }

  /* Chattiness slider */
  .chattiness-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    cursor: pointer;
    accent-color: var(--color-primary);
    padding: 0;
    border: none;
    background: transparent;
  }

  @media (max-width: 520px) {
    .card {
      margin: 6px;
      padding: 14px;
    }

    .resources-card,
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .action-button {
      font-size: 1rem;
    }
  }

  .gaia-card {
    margin: 8px;
    padding: 10px 14px;
    background: rgba(20, 20, 40, 0.6);
    border-left: 3px solid #ffd369;
    border-radius: 6px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 0.8rem;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .gaia-visible {
    opacity: 1;
  }

  .gaia-avatar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .gaia-avatar-emoji {
    font-size: 2rem;
    line-height: 1;
  }

  .gaia-name {
    color: #22d9d9;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .gaia-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .gaia-text {
    color: #b0b0c8;
    font-style: italic;
    line-height: 1.4;
  }

  .gaia-about {
    font-size: 0.7rem;
  }

  .gaia-about-toggle {
    color: #ffd369;
    cursor: pointer;
    list-style: none;
    font-size: 0.68rem;
    opacity: 0.75;
    padding: 0;
    user-select: none;
  }

  .gaia-about-toggle::-webkit-details-marker {
    display: none;
  }

  .gaia-about-toggle::before {
    content: '+ ';
  }

  details[open] .gaia-about-toggle::before {
    content: '- ';
  }

  .gaia-about-content {
    margin-top: 4px;
    padding: 6px 8px;
    background: rgba(255, 211, 105, 0.07);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .gaia-about-content strong {
    color: #e0e0f0;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .gaia-tagline {
    color: #80809a;
    font-style: italic;
    font-size: 0.68rem;
  }

  /* ---- Daily Deals ---- */
  .deals-card {
    border: 1px solid rgba(255, 186, 0, 0.3);
    background: color-mix(in srgb, #3a2800 60%, var(--color-surface) 40%);
  }

  .deals-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .deals-title {
    color: #ffba00;
    margin-bottom: 0;
  }

  .deals-timer {
    color: #c89000;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .deals-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .deal-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    background: color-mix(in srgb, #ffba00 8%, var(--color-bg) 92%);
    border: 1px solid rgba(255, 186, 0, 0.25);
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    transition: border-color 0.15s, opacity 0.15s;
  }

  .deal-purchased {
    opacity: 0.45;
    border-color: rgba(255, 186, 0, 0.1);
  }

  .deal-unaffordable {
    opacity: 0.65;
  }

  .deal-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .deal-name {
    color: #ffba00;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .deal-desc {
    color: var(--color-text-dim);
    font-size: 0.68rem;
    line-height: 1.3;
    min-height: 2.6em;
  }

  .deal-cost {
    color: #c89000;
    font-size: 0.68rem;
    font-weight: 600;
    line-height: 1.3;
    min-height: 1.3em;
  }

  .deal-buy-btn {
    margin-top: 4px;
    width: 100%;
    border: 0;
    border-radius: 7px;
    background: #ffba00;
    color: #1a0e00;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 800;
    padding: 6px 4px;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: opacity 0.15s, transform 0.1s;
  }

  .deal-buy-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .deal-buy-btn:not(:disabled):active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .deal-btn-sold {
    background: color-mix(in srgb, var(--color-text-dim) 40%, var(--color-surface) 60%);
    color: var(--color-text-dim);
  }

  @media (max-width: 520px) {
    .deals-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }

    .deal-icon {
      font-size: 1.3rem;
    }

    .deal-name {
      font-size: 0.7rem;
    }

    .deal-desc,
    .deal-cost {
      font-size: 0.62rem;
    }

    .deal-buy-btn {
      font-size: 0.72rem;
      padding: 5px 2px;
    }
  }

  /* ---- Review Ritual Banner ---- */
  @keyframes ritual-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 186, 0, 0.35); }
    50% { box-shadow: 0 0 0 6px rgba(255, 186, 0, 0); }
  }

  .ritual-banner {
    margin: 8px;
    padding: 14px 16px;
    border: 2px solid #ffba00;
    border-radius: 12px;
    background: color-mix(in srgb, #3a2800 55%, var(--color-surface) 45%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    animation: ritual-pulse 2s ease-in-out infinite;
    font-family: inherit;
  }

  .ritual-banner.ritual-completed {
    border-color: var(--color-success);
    background: color-mix(in srgb, #003a1a 55%, var(--color-surface) 45%);
    animation: none;
  }

  .ritual-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .ritual-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .ritual-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ritual-title {
    color: #ffba00;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .ritual-desc {
    color: #c89000;
    font-size: 0.75rem;
    line-height: 1.3;
  }

  .ritual-start-btn {
    flex-shrink: 0;
    border: 0;
    border-radius: 9px;
    background: #ffba00;
    color: #1a0e00;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 9px 16px;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: opacity 0.15s, transform 0.1s;
  }

  .ritual-start-btn:active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  .ritual-no-cards {
    flex-shrink: 0;
    color: #c89000;
    font-size: 0.78rem;
    font-style: italic;
  }

  .ritual-check {
    color: var(--color-success);
    font-size: 1.3rem;
    font-weight: 900;
    flex-shrink: 0;
  }

  .ritual-complete-text {
    color: var(--color-success);
    font-size: 0.9rem;
    font-weight: 700;
    flex: 1;
  }

  /* ---- Dive card ---- */
  .dive-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dive-arrow {
    font-size: 1.5rem;
    font-weight: 900;
    color: rgba(11, 35, 26, 0.7);
  }

  .action-arrow {
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.1rem;
  }

  .convert-btn {
    background: color-mix(in srgb, var(--color-warning) 24%, var(--color-surface) 76%);
    color: var(--color-warning);
  }

  /* ---- Mastery summary in Archive ---- */
  .mastery-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .mastery-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px 4px 4px;
    background: color-mix(in srgb, var(--color-bg) 45%, var(--color-surface) 55%);
    border-radius: 8px;
  }

  .mastery-summary-count {
    color: var(--color-text);
    font-weight: 700;
    font-size: 0.9rem;
  }

  /* ---- Lab room ---- */
  .lab-tip-card {
    border-left: 3px solid var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface) 92%);
    margin-bottom: 20px;
  }

  .lab-tip-text {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  /* ---- Workshop room ---- */
  .workshop-info-card {
    border-left: 3px solid #a78bfa;
    background: color-mix(in srgb, #a78bfa 8%, var(--color-surface) 92%);
    margin-bottom: 20px;
  }

  .workshop-tip {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    line-height: 1.5;
    margin: 0;
    font-style: italic;
  }

  /* ---- Museum room ---- */
  .museum-progress-card {
    min-height: 80px;
  }

  .museum-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .museum-progress-header h2 {
    margin-bottom: 0;
  }

  .museum-progress-count {
    color: #d4a574;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .museum-revived-summary {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    margin-top: 4px;
  }

  .museum-zoo-card {
    margin-bottom: 20px;
  }

  .museum-zoo-placeholder {
    margin-top: 4px;
  }

  /* ---- Market: move deals-card bottom margin ---- */
  .deals-card {
    margin-bottom: 20px;
  }

  /* ---- Archive knowledge card ---- */
  .knowledge-card {
    max-height: 42dvh;
  }

</style>
