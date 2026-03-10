<script lang="ts">
  interface Props {
    currentFloor: number
    playerHp: number
    playerMaxHp: number
    deckSize: number
    relicCount: number
    accuracy: number
    onresume: () => void
    onreturnhub: () => void
    canReturnHub?: boolean
  }

  let {
    currentFloor,
    playerHp,
    playerMaxHp,
    deckSize,
    relicCount,
    accuracy,
    onresume,
    onreturnhub,
    canReturnHub = true,
  }: Props = $props()
</script>

<div class="campfire-overlay">
  <div class="campfire-card">
    <h2 class="campfire-title">Resting by the fire...</h2>

    <div class="stats-grid">
      <div class="stat">
        <span class="stat-label">Floor</span>
        <span class="stat-value">{currentFloor}</span>
      </div>
      <div class="stat">
        <span class="stat-label">HP</span>
        <span class="stat-value">{playerHp}/{playerMaxHp}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Deck</span>
        <span class="stat-value">{deckSize} cards</span>
      </div>
      <div class="stat">
        <span class="stat-label">Relics</span>
        <span class="stat-value">{relicCount}</span>
      </div>
      <div class="stat stat-wide">
        <span class="stat-label">Accuracy</span>
        <span class="stat-value">{accuracy}%</span>
      </div>
    </div>

    <div class="campfire-actions">
      <button
        type="button"
        class="resume-btn"
        data-testid="btn-campfire-resume"
        onclick={onresume}
      >
        Resume Run
      </button>
      {#if canReturnHub}
        <button
          type="button"
          class="hub-btn"
          data-testid="btn-campfire-hub"
          onclick={onreturnhub}
        >
          Return to Hub
        </button>
      {/if}
    </div>

    <p class="hub-hint">
      {#if canReturnHub}
        Your run will be saved. Resume any time.
      {:else}
        Ascension Iron Will is active: this run cannot be fled.
      {/if}
    </p>
  </div>
</div>

<style>
  .campfire-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 50% 80%, rgba(255, 140, 0, 0.08), transparent 60%),
      rgba(7, 10, 15, 0.97);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: 16px;
  }

  .campfire-card {
    background: linear-gradient(180deg, #1a1d24, #12151b);
    border: 1px solid rgba(255, 160, 60, 0.25);
    border-radius: 16px;
    padding: 28px 24px;
    max-width: 360px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .campfire-title {
    margin: 0;
    font-size: calc(20px * var(--text-scale, 1));
    color: #fbbf24;
    text-align: center;
    letter-spacing: 0.5px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
  }

  .stat {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-wide {
    grid-column: 1 / -1;
  }

  .stat-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: calc(16px * var(--text-scale, 1));
    color: #f8fafc;
    font-weight: 700;
  }

  .campfire-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .resume-btn {
    width: 100%;
    min-height: 52px;
    border: 2px solid #f59e0b;
    border-radius: 12px;
    background: linear-gradient(180deg, #2f7a35, #1f5c28);
    color: #f8fafc;
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .resume-btn:active {
    transform: scale(0.97);
  }

  .hub-btn {
    width: 100%;
    min-height: 44px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    background: rgba(30, 41, 59, 0.75);
    color: #cbd5e1;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    transition: background 0.15s;
  }

  .hub-btn:hover {
    background: rgba(30, 41, 59, 0.95);
  }

  .hub-hint {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    text-align: center;
  }
</style>
