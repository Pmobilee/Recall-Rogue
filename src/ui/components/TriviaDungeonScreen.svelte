<script lang="ts">
  import { onMount } from 'svelte';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getKnowledgeDomains, getDomainMetadata } from '../../data/domainMetadata';
  import { playerSave, persistPlayer } from '../stores/playerData';
  import { factsDB } from '../../services/factsDB';
  import { normalizeFactDomain } from '../../data/card-types';
  import { resolveDomain } from '../../services/domainResolver';
  import { ascensionProfile, setAscensionLevel } from '../../services/cardPreferences';
  import { getAscensionRule } from '../../services/ascension';
  import DomainStrip from './DomainStrip.svelte';
  import LoadoutCard from './LoadoutCard.svelte';

  interface Props {
    onback: () => void;
    onStartRun: (config: { mode: 'trivia'; domains: string[]; subdomains?: Record<string, string[]> }) => void;
  }

  const { onback, onStartRun }: Props = $props();

  // State
  let selectedDomains = $state<string[]>(getKnowledgeDomains().filter(id => !getDomainMetadata(id).comingSoon));
  let subdomainSelections = $state<Record<string, string[]>>({});
  let searchQuery = $state('');

  // Derived
  const canStart = $derived(selectedDomains.length > 0);

  const totalFacts = $derived(() => {
    if (!factsDB.isReady()) return 0;
    return factsDB.getAll().filter(f => {
      const domain = normalizeFactDomain(resolveDomain(f));
      return selectedDomains.includes(domain);
    }).length;
  });

  let ascensionRule = $derived(getAscensionRule($ascensionProfile.trivia.selectedLevel))
  let ascensionUnlockText = $derived(
    $ascensionProfile.trivia.highestUnlockedLevel > 0
      ? `Unlocked: ${$ascensionProfile.trivia.highestUnlockedLevel}`
      : 'Win a run to unlock',
  )

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

  function shiftAscension(delta: number): void {
    const highest = Math.max(0, $ascensionProfile.trivia.highestUnlockedLevel ?? 0)
    const next = Math.max(0, Math.min(highest, ($ascensionProfile.trivia.selectedLevel ?? 0) + delta))
    setAscensionLevel('trivia', next)
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
      </div>
    </div>
  </header>

  <!-- Domain Strip -->
  <DomainStrip {selectedDomains} onDomainsChange={handleDomainsChange} />

  <!-- Loadout Cards Grid -->
  <div class="loadout-grid-wrapper">
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
  </div>

  <!-- Footer Status Bar -->
  <footer class="footer">
    <span class="footer-text">
      {selectedDomains.length} domain{selectedDomains.length !== 1 ? 's' : ''} · {totalFacts()} facts
    </span>

    <div class="ascension-selector" aria-label="Ascension level">
      <button
        type="button"
        class="asc-step"
        onclick={() => shiftAscension(-1)}
        disabled={$ascensionProfile.trivia.selectedLevel <= 0}
        aria-label="Decrease ascension"
      >−</button>
      <div class="asc-display">
        <strong class="asc-level">Ascension {$ascensionProfile.trivia.selectedLevel}</strong>
        <span class="asc-detail">
          {#if ascensionRule}
            {ascensionRule.name}
          {:else}
            Off
          {/if}
        </span>
        <span class="asc-unlock">{ascensionUnlockText}</span>
      </div>
      <button
        type="button"
        class="asc-step"
        onclick={() => shiftAscension(1)}
        disabled={$ascensionProfile.trivia.selectedLevel >= $ascensionProfile.trivia.highestUnlockedLevel}
        aria-label="Increase ascension"
      >+</button>
    </div>

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
    grid-template-columns: 1fr auto 1fr;
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

  /* ── Loadout Grid ── */
  .loadout-grid-wrapper {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  .loadout-grid-wrapper::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(60px * var(--layout-scale, 1));
    background: linear-gradient(transparent, rgba(13, 17, 23, 0.95));
    pointer-events: none;
    z-index: 1;
  }

  .loadout-grid {
    height: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(300px * var(--layout-scale, 1)), 1fr));
    grid-auto-rows: max-content;
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

  /* ── Ascension Selector ── */
  .ascension-selector {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: calc(8px * var(--layout-scale, 1));
    background: rgba(15, 23, 35, 0.6);
  }

  .asc-step {
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(31, 43, 58, 0.8);
    color: #e2e8f0;
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
  }

  .asc-step:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .asc-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(1px * var(--layout-scale, 1));
    min-width: calc(120px * var(--layout-scale, 1));
  }

  .asc-level {
    color: #facc15;
    font-size: calc(13px * var(--text-scale, 1));
    white-space: nowrap;
  }

  .asc-detail {
    color: #cbd5e1;
    font-size: calc(10px * var(--text-scale, 1));
    white-space: nowrap;
  }

  .asc-unlock {
    color: #64748b;
    font-size: calc(9px * var(--text-scale, 1));
    white-space: nowrap;
  }
</style>
