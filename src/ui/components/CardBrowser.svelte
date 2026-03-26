<script lang="ts">
  import type { Card } from '../../data/card-types';
  import { isLandscape } from '../../stores/layoutStore';

  interface Props {
    /** Cards to display in the browser. */
    cards: Card[];
    /** 'select' = tap to choose one. 'view' = read-only (no select action). */
    mode: 'select' | 'view';
    /** Header text displayed at the top. E.g. "Draw Pile", "Discard Pile", "Exhausted". */
    title: string;
    /** Called when the player taps a card in 'select' mode. */
    onSelect?: (card: Card) => void;
    /** Called when the player dismisses the browser without selecting. */
    onDismiss: () => void;
    /** If true, show the card's quiz question and answer fields (Siphon Knowledge mode). */
    showAnswers?: boolean;
    /** If provided, show a timer countdown bar. Viewer closes when it hits 0. */
    timerSeconds?: number;
  }

  let {
    cards,
    mode,
    title,
    onSelect,
    onDismiss,
    showAnswers = false,
    timerSeconds,
  }: Props = $props();

  let selectedCardId = $state<string | null>(null);
  let timerRemaining = $state(0);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Card type color dot map
  const TYPE_COLORS: Record<string, string> = {
    attack: '#e94560',
    shield: '#2e86de',
    buff: '#2ecc71',
    debuff: '#9b59b6',
    utility: '#f39c12',
    wild: '#e67e22',
  };

  // Sort cards: by type order then alphabetically by mechanic name / factId
  const TYPE_ORDER: Record<string, number> = {
    attack: 0,
    shield: 1,
    buff: 2,
    debuff: 3,
    utility: 4,
    wild: 5,
  };

  const sortedCards = $derived(
    [...cards].sort((a, b) => {
      const typeDiff = (TYPE_ORDER[a.cardType] ?? 99) - (TYPE_ORDER[b.cardType] ?? 99);
      if (typeDiff !== 0) return typeDiff;
      return (a.mechanicName ?? a.factId ?? '').localeCompare(b.mechanicName ?? b.factId ?? '');
    })
  );

  $effect(() => {
    const seconds = timerSeconds;
    if (seconds && seconds > 0) {
      timerRemaining = seconds;
      timerInterval = setInterval(() => {
        timerRemaining -= 1;
        if (timerRemaining <= 0) {
          if (timerInterval) clearInterval(timerInterval);
          timerInterval = null;
          onDismiss();
        }
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  function handleRowClick(card: Card) {
    if (mode !== 'select') return;
    selectedCardId = card.id;
    onSelect?.(card);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onDismiss();
    }
  }

  const timerPct = $derived(timerSeconds != null && timerSeconds > 0 ? (timerRemaining / timerSeconds) * 100 : 100);
</script>

<!-- Portrait: full-screen overlay with backdrop. Landscape: right-side panel docked. -->
{#if $isLandscape}
  <div class="card-browser-panel landscape" data-testid="card-browser" role="dialog" aria-label={title}>
    <div class="browser-header">
      <span class="browser-title">{title}</span>
      <button class="close-btn" onclick={onDismiss} aria-label="Close">✕</button>
    </div>
    {#if timerSeconds}
      <div class="timer-bar-track">
        <div class="timer-bar-fill" style="width: {timerPct}%"></div>
      </div>
    {/if}
    <div class="card-list">
      {#if sortedCards.length === 0}
        <div class="empty-state">No cards</div>
      {:else}
        {#each sortedCards as card, i}
          {@const isSelected = selectedCardId === card.id}
          <button
            class="card-row"
            class:selectable={mode === 'select'}
            class:selected={isSelected}
            class:removed={card.isRemovedFromGame}
            onclick={() => handleRowClick(card)}
            disabled={mode === 'view'}
            data-testid="card-browser-row-{i}"
            aria-pressed={isSelected}
          >
            <span class="type-dot" style="background:{TYPE_COLORS[card.cardType] ?? '#888'}"></span>
            <div class="card-info">
              <span class="card-name">
                {card.mechanicName ?? card.factId ?? 'Unknown'}
                {#if card.isRemovedFromGame}<span class="removed-badge">INSCRIBED</span>{/if}
              </span>
              <span class="card-mechanic">{card.cardType} · AP {card.apCost ?? '?'}</span>
              {#if showAnswers}
                {@const fact = card as Card & { factQuestion?: string; factAnswer?: string }}
                {#if fact.factQuestion}
                  <span class="fact-question">{fact.factQuestion}</span>
                {/if}
                {#if fact.factAnswer}
                  <span class="fact-answer">{fact.factAnswer}</span>
                {/if}
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
{:else}
  <!-- Portrait: full-screen modal with backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="card-browser-backdrop" onclick={handleBackdropClick} data-testid="card-browser">
    <div class="card-browser-panel portrait" role="dialog" aria-label={title}>
      <div class="browser-header">
        <span class="browser-title">{title}</span>
        <button class="close-btn" onclick={onDismiss} aria-label="Close">✕</button>
      </div>
      {#if timerSeconds}
        <div class="timer-bar-track">
          <div class="timer-bar-fill" style="width: {timerPct}%"></div>
        </div>
      {/if}
      <div class="card-list">
        {#if sortedCards.length === 0}
          <div class="empty-state">No cards</div>
        {:else}
          {#each sortedCards as card, i}
            {@const isSelected = selectedCardId === card.id}
            <button
              class="card-row"
              class:selectable={mode === 'select'}
              class:selected={isSelected}
              class:removed={card.isRemovedFromGame}
              onclick={() => handleRowClick(card)}
              disabled={mode === 'view'}
              data-testid="card-browser-row-{i}"
              aria-pressed={isSelected}
            >
              <span class="type-dot" style="background:{TYPE_COLORS[card.cardType] ?? '#888'}"></span>
              <div class="card-info">
                <span class="card-name">
                  {card.mechanicName ?? card.factId ?? 'Unknown'}
                  {#if card.isRemovedFromGame}<span class="removed-badge">INSCRIBED</span>{/if}
                </span>
                <span class="card-mechanic">{card.cardType} · AP {card.apCost ?? '?'}</span>
                {#if showAnswers}
                  {@const fact = card as Card & { factQuestion?: string; factAnswer?: string }}
                  {#if fact.factQuestion}
                    <span class="fact-question">{fact.factQuestion}</span>
                  {/if}
                  {#if fact.factAnswer}
                    <span class="fact-answer">{fact.factAnswer}</span>
                  {/if}
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Backdrop (portrait only) */
  .card-browser-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 500;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    pointer-events: auto;
  }

  /* Panel shared styles */
  .card-browser-panel {
    background: #12192e;
    border: 1px solid #1e3a6e;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Portrait: full-screen overlay */
  .card-browser-panel.portrait {
    width: 100%;
    max-height: 80vh;
    border-radius: 16px 16px 0 0;
    border-bottom: none;
  }

  /* Landscape: right-side panel */
  .card-browser-panel.landscape {
    position: fixed;
    top: 0;
    right: 0;
    width: 40%;
    height: 100%;
    z-index: 500;
    border-radius: 0;
    border-right: none;
    border-top: none;
    border-bottom: none;
  }

  .browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #1e3a6e;
    flex-shrink: 0;
  }

  .browser-title {
    font-family: var(--font-rpg);
    font-size: 11px;
    color: #e0e0e0;
    letter-spacing: 0.5px;
  }

  .close-btn {
    background: transparent;
    border: 1px solid #1e3a6e;
    color: #888;
    font-size: 14px;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: color 0.15s, border-color 0.15s;
  }

  .close-btn:hover {
    color: #e0e0e0;
    border-color: #4a90d9;
  }

  /* Timer bar */
  .timer-bar-track {
    height: 3px;
    background: #1e3a6e;
    flex-shrink: 0;
  }

  .timer-bar-fill {
    height: 100%;
    background: #4a90d9;
    transition: width 1s linear;
  }

  /* Card list */
  .card-list {
    overflow-y: auto;
    flex: 1;
    padding: 4px 0;
  }

  .empty-state {
    color: #666;
    font-size: 12px;
    text-align: center;
    padding: 32px 16px;
    font-family: var(--font-rpg);
  }

  /* Card row */
  .card-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-bottom: 1px solid #1a2a4a;
    cursor: default;
    text-align: left;
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .card-row.selectable {
    cursor: pointer;
  }

  .card-row.selectable:hover,
  .card-row.selectable:focus-visible {
    background: #1a2a4a;
    outline: none;
  }

  .card-row.selected {
    background: #1e3a6e;
    border-left: 3px solid #4a90d9;
    padding-left: 11px;
  }

  .card-row.removed {
    opacity: 0.7;
  }

  .card-row:disabled {
    cursor: default;
  }

  .type-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 5px;
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .card-name {
    font-weight: bold;
    font-size: 12px;
    color: #e0e0e0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .removed-badge {
    font-size: 8px;
    font-family: var(--font-rpg);
    color: #f39c12;
    margin-left: 6px;
    vertical-align: middle;
  }

  .card-mechanic {
    font-size: 10px;
    color: #888;
  }

  .fact-question {
    font-size: 10px;
    color: #aaa;
    margin-top: 3px;
    white-space: normal;
    line-height: 1.4;
  }

  .fact-answer {
    font-size: 10px;
    color: #2ecc71;
    font-weight: bold;
  }
</style>
