<script lang="ts">
  import { get } from 'svelte/store'
  import { untrack } from 'svelte'
  import { GameManager } from './game/GameManager'
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
  import { collectFarmResources } from './services/saveService'
  import { calculateTotalPending } from './data/farm'
  import { gaiaMessage } from './ui/stores/gameState'

  const gm = GameManager.getInstance()

  // Cache getFacts() — avoids full SQL scan on every re-render
  let cachedFacts = $state<Fact[]>([])

  $effect(() => {
    if (untrack(() => cachedFacts.length) === 0) {
      try {
        cachedFacts = gm.getFacts()
      } catch { /* DB not ready yet */ }
    }
  })

  // Quiz mode tracking
  let quizMode = $state<'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer'>('gate')

  // Main menu start handler
  function handleStart(): void {
    currentScreen.set('base')
  }

  // Base actions
  function handleDive(): void {
    gm.goToDivePrep()
  }

  function handleStudy(): void {
    gm.startStudySession()
  }

  // Study session (card-flip mode) handlers
  let studySessionCorrectCount = $state(0)
  let studySessionTotal = $state(0)

  function handleStudyCardAnswer(factId: string, correct: boolean): void {
    if (correct) studySessionCorrectCount++
    studySessionTotal++
    gm.handleStudyCardAnswer(factId, correct)
  }

  function handleStudyComplete(): void {
    gm.completeStudySession(studySessionCorrectCount, studySessionTotal)
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
    gm.reviewNextArtifact()
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

  // Settings handlers
  function handleViewSettings(): void {
    currentScreen.set('settings')
  }

  function handleBackFromSettings(): void {
    currentScreen.set('base')
  }

  // Dive prep actions
  function handleStartDive(tanks: number): void {
    gm.startDive(tanks)
  }

  function handleBackFromDivePrep(): void {
    gm.goToBase()
  }

  // Mining HUD actions
  function handleSurface(): void {
    gm.endDive(false)
  }

  function handleOpenBackpack(): void {
    // Triggered by Phaser event, screen already set by GameManager
    // But also support direct call from HUD
    currentScreen.set('backpack')
  }

  function handleUseBomb(): void {
    gm.useBomb()
  }

  // Quiz actions
  function handleQuizAnswer(correct: boolean): void {
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
    } else {
      gm.handleStudyAnswer(correct)
    }
  }

  function handleQuizClose(): void {
    if (quizMode === 'gate') {
      gm.resumeQuiz(false)
    } else if (quizMode === 'oxygen') {
      gm.handleOxygenQuizAnswer(false)
    } else if (quizMode === 'artifact') {
      gm.handleArtifactQuizAnswer(false)
    } else if (quizMode === 'random') {
      gm.handleRandomQuizAnswer(false)
    } else if (quizMode === 'layer') {
      gm.handleLayerQuizAnswer(false)
    } else {
      currentScreen.set('base')
    }
  }

  // Backpack actions
  function handleCloseBackpack(): void {
    gm.closeBackpack()
  }

  function handleDropItem(index: number): void {
    gm.dropItem(index)
  }

  // Run stats actions
  function handleOpenRunStats(): void {
    gm.openRunStats()
  }

  function handleCloseRunStats(): void {
    gm.closeRunStats()
  }

  // Send-up station actions
  function handleSendUpConfirm(selectedItems: import('./data/types').InventorySlot[]): void {
    gm.confirmSendUp(selectedItems)
  }

  function handleSendUpSkip(): void {
    gm.skipSendUp()
  }

  // Fact reveal actions
  function handleLearnFact(): void {
    gm.learnArtifact()
  }

  function handleSellFact(): void {
    gm.sellArtifact()
  }

  // Dive results actions
  function handleDiveResultsContinue(): void {
    diveResults.set(null)
    const pending = get(pendingArtifacts)
    if (pending.length > 0) {
      gm.reviewNextArtifact()
    } else {
      gm.goToBase()
    }
  }

  // Track quiz mode from the activeQuiz source field
  $effect(() => {
    if ($currentScreen === 'quiz' && $activeQuiz) {
      quizMode = $activeQuiz.source ?? 'gate'
    }
  })
</script>

<div id="game-container"></div>
<div id="ui-overlay">
  {#if $currentScreen === 'mainMenu'}
    <div class="main-menu">
      <h1 class="game-title">Terra Gacha</h1>
      <p class="tagline">Mine. Discover. Learn.</p>
      <button class="start-btn" type="button" onclick={handleStart}>Start</button>
    </div>

  {:else if $currentScreen === 'base'}
    <BaseView
      onDive={handleDive}
      onStudy={handleStudy}
      onReviewArtifact={handleReviewArtifact}
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

  {:else if $currentScreen === 'divePrepScreen'}
    <DivePrepScreen
      availableTanks={$playerSave?.oxygen ?? 0}
      onStartDive={handleStartDive}
      onBack={handleBackFromDivePrep}
    />

  {:else if $currentScreen === 'mining'}
    <HUD
      onSurface={handleSurface}
      onOpenBackpack={handleOpenBackpack}
      onOpenRunStats={handleOpenRunStats}
      onUseBomb={handleUseBomb}
    />

  {:else if $currentScreen === 'quiz' && $activeQuiz}
    {#if quizMode === 'gate'}
      <HUD
        onSurface={handleSurface}
        onOpenBackpack={handleOpenBackpack}
        onOpenRunStats={handleOpenRunStats}
        onUseBomb={handleUseBomb}
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
    />
    <RunStatsOverlay
      blocksMined={$blocksMinedLive}
      onClose={handleCloseRunStats}
    />

  {:else if $currentScreen === 'factReveal' && $activeFact}
    <FactReveal
      fact={$activeFact}
      onLearn={handleLearnFact}
      onSell={handleSellFact}
    />

  {:else if $currentScreen === 'knowledgeTree'}
    <KnowledgeTreeView
      facts={cachedFacts}
      onBack={handleBackFromTree}
    />

  {:else if $currentScreen === 'diveResults'}
    <DiveResults onContinue={handleDiveResultsContinue} />

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
    <Settings onBack={handleBackFromSettings} />

  {:else if $currentScreen === 'sacrifice'}
    <!-- MVP: sacrifice screen is just a redirect back to base -->
    <div class="sacrifice-screen">
      <h2>Oxygen Depleted!</h2>
      <p>You lost 30% of your inventory...</p>
      <button type="button" onclick={() => currentScreen.set('base')}>Return to Base</button>
    </div>
  {/if}

  {#if $showSendUp}
    <SendUpOverlay
      slots={$inventory}
      onConfirm={handleSendUpConfirm}
      onSkip={handleSendUpSkip}
    />
  {/if}

  <DevPanel />
</div>

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

  .sacrifice-screen {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: rgba(0, 0, 0, 0.9);
    z-index: 50;
    font-family: 'Courier New', monospace;
    color: var(--color-accent);
  }

  .sacrifice-screen p {
    color: var(--color-text-dim);
  }

  .sacrifice-screen button {
    margin-top: 1rem;
    min-height: 48px;
    padding: 0.8rem 2rem;
    border: 1px solid var(--color-text-dim);
    border-radius: 12px;
    background: var(--color-surface);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
