<script lang="ts">
  import { onMount } from 'svelte'
  import { socialService } from '../../services/socialService'
  import { ApiError } from '../../services/apiClient'
  import type { HubSnapshot, GuestbookEntry } from '../../data/types'
  import GuestbookModal from './GuestbookModal.svelte'
  import GiftModal from './GiftModal.svelte'

  // ============================================================
  // PROPS
  // ============================================================

  interface Props {
    /** Target player ID to visit. */
    playerId: string
    /** Called when the visitor closes the view. */
    onClose: () => void
  }

  let { playerId, onClose }: Props = $props()

  // ============================================================
  // STATE
  // ============================================================

  type Tab = 'knowledge' | 'zoo' | 'farm' | 'gallery' | 'guestbook'

  let snapshot = $state<HubSnapshot | null>(null)
  let loading = $state(true)
  let errorMessage = $state<string | null>(null)
  let isPrivate = $state(false)
  let activeTab = $state<Tab>('knowledge')
  let showGuestbookModal = $state(false)
  let showGiftModal = $state(false)

  // ============================================================
  // DERIVED
  // ============================================================

  const displayName = $derived(snapshot?.displayName ?? '...')
  const factsTotal = $derived(snapshot?.knowledgeTree.totalFacts ?? 0)
  const factsMastered = $derived(snapshot?.knowledgeTree.masteredFacts ?? 0)
  const zooCount = $derived(snapshot?.zoo.totalCount ?? 0)
  const farmCount = $derived(snapshot?.farm.animalCount ?? 0)

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'knowledge', label: 'Knowledge Tree' },
    { id: 'zoo', label: 'Zoo' },
    { id: 'farm', label: 'Farm' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'guestbook', label: 'Guestbook' },
  ]

  // ============================================================
  // LIFECYCLE
  // ============================================================

  onMount(async () => {
    try {
      snapshot = await socialService.getHubSnapshot(playerId)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        isPrivate = true
        errorMessage = "This player's hub is set to private."
      } else if (err instanceof ApiError && err.status === 404) {
        errorMessage = 'Player not found.'
      } else {
        errorMessage = err instanceof Error ? err.message : 'Failed to load hub.'
      }
    } finally {
      loading = false
    }
  })

  // ============================================================
  // HANDLERS
  // ============================================================

  function handleTabClick(tab: Tab): void {
    activeTab = tab
  }

  function handleOpenGuestbook(): void {
    showGuestbookModal = true
  }

  function handleOpenGift(): void {
    showGiftModal = true
  }

  function handleCloseGuestbook(): void {
    showGuestbookModal = false
  }

  function handleCloseGift(): void {
    showGiftModal = false
  }

  /** Flag a guestbook entry for moderation. */
  async function flagEntry(entryId: string): Promise<void> {
    try {
      await socialService.flagGuestbookEntry(playerId, entryId)
      flaggedEntries.add(entryId)
      flaggedEntries = new Set(flaggedEntries)
    } catch {
      // Silently ignore flag errors — best effort
    }
  }

  let flaggedEntries = $state<Set<string>>(new Set())

  /** Formats a timestamp as a relative date string (e.g. "3 days ago"). */
  function formatRelative(ts: number): string {
    const diffMs = Date.now() - ts
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 30) return `${diffDays} days ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  /**
   * Sanitizes text for safe display by replacing characters that could
   * form HTML tags or script injection vectors. This is defense-in-depth —
   * Svelte's template compiler escapes text nodes by default.
   */
  function safeText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
</script>

<!-- ============================================================
     OVERLAY WRAPPER
     ============================================================ -->
<div
  class="hub-visitor-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="Visiting {displayName}'s Hub"
>
  <!-- Close button -->
  <button
    class="close-btn"
    type="button"
    onclick={onClose}
    aria-label="Close visitor view"
  >
    &#x2715;
  </button>

  <!-- ============================================================
       LOADING STATE
       ============================================================ -->
  {#if loading}
    <div class="center-state">
      <div class="spinner" aria-label="Loading hub..."></div>
      <p class="state-label">Loading hub...</p>
    </div>

  <!-- ============================================================
       ERROR / PRIVATE STATE
       ============================================================ -->
  {:else if errorMessage}
    <div class="center-state">
      {#if isPrivate}
        <span class="state-icon" aria-hidden="true">&#x1F512;</span>
      {:else}
        <span class="state-icon" aria-hidden="true">&#x26A0;</span>
      {/if}
      <p class="state-label">{errorMessage}</p>
      <button class="action-btn secondary-btn" type="button" onclick={onClose}>
        Go Back
      </button>
    </div>

  <!-- ============================================================
       MAIN CONTENT
       ============================================================ -->
  {:else if snapshot}
    <!-- Top bar: player identity -->
    <div class="top-bar">
      <div class="identity-row">
        <span class="visitor-icon" aria-hidden="true">&#x1F3E0;</span>
        <div class="identity-info">
          <h1 class="hub-owner-name">{safeText(snapshot.displayName)}</h1>
          <div class="badge-row" aria-label="Player badges">
            {#if snapshot.patronBadge}
              <span class="badge patron-badge" title="Patron">
                {safeText(snapshot.patronBadge)}
              </span>
            {/if}
            {#if snapshot.pioneerBadge}
              <span class="badge pioneer-badge" title="Pioneer — early supporter">
                PIONEER
              </span>
            {/if}
          </div>
        </div>
        <div class="last-active" aria-label="Last active">
          Active {formatRelative(Date.parse(snapshot.lastActive))}
        </div>
      </div>

      <!-- Quick stats row -->
      <div class="stats-row" role="list" aria-label="Hub statistics">
        <div class="stat-chip" role="listitem">
          <span class="stat-value">{factsTotal}</span>
          <span class="stat-label">Facts</span>
        </div>
        <div class="stat-chip" role="listitem">
          <span class="stat-value">{factsMastered}</span>
          <span class="stat-label">Mastered</span>
        </div>
        <div class="stat-chip" role="listitem">
          <span class="stat-value">{zooCount}</span>
          <span class="stat-label">Zoo Animals</span>
        </div>
        <div class="stat-chip" role="listitem">
          <span class="stat-value">{farmCount}</span>
          <span class="stat-label">Farm Species</span>
        </div>
      </div>
    </div>

    <!-- Tab navigation -->
    <div class="tab-bar" role="tablist" aria-label="Hub sections">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:tab-active={activeTab === tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onclick={() => handleTabClick(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Tab content -->
    <div class="tab-content" role="tabpanel" aria-label="{activeTab} tab">

      <!-- Knowledge Tree tab -->
      {#if activeTab === 'knowledge'}
        <div class="content-card">
          <h2 class="card-title">Knowledge Tree</h2>
          <div class="progress-row">
            <span class="progress-label">Completion</span>
            <div class="progress-bar-track" aria-label="{snapshot.knowledgeTree.completionPercent}% complete">
              <div
                class="progress-bar-fill"
                style="width: {Math.min(100, snapshot.knowledgeTree.completionPercent)}%"
              ></div>
            </div>
            <span class="progress-pct">{snapshot.knowledgeTree.completionPercent}%</span>
          </div>
          <p class="top-branch-label">
            Top branch: <strong>{safeText(snapshot.knowledgeTree.topBranch)}</strong>
          </p>
          <div class="category-grid" aria-label="Category breakdown">
            {#each Object.entries(snapshot.knowledgeTree.categoryBreakdown) as [cat, counts]}
              <div class="cat-row">
                <span class="cat-name">{safeText(cat)}</span>
                <span class="cat-counts">{counts.mastered}/{counts.total}</span>
              </div>
            {/each}
          </div>
        </div>

      <!-- Zoo tab -->
      {:else if activeTab === 'zoo'}
        <div class="content-card">
          <h2 class="card-title">Zoo ({snapshot.zoo.totalCount} animals)</h2>
          {#if snapshot.zoo.revived.length === 0}
            <p class="empty-note">No animals revived yet.</p>
          {:else}
            <div class="tag-cloud" aria-label="Revived species">
              {#each snapshot.zoo.revived as speciesId}
                <span class="species-tag">{safeText(speciesId)}</span>
              {/each}
            </div>
            <p class="rarest-label">
              Rarest: <strong>{safeText(snapshot.zoo.rarest)}</strong>
            </p>
          {/if}
        </div>

      <!-- Farm tab -->
      {:else if activeTab === 'farm'}
        <div class="content-card">
          <h2 class="card-title">Farm ({snapshot.farm.animalCount} animals)</h2>
          {#if snapshot.farm.activeSpecies.length === 0}
            <p class="empty-note">No animals in the farm.</p>
          {:else}
            <div class="tag-cloud" aria-label="Active farm species">
              {#each snapshot.farm.activeSpecies as speciesId}
                <span class="species-tag">{safeText(speciesId)}</span>
              {/each}
            </div>
          {/if}
        </div>

      <!-- Gallery tab -->
      {:else if activeTab === 'gallery'}
        <div class="content-card">
          <h2 class="card-title">Gallery</h2>
          {#if snapshot.gallery.achievements.length === 0}
            <p class="empty-note">No achievements unlocked yet.</p>
          {:else}
            <div class="achievement-grid" aria-label="Achievements">
              {#each snapshot.gallery.achievements as ach}
                <div class="achievement-badge">
                  <span class="ach-icon" aria-hidden="true">&#x2B50;</span>
                  <span class="ach-name">{safeText(ach)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- Guestbook tab -->
      {:else if activeTab === 'guestbook'}
        <div class="content-card guestbook-card">
          <h2 class="card-title">Guestbook ({snapshot.guestbook.length} entries)</h2>
          {#if snapshot.guestbook.length === 0}
            <p class="empty-note">No messages yet. Be the first to leave one!</p>
          {:else}
            <div class="guestbook-list" aria-label="Guestbook entries">
              {#each snapshot.guestbook as entry (entry.id)}
                <div class="guestbook-entry">
                  <div class="entry-header">
                    <span class="entry-author">{safeText(entry.authorDisplayName)}</span>
                    <span class="entry-date">{formatRelative(entry.createdAt)}</span>
                    {#if !flaggedEntries.has(entry.id)}
                      <button
                        class="flag-btn"
                        type="button"
                        onclick={() => flagEntry(entry.id)}
                        aria-label="Flag message for moderation"
                        title="Report this message"
                      >&#x2691;</button>
                    {:else}
                      <span class="flagged-label" aria-label="Flagged">Flagged</span>
                    {/if}
                  </div>
                  <p class="entry-message">{safeText(entry.message)}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Action buttons -->
    <div class="action-row">
      <button class="action-btn" type="button" onclick={handleOpenGuestbook}>
        Leave a Message
      </button>
      <button class="action-btn gift-btn" type="button" onclick={handleOpenGift}>
        Send a Gift
      </button>
    </div>
  {/if}
</div>

<!-- ============================================================
     MODALS
     ============================================================ -->
{#if showGuestbookModal && snapshot}
  <GuestbookModal
    {playerId}
    ownerName={snapshot.displayName}
    onClose={handleCloseGuestbook}
  />
{/if}

{#if showGiftModal && snapshot}
  <GiftModal
    {playerId}
    ownerName={snapshot.displayName}
    onClose={handleCloseGift}
  />
{/if}

<style>
  /* ============================================================
     OVERLAY
     ============================================================ */
  .hub-visitor-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: #0d0f14;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
    font-family: inherit;
  }

  /* ============================================================
     CLOSE BUTTON
     ============================================================ */
  .close-btn {
    position: absolute;
    top: 12px;
    right: 14px;
    z-index: 10;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    color: #ccc;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  /* ============================================================
     LOADING / ERROR STATES
     ============================================================ */
  .center-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 180, 0, 0.2);
    border-top-color: #ffb400;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .state-icon {
    font-size: 2.5rem;
  }

  .state-label {
    color: #ccc;
    font-size: 0.95rem;
    text-align: center;
    margin: 0;
  }

  /* ============================================================
     TOP BAR
     ============================================================ */
  .top-bar {
    background: #161922;
    border-bottom: 1px solid rgba(255, 180, 0, 0.15);
    padding: 48px 16px 12px;
    flex-shrink: 0;
  }

  .identity-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  .visitor-icon {
    font-size: 2rem;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .identity-info {
    flex: 1;
    min-width: 0;
  }

  .hub-owner-name {
    color: #ffb400;
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0 0 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .patron-badge {
    background: rgba(180, 120, 255, 0.25);
    color: #c9a0ff;
    border: 1px solid rgba(180, 120, 255, 0.4);
  }

  .pioneer-badge {
    background: rgba(255, 180, 0, 0.2);
    color: #ffb400;
    border: 1px solid rgba(255, 180, 0, 0.4);
  }

  .last-active {
    color: #666;
    font-size: 0.72rem;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 4px;
  }

  /* ============================================================
     STATS ROW
     ============================================================ */
  .stats-row {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .stats-row::-webkit-scrollbar { display: none; }

  .stat-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 180, 0, 0.08);
    border: 1px solid rgba(255, 180, 0, 0.18);
    border-radius: 8px;
    padding: 6px 12px;
    flex-shrink: 0;
    min-width: 60px;
  }

  .stat-value {
    color: #ffb400;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1;
  }

  .stat-label {
    color: #888;
    font-size: 0.65rem;
    margin-top: 2px;
    white-space: nowrap;
  }

  /* ============================================================
     TAB BAR
     ============================================================ */
  .tab-bar {
    display: flex;
    background: #13151c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar { display: none; }

  .tab-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #888;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 10px 14px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: #ccc;
  }

  .tab-active {
    color: #ffb400;
    border-bottom-color: #ffb400;
  }

  /* ============================================================
     TAB CONTENT
     ============================================================ */
  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .content-card {
    background: #161922;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px;
  }

  .card-title {
    color: #ffb400;
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 12px;
  }

  .empty-note {
    color: #666;
    font-size: 0.85rem;
    text-align: center;
    margin: 24px 0;
  }

  /* ============================================================
     KNOWLEDGE TREE TAB
     ============================================================ */
  .progress-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .progress-label {
    color: #aaa;
    font-size: 0.78rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .progress-bar-track {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: #ffb400;
    border-radius: 4px;
    transition: width 0.4s ease;
  }

  .progress-pct {
    color: #ffb400;
    font-size: 0.78rem;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
    min-width: 36px;
    text-align: right;
  }

  .top-branch-label {
    color: #aaa;
    font-size: 0.82rem;
    margin: 0 0 12px;
  }

  .top-branch-label strong {
    color: #ddd;
  }

  .category-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .cat-row:last-child {
    border-bottom: none;
  }

  .cat-name {
    color: #ccc;
    font-size: 0.82rem;
  }

  .cat-counts {
    color: #ffb400;
    font-size: 0.78rem;
    font-weight: 700;
  }

  /* ============================================================
     ZOO / FARM TABS
     ============================================================ */
  .tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .species-tag {
    background: rgba(255, 180, 0, 0.1);
    border: 1px solid rgba(255, 180, 0, 0.25);
    border-radius: 6px;
    color: #e0c060;
    font-size: 0.75rem;
    padding: 3px 8px;
  }

  .rarest-label {
    color: #aaa;
    font-size: 0.82rem;
    margin: 0;
  }

  .rarest-label strong {
    color: #ddd;
  }

  /* ============================================================
     GALLERY TAB
     ============================================================ */
  .achievement-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  .achievement-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 8px;
    text-align: center;
  }

  .ach-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  .ach-name {
    color: #ccc;
    font-size: 0.7rem;
    line-height: 1.3;
    word-break: break-word;
  }

  /* ============================================================
     GUESTBOOK TAB
     ============================================================ */
  .guestbook-card {
    display: flex;
    flex-direction: column;
    min-height: 120px;
  }

  .guestbook-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .guestbook-entry {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 8px;
    padding: 10px 12px;
  }

  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 5px;
  }

  .entry-author {
    color: #ffb400;
    font-size: 0.82rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
    min-width: 0;
  }

  .entry-date {
    color: #555;
    font-size: 0.7rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .entry-message {
    color: #ccc;
    font-size: 0.82rem;
    line-height: 1.5;
    margin: 0;
    word-break: break-word;
  }

  .flag-btn {
    background: none;
    border: none;
    color: #555;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 2px 4px;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .flag-btn:hover {
    color: #ef4444;
  }

  .flagged-label {
    font-size: 0.65rem;
    color: #ef4444;
    flex-shrink: 0;
  }

  /* ============================================================
     ACTION BUTTONS
     ============================================================ */
  .action-row {
    display: flex;
    gap: 10px;
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    background: #13151c;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    flex-shrink: 0;
  }

  .action-btn {
    flex: 1;
    min-height: 44px;
    background: rgba(255, 180, 0, 0.18);
    border: 1px solid rgba(255, 180, 0, 0.4);
    border-radius: 10px;
    color: #ffb400;
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .action-btn:hover {
    background: rgba(255, 180, 0, 0.28);
  }

  .action-btn:active {
    transform: translateY(1px);
  }

  .gift-btn {
    background: rgba(100, 220, 130, 0.12);
    border-color: rgba(100, 220, 130, 0.35);
    color: #64dc82;
  }

  .gift-btn:hover {
    background: rgba(100, 220, 130, 0.22);
  }

  .secondary-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ccc;
    min-width: 120px;
  }

  .secondary-btn:hover {
    background: rgba(255, 255, 255, 0.14);
  }
</style>
