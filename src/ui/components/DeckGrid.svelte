<script lang="ts">
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import { getDeckProgress } from '../../services/deckProgressService';
  import DeckTile from './DeckTile.svelte';

  interface Props {
    /** Decks to display in the grid. */
    decks: DeckRegistryEntry[];
    /** Called when a deck tile is clicked. */
    onDeckSelect: (deckId: string) => void;
  }

  let { decks, onDeckSelect }: Props = $props();
</script>

{#if decks.length === 0}
  <div class="empty-grid">
    <p class="empty-title">No decks available</p>
    <p class="empty-sub">Decks for this domain are coming soon.</p>
  </div>
{:else}
  <div class="deck-grid">
    {#each decks as deck (deck.id)}
      {@const progress = getDeckProgress(deck.id)}
      <DeckTile
        {deck}
        {progress}
        onclick={() => onDeckSelect(deck.id)}
      />
    {/each}
  </div>
{/if}

<style>
  .deck-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(16px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    align-content: start;
    overflow-y: auto;
  }

  @media (max-width: 1400px) {
    .deck-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .deck-grid {
      grid-template-columns: repeat(1, minmax(0, 1fr));
    }
  }

  .empty-grid {
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
</style>
