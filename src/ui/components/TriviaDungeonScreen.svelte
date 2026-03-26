<script lang="ts">
  import { onMount } from 'svelte';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getKnowledgeDomains } from '../../data/domainMetadata';
  import { playerSave, persistPlayer } from '../stores/playerData';
  import DomainStrip from './DomainStrip.svelte';
  import LoadoutCard from './LoadoutCard.svelte';

  interface Props {
    onback: () => void;
    onStartRun: (config: { mode: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }) => void;
  }

  const { onback, onStartRun }: Props = $props();

  // State
  let selectedDomains = $state<string[]>(getKnowledgeDomains());
  let subdomainSelections = $state<Record<string, string[]>>({});
  let searchQuery = $state('');

  // Derived
  const canStart = $derived(selectedDomains.length > 0);

  // Restore from save on mount
  onMount(() => {
    playCardAudio('modal-open');
    const save = $playerSave;
    if (save?.lastDungeonSelection?.triviaConfig) {
      const tc = save.lastDungeonSelection.triviaConfig;
      selectedDomains = tc.domains;
      subdomainSelections = tc.subdomains ?? {};
    }
  });

  function handleBack() {
    playCardAudio('tab-switch');
    onback();
  }

  function handleDomainsChange(domains: string[]) {
    selectedDomains = domains;
    // Remove subdomains for deselected domains
    const next: Record<string, string[]> = {};
    for (const d of domains) {
      if (subdomainSelections[d]) next[d] = subdomainSelections[d];
    }
    subdomainSelections = next;
    persistTriviaSelection();
  }

  function handleSubcategoriesChange(domainId: string, subcategories: string[]) {
    subdomainSelections = { ...subdomainSelections, [domainId]: subcategories };
    // Remove empty entries
    if (subcategories.length === 0) {
      const { [domainId]: _, ...rest } = subdomainSelections;
      subdomainSelections = rest;
    }
    persistTriviaSelection();
  }

  function persistTriviaSelection() {
    playerSave.update(s => s ? {
      ...s,
      lastDungeonSelection: {
        ...s.lastDungeonSelection,
        mode: 'trivia' as const,
        triviaConfig: {
          domains: selectedDomains,
          subdomains: Object.keys(subdomainSelections).length > 0 ? subdomainSelections : {},
        },
      },
    } : s);
    persistPlayer();
  }

  function handleStartRun() {
    if (!canStart) return;
    playCardAudio('run-start');
    onStartRun({
      mode: 'trivia',
      domains: selectedDomains,
      subdomains: Object.keys(subdomainSelections).length > 0 ? subdomainSelections : undefined,
    });
  }
</script>

<div class="trivia-dungeon-screen">
  <!-- Header -->
  <header class="header">
    <div class="header-grid">
      <div class="header-left">
        <button class="back-btn" onclick={handleBack}>&larr; Back</button>
      </div>
      <div class="header-title">THE ARMORY</div>
      <div class="header-right">
        <input class="search-input" type="text" placeholder="Search domains..."
               bind:value={searchQuery} aria-label="Search domains" />
        <button class="start-run-btn" class:enabled={canStart}
                disabled={!canStart} onclick={handleStartRun}>
          Start Run &#9654;
        </button>
      </div>
    </div>
  </header>

  <!-- Domain Strip -->
  <DomainStrip {selectedDomains} onDomainsChange={handleDomainsChange} />

  <!-- Loadout Cards Grid -->
  <div class="loadout-grid">
    {#if selectedDomains.length === 0}
      <div class="empty-state">
        <p class="empty-title">No domains selected</p>
        <p class="empty-sub">Toggle domains above to build your knowledge loadout</p>
      </div>
    {:else}
      {#each selectedDomains as domainId (domainId)}
        <LoadoutCard
          {domainId}
          selectedSubcategories={subdomainSelections[domainId] ?? []}
          onSubcategoriesChange={handleSubcategoriesChange}
        />
      {/each}
    {/if}
  </div>

  <!-- Footer Status Bar -->
  <footer class="footer">
    <span class="footer-text">
      {selectedDomains.length} domain{selectedDomains.length !== 1 ? 's' : ''} selected
    </span>
    <button class="footer-start-btn" class:enabled={canStart}
            disabled={!canStart} onclick={handleStartRun}>
      Start Run &#9654;
    </button>
  </footer>
</div>

<style>
  .trivia-dungeon-screen {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: linear-gradient(160deg, #0d1117 0%, #1a2332 50%, #0d1117 100%);
    display: flex;
    flex-direction: column;
    color: #e0e0e0;
  }

  /* ── Header ── */
  .header {
    background: linear-gradient(180deg, rgba(13, 17, 23, 0.98) 0%, rgba(26, 35, 50, 0.92) 100%);
    border-bottom: 1px solid rgba(245, 158, 11, 0.15);
    padding: calc(12px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .header-grid {
    display: grid;
    grid-template-columns: 1fr auto auto 1fr;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .back-btn {
    background: none;
    border: none;
    color: #8b949e;
    cursor: pointer;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    transition: color 0.15s ease;
    white-space: nowrap;
  }

  .back-btn:hover {
    color: #e0e0e0;
  }

  .header-title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #f59e0b;
    white-space: nowrap;
    text-align: center;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    grid-column: 3 / 5;
    justify-content: flex-end;
  }

  .search-input {
    width: calc(200px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(13px * var(--text-scale, 1));
    padding: 0 calc(12px * var(--layout-scale, 1));
    outline: none;
    transition: border-color 0.15s ease;
  }

  .search-input::placeholder {
    color: #6b7280;
  }

  .search-input:focus {
    border-color: rgba(255, 255, 255, 0.25);
  }

  .start-run-btn {
    height: calc(38px * var(--layout-scale, 1));
    padding: 0 calc(18px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #16a34a, #15803d);
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #fff;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    white-space: nowrap;
    cursor: not-allowed;
    opacity: 0.45;
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
  }

  .start-run-btn.enabled {
    cursor: pointer;
    opacity: 1;
  }

  .start-run-btn.enabled:hover {
    transform: scale(1.03);
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(22, 163, 74, 0.4);
  }

  /* ── Loadout Grid ── */
  .loadout-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(300px * var(--layout-scale, 1)), 1fr));
    grid-auto-rows: 1fr;
    gap: calc(14px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    overflow-y: auto;
    align-content: start;
  }

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(60px * var(--layout-scale, 1));
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
    margin: 0;
  }

  /* ── Footer ── */
  .footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-top: 1px solid rgba(245, 158, 11, 0.12);
    background: linear-gradient(180deg, rgba(26, 35, 50, 0.92) 0%, rgba(13, 17, 23, 0.98) 100%);
  }

  .footer-text {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
  }

  .footer-start-btn {
    height: calc(38px * var(--layout-scale, 1));
    padding: 0 calc(20px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #16a34a, #15803d);
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #fff;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    white-space: nowrap;
    cursor: not-allowed;
    opacity: 0.45;
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
  }

  .footer-start-btn.enabled {
    cursor: pointer;
    opacity: 1;
  }

  .footer-start-btn.enabled:hover {
    transform: scale(1.03);
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(22, 163, 74, 0.4);
  }
</style>
