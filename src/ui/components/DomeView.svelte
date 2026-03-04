<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { gaiaExpression } from '../stores/gameState'
  import BaseView from './BaseView.svelte'
  import DomeCanvas from './DomeCanvas.svelte'
  import OxygenTankDisplay from './OxygenTankDisplay.svelte'
  import type { Fact } from '../../data/types'

  // Resource icon sprites
  import iconOxygen from '../../assets/sprites/icons/icon_oxygen.png'
  import iconDust from '../../assets/sprites/icons/icon_dust.png'
  import iconShard from '../../assets/sprites/icons/icon_shard.png'
  import iconCrystal from '../../assets/sprites/icons/icon_crystal.png'
  import iconGeode from '../../assets/sprites/icons/icon_geode.png'
  import iconEssence from '../../assets/sprites/icons/icon_essence.png'
  import iconFlame from '../../assets/sprites/icons/icon_flame.png'

  interface Props {
    onDive: () => void
    onStudy: () => void
    onReviewArtifact: () => void
    onViewTree?: () => void
    onMaterializer?: () => void
    onPremiumMaterializer?: () => void
    onCosmetics?: () => void
    onKnowledgeStore?: () => void
    onFossils?: () => void
    onZoo?: () => void
    onStreakPanel?: () => void
    onFarm?: () => void
    onSettings?: () => void
    facts?: Fact[]
  }

  let {
    onDive,
    onStudy,
    onReviewArtifact,
    onViewTree,
    onMaterializer,
    onPremiumMaterializer,
    onCosmetics,
    onKnowledgeStore,
    onFossils,
    onZoo,
    onStreakPanel,
    onFarm,
    onSettings,
    facts,
  }: Props = $props()

  /** ID of the room currently shown in the slide-up panel. null = panel hidden. */
  let activeRoom = $state<string | null>(null)

  /** Whether the panel is in the open (visible) state. */
  const panelOpen = $derived(activeRoom !== null)

  /**
   * Called by DomeCanvas when the player taps an interactive dome object.
   * The dive hatch is handled specially — it triggers a dive rather than opening a panel.
   *
   * @param objectId - Unique identifier of the tapped object.
   */
  function handleObjectTap(objectId: string, room: string): void {
    if (objectId === 'dive_hatch') {
      onDive()
      return
    }
    // Only open panel for valid dome rooms (not 'none' or 'dive')
    if (room === 'none' || room === 'dive') return
    activeRoom = room
  }

  /** Closes the room panel. */
  function closePanel(): void {
    activeRoom = null
  }

  // Derived resource display values
  const oxygen = $derived($playerSave?.oxygen ?? 0)
  const dust = $derived($playerSave?.minerals?.dust ?? 0)
  const shard = $derived($playerSave?.minerals?.shard ?? 0)
  const crystal = $derived($playerSave?.minerals?.crystal ?? 0)
  const streak = $derived($playerSave?.stats?.currentStreak ?? 0)

  // Format large numbers compactly (e.g. 12500 → "12.5k")
  function fmt(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }
</script>

