<script lang="ts">
  import { onMount } from 'svelte';
  import {
    isWorkshopAvailable,
    browseWorkshopDecks,
    getMyPublishedDecks,
    subscribeToWorkshopDeck,
    publishToWorkshop,
    type WorkshopDeck,
  } from '../../services/workshopService';
  import type { PersonalDeck } from '../../data/curatedDeckTypes';

  interface Props {
    /** Personal decks available for publishing. */
    personalDecks?: PersonalDeck[];
    /** Called after a successful subscription so the caller can re-register decks. */
    onSubscribed?: (deckId: string, deckName: string) => void;
  }

  let { personalDecks = [], onSubscribed }: Props = $props();

  const workshopAvailable = isWorkshopAvailable();

  let searchQuery = $state('');
  let browseResults = $state<WorkshopDeck[]>([]);
  let myDecks = $state<WorkshopDeck[]>([]);
  let activeView = $state<'browse' | 'mine'>('browse');
  let loading = $state(false);
  let statusMessage = $state<string | null>(null);
  let showPublishDialog = $state(false);
  let publishDeckId = $state('');
  let publishTitle = $state('');
  let publishDescription = $state('');
  let publishTags = $state('');
  let publishLoading = $state(false);

  /** Mock data shown while Tauri UGC commands are not yet wired. */
  const MOCK_DECKS: WorkshopDeck[] = [
    {
      workshopId: 'mock_001',
      deckId: '',
      title: 'JLPT N5 Vocabulary (Community)',
      description: 'A community-curated set of 500 essential N5 vocabulary words with example sentences.',
      tags: ['japanese', 'jlpt', 'vocabulary', 'n5'],
      authorSteamId: '76561198000000001',
      authorName: 'KanjiSensei',
      subscriberCount: 1243,
      upvotes: 892,
      downvotes: 14,
      createdAt: 1712000000,
      updatedAt: 1714000000,
    },
    {
      workshopId: 'mock_002',
      deckId: '',
      title: 'AP Biology Core Concepts',
      description: 'Covers all major units from the AP Biology CED including cell biology, genetics, and evolution.',
      tags: ['biology', 'ap-exam', 'science', 'high-school'],
      authorSteamId: '76561198000000002',
      authorName: 'BioNerd42',
      subscriberCount: 674,
      upvotes: 501,
      downvotes: 8,
      createdAt: 1711000000,
      updatedAt: 1713500000,
    },
    {
      workshopId: 'mock_003',
      deckId: '',
      title: 'World Capitals Quiz Pack',
      description: 'All 195 world capitals. Great for travel trivia and geography enthusiasts.',
      tags: ['geography', 'capitals', 'world', 'trivia'],
      authorSteamId: '76561198000000003',
      authorName: 'GeoQuizzer',
      subscriberCount: 3102,
      upvotes: 2874,
      downvotes: 31,
      createdAt: 1705000000,
      updatedAt: 1712000000,
    },
  ];

  async function loadBrowse() {
    if (!workshopAvailable) {
      browseResults = MOCK_DECKS;
      return;
    }
    loading = true;
    browseResults = await browseWorkshopDecks(searchQuery || undefined);
    loading = false;
  }

  async function loadMine() {
    if (!workshopAvailable) {
      myDecks = [];
      return;
    }
    loading = true;
    myDecks = await getMyPublishedDecks();
    loading = false;
  }

  async function handleSubscribe(deck: WorkshopDeck) {
    if (!workshopAvailable) {
      statusMessage = 'Workshop requires the Steam desktop build.';
      return;
    }
    loading = true;
    statusMessage = `Subscribing to "${deck.title}"...`;
    const result = await subscribeToWorkshopDeck(deck.workshopId);
    loading = false;
    if ('error' in result) {
      statusMessage = `Subscribe failed: ${result.error}`;
    } else {
      statusMessage = `Subscribed! "${deck.title}" added to My Decks.`;
      onSubscribed?.(result.deckId, result.deckName);
    }
  }

  function handleOpenPublish(deckId: string) {
    const deck = personalDecks.find(d => d.id === deckId);
    if (!deck) return;
    publishDeckId = deckId;
    publishTitle = deck.name;
    publishDescription = deck.description ?? '';
    publishTags = '';
    showPublishDialog = true;
  }

  async function handlePublish() {
    const deck = personalDecks.find(d => d.id === publishDeckId);
    if (!deck) return;
    if (!workshopAvailable) {
      statusMessage = 'Workshop requires the Steam desktop build.';
      showPublishDialog = false;
      return;
    }
    publishLoading = true;
    const tags = publishTags.split(',').map(t => t.trim()).filter(Boolean);
    const result = await publishToWorkshop(deck, publishTitle, publishDescription, tags);
    publishLoading = false;
    showPublishDialog = false;
    if ('error' in result) {
      statusMessage = `Publish failed: ${result.error}`;
    } else {
      statusMessage = `Published! Workshop ID: ${result.workshopId}`;
      await loadMine();
    }
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') loadBrowse();
  }

  onMount(() => {
    loadBrowse();
  });

  $effect(() => {
    if (activeView === 'mine') loadMine();
    else loadBrowse();
  });
