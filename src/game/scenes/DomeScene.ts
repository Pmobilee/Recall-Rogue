/**
 * DomeScene.ts
 *
 * Phaser scene for the multi-floor glass hub (Phase 10.10–10.16).
 * Replaces FloorCanvas.svelte as the tile/object renderer.
 * Svelte DOM overlays (resource bars, panels) remain layered above the canvas via CSS.
 *
 * Scene key: 'DomeScene'
 *
 * Phase 10.11 — Multi-Floor Cutaway Layout:
 *   All unlocked floors are rendered stacked vertically in world space.
 *   Camera scrolls vertically between floors (Fallout Shelter-style).
 *
 * Phase 10.12 — Empty vs Upgraded Floor Visual Language:
 *   Tier-0 floors are dim/desaturated; tier-1+ floors are warm and alive.
 *
 * Phase 10.14 — Procedural Structural Detail:
 *   Glass panel seam lines, rivet dots, floor noise added to tile rendering.
 *
 * Phase 10.15 — Dome-to-Mine Transition Animation:
 *   playDiveTransition() zooms camera into hatch then fades to black.
 *   playReturnTransition() fades back in on return from mine.
 *
 * Phase 10.16 — GAIA Thought Bubbles:
 *   showThoughtBubble(text) renders an in-world speech bubble near GAIA terminal.
 */
import Phaser from 'phaser'
import {
  FLOOR_TILE_SIZE, FLOOR_COLS, FLOOR_ROWS, FLOOR_CANVAS_W, FLOOR_CANVAS_H,
  FloorBgTile, FloorFgTile,
  type HubFloor, type FloorUpgradeTier,
} from '../../data/hubLayout'
import { getDefaultHubStack } from '../../data/hubFloors'
import { getTreeStage } from '../../data/knowledgeTreeStages'
import { hubEvents } from '../hubEvents'

/** Theme ambient configs — one per floor theme. */
interface AmbientConfig {
  /** Phaser tint color for particles (e.g. 0x4ecca3). */
  particleColor: number
  /** How many ambient particles to spawn on this floor. */
  particleCount: number
  /** Hex color for the object glow ring. */
  glowColor: number
  /** Alpha of the glow fill. */
  glowAlpha: number
}

const THEME_AMBIENT: Record<string, AmbientConfig> = {
  'sci-fi':      { particleColor: 0x4ecca3, particleCount: 12, glowColor: 0x4ecca3, glowAlpha: 0.3 },
  'organic':     { particleColor: 0x90ee90, particleCount: 18, glowColor: 0x90ee90, glowAlpha: 0.25 },
  'crystal':     { particleColor: 0x6495ed, particleCount: 20, glowColor: 0x6495ed, glowAlpha: 0.35 },
  'observatory': { particleColor: 0xffffc8, particleCount: 35, glowColor: 0xffffc8, glowAlpha: 0.2 },
  'archive':     { particleColor: 0xc8b478, particleCount: 8,  glowColor: 0xc8b478, glowAlpha: 0.25 },
  'market':      { particleColor: 0xffa050, particleCount: 14, glowColor: 0xffa050, glowAlpha: 0.3 },
  'industrial':  { particleColor: 0xff6432, particleCount: 10, glowColor: 0xff6432, glowAlpha: 0.3 },
}

/** Background tile fill colors. */
const BG_COLORS: Record<number, number> = {
  [FloorBgTile.SkyStars]:      0x0a0a2e,
  [FloorBgTile.InteriorWall]:  0x2a2a3e,
  [FloorBgTile.DirtGround]:    0x4a3728,
  [FloorBgTile.StoneWall]:     0x3a3a4a,
  [FloorBgTile.CrystalWall]:   0x1a2a4a,
}

