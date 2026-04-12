<!-- src/ui/components/TutorialCoachMark.svelte
  Floating coach-mark tooltip for the tutorial system.

  Positions itself relative to a DOM element identified by
  data-tutorial-anchor="<target>" attributes. Falls back to
  screen-center when no anchor element is found.

  z-index 960 — above NarrativeOverlay (950), below quiz panel.

  Spotlight (when spotlight=true): renders a full-screen dim
  overlay with a rectangular cutout over the anchor element.

  Scaling rules: calc(Npx * var(--layout-scale|--text-scale, 1))
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { TutorialAnchor } from '../../data/tutorialSteps'

  interface Props {
    message: string
    anchor: TutorialAnchor
    spotlight: boolean
    ondismiss: () => void
    onskip: () => void
  }

  let { message, anchor, spotlight, ondismiss, onskip }: Props = $props()

  // ── Tooltip position state ──────────────────────────────────────────────
  interface TooltipPos {
    top: number
    left: number
    /** Which side the arrow points toward (the target). */
    arrowDir: 'up' | 'down' | 'left' | 'right' | 'none'
  }

  let tooltipPos = $state<TooltipPos>({ top: 0, left: 0, arrowDir: 'none' })
  let visible = $state(false)

  // ── Spotlight cutout ────────────────────────────────────────────────────
  interface SpotlightRect {
    top: number
    left: number
    width: number
    height: number
  }
  let spotlightRect = $state<SpotlightRect | null>(null)

  // Reference to the tooltip container for size measurement
  let tooltipEl = $state<HTMLDivElement | undefined>(undefined)

  const EDGE_MARGIN = 8     // px — min distance from any viewport edge
  const ANCHOR_GAP = 12     // px — distance between anchor and tooltip
  const SPOTLIGHT_PAD = 8   // px — padding around anchor in the spotlight cutout

  /**
   * Query the anchor element and compute tooltip position.
   * Call on mount and whenever anchor changes.
   */
  function computePosition(): void {
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Special case: Phaser canvas / no DOM element → fixed position near top-center
    if (anchor.target === 'enemy-sprite' || anchor.position === 'center') {
      const ttW = tooltipEl?.offsetWidth ?? 320
      const ttH = tooltipEl?.offsetHeight ?? 120
      tooltipPos = {
        top: Math.max(EDGE_MARGIN, (vh * 0.35) - ttH / 2),
        left: Math.max(EDGE_MARGIN, (vw / 2) - ttW / 2),
        arrowDir: 'none',
      }
      spotlightRect = null
      return
    }

    const targetEl = document.querySelector<HTMLElement>(`[data-tutorial-anchor="${anchor.target}"]`)

    if (!targetEl) {
      // No anchor found → center on screen
      const ttW = tooltipEl?.offsetWidth ?? 320
      const ttH = tooltipEl?.offsetHeight ?? 120
      tooltipPos = {
        top: Math.max(EDGE_MARGIN, vh / 2 - ttH / 2),
        left: Math.max(EDGE_MARGIN, vw / 2 - ttW / 2),
        arrowDir: 'none',
      }
      spotlightRect = null
      return
    }

    const rect = targetEl.getBoundingClientRect()
    const ttW = tooltipEl?.offsetWidth ?? 320
    const ttH = tooltipEl?.offsetHeight ?? 120
    const pos = anchor.position

    // Build spotlight cutout
    if (spotlight) {
      spotlightRect = {
        top: rect.top - SPOTLIGHT_PAD,
        left: rect.left - SPOTLIGHT_PAD,
        width: rect.width + SPOTLIGHT_PAD * 2,
        height: rect.height + SPOTLIGHT_PAD * 2,
      }
    } else {
      spotlightRect = null
    }

    let top = 0
    let left = 0
    let arrowDir: TooltipPos['arrowDir'] = 'none'

    switch (pos) {
      case 'above':
        top = rect.top - ttH - ANCHOR_GAP
        left = rect.left + rect.width / 2 - ttW / 2
        arrowDir = 'down'
        break
      case 'below':
        top = rect.bottom + ANCHOR_GAP
        left = rect.left + rect.width / 2 - ttW / 2
        arrowDir = 'up'
        break
      case 'left':
        top = rect.top + rect.height / 2 - ttH / 2
        left = rect.left - ttW - ANCHOR_GAP
        arrowDir = 'right'
        break
      case 'right':
        top = rect.top + rect.height / 2 - ttH / 2
        left = rect.right + ANCHOR_GAP
        arrowDir = 'left'
        break
    }

    // Clamp to viewport
    top  = Math.max(EDGE_MARGIN, Math.min(top,  vh - ttH - EDGE_MARGIN))
    left = Math.max(EDGE_MARGIN, Math.min(left, vw - ttW - EDGE_MARGIN))

    tooltipPos = { top, left, arrowDir }
  }

  // Recompute position whenever anchor prop changes
  $effect(() => {
    // Access anchor to establish reactivity
    void anchor.target
    void anchor.position
    // Wait a tick for the DOM to reflect any new anchor elements
    requestAnimationFrame(() => {
      computePosition()
    })
  })

  // Also recompute on window resize
  function handleResize(): void {
    computePosition()
  }

  onMount(() => {
    window.addEventListener('resize', handleResize)
    // Initial computation after layout has settled
    requestAnimationFrame(() => {
      computePosition()
      visible = true
    })
  })

  onDestroy(() => {
    window.removeEventListener('resize', handleResize)
  })

  function handleSkip(e: MouseEvent): void {
    e.stopPropagation()
    onskip()
  }

  function handleDismiss(e: MouseEvent): void {
    e.stopPropagation()
    ondismiss()
  }

  // Build the spotlight clip-path as an SVG mask-based inline style
  // We use a pseudo-element trick via CSS variables rather than SVG mask
  // to keep it simple. The cutout is rendered as a clip-path on the overlay.
  let spotlightStyle = $derived.by((): string => {
    if (!spotlightRect) return ''
    const { top, left, width, height } = spotlightRect
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
    // clip-path polygon: full screen with a rectangular hole cut out
    // (outer border → inner hole counterclockwise)
    return `clip-path: polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${left}px ${top}px,
      ${left}px ${top + height}px,
      ${left + width}px ${top + height}px,
      ${left + width}px ${top}px,
      ${left}px ${top}px
    );`
  })