<div class="dome-view">
  <!-- ── Resource bar ──────────────────────────────────────────────── -->
  <div class="resource-bar">
    <div class="resource-bar-left">
      <span class="res-item" title="Oxygen tanks">
        <img class="res-icon-img" src={iconOxygen} alt="O2" />
        <span class="res-val">{oxygen}</span>
      </span>
      <OxygenTankDisplay />
      <span class="res-item" title="Dust">
        <img class="res-icon-img" src={iconDust} alt="Dust" />
        <span class="res-val">{fmt(dust)}</span>
      </span>
      <span class="res-item" title="Shards">
        <img class="res-icon-img" src={iconShard} alt="Shard" />
        <span class="res-val">{fmt(shard)}</span>
      </span>
      <span class="res-item" title="Crystals">
        <img class="res-icon-img" src={iconCrystal} alt="Crystal" />
        <span class="res-val">{fmt(crystal)}</span>
      </span>
      {#if streak > 0}
        <span class="res-item streak-item" title="Current dive streak">
          <img class="res-icon-img" src={iconFlame} alt="Streak" />
          <span class="res-val">{streak}d</span>
        </span>
      {/if}
    </div>
    <div class="resource-bar-right">
      {#if onSettings}
        <button
          class="settings-btn"
          type="button"
          onclick={onSettings}
          aria-label="Settings"
        >⚙</button>
      {/if}
    </div>
  </div>

  <!-- ── Dome canvas area ──────────────────────────────────────────── -->
  <div class="dome-canvas-area">
    <DomeCanvas
      onObjectTap={handleObjectTap}
      gaiaExpression={$gaiaExpression}
    />
  </div>

  <!-- ── Room panel (slide up from bottom) ────────────────────────── -->
  <div
    class="room-panel"
    class:room-panel-open={panelOpen}
    role="dialog"
    aria-modal="true"
    aria-label={activeRoom ? `Room: ${activeRoom}` : 'Room panel'}
  >
    <div class="panel-header">
      <div class="panel-handle" aria-hidden="true"></div>
      <button
        class="panel-close"
        type="button"
        onclick={closePanel}
        aria-label="Close panel"
      >✕</button>
    </div>
    <div class="panel-content">
      {#if panelOpen}
        <!--
          Render the full BaseView inside the panel as the transitional approach.
          BaseView handles room tabs and all content rendering.
        -->
        <BaseView
          {onDive}
          {onStudy}
          {onReviewArtifact}
          {onViewTree}
          {onMaterializer}
          {onPremiumMaterializer}
          {onCosmetics}
          {onKnowledgeStore}
          {onFossils}
          {onZoo}
          {onStreakPanel}
          {onFarm}
          {onSettings}
          {facts}
          initialRoom={activeRoom ?? undefined}
        />
      {/if}
    </div>
  </div>

  <!-- Backdrop — tap outside panel to close -->
  {#if panelOpen}
    <div
      class="panel-backdrop"
      role="button"
      tabindex="-1"
      aria-label="Close panel"
      onclick={closePanel}
      onkeydown={(e) => { if (e.key === 'Escape') closePanel() }}
    ></div>
  {/if}
</div>

<style>
  /* ── Root container ───────────────────────────────────────────────── */
  .dome-view {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    z-index: 30;
    font-family: 'Courier New', monospace;
    background: var(--color-bg, #0a0a1a);
    overflow: hidden;
  }

  /* ── Resource bar ─────────────────────────────────────────────────── */
  .resource-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(10, 10, 26, 0.88);
    backdrop-filter: blur(4px);
    border-bottom: 1px solid rgba(78, 204, 163, 0.18);
    flex-shrink: 0;
    z-index: 1;
  }

  .resource-bar-left {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .resource-bar-right {
    display: flex;
    align-items: center;
  }

  .res-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.85rem;
    color: var(--color-text, #e0e0e0);
  }

  .res-icon-img {
    width: 16px;
    height: 16px;
    image-rendering: pixelated;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .res-val {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text, #e0e0e0);
    font-family: 'Courier New', monospace;
  }

  .streak-item .res-val {
    color: #ff9944;
  }

  .settings-btn {
    background: none;
    border: 1px solid rgba(78, 204, 163, 0.3);
    border-radius: 6px;
    color: var(--color-text-dim, #888);
    font-size: 1.2rem;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: color 120ms ease, border-color 120ms ease;
  }

  .settings-btn:hover,
  .settings-btn:focus-visible {
    color: #4ecca3;
    border-color: #4ecca3;
    outline: none;
  }

  /* ── Dome canvas area ─────────────────────────────────────────────── */
  .dome-canvas-area {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  /* ── Room panel ───────────────────────────────────────────────────── */
  .room-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 65vh;
    background: var(--color-surface, #111128);
    border-radius: 18px 18px 0 0;
    border-top: 2px solid transparent;
    background-clip: padding-box;
    box-shadow:
      0 -4px 24px rgba(0, 0, 0, 0.55),
      0 -1px 0 rgba(251, 191, 36, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transform: translateY(100%);
    transition: transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1);
    display: flex;
    flex-direction: column;
    z-index: 10;
    overflow: hidden;
  }

  .room-panel-open {
    transform: translateY(0);
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 12px 6px;
    flex-shrink: 0;
    position: relative;
    background: linear-gradient(
      180deg,
      rgba(251, 191, 36, 0.06) 0%,
      rgba(17, 17, 40, 0) 100%
    );
  }

  .panel-handle {
    width: 48px;
    height: 5px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.32);
    margin-bottom: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .panel-close {
    position: absolute;
    top: 8px;
    right: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    color: var(--color-text-dim, #888);
    font-size: 1rem;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
  }

  .panel-close:hover,
  .panel-close:focus-visible {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.55);
    background: rgba(251, 191, 36, 0.08);
    outline: none;
  }

  .panel-content {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 0 env(safe-area-inset-bottom, 0);
    flex: 1;
    min-height: 0;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .panel-content :global(.base-view) {
    position: relative;
    inset: auto;
    height: 100%;
    max-height: 55vh;
    z-index: auto;
  }

  /* ── Backdrop ─────────────────────────────────────────────────────── */
  .panel-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9;
    cursor: pointer;
  }
</style>
