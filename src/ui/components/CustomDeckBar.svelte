<script lang="ts">
  import type { CustomDeck } from '../../data/studyPreset';

  interface Props {
    customDecks: CustomDeck[];
    activeCustomDeckId: string | null;
    onSwitchDeck: (id: string) => void;
    onStartCustomRun: () => void;
    onViewDeck: () => void;
  }

  let { customDecks, activeCustomDeckId, onSwitchDeck, onStartCustomRun, onViewDeck }: Props = $props();

  const activeDeck = $derived(
    activeCustomDeckId ? customDecks.find(p => p.id === activeCustomDeckId) ?? null : null
  );

  const activeItems = $derived(activeDeck?.items ?? []);

  const showBar = $derived(customDecks.length > 0 && customDecks.some(p => p.items.length > 0));
</script>

{#if showBar}
  <div class="custom-deck-bar">
    <div class="bar-left">
      <span class="custom-deck-icon">&#128203;</span>
      {#if customDecks.length > 1}
        <select
          class="custom-deck-select"
          value={activeCustomDeckId ?? ''}
          onchange={(e) => onSwitchDeck((e.target as HTMLSelectElement).value)}
        >
          {#each customDecks as deck (deck.id)}
            <option value={deck.id}>{deck.name}</option>
          {/each}
        </select>
      {:else}
        <span class="custom-deck-name">{activeDeck?.name ?? customDecks[0]?.name ?? 'Custom Deck'}</span>
      {/if}
      <span class="custom-deck-meta">
        {#if activeItems.length <= 3}
          {activeItems.map(it => it.label).join(', ')}
        {:else}
          {activeItems.slice(0, 2).map(it => it.label).join(', ')} +{activeItems.length - 2} more
        {/if}
      </span>
    </div>

    <div class="bar-right">
      <button class="btn-view" onclick={onViewDeck}>View</button>
      <button class="btn-start" onclick={onStartCustomRun}>
        <span class="play-icon">&#9654;</span> Start
      </button>
    </div>
  </div>
{/if}

<style>
  .custom-deck-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(90deg, rgba(79, 70, 229, 0.15), rgba(99, 102, 241, 0.12));
    border-top: 1px solid rgba(99, 102, 241, 0.3);
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .bar-left {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    min-width: 0;
  }

  .custom-deck-icon {
    font-size: calc(18px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .custom-deck-name {
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #c4b5fd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(200px * var(--layout-scale, 1));
  }

  .custom-deck-select {
    background: rgba(79, 70, 229, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #c4b5fd;
    font-size: calc(14px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    max-width: calc(200px * var(--layout-scale, 1));
  }

  .custom-deck-select:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.8);
  }

  .custom-deck-meta {
    font-size: calc(12px * var(--text-scale, 1));
    color: #6b7280;
    white-space: nowrap;
  }

  .bar-right {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  .btn-view {
    background: transparent;
    border: 1px solid rgba(99, 102, 241, 0.5);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #818cf8;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 500;
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-view:hover {
    border-color: rgba(99, 102, 241, 0.9);
    color: #a5b4fc;
  }

  .btn-start {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #fff;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    padding: calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-start:hover {
    opacity: 0.88;
  }

  .play-icon {
    font-size: calc(11px * var(--text-scale, 1));
  }
</style>
