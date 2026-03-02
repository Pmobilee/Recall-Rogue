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
    for (const obj of layout.objects) {
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

    // Tooltip for hovered object
    if (hoveredObject) {
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

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handlePointerMove(e: PointerEvent): void {
    const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
    const hit = hitTest(gridX, gridY)
    if (hit?.id !== hoveredObject?.id) {
      hoveredObject = hit
      dirty = true
      if (canvasEl) {
        canvasEl.style.cursor = hit ? 'pointer' : 'default'
      }
    }
  }

  function handlePointerLeave(): void {
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

  function handleClick(e: MouseEvent): void {
    const { gridX, gridY } = clientToGrid(e.clientX, e.clientY)
    const hit = hitTest(gridX, gridY)
    if (hit) {
      triggerTap(hit)
    }
  }

  function handleTouchStart(e: TouchEvent): void {
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

    // Keyboard shortcut: press 'G' to toggle the dev grid overlay
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'g' || e.key === 'G') {
        toggleDevGrid()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    // Attach event listeners
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
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
      document.removeEventListener('keydown', handleKeyDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
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
-->
<div class="dome-canvas-container" bind:this={containerEl}>
  <canvas
    bind:this={canvasEl}
    style="width: {CANVAS_W}px; height: {CANVAS_H}px; transform: translate(-50%, -50%) scale({cssScale});"
    aria-label="Dome hub — tap an object to explore a room"
  ></canvas>
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
</style>
