<script lang="ts">
  import { getRelicIconPath, getGoldCoinIconPath } from '../utils/iconAssets'
  import { openRunDeckOverlay } from '../stores/runDeckOverlayStore'
  import { activeTurnState } from '../../services/encounterBridge'

  // ============================================================
  // Segment name lookup
  // ============================================================
  const SEGMENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
    1: 'Shallow Depths',
    2: 'Deep Caverns',
    3: 'The Abyss',
    4: 'The Archive',
  }

  // ============================================================
  // Status Effects (player — displayed inline after HP bar)
  // ============================================================
  interface StatusEffect {
    type: string
    value: number
    turnsRemaining: number
  }

  interface RelicEntry {
    definitionId: string
    name: string
    description: string
    icon: string
    rarity?: string
  }

  interface Props {
    playerHp: number
    playerMaxHp: number
    playerBlock?: number
    currency: number
    currentFloor: number
    segment: 1 | 2 | 3 | 4
    currentEncounter: number
    encountersPerFloor: number
    relics: RelicEntry[]
    triggeredRelicId?: string | null
    maxRelicSlots?: number
    ascensionLevel?: number
    fogLevel?: number
    fogState?: 'brain_fog' | 'neutral' | 'flow_state'
    statusEffects?: StatusEffect[]
    onpause: () => void
  }

  let {
    playerHp,
    playerMaxHp,
    playerBlock = 0,
    currency,
    currentFloor,
    segment,
    currentEncounter,
    encountersPerFloor,
    relics,
    triggeredRelicId = null,
    maxRelicSlots = 5,
    ascensionLevel = 0,
    fogLevel = 0,
    fogState = undefined,
    statusEffects = [],
    onpause,
  }: Props = $props()

  // ============================================================
  // HP bar color derived from percentage (blue when block is active)
  // ============================================================
  const hpPercent = $derived(
    playerMaxHp > 0 ? Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100)) : 0,
  )

  const hpBarColor = $derived(
    playerBlock > 0
      ? '#38bdf8'
      : hpPercent > 60
        ? '#22c55e'
        : hpPercent > 30
          ? '#eab308'
          : hpPercent > 15
            ? '#f97316'
            : '#ef4444',
  )

  const segmentName = $derived(SEGMENT_NAMES[segment] ?? 'Unknown')

  // ============================================================
  // Tooltip state — one open at a time, identified by relic index
  // ============================================================
  let openTooltipIndex: number | null = $state(null)
  let fogTooltipOpen = $state(false)
  let goldTooltipOpen = $state(false)

  function toggleTooltip(index: number) {
    openTooltipIndex = openTooltipIndex === index ? null : index
  }

  function closeAllTooltips() {
    openTooltipIndex = null
  }

  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.relic-btn') && !target.closest('.relic-tooltip')) {
      closeAllTooltips()
    }
  }

  $effect(() => {
    if (openTooltipIndex !== null) {
      document.addEventListener('click', handleOutsideClick, true)
      return () => {
        document.removeEventListener('click', handleOutsideClick, true)
      }
    }
  })

  const emptySlotCount = $derived(Math.max(0, maxRelicSlots - relics.length))

  // ============================================================
  // Status effect icons — popup state and lookup table
  // ============================================================
  let activeStatusType = $state<string | null>(null)

  // High-res icon availability (sprites-hires): poison, weakness, vulnerable, strength, regen, immunity
  // Low-res fallback for: burn, bleed (not yet in sprites-hires)
  const STATUS_EFFECT_INFO: Record<string, { name: string; icon: string; spriteIcon?: string; color: string; desc: (v: number, t: number) => string }> = {
    poison:        { name: 'Doubt',         icon: '☠️', spriteIcon: '/assets/sprites-hires/icons/icon_status_poison.png',     color: '#22c55e', desc: (v, t) => `${v} doubt damage/turn (${t} left)` },
    weakness:      { name: 'Drawing Blanks', icon: '⬇',  spriteIcon: '/assets/sprites-hires/icons/icon_status_weakness.png',   color: '#a78bfa', desc: (_, t) => `Attacks deal 25% less damage (${t} left)` },
    vulnerable:    { name: 'Exposed',        icon: '🎯', spriteIcon: '/assets/sprites-hires/icons/icon_status_vulnerable.png', color: '#f87171', desc: (_, t) => `Takes 50% more damage (${t} left)` },
    strength:      { name: 'Clarity',        icon: '💪', spriteIcon: '/assets/sprites-hires/icons/icon_status_strength.png',   color: '#fbbf24', desc: (v) => `Attacks deal +25% per stack (${v} stacks)` },
    regen:         { name: 'Recall',         icon: '💚', spriteIcon: '/assets/sprites-hires/icons/icon_status_regen.png',      color: '#4ade80', desc: (v, t) => `Heals ${v} HP/turn (${t} left)` },
    immunity:      { name: 'Shielded Mind',  icon: '✨', spriteIcon: '/assets/sprites-hires/icons/icon_status_immunity.png',   color: '#60a5fa', desc: () => `Absorbs next doubt instance` },
    thorns:        { name: 'Thorns',        icon: '🌿', color: '#86efac', desc: (v) => `Deals ${v} damage back when hit` },
    empower:       { name: 'Empower',       icon: '⚡', color: '#fcd34d', desc: (v) => `Next card gets +${v}% effect` },
    double_strike: { name: 'Double Strike', icon: '⚔️', color: '#fb923c', desc: (v) => `Next attack hits twice at ${v}%` },
    focus:         { name: 'Focus',         icon: '🔮', color: '#c084fc', desc: (v) => `Next ${v} card${v !== 1 ? 's' : ''} cost 1 less AP` },
    foresight:     { name: 'Foresight',     icon: '👁️', color: '#67e8f9', desc: (_, t) => `See enemy intents (${t} left)` },
    fortify:       { name: 'Fortify',       icon: '🏰', color: '#94a3b8', desc: (v) => `${v} block persists next turn` },
    overclock:     { name: 'Overclock',     icon: '⚙️', color: '#e879f9', desc: () => `Next card doubled, draw -1` },
    slow:          { name: 'Slow',          icon: '🐌', color: '#a1a1aa', desc: (_, t) => `Skips defend/buff (${t} left)` },
    burn:          { name: 'Brain Burn',     icon: '🔥', spriteIcon: '/assets/sprites/icons/icon_status_burn.png',       color: '#f97316', desc: (v) => `Brain Burn [${v}]: +${v} next hit, then halves` },
    bleed:         { name: 'Lingering Doubt', icon: '🩸', spriteIcon: '/assets/sprites/icons/icon_status_bleed.png',     color: '#ef4444', desc: (v) => `Lingering Doubt [${v}]: +${v} incoming damage/turn` },
    freeze:        { name: 'Freeze',        icon: '❄️', color: '#38bdf8', desc: (_, t) => `Frozen — skips action (${t} left)` },
    brain_fog:     { name: 'Brain Fog',     icon: '🌫️', color: '#818cf8', desc: (v) => `Enemies deal +20% damage. Fog: ${v}/10` },
    flow_state:    { name: 'Flow State',    icon: '✨', color: '#fbbf24', desc: (v) => `Draw +1 card/turn. Fog: ${v}/10` },
    locked:        { name: 'Locked Card',   icon: '🔒', color: '#f87171', desc: () => `A card is locked — must Charge to unlock` },
    accuracy_s:    { name: 'S Grade',       icon: '⭐', color: '#fbbf24', desc: () => `Perfect accuracy — bonus rewards incoming` },
  }

  function getStatusInfo(type: string) {
    return STATUS_EFFECT_INFO[type] ?? { name: type, icon: '❓', color: '#94a3b8', desc: (v: number, t: number) => `${type}: ${v} (${t} turns)` }
  }

  /** Only show effects that are still active */
  const activeStatusEffects = $derived(statusEffects.filter(e => e.turnsRemaining > 0))

  // ============================================================
  // Deck stack icon — card count for stacked-rect visual
  // ============================================================
  const deckTotalCards = $derived((): number => {
    const ts = $activeTurnState
    if (!ts) return 0
    return (
      ts.deck.hand.length +
      ts.deck.drawPile.length +
      ts.deck.discardPile.length +
      ts.deck.forgetPile.length
    )
  })

  /** Number of stacked rect layers to show: 1 for tiny decks, up to 5 for large ones. */
  const deckStackCount = $derived(Math.max(1, Math.min(5, Math.ceil(deckTotalCards() / 8))))
