<script lang="ts">
  import { get } from 'svelte/store'
  import { getDomeSpriteUrls } from '../../game/domeManifest'
  import {
    getDefaultDomeLayout,
    BG_TILE_SPRITES,
    FG_TILE_SPRITES,
    BgTile,
    FgTile,
    TILE_SIZE,
    DOME_WIDTH,
    DOME_HEIGHT,
  } from '../../data/domeLayout'
  import type { DomeLayout, DomeObject } from '../../data/domeLayout'
  import { spriteResolution } from '../stores/settings'

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  /**
   * Props for the tile-based DomeCanvas scene.
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

  /** CSS scale factor applied to the canvas element so it fills the container. */
  let cssScale = $state(1)

  // ---------------------------------------------------------------------------
  // Layout & image cache
  // ---------------------------------------------------------------------------

  /** The dome layout data model (grid + objects). */
  const layout: DomeLayout = getDefaultDomeLayout()

  /** Internal canvas pixel width — the full grid width at TILE_SIZE per cell. */
  const CANVAS_W = DOME_WIDTH * TILE_SIZE   // 24 * 32 = 768
  const CANVAS_H = DOME_HEIGHT * TILE_SIZE  // 16 * 32 = 512

  /** Cached HTMLImageElement instances, keyed by sprite key. */
  const imageMap = new Map<string, HTMLImageElement>()

  // ---------------------------------------------------------------------------
  // RAF / animation
  // ---------------------------------------------------------------------------

  let rafId: number | null = null

  // ---------------------------------------------------------------------------
  // Image loading
  // ---------------------------------------------------------------------------

  /**
   * Load all dome sprite images for the current resolution setting.
   * Invokes onAllLoaded when every pending image has resolved.
   */
  function loadImages(onAllLoaded: () => void): void {
    const res = get(spriteResolution)
    const urls = getDomeSpriteUrls(res)

    // Collect every sprite key referenced by the layout
    const needed = new Set<string>()

    for (const key of Object.values(BG_TILE_SPRITES)) {
      if (key) needed.add(key)
    }
    for (const key of Object.values(FG_TILE_SPRITES)) {
      if (key) needed.add(key)
    }
    for (const obj of layout.objects) {
      needed.add(obj.spriteKey)
    }
    // Surface horizon
    needed.add('surface_ground')
    // Sky background
    needed.add('sky_stars')

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
  // Rendering helpers
  // ---------------------------------------------------------------------------

  /**
   * Draw an image into a grid cell, with an optional globalAlpha override.
   * Silently skips if the image is not yet loaded.
   */
  function drawTile(
    ctx: CanvasRenderingContext2D,
    key: string,
    col: number,
    row: number,
    alpha = 1,
  ): void {
    const img = imageMap.get(key)
    if (!img || !img.complete || img.naturalWidth === 0) return

    const x = col * TILE_SIZE
    const y = row * TILE_SIZE

    if (alpha !== 1) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE)
      ctx.restore()
    } else {
      ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE)
    }
  }

  /**
   * Draw the sky background using the sky_stars sprite stretched across the
   * full canvas. Falls back to a dark gradient if the image is not yet loaded.
   */
  function drawSkyGradient(ctx: CanvasRenderingContext2D): void {
    const skyImg = imageMap.get('sky_stars')
    if (skyImg && skyImg.complete && skyImg.naturalWidth > 0) {
      ctx.drawImage(skyImg, 0, 0, CANVAS_W, CANVAS_H)
    } else {
      // Fallback: dark gradient while image loads
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      grad.addColorStop(0, '#0a0a2e')
      grad.addColorStop(1, '#1a0e30')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }
  }

  /**
   * Draw all background tiles (BgTile layer), row by row.
   * BgTile.Empty cells are skipped — the sky gradient shows through.
   */
  function drawBgLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < layout.height; row++) {
      for (let col = 0; col < layout.width; col++) {
        const tile = layout.bg[row][col]
        const key = BG_TILE_SPRITES[tile]
        if (!key) continue
        drawTile(ctx, key, col, row)
      }
    }
  }

  /**
   * Draw the surface_ground sprite as a horizon band at the sky/dome transition.
   * It is drawn full-width, centred vertically on the row-13 boundary.
   */
  function drawSurfaceHorizon(ctx: CanvasRenderingContext2D): void {
    const img = imageMap.get('surface_ground')
    if (!img || !img.complete || img.naturalWidth === 0) return

    // Draw it along the transition between sky and dirt (row 13 = y 416)
    const horizonY = 13 * TILE_SIZE
    const tileH = TILE_SIZE * 2  // two tiles tall for a nice horizon band
    const tileW = img.naturalWidth * (tileH / img.naturalHeight)

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, horizonY - TILE_SIZE, CANVAS_W, tileH + TILE_SIZE)
    ctx.clip()

    let x = 0
    while (x < CANVAS_W) {
      ctx.drawImage(img, x, horizonY - Math.floor(tileH * 0.4), tileW, tileH)
      x += tileW
    }
    ctx.restore()
  }

  /**
   * Draw all foreground / structural tiles (FgTile layer).
   * DomeGlass and DomeGlassCurved tiles are rendered at 0.7 alpha.
   */
  function drawFgLayer(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < layout.height; row++) {
      for (let col = 0; col < layout.width; col++) {
        const tile = layout.fg[row][col]
        const key = FG_TILE_SPRITES[tile]
        if (!key) continue

        const alpha =
          tile === FgTile.DomeGlass || tile === FgTile.DomeGlassCurved ? 0.7 : 1

        drawTile(ctx, key, col, row, alpha)
      }
    }
  }

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
   */
  function render(): void {
    const canvas = canvasEl
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!dirty) return

    dirty = false

    // Layer 1: sky gradient + stars (base)
    drawSkyGradient(ctx)

    // Layer 2: background tiles (sky_stars, interior_wall, dirt_ground)
    drawBgLayer(ctx)

    // Layer 3: surface horizon (sky-to-ground transition band)
    drawSurfaceHorizon(ctx)

    // Layer 4: foreground / structural tiles (dome glass, frame, floor)
    drawFgLayer(ctx)

    // Layer 5: objects and furniture
    drawObjects(ctx, hoveredObject, tappedObjectId)

    // Layer 6: tooltip for hovered object
    if (hoveredObject) {
      drawTooltip(ctx, hoveredObject)
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
    // canvas.width / rect.width gives the CSS-to-internal-pixel scale
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const canvasPx = (clientX - rect.left) * scaleX
    const canvasPy = (clientY - rect.top) * scaleY

    return {
      gridX: Math.floor(canvasPx / TILE_SIZE),
      gridY: Math.floor(canvasPy / TILE_SIZE),
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

    // Set internal canvas resolution to the full grid pixel size (1:1 pixel art)
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H

    // Attach event listeners
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })

    // Load sprites then start the render loop
    imagesLoaded = false
    dirty = true

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
  DomeCanvas: Terraria-style tile-based dome hub rendered on a 2D canvas.
  The canvas internal resolution is 768×512 (24×16 tiles at 32px each).
  A ResizeObserver on the container computes a CSS scale (cover) so the canvas
  fills the full container height on tall mobile screens with no empty dark space.
-->
<div class="dome-canvas-container" bind:this={containerEl}>
  <canvas
    bind:this={canvasEl}
    style="transform: translate(-50%, -50%) scale({cssScale});"
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
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
</style>
