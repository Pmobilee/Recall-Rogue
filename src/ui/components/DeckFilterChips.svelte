<script lang="ts">
  type FilterOption = 'in-progress' | 'not-started' | 'mastered';

  interface Props {
    activeFilters: FilterOption[];
    onFiltersChange: (filters: FilterOption[]) => void;
  }

  let { activeFilters, onFiltersChange }: Props = $props();

  const FILTERS: Array<{ id: FilterOption; label: string }> = [
    { id: 'in-progress', label: 'In Progress' },
    { id: 'not-started', label: 'Not Started' },
    { id: 'mastered', label: 'Mastered' },
  ];

  function toggle(id: FilterOption) {
    if (activeFilters.includes(id)) {
      onFiltersChange(activeFilters.filter(f => f !== id));
    } else {
      onFiltersChange([...activeFilters, id]);
    }
  }
</script>

<div class="filter-chips">
  {#each FILTERS as filter}
    <button
      class="chip"
      class:active={activeFilters.includes(filter.id)}
      onclick={() => toggle(filter.id)}
      type="button"
    >
      {filter.label}
    </button>
  {/each}
</div>

<style>
  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .chip {
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #64748b;
    outline: none;
    line-height: 1;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .chip.active {
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.5);
    color: #c7d2fe;
  }

  .chip.active:hover {
    background: rgba(99, 102, 241, 0.28);
    color: #c7d2fe;
  }
</style>
