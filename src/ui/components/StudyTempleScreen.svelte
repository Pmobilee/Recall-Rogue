<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getAllDecks, getDecksForDomain, getDeckById } from '../../data/deckRegistry';
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import { getDeckProgress } from '../../services/deckProgressService';
  import { getDomainMetadata } from '../../data/domainMetadata';
  import { playerSave, persistPlayer } from '../stores/playerData';
  import DeckTileV2 from './DeckTileV2.svelte';
  import DeckDetailModal from './DeckDetailModal.svelte';
  import DeckSearchBar from './DeckSearchBar.svelte';
  import DeckSortDropdown from './DeckSortDropdown.svelte';
  import DeckFilterChips from './DeckFilterChips.svelte';
  import PlaylistBar from './PlaylistBar.svelte';
  import PlaylistPickerPopup from './PlaylistPickerPopup.svelte';
  import type { CustomPlaylist, CustomPlaylistItem } from '../../data/studyPreset';

  interface Props {
    onback: () => void;
    onStartRun: (config:
      | { mode: 'study'; deckId: string; subDeckId?: string; examTags?: string[] }
      | { mode: 'procedural'; deckId: string; subDeckId?: string }
    ) => void;
  }

  let { onback, onStartRun }: Props = $props();

  let activeTab = $state<string | null>(null);
  let searchQuery = $state('');
  let sortOption = $state<'alpha' | 'progress-high' | 'progress-low' | 'facts' | 'newest'>('alpha');
  let activeFilters = $state<Array<'in-progress' | 'not-started' | 'mastered'>>([]);
  let selectedDeckId = $state<string | null>(null);
  let syntheticLanguageDeck = $state<DeckRegistryEntry | null>(null);
  let customPlaylists = $state<CustomPlaylist[]>([]);
  let activePlaylistId = $state<string | null>(null);
  let showPlaylistPicker = $state(false);
  let pendingCustomItem = $state<CustomPlaylistItem | null>(null);
  let dealKey = $state(0);
  let initialTabSet = false;
  let sidebarCollapsed = $state(false);

  const LANGUAGE_MAP: Record<string, { name: string; flag: string }> = {
    japanese: { name: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}' },
    korean: { name: 'Korean', flag: '\u{1F1F0}\u{1F1F7}' },
    mandarin: { name: 'Mandarin Chinese', flag: '\u{1F1E8}\u{1F1F3}' },
    chinese: { name: 'Chinese', flag: '\u{1F1E8}\u{1F1F3}' },
    spanish: { name: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}' },
    french: { name: 'French', flag: '\u{1F1EB}\u{1F1F7}' },
    german: { name: 'German', flag: '\u{1F1E9}\u{1F1EA}' },
    dutch: { name: 'Dutch', flag: '\u{1F1F3}\u{1F1F1}' },
    czech: { name: 'Czech', flag: '\u{1F1E8}\u{1F1FF}' },
  };

  const rawDecks = $derived.by<DeckRegistryEntry[]>(() => {
    const allAvailable = getAllDecks().filter(d => d.status === 'available');
    if (activeTab === null) {
      // ALL tab: show knowledge decks + one representative per language for vocab
      const knowledgeDecks = allAvailable.filter(d => d.domain !== 'vocabulary');
      const vocabDecks = allAvailable.filter(d => d.domain === 'vocabulary');
      // Keep only one deck per language prefix (e.g., "japanese", "korean")
      const seenLanguages = new Set<string>();
      const representativeVocab: DeckRegistryEntry[] = [];
      for (const deck of vocabDecks) {
        const idx = deck.id.indexOf('_');
        const langKey = idx > 0 ? deck.id.substring(0, idx) : deck.id;
        if (!seenLanguages.has(langKey)) {
          seenLanguages.add(langKey);
          // Create a synthetic "parent" entry showing language name and total facts
          const langVocabDecks = vocabDecks.filter(d => {
            const di = d.id.indexOf('_');
            return (di > 0 ? d.id.substring(0, di) : d.id) === langKey;
          });
          const totalFacts = langVocabDecks.reduce((sum, d) => sum + d.factCount, 0);
          const LANG_NAMES: Record<string, string> = {
            japanese: 'Japanese', korean: 'Korean', mandarin: 'Mandarin Chinese',
            chinese: 'Chinese', spanish: 'Spanish', french: 'French',
            german: 'German', dutch: 'Dutch', czech: 'Czech',
          };
          representativeVocab.push({
            ...deck,
            id: 'all:' + langKey,
            name: LANG_NAMES[langKey] ?? langKey.charAt(0).toUpperCase() + langKey.slice(1),
            description: `${langVocabDecks.length} decks · ${totalFacts} facts`,
            factCount: totalFacts,
            subDecks: langVocabDecks.map(d => ({ id: d.id, name: d.name, factCount: d.factCount })),
          });
        }
      }
      return [...knowledgeDecks, ...representativeVocab];
    }
    if (activeTab === 'vocabulary') {
      const vocabDecks = allAvailable.filter(d => d.domain === 'vocabulary');
      const seenLanguages = new Set<string>();
      const result: DeckRegistryEntry[] = [];
      for (const deck of vocabDecks) {
        const idx = deck.id.indexOf('_');
        const langKey = idx > 0 ? deck.id.substring(0, idx) : deck.id;
        if (!seenLanguages.has(langKey)) {
          seenLanguages.add(langKey);
          const langVocabDecks = vocabDecks.filter(d => {
            const di = d.id.indexOf('_');
            return (di > 0 ? d.id.substring(0, di) : d.id) === langKey;
          });
          const totalFacts = langVocabDecks.reduce((sum, d) => sum + d.factCount, 0);
          const LANG_NAMES: Record<string, string> = {
            japanese: 'Japanese', korean: 'Korean', mandarin: 'Mandarin Chinese',
            chinese: 'Chinese', spanish: 'Spanish', french: 'French',
            german: 'German', dutch: 'Dutch', czech: 'Czech',
          };
          result.push({
            ...deck,
            id: 'all:' + langKey,
            name: LANG_NAMES[langKey] ?? langKey.charAt(0).toUpperCase() + langKey.slice(1),
            description: `${langVocabDecks.length} decks · ${totalFacts} facts`,
            factCount: totalFacts,
            subDecks: langVocabDecks.map(d => ({ id: d.id, name: d.name, factCount: d.factCount })),
          });
        }
      }
      return result;
    }
    return allAvailable.filter(d => d.domain === activeTab);
  });

  const languageGroups = $derived.by(() => {
    if (activeTab !== 'vocabulary') return [];
    const groups = new Map<string, DeckRegistryEntry[]>();
    for (const deck of rawDecks) {
      const idx = deck.id.indexOf('_');
      const langKey = idx > 0 ? deck.id.substring(0, idx) : deck.id;
      if (!groups.has(langKey)) groups.set(langKey, []);
      groups.get(langKey)!.push(deck);
    }
    return Array.from(groups.entries()).map(([key, decks]) => {
      const info = LANGUAGE_MAP[key] ?? { name: key.charAt(0).toUpperCase() + key.slice(1), flag: '' };
      return {
        languageCode: key,
        languageName: info.name,
        languageFlag: info.flag,
        decks,
        totalFacts: decks.reduce((s, d) => s + d.factCount, 0),
      };
    }).sort((a, b) => b.decks.length - a.decks.length || a.languageName.localeCompare(b.languageName));
  });

  const filteredDecks = $derived.by<DeckRegistryEntry[]>(() => {
    let decks = [...rawDecks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      decks = decks.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.domain.toLowerCase().includes(q)
      );
    }

    if (activeFilters.length > 0) {
      decks = decks.filter(d => {
        const p = getDeckProgress(d.id);
        if (activeFilters.includes('not-started') && p.factsEncountered === 0) return true;
        if (activeFilters.includes('in-progress') && p.factsEncountered > 0 && p.progressPercent < 100) return true;
        if (activeFilters.includes('mastered') && p.progressPercent >= 100) return true;
        return false;
      });
    }

    decks.sort((a, b) => {
      switch (sortOption) {
        case 'alpha': return a.name.localeCompare(b.name);
        case 'progress-high': return getDeckProgress(b.id).progressPercent - getDeckProgress(a.id).progressPercent;
        case 'progress-low': return getDeckProgress(a.id).progressPercent - getDeckProgress(b.id).progressPercent;
        case 'facts': return b.factCount - a.factCount;
        case 'newest': return 0;
        default: return 0;
      }
    });

    return decks;
  });

  /** Category list for the sidebar */
  const categoryList = $derived.by(() => {
    const decks = getAllDecks().filter(d => d.status === 'available');
    const domains = new Set(decks.map(d => d.domain));
    const result: Array<{ id: string | null; label: string; count: number }> = [
      { id: null, label: 'All', count: decks.length },
    ];
    if (domains.has('vocabulary')) {
      result.push({ id: 'vocabulary', label: 'Languages', count: decks.filter(d => d.domain === 'vocabulary').length });
    }
    for (const domain of domains) {
      if (domain === 'vocabulary') continue;
      try {
        const meta = getDomainMetadata(domain as Parameters<typeof getDomainMetadata>[0]);
        result.push({ id: domain, label: meta.shortName, count: decks.filter(d => d.domain === domain).length });
      } catch { /* skip unknown */ }
    }
    return result;
  });

  const selectedDeck = $derived.by(() => {
    if (syntheticLanguageDeck) return syntheticLanguageDeck;
    return selectedDeckId ? getAllDecks().find(d => d.id === selectedDeckId) ?? null : null;
  });

  const selectedProgress = $derived.by(() => {
    if (!selectedDeck) return null;
    if (selectedDeck.id.startsWith('all:')) {
      // Aggregate progress across all subdecks
      const subDecks = selectedDeck.subDecks ?? [];
      let totalFacts = 0, encountered = 0, mastered = 0;
      for (const sd of subDecks) {
        const p = getDeckProgress(sd.id);
        totalFacts += p.totalFacts;
        encountered += p.factsEncountered;
        mastered += p.factsMastered;
      }
      return {
        deckId: selectedDeck.id,
        totalFacts,
        factsEncountered: encountered,
        factsMastered: mastered,
        averageStability: 0,
        progressPercent: totalFacts > 0 ? (mastered / totalFacts) * 100 : 0,
      };
    }
    return getDeckProgress(selectedDeck.id);
  });
  const activePlaylist = $derived(activePlaylistId ? customPlaylists.find(p => p.id === activePlaylistId) ?? null : null);
  const showPlaylistBar = $derived(customPlaylists.length > 0 && customPlaylists.some(p => p.items.length > 0));

  onMount(() => {
    playCardAudio('modal-open');
    // Trigger initial deal animation after tiles have mounted
    requestAnimationFrame(() => { dealKey++; });
    const save = $playerSave;
    if (save?.lastDungeonSelection?.mode === 'study' && save.lastDungeonSelection.studyConfig) {
      // Could restore tab from deckId's domain — skip for simplicity
    }
    if (save?.lastDungeonSelection?.customPlaylists) {
      customPlaylists = save.lastDungeonSelection.customPlaylists;
      activePlaylistId = save.lastDungeonSelection.activePlaylistId ?? customPlaylists[0]?.id ?? null;
    }
  });

  function handleBack() {
    playCardAudio('tab-switch');
    onback();
  }

  function handleDeckSelect(deckId: string) {
    if (deckId.startsWith('all:')) {
      // Find the synthetic language deck and open the modal
      const syntheticDeck = rawDecks.find(d => d.id === deckId);
      if (syntheticDeck) {
        syntheticLanguageDeck = syntheticDeck;
        return;
      }
    }
    selectedDeckId = deckId;
  }

  function handleModalClose() {
    selectedDeckId = null;
    syntheticLanguageDeck = null;
  }

  function handleStartStudyRun(deckId: string, subDeckId?: string, examTags?: string[]) {
    selectedDeckId = null;
    syntheticLanguageDeck = null;

    // For language group decks, resolve the actual deckId
    let actualDeckId = deckId;
    let actualSubDeckId = subDeckId;

    if (deckId.startsWith('all:')) {
      if (subDeckId) {
        actualDeckId = subDeckId;
        actualSubDeckId = undefined;
      } else {
        actualDeckId = deckId;
        actualSubDeckId = undefined;
      }
    }

    // Procedural decks bypass the combat run — navigate directly to practice screen
    const entry = getDeckById(actualDeckId);
    if (entry?.procedural) {
      onStartRun({ mode: 'procedural', deckId: actualDeckId, subDeckId: actualSubDeckId });
      return;
    }

    playerSave.update(s => s ? {
      ...s,
      lastDungeonSelection: {
        ...s.lastDungeonSelection,
        mode: 'study' as const,
        studyConfig: { deckId: actualDeckId, subDeckId: actualSubDeckId },
      },
    } : s);
    persistPlayer();
    onStartRun({ mode: 'study', deckId: actualDeckId, subDeckId: actualSubDeckId, examTags });
  }

  function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function handleAddToCustom(deckId: string, subDeckId?: string) {
    const decks = getAllDecks();
    const deck = decks.find(d => d.id === deckId);
    let label = deck?.name ?? deckId;
    if (subDeckId) {
      const sub = deck?.subDecks?.find((s: { id: string; name: string }) => s.id === subDeckId);
      label = sub?.name ?? subDeckId;
    }
    pendingCustomItem = { type: 'study', deckId, subDeckId, label };
    showPlaylistPicker = true;
  }

  function handleAddToPlaylist(playlistId: string) {
    if (!pendingCustomItem) return;
    const item = pendingCustomItem;
    customPlaylists = customPlaylists.map(p => {
      if (p.id !== playlistId) return p;
      const alreadyIn = p.items.some(it => it.type === 'study' && it.deckId === (item as Extract<CustomPlaylistItem, { type: 'study' }>).deckId && it.subDeckId === (item as Extract<CustomPlaylistItem, { type: 'study' }>).subDeckId);
      if (alreadyIn) return p;
      return { ...p, items: [...p.items, item] };
    });
    activePlaylistId = playlistId;
    pendingCustomItem = null;
    showPlaylistPicker = false;
    persistStudySelection();
  }

  function handleCreateAndAdd(name: string) {
    if (!pendingCustomItem) return;
    const newPlaylist: CustomPlaylist = { id: makeId(), name: name.trim(), createdAt: Date.now(), items: [pendingCustomItem] };
    customPlaylists = [...customPlaylists, newPlaylist];
    activePlaylistId = newPlaylist.id;
    pendingCustomItem = null;
    showPlaylistPicker = false;
    persistStudySelection();
  }

  function handleStartCustomRun() {
    const items = activePlaylist?.items ?? [];
    const firstStudy = items.find((it): it is Extract<CustomPlaylistItem, { type: 'study' }> => it.type === 'study');
    if (firstStudy) {
      onStartRun({ mode: 'study', deckId: firstStudy.deckId, subDeckId: firstStudy.subDeckId });
    }
  }

  function persistStudySelection() {
    playerSave.update(s => s ? {
      ...s,
      lastDungeonSelection: {
        ...s.lastDungeonSelection,
        mode: 'study' as const,
        customPlaylists: customPlaylists.length > 0 ? customPlaylists : undefined,
        activePlaylistId: activePlaylistId ?? undefined,
      },
    } : s);
    persistPlayer();
  }

  function handleSearchChange(v: string) {
    searchQuery = v;
  }

  function handleSortChange(v: 'alpha' | 'progress-high' | 'progress-low' | 'facts' | 'newest') {
    sortOption = v;
  }

  function handleSidebarTab(tabId: string | null) {
    activeTab = tabId;
    playCardAudio('tab-switch');
  }

  $effect(() => {
    void activeTab;
    untrack(() => {
      selectedDeckId = null;
      if (!initialTabSet) {
        initialTabSet = true;
        return;
      }
      dealKey++;
      playCardAudio('deck-shuffle');
    });
  });
