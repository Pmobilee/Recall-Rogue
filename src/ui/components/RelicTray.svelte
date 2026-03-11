<script lang="ts">
  interface DisplayRelic {
    definitionId: string
    name: string
    description: string
    initial: string
  }

  interface Props {
    relics: DisplayRelic[]
    triggeredRelicId?: string | null
  }

  let { relics, triggeredRelicId = null }: Props = $props()
</script>

{#if relics.length > 0}
  <div class="relic-tray">
    {#each relics as relic (relic.definitionId)}
      <div
        class="relic"
        class:triggered={triggeredRelicId === relic.definitionId}
        title={`${relic.name}: ${relic.description}`}
      >
        {relic.initial}
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

  .relic.triggered {
    animation: relicPulse 280ms ease-out;
  }

  @keyframes relicPulse {
    0% { transform: scale(1); }
    45% { transform: scale(1.18); box-shadow: 0 0 14px rgba(244, 211, 94, 0.8); }
    100% { transform: scale(1); }
  }
</style>
