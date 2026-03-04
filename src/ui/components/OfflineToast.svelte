<script lang="ts">
  /**
   * OfflineToast
   *
   * A fixed-position toast notification that appears when the browser goes
   * offline and briefly re-appears when connectivity is restored.
   *
   * Lifecycle:
   *  - Offline event  → show "You're offline" banner indefinitely.
   *  - Online event   → swap to "Back online" banner for 3 s, then hide.
   *  - Initial render → if already offline, show banner immediately.
   */

  let visible = $state(false)
  let isCurrentlyOnline = $state(true)

  $effect(() => {
    if (typeof window === 'undefined') return

    // Set initial state based on current connectivity
    isCurrentlyOnline = navigator.onLine
    if (!navigator.onLine) {
      visible = true
    }

    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const handleOffline = (): void => {
      if (hideTimer !== null) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
      isCurrentlyOnline = false
      visible = true
    }

    const handleOnline = (): void => {
      isCurrentlyOnline = true
      // Show the "Back online" state briefly before hiding
      visible = true
      hideTimer = setTimeout(() => {
        visible = false
        hideTimer = null
      }, 3000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return (): void => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if (hideTimer !== null) clearTimeout(hideTimer)
    }
  })
</script>

{#if visible}
  <div class="offline-toast" class:online={isCurrentlyOnline} role="status" aria-live="polite">
    {#if isCurrentlyOnline}
      <span class="toast-icon" aria-hidden="true">&#10003;</span> Back online &mdash; syncing&hellip;
    {:else}
      <span class="toast-icon" aria-hidden="true">&#9889;</span> You're offline &mdash; progress saves locally
    {/if}
  </div>
{/if}

<style>
  .offline-toast {
    position: fixed;
    bottom: max(env(safe-area-inset-bottom), 16px);
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.8rem;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
    animation: slideUp 0.3s ease-out;
    pointer-events: none;
  }

  .offline-toast.online {
    background: #2d7d46;
  }

  .toast-icon {
    margin-right: 4px;
  }

  @keyframes slideUp {
    from {
      transform: translateX(-50%) translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
</style>
