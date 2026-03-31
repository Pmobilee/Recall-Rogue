<script lang="ts">
  import { getRelicIconPath, getGoldCoinIconPath } from '../utils/iconAssets'

  // ============================================================
  // Segment name lookup
  // ============================================================
  const SEGMENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
    1: 'Shallow Depths',
    2: 'Deep Caverns',
    3: 'The Abyss',
    4: 'The Archive',
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
    reviewQueueLength?: number
    fogLevel?: number
    fogState?: 'brain_fog' | 'neutral' | 'flow_state'
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
    reviewQueueLength = 0,
    fogLevel = 0,
    fogState = undefined,
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
    {#if reviewQueueLength > 0}
      <span class="review-queue-pill" aria-label="{reviewQueueLength} facts in review queue">
        📝 {reviewQueueLength}
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
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="gold-counter" aria-label="Gold: {currency}"
      onmouseenter={() => { goldTooltipOpen = true }}
      onmouseleave={() => { goldTooltipOpen = false }}
      onclick={() => { goldTooltipOpen = !goldTooltipOpen }}
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
        <div class="relic-slot-wrapper" role="listitem">
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
        </div>
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

    <!-- Pause button -->
    <button
      class="pause-btn"
      aria-label="Pause"
      onclick={onpause}
      type="button"
    >
      <span class="pause-icon" aria-hidden="true">⚙</span>
    </button>
  </div>
</div>

<!-- Brain Fog Wing — glass meter below top bar -->
{#if fogState !== undefined}
  {@const fl = fogLevel ?? 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fog-wing-wrapper" class:fog-wing-danger={fogState === 'brain_fog'} class:fog-wing-flow={fogState === 'flow_state'}
    onclick={() => { fogTooltipOpen = !fogTooltipOpen }}
    onmouseenter={() => { fogTooltipOpen = true }}
    onmouseleave={() => { fogTooltipOpen = false }}
  >
    <div class="fog-wing" aria-label="{fogState === 'brain_fog' ? 'Brain Fog' : fogState === 'flow_state' ? 'Flow State' : 'Neutral'} level {Math.abs(fl)}">
      {#if fl < 0}
        <div class="fog-fill-good" style="width: {Math.abs(fl) / 5 * 50}%; right: 50%;"></div>
      {:else if fl > 0}
        <div class="fog-fill-bad" style="width: {fl / 5 * 50}%; left: 50%;"></div>
      {/if}
      <div class="fog-center-mark"></div>
      <div class="fog-mist" style="opacity: {Math.abs(fl) / 5 * 0.5};"></div>
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
            {#if (fogLevel ?? 0) < 0}
              <div class="fog-tooltip-bar-good" style="width: {Math.abs(fogLevel ?? 0) / 5 * 50}%; right: 50%;"></div>
            {:else if (fogLevel ?? 0) > 0}
              <div class="fog-tooltip-bar-bad" style="width: {(fogLevel ?? 0) / 5 * 50}%; left: 50%;"></div>
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
    height: var(--topbar-height, clamp(36px, 4.5vh, 56px));
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
    overflow: hidden;
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
    max-width: 35%;
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
    max-width: 45%;
    justify-content: flex-end;
  }

  /* ============================================================
     HP Bar
     ============================================================ */
  .hp-group {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .hp-bar-track {
    position: relative;
    flex: 1;
    min-width: 0;
    height: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.38);
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
    font-size: calc(9px * var(--text-scale, 1));
  }

  .shield-badge {
    display: inline-flex;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    background: rgba(56, 189, 248, 0.25);
    border: 1px solid rgba(56, 189, 248, 0.5);
    border-radius: 999px;
    font-size: calc(7px * var(--text-scale, 1));
    font-family: var(--font-pixel, var(--font-rpg));
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    letter-spacing: 0.03em;
    line-height: 1;
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

  .review-queue-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    font-family: var(--font-pixel, var(--font-rpg));
    font-size: calc(8px * var(--text-scale, 1));
    font-weight: 700;
    color: #fcd34d;
    background: rgba(251, 191, 36, 0.12);
    border: 1px solid rgba(251, 191, 36, 0.35);
    padding: calc(1px * var(--layout-scale, 1)) calc(5px * var(--layout-scale, 1));
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 1;
    letter-spacing: 0.03em;
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
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    flex-shrink: 1;
  }

  .relic-slot-wrapper {
    position: relative;
  }

  .relic-btn {
    width: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.65);
    height: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.65);
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
    width: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.5);
    height: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.5);
    object-fit: contain;
    image-rendering: auto;
  }

  .relic-emoji-fallback {
    display: none;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.38);
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
    right: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.3);
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
  .pause-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.65);
    height: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.85);
    max-height: 100%;
    border-radius: calc(4px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
    transition: background 150ms ease;
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  .pause-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .pause-btn:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  .pause-icon {
    font-size: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.55);
    line-height: 1;
    color: rgba(255, 255, 255, 0.75);
  }

  /* ============================================================
     Brain Fog Wing — Glass Meter
     ============================================================ */
  .fog-wing-wrapper {
    position: fixed;
    top: var(--topbar-height, clamp(36px, 4.5vh, 56px));
    left: 0;
    width: 35%;
    z-index: 199;
    pointer-events: auto;
    cursor: pointer;
  }

  .fog-wing {
    position: relative;
    width: 100%;
    height: calc(28px * var(--layout-scale, 1));
    background: rgba(20, 30, 50, 0.35);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom-right-radius: calc(16px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    overflow: hidden;
    transition: background 400ms ease, box-shadow 400ms ease;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
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
