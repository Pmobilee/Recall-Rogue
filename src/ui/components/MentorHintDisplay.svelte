<script lang="ts">
  import type { MentorHint } from '../../services/mentorService'

  interface Props {
    hint: MentorHint
    onVote?: () => void
  }

  const { hint, onVote }: Props = $props()

  let voted = $state(false)

  function handleVote(): void {
    if (voted) return
    voted = true
    onVote?.()
  }
</script>

<div class="hint-display">
  <div class="hint-header">
    <span class="hint-icon">💡</span>
    <span class="hint-label">Miner's Hint</span>
  </div>
  <p class="hint-text">{hint.hintText}</p>
  <div class="hint-footer">
    <span class="author">— anonymous miner</span>
    <button
      type="button"
      class="vote-btn"
      class:voted
      onclick={handleVote}
      disabled={voted}
      aria-label="Upvote this hint"
    >
      {voted ? '✓ Helpful' : '▲ Helpful'}
      <span class="count">({hint.upvotes + (voted ? 1 : 0)})</span>
    </button>
  </div>
</div>

<style>
  .hint-display {
    background: rgba(255, 215, 0, 0.08);
    border: 1px solid rgba(255, 215, 0, 0.4);
    border-radius: 6px;
    padding: 10px 12px;
    margin-top: 10px;
    font-family: var(--font-rpg);
  }

  .hint-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .hint-icon {
    font-size: 14px;
  }

  .hint-label {
    font-size: 8px;
    color: #ffd700;
    letter-spacing: 0.05em;
  }

  .hint-text {
    font-size: 9px;
    color: #e0e0e0;
    line-height: 1.7;
    margin: 0 0 8px;
    font-family: sans-serif;
  }

  .hint-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .author {
    font-size: 7px;
    color: #888;
    font-style: italic;
  }

  .vote-btn {
    background: none;
    border: 1px solid #555;
    border-radius: 3px;
    color: #aaa;
    font-family: var(--font-rpg);
    font-size: 7px;
    padding: 4px 7px;
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
  }

  .vote-btn:not(.voted):hover {
    color: #ffd700;
    border-color: #ffd700;
  }

  .vote-btn.voted {
    color: #4ecca3;
    border-color: #4ecca3;
    cursor: default;
  }

  .count {
    color: #888;
    margin-left: 4px;
  }
</style>
