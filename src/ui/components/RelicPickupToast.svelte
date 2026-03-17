<script lang="ts">
  import type { RelicDefinition } from '../../data/relics/types'
  import { onMount } from 'svelte'

  interface Props {
    relic: RelicDefinition
    ondismiss: () => void
    /** If provided, shows a "Swap" button — used when relic slots are full. */
    onswap?: () => void
  }

  let { relic, ondismiss, onswap }: Props = $props()

  let dismissing = $state(false)

  const rarityColors: Record<string, string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    legendary: '#f59e0b',
  }

  const accentColor = $derived(rarityColors[relic.rarity] ?? '#9ca3af')

  onMount(() => {
    // When a swap option is shown (slots full), give more time for the player to decide
    const timeout = onswap ? 5000 : 2500
    const timer = setTimeout(() => {
      dismiss()
    }, timeout)
    return () => clearTimeout(timer)
  })

  function dismiss(): void {
    if (dismissing) return
    dismissing = true
    // Allow slide-out animation to finish before calling ondismiss
    setTimeout(ondismiss, 300)
  }
</script>

<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
<div
  class="relic-toast"
  class:dismissing
  class:has-swap={onswap !== undefined}
  style="border-left-color: {accentColor}"
  role="status"
  aria-label="Relic found: {relic.name}{onswap ? ' — slots full' : ''}"
>
  <button class="toast-main" onclick={dismiss} aria-label="Dismiss relic toast">
    <div class="toast-icon">{relic.icon}</div>
    <div class="toast-body">
      <div class="toast-header">{onswap ? 'Relic Drop! (Slots Full)' : 'Relic Found!'}</div>
      <div class="toast-name">{relic.name}</div>
      <span class="toast-rarity" style="background: {accentColor}">{relic.rarity}</span>
    </div>
  </button>
  {#if onswap}
    <button
      class="toast-swap-btn"
      onclick={() => { onswap(); ondismiss(); }}
      aria-label="Swap a relic to keep {relic.name}"
    >
      Swap
    </button>
  {/if}
</div>

<style>
  .relic-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(22, 33, 62, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-left: 4px solid;
    border-radius: 12px;
    padding: 12px 16px;
    max-width: 360px;
    width: max-content;
    color: var(--color-text, #eee);
    font-family: 'Courier New', monospace;
    animation: toastSlideIn 0.35s ease-out;
  }

  .toast-main {
    display: flex;
    align-items: center;
    gap: 12px;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    outline: none;
  }

  .relic-toast.dismissing {
    animation: toastSlideOut 0.3s ease-in forwards;
  }

  .toast-swap-btn {
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 6px;
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid #22c55e;
    color: #22c55e;
    font-family: 'Courier New', monospace;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease;
  }

  .toast-swap-btn:active {
    background: rgba(34, 197, 94, 0.3);
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes toastSlideOut {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
  }

  .toast-icon {
    font-size: calc(28px * var(--text-scale, 1));
    flex: 0 0 auto;
    line-height: 1;
  }

  .toast-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    text-align: left;
  }

  .toast-header {
    font-size: calc(10px * var(--text-scale, 1));
    color: #ffd700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  .toast-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
  }

  .toast-rarity {
    display: inline-block;
    width: fit-content;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #000;
    line-height: 1.4;
  }
</style>
