<script lang="ts">
  import { getRelicIconPath } from '../utils/iconAssets'

  interface DisplayRelic {
    definitionId: string
    name: string
    description: string
    icon: string
  }

  interface Props {
    relics: DisplayRelic[]
    triggeredRelicId?: string | null
    maxSlots?: number
  }

  let { relics, triggeredRelicId = null, maxSlots = 5 }: Props = $props()
</script>

<div class="relic-tray">
  {#each relics as relic (relic.definitionId)}
    <div
      class="relic-slot"
      class:triggered={triggeredRelicId === relic.definitionId}
      title={`${relic.name}: ${relic.description}`}
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
</style>
