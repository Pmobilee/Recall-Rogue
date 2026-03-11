<script lang="ts">
  import type { RelicDefinition } from '../../data/relics/types'
  import { onMount } from 'svelte'

  interface Props {
    relic: RelicDefinition
    ondismiss: () => void
  }

  let { relic, ondismiss }: Props = $props()

  let dismissing = $state(false)

  const rarityColors: Record<string, string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    legendary: '#f59e0b',
  }

  const accentColor = $derived(rarityColors[relic.rarity] ?? '#9ca3af')

  onMount(() => {
    const timer = setTimeout(() => {
      dismiss()
    }, 2500)
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
<button
  class="relic-toast"
  class:dismissing
  style="border-left-color: {accentColor}"
  onclick={dismiss}
  aria-label="Relic found: {relic.name}. Tap to dismiss."
  role="status"
>
  <div class="toast-icon">{relic.icon}</div>
  <div class="toast-body">
    <div class="toast-header">Relic Found!</div>
    <div class="toast-name">{relic.name}</div>
    <span class="toast-rarity" style="background: {accentColor}">{relic.rarity}</span>
  </div>
</button>

<style>
  .relic-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(22, 33, 62, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-left: 4px solid;
    border-radius: 12px;
    padding: 12px 16px;
    max-width: 320px;
    width: max-content;
    color: var(--color-text, #eee);
    font-family: 'Courier New', monospace;
    cursor: pointer;
    animation: toastSlideIn 0.35s ease-out;

    /* Reset button defaults */
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }

  .relic-toast.dismissing {
    animation: toastSlideOut 0.3s ease-in forwards;
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