</script>

<div class="workshop-browser">
  <!-- Header -->
  <div class="workshop-header">
    <div class="header-left">
      <span class="workshop-icon">&#x2692;</span>
      <h2 class="workshop-title">Steam Workshop</h2>
    </div>
    {#if !workshopAvailable}
      <span class="unavailable-badge">Requires Steam Build</span>
    {:else}
      <span class="available-badge">Workshop Available</span>
    {/if}
  </div>

  <!-- View tabs -->
  <div class="view-tabs">
    <button
      class="tab-btn"
      class:active={activeView === 'browse'}
      onclick={() => { activeView = 'browse'; }}
      type="button"
    >Browse</button>
    <button
      class="tab-btn"
      class:active={activeView === 'mine'}
      onclick={() => { activeView = 'mine'; }}
      type="button"
    >My Published Decks</button>
  </div>

  {#if activeView === 'browse'}
    <!-- Search row -->
    <div class="search-row">
      <input
        class="search-input"
        type="text"
        placeholder="Search Workshop decks..."
        bind:value={searchQuery}
        onkeydown={handleSearchKeydown}
      />
      <button class="search-btn" onclick={loadBrowse} type="button">Search</button>
    </div>
  {/if}

  {#if !workshopAvailable}
    <div class="notice-banner">
      <p class="notice-text">
        Steam Workshop is only available in the Steam desktop build of Recall Rogue.
        Browse the preview below to see what will be available.
      </p>
    </div>
  {/if}

  {#if statusMessage}
    <div class="status-bar">
      <span class="status-text">{statusMessage}</span>
      <button class="status-close" onclick={() => { statusMessage = null; }} type="button">x</button>
    </div>
  {/if}

  <!-- Deck grid -->
  {#if loading}
    <div class="loading-state">Loading...</div>
  {:else if activeView === 'browse'}
    {#if browseResults.length === 0}
      <div class="empty-state">
        <p class="empty-title">No Workshop decks found</p>
        <p class="empty-sub">{workshopAvailable ? 'Try a different search.' : 'Workshop preview — mock data shown.'}</p>
      </div>
    {:else}
      <div class="deck-grid">
        {#each browseResults as item (item.workshopId)}
          <div class="deck-card">
            <div class="deck-card-header">
              <h3 class="deck-card-title">{item.title}</h3>
              <span class="deck-subscribers">{item.subscriberCount.toLocaleString()} subscribers</span>
            </div>
            <p class="deck-card-desc">{item.description}</p>
            <div class="deck-card-tags">
              {#each item.tags as tag (tag)}
                <span class="tag">{tag}</span>
              {/each}
            </div>
            <div class="deck-card-footer">
              <span class="deck-author">by {item.authorName}</span>
              <div class="deck-votes">
                <span class="vote-up">+ {item.upvotes}</span>
                <span class="vote-down">- {item.downvotes}</span>
              </div>
              <button
                class="subscribe-btn"
                onclick={() => handleSubscribe(item)}
                disabled={loading}
                type="button"
              >Subscribe</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- My Published Decks -->
    {#if myDecks.length === 0}
      <div class="empty-state">
        <p class="empty-title">No published decks yet</p>
        <p class="empty-sub">Publish one of your personal decks to share it with the community.</p>
      </div>
    {:else}
      <div class="deck-grid">
        {#each myDecks as item (item.workshopId)}
          <div class="deck-card">
            <h3 class="deck-card-title">{item.title}</h3>
            <p class="deck-card-desc">{item.description}</p>
            <div class="deck-card-footer">
              <span class="deck-subscribers">{item.subscriberCount.toLocaleString()} subscribers</span>
              <div class="deck-votes">
                <span class="vote-up">+ {item.upvotes}</span>
                <span class="vote-down">- {item.downvotes}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Publish personal deck section -->
    {#if personalDecks.length > 0}
      <div class="publish-section">
        <h3 class="publish-heading">Publish a Deck</h3>
        <div class="publish-deck-list">
          {#each personalDecks as deck (deck.id)}
            <div class="publish-deck-row">
              <span class="publish-deck-name">{deck.name}</span>
              <span class="publish-deck-facts">{deck.facts.length} facts</span>
              <button
                class="publish-btn"
                onclick={() => handleOpenPublish(deck.id)}
                type="button"
              >Publish to Workshop</button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Publish dialog -->
{#if showPublishDialog}
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-label="Publish to Workshop">
    <div class="dialog-box">
      <h2 class="dialog-title">Publish to Steam Workshop</h2>

      <label class="dialog-label" for="ws-title">Title</label>
      <input id="ws-title" class="dialog-input" type="text" bind:value={publishTitle} maxlength="128" />

      <label class="dialog-label" for="ws-desc">Description</label>
      <textarea id="ws-desc" class="dialog-textarea" bind:value={publishDescription} rows="4" maxlength="1024"></textarea>

      <label class="dialog-label" for="ws-tags">Tags (comma-separated)</label>
      <input id="ws-tags" class="dialog-input" type="text" bind:value={publishTags} placeholder="e.g. japanese, vocabulary, n5" />

      <div class="dialog-actions">
        <button
          class="dialog-cancel"
          onclick={() => { showPublishDialog = false; }}
          disabled={publishLoading}
          type="button"
        >Cancel</button>
        <button
          class="dialog-confirm"
          onclick={handlePublish}
          disabled={publishLoading || !publishTitle.trim()}
          type="button"
        >{publishLoading ? 'Publishing...' : 'Publish'}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .workshop-browser {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    color: #e0e0e0;
  }

  .workshop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .workshop-icon {
    font-size: calc(20px * var(--text-scale, 1));
  }

  .workshop-title {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 700;
    color: #c4b5fd;
  }

  .available-badge {
    font-size: calc(11px * var(--text-scale, 1));
    background: rgba(34, 197, 94, 0.15);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
  }

  .unavailable-badge {
    font-size: calc(11px * var(--text-scale, 1));
    background: rgba(245, 158, 11, 0.12);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
  }

  .view-tabs {
    display: flex;
    gap: calc(4px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
  }

  .tab-btn {
    background: none;
    border: none;
    border-bottom: calc(2px * var(--layout-scale, 1)) solid transparent;
    cursor: pointer;
    color: #8b949e;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    transition: color 0.15s, border-color 0.15s;
  }

  .tab-btn.active {
    color: #c4b5fd;
    border-bottom-color: #7c3aed;
  }

  .tab-btn:hover:not(.active) {
    color: #e0e0e0;
  }

  .search-row {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .search-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    outline: none;
  }

  .search-input:focus {
    border-color: rgba(124, 58, 237, 0.5);
  }

  .search-btn {
    background: rgba(124, 58, 237, 0.25);
    border: 1px solid rgba(124, 58, 237, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #c4b5fd;
    cursor: pointer;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
  }

  .search-btn:hover {
    background: rgba(124, 58, 237, 0.4);
  }

  .notice-banner {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
  }

  .notice-text {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #fcd34d;
    line-height: 1.5;
  }

  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .status-text {
    font-size: calc(12px * var(--text-scale, 1));
    color: #c4b5fd;
  }

  .status-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #8b949e;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(2px * var(--layout-scale, 1));
  }

  .loading-state {
    padding: calc(32px * var(--layout-scale, 1));
    text-align: center;
    color: #8b949e;
    font-size: calc(13px * var(--text-scale, 1));
  }

  .empty-state {
    padding: calc(32px * var(--layout-scale, 1));
    text-align: center;
  }

  .empty-title {
    margin: 0 0 calc(6px * var(--layout-scale, 1));
    font-size: calc(15px * var(--text-scale, 1));
    color: #c4b5fd;
  }

  .empty-sub {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #8b949e;
  }

  .deck-grid {
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
    overflow-y: auto;
    max-height: calc(420px * var(--layout-scale, 1));
  }

  .deck-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .deck-card-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .deck-card-title {
    margin: 0;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #e0e0e0;
  }

  .deck-subscribers {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8b949e;
    white-space: nowrap;
  }

  .deck-card-desc {
    margin: 0;
    font-size: calc(12px * var(--text-scale, 1));
    color: #a0a0b0;
    line-height: 1.5;
  }

  .deck-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .tag {
    font-size: calc(10px * var(--text-scale, 1));
    background: rgba(124, 58, 237, 0.15);
    color: #c4b5fd;
    border: 1px solid rgba(124, 58, 237, 0.25);
    border-radius: calc(3px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
  }

  .deck-card-footer {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .deck-author {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8b949e;
    flex: 1;
  }

  .deck-votes {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
  }

  .vote-up {
    color: #86efac;
  }

  .vote-down {
    color: #f87171;
  }

  .subscribe-btn {
    background: rgba(124, 58, 237, 0.25);
    border: 1px solid rgba(124, 58, 237, 0.4);
    border-radius: calc(5px * var(--layout-scale, 1));
    color: #c4b5fd;
    cursor: pointer;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .subscribe-btn:hover:not(:disabled) {
    background: rgba(124, 58, 237, 0.4);
  }

  .subscribe-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Publish section */
  .publish-section {
    margin-top: calc(16px * var(--layout-scale, 1));
    border-top: 1px solid rgba(99, 102, 241, 0.15);
    padding-top: calc(14px * var(--layout-scale, 1));
  }

  .publish-heading {
    margin: 0 0 calc(10px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #c4b5fd;
  }

  .publish-deck-list {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .publish-deck-row {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .publish-deck-name {
    flex: 1;
    font-size: calc(13px * var(--text-scale, 1));
    color: #e0e0e0;
  }

  .publish-deck-facts {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8b949e;
  }

  .publish-btn {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: calc(5px * var(--layout-scale, 1));
    color: #fcd34d;
    cursor: pointer;
    font-size: calc(12px * var(--text-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
  }

  .publish-btn:hover {
    background: rgba(245, 158, 11, 0.25);
  }

  /* Publish dialog */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
  }

  .dialog-box {
    background: #151825;
    border: 1px solid rgba(124, 58, 237, 0.4);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(24px * var(--layout-scale, 1));
    width: min(calc(440px * var(--layout-scale, 1)), 90vw);
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .dialog-title {
    margin: 0;
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
    color: #c4b5fd;
  }

  .dialog-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #8b949e;
    margin-bottom: calc(-6px * var(--layout-scale, 1));
  }

  .dialog-input {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(7px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }

  .dialog-textarea {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #e0e0e0;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(7px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    outline: none;
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: calc(10px * var(--layout-scale, 1));
    margin-top: calc(6px * var(--layout-scale, 1));
  }

  .dialog-cancel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #8b949e;
    cursor: pointer;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
  }

  .dialog-confirm {
    background: rgba(124, 58, 237, 0.3);
    border: 1px solid rgba(124, 58, 237, 0.5);
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #c4b5fd;
    cursor: pointer;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    padding: calc(6px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
  }

  .dialog-confirm:hover:not(:disabled) {
    background: rgba(124, 58, 237, 0.45);
  }

  .dialog-confirm:disabled,
  .dialog-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
