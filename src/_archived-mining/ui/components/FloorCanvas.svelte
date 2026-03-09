<script lang="ts">
  import {
    FLOOR_TILE_SIZE, FLOOR_CANVAS_W, FLOOR_CANVAS_H, FLOOR_RENDER_SCALE,
    FloorBgTile, FloorFgTile,
    type HubFloor, type FloorUpgradeTier,
  } from '../../data/hubLayout'
  import { getDomeSpriteUrls } from '../../game/domeManifest'
  import { getTreeStage } from '../../data/knowledgeTreeStages'

  interface AmbientConfig {
    particleColor: string
    particleCount: number
    glowColor: string
    glowBlur: number
  }

  const THEME_AMBIENT: Record<string, AmbientConfig> = {
    'sci-fi':       { particleColor: 'rgba(78,204,163,0.15)',  particleCount: 12, glowColor: '#4ecca3', glowBlur: 8  },
    'organic':      { particleColor: 'rgba(144,238,144,0.15)', particleCount: 18, glowColor: '#90ee90', glowBlur: 6  },
    'crystal':      { particleColor: 'rgba(100,149,237,0.2)',  particleCount: 20, glowColor: '#6495ed', glowBlur: 12 },
    'observatory':  { particleColor: 'rgba(255,255,200,0.25)', particleCount: 35, glowColor: '#ffffc8', glowBlur: 4  },
    'archive':      { particleColor: 'rgba(200,180,120,0.15)', particleCount: 8,  glowColor: '#c8b478', glowBlur: 6  },
    'market':       { particleColor: 'rgba(255,160,80,0.15)',  particleCount: 14, glowColor: '#ffa050', glowBlur: 8  },
    'industrial':   { particleColor: 'rgba(255,100,50,0.1)',   particleCount: 10, glowColor: '#ff6432', glowBlur: 10 },
  }

  interface Particle {
    x: number
    y: number
    speed: number
    size: number
    alpha: number
  }

  interface Props {
    floor: HubFloor
    upgradeTier: FloorUpgradeTier
    onObjectTap: (objectId: string, action: string) => void
    /** Number of facts the player has mastered (SM-2 repetitions >= 6). Used to show tree stage label. */
    masteredCount?: number
  }

  const { floor, upgradeTier, onObjectTap, masteredCount = 0 }: Props = $props()

  /**
   * Returns an effective display label for an object.
   * For the knowledge tree, swaps the static label with the current tree stage name.
   */
  function getEffectiveLabel(action: string, defaultLabel: string): string {
    if (action === 'knowledgeTree') {
      const stage = getTreeStage(masteredCount)
      return stage.label
    }
    return defaultLabel
  }

  let canvasEl: HTMLCanvasElement | undefined = $state()

  const BG_COLORS: Record<FloorBgTile, string> = {
    [FloorBgTile.Empty]: 'transparent',
    [FloorBgTile.SkyStars]: '#0a0a2e',
    [FloorBgTile.InteriorWall]: '#2a2a3e',
    [FloorBgTile.DirtGround]: '#4a3728',
    [FloorBgTile.StoneWall]: '#3a3a4a',
    [FloorBgTile.CrystalWall]: '#1a2a4a',
  }

  const FG_COLORS: Record<FloorFgTile, string | null> = {
    [FloorFgTile.Empty]: null,
    [FloorFgTile.GlassWall]: 'rgba(100,180,255,0.3)',
    [FloorFgTile.MetalFrame]: '#555568',
    [FloorFgTile.StoneFloor]: '#5a5a6a',
    [FloorFgTile.MetalGrate]: '#4a4a5a',
    [FloorFgTile.GlassCeiling]: 'rgba(120,200,255,0.25)',
    [FloorFgTile.WoodPlanks]: '#6a5038',
    [FloorFgTile.CrystalFloor]: '#2a4a6a',
  }

  /** Color for objects — fallback when sprites aren't loaded */
  const OBJ_COLOR = 'rgba(80,200,160,0.4)'

  // Particle state
  let particles: Particle[] = []
  let animFrameId: number | null = null
  let lastTimestamp: number = 0

  /**
   * Seeded pseudo-random number generator (mulberry32).
   * Produces deterministic values from a numeric seed.
   */
  function seededRng(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s += 0x6d2b79f5
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff
    }
  }

  /**
   * Initialises the particle array seeded by floor.id so positions are
   * deterministic across re-renders but vary per floor.
   */
  function initParticles(floorId: string, config: AmbientConfig, w: number, h: number): Particle[] {
    // Convert floorId string to a numeric seed
    let seed = 0
    for (let i = 0; i < floorId.length; i++) {
      seed = (seed * 31 + floorId.charCodeAt(i)) >>> 0
    }
    const rng = seededRng(seed)
    return Array.from({ length: config.particleCount }, () => ({
      x:     rng() * w,
      y:     rng() * h,
      speed: 0.15 + rng() * 0.35,
      size:  1.5 + rng() * 1.5,
      alpha: 0.4 + rng() * 0.6,
    }))
  }

  function drawFloor(): void {
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    const scale = FLOOR_RENDER_SCALE
    const tileW = FLOOR_TILE_SIZE * scale
    const tileH = FLOOR_TILE_SIZE * scale

    const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']

    // Clear
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

    // Draw background tiles
    for (let r = 0; r < floor.bg.length; r++) {
      for (let c = 0; c < floor.bg[r].length; c++) {
        const bgType = floor.bg[r][c]
        if (bgType === FloorBgTile.Empty) continue
        ctx.fillStyle = BG_COLORS[bgType] ?? '#1a1a2e'
        ctx.fillRect(c * tileW, r * tileH, tileW, tileH)
      }
    }

    // Draw foreground tiles
    for (let r = 0; r < floor.fg.length; r++) {
      for (let c = 0; c < floor.fg[r].length; c++) {
        const fgType = floor.fg[r][c]
        const color = FG_COLORS[fgType]
        if (!color) continue
        ctx.fillStyle = color
        ctx.fillRect(c * tileW, r * tileH, tileW, tileH)
      }
    }

    // Draw objects (filtered by upgrade tier)
    const visibleObjects = floor.objects.filter(obj => upgradeTier >= (obj.minTier ?? 0))
    for (const obj of visibleObjects) {
      const x = obj.gridX * tileW
      const y = obj.gridY * tileH
      const w = obj.gridW * tileW
      const h = obj.gridH * tileH

      // Apply glow to interactive objects
      if (obj.interactive) {
        ctx.shadowColor = ambient.glowColor
        ctx.shadowBlur = ambient.glowBlur
      }

      // Object background fill
      ctx.fillStyle = obj.interactive ? OBJ_COLOR : 'rgba(60,60,80,0.3)'
      ctx.fillRect(x, y, w, h)

      // Reset shadow after fill so the border stroke isn't double-blurred
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Object border
      if (obj.interactive) {
        ctx.strokeStyle = 'rgba(80,200,160,0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
      }

      // Label — use effective label (tree stage name for knowledge tree)
      ctx.fillStyle = '#e0e0e0'
      ctx.font = `${10 * scale}px 'Press Start 2P', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const effectiveLabel = getEffectiveLabel(obj.action, obj.label)
      const labelText = effectiveLabel.length > 12 ? effectiveLabel.slice(0, 11) + '\u2026' : effectiveLabel
      ctx.fillText(labelText, x + w / 2, y + h / 2)
    }
  }

  /**
   * Draws the current particle positions on top of the floor content.
   */
  function drawParticles(ctx: CanvasRenderingContext2D, config: AmbientConfig): void {
    ctx.save()
    for (const p of particles) {
      ctx.globalAlpha = p.alpha * 0.8
      ctx.fillStyle = config.particleColor
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  /**
   * Animation loop: updates particle positions and redraws the canvas each frame.
   */
  function animLoop(timestamp: number): void {
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    const delta = lastTimestamp === 0 ? 16 : timestamp - lastTimestamp
    lastTimestamp = timestamp

    const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']
    const h = canvasEl.height

    // Update particle positions
    for (const p of particles) {
      p.y -= p.speed * delta * 0.06
      if (p.y < -p.size) {
        p.y = h + p.size
      }
    }

    // Redraw floor then overlay particles
    drawFloor()
    drawParticles(ctx, ambient)

    animFrameId = requestAnimationFrame(animLoop)
  }

  $effect(() => {
    // Re-initialise particles whenever floor changes
    floor; upgradeTier; masteredCount;

    if (!canvasEl) return

    const ambient = THEME_AMBIENT[floor.theme] ?? THEME_AMBIENT['sci-fi']
    particles = initParticles(floor.id, ambient, canvasEl.width, canvasEl.height)
    lastTimestamp = 0

    // Cancel any existing animation loop before starting a new one
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }

    animFrameId = requestAnimationFrame(animLoop)

    return () => {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId)
        animFrameId = null
      }
    }
  })

  function handleClick(event: MouseEvent): void {
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    const scaleX = canvasEl.width / rect.width
    const scaleY = canvasEl.height / rect.height
    const px = (event.clientX - rect.left) * scaleX
    const py = (event.clientY - rect.top) * scaleY

    const tileW = FLOOR_TILE_SIZE * FLOOR_RENDER_SCALE
    const tileH = FLOOR_TILE_SIZE * FLOOR_RENDER_SCALE

    // Find clicked object (check in reverse for z-order priority)
    const visibleObjects = floor.objects.filter(obj => upgradeTier >= (obj.minTier ?? 0))
    for (let i = visibleObjects.length - 1; i >= 0; i--) {
      const obj = visibleObjects[i]
      if (!obj.interactive) continue
      const ox = obj.gridX * tileW
      const oy = obj.gridY * tileH
      const ow = obj.gridW * tileW
      const oh = obj.gridH * tileH
      if (px >= ox && px < ox + ow && py >= oy && py < oy + oh) {
        onObjectTap(obj.id, obj.action)
        return
      }
    }
  }
</script>

<canvas
  bind:this={canvasEl}
  width={FLOOR_CANVAS_W * FLOOR_RENDER_SCALE}
  height={FLOOR_CANVAS_H * FLOOR_RENDER_SCALE}
  class="floor-canvas"
  onclick={handleClick}
  aria-label={`${floor.name} floor`}
></canvas>

<style>
  .floor-canvas {
    width: 100%;
    max-width: 768px;
    height: auto;
    image-rendering: pixelated;
    display: block;
    margin: 0 auto;
  }
</style>
