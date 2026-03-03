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
    pendingRelicPickup,
    equippedRelicsV2,
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
  import DomeView from './ui/components/DomeView.svelte'
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
  import MiniMap from './ui/components/MiniMap.svelte'
  import RelicPickupOverlay from './ui/components/RelicPickupOverlay.svelte'
  import ResumeDiveModal from './ui/components/ResumeDiveModal.svelte'
  import { SaveManager } from './game/managers/SaveManager'
  import { collectFarmResources } from './services/saveService'
  import { calculateTotalPending } from './data/farm'
  import { gaiaMessage } from './ui/stores/gameState'
  import { generateBiomeSequence } from './data/biomes'
  import { seededRandom } from './game/systems/MineGenerator'

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

  // Preview biome for DivePrepScreen — seed changes every minute so it varies without being random
  const previewBiome = $derived.by(() => {
    const previewSeed = Math.floor(Date.now() / 60000)
    const rng = seededRandom(previewSeed ^ 0xb10e5)
    const seq = generateBiomeSequence(rng, 1)
    return seq[0] ?? null
  })

  // Quiz mode tracking
  let quizMode = $state<'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer'>('gate')

  // Resume modal state — shown when a mid-dive save is detected on app start (DD-V2-053)
  let showResumeModal = $state(false)

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

  function handleUseConsumable(id: import('./data/consumables').ConsumableId): void {
    gm.applyConsumable(id)
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
      gm.applyLootLoss(save.layer)
    }
    SaveManager.clear()
    gaiaMessage.set('Run abandoned. Some minerals were lost in the extraction.')
    setTimeout(() => gaiaMessage.set(null), 4000)
  }
</script>

<div id="game-container"></div>
<div id="ui-overlay">
  {#if showResumeModal}
    <ResumeDiveModal onResume={handleResumeDive} onAbandon={handleAbandonDive} />
  {/if}

  {#if $currentScreen === 'mainMenu'}
    <div class="main-menu">
      <h1 class="game-title">Terra Gacha</h1>
      <p class="tagline">Mine. Discover. Learn.</p>
      <button class="start-btn" type="button" onclick={handleStart}>Start</button>
    </div>

  {:else if $currentScreen === 'base'}
    <DomeView
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
    <div class="sacrifice-screen">
      <h2 class="sacrifice-title">Oxygen Depleted!</h2>
      <p class="sacrifice-subtitle">You've been rescued, but at a cost...</p>

      {#if $diveResults}
        <div class="sacrifice-summary">
          {#if $diveResults.forced}
            <p class="loss-notice">30% of in-pack items lost</p>
          {:else}
            <p class="insured-notice">Insured — no loss!</p>
          {/if}
          <div class="sacrifice-loot">
            {#if $diveResults.dustCollected > 0}
              <span class="loot-item">Dust: {$diveResults.dustCollected}</span>
            {/if}
            {#if $diveResults.shardsCollected > 0}
              <span class="loot-item">Shards: {$diveResults.shardsCollected}</span>
            {/if}
            {#if $diveResults.crystalsCollected > 0}
              <span class="loot-item">Crystals: {$diveResults.crystalsCollected}</span>
            {/if}
            {#if $diveResults.geodesCollected > 0}
              <span class="loot-item geode">Geodes: {$diveResults.geodesCollected}</span>
            {/if}
            {#if $diveResults.essenceCollected > 0}
              <span class="loot-item essence">Essence: {$diveResults.essenceCollected}</span>
            {/if}
            {#if $diveResults.dustCollected + $diveResults.shardsCollected + $diveResults.crystalsCollected + $diveResults.geodesCollected + $diveResults.essenceCollected === 0}
              <span class="loot-item dim">Nothing recovered...</span>
            {/if}
          </div>
          {#if $diveResults.blocksMined > 0}
            <p class="blocks-stat">Blocks mined: {$diveResults.blocksMined}</p>
          {/if}
        </div>
      {:else}
        <p class="sacrifice-fallback">Your items have been salvaged with losses.</p>
      {/if}

      <button class="sacrifice-btn" type="button" onclick={() => currentScreen.set('base')}>
        Return to Base
      </button>
    </div>
  {/if}

  {#if $showSendUp}
    <SendUpOverlay
      slots={$inventory}
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
    background: var(--color-bg);
    z-index: 30;
    font-family: 'Courier New', monospace;
    padding: 1.5rem;
  }

  .sacrifice-title {
    font-size: clamp(1.8rem, 6vw, 2.5rem);
    color: #ff6b6b;
  }

  .sacrifice-subtitle {
    color: var(--color-text-dim);
    font-size: 1rem;
  }

  .sacrifice-summary {
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    background: rgba(255, 107, 107, 0.06);
    width: min(100%, 22rem);
    text-align: center;
  }

  .loss-notice {
    color: #ff6b6b;
    font-weight: 700;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .insured-notice {
    color: var(--color-success);
    font-weight: 700;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .sacrifice-loot {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }

  .loot-item {
    background: rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
    color: var(--color-text);
  }

  .loot-item.dim {
    color: var(--color-text-dim);
    font-style: italic;
  }

  .loot-item.geode {
    color: #b388ff;
  }

  .loot-item.essence {
    color: #ffd700;
  }

  .blocks-stat {
    color: var(--color-text-dim);
    font-size: 0.8rem;
    margin-top: 0.5rem;
  }

  .sacrifice-fallback {
    color: var(--color-text-dim);
  }

  .sacrifice-btn {
    min-height: 48px;
    border: 2px solid color-mix(in srgb, var(--color-primary) 75%, white 25%);
    border-radius: 14px;
    padding: 0.85rem 2rem;
    background: color-mix(in srgb, var(--color-primary) 40%, var(--color-bg) 60%);
    color: var(--color-text);
    font: inherit;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 0.5rem;
  }
</style>
