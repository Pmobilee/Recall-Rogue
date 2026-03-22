<script lang="ts">
  import type { RelicDefinition } from '../../data/relics/types'
  import { playCardAudio } from '../../services/cardAudioManager'

  interface EquippedRelic {
    definitionId: string
    name: string
    description: string
    icon: string
    rarity: string
    sellRefund: number
  }

  interface Props {
    /** The relic being offered to the player. */
    offeredRelic: RelicDefinition
    /** The player's currently equipped relics with sell refund amounts. */
    equippedRelics: EquippedRelic[]
    /** Current relic slot count label, e.g. "5/5". */
    slotLabel: string
    /** Called when the player sells one relic and acquires the offered relic. */
    onSellAndAcquire: (sellDefinitionId: string) => void
    /** Called when the player passes on the offered relic. */
    onPass: () => void
  }

  let { offeredRelic, equippedRelics, slotLabel, onSellAndAcquire, onPass }: Props = $props()

  let selectedSellId = $state<string | null>(null)

  // Play modal-open sound when overlay mounts
  $effect(() => {
    playCardAudio('modal-open')
  })

  const rarityColors: Record<string, string> = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    legendary: '#f59e0b',
  }

  function selectForSell(id: string): void {
    selectedSellId = selectedSellId === id ? null : id
    playCardAudio('card-select')
  }

  function confirmSell(): void {
    if (!selectedSellId) return
    playCardAudio('relic-acquired')
    onSellAndAcquire(selectedSellId)
  }
</script>

