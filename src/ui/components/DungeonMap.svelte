<script module lang="ts">
  /** Set of map seeds that have already played the cinematic scroll.
   *  Module-level so it persists across component remounts (e.g., returning from a room). */
  const cinematicPlayedForSeed = new Set<number>()
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import type { ActMap, MapNode } from '../../services/mapGenerator'
  import MapNodeComponent from './MapNode.svelte'
  import { BASE_WIDTH } from '../../data/layout'

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

  /**
   * Read the CSS `--layout-scale` custom property set on :root by the
   * responsive layout system. Falls back to 1 during SSR or if the
   * property is not yet set.
   */
  function getLayoutScale(): number {
    if (typeof window === 'undefined') return 1
    const val = getComputedStyle(document.documentElement).getPropertyValue('--layout-scale')
    return parseFloat(val) || 1
  }

  // =========================================================
  // Constants (base values — designed for BASE_WIDTH = 390px)
  // =========================================================

  const SEGMENT_NAMES: Record<1 | 2 | 3 | 4, string> = {
    1: 'Shallow Depths',
    2: 'Deep Caverns',
    3: 'The Abyss',
    4: 'The Archive',
  }

  /** Total height of the scrollable map canvas in pixels (base, unscaled). */
  const BASE_MAP_HEIGHT = 1350
  /** Horizontal padding so edge nodes don't clip (base, unscaled). */
  const BASE_H_PADDING = 28
  /** Vertical padding so the top/bottom nodes don't clip the canvas edges (base, unscaled). */
  const BASE_V_PADDING = 44
  /** Max container width for tablet/desktop — keep it mobile-feeling. */
  const MAX_WIDTH = 500

  // =========================================================
  // Reactive state
  // =========================================================

  let scrollContainer = $state<HTMLDivElement | undefined>(undefined)
  let containerWidth  = $state(Math.min(typeof window !== 'undefined' ? window.innerWidth : BASE_WIDTH, MAX_WIDTH))

  /** Current layout scale factor, read once on mount and updated on resize. */
  let layoutScale = $state(1)


  /** Scaled map constants derived from layoutScale. */
  let TOTAL_MAP_HEIGHT = $derived(BASE_MAP_HEIGHT * layoutScale)
  let H_PADDING = $derived(BASE_H_PADDING * layoutScale)
  let V_PADDING = $derived(BASE_V_PADDING * layoutScale)

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

  /** Y pixel position of the lowest available node — used to place the scroll marker. */
  let lowestAvailablePy = $derived.by<number | null>(() => {
    const available = allNodes.filter(n => n.state === 'available' || n.state === 'current')
    if (available.length === 0) return null
    return Math.max(...available.map(n => nodePixelPos(n).py))
  })

  /** Reference to the map-canvas element for direct transform manipulation. */
  let mapCanvas = $state<HTMLDivElement | undefined>(undefined)

  $effect(() => {
    const container = scrollContainer
    const targetPy = lowestAvailablePy
    if (!container || targetPy === null) return

    const mapSeed = map.seed
    if (!cinematicPlayedForSeed.has(mapSeed)) {
      cinematicPlayedForSeed.add(mapSeed)
      // Cinematic only on first view of a new floor (start of run + after boss)
      requestAnimationFrame(() => {
        playCinematic(container, targetPy)
      })
    } else if (availableMarker) {
      // Returning from a room: just jump to current position (no animation)
      availableMarker.scrollIntoView({ behavior: 'instant', block: 'center' })
    }
  })

  /**
   * 3-phase cinematic using direct DOM manipulation (avoids Svelte reactivity loops):
   *   Phase 1 (0–900ms):    Zoomed 1.5x on boss at top, subtle breathe
   *   Phase 2 (900–2000ms): Zoom out 1.5x → 1.0x
   *   Phase 3 (2000–3500ms): Scroll down to player's available nodes
   */
  function playCinematic(container: HTMLDivElement, targetPy: number) {
    if (!mapCanvas) return
    const canvas = mapCanvas as HTMLDivElement

    const viewportH = container.clientHeight
    const anchorOffset = 120 * layoutScale
    // Maximum scroll: bottom of the map canvas (where starting nodes are)
    const maxScroll = container.scrollHeight - viewportH

    // Find the boss node's pixel Y to set transform-origin precisely
    const bossNode = allNodes.find(n => n.type === 'boss')
    const bossY = bossNode ? nodePixelPos(bossNode).py : V_PADDING

    const PHASE1_END = 900
    const PHASE2_END = 2000
    const PHASE3_END = 3800
    const ZOOM_START = 1.5
    const ZOOM_END = 1.0

    // Set initial state immediately via DOM (not reactive state)
    canvas.style.transform = `scale(${ZOOM_START})`
    canvas.style.transformOrigin = `50% ${bossY}px`
    container.scrollTop = 0

    let startTime: number | null = null

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3)
    }

    function easeInOutCubic(t: number): number {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime

      if (elapsed < PHASE1_END) {
        // Phase 1: Hold zoomed on boss with subtle breathe
        const breathe = Math.sin((elapsed / PHASE1_END) * Math.PI) * 0.03
        canvas.style.transform = `scale(${ZOOM_START + breathe})`
        container.scrollTop = 0
      } else if (elapsed < PHASE2_END) {
        // Phase 2: Zoom out to normal
        const p = (elapsed - PHASE1_END) / (PHASE2_END - PHASE1_END)
        const eased = easeOutCubic(p)
        const zoom = ZOOM_START + (ZOOM_END - ZOOM_START) * eased
        canvas.style.transform = `scale(${zoom})`
        // Gradually shift transform-origin from boss to top-center
        const originY = bossY * (1 - eased)
        canvas.style.transformOrigin = `50% ${originY}px`
        container.scrollTop = 0
      } else if (elapsed < PHASE3_END) {
        // Phase 3: Scroll all the way down to the bottom of the map
        canvas.style.transform = 'scale(1)'
        canvas.style.transformOrigin = '50% 0%'
        const p = (elapsed - PHASE2_END) / (PHASE3_END - PHASE2_END)
        const eased = easeInOutCubic(p)
        container.scrollTop = maxScroll * eased
      } else {
        // Done — stay at the bottom where the starting nodes are
        canvas.style.transform = ''
        canvas.style.transformOrigin = ''
        container.scrollTop = maxScroll
        return
      }

      requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }

  // =========================================================
  // Container width tracking
  // =========================================================

  onMount(() => {
    // Capture initial layout scale
    layoutScale = getLayoutScale()

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth = Math.min(entry.contentRect.width, MAX_WIDTH)
        // Re-read scale whenever the container resizes (viewport change)
        layoutScale = getLayoutScale()
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
    <div class="map-canvas" bind:this={mapCanvas} style="height: {TOTAL_MAP_HEIGHT}px; width: {containerWidth}px;">
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
    gap: calc(8px * var(--layout-scale, 1));
    pointer-events: none; /* allow touch-through to map */
  }

  .hud-title {
    font-size: calc(20px * var(--layout-scale, 1));
    color: #f1f5f9;
    margin: 0;
    letter-spacing: 0.5px;
    text-align: center;
    text-shadow: 0 0 16px rgba(74, 158, 255, 0.4);
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
    /* Hide scrollbar — map scrolls via touch/cinematic only */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .map-scroll-container::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  /* =========================================================
     Map canvas — the coordinate space for nodes and SVG paths
     ========================================================= */
  .map-canvas {
    position: relative;
    /* width set inline via containerWidth */
    background: radial-gradient(ellipse at 50% 0%, rgba(20, 40, 80, 0.3) 0%, transparent 70%);
    flex-shrink: 0;
    will-change: transform;
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
    transform: translateY(calc(-120px * var(--layout-scale, 1)));
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
