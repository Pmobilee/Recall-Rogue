<script lang="ts">
  import { getAllDecks, getDecksForDomain } from '../../data/deckRegistry';
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import { getDeckProgress } from '../../services/deckProgressService';
  import DeckGrid from './DeckGrid.svelte';
  import DeckDetail from './DeckDetail.svelte';
  import VocabTreeView from './VocabTreeView.svelte';

  interface Props {
    /** Currently selected domain in sidebar (null = All). */
    activeDomain: string | null;
    /** Called when a study run should start. */
    onStartStudyRun: (deckId: string, subDeckId?: string) => void;
    /** Optional: called when the user adds a deck to the custom playlist. */
    onAddToCustom?: (deckId: string, subDeckId?: string) => void;
    /** Optional: called when clicking a synthetic language tile should switch the active domain. */
    onDomainSwitch?: (domain: string | null) => void;
  }

  let { activeDomain, onStartStudyRun, onAddToCustom, onDomainSwitch }: Props = $props();

  /** Language map for grouping vocabulary decks in the "All" view. */
  const LANGUAGE_MAP: Record<string, { name: string; flag: string }> = {
    japanese:   { name: 'Japanese',        flag: '🇯🇵' },
    korean:     { name: 'Korean',          flag: '🇰🇷' },
    mandarin:   { name: 'Mandarin Chinese', flag: '🇨🇳' },
    chinese:    { name: 'Chinese',         flag: '🇨🇳' },
    spanish:    { name: 'Spanish',         flag: '🇪🇸' },
    french:     { name: 'French',          flag: '🇫🇷' },
    german:     { name: 'German',          flag: '🇩🇪' },
    dutch:      { name: 'Dutch',           flag: '🇳🇱' },
    czech:      { name: 'Czech',           flag: '🇨🇿' },
    portuguese: { name: 'Portuguese',      flag: '🇵🇹' },
    italian:    { name: 'Italian',         flag: '🇮🇹' },
    russian:    { name: 'Russian',         flag: '🇷🇺' },
    arabic:     { name: 'Arabic',          flag: '🇸🇦' },
    hindi:      { name: 'Hindi',           flag: '🇮🇳' },
    vietnamese: { name: 'Vietnamese',      flag: '🇻🇳' },
    turkish:    { name: 'Turkish',         flag: '🇹🇷' },
  };

  /**
   * IDs of synthetic language tiles (vocabulary groups) shown in the "All" view.
   * Used to detect clicks that should switch to the vocabulary domain instead of
   * opening a detail panel.
   */
  const syntheticLanguageIds = new Set<string>();

  /** The deck currently being previewed in DeckDetail, or null. */
  let selectedDeckId = $state<string | null>(null);
  /** Selected sub-deck within the detail view. */
  let selectedSubDeck = $state<string | null>(null);

  /**
   * Filtered deck list based on active domain.
   * When activeDomain is null (All), show only top-level decks (one per main deck),
   * not every sub-deck entry.
   */
  const visibleDecks = $derived<DeckRegistryEntry[]>(
    activeDomain === null
      ? getTopLevelDecks()
      : activeDomain === 'vocabulary'
        ? getDecksForDomain('vocabulary')
        : getDecksForDomain(activeDomain as Parameters<typeof getDecksForDomain>[0]),
  );

  /**
   * Get top-level decks for the "All" view.
   * - Vocabulary decks are collapsed into one synthetic tile per language.
   * - Knowledge decks are shown as-is (each is already a standalone top-level deck).
   */
  function getTopLevelDecks(): DeckRegistryEntry[] {
    const all = getAllDecks();
    syntheticLanguageIds.clear();

    // Separate vocab from knowledge decks.
    const vocabDecks = all.filter((d) => d.domain === 'vocabulary' && d.status === 'available');
    const knowledgeDecks = all.filter((d) => d.domain !== 'vocabulary' && d.status === 'available');

    // Group vocab decks by language prefix (e.g. "japanese_n5" -> "japanese").
    const langGroups = new Map<string, DeckRegistryEntry[]>();
    for (const deck of vocabDecks) {
      const firstUnderscore = deck.id.indexOf('_');
      const langKey = firstUnderscore > 0 ? deck.id.substring(0, firstUnderscore) : deck.id;
      if (!langGroups.has(langKey)) langGroups.set(langKey, []);
      langGroups.get(langKey)!.push(deck);
    }

    // Build one synthetic DeckRegistryEntry per language.
    const syntheticEntries: DeckRegistryEntry[] = [];
    for (const [langKey, decks] of langGroups) {
      const langInfo = LANGUAGE_MAP[langKey] ?? {
        name: langKey.charAt(0).toUpperCase() + langKey.slice(1),
        flag: '🌐',
      };
      const totalFacts = decks.reduce((sum, d) => sum + d.factCount, 0);
      const first = decks[0];

      syntheticLanguageIds.add(langKey);
      syntheticEntries.push({
        id: langKey,
        name: `${langInfo.flag} ${langInfo.name}`,
        description: `${decks.length} deck${decks.length !== 1 ? 's' : ''}, ${totalFacts.toLocaleString()}+ facts`,
        domain: 'vocabulary',
        factCount: totalFacts,
        tier: first.tier,
        status: 'available',
        artPlaceholder: {
          gradientFrom: first.artPlaceholder.gradientFrom,
          gradientTo: first.artPlaceholder.gradientTo,
          icon: langInfo.flag,
        },
      });
    }

    // Sort language tiles: most decks first, then alphabetically.
    syntheticEntries.sort((a, b) => {
      const aCount = langGroups.get(a.id)?.length ?? 0;
      const bCount = langGroups.get(b.id)?.length ?? 0;
      return bCount - aCount || a.name.localeCompare(b.name);
    });

    return [...syntheticEntries, ...knowledgeDecks];
  }

  /**
   * Build a synthetic DeckRegistryEntry for an "all:<languageCode>" selection.
   * Aggregates all vocabulary decks for that language into one entry.
   */
  function buildSyntheticAllDeck(languageCode: string): DeckRegistryEntry | null {
    const allVocab = getDecksForDomain('vocabulary');
    const langDecks = allVocab.filter(
      (d) => d.id.startsWith(languageCode + '_') || d.id === languageCode,
    );
    if (langDecks.length === 0) return null;
    const langInfo = LANGUAGE_MAP[languageCode] ?? {
      name: languageCode.charAt(0).toUpperCase() + languageCode.slice(1),
      flag: '🌐',
    };
    const totalFacts = langDecks.reduce((sum, d) => sum + d.factCount, 0);
    const first = langDecks[0];
    return {
      id: `all:${languageCode}`,
      name: `${langInfo.flag} All ${langInfo.name}`,
      description: `${langDecks.length} deck${langDecks.length !== 1 ? 's' : ''}, ${totalFacts.toLocaleString()}+ facts`,
      domain: 'vocabulary',
      factCount: totalFacts,
      tier: first.tier,
      status: 'available',
      artPlaceholder: {
        gradientFrom: first.artPlaceholder.gradientFrom,
        gradientTo: first.artPlaceholder.gradientTo,
        icon: langInfo.flag,
      },
    };
  }

  /** Deck entry for the selected deck. */
  const selectedDeck = $derived<DeckRegistryEntry | null>((() => {
    if (!selectedDeckId) return null;
    // Handle synthetic "all:<languageCode>" IDs from the "Study All" button.
    if (selectedDeckId.startsWith('all:')) {
      const langCode = selectedDeckId.slice(4);
      return buildSyntheticAllDeck(langCode);
    }
    return visibleDecks.find((d) => d.id === selectedDeckId) ?? null;
  })());

  /** Synthetic progress for an "all:<language>" deck (aggregated). */
  function buildSyntheticAllProgress(languageCode: string): import('../../services/deckProgressService').DeckProgress {
    const allVocab = getDecksForDomain('vocabulary');
    const langDecks = allVocab.filter(
      (d) => d.id.startsWith(languageCode + '_') || d.id === languageCode,
    );
    const totalFacts = langDecks.reduce((sum, d) => sum + d.factCount, 0);
    const indivProgress = langDecks.map((d) => getDeckProgress(d.id));
    const factsEncountered = indivProgress.reduce((sum, p) => sum + p.factsEncountered, 0);
    const factsMastered = indivProgress.reduce((sum, p) => sum + p.factsMastered, 0);
    const avgStability = langDecks.length > 0
      ? indivProgress.reduce((sum, p) => sum + p.averageStability, 0) / langDecks.length
      : 0;
    const progressPercent = totalFacts > 0
      ? Math.round((factsEncountered / totalFacts) * 100)
      : 0;
    return { deckId: `all:${languageCode}`, totalFacts, factsEncountered, factsMastered, averageStability: avgStability, progressPercent };
  }

  /** Progress for the selected deck. */
  const selectedProgress = $derived((() => {
    if (!selectedDeck) return null;
    if (selectedDeckId?.startsWith('all:')) {
      const langCode = selectedDeckId.slice(4);
      return buildSyntheticAllProgress(langCode);
    }
    return getDeckProgress(selectedDeck.id);
  })());

  /** Reset selected deck when domain changes. */
  $effect(() => {
    // When active domain changes, clear selection.
    void activeDomain;
    selectedDeckId = null;
    selectedSubDeck = null;
  });

  /** Handle deck tile click. */
  function handleDeckSelect(deckId: string): void {
    // If the user clicks a synthetic language tile in the "All" view, switch to
    // the vocabulary domain view rather than opening a (non-existent) detail panel.
    if (activeDomain === null && syntheticLanguageIds.has(deckId)) {
      onDomainSwitch?.('vocabulary');
      return;
    }
    selectedDeckId = deckId;
    selectedSubDeck = null;
  }

  /** Handle DeckDetail close. */
  function handleClose(): void {
    selectedDeckId = null;
    selectedSubDeck = null;
  }

  /** Handle starting a study run from the detail panel. */
  function handleStart(): void {
    if (!selectedDeckId) return;
    onStartStudyRun(selectedDeckId, selectedSubDeck ?? undefined);
  }

  /**
   * Handle deck selection from DeckGrid or VocabTreeView.
   * Supports regular deck IDs and synthetic "all:<languageCode>" IDs.
   */
  // handleStudyAllLanguage removed — VocabTreeView now calls onDeckSelect('all:<lang>') directly.
