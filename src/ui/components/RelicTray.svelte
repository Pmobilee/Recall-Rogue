<script lang="ts">
  import { getRelicIconPath } from '../utils/iconAssets'
  import { SHOP_RELIC_PRICE, RELIC_SELL_REFUND_PCT } from '../../data/balance'

  interface DisplayRelic {
    definitionId: string
    name: string
    description: string
    icon: string
    rarity?: string
  }

  interface Props {
    relics: DisplayRelic[]
    triggeredRelicId?: string | null
    maxSlots?: number
    /** Optional callback: called with definitionId when player confirms a sell. */
    onsell?: (definitionId: string) => void
  }

  let { relics, triggeredRelicId = null, maxSlots = 5, onsell }: Props = $props()

  /** Index of the relic whose tooltip is currently open, or null if none. */
  let openTooltipIndex: number | null = $state(null)
  /** DefinitionId of the relic pending sell confirmation, or null if none. */
  let pendingSellId: string | null = $state(null)

  function toggleTooltip(index: number) {
    openTooltipIndex = openTooltipIndex === index ? null : index
    pendingSellId = null
  }

  function closeTooltip() {
    openTooltipIndex = null
    pendingSellId = null
  }

  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.relic-slot') && !target.closest('.relic-tooltip')) {
      closeTooltip()
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

  function getSellValue(relic: DisplayRelic): number {
    const basePrice = SHOP_RELIC_PRICE[relic.rarity ?? 'common'] ?? 0
    return Math.floor(basePrice * RELIC_SELL_REFUND_PCT)
  }

  function handleSellClick(relic: DisplayRelic) {
    pendingSellId = relic.definitionId
  }

  function confirmSell(relic: DisplayRelic) {
    if (onsell) {
      onsell(relic.definitionId)
    }
    closeTooltip()
  }

  function cancelSell() {
    pendingSellId = null
  }
</script>

