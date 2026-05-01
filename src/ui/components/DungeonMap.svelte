<script lang="ts">
  import { onMount } from 'svelte'
  import type { ActMap } from '../../services/mapGenerator'
  import MapNodeComponent from './MapNode.svelte'
  import MapAmbientParticles from './MapAmbientParticles.svelte'
  import BossPreviewBanner from './BossPreviewBanner.svelte'
  import { BASE_WIDTH } from '../../data/layout'
  import { isLandscape } from '../../stores/layoutStore'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { ambientAudio } from '../../services/ambientAudioService'
  import { ENEMY_TEMPLATES } from '../../data/enemies'
  import { MAP_CONFIG } from '../../data/balance'

  // =========================================================
  // Props
  // =========================================================

  /** Multiplayer pick indicator: who has tentatively picked which node. */
  export interface NodePickIndicator {
    playerId: string
    initial: string
    color: string
  }

  interface Props {
    map: ActMap
    playerHp: number
    playerMaxHp: number
    onNodeSelect: (nodeId: string) => void
    /** Optional map of nodeId → list of players who've picked it (multiplayer). */
    nodePicks?: Record<string, NodePickIndicator[]>
  }

  let { map, playerHp, playerMaxHp, onNodeSelect, nodePicks = {} }: Props = $props()

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

  // Fog wisps — large soft cloud shapes that drift visibly across the map.
  // Sized for 1920×1080. Fewer wisps but each is a real cloud, not a dust particle.
  const fogWisps = (() => {
    const wisps: Array<{ size: number; ratio: number; x: number; y: number; opacity: number; dur: number; delay: number; dx: number; dy: number }> = []
    let seed = 42
    const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646 }
    /** Random value centered on 0 with given magnitude */
    const drift = (mag: number) => (rng() - 0.5) * 2 * mag

    // Medium clouds (300-500px) — 8 of them
    for (let i = 0; i < 8; i++) {
      wisps.push({
        size: 300 + rng() * 200,
        ratio: 0.3 + rng() * 0.2,
        x: rng() * 100 - 10,
        y: rng() * 80,
        opacity: 0.12 + rng() * 0.10,
        dur: 15 + rng() * 10,
        delay: rng() * 20,
        dx: drift(350),
        dy: drift(150),
      })
    }
    // Large clouds (550-800px) — 6 of them
    for (let i = 0; i < 6; i++) {
      wisps.push({
        size: 550 + rng() * 250,
        ratio: 0.3 + rng() * 0.2,
        x: rng() * 90 - 5,
        y: rng() * 75 + 2,
        opacity: 0.08 + rng() * 0.08,
        dur: 20 + rng() * 15,
        delay: rng() * 25,
        dx: drift(450),
        dy: drift(200),
      })
    }
    // Huge backdrop clouds (900-1200px) — 3 of them, very subtle
    for (let i = 0; i < 3; i++) {
      wisps.push({
        size: 900 + rng() * 300,
        ratio: 0.3 + rng() * 0.15,
        x: rng() * 80,
        y: rng() * 65 + 5,
        opacity: 0.05 + rng() * 0.05,
        dur: 30 + rng() * 20,
        delay: rng() * 30,
        dx: drift(300),
        dy: drift(120),
      })
    }
    return wisps
  })()

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
  // Boss preview banner data
  // BATCH-2026-04-11-ULTRA Cluster A: floor 4→6 and floor 17→18 cliffs.
  // Show the boss preview when the player is within 3 rows of BOSS_ROW — i.e.
  // they can see the boss node through the fog-of-war blur. Mirrors StS's
  // persistent boss icon at the top of the act map.
  // =========================================================

  /** The boss node for this act (always at MAP_CONFIG.BOSS_ROW). */
  let bossNode = $derived.by(() => {
    const bossRowIds = map.rows[MAP_CONFIG.BOSS_ROW] ?? []
    for (const id of bossRowIds) {
      const node = map.nodes[id]
      if (node && node.type === 'boss') return node
    }
    return null
  })

  /** EnemyTemplate for the boss node, used to render the banner. */
  let bossTemplate = $derived.by(() => {
    if (!bossNode?.enemyId) return null
    return ENEMY_TEMPLATES.find(t => t.id === bossNode!.enemyId) ?? null
  })

  /**
   * Boss floor number for display: startFloor + 5 (boss is always at the 6th
   * floor of each segment — floors 6, 12, 18, 24 for segments 1–4).
   */
  let bossFloor = $derived(map.startFloor + 5)

  /**
   * Show the boss preview banner whenever the act has an undefeated boss node.
   * Mirrors Slay the Spire's always-visible boss icon at the top of the act map
   * so the player can plan around it from the moment they open the map.
   * Hidden only after the boss has been defeated (state === 'visited').
   * The boss must not yet be defeated (state !== 'visited').
   */
  let showBossPreview = $derived.by(() => {
    if (!bossNode || !bossTemplate) return false
    if (bossNode.state === 'visited') return false
    return true
  })

  // =========================================================
  // Map canvas sizing
  // =========================================================

  let rowSpacing = $derived(ROW_SPACING_BASE * layoutScale)
  let canvasHeight = $derived(map.rows.length * rowSpacing + 2 * ROW_SPACING_BASE * layoutScale)

  // =========================================================
  // Fog of war — blur-based visibility
  // =========================================================
  // Icons themselves get heavily blurred beyond the visible window.
  // Scattered fog wisps add atmosphere on top — no opaque base needed.

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
    fogOpacity: number
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
        // Hide edges far from current row
        const maxDist = Math.max(Math.abs(node.row - currentRow), Math.abs(child.row - currentRow))
        const fogOpacity = maxDist <= 1 ? 1 : maxDist <= 2 ? 0.4 : maxDist <= 3 ? 0.15 : 0.05
        result.push({ x1: nx, y1: ny, x2: cx, y2: cy, state: edgeState, sourceRow: node.row, fogOpacity })
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
  // Scroll helper — instant, retry-with-backoff + in-viewport verification
  // =========================================================

  /**
   * Synchronously scroll the map container so the lowest available node
   * is centered in the viewport. Returns true when the node is confirmed
   * in-viewport after scrolling; returns false if not yet achievable.
   *
   * Why getBoundingClientRect instead of offsetTop walk?
   * - The offsetParent walk misses accumulated scroll/transform offsets
   *   on Phaser-scene-transition entry (container has translateY mid-animation).
   * - getBoundingClientRect gives the actual rendered position regardless of
   *   nested transforms, at the cost of forcing a layout reflow — acceptable
   *   here because we're already deciding to scroll.
   *
   * Why not scrollIntoView with behavior:'smooth'?
   * - smooth scroll is unreliable in headless Chromium / SwiftShader
   * - it races with layout; the retry loop verifies the result and retries on miss
   * - it produces no feedback on completion
   *
   * Strategy:
   * 1. Find the first `.state-available` element.
   * 2. Compute its center using getBoundingClientRect relative to scroll container.
   * 3. Set scrollTop directly (instant), clamped to valid range.
   * 4. Verify the node is now within [0, window.innerHeight] via getBoundingClientRect.
   *    If NOT in viewport (scroll was clamped by in-progress layout), return false.
   * 5. If element not found OR not in viewport, caller retries from the schedule.
   *
   * The retry schedule [0,50,100,200,350,500,750,1000,1500,2000] covers ~5s total.
   * This handles Phaser scene transitions tearing layout during initial load.
   */
  function scrollToAvailableNodes(container: HTMLDivElement): boolean {
    const availableEl = container.querySelector<HTMLElement>('.state-available')

    if (!availableEl) {
      // Node not in DOM yet — signal to caller that retry is needed
      return false
    }

    // Use getBoundingClientRect for reliable position regardless of nested transforms.
    // This avoids the offsetParent walk pitfall on Phaser scene entry transitions.
    const containerRect = container.getBoundingClientRect()
    const nodeRect = availableEl.getBoundingClientRect()

    // Convert node top to scroll-space coordinates
    const nodeTopInScrollSpace = (nodeRect.top - containerRect.top) + container.scrollTop
    const centerTarget = nodeTopInScrollSpace + nodeRect.height / 2 - container.clientHeight / 2
    const maxScroll = container.scrollHeight - container.clientHeight
    const targetScroll = Math.max(0, Math.min(centerTarget, maxScroll))

    container.scrollTop = targetScroll

    // Verify the node is actually in viewport after scrolling.
    // If layout was still settling, the scroll may have been clamped — return false to retry.
    const verifyRect = availableEl.getBoundingClientRect()
    const inViewport = verifyRect.top >= 0 && verifyRect.bottom <= window.innerHeight

    return inViewport
  }

  /**
   * Fire scrollToAvailableNodes on a retry schedule.
   * Bails early on success; exhausts the full schedule (~5s) before giving up.
   * Prevents concurrent retry chains with a generation counter.
   */
  let _scrollGeneration = 0

  function scheduleScrollRetry(container: HTMLDivElement): void {
    const RETRY_DELAYS = [0, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000]
    const generation = ++_scrollGeneration

    function attempt(idx: number): void {
      // A newer scheduleScrollRetry call supersedes this chain
      if (generation !== _scrollGeneration) return

      const success = scrollToAvailableNodes(container)
      if (success) return

      if (idx < RETRY_DELAYS.length - 1) {
        setTimeout(() => attempt(idx + 1), RETRY_DELAYS[idx + 1])
      }
    }

    attempt(0)
  }

  // =========================================================
  // Mount + resize tracking + MutationObserver + ResizeObserver scroll trigger
  // =========================================================

  onMount(() => {
    playCardAudio('map-open')
    void ambientAudio.setContext('dungeon_map')
    layoutScale = getLayoutScale()

    // ResizeObserver — tracks container size changes for containerWidth/layoutScale.
    // Also fires scrollToAvailableNodes once on the first resize event after mount.
    // This catches the case where fonts load and --layout-scale resolves after paint,
    // changing the container clientHeight / scrollHeight before the player interacts.
    let resizeScrollFired = false
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth = $isLandscape
          ? Math.min(entry.contentRect.width * 0.7, MAX_WIDTH)
          : Math.min(entry.contentRect.width, MAX_WIDTH)
        layoutScale = getLayoutScale()
      }
      // One-shot scroll trigger on first layout-settle resize
      if (!resizeScrollFired && scrollContainer) {
        resizeScrollFired = true
        scheduleScrollRetry(scrollContainer)
      }
    })
    if (scrollContainer) resizeObserver.observe(scrollContainer)

    // MutationObserver — watches for .state-available nodes being added or changed.
    // Fires scheduleScrollRetry whenever the available set appears or shifts.
    // This catches late Phaser scene transitions that inject available nodes after
    // the initial $effect has already fired. Disconnects after successful scroll
    // or after 10 seconds to avoid leaking.
    let mutationObserver: MutationObserver | null = null
    let mutationTimeout: ReturnType<typeof setTimeout> | null = null

    if (scrollContainer) {
      const container = scrollContainer
      mutationObserver = new MutationObserver(() => {
        const hasAvailable = container.querySelector('.state-available') !== null
        if (hasAvailable) {
          const success = scrollToAvailableNodes(container)
          if (success && mutationObserver) {
            mutationObserver.disconnect()
            mutationObserver = null
            if (mutationTimeout !== null) {
              clearTimeout(mutationTimeout)
              mutationTimeout = null
            }
          }
        }
      })
      mutationObserver.observe(container, { childList: true, subtree: true })

      // Safety disconnect after 10 seconds — prevents leak if node never arrives
      mutationTimeout = setTimeout(() => {
        mutationObserver?.disconnect()
        mutationObserver = null
        mutationTimeout = null
      }, 10000)
    }

    // Animate fog wisps via Web Animations API (CSS var() in @keyframes doesn't work in Chrome)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion) {
      const wispEls = document.querySelectorAll('.fog-wisp')
      const animations: Animation[] = []
      wispEls.forEach((el, i) => {
        const w = fogWisps[i]
        if (!w) return
        const anim = el.animate([
          { transform: 'translate(0, 0)' },
          { transform: `translate(${w.dx * 0.6}px, ${w.dy}px)` },
          { transform: `translate(${w.dx}px, ${w.dy * 0.3}px)` },
          { transform: `translate(${w.dx * 0.4}px, ${w.dy * -0.5}px)` },
          { transform: `translate(${w.dx * -0.3}px, ${w.dy * -0.8}px)` },
          { transform: 'translate(0, 0)' },
        ], {
          duration: w.dur * 1000,
          iterations: Infinity,
          easing: 'ease-in-out',
          delay: -w.delay * 1000,
        })
        animations.push(anim)
      })
    }

    // Initial scroll on mount: double-RAF ensures layout has settled before we
    // measure getBoundingClientRect. The retry schedule inside scheduleScrollRetry
    // covers Phaser scene start tearing the layout (nodes not yet in DOM).
    if (scrollContainer) {
      const container = scrollContainer
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduleScrollRetry(container)
        })
      })
    }

    return () => {
      resizeObserver.disconnect()
      mutationObserver?.disconnect()
      if (mutationTimeout !== null) clearTimeout(mutationTimeout)
    }
  })

  // Auto-scroll to show current available nodes whenever they change.
  // Also fires on initial render (Svelte $effect runs after first mount paint).
  // Uses instant scrollTop assignment — never smooth — for reliability in
  // headless Chromium / SwiftShader and after returning from combat.
  $effect(() => {
    void availableNodes.length
    const container = scrollContainer
    if (!container) return
    // Double-RAF: first RAF queues after Svelte's DOM patch; second RAF fires
    // after the browser has laid out the new node positions.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleScrollRetry(container)
      })
    })
  })
