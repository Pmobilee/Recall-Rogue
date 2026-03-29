<script lang="ts">
  import { getDomainSubcategories } from '../../services/domainSubcategoryService';
  import { getDomainMetadata } from '../../data/domainMetadata';
  import SubcategoryChip from './SubcategoryChip.svelte';
  import type { FactDomain } from '../../data/card-types';

  interface Props {
    domainId: string;
    /** Which subcategories are currently filtered (empty = all included). */
    selectedSubcategories: string[];
    /** Called when the user toggles subcategories. Empty array = all. */
    onSubcategoriesChange: (domainId: string, subcategories: string[]) => void;
  }

  let { domainId, selectedSubcategories, onSubcategoriesChange }: Props = $props();

  let isExpanded = $state(true);

  const meta = $derived(getDomainMetadata(domainId as FactDomain));
  const subcategories = $derived(getDomainSubcategories(domainId as FactDomain));
  const totalFacts = $derived(subcategories.reduce((sum, s) => sum + s.count, 0));

  /** A chip is selected when: all included (empty) OR this sub's id is in the selected list. */
  function isChipSelected(subId: string): boolean {
    return selectedSubcategories.length === 0 || selectedSubcategories.includes(subId);
  }

  function toggleSubcategory(subId: string) {
    const allIds = subcategories.map((s) => s.id);

    if (selectedSubcategories.length === 0) {
      // Currently "all" — deselect this one (keep everything else)
      onSubcategoriesChange(domainId, allIds.filter((id) => id !== subId));
    } else if (selectedSubcategories.includes(subId)) {
      const next = selectedSubcategories.filter((id) => id !== subId);
      // If removing leaves nothing, revert to "all" (empty = all)
      onSubcategoriesChange(domainId, next.length === 0 ? [] : next);
    } else {
      const next = [...selectedSubcategories, subId];
      // If all are now selected, normalise back to empty (= all)
      onSubcategoriesChange(domainId, next.length === allIds.length ? [] : next);
    }
  }

  const footerText = $derived(() => {
    const count = subcategories.length;
    const baseText = `${count} subcategor${count === 1 ? 'y' : 'ies'}`;
    if (selectedSubcategories.length === 0) {
      return `${baseText} · all included`;
    }
    return `${baseText} · ${selectedSubcategories.length} filtered`;
  });
</script>

<div class="loadout-card" style="--color-tint: {meta.colorTint};">

  <!-- Header -->
  <div class="card-header">
    <span class="domain-icon">{meta.icon}</span>
    <span class="domain-name">{meta.displayName}</span>
    {#if totalFacts > 0}
      <span class="fact-count">{totalFacts} facts</span>
    {/if}
    {#if subcategories.length > 0}
      <button class="expand-toggle" onclick={() => isExpanded = !isExpanded} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
        {isExpanded ? '▾' : '▸'}
      </button>
    {/if}
  </div>

  <!-- Body: chips or empty-state note -->
  {#if subcategories.length === 0}
    <p class="empty-note">
      {meta.displayName} — all facts included (no subcategory breakdown available)
    </p>
  {:else if isExpanded}
    <div class="chip-area">
      {#each subcategories as sub (sub.id)}
        <SubcategoryChip
          label={sub.name}
          count={sub.count}
          isSelected={isChipSelected(sub.id)}
          colorTint={meta.colorTint}
          ontoggle={() => toggleSubcategory(sub.id)}
        />
      {/each}
    </div>

    <!-- Footer -->
    <div class="card-footer">
      {footerText()}
    </div>
  {/if}

</div>

<style>
  .loadout-card {
    border-radius: calc(10px * var(--layout-scale, 1));
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  /* ---- Header ---- */
  .card-header {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: color-mix(in srgb, var(--color-tint) 8%, transparent);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .domain-icon {
    font-size: calc(18px * var(--text-scale, 1));
    line-height: 1;
  }

  .domain-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    color: var(--color-tint);
  }

  .fact-count {
    margin-left: auto;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 500;
    color: #4b5563;
  }

  .expand-toggle {
    background: none;
    border: none;
    color: #64748b;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(4px * var(--layout-scale, 1));
    line-height: 1;
    transition: color 0.15s;
  }

  .expand-toggle:hover {
    color: #94a3b8;
  }

  /* ---- Chip area ---- */
  .chip-area {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
  }

  /* ---- Footer ---- */
  .card-footer {
    padding: calc(8px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-size: calc(11px * var(--text-scale, 1));
    color: #4b5563;
  }

  /* ---- Empty state ---- */
  .empty-note {
    padding: calc(16px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #4b5563;
    margin: 0;
  }
</style>
