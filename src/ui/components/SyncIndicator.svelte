<script lang="ts">
  /**
   * SyncIndicator — compact HUD widget showing cloud-sync state.
   *
   * States:
   *   idle    — grey cloud, no animation
   *   syncing — blue cloud with CSS spin animation
   *   error   — red cloud with "!" badge; auto-dismisses to idle after 5 s
   */

  import { syncStatus, type SyncState } from '../stores/syncStore'

  /** Current sync state, driven by the shared store. */
  let state = $state<SyncState>('idle')

  /** Timer reference used to auto-dismiss the error state. */
  let errorTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const unsub = syncStatus.subscribe((s) => {
      state = s

      // Clear any existing auto-dismiss timer
      if (errorTimer !== null) {
        clearTimeout(errorTimer)
        errorTimer = null
      }

      // Auto-dismiss error back to idle after 5 seconds
      if (s === 'error') {
        errorTimer = setTimeout(() => {
          syncStatus.set('idle')
          errorTimer = null
        }, 5000)
      }
    })

    return () => {
      unsub()
      if (errorTimer !== null) {
        clearTimeout(errorTimer)
      }
    }
  })

  /** Human-readable label used for aria-label. */
  const label = $derived(
    state === 'syncing'
      ? 'Syncing to cloud…'
      : state === 'error'
        ? 'Sync failed'
        : 'Cloud save up to date',
  )
</script>

<div
  class="sync-indicator"
  class:sync-indicator--syncing={state === 'syncing'}
  class:sync-indicator--error={state === 'error'}
  aria-label={label}
  title={label}
  role="status"
  aria-live="polite"
>
  <!-- Cloud icon constructed entirely with CSS — no external assets required. -->
  <div class="cloud-icon" aria-hidden="true">
    <div class="cloud-body"></div>
    <div class="cloud-bump cloud-bump--left"></div>
    <div class="cloud-bump cloud-bump--right"></div>
    {#if state === 'error'}
      <div class="error-badge">!</div>
    {/if}
    {#if state === 'syncing'}
      <div class="sync-arc"></div>
    {/if}
  </div>
</div>

<style>
  /* ---- Container ---- */
  .sync-indicator {
    position: fixed;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Don't capture pointer events; purely informational */
    pointer-events: none;
  }

  /* ---- Cloud icon ---- */
  .cloud-icon {
    position: relative;
    width: 20px;
    height: 14px;
  }

  .cloud-body {
    position: absolute;
    bottom: 0;
    left: 2px;
    width: 16px;
    height: 9px;
    border-radius: 4px 4px 3px 3px;
    background: #9ca3af; /* grey — idle default */
    transition: background 0.3s ease;
  }

  .cloud-bump {
    position: absolute;
    border-radius: 50%;
    background: #9ca3af;
    transition: background 0.3s ease;
  }

  .cloud-bump--left {
    width: 9px;
    height: 9px;
    bottom: 5px;
    left: 3px;
  }

  .cloud-bump--right {
    width: 7px;
    height: 7px;
    bottom: 6px;
    right: 3px;
  }

  /* ---- Syncing state: blue + spinning arc ---- */
  .sync-indicator--syncing .cloud-body,
  .sync-indicator--syncing .cloud-bump {
    background: #3b82f6;
  }

  .sync-arc {
    position: absolute;
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 10px;
    height: 10px;
    border: 2px solid transparent;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: sync-spin 0.9s linear infinite;
  }

  @keyframes sync-spin {
    to { transform: translateX(-50%) rotate(360deg); }
  }

  /* ---- Error state: red + badge ---- */
  .sync-indicator--error .cloud-body,
  .sync-indicator--error .cloud-bump {
    background: #ef4444;
  }

  .error-badge {
    position: absolute;
    top: -5px;
    right: -3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
    border: 1px solid #fff;
    color: #fff;
    font-size: 7px;
    font-weight: 900;
    font-family: monospace;
    line-height: 10px;
    text-align: center;
  }
</style>
