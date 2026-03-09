<script lang="ts">
  import type { ActiveRelic } from '../../data/passiveRelics'

  interface Props {
    relics: ActiveRelic[]
    triggeredRelicId?: string | null
  }

  let { relics, triggeredRelicId = null }: Props = $props()
</script>

{#if relics.length > 0}
  <div class="relic-tray">
    {#each relics as relic (relic.sourceFactId + relic.definition.id)}
      <div
        class="relic"
        class:dormant={relic.isDormant}
        class:triggered={triggeredRelicId === relic.definition.id}
        title={relic.isDormant
          ? `${relic.definition.name}: Dormant — review the source fact to reactivate`
          : `${relic.definition.name}: ${relic.definition.description}`}
      >
        {relic.definition.name.charAt(0)}
      </div>
    {/each}
  </div>
{/if}

<style>
  .relic-tray {
    position: absolute;
    top: 8px;
    right: 10px;
    display: flex;
    gap: 6px;
    max-width: calc(100% - 20px);
    overflow-x: auto;
    z-index: 7;
  }

  .relic {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(24, 33, 46, 0.95);
    border: 1px solid #C9A227;
    color: #F4D35E;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 14px;
    flex: 0 0 auto;
  }

  .relic.dormant {
    opacity: 0.5;
    filter: grayscale(1);
    border-color: #6C757D;
    color: #ADB5BD;
  }

  .relic.triggered {
    animation: relicPulse 280ms ease-out;
  }

  @keyframes relicPulse {
    0% { transform: scale(1); }
    45% { transform: scale(1.18); box-shadow: 0 0 14px rgba(244, 211, 94, 0.8); }
    100% { transform: scale(1); }
  }
</style>

