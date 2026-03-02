<script lang="ts">
  import { get } from 'svelte/store'
  import { getDomeSpriteUrls } from '../../game/domeManifest'
  import {
    getDefaultDomeLayout,
    TILE_SIZE,
    DOME_WIDTH,
    DOME_HEIGHT,
    DOME_CX,
    DOME_APEX,
    DOME_BASE,
    DOME_A,
    DOME_B,
    DOME_LEFT,
    DOME_RIGHT,
    UPPER_CATWALK_TOP,
    UPPER_CATWALK_BOT,
    LEFT_WING_START,
    LEFT_WING_END,
    RIGHT_WING_START,
    RIGHT_WING_END,
    MAIN_FLOOR_TOP,
    MAIN_FLOOR_BOT,
    BASEMENT_TOP,
    BASEMENT_BOT,
    DIRT_START,
    FLOOR_LEFT,
    FLOOR_RIGHT,
    COL_POSITIONS,
  } from '../../data/domeLayout'
  import type { DomeLayout, DomeObject } from '../../data/domeLayout'
  import { spriteResolution } from '../stores/settings'

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  /**
   * Props for the procedural DomeCanvas scene.
   */
  interface Props {
    /** Called when an interactive dome object is tapped/clicked. */
    onObjectTap: (objectId: string, room: string) => void
    /** Current GAIA expression sprite key. Defaults to 'neutral'. */
    gaiaExpression?: string
  }

  let { onObjectTap, gaiaExpression = 'neutral' }: Props = $props()

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  let containerEl = $state<HTMLDivElement | null>(null)
  let canvasEl = $state<HTMLCanvasElement | null>(null)

  // ---------------------------------------------------------------------------
  // Reactive state
  // ---------------------------------------------------------------------------

  let imagesLoaded = $state(false)
  let hoveredObject = $state<DomeObject | null>(null)
  let dirty = $state(true)
  let tappedObjectId = $state<string | null>(null)
  let showDevGrid = $state(false)

  // Edit mode state
  let editMode = $state(false)
  let selectedObject = $state<DomeObject | null>(null)
  let dragging = $state(false)
  let dragOffsetX = $state(0)
  let dragOffsetY = $state(0)
  let showPalette = $state(false)

  /** Decoration items available to place from the palette. */
  const PALETTE_ITEMS: Array<{ spriteKey: string; label: string; gridW: number; gridH: number }> = [
    { spriteKey: 'deco_ceiling_light', label: 'Ceiling Light', gridW: 6, gridH: 4 },
    { spriteKey: 'deco_plant_pot', label: 'Plant Pot', gridW: 5, gridH: 4 },
    { spriteKey: 'deco_wall_monitor', label: 'Wall Monitor', gridW: 6, gridH: 5 },
  ]

  /** CSS scale factor applied to the canvas element so it fills the container. */
  let cssScale = $state(1)

  // ---------------------------------------------------------------------------
  // Layout & image cache
  // ---------------------------------------------------------------------------

  /** The dome layout data model (grid + objects). */
  const layout: DomeLayout = getDefaultDomeLayout()

  /** Internal canvas pixel width — the full grid width at TILE_SIZE per cell. */
  const CANVAS_W = DOME_WIDTH * TILE_SIZE   // 192 * 4 = 768
  const CANVAS_H = DOME_HEIGHT * TILE_SIZE  // 128 * 4 = 512

  /** Pixel density multiplier — doubles the canvas resolution for sharper rendering. */
  const RENDER_SCALE = 2

  /** Cached HTMLImageElement instances, keyed by sprite key. */
  const imageMap = new Map<string, HTMLImageElement>()

  /**
   * Offscreen canvases for static layers (bg and fg).
   * Rendered once after images load and composited cheaply each frame.
   */
  let bgLayerCanvas: HTMLCanvasElement | null = null
  let fgLayerCanvas: HTMLCanvasElement | null = null

  // ---------------------------------------------------------------------------
  // RAF / animation
  // ---------------------------------------------------------------------------

  let rafId: number | null = null

  // ---------------------------------------------------------------------------
  // Image loading
  // ---------------------------------------------------------------------------

  /**
   * Load only the object/furniture sprites needed by the layout.
   * Background and foreground tiles are now drawn procedurally, so we no
   * longer need to load sky_stars, surface_ground, or tile sprite sheets.
   */
  function loadImages(onAllLoaded: () => void): void {
    const res = get(spriteResolution)
    const urls = getDomeSpriteUrls(res)

    const needed = new Set<string>()

    // Only object sprites — no bg/fg tile sprites needed
    for (const obj of layout.objects) {
      needed.add(obj.spriteKey)
    }

    let remaining = 0

    for (const key of needed) {
      const url = urls[key]
      if (!url) continue
      if (imageMap.has(key)) continue

      remaining++
      const img = new Image()
      img.onload = () => {
        remaining--
        if (remaining === 0) onAllLoaded()
      }
      img.onerror = () => {
        remaining--
        if (remaining === 0) onAllLoaded()
      }
      img.src = url
      imageMap.set(key, img)
    }

    if (remaining === 0) onAllLoaded()
  }

  // ---------------------------------------------------------------------------
  // Procedural background rendering
  // ---------------------------------------------------------------------------

  /**
   * Simple seeded pseudo-random number generator (LCG) for reproducible star
   * placement without relying on Math.random() which is non-deterministic.
   */
  function makeSeededRng(seed: number): () => number {
    let s = seed
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return (s >>> 0) / 0xffffffff
    }
  }

  /**
   * Draw a rich procedural background onto bgCtx:
   *  - Sky gradient (top half, outside dome)
   *  - Stars scattered in the top 50% of the canvas
   *  - Dome interior fill (dark blue-gray) clipped to the ellipse
   *  - Dirt/ground fill with geological layer lines
   */
  function drawProceduralBg(bgCtx: CanvasRenderingContext2D): void {
    // --- Sky gradient (full canvas base) ---
    const skyGrad = bgCtx.createLinearGradient(0, 0, 0, CANVAS_H)
    skyGrad.addColorStop(0, '#0b0b1e')
    skyGrad.addColorStop(0.25, '#141030')
    skyGrad.addColorStop(0.5, '#251545')
    skyGrad.addColorStop(0.7, '#4a1942')
    skyGrad.addColorStop(0.85, '#6b3035')
    skyGrad.addColorStop(1, '#4a2818')
    bgCtx.fillStyle = skyGrad
    bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // --- Stars (top 50% only) ---
    const rng = makeSeededRng(0xdeadbeef)
    const halfH = CANVAS_H * 0.5

    // Small dim stars
    for (let i = 0; i < 60; i++) {
      const sx = rng() * CANVAS_W
      const sy = rng() * halfH
      const r = 0.5 + rng() * 0.5
      const alpha = 0.4 + rng() * 0.4
      bgCtx.beginPath()
      bgCtx.arc(sx, sy, r, 0, Math.PI * 2)
      bgCtx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`
      bgCtx.fill()
    }

    // Larger bright stars with a soft glow
    for (let i = 0; i < 5; i++) {
      const sx = rng() * CANVAS_W
      const sy = rng() * halfH * 0.8
      // Glow halo
      const glowGrad = bgCtx.createRadialGradient(sx, sy, 0, sx, sy, 6)
      glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
      glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
      bgCtx.fillStyle = glowGrad
      bgCtx.fillRect(sx - 6, sy - 6, 12, 12)
      // Star core
      bgCtx.beginPath()
      bgCtx.arc(sx, sy, 1.5, 0, Math.PI * 2)
      bgCtx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      bgCtx.fill()
    }

    // --- Dome interior fill (clipped to ellipse) ---
    const domeCX = DOME_CX * TILE_SIZE        // 384
    const domeCY = DOME_BASE * TILE_SIZE       // 320
    const domeRX = DOME_A * TILE_SIZE          // 288
    const domeRY = DOME_B * TILE_SIZE          // 272

    bgCtx.save()
    // Build ellipse clip path (upper half of dome down to BASE row)
    bgCtx.beginPath()
    bgCtx.ellipse(domeCX, domeCY, domeRX, domeRY, 0, Math.PI, 0)
    bgCtx.lineTo(domeCX + domeRX, domeCY)
    bgCtx.lineTo(domeCX - domeRX, domeCY)
    bgCtx.closePath()
    bgCtx.clip()

    // Dark interior base fill
    bgCtx.fillStyle = '#161a28'
    bgCtx.fillRect(DOME_LEFT * TILE_SIZE, DOME_APEX * TILE_SIZE, (DOME_RIGHT - DOME_LEFT) * TILE_SIZE, (DOME_BASE - DOME_APEX) * TILE_SIZE)

    // Radial gradient overlay — lighter at centre, darker at walls
    const interiorGrad = bgCtx.createRadialGradient(domeCX, domeCY - 80, 20, domeCX, domeCY - 80, domeRX * 0.9)
    interiorGrad.addColorStop(0, 'rgba(35, 45, 65, 0.5)')
    interiorGrad.addColorStop(1, 'rgba(12, 16, 26, 0.8)')
    bgCtx.fillStyle = interiorGrad
    bgCtx.fillRect(DOME_LEFT * TILE_SIZE, DOME_APEX * TILE_SIZE, (DOME_RIGHT - DOME_LEFT) * TILE_SIZE, (DOME_BASE - DOME_APEX) * TILE_SIZE)

    bgCtx.restore()

    // --- Interior fill below dome (between legs, rows BASE to DIRT_START) ---
    const legGapLeft = (DOME_LEFT + 1) * TILE_SIZE
    const legGapRight = (DOME_RIGHT - 1) * TILE_SIZE
    bgCtx.fillStyle = '#161a28'
    bgCtx.fillRect(legGapLeft, DOME_BASE * TILE_SIZE, legGapRight - legGapLeft, (DIRT_START - DOME_BASE) * TILE_SIZE)

    // --- Dirt / ground region (rows DIRT_START to bottom) ---
    const dirtTopY = DIRT_START * TILE_SIZE
    const dirtGrad = bgCtx.createLinearGradient(0, dirtTopY, 0, CANVAS_H)
    dirtGrad.addColorStop(0, '#5a3a22')
    dirtGrad.addColorStop(1, '#1a0e08')
    bgCtx.fillStyle = dirtGrad
    bgCtx.fillRect(0, dirtTopY, CANVAS_W, CANVAS_H - dirtTopY)

    // Geological layer lines
    for (let y = dirtTopY; y < CANVAS_H; y += TILE_SIZE * 4) {
      const isMajor = ((y - dirtTopY) % (TILE_SIZE * 8)) === 0
      bgCtx.fillStyle = isMajor ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)'
      bgCtx.fillRect(0, y, CANVAS_W, 1)
    }
  }

  /**
   * Draw all structural elements procedurally onto fgCtx:
   *  - Dome glass shell (elliptical arc)
   *  - Frame legs
   *  - Support columns
   *  - Upper catwalks (left and right wings)
   *  - Main floor
   *  - Basement platform
   */
  function drawProceduralFg(fgCtx: CanvasRenderingContext2D): void {
    const TS = TILE_SIZE

    const domeCX = DOME_CX * TS         // 384
    const domeCY = DOME_BASE * TS        // 320
    const domeRX = DOME_A * TS           // 288
    const domeRY = DOME_B * TS           // 272

    // --- Dome glass shell ---
    // Outer glow / fill band
    fgCtx.beginPath()
    fgCtx.ellipse(domeCX, domeCY, domeRX, domeRY, 0, Math.PI, 0)
    fgCtx.strokeStyle = 'rgba(80, 180, 210, 0.3)'
    fgCtx.lineWidth = 20
    fgCtx.stroke()

    // Outer structural frame ring
    fgCtx.beginPath()
    fgCtx.ellipse(domeCX, domeCY, domeRX + 2, domeRY + 2, 0, Math.PI, 0)
    fgCtx.strokeStyle = '#2a3040'
    fgCtx.lineWidth = 4
    fgCtx.stroke()

    // Inner glow highlight
    fgCtx.beginPath()
    fgCtx.ellipse(domeCX, domeCY, domeRX - 6, domeRY - 6, 0, Math.PI, 0)
    fgCtx.strokeStyle = 'rgba(120, 220, 255, 0.08)'
    fgCtx.lineWidth = 2
    fgCtx.stroke()

    // Subtle teal tint inside the dome
    fgCtx.save()
    fgCtx.beginPath()
    fgCtx.ellipse(domeCX, domeCY, domeRX - 10, domeRY - 10, 0, Math.PI, 0)
    fgCtx.closePath()
    fgCtx.fillStyle = 'rgba(60, 160, 190, 0.04)'
    fgCtx.fill()
    fgCtx.restore()

    // --- Frame legs (left and right, from MAIN_FLOOR_TOP down to bottom) ---
    const legW = 3 * TS   // 12px wide
    const legTop = MAIN_FLOOR_TOP * TS
    const legH = CANVAS_H - legTop

    fgCtx.fillStyle = '#2a3040'
    // Left leg
    fgCtx.fillRect(DOME_LEFT * TS, legTop, legW, legH)
    // Right leg
    fgCtx.fillRect((DOME_RIGHT - 3) * TS, legTop, legW, legH)

    // --- Support columns ---
    for (const col of COL_POSITIONS) {
      const colX = col.start * TS
      const colW = (col.end - col.start + 1) * TS
      // Column runs from UPPER_CATWALK_BOT+1 to MAIN_FLOOR_TOP (left/right)
      // or from row 20 to MAIN_FLOOR_TOP (center)
      const isCenter = col.start === 95
      const colTopRow = isCenter ? 20 : UPPER_CATWALK_BOT + 1
      const colTopY = colTopRow * TS
      const colBotY = MAIN_FLOOR_TOP * TS

      fgCtx.fillStyle = '#363c4e'
      fgCtx.fillRect(colX, colTopY, colW, colBotY - colTopY)

      // Left-edge highlight
      fgCtx.fillStyle = 'rgba(130, 160, 190, 0.2)'
      fgCtx.fillRect(colX, colTopY, 1, colBotY - colTopY)

      // Right-edge shadow
      fgCtx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      fgCtx.fillRect(colX + colW - 1, colTopY, 1, colBotY - colTopY)
    }

    // Helper: draw a platform slab with top highlight and drop shadow
    function drawSlab(
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
    ): void {
      // Body
      fgCtx.fillStyle = color
      fgCtx.fillRect(x, y, w, h)

      // Subtle panel seam lines across the platform
      for (let lx = x + TS * 8; lx < x + w; lx += TS * 12) {
        fgCtx.fillStyle = 'rgba(0, 0, 0, 0.12)'
        fgCtx.fillRect(lx, y, 1, h)
      }

      // Top highlight
      fgCtx.fillStyle = 'rgba(140, 170, 200, 0.3)'
      fgCtx.fillRect(x, y, w, 1)

      // Drop shadow below
      const shadowGrad = fgCtx.createLinearGradient(0, y + h, 0, y + h + 4 * TS)
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0.25)')
      shadowGrad.addColorStop(1, 'rgba(0,0,0,0)')
      fgCtx.fillStyle = shadowGrad
      fgCtx.fillRect(x, y + h, w, 4 * TS)
    }

    // --- Upper catwalks ---
    const catwalkY = UPPER_CATWALK_TOP * TS
    const catwalkH = (UPPER_CATWALK_BOT - UPPER_CATWALK_TOP + 1) * TS

    // Left wing
    drawSlab(
      LEFT_WING_START * TS,
      catwalkY,
      (LEFT_WING_END - LEFT_WING_START + 1) * TS,
      catwalkH,
      '#33384a',
    )
    // Right wing
    drawSlab(
      RIGHT_WING_START * TS,
      catwalkY,
      (RIGHT_WING_END - RIGHT_WING_START + 1) * TS,
      catwalkH,
      '#33384a',
    )

    // --- Main floor ---
    drawSlab(
      FLOOR_LEFT * TS,
      MAIN_FLOOR_TOP * TS,
      (FLOOR_RIGHT - FLOOR_LEFT + 1) * TS,
      (MAIN_FLOOR_BOT - MAIN_FLOOR_TOP + 1) * TS,
      '#3a3f50',
    )

    // --- Basement platform ---
    drawSlab(
      FLOOR_LEFT * TS,
      BASEMENT_TOP * TS,
      (FLOOR_RIGHT - FLOOR_LEFT + 1) * TS,
      (BASEMENT_BOT - BASEMENT_TOP + 1) * TS,
      '#33384a',
    )

    // --- Foundation base ring at dome base level ---
    const foundationY = DOME_BASE * TS
    const foundationH = 3 * TS  // 3 tiles tall
    fgCtx.fillStyle = '#3a3e48'
    fgCtx.fillRect(DOME_LEFT * TS, foundationY, (DOME_RIGHT - DOME_LEFT) * TS, foundationH)
    // Top highlight
    fgCtx.fillStyle = 'rgba(160, 180, 200, 0.3)'
    fgCtx.fillRect(DOME_LEFT * TS, foundationY, (DOME_RIGHT - DOME_LEFT) * TS, 1)
    // Bottom edge
    fgCtx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    fgCtx.fillRect(DOME_LEFT * TS, foundationY + foundationH - 1, (DOME_RIGHT - DOME_LEFT) * TS, 1)
  }

  /**
   * Render background and foreground static layers to offscreen canvases once.
   * Only needs to be called once after images load (layout never changes).
   */
  function renderStaticLayers(): void {
    // --- bg offscreen ---
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = CANVAS_W * RENDER_SCALE
    bgCanvas.height = CANVAS_H * RENDER_SCALE
    const bgCtx = bgCanvas.getContext('2d')
    if (bgCtx) {
      bgCtx.scale(RENDER_SCALE, RENDER_SCALE)
      drawProceduralBg(bgCtx)
    }
    bgLayerCanvas = bgCanvas

    // --- fg offscreen ---
    const fgCanvas = document.createElement('canvas')
    fgCanvas.width = CANVAS_W * RENDER_SCALE
    fgCanvas.height = CANVAS_H * RENDER_SCALE
    const fgCtx = fgCanvas.getContext('2d')
    if (fgCtx) {
      fgCtx.scale(RENDER_SCALE, RENDER_SCALE)
      drawProceduralFg(fgCtx)
    }
    fgLayerCanvas = fgCanvas
  }

  // ---------------------------------------------------------------------------
  // Dome boundary & placement helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns true if an object with the given grid position and size fits entirely
   * inside the dome interior (above the ellipse walls or between the legs below DOME_BASE).
   */
  function isInsideDome(gx: number, gy: number, gw: number, gh: number): boolean {
    const corners = [
      [gx, gy],
      [gx + gw - 1, gy],
      [gx, gy + gh - 1],
      [gx + gw - 1, gy + gh - 1],
    ]
    for (const [cx, cy] of corners) {
      if (cy < DOME_APEX || cy > BASEMENT_BOT) return false
      if (cy <= DOME_BASE) {
        // Above the base: must be inside ellipse
        const dx = (cx - DOME_CX) / DOME_A
        const dy = (cy - DOME_BASE) / DOME_B
        if (dx * dx + dy * dy > 1) return false
      } else {
        // Below base: must be between legs
        if (cx < DOME_LEFT + 1 || cx > DOME_RIGHT - 2) return false
      }
    }
    return true
  }

  /**
   * Returns true if placing obj at its current grid position overlaps any other
   * object of the same category (interactive vs. non-interactive).
   * Cross-category overlap is allowed so decorations can sit behind usable items.
   * @param obj The object to check
   * @param excludeId ID of an object to skip (the object being moved itself)
   */
  function hasOverlap(obj: DomeObject, excludeId: string | null): boolean {
    for (const other of layout.objects) {
      if (other.id === excludeId) continue
      if (other.interactive !== obj.interactive) continue
      if (
        obj.gridX < other.gridX + other.gridW &&
        obj.gridX + obj.gridW > other.gridX &&
        obj.gridY < other.gridY + other.gridH &&
        obj.gridY + obj.gridH > other.gridY
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Load a single sprite by key into the imageMap if not already cached.
   * Marks the canvas dirty once the image loads so it appears immediately.
   */
  function loadSingleSprite(key: string): void {
    if (imageMap.has(key)) return
    const res = get(spriteResolution)
    const urls = getDomeSpriteUrls(res)
    const url = urls[key]
    if (!url) return
    const img = new Image()
    img.onload = () => { dirty = true }
    img.src = url
    imageMap.set(key, img)
  }

  /**
   * Place a decoration item from the palette at dome centre (main floor level).
   * Validates that the position is inside the dome and does not overlap existing
   * decorations before adding it to the layout.
   */
  function placeDecoration(item: typeof PALETTE_ITEMS[number]): void {
    const gx = Math.round(DOME_CX - item.gridW / 2)
    const gy = MAIN_FLOOR_TOP - item.gridH

    const existingCount = layout.objects.filter((o) => o.spriteKey === item.spriteKey).length
    const newId = `${item.spriteKey.replace('deco_', '')}_${existingCount + 1}`

    const newObj: DomeObject = {
      id: newId,
      spriteKey: item.spriteKey,
      label: item.label,
      room: 'none',
      gridX: gx,
      gridY: gy,
      gridW: item.gridW,
      gridH: item.gridH,
      interactive: false,
    }

    if (!isInsideDome(gx, gy, item.gridW, item.gridH)) return
    if (hasOverlap(newObj, null)) return

    layout.objects.push(newObj)
    loadSingleSprite(newObj.spriteKey)
    selectedObject = newObj
    dirty = true
  }

  // ---------------------------------------------------------------------------
  // Object rendering helpers
  // ---------------------------------------------------------------------------

  /**
   * Draw a radial glow highlight centred on the given object's grid area.
   * Called before drawing the object sprite so the glow sits behind it.
   */
  function drawHoverGlow(ctx: CanvasRenderingContext2D, obj: DomeObject): void {
    const px = obj.gridX * TILE_SIZE
    const py = obj.gridY * TILE_SIZE
    const pw = obj.gridW * TILE_SIZE
    const ph = obj.gridH * TILE_SIZE

    const cx = px + pw / 2
    const cy = py + ph / 2
    const r = Math.max(pw, ph) * 0.65 + 8

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.24)')
    grad.addColorStop(0.5, 'rgba(180,220,255,0.12)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, cy, pw * 0.6 + 10, ph * 0.6 + 10, 0, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
  }

  /**
   * Draw all dome objects and furniture.
   * Interactive objects get a hover glow when they are the current hoveredObject.
   * A tapped object gets a white semi-transparent highlight and a 10% scale-up.
   */
  function drawObjects(ctx: CanvasRenderingContext2D, hovered: DomeObject | null, tappedId: string | null): void {
    // Sort: decorations (interactive=false) drawn first (behind), then interactive items (on top)
    const sorted = [...layout.objects].sort((a, b) => {
      if (a.interactive === b.interactive) return 0
      return a.interactive ? 1 : -1
    })

    for (const obj of sorted) {
      if (hovered && hovered.id === obj.id && obj.interactive) {
        drawHoverGlow(ctx, obj)
      }

      const img = imageMap.get(obj.spriteKey)
      if (!img || !img.complete || img.naturalWidth === 0) continue

      const px = obj.gridX * TILE_SIZE
      const py = obj.gridY * TILE_SIZE
      const pw = obj.gridW * TILE_SIZE
      const ph = obj.gridH * TILE_SIZE

      // Shadow beneath object (visual grounding) — skip for dive_hatch which is flush with the floor
      if (obj.id !== 'dive_hatch') {
        const shadowW = pw * 0.7
        const shadowH = ph * 0.15
        const shadowX = px + (pw - shadowW) / 2
        const shadowY = py + ph - shadowH * 0.5  // sits at the bottom of the object

        ctx.save()
        ctx.beginPath()
        ctx.ellipse(shadowX + shadowW / 2, shadowY + shadowH / 2, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.fill()
        ctx.restore()
      }

      const isTapped = tappedId === obj.id

      if (isTapped) {
        // White semi-transparent flash behind the object
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.fillRect(px, py, pw, ph)

        // Draw the sprite 10% larger, centred on the same position
        const scale = 1.1
        const scaledW = pw * scale
        const scaledH = ph * scale
        const offsetX = (scaledW - pw) / 2
        const offsetY = (scaledH - ph) / 2
        ctx.drawImage(img, px - offsetX, py - offsetY, scaledW, scaledH)
      } else {
        ctx.drawImage(img, px, py, pw, ph)
      }
    }
  }

  /**
   * Draw a rounded-rect tooltip label below the hovered object.
   */
  function drawTooltip(ctx: CanvasRenderingContext2D, obj: DomeObject): void {
    const label = obj.label

    // Bottom-centre of the object in canvas pixels
    const cx = (obj.gridX + obj.gridW / 2) * TILE_SIZE
    const bottomY = (obj.gridY + obj.gridH) * TILE_SIZE + 4

    const fontSize = 9
    ctx.font = `${fontSize}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const textW = ctx.measureText(label).width
    const padX = 6
    const padY = 3
    const boxW = textW + padX * 2
    const boxH = fontSize + padY * 2
    const boxX = cx - boxW / 2
    const boxY = bottomY
    const r = 3

    ctx.save()

    // Background pill
    ctx.fillStyle = 'rgba(8,8,40,0.84)'
    ctx.beginPath()
    ctx.moveTo(boxX + r, boxY)
    ctx.lineTo(boxX + boxW - r, boxY)
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + r, r)
    ctx.lineTo(boxX + boxW, boxY + boxH - r)
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH, r)
    ctx.lineTo(boxX + r, boxY + boxH)
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - r, r)
    ctx.lineTo(boxX, boxY + r)
    ctx.arcTo(boxX, boxY, boxX + r, boxY, r)
    ctx.closePath()
    ctx.fill()

    // Border
    ctx.strokeStyle = 'rgba(180,220,255,0.22)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Label text
    ctx.fillStyle = '#ddeeff'
    ctx.fillText(label, cx, boxY + padY)

    ctx.restore()
  }

  /**
   * Draw edit mode overlays: selected object border, coordinate label, and banner.
   */
  function drawEditModeOverlays(ctx: CanvasRenderingContext2D): void {
    // Top banner
    const bannerH = 14
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
    ctx.fillRect(0, 0, CANVAS_W, bannerH)
    ctx.font = '7px "Courier New", monospace'
    ctx.fillStyle = '#00ddff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('EDIT MODE — Drag | Arrow nudge | Del remove deco | C copy | E exit', CANVAS_W / 2, bannerH / 2)

    // Selected object highlight and coordinate label
    const sel = selectedObject
    if (sel) {
      const px = sel.gridX * TILE_SIZE
      const py = sel.gridY * TILE_SIZE
      const pw = sel.gridW * TILE_SIZE
      const ph = sel.gridH * TILE_SIZE

      // Cyan dashed border
      ctx.save()
      ctx.strokeStyle = '#00ffee'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.strokeRect(px, py, pw, ph)
      ctx.setLineDash([])
      ctx.restore()

      // Coordinate label below selected object
      const labelText = `X:${sel.gridX} Y:${sel.gridY} W:${sel.gridW} H:${sel.gridH}`
      const fontSize = 7
      ctx.font = `${fontSize}px "Courier New", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const labelX = px + pw / 2
      const labelY = py + ph + 3
      const textW = ctx.measureText(labelText).width
      const padX = 4
      const padY = 2
      const boxW = textW + padX * 2
      const boxH = fontSize + padY * 2

      ctx.save()
      ctx.fillStyle = 'rgba(0, 20, 30, 0.85)'
      ctx.fillRect(labelX - boxW / 2, labelY, boxW, boxH)
      ctx.strokeStyle = 'rgba(0, 220, 240, 0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(labelX - boxW / 2, labelY, boxW, boxH)
      ctx.fillStyle = '#00ffee'
      ctx.fillText(labelText, labelX, labelY + padY)
      ctx.restore()
    }
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  /**
   * Render all layers onto the canvas in back-to-front order.
   * Static layers (bg + fg) are composited from offscreen canvas caches
   * built once in renderStaticLayers() so the per-frame cost is just two
   * drawImage() calls regardless of content complexity.
   */
  function render(): void {
    const canvas = canvasEl
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!dirty) return

    dirty = false

    // Reset and apply render scale each frame so all coordinate math stays in 768×512 space
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0)

    if (bgLayerCanvas && fgLayerCanvas) {
      // Fast path: composite pre-rendered static layers
      ctx.drawImage(bgLayerCanvas, 0, 0, CANVAS_W, CANVAS_H)
      ctx.drawImage(fgLayerCanvas, 0, 0, CANVAS_W, CANVAS_H)
    } else {
      // Fallback before offscreen canvases are ready
      ctx.fillStyle = '#0b0b1e'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }

    // Ambient light pools under ceiling lights
    const lightPositions = [
      { x: 45, y: 26 },
      { x: 88, y: 20 },
      { x: 105, y: 20 },
      { x: 155, y: 26 },
    ]
    for (const light of lightPositions) {
      const px = light.x * TILE_SIZE
      const py = light.y * TILE_SIZE
      const grad = ctx.createRadialGradient(px, py + 40, 0, px, py + 40, 80)
      grad.addColorStop(0, 'rgba(255, 230, 180, 0.06)')
      grad.addColorStop(1, 'rgba(255, 230, 180, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(px - 80, py, 160, 120)
    }

    // Objects and furniture (rendered live — state changes each frame)
    drawObjects(ctx, hoveredObject, tappedObjectId)

    // Tooltip for hovered object (skip in edit mode to reduce clutter)
    if (hoveredObject && !editMode) {
      drawTooltip(ctx, hoveredObject)
    }

    // Vignette overlay (final pass)
    const vigGrad = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.35,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7,
    )
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)')
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.2)')
    ctx.fillStyle = vigGrad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Dev grid overlay — drawn last so it sits on top of everything
    if (showDevGrid) {
      drawDevGrid(ctx)
    }

    // Edit mode overlays — drawn after dev grid
    if (editMode) {
      drawEditModeOverlays(ctx)
    }
  }

  /**
   * The main animation loop — runs every frame via requestAnimationFrame.
   */
  function loop(): void {
    render()
    rafId = requestAnimationFrame(loop)
  }

  // ---------------------------------------------------------------------------
  // Dev grid overlay
  // ---------------------------------------------------------------------------

  /**
   * Toggle the developer grid overlay on/off and mark the canvas dirty so it
   * re-renders immediately.
   */
  function toggleDevGrid(): void {
    showDevGrid = !showDevGrid
    dirty = true
  }

  /**
   * Toggle edit mode on/off.
   * Enabling edit mode also enables the dev grid for better object positioning.
   * Disabling edit mode deselects any currently selected object.
   */
  function toggleEditMode(): void {
    editMode = !editMode
    if (editMode) {
      showDevGrid = true
    } else {
      selectedObject = null
      dragging = false
    }
    dirty = true
  }

  /**
   * Export all current object positions to the browser console as a
   * copy-paste-ready code snippet for domeLayout.ts.
   */
  function exportPositions(): void {
    const lines = layout.objects.map(
      (obj) => `  { id: '${obj.id}', gridX: ${obj.gridX}, gridY: ${obj.gridY}, gridW: ${obj.gridW}, gridH: ${obj.gridH} },`,
    )
    console.log('// Dome object positions — paste into domeLayout.ts\n' + lines.join('\n'))
  }

  /**
   * Draw a diagnostic overlay onto the canvas that shows:
   *  - Major grid lines every 8 tiles (32px logical)
   *  - Platform edge highlights at key structural rows
   *  - Bounding boxes around all interactive objects
   *  - Grid coordinate labels every 16 tiles
   *  - The mathematical dome ellipse boundary
   *
   * Coordinates are in the 768×512 logical pixel space (TILE_SIZE = 4px per tile).
   */
  function drawDevGrid(ctx: CanvasRenderingContext2D): void {
    // --- Major grid lines every 8 tiles (32px) ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 0.5

    // Vertical lines
    for (let col = 0; col <= DOME_WIDTH; col += 8) {
      const x = col * TILE_SIZE
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_H)
      ctx.stroke()
    }

    // Horizontal lines
    for (let row = 0; row <= DOME_HEIGHT; row += 8) {
      const y = row * TILE_SIZE
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_W, y)
      ctx.stroke()
    }

    // --- Platform edge highlights ---
    // Upper catwalks top row
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, UPPER_CATWALK_TOP * TILE_SIZE)
    ctx.lineTo(CANVAS_W, UPPER_CATWALK_TOP * TILE_SIZE)
    ctx.stroke()

    // Main floor top row
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)'
    ctx.beginPath()
    ctx.moveTo(0, MAIN_FLOOR_TOP * TILE_SIZE)
    ctx.lineTo(CANVAS_W, MAIN_FLOOR_TOP * TILE_SIZE)
    ctx.stroke()

    // Basement top row
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)'
    ctx.beginPath()
    ctx.moveTo(0, BASEMENT_TOP * TILE_SIZE)
    ctx.lineTo(CANVAS_W, BASEMENT_TOP * TILE_SIZE)
    ctx.stroke()

    // --- Object bounding boxes ---
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)'
    ctx.lineWidth = 1
    for (const obj of layout.objects) {
      ctx.strokeRect(
        obj.gridX * TILE_SIZE,
        obj.gridY * TILE_SIZE,
        obj.gridW * TILE_SIZE,
        obj.gridH * TILE_SIZE,
      )
    }

    // --- Grid coordinate labels every 16 tiles ---
    ctx.font = '6px monospace'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (let col = 0; col <= DOME_WIDTH; col += 16) {
      for (let row = 0; row <= DOME_HEIGHT; row += 16) {
        ctx.fillText(`${col},${row}`, col * TILE_SIZE + 1, row * TILE_SIZE + 7)
      }
    }

    // --- Dome ellipse outline (mathematical boundary) ---
    ctx.beginPath()
    ctx.ellipse(
      DOME_CX * TILE_SIZE,
      DOME_BASE * TILE_SIZE,
      DOME_A * TILE_SIZE,
      DOME_B * TILE_SIZE,
      0,
      Math.PI,
      0,
    )
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // ---------------------------------------------------------------------------
  // Hit detection
  // ---------------------------------------------------------------------------

  /**
   * Convert a pointer/touch client coordinate to canvas-internal grid coordinates,
   * accounting for the CSS scale applied by the container.
   */
  function clientToGrid(clientX: number, clientY: number): { gridX: number; gridY: number } {
    const canvas = canvasEl
    if (!canvas) return { gridX: -1, gridY: -1 }

    const rect = canvas.getBoundingClientRect()
    // canvas.width / rect.width gives the CSS-to-internal-pixel scale (includes RENDER_SCALE)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    // canvasPx is in the 1536-pixel space; divide by RENDER_SCALE to get logical 768-space coords
    const canvasPx = (clientX - rect.left) * scaleX
    const canvasPy = (clientY - rect.top) * scaleY

    return {
      gridX: Math.floor(canvasPx / (TILE_SIZE * RENDER_SCALE)),
      gridY: Math.floor(canvasPy / (TILE_SIZE * RENDER_SCALE)),
    }
  }

  /**
   * Find the frontmost interactive object whose grid bounds contain (gx, gy).
   * Returns null if no hit.
   */
  function hitTest(gx: number, gy: number): DomeObject | null {
    // Check layout objects in reverse render order (front = last in array)
    for (let i = layout.objects.length - 1; i >= 0; i--) {
      const obj = layout.objects[i]
      if (!obj.interactive) continue
      if (
        gx >= obj.gridX &&
        gx < obj.gridX + obj.gridW &&
        gy >= obj.gridY &&
        gy < obj.gridY + obj.gridH
      ) {
        return obj
      }
    }

    return null
  }

  /**
   * Find ANY object (interactive or not) at the given grid position.
   * Used in edit mode to allow selecting non-interactive decorations.
   */
  function hitTestAny(gx: number, gy: number): DomeObject | null {
    for (let i = layout.objects.length - 1; i >= 0; i--) {
      const obj = layout.objects[i]
      if (
        gx >= obj.gridX &&
        gx < obj.gridX + obj.gridW &&
        gy >= obj.gridY &&
        gy < obj.gridY + obj.gridH
      ) {
        return obj
      }
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handlePointerMove(e: PointerEvent): void {
    // Drag logic — runs first when in edit mode with an active drag
    if (editMode && dragging && selectedObject) {
      const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
      const newX = Math.max(0, Math.min(DOME_WIDTH - selectedObject.gridW, gridX - dragOffsetX))
      const newY = Math.max(0, Math.min(DOME_HEIGHT - selectedObject.gridH, gridY - dragOffsetY))

      // Dome boundary constraint — block move if any corner leaves the dome interior
      if (!isInsideDome(newX, newY, selectedObject.gridW, selectedObject.gridH)) {
        dirty = true
        return
      }

      // Overlap prevention — block if same-category object would overlap
      const tempObj = { ...selectedObject, gridX: newX, gridY: newY }
      if (hasOverlap(tempObj as DomeObject, selectedObject.id)) {
        dirty = true
        return
      }

      // Find and mutate the object in the layout array directly
      const idx = layout.objects.findIndex((o) => o.id === selectedObject!.id)
      if (idx !== -1) {
        layout.objects[idx].gridX = newX
        layout.objects[idx].gridY = newY
        // Keep selectedObject reference in sync so the toolbar shows live coords
        selectedObject = layout.objects[idx]
      }

      dirty = true
      return
    }

    // Normal hover detection (skip in edit mode drag)
    const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
    const hit = editMode ? hitTestAny(gridX, gridY) : hitTest(gridX, gridY)
    if (hit?.id !== hoveredObject?.id) {
      hoveredObject = hit
      dirty = true
      if (canvasEl) {
        if (editMode) {
          canvasEl.style.cursor = hit ? (dragging ? 'grabbing' : 'grab') : 'default'
        } else {
          canvasEl.style.cursor = hit ? 'pointer' : 'default'
        }
      }
    }
  }

  function handlePointerLeave(): void {
    if (dragging) return  // don't reset hover state while dragging
    if (hoveredObject !== null) {
      hoveredObject = null
      dirty = true
      if (canvasEl) {
        canvasEl.style.cursor = 'default'
      }
    }
  }

  function triggerTap(obj: DomeObject): void {
    tappedObjectId = obj.id
    dirty = true
    setTimeout(() => {
      tappedObjectId = null
      dirty = true
      onObjectTap(obj.id, obj.room)
    }, 200)
  }

  function handlePointerDown(e: PointerEvent): void {
    if (!editMode) return

    const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
    const hit = hitTestAny(gridX, gridY)

    if (hit && selectedObject && hit.id === selectedObject.id) {
      // Start drag on the already-selected object
      dragging = true
      dragOffsetX = gridX - selectedObject.gridX
      dragOffsetY = gridY - selectedObject.gridY
      if (canvasEl) {
        canvasEl.setPointerCapture(e.pointerId)
        canvasEl.style.cursor = 'grabbing'
      }
    }
  }

  function handlePointerUp(e: PointerEvent): void {
    if (dragging) {
      dragging = false
      if (canvasEl) {
        try { canvasEl.releasePointerCapture(e.pointerId) } catch (_) { /* ignore */ }
        canvasEl.style.cursor = selectedObject ? 'grab' : 'default'
      }
      dirty = true
    }
  }

  function handleClick(e: MouseEvent): void {
    if (editMode) {
      // In edit mode: select/deselect objects rather than triggering room navigation
      const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
      const hit = hitTestAny(gridX, gridY)
      if (hit) {
        selectedObject = hit
      } else {
        selectedObject = null
      }
      dirty = true
      return
    }

    // Normal (non-edit) mode: trigger tap
    const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
    const hit = hitTest(gridX, gridY)
    if (hit) {
      triggerTap(hit)
    }
  }

  function handleTouchStart(e: TouchEvent): void {
    if (editMode) return  // edit mode uses pointer events only
    e.preventDefault()
    const touch = e.changedTouches[0]
    if (!touch) return
    const { gridX, gridY } = clientToGrid(touch.clientX, touch.clientY)
    const hit = hitTest(gridX, gridY)
    if (hit) {
      triggerTap(hit)
    }
  }

  // ---------------------------------------------------------------------------
  // Svelte 5 lifecycle
  // ---------------------------------------------------------------------------

  $effect(() => {
    const canvas = canvasEl
    if (!canvas) return

    // Set internal canvas resolution to 2× the logical grid size for sharper rendering
    canvas.width = CANVAS_W * RENDER_SCALE   // 1536
    canvas.height = CANVAS_H * RENDER_SCALE  // 1024

    // Keyboard shortcuts
    function handleKeyDown(e: KeyboardEvent): void {
      // Skip if user is typing in a form element
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return
      }
      // Skip if the event came from the Phaser canvas (no aria-label or wrong aria-label)
      if (target && target.tagName === 'CANVAS') {
        const label = target.getAttribute('aria-label') ?? ''
        if (!label.toLowerCase().includes('dome')) return
      }

      const key = e.key

      if (key === 'g' || key === 'G') {
        toggleDevGrid()
        return
      }

      if (key === 'e' || key === 'E') {
        toggleEditMode()
        return
      }

      if (key === 'c' || key === 'C') {
        if (editMode) {
          exportPositions()
        }
        return
      }

      // Delete/Backspace — remove a selected non-interactive (decoration) object
      if ((key === 'Delete' || key === 'Backspace') && editMode && selectedObject && !selectedObject.interactive) {
        e.preventDefault()
        const idx = layout.objects.findIndex((o) => o.id === selectedObject!.id)
        if (idx !== -1) {
          layout.objects.splice(idx, 1)
          selectedObject = null
          dirty = true
        }
        return
      }

      // Arrow key nudging when an object is selected in edit mode
      if (editMode && selectedObject) {
        let dx = 0
        let dy = 0
        const step = e.shiftKey ? 4 : 1

        if (key === 'ArrowLeft')  dx = -step
        if (key === 'ArrowRight') dx = step
        if (key === 'ArrowUp')    dy = -step
        if (key === 'ArrowDown')  dy = step

        if (dx !== 0 || dy !== 0) {
          e.preventDefault()
          const idx = layout.objects.findIndex((o) => o.id === selectedObject!.id)
          if (idx !== -1) {
            const newX = Math.max(0, Math.min(DOME_WIDTH - layout.objects[idx].gridW, layout.objects[idx].gridX + dx))
            const newY = Math.max(0, Math.min(DOME_HEIGHT - layout.objects[idx].gridH, layout.objects[idx].gridY + dy))

            // Dome boundary constraint
            if (!isInsideDome(newX, newY, layout.objects[idx].gridW, layout.objects[idx].gridH)) {
              dirty = true
              return
            }

            // Overlap prevention
            const tempObj = { ...layout.objects[idx], gridX: newX, gridY: newY }
            if (hasOverlap(tempObj as DomeObject, selectedObject!.id)) {
              dirty = true
              return
            }

            layout.objects[idx].gridX = newX
            layout.objects[idx].gridY = newY
            selectedObject = layout.objects[idx]
          }
          dirty = true
        }
      }
    }

    // Use window instead of document so events aren't eaten by Phaser
    window.addEventListener('keydown', handleKeyDown)

    // Attach event listeners
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })

    // Load object sprites then build offscreen layer caches and start the render loop.
    // renderStaticLayers() is called immediately without waiting for images since
    // the procedural bg/fg layers do not depend on any image data.
    imagesLoaded = false
    dirty = true

    renderStaticLayers()

    loadImages(() => {
      imagesLoaded = true
      dirty = true
    })

    rafId = requestAnimationFrame(loop)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      window.removeEventListener('keydown', handleKeyDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('touchstart', handleTouchStart)
    }
  })

  $effect(() => {
    const container = containerEl
    if (!container) return

    /**
     * Recompute the CSS scale whenever the container resizes so the canvas
     * always fills the available space (cover behaviour — may crop edges on
     * very wide viewports, but fills the full height on tall mobile screens).
     */
    function updateScale(): void {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      const scaleX = w / CANVAS_W
      const scaleY = h / CANVAS_H
      // Use Math.max for cover (fills container, may crop) or Math.min for fit.
      // Cover is preferred for a game scene so there is no empty dark space.
      cssScale = Math.max(scaleX, scaleY)
    }

    updateScale()

    const observer = new ResizeObserver(updateScale)
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  })

</script>

<!--
  DomeCanvas: Dome hub rendered on a 2D canvas with fully procedural background
  and structural layers. The canvas internal resolution is 768×512 (192×128 tiles
  at 4px each). Static layers are pre-rendered to offscreen canvases for performance.
  Object/furniture sprites are drawn live each frame to reflect interaction state.
  A ResizeObserver on the container computes a CSS scale (cover) so the canvas
  fills the full container height on tall mobile screens with no empty dark space.

  Dev tools:
    G key — toggle grid overlay
    E key — toggle edit mode (drag objects to reposition)
    C key — (in edit mode) copy all positions to console
    Arrow keys — (in edit mode, object selected) nudge 1 tile; Shift+Arrow nudge 4 tiles
-->
<div class="dome-canvas-container" bind:this={containerEl}>
  <canvas
    bind:this={canvasEl}
    style="width: {CANVAS_W}px; height: {CANVAS_H}px; transform: translate(-50%, -50%) scale({cssScale});"
    aria-label="Dome hub — tap an object to explore a room"
  ></canvas>

  {#if showDevGrid || editMode}
    <div class="dome-toolbar">
      <button class="dome-tool-btn" class:active={showDevGrid} onclick={toggleDevGrid}>Grid</button>
      <button class="dome-tool-btn" class:active={editMode} onclick={toggleEditMode}>Edit</button>
      {#if editMode}
        <button class="dome-tool-btn" class:active={showPalette} onclick={() => { showPalette = !showPalette }}>Palette</button>
      {/if}
      {#if editMode && selectedObject}
        <span class="dome-tool-info">
          {selectedObject.id} ({selectedObject.interactive ? 'usable' : 'deco'}): ({selectedObject.gridX}, {selectedObject.gridY}) {selectedObject.gridW}&times;{selectedObject.gridH}
        </span>
      {/if}
    </div>
  {/if}

  {#if editMode && showPalette}
    <div class="dome-palette">
      <div class="dome-palette-title">Decorations</div>
      {#each PALETTE_ITEMS as item}
        <button class="dome-palette-item" onclick={() => placeDecoration(item)}>
          + {item.label}
        </button>
      {/each}
      <div class="dome-palette-hint">Select &amp; press Del to remove</div>
    </div>
  {/if}

  <div class="dome-hints">
    <button class="dome-hint-btn" onclick={toggleDevGrid} title="Toggle grid (G)">G</button>
    <button class="dome-hint-btn" onclick={toggleEditMode} title="Toggle edit mode (E)">E</button>
  </div>
</div>

<style>
  .dome-canvas-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  canvas {
    display: block;
    /* Natural pixel dimensions (768×512) — CSS scaling is applied via inline
       transform driven by the ResizeObserver, not by width/height attributes. */
    position: absolute;
    top: 50%;
    left: 50%;
    /* transform is set inline: translate(-50%, -50%) scale(cssScale) */
    transform-origin: center center;
    pointer-events: auto;
    image-rendering: auto;
  }

  .dome-toolbar {
    position: absolute;
    bottom: 8px;
    left: 8px;
    display: flex;
    gap: 6px;
    align-items: center;
    z-index: 10;
    pointer-events: auto;
  }

  .dome-tool-btn {
    background: rgba(20, 25, 40, 0.85);
    color: #aabbcc;
    border: 1px solid rgba(100, 150, 200, 0.3);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    font-family: 'Courier New', monospace;
    cursor: pointer;
    min-height: 28px;
  }

  .dome-tool-btn:hover {
    background: rgba(30, 40, 60, 0.9);
    color: #ccddff;
  }

  .dome-tool-btn.active {
    background: rgba(40, 80, 120, 0.85);
    color: #88ccff;
    border-color: rgba(100, 180, 255, 0.5);
  }

  .dome-tool-info {
    color: #88ccff;
    font-size: 10px;
    font-family: 'Courier New', monospace;
    background: rgba(20, 25, 40, 0.8);
    padding: 2px 8px;
    border-radius: 3px;
  }

  .dome-hints {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
    pointer-events: auto;
  }

  .dome-hint-btn {
    background: rgba(20, 25, 40, 0.5);
    color: rgba(150, 170, 200, 0.5);
    border: 1px solid rgba(100, 150, 200, 0.15);
    border-radius: 3px;
    width: 24px;
    height: 24px;
    font-size: 10px;
    font-family: 'Courier New', monospace;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dome-hint-btn:hover {
    background: rgba(30, 40, 60, 0.8);
    color: #aabbcc;
  }

  .dome-palette {
    position: absolute;
    top: 60px;
    right: 0;
    bottom: 60px;
    width: 140px;
    z-index: 11;
    pointer-events: auto;
    background: rgba(12, 16, 28, 0.92);
    border-left: 1px solid rgba(100, 150, 200, 0.25);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
  }

  .dome-palette-title {
    color: #88ccff;
    font-size: 11px;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(100, 150, 200, 0.2);
    margin-bottom: 4px;
  }

  .dome-palette-item {
    background: rgba(30, 40, 60, 0.8);
    color: #aabbcc;
    border: 1px solid rgba(100, 150, 200, 0.2);
    border-radius: 3px;
    padding: 6px 8px;
    font-size: 10px;
    font-family: 'Courier New', monospace;
    cursor: pointer;
    text-align: left;
  }

  .dome-palette-item:hover {
    background: rgba(40, 60, 90, 0.9);
    color: #ccddff;
    border-color: rgba(100, 180, 255, 0.4);
  }

  .dome-palette-hint {
    color: rgba(150, 170, 200, 0.5);
    font-size: 9px;
    font-family: 'Courier New', monospace;
    margin-top: auto;
    padding-top: 4px;
  }
</style>
