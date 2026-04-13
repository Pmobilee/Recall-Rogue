<script lang="ts">
  import type { EnemyInstance } from '../../data/enemies';
  import { getEnemyPowers, type ActivePower } from '../../data/enemyPowers';

  interface Props {
    enemy: EnemyInstance | null | undefined;
  }

  let { enemy }: Props = $props();

  let powers = $derived(getEnemyPowers(enemy));
  let activeTip = $state<ActivePower | null>(null);

  function showTip(power: ActivePower) {
    activeTip = power;
  }

  function hideTip() {
    activeTip = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if powers.length > 0}
  <div class="enemy-power-badges">
    {#each powers as power (power.id)}
      <div
        class="power-badge"
        onmouseenter={() => showTip(power)}
        onmouseleave={hideTip}
      >
        <img
          src="/assets/sprites/icons/icon_power_{power.id}.png"
          alt={power.label}
          class="badge-icon"
          onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    {/each}
  </div>

  {#if activeTip}
    <div class="power-tooltip">
      <div class="tooltip-header" style="color: {activeTip.color}">
        {activeTip.label}
      </div>
      <div class="tooltip-body">
        {activeTip.resolvedTooltip}
      </div>
    </div>
  {/if}
{/if}

<style>
  .enemy-power-badges {
    position: relative;
    z-index: 10;
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
    flex-wrap: nowrap;
    align-items: center;
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.6);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .power-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
  }

  .badge-icon {
    width: calc(22px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .power-tooltip {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: calc(10vh + var(--safe-top, 0px));
    z-index: 20;
    background: rgba(0, 0, 0, 0.92);
    border: 1px solid #666;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    max-width: calc(280px * var(--layout-scale, 1));
    pointer-events: none;
    animation: fadeIn 0.15s ease-out;
  }

  .tooltip-header {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    margin-bottom: calc(4px * var(--layout-scale, 1));
  }

  .tooltip-body {
    font-size: calc(11px * var(--text-scale, 1));
    color: #ccc;
    line-height: 1.4;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(calc(-4px * var(--layout-scale, 1))); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
