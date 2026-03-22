<script lang="ts">
  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()

  const entries = [
    { rank: 1, name: 'Astra', streak: 42, gold: 12840, bestFloor: 19 },
    { rank: 2, name: 'Glyph', streak: 35, gold: 11700, bestFloor: 17 },
    { rank: 3, name: 'Nova', streak: 31, gold: 10320, bestFloor: 16 },
    { rank: 4, name: 'Rune', streak: 27, gold: 9560, bestFloor: 15 },
    { rank: 5, name: 'Kestrel', streak: 24, gold: 9025, bestFloor: 14 },
    { rank: 6, name: 'Echo', streak: 22, gold: 8460, bestFloor: 14 },
    { rank: 7, name: 'Talon', streak: 19, gold: 8010, bestFloor: 13 },
    { rank: 8, name: 'Vesper', streak: 18, gold: 7720, bestFloor: 13 },
    { rank: 9, name: 'Quill', streak: 15, gold: 7140, bestFloor: 12 },
    { rank: 10, name: 'Orion', streak: 14, gold: 6930, bestFloor: 12 },
  ]
</script>

<section class="leaderboards-screen" aria-label="Leaderboards">
  <header class="header">
    <h2>Leaderboards</h2>
    <button type="button" class="back-btn" onclick={onBack}>Back</button>
  </header>

  <p class="helper">Local rankings</p>

  <div class="rows">
    {#each entries as entry}
      <article class="row">
        <div class="rank">#{entry.rank}</div>
        <div class="name">{entry.name}</div>
        <div class="metric metric-streak">🔥 {entry.streak}d <span class="label">streak</span></div>
        <div class="metric metric-gold">💰 {entry.gold} <span class="label">gold</span></div>
        <div class="metric metric-floor">🗻 F{entry.bestFloor} <span class="label">floor</span></div>
      </article>
    {/each}
  </div>
</section>

<style>
  .leaderboards-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: calc(16px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(96px * var(--layout-scale, 1));
    background: linear-gradient(180deg, #101320 0%, #1a1f2f 100%);
    color: #e2e8f0;
    display: grid;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header h2 {
    margin: 0;
    font-size: calc(22px * var(--text-scale, 1));
  }

  .back-btn {
    min-height: calc(44px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #dbeafe;
    padding: 0 calc(12px * var(--layout-scale, 1));
  }

  .helper {
    margin: 0;
    color: #93c5fd;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .rows {
    display: grid;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .row {
    display: grid;
    grid-template-columns: calc(54px * var(--layout-scale, 1)) minmax(0, 1fr) auto;
    grid-template-areas:
      'rank name streak'
      'rank name gold'
      'rank name floor';
    gap: calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.8);
    padding: calc(10px * var(--layout-scale, 1));
    align-items: center;
  }

  .rank {
    grid-area: rank;
    font-size: calc(18px * var(--text-scale, 1));
    color: #fde68a;
    font-weight: 700;
  }

  .name {
    grid-area: name;
    font-size: calc(16px * var(--text-scale, 1));
    color: #f8fafc;
    font-weight: 600;
  }

  .metric {
    font-size: calc(14px * var(--text-scale, 1));
    color: #cbd5e1;
    text-align: right;
    white-space: nowrap;
  }

  .metric .label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-left: calc(2px * var(--layout-scale, 1));
  }

  .metric-streak { grid-area: streak; }
  .metric-gold { grid-area: gold; }
  .metric-floor { grid-area: floor; }

  /* ═══ LANDSCAPE DESKTOP OVERRIDES ═══════════════════════════════════════════ */

  :global([data-layout="landscape"]) .leaderboards-screen {
    max-width: calc(1400px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .back-btn {
    display: none;
  }

  /* Stat values / rank numbers */
  :global([data-layout="landscape"]) .rank {
    font-size: calc(22px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .name {
    font-size: calc(22px * var(--text-scale, 1));
  }

  /* Small labels */
  :global([data-layout="landscape"]) .helper {
    font-size: calc(14px * var(--text-scale, 1));
    color: #64748b;
  }

  /* Table rows: single horizontal row with all metrics inline */
  :global([data-layout="landscape"]) .row {
    min-height: calc(56px * var(--layout-scale, 1));
    grid-template-columns: calc(60px * var(--layout-scale, 1)) minmax(0, 1fr) auto auto auto;
    grid-template-areas: 'rank name streak gold floor';
    align-items: center;
    gap: 0 calc(24px * var(--layout-scale, 1));
  }

  :global([data-layout="landscape"]) .metric {
    font-size: calc(19px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .metric .label {
    font-size: calc(13px * var(--text-scale, 1));
  }

  /* Alternate row tinting */
  :global([data-layout="landscape"]) .row:nth-child(even) {
    background: rgba(255, 255, 255, 0.03);
  }

  /* Top 3 medal borders */
  :global([data-layout="landscape"]) .row:nth-child(1) {
    border-left: 4px solid #ffd700;
  }

  :global([data-layout="landscape"]) .row:nth-child(2) {
    border-left: 4px solid #c0c0c0;
  }

  :global([data-layout="landscape"]) .row:nth-child(3) {
    border-left: 4px solid #cd7f32;
  }

  /* Top 3 rank numbers: 22px bold (already 22px for all, keep bold; rest back to 16px) */
  :global([data-layout="landscape"]) .row:nth-child(n+4) .rank {
    font-size: calc(16px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .row:hover {
    background: rgba(30, 50, 80, 0.5);
    border-color: rgba(255, 215, 0, 0.3);
    transition: all 150ms ease;
  }
</style>
