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

  /** HP percentage 0–100. */
  let hpPercent = $derived(playerMaxHp > 0 ? Math.round((playerHp / playerMaxHp) * 100) : 0)

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
  // Edge data derivation
  // =========================================================

  interface EdgeData {
    x1: number
    y1: number
    x2: number
    y2: number
    state: 'traveled' | 'available' | 'locked'
    fogOpacity: number
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
        const nodeDist = Math.abs(node.row - currentRow)
        const childDist = Math.abs(child.row - currentRow)
        const maxDist = Math.max(nodeDist, childDist)
        const fogOpacity = maxDist <= 1 ? 1 : maxDist <= 3 ? 0.7 : 0.4
        result.push({ x1: nx, y1: ny, x2: cx, y2: cy, state: edgeState, fogOpacity, sourceRow: node.row })
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

    <div class="hp-bar-container" aria-label="Health: {playerHp} of {playerMaxHp}">
      <div class="hp-bar-bg" role="progressbar" aria-valuenow={hpPercent} aria-valuemin={0} aria-valuemax={100}>
        <div class="hp-bar-fill" style="width: {hpPercent}%"></div>
      </div>
      <span class="hp-text" aria-hidden="true">{playerHp} / {playerMaxHp}</span>
    </div>
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
              opacity={edge.fogOpacity}
              style="animation-delay: {edge.sourceRow * 60 + 30}ms;"
            />
          {/if}
          <path
            class="edge-path edge-{edge.state} edge-enter"
            d={edgePath(edge.x1, edge.y1, edge.x2, edge.y2)}
            opacity={edge.fogOpacity}
            style="animation-delay: {edge.sourceRow * 60 + 30}ms;"
          />
        {/each}
      </svg>

      <!-- Node layer — positioned absolutely over the SVG -->
      {#each Object.values(map.nodes) as node (node.id)}
        {@const nx = node.x * containerWidth}
        {@const ny = canvasHeight - (node.row * rowSpacing + rowSpacing / 2)}
        {@const rowDist = Math.abs(node.row - currentRow)}
        {@const fogOpacity = rowDist <= 1 ? 1 : rowDist <= 3 ? 0.7 : 0.45}
        {@const fogBlur = rowDist <= 1 ? 0 : rowDist <= 3 ? 0.5 : 1}
        <div
          class="node-position node-entrance"
          style="left: {nx}px; top: {ny}px; opacity: {fogOpacity}; filter: blur({fogBlur}px); animation-delay: {node.row * 60}ms;"
        >
          <MapNodeComponent
            {node}
            onclick={() => node.state === 'available' && onNodeSelect(node.id)}
          />
        </div>
      {/each}

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
    z-index: 3;
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
    font-size: calc(10px * var(--text-scale, 1));
    color: #e6edf3;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
    white-space: nowrap;
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
     Node positioning wrapper
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
  }
</style>
