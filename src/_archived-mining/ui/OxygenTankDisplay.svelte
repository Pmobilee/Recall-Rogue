<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { computeTanks, formatRegenTime } from '../../services/oxygenRegenService'
  import { BALANCE } from '../../data/balance'

  // Check subscriber status from save
  const isSubscriber = $derived(
    !!$playerSave?.subscription && new Date($playerSave.subscription.expiresAt) > new Date()
  )
  const tankCount = $derived(
    $playerSave ? computeTanks($playerSave, isSubscriber) : BALANCE.OXYGEN_MAX_BANK_FREE
  )
  const maxBank = $derived(isSubscriber ? Infinity : BALANCE.OXYGEN_MAX_BANK_FREE)
  const regenText = $derived(
    $playerSave ? formatRegenTime($playerSave, isSubscriber) : 'Ready'
  )
  const isFull = $derived(tankCount >= maxBank)
</script>

<div class="tank-display" data-testid="tank-bank">
  {#if isSubscriber}
    <div class="tank-icons">
      <span class="tank-icon full" aria-label="Unlimited oxygen">∞</span>
    </div>
    <span class="tank-label unlimited">Unlimited</span>
  {:else}
    <div class="tank-icons">
      {#each Array(BALANCE.OXYGEN_MAX_BANK_FREE) as _, i}
        <span
          class="tank-icon"
          class:full={i < tankCount}
          class:empty={i >= tankCount}
          aria-label={i < tankCount ? 'Full tank' : 'Empty tank'}
        >⬢</span>
      {/each}
    </div>
    <span class="tank-label" class:ready={isFull} data-testid="tank-status">
      {regenText}
    </span>
  {/if}
</div>

<style>
  .tank-display {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
  }
  .tank-icons {
    display: flex;
    gap: 2px;
  }
  .tank-icon {
    font-size: 14px;
    transition: opacity 0.3s;
  }
  .tank-icon.full {
    color: #4ade80;
    opacity: 1;
  }
  .tank-icon.empty {
    color: #4ade80;
    opacity: 0.25;
  }
  .tank-label {
    color: #9ca3af;
    font-size: 8px;
  }
  .tank-label.ready {
    color: #fbbf24;
  }
  .tank-label.unlimited {
    color: #a78bfa;
  }
</style>
