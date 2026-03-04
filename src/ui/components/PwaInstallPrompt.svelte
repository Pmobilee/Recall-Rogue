<script lang="ts">
  /** PWA "Add to Home Screen" prompt — shows after first dive on web (DD-V2-171) */

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null)
  let dismissed = $state(false)
  let show = $derived(deferredPrompt !== null && !dismissed)

  $effect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  })

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      console.log('[PWA] Install accepted')
    }
    deferredPrompt = null
  }

  function dismiss() {
    dismissed = true
    deferredPrompt = null
  }
</script>

{#if show}
  <div class="pwa-prompt">
    <div class="pwa-prompt-content">
      <span class="pwa-icon">📱</span>
      <div class="pwa-text">
        <strong>Install Terra Gacha</strong>
        <span>Play offline from your home screen</span>
      </div>
      <button class="pwa-install-btn" onclick={install}>Install</button>
      <button class="pwa-dismiss-btn" onclick={dismiss} aria-label="Dismiss install prompt">✕</button>
    </div>
  </div>
{/if}

<style>
  .pwa-prompt {
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
    z-index: 200;
    pointer-events: auto;
  }
  .pwa-prompt-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }
  .pwa-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  .pwa-text {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.125rem;
    font-size: 0.85rem;
    color: #e2e8f0;
  }
  .pwa-text strong {
    font-size: 0.95rem;
  }
  .pwa-text span {
    color: #94a3b8;
    font-size: 0.75rem;
  }
  .pwa-install-btn {
    padding: 0.5rem 1rem;
    background: #4fc3f7;
    color: #000;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    font-size: 0.85rem;
    cursor: pointer;
    flex-shrink: 0;
  }
  .pwa-dismiss-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