</script>

<div class="dungeon-map-overlay" style="background: {segmentBg};" data-testid="dungeon-map">
  <!-- Fixed HUD -->
  <header class="map-hud">
    <h1 class="hud-title">{segmentName}</h1>
    <!-- HP bar removed — InRunTopBar is the canonical HP display for dungeonMap screen -->

    <!-- Boss preview banner TEMPORARILY DISABLED 2026-04-11 (user request).
         Re-enable by removing the `false &&` guard below.
         Original purpose: telegraphs the floor 4→6 and 17→18 cliffs identified in
         BATCH-2026-04-11-ULTRA Cluster A. Only visible when boss hasn't been defeated yet.
         See BossPreviewBanner.svelte and docs/ui/screens.md. -->
    {#if false && showBossPreview && bossTemplate}
      <BossPreviewBanner
        enemyId={bossNode!.enemyId ?? ''}
        enemyName={bossTemplate!.name}
        enemyDesc={bossTemplate!.description}
        {bossFloor}
      />
    {/if}
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
        {@const nodeOpacity = rowDist <= 1 ? 1 : rowDist <= 2 ? 0.4 : rowDist <= 3 ? 0.2 : 0.08}
        {@const nodeBlur = rowDist <= 1 ? 0 : rowDist <= 2 ? 8 : rowDist <= 3 ? 16 : 24}
        <div
          class="node-position node-entrance"
          style="left: {nx}px; top: {ny}px; opacity: {nodeOpacity}; filter: blur(calc({nodeBlur}px * var(--layout-scale, 1))); animation-delay: {node.row * 60}ms;"
        >
          <MapNodeComponent
            {node}
            pickedBy={nodePicks[node.id] ?? []}
            onclick={() => node.state === 'available' && onNodeSelect(node.id)}
          />
        </div>
      {/each}

      <!-- Fog of war — many scattered wisps of varied sizes -->
      <div
        class="fog-overlay"
        style="height: {canvasHeight}px;"
        aria-hidden="true"
      >
        {#each fogWisps as w, i (i)}
          <div
            class="fog-wisp"
            style="
              width: calc({w.size}px * var(--layout-scale, 1));
              height: calc({w.size * w.ratio}px * var(--layout-scale, 1));
              top: {w.y}%;
              left: {w.x}%;
              opacity: {w.opacity};
            "
          ></div>
        {/each}
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

  /* Issue 2 fix: In landscape, push overlay top down to leave room for InRunTopBar.
     Both share z-index 200 but top bar renders first in DOM; this avoids overlap. */
  :global([data-layout="landscape"]) .dungeon-map-overlay {
    top: var(--topbar-height, 4.5vh);
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
     Fog of war — many scattered atmospheric wisps
     No opaque base. Icons are blurred directly (inline styles).
     26 wisps of varied sizes (tiny to large) float around.
     Each wisp uses CSS custom properties --dx/--dy for unique drift.
     ========================================================= */
  .fog-overlay {
    position: absolute;
    top: 0;
    left: -50vw;
    right: -50vw;
    z-index: 3;
    pointer-events: none;
    overflow: visible;
  }

  .fog-wisp {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(ellipse at center,
      rgba(160,165,185,0.6) 0%,
      rgba(150,155,175,0.3) 20%,
      rgba(140,145,165,0.1) 50%,
      transparent 100%
    );
    will-change: transform;
  }

  /* Wisp animations are created via Web Animations API in onMount
     (CSS var() in @keyframes is not supported in Chrome) */

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
  }
</style>
