<script lang="ts">
  type SortOption = 'alpha' | 'progress-high' | 'progress-low' | 'facts' | 'newest';

  interface Props {
    value: SortOption;
    onsortchange: (value: SortOption) => void;
  }

  let { value, onsortchange }: Props = $props();

  function handleChange(e: Event) {
    onsortchange((e.currentTarget as HTMLSelectElement).value as SortOption);
  }
</script>

<div class="sort-wrapper">
  <select
    value={value}
    onchange={handleChange}
    class="sort-select"
  >
    <option value="alpha">A-Z</option>
    <option value="progress-high">Progress (High)</option>
    <option value="progress-low">Progress (Low)</option>
    <option value="facts">Most Facts</option>
    <option value="newest">Newest</option>
  </select>
</div>

<style>
  .sort-wrapper {
    position: relative;
    display: inline-block;
  }

  .sort-wrapper::after {
    content: '';
    position: absolute;
    right: calc(8px * var(--layout-scale, 1));
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: calc(4px * var(--layout-scale, 1)) solid transparent;
    border-right: calc(4px * var(--layout-scale, 1)) solid transparent;
    border-top: calc(5px * var(--layout-scale, 1)) solid #8b949e;
    pointer-events: none;
  }

  .sort-select {
    height: calc(32px * var(--layout-scale, 1));
    padding: 0 calc(24px * var(--layout-scale, 1)) 0 calc(10px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #8b949e;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    transition: border-color 0.15s;
  }

  .sort-select:focus {
    border-color: rgba(99, 102, 241, 0.5);
  }

  .sort-select option {
    background: #1a1f2e;
    color: #8b949e;
  }
</style>
