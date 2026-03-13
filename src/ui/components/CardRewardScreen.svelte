<script lang="ts">
  import type { Card, CardType } from '../../data/card-types'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { getDetailedCardDescription } from '../../services/cardDescriptionService'
  import { getCardFramePath } from '../utils/domainAssets'
  import { getCardTypeIconPath, getRewardIconPath } from '../utils/iconAssets'
  import { activeRewardBundle, activeRewardRevealStep, holdScreenTransition, releaseScreenTransition } from '../../ui/stores/gameState'
  import { getRandomRoomBg } from '../../data/backgroundManifest'
  import { preloadImages } from '../utils/assetPreloader'
  import { untrack } from 'svelte'
  import { normalizeRewardSelection } from '../utils/rewardSelection'

  interface Props {
    options: Card[]
    onselect: (card: Card) => void
    onskip: () => void
    onrewardstepchange?: (step: 'gold' | 'heal' | 'card') => void
  }

  let { options, onselect, onskip, onrewardstepchange }: Props = $props()

  const bgUrl = getRandomRoomBg('treasure')
  holdScreenTransition()
  preloadImages([bgUrl]).then(releaseScreenTransition)

  let selectedType = $state<CardType | null>(null)
  let collectLocked = $state(false)
  let collectingType = $state<CardType | null>(null)
  let hasPlayedIntroCue = $state(false)
  let showSkipConfirm = $state(false)

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

  interface RewardIcon {
    glyph: string
    label: string
    glow: string
    imageKey: string
  }

  const ALTAR_BIOMES: AltarBiome[] = [
    { id: 'cave-stone', title: 'Cavern Altar', subtitle: 'Cold stone and echoing depth.', ambience: 'Stone altar ambience' },
    { id: 'library-oak', title: 'Archive Table', subtitle: 'Polished oak lined with old runes.', ambience: 'Library oak ambience' },
    { id: 'forest-moss', title: 'Moss Shrine', subtitle: 'Lantern light over wet roots.', ambience: 'Forest shrine ambience' },
    { id: 'temple-marble', title: 'Temple Pedestal', subtitle: 'Marble plate under sacred light.', ambience: 'Temple marble ambience' },
    { id: 'obsidian-vault', title: 'Obsidian Vault', subtitle: 'Dark glass stone under purple flame.', ambience: 'Obsidian vault ambience' },
  ]

  const CARD_TYPE_ICON_POOL: Record<CardType, RewardIcon[]> = {
    attack: [
      { glyph: '🗡', label: 'Rust Dagger', glow: '#ff8a65', imageKey: 'rust_dagger' },
      { glyph: '⚔', label: 'Twin Blades', glow: '#ff7043', imageKey: 'twin_blades' },
      { glyph: '🪓', label: 'War Axe', glow: '#ff6f61', imageKey: 'war_axe' },
      { glyph: '🏹', label: 'Hunter Bow', glow: '#ff9e80', imageKey: 'hunter_bow' },
    ],
    shield: [
      { glyph: '🛡', label: 'Round Shield', glow: '#7ec8ff', imageKey: 'round_shield' },
      { glyph: '🛡', label: 'Tower Shield', glow: '#81d4fa', imageKey: 'tower_shield' },
      { glyph: '🛡', label: 'Buckler', glow: '#90caf9', imageKey: 'buckler' },
      { glyph: '🛡', label: 'Mirror Guard', glow: '#64b5f6', imageKey: 'mirror_guard' },
    ],
    utility: [
      { glyph: '📜', label: 'Arc Scroll', glow: '#ffe082', imageKey: 'arc_scroll' },
      { glyph: '📘', label: 'Field Tome', glow: '#ffd54f', imageKey: 'field_tome' },
      { glyph: '🧭', label: 'Path Compass', glow: '#ffcc80', imageKey: 'path_compass' },
      { glyph: '🧰', label: 'Tool Kit', glow: '#ffca6f', imageKey: 'tool_kit' },
    ],
    buff: [
      { glyph: '🔮', label: 'Focus Crystal', glow: '#c8a6ff', imageKey: 'focus_crystal' },
      { glyph: '✨', label: 'Tempo Charm', glow: '#d1b3ff', imageKey: 'tempo_charm' },
      { glyph: '🧿', label: 'Fortune Eye', glow: '#caa0ff', imageKey: 'fortune_eye' },
      { glyph: '💠', label: 'Surge Sigil', glow: '#b88cff', imageKey: 'surge_sigil' },
    ],
    debuff: [
      { glyph: '☠', label: 'Hex Totem', glow: '#ff9ec5', imageKey: 'hex_totem' },
      { glyph: '🕸', label: 'Snare Thread', glow: '#f8a6d8', imageKey: 'snare_thread' },
      { glyph: '🦂', label: 'Venom Fang', glow: '#ff8ab6', imageKey: 'venom_fang' },
      { glyph: '🪤', label: 'Dread Trap', glow: '#f58bc0', imageKey: 'dread_trap' },
    ],
    wild: [
      { glyph: '💎', label: 'Prism Core', glow: '#ffd480', imageKey: 'prism_core' },
      { glyph: '🌠', label: 'Comet Shard', glow: '#ffd166', imageKey: 'comet_shard' },
      { glyph: '🪙', label: 'Lucky Relic', glow: '#ffcf6e', imageKey: 'lucky_relic' },
      { glyph: '🎲', label: 'Chaos Die', glow: '#ffe08a', imageKey: 'chaos_die' },
    ],
  }

  const TYPE_DESCRIPTIONS: Record<CardType, string> = {
    attack: 'Deal direct damage to enemies.',
    shield: 'Gain block before enemy attacks.',
    buff: 'Increase output and combo pressure.',
    debuff: 'Reduce enemy tempo and threat.',
    utility: 'Tech effects for flexible turns.',
    wild: 'High-impact wildcard effect.',
  }

  let altarBiome = $state<AltarBiome>(ALTAR_BIOMES[0])
  let lastOptionsRef = $state<Card[]>([])

  // Derive reward bundle from store
  let bundle = $derived($activeRewardBundle)
  let rewardStep = $derived($activeRewardRevealStep)

  function setRewardStep(step: 'gold' | 'heal' | 'card'): void {
    activeRewardRevealStep.set(step)
    onrewardstepchange?.(step)
  }

  function emptyIconMap(): Record<CardType, RewardIcon | null> {
    return {
      attack: null,
      shield: null,
      utility: null,
      buff: null,
      debuff: null,
      wild: null,
    }
  }

  let iconByType = $state<Record<CardType, RewardIcon | null>>(emptyIconMap())

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

  function pickIcon(card: Card): RewardIcon {
    const pool = CARD_TYPE_ICON_POOL[card.cardType]
    const idx = hashString(`${card.factId}:${card.cardType}`) % pool.length
    return pool[idx] ?? pool[0]
  }

  function buildIconMap(cards: Card[]): Record<CardType, RewardIcon | null> {
    const map = emptyIconMap()
    cards.forEach((card) => {
      map[card.cardType] = pickIcon(card)
    })
    return map
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

  function iconForOption(option: Card): RewardIcon {
    return iconByType[option.cardType] ?? CARD_TYPE_ICON_POOL[option.cardType][0]
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
    playCardAudio('turn-chime')
    window.setTimeout(() => {
      onselect(selected)
    }, 340)
  }

  function handleSkipClick(): void {
    if (collectLocked) return
    showSkipConfirm = true
  }

  function confirmSkip(): void {
    showSkipConfirm = false
    onskip()
  }

  function cancelSkip(): void {
    showSkipConfirm = false
  }

  function startCeremony(): void {
    altarCeremonyPhase = 1
    setTimeout(() => {
      altarCeremonyPhase = 2
    }, 300)
    setTimeout(() => {
      altarCeremonyPhase = 3
    }, 600)
    setTimeout(() => {
      altarCeremonyPhase = 4
    }, 900)
    setTimeout(() => {
      altarCeremonyPhase = 0
    }, 1200)
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
    }, 200)
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
        }, 100)

        if (!hasPlayedIntroCue) {
          playCardAudio('combo-3')
          hasPlayedIntroCue = true
        }
        collectLocked = false
        collectingType = null
        selectedType = null
        showSkipConfirm = false
        altarBiome = pickBiome(opts)
        iconByType = buildIconMap(opts)
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
      }, 900)
    } else if (step === 'heal' && b) {
      autoAdvanceTimer = setTimeout(() => {
        advanceStep()
      }, 1000)
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
</script>

<div class="reward-screen" class:card-phase={rewardStep === 'card'}>
  <img class="overlay-bg" src={bgUrl} alt="" aria-hidden="true" />
{#if rewardStep === 'gold' && bundle}
    <div class="step-container" class:step-visible={stepVisible}>
      <div class="step-icon-action gold-action" aria-hidden="true">
        <div class="step-icon">🪙</div>
      </div>
      <h1 class="step-title">Gold Earned</h1>
      <div class="step-value gold-value">+{bundle.goldEarned}</div>
      {#if bundle.comboBonus > 0}
        <div class="step-bonus">+{bundle.comboBonus} combo bonus</div>
      {/if}
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
          {#each options as option (option.cardType)}
            {@const icon = iconForOption(option)}
            <button
              class="altar-option"
              class:selected={isSelected(option)}
              class:shadowed={isShadowed(option)}
              class:collecting={isCollecting(option)}
              style={`--frame-image: url('${option.isEcho ? '/assets/sprites/cards/frame_echo.webp' : getCardFramePath(option.cardType)}'); --icon-glow: ${icon.glow};`}
              onclick={() => selectType(option.cardType)}
              onpointerenter={() => hoverType(option.cardType)}
              disabled={collectLocked}
              data-testid={`reward-type-${option.cardType}`}
              aria-label={`Inspect ${option.cardType} reward`}
            >
              <img class="reward-icon-img" src={getRewardIconPath(icon.imageKey)} alt={icon.label}
                onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; ((e.currentTarget as HTMLElement).nextElementSibling as HTMLElement).style.display = 'inline'; }} />
              <span class="reward-icon-fallback" style="display:none">{icon.glyph}</span>
              <span class="icon-label">{icon.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <section class="inspect-panel">
        <div class="inspect-kicker">Inspected Reward</div>
        {#if selectedCard()}
          {@const selected = selectedCard()!}
          {@const selectedIcon = iconForOption(selected)}
          <h2>{selectedIcon.label}</h2>
          {#if selected.mechanicName}
            <span class="inspect-mechanic-badge">{selected.mechanicName}</span>
          {/if}
          <p class="inspect-summary">{getDetailedCardDescription(selected)}</p>
          <div class="inspect-meta">
            <span>{altarBiome.ambience}</span>
          </div>
        {:else}
          <h2>Inspect a reward icon</h2>
          <p class="inspect-summary">Tap an icon on the altar to reveal details.</p>
        {/if}
      </section>
    </section>

    <div class="actions">
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

<style>
  .reward-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    z-index: 220;
    padding: calc(24px + var(--safe-top)) 16px 18px;
    color: #f4f5f7;
    background:
      radial-gradient(1200px 500px at 50% -90px, rgba(252, 230, 173, 0.12), transparent 68%),
      linear-gradient(180deg, #080b13 0%, #0d1422 48%, #05080f 100%);
    display: grid;
    gap: 14px;
    justify-items: center;
    align-content: center;
  }

  .reward-screen.card-phase {
    align-content: center;
    padding-top: calc(12px + var(--safe-top));
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
    gap: 16px;
    padding-top: min(8vh, 56px);
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
    font-size: 86px;
    line-height: 1;
    text-shadow:
      -3px 0 #000,
      3px 0 #000,
      0 -3px #000,
      0 3px #000,
      -3px -3px #000,
      3px 3px #000,
      3px -3px #000,
      -3px 3px #000,
      0 0 20px rgba(255, 200, 50, 0.45);
    animation: rewardBob 2200ms ease-in-out infinite;
  }

  .step-icon-action {
    width: 164px;
    height: 164px;
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
    width: 92px;
    height: 92px;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    filter: drop-shadow(0 0 14px rgba(74, 222, 128, 0.38));
    animation: rewardBob 2200ms ease-in-out infinite;
  }

  .step-icon-fallback {
    font-size: 72px;
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
    font-size: 22px;
    font-weight: 900;
    color: #f8d779;
    text-shadow:
      -3px 0 #000, 3px 0 #000, 0 -3px #000, 0 3px #000,
      -3px -3px #000, 3px 3px #000, 3px -3px #000, -3px 3px #000,
      0 4px 12px rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  .step-value {
    font-family: var(--font-pixel);
    font-size: 36px;
    font-weight: 900;
    margin: 8px 0;
    text-shadow:
      -3px 0 #000, 3px 0 #000, 0 -3px #000, 0 3px #000,
      -3px -3px #000, 3px 3px #000, 3px -3px #000, -3px 3px #000;
  }

  .gold-value {
    color: #ffd700;
    text-shadow:
      -3px 0 #000, 3px 0 #000, 0 -3px #000, 0 3px #000,
      -3px -3px #000, 3px 3px #000, 3px -3px #000, -3px 3px #000,
      0 0 20px rgba(255, 215, 0, 0.5);
  }

  .heal-value {
    color: #4ade80;
    text-shadow:
      -3px 0 #000, 3px 0 #000, 0 -3px #000, 0 3px #000,
      -3px -3px #000, 3px 3px #000, 3px -3px #000, -3px 3px #000,
      0 0 20px rgba(74, 222, 128, 0.5);
  }

  .step-bonus {
    font-size: 21px;
    color: #fbbf24;
    font-weight: 700;
    text-shadow:
      -1px 0 #000,
      1px 0 #000,
      0 -1px #000,
      0 1px #000;
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
    top: -160px;
    left: 50%;
    width: min(780px, 92vw);
    height: 620px;
    transform: translateX(-50%);
    pointer-events: none;
    background: radial-gradient(ellipse at top, rgba(255, 244, 208, 0.28) 0%, rgba(255, 222, 143, 0.1) 36%, rgba(0, 0, 0, 0) 74%);
    filter: blur(1px);
  }

  .altar-shell {
    position: relative;
    width: min(920px, 100%);
    border-radius: 18px;
    padding: 16px 16px 14px;
    border: 1px solid rgba(255, 244, 214, 0.24);
    background: linear-gradient(180deg, rgba(20, 27, 37, 0.9), rgba(11, 17, 26, 0.94));
    box-shadow: 0 26px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    display: grid;
    gap: 12px;
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
    font-size: 30px;
    font-weight: 900;
    letter-spacing: 0.6px;
    color: #f8d779;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  }

  .altar-header p {
    margin: 4px 0 0;
    color: #c8d0dc;
    font-size: 14px;
  }

  .altar-surface {
    position: relative;
    border-radius: 14px;
    padding: 18px 14px 12px;
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
    min-height: 168px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    align-items: end;
  }

  .altar-option {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    min-height: 146px;
    padding: 10px 10px 8px;
    color: #fff;
    background:
      linear-gradient(rgba(17, 24, 34, 0.82), rgba(12, 19, 28, 0.92)),
      var(--frame-image) center / cover no-repeat,
      rgba(28, 37, 53, 0.9);
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 2px;
    transition: transform 140ms ease, opacity 140ms ease, filter 140ms ease, box-shadow 140ms ease;
    animation: iconBob 2.6s ease-in-out infinite;
    cursor: pointer;
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
    box-shadow: 0 0 0 2px #f6d57d, 0 18px 28px rgba(0, 0, 0, 0.4), 0 0 28px color-mix(in srgb, var(--icon-glow) 44%, transparent);
  }

  .altar-option.shadowed {
    opacity: 0.28;
    filter: grayscale(0.45) brightness(0.66);
  }

  .altar-option.collecting {
    animation: collectFly 340ms ease-in forwards;
    z-index: 2;
  }

  .reward-icon-img {
    width: 2.5em;
    height: 2.5em;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    filter: drop-shadow(0 0 9px color-mix(in srgb, var(--icon-glow) 52%, transparent));
  }

  .reward-icon-fallback {
    font-size: 2em;
    filter: drop-shadow(0 0 9px color-mix(in srgb, var(--icon-glow) 52%, transparent));
  }

  .icon-label {
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.25px;
  }

  .altar-trinkets {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 8px;
    opacity: 0.82;
  }

  .trinket {
    font-size: 19px;
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
    padding: 12px;
    display: grid;
    gap: 8px;
  }

  .inspect-kicker {
    color: #9fb2c8;
    font-size: 11px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    font-weight: 700;
  }

  .inspect-panel h2 {
    margin: 0;
    font-size: 21px;
    color: #ffde8f;
  }

  .inspect-mechanic-badge {
    display: inline-block;
    background: rgba(40, 80, 120, 0.5);
    border: 1px solid rgba(100, 160, 220, 0.4);
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 12px;
    color: #9ec8ff;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .inspect-summary {
    margin: 0;
    color: #c8d2df;
    font-size: 14px;
  }

  .inspect-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #9ec8ff;
    font-weight: 700;
  }

  .inspect-meta span {
    background: rgba(40, 58, 80, 0.5);
    border: 1px solid rgba(135, 171, 206, 0.32);
    border-radius: 999px;
    padding: 4px 8px;
  }

  .actions {
    width: min(920px, 100%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-self: end;
  }

  .accept,
  .skip {
    height: 52px;
    border-radius: 10px;
    border: none;
    font-size: 15px;
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
    padding: 20px 24px;
    max-width: 280px;
    text-align: center;
  }

  .skip-confirm-box p {
    color: #f8fafc;
    font-size: 15px;
    margin: 0 0 16px;
    line-height: 1.4;
  }

  .skip-confirm-buttons {
    display: flex;
    gap: 10px;
  }

  .skip-confirm-btn {
    flex: 1;
    height: 44px;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    font-size: 14px;
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
    box-shadow: 0 0 0 2px #f6d57d, 0 18px 28px rgba(0, 0, 0, 0.4), 0 0 40px color-mix(in srgb, var(--icon-glow) 60%, transparent);
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

  @media (max-width: 700px) {
    .reward-screen {
      padding: calc(14px + var(--safe-top)) 12px 12px;
      gap: 10px;
    }

    .altar-header h1 {
      font-size: 24px;
      margin: 0;
    }

    .altar-header p {
      font-size: 12px;
      margin: 2px 0 0;
    }

    .altar-shell {
      padding: 12px 12px 10px;
      gap: 10px;
      border-radius: 14px;
    }

    .altar-surface {
      padding: 12px 10px 8px;
      border-radius: 10px;
    }

    .altar-options {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      min-height: auto;
      gap: 8px;
    }

    .altar-option {
      min-height: 85px;
      padding: 6px 4px 4px;
      border-radius: 10px;
      animation-duration: 2.3s;
    }

    .altar-option.selected {
      transform: scale(1.02);
    }

    .reward-icon-img {
      width: 2em;
      height: 2em;
    }

    .reward-icon-fallback {
      font-size: 1.6em;
    }

    .icon-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .inspect-panel {
      padding: 10px;
      gap: 6px;
      border-radius: 10px;
    }

    .inspect-kicker {
      font-size: 10px;
      letter-spacing: 0.4px;
    }

    .inspect-panel h2 {
      font-size: 18px;
      margin: 0;
    }

    .inspect-mechanic-badge {
      font-size: 11px;
      padding: 2px 6px;
    }

    .inspect-summary {
      font-size: 13px;
      line-height: 1.3;
      margin: 0;
    }

    .inspect-meta {
      font-size: 11px;
      gap: 6px;
    }

    .inspect-meta span {
      padding: 3px 6px;
    }

    .actions {
      gap: 6px;
    }

    .accept,
    .skip {
      height: 48px;
      font-size: 14px;
      border-radius: 8px;
    }
  }

</style>
