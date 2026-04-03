<script lang="ts">
  type FilterOption = 'all' | 'in-progress' | 'not-started' | 'mastered';

  interface Props {
    activeFilter: FilterOption;
    onFilterChange: (filter: FilterOption) => void;
  }

  let { activeFilter, onFilterChange }: Props = $props();

  const FILTERS: Array<{ id: FilterOption; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'not-started', label: 'Not Started' },
    { id: 'mastered', label: 'Mastered' },
  ];
</script>

<div class="segmented-control">
  {#each FILTERS as filter}
    <button
      class="segment"
      class:active={activeFilter === filter.id}
      onclick={() => onFilterChange(filter.id)}
      type="button"
    >
      {filter.label}
    </button>
  {/each}
</div>

<style>
  .segmented-control {
    display: flex;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(6px * var(--layout-scale, 1));
    overflow: hidden;
    flex-shrink: 0;
  }

  .segment {
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    background: transparent;
    color: #64748b;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
    line-height: 1;
  }

  .segment:last-child {
    border-right: none;
  }

  .segment:hover:not(.active) {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.04);
  }

  .segment.active {
    background: rgba(99, 102, 241, 0.2);
    color: #c7d2fe;
  }
</style>
