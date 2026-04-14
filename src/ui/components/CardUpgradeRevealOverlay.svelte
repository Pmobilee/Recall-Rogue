<script lang="ts">
  /**
   * CardUpgradeRevealOverlay.svelte — Mastery upgrade reveal popup.
   *
   * Shows BEFORE and AFTER versions of an upgraded card side by side with an
   * animated arrow and a stat diff strip. Triggered by gameFlowController when
   * a card levels up via mastery challenge or rest-room upgrade.
   *
   * Also supports 'freeCard' mode (mystery event free-card reward): shows only
   * the acquired card centered with a green accent and no stat diff strip.
   *
   * z-index: 220 (above other overlays, below quiz panel at 300+).
   * Animation: overlay fades in, before-card slides from left, after-card slides
   * from right with glow, arrow pulses.
   */
  import type { Card } from '../../data/card-types'
  import CardVisual from './CardVisual.svelte'
  import { getMasteryStats, getEffectiveApCost } from '../../services/cardUpgradeService'
  import { playCardAudio } from '../../services/cardAudioManager'

  interface Props {
    beforeCard: Card
    afterCard: Card
    mechanicName: string
    beforeLevel: number
    afterLevel: number
    mode?: 'upgrade' | 'freeCard'
    ondismiss: () => void
  }

  let { beforeCard, afterCard, mechanicName, beforeLevel, afterLevel, mode = 'upgrade', ondismiss }: Props = $props()

  let isFreeCard = $derived(mode === 'freeCard')

  // ── Card dimensions (matches CardPickerOverlay formula) ─────────────────────
  let viewportHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 1080)
  $effect(() => {
    const onResize = () => { viewportHeight = window.innerHeight }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  /** Card height: 35vh. Width derived from native 886×1142 aspect ratio. */
  const cardH = $derived((35 * viewportHeight) / 100)
  const cardW = $derived(cardH * (886 / 1142))

  // ── Stats ────────────────────────────────────────────────────────────────────
  const beforeStats = $derived(getMasteryStats(beforeCard.mechanicId ?? '', beforeLevel))
  const afterStats  = $derived(getMasteryStats(afterCard.mechanicId  ?? '', afterLevel))

  /** AP cost comparison using effective (stat-table-aware) values. */
  const beforeAp = $derived(getEffectiveApCost(beforeCard))
  const afterAp  = $derived(getEffectiveApCost(afterCard))

  /** Tags that were gained at the new level. */
  const gainedTags = $derived(() => {
    if (!afterStats?.tags) return []
    const before = new Set(beforeStats?.tags ?? [])
    return afterStats.tags.filter(t => !before.has(t))
  })

  /** True when a stat actually changed so we show a non-trivial diff row. */
  function hasChange(a: number | undefined, b: number | undefined): boolean {
    return a !== undefined && b !== undefined && a !== b
  }

  // ── Sound ─────────────────────────────────────────────────────────────────────
  $effect(() => {
    // 'event-positive' is confirmed in cardAudioManager CardAudioCue union (line 146)
    playCardAudio('event-positive')
  })

  // ── Keyboard dismiss ──────────────────────────────────────────────────────────
  $effect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        ondismiss()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="upgrade-reveal-overlay"
  role="dialog"
  aria-modal="true"
  aria-label={isFreeCard ? 'New Card!' : 'Card Upgraded'}
>
  <!-- Semi-transparent backdrop — clicking it dismisses -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={ondismiss}></div>

  <div class="upgrade-reveal-panel">

    <!-- Title -->
    <h2 class="upgrade-title" class:free-card-title={isFreeCard}>{isFreeCard ? 'New Card!' : 'Card Upgraded!'}</h2>
    <p class="upgrade-subtitle">{mechanicName}</p>

    <!-- Card comparison (upgrade mode: before + arrow + after; freeCard mode: after only, centered) -->
    <div class="card-comparison">

      {#if !isFreeCard}
        <!-- Before card (left) -->
        <div class="card-slot before-slot">
          <div class="level-badge before-badge" aria-label="Before level {beforeLevel}">
            L{beforeLevel}
          </div>
          <div
            class="card-wrapper before-card"
            style="width: {cardW}px; height: {cardH}px; --card-w: {cardW}px;"
          >
            <CardVisual card={beforeCard} />
          </div>
        </div>

        <!-- Arrow -->
        <div class="arrow-container" aria-hidden="true">
          <span class="upgrade-arrow">›</span>
        </div>
      {/if}

      <!-- After card (right for upgrade, centered for freeCard) -->
      <div class="card-slot after-slot">
        {#if !isFreeCard}
          <div class="level-badge after-badge" aria-label="Upgraded to level {afterLevel}">
            L{afterLevel}
          </div>
        {/if}
        <div
          class="card-wrapper after-card"
          class:after-card-free={isFreeCard}
          style="width: {cardW}px; height: {cardH}px; --card-w: {cardW}px;"
        >
          <CardVisual card={afterCard} />
        </div>
      </div>

    </div><!-- /card-comparison -->

    {#if !isFreeCard}
      <!-- Stat diff strip — upgrade mode only -->
      <div class="stat-changes" aria-label="Stat changes">
        <!-- Mastery level row always shown -->
        <div class="stat-row">
          <span class="stat-label">Mastery</span>
          <span class="stat-value">
            <span class="stat-before">L{beforeLevel}</span>
            <span class="stat-arrow" aria-hidden="true">→</span>
            <span class="stat-after">L{afterLevel}</span>
          </span>
        </div>

        <!-- Damage / QP value -->
        {#if hasChange(beforeStats?.qpValue, afterStats?.qpValue)}
          <div class="stat-row">
            <span class="stat-label">Damage</span>
            <span class="stat-value">
              <span class="stat-before">{beforeStats?.qpValue}</span>
              <span class="stat-arrow" aria-hidden="true">→</span>
              <span class="stat-after">{afterStats?.qpValue}</span>
            </span>
          </div>
        {/if}

        <!-- Secondary value (block on iron_wave, etc.) -->
        {#if hasChange(beforeStats?.secondaryValue, afterStats?.secondaryValue)}
          <div class="stat-row">
            <span class="stat-label">Block</span>
            <span class="stat-value">
              <span class="stat-before">{beforeStats?.secondaryValue}</span>
              <span class="stat-arrow" aria-hidden="true">→</span>
              <span class="stat-after">{afterStats?.secondaryValue}</span>
            </span>
          </div>
        {/if}

        <!-- AP cost -->
        {#if beforeAp !== afterAp}
          <div class="stat-row">
            <span class="stat-label">AP Cost</span>
            <span class="stat-value">
              <span class="stat-before">{beforeAp}</span>
              <span class="stat-arrow" aria-hidden="true">→</span>
              <span class="stat-after highlight-good">{afterAp}</span>
            </span>
          </div>
        {/if}

        <!-- Newly gained tags -->
        {#each gainedTags() as tag}
          <div class="stat-row">
            <span class="stat-label">New ability</span>
            <span class="stat-value stat-after">{tag}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Dismiss -->
    <button
      class="continue-btn"
      class:continue-btn-free={isFreeCard}
      data-testid="btn-upgrade-reveal-continue"
      onclick={ondismiss}
    >
      Continue
    </button>

  </div><!-- /upgrade-reveal-panel -->
</div>

<style>
  /* ── Overlay shell ──────────────────────────────────────────────────────── */
  .upgrade-reveal-overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
    animation: overlayFadeIn 280ms ease forwards;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(13, 17, 23, 0.85);
    cursor: pointer;
  }

  /* ── Panel ──────────────────────────────────────────────────────────────── */
  .upgrade-reveal-panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(18px * var(--layout-scale, 1));
    padding: calc(32px * var(--layout-scale, 1)) calc(40px * var(--layout-scale, 1));
    max-width: calc(720px * var(--layout-scale, 1));
    width: 90%;
    background: rgba(15, 20, 28, 0.96);
    border: 1px solid rgba(251, 191, 36, 0.35);
    border-radius: calc(12px * var(--layout-scale, 1));
    box-shadow:
      0 0 calc(40px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.12),
      0 calc(8px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7);
  }

  /* ── Title ──────────────────────────────────────────────────────────────── */
  .upgrade-title {
    margin: 0;
    font-size: calc(28px * var(--text-scale, 1));
    font-weight: 800;
    color: #fbbf24;
    text-align: center;
    text-shadow:
      0 0 calc(20px * var(--layout-scale, 1)) rgba(251, 191, 36, 0.6),
      0 2px calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.8);
    letter-spacing: 0.04em;
    animation: titlePop 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  /* freeCard mode: green title instead of gold */
  .upgrade-title.free-card-title {
    color: #34d399;
    text-shadow:
      0 0 calc(20px * var(--layout-scale, 1)) rgba(52, 211, 153, 0.6),
      0 2px calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.8);
  }

  .upgrade-subtitle {
    margin: 0;
    font-size: calc(14px * var(--text-scale, 1));
    color: #8899aa;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  /* ── Card comparison row ────────────────────────────────────────────────── */
  .card-comparison {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: calc(20px * var(--layout-scale, 1));
  }

  .card-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .card-wrapper {
    position: relative;
    border-radius: calc(8px * var(--layout-scale, 1));
    overflow: hidden;
  }

  /* Before card: dimmed to make the upgraded version pop */
  .before-card {
    opacity: 0.65;
    filter: saturate(0.7) brightness(0.85);
    animation: slideInLeft 380ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  /* After card: full brightness + gold glow shimmer */
  .after-card {
    animation: slideInRight 420ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both;
    box-shadow:
      0 0 calc(16px * var(--layout-scale, 1)) rgba(251, 191, 36, 0.45),
      0 0 calc(32px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.22);
  }

  /* freeCard mode: green glow on the single card */
  .after-card.after-card-free {
    box-shadow:
      0 0 calc(16px * var(--layout-scale, 1)) rgba(52, 211, 153, 0.45),
      0 0 calc(32px * var(--layout-scale, 1)) rgba(52, 211, 153, 0.22);
  }

  /* Gold shimmer border on the after card */
  .after-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: calc(8px * var(--layout-scale, 1));
    border: 1px solid rgba(251, 191, 36, 0.5);
    pointer-events: none;
    animation: borderShimmer 2.4s ease-in-out infinite;
  }

  /* Green shimmer border for freeCard mode */
  .after-card.after-card-free::after {
    border-color: rgba(52, 211, 153, 0.5);
    animation: borderShimmerGreen 2.4s ease-in-out infinite;
  }

  /* ── Level badges ───────────────────────────────────────────────────────── */
  .level-badge {
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: calc(3px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    border-radius: calc(20px * var(--layout-scale, 1));
    text-transform: uppercase;
  }

  .before-badge {
    background: rgba(80, 90, 110, 0.5);
    color: #8899aa;
    border: 1px solid rgba(80, 90, 110, 0.6);
  }

  .after-badge {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.5);
    box-shadow: 0 0 calc(8px * var(--layout-scale, 1)) rgba(251, 191, 36, 0.25);
  }

  /* ── Arrow ──────────────────────────────────────────────────────────────── */
  .arrow-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .upgrade-arrow {
    font-size: calc(36px * var(--text-scale, 1));
    color: #f59e0b;
    line-height: 1;
    animation: arrowPulse 1.4s ease-in-out infinite;
    text-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.7);
    display: block;
  }

  /* ── Stat diff strip ────────────────────────────────────────────────────── */
  .stat-changes {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    width: 100%;
    max-width: calc(340px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: calc(8px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
  }

  .stat-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .stat-label {
    font-size: calc(13px * var(--text-scale, 1));
    color: #8899aa;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }

  .stat-value {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
  }

  .stat-before {
    color: #6b7280;
    text-decoration: line-through;
    text-decoration-color: rgba(107, 114, 128, 0.5);
  }

  .stat-arrow {
    color: #374151;
    font-size: calc(11px * var(--text-scale, 1));
  }

  .stat-after {
    color: #fbbf24;
  }

  .highlight-good {
    color: #34d399; /* green — AP reduction is a buff */
  }

  /* ── Continue button ────────────────────────────────────────────────────── */
  .continue-btn {
    margin-top: calc(4px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1));
    background: linear-gradient(135deg, #f59e0b, #d97706);
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #0f1419;
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.3);
  }

  /* freeCard mode: green continue button */
  .continue-btn.continue-btn-free {
    background: linear-gradient(135deg, #34d399, #10b981);
    box-shadow: 0 calc(4px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(52, 211, 153, 0.3);
  }

  .continue-btn:hover {
    filter: brightness(1.1);
    transform: translateY(calc(-1px * var(--layout-scale, 1)));
    box-shadow: 0 calc(6px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(245, 158, 11, 0.45);
  }

  .continue-btn.continue-btn-free:hover {
    box-shadow: 0 calc(6px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) rgba(52, 211, 153, 0.45);
  }

  .continue-btn:active {
    transform: translateY(0);
    filter: brightness(0.95);
  }

  /* ── Keyframe animations ────────────────────────────────────────────────── */
  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes titlePop {
    from { opacity: 0; transform: scale(0.85) translateY(calc(-6px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(calc(-30px * var(--layout-scale, 1))); }
    to   { opacity: 0.65; transform: translateX(0); }
    /* NOTE: Final opacity here is set to 0.65 to match the .before-card opacity rule. */
  }

  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(calc(30px * var(--layout-scale, 1))) scale(0.96); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }

  @keyframes arrowPulse {
    0%, 100% { opacity: 0.6; transform: translateX(0); }
    50%       { opacity: 1;   transform: translateX(calc(4px * var(--layout-scale, 1))); }
  }

  @keyframes borderShimmer {
    0%, 100% { border-color: rgba(251, 191, 36, 0.35); box-shadow: none; }
    50%       { border-color: rgba(251, 191, 36, 0.75); box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(251, 191, 36, 0.3); }
  }

  @keyframes borderShimmerGreen {
    0%, 100% { border-color: rgba(52, 211, 153, 0.35); box-shadow: none; }
    50%       { border-color: rgba(52, 211, 153, 0.75); box-shadow: 0 0 calc(12px * var(--layout-scale, 1)) rgba(52, 211, 153, 0.3); }
  }
</style>
