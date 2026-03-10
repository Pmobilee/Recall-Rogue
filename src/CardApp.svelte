<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'

  let phaserContainer: HTMLDivElement
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
  import { isSlowReader, onboardingState } from './services/cardPreferences'
  import { unlockCardAudio } from './services/cardAudioManager'
  import { languageService } from './services/languageService'
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
    if (!startEncounterForRoom()) {
      currentScreen.set('hub')
      activeRunState.set(null)
    }
  }

  function handleOnboardingBegin(slowReader: boolean, languageCode: string | null): void {
    isSlowReader.set(slowReader)
    if (languageCode) {
      const firstLevel = languageService.getLevelsForLanguage(languageCode)[0]
      if (firstLevel) {
        languageService.setLanguageMode(languageCode, firstLevel.id)
      }
    } else {
      languageService.disableLanguageMode()
    }
    onDomainsSelected('natural_sciences', 'history')
    onArchetypeSelected('balanced')
    if (!startEncounterForRoom()) {
      currentScreen.set('hub')
      activeRunState.set(null)
    }
  }

  function handleRoomPick(index: number): void {
    const room = get(activeRoomOptions)[index]
    if (!room) return
    onRoomSelected(room)
    if (room.type === 'combat') {
      if (!startEncounterForRoom(room.enemyId)) {
        currentScreen.set('hub')
        activeRunState.set(null)
      }
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
    hasRunSave = false
  }

  let showAbandonConfirm = $state(false)
  let abandonRunInfo = $state<{ floor: number; gold: number; encounters: number; factsCorrect: number } | null>(null)

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
  let showActiveRunBanner = $derived(!$activeRunState && hasRunSave)

  $effect(() => {
    if ($currentScreen === 'hub') {
      hasRunSave = hasActiveRun()
    }
  })

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
    // Boot Phaser after Svelte has stabilized the DOM
    import('./game/CardGameManager').then(({ CardGameManager }) => {
      const mgr = CardGameManager.getInstance()
      mgr.boot()
    })

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
    bind:this={phaserContainer}
  ></div>

  {#if $currentScreen === 'hub' || $currentScreen === 'mainMenu' || $currentScreen === 'base'}
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
    {#if showActiveRunBanner}
      <div class="active-run-banner">
        <span>Run in progress</span>
        <button type="button" class="banner-resume-btn" onclick={handleResumeActiveRun}>Resume</button>
        <button type="button" class="banner-abandon-btn" onclick={handleAbandonRun}>Abandon</button>
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
      onreturnhub={() => { currentScreen.set('hub'); activeRunState.set(null); }}
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
        isFirstRunComplete={$onboardingState.runsCompleted === 1}
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
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 500px;
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
    font-family: monospace;
    font-weight: 700;
    z-index: 150;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 2px;
  }

  .active-run-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 250;
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
    padding: 24px;
    max-width: 320px;
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

  .abandon-confirm-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 16px;
  }

  .abandon-btn-cancel {
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid #64748b;
    background: transparent;
    color: #e2e8f0;
    font-size: 14px;
    cursor: pointer;
  }

  .abandon-btn-confirm {
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: #e74c3c;
    color: white;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  }

</style>
