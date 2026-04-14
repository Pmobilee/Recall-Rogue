<script lang="ts">
  /**
   * MapPinDrop.svelte
   *
   * Canvas-based interactive world map for the Map Pin Drop geography quiz mode.
   *
   * The player sees a question like "Where is Kyoto?" and taps the map to place
   * a pin. Distance from the correct coordinate determines accuracy via
   * geoScoringService. After confirmation, the correct pin appears with a
   * connecting arc and a distance/accuracy readout.
   *
   * Rendering: d3-geo Mercator projection drawn onto an HiDPI-aware HTML canvas.
   * Interaction: pointer events for pan (drag) and tap-to-place, wheel for zoom.
   *   Trackpad pinch-to-zoom is handled via touchstart/touchmove/touchend (two-finger
   *   distance tracking). Ctrl+scroll (trackpad pinch on many systems) falls through
   *   the existing wheel handler naturally.
   * Styling: mastery-progressive — labels + thick borders at low mastery fade to
   *   near-invisible coastlines only at mastery 5.
   */

  import { onMount } from 'svelte'
  import {
    geoMercator,
    geoPath,
    geoGraticule,
    geoCentroid,
    geoArea,
  } from 'd3-geo'
  import type { GeoPermissibleObjects } from 'd3-geo'
  import type { FeatureCollection, Feature } from 'geojson'
  import { loadWorldGeoJson } from '../../services/geoDataLoader'
  import { haversineDistance, calculateGeoAccuracy } from '../../services/geoScoringService'

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface Props {
    /** Correct answer coordinates [latitude, longitude]. */
    targetCoordinates: [number, number]
    /** Geographic region for initial centering (e.g. 'europe', 'asia'). */
    targetRegion?: string
    /** Card mastery level 0-5. Controls map styling and initial zoom. */
    masteryLevel: number
    /** Lock interaction after answer confirmed. */
    disabled?: boolean
    /** Whether to show country name labels on the map. */
    showLabels?: boolean
    /** Optional callback when the label toggle button is clicked. */
    ontogglelabels?: () => void
    /** Callback when player confirms pin placement. */
    onconfirm: (pinCoordinates: [number, number], distanceKm: number, accuracy: number) => void
  }

  interface DistanceResult {
    distanceKm: number
    accuracy: number
  }

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    targetCoordinates,
    targetRegion,
    masteryLevel,
    disabled = false,
    showLabels = true,
    ontogglelabels,
    onconfirm,
  }: Props = $props()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let canvasEl = $state<HTMLCanvasElement | undefined>(undefined)
  let containerEl = $state<HTMLDivElement | undefined>(undefined)
  let containerWidth = $state(800)
  let containerHeight = $state(500)

  let geoJson = $state<FeatureCollection | null>(null)
  let geoLoadError = $state<string | null>(null)

  /** Pin placed by the player, stored as [lat, lng] to match our convention. */
  let pinCoords = $state<[number, number] | null>(null)
  let confirmed = $state(false)
  let distanceResult = $state<DistanceResult | null>(null)

  // Pan / zoom state
  let scale = $state(1)
  let translateX = $state(0)
  let translateY = $state(0)

  // Interaction tracking (NOT reactive — mutated directly)
  let isPanning = false
  let panStartX = 0
  let panStartY = 0
  let panStartTransX = 0
  let panStartTransY = 0

  // Touch pinch-to-zoom tracking (NOT reactive — mutated directly)
  let pinchActive = false
  let pinchStartDist = 0
  let pinchStartScale = 0
  let pinchStartTransX = 0
  let pinchStartTransY = 0
  let pinchMidX = 0
  let pinchMidY = 0

  // rAF scheduling
  let rafHandle: number | null = null

  // ---------------------------------------------------------------------------
  // Region centers — [longitude, latitude] for d3's [lng, lat] convention
  // ---------------------------------------------------------------------------

  const REGION_CENTERS: Record<string, [number, number]> = {
    europe: [15, 50],
    asia: [100, 35],
    africa: [20, 5],
    north_america: [-100, 45],
    south_america: [-60, -15],
    oceania: [140, -25],
    middle_east: [45, 30],
    central_asia: [65, 42],
    southeast_asia: [115, 5],
    east_asia: [120, 35],
    caribbean: [-75, 20],
    scandinavia: [15, 63],
    balkans: [22, 43],
  }

  // ---------------------------------------------------------------------------
  // Mastery-based styling helpers
  // ---------------------------------------------------------------------------

  /** Earth-tone country fill colors, using MAPCOLOR7 to reduce adjacency conflicts. */
  const COUNTRY_FILL_COLORS = [
    '#2d5016',
    '#3a6b1f',
    '#1e4a2f',
    '#4a6b3a',
    '#2f5a3a',
    '#3d5c1e',
    '#264d1a',
  ]

  function getCountryFill(feature: Feature, mastery: number): string {
    const colorIdx = (((feature.properties?.MAPCOLOR7 as number | undefined) ?? 0) % COUNTRY_FILL_COLORS.length)
    const base = COUNTRY_FILL_COLORS[colorIdx]
    if (mastery >= 4) return base + '44' // Nearly invisible at high mastery
    if (mastery >= 2) return base + 'aa' // Semi-transparent mid mastery
    return base
  }

  function getBorderWidth(mastery: number): number {
    return ([2, 1.5, 1, 0.5, 0.3, 0.2] as const)[mastery] ?? 1
  }

  function getBorderStyle(mastery: number): string {
    if (mastery >= 4) return 'rgba(100,140,180,0.25)'
    if (mastery >= 2) return 'rgba(200,200,200,0.4)'
    return 'rgba(200,200,200,0.7)'
  }

  // ---------------------------------------------------------------------------
  // Projection helpers
  // ---------------------------------------------------------------------------

  /** Build a fresh Mercator projection from current pan/zoom state. */
  function buildProjection() {
    const baseScale = containerWidth / 6
    return geoMercator()
      .scale(baseScale * scale)
      .translate([containerWidth / 2 + translateX, containerHeight / 2 + translateY])
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------

  function drawCountryLabels(
    ctx: CanvasRenderingContext2D,
    data: FeatureCollection,
    projection: ReturnType<typeof geoMercator>,
    mastery: number,
  ) {
    const fontSize = mastery === 0 ? 11 : 9
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'

    for (const feature of data.features) {
      const name = feature.properties?.NAME as string | undefined
      if (!name) continue

      // Skip very small countries — they clutter the map
      const area = geoArea(feature as GeoPermissibleObjects)
      if (area < 0.005) continue

      const center = geoCentroid(feature as GeoPermissibleObjects)
      const px = projection(center)
      if (!px) continue
      const [x, y] = px
      // Only draw labels inside canvas bounds
      if (x > 0 && x < containerWidth && y > 0 && y < containerHeight) {
        ctx.fillText(name, x, y)
      }
    }
  }

  /**
   * Draw a map pin at a canvas position.
   * @param color CSS color string for the pin head.
   */
  function drawPin(
    ctx: CanvasRenderingContext2D,
    screenPos: [number, number],
    color: string,
  ) {
    const [x, y] = screenPos
    // Scale pin radius with zoom but keep it readable
    const r = Math.min(10, Math.max(6, 8 * Math.sqrt(scale)))

    // Shadow
    ctx.beginPath()
    ctx.arc(x, y + 2, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()

    // Pin body
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Inner dot
    ctx.beginPath()
    ctx.arc(x, y, r * 0.38, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
  }

  /**
   * Draw a dashed arc connecting two screen positions (player pin → correct pin).
   */
  function drawArc(
    ctx: CanvasRenderingContext2D,
    from: [number, number],
    to: [number, number],
  ) {
    const [x1, y1] = from
    const [x2, y2] = to
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.3

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo(mx, my, x2, y2)
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.85)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ---------------------------------------------------------------------------
  // Main render function
  // ---------------------------------------------------------------------------

  function render() {
    rafHandle = null
    if (!canvasEl || !geoJson) return

    const dpr = window.devicePixelRatio || 1
    const ctx = canvasEl.getContext('2d')!
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, containerWidth, containerHeight)

    // --- Ocean background ---
    ctx.fillStyle = '#1a2744'
    ctx.fillRect(0, 0, containerWidth, containerHeight)

    const projection = buildProjection()
    const path = geoPath<GeoPermissibleObjects>(projection, ctx as unknown as CanvasRenderingContext2D)

    // --- Grid lines at mastery 0 ---
    if (masteryLevel === 0) {
      const graticule = geoGraticule().step([30, 30])
      ctx.beginPath()
      path(graticule() as GeoPermissibleObjects)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // --- Countries ---
    for (const feature of geoJson.features) {
      ctx.beginPath()
      path(feature as GeoPermissibleObjects)
      ctx.fillStyle = getCountryFill(feature, masteryLevel)
      ctx.fill()
      ctx.strokeStyle = getBorderStyle(masteryLevel)
      ctx.lineWidth = getBorderWidth(masteryLevel) * Math.min(scale, 3)
      ctx.stroke()
    }

    // --- Country labels (mastery 0-1, only when showLabels is enabled) ---
    if (showLabels && masteryLevel <= 1) {
      drawCountryLabels(ctx, geoJson, projection, masteryLevel)
    }

    // --- Player pin ---
    if (pinCoords) {
      // pinCoords is [lat, lng], d3 wants [lng, lat]
      const px = projection([pinCoords[1], pinCoords[0]])
      if (px) drawPin(ctx, px as [number, number], '#ef4444')
    }

    // --- Correct pin + arc after confirmation ---
    if (confirmed) {
      const tp = projection([targetCoordinates[1], targetCoordinates[0]])
      if (tp) drawPin(ctx, tp as [number, number], '#22c55e')

      if (pinCoords) {
        const pp = projection([pinCoords[1], pinCoords[0]])
        if (pp && tp) {
          drawArc(ctx, pp as [number, number], tp as [number, number])
        }
      }
    }

    ctx.restore()
  }

  function requestRender() {
    if (rafHandle !== null) return
    rafHandle = requestAnimationFrame(render)
  }

  // ---------------------------------------------------------------------------
  // Canvas sizing
  // ---------------------------------------------------------------------------

  function resizeCanvas() {
    if (!canvasEl) return
    const dpr = window.devicePixelRatio || 1
    canvasEl.width = containerWidth * dpr
    canvasEl.height = containerHeight * dpr
    canvasEl.style.width = `${containerWidth}px`
    canvasEl.style.height = `${containerHeight}px`
  }

  // ---------------------------------------------------------------------------
  // Initial view
  // ---------------------------------------------------------------------------

  /**
   * Set initial pan/zoom so the relevant region fills most of the canvas.
   * Does NOT center on the exact answer — that would give it away.
   */
  function setInitialView() {
    const masteryScales = [1, 1.2, 2, 3, 4, 5]
    scale = masteryScales[Math.min(masteryLevel, 5)] ?? 1

    // Look up region center (lng, lat for d3), fallback to a slight Atlantic center
    const regionCenter: [number, number] = targetRegion
      ? (REGION_CENTERS[targetRegion] ?? [0, 20])
      : [0, 20]

    // Add modest random offset at higher mastery so the answer is never trivially centered
    const jitter = masteryLevel >= 3 ? 1 : 0
    const jitterLng = jitter * (Math.random() - 0.5) * 30
    const jitterLat = jitter * (Math.random() - 0.5) * 20

    const probe = buildProjection()
    const px = probe([regionCenter[0] + jitterLng, regionCenter[1] + jitterLat])
    if (px) {
      translateX = containerWidth / 2 - px[0]
      translateY = containerHeight / 2 - px[1]
    }
  }

  // ---------------------------------------------------------------------------
  // Pan / zoom interaction
  // ---------------------------------------------------------------------------

  function handlePointerDown(e: PointerEvent) {
    if (disabled || confirmed) return
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    panStartTransX = translateX
    panStartTransY = translateY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPanning) return
    translateX = panStartTransX + (e.clientX - panStartX)
    translateY = panStartTransY + (e.clientY - panStartY)
    requestRender()
  }

  function handlePointerUp(e: PointerEvent) {
    const dx = Math.abs(e.clientX - panStartX)
    const dy = Math.abs(e.clientY - panStartY)
    const wasTap = dx < 5 && dy < 5
    isPanning = false

    if (wasTap && !disabled && !confirmed && canvasEl) {
      const rect = canvasEl.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      // Map click coords to canvas pixel space, then invert through projection
      const cx = (e.clientX - rect.left) * (canvasEl.width / (rect.width * dpr))
      const cy = (e.clientY - rect.top) * (canvasEl.height / (rect.height * dpr))

      const projection = buildProjection()
      const geo = projection.invert?.([cx, cy])
      if (geo) {
        // d3 returns [lng, lat] — store as [lat, lng]
        pinCoords = [geo[1], geo[0]]
        requestRender()
      }
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.5, Math.min(20, scale * factor))

    if (!canvasEl) return
    // Zoom toward the mouse cursor position
    const rect = canvasEl.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    translateX = mx - (mx - translateX) * (newScale / scale)
    translateY = my - (my - translateY) * (newScale / scale)
    scale = newScale
    requestRender()
  }

  // ---------------------------------------------------------------------------
  // Touch pinch-to-zoom handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle two-finger pinch for trackpad and touchscreen zoom.
   * Zooms toward the midpoint between the two touch points.
   */
  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault()
      pinchActive = true
      isPanning = false // cancel any active pan
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      pinchStartDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      pinchStartScale = scale
      pinchStartTransX = translateX
      pinchStartTransY = translateY
      // Midpoint in page coords
      pinchMidX = (t0.clientX + t1.clientX) / 2
      pinchMidY = (t0.clientY + t1.clientY) / 2
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!pinchActive || e.touches.length !== 2) return
    e.preventDefault()
    const t0 = e.touches[0]
    const t1 = e.touches[1]
    const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
    if (pinchStartDist === 0) return

    const rawScale = pinchStartScale * (dist / pinchStartDist)
    const newScale = Math.max(0.5, Math.min(20, rawScale))

    // Zoom toward the original pinch midpoint (canvas-relative)
    const canvasEl_ = canvasEl
    if (!canvasEl_) return
    const rect = canvasEl_.getBoundingClientRect()
    const mx = pinchMidX - rect.left
    const my = pinchMidY - rect.top
    translateX = mx - (mx - pinchStartTransX) * (newScale / pinchStartScale)
    translateY = my - (my - pinchStartTransY) * (newScale / pinchStartScale)
    scale = newScale
    requestRender()
  }

  function handleTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) {
      pinchActive = false
    }
  }

  // ---------------------------------------------------------------------------
  // Confirm handler
  // ---------------------------------------------------------------------------

  function handleConfirm() {
    if (!pinCoords || confirmed) return
    confirmed = true

    const distKm = haversineDistance(
      pinCoords[0], pinCoords[1],
      targetCoordinates[0], targetCoordinates[1],
    )
    const acc = calculateGeoAccuracy(distKm, masteryLevel)
    distanceResult = { distanceKm: distKm, accuracy: acc }

    requestRender()

    // Delay callback so player can see the result before parent transitions away
    setTimeout(() => {
      onconfirm(pinCoords!, distKm, acc)
    }, 1500)
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onMount(() => {
    // Observe container for size changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width
        containerHeight = entry.contentRect.height
        resizeCanvas()
        requestRender()
      }
    })
    if (!containerEl) return
    observer.observe(containerEl)

    // Initial sizing from DOM
    const rect = containerEl.getBoundingClientRect()
    containerWidth = rect.width || 800
    containerHeight = rect.height || 500
    resizeCanvas()

    // Load GeoJSON then paint
    loadWorldGeoJson()
      .then((data) => {
        geoJson = data
        setInitialView()
        requestRender()
      })
      .catch((err: unknown) => {
        geoLoadError = err instanceof Error ? err.message : 'Failed to load map data'
        console.error('[MapPinDrop] GeoJSON load failed:', err)
      })

    return () => {
      observer.disconnect()
      if (rafHandle !== null) cancelAnimationFrame(rafHandle)
    }
  })
