<script lang="ts">
  /** All available fact categories. */
  const ALL_CATEGORIES = [
    'Natural Sciences',
    'Life Sciences',
    'Geography',
    'History',
    'Technology',
    'Culture',
    'Language',
    'Mathematics',
    'Social Sciences',
    'Arts',
  ]

  interface Props {
    /** Currently selected categories. */
    selected: string[]
    /** Called when selection changes. */
    onChange: (selected: string[]) => void
  }

  let { selected, onChange }: Props = $props()

  /** Toggle a category's selection state. */
  function toggle(cat: string): void {
    const next = selected.includes(cat)
      ? selected.filter(c => c !== cat)
      : [...selected, cat]
    onChange(next)
  }
</script>

<div class="category-picker" aria-label="Fact category picker">
  <div class="chip-grid">
    {#each ALL_CATEGORIES as cat (cat)}
      <button
        class="category-chip"
        class:selected={selected.includes(cat)}
        type="button"
        data-testid="category-chip-{cat}"
        aria-pressed={selected.includes(cat)}
        onclick={() => toggle(cat)}
      >
        {cat}
      </button>
    {/each}
  </div>
  {#if selected.length === 0}
    <p class="picker-hint">Select at least one category.</p>
  {/if}
</div>

<style>
  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .category-chip {
    padding: 6px 14px;
    border: 2px solid var(--color-border);
    border-radius: 20px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .category-chip:hover {
    border-color: var(--color-primary-light);
    color: var(--color-primary);
  }

  .category-chip.selected {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .picker-hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 6px;
  }
</style>
