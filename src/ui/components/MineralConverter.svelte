<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { convertMineral } from '../../services/saveService'
  import { BALANCE } from '../../data/balance'
  import type { MineralTier } from '../../data/types'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  /** Total cost to convert: ratio + 10% tax (rounded up). */
  const COST = BALANCE.MINERAL_CONVERSION_RATIO + Math.ceil(BALANCE.MINERAL_CONVERSION_RATIO * BALANCE.MINERAL_CONVERSION_TAX)

  /** Ordered conversion pairs: [from, to, dot class, label]. */
  const CONVERSIONS: Array<{ from: MineralTier; to: MineralTier; fromDot: string; toDot: string; fromLabel: string; toLabel: string }> = [
    { from: 'dust',    to: 'shard',   fromDot: 'dust-dot',    toDot: 'shard-dot',   fromLabel: 'Dust',    toLabel: 'Shard'   },
    { from: 'shard',   to: 'crystal', fromDot: 'shard-dot',   toDot: 'crystal-dot', fromLabel: 'Shard',   toLabel: 'Crystal' },
    { from: 'crystal', to: 'geode',   fromDot: 'crystal-dot', toDot: 'geode-dot',   fromLabel: 'Crystal', toLabel: 'Geode'   },
    { from: 'geode',   to: 'essence', fromDot: 'geode-dot',   toDot: 'essence-dot', fromLabel: 'Geode',   toLabel: 'Essence' },
  ]

  let feedbackMessage = $state<string | null>(null)
  let feedbackSuccess = $state(true)

  function getAmount(tier: MineralTier): number {
    return $playerSave?.minerals[tier] ?? 0
  }

  function canConvert(from: MineralTier): boolean {
    return getAmount(from) >= COST
  }

  function handleConvert(from: MineralTier, to: MineralTier, fromLabel: string, toLabel: string): void {
    const currentSave = $playerSave
    if (!currentSave) return

    const result = convertMineral(currentSave, from, to, 1)
    if (result.success) {
      // Update the Svelte store so the UI reflects the change immediately
      playerSave.set(result.updatedSave)
      feedbackSuccess = true
      feedbackMessage = `Converted ${COST} ${fromLabel} into 1 ${toLabel}.`
    } else {
      feedbackSuccess = false
      feedbackMessage = `Not enough ${fromLabel}. Need ${COST}.`
    }
    // Clear feedback after 2.5 seconds
    setTimeout(() => {
      feedbackMessage = null
    }, 2500)
  }
</script>

<!-- Backdrop -->
<div class="converter-backdrop" role="presentation" onclick={onClose}></div>

<!-- Modal -->
<div class="converter-modal" role="dialog" aria-modal="true" aria-label="Mineral Converter">
  <h2 class="converter-title">Mineral Converter</h2>
  <p class="converter-subtitle">
    Cost: {COST} of lower tier = 1 of higher tier
    <span class="tax-note">(+{Math.ceil(BALANCE.MINERAL_CONVERSION_RATIO * BALANCE.MINERAL_CONVERSION_TAX)} tax)</span>
  </p>

  <div class="conversion-list">
    {#each CONVERSIONS as conv}
      {@const fromAmount = getAmount(conv.from)}
      {@const toAmount = getAmount(conv.to)}
      {@const enabled = canConvert(conv.from)}
      <div class="conversion-row" class:disabled={!enabled}>
        <div class="mineral-info">
          <span class="resource-dot {conv.fromDot}" aria-hidden="true"></span>
          <span class="mineral-name">{conv.fromLabel}</span>
          <span class="mineral-amount" class:low={fromAmount < COST}>{fromAmount}</span>
        </div>

        <div class="arrow-section">
          <span class="arrow" aria-hidden="true">→</span>
          <span class="ratio-label">{COST}:1</span>
        </div>

        <div class="mineral-info">
          <span class="resource-dot {conv.toDot}" aria-hidden="true"></span>
          <span class="mineral-name">{conv.toLabel}</span>
          <span class="mineral-amount">{toAmount}</span>
        </div>

        <button
          class="convert-btn"
          type="button"
          disabled={!enabled}
          onclick={() => handleConvert(conv.from, conv.to, conv.fromLabel, conv.toLabel)}
          aria-label="Convert {COST} {conv.fromLabel} to 1 {conv.toLabel}"
        >
          Convert
        </button>
      </div>
    {/each}
  </div>

  {#if feedbackMessage}
    <p class="feedback" class:feedback-success={feedbackSuccess} class:feedback-error={!feedbackSuccess} role="status">
      {feedbackMessage}
    </p>
  {/if}

  <button class="close-btn" type="button" onclick={onClose}>Close</button>
</div>

<style>
  .converter-backdrop {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.72);
    z-index: 100;
  }

  .converter-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: auto;
    z-index: 101;
    background: var(--color-surface);
    border-radius: 16px;
    padding: 24px 20px 20px;
    width: min(94vw, 400px);
    font-family: 'Courier New', monospace;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .converter-title {
    margin: 0;
    color: var(--color-warning);
    font-size: 1.2rem;
    text-align: center;
  }

  .converter-subtitle {
    margin: 0;
    color: var(--color-text-dim);
    font-size: 0.8rem;
    text-align: center;
    line-height: 1.4;
  }

  .tax-note {
    color: var(--color-accent);
    font-size: 0.78rem;
  }

  .conversion-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .conversion-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: color-mix(in srgb, var(--color-bg) 40%, var(--color-surface) 60%);
    border-radius: 10px;
    padding: 10px 12px;
    transition: opacity 0.2s;
  }

  .conversion-row.disabled {
    opacity: 0.55;
  }

  .mineral-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 80px;
  }

  .mineral-name {
    color: var(--color-text);
    font-size: 0.82rem;
    min-width: 44px;
  }

  .mineral-amount {
    color: var(--color-text);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .mineral-amount.low {
    color: var(--color-accent);
  }

  .arrow-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    min-width: 40px;
  }

  .arrow {
    color: var(--color-text-dim);
    font-size: 1.1rem;
  }

  .ratio-label {
    color: var(--color-text-dim);
    font-size: 0.68rem;
    margin-top: 1px;
  }

  .convert-btn {
    margin-left: auto;
    border: 0;
    border-radius: 8px;
    background: var(--color-primary);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 8px 14px;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s, transform 0.1s;
  }

  .convert-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .convert-btn:not(:disabled):active {
    transform: translateY(1px);
  }

  .resource-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dust-dot {
    background: #4ecca3;
  }

  .shard-dot {
    background: #ffd369;
  }

  .crystal-dot {
    background: #e94560;
  }

  .geode-dot {
    background: #9b59b6;
  }

  .essence-dot {
    background: linear-gradient(135deg, #ffd700 0%, #fffde7 50%, #ffd700 100%);
    box-shadow: 0 0 4px rgba(255, 215, 0, 0.6);
  }

  .feedback {
    margin: 0;
    text-align: center;
    font-size: 0.82rem;
    padding: 8px 12px;
    border-radius: 8px;
    animation: fade-in 0.2s ease;
  }

  .feedback-success {
    background: color-mix(in srgb, var(--color-success) 20%, var(--color-surface) 80%);
    color: var(--color-success);
  }

  .feedback-error {
    background: color-mix(in srgb, var(--color-accent) 20%, var(--color-surface) 80%);
    color: var(--color-accent);
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .close-btn {
    border: 0;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-text-dim) 22%, var(--color-surface) 78%);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 12px;
    cursor: pointer;
    width: 100%;
    transition: opacity 0.15s;
  }

  .close-btn:active {
    transform: translateY(1px);
  }
</style>
