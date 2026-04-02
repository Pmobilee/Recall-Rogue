<script lang="ts">
  import { get } from 'svelte/store';
  import { activeRunState } from '../../services/runStateStore';
  import { CHAIN_TYPES } from '../../data/chainTypes';
  import type { ChainDistribution, TopicGroup } from '../../services/chainDistribution';
  import { playCardAudio } from '../../services/cardAudioManager';

  /**
   * Props:
   *   onShuffle        — Re-distributes topics across chains with a new seed.
   *                      Provided by CardApp; calls game-logic's reshuffleChainDistribution().
   *   onBeginExpedition — Confirms the distribution and transitions to dungeonMap.
   *                      Provided by CardApp; calls game-logic's confirmChainDistribution().
   */
  interface Props {
    onShuffle: () => void;
    onBeginExpedition: () => void;
  }

  const { onShuffle, onBeginExpedition }: Props = $props();

  /** Reactive snapshot of the run's chain distribution. */
  const distribution = $derived($activeRunState?.chainDistribution ?? null);

  /** The three chain type indices for this run, falling back to [0,1,2] as a safe default. */
  const runChainTypes = $derived(distribution?.runChainTypes ?? [0, 1, 2]);

  /** Total fact count across all groups in a given chain slot. */
  function totalFacts(groups: TopicGroup[]): number {
    return groups.reduce((sum, g) => sum + g.factIds.length, 0);
  }

  /** FSRS breakdown label: "5N 8L 10R 3M" */
  function fsrsLabel(group: TopicGroup): string {
    const { new: n, learning: l, review: r, mastered: m } = group.fsrs;
    return `${n}N ${l}L ${r}R ${m}M`;
  }

  function handleShuffle(): void {
    playCardAudio('tab-switch');
    onShuffle();
  }

  function handleBeginExpedition(): void {
    playCardAudio('run-start');
    onBeginExpedition();
  }
</script>

