<script lang="ts">
  export let onClose: (() => void) | undefined = undefined

  interface QueueItem {
    id: string
    player_id: string
    fact_text: string
    correct_answer: string
    distractors: string
    category: string
    source_url: string
    source_name: string
    auto_filter_passed: number
    auto_filter_reason: string | null
    upvotes: number
    downvotes: number
    status: string
    submitted_at: string
  }

  type TabStatus = 'admin_review' | 'pending' | 'approved' | 'rejected'

  let queue: QueueItem[] = []
  let loading = true
  let activeTab: TabStatus = 'admin_review'
  let selectedItem: QueueItem | null = null
  let adminKey = ''
  let rejectReason = ''
  let actionInProgress = false
  let errorMsg = ''

  const tabs: { label: string; value: TabStatus }[] = [
    { label: 'Needs Review', value: 'admin_review' },
    { label: 'Community Vote', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ]

  async function loadQueue(tab: TabStatus): Promise<void> {
    if (!adminKey.trim()) { errorMsg = 'Enter admin key first'; return }
    loading = true
    errorMsg = ''
    try {
      const res = await fetch(`/api/ugc/review-queue?status=${tab}`, {
        headers: { 'x-admin-key': adminKey }
      })
      if (!res.ok) {
        errorMsg = `Error ${res.status}: ${(await res.json()).error ?? 'Unknown'}`
        queue = []
      } else {
        const data = await res.json() as { queue: QueueItem[] }
        queue = data.queue
        selectedItem = queue[0] ?? null
      }
    } catch {
      errorMsg = 'Network error loading queue'
    } finally {
      loading = false
    }
  }

  async function reviewSubmission(id: string, action: 'approve' | 'reject', reason?: string): Promise<void> {
    actionInProgress = true
    errorMsg = ''
    try {
      const res = await fetch(`/api/ugc/review/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ action, reason })
      })
      if (!res.ok) {
        errorMsg = `Review failed: ${(await res.json()).error ?? 'Unknown'}`
      } else {
        rejectReason = ''
        await loadQueue(activeTab)
      }
    } catch {
      errorMsg = 'Network error during review'
    } finally {
      actionInProgress = false
    }
  }

  function switchTab(tab: TabStatus): void {
    activeTab = tab
    selectedItem = null
    void loadQueue(tab)
  }

  function parseJson(raw: string): string[] {
    try { return JSON.parse(raw) as string[] } catch { return [] }
  }
</script>

<div class="review-overlay" role="dialog" aria-label="UGC Review Queue">
  <div class="review-panel">
    <div class="review-header">
      <h2>Moderator Dashboard</h2>
      <button class="close-x" on:click={onClose} aria-label="Close">&times;</button>
    </div>

    <!-- Admin key input -->
    <div class="admin-key-row">
      <input
        type="password"
        bind:value={adminKey}
        placeholder="Admin key"
        class="admin-key-input"
        on:keydown={(e) => { if (e.key === 'Enter') void loadQueue(activeTab) }}
      />
      <button class="load-btn" on:click={() => void loadQueue(activeTab)}>Load</button>
    </div>

    {#if errorMsg}
      <p class="error-msg">{errorMsg}</p>
    {/if}

    <!-- Tab bar -->
    <div class="tab-bar" role="tablist">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          on:click={() => switchTab(tab.value)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="panel-layout">
      <!-- Left: item list -->
      <div class="item-list">
        {#if loading}
          <p class="loading-text">Loading...</p>
        {:else if queue.length === 0}
          <p class="empty-text">No submissions in this queue.</p>
        {:else}
          {#each queue as item}
            <button
              class="list-item"
              class:selected={selectedItem?.id === item.id}
              on:click={() => { selectedItem = item; rejectReason = '' }}
            >
              <span class="list-fact">{item.fact_text.slice(0, 60)}...</span>
              <span class="list-meta">{item.upvotes}↑ {item.downvotes}↓</span>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Center: detail card -->
      <div class="detail-card">
        {#if selectedItem}
          <p class="detail-fact">{selectedItem.fact_text}</p>
          <p class="detail-answer"><strong>Answer:</strong> {selectedItem.correct_answer}</p>
          <div class="detail-distractors">
            <strong>Distractors:</strong>
            {#each parseJson(selectedItem.distractors) as d}
              <span class="distractor-badge">{d}</span>
            {/each}
          </div>
          <p class="detail-cat">
            <strong>Category:</strong>
            {#each parseJson(selectedItem.category) as c}
              <span class="cat-badge">{c}</span>
            {/each}
          </p>
          <p class="detail-source">
            <strong>Source:</strong>
            <a href={selectedItem.source_url} target="_blank" rel="noopener noreferrer">
              {selectedItem.source_name || selectedItem.source_url}
            </a>
          </p>
          <div class="detail-flags">
            {#if selectedItem.auto_filter_passed === 0}
              <span class="flag-badge warn">Auto-filter: {selectedItem.auto_filter_reason ?? 'failed'}</span>
            {:else}
              <span class="flag-badge ok">Auto-filter passed</span>
            {/if}
          </div>
          <p class="detail-votes">{selectedItem.upvotes} upvotes / {selectedItem.downvotes} downvotes</p>
          <p class="detail-date">Submitted: {new Date(selectedItem.submitted_at).toLocaleDateString()}</p>
        {:else}
          <p class="empty-text">Select a submission to review.</p>
        {/if}
      </div>

      <!-- Right: action panel -->
      <div class="action-panel">
        {#if selectedItem && activeTab === 'admin_review'}
          <button
            class="approve-btn"
            disabled={actionInProgress}
            on:click={() => selectedItem && void reviewSubmission(selectedItem.id, 'approve')}
          >
            {actionInProgress ? '...' : 'Approve'}
          </button>

          <textarea
            class="reject-reason"
            bind:value={rejectReason}
            placeholder="Rejection reason (required to reject)"
            rows="4"
          ></textarea>

          <button
            class="reject-btn"
            disabled={actionInProgress || !rejectReason.trim()}
            on:click={() => selectedItem && void reviewSubmission(selectedItem.id, 'reject', rejectReason)}
          >
            {actionInProgress ? '...' : 'Reject'}
          </button>
        {:else if activeTab !== 'admin_review'}
          <p class="action-note">
            {activeTab === 'approved' ? 'Approved submissions cannot be modified here.' :
             activeTab === 'rejected' ? 'Rejected. Player may appeal.' :
             'Awaiting community votes.'}
          </p>
        {:else}
          <p class="empty-text">Select a submission.</p>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .review-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 200;
    pointer-events: auto;
    overflow-y: auto;
    padding: 20px;
  }
  .review-panel {
    background: #16213e;
    border-radius: 10px;
    padding: 20px;
    width: 100%;
    max-width: 900px;
    border: 1px solid #0f3460;
  }
  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .review-header h2 {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #e94560;
    margin: 0;
  }
  .close-x {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
  }
  .admin-key-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }
  .admin-key-input {
    flex: 1;
    background: #0f3460;
    border: 1px solid #1a3a6e;
    color: #e0e0e0;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
  }
  .load-btn {
    background: #1a3a6e;
    color: #e0e0e0;
    border: none;
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .error-msg {
    color: #e94560;
    font-size: 11px;
    margin: 6px 0;
  }
  .tab-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    border-bottom: 1px solid #1a3a6e;
    padding-bottom: 8px;
  }
  .tab-btn {
    background: none;
    border: 1px solid transparent;
    color: #888;
    padding: 6px 12px;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    font-size: 11px;
  }
  .tab-btn.active {
    background: #0f3460;
    border-color: #1a3a6e;
    color: #e94560;
  }
  .panel-layout {
    display: grid;
    grid-template-columns: 200px 1fr 180px;
    gap: 12px;
    min-height: 300px;
  }
  .item-list {
    overflow-y: auto;
    max-height: 400px;
    border-right: 1px solid #1a3a6e;
    padding-right: 8px;
  }
  .list-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: 1px solid transparent;
    color: #ccc;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 4px;
    font-size: 11px;
  }
  .list-item:hover { background: #0f3460; }
  .list-item.selected { background: #1a3a6e; border-color: #e94560; }
  .list-fact { display: block; }
  .list-meta { display: block; color: #888; font-size: 10px; margin-top: 2px; }
  .detail-card {
    padding: 0 8px;
    overflow-y: auto;
    max-height: 400px;
  }
  .detail-fact {
    color: #e0e0e0;
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 8px;
  }
  .detail-answer { color: #8FBC8F; font-size: 12px; margin: 0 0 6px; }
  .detail-distractors { font-size: 11px; color: #a0a0a0; margin-bottom: 6px; }
  .distractor-badge {
    background: #1a3a6e;
    padding: 2px 6px;
    border-radius: 10px;
    margin-right: 4px;
    font-size: 10px;
  }
  .detail-cat { font-size: 11px; color: #a0a0a0; margin-bottom: 6px; }
  .cat-badge {
    background: #0f3460;
    padding: 2px 6px;
    border-radius: 10px;
    margin-right: 4px;
    font-size: 10px;
    color: #e94560;
  }
  .detail-source { font-size: 11px; margin-bottom: 6px; }
  .detail-source a { color: #e94560; }
  .detail-flags { margin-bottom: 6px; }
  .flag-badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
  }
  .flag-badge.warn { background: #4a2a00; color: #ffa726; }
  .flag-badge.ok { background: #1a4a1a; color: #4caf50; }
  .detail-votes { font-size: 11px; color: #888; margin-bottom: 4px; }
  .detail-date { font-size: 10px; color: #666; }
  .action-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-left: 8px;
    border-left: 1px solid #1a3a6e;
  }
  .approve-btn, .reject-btn {
    padding: 10px;
    border: none;
    border-radius: 4px;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    cursor: pointer;
  }
  .approve-btn {
    background: #2ecc71;
    color: white;
  }
  .reject-btn {
    background: #e74c3c;
    color: white;
  }
  .approve-btn:disabled, .reject-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .reject-reason {
    background: #0f3460;
    border: 1px solid #1a3a6e;
    color: #e0e0e0;
    padding: 6px;
    border-radius: 4px;
    font-size: 11px;
    resize: vertical;
  }
  .action-note {
    color: #888;
    font-size: 11px;
    text-align: center;
  }
  .loading-text, .empty-text {
    color: #888;
    font-size: 12px;
    text-align: center;
  }
</style>