/** Foreground tile styles (color + alpha). */
const FG_COLORS: Record<number, { color: number; alpha: number }> = {
  [FloorFgTile.GlassWall]:    { color: 0x64b4ff, alpha: 0.3 },
  [FloorFgTile.MetalFrame]:   { color: 0x555568, alpha: 1.0 },
  [FloorFgTile.StoneFloor]:   { color: 0x5a5a6a, alpha: 1.0 },
  [FloorFgTile.MetalGrate]:   { color: 0x4a4a5a, alpha: 1.0 },
  [FloorFgTile.GlassCeiling]: { color: 0x78c8ff, alpha: 0.25 },
  [FloorFgTile.WoodPlanks]:   { color: 0x6a5038, alpha: 1.0 },
  [FloorFgTile.CrystalFloor]: { color: 0x2a4a6a, alpha: 1.0 },
}

/** Per-particle state. */
interface ParticleState {
  x: number
  y: number
  speed: number
  size: number
  alpha: number
  /** Which floor index this particle belongs to (for multi-floor world offset). */
  floorIndex: number
}

/**
 * DomeScene renders the multi-floor hub via Phaser graphics primitives.
 * It is started/stopped by GameManager when the player enters/leaves the hub.
 */
export class DomeScene extends Phaser.Scene {
  /** Whether the scene's create() method has finished. Prevents race conditions with Svelte $effect calls. */
  private created = false
  /** Index within the unlocked floors array (currently visible / camera-centered). */
  private floorIndex = 0
  /** All floors from the hub stack. */
  private floors: HubFloor[] = []
  /** Which floor IDs the player has unlocked. */
  private unlockedIds: string[] = ['starter']
  /** Upgrade tier per floor ID. */
  private floorTiers: Record<string, number> = { starter: 0 }
  /** Number of facts the player has mastered (for Knowledge Tree stage label). */
  private masteredCount = 0

  // ---- Graphics layers ----
  private tileGraphics!: Phaser.GameObjects.Graphics
  private objectGraphics!: Phaser.GameObjects.Graphics
  private glowGraphics!: Phaser.GameObjects.Graphics
  private particleGraphics!: Phaser.GameObjects.Graphics
  private detailGraphics!: Phaser.GameObjects.Graphics
  /** Text labels placed over floor objects. */
  private labelTexts: Phaser.GameObjects.Text[] = []

  /** Live particle state array — covers all unlocked floors. */
  private particleData: ParticleState[] = []

  // ---- Phase 10.16: GAIA thought bubble ----
  private bubbleContainer: Phaser.GameObjects.Container | null = null
  private bubbleTimer: Phaser.Time.TimerEvent | null = null

  constructor() {
    super({ key: 'DomeScene' })
  }

  /**
   * Called by Phaser when the scene is started.
   * Accepts optional hub state passed via GameManager.startDome().
   */
  init(data?: {
    unlockedIds?: string[]
    floorTiers?: Record<string, number>
    masteredCount?: number
    floorIndex?: number
  }): void {
    const hubStack = getDefaultHubStack()
    this.floors = hubStack.floors
    if (data?.unlockedIds) this.unlockedIds = data.unlockedIds
    if (data?.floorTiers) this.floorTiers = data.floorTiers
    if (data?.masteredCount !== undefined) this.masteredCount = data.masteredCount
    if (data?.floorIndex !== undefined) this.floorIndex = data.floorIndex
  }

  /**
   * Create all persistent graphics layers and kick off the first full render.
   * Phase 10.11: world bounds are set to full stacked height of all unlocked floors.
   */
  create(): void {
    this.tileGraphics     = this.add.graphics().setDepth(0)
    this.detailGraphics   = this.add.graphics().setDepth(0.5)
    this.glowGraphics     = this.add.graphics().setDepth(1)
    this.objectGraphics   = this.add.graphics().setDepth(2)
    this.particleGraphics = this.add.graphics().setDepth(3)

    this.renderAllFloors()
    this.setupInput()
    this.initAllParticles()
    this.created = true

    // Defer camera centering to ensure Phaser RESIZE has resolved actual canvas size.
    // Multiple retries handle Safari's lazy layout timing.
    this.time.delayedCall(0, () => this.centerCamera())
    this.time.delayedCall(100, () => this.centerCamera())

    // Recalculate camera zoom and centering whenever the canvas is resized
    this.scale.on('resize', () => {
      this.centerCamera()
    })
  }

