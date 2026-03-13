<script lang="ts">
  import { onMount } from 'svelte'
  import type { ActMap, MapNode } from '../../services/mapGenerator'
  import MapNodeComponent from './MapNode.svelte'

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
  // Constants
  // =========================================================

  const SEGMENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
    1: 'Shallow Depths',
    2: 'Deep Caverns',
    3: 'The Abyss',
    4: 'The Archive',
  }

  /** Total height of the scrollable map canvas in pixels. */
  const TOTAL_MAP_HEIGHT = 1350
  /** Horizontal padding so edge nodes don't clip. */
  const H_PADDING = 28
  /** Vertical padding so the top/bottom nodes don't clip the canvas edges. */
  const V_PADDING = 44
  /** Max container width for tablet/desktop — keep it mobile-feeling. */
  const MAX_WIDTH = 500

  // =========================================================
  // Reactive state
  // =========================================================

  let scrollContainer = $state<HTMLDivElement | undefined>(undefined)
  let containerWidth  = $state(Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, MAX_WIDTH))

  /** Segment name derived from act segment number. */
  let segmentName = $derived(SEGMENT_NAMES[map.segment])

  /** HP percentage 0–100. */
  let hpPercent = $derived(playerMaxHp > 0 ? Math.round((playerHp / playerMaxHp) * 100) : 0)

  /** Flat list of all nodes for rendering. */
  let allNodes = $derived(Object.values(map.nodes))

  // =========================================================
  // Edge derivation
  // =========================================================

  interface Edge {
    id: string
    parentNode: MapNode
    childNode: MapNode
  }

  /** All unique parent→child edges across the entire map. */
  let allEdges = $derived.by<Edge[]>(() => {
    const edges: Edge[] = []
    const seen = new Set<string>()
    for (const node of allNodes) {
      for (const childId of node.childIds) {
        const key = `${node.id}--${childId}`
        if (seen.has(key)) continue
        seen.add(key)
        const child = map.nodes[childId]
        if (child) edges.push({ id: key, parentNode: node, childNode: child })
      }
    }
    return edges
  })

  // =========================================================
  // Coordinate helpers
  // =========================================================

  /**
   * Convert a node's normalised (x, y) — where y=0 is bottom, y=1 is top —
   * to pixel coordinates in the scroll canvas.
   *
   * Display: boss (y=1) at the TOP of the canvas, start (y=0) at the BOTTOM.
   */
  function nodePixelPos(node: MapNode): { px: number; py: number } {
    const usableW = containerWidth - H_PADDING * 2
    const usableH = TOTAL_MAP_HEIGHT - V_PADDING * 2
    const px = H_PADDING + node.x * usableW
    // Invert Y: y=1 (boss/top) → small py (near canvas top)
    const py = V_PADDING + (1 - node.y) * usableH
    return { px, py }
  }

  /**
   * Build a cubic-bezier SVG path string from parent to child pixel coords.
   * The control points push upward (toward smaller py = top of canvas) to
   * produce a natural-looking arc.
   */
  function bezierPath(px1: number, py1: number, px2: number, py2: number): string {
    const midY = (py1 + py2) / 2
    return `M ${px1} ${py1} C ${px1} ${midY}, ${px2} ${midY}, ${px2} ${py2}`
  }

  // =========================================================
  // Edge visual state helpers
  // =========================================================

  function edgeClass(edge: Edge): string {
    const { parentNode, childNode } = edge
    const bothVisited =
      (parentNode.state === 'visited' || parentNode.state === 'current') &&
      (childNode.state === 'visited' || childNode.state === 'current')
    const oneAvailable =
      childNode.state === 'available' ||
      parentNode.state === 'available'
    if (bothVisited) return 'edge-visited'
    if (oneAvailable) return 'edge-active'
    return 'edge-locked'
  }

  // =========================================================
  // Auto-scroll to lowest available row on mount
  // =========================================================

  let availableMarker = $state<HTMLDivElement | undefined>(undefined)

  $effect(() => {
    // Run after the DOM is ready whenever the marker reference changes.
    if (availableMarker) {
      availableMarker.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })

  /** Y pixel position of the lowest available node — used to place the scroll marker. */
  let lowestAvailablePy = $derived.by<number | null>(() => {
    const available = allNodes.filter(n => n.state === 'available' || n.state === 'current')
    if (available.length === 0) return null
    // Lowest available = largest py (nearest to the bottom of the canvas)
    return Math.max(...available.map(n => nodePixelPos(n).py))
  })

  // =========================================================
  // Container width tracking
  // =========================================================

  onMount(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth = Math.min(entry.contentRect.width, MAX_WIDTH)
      }
    })
    if (scrollContainer) observer.observe(scrollContainer)
    return () => observer.disconnect()
  })
</script>

