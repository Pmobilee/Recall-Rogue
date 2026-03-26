<script lang="ts">
  interface Props {
    labels: string[]
    values: number[]
    size: number
  }

  const { labels, values, size }: Props = $props()

  let canvasEl: HTMLCanvasElement | undefined = $state()

  $effect(() => {
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvasEl.width = size * dpr
    canvasEl.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const maxR = size * 0.35
    const n = labels.length
    if (n === 0) return

    ctx.clearRect(0, 0, size, size)

    // Draw concentric webs (5 levels)
    for (let level = 1; level <= 5; level++) {
      const r = (level / 5) * maxR
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const angle = (Math.PI * 2 * (i % n)) / n - Math.PI / 2
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Draw axis lines and labels
    ctx.font = `${Math.max(8, size * 0.035)}px 'Lora', 'Georgia', serif`
    ctx.fillStyle = '#888'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const axisX = cx + maxR * Math.cos(angle)
      const axisY = cy + maxR * Math.sin(angle)

      // Axis line
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(axisX, axisY)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Label
      const labelR = maxR + size * 0.08
      const lx = cx + labelR * Math.cos(angle)
      const ly = cy + labelR * Math.sin(angle)
      ctx.fillText(labels[i], lx, ly)
    }

    // Draw data polygon
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 * (i % n)) / n - Math.PI / 2
      const v = Math.min(1, Math.max(0, values[i % n] ?? 0))
      const r = v * maxR
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(78, 204, 163, 0.25)'
    ctx.fill()
    ctx.strokeStyle = '#4ecca3'
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw data dots
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const v = Math.min(1, Math.max(0, values[i] ?? 0))
      const r = v * maxR
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#4ecca3'
      ctx.fill()
    }
  })
</script>

<canvas
  bind:this={canvasEl}
  style="width: {size}px; height: {size}px;"
></canvas>
