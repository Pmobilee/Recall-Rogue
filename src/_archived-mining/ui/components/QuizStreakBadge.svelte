<script lang="ts">
  import { quizStreak, currentScreen } from '../stores/gameState'

  // quizStreak store shape: { count: number; multiplier: number }
  const streak = $derived($quizStreak.count)
  const multiplier = $derived($quizStreak.multiplier)
  const show = $derived($currentScreen === 'mining' && streak >= 3)
</script>

{#if show}
  <div
    class="streak-badge"
    class:hot={streak >= 6 && streak < 10}
    class:blazing={streak >= 10}
    aria-label="Quiz streak: {streak} in a row, ×{multiplier.toFixed(1)} multiplier"
  >
    <span class="flame">🔥</span>
    <span class="multiplier">×{multiplier.toFixed(1)}</span>
    <span class="count">{streak} in a row</span>
  </div>
{/if}

<style>
  .streak-badge {
    position: fixed;
    top: 72px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid #ffd369;
    border-radius: 8px;
    padding: 4px 10px;
    font-size: 0.85rem;
    color: #ffd369;
    pointer-events: none;
    z-index: 200;
  }
  .hot {
    border-color: #ff8800;
    color: #ff8800;
  }
  .blazing {
    border-color: #ff3300;
    color: #ff3300;
    animation: pulse 0.6s infinite alternate;
  }
  @keyframes pulse {
    from { opacity: 1; }
    to   { opacity: 0.6; }
  }
</style>
