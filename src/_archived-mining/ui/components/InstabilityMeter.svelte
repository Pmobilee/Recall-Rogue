<script lang="ts">
  import { instabilityLevel, instabilityCollapsing, instabilityCountdown, currentScreen } from '../stores/gameState'

  const show = $derived($currentScreen === 'mining' && $instabilityLevel >= 75)
</script>

{#if show}
  <div
    class="instability-bar"
    class:collapsing={$instabilityCollapsing}
    role="status"
    aria-label="Layer instability: {$instabilityLevel}%"
  >
    <div class="label">
      {#if $instabilityCollapsing}
        COLLAPSE IN {$instabilityCountdown}
      {:else}
        INSTABILITY
      {/if}
    </div>
    <div class="track">
      <div class="fill" style="width: {$instabilityLevel}%"></div>
    </div>
  </div>
{/if}

<style>
  .instability-bar {
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #cc4400;
    border-radius: 6px;
    padding: 4px 8px;
    pointer-events: none;
    z-index: 200;
  }
  .collapsing {
    border-color: #ff0000;
    animation: shake 0.3s infinite;
  }
  .label {
    font-size: 0.7rem;
    color: #cc4400;
    text-align: center;
    margin-bottom: 3px;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.05em;
  }
  .collapsing .label {
    color: #ff0000;
  }
  .track {
    background: #330000;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, #cc4400, #ff0000);
    transition: width 0.2s;
  }
  @keyframes shake {
    0%,  100% { transform: translateX(-50%) translateX(0); }
    25%        { transform: translateX(-50%) translateX(-2px); }
    75%        { transform: translateX(-50%) translateX(2px); }
  }
</style>