<div class="dungeon-map-overlay" data-testid="dungeon-map">
  <!-- Fixed HUD — stays visible while map scrolls -->
  <header class="map-hud">
    <h1 class="hud-title">{segmentName}</h1>

    <div class="hp-bar-container" aria-label="Health: {playerHp} of {playerMaxHp}">
      <div class="hp-bar-bg" role="progressbar" aria-valuenow={hpPercent} aria-valuemin={0} aria-valuemax={100}>
        <div class="hp-bar-fill" style="width: {hpPercent}%"></div>
      </div>
      <span class="hp-text" aria-hidden="true">{playerHp} / {playerMaxHp}</span>
    </div>
  </header>

  <!-- Scrollable map area -->
  <div
    class="map-scroll-container"
    bind:this={scrollContainer}
  >
    <div class="map-canvas" style="height: {TOTAL_MAP_HEIGHT}px; width: {containerWidth}px;">
      <!-- SVG layer — paths between nodes (pointer-events: none so it doesn't block scrolling) -->
      <svg
        class="map-paths"
        viewBox="0 0 {containerWidth} {TOTAL_MAP_HEIGHT}"
        width={containerWidth}
        height={TOTAL_MAP_HEIGHT}
        aria-hidden="true"
      >
        {#each allEdges as edge (edge.id)}
          {@const { px: px1, py: py1 } = nodePixelPos(edge.parentNode)}
          {@const { px: px2, py: py2 } = nodePixelPos(edge.childNode)}
          <path
            class="map-edge {edgeClass(edge)}"
            d={bezierPath(px1, py1, px2, py2)}
          />
        {/each}
      </svg>

      <!-- Invisible scroll anchor placed at the lowest available node row -->
      {#if lowestAvailablePy !== null}
        <div
          bind:this={availableMarker}
          class="available-scroll-anchor"
          style="top: {lowestAvailablePy}px;"
          aria-hidden="true"
        ></div>
      {/if}

      <!-- Node layer — absolutely positioned HTML buttons -->
      {#each allNodes as node (node.id)}
        {@const { px, py } = nodePixelPos(node)}
        <div
          class="node-wrapper"
          style="left: {px}px; top: {py}px;"
        >
          <MapNodeComponent
            {node}
            onclick={() => onNodeSelect(node.id)}
          />
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
    position: sticky;
    top: 0;
    z-index: 10;
    padding: calc(10px + var(--safe-top, 0px)) 16px 10px;
    background: linear-gradient(180deg, #080d14 60%, rgba(8, 13, 20, 0));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none; /* allow touch-through to map */
  }

  .hud-title {
    font-size: 20px;
    color: #f1f5f9;
    margin: 0;
    letter-spacing: 0.5px;
    text-align: center;
    text-shadow: 0 0 16px rgba(74, 158, 255, 0.4);
  }

  .hp-bar-container {
    width: min(340px, 88%);
    position: relative;
    pointer-events: none;
  }

  .hp-bar-bg {
    width: 100%;
    height: 14px;
    background: #1a2235;
    border-radius: 7px;
    overflow: hidden;
    border: 1px solid #2a3448;
  }

  .hp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #C0392B, #27AE60);
    border-radius: 7px;
    transition: width 0.3s ease;
  }

  .hp-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
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
    /* Centre the canvas for wider screens */
    display: flex;
    justify-content: center;
    /* Bottom safe-area padding so nodes are never hidden behind nav bars */
    padding-bottom: var(--safe-bottom, 16px);
  }

  /* =========================================================
     Map canvas — the coordinate space for nodes and SVG paths
     ========================================================= */
  .map-canvas {
    position: relative;
    /* width set inline via containerWidth */
    background: radial-gradient(ellipse at 50% 0%, rgba(20, 40, 80, 0.3) 0%, transparent 70%);
    flex-shrink: 0;
  }

  /* =========================================================
     SVG path layer
     ========================================================= */
  .map-paths {
    position: absolute;
    inset: 0;
    /* Critical: allow touch/pointer events to pass through to nodes and scroll */
    pointer-events: none;
  }

  :global(.map-edge) {
    fill: none;
    stroke-linecap: round;
  }

  :global(.edge-visited) {
    stroke: #4a9eff;
    stroke-width: 2;
    opacity: 0.9;
  }

  :global(.edge-active) {
    stroke: #4a9eff;
    stroke-width: 2;
    opacity: 0.6;
    animation: edgePulse 2s ease-in-out infinite;
  }

  :global(.edge-locked) {
    stroke: #2a3448;
    stroke-width: 1;
    stroke-dasharray: 4 5;
    opacity: 0.5;
  }

  @keyframes edgePulse {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 0.75; }
  }

  /* =========================================================
     Node wrapper — centres the 44px button on its coordinate
     ========================================================= */
  .node-wrapper {
    position: absolute;
    /* Shift by half the node size so the centre aligns with the coordinate */
    transform: translate(-50%, -50%);
    z-index: 2;
  }

  /* =========================================================
     Invisible scroll anchor element
     ========================================================= */
  .available-scroll-anchor {
    position: absolute;
    left: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
    /* Offset upward slightly so the available row sits near the middle of
       the viewport rather than exactly at the centre edge. */
    transform: translateY(-120px);
  }

  /* =========================================================
     Reduced-motion overrides
     ========================================================= */
  @media (prefers-reduced-motion: reduce) {
    :global(.edge-active) {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