<div class="relic-tray">
  {#each relics as relic, i (relic.definitionId)}
    <div class="relic-slot-wrapper">
      <div
        class="relic-slot"
        class:triggered={triggeredRelicId === relic.definitionId}
        role="button"
        tabindex="0"
        aria-label={relic.name}
        onclick={() => toggleTooltip(i)}
        onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? toggleTooltip(i) : null}
      >
        <img
          class="relic-icon"
          src={getRelicIconPath(relic.definitionId)}
          alt={relic.name}
          onerror={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'grid'
          }}
        />
        <span class="relic-emoji-fallback">{relic.icon}</span>
      </div>
      {#if openTooltipIndex === i}
        <div class="relic-tooltip" role="tooltip">
          <div class="tooltip-arrow"></div>
          <div class="tooltip-name">{relic.name}</div>
          <div class="tooltip-desc">{relic.description}</div>
          {#if onsell}
            {#if pendingSellId === relic.definitionId}
              <div class="tooltip-sell-confirm">
                <span class="sell-confirm-label">Sell for {getSellValue(relic)}g?</span>
                <div class="sell-confirm-btns">
                  <button
                    type="button"
                    class="sell-confirm-yes"
                    onclick={(e) => { e.stopPropagation(); confirmSell(relic) }}
                  >Yes</button>
                  <button
                    type="button"
                    class="sell-confirm-no"
                    onclick={(e) => { e.stopPropagation(); cancelSell() }}
                  >No</button>
                </div>
              </div>
            {:else}
              <button
                type="button"
                class="tooltip-sell-btn"
                onclick={(e) => { e.stopPropagation(); handleSellClick(relic) }}
              >Sell ({getSellValue(relic)}g)</button>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  {/each}
  {#each { length: Math.max(0, maxSlots - relics.length) } as _, i (i)}
    <div class="relic-slot empty" aria-label="Empty relic slot"></div>
  {/each}
  <div class="slot-count" class:full={relics.length >= maxSlots}>
    {relics.length}/{maxSlots}
  </div>
</div>

<style>
  .relic-tray {
    position: absolute;
    right: calc(6px * var(--layout-scale, 1));
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    z-index: 7;
    pointer-events: auto;
  }

  .relic-slot-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .relic-slot {
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    background: rgba(24, 33, 46, 0.9);
    border: 1.5px solid #C9A227;
    display: grid;
    place-items: center;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 150ms ease, box-shadow 150ms ease;
  }

  .relic-slot:hover {
    transform: scale(1.15);
    box-shadow: 0 0 8px rgba(201, 162, 39, 0.5);
  }

  .relic-slot.triggered {
    animation: relicPulse 350ms ease-out;
  }

  .relic-icon {
    width: calc(22px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: auto;
  }

  .relic-emoji-fallback {
    display: none;
    place-items: center;
    font-size: calc(14px * var(--layout-scale, 1));
    line-height: 1;
  }

  @keyframes relicPulse {
    0% { transform: scale(1); box-shadow: none; }
    40% { transform: scale(1.25); box-shadow: 0 0 14px rgba(244, 211, 94, 0.8); }
    100% { transform: scale(1); box-shadow: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .relic-slot.triggered { animation: none; }
  }

  .slot-count {
    font-size: calc(9px * var(--layout-scale, 1));
    color: #C9A227;
    text-align: center;
    font-weight: 600;
    line-height: 1;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .slot-count.full {
    color: #FF8C00;
  }

  .relic-slot.empty {
    background: rgba(24, 33, 46, 0.4);
    border-color: rgba(201, 162, 39, 0.25);
    cursor: default;
  }

  .relic-slot.empty:hover {
    transform: none;
    box-shadow: none;
  }

  /* Tooltip */
  .relic-tooltip {
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: rgba(24, 33, 46, 0.95);
    border: 1.5px solid #C9A227;
    border-radius: 6px;
    padding: 8px 10px;
    max-width: 200px;
    min-width: 120px;
    z-index: 100;
    pointer-events: auto;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    white-space: normal;
  }

  .tooltip-arrow {
    position: absolute;
    right: -7px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 6px solid #C9A227;
  }

  .tooltip-name {
    font-family: var(--font-pixel, monospace);
    font-size: 9px;
    font-weight: bold;
    color: #F4D35E;
    margin-bottom: 4px;
    line-height: 1.3;
    letter-spacing: 0.03em;
  }

  .tooltip-desc {
    font-size: 8px;
    color: #D4C9A8;
    line-height: 1.5;
    letter-spacing: 0.02em;
  }

  .tooltip-sell-btn {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 4px 6px;
    background: rgba(220, 38, 38, 0.18);
    border: 1px solid rgba(220, 38, 38, 0.5);
    border-radius: 4px;
    color: #fca5a5;
    font-size: 8px;
    font-family: var(--font-pixel, monospace);
    cursor: pointer;
    text-align: center;
    pointer-events: auto;
    transition: background 120ms ease;
  }

  .tooltip-sell-btn:hover {
    background: rgba(220, 38, 38, 0.35);
  }

  .tooltip-sell-confirm {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sell-confirm-label {
    font-size: 8px;
    color: #fcd34d;
    font-family: var(--font-pixel, monospace);
    text-align: center;
  }

  .sell-confirm-btns {
    display: flex;
    gap: 4px;
  }

  .sell-confirm-yes,
  .sell-confirm-no {
    flex: 1;
    padding: 3px 4px;
    border-radius: 3px;
    font-size: 8px;
    font-family: var(--font-pixel, monospace);
    cursor: pointer;
    pointer-events: auto;
    border: none;
    text-align: center;
  }

  .sell-confirm-yes {
    background: rgba(220, 38, 38, 0.7);
    color: #fff;
  }

  .sell-confirm-yes:hover {
    background: rgba(220, 38, 38, 0.9);
  }

  .sell-confirm-no {
    background: rgba(55, 65, 81, 0.8);
    color: #9ca3af;
  }

  .sell-confirm-no:hover {
    background: rgba(75, 85, 99, 0.9);
  }
</style>
