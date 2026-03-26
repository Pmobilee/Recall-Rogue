<script lang="ts">
  import { getRelicIconPath } from '../utils/iconAssets'

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
    onpause,
  }: Props = $props()

  // ============================================================
  // HP bar color derived from percentage
  // ============================================================
  const hpPercent = $derived(
    playerMaxHp > 0 ? Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100)) : 0,
  )

  const hpBarColor = $derived(
    hpPercent > 60
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
    {#if playerBlock > 0}
      <div class="block-badge" aria-label="Block: {playerBlock}">
        <span class="block-icon">🛡</span>
        <span class="block-value">{playerBlock}</span>
      </div>
    {/if}

    <div class="hp-group" aria-label="HP: {playerHp} of {playerMaxHp}">
      <span class="hp-label">HP</span>
      <div class="hp-bar-track">
        <div
          class="hp-bar-fill"
          style="width: {hpPercent}%; background: {hpBarColor};"
          role="progressbar"
          aria-valuenow={playerHp}
          aria-valuemin={0}
          aria-valuemax={playerMaxHp}
        ></div>
        <span class="hp-text">{playerHp}/{playerMaxHp}</span>
      </div>
    </div>
  </div>

  <!-- ============================================================
       CENTER — Run Progress
       ============================================================ -->
  <div class="section section-center" aria-label="Run progress">
    <span class="segment-name">{segmentName}</span>
    <span class="progress-divider">·</span>
    <span class="floor-label">Floor {currentFloor}</span>
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
    <!-- Gold -->
    <div class="gold-counter" aria-label="Gold: {currency}">
      <span class="gold-icon" aria-hidden="true">🪙</span>
      <span class="gold-value">{currency}</span>
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0 calc(12px * var(--layout-scale, 1));
    pointer-events: auto;
    box-sizing: border-box;
    user-select: none;
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
     Block Badge
     ============================================================ */
  .block-badge {
    display: flex;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .block-icon {
    font-size: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.42);
    line-height: 1;
  }

  .block-value {
    font-family: var(--font-pixel, monospace);
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #93c5fd;
    line-height: 1;
  }

  /* ============================================================
     HP Bar
     ============================================================ */
  .hp-group {
    display: flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    flex: 1;
    min-width: 0;
  }

  .hp-label {
    font-family: var(--font-pixel, monospace);
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
    letter-spacing: 0.05em;
    flex-shrink: 0;
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
    text-align: center;
    font-family: var(--font-pixel, monospace);
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    line-height: 1;
    letter-spacing: 0.03em;
    pointer-events: none;
  }

  /* ============================================================
     Center — Progress Info
     ============================================================ */
  .segment-name {
    font-family: var(--font-pixel, monospace);
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.85);
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .floor-label {
    font-family: var(--font-pixel, monospace);
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
    font-family: var(--font-pixel, monospace);
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
    display: flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .gold-icon {
    font-size: calc(var(--topbar-height, clamp(36px, 4.5vh, 56px)) * 0.4);
    line-height: 1;
  }

  .gold-value {
    font-family: var(--font-pixel, monospace);
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    color: #fbbf24;
    line-height: 1;
    letter-spacing: 0.02em;
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
    font-family: var(--font-pixel, monospace);
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
</style>
