<script lang="ts">
  export let onClose: (() => void) | undefined = undefined

  interface QueueItem {
    id: string
    factText: string
    correctAnswer: string
    distractors: string[]
    category: string
    sourceUrl: string
    submittedBy: string
    submittedAt: string
    status: 'pending' | 'approved' | 'rejected'
  }

  let queue: QueueItem[] = []
  let loading = true

  async function loadQueue(): Promise<void> {
    try {
      const res = await fetch('/api/ugc/review-queue')
      if (res.ok) {
        const data = await res.json()
        queue = data.queue
      }
    } catch {
      // Offline
    } finally {
      loading = false
    }
  }

  async function reviewItem(id: string, action: 'approve' | 'reject'): Promise<void> {
    try {
      await fetch(`/api/ugc/review/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      queue = queue.filter(q => q.id !== id)
    } catch {
      // Handle error
    }
  }

  loadQueue()
</script>

<div class="review-overlay" role="dialog" aria-label="UGC Review Queue">
  <div class="review-panel">
    <div class="review-header">
      <h2>Review Queue</h2>
      <button class="close-x" on:click={onClose} aria-label="Close">&times;</button>
    </div>

    {#if loading}
      <p class="loading-text">Loading submissions...</p>
    {:else if queue.length === 0}
      <p class="empty-text">No pending submissions. The community is quiet today.</p>
    {:else}
      {#each queue as item}
        <div class="review-card">
          <p class="fact-text">{item.factText}</p>
          <p class="answer"><strong>Answer:</strong> {item.correctAnswer}</p>
          <p class="distractors"><strong>Distractors:</strong> {item.distractors.join(', ')}</p>
          <p class="meta">
            <span class="category">{item.category}</span>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" class="source-link">Source</a>
          </p>
          <div class="review-actions">
            <button class="approve-btn" on:click={() => reviewItem(item.id, 'approve')}>Approve</button>
            <button class="reject-btn" on:click={() => reviewItem(item.id, 'reject')}>Reject</button>
          </div>
        </div>
      {/each}
    {/if}
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
    padding: 40px 20px;
  }
  .review-panel {
    background: #16213e;
    border-radius: 10px;
    padding: 20px;
    max-width: 500px;
    width: 100%;
    border: 1px solid #0f3460;
  }
  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .review-header h2 {
    font-family: 'Press Start 2P', monospace;
    font-size: 13px;
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
  .loading-text, .empty-text {
    color: #888;
    text-align: center;
    font-size: 13px;
  }
  .review-card {
    background: #0f3460;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 12px;
  }
  .fact-text {
    color: #e0e0e0;
    font-size: 13px;
    margin: 0 0 8px;
    line-height: 1.5;
  }
  .answer {
    color: #8FBC8F;
    font-size: 12px;
    margin: 0 0 4px;
  }
  .distractors {
    color: #a0a0a0;
    font-size: 11px;
    margin: 0 0 8px;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 0 10px;
  }
  .category {
    background: #1a3a6e;
    color: #e94560;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
  }
  .source-link {
    color: #e94560;
    font-size: 11px;
    text-decoration: none;
  }
  .review-actions {
    display: flex;
    gap: 8px;
  }
  .approve-btn, .reject-btn {
    flex: 1;
    padding: 8px;
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
</style>
