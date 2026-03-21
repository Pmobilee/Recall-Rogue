<script lang="ts">
  interface Choice {
    label: string;
    description?: string;
  }

  interface Props {
    /** Prompt text shown above the choices. */
    prompt: string;
    /** Array of choices. Max 4. */
    choices: Choice[];
    /** Called with the index of the chosen option. */
    onChoose: (index: number) => void;
    /** Called if player dismisses (Escape / back button). Some callers may not allow dismiss. */
    onDismiss?: () => void;
    /** If true, no dismiss option is shown (player must pick). Default: false. */
    forcePick?: boolean;
  }

  let {
    prompt,
    choices,
    onChoose,
    onDismiss,
    forcePick = false,
  }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (!forcePick && e.target === e.currentTarget) {
      onDismiss?.();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!forcePick && e.key === 'Escape') {
      onDismiss?.();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="multi-choice-backdrop"
  onclick={handleBackdropClick}
  data-testid="multi-choice-popup"
  role="dialog"
  aria-modal="true"
  aria-label={prompt}
>
  <div class="multi-choice-card" tabindex="-1">
    <div class="prompt-row">
      <p class="prompt-text">{prompt}</p>
      {#if !forcePick}
        <button class="dismiss-btn" onclick={onDismiss} aria-label="Dismiss">✕</button>
      {/if}
    </div>

    <div class="choices-list">
      {#each choices.slice(0, 4) as choice, i}
        <button
          class="choice-btn"
          onclick={() => onChoose(i)}
          data-testid="multi-choice-option-{i}"
        >
          <span class="choice-label">{choice.label}</span>
          {#if choice.description}
            <span class="choice-description">{choice.description}</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- svelte:window for keyboard escape -->
<svelte:window onkeydown={handleKeydown} />

<style>
  .multi-choice-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .multi-choice-card {
    background: #12192e;
    border: 2px solid #1e3a6e;
    border-radius: 12px;
    padding: 20px 24px 24px;
    min-width: 280px;
    max-width: 380px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prompt-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .prompt-text {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #e0e0e0;
    text-align: center;
    line-height: 1.6;
    margin: 0;
    flex: 1;
    text-align: center;
  }

  .dismiss-btn {
    background: transparent;
    border: 1px solid #1e3a6e;
    color: #888;
    font-size: 14px;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.15s, border-color 0.15s;
  }

  .dismiss-btn:hover {
    color: #e0e0e0;
    border-color: #4a90d9;
  }

  .choices-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .choice-btn {
    min-height: 48px;
    width: 100%;
    background: #1a2a4a;
    border: 1px solid #1e3a6e;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    text-align: left;
    transition: background 0.12s, border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .choice-btn:hover,
  .choice-btn:focus-visible {
    background: #1e3a6e;
    border-color: #4a90d9;
    outline: none;
  }

  .choice-btn:active {
    background: #2a4a8a;
  }

  .choice-label {
    font-weight: bold;
    font-size: 12px;
    color: #e0e0e0;
  }

  .choice-description {
    font-size: 10px;
    color: #888;
    line-height: 1.4;
  }
</style>