  /** Animate particles every frame. */
  update(_time: number, delta: number): void {
    this.updateParticles(delta)
  }

  // =========================================================
  // Public API — called from HubView.svelte / GameManager
  // =========================================================

  /**
   * Called from Svelte when playerSave changes so the scene stays in sync
   * without needing to be restarted.
   */
  setHubState(
    unlockedIds: string[],
    floorTiers: Record<string, number>,
    masteredCount: number,
  ): void {
    if (!this.created) return
    this.unlockedIds   = unlockedIds
    this.floorTiers    = floorTiers
    this.masteredCount = masteredCount
    this.renderAllFloors()
    this.initAllParticles()
  }

  /**
   * Navigate to a specific floor index (within the unlocked list).
   * Phase 10.11: smoothly tweens camera scrollY instead of fading.
   */
  goToFloor(index: number): void {
    if (!this.created) return
    if (index === this.floorIndex) return
    this.floorIndex = index
    const cam = this.cameras.main
    if (cam.width <= 0 || cam.height <= 0) return
    const zoom = Math.min(cam.width / FLOOR_CANVAS_W, cam.height / FLOOR_CANVAS_H)
    if (zoom <= 0) return
    cam.setZoom(zoom)
    // Tween to the center of the target floor
    const targetCenterX = FLOOR_CANVAS_W / 2
    const targetCenterY = index * FLOOR_CANVAS_H + FLOOR_CANVAS_H / 2
    // Compute the scroll values that centerOn would produce
    const targetScrollX = targetCenterX - cam.width / (2 * zoom)
    const targetScrollY = targetCenterY - cam.height / (2 * zoom)
    this.tweens.add({
      targets: cam,
      scrollX: targetScrollX,
      scrollY: targetScrollY,
      duration: 400,
      ease: 'Cubic.Out',
    })
    hubEvents.emit('floorChanged', index)
  }

  // =========================================================
  // Phase 10.15 — Dome-to-Mine Transition
  // =========================================================

