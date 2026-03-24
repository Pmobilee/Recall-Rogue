<script lang="ts">
  import { getDomainMetadata } from '../../data/domainMetadata';
  import SubdomainChecklist from './SubdomainChecklist.svelte';

  interface Props {
    /** Domain IDs currently selected in the sidebar. */
    selectedDomains: string[];
    /** Per-domain subdomain selections. Empty array for a key = all selected. */
    subdomainSelections: Record<string, string[]>;
    /** Called when the user changes subdomains for a specific domain. */
    onSubdomainsChange: (domain: string, subdomains: string[]) => void;
  }

  let { selectedDomains, subdomainSelections, onSubdomainsChange }: Props = $props();

  /** Metadata for each selected domain. */
  const selectedMeta = $derived(
    selectedDomains.map((id) => {
      try {
        return getDomainMetadata(id as Parameters<typeof getDomainMetadata>[0]);
      } catch {
        return null;
      }
    }).filter((m): m is NonNullable<typeof m> => m !== null),
  );

  /** Summary counts for the footer. */
  const summary = $derived.by(() => {
    const domainCount = selectedDomains.length;
    const subCount = selectedDomains.reduce((acc, id) => {
      const subs = subdomainSelections[id];
      return acc + (subs && subs.length > 0 ? subs.length : 0);
    }, 0);
    return { domainCount, subCount };
  });
</script>

<div class="trivia-content">
  {#if selectedDomains.length === 0}
    <div class="empty-state">
      <p class="empty-title">No domains selected</p>
      <p class="empty-sub">Check at least one domain in the sidebar to choose subcategories.</p>
    </div>
  {:else}
    <div class="checklists-grid">
      {#each selectedMeta as meta (meta.id)}
        <SubdomainChecklist
          domain={meta.id}
          domainName={meta.displayName}
          domainColor={meta.colorTint}
          selectedSubdomains={subdomainSelections[meta.id] ?? []}
          {onSubdomainsChange}
        />
      {/each}
    </div>
  {/if}

  <!-- Footer summary -->
  <div class="summary-footer">
    {#if summary.domainCount === 0}
      <span class="summary-text">Select domains to begin</span>
    {:else if summary.subCount === 0}
      <span class="summary-text">
        {summary.domainCount} domain{summary.domainCount !== 1 ? 's' : ''} selected — all subcategories included
      </span>
    {:else}
      <span class="summary-text">
        {summary.domainCount} domain{summary.domainCount !== 1 ? 's' : ''} · {summary.subCount} filtered subcategories
      </span>
    {/if}
  </div>
</div>

<style>
  .trivia-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    gap: 0;
  }

  .checklists-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(280px * var(--layout-scale, 1)), 1fr));
    gap: calc(14px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    overflow-y: auto;
    align-content: start;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    color: #4b5563;
    padding: calc(40px * var(--layout-scale, 1));
  }

  .empty-title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .empty-sub {
    font-size: calc(13px * var(--text-scale, 1));
    color: #4b5563;
    text-align: center;
    margin: 0;
  }

  .summary-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .summary-text {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
  }
</style>
