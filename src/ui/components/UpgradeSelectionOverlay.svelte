<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { playCardAudio } from '../../services/cardAudioManager'

  interface UpgradePreview {
    upgradedName: string
    currentBaseValue: number
    newBaseValue: number
    secondaryDelta?: number
    addTag?: string
    currentApCost?: number
    newApCost?: number
  }

  interface Props {
    candidates: Array<{ card: Card; preview: UpgradePreview }>
    onselect: (cardId: string) => void
    onskip: () => void
  }

  let { candidates, onselect, onskip }: Props = $props()

  let selectedCandidate = $state<{ card: Card; preview: UpgradePreview } | null>(null)

  // Play modal-open sound when overlay mounts
  $effect(() => {
    playCardAudio('modal-open')
  })

  const TYPE_ICONS: Record<string, string> = {
    attack: '\u2694',
    shield: '\uD83D\uDEE1',
    heal: '\uD83D\uDC9A',
    utility: '\u2B50',
    buff: '\u2B06',
    debuff: '\u2B07',
    regen: '\u2795',
    wild: '\uD83D\uDC8E',
  }
</script>

<div class="upgrade-overlay">
  <div class="upgrade-panel">
    {#if selectedCandidate}
      <!-- Phase 2: Detail & Confirm View -->
      <div class="detail-view">
        <h2 class="detail-title">Confirm Upgrade</h2>

        <div class="detail-content">
          <div class="card-preview upgraded-preview">
            <div class="preview-header">
              <span class="type-icon">{TYPE_ICONS[selectedCandidate.card.cardType] ?? '\uD83C\uDCCF'}</span>
            </div>

            <h3 class="preview-mechanic">{selectedCandidate.preview.upgradedName}</h3>
            <div class="preview-label upgraded-label">Upgraded card</div>

            <div class="upgrade-comparison">
              <div class="value-change">
                <span class="old-value">{selectedCandidate.preview.currentBaseValue}</span>
                <span class="arrow">→</span>
                <span class="new-value">{selectedCandidate.preview.newBaseValue}</span>
              </div>
              {#if selectedCandidate.preview.currentApCost != null && selectedCandidate.preview.newApCost != null && selectedCandidate.preview.currentApCost !== selectedCandidate.preview.newApCost}
                <div class="ap-change">
                  AP: <span class="old-value">{selectedCandidate.preview.currentApCost}</span>
                  <span class="arrow">→</span>
                  <span class="new-value ap-reduced">{selectedCandidate.preview.newApCost}</span>
                </div>
              {/if}
              {#if selectedCandidate.preview.secondaryDelta}
                <div class="secondary-delta">Secondary +{selectedCandidate.preview.secondaryDelta}</div>
              {/if}
              {#if selectedCandidate.preview.addTag}
                <div class="add-tag">+{selectedCandidate.preview.addTag}</div>
              {/if}
            </div>
          </div>

          <div class="upgrade-callout" aria-hidden="true">
            <span class="callout-arrow">➜</span>
            <span class="callout-text">Upgrade!</span>
          </div>

          <div class="card-preview original-preview">
            <div class="preview-header">
              <span class="type-icon">{TYPE_ICONS[selectedCandidate.card.cardType] ?? '\uD83C\uDCCF'}</span>
            </div>

            <h3 class="preview-mechanic">{selectedCandidate.card.mechanicName ?? selectedCandidate.card.cardType}</h3>
            <div class="preview-label">Original card</div>

            <div class="upgrade-comparison">
              <div class="value-change">
                <span class="old-value">{selectedCandidate.preview.currentBaseValue}</span>
              </div>
            </div>
          </div>
        </div>

        <button class="btn-upgrade" data-testid="upgrade-confirm" onclick={() => { playCardAudio('mastery-trial-pass'); onselect(selectedCandidate!.card.id) }}>
          Upgrade!
        </button>
        <div class="button-row back-row">
          <button class="btn-back" data-testid="upgrade-back" onclick={() => selectedCandidate = null}>
            Back - Choose a Different Card
          </button>
        </div>
      </div>
    {:else if candidates.length === 0}
      <div class="grid-view">
        <h2 class="title">No Upgrades Available</h2>
        <p class="subtitle">All eligible cards are already upgraded.</p>
        <button class="skip-btn" data-testid="upgrade-skip" onclick={onskip}>
          Continue
        </button>
      </div>
    {:else}
      <!-- Phase 1: Grid Browse View -->
      <div class="grid-view">
        <h2 class="title">Upgrade a Card</h2>
        <p class="subtitle">Choose one card to enhance</p>

        <div class="grid-container">
          <div class="candidates-grid">
            {#each candidates as { card, preview } (card.id)}
              <button
                class="grid-card"
                data-testid="upgrade-candidate-{card.id}"
                onclick={() => { selectedCandidate = { card, preview }; playCardAudio('card-select') }}
              >
                <div class="grid-header">
                  <span class="type-icon">{TYPE_ICONS[card.cardType] ?? '\uD83C\uDCCF'}</span>
                </div>
                <div class="grid-mechanic">{card.mechanicName ?? card.cardType}</div>
                <div class="grid-values">
                  <span class="old">{preview.currentBaseValue}</span>
                  <span class="arrow">→</span>
                  <span class="new">{preview.newBaseValue}</span>
                </div>
                {#if preview.currentApCost != null && preview.newApCost != null && preview.currentApCost !== preview.newApCost}
                  <div class="grid-ap-change">AP: {preview.currentApCost} → {preview.newApCost}</div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <button class="skip-btn" data-testid="upgrade-skip" onclick={onskip}>
          Skip
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .upgrade-overlay {
    position: fixed;
    inset: 0;
    background: rgba(13, 17, 23, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 210;
    padding: 16px;
  }

  .upgrade-panel {
    background: #161b22;
    border: 2px solid #3498db;
    border-radius: 12px;
    padding: 20px;
    max-width: 420px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Grid View (Phase 1) */
  .grid-view {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .title {
    font-size: 20px;
    color: #3498db;
    margin: 0;
    text-align: center;
  }

  .subtitle {
    font-size: 13px;
    color: #8b949e;
    margin: 0;
    text-align: center;
  }

  .grid-container {
    max-height: 60vh;
    overflow-y: auto;
  }

  .candidates-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }

  .grid-card {
    background: rgba(13, 17, 23, 0.82);
    border: 2px solid #3b434f;
    border-radius: 10px;
    padding: 10px;
    cursor: pointer;
    transition: transform 0.1s, border-color 0.15s;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    color: #e6edf3;
    min-height: 100px;
  }

  .grid-card:active {
    transform: scale(0.98);
  }

  .grid-card:hover {
    transform: scale(1.02);
    border-color: #3498db;
  }


  .grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .type-icon {
    font-size: 18px;
  }


  .grid-mechanic {
    font-weight: 700;
    font-size: 12px;
    line-height: 1.3;
    flex-grow: 1;
  }

  .grid-values {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;
  }

  .old {
    color: #8b949e;
  }

  .arrow {
    color: #3498db;
    font-size: 12px;
  }

  .new {
    color: #2ecc71;
  }

  .skip-btn {
    min-height: 44px;
    width: 100%;
    border-radius: 10px;
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #9ba4ad;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
  }

  .skip-btn:hover {
    border-color: #6b7280;
    color: #e5e7eb;
  }

  .skip-btn:active {
    transform: scale(0.98);
  }

  /* Detail View (Phase 2) */
  .detail-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-title {
    font-size: 20px;
    color: #3498db;
    margin: 0;
    text-align: center;
  }

  .detail-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-preview {
    background: rgba(13, 17, 23, 0.5);
    border: 1px solid #3b434f;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .upgraded-preview {
    border-color: rgba(46, 204, 113, 0.6);
  }

  .original-preview {
    border-color: rgba(148, 163, 184, 0.4);
  }

  .preview-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .upgraded-label {
    color: #2ecc71;
  }

  .upgrade-callout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #7dd3fc;
    font-weight: 900;
    text-shadow:
      -1px 0 #000,
      1px 0 #000,
      0 -1px #000,
      0 1px #000;
  }

  .callout-arrow {
    display: inline-block;
    font-size: 20px;
    animation: upgradeArrowHover 1400ms ease-in-out infinite;
  }

  .callout-text {
    font-size: 16px;
  }

  @keyframes upgradeArrowHover {
    0%, 100% { transform: translateX(0) translateY(0); }
    50% { transform: translateX(5px) translateY(-2px); }
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .preview-mechanic {
    font-size: 18px;
    font-weight: 700;
    color: #e6edf3;
    margin: 0;
  }

  .upgrade-comparison {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .value-change {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 700;
  }

  .old-value {
    color: #8b949e;
  }

  .new-value {
    color: #2ecc71;
  }

  .secondary-delta {
    font-size: 13px;
    color: #3498db;
    font-weight: 600;
  }

  .add-tag {
    font-size: 13px;
    color: #3498db;
    font-weight: 600;
  }

  .button-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .back-row {
    margin-top: 2px;
  }

  .btn-back,
  .btn-upgrade {
    flex: 1;
    min-height: 44px;
    border-radius: 10px;
    border: none;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.1s;
  }

  .btn-back {
    background: #1f2937;
    color: #8b949e;
    border: 1px solid #4b5563;
  }

  .btn-back:hover {
    border-color: #6b7280;
    color: #e5e7eb;
  }

  .btn-back:active {
    transform: scale(0.98);
  }

  .btn-upgrade {
    background: linear-gradient(180deg, #3da0e5, #2f86bf);
    color: #0d1117;
    border: 1px solid rgba(125, 211, 252, 0.5);
  }

  .btn-upgrade:hover {
    background: linear-gradient(180deg, #44d28a, #2cbf74);
  }

  .btn-upgrade:active {
    transform: scale(0.98);
  }

  /* Scrollbar styling */
  .grid-container::-webkit-scrollbar {
    width: 6px;
  }

  .grid-container::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
  }

  .grid-container::-webkit-scrollbar-thumb {
    background: #3498db;
    border-radius: 10px;
  }

  .grid-container::-webkit-scrollbar-thumb:hover {
    background: #2ecc71;
  }

  .ap-change {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 700;
    color: #7dd3fc;
  }

  .ap-reduced {
    color: #4ade80;
  }

  .grid-ap-change {
    font-size: 11px;
    font-weight: 700;
    color: #4ade80;
  }
</style>
