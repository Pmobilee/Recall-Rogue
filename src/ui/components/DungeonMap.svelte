<script lang="ts">
  import { onMount } from 'svelte'
  import type { ActMap, MapNode } from '../../services/mapGenerator'
  import MapNodeComponent from './MapNode.svelte'
  import { BASE_WIDTH } from '../../data/layout'
  import { isLandscape } from '../../stores/layoutStore'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { MAP_CINEMATIC_ENABLED } from '../../data/balance'

  // =========================================================
  // Props
  // =========================================================

  interface Props {
    map: ActMap
    playerHp: number
    playerMaxHp: number
    onNodeSelect: (nodeId: string) => void
  }

  let { map, playerHp, playerMaxHp, onNodeSelect }: Props = $props()

  // =========================================================
  // Layout scale helper
  // =========================================================

  function getLayoutScale(): number {
    if (typeof window === 'undefined') return 1
    const val = getComputedStyle(document.documentElement).getPropertyValue('--layout-scale')
    return parseFloat(val) || 1
  }

  // =========================================================
  // Constants
  // =========================================================

  const SEGMENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
    1: 'Shallow Depths',
    2: 'Deep Caverns',
    3: 'The Abyss',
    4: 'The Archive',
  }

  /** Max container width — centred on wide screens. */
  const MAX_WIDTH = 680

  /**
   * Base vertical spacing between history rows (unscaled px).
   */
  const ROW_HEIGHT_BASE = 100

  // =========================================================
  // Reactive state
  // =========================================================

  let scrollContainer = $state<HTMLDivElement | undefined>(undefined)
  let layoutScale = $state(1)

  function getInitialContainerWidth(): number {
    if (typeof window === 'undefined') return BASE_WIDTH
    return $isLandscape
      ? Math.min(window.innerWidth * 0.7, MAX_WIDTH)
      : Math.min(window.innerWidth, MAX_WIDTH)
  }

  let containerWidth = $state(getInitialContainerWidth())

  /** Segment name from act number. */
  let segmentName = $derived(SEGMENT_NAMES[map.segment])

  /** HP percentage 0–100. */
  let hpPercent = $derived(playerMaxHp > 0 ? Math.round((playerHp / playerMaxHp) * 100) : 0)

  // =========================================================
  // Progressive view data derivation
  // =========================================================

  /** Nodes currently selectable (state === 'available'). Rendered at the TOP. */
  let availableNodes = $derived(
    Object.values(map.nodes).filter(n => n.state === 'available'),
  )

  /**
   * Decision history with resolved node objects.
   * Displayed newest-first (top = most recent past step).
   */
  interface ResolvedDecision {
    selectedNode: MapNode
    altNodes: MapNode[]
  }

  let resolvedHistory = $derived.by<ResolvedDecision[]>(() => {
    return map.decisionHistory
      .map(d => {
        const selectedNode = map.nodes[d.selectedId]
        if (!selectedNode) return null
        const altNodes = d.availableIds
          .filter(id => id !== d.selectedId)
          .map(id => map.nodes[id])
          .filter((n): n is MapNode => n !== undefined)
        return { selectedNode, altNodes }
      })
      .filter((d): d is ResolvedDecision => d !== null)
  })

  // =========================================================
  // Scaled layout helpers (used only for history section)
  // =========================================================

  let rowH = $derived(ROW_HEIGHT_BASE * layoutScale)

  /** Total height of the history canvas. */
  let historyCanvasHeight = $derived(
    resolvedHistory.length * rowH + 48 * layoutScale,
  )

  /**
   * Horizontal centre pixel for node index within a row group.
   * Uses padding to keep nodes away from edges.
   */
  function nodeGroupX(index: number, total: number, width: number): number {
    const padding = 64 * layoutScale
    const usable = width - padding * 2
    if (total === 1) return width / 2
    return padding + (index / (total - 1)) * usable
  }

  /** Cubic-bezier SVG path between two pixel coords. */
  function arrowPath(px: number, py: number, tx: number, ty: number): string {
    const midY = (py + ty) / 2
    return `M ${px} ${py} C ${px} ${midY}, ${tx} ${midY}, ${tx} ${ty}`
  }

  /** Y centre of a history row's node (rowIndex 0 = most recent). */
  function historyNodeY(rowIndex: number): number {
    return rowIndex * rowH + rowH * 0.52
  }

  /** Y for the connector SVG top within a history row. */
  function historyConnectorTopY(rowIndex: number): number {
    return rowIndex * rowH + rowH * 0.08
  }

  // =========================================================
  // Mount + resize tracking
  // =========================================================

  onMount(() => {
    playCardAudio('map-open')
    layoutScale = getLayoutScale()

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth = $isLandscape
          ? Math.min(entry.contentRect.width * 0.7, MAX_WIDTH)
          : Math.min(entry.contentRect.width, MAX_WIDTH)
        layoutScale = getLayoutScale()
      }
    })
    if (scrollContainer) observer.observe(scrollContainer)

    // Snap to top so choices are immediately visible
    if (scrollContainer) scrollContainer.scrollTop = 0

    return () => observer.disconnect()
  })

  // Jump to top whenever choices update (new room selected → new choices appear)
  $effect(() => {
    // Reactive trigger: watch available node count
    void availableNodes.length
    if (scrollContainer && !MAP_CINEMATIC_ENABLED) {
      scrollContainer.scrollTop = 0
    }
  })
