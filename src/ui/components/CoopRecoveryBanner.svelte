<!-- Co-op Recovery Banner — shown when the Scholar partner has disconnected.
     Displays a countdown for the reconnect window, then AI Scholar takeover message.
     Pinned to the top of the viewport; pointer-events: none so it doesn't block input. -->
<script lang="ts">
  import { inRecoveryMode, recoveryTicksLeft } from '../stores/coopState'

  let mode = $derived($inRecoveryMode)
  let ticks = $derived($recoveryTicksLeft)
</script>

{#if mode}
  <div class="recovery-banner" role="alert" aria-live="polite">
    {#if ticks > 0}
      Partner disconnected — waiting {ticks}s for reconnect...
    {:else}
      GAIA Scholar has taken over. Reconnect your partner to restore full bonus!
    {/if}
  </div>
{/if}

<style>
  .recovery-banner {
    position: fixed; top: 0; left: 0; right: 0;
    background: #e94560; color: #fff; text-align: center;
    padding: 8px; font-size: 11px; font-family: var(--font-rpg);
    z-index: 150; pointer-events: none;
  }
</style>
