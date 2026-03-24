<script lang="ts">
  import { getLanguageConfig } from '../types/vocabulary'
  import { deckOptions, setDeckOption } from '../services/deckOptionsService'
  import type { LanguageDeckOption } from '../types/vocabulary'

  interface Props {
    languageCode: string
  }

  const { languageCode }: Props = $props()

  const languageConfig = $derived(getLanguageConfig(languageCode))
  const options = $derived(languageConfig?.options ?? [])

  // Early return if no options available
  const hasOptions = $derived(options.length > 0)

  // Reactive map of option values - updates whenever deckOptions store changes
  const optionValues = $derived.by(() => {
    const current = $deckOptions
    const result: Record<string, boolean> = {}
    for (const opt of options) {
      result[opt.id] = current?.[languageCode]?.[opt.id] ?? opt.default
    }
    return result
  })

  /**
   * Handle toggle change for a deck option
   */
  function handleToggle(optionId: string, newValue: boolean): void {
    setDeckOption(languageCode, optionId, newValue)
  }
</script>

{#if hasOptions}
  <div class="options-panel">
    <h3 class="options-header">Display Options</h3>

    <div class="options-list">
      {#each options as option (option.id)}
        <div class="option-item">
          <div class="option-content">
            <label class="option-label" for={`toggle-${option.id}`}>
              {option.label}
            </label>
            <p class="option-description">{option.description}</p>
          </div>

          <button
            id={`toggle-${option.id}`}
            class="toggle"
            class:active={optionValues[option.id]}
            onclick={() => handleToggle(option.id, !optionValues[option.id])}
            aria-label={`Toggle ${option.label}`}
            aria-pressed={optionValues[option.id]}
            type="button"
          ></button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .options-panel {
    padding: calc(16px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    background: var(--color-surface, #0f3460);
    border: 1px solid var(--color-border, #1a4d7a);
  }

  .options-header {
    font-family: 'Press Start 2P', monospace;
    font-size: calc(12px * var(--text-scale, 1));
    color: #e94560;
    margin: 0 0 calc(16px * var(--layout-scale, 1)) 0;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .option-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    background: var(--color-surface-dim, #1a4d7a);
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid var(--color-border, #2a5e8a);
  }

  .option-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .option-label {
    color: var(--color-text-primary, #e0e0e0);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: bold;
    cursor: pointer;
  }

  .option-description {
    color: var(--color-text-muted, #888);
    font-size: calc(11px * var(--text-scale, 1));
    margin: 0;
    line-height: 1.4;
  }

  /* Toggle switch styling */
  .toggle {
    position: relative;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(24px * var(--layout-scale, 1));
    background: var(--color-surface-dim, #0a2340);
    border-radius: calc(12px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.2s ease;
    border: none;
    padding: 0;
    flex-shrink: 0;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .toggle:hover {
    background: var(--color-surface-dim-hover, #1a3450);
  }

  .toggle.active {
    background: var(--color-accent, #4a9eff);
  }

  .toggle.active:hover {
    background: var(--color-accent-hover, #5aacff);
  }

  .toggle::after {
    content: '';
    position: absolute;
    top: calc(2px * var(--layout-scale, 1));
    left: calc(2px * var(--layout-scale, 1));
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    background: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle.active::after {
    transform: translateX(calc(20px * var(--layout-scale, 1)));
  }

  /* Focus style for accessibility */
  .toggle:focus-visible {
    outline: 2px solid var(--color-accent, #4a9eff);
    outline-offset: 2px;
  }
</style>
