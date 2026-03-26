<script lang="ts">
  import { onMount } from 'svelte';
  import { playCardAudio } from '../../services/cardAudioManager';
  import { getAllDecks, getDecksForDomain } from '../../data/deckRegistry';
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import { getDeckProgress } from '../../services/deckProgressService';
  import { playerSave, persistPlayer } from '../stores/playerData';
  import CategoryTabs from './CategoryTabs.svelte';
  import DeckTileV2 from './DeckTileV2.svelte';
  import DeckDetailModal from './DeckDetailModal.svelte';
  import LanguageGroupHeader from './LanguageGroupHeader.svelte';
  import DeckSearchBar from './DeckSearchBar.svelte';
  import DeckSortDropdown from './DeckSortDropdown.svelte';
  import DeckFilterChips from './DeckFilterChips.svelte';
  import PlaylistBar from './PlaylistBar.svelte';
  import PlaylistPickerPopup from './PlaylistPickerPopup.svelte';
  import type { CustomPlaylist, CustomPlaylistItem } from '../../data/studyPreset';

  interface Props {
    onback: () => void;
    onStartRun: (config: { mode: 'study'; deckId: string; subDeckId?: string; examTags?: string[] }) => void;
  }

  let { onback, onStartRun }: Props = $props();

  let activeTab = $state<string | null>(null);
  let searchQuery = $state('');
  let sortOption = $state<'alpha' | 'progress-high' | 'progress-low' | 'facts' | 'newest'>('alpha');
  let activeFilters = $state<Array<'in-progress' | 'not-started' | 'mastered'>>([]);
  let selectedDeckId = $state<string | null>(null);
  let customPlaylists = $state<CustomPlaylist[]>([]);
  let activePlaylistId = $state<string | null>(null);
  let showPlaylistPicker = $state(false);
  let pendingCustomItem = $state<CustomPlaylistItem | null>(null);

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
          });
        }
      }
      return [...knowledgeDecks, ...representativeVocab];
    }
    if (activeTab === 'vocabulary') return allAvailable.filter(d => d.domain === 'vocabulary');
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
    let decks = activeTab === 'vocabulary' ? [] : [...rawDecks];

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
        if (activeFilters.includes('in-progress') && p.progressPercent > 0 && p.progressPercent < 100) return true;
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

  const selectedDeck = $derived(selectedDeckId ? getAllDecks().find(d => d.id === selectedDeckId) ?? null : null);
  const selectedProgress = $derived(selectedDeck ? getDeckProgress(selectedDeck.id) : null);
  const activePlaylist = $derived(activePlaylistId ? customPlaylists.find(p => p.id === activePlaylistId) ?? null : null);
  const showPlaylistBar = $derived(customPlaylists.length > 0 && customPlaylists.some(p => p.items.length > 0));

  onMount(() => {
    playCardAudio('modal-open');
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
      // Switch to vocabulary tab to show all decks for this language
      activeTab = 'vocabulary';
      return;
    }
    selectedDeckId = deckId;
  }

  function handleModalClose() {
    selectedDeckId = null;
  }

  function handleStartStudyRun(deckId: string, subDeckId?: string, examTags?: string[]) {
    selectedDeckId = null;
    playerSave.update(s => s ? {
      ...s,
      lastDungeonSelection: {
        ...s.lastDungeonSelection,
        mode: 'study' as const,
        studyConfig: { deckId, subDeckId },
      },
    } : s);
    persistPlayer();
    onStartRun({ mode: 'study', deckId, subDeckId, examTags });
  }

  function handleStudyAllLanguage(languageCode: string) {
    handleStartStudyRun('all:' + languageCode);
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

  $effect(() => {
    void activeTab;
    selectedDeckId = null;
  });
</script>

<div class="study-temple-screen">
  <header class="header">
    <button class="back-btn" onclick={handleBack}>&larr; Back</button>
    <h1 class="title">THE LIBRARY</h1>
    <div class="header-controls">
      <DeckSearchBar value={searchQuery} onsearchchange={handleSearchChange} placeholder="Search decks..." />
      <DeckSortDropdown value={sortOption} onsortchange={handleSortChange} />
      <DeckFilterChips {activeFilters} onFiltersChange={(f) => { activeFilters = f; }} />
    </div>
  </header>

  <CategoryTabs {activeTab} onTabChange={(t) => { activeTab = t; }} />

  <div class="deck-grid">
    {#if activeTab === 'vocabulary'}
      {#each languageGroups as group (group.languageCode)}
        <div class="lang-header-row">
          <LanguageGroupHeader
            languageCode={group.languageCode}
            languageName={group.languageName}
            languageFlag={group.languageFlag}
            deckCount={group.decks.length}
            totalFacts={group.totalFacts}
            onStudyAll={handleStudyAllLanguage}
          />
        </div>
        {#each group.decks as deck (deck.id)}
          {@const progress = getDeckProgress(deck.id)}
          <DeckTileV2 {deck} {progress} onclick={() => handleDeckSelect(deck.id)} />
        {/each}
      {/each}
    {:else if filteredDecks.length === 0}
      <div class="empty-state">
        <p class="empty-title">{searchQuery ? 'No matching decks' : 'No decks available'}</p>
        <p class="empty-sub">{searchQuery ? 'Try a different search term' : 'Decks for this category are coming soon.'}</p>
      </div>
    {:else}
      {#each filteredDecks as deck (deck.id)}
        {@const progress = getDeckProgress(deck.id)}
        <DeckTileV2 {deck} {progress} onclick={() => handleDeckSelect(deck.id)} />
      {/each}
    {/if}
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

  .header {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: linear-gradient(180deg, rgba(10, 14, 26, 0.98) 0%, rgba(26, 16, 53, 0.92) 100%);
    border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    flex-shrink: 0;
  }

  .back-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #8b949e;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    white-space: nowrap;
    flex-shrink: 0;
  }

  .back-btn:hover {
    color: #c9d1d9;
  }

  .title {
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #818cf8;
    margin: 0;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    flex: 1;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .deck-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: calc(16px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    overflow-y: auto;
    align-content: start;
  }

  @media (max-width: 1500px) {
    .deck-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 1100px) {
    .deck-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 800px) {
    .deck-grid {
      grid-template-columns: 1fr;
    }
  }

  .lang-header-row {
    grid-column: 1 / -1;
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
