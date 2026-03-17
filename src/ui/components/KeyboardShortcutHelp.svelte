<script lang="ts">
  /**
   * KeyboardShortcutHelp.svelte — Modal overlay listing all keyboard shortcuts.
   *
   * AR-74: Input System Overhaul
   *
   * Toggle with the '?' key (landscape only). Dismisses with '?' again or Escape.
   * Only renders in landscape mode.
   */
  import { onMount, onDestroy } from 'svelte'
  import { isLandscape } from '../../stores/layoutStore'
  import { inputService } from '../../services/inputService'

  let visible = $state(false)

  function show(): void { visible = true }
  function hide(): void { visible = false }
  function toggle(): void { visible = !visible }

  let unsubToggle: (() => void) | null = null
  let unsubCancel: (() => void) | null = null

  onMount(() => {
    unsubToggle = inputService.on('TOGGLE_KEYBOARD_HELP', toggle)
    unsubCancel = inputService.on('CANCEL', () => { if (visible) hide() })
  })

  onDestroy(() => {
    unsubToggle?.()
    unsubCancel?.()
  })

  function handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('overlay-backdrop')) hide()
  }
</script>

{#if visible && $isLandscape}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="overlay-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
    tabindex="-1"
    onclick={handleBackdropClick}
  >
    <div class="overlay-card" role="document">
      <div class="overlay-header">
        <h2 class="overlay-title">Keyboard Shortcuts</h2>
        <button class="close-btn" onclick={hide} type="button" aria-label="Close">✕</button>
      </div>

      <div class="sections-grid">
        <!-- Combat section -->
        <section class="shortcut-section">
          <h3 class="section-title">Combat</h3>
          <div class="shortcut-rows">
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>1</kbd>–<kbd>5</kbd></span>
              <span class="label-cell">Select card from hand</span>
            </div>
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>Q</kbd></span>
              <span class="label-cell">Quick Play (no quiz)</span>
            </div>
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>E</kbd></span>
              <span class="label-cell">Charge Play (quiz for bonus AP)</span>
            </div>
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>Enter</kbd></span>
              <span class="label-cell">End Turn</span>
            </div>
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>Tab</kbd></span>
              <span class="label-cell">Toggle deck / discard view</span>
            </div>
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>Esc</kbd></span>
              <span class="label-cell">Deselect card / cancel</span>
            </div>
          </div>
        </section>

        <!-- Quiz section -->
        <section class="shortcut-section">
          <h3 class="section-title">Quiz</h3>
          <div class="shortcut-rows">
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>1</kbd>–<kbd>4</kbd></span>
              <span class="label-cell">Select answer choice</span>
            </div>
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>Space</kbd></span>
              <span class="label-cell">Confirm / continue</span>
            </div>
          </div>
        </section>

        <!-- Navigation section -->
        <section class="shortcut-section">
          <h3 class="section-title">Navigation</h3>
          <div class="shortcut-rows">
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>Esc</kbd></span>
              <span class="label-cell">Go back / close modal</span>
            </div>
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>Space</kbd></span>
              <span class="label-cell">Skip animation</span>
            </div>
          </div>
        </section>

        <!-- General section -->
        <section class="shortcut-section">
          <h3 class="section-title">General</h3>
          <div class="shortcut-rows">
            <div class="shortcut-row">
              <span class="keys-cell"><kbd>?</kbd></span>
              <span class="label-cell">Open / close this overlay</span>
            </div>
          </div>
        </section>
      </div>

      <p class="footer-note">
        All actions are also clickable — keyboard shortcuts are optional acceleration.
      </p>
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    pointer-events: auto;
    padding: 1.5rem;
    animation: backdrop-in 180ms ease-out;
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .overlay-card {
    background: var(--color-surface, #1a1a2e);
    border: 2px solid var(--color-primary, #4ecdc4);
    border-radius: 16px;
    padding: 1.5rem 2rem;
    width: min(640px, 100%);
    max-height: 80vh;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    color: var(--color-text, #e0e0e0);
    animation: panel-in 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  @keyframes panel-in {
    from { transform: scale(0.95); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(78, 205, 196, 0.2);
  }

  .overlay-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-primary, #4ecdc4);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: 1px solid var(--color-text-dim, #888);
    color: var(--color-text-dim, #888);
    font-size: 1rem;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: color 120ms, border-color 120ms;
  }

  .close-btn:hover {
    color: var(--color-text, #e0e0e0);
    border-color: var(--color-text, #e0e0e0);
  }

  .sections-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  .shortcut-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-warning, #ffd369);
    margin: 0 0 0.25rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(255, 211, 105, 0.2);
  }

  .shortcut-rows {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .keys-cell {
    flex-shrink: 0;
    min-width: 5rem;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-wrap: wrap;
  }

  kbd {
    display: inline-block;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-bottom-width: 2px;
    border-radius: 4px;
    padding: 1px 6px;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    color: var(--color-text, #e0e0e0);
    line-height: 1.4;
  }

  .label-cell {
    font-size: 0.8rem;
    color: var(--color-text-dim, #aaa);
    line-height: 1.3;
  }

  .footer-note {
    margin-top: 1.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(78, 205, 196, 0.15);
    font-size: 0.7rem;
    color: var(--color-text-dim, #888);
    text-align: center;
    font-style: italic;
  }
</style>
