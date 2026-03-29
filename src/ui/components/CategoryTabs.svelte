<script lang="ts">
  import { getDomainMetadata } from '../../data/domainMetadata';
  import { getAllDecks } from '../../data/deckRegistry';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getDomainIconPath } from '../utils/iconAssets';

  interface Props {
    activeTab: string | null; // null = "All" tab, domain ID string, or 'vocabulary'
    onTabChange: (tab: string | null) => void;
  }

  let { activeTab, onTabChange }: Props = $props();

  const tabs = $derived.by(() => {
    const decks = getAllDecks().filter(d => d.status === 'available');
    const domains = new Set(decks.map(d => d.domain));

    const result: Array<{ id: string | null; label: string; icon: string; colorTint: string; count: number }> = [
      { id: null, label: 'All', icon: '', colorTint: '#6366f1', count: decks.length },
    ];

    // Add 'vocabulary' if it exists
    if (domains.has('vocabulary')) {
      const vocabCount = decks.filter(d => d.domain === 'vocabulary').length;
      result.push({ id: 'vocabulary', label: 'Languages', icon: '', colorTint: '#34D399', count: vocabCount });
    }

    // Add knowledge domains
    for (const domain of domains) {
      if (domain === 'vocabulary') continue;
      try {
        const meta = getDomainMetadata(domain);
        const domainCount = decks.filter(d => d.domain === domain).length;
        result.push({ id: domain, label: meta.shortName, icon: getDomainIconPath(domain), colorTint: meta.colorTint, count: domainCount });
      } catch { /* skip unknown domains */ }
    }

    return result;
  });

  function handleTabClick(tabId: string | null) {
    playCardAudio('tab-switch');
    onTabChange(tabId);
  }
</script>

<div class="category-tabs">
  {#each tabs as tab (tab.id ?? '__all__')}
    <button
      class="tab-btn"
      class:active={activeTab === tab.id}
      style="--tab-color: {tab.colorTint}"
      onclick={() => handleTabClick(tab.id)}
    >
      {#if tab.icon}
        <img class="tab-icon" src={tab.icon} alt="" />
      {/if}
      <span class="tab-label">{tab.label}</span>
      <span class="tab-count">{tab.count}</span>
    </button>
  {/each}
</div>

<style>
  .category-tabs {
    display: flex;
    flex-direction: row;
    flex-shrink: 0;
    padding: calc(8px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    gap: calc(4px * var(--layout-scale, 1));
    background: rgba(10, 14, 26, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    /* Hide scrollbar cross-browser */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .category-tabs::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-radius: calc(6px * var(--layout-scale, 1));
    border: none;
    background: transparent;
    color: #64748b;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    position: relative;
  }

  .tab-btn:hover:not(.active) {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.03);
  }

  .tab-btn.active {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.06);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: calc(4px * var(--layout-scale, 1));
    right: calc(4px * var(--layout-scale, 1));
    height: calc(2px * var(--layout-scale, 1));
    border-radius: 1px;
    background: var(--tab-color);
  }

  .tab-icon {
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    object-fit: contain;
    flex-shrink: 0;
  }

  .tab-label {
    line-height: 1;
  }

  .tab-count {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4b5563;
    font-weight: 500;
  }

  .tab-btn.active .tab-count {
    color: #818cf8;
  }
</style>
