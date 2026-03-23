<script lang="ts">
  import type { Card, CardType } from '../../data/card-types'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { getDetailedCardDescription, getShortCardDescription } from '../../services/cardDescriptionService'
  import { getCardTypeIconPath } from '../utils/iconAssets'
  import { getDomainMetadata } from '../../data/domainMetadata'
  import { getBorderUrl, getBaseFrameUrl, getBannerUrl, getUpgradeIconUrl } from '../utils/cardFrameV2'
  import { getCardArtUrl } from '../utils/cardArtManifest'
  import { activeRewardBundle, activeRewardRevealStep, holdScreenTransition, releaseScreenTransition } from '../../ui/stores/gameState'
  import { getRandomRoomBg, getRoomDepthMap } from '../../data/backgroundManifest'
  import { preloadImages } from '../utils/assetPreloader'
  import ParallaxTransition from './ParallaxTransition.svelte'
  import { untrack } from 'svelte'
  import { normalizeRewardSelection } from '../utils/rewardSelection'
  import { getChainTypeName, getChainTypeColor } from '../../data/chainTypes'
  import { getChainColor, getChainGlowColor } from '../../services/chainVisuals'
  import ChainIcon from './ChainIcon.svelte'
  import { isLandscape } from '../../stores/layoutStore'
  import { turboDelay } from '../../utils/turboMode'
  import { getSynergyLabel } from '../../data/synergies'
  import { getActiveDeckCards } from '../../services/encounterBridge'

  interface Props {
    options: Card[]
    onselect: (card: Card) => void
    onskip: () => void
    onrewardstepchange?: (step: 'gold' | 'heal' | 'card') => void
    /** Called when player rerolls the selected card type. Passes the current selected type. */
    onreroll?: (type: CardType) => void
  }

  let { options, onselect, onskip, onrewardstepchange, onreroll }: Props = $props()

  const bgUrl = getRandomRoomBg('treasure')
  const depthUrl = getRoomDepthMap('treasure')
  let showRoomTransition = $state(true)
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let selectedType = $state<CardType | null>(null)
  let collectLocked = $state(false)
  let collectingType = $state<CardType | null>(null)
  let hasPlayedIntroCue = $state(false)
  let showSkipConfirm = $state(false)
  /** Tracks rerolls used this reward screen. Max 1 per opening. */
  let rerollsUsed = $state(0)

  /** Mechanic IDs present in the player's current deck, for synergy detection. */
  let deckMechanics = $derived.by(() => {
    // Re-evaluate whenever options change so we capture fresh deck state
    void options
    return getActiveDeckCards()
      .map(c => c.mechanicId)
      .filter((id): id is string => id !== undefined)
  })

  // AR-124: Deck cycle-speed indicator
  /** Current deck size (before adding the reward card). */
  let currentDeckSize = $derived.by(() => {
    void options // re-evaluate when options refresh
    return getActiveDeckCards().length
  })
  /** Cycle speed = deckSize / 5 cards drawn per turn, rounded to 1 decimal. */
  function cycleSpeed(size: number): string {
    return (size / 5).toFixed(1)
  }

  // Reward reveal state
  let stepVisible = $state(false)
  let altarCeremonyPhase = $state(0)
  let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null

  interface AltarBiome {
    id: string
    title: string
    subtitle: string
    ambience: string
  }

  const TYPE_GLOW: Record<CardType, string> = {
    attack: '#ff8a65',
    shield: '#7ec8ff',
    buff: '#c8a6ff',
    debuff: '#ff9ec5',
    utility: '#ffe082',
    wild: '#ffd480',
  }

  const ALTAR_BIOMES: AltarBiome[] = [
    { id: 'cave-stone', title: 'Cavern Altar', subtitle: 'Cold stone and echoing depth.', ambience: 'Stone altar ambience' },
    { id: 'library-oak', title: 'Archive Table', subtitle: 'Polished oak lined with old runes.', ambience: 'Library oak ambience' },
    { id: 'forest-moss', title: 'Moss Shrine', subtitle: 'Lantern light over wet roots.', ambience: 'Forest shrine ambience' },
    { id: 'temple-marble', title: 'Temple Pedestal', subtitle: 'Marble plate under sacred light.', ambience: 'Temple marble ambience' },
    { id: 'obsidian-vault', title: 'Obsidian Vault', subtitle: 'Dark glass stone under purple flame.', ambience: 'Obsidian vault ambience' },
  ]

  let altarBiome = $state<AltarBiome>(ALTAR_BIOMES[0])
  let lastOptionsRef = $state<Card[]>([])

  // Derive reward bundle from store
  let bundle = $derived($activeRewardBundle)
  let rewardStep = $derived($activeRewardRevealStep)

  function setRewardStep(step: 'gold' | 'heal' | 'card'): void {
    console.log('[RewardScreen] step transition:', step)
    activeRewardRevealStep.set(step)
    onrewardstepchange?.(step)
  }

  function hashString(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0
    }
    return hash
  }

  function pickBiome(cards: Card[]): AltarBiome {
    const seed = cards.map((card) => card.factId).join('|')
    return ALTAR_BIOMES[hashString(seed) % ALTAR_BIOMES.length] ?? ALTAR_BIOMES[0]
  }

  function selectedCard(): Card | null {
    if (!selectedType) return null
    return options.find((option) => option.cardType === selectedType) ?? null
  }

  function selectedIndex(): number {
    if (!selectedType) return -1
    return options.findIndex((option) => option.cardType === selectedType)
  }

  function focusX(): string {
    if (options.length <= 1) return '50%'
    const idx = selectedIndex()
    if (idx < 0) return '50%'
    const step = 100 / (options.length + 1)
    return `${Math.round(step * (idx + 1))}%`
  }

  function hoverType(cardType: CardType): void {
    if (collectLocked || selectedType === cardType) return
    playCardAudio('card-cast')
  }

  function selectType(cardType: CardType): void {
    if (collectLocked) return
    if (selectedType !== cardType) {
      playCardAudio('card-cast')
    }
    selectedType = cardType
  }

  function accept(): void {
    const selected = selectedCard()
    if (!selected || collectLocked) return
    collectLocked = true
    collectingType = selected.cardType
    playCardAudio('card-accepted')
    playCardAudio('turn-chime')
    window.setTimeout(() => {
      onselect(selected)
    }, turboDelay(340))
  }

  function handleSkipClick(): void {
    if (collectLocked) return
    showSkipConfirm = true
  }

  function confirmSkip(): void {
    showSkipConfirm = false
    playCardAudio('card-skipped')
    onskip()
  }

  function cancelSkip(): void {
    showSkipConfirm = false
  }

  function handleReroll(): void {
    if (collectLocked || rerollsUsed >= 1 || !onreroll) return
    const type = selectedType ?? options[0]?.cardType
    if (!type) return
    rerollsUsed++
    playCardAudio('card-rerolled')
    onreroll(type)
  }

  function startCeremony(): void {
    altarCeremonyPhase = 1
    setTimeout(() => {
      altarCeremonyPhase = 2
    }, turboDelay(300))
    setTimeout(() => {
      altarCeremonyPhase = 3
    }, turboDelay(600))
    setTimeout(() => {
      altarCeremonyPhase = 4
    }, turboDelay(900))
    setTimeout(() => {
      altarCeremonyPhase = 0
    }, turboDelay(1200))
  }

  function advanceStep(): void {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer)
      autoAdvanceTimer = null
    }
    stepVisible = false
    setTimeout(() => {
      if (rewardStep === 'gold') {
        if (bundle && bundle.healAmount > 0) {
          setRewardStep('heal')
        } else {
          setRewardStep('card')
          startCeremony()
        }
      } else if (rewardStep === 'heal') {
        setRewardStep('card')
        startCeremony()
      }
      stepVisible = true
    }, turboDelay(200))
  }

  $effect(() => {
    // Only depend on options and bundle
    const opts = options
    const b = bundle

    untrack(() => {
      if (opts.length === 0) {
        selectedType = null
        lastOptionsRef = []
        return
      }

      // Only reset reward step when options actually change (new reward screen)
      const isNewReward = opts !== lastOptionsRef
      if (isNewReward) {
        lastOptionsRef = opts
        if (!b || (b.goldEarned === 0 && b.healAmount === 0)) {
          setRewardStep('card')
        } else {
          setRewardStep('gold')
        }
        stepVisible = false
        setTimeout(() => {
          stepVisible = true
        }, turboDelay(100))

        if (!hasPlayedIntroCue) {
          playCardAudio('reward-screen')
          playCardAudio('combo-3')
          hasPlayedIntroCue = true
        }
        collectLocked = false
        collectingType = null
        selectedType = null
        showSkipConfirm = false
        rerollsUsed = 0
        altarBiome = pickBiome(opts)
      }

      selectedType = normalizeRewardSelection(selectedType, opts)
    })
  })

  $effect(() => {
    const step = rewardStep
    const b = bundle
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer)
      autoAdvanceTimer = null
    }
    if (!stepVisible) return
    if (step === 'gold' && b) {
      autoAdvanceTimer = setTimeout(() => {
        advanceStep()
      }, turboDelay(900))
    } else if (step === 'heal' && b) {
      autoAdvanceTimer = setTimeout(() => {
        advanceStep()
      }, turboDelay(1000))
    }
    return () => {
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer)
        autoAdvanceTimer = null
      }
    }
  })

  function isSelected(option: Card): boolean {
    return selectedType === option.cardType
  }

  function isShadowed(option: Card): boolean {
    return collectingType !== null && option.cardType !== collectingType
  }

  function isCollecting(option: Card): boolean {
    return collectingType !== null && option.cardType === collectingType
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (rewardStep !== 'card') return
    if (collectLocked) return
    if (e.key === '1' && options[0]) { selectType(options[0].cardType); return }
    if (e.key === '2' && options[1]) { selectType(options[1].cardType); return }
    if (e.key === '3' && options[2]) { selectType(options[2].cardType); return }
    if (e.key === 'Enter' && selectedCard()) { accept(); return }
    if (e.key === 'Escape') { handleSkipClick(); return }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="reward-screen" class:card-phase={rewardStep === 'card'} class:landscape={$isLandscape}>
  <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true" />
{#if rewardStep === 'gold' && bundle}
    <div class="step-container" class:step-visible={stepVisible}>
      <div class="step-icon-action gold-action" aria-hidden="true">
        <div class="step-icon">🪙</div>
      </div>
      <h1 class="step-title">Gold Earned</h1>
      <div class="step-value gold-value">+{bundle.goldEarned}</div>
    </div>
  {:else if rewardStep === 'heal' && bundle}
    <div class="step-container" class:step-visible={stepVisible}>
      <div class="step-icon-action heal-action" aria-hidden="true">
        <img class="step-icon-img" src={getCardTypeIconPath('heal')} alt="Heart"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; ((e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
        <span class="step-icon-fallback" style="display:none">💚</span>
      </div>
      <h1 class="step-title">HP Restored</h1>
      <div class="step-value heal-value">+{bundle.healAmount} HP</div>
    </div>
  {:else}
    <div class="spotlight-cone" aria-hidden="true"></div>

    <section class={`altar-shell biome-${altarBiome.id}`} class:ceremony-phase-1={altarCeremonyPhase >= 1} class:ceremony-phase-2={altarCeremonyPhase >= 2} class:ceremony-phase-3={altarCeremonyPhase >= 3} class:ceremony-phase-4={altarCeremonyPhase >= 4}>
      <header class="altar-header">
        <h1>Choose a Card</h1>
        <p>{altarBiome.title} • {altarBiome.subtitle}</p>
      </header>

      <div class="altar-surface" style={`--focus-x: ${focusX()};`}>
        <div class="altar-cloth"></div>

        <div class="altar-options">
          {#each options as option, i (option.mechanicId ?? `${option.cardType}-${i}`)}
            {@const domainColor = getDomainMetadata(option.domain).colorTint}
            {@const typeGlow = TYPE_GLOW[option.cardType] ?? '#ffffff'}
            <button
              class="altar-option"
              class:selected={isSelected(option)}
              class:shadowed={isShadowed(option)}
              class:collecting={isCollecting(option)}
              class:upgraded={option.isUpgraded}
              style={`border-top: 6px solid ${getChainColor(option.chainType ?? 0)}; --icon-glow: ${typeGlow}; --domain-color: ${domainColor}; --chain-color: ${getChainColor(option.chainType ?? 0)}; --chain-glow: ${getChainGlowColor(option.chainType ?? 0)};`}
              onclick={() => selectType(option.cardType)}
              onpointerenter={() => hoverType(option.cardType)}
              disabled={collectLocked}
              data-testid={`reward-type-${option.cardType}`}
              aria-label={`Inspect ${option.mechanicName ?? option.cardType} reward`}
            >
              <!-- V2 layered card frame -->
              <div class="card-v2-frame">
                <img class="frame-layer" src={getBorderUrl(option.cardType)} alt="" style="z-index:0;" />
                {#if option.mechanicId}
                  {@const artUrl = getCardArtUrl(option.mechanicId)}
                  {#if artUrl}
                    <img class="frame-card-art" src={artUrl} alt="" style="z-index:1;" />
                  {/if}
                {/if}
                <img class="frame-layer" src={getBaseFrameUrl()} alt="" style="z-index:2;" />
                <img class="frame-layer" src={getBannerUrl(option.chainType ?? 0)} alt="" style="z-index:3;" />
                {#if option.isUpgraded}
                  <img class="frame-layer upgrade-icon" src={getUpgradeIconUrl()} alt="" style="z-index:4;" />
                {/if}
              </div>
              <div class="mini-card-ap">{option.apCost ?? 1}</div>
              {#if option.isUpgraded}
                <div class="mini-card-upgrade">+</div>
              {/if}
              <div class="mini-card-name">{option.mechanicName ?? option.cardType}</div>
              <div class="mini-card-desc">{getShortCardDescription(option)}</div>
              {#if option.chainType !== undefined}
                <div class="chain-badge" style="
                  background: {getChainTypeColor(option.chainType)}20;
                  color: {getChainTypeColor(option.chainType)};
                  border: 1px solid {getChainTypeColor(option.chainType)}66;
                ">
                  <ChainIcon chainType={option.chainType} size={11} />
                  {getChainTypeName(option.chainType)}
                </div>
              {/if}
              {#if option.mechanicId}
                {@const synergyLabel = getSynergyLabel(option.mechanicId, deckMechanics)}
                {#if synergyLabel}
                  <div class="synergy-badge" title="Synergizes with cards in your deck">
                    Synergy: {synergyLabel}
                  </div>
                {/if}
              {/if}
              <div class="mini-card-domain-bar" style={`background: ${domainColor};`}></div>
            </button>
          {/each}
        </div>

        <!-- AR-124: Deck cycle-speed indicator -->
        <div class="cycle-speed-indicator">
          Deck: {currentDeckSize} cards (cycle: {cycleSpeed(currentDeckSize)} turns)
          &rarr; {currentDeckSize + 1} cards ({cycleSpeed(currentDeckSize + 1)} turns)
        </div>
      </div>

      <section class="inspect-panel">
        <div class="inspect-kicker">Inspected Reward</div>
        {#if selectedCard()}
          {@const selected = selectedCard()!}
          <h2>{selected.mechanicName ?? selected.cardType}</h2>
          {#if selected.mechanicName}
            <span class="inspect-mechanic-badge">{selected.mechanicName}</span>
          {/if}
          {#if selected.isUpgraded}
            <span class="inspect-upgrade-badge">Upgraded</span>
          {/if}
          <p class="inspect-summary">{getDetailedCardDescription(selected)}</p>
        {:else}
          <h2>Inspect a card</h2>
          <p class="inspect-summary">Click a card on the altar to reveal details.</p>
        {/if}
      </section>
    </section>

    <div class="actions">
      {#if onreroll !== undefined}
        <button
          class="reroll-btn"
          class:reroll-used={rerollsUsed >= 1}
          onclick={handleReroll}
          disabled={collectLocked || rerollsUsed >= 1}
          aria-label={rerollsUsed >= 1 ? 'Reroll already used' : 'Reroll card options'}
          data-testid="reward-reroll"
        >
          {rerollsUsed >= 1 ? 'Rerolled' : 'Reroll'}
        </button>
      {/if}
      <button class="skip" onclick={handleSkipClick} disabled={collectLocked}>Skip</button>
      <button class="accept" onclick={accept} disabled={!selectedCard() || collectLocked} data-testid="reward-accept">
        {collectLocked ? 'Collecting...' : 'Accept'}
      </button>
    </div>

    {#if showSkipConfirm}
      <div class="skip-confirm-overlay">
        <div class="skip-confirm-box">
          <p>Skip this reward? You won't get another card.</p>
          <div class="skip-confirm-buttons">
            <button class="skip-confirm-btn skip-confirm-yes" onclick={confirmSkip}>Yes, Skip</button>
            <button class="skip-confirm-btn skip-confirm-no" onclick={cancelSkip}>Cancel</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if showRoomTransition}
  <ParallaxTransition
    imageUrl={bgUrl}
    depthUrl={depthUrl}
    type="enter"
    onComplete={() => { showRoomTransition = false }}
      persist
  />
{/if}

<style>
  .reward-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    z-index: 220;
    padding: calc(calc(24px * var(--layout-scale, 1)) + var(--safe-top)) calc(16px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    color: #f4f5f7;
    background:
      radial-gradient(1200px 500px at 50% -90px, rgba(252, 230, 173, 0.12), transparent 68%),
      linear-gradient(180deg, #080b13 0%, #0d1422 48%, #05080f 100%);
    display: grid;
    gap: calc(14px * var(--layout-scale, 1));
    justify-items: center;
    align-content: center;
  }

  .reward-screen.card-phase {
    align-content: center;
    padding-top: calc(calc(12px * var(--layout-scale, 1)) + var(--safe-top));
  }

  .overlay-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
  }

  .reward-screen > :not(.overlay-bg):not(.spotlight-cone) {
    position: relative;
    z-index: 1;
  }

  .step-container {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(16px * var(--layout-scale, 1));
    padding-top: min(8vh, calc(56px * var(--layout-scale, 1)));
    padding-bottom: var(--safe-top);
    opacity: 0;
    transform: scale(0.95);
    transition: opacity 250ms ease, transform 250ms ease;
  }

  .step-container.step-visible {
    opacity: 1;
    transform: scale(1);
  }

  .step-icon {
    font-size: calc(86px * var(--layout-scale, 1));
    line-height: 1;
    text-shadow:
      calc(-3px * var(--layout-scale, 1)) 0 #000,
      calc(3px * var(--layout-scale, 1)) 0 #000,
      0 calc(-3px * var(--layout-scale, 1)) #000,
      0 calc(3px * var(--layout-scale, 1)) #000,
      calc(-3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000,
      calc(3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000,
      calc(3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000,
      calc(-3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000,
      0 0 20px rgba(255, 200, 50, 0.45);
    animation: rewardBob 2200ms ease-in-out infinite;
  }

  .step-icon-action {
    width: calc(164px * var(--layout-scale, 1));
    height: calc(164px * var(--layout-scale, 1));
    border: 4px solid #000;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(34, 50, 69, 0.92), rgba(13, 20, 30, 0.96));
    cursor: default;
    display: grid;
    place-items: center;
    box-shadow:
      0 10px 0 rgba(0, 0, 0, 0.5),
      0 18px 26px rgba(0, 0, 0, 0.5),
      inset 0 0 0 2px rgba(255, 255, 255, 0.06);
    image-rendering: pixelated;
    animation: rewardBreath 1800ms ease-in-out infinite;
  }

  .step-icon-img {
    width: calc(92px * var(--layout-scale, 1));
    height: calc(92px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    filter: drop-shadow(0 0 14px rgba(74, 222, 128, 0.38));
    animation: rewardBob 2200ms ease-in-out infinite;
  }

  .step-icon-fallback {
    font-size: calc(72px * var(--layout-scale, 1));
    line-height: 1;
  }

  .gold-action {
    border-color: #000;
    box-shadow:
      0 10px 0 rgba(0, 0, 0, 0.5),
      0 18px 26px rgba(0, 0, 0, 0.5),
      0 0 22px rgba(255, 195, 32, 0.35),
      inset 0 0 0 2px rgba(255, 255, 255, 0.06);
  }

  .heal-action {
    border-color: #000;
    box-shadow:
      0 10px 0 rgba(0, 0, 0, 0.5),
      0 18px 26px rgba(0, 0, 0, 0.5),
      0 0 22px rgba(62, 220, 123, 0.35),
      inset 0 0 0 2px rgba(255, 255, 255, 0.06);
  }

  .step-title {
    font-family: var(--font-pixel);
    font-size: calc(22px * var(--layout-scale, 1));
    font-weight: 900;
    color: #f8d779;
    text-shadow:
      calc(-3px * var(--layout-scale, 1)) 0 #000, calc(3px * var(--layout-scale, 1)) 0 #000, 0 calc(-3px * var(--layout-scale, 1)) #000, 0 calc(3px * var(--layout-scale, 1)) #000,
      calc(-3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(-3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000,
      0 4px 12px rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  .step-value {
    font-family: var(--font-pixel);
    font-size: calc(36px * var(--layout-scale, 1));
    font-weight: 900;
    margin: calc(8px * var(--layout-scale, 1)) 0;
    text-shadow:
      calc(-3px * var(--layout-scale, 1)) 0 #000, calc(3px * var(--layout-scale, 1)) 0 #000, 0 calc(-3px * var(--layout-scale, 1)) #000, 0 calc(3px * var(--layout-scale, 1)) #000,
      calc(-3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(-3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000;
  }

  .gold-value {
    color: #ffd700;
    text-shadow:
      calc(-3px * var(--layout-scale, 1)) 0 #000, calc(3px * var(--layout-scale, 1)) 0 #000, 0 calc(-3px * var(--layout-scale, 1)) #000, 0 calc(3px * var(--layout-scale, 1)) #000,
      calc(-3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(-3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000,
      0 0 20px rgba(255, 215, 0, 0.5);
  }

  .heal-value {
    color: #4ade80;
    text-shadow:
      calc(-3px * var(--layout-scale, 1)) 0 #000, calc(3px * var(--layout-scale, 1)) 0 #000, 0 calc(-3px * var(--layout-scale, 1)) #000, 0 calc(3px * var(--layout-scale, 1)) #000,
      calc(-3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000, calc(3px * var(--layout-scale, 1)) calc(-3px * var(--layout-scale, 1)) #000, calc(-3px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) #000,
      0 0 20px rgba(74, 222, 128, 0.5);
  }

  .step-bonus {
    font-size: calc(21px * var(--layout-scale, 1));
    color: #fbbf24;
    font-weight: 700;
    text-shadow:
      calc(-1px * var(--layout-scale, 1)) 0 #000,
      calc(1px * var(--layout-scale, 1)) 0 #000,
      0 calc(-1px * var(--layout-scale, 1)) #000,
      0 calc(1px * var(--layout-scale, 1)) #000;
  }

  @keyframes rewardBob {
    0%, 100% { transform: scale(1); }
    50% { transform: translateY(-4px) scale(1.04) rotate(-1deg); }
  }

  @keyframes rewardBreath {
    0%, 100% { transform: perspective(600px) rotateX(2deg) rotateY(-1deg); }
    50% { transform: perspective(600px) rotateX(-1deg) rotateY(1deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .step-icon,
    .step-icon-action {
      animation: none;
    }
  }

  .spotlight-cone {
    position: absolute;
    top: calc(-160px * var(--layout-scale, 1));
    left: 50%;
    width: min(780px, 92vw);
    height: calc(620px * var(--layout-scale, 1));
    transform: translateX(-50%);
    pointer-events: none;
    background: radial-gradient(ellipse at top, rgba(255, 244, 208, 0.28) 0%, rgba(255, 222, 143, 0.1) 36%, rgba(0, 0, 0, 0) 74%);
    filter: blur(1px);
  }

  .altar-shell {
    position: relative;
    width: min(920px, 100%);
    border-radius: 18px;
    padding: calc(16px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 244, 214, 0.24);
    background: linear-gradient(180deg, rgba(20, 27, 37, 0.9), rgba(11, 17, 26, 0.94));
    box-shadow: 0 26px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    display: grid;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .biome-cave-stone {
    --surface-a: #2f3541;
    --surface-b: #1c232f;
    --cloth: #6f4834;
    --cloth-border: #a87958;
  }

  .biome-library-oak {
    --surface-a: #4d3524;
    --surface-b: #281b12;
    --cloth: #2f4f6f;
    --cloth-border: #7ea1bf;
  }

  .biome-forest-moss {
    --surface-a: #304733;
    --surface-b: #1f2d22;
    --cloth: #5a4230;
    --cloth-border: #94bf86;
  }

  .biome-temple-marble {
    --surface-a: #61656f;
    --surface-b: #3a4049;
    --cloth: #4a3a5f;
    --cloth-border: #d6bfd6;
  }

  .biome-obsidian-vault {
    --surface-a: #2f2742;
    --surface-b: #151026;
    --cloth: #5f3f2a;
    --cloth-border: #cfac7a;
  }

  .altar-header h1 {
    margin: 0;
    font-size: calc(30px * var(--layout-scale, 1));
    font-weight: 900;
    letter-spacing: 0.6px;
    color: #f8d779;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  }

  .altar-header p {
    margin: calc(4px * var(--layout-scale, 1)) 0 0;
    color: #c8d0dc;
    font-size: calc(14px * var(--layout-scale, 1));
  }

  .altar-surface {
    position: relative;
    border-radius: 14px;
    padding: calc(18px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: linear-gradient(145deg, var(--surface-a), var(--surface-b));
    border: 1px solid rgba(255, 255, 255, 0.15);
    overflow: hidden;
  }

  .altar-surface::before {
    content: '';
    position: absolute;
    inset: -120px -160px 0;
    pointer-events: none;
    background: radial-gradient(circle at var(--focus-x) 14%, rgba(255, 243, 208, 0.28), rgba(255, 239, 186, 0.07) 28%, transparent 58%);
    transition: background-position 180ms ease;
  }

  .altar-cloth {
    position: absolute;
    inset: 14px 9% 8px;
    border-radius: 10px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent 30%),
      repeating-linear-gradient(45deg, color-mix(in srgb, var(--cloth) 84%, #000 16%) 0 10px, var(--cloth) 10px 20px);
    border: 1px solid var(--cloth-border);
    opacity: 0.86;
    pointer-events: none;
  }

  .altar-options {
    position: relative;
    min-height: calc(168px * var(--layout-scale, 1));
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(10px * var(--layout-scale, 1));
    align-items: end;
  }

  /* AR-124: Deck cycle-speed indicator */
  .cycle-speed-indicator {
    text-align: center;
    font-size: calc(11px * var(--layout-scale, 1));
    color: #6E7681;
    margin-top: calc(6px * var(--layout-scale, 1));
    letter-spacing: 0.02em;
  }

  .altar-option {
    position: relative;
    border: none;
    border-radius: 0;
    min-height: calc(146px * var(--layout-scale, 1));
    padding: calc(28px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    color: #fff;
    background: transparent;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    text-align: center;
    gap: calc(3px * var(--layout-scale, 1));
    transition: transform 140ms ease, opacity 140ms ease, filter 140ms ease, box-shadow 140ms ease;
    animation: iconBob 2.6s ease-in-out infinite;
    cursor: pointer;
    overflow: hidden;
  }

  .altar-option:nth-child(2) {
    animation-delay: 220ms;
  }

  .altar-option:nth-child(3) {
    animation-delay: 440ms;
  }

  .altar-option::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 12px;
    background: linear-gradient(115deg, transparent 24%, rgba(255, 255, 255, 0.32), transparent 69%);
    opacity: 0.22;
    mix-blend-mode: screen;
    transform: translateX(-120%);
    animation: iconShimmer 2.9s ease-in-out infinite;
    pointer-events: none;
  }

  .altar-option.selected {
    transform: translateY(-8px) scale(1.03);
    box-shadow: 0 0 0 2px var(--chain-color, #f6d57d), 0 18px 28px rgba(0, 0, 0, 0.4), 0 0 28px var(--chain-glow, transparent);
  }

  .altar-option.shadowed {
    opacity: 0.28;
    filter: grayscale(0.45) brightness(0.66);
  }

  .altar-option.collecting {
    animation: collectFly 340ms ease-in forwards;
    z-index: 2;
  }

  /* Mini-card inner elements */
  .mini-card-ap {
    position: absolute;
    top: calc(5px * var(--layout-scale, 1));
    left: calc(5px * var(--layout-scale, 1));
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(10, 16, 28, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(11px * var(--layout-scale, 1));
    font-weight: 900;
    color: #ffd700;
    line-height: 1;
  }

  .mini-card-upgrade {
    position: absolute;
    top: calc(5px * var(--layout-scale, 1));
    right: calc(5px * var(--layout-scale, 1));
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    border-radius: 50%;
    background: rgba(180, 140, 0, 0.9);
    border: 1px solid #ffd700;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 900;
    color: #fff;
    line-height: 1;
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.6);
  }

  .altar-option.upgraded {
    border-width: 4px;
    box-shadow: 0 10px 0 rgba(0,0,0,0.5), 0 18px 26px rgba(0,0,0,0.5), 0 0 14px var(--chain-glow, transparent), inset 0 0 0 2px rgba(255, 215, 0, 0.25);
  }

  .altar-option.upgraded.selected {
    box-shadow: 0 0 0 2px var(--chain-color, #ffd700), 0 18px 28px rgba(0, 0, 0, 0.4), 0 0 28px var(--chain-glow, transparent), inset 0 0 0 2px rgba(255, 215, 0, 0.3);
  }

  .mini-card-name {
    font-weight: 800;
    font-size: calc(13px * var(--layout-scale, 1));
    letter-spacing: 0.2px;
    color: #f4f5f7;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    line-height: 1.2;
    margin-top: auto;
    padding: 0 calc(2px * var(--layout-scale, 1));
    text-align: center;
  }

  .mini-card-desc {
    font-size: calc(10px * var(--layout-scale, 1));
    color: #c8d2df;
    line-height: 1.3;
    text-align: center;
    padding: 0 calc(2px * var(--layout-scale, 1));
    margin-bottom: calc(14px * var(--layout-scale, 1));
  }

  .mini-card-domain-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(4px * var(--layout-scale, 1));
    border-radius: 0 0 12px 12px;
    opacity: 0.8;
  }

  .inspect-upgrade-badge {
    display: inline-block;
    background: rgba(120, 90, 0, 0.6);
    border: 1px solid rgba(255, 215, 0, 0.5);
    border-radius: 6px;
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(12px * var(--layout-scale, 1));
    color: #ffd700;
    font-weight: 700;
    letter-spacing: 0.3px;
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  .altar-trinkets {
    display: flex;
    justify-content: center;
    gap: calc(12px * var(--layout-scale, 1));
    margin-top: calc(8px * var(--layout-scale, 1));
    opacity: 0.82;
  }

  .trinket {
    font-size: calc(19px * var(--layout-scale, 1));
    filter: drop-shadow(0 0 10px color-mix(in srgb, var(--trinket-glow) 48%, transparent));
    animation: trinketPulse 2.8s ease-in-out infinite;
  }

  .trinket:nth-child(2) {
    animation-delay: 260ms;
  }

  .trinket:nth-child(3) {
    animation-delay: 520ms;
  }

  .inspect-panel {
    border-radius: 12px;
    border: 1px solid rgba(189, 205, 224, 0.25);
    background: rgba(10, 16, 25, 0.82);
    padding: calc(12px * var(--layout-scale, 1));
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .inspect-kicker {
    color: #9fb2c8;
    font-size: calc(11px * var(--layout-scale, 1));
    letter-spacing: 0.5px;
    text-transform: uppercase;
    font-weight: 700;
  }

  .inspect-panel h2 {
    margin: 0;
    font-size: calc(21px * var(--layout-scale, 1));
    color: #ffde8f;
  }

  .inspect-mechanic-badge {
    display: inline-block;
    background: rgba(40, 80, 120, 0.5);
    border: 1px solid rgba(100, 160, 220, 0.4);
    border-radius: 6px;
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(12px * var(--layout-scale, 1));
    color: #9ec8ff;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .inspect-summary {
    margin: 0;
    color: #c8d2df;
    font-size: calc(14px * var(--layout-scale, 1));
  }

  .inspect-meta {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    flex-wrap: wrap;
    font-size: calc(12px * var(--layout-scale, 1));
    color: #9ec8ff;
    font-weight: 700;
  }

  .inspect-meta span {
    background: rgba(40, 58, 80, 0.5);
    border: 1px solid rgba(135, 171, 206, 0.32);
    border-radius: 999px;
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
  }

  .actions {
    width: min(920px, 100%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(8px * var(--layout-scale, 1));
    align-self: end;
  }

  .reroll-btn {
    grid-column: 1 / -1;
    height: calc(40px * var(--layout-scale, 1));
    border-radius: 10px;
    border: 1px solid rgba(130, 160, 200, 0.35);
    background: rgba(30, 50, 80, 0.7);
    color: #9ec8ff;
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: background 120ms ease, opacity 120ms ease, color 120ms ease;
  }

  .reroll-btn:hover:not(:disabled):not(.reroll-used) {
    background: rgba(45, 75, 120, 0.85);
    color: #c8dff8;
  }

  .reroll-btn.reroll-used,
  .reroll-btn:disabled {
    opacity: 0.45;
    color: #6b7a8d;
    background: rgba(20, 28, 40, 0.6);
    border-color: rgba(80, 90, 110, 0.3);
    cursor: not-allowed;
    pointer-events: none;
  }

  .accept,
  .skip {
    height: calc(52px * var(--layout-scale, 1));
    border-radius: 10px;
    border: none;
    font-size: calc(15px * var(--layout-scale, 1));
    font-weight: 800;
    letter-spacing: 0.3px;
  }

  .accept {
    background: linear-gradient(180deg, #35c173, #249752);
    color: #fff;
  }

  .skip {
    background: #2d333b;
    color: #9ba4ad;
  }

  .accept:disabled,
  .skip:disabled,
  .altar-option:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  .accept:disabled {
    background: #2d333b;
    color: #6b7280;
    opacity: 0.6;
    cursor: not-allowed;
  }

  .skip-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skip-confirm-box {
    background: #1f2937;
    border: 1px solid #475569;
    border-radius: 12px;
    padding: calc(20px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    max-width: calc(280px * var(--layout-scale, 1));
    text-align: center;
  }

  .skip-confirm-box p {
    color: #f8fafc;
    font-size: calc(15px * var(--layout-scale, 1));
    margin: 0 0 calc(16px * var(--layout-scale, 1));
    line-height: 1.4;
  }

  .skip-confirm-buttons {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .skip-confirm-btn {
    flex: 1;
    height: 44px;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    font-family: inherit;
  }

  .skip-confirm-yes {
    background: #dc2626;
    color: #fff;
  }

  .skip-confirm-no {
    background: #374151;
    color: #f8fafc;
  }

  @keyframes iconBob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }

  @keyframes iconShimmer {
    0%,
    32% {
      transform: translateX(-135%);
      opacity: 0;
    }
    48% {
      opacity: 0.3;
    }
    66%,
    100% {
      transform: translateX(150%);
      opacity: 0;
    }
  }

  @keyframes trinketPulse {
    0%,
    100% {
      transform: translateY(0) scale(1);
    }
    50% {
      transform: translateY(-2px) scale(1.06);
    }
  }

  @keyframes collectFly {
    from {
      opacity: 1;
      transform: translateY(-8px) scale(1.03);
    }
    to {
      opacity: 0;
      transform: translate(58vw, -48vh) scale(0.32);
      filter: brightness(1.35);
    }
  }

  /* Ceremony Phase 1: Altar brightens */
  .ceremony-phase-1 {
    animation: altarBrighten 300ms ease-out;
  }

  @keyframes altarBrighten {
    0% {
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.3);
    }
    100% {
      filter: brightness(1);
    }
  }

  /* Ceremony Phase 2: Options stagger in */
  .ceremony-phase-2 .altar-option {
    animation: ceremonyRise 400ms ease-out both;
  }

  .ceremony-phase-2 .altar-option:nth-child(1) {
    animation-delay: 0ms;
  }

  .ceremony-phase-2 .altar-option:nth-child(2) {
    animation-delay: 100ms;
  }

  .ceremony-phase-2 .altar-option:nth-child(3) {
    animation-delay: 200ms;
  }

  @keyframes ceremonyRise {
    0% {
      opacity: 0;
      transform: translateY(20px) scale(0.9);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Ceremony Phase 3: Selected option glows brighter */
  .ceremony-phase-3 .altar-option.selected {
    box-shadow: 0 0 0 2px var(--chain-color, #f6d57d), 0 18px 28px rgba(0, 0, 0, 0.4), 0 0 40px var(--chain-glow, transparent);
    transform: translateY(-12px) scale(1.06);
    transition: all 300ms ease;
  }

  /* Ceremony Phase 4: Integration — spotlight narrows */
  .ceremony-phase-4 .spotlight-cone {
    animation: spotlightNarrow 300ms ease-in-out;
  }

  @keyframes spotlightNarrow {
    0% {
      opacity: 1;
      transform: translateX(-50%) scaleX(1);
    }
    50% {
      opacity: 0.6;
      transform: translateX(-50%) scaleX(0.7);
    }
    100% {
      opacity: 1;
      transform: translateX(-50%) scaleX(1);
    }
  }

  /* Enhanced step value animation */
  .step-value {
    animation: valueSlam 400ms ease-out;
  }

  @keyframes valueSlam {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    60% {
      transform: scale(1.15);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Reduced motion: skip all ceremony animations */
  @media (prefers-reduced-motion: reduce) {
    .ceremony-phase-1,
    .ceremony-phase-2 .altar-option,
    .ceremony-phase-3 .altar-option.selected,
    .ceremony-phase-4 .spotlight-cone {
      animation: none !important;
    }
  }

  .chain-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7em;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-top: 4px;
  }

  .synergy-badge {
    display: block;
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 0.65em;
    font-weight: 700;
    letter-spacing: 0.4px;
    color: #4ade80;
    background: rgba(74, 222, 128, 0.12);
    border: 1px solid rgba(74, 222, 128, 0.35);
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* === Landscape modal layout === */
  .reward-screen.landscape {
    /* Keep the bg image full-screen but dim overlay */
    background:
      radial-gradient(1200px 500px at 50% -90px, rgba(252, 230, 173, 0.12), transparent 68%),
      linear-gradient(180deg, #080b13 0%, #0d1422 48%, #05080f 100%);
    /* Centered panel content */
    align-items: center;
    justify-items: center;
    padding: 0;
  }

  .reward-screen.landscape .altar-shell {
    width: min(65vw, 900px);
    max-height: 85vh;
    overflow-y: auto;
  }

  .reward-screen.landscape .actions {
    width: min(65vw, 900px);
  }

  .reward-screen.landscape .altar-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(16px * var(--layout-scale, 1));
  }

  .reward-screen.landscape .altar-option {
    min-height: calc(200px * var(--layout-scale, 1));
    padding: calc(36px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .reward-screen.landscape .mini-card-name {
    font-size: calc(15px * var(--layout-scale, 1));
  }

  .reward-screen.landscape .mini-card-desc {
    font-size: calc(12px * var(--layout-scale, 1));
  }

  .reward-screen.landscape .step-container {
    /* Step containers remain full-screen centered */
    position: fixed;
    inset: 0;
  }

  @media (max-width: 700px) {
    .reward-screen {
      padding: calc(calc(14px * var(--layout-scale, 1)) + var(--safe-top)) calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
      gap: calc(10px * var(--layout-scale, 1));
    }

    .altar-header h1 {
      font-size: calc(24px * var(--layout-scale, 1));
      margin: 0;
    }

    .altar-header p {
      font-size: calc(12px * var(--layout-scale, 1));
      margin: calc(2px * var(--layout-scale, 1)) 0 0;
    }

    .altar-shell {
      padding: calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
      gap: calc(10px * var(--layout-scale, 1));
      border-radius: 14px;
    }

    .altar-surface {
      padding: calc(12px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
      border-radius: 10px;
    }

    .altar-options {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      min-height: auto;
      gap: calc(8px * var(--layout-scale, 1));
    }

    .altar-option {
      min-height: calc(85px * var(--layout-scale, 1));
      padding: calc(22px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
      border-radius: 10px;
      animation-duration: 2.3s;
    }

    .altar-option.selected {
      transform: scale(1.02);
    }

    .mini-card-ap {
      width: calc(16px * var(--layout-scale, 1));
      height: calc(16px * var(--layout-scale, 1));
      font-size: calc(9px * var(--layout-scale, 1));
      top: calc(3px * var(--layout-scale, 1));
      left: calc(3px * var(--layout-scale, 1));
    }

    .mini-card-upgrade {
      width: calc(14px * var(--layout-scale, 1));
      height: calc(14px * var(--layout-scale, 1));
      font-size: calc(10px * var(--layout-scale, 1));
      top: calc(3px * var(--layout-scale, 1));
      right: calc(3px * var(--layout-scale, 1));
    }

    .mini-card-name {
      font-size: calc(10px * var(--layout-scale, 1));
    }

    .mini-card-desc {
      font-size: calc(8px * var(--layout-scale, 1));
      margin-bottom: calc(10px * var(--layout-scale, 1));
    }

    .inspect-panel {
      padding: calc(10px * var(--layout-scale, 1));
      gap: calc(6px * var(--layout-scale, 1));
      border-radius: 10px;
    }

    .inspect-kicker {
      font-size: calc(10px * var(--layout-scale, 1));
      letter-spacing: 0.4px;
    }

    .inspect-panel h2 {
      font-size: calc(18px * var(--layout-scale, 1));
      margin: 0;
    }

    .inspect-mechanic-badge {
      font-size: calc(11px * var(--layout-scale, 1));
      padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    }

    .inspect-summary {
      font-size: calc(13px * var(--layout-scale, 1));
      line-height: 1.3;
      margin: 0;
    }

    .inspect-meta {
      font-size: calc(11px * var(--layout-scale, 1));
      gap: calc(6px * var(--layout-scale, 1));
    }

    .inspect-meta span {
      padding: calc(3px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    }

    .actions {
      gap: calc(6px * var(--layout-scale, 1));
    }

    .accept,
    .skip {
      height: 48px;
      font-size: calc(14px * var(--layout-scale, 1));
      border-radius: 8px;
    }
  }

  /* === V2 card frame layers === */
  .card-v2-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .frame-layer {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    image-rendering: pixelated;
  }

  .frame-card-art {
    position: absolute;
    /* Exact position from PSD layer "PLACE WHERE ARTWORK GOES" bbox(176,186,719,609) on 886x1142 */
    left: 19.9%;
    top: 16.3%;
    width: 61.3%;
    height: 37.0%;
    object-fit: cover;
    image-rendering: auto;
    pointer-events: none;
    border-radius: 4px;
  }

  .upgrade-icon {
    animation: upgradeFloat 1.5s ease-in-out infinite;
  }

  @keyframes upgradeFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

</style>
