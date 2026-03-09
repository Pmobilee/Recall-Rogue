<script lang="ts">
  import type { RunSummary } from '../../services/hubState'

  interface Props {
    streak: number
    lastRunSummary: RunSummary | null
    onStartRun: () => void
    onOpenLibrary: () => void
    onOpenSettings: () => void
    onOpenProfile: () => void
    onOpenJournal: () => void
    onOpenLeaderboards: () => void
  }

  let {
    streak,
    lastRunSummary,
    onStartRun,
    onOpenLibrary,
    onOpenSettings,
    onOpenProfile,
    onOpenJournal,
    onOpenLeaderboards,
  }: Props = $props()

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return 'Today'
    }
  }
</script>

<section class="hub-screen" aria-label="Home hub">
  <header class="hero">
    <h1>ARCANE RECALL</h1>
    <p>Learn facts. Build decks. Delve.</p>
  </header>

  <section class="streak-card" aria-label="Daily streak">
    <div class="streak-title">🔥 {streak} DAY STREAK</div>
    <div class="streak-sub">Complete one encounter daily to keep it alive.</div>
  </section>

  {#if lastRunSummary}
    <section class="run-summary" aria-label="Last run summary">
      <div class="summary-head">Last Run • {formatDate(lastRunSummary.runDate)}</div>
      <div class="summary-line">🗻 Floor {lastRunSummary.floorReached} • ⚔️ {lastRunSummary.enemiesDefeated} foes</div>
      <div class="summary-line">💰 {lastRunSummary.goldEarned} gold • 📚 {lastRunSummary.factsLearned} facts</div>
      <button type="button" class="mini-btn" onclick={onOpenJournal}>View Summary</button>
    </section>
  {/if}

  <button type="button" class="start-btn" data-testid="btn-start-run" onclick={onStartRun}>Start Run</button>

  <div class="grid-actions" aria-label="Hub features">
    <button type="button" class="tile" onclick={onOpenLibrary} aria-label="Knowledge Library">📖<span>Knowledge Library</span></button>
    <button type="button" class="tile" onclick={onOpenSettings} aria-label="Open Settings">⚙️<span>Settings</span></button>
    <button type="button" class="tile" onclick={onOpenProfile}>👤<span>Profile</span></button>
    <button type="button" class="tile" onclick={onOpenLeaderboards} aria-label="Leaderboards">🏆<span>Leaderboards</span></button>
    <button type="button" class="tile" onclick={onOpenJournal}>📜<span>Journal</span></button>
  </div>
</section>

<style>
  .hub-screen {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    padding: 20px 16px 96px;
    background:
      radial-gradient(circle at 20% 10%, rgba(56, 189, 248, 0.18), transparent 35%),
      radial-gradient(circle at 90% 0%, rgba(244, 114, 182, 0.12), transparent 28%),
      linear-gradient(180deg, #07111d 0%, #0f1b2c 100%);
    color: #e2e8f0;
    display: grid;
    gap: 14px;
  }

  .hero h1 {
    margin: 0;
    font-size: calc(26px * var(--text-scale, 1));
    letter-spacing: 2px;
    color: #f8fafc;
  }

  .hero p {
    margin: 4px 0 0;
    color: #93c5fd;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .streak-card,
  .run-summary {
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.34);
    background: rgba(15, 23, 42, 0.75);
    padding: 12px;
  }

  .streak-title {
    font-size: calc(18px * var(--text-scale, 1));
    color: #fbbf24;
    font-weight: 700;
  }

  .streak-sub {
    margin-top: 4px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .summary-head {
    color: #93c5fd;
    font-size: calc(12px * var(--text-scale, 1));
    margin-bottom: 6px;
  }

  .summary-line {
    font-size: calc(13px * var(--text-scale, 1));
    color: #f8fafc;
    margin: 2px 0;
  }

  .mini-btn {
    margin-top: 8px;
    min-height: 40px;
    border-radius: 10px;
    border: 1px solid rgba(125, 211, 252, 0.55);
    background: rgba(30, 64, 96, 0.75);
    color: #e0f2fe;
    padding: 0 12px;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .start-btn {
    min-height: 56px;
    border: 2px solid #f59e0b;
    border-radius: 14px;
    background: linear-gradient(180deg, #2f7a35, #1f5c28);
    color: #f8fafc;
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 0.6px;
  }

  .grid-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .tile {
    min-height: 72px;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(30, 41, 59, 0.86);
    color: #f8fafc;
    display: grid;
    place-items: center;
    font-size: 22px;
    padding: 6px;
    gap: 2px;
  }

  .tile span {
    font-size: calc(11px * var(--text-scale, 1));
    color: #cbd5e1;
  }
</style>