</script>

<div class="dungeon-map-overlay" data-testid="dungeon-map">
  <!-- Fixed HUD -->
  <header class="map-hud">
    <h1 class="hud-title">{segmentName}</h1>

    <div class="hp-bar-container" aria-label="Health: {playerHp} of {playerMaxHp}">
      <div class="hp-bar-bg" role="progressbar" aria-valuenow={hpPercent} aria-valuemin={0} aria-valuemax={100}>
        <div class="hp-bar-fill" style="width: {hpPercent}%"></div>
      </div>
      <span class="hp-text" aria-hidden="true">{playerHp} / {playerMaxHp}</span>
    </div>
  </header>

  <!-- Scrollable content — choices centered, history below -->
  <div class="map-scroll-container" bind:this={scrollContainer}>

    <!-- =================================================
         SECTION 1: Centered choices — fills available space
         ================================================= -->
    <section class="choices-center-area" aria-label="Choose your next room">
      <p class="section-label choices-label">Choose your path</p>

      <div class="choices-nodes-row" style="width: {containerWidth}px;">
        {#each availableNodes as node, i (node.id)}
          <MapNodeComponent
            {node}
            prominent={true}
            onclick={() => onNodeSelect(node.id)}
          />
        {/each}

        {#if availableNodes.length === 0}
          <p class="no-choices-hint">Entering room…</p>
        {/if}
      </div>
    </section>

    <!-- =================================================
         SECTION 2: Decision history — below the choices
         Newest entry at top, oldest at bottom.
         ================================================= -->
    {#if resolvedHistory.length > 0}
      <section class="history-section" aria-label="Path history">
        <p class="section-label history-label">Your path</p>

        <div
          class="history-canvas"
          style="width: {containerWidth}px; height: {historyCanvasHeight}px;"
        >
          {#each [...resolvedHistory].reverse() as decision, reverseIdx (decision.selectedNode.id)}
            {@const histIdx = resolvedHistory.length - 1 - reverseIdx}

            <!-- Connector arrow pointing UPWARD from this row's node toward the row above (newer step) -->
            <svg
              class="connector-svg history-connector"
              width={containerWidth}
              height={rowH * 0.88}
              style="top: {historyConnectorTopY(histIdx)}px;"
              aria-hidden="true"
            >
              <defs>
                <!-- Arrow head points toward the top (upward) -->
                <marker
                  id="arrow-hist-{histIdx}"
                  markerWidth="7"
                  markerHeight="7"
                  refX="2"
                  refY="3.5"
                  orient="auto"
                >
                  <path d="M 7 1 L 0 3.5 L 7 6 Z" fill="#F5F0E6" opacity="0.5" />
                </marker>
              </defs>
              <!-- Path goes FROM bottom (this row's node) UPWARD TO the row above — arrowhead at top -->
              <path
                class="connector-path connector-history"
                d={arrowPath(
                  containerWidth / 2, rowH * 0.82,
                  containerWidth / 2, 0
                )}
                marker-end="url(#arrow-hist-{histIdx})"
              />
            </svg>

            <!-- History row: selected node centred, alts dimmed -->
            <div class="history-row" style="top: {historyNodeY(histIdx)}px;">
              <!-- Unchosen alternatives at 30% opacity -->
              {#each decision.altNodes as altNode, ai (altNode.id)}
                {@const altTotal = decision.altNodes.length}
                {@const altOffset = ai < Math.floor(altTotal / 2) ? -1 : 1}
                <div
                  class="node-slot node-slot-alt"
                  style="left: {containerWidth / 2 + altOffset * (80 * layoutScale)}px;"
                  aria-label="Not chosen: {altNode.type}"
                >
                  <div class="alt-node-wrap">
                    <MapNodeComponent node={altNode} onclick={() => {}} />
                  </div>
                </div>
              {/each}

              <!-- Selected node — full opacity, centred -->
              <div class="node-slot node-slot-selected" style="left: {containerWidth / 2}px;">
                <MapNodeComponent node={decision.selectedNode} onclick={() => {}} />
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

  </div>
</div>

<style>
  /* =========================================================
     Overlay shell
     ========================================================= */
  .dungeon-map-overlay {
    position: fixed;
    inset: 0;
    background: #080d14;
    display: flex;
    flex-direction: column;
    z-index: 200;
    overflow: hidden;
  }

  /* =========================================================
     Fixed HUD
     ========================================================= */
  .map-hud {
    flex-shrink: 0;
    z-index: 10;
    padding:
      calc(10px + var(--safe-top, 0px))
      calc(16px * var(--layout-scale, 1))
      calc(10px * var(--layout-scale, 1));
    background: linear-gradient(180deg, #080d14 60%, rgba(8, 13, 20, 0));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    pointer-events: none;
  }

  .hud-title {
    font-size: calc(20px * var(--layout-scale, 1));
    color: #f1f5f9;
    margin: 0;
    letter-spacing: 0.5px;
    text-align: center;
    text-shadow: 0 0 16px rgba(74, 158, 255, 0.4);
  }

  /* AR-243: Hide segment title in landscape — shown in top bar */
  :global([data-layout="landscape"]) .hud-title {
    display: none;
  }

  .hp-bar-container {
    width: min(calc(340px * var(--layout-scale, 1)), 88%);
    position: relative;
    pointer-events: none;
  }

  .hp-bar-bg {
    width: 100%;
    height: calc(14px * var(--layout-scale, 1));
    background: #1a2235;
    border-radius: calc(7px * var(--layout-scale, 1));
    overflow: hidden;
    border: 1px solid #2a3448;
  }

  .hp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #C0392B, #27AE60);
    border-radius: calc(7px * var(--layout-scale, 1));
    transition: width 0.3s ease;
  }

  .hp-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: calc(10px * var(--layout-scale, 1));
    color: #e6edf3;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
    white-space: nowrap;
  }

  /* =========================================================
     Scrollable area — flex column, centers choices, history below
     ========================================================= */
  .map-scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: var(--safe-bottom, calc(16px * var(--layout-scale, 1)));
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .map-scroll-container::-webkit-scrollbar {
    display: none;
  }

  /* =========================================================
     Choices center area — fills available vertical space,
     vertically and horizontally centers the choice nodes.
     ========================================================= */
  .choices-center-area {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* Subtle radial glow behind the nodes */
    background: radial-gradient(
      ellipse at 50% 50%,
      rgba(74, 158, 255, 0.07) 0%,
      transparent 65%
    );
    /* Minimum height so it doesn't collapse on very small viewports */
    min-height: calc(220px * var(--layout-scale, 1));
    gap: calc(28px * var(--layout-scale, 1));
    padding: calc(24px * var(--layout-scale, 1)) 0;
  }

  /* The row of choice nodes — flex, horizontally centered, spaced */
  .choices-nodes-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: calc(48px * var(--layout-scale, 1));
    flex-wrap: nowrap;
  }

  /* =========================================================
     Section labels
     ========================================================= */
  .section-label {
    text-align: center;
    letter-spacing: calc(1.5px * var(--layout-scale, 1));
    text-transform: uppercase;
    font-weight: 600;
    pointer-events: none;
    margin: 0;
  }

  .choices-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(245, 240, 230, 0.6);
  }

  .history-label {
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(245, 240, 230, 0.35);
    margin-bottom: calc(8px * var(--layout-scale, 1));
  }

  .no-choices-hint {
    text-align: center;
    color: rgba(245, 240, 230, 0.4);
    font-size: calc(13px * var(--text-scale, 1));
    font-style: italic;
    margin: 0;
  }

  /* =========================================================
     History section — naturally sized below choices
     ========================================================= */
  .history-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-top: 1px solid rgba(245, 240, 230, 0.07);
    padding-top: calc(16px * var(--layout-scale, 1));
    padding-bottom: calc(16px * var(--layout-scale, 1));
    flex-shrink: 0;
  }

  /* Absolute-positioned canvas for the history rows */
  .history-canvas {
    position: relative;
    flex-shrink: 0;
  }

  .history-row {
    position: absolute;
    left: 0;
    right: 0;
    transform: translateY(-50%);
  }

  /* =========================================================
     Node slots (used in history only)
     ========================================================= */
  .node-slot {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 2;
  }

  /* Dimmed alternative nodes */
  .node-slot-alt {
    opacity: 0.3;
    pointer-events: none;
    z-index: 1;
  }

  .alt-node-wrap {
    filter: grayscale(0.5);
  }

  /* Chosen history node */
  .node-slot-selected {
    opacity: 1;
    pointer-events: none;
  }

  /* =========================================================
     SVG connector overlays (history only)
     ========================================================= */
  .connector-svg {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
  }

  .history-connector {
    /* top set inline per row */
    top: unset;
  }

  :global(.connector-path) {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Active choice connectors — bright off-white dashes with soft glow */
  :global(.connector-active) {
    stroke: #F5F0E6;
    stroke-width: 1.5px;
    stroke-dasharray: 6px 5px;
    opacity: 0.85;
    filter: drop-shadow(0 0 3px rgba(245, 240, 230, 0.35));
  }

  /* History connectors — dimmer */
  :global(.connector-history) {
    stroke: #F5F0E6;
    stroke-width: 1px;
    stroke-dasharray: 5px 6px;
    opacity: 0.45;
  }

  /* =========================================================
     Reduced-motion
     ========================================================= */
  @media (prefers-reduced-motion: reduce) {
    :global(.connector-active) {
      animation: none;
    }
  }
</style>