<div class="run-preview-screen">
  <header class="screen-header">
    <h1 class="screen-title">YOUR KNOWLEDGE CHAINS</h1>
    <p class="screen-subtitle">Topics are distributed across your three chain colors for this expedition</p>
  </header>

  <div class="chains-grid">
    {#if distribution}
      {#each runChainTypes as chainIdx, slotIndex}
        {@const chainDef = CHAIN_TYPES[chainIdx]}
        {@const groups = distribution.assignments[slotIndex] ?? []}
        {@const total = totalFacts(groups)}
        <div
          class="chain-column"
          style="--chain-color: {chainDef.hexColor}; --chain-glow: {chainDef.glowColor};"
        >
          <div class="chain-header">
            <span class="chain-dot" aria-hidden="true"></span>
            <span class="chain-name">{chainDef.name}</span>
          </div>

          <div class="topic-list">
            {#each groups as group}
              <div class="topic-card">
                <div class="topic-name">{group.label}</div>
                <div class="topic-facts">{group.factIds.length} facts</div>
                <div class="topic-fsrs">{fsrsLabel(group)}</div>
              </div>
            {/each}

            {#if groups.length === 0}
              <div class="topic-card topic-card--empty">
                <div class="topic-name">No topics assigned</div>
              </div>
            {/if}
          </div>

          <div class="chain-footer">
            <span class="chain-total">{total} total facts</span>
          </div>
        </div>
      {/each}
    {:else}
      <!-- Fallback when distribution is not yet computed -->
      <div class="loading-state">
        <p>Preparing your knowledge chains...</p>
      </div>
    {/if}
  </div>

  <footer class="screen-footer">
    <div class="fsrs-legend">
      <span class="legend-item legend-item--new">N = New</span>
      <span class="legend-item legend-item--learning">L = Learning</span>
      <span class="legend-item legend-item--review">R = Review</span>
      <span class="legend-item legend-item--mastered">M = Mastered</span>
    </div>

    <div class="action-buttons">
      <button class="btn-secondary" onclick={handleShuffle}>
        Shuffle Chains
      </button>
      <button class="btn-primary" onclick={handleBeginExpedition} disabled={!distribution}>
        Begin Expedition
      </button>
    </div>
  </footer>
</div>

<style>
  .run-preview-screen {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 900px 500px at 50% 30%, rgba(38, 166, 154, 0.04), transparent),
      linear-gradient(160deg, #080c14 0%, #0a0f1a 50%, #080c14 100%);
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow: hidden;
  }

  /* ── Header ─────────────────────────────────────────── */

  .screen-header {
    padding: calc(32px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    text-align: center;
    flex-shrink: 0;
  }

  .screen-title {
    font-size: calc(28px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: calc(4px * var(--layout-scale, 1));
    color: #e2e8f0;
    margin: 0 0 calc(8px * var(--layout-scale, 1));
    text-transform: uppercase;
  }

  .screen-subtitle {
    font-size: calc(13px * var(--text-scale, 1));
    color: #64748b;
    margin: 0;
    letter-spacing: 0.5px;
  }

  /* ── Chains grid ─────────────────────────────────────── */

  .chains-grid {
    flex: 1;
    display: flex;
    gap: calc(24px * var(--layout-scale, 1));
    padding: 0 calc(48px * var(--layout-scale, 1));
    overflow: hidden;
    min-height: 0;
  }

  .chain-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid color-mix(in srgb, var(--chain-color) 25%, transparent);
    border-radius: calc(12px * var(--layout-scale, 1));
    overflow: hidden;
    box-shadow:
      0 0 calc(20px * var(--layout-scale, 1)) var(--chain-glow),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  /* ── Chain header ────────────────────────────────────── */

  .chain-header {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
    padding: calc(16px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: color-mix(in srgb, var(--chain-color) 12%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--chain-color) 20%, transparent);
    flex-shrink: 0;
  }

  .chain-dot {
    width: calc(10px * var(--layout-scale, 1));
    height: calc(10px * var(--layout-scale, 1));
    border-radius: 50%;
    background: var(--chain-color);
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) var(--chain-color);
    flex-shrink: 0;
  }

  .chain-name {
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 600;
    color: var(--chain-color);
    letter-spacing: calc(2px * var(--layout-scale, 1));
    text-transform: uppercase;
  }

  /* ── Topic list ──────────────────────────────────────── */

  .topic-list {
    flex: 1;
    overflow-y: auto;
    padding: calc(12px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--layout-scale, 1));
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  .topic-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    transition: background 0.15s ease;
  }

  .topic-card:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .topic-card--empty {
    opacity: 0.4;
    font-style: italic;
  }

  .topic-name {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 500;
    color: #cbd5e1;
    margin-bottom: calc(4px * var(--layout-scale, 1));
    line-height: 1.3;
  }

  .topic-facts {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    margin-bottom: calc(3px * var(--layout-scale, 1));
  }

  .topic-fsrs {
    font-size: calc(11px * var(--text-scale, 1));
    color: #475569;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.3px;
  }

  /* ── Chain footer ────────────────────────────────────── */

  .chain-footer {
    flex-shrink: 0;
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.2);
  }

  .chain-total {
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    color: var(--chain-color);
    opacity: 0.8;
  }

  /* ── Loading state ───────────────────────────────────── */

  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: calc(15px * var(--text-scale, 1));
  }

  /* ── Footer ──────────────────────────────────────────── */

  .screen-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(20px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.15);
  }

  /* ── FSRS legend ─────────────────────────────────────── */

  .fsrs-legend {
    display: flex;
    gap: calc(20px * var(--layout-scale, 1));
  }

  .legend-item {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .legend-item--new { color: #e2e8f0; }
  .legend-item--learning { color: #f59e0b; }
  .legend-item--review { color: #60a5fa; }
  .legend-item--mastered { color: #34d399; }

  /* ── Action buttons ──────────────────────────────────── */

  .action-buttons {
    display: flex;
    gap: calc(16px * var(--layout-scale, 1));
    align-items: center;
  }

  .btn-secondary {
    padding: calc(12px * var(--layout-scale, 1)) calc(28px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #94a3b8;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.5px;
    transition: all 0.2s ease;
    min-height: calc(44px * var(--layout-scale, 1));
    min-width: calc(44px * var(--layout-scale, 1));
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.25);
    color: #e2e8f0;
  }

  .btn-secondary:active {
    transform: scale(0.97);
  }

  .btn-primary {
    padding: calc(12px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #1e3a5f 0%, #1a4d3a 100%);
    border: 1px solid rgba(96, 165, 250, 0.3);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #e2e8f0;
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: calc(2px * var(--layout-scale, 1));
    text-transform: uppercase;
    transition: all 0.2s ease;
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
    min-height: calc(44px * var(--layout-scale, 1));
    min-width: calc(44px * var(--layout-scale, 1));
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #264d7a 0%, #1f6349 100%);
    border-color: rgba(96, 165, 250, 0.5);
    box-shadow: 0 calc(6px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.4);
    transform: translateY(calc(-1px * var(--layout-scale, 1)));
  }

  .btn-primary:active:not(:disabled) {
    transform: scale(0.97);
  }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
