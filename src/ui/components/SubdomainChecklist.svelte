<script lang="ts">
  import { getDomainSubcategories } from '../../services/domainSubcategoryService';
  import type { FactDomain } from '../../data/card-types';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    /** Domain ID to show subcategories for. */
    domain: string;
    /** Display name of the domain. */
    domainName: string;
    /** Accent color for the domain. */
    domainColor: string;
    /**
     * Currently selected subcategory IDs. Empty array means "all selected".
     * We store this as an explicit "none selected = all" contract.
     */
    selectedSubdomains: string[];
    /** Called when user changes the subdomain selection. */
    onSubdomainsChange: (domain: string, subdomains: string[]) => void;
  }

  let { domain, domainName, domainColor, selectedSubdomains, onSubdomainsChange }: Props = $props();

  /** Loaded subcategories for this domain. */
  const subcategories = $derived(getDomainSubcategories(domain as FactDomain));

  /**
   * True when the selection covers all subcategories (or is empty, which means all).
   */
  const allSelected = $derived(
    selectedSubdomains.length === 0 ||
    subcategories.every((s) => selectedSubdomains.includes(s.id)),
  );

  /** Whether a given subdomain ID is checked. */
  function isChecked(id: string): boolean {
    // Empty = all selected
    if (selectedSubdomains.length === 0) return true;
    return selectedSubdomains.includes(id);
  }

  /** Toggle all subcategories. */
  function toggleAll(): void {
    playCardAudio('toggle-on');
    // Toggle all → empty means "all selected", so clear if currently all.
    if (allSelected) {
      // Deselect all (keeps one to avoid empty state: pass empty to mean "all")
      onSubdomainsChange(domain, []);
    } else {
      onSubdomainsChange(domain, []);
    }
  }

  /** Toggle a single subcategory. */
  function toggleSub(id: string): void {
    playCardAudio('toggle-on');
    let next: string[];
    if (selectedSubdomains.length === 0) {
      // Currently all-selected; deselect everything except this one
      next = subcategories.filter((s) => s.id !== id).map((s) => s.id);
    } else if (selectedSubdomains.includes(id)) {
      next = selectedSubdomains.filter((s) => s !== id);
      // If we'd deselect the last one, treat as "all selected" again
      if (next.length === 0) next = [];
    } else {
      next = [...selectedSubdomains, id];
      // If everything is now selected, normalize to empty (= all)
      if (next.length === subcategories.length) next = [];
    }
    onSubdomainsChange(domain, next);
  }
</script>

<div class="subdomain-checklist" style="--domain-color: {domainColor}">
  <!-- Domain header -->
  <div class="domain-header">
    <span class="domain-label" style="color: {domainColor}">{domainName}</span>
    <label class="all-toggle">
      <input
        type="checkbox"
        checked={allSelected}
        onchange={toggleAll}
      />
      <span>All</span>
    </label>
  </div>

  <!-- Subcategory list -->
  {#if subcategories.length === 0}
    <p class="empty-note">No subcategories found.</p>
  {:else}
    <ul class="sub-list">
      {#each subcategories as sub (sub.id)}
        <li>
          <label class="sub-item">
            <input
              type="checkbox"
              checked={isChecked(sub.id)}
              onchange={() => toggleSub(sub.id)}
            />
            <span class="sub-name">{sub.name}</span>
            <span class="sub-count">{sub.count}</span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .subdomain-checklist {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: calc(10px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .domain-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .domain-label {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .all-toggle {
    display: flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #94a3b8;
    cursor: pointer;
  }

  .all-toggle input {
    accent-color: var(--domain-color, #6366f1);
    width: calc(14px * var(--layout-scale, 1));
    height: calc(14px * var(--layout-scale, 1));
    cursor: pointer;
  }

  .sub-list {
    list-style: none;
    margin: 0;
    padding: calc(6px * var(--layout-scale, 1)) 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sub-item {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    transition: background 0.1s;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .sub-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .sub-item input[type='checkbox'] {
    accent-color: var(--domain-color, #6366f1);
    width: calc(13px * var(--layout-scale, 1));
    height: calc(13px * var(--layout-scale, 1));
    cursor: pointer;
    flex-shrink: 0;
  }

  .sub-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    flex-shrink: 0;
  }

  .empty-note {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    margin: 0;
  }
</style>
