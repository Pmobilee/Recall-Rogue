<script lang="ts">
  import type { Card } from '../../data/card-types'
  import UpgradeSelectionOverlay from './UpgradeSelectionOverlay.svelte'

  interface UpgradePreview {
    upgradedName: string
    currentBaseValue: number
    newBaseValue: number
    secondaryDelta?: number
    addTag?: string
  }

  interface Props {
    healAmount: number
    candidates: Array<{ card: Card; preview: UpgradePreview }>
    onselect: (cardId: string) => void
    onskip: () => void
  }

  let { healAmount, candidates, onselect, onskip }: Props = $props()

  let showUpgrade = $state(false)

  function handleContinue() {
    if (candidates.length > 0) {
      showUpgrade = true
    } else {
      onskip()
    }
  }
</script>

{#if showUpgrade}
  <UpgradeSelectionOverlay {candidates} {onselect} {onskip} />
{:else}
  <div class="rest-overlay">
    <div class="rest-panel">
      <h2 class="title">Mini-Boss Defeated!</h2>
      <div class="heal-info">
        <span class="heal-icon">{'\u2764\uFE0F'}</span>
        <span class="heal-text">+{healAmount} HP restored</span>
      </div>
      <button
        class="continue-btn"
        data-testid="post-miniboss-continue"
        onclick={handleContinue}
      >
        {candidates.length > 0 ? 'Upgrade a Card' : 'Continue'}
      </button>
    </div>
  </div>
{/if}

<style>
  .rest-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 210;
    padding: 16px;
  }

  .rest-panel {
    background: #161b22;
    border: 2px solid #2ecc71;
    border-radius: 12px;
    padding: 24px;
    max-width: 340px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .title {
    font-size: 20px;
    color: #2ecc71;
    margin: 0;
  }

  .heal-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    color: #2ecc71;
    font-weight: 700;
  }

  .heal-icon {
    font-size: 24px;
  }

  .heal-text {
    font-size: 16px;
  }

  .continue-btn {
    min-height: 50px;
    width: 100%;
    border-radius: 10px;
    border: 2px solid #2ecc71;
    background: #1a4731;
    color: #e6edf3;
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .continue-btn:hover {
    background: #236b45;
  }
</style>
