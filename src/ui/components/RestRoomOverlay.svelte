<script lang="ts">
  interface Props {
    playerHp: number
    playerMaxHp: number
    onheal: () => void
    onupgrade: () => void
  }

  let { playerHp, playerMaxHp, onheal, onupgrade }: Props = $props()

  let healAmount = $derived(Math.round(playerMaxHp * 0.3))
  let projectedHp = $derived(Math.min(playerMaxHp, playerHp + healAmount))
</script>

<div class="rest-overlay">
  <div class="rest-card">
    <h2 class="rest-title">Rest Site</h2>

    <div class="hp-info">
      HP: {playerHp} / {playerMaxHp}
    </div>

    <div class="option-cards">
      <button
        class="option-card heal-card"
        data-testid="rest-heal"
        onclick={onheal}
      >
        <span class="option-icon">{'\u2764\uFE0F'}</span>
        <span class="option-label">Rest</span>
        <span class="option-detail">Heal 30% HP</span>
        <span class="option-preview">+{healAmount} HP &rarr; {projectedHp}</span>
      </button>

      <button
        class="option-card upgrade-card"
        data-testid="rest-upgrade"
        onclick={onupgrade}
      >
        <span class="option-icon">{'\u2B06\uFE0F'}</span>
        <span class="option-label">Upgrade</span>
        <span class="option-detail">Boost one card</span>
        <span class="option-preview">Enhance one card</span>
      </button>
    </div>
  </div>
</div>

<style>
  .rest-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 16px;
  }

  .rest-card {
    background: #161B22;
    border: 2px solid #2ECC71;
    border-radius: 12px;
    padding: 24px;
    max-width: 340px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .rest-title {
    font-size: 20px;
    color: #2ECC71;
    margin: 0;
  }

  .hp-info {
    font-size: 14px;
    color: #8B949E;
  }

  .option-cards {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  .option-card {
    flex: 1;
    background: #1E2D3D;
    border: 2px solid #484F58;
    border-radius: 8px;
    padding: 16px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
  }

  .option-card:hover {
    transform: scale(1.03);
  }

  .heal-card:hover {
    border-color: #2ECC71;
  }

  .upgrade-card:hover {
    border-color: #3498DB;
  }

  .option-icon {
    font-size: 28px;
  }

  .option-label {
    font-size: 14px;
    color: #E6EDF3;
    font-weight: 700;
  }

  .option-detail {
    font-size: 11px;
    color: #8B949E;
    text-align: center;
  }

  .option-preview {
    font-size: 10px;
    color: #6E7681;
    text-align: center;
    margin-top: 4px;
  }
</style>
