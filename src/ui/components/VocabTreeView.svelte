<script lang="ts">
  import { getDecksForDomain } from '../../data/deckRegistry';
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import { getDeckProgress } from '../../services/deckProgressService';
  import DeckOptionsPanel from '../DeckOptionsPanel.svelte';
  import { getLanguageConfig } from '../../types/vocabulary';

  interface Props {
    /** Called when a deck is selected for detail view. */
    onDeckSelect: (deckId: string) => void;
    /** Optional: called when the user adds a language/deck to the custom playlist. */
    onAddToCustom?: (deckId: string, subDeckId?: string) => void;
  }

  let { onDeckSelect, onAddToCustom }: Props = $props();

  interface LanguageGroup {
    languageCode: string;
    languageName: string;
    languageFlag: string;
    decks: DeckRegistryEntry[];
  }

  const LANGUAGE_MAP: Record<string, { name: string; flag: string }> = {
    japanese:   { name: 'Japanese',         flag: '🇯🇵' },
    korean:     { name: 'Korean',            flag: '🇰🇷' },
    mandarin:   { name: 'Mandarin Chinese',  flag: '🇨🇳' },
    chinese:    { name: 'Chinese',           flag: '🇨🇳' },
    spanish:    { name: 'Spanish',           flag: '🇪🇸' },
    french:     { name: 'French',            flag: '🇫🇷' },
    german:     { name: 'German',            flag: '🇩🇪' },
    dutch:      { name: 'Dutch',             flag: '🇳🇱' },
    czech:      { name: 'Czech',             flag: '🇨🇿' },
    portuguese: { name: 'Portuguese',        flag: '🇵🇹' },
    italian:    { name: 'Italian',           flag: '🇮🇹' },
    russian:    { name: 'Russian',           flag: '🇷🇺' },
    arabic:     { name: 'Arabic',            flag: '🇸🇦' },
    hindi:      { name: 'Hindi',             flag: '🇮🇳' },
    vietnamese: { name: 'Vietnamese',        flag: '🇻🇳' },
    turkish:    { name: 'Turkish',           flag: '🇹🇷' },
  };

  /**
   * Group vocabulary decks by language prefix derived from the deck ID.
   * E.g. "japanese_n5" -> group key "japanese".
   */
  function groupVocabDecksByLanguage(decks: DeckRegistryEntry[]): LanguageGroup[] {
    const groups = new Map<string, LanguageGroup>();

    for (const deck of decks) {
      const firstUnderscore = deck.id.indexOf('_');
      const langKey = firstUnderscore > 0 ? deck.id.substring(0, firstUnderscore) : deck.id;
      const langInfo = LANGUAGE_MAP[langKey] ?? {
        name: langKey.charAt(0).toUpperCase() + langKey.slice(1),
        flag: '🌐',
      };

      if (!groups.has(langKey)) {
        groups.set(langKey, {
          languageCode: langKey,
          languageName: langInfo.name,
          languageFlag: langInfo.flag,
          decks: [],
        });
      }
      groups.get(langKey)!.decks.push(deck);
    }

    // Sort: most decks first, then alphabetically.
    return Array.from(groups.values()).sort(
      (a, b) => b.decks.length - a.decks.length || a.languageName.localeCompare(b.languageName),
    );
  }

  /** All vocabulary decks from registry. */
  const vocabDecks = $derived(getDecksForDomain('vocabulary'));

  /** Grouped by language. */
  const languageGroups = $derived(groupVocabDecksByLanguage(vocabDecks));

  /**
   * Language codes that are currently expanded.
   * If there are 3 or fewer language groups, start all expanded.
   * Otherwise start all collapsed.
   */
  let expandedLanguages = $state<Set<string>>(new Set());

  // Initialise expansion state whenever the groups change.
  $effect(() => {
    const codes = languageGroups.map((g) => g.languageCode);
    if (codes.length <= 3) {
      expandedLanguages = new Set(codes);
    } else {
      expandedLanguages = new Set();
    }
  });

  /** Toggle a language group open/closed. */
  function toggleLanguage(code: string): void {
    const next = new Set(expandedLanguages);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    expandedLanguages = next;
  }

  /** Language code whose options panel is currently open (null = closed). */
  let openOptionsLang = $state<string | null>(null);

  /** Toggle the options dropdown for a given language code. */
  function toggleOptions(langCode: string): void {
    openOptionsLang = openOptionsLang === langCode ? null : langCode;
  }

  /** Currently selected deck ID (highlighted row). */
  let selectedDeckId = $state<string | null>(null);

  /** Handle deck row click. */
  function handleDeckClick(deckId: string, status: string): void {
    if (status !== 'available') return;
    selectedDeckId = deckId;
    onDeckSelect(deckId);
  }
