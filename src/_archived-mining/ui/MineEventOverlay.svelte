<script lang="ts">
  import { activeMineEvent, currentScreen } from '../stores/gameState'
  import { onDestroy } from 'svelte'

  let timer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    if ($activeMineEvent) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => activeMineEvent.set(null), 3000)
    }
  })

  onDestroy(() => {
    if (timer) clearTimeout(timer)
  })
</script>

{#if $currentScreen === 'mining' && $activeMineEvent}
  <div class="event-card" role="status" aria-live="polite">
    <span class="event-icon">⚠️</span>
    <span class="event-label">{$activeMineEvent.label}</span>
  </div>
{/if}

<style>
  .event-card {
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid #ff8800;
    border-radius: 8px;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    color: #ff8800;
    pointer-events: none;
    z-index: 210;
    animation: fadeInOut 3s forwards;
  }
  .event-icon {
    font-size: 1.2rem;
  }
  .event-label {
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 0.04em;
  }
  @keyframes fadeInOut {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
    15%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