</script>

<div class="study-content">
  <!-- Deck grid (or vocabulary tree) takes main space -->
  <div class="grid-wrapper" class:narrowed={selectedDeck !== null}>
    {#if activeDomain === 'vocabulary'}
      <VocabTreeView
        onDeckSelect={handleDeckSelect}
        {onAddToCustom}
      />
    {:else}
      <DeckGrid decks={visibleDecks} onDeckSelect={handleDeckSelect} />
    {/if}
  </div>

  <!-- Slide-in detail panel -->
  {#if selectedDeck && selectedProgress}
    <div class="detail-panel">
      <DeckDetail
        deck={selectedDeck}
        progress={selectedProgress}
        {selectedSubDeck}
        onSubDeckSelect={(id) => { selectedSubDeck = id; }}
        onStartRun={handleStart}
        onClose={handleClose}
        {onAddToCustom}
      />
    </div>
  {/if}
</div>

<style>
  .study-content {
    flex: 1 1 0;
    display: flex;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }

  .grid-wrapper {
    flex: 1 1 0;
    overflow-y: auto;
    min-width: 0;
    min-height: 0;
  }

  .grid-wrapper.narrowed {
    /* Deck grid shrinks when detail panel is open */
    flex: 1.4;
  }

  .detail-panel {
    width: calc(280px * var(--layout-scale, 1));
    min-width: calc(240px * var(--layout-scale, 1));
    flex-shrink: 0;
    overflow: hidden;
    animation: slide-in 0.2s ease-out;
  }

  @keyframes slide-in {
    from {
      width: 0;
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
