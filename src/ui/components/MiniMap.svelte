<script lang="ts">
  import { miniMapData } from '../stores/miniMap'
  import { BlockType } from '../../data/types'

  /** Pixels drawn per grid cell on the mini-map canvas. */
  const MINI_SCALE = 3

  /** Map of BlockType enum values to their representative mini-map colors. */
  const BLOCK_COLORS: Record<number, string> = {
    [BlockType.Empty]:        '#3a3550',
    [BlockType.Dirt]:         '#5c4033',
    [BlockType.SoftRock]:     '#7a6652',
    [BlockType.Stone]:        '#6b6b6b',
    [BlockType.HardRock]:     '#4a4a4a',
    [BlockType.MineralNode]:  '#4ecca3',
    [BlockType.ArtifactNode]: '#e94560',
    [BlockType.DescentShaft]: '#6633cc',
    [BlockType.ExitLadder]:   '#00ff88',
    [BlockType.OxygenCache]:  '#5dade2',
  }

  const FALLBACK_COLOR = '#555555'

  /** Canvas element bound via bind:this. */
  let canvas = $state<HTMLCanvasElement | undefined>(undefined)

  $effect(() => {
    const data = $miniMapData
    if (!canvas || !data) return

    const { grid, playerX, playerY } = data

    if (!grid || grid.length === 0) return

    const rows = grid.length
    const cols = grid[0]?.length ?? 0

    if (cols === 0) return

    const canvasWidth = cols * MINI_SCALE
    const canvasHeight = rows * MINI_SCALE

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear with opaque dark background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw each revealed cell
    for (let row = 0; row < rows; row++) {
      const rowData = grid[row]
      if (!rowData) continue
      for (let col = 0; col < cols; col++) {
        const cell = rowData[col]
        if (!cell) continue

        const isVisible = cell.revealed || (cell.visibilityLevel !== undefined && cell.visibilityLevel > 0)
        if (!isVisible) continue

        const color = BLOCK_COLORS[cell.type] ?? FALLBACK_COLOR
        ctx.fillStyle = color
        ctx.fillRect(col * MINI_SCALE, row * MINI_SCALE, MINI_SCALE, MINI_SCALE)
      }
    }

    // Draw player as a bright white dot (always on top)
    if (playerX >= 0 && playerX < cols && playerY >= 0 && playerY < rows) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(playerX * MINI_SCALE, playerY * MINI_SCALE, MINI_SCALE, MINI_SCALE)
    }
  })
</script>

{#if $miniMapData}
  <div class="mini-map-container" aria-label="Mini map" role="img">
    <canvas
      bind:this={canvas}
      class="mini-map-canvas"
    ></canvas>
  </div>
{/if}

<style>
  .mini-map-container {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 21;
    background: rgba(10, 10, 30, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    padding: 3px;
    max-width: 120px;
    max-height: 96px;
    overflow: hidden;
    pointer-events: none;
  }

  .mini-map-canvas {
    display: block;
    max-width: 114px;
    max-height: 90px;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
</style>