  /**
   * Play a cinematic zoom-into-hatch transition before launching the mine.
   * Zooms the camera into the dive hatch object, then fades to black.
   * Returns a Promise that resolves after the fade-out is complete.
   */
  async playDiveTransition(): Promise<void> {
    const floor = this.getCurrentFloor()
    if (!floor) return

    const hatch = floor.objects.find(o => o.action === 'dive')
    if (!hatch) {
      // No hatch on this floor — just do a plain fade
      this.cameras.main.fadeOut(300, 0, 0, 0)
      await new Promise<void>(resolve => {
        this.cameras.main.once('camerafadeoutcomplete', () => resolve())
      })
      return
    }

    const hatchX = hatch.gridX * FLOOR_TILE_SIZE + (hatch.gridW * FLOOR_TILE_SIZE) / 2
    const hatchY = this.floorIndex * FLOOR_CANVAS_H + hatch.gridY * FLOOR_TILE_SIZE + (hatch.gridH * FLOOR_TILE_SIZE) / 2

    // Phase 1: zoom camera into hatch over 500ms
    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: this.cameras.main,
        zoom: this.cameras.main.zoom * 4,
        scrollX: hatchX - this.scale.width / (this.cameras.main.zoom * 8),
        scrollY: hatchY - this.scale.height / (this.cameras.main.zoom * 8),
        duration: 500,
        ease: 'Cubic.In',
        onComplete: () => resolve(),
      })
    })

    // Phase 2: fade to black
    this.cameras.main.fadeOut(300, 0, 0, 0)
    await new Promise<void>(resolve => {
      this.cameras.main.once('camerafadeoutcomplete', () => resolve())
    })
  }

  /**
   * Play the return transition when coming back from the mine.
   * Resets camera zoom/position to the current floor, then fades in.
   */
  async playReturnTransition(): Promise<void> {
    // Restore camera zoom and centered position before fading in
    this.centerCamera()

    const cam = this.cameras.main
    cam.fadeIn(400, 0, 0, 0)
    await new Promise<void>(resolve => {
      cam.once('camerafadeincomplete', () => resolve())
    })
  }

  // =========================================================
  // Phase 10.16 — GAIA Thought Bubbles
  // =========================================================

  /**
   * Show a thought bubble near the GAIA terminal on the current floor.
   * Auto-hides after 5 seconds. Clicking the bubble dismisses it immediately
   * and emits 'gaia-bubble-tap'.
   */
  showThoughtBubble(text: string): void {
    this.hideThoughtBubble()

    const floor = this.getCurrentFloor()
    if (!floor) return

    const gaiaObj = floor.objects.find(
      o => o.action === 'command' || o.id.toLowerCase().includes('gaia'),
    )
    if (!gaiaObj) return

    const bx = gaiaObj.gridX * FLOOR_TILE_SIZE + gaiaObj.gridW * FLOOR_TILE_SIZE + 8
    const by = this.floorIndex * FLOOR_CANVAS_H + gaiaObj.gridY * FLOOR_TILE_SIZE - 30

    const lines = this.wrapBubbleText(text, 24)
    const bw = 160
    const bh = lines.length * 14 + 16

    // Bubble background graphics
    const gfx = this.add.graphics()
    gfx.fillStyle(0x0a1a1f, 0.85)
    gfx.fillRoundedRect(bx, by, bw, bh, 4)
    gfx.lineStyle(2, 0x4ecca3, 1.0)
    gfx.strokeRoundedRect(bx, by, bw, bh, 4)

    // Triangular tail pointing downward-left
    gfx.fillStyle(0x0a1a1f, 0.85)
    gfx.fillTriangle(bx + 10, by + bh, bx + 20, by + bh, bx + 15, by + bh + 8)
    gfx.setDepth(200)

    // Bubble text
    const textObj = this.add.text(bx + 8, by + 8, lines.join('\n'), {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '8px',
      color: '#c8f0e8',
      lineSpacing: 4,
      wordWrap: { width: bw - 16 },
    }).setDepth(201)

    // Clickable dismiss zone
    const zone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive()
    zone.on('pointerdown', () => {
      hubEvents.emit('gaia-bubble-tap', text)
      this.hideThoughtBubble()
    })

    this.bubbleContainer = this.add
      .container(0, 0, [gfx, textObj, zone])
      .setDepth(200)

    // Auto-dismiss after 5 seconds
    this.bubbleTimer = this.time.delayedCall(5000, () => {
      this.hideThoughtBubble()
    })
  }

  /** Destroy the current thought bubble immediately. */
  hideThoughtBubble(): void {
    if (this.bubbleContainer) {
      this.bubbleContainer.destroy(true)
      this.bubbleContainer = null
    }
    if (this.bubbleTimer) {
      this.bubbleTimer.destroy()
      this.bubbleTimer = null
    }
  }

  // =========================================================
  // Private rendering helpers
  // =========================================================

  /** Returns only the floors the player has unlocked. */
  private getUnlockedFloors(): HubFloor[] {
    return this.floors.filter(f => this.unlockedIds.includes(f.id))
  }

  /** Returns the currently displayed floor, or undefined if the list is empty. */
  private getCurrentFloor(): HubFloor | undefined {
    const unlocked = this.getUnlockedFloors()
    return unlocked[this.floorIndex]
  }

  /**
   * Calculate zoom and scroll so the current floor is centered in the viewport.
   * Called from renderAllFloors(), goToFloor(), and the resize handler so that
   * any change in canvas size is immediately reflected without a full re-render.
   */
  private centerCamera(): void {
    const cam = this.cameras.main
    // Guard: skip if canvas dimensions are not yet resolved (RESIZE mode race)
    if (cam.width <= 0 || cam.height <= 0) return
    const zoom = Math.min(cam.width / FLOOR_CANVAS_W, cam.height / FLOOR_CANVAS_H)
    if (zoom <= 0) return
    cam.setZoom(zoom)
    // Center on the middle of the current floor
    const centerX = FLOOR_CANVAS_W / 2
    const centerY = this.floorIndex * FLOOR_CANVAS_H + FLOOR_CANVAS_H / 2
    cam.centerOn(centerX, centerY)
  }

  /**
   * Phase 10.11 — Full re-render of ALL unlocked floors stacked vertically.
   * Each floor renders at a world-Y offset of floorIndex * FLOOR_CANVAS_H.
   * Camera zoom is set to fit the floor width; scrollY centers on current floor.
   */
  private renderAllFloors(): void {
    // Guard against calls before create() is complete
    if (!this.tileGraphics) return
    // Clear all layers
    this.tileGraphics.clear()
    this.glowGraphics.clear()
    this.objectGraphics.clear()
    this.detailGraphics.clear()

    for (const t of this.labelTexts) t.destroy()
    this.labelTexts = []

    const unlocked = this.getUnlockedFloors()
    if (unlocked.length === 0) return

    // Camera: zoom to fit, centered on current floor
    this.centerCamera()

    // Render each unlocked floor at its vertical world offset
    for (let fi = 0; fi < unlocked.length; fi++) {
      this.renderOneFloor(unlocked[fi], fi)
    }

    // Draw structural connectors between floors (Phase 10.11)
    this.renderFloorConnectors(unlocked.length)
  }

  /**
   * Render a single floor at the given world Y offset.
   * Phase 10.12: applies tier-based visual language (dim for tier 0, warm for tier 1+).
   * Phase 10.14: adds procedural structural detail to tiles.
   */
  private renderOneFloor(floor: HubFloor, floorIdx: number): void {
    const floorOffsetY = floorIdx * FLOOR_CANVAS_H
    const tier = (this.floorTiers[floor.id] ?? 0) as FloorUpgradeTier
    const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']

    // ---- Background tiles ----
    for (let r = 0; r < floor.bg.length && r < FLOOR_ROWS; r++) {
      for (let c = 0; c < floor.bg[r].length && c < FLOOR_COLS; c++) {
        const bgType = floor.bg[r][c]
        if (bgType === FloorBgTile.Empty) continue
        const color = BG_COLORS[bgType]
        if (color === undefined) continue
        const alpha = tier === 0 ? 0.35 : 1.0
        this.tileGraphics.fillStyle(color, alpha)
        this.tileGraphics.fillRect(
          c * FLOOR_TILE_SIZE,
          floorOffsetY + r * FLOOR_TILE_SIZE,
          FLOOR_TILE_SIZE, FLOOR_TILE_SIZE,
        )
      }
    }

    // ---- Foreground tiles ----
    for (let r = 0; r < floor.fg.length && r < FLOOR_ROWS; r++) {
      for (let c = 0; c < floor.fg[r].length && c < FLOOR_COLS; c++) {
        const fgType = floor.fg[r][c]
        if (fgType === FloorFgTile.Empty) continue
        const style = FG_COLORS[fgType]
        if (!style) continue
        const alpha = tier === 0 ? style.alpha * 0.35 : style.alpha
        this.tileGraphics.fillStyle(style.color, alpha)
        this.tileGraphics.fillRect(
          c * FLOOR_TILE_SIZE,
          floorOffsetY + r * FLOOR_TILE_SIZE,
          FLOOR_TILE_SIZE, FLOOR_TILE_SIZE,
        )

        // Phase 10.14 — Glass seam detail lines
        if (fgType === FloorFgTile.GlassWall || fgType === FloorFgTile.GlassCeiling) {
          this.drawGlassDetail(
            this.detailGraphics,
            c * FLOOR_TILE_SIZE,
            floorOffsetY + r * FLOOR_TILE_SIZE,
          )
        }

        // Phase 10.14 — Rivet dots on metal tiles
        if (fgType === FloorFgTile.MetalFrame || fgType === FloorFgTile.MetalGrate) {
          this.drawRivetDots(
            this.detailGraphics,
            c * FLOOR_TILE_SIZE,
            floorOffsetY + r * FLOOR_TILE_SIZE,
          )
        }
      }
    }

    // Phase 10.14 — Subtle floor noise (seeded per floor index)
    this.drawFloorNoise(floorIdx, floorOffsetY)

    // Phase 10.12 — Tier 0: dark overlay to desaturate
    if (tier === 0) {
      this.tileGraphics.fillStyle(0x000000, 0.5)
      this.tileGraphics.fillRect(0, floorOffsetY, FLOOR_CANVAS_W, FLOOR_CANVAS_H)
    }

    // Phase 10.12 — Tier 1+: warm light glow at floor center
    if (tier >= 1) {
      this.glowGraphics.fillStyle(0xffe8a0, 0.06)
      this.glowGraphics.fillCircle(FLOOR_CANVAS_W / 2, floorOffsetY + FLOOR_CANVAS_H / 2, 120)
    }

    // Phase 10.12 — Tier 2+: extra ambient glow (golden dust effect via particle count boost handled in initAllParticles)
    if (tier >= 2) {
      this.glowGraphics.fillStyle(0xffd070, 0.04)
      this.glowGraphics.fillCircle(FLOOR_CANVAS_W / 2, floorOffsetY + FLOOR_CANVAS_H / 2, 180)
    }

    // ---- Objects ----
    const visibleObjects = floor.objects.filter(obj => tier >= (obj.minTier ?? 0))

    for (const obj of visibleObjects) {
      const x = obj.gridX * FLOOR_TILE_SIZE
      const y = floorOffsetY + obj.gridY * FLOOR_TILE_SIZE
      const w = obj.gridW * FLOOR_TILE_SIZE
      const h = obj.gridH * FLOOR_TILE_SIZE

      // Glow ring for interactive objects
      if (obj.interactive) {
        this.glowGraphics.fillStyle(ambient.glowColor, ambient.glowAlpha)
        this.glowGraphics.fillRect(x - 2, y - 2, w + 4, h + 4)
      }

      // Object body
      const fillColor = obj.interactive ? 0x50c8a0 : 0x3c3c50
      const fillAlpha = obj.interactive ? 0.4 : 0.3
      this.objectGraphics.fillStyle(fillColor, fillAlpha)
      this.objectGraphics.fillRect(x, y, w, h)

      // Border for interactive objects
      if (obj.interactive) {
        this.objectGraphics.lineStyle(2, 0x50c8a0, 0.6)
        this.objectGraphics.strokeRect(x + 1, y + 1, w - 2, h - 2)
      }

      // Label
      const effectiveLabel = this.getEffectiveLabel(obj.action, obj.label)
      const labelText = effectiveLabel.length > 12
        ? effectiveLabel.slice(0, 11) + '\u2026'
        : effectiveLabel
      const text = this.add.text(x + w / 2, y + h / 2, labelText, {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '10px',
        color: '#e0e0e0',
        align: 'center',
        wordWrap: { width: w - 4, useAdvancedWrap: true },
      }).setOrigin(0.5).setDepth(5)
      this.labelTexts.push(text)
    }
  }

  /**
   * Phase 10.11 — Draw structural connectors between stacked floors.
   * Thin catwalk bars at top/bottom of each floor boundary and
   * translucent glass shaft lines along the left and right edges.
   */
  private renderFloorConnectors(floorCount: number): void {
    const connectorGfx = this.detailGraphics
    for (let i = 0; i < floorCount; i++) {
      const baseY = i * FLOOR_CANVAS_H

      // Top catwalk bar
      connectorGfx.fillStyle(0x2a2a3a, 0.8)
      connectorGfx.fillRect(0, baseY, FLOOR_CANVAS_W, 4)

      // Bottom catwalk bar
      connectorGfx.fillStyle(0x2a2a3a, 0.8)
      connectorGfx.fillRect(0, baseY + FLOOR_CANVAS_H - 4, FLOOR_CANVAS_W, 4)

      // Vertical glass shaft lines on left + right edges
      connectorGfx.lineStyle(1, 0x4ecca3, 0.15)
      connectorGfx.lineBetween(4, baseY, 4, baseY + FLOOR_CANVAS_H)
      connectorGfx.lineBetween(FLOOR_CANVAS_W - 4, baseY, FLOOR_CANVAS_W - 4, baseY + FLOOR_CANVAS_H)
    }
  }

  /**
   * Phase 10.14 — Draw horizontal glass panel seam lines within one tile.
   * Very low alpha so detail is subtle.
   */
  private drawGlassDetail(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
    gfx.lineStyle(1, 0xb4dcff, 0.08)
    for (let py = y; py < y + FLOOR_TILE_SIZE; py += 4) {
      gfx.lineBetween(x, py, x + FLOOR_TILE_SIZE, py)
    }
  }

  /**
   * Phase 10.14 — Draw rivet dots at the four corners of a metal tile.
   */
  private drawRivetDots(gfx: Phaser.GameObjects.Graphics, x: number, y: number): void {
    gfx.fillStyle(0x888899, 0.25)
    const r = 1.5
    const pad = 3
    gfx.fillCircle(x + pad,                     y + pad,                     r)
    gfx.fillCircle(x + FLOOR_TILE_SIZE - pad,    y + pad,                     r)
    gfx.fillCircle(x + pad,                     y + FLOOR_TILE_SIZE - pad,    r)
    gfx.fillCircle(x + FLOOR_TILE_SIZE - pad,    y + FLOOR_TILE_SIZE - pad,    r)
  }

  /**
   * Phase 10.14 — Scatter tiny noise dots across a floor's surface area.
   * Uses a deterministic seed per floorIdx so the pattern is stable across re-renders.
   */
  private drawFloorNoise(floorIdx: number, floorOffsetY: number): void {
    const seed = (floorIdx * 0x9e3779b9) >>> 0
    const rng = this.seededRng(seed)
    const dotCount = 40
    this.detailGraphics.fillStyle(0xffffff, 0.05)
    for (let i = 0; i < dotCount; i++) {
      const nx = rng() * FLOOR_CANVAS_W
      const ny = floorOffsetY + rng() * FLOOR_CANVAS_H
      this.detailGraphics.fillRect(nx, ny, 1, 1)
    }
  }

  /**
   * For special objects, the label may differ from the static floor definition.
   * Currently only 'knowledgeTree' is dynamic (shows the tree growth stage name).
   */
  private getEffectiveLabel(action: string, defaultLabel: string): string {
    if (action === 'knowledgeTree') {
      return getTreeStage(this.masteredCount).label
    }
    return defaultLabel
  }

  // =========================================================
  // Input
  // =========================================================

  /**
   * Wire up pointer-up hit-testing against floor objects (all floors in world space),
   * plus wheel scrolling for multi-floor navigation (Phase 10.11).
   */
  private setupInput(): void {
    // Pointer tap — hit-test against the floor at the world point
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)

      // Determine which floor the tap landed on based on world Y
      const unlocked = this.getUnlockedFloors()
      const tapFloorIdx = Math.floor(worldPoint.y / FLOOR_CANVAS_H)
      if (tapFloorIdx < 0 || tapFloorIdx >= unlocked.length) return
      const floor = unlocked[tapFloorIdx]
      const tier = (this.floorTiers[floor.id] ?? 0) as FloorUpgradeTier
      const floorLocalY = worldPoint.y - tapFloorIdx * FLOOR_CANVAS_H

      const visibleObjects = floor.objects.filter(obj => tier >= (obj.minTier ?? 0))

      // Test from front to back so the topmost object wins
      for (let i = visibleObjects.length - 1; i >= 0; i--) {
        const obj = visibleObjects[i]
        if (!obj.interactive) continue
        const ox = obj.gridX * FLOOR_TILE_SIZE
        const oy = obj.gridY * FLOOR_TILE_SIZE
        const ow = obj.gridW * FLOOR_TILE_SIZE
        const oh = obj.gridH * FLOOR_TILE_SIZE
        if (
          worldPoint.x >= ox && worldPoint.x < ox + ow &&
          floorLocalY  >= oy && floorLocalY  < oy + oh
        ) {
          hubEvents.emit('objectTap', obj.id, obj.action)
          return
        }
      }
    })

    // Phase 10.11 — Wheel scroll to move between floors
    this.input.on(
      'wheel',
      (_ptr: unknown, _objs: unknown[], _dx: number, dy: number) => {
        const unlocked = this.getUnlockedFloors()
        if (unlocked.length <= 1) return
        if (dy > 0 && this.floorIndex < unlocked.length - 1) {
          this.floorIndex++
          this.centerCamera()
          hubEvents.emit('floorChanged', this.floorIndex)
        } else if (dy < 0 && this.floorIndex > 0) {
          this.floorIndex--
          this.centerCamera()
          hubEvents.emit('floorChanged', this.floorIndex)
        }
      },
    )
  }

  // =========================================================
  // Particles
  // =========================================================

  /**
   * Phase 10.11 — Seed and build particleData for ALL unlocked floors.
   * Phase 10.12 — Tier 2+ floors get extra golden dust motes.
   * Particles carry a floorIndex so updateParticles can apply the correct Y offset.
   */
  private initAllParticles(): void {
    this.particleData = []
    const unlocked = this.getUnlockedFloors()
    for (let fi = 0; fi < unlocked.length; fi++) {
      const floor = unlocked[fi]
      const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']
      const tier = this.floorTiers[floor.id] ?? 0

      let seed = 0
      for (let i = 0; i < floor.id.length; i++) {
        seed = (seed * 31 + floor.id.charCodeAt(i)) >>> 0
      }
      const rng = this.seededRng(seed)

      // Base particle count + bonus for tier 2+
      const count = ambient.particleCount + (tier >= 2 ? 8 : 0)

      for (let p = 0; p < count; p++) {
        this.particleData.push({
          x:          rng() * FLOOR_CANVAS_W,
          y:          rng() * FLOOR_CANVAS_H,
          speed:      0.15 + rng() * 0.35,
          size:       1.5  + rng() * 1.5,
          alpha:      0.3  + rng() * 0.5,
          floorIndex: fi,
        })
      }

      // Extra golden dust motes for tier 2+
      if (tier >= 2) {
        const goldRng = this.seededRng(seed ^ 0xf00dcafe)
        for (let p = 0; p < 6; p++) {
          this.particleData.push({
            x:          goldRng() * FLOOR_CANVAS_W,
            y:          goldRng() * FLOOR_CANVAS_H,
            speed:      0.08 + goldRng() * 0.15,
            size:       2.0  + goldRng() * 1.0,
            alpha:      0.4  + goldRng() * 0.3,
            floorIndex: fi,
          })
        }
      }
    }
  }

  /** Advance and redraw all particles for this frame. */
  private updateParticles(delta: number): void {
    this.particleGraphics.clear()

    const unlocked = this.getUnlockedFloors()
    if (unlocked.length === 0) return

    for (const p of this.particleData) {
      const floor = unlocked[p.floorIndex]
      if (!floor) continue
      const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']
      const tier = this.floorTiers[floor.id] ?? 0

      p.y -= p.speed * delta * 0.06
      if (p.y < -p.size) {
        p.y = FLOOR_CANVAS_H + p.size
      }

      // World Y offset for this floor
      const worldY = p.floorIndex * FLOOR_CANVAS_H + p.y

      // Tier 2+ golden dust motes use a warm color (index-based: last 6 particles per tier-2 floor)
      const color = (tier >= 2) ? 0xffd070 : ambient.particleColor
      this.particleGraphics.fillStyle(color, p.alpha * 0.5)
      this.particleGraphics.fillCircle(p.x, worldY, p.size)
    }
  }

  // =========================================================
  // Phase 10.16 — Bubble helpers
  // =========================================================

  /**
   * Word-wrap text to at most maxCharsPerLine characters.
   * Returns at most 3 lines.
   */
  private wrapBubbleText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      if (current.length + word.length + 1 > maxCharsPerLine) {
        lines.push(current)
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) lines.push(current)
    return lines.slice(0, 3)
  }

  // =========================================================
  // Utilities
  // =========================================================

  /**
   * Fast deterministic PRNG (mulberry32 variant).
   * Returns a closure that generates floats in [0, 1).
   */
  private seededRng(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s += 0x6d2b79f5
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff
    }
  }
}
