<script lang="ts">
  import { currentScreen } from './ui/stores/gameState'
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
    startEncounterForRoom,
  } from './services/encounterBridge'
  import type { FactDomain } from './data/card-types'
  import type { MysteryEffect } from './services/floorManager'
  import { get } from 'svelte/store'
  import { healPlayer } from './services/runManager'

  import DomainSelection from './ui/components/DomainSelection.svelte'
  import CardCombatOverlay from './ui/components/CardCombatOverlay.svelte'
  import RoomSelection from './ui/components/RoomSelection.svelte'
  import MysteryEventOverlay from './ui/components/MysteryEventOverlay.svelte'
  import RestRoomOverlay from './ui/components/RestRoomOverlay.svelte'
  import RunEndScreen from './ui/components/RunEndScreen.svelte'
  import CardRewardScreen from './ui/components/CardRewardScreen.svelte'
  import RetreatOrDelve from './ui/components/RetreatOrDelve.svelte'

  function handleStartRun(): void {
    startNewRun()
  }

  function handleDomainsChosen(primary: FactDomain, secondary: FactDomain): void {
    onDomainsSelected(primary, secondary)
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
</script>

<div class="card-app" data-screen={$currentScreen}>
  <div
    id="phaser-container"
    class="phaser-container"
    class:visible={$currentScreen === 'combat'}
  ></div>

  {#if $currentScreen === 'mainMenu' || $currentScreen === 'base'}
    <div class="main-menu">
      <h1 class="menu-title">ARCANE RECALL</h1>
      <p class="menu-subtitle">Card Roguelite</p>
      <button class="start-btn" data-testid="btn-start-run" onclick={handleStartRun}>
        Start Run
      </button>
    </div>
  {/if}

  {#if $currentScreen === 'domainSelection'}
    <DomainSelection onstart={handleDomainsChosen} onback={returnToMenu} />
  {/if}

  {#if $currentScreen === 'combat'}
    <CardCombatOverlay
      turnState={$activeTurnState}
      onplaycard={handlePlayCard}
      onskipcard={handleSkipCard}
      onendturn={handleEndTurn}
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
        accuracy={end.accuracy}
        bestCombo={end.bestCombo}
        cardsEarned={end.cardsEarned}
        rewardMultiplier={end.rewardMultiplier}
        currencyEarned={end.currencyEarned}
        onplayagain={playAgain}
        onhome={returnToMenu}
      />
    {/if}
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
    height: 55vh;
    display: none;
  }

  .phaser-container.visible {
    display: block;
  }

  .main-menu {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 10;
  }

  .menu-title {
    font-size: 32px;
    font-weight: 800;
    color: #f1c40f;
    letter-spacing: 3px;
    margin: 0;
    text-align: center;
    text-shadow: 0 2px 8px rgba(241, 196, 15, 0.3);
  }

  .menu-subtitle {
    font-size: 14px;
    color: #8b949e;
    margin: 0 0 24px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .start-btn {
    width: 220px;
    height: 64px;
    background: linear-gradient(135deg, #27ae60, #2ecc71);
    border: none;
    border-radius: 16px;
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.2s;
    box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
    letter-spacing: 1px;
  }

  .start-btn:hover {
    transform: scale(1.03);
    box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
  }

  .start-btn:active {
    transform: scale(0.97);
  }
</style>
