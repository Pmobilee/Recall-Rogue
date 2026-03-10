<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { currentScreen } from './ui/stores/gameState'
  import type { Screen } from './ui/stores/gameState'
  import { navigateToScreen, type HubScreenName, normalizeHomeScreen } from './services/screenController'
  import {
    activeCardRewardOptions,
    activeMysteryEvent,
    activeRoomOptions,
    activeRunEndData,
    activeRunState,
    activeShopCards,
    activeSpecialEvent,
    getCurrentDelvePenalty,
    onArchetypeSelected,
    onCardRewardSelected,
    onCardRewardSkipped,
    onCardRewardReroll,
    onDelve,
    onDomainsSelected,
    onMysteryResolved,
    onRestResolved,
    onRetreat,
    onRoomSelected,
    onShopDone,
    onShopSell,
    onSpecialEventResolved,
    openCampfire,
    resumeFromCampfire,
    returnToHubFromCampfire,
    abandonActiveRun,
    hasActiveRun,
    loadActiveRun,
    playAgain,
    returnToMenu,
    startNewRun,
  } from './services/gameFlowController'
  import {
    activeTurnState,
    handleEndTurn,
    handlePlayCard,
    handleSkipCard,
    handleUseHint,
    startEncounterForRoom,
  } from './services/encounterBridge'
  import type { FactDomain } from './data/card-types'
  import type { MysteryEffect } from './services/floorManager'
  import { healPlayer } from './services/runManager'
  import { isSlowReader } from './services/cardPreferences'
  import { unlockCardAudio } from './services/cardAudioManager'
  import { playerSave } from './ui/stores/playerData'
  import { lastRunSummary } from './services/hubState'

  import DomainSelection from './ui/components/DomainSelection.svelte'
  import ArchetypeSelection from './ui/components/ArchetypeSelection.svelte'
  import CardCombatOverlay from './ui/components/CardCombatOverlay.svelte'
  import RoomSelection from './ui/components/RoomSelection.svelte'
  import MysteryEventOverlay from './ui/components/MysteryEventOverlay.svelte'
  import RestRoomOverlay from './ui/components/RestRoomOverlay.svelte'
  import RunEndScreen from './ui/components/RunEndScreen.svelte'
  import CardRewardScreen from './ui/components/CardRewardScreen.svelte'
  import RetreatOrDelve from './ui/components/RetreatOrDelve.svelte'
  import DungeonEntrance from './ui/components/DungeonEntrance.svelte'
  import SettingsPanel from './ui/components/SettingsPanel.svelte'
  import KnowledgeLibrary from './ui/components/KnowledgeLibrary.svelte'
  import HubScreen from './ui/components/HubScreen.svelte'
  import HubNavBar from './ui/components/HubNavBar.svelte'
  import ProfileScreen from './ui/components/ProfileScreen.svelte'
  import JournalScreen from './ui/components/JournalScreen.svelte'
  import LeaderboardsScreen from './ui/components/LeaderboardsScreen.svelte'
  import ShopRoomOverlay from './ui/components/ShopRoomOverlay.svelte'
  import CampfirePause from './ui/components/CampfirePause.svelte'
  import SpecialEventOverlay from './ui/components/SpecialEventOverlay.svelte'

  const NAV_VISIBLE_SCREENS = new Set<Screen>([
    'hub',
    'mainMenu',
    'base',
    'library',
    'settings',
    'profile',
    'journal',
    'leaderboards',
  ])

  function transitionScreen(target: Screen): void {
    const nextScreen = navigateToScreen(target, $currentScreen)
    currentScreen.set(nextScreen)
  }

  function handleStartRun(): void {
    startNewRun()
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

  function handleHubNavigate(target: HubScreenName): void {
    transitionScreen(target)
  }

  function handleBackToMenu(): void {
    transitionScreen('hub')
  }

  function handleDomainsChosen(primary: FactDomain, secondary: FactDomain): void {
    onDomainsSelected(primary, secondary)
  }

  function handleArchetypeSelect(archetype: import('./services/runManager').RewardArchetype): void {
    onArchetypeSelected(archetype)
    startEncounterForRoom()
  }

  function handleOnboardingBegin(slowReader: boolean): void {
    isSlowReader.set(slowReader)
    onDomainsSelected('natural_sciences', 'history')
    onArchetypeSelected('balanced')
    startEncounterForRoom()
  }

  function handleRoomPick(index: number): void {
    const room = get(activeRoomOptions)[index]
    if (!room) return
    onRoomSelected(room)
    if (room.type === 'combat') {
      startEncounterForRoom(room.enemyId)
    }
  }

  function handleMysteryResolve(effect: MysteryEffect): void {
    const run = get(activeRunState)
    if (run) {
      if (effect.type === 'heal') {
        healPlayer(run, effect.amount)
      } else if (effect.type === 'damage') {
        run.playerHp = Math.max(0, run.playerHp - effect.amount)
      }
      activeRunState.set(run)
    }
    onMysteryResolved()
  }

  function handleRestHeal(): void {
    const run = get(activeRunState)
    if (!run) return
    const amount = Math.round(run.playerMaxHp * 0.3)
    healPlayer(run, amount)
    activeRunState.set(run)
    onRestResolved()
  }

  function handleRestUpgrade(): void {
    onRestResolved()
  }

  function handleRewardSelected(card: import('./data/card-types').Card): void {
    onCardRewardSelected(card)
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

  function handleResumeActiveRun(): void {
    const saved = loadActiveRun()
    if (!saved) return
    activeRunState.set(saved.runState)
    if (saved.roomOptions && saved.roomOptions.length > 0) {
      activeRoomOptions.set(saved.roomOptions)
    }
    // Navigate to the saved screen or default to room selection
    const screen = saved.currentScreen as import('./ui/stores/gameState').Screen
    currentScreen.set(screen === 'campfire' ? 'roomSelection' : (screen || 'roomSelection'))
  }

  function handleAbandonRun(): void {
    abandonActiveRun()
  }

  let activeRunFloor = $derived($activeRunState?.floor.currentFloor ?? 0)
  let showActiveRunBanner = $derived(!$activeRunState && hasActiveRun())

  function nextSegmentName(floor: number): string {
    if (floor < 3) return 'Shallow Depths'
    if (floor < 6) return 'Deep Dungeon'
    if (floor < 9) return 'The Abyss'
    return 'Endless Depths'
  }

  function handleUserInteraction(): void {
    unlockCardAudio()
  }

  function shouldShowHubNav(screen: Screen): boolean {
    return NAV_VISIBLE_SCREENS.has(screen)
  }

  onMount(() => {
    const onInteraction = (): void => {
      handleUserInteraction()
      window.removeEventListener('pointerdown', onInteraction)
      window.removeEventListener('keydown', onInteraction)
    }

    window.addEventListener('pointerdown', onInteraction, { once: true })
    window.addEventListener('keydown', onInteraction, { once: true })

    return () => {
      window.removeEventListener('pointerdown', onInteraction)
      window.removeEventListener('keydown', onInteraction)
    }
  })
</script>

<div class="card-app" data-screen={$currentScreen}>
  <div
    id="phaser-container"
    class="phaser-container"
    class:visible={$currentScreen === 'combat'}
  ></div>

  {#if $currentScreen === 'hub' || $currentScreen === 'mainMenu' || $currentScreen === 'base'}
    {#if showActiveRunBanner}
      <div class="active-run-banner">
        <span>Run in progress</span>
        <button type="button" class="banner-resume-btn" onclick={handleResumeActiveRun}>Resume</button>
        <button type="button" class="banner-abandon-btn" onclick={handleAbandonRun}>Abandon</button>
      </div>
    {/if}
    <HubScreen
      streak={$playerSave?.stats.currentStreak ?? 0}
      lastRunSummary={$lastRunSummary}
      onStartRun={handleStartRun}
      onOpenLibrary={handleOpenLibrary}
      onOpenSettings={handleOpenSettings}
      onOpenProfile={handleOpenProfile}
      onOpenJournal={handleOpenJournal}
      onOpenLeaderboards={handleOpenLeaderboards}
    />
  {/if}

  {#if $currentScreen === 'domainSelection'}
    <DomainSelection onstart={handleDomainsChosen} onback={returnToMenu} />
  {/if}

  {#if $currentScreen === 'archetypeSelection'}
    <ArchetypeSelection onselect={handleArchetypeSelect} onskip={() => handleArchetypeSelect('balanced')} />
  {/if}

  {#if $currentScreen === 'onboarding'}
    <DungeonEntrance onbegin={handleOnboardingBegin} />
  {/if}

  {#if $currentScreen === 'combat'}
    <CardCombatOverlay
      turnState={$activeTurnState}
      activeBounties={$activeRunState?.bounties ?? []}
      onplaycard={handlePlayCard}
      onskipcard={handleSkipCard}
      onendturn={handleEndTurn}
      onusehint={handleUseHint}
    />
    <button
      type="button"
      class="pause-btn"
      data-testid="btn-pause"
      onclick={handlePause}
      aria-label="Pause"
    >II</button>
  {/if}

  {#if $currentScreen === 'cardReward'}
    <CardRewardScreen
      options={$activeCardRewardOptions}
      onselect={handleRewardSelected}
      onskip={onCardRewardSkipped}
      onreroll={onCardRewardReroll}
    />
  {/if}

  {#if $currentScreen === 'shopRoom'}
    <ShopRoomOverlay
      cards={$activeShopCards}
      currency={$activeRunState?.currency ?? 0}
      onsell={onShopSell}
      ondone={onShopDone}
    />
  {/if}

  {#if $currentScreen === 'specialEvent'}
    <SpecialEventOverlay
      event={$activeSpecialEvent}
      onresolve={handleSpecialEventResolved}
    />
  {/if}

  {#if $currentScreen === 'campfire'}
    {@const run = $activeRunState}
    {#if run}
      <CampfirePause
        currentFloor={run.floor.currentFloor}
        playerHp={run.playerHp}
        playerMaxHp={run.playerMaxHp}
        deckSize={0}
        relicCount={0}
        accuracy={run.factsAnswered > 0 ? Math.round((run.factsCorrect / run.factsAnswered) * 100) : 0}
        onresume={handleCampfireResume}
        onreturnhub={handleCampfireHub}
      />
    {/if}
  {/if}

  {#if $currentScreen === 'retreatOrDelve'}
    {@const run = $activeRunState}
    {#if run}
      <RetreatOrDelve
        bossName={run.floor.currentFloor === 3 ? 'Gate Guardian' : run.floor.currentFloor === 6 ? 'Magma Wyrm' : run.floor.currentFloor === 9 ? 'The Archivist' : 'Endless Sentinel'}
        segment={run.floor.segment}
        currency={run.currency}
        playerHp={run.playerHp}
        playerMaxHp={run.playerMaxHp}
        nextSegmentName={nextSegmentName(run.floor.currentFloor)}
        deathPenalty={getCurrentDelvePenalty()}
        onretreat={onRetreat}
        ondelve={onDelve}
      />
    {/if}
  {/if}

  {#if $currentScreen === 'roomSelection'}
    {@const run = $activeRunState}
    {#if run}
      <RoomSelection
        options={$activeRoomOptions}
        playerHp={run.playerHp}
        playerMaxHp={run.playerMaxHp}
        currentFloor={run.floor.currentFloor}
        encounterNumber={run.floor.currentEncounter}
        onselect={handleRoomPick}
      />
      <button
        type="button"
        class="pause-btn"
        data-testid="btn-pause-room"
        onclick={handlePause}
        aria-label="Pause"
      >II</button>
    {/if}
  {/if}

  {#if $currentScreen === 'mysteryEvent'}
    {@const run = $activeRunState}
    <MysteryEventOverlay
      event={$activeMysteryEvent}
      playerHp={run?.playerHp ?? 0}
      playerMaxHp={run?.playerMaxHp ?? 0}
      onresolve={handleMysteryResolve}
    />
  {/if}

  {#if $currentScreen === 'restRoom'}
    {@const run = $activeRunState}
    <RestRoomOverlay
      playerHp={run?.playerHp ?? 0}
      playerMaxHp={run?.playerMaxHp ?? 0}
      onheal={handleRestHeal}
      onupgrade={handleRestUpgrade}
    />
  {/if}

  {#if $currentScreen === 'runEnd'}
    {@const end = $activeRunEndData}
    {#if end}
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
        onplayagain={playAgain}
        onhome={returnToMenu}
      />
    {/if}
  {/if}

  {#if $currentScreen === 'library'}
    <KnowledgeLibrary onback={handleBackToMenu} />
  {/if}

  {#if $currentScreen === 'settings'}
    <SettingsPanel onback={handleBackToMenu} />
  {/if}

  {#if $currentScreen === 'profile'}
    <ProfileScreen onBack={handleBackToMenu} />
  {/if}

  {#if $currentScreen === 'journal'}
    <JournalScreen summary={$lastRunSummary} onBack={handleBackToMenu} />
  {/if}

  {#if $currentScreen === 'leaderboards'}
    <LeaderboardsScreen onBack={handleBackToMenu} />
  {/if}

  {#if shouldShowHubNav($currentScreen)}
    <HubNavBar current={normalizeHomeScreen($currentScreen)} onNavigate={handleHubNavigate} />
  {/if}
</div>

<style>
  .card-app {
    position: fixed;
    inset: 0;
    background: #0d1117;
    overflow: hidden;
  }

  .phaser-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 100vh;
    display: none;
  }

  .phaser-container.visible {
    display: block;
  }

  .pause-btn {
    position: fixed;
    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.85);
    color: #cbd5e1;
    font-size: 14px;
    font-weight: 800;
    z-index: 150;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: -1px;
  }

  .active-run-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 16px;
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
  }

  .banner-resume-btn {
    min-height: 32px;
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
    min-height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(30, 41, 59, 0.75);
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
  }

</style>
