<script lang="ts">
  import { getKnowledgeDomains, getDomainMetadata } from '../../data/domainMetadata';
  import { getAllDecks } from '../../data/deckRegistry';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    /** Current run mode controls sidebar behavior. */
    mode: 'trivia' | 'study';
    /** Trivia mode: selected domain IDs. */
    selectedDomains: string[];
    /** Trivia mode: called when domain multi-selection changes. */
    onDomainsChange: (domains: string[]) => void;
    /** Study mode: active domain (null = "All"). */
    activeDomain: string | null;
    /** Study mode: called when a domain row is clicked. */
    onDomainSelect: (domain: string | null) => void;
  }

  let { mode, selectedDomains, onDomainsChange, activeDomain, onDomainSelect }: Props = $props();

  /** All knowledge domains (no language). */
  const knowledgeDomains = getKnowledgeDomains().map((id) => getDomainMetadata(id));

  /** Set of domain IDs that have at least one 'available' deck. */
  const domainsWithDecks = $derived.by(() => {
    const decks = getAllDecks();
    const domains = new Set(decks.filter((d) => d.status === 'available').map((d) => d.domain));
    return domains;
  });

  /** All domains available in the sidebar for study mode — only those with available decks. */
  const studyDomains = $derived(
    mode === 'study'
      ? [
          ...knowledgeDomains.filter((d) => domainsWithDecks.has(d.id)),
          ...(domainsWithDecks.has('vocabulary')
            ? [
                {
                  id: 'vocabulary' as const,
                  displayName: 'Vocabulary',
                  shortName: 'Vocab',
                  colorTint: '#34D399',
                  icon: '🗣️',
                  description: 'Language vocabulary decks.',
                },
              ]
            : []),
        ]
      : knowledgeDomains,
  );

  /** Whether all trivia domains are selected. */
  const allSelected = $derived(
    knowledgeDomains.every((d) => selectedDomains.includes(d.id)),
  );

  /** Toggle all domains on/off in trivia mode. */
  function toggleAll(): void {
    playCardAudio('toggle-on');
    if (allSelected) {
      onDomainsChange([]);
    } else {
      onDomainsChange(knowledgeDomains.map((d) => d.id));
    }
  }

  /** Toggle a single domain in trivia mode. */
  function toggleDomain(id: string): void {
    playCardAudio('toggle-on');
    if (selectedDomains.includes(id)) {
      onDomainsChange(selectedDomains.filter((d) => d !== id));
    } else {
      onDomainsChange([...selectedDomains, id]);
    }
  }

  /** Select a domain in study mode. */
  function selectDomain(id: string | null): void {
    playCardAudio('tab-switch');
    onDomainSelect(id);
  }
</script>

<aside class="domain-sidebar">
  <!-- Trivia mode: "All" toggle checkbox -->
  {#if mode === 'trivia'}
    <label class="domain-row all-row">
      <input
        type="checkbox"
        class="domain-checkbox"
        checked={allSelected}
        onchange={toggleAll}
      />
      <span class="domain-icon">🌐</span>
      <span class="domain-name">All Topics</span>
    </label>
    <div class="divider"></div>
    {#each knowledgeDomains as domain (domain.id)}
      <label class="domain-row" style="--domain-color: {domain.colorTint}">
        <input
          type="checkbox"
          class="domain-checkbox"
          checked={selectedDomains.includes(domain.id)}
          onchange={() => toggleDomain(domain.id)}
        />
        <span class="domain-icon">{domain.icon}</span>
        <span class="domain-name">{domain.shortName}</span>
      </label>
    {/each}
  {:else if mode === 'study'}
    {#if studyDomains.length === 0}
      <!-- No decks available at all — sidebar shows nothing useful -->
      <div class="empty-sidebar">
        <span class="empty-sidebar-text">No decks yet</span>
      </div>
    {:else}
      <!-- Study mode: "All" single-select -->
      <button
        class="domain-row study-row"
        class:active={activeDomain === null}
        onclick={() => selectDomain(null)}
      >
        <span class="domain-icon">🌐</span>
        <span class="domain-name">All</span>
      </button>
      <div class="divider"></div>
      {#each studyDomains as domain (domain.id)}
        <button
          class="domain-row study-row"
          class:active={activeDomain === domain.id}
          style="--domain-color: {domain.colorTint}"
          onclick={() => selectDomain(domain.id)}
        >
          <span class="domain-icon">{domain.icon}</span>
          <span class="domain-name">{domain.shortName}</span>
        </button>
      {/each}
    {/if}
  {/if}
</aside>

<style>
  .domain-sidebar {
    width: calc(200px * var(--layout-scale, 1));
    min-width: calc(160px * var(--layout-scale, 1));
    flex-shrink: 0;
    background: rgba(15, 20, 40, 0.6);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    overflow-y: auto;
    padding: calc(8px * var(--layout-scale, 1)) 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .domain-row {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(9px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    cursor: pointer;
    color: #94a3b8;
    transition: background 0.12s, color 0.12s;
    font-size: calc(13px * var(--text-scale, 1));
    border: none;
    background: transparent;
    text-align: left;
    width: 100%;
  }

  .domain-row:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
  }

  .study-row.active {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    border-left: calc(3px * var(--layout-scale, 1)) solid var(--domain-color, #6366f1);
    padding-left: calc(9px * var(--layout-scale, 1));
  }

  .study-row.active:not([style*='--domain-color']) {
    border-left-color: #6366f1;
  }

  .domain-checkbox {
    width: calc(15px * var(--layout-scale, 1));
    height: calc(15px * var(--layout-scale, 1));
    accent-color: #6366f1;
    cursor: pointer;
    flex-shrink: 0;
  }

  .domain-icon {
    font-size: calc(16px * var(--text-scale, 1));
    flex-shrink: 0;
    line-height: 1;
  }

  .domain-name {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .empty-sidebar {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .empty-sidebar-text {
    font-size: calc(11px * var(--text-scale, 1));
    color: #374151;
    text-align: center;
  }
</style>
