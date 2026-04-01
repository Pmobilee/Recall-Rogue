<script lang="ts">
  import { onMount } from 'svelte'
  import type { ActMap } from '../../services/mapGenerator'
  import MapNodeComponent from './MapNode.svelte'
  import MapAmbientParticles from './MapAmbientParticles.svelte'
  import { BASE_WIDTH } from '../../data/layout'
  import { isLandscape } from '../../stores/layoutStore'
  import { playCardAudio } from '../../services/cardAudioManager'

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

  /** Base vertical spacing between rows (unscaled px). */
  const ROW_SPACING_BASE = 90

  /**
   * Fog base colors per segment — solid fill that fills the fog overlay.
   * Chosen to match each segment's ambient palette.
   */
  const SEGMENT_FOG: Record<1 | 2 | 3 | 4, string> = {
    1: '#1a150e',  // warm brown — Shallow Depths
    2: '#0a0e14',  // cool blue-grey — Deep Caverns
    3: '#0a0c16',  // icy blue-purple — The Abyss
    4: '#0c0812',  // arcane purple — The Archive
  }

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

  const SEGMENT_BG: Record<1 | 2 | 3 | 4, string> = {
    1: 'radial-gradient(ellipse at 50% 80%, #1a150e 0%, #0d0a06 50%, #080604 100%)',  // Shallow Depths — warm brown
    2: 'radial-gradient(ellipse at 50% 70%, #141820 0%, #0a0e14 50%, #060810 100%)',  // Deep Caverns — cool blue-grey
    3: 'radial-gradient(ellipse at 50% 60%, #10121c 0%, #0a0c16 50%, #060810 100%)',  // The Abyss — icy blue-purple
    4: 'radial-gradient(ellipse at 50% 50%, #140e18 0%, #0c0812 50%, #08060e 100%)',  // The Archive — arcane purple-teal
  }
  let segmentBg = $derived(SEGMENT_BG[map.segment])

  /** Row index of the current node (or lowest available node as fallback). */
  let currentRow = $derived.by(() => {
    if (map.currentNodeId && map.nodes[map.currentNodeId]) {
      return map.nodes[map.currentNodeId].row
    }
    const available = Object.values(map.nodes).filter(n => n.state === 'available')
    if (available.length > 0) return Math.min(...available.map(n => n.row))
    return 0
  })

  /** Nodes currently selectable (state === 'available'). */
  let availableNodes = $derived(
    Object.values(map.nodes).filter(n => n.state === 'available'),
  )

  // =========================================================
  // Map canvas sizing
  // =========================================================

  let rowSpacing = $derived(ROW_SPACING_BASE * layoutScale)
  let canvasHeight = $derived(map.rows.length * rowSpacing + 2 * ROW_SPACING_BASE * layoutScale)

  // =========================================================
  // Fog of war — mask-based visibility window
  // =========================================================

  /**
   * Y center of the visibility window in px from the top of map-canvas.
   * Maps are rendered bottom-up (row 0 is at the bottom), so we invert.
   */
  let fogWindowCenterY = $derived(
    canvasHeight - (currentRow * rowSpacing + rowSpacing / 2)
  )

  /**
   * CSS mask-image inline style for the fog overlay div.
   *
   * In CSS masks: black = fully opaque (fog shows), transparent = hidden (fog invisible, map shows through).
   * The clear window is `transparent` so the map is visible there.
   * Above the window: fully fogged (future rooms hidden).
   * Below the window: light fog (visited path dimly visible).
   * All stops clamped to [0,100] to avoid non-monotonic gradient issues at map edges.
   */
  let fogMaskStyle = $derived.by(() => {
    const windowTop = fogWindowCenterY - rowSpacing * 2
    const windowBottom = fogWindowCenterY + rowSpacing * 2
    const clamp = (v: number) => Math.max(0, Math.min(100, v))
    const topPct = clamp((windowTop / canvasHeight) * 100)
    const bottomPct = clamp((windowBottom / canvasHeight) * 100)
    // Soft edges around the clear window — all monotonically increasing
    const fadeInStart = clamp(topPct - 8)
    const fadeInMid = clamp(topPct - 4)
    const fadeOutMid = clamp(bottomPct + 4)
    const fadeOutEnd = clamp(bottomPct + 8)

    const gradient = `linear-gradient(to bottom,
      black 0%,
      black ${fadeInStart}%,
      rgba(0,0,0,0.6) ${fadeInMid}%,
      transparent ${topPct}%,
      transparent ${bottomPct}%,
      rgba(0,0,0,0.4) ${fadeOutMid}%,
      rgba(0,0,0,0.5) ${fadeOutEnd}%,
      rgba(0,0,0,0.5) 100%
    )`

    return `-webkit-mask-image: ${gradient}; mask-image: ${gradient};`
  })

  // =========================================================
  // Edge data derivation
  // =========================================================

  interface EdgeData {
    x1: number
    y1: number
    x2: number
    y2: number
    state: 'traveled' | 'available' | 'locked'
    sourceRow: number
  }

  let edges = $derived.by<EdgeData[]>(() => {
    const result: EdgeData[] = []
    for (const node of Object.values(map.nodes)) {
      const nx = node.x * containerWidth
      const ny = canvasHeight - (node.row * rowSpacing + rowSpacing / 2)
      for (const childId of node.childIds) {
        const child = map.nodes[childId]
        if (!child) continue
        const cx = child.x * containerWidth
        const cy = canvasHeight - (child.row * rowSpacing + rowSpacing / 2)
        const nodeVisited = node.state === 'visited' || node.state === 'current'
        const childVisited = child.state === 'visited' || child.state === 'current'
        const childAvailable = child.state === 'available'
        let edgeState: 'traveled' | 'available' | 'locked' = 'locked'
        if (nodeVisited && childVisited) edgeState = 'traveled'
        else if (nodeVisited && childAvailable) edgeState = 'available'
        result.push({ x1: nx, y1: ny, x2: cx, y2: cy, state: edgeState, sourceRow: node.row })
      }
    }
    return result
  })

  // =========================================================
  // Row markers — floor depth labels
  // =========================================================

  interface RowMarker {
    y: number
    label: string
  }

  let rowMarkers = $derived.by<RowMarker[]>(() => {
    const markers: RowMarker[] = []
    const totalRows = map.rows.length
    // Bottom marker — entry floor
    markers.push({
      y: canvasHeight - rowSpacing * 0.1,
      label: `Floor ${map.startFloor}`,
    })
    // Boss marker near the top
    if (totalRows >= 3) {
      markers.push({
        y: canvasHeight - ((totalRows - 1) * rowSpacing + rowSpacing * 0.8),
        label: 'Boss',
      })
    }
    return markers
  })

  // =========================================================
  // SVG path helper
  // =========================================================

  /**
   * Cubic bezier path between two pixel coordinates.
   * Control points blend the X positions so curves feel more natural
   * and directional — leftward edges clearly go left, rightward go right.
   */
  function edgePath(ax: number, ay: number, bx: number, by: number): string {
    const dy = by - ay
    // Control points at ~35% and ~65% of the vertical span,
    // with X blended 25% toward the destination so curves lean into direction
    const c1x = ax + (bx - ax) * 0.25
    const c1y = ay + dy * 0.35
    const c2x = bx - (bx - ax) * 0.25
    const c2y = ay + dy * 0.65
    return `M ${ax} ${ay} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${bx} ${by}`
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

    return () => observer.disconnect()
  })

  // Auto-scroll to show current available nodes whenever they change
  $effect(() => {
    void availableNodes.length
    if (!scrollContainer) return
    requestAnimationFrame(() => {
      const availableEl = scrollContainer?.querySelector('.state-available')
      if (availableEl) {
        availableEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  })
</script>

<div class="dungeon-map-overlay" style="background: {segmentBg};" data-testid="dungeon-map">
  <!-- Fixed HUD -->
  <header class="map-hud">
    <h1 class="hud-title">{segmentName}</h1>
    <!-- HP bar removed — InRunTopBar is the canonical HP display for dungeonMap screen -->
  </header>

  <!-- Ambient particles — segment-themed floating dust/wisps -->
  <MapAmbientParticles segment={map.segment} />

  <!-- Vignette overlay — darkens edges, draws focus to center -->
  <div class="vignette-overlay" aria-hidden="true"></div>

  <!-- Scrollable map area -->
  <div class="map-scroll-container" bind:this={scrollContainer}>
    <div
      class="map-canvas"
      style="width: {containerWidth}px; height: {canvasHeight}px;"
    >
      <!-- Edge SVG layer — rendered behind nodes -->
      <svg
        class="edge-layer"
        width={containerWidth}
        height={canvasHeight}
        aria-hidden="true"
      >
        {#each edges as edge, i (i)}
          {#if edge.state === 'traveled'}
            <!-- Glow trail underneath traveled edges -->
            <path
              class="edge-path edge-traveled-glow edge-enter"
              d={edgePath(edge.x1, edge.y1, edge.x2, edge.y2)}
              style="animation-delay: {edge.sourceRow * 60 + 30}ms;"
            />
          {/if}
          <path
            class="edge-path edge-{edge.state} edge-enter"
            d={edgePath(edge.x1, edge.y1, edge.x2, edge.y2)}
            style="animation-delay: {edge.sourceRow * 60 + 30}ms;"
          />
        {/each}
      </svg>

      <!-- Node layer — positioned absolutely over the SVG -->
      {#each Object.values(map.nodes) as node (node.id)}
        {@const nx = node.x * containerWidth}
        {@const ny = canvasHeight - (node.row * rowSpacing + rowSpacing / 2)}
        <div
          class="node-position node-entrance"
          style="left: {nx}px; top: {ny}px; animation-delay: {node.row * 60}ms;"
        >
          <MapNodeComponent
            {node}
            onclick={() => node.state === 'available' && onNodeSelect(node.id)}
          />
        </div>
      {/each}

      <!-- Fog of war overlay — ABOVE nodes so CSS mask actually hides far-away nodes.
           pointer-events: none ensures clicks pass through to available nodes below.
           The mask window around the current floor keeps current/next-row nodes visible. -->
      <div
        class="fog-overlay"
        style="height: {canvasHeight}px; {fogMaskStyle}"
        aria-hidden="true"
      >
        <div class="fog-base" style="background: {SEGMENT_FOG[map.segment]};"></div>
        <div class="fog-wisp fog-wisp-1"></div>
        <div class="fog-wisp fog-wisp-2"></div>
        <div class="fog-wisp fog-wisp-3"></div>
      </div>

      <!-- Floor depth markers — subtle row labels -->
      {#each rowMarkers as marker}
        <div class="row-marker" style="top: {marker.y}px;">
          <span class="row-marker-line"></span>
          <span class="row-marker-label">{marker.label}</span>
          <span class="row-marker-line"></span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  /* =========================================================
     Overlay shell
     ========================================================= */
  .dungeon-map-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    z-index: 200;
    overflow: hidden;
  }

  .vignette-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0, 0, 0, 0.55) 100%);
    pointer-events: none;
    z-index: 4;
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
    font-size: calc(20px * var(--text-scale, 1));
    color: #f1f5f9;
    margin: 0;
    letter-spacing: 0.5px;
    text-align: center;
    text-shadow: 0 0 calc(16px * var(--layout-scale, 1)) rgba(74, 158, 255, 0.4);
  }

  /* AR-243: Hide segment title in landscape — shown in top bar */
  :global([data-layout="landscape"]) .hud-title {
    display: none;
  }

  /* =========================================================
     Scrollable map container
     ========================================================= */
  .map-scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: calc(16px * var(--layout-scale, 1));
    padding-bottom: max(var(--safe-bottom, 0px), calc(16px * var(--layout-scale, 1)));
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .map-scroll-container::-webkit-scrollbar {
    display: none;
  }

  /* =========================================================
     Map canvas — absolute-positioned container for nodes + SVG
     ========================================================= */
  .map-canvas {
    position: relative;
    margin: 0 auto;
    flex-shrink: 0;
  }

  /* =========================================================
     SVG edge layer
     ========================================================= */
  .edge-layer {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 1;
  }

  /* Base path style applied to all edges */
  :global(.edge-path) {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Glow trail — wide blurred duplicate rendered beneath traveled edges */
  :global(.edge-traveled-glow) {
    stroke: #F5F0E6;
    stroke-width: 6px;
    opacity: 0.08;
    filter: blur(3px);
  }

  /* Traveled edges — solid bright line (both endpoints visited/current) */
  :global(.edge-traveled) {
    stroke: #F5F0E6;
    stroke-width: 2.5px;
    opacity: 0.85;
    filter: drop-shadow(0 0 calc(3px * var(--layout-scale, 1)) rgba(245, 240, 230, 0.3));
  }

  /* Available edges — animated marching dashes (parent visited, child available) */
  :global(.edge-available) {
    stroke: #F5F0E6;
    stroke-width: 2px;
    stroke-dasharray: 6 4;
    opacity: 0.8;
    filter: drop-shadow(0 0 calc(4px * var(--layout-scale, 1)) rgba(245, 240, 230, 0.4));
    animation: marchingAnts 0.8s linear infinite;
  }

  /* Locked edges — thin dim dotted lines */
  :global(.edge-locked) {
    stroke: rgba(245, 240, 230, 0.12);
    stroke-width: 1px;
    stroke-dasharray: 3 5;
  }

  @keyframes marchingAnts {
    to {
      stroke-dashoffset: -10;
    }
  }

  /* =========================================================
     Fog of war overlay
     Sits at z-index 3, above nodes (z-index 2) and edges (z-index 1).
     Uses CSS mask-image to punch a clear window around the current floor
     while covering everything else with animated fog.
     pointer-events: none ensures clicks pass through to available nodes.
     ========================================================= */
  .fog-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 3;
    pointer-events: none;
    overflow: hidden;
    transition: mask-image 0.6s ease-in-out, -webkit-mask-image 0.6s ease-in-out;
  }

  .fog-base {
    position: absolute;
    inset: 0;
    opacity: 0.95;
  }

  .fog-wisp {
    position: absolute;
    inset: 0;
    background-size: 200% 200%;
  }

  .fog-wisp-1 {
    background: radial-gradient(ellipse 80% 40% at 30% 40%, rgba(255,255,255,0.07) 0%, transparent 60%);
    animation: fogDrift1 25s ease-in-out infinite;
  }

  .fog-wisp-2 {
    background: radial-gradient(ellipse 60% 50% at 70% 60%, rgba(255,255,255,0.05) 0%, transparent 55%);
    animation: fogDrift2 35s ease-in-out infinite reverse;
  }

  .fog-wisp-3 {
    background: radial-gradient(ellipse 70% 35% at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 50%);
    animation: fogDrift3 20s ease-in-out infinite;
  }

  @keyframes fogDrift1 {
    0%, 100% { background-position: 0% 0%; opacity: 0.5; }
    50% { background-position: 100% 80%; opacity: 0.8; }
  }

  @keyframes fogDrift2 {
    0%, 100% { background-position: 100% 100%; opacity: 0.4; }
    50% { background-position: 0% 20%; opacity: 0.7; }
  }

  @keyframes fogDrift3 {
    0%, 100% { background-position: 50% 0%; opacity: 0.6; }
    33% { background-position: 0% 100%; opacity: 0.3; }
    66% { background-position: 100% 50%; opacity: 0.8; }
  }

  /* =========================================================
     Node positioning wrapper
     z-index 2 — below fog overlay (z-index 3), above edges (z-index 1).
     Nodes in the fog window are revealed by the mask; others are hidden.
     ========================================================= */
  .node-position {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 2;
  }

  /* =========================================================
     Node entrance animation — row-by-row reveal from bottom
     ========================================================= */
  .node-entrance {
    animation: nodeEnter 0.4s ease-out both;
  }

  @keyframes nodeEnter {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) translateY(calc(12px * var(--layout-scale, 1)));
    }
    to {
      transform: translate(-50%, -50%) translateY(0);
    }
  }

  /* =========================================================
     Edge entrance animation
     ========================================================= */
  :global(.edge-enter) {
    animation: edgeEnter 0.3s ease-out both;
  }

  @keyframes edgeEnter {
    from {
      opacity: 0;
    }
  }

  /* =========================================================
     Floor depth markers
     ========================================================= */
  .row-marker {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: 0 calc(40px * var(--layout-scale, 1));
    pointer-events: none;
    z-index: 0;
  }

  .row-marker-line {
    flex: 1;
    height: 1px;
    background: rgba(245, 240, 230, 0.06);
  }

  .row-marker-label {
    font-size: calc(9px * var(--text-scale, 1));
    color: rgba(245, 240, 230, 0.2);
    text-transform: uppercase;
    letter-spacing: calc(2px * var(--layout-scale, 1));
    font-weight: 600;
    white-space: nowrap;
  }

  /* =========================================================
     Reduced-motion
     ========================================================= */
  @media (prefers-reduced-motion: reduce) {
    .node-entrance {
      animation: none;
    }
    :global(.edge-available) {
      animation: none;
    }
    :global(.edge-enter) {
      animation: none;
    }
    .fog-wisp {
      animation: none;
    }
    .fog-overlay {
      transition: none;
    }
  }
</style>