</script>

<!-- -------------------------------------------------------------------------
  Template
  ------------------------------------------------------------------------ -->
<div class="map-pin-container" bind:this={containerEl}>

  {#if geoLoadError}
    <div class="map-load-error">
      <span>Map data failed to load.</span>
      <span class="map-load-error-detail">{geoLoadError}</span>
    </div>
  {:else}
    <canvas
      bind:this={canvasEl}
      class="map-canvas"
      style="touch-action: none;"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onwheel={handleWheel}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
      aria-label="Interactive world map — tap to place your pin"
    ></canvas>
  {/if}

  {#if !confirmed && ontogglelabels}
    <button
      class="map-label-toggle"
      class:labels-off={!showLabels}
      onclick={ontogglelabels}
      aria-label={showLabels ? 'Hide country names' : 'Show country names'}
      title={showLabels ? 'Hide country names' : 'Show country names'}
    >
      Aa
    </button>
  {/if}

  {#if pinCoords && !confirmed}
    <button class="map-confirm-btn" onclick={handleConfirm}>
      Confirm Pin
    </button>
  {/if}

  {#if confirmed && distanceResult}
    <div class="map-result-display" role="status" aria-live="polite">
      <span class="map-distance">{Math.round(distanceResult.distanceKm)} km away</span>
      <span
        class="map-accuracy"
        class:map-perfect={distanceResult.accuracy >= 0.95}
        class:map-good={distanceResult.accuracy >= 0.5 && distanceResult.accuracy < 0.95}
        class:map-miss={distanceResult.accuracy < 0.5}
      >
        {Math.round(distanceResult.accuracy * 100)}% accuracy
      </span>
    </div>
  {/if}
</div>

<!-- -------------------------------------------------------------------------
  Styles
  ------------------------------------------------------------------------ -->
<style>
  .map-pin-container {
    position: relative;
    width: 100%;
    flex: 1;
    min-height: calc(360px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .map-canvas {
    display: block;
    flex: 1;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    border-radius: calc(4px * var(--layout-scale, 1));
    /* Crisp pixel output — avoid browser sub-pixel smoothing on map lines */
    image-rendering: crisp-edges;
  }

  /* ---- Label toggle button ---- */
  .map-label-toggle {
    position: absolute;
    top: calc(10px * var(--layout-scale, 1));
    left: calc(10px * var(--layout-scale, 1));
    width: calc(36px * var(--layout-scale, 1));
    height: calc(36px * var(--layout-scale, 1));
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    padding: 0;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: calc(6px * var(--layout-scale, 1));
    cursor: pointer;
    z-index: 10;
    transition: background 120ms ease, opacity 120ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .map-label-toggle:hover {
    background: rgba(0, 0, 0, 0.75);
  }

  .map-label-toggle:active {
    background: rgba(0, 0, 0, 0.9);
  }

  /* Dimmed appearance when labels are hidden */
  .map-label-toggle.labels-off {
    opacity: 0.45;
    text-decoration: line-through;
  }

  /* ---- Confirm button ---- */
  .map-confirm-btn {
    position: absolute;
    bottom: calc(16px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    padding: calc(8px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    background: rgba(34, 197, 94, 0.92);
    color: white;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    cursor: pointer;
    z-index: 10;
    white-space: nowrap;
    min-width: calc(120px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    /* Ensure 44×44 minimum tap target */
    transition: background 120ms ease;
  }

  .map-confirm-btn:hover {
    background: rgba(34, 197, 94, 1);
  }

  .map-confirm-btn:active {
    background: rgba(22, 163, 74, 1);
  }

  /* ---- Result overlay ---- */
  .map-result-display {
    position: absolute;
    top: calc(12px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    background: rgba(0, 0, 0, 0.82);
    border-radius: calc(8px * var(--layout-scale, 1));
    z-index: 10;
    white-space: nowrap;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .map-distance {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 600;
    color: var(--text-primary, #e2e8f0);
  }

  .map-accuracy {
    font-size: calc(16px * var(--text-scale, 1));
    font-weight: 700;
  }

  .map-perfect { color: #ffd700; }
  .map-good    { color: #22c55e; }
  .map-miss    { color: #ef4444; }

  /* ---- Error state ---- */
  .map-load-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    color: #ef4444;
    font-size: calc(14px * var(--text-scale, 1));
    background: #0f172a;
    border-radius: calc(4px * var(--layout-scale, 1));
  }

  .map-load-error-detail {
    font-size: calc(11px * var(--text-scale, 1));
    color: rgba(239, 68, 68, 0.7);
  }
</style>
