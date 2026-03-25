<script lang="ts">
  interface Props {
    placeholder?: string;
    value: string;
    onsearchchange: (value: string) => void;
  }

  let { placeholder = 'Search...', value, onsearchchange: onchange }: Props = $props();

  let internalValue = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Sync external changes
  $effect(() => {
    internalValue = value;
  });

  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    internalValue = target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onchange(internalValue), 150);
  }

  function handleClear() {
    internalValue = '';
    clearTimeout(debounceTimer);
    onchange('');
  }
</script>

<div class="search-wrapper">
  <span class="search-icon">&#x1F50D;</span>
  <input
    type="text"
    value={internalValue}
    oninput={handleInput}
    {placeholder}
    class="search-input"
  />
  {#if internalValue}
    <button type="button" onclick={handleClear} class="clear-button">
      &#10005;
    </button>
  {/if}
</div>

<style scoped>
  .search-wrapper {
    display: flex;
    align-items: center;
    width: calc(240px * var(--layout-scale, 1));
    height: calc(34px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: 0 calc(10px * var(--layout-scale, 1));
    gap: calc(6px * var(--layout-scale, 1));
    transition: border-color 0.2s ease;
  }

  .search-wrapper:focus-within {
    border-color: rgba(99, 102, 241, 0.5);
  }

  .search-icon {
    font-size: calc(13px * var(--text-scale, 1));
    color: #64748b;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #e2e8f0;
    font-size: calc(13px * var(--text-scale, 1));
    font-family: inherit;
  }

  .search-input::placeholder {
    color: #4b5563;
  }

  .clear-button {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: calc(12px * var(--text-scale, 1));
    flex-shrink: 0;
    padding: 0;
    transition: color 0.2s ease;
  }

  .clear-button:hover {
    color: #e2e8f0;
  }
</style>