</script>

<div class="topbar" role="banner" aria-label="Run status">
  <!-- ============================================================
       LEFT — Player Vitals
       ============================================================ -->
  <div class="section section-left">
    <div class="hp-group" aria-label="{playerBlock > 0 ? `Block: ${playerBlock}, ` : ''}HP: {playerHp} of {playerMaxHp}">
      <div
        class="hp-bar-track"
        class:hp-bar-blocked={playerBlock > 0}
      >
        <div
          class="hp-bar-fill"
          style="width: {hpPercent}%; background: {hpBarColor};"
          role="progressbar"
          aria-valuenow={playerHp}
          aria-valuemin={0}
          aria-valuemax={playerMaxHp}
        ></div>
        <span class="hp-text">
          {#if playerBlock > 0}
            <span class="shield-badge" aria-label="Block: {playerBlock}">🛡️{playerBlock}</span>
          {/if}
          <span class="hp-value">{playerHp}/{playerMaxHp}</span>
        </span>
      </div>
    </div>

    <!-- Status effect icons — inline to the right of HP bar, growing rightward -->
    {#if activeStatusEffects.length > 0}
      <div class="topbar-status-icons" role="list" aria-label="Player status effects">
        {#each activeStatusEffects as effect (effect.type)}
          {@const info = getStatusInfo(effect.type)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="topbar-status-icon-wrapper"
            role="listitem"
            onmouseenter={() => { activeStatusType = effect.type }}
            onmouseleave={() => { activeStatusType = null }}
          >
            <button
              class="topbar-status-icon"
              type="button"
              aria-label="{info.name}: {effect.value} stacks, {effect.turnsRemaining} turns"
            >
              {#if info.spriteIcon}
                <img src={info.spriteIcon} alt={info.name} class="topbar-status-sprite" />
              {:else}
                <span class="topbar-status-emoji">{info.icon}</span>
              {/if}
              {#if effect.value >= 1}
                <span class="topbar-status-stack" style="background: {info.color};">{effect.value}</span>
              {/if}
            </button>
            {#if activeStatusType === effect.type}
              <div class="topbar-status-popup">
                <div class="topbar-status-popup-row">
                  {#if info.spriteIcon}
                    <img src={info.spriteIcon} alt={info.name} class="topbar-status-popup-sprite" />
                  {:else}
                    <span class="topbar-status-popup-icon" style="color: {info.color};">{info.icon}</span>
                  {/if}
                  <div class="topbar-status-popup-text">
                    <span class="topbar-status-popup-name" style="color: {info.color};">{info.name}</span>
                    <span class="topbar-status-popup-desc">{info.desc(effect.value, effect.turnsRemaining)}</span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ============================================================
       CENTER — Run Progress
       ============================================================ -->
  <div class="section section-center" aria-label="Run progress">
    {#if ascensionLevel > 0}
      <span class="ascension-badge" aria-label="Ascension {ascensionLevel}">
        A{ascensionLevel}
      </span>
    {/if}
  </div>

  <!-- ============================================================
       RIGHT — Resources & Controls
       ============================================================ -->
  <div class="section section-right">
    <!-- Floor info -->
    <span class="segment-name">{segmentName}</span>
    <span class="progress-divider">·</span>
    <span class="floor-label">Floor {currentFloor}</span>

    <!-- Gold -->
    <div class="gold-counter" role="button" tabindex="0" aria-label="Gold: {currency}"
      onmouseenter={() => { goldTooltipOpen = true }}
      onmouseleave={() => { goldTooltipOpen = false }}
      onclick={() => { goldTooltipOpen = !goldTooltipOpen }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') goldTooltipOpen = !goldTooltipOpen }}
    >
      <img class="gold-icon-img" src={getGoldCoinIconPath()} alt="" aria-hidden="true" />
      <span class="gold-value">{currency}</span>
      {#if goldTooltipOpen}
        <div class="gold-tooltip">
          <div class="gold-tooltip-desc">Gold — spend at shops to buy cards and relics</div>
        </div>
      {/if}
    </div>

    <!-- Relics row -->
    <div class="relics-row" role="list" aria-label="Equipped relics">
      {#each relics as relic, i (relic.definitionId)}
        <button
          class="relic-btn"
          class:triggered={triggeredRelicId === relic.definitionId}
          aria-label={relic.name}
          onclick={() => toggleTooltip(i)}
          type="button"
        >
          <img
            class="relic-icon"
            src={getRelicIconPath(relic.definitionId)}
            alt={relic.name}
            onerror={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              const fallback = img.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'flex'
            }}
          />
          <span class="relic-emoji-fallback" aria-hidden="true">{relic.icon}</span>
        </button>

        {#if openTooltipIndex === i}
          <div class="relic-tooltip" role="tooltip">
            <div class="tooltip-arrow"></div>
            <div class="tooltip-name">{relic.name}</div>
            <div class="tooltip-desc">{relic.description}</div>
          </div>
        {/if}
      {/each}

      <!-- Empty slots -->
      {#each { length: emptySlotCount } as _, i (i)}
        <div
          class="relic-btn relic-empty"
          role="listitem"
          aria-label="Empty relic slot"
        ></div>
      {/each}
    </div>

    <!-- Deck viewer button — opens RunDeckOverlay to show all cards in the run -->
    <button
      class="deck-btn"
      aria-label="View current deck ({deckTotalCards()} cards)"
      onclick={openRunDeckOverlay}
      type="button"
    >
      <div class="deck-stack-icon" aria-hidden="true">
        <div class="deck-stack-cards">
          {#each Array(deckStackCount) as _, idx}
            <div
              class="deck-stack-card"
              style="transform: translate(calc({idx * 2}px * var(--layout-scale, 1)), calc({-idx * 2}px * var(--layout-scale, 1)));"
            ></div>
          {/each}
        </div>
        {#if deckTotalCards() > 0}
          <span class="deck-stack-count">{deckTotalCards()}</span>
        {/if}
      </div>
    </button>

    <!-- Pause button -->
    <button
      class="pause-btn"
      aria-label="Pause"
      onclick={onpause}
      type="button"
    >
      <svg class="pause-gear-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</div>

<!-- Brain Fog Wing — glass meter below top bar -->
{#if fogState !== undefined}
  {@const fl = fogLevel ?? 0}
  {@const displayFl = fl - 5}
  <div class="fog-wing-wrapper" role="button" tabindex="0" aria-label="Focus meter" class:fog-wing-danger={fogState === 'brain_fog'} class:fog-wing-flow={fogState === 'flow_state'}
    onclick={() => { fogTooltipOpen = !fogTooltipOpen }}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fogTooltipOpen = !fogTooltipOpen }}
    onmouseenter={() => { fogTooltipOpen = true }}
    onmouseleave={() => { fogTooltipOpen = false }}
  >
    <div class="fog-wing" aria-label="{fogState === 'brain_fog' ? 'Brain Fog' : fogState === 'flow_state' ? 'Flow State' : 'Neutral'} level {Math.abs(displayFl)}">
      {#if displayFl < 0}
        <div class="fog-fill-good" style="width: {Math.abs(displayFl) / 5 * 50}%; right: 50%;"></div>
      {:else if displayFl > 0}
        <div class="fog-fill-bad" style="width: {displayFl / 5 * 50}%; left: 50%;"></div>
      {/if}
      <div class="fog-center-mark"></div>
      <div class="fog-mist" style="opacity: {Math.abs(displayFl) / 5 * 0.5};"></div>
      <div class="fog-glass-highlight"></div>
    </div>
    {#if fogTooltipOpen}
      <div class="fog-tooltip">
        <div class="fog-tooltip-title">
          {#if fogState === 'brain_fog'}
            Brain Fog
          {:else if fogState === 'flow_state'}
            Flow State
          {:else}
            Mental Clarity
          {/if}
        </div>
        <div class="fog-tooltip-desc">
          {#if fogState === 'brain_fog'}
            Your mind is clouded. Enemies deal <strong>+20% damage</strong>. Answer questions correctly to clear the fog.
          {:else if fogState === 'flow_state'}
            Crystal clear focus! Draw <strong>+1 card</strong> per turn. Keep answering correctly to maintain flow.
          {:else}
            Steady focus. Wrong answers build fog, correct answers clear it. Stay sharp to reach Flow State.
          {/if}
        </div>
        <div class="fog-tooltip-meter">
          <span class="fog-tooltip-label">-5</span>
          <div class="fog-tooltip-bar">
            {#if displayFl < 0}
              <div class="fog-tooltip-bar-good" style="width: {Math.abs(displayFl) / 5 * 50}%; right: 50%;"></div>
            {:else if displayFl > 0}
              <div class="fog-tooltip-bar-bad" style="width: {displayFl / 5 * 50}%; left: 50%;"></div>
            {/if}
            <div class="fog-tooltip-center"></div>
          </div>
          <span class="fog-tooltip-value">+5</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ============================================================
     Top Bar Container
     ============================================================ */
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--topbar-height, 4.5vh);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(10, 15, 25, 0.92);
    backdrop-filter: blur(8px);
    border-bottom: calc(2px * var(--layout-scale, 1)) solid rgba(194, 157, 72, 0.6);
    padding: 0 calc(12px * var(--layout-scale, 1));
    pointer-events: auto;
    box-sizing: border-box;
    user-select: none;
    overflow: visible;
  }

  /* ============================================================
     Sections
     ============================================================ */
  .section {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .section-left {
    flex: 1;
    min-width: 0;
    max-width: 33%;
    overflow: visible;
  }

  .section-center {
    flex: 0 1 auto;
    justify-content: center;
    gap: calc(6px * var(--layout-scale, 1));
    margin-left: calc(12px * var(--layout-scale, 1));
  }

  .section-right {
    flex: 1;
    min-width: 0;
    max-width: 40%;
    justify-content: flex-end;
  }

  /* ============================================================
     HP Bar
     ============================================================ */
  .hp-group {
    display: flex;
    align-items: center;
    flex: 1 0 auto;
    min-width: 0;
  }

  .hp-bar-track {
    position: relative;
    flex: 1;
    min-width: 0;
    height: calc(var(--topbar-height, 4.5vh) * 0.58);
    background: rgba(255, 255, 255, 0.08);
    border-radius: calc(3px * var(--layout-scale, 1));
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    transition: box-shadow 300ms ease;
  }

  .hp-bar-track.hp-bar-blocked {
    box-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(56, 189, 248, 0.5);
    border-color: rgba(56, 189, 248, 0.35);
  }

  .hp-bar-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: inherit;
    transition: width 250ms ease, background 400ms ease;
  }

  .hp-text {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(4px * var(--layout-scale, 1));
    font-family: var(--font-pixel, var(--font-rpg));
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    line-height: 1;
    letter-spacing: 0.03em;
    pointer-events: none;
  }

  .hp-value {
    font-size: calc(12px * var(--text-scale, 1));
  }

  .shield-badge {
    display: inline-flex;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    background: rgba(56, 189, 248, 0.25);
    border: 1px solid rgba(56, 189, 248, 0.5);
    border-radius: 999px;
    font-size: calc(9px * var(--text-scale, 1));
    font-family: var(--font-pixel, var(--font-rpg));
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    letter-spacing: 0.03em;
    line-height: 1;
  }

  /* ============================================================
     Status Effect Icons — inline in top bar
     ============================================================ */
  .topbar-status-icons {
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .topbar-status-icon-wrapper {
    position: relative;
  }

  .topbar-status-icon {
    position: relative;
    width: calc(var(--topbar-height, 4.5vh) * 0.58);
    height: calc(var(--topbar-height, 4.5vh) * 0.58);
    min-width: calc(var(--topbar-height, 4.5vh) * 0.58);
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.9));
    transition: transform 120ms ease;
  }

  .topbar-status-icon:hover {
    transform: scale(1.15);
  }

  .topbar-status-sprite {
    width: 80%;
    height: 80%;
    object-fit: contain;
  }

  .topbar-status-emoji {
    font-size: calc(var(--topbar-height, 4.5vh) * 0.40);
    line-height: 1;
  }

  /* Single stack-count badge — bottom-right, always visible when value >= 1. Turns detail in hover popup only. */
  .topbar-status-stack {
    position: absolute;
    bottom: calc(-3px * var(--layout-scale, 1));
    right: calc(-3px * var(--layout-scale, 1));
    min-width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    border-radius: 50%;
    font-size: calc(8px * var(--text-scale, 1));
    font-weight: 800;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 calc(2px * var(--layout-scale, 1));
    line-height: 1;
    border: 1px solid rgba(0, 0, 0, 0.5);
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.8);
  }

  /* Popup — positioned below each icon wrapper */
  .topbar-status-popup {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: calc(4px * var(--layout-scale, 1));
    width: calc(220px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(15, 23, 42, 0.97);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    backdrop-filter: blur(8px);
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
    z-index: 501;
    pointer-events: none;
  }

  .topbar-status-popup-row {
    display: flex;
    align-items: flex-start;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .topbar-status-popup-icon {
    font-size: calc(16px * var(--layout-scale, 1));
    flex-shrink: 0;
    width: calc(28px * var(--layout-scale, 1));
    text-align: center;
  }

  .topbar-status-popup-sprite {
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    object-fit: contain;
    flex-shrink: 0;
  }

  .topbar-status-popup-text {
    display: flex;
    flex-direction: column;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .topbar-status-popup-name {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    font-family: var(--font-pixel, var(--font-rpg));
    line-height: 1.2;
  }

  .topbar-status-popup-desc {
    font-size: calc(10px * var(--text-scale, 1));
    color: #94a3b8;
    line-height: 1.3;
  }

  /* ============================================================
     Center — Progress Info
     ============================================================ */
  .segment-name {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.85);
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .floor-label {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
  }

  .progress-divider {
    color: rgba(255, 255, 255, 0.25);
    font-size: calc(10px * var(--text-scale, 1));
    line-height: 1;
  }

  .ascension-badge {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(8px * var(--text-scale, 1));
    font-weight: 700;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-radius: calc(3px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    letter-spacing: 0.06em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  /* ============================================================
     Gold Counter
     ============================================================ */
  .gold-counter {
    position: relative;
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    flex-shrink: 0;
    cursor: pointer;
    margin-left: calc(8px * var(--layout-scale, 1));
  }

  .gold-icon-img {
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    object-fit: contain;
  }

  .gold-value {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    color: #fbbf24;
    line-height: 1;
    letter-spacing: 0.02em;
    min-width: calc(24px * var(--layout-scale, 1));
  }

  /* ============================================================
     Relics Row
     ============================================================ */
  .relics-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    flex-shrink: 1;
    max-height: 100%;
  }

  /* relic-slot-wrapper removed; position: relative moved to relics-row */

  .relic-btn {
    width: calc(var(--topbar-height, 4.5vh) * 0.65);
    height: calc(var(--topbar-height, 4.5vh) * 0.65);
    border-radius: calc(4px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    display: grid;
    place-items: center;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: transform 150ms ease, box-shadow 150ms ease;
  }

  .relic-btn:hover {
    transform: scale(1.12);
    box-shadow: 0 0 calc(6px * var(--layout-scale, 1)) rgba(201, 162, 39, 0.5);
  }

  .relic-btn:focus-visible {
    outline: 2px solid #f4d35e;
    outline-offset: 2px;
  }

  .relic-btn.triggered {
    animation: relicPulse 350ms ease-out;
  }

  @keyframes relicPulse {
    0%   { transform: scale(1);    box-shadow: none; }
    40%  { transform: scale(1.25); box-shadow: 0 0 calc(14px * var(--layout-scale, 1)) rgba(244, 211, 94, 0.8); }
    100% { transform: scale(1);    box-shadow: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .relic-btn.triggered { animation: none; }
  }

  .relic-icon {
    width: calc(var(--topbar-height, 4.5vh) * 0.5);
    height: calc(var(--topbar-height, 4.5vh) * 0.5);
    object-fit: contain;
    image-rendering: auto;
  }

  .relic-emoji-fallback {
    display: none;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--topbar-height, 4.5vh) * 0.38);
    line-height: 1;
  }

  .relic-empty {
    background: rgba(24, 33, 46, 0.25);
    border: 1.5px dashed rgba(201, 162, 39, 0.2);
    cursor: default;
    pointer-events: none;
  }

  .relic-empty:hover {
    transform: none;
    box-shadow: none;
  }

  /* ============================================================
     Relic Tooltip
     ============================================================ */
  .relic-tooltip {
    position: absolute;
    top: calc(100% + calc(6px * var(--layout-scale, 1)));
    right: 0;
    background: rgba(14, 20, 32, 0.97);
    border: 1.5px solid #c9a227;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    max-width: calc(200px * var(--layout-scale, 1));
    min-width: calc(130px * var(--layout-scale, 1));
    z-index: 300;
    pointer-events: auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
    white-space: normal;
  }

  .tooltip-arrow {
    position: absolute;
    top: -7px;
    right: calc(var(--topbar-height, 4.5vh) * 0.3);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid #c9a227;
  }

  .tooltip-name {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    color: #f4d35e;
    margin-bottom: calc(4px * var(--layout-scale, 1));
    line-height: 1.3;
    letter-spacing: 0.03em;
  }

  .tooltip-desc {
    font-size: calc(9px * var(--text-scale, 1));
    color: #d4c9a8;
    line-height: 1.5;
    letter-spacing: 0.02em;
  }

  /* ============================================================
     Pause Button
     ============================================================ */
  /* ============================================================
     Deck Viewer Button — matches pause button sizing
     ============================================================ */
  .deck-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--topbar-height, 4.5vh) * 0.65);
    height: calc(var(--topbar-height, 4.5vh) * 0.7);
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: background 150ms ease;
    margin-left: calc(14px * var(--layout-scale, 1));
    align-self: center;
  }

  .deck-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .deck-btn:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  /* ── Stacked-card deck icon ────────────────────────────── */
  .deck-stack-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(28px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
  }

  .deck-stack-cards {
    position: relative;
    width: calc(22px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
  }

  .deck-stack-card {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(22px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    border-radius: calc(2px * var(--layout-scale, 1));
    background: rgba(10, 18, 30, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.55);
  }

  /* Top card in the stack is slightly brighter */
  .deck-stack-card:last-child {
    border-color: rgba(201, 162, 39, 0.85);
    background: rgba(20, 30, 50, 0.85);
  }

  .deck-stack-count {
    position: absolute;
    bottom: calc(2px * var(--layout-scale, 1));
    right: calc(2px * var(--layout-scale, 1));
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(8px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.9);
    line-height: 1;
    letter-spacing: 0.02em;
    background: rgba(10, 18, 30, 0.85);
    padding: calc(1px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1));
    border-radius: calc(3px * var(--layout-scale, 1));
    z-index: 1;
  }

  .pause-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--topbar-height, 4.5vh) * 0.65);
    height: calc(var(--topbar-height, 4.5vh) * 0.7);
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: background 150ms ease;
    margin-left: calc(2px * var(--layout-scale, 1));
    align-self: center;
  }

  .pause-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .pause-btn:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  /* ── SVG gear icon — deterministic centering, no glyph-bearing drift ── */
  .pause-gear-svg {
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    color: rgba(255, 255, 255, 0.75);
    display: block;
    flex-shrink: 0;
  }

  /* ============================================================
     Brain Fog Wing — Glass Meter
     ============================================================ */
  .fog-wing-wrapper {
    position: fixed;
    top: var(--topbar-height, 4.5vh);
    left: 0;
    width: 35%;
    z-index: 199;
    pointer-events: auto;
    cursor: pointer;
    height: calc(28px * var(--layout-scale, 1));
  }

  .fog-wing {
    position: relative;
    width: 100%;
    height: calc(28px * var(--layout-scale, 1));
    background: rgba(20, 30, 50, 0.35);
    backdrop-filter: blur(12px);
    /* box-shadow edges instead of border — hard borders with backdrop-filter create
       compositing artifacts (visible lines) at the element boundary on the canvas below */
    border-bottom-right-radius: calc(16px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    overflow: hidden;
    transition: background 400ms ease, box-shadow 400ms ease;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -1px 0 rgba(255, 255, 255, 0.12),
      inset -1px 0 0 rgba(255, 255, 255, 0.12),
      0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
  }

  /* Glass highlight — top reflection */
  .fog-glass-highlight {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.03) 40%,
      transparent 60%
    );
    pointer-events: none;
    border-radius: inherit;
    z-index: 3;
  }

  /* Green fill — extends left from center (good, negative fog) */
  .fog-fill-good {
    position: absolute;
    top: 0;
    bottom: 0;
    background: linear-gradient(
      270deg,
      rgba(80, 200, 120, 0.5) 0%,
      rgba(50, 180, 80, 0.35) 50%,
      rgba(30, 160, 60, 0.25) 100%
    );
    transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
    border-radius: inherit;
  }

  /* Red fill — extends right from center (bad, positive fog) */
  .fog-fill-bad {
    position: absolute;
    top: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      rgba(220, 80, 60, 0.5) 0%,
      rgba(200, 60, 50, 0.35) 50%,
      rgba(180, 40, 40, 0.25) 100%
    );
    transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
    border-radius: inherit;
  }

  /* Subtle center tick mark */
  .fog-center-mark {
    position: absolute;
    top: 15%;
    bottom: 15%;
    left: 50%;
    width: 1px;
    background: rgba(255, 255, 255, 0.15);
    z-index: 2;
    pointer-events: none;
  }

  /* Danger state — brain fog active */
  .fog-wing-danger .fog-wing {
    background: rgba(50, 15, 15, 0.4);
    box-shadow:
      inset 0 0 calc(12px * var(--layout-scale, 1)) rgba(220, 80, 60, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
    border-color: rgba(220, 80, 60, 0.25);
  }

  /* Flow state — green clarity */
  .fog-wing-flow .fog-wing {
    background: rgba(15, 40, 20, 0.4);
    box-shadow:
      inset 0 0 calc(10px * var(--layout-scale, 1)) rgba(80, 200, 120, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
    border-color: rgba(80, 200, 120, 0.2);
  }

  /* Animated mist overlay */
  .fog-mist {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(150, 160, 180, 0.05) 0%,
      rgba(150, 160, 180, 0.15) 30%,
      rgba(150, 160, 180, 0.08) 60%,
      rgba(150, 160, 180, 0.18) 100%
    );
    animation: fogDrift 4s ease-in-out infinite alternate;
    pointer-events: none;
    border-radius: inherit;
    z-index: 2;
  }

  @keyframes fogDrift {
    0% {
      background-position: 0% 50%;
      filter: blur(0px);
    }
    100% {
      background-position: 100% 50%;
      filter: blur(1px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fog-mist { animation: none; }
  }

  /* Tooltip */
  .fog-tooltip {
    position: absolute;
    top: calc(100% + calc(4px * var(--layout-scale, 1)));
    left: calc(10px * var(--layout-scale, 1));
    background: rgba(14, 20, 32, 0.97);
    border: 1.5px solid rgba(148, 163, 184, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    max-width: calc(260px * var(--layout-scale, 1));
    min-width: calc(180px * var(--layout-scale, 1));
    z-index: 300;
    pointer-events: none;
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
    white-space: normal;
  }

  .fog-wing-danger .fog-tooltip {
    border-color: rgba(220, 80, 60, 0.4);
  }

  .fog-wing-flow .fog-tooltip {
    border-color: rgba(80, 200, 120, 0.4);
  }

  .fog-tooltip-title {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #94a3b8;
    margin-bottom: calc(6px * var(--layout-scale, 1));
    line-height: 1.3;
    letter-spacing: 0.03em;
  }

  .fog-wing-danger .fog-tooltip .fog-tooltip-title {
    color: #f87171;
  }

  .fog-wing-flow .fog-tooltip .fog-tooltip-title {
    color: #4ade80;
  }

  .fog-tooltip-desc {
    font-size: calc(10px * var(--text-scale, 1));
    color: #d4c9a8;
    line-height: 1.5;
    letter-spacing: 0.02em;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .fog-tooltip-desc strong {
    color: #e8dcc0;
    font-weight: 600;
  }

  /* Mini meter in tooltip */
  .fog-tooltip-meter {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .fog-tooltip-label {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(8px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.5);
    min-width: calc(24px * var(--layout-scale, 1));
  }

  .fog-tooltip-bar {
    position: relative;
    flex: 1;
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .fog-tooltip-bar-good {
    position: absolute;
    top: 0;
    bottom: 0;
    background: linear-gradient(270deg, rgba(80, 200, 120, 0.7), rgba(50, 180, 80, 0.5));
    border-radius: inherit;
  }

  .fog-tooltip-bar-bad {
    position: absolute;
    top: 0;
    bottom: 0;
    background: linear-gradient(90deg, rgba(220, 80, 60, 0.7), rgba(200, 60, 50, 0.5));
    border-radius: inherit;
  }

  .fog-tooltip-center {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: rgba(255, 255, 255, 0.3);
  }

  .fog-tooltip-value {
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(8px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.6);
    min-width: calc(28px * var(--layout-scale, 1));
    text-align: right;
  }

  .gold-tooltip {
    position: absolute;
    top: calc(100% + calc(6px * var(--layout-scale, 1)));
    right: 0;
    background: rgba(14, 20, 32, 0.97);
    border: 1.5px solid rgba(251, 191, 36, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    z-index: 300;
    pointer-events: none;
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
    white-space: nowrap;
  }

  .gold-tooltip-desc {
    font-size: calc(9px * var(--text-scale, 1));
    color: #d4c9a8;
    line-height: 1.4;
    letter-spacing: 0.02em;
  }
</style>
