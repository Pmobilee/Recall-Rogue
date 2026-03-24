<script lang="ts">
  import { getKnowledgeDomains, getDomainMetadata } from '../../data/domainMetadata';
  import { getAllDecks } from '../../data/deckRegistry';
  import { getDomainSubcategories } from '../../services/domainSubcategoryService';
  import type { DeckRegistryEntry } from '../../data/deckRegistry';

  interface TriviaSelections {
    domains: string[];
    subdomains?: Record<string, string[]>;
  }

  interface StudySelection {
    deckId: string;
    subDeckId?: string;
  }

  interface Props {
    /** Currently selected trivia items. */
    triviaSelections: TriviaSelections;
    /** Currently selected study items. */
    studySelections: StudySelection[];
    /** Called when selections change. */
    onSelectionsChange: (trivia: TriviaSelections, study: StudySelection[]) => void;
  }

  let { triviaSelections, studySelections, onSelectionsChange }: Props = $props();

  // ── Local expand state ──────────────────────────────────────────────────────

  /** Domain IDs expanded to show subdomains in the trivia column. */
  let expandedTriviaDomains = $state<Set<string>>(new Set());
  /** Deck IDs expanded to show sub-decks in the curated column. */
  let expandedDecks = $state<Set<string>>(new Set());

  // ── Data ───────────────────────────────────────────────────────────────────

  /** All knowledge domain metadata. */
  const knowledgeDomains = getKnowledgeDomains().map((id) => getDomainMetadata(id));

  /** All available curated decks. */
  const availableDecks = $derived<DeckRegistryEntry[]>(
    getAllDecks().filter((d) => d.status === 'available'),
  );

  // ── Pool summary ───────────────────────────────────────────────────────────

  interface PoolPill {
    key: string;
    label: string;
    icon: string;
    remove: () => void;
  }

  /** All items in the pool displayed as removable pills. */
  const poolPills = $derived.by<PoolPill[]>(() => {
    const pills: PoolPill[] = [];

    // Trivia whole-domain pills
    for (const domainId of triviaSelections.domains) {
      const subs = triviaSelections.subdomains?.[domainId];
      if (!subs || subs.length === 0) {
        // Whole domain selected
        try {
          const meta = getDomainMetadata(domainId as Parameters<typeof getDomainMetadata>[0]);
          pills.push({
            key: `trivia-domain-${domainId}`,
            label: meta.shortName,
            icon: meta.icon,
            remove: () => removeDomain(domainId),
          });
        } catch {
          // Unknown domain, skip
        }
      } else {
        // Individual subdomains selected
        for (const sub of subs) {
          pills.push({
            key: `trivia-sub-${domainId}-${sub}`,
            label: sub,
            icon: '📂',
            remove: () => removeSubdomain(domainId, sub),
          });
        }
      }
    }

    // Study selection pills
    for (const sel of studySelections) {
      const deck = availableDecks.find((d) => d.id === sel.deckId);
      if (!deck) continue;
      if (sel.subDeckId) {
        const subDeck = deck.subDecks?.find((s) => s.id === sel.subDeckId);
        pills.push({
          key: `study-subdeck-${sel.deckId}-${sel.subDeckId}`,
          label: subDeck ? subDeck.name : sel.subDeckId,
          icon: '📖',
          remove: () => removeStudySubDeck(sel.deckId, sel.subDeckId!),
        });
      } else {
        pills.push({
          key: `study-deck-${sel.deckId}`,
          label: deck.name,
          icon: '📖',
          remove: () => removeStudyDeck(sel.deckId),
        });
      }
    }

    return pills;
  });

  /** Approximate total fact count across pool. */
  const estimatedFactCount = $derived.by<number>(() => {
    let total = 0;

    for (const domainId of triviaSelections.domains) {
      const subs = triviaSelections.subdomains?.[domainId];
      const subcats = getDomainSubcategories(domainId as Parameters<typeof getDomainSubcategories>[0]);
      if (!subs || subs.length === 0) {
        total += subcats.reduce((s, c) => s + c.count, 0);
      } else {
        for (const sub of subs) {
          const cat = subcats.find((c) => c.id === sub);
          total += cat?.count ?? 0;
        }
      }
    }

    for (const sel of studySelections) {
      const deck = availableDecks.find((d) => d.id === sel.deckId);
      if (!deck) continue;
      if (sel.subDeckId) {
        const subDeck = deck.subDecks?.find((s) => s.id === sel.subDeckId);
        total += subDeck?.factCount ?? 0;
      } else {
        total += deck.factCount;
      }
    }

    return total;
  });

  // ── Trivia helpers ─────────────────────────────────────────────────────────

  function isDomainAdded(domainId: string): boolean {
    return triviaSelections.domains.includes(domainId);
  }

  function isSubdomainAdded(domainId: string, subId: string): boolean {
    if (!triviaSelections.domains.includes(domainId)) return false;
    const subs = triviaSelections.subdomains?.[domainId];
    return subs ? subs.includes(subId) : false;
  }

  function addDomain(domainId: string): void {
    if (isDomainAdded(domainId)) return;
    const newDomains = [...triviaSelections.domains, domainId];
    const newSubs = { ...(triviaSelections.subdomains ?? {}) };
    delete newSubs[domainId]; // whole domain = no subdomain filter
    onSelectionsChange({ domains: newDomains, subdomains: newSubs }, studySelections);
  }

  function removeDomain(domainId: string): void {
    const newDomains = triviaSelections.domains.filter((d) => d !== domainId);
    const newSubs = { ...(triviaSelections.subdomains ?? {}) };
    delete newSubs[domainId];
    onSelectionsChange({ domains: newDomains, subdomains: newSubs }, studySelections);
  }

  function addSubdomain(domainId: string, subId: string): void {
    // Ensure domain is in the list
    const newDomains = triviaSelections.domains.includes(domainId)
      ? triviaSelections.domains
      : [...triviaSelections.domains, domainId];

    const currentSubs = triviaSelections.subdomains?.[domainId] ?? [];
    if (currentSubs.includes(subId)) return;
    const newSubs = {
      ...(triviaSelections.subdomains ?? {}),
      [domainId]: [...currentSubs, subId],
    };
    onSelectionsChange({ domains: newDomains, subdomains: newSubs }, studySelections);
  }

  function removeSubdomain(domainId: string, subId: string): void {
    const currentSubs = triviaSelections.subdomains?.[domainId] ?? [];
    const newSubList = currentSubs.filter((s) => s !== subId);
    const newSubs = { ...(triviaSelections.subdomains ?? {}), [domainId]: newSubList };

    // If no subdomains remain for this domain, remove the domain entirely
    let newDomains = triviaSelections.domains;
    if (newSubList.length === 0) {
      newDomains = triviaSelections.domains.filter((d) => d !== domainId);
      delete newSubs[domainId];
    }
    onSelectionsChange({ domains: newDomains, subdomains: newSubs }, studySelections);
  }

  function toggleTriviaExpand(domainId: string): void {
    const next = new Set(expandedTriviaDomains);
    if (next.has(domainId)) {
      next.delete(domainId);
    } else {
      next.add(domainId);
    }
    expandedTriviaDomains = next;
  }

  // ── Study helpers ──────────────────────────────────────────────────────────

  function isDeckAdded(deckId: string): boolean {
    return studySelections.some((s) => s.deckId === deckId && !s.subDeckId);
  }

  function isSubDeckAdded(deckId: string, subDeckId: string): boolean {
    return studySelections.some((s) => s.deckId === deckId && s.subDeckId === subDeckId);
  }

  function addStudyDeck(deckId: string): void {
    if (isDeckAdded(deckId)) return;
    // Remove any individual sub-deck selections for this deck
    const filtered = studySelections.filter((s) => s.deckId !== deckId);
    onSelectionsChange(triviaSelections, [...filtered, { deckId }]);
  }

  function removeStudyDeck(deckId: string): void {
    onSelectionsChange(
      triviaSelections,
      studySelections.filter((s) => s.deckId !== deckId),
    );
  }

  function addStudySubDeck(deckId: string, subDeckId: string): void {
    if (isSubDeckAdded(deckId, subDeckId)) return;
    // Don't add sub-deck if whole deck is already added
    if (isDeckAdded(deckId)) return;
    onSelectionsChange(triviaSelections, [...studySelections, { deckId, subDeckId }]);
  }

  function removeStudySubDeck(deckId: string, subDeckId: string): void {
    onSelectionsChange(
      triviaSelections,
      studySelections.filter((s) => !(s.deckId === deckId && s.subDeckId === subDeckId)),
    );
  }

  function toggleDeckExpand(deckId: string): void {
    const next = new Set(expandedDecks);
    if (next.has(deckId)) {
      next.delete(deckId);
    } else {
      next.add(deckId);
    }
    expandedDecks = next;
  }

  function clearAll(): void {
    onSelectionsChange({ domains: [], subdomains: {} }, []);
  }