</script>

<div class="study-temple-screen">
  <header class="header">
    <button class="back-btn" onclick={handleBack}>&larr;</button>
    <h1 class="title">THE LIBRARY</h1>
    <DeckSearchBar value={searchQuery} onsearchchange={handleSearchChange} placeholder="Search decks..." />
    <DeckSortDropdown value={sortOption} onsortchange={handleSortChange} />
    <DeckFilterChips {activeFilters} onFiltersChange={(f) => { activeFilters = f; }} />
  </header>

  <div class="body-layout">
    <aside class="sidebar" class:collapsed={sidebarCollapsed}>
      <button class="sidebar-toggle" class:breathing={sidebarCollapsed} onclick={() => { sidebarCollapsed = !sidebarCollapsed; }} type="button">
        <span class="toggle-arrow" class:collapsed-arrow={sidebarCollapsed}>{sidebarCollapsed ? '\u25B6' : '\u25C0'}</span>
      </button>
      {#if !sidebarCollapsed}
        <nav class="sidebar-categories">
          {#each categoryList as cat (cat.id ?? '__all__')}
            <button
              class="sidebar-item"
              class:active={activeTab === cat.id}
              onclick={() => handleSidebarTab(cat.id)}
              type="button"
            >
              <span class="sidebar-label">{cat.label}</span>
              <span class="sidebar-count">{cat.count}</span>
            </button>
          {/each}
        </nav>
      {/if}
    </aside>

    <div class="main-content">
      <div class="deck-summary">
        {filteredDecks.length} deck{filteredDecks.length !== 1 ? 's' : ''}
        {#if searchQuery || activeFilters.length > 0}
          <span class="summary-filter-note">(filtered)</span>
        {/if}
      </div>

      <div class="deck-scroll">
        <div class="deck-grid">
          {#if filteredDecks.length === 0}
            <div class="empty-state">
              <p class="empty-title">{searchQuery ? 'No matching decks' : 'No decks available'}</p>
              <p class="empty-sub">{searchQuery ? 'Try a different search term' : 'Decks for this category are coming soon.'}</p>
            </div>
          {:else}
            {#each filteredDecks as deck, i (deck.id)}
              {@const progress = getDeckProgress(deck.id)}
              <DeckTileV2 {deck} {progress} onclick={() => handleDeckSelect(deck.id)} dealIndex={i} {dealKey} />
            {/each}
          {/if}
        </div>
      </div>
      <div class="scroll-fade" aria-hidden="true"></div>
    </div>
  </div>

  {#if showPlaylistBar}
    <PlaylistBar
      playlists={customPlaylists}
      {activePlaylistId}
      onSwitchPlaylist={(id) => { activePlaylistId = id; }}
      onStartCustomRun={handleStartCustomRun}
      onViewPlaylist={() => {}}
    />
  {/if}
</div>

{#if selectedDeck && selectedProgress}
  <DeckDetailModal
    deck={selectedDeck}
    progress={selectedProgress}
    onStartRun={handleStartStudyRun}
    onClose={handleModalClose}
    onAddToCustom={handleAddToCustom}
  />
{/if}

{#if showPlaylistPicker}
  <PlaylistPickerPopup
    playlists={customPlaylists}
    onAddToPlaylist={handleAddToPlaylist}
    onCreateAndAdd={handleCreateAndAdd}
    onClose={() => { showPlaylistPicker = false; pendingCustomItem = null; }}
  />
{/if}

<style>
  .study-temple-screen {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    background: linear-gradient(160deg, #0a0e1a 0%, #1a1035 50%, #0a0e1a 100%);
    color: #e0e0e0;
  }

  /* ── Header: single row ── */

  .header {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: linear-gradient(180deg, rgba(10, 14, 26, 0.98) 0%, rgba(26, 16, 53, 0.92) 100%);
    border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    flex-shrink: 0;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .back-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #8b949e;
    font-size: calc(16px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    white-space: nowrap;
    flex-shrink: 0;
    min-width: calc(28px * var(--layout-scale, 1));
    min-height: calc(28px * var(--layout-scale, 1));
  }

  .back-btn:hover {
    color: #c9d1d9;
  }

  .title {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #818cf8;
    margin: 0;
    white-space: nowrap;
    flex-shrink: 0;
    margin-right: calc(4px * var(--layout-scale, 1));
  }

  /* ── Body: sidebar + main content ── */

  .body-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Sidebar ── */

  .sidebar {
    display: flex;
    flex-direction: column;
    width: calc(200px * var(--layout-scale, 1));
    flex-shrink: 0;
    background: rgba(10, 14, 26, 0.6);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    transition: width 0.2s ease;
    overflow: hidden;
  }

  .sidebar.collapsed {
    width: calc(36px * var(--layout-scale, 1));
  }

  .sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    height: calc(32px * var(--layout-scale, 1));
    background: none;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: #64748b;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s;
    padding-left: calc(12px * var(--layout-scale, 1));
  }

  .sidebar-toggle:hover {
    color: #e2e8f0;
  }

  .toggle-arrow {
    transition: color 0.15s;
  }

  .collapsed-arrow {
    animation: breathe-gold 2s ease-in-out infinite;
  }

  @keyframes breathe-gold {
    0%, 100% { color: rgba(255, 215, 0, 0.35); }
    50% { color: rgba(255, 215, 0, 1); }
  }

  .sidebar-toggle.breathing:hover .toggle-arrow {
    animation: none;
    color: #ffd700;
  }

  .sidebar-categories {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
    padding: calc(4px * var(--layout-scale, 1)) 0;
    scrollbar-width: none;
  }

  .sidebar-categories::-webkit-scrollbar {
    display: none;
  }

  .sidebar-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    border-left: calc(3px * var(--layout-scale, 1)) solid transparent;
    color: rgba(255, 255, 255, 0.22);
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    font-family: 'Cinzel', Georgia, serif;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.12s, background 0.12s, border-color 0.12s;
    text-align: left;
    white-space: nowrap;
  }

  .sidebar-item:hover:not(.active) {
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.02);
  }

  .sidebar-item.active {
    color: rgba(255, 255, 255, 0.65);
    background: rgba(99, 102, 241, 0.08);
    border-left-color: #818cf8;
  }

  .sidebar-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-count {
    font-size: calc(11px * var(--text-scale, 1));
    font-family: inherit;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.4;
    flex-shrink: 0;
    margin-left: calc(8px * var(--layout-scale, 1));
  }

  .sidebar-item.active .sidebar-count {
    opacity: 0.6;
  }

  /* ── Main content area ── */

  .main-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .deck-scroll {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    position: relative;
  }

  .scroll-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(80px * var(--layout-scale, 1));
    background: linear-gradient(transparent, rgba(10, 14, 26, 0.95));
    pointer-events: none;
    z-index: 2;
  }

  .deck-summary {
    padding: calc(8px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #4b5563;
    flex-shrink: 0;
  }

  .summary-filter-note {
    color: #6366f1;
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  .deck-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(240px * var(--layout-scale, 1)), 1fr));
    gap: calc(20px * var(--layout-scale, 1));
    padding: calc(20px * var(--layout-scale, 1));
    padding-bottom: calc(96px * var(--layout-scale, 1));
    align-content: start;
  }

  @media (max-width: 400px) {
    .deck-grid {
      grid-template-columns: 1fr;
    }
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
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .empty-sub {
    font-size: calc(13px * var(--text-scale, 1));
    color: #4b5563;
    margin: 0;
  }
</style>
