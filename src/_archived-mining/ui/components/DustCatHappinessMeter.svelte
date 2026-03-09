<script lang="ts">
  import { playerSave } from '../stores/playerData'

  /** Current happiness value (0-100). Reactive from store. */
  $: happiness = $playerSave?.dustCatHappiness ?? 0
  $: unlocked = $playerSave?.dustCatUnlocked ?? false

  let showTooltip = false

  /** Colour zone based on happiness level. */
  $: zoneColor = happiness <= 30 ? '#F44336'
    : happiness <= 60 ? '#FF9800'
    : '#4CAF50'

  /** Face emoji based on happiness zone. */
  $: faceEmoji = happiness <= 30 ? '😿'
    : happiness <= 60 ? '😾'
    : '😸'
</script>

{#if unlocked}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="happiness-meter"
    role="button"
    on:click={() => (showTooltip = !showTooltip)}
    on:blur={() => (showTooltip = false)}
    tabindex="0"
  >
    <span class="face-emoji" aria-hidden="true">{faceEmoji}</span>
    <div class="bar-track" aria-label="Dust Cat happiness: {happiness}%">
      <div
        class="bar-fill"
        style="width: {happiness}%; background-color: {zoneColor};"
      ></div>
    </div>
    <span class="happiness-value">{Math.round(happiness)}</span>

    {#if showTooltip}
      <div class="tooltip" role="tooltip">
        Feed or groom your cat to keep happiness up. Low happiness reduces synergy bonuses.
      </div>
    {/if}
  </div>
{/if}

<style>
  .happiness-meter {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    user-select: none;
  }

  .happiness-meter:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .face-emoji {
    font-size: 14px;
    line-height: 1;
  }

  .bar-track {
    width: 120px;
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .happiness-value {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    min-width: 20px;
    text-align: right;
  }

  .tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    width: 220px;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    color: #fff;
    line-height: 1.4;
    z-index: 100;
    pointer-events: none;
  }
</style>