</script>

<div class="custom-content">
  <!-- ── Pool summary bar ── -->
  <div class="pool-bar">
    <div class="pool-header">
      <span class="pool-title">
        YOUR CUSTOM POOL
        {#if poolPills.length > 0}
          <span class="pool-count">({poolPills.length} item{poolPills.length !== 1 ? 's' : ''}{estimatedFactCount > 0 ? `, ~${estimatedFactCount.toLocaleString()} facts` : ''})</span>
        {/if}
      </span>
      {#if poolPills.length > 0}
        <button class="clear-btn" onclick={clearAll}>Clear All</button>
      {/if}
    </div>
    {#if poolPills.length === 0}
      <p class="pool-empty">Add domains, subdomains, or curated decks below to build your custom pool.</p>
    {:else}
      <div class="pill-row">
        {#each poolPills as pill (pill.key)}
          <div class="pill">
            <span class="pill-icon">{pill.icon}</span>
            <span class="pill-label">{pill.label}</span>
            <button class="pill-remove" onclick={pill.remove} aria-label="Remove {pill.label}">✕</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ── Two-column picker ── -->
  <div class="picker-area">
    <div class="picker-label">ADD FROM:</div>
    <div class="picker-columns">
      <!-- Left: Trivia domains -->
      <div class="picker-col">
        <div class="col-header">TRIVIA DOMAINS</div>
        <div class="picker-list">
          {#each knowledgeDomains as domain (domain.id)}
            {@const subcats = getDomainSubcategories(domain.id)}
            {@const expanded = expandedTriviaDomains.has(domain.id)}
            {@const added = isDomainAdded(domain.id)}
            <div class="picker-item-group">
              <div class="picker-item">
                <button
                  class="add-btn"
                  class:added
                  onclick={() => (added ? removeDomain(domain.id) : addDomain(domain.id))}
                  aria-label="{added ? 'Remove' : 'Add'} {domain.displayName}"
                >
                  {added ? '−' : '+'}
                </button>
                <button
                  class="item-label"
                  onclick={() => toggleTriviaExpand(domain.id)}
                  aria-expanded={expanded}
                >
                  <span class="item-icon">{domain.icon}</span>
                  <span class="item-name">{domain.displayName}</span>
                  {#if subcats.length > 0}
                    <span class="expand-arrow" class:open={expanded}>›</span>
                  {/if}
                </button>
              </div>
              {#if expanded && subcats.length > 0}
                <div class="sub-list">
                  {#each subcats as sub (sub.id)}
                    {@const subAdded = isSubdomainAdded(domain.id, sub.id)}
                    <div class="picker-item sub-item">
                      <button
                        class="add-btn small"
                        class:added={subAdded}
                        onclick={() => (subAdded ? removeSubdomain(domain.id, sub.id) : addSubdomain(domain.id, sub.id))}
                        aria-label="{subAdded ? 'Remove' : 'Add'} {sub.name}"
                      >
                        {subAdded ? '−' : '+'}
                      </button>
                      <span class="item-name sub-name">{sub.name}</span>
                      <span class="item-count">{sub.count}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Right: Curated decks -->
      <div class="picker-col">
        <div class="col-header">CURATED DECKS</div>
        <div class="picker-list">
          {#if availableDecks.length === 0}
            <p class="col-empty">No curated decks available yet.</p>
          {:else}
            {#each availableDecks as deck (deck.id)}
              {@const expanded = expandedDecks.has(deck.id)}
              {@const added = isDeckAdded(deck.id)}
              <div class="picker-item-group">
                <div class="picker-item">
                  <button
                    class="add-btn"
                    class:added
                    onclick={() => (added ? removeStudyDeck(deck.id) : addStudyDeck(deck.id))}
                    aria-label="{added ? 'Remove' : 'Add'} {deck.name}"
                  >
                    {added ? '−' : '+'}
                  </button>
                  <button
                    class="item-label"
                    onclick={() => toggleDeckExpand(deck.id)}
                    aria-expanded={expanded}
                  >
                    <span class="item-icon">{deck.artPlaceholder.icon}</span>
                    <span class="item-name">{deck.name}</span>
                    {#if deck.subDecks && deck.subDecks.length > 0}
                      <span class="expand-arrow" class:open={expanded}>›</span>
                    {/if}
                  </button>
                </div>
                {#if expanded && deck.subDecks && deck.subDecks.length > 0}
                  <div class="sub-list">
                    {#each deck.subDecks as subDeck (subDeck.id)}
                      {@const subAdded = isSubDeckAdded(deck.id, subDeck.id)}
                      <div class="picker-item sub-item">
                        <button
                          class="add-btn small"
                          class:added={subAdded}
                          disabled={added}
                          onclick={() => (subAdded ? removeStudySubDeck(deck.id, subDeck.id) : addStudySubDeck(deck.id, subDeck.id))}
                          aria-label="{subAdded ? 'Remove' : 'Add'} {subDeck.name}"
                        >
                          {subAdded ? '−' : '+'}
                        </button>
                        <span class="item-name sub-name">{subDeck.name}</span>
                        <span class="item-count">{subDeck.factCount}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .custom-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  /* ── Pool bar ── */
  .pool-bar {
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(15, 20, 40, 0.4);
    min-height: calc(70px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .pool-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .pool-title {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .pool-count {
    font-weight: 400;
    color: #94a3b8;
    text-transform: none;
    letter-spacing: 0;
    margin-left: calc(4px * var(--layout-scale, 1));
  }

  .clear-btn {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    padding: calc(3px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
  }

  .pool-empty {
    font-size: calc(12px * var(--text-scale, 1));
    color: #374151;
    margin: 0;
    padding: calc(4px * var(--layout-scale, 1)) 0;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .pill {
    display: flex;
    align-items: center;
    gap: calc(5px * var(--layout-scale, 1));
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: calc(20px * var(--layout-scale, 1));
    padding: calc(3px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #c7d2fe;
  }

  .pill-icon {
    font-size: calc(13px * var(--text-scale, 1));
  }

  .pill-label {
    font-weight: 500;
    max-width: calc(120px * var(--layout-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pill-remove {
    background: none;
    border: none;
    color: #818cf8;
    cursor: pointer;
    font-size: calc(10px * var(--text-scale, 1));
    padding: 0;
    line-height: 1;
    transition: color 0.12s;
    flex-shrink: 0;
  }

  .pill-remove:hover {
    color: #f87171;
  }

  /* ── Picker area ── */
  .picker-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) 0;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .picker-label {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #4b5563;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .picker-columns {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(16px * var(--layout-scale, 1));
    overflow: hidden;
    min-height: 0;
  }

  .picker-col {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .col-header {
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6366f1;
    text-transform: uppercase;
    flex-shrink: 0;
    padding-bottom: calc(4px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
  }

  .picker-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .picker-item-group {
    display: flex;
    flex-direction: column;
  }

  .picker-item {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    transition: background 0.1s;
  }

  .picker-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .sub-item {
    padding-left: calc(28px * var(--layout-scale, 1));
  }

  .sub-list {
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    margin-left: calc(14px * var(--layout-scale, 1));
  }

  .add-btn {
    width: calc(22px * var(--layout-scale, 1));
    height: calc(22px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    border: 1px solid rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.1);
    color: #818cf8;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .add-btn.small {
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
  }

  .add-btn.added {
    background: rgba(99, 102, 241, 0.35);
    border-color: #6366f1;
    color: #e0e7ff;
  }

  .add-btn:hover:not(.added):not(:disabled) {
    background: rgba(99, 102, 241, 0.25);
    color: #c7d2fe;
  }

  .add-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .item-label {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    flex: 1;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
    color: #cbd5e1;
    min-width: 0;
  }

  .item-label:hover {
    color: #e2e8f0;
  }

  .item-icon {
    font-size: calc(14px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .item-name {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    color: #cbd5e1;
  }

  .sub-name {
    font-weight: 400;
    color: #94a3b8;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .item-count {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4b5563;
    flex-shrink: 0;
  }

  .expand-arrow {
    font-size: calc(14px * var(--text-scale, 1));
    color: #4b5563;
    flex-shrink: 0;
    display: inline-block;
    transition: transform 0.15s;
    transform: rotate(0deg);
  }

  .expand-arrow.open {
    transform: rotate(90deg);
  }

  .col-empty {
    font-size: calc(12px * var(--text-scale, 1));
    color: #374151;
    margin: calc(16px * var(--layout-scale, 1)) 0;
    text-align: center;
  }
</style>