<div class="swap-overlay" role="dialog" aria-modal="true" aria-label="Relic Slots Full — sell or pass">
  <div class="swap-panel">
    <div class="header">
      <h2 class="title">Relic Slots Full</h2>
      <span class="slot-badge">{slotLabel}</span>
    </div>

    <!-- Offered Relic -->
    <section class="offered-section">
      <div class="section-label">Offered Relic</div>
      <div class="offered-card">
        <span class="offered-icon">{offeredRelic.icon}</span>
        <div class="offered-info">
          <div class="offered-name" style="color: {rarityColors[offeredRelic.rarity] ?? '#fff'}">
            {offeredRelic.name}
          </div>
          <div class="rarity-badge" style="color: {rarityColors[offeredRelic.rarity] ?? '#9ca3af'}">
            {offeredRelic.rarity.charAt(0).toUpperCase() + offeredRelic.rarity.slice(1)}
          </div>
          <div class="offered-desc">{offeredRelic.description}</div>
          {#if offeredRelic.curseDescription}
            <div class="curse-desc">⚠ {offeredRelic.curseDescription}</div>
          {/if}
        </div>
      </div>
    </section>

    <!-- Equipped Relics -->
    <section class="equipped-section">
      <div class="section-label">Your Relics — tap one to sell</div>
      <div class="equipped-grid">
        {#each equippedRelics as relic (relic.definitionId)}
          <div
            role="button"
            tabindex="0"
            class="equipped-card"
            class:selected={selectedSellId === relic.definitionId}
            onclick={() => selectForSell(relic.definitionId)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectForSell(relic.definitionId) }}
            aria-pressed={selectedSellId === relic.definitionId}
          >
            <div class="eq-row">
              <span class="eq-icon">{relic.icon}</span>
              <div class="eq-info">
                <div class="eq-name" style="color: {rarityColors[relic.rarity] ?? '#fff'}">{relic.name}</div>
                <div class="eq-sell">Sell: {relic.sellRefund}g</div>
              </div>
            </div>
            {#if selectedSellId === relic.definitionId}
              <div class="sell-confirm-inline">
                <span class="sell-confirm-label">Sell for {relic.sellRefund}g?</span>
                <div class="sell-confirm-btns">
                  <button type="button" class="btn-confirm-sell" onclick={confirmSell}>
                    Confirm Sell
                  </button>
                  <button type="button" class="btn-cancel-sell" onclick={() => { selectedSellId = null }}>
                    Cancel
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <!-- Pass Button -->
    <button type="button" class="btn-pass" onclick={() => { playCardAudio('card-skipped'); onPass() }}>
      Pass — Keep Current Relics
    </button>
  </div>
</div>

<style>
  .swap-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    padding: calc(12px * var(--layout-scale, 1));
  }

  .swap-panel {
    background: #1a2236;
    border: 2px solid #C9A227;
    border-radius: calc(12px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1));
    width: min(420px, 92vw);
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: calc(14px * var(--layout-scale, 1));
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    font-size: calc(18px * var(--layout-scale, 1));
    font-weight: 700;
    color: #f4d47c;
    margin: 0;
  }

  .slot-badge {
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 700;
    color: #FF8C00;
    background: rgba(255, 140, 0, 0.15);
    border: 1px solid #FF8C00;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
  }

  .section-label {
    font-size: calc(10px * var(--layout-scale, 1));
    font-weight: 600;
    color: #C9A227;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .offered-card {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    align-items: flex-start;
    background: rgba(201, 162, 39, 0.08);
    border: 1px solid rgba(201, 162, 39, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
  }

  .offered-icon {
    font-size: calc(28px * var(--layout-scale, 1));
    line-height: 1;
    flex-shrink: 0;
  }

  .offered-name {
    font-size: calc(14px * var(--layout-scale, 1));
    font-weight: 700;
  }

  .rarity-badge {
    font-size: calc(10px * var(--layout-scale, 1));
    font-weight: 600;
    text-transform: capitalize;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .offered-desc {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #c8d6e5;
    margin-top: calc(4px * var(--layout-scale, 1));
    line-height: 1.4;
  }

  .curse-desc {
    font-size: calc(10px * var(--layout-scale, 1));
    color: #f97316;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .equipped-grid {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .equipped-card {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    align-items: flex-start;
    background: rgba(24, 33, 46, 0.8);
    border: 1.5px solid rgba(201, 162, 39, 0.35);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: border-color 150ms ease, background 150ms ease;
    flex-direction: column;
  }

  .equipped-card > .eq-row {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    align-items: center;
  }

  .equipped-card:hover {
    border-color: rgba(201, 162, 39, 0.7);
    background: rgba(24, 33, 46, 0.95);
  }

  .equipped-card.selected {
    border-color: #f97316;
    background: rgba(249, 115, 22, 0.1);
  }

  .eq-icon {
    font-size: calc(22px * var(--layout-scale, 1));
    line-height: 1;
    flex-shrink: 0;
  }

  .eq-name {
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 600;
  }

  .eq-sell {
    font-size: calc(11px * var(--layout-scale, 1));
    color: #C9A227;
    margin-top: calc(2px * var(--layout-scale, 1));
  }

  .sell-confirm-inline {
    margin-top: calc(8px * var(--layout-scale, 1));
    border-top: 1px solid rgba(249, 115, 22, 0.3);
    padding-top: calc(8px * var(--layout-scale, 1));
    width: 100%;
  }

  .sell-confirm-label {
    font-size: calc(12px * var(--layout-scale, 1));
    color: #f97316;
    font-weight: 600;
    display: block;
    margin-bottom: calc(6px * var(--layout-scale, 1));
  }

  .sell-confirm-btns {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .btn-confirm-sell {
    flex: 1;
    background: #c2410c;
    color: #fff;
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    font-size: calc(12px * var(--layout-scale, 1));
    font-weight: 700;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .btn-confirm-sell:hover {
    background: #ea580c;
  }

  .btn-cancel-sell {
    flex: 1;
    background: rgba(75, 85, 99, 0.5);
    color: #d1d5db;
    border: 1px solid rgba(75, 85, 99, 0.7);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(6px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    font-size: calc(12px * var(--layout-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .btn-cancel-sell:hover {
    background: rgba(75, 85, 99, 0.75);
  }

  .btn-pass {
    width: 100%;
    background: rgba(55, 65, 81, 0.6);
    color: #9ca3af;
    border: 1.5px solid rgba(75, 85, 99, 0.6);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1));
    font-size: calc(13px * var(--layout-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .btn-pass:hover {
    background: rgba(55, 65, 81, 0.9);
    color: #d1d5db;
  }
</style>
