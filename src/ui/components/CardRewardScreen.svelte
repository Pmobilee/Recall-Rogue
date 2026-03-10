<script lang="ts">
  import type { Card, CardType } from '../../data/card-types'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { getCardFramePath } from '../utils/domainAssets'

  interface Props {
    options: Card[]
    onselect: (card: Card) => void
    onskip: () => void
  }

  let { options, onselect, onskip }: Props = $props()
  let selectedType = $state<CardType | null>(null)
  let collectLocked = $state(false)
  let collectingType = $state<CardType | null>(null)
  let hasPlayedIntroCue = $state(false)

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
      { glyph: '🗡', label: 'Rust Dagger', glow: '#ff8a65' },
      { glyph: '⚔', label: 'Twin Blades', glow: '#ff7043' },
      { glyph: '🪓', label: 'War Axe', glow: '#ff6f61' },
      { glyph: '🏹', label: 'Hunter Bow', glow: '#ff9e80' },
    ],
    shield: [
      { glyph: '🛡', label: 'Round Shield', glow: '#7ec8ff' },
      { glyph: '🛡', label: 'Tower Shield', glow: '#81d4fa' },
      { glyph: '🛡', label: 'Buckler', glow: '#90caf9' },
      { glyph: '🛡', label: 'Mirror Guard', glow: '#64b5f6' },
    ],
    heal: [
      { glyph: '🧪', label: 'Healing Flask', glow: '#8ef0a8' },
      { glyph: '🌿', label: 'Herb Bundle', glow: '#7bffb2' },
      { glyph: '🩹', label: 'Bandage Roll', glow: '#9effc7' },
      { glyph: '🍵', label: 'Restorative Tea', glow: '#88ffb5' },
    ],
    utility: [
      { glyph: '📜', label: 'Arc Scroll', glow: '#ffe082' },
      { glyph: '📘', label: 'Field Tome', glow: '#ffd54f' },
      { glyph: '🧭', label: 'Path Compass', glow: '#ffcc80' },
      { glyph: '🧰', label: 'Tool Kit', glow: '#ffca6f' },
    ],
    buff: [
      { glyph: '🔮', label: 'Focus Crystal', glow: '#c8a6ff' },
      { glyph: '✨', label: 'Tempo Charm', glow: '#d1b3ff' },
      { glyph: '🧿', label: 'Fortune Eye', glow: '#caa0ff' },
      { glyph: '💠', label: 'Surge Sigil', glow: '#b88cff' },
    ],
    debuff: [
      { glyph: '☠', label: 'Hex Totem', glow: '#ff9ec5' },
      { glyph: '🕸', label: 'Snare Thread', glow: '#f8a6d8' },
      { glyph: '🦂', label: 'Venom Fang', glow: '#ff8ab6' },
      { glyph: '🪤', label: 'Dread Trap', glow: '#f58bc0' },
    ],
    regen: [
      { glyph: '💧', label: 'Vital Drop', glow: '#6cf5e8' },
      { glyph: '🫧', label: 'Renewal Bubble', glow: '#7dece5' },
      { glyph: '🍃', label: 'Pulse Leaf', glow: '#80edba' },
      { glyph: '🔄', label: 'Cycle Rune', glow: '#7fded5' },
    ],
    wild: [
      { glyph: '💎', label: 'Prism Core', glow: '#ffd480' },
      { glyph: '🌠', label: 'Comet Shard', glow: '#ffd166' },
      { glyph: '🪙', label: 'Lucky Relic', glow: '#ffcf6e' },
      { glyph: '🎲', label: 'Chaos Die', glow: '#ffe08a' },
    ],
  }

  const DECOR_TRINKETS: RewardIcon[] = [
    { glyph: '🪙', label: 'Gold pile', glow: '#f8d56d' },
    { glyph: '🧴', label: 'Potion flask', glow: '#8fe9ff' },
    { glyph: '🏺', label: 'Ornate relic', glow: '#f8c4ff' },
  ]

  const TYPE_DESCRIPTIONS: Record<CardType, string> = {
    attack: 'Deal direct damage to enemies.',
    shield: 'Gain block before enemy attacks.',
    heal: 'Recover HP and stabilize your run.',
    buff: 'Increase output and combo pressure.',
    debuff: 'Reduce enemy tempo and threat.',
    utility: 'Tech effects for flexible turns.',
    regen: 'Scale sustain over time.',
    wild: 'High-impact wildcard effect.',
  }

  let altarBiome = $state<AltarBiome>(ALTAR_BIOMES[0])

  function emptyIconMap(): Record<CardType, RewardIcon | null> {
    return {
      attack: null,
      shield: null,
      heal: null,
      utility: null,
      buff: null,
      debuff: null,
      regen: null,
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

  function powerValue(option: Card): number {
    return Math.round(option.baseEffectValue * option.effectMultiplier)
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

  function skip(): void {
    if (collectLocked) return
    onskip()
  }

  $effect(() => {
    if (options.length === 0) {
      selectedType = null
      return
    }
    if (selectedType === null || !options.some((option) => option.cardType === selectedType)) {
      selectedType = options[0]?.cardType ?? null
    }
    if (!hasPlayedIntroCue) {
      playCardAudio('combo-3')
      hasPlayedIntroCue = true
    }
    collectLocked = false
    collectingType = null
    altarBiome = pickBiome(options)
    iconByType = buildIconMap(options)
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

<div class="reward-screen">
  <div class="spotlight-cone" aria-hidden="true"></div>

  <section class={`altar-shell biome-${altarBiome.id}`}>
    <header class="altar-header">
      <h1>Reward Altar</h1>
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
            style={`--frame-image: url('${option.isEcho ? '/assets/sprites/cards/frame_echo.png' : getCardFramePath(option.cardType)}'); --icon-glow: ${icon.glow};`}
            onclick={() => selectType(option.cardType)}
            onpointerenter={() => hoverType(option.cardType)}
            disabled={collectLocked}
            data-testid={`reward-type-${option.cardType}`}
            aria-label={`Inspect ${option.cardType} reward`}
          >
            <span class="icon-glyph">{icon.glyph}</span>
            <span class="icon-label">{icon.label}</span>
            <span class="icon-type">{option.cardType.toUpperCase()}</span>
            <span class="icon-power">Power {powerValue(option)}</span>
          </button>
        {/each}
      </div>

      <div class="altar-trinkets" aria-hidden="true">
        {#each DECOR_TRINKETS as trinket}
          <span class="trinket" style={`--trinket-glow: ${trinket.glow};`} title={trinket.label}>{trinket.glyph}</span>
        {/each}
      </div>
    </div>

    <section class="inspect-panel">
      <div class="inspect-kicker">Inspected Reward</div>
      {#if selectedCard()}
        {@const selected = selectedCard()!}
        {@const selectedIcon = iconForOption(selected)}
        <h2>{selectedIcon.label} • {selected.cardType.toUpperCase()}</h2>
        <p class="inspect-summary">{TYPE_DESCRIPTIONS[selected.cardType]}</p>
        <div class="inspect-meta">
          <span>Power {powerValue(selected)}</span>
          <span>{altarBiome.ambience}</span>
        </div>
      {:else}
        <h2>Inspect a reward icon</h2>
        <p class="inspect-summary">Tap an icon on the altar to reveal details.</p>
      {/if}

    </section>
  </section>

  <div class="actions">
    <button class="accept" onclick={accept} disabled={!selectedCard() || collectLocked} data-testid="reward-accept">
      {collectLocked ? 'Collecting...' : 'Accept'}
    </button>
    <button class="skip" onclick={skip} disabled={collectLocked}>Skip</button>
  </div>
</div>

<style>
  .reward-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    z-index: 220;
    padding: 24px 16px 18px;
    color: #f4f5f7;
    background:
      radial-gradient(1200px 500px at 50% -90px, rgba(252, 230, 173, 0.12), transparent 68%),
      linear-gradient(180deg, #080b13 0%, #0d1422 48%, #05080f 100%);
    display: grid;
    gap: 14px;
    justify-items: center;
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

  .icon-glyph {
    font-size: 34px;
    filter: drop-shadow(0 0 9px color-mix(in srgb, var(--icon-glow) 52%, transparent));
  }

  .icon-label {
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.25px;
  }

  .icon-type {
    margin-top: 2px;
    color: #b7c8de;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.45px;
  }

  .icon-power {
    margin-top: 4px;
    font-size: 12px;
    color: #88d8ff;
    font-weight: 700;
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

  @media (max-width: 700px) {
    .reward-screen {
      padding-top: 14px;
    }

    .altar-header h1 {
      font-size: 25px;
    }

    .altar-options {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .altar-option {
      min-height: 120px;
      animation-duration: 2.3s;
    }

    .altar-option.selected {
      transform: scale(1.015);
    }
  }

  @media (max-width: 560px) {
    .actions {
      grid-template-columns: 1fr;
    }
  }
</style>