</script>

<div class="vocab-tree" role="tree" aria-label="Vocabulary decks by language">
  {#if languageGroups.length === 0}
    <div class="empty-state">
      <p class="empty-title">No vocabulary decks available</p>
      <p class="empty-sub">Language decks are coming soon.</p>
    </div>
  {:else}
    {#each languageGroups as group (group.languageCode)}
      {@const isExpanded = expandedLanguages.has(group.languageCode)}
      <div class="language-group" role="treeitem" aria-expanded={isExpanded} aria-selected={false}>
        <!-- Language header / toggle -->
        <div class="language-header-row">
          <button
            class="language-header"
            class:expanded={isExpanded}
            onclick={() => toggleLanguage(group.languageCode)}
            aria-label="{group.languageName}, {group.decks.length} decks, {isExpanded ? 'collapse' : 'expand'}"
          >
            <span class="expand-chevron" aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
            <span class="lang-flag" aria-hidden="true">{group.languageFlag}</span>
            <span class="lang-name">{group.languageName}</span>
            <span class="deck-count">{group.decks.length} {group.decks.length === 1 ? 'deck' : 'decks'}</span>
          </button>

          {#if (getLanguageConfig(group.languageCode)?.options?.length ?? 0) > 0}
            <button
              class="options-cogwheel"
              class:options-cogwheel-active={openOptionsLang === group.languageCode}
              onclick={(e) => { e.stopPropagation(); toggleOptions(group.languageCode); }}
              aria-label="Language display options for {group.languageName}"
              type="button"
            >⚙ Settings</button>
          {/if}
        </div>

        {#if openOptionsLang === group.languageCode}
          <div class="options-dropdown">
            <DeckOptionsPanel languageCode={group.languageCode} />
          </div>
        {/if}

        <!-- Deck rows -->
        {#if isExpanded}
          <div class="deck-list" role="group">
            <!-- Study all decks in this language — opens detail panel via synthetic ID -->
            <button
              class="study-all-language-btn"
              onclick={() => onDeckSelect('all:' + group.languageCode)}
              aria-label="Study all {group.languageName} decks"
            >
              <span class="study-all-icon">▶</span>
              Study All {group.languageName}
            </button>
            {#each group.decks as deck (deck.id)}
              {@const progress = getDeckProgress(deck.id)}
              {@const isAvailable = deck.status === 'available'}
              {@const isSelected = selectedDeckId === deck.id}
              {@const progressPct = Math.min(100, Math.max(0, progress.progressPercent))}
              <button
                class="deck-row"
                class:selected={isSelected}
                class:unavailable={!isAvailable}
                onclick={() => handleDeckClick(deck.id, deck.status)}
                disabled={!isAvailable}
                aria-label="{deck.name}, {deck.factCount} facts, {progressPct}% complete{!isAvailable ? ', coming soon' : ''}"
                role="treeitem"
                aria-selected={isSelected}
              >
                <span class="deck-name">{deck.name}</span>
                <span class="deck-facts">{deck.factCount.toLocaleString()} facts</span>
                <div class="mini-progress">
                  <div class="mini-track">
                    <div class="mini-fill" style="width: {progressPct}%"></div>
                  </div>
                  <span class="mini-pct">{progressPct}%</span>
                </div>
                {#if !isAvailable}
                  <span class="soon-badge">Soon</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  /* ------------------------------------------------------------------ */
  /* Container                                                            */
  /* ------------------------------------------------------------------ */
  .vocab-tree {
    padding: calc(12px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    box-sizing: border-box;
  }

  /* ------------------------------------------------------------------ */
  /* Empty state                                                          */
  /* ------------------------------------------------------------------ */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(60px * var(--layout-scale, 1));
    color: #4b5563;
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

  /* ------------------------------------------------------------------ */
  /* Language group                                                       */
  /* ------------------------------------------------------------------ */
  .language-group {
    border-radius: calc(10px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.07);
    overflow: hidden;
    background: #111827;
  }

  .language-header {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
    padding: calc(12px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    color: #e2e8f0;
  }

  .language-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .language-header.expanded {
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .expand-chevron {
    font-size: calc(9px * var(--text-scale, 1));
    color: #64748b;
    flex-shrink: 0;
    width: calc(10px * var(--layout-scale, 1));
    text-align: center;
  }

  .lang-flag {
    font-size: calc(20px * var(--text-scale, 1));
    line-height: 1;
    flex-shrink: 0;
  }

  .lang-name {
    flex: 1;
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.01em;
  }

  .deck-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    flex-shrink: 0;
  }

  /* ------------------------------------------------------------------ */
  /* Deck list                                                            */
  /* ------------------------------------------------------------------ */
  .deck-list {
    display: flex;
    flex-direction: column;
  }

  /* ------------------------------------------------------------------ */
  /* Individual deck row                                                  */
  /* ------------------------------------------------------------------ */
  .deck-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) calc(34px * var(--layout-scale, 1));
    background: transparent;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    color: #cbd5e1;
    position: relative;
  }

  .deck-row:first-child {
    border-top: none;
  }

  .deck-row:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.04);
  }

  .deck-row.selected {
    background: rgba(99, 102, 241, 0.12);
    /* Left accent border */
    box-shadow: inset calc(3px * var(--layout-scale, 1)) 0 0 #6366f1;
  }

  .deck-row.unavailable {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .deck-name {
    flex: 1;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 500;
    color: #e2e8f0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .deck-facts {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* ------------------------------------------------------------------ */
  /* Mini progress bar                                                    */
  /* ------------------------------------------------------------------ */
  .mini-progress {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    width: calc(100px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .mini-track {
    flex: 1;
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.1);
    border-radius: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .mini-fill {
    height: 100%;
    background: #4ade80;
    border-radius: calc(2px * var(--layout-scale, 1));
    transition: width 0.3s;
  }

  .mini-pct {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4ade80;
    font-weight: 600;
    flex-shrink: 0;
    min-width: calc(28px * var(--layout-scale, 1));
    text-align: right;
  }

  /* ------------------------------------------------------------------ */
  /* Language header row (wraps header button + cogwheel)                */
  /* ------------------------------------------------------------------ */
  .language-header-row {
    display: flex;
    align-items: stretch;
    position: relative;
  }

  .language-header-row .language-header {
    flex: 1;
  }

  .options-cogwheel {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(4px * var(--layout-scale, 1));
    flex-shrink: 0;
    margin: calc(6px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    background: #b45309;
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    color: #fff;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    transition: background 0.15s, box-shadow 0.15s;
    white-space: nowrap;
  }

  .options-cogwheel:hover {
    background: #d97706;
    box-shadow: 0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(180, 83, 9, 0.4);
  }

  .options-cogwheel.options-cogwheel-active {
    background: #92400e;
    box-shadow: inset 0 1px calc(3px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
  }

  .options-dropdown {
    padding: calc(10px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.25);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* ------------------------------------------------------------------ */
  /* Study All Language button                                            */
  /* ------------------------------------------------------------------ */
  .study-all-language-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    background: rgba(99, 102, 241, 0.12);
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    text-align: left;
    color: #a5b4fc;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
  }

  .study-all-language-btn:hover {
    background: rgba(99, 102, 241, 0.22);
    color: #c7d2fe;
  }

  .study-all-icon {
    font-size: calc(10px * var(--text-scale, 1));
    color: #818cf8;
    flex-shrink: 0;
  }

  /* ------------------------------------------------------------------ */
  /* Coming-soon badge                                                    */
  /* ------------------------------------------------------------------ */
  .soon-badge {
    font-size: calc(9px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(5px * var(--layout-scale, 1));
    flex-shrink: 0;
  }
</style>
