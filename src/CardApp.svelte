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
    getCurrentDelvePenalty,
    onCardRewardSelected,
    onCardRewardSkipped,
    onDelve,
    onDomainsSelected,
    onMysteryResolved,
    onRestResolved,
    onRetreat,
    onRoomSelected,
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
    startEncounterForRoom()
  }

  function handleOnboardingBegin(slowReader: boolean): void {
    isSlowReader.set(slowReader)
    onDomainsSelected('science', 'history')
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
  {/if}

  {#if $currentScreen === 'cardReward'}
    <CardRewardScreen
      options={$activeCardRewardOptions}
      onselect={handleRewardSelected}
      onskip={onCardRewardSkipped}
    />
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

</style>