</script>

<!-- Spotlight dim overlay (pointer-events: none — game remains interactive) -->
{#if spotlight && spotlightRect}
  <div
    class="tutorial-spotlight"
    style={spotlightStyle}
    aria-hidden="true"
  ></div>
{/if}

<!-- Tooltip bubble -->
<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  bind:this={tooltipEl}
  class="tutorial-coach-mark"
  class:visible
  class:arrow-up={tooltipPos.arrowDir === 'up'}
  class:arrow-down={tooltipPos.arrowDir === 'down'}
  class:arrow-left={tooltipPos.arrowDir === 'left'}
  class:arrow-right={tooltipPos.arrowDir === 'right'}
  style="top: {tooltipPos.top}px; left: {tooltipPos.left}px;"
  role="dialog"
  aria-label="Tutorial tip"
  tabindex="-1"
  onclick={(e) => e.stopPropagation()}
>
  <p class="coach-message">{message}</p>

  <div class="coach-actions">
    <button
      class="coach-btn-primary"
      onclick={handleDismiss}
      aria-label="Got it"
    >
      Got it
    </button>
  </div>

  <button
    class="coach-btn-skip"
    onclick={handleSkip}
    aria-label="Skip tutorial"
  >
    skip tutorial
  </button>
</div>

<style>
  /* ── Spotlight overlay ────────────────────────────────────────────── */
  .tutorial-spotlight {
    position: fixed;
    inset: 0;
    z-index: 959;
    background: rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }

  /* ── Tooltip bubble ───────────────────────────────────────────────── */
  .tutorial-coach-mark {
    position: fixed;
    z-index: 960;
    max-width: calc(320px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(6, 8, 16, 0.92);
    border: 1px solid rgba(241, 196, 15, 0.5);
    border-radius: calc(10px * var(--layout-scale, 1));
    box-shadow:
      0 calc(4px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6),
      0 0 calc(1px * var(--layout-scale, 1)) rgba(241, 196, 15, 0.2) inset;
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
    /* Start invisible, animate in */
    opacity: 0;
    transform: translateY(calc(8px * var(--layout-scale, 1)));
    transition: opacity 200ms ease, transform 200ms ease;
    pointer-events: auto;
  }

  .tutorial-coach-mark.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Arrow direction slide-in refinements */
  .tutorial-coach-mark.arrow-up    { transform: translateY(calc(-8px * var(--layout-scale, 1))); }
  .tutorial-coach-mark.arrow-down  { transform: translateY(calc(8px * var(--layout-scale, 1))); }
  .tutorial-coach-mark.arrow-left  { transform: translateX(calc(-8px * var(--layout-scale, 1))); }
  .tutorial-coach-mark.arrow-right { transform: translateX(calc(8px * var(--layout-scale, 1))); }

  .tutorial-coach-mark.visible.arrow-up,
  .tutorial-coach-mark.visible.arrow-down,
  .tutorial-coach-mark.visible.arrow-left,
  .tutorial-coach-mark.visible.arrow-right {
    transform: translate(0, 0);
  }

  /* ── CSS triangle arrows ─────────────────────────────────────────── */

  /* Arrow base: a ::before pseudo-element renders the gold border triangle,
     ::after renders the dark fill triangle on top. */

  .tutorial-coach-mark.arrow-up::before,
  .tutorial-coach-mark.arrow-up::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
  }

  /* Arrow pointing UP (tooltip is below anchor → arrow points toward top) */
  .tutorial-coach-mark.arrow-up::before {
    top: calc(-13px * var(--layout-scale, 1));
    border-left: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-right: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-bottom: calc(12px * var(--layout-scale, 1)) solid rgba(241, 196, 15, 0.5);
  }
  .tutorial-coach-mark.arrow-up::after {
    top: calc(-10px * var(--layout-scale, 1));
    border-left: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-right: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-bottom: calc(10px * var(--layout-scale, 1)) solid rgba(6, 8, 16, 0.95);
  }

  /* Arrow pointing DOWN (tooltip is above anchor → arrow points toward bottom) */
  .tutorial-coach-mark.arrow-down::before,
  .tutorial-coach-mark.arrow-down::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
  }
  .tutorial-coach-mark.arrow-down::before {
    bottom: calc(-13px * var(--layout-scale, 1));
    border-left: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-right: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-top: calc(12px * var(--layout-scale, 1)) solid rgba(241, 196, 15, 0.5);
  }
  .tutorial-coach-mark.arrow-down::after {
    bottom: calc(-10px * var(--layout-scale, 1));
    border-left: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-right: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-top: calc(10px * var(--layout-scale, 1)) solid rgba(6, 8, 16, 0.95);
  }

  /* Arrow pointing LEFT (tooltip is to the right of anchor) */
  .tutorial-coach-mark.arrow-left::before,
  .tutorial-coach-mark.arrow-left::after {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    left: auto;
  }
  .tutorial-coach-mark.arrow-left::before {
    left: calc(-13px * var(--layout-scale, 1));
    border-top: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-bottom: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-right: calc(12px * var(--layout-scale, 1)) solid rgba(241, 196, 15, 0.5);
  }
  .tutorial-coach-mark.arrow-left::after {
    left: calc(-10px * var(--layout-scale, 1));
    border-top: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-bottom: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-right: calc(10px * var(--layout-scale, 1)) solid rgba(6, 8, 16, 0.95);
  }

  /* Arrow pointing RIGHT (tooltip is to the left of anchor) */
  .tutorial-coach-mark.arrow-right::before,
  .tutorial-coach-mark.arrow-right::after {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    left: auto;
  }
  .tutorial-coach-mark.arrow-right::before {
    right: calc(-13px * var(--layout-scale, 1));
    border-top: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-bottom: calc(10px * var(--layout-scale, 1)) solid transparent;
    border-left: calc(12px * var(--layout-scale, 1)) solid rgba(241, 196, 15, 0.5);
  }
  .tutorial-coach-mark.arrow-right::after {
    right: calc(-10px * var(--layout-scale, 1));
    border-top: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-bottom: calc(9px * var(--layout-scale, 1)) solid transparent;
    border-left: calc(10px * var(--layout-scale, 1)) solid rgba(6, 8, 16, 0.95);
  }

  /* ── Message text ────────────────────────────────────────────────── */
  .coach-message {
    margin: 0;
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(14px * var(--text-scale, 1));
    color: #f4f7fb;
    line-height: 1.5;
    font-style: italic;
  }

  /* ── Action row ──────────────────────────────────────────────────── */
  .coach-actions {
    display: flex;
    justify-content: flex-end;
  }

  .coach-btn-primary {
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(18px * var(--layout-scale, 1));
    background: linear-gradient(135deg, rgba(241, 196, 15, 0.25) 0%, rgba(230, 160, 0, 0.20) 100%);
    border: 1px solid rgba(241, 196, 15, 0.7);
    border-radius: calc(6px * var(--layout-scale, 1));
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(241, 210, 100, 1);
    cursor: pointer;
    pointer-events: auto;
    transition: background 150ms ease, border-color 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .coach-btn-primary:hover {
    background: linear-gradient(135deg, rgba(241, 196, 15, 0.4) 0%, rgba(230, 160, 0, 0.35) 100%);
    border-color: rgba(241, 196, 15, 1);
  }

  .coach-btn-skip {
    all: unset;
    display: block;
    width: 100%;
    text-align: center;
    font-family: var(--font-rpg, 'Lora', 'Georgia', serif);
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    pointer-events: auto;
    padding: calc(4px * var(--layout-scale, 1)) 0;
    min-height: calc(44px * var(--layout-scale, 1));
    display: flex;
    align-items: center;
    justify-content: center;
    font-style: italic;
    transition: color 150ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .coach-btn-skip:hover {
    color: rgba(255, 255, 255, 0.6);
  }
</style>
